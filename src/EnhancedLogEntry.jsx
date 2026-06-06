// EnhancedLogEntry.jsx — ALL FIELDS MANDATORY VERSION
// ─────────────────────────────────────────────────────────────────────────────
// FIX CHANGELOG (13 issues):
//  1. canNext() Step 4 focus_student_ids guard: condition was inverted (=== 0 → > 0)
//  2. isDuplicate() now skips check when class_name is empty string (manual input not typed yet)
//  3. handleSave: early-return on logError before similarity/PQ blocks; logId null-guarded
//  4. GPS check de-duplicated: runs only once per Step-0 advance via gpsCheckedRef
//  5. checkAttendance: strips A/B suffix from subtype before querying attendance_sessions
//  6. doubt_sessions: teacher's explicit HM selection takes priority over DOUBT_SESSION_MAP
//  7. hm_notifications insert gated behind dsError === null (no orphaned notifications)
//  8. practice_questions insert now has error handling with toast
//  9. Draft restore: stale period lock detected on mount and warned to user
// 10. discardDraft: resets gpsStatus, attWarn, dupWarn, gpsDistance alongside form
// 11. SpotCheckModal: suppressed when log is already copy_paste flagged
// 12. HMDoubtSessionPanel: window.confirm/prompt replaced with inline UI modals
// 13. HMDoubtSessionPanel: print hide delay replaced with afterprint event listener
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { supabase } from './supabase'

// ─── Constants ────────────────────────────────────────────────────────────────

const SUBJECTS = [
  'Mathematics','Mathematics I','Mathematics II','English Grammar',
  'General Knowledge','General Science','Reasoning','Mental Ability',
  'Hindi','Vocabulary','Meitei Mayek',
]

const TEACHING_TECHNIQUES = [
  'Lecture / Direct Teaching','Socratic Questioning','Think-Pair-Share',
  'Problem-Solving on Board','Visual / Diagram Method','Group Discussion',
  'Quiz / Rapid Fire','Story / Analogy Method','Practice Drill',
  'Revision / Mind Map','Activity Based Learning','Audio-Visual / Video',
]

const SPOT_CHECK_QUESTIONS = [
  'Name one student who struggled today and explain why.',
  'What was the most common mistake students made during this class?',
  'Which question did students find hardest and how did you handle it?',
  'How did you ensure weaker students understood the topic?',
  'What would you do differently next time you teach this topic?',
  'Describe one moment where a student surprised you — positively or negatively.',
  'Which student was most engaged today and what did they do?',
  'What part of the lesson took longer than expected and why?',
  'How did you handle a student who was distracted or disruptive?',
  'What evidence do you have that students understood the concept?',
]

const DIFFICULTY = ['Easy','Medium','Hard']

const SUGGESTIONS = {
  topic_taught: [
    'Introduced the concept of {subtopic} with examples from daily life. Explained key definitions and properties. Worked through 3 solved examples on the board.',
    'Revised previous lesson on {chapter} and connected it to {subtopic}. Students solved 5 problems independently. Checked all work.',
    'Taught {subtopic} using visual diagrams on the board. Demonstrated step-by-step method. Students practiced Q.1–Q.10.',
    'Covered {subtopic} through group activity. Each group presented their approach. Common mistakes were corrected collectively.',
    'Explained {subtopic} theory with real-life examples. Did rapid-fire oral questions. Assigned practice problems.',
  ],
  classwork: [
    'Students solved Q.1 to Q.10 from the textbook independently. Checked all answers. Corrected 3 common errors on board. Weaker students were given simpler variations first.',
    'Completed 5 board exercises together as a class. Students were called one by one to solve on board. Mistakes corrected immediately with explanation.',
    'Group work: 4 groups solved different sets of problems. Each group explained their method. Class discussed common errors and best approach.',
    'Solved examples from textbook Pages {range_from}–{range_to}. Students copied and completed all worked examples. Quick quiz of 5 questions at the end.',
    'Practice drill: 10 rapid questions solved orally. 5 written questions in notebook. Checked notebooks at end of class.',
  ],
  homework: [
    'Complete Q.11 to Q.20 from textbook. Show all working steps. Bring completed work tomorrow for checking.',
    'Solve the 5 problems from worksheet distributed today. Attempt all parts. If stuck, mark the question and bring it to class.',
    "Write a summary of today's topic in their own words (minimum 5 sentences). Solve 3 examples from the chapter exercise.",
    'Complete the remaining questions from class exercise. Revise today\'s lesson and be prepared for a short quiz tomorrow.',
    'Practice Q.{range_from} to Q.{range_to} from textbook. Also revise definitions covered today.',
  ],
  remarks: [
    'Most students understood the concept well. 3–4 students needed extra explanation. Class was attentive and responsive. Pace was appropriate for the batch.',
    'Students were initially confused about the main concept but cleared after worked examples. Doubt session needed for weaker students.',
    'Class was very engaged today. Students asked good questions. Completed more than planned. Ready to move to next subtopic.',
    'A few students were distracted. Pace was slower than usual. Will need to revise this topic in the next class before moving forward.',
    'Good participation from most students. Weak students identified — need individual attention. Strong students helped explain to peers.',
  ],
  technique_detail: [
    'Started with a 5-minute revision of previous class. Drew the main diagram on board step by step. Explained each step verbally. Asked students to copy and label. Did 3 solved examples together. Called 4 students to board to solve independently. Corrected mistakes in front of class. Ended with rapid-fire oral questions.',
    'Used the Socratic method — asked leading questions instead of explaining directly. Students discovered the rule/concept themselves. Then formalized it on board. Practiced with 5 examples. Weaker students were guided with hints rather than direct answers.',
    'Explained theory with a real-life analogy first. Then moved to formal definition. Drew visual representation on board. Students worked in pairs on practice problems. Pairs compared answers with each other before class discussion.',
    'Started with a common mistake students make on this topic. Showed why it is wrong. Then taught the correct method step by step. Students practiced 8 problems. I circulated and checked notebooks while they worked.',
    'Used practice drill method. Rapid 10 questions orally — students answered in turn. Then 5 written questions with time limit. Discussed answers together. Identified and corrected 3 systematic errors.',
  ],
  key_concepts: [
    'Always draw the diagram/table before attempting the calculation. Common mistake: students skip this step and get confused. Focus on Q.5 and Q.8 where most errors occurred. Emphasise the sign rule.',
    'The main concept to stress is {subtopic}. Make sure students can state the definition in their own words before solving. Do NOT allow them to memorise without understanding.',
    'Students tend to confuse the two methods — make them choose the right one based on the question type. Drill this distinction. Weaker students need more practice on basic steps before advanced problems.',
    'Key formula/rule to emphasise. Students must show all steps — no skipping. Check that they understand WHY each step is done, not just HOW.',
    'Focus on the word problems — students struggle to convert language to mathematical form. Practice this conversion step specifically. Use the examples from today\'s class.',
  ],
  technique_avoid: [
    'Do NOT give answers directly. Make students attempt each problem first, even if they are wrong. Hints are okay but full solutions should come after their attempt.',
    'Do NOT skip the diagram/drawing step. This is where most students go wrong. Insist on drawing before calculating every time.',
    'Do NOT rush through the basics. Even if students seem to know it, confirm understanding with oral questions before moving on.',
    'Do NOT allow students to just copy from board without understanding. Ask them to close notebooks and attempt the next step from memory.',
    'Do NOT let stronger students answer all questions. Specifically call on weaker students and give them time to think before jumping to the answer.',
  ],
}

// ─── Doubt Session Map (Batch + Subject → HM + Time Slot) ─────────────────────

const DOUBT_SESSION_MAP = [
  // 6:20–7:20 AM
  { batch:'Achiever A',  subject:'General Knowledge', hm:'Sir Bidyachandra', slot:'6:20–7:20 AM' },
  { batch:'Achiever B',  subject:'General Knowledge', hm:'Sir Shrinivash',   slot:'6:20–7:20 AM' },
  { batch:'Leader',      subject:'General Knowledge', hm:'Sir Romesh',       slot:'6:20–7:20 AM' },
  { batch:'Champion',    subject:'General Knowledge', hm:'Miss Geetanjali',  slot:'6:20–7:20 AM' },
  { batch:'Lakshya A',   subject:'General Knowledge', hm:'Miss Deviya',      slot:'6:20–7:20 AM' },
  { batch:'Lakshya B',   subject:'Grammar',           hm:'Sir Adison',       slot:'6:20–7:20 AM' },
  { batch:'Umeed A',     subject:'Grammar',           hm:'Miss Fedrava',     slot:'6:20–7:20 AM' },
  { batch:'Umeed B',     subject:'General Knowledge', hm:'Miss Bindyarani',  slot:'6:20–7:20 AM' },
  { batch:'Elite',       subject:'General Science',   hm:'Sir Mahesh',       slot:'6:20–7:20 AM' },
  { batch:'Prime',       subject:'Reasoning',         hm:'Sir Umesh',        slot:'6:20–7:20 AM' },
  // 7:20–8:10 AM
  { batch:'Achiever A',  subject:'Mathematics',       hm:'Sir Himan',        slot:'7:20–8:10 AM' },
  { batch:'Achiever B',  subject:'Reasoning',         hm:'Sir James',        slot:'7:20–8:10 AM' },
  { batch:'Leader A',    subject:'Reasoning',         hm:'Sir Bidyachandra', slot:'7:20–8:10 AM' },
  { batch:'Leader B',    subject:'Reasoning',         hm:'Miss Geetanjali',  slot:'7:20–8:10 AM' },
  { batch:'Champion A',  subject:'Reasoning',         hm:'Sir Shrinivash',   slot:'7:20–8:10 AM' },
  { batch:'Champion B',  subject:'Grammar',           hm:'Sir Adison',       slot:'7:20–8:10 AM' },
  { batch:'Lakshya A',   subject:'General Knowledge', hm:'Miss Deviya',      slot:'7:20–8:10 AM' },
  { batch:'Lakshya B',   subject:'General Knowledge', hm:'Miss Bidyarani',   slot:'7:20–8:10 AM' },
  { batch:'Umeed A',     subject:'Grammar',           hm:'Miss Fedrava',     slot:'7:20–8:10 AM' },
  { batch:'Umeed B',     subject:'Mathematics',       hm:'Sir Romesh',       slot:'7:20–8:10 AM' },
  { batch:'Elite',       subject:'General Science',   hm:'Sir Mahesh',       slot:'7:20–8:10 AM' },
  // 5:30–6:30 PM
  { batch:'Achiever A',  subject:'Grammar',           hm:'Miss Fedrava',     slot:'5:30–6:30 PM' },
  { batch:'Achiever B',  subject:'Grammar',           hm:'Sir Bidyachandra', slot:'5:30–6:30 PM' },
  { batch:'Leader',      subject:'Mathematics',       hm:'Sir Himan',        slot:'5:30–6:30 PM' },
  { batch:'Champion',    subject:'Mathematics',       hm:'Sir Umesh',        slot:'5:30–6:30 PM' },
  { batch:'Lakshya',     subject:'Mathematics',       hm:'Miss Deviya',      slot:'5:30–6:30 PM' },
  { batch:'Umeed',       subject:'Mathematics',       hm:'Sir Bronson',      slot:'5:30–6:30 PM' },
  { batch:'Elite',       subject:'Mathematics',       hm:'Miss Geetanjali',  slot:'5:30–6:30 PM' },
  { batch:'Prime',       subject:'Reasoning',         hm:'Sir James',        slot:'5:30–6:30 PM' },
  { batch:'Prime',       subject:'Mathematics',       hm:'Sir Mahesh',       slot:'5:30–6:30 PM' },
  // 6:35–7:35 PM
  { batch:'Achiever A',  subject:'Mathematics',       hm:'Sir Romesh',       slot:'6:35–7:35 PM' },
  { batch:'Achiever B',  subject:'Mathematics',       hm:'Miss Deviya',      slot:'6:35–7:35 PM' },
  { batch:'Leader',      subject:'Grammar',           hm:'Sir Adison',       slot:'6:35–7:35 PM' },
  { batch:'Champion',    subject:'Grammar',           hm:'Miss Fedrava',     slot:'6:35–7:35 PM' },
  { batch:'Lakshya',     subject:'Mathematics',       hm:'Miss Geetanjali',  slot:'6:35–7:35 PM' },
  { batch:'Umeed',       subject:'Mathematics',       hm:'Sir Bidyachandra', slot:'6:35–7:35 PM' },
  { batch:'Elite',       subject:'Mathematics',       hm:'Sir Mahesh',       slot:'6:35–7:35 PM' },
  { batch:'Elite',       subject:'Vocabulary',        hm:'Sir Arjun',        slot:'6:35–7:35 PM' },
  { batch:'Prime',       subject:'Hindi',             hm:'Sir Boy',          slot:'6:35–7:35 PM' },
  // 7:40–8:30 PM
  { batch:'Achiever A',  subject:'Reasoning',         hm:'Sir Umesh',        slot:'7:40–8:30 PM' },
  { batch:'Achiever B',  subject:'Reasoning',         hm:'Sir James',        slot:'7:40–8:30 PM' },
  { batch:'Leader',      subject:'General Science',   hm:'Sir Arunkumar',    slot:'7:40–8:30 PM' },
  { batch:'Champion',    subject:'General Knowledge', hm:'Miss Bidyarani',   slot:'7:40–8:30 PM' },
  { batch:'Lakshya',     subject:'Mental Ability',    hm:'Sir Shrinivash',   slot:'7:40–8:30 PM' },
  { batch:'Umeed',       subject:'Mental Ability',    hm:'Sir Romesh',       slot:'7:40–8:30 PM' },
  { batch:'Elite',       subject:'Mathematics',       hm:'Sir Mahesh',       slot:'7:40–8:30 PM' },
  { batch:'Prime',       subject:'Vocabulary',        hm:'Sir Adison',       slot:'7:40–8:30 PM' },
]

const DOUBT_TIME_SLOTS = [
  '6:20–7:20 AM',
  '7:20–8:10 AM',
  '5:30–6:30 PM',
  '6:35–7:35 PM',
  '7:40–8:30 PM',
  '9:30–10:15 PM (Dormitory Practice)',
]

const PERIODS = [1,2,3,4,5,6,7,8,9,10]

const PERIOD_TIMES = {
  1:  { label:'Period 1 (7:20–8:10 AM)',   start:[7,20],  end:[8,10]  },
  2:  { label:'Period 2 (10:20–11:10 AM)', start:[10,20], end:[11,10] },
  3:  { label:'Period 3 (11:10 AM–12:00)', start:[11,10], end:[12,0]  },
  4:  { label:'Period 4 (12:00–12:50 PM)', start:[12,0],  end:[12,50] },
  5:  { label:'Period 5 (1:20–2:10 PM)',   start:[13,20], end:[14,10] },
  6:  { label:'Period 6 (2:10–2:55 PM)',   start:[14,10], end:[14,55] },
  7:  { label:'Period 7 (2:55–3:40 PM)',   start:[14,55], end:[15,40] },
  8:  { label:'Period 8 (5:30–6:30 PM)',   start:[17,30], end:[18,30] },
  9:  { label:'Period 9 (6:35–7:35 PM)',   start:[18,35], end:[19,35] },
  10: { label:'Period 10 (7:40–8:30 PM)',  start:[19,40], end:[20,30] },
}

