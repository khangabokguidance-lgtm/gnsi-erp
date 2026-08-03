// convert_bmei_to_unicode.cjs
//
// Fixes existing qbank_questions rows where Mayek text was typed using the
// legacy BMEI04 font (ASCII characters that only look like Mayek when
// displayed with BMEI04 installed) instead of real Unicode Meitei Mayek.
//
// This script re-encodes question_mayek, option_a_mayek, option_b_mayek,
// option_c_mayek, option_d_mayek using the verified BMEI04 -> Unicode
// character map (sourced from the BMEI Meitei Mayek Generator tool's
// BMEI_MAP_DEFAULT table).
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

// ── BMEI04 -> Unicode Meitei Mayek character map ────────────────────────────
// Sourced verbatim from BMEI_MAP_DEFAULT in the BMEI Meitei Mayek Generator
// tool. Each key is the ASCII character typed; value is the real Unicode
// Meitei Mayek glyph it's supposed to represent.
const BMEI_MAP = {
  // Lowercase: basic consonants
  'k':'ꯀ','s':'ꯁ','l':'ꯂ','m':'ꯃ','p':'ꯄ','n':'ꯅ','c':'ꯆ','t':'ꯇ',
  'v':'ꯋ','y':'ꯌ','h':'ꯍ','f':'ꯐ','g':'ꯒ','r':'ꯔ','b':'ꯕ','j':'ꯖ',
  'd':'ꯗ','z':'ꯉ','w':'ꯋ','q':'ꯘ',
  // Lowercase: vowel matras
  'a':'ꯥ','e':'ꯦ','i':'ꯤ','o':'ꯣ','u':'ꯨ','x':'ꯩ',
  // Uppercase: independent vowels
  'A':'ꯑ','E':'ꯏ','O':'ꯎ','I':'ꯤ','U':'ꯎ',
  // Uppercase: lonsum (final closed consonant forms)
  'K':'ꯛ','L':'ꯜ','M':'ꯝ','N':'ꯟ','Z':'ꯪ','T':'ꯠ','P':'ꯞ',
  // Uppercase: cluster-position consonants
  'H':'ꯍ','Y':'ꯌ','B':'ꯕ','C':'ꯆ','D':'ꯗ','F':'ꯐ','G':'ꯒ','J':'ꯖ',
  'R':'ꯔ','S':'ꯁ','V':'ꯋ','W':'ꯋ','X':'ꯦ','Q':'ꯘ',
  // Special characters
  '_':'꯭','|':'꯫',
  // Meitei Mayek digits
  '0':'꯰','1':'꯱','2':'꯲','3':'꯳','4':'꯴','5':'꯵','6':'꯶','7':'꯷','8':'꯸','9':'꯹',
  // Symbol keys (no shift)
  '-':'ꯤ','=':'ꯥ','[':'ꯓ',']':'ꯙ','\\':'ꯊ',';':'ꯏ',"'":'ꯚ',',':'ꯈ','.':'ꯍ','/':'ꯎ',
  // Shift + symbol keys
  '+':'ꯘ','{':'ꯓ','}':'ꯙ',':':'ꯚ','"':'ꯋ','<':'ꯈ','>':'ꯊ','?':'ꯎ',
};

function bmeiToUnicode(bmei) {
  if (!bmei) return bmei;
  let result = '';
  for (let i = 0; i < bmei.length; i++) {
    const ch = bmei[i];
    if (ch === ' ') { result += ' '; continue; }
    result += BMEI_MAP[ch] !== undefined ? BMEI_MAP[ch] : ch;
  }
  return result;
}

// Heuristic: skip fields that already look like real Unicode Mayek
// (i.e. contain characters in the Meetei Mayek Unicode block U+ABC0-ABFF
// or U+AAE0-AAFF), so we don't double-convert already-correct rows.
function looksLikeUnicodeMayek(text) {
  if (!text) return false;
  return /[\uABC0-\uABFF\uAAE0-\uAAFF]/.test(text);
}

const FIELDS = ['question_mayek', 'option_a_mayek', 'option_b_mayek', 'option_c_mayek', 'option_d_mayek'];

async function main() {
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
