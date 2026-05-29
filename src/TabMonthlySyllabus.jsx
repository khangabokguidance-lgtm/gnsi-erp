// ─── TabMonthlySyllabus.jsx ───────────────────────────────────────────────────
// Props:
//   logs={logs} missed={missed} timetable={timetable}
//   staff={staff} courseData={courseData} currentUser={currentUser}
//   onNavigateTab={key => setActiveTab(key)}
//
// DB changes needed (run once in Supabase SQL editor):
//
//   ALTER TABLE monthly_syllabus
//     ADD COLUMN IF NOT EXISTS assigned_staff_id uuid REFERENCES staff(id),
//     ADD COLUMN IF NOT EXISTS log_id uuid;
//
//   CREATE TABLE IF NOT EXISTS syllabus_assignments (
//     id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//     syllabus_id     uuid NOT NULL REFERENCES monthly_syllabus(id) ON DELETE CASCADE,
//     staff_id        uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
//     role            text NOT NULL DEFAULT 'primary', -- primary | co-teacher
//     assigned_at     timestamptz DEFAULT now(),
//     UNIQUE(syllabus_id, staff_id)
//   );
//
//   -- RLS: teachers see only their topics; admins/managers see all
//   ALTER TABLE monthly_syllabus ENABLE ROW LEVEL SECURITY;
//   CREATE POLICY "syllabus_select" ON monthly_syllabus FOR SELECT TO authenticated USING (
//     assigned_staff_id IS NULL
//     OR assigned_staff_id = auth.uid()
//     OR EXISTS (SELECT 1 FROM syllabus_assignments WHERE syllabus_id = id AND staff_id = auth.uid())
//     OR EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid() AND role IN ('admin','manager','it'))
//   );
//   CREATE POLICY "syllabus_insert" ON monthly_syllabus FOR INSERT TO authenticated WITH CHECK (
//     EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid() AND role IN ('admin','manager','it'))
//   );
//   CREATE POLICY "syllabus_update" ON monthly_syllabus FOR UPDATE TO authenticated USING (
//     assigned_staff_id = auth.uid()
//     OR EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid() AND role IN ('admin','manager','it'))
//   );
//   CREATE POLICY "syllabus_delete" ON monthly_syllabus FOR DELETE TO authenticated USING (
//     EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid() AND role IN ('admin','manager','it'))
//   );

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { supabase } from './supabase'

// ─── Syllabus Bank ─────────────────────────────────────────────────────────────
const SYLLABUS_BANK = {
  Navodaya: {
    'Mental Ability': ['Odd-Man Out','Figure Matching','Pattern Completion','Figure Series Completion','Analogy','Geometrical Figure Completion (Triangle, Square, Circle)','Mirror Imaging','Punched Hole Pattern – Folding/Unfolding','Space Visualization','Embedded Figure'],
    Arithmetic: ['Number and Numeric System','Four Fundamental Operations on Whole Number','Factors & Multiples and Their Properties','Decimals and Fundamental Operations','Conversion of Fractions and Decimals','Measurement (Length, Mass, Capacity, Time, Money)','Simplification of Numerical Expressions','Fractional Numbers (Addition/Subtraction of Like Fractions)','Profit & Loss (without % calculation)','Perimeter & Area of Square, Rectangle, Triangle','Types of Angles and Simple Applications','Data Analysis (Bar Diagram, Line Chart)'],
    English: ['Reading Comprehension Passages','Noun','Pronoun','Adjective','Verb','Antonyms','Synonyms'],
  },
  Sainik: {
    Mathematics: ['Natural Numbers','LCM and HCF','Unitary Method','Fractions','Ratio and Proportion','Profit and Loss','Simplification','Average','Percentage','Area and Perimeter','Simple Interest','Lines and Angles','Temperature','Conversion of Units','Roman Numerals','Types of Angles','Circle','Volume of Cube and Cuboids','Prime and Composite Numbers','Plane Figures','Decimal Numbers','Speed and Time','Operation on Numbers','Complementary and Supplementary Angles','Arranging of Fractions'],
    Intelligence: ['Analogies (Mathematical & Verbal)','Venn Diagram','Paper Folding','Embedded/Hidden Figure','Geometrical Figure Completion','Space Visualisation','Order & Ranking','Coding Decoding','Mathematical Operations','Blood Relations','Sitting Arrangement','Mirror Image','Figure Matching','Figure Series Completion','Odd – Man Out','Pattern Completion','Classification','Word Formation','Dictionary – Word Order','Series','Direction Test','Clock And Calendar'],
    English: ['Comprehension Passage','Preposition','Article','Vocabulary','Verbs and Type','Confusing Words','Question Tags','Types of sentence','Tense forms','Kinds of Nouns','Kinds of Pronouns','Correct Spelling','Ordering of words in sentence','Sentence Formation','Antonyms','Synonyms','Adjectives','Interjection','Idiom and Phrases','Collective Nouns','Number','Gender','Adverbs','Rhyming Words','Singular/Plural'],
    'General Knowledge': ['Scientific Devices Used in Daily Life','Icons and Symbols of India','Major Religions of India','Art and Culture','Defence','Sports and Games','Super Senses','Relationship between Animals and Human Beings','Taste and Digestion','Cooking and Preserving Techniques','Germination and Seed Dispersal','Traditional Water Harvesting Techniques','Experiment with Water on Everyday Life','Water Pollution and Microbial Diseases','Concepts on Mountain Terrain','Historical Monuments','Shape of Earth and Gravitation','Non-Renewable Energy Sources','Food, Culture, Habitat, Languages of various regions','Names of young ones of different animals','Functions of Body Parts','International Organizations','Indian Literary and Cultural Personalities','Indian Literary and Cultural Awards','Natural Calamities','Evaporation, Condensation and Water Cycle','Life of Farmers','Tribal Communities and Forest Produce'],
    'Regional Language': ['Topics based on Class V curriculum'],
  },
  Foundation: {
    Mathematics: ['Number Systems','Basic Arithmetic','Fractions & Decimals','Ratio & Proportion','Percentage','Profit & Loss','Simple Interest','Mensuration','Basic Geometry','Data Handling'],
    English: ['Grammar Basics','Comprehension','Vocabulary Building','Tenses','Parts of Speech','Sentence Structure'],
    'General Science': ['Living & Non-living things','Plants & Animals','Human Body','Food & Nutrition','Matter & Materials','Light & Sound','Earth & Space'],
    'General Knowledge': ['Current Affairs','India & World','Science & Technology','Sports & Awards','Historical Events'],
    Reasoning: ['Verbal Reasoning','Non-verbal Reasoning','Analogies','Series Completion','Classification','Coding-Decoding'],
  },
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const ADMIT_TYPES   = ['Navodaya','Sainik','Foundation']
const MONTHS_LABEL  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTH_COLORS  = {'01':'#dbeafe','02':'#fce7f3','03':'#dcfce7','04':'#fef9c3','05':'#f3e8ff','06':'#e0f2fe','07':'#ffedd5','08':'#f1f5f9','09':'#fdf2f8','10':'#ecfdf5','11':'#fff7ed','12':'#eff6ff'}
const MONTH_ACCENT  = {'01':'#1d4ed8','02':'#db2777','03':'#16a34a','04':'#b45309','05':'#7c3aed','06':'#0891b2','07':'#ea580c','08':'#475569','09':'#9d174d','10':'#065f46','11':'#c2410c','12':'#1e3a5f'}
const STAFF_COLORS  = ['#1d4ed8','#16a34a','#7c3aed','#0891b2','#db2777','#ea580c','#065f46','#9d174d']
const ADMIN_ROLES   = ['admin','manager','it']

// ─── Helpers ───────────────────────────────────────────────────────────────────
const monthKey   = (y,m) => `${y}-${String(m).padStart(2,'0')}`
const currentYM  = () => { const d=new Date(); return {y:d.getFullYear(),m:d.getMonth()+1} }
const fmtDate    = d => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short'}) : '—'
const isAdmin    = u => u && ADMIN_ROLES.includes(u.role)
const staffColor = (id, staffList) => {
  if (!id || !staffList?.length) return '#94a3b8'
  const idx = staffList.findIndex(s => s.id === id)
  return STAFF_COLORS[idx % STAFF_COLORS.length] || '#94a3b8'
}
const staffName  = (id, staffList) => staffList?.find(s => s.id === id)?.name || '—'
const initials   = name => name ? name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() : '?'

// ─── Style helpers ─────────────────────────────────────────────────────────────
const S = {
  sel: { width:'100%', padding:'7px 9px', borderRadius:7, border:'1px solid #d1d5db', fontSize:12, background:'white', color:'#1e293b', fontFamily:'inherit' },
  inp: { width:'100%', padding:'7px 9px', borderRadius:7, border:'1px solid #d1d5db', fontSize:12, fontFamily:'inherit', outline:'none', color:'#1e293b', boxSizing:'border-box' },
  btnMini: (bg='#1e3a5f') => ({ background:bg, color:'white', border:'none', borderRadius:4, width:22, height:22, cursor:'pointer', fontSize:10, display:'flex', alignItems:'center', justifyContent:'center', padding:0, flexShrink:0 }),
  tag: (color, bg) => ({ padding:'2px 7px', borderRadius:999, fontSize:10, fontWeight:700, background:bg||color+'18', color, border:`1px solid ${color}33`, whiteSpace:'nowrap', display:'inline-flex', alignItems:'center', gap:3 }),
  card: (extra={}) => ({ background:'white', borderRadius:10, border:'1px solid #e2e8f0', padding:'10px 12px', ...extra }),
}

// ─── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg, type='success', onDone }) {
  useEffect(()=>{ const t=setTimeout(onDone,2400); return()=>clearTimeout(t) },[onDone])
  const bg = type==='error'?'#dc2626':type==='warn'?'#b45309':'#16a34a'
  return (
    <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', zIndex:9999, background:bg, color:'white', padding:'9px 18px', borderRadius:10, fontSize:13, fontWeight:600, boxShadow:'0 4px 20px rgba(0,0,0,0.25)', pointerEvents:'none', whiteSpace:'nowrap' }}>
      {msg}
    </div>
  )
}