const SCHOOL_LAT = 24.62181
const SCHOOL_LNG = 94.0193087
const SCHOOL_RADIUS_M = 150

const getDistanceMeters = (lat1, lng1, lat2, lng2) => {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

const LEGACY_EVENING_TEACHERS = [
  'Sir Himan','Sir Arunkumar','Sir Bronson','Sir Basanta',
]
const LEGACY_DAYTIME_ONLY_TEACHERS = [
  'Sir Sumanta','Sir Deepak','Sir Pawan','Sir Lenin','Sir Roshan',
  'Sir Johny','Sir Bidyachandra','Sir Chetan','Sir Arjun',
  'Madam Sandhya','Sir Sunder','Miss Fedrava',
]

const getScheduleType = (teacherName, staffList) => {
  const staffRecord = staffList?.find(s => s.name === teacherName)
  if (staffRecord?.schedule_type) return staffRecord.schedule_type
  if (LEGACY_EVENING_TEACHERS.includes(teacherName)) return 'evening'
  if (LEGACY_DAYTIME_ONLY_TEACHERS.includes(teacherName)) return 'daytime'
  return 'both'
}

const isPeriodUnlocked = (periodNo, teacherName, staffList = []) => {
  const pt = PERIOD_TIMES[periodNo]
  if (!pt) return true
  const now = new Date()
  const nowMins = now.getHours() * 60 + now.getMinutes()
  const startMins = pt.start[0] * 60 + pt.start[1]
  const scheduleType = getScheduleType(teacherName, staffList)
  if (periodNo >= 8 && scheduleType === 'daytime') return false
  if (scheduleType === 'daytime') {
    const lockMins = 15 * 60 + 30
    if (startMins >= lockMins) return false
    return nowMins >= startMins - 5
  }
  return nowMins >= startMins - 5
}

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '-'
const pct = (s, m) => m > 0 ? Math.round((s/m)*100) : 0

const wc = str => str?.trim().split(/\s+/).filter(Boolean).length || 0
const WC_MIN = { topic_taught:0, classwork:0, homework:0, remarks:0, technique_detail:0, key_concepts:0, technique_avoid:0 }
const wcOk = (field, val) => wc(val) >= WC_MIN[field]
const wcMsg = (field, val) => { const w=wc(val); const m=WC_MIN[field]; return w>=m ? null : `${w}/${m} words` }

const getWordSet = str => new Set((str||'').toLowerCase().trim().split(/\s+/).filter(w => w.length > 3))
const jaccardSimilarity = (a, b) => {
  const setA = getWordSet(a), setB = getWordSet(b)
  if (!setA.size || !setB.size) return 0
  const intersection = [...setA].filter(w => setB.has(w)).length
  const union = new Set([...setA, ...setB]).size
  return intersection / union
}

const getSimilarityScore = (newLog, prevLogs) => {
  if (!prevLogs?.length) return 0
  const fields = ['topic_taught', 'classwork', 'remarks']
  const scores = prevLogs.map(old => {
    const s = fields.map(f => jaccardSimilarity(newLog[f], old[f]))
    return s.reduce((a,b) => a+b, 0) / s.length
  })
  return Math.max(...scores)
}

const isExcellentLog = (log) => {
  const topicWc  = wc(log.topic_taught)
  const cwWc     = wc(log.classwork)
  const hwWc     = wc(log.homework)
  const remWc    = wc(log.remarks)
  const techWc   = wc(log.technique_detail)
  const keyWc    = wc(log.key_concepts)
  const hasDoubt = log.needs_doubt_session
  const hasPqs   = (log.practice_questions?.length || 0) > 0
  const score =
    (topicWc >= 30 ? 2 : topicWc >= 15 ? 1 : 0) +
    (cwWc    >= 40 ? 2 : cwWc    >= 20 ? 1 : 0) +
    (hwWc    >= 20 ? 1 : 0) +
    (remWc   >= 30 ? 2 : remWc   >= 20 ? 1 : 0) +
    (techWc  >= 80 ? 2 : techWc  >= 40 ? 1 : 0) +
    (keyWc   >= 30 ? 1 : 0) +
    (hasDoubt ? 1 : 0) +
    (hasPqs   ? 1 : 0)
  return score >= 8
}

const C = { navy:'#1e3a5f', green:'#16a34a', amber:'#d97706', purple:'#7c3aed', red:'#dc2626', sky:'#0891b2' }

const S = {
  card: { background:'white', borderRadius:14, boxShadow:'0 2px 12px rgba(0,0,0,.08)', padding:22, marginBottom:16 },
  input: { width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #d1d5db', fontSize:14, boxSizing:'border-box', background:'white', minHeight:44 },
  select: { width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #d1d5db', fontSize:14, boxSizing:'border-box', background:'white', minHeight:44 },
  label: { display:'block', fontSize:11, fontWeight:700, color:'#374151', marginBottom:5, textTransform:'uppercase', letterSpacing:'.06em' },
  required: { color: '#dc2626', marginLeft: 2 },
  btn: (color=C.navy, disabled=false) => ({ backgroundColor:disabled?'#94a3b8':color, color:'white', border:'none', borderRadius:8, padding:'10px 18px', fontWeight:700, cursor:disabled?'not-allowed':'pointer', fontSize:13, minHeight:44 }),
  btnSm: (color=C.navy) => ({ backgroundColor:color, color:'white', border:'none', borderRadius:6, padding:'6px 12px', fontWeight:600, cursor:'pointer', fontSize:12, minHeight:36 }),
  badge: (c, bg) => ({ padding:'3px 9px', borderRadius:999, fontSize:11, fontWeight:700, background:bg, color:c, display:'inline-block' }),
  pill: (c, bg) => ({ padding:'4px 10px', borderRadius:999, fontSize:12, fontWeight:600, background:bg, color:c, display:'inline-flex', alignItems:'center', gap:4, cursor:'pointer', border:'none' }),
  tag: (active) => ({ padding:'7px 13px', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', border:'none', background: active?C.navy:'#f1f5f9', color: active?'white':'#374151' }),
  stepDot: (active, done) => ({ width:32, height:32, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, background: done?C.green:active?C.navy:'#e2e8f0', color: done||active?'white':'#94a3b8' }),
  stepLine: (done) => ({ flex:1, height:2, background:done?C.green:'#e2e8f0', marginTop:15 }),
}

// ─── FIX 4 helper: draft-stale period check ──────────────────────────────────
// FIX 9: on restore, warn if the period in the draft is now locked
const isDraftPeriodStale = (form, staff) => {
  if (!form.period_number || !form.teacher_name) return false
  return !isPeriodUnlocked(Number(form.period_number), form.teacher_name, staff || [])
}

// ─── Draft persistence helpers ────────────────────────────────────────────────
const DRAFT_KEY = 'gnsi_teaching_log_draft'
const saveDraft = (form) => {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(form)) } catch(e) {}
}
const loadDraft = () => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch(e) { return null }
}
const clearDraft = () => {
  try { localStorage.removeItem(DRAFT_KEY) } catch(e) {}
}

// ─── Suggestion Picker ────────────────────────────────────────────────────────

function SuggestionPicker({ field, value, onChange, form }) {
  const [open, setOpen] = useState(false)
  const suggestions = SUGGESTIONS[field] || []

  const fillSuggestion = (s) => {
    const filled = s
      .replace(/{subtopic}/g, (form?.subtopic === '__other__' ? form?.subtopic_custom : form?.subtopic) || 'this subtopic')
      .replace(/{chapter}/g, (form?.chapter === '__other__' ? form?.chapter_custom : form?.chapter) || 'this chapter')
      .replace(/{range_from}/g, form?.range_from || '1')
      .replace(/{range_to}/g, form?.range_to || '10')
    onChange(filled)
    setOpen(false)
  }

  return (
    <div style={{ position:'relative', display:'inline-block', marginLeft:8 }}>
      <button type="button" onClick={() => setOpen(!open)}
        style={{ fontSize:10, padding:'2px 8px', borderRadius:4, border:'1px solid #d1d5db', background: open?'#1e3a5f':'#f8fafc', color: open?'white':'#64748b', cursor:'pointer', fontWeight:600 }}>
        💡 Suggestions {open ? '▲' : '▼'}
      </button>
      {open && (
        <div style={{ position:'absolute', top:'100%', left:0, zIndex:9999, background:'white', border:'1px solid #e2e8f0', borderRadius:10, boxShadow:'0 8px 24px rgba(0,0,0,.12)', width:420, maxWidth:'90vw', marginTop:4 }}>
          <div style={{ padding:'8px 12px', borderBottom:'1px solid #f1f5f9', fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase' }}>Click to use template</div>
          {suggestions.map((s, i) => (
            <div key={i} onClick={() => fillSuggestion(s)}
              style={{ padding:'10px 12px', fontSize:12, color:'#374151', cursor:'pointer', borderBottom:'1px solid #f8fafc', lineHeight:1.6 }}
              onMouseEnter={e => e.currentTarget.style.background='#f0f9ff'}
              onMouseLeave={e => e.currentTarget.style.background='white'}>
              {s.slice(0, 100)}...
            </div>
          ))}
          <div style={{ padding:'8px 12px', borderTop:'1px solid #f1f5f9' }}>
            <button type="button" onClick={() => setOpen(false)} style={{ fontSize:11, color:'#94a3b8', background:'none', border:'none', cursor:'pointer' }}>✕ Close</button>
          </div>
        </div>
      )}
    </div>
  )
}

function WCBadge({ field, value }) {
  const msg = wcMsg(field, value)
  const ok = !msg
  return (
    <span style={{ fontSize:11, fontWeight:600, color: ok ? '#16a34a' : '#dc2626', marginLeft:8 }}>
      {ok ? '✓' : `⚠️ ${msg}`}
    </span>
  )
}

const css = `@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap');
@keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
@keyframes slideUp{ from{transform:translateY(16px);opacity:0} to{transform:translateY(0);opacity:1} }
.elog-fade { animation:fadeIn .25s ease both }
@media (max-width:640px) { .form-grid { grid-template-columns:1fr !important } }`

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ msg, color=C.navy, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t) }, [])
  return (
    <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', zIndex:999999, background:'white', border:`1px solid ${color}`, borderLeft:`4px solid ${color}`, borderRadius:10, padding:'12px 20px', fontSize:13, fontWeight:600, boxShadow:'0 8px 32px rgba(0,0,0,.18)', maxWidth:'92vw', color:'#1e293b', display:'flex', alignItems:'center', gap:10, animation:'slideUp .2s ease' }}>
      <span style={{ width:7, height:7, borderRadius:'50%', background:color, flexShrink:0 }}/>{msg}
    </div>
  )
}

function useToast() {
  const [t, setT] = useState(null)
  const show = useCallback((msg, color=C.navy) => setT({ msg, color, k:Date.now() }), [])
  const el = t ? <Toast key={t.k} msg={t.msg} color={t.color} onDone={() => setT(null)}/> : null
  return { show, el }
}

// ─── ConfirmModal ─────────────────────────────────────────────────────────────

function ConfirmModal({ title, msg, confirmLabel='Confirm', onConfirm, onCancel }) {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:99999, background:'rgba(0,0,0,.55)', display:'flex', alignItems:'center', justifyContent:'center' }} onClick={onCancel}>
      <div style={{ background:'white', borderRadius:14, padding:28, width:380, maxWidth:'94vw' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize:16, fontWeight:800, color:'#1e293b', marginBottom:8 }}>{title}</div>
        <p style={{ fontSize:13, color:'#64748b', marginBottom:24, lineHeight:1.7 }}>{msg}</p>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onConfirm} style={S.btn(C.navy)}>{confirmLabel}</button>
          <button onClick={onCancel} style={{ ...S.btn('#64748b'), background:'white', color:'#64748b', border:'1px solid #e2e8f0' }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ─── Spot Check Modal ─────────────────────────────────────────────────────────

function SpotCheckModal({ question, onSubmit, onSkip }) {
  const [answer, setAnswer] = useState('')
  const words = answer.trim().split(/\s+/).filter(Boolean).length
  const ok = words >= 20

  return (
    <div style={{ position:'fixed', inset:0, zIndex:99999, background:'rgba(0,0,0,.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'white', borderRadius:16, padding:28, width:460, maxWidth:'96vw', boxShadow:'0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ fontSize:13, fontWeight:800, color:'#7c3aed', marginBottom:6, textTransform:'uppercase', letterSpacing:'.08em' }}>🎯 Quick Spot-Check</div>
        <div style={{ fontSize:16, fontWeight:800, color:'#1e293b', marginBottom:6, lineHeight:1.5 }}>{question}</div>
        <div style={{ fontSize:12, color:'#64748b', marginBottom:16 }}>Answer in at least 20 words to complete your log.</div>
        <textarea
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          rows={4}
          autoFocus
          style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:`1.5px solid ${ok ? '#16a34a' : '#d1d5db'}`, fontSize:13, boxSizing:'border-box', resize:'vertical', fontFamily:'inherit', outline:'none' }}
          placeholder="Write your answer here..."
        />
        <div style={{ fontSize:11, color: ok ? '#16a34a' : '#94a3b8', fontWeight:600, marginBottom:16, marginTop:4 }}>
          {ok ? '✓ Good answer!' : `${words}/20 words minimum`}
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={() => onSubmit(answer)} disabled={!ok}
            style={{ backgroundColor: ok ? '#16a34a' : '#94a3b8', color:'white', border:'none', borderRadius:8, padding:'10px 20px', fontWeight:700, cursor: ok ? 'pointer' : 'not-allowed', fontSize:13, flex:1 }}>
            ✅ Submit Answer
          </button>
          <button onClick={onSkip}
            style={{ background:'white', color:'#64748b', border:'1px solid #e2e8f0', borderRadius:8, padding:'10px 16px', fontWeight:600, cursor:'pointer', fontSize:13 }}>
            Skip
          </button>
        </div>
        <div style={{ fontSize:11, color:'#94a3b8', marginTop:10, textAlign:'center' }}>Skipping will flag this log for admin review.</div>
      </div>
    </div>
  )
}

// ─── Step Bar ─────────────────────────────────────────────────────────────────

