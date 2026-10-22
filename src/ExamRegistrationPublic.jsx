// ExamRegistrationPublic.jsx — the public (no login) side of entrance-exam registration:
//   /exam-registration[?exam=<id>]  apply online → pay the application fee (Razorpay) → registration slip
//   /admit-card                     application number + date of birth → status, payment, slip / admit card
import { useEffect, useState } from 'react'
import ExamRegistrationForm from './ExamRegistrationForm'
import { api, payApplicationFee } from './entrancePay'
import { printAdmitCard } from './entranceAdmit'
import { loadSystemSettings, getInstitute } from './systemSettings'

const NAVY = '#17375E', BLUE = '#1D4F91', ORANGE = '#E8731A', LINE = '#CBD5E3', SUB = '#4A5B73'
const fmt = d => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '—')
const inr = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN')

function Shell({ title, children, wide }) {
  const inst = getInstitute()
  return (
    <div style={{ minHeight: '100vh', background: '#EEF2F7', fontFamily: "'Noto Sans','Open Sans',Inter,system-ui,sans-serif", color: '#1B2A41' }}>
      <div style={{ height: 6, background: 'linear-gradient(90deg,#FF9933 0 33.3%,#FFFFFF 33.3% 66.6%,#138808 66.6% 100%)' }} />
      <div style={{ background: NAVY, color: '#fff', padding: '16px 20px' }}>
        <div style={{ maxWidth: wide || 900, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#fff', color: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontFamily: 'Georgia,serif' }}>GNSI</div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Georgia,serif' }}>{inst.name || 'GNSI'}</div>
            <div style={{ fontSize: 12, opacity: .8 }}>{title}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, fontSize: 12.5 }}>
            <a href="/exam-registration" style={{ color: '#fff', opacity: .9 }}>Apply online</a>
            <span style={{ opacity: .4 }}>|</span>
            <a href="/admit-card" style={{ color: '#fff', opacity: .9 }}>Admit card</a>
          </div>
        </div>
      </div>
      <div style={{ maxWidth: wide || 900, margin: '0 auto', padding: '22px 14px 50px' }}>{children}</div>
      <div style={{ textAlign: 'center', fontSize: 11.5, color: '#7B8AA0', padding: '0 14px 24px' }}>{inst.name} · {inst.address}</div>
    </div>
  )
}
const Card = ({ children, style }) => <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderTop: `4px solid ${NAVY}`, padding: 22, borderRadius: 4, ...style }}>{children}</div>
const Btn = ({ children, onClick, disabled, kind = 'blue', style }) => (
  <button type="button" onClick={onClick} disabled={disabled} style={{ padding: '10px 22px', border: 0, borderRadius: 4, fontWeight: 800, fontFamily: 'inherit', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? .6 : 1, background: kind === 'orange' ? ORANGE : kind === 'ghost' ? '#fff' : BLUE, color: kind === 'ghost' ? SUB : '#fff', boxShadow: kind === 'ghost' ? `inset 0 0 0 1px ${LINE}` : 'none', ...style }}>{children}</button>
)

// ── Application confirmation + payment (after submit, or from the status page) ──────────
function PayPanel({ applicationNo, dob, fee, onPaid }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const pay = async () => {
    setBusy(true); setMsg(null)
    try {
      const r = await payApplicationFee({ applicationNo, dob })
      if (r.paid) { setMsg({ ok: true, text: 'Payment received. Thank you!' }); onPaid?.(r) }
      else if (r.cancelled) setMsg({ ok: false, text: 'Payment window closed — you have not been charged. You can pay any time using your application number and date of birth.' })
      else setMsg({ ok: false, text: 'Payment could not be confirmed. If money was deducted, contact the office with your application number.' })
    } catch (e) { setMsg({ ok: false, text: e.message }) }
    setBusy(false)
  }
  return (
    <div>
      <Btn kind="orange" onClick={pay} disabled={busy}>{busy ? 'Opening payment…' : `Pay application fee ${inr(fee)}`}</Btn>
      {msg && <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: msg.ok ? '#15803D' : '#B42318' }}>{msg.text}</div>}
    </div>
  )
}