// ─── Confirm Dialog (replaces window.confirm) ─────────────────────────────────
function ConfirmDialog({ msg, onYes, onNo }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(4,13,30,0.6)', zIndex:8000, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'white', borderRadius:14, padding:'24px 28px', maxWidth:340, width:'90%', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ fontSize:14, color:'#1e293b', lineHeight:1.6, marginBottom:20 }}>{msg}</div>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button onClick={onNo}  style={{ padding:'7px 18px', borderRadius:8, border:'1px solid #d1d5db', background:'white', cursor:'pointer', fontSize:13, fontFamily:'inherit', color:'#64748b' }}>Cancel</button>
          <button onClick={onYes} style={{ padding:'7px 18px', borderRadius:8, border:'none', background:'#dc2626', color:'white', cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'inherit' }}>Delete</button>
        </div>
      </div>
    </div>
  )
}

// ─── Assign Modal ──────────────────────────────────────────────────────────────
// Opens when admin clicks the assign button on a topic. Shows all staff with
// subject_specialization matching the topic's subject, allows selecting primary
// teacher + optional co-teacher, saves to syllabus_assignments.
function AssignModal({ item, staffList, assignments, onSave, onClose }) {
  const relevant = useMemo(() => {
    if (!staffList?.length) return []
    return staffList.filter(s => s.is_active !== false)
  }, [staffList])

  const existing = useMemo(() =>
    assignments.filter(a => a.syllabus_id === item.id)
  , [assignments, item.id])

  const [primary,  setPrimary]  = useState(existing.find(a=>a.role==='primary')?.staff_id || item.assigned_staff_id || '')
  const [coTeach,  setCoTeach]  = useState(existing.find(a=>a.role==='co-teacher')?.staff_id || '')
  const [saving,   setSaving]   = useState(false)

  const save = async () => {
    setSaving(true)
    await onSave(item, primary||null, coTeach||null)
    setSaving(false)
    onClose()
  }

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(4,13,30,0.65)', zIndex:7000, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'white', borderRadius:16, padding:'22px 24px', maxWidth:380, width:'92%', boxShadow:'0 24px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ fontSize:15, fontWeight:700, color:'#1e3a5f', marginBottom:4 }}>Assign Teachers</div>
        <div style={{ fontSize:11, color:'#64748b', marginBottom:16, lineHeight:1.5 }}>
          <strong style={{ color:'#1e293b' }}>{item.topic}</strong><br/>
          {item.subject_name} · {item.month}
        </div>

        <div style={{ marginBottom:12 }}>
          <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#374151', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.06em' }}>Primary Teacher</label>
          <select value={primary} onChange={e=>setPrimary(e.target.value)} style={S.sel}>
            <option value="">— Unassigned —</option>
            {relevant.map(s=>(
              <option key={s.id} value={s.id}>{s.name}{s.subject_specialization?' · '+s.subject_specialization:''}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom:18 }}>
          <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#374151', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.06em' }}>Co-Teacher <span style={{ color:'#94a3b8', fontWeight:400 }}>(optional)</span></label>
          <select value={coTeach} onChange={e=>setCoTeach(e.target.value)} style={S.sel}>
            <option value="">— None —</option>
            {relevant.filter(s=>s.id!==primary).map(s=>(
              <option key={s.id} value={s.id}>{s.name}{s.subject_specialization?' · '+s.subject_specialization:''}</option>
            ))}
          </select>
        </div>

        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ padding:'8px 18px', borderRadius:8, border:'1px solid #d1d5db', background:'white', cursor:'pointer', fontSize:13, fontFamily:'inherit', color:'#64748b' }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ padding:'8px 20px', borderRadius:8, border:'none', background:'#1e3a5f', color:'white', cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'inherit', opacity:saving?0.7:1 }}>
            {saving ? 'Saving…' : 'Save Assignment'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Topic Edit Modal (Admin) ──────────────────────────────────────────────────
function TopicEditModal({ item, subjects, staffList, assignments, onSave, onClose }) {
  const [topic,   setTopic]   = useState(item?.topic || '')
  const [subject, setSubject] = useState(item?.subject_name || subjects[0] || '')
  const [month,   setMonth]   = useState(item?.month || '')
  const [saving,  setSaving]  = useState(false)

  const save = async () => {
    if (!topic.trim()) return
    setSaving(true)
    await onSave({ ...item, topic: topic.trim(), subject_name: subject, month: month || item?.month })
    setSaving(false)
    onClose()
  }

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(4,13,30,0.65)', zIndex:7000, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'white', borderRadius:16, padding:'22px 24px', maxWidth:400, width:'92%', boxShadow:'0 24px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ fontSize:15, fontWeight:700, color:'#1e3a5f', marginBottom:16 }}>{item?.id ? 'Edit Topic' : 'Add Topic'}</div>

        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div>
            <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#374151', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.06em' }}>Topic Name *</label>
            <input value={topic} onChange={e=>setTopic(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&save()}
              style={S.inp} placeholder="Enter topic name…" autoFocus />
          </div>
          <div>
            <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#374151', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.06em' }}>Subject</label>
            <select value={subject} onChange={e=>setSubject(e.target.value)} style={S.sel}>
              {subjects.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:20 }}>
          <button onClick={onClose} style={{ padding:'8px 18px', borderRadius:8, border:'1px solid #d1d5db', background:'white', cursor:'pointer', fontSize:13, fontFamily:'inherit', color:'#64748b' }}>Cancel</button>
          <button onClick={save} disabled={saving||!topic.trim()} style={{ padding:'8px 20px', borderRadius:8, border:'none', background:'#1e3a5f', color:'white', cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'inherit', opacity:(saving||!topic.trim())?0.6:1 }}>
            {saving ? 'Saving…' : item?.id ? 'Update' : 'Add Topic'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Progress Bar ──────────────────────────────────────────────────────────────
function ProgressBar({ done, total, color='#16a34a', height=5 }) {
  const pct = total ? Math.round((done/total)*100) : 0
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
      <div style={{ flex:1, height, background:'#e2e8f0', borderRadius:99, overflow:'hidden' }}>
        <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:99, transition:'width .5s cubic-bezier(.4,0,.2,1)' }} />
      </div>
      <span style={{ fontSize:10, fontWeight:700, color, minWidth:28, textAlign:'right' }}>{pct}%</span>
    </div>
  )
}

// ─── Staff Avatar ──────────────────────────────────────────────────────────────
function StaffAvatar({ id, staffList, size=20, showName=false }) {
  const color = staffColor(id, staffList)
  const name  = staffName(id, staffList)
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
      <span style={{ width:size, height:size, borderRadius:'50%', background:color+'22', border:`1.5px solid ${color}`, display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:size*0.4, fontWeight:700, color, flexShrink:0 }}>
        {initials(name)}
      </span>
      {showName && <span style={{ fontSize:11, color:'#374151', fontWeight:500 }}>{name}</span>}
    </span>
  )
}