function StepBar({ current, steps, onChange }) {
  return (
    <div style={{ display:'flex', alignItems:'center', marginBottom:28 }}>
      {steps.map((s, i) => (
        <React.Fragment key={s.key}>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, flex:1, cursor:'pointer' }} onClick={() => current > i && onChange(i)}>
            <div style={S.stepDot(current===i, current>i)}>{current > i ? '✓' : i+1}</div>
            <span style={{ fontSize:10, fontWeight:700, color:current===i?C.navy:current>i?C.green:'#94a3b8', textAlign:'center', maxWidth:64, lineHeight:1.3 }}>{s.label}</span>
          </div>
          {i < steps.length-1 && <div style={S.stepLine(current>i)}/>}
        </React.Fragment>
      ))}
    </div>
  )
}

// ─── Validation Message ───────────────────────────────────────────────────────

function ValidationMessage({ form, step, staff }) {
  const errors = []
  if (step === 0) {
    if (!form.course) errors.push('Course is required')
    if (!form.subtype) errors.push('Batch/Subtype is required')
    if (!form.class_name) errors.push('Class is required')
    if (!form.subject_name) errors.push('Subject is required')
    if (!form.teaching_date) errors.push('Teaching Date is required')
    if (!form.period_number) errors.push('Period is required')
    if (!form.chapter && !form.chapter_custom) errors.push('Chapter is required')
    if (!form.subtopic && !form.subtopic_custom) errors.push('Sub-topic is required')
    if (form.period_number && !isPeriodUnlocked(Number(form.period_number), form.teacher_name, staff)) errors.push('🔒 Selected period has not started yet')
  }
  if (step === 1) {
    if (!form.range_from) errors.push('Range From is required')
    if (!form.range_to) errors.push('Range To is required')
    if (!form.topic_taught?.trim()) errors.push('Topic Taught is required')
    if (!form.classwork?.trim()) errors.push('Classwork is required')
    if (!form.homework?.trim()) errors.push('Homework is required')
    if (!form.remarks?.trim()) errors.push('Remarks are required')
  }
  if (step === 2) {
    if (!(form.techniques || []).length) errors.push('Select at least one Teaching Technique')
    if (!form.technique_detail?.trim()) errors.push('Technique Details are required')
    if (!form.key_concepts?.trim()) errors.push('Key Concepts are required')
    if (!form.technique_avoid?.trim()) errors.push('Avoid Instructions are required')
  }
  if (step === 4 && form.needs_doubt_session) {
    if (!form.assigned_hm_id && !form.assigned_hm_name) errors.push('HM is required')
    if (!form.doubt_date) errors.push('Doubt Date is required')
    if (!form.doubt_time_slot) errors.push('Time Slot is required')
    if (!form.hm_instruction_message) errors.push('HM Instructions are required')
  }
  if (!errors.length) return null
  return (
    <div style={{ padding:'10px 14px', background:'#fee2e2', border:'1px solid #fecaca', borderRadius:8, marginBottom:14 }}>
      <div style={{ fontSize:12, fontWeight:700, color:C.red, marginBottom:4 }}>⚠️ Required Fields Missing:</div>
      <ul style={{ margin:0, paddingLeft:16, fontSize:12, color:C.red, lineHeight:1.8 }}>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
    </div>
  )
}

// ─── Bulk question parser ─────────────────────────────────────────────────────
function parseBulkQuestions(raw) {
  if (!raw.trim()) return []
  const lines = raw.split('\n')
  const qs = []
  let cur = null
  let orderCounter = 1

  lines.forEach(line => {
    const l = line.trim()
    if (!l) return

    const qMatch =
      l.match(/^(?:Q\.?\s*)?(\d+)[.):\]]\s+(.+)/i) ||
      l.match(/^\((\d+)\)\s+(.+)/) ||
      l.match(/^(\d+)\s{2,}(.+)/)

    if (qMatch) {
      if (cur) qs.push(cur)
      cur = {
        order_no: parseInt(qMatch[1]),
        question_text: qMatch[2].trim(),
        answer: '',
        difficulty: 'Medium',
        options: [],
      }
      orderCounter = parseInt(qMatch[1]) + 1
    } else if (!cur && l.length > 10) {
      if (cur) qs.push(cur)
      cur = {
        order_no: orderCounter++,
        question_text: l,
        answer: '',
        difficulty: 'Medium',
        options: [],
      }
    } else if (cur) {
      const optMatch = l.match(/^[([\[]?([A-Da-d])[.):\]]\s+(.+)/)
      if (optMatch) {
        cur.options.push({ key: optMatch[1].toUpperCase(), text: optMatch[2] })
      } else if (/^Ans(?:wer)?[:.]?\s*/i.test(l)) {
        cur.answer = l.replace(/^Ans(?:wer)?[:.]?\s*/i, '').trim()
      } else if (/^Key[:.]?\s*/i.test(l)) {
        cur.answer = l.replace(/^Key[:.]?\s*/i, '').trim()
      } else if (cur.question_text) {
        cur.question_text += ' ' + l
      }
    }
  })
  if (cur) qs.push(cur)
  return qs
}

// ─── Step 1: Course + Chapter ─────────────────────────────────────────────────

function Step1CourseChapter({ form, setForm, courseData, chapters, loadingChapters, staff }) {
  const { courses, subtypesFor, classesFor, batchIdFor } = courseData

  const subtypes = form.course ? subtypesFor(form.course) : []
  const classes  = (form.course && form.subtype) ? classesFor(form.course, form.subtype) : []

  const handleCourse = c => setForm(f => ({ ...f, course:c, subtype:'', class_name:'', batch_id:'', chapter:'', subtopic:'' }))
  const handleSubtype = st => {
    const cls = classesFor(form.course, st)
    const cn  = cls.length === 1 ? cls[0] : ''
    const bid = cn ? batchIdFor(form.course, st, cn) : ''
    setForm(f => ({ ...f, subtype:st, class_name:cn, batch_id:bid, chapter:'', subtopic:'' }))
  }
  const handleClass = cn => setForm(f => ({ ...f, class_name:cn, batch_id: batchIdFor(form.course, form.subtype, cn) }))

  const filteredChapters = useMemo(() => {
    if (!form.subject_name || !chapters.length) return []
    return chapters.filter(c => c.subject_name===form.subject_name)
  }, [chapters, form.subject_name])

  const subtopicsOfChapter = useMemo(() => {
    if (!form.chapter) return []
    const ch = chapters.find(c => c.chapter_name===form.chapter && c.subject_name===form.subject_name)
    return ch?.subtopics || []
  }, [chapters, form.chapter, form.subject_name])

  return (
    <div className="elog-fade">
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:14 }}>
        <div>
          <label style={S.label}>Course <span style={S.required}>*</span></label>
          <select value={form.course} onChange={e => handleCourse(e.target.value)} required style={S.select}>
            <option value="">Select Course</option>
            {courses.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>Batch / Subtype <span style={S.required}>*</span></label>
          <select value={form.subtype} onChange={e => handleSubtype(e.target.value)} disabled={!form.course} required style={{ ...S.select, opacity:form.course?1:.5 }}>
            <option value="">Select Subtype</option>
            {subtypes.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>Class <span style={S.required}>*</span> {form.batch_id && <span style={{ color:C.green, marginLeft:4, fontSize:10 }}>✓ linked</span>}</label>
          {classes.length > 0
            ? <select value={form.class_name} onChange={e => handleClass(e.target.value)} disabled={!form.subtype} required style={{ ...S.select, opacity:form.subtype?1:.5 }}>
                <option value="">Select Class</option>
                {classes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            : <input value={form.class_name} onChange={e => handleClass(e.target.value)} placeholder="e.g. Class 6" disabled={!form.subtype} required style={{ ...S.input, opacity:form.subtype?1:.5 }}/>
          }
        </div>
        <div>
          <label style={S.label}>Subject <span style={S.required}>*</span></label>
          <select value={form.subject_name} onChange={e => setForm(f => ({ ...f, subject_name:e.target.value, chapter:'', subtopic:'' }))} required style={S.select}>
            <option value="">Select Subject</option>
            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>Teaching Date <span style={S.required}>*</span></label>
          <input type="date" value={form.teaching_date} onChange={e => setForm(f => ({ ...f, teaching_date:e.target.value }))} required style={S.input}/>
        </div>
        <div>
          <label style={S.label}>Period <span style={S.required}>*</span></label>
          <select value={form.period_number} onChange={e => setForm(f => ({ ...f, period_number:e.target.value }))} required style={S.select}>
            <option value="">Select Period</option>
            {PERIODS.map(p => {
              const unlocked = isPeriodUnlocked(p, form.teacher_name, staff)
              return (
                <option key={p} value={p} disabled={!unlocked}>
                  {PERIOD_TIMES[p]?.label || `Period ${p}`}{!unlocked ? ' 🔒' : ''}
                </option>
              )
            })}
          </select>
          {form.period_number && !isPeriodUnlocked(Number(form.period_number), form.teacher_name, staff) && (
            <div style={{ color:C.red, fontSize:12, marginTop:5, fontWeight:600 }}>
              🔒 This period hasn't started yet.
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop:16 }}>
        <label style={S.label}>Chapter <span style={S.required}>*</span></label>
        {loadingChapters
          ? <div style={{ fontSize:13, color:'#64748b', padding:'10px 0' }}>⏳ Loading chapters...</div>
          : filteredChapters.length > 0
            ? <select value={form.chapter} onChange={e => setForm(f => ({ ...f, chapter:e.target.value, subtopic:'' }))} required style={S.select}>
                <option value="">Select Chapter</option>
                {filteredChapters.map(c => <option key={c.id} value={c.chapter_name}>{c.chapter_name}</option>)}
                <option value="__other__">Other (type below)</option>
              </select>
            : null
        }
        {(form.chapter === '__other__' || !filteredChapters.length) && (
          <input value={form.chapter==='__other__' ? form.chapter_custom||'' : form.chapter}
            onChange={e => {
              if (filteredChapters.length) setForm(f => ({ ...f, chapter_custom:e.target.value }))
              else setForm(f => ({ ...f, chapter:e.target.value }))
            }}
            placeholder="Type chapter name..." required style={{ ...S.input, marginTop: filteredChapters.length?8:0 }}/>
        )}
      </div>

      <div style={{ marginTop:14 }}>
        <label style={S.label}>Sub-topic / Lesson <span style={S.required}>*</span></label>
        {subtopicsOfChapter.length > 0
          ? <select value={form.subtopic} onChange={e => setForm(f => ({ ...f, subtopic:e.target.value }))} required style={S.select}>
              <option value="">Select Sub-topic</option>
              {subtopicsOfChapter.map((s,i) => <option key={i} value={s}>{s}</option>)}
              <option value="__other__">Other (type below)</option>
            </select>
          : null
        }
        {(form.subtopic === '__other__' || !subtopicsOfChapter.length) && (
          <input value={form.subtopic==='__other__' ? form.subtopic_custom||'' : form.subtopic}
            onChange={e => {
              if (subtopicsOfChapter.length) setForm(f => ({ ...f, subtopic_custom:e.target.value }))
              else setForm(f => ({ ...f, subtopic:e.target.value }))
            }}
            placeholder="e.g. Properties of triangles, Number system basics..." required style={{ ...S.input, marginTop: subtopicsOfChapter.length?8:0 }}/>
        )}
      </div>
    </div>
  )
}

// ─── Step 2: What Was Taught ──────────────────────────────────────────────────

function Step2WhatTaught({ form, setForm }) {
  const chapterDisplay = form.chapter === '__other__' ? form.chapter_custom : form.chapter
  const subtopicDisplay = form.subtopic === '__other__' ? form.subtopic_custom : form.subtopic

  return (
    <div className="elog-fade">
      {(chapterDisplay || subtopicDisplay) && (
        <div style={{ padding:'10px 14px', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10, marginBottom:18, fontSize:13 }}>
          <span style={{ fontWeight:700, color:C.navy }}>📖 {chapterDisplay}</span>
          {subtopicDisplay && <span style={{ color:'#3b82f6', marginLeft:8 }}>→ {subtopicDisplay}</span>}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
        <div>
          <label style={S.label}>Covered From (Q.No / Page / Topic) <span style={S.required}>*</span></label>
          <input value={form.range_from} onChange={e => setForm(f => ({ ...f, range_from:e.target.value }))} required placeholder="e.g. Q.1, Page 23, Section 2.1" style={S.input}/>
        </div>
        <div>
          <label style={S.label}>Covered To <span style={S.required}>*</span></label>
          <input value={form.range_to} onChange={e => setForm(f => ({ ...f, range_to:e.target.value }))} required placeholder="e.g. Q.15, Page 30, Section 2.4" style={S.input}/>
        </div>
      </div>

      <div style={{ marginBottom:14 }}>
        <label style={S.label}>Topic Taught (summary) <span style={S.required}>*</span><WCBadge field="topic_taught" value={form.topic_taught}/><SuggestionPicker field="topic_taught" value={form.topic_taught} onChange={v => setForm(f=>({...f,topic_taught:v}))} form={form}/></label>
        <textarea value={form.topic_taught} onChange={e => setForm(f => ({ ...f, topic_taught:e.target.value }))} required rows={3} style={{ ...S.input, resize:'vertical' }} placeholder="Brief description of what was covered today..."/>
      </div>

      <div style={{ marginBottom:14 }}>
        <label style={S.label}>Classwork done <span style={S.required}>*</span><WCBadge field="classwork" value={form.classwork}/><SuggestionPicker field="classwork" value={form.classwork} onChange={v => setForm(f=>({...f,classwork:v}))} form={form}/></label>
        <textarea value={form.classwork} onChange={e => setForm(f => ({ ...f, classwork:e.target.value }))} required rows={3} style={{ ...S.input, resize:'vertical' }} placeholder="What exercises or work was done in class?"/>
      </div>

      <div style={{ marginBottom:14 }}>
        <label style={S.label}>Homework assigned <span style={S.required}>*</span><WCBadge field="homework" value={form.homework}/><SuggestionPicker field="homework" value={form.homework} onChange={v => setForm(f=>({...f,homework:v}))} form={form}/></label>
        <textarea value={form.homework} onChange={e => setForm(f => ({ ...f, homework:e.target.value }))} required rows={2} style={{ ...S.input, resize:'vertical' }} placeholder="Questions/exercises assigned for home"/>
      </div>

      <div style={{ marginBottom:14 }}>
        <label style={S.label}>Remarks / Observations <span style={S.required}>*</span><WCBadge field="remarks" value={form.remarks}/><SuggestionPicker field="remarks" value={form.remarks} onChange={v => setForm(f=>({...f,remarks:v}))} form={form}/></label>
        <textarea value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks:e.target.value }))} required rows={2} style={{ ...S.input, resize:'vertical' }} placeholder="Student response, pace, anything notable"/>
      </div>

      <div style={{ marginTop:14, padding:'14px 16px', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:10 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'#166534', marginBottom:4 }}>📱 WhatsApp Group Photo</div>
        <div style={{ fontSize:13, color:'#374151', lineHeight:1.7 }}>
          Please upload today's class photo to the <strong>GNSI WhatsApp Group</strong> as proof of teaching.
        </div>
        <div style={{ fontSize:12, color:'#64748b', marginTop:6 }}>This is for your information only — no upload required here.</div>
      </div>
    </div>
  )
}

