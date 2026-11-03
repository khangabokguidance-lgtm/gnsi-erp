// Reception → Donations tab.
// A donation record (donor, purpose, mode, who collected it) plus uploaded documents
// (receipt, cheque photo, letter…) — each document carries the amount paid shown on it.
// Tables / bucket: supabase/migrations/20261059_reception_donations.sql
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { loggedInName } from './lib/collector'

const font = "'Plus Jakarta Sans','Inter',system-ui,sans-serif"
const NAVY = '#132a4f', GOLD = '#b8923a', LINE = '#e8e3d8', SUB = '#5d6b82', RED = '#dc2626', GREEN = '#059669'
const MODES = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card']
const DOC_TYPES = ['Receipt', 'Cheque photo', 'Bank slip', 'Donor letter', 'ID proof', 'Other']
const PURPOSES = ['General', 'Building / Construction', 'Hostel', 'Scholarship', 'Sports', 'Religious', 'Other']
const OK_EXT = ['.pdf', '.jpg', '.jpeg', '.png', '.webp']
const MAX_MB = 10

const inr = n => '₹' + Number(n || 0).toLocaleString('en-IN')
const fmtD = d => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')
const todayStr = () => new Date().toLocaleDateString('en-CA')

const card = { background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, padding: 16 }
const inp = { width: '100%', boxSizing: 'border-box', padding: '9px 11px', border: `1px solid ${LINE}`, borderRadius: 9, fontSize: 13, fontFamily: font, background: '#fff' }
const lbl = { display: 'block', fontSize: 11, fontWeight: 700, color: SUB, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }
const btn = (bg, fg = '#fff') => ({ padding: '9px 16px', border: 'none', borderRadius: 9, background: bg, color: fg, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font })

const blankDoc = () => ({ key: Math.random().toString(36).slice(2), file: null, doc_type: 'Receipt', amount_paid: '', note: '' })
const blankForm = () => ({ donor_name: '', phone: '', student_name: '', gcc_no: '', purpose: 'General', donation_date: todayStr(), pay_mode: 'Cash', txn_ref: '', amount_paid: '', receipt_no: '', remarks: '' })

function fileError(f) {
  if (!f) return null
  const ext = '.' + f.name.split('.').pop().toLowerCase()
  if (!OK_EXT.includes(ext)) return `File type not allowed. Use: ${OK_EXT.join(', ')}`
  if (f.size > MAX_MB * 1024 * 1024) return `File too large. Max ${MAX_MB} MB.`
  return null
}

