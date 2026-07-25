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
import { EventBus, GNSI_EVENTS } from './EventBus'

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

// 20 short "how you taught it" method reasons — tapping one appends it to
// the field (not overwrite), since a teacher may combine more than one method.
const TEACHING_METHOD_REASONS = [
  'Explained with real-life examples',
  'Used diagrams/visuals on board',
  'Step-by-step demonstration',
  'Socratic questioning (led students to discover)',
  'Group/pair activity',
  'Peer explanation between students',
  'Rapid-fire oral questions',
  'Board work — called students up one by one',
  'Practice drill with timed questions',
  'Started from a common mistake, corrected it',
  'Revision of previous topic first',
  'Used analogy/comparison to familiar concept',
  'Hands-on/practical demonstration',
  'Broke problem into smaller steps',
  'Repetition with increasing difficulty',
  'Storytelling / narrative approach',
  'Compared two methods, let students choose',
  'Focused on weak students individually',
  'Used mnemonics/memory tricks',
  'Quick quiz at the end to check understanding',
]

function TeachingMethodPicker({ value, onChange }) {
  const addReason = (r) => {
    const current = value?.trim() || ''
    if (current.includes(r)) return
    onChange(current ? `${current}. ${r}` : r)
  }
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:6, marginBottom:8 }}>
      {TEACHING_METHOD_REASONS.map((r, i) => (
        <button key={i} type="button" onClick={() => addReason(r)}
          style={{
            fontSize:11, padding:'5px 10px', borderRadius:14, border:'1px solid #bfdbfe',
            background:'#eff6ff', color:C.navy, cursor:'pointer', fontWeight:600,
          }}>
          + {r}
        </button>
      ))}
    </div>
  )
}

// ─── Doubt Session Map (Batch + Subject → HM + Time Slot) ─────────────────────

// SOP: GNSI/ACAD/SOP/13/2026-27 dated 13.07.2026 — Annexure-I
// Main Morning Session — All Batches (Mon–Sat), 10:20 AM to 3:50 PM,
// six teaching periods with tea break fixed at 12:50–1:20 PM.
const PERIODS = [1,2,3,4,5,6]

const PERIOD_TIMES = {
  1: { label:'Period 1 (10:20–11:10 AM)', start:[10,20], end:[11,10] },
  2: { label:'Period 2 (11:10 AM–12:00 PM)', start:[11,10], end:[12,0] },
  3: { label:'Period 3 (12:00–12:50 PM)', start:[12,0],  end:[12,50] },
  // 12:50–1:20 PM — TEA BREAK (SOP Clause 4(ii)). No class shall be extended into this period.
  4: { label:'Period 4 (1:25–2:15 PM)',   start:[13,25], end:[14,15] },
  5: { label:'Period 5 (2:15–3:05 PM)',   start:[14,15], end:[15,5]  },
  6: { label:'Period 6 (3:05–3:50 PM)',   start:[15,5],  end:[15,50] },
}

