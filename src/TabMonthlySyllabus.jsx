// ─── TabMonthlySyllabus.jsx ───────────────────────────────────────────────────
// In Teaching.jsx render as:
// {activeTab==='monthly' && (
//   <TabMonthlySyllabus
//     logs={logs} missed={missed} timetable={timetable}
//     staff={staff} courseData={courseData} currentUser={currentUser}
//     onNavigateTab={key => setActiveTab(key)}
//   />
// )}

import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from './supabase'

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

const ADMIT_TYPES  = ['Navodaya','Sainik','Foundation']
const MONTHS_LABEL = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTH_COLORS = {'01':'#dbeafe','02':'#fce7f3','03':'#dcfce7','04':'#fef9c3','05':'#f3e8ff','06':'#e0f2fe','07':'#ffedd5','08':'#f1f5f9','09':'#fdf2f8','10':'#ecfdf5','11':'#fff7ed','12':'#eff6ff'}
const MONTH_ACCENT = {'01':'#1d4ed8','02':'#db2777','03':'#16a34a','04':'#b45309','05':'#7c3aed','06':'#0891b2','07':'#ea580c','08':'#475569','09':'#9d174d','10':'#065f46','11':'#c2410c','12':'#1e3a5f'}

const monthKey  = (y,m) => `${y}-${String(m).padStart(2,'0')}`
const currentYM = () => { const d=new Date(); return {y:d.getFullYear(),m:d.getMonth()+1} }
const fmtDate   = d => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short'}) : '-'
const sel       = { width:'100%', padding:'7px 9px', borderRadius:7, border:'1px solid #d1d5db', fontSize:12 }

function btnMini(color) {
  return { background:color, color:'white', border:'none', borderRadius:4, width:24, height:24, cursor:'pointer', fontSize:11, display:'flex', alignItems:'center', justifyContent:'center', padding:0, flexShrink:0 }
}

function Pill({ children, color='#1e3a5f', bg='#eff6ff', onClick, title }) {
  return (
    <span onClick={onClick} title={title} style={{ padding:'2px 7px', borderRadius:999, fontSize:10, fontWeight:700, background:bg, color, border:`1px solid ${color}33`, cursor:onClick?'pointer':'default', flexShrink:0, whiteSpace:'nowrap' }}>
      {children}
    </span>
  )
}

function ProgressBar({ done, total, color='#16a34a', height=6 }) {
  const pct = total ? Math.round((done/total)*100) : 0
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
      <div style={{ flex:1, height, background:'#e2e8f0', borderRadius:99, overflow:'hidden' }}>
        <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:99, transition:'width .4s' }} />
      </div>
      <span style={{ fontSize:11, fontWeight:700, color, minWidth:32, textAlign:'right' }}>{pct}%</span>
    </div>
  )
}

