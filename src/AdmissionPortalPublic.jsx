// AdmissionPortalPublic.jsx — the public (no login) admission portal:
//   /apply          apply online → upload documents → pay the admission fee (Razorpay)
//   /apply-status   reference number + date of birth → status, documents, payment, receipt, timeline
// Rules come from lib/portalApply.js (the same file the server uses); money, numbering and status are decided by
// the api/entrance adm-* actions, never by this file.
import { useEffect, useMemo, useState } from 'react'
import { Shell, Card, Btn } from './ExamRegistrationPublic'
import { api, payPortalFee } from './entrancePay'
import { compressImage, sizeNote } from './lib/imageCompress'
import { getInstitute, loadSystemSettings } from './systemSettings'
import { openPrint } from './entrancePrint'
import {
  GENDERS, CATEGORIES, STATES, DOC_TYPES, MAX_PHOTO_KB, MAX_DOC_KB, validateApplication, findOption, portalFee,
  documentStatus, applicantStage, OPEN_STATUSES, docLabel,
} from './lib/portalApply'

const NAVY = '#17375E', BLUE = '#1D4F91', ORANGE = '#E8731A', LINE = '#CBD5E3', SUB = '#4A5B73', BAD = '#B42318', GOOD = '#15803D'
const NAV = [['/apply', 'Apply online'], ['/apply-status', 'Track application']]
const inr = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN')
const fmt = d => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')
const fmtTime = d => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '')
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

const TONE = { good: ['#E8F7EE', GOOD], warn: ['#FFF4E5', '#B45309'], bad: ['#FEF3F2', BAD], info: ['#E6EEF9', BLUE] }
const Pill = ({ tone = 'info', children }) => <span style={{ display: 'inline-block', padding: '3px 11px', borderRadius: 99, fontSize: 12, fontWeight: 800, background: TONE[tone][0], color: TONE[tone][1] }}>{children}</span>

// Reads a chosen file → { data (data URL), name, note }. Photos are shrunk in the browser; PDFs are sent as they are.
async function readUpload(file, kind) {
  if (kind === 'photo') {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Use a JPG, PNG or WebP image.')
    const info = await compressImage(file, { maxDim: 700, quality: 0.86, targetKB: MAX_PHOTO_KB - 40 })
    if (info.file.size > MAX_PHOTO_KB * 1024) throw new Error(`That image is still too large after shrinking (limit ${MAX_PHOTO_KB} KB). Use a smaller picture.`)
    return { data: await toDataUrl(info.file), name: file.name, note: sizeNote(info) }
  }
  if (file.type === 'application/pdf') {
    if (file.size > MAX_DOC_KB * 1024) throw new Error(`PDF is too large (limit ${MAX_DOC_KB} KB). Compress it or upload photos of the pages.`)
    return { data: await toDataUrl(file), name: file.name, note: `${Math.max(1, Math.round(file.size / 1024))} KB` }
  }
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Use a JPG, PNG, WebP or PDF file.')
  const info = await compressImage(file, { maxDim: 1700, quality: 0.82, targetKB: MAX_DOC_KB - 200 })
  if (info.file.size > MAX_DOC_KB * 1024) throw new Error(`That image is still too large (limit ${MAX_DOC_KB} KB).`)
  return { data: await toDataUrl(info.file), name: file.name, note: sizeNote(info) }
}

// ── Pay panel ───────────────────────────────────────────────────────────────
function PayPanel({ reference, dob, fee, onPaid }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const pay = async () => {
    setBusy(true); setMsg(null)
    try {
      const r = await payPortalFee({ reference, dob })
      if (r.paid) { setMsg({ ok: true, text: 'Payment received. Thank you!' }); onPaid?.(r) }
      else if (r.cancelled) setMsg({ ok: false, text: 'Payment window closed — you have not been charged. You can pay any time from the Track application page.' })
      else setMsg({ ok: false, text: 'Payment could not be confirmed. If money was deducted, contact the office with your reference number.' })
    } catch (e) { setMsg({ ok: false, text: e.message }) }
    setBusy(false)
  }
  return (
    <div>
      <Btn kind="orange" onClick={pay} disabled={busy}>{busy ? 'Opening payment…' : `Pay admission fee ${inr(fee)}`}</Btn>
      {msg && <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: msg.ok ? GOOD : BAD }}>{msg.text}</div>}
    </div>
  )
}

