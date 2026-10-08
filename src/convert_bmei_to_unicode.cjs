// convert_bmei_to_unicode.cjs
//
// Fixes existing qbank_questions rows where Mayek text was typed using the
// legacy BMEI04 font (ASCII characters that only look like Mayek when
// displayed with BMEI04 installed) instead of real Unicode Meitei Mayek.
//
// This script re-encodes question_mayek, option_a_mayek, option_b_mayek,
// option_c_mayek, option_d_mayek using the app's verified BMEI04 -> Unicode
// key table (src/meetei_mayek.js).
//
// SAFE BY DEFAULT: does a DRY RUN first (prints before/after, changes nothing).
// Pass --apply to actually write changes to Supabase.
//
// SETUP:
//   1. npm install @supabase/supabase-js
//   2. Set env vars:
//        SUPABASE_URL=https://your-project.supabase.co
//        SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
//   3. Dry run first:  node convert_bmei_to_unicode.cjs
//   4. Review the output, then apply:  node convert_bmei_to_unicode.cjs --apply

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes("--apply");

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── BMEI04 -> Unicode Meitei Mayek ──────────────────────────────────────────
// Uses the app's own verified key table (src/meetei_mayek.js), so this script
// converts exactly the way the app does — including APUN IYEK order. The key
// table this script used to carry had several wrong keys (H, I, Z, x, ',' …)
// and kept APUN in typing order. Loaded in main() (it is an ES module).
let bmeiToUnicode;

// Heuristic: skip fields that already look like real Unicode Mayek
// (i.e. contain characters in the Meetei Mayek Unicode block U+ABC0-ABFF
// or U+AAE0-AAFF), so we don't double-convert already-correct rows.
function looksLikeUnicodeMayek(text) {
  if (!text) return false;
  return /[\uABC0-\uABFF\uAAE0-\uAAFF]/.test(text);
}

const FIELDS = ['question_mayek', 'option_a_mayek', 'option_b_mayek', 'option_c_mayek', 'option_d_mayek'];

async function main() {
  const { romanToMeetei } = await import('./meetei_mayek.js');
  bmeiToUnicode = t => (t ? romanToMeetei(t) : t);
  console.log(APPLY ? "APPLY MODE — changes will be written." : "DRY RUN — no changes will be written. Pass --apply to write.");

  let from = 0;
  const PAGE = 500;
  let totalRows = 0;
  let totalChanged = 0;
  let sampleShown = 0;

  while (true) {
    const { data, error } = await supabase
      .from('qbank_questions')
      .select('id,' + FIELDS.join(','))
      .range(from, from + PAGE - 1);

    if (error) { console.error("Fetch error:", error.message); process.exit(1); }
    if (!data || data.length === 0) break;

    for (const row of data) {
      totalRows++;
      const updates = {};
      let rowChanged = false;

      for (const field of FIELDS) {
        const val = row[field];
        if (!val) continue;
        if (looksLikeUnicodeMayek(val)) continue; // already correct, skip
        const converted = bmeiToUnicode(val);
        if (converted !== val) {
          updates[field] = converted;
          rowChanged = true;
        }
      }

      if (rowChanged) {
        totalChanged++;
        if (sampleShown < 15) {
          console.log(`\n--- Row ${row.id} ---`);
          for (const field of Object.keys(updates)) {
            console.log(`  ${field}:`);
            console.log(`    before: ${row[field]}`);
            console.log(`    after:  ${updates[field]}`);
          }
          sampleShown++;
        }

        if (APPLY) {
          const { error: updErr } = await supabase
            .from('qbank_questions')
            .update(updates)
            .eq('id', row.id);
          if (updErr) console.error(`Update failed for row ${row.id}:`, updErr.message);
        }
      }
    }

    from += PAGE;
    if (data.length < PAGE) break;
  }

  console.log(`\nScanned ${totalRows} rows. ${totalChanged} rows had BMEI04 text needing conversion.`);
  if (!APPLY) {
    console.log("This was a DRY RUN — nothing was written. Re-run with --apply to save changes.");
  } else {
    console.log("Applied changes to Supabase.");
  }
}

main();
