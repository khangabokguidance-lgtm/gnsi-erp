// src/modules/Admissions/index.jsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../../core/auth'
import { supabase } from '../../core/supabase'
import {
  ADM_STATUSES, STAT_COLORS, ADM_DOCS, CLASSES, SESSIONS, CATEGORIES,
  ADM_FEE_DEFAULT, PROSPECTUS_AMT, DRESS_ITEMS_DEFAULT,
  loadAppsLocal, saveAppsLocal, loadColsLocal, saveColsLocal,
  fetchAppsFromSupabase, upsertAppToSupabase, deleteAppFromSupabase,
  fetchColsFromSupabase, upsertColToSupabase,
  nextId, genAdmNo, checkFeePaid, maskPhone, canDeleteAdm, canCollectFee,
} from './admissionsData'
import './admissions.css'

/* ─── Toast utility ─────────────────────────────────────────────────────── */
function showToast(msg, color = '#1433a8', duration = 3500) {
  const c = document.getElementById('adm-toast-container')
  if (!c) return
  const t = document.createElement('div')
  t.className = 'adm-toast'
  t.style.borderLeftColor = color
  t.style.borderLeftWidth = '4px'
  t.innerHTML = `<span>${msg}</span>`
  c.appendChild(t)
  setTimeout(() => t.remove(), duration)
}

