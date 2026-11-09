// StudentLocker.jsx — a DigiLocker-style wallet for one student: every document as a tile (Missing / Uploaded / Verified /
// Rejected) with view, download, upload, verify and a time-limited share link + QR, plus the documents the institute has
// issued (admission form, fee receipts). Files live in the private 'gnsi' bucket under student_docs/<student id>/, rows in
// `student_documents` — the same place the Students module already uses.
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import QRCode from 'qrcode'
import { supabase } from './supabase'
import { compressImage } from './lib/imageCompress'
import { buildLocker, docStatus } from './lib/locker'

const BUCKET = 'gnsi'
const NAVY = '#0B2545', TEAL = '#0E7C86', LINE = '#E3E9F0', SUB = '#5A6B7F', MUTE = '#8A97A8'
const TONE = { Missing: ['#8A97A8', '#F3F6FA'], Uploaded: ['#B45309', '#FFF4E5'], Verified: ['#15803D', '#E8F7EE'], Rejected: ['#B42318', '#FEF3F2'] }
const MAX_MB = 10
const slug = t => t.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
const rand = () => Math.random().toString(36).slice(2, 8)
const d10 = v => (v ? String(v).slice(0, 10) : '—')
const inr = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN')

export default function StudentLocker({ student, app, userName, canWrite, canVerify, canDelete, onClose, onPrintApplication, onOpenLedger }) {
  const [rows, setRows] = useState(null)
  const [receipts, setReceipts] = useState([])
  const [urls, setUrls] = useState({})
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState(null)       // { ok, text }
  const [share, setShare] = useState(null)   // { type, url, qr, hours }
  const [tick, setTick] = useState(0)
  const reload = () => setTick(t => t + 1)

  useEffect(() => {
    let live = true
    ;(async () => {
      const gcc = String(parseInt(student.gcc_no) || '')
      const [docs, adm, flat, crs] = await Promise.all([
        supabase.from('student_documents').select('*').eq('student_id', student.id).order('created_at', { ascending: false }),
        supabase.from('adm_fee_collections').select('amount_paid, receipt_no, pay_date, description, fee_type').eq('adm_app_id', gcc).eq('reverted', false),
        supabase.from('adm_flat_fees').select('amount, receipt_no, pay_date, month, year').eq('adm_app_id', gcc).eq('paid', true).eq('reverted', false),
        supabase.from('adm_course_fees').select('amount_paid, receipt_no, pay_date, for_month, year').eq('adm_app_id', gcc).eq('reverted', false),
      ])
      if (!live) return
      if (docs.error) { setMsg({ ok: false, text: 'Could not load documents: ' + docs.error.message }); setRows([]) } else setRows(docs.data || [])
      setReceipts([
        ...(adm.data || []).map(r => ({ no: r.receipt_no, date: r.pay_date, amount: r.amount_paid, label: r.description || (r.fee_type === 'admission' ? 'Admission fee' : r.fee_type) })),
        ...(flat.data || []).map(r => ({ no: r.receipt_no, date: r.pay_date, amount: r.amount, label: `Flat fee · ${r.month} ${r.year}` })),
        ...(crs.data || []).map(r => ({ no: r.receipt_no, date: r.pay_date, amount: r.amount_paid, label: `Course fee · ${r.for_month} ${r.year}` })),
      ].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))))
    })()
    return () => { live = false }
  }, [student.id, student.gcc_no, tick])

  const locker = useMemo(() => buildLocker(rows || []), [rows])

  // Short-lived viewing links for every stored file, so tiles can open them straight away.
  useEffect(() => {
    const paths = (rows || []).map(r => r.storage_path).filter(Boolean)
    if (!paths.length) return
    let live = true
    supabase.storage.from(BUCKET).createSignedUrls(paths, 3600).then(({ data }) => {
      if (live && data) setUrls(Object.fromEntries(data.filter(d => d.signedUrl).map(d => [d.path, d.signedUrl])))
    }).catch(() => {})
    return () => { live = false }
  }, [rows])

  const flash = (ok, text) => setMsg({ ok, text })

  const upload = async (type, file) => {
    if (!file) return
    if (file.size > MAX_MB * 1024 * 1024) { flash(false, `That file is over ${MAX_MB} MB.`); return }
    if (!/^image\/|^application\/pdf$/.test(file.type)) { flash(false, 'Upload an image or a PDF.'); return }
    setBusy(type); setMsg(null)
    try {
      const f = file.type.startsWith('image/') ? (await compressImage(file, { maxDim: 1600, quality: 0.88, targetKB: 400 })).file : file
      const ext = (f.name.split('.').pop() || (f.type === 'application/pdf' ? 'pdf' : 'jpg')).toLowerCase()
      const path = `student_docs/${student.id}/${slug(type)}_${rand()}.${ext}`
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, f, { upsert: false, contentType: f.type })
      if (upErr) throw new Error('Upload failed: ' + (upErr.message || 'storage refused the file'))
      const base = { student_id: student.id, doc_type: type, file_name: file.name, storage_path: path }
      let { error } = await supabase.from('student_documents').insert({ ...base, status: 'Uploaded', mime: f.type, size_bytes: f.size })
      if (error && /status|mime|size_bytes|column/i.test(error.message || '')) ({ error } = await supabase.from('student_documents').insert(base))   // verification columns not added yet
      if (error) { await supabase.storage.from(BUCKET).remove([path]); throw new Error('Could not save: ' + error.message) }
      flash(true, `${type} uploaded.`); reload()
    } catch (e) { flash(false, e.message || 'Upload failed') }
    setBusy('')
  }

  const setStatus = async (doc, status) => {
    let note = null
    if (status === 'Rejected') { note = window.prompt('Why is this document rejected? (shown on the tile)', '') ; if (note === null) return }
    setBusy(doc.id)
    const patch = status === 'Verified' ? { status, verified_by: userName || 'Staff', verified_at: new Date().toISOString(), note: null } : { status, verified_by: userName || 'Staff', verified_at: new Date().toISOString(), note: note || null }
    const { error } = await supabase.from('student_documents').update(patch).eq('id', doc.id)
    setBusy('')
    if (error) flash(false, /column|status/i.test(error.message || '') ? 'Run supabase/migrations/20261028_student_documents_verify.sql in Supabase first (it adds the Verified status).' : error.message)
    else { flash(true, `Marked ${status}.`); reload() }
  }

  const remove = async doc => {
    if (!window.confirm(`Delete "${doc.file_name || doc.doc_type}" from the locker?`)) return
    setBusy(doc.id)
    const { error } = await supabase.from('student_documents').delete().eq('id', doc.id)
    if (!error && doc.storage_path) await supabase.storage.from(BUCKET).remove([doc.storage_path])
    setBusy('')
    if (error) flash(false, error.message); else { flash(true, 'Deleted.'); reload() }
  }

  const makeShare = async (doc, hours) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(doc.storage_path, hours * 3600)
    if (error || !data?.signedUrl) { flash(false, 'Could not create a link: ' + (error?.message || 'unknown error')); return }
    const qr = await QRCode.toDataURL(data.signedUrl, { margin: 1, width: 220 }).catch(() => '')
    setShare({ doc, type: doc.doc_type, url: data.signedUrl, qr, hours })
  }

  const pct = locker.counts.required ? Math.round((locker.counts.verifiedRequired / locker.counts.required) * 100) : 0
  const btn = { padding: '6px 11px', borderRadius: 8, border: `1px solid ${LINE}`, background: '#fff', color: NAVY, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(11,37,69,.55)', zIndex: 99998, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '28px 12px', overflow: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#F4F7FA', borderRadius: 20, width: '100%', maxWidth: 980, overflow: 'hidden', boxShadow: '0 30px 80px -20px rgba(0,0,0,.55)', fontFamily: "Inter,'Segoe UI',system-ui,sans-serif" }}>
        {/* header */}
        <div style={{ background: 'linear-gradient(135deg,#0B2545,#13315C 60%,#0E7C86)', color: '#fff', padding: '20px 24px', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(255,255,255,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🔐</div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', opacity: .75 }}>GNSI Document Locker</div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Source Serif 4',Georgia,serif" }}>{student.name || app?.name}</div>
            <div style={{ fontSize: 12.5, opacity: .8 }}>GCC-{student.gcc_no}{student.course ? ` · ${student.course}` : ''}{student.batch ? ` · ${student.batch}` : ''}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 30, fontWeight: 700, fontFamily: "'Source Serif 4',Georgia,serif" }}>{locker.counts.verifiedRequired}/{locker.counts.required}</div>
            <div style={{ fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', opacity: .75 }}>required verified</div>
            <div style={{ height: 5, borderRadius: 99, background: 'rgba(255,255,255,.2)', marginTop: 6, overflow: 'hidden', width: 120 }}><i style={{ display: 'block', height: '100%', width: `${pct}%`, background: '#7DE0B0' }} /></div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ ...btn, background: 'rgba(255,255,255,.14)', color: '#fff', borderColor: 'rgba(255,255,255,.3)' }}>✕</button>
        </div>

        <div style={{ padding: 20 }}>
          {msg && <div style={{ marginBottom: 12, padding: '9px 14px', borderRadius: 10, fontSize: 12.5, fontWeight: 600, color: msg.ok ? '#15803D' : '#B42318', background: msg.ok ? '#E8F7EE' : '#FEF3F2', border: `1px solid ${msg.ok ? '#B7E4C7' : '#FECDCA'}` }}>{msg.text}</div>}
          {!rows ? <div style={{ color: MUTE, padding: 30, textAlign: 'center' }}>Opening locker…</div> : (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: MUTE, marginBottom: 10 }}>Documents</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(270px,1fr))', gap: 12 }}>
                {locker.slots.map(s => {
                  const d = s.current
                  const status = d ? docStatus(d) : 'Missing'
                  const [fg, bg] = TONE[status] || TONE.Uploaded
                  const url = d?.storage_path ? urls[d.storage_path] : null
                  return (
                    <div key={s.type} style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 16, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, borderTop: `3px solid ${fg}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 22 }}>{s.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13.5, color: NAVY }}>{s.type}{s.required && <span style={{ color: '#B42318' }}> *</span>}</div>
                          <div style={{ fontSize: 11, color: SUB, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d ? `${d.file_name || 'file'} · ${d10(d.created_at)}` : 'Not uploaded'}</div>
                        </div>
                        <span style={{ fontSize: 10.5, fontWeight: 800, color: fg, background: bg, padding: '3px 9px', borderRadius: 99 }}>{status === 'Verified' ? '✓ ' : ''}{status}</span>
                      </div>
                      {d && status === 'Verified' && d.verified_by && <div style={{ fontSize: 11, color: '#15803D' }}>Verified by {d.verified_by} · {d10(d.verified_at)}</div>}
                      {d && status === 'Rejected' && <div style={{ fontSize: 11, color: '#B42318' }}>Rejected{d.note ? ` — ${d.note}` : ''}</div>}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {d && url && <a href={url} target="_blank" rel="noreferrer" style={{ ...btn, textDecoration: 'none' }}>View</a>}
                        {d && url && <a href={url} download={d.file_name || undefined} style={{ ...btn, textDecoration: 'none' }}>Download</a>}
                        {d && d.storage_path && <button type="button" style={btn} onClick={() => makeShare(d, 24)}>Share</button>}
                        {canWrite && (
                          <label style={{ ...btn, background: d ? '#fff' : TEAL, color: d ? NAVY : '#fff', borderColor: d ? LINE : TEAL, opacity: busy === s.type ? .6 : 1 }}>
                            {busy === s.type ? 'Uploading…' : d ? 'Replace' : 'Upload'}
                            <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} disabled={!!busy} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; upload(s.type, f) }} />
                          </label>
                        )}
                        {d && canVerify && status !== 'Verified' && <button type="button" style={{ ...btn, color: '#15803D', borderColor: '#B7E4C7' }} disabled={busy === d.id} onClick={() => setStatus(d, 'Verified')}>✓ Verify</button>}
                        {d && canVerify && status !== 'Rejected' && <button type="button" style={{ ...btn, color: '#B42318', borderColor: '#FECDCA' }} disabled={busy === d.id} onClick={() => setStatus(d, 'Rejected')}>Reject</button>}
                        {d && canDelete && <button type="button" style={{ ...btn, color: '#B42318' }} disabled={busy === d.id} onClick={() => remove(d)}>Delete</button>}
                      </div>
                      {s.docs.length > 1 && <div style={{ fontSize: 10.5, color: MUTE }}>{s.docs.length - 1} older version{s.docs.length > 2 ? 's' : ''} kept</div>}
                    </div>
                  )
                })}
              </div>

              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: MUTE, margin: '22px 0 10px' }}>Issued by GNSI</div>
              <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 16, overflow: 'hidden' }}>
                {app && onPrintApplication && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${LINE}` }}>
                    <span style={{ fontSize: 20 }}>📋</span>
                    <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 13, color: NAVY }}>Admission application</div><div style={{ fontSize: 11, color: SUB }}>GCC-{student.gcc_no} · {app.status || ''} · {app.session || ''}</div></div>
                    <button type="button" style={btn} onClick={() => onPrintApplication(app)}>Open / print</button>
                  </div>
                )}
                {receipts.length === 0 ? <div style={{ padding: 16, fontSize: 12.5, color: MUTE }}>No fee receipts yet.</div> : receipts.slice(0, 12).map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: i < Math.min(receipts.length, 12) - 1 ? `1px solid #F0F3F8` : 'none' }}>
                    <span style={{ fontSize: 18 }}>🧾</span>
                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 12.5, color: NAVY }}>{r.label}</div><div style={{ fontSize: 11, color: SUB }}>{r.no || 'no receipt no.'} · {d10(r.date)}</div></div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#15803D', fontVariantNumeric: 'tabular-nums' }}>{inr(r.amount)}</div>
                  </div>
                ))}
                <div style={{ padding: '10px 16px', background: '#F8FAFC', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11.5, color: SUB, flex: 1 }}>{receipts.length > 12 ? `Showing 12 of ${receipts.length} receipts. ` : ''}Receipts can be re-issued from the fee ledger.</span>
                  {onOpenLedger && <button type="button" style={btn} onClick={() => onOpenLedger(student.gcc_no)}>Open fee ledger</button>}
                </div>
              </div>
            </>
          )}
        </div>

        {share && (
          <div onClick={() => setShare(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(11,37,69,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 18, padding: 22, width: 'min(420px,92%)', textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: NAVY }}>Share {share.type}</div>
              <div style={{ fontSize: 12, color: SUB, margin: '4px 0 12px' }}>Anyone with this link or QR can open this one file until it expires.</div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 10 }}>
                {[1, 24, 168].map(h => <button key={h} type="button" onClick={() => makeShare(share.doc, h)} style={{ ...btn, ...(share.hours === h ? { background: TEAL, color: '#fff', borderColor: TEAL } : {}) }}>{h === 1 ? '1 hour' : h === 24 ? '1 day' : '7 days'}</button>)}
              </div>
              {share.qr && <img src={share.qr} alt="QR code" width={200} height={200} style={{ border: `1px solid ${LINE}`, borderRadius: 12 }} />}
              <input readOnly value={share.url} onFocus={e => e.target.select()} style={{ width: '100%', boxSizing: 'border-box', margin: '10px 0', padding: '8px 10px', borderRadius: 8, border: `1px solid ${LINE}`, fontSize: 11 }} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button type="button" style={btn} onClick={() => { navigator.clipboard?.writeText(share.url); flash(true, 'Link copied.') }}>Copy link</button>
                <button type="button" style={btn} onClick={() => setShare(null)}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
