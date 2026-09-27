// officialSyllabus.js — the latest official entrance-exam syllabus and exam
// pattern for every course, split by admission class.
//
// Sources (checked September 2026):
//   • AISSEE (Sainik Schools) — NTA Information Bulletin: Class 6 and Class 9
//     subjects, question counts, marks and durations; Class 9 chapters follow
//     NCERT Class 8.
//   • JNVST (Navodaya) — NVS prospectus for the 2027 session: Class 6 now has
//     Mental Ability + Environmental Studies + Arithmetic + Language (20
//     questions each, 1.25 marks); Class 9 lateral entry: English, Hindi,
//     Mathematics, Science on NCERT Classes 6–8.
//   • RMS CET (Rashtriya Military Schools) — Class 6 four 50-mark sections
//     (English qualifying only); Class 9 Paper I (English, Hindi, Social
//     Science) + Paper II (Mathematics, Science) + interview.
//   • Foundation — no entrance exam; NCERT-aligned Class 5–8 course.
//
// The course taxonomy (qbankTaxonomy.js) merges these chapters in ADDITIVELY:
// existing chapter names are never renamed or removed, because questions,
// study materials and syllabus topics are saved under them. Chapters that
// are in the taxonomy but not in any current official list are reported by
// isInCurrentSyllabus() so screens can flag them.

// ── Exam patterns ───────────────────────────────────────────────────────────
export const EXAM_PATTERNS = {
  sainik: {
    exam: 'AISSEE', body: 'National Testing Agency (NTA)',
    classes: {
      6: {
        durationMin: 150, negative: false, mode: 'Pen & paper (OMR)', medium: 'English, Hindi and 11 regional languages',
        sections: [
          { subject: 'Mathematics', questions: 50, marksEach: 3 },
          { subject: 'Intelligence', questions: 25, marksEach: 2 },
          { subject: 'Language', questions: 25, marksEach: 2 },
          { subject: 'General Knowledge', questions: 25, marksEach: 2 },
        ],
        notes: ['Minimum 25% in each subject and 40% overall to qualify (reserved categories: no subject minimum).'],
      },
      9: {
        durationMin: 180, negative: false, mode: 'Pen & paper (OMR)', medium: 'English only',
        sections: [
          { subject: 'Mathematics', questions: 50, marksEach: 4 },
          { subject: 'Intelligence', questions: 25, marksEach: 2 },
          { subject: 'English', questions: 25, marksEach: 2 },
          { subject: 'General Science', questions: 25, marksEach: 2 },
          { subject: 'Social Science', questions: 25, marksEach: 2 },
        ],
        notes: ['Minimum 25% in each subject and 40% overall to qualify.', 'Chapters follow the NCERT Class 8 textbooks.'],
      },
    },
  },
  navodaya: {
    exam: 'JNVST', body: 'Navodaya Vidyalaya Samiti (NVS)',
    classes: {
      6: {
        durationMin: 120, negative: false, mode: 'Pen & paper (OMR)', medium: 'English, Hindi and the regional language of the state',
        sections: [
          { subject: 'Mental Ability', questions: 20, marksEach: 1.25 },
          { subject: 'Environmental Studies (EVS)', questions: 20, marksEach: 1.25 },
          { subject: 'Arithmetic', questions: 20, marksEach: 1.25 },
          { subject: 'Language', questions: 20, marksEach: 1.25, note: 'English or Hindi Language test (4 passages)' },
        ],
        notes: ['Mental Ability is non-verbal: figure-based questions only.', 'Language test is reading comprehension in the chosen medium.'],
      },
      9: {
        durationMin: 150, negative: false, mode: 'Pen & paper (OMR)', medium: 'English and Hindi',
        sections: [
          { subject: 'English', questions: 15, marksEach: 1 },
          { subject: 'Hindi', questions: 15, marksEach: 1 },
          { subject: 'Mathematics', questions: 35, marksEach: 1 },
          { subject: 'Science', questions: 35, marksEach: 1 },
        ],
        notes: ['Lateral entry for vacant seats; syllabus from NCERT Classes 6–8.'],
      },
    },
  },
  rms: {
    exam: 'RMS CET', body: 'Rashtriya Military Schools',
    classes: {
      6: {
        durationMin: 150, negative: false, mode: 'Pen & paper (OMR)', medium: 'English and Hindi',
        sections: [
          { subject: 'English Language', questions: 50, marksEach: 1, qualifyingOnly: true, note: 'Qualifying (35%) — not counted in merit' },
          { subject: 'Intelligence', questions: 50, marksEach: 1 },
          { subject: 'Mathematics', questions: 50, marksEach: 1 },
          { subject: 'General Knowledge', questions: 50, marksEach: 1, note: 'General Knowledge & Current Affairs' },
        ],
        notes: ['40% needed in Intelligence, Mathematics and GK.', 'Based on the CBSE Class 5 syllabus.'],
      },
      9: {
        durationMin: 150, negative: false, mode: 'Pen & paper (OMR)', medium: 'English only',
        sections: [
          { subject: 'English Language', questions: 50, marksEach: 1, paper: 'Paper I' },
          { subject: 'Hindi', questions: 20, marksEach: 1, paper: 'Paper I' },
          { subject: 'Social Science', questions: 30, marksEach: 1, paper: 'Paper I' },
          { subject: 'Mathematics', questions: 50, marksEach: 1, paper: 'Paper II' },
          { subject: 'Science', questions: 50, marksEach: 1, paper: 'Paper II' },
        ],
        notes: ['50% needed in each paper; followed by a 50-mark interview.', 'Based on the CBSE Class 8 syllabus.'],
      },
    },
  },
  foundation: {
    exam: 'Foundation', body: 'NCERT-aligned course (no entrance exam)',
    classes: {},
  },
}

