// seed_syllabus.mjs
// One-time seed script matching the REAL production schema (confirmed via
// information_schema.columns query on 2026-07-25):
//
//   teaching_syllabus: id, course, batch, subject_name, total_topics,
//                       topic_list (jsonb), subtype, class_name,
//                       expected_end_date, created_at
//
//   syllabus_topics: id, syllabus_id, chapter_name, display_order,
//                     expected_date, completed, completed_at, created_at,
//                     tags, course, subject_name, order_num, subtopics (jsonb)
//
// Populates the AISSE (Sainik) Class VI syllabus and the Navodaya Class VI
// syllabus, applied across course streams: Sainik, Navodaya, Foundation,
// Combined — with a real chapter -> subtopics tree per subject.
//
// Sources:
//   - "All India Sainik Schools Entrance Examination — Syllabus Class VI"
//   - "Navodaya Subject-wise chapters" (JNVST pattern)
//
// Usage:
//   1. npm install @supabase/supabase-js   (run from project root)
//   2. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY as env vars
//   3. node src/seed/seed_syllabus.mjs     (run from project root)
//
// Safe to re-run: skips inserting a chapter if one with the same
// chapter_name already exists under that (course, subject_name) pair.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables first.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ─── Syllabus definitions ──────────────────────────────────────────────────
// Each block: { chapter, subtopics: [...] }
// Where a source topic had no natural sub-breakdown, subtopics holds a
// single entry matching the chapter name (so the log form's sub-topic
// picker always has at least one option).

function flat(names) {
  return names.map(n => ({ chapter: n, subtopics: [n] }))
}

const AISSE_MATHEMATICS = flat([
  'Natural Numbers','LCM and HCF','Unitary Method','Fractions','Ratio and Proportion',
  'Profit and Loss','Simplification','Average','Percentage','Area and Perimeter',
  'Simple Interest','Lines and Angles','Temperature','Conversion of Units','Roman Numerals',
  'Types of Angles','Circle','Volume of Cube and Cuboids','Prime and Composite Numbers',
  'Plane Figures','Decimal Numbers','Speed and Time','Operation on Numbers',
  'Complementary and Supplementary Angles','Arranging of Fractions',
])

const AISSE_INTELLIGENCE = flat([
  'Analogies (Mathematical & Verbal)','Venn Diagram','Paper Folding','Embedded/Hidden Figure',
  'Geometrical Figure Completion','Space Visualisation','Order & Ranking','Coding Decoding',
  'Mathematical Operations','Blood Relations','Sitting Arrangement','Mirror Image',
  'Figure Matching','Figure Series Completion','Odd-Man Out','Pattern Completion',
  'Classification','Word Formation','Dictionary — Word Order','Series','Direction Test',
  'Clock and Calendar',
])

const AISSE_LANGUAGE_ENGLISH = flat([
  'Comprehension Passage','Preposition','Article','Vocabulary','Verbs and Type',
  'Confusing Words','Question Tags','Types of Sentence','Tense Forms','Kinds of Nouns',
  'Kinds of Pronouns','Correct Spelling','Ordering of Words in Sentence','Sentence Formation',
  'Antonyms','Synonyms','Adjectives','Interjection','Idiom and Phrases','Collective Nouns',
  'Number','Gender','Adverbs','Rhyming Words','Singular/Plural',
])

const AISSE_LANGUAGE_HINDI = flat([
  'गद्यांश','विशेषण की पहचान','संज्ञा के भेदों की पहचान','मुहावरे','श्रुतिसंभिन्नार्थक शब्द',
  'अशुद्धिशोधन (वाक्य)','विलोम शब्द','पर्यायवाची शब्द','संधि','समास','क्रिया','उपसर्ग',
  'क्रिया विशेषण की पहचान','वचन बदलना','अर्थ के आधार पर वाक्य भेद','वाच्य परिवर्तन',
  'सर्वनाम की पहचान','काल','लिंग बदलना','वर्ण विचार','वाक्य विचार','लोकोक्तियाँ',
  'वर्तनी शुद्धि','प्रत्यय',
])