// ── Status page: application number + date of birth ─────────────────────────────────────
export function AdmitCardPage({ initial }) {
  const [no, setNo] = useState(initial?.applicationNo || '')
  const [dob, setDob] = useState(initial?.dob || '')
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const look = async (n = no, d = dob) => {
    setBusy(true); setErr('')
    try { setData(await api('lookup', { applicationNo: n.trim(), dob: d })) } catch (e) { setData(null); setErr(e.message) }
    setBusy(false)
  }
  const inp = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: `1px solid ${LINE}`, borderRadius: 4, fontSize: 14, fontFamily: 'inherit' }
  return (
    <Shell title="Application status & admit card">
      <Card>
        <div style={{ fontSize: 18, fontWeight: 700, color: NAVY, marginBottom: 4 }}>Check status / download admit card</div>
        <div style={{ fontSize: 13, color: SUB, marginBottom: 14 }}>Enter the application number you received when you registered, and the candidate's date of birth.</div>
        <form onSubmit={e => { e.preventDefault(); look() }} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14, alignItems: 'end' }}>
          <label><span style={{ fontSize: 12, fontWeight: 700, color: SUB }}>APPLICATION NUMBER</span><input style={inp} value={no} onChange={e => setNo(e.target.value.toUpperCase())} placeholder="e.g. SA260001" /></label>
          <label><span style={{ fontSize: 12, fontWeight: 700, color: SUB }}>DATE OF BIRTH</span><input type="date" style={inp} value={dob} onChange={e => setDob(e.target.value)} /></label>
          <Btn kind="orange" disabled={busy || !no || !dob} onClick={() => look()}>{busy ? 'Checking…' : 'Submit'}</Btn>
        </form>
        {err && <div style={{ marginTop: 12, color: '#B42318', fontWeight: 600, fontSize: 13 }}>{err}</div>}
      </Card>
      {data && (
        <Card style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {data.photo ? <img src={data.photo} alt="" style={{ width: 96, height: 120, objectFit: 'cover', border: `1px solid ${LINE}` }} /> : null}
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: NAVY }}>{data.candidate.student_name}</div>
              <div style={{ fontSize: 13, color: SUB }}>Application no. <b>{data.candidate.application_no}</b> · {data.exam.exam_name}</div>
              <div style={{ fontSize: 13, color: SUB, marginTop: 2 }}>Exam: {fmt(data.exam.exam_date)}{data.exam.exam_time ? ` · ${data.exam.exam_time}` : ''}{data.exam.venue ? ` · ${data.exam.venue}` : ''}</div>
              <div style={{ display: 'inline-block', marginTop: 10, padding: '4px 12px', borderRadius: 99, fontSize: 12.5, fontWeight: 800, background: data.state === 'admit' ? '#E8F7EE' : data.state === 'pay' ? '#FFF4E5' : '#E6EEF8', color: data.state === 'admit' ? '#15803D' : data.state === 'pay' ? '#B45309' : BLUE }}>{data.label}</div>
            </div>
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {data.state === 'pay' && <PayPanel applicationNo={data.candidate.application_no} dob={dob} fee={data.fee} onPaid={() => look()} />}
            {data.state === 'slip' && <Btn onClick={() => printAdmitCard({ candidate: data.candidate, exam: data.exam, photo: data.photo, signature: data.signature, slip: true })}>Download registration slip</Btn>}
            {data.state === 'admit' && <Btn kind="orange" onClick={() => printAdmitCard({ candidate: data.candidate, exam: data.exam, photo: data.photo, signature: data.signature })}>Download admit card</Btn>}
            {data.state === 'slip' && <span style={{ fontSize: 12.5, color: SUB }}>The admit card (roll number, room and seat) appears here once the hall tickets are issued — check again closer to the exam.</span>}
          </div>
        </Card>
      )}
    </Shell>
  )
}

// ── Registration page ───────────────────────────────────────────────────────────────────
export default function ExamRegistrationPublic({ page }) {
  const [, setTick] = useState(0)
  useEffect(() => { loadSystemSettings().then(() => setTick(t => t + 1)).catch(() => {}) }, [])
  if (page === 'admit-card') return <AdmitCardPage />
  return <RegisterPage />
}