// ── Documents: one row per document type, each with its own upload ────────────────
function DocList({ reference, dob, docs, editable, onChange }) {
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const rows = documentStatus(docs)
  const upload = async (type, file) => {
    if (!file) return
    setBusy(type); setErr('')
    try {
      const u = await readUpload(file, 'doc')
      await api('adm-upload', { reference, dob, docType: type, fileName: u.name, file: u.data })
      onChange?.()
    } catch (e) { setErr(e.message) }
    setBusy('')
  }
  const chip = r => (r.state === 'verified' ? <Pill tone="good">Verified</Pill> : r.state === 'uploaded' ? <Pill tone="info">Received — awaiting check</Pill> : r.state === 'rejected' ? <Pill tone="bad">Rejected — upload again</Pill> : <Pill tone={r.required ? 'warn' : 'info'}>{r.required ? 'Required' : 'Optional'}</Pill>)
  return (
    <div>
      {rows.map(r => (
        <div key={r.key} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '10px 0', borderBottom: `1px solid ${LINE}` }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: NAVY }}>{r.label}{r.required && <span style={{ color: BAD }}> *</span>}</div>
            {r.doc?.remark && r.state === 'rejected' && <div style={{ fontSize: 12, color: BAD, marginTop: 2 }}>Office note: {r.doc.remark}</div>}
            {r.doc?.file_name && <div style={{ fontSize: 11.5, color: '#7B8AA0' }}>{r.doc.file_name}</div>}
          </div>
          {chip(r)}
          {editable && r.state !== 'verified' && (
            <label style={{ padding: '7px 14px', background: BLUE, color: '#fff', fontWeight: 700, fontSize: 12.5, borderRadius: 4, cursor: busy ? 'default' : 'pointer', opacity: busy ? .6 : 1 }}>
              {busy === r.key ? 'Uploading…' : r.state === 'missing' ? 'Upload' : 'Upload another'}
              <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={!!busy} style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; upload(r.key, f) }} />
            </label>
          )}
        </div>
      ))}
      <div style={{ fontSize: 11.5, color: '#7B8AA0', marginTop: 8 }}>JPG, PNG, WebP or PDF, up to {MAX_DOC_KB} KB each. Documents marked * are needed before the office can confirm the admission.</div>
      {err && <div style={{ color: BAD, fontSize: 12.5, fontWeight: 600, marginTop: 6 }}>{err}</div>}
    </div>
  )
}

// ── Receipt ─────────────────────────────────────────────────────────────────
function printReceipt(a) {
  const inst = getInstitute()
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  const rows = [['Reference no.', a.reference_no], ['Applicant', a.student_name], ['Course / batch', [a.course, a.batch].filter(Boolean).join(' · ')], ['Hostel', a.hostel_type], ['Session', a.session],
    ['Paid on', fmt(a.fee_paid_on)], ['Payment id', a.payment_id || '—'], ['Mode', a.payment_mode || '—'], ['Amount paid', inr(a.fee_amount)]]
  openPrint(`Payment receipt · ${a.reference_no}`, `
    <div style="max-width:620px;margin:30px auto;font-family:system-ui,sans-serif;color:#1B2A41;border:1px solid #CBD5E3;padding:26px">
      <div style="text-align:center;border-bottom:2px solid #17375E;padding-bottom:12px;margin-bottom:16px">
        <div style="font:700 20px Georgia,serif;color:#17375E">${esc(inst.name || 'GNSI')}</div><div style="font-size:12px;color:#4A5B73">${esc(inst.address || '')}</div>
        <div style="margin-top:8px;font-weight:800;letter-spacing:.1em;font-size:13px">ADMISSION FEE — PAYMENT RECEIPT</div></div>
      <table style="width:100%;border-collapse:collapse;font-size:14px">${rows.map(([k, v]) => `<tr><td style="padding:7px 10px;border:1px solid #CBD5E3;background:#F3F6FA;width:36%;font-weight:700">${esc(k)}</td><td style="padding:7px 10px;border:1px solid #CBD5E3">${esc(v)}</td></tr>`).join('')}</table>
      <p style="font-size:12px;color:#4A5B73;margin-top:16px">This is a computer-generated receipt for an online payment and does not need a signature. The admission is confirmed only after the office approves the application.</p>
    </div>`)
}