// ── Chapters per course, class and subject ──────────────────────────────────
const NCERT8_MATHS = [
  'Rational Numbers', 'Linear Equations in One Variable', 'Understanding Quadrilaterals', 'Practical Geometry',
  'Data Handling', 'Squares and Square Roots', 'Cubes and Cube Roots', 'Comparing Quantities',
  'Algebraic Expressions and Identities', 'Visualising Solid Shapes', 'Mensuration', 'Exponents and Powers',
  'Direct and Inverse Proportions', 'Factorisation', 'Introduction to Graphs', 'Playing with Numbers',
]
const NCERT8_SCIENCE = [
  'Crop Production and Management', 'Microorganisms: Friend and Foe', 'Synthetic Fibres and Plastics',
  'Materials: Metals and Non-Metals', 'Coal and Petroleum', 'Combustion and Flame',
  'Conservation of Plants and Animals', 'Cell — Structure and Functions', 'Reproduction in Animals',
  'Reaching the Age of Adolescence', 'Force and Pressure', 'Friction', 'Sound',
  'Chemical Effects of Electric Current', 'Some Natural Phenomena', 'Light', 'Stars and the Solar System',
  'Pollution of Air and Water',
]
const NCERT8_SOCIAL = [
  // History
  'How, When and Where', 'From Trade to Territory', 'Ruling the Countryside', 'Tribals, Dikus and the Vision of a Golden Age',
  'When People Rebel — 1857 and After', 'Weavers, Iron Smelters and Factory Owners', 'Civilising the "Native", Educating the Nation',
  'Women, Caste and Reform', 'The Making of the National Movement: 1870s–1947', 'India After Independence',
  // Geography
  'Resources', 'Land, Soil, Water, Natural Vegetation and Wildlife Resources', 'Mineral and Power Resources',
  'Agriculture', 'Industries', 'Human Resources',
  // Civics
  'The Indian Constitution', 'Understanding Secularism', 'Why Do We Need a Parliament?', 'Understanding Laws',
  'Judiciary', 'Understanding Our Criminal Justice System', 'Understanding Marginalisation', 'Confronting Marginalisation',
  'Public Facilities', 'Law and Social Justice',
]
const ENGLISH_GRAMMAR_9 = [
  'Comprehension Passage', 'Vocabulary', 'Synonyms', 'Antonyms', 'Idioms and Phrases', 'One Word Substitution',
  'Tense Forms', 'Article', 'Preposition', 'Conjunction', 'Subject-Verb Agreement', 'Active and Passive Voice',
  'Direct and Indirect Speech', 'Sentence Correction', 'Correct Spelling',
]
const HINDI_9 = [
  'Apathit Gadyansh', 'Sangya', 'Sarvanam', 'Visheshan', 'Kriya', 'Kaal', 'Vachya', 'Sandhi', 'Samas',
  'Upsarg aur Pratyay', 'Paryayvachi Shabd', 'Vilom Shabd', 'Muhavare aur Lokoktiyan', 'Vakya Shuddhi',
]