function RegisterPage() {
  const examId = new URLSearchParams(window.location.search).get('exam')
  const [exam, setExam] = useState(null)
  const [exams, setExams] = useState(null)
  const [win, setWin] = useState({ open: true })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)   // { applicationNo, dob, fee, paid }

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        if (examId) { const r = await api(`exam?id=${encodeURIComponent(examId)}`, null, 'GET'); if (live) { setExam(r.exam); setWin(r.window) } }
        else { const r = await api('exam?open=1', null, 'GET'); if (live) setExams(r.exams || []) }
      } catch (e) { if (live) setErr(e.message) }
    })()
    return () => { live = false }
  }, [examId])

  const submit = async ({ form, photo, signature }) => {
    setBusy(true)
    try {
      const r = await api('register', { examId: exam.id, form, photo, signature })
      setDone({ applicationNo: r.applicationNo, dob: form.dob, fee: r.fee, paid: r.fee === 0 })
      return { ok: true }
    } catch (e) {
      if (e.data?.duplicate) setDone({ applicationNo: e.data.applicationNo, dob: form.dob, fee: exam.application_fee, paid: false, duplicate: true })
      return { error: e.message, errors: e.data?.errors }
    } finally { setBusy(false) }
  }

  if (done) {
    return (
      <Shell title="Online application">
        <Card>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '.1em', color: done.duplicate ? '#B45309' : '#15803D' }}>{done.duplicate ? 'ALREADY REGISTERED' : '✓ APPLICATION SUBMITTED'}</div>
          <div style={{ fontSize: 13, color: SUB, margin: '10px 0 4px' }}>Your application number</div>
          <div style={{ fontSize: 34, fontWeight: 800, color: NAVY, letterSpacing: '.06em', fontFamily: 'Georgia,serif' }}>{done.applicationNo}</div>
          <div style={{ fontSize: 13, color: SUB, margin: '6px 0 16px' }}>Note it down — with the candidate's date of birth it is your login for payment, status and the admit card.</div>
          {!done.paid && done.fee > 0 && <PayPanel applicationNo={done.applicationNo} dob={done.dob} fee={done.fee} onPaid={() => setDone(d => ({ ...d, paid: true }))} />}
          {done.paid && <div style={{ color: '#15803D', fontWeight: 700, marginBottom: 12 }}>{done.fee > 0 ? 'Application fee paid.' : 'No application fee for this exam.'}</div>}
          <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Btn kind="ghost" onClick={() => { window.location.href = `/admit-card` }}>Check status / download slip</Btn>
          </div>
        </Card>
      </Shell>
    )
  }

  return (
    <Shell title="Entrance examination — online application">
      {err && <Card><div style={{ color: '#B42318', fontWeight: 600 }}>{err}</div></Card>}
      {!err && !examId && exams === null && <Card>Loading…</Card>}
      {!err && !examId && exams && (
        <Card>
          <div style={{ fontSize: 18, fontWeight: 700, color: NAVY, marginBottom: 10 }}>Choose the examination</div>
          {exams.length === 0 ? <div style={{ color: SUB }}>No examination is taking applications right now. Please check back later.</div> : exams.map(e => (
            <a key={e.id} href={`/exam-registration?exam=${encodeURIComponent(e.id)}`} style={{ display: 'block', textDecoration: 'none', padding: '12px 14px', border: `1px solid ${LINE}`, borderRadius: 4, marginBottom: 8, color: '#1B2A41' }}>
              <b style={{ color: BLUE }}>{e.exam_name}</b><div style={{ fontSize: 12.5, color: SUB }}>Exam {fmt(e.exam_date)} · Apply by {fmt(e.app_close)} · Fee {Number(e.application_fee) > 0 ? inr(e.application_fee) : 'free'}</div>
            </a>
          ))}
        </Card>
      )}
      {exam && !win.open && <Card><div style={{ fontSize: 17, fontWeight: 700, color: NAVY }}>{exam.exam_name}</div><div style={{ color: '#B45309', fontWeight: 600, marginTop: 8 }}>{win.reason}</div></Card>}
      {exam && win.open && (
        <Card>
          <div style={{ fontSize: 20, fontWeight: 700, color: NAVY }}>{exam.exam_name}</div>
          <div style={{ fontSize: 13, color: SUB, margin: '4px 0 18px' }}>
            Application form{exam.app_close ? ` · last date ${fmt(exam.app_close)}` : ''}{Number(exam.application_fee) > 0 ? ` · fee ${inr(exam.application_fee)}` : ' · no fee'} · fields marked <span style={{ color: '#B42318' }}>*</span> are mandatory
          </div>
          <ExamRegistrationForm exam={exam} onSubmit={submit} busy={busy} submitLabel={Number(exam.application_fee) > 0 ? 'Submit & proceed to payment' : 'Submit application'} />
        </Card>
      )}
    </Shell>
  )
}