// ── Status page ─────────────────────────────────────────────────────────────
export function ApplyStatusPage() {
  const qs = new URLSearchParams(window.location.search)
  const [ref, setRef] = useState((qs.get('ref') || '').toUpperCase())
  const [dob, setDob] = useState('')
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const load = async (r = ref, d = dob) => {
    setBusy(true); setErr('')
    try { setData(await api('adm-lookup', { reference: r.trim(), dob: d })) } catch (e) { setData(null); setErr(e.message) }
    setBusy(false)
  }
  const a = data?.application
  const stage = a ? applicantStage(a, data.docs) : null
  return (
    <Shell title="Admission — track your application" nav={NAV}>
      <Card>
        <div style={{ fontSize: 18, fontWeight: 700, color: NAVY, marginBottom: 4 }}>Track your application</div>
        <div style={{ fontSize: 13, color: SUB, marginBottom: 14 }}>Enter the reference number you received when you applied and the applicant's date of birth.</div>
        <form onSubmit={e => { e.preventDefault(); load() }} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14, alignItems: 'end' }}>
          <Field label="Reference number"><input style={inp()} value={ref} onChange={e => setRef(e.target.value.toUpperCase())} placeholder="e.g. AP26-0001" /></Field>
          <Field label="Date of birth"><input type="date" style={inp()} value={dob} onChange={e => setDob(e.target.value)} /></Field>
          <Btn kind="orange" disabled={busy || !ref || !dob} onClick={() => load()}>{busy ? 'Checking…' : 'Show my application'}</Btn>
        </form>
        {err && <div style={{ marginTop: 12, color: BAD, fontWeight: 600, fontSize: 13 }}>{err}</div>}
      </Card>
      {a && (
        <>
          <Card style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {data.photo && <img src={data.photo} alt="" style={{ width: 90, height: 112, objectFit: 'cover', border: `1px solid ${LINE}` }} />}
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: NAVY }}>{a.student_name}</div>
                <div style={{ fontSize: 13, color: SUB }}>Reference <b>{a.reference_no}</b> · {a.course} · {a.batch} · {a.hostel_type} · Session {a.session}</div>
                <div style={{ marginTop: 10 }}><Pill tone={stage.tone}>{stage.label}</Pill></div>
                {stage.next && <div style={{ fontSize: 13.5, marginTop: 8, color: '#1B2A41' }}>{stage.next}</div>}
              </div>
            </div>
          </Card>
          <Card style={{ marginTop: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 8 }}>Admission fee</div>
            {Number(a.fee_amount) > 0 ? (
              a.fee_status === 'Paid' ? (
                <div>
                  <div style={{ color: GOOD, fontWeight: 700 }}>✓ {inr(a.fee_amount)} paid on {fmt(a.fee_paid_on)}</div>
                  <div style={{ fontSize: 12.5, color: SUB, margin: '4px 0 10px' }}>Payment id {a.payment_id || '—'}</div>
                  <Btn kind="ghost" onClick={() => printReceipt(a)}>Print receipt</Btn>
                </div>
              ) : a.fee_status === 'Refund due' || a.fee_status === 'Refunded' ? (
                <div style={{ color: SUB, fontSize: 13.5 }}>{a.fee_status === 'Refunded' ? `Your ${inr(a.fee_amount)} has been refunded${a.refund_ref ? ` (ref ${a.refund_ref})` : ''}.` : `A refund of ${inr(a.fee_amount)} is being processed by the office.`}</div>
              ) : OPEN_STATUSES.includes(a.status) ? <PayPanel reference={a.reference_no} dob={dob} fee={a.fee_amount} onPaid={() => load()} /> : <div style={{ color: SUB }}>No payment due.</div>
            ) : <div style={{ color: SUB, fontSize: 13.5 }}>No admission fee is due online for this application.</div>}
          </Card>
          <Card style={{ marginTop: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 4 }}>Documents</div>
            <DocList reference={a.reference_no} dob={dob} docs={data.docs} editable={OPEN_STATUSES.includes(a.status)} onChange={() => load()} />
          </Card>
          <Card style={{ marginTop: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 8 }}>Timeline</div>
            {data.events.length === 0 ? <div style={{ color: SUB }}>Nothing yet.</div> : data.events.slice().reverse().map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '6px 0', fontSize: 13, borderBottom: `1px dashed ${LINE}` }}>
                <span style={{ width: 118, color: '#7B8AA0', flexShrink: 0 }}>{fmtTime(e.at)}</span>
                <span><b style={{ textTransform: 'capitalize' }}>{String(e.action).replace(/_/g, ' ')}</b>{e.detail ? <span style={{ color: SUB }}> — {e.detail}</span> : null} <span style={{ color: '#9AA7BB' }}>({e.actor})</span></span>
              </div>
            ))}
          </Card>
        </>
      )}
    </Shell>
  )
}

