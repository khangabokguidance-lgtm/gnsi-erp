// ExamRegistrationForm.jsx — the NTA-style application form for an entrance exam, shared by the public registration page
// and the staff-entered version in Admissions. Six steps, validated with lib/entranceReg.js (the same rules the server
// applies), ending in a declaration. The host decides what "submit" does (public → /api/entrance/register, staff → direct).
import { useMemo, useState } from 'react'
import { compressImage, sizeNote } from './lib/imageCompress'
import { validateRegistration, CLASS_OPTIONS, STATES, MEDIUMS, MAX_PHOTO_KB, MAX_SIGN_KB } from './lib/entranceReg'

const NAVY = '#17375E', BLUE = '#1D4F91', ORANGE = '#E8731A', LINE = '#CBD5E3', SUB = '#4A5B73', BAD = '#B42318'
const GENDERS = ['Boy', 'Girl', 'Other']
const CATEGORIES = ['General', 'OBC', 'SC', 'ST', 'EWS']
const STEPS = [
  { id: 'cand', title: 'Candidate', keys: ['student_name', 'dob', 'gender', 'category', 'nationality', 'aadhaar'] },
  { id: 'fam', title: 'Parents & contact', keys: ['father_name', 'mother_name', 'phone', 'alt_phone', 'email'] },
  { id: 'addr', title: 'Address', keys: ['address', 'state', 'district', 'pincode'] },
  { id: 'edu', title: 'School & exam', keys: ['class_studying', 'school', 'medium'] },
  { id: 'img', title: 'Photo & signature', keys: ['photo', 'signature'] },
  { id: 'rev', title: 'Review & declare', keys: ['declared'] },
]
const toDataUrl = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file) })

const inp = bad => ({ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 4, border: `1px solid ${bad ? BAD : LINE}`, fontSize: 14, background: '#fff', fontFamily: 'inherit', color: '#1B2A41' })

function Field({ label, req, error, hint, children, span }) {
  return (
    <label style={{ display: 'block', gridColumn: span ? '1 / -1' : undefined }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: SUB, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}{req && <span style={{ color: BAD }}> *</span>}</span>
      {children}
      {hint && !error && <span style={{ display: 'block', fontSize: 11, color: '#7B8AA0', marginTop: 3 }}>{hint}</span>}
      {error && <span style={{ display: 'block', fontSize: 11.5, color: BAD, marginTop: 3, fontWeight: 600 }}>{error}</span>}
    </label>
  )
}

