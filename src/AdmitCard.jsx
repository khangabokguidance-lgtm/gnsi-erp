import React, { useState, useRef, useCallback } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// AdmitCard — Mobile-first admit card generator for GNSI
// Designed for: portrait A5 print + full mobile preview
// ─────────────────────────────────────────────────────────────────────────────

const EXAM_TYPES = [
  'Jawahar Navodaya Vidyalaya Selection Test (JNVST)',
  'All India Sainik Schools Entrance Exam (AISSEE)',
  'Combined Entrance Examination',
]
const COURSES = ['Navodaya Group', 'Sainik Group', 'Foundation Group', 'Combined Course']
const BATCHES = ['9th Batch (2026-27)', '8th Batch (2025-26)', '10th Batch (2027-28)']
const VENUES  = [
  'Khangabok Government High School, Thoubal',
  'Lilong Model High School, Thoubal',
  'GNSI Campus, Khangabok',
]

// ── Colour tokens ─────────────────────────────────────────────────────────────
const C = {
  navy:    '#0B1F3A',
  navyMid: '#1A3A6B',
  gold:    '#C9992A',
  goldLt:  '#E2C060',
  cream:   '#FEFAF0',
  ink:     '#1A0F04',
  muted:   '#6B7280',
  red:     '#B91C1C',
  green:   '#15803D',
}

// ── Styles ────────────────────────────────────────────────────────────────────
const inp = {
  width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 14,
  border: '1.5px solid #E2E8F0', fontFamily: 'inherit',
  background: '#FAFAFA', outline: 'none', boxSizing: 'border-box',
  transition: 'border-color .2s, box-shadow .2s',
}
const label = {
  fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '.05em',
  textTransform: 'uppercase', display: 'block', marginBottom: 5,
}
const section = {
  background: 'white', borderRadius: 12, padding: '16px',
  border: '1px solid #E2E8F0', marginBottom: 14,
  boxShadow: '0 1px 4px rgba(0,0,0,.05)',
}
const sectionTitle = {
  fontSize: 12, fontWeight: 800, color: C.navy, letterSpacing: '.08em',
  textTransform: 'uppercase', marginBottom: 12, display: 'flex',
  alignItems: 'center', gap: 7,
}

function Field({ label: lbl, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={label}>{lbl}</label>
      {children}
    </div>
  )
}

function Inp({ value, onChange, placeholder, type = 'text', readOnly }) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      type={type} value={value} onChange={onChange} placeholder={placeholder}
      readOnly={readOnly}
      style={{ ...inp, borderColor: focused ? C.navyMid : '#E2E8F0', boxShadow: focused ? `0 0 0 3px rgba(26,58,107,0.1)` : 'none', cursor: readOnly ? 'default' : 'text' }}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    />
  )
}