// SOP Annexures V–IX — Doubt-session / combined-course teacher assignments.
// Each entry's `slot` matches a key in DOUBT_TIME_SLOTS below.
const DOUBT_SESSION_MAP = [
  // ── Annexure-II: Early Morning Combined Course (Navodaya) — 6:30–7:20 AM ──
  { batch:'Lakshya', subject:'Meitei Mayek', hm:'Miss Deviya',  slot:'6:30–7:20 AM (Navodaya MM)' },
  { batch:'Umeed',   subject:'Meitei Mayek', hm:'Miss Deviya',  slot:'6:30–7:20 AM (Navodaya MM)' },
  { batch:'Lakshya', subject:'English Grammar', hm:'Miss Fedrava', slot:'6:30–7:20 AM (Navodaya ENG)' },
  { batch:'Umeed',   subject:'English Grammar', hm:'Miss Fedrava', slot:'6:30–7:20 AM (Navodaya ENG)' },

  // ── Annexure-IV: Evening Combined Course (Navodaya) ──
  { batch:'Lakshya', subject:'Mathematics', hm:'Sir Bronson', slot:'6:00–6:50 PM (Navodaya MM)' },
  { batch:'Umeed',   subject:'Mathematics', hm:'Sir Umesh',   slot:'6:00–6:50 PM (Navodaya ENG)' },
  { batch:'Lakshya', subject:'General Science', hm:'Sir Deepak',  slot:'6:50–7:40 PM (Navodaya MM)' },
  { batch:'Umeed',   subject:'General Science', hm:'Sir Basanta', slot:'6:50–7:40 PM (Navodaya ENG)' },

  // ── Annexure-III: Evening Doubt-Clearing (Sainik Stream) ──
  { batch:'Champion', subject:'General Knowledge', hm:'Sir Shrinivash',  slot:'7:40–8:30 PM (Sainik)' },
  { batch:'Leader',   subject:'General Science',   hm:'Sir Arunkumar',   slot:'7:40–8:30 PM (Sainik)' },
  { batch:'Achiever', subject:'Mathematics',       hm:'Sir Himan',       slot:'7:40–8:30 PM (Sainik)' },
  { batch:'Lakshya',  subject:'General Knowledge', hm:'Sir Himan',       slot:'6:00–7:40 PM Doubt Session (Lakshya/Umeed)' },
  { batch:'Umeed',    subject:'General Knowledge', hm:'Sir Himan',       slot:'6:00–7:40 PM Doubt Session (Lakshya/Umeed)' },
  { batch:'Elite',    subject:'General Knowledge', hm:'Sir Himan',       slot:'6:00–7:40 PM Doubt Session (Elite/Prime)' },
  { batch:'Prime',    subject:'General Knowledge', hm:'Sir Himan',       slot:'6:00–7:40 PM Doubt Session (Elite/Prime)' },

  // ── Annexure-V: Foundation Group (Elite & Prime) — Morning Doubt Session ──
  { batch:'Elite', subject:'English Grammar', hm:'Sir Shrinivash', slot:'6:30–7:20 AM Foundation Doubt (Group A)' },
  { batch:'Prime', subject:'English Grammar', hm:'Sir James',      slot:'6:30–7:20 AM Foundation Doubt (Group B)' },
  { batch:'Elite', subject:'Mathematics',     hm:'Sir James',      slot:'7:20–8:20 AM Foundation Doubt (Group A)' },
  { batch:'Prime', subject:'Mathematics',     hm:'Sir Shrinivash', slot:'7:20–8:20 AM Foundation Doubt (Group B)' },

  // ── Annexure-VI: Foundation Group (Elite & Prime) — Evening Doubt Session ──
  { batch:'Elite', subject:'Reasoning',        hm:'Sir Bidyachandra', slot:'6:00–7:15 PM Foundation Doubt (Group A)' },
  { batch:'Prime', subject:'Reasoning',        hm:'Sir Shrinivash',   slot:'6:00–7:15 PM Foundation Doubt (Group B)' },
  { batch:'Elite', subject:'General Science',  hm:'Sir James',        slot:'7:15–8:30 PM Foundation Doubt (Group A)' },
  { batch:'Prime', subject:'General Science',  hm:'Miss Bidyarani',   slot:'7:15–8:30 PM Foundation Doubt (Group B)' },

  // ── Annexure-VII: Navodaya Group (Lakshya & Umeed) — Morning Doubt Session ──
  { batch:'Lakshya', subject:'General Science', hm:'Sir Adison', slot:'6:30–7:20 AM Navodaya Doubt (Group A)' },
  { batch:'Umeed',   subject:'General Science', hm:'Sir Romesh', slot:'6:30–7:20 AM Navodaya Doubt (Group C)' },
  { batch:'Umeed',   subject:'English Grammar', hm:'Miss Bidyarani', slot:'6:30–7:20 AM Navodaya Doubt (Group B)' },
  { batch:'Lakshya', subject:'Mathematics',     hm:'Miss Deviya',    slot:'7:20–8:20 AM Navodaya Doubt (Group A)' },
  { batch:'Umeed',   subject:'Mathematics',     hm:'Sir Adison',     slot:'7:20–8:20 AM Navodaya Doubt (Group B)' },

  // ── Annexure-VIII: Navodaya Group (Lakshya & Umeed) — Evening Doubt Session ──
  { batch:'Lakshya', subject:'English Grammar', hm:'Miss Deviya',    slot:'6:00–7:15 PM Navodaya Doubt (Group A)' },
  { batch:'Umeed',   subject:'English Grammar', hm:'Miss Bidyarani', slot:'6:00–7:15 PM Navodaya Doubt (Group C)' },
  { batch:'Umeed',   subject:'General Science', hm:'Sir Romesh',     slot:'6:00–7:15 PM Navodaya Doubt (Group B)' },
  { batch:'Lakshya', subject:'Mathematics',     hm:'Sir Adison',     slot:'7:15–8:30 PM Navodaya Doubt (Group A)' },
  { batch:'Umeed',   subject:'Mathematics',     hm:'Sir Bidyachandra', slot:'7:15–8:30 PM Navodaya Doubt (Group B)' },

  // ── Annexure-IX: Sainik Group — Doubt/Class Sessions (Till September) ──
  { batch:'Achiever', subject:'English Grammar', hm:'Sir Bidyachandra', slot:'6:30–7:20 AM Sainik (Till Sep)' },
  { batch:'Leader',   subject:'English Grammar', hm:'Sir Umesh',        slot:'6:30–7:20 AM Sainik (Till Sep)' },
  { batch:'Champion', subject:'English Grammar', hm:'Miss Geetanjali',  slot:'6:30–7:20 AM Sainik (Till Sep)' },
  { batch:'Achiever', subject:'General Science', hm:'Miss Bidyarani',   slot:'7:20–8:10 AM Sainik (Till Sep)' },
  { batch:'Leader',   subject:'General Science', hm:'Miss Geetanjali',  slot:'7:20–8:10 AM Sainik (Till Sep)' },
  { batch:'Champion', subject:'General Science', hm:'Sir Umesh',        slot:'7:20–8:10 AM Sainik (Till Sep)' },
  { batch:'Achiever', subject:'Mathematics',     hm:'Miss Geetanjali',  slot:'6:00–6:50 PM Sainik (Till Sep)' },
  { batch:'Leader',   subject:'Mathematics',     hm:'Miss Fedrava',     slot:'6:00–6:50 PM Sainik (Till Sep)' },
  { batch:'Champion', subject:'Mathematics',     hm:'Sir James',        slot:'6:00–6:50 PM Sainik (Till Sep)' },
  { batch:'Achiever', subject:'Reasoning',       hm:'Sir Umesh',        slot:'6:50–7:40 PM Sainik (Till Sep)' },
  { batch:'Leader',   subject:'Reasoning',       hm:'Miss Geetanjali',  slot:'6:50–7:40 PM Sainik (Till Sep)' },
  { batch:'Champion', subject:'Reasoning',       hm:'Miss Fedrava',     slot:'6:50–7:40 PM Sainik (Till Sep)' },
]

const DOUBT_TIME_SLOTS = [
  '6:30–7:20 AM (Navodaya MM)',
  '6:30–7:20 AM (Navodaya ENG)',
  '6:00–6:50 PM (Navodaya MM)',
  '6:00–6:50 PM (Navodaya ENG)',
  '6:50–7:40 PM (Navodaya MM)',
  '6:50–7:40 PM (Navodaya ENG)',
  '7:40–8:30 PM (Sainik)',
  '6:00–7:40 PM Doubt Session (Lakshya/Umeed)',
  '6:00–7:40 PM Doubt Session (Elite/Prime)',
  '6:30–7:20 AM Foundation Doubt (Group A)',
  '6:30–7:20 AM Foundation Doubt (Group B)',
  '7:20–8:20 AM Foundation Doubt (Group A)',
  '7:20–8:20 AM Foundation Doubt (Group B)',
  '6:00–7:15 PM Foundation Doubt (Group A)',
  '6:00–7:15 PM Foundation Doubt (Group B)',
  '7:15–8:30 PM Foundation Doubt (Group A)',
  '7:15–8:30 PM Foundation Doubt (Group B)',
  '6:30–7:20 AM Navodaya Doubt (Group A)',
  '6:30–7:20 AM Navodaya Doubt (Group B)',
  '6:30–7:20 AM Navodaya Doubt (Group C)',
  '7:20–8:20 AM Navodaya Doubt (Group A)',
  '7:20–8:20 AM Navodaya Doubt (Group B)',
  '6:00–7:15 PM Navodaya Doubt (Group A)',
  '6:00–7:15 PM Navodaya Doubt (Group B)',
  '6:00–7:15 PM Navodaya Doubt (Group C)',
  '7:15–8:30 PM Navodaya Doubt (Group A)',
  '7:15–8:30 PM Navodaya Doubt (Group B)',
  '6:30–7:20 AM Sainik (Till Sep)',
  '7:20–8:10 AM Sainik (Till Sep)',
  '6:00–6:50 PM Sainik (Till Sep)',
  '6:50–7:40 PM Sainik (Till Sep)',
]

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

