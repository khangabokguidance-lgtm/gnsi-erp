// AdmissionPortalAdmin.jsx — staff side of the online admission portal, shown as the first tab of Admissions:
//   • Online applications — every application from /apply with its payment, documents and a full timeline; verify
//     documents, ask for missing ones, record an offline payment, reject (with refund tracking) or approve
//   • Counter application — the existing staff form (passed in as `counterForm`)
//   • Portal link — the public link + QR and a checklist
// Approving creates the `admissions` row (status Admitted) and records the fee the applicant already paid online in
// the normal fee ledger (collectFee → adm_fee_collections + accounts), so nothing is typed twice.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import QRCode from 'qrcode'
import { supabase } from './supabase'
import { collectFee, rcptNo } from './feeEngine'
import { STATUSES, OPEN_STATUSES, DOC_TYPES, docLabel, documentStatus, approvalState, applicantStage } from './lib/portalApply'
import { applicationRowFromPortal, feeFromPortal } from './lib/portalToApplication'

const NAVY = '#17375E', BLUE = '#1D4F91', ORANGE = '#E8731A', LINE = '#CBD5E3', SUB = '#4A5B73', BAD = '#B42318', GOOD = '#15803D', AMBER = '#B45309'
const inr = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN')
const fdate = d => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')
const fdt = d => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '')
const todayStr = () => new Date().toLocaleDateString('en-CA')
const btn = (kind = 'ghost', disabled) => ({ padding: '7px 13px', borderRadius: 6, border: kind === 'ghost' ? `1px solid ${LINE}` : 0, background: kind === 'blue' ? BLUE : kind === 'orange' ? ORANGE : kind === 'green' ? GOOD : kind === 'red' ? BAD : '#fff', color: kind === 'ghost' ? NAVY : '#fff', fontWeight: 700, fontSize: 12.5, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? .55 : 1, fontFamily: 'inherit' })
const chip = (bg, fg) => ({ display: 'inline-block', padding: '2px 9px', borderRadius: 99, fontSize: 11.5, fontWeight: 800, background: bg, color: fg })
const STATUS_STYLE = { Submitted: ['#E6EEF9', BLUE], 'Under review': ['#EEF0FB', '#4338CA'], 'Docs requested': ['#FFF4E5', AMBER], Approved: ['#E8F7EE', GOOD], Rejected: ['#FEF3F2', BAD], Withdrawn: ['#EEF1F5', SUB] }
const FEE_STYLE = { Unpaid: ['#FFF4E5', AMBER], Paid: ['#E8F7EE', GOOD], Waived: ['#EEF1F5', SUB], 'Refund due': ['#FEF3F2', BAD], Refunded: ['#EEF1F5', SUB] }
const Chip = ({ map, v }) => <span style={chip(...(map[v] || ['#EEF1F5', SUB]))}>{v}</span>

function staffName() {
  try { const s = JSON.parse(localStorage.getItem('gnsi_session') || 'null'); const u = s?.user || s || {}; return u.name || u.username || u.full_name || u.role || 'Staff' } catch { return 'Staff' }
}
const signed = async p => { if (!p) return ''; const { data } = await supabase.storage.from('gnsi').createSignedUrl(p, 3600); return data?.signedUrl || '' }

function Modal({ title, onClose, children, wide }) {
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(11,30,61,.55)', zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '30px 12px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 10, width: '100%', maxWidth: wide || 760, boxShadow: '0 30px 80px -20px rgba(0,0,0,.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 20px', borderBottom: `1px solid ${LINE}` }}>
          <div style={{ flex: 1, fontSize: 16, fontWeight: 800, color: NAVY }}>{title}</div>
          <button type="button" onClick={onClose} style={{ ...btn('ghost'), padding: '4px 10px' }}>✕</button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>, document.body)
}

