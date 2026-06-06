// StudyLockers.jsx — GNSI Portal
// Teacher-owned study material lockers with password protection
// + Practice paper generator (PDF + DOCX)
// Supabase tables: study_lockers, study_materials (locker_id column), qbank_questions

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from './supabase'

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const COURSES = ['sainik', 'navodaya', 'foundation']
const COURSE_LABELS = { sainik: 'Sainik School', navodaya: 'Navodaya', foundation: 'Foundation' }
const COURSE_COLORS = { sainik: '#16a34a', navodaya: '#2563eb', foundation: '#d97706' }
const COURSE_BG     = { sainik: '#dcfce7', navodaya: '#dbeafe', foundation: '#fef9c3' }
const COURSE_TEXT   = { sainik: '#15803d', navodaya: '#1d4ed8', foundation: '#b45309' }

const SUBJECTS = {
  sainik: ['Mathematics','Intelligence','English Language','General Knowledge','Social Studies'],
  navodaya: ['Mental Ability','Arithmetic','English Language','Hindi Language'],
  foundation: ['Mathematics','Science','English','Social Science','Hindi'],
}

const MATERIAL_TYPES = [
  { key: 'notes',          label: 'Notes PDF',      icon: '📄', color: '#1d4ed8', bg: '#dbeafe' },
  { key: 'formula',        label: 'Formula Sheet',  icon: '🔣', color: '#7c3aed', bg: '#ede9fe' },
  { key: 'practice',       label: 'Practice Set',   icon: '✏️', color: '#15803d', bg: '#dcfce7' },
  { key: 'solved',         label: 'Solved Paper',   icon: '✅', color: '#0f766e', bg: '#ccfbf1' },
  { key: 'mindmap',        label: 'Mind Map',       icon: '🗂️', color: '#b45309', bg: '#fef9c3' },
  { key: 'video',          label: 'Video Link',     icon: '🎥', color: '#dc2626', bg: '#fee2e2' },
  { key: 'currentaffairs', label: 'Current Affairs',icon: '📰', color: '#64748b', bg: '#f1f5f9' },
]

const LOCKER_ICONS = ['🔒','📚','📐','🧠','📖','🌍','🗺️','🔬','📊','✍️','🎯','💡','🏆','📋','🗃️']
const LOCKER_COLORS = ['#1e3a5f','#16a34a','#dc2626','#d97706','#7c3aed','#0891b2','#db2777','#ea580c']
const AUTO_LOCK_MS  = 30 * 60 * 1000 // 30 minutes

// ── COLORS & STYLES ───────────────────────────────────────────────────────────
const C = {
  navy: '#1e3a5f', slate: '#64748b', border: '#e2e8f0',
  white: '#ffffff', bg: '#f8fafc', green: '#16a34a',
  rose: '#dc2626', amber: '#d97706', indigo: '#4f46e5',
}
const iS  = { width: '100%', padding: '8px 11px', borderRadius: 7, border: `1px solid ${C.border}`, fontSize: 13, background: C.white, boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }
const lS  = { display: 'block', fontSize: 11, fontWeight: 700, color: C.slate, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }
const cardS = { background: C.white, borderRadius: 12, boxShadow: '0 1px 6px rgba(0,0,0,.07)', padding: '18px 20px', marginBottom: 14 }
const btn   = (bg, dis = false) => ({ padding: '8px 16px', borderRadius: 8, background: dis ? '#94a3b8' : bg, color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: dis ? 'not-allowed' : 'pointer', opacity: dis ? .7 : 1 })
const btnSm = (bg, color = '#fff') => ({ padding: '4px 10px', borderRadius: 6, background: bg, color, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer' })

// ── HELPERS ───────────────────────────────────────────────────────────────────
function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 768)
    window.addEventListener('resize', h); return () => window.removeEventListener('resize', h)
  }, [])
  return mobile
}

function Toast({ msg, color }) {
  return (
    <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 99999, background: '#fff', border: `1px solid ${C.border}`, borderLeft: `3px solid ${color}`, borderRadius: 10, padding: '11px 18px', fontSize: 13, fontWeight: 600, boxShadow: '0 8px 32px rgba(0,0,0,.12)', maxWidth: 340 }}>
      {msg}
    </div>
  )
}

function Badge({ text, color, bg }) {
  return <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700, color, background: bg, whiteSpace: 'nowrap' }}>{text}</span>
}

// SHA-256 hash using Web Crypto API
async function sha256(text) {
  const buf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('')
}

// Format date
const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
const today   = () => new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })

// ── ADMIN PANEL — CREATE / MANAGE LOCKERS ─────────────────────────────────────
function AdminLockerPanel({ lockers, onRefetch, showToast, currentUser }) {
  const [form,   setForm]   = useState({ teacher_name: '', subject: '', course: 'sainik', password: '', icon: '🔒', color: '#1e3a5f' })
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState(null)
  const [newPwd, setNewPwd] = useState('')
  const [resetting, setResetting] = useState(false)

  const isAdmin = (currentUser?.role || '').toLowerCase() === 'admin'
  if (!isAdmin) return (
    <div style={{ ...cardS, textAlign: 'center', padding: 40, color: C.slate }}>
      🔐 Admin access required to manage lockers.
    </div>
  )

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleCreate = async () => {
    if (!form.teacher_name.trim() || !form.subject.trim() || !form.password.trim()) {
      showToast('Fill all required fields', C.amber); return
    }
    setSaving(true)
    const hash = await sha256(form.password.trim())
    const { error } = await supabase.from('study_lockers').insert({
      teacher_name: form.teacher_name.trim(),
      subject:      form.subject.trim(),
      course:       form.course,
      password_hash: hash,
      icon:         form.icon,
      color:        form.color,
    })
    if (error) { showToast('Failed: ' + error.message, C.rose); setSaving(false); return }
    showToast(`✅ Locker created for ${form.teacher_name}!`, C.green)
    setForm({ teacher_name: '', subject: '', course: 'sainik', password: '', icon: '🔒', color: '#1e3a5f' })
    setSaving(false); onRefetch()
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete ${name}'s locker? Materials inside will be unlinked.`)) return
    const { error } = await supabase.from('study_lockers').delete().eq('id', id)
    if (error) { showToast('Delete failed', C.rose); return }
    showToast('Locker deleted', C.rose); onRefetch()
  }

  const handleResetPassword = async (id) => {
    if (!newPwd.trim()) { showToast('Enter new password', C.amber); return }
    setResetting(true)
    const hash = await sha256(newPwd.trim())
    const { error } = await supabase.from('study_lockers').update({ password_hash: hash }).eq('id', id)
    if (error) { showToast('Reset failed', C.rose); setResetting(false); return }
    showToast('✅ Password reset!', C.green); setEditId(null); setNewPwd(''); setResetting(false)
  }

  return (
    <div>
      {/* Create locker form */}
      <div style={{ ...cardS, borderTop: `3px solid ${C.navy}` }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.navy, marginBottom: 16 }}>🔐 Create New Locker</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={lS}>Teacher Name *</label>
            <input style={iS} value={form.teacher_name} onChange={e => set('teacher_name', e.target.value)} placeholder="e.g. Sir Lenin" />
          </div>
          <div>
            <label style={lS}>Course *</label>
            <select style={iS} value={form.course} onChange={e => set('course', e.target.value)}>
              {COURSES.map(c => <option key={c} value={c}>{COURSE_LABELS[c]}</option>)}
            </select>
          </div>
          <div>
            <label style={lS}>Subject *</label>
            <select style={iS} value={form.subject} onChange={e => set('subject', e.target.value)}>
              <option value="">Select subject</option>
              {(SUBJECTS[form.course] || []).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={lS}>Locker Password *</label>
            <input style={iS} type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Admin sets this, share with teacher" />
          </div>
        </div>

        {/* Icon picker */}
        <div style={{ marginBottom: 12 }}>
          <label style={lS}>Icon</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            {LOCKER_ICONS.map(ic => (
              <button key={ic} onClick={() => set('icon', ic)}
                style={{ width: 36, height: 36, borderRadius: 8, fontSize: 18, border: `2px solid ${form.icon === ic ? C.navy : C.border}`, background: form.icon === ic ? '#eff6ff' : C.white, cursor: 'pointer' }}>
                {ic}
              </button>
            ))}
          </div>
        </div>

        {/* Color picker */}
        <div style={{ marginBottom: 16 }}>
          <label style={lS}>Locker colour</label>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            {LOCKER_COLORS.map(cl => (
              <button key={cl} onClick={() => set('color', cl)}
                style={{ width: 28, height: 28, borderRadius: '50%', background: cl, border: `3px solid ${form.color === cl ? '#000' : 'transparent'}`, cursor: 'pointer' }} />
            ))}
          </div>
        </div>

        <button onClick={handleCreate} disabled={saving} style={btn(C.navy, saving)}>
          {saving ? '⏳ Creating…' : '✅ Create Locker'}
        </button>
      </div>

      {/* Existing lockers */}
      <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 10 }}>
        {lockers.length} Lockers
      </div>
      {lockers.map(l => (
        <div key={l.id} style={{ ...cardS, padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: l.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{l.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>{l.teacher_name}</div>
            <div style={{ fontSize: 12, color: C.slate }}>
              {COURSE_LABELS[l.course]} · {l.subject}
              <span style={{ marginLeft: 8, color: '#94a3b8' }}>Created {fmtDate(l.created_at)}</span>
            </div>
            {editId === l.id && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                <input type="password" style={{ ...iS, width: 200, fontSize: 12, padding: '5px 8px' }}
                  value={newPwd} onChange={e => setNewPwd(e.target.value)}
                  placeholder="New password…" />
                <button onClick={() => handleResetPassword(l.id)} disabled={resetting} style={btn(C.green, resetting)}>
                  {resetting ? '…' : '✅ Reset'}
                </button>
                <button onClick={() => { setEditId(null); setNewPwd('') }} style={btn(C.slate)}>Cancel</button>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setEditId(editId === l.id ? null : l.id)} style={btnSm('#eff6ff', C.navy)}>🔑 Reset PW</button>
            <button onClick={() => handleDelete(l.id, l.teacher_name)} style={btnSm('#fee2e2', C.rose)}>🗑</button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── UNLOCK MODAL ──────────────────────────────────────────────────────────────
function UnlockModal({ locker, onUnlocked, onClose }) {
  const [pwd,  setPwd]  = useState('')
  const [err,  setErr]  = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef()
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80) }, [])

  const handleUnlock = async () => {
    if (!pwd.trim()) return
    setBusy(true)
    const hash = await sha256(pwd.trim())
    if (hash === locker.password_hash) {
      onUnlocked(); onClose()
    } else {
      setErr('Incorrect password. Try again.'); setBusy(false); setPwd('')
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: C.white, borderRadius: 16, padding: '32px 28px', width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 48 }}>{locker.icon}</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.navy, marginTop: 8 }}>{locker.teacher_name}'s Locker</div>
          <div style={{ fontSize: 13, color: C.slate, marginTop: 4 }}>{COURSE_LABELS[locker.course]} · {locker.subject}</div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={lS}>Enter Locker Password</label>
          <input ref={inputRef} type="password" style={{ ...iS, textAlign: 'center', fontSize: 18, letterSpacing: 6 }}
            value={pwd} onChange={e => { setPwd(e.target.value); setErr('') }}
            onKeyDown={e => e.key === 'Enter' && handleUnlock()}
            placeholder="••••••••" />
          {err && <div style={{ fontSize: 12, color: C.rose, marginTop: 6, textAlign: 'center' }}>{err}</div>}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleUnlock} disabled={busy || !pwd.trim()} style={{ ...btn(locker.color || C.navy, busy || !pwd.trim()), flex: 1 }}>
            {busy ? '⏳' : '🔓 Unlock'}
          </button>
          <button onClick={onClose} style={btn(C.slate)}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── BULK PASTE MODAL (inside locker) ─────────────────────────────────────────
function BulkPasteModal({ locker, onClose, onSaved, showToast }) {
  const [step,    setStep]    = useState('paste')
  const [rawText, setRawText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [items,   setItems]   = useState([])
  const [checked, setChecked] = useState([])
  const [saving,  setSaving]  = useState(false)

  const handleParse = async () => {
    if (!rawText.trim()) { showToast('Paste something first', C.amber); return }
    setParsing(true)
    const systemPrompt = `You are a study-material parser for a coaching institute.
Extract every distinct study material item from the user's pasted text.
For each item output a JSON object:
  title, material_type (notes|formula|practice|solved|mindmap|video|currentaffairs),
  chapter (infer from text or empty string),
  file_url (url or ""), description (or "")
Rules: YouTube→video, no invented URLs.
Return ONLY a valid JSON array, no fences.`
    try {
      const res    = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, system: systemPrompt, messages: [{ role: 'user', content: rawText.trim() }] }),
      })
      const data   = await res.json()
      const text   = (data.content || []).map(b => b.text || '').join('')
      const parsed = JSON.parse(text.replace(/```json|```/gi, '').trim())
      if (!Array.isArray(parsed) || !parsed.length) { showToast('No items detected', C.amber); setParsing(false); return }
      setItems(parsed); setChecked(parsed.map((_, i) => i)); setStep('preview')
    } catch (err) { showToast('Parse error: ' + err.message, C.rose) }
    setParsing(false)
  }

  const handleSave = async () => {
    const toSave = items.filter((_, i) => checked.includes(i))
    if (!toSave.length) { showToast('Select at least one item', C.amber); return }
    setSaving(true)
    const rows = toSave.map(it => ({
      course:        locker.course,
      subject:       locker.subject,
      chapter:       it.chapter || '',
      title:         it.title,
      material_type: it.material_type || 'notes',
      description:   it.description || '',
      file_url:      it.file_url || '',
      file_name:     '',
      file_size:     0,
      locker_id:     locker.id,
    }))
    const { error } = await supabase.from('study_materials').insert(rows)
    if (error) { showToast('Save failed: ' + error.message, C.rose); setSaving(false); return }
    showToast(`✅ ${rows.length} material${rows.length > 1 ? 's' : ''} saved!`, C.green)
    setSaving(false); onSaved(); onClose()
  }

  const toggle = i => setChecked(p => p.includes(i) ? p.filter(x => x !== i) : [...p, i])
  const typeColor = { notes:{color:'#1d4ed8',bg:'#dbeafe'}, formula:{color:'#7c3aed',bg:'#ede9fe'}, practice:{color:'#15803d',bg:'#dcfce7'}, solved:{color:'#0f766e',bg:'#ccfbf1'}, mindmap:{color:'#b45309',bg:'#fef9c3'}, video:{color:'#dc2626',bg:'#fee2e2'}, currentaffairs:{color:'#64748b',bg:'#f1f5f9'} }
  const typeLabel = { notes:'Notes PDF', formula:'Formula Sheet', practice:'Practice Set', solved:'Solved Paper', mindmap:'Mind Map', video:'Video Link', currentaffairs:'Current Affairs' }
  const typeIcon  = { notes:'📄', formula:'🔣', practice:'✏️', solved:'✅', mindmap:'🗂️', video:'🎥', currentaffairs:'📰' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: C.white, borderRadius: '14px 14px 0 0', width: '100%', maxWidth: 600, boxShadow: '0 -8px 40px rgba(0,0,0,.18)', maxHeight: '92vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: C.border, margin: '14px auto 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.navy }}>📋 Bulk Paste — {locker.teacher_name}'s Locker</div>
          <button onClick={onClose} style={btnSm('#f1f5f9', C.slate)}>✕</button>
        </div>
        <div style={{ padding: '16px 20px', flex: 1, overflowY: 'auto' }}>
          {step === 'paste' && (
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ fontSize: 12, color: C.slate, background: '#f8fafc', padding: '10px 13px', borderRadius: 8, border: `1px solid ${C.border}`, lineHeight: 1.7 }}>
                Paste Drive links, YouTube links, titles, or any mix. AI detects each item and saves to this locker.
              </div>
              <div>
                <label style={lS}>Paste content *</label>
                <textarea style={{ ...iS, resize: 'vertical', minHeight: 160, fontSize: 13, lineHeight: 1.7 }}
                  placeholder="Fractions Notes https://drive.google.com/...\nMirror Image tricks https://youtu.be/..."
                  value={rawText} onChange={e => setRawText(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={handleParse} disabled={parsing || !rawText.trim()}
                  style={{ ...btn(locker.color || C.navy, parsing || !rawText.trim()), flex: 1 }}>
                  {parsing ? '⏳ Detecting…' : '🔍 Detect Items with AI'}
                </button>
                <button onClick={onClose} style={btn(C.slate)}>Cancel</button>
              </div>
            </div>
          )}
          {step === 'preview' && (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: C.slate }}>{items.length} items detected</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.green }}>{checked.length} selected</span>
              </div>
              {items.map((it, i) => {
                const isChecked = checked.includes(i)
                const tc = typeColor[it.material_type] || typeColor.notes
                const isVideo = it.material_type === 'video' || it.file_url?.includes('youtube') || it.file_url?.includes('youtu.be')
                return (
                  <div key={i} onClick={() => toggle(i)} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', padding: '11px 13px', borderRadius: 10, border: `1px solid ${isChecked ? C.border : C.border}`, background: isChecked ? '#f8fafc' : C.white, cursor: 'pointer', opacity: isChecked ? 1 : 0.5 }}>
                    <input type="checkbox" checked={isChecked} onChange={() => toggle(i)} onClick={e => e.stopPropagation()} style={{ marginTop: 3, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>{typeIcon[it.material_type] || '📄'} {it.title}</div>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, color: tc.color, background: tc.bg }}>{typeLabel[it.material_type] || it.material_type}</span>
                        {it.chapter && <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, color: C.slate, background: '#f1f5f9' }}>{it.chapter}</span>}
                      </div>
                      {it.file_url
                        ? <a href={it.file_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 11, color: isVideo ? C.rose : C.indigo, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{isVideo ? '▶ ' : '🔗 '}{it.file_url}</a>
                        : <span style={{ fontSize: 11, color: '#94a3b8' }}>No URL</span>
                      }
                    </div>
                  </div>
                )
              })}
              <button onClick={() => { setStep('paste'); setItems([]); setChecked([]) }} style={{ ...btnSm('#f1f5f9', C.slate), alignSelf: 'flex-start', marginTop: 4 }}>← Edit paste</button>
            </div>
          )}
        </div>
        {step === 'preview' && (
          <div style={{ padding: '12px 20px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10 }}>
            <button onClick={handleSave} disabled={saving || !checked.length} style={{ ...btn(C.green, saving || !checked.length), flex: 1 }}>
              {saving ? '⏳ Saving…' : `✅ Save ${checked.length} material${checked.length !== 1 ? 's' : ''} to Locker`}
            </button>
            <button onClick={onClose} style={btn(C.slate)}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── PRACTICE PAPER GENERATOR ──────────────────────────────────────────────────
function PaperGenerator({ locker, lockerMaterials, onClose, showToast }) {
  const [title,       setTitle]       = useState(`${locker.subject} — Practice Paper`)
  const [paperType,   setPaperType]   = useState('mcq')  // 'mcq' | 'mixed'
  const [source,      setSource]      = useState('qbank') // 'qbank' | 'manual'
  const [qbankQs,     setQbankQs]     = useState([])
  const [selectedQs,  setSelectedQs]  = useState(new Set())
  const [manualQs,    setManualQs]    = useState([{ q: '', a: '', b: '', c: '', d: '', ans: '', marks: 1 }])
  const [loadingQs,   setLoadingQs]   = useState(false)
  const [generating,  setGenerating]  = useState(false)
  const [instructions, setInstructions] = useState('All questions are compulsory. Each question carries equal marks.')

  // Load QBank questions for this subject
  useEffect(() => {
    const load = async () => {
      setLoadingQs(true)
      const { data } = await supabase.from('qbank_questions')
        .select('*').eq('subject', locker.subject).order('chapter')
      setQbankQs(data || [])
      setLoadingQs(false)
    }
    load()
  }, [locker.subject])

  const toggleQ = id => setSelectedQs(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => {
    if (selectedQs.size === qbankQs.length) setSelectedQs(new Set())
    else setSelectedQs(new Set(qbankQs.map(q => q.id)))
  }

  const addManualRow = () => setManualQs(p => [...p, { q: '', a: '', b: '', c: '', d: '', ans: '', marks: 1 }])
  const updateManual = (i, k, v) => setManualQs(p => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r))
  const removeManual = i => setManualQs(p => p.filter((_, idx) => idx !== i))

  // Build final question list
  const finalQs = useMemo(() => {
    if (source === 'qbank') return qbankQs.filter(q => selectedQs.has(q.id))
    return manualQs.filter(r => r.q.trim())
  }, [source, qbankQs, selectedQs, manualQs])

  const totalMarks = finalQs.reduce((a, q) => a + (q.marks || 1), 0)

  // ── PDF GENERATOR ──────────────────────────────────────────────────────────
  const generatePDF = async (withAnswers = false) => {
    if (!finalQs.length) { showToast('No questions selected', C.amber); return }
    setGenerating(true)
    try {
      if (!window.jspdf) {
        await new Promise((res, rej) => {
          const s = document.createElement('script')
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
          s.onload = res; s.onerror = rej; document.head.appendChild(s)
        })
      }
      const { jsPDF } = window.jspdf
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const W = 210, M = 15
      let y = M

      const checkPage = (need = 10) => { if (y + need > 285) { doc.addPage(); y = M } }

      // ── HEADER ──
      doc.setFillColor(30, 58, 95)
      doc.rect(0, 0, W, 32, 'F')
      doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255)
      doc.text('Guidance Navodaya & Sainik Institute', M, 13)
      doc.setFontSize(9); doc.setFont('helvetica', 'normal')
      doc.text('Khangabok, Thoubal, Manipur · Tel: 9856XXXXXX', M, 20)
      doc.text(`Date: ${today()}`, W - M - 40, 20)
      y = 38

      // ── TITLE BLOCK ──
      doc.setDrawColor(30, 58, 95); doc.setLineWidth(0.5)
      doc.line(M, y, W - M, y); y += 6
      doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 58, 95)
      doc.text(title, M, y); y += 6
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139)
      doc.text(`Teacher: ${locker.teacher_name}  |  Subject: ${locker.subject}  |  Course: ${COURSE_LABELS[locker.course]}  |  Total Marks: ${totalMarks}  |  Questions: ${finalQs.length}`, M, y)
      y += 5; doc.line(M, y, W - M, y); y += 6

      // ── INSTRUCTIONS ──
      if (instructions.trim()) {
        doc.setFontSize(9); doc.setFont('helvetica', 'italic'); doc.setTextColor(71, 85, 105)
        const instrLines = doc.splitTextToSize(`Instructions: ${instructions}`, W - M * 2)
        doc.text(instrLines, M, y); y += instrLines.length * 4.5 + 4
        doc.line(M, y, W - M, y); y += 6
      }

      // ── QUESTIONS ──
      finalQs.forEach((q, i) => {
        const qText = source === 'qbank' ? q.question : q.q
        const opts  = source === 'qbank'
          ? [['A', q.option_a], ['B', q.option_b], ['C', q.option_c], ['D', q.option_d]]
          : [['A', q.a], ['B', q.b], ['C', q.c], ['D', q.d]]
        const correct = source === 'qbank' ? q.correct_option : q.ans

        checkPage(30)
        const qLines = doc.splitTextToSize(`Q${i + 1}. ${qText}`, W - M * 2 - 10)
        checkPage(qLines.length * 5 + 24)
        doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 58, 95)
        doc.text(qLines, M, y)
        // marks
        doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(148, 163, 184)
        doc.text(`[${q.marks || 1}M]`, W - M - 8, y)
        y += qLines.length * 5.5 + 2

        opts.filter(([, v]) => v).forEach(([l, val]) => {
          checkPage(7)
          const isCorrect = withAnswers && correct === l
          if (isCorrect) {
            doc.setFillColor(220, 252, 231)
            doc.roundedRect(M + 3, y - 4, W - M * 2 - 6, 6.5, 1, 1, 'F')
          }
          doc.setFontSize(10); doc.setFont('helvetica', isCorrect ? 'bold' : 'normal')
          doc.setTextColor(isCorrect ? 21 : 55, isCorrect ? 128 : 65, isCorrect ? 61 : 81)
          const optLines = doc.splitTextToSize(`  ${l}. ${val}${isCorrect ? '  ✓' : ''}`, W - M * 2 - 14)
          doc.text(optLines, M + 5, y); y += optLines.length * 5 + 1
        })
        y += 4; doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.2)
        doc.line(M, y, W - M, y); y += 5
      })

      // ── ANSWER KEY PAGE (if not with answers) ──
      if (!withAnswers) {
        doc.addPage(); y = M
        doc.setFillColor(30, 58, 95); doc.rect(0, 0, W, 20, 'F')
        doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255)
        doc.text('ANSWER KEY', M, 13); y = 28
        const colW = (W - M * 2) / 5
        finalQs.forEach((q, i) => {
          const correct = source === 'qbank' ? q.correct_option : q.ans
          const col = i % 5; if (col === 0 && i > 0) y += 9
          checkPage(10)
          doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 58, 95)
          doc.text(`Q${i + 1}: ${correct || '?'}`, M + col * colW, y)
        })
      }

      // ── PAGE NUMBERS ──
      const pages = doc.getNumberOfPages()
      for (let p = 1; p <= pages; p++) {
        doc.setPage(p); doc.setFontSize(8); doc.setTextColor(148, 163, 184)
        doc.text(`Page ${p} of ${pages}  |  ${locker.teacher_name} — ${locker.subject}  |  GNSI Confidential`, M, 292)
      }

      const fname = `${title.replace(/\s+/g, '_')}_${withAnswers ? 'WITH_ANSWERS' : 'QUESTION_PAPER'}.pdf`
      doc.save(fname)
      showToast('📄 PDF downloaded!', C.green)
    } catch (e) { showToast('PDF error: ' + e.message, C.rose) }
    setGenerating(false)
  }

  // ── DOCX GENERATOR ─────────────────────────────────────────────────────────
  const generateDOCX = async (withAnswers = false) => {
    if (!finalQs.length) { showToast('No questions selected', C.amber); return }
    setGenerating(true)
    try {
      // Build RTF-based .doc (opens in Word/LibreOffice) without external libs
      // Using HTML Blob with Word-compatible markup
      const rows = finalQs.map((q, i) => {
        const qText  = source === 'qbank' ? q.question : q.q
        const opts   = source === 'qbank'
          ? [['A', q.option_a], ['B', q.option_b], ['C', q.option_c], ['D', q.option_d]]
          : [['A', q.a], ['B', q.b], ['C', q.c], ['D', q.d]]
        const correct = source === 'qbank' ? q.correct_option : q.ans
        const optHtml = opts.filter(([, v]) => v).map(([l, val]) => {
          const isRight = withAnswers && correct === l
          return `<p style="margin:2pt 0 2pt 24pt;font-size:10pt;${isRight ? 'color:#15803d;font-weight:bold;' : ''}">${l}. ${val}${isRight ? ' ✓' : ''}</p>`
        }).join('')
        return `<p style="margin:6pt 0 2pt 0;font-size:11pt;font-weight:bold;color:#1e3a5f;">Q${i + 1}. ${qText} <span style="float:right;font-size:9pt;color:#94a3b8;font-weight:normal;">[${q.marks || 1}M]</span></p>${optHtml}<hr style="border:none;border-top:1px solid #e2e8f0;margin:6pt 0;"/>`
      }).join('')

      const answerKeyHtml = !withAnswers ? `
        <div style="page-break-before:always;">
          <h2 style="color:#1e3a5f;">Answer Key</h2>
          <table><tr>${finalQs.map((q, i) => {
            const correct = source === 'qbank' ? q.correct_option : q.ans
            return `<td style="padding:4pt 12pt;font-size:10pt;">Q${i + 1}: <b>${correct || '?'}</b></td>${(i + 1) % 5 === 0 ? '</tr><tr>' : ''}`
          }).join('')}</tr></table>
        </div>` : ''

      const html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"/>
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; margin: 2cm; }
  .header { background: #1e3a5f; color: white; padding: 12pt; margin-bottom: 12pt; }
  .title-block { border-bottom: 1.5pt solid #1e3a5f; padding-bottom: 6pt; margin-bottom: 10pt; }
</style></head>
<body>
<div class="header">
  <div style="font-size:16pt;font-weight:bold;">Guidance Navodaya &amp; Sainik Institute</div>
  <div style="font-size:9pt;">Khangabok, Thoubal, Manipur</div>
</div>
<div class="title-block">
  <div style="font-size:14pt;font-weight:bold;color:#1e3a5f;">${title}</div>
  <div style="font-size:9pt;color:#64748b;">Teacher: ${locker.teacher_name} | Subject: ${locker.subject} | Course: ${COURSE_LABELS[locker.course]} | Total Marks: ${totalMarks} | Questions: ${finalQs.length} | Date: ${today()}</div>
</div>
${instructions ? `<p style="font-style:italic;font-size:9pt;color:#475569;margin-bottom:10pt;">Instructions: ${instructions}</p><hr/>` : ''}
${rows}
${answerKeyHtml}
</body></html>`

      const blob = new Blob([html], { type: 'application/msword' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = `${title.replace(/\s+/g, '_')}_${withAnswers ? 'WITH_ANSWERS' : 'QUESTION_PAPER'}.doc`
      a.click(); URL.revokeObjectURL(url)
      showToast('📝 Word doc downloaded!', C.green)
    } catch (e) { showToast('DOCX error: ' + e.message, C.rose) }
    setGenerating(false)
  }

  // ── UI ─────────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: C.white, borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 720, maxHeight: '95vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', boxShadow: '0 -12px 60px rgba(0,0,0,.25)' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: C.border, margin: '14px auto 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.navy }}>📄 Practice Paper Generator — {locker.subject}</div>
          <button onClick={onClose} style={btnSm('#f1f5f9', C.slate)}>✕</button>
        </div>

        <div style={{ padding: '16px 20px', flex: 1, overflowY: 'auto' }}>
          {/* Paper title + instructions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={lS}>Paper Title</label>
              <input style={iS} value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div>
              <label style={lS}>Question Source</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[['qbank', '📚 From QBank'], ['manual', '✍️ Type Manually']].map(([k, l]) => (
                  <button key={k} onClick={() => setSource(k)}
                    style={{ flex: 1, padding: '8px', borderRadius: 8, border: `2px solid ${source === k ? locker.color || C.navy : C.border}`, background: source === k ? '#eff6ff' : C.white, color: source === k ? locker.color || C.navy : C.slate, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={lS}>Instructions</label>
            <textarea style={{ ...iS, resize: 'vertical' }} rows={2} value={instructions} onChange={e => setInstructions(e.target.value)} />
          </div>

          {/* QBank source */}
          {source === 'qbank' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>
                  {loadingQs ? '⏳ Loading…' : `${qbankQs.length} questions in QBank for ${locker.subject}`}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={toggleAll} style={btnSm('#eff6ff', C.navy)}>
                    {selectedQs.size === qbankQs.length ? 'Deselect All' : 'Select All'}
                  </button>
                  <span style={{ fontSize: 12, color: C.green, fontWeight: 700, padding: '4px 10px' }}>
                    {selectedQs.size} selected · {totalMarks}M
                  </span>
                </div>
              </div>
              {qbankQs.length === 0 && !loadingQs && (
                <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                  No questions in QBank for {locker.subject}. Add questions via the Question Bank module first.
                </div>
              )}
              {qbankQs.map(q => (
                <div key={q.id} onClick={() => toggleQ(q.id)}
                  style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 8, marginBottom: 5, border: `1px solid ${selectedQs.has(q.id) ? C.navy : C.border}`, background: selectedQs.has(q.id) ? '#eff6ff' : '#fafafa', cursor: 'pointer' }}>
                  <input type="checkbox" checked={selectedQs.has(q.id)} onChange={() => toggleQ(q.id)} onClick={e => e.stopPropagation()} style={{ marginTop: 2, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', marginBottom: 3 }}>{q.question}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 11, color: C.slate }}>
                      <span style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: 4 }}>{q.chapter}</span>
                      {q.subsection && <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '1px 6px', borderRadius: 4 }}>{q.subsection}</span>}
                      <span style={{ background: q.difficulty === 'Easy' ? '#dcfce7' : q.difficulty === 'Hard' ? '#fee2e2' : '#fef9c3', padding: '1px 6px', borderRadius: 4, color: q.difficulty === 'Easy' ? C.green : q.difficulty === 'Hard' ? C.rose : C.amber }}>{q.difficulty}</span>
                      <span style={{ background: '#ede9fe', color: '#7c3aed', padding: '1px 6px', borderRadius: 4 }}>{q.marks || 1}M</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Manual source */}
          {source === 'manual' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{manualQs.length} questions · {totalMarks}M total</div>
                <button onClick={addManualRow} style={btn(C.navy)}>+ Add Question</button>
              </div>
              {manualQs.map((r, i) => (
                <div key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, marginBottom: 10, background: '#fafafa' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>Q{i + 1}</span>
                    {manualQs.length > 1 && <button onClick={() => removeManual(i)} style={btnSm('#fee2e2', C.rose)}>✖</button>}
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={lS}>Question *</label>
                    <textarea style={{ ...iS, resize: 'vertical' }} rows={2} value={r.q} onChange={e => updateManual(i, 'q', e.target.value)} placeholder="Type question here…" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    {['a', 'b', 'c', 'd'].map(l => (
                      <div key={l}>
                        <label style={{ ...lS, color: r.ans === l.toUpperCase() ? C.green : C.slate }}>Option {l.toUpperCase()} {r.ans === l.toUpperCase() ? '✓' : ''}</label>
                        <input style={{ ...iS, borderColor: r.ans === l.toUpperCase() ? '#86efac' : C.border }}
                          value={r[l]} onChange={e => updateManual(i, l, e.target.value)} placeholder={`Option ${l.toUpperCase()}`} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={lS}>Correct Answer</label>
                      <select style={iS} value={r.ans} onChange={e => updateManual(i, 'ans', e.target.value)}>
                        <option value="">Select</option>
                        {['A', 'B', 'C', 'D'].map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={lS}>Marks</label>
                      <select style={iS} value={r.marks} onChange={e => updateManual(i, 'marks', parseInt(e.target.value))}>
                        {[1, 2, 3, 4, 5].map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer — download buttons */}
        <div style={{ padding: '14px 20px 28px', borderTop: `1px solid ${C.border}`, background: '#f8fafc' }}>
          <div style={{ fontSize: 12, color: C.slate, marginBottom: 10 }}>
            {finalQs.length} questions · {totalMarks} total marks
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => generatePDF(false)} disabled={generating || !finalQs.length}
              style={btn(C.navy, generating || !finalQs.length)}>
              📄 PDF (Question Paper)
            </button>
            <button onClick={() => generatePDF(true)} disabled={generating || !finalQs.length}
              style={btn(C.indigo, generating || !finalQs.length)}>
              📄 PDF (With Answers)
            </button>
            <button onClick={() => generateDOCX(false)} disabled={generating || !finalQs.length}
              style={btn(C.teal || '#0891b2', generating || !finalQs.length)}>
              📝 Word Doc
            </button>
            <button onClick={() => generateDOCX(true)} disabled={generating || !finalQs.length}
              style={btn(C.amber, generating || !finalQs.length)}>
              📝 Word (With Answers)
            </button>
          </div>
          {generating && <div style={{ marginTop: 8, fontSize: 12, color: C.slate }}>⏳ Generating document…</div>}
        </div>
      </div>
    </div>
  )
}

// ── LOCKER VIEW (open locker contents) ────────────────────────────────────────
function LockerView({ locker, isUnlocked, onLock, showToast, currentUser }) {
  const [materials,  setMaterials]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [showPaste,  setShowPaste]  = useState(false)
  const [showPaper,  setShowPaper]  = useState(false)
  const [filterType, setFilterType] = useState('all')
  const [search,     setSearch]     = useState('')

  const isAdmin = (currentUser?.role || '').toLowerCase() === 'admin'

  const fetchMaterials = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('study_materials').select('*').eq('locker_id', locker.id).order('created_at', { ascending: false })
    setMaterials(data || [])
    setLoading(false)
  }, [locker.id])

  useEffect(() => { fetchMaterials() }, [fetchMaterials])

  const handleDelete = async (id) => {
    if (!confirm('Delete this material?')) return
    const { error } = await supabase.from('study_materials').delete().eq('id', id)
    if (error) { showToast('Delete failed', C.rose); return }
    showToast('Deleted ✓', C.rose); fetchMaterials()
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return materials.filter(m =>
      (filterType === 'all' || m.material_type === filterType) &&
      (!q || m.title?.toLowerCase().includes(q) || m.chapter?.toLowerCase().includes(q))
    )
  }, [materials, filterType, search])

  const countByType = useMemo(() => { const map = {}; materials.forEach(m => { map[m.material_type] = (map[m.material_type] || 0) + 1 }); return map }, [materials])

  return (
    <div>
      {showPaste && <BulkPasteModal locker={locker} onClose={() => setShowPaste(false)} onSaved={fetchMaterials} showToast={showToast} />}
      {showPaper && <PaperGenerator locker={locker} lockerMaterials={materials} onClose={() => setShowPaper(false)} showToast={showToast} />}

      {/* Locker header */}
      <div style={{ ...cardS, borderLeft: `5px solid ${locker.color || C.navy}`, borderRadius: '0 12px 12px 0', padding: '14px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: (locker.color || C.navy) + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>{locker.icon}</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.navy }}>{locker.teacher_name}'s Locker</div>
              <div style={{ fontSize: 12, color: C.slate }}>
                {COURSE_LABELS[locker.course]} · {locker.subject} · {materials.length} materials
                {isUnlocked && <span style={{ marginLeft: 8, color: C.green, fontWeight: 700 }}>🔓 Unlocked</span>}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {isUnlocked && (
              <>
                <button onClick={() => setShowPaste(true)} style={btn(locker.color || C.navy)}>📋 Bulk Paste</button>
                <button onClick={() => setShowPaper(true)} style={btn(C.indigo)}>📄 Create Paper</button>
                <button onClick={onLock} style={btnSm('#fee2e2', C.rose)}>🔒 Lock</button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Search + filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <input style={{ ...iS, padding: '7px 10px 7px 28px', fontSize: 12 }} placeholder="🔍 Search materials…" value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: C.slate }}>✕</button>}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => setFilterType('all')} style={{ padding: '6px 12px', borderRadius: 99, fontSize: 11, fontWeight: 700, border: `1px solid ${filterType === 'all' ? (locker.color || C.navy) : C.border}`, background: filterType === 'all' ? '#eff6ff' : '#fff', color: filterType === 'all' ? (locker.color || C.navy) : C.slate, cursor: 'pointer' }}>All ({materials.length})</button>
          {MATERIAL_TYPES.filter(t => countByType[t.key]).map(t => (
            <button key={t.key} onClick={() => setFilterType(t.key)} style={{ padding: '6px 12px', borderRadius: 99, fontSize: 11, fontWeight: 700, border: `1px solid ${filterType === t.key ? t.color : C.border}`, background: filterType === t.key ? t.bg : '#fff', color: filterType === t.key ? t.color : C.slate, cursor: 'pointer' }}>
              {t.icon} {t.label} ({countByType[t.key]})
            </button>
          ))}
        </div>
      </div>

      {/* Materials grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.slate }}>⏳ Loading materials…</div>
      ) : filtered.length === 0 ? (
        <div style={{ ...cardS, textAlign: 'center', padding: 40, color: '#94a3b8' }}>
          {materials.length === 0 ? (
            <>No materials yet.{isUnlocked ? ' Use 📋 Bulk Paste to add materials.' : ' Unlock to add materials.'}</>
          ) : 'No materials match your filter.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {filtered.map(mat => {
            const t = MATERIAL_TYPES.find(x => x.key === mat.material_type) || MATERIAL_TYPES[0]
            const isVideo = mat.material_type === 'video' || mat.file_url?.includes('youtube') || mat.file_url?.includes('youtu.be')
            const isLink  = !mat.file_name && mat.file_url
            return (
              <div key={mat.id} style={{ background: C.white, borderRadius: 10, border: `1px solid ${C.border}`, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{t.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{mat.title}</span>
                    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, color: t.color, background: t.bg }}>{t.label}</span>
                    {mat.chapter && <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, color: C.slate, background: '#f1f5f9' }}>{mat.chapter}</span>}
                  </div>
                  {mat.description && <div style={{ fontSize: 12, color: C.slate, marginBottom: 4 }}>{mat.description}</div>}
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{mat.created_at && fmtDate(mat.created_at)}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    {mat.file_url && (
                      <a href={mat.file_url} target="_blank" rel="noreferrer"
                        style={btnSm(isVideo ? '#fee2e2' : '#eff6ff', isVideo ? C.rose : C.navy)}>
                        {isVideo ? '▶ Watch' : isLink ? '🔗 Open Link' : '📥 Download'}
                      </a>
                    )}
                    {isUnlocked && (
                      <button onClick={() => handleDelete(mat.id)} style={btnSm('#fee2e2', C.rose)}>🗑 Delete</button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function StudyLockers({ currentUser }) {
  const [lockers,       setLockers]       = useState([])
  const [loading,       setLoading]       = useState(true)
  const [unlockedIds,   setUnlockedIds]   = useState({}) // { lockerId: timestamp }
  const [activeLocker,  setActiveLocker]  = useState(null)
  const [unlockTarget,  setUnlockTarget]  = useState(null)
  const [activeTab,     setActiveTab]     = useState('lockers') // 'lockers' | 'admin'
  const [filterCourse,  setFilterCourse]  = useState('all')
  const [toast,         setToast]         = useState(null)
  const isMobile = useIsMobile()
  const isAdmin = (currentUser?.role || '').toLowerCase() === 'admin'

  const showToast = (msg, color = C.navy) => { setToast({ msg, color }); setTimeout(() => setToast(null), 3500) }

  const fetchLockers = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('study_lockers').select('*').order('teacher_name')
    setLockers(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchLockers() }, [fetchLockers])

  // Auto-lock after idle
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      setUnlockedIds(prev => {
        const next = { ...prev }
        Object.entries(next).forEach(([id, ts]) => { if (now - ts > AUTO_LOCK_MS) delete next[id] })
        return next
      })
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  const isUnlocked = (id) => {
    const ts = unlockedIds[id]
    return ts && (Date.now() - ts < AUTO_LOCK_MS)
  }

  const handleUnlocked = (lockerId) => {
    setUnlockedIds(p => ({ ...p, [lockerId]: Date.now() }))
    setActiveLocker(lockerId)
    showToast('🔓 Locker unlocked! Auto-locks in 30 min.', C.green)
  }

  const handleLock = (lockerId) => {
    setUnlockedIds(p => { const n = { ...p }; delete n[lockerId]; return n })
    showToast('🔒 Locker locked', C.slate)
  }

  const handleLockerClick = (locker) => {
    if (isUnlocked(locker.id)) { setActiveLocker(locker.id); return }
    setUnlockTarget(locker)
  }

  const filtered = useMemo(() =>
    filterCourse === 'all' ? lockers : lockers.filter(l => l.course === filterCourse),
    [lockers, filterCourse]
  )

  const activeLockerData = lockers.find(l => l.id === activeLocker)

  return (
    <div style={{ padding: isMobile ? '16px 12px' : 24, fontFamily: 'system-ui,sans-serif', background: C.bg, minHeight: '100vh' }}>
      {toast && <Toast msg={toast.msg} color={toast.color} />}
      {unlockTarget && (
        <UnlockModal
          locker={unlockTarget}
          onUnlocked={() => handleUnlocked(unlockTarget.id)}
          onClose={() => setUnlockTarget(null)}
        />
      )}

      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: C.slate, marginBottom: 4 }}>GNSI Portal</div>
        <div style={{ fontSize: isMobile ? 22 : 26, fontWeight: 900, color: C.navy, letterSpacing: '-.02em' }}>Study Lockers</div>
        <div style={{ fontSize: 12, color: C.slate, marginTop: 3 }}>Teacher-owned subject lockers · Password protected · Practice paper generator</div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {[
          { key: 'lockers', label: '🗃️ All Lockers', count: lockers.length },
          ...(activeLockerData ? [{ key: 'view', label: `${activeLockerData.icon} ${activeLockerData.teacher_name}`, count: null }] : []),
          ...(isAdmin ? [{ key: 'admin', label: '⚙️ Admin', count: null }] : []),
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 9, border: activeTab === t.key ? `2px solid ${C.navy}` : `2px solid ${C.border}`, background: activeTab === t.key ? C.navy : C.white, color: activeTab === t.key ? '#fff' : C.slate, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all .12s' }}>
            {t.label}
            {t.count !== null && t.count > 0 && (
              <span style={{ padding: '1px 7px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: activeTab === t.key ? 'rgba(255,255,255,.2)' : C.navy, color: '#fff' }}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* LOCKERS GRID */}
      {activeTab === 'lockers' && (
        <>
          {/* Course filter */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {[['all', 'All Courses'], ...COURSES.map(c => [c, COURSE_LABELS[c]])].map(([k, l]) => (
              <button key={k} onClick={() => setFilterCourse(k)}
                style={{ padding: '6px 14px', borderRadius: 99, fontSize: 12, fontWeight: 700, border: `1.5px solid ${filterCourse === k ? (COURSE_COLORS[k] || C.navy) : C.border}`, background: filterCourse === k ? (COURSE_BG[k] || '#eff6ff') : C.white, color: filterCourse === k ? (COURSE_TEXT[k] || C.navy) : C.slate, cursor: 'pointer' }}>
                {l}
                <span style={{ marginLeft: 5, opacity: .7 }}>
                  ({k === 'all' ? lockers.length : lockers.filter(l2 => l2.course === k).length})
                </span>
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: C.slate }}>⏳ Loading lockers…</div>
          ) : filtered.length === 0 ? (
            <div style={{ ...cardS, textAlign: 'center', padding: 60, color: '#94a3b8' }}>
              {isAdmin ? 'No lockers yet. Go to ⚙️ Admin to create the first locker.' : 'No lockers available yet. Contact admin.'}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {filtered.map(locker => {
                const unlocked = isUnlocked(locker.id)
                return (
                  <div key={locker.id}
                    onClick={() => handleLockerClick(locker)}
                    style={{ background: C.white, borderRadius: 14, border: `2px solid ${unlocked ? locker.color || C.navy : C.border}`, padding: '18px 20px', cursor: 'pointer', transition: 'all .15s', boxShadow: unlocked ? `0 0 0 3px ${(locker.color || C.navy)}33` : '0 1px 6px rgba(0,0,0,.07)', position: 'relative' }}>
                    {/* Unlocked glow indicator */}
                    {unlocked && (
                      <div style={{ position: 'absolute', top: 12, right: 12, width: 10, height: 10, borderRadius: '50%', background: C.green, boxShadow: '0 0 0 3px #dcfce7' }} />
                    )}
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ width: 52, height: 52, borderRadius: 12, background: (locker.color || C.navy) + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, border: `2px solid ${(locker.color || C.navy)}33` }}>
                        {unlocked ? '🔓' : locker.icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: C.navy }}>{locker.teacher_name}</div>
                        <div style={{ fontSize: 11, color: C.slate, marginTop: 2 }}>{locker.subject}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                      <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: COURSE_BG[locker.course] || '#eff6ff', color: COURSE_TEXT[locker.course] || C.navy }}>{COURSE_LABELS[locker.course]}</span>
                      {unlocked && <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: '#dcfce7', color: C.green }}>🔓 Unlocked</span>}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>Click to {unlocked ? 'open' : 'unlock'}</span>
                      <span style={{ fontSize: 20 }}>{unlocked ? '→' : '🔑'}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* LOCKER VIEW */}
      {activeTab === 'view' && activeLockerData && (
        <LockerView
          locker={activeLockerData}
          isUnlocked={isUnlocked(activeLockerData.id)}
          onLock={() => { handleLock(activeLockerData.id); setActiveTab('lockers') }}
          showToast={showToast}
          currentUser={currentUser}
        />
      )}

      {/* ADMIN TAB */}
      {activeTab === 'admin' && (
        <AdminLockerPanel lockers={lockers} onRefetch={fetchLockers} showToast={showToast} currentUser={currentUser} />
      )}
    </div>
  )
}