// ─── Step 3: Teaching Technique ───────────────────────────────────────────────

function Step3Technique({ form, setForm }) {
  const toggleTechnique = t => {
    const cur = form.techniques || []
    const next = cur.includes(t) ? cur.filter(x => x !== t) : [...cur, t]
    setForm(f => ({ ...f, techniques: next }))
  }

  return (
    <div className="elog-fade">
      <p style={{ color:'#64748b', fontSize:13, marginBottom:16, lineHeight:1.7 }}>
        Select all teaching methods used in this session. Be specific — this helps HMs conduct doubt sessions effectively.
      </p>

      <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:20 }}>
        {TEACHING_TECHNIQUES.map(t => (
          <button key={t} type="button" onClick={() => toggleTechnique(t)} style={S.tag((form.techniques||[]).includes(t))}>
            {(form.techniques||[]).includes(t) ? '✓ ' : ''}{t}
          </button>
        ))}
      </div>
      {(form.techniques || []).length === 0 && (
        <div style={{ color:C.red, fontSize:12, marginBottom:10, fontWeight:600 }}>⚠️ Select at least one technique</div>
      )}

      <div style={{ marginBottom:14 }}>
        <label style={S.label}>Technique Details <span style={S.required}>*</span><WCBadge field="technique_detail" value={form.technique_detail}/><SuggestionPicker field="technique_detail" value={form.technique_detail} onChange={v => setForm(f=>({...f,technique_detail:v}))} form={form}/></label>
        <textarea value={form.technique_detail} onChange={e => setForm(f => ({ ...f, technique_detail:e.target.value }))} required rows={4} style={{ ...S.input, resize:'vertical' }} placeholder={`Describe in detail HOW you taught this topic.`}/>
      </div>

      <div style={{ marginBottom:14 }}>
        <label style={S.label}>Key Concepts to Emphasise (for HM) <span style={S.required}>*</span><WCBadge field="key_concepts" value={form.key_concepts}/><SuggestionPicker field="key_concepts" value={form.key_concepts} onChange={v => setForm(f=>({...f,key_concepts:v}))} form={form}/></label>
        <textarea value={form.key_concepts} onChange={e => setForm(f => ({ ...f, key_concepts:e.target.value }))} required rows={2} style={{ ...S.input, resize:'vertical' }} placeholder="e.g. Always draw the diagram first. Common mistake: forgetting sign rules."/>
      </div>

      <div>
        <label style={S.label}>Do NOT do this during doubt session <span style={S.required}>*</span><WCBadge field="technique_avoid" value={form.technique_avoid}/><SuggestionPicker field="technique_avoid" value={form.technique_avoid} onChange={v => setForm(f=>({...f,technique_avoid:v}))} form={form}/></label>
        <textarea value={form.technique_avoid} onChange={e => setForm(f => ({ ...f, technique_avoid:e.target.value }))} required rows={2} style={{ ...S.input, resize:'vertical' }} placeholder="e.g. Do NOT jump to answers directly. Make students attempt first."/>
      </div>
    </div>
  )
}

// ─── Step 4: Bulk Practice Questions ─────────────────────────────────────────