const AISSE_GENERAL_KNOWLEDGE = flat([
  'Different Types of Scientific Devices Used in Daily Life','Icons and Symbols of India',
  'Major Religions of India','Art and Culture','Defence','Sports and Games',
  'Super Senses','Relationship between Animals and Human Beings','Taste and Digestion',
  'Cooking and Preserving Techniques','Germination and Seed Dispersal',
  'Traditional Water Harvesting Techniques','Experiment with Water on Everyday Life',
  'Water Pollution and Microbial Diseases','Concepts on Mountain Terrain and Lifestyle',
  'Historical Monuments','Shape of Earth and Gravitation','Non-Renewable Energy Sources',
  'Food, Culture, Habitat, Languages of Various Regions','Names of Young Ones of Animals',
  'Functions of Body Parts of Plants and Animals','International Organizations',
  'Indian Literary and Cultural Personalities','Indian Literary and Cultural Awards',
  'Natural Calamities (Flood and Earthquake)','Evaporation, Condensation and Water Cycle',
  'Life of Farmers (Farming Techniques)','Tribal Communities and Forest Produce',
])

// Navodaya — real chapter -> subtopics groupings, taken directly from the
// source document's own nesting (e.g. "The Natural World" is a chapter with
// several subtopics beneath it).
const NAVODAYA_MENTAL_ABILITY = flat([
  'Pattern Completion','Figure Series',
  'Geometrical Figure Completion (Triangle, Square and Circle)',
  'Mirror Imaging','Water Imaging','Embedded Figure',
])

const NAVODAYA_EVS = [
  { chapter:'The Natural World', subtopics:[
    'Transportation','Rivers','Mountains','Plants','Animals on land and in water',
    'Natural disasters','Types of houses and shelters','Water cycle',
  ]},
  { chapter:'The Human Body', subtopics:[
    'Food and nutrients','Hygiene and cleanliness','Super senses',
    'Basic knowledge of the digestive system','Basic knowledge of the circulatory system',
    'Basic knowledge of the respiratory system',
  ]},
  { chapter:'Science in Daily Life', subtopics:[
    'Food preservation','Water pollution','Air pollution',
    'Conservation of water','Conservation of soil',
  ]},
  { chapter:'Social Surroundings', subtopics:[
    'Superlatives of India','States and capitals','National symbols','Different landscapes',
    'Festivals','Seasons','Forests','Crops','Clothes and fibres',
  ]},
]

const NAVODAYA_ARITHMETIC = flat([
  'Number and Numeric System','Four Fundamental Operations on Whole Numbers',
  'Factors and Multiples and Their Properties','Decimals and Fundamental Operations',
  'Conversion of Fractions to Decimals and Decimals to Fractions',
  'Measurement of Length, Mass, Capacity, Time and Money',
  'Simplification of Numerical Expressions',
  'Fractional Numbers and Addition/Subtraction of Like Fractions',
  'Perimeter and Area of Square, Rectangle and Triangle',
])

const NAVODAYA_LANGUAGE = flat([
  'Reading Comprehension – Passage 1','Reading Comprehension – Passage 2',
  'Reading Comprehension – Passage 3','Reading Comprehension – Passage 4',
])

// ─── Row definitions per stream ────────────────────────────────────────────
// subtype: null = applies to all batches in that course/stream (the existing
// UI/log-form code already falls back correctly when subtype is null).