// ─── Topic Row ─────────────────────────────────────────────────────────────────
function TopicRow({ item, index, logs, timetable, onToggle, onDelete, onMoveUp, onMoveDown, onMoveTop, onMoveBottom, onEditTopic, onDragStart, onDragOver, onDrop, dragging, onNavigateTab }) {
  const linkedLog = useMemo(() => {
    if (!logs?.length) return null
    return logs.find(l=>l.id===item.log_id) ||
      logs.find(l=>l.topic_taught?.toLowerCase().includes(item.topic.toLowerCase().slice(0,14)))
  }, [logs, item])

  const timetableSlot = useMemo(() => {
    if (!timetable?.length||!item.subject_name) return null
    return timetable.find(t=>t.subject_name?.toLowerCase()===item.subject_name?.toLowerCase())
  }, [timetable, item])

  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState(item.topic)
  const [hovered, setHovered] = useState(false)
  const save = () => { if(editVal.trim()) onEditTopic(item.id,editVal.trim()); setEditing(false) }

  return (
    <div draggable
      onDragStart={()=>onDragStart(index)}
      onDragOver={e=>{e.preventDefault();onDragOver(index)}}
      onDrop={()=>onDrop(index)}
      onMouseEnter={()=>setHovered(true)}
      onMouseLeave={()=>setHovered(false)}
      style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 9px', borderRadius:7, background:dragging?'#f0fdf4':item.completed?'#f0fdf4':hovered?'#f8fafc':'white', border:`1px solid ${item.completed?'#bbf7d0':hovered?'#e2e8f0':'#f1f5f9'}`, marginBottom:3, cursor:'grab', transition:'all .12s', opacity:dragging?.5:1 }}>
      <span style={{ color:'#cbd5e1', fontSize:12, flexShrink:0 }}>⠿</span>
      <input type="checkbox" checked={!!item.completed} onChange={()=>onToggle(item)}
        style={{ width:14, height:14, cursor:'pointer', accentColor:'#16a34a', flexShrink:0 }} />
      {editing
        ? <input value={editVal} onChange={e=>setEditVal(e.target.value)} onBlur={save}
            onKeyDown={e=>{if(e.key==='Enter')save();if(e.key==='Escape')setEditing(false)}}
            autoFocus style={{ flex:1, fontSize:12, padding:'3px 6px', borderRadius:5, border:'1px solid #7c3aed', outline:'none' }} />
        : <span onDoubleClick={()=>setEditing(true)} style={{ flex:1, fontSize:12, color:item.completed?'#94a3b8':'#1e293b', textDecoration:item.completed?'line-through':'none', cursor:'text', lineHeight:1.3 }} title="Double-click to edit">{item.topic}</span>
      }
      <div style={{ display:'flex', gap:3, flexWrap:'wrap', justifyContent:'flex-end' }}>
        {linkedLog && (
          <Pill color="#0891b2" bg="#e0f2fe"
            onClick={()=>{ if(!item.completed) onToggle(item) }}
            title={`Taught ${fmtDate(linkedLog.teaching_date)} by ${linkedLog.teacher_name||'?'} — click to mark done`}>
            📋 {fmtDate(linkedLog.teaching_date)}
          </Pill>
        )}
        {timetableSlot && !linkedLog && (
          <Pill color="#7c3aed" bg="#f3e8ff"
            onClick={()=>onNavigateTab?.('timetable')}
            title={`In timetable: ${timetableSlot.day_name} P${timetableSlot.period_name}`}>
            🕐 {timetableSlot.day_name?.slice(0,3)}
          </Pill>
        )}
        {item.completed && <Pill color="#16a34a" bg="#dcfce7">✓</Pill>}
      </div>
      {hovered && (
        <div style={{ display:'flex', gap:2, flexShrink:0 }}>
          <button onClick={()=>onMoveTop(index)}    title="Top"    style={btnMini('#1e3a5f')}>⤒</button>
          <button onClick={()=>onMoveUp(index)}     title="Up"     style={btnMini('#1e3a5f')}>↑</button>
          <button onClick={()=>onMoveDown(index)}   title="Down"   style={btnMini('#1e3a5f')}>↓</button>
          <button onClick={()=>onMoveBottom(index)} title="Bottom" style={btnMini('#1e3a5f')}>⤓</button>
          <button onClick={()=>setEditing(true)}    title="Edit"   style={btnMini('#7c3aed')}>✏️</button>
          <button onClick={()=>onDelete(item.id)}   title="Delete" style={btnMini('#dc2626')}>🗑</button>
        </div>
      )}
    </div>
  )
}