export default function ExamRegistrationForm({ exam, onSubmit, submitLabel = 'Submit application', busy = false }) {
  const [f, setF] = useState({ nationality: 'Indian', medium: 'English', state: 'Manipur', gender: '', category: 'General', declared: false })
  const [photo, setPhoto] = useState(null)      // { data, note }
  const [sign, setSign] = useState(null)
  const [step, setStep] = useState(0)
  const [shown, setShown] = useState({})        // steps whose errors may be displayed
  const [serverErr, setServerErr] = useState(null)
  const [imgErr, setImgErr] = useState('')
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))
  const errors = useMemo(() => validateRegistration(f, exam, { assets: { photo: photo?.data, signature: sign?.data } }), [f, exam, photo, sign])
  const stepErrors = i => STEPS[i].keys.filter(k => errors[k])
  const err = (k, i) => ((shown[i] || shown.all) ? (errors[k] || serverErr?.errors?.[k]) : undefined)

  const pickImage = async (file, kind) => {
    setImgErr('')
    if (!file) return
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { setImgErr('Use a JPG, PNG or WebP image.'); return }
    try {
      const opts = kind === 'photo' ? { maxDim: 600, quality: 0.86, targetKB: MAX_PHOTO_KB - 40 } : { maxDim: 500, quality: 0.86, targetKB: MAX_SIGN_KB - 30 }
      const info = await compressImage(file, opts)
      if (info.file.size > (kind === 'photo' ? MAX_PHOTO_KB : MAX_SIGN_KB) * 1024) { setImgErr(`That image is still too large after shrinking (limit ${kind === 'photo' ? MAX_PHOTO_KB : MAX_SIGN_KB} KB). Use a smaller picture.`); return }
      const data = await toDataUrl(info.file)
      ;(kind === 'photo' ? setPhoto : setSign)({ data, note: sizeNote(info) })
    } catch { setImgErr('Could not read that image — try another file.') }
  }

  const next = () => {
    setShown(s => ({ ...s, [step]: true }))
    if (stepErrors(step).length) return
    setStep(s => Math.min(s + 1, STEPS.length - 1))
    window.scrollTo?.({ top: 0, behavior: 'smooth' })
  }
  const submit = async () => {
    setShown({ all: true })
    const first = STEPS.findIndex((_, i) => stepErrors(i).length)
    if (first >= 0) { setStep(first); return }
    const r = await onSubmit({ form: f, photo: photo.data, signature: sign.data })
    if (r && r.error) { setServerErr(r); if (r.errors) { const i = STEPS.findIndex(s => s.keys.some(k => r.errors[k])); if (i >= 0) setStep(i) } }
  }

  const s = STEPS[step]
  const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16 }
  return (
    <div style={{ fontFamily: "'Noto Sans','Open Sans',Inter,system-ui,sans-serif" }}>
      {/* progress */}
      <div style={{ display: 'flex', gap: 0, overflowX: 'auto', borderBottom: `2px solid ${LINE}`, marginBottom: 18 }}>
        {STEPS.map((x, i) => (
          <button key={x.id} type="button" onClick={() => { if (i <= step) setStep(i) }} style={{ flex: '1 0 auto', padding: '10px 14px', border: 0, borderBottom: `3px solid ${i === step ? ORANGE : 'transparent'}`, marginBottom: -2, background: 'transparent', cursor: i <= step ? 'pointer' : 'default', fontFamily: 'inherit', textAlign: 'left' }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.1em', color: i < step ? '#15803D' : i === step ? ORANGE : '#9AA7BB' }}>{i < step ? '✓ ' : ''}STEP {i + 1}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: i === step ? NAVY : SUB, whiteSpace: 'nowrap' }}>{x.title}</div>
          </button>
        ))}
      </div>

      {serverErr && <div style={{ background: '#FEF3F2', border: '1px solid #FECDCA', color: BAD, padding: '10px 14px', borderRadius: 4, marginBottom: 14, fontSize: 13, fontWeight: 600 }}>{serverErr.error}</div>}

      {s.id === 'cand' && (
        <div style={grid}>
          <Field label="Candidate's name" req error={err('student_name', 0)} hint="As on the school record" span><input style={inp(err('student_name', 0))} value={f.student_name || ''} onChange={e => set('student_name', e.target.value)} autoComplete="name" /></Field>
          <Field label="Date of birth" req error={err('dob', 0)}><input type="date" style={inp(err('dob', 0))} value={f.dob || ''} max={new Date().toLocaleDateString('en-CA')} onChange={e => set('dob', e.target.value)} /></Field>
          <Field label="Gender" req error={err('gender', 0)}><select style={inp(err('gender', 0))} value={f.gender} onChange={e => set('gender', e.target.value)}><option value="">Select</option>{GENDERS.map(g => <option key={g}>{g}</option>)}</select></Field>
          <Field label="Category" req error={err('category', 0)}><select style={inp(err('category', 0))} value={f.category} onChange={e => set('category', e.target.value)}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Nationality"><input style={inp()} value={f.nationality || ''} onChange={e => set('nationality', e.target.value)} /></Field>
          <Field label="Aadhaar number" error={err('aadhaar', 0)} hint="Optional — only the last 4 digits are kept"><input inputMode="numeric" style={inp(err('aadhaar', 0))} value={f.aadhaar || ''} onChange={e => set('aadhaar', e.target.value)} maxLength={14} /></Field>
          <label style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: SUB }}>
            <input type="checkbox" checked={!!f.pwd} onChange={e => set('pwd', e.target.checked)} /> Candidate is a Person with Disability (PwD)
            {f.pwd && <input style={{ ...inp(), flex: 1 }} placeholder="Nature of disability" value={f.pwd_note || ''} onChange={e => set('pwd_note', e.target.value)} />}
          </label>
        </div>
      )}
      {s.id === 'fam' && (
        <div style={grid}>
          <Field label="Father's / guardian's name" req error={err('father_name', 1)}><input style={inp(err('father_name', 1))} value={f.father_name || ''} onChange={e => set('father_name', e.target.value)} /></Field>
          <Field label="Mother's name" req error={err('mother_name', 1)}><input style={inp(err('mother_name', 1))} value={f.mother_name || ''} onChange={e => set('mother_name', e.target.value)} /></Field>
          <Field label="Mobile number" req error={err('phone', 1)} hint="Application number and updates are sent here"><input inputMode="tel" style={inp(err('phone', 1))} value={f.phone || ''} onChange={e => set('phone', e.target.value)} maxLength={14} autoComplete="tel" /></Field>
          <Field label="Alternate mobile" error={err('alt_phone', 1)}><input inputMode="tel" style={inp(err('alt_phone', 1))} value={f.alt_phone || ''} onChange={e => set('alt_phone', e.target.value)} maxLength={14} /></Field>
          <Field label="Email address" error={err('email', 1)} span><input type="email" style={inp(err('email', 1))} value={f.email || ''} onChange={e => set('email', e.target.value)} autoComplete="email" /></Field>
        </div>
      )}
      {s.id === 'addr' && (
        <div style={grid}>
          <Field label="Postal address" req error={err('address', 2)} span><textarea rows={3} style={{ ...inp(err('address', 2)), resize: 'vertical' }} value={f.address || ''} onChange={e => set('address', e.target.value)} placeholder="House / village, locality, post office" /></Field>
          <Field label="State" req error={err('state', 2)}><select style={inp(err('state', 2))} value={f.state} onChange={e => set('state', e.target.value)}>{STATES.map(x => <option key={x}>{x}</option>)}</select></Field>
          <Field label="District" req error={err('district', 2)}><input style={inp(err('district', 2))} value={f.district || ''} onChange={e => set('district', e.target.value)} /></Field>
          <Field label="PIN code" req error={err('pincode', 2)}><input inputMode="numeric" style={inp(err('pincode', 2))} value={f.pincode || ''} onChange={e => set('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))} /></Field>
        </div>
      )}
      {s.id === 'edu' && (
        <div style={grid}>
          <Field label="Class applied for" req error={err('class_studying', 3)}><select style={inp(err('class_studying', 3))} value={f.class_studying || ''} onChange={e => set('class_studying', e.target.value)}><option value="">Select</option>{CLASS_OPTIONS.map(c => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Medium of examination"><select style={inp()} value={f.medium} onChange={e => set('medium', e.target.value)}>{MEDIUMS.map(m => <option key={m}>{m}</option>)}</select></Field>
          <Field label="Present school" req error={err('school', 3)} span><input style={inp(err('school', 3))} value={f.school || ''} onChange={e => set('school', e.target.value)} /></Field>
          <div style={{ gridColumn: '1 / -1', background: '#F3F6FA', border: `1px solid ${LINE}`, padding: '10px 14px', fontSize: 13, color: SUB, borderRadius: 4 }}>
            <b style={{ color: NAVY }}>{exam.exam_name}</b><br />
            {exam.exam_date ? `Exam date: ${new Date(exam.exam_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}` : 'Exam date to be announced'}{exam.exam_time ? ` · ${exam.exam_time}` : ''}{exam.venue ? ` · Centre: ${exam.venue}` : ''}
          </div>
        </div>
      )}
      {s.id === 'img' && (
        <div style={grid}>
          {[['photo', 'Passport-size photograph', photo, setPhoto, `JPG/PNG, up to ${MAX_PHOTO_KB} KB. Recent, plain background, face clearly visible.`, 118, 146],
            ['signature', "Candidate's signature", sign, setSign, `JPG/PNG, up to ${MAX_SIGN_KB} KB. Sign on white paper with a black pen.`, 200, 70]].map(([kind, label, val, , hint, w, h]) => (
            <div key={kind}>
              <div style={{ fontSize: 12, fontWeight: 700, color: SUB, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label} <span style={{ color: BAD }}>*</span></div>
              <div style={{ width: w, height: h, border: `1.5px dashed ${err(kind, 4) ? BAD : LINE}`, background: '#FAFBFD', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 8 }}>
                {val?.data ? <img src={val.data} alt={label} style={{ width: '100%', height: '100%', objectFit: kind === 'photo' ? 'cover' : 'contain' }} /> : <span style={{ fontSize: 11, color: '#9AA7BB' }}>No file</span>}
              </div>
              <label style={{ display: 'inline-block', padding: '8px 14px', background: BLUE, color: '#fff', fontWeight: 700, fontSize: 12.5, borderRadius: 4, cursor: 'pointer' }}>
                {val?.data ? 'Replace' : 'Choose file'}
                <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; pickImage(file, kind) }} />
              </label>
              <div style={{ fontSize: 11, color: '#7B8AA0', marginTop: 5 }}>{val?.note || hint}</div>
              {err(kind, 4) && <div style={{ fontSize: 11.5, color: BAD, fontWeight: 600, marginTop: 3 }}>{err(kind, 4)}</div>}
            </div>
          ))}
          {imgErr && <div style={{ gridColumn: '1 / -1', color: BAD, fontSize: 12.5, fontWeight: 600 }}>{imgErr}</div>}
        </div>
      )}
      {s.id === 'rev' && (
        <div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 14 }}>
            <tbody>
              {[['Candidate', f.student_name], ['Date of birth', f.dob], ['Gender / Category', [f.gender, f.category].filter(Boolean).join(' / ')], ["Father / Mother", [f.father_name, f.mother_name].filter(Boolean).join(' / ')],
                ['Mobile / Email', [f.phone, f.email].filter(Boolean).join(' · ')], ['Address', [f.address, f.district, f.state, f.pincode].filter(Boolean).join(', ')],
                ['School / Class', [f.school, f.class_studying].filter(Boolean).join(' · ')], ['Medium', f.medium]].map(([k, v]) => (
                <tr key={k}><td style={{ padding: '6px 10px', border: `1px solid ${LINE}`, background: '#F3F6FA', width: '32%', fontWeight: 700, color: SUB }}>{k}</td><td style={{ padding: '6px 10px', border: `1px solid ${LINE}` }}>{v || '—'}</td></tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
            {photo?.data && <img src={photo.data} alt="Photograph" style={{ width: 90, height: 112, objectFit: 'cover', border: `1px solid ${LINE}` }} />}
            {sign?.data && <img src={sign.data} alt="Signature" style={{ width: 150, height: 56, objectFit: 'contain', border: `1px solid ${LINE}`, alignSelf: 'flex-end' }} />}
          </div>
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: '#1B2A41', background: '#FFF8EC', border: '1px solid #F2D9A8', padding: '12px 14px', borderRadius: 4 }}>
            <input type="checkbox" checked={!!f.declared} onChange={e => set('declared', e.target.checked)} style={{ marginTop: 3 }} />
            <span>I declare that the information given in this application is true and correct to the best of my knowledge. I understand that a wrong or false statement can lead to cancellation of my candidature, and that the application fee is not refundable.</span>
          </label>
          {err('declared', 5) && <div style={{ color: BAD, fontSize: 12, fontWeight: 600, marginTop: 6 }}>{err('declared', 5)}</div>}
          {(exam.application_fee > 0) && <div style={{ marginTop: 12, fontSize: 13, color: SUB }}>Application fee payable: <b style={{ color: NAVY }}>₹{Number(exam.application_fee).toLocaleString('en-IN')}</b> — paid online after you submit.</div>}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 22, paddingTop: 14, borderTop: `1px solid ${LINE}` }}>
        <button type="button" onClick={() => setStep(x => Math.max(0, x - 1))} disabled={step === 0 || busy} style={{ padding: '10px 20px', border: `1px solid ${LINE}`, background: '#fff', borderRadius: 4, fontWeight: 700, color: SUB, cursor: step === 0 ? 'default' : 'pointer', opacity: step === 0 ? .4 : 1, fontFamily: 'inherit' }}>← Back</button>
        {step < STEPS.length - 1
          ? <button type="button" onClick={next} style={{ padding: '10px 26px', border: 0, background: BLUE, color: '#fff', borderRadius: 4, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Save & next →</button>
          : <button type="button" onClick={submit} disabled={busy} style={{ padding: '10px 26px', border: 0, background: ORANGE, color: '#fff', borderRadius: 4, fontWeight: 800, letterSpacing: '.03em', cursor: busy ? 'default' : 'pointer', opacity: busy ? .7 : 1, fontFamily: 'inherit', textTransform: 'uppercase' }}>{busy ? 'Submitting…' : submitLabel}</button>}
      </div>
    </div>
  )
}