const SYLLABUS_ROWS = [
  // ── SAINIK STREAM (Champion / Achiever / Leader) — AISSE Class VI pattern ──
  { course:'Sainik', subtype:null, subject_name:'Mathematics',        chapters:AISSE_MATHEMATICS },
  { course:'Sainik', subtype:null, subject_name:'Reasoning',          chapters:AISSE_INTELLIGENCE },
  { course:'Sainik', subtype:null, subject_name:'English Grammar',    chapters:AISSE_LANGUAGE_ENGLISH },
  { course:'Sainik', subtype:null, subject_name:'Hindi',              chapters:AISSE_LANGUAGE_HINDI },
  { course:'Sainik', subtype:null, subject_name:'General Knowledge',  chapters:AISSE_GENERAL_KNOWLEDGE },

  // ── NAVODAYA STREAM (Lakshya / Umeed) — JNVST pattern ──
  { course:'Navodaya', subtype:null, subject_name:'Mental Ability',     chapters:NAVODAYA_MENTAL_ABILITY },
  { course:'Navodaya', subtype:null, subject_name:'General Science',    chapters:NAVODAYA_EVS },
  { course:'Navodaya', subtype:null, subject_name:'Mathematics I',      chapters:NAVODAYA_ARITHMETIC },
  { course:'Navodaya', subtype:null, subject_name:'English Grammar',    chapters:NAVODAYA_LANGUAGE },

  // ── FOUNDATION STREAM (Elite / Prime) — same base pattern as Sainik,
  //    per "choose syllabus similar to other course" ──
  { course:'Foundation', subtype:null, subject_name:'Mathematics',       chapters:AISSE_MATHEMATICS },
  { course:'Foundation', subtype:null, subject_name:'Reasoning',         chapters:AISSE_INTELLIGENCE },
  { course:'Foundation', subtype:null, subject_name:'English Grammar',   chapters:AISSE_LANGUAGE_ENGLISH },
  { course:'Foundation', subtype:null, subject_name:'General Knowledge', chapters:AISSE_GENERAL_KNOWLEDGE },

  // ── COMBINED COURSE (Navodaya MM/ENG early-morning + evening session,
  //    per SOP Annexure-II/IV) — same Navodaya pattern, separate stream ──
  { course:'Combined', subtype:null, subject_name:'Meitei Mayek',     chapters:NAVODAYA_LANGUAGE },
  { course:'Combined', subtype:null, subject_name:'English Grammar',  chapters:NAVODAYA_LANGUAGE },
  { course:'Combined', subtype:null, subject_name:'Mathematics',      chapters:NAVODAYA_ARITHMETIC },
  { course:'Combined', subtype:null, subject_name:'General Science',  chapters:NAVODAYA_EVS },
]

async function seedRow(rowDef) {
  const { course, subtype, subject_name, chapters } = rowDef

  // Confirmed via SQL: teaching_syllabus has a unique constraint on
  // (course, subtype, class_name, subject_name) — safe to upsert directly.
  const { data: row, error: rowErr } = await supabase
    .from('teaching_syllabus')
    .upsert([{
      course, subtype: subtype || null, batch: subtype || null, class_name: null,
      subject_name, total_topics: chapters.length,
    }], { onConflict: 'course,subtype,class_name,subject_name' })
    .select()
    .single()

  if (rowErr) {
    console.error(`✗ ${course} / ${subject_name}: row upsert failed —`, rowErr.message)
    return
  }

  const { data: existingTopics } = await supabase
    .from('syllabus_topics')
    .select('chapter_name')
    .eq('syllabus_id', row.id)

  const existingNames = new Set((existingTopics || []).map(t => t.chapter_name?.toLowerCase().trim()))
  const newChapters = chapters.filter(c => !existingNames.has(c.chapter.toLowerCase().trim()))

  if (!newChapters.length) {
    console.log(`= ${course} / ${subject_name}: already seeded (${chapters.length} chapters)`)
    return
  }

  const payload = newChapters.map((c, i) => ({
    syllabus_id: row.id,
    chapter_name: c.chapter,
    subtopics: c.subtopics || [],
    course, subject_name,
    // order_num is a generated/computed column in the live DB — don't send it.
    display_order: i + 1,
    completed: false,
    tags: [],
  }))

  const { error: topicErr } = await supabase.from('syllabus_topics').insert(payload)
  if (topicErr) {
    console.error(`✗ ${course} / ${subject_name}: chapter insert failed —`, topicErr.message)
    return
  }

  console.log(`✓ ${course} / ${subject_name}: seeded ${payload.length} new chapters`)
}

async function main() {
  console.log(`Seeding ${SYLLABUS_ROWS.length} syllabus rows across Sainik, Navodaya, Foundation, Combined...\n`)
  for (const row of SYLLABUS_ROWS) {
    await seedRow(row)
  }
  console.log('\nDone.')
}

main()
