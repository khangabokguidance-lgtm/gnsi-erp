// apply_extracted_mayek.cjs
//
// Matches the extracted, verified Manipuri Mayek translations (from the
// original Dream Wings docx source files) against your live qbank_questions
// table, and updates question_mayek with the correct text — replacing the
// garbled BMEI04-typed-as-English text currently stored for many rows.
//
// Matching strategy: normalize both the DB's `question` field and the
// extracted `english_clean` field (strip leading numbering, punctuation,
// extra whitespace, lowercase) and match on exact normalized equality.
// Only rows with a single unambiguous match are updated; anything with
// zero or multiple matches is logged and skipped for manual review.
//
// SAFE BY DEFAULT: dry run first. Pass --apply to write changes.
//
// SETUP:
//   1. npm install @supabase/supabase-js
//   2. Set env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   3. Place extracted_mayek.json (from the Python extractor) in this folder
//   4. Dry run: node apply_extracted_mayek.cjs
//   5. Review output, then: node apply_extracted_mayek.cjs --apply

const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes("--apply");

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function normalize(text) {
  if (!text) return '';
  return text
    .replace(/^Q?\d+\.\s*/i, '')   // strip leading "12." or "Q12."
    .replace(/\s+/g, ' ')          // collapse whitespace
    .replace(/[.:]+$/, '')         // strip trailing punctuation
    .trim()
    .toLowerCase();
}

async function main() {
  console.log(APPLY ? "APPLY MODE — changes will be written." : "DRY RUN — no changes will be written. Pass --apply to write.");

  const extracted = JSON.parse(fs.readFileSync("./extracted_mayek.json", "utf-8"));
  console.log(`Loaded ${extracted.length} extracted Q+Mayek pairs.`);

  // Build lookup: normalized english -> list of extracted records
  const byNormEnglish = new Map();
  for (const rec of extracted) {
    const key = normalize(rec.english_clean);
    if (!byNormEnglish.has(key)) byNormEnglish.set(key, []);
    byNormEnglish.get(key).push(rec);
  }

  // Fetch all DB rows (paginated)
  let dbRows = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('qbank_questions')
      .select('id, question, question_mayek')
      .range(from, from + PAGE - 1);
    if (error) { console.error("Fetch error:", error.message); process.exit(1); }
    if (!data || data.length === 0) break;
    dbRows = dbRows.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  console.log(`Fetched ${dbRows.length} DB rows.`);

  let matched = 0, ambiguous = 0, noMatch = 0, updated = 0;
  const ambiguousLog = [];
  const noMatchLog = [];
  const sampleUpdates = [];

  for (const row of dbRows) {
    const key = normalize(row.question);
    const candidates = byNormEnglish.get(key);

    if (!candidates || candidates.length === 0) {
      noMatch++;
      noMatchLog.push({ id: row.id, question: row.question });
      continue;
    }
    if (candidates.length > 1) {
      // Multiple docx entries normalized to the same english text — ambiguous, skip.
      ambiguous++;
      ambiguousLog.push({ id: row.id, question: row.question, candidateCount: candidates.length });
      continue;
    }

    matched++;
    const correctMayek = candidates[0].manipuri_mayek;

    if (correctMayek && correctMayek !== row.question_mayek) {
      if (sampleUpdates.length < 20) {
        sampleUpdates.push({
          id: row.id,
          question: row.question,
          before: row.question_mayek,
          after: correctMayek,
        });
      }
      if (APPLY) {
        const { error: updErr } = await supabase
          .from('qbank_questions')
          .update({ question_mayek: correctMayek })
          .eq('id', row.id);
        if (updErr) console.error(`Update failed for ${row.id}:`, updErr.message);
        else updated++;
      }
    }
  }

  console.log(`\n=== SAMPLE UPDATES (first ${sampleUpdates.length}) ===`);
  for (const s of sampleUpdates) {
    console.log(`\n[${s.id}]`);
    console.log(`  Q: ${s.question}`);
    console.log(`  before: ${s.before}`);
    console.log(`  after:  ${s.after}`);
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Matched (unambiguous): ${matched}`);
  console.log(`Ambiguous (multiple docx matches, skipped): ${ambiguous}`);
  console.log(`No match found (skipped): ${noMatch}`);
  if (APPLY) console.log(`Actually updated in Supabase: ${updated}`);
  else console.log(`DRY RUN — nothing written. Re-run with --apply to save changes.`);

  fs.writeFileSync("ambiguous_rows.json", JSON.stringify(ambiguousLog, null, 2), "utf-8");
  fs.writeFileSync("no_match_rows.json", JSON.stringify(noMatchLog, null, 2), "utf-8");
  console.log(`\nWrote ambiguous_rows.json (${ambiguousLog.length}) and no_match_rows.json (${noMatchLog.length}) for review.`);
}

main();