// ── One application: details, payment, documents, decisions, timeline ────────────────
function Detail({ id, canWrite, isAdmin, onClose, onChanged }) {
  const [a, setA] = useState(null)
  const [docs, setDocs] = useState([])
  const [events, setEvents] = useState([])
  const [photo, setPhoto] = useState('')
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [panel, setPanel] = useState(null)        // 'approve' | 'reject' | 'request' | 'offline' | 'refund' | 'note'
  const [val, setVal] = useState({})
  const [tick, setTick] = useState(0)
  const reload = () => { setTick(t => t + 1); onChanged?.() }

  useEffect(() => {
    let live = true
    ;(async () => {
      const [{ data: row, error }, { data: d }, { data: ev }] = await Promise.all([
        supabase.from('portal_applications').select('*').eq('id', id).maybeSingle(),
        supabase.from('portal_application_docs').select('*').eq('application_id', id).order('created_at'),
        supabase.from('portal_application_events').select('*').eq('application_id', id).order('at', { ascending: false }),
      ])
      if (!live) return
      if (error || !row) { setMsg({ ok: false, text: error?.message || 'Application not found' }); return }
      setA(row); setDocs(d || []); setEvents(ev || [])
      signed(row.photo_path).then(u => live && setPhoto(u))
    })()
    return () => { live = false }
  }, [id, tick])

  const flash = (ok, text) => setMsg({ ok, text })
  const log = (action, detail) => supabase.from('portal_application_events').insert({ application_id: id, actor: staffName(), action, detail }).then(() => {}, () => {})
  const patch = async (p, evt, detail) => {
    const { error } = await supabase.from('portal_applications').update({ ...p, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) { flash(false, error.message); return false }
    if (evt) await log(evt, detail)
    return true
  }
  const run = async fn => { if (!canWrite) { flash(false, 'You do not have permission to change applications.'); return } setBusy(true); try { await fn() } catch (e) { flash(false, e.message || String(e)) } setBusy(false) }

  const dstat = useMemo(() => documentStatus(docs), [docs])
  const gate = useMemo(() => (a ? approvalState(a, docs) : { hard: [], docs: [] }), [a, docs])
  const open = a && OPEN_STATUSES.includes(a.status)

  const viewDoc = async d => { const u = await signed(d.storage_path); if (u) window.open(u, '_blank', 'noopener'); else flash(false, 'Could not open the file (storage permission?).') }
  const setDocStatus = d => async (status) => run(async () => {
    let remark = d.remark
    if (status === 'Rejected') { remark = window.prompt(`Why is the ${docLabel(d.doc_type)} rejected? (shown to the applicant)`, d.remark || ''); if (remark === null) return }
    const { error } = await supabase.from('portal_application_docs').update({ status, remark: remark || null, verified_by: staffName(), verified_at: new Date().toISOString() }).eq('id', d.id)
    if (error) { flash(false, error.message); return }
    await log(status === 'Verified' ? 'document_verified' : 'document_rejected', `${docLabel(d.doc_type)}${remark ? ` — ${remark}` : ''}`)
    if (status === 'Rejected' && a.status !== 'Docs requested') await patch({ status: 'Docs requested', public_note: `${docLabel(d.doc_type)} was rejected${remark ? `: ${remark}` : ''}. Please upload it again.` })
    reload()
  })
  const addDoc = (type, file) => run(async () => {
    if (!file) return
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
    const path = `applications/${a.reference_no}/${type}-${Date.now()}.${ext}`
    const up = await supabase.storage.from('gnsi').upload(path, file, { contentType: file.type })
    if (up.error) { flash(false, 'Upload failed: ' + up.error.message); return }
    const { error } = await supabase.from('portal_application_docs').insert({ application_id: id, doc_type: type, storage_path: path, file_name: file.name, mime: file.type, size_bytes: file.size, status: 'Verified', verified_by: staffName(), verified_at: new Date().toISOString() })
    if (error) { flash(false, error.message); return }
    await log('document_added', `${docLabel(type)} (added by office, verified)`); reload()
  })

  const requestDocs = () => run(async () => {
    const note = (val.note || '').trim()
    if (!note) { flash(false, 'Write what the applicant should send.'); return }
    if (await patch({ status: 'Docs requested', public_note: note }, 'documents_requested', note)) { setPanel(null); setVal({}); reload() }
  })
  const markReview = () => run(async () => { if (await patch({ status: 'Under review', public_note: null }, 'under_review')) reload() })
  const offlinePay = () => run(async () => {
    const mode = val.mode || 'Cash', ref = (val.ref || '').trim()
    if (!window.confirm(`Record ${inr(a.fee_amount)} received by ${mode}${ref ? ` (${ref})` : ''}?`)) return
    if (await patch({ fee_status: 'Paid', payment_mode: mode, payment_id: ref || null, fee_paid_on: todayStr() }, 'payment_recorded', `${inr(a.fee_amount)} · ${mode}${ref ? ` · ${ref}` : ''} (recorded by office)`)) { setPanel(null); setVal({}); reload() }
  })
  const waive = () => run(async () => {
    const why = window.prompt('Waive the admission fee for this applicant. Reason:'); if (!why) return
    if (await patch({ fee_status: 'Waived' }, 'fee_waived', why)) reload()
  })
  const addNote = () => run(async () => { if (!(val.note || '').trim()) return; await log('note', val.note.trim()); setPanel(null); setVal({}); reload() })

  const reject = () => run(async () => {
    const reason = (val.note || '').trim()
    if (!reason) { flash(false, 'Give a reason — the applicant sees it.'); return }
    const refund = a.fee_status === 'Paid'
    if (!window.confirm(`Reject ${a.student_name}?${refund ? `\nThe ${inr(a.fee_amount)} already paid will be marked "Refund due".` : ''}`)) return
    if (await patch({ status: 'Rejected', rejection_reason: reason, reviewed_by: staffName(), reviewed_at: new Date().toISOString(), ...(refund ? { fee_status: 'Refund due' } : {}) }, 'rejected', reason)) { setPanel(null); setVal({}); reload() }
  })
  const refunded = () => run(async () => {
    const ref = (val.ref || '').trim(); if (!ref) { flash(false, 'Enter the refund reference.'); return }
    if (await patch({ fee_status: 'Refunded', refund_ref: ref, refunded_on: todayStr() }, 'refunded', `${inr(a.fee_amount)} · ${ref}`)) { setPanel(null); setVal({}); reload() }
  })

  const approve = () => run(async () => {
    const gcc = parseInt(val.gcc, 10)
    if (!(gcc > 0)) { flash(false, 'Enter the GCC number for this student.'); return }
    if (gate.hard.length) { flash(false, gate.hard[0]); return }
    if (gate.docs.length && !val.override) { flash(false, 'Documents are not verified. Verify them, or tick "approve without verified documents".'); return }
    const { data: clash } = await supabase.from('admissions').select('gcc_no').eq('gcc_no', gcc).maybeSingle()
    if (clash) { flash(false, `GCC ${gcc} is already used by another application.`); return }
    const row = applicationRowFromPortal(a, { gcc })
    const ins = await supabase.from('admissions').insert(row).select().single()
    if (ins.error) { flash(false, ins.error.code === '23505' ? `GCC ${gcc} is already used.` : 'Could not create the admission: ' + ins.error.message); return }
    // the fee the applicant already paid goes into the normal ledger; if that fails the admission is rolled back
    const fee = feeFromPortal(a)
    if (!a.fee_recorded && a.fee_status === 'Paid' && fee.amount > 0) {
      try {
        await collectFee({
          gcc, studentName: a.student_name, admNo: ins.data?.adm_no || '--', className: a.batch || '', course: a.course || '', hostelType: a.hostel_type || 'Day Scholar',
          payDate: fee.payDate, payMode: fee.payMode, txnRef: fee.txnRef, collectedBy: 'Admission portal', staffId: staffName(), receiptNo: rcptNo('ONL'),
          items: [{ kind: 'admission', label: 'Admission Fee', amount: fee.amount }], skipHold: true,
        })
      } catch (e) {
        await supabase.from('admissions').delete().eq('gcc_no', gcc)
        flash(false, 'The fee could not be recorded, so nothing was created: ' + (e.message || e)); return
      }
    }
    const note = gate.docs.length ? `Approved without all documents verified: ${gate.docs.join('; ')}` : null
    const ok = await patch({ status: 'Approved', promoted_gcc: gcc, fee_recorded: a.fee_status === 'Paid', reviewed_by: staffName(), reviewed_at: new Date().toISOString(), public_note: null }, 'approved', `GCC ${gcc}${note ? ` · ${note}` : ''}`)
    if (ok) { flash(true, `Approved — GCC ${gcc} created (status Admitted)${a.fee_status === 'Paid' ? ' and the admission fee recorded' : ''}. Continue in Applications to enrol.`); setPanel(null); setVal({}); reload() }
  })

  const openApprove = async () => {
    setPanel('approve')
    if (!val.gcc) {
      const { data } = await supabase.from('admissions').select('gcc_no').order('gcc_no', { ascending: false }).limit(1)
      setVal(v => ({ ...v, gcc: String((parseInt(data?.[0]?.gcc_no, 10) || 0) + 1) }))
    }
  }

  if (!a) return <Modal title="Application" onClose={onClose}>{msg ? <div style={{ color: BAD }}>{msg.text}</div> : 'Loading…'}</Modal>
  const f = a.form || {}
  const stage = applicantStage(a, docs)
  const field = (k, v) => v ? <div key={k} style={{ fontSize: 13 }}><span style={{ color: SUB, fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>{k}</span>{v}</div> : null
  const input = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: `1px solid ${LINE}`, borderRadius: 6, fontSize: 13, fontFamily: 'inherit' }

  return (
    <Modal title={`${a.student_name} · ${a.reference_no}`} onClose={onClose} wide={860}>
      {msg && <div style={{ background: msg.ok ? '#E8F7EE' : '#FEF3F2', color: msg.ok ? GOOD : BAD, padding: '9px 12px', borderRadius: 6, marginBottom: 12, fontSize: 13, fontWeight: 600 }}>{msg.text}</div>}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
        {photo ? <img src={photo} alt="" style={{ width: 92, height: 114, objectFit: 'cover', border: `1px solid ${LINE}`, borderRadius: 4 }} /> : <div style={{ width: 92, height: 114, background: '#F3F6FA', border: `1px solid ${LINE}`, borderRadius: 4 }} />}
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
            <Chip map={STATUS_STYLE} v={a.status} /><span style={chip(...(FEE_STYLE[a.fee_status] || ['#EEF1F5', SUB]))}>Fee: {a.fee_status}</span>
            {a.promoted_gcc && <span style={chip('#E8F7EE', GOOD)}>GCC {a.promoted_gcc}</span>}
          </div>
          <div style={{ fontSize: 13, color: SUB }}>{a.course} · {a.batch} · {a.hostel_type} · Session {a.session} · applied {fdate(a.created_at)}</div>
          <div style={{ fontSize: 12.5, color: SUB, marginTop: 4 }}>Applicant sees: <b style={{ color: NAVY }}>{stage.label}</b>{stage.next ? ` — ${stage.next}` : ''}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10, marginTop: 12 }}>
            {field('Date of birth', fdate(a.dob))}{field('Gender / category', [f.gender, f.category].filter(Boolean).join(' / '))}{field('Father', f.father_name)}{field('Mother', f.mother_name)}
            {field('Mobile', a.phone)}{field('Alt. mobile', f.alt_phone)}{field('Email', a.email)}{field('Aadhaar', f.aadhaar_last4 && `•••• •••• ${f.aadhaar_last4}`)}
            {field('Address', [f.address, f.district, f.state, f.pincode].filter(Boolean).join(', '))}{field('Last school', [f.prev_school, f.prev_class, f.prev_percent].filter(Boolean).join(' · '))}
            {field('Religion / mother tongue', [f.religion, f.mother_tongue].filter(Boolean).join(' / '))}{field('Blood group', f.blood_group)}{field('Sibling GCC', f.sibling_gcc)}
          </div>
        </div>
      </div>

      {/* payment */}
      <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, padding: 14, marginBottom: 14 }}>
        <div style={{ fontWeight: 800, color: NAVY, marginBottom: 6 }}>Admission fee {inr(a.fee_amount)}</div>
        {a.fee_status === 'Paid' && <div style={{ fontSize: 13 }}>Paid {fdate(a.fee_paid_on)} · {a.payment_mode || '—'}{a.payment_id ? ` · ${a.payment_id}` : ''} · {a.fee_recorded ? <span style={{ color: GOOD, fontWeight: 700 }}>in the fee ledger</span> : <span style={{ color: AMBER, fontWeight: 700 }}>will be entered in the fee ledger on approval</span>}</div>}
        {a.fee_status === 'Refunded' && <div style={{ fontSize: 13 }}>Refunded {fdate(a.refunded_on)} · {a.refund_ref}</div>}
        {a.fee_status === 'Waived' && <div style={{ fontSize: 13 }}>Waived</div>}
        {a.fee_status === 'Refund due' && <div style={{ fontSize: 13, color: BAD, fontWeight: 700 }}>Refund due — refund {inr(a.fee_amount)} from the Razorpay dashboard (payment {a.payment_id || '—'}), then record it.</div>}
        {a.fee_status === 'Unpaid' && <div style={{ fontSize: 13, color: AMBER, fontWeight: 600 }}>Not paid yet — the applicant can pay online from the Track page, or you can record a counter payment.</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          {a.fee_status === 'Unpaid' && open && <button type="button" style={btn('blue', busy)} disabled={busy} onClick={() => { setPanel('offline'); setVal({ mode: 'Cash' }) }}>Record counter payment</button>}
          {a.fee_status === 'Unpaid' && open && isAdmin && <button type="button" style={btn('ghost', busy)} disabled={busy} onClick={waive}>Waive fee (admin)</button>}
          {a.fee_status === 'Refund due' && <button type="button" style={btn('orange', busy)} disabled={busy} onClick={() => { setPanel('refund'); setVal({}) }}>Mark refunded</button>}
        </div>
      </div>

      {/* documents */}
      <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, padding: 14, marginBottom: 14 }}>
        <div style={{ fontWeight: 800, color: NAVY, marginBottom: 6 }}>Documents</div>
        {DOC_TYPES.map(t => {
          const mine = docs.filter(d => d.doc_type === t.key)
          const s = dstat.find(x => x.key === t.key)
          return (
            <div key={t.key} style={{ padding: '8px 0', borderBottom: `1px solid ${LINE}` }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 180, fontSize: 13.5, fontWeight: 700 }}>{t.label}{t.required && <span style={{ color: BAD }}> *</span>}</div>
                <span style={chip(...(s.state === 'verified' ? ['#E8F7EE', GOOD] : s.state === 'uploaded' ? ['#E6EEF9', BLUE] : s.state === 'rejected' ? ['#FEF3F2', BAD] : t.required ? ['#FFF4E5', AMBER] : ['#EEF1F5', SUB]))}>{s.state === 'missing' ? (t.required ? 'Missing' : 'Not given') : s.state}</span>
                {canWrite && open && <label style={{ ...btn('ghost'), display: 'inline-block' }}>+ Add<input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={e => { const x = e.target.files?.[0]; e.target.value = ''; addDoc(t.key, x) }} /></label>}
              </div>
              {mine.map(d => (
                <div key={d.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, padding: '4px 0 0 14px', flexWrap: 'wrap' }}>
                  <button type="button" style={{ ...btn('ghost'), padding: '3px 9px' }} onClick={() => viewDoc(d)}>View</button>
                  <span style={{ color: SUB }}>{d.file_name || d.storage_path.split('/').pop()} · {d.status}{d.remark ? ` — ${d.remark}` : ''}{d.verified_by ? ` · ${d.verified_by}` : ''}</span>
                  {canWrite && open && d.status !== 'Verified' && <button type="button" style={{ ...btn('green'), padding: '3px 9px' }} disabled={busy} onClick={() => setDocStatus(d)('Verified')}>Verify</button>}
                  {canWrite && open && d.status !== 'Rejected' && <button type="button" style={{ ...btn('red'), padding: '3px 9px' }} disabled={busy} onClick={() => setDocStatus(d)('Rejected')}>Reject</button>}
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* decisions */}
      {canWrite && open && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <button type="button" style={btn('green', busy)} disabled={busy} onClick={openApprove}>Approve → create admission</button>
          <button type="button" style={btn('ghost', busy)} disabled={busy} onClick={() => { setPanel('request'); setVal({ note: a.public_note || '' }) }}>Request documents / info</button>
          {a.status !== 'Under review' && <button type="button" style={btn('ghost', busy)} disabled={busy} onClick={markReview}>Mark under review</button>}
          <button type="button" style={btn('red', busy)} disabled={busy} onClick={() => { setPanel('reject'); setVal({}) }}>Reject</button>
        </div>
      )}
      {canWrite && <div style={{ marginBottom: 12 }}><button type="button" style={btn('ghost')} onClick={() => { setPanel('note'); setVal({}) }}>+ Internal note</button></div>}

      {panel && (
        <div style={{ background: '#F7F9FC', border: `1px solid ${LINE}`, borderRadius: 8, padding: 14, marginBottom: 14 }}>
          {panel === 'approve' && (
            <div>
              <div style={{ fontWeight: 800, color: NAVY, marginBottom: 8 }}>Approve {a.student_name}</div>
              <label style={{ fontSize: 12, fontWeight: 700, color: SUB }}>GCC number<input style={{ ...input, maxWidth: 200, display: 'block', marginTop: 3 }} value={val.gcc || ''} onChange={e => setVal(v => ({ ...v, gcc: e.target.value.replace(/\D/g, '') }))} /></label>
              {(gate.hard.length > 0 || gate.docs.length > 0) && (
                <div style={{ margin: '10px 0', fontSize: 12.5, color: AMBER }}>
                  <b>Not ready:</b><ul style={{ margin: '4px 0 6px 18px', padding: 0 }}>{[...gate.hard, ...gate.docs].map(b => <li key={b}>{b}</li>)}</ul>
                  {gate.hard.length === 0 && <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 600 }}><input type="checkbox" checked={!!val.override} onChange={e => setVal(v => ({ ...v, override: e.target.checked }))} />Approve without verified documents (recorded in the timeline)</label>}
                </div>
              )}
              <div style={{ fontSize: 12, color: SUB, margin: '8px 0' }}>Creates the admission (status Admitted){a.fee_status === 'Paid' ? ` and enters the ${inr(a.fee_amount)} already paid in the fee ledger` : ''}. Enrol from the Applications tab afterwards.</div>
              <button type="button" style={btn('green', busy || gate.hard.length > 0)} disabled={busy || gate.hard.length > 0} onClick={approve}>{busy ? 'Working…' : 'Approve & create admission'}</button>
            </div>
          )}
          {panel === 'request' && <div><div style={{ fontWeight: 800, color: NAVY, marginBottom: 6 }}>Message to the applicant (shown on their Track page)</div><textarea rows={3} style={input} value={val.note || ''} onChange={e => setVal(v => ({ ...v, note: e.target.value }))} placeholder="e.g. Please upload a clear copy of the birth certificate." /><div style={{ marginTop: 8 }}><button type="button" style={btn('orange', busy)} disabled={busy} onClick={requestDocs}>Send request</button></div></div>}
          {panel === 'reject' && <div><div style={{ fontWeight: 800, color: BAD, marginBottom: 6 }}>Reject — reason (shown to the applicant)</div><textarea rows={3} style={input} value={val.note || ''} onChange={e => setVal(v => ({ ...v, note: e.target.value }))} />{a.fee_status === 'Paid' && <div style={{ fontSize: 12, color: AMBER, margin: '6px 0' }}>The fee already paid will be marked “Refund due”.</div>}<div style={{ marginTop: 8 }}><button type="button" style={btn('red', busy)} disabled={busy} onClick={reject}>Reject application</button></div></div>}
          {panel === 'offline' && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: SUB }}>Mode<select style={{ ...input, display: 'block', marginTop: 3 }} value={val.mode || 'Cash'} onChange={e => setVal(v => ({ ...v, mode: e.target.value }))}>{['Cash', 'UPI', 'Bank transfer', 'Cheque'].map(m => <option key={m}>{m}</option>)}</select></label>
            <label style={{ fontSize: 12, fontWeight: 700, color: SUB, flex: 1, minWidth: 180 }}>Reference / receipt no.<input style={{ ...input, display: 'block', marginTop: 3 }} value={val.ref || ''} onChange={e => setVal(v => ({ ...v, ref: e.target.value }))} /></label>
            <button type="button" style={btn('blue', busy)} disabled={busy} onClick={offlinePay}>Record {inr(a.fee_amount)} received</button></div>}
          {panel === 'refund' && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}><label style={{ fontSize: 12, fontWeight: 700, color: SUB, flex: 1, minWidth: 200 }}>Razorpay refund id / bank reference<input style={{ ...input, display: 'block', marginTop: 3 }} value={val.ref || ''} onChange={e => setVal(v => ({ ...v, ref: e.target.value }))} /></label><button type="button" style={btn('orange', busy)} disabled={busy} onClick={refunded}>Mark refunded</button></div>}
          {panel === 'note' && <div><textarea rows={2} style={input} value={val.note || ''} onChange={e => setVal(v => ({ ...v, note: e.target.value }))} placeholder="Internal note — the applicant never sees this" /><div style={{ marginTop: 8 }}><button type="button" style={btn('blue', busy)} disabled={busy} onClick={addNote}>Save note</button></div></div>}
        </div>
      )}

      <div style={{ fontWeight: 800, color: NAVY, margin: '6px 0' }}>Timeline</div>
      {events.map(e => (
        <div key={e.id} style={{ display: 'flex', gap: 10, fontSize: 12.5, padding: '5px 0', borderBottom: `1px dashed ${LINE}` }}>
          <span style={{ width: 112, color: '#7B8AA0', flexShrink: 0 }}>{fdt(e.at)}</span>
          <span><b style={{ textTransform: 'capitalize' }}>{e.action === 'note' ? 'internal note' : e.action.replace(/_/g, ' ')}</b>{e.detail ? <span style={{ color: SUB }}> — {e.detail}</span> : null} <span style={{ color: '#9AA7BB' }}>({e.actor})</span></span>
        </div>
      ))}
    </Modal>
  )
}