// ─── Teacher Lane (split view) ─────────────────────────────────────────────────
function TeacherLane({ teacher, items, logs, onToggle, onEditItem, onDeleteItem, onAssign, isAdmin: adminMode }) {
  const color = teacher ? teacher.color : '#94a3b8'
  const done  = items.filter(i=>i.completed).length

  return (
    <div style={{ flex:'1 1 180px', minWidth:170, background:`${color}08`, borderRadius:8, border:`1.5px solid ${color}33`, padding:8 }}>
      {/* Lane header */}
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6, paddingBottom:6, borderBottom:`1px solid ${color}22` }}>
        {teacher
          ? <><span style={{ width:24, height:24, borderRadius:'50%', background:color+'22', border:`1.5px solid ${color}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, color, flexShrink:0 }}>{initials(teacher.name)}</span>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color }}>{teacher.name}</div>
                {teacher.subject_specialization && <div style={{ fontSize:9, color:'#94a3b8' }}>{teacher.subject_specialization}</div>}
              </div></>
          : <><span style={{ width:24, height:24, borderRadius:'50%', background:'#f1f5f9', border:'1.5px solid #d1d5db', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#94a3b8', flexShrink:0 }}>?</span>
              <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8' }}>Unassigned</div></>
        }
        <span style={{ marginLeft:'auto', fontSize:10, color:'#64748b' }}>{done}/{items.length}</span>
      </div>

      {items.length > 0 && <div style={{ marginBottom:6 }}><ProgressBar done={done} total={items.length} color={color} /></div>}

      <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
        {items.length === 0
          ? <div style={{ textAlign:'center', padding:'12px 0', color:'#cbd5e1', fontSize:10 }}>No topics</div>
          : items.map(item => (
            <LaneTopicRow key={item.id} item={item} color={color} logs={logs}
              onToggle={onToggle} onEdit={adminMode?onEditItem:null}
              onDelete={adminMode?onDeleteItem:null} onAssign={adminMode?onAssign:null} />
          ))
        }
      </div>
    </div>
  )
}

// ─── Lane Topic Row ────────────────────────────────────────────────────────────
function LaneTopicRow({ item, color, logs, onToggle, onEdit, onDelete, onAssign }) {
  const [hov, setHov] = useState(false)
  const linkedLog = useMemo(() => {
    if (!logs?.length) return null
    return logs.find(l=>l.id===item.log_id) ||
      logs.find(l=>l.topic_taught?.toLowerCase()===item.topic.toLowerCase())
  }, [logs, item])

  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ display:'flex', alignItems:'flex-start', gap:5, padding:'5px 7px', borderRadius:6, background:item.completed?`${color}10`:hov?'white':'transparent', border:`1px solid ${item.completed?color+'30':hov?'#e2e8f0':'transparent'}`, transition:'all .12s' }}>
      <input type="checkbox" checked={!!item.completed} onChange={()=>onToggle(item)}
        style={{ width:13, height:13, marginTop:1, cursor:'pointer', accentColor:color, flexShrink:0 }} />
      <span style={{ flex:1, fontSize:11, color:item.completed?'#94a3b8':'#1e293b', textDecoration:item.completed?'line-through':'none', lineHeight:1.4 }}>
        {item.topic}
        {linkedLog && <span style={{ display:'inline-flex', alignItems:'center', gap:2, marginLeft:4 }}><span style={{ fontSize:9, color:'#0891b2', background:'#e0f2fe', padding:'1px 4px', borderRadius:3 }}>✓ log</span></span>}
      </span>
      {hov && (
        <div style={{ display:'flex', gap:2, flexShrink:0 }}>
          {onAssign  && <button onClick={()=>onAssign(item)}  title="Assign teacher" style={S.btnMini('#7c3aed')}>👤</button>}
          {onEdit    && <button onClick={()=>onEdit(item)}    title="Edit"           style={S.btnMini('#0891b2')}>✏</button>}
          {onDelete  && <button onClick={()=>onDelete(item)}  title="Delete"         style={S.btnMini('#dc2626')}>✕</button>}
        </div>
      )}
    </div>
  )
}

// ─── Topic Row (flat view) ─────────────────────────────────────────────────────
function TopicRow({ item, index, logs, timetable, staffList, assignments, onToggle, onDelete, onMoveUp, onMoveDown, onMoveTop, onMoveBottom, onEditTopic, onAssign, onDragStart, onDragOver, onDrop, dragging, onNavigateTab, isAdmin: adminMode }) {
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState(item.topic)
  const [hovered, setHovered] = useState(false)

  const linkedLog = useMemo(() => {
    if (!logs?.length) return null
    return logs.find(l=>l.id===item.log_id) || logs.find(l=>l.topic_taught?.toLowerCase()===item.topic.toLowerCase())
  }, [logs, item])

  const timetableSlot = useMemo(() => {
    if (!timetable?.length || !item.subject_name) return null
    return timetable.find(t=>t.subject_name?.toLowerCase()===item.subject_name?.toLowerCase())
  }, [timetable, item])

  const save = () => { if(editVal.trim()) onEditTopic(item.id, editVal.trim()); setEditing(false) }

  // Assignment info
  const primaryAssign = assignments?.find(a=>a.syllabus_id===item.id && a.role==='primary')
  const coAssign      = assignments?.find(a=>a.syllabus_id===item.id && a.role==='co-teacher')
  const assignedId    = primaryAssign?.staff_id || item.assigned_staff_id

  return (
    <div draggable={adminMode}
      onDragStart={()=>adminMode&&onDragStart(index)}
      onDragOver={e=>{e.preventDefault();adminMode&&onDragOver(index)}}
      onDrop={()=>adminMode&&onDrop(index)}
      onMouseEnter={()=>setHovered(true)}
      onMouseLeave={()=>setHovered(false)}
      style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 8px', borderRadius:7, background:dragging?'#f0fdf4':item.completed?'#f0fdf4':hovered?'#f8fafc':'white', border:`1px solid ${item.completed?'#bbf7d0':hovered?'#e2e8f0':'#f1f5f9'}`, marginBottom:3, cursor:adminMode?'grab':'default', transition:'all .12s', opacity:dragging?.5:1 }}>
      {adminMode && <span style={{ color:'#cbd5e1', fontSize:11, flexShrink:0 }}>⠿</span>}
      <input type="checkbox" checked={!!item.completed} onChange={()=>onToggle(item)}
        style={{ width:13, height:13, cursor:'pointer', accentColor:'#16a34a', flexShrink:0 }} />
      {editing
        ? <input value={editVal} onChange={e=>setEditVal(e.target.value)} onBlur={save}
            onKeyDown={e=>{if(e.key==='Enter')save();if(e.key==='Escape')setEditing(false)}}
            autoFocus style={{ flex:1, fontSize:12, padding:'2px 6px', borderRadius:5, border:'1px solid #7c3aed', outline:'none', fontFamily:'inherit' }} />
        : <span onDoubleClick={()=>adminMode&&setEditing(true)} style={{ flex:1, fontSize:12, color:item.completed?'#94a3b8':'#1e293b', textDecoration:item.completed?'line-through':'none', cursor:adminMode?'text':'default', lineHeight:1.35 }} title={adminMode?'Double-click to edit':''}>
            {item.topic}
          </span>
      }

      {/* Assignment avatars */}
      {assignedId && <StaffAvatar id={assignedId} staffList={staffList} size={18} />}
      {coAssign   && <StaffAvatar id={coAssign.staff_id} staffList={staffList} size={16} />}

      {/* Linked log pill */}
      {linkedLog && (
        <span style={S.tag('#0891b2','#e0f2fe')} title={`Taught ${fmtDate(linkedLog.teaching_date)}`}>
          ✓ {fmtDate(linkedLog.teaching_date)}
        </span>
      )}
      {timetableSlot && !linkedLog && (
        <span style={{...S.tag('#7c3aed','#f3e8ff'), cursor:'pointer'}} onClick={()=>onNavigateTab?.('timetable')}
          title={`In timetable: ${timetableSlot.day_name}`}>
          🕐 {timetableSlot.day_name?.slice(0,3)}
        </span>
      )}
      {item.completed && !linkedLog && <span style={S.tag('#16a34a','#dcfce7')}>✓</span>}

      {/* Action buttons */}
      {hovered && adminMode && (
        <div style={{ display:'flex', gap:2, flexShrink:0 }}>
          <button onClick={()=>onMoveTop(index)}    title="Top"    style={S.btnMini('#1e3a5f')}>⤒</button>
          <button onClick={()=>onMoveUp(index)}     title="Up"     style={S.btnMini('#1e3a5f')}>↑</button>
          <button onClick={()=>onMoveDown(index)}   title="Down"   style={S.btnMini('#1e3a5f')}>↓</button>
          <button onClick={()=>onMoveBottom(index)} title="Bottom" style={S.btnMini('#1e3a5f')}>⤓</button>
          <button onClick={()=>onAssign(item)}      title="Assign" style={S.btnMini('#7c3aed')}>👤</button>
          <button onClick={()=>setEditing(true)}    title="Edit"   style={S.btnMini('#0891b2')}>✏</button>
          <button onClick={()=>onDelete(item.id)}   title="Delete" style={S.btnMini('#dc2626')}>✕</button>
        </div>
      )}
    </div>
  )
}

// ─── Month Column ──────────────────────────────────────────────────────────────
function MonthColumn({
  month, year, allItems, items, logs, timetable, staffList, assignments,
  onToggle, onDelete, onReorder, onEditTopic, onAddTopic, onBulkAdd,
  onAssign, onEditItem,
  subjects, admit, onNavigateTab, isAdmin: adminMode,
  splitMode, setSplitMode,
}) {
  const [dragIdx,  setDragIdx]  = useState(null)
  const [newTopic, setNewTopic] = useState('')
  const [showAdd,  setShowAdd]  = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [bulkSel,  setBulkSel]  = useState([])
  const [bulkSubj, setBulkSubj] = useState(subjects[0]||'')

  const mk     = monthKey(year, month)
  const label  = MONTHS_LABEL[month-1]
  const bg     = MONTH_COLORS[String(month).padStart(2,'0')] || '#f8fafc'
  const accent = MONTH_ACCENT[String(month).padStart(2,'0')] || '#1e3a5f'
  const done   = allItems.filter(i=>i.completed).length

  const bankTopics = (SYLLABUS_BANK[admit]?.[bulkSubj]||[]).filter(t=>!allItems.some(i=>i.topic===t&&i.subject_name===bulkSubj))

  const handleDrop = toIdx => {
    if(dragIdx===null||dragIdx===toIdx){setDragIdx(null);return}
    const a=[...items]; const[x]=a.splice(dragIdx,1); a.splice(toIdx,0,x)
    onReorder(mk,a); setDragIdx(null)
  }
  const moveUp     = i => { if(i===0)return; const a=[...items];[a[i-1],a[i]]=[a[i],a[i-1]];onReorder(mk,a) }
  const moveDown   = i => { if(i===items.length-1)return; const a=[...items];[a[i],a[i+1]]=[a[i+1],a[i]];onReorder(mk,a) }
  const moveTop    = i => { const a=[...items]; const[x]=a.splice(i,1); onReorder(mk,[x,...a]) }
  const moveBottom = i => { const a=[...items]; const[x]=a.splice(i,1); onReorder(mk,[...a,x]) }
  const addSingle  = () => { if(!newTopic.trim())return; onAddTopic(mk,newTopic.trim(),bulkSubj||subjects[0]); setNewTopic('') }
  const addBulk    = () => { if(!bulkSel.length)return; onBulkAdd(mk,bulkSel,bulkSubj); setBulkSel([]); setShowBulk(false) }

  // Build teacher lanes for split view
  const lanes = useMemo(() => {
    if (!splitMode) return []
    const assigned = {}
    const unassigned = []
    allItems.forEach(item => {
      const asgn = assignments?.find(a=>a.syllabus_id===item.id && a.role==='primary')
      const sid  = asgn?.staff_id || item.assigned_staff_id
      if (sid) {
        if (!assigned[sid]) assigned[sid] = []
        assigned[sid].push(item)
      } else {
        unassigned.push(item)
      }
    })
    const result = []
    Object.entries(assigned).forEach(([sid, items]) => {
      const s = staffList?.find(x=>x.id===sid)
      result.push({ teacher: s ? { ...s, color: staffColor(sid, staffList) } : null, id: sid, items })
    })
    if (unassigned.length > 0) result.push({ teacher: null, id: 'unassigned', items: unassigned })
    return result
  }, [splitMode, allItems, assignments, staffList])

  return (
    <div style={{ background:bg, borderRadius:12, border:`1.5px solid ${accent}33`, padding:10, minWidth:splitMode?380:255, flex: splitMode?'0 0 420px':'0 0 265px' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:7 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:800, color:accent }}>{label} {year}</div>
          <div style={{ fontSize:10, color:'#64748b' }}>{done}/{allItems.length} done</div>
        </div>
        <div style={{ display:'flex', gap:3, flexWrap:'wrap', justifyContent:'flex-end' }}>
          {adminMode && (
            <button onClick={()=>setSplitMode(!splitMode)} title="Split by teacher"
              style={{ ...S.btnMini(splitMode?accent:'#94a3b8'), width:'auto', padding:'3px 7px', fontSize:10, borderRadius:5 }}>
              {splitMode ? '⊟ Merge' : '⊞ Split'}
            </button>
          )}
          {adminMode && !splitMode && (
            <>
              <button onClick={()=>{setShowBulk(!showBulk);setShowAdd(false)}} style={{ ...S.btnMini('#7c3aed'), width:'auto', padding:'3px 6px', fontSize:10, borderRadius:5 }}>Bulk</button>
              <button onClick={()=>{setShowAdd(!showAdd);setShowBulk(false)}} style={{ ...S.btnMini(accent), width:'auto', padding:'3px 6px', fontSize:10, borderRadius:5 }}>{showAdd?'✕':'+'}</button>
            </>
          )}
        </div>
      </div>

      {allItems.length > 0 && <div style={{ marginBottom:7 }}><ProgressBar done={done} total={allItems.length} color={accent} /></div>}

      {/* Add single */}
      {showAdd && adminMode && !splitMode && (
        <div style={{ marginBottom:8, background:'white', borderRadius:8, padding:8, border:`1px solid ${accent}33` }}>
          <select value={bulkSubj} onChange={e=>setBulkSubj(e.target.value)} style={{ ...S.sel, marginBottom:5, fontSize:11 }}>
            {subjects.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
          <div style={{ display:'flex', gap:4 }}>
            <input value={newTopic} onChange={e=>setNewTopic(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addSingle()}
              placeholder="Topic name…" style={{ ...S.inp, flex:1, fontSize:11, padding:'5px 7px' }} />
            <button onClick={addSingle} style={{ ...S.btnMini('#16a34a'), borderRadius:6, width:28, height:28 }}>✓</button>
          </div>
        </div>
      )}

      {/* Bulk add */}
      {showBulk && adminMode && !splitMode && (
        <div style={{ marginBottom:8, background:'white', borderRadius:8, padding:8, border:'1px solid #7c3aed33' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#7c3aed', marginBottom:5 }}>From Syllabus Bank</div>
          <select value={bulkSubj} onChange={e=>{setBulkSubj(e.target.value);setBulkSel([])}} style={{ ...S.sel, marginBottom:5, fontSize:11 }}>
            {subjects.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
          <div style={{ maxHeight:120, overflowY:'auto', marginBottom:5 }}>
            {bankTopics.length === 0
              ? <div style={{ fontSize:10, color:'#94a3b8', padding:4 }}>All topics added.</div>
              : bankTopics.map(t=>(
                <label key={t} style={{ display:'flex', alignItems:'center', gap:4, padding:'2px 0', cursor:'pointer', fontSize:11 }}>
                  <input type="checkbox" checked={bulkSel.includes(t)} onChange={e=>setBulkSel(s=>e.target.checked?[...s,t]:s.filter(x=>x!==t))} style={{ accentColor:'#7c3aed' }} />
                  {t}
                </label>
              ))
            }
          </div>
          <div style={{ display:'flex', gap:3 }}>
            <button onClick={()=>setBulkSel(bankTopics)} style={{ ...S.btnMini('#64748b'), width:'auto', padding:'3px 7px', fontSize:10, borderRadius:5 }}>All</button>
            <button onClick={()=>setBulkSel([])}         style={{ ...S.btnMini('#94a3b8'), width:'auto', padding:'3px 7px', fontSize:10, borderRadius:5 }}>None</button>
            <button onClick={addBulk} style={{ ...S.btnMini('#7c3aed'), width:'auto', padding:'3px 7px', fontSize:10, borderRadius:5, flex:1 }}>
              + {bulkSel.length > 0 ? `Add (${bulkSel.length})` : 'Add'}
            </button>
          </div>
        </div>
      )}

      {/* Split view */}
      {splitMode ? (
        <div style={{ display:'flex', gap:7, overflowX:'auto' }}>
          {lanes.length === 0
            ? <div style={{ textAlign:'center', padding:'20px 0', color:'#94a3b8', fontSize:11, width:'100%' }}>No topics yet — add topics first.</div>
            : lanes.map(lane=>(
              <TeacherLane key={lane.id} teacher={lane.teacher} items={lane.items}
                logs={logs} onToggle={onToggle}
                onEditItem={adminMode?onEditItem:null}
                onDeleteItem={adminMode?(item=>onDelete(item.id)):null}
                onAssign={adminMode?onAssign:null}
                isAdmin={adminMode} />
            ))
          }
        </div>
      ) : (
        /* Flat list */
        <div style={{ maxHeight:380, overflowY:'auto' }}>
          {items.length === 0
            ? <div style={{ textAlign:'center', padding:'18px 0', color:'#94a3b8', fontSize:11 }}>No topics{adminMode?' — use Bulk or + to add':''}</div>
            : items.map((item,idx) => (
              <TopicRow key={item.id} item={item} index={idx}
                logs={logs} timetable={timetable} staffList={staffList} assignments={assignments}
                onToggle={onToggle} onDelete={onDelete} onEditTopic={onEditTopic}
                onAssign={adminMode?onAssign:null} onEditItem={adminMode?onEditItem:null}
                onMoveUp={moveUp} onMoveDown={moveDown} onMoveTop={moveTop} onMoveBottom={moveBottom}
                onDragStart={setDragIdx} onDragOver={()=>{}} onDrop={handleDrop}
                dragging={dragIdx===idx} onNavigateTab={onNavigateTab} isAdmin={adminMode}
              />
            ))
          }
        </div>
      )}
    </div>
  )
}

// ─── Cross-Tab Summary ─────────────────────────────────────────────────────────
function CrossTabSummary({ data, logs, timetable, missed, staffList, assignments, onNavigateTab }) {
  const { y, m } = currentYM()
  const curMK = monthKey(y, m)

  const logLinked    = useMemo(()=>data.filter(item=>logs?.find(l=>l.topic_taught?.toLowerCase()===item.topic.toLowerCase())).length,[data,logs])
  const ttSubjects   = useMemo(()=>new Set(timetable?.map(t=>t.subject_name)||[]),[timetable])
  const sylSubjects  = useMemo(()=>new Set(data.map(d=>d.subject_name)),[data])
  const covInTT      = [...sylSubjects].filter(s=>ttSubjects.has(s)).length
  const missedCount  = missed?.filter(m=>m.missed_date?.startsWith(curMK)).length||0
  const logsCount    = (logs||[]).filter(l=>l.teaching_date?.startsWith(curMK)).length
  const assignedPct  = data.length ? Math.round(data.filter(d=>d.assigned_staff_id||assignments?.some(a=>a.syllabus_id===d.id)).length/data.length*100) : 0

  return (
    <div style={{ ...S.card({ marginBottom:12 }) }}>
      <div style={{ fontSize:12, fontWeight:700, color:'#1e3a5f', marginBottom:8 }}>Live Overview</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:7 }}>
        {[
          {icon:'📋',label:'In Daily Logs',   value:logLinked,                         color:'#0891b2',bg:'#e0f2fe',tab:'logs'},
          {icon:'🕐',label:'In Timetable',    value:`${covInTT}/${sylSubjects.size}`,   color:'#7c3aed',bg:'#f3e8ff',tab:'timetable'},
          {icon:'❌',label:'Missed This Month',value:missedCount,                       color:'#dc2626',bg:'#fee2e2',tab:'calendar'},
          {icon:'📝',label:'Logs This Month', value:logsCount,                          color:'#16a34a',bg:'#dcfce7',tab:'logs'},
          {icon:'👤',label:'Assigned',        value:`${assignedPct}%`,                  color:'#b45309',bg:'#fef9c3',tab:null},
        ].map(s=>(
          <div key={s.label} onClick={()=>s.tab&&onNavigateTab?.(s.tab)}
            style={{ background:s.bg, borderRadius:7, padding:'8px 10px', borderLeft:`2px solid ${s.color}`, cursor:s.tab?'pointer':'default' }}>
            <div style={{ fontSize:13 }}>{s.icon}</div>
            <div style={{ fontSize:15, fontWeight:800, color:s.color, margin:'2px 0 1px' }}>{s.value}</div>
            <div style={{ fontSize:9, color:s.color, fontWeight:600 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Per-Teacher Report (admin view) ──────────────────────────────────────────
function TeacherReport({ data, staffList, assignments }) {
  const byTeacher = useMemo(() => {
    const map = {}
    data.forEach(item => {
      const asgn = assignments?.find(a=>a.syllabus_id===item.id && a.role==='primary')
      const sid  = asgn?.staff_id || item.assigned_staff_id || '__unassigned__'
      if (!map[sid]) map[sid] = { total:0, done:0 }
      map[sid].total++
      if (item.completed) map[sid].done++
    })
    return map
  }, [data, assignments])

  const entries = Object.entries(byTeacher).sort(([a],[b])=>a==='__unassigned__'?1:b==='__unassigned__'?-1:0)
  if (!entries.length) return null

  return (
    <div style={{ ...S.card({ marginBottom:12 }) }}>
      <div style={{ fontSize:12, fontWeight:700, color:'#1e3a5f', marginBottom:8 }}>Per-Teacher Progress</div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {entries.map(([sid, stat]) => {
          const isUn = sid === '__unassigned__'
          const color = isUn ? '#94a3b8' : staffColor(sid, staffList)
          const name  = isUn ? 'Unassigned' : staffName(sid, staffList)
          const pct   = stat.total ? Math.round(stat.done/stat.total*100) : 0
          return (
            <div key={sid}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                {!isUn && <StaffAvatar id={sid} staffList={staffList} size={22} />}
                <span style={{ fontSize:12, fontWeight:600, color:'#1e293b', flex:1 }}>{name}</span>
                <span style={{ fontSize:11, color:'#64748b' }}>{stat.done}/{stat.total}</span>
                <span style={{ fontSize:11, fontWeight:700, color }}>{pct}%</span>
              </div>
              <ProgressBar done={stat.done} total={stat.total} color={color} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function TabMonthlySyllabus({ logs=[], missed=[], timetable=[], staff=[], courseData, currentUser, onNavigateTab }) {
  const { courses } = courseData
  const { y:curY, m:curM } = currentYM()
  const admin = isAdmin(currentUser)

  // Data state
  const [data,         setData]         = useState([])
  const [assignments,  setAssignments]  = useState([])
  const [loading,      setLoading]      = useState(true)

  // Filter state
  const [selCourse,    setSelCourse]    = useState('')
  const [selAdmit,     setSelAdmit]     = useState('Navodaya')
  const [selYear,      setSelYear]      = useState(curY)
  const [selStaff,     setSelStaff]     = useState('') // teacher filter
  const [viewMode,     setViewMode]     = useState('horizontal')
  const [filterDone,   setFilterDone]   = useState('all')
  const [filterSubj,   setFilterSubj]   = useState('all')
  const [startMonth,   setStartMonth]   = useState(1)
  const [endMonth,     setEndMonth]     = useState(12)

  // Split mode per month key
  const [splitModes,   setSplitModes]   = useState({})

  // Modal state
  const [assignModal,  setAssignModal]  = useState(null)  // item being assigned
  const [editModal,    setEditModal]    = useState(null)   // item being edited/added
  const [addForMonth,  setAddForMonth]  = useState(null)   // month key for new topic
  const [confirm,      setConfirm]      = useState(null)   // { msg, onYes }
  const [toast,        setToast]        = useState(null)   // { msg, type }

  const showToast = (msg, type='success') => setToast({ msg, type })
  const askConfirm = (msg, onYes) => setConfirm({ msg, onYes })

  const subjects = useMemo(()=>Object.keys(SYLLABUS_BANK[selAdmit]||{}),[selAdmit])

  // ── Fetch ──
  const loadData = useCallback(async () => {
    setLoading(true)
    // Teacher: only fetch own assigned topics
    let q = supabase.from('monthly_syllabus').select('*').order('month').order('sort_order')
    if (selCourse) q = q.eq('course', selCourse)
    if (selAdmit)  q = q.eq('admit_type', selAdmit)
    if (selYear)   q = q.like('month', `${selYear}-%`)
    // Non-admin: filter by assigned_staff_id matching current user's staff id
    if (!admin && currentUser?.staff_id) {
      q = q.or(`assigned_staff_id.eq.${currentUser.staff_id},assigned_staff_id.is.null`)
    }
    const { data: rows, error } = await q
    if (error) { showToast('Failed to load syllabus', 'error'); setLoading(false); return }
    setData(rows || [])

    // Fetch assignments
    const { data: asgns } = await supabase.from('syllabus_assignments').select('*')
    setAssignments(asgns || [])
    setLoading(false)
  }, [selCourse, selAdmit, selYear, admin, currentUser])

  useEffect(() => { loadData() }, [loadData])

  // ── Derived ──
  const totalDone   = data.filter(d=>d.completed).length
  const totalTopics = data.length

  const monthsDone = useMemo(() => {
    const map = {}
    data.forEach(d => {
      if (!map[d.month]) map[d.month] = { done:0, total:0 }
      map[d.month].total++
      if (d.completed) map[d.month].done++
    })
    return map
  }, [data])

  const byMonth = useMemo(() => {
    const map = {}
    data.forEach(row => { if (!map[row.month]) map[row.month]=[]; map[row.month].push(row) })
    return map
  }, [data])

  const visibleMonths = useMemo(() => {
    if (startMonth > endMonth) return []
    const m=[]; for(let i=startMonth;i<=endMonth;i++) m.push(i); return m
  }, [startMonth, endMonth])

  const itemsFor = useCallback(mk => {
    let items = byMonth[mk] || []
    if (filterDone === 'done')    items = items.filter(i=>i.completed)
    if (filterDone === 'pending') items = items.filter(i=>!i.completed)
    if (filterSubj !== 'all')     items = items.filter(i=>i.subject_name===filterSubj)
    // Teacher filter
    if (selStaff) items = items.filter(i => {
      const asgn = assignments.find(a=>a.syllabus_id===i.id && a.role==='primary')
      return (asgn?.staff_id || i.assigned_staff_id) === selStaff
    })
    return items
  }, [byMonth, filterDone, filterSubj, selStaff, assignments])

  // ── Handlers ──
  const handleToggle = async item => {
    const completed = !item.completed
    const completed_at = completed ? new Date().toISOString() : null
    setData(d => d.map(r => r.id===item.id ? {...r,completed,completed_at} : r))
    const { error } = await supabase.from('monthly_syllabus').update({completed,completed_at}).eq('id',item.id)
    if (error) showToast('Update failed', 'error')
  }

  const handleDelete = id => {
    askConfirm('Delete this topic? This cannot be undone.', async () => {
      setData(d => d.filter(r=>r.id!==id))
      const { error } = await supabase.from('monthly_syllabus').delete().eq('id',id)
      if (error) { showToast('Delete failed','error'); loadData() }
      else showToast('Topic deleted')
      setConfirm(null)
    })
  }

  const handleEditTopic = async (id, topic) => {
    setData(d => d.map(r => r.id===id ? {...r,topic} : r))
    const { error } = await supabase.from('monthly_syllabus').update({topic}).eq('id',id)
    if (error) showToast('Update failed','error')
    else showToast('Topic updated')
  }

  const handleEditModalSave = async (item) => {
    if (item.id) {
      // Update
      setData(d => d.map(r => r.id===item.id ? {...r,...item} : r))
      const { error } = await supabase.from('monthly_syllabus').update({ topic:item.topic, subject_name:item.subject_name }).eq('id',item.id)
      if (error) showToast('Update failed','error')
      else showToast('Topic updated')
    } else {
      // Insert
      const payload = { course:selCourse||courses[0]||'', admit_type:selAdmit, subject_name:item.subject_name, topic:item.topic, month:item.month, sort_order:byMonth[item.month]?.length||0, completed:false }
      const { data:rows, error } = await supabase.from('monthly_syllabus').insert([payload]).select()
      if (error) showToast('Add failed','error')
      else { setData(d=>[...d,...rows]); showToast('Topic added') }
    }
  }

  const handleAddTopic = async (month, topic, subject_name) => {
    const payload = { course:selCourse||courses[0]||'', admit_type:selAdmit, subject_name:subject_name||subjects[0]||'', topic, month, sort_order:byMonth[month]?.length||0, completed:false }
    const { data:rows, error } = await supabase.from('monthly_syllabus').insert([payload]).select()
    if (!error && rows) { setData(d=>[...d,...rows]); showToast(`Added: ${topic}`) }
    else showToast('Add failed','error')
  }

  const handleBulkAdd = async (month, topics, subject_name) => {
    const base = byMonth[month]?.length || 0
    const payloads = topics.map((topic,i) => ({ course:selCourse||courses[0]||'', admit_type:selAdmit, subject_name:subject_name||subjects[0]||'', topic, month, sort_order:base+i, completed:false }))
    // Chunk to avoid hitting row limits
    for (let i=0; i<payloads.length; i+=50) {
      const chunk = payloads.slice(i, i+50)
      const { data:rows, error } = await supabase.from('monthly_syllabus').insert(chunk).select()
      if (!error && rows) setData(d=>[...d,...rows])
    }
    showToast(`Added ${topics.length} topics`)
  }

  const handleReorder = async (month, reordered) => {
    setData(prev => {
      const others  = prev.filter(r=>r.month!==month)
      const updated = reordered.map((r,i)=>({...r,sort_order:i}))
      return [...others,...updated]
    })
    // Batch updates — debounce via chunked Promise
    const updates = reordered.map((r,i) => supabase.from('monthly_syllabus').update({sort_order:i}).eq('id',r.id))
    await Promise.all(updates)
  }

  const handleLoadFullBank = async month => {
    const allTopics = []
    Object.entries(SYLLABUS_BANK[selAdmit]||{}).forEach(([subj,topics]) => {
      topics.forEach(t => { if(!byMonth[month]?.some(r=>r.topic===t&&r.subject_name===subj)) allTopics.push({subject_name:subj,topic:t}) })
    })
    if (!allTopics.length) { showToast('All topics already added','warn'); return }
    askConfirm(`Load ALL ${selAdmit} topics for ${MONTHS_LABEL[parseInt(month.split('-')[1])-1]}? (${allTopics.length} topics)`, async () => {
      const base = byMonth[month]?.length || 0
      const payloads = allTopics.map((t,i)=>({ course:selCourse||courses[0]||'', admit_type:selAdmit, subject_name:t.subject_name, topic:t.topic, month, sort_order:base+i, completed:false }))
      for (let i=0; i<payloads.length; i+=50) {
        const chunk = payloads.slice(i,i+50)
        const { data:rows, error } = await supabase.from('monthly_syllabus').insert(chunk).select()
        if (!error&&rows) setData(d=>[...d,...rows])
      }
      showToast(`Loaded ${allTopics.length} topics`)
      setConfirm(null)
    })
  }

  // ── Assign handler ──
  const handleAssignSave = async (item, primaryId, coTeachId) => {
    // 1. Update assigned_staff_id on the topic row itself (quick single-owner)
    await supabase.from('monthly_syllabus').update({ assigned_staff_id: primaryId || null }).eq('id', item.id)
    setData(d => d.map(r => r.id===item.id ? {...r,assigned_staff_id:primaryId||null} : r))

    // 2. Delete existing assignments for this topic
    await supabase.from('syllabus_assignments').delete().eq('syllabus_id', item.id)

    // 3. Re-insert
    const rows = []
    if (primaryId)  rows.push({ syllabus_id:item.id, staff_id:primaryId,  role:'primary' })
    if (coTeachId)  rows.push({ syllabus_id:item.id, staff_id:coTeachId,  role:'co-teacher' })
    if (rows.length) {
      const { data:asgns, error } = await supabase.from('syllabus_assignments').insert(rows).select()
      if (!error) setAssignments(prev => [...prev.filter(a=>a.syllabus_id!==item.id), ...(asgns||[])])
    } else {
      setAssignments(prev => prev.filter(a=>a.syllabus_id!==item.id))
    }
    showToast('Assignment saved')
  }

  // ── Bulk assign by subject ──
  const handleBulkAssignSubject = async (month, subject, staffId) => {
    if (!staffId) return
    const items = (byMonth[month]||[]).filter(i=>i.subject_name===subject)
    if (!items.length) { showToast('No topics for this subject','warn'); return }
    const updates = items.map(item => supabase.from('monthly_syllabus').update({assigned_staff_id:staffId}).eq('id',item.id))
    await Promise.all(updates)
    setData(d => d.map(r => items.some(i=>i.id===r.id) ? {...r,assigned_staff_id:staffId} : r))
    const rows = items.map(item => ({ syllabus_id:item.id, staff_id:staffId, role:'primary' }))
    await supabase.from('syllabus_assignments').upsert(rows, { onConflict:'syllabus_id,staff_id', ignoreDuplicates:false })
    await loadData()
    showToast(`${items.length} topics → ${staffName(staffId,staff)}`)
  }

  // ── Auto-sync (improved: exact match + log_id foreign key) ──
  const handleAutoSync = async () => {
    let synced = 0
    const updates = []
    for (const item of data) {
      if (item.completed) continue
      // Exact match first, then partial
      const match = logs.find(l=>l.topic_taught?.toLowerCase()===item.topic.toLowerCase())
              || logs.find(l=>l.topic_taught?.toLowerCase().includes(item.topic.toLowerCase().slice(0,18)))
      if (match) {
        updates.push({ id:item.id, completed:true, completed_at:new Date().toISOString(), log_id:match.id })
        synced++
      }
    }
    if (!synced) { showToast('No new matches found','warn'); return }
    for (const upd of updates) {
      await supabase.from('monthly_syllabus').update({ completed:upd.completed, completed_at:upd.completed_at, log_id:upd.log_id }).eq('id',upd.id)
    }
    setData(d => d.map(r => { const u=updates.find(x=>x.id===r.id); return u?{...r,...u}:r }))
    showToast(`Synced ${synced} topics from logs`)
  }

  // ── Export CSV ──
  const exportCSV = () => {
    const rows = [['Month','Subject','Topic','Status','Completed At','Assigned Teacher','Co-Teacher']]
    data.forEach(r => {
      const asgn   = assignments.find(a=>a.syllabus_id===r.id&&a.role==='primary')
      const co     = assignments.find(a=>a.syllabus_id===r.id&&a.role==='co-teacher')
      const tName  = staffName(asgn?.staff_id||r.assigned_staff_id, staff)
      const coName = co ? staffName(co.staff_id, staff) : ''
      rows.push([r.month, r.subject_name, r.topic, r.completed?'Done':'Pending', r.completed_at||'', tName, coName])
    })
    const csv = rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv],{type:'text/csv'}), url = URL.createObjectURL(blob)
    Object.assign(document.createElement('a'),{href:url,download:`syllabus_${selAdmit}_${selYear}.csv`}).click()
    URL.revokeObjectURL(url)
  }

  // ── Delete all in month (admin) ──
  const handleDeleteMonth = month => {
    const cnt = byMonth[month]?.length || 0
    if (!cnt) { showToast('Month is already empty','warn'); return }
    askConfirm(`Delete ALL ${cnt} topics for ${MONTHS_LABEL[parseInt(month.split('-')[1])-1]}? This cannot be undone.`, async () => {
      await supabase.from('monthly_syllabus').delete().eq('month',month).eq('admit_type',selAdmit)
      setData(d=>d.filter(r=>r.month!==month))
      showToast(`Deleted ${cnt} topics`)
      setConfirm(null)
    })
  }

  const colProps = {
    logs, timetable, staffList:staff, assignments,
    subjects, admit:selAdmit,
    onToggle:handleToggle, onDelete:handleDelete, onEditTopic:handleEditTopic,
    onAddTopic:handleAddTopic, onBulkAdd:handleBulkAdd, onReorder:handleReorder,
    onAssign:item=>setAssignModal(item),
    onEditItem:item=>setEditModal(item),
    onNavigateTab, isAdmin:admin,
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily:"'Segoe UI',sans-serif" }}>

      {/* ── Header ── */}
      <div style={{ background:'linear-gradient(135deg,#1e3a5f,#1e40af)', borderRadius:14, padding:'14px 18px', marginBottom:12, color:'white' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:8 }}>
          <div>
            <h2 style={{ margin:0, fontSize:18, fontWeight:800 }}>Monthly Syllabus Planner</h2>
            <p style={{ margin:'2px 0 0', fontSize:11, opacity:.75 }}>
              {admin ? 'Admin view · Full CRUD · Multi-teacher assignment' : `Teacher view · ${currentUser?.name||''}`}
            </p>
          </div>
          <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
            <button onClick={handleAutoSync} style={{ background:'rgba(255,255,255,.18)', color:'white', border:'1px solid rgba(255,255,255,.35)', borderRadius:7, padding:'5px 10px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>⚡ Auto-sync</button>
            <button onClick={exportCSV}      style={{ background:'rgba(255,255,255,.12)', color:'white', border:'1px solid rgba(255,255,255,.25)', borderRadius:7, padding:'5px 10px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>CSV ↓</button>
            <button onClick={loadData}       style={{ background:'rgba(255,255,255,.12)', color:'white', border:'1px solid rgba(255,255,255,.25)', borderRadius:7, padding:'5px 10px', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>↻</button>
          </div>
        </div>
        {/* Stats row */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(90px,1fr))', gap:6, marginTop:10 }}>
          {[
            {label:'Total',   value:totalTopics,            icon:'📚'},
            {label:'Done',    value:totalDone,              icon:'✅'},
            {label:'Pending', value:totalTopics-totalDone,  icon:'⏳'},
            {label:'Progress',value:`${totalTopics?Math.round(totalDone/totalTopics*100):0}%`,icon:'📈'},
            {label:'Staff',   value:staff?.length||0,       icon:'👥'},
          ].map(s=>(
            <div key={s.label} style={{ background:'rgba(255,255,255,.12)', borderRadius:7, padding:'6px 8px' }}>
              <div style={{ fontSize:13 }}>{s.icon}</div>
              <div style={{ fontSize:16, fontWeight:800, marginTop:1 }}>{s.value}</div>
              <div style={{ fontSize:9, opacity:.75 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Cross-tab summary ── */}
      <CrossTabSummary data={data} logs={logs} timetable={timetable} missed={missed}
        staffList={staff} assignments={assignments} onNavigateTab={onNavigateTab} />

      {/* ── Per-teacher report (admin only) ── */}
      {admin && <TeacherReport data={data} staffList={staff} assignments={assignments} />}

      {/* ── Bulk assign by subject (admin only) ── */}
      {admin && (
        <div style={{ ...S.card({ marginBottom:12 }) }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#1e3a5f', marginBottom:8 }}>Bulk Assign by Subject</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {subjects.map(subj => {
              const dominated = (() => {
                // Find most-assigned teacher for this subject across all visible months
                const counts = {}
                data.filter(d=>d.subject_name===subj).forEach(d=>{
                  const asgn = assignments.find(a=>a.syllabus_id===d.id&&a.role==='primary')
                  const sid  = asgn?.staff_id||d.assigned_staff_id||'__none__'
                  counts[sid]=(counts[sid]||0)+1
                })
                const top = Object.entries(counts).sort(([,a],[,b])=>b-a)[0]
                return top?.[0] || ''
              })()
              return (
                <div key={subj} style={{ display:'flex', alignItems:'center', gap:6, background:'#f8fafc', borderRadius:8, padding:'7px 10px', border:'1px solid #e2e8f0', flexWrap:'wrap', gap:6 }}>
                  <span style={{ fontSize:12, fontWeight:600, color:'#1e293b', whiteSpace:'nowrap' }}>{subj}</span>
                  <select defaultValue={dominated} onChange={e=>{
                    visibleMonths.forEach(m=>handleBulkAssignSubject(monthKey(selYear,m),subj,e.target.value))
                  }} style={{ ...S.sel, width:'auto', minWidth:120, fontSize:11, padding:'4px 7px' }}>
                    <option value="">— assign all →</option>
                    {staff?.filter(s=>s.is_active!==false).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Controls ── */}
      <div style={{ ...S.card({ marginBottom:10, display:'flex', flexWrap:'wrap', gap:8, alignItems:'flex-end' }) }}>
        {[
          {label:'COURSE',     node:<select value={selCourse}  onChange={e=>setSelCourse(e.target.value)}           style={S.sel}><option value="">All courses</option>{courses.map(c=><option key={c} value={c}>{c}</option>)}</select>},
          {label:'ADMIT TYPE', node:<select value={selAdmit}   onChange={e=>setSelAdmit(e.target.value)}            style={S.sel}>{ADMIT_TYPES.map(a=><option key={a} value={a}>{a}</option>)}</select>},
          {label:'YEAR',       node:<select value={selYear}    onChange={e=>setSelYear(Number(e.target.value))}     style={S.sel}>{[curY-1,curY,curY+1].map(y=><option key={y} value={y}>{y}</option>)}</select>},
          {label:'FROM',       node:<select value={startMonth} onChange={e=>setStartMonth(Number(e.target.value))} style={S.sel}>{MONTHS_LABEL.map((l,i)=><option key={i+1} value={i+1}>{l}</option>)}</select>},
          {label:'TO',         node:<select value={endMonth}   onChange={e=>setEndMonth(Number(e.target.value))}   style={S.sel}>{MONTHS_LABEL.map((l,i)=><option key={i+1} value={i+1}>{l}</option>)}</select>},
          {label:'STATUS',     node:<select value={filterDone} onChange={e=>setFilterDone(e.target.value)}         style={S.sel}><option value="all">All</option><option value="done">Done</option><option value="pending">Pending</option></select>},
          {label:'SUBJECT',    node:<select value={filterSubj} onChange={e=>setFilterSubj(e.target.value)}         style={S.sel}><option value="all">All subjects</option>{subjects.map(s=><option key={s} value={s}>{s}</option>)}</select>},
          ...(admin ? [{label:'TEACHER', node:<select value={selStaff} onChange={e=>setSelStaff(e.target.value)} style={S.sel}><option value="">All teachers</option>{staff?.filter(s=>s.is_active!==false).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>}] : []),
        ].map(f=>(
          <div key={f.label} style={{ minWidth:95 }}>
            <label style={{ display:'block', fontSize:9, fontWeight:700, color:'#6b7280', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.08em' }}>{f.label}</label>
            {f.node}
          </div>
        ))}
        {/* View mode buttons */}
        <div style={{ display:'flex', gap:3, marginLeft:'auto', alignSelf:'flex-end' }}>
          {[['horizontal','⬅➡'],['grid','⊞'],['list','☰']].map(([mode,icon])=>(
            <button key={mode} onClick={()=>setViewMode(mode)}
              style={{ padding:'6px 10px', borderRadius:7, border:'1px solid #d1d5db', cursor:'pointer', fontSize:13, background:viewMode===mode?'#1e3a5f':'white', color:viewMode===mode?'white':'#374151', fontFamily:'inherit' }}>
              {icon}
            </button>
          ))}
        </div>
      </div>

      {/* ── Month strip ── */}
      <div style={{ display:'flex', gap:5, overflowX:'auto', marginBottom:10, paddingBottom:4 }}>
        {visibleMonths.map(m => {
          const mk     = monthKey(selYear,m)
          const stat   = monthsDone[mk] || { done:0, total:0 }
          const pct    = stat.total ? Math.round(stat.done/stat.total*100) : 0
          const isNow  = m===curM && selYear===curY
          const acc    = MONTH_ACCENT[String(m).padStart(2,'0')] || '#1e3a5f'
          const logCt  = (logs||[]).filter(l=>l.teaching_date?.startsWith(mk)).length
          return (
            <div key={m} style={{ flex:'0 0 auto', padding:'5px 8px', borderRadius:8, background:isNow?acc:MONTH_COLORS[String(m).padStart(2,'0')], border:`1px solid ${acc}44`, textAlign:'center', minWidth:52 }}>
              <div style={{ fontSize:9,  fontWeight:700, color:isNow?'white':acc }}>{MONTHS_LABEL[m-1]}</div>
              <div style={{ fontSize:13, fontWeight:800, color:isNow?'white':acc }}>{pct}%</div>
              <div style={{ fontSize:8,  color:isNow?'rgba(255,255,255,.75)':'#64748b' }}>{stat.done}/{stat.total}</div>
              {logCt>0 && <div style={{ fontSize:8, color:isNow?'rgba(255,255,255,.65)':'#0891b2' }}>📋{logCt}</div>}
            </div>
          )
        })}
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div style={{ textAlign:'center', padding:48, color:'#94a3b8' }}>Loading…</div>
      ) : viewMode === 'horizontal' ? (
        <div style={{ display:'flex', gap:10, overflowX:'auto', paddingBottom:12, alignItems:'flex-start' }}>
          {visibleMonths.map(m => {
            const mk = monthKey(selYear,m)
            return (
              <div key={mk} style={{ flex:'0 0 auto' }}>
                <MonthColumn month={m} year={selYear}
                  allItems={byMonth[mk]||[]} items={itemsFor(mk)} {...colProps}
                  splitMode={!!splitModes[mk]}
                  setSplitMode={v=>setSplitModes(prev=>({...prev,[mk]:v}))}
                />
                {/* Month footer actions (admin) */}
                {admin && (
                  <div style={{ display:'flex', gap:4, marginTop:5 }}>
                    <button onClick={()=>handleLoadFullBank(mk)}
                      style={{ flex:1, padding:'4px', borderRadius:7, background:'transparent', border:'1px dashed #cbd5e1', fontSize:10, color:'#94a3b8', cursor:'pointer', fontFamily:'inherit' }}>
                      ⚡ Load all {selAdmit}
                    </button>
                    <button onClick={()=>{ setEditModal({ month:mk, subject_name:subjects[0]||'' }); setAddForMonth(mk) }}
                      style={{ padding:'4px 8px', borderRadius:7, background:'#1e3a5f18', border:'1px solid #1e3a5f33', fontSize:10, color:'#1e3a5f', cursor:'pointer', fontFamily:'inherit' }}>
                      + Topic
                    </button>
                    <button onClick={()=>handleDeleteMonth(mk)}
                      style={{ padding:'4px 8px', borderRadius:7, background:'#dc262618', border:'1px solid #dc262633', fontSize:10, color:'#dc2626', cursor:'pointer', fontFamily:'inherit' }}>
                      🗑
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : viewMode === 'grid' ? (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(265px,1fr))', gap:10 }}>
          {visibleMonths.map(m => {
            const mk = monthKey(selYear,m)
            return (
              <div key={mk}>
                <MonthColumn month={m} year={selYear}
                  allItems={byMonth[mk]||[]} items={itemsFor(mk)} {...colProps}
                  splitMode={!!splitModes[mk]}
                  setSplitMode={v=>setSplitModes(prev=>({...prev,[mk]:v}))}
                />
                {admin && (
                  <div style={{ display:'flex', gap:4, marginTop:5 }}>
                    <button onClick={()=>handleLoadFullBank(mk)} style={{ flex:1, padding:'4px', borderRadius:7, background:'transparent', border:'1px dashed #cbd5e1', fontSize:10, color:'#94a3b8', cursor:'pointer', fontFamily:'inherit' }}>⚡ Load all</button>
                    <button onClick={()=>setEditModal({ month:mk, subject_name:subjects[0]||'' })} style={{ padding:'4px 8px', borderRadius:7, background:'#1e3a5f18', border:'1px solid #1e3a5f33', fontSize:10, color:'#1e3a5f', cursor:'pointer', fontFamily:'inherit' }}>+ Topic</button>
                    <button onClick={()=>handleDeleteMonth(mk)} style={{ padding:'4px 8px', borderRadius:7, background:'#dc262618', border:'1px solid #dc262633', fontSize:10, color:'#dc2626', cursor:'pointer', fontFamily:'inherit' }}>🗑</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        /* List view */
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {visibleMonths.map(m => {
            const mk    = monthKey(selYear,m)
            const items = itemsFor(mk)
            const all   = byMonth[mk]||[]
            const done  = all.filter(i=>i.completed).length
            const acc   = MONTH_ACCENT[String(m).padStart(2,'0')] || '#1e3a5f'
            const logCt = (logs||[]).filter(l=>l.teaching_date?.startsWith(mk)).length
            return (
              <div key={mk} style={{ background:'white', borderRadius:12, border:'1px solid #e2e8f0', overflow:'hidden' }}>
                <div style={{ background:MONTH_COLORS[String(m).padStart(2,'0')], padding:'9px 12px', borderBottom:`2px solid ${acc}22`, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:7 }}>
                  <div style={{ fontWeight:800, fontSize:13, color:acc }}>
                    {MONTHS_LABEL[m-1]} {selYear}
                    <span style={{ marginLeft:6, fontSize:10, fontWeight:400, color:'#64748b' }}>{done}/{all.length} done</span>
                    {logCt>0 && <span onClick={()=>onNavigateTab?.('logs')} style={{ marginLeft:6, fontSize:10, color:'#0891b2', cursor:'pointer', fontWeight:600 }}>📋 {logCt} →</span>}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ minWidth:120 }}><ProgressBar done={done} total={all.length} color={acc} /></div>
                    {admin && (
                      <>
                        <button onClick={()=>setEditModal({ month:mk, subject_name:subjects[0]||'' })} style={{ padding:'3px 8px', borderRadius:6, background:'#1e3a5f18', border:'1px solid #1e3a5f33', fontSize:10, color:'#1e3a5f', cursor:'pointer', fontFamily:'inherit' }}>+ Topic</button>
                        <button onClick={()=>handleDeleteMonth(mk)} style={{ padding:'3px 6px', borderRadius:6, background:'#dc262618', border:'1px solid #dc262633', fontSize:10, color:'#dc2626', cursor:'pointer', fontFamily:'inherit' }}>🗑</button>
                      </>
                    )}
                  </div>
                </div>
                <div style={{ padding:'8px 12px' }}>
                  {items.length===0
                    ? <div style={{ color:'#94a3b8', fontSize:11, textAlign:'center', padding:'8px 0' }}>No topics{filterDone!=='all'?' for this filter':''}</div>
                    : items.map((item,idx)=>(
                      <TopicRow key={item.id} item={item} index={idx}
                        logs={logs} timetable={timetable} staffList={staff} assignments={assignments}
                        onToggle={handleToggle} onDelete={handleDelete} onEditTopic={handleEditTopic}
                        onAssign={admin?item=>setAssignModal(item):null}
                        onEditItem={admin?item=>setEditModal(item):null}
                        onMoveUp={i=>{const a=[...items];[a[i-1],a[i]]=[a[i],a[i-1]];handleReorder(mk,a)}}
                        onMoveDown={i=>{const a=[...items];[a[i],a[i+1]]=[a[i+1],a[i]];handleReorder(mk,a)}}
                        onMoveTop={i=>{const a=[...items];const[x]=a.splice(i,1);handleReorder(mk,[x,...a])}}
                        onMoveBottom={i=>{const a=[...items];const[x]=a.splice(i,1);handleReorder(mk,[...a,x])}}
                        onDragStart={()=>{}} onDragOver={()=>{}} onDrop={()=>{}} dragging={false}
                        onNavigateTab={onNavigateTab} isAdmin={admin}
                      />
                    ))
                  }
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modals ── */}
      {assignModal && (
        <AssignModal item={assignModal} staffList={staff} assignments={assignments}
          onSave={handleAssignSave} onClose={()=>setAssignModal(null)} />
      )}
      {editModal && (
        <TopicEditModal item={editModal} subjects={subjects} staffList={staff} assignments={assignments}
          onSave={handleEditModalSave} onClose={()=>{ setEditModal(null); setAddForMonth(null) }} />
      )}
      {confirm && (
        <ConfirmDialog msg={confirm.msg} onYes={confirm.onYes} onNo={()=>setConfirm(null)} />
      )}
      {toast && (
        <Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)} />
      )}
    </div>
  )
}