// SOP Clause 4(iii): teachers must be in the classroom by the period start time.
// All six main-session periods (Annexure-I) now fall within 10:20 AM–3:50 PM,
// so the old evening/period-8+ daytime lockout no longer applies here.
const isPeriodUnlocked = (periodNo, teacherName, staffList = []) => {
  const pt = PERIOD_TIMES[periodNo]
  if (!pt) return true
  const now = new Date()
  const nowMins = now.getHours() * 60 + now.getMinutes()
  const startMins = pt.start[0] * 60 + pt.start[1]
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

// Remembers the last course/batch/class/subject a teacher picked, so the next
// log starts pre-filled instead of asking the same 4 fields every single time.
// Keyed per teacher name so a shared device doesn't mix up different teachers.
const LAST_SELECTION_PREFIX = 'gnsi_last_selection_'
const saveLastSelection = (teacherName, sel) => {
  if (!teacherName) return
  try { localStorage.setItem(LAST_SELECTION_PREFIX + teacherName, JSON.stringify(sel)) } catch(e) {}
}
const loadLastSelection = (teacherName) => {
  if (!teacherName) return null
  try {
    const raw = localStorage.getItem(LAST_SELECTION_PREFIX + teacherName)
    return raw ? JSON.parse(raw) : null
  } catch(e) { return null }
}
const clearLastSelection = (teacherName) => {
  if (!teacherName) return
  try { localStorage.removeItem(LAST_SELECTION_PREFIX + teacherName) } catch(e) {}
}

// ─── Suggestion Picker ────────────────────────────────────────────────────────

function SuggestionPicker({ field, value, onChange, form }) {
  const suggestions = SUGGESTIONS[field] || []

  const fillSuggestion = (s) => {
    const filled = s
      .replace(/{subtopic}/g, (form?.subtopic === '__other__' ? form?.subtopic_custom : form?.subtopic) || 'this subtopic')
      .replace(/{chapter}/g, (form?.chapter === '__other__' ? form?.chapter_custom : form?.chapter) || 'this chapter')
      .replace(/{range_from}/g, form?.range_from || '1')
      .replace(/{range_to}/g, form?.range_to || '10')
    onChange(filled)
  }

  if (!suggestions.length) return null

  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:6, marginBottom:8 }}>
      {suggestions.map((s, i) => (
        <button key={i} type="button" onClick={() => fillSuggestion(s)} title={s}
          style={{
            fontSize:11, padding:'5px 10px', borderRadius:14, border:'1px solid #bfdbfe',
            background:'#eff6ff', color:C.navy, cursor:'pointer', fontWeight:600,
            maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
          }}>
          💡 {s.slice(0, 40)}{s.length > 40 ? '…' : ''}
        </button>
      ))}
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
  const currentPage = steps[current]?.page ?? 0
  const stepsInPage = (p) => steps.filter(s => s.page === p)
  const pageDone = (p) => {
    const inPage = stepsInPage(p)
    const lastIdx = steps.findIndex(s => s.key === inPage[inPage.length-1].key)
    return current > lastIdx
  }
  return (
    <div style={{ marginBottom:28 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        {PAGES.map((pg, pi) => {
          const active = currentPage === pi
          const done = pageDone(pi)
          const firstStepOfPage = steps.findIndex(s => s.page === pi)
          return (
            <React.Fragment key={pg.label}>
              <div
                onClick={() => done && onChange(firstStepOfPage)}
                style={{
                  flex:1, display:'flex', alignItems:'center', gap:10, padding:'12px 16px',
                  borderRadius:12, cursor: done ? 'pointer' : 'default',
                  background: active ? C.navy : done ? '#f0fdf4' : '#f8fafc',
                  border: `1.5px solid ${active ? C.navy : done ? '#bbf7d0' : '#e2e8f0'}`,
                }}
              >
                <div style={{
                  width:30, height:30, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:13, fontWeight:800, background: done ? C.green : active ? 'rgba(255,255,255,.2)' : '#e2e8f0',
                  color: done || active ? 'white' : '#94a3b8',
                }}>
                  {done ? '✓' : pi+1}
                </div>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:800, color: active ? 'white' : done ? '#166534' : '#374151' }}>{pg.label}</div>
                  <div style={{ fontSize:11, color: active ? 'rgba(255,255,255,.75)' : '#94a3b8', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{pg.hint}</div>
                </div>
              </div>
              {pi < PAGES.length-1 && <div style={{ width:20, height:2, background: done ? C.green : '#e2e8f0', flexShrink:0 }}/>}
            </React.Fragment>
          )
        })}
      </div>
      {/* sub-progress dots within the active page */}
      <div style={{ display:'flex', gap:6, marginTop:12, paddingLeft:2 }}>
        {stepsInPage(currentPage).map(s => {
          const idx = steps.findIndex(x => x.key === s.key)
          return (
            <div key={s.key} title={s.label} style={{
              flex:1, height:4, borderRadius:2,
              background: current === idx ? C.navy : current > idx ? '#93c5fd' : '#e2e8f0',
            }}/>
          )
        })}
      </div>
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
    // classwork/homework/remarks are optional as of the shortened Step 2
  }
  if (step === 2) {
    if (!(form.techniques || []).length) errors.push('Select at least one Teaching Technique')
    if (!form.technique_detail?.trim()) errors.push('Technique/HM notes are required')
    // key_concepts and technique_avoid merged into technique_detail as of the shortened flow
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
          {form.period_number === '3' && (
            <div style={{ color:'#d97706', fontSize:11, marginTop:5, fontWeight:600 }}>
              ☕ Tea break is 12:50–1:20 PM (SOP Clause 4(ii)) — do not extend class into this window.
            </div>
          )}
          {form.period_number === '4' && (
            <div style={{ color:'#d97706', fontSize:11, marginTop:5, fontWeight:600 }}>
              🚪 Be in classroom by 1:25 PM sharp — not a grace period (SOP Clause 4(iii)).
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
        <label style={S.label}>Topic Taught (summary) <span style={S.required}>*</span><WCBadge field="topic_taught" value={form.topic_taught}/></label>
        {/* Quick-fill removed — plain text entry */}
        <textarea value={form.topic_taught} onChange={e => setForm(f => ({ ...f, topic_taught:e.target.value }))} required rows={3} style={{ ...S.input, resize:'vertical' }} placeholder="Brief description of what was covered today..."/>
      </div>

      <div style={{ marginBottom:14 }}>
        <label style={S.label}>Classwork, Homework &amp; Remarks <span style={{ fontSize:11, color:'#94a3b8', fontWeight:500 }}>(optional)</span><WCBadge field="classwork" value={form.classwork}/></label>
        {/* Quick-fill removed — plain text entry */}
        <textarea value={form.classwork} onChange={e => setForm(f => ({ ...f, classwork:e.target.value }))} rows={2} style={{ ...S.input, resize:'vertical' }} placeholder="Classwork done, homework assigned, and any observations — combine as needed"/>
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
        <label style={S.label}>Notes for HM — how you taught it, key points, what to avoid <span style={S.required}>*</span><WCBadge field="technique_detail" value={form.technique_detail}/></label>
        <TeachingMethodPicker value={form.technique_detail} onChange={v => setForm(f=>({...f,technique_detail:v}))}/>
        <textarea value={form.technique_detail} onChange={e => setForm(f => ({ ...f, technique_detail:e.target.value }))} required rows={3} style={{ ...S.input, resize:'vertical' }} placeholder="How you taught it, key concepts to emphasise, and anything a doubt-session teacher should avoid doing."/>
      </div>

      <div>
        <label style={S.label}>Needs Doubt Session?</label>
        <label style={{ display:'flex', alignItems:'center', gap:12, cursor:'pointer', padding:'12px 14px', borderRadius:8, background:form.needs_doubt_session?'#fef9c3':'#f8fafc', border:`1px solid ${form.needs_doubt_session?'#fde68a':'#e2e8f0'}`, minHeight:48 }}>
          <input type="checkbox" checked={form.needs_doubt_session||false} onChange={e => setForm(f => ({ ...f, needs_doubt_session:e.target.checked }))} style={{ width:18, height:18, cursor:'pointer'}}/>
          <span style={{ fontWeight:700, fontSize:14, color:form.needs_doubt_session?'#b45309':'#374151' }}>🔁 Yes — Assign HM for Doubt Session</span>
        </label>
        {!form.needs_doubt_session && (
          <div style={{ fontSize:11.5, color:'#94a3b8', marginTop:6 }}>Leave unchecked to skip straight to Review — no need to fill practice questions or HM details.</div>
        )}
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

      <div style={{ marginBottom:16, padding:'10px 14px', borderRadius:8, background:form.needs_doubt_session?'#fef9c3':'#f8fafc', border:`1px solid ${form.needs_doubt_session?'#fde68a':'#e2e8f0'}` }}>
        <span style={{ fontWeight:700, fontSize:13, color:form.needs_doubt_session?'#b45309':'#374151' }}>
          {form.needs_doubt_session ? '🔁 Doubt session requested — fill in HM details below.' : 'No doubt session requested.'}
        </span>
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
  { key:'course',     label:'Course & Chapter', page:0 },
  { key:'taught',     label:'What Was Taught',  page:0 },
  { key:'technique',  label:'Teaching Method',  page:0 },
  { key:'questions',  label:'Practice Qs',      page:1 },
  { key:'hm',         label:'HM & Notify',      page:1 },
  { key:'review',     label:'Review & Save',    page:1 },
]
const PAGES = [
  { label:'Class Details', hint:'Course, chapter and what you taught today' },
  { label:'Wrap-up',       hint:'Practice questions, HM notification and review' },
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

// ─── Teacher Leaderboard & Warnings Dashboard ─────────────────────────────────
// Public, clickable-by-everyone dashboard shown inside the teaching log flow.
// Composite ranking uses three signals from teaching_logs / teacher_warnings:
//   - excellent logs   (teaching_logs.excellence_flag)
//   - on-time rate     (teaching_logs.late_submission)
//   - active warnings  (teacher_warnings.warning_type, most recent per teacher)

const RANK_MODES = [
  { key:'composite', label:'🏆 Overall' },
  { key:'excellent', label:'🌟 Excellent Logs' },
  { key:'ontime',    label:'⏱️ On-Time Rate' },
  { key:'warnings',  label:'⚠️ Warnings' },
]

function computeTeacherStats(logs, warnings) {
  const map = {}
  const ensure = name => {
    if (!map[name]) map[name] = { name, totalLogs:0, excellentLogs:0, lateLogs:0, warningCount:0, latestWarning:null }
    return map[name]
  }
  logs.forEach(l => {
    if (!l.teacher_name) return
    const t = ensure(l.teacher_name)
    t.totalLogs += 1
    if (l.excellence_flag) t.excellentLogs += 1
    if (l.late_submission) t.lateLogs += 1
  })
  warnings.forEach(w => {
    if (!w.teacher_name) return
    const t = ensure(w.teacher_name)
    t.warningCount += 1
    if (!t.latestWarning || new Date(w.created_at) > new Date(t.latestWarning.created_at)) {
      t.latestWarning = w
    }
  })
  return Object.values(map).map(t => {
    const onTimeRate = t.totalLogs > 0 ? Math.round(((t.totalLogs - t.lateLogs) / t.totalLogs) * 100) : 0
    // Composite score: reward excellence & on-time delivery, penalise warnings.
    // Weighting is intentionally simple and transparent so teachers can see why they rank where they do.
    const composite = (t.excellentLogs * 3) + (onTimeRate * 0.2) + (t.totalLogs * 0.5) - (t.warningCount * 5)
    return { ...t, onTimeRate, composite: Math.round(composite * 10) / 10 }
  })
}

function getTeacherStatus(t) {
  if (!t || t.totalLogs === 0) {
    return { label:'No Logs Yet', tone:'neutral', color:'#64748b', bg:'#f1f5f9', icon:'📭',
      message:'Submit your first teaching log to get a status.' }
  }
  if (t.warningCount >= 3) {
    return { label:'Weak — At Risk', tone:'critical', color:C.red, bg:'#fee2e2', icon:'🚨',
      message:'Your log entries are weak and repeatedly flagged. Continued issues may lead to blocking and salary deduction.' }
  }
  if (t.warningCount > 0) {
    return { label:'Weak', tone:'warning', color:'#d97706', bg:'#fef3c7', icon:'⚠️',
      message:'Your log entry quality needs improvement. Write more specific, original content to avoid further warnings.' }
  }
  if (t.excellentLogs >= 5 && t.onTimeRate >= 85) {
    return { label:'Excellent', tone:'excellent', color:C.green, bg:'#dcfce7', icon:'🌟',
      message:'Great work! Your logs are detailed, original and consistently on time.' }
  }
  if (t.onTimeRate < 60 || t.totalLogs < 5) {
    return { label:'Poor', tone:'poor', color:C.red, bg:'#fee2e2', icon:'📉',
      message:'Your submission consistency is low. Log every class on time to improve your status.' }
  }
  return { label:'Average', tone:'average', color:'#0891b2', bg:'#e0f2fe', icon:'📊',
    message:'You are meeting expectations. A few more detailed, on-time logs will push you to Excellent.' }
}

// ─── SOP Reference Panel ───────────────────────────────────────────────────────
// Source: GNSI/ACAD/SOP/13/2026-27 dated 13.07.2026, "GNSI Class Timetable —
// Standard Operating Procedure, 2026", effective 09 July 2026.
const SOP_RULES = [
  { icon:'🕐', title:'Main Session Timing', text:'10:20 AM – 3:50 PM, Monday–Saturday, six teaching periods (Annexure-I).' },
  { icon:'☕', title:'Tea Break', text:'Fixed uniformly at 12:50 PM – 1:20 PM. No class shall be extended into this period (Clause 4(ii)).' },
  { icon:'🚪', title:'Post-Break Re-entry', text:'All teachers must be physically present in their classroom by 1:25 PM without fail — this is a transition period, not a grace period (Clause 4(iii)).' },
  { icon:'🙋', title:'Morning Assembly', text:'Attendance before 10:20 AM is compulsory for all teaching staff without exception (Clause 4(i)).' },
  { icon:'🌅', title:'Early & Evening Sessions', text:'Sessions starting 6:00/6:30 AM and 6:00 PM follow the same punctuality standard as the main session (Clause 4(iv)).' },
  { icon:'🔁', title:'Substitution', text:'Unable to attend an assigned period? Inform the Batch Coordinator and Administrator at least two hours in advance (Clause 9(a)).' },
]

function SOPReferencePanel() {
  const [expanded, setExpanded] = useState(false)
  return (
    <div style={{ ...S.card, cursor:'pointer', background:'#f8fafc' }} onClick={() => setExpanded(e => !e)}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:20 }}>📋</span>
          <div>
            <div style={{ fontWeight:800, fontSize:14, color:C.navy }}>Timetable SOP — Quick Reference</div>
            <div style={{ fontSize:11, color:'#64748b' }}>F. No. GNSI/ACAD/SOP/13/2026-27 · Effective 09 Jul 2026 · Tap to {expanded?'collapse':'view rules'}</div>
          </div>
        </div>
        <span style={{ fontSize:16, color:'#94a3b8', transform: expanded?'rotate(180deg)':'none', transition:'transform .15s' }}>▾</span>
      </div>
      {expanded && (
        <div onClick={e => e.stopPropagation()} style={{ marginTop:14, paddingTop:14, borderTop:'1px solid #e2e8f0', display:'grid', gap:8 }}>
          {SOP_RULES.map(r => (
            <div key={r.title} style={{ display:'flex', gap:10, padding:'8px 10px', background:'white', border:'1px solid #e2e8f0', borderRadius:8 }}>
              <span style={{ fontSize:16, flexShrink:0 }}>{r.icon}</span>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:'#1e293b' }}>{r.title}</div>
                <div style={{ fontSize:12, color:'#64748b', lineHeight:1.5, marginTop:2 }}>{r.text}</div>
              </div>
            </div>
          ))}
          <div style={{ fontSize:10, color:'#94a3b8', marginTop:2, fontStyle:'italic' }}>
            Doubt-session slots and period timings in this form now follow the SOP's Annexures I–IX. For the full document, contact the Administrator's office.
          </div>
        </div>
      )}
    </div>
  )
}

function MyStatusBanner({ myStat, loading }) {
  if (loading) {
    return (
      <div style={{ ...S.card, textAlign:'center', color:'#64748b', fontSize:13, padding:16 }}>
        ⏳ Checking your status...
      </div>
    )
  }
  const status = getTeacherStatus(myStat)
  const hasDeductionRisk = status.tone === 'warning' || status.tone === 'critical' || status.tone === 'poor'

  return (
    <div style={{ ...S.card, background:status.bg, border:`1.5px solid ${status.color}55` }}>
      <div style={{ display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
        <span style={{ fontSize:30, flexShrink:0 }}>{status.icon}</span>
        <div style={{ flex:1, minWidth:200 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:2 }}>
            Your Status
          </div>
          <div style={{ fontSize:19, fontWeight:800, color:status.color }}>{status.label}</div>
          <div style={{ fontSize:13, color:'#374151', marginTop:4, lineHeight:1.5 }}>{status.message}</div>
        </div>
        {myStat && myStat.totalLogs > 0 && (
          <div style={{ display:'flex', gap:16, flexShrink:0 }}>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:18, fontWeight:800, color:'#1e293b' }}>{myStat.totalLogs}</div>
              <div style={{ fontSize:10, color:'#64748b', fontWeight:600 }}>LOGS</div>
            </div>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:18, fontWeight:800, color:'#1e293b' }}>{myStat.onTimeRate}%</div>
              <div style={{ fontSize:10, color:'#64748b', fontWeight:600 }}>ON-TIME</div>
            </div>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:18, fontWeight:800, color:'#1e293b' }}>{myStat.excellentLogs}</div>
              <div style={{ fontSize:10, color:'#64748b', fontWeight:600 }}>EXCELLENT</div>
            </div>
          </div>
        )}
      </div>

      {hasDeductionRisk && (
        <div style={{ marginTop:12, padding:'10px 14px', background:'white', border:`1px solid ${C.red}55`, borderRadius:8, display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:16, flexShrink:0 }}>💰</span>
          <span style={{ fontSize:12, fontWeight:600, color:C.red, lineHeight:1.5 }}>
            Warning: Some amount will be deducted from your salary if you miss a teaching log entry or continue submitting weak/late logs.
          </span>
        </div>
      )}
    </div>
  )
}

