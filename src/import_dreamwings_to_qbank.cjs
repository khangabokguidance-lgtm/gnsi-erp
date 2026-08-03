// import_dreamwings_to_qbank.js
//
// Imports the Dream Wings Math question_bank.json into the EXISTING
// qbank_questions table used by QuestionBank.jsx — not a separate table.
//
// IMPORTANT: correct_option is NOT set by this import. The original
// Dream Wings documents list four options but never mark which one is
// correct — that had to be decided by a teacher when the paper was
// originally written, and isn't recoverable from the docx files.
// Rows are imported with correct_option = '' (empty) and MUST be
// reviewed/marked before being used in graded tests. They are safe to
// use immediately for MCQ *display* / practice reading in the Bank and
// Paper tabs, just not for auto-graded Online Test until marked.
//
// SETUP:
//   1. Run add_mayek_column.sql in the Supabase SQL editor first.
//   2. npm install @supabase/supabase-js
//   3. Set env vars:
//        SUPABASE_URL=https://your-project.supabase.co
//        SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
//   4. node import_dreamwings_to_qbank.js

const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function parseOptions(optionsList) {
  const result = { option_a: "", option_b: "", option_c: "", option_d: "" };
  const letterMap = { A: "option_a", B: "option_b", C: "option_c", D: "option_d" };
  for (const opt of optionsList || []) {
    const m = opt.trim().match(/^\(?([A-D])\)?\s*(.*)$/);
    if (m) {
      const [, letter, text] = m;
      const key = letterMap[letter];
      if (key) result[key] = text.trim();
    }
  }
  return result;
}

async function main() {
  const raw = fs.readFileSync("./question_bank.json", "utf-8");
  const dreamWingsQuestions = JSON.parse(raw);

  console.log(`Loaded ${dreamWingsQuestions.length} Dream Wings questions.`);

  const payload = dreamWingsQuestions.map((q) => {
    const opts = parseOptions(q.options);
    return {
      subject: "Mathematics",
      // Using the ORIGINAL Dream Wings topic name as-is, per your choice —
      // reconcile against your existing chapter list manually afterward.
      chapter: q.topic,
      subsection: "",
      question: q.english_text,
      question_mayek: q.mayek_text,
      option_a: opts.option_a,
      option_b: opts.option_b,
      option_c: opts.option_c,
      option_d: opts.option_d,
      correct_option: "", // NOT recoverable from source — must be set manually before grading use
      difficulty: "Medium",
      marks: 1,
      diagram_url: "",
    };
  });

  const batchSize = 500;
  let inserted = 0;

  for (let i = 0; i < payload.length; i += batchSize) {
    const batch = payload.slice(i, i + batchSize);
    const { error } = await supabase.from("qbank_questions").insert(batch);

    if (error) {
      console.error(`Batch ${i}-${i + batch.length} failed:`, error.message);
      process.exit(1);
    }

    inserted += batch.length;
    console.log(`Inserted ${inserted}/${payload.length}...`);
  }

  console.log("Done.");
  console.log(
    "\nREMINDER: correct_option was left blank for all imported rows — " +
    "these questions will show in Bank/Paper tabs but need correct answers " +
    "marked (via Manual Add's edit flow, or a follow-up update) before use " +
    "in the graded Online Test tab."
  );
}

main();