/* ─── Receipt printer ───────────────────────────────────────────────────── */
function printAdmReceipt(d) {
  const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const fmt = n => Number(n || 0).toLocaleString('en-IN')
  const itemRows = (d.issuedItems || []).map(i =>
    `<tr><td style="padding:4px 10px 4px 20px;font-size:11px">— ${esc(i.name)}</td>
     <td style="padding:4px 10px;text-align:right;font-size:11px">₹${fmt(i.price * i.qty)}</td></tr>`
  ).join('')
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Admission Receipt</title>
  <style>body{font-family:system-ui,sans-serif;font-size:12px;color:#1a2040;margin:0;padding:20px}
  .r{max-width:560px;margin:auto;border:2px solid #1433a8;border-radius:12px;overflow:hidden}
  .rh{background:linear-gradient(135deg,#1433a8,#2563eb);padding:14px 20px;color:#fff}
  .rh h2{font-size:18px;font-weight:800;margin:0 0 2px}.rh p{margin:0;font-size:11px;opacity:.8}
  .rm{display:flex;justify-content:space-between;padding:9px 20px;background:#f0f4ff;border-bottom:1px solid #dbe4ff;font-size:11px}
  table{width:100%;border-collapse:collapse}td{padding:6px 14px;border-bottom:.5px solid #e2e8f0}
  .tr td{padding:8px 14px;font-size:13px;font-weight:900;color:#15803d;background:#dcfce7;border-top:2px solid #16a34a}
  .foot{padding:10px 20px;font-size:10px;color:#64748b;display:flex;justify-content:space-between;background:#f8faff;border-top:1px solid #e2e8f0}
  @media print{button{display:none}}</style></head><body>
  <div class="r">
    <div class="rh"><h2>📋 Admission Package Receipt</h2><p>GNSI — Authorised Receipt</p></div>
    <div class="rm">
      <span><b>Receipt No:</b> ${esc(d.receiptNo || '--')}</span>
      <span><b>Date:</b> ${esc(d.date)}</span>
      <span><b>Mode:</b> ${esc(d.payMode)}</span>
    </div>
    <table>
      <tr><td><b>Student Name</b></td><td>${esc(d.studentName)}</td></tr>
      <tr><td><b>Adm. No.</b></td><td>${esc(d.admNo || '--')}</td></tr>
      <tr><td><b>Class</b></td><td>${esc(d.className || '--')}</td></tr>
      ${d.txnRef ? `<tr><td><b>Txn Ref</b></td><td>${esc(d.txnRef)}</td></tr>` : ''}
      <tr><td colspan="2" style="padding:4px 14px;font-size:10px;font-weight:800;color:#1433a8;text-transform:uppercase;letter-spacing:.05em">Fee Breakdown</td></tr>
      <tr><td style="padding:7px 14px;font-weight:700">Admission Fee</td><td style="padding:7px 14px;text-align:right;font-weight:700">₹${fmt(d.admFeeAmt)}</td></tr>
      ${itemRows}
      ${d.prospectus ? `<tr><td style="padding:4px 14px;font-size:11px">Prospectus</td><td style="padding:4px 14px;text-align:right;font-size:11px">₹${fmt(PROSPECTUS_AMT)}</td></tr>` : ''}
      ${d.advAmt > 0 ? `<tr><td style="padding:4px 14px;font-size:11px;color:#854d0e">⮕ Advance — ${esc(d.advFor)}</td><td style="padding:4px 14px;text-align:right;color:#854d0e">₹${fmt(d.advAmt)}</td></tr>` : ''}
      <tr class="tr"><td>GRAND TOTAL</td><td style="text-align:right">₹${fmt(d.grandTotal)}</td></tr>
    </table>
    <div class="foot"><span>Collected by: <b>${esc(d.collectedBy || 'Admin')}</b></span><span>GNSI · Authorised Receipt</span></div>
  </div>
  <div style="text-align:center;margin-top:14px">
    <button onclick="window.print()" style="padding:8px 20px;background:#1433a8;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px">🖨️ Print</button>
  </div></body></html>`
  const pw = window.open('', '_blank', 'width=660,height=680,scrollbars=yes')
  if (!pw) { showToast('Popup blocked — allow popups to print receipt', '#dc2626'); return }
  pw.document.write(html); pw.document.close()
  pw.onload = () => { pw.focus(); pw.print() }
}

/* ─── StatusBadge ───────────────────────────────────────────────────────── */
function StatusBadge({ status }) {
  const c = STAT_COLORS[status] || '#94a3b8'
  return (
    <span className="adm-badge" style={{ background: c + '22', color: c, border: `1.5px solid ${c}44` }}>
      {status}
    </span>
  )
}

/* ─── AdmCard ───────────────────────────────────────────────────────────── */
function AdmCard({ app, onView, onEdit, onDelete, onAdmit, onCollectFee, onEnroll, canDel, canFee }) {
  const col = STAT_COLORS[app.status] || '#94a3b8'
  const feePaid = checkFeePaid(app.id, loadColsLocal())
  const hue = app.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360

  let nextBtn = null
  if (app.status === 'Applied' || app.status === 'Under Review') {
    nextBtn = <button className="adm-btn adm-btn-purple adm-btn-sm" onClick={() => onAdmit(app.id)}>Admit</button>
  } else if (app.status === 'Admitted' && !feePaid) {
    nextBtn = canFee
      ? <button className="adm-btn adm-btn-amber adm-btn-sm" onClick={() => onCollectFee(app.id)}>Collect Fee</button>
      : <span style={{ fontSize: 11, color: 'var(--color-muted,#64748b)', fontStyle: 'italic' }}>Fee: Admin only</span>
  } else if (app.status === 'Admitted' && feePaid) {
    nextBtn = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <button className="adm-btn adm-btn-amber adm-btn-sm" onClick={() => onCollectFee(app.id)}>View/Reprint</button>
        <button className="adm-btn adm-btn-green adm-btn-sm" onClick={() => onEnroll(app.id)}>Enroll</button>
      </div>
    )
  } else if (app.status === 'Enrolled') {
    nextBtn = <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 700 }}>✓ Enrolled</span>
  }

  return (
    <div className="adm-card" style={{ borderLeft: `4px solid ${col}` }}>
      <div className="adm-avatar" style={{ background: `hsl(${hue},60%,48%)` }}>
        {app.name?.trim().charAt(0).toUpperCase()}
      </div>
      <div className="adm-card-info">
        <div className="adm-card-name" onClick={() => onView(app.id)}>{app.name}</div>
        <div className="adm-card-meta">
          {app.admNo && <span>{app.admNo}</span>}
          {app.cls && <span>{app.cls}</span>}
          {app.phone && <span>{maskPhone(app.phone)}</span>}
        </div>
      </div>
      <div className="adm-card-badges">
        <StatusBadge status={app.status} />
        {(app.status === 'Admitted' || app.status === 'Enrolled') && (
          feePaid
            ? <span className="adm-badge adm-badge-fee-paid">✓ Fee Paid</span>
            : <span className="adm-badge adm-badge-fee-due">⚠ Fee Due</span>
        )}
        {app.docs?.length > 0 && (
          <span className="adm-badge-docs">{app.docs.length}/{ADM_DOCS.length} docs</span>
        )}
      </div>
      <div className="adm-card-actions">
        {nextBtn}
        <button className="adm-btn adm-btn-ghost adm-btn-sm" onClick={() => onEdit(app.id)}>Edit</button>
        {canDel && (
          <button className="adm-btn adm-btn-red adm-btn-sm" onClick={() => onDelete(app.id)}>Del</button>
        )}
      </div>
    </div>
  )
}

/* ─── AdmForm ───────────────────────────────────────────────────────────── */
function AdmForm({ editId, apps, cols, onSave, onCancel, onAdmit, onCollectFee, onEnroll }) {
  const existing = editId ? apps.find(a => String(a.id) === String(editId)) : null
  const isEdit = !!editId
  const colAccent = isEdit ? '#f59e0b' : '#8b5cf6'
  const [photoTemp, setPhotoTemp] = useState(null)
  const fileRef = useRef()
  const feePaid = isEdit ? checkFeePaid(editId, cols) : false

  const def = (k, fb = '') => existing ? (existing[k] || fb) : fb
  const [form, setForm] = useState({
    name: def('name'), gcc: def('gcc'), admNo: def('admNo'),
    dob: def('dob'), gender: def('gender'), blood: def('blood'),
    cls: def('cls'), session: def('session'), prevSchool: def('prevSchool'),
    status: def('status', 'Applied'), category: def('category'),
    hostel: def('hostel', 'No'), father: def('father'), mother: def('mother'),
    phone: def('phone'), whatsapp: def('whatsapp'), address: def('address'),
    remarks: def('remarks'), docs: existing?.docs || [],
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (form.gcc && !isEdit) set('admNo', 'GCC-2026-' + form.gcc)
  }, [form.gcc])

  const handlePhoto = e => {
    const f = e.target.files[0]; if (!f) return
    if (f.size > 300 * 1024) { showToast('Too large! Max 300KB', '#dc2626'); return }
    if (!f.type.startsWith('image')) { showToast('Images only (JPEG/PNG)', '#dc2626'); return }
    const r = new FileReader()
    r.onload = ev => setPhotoTemp(ev.target.result)
    r.readAsDataURL(f)
  }

  const toggleDoc = d => set('docs', form.docs.includes(d) ? form.docs.filter(x => x !== d) : [...form.docs, d])

  const handleSave = () => {
    if (!form.name.trim()) { showToast('Applicant name is required', '#ea580c'); return }
    let photo = existing?.photo || null
    if (photoTemp && photoTemp !== 'CLEAR') photo = photoTemp
    else if (photoTemp === 'CLEAR') photo = null
    onSave(editId, { ...form, photo })
  }

  const currentPhoto = photoTemp && photoTemp !== 'CLEAR' ? photoTemp : (photoTemp === 'CLEAR' ? null : existing?.photo)

  return (
    <div className="adm-form-panel" style={{ borderColor: colAccent + '80' }}>
      <div className="adm-form-header">
        <div className="adm-form-title" style={{ color: colAccent }}>
          {isEdit ? '✏️ Edit Application' : '➕ New Application'}
        </div>
        <button className="adm-form-close" onClick={onCancel}>✕</button>
      </div>

      <div className="adm-form-grid">
        <div className="adm-form-group span2">
          <label className="adm-form-label">Applicant Name</label>
          <input className="adm-form-input" placeholder="Full name" value={form.name} onChange={e => set('name', e.target.value)} />
        </div>
        <div className="adm-form-group">
          <label className="adm-form-label">Class</label>
          <select className="adm-form-input" value={form.cls} onChange={e => set('cls', e.target.value)}>
            <option value="">-- Class --</option>
            {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="adm-form-group">
          <label className="adm-form-label">Hostel</label>
          <select className="adm-form-input" value={form.hostel} onChange={e => set('hostel', e.target.value)}>
            <option value="No">No (Day Scholar)</option>
            <option value="Yes">Yes (Boarder)</option>
          </select>
        </div>
        <div className="adm-form-group">
          <label className="adm-form-label">Father's Name</label>
          <input className="adm-form-input" placeholder="Father name" value={form.father} onChange={e => set('father', e.target.value)} />
        </div>
        <div className="adm-form-group">
          <label className="adm-form-label">Contact Phone</label>
          <input className="adm-form-input" placeholder="Primary contact" value={form.phone} onChange={e => set('phone', e.target.value)} />
        </div>
        <div className="adm-form-group">
          <label className="adm-form-label">Status</label>
          <select className="adm-form-input" value={form.status} onChange={e => set('status', e.target.value)}>
            {ADM_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="adm-form-group">
          <label className="adm-form-label">GCC No.</label>
          <input className="adm-form-input" placeholder="e.g. 729" value={form.gcc} onChange={e => set('gcc', e.target.value)} />
        </div>
        <div className="adm-form-group span2">
          <label className="adm-form-label">Adm. No.</label>
          <input className="adm-form-input" value={form.admNo} onChange={e => set('admNo', e.target.value)} placeholder={genAdmNo(apps)} />
        </div>
      </div>

      <details className="adm-form-section" open={!!existing?.dob}>
        <summary>More Details — DOB, Mother, Address</summary>
        <div className="adm-form-grid" style={{ marginTop: 10 }}>
          <div className="adm-form-group">
            <label className="adm-form-label">Date of Birth</label>
            <input type="date" className="adm-form-input" value={form.dob} onChange={e => set('dob', e.target.value)} />
          </div>
          <div className="adm-form-group">
            <label className="adm-form-label">Gender</label>
            <select className="adm-form-input" value={form.gender} onChange={e => set('gender', e.target.value)}>
              <option value="">--</option>
              <option>Male</option><option>Female</option><option>Other</option>
            </select>
          </div>
          <div className="adm-form-group">
            <label className="adm-form-label">Mother's Name</label>
            <input className="adm-form-input" value={form.mother} onChange={e => set('mother', e.target.value)} />
          </div>
          <div className="adm-form-group">
            <label className="adm-form-label">WhatsApp</label>
            <input className="adm-form-input" value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} />
          </div>
          <div className="adm-form-group span2">
            <label className="adm-form-label">Address</label>
            <input className="adm-form-input" value={form.address} onChange={e => set('address', e.target.value)} />
          </div>
          <div className="adm-form-group">
            <label className="adm-form-label">Session</label>
            <select className="adm-form-input" value={form.session} onChange={e => set('session', e.target.value)}>
              <option value="">-- Session --</option>
              {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="adm-form-group">
            <label className="adm-form-label">Previous School</label>
            <input className="adm-form-input" value={form.prevSchool} onChange={e => set('prevSchool', e.target.value)} />
          </div>
          <div className="adm-form-group">
            <label className="adm-form-label">Category</label>
            <select className="adm-form-input" value={form.category} onChange={e => set('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="adm-form-group">
            <label className="adm-form-label">Blood Group</label>
            <input className="adm-form-input" placeholder="e.g. O+" value={form.blood} onChange={e => set('blood', e.target.value)} />
          </div>
        </div>
      </details>

      <details className="adm-form-section" open={form.docs.length > 0}>
        <summary>Documents Received — {form.docs.length}/{ADM_DOCS.length}</summary>
        <div className="adm-doc-chips">
          {ADM_DOCS.map(d => (
            <label key={d} className={`adm-doc-chip${form.docs.includes(d) ? ' checked' : ''}`} onClick={() => toggleDoc(d)}>
              {form.docs.includes(d) ? '✓' : ''} {d}
            </label>
          ))}
        </div>
      </details>

      {/* Photo upload */}
      <div style={{ marginBottom: 12 }}>
        <label className="adm-form-label">
          Student Photo <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0, fontSize: 10, color: 'var(--color-muted,#64748b)' }}>Max 300KB JPEG/PNG</span>
        </label>
        <div className="adm-photo-row">
          <div className="adm-photo-preview">
            {currentPhoto ? <img src={currentPhoto} alt="Student" /> : '📷'}
          </div>
          <div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
            <button type="button" className="adm-btn adm-btn-outline adm-btn-sm" style={{ marginBottom: 6 }} onClick={() => fileRef.current.click()}>
              Choose Photo
            </button>
            {currentPhoto && (
              <button type="button" className="adm-btn adm-btn-red adm-btn-sm" style={{ marginLeft: 6 }} onClick={() => setPhotoTemp('CLEAR')}>
                Remove
              </button>
            )}
            <div style={{ fontSize: 11, color: 'var(--color-muted,#64748b)', marginTop: 6 }}>
              {photoTemp && photoTemp !== 'CLEAR' ? '✓ Photo ready — click Save' : 'Photo will appear in profile.'}
            </div>
          </div>
        </div>
      </div>

      <div className="adm-form-group" style={{ marginBottom: 12 }}>
        <label className="adm-form-label">Remarks</label>
        <textarea className="adm-form-input" rows={2} style={{ resize: 'vertical' }} value={form.remarks} onChange={e => set('remarks', e.target.value)} />
      </div>

      <div className="adm-form-actions">
        <button className="adm-btn adm-btn-primary" onClick={handleSave}>{isEdit ? 'Update' : 'Save Applicant'}</button>
        <button className="adm-btn adm-btn-outline" onClick={onCancel}>Cancel</button>
        {isEdit && (form.status === 'Applied' || form.status === 'Under Review') && (
          <button className="adm-btn adm-btn-purple" onClick={() => onAdmit(editId)}>Admit Now</button>
        )}
        {isEdit && form.status === 'Admitted' && !feePaid && (
          <button className="adm-btn adm-btn-amber" onClick={() => onCollectFee(editId)}>Collect Fee</button>
        )}
        {isEdit && form.status === 'Admitted' && feePaid && (
          <>
            <button className="adm-btn adm-btn-amber adm-btn-sm" onClick={() => onCollectFee(editId)}>View Package</button>
            <button className="adm-btn adm-btn-green" onClick={() => onEnroll(editId)}>Enroll</button>
          </>
        )}
      </div>
    </div>
  )
}

/* ─── ProfileModal ──────────────────────────────────────────────────────── */
function ProfileModal({ app, cols, onClose, onEdit, onDelete, onAdmit, onCollectFee, onEnroll, canDel, onChangeStatus }) {
  if (!app) return null
  const feePaid = checkFeePaid(app.id, cols)
  const Field = ({ label, val }) => val ? (
    <div className="adm-profile-field">
      <div className="adm-pf-label">{label}</div>
      <div className="adm-pf-val">{val}</div>
    </div>
  ) : null

  return (
    <div className="adm-modal-overlay" onClick={onClose}>
      <div className="adm-modal-box" style={{ maxWidth: 760 }} onClick={e => e.stopPropagation()}>
        <div className="adm-profile-header">
          <div className="adm-profile-avatar">
            {app.name?.trim().split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
          </div>
          <div>
            <div className="adm-profile-name">{app.name}</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
              {app.admNo && <span style={{ fontSize: 12, color: 'rgba(255,255,255,.85)', background: 'rgba(0,0,0,.2)', padding: '2px 10px', borderRadius: 20 }}>{app.admNo}</span>}
              {app.cls && <span style={{ fontSize: 12, color: 'rgba(255,255,255,.85)', background: 'rgba(0,0,0,.2)', padding: '2px 10px', borderRadius: 20 }}>{app.cls}</span>}
              <StatusBadge status={app.status} />
            </div>
          </div>
        </div>

        <div className="adm-profile-grid">
          <div className="adm-profile-section">
            <div className="adm-profile-section-title" style={{ color: '#1433a8', borderColor: '#dbeafe' }}>Personal</div>
            <Field label="Date of Birth" val={app.dob} />
            <Field label="Gender" val={app.gender} />
            <Field label="Blood Group" val={app.blood} />
            <Field label="Category" val={app.category} />
            <Field label="Previous School" val={app.prevSchool} />
          </div>
          <div className="adm-profile-section">
            <div className="adm-profile-section-title" style={{ color: '#16a34a', borderColor: '#dcfce7' }}>Parent</div>
            <Field label="Father" val={app.father} />
            <Field label="Mother" val={app.mother} />
            <Field label="Phone" val={app.phone} />
            <Field label="WhatsApp" val={app.whatsapp} />
            <Field label="Address" val={app.address} />
          </div>
          <div className="adm-profile-section">
            <div className="adm-profile-section-title" style={{ color: '#8b5cf6', borderColor: '#ede9fe' }}>Documents</div>
            {ADM_DOCS.map(d => (
              <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, fontSize: 12.5, color: app.docs?.includes(d) ? '#16a34a' : 'var(--color-muted,#64748b)' }}>
                <span>{app.docs?.includes(d) ? '✓' : '○'}</span>{d}
              </div>
            ))}
          </div>
        </div>

        {app.remarks && (
          <div style={{ padding: '12px 20px', background: 'var(--color-surface-2,#f8f9fb)', borderTop: '1px solid rgba(0,0,0,.05)', fontSize: 12.5, color: 'var(--color-muted,#64748b)' }}>
            <b>Remarks:</b> {app.remarks}
          </div>
        )}

        {/* Status change strip */}
        <div style={{ padding: '10px 20px', borderTop: '1px solid rgba(0,0,0,.05)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11.5, color: 'var(--color-muted,#64748b)' }}>Change status:</span>
          {ADM_STATUSES.map(s => (
            <button key={s} onClick={() => onChangeStatus(app.id, s)}
              style={{ fontSize: 11, padding: '4px 11px', borderRadius: 6, border: `1px solid ${app.status === s ? STAT_COLORS[s] : 'rgba(0,0,0,.1)'}`, background: app.status === s ? STAT_COLORS[s] + '22' : 'var(--color-surface-2,#f8f9fb)', color: app.status === s ? STAT_COLORS[s] : 'var(--color-muted,#64748b)', cursor: 'pointer', fontWeight: 700 }}>
              {s}
            </button>
          ))}
        </div>

        <div className="adm-profile-actions">
          <button className="adm-btn adm-btn-primary adm-btn-sm" onClick={() => onEdit(app.id)}>Edit</button>
          {(app.status === 'Applied' || app.status === 'Under Review') && (
            <button className="adm-btn adm-btn-purple adm-btn-sm" onClick={() => onAdmit(app.id)}>Admit</button>
          )}
          {app.status === 'Admitted' && (
            <button className="adm-btn adm-btn-amber adm-btn-sm" onClick={() => onCollectFee(app.id)}>
              {feePaid ? 'View Package' : 'Collect Fee'}
            </button>
          )}
          {app.status === 'Admitted' && feePaid && (
            <button className="adm-btn adm-btn-green adm-btn-sm" onClick={() => onEnroll(app.id)}>Enroll</button>
          )}
          {canDel && (
            <button className="adm-btn adm-btn-red adm-btn-sm" style={{ marginLeft: 'auto' }} onClick={() => onDelete(app.id)}>
              Delete Record
            </button>
          )}
          <button className="adm-btn adm-btn-outline adm-btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

/* ─── FeeModal ──────────────────────────────────────────────────────────── */
function FeeModal({ app, cols, onClose, onSaved }) {
  if (!app) return null
  const alreadyPaid = checkFeePaid(app.id, cols)
  const paidCols = cols.filter(c => c.admAppId === String(app.id) && c.feeType === 'admission')
  const paidAmt = paidCols.reduce((s, c) => s + (parseInt(c.amountPaid) || 0), 0)
  const itemCols = cols.filter(c => c.admAppId === String(app.id) && c.feeType === 'item')
  const advCols = cols.filter(c => c.admAppId === String(app.id) && c.feeType === 'advance')
  const advTotal = advCols.reduce((s, c) => s + (parseInt(c.amountPaid) || 0), 0)
  const itemTotal = itemCols.reduce((s, c) => s + (parseInt(c.amountPaid) || 0), 0)
  const fullPkg = paidAmt + itemTotal + advTotal

  const [dressChecked, setDressChecked] = useState(DRESS_ITEMS_DEFAULT.map(() => true))
  const [prospChecked, setProspChecked] = useState(true)
  const [mode, setMode] = useState('Cash')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [txn, setTxn] = useState('')
  const [advAmt, setAdvAmt] = useState(0)
  const [advFor, setAdvFor] = useState('')
  const [saving, setSaving] = useState(false)

  const admFeeAmt = ADM_FEE_DEFAULT
  const dressTotal = DRESS_ITEMS_DEFAULT.reduce((s, i, idx) => s + (dressChecked[idx] ? i.price * i.qty : 0), 0)
  const grandTotal = admFeeAmt + dressTotal + (prospChecked ? PROSPECTUS_AMT : 0)

  const handleSave = async () => {
    setSaving(true)
    const receiptNo = 'ADM' + Date.now().toString(36).toUpperCase()
    const issuedItems = DRESS_ITEMS_DEFAULT.filter((_, i) => dressChecked[i])
    const newCols = [...cols]

    const basePush = async (col) => {
      newCols.push(col)
      await upsertColToSupabase(col)
    }

    await basePush({ id: 'col' + Date.now() + 'a', admAppId: String(app.id), feeType: 'admission', amountPaid: admFeeAmt, payDate: date, payMode: mode, txnRef: txn, description: 'Admission Fee', receiptNo, studentName: app.name, admNo: app.admNo, className: app.cls, collectedBy: 'Admin' })
    for (let i = 0; i < issuedItems.length; i++) {
      const item = issuedItems[i]
      await basePush({ id: 'col' + Date.now() + 'dk' + i, admAppId: String(app.id), feeType: 'item', amountPaid: item.price * item.qty, payDate: date, payMode: mode, txnRef: txn, description: 'Dress Kit — ' + item.name, receiptNo, studentName: app.name })
    }
    if (prospChecked) await basePush({ id: 'col' + Date.now() + 'p', admAppId: String(app.id), feeType: 'item', amountPaid: PROSPECTUS_AMT, payDate: date, payMode: mode, description: 'Prospectus', receiptNo, studentName: app.name })
    if (advAmt > 0) await basePush({ id: 'col' + Date.now() + 'adv', admAppId: String(app.id), feeType: 'advance', amountPaid: advAmt, advanceFor: advFor, payDate: date, payMode: mode, description: 'Advance — ' + advFor, receiptNo, studentName: app.name })

    saveColsLocal(newCols)
    printAdmReceipt({ receiptNo, studentName: app.name, admNo: app.admNo, className: app.cls, date, payMode: mode, txnRef: txn, collectedBy: 'Admin', admFeeAmt, issuedItems, prospectus: prospChecked, grandTotal, advAmt, advFor })
    showToast(`✅ Fee Paid · ₹${grandTotal.toLocaleString('en-IN')} · Receipt ${receiptNo}`, '#16a34a')
    setSaving(false)
    onSaved(newCols)
  }

  return (
    <div className="adm-modal-overlay" onClick={onClose}>
      <div className="adm-modal-box" onClick={e => e.stopPropagation()}>
        <div className="adm-modal-header">
          <div>
            <div className="mh-label">MANDATORY · COMPLETE BEFORE ENROLLMENT</div>
            <div className="mh-title">🎒 Collect Admission Package</div>
            <div className="mh-sub">{app.name}{app.admNo ? ` · ${app.admNo}` : ''}{app.cls ? ` · ${app.cls}` : ''}</div>
          </div>
          <button className="adm-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="adm-modal-body">
          {alreadyPaid ? (
            <>
              <div className="adm-fee-paid-box">
                <div className="adm-fee-paid-header">
                  <span style={{ fontSize: 26 }}>✅</span>
                  <div>
                    <div style={{ fontWeight: 800, color: '#15803d', fontSize: 14 }}>Admission Package Collected</div>
                    <div style={{ fontSize: 11, color: '#166534', marginTop: 1 }}>Receipt No: <b>{paidCols[0]?.receiptNo || '--'}</b></div>
                  </div>
                </div>
                <table className="adm-fee-table">
                  <tbody>
                    <tr><td>Admission Fee</td><td style={{ textAlign: 'right', fontWeight: 700 }}>₹{paidAmt.toLocaleString('en-IN')}</td></tr>
                    {itemCols.map((c, i) => <tr key={i}><td style={{ paddingLeft: 20, fontSize: 11.5 }}>{c.description}</td><td style={{ textAlign: 'right', fontSize: 11.5 }}>{parseInt(c.amountPaid).toLocaleString('en-IN')}</td></tr>)}
                    {advTotal > 0 && <tr><td style={{ color: '#854d0e' }}>⮕ Advance{advCols[0]?.advanceFor ? ` — ${advCols[0].advanceFor}` : ''}</td><td style={{ textAlign: 'right', color: '#854d0e' }}>{advTotal.toLocaleString('en-IN')}</td></tr>}
                    <tr className="adm-fee-total"><td>TOTAL COLLECTED</td><td style={{ textAlign: 'right' }}>₹{fullPkg.toLocaleString('en-IN')}</td></tr>
                  </tbody>
                </table>
              </div>
              <button className="adm-btn adm-btn-primary" style={{ width: '100%', padding: 12, fontSize: 15, fontWeight: 800 }} onClick={() => { onClose(); onSaved(cols, true) }}>
                Proceed to Enroll →
              </button>
            </>
          ) : (
            <>
              <div className="adm-fee-breakdown">
                <div className="adm-fee-breakdown-title">📦 Fee Breakdown <span style={{ fontWeight: 400, fontSize: 10 }}>— uncheck items not issued</span></div>
                <table className="adm-fee-plain">
                  <tbody>
                    <tr style={{ background: 'var(--color-surface-2,#f8f9fb)' }}>
                      <td style={{ fontWeight: 700 }}>Admission Fee</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{admFeeAmt.toLocaleString('en-IN')}</td>
                    </tr>
                    <tr><td colSpan={2} style={{ padding: '4px 10px 2px', fontSize: 11, fontWeight: 800, color: '#1433a8', textTransform: 'uppercase', letterSpacing: '.05em' }}>🎽 Dress Kit</td></tr>
                    {DRESS_ITEMS_DEFAULT.map((item, i) => (
                      <tr key={item.id}>
                        <td><label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12.5 }}>
                          <input type="checkbox" checked={dressChecked[i]} onChange={() => setDressChecked(d => { const n = [...d]; n[i] = !n[i]; return n })} style={{ accentColor: '#1433a8', width: 14, height: 14 }} />
                          {item.name}
                        </label></td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{item.price.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                    <tr>
                      <td><label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12.5 }}>
                        <input type="checkbox" checked={prospChecked} onChange={e => setProspChecked(e.target.checked)} style={{ accentColor: '#1433a8', width: 14, height: 14 }} />
                        Prospectus
                      </label></td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{PROSPECTUS_AMT}</td>
                    </tr>
                    <tr className="adm-fee-grand"><td>Grand Total</td><td style={{ textAlign: 'right' }}>₹{grandTotal.toLocaleString('en-IN')}</td></tr>
                  </tbody>
                </table>
              </div>

              <div className="adm-form-grid">
                <div className="adm-form-group">
                  <label className="adm-form-label">Payment Mode</label>
                  <select className="adm-form-input" value={mode} onChange={e => setMode(e.target.value)}>
                    {['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'DD'].map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div className="adm-form-group">
                  <label className="adm-form-label">Payment Date</label>
                  <input type="date" className="adm-form-input" value={date} onChange={e => setDate(e.target.value)} />
                </div>
                <div className="adm-form-group span2">
                  <label className="adm-form-label">Txn Ref No.</label>
                  <input className="adm-form-input" placeholder="UPI/Cheque ref" value={txn} onChange={e => setTxn(e.target.value)} />
                </div>
              </div>

              <div className="adm-adv-box">
                <div className="adm-adv-title">⮕ Advance Fee <span style={{ fontWeight: 400, fontSize: 10, color: '#92400e' }}>optional</span></div>
                <div className="adm-form-grid">
                  <div className="adm-form-group">
                    <label className="adm-form-label">Amount ₹</label>
                    <input type="number" className="adm-form-input" min={0} placeholder="0 if none" value={advAmt || ''} onChange={e => setAdvAmt(parseInt(e.target.value) || 0)} />
                  </div>
                  <div className="adm-form-group">
                    <label className="adm-form-label">Advance For</label>
                    <input className="adm-form-input" placeholder="e.g. First month Phase I" value={advFor} onChange={e => setAdvFor(e.target.value)} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button className="adm-btn adm-btn-primary" style={{ flex: 1, padding: 12, fontSize: 14, fontWeight: 800 }} onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : '✅ Save & Print Receipt'}
                </button>
                <button className="adm-btn adm-btn-outline" style={{ padding: '12px 18px' }} onClick={onClose}>Cancel</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── MAIN ADMISSIONS PAGE ──────────────────────────────────────────────── */
export default function Admissions() {
  const { user } = useAuth()
  const [apps, setApps] = useState([])
  const [cols, setCols] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('All')
  const [formOpen, setFormOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [viewId, setViewId] = useState(null)
  const [feeAppId, setFeeAppId] = useState(null)

  const canDel = canDeleteAdm(user)
  const canFee = canCollectFee(user)

  // Load data — Supabase first, localStorage fallback
  useEffect(() => {
    async function load() {
      setLoading(true)
      const sbApps = await fetchAppsFromSupabase()
      if (sbApps) { setApps(sbApps); saveAppsLocal(sbApps) }
      else { setApps(loadAppsLocal()) }

      const sbCols = await fetchColsFromSupabase()
      if (sbCols) { setCols(sbCols); saveColsLocal(sbCols) }
      else { setCols(loadColsLocal()) }

      setLoading(false)
    }
    load()
  }, [])

  // KPI counts
  const byStatus = {}
  ADM_STATUSES.forEach(s => byStatus[s] = 0)
  apps.forEach(a => byStatus[a.status] = (byStatus[a.status] || 0) + 1)

  // Filtered list
  const filtered = apps.filter(a => {
    const sm = filterStatus === 'All' || a.status === filterStatus
    const q = search.toLowerCase()
    const tm = !q || [a.name, a.phone, a.admNo, a.cls, a.father].some(f => f?.toLowerCase().includes(q))
    return sm && tm
  }).slice().reverse()

  // Persist helpers
  const persistApps = useCallback(async (list) => {
    setApps(list); saveAppsLocal(list)
  }, [])
  const persistCols = useCallback(async (list) => {
    setCols(list); saveColsLocal(list)
  }, [])

  // Handlers
  const handleSave = async (eid, obj) => {
    const list = [...apps]
    let updated
    if (eid) {
      updated = list.map(a => String(a.id) === String(eid) ? { ...a, ...obj } : a)
      showToast('Application updated', '#f59e0b')
    } else {
      const id = nextId(list)
      if (!obj.admNo) obj.admNo = genAdmNo(list)
      const newApp = { ...obj, id, date: new Date().toISOString().split('T')[0], status: obj.status || 'Applied', docs: obj.docs || [] }
      updated = [...list, newApp]
      showToast('Application saved', '#8b5cf6')
    }
    await persistApps(updated)
    // Supabase sync
    const target = eid ? updated.find(a => String(a.id) === String(eid)) : updated[updated.length - 1]
    if (target) upsertAppToSupabase(target)
    setFormOpen(false); setEditId(null)
  }

  const handleAdmit = async (id) => {
    if (!confirm('Mark this applicant as Admitted?')) return
    const updated = apps.map(a => String(a.id) === String(id) ? { ...a, status: 'Admitted' } : a)
    await persistApps(updated)
    const target = updated.find(a => String(a.id) === String(id))
    if (target) upsertAppToSupabase(target)
    showToast('Marked as Admitted', '#8b5cf6')
    setViewId(null)
  }

  const handleEnroll = async (id) => {
    const a = apps.find(x => String(x.id) === String(id))
    if (!a) return
    if (!checkFeePaid(id, cols)) { setFeeAppId(id); return }
    if (!confirm(`Enroll ${a.name} as a student?`)) return
    const updated = apps.map(x => String(x.id) === String(id) ? { ...x, status: 'Enrolled' } : x)
    await persistApps(updated)
    const target = updated.find(x => String(x.id) === String(id))
    if (target) upsertAppToSupabase(target)
    showToast(`${a.name} enrolled!`, '#16a34a')
    setViewId(null); setEditId(null); setFormOpen(false)
  }

  const handleDelete = async (id) => {
    const a = apps.find(x => String(x.id) === String(id))
    if (!confirm(`Delete admission record for ${a?.name || 'this applicant'}? This cannot be undone.`)) return
    const updated = apps.filter(x => String(x.id) !== String(id))
    await persistApps(updated)
    await deleteAppFromSupabase(id)
    showToast('Admission record deleted', '#dc2626')
    setViewId(null)
  }

  const handleChangeStatus = async (id, status) => {
    const updated = apps.map(a => String(a.id) === String(id) ? { ...a, status } : a)
    await persistApps(updated)
    const target = updated.find(a => String(a.id) === String(id))
    if (target) upsertAppToSupabase(target)
    showToast(`Status → ${status}`, '#8b5cf6')
  }

  const feeSaved = (newCols, proceedEnroll = false) => {
    persistCols(newCols)
    if (proceedEnroll && feeAppId) { setFeeAppId(null); handleEnroll(feeAppId) }
    else setFeeAppId(null)
  }

  const profileApp = viewId ? apps.find(a => String(a.id) === String(viewId)) : null
  const feeApp = feeAppId ? apps.find(a => String(a.id) === String(feeAppId)) : null

  if (loading) return (
    <div className="adm-module">
      <div className="adm-loading">
        <div className="adm-spinner" />
        Loading admissions…
      </div>
    </div>
  )

  return (
    <div className="adm-module" style={{ padding: '0 20px 20px' }}>
      {/* Toast container */}
      <div id="adm-toast-container" className="adm-toast-container" />

      {/* Header */}
      <div className="adm-header">
        <div className="adm-header-left">
          <div className="eyebrow">GNSI Admissions</div>
          <div className="title">📋 Admissions</div>
          <div className="sub">Applied → Admitted → Collect Fee → Enrolled</div>
        </div>
        <button className="adm-btn adm-btn-primary" onClick={() => { setEditId(null); setFormOpen(true) }}>
          + New Application
        </button>
      </div>

      {/* Workflow */}
      <div className="adm-workflow">
        <span className="wf-label">Process:</span>
        {['Applied', 'Under Review', 'Admitted', 'Collect Fee', 'Enrolled'].map((s, i, arr) => (
          <span key={s}>
            <span className="adm-workflow-step" style={{ color: i === 4 ? '#16a34a' : i === 3 ? '#f59e0b' : i === 2 ? '#8b5cf6' : '#3b78c9' }}>{s}</span>
            {i < arr.length - 1 && <span className="adm-workflow-arrow"> → </span>}
          </span>
        ))}
      </div>

      {/* KPI Strip */}
      <div className="adm-kpi-strip">
        <div className="adm-kpi total" onClick={() => setFilterStatus('All')}>
          <div className="adm-kpi-num">{apps.length}</div>
          <div className="adm-kpi-label" style={{ color: 'rgba(255,255,255,.8)' }}>Total</div>
        </div>
        {ADM_STATUSES.map(s => {
          const c = STAT_COLORS[s]; const active = filterStatus === s
          return (
            <div key={s} className={`adm-kpi${active ? ' active' : ''}`}
              style={{ background: c + '18', border: `1.5px solid ${c}${active ? '' : '44'}`, color: c }}
              onClick={() => setFilterStatus(filterStatus === s ? 'All' : s)}>
              <div className="adm-kpi-num" style={{ color: c }}>{byStatus[s] || 0}</div>
              <div className="adm-kpi-label" style={{ color: c }}>{s}</div>
            </div>
          )
        })}
      </div>

      {/* Toolbar */}
      <div className="adm-toolbar">
        <div className="adm-search">
          <span className="adm-search-icon">🔍</span>
          <input placeholder="Search name, phone, class…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="adm-filter-sel" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="All">All Status</option>
          {ADM_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="adm-count">{filtered.length} / {apps.length}</span>
      </div>

      {/* Slide-in form */}
      {formOpen && (
        <AdmForm editId={editId} apps={apps} cols={cols}
          onSave={handleSave} onCancel={() => { setFormOpen(false); setEditId(null) }}
          onAdmit={handleAdmit} onCollectFee={setFeeAppId} onEnroll={handleEnroll}
        />
      )}

      {/* Card list */}
      {filtered.length > 0 ? (
        <div className="adm-card-list">
          {filtered.map(a => (
            <AdmCard key={a.id} app={a} cols={cols}
              onView={id => { setViewId(id); setFormOpen(false) }}
              onEdit={id => { setEditId(id); setFormOpen(true); setViewId(null) }}
              onDelete={handleDelete} onAdmit={handleAdmit}
              onCollectFee={setFeeAppId} onEnroll={handleEnroll}
              canDel={canDel} canFee={canFee}
            />
          ))}
        </div>
      ) : (
        <div className="adm-empty">
          <div className="adm-empty-icon">📭</div>
          <h3>{apps.length === 0 ? 'No applications yet' : 'No results found'}</h3>
          <p>{apps.length === 0 ? 'Click "+ New Application" to add your first applicant.' : 'Try adjusting your search or filter.'}</p>
          {apps.length === 0 && (
            <button className="adm-btn adm-btn-primary" style={{ marginTop: 16 }} onClick={() => setFormOpen(true)}>
              + New Application
            </button>
          )}
        </div>
      )}

      {/* Profile Modal */}
      {profileApp && (
        <ProfileModal app={profileApp} cols={cols}
          onClose={() => setViewId(null)}
          onEdit={id => { setEditId(id); setFormOpen(true); setViewId(null) }}
          onDelete={handleDelete} onAdmit={handleAdmit}
          onCollectFee={setFeeAppId} onEnroll={handleEnroll}
          canDel={canDel} onChangeStatus={handleChangeStatus}
        />
      )}

      {/* Fee Modal */}
      {feeApp && (
        <FeeModal app={feeApp} cols={cols} onClose={() => setFeeAppId(null)} onSaved={feeSaved} />
      )}
    </div>
  )
}