function TeacherLeaderboard({ currentUser }) {
  const [logs, setLogs] = useState([])
  const [warnings, setWarnings] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [rankMode, setRankMode] = useState('composite')

  useEffect(() => {
    let cancelled = false
    const fetchAll = async () => {
      setLoading(true)
      const [{ data: logData }, { data: warnData }] = await Promise.all([
        supabase.from('teaching_logs')
          .select('teacher_name,excellence_flag,late_submission,teaching_date')
          .order('teaching_date', { ascending:false })
          .limit(1000),
        supabase.from('teacher_warnings')
          .select('teacher_name,warning_type,message,created_at')
          .order('created_at', { ascending:false })
          .limit(300),
      ])
      if (cancelled) return
      setLogs(logData || [])
      setWarnings(warnData || [])
      setLoading(false)
    }
    fetchAll()
    return () => { cancelled = true }
  }, [])

  const stats = useMemo(() => computeTeacherStats(logs, warnings), [logs, warnings])

  const sortKeyFor = mode => {
    if (mode === 'excellent') return t => t.excellentLogs
    if (mode === 'ontime')    return t => t.onTimeRate
    if (mode === 'warnings')  return t => -t.warningCount
    return t => t.composite
  }

  const ranked = useMemo(() => {
    const key = sortKeyFor(rankMode)
    return [...stats].sort((a,b) => key(b) - key(a))
  }, [stats, rankMode])

  const warnedTeachers = useMemo(() =>
    stats.filter(t => t.warningCount > 0).sort((a,b) => b.warningCount - a.warningCount),
  [stats])

  const myName = currentUser?.name
  const myRank = myName ? ranked.findIndex(t => t.name === myName) + 1 : 0
  const myStat = myName ? stats.find(t => t.name === myName) || { name:myName, totalLogs:0, excellentLogs:0, lateLogs:0, warningCount:0, onTimeRate:0, composite:0 } : null

  const medalFor = i => i===0 ? '🥇' : i===1 ? '🥈' : i===2 ? '🥉' : `#${i+1}`
  const warnColor = wt => wt==='blocked' ? C.red : wt==='final_warning' ? '#d97706' : '#eab308'
  const warnBg    = wt => wt==='blocked' ? '#fee2e2' : wt==='final_warning' ? '#fef3c7' : '#fefce8'

  return (
    <>
    {myName && <MyStatusBanner myStat={myStat} loading={loading}/>}
    <div style={{ ...S.card, cursor:'pointer' }} onClick={() => setExpanded(e => !e)}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:22 }}>🏆</span>
          <div>
            <div style={{ fontWeight:800, fontSize:15, color:C.navy }}>Teacher Leaderboard</div>
            <div style={{ fontSize:12, color:'#64748b' }}>
              {loading ? 'Loading rankings...' : myName && myRank
                ? `You're ranked #${myRank} of ${ranked.length} · Tap to ${expanded?'collapse':'view all'}`
                : `${ranked.length} teachers ranked · Tap to ${expanded?'collapse':'view all'}`}
            </div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {warnedTeachers.length > 0 && (
            <span style={S.badge(C.red, '#fee2e2')}>⚠️ {warnedTeachers.length} with warnings</span>
          )}
          <span style={{ fontSize:18, color:'#94a3b8', transform: expanded?'rotate(180deg)':'none', transition:'transform .15s' }}>▾</span>
        </div>
      </div>

      {expanded && (
        <div onClick={e => e.stopPropagation()} style={{ marginTop:18, paddingTop:18, borderTop:'1px solid #f1f5f9' }}>
          {loading ? (
            <div style={{ textAlign:'center', padding:24, color:'#64748b', fontSize:13 }}>⏳ Loading leaderboard...</div>
          ) : (
            <>
              {/* Ranking mode tabs */}
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:16 }}>
                {RANK_MODES.map(m => (
                  <button key={m.key} type="button" onClick={() => setRankMode(m.key)}
                    style={S.tag(rankMode === m.key)}>
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Leaderboard list */}
              <div style={{ marginBottom:20 }}>
                {ranked.length === 0 ? (
                  <div style={{ fontSize:13, color:'#94a3b8', textAlign:'center', padding:16 }}>No teaching logs yet.</div>
                ) : ranked.map((t, i) => {
                  const isMe = t.name === myName
                  return (
                    <div key={t.name} style={{
                      display:'flex', alignItems:'center', gap:12, padding:'10px 12px', borderRadius:10, marginBottom:6,
                      background: isMe ? '#eff6ff' : i < 3 ? '#fffbeb' : '#f8fafc',
                      border: `1px solid ${isMe ? '#bfdbfe' : i < 3 ? '#fde68a' : '#f1f5f9'}`,
                    }}>
                      <span style={{ fontSize: i < 3 ? 18 : 13, fontWeight:800, color: i < 3 ? undefined : '#94a3b8', width:32, textAlign:'center', flexShrink:0 }}>
                        {medalFor(i)}
                      </span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:700, fontSize:13, color: isMe ? C.navy : '#1e293b' }}>
                          {t.name}{isMe ? ' (You)' : ''}
                        </div>
                        <div style={{ fontSize:11, color:'#64748b' }}>
                          {t.totalLogs} logs · {t.excellentLogs} excellent · {t.onTimeRate}% on-time
                          {t.warningCount > 0 ? ` · ${t.warningCount} warning${t.warningCount>1?'s':''}` : ''}
                        </div>
                      </div>
                      <span style={S.badge(C.navy, '#eff6ff')}>
                        {rankMode === 'composite' ? t.composite
                          : rankMode === 'excellent' ? t.excellentLogs
                          : rankMode === 'ontime' ? `${t.onTimeRate}%`
                          : t.warningCount}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Warnings section */}
              {warnedTeachers.length > 0 && (
                <div>
                  <div style={{ fontWeight:800, fontSize:13, color:C.red, marginBottom:10 }}>⚠️ Teachers with Active Warnings</div>
                  {warnedTeachers.map(t => (
                    <div key={t.name} style={{
                      padding:'10px 12px', borderRadius:10, marginBottom:6,
                      background: warnBg(t.latestWarning?.warning_type), border:`1px solid ${warnColor(t.latestWarning?.warning_type)}33`,
                    }}>
                      <div style={{ display:'flex', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}>
                        <span style={{ fontWeight:700, fontSize:13, color:'#1e293b' }}>
                          {t.name}{t.name === myName ? ' (You)' : ''}
                        </span>
                        <span style={{ ...S.badge(warnColor(t.latestWarning?.warning_type), 'white'), border:`1px solid ${warnColor(t.latestWarning?.warning_type)}` }}>
                          {t.warningCount} warning{t.warningCount>1?'s':''}
                        </span>
                      </div>
                      {t.latestWarning?.message && (
                        <div style={{ fontSize:12, color:'#374151', marginTop:4 }}>{t.latestWarning.message}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
    </>
  )
}

export function EnhancedLogForm({ onSaved, courseData, staff, currentUser, logs }) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(() => {
  const draft = loadDraft()
  if (!draft) {
    // No draft to recover — pre-fill identity fields from this teacher's
    // last log so they only confirm/change what's different today.
    const last = loadLastSelection(currentUser?.name)
    if (last) return { ...emptyForm, ...last }
    return { ...emptyForm }
  }
  // Discard draft if it belongs to a different teacher
  if (currentUser?.name && draft.teacher_name && draft.teacher_name !== currentUser.name) {
    clearDraft()
    const last = loadLastSelection(currentUser?.name)
    if (last) return { ...emptyForm, ...last }
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

  // Pulls the real syllabus (seeded/maintained in the Syllabus tab) for this
  // course + subtype + subject, so the log form's Chapter/Sub-topic pickers
  // stay in sync with whatever staff/admin have entered there.
  // Schema (confirmed via information_schema, 2026-07-25):
  //   teaching_syllabus(id, course, subtype, batch, class_name, subject_name, ...)
  //   syllabus_topics(id, syllabus_id, chapter_name, subtopics jsonb, course, subject_name, order_num, ...)
  useEffect(() => {
    if (!form.subject_name || !form.course) { setChapters([]); return }
    setLoadingChapters(true)
    const fetchChapters = async () => {
      // A row may be batch-specific (subtype set) or apply to all batches in
      // the stream (subtype null) — prefer the batch-specific row if it exists.
      const { data: rows } = await supabase.from('teaching_syllabus')
        .select('id,subject_name,subtype')
        .eq('course', form.course)
        .eq('subject_name', form.subject_name)
      if (!rows?.length) { setChapters([]); setLoadingChapters(false); return }

      const specific = rows.find(r => r.subtype === form.subtype)
      const fallback = rows.find(r => !r.subtype)
      const row = specific || fallback
      if (!row) { setChapters([]); setLoadingChapters(false); return }

      const { data: topicRows } = await supabase.from('syllabus_topics')
        .select('id,chapter_name,subtopics,subject_name')
        .eq('syllabus_id', row.id)
        .order('order_num')

      // subtopics is jsonb — normalise to a plain string array either way.
      const shaped = (topicRows || []).map(t => ({
        id: t.id,
        chapter_name: t.chapter_name,
        subject_name: t.subject_name || form.subject_name,
        subtopics: Array.isArray(t.subtopics) ? t.subtopics : [],
      }))
      setChapters(shaped)
      setLoadingChapters(false)
    }
    fetchChapters()
  }, [form.subject_name, form.course, form.subtype])

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
    saveLastSelection(currentUser?.name, { course:form.course, subtype:form.subtype, class_name:form.class_name, batch_id:form.batch_id, subject_name:form.subject_name })
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
    saveLastSelection(currentUser?.name, { course:form.course, subtype:form.subtype, class_name:form.class_name, batch_id:form.batch_id, subject_name:form.subject_name })
    setForm({ ...emptyForm })
    setStep(0)
    gpsCheckedRef.current = false
    onSaved?.()
  }

  // Single-page form: all section requirements combined into one gate,
  // checked when the teacher hits Save (there are no more per-step Next buttons).
  const canSave = () => {
    const step0Ok = form.course && form.subtype && form.class_name && form.subject_name &&
      form.teaching_date && form.period_number &&
      (form.chapter || form.chapter_custom) &&
      (form.subtopic || form.subtopic_custom) &&
      isPeriodUnlocked(Number(form.period_number), form.teacher_name, staff)
    const step1Ok = form.range_from && form.range_to && form.topic_taught?.trim()
    const step2Ok = (form.techniques || []).length > 0 && form.technique_detail?.trim()
    const step4Ok = !form.needs_doubt_session || (
      (form.assigned_hm_id || form.assigned_hm_name) && form.doubt_date &&
      form.doubt_time_slot && form.hm_instruction_message &&
      (students.length === 0 || (form.focus_student_ids || []).length > 0)
    )
    return step0Ok && step1Ok && step2Ok && step4Ok
  }

  const handleSaveClick = async () => {
    setAttemptedNext(true)
    if (isDuplicate()) {
      setDupWarn(`⚠️ A log for ${form.subject_name} on ${form.teaching_date} already exists for this batch.`)
      return
    }
    if (!gpsCheckedRef.current) {
      const gpsOk = await checkGPS()
      if (!gpsOk) return
      gpsCheckedRef.current = true
    }
    const attOk = await checkAttendance()
    if (!attOk) { setAttWarn(true); return }
    setAttWarn(false)
    setDupWarn('')
    if (!canSave()) return
    setConfirm(true)
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

      // ── Cross-module signal: feed Staff.jsx's performance scoring ──────────
      // A late submission nudges the teacher's initiative score down there;
      // this is purely a signal emit, no direct write to staff_monthly_scores
      // from here — Staff.jsx owns that table and decides how to weight it.
      if (isLate) {
        EventBus.emit(GNSI_EVENTS.TEACHING_LOG_LATE, {
          staffId: form.staff_id || null,
          logId,
          teachingDate: form.teaching_date,
          subtype: form.subtype || null,
        })
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
              EventBus.emit(GNSI_EVENTS.TEACHING_LOG_EXCELLENT, {
                staffId: form.staff_id || null,
                logId,
                teachingDate: form.teaching_date,
                subtype: form.subtype || null,
              })
            }
          }
        } else {
          const excellent = isExcellentLog({ ...logPayload, ...form })
          if (excellent) {
            await supabase.from('teaching_logs').update({ excellence_flag: true }).eq('id', logId)
            EventBus.emit(GNSI_EVENTS.TEACHING_LOG_EXCELLENT, {
              staffId: form.staff_id || null,
              logId,
              teachingDate: form.teaching_date,
              subtype: form.subtype || null,
            })
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
        saveLastSelection(currentUser?.name, { course:form.course, subtype:form.subtype, class_name:form.class_name, batch_id:form.batch_id, subject_name:form.subject_name })
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
    clearLastSelection(currentUser?.name)
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
      <SOPReferencePanel/>
      <TeacherLeaderboard currentUser={currentUser}/>
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
        {hasDraft && (
          <div style={{ padding:'10px 14px', background:'#fef9c3', border:'1px solid #fde68a', borderRadius:8, marginBottom:14, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
            <span style={{ fontSize:13, fontWeight:600, color:'#92400e' }}>📝 Draft restored — continue where you left off.</span>
            <button type="button" onClick={discardDraft} style={{ fontSize:12, color:'#dc2626', background:'none', border:'none', cursor:'pointer', fontWeight:700 }}>✕ Discard Draft</button>
          </div>
        )}

        {draftPeriodStaleWarn && (
          <div style={{ padding:'10px 14px', background:'#fee2e2', border:'1px solid #fecaca', borderRadius:8, marginBottom:14, fontSize:13, fontWeight:600, color:C.red }}>
            🔒 Your draft has Period {form.period_number} selected, which is now locked. Please select a different period before proceeding.
          </div>
        )}

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
        {attemptedNext && !canSave() && (
          <div style={{ padding:'10px 14px', background:'#fee2e2', border:'1px solid #fecaca', borderRadius:8, marginBottom:14, fontSize:13, fontWeight:600, color:C.red }}>
            ⚠️ Please fill in all required fields (marked *) before saving.
          </div>
        )}

        {/* All sections stacked on one page — no step navigation */}
        <div style={{ marginBottom:20, paddingBottom:20, borderBottom:'1px solid #f1f5f9' }}>
          <div style={{ fontSize:11, fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:12 }}>1 · Course &amp; Chapter</div>
          <Step1CourseChapter form={form} setForm={setForm} courseData={courseData} chapters={chapters} loadingChapters={loadingChapters} staff={staff}/>
        </div>

        <div style={{ marginBottom:20, paddingBottom:20, borderBottom:'1px solid #f1f5f9' }}>
          <div style={{ fontSize:11, fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:12 }}>2 · What Was Taught</div>
          <Step2WhatTaught form={form} setForm={setForm}/>
        </div>

        <div style={{ marginBottom: form.needs_doubt_session ? 20 : 0, paddingBottom: form.needs_doubt_session ? 20 : 0, borderBottom: form.needs_doubt_session ? '1px solid #f1f5f9' : 'none' }}>
          <div style={{ fontSize:11, fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:12 }}>3 · Teaching Method</div>
          <Step3Technique form={form} setForm={setForm}/>
        </div>

        {form.needs_doubt_session && (
          <>
            <div style={{ marginBottom:20, paddingBottom:20, borderBottom:'1px solid #f1f5f9' }}>
              <div style={{ fontSize:11, fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:12 }}>4 · Practice Questions <span style={{ fontWeight:500, textTransform:'none' }}>(optional)</span></div>
              <Step4BulkQuestions form={form} setForm={setForm}/>
            </div>

            <div>
              <div style={{ fontSize:11, fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:12 }}>5 · HM &amp; Notify</div>
              <Step5HMAssign form={form} setForm={setForm} staff={staff} students={students} loadingStudents={loadingStudents}/>
            </div>
          </>
        )}

        <div style={{ display:'flex', justifyContent:'flex-end', marginTop:24, paddingTop:16, borderTop:'1px solid #f1f5f9' }}>
          <button type="button" onClick={handleSaveClick} disabled={saving} style={S.btn(C.green, saving)}>
            {saving ? '⏳ Saving...' : '✅ Save Log'}
          </button>
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