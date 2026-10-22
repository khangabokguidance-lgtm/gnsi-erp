// ExamRegistrationAdmin.jsx — staff side of entrance-exam registration, inside Admissions:
//   • the public application link (copy / QR) and live counts for the chosen exam
//   • register a candidate at the counter with the same NTA-style form, then take payment (cash / UPI reference, or the
//     same Razorpay checkout the public page uses)
//   • every registration with its fee status, and print the registration slip or admit card
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import QRCode from 'qrcode'
import { supabase } from './supabase'
import ExamRegistrationForm from './ExamRegistrationForm'
import { payApplicationFee } from './entrancePay'
import { printAdmitCard } from './entranceAdmit'
import { registrationWindow, candidatePayload, feeFor, admitCardState } from './lib/entranceReg'
import { applicationNo, nextApplicationSeq, nextRoll } from './lib/entranceNumbers'
import { safeWrite, fmtDate, PHOTO_BUCKET } from './entranceCore'

const NAVY = '#17375E', BLUE = '#1D4F91', ORANGE = '#E8731A', LINE = '#CBD5E3', SUB = '#4A5B73'
const inr = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN')
const dataToBlob = d => { const [h, b] = d.split(','); const bin = atob(b); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: /data:([^;]+)/.exec(h)[1] }) }
const rand = () => Math.random().toString(36).slice(2, 8)
const btn = (kind = 'ghost') => ({ padding: '7px 13px', borderRadius: 6, border: kind === 'ghost' ? `1px solid ${LINE}` : 0, background: kind === 'blue' ? BLUE : kind === 'orange' ? ORANGE : '#fff', color: kind === 'ghost' ? NAVY : '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' })