export default function ReceptionDonations({ currentUser }) {
  const who = loggedInName(currentUser)
  const [rows, setRows] = useState([])
  const [docs, setDocs] = useState({})            // donation_id -> documents[]
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)             // { ok, text }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blankForm())
  const [newDocs, setNewDocs] = useState([blankDoc()])
  const [q, setQ] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [addDocFor, setAddDocFor] = useState(null) // donation_id adding another document
  const [extraDoc, setExtraDoc] = useState(blankDoc())

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('reception_donations').select('*').is('deleted_at', null).order('donation_date', { ascending: false }).order('created_at', { ascending: false })
    if (error) { setMsg({ ok: false, text: 'Could not load donations: ' + error.message }); setLoading(false); return }
    setRows(data || [])
    const ids = (data || []).map(r => r.id)
    const map = {}
    if (ids.length) {
      const { data: d } = await supabase.from('reception_donation_documents').select('*').in('donation_id', ids).is('deleted_at', null).order('created_at')
      ;(d || []).forEach(x => { (map[x.donation_id] ||= []).push(x) })
    }
    setDocs(map)
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const docsTotal = list => (list || []).reduce((s, d) => s + Number(d.amount_paid || 0), 0)
  const totalOf = r => (docs[r.id]?.length ? docsTotal(docs[r.id]) : Number(r.amount_paid || 0))

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    return t ? rows.filter(r => [r.donor_name, r.phone, r.student_name, r.gcc_no, r.purpose, r.receipt_no, r.txn_ref].some(v => String(v || '').toLowerCase().includes(t))) : rows
  }, [rows, q])
  const grand = useMemo(() => shown.reduce((s, r) => s + totalOf(r), 0), [shown, docs]) // eslint-disable-line react-hooks/exhaustive-deps

  const uploadOne = async (donationId, d) => {
    const ext = d.file.name.split('.').pop().toLowerCase()
    const path = `donations/${donationId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error: upErr } = await supabase.storage.from('donation-docs').upload(path, d.file, { contentType: d.file.type })
    if (upErr) throw new Error('Upload failed: ' + upErr.message)
    const { error } = await supabase.from('reception_donation_documents').insert({
      donation_id: donationId, doc_type: d.doc_type, file_name: d.file.name, storage_path: path,
      amount_paid: Number(d.amount_paid) || 0, note: d.note || null, uploaded_by: who,
    })
    if (error) { await supabase.storage.from('donation-docs').remove([path]); throw new Error('Save failed: ' + error.message) }
  }

  const validateDoc = d => {
    if (!d.file) return 'Choose a file for each document row (or remove the row).'
    const fe = fileError(d.file); if (fe) return fe
    if (!(Number(d.amount_paid) > 0)) return `Enter the amount paid shown on "${d.file.name}".`
    return null
  }

  const save = async () => {
    setMsg(null)
    if (!who) return setMsg({ ok: false, text: 'Collected By comes from your login — sign out and in again.' })
    if (!form.donor_name.trim()) return setMsg({ ok: false, text: 'Donor name is required.' })
    if (form.pay_mode !== 'Cash' && !form.txn_ref.trim()) return setMsg({ ok: false, text: `Transaction / cheque reference is required for ${form.pay_mode}.` })
    const picked = newDocs.filter(d => d.file || d.amount_paid)
    for (const d of picked) { const e = validateDoc(d); if (e) return setMsg({ ok: false, text: e }) }
    const total = picked.length ? picked.reduce((s, d) => s + Number(d.amount_paid), 0) : Number(form.amount_paid) || 0
    if (!(total > 0)) return setMsg({ ok: false, text: 'Enter the amount paid (on the donation, or on each uploaded document).' })

    setSaving(true)
    try {
      const { data, error } = await supabase.from('reception_donations').insert({
        donor_name: form.donor_name.trim(), phone: form.phone.trim() || null, student_name: form.student_name.trim() || null,
        gcc_no: form.gcc_no.trim() || null, purpose: form.purpose, donation_date: form.donation_date, pay_mode: form.pay_mode,
        txn_ref: form.txn_ref.trim() || null, amount_paid: total, receipt_no: form.receipt_no.trim() || null,
        remarks: form.remarks.trim() || null, collected_by: who,
      }).select('id').single()
      if (error) throw new Error(error.message)
      const failed = []
      for (const d of picked) { try { await uploadOne(data.id, d) } catch (e) { failed.push(e.message) } }
      setMsg(failed.length
        ? { ok: false, text: `Donation saved, but ${failed.length} document(s) failed: ${failed[0]}. Open the record and add them again.` }
        : { ok: true, text: `Donation of ${inr(total)} recorded.` })
      setForm(blankForm()); setNewDocs([blankDoc()]); setOpen(false)
      await load()
    } catch (e) { setMsg({ ok: false, text: 'Save failed: ' + e.message }) }
    setSaving(false)
  }

  const addDocument = async r => {
    setMsg(null)
    const e = validateDoc(extraDoc); if (e) return setMsg({ ok: false, text: e })
    setSaving(true)
    try {
      await uploadOne(r.id, extraDoc)
      const total = docsTotal(docs[r.id]) + Number(extraDoc.amount_paid)
      await supabase.from('reception_donations').update({ amount_paid: total }).eq('id', r.id)
      setAddDocFor(null); setExtraDoc(blankDoc()); setMsg({ ok: true, text: 'Document added.' }); await load()
    } catch (er) { setMsg({ ok: false, text: er.message }) }
    setSaving(false)
  }

  const openDoc = async d => {
    const { data, error } = await supabase.storage.from('donation-docs').createSignedUrl(d.storage_path, 3600)
    if (error) return setMsg({ ok: false, text: 'Could not open: ' + error.message })
    window.open(data.signedUrl, '_blank', 'noreferrer')
  }

  const archive = async r => {
    if (!window.confirm(`Archive the donation from ${r.donor_name} (${inr(totalOf(r))})?`)) return
    const { error } = await supabase.from('reception_donations').update({ deleted_at: new Date().toISOString() }).eq('id', r.id)
    if (error) return setMsg({ ok: false, text: error.message })
    load()
  }

  const setD = (key, patch) => setNewDocs(list => list.map(d => (d.key === key ? { ...d, ...patch } : d)))
  const f = (k, v) => setForm(s => ({ ...s, [k]: v }))
  const docRow = (d, onChange, onRemove) => (
    <div key={d.key} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8, alignItems: 'end', padding: 10, border: `1px dashed ${LINE}`, borderRadius: 10, marginBottom: 8 }}>
      <div><label style={lbl}>Document</label>
        <input type="file" accept={OK_EXT.join(',')} style={{ ...inp, padding: 6 }} onChange={e => onChange({ file: e.target.files[0] || null })} /></div>
      <div><label style={lbl}>Type</label>
        <select style={inp} value={d.doc_type} onChange={e => onChange({ doc_type: e.target.value })}>{DOC_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
      <div><label style={lbl}>Amount paid (₹)</label>
        <input style={inp} type="number" min="0" step="0.01" value={d.amount_paid} onChange={e => onChange({ amount_paid: e.target.value })} placeholder="Amount on this document" /></div>
      <div><label style={lbl}>Note</label>
        <input style={inp} value={d.note} onChange={e => onChange({ note: e.target.value })} placeholder="Optional" /></div>
      {onRemove && <button type="button" style={btn('#f3f0e8', RED)} onClick={onRemove}>Remove</button>}
    </div>
  )

  return (
    <div style={{ fontFamily: font }}>
      {msg && <div style={{ ...card, marginBottom: 12, borderColor: msg.ok ? GREEN : RED, color: msg.ok ? GREEN : RED, fontSize: 13, fontWeight: 600 }}>{msg.text}</div>}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <input style={{ ...inp, flex: 1, minWidth: 200 }} placeholder="Search donor, phone, student, purpose, receipt…" value={q} onChange={e => setQ(e.target.value)} />
        <div style={{ fontSize: 13, color: SUB }}><strong style={{ color: NAVY }}>{shown.length}</strong> records · <strong style={{ color: NAVY }}>{inr(grand)}</strong> received</div>
        <button style={btn(open ? '#8a93a6' : GOLD)} onClick={() => setOpen(o => !o)}>{open ? 'Close form' : '+ New donation'}</button>
      </div>

      {open && (
        <div style={{ ...card, marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
            <div><label style={lbl}>Donor name *</label><input style={inp} value={form.donor_name} onChange={e => f('donor_name', e.target.value)} /></div>
            <div><label style={lbl}>Phone</label><input style={inp} value={form.phone} onChange={e => f('phone', e.target.value)} /></div>
            <div><label style={lbl}>Student (if for one)</label><input style={inp} value={form.student_name} onChange={e => f('student_name', e.target.value)} /></div>
            <div><label style={lbl}>GCC no.</label><input style={inp} value={form.gcc_no} onChange={e => f('gcc_no', e.target.value)} /></div>
            <div><label style={lbl}>Purpose</label><select style={inp} value={form.purpose} onChange={e => f('purpose', e.target.value)}>{PURPOSES.map(p => <option key={p}>{p}</option>)}</select></div>
            <div><label style={lbl}>Date</label><input style={inp} type="date" value={form.donation_date} onChange={e => f('donation_date', e.target.value)} /></div>
            <div><label style={lbl}>Pay mode</label><select style={inp} value={form.pay_mode} onChange={e => f('pay_mode', e.target.value)}>{MODES.map(m => <option key={m}>{m}</option>)}</select></div>
            {form.pay_mode !== 'Cash' && <div><label style={lbl}>Txn / cheque ref *</label><input style={inp} value={form.txn_ref} onChange={e => f('txn_ref', e.target.value)} /></div>}
            <div><label style={lbl}>Receipt no.</label><input style={inp} value={form.receipt_no} onChange={e => f('receipt_no', e.target.value)} /></div>
            <div><label style={lbl}>Collected by</label><input style={{ ...inp, background: '#f4f1e8' }} value={who} readOnly title="Filled from your login" /></div>
          </div>
          <div style={{ marginTop: 10 }}><label style={lbl}>Remarks</label><input style={inp} value={form.remarks} onChange={e => f('remarks', e.target.value)} /></div>

          <div style={{ margin: '16px 0 8px', fontSize: 13, fontWeight: 800, color: NAVY }}>Upload documents &amp; amount paid</div>
          <div style={{ fontSize: 12, color: SUB, marginBottom: 8 }}>PDF or image, up to {MAX_MB} MB each. Enter the amount paid shown on every document — the donation total is their sum.</div>
          {newDocs.map(d => docRow(d, p => setD(d.key, p), newDocs.length > 1 ? () => setNewDocs(l => l.filter(x => x.key !== d.key)) : null))}
          <button type="button" style={btn('#f3f0e8', NAVY)} onClick={() => setNewDocs(l => [...l, blankDoc()])}>+ Add another document</button>

          {!newDocs.some(d => d.file || d.amount_paid) && (
            <div style={{ marginTop: 12, maxWidth: 240 }}><label style={lbl}>Amount paid (₹) — no document</label>
              <input style={inp} type="number" min="0" step="0.01" value={form.amount_paid} onChange={e => f('amount_paid', e.target.value)} /></div>
          )}
          <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
            <button style={btn(NAVY)} disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save donation'}</button>
            <button style={btn('#f3f0e8', SUB)} disabled={saving} onClick={() => { setOpen(false); setForm(blankForm()); setNewDocs([blankDoc()]) }}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? <div style={{ ...card, color: SUB }}>Loading…</div> : shown.length === 0 ? (
        <div style={{ ...card, color: SUB, textAlign: 'center', padding: 32 }}>No donation records yet.</div>
      ) : shown.map(r => {
        const list = docs[r.id] || []
        const isOpen = expanded === r.id
        return (
          <div key={r.id} style={{ ...card, marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', cursor: 'pointer' }} onClick={() => setExpanded(isOpen ? null : r.id)}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontWeight: 800, color: NAVY, fontSize: 14 }}>{r.donor_name}{r.student_name ? <span style={{ color: SUB, fontWeight: 600 }}> · for {r.student_name}</span> : null}</div>
                <div style={{ fontSize: 12, color: SUB }}>{fmtD(r.donation_date)} · {r.purpose || '—'} · {r.pay_mode}{r.txn_ref ? ` (${r.txn_ref})` : ''} · by {r.collected_by}</div>
              </div>
              <div style={{ fontSize: 12, color: SUB }}>{list.length} document{list.length === 1 ? '' : 's'}</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: GREEN }}>{inr(totalOf(r))}</div>
            </div>
            {isOpen && (
              <div style={{ marginTop: 12, borderTop: `1px solid ${LINE}`, paddingTop: 12 }}>
                {r.phone && <div style={{ fontSize: 12, color: SUB, marginBottom: 6 }}>📞 {r.phone}{r.receipt_no ? ` · Receipt ${r.receipt_no}` : ''}{r.remarks ? ` · ${r.remarks}` : ''}</div>}
                {list.length === 0 && <div style={{ fontSize: 12, color: SUB, marginBottom: 8 }}>No documents uploaded.</div>}
                {list.map(d => (
                  <div key={d.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 0', borderBottom: `1px solid ${LINE}`, fontSize: 13 }}>
                    <span style={{ flex: 1 }}>📎 <strong>{d.doc_type}</strong> · {d.file_name}{d.note ? <span style={{ color: SUB }}> — {d.note}</span> : null}</span>
                    <strong>{inr(d.amount_paid)}</strong>
                    <button style={btn('#f3f0e8', NAVY)} onClick={() => openDoc(d)}>View</button>
                  </div>
                ))}
                {addDocFor === r.id ? (
                  <div style={{ marginTop: 10 }}>
                    {docRow(extraDoc, p => setExtraDoc(s => ({ ...s, ...p })), null)}
                    <button style={btn(NAVY)} disabled={saving} onClick={() => addDocument(r)}>{saving ? 'Uploading…' : 'Upload'}</button>{' '}
                    <button style={btn('#f3f0e8', SUB)} onClick={() => { setAddDocFor(null); setExtraDoc(blankDoc()) }}>Cancel</button>
                  </div>
                ) : (
                  <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                    <button style={btn('#f3f0e8', NAVY)} onClick={() => { setAddDocFor(r.id); setExtraDoc(blankDoc()) }}>+ Upload document</button>
                    <button style={btn('#fef2f2', RED)} onClick={() => archive(r)}>Archive</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