function Step4BulkQuestions({ form, setForm }) {
  const [raw, setRaw] = useState('')
  const [parsed, setParsed] = useState(form.practice_questions || [])
  const [parseError, setParseError] = useState('')
  const chapterDisplay = form.chapter === '__other__' ? form.chapter_custom : form.chapter

  const handleParse = () => {
    if (!raw.trim()) { setParseError('Paste some questions first.'); return }
    const qs = parseBulkQuestions(raw)
    if (!qs.length) { setParseError('Could not detect any questions. Use format: "1. Question text" or "Q1. Question text"'); return }
    setParseError(''); setParsed(qs); setForm(f => ({ ...f, practice_questions: qs }))
  }

  const updateQ = (i, field, val) => {
    const updated = parsed.map((q, j) => j===i ? { ...q, [field]: val } : q)
    setParsed(updated); setForm(f => ({ ...f, practice_questions: updated }))
  }

  const removeQ = i => {
    const updated = parsed.filter((_,j) => j!==i)
    setParsed(updated); setForm(f => ({ ...f, practice_questions: updated }))
  }

  const addBlank = () => {
    const updated = [...parsed, { order_no: parsed.length+1, question_text:'', answer:'', difficulty:'Medium', options:[] }]
    setParsed(updated); setForm(f => ({ ...f, practice_questions: updated }))
  }

  return (
    <div className="elog-fade">
      <div style={{ padding:'12px 16px', background:'#fef9c3', border:'1px solid #fde68a', borderRadius:10, marginBottom:18 }}>
        <div style={{ fontWeight:700, color:'#854d0e', fontSize:13, marginBottom:3 }}>📋 Practice Question Bank</div>
        <div style={{ fontSize:12, color:'#a16207', lineHeight:1.6 }}>Upload practice questions for <b>{chapterDisplay || 'this chapter'}</b>.</div>
      </div>
      <div style={{ marginBottom:14 }}>
        <label style={S.label}>Paste Questions Here (from PDF / book)</label>
        <textarea value={raw} onChange={e => setRaw(e.target.value)} rows={8} style={{ ...S.input, fontFamily:"'JetBrains Mono',monospace", fontSize:12, resize:'vertical' }} placeholder={`Supports multiple formats:\n\n1. What is the Pythagorean theorem?\nAns: a²+b²=c²\n\nQ2) What is an isosceles triangle?\nA) 2 equal sides  B) 3 equal sides\nKey: A`}/>
        <div style={{ display:'flex', gap:8, marginTop:8 }}>
          <button type="button" onClick={handleParse} style={S.btn(C.amber)}>🔍 Parse Questions</button>
          {parseError && <span style={{ fontSize:12, color:C.red, alignSelf:'center' }}>{parseError}</span>}
        </div>
      </div>
      {parsed.length > 0 && (
        <>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <div style={{ fontWeight:700, color:'#1e293b', fontSize:14 }}>{parsed.length} Question{parsed.length!==1?'s':''} Ready to Save</div>
            <button type="button" onClick={addBlank} style={S.btnSm(C.sky)}>+ Add Question</button>
          </div>
          {parsed.map((q, i) => (
            <div key={i} style={{ border:'1px solid #e2e8f0', borderRadius:10, padding:14, marginBottom:10, background:'#f8fafc' }}>
              <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                <span style={{ ...S.badge(C.navy,'#eff6ff'), flexShrink:0, marginTop:2 }}>Q{q.order_no}</span>
                <div style={{ flex:1 }}>
                  <textarea value={q.question_text} onChange={e => updateQ(i,'question_text',e.target.value)} rows={2} style={{ ...S.input, fontSize:13, marginBottom:8, resize:'vertical' }} placeholder="Question text..."/>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    <div style={{ flex:'1 1 200px' }}>
                      <label style={{ ...S.label, fontSize:10 }}>Answer / Key</label>
                      <input value={q.answer} onChange={e => updateQ(i,'answer',e.target.value)} style={{ ...S.input, fontSize:12 }} placeholder="Answer..."/>
                    </div>
                    <div style={{ flex:'0 0 120px' }}>
                      <label style={{ ...S.label, fontSize:10 }}>Difficulty</label>
                      <select value={q.difficulty} onChange={e => updateQ(i,'difficulty',e.target.value)} style={{ ...S.select, fontSize:12 }}>
                        {DIFFICULTY.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                <button type="button" onClick={() => removeQ(i)} style={{ ...S.btnSm(C.red), padding:'4px 8px', flexShrink:0 }}>✕</button>
              </div>
            </div>
          ))}
        </>
      )}
      {!parsed.length && !raw && <button type="button" onClick={addBlank} style={S.btn(C.sky)}>+ Add Question Manually</button>}
    </div>
  )
}

// ─── Step 5: HM Assignment + Notification ────────────────────────────────────

function Step5HMAssign({ form, setForm, staff, students, loadingStudents }) {
  const hmStaff = useMemo(() =>
    staff.filter(s => ['housemaster','hm','housemistress','warden'].some(r =>
      (s.designation||s.role||'').toLowerCase().includes(r)
    )),
  [staff])

  const batchStudents = useMemo(() => students || [], [students])
  const weakStudents = useMemo(() => form.weak_students || [], [form.weak_students])

  // Auto-suggest time slot only (NOT hm) from DOUBT_SESSION_MAP
  // FIX 6: teacher's explicit HM selection always takes priority; map only fills slot if blank
  useEffect(() => {
    if (!form.needs_doubt_session || !form.subtype || !form.subject_name) return
    const subLower = form.subject_name.toLowerCase()
    const batchLower = (form.subtype||'').toLowerCase()
    const match = DOUBT_SESSION_MAP.find(d =>
      batchLower.includes(d.batch.toLowerCase().split(' ')[0]) &&
      (subLower.includes(d.subject.toLowerCase()) || d.subject.toLowerCase().includes(subLower.split(' ')[0]))
    )
    if (match) {
      setForm(f => ({
        ...f,
        // FIX 6: only fill HM suggestion if teacher hasn't already chosen one
        assigned_hm_name: f.assigned_hm_name || match.hm,
        doubt_time_slot:  f.doubt_time_slot  || match.slot,
      }))
    }
  }, [form.needs_doubt_session, form.subtype, form.subject_name])

  const toggleWeak = id => {
    const cur = form.focus_student_ids || []
    const next = cur.includes(id) ? cur.filter(x => x!==id) : [...cur, id]
    setForm(f => ({ ...f, focus_student_ids: next }))
  }

  return (
    <div className="elog-fade">
      <div style={{ padding:'12px 16px', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10, marginBottom:18 }}>
        <div style={{ fontWeight:700, color:C.navy, fontSize:13, marginBottom:3 }}>🏠 Housemaster Notification</div>
        <div style={{ fontSize:12, color:'#3b82f6', lineHeight:1.6 }}>Assign a HM for the doubt session. They will receive instant notification with your teaching instructions.</div>
      </div>

      <div style={{ marginBottom:16 }}>
        <label style={S.label}>Needs Doubt Session? <span style={S.required}>*</span></label>
        <label style={{ display:'flex', alignItems:'center', gap:12, cursor:'pointer', padding:'12px 14px', borderRadius:8, background:form.needs_doubt_session?'#fef9c3':'#f8fafc', border:`1px solid ${form.needs_doubt_session?'#fde68a':'#e2e8f0'}`, minHeight:48 }}>
          <input type="checkbox" checked={form.needs_doubt_session||false} onChange={e => setForm(f => ({ ...f, needs_doubt_session:e.target.checked }))} style={{ width:18, height:18, cursor:'pointer'}}/>
          <span style={{ fontWeight:700, fontSize:14, color:form.needs_doubt_session?'#b45309':'#374151' }}>🔁 Yes — Assign HM for Doubt Session</span>
        </label>
      </div>

      {form.needs_doubt_session && (
        <>
          <div style={{ marginBottom:14 }}>
            <label style={S.label}>Assign Housemaster / Warden <span style={S.required}>*</span></label>
            {hmStaff.length > 0
              ? <select value={form.assigned_hm_id||''} onChange={e => {
                  const s = hmStaff.find(x => x.id===e.target.value)
                  setForm(f => ({ ...f, assigned_hm_id:e.target.value, assigned_hm_name:s?.name||'' }))
                }} required style={S.select}>
                  <option value="">Select HM/Warden</option>
                  {hmStaff.map(s => <option key={s.id} value={s.id}>{s.name} ({s.designation||'HM'})</option>)}
                </select>
              : <select value={form.assigned_hm_name||''} onChange={e => setForm(f => ({ ...f, assigned_hm_name:e.target.value }))} required style={S.select}>
                  <option value="">Select Staff</option>
                  {[...new Set(DOUBT_SESSION_MAP.map(d => d.hm))].sort().map(n => <option key={n} value={n}>{n}</option>)}
                </select>
            }
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
            <div>
              <label style={S.label}>Preferred Date for Doubt Session <span style={S.required}>*</span></label>
              <input type="date" value={form.doubt_date||''} onChange={e => setForm(f => ({ ...f, doubt_date:e.target.value }))} required style={S.input}/>
            </div>
            <div>
              <label style={S.label}>Preferred Time Slot <span style={S.required}>*</span></label>
              <select value={form.doubt_time_slot||''} onChange={e => setForm(f => ({ ...f, doubt_time_slot:e.target.value }))} required style={S.select}>
                <option value="">Select Time Slot</option>
                {DOUBT_TIME_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom:14 }}>
            <label style={S.label}>Instruction Message to HM <span style={S.required}>*</span></label>
            <textarea value={form.hm_instruction_message||''} onChange={e => setForm(f => ({ ...f, hm_instruction_message:e.target.value }))} required rows={4} style={{ ...S.input, resize:'vertical' }} placeholder={`Write specific instructions for the HM:\n\n"Focus on Q.5–Q.9 where students struggled. Make them draw the diagram first before attempting."`}/>
          </div>

          {batchStudents.length > 0 && (
            <div style={{ marginBottom:14 }}>
              <label style={S.label}>Focus Students <span style={S.required}>*</span> (mark who needs extra attention)</label>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, padding:12, background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:8 }}>
                {batchStudents.map(s => {
                  const focused = (form.focus_student_ids||[]).includes(s.id)
                  const isWeak = weakStudents.some(w => w.student_id===s.id)
                  return (
                    <button key={s.id} type="button" onClick={() => toggleWeak(s.id)} style={{ ...S.pill(focused?'white':isWeak?C.red:'#374151', focused?C.navy:isWeak?'#fee2e2':'#f1f5f9'), border: focused?`2px solid ${C.navy}`:'2px solid transparent' }}>
                      {focused ? '✓ ' : isWeak ? '⚠️ ' : ''}{s.name}
                    </button>
                  )
                })}
              </div>
              {(form.focus_student_ids || []).length === 0 && (
                <div style={{ color:C.red, fontSize:12, marginTop:6, fontWeight:600 }}>⚠️ Select at least one focus student</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Printable Log ────────────────────────────────────────────────────────────

function PrintableLog({ form }) {
  const chapterDisplay = form.chapter === '__other__' ? form.chapter_custom : form.chapter
  const subtopicDisplay = form.subtopic === '__other__' ? form.subtopic_custom : form.subtopic

  return (
    <div id="printable-log" style={{ display:'none' }}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #printable-log, #printable-log * { visibility: visible; }
          #printable-log { 
            position: fixed; top: 0; left: 0; 
            width: 100%; padding: 24px;
            font-family: 'Georgia', serif;
            font-size: 13px;
            color: #000;
          }
          .print-section { margin-bottom: 14px; }
          .print-table { width: 100%; border-collapse: collapse; }
          .print-table td { 
            padding: 7px 10px; 
            border: 1px solid #ccc; 
            vertical-align: top;
          }
          .print-label { 
            font-weight: bold; 
            background: #f0f0f0; 
            width: 35%;
          }
          .print-header { 
            text-align: center; 
            border-bottom: 2px solid #000; 
            padding-bottom: 10px; 
            margin-bottom: 18px;
          }
          .print-title { font-size: 18px; font-weight: bold; }
          .print-subtitle { font-size: 12px; color: #444; margin-top: 4px; }
          .print-footer { 
            margin-top: 30px; 
            display: flex; 
            justify-content: space-between; 
            font-size: 12px;
          }
          .print-sign { 
            border-top: 1px solid #000; 
            padding-top: 6px; 
            width: 160px; 
            text-align: center;
          }
        }
      `}</style>

      <div className="print-header">
        <div className="print-title">GNSI — Daily Teaching Log</div>
        <div className="print-subtitle">
          {form.course} · {form.subtype} · {form.class_name} &nbsp;|&nbsp;
          {form.subject_name} &nbsp;|&nbsp;
          {form.teaching_date ? new Date(form.teaching_date).toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'}) : '—'}
          &nbsp;|&nbsp; Period {form.period_number}
        </div>
      </div>

      <div className="print-section">
        <table className="print-table">
          <tbody>
            <tr>
              <td className="print-label">Teacher</td>
              <td>{form.teacher_name || '—'}</td>
              <td className="print-label">Date</td>
              <td>{form.teaching_date ? new Date(form.teaching_date).toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'}) : '—'}</td>
            </tr>
            <tr>
              <td className="print-label">Course / Batch</td>
              <td>{form.course} / {form.subtype}</td>
              <td className="print-label">Period</td>
              <td>{form.period_number ? `Period ${form.period_number} — ${PERIOD_TIMES[form.period_number]?.label || ''}` : '—'}</td>
            </tr>
            <tr>
              <td className="print-label">Subject</td>
              <td>{form.subject_name || '—'}</td>
              <td className="print-label">Class</td>
              <td>{form.class_name || '—'}</td>
            </tr>
            <tr>
              <td className="print-label">Chapter</td>
              <td>{chapterDisplay || '—'}</td>
              <td className="print-label">Sub-topic</td>
              <td>{subtopicDisplay || '—'}</td>
            </tr>
            <tr>
              <td className="print-label">Range Covered</td>
              <td colSpan={3}>{form.range_from ? `${form.range_from} → ${form.range_to}` : '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="print-section">
        <table className="print-table">
          <tbody>
            <tr><td className="print-label">Topic Taught</td><td colSpan={3}>{form.topic_taught || '—'}</td></tr>
            <tr><td className="print-label">Classwork Done</td><td colSpan={3}>{form.classwork || '—'}</td></tr>
            <tr><td className="print-label">Homework Assigned</td><td colSpan={3}>{form.homework || '—'}</td></tr>
            <tr><td className="print-label">Remarks / Observations</td><td colSpan={3}>{form.remarks || '—'}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="print-section">
        <table className="print-table">
          <tbody>
            <tr><td className="print-label">Techniques Used</td><td colSpan={3}>{(form.techniques || []).join(', ') || '—'}</td></tr>
            <tr><td className="print-label">Technique Details</td><td colSpan={3}>{form.technique_detail || '—'}</td></tr>
            <tr><td className="print-label">Key Concepts (for HM)</td><td colSpan={3}>{form.key_concepts || '—'}</td></tr>
            <tr><td className="print-label">Avoid During Doubt Session</td><td colSpan={3}>{form.technique_avoid || '—'}</td></tr>
          </tbody>
        </table>
      </div>

      {form.needs_doubt_session && (
        <div className="print-section">
          <table className="print-table">
            <tbody>
              <tr>
                <td className="print-label">HM Assigned</td>
                <td>{form.assigned_hm_name || '—'}</td>
                <td className="print-label">Doubt Date</td>
                <td>{form.doubt_date ? new Date(form.doubt_date).toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'}) : '—'}</td>
              </tr>
              <tr>
                <td className="print-label">Time Slot</td>
                <td>{form.doubt_time_slot || '—'}</td>
                <td className="print-label">Focus Students</td>
                <td>{(form.focus_student_ids || []).length} marked</td>
              </tr>
              <tr><td className="print-label">HM Instructions</td><td colSpan={3}>{form.hm_instruction_message || '—'}</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {(form.practice_questions || []).length > 0 && (
        <div className="print-section">
          <div style={{ fontWeight:'bold', marginBottom:6, fontSize:13 }}>
            Practice Questions ({form.practice_questions.length})
          </div>
          <table className="print-table">
            <thead>
              <tr>
                <td className="print-label" style={{ width:'6%' }}>No.</td>
                <td className="print-label" style={{ width:'60%' }}>Question</td>
                <td className="print-label" style={{ width:'20%' }}>Answer</td>
                <td className="print-label" style={{ width:'14%' }}>Difficulty</td>
              </tr>
            </thead>
            <tbody>
              {form.practice_questions.map((q, i) => (
                <tr key={i}>
                  <td style={{ textAlign:'center' }}>{q.order_no || i+1}</td>
                  <td>{q.question_text}</td>
                  <td>{q.answer || '—'}</td>
                  <td style={{ textAlign:'center' }}>{q.difficulty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="print-footer">
        <div className="print-sign">Subject Teacher<br/>{form.teacher_name || ''}</div>
        <div className="print-sign">Housemaster<br/>{form.assigned_hm_name || ''}</div>
        <div className="print-sign">Principal / Admin</div>
      </div>
    </div>
  )
}

// ─── Review Step ──────────────────────────────────────────────────────────────

function StepReview({ form }) {
  const chapterDisplay = form.chapter === '__other__' ? form.chapter_custom : form.chapter
  const subtopicDisplay = form.subtopic === '__other__' ? form.subtopic_custom : form.subtopic

  const rows = [
    ['Course', `${form.course||'—'} / ${form.subtype||'—'} / ${form.class_name||'—'}`],
    ['Subject', form.subject_name||'—'],
    ['Date', form.teaching_date ? fmtDate(form.teaching_date) : '—'],
    ['Period', form.period_number || '—'],
    ['Chapter', chapterDisplay||'—'],
    ['Sub-topic', subtopicDisplay||'—'],
    ['Range', form.range_from ? `${form.range_from} → ${form.range_to||'end'}` : '—'],
    ['Topic Taught', form.topic_taught||'—'],
    ['Classwork', form.classwork||'—'],
    ['Homework', form.homework||'—'],
    ['Remarks', form.remarks||'—'],
    ['Techniques', (form.techniques||[]).join(', ')||'—'],
    ['Technique Detail', form.technique_detail||'—'],
    ['Key Concepts', form.key_concepts||'—'],
    ['Avoid', form.technique_avoid||'—'],
    ['Practice Qs', (form.practice_questions||[]).length + ' questions'],
    ['HM Assigned', form.needs_doubt_session ? (form.assigned_hm_name||'Not set') : 'No doubt session'],
    ['Doubt Date', form.doubt_date ? fmtDate(form.doubt_date) : '—'],
    ['Time Slot', form.doubt_time_slot || '—'],
    ['Focus Students', (form.focus_student_ids||[]).length + ' marked'],
  ]

  const handlePrint = () => {
    const el = document.getElementById('printable-log')
    if (el) {
      el.style.display = 'block'
      window.print()
      el.style.display = 'none'
    }
  }

  return (
    <div className="elog-fade">
      <div style={{ padding:'12px 16px', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:10, marginBottom:18, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
        <div>
          <div style={{ fontWeight:700, color:'#166534', fontSize:13 }}>✅ Review & Save</div>
          <div style={{ fontSize:12, color:'#16a34a' }}>Check everything below, then click Save Log.</div>
        </div>
        <button type="button" onClick={handlePrint}
          style={{ backgroundColor:C.navy, color:'white', border:'none', borderRadius:8, padding:'8px 16px', fontWeight:700, cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', gap:6 }}>
          🖨️ Print Log
        </button>
      </div>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
        <tbody>
          {rows.map(([k,v]) => (
            <tr key={k} style={{ borderBottom:'1px solid #f1f5f9' }}>
              <td style={{ padding:'8px 12px', fontWeight:700, color:'#374151', width:'38%', background:'#f8fafc' }}>{k}</td>
              <td style={{ padding:'8px 12px', color:'#1e293b' }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <PrintableLog form={form} />
    </div>
  )
}

// ─── Steps Config + Empty Form ────────────────────────────────────────────────

const STEPS = [
  { key:'course',     label:'Course & Chapter' },
  { key:'taught',     label:'What Was Taught' },
  { key:'technique',  label:'Teaching Method' },
  { key:'questions',  label:'Practice Qs' },
  { key:'hm',         label:'HM & Notify' },
  { key:'review',     label:'Review & Save' },
]

const emptyForm = {
  course:'', subtype:'', class_name:'', batch_id:'',
  subject_name:'', chapter:'', chapter_custom:'', subtopic:'', subtopic_custom:'',
  teaching_date: '', period_number:'', teacher_name:'', staff_id:'',
  range_from:'', range_to:'', topic_taught:'', classwork:'', homework:'', remarks:'',
  techniques:[], technique_detail:'', key_concepts:'', technique_avoid:'',
  practice_questions:[],
  needs_doubt_session:false, assigned_hm_id:'', assigned_hm_name:'',
  doubt_date:'', doubt_time_slot:'',
  hm_instruction_message:'', focus_student_ids:[], weak_students:[],
}

// ─── Main: Enhanced Log Form ──────────────────────────────────────────────────

export function EnhancedLogForm({ onSaved, courseData, staff, currentUser, logs }) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(() => {
  const draft = loadDraft()
  if (!draft) return { ...emptyForm }
  // Discard draft if it belongs to a different teacher
  if (currentUser?.name && draft.teacher_name && draft.teacher_name !== currentUser.name) {
    clearDraft()
    return { ...emptyForm }
  }
  return { ...emptyForm, ...draft }
})
  const [saving, setSaving] = useState(false)
  const [chapters, setChapters] = useState([])
  const [loadingChapters, setLoadingChapters] = useState(false)
  const [students, setStudents] = useState([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [dupWarn, setDupWarn] = useState('')
  const [attemptedNext, setAttemptedNext] = useState(false)
  const [gpsStatus, setGpsStatus] = useState('idle')
  const [gpsDistance, setGpsDistance] = useState(null)
  const [attWarn, setAttWarn] = useState(false)
  const [spotCheck, setSpotCheck] = useState(null)
  const [hasDraft, setHasDraft] = useState(false)
  // FIX 9: warn when draft's period is now locked
  const [draftPeriodStaleWarn, setDraftPeriodStaleWarn] = useState(false)
  const { show: showToast, el: toastEl } = useToast()
  const savingRef = useRef(false)
  // FIX 4: track whether GPS check has already been done for this Step-0 advance
  const gpsCheckedRef = useRef(false)

  // FIX 9: check for stale period on initial mount if draft was restored
  useEffect(() => {
    const draft = loadDraft()
    if (draft && staff?.length > 0) {
      setDraftPeriodStaleWarn(isDraftPeriodStale(draft, staff))
    }
  }, [staff])

  useEffect(() => {
    if (form.course || form.subject_name || form.topic_taught) {
      saveDraft(form)
      setHasDraft(true)
    }
  }, [form])

  useEffect(() => {
  if (!currentUser?.name) return
  const s = staff.find(x => x.name === currentUser.name)
  // If draft belongs to a different teacher, discard it and start clean
  if (form.teacher_name && form.teacher_name !== currentUser.name) {
    clearDraft()
    setHasDraft(false)
    setForm({ ...emptyForm, teacher_name: currentUser.name, staff_id: s?.id || '' })
    return
  }
  // Normal case: set teacher name if not already set
  if (loadDraft()) setHasDraft(true)
  if (!form.teacher_name) {
    setForm(f => ({ ...f, teacher_name: currentUser.name, staff_id: s?.id || '' }))
  }
}, [currentUser, staff])

  useEffect(() => {
    if (!form.subject_name) return
    setLoadingChapters(true)
    supabase.from('syllabus_topics').select('*').eq('subject_name', form.subject_name)
      .order('chapter_name')
      .then(({ data }) => { setChapters(data || []); setLoadingChapters(false) })
  }, [form.subject_name])

  useEffect(() => {
    if (!form.batch_id) return
    setLoadingStudents(true)
    supabase.from('students').select('id,name,roll_number,house').eq('course', form.course).eq('batch', form.subtype||'').eq('status','Active').order('name')
      .then(async ({ data: studs }) => {
        if (!studs?.length) { setStudents([]); setLoadingStudents(false); return }
        const { data: scores } = await supabase.from('student_scores').select('student_id,score,max_score,subject_name').in('student_id', studs.map(s=>s.id))
        const weakMap = {}
        if (scores) {
          scores.forEach(sc => {
            if (!weakMap[sc.student_id]) weakMap[sc.student_id] = { totals:[], subject:sc.subject_name }
            weakMap[sc.student_id].totals.push(pct(sc.score, sc.max_score))
          })
        }
        const enriched = studs.map(s => ({
          ...s,
          avg_score: weakMap[s.id] ? Math.round(weakMap[s.id].totals.reduce((a,b)=>a+b,0)/weakMap[s.id].totals.length) : null,
        }))
        const weak = enriched.filter(s => s.avg_score !== null && s.avg_score < 60).map(s => ({ student_id:s.id, avg_score:s.avg_score }))
        setStudents(enriched)
        setForm(f => ({ ...f, weak_students: weak }))
        setLoadingStudents(false)
      })
  }, [form.batch_id])

  // FIX 2: isDuplicate skips check when class_name is empty (manual input not yet typed)
  const isDuplicate = useCallback(() => {
    if (!form.course || !form.subtype || !form.subject_name || !form.teaching_date) return false
    // Don't check duplicates when class_name is blank — it might not be filled yet for manual input
    if (!form.class_name) return false
    return logs.some(l =>
      l.course === form.course &&
      l.subtype === form.subtype &&
      l.class_name === form.class_name &&
      l.subject_name === form.subject_name &&
      l.teaching_date === form.teaching_date
    )
  }, [form, logs])

  const checkGPS = useCallback(() => new Promise((resolve) => {
    if (!navigator.geolocation) { setGpsStatus('error'); resolve(false); return }
    setGpsStatus('checking')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const dist = getDistanceMeters(pos.coords.latitude, pos.coords.longitude, SCHOOL_LAT, SCHOOL_LNG)
        setGpsDistance(Math.round(dist))
        if (dist <= SCHOOL_RADIUS_M) { setGpsStatus('allowed'); resolve(true) }
        else { setGpsStatus('denied'); resolve(false) }
      },
      () => { setGpsStatus('error'); resolve(false) },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }), [])

  // FIX 5: strip A/B suffix from subtype before querying attendance_sessions
  const checkAttendance = useCallback(async () => {
    if (!form.course || !form.subtype || !form.teaching_date) return true
    try {
      // Normalise subtype: "Leader A" → "Leader", "Achiever B" → "Achiever"
      const normSubtype = form.subtype.replace(/\s+[AB]$/i, '').trim()
      const { data, error } = await supabase
        .from('attendance_sessions')
        .select('id')
        .eq('course', form.course)
        .eq('subtype', normSubtype)
        .eq('session_date', form.teaching_date)
        .limit(1)
      if (error) return true // network error → don't block
      // Also accept exact match in case attendance was saved with suffix
      if (data?.length) return true
      if (normSubtype !== form.subtype) {
        const { data: data2 } = await supabase
          .from('attendance_sessions')
          .select('id')
          .eq('course', form.course)
          .eq('subtype', form.subtype)
          .eq('session_date', form.teaching_date)
          .limit(1)
        return (data2?.length || 0) > 0
      }
      return false
    } catch {
      return true
    }
  }, [form.course, form.subtype, form.teaching_date])

  const handleSpotSubmit = async (answer) => {
    if (spotCheck?.logId) {
      await supabase.from('teaching_logs').update({
        spot_check_done: true,
        spot_check_answer: answer,
        spot_check_skipped: false,
      }).eq('id', spotCheck.logId)
    }
    setSpotCheck(null)
    clearDraft()
    setHasDraft(false)
    showToast('Log saved successfully ✓', C.green)
    setForm({ ...emptyForm })
    setStep(0)
    gpsCheckedRef.current = false
    onSaved?.()
  }

  const handleSpotSkip = async () => {
    if (spotCheck?.logId) {
      await supabase.from('teaching_logs').update({
        spot_check_skipped: true,
        spot_check_done: false,
      }).eq('id', spotCheck.logId)
    }
    setSpotCheck(null)
    clearDraft()
    setHasDraft(false)
    showToast('⚠️ Spot-check skipped — log flagged for review.', C.amber)
    setForm({ ...emptyForm })
    setStep(0)
    gpsCheckedRef.current = false
    onSaved?.()
  }

  // FIX 1: corrected focus_student_ids guard (students.length > 0, not === 0)
  const canNext = () => {
    if (step === 0) {
      return form.course && form.subtype && form.class_name && form.subject_name &&
             form.teaching_date && form.period_number &&
             (form.chapter || form.chapter_custom) &&
             (form.subtopic || form.subtopic_custom) &&
             isPeriodUnlocked(Number(form.period_number), form.teacher_name, staff)
    }
    if (step === 1) {
      return form.range_from && form.range_to &&
             form.topic_taught?.trim() &&
             form.classwork?.trim() &&
             form.homework?.trim() &&
             form.remarks?.trim()
    }
    if (step === 2) {
      return (form.techniques || []).length > 0 &&
             form.technique_detail?.trim() &&
             form.key_concepts?.trim() &&
             form.technique_avoid?.trim()
    }
    if (step === 3) return true
    if (step === 4) {
      if (form.needs_doubt_session) {
        // FIX 1: guard is students.length > 0 (has students) → require focus selection
        return (form.assigned_hm_id || form.assigned_hm_name) && form.doubt_date &&
               form.doubt_time_slot && form.hm_instruction_message &&
               (students.length === 0 || (form.focus_student_ids || []).length > 0)
      }
      return true
    }
    return true
  }

  const handleNext = async () => {
    setAttemptedNext(true)
    if (step === 0) {
      if (isDuplicate()) {
        setDupWarn(`⚠️ A log for ${form.subject_name} on ${form.teaching_date} already exists for this batch.`)
        return
      }
      // FIX 4: only run GPS check once per Step-0 advance attempt
      if (!gpsCheckedRef.current) {
        const gpsOk = await checkGPS()
        if (!gpsOk) return
        gpsCheckedRef.current = true
      }
      const attOk = await checkAttendance()
      if (!attOk) { setAttWarn(true); return }
      setAttWarn(false)
    }
    setDupWarn('')
    if (step < STEPS.length - 1) setStep(s => s + 1)
  }

  const handleSave = async () => {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    try {
      const chapterFinal = form.chapter === '__other__' ? form.chapter_custom : form.chapter
      const subtopicFinal = form.subtopic === '__other__' ? form.subtopic_custom : form.subtopic

      const now = new Date()
      const isLate = now.getHours() >= 21
      const logPayload = {
        course: form.course, subtype: form.subtype || null, class_name: form.class_name || null,
        batch_id: form.batch_id || null, subject_name: form.subject_name,
        teacher_name: form.teacher_name || null, staff_id: form.staff_id || null,
        teaching_date: form.teaching_date, topic_taught: form.topic_taught,
        classwork: form.classwork || null, homework: form.homework || null,
        remarks: form.remarks || null, period_number: form.period_number || null,
        needs_doubt_session: form.needs_doubt_session || false,
        chapter: chapterFinal || null, subtopic: subtopicFinal || null,
        range_from: form.range_from || null, range_to: form.range_to || null,
        techniques: form.techniques?.length ? form.techniques.join(', ') : null,
        technique_detail: form.technique_detail || null,
        key_concepts: form.key_concepts || null,
        technique_avoid: form.technique_avoid || null,
        late_submission: isLate,
        submitted_at: now.toISOString(),
      }

      const { data: logData, error: logError } = await supabase.from('teaching_logs').insert([logPayload]).select().single()

      // FIX 3: early return on DB error — nothing downstream should run
      if (logError) {
        showToast('Error saving log: ' + logError.message, C.red)
        setSaving(false)
        savingRef.current = false
        return
      }

      // FIX 3: null-guard logId before any downstream use
      const logId = logData?.id ?? null
      if (!logId) {
        showToast('Unexpected error: log saved but no ID returned.', C.red)
        setSaving(false)
        savingRef.current = false
        return
      }

      // ── Similarity check ──────────────────────────────────────────────────
      let isCopyPasteFlagged = false
      try {
        const { data: prevLogs } = await supabase
          .from('teaching_logs')
          .select('topic_taught,classwork,remarks,technique_detail,key_concepts')
          .eq('teacher_name', form.teacher_name)
          .neq('id', logId)
          .order('teaching_date', { ascending: false })
          .limit(10)

        if (prevLogs?.length >= 2) {
          const maxSim = getSimilarityScore(logPayload, prevLogs)
          const suspicious = maxSim >= 0.8
          const warned     = maxSim >= 0.6 && maxSim < 0.8

          const { data: flaggedLogs } = await supabase
            .from('teaching_logs')
            .select('id')
            .eq('teacher_name', form.teacher_name)
            .eq('copy_paste', true)
            .neq('id', logId)
            .order('teaching_date', { ascending:false })
            .limit(10)

          const repeatCount = flaggedLogs?.length || 0

          const { data: existingWarn } = await supabase
            .from('teacher_warnings')
            .select('id')
            .eq('log_id', logId)
            .limit(1)
          const alreadyWarned = existingWarn?.length > 0

          if (suspicious && !alreadyWarned) {
            isCopyPasteFlagged = true
            await supabase.from('teaching_logs').update({
              copy_paste: true,
              lazy_score: Math.round(maxSim * 100),
            }).eq('id', logId)

            if (repeatCount >= 5) {
              await supabase.from('teacher_warnings').insert([{
                teacher_name: form.teacher_name,
                staff_id: form.staff_id || null,
                warning_type: 'blocked',
                message: `🚫 Blocked: ${repeatCount}+ repeated logs detected. Immediate review required.`,
                similarity_score: Math.round(maxSim * 100),
                log_id: Number(logId),
                created_at: new Date().toISOString(),
              }])
              showToast('🚫 You are BLOCKED: too many repeated logs. Admin has been notified.', C.red)
            } else if (repeatCount >= 3) {
              await supabase.from('teacher_warnings').insert([{
                teacher_name: form.teacher_name,
                staff_id: form.staff_id || null,
                warning_type: 'final_warning',
                message: `⛔ Final Warning: ${repeatCount} repeated logs in a row. Next repeat = block.`,
                similarity_score: Math.round(maxSim * 100),
                log_id: Number(logId),
                created_at: new Date().toISOString(),
              }])
              showToast('⛔ FINAL WARNING: repeated content detected. One more = blocked.', C.red)
            } else {
              await supabase.from('teacher_warnings').insert([{
                teacher_name: form.teacher_name,
                staff_id: form.staff_id || null,
                warning_type: 'warning',
                message: `⚠️ Warning ${repeatCount+1}: Log content too similar to previous logs.`,
                similarity_score: Math.round(maxSim * 100),
                log_id: Number(logId),
                created_at: new Date().toISOString(),
              }])
              showToast(`⚠️ Warning ${repeatCount+1}/3: Log content looks copied. Write original content.`, C.amber)
            }
          } else if (warned) {
            await supabase.from('teaching_logs').update({
              lazy_score: Math.round(maxSim * 100),
            }).eq('id', logId)
            showToast('💡 Tip: Your log looks similar to recent ones. Try to be more specific.', C.amber)
          } else {
            const excellent = isExcellentLog({ ...logPayload, ...form })
            if (excellent) {
              await supabase.from('teaching_logs').update({ excellence_flag: true }).eq('id', logId)
            }
          }
        } else {
          const excellent = isExcellentLog({ ...logPayload, ...form })
          if (excellent) {
            await supabase.from('teaching_logs').update({ excellence_flag: true }).eq('id', logId)
          }
        }
      } catch(e) { console.warn('Similarity check failed:', e.message) }

      // ── Practice questions ────────────────────────────────────────────────
      // FIX 8: error handling added
      if ((form.practice_questions || []).length) {
        const pqs = form.practice_questions.map((q, i) => ({
          log_id: Number(logId),
          batch_id: form.batch_id || null,
          course: form.course, subject_name: form.subject_name,
          chapter: chapterFinal || null, subtopic: subtopicFinal || null,
          question_text: q.question_text, answer: q.answer || null,
          difficulty: q.difficulty || 'Medium', order_no: q.order_no || i+1,
          options: q.options?.length ? JSON.stringify(q.options) : null,
        }))
        const { error: pqError } = await supabase.from('practice_questions').insert(pqs)
        if (pqError) {
          showToast(`⚠️ ${pqs.length} practice question(s) could not be saved: ${pqError.message}`, C.amber)
          // non-fatal — continue saving the rest
        }
      }

      // ── Doubt session ─────────────────────────────────────────────────────
      if (form.needs_doubt_session && (form.assigned_hm_id || form.assigned_hm_name)) {
        const focusNames = students.filter(s => (form.focus_student_ids||[]).includes(s.id)).map(s => s.name)

        const subLower = form.subject_name.toLowerCase()
        const batchLower = (form.subtype||'').toLowerCase()
        const mapMatch = DOUBT_SESSION_MAP.find(d =>
          batchLower.includes(d.batch.toLowerCase().split(' ')[0]) &&
          (subLower.includes(d.subject.toLowerCase()) || d.subject.toLowerCase().includes(subLower.split(' ')[0]))
        )

        // FIX 6: teacher's explicit selection takes priority over map suggestion
        // assigned_hm_name is always set by the teacher's picker — use it directly.
        // Map is only used as a fallback for slot if teacher left slot blank.
        const resolvedHM   = form.assigned_hm_name || mapMatch?.hm  || null
        const resolvedSlot = form.doubt_time_slot   || mapMatch?.slot || null

        const sessionRow = {
          log_id: Number(logId),
          course: form.course,
          subtype: form.subtype || null,
          class_name: form.class_name || null,
          subject_name: form.subject_name,
          topic: form.topic_taught,
          teaching_date: form.teaching_date,
          teacher_name: form.teacher_name || null,
          teacher_staff_id: form.staff_id && /^\d+$/.test(String(form.staff_id)) ? Number(form.staff_id) : null,
          house_name: null,
          hm_id: null,
          hm_name: resolvedHM,
          status: 'open',
          batch_name: form.subtype || null,
          staff_name: form.teacher_name || null,
          student_name: null,
          is_read: false,
          batch_id: form.batch_id || null,
          teacher_instructions: form.hm_instruction_message || null,
          key_concepts: form.key_concepts || null,
          technique_avoid: form.technique_avoid || null,
          ai_questions_for_hm: null,
          focus_student_ids: form.focus_student_ids?.length ? JSON.stringify(form.focus_student_ids) : null,
          focus_student_names: focusNames.length ? JSON.stringify(focusNames) : null,
          doubt_date: form.doubt_date || null,
          doubt_time_slot: resolvedSlot,
        }

        const { error: dsError } = await supabase.from('doubt_sessions').insert([sessionRow])
        if (dsError) {
          showToast('Doubt session error: ' + dsError.message, C.red)
          console.error('doubt_sessions insert error:', dsError)
          // FIX 7: do NOT insert notification if doubt session failed
        } else {
          // FIX 7: only notify after a successful doubt_sessions insert
          await supabase.from('hm_notifications').insert([{
            log_id: Number(logId),
            hm_staff_id: null,
            hm_name: resolvedHM,
            message: `📚 Doubt session needed: ${form.subject_name} — ${chapterFinal} (${form.subtype||form.course}) | 🕐 ${resolvedSlot || ''}`,
            instructions: form.hm_instruction_message || null,
            key_concepts: form.key_concepts || null,
            technique_avoid: form.technique_avoid || null,
            focus_student_names: focusNames.length ? JSON.stringify(focusNames) : null,
            status: 'unread',
            created_at: new Date().toISOString(),
          }])
        }
      }

      const excellent = isExcellentLog({ ...logPayload, ...form })
      if (excellent) {
        showToast('🌟 Excellent log! Your preparation and detail are outstanding. Keep it up!', C.green)
      }

      // FIX 11: suppress spot-check if log is already copy-paste flagged
      if (!isCopyPasteFlagged) {
        const randomQ = SPOT_CHECK_QUESTIONS[Math.floor(Math.random() * SPOT_CHECK_QUESTIONS.length)]
        setSpotCheck({ logId, question: randomQ })
      } else {
        // copy-paste flagged: skip spot-check, just clean up
        clearDraft()
        setHasDraft(false)
        setForm({ ...emptyForm })
        setStep(0)
        gpsCheckedRef.current = false
        onSaved?.()
      }
    } catch (e) {
      showToast('Unexpected error: ' + e.message, C.red)
    } finally {
      setSaving(false)
      setConfirm(false)
      savingRef.current = false
    }
  }

  // FIX 10: discardDraft resets all warning/GPS state too
  const discardDraft = () => {
    clearDraft()
    setHasDraft(false)
    setDraftPeriodStaleWarn(false)
    setDupWarn('')
    setAttWarn(false)
    setGpsStatus('idle')
    setGpsDistance(null)
    gpsCheckedRef.current = false
    setForm({ ...emptyForm })
    setStep(0)
  }

  return (
    <>
      <style>{css}</style>
      {toastEl}
      {spotCheck && (
        <SpotCheckModal
          question={spotCheck.question}
          onSubmit={handleSpotSubmit}
          onSkip={handleSpotSkip}
        />
      )}
      {confirm && (
        <ConfirmModal
          title="Save Teaching Log"
          msg={`Save log for ${form.subject_name} on ${form.teaching_date}?${form.needs_doubt_session ? ' HM will be notified instantly.' : ''}${new Date().getHours() >= 21 ? ' ⚠️ This log will be flagged as LATE SUBMISSION (after 9 PM).' : ''}`}
          confirmLabel="Save Log"
          onConfirm={handleSave}
          onCancel={() => setConfirm(false)}
        />
      )}

      <div style={S.card}>
        {/* Draft banner */}
        {hasDraft && step === 0 && (
          <div style={{ padding:'10px 14px', background:'#fef9c3', border:'1px solid #fde68a', borderRadius:8, marginBottom:14, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
            <span style={{ fontSize:13, fontWeight:600, color:'#92400e' }}>📝 Draft restored — continue where you left off.</span>
            <button type="button" onClick={discardDraft} style={{ fontSize:12, color:'#dc2626', background:'none', border:'none', cursor:'pointer', fontWeight:700 }}>✕ Discard Draft</button>
          </div>
        )}

        {/* FIX 9: stale period warning */}
        {draftPeriodStaleWarn && step === 0 && (
          <div style={{ padding:'10px 14px', background:'#fee2e2', border:'1px solid #fecaca', borderRadius:8, marginBottom:14, fontSize:13, fontWeight:600, color:C.red }}>
            🔒 Your draft has Period {form.period_number} selected, which is now locked. Please select a different period before proceeding.
          </div>
        )}

        <StepBar current={step} steps={STEPS} onChange={setStep}/>

        {dupWarn && (
          <div style={{ padding:'10px 14px', background:'#fee2e2', border:'1px solid #fecaca', borderRadius:8, color:C.red, fontSize:13, marginBottom:14, fontWeight:600 }}>{dupWarn}</div>
        )}
        {attWarn && (
          <div style={{ padding:'10px 14px', background:'#fee2e2', border:'1px solid #fecaca', borderRadius:8, marginBottom:14, fontSize:13, fontWeight:600, color:C.red }}>
            ⚠️ Attendance not marked for <strong>{form.subtype} ({form.course})</strong> on <strong>{form.teaching_date}</strong>. Please mark attendance first before logging.
          </div>
        )}
        {gpsStatus === 'checking' && (
          <div style={{ padding:'10px 14px', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:8, marginBottom:14, fontSize:13, fontWeight:600, color:C.navy }}>
            📍 Checking your location...
          </div>
        )}
        {gpsStatus === 'denied' && (
          <div style={{ padding:'10px 14px', background:'#fee2e2', border:'1px solid #fecaca', borderRadius:8, marginBottom:14, fontSize:13, fontWeight:600, color:C.red }}>
            🚫 You are {gpsDistance}m away from campus. Teaching logs can only be submitted from within {SCHOOL_RADIUS_M}m of GNSI Campus.
          </div>
        )}
        {gpsStatus === 'error' && (
          <div style={{ padding:'10px 14px', background:'#fee2e2', border:'1px solid #fecaca', borderRadius:8, marginBottom:14, fontSize:13, fontWeight:600, color:C.red }}>
            ❌ Location access denied. Please enable GPS and allow location permission to submit logs.
          </div>
        )}
        {gpsStatus === 'allowed' && (
          <div style={{ padding:'10px 14px', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, marginBottom:14, fontSize:13, fontWeight:600, color:C.green }}>
            ✅ On campus ({gpsDistance}m from centre) — location verified.
          </div>
        )}
        {attemptedNext && <ValidationMessage form={form} step={step} staff={staff}/>}

        {step === 0 && <Step1CourseChapter form={form} setForm={setForm} courseData={courseData} chapters={chapters} loadingChapters={loadingChapters} staff={staff}/>}
        {step === 1 && <Step2WhatTaught form={form} setForm={setForm}/>}
        {step === 2 && <Step3Technique form={form} setForm={setForm}/>}
        {step === 3 && <Step4BulkQuestions form={form} setForm={setForm}/>}
        {step === 4 && <Step5HMAssign form={form} setForm={setForm} staff={staff} students={students} loadingStudents={loadingStudents}/>}
        {step === 5 && <StepReview form={form}/>}

        <div style={{ display:'flex', justifyContent:'space-between', marginTop:24, paddingTop:16, borderTop:'1px solid #f1f5f9', flexWrap:'wrap', gap:10 }}>
          <button type="button" onClick={() => { setAttemptedNext(false); setStep(s => Math.max(0, s-1)) }} disabled={step === 0} style={{ ...S.btn('#94a3b8', step===0), background:'white', color: step===0?'#cbd5e1':'#374151', border:'1px solid #e2e8f0' }}>← Back</button>
          <div style={{ display:'flex', gap:8 }}>
            {step === 3 && (
              <button type="button" onClick={() => setStep(s => s+1)} style={{ ...S.btn('#64748b'), background:'white', color:'#64748b', border:'1px solid #e2e8f0' }}>Skip →</button>
            )}
            {step < STEPS.length - 1
              ? <button type="button" onClick={handleNext} disabled={!canNext()} style={S.btn(C.navy, !canNext())}>Next →</button>
              : <button type="button" onClick={() => setConfirm(true)} disabled={saving} style={S.btn(C.green, saving)}>{saving ? '⏳ Saving...' : '✅ Save Log'}</button>
            }
          </div>
        </div>
      </div>
    </>
  )
}

export default EnhancedLogForm

// ─────────────────────────────────────────────────────────────────────────────
// HM Doubt Session Panel
// FIX 12: window.confirm/prompt replaced with inline React modals
// FIX 13: print hide delay replaced with afterprint event listener
// ─────────────────────────────────────────────────────────────────────────────

// ─── Inline confirmation modal used by HMDoubtSessionPanel ───────────────────
// FIX 12: replaces window.confirm()
function InlineConfirm({ msg, confirmLabel='Confirm', confirmColor=C.red, onConfirm, onCancel }) {
  return (
    <div style={{ margin:'10px 0', padding:'14px 16px', background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:10 }}>
      <div style={{ fontSize:13, color:'#7f1d1d', fontWeight:600, marginBottom:10, lineHeight:1.6 }}>{msg}</div>
      <div style={{ display:'flex', gap:8 }}>
        <button type="button" onClick={onConfirm}
          style={{ backgroundColor:confirmColor, color:'white', border:'none', borderRadius:7, padding:'7px 16px', fontWeight:700, cursor:'pointer', fontSize:12 }}>
          {confirmLabel}
        </button>
        <button type="button" onClick={onCancel}
          style={{ background:'white', color:'#374151', border:'1px solid #d1d5db', borderRadius:7, padding:'7px 14px', fontWeight:600, cursor:'pointer', fontSize:12 }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Inline text prompt used by HMDoubtSessionPanel ──────────────────────────
// FIX 12: replaces window.prompt()
function InlinePrompt({ label, placeholder, onSubmit, onCancel }) {
  const [val, setVal] = useState('')
  return (
    <div style={{ margin:'10px 0', padding:'14px 16px', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10 }}>
      <div style={{ fontSize:12, fontWeight:700, color:C.navy, marginBottom:8 }}>{label}</div>
      <textarea
        autoFocus
        value={val}
        onChange={e => setVal(e.target.value)}
        rows={3}
        style={{ width:'100%', padding:'8px 10px', borderRadius:7, border:'1px solid #93c5fd', fontSize:13, boxSizing:'border-box', resize:'vertical', fontFamily:'inherit' }}
        placeholder={placeholder}
      />
      <div style={{ display:'flex', gap:8, marginTop:8 }}>
        <button type="button" onClick={() => val.trim() && onSubmit(val.trim())} disabled={!val.trim()}
          style={{ backgroundColor: val.trim() ? C.navy : '#94a3b8', color:'white', border:'none', borderRadius:7, padding:'7px 16px', fontWeight:700, cursor: val.trim() ? 'pointer' : 'not-allowed', fontSize:12 }}>
          Send
        </button>
        <button type="button" onClick={onCancel}
          style={{ background:'white', color:'#374151', border:'1px solid #d1d5db', borderRadius:7, padding:'7px 14px', fontWeight:600, cursor:'pointer', fontSize:12 }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

export function HMDoubtSessionPanel({ session, onFeedback, currentUser }) {
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [showStudents, setShowStudents] = useState(false)
  const [students, setStudents] = useState([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [messages, setMessages] = useState([])
  const [msgText, setMsgText] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)
  const [logDetail, setLogDetail] = useState(null)
  const [showLog, setShowLog] = useState(false)
  const { show: showToast, el: toastEl } = useToast()

  // FIX 12: inline UI state replacing window.confirm / window.prompt
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [promptState, setPromptState] = useState(null) // { studentName } | null

  // ─── Data loading ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!session.id) return
    supabase
      .from('hm_notifications')
      .select('*')
      .eq('log_id', session.log_id)
      .order('created_at', { ascending: true })
      .then(({ data }) => setMessages(data || []))

    if (session.log_id) {
      supabase
        .from('teaching_logs')
        .select('*')
        .eq('id', session.log_id)
        .single()
        .then(({ data }) => setLogDetail(data))
    }
  }, [session.id, session.log_id])

  const fetchStudents = async () => {
    if (!session.batch_id && !session.subtype) return
    setLoadingStudents(true)
    const q = supabase.from('students').select('id,name,roll_number').eq('status', 'Active')
    if (session.subtype) q.eq('batch', session.subtype)
    if (session.course)  q.eq('course', session.course)
    const { data } = await q.order('name')
    if (data) setStudents(data)
    setLoadingStudents(false)
  }

  // ─── Actions ───────────────────────────────────────────────────────────────

  const sendMessage = async () => {
    if (!msgText.trim()) return
    setSendingMsg(true)
    const row = {
      log_id: session.log_id,
      hm_staff_id: currentUser?.id || null,
      hm_name: currentUser?.name || 'HM',
      message: `💬 ${currentUser?.name || 'HM'}: ${msgText}`,
      status: 'thread',
      created_at: new Date().toISOString(),
    }
    await supabase.from('hm_notifications').insert([row])
    setMessages(m => [...m, row])
    setMsgText('')
    setSendingMsg(false)
    showToast('Message sent ✓', C.sky)
  }

  const notifyTeacher = async (studentName, doubtDetail) => {
    if (!doubtDetail) return
    const msg = `🏠 HM (${currentUser?.name || 'HM'}): Student "${studentName}" — ${doubtDetail}`
    const row = {
      log_id: session.log_id,
      hm_staff_id: currentUser?.id || null,
      hm_name: currentUser?.name || 'HM',
      message: msg,
      status: 'teacher_alert',
      created_at: new Date().toISOString(),
    }
    await supabase.from('hm_notifications').insert([row])
    setMessages(m => [...m, row])
    showToast('Teacher notified ✓', C.green)
  }

  const handleNotConducted = async () => {
    setSending(true)
    const { error: e1 } = await supabase
      .from('doubt_sessions')
      .update({
        status: 'not_conducted',
        resolved_by: currentUser?.name || 'HM',
        resolved_at: new Date().toISOString(),
        resolution_note: 'Doubt session was not conducted.',
      })
      .eq('id', session.id)
    if (e1) { showToast('Error: ' + e1.message, C.red); setSending(false); return }
    if (session.log_id) {
      await supabase
        .from('teaching_logs')
        .update({
          hm_verified: false,
          hm_verified_at: new Date().toISOString(),
          hm_verified_by: currentUser?.name || 'HM',
        })
        .eq('id', session.log_id)
    }
    showToast('⚠️ Marked as not conducted — teaching log flagged.', C.amber)
    onFeedback?.()
    setSending(false)
  }

  const handleFeedback = async () => {
    if (!note.trim()) { showToast('Enter resolution note', C.amber); return }
    setSending(true)
    const { error } = await supabase
      .from('doubt_sessions')
      .update({
        status: 'resolved',
        resolved_by: currentUser?.name || 'HM',
        resolved_at: new Date().toISOString(),
        resolution_note: note,
      })
      .eq('id', session.id)
    if (error) { showToast('Error: ' + error.message, C.red); setSending(false); return }
    if (session.log_id) {
      await supabase
        .from('teaching_logs')
        .update({
          hm_verified: true,
          hm_verified_at: new Date().toISOString(),
          hm_verified_by: currentUser?.name || 'HM',
        })
        .eq('id', session.log_id)
    }
    const resRow = {
      log_id: session.log_id,
      hm_staff_id: currentUser?.id || null,
      hm_name: currentUser?.name || 'HM',
      message: `✅ Resolved by ${currentUser?.name || 'HM'}: ${note}`,
      status: 'resolved',
      created_at: new Date().toISOString(),
    }
    await supabase.from('hm_notifications').insert([resRow])
    setMessages(m => [...m, resRow])
    showToast('✅ Doubt session resolved & log verified.', C.green)
    onFeedback?.()
    setSending(false)
  }

  // FIX 12: delete now uses InlineConfirm, not window.confirm
  const handleDeleteConfirmed = async () => {
    setDeleteConfirmOpen(false)
    setSending(true)
    await supabase.from('hm_notifications').delete().eq('log_id', session.log_id)
    await supabase.from('doubt_sessions').delete().eq('id', session.id)
    showToast('Doubt session deleted.', C.red)
    onFeedback?.()
    setSending(false)
  }

  // FIX 13: print using afterprint event to restore hidden elements reliably
  const handlePrint = () => {
    const printArea = document.getElementById(`hm-print-area-${session.id}`)
    const printHead = document.getElementById(`hm-print-head-${session.id}`)
    const signRow   = document.getElementById(`hm-sign-row-${session.id}`)
    const noprints  = printArea?.querySelectorAll('.hm-no-print')

    const restore = () => {
      if (printHead) printHead.style.display = 'none'
      if (signRow)   signRow.style.display   = 'none'
      if (noprints)  noprints.forEach(el => el.removeAttribute('data-hidden'))
      window.removeEventListener('afterprint', restore)
    }

    if (printHead) printHead.style.display = 'block'
    if (signRow)   signRow.style.display   = 'flex'
    if (noprints)  noprints.forEach(el => el.setAttribute('data-hidden', '1'))

    // FIX 13: listen for afterprint — fires after the print dialog closes
    window.addEventListener('afterprint', restore)
    window.print()
  }

  // ─── Derived display values ────────────────────────────────────────────────

  const statusColor = { open: '#fde68a', resolved: '#bbf7d0', not_conducted: '#fecaca' }
  const statusLabel = { open: '⏳ Open', resolved: '✅ Resolved', not_conducted: '❌ Not Conducted' }

  const focusNames = (() => {
    try { return JSON.parse(session.focus_student_names || '[]') } catch { return [] }
  })()

  const log = logDetail

  const printCss = `
    .hm-print-only-tables { display: none; }

    @media print {
      body * { visibility: hidden !important; }
      #hm-print-area-${session.id},
      #hm-print-area-${session.id} * { visibility: visible !important; }
      #hm-print-area-${session.id} {
        position: fixed; top: 0; left: 0;
        width: 100%; padding: 28px 32px;
        font-family: Georgia, serif;
        font-size: 13px; color: #000 !important;
        background: white !important;
      }
      [data-hidden] { display: none !important; }
      .hm-print-only-tables { display: block !important; }
      .hm-print-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
      .hm-print-table td { padding: 7px 10px; border: 1px solid #ccc; vertical-align: top; }
      .hm-print-label { font-weight: bold; background: #f0f0f0; width: 32%; }
      .hm-instr-navy  { background: #e8edf4 !important; border-left: 3px solid #1e3a5f; padding: 10px 14px; margin-bottom: 10px; }
      .hm-instr-green { background: #f0fdf4 !important; border-left: 3px solid #16a34a; padding: 10px 14px; margin-bottom: 10px; }
      .hm-instr-red   { background: #fee2e2 !important; border-left: 3px solid #dc2626; padding: 10px 14px; margin-bottom: 10px; }
      .hm-section-title { font-weight: bold; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 4px; }
    }
  `

  const field = (label, value) => (
    <div style={{ flex: '1 1 160px', background: '#f8fafc', borderRadius: 8, padding: '10px 14px', border: '1px solid #e2e8f0' }}>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{value || '—'}</div>
    </div>
  )

  const textBlock = (label, value) => value ? (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#1e293b', lineHeight: 1.7, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>{value}</div>
    </div>
  ) : null

  return (
    <>
      <style>{printCss}</style>
      {toastEl}

      <div style={{ border: `2px solid ${statusColor[session.status] || '#fde68a'}`, borderRadius: 14, padding: 20, background: '#fffbeb', marginBottom: 12 }}>

        {/* ── Card header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#1e293b' }}>
              🏠 {session.house_name || session.batch_name || '—'} · {session.subject_name}
            </div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
              📖 {session.topic} · {fmtDate(session.teaching_date)}
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>
              Teacher: {session.teacher_name || '—'}
            </div>
            {(session.doubt_date || session.doubt_time_slot) && (
              <div style={{ fontSize: 12, color: '#7c3aed', marginTop: 4, fontWeight: 700 }}>
                📅 {session.doubt_date ? fmtDate(session.doubt_date) : '—'}
                {session.doubt_time_slot && <span style={{ marginLeft: 8 }}>🕐 {session.doubt_time_slot}</span>}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <span style={S.badge(
              session.status === 'resolved' ? '#166534' : session.status === 'not_conducted' ? C.red : '#b45309',
              statusColor[session.status] || '#fef9c3'
            )}>
              {statusLabel[session.status] || '⏳ Open'}
            </span>
            {/* FIX 12: admin delete button now opens InlineConfirm */}
            {currentUser?.role === 'admin' && (
              <button type="button" onClick={() => setDeleteConfirmOpen(true)} disabled={sending}
                style={{ fontSize: 11, fontWeight: 700, color: C.red, background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>
                🗑 Delete
              </button>
            )}
          </div>
        </div>

        {/* FIX 12: inline delete confirmation */}
        {deleteConfirmOpen && (
          <InlineConfirm
            msg="Delete this doubt session permanently? This cannot be undone."
            confirmLabel="Yes, delete"
            confirmColor={C.red}
            onConfirm={handleDeleteConfirmed}
            onCancel={() => setDeleteConfirmOpen(false)}
          />
        )}

        {/* ── Toggle + Print buttons ── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setShowLog(v => !v)}
            style={{ ...S.btnSm(C.navy), flex: 1, textAlign: 'left' }}>
            📋 {showLog ? 'Hide' : 'View'} today's teaching log
          </button>
          {log && (
            <button type="button" onClick={handlePrint}
              style={{ ...S.btnSm('#7c3aed'), display: 'flex', alignItems: 'center', gap: 5 }}>
              🖨️ Print log
            </button>
          )}
        </div>

        {/* ══ PRINTABLE AREA ═══════════════════════════════════════════════════ */}
        <div id={`hm-print-area-${session.id}`}>

          {/* Print-only header */}
          <div id={`hm-print-head-${session.id}`} style={{ display: 'none' }}>
            <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: 12, marginBottom: 20 }}>
              <div style={{ fontSize: 19, fontWeight: 'bold' }}>GNSI — Teaching log (HM copy)</div>
              <div style={{ fontSize: 12, color: '#444', marginTop: 4 }}>
                {session.subject_name} · {session.batch_name || session.course} · {fmtDate(session.teaching_date)}
                {session.doubt_time_slot && ` · Doubt session: ${session.doubt_time_slot}`}
              </div>
            </div>
          </div>

          {/* Screen-only expanded log body */}
          {(showLog && log) && (
            <div className="hm-no-print" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>Class details</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                {field('Teacher', log.teacher_name)}
                {field('Subject', log.subject_name)}
                {field('Batch', `${log.course} / ${log.subtype}`)}
                {field('Date', fmtDate(log.teaching_date))}
                {field('Period', log.period_number ? `Period ${log.period_number}` : null)}
                {field('Range covered', log.range_from ? `${log.range_from} → ${log.range_to}` : null)}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                {field('Chapter', log.chapter)}
                {field('Sub-topic', log.subtopic)}
              </div>
              <div style={{ height: 1, background: '#e2e8f0', marginBottom: 14 }}/>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>What was taught</div>
              {textBlock('Topic taught', log.topic_taught)}
              {textBlock('Classwork done', log.classwork)}
              {textBlock('Homework assigned', log.homework)}
              {textBlock('Remarks / observations', log.remarks)}
              {log.techniques && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Teaching methods used</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {log.techniques.split(',').map((t, i) => (
                      <span key={i} style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: '#eff6ff', color: '#1e3a5f' }}>
                        {t.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Instruction boxes */}
          <div className={!showLog ? 'hm-no-print' : ''}>
            {session.teacher_instructions && (
              <div className="hm-instr-navy" style={{ padding: '12px 14px', background: '#1e3a5f', borderRadius: 10, marginBottom: 10, color: 'white' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#93c5fd', marginBottom: 6, letterSpacing: '.08em' }}>📋 SUBJECT TEACHER'S INSTRUCTIONS</div>
                <div style={{ fontSize: 13, lineHeight: 1.8, color: '#e2e8f0' }}>{session.teacher_instructions}</div>
              </div>
            )}
            {session.key_concepts && (
              <div className="hm-instr-green" style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', marginBottom: 4 }}>✅ KEY CONCEPTS TO EMPHASISE</div>
                <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7 }}>{session.key_concepts}</div>
              </div>
            )}
            {session.technique_avoid && (
              <div className="hm-instr-red" style={{ padding: '10px 14px', background: '#fff1f2', border: '1px solid #fecaca', borderRadius: 8, marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', marginBottom: 4 }}>🚫 DO NOT DO THIS</div>
                <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7 }}>{session.technique_avoid}</div>
              </div>
            )}
          </div>

          {/* Doubt session details */}
          <div className={!showLog ? 'hm-no-print' : ''}>
            {(session.doubt_date || session.doubt_time_slot || session.hm_name) && (
              <>
                <div style={{ height: 1, background: '#e2e8f0', marginBottom: 14, marginTop: 4 }}/>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>Doubt session</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {field('Assigned HM', session.hm_name)}
                  {field('Date', session.doubt_date ? fmtDate(session.doubt_date) : null)}
                  {field('Time slot', session.doubt_time_slot)}
                </div>
              </>
            )}
          </div>

          {/* Focus students */}
          {focusNames.length > 0 && (
            <div className={!showLog ? 'hm-no-print' : ''} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#b45309', marginBottom: 6 }}>⚠️ FOCUS ON THESE STUDENTS</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {/* FIX 12: clicking student opens InlinePrompt instead of window.prompt */}
                {focusNames.map((n, i) => (
                  <button key={i} type="button"
                    onClick={() => setPromptState({ studentName: n })}
                    style={{ ...S.badge('#b45309', '#fef9c3'), cursor: 'pointer' }}>
                    {n} 📨
                  </button>
                ))}
              </div>
              {/* FIX 12: inline prompt appears below focus students list */}
              {promptState && (
                <InlinePrompt
                  label={`Doubt / issue for ${promptState.studentName}:`}
                  placeholder="Describe the student's doubt or difficulty..."
                  onSubmit={async (detail) => {
                    await notifyTeacher(promptState.studentName, detail)
                    setPromptState(null)
                  }}
                  onCancel={() => setPromptState(null)}
                />
              )}
            </div>
          )}

          {/* Print-only full detail table */}
          {log && (
            <div className="hm-print-only-tables">
              <table className="hm-print-table">
                <tbody>
                  <tr><td className="hm-print-label">Teacher</td><td>{log.teacher_name || '—'}</td><td className="hm-print-label">Date</td><td>{fmtDate(log.teaching_date)}</td></tr>
                  <tr><td className="hm-print-label">Subject</td><td>{log.subject_name}</td><td className="hm-print-label">Batch</td><td>{log.course} / {log.subtype}</td></tr>
                  <tr><td className="hm-print-label">Chapter</td><td>{log.chapter || '—'}</td><td className="hm-print-label">Sub-topic</td><td>{log.subtopic || '—'}</td></tr>
                  <tr><td className="hm-print-label">Range covered</td><td colSpan={3}>{log.range_from ? `${log.range_from} → ${log.range_to}` : '—'}</td></tr>
                </tbody>
              </table>
              <table className="hm-print-table">
                <tbody>
                  <tr><td className="hm-print-label">Topic taught</td><td>{log.topic_taught || '—'}</td></tr>
                  <tr><td className="hm-print-label">Classwork done</td><td>{log.classwork || '—'}</td></tr>
                  <tr><td className="hm-print-label">Homework assigned</td><td>{log.homework || '—'}</td></tr>
                  <tr><td className="hm-print-label">Remarks / observations</td><td>{log.remarks || '—'}</td></tr>
                  <tr><td className="hm-print-label">Techniques used</td><td>{log.techniques || '—'}</td></tr>
                </tbody>
              </table>
              {focusNames.length > 0 && (
                <table className="hm-print-table">
                  <tbody>
                    <tr><td className="hm-print-label">Focus students</td><td>{focusNames.join(', ')}</td></tr>
                    {session.doubt_date && <tr><td className="hm-print-label">Doubt date</td><td>{fmtDate(session.doubt_date)}</td></tr>}
                    {session.doubt_time_slot && <tr><td className="hm-print-label">Time slot</td><td>{session.doubt_time_slot}</td></tr>}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Print-only signature row */}
          <div id={`hm-sign-row-${session.id}`} style={{ display: 'none', justifyContent: 'space-between', marginTop: 40 }}>
            {[
              ['Subject teacher', log?.teacher_name || ''],
              ['Housemaster', session.hm_name || ''],
              ['Principal / Admin', ''],
            ].map(([role, name]) => (
              <div key={role} style={{ borderTop: '1px solid #000', paddingTop: 6, width: 160, textAlign: 'center', fontSize: 12 }}>
                {role}{name ? <><br />{name}</> : null}
              </div>
            ))}
          </div>

        </div>
        {/* end #hm-print-area */}

        {/* ── Batch students toggle ── */}
        <div style={{ marginBottom: 12 }}>
          <button type="button"
            onClick={() => { setShowStudents(!showStudents); if (!students.length) fetchStudents() }}
            style={S.btnSm('#94a3b8')}>
            👥 {showStudents ? 'Hide' : 'View'} batch students
          </button>
        </div>
        {showStudents && (
          <div style={{ marginBottom: 12, padding: 10, background: 'white', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            {loadingStudents
              ? <div style={{ fontSize: 12, color: '#94a3b8' }}>Loading...</div>
              : students.length === 0
                ? <div style={{ fontSize: 12, color: '#94a3b8' }}>No students found.</div>
                : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {students.map(s => (
                      <button key={s.id} type="button"
                        // FIX 12: batch students also use InlinePrompt
                        onClick={() => setPromptState({ studentName: s.name })}
                        style={S.pill('#1e293b', '#f1f5f9')}>
                        {s.name} 📨
                      </button>
                    ))}
                  </div>
                )
            }
          </div>
        )}

        {/* ── Communication thread ── */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            💬 Communication thread
          </div>
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: 10, maxHeight: 200, overflowY: 'auto', marginBottom: 8 }}>
            {messages.length === 0
              ? <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '12px 0' }}>No messages yet.</div>
              : messages.map((m, i) => (
                <div key={i} style={{
                  padding: '7px 10px', marginBottom: 6, borderRadius: 8, fontSize: 12, lineHeight: 1.6,
                  background: m.status === 'resolved' ? '#f0fdf4' : m.status === 'teacher_alert' ? '#eff6ff' : m.status === 'thread' ? '#f8fafc' : '#fffbeb',
                  borderLeft: `3px solid ${m.status === 'resolved' ? C.green : m.status === 'teacher_alert' ? C.navy : m.status === 'thread' ? C.sky : C.amber}`,
                }}>
                  <div style={{ color: '#1e293b' }}>{m.message}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                    {new Date(m.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))
            }
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={msgText}
              onChange={e => setMsgText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Type a message to teacher..."
              style={{ ...S.input, flex: 1 }}
            />
            <button type="button" onClick={sendMessage} disabled={sendingMsg || !msgText.trim()}
              style={S.btn(C.sky, sendingMsg || !msgText.trim())}>
              Send
            </button>
          </div>
        </div>

        {/* ── Resolution controls ── */}
        {session.status === 'open' && (
          <div style={{ borderTop: '1px solid #fde68a', paddingTop: 14 }}>
            <label style={S.label}>Resolution note</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              style={{ ...S.input, marginBottom: 10, resize: 'vertical' }}
              placeholder="Describe what you covered, which students were helped, what methods you used..."
            />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" onClick={handleFeedback} disabled={sending} style={S.btn(C.green, sending)}>
                {sending ? '⏳ Saving...' : '✅ Mark resolved & notify teacher'}
              </button>
              <button type="button" onClick={handleNotConducted} disabled={sending}
                style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 18px', fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer', fontSize: 13, minHeight: 44 }}>
                ❌ Not conducted
              </button>
            </div>
          </div>
        )}

        {/* ── Resolution note (read-only after resolved) ── */}
        {session.status !== 'open' && session.resolution_note && (
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12, marginTop: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>Resolution note:</div>
            <div style={{ fontSize: 13, color: '#1e293b', lineHeight: 1.7 }}>{session.resolution_note}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
              By {session.resolved_by} · {session.resolved_at ? fmtDate(session.resolved_at) : ''}
            </div>
          </div>
        )}

      </div>
    </>
  )
}