export default function ExamRegistrationAdmin({ canWrite }) {
  const [exams, setExams] = useState(null)
  const [examId, setExamId] = useState('')
  const [cands, setCands] = useState([])
  const [qr, setQr] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)   // after a counter registration: { candidate, dob }
  const [msg, setMsg] = useState(null)
  const [tick, setTick] = useState(0)
  const reload = () => setTick(t => t + 1)

  useEffect(() => {
    let live = true
    supabase.from('entrance_exams').select('*').order('exam_date', { ascending: false }).then(({ data, error }) => {
      if (!live) return
      if (error) { setMsg({ ok: false, text: 'Could not load exams: ' + error.message }); setExams([]); return }
      setExams(data || [])
      setExamId(id => id || (data || []).find(e => registrationWindow(e).open)?.id || data?.[0]?.id || '')
    })
    return () => { live = false }
  }, [])
  const exam = useMemo(() => (exams || []).find(e => String(e.id) === String(examId)) || null, [exams, examId])
  const link = exam ? `${window.location.origin}/exam-registration?exam=${encodeURIComponent(exam.id)}` : ''
  useEffect(() => { if (link) QRCode.toDataURL(link, { margin: 1, width: 180 }).then(setQr).catch(() => setQr('')) }, [link])

  useEffect(() => {
    if (!examId) return
    let live = true
    supabase.from('entrance_candidates').select('*').eq('exam_id', examId).order('id', { ascending: false }).limit(2000).then(({ data }) => { if (live) setCands(data || []) })
    return () => { live = false }
  }, [examId, tick])

  const flash = (ok, text) => setMsg({ ok, text })
  const counts = useMemo(() => ({
    total: cands.length,
    paid: cands.filter(c => ['Paid', 'Waived'].includes(c.fee_status)).length,
    online: cands.filter(c => c.source === 'online').length,
    issued: cands.filter(c => ['Hall Ticket Issued', 'Appeared'].includes(c.status)).length,
    unpaid: cands.filter(c => !['Paid', 'Waived'].includes(c.fee_status)).length,
  }), [cands])

  // Counter registration: same checks as online, written with the staff session.
  const register = async ({ form, photo, signature }) => {
    if (!canWrite) return { error: 'You do not have permission to register candidates.' }
    const win = registrationWindow(exam)
    if (!win.open && !window.confirm(`${win.reason}\n\nRegister anyway (staff override)?`)) return { error: win.reason }
    setBusy(true)
    try {
      const payload = candidatePayload(form)
      const dup = cands.find(c => c.phone === payload.phone && c.dob === payload.dob && String(c.student_name || '').trim().toLowerCase() === payload.student_name.toLowerCase())
      if (dup) return { error: `Already registered as ${dup.application_no}.` }
      const stamp = `${Date.now()}-${rand()}`
      const up = async (kind, data) => {
        const blob = dataToBlob(data), path = `entrance/${kind}/${exam.id}/${stamp}.${blob.type.split('/')[1]}`
        const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: blob.type })
        if (error) throw new Error('Image upload failed: ' + error.message)
        return path
      }
      const photo_url = await up('photos', photo), signature_url = await up('signatures', signature)
      const fee = feeFor(exam)
      const res = await safeWrite('entrance_candidates', 'insert', {
        ...payload, exam_id: exam.id, status: 'Registered', verified: false, source: 'staff', photo_url, signature_url,
        roll_number: nextRoll(cands, exam.id), application_no: applicationNo(exam, nextApplicationSeq(cands, exam.id)), fee_status: fee > 0 ? 'Unpaid' : 'Waived',
      })
      if (res.error) throw new Error(res.error.message)
      const saved = res.data?.[0]
      setFormOpen(false); setResult({ candidate: saved, dob: form.dob }); reload()
      return { ok: true }
    } catch (e) { return { error: e.message || 'Could not register' } } finally { setBusy(false) }
  }

  const markPaid = async c => {
    const ref = window.prompt(`Payment received for ${c.student_name} (${inr(feeFor(exam))}).\nEnter the receipt / UPI / cash reference:`, 'CASH')
    if (ref === null) return
    const { error } = await safeWrite('entrance_candidates', 'update', { fee_status: 'Paid', fee_ref: ref.trim() || 'CASH', fee_paid_on: new Date().toLocaleDateString('en-CA'), verified: true }, { id: c.id })
    if (error) flash(false, error.message); else { flash(true, `${c.application_no} marked paid.`); reload() }
  }
  const payOnline = async c => {
    try {
      const r = await payApplicationFee({ applicationNo: c.application_no, dob: c.dob })
      if (r.paid) { flash(true, `${c.application_no} paid online.`); reload() } else if (r.cancelled) flash(false, 'Payment window closed — nothing was charged.')
    } catch (e) { flash(false, e.message) }
  }
  const printFor = async c => {
    const st = admitCardState(c, exam)
    const sign = async p => { if (!p || /^https?:/.test(p)) return p || ''; const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(p, 3600); return data?.signedUrl || '' }
    const [photo, signature] = await Promise.all([sign(c.photo_url), sign(c.signature_url)])
    printAdmitCard({ candidate: c, exam, photo, signature, slip: st.state !== 'admit' })
  }

  const th = { textAlign: 'left', padding: '9px 10px', fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: '#fff', background: NAVY, whiteSpace: 'nowrap' }
  const td = { padding: '9px 10px', fontSize: 12.5, borderBottom: '1px solid #E8EDF4', verticalAlign: 'middle' }
  const box = { background: '#fff', border: `1px solid ${LINE}`, borderTop: `3px solid ${NAVY}`, borderRadius: 4, padding: 16 }

  if (!exams) return <div style={box}>Loading exams…</div>
  if (!exams.length) return <div style={box}>No entrance exam has been created yet. Create one in the Entrance module first — its dates, fee and venue drive this form.</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {msg && <div style={{ padding: '9px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600, color: msg.ok ? '#15803D' : '#B42318', background: msg.ok ? '#E8F7EE' : '#FEF3F2' }}>{msg.text}</div>}
      <div style={{ ...box, display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', color: ORANGE }}>ENTRANCE EXAM REGISTRATION</div>
          <select value={examId} onChange={e => setExamId(e.target.value)} style={{ margin: '6px 0 4px', padding: '8px 10px', fontSize: 15, fontWeight: 700, color: NAVY, border: `1px solid ${LINE}`, borderRadius: 4, maxWidth: '100%' }}>
            {exams.map(e => <option key={e.id} value={e.id}>{e.exam_name}</option>)}
          </select>
          {exam && (
            <div style={{ fontSize: 12.5, color: SUB, lineHeight: 1.6 }}>
              Exam {fmtDate(exam.exam_date)}{exam.exam_time ? ` · ${exam.exam_time}` : ''} · Fee {feeFor(exam) ? inr(feeFor(exam)) : 'none'} · Applications {exam.app_open ? fmtDate(exam.app_open) : 'open'} → {exam.app_close ? fmtDate(exam.app_close) : 'no end date'}
              <br /><b style={{ color: registrationWindow(exam).open ? '#15803D' : '#B45309' }}>{registrationWindow(exam).open ? '● Taking applications' : `● ${registrationWindow(exam).reason}`}</b>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
            {canWrite && <button type="button" style={btn('orange')} onClick={() => { setResult(null); setFormOpen(true) }}>＋ Register a candidate</button>}
            <button type="button" style={btn()} onClick={() => { navigator.clipboard?.writeText(link); flash(true, 'Public application link copied.') }}>Copy public link</button>
            <button type="button" style={btn()} onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/admit-card`); flash(true, 'Admit-card page link copied.') }}>Copy admit-card link</button>
          </div>
          <div style={{ fontSize: 11, color: '#7B8AA0', marginTop: 8, wordBreak: 'break-all' }}>{link}</div>
        </div>
        {qr && link && <div style={{ textAlign: 'center' }}><img src={qr} alt="QR code for the application link" width={130} height={130} style={{ border: `1px solid ${LINE}` }} /><div style={{ fontSize: 10.5, color: '#7B8AA0' }}>Print / share this QR</div></div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(110px,1fr))', gap: 8 }}>
          {[['Registered', counts.total, NAVY], ['Fee paid', counts.paid, '#15803D'], ['Fee pending', counts.unpaid, '#B45309'], ['Online', counts.online, BLUE], ['Admit cards issued', counts.issued, '#7C3AED']].map(([k, v, c]) => (
            <div key={k} style={{ border: `1px solid ${LINE}`, borderTop: `3px solid ${c}`, borderRadius: 4, padding: '8px 12px' }}><div style={{ fontSize: 10.5, color: SUB, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>{k}</div><div style={{ fontSize: 22, fontWeight: 700, color: NAVY }}>{v}</div></div>
          ))}
        </div>
      </div>

      {result && (
        <div style={{ ...box, borderTopColor: '#15803D' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#15803D', letterSpacing: '.1em' }}>✓ REGISTERED</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: NAVY, fontFamily: 'Georgia,serif' }}>{result.candidate?.application_no}</div>
          <div style={{ fontSize: 13, color: SUB, marginBottom: 10 }}>{result.candidate?.student_name}{feeFor(exam) ? ` · fee ${inr(feeFor(exam))} pending` : ' · no fee'}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {feeFor(exam) > 0 && <button type="button" style={btn('orange')} onClick={() => payOnline(result.candidate)}>Pay online now (Razorpay)</button>}
            {feeFor(exam) > 0 && <button type="button" style={btn()} onClick={() => markPaid(result.candidate)}>Mark paid — cash / UPI</button>}
            <button type="button" style={btn()} onClick={() => printFor(result.candidate)}>Print registration slip</button>
            <button type="button" style={btn()} onClick={() => setResult(null)}>Done</button>
          </div>
        </div>
      )}

      <div style={{ ...box, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', fontWeight: 700, color: NAVY, borderBottom: `1px solid ${LINE}` }}>Registrations ({cands.length})</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
            <thead><tr>{['Application no.', 'Candidate', 'Phone', 'Source', 'Fee', 'Status', 'Actions'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {cands.slice(0, 200).map(c => {
                const st = admitCardState(c, exam)
                return (
                  <tr key={c.id}>
                    <td style={{ ...td, fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700, color: BLUE }}>{c.application_no || '—'}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{c.student_name}<div style={{ fontSize: 11, color: '#7B8AA0' }}>{c.class_studying || ''}</div></td>
                    <td style={td}>{c.phone || '—'}</td>
                    <td style={td}>{c.source === 'online' ? '🌐 Online' : '🧑‍💼 Counter'}</td>
                    <td style={td}><span style={{ fontWeight: 800, color: ['Paid', 'Waived'].includes(c.fee_status) || !feeFor(exam) ? '#15803D' : '#B45309' }}>{c.fee_status || 'Unpaid'}</span>{c.fee_ref ? <div style={{ fontSize: 10.5, color: '#7B8AA0' }}>{c.fee_ref}</div> : null}</td>
                    <td style={td}>{st.label}</td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {st.state === 'pay' && canWrite && <button type="button" style={btn()} onClick={() => markPaid(c)}>Mark paid</button>}
                        {st.state === 'pay' && <button type="button" style={btn()} onClick={() => payOnline(c)}>Pay online</button>}
                        <button type="button" style={btn()} onClick={() => printFor(c)}>{st.state === 'admit' ? 'Admit card' : 'Slip'}</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {!cands.length && <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: '#7B8AA0', padding: 24 }}>No registrations yet. Share the public link or register a candidate here.</td></tr>}
            </tbody>
          </table>
        </div>
        {cands.length > 200 && <div style={{ padding: 10, fontSize: 12, color: '#7B8AA0' }}>Showing the newest 200 of {cands.length} — the Entrance module lists all of them.</div>}
      </div>

      {formOpen && exam && createPortal(
        <div onClick={() => !busy && setFormOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(11,37,69,.55)', zIndex: 99998, overflow: 'auto', padding: '24px 10px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', maxWidth: 880, margin: '0 auto', borderRadius: 6, borderTop: `5px solid ${NAVY}`, padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div><div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', color: ORANGE }}>COUNTER REGISTRATION</div><div style={{ fontSize: 19, fontWeight: 700, color: NAVY }}>{exam.exam_name}</div></div>
              <button type="button" style={btn()} onClick={() => !busy && setFormOpen(false)}>✕ Close</button>
            </div>
            <ExamRegistrationForm exam={exam} onSubmit={register} busy={busy} submitLabel="Register candidate" />
          </div>
        </div>, document.body)}
    </div>
  )
}