// ── Application form ────────────────────────────────────────────────────────
const STEPS = [
  { id: 'who', title: 'Applicant', keys: ['student_name', 'dob', 'gender', 'category', 'aadhaar'] },
  { id: 'fam', title: 'Parents & contact', keys: ['father_name', 'mother_name', 'phone', 'alt_phone', 'email'] },
  { id: 'addr', title: 'Address & school', keys: ['address', 'state', 'district', 'pincode', 'prev_school'] },
  { id: 'course', title: 'Course', keys: ['course', 'batch', 'hostel_type'] },
  { id: 'docs', title: 'Photo & documents', keys: ['photo'] },
  { id: 'rev', title: 'Review & submit', keys: ['declared'] },
]

function ApplyPage() {
  const [cfg, setCfg] = useState(null)       // { open, session, options, reason }
  const [loadErr, setLoadErr] = useState('')
  const [f, setF] = useState({ gender: '', category: 'General', state: 'Manipur' })
  const [photo, setPhoto] = useState(null)
  const [docs, setDocs] = useState({})       // docType → { data, name, note }
  const [step, setStep] = useState(0)
  const [shown, setShown] = useState({})
  const [busy, setBusy] = useState('')
  const [serverErr, setServerErr] = useState(null)
  const [fileErr, setFileErr] = useState('')
  const [done, setDone] = useState(null)     // { reference, dob, fee, failed:[labels] }
  useEffect(() => { api('adm-options', null, 'GET').then(setCfg).catch(e => setLoadErr(e.message)) }, [])
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))
  const options = useMemo(() => cfg?.options || [], [cfg])
  const errors = useMemo(() => validateApplication(f, options, { hasPhoto: !!photo }), [f, options, photo])
  const stepErrors = i => STEPS[i].keys.filter(k => errors[k])
  const err = (k, i) => ((shown[i] || shown.all) ? (errors[k] || serverErr?.errors?.[k]) : undefined)

  const courses = [...new Set(options.map(o => o.course))]
  const batches = [...new Set(options.filter(o => o.course === f.course).map(o => o.batch))]
  const hostels = options.filter(o => o.course === f.course && o.batch === f.batch).map(o => o.hostel_type)
  const fee = portalFee(options, f)

  const pick = async (file, kind, key) => {
    setFileErr('')
    if (!file) return
    try { const u = await readUpload(file, kind); if (kind === 'photo') setPhoto(u); else setDocs(d => ({ ...d, [key]: u })) } catch (e) { setFileErr(e.message) }
  }
  const next = () => {
    setShown(s => ({ ...s, [step]: true }))
    if (stepErrors(step).length) return
    setStep(s => Math.min(s + 1, STEPS.length - 1)); window.scrollTo?.({ top: 0, behavior: 'smooth' })
  }
  const submit = async () => {
    setShown({ all: true })
    const first = STEPS.findIndex((_, i) => stepErrors(i).length)
    if (first >= 0) { setStep(first); return }
    setBusy('Submitting your application…'); setServerErr(null)
    try {
      const r = await api('adm-submit', { form: f, photo: photo.data })
      const failed = []
      for (const t of DOC_TYPES) {
        const d = docs[t.key]; if (!d) continue
        setBusy(`Uploading ${t.label}…`)
        try { await api('adm-upload', { reference: r.reference, dob: f.dob, docType: t.key, fileName: d.name, file: d.data }) } catch { failed.push(t.label) }
      }
      setDone({ reference: r.reference, dob: f.dob, fee: r.fee, failed })
    } catch (e) {
      if (e.data?.duplicate) setDone({ reference: e.data.reference, dob: f.dob, fee: 0, duplicate: true, failed: [] })
      else { setServerErr({ error: e.message, errors: e.data?.errors }); if (e.data?.errors) { const i = STEPS.findIndex(s => s.keys.some(k => e.data.errors[k])); if (i >= 0) setStep(i) } }
    }
    setBusy('')
  }

  if (done) {
    return (
      <Shell title="Admission — online application" nav={NAV}>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '.1em', color: done.duplicate ? '#B45309' : GOOD }}>{done.duplicate ? 'ALREADY APPLIED' : '✓ APPLICATION SUBMITTED'}</div>
          <div style={{ fontSize: 13, color: SUB, margin: '10px 0 4px' }}>Your reference number</div>
          <div style={{ fontSize: 34, fontWeight: 800, color: NAVY, letterSpacing: '.06em', fontFamily: 'Georgia,serif' }}>{done.reference}</div>
          <div style={{ fontSize: 13, color: SUB, margin: '6px 0 16px' }}>Note it down — with the applicant's date of birth it is your login for payment, documents and status.</div>
          {done.failed.length > 0 && <div style={{ background: '#FFF4E5', border: '1px solid #F2D9A8', color: '#B45309', padding: '10px 14px', borderRadius: 4, fontSize: 13, marginBottom: 14 }}>These documents did not upload: {done.failed.join(', ')}. Add them from the Track application page.</div>}
          {done.fee > 0 && <PayPanel reference={done.reference} dob={done.dob} fee={done.fee} onPaid={() => setDone(d => ({ ...d, fee: 0, paid: true }))} />}
          {done.paid && <div style={{ color: GOOD, fontWeight: 700 }}>Admission fee paid — thank you.</div>}
          <div style={{ marginTop: 16 }}><Btn kind="ghost" onClick={() => { window.location.href = `/apply-status?ref=${encodeURIComponent(done.reference)}` }}>Track this application</Btn></div>
        </Card>
      </Shell>
    )
  }

  const s = STEPS[step]
  const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16 }
  const text = (k, label, i, extra = {}) => (
    <Field label={label} req={extra.req !== false} error={err(k, i)} hint={extra.hint} span={extra.span}>
      {extra.area
        ? <textarea rows={3} style={{ ...inp(err(k, i)), resize: 'vertical' }} value={f[k] || ''} onChange={e => set(k, e.target.value)} />
        : <input type={extra.type || 'text'} inputMode={extra.mode} maxLength={extra.max} style={inp(err(k, i))} value={f[k] || ''} max={extra.type === 'date' ? new Date().toLocaleDateString('en-CA') : undefined}
            onChange={e => set(k, extra.digits ? e.target.value.replace(/\D/g, '').slice(0, extra.max || 12) : e.target.value)} />}
    </Field>
  )
  const sel = (k, label, i, opts, extra = {}) => (
    <Field label={label} req={extra.req !== false} error={err(k, i)} hint={extra.hint}>
      <select style={inp(err(k, i))} value={f[k] || ''} onChange={e => extra.onChange ? extra.onChange(e.target.value) : set(k, e.target.value)}>
        <option value="">Select</option>{opts.map(o => <option key={o}>{o}</option>)}
      </select>
    </Field>
  )

  return (
    <Shell title="Admission — online application" nav={NAV}>
      {loadErr && <Card><div style={{ color: BAD, fontWeight: 600 }}>{loadErr}</div></Card>}
      {!loadErr && !cfg && <Card>Loading…</Card>}
      {cfg && !cfg.open && <Card><div style={{ fontSize: 17, fontWeight: 700, color: NAVY }}>Admissions</div><div style={{ color: '#B45309', fontWeight: 600, marginTop: 8 }}>{cfg.reason}</div></Card>}
      {cfg?.open && (
        <Card>
          <div style={{ fontSize: 20, fontWeight: 700, color: NAVY }}>Admission {cfg.session}</div>
          <div style={{ fontSize: 13, color: SUB, margin: '4px 0 18px' }}>Fill the form, upload the documents and pay the admission fee online. Fields marked <span style={{ color: BAD }}>*</span> are required. Already applied? <a href="/apply-status" style={{ color: BLUE }}>Track your application</a>.</div>
          <div style={{ display: 'flex', overflowX: 'auto', borderBottom: `2px solid ${LINE}`, marginBottom: 18 }}>
            {STEPS.map((x, i) => (
              <button key={x.id} type="button" onClick={() => { if (i <= step) setStep(i) }} style={{ flex: '1 0 auto', padding: '10px 14px', border: 0, borderBottom: `3px solid ${i === step ? ORANGE : 'transparent'}`, marginBottom: -2, background: 'none', textAlign: 'left', cursor: i <= step ? 'pointer' : 'default', fontFamily: 'inherit' }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.1em', color: i < step ? GOOD : i === step ? ORANGE : '#9AA7BB' }}>{i < step ? '✓ ' : ''}STEP {i + 1}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: i === step ? NAVY : SUB, whiteSpace: 'nowrap' }}>{x.title}</div>
              </button>
            ))}
          </div>
          {serverErr && <div style={{ background: '#FEF3F2', border: '1px solid #FECDCA', color: BAD, padding: '10px 14px', borderRadius: 4, marginBottom: 14, fontSize: 13, fontWeight: 600 }}>{serverErr.error}</div>}

          {s.id === 'who' && (
            <div style={grid}>
              {text('student_name', "Applicant's full name", 0, { span: true, hint: 'As on the school record / birth certificate' })}
              {text('dob', 'Date of birth', 0, { type: 'date' })}
              {sel('gender', 'Gender', 0, GENDERS)}
              {sel('category', 'Category', 0, CATEGORIES)}
              {text('aadhaar', 'Aadhaar number', 0, { req: false, digits: true, max: 12, mode: 'numeric', hint: 'Optional — only the last 4 digits are kept' })}
              {text('religion', 'Religion', 0, { req: false })}
              {text('mother_tongue', 'Mother tongue', 0, { req: false })}
              {sel('blood_group', 'Blood group', 0, ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], { req: false })}
            </div>
          )}
          {s.id === 'fam' && (
            <div style={grid}>
              {text('father_name', "Father's / guardian's name", 1)}
              {text('mother_name', "Mother's name", 1)}
              {text('phone', 'Mobile number', 1, { digits: true, max: 10, mode: 'tel', hint: 'Updates about the application are sent here' })}
              {text('alt_phone', 'Alternate mobile', 1, { req: false, digits: true, max: 10, mode: 'tel' })}
              {text('email', 'Email address', 1, { req: false, type: 'email', span: true })}
            </div>
          )}
          {s.id === 'addr' && (
            <div style={grid}>
              {text('address', 'Postal address', 2, { area: true, span: true })}
              {sel('state', 'State', 2, STATES)}
              {text('district', 'District', 2)}
              {text('pincode', 'PIN code', 2, { digits: true, max: 6, mode: 'numeric' })}
              {text('prev_school', 'School last attended', 2, { span: true })}
              {text('prev_class', 'Class last passed', 2, { req: false })}
              {text('prev_percent', 'Marks / percentage', 2, { req: false })}
            </div>
          )}
          {s.id === 'course' && (
            <div style={grid}>
              {sel('course', 'Course', 3, courses, { onChange: v => setF(x => ({ ...x, course: v, batch: '', hostel_type: '' })) })}
              {sel('batch', 'Batch / class', 3, batches, { onChange: v => setF(x => ({ ...x, batch: v, hostel_type: '' })) })}
              {sel('hostel_type', 'Day scholar / boarder', 3, hostels)}
              {text('sibling_gcc', 'Sibling GCC no. (if a sibling studies here)', 3, { req: false, digits: true, max: 8 })}
              {options.length === 0 && <div style={{ gridColumn: '1 / -1', color: '#B45309', fontWeight: 600, fontSize: 13 }}>No course is open for online admission yet — please contact the office.</div>}
              {findOption(options, f) && <div style={{ gridColumn: '1 / -1', background: '#F3F6FA', border: `1px solid ${LINE}`, padding: '12px 14px', borderRadius: 4, fontSize: 13.5 }}>
                Admission fee for <b>{f.course} · {f.batch} · {f.hostel_type}</b>: <b style={{ color: NAVY, fontSize: 16 }}>{fee > 0 ? inr(fee) : 'no online fee'}</b>{fee > 0 && <span style={{ color: SUB }}> — payable securely online after you submit.</span>}
              </div>}
            </div>
          )}
          {s.id === 'docs' && (
            <div>
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: SUB, marginBottom: 6, textTransform: 'uppercase' }}>Passport-size photograph <span style={{ color: BAD }}>*</span></div>
                  <div style={{ width: 118, height: 146, border: `1.5px dashed ${err('photo', 4) ? BAD : LINE}`, background: '#FAFBFD', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 8 }}>
                    {photo?.data ? <img src={photo.data} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 11, color: '#9AA7BB' }}>No file</span>}
                  </div>
                  <label style={{ display: 'inline-block', padding: '8px 14px', background: BLUE, color: '#fff', fontWeight: 700, fontSize: 12.5, borderRadius: 4, cursor: 'pointer' }}>
                    {photo ? 'Replace' : 'Choose file'}
                    <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={e => { const x = e.target.files?.[0]; e.target.value = ''; pick(x, 'photo') }} />
                  </label>
                  <div style={{ fontSize: 11, color: '#7B8AA0', marginTop: 5, maxWidth: 200 }}>{photo?.note || `JPG/PNG, shrunk automatically to under ${MAX_PHOTO_KB} KB. Recent, plain background.`}</div>
                  {err('photo', 4) && <div style={{ fontSize: 11.5, color: BAD, fontWeight: 600, marginTop: 3 }}>{err('photo', 4)}</div>}
                </div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: SUB, marginBottom: 6, textTransform: 'uppercase' }}>Documents (upload now, or later from Track application)</div>
              {DOC_TYPES.map(t => (
                <div key={t.key} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${LINE}`, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200, fontSize: 13.5, fontWeight: 600, color: NAVY }}>{t.label}{t.required && <span style={{ color: BAD }}> *</span>}
                    {docs[t.key] && <div style={{ fontSize: 11.5, color: GOOD, fontWeight: 500 }}>✓ {docs[t.key].name} · {docs[t.key].note}</div>}</div>
                  <label style={{ padding: '6px 13px', background: docs[t.key] ? '#fff' : BLUE, color: docs[t.key] ? BLUE : '#fff', border: `1px solid ${BLUE}`, fontWeight: 700, fontSize: 12.5, borderRadius: 4, cursor: 'pointer' }}>
                    {docs[t.key] ? 'Replace' : 'Choose file'}
                    <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" style={{ display: 'none' }} onChange={e => { const x = e.target.files?.[0]; e.target.value = ''; pick(x, 'doc', t.key) }} />
                  </label>
                </div>
              ))}
              {fileErr && <div style={{ color: BAD, fontSize: 12.5, fontWeight: 600, marginTop: 8 }}>{fileErr}</div>}
            </div>
          )}
          {s.id === 'rev' && (
            <div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 14 }}>
                <tbody>
                  {[['Applicant', f.student_name], ['Date of birth', f.dob], ['Gender / category', [f.gender, f.category].filter(Boolean).join(' / ')], ['Father / mother', [f.father_name, f.mother_name].filter(Boolean).join(' / ')],
                    ['Mobile / email', [f.phone, f.email].filter(Boolean).join(' · ')], ['Address', [f.address, f.district, f.state, f.pincode].filter(Boolean).join(', ')], ['Last school', f.prev_school],
                    ['Course', [f.course, f.batch, f.hostel_type].filter(Boolean).join(' · ')], ['Documents', Object.keys(docs).map(docLabel).join(', ') || 'none yet — add them later']].map(([k, v]) => (
                    <tr key={k}><td style={{ padding: '6px 10px', border: `1px solid ${LINE}`, background: '#F3F6FA', width: '32%', fontWeight: 700, color: SUB }}>{k}</td><td style={{ padding: '6px 10px', border: `1px solid ${LINE}` }}>{v || '—'}</td></tr>
                  ))}
                </tbody>
              </table>
              {photo?.data && <img src={photo.data} alt="" style={{ width: 90, height: 112, objectFit: 'cover', border: `1px solid ${LINE}`, marginBottom: 14 }} />}
              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, background: '#FFF8EC', border: '1px solid #F2D9A8', padding: '12px 14px', borderRadius: 4 }}>
                <input type="checkbox" checked={!!f.declared} onChange={e => set('declared', e.target.checked)} style={{ marginTop: 3 }} />
                <span>I declare that the information given is true and correct. I understand that a false statement can lead to cancellation of the admission, and that the admission is confirmed only after the institute verifies my documents and approves the application.</span>
              </label>
              {err('declared', 5) && <div style={{ color: BAD, fontSize: 12, fontWeight: 600, marginTop: 6 }}>{err('declared', 5)}</div>}
              {fee > 0 && <div style={{ marginTop: 12, fontSize: 13, color: SUB }}>Admission fee payable online: <b style={{ color: NAVY }}>{inr(fee)}</b></div>}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, paddingTop: 14, borderTop: `1px solid ${LINE}`, gap: 10, flexWrap: 'wrap' }}>
            <Btn kind="ghost" disabled={step === 0 || !!busy} onClick={() => setStep(x => Math.max(0, x - 1))}>← Back</Btn>
            {busy && <span style={{ fontSize: 13, color: SUB, fontWeight: 600 }}>{busy}</span>}
            {step < STEPS.length - 1 ? <Btn onClick={next}>Save & next →</Btn> : <Btn kind="orange" disabled={!!busy} onClick={submit}>{fee > 0 ? 'Submit & continue to payment' : 'Submit application'}</Btn>}
          </div>
        </Card>
      )}
    </Shell>
  )
}

export default function AdmissionPortalPublic({ page }) {
  const [, setTick] = useState(0)
  useEffect(() => { loadSystemSettings().then(() => setTick(t => t + 1)).catch(() => {}) }, [])
  return page === 'apply-status' ? <ApplyStatusPage /> : <ApplyPage />
}