// ── Queue ────────────────────────────────────────────────────────────────────
function Queue({ canWrite, isAdmin, onChanged }) {
  const [rows, setRows] = useState(null)
  const [docRows, setDocRows] = useState([])
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('open')
  const [openId, setOpenId] = useState(null)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => { setTick(t => t + 1); onChanged?.() }, [onChanged])

  useEffect(() => {
    let live = true
    Promise.all([
      supabase.from('portal_applications').select('id, reference_no, student_name, phone, course, batch, hostel_type, status, fee_status, fee_amount, created_at, promoted_gcc, session').order('created_at', { ascending: false }).limit(2000),
      supabase.from('portal_application_docs').select('application_id, doc_type, status').limit(10000),
    ]).then(([a, d]) => {
      if (!live) return
      if (a.error) { setErr(/portal_applications/.test(a.error.message) ? 'The portal tables are not created yet — run the 20261030_admission_portal.sql migration in Supabase.' : a.error.message); setRows([]); return }
      setErr(''); setRows(a.data || []); setDocRows(d.data || [])
    })
    return () => { live = false }
  }, [tick])

  const docProgress = useMemo(() => {
    const m = new Map()
    for (const r of docRows) { const x = m.get(r.application_id) || { verified: new Set(), any: new Set() }; if (r.status === 'Verified') x.verified.add(r.doc_type); if (r.status !== 'Rejected') x.any.add(r.doc_type); m.set(r.application_id, x) }
    const need = DOC_TYPES.filter(t => t.required)
    return id => { const x = m.get(id); return { total: need.length, verified: need.filter(t => x?.verified.has(t.key)).length, given: need.filter(t => x?.any.has(t.key)).length } }
  }, [docRows])

  const counts = useMemo(() => {
    const c = { open: 0, paid: 0, refund: 0 }
    for (const s of STATUSES) c[s] = 0
    for (const r of rows || []) { c[r.status] = (c[r.status] || 0) + 1; if (OPEN_STATUSES.includes(r.status)) c.open++; if (OPEN_STATUSES.includes(r.status) && r.fee_status === 'Paid') c.paid++; if (r.fee_status === 'Refund due') c.refund++ }
    return c
  }, [rows])
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (rows || []).filter(r => (filter === 'all' ? true : filter === 'open' ? OPEN_STATUSES.includes(r.status) : filter === 'paid' ? OPEN_STATUSES.includes(r.status) && r.fee_status === 'Paid' : filter === 'refund' ? r.fee_status === 'Refund due' : r.status === filter)
      && (!t || [r.reference_no, r.student_name, r.phone, r.course, r.batch, r.promoted_gcc].some(v => String(v || '').toLowerCase().includes(t))))
  }, [rows, filter, q])

  const FILTERS = [['open', 'Needs action'], ['paid', 'Paid, awaiting review'], ['Docs requested', 'Docs requested'], ['Approved', 'Approved'], ['Rejected', 'Rejected'], ['refund', 'Refunds due'], ['all', 'All']]
  return (
    <div>
      {err && <div style={{ background: '#FEF3F2', color: BAD, padding: '10px 14px', borderRadius: 6, marginBottom: 12, fontSize: 13, fontWeight: 600 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        {FILTERS.map(([k, label]) => (
          <button key={k} type="button" onClick={() => setFilter(k)} style={{ ...btn(filter === k ? 'blue' : 'ghost'), padding: '6px 12px' }}>{label}{k !== 'all' && <span style={{ opacity: .75 }}> {counts[k] ?? 0}</span>}</button>
        ))}
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, reference, mobile…" style={{ marginLeft: 'auto', padding: '7px 11px', border: `1px solid ${LINE}`, borderRadius: 6, fontSize: 13, minWidth: 220 }} />
      </div>
      {rows === null ? <div style={{ color: SUB }}>Loading…</div> : shown.length === 0 ? <div style={{ color: SUB, padding: 20, textAlign: 'center' }}>{rows.length === 0 ? 'No online applications yet. Share the portal link from the “Portal link” tab.' : 'Nothing matches this filter.'}</div> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: '#F3F6FA', textAlign: 'left' }}>{['Reference', 'Applicant', 'Course · batch', 'Applied', 'Fee', 'Documents', 'Status'].map(h => <th key={h} style={{ padding: '8px 10px', borderBottom: `1px solid ${LINE}`, fontSize: 11.5, color: SUB, textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>)}</tr></thead>
            <tbody>
              {shown.map(r => {
                const dp = docProgress(r.id)
                return (
                  <tr key={r.id} onClick={() => setOpenId(r.id)} style={{ cursor: 'pointer', borderBottom: `1px solid ${LINE}` }}>
                    <td style={{ padding: '9px 10px', fontWeight: 800, color: NAVY, whiteSpace: 'nowrap' }}>{r.reference_no}</td>
                    <td style={{ padding: '9px 10px' }}><div style={{ fontWeight: 700 }}>{r.student_name}</div><div style={{ fontSize: 11.5, color: SUB }}>{r.phone}</div></td>
                    <td style={{ padding: '9px 10px' }}>{r.course} · {r.batch}<div style={{ fontSize: 11.5, color: SUB }}>{r.hostel_type}</div></td>
                    <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>{fdate(r.created_at)}</td>
                    <td style={{ padding: '9px 10px' }}><Chip map={FEE_STYLE} v={r.fee_status} /><div style={{ fontSize: 11.5, color: SUB }}>{inr(r.fee_amount)}</div></td>
                    <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}><span style={{ color: dp.verified === dp.total ? GOOD : dp.given === dp.total ? BLUE : AMBER, fontWeight: 700 }}>{dp.verified}/{dp.total} verified</span><div style={{ fontSize: 11.5, color: SUB }}>{dp.given}/{dp.total} received</div></td>
                    <td style={{ padding: '9px 10px' }}><Chip map={STATUS_STYLE} v={r.status} />{r.promoted_gcc && <div style={{ fontSize: 11.5, color: SUB }}>GCC {r.promoted_gcc}</div>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {openId && <Detail id={openId} canWrite={canWrite} isAdmin={isAdmin} onClose={() => setOpenId(null)} onChanged={reload} />}
    </div>
  )
}

// ── Public link ──────────────────────────────────────────────────────────────
function PortalLink() {
  const [qr, setQr] = useState('')
  const [open, setOpen] = useState(null)
  const link = `${window.location.origin}/apply`
  useEffect(() => { QRCode.toDataURL(link, { margin: 1, width: 200 }).then(setQr).catch(() => setQr('')) }, [link])
  useEffect(() => {
    supabase.from('admission_sessions').select('session_name, is_active, is_locked').eq('is_active', true).limit(1).then(({ data }) => setOpen(data?.[0] || false))
  }, [])
  const copy = () => navigator.clipboard?.writeText(link).catch(() => {})
  return (
    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <div>
        <div style={{ fontWeight: 800, color: NAVY, marginBottom: 6 }}>Public application link</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <code style={{ background: '#F3F6FA', padding: '8px 12px', borderRadius: 6, fontSize: 13 }}>{link}</code>
          <button type="button" style={btn('ghost')} onClick={copy}>Copy</button>
          <a href={link} target="_blank" rel="noreferrer" style={{ ...btn('blue'), textDecoration: 'none' }}>Open</a>
        </div>
        <div style={{ fontSize: 12.5, color: SUB, marginTop: 8 }}>Applicants track their application at <code>{window.location.origin}/apply-status</code> with the reference number and date of birth.</div>
        <div style={{ marginTop: 14, fontSize: 13 }}>
          {open === null ? '' : open && !open.is_locked ? <span style={{ color: GOOD, fontWeight: 700 }}>● Open — taking applications for session {open.session_name}</span> : <span style={{ color: BAD, fontWeight: 700 }}>● Closed — {open ? `session ${open.session_name} is locked` : 'no admission session is active'} (Sessions tab)</span>}
        </div>
        <ul style={{ fontSize: 12.5, color: SUB, margin: '14px 0 0 18px', padding: 0, lineHeight: 1.7 }}>
          <li>Courses, batches and the admission fee offered on the form come from <b>Fee Setup</b> for the active session — a combination with no row there cannot be applied for.</li>
          <li>The fee is decided on the server and charged through Razorpay; it is only marked paid after Razorpay confirms the payment.</li>
          <li>On approval the admission is created as <b>Admitted</b> and the fee is entered in the fee ledger and accounts automatically.</li>
          <li>Needs the Vercel variables <code>SUPABASE_URL</code>, <code>SUPABASE_SERVICE_ROLE_KEY</code>, <code>RAZORPAY_KEY_ID</code>, <code>RAZORPAY_KEY_SECRET</code> and the 20261030 migration.</li>
        </ul>
      </div>
      {qr && <div style={{ textAlign: 'center' }}><img src={qr} alt="QR code" style={{ width: 180, height: 180, border: `1px solid ${LINE}` }} /><div style={{ fontSize: 11.5, color: SUB }}>Scan to apply</div></div>}
    </div>
  )
}

export default function AdmissionPortalAdmin({ canWrite, isAdmin, counterForm, onChanged }) {
  const [tab, setTab] = useState('online')
  const [pending, setPending] = useState(null)
  useEffect(() => {
    let live = true
    supabase.from('portal_applications').select('id', { count: 'exact', head: true }).in('status', OPEN_STATUSES).then(({ count, error }) => { if (live) setPending(error ? null : count) })
    return () => { live = false }
  }, [tab])
  const TABS = [['online', `Online applications${pending ? ` (${pending})` : ''}`], ['counter', 'Counter application'], ['link', 'Portal link']]
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, borderBottom: `2px solid ${LINE}`, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)} style={{ padding: '10px 16px', border: 0, borderBottom: `3px solid ${tab === k ? ORANGE : 'transparent'}`, marginBottom: -2, background: 'none', fontWeight: 800, fontSize: 13.5, color: tab === k ? NAVY : SUB, cursor: 'pointer', fontFamily: 'inherit' }}>{label}</button>
        ))}
      </div>
      {tab === 'online' && <Queue canWrite={canWrite} isAdmin={isAdmin} onChanged={onChanged} />}
      {tab === 'counter' && counterForm}
      {tab === 'link' && <PortalLink />}
    </div>
  )
}
