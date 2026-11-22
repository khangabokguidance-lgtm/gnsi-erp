// syllabusPlan2026.js — the Mission Sainik syllabus plan 2026-27 (from "Mission Sainik syllabus plan 2026-27", dated 21 November 2026):
// one chapter for each of the 6 sections of each of the 20 Pre Mock tests = 120 chapters. Wording is exactly as in that document
// (a stray trailing comma was dropped and comma spacing tidied in one chapter). Load it from Mission Sainik → Syllabus → “Load plan 2026-27”.
export const PLAN_SUBJECTS = ["Mathematics", "Reasoning", "Science", "General Knowledge", "English Grammar", "Vocabulary"]

// [test no, [Mathematics, Reasoning, Science, General Knowledge, English Grammar, Vocabulary]]
export const SYLLABUS_PLAN_2026 = [
  [1, ["Natural Numbers, Prime and Composite Numbers, Roman Numerals", "Analogies", "Scientific device used in our daily life", "National Symbols of India", "Kinds of Nouns", "Noun - The Gender"]],
  [2, ["Operation on Numbers", "Pattern Completion and Geometrical figure completion", "Animals and their Surroundings", "National Symbols of India", "Pronouns", "Noun - The Number"]],
  [3, ["Simplification", "Mathematical Operations", "Cooking and Preservation Techniques", "Famous Monuments", "Verbs", "Collective Noun"]],
  [4, ["Fractions, Arranging of Fractions", "Coding Decoding", "Germination and Dispersal of Seed", "Famous Monuments", "Adjectives", "Rhyming words"]],
  [5, ["Decimal Numbers", "Embedded Figure", "Water conservation & Pollution", "First in India", "Adverbs", "Confusing words ( Homonyms )"]],
  [6, ["LCM and HCF", "Venn Diagram", "Microbial Diseases & Deficiency", "Superatives of India", "Present Tense", "Antonyms"]],
  [7, ["Conversion of Units, Temperature", "Classification", "Mountain terrain & lifestyle", "Books & Authors", "Past Tense", "Synonyms"]],
  [8, ["Ratio and Proportion", "Figure Matching", "Shape ofthe earth & Gravitation", "Sports and Games", "Future Tense", "Idioms and Phrases"]],
  [9, ["Unitary Method", "Order and Ranking", "Non-Renewable Resources of India", "Sports and Games", "Tense forms", "Correct spelling"]],
  [10, ["Average", "Word Formation", "Food, Culture, habitat & language of India", "Indian Defence system", "Prepositions", "Passage with Vocabulary ( word meaning)"]],
  [11, ["Percentage", "Mirror Image", "Function of parts of plants and animals", "Indian Defence system", "Conjunctions", "Noun - The Gender"]],
  [12, ["Profit and Loss", "Clock and Calendar", "Function of parts of plants and animals", "Classical Dance of India", "Interjection", "Noun - The Number"]],
  [13, ["Simple Interest", "Blood Relations", "Natural Disaster", "Folk Dance of India", "Article", "Collective Noun"]],
  [14, ["Lines and Angles, Types of angle, Complementary and Supplementary angles", "Figure Series", "Evaporation, condensation & Water Cycle", "Music of India", "Types of Sentences", "Confusing words ( Homonyms)"]],
  [15, ["Plane Figures", "Dictionary Word Order", "Farmer & Farming techniques", "International Organizations", "Ordering of Words in a Sentence", "Rhyming words"]],
  [16, ["Circle", "Series Completion", "Tribal Community and Forest produce", "International Organizations", "Sentence Formation", "Antonyms"]],
  [17, ["Area and Perimeter 1", "Odd Man Out", "The Solar System", "Major Religions of India", "Question Tags", "Synonyms"]],
  [18, ["Area and Perimeter 2", "Paper Folding", "Energy resources", "Major Religions of India", "Subject-Verb Agreement", "Correct spelling"]],
  [19, ["Volume of Cube and Cuboids", "Direction Test", "Relationship between Human and Animals", "Indian Literary & Cultural Awards", "Adverbs, Adjectives, Prepositions and Conjunctions", "Passage with Vocabulary ( word meaning)"]],
  [20, ["Speed and Time", "Logical Reasoning", "Relationship between Human and Animals", "Indian Literary & Cultural Awards", "Tense Forms", "Idioms and phrases"]],
]

// The plan as database rows: { test_no, subject, chapter } — 120 of them.
export const planRows = () => SYLLABUS_PLAN_2026.flatMap(([test_no, chs]) => chs.map((chapter, i) => ({ test_no, subject: PLAN_SUBJECTS[i], chapter })))

const same = (a, b) => String(a || '').replace(/\s+/g, ' ').trim().toLowerCase() === String(b || '').replace(/\s+/g, ' ').trim().toLowerCase()

// Compare the plan with what is saved (syl: { 'testNo|Subject': chapter }). `write` is only the rows that need saving.
export function diffPlan(syl = {}) {
  const add = [], change = [], keep = []
  for (const r of planRows()) {
    const have = syl[r.test_no + '|' + r.subject]
    if (!String(have || '').trim()) add.push(r)
    else if (same(have, r.chapter)) keep.push(r)
    else change.push({ ...r, was: have })
  }
  return { add, change, keep, write: [...add, ...change] }
}