// ─── Month Column ──────────────────────────────────────────────────────────────
function MonthColumn({ month, year, items, logs, timetable, onToggle, onDelete, onReorder, onEditTopic, onAddTopic, onBulkAdd, subjects, admit, onNavigateTab }) {
  const [dragIdx,  setDragIdx]  = useState(null)
  const [newTopic, setNewTopic] = useState('')
  const [showAdd,  setShowAdd]  = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [bulkSel,  setBulkSel]  = useState([])
  const [bulkSubj, setBulkSubj] = useState(subjects[0]||'')

  const mk     = monthKey(year,month)
  const label  = MONTHS_LABEL[month-1]
  const bg     = MONTH_COLORS[String(month).padStart(2,'0')]||'#f8fafc'
  const accent = MONTH_ACCENT[String(month).padStart(2,'0')]||'#1e3a5f'
  const done   = items.filter(i=>i.completed).length

  const loggedCount = useMemo(()=>
    items.filter(item=>logs?.find(l=>l.topic_taught?.toLowerCase().includes(item.topic.toLowerCase().slice(0,14)))).length
  ,[items,logs])

  const bankTopics = (SYLLABUS_BANK[admit]?.[bulkSubj]||[]).filter(t=>!items.some(i=>i.topic===t&&i.subject_name===bulkSubj))

  const handleDrop = toIdx => {
    if(dragIdx===null||dragIdx===toIdx){setDragIdx(null);return}
    const a=[...items];const[x]=a.splice(dragIdx,1);a.splice(toIdx,0,x)
    onReorder(mk,a);setDragIdx(null)
  }
  const moveUp     = i => { if(i===0)return;const a=[...items];[a[i-1],a[i]]=[a[i],a[i-1]];onReorder(mk,a) }
  const moveDown   = i => { if(i===items.length-1)return;const a=[...items];[a[i],a[i+1]]=[a[i+1],a[i]];onReorder(mk,a) }
  const moveTop    = i => { const a=[...items];const[x]=a.splice(i,1);onReorder(mk,[x,...a]) }
  const moveBottom = i => { const a=[...items];const[x]=a.splice(i,1);onReorder(mk,[...a,x]) }
  const addSingle  = () => { if(!newTopic.trim())return;onAddTopic(mk,newTopic.trim(),bulkSubj||subjects[0]);setNewTopic('') }
  const addBulk    = () => { if(!bulkSel.length)return;onBulkAdd(mk,bulkSel,bulkSubj);setBulkSel([]);setShowBulk(false) }

  return (
    <div style={{ background:bg, borderRadius:12, border:`1.5px solid ${accent}33`, padding:11, minWidth:255, flex:'0 0 265px' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:7 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:800, color:accent }}>{label} {year}</div>
          <div style={{ fontSize:10, color:'#64748b' }}>{done}/{items.length} done</div>
          {loggedCount>0 && (
            <div style={{ fontSize:9, color:'#0891b2', cursor:'pointer', marginTop:1 }} onClick={()=>onNavigateTab?.('logs')} title="View Daily Logs">
              📋 {loggedCount} in logs →
            </div>
          )}
        </div>
        <div style={{ display:'flex', gap:3 }}>
          <button onClick={()=>{setShowBulk(!showBulk);setShowAdd(false)}} style={{ ...btnMini('#7c3aed'), width:'auto', padding:'3px 6px', fontSize:10, borderRadius:5 }}>📋 Bulk</button>
          <button onClick={()=>{setShowAdd(!showAdd);setShowBulk(false)}} style={{ ...btnMini(accent), width:'auto', padding:'3px 6px', fontSize:10, borderRadius:5 }}>{showAdd?'✕':'➕'}</button>
        </div>
      </div>

      {items.length>0 && <div style={{ marginBottom:6 }}><ProgressBar done={done} total={items.length} color={accent} /></div>}
      {items.length>0&&loggedCount>0 && (
        <div style={{ marginBottom:6 }}>
          <div style={{ fontSize:9, color:'#0891b2', marginBottom:2 }}>📋 Log coverage</div>
          <ProgressBar done={loggedCount} total={items.length} color="#0891b2" height={4} />
        </div>
      )}

      {showAdd && (
        <div style={{ marginBottom:7, background:'white', borderRadius:7, padding:7, border:`1px solid ${accent}44` }}>
          <select value={bulkSubj} onChange={e=>setBulkSubj(e.target.value)} style={{ width:'100%', padding:'4px 6px', borderRadius:5, border:'1px solid #d1d5db', fontSize:11, marginBottom:4 }}>
            {subjects.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
          <div style={{ display:'flex', gap:4 }}>
            <input value={newTopic} onChange={e=>setNewTopic(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addSingle()} placeholder="Topic name..." style={{ flex:1, padding:'4px 6px', borderRadius:5, border:'1px solid #d1d5db', fontSize:11 }} />
            <button onClick={addSingle} style={{ ...btnMini('#16a34a'), borderRadius:5 }}>✓</button>
          </div>
        </div>
      )}

      {showBulk && (
        <div style={{ marginBottom:7, background:'white', borderRadius:7, padding:7, border:'1px solid #7c3aed44' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#7c3aed', marginBottom:4 }}>📚 Add from Syllabus Bank</div>
          <select value={bulkSubj} onChange={e=>{setBulkSubj(e.target.value);setBulkSel([])}} style={{ width:'100%', padding:'4px 6px', borderRadius:5, border:'1px solid #d1d5db', fontSize:11, marginBottom:4 }}>
            {subjects.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
          <div style={{ maxHeight:130, overflowY:'auto', marginBottom:4 }}>
            {bankTopics.length===0
              ? <div style={{ fontSize:10, color:'#94a3b8', padding:5 }}>All topics added.</div>
              : bankTopics.map(t=>(
                <label key={t} style={{ display:'flex', alignItems:'center', gap:4, padding:'2px 0', cursor:'pointer', fontSize:11 }}>
                  <input type="checkbox" checked={bulkSel.includes(t)} onChange={e=>setBulkSel(s=>e.target.checked?[...s,t]:s.filter(x=>x!==t))} style={{ accentColor:'#7c3aed' }} />
                  {t}
                </label>
              ))
            }
          </div>
          <div style={{ display:'flex', gap:3 }}>
            <button onClick={()=>setBulkSel(bankTopics)} style={{ ...btnMini('#64748b'), width:'auto', padding:'3px 6px', fontSize:10, borderRadius:5 }}>All</button>
            <button onClick={()=>setBulkSel([])}         style={{ ...btnMini('#94a3b8'), width:'auto', padding:'3px 6px', fontSize:10, borderRadius:5 }}>None</button>
            <button onClick={addBulk} style={{ ...btnMini('#7c3aed'), width:'auto', padding:'3px 6px', fontSize:10, borderRadius:5, flex:1 }}>➕ {bulkSel.length>0?`Add (${bulkSel.length})`:'Add'}</button>
          </div>
        </div>
      )}

      <div style={{ maxHeight:390, overflowY:'auto' }}>
        {items.length===0
          ? <div style={{ textAlign:'center', padding:'18px 0', color:'#94a3b8', fontSize:11 }}>No topics — use Bulk or ➕</div>
          : items.map((item,idx)=>(
            <TopicRow key={item.id} item={item} index={idx} logs={logs} timetable={timetable}
              onToggle={onToggle} onDelete={onDelete} onEditTopic={onEditTopic}
              onMoveUp={moveUp} onMoveDown={moveDown} onMoveTop={moveTop} onMoveBottom={moveBottom}
              onDragStart={setDragIdx} onDragOver={()=>{}} onDrop={handleDrop}
              dragging={dragIdx===idx} onNavigateTab={onNavigateTab}
            />
          ))
        }
      </div>
    </div>
  )
}

// ─── Cross-Tab Summary ─────────────────────────────────────────────────────────
function CrossTabSummary({ data, logs, timetable, missed, onNavigateTab }) {
  const curMonth = monthKey(currentYM().y, currentYM().m)
  const logLinked = useMemo(()=>data.filter(item=>logs?.find(l=>l.topic_taught?.toLowerCase().includes(item.topic.toLowerCase().slice(0,14)))).length,[data,logs])
  const timetableSubjects = useMemo(()=>new Set(timetable?.map(t=>t.subject_name)||[]),[timetable])
  const syllabusSubjects  = useMemo(()=>new Set(data.map(d=>d.subject_name)),[data])
  const coveredInTT = [...syllabusSubjects].filter(s=>timetableSubjects.has(s)).length
  const missedThisMonth = missed?.filter(m=>m.missed_date?.startsWith(curMonth)).length||0
  const logsThisMonth   = (logs||[]).filter(l=>l.teaching_date?.startsWith(curMonth)).length

  const recentMatches = useMemo(()=>
    (logs||[]).slice(0,30).filter(l=>data.some(d=>!d.completed&&d.topic.toLowerCase().includes((l.topic_taught||'').toLowerCase().slice(0,12)))).slice(0,4)
  ,[logs,data])

  return (
    <div style={{ background:'white', borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,.06)', padding:14, marginBottom:14 }}>
      <div style={{ fontSize:12, fontWeight:800, color:'#1e3a5f', marginBottom:10 }}>🔗 Cross-Tab Live Links</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:8, marginBottom:10 }}>
        {[
          {icon:'📋',label:'Topics in Logs',       value:logLinked,                                   color:'#0891b2',bg:'#e0f2fe',tab:'logs'},
          {icon:'🕐',label:'Subjects in Timetable', value:`${coveredInTT}/${syllabusSubjects.size}`,  color:'#7c3aed',bg:'#f3e8ff',tab:'timetable'},
          {icon:'❌',label:'Missed This Month',      value:missedThisMonth,                            color:'#dc2626',bg:'#fee2e2',tab:'calendar'},
          {icon:'📝',label:'Logs This Month',        value:logsThisMonth,                              color:'#16a34a',bg:'#dcfce7',tab:'logs'},
        ].map(s=>(
          <div key={s.label} onClick={()=>onNavigateTab?.(s.tab)} title={`Go to ${s.tab}`}
            style={{ background:s.bg, borderRadius:8, padding:'9px 11px', borderLeft:`3px solid ${s.color}`, cursor:'pointer', transition:'transform .1s' }}
            onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
            onMouseLeave={e=>e.currentTarget.style.transform=''}>
            <div style={{ fontSize:15 }}>{s.icon}</div>
            <div style={{ fontSize:17, fontWeight:800, color:s.color, margin:'1px 0' }}>{s.value}</div>
            <div style={{ fontSize:10, color:s.color, fontWeight:600 }}>{s.label}</div>
            <div style={{ fontSize:9, color:'#94a3b8', marginTop:2 }}>→ {s.tab}</div>
          </div>
        ))}
      </div>
      {recentMatches.length>0 && (
        <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, padding:'9px 11px' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#16a34a', marginBottom:5 }}>
            💡 {recentMatches.length} pending topic{recentMatches.length>1?'s':''} found in recent logs — mark done?
          </div>
          {recentMatches.map(l=>(
            <div key={l.id} style={{ fontSize:11, color:'#15803d', padding:'1px 0' }}>
              📋 {fmtDate(l.teaching_date)} — <strong>{l.topic_taught}</strong>
              {l.teacher_name&&<span style={{ color:'#64748b' }}> · {l.teacher_name}</span>}
            </div>
          ))}
          <button onClick={()=>onNavigateTab?.('logs')} style={{ marginTop:6, padding:'4px 10px', background:'#16a34a', color:'white', border:'none', borderRadius:5, fontSize:11, fontWeight:600, cursor:'pointer' }}>
            View Daily Logs →
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function TabMonthlySyllabus({ logs=[], missed=[], timetable=[], courseData, currentUser, onNavigateTab }) {
  const { courses } = courseData
  const { y:curY, m:curM } = currentYM()

  const [data,       setData]       = useState([])
  const [loading,    setLoading]    = useState(true)
  const [selCourse,  setSelCourse]  = useState('')
  const [selAdmit,   setSelAdmit]   = useState('Navodaya')
  const [selYear,    setSelYear]    = useState(curY)
  const [viewMode,   setViewMode]   = useState('horizontal')
  const [filterDone, setFilterDone] = useState('all')
  const [startMonth, setStartMonth] = useState(1)
  const [endMonth,   setEndMonth]   = useState(12)

  const subjects    = useMemo(()=>Object.keys(SYLLABUS_BANK[selAdmit]||{}),[selAdmit])
  const totalDone   = data.filter(d=>d.completed).length
  const totalTopics = data.length

  const monthsDone = useMemo(()=>{
    const map={}
    data.forEach(d=>{if(!map[d.month])map[d.month]={done:0,total:0};map[d.month].total++;if(d.completed)map[d.month].done++})
    return map
  },[data])

  const fetch = useCallback(async()=>{
    setLoading(true)
    let q=supabase.from('monthly_syllabus').select('*').order('month').order('sort_order')
    if(selCourse) q=q.eq('course',selCourse)
    if(selAdmit)  q=q.eq('admit_type',selAdmit)
    const {data:rows,error}=await q
    if(!error) setData(rows||[])
    setLoading(false)
  },[selCourse,selAdmit])

  useEffect(()=>{fetch()},[fetch])

  const handleAutoSync = async()=>{
    let synced=0
    for(const item of data){
      if(item.completed) continue
      const match=logs.find(l=>l.topic_taught?.toLowerCase().includes(item.topic.toLowerCase().slice(0,14)))
      if(match){
        await supabase.from('monthly_syllabus').update({completed:true,completed_at:new Date().toISOString(),log_id:match.id}).eq('id',item.id)
        synced++
      }
    }
    if(synced>0){alert(`✅ Auto-synced ${synced} topics from Daily Logs!`);fetch()}
    else alert('No new matches found.')
  }

  const byMonth = useMemo(()=>{
    const map={}
    data.forEach(row=>{if(!map[row.month])map[row.month]=[];map[row.month].push(row)})
    return map
  },[data])

  const visibleMonths = useMemo(()=>{const m=[];for(let i=startMonth;i<=endMonth;i++)m.push(i);return m},[startMonth,endMonth])
  const itemsFor = useCallback(mk=>{
    let items=byMonth[mk]||[]
    if(filterDone==='done')    items=items.filter(i=>i.completed)
    if(filterDone==='pending') items=items.filter(i=>!i.completed)
    return items
  },[byMonth,filterDone])

  const handleToggle = async item=>{
    const completed=!item.completed, completed_at=completed?new Date().toISOString():null
    setData(d=>d.map(r=>r.id===item.id?{...r,completed,completed_at}:r))
    await supabase.from('monthly_syllabus').update({completed,completed_at}).eq('id',item.id)
  }
  const handleDelete = async id=>{
    if(!window.confirm('Delete this topic?'))return
    setData(d=>d.filter(r=>r.id!==id))
    await supabase.from('monthly_syllabus').delete().eq('id',id)
  }
  const handleEditTopic = async(id,topic)=>{
    setData(d=>d.map(r=>r.id===id?{...r,topic}:r))
    await supabase.from('monthly_syllabus').update({topic}).eq('id',id)
  }
  const handleAddTopic = async(month,topic,subject_name)=>{
    const payload={course:selCourse||courses[0]||'',admit_type:selAdmit,subject_name:subject_name||subjects[0]||'',topic,month,sort_order:byMonth[month]?.length||0,completed:false}
    const {data:rows,error}=await supabase.from('monthly_syllabus').insert([payload]).select()
    if(!error&&rows) setData(d=>[...d,...rows])
  }
  const handleBulkAdd = async(month,topics,subject_name)=>{
    const base=byMonth[month]?.length||0
    const payloads=topics.map((topic,i)=>({course:selCourse||courses[0]||'',admit_type:selAdmit,subject_name:subject_name||subjects[0]||'',topic,month,sort_order:base+i,completed:false}))
    const {data:rows,error}=await supabase.from('monthly_syllabus').insert(payloads).select()
    if(!error&&rows) setData(d=>[...d,...rows])
  }
  const handleReorder = async(month,reordered)=>{
    setData(prev=>{const others=prev.filter(r=>r.month!==month);const updated=reordered.map((r,i)=>({...r,sort_order:i}));return[...others,...updated]})
    await Promise.all(reordered.map((r,i)=>supabase.from('monthly_syllabus').update({sort_order:i}).eq('id',r.id)))
  }
  const handleLoadFullBank = async month=>{
    if(!window.confirm(`Load ALL ${selAdmit} topics for ${MONTHS_LABEL[parseInt(month.split('-')[1])-1]}?`))return
    const allTopics=[]
    Object.entries(SYLLABUS_BANK[selAdmit]||{}).forEach(([subj,topics])=>{topics.forEach(t=>{if(!byMonth[month]?.some(r=>r.topic===t&&r.subject_name===subj))allTopics.push({subject_name:subj,topic:t})})})
    if(!allTopics.length)return alert('All topics already added!')
    const base=byMonth[month]?.length||0
    const payloads=allTopics.map((t,i)=>({course:selCourse||courses[0]||'',admit_type:selAdmit,subject_name:t.subject_name,topic:t.topic,month,sort_order:base+i,completed:false}))
    const {data:rows,error}=await supabase.from('monthly_syllabus').insert(payloads).select()
    if(!error&&rows) setData(d=>[...d,...rows])
  }
  const exportCSV=()=>{
    const rows=[['Month','Subject','Topic','Status','Completed At']]
    data.forEach(r=>rows.push([r.month,r.subject_name,r.topic,r.completed?'Done':'Pending',r.completed_at||'']))
    const csv=rows.map(r=>r.map(v=>`"${v}"`).join(',')).join('\n')
    const blob=new Blob([csv],{type:'text/csv'}),url=URL.createObjectURL(blob)
    Object.assign(document.createElement('a'),{href:url,download:`syllabus_${selAdmit}_${selYear}.csv`}).click()
    URL.revokeObjectURL(url)
  }

  const colProps = { logs, timetable, subjects, admit:selAdmit, onToggle:handleToggle, onDelete:handleDelete, onEditTopic:handleEditTopic, onAddTopic:handleAddTopic, onBulkAdd:handleBulkAdd, onReorder:handleReorder, onNavigateTab }

  return (
    <div style={{ fontFamily:"'Segoe UI',sans-serif" }}>

      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#1e3a5f,#1e40af)', borderRadius:14, padding:'16px 20px', marginBottom:14, color:'white' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:8 }}>
          <div>
            <h2 style={{ margin:0, fontSize:19, fontWeight:800 }}>📆 Monthly Syllabus Planner</h2>
            <p style={{ margin:'2px 0 0', fontSize:11, opacity:.8 }}>Linked · Daily Logs · Timetable · Calendar · Reports</p>
          </div>
          <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
            <button onClick={handleAutoSync} style={{ background:'rgba(255,255,255,.2)', color:'white', border:'1px solid rgba(255,255,255,.4)', borderRadius:7, padding:'5px 11px', fontSize:11, fontWeight:700, cursor:'pointer' }}>⚡ Auto-sync Logs</button>
            <button onClick={exportCSV}      style={{ background:'rgba(255,255,255,.15)', color:'white', border:'1px solid rgba(255,255,255,.3)', borderRadius:7, padding:'5px 11px', fontSize:11, fontWeight:700, cursor:'pointer' }}>⬇ CSV</button>
            <button onClick={fetch}          style={{ background:'rgba(255,255,255,.15)', color:'white', border:'1px solid rgba(255,255,255,.3)', borderRadius:7, padding:'5px 11px', fontSize:11, fontWeight:700, cursor:'pointer' }}>🔄</button>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(100px,1fr))', gap:7, marginTop:12 }}>
          {[
            {label:'Total',     value:totalTopics,           icon:'📚'},
            {label:'Done',      value:totalDone,             icon:'✅'},
            {label:'Pending',   value:totalTopics-totalDone, icon:'⏳'},
            {label:'Progress',  value:`${totalTopics?Math.round(totalDone/totalTopics*100):0}%`, icon:'📈'},
            {label:'In Logs',   value:data.filter(item=>logs?.find(l=>l.topic_taught?.toLowerCase().includes(item.topic.toLowerCase().slice(0,14)))).length, icon:'📋'},
          ].map(s=>(
            <div key={s.label} style={{ background:'rgba(255,255,255,.12)', borderRadius:8, padding:'7px 9px' }}>
              <div style={{ fontSize:14 }}>{s.icon}</div>
              <div style={{ fontSize:17, fontWeight:800, marginTop:1 }}>{s.value}</div>
              <div style={{ fontSize:9, opacity:.75 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Cross-tab summary */}
      <CrossTabSummary data={data} logs={logs} timetable={timetable} missed={missed} onNavigateTab={onNavigateTab} />

      {/* Controls */}
      <div style={{ background:'white', borderRadius:12, padding:12, marginBottom:12, boxShadow:'0 2px 8px rgba(0,0,0,.06)', display:'flex', flexWrap:'wrap', gap:8, alignItems:'flex-end' }}>
        {[
          {label:'COURSE',     node:<select value={selCourse}  onChange={e=>setSelCourse(e.target.value)}         style={sel}><option value="">All</option>{courses.map(c=><option key={c} value={c}>{c}</option>)}</select>},
          {label:'ADMIT TYPE', node:<select value={selAdmit}   onChange={e=>setSelAdmit(e.target.value)}          style={sel}>{ADMIT_TYPES.map(a=><option key={a} value={a}>{a}</option>)}</select>},
          {label:'YEAR',       node:<select value={selYear}    onChange={e=>setSelYear(Number(e.target.value))}   style={sel}>{[curY-1,curY,curY+1].map(y=><option key={y} value={y}>{y}</option>)}</select>},
          {label:'FROM',       node:<select value={startMonth} onChange={e=>setStartMonth(Number(e.target.value))} style={sel}>{MONTHS_LABEL.map((l,i)=><option key={i+1} value={i+1}>{l}</option>)}</select>},
          {label:'TO',         node:<select value={endMonth}   onChange={e=>setEndMonth(Number(e.target.value))}  style={sel}>{MONTHS_LABEL.map((l,i)=><option key={i+1} value={i+1}>{l}</option>)}</select>},
          {label:'SHOW',       node:<select value={filterDone} onChange={e=>setFilterDone(e.target.value)}        style={sel}><option value="all">All</option><option value="done">Done</option><option value="pending">Pending</option></select>},
        ].map(f=>(
          <div key={f.label} style={{ minWidth:100 }}>
            <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#374151', marginBottom:3 }}>{f.label}</label>
            {f.node}
          </div>
        ))}
        <div style={{ display:'flex', gap:3, marginLeft:'auto' }}>
          {[['horizontal','⬅➡'],['grid','⊞'],['list','☰']].map(([mode,icon])=>(
            <button key={mode} onClick={()=>setViewMode(mode)} style={{ padding:'6px 10px', borderRadius:7, border:'1px solid #d1d5db', cursor:'pointer', fontSize:13, background:viewMode===mode?'#1e3a5f':'white', color:viewMode===mode?'white':'#374151', fontWeight:viewMode===mode?700:400 }}>{icon}</button>
          ))}
        </div>
      </div>

      {/* Month strip */}
      <div style={{ display:'flex', gap:5, overflowX:'auto', marginBottom:12, paddingBottom:4 }}>
        {visibleMonths.map(m=>{
          const mk=monthKey(selYear,m),stat=monthsDone[mk]||{done:0,total:0}
          const pct=stat.total?Math.round(stat.done/stat.total*100):0
          const isNow=m===curM&&selYear===curY
          const accent=MONTH_ACCENT[String(m).padStart(2,'0')]||'#1e3a5f'
          const logCt=(logs||[]).filter(l=>l.teaching_date?.startsWith(mk)).length
          return (
            <div key={m} style={{ flex:'0 0 auto', padding:'6px 9px', borderRadius:8, background:isNow?accent:MONTH_COLORS[String(m).padStart(2,'0')], border:`1px solid ${accent}44`, textAlign:'center', minWidth:55 }}>
              <div style={{ fontSize:10, fontWeight:700, color:isNow?'white':accent }}>{MONTHS_LABEL[m-1]}</div>
              <div style={{ fontSize:14, fontWeight:800, color:isNow?'white':accent }}>{pct}%</div>
              <div style={{ fontSize:9, color:isNow?'rgba(255,255,255,.8)':'#64748b' }}>{stat.done}/{stat.total}</div>
              {logCt>0&&<div style={{ fontSize:8, color:isNow?'rgba(255,255,255,.7)':'#0891b2' }}>📋{logCt}</div>}
            </div>
          )
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign:'center', padding:48, color:'#94a3b8' }}>⏳ Loading…</div>
      ) : viewMode==='horizontal' ? (
        <div style={{ display:'flex', gap:11, overflowX:'auto', paddingBottom:12, alignItems:'flex-start' }}>
          {visibleMonths.map(m=>{
            const mk=monthKey(selYear,m)
            return (
              <div key={mk} style={{ flex:'0 0 265px' }}>
                <MonthColumn month={m} year={selYear} items={itemsFor(mk)} {...colProps} />
                <button onClick={()=>handleLoadFullBank(mk)} style={{ width:'100%', marginTop:5, padding:'4px', borderRadius:7, background:'transparent', border:'1px dashed #cbd5e1', fontSize:10, color:'#94a3b8', cursor:'pointer' }}>⚡ Load all {selAdmit}</button>
              </div>
            )
          })}
        </div>
      ) : viewMode==='grid' ? (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(265px,1fr))', gap:11 }}>
          {visibleMonths.map(m=>{
            const mk=monthKey(selYear,m)
            return (
              <div key={mk}>
                <MonthColumn month={m} year={selYear} items={itemsFor(mk)} {...colProps} />
                <button onClick={()=>handleLoadFullBank(mk)} style={{ width:'100%', marginTop:5, padding:'4px', borderRadius:7, background:'transparent', border:'1px dashed #cbd5e1', fontSize:10, color:'#94a3b8', cursor:'pointer' }}>⚡ Load all {selAdmit}</button>
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {visibleMonths.map(m=>{
            const mk=monthKey(selYear,m),items=itemsFor(mk),done=items.filter(i=>i.completed).length
            const accent=MONTH_ACCENT[String(m).padStart(2,'0')]||'#1e3a5f'
            const logCt=(logs||[]).filter(l=>l.teaching_date?.startsWith(mk)).length
            return (
              <div key={mk} style={{ background:'white', borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,.06)', overflow:'hidden' }}>
                <div style={{ background:MONTH_COLORS[String(m).padStart(2,'0')], padding:'10px 13px', borderBottom:`2px solid ${accent}33`, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:7 }}>
                  <div style={{ fontWeight:800, fontSize:13, color:accent }}>
                    {MONTHS_LABEL[m-1]} {selYear}
                    <span style={{ marginLeft:7, fontSize:11, fontWeight:400, color:'#64748b' }}>{done}/{items.length} done</span>
                    {logCt>0&&<span onClick={()=>onNavigateTab?.('logs')} style={{ marginLeft:7, fontSize:10, color:'#0891b2', cursor:'pointer', fontWeight:600 }}>📋 {logCt} logs →</span>}
                  </div>
                  <div style={{ minWidth:140 }}><ProgressBar done={done} total={items.length} color={accent} /></div>
                </div>
                <div style={{ padding:'9px 13px' }}>
                  {items.length===0
                    ? <div style={{ color:'#94a3b8', fontSize:11, textAlign:'center', padding:'9px 0' }}>No topics</div>
                    : items.map((item,idx)=>(
                      <TopicRow key={item.id} item={item} index={idx} logs={logs} timetable={timetable}
                        onToggle={handleToggle} onDelete={handleDelete} onEditTopic={handleEditTopic}
                        onMoveUp={i=>{const a=[...items];[a[i-1],a[i]]=[a[i],a[i-1]];handleReorder(mk,a)}}
                        onMoveDown={i=>{const a=[...items];[a[i],a[i+1]]=[a[i+1],a[i]];handleReorder(mk,a)}}
                        onMoveTop={i=>{const a=[...items];const[x]=a.splice(i,1);handleReorder(mk,[x,...a])}}
                        onMoveBottom={i=>{const a=[...items];const[x]=a.splice(i,1);handleReorder(mk,[...a,x])}}
                        onDragStart={()=>{}} onDragOver={()=>{}} onDrop={()=>{}} dragging={false}
                        onNavigateTab={onNavigateTab}
                      />
                    ))
                  }
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}