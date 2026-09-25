// qbankTaxonomy.js — GNSI Portal
// Single source of truth for the Question Bank's course → subject → chapter
// taxonomy — the names questions are actually SAVED under in
// qbank_questions.subject / .chapter / .course. Moved out of
// QuestionBank.jsx so QuestionBankViewer.jsx reads the exact same list
// instead of a hand-copied one that had already drifted (Sainik's
// "Language" vs the viewer's "English Language" + "Social Studies").

// ── SUBJECTS & CHAPTERS ──────────────────────────────────────────────────────
// ── COURSES → SUBJECTS & CHAPTERS ────────────────────────────────────────────
// Course-wise structure, same shape StudyMaterial.jsx already uses
// (course -> subject -> chapters). Sainik's subject/chapter list is
// unchanged from what QuestionBank.jsx has always used (Mathematics/
// Intelligence/Language/General Knowledge, same chapter names, same
// order) — existing questions with no course tag are effectively
// Sainik-shaped data even though nothing retroactively assigns them a
// course value here (see the migration note on COURSE_LIST below).
// Navodaya and Foundation subject/chapter lists mirror StudyMaterial.jsx's
// own definitions for consistency across modules. RMS is new — built from
// the RMS CET Class 6 + Class 9 syllabus (Rashtriya Military Schools
// Common Entrance Test): Mathematics, Intelligence (Reasoning), English
// Language, General Knowledge & Current Affairs, and Social Science
// (Class 9 Paper-I, based on NCERT Class 8 — RMS's own syllabus documents
// don't prescribe a detailed topic breakdown for this section beyond
// "NCERT Class 8", so this list is left as a single placeholder chapter
// admins can expand later once specific chapters are decided).
export const COURSES = {
  sainik: {
    label: 'Sainik School', short: 'AISSEE',
    subjects: {
      Mathematics: [
        'Natural Numbers','LCM and HCF','Fractions','Decimal Numbers',
        'Ratio and Proportion','Percentage','Profit and Loss','Simple Interest',
        'Average','Unitary Method','Area and Perimeter','Volume of Cube and Cuboids',
        'Speed and Time','Lines and Angles','Types of Angles','Circle',
        'Prime and Composite Numbers','Roman Numerals','Simplification',
        'Conversion of Units','Operation on Numbers','Temperature',
        'Plane Figures','Arranging of Fractions','Complementary and Supplementary Angles',
        'Rounding Off Numbers','Measurement','Squares, Cubes and Roots','Data Handling','Time and Work',
      ],
      Intelligence: [
        'Analogies','Venn Diagram','Paper Folding','Embedded Figure',
        'Geometrical Figure Completion','Space Visualisation','Order and Ranking',
        'Coding Decoding','Mathematical Operations','Blood Relations',
        'Sitting Arrangement','Mirror Image','Figure Matching','Figure Series',
        'Odd Man Out','Pattern Completion','Classification','Word Formation',
        'Dictionary Word Order','Series Completion','Direction Test','Clock and Calendar',
      ],
      Language: [
        'Comprehension Passage','Preposition','Article','Vocabulary',
        'Verbs and Type','Confusing Words','Question Tags','Types of Sentences',
        'Tense Forms','Kinds of Nouns','Kinds of Pronouns','Correct Spelling',
        'Ordering of Words in Sentence','Sentence Formation','Antonyms','Synonyms',
        'Adjectives','Interjection','Idioms and Phrases','Collective Nouns',
        'Number','Gender','Adverbs','Rhyming Words','Conjunction',
      ],
      'General Knowledge': [
        'Scientific Devices','Icons and Symbols of India','Major Religions of India',
        'Art and Culture','Defence Awareness','Sports and Games',
        'Relationship Animals and Humans','Taste and Digestion',
        'Cooking and Preserving','Germination and Seed Dispersal',
        'Traditional Water Harvesting','Water Pollution','Mountain Terrain',
        'Historical Monuments','Shape of Earth','Non-Renewable Energy',
        'Food Culture and Habitat','Young Ones of Animals','Functions of Body Parts',
        'International Organizations','Indian Literary Awards','Natural Calamities',
        'Evaporation and Water Cycle','Life of Farmers','Tribal Communities',
      ],
    },
  },
  navodaya: {
    label: 'Navodaya Vidyalaya', short: 'JNVST',
    // Updated to the JNVST 2027 Final Prospectus pattern (NVS). Section 1
    // is now Mental Ability Test (20Q) + Environmental Studies (20Q, new —
    // EVS was not part of the exam in earlier years). Section 2 Arithmetic
    // and Section 3 Language remain, but Language is comprehension-only in
    // the current pattern (4 passages x 5 questions each) — no standalone
    // grammar/vocabulary items outside passage context, so the old
    // grammar-heavy topic list has been replaced. Hindi Language kept as a
    // separate chapter list since the Language Test is offered in the
    // candidate's chosen medium (English/Hindi/regional) and Hindi-medium
    // question entry still benefits from its own grammar topic set.
    subjects: {
      'Mental Ability': [
        'Pattern Completion','Figure Series Completion','Geometrical Figure Completion',
        'Mirror Image','Water Image','Embedded Figures',
      ],
      'Environmental Studies (EVS)': [
        'Transportation','Rivers and Mountains','Plants and Animals — Land and Water',
        'Natural Disasters','Types of Houses and Shelters','Water Cycle',
        'Food and Nutrients','Hygiene and Cleanliness','Super Senses of Animals',
        'Digestive System','Circulatory System','Respiratory System',
        'Food Preservation Methods','Water and Air Pollution','Conservation of Water and Soil',
        'Environmental Protection','Superlatives of India','States and Capitals',
        'National Symbols of India','Landscapes of India','Festivals of India',
        'Seasons','Forests','Crops and Agriculture','Clothes and Fibres',
      ],
      Arithmetic: [
        'Number System — Place Value and Face Value','Ascending and Descending Order',
        'Four Fundamental Operations','Factors and Multiples','LCM and HCF','Prime Factorization',
        'Fractions — Addition and Subtraction of Like Fractions','Multiplication of Fractions',
        'Measurement — Length, Mass, Capacity, Time, Money','Conversion of Units','Simplification (BODMAS)',
        'Perimeter of Polygon','Area of Square, Rectangle and Triangle','Types of Angles',
        'Directions and Basic Mapping','Data Handling — Bar Diagrams, Tables and Pictographs','Averages',
      ],
      'English Language': [
        'Reading Comprehension — Direct Questions','Synonyms in Context','Antonyms in Context',
        'Inference from Passage','Cause and Effect in Passage',
      ],
      'Hindi Language': [
        'Gadhyansh Bodh','Paryayvachi Shabd','Vilom Shabd','Bhavarth aur Nishkarsh','Karan aur Prabhav',
      ],
    },
  },
  foundation: {
    label: 'Foundation Course', short: 'Class 5–8',
    subjects: {
      Mathematics: [
        'Number Systems','Factors and Multiples','Fractions and Decimals','Integers',
        'Algebra — Expressions and Equations','Ratio and Proportion','Percentage and Its Applications',
        'Profit, Loss and Discount','Simple and Compound Interest','Lines, Angles and Triangles',
        'Quadrilaterals and Polygons','Area and Perimeter','Surface Area and Volume',
        'Statistics and Data Handling','Exponents and Powers','Symmetry and Transformations',
        'Coordinate Geometry Basics','Mensuration','Speed, Time, Distance','Probability Basics',
      ],
      Science: [
        'Food and Nutrition','Materials and Their Properties','The Living World — Plants',
        'The Living World — Animals','Force, Motion and Energy','Light and Sound',
        'Heat and Temperature','Electricity and Magnetism','Acids, Bases and Salts',
        'Chemical Reactions Basics','Cell — The Unit of Life','Reproduction in Plants and Animals',
        'Human Body Systems','Soil and Water','Air and Atmosphere','Environment and Ecology',
        'Natural Resources','Disaster Management',
      ],
      English: [
        'Parts of Speech','Tenses','Voice — Active and Passive','Narration — Direct and Indirect',
        'Articles and Prepositions','Subject-Verb Agreement','Comprehension Passages','Letter Writing',
        'Essay Writing','Vocabulary Development','Synonyms, Antonyms and Homophones','Idioms and Phrases',
        'One-word Substitution','Punctuation','Sentence Transformation',
      ],
      'Social Science': [
        'Ancient Civilisations','Medieval India','Mughal Empire','British Rule and Freedom Struggle',
        'Post-Independence India','Physical Features of India','Climate of India',
        'Natural Vegetation and Wildlife','Population and Urbanisation','Resources — Land, Water, Minerals',
        'Agriculture and Industries','Indian Constitution','Panchayati Raj','Democracy and Elections',
        'Economic Concepts','Globalisation',
      ],
      Hindi: [
        'Gadhya Bodh','Padhya Bodh','Vyakaran — Sangya, Sarvanam','Visheshan and Kriya','Kal aur Vachya',
        'Sandhi aur Samas','Muhavare aur Lokokti','Patra Lekhan','Nibandh Lekhan','Anuchhed Lekhan',
      ],
    },
  },
  rms: {
    label: 'Rashtriya Military School', short: 'RMS CET',
    // Sourced from RMS CET Class 6 + Class 9 (Paper-I) syllabus — see
    // careerdefenceschool.com's official-style syllabus PDF, cross-checked
    // against multiple RMS CET prep sites (shauryabharat.com,
    // school.careers360.com, navodayasyllabus.com). Class 6 syllabus is
    // based on CBSE Class 5; Class 9 Paper-I on CBSE Class 8. Combined
    // into one course-wide chapter list per subject, same pattern the
    // other three courses use rather than splitting by admission class.
    subjects: {
      Mathematics: [
        'Whole Numbers','Natural Numbers','Playing with Numbers','Square Root and Cube Root',
        'Unitary Method','Percentage','Time and Work','Profit and Loss','Simple Interest',
        'Arithmetic Mean','Decimals and Fractions','Ratio and Proportion','Roman Numerals',
        'Algebra','Place Value and Face Value','Temperature Measurement','Area and Volume',
        'Volume of Cube and Cuboid','Area of Circle','Classification of Angles',
        'Angles, Triangles and Circles','Triangles, Quadrilaterals and Polygons',
        'Conversion of Units of Area and Volume','Angle Sum Property',
        'Distance and Displacement', 'Geometry',
      ],
      Intelligence: [
        'Blood Relation','Analogy','Classification (Odd Man Out)','Series','Coding-Decoding',
        'Inserting Numbers','Puzzle','Decision Making','Non-Verbal Reasoning',
      ],
      'English Language': [
        'Antonyms','Synonyms','Prepositions','Composition','Framing Questions','Articles',
        'Comprehension Passages','Affirmative and Interrogative Sentences','Fill in the Blanks',
        'Spelling Check','Para Jumbled','Construction of Sentences','Error Correction',
        'Grammatical Structure','Vocabulary','Homonyms','One Word Substitution',
        'Grammar — Verb, Adjective, Noun, Pronoun, Gender',
      ],
      'General Knowledge': [
        'History','Geography','Indian Polity','Sports','Awards','Science and Health',
        'Committee and Commission','States of India','Our Defence Forces',
        'Atomic Power Stations in India','Classical Dances of India','Books and Authors',
        'International Organizations','Environment and Pollution','General Science',
        'Countries, Capitals and Currencies','National Parks and Wildlife Sanctuaries in India',
        'Union Territories','Famous Rivers',
      ],
      'Social Science': [
        // RMS's own syllabus documents point to "NCERT Class 8 Social
        // Science" without a further topic breakdown — placeholder
        // chapter so this subject exists in the picker; expand once
        // specific chapters are decided.
        'General (NCERT Class 8 basis)',
      ],
    },
  },
}
export const COURSE_LIST = Object.keys(COURSES)