function Sel({ value, onChange, options }) {
  return (
    <select value={value} onChange={onChange} style={{ ...inp, cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%23475569' fill='none' stroke-width='1.5'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

// ── Photo upload ──────────────────────────────────────────────────────────────
function PhotoUpload({ photo, onPhoto }) {
  const fileRef = useRef()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div
        onClick={() => fileRef.current.click()}
        style={{ width: 90, height: 110, borderRadius: 8, border: `2px dashed ${photo ? C.navyMid : '#CBD5E1'}`, background: photo ? 'transparent' : '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', position: 'relative', transition: 'border-color .2s' }}
      >
        {photo
          ? <img src={photo} alt="Passport" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ textAlign: 'center', color: '#94A3B8' }}>
              <div style={{ fontSize: 28, marginBottom: 4 }}>📷</div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.04em' }}>PHOTO</div>
            </div>
        }
      </div>
      <button onClick={() => fileRef.current.click()} style={{ fontSize: 11, padding: '5px 14px', borderRadius: 6, border: `1px solid ${C.navyMid}`, background: 'white', color: C.navyMid, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>
        {photo ? '↺ Change' : '↑ Upload'}
      </button>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
        const f = e.target.files[0]; if (!f) return
        const r = new FileReader(); r.onload = ev => onPhoto(ev.target.result); r.readAsDataURL(f)
      }} />
    </div>
  )
}

// ── The actual Admit Card ─────────────────────────────────────────────────────
function AdmitCardPreview({ data }) {
  const { name, rollNo, examType, course, batch, dob, centre, examDate, examTime, photo, instructions, sig1Name, sig1Title, sig2Name, sig2Title } = data

  const GoldRule = ({ mt = 6, mb = 6 }) => (
    <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${C.gold}, ${C.goldLt}, ${C.gold}, transparent)`, margin: `${mt}px 0 ${mb}px` }} />
  )

  const InfoRow = ({ label: lbl, value, highlight }) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 5 }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: C.muted, letterSpacing: '.05em', textTransform: 'uppercase', minWidth: 80, flexShrink: 0 }}>{lbl}</span>
      <span style={{ fontSize: 12, fontWeight: highlight ? 700 : 500, color: highlight ? C.navy : C.ink, flex: 1, wordBreak: 'break-word' }}>{value || '—'}</span>
    </div>
  )

  return (
    <div id="admitCardPrint" style={{
      width: '100%', maxWidth: 360, margin: '0 auto',
      background: C.cream, fontFamily: "'EB Garamond', Georgia, serif",
      border: `3px solid ${C.navy}`, borderRadius: 4, overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      position: 'relative',
    }}>
      {/* Outer gold border inset */}
      <div style={{ position: 'absolute', inset: 5, border: `1px solid ${C.gold}`, borderRadius: 2, pointerEvents: 'none', zIndex: 1, opacity: 0.4 }} />

      {/* ── HEADER ── */}
      <div style={{ background: `linear-gradient(175deg, ${C.navy} 0%, ${C.navyMid} 100%)`, padding: '12px 14px 10px', textAlign: 'center', position: 'relative' }}>
        {/* subtle diagonal texture */}
        <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(-48deg, transparent 0, transparent 20px, rgba(201,153,42,0.04) 20px, rgba(201,153,42,0.04) 22px)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ fontSize: 9, letterSpacing: '3px', color: C.goldLt, opacity: 0.8, marginBottom: 2 }}>— GUIDANCE NAVODAYA & SAINIK INSTITUTE —</div>
          <div style={{ fontSize: 15, fontWeight: 900, color: 'white', letterSpacing: '1px', fontFamily: "'Cinzel Decorative', 'Cinzel', serif", lineHeight: 1.2 }}>ADMIT CARD</div>
          <div style={{ fontSize: 10, color: C.goldLt, marginTop: 3, letterSpacing: '1px' }}>{examType || 'Entrance Examination 2026'}</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>Khangabok Sorok Wangma · Thoubal · Manipur – 795138</div>
        </div>
      </div>

      {/* ── GOLD RULE ── */}
      <div style={{ height: 4, background: `linear-gradient(90deg, ${C.navy}, ${C.gold}, ${C.goldLt}, ${C.gold}, ${C.navy})` }} />

      {/* ── CANDIDATE INFO ── */}
      <div style={{ padding: '10px 14px 6px' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          {/* Text block */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 2 }}>Candidate</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.navy, lineHeight: 1.2, marginBottom: 6 }}>{name || 'CANDIDATE NAME'}</div>
            <InfoRow label="Roll No."  value={rollNo}   highlight />
            <InfoRow label="Course"    value={course}             />
            <InfoRow label="Batch"     value={batch}              />
            <InfoRow label="D.O.B."    value={dob}                />
          </div>
          {/* Photo */}
          <div style={{ flexShrink: 0 }}>
            <div style={{ width: 70, height: 86, border: `1.5px solid ${C.navy}`, borderRadius: 3, overflow: 'hidden', background: '#E8E8E8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {photo
                ? <img src={photo} alt="Photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: 9 }}><div style={{ fontSize: 22 }}>👤</div>Photo</div>
              }
            </div>
            <div style={{ fontSize: 8, color: C.muted, textAlign: 'center', marginTop: 3 }}>Passport Size</div>
          </div>
        </div>
      </div>

      <GoldRule mt={4} mb={4} />

      {/* ── EXAM DETAILS ── */}
      <div style={{ padding: '4px 14px 8px', background: 'rgba(11,31,58,0.03)' }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: C.navy, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }}>Examination Details</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 10px' }}>
          <InfoRow label="Date"    value={examDate} highlight />
          <InfoRow label="Time"    value={examTime} highlight />
          <InfoRow label="Centre"  value={centre} />
        </div>
      </div>

      <GoldRule mt={2} mb={4} />

      {/* ── INSTRUCTIONS ── */}
      <div style={{ padding: '0 14px 8px' }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: C.red, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 5 }}>⚠ Important Instructions</div>
        <ol style={{ paddingLeft: 14, margin: 0 }}>
          {(instructions || defaultInstructions).map((ins, i) => (
            <li key={i} style={{ fontSize: 9.5, color: C.ink, lineHeight: 1.5, marginBottom: 3 }}>{ins}</li>
          ))}
        </ol>
      </div>

      <GoldRule mt={4} mb={8} />

      {/* ── SIGNATURES ── */}
      <div style={{ padding: '0 14px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 100, height: 28, borderBottom: `1px solid ${C.ink}`, marginBottom: 3, position: 'relative' }}>
            <div style={{ position: 'absolute', bottom: -1, left: -4, width: 10, height: 1, background: C.ink, transform: 'rotate(-30deg)', transformOrigin: 'right bottom' }} />
            <div style={{ position: 'absolute', bottom: -1, right: -4, width: 10, height: 1, background: C.ink, transform: 'rotate(30deg)', transformOrigin: 'left bottom' }} />
          </div>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: C.ink }}>{sig1Name || 'Th. Ibomcha Singh'}</div>
          <div style={{ fontSize: 8.5, color: C.muted }}>{sig1Title || 'Administrator'}</div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 8.5, color: C.muted, marginBottom: 4 }}>Candidate's Signature</div>
          <div style={{ width: 90, height: 28, borderBottom: `1px solid ${C.ink}` }} />
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 100, height: 28, borderBottom: `1px solid ${C.ink}`, marginBottom: 3, position: 'relative' }}>
            <div style={{ position: 'absolute', bottom: -1, left: -4, width: 10, height: 1, background: C.ink, transform: 'rotate(-30deg)', transformOrigin: 'right bottom' }} />
            <div style={{ position: 'absolute', bottom: -1, right: -4, width: 10, height: 1, background: C.ink, transform: 'rotate(30deg)', transformOrigin: 'left bottom' }} />
          </div>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: C.ink }}>{sig2Name || 'Th. Bimola Devi'}</div>
          <div style={{ fontSize: 8.5, color: C.muted }}>{sig2Title || 'Head of Institution'}</div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div style={{ background: C.navy, padding: '6px 14px', textAlign: 'center' }}>
        <div style={{ fontSize: 8, letterSpacing: '2px', color: C.goldLt, opacity: 0.8 }}>
          "EDUCATION WITH INTEGRITY, EFFORT & ENLIGHTENMENT"
        </div>
      </div>
    </div>
  )
}

const defaultInstructions = [
  'Bring this admit card and original Aadhaar / birth certificate.',
  'Report 30 minutes before the examination.',
  'Electronic devices are strictly prohibited.',
  'No entry without this admit card.',
  'Admit card is valid only with photo and signature.',
]

// ── Main Component ────────────────────────────────────────────────────────────
export default function AdmitCard({ currentUser, perms }) {
  const [view, setView] = useState('edit') // 'edit' | 'preview' | 'print'
  const [photo, setPhoto] = useState(null)
  const [form, setForm] = useState({
    name:        '',
    rollNo:      `GNSI/2026/${String(Math.floor(Math.random()*900)+100)}`,
    examType:    EXAM_TYPES[0],
    course:      COURSES[0],
    batch:       BATCHES[0],
    dob:         '',
    centre:      VENUES[0],
    examDate:    '25th January 2026',
    examTime:    '09:00 AM – 11:00 AM',
    sig1Name:    'Th. Ibomcha Singh',
    sig1Title:   'Administrator',
    sig2Name:    'Th. Bimola Devi',
    sig2Title:   'Head of Institution',
    instructions: defaultInstructions,
  })

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: typeof e === 'string' ? e : e.target.value }))

  const handlePrint = () => {
    const style = document.createElement('style')
    style.textContent = `@media print { body > *:not(#print-root) { display:none!important; } #print-root { display:block!important; } @page { size: A5 portrait; margin: 8mm; } }`
    document.head.appendChild(style)
    const root = document.createElement('div')
    root.id = 'print-root'
    root.style.cssText = 'display:none;'
    document.body.appendChild(root)
    // Clone the card
    const card = document.getElementById('admitCardPrint')
    if (card) root.appendChild(card.cloneNode(true))
    window.print()
    setTimeout(() => { document.body.removeChild(root); document.head.removeChild(style) }, 1000)
  }

  const isMobile = window.innerWidth <= 768

  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9', fontFamily: "'Plus Jakarta Sans', 'Segoe UI', system-ui, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700&family=Cinzel:wght@400;700&family=EB+Garamond:ital,wght@0,400;0,700;1,400&family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet" />

      {/* ── TOP BAR ── */}
      <div style={{ background: `linear-gradient(135deg, ${C.navy} 0%, ${C.navyMid} 100%)`, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.2)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ fontSize: 22 }}>📋</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'white', letterSpacing: '-.01em' }}>Admit Card Generator</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: '.08em', textTransform: 'uppercase' }}>GNSI · Entrance Examination</div>
        </div>
        {/* View toggle */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: 3 }}>
          {[['edit','✎ Edit'],['preview','👁 Preview']].map(([k,l]) => (
            <button key={k} onClick={() => setView(k)} style={{ padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', background: view===k ? 'white' : 'transparent', color: view===k ? C.navy : 'rgba(255,255,255,0.7)', fontFamily: 'inherit', transition: 'all .15s' }}>{l}</button>
          ))}
        </div>
        <button onClick={handlePrint} style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${C.gold}`, background: `rgba(201,153,42,0.15)`, color: C.goldLt, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>⎙ Print</button>
      </div>

      {/* ── BODY ── */}
      <div style={{ padding: '14px', maxWidth: 900, margin: '0 auto' }}>
        {view === 'edit' ? (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14, alignItems: 'start' }}>

            {/* ── LEFT: FORM ── */}
            <div>
              {/* Candidate */}
              <div style={section}>
                <div style={sectionTitle}><span>👤</span> Candidate Details</div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
                  <PhotoUpload photo={photo} onPhoto={setPhoto} />
                  <div style={{ flex: 1 }}>
                    <Field label="Full Name *">
                      <Inp value={form.name} onChange={set('name')} placeholder="e.g. ALFARAS" />
                    </Field>
                    <Field label="Roll Number">
                      <Inp value={form.rollNo} onChange={set('rollNo')} placeholder="Auto-generated" />
                    </Field>
                  </div>
                </div>
                <Field label="Date of Birth">
                  <Inp type="text" value={form.dob} onChange={set('dob')} placeholder="e.g. 15th March 2015" />
                </Field>
              </div>

              {/* Exam */}
              <div style={section}>
                <div style={sectionTitle}><span>📝</span> Examination Details</div>
                <Field label="Examination Type">
                  <Sel value={form.examType} onChange={set('examType')} options={EXAM_TYPES} />
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Field label="Course / Group">
                    <Sel value={form.course} onChange={set('course')} options={COURSES} />
                  </Field>
                  <Field label="Batch">
                    <Sel value={form.batch} onChange={set('batch')} options={BATCHES} />
                  </Field>
                  <Field label="Exam Date">
                    <Inp value={form.examDate} onChange={set('examDate')} placeholder="e.g. 25th Jan 2026" />
                  </Field>
                  <Field label="Exam Time">
                    <Inp value={form.examTime} onChange={set('examTime')} placeholder="e.g. 09:00 AM" />
                  </Field>
                </div>
                <Field label="Examination Centre">
                  <Sel value={form.centre} onChange={set('centre')} options={VENUES} />
                </Field>
              </div>

              {/* Signatures */}
              <div style={section}>
                <div style={sectionTitle}><span>✒</span> Signatures</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Field label="Sig 1 — Name">
                    <Inp value={form.sig1Name} onChange={set('sig1Name')} placeholder="Name" />
                  </Field>
                  <Field label="Sig 1 — Title">
                    <Inp value={form.sig1Title} onChange={set('sig1Title')} placeholder="Title" />
                  </Field>
                  <Field label="Sig 2 — Name">
                    <Inp value={form.sig2Name} onChange={set('sig2Name')} placeholder="Name" />
                  </Field>
                  <Field label="Sig 2 — Title">
                    <Inp value={form.sig2Title} onChange={set('sig2Title')} placeholder="Title" />
                  </Field>
                </div>
              </div>

              {/* Instructions */}
              <div style={section}>
                <div style={sectionTitle}><span>⚠</span> Instructions</div>
                {form.instructions.map((ins, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 11, color: C.red, fontWeight: 700, minWidth: 18, paddingTop: 2 }}>{i+1}.</span>
                    <input
                      value={ins}
                      onChange={e => {
                        const next = [...form.instructions]
                        next[i] = e.target.value
                        setForm(p => ({ ...p, instructions: next }))
                      }}
                      style={{ ...inp, flex: 1, padding: '7px 10px', fontSize: 12 }}
                    />
                    <button onClick={() => setForm(p => ({ ...p, instructions: p.instructions.filter((_, j) => j !== i) }))} style={{ padding: '7px 8px', borderRadius: 6, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}>✕</button>
                  </div>
                ))}
                <button onClick={() => setForm(p => ({ ...p, instructions: [...p.instructions, ''] }))} style={{ padding: '7px 14px', borderRadius: 8, border: `1px dashed ${C.navyMid}`, background: 'white', color: C.navyMid, cursor: 'pointer', fontSize: 12, fontWeight: 600, width: '100%', marginTop: 4, fontFamily: 'inherit' }}>+ Add Instruction</button>
              </div>

              {/* Print button (mobile) */}
              <button onClick={handlePrint} style={{ width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${C.navy}, ${C.navyMid})`, color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(11,31,58,0.3)' }}>
                ⎙ Print Admit Card
              </button>
            </div>

            {/* ── RIGHT: LIVE PREVIEW ── */}
            <div style={{ position: isMobile ? 'static' : 'sticky', top: 74 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>👁</span> Live Preview
                <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 400, color: '#94A3B8' }}>Actual print size: A5</span>
              </div>
              <AdmitCardPreview data={{ ...form, photo }} />
            </div>

          </div>
        ) : (
          /* ── FULL PREVIEW MODE ── */
          <div>
            <div style={{ marginBottom: 16, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => setView('edit')} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>← Back to Edit</button>
              <button onClick={handlePrint} style={{ padding: '9px 24px', borderRadius: 8, border: 'none', background: C.navy, color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}>⎙ Print / Save PDF</button>
            </div>
            <AdmitCardPreview data={{ ...form, photo }} />
          </div>
        )}
      </div>
    </div>
  )
}