export const OFFICIAL_CHAPTERS = {
  sainik: {
    6: {
      Mathematics: [
        'Natural Numbers', 'LCM and HCF', 'Fractions', 'Decimal Numbers', 'Ratio and Proportion', 'Percentage',
        'Profit and Loss', 'Simple Interest', 'Average', 'Unitary Method', 'Area and Perimeter', 'Volume of Cube and Cuboids',
        'Speed and Time', 'Lines and Angles', 'Types of Angles', 'Circle', 'Prime and Composite Numbers', 'Roman Numerals',
        'Simplification', 'Conversion of Units', 'Operation on Numbers', 'Temperature', 'Plane Figures', 'Arranging of Fractions',
        'Complementary and Supplementary Angles', 'Rounding Off Numbers', 'Measurement', 'Squares, Cubes and Roots',
        'Data Handling', 'Time and Work',
      ],
      Intelligence: [
        'Analogies', 'Classification', 'Pattern Completion', 'Series Completion', 'Coding Decoding', 'Mathematical Operations',
        'Venn Diagram', 'Paper Folding', 'Embedded Figure', 'Mirror Image', 'Figure Matching', 'Figure Series', 'Odd Man Out',
        'Geometrical Figure Completion', 'Space Visualisation', 'Order and Ranking', 'Blood Relations', 'Direction Test',
        'Sitting Arrangement', 'Word Formation', 'Dictionary Word Order', 'Clock and Calendar',
      ],
      Language: [
        'Comprehension Passage', 'Preposition', 'Article', 'Vocabulary', 'Verbs and Type', 'Confusing Words', 'Question Tags',
        'Types of Sentences', 'Tense Forms', 'Kinds of Nouns', 'Kinds of Pronouns', 'Correct Spelling',
        'Ordering of Words in Sentence', 'Sentence Formation', 'Antonyms', 'Synonyms', 'Adjectives', 'Interjection',
        'Idioms and Phrases', 'Collective Nouns', 'Number', 'Gender', 'Adverbs', 'Rhyming Words', 'Conjunction',
      ],
      'General Knowledge': [
        'Scientific Devices', 'Icons and Symbols of India', 'Major Religions of India', 'Art and Culture', 'Defence Awareness',
        'Sports and Games', 'Relationship Animals and Humans', 'Taste and Digestion', 'Cooking and Preserving',
        'Germination and Seed Dispersal', 'Traditional Water Harvesting', 'Water Pollution', 'Mountain Terrain',
        'Historical Monuments', 'Shape of Earth', 'Non-Renewable Energy', 'Food Culture and Habitat', 'Young Ones of Animals',
        'Functions of Body Parts', 'International Organizations', 'Indian Literary Awards', 'Natural Calamities',
        'Evaporation and Water Cycle', 'Life of Farmers', 'Tribal Communities',
      ],
    },
    9: {
      Mathematics: NCERT8_MATHS,
      Intelligence: [
        'Analogies', 'Classification', 'Pattern Completion', 'Series Completion', 'Coding Decoding', 'Mathematical Operations',
        'Blood Relations', 'Direction Test', 'Order and Ranking', 'Venn Diagram', 'Mirror Image', 'Paper Folding',
        'Embedded Figure', 'Logical Reasoning',
      ],
      English: ENGLISH_GRAMMAR_9,
      'General Science': NCERT8_SCIENCE,
      'Social Science': NCERT8_SOCIAL,
    },
  },
  navodaya: {
    6: {
      'Mental Ability': [
        'Pattern Completion', 'Figure Series Completion', 'Geometrical Figure Completion', 'Mirror Image', 'Water Image', 'Embedded Figures',
      ],
      'Environmental Studies (EVS)': [
        'Transportation', 'Rivers and Mountains', 'Plants and Animals — Land and Water', 'Natural Disasters',
        'Types of Houses and Shelters', 'Water Cycle', 'Food and Nutrients', 'Hygiene and Cleanliness', 'Super Senses of Animals',
        'Digestive System', 'Circulatory System', 'Respiratory System', 'Food Preservation Methods', 'Water and Air Pollution',
        'Conservation of Water and Soil', 'Environmental Protection', 'Superlatives of India', 'States and Capitals',
        'National Symbols of India', 'Landscapes of India', 'Festivals of India', 'Seasons', 'Forests', 'Crops and Agriculture',
        'Clothes and Fibres',
      ],
      Arithmetic: [
        'Number System — Place Value and Face Value', 'Ascending and Descending Order', 'Four Fundamental Operations',
        'Factors and Multiples', 'LCM and HCF', 'Prime Factorization', 'Fractions — Addition and Subtraction of Like Fractions',
        'Multiplication of Fractions', 'Measurement — Length, Mass, Capacity, Time, Money', 'Conversion of Units',
        'Simplification (BODMAS)', 'Perimeter of Polygon', 'Area of Square, Rectangle and Triangle', 'Types of Angles',
        'Directions and Basic Mapping', 'Data Handling — Bar Diagrams, Tables and Pictographs', 'Averages',
      ],
      'English Language': [
        'Reading Comprehension — Direct Questions', 'Synonyms in Context', 'Antonyms in Context', 'Inference from Passage', 'Cause and Effect in Passage',
      ],
      'Hindi Language': ['Gadhyansh Bodh', 'Paryayvachi Shabd', 'Vilom Shabd', 'Bhavarth aur Nishkarsh', 'Karan aur Prabhav'],
    },
    9: {
      English: ENGLISH_GRAMMAR_9,
      Hindi: HINDI_9,
      Mathematics: NCERT8_MATHS,
      Science: NCERT8_SCIENCE,
    },
  },
  rms: {
    6: {
      Mathematics: [
        'Natural Numbers', 'Whole Numbers', 'Place Value and Face Value', 'Playing with Numbers', 'Roman Numerals',
        'Decimals and Fractions', 'Unitary Method', 'Percentage', 'Profit and Loss', 'Simple Interest', 'Ratio and Proportion',
        'Arithmetic Mean', 'Time and Work', 'Temperature Measurement', 'Classification of Angles', 'Angles, Triangles and Circles',
        'Area and Volume', 'Volume of Cube and Cuboid', 'Area of Circle', 'Conversion of Units of Area and Volume', 'Geometry',
      ],
      Intelligence: [
        'Blood Relation', 'Analogy', 'Classification (Odd Man Out)', 'Series', 'Coding-Decoding', 'Inserting Numbers', 'Puzzle',
        'Decision Making', 'Non-Verbal Reasoning',
      ],
      'English Language': [
        'Antonyms', 'Synonyms', 'Prepositions', 'Articles', 'Comprehension Passages', 'Fill in the Blanks', 'Spelling Check',
        'Construction of Sentences', 'Affirmative and Interrogative Sentences', 'Vocabulary', 'Grammar — Verb, Adjective, Noun, Pronoun, Gender',
      ],
      'General Knowledge': [
        'History', 'Geography', 'Indian Polity', 'Sports', 'Awards', 'Science and Health', 'States of India', 'Our Defence Forces',
        'Classical Dances of India', 'Books and Authors', 'International Organizations', 'Environment and Pollution',
        'General Science', 'Countries, Capitals and Currencies', 'National Parks and Wildlife Sanctuaries in India',
        'Union Territories', 'Famous Rivers', 'Committee and Commission', 'Atomic Power Stations in India', 'Current Affairs',
      ],
    },
    9: {
      'English Language': [
        'Comprehension Passages', 'Composition', 'Framing Questions', 'Para Jumbled', 'Error Correction', 'Grammatical Structure',
        'Homonyms', 'One Word Substitution', 'Antonyms', 'Synonyms', 'Vocabulary',
      ],
      Hindi: HINDI_9,
      'Social Science': NCERT8_SOCIAL,
      Mathematics: [...NCERT8_MATHS, 'Square Root and Cube Root', 'Algebra', 'Triangles, Quadrilaterals and Polygons', 'Angle Sum Property'],
      Science: NCERT8_SCIENCE,
    },
  },
  foundation: {},
}

// ── Helpers ─────────────────────────────────────────────────────────────────
export const normName = s => String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase()

export const classesOf = course => Object.keys(OFFICIAL_CHAPTERS[course] || {}).map(Number).sort((a, b) => a - b)

// { subject: [chapters] } for one class, or merged across classes when cls is falsy.
export function officialSubjects(course, cls) {
  const byClass = OFFICIAL_CHAPTERS[course] || {}
  const pick = cls ? [byClass[cls] || {}] : Object.values(byClass)
  const out = {}
  pick.forEach(subjects => Object.entries(subjects).forEach(([subject, chapters]) => {
    const list = out[subject] || (out[subject] = [])
    const seen = new Set(list.map(normName))
    chapters.forEach(c => { if (!seen.has(normName(c))) { list.push(c); seen.add(normName(c)) } })
  }))
  return out
}

// Which admission classes list this chapter for this subject (e.g. [6], [9], [6, 9]).
export function classesForChapter(course, subject, chapter) {
  return classesOf(course).filter(cls => (OFFICIAL_CHAPTERS[course][cls][subject] || []).some(c => normName(c) === normName(chapter)))
}

// False for chapters kept only for existing data (not in any current list).
// Courses without an official list (Foundation) count everything as current.
export function isInCurrentSyllabus(course, subject, chapter) {
  if (!classesOf(course).length) return true
  return classesForChapter(course, subject, chapter).length > 0
}

// Merge official subjects/chapters into a { subject: [chapters] } taxonomy
// without renaming or removing anything. Returns a new object.
export function mergeOfficialInto(course, subjects) {
  const out = Object.fromEntries(Object.entries(subjects || {}).map(([s, list]) => [s, [...list]]))
  Object.entries(officialSubjects(course)).forEach(([subject, chapters]) => {
    const list = out[subject] || (out[subject] = [])
    const seen = new Set(list.map(normName))
    chapters.forEach(c => { if (!seen.has(normName(c))) { list.push(c); seen.add(normName(c)) } })
  })
  return out
}

// Totals for an exam pattern: { questions, marks, meritMarks }.
export function patternTotals(pattern) {
  const secs = pattern?.sections || []
  const marks = secs.reduce((t, s) => t + s.questions * s.marksEach, 0)
  return {
    questions: secs.reduce((t, s) => t + s.questions, 0),
    marks: Math.round(marks * 100) / 100,
    meritMarks: Math.round(secs.filter(s => !s.qualifyingOnly).reduce((t, s) => t + s.questions * s.marksEach, 0) * 100) / 100,
  }
}

// ── Daily Log topic → chapter matching (shared with the Chapter Hub) ─────────
// teaching_logs has no chapter column, so the chapter is matched from the
// free-text topic.
const STOP = new Set(['and', 'the', 'of', 'for', 'with', 'in', 'on', 'to', 'a', 'an', 'its', 'their', 'types', 'type'])
const words = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
export function topicMatchesChapter(topic, chapter) {
  const t = ` ${words(topic)} `, c = words(chapter)
  if (!c || !t.trim()) return false
  if (t.includes(` ${c} `)) return true
  const ws = c.split(' ').filter(w => w.length >= 3 && !STOP.has(w))   // keeps LCM / HCF / GK
  if (!ws.length) return false
  const hits = ws.filter(w => t.includes(` ${w}`)).length   // prefix match: "fraction" ~ "fractions"
  return hits === ws.length || (ws.length >= 3 && hits >= ws.length - 1)
}

// Daily Log subject names differ from exam subject names ("Mathematics I",
// "Reasoning", "English Grammar", "EVS"…). Group both into families.
const FAMILY = [
  ['maths', /math|arithmetic|numeracy/],
  ['reasoning', /intelligence|reasoning|mental ability|\bmat\b/],
  ['english', /english|language|grammar|vocabulary/],
  ['hindi', /hindi/],
  ['science', /science|physics|chemistry|biology|evs|environment/],
  ['social', /social|history|geography|civics|polity/],
  ['gk', /general knowledge|\bgk\b|current affairs/],
]
export function subjectFamily(name) {
  const n = String(name || '').toLowerCase()
  if (/social/.test(n)) return 'social'
  if (/general science/.test(n)) return 'science'
  return (FAMILY.find(([, re]) => re.test(n)) || [n])[0]
}
export const sameSubjectFamily = (a, b) => subjectFamily(a) === subjectFamily(b)

// Per-chapter coverage from Daily Logs: { [chapter]: { taught, last } }.
export function chapterCoverage(chapters, subject, logs = []) {
  const rel = logs.filter(l => sameSubjectFamily(l.subject_name, subject))
  const out = {}
  chapters.forEach(ch => {
    let taught = 0, last = null
    rel.forEach(l => { if (topicMatchesChapter(l.topic_taught, ch)) { taught++; if (!last || (l.teaching_date || '') > last) last = l.teaching_date } })
    out[ch] = { taught, last }
  })
  return out
}
