import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { supabase } from './supabase'

// ─── Mobile hook ──────────────────────────────────────────────────────────────
function useMobile() {
  const [m, setM] = useState(() => window.innerWidth <= 768)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const h = e => setM(e.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])
  return m
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const CHANNELS   = ['SMS', 'Email', 'WhatsApp', 'Portal']
const AUDIENCES  = ['All', 'Parents', 'Students', 'Teachers', 'Staff', 'Fee Defaulters', 'Absent Today', 'Hostel Students']
const LANGUAGES  = ['English', 'Hindi', 'Meitei']
const PRIORITIES = ['Urgent', 'Important', 'General']
const CATEGORIES = ['Fee Reminder','Absence Alert','Exam Notice','Holiday Notice','PTM Invitation','Birthday','Emergency','General']
const ROLES      = ['Teacher','Staff','Faculty','House Master','Accountant','Computer Staffs','Administrator','Hostel Supervisor','Superintendent','Non Teaching Staffs','Receptionist']

const NAV_TABS = [
  { id: 'compose',    icon: '✏️',  label: 'Compose'     },
  { id: 'broadcasts', icon: '📡',  label: 'Broadcasts'  },
  { id: 'inbox',      icon: '📨',  label: 'Inbox'       },
  { id: 'grievance',  icon: '🗂️',  label: 'Grievances'  },
  { id: 'consent',    icon: '✅',  label: 'Consent'     },
  { id: 'calendar',   icon: '📅',  label: 'Calendar'    },
  { id: 'analytics',  icon: '📊',  label: 'Analytics'   },
  { id: 'templates',  icon: '📝',  label: 'Templates'   },
  { id: 'settings',   icon: '⚙️',  label: 'Settings'    },
]

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --navy: #0f2744; --blue: #1a56db; --blue-light: #ebf2ff; --blue-mid: #c7d7f9;
    --green: #057a55; --green-light: #e3fcef; --red: #c81e1e; --red-light: #fde8e8;
    --amber: #b45309; --amber-light: #fffbeb;
    --gray-50: #f8fafc; --gray-100: #f1f5f9; --gray-200: #e2e8f0; --gray-300: #cbd5e1;
    --gray-400: #94a3b8; --gray-500: #64748b; --gray-700: #334155; --gray-900: #0f172a;
    --radius: 10px; --shadow: 0 1px 4px rgba(0,0,0,.08), 0 4px 16px rgba(0,0,0,.06);
  }
  .conn-card { background:#fff; border-radius:12px; border:1px solid var(--gray-200); box-shadow:var(--shadow); }
  .conn-inp { width:100%;padding:9px 12px;border-radius:8px;border:1.5px solid var(--gray-200);font-size:13px;font-family:'DM Sans',sans-serif;outline:none;transition:border .15s;background:#fff; }
  .conn-inp:focus { border-color:var(--blue); }
  .conn-inp:disabled { background:var(--gray-50);color:var(--gray-400); }
  .conn-label { font-size:12px;font-weight:600;color:var(--gray-700);display:block;margin-bottom:5px; }
  .conn-btn-primary { background:var(--navy);color:#fff;border:none;padding:10px 22px;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:all .15s; }
  .conn-btn-primary:hover { background:#1a3a6e; }
  .conn-btn-primary:disabled { background:var(--gray-300);cursor:not-allowed; }
  .conn-btn-ghost { background:transparent;color:var(--gray-700);border:1.5px solid var(--gray-200);padding:8px 16px;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:13px;cursor:pointer;transition:all .15s; }
  .conn-btn-ghost:hover { border-color:var(--blue);color:var(--blue); }
  .conn-btn-danger { background:var(--red-light);color:var(--red);border:none;padding:6px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif; }
  .conn-tab { padding:7px 14px;border-radius:8px;border:1.5px solid var(--gray-200);background:#fff;font-family:'DM Sans',sans-serif;font-size:12px;font-weight:500;cursor:pointer;transition:all .15s;white-space:nowrap; }
  .conn-tab.active { background:var(--blue-light);color:var(--blue);border-color:var(--blue-mid);font-weight:700; }
  .conn-badge { display:inline-flex;align-items:center;gap:4px;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700; }
  .conn-table { width:100%;border-collapse:collapse;font-size:13px; }
  .conn-table th { padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:var(--gray-500);text-transform:uppercase;letter-spacing:.04em;background:var(--gray-50);border-bottom:1px solid var(--gray-200); }
  .conn-table td { padding:12px 14px;border-bottom:1px solid var(--gray-100);color:var(--gray-700); }
  .conn-table tr:last-child td { border-bottom:none; }
  .conn-table tr:hover td { background:var(--gray-50); }
  .conn-toggle { position:relative;display:inline-block;width:36px;height:20px; }
  .conn-toggle input { opacity:0;width:0;height:0; }
  .conn-toggle-slider { position:absolute;inset:0;background:var(--gray-300);border-radius:20px;cursor:pointer;transition:.2s; }
  .conn-toggle input:checked + .conn-toggle-slider { background:var(--blue); }
  .conn-toggle-slider:before { content:'';position:absolute;width:14px;height:14px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.2s; }
  .conn-toggle input:checked + .conn-toggle-slider:before { transform:translateX(16px); }
  @keyframes conn-fadein { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
  .conn-animate { animation:conn-fadein .2s ease; }
  .conn-emergency-btn { background:linear-gradient(135deg,#dc2626,#991b1b);color:#fff;border:none;padding:12px 24px;border-radius:10px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:800;cursor:pointer;box-shadow:0 4px 14px rgba(220,38,38,.4);transition:all .2s; }
  .sms-counter { font-family:'DM Mono',monospace;font-size:11px;color:var(--gray-500); }
  .sms-counter.warn { color:var(--amber); }
  .sms-counter.danger { color:var(--red); }
  /* Mobile nav scroll */
  .conn-mob-nav { display:flex;overflow-x:auto;gap:6px;padding:10px 12px;background:#fff;border-bottom:1px solid var(--gray-200);scrollbar-width:none;-webkit-overflow-scrolling:touch; }
  .conn-mob-nav::-webkit-scrollbar { display:none; }
  .conn-mob-nav-btn { flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 14px;border-radius:10px;border:1.5px solid var(--gray-200);background:#fff;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .15s;position:relative; }
  .conn-mob-nav-btn.active { background:var(--blue-light);border-color:var(--blue-mid); }
  .conn-mob-nav-btn .icon { font-size:18px; }
  .conn-mob-nav-btn .label { font-size:10px;font-weight:600;color:var(--gray-500);white-space:nowrap; }
  .conn-mob-nav-btn.active .label { color:var(--blue); }
`

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function Spinner() {
  return <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>⏳ Loading…</div>
}

function priorityBadge(p) {
  const map = { Urgent: ['#fde8e8','#c81e1e','#c81e1e'], Important: ['#fffbeb','#b45309','#f59e0b'], General: ['#f1f5f9','#475569','#94a3b8'] }
  const [bg, color, dot] = map[p] || map.General
  return <span className="conn-badge" style={{ background: bg, color }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: dot, display: 'inline-block' }} />{p}</span>
}
function channelBadge(c) {
  const map = { SMS: ['#e3fcef','#057a55'], Email: ['#ebf2ff','#1a56db'], WhatsApp: ['#ecfdf5','#065f46'], Portal: ['#f5f3ff','#5b21b6'] }
  const [bg, color] = map[c] || ['#f1f5f9','#475569']
  return <span className="conn-badge" style={{ background: bg, color }}>{c}</span>
}
function statusBadge(s) {
  const map = { Sent: ['#e3fcef','#057a55'], Delivered: ['#e3fcef','#057a55'], Pending: ['#fffbeb','#b45309'], Scheduled: ['#ebf2ff','#1a56db'], Failed: ['#fde8e8','#c81e1e'], Cancelled: ['#f1f5f9','#475569'], Open: ['#fde8e8','#c81e1e'], 'In Progress': ['#fffbeb','#b45309'], Resolved: ['#e3fcef','#057a55'], Active: ['#e3fcef','#057a55'], Inactive: ['#f1f5f9','#475569'] }
  const [bg, color] = map[s] || ['#f1f5f9','#475569']
  return <span className="conn-badge" style={{ background: bg, color }}>{s}</span>
}
function fmt(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}
function SMSCounter({ text, channel }) {
  if (channel !== 'SMS') return null
  const len = (text || '').length
  const msgs = Math.ceil(len / 160) || 1
  return <span className={`sms-counter ${len > 320 ? 'danger' : len > 160 ? 'warn' : ''}`}>{len} chars · {msgs} SMS</span>
}

// ─── COMPOSE ──────────────────────────────────────────────────────────────────
function ComposeSection({ currentUser, quotaLeft, setQuotaLeft, isAdmin, mobile }) {
  const [form, setForm] = useState({ title: '', audience: 'All', role_filter: '', channel: 'SMS', priority: 'General', language: 'English', message_body: '', scheduled_date: '', is_emergency: false, attach_url: '' })
  const [templates, setTemplates] = useState([])
  const [recipientCount, setRecipientCount] = useState(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [lastSentKey, setLastSentKey] = useState(null)
  const [dupWarn, setDupWarn] = useState(false)

  useEffect(() => {
    supabase.from('connect_templates').select('id,template_name,template_text,channel,category').then(({ data }) => setTemplates(data || []))
  }, [])

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSend = async () => {
    if (quotaLeft <= 0) { alert('Daily quota exhausted.'); return }
    const sendKey = `${form.audience}|${form.channel}|${form.message_body?.slice(0,40)}`
    if (lastSentKey === sendKey) { setDupWarn(true); return }
    setSending(true)
    const payload = { title: form.title || form.message_body.slice(0,40), audience: form.audience, channel: form.channel, priority: form.priority, language: form.language, message_body: form.message_body, status: form.scheduled_date ? 'Scheduled' : 'Sent', scheduled_date: form.scheduled_date || null, attach_url: form.attach_url || null, is_emergency: form.is_emergency, sent_by: currentUser?.username ?? 'Admin', recipient_count: typeof recipientCount === 'number' ? recipientCount : null }
    const { error } = await supabase.from('connect_broadcasts').insert([payload])
    if (!error) { setLastSentKey(sendKey); setQuotaLeft(q => q - 1); setSent(true); setForm(p => ({ ...p, title: '', message_body: '', scheduled_date: '', is_emergency: false, attach_url: '' })); setTimeout(() => setSent(false), 3000) }
    else alert(error.message)
    setSending(false); setShowConfirm(false)
  }

  if (!isAdmin) return (
    <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#334155', marginBottom: 6 }}>Access Restricted</div>
      <div style={{ fontSize: 13 }}>Only admins can send messages.</div>
    </div>
  )

  const grid2 = { display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 14 }

  return (
    <div className="conn-animate">
      {/* Emergency */}
      <div style={{ background: 'linear-gradient(135deg,#fff1f2,#fee2e2)', border: '1px solid #fca5a5', borderRadius: 12, padding: mobile ? '12px 14px' : '16px 20px', marginBottom: 16, display: 'flex', alignItems: mobile ? 'flex-start' : 'center', flexDirection: mobile ? 'column' : 'row', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#991b1b' }}>🚨 Emergency Alert</div>
          <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 2 }}>Broadcasts to ALL via ALL channels simultaneously.</div>
        </div>
        <button className="conn-emergency-btn" style={{ fontSize: 12, padding: '10px 18px' }} onClick={() => { f('is_emergency', true); f('priority', 'Urgent'); f('audience', 'All'); setShowConfirm(true) }}>🚨 Send Emergency</button>
      </div>

      {sent && <div style={{ padding: '10px 16px', background: '#e3fcef', border: '1px solid #a7f3d0', borderRadius: 10, color: '#065f46', fontWeight: 600, fontSize: 13, marginBottom: 14 }}>✅ Message sent!</div>}
      {dupWarn && (
        <div style={{ padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, color: '#92400e', fontSize: 12, marginBottom: 14 }}>
          ⚠️ Duplicate detected. <button className="conn-btn-primary" style={{ fontSize: 11, padding: '4px 10px', marginLeft: 8 }} onClick={() => { setDupWarn(false); setLastSentKey(null); setShowConfirm(true) }}>Send Anyway</button>
          <button className="conn-btn-ghost" style={{ fontSize: 11, padding: '4px 10px', marginLeft: 6 }} onClick={() => setDupWarn(false)}>Cancel</button>
        </div>
      )}

      <div className="conn-card" style={{ padding: mobile ? 16 : 24, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#0f2744' }}>✏️ Compose Message</div>
          <div style={{ fontSize: 11, color: quotaLeft < 10 ? '#c81e1e' : '#64748b', fontWeight: 600 }}>Quota: <strong>{quotaLeft}</strong> left</div>
        </div>

        <div style={grid2}>
          <div style={{ gridColumn: '1/-1' }}>
            <label className="conn-label">Title (optional)</label>
            <input className="conn-inp" placeholder="Message title" value={form.title} onChange={e => f('title', e.target.value)} />
          </div>
          <div>
            <label className="conn-label">Audience</label>
            <select className="conn-inp" value={form.audience} onChange={e => f('audience', e.target.value)}>
              {AUDIENCES.map(a => <option key={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="conn-label">Channel</label>
            <select className="conn-inp" value={form.channel} onChange={e => f('channel', e.target.value)}>
              {CHANNELS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="conn-label">Priority</label>
            <select className="conn-inp" value={form.priority} onChange={e => f('priority', e.target.value)}>
              {PRIORITIES.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="conn-label">Language</label>
            <select className="conn-inp" value={form.language} onChange={e => f('language', e.target.value)}>
              {LANGUAGES.map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <label className="conn-label" style={{ margin: 0 }}>Message</label>
              <SMSCounter text={form.message_body} channel={form.channel} />
            </div>
            <textarea className="conn-inp" rows={mobile ? 4 : 5} placeholder="Type your message…" value={form.message_body} onChange={e => f('message_body', e.target.value)} style={{ resize: 'vertical' }} />
          </div>
          <div>
            <label className="conn-label">Schedule Date (optional)</label>
            <input type="date" className="conn-inp" value={form.scheduled_date} onChange={e => f('scheduled_date', e.target.value)} min={new Date().toISOString().split('T')[0]} />
          </div>
          <div>
            <label className="conn-label">Attachment URL</label>
            <input className="conn-inp" placeholder="https://…" value={form.attach_url} onChange={e => f('attach_url', e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="conn-btn-primary" disabled={!form.message_body || sending} onClick={() => setShowConfirm(true)}>
            {form.scheduled_date ? '🗓️ Schedule' : '📤 Send Now'}
          </button>
          <button className="conn-btn-ghost" onClick={() => setForm(p => ({ ...p, message_body: '', title: '' }))}>Clear</button>
        </div>
      </div>

      {/* Templates on mobile — horizontal scroll */}
      {templates.length > 0 && (
        <div className="conn-card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#0f2744', marginBottom: 10 }}>📝 Templates</div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch' }}>
            {templates.map(t => (
              <div key={t.id} onClick={() => { f('message_body', t.template_text); f('channel', t.channel) }} style={{ flexShrink: 0, padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', cursor: 'pointer', minWidth: 160, maxWidth: 200 }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: '#0f2744' }}>{t.template_name}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{t.category} · {t.channel}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirm modal */}
      {showConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 999 }}>
          <div className="conn-card" style={{ width: '100%', maxWidth: 480, padding: 24, borderRadius: '16px 16px 0 0' }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#0f2744', marginBottom: 12 }}>📤 Confirm Send</div>
            <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, lineHeight: 1.7 }}>
              <div><strong>To:</strong> {form.audience}</div>
              <div><strong>Via:</strong> {form.is_emergency ? 'ALL CHANNELS' : form.channel}</div>
              <div><strong>Priority:</strong> {form.priority}</div>
              {form.scheduled_date && <div><strong>Scheduled:</strong> {form.scheduled_date}</div>}
              <div style={{ marginTop: 8, background: '#fff', padding: '8px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12 }}>{form.message_body}</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="conn-btn-ghost" style={{ flex: 1 }} onClick={() => { setShowConfirm(false); f('is_emergency', false) }}>Cancel</button>
              <button disabled={sending} onClick={handleSend} style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: form.is_emergency ? '#dc2626' : '#0f2744', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                {sending ? '⏳ Sending…' : form.is_emergency ? '🚨 Confirm Emergency' : '📤 Confirm Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── BROADCASTS ───────────────────────────────────────────────────────────────
function BroadcastsSection({ isAdmin, mobile }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    supabase.from('connect_broadcasts').select('*').order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => { setRows(data || []); setLoading(false) })
  }, [])

  const filtered = filter === 'All' ? rows : rows.filter(r => r.status === filter || r.priority === filter)
  const del = async (id) => { if (!window.confirm('Delete?')) return; await supabase.from('connect_broadcasts').delete().eq('id', id); setRows(p => p.filter(r => r.id !== id)) }

  if (loading) return <Spinner />

  return (
    <div className="conn-animate">
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch' }}>
        {['All','Sent','Scheduled','Urgent','Important'].map(f => (
          <button key={f} className={`conn-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>

      {mobile ? (
        /* Mobile card list */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(r => (
            <div key={r.id} className="conn-card" style={{ padding: '14px 16px', cursor: 'pointer' }} onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ flex: 1, marginRight: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#0f2744' }}>{r.title || r.message_body?.slice(0,40) || '—'}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>{r.audience} · {fmt(r.created_at)}</div>
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
                  {statusBadge(r.status)}
                  {isAdmin && <button className="conn-btn-danger" style={{ padding: '4px 8px', fontSize: 11 }} onClick={e => { e.stopPropagation(); del(r.id) }}>✕</button>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {channelBadge(r.channel)}{priorityBadge(r.priority || 'General')}
              </div>
              {expanded === r.id && (
                <div style={{ marginTop: 10, padding: '10px 12px', background: '#f8fafc', borderRadius: 8, fontSize: 12, color: '#334155', lineHeight: 1.6 }}>
                  {r.message_body}
                  {r.recipient_count && <div style={{ color: '#94a3b8', marginTop: 6 }}>📬 {r.recipient_count} recipients</div>}
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No broadcasts found.</div>}
        </div>
      ) : (
        <div className="conn-card" style={{ overflow: 'hidden' }}>
          <table className="conn-table">
            <thead><tr><th>Title</th><th>Audience</th><th>Channel</th><th>Priority</th><th>Status</th><th>Date</th><th></th></tr></thead>
            <tbody>
              {filtered.map(r => (
                <>
                  <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                    <td style={{ fontWeight: 600 }}>{r.title || r.message_body?.slice(0,40) || '—'}</td>
                    <td>{r.audience}</td>
                    <td>{channelBadge(r.channel)}</td>
                    <td>{priorityBadge(r.priority || 'General')}</td>
                    <td>{statusBadge(r.status)}</td>
                    <td style={{ fontSize: 12, color: '#94a3b8' }}>{fmt(r.created_at)}</td>
                    <td>{isAdmin && <button className="conn-btn-danger" onClick={e => { e.stopPropagation(); del(r.id) }}>Delete</button>}</td>
                  </tr>
                  {expanded === r.id && <tr key={`${r.id}-exp`}><td colSpan={7} style={{ background: '#f8fafc', padding: '14px 18px', fontSize: 13, color: '#334155', lineHeight: 1.7 }}>{r.message_body}</td></tr>}
                </>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>No broadcasts.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── INBOX ────────────────────────────────────────────────────────────────────
function InboxSection({ isAdmin, mobile }) {
  const [replies, setReplies] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [reply, setReply] = useState({})

  useEffect(() => {
    supabase.from('connect_replies').select('*').order('created_at', { ascending: false }).limit(100)
      .then(({ data }) => { setReplies(data || []); setLoading(false) })
  }, [])

  const markRead = async (id) => {
    await supabase.from('connect_replies').update({ is_read: true }).eq('id', id)
    setReplies(p => p.map(r => r.id === id ? { ...r, is_read: true } : r))
  }

  const filtered = filter === 'unread' ? replies.filter(r => !r.is_read) : replies
  if (loading) return <Spinner />

  return (
    <div className="conn-animate">
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <button className={`conn-tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
        <button className={`conn-tab ${filter === 'unread' ? 'active' : ''}`} onClick={() => setFilter('unread')}>
          Unread {replies.filter(r => !r.is_read).length > 0 && <span style={{ marginLeft: 4, background: '#c81e1e', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10 }}>{replies.filter(r => !r.is_read).length}</span>}
        </button>
      </div>
      {filtered.map(r => (
        <div key={r.id} className="conn-card" style={{ padding: '14px 16px', marginBottom: 10, borderLeft: r.is_read ? '3px solid #e2e8f0' : '3px solid #1a56db' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{r.sender_name} <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: 11 }}>({r.sender_role})</span></div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>{fmt(r.created_at)}</span>
              {!r.is_read && <button className="conn-btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => markRead(r.id)}>Mark Read</button>}
            </div>
          </div>
          <div style={{ fontSize: 13, color: '#334155' }}>{r.message}</div>
          {isAdmin && (
            <div style={{ marginTop: 10 }}>
              <textarea className="conn-inp" rows={2} placeholder="Admin reply…" value={reply[r.id] || ''} onChange={e => setReply(p => ({ ...p, [r.id]: e.target.value }))} style={{ fontSize: 12, marginBottom: 6 }} />
              <button className="conn-btn-primary" style={{ fontSize: 12, padding: '6px 14px' }}>Send Reply</button>
            </div>
          )}
        </div>
      ))}
      {filtered.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No replies yet.</div>}
    </div>
  )
}

// ─── GRIEVANCE ────────────────────────────────────────────────────────────────
function GrievanceSection({ isAdmin }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('Open')
  const [note, setNote] = useState({})

  useEffect(() => {
    supabase.from('connect_grievances').select('*').order('created_at', { ascending: false }).then(({ data }) => { setRows(data || []); setLoading(false) })
  }, [])

  const updateStatus = async (id, status, adminNote) => {
    await supabase.from('connect_grievances').update({ status, admin_note: adminNote || null }).eq('id', id)
    setRows(p => p.map(r => r.id === id ? { ...r, status, admin_note: adminNote } : r))
  }

  const filtered = filter === 'All' ? rows : rows.filter(r => r.status === filter)
  if (loading) return <Spinner />

  return (
    <div className="conn-animate">
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', paddingBottom: 4 }}>
        {['All','Open','In Progress','Resolved'].map(f => <button key={f} className={`conn-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f}</button>)}
      </div>
      {filtered.map(r => (
        <div key={r.id} className="conn-card" style={{ padding: '16px', marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
            <div><span style={{ fontFamily: 'monospace', fontSize: 11, background: '#f1f5f9', padding: '2px 8px', borderRadius: 4, color: '#475569', marginRight: 8 }}>{r.ticket_no || `TKT-${r.id}`}</span><strong style={{ fontSize: 13 }}>{r.subject}</strong></div>
            {statusBadge(r.status)}
          </div>
          <div style={{ fontSize: 13, color: '#334155', marginBottom: 8 }}>{r.message}</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10 }}>From: {r.sender_name} ({r.sender_role}) · {fmt(r.created_at)}</div>
          {r.admin_note && <div style={{ fontSize: 12, background: '#f0f9ff', padding: '8px 10px', borderRadius: 6, color: '#0369a1', marginBottom: 10 }}>Note: {r.admin_note}</div>}
          {isAdmin && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input className="conn-inp" placeholder="Admin note…" value={note[r.id] || ''} onChange={e => setNote(p => ({ ...p, [r.id]: e.target.value }))} style={{ fontSize: 12, flex: 1, minWidth: 140 }} />
              <button className="conn-btn-ghost" style={{ fontSize: 12 }} onClick={() => updateStatus(r.id, 'In Progress', note[r.id])}>In Progress</button>
              <button className="conn-btn-primary" style={{ fontSize: 12, background: '#057a55' }} onClick={() => updateStatus(r.id, 'Resolved', note[r.id])}>✓ Resolve</button>
            </div>
          )}
        </div>
      ))}
      {filtered.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No grievances.</div>}
    </div>
  )
}

// ─── CONSENT ──────────────────────────────────────────────────────────────────
function ConsentSection({ isAdmin, mobile }) {
  const [slips, setSlips] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ title: '', description: '', options: 'Yes,No,Maybe', deadline: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('connect_consent').select('*').order('created_at', { ascending: false }).then(({ data }) => { setSlips(data || []); setLoading(false) })
  }, [])

  const create = async () => {
    setSaving(true)
    const { error } = await supabase.from('connect_consent').insert([{ title: form.title, description: form.description, options: form.options.split(',').map(s => s.trim()), deadline: form.deadline || null, status: 'Active', responses: {} }])
    if (!error) { setSlips(p => [{ ...form, id: Date.now(), created_at: new Date().toISOString() }, ...p]); setForm({ title: '', description: '', options: 'Yes,No,Maybe', deadline: '' }) }
    setSaving(false)
  }

  if (loading) return <Spinner />

  return (
    <div className="conn-animate">
      {isAdmin && (
        <div className="conn-card" style={{ padding: 18, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#0f2744', marginBottom: 12 }}>➕ Create Consent Slip</div>
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div style={{ gridColumn: '1/-1' }}><label className="conn-label">Title *</label><input className="conn-inp" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
            <div style={{ gridColumn: '1/-1' }}><label className="conn-label">Description</label><textarea className="conn-inp" rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
            <div><label className="conn-label">Options (comma-separated)</label><input className="conn-inp" value={form.options} onChange={e => setForm(p => ({ ...p, options: e.target.value }))} /></div>
            <div><label className="conn-label">Deadline</label><input type="date" className="conn-inp" value={form.deadline} onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))} /></div>
          </div>
          <button className="conn-btn-primary" disabled={!form.title || saving} onClick={create}>{saving ? 'Creating…' : '✅ Create'}</button>
        </div>
      )}
      {slips.map(s => {
        const resp = s.responses || {}
        const total = Object.values(resp).reduce((a, b) => a + b, 0)
        return (
          <div key={s.id} className="conn-card" style={{ padding: 16, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{s.title}</div>
              {statusBadge(s.status || 'Active')}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>{s.description}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {(s.options || ['Yes','No','Maybe']).map(opt => {
                const count = resp[opt] || 0
                const pct = total > 0 ? Math.round((count / total) * 100) : 0
                const col = { Yes: '#057a55', No: '#c81e1e', Maybe: '#b45309' }[opt] || '#1a56db'
                return (
                  <div key={opt} style={{ background: '#f8fafc', borderRadius: 8, padding: '10px', textAlign: 'center' }}>
                    <div style={{ fontWeight: 800, fontSize: 18, color: col }}>{count}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{opt} ({pct}%)</div>
                    <div style={{ height: 4, background: '#e2e8f0', borderRadius: 2, marginTop: 4 }}><div style={{ height: '100%', width: `${pct}%`, background: col, borderRadius: 2 }} /></div>
                  </div>
                )
              })}
            </div>
            {s.deadline && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>Deadline: {s.deadline} · {total} responses</div>}
          </div>
        )
      })}
      {slips.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No consent slips.</div>}
    </div>
  )
}

// ─── CALENDAR ─────────────────────────────────────────────────────────────────
function CalendarSection({ mobile }) {
  const [broadcasts, setBroadcasts] = useState([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(new Date())

  useEffect(() => {
    supabase.from('connect_broadcasts').select('id,title,audience,channel,priority,status,created_at,scheduled_date').then(({ data }) => { setBroadcasts(data || []); setLoading(false) })
  }, [])

  const year = month.getFullYear(), mon = month.getMonth()
  const firstDay = new Date(year, mon, 1).getDay()
  const daysInMonth = new Date(year, mon + 1, 0).getDate()
  const eventsOnDay = day => {
    const d = `${year}-${String(mon+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    return broadcasts.filter(b => (b.scheduled_date || b.created_at || '').slice(0,10) === d)
  }

  if (loading) return <Spinner />

  return (
    <div className="conn-animate">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <button className="conn-btn-ghost" style={{ padding: '7px 12px' }} onClick={() => setMonth(new Date(year, mon - 1))}>←</button>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#0f2744' }}>{month.toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</div>
        <button className="conn-btn-ghost" style={{ padding: '7px 12px' }} onClick={() => setMonth(new Date(year, mon + 1))}>→</button>
      </div>
      <div className="conn-card" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: '1px solid #e2e8f0' }}>
          {['S','M','T','W','T','F','S'].map((d,i) => <div key={i} style={{ padding: '8px 0', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>{d}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
          {Array.from({ length: firstDay }).map((_,i) => <div key={`e${i}`} style={{ minHeight: mobile ? 52 : 80, borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }} />)}
          {Array.from({ length: daysInMonth }).map((_,i) => {
            const day = i + 1
            const today = new Date()
            const isToday = today.getFullYear()===year && today.getMonth()===mon && today.getDate()===day
            const events = eventsOnDay(day)
            return (
              <div key={day} style={{ minHeight: mobile ? 52 : 80, padding: mobile ? '5px 4px' : '7px 5px', borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', background: isToday ? '#ebf2ff' : '#fff' }}>
                <div style={{ fontWeight: isToday ? 800 : 400, fontSize: 12, color: isToday ? '#1a56db' : '#334155', marginBottom: 3 }}>{day}</div>
                {events.slice(0, mobile ? 1 : 2).map(ev => (
                  <div key={ev.id} style={{ fontSize: 9, fontWeight: 600, padding: '1px 4px', borderRadius: 3, marginBottom: 2, background: { Urgent: '#fde8e8', Important: '#fffbeb', General: '#f1f5f9' }[ev.priority||'General'], color: { Urgent: '#c81e1e', Important: '#b45309', General: '#475569' }[ev.priority||'General'], whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {ev.title || ev.audience}
                  </div>
                ))}
                {events.length > (mobile ? 1 : 2) && <div style={{ fontSize: 9, color: '#94a3b8' }}>+{events.length - (mobile ? 1 : 2)}</div>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── ANALYTICS ────────────────────────────────────────────────────────────────
function AnalyticsSection({ mobile }) {
  const [data, setData] = useState({ broadcasts: [], messages: [] })
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState('30d')

  useEffect(() => {
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90
    const since = new Date(Date.now() - days * 864e5).toISOString()
    Promise.all([
      supabase.from('connect_broadcasts').select('channel,status,priority,audience,created_at,recipient_count').gte('created_at', since),
      supabase.from('connect_messages').select('channel,status,created_at').gte('created_at', since),
    ]).then(([b, m]) => { setData({ broadcasts: b.data || [], messages: m.data || [] }); setLoading(false) })
  }, [range])

  const all = [...data.broadcasts, ...data.messages]
  const byChannel = CHANNELS.map(c => ({ name: c, count: all.filter(r => r.channel === c).length })).filter(c => c.count > 0)
  const totalRecip = data.broadcasts.reduce((s, b) => s + (b.recipient_count || 0), 0)
  const sentCount = all.filter(r => r.status === 'Sent' || r.status === 'Delivered').length
  const maxBar = Math.max(...byChannel.map(c => c.count), 1)

  if (loading) return <Spinner />

  return (
    <div className="conn-animate">
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[['7d','7 Days'],['30d','30 Days'],['90d','90 Days']].map(([k,l]) => <button key={k} className={`conn-tab ${range === k ? 'active' : ''}`} onClick={() => setRange(k)}>{l}</button>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Total Sent', value: sentCount, icon: '📤', color: '#1a56db' },
          { label: 'Broadcasts', value: data.broadcasts.length, icon: '📡', color: '#7c3aed' },
          { label: 'Recipients', value: totalRecip, icon: '👥', color: '#057a55' },
          { label: 'Pending/Failed', value: all.filter(r => r.status === 'Pending' || r.status === 'Failed').length, icon: '⚠️', color: '#b45309' },
        ].map(s => (
          <div key={s.label} className="conn-card" style={{ padding: mobile ? '14px' : '18px 20px' }}>
            <div style={{ fontSize: 20 }}>{s.icon}</div>
            <div style={{ fontSize: mobile ? 22 : 26, fontWeight: 800, color: s.color, marginTop: 4 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div className="conn-card" style={{ padding: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14 }}>📊 Channel Breakdown</div>
        {byChannel.map(c => (
          <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 70, fontSize: 12, fontWeight: 600, color: '#334155' }}>{c.name}</div>
            <div style={{ flex: 1, height: 8, background: '#f1f5f9', borderRadius: 4 }}>
              <div style={{ height: '100%', width: `${(c.count / maxBar) * 100}%`, background: '#1a56db', borderRadius: 4 }} />
            </div>
            <div style={{ width: 28, fontSize: 12, fontWeight: 700, color: '#0f2744', textAlign: 'right' }}>{c.count}</div>
          </div>
        ))}
        {byChannel.length === 0 && <div style={{ color: '#94a3b8', fontSize: 13 }}>No data for this period.</div>}
      </div>
    </div>
  )
}

// ─── TEMPLATES ────────────────────────────────────────────────────────────────
function TemplatesSection({ isAdmin, mobile }) {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ template_name: '', category: 'Fee Reminder', channel: 'SMS', language: 'English', template_text: '' })
  const [saving, setSaving] = useState(false)

  const fetch = () => supabase.from('connect_templates').select('*').order('created_at', { ascending: false }).then(({ data }) => { setTemplates(data || []); setLoading(false) })
  useEffect(() => { fetch() }, [])

  const save = async () => {
    setSaving(true)
    const { error } = await supabase.from('connect_templates').insert([form])
    if (!error) { setForm({ template_name: '', category: 'Fee Reminder', channel: 'SMS', language: 'English', template_text: '' }); fetch() }
    else alert(error.message)
    setSaving(false)
  }
  const del = async (id) => { if (!window.confirm('Delete?')) return; await supabase.from('connect_templates').delete().eq('id', id); setTemplates(p => p.filter(t => t.id !== id)) }

  if (loading) return <Spinner />

  return (
    <div className="conn-animate">
      {isAdmin && (
        <div className="conn-card" style={{ padding: 18, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#0f2744', marginBottom: 12 }}>➕ New Template</div>
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div><label className="conn-label">Name *</label><input className="conn-inp" value={form.template_name} onChange={e => setForm(p => ({ ...p, template_name: e.target.value }))} /></div>
            <div><label className="conn-label">Category</label><select className="conn-inp" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
            <div><label className="conn-label">Channel</label><select className="conn-inp" value={form.channel} onChange={e => setForm(p => ({ ...p, channel: e.target.value }))}>{CHANNELS.map(c => <option key={c}>{c}</option>)}</select></div>
            <div><label className="conn-label">Language</label><select className="conn-inp" value={form.language} onChange={e => setForm(p => ({ ...p, language: e.target.value }))}>{LANGUAGES.map(l => <option key={l}>{l}</option>)}</select></div>
            <div style={{ gridColumn: '1/-1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <label className="conn-label" style={{ margin: 0 }}>Template Text</label>
                <SMSCounter text={form.template_text} channel={form.channel} />
              </div>
              <textarea className="conn-inp" rows={3} value={form.template_text} onChange={e => setForm(p => ({ ...p, template_text: e.target.value }))} />
            </div>
          </div>
          <button className="conn-btn-primary" disabled={!form.template_name || !form.template_text || saving} onClick={save}>{saving ? 'Saving…' : '💾 Save'}</button>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 12 }}>
        {templates.map(t => (
          <div key={t.id} className="conn-card" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{t.template_name}</div>
              {isAdmin && <button className="conn-btn-danger" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => del(t.id)}>✕</button>}
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              {channelBadge(t.channel)}
              <span className="conn-badge" style={{ background: '#f5f3ff', color: '#5b21b6' }}>{t.category}</span>
            </div>
            <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5, background: '#f8fafc', padding: '8px 10px', borderRadius: 6 }}>{t.template_text}</div>
          </div>
        ))}
        {templates.length === 0 && <div style={{ gridColumn: '1/-1', padding: 40, textAlign: 'center', color: '#94a3b8' }}>No templates yet.</div>}
      </div>
    </div>
  )
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
function SettingsSection({ quota, setQuota, mobile }) {
  const [dnd, setDnd] = useState({ start: '20:00', end: '07:00', enabled: true })
  const [saved, setSaved] = useState(false)
  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2000) }

  return (
    <div className="conn-animate">
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 16 }}>
        <div className="conn-card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#0f2744', marginBottom: 14 }}>🌙 Do Not Disturb</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13 }}>Enable DND window</span>
            <label className="conn-toggle"><input type="checkbox" checked={dnd.enabled} onChange={e => setDnd(p => ({ ...p, enabled: e.target.checked }))} /><span className="conn-toggle-slider" /></label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, opacity: dnd.enabled ? 1 : 0.4 }}>
            <div><label className="conn-label">Start</label><input type="time" className="conn-inp" value={dnd.start} onChange={e => setDnd(p => ({ ...p, start: e.target.value }))} disabled={!dnd.enabled} /></div>
            <div><label className="conn-label">End</label><input type="time" className="conn-inp" value={dnd.end} onChange={e => setDnd(p => ({ ...p, end: e.target.value }))} disabled={!dnd.enabled} /></div>
          </div>
        </div>
        <div className="conn-card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#0f2744', marginBottom: 14 }}>📊 Daily Quota</div>
          <label className="conn-label">Admin sends per day</label>
          <input type="number" className="conn-inp" value={quota} onChange={e => setQuota(Number(e.target.value))} min={1} />
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>Resets at midnight.</div>
        </div>
      </div>
      <button className="conn-btn-primary" style={{ marginTop: 16 }} onClick={save}>{saved ? '✓ Saved!' : '💾 Save Settings'}</button>
    </div>
  )
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function Connect({ currentUser, perms }) {
  const mobile = useMobile()
  const isAdmin = currentUser?.role === 'Admin'
  const [activeTab, setActiveTab] = useState('compose')
  const [quota, setQuota] = useState(200)
  const [quotaLeft, setQuotaLeft] = useState(200)
  const [unreadReplies, setUnreadReplies] = useState(0)
  const [openGrievances, setOpenGrievances] = useState(0)

  useEffect(() => {
    supabase.from('connect_replies').select('id', { count: 'exact', head: true }).eq('is_read', false).then(({ count }) => setUnreadReplies(count || 0))
    supabase.from('connect_grievances').select('id', { count: 'exact', head: true }).eq('status', 'Open').then(({ count }) => setOpenGrievances(count || 0))
  }, [activeTab])

  const visibleTabs = NAV_TABS.filter(t => t.id !== 'settings' || isAdmin)

  const notifBadge = (id) => {
    if (id === 'inbox' && unreadReplies > 0) return unreadReplies
    if (id === 'grievance' && openGrievances > 0) return openGrievances
    return 0
  }

  const currentTabLabel = NAV_TABS.find(t => t.id === activeTab)

  const renderSection = () => {
    const props = { isAdmin, mobile }
    if (activeTab === 'compose')    return <ComposeSection   {...props} currentUser={currentUser} quotaLeft={quotaLeft} setQuotaLeft={setQuotaLeft} />
    if (activeTab === 'broadcasts') return <BroadcastsSection {...props} />
    if (activeTab === 'inbox')      return <InboxSection {...props} />
    if (activeTab === 'grievance')  return <GrievanceSection {...props} />
    if (activeTab === 'consent')    return <ConsentSection {...props} />
    if (activeTab === 'calendar')   return <CalendarSection {...props} />
    if (activeTab === 'analytics')  return <AnalyticsSection {...props} />
    if (activeTab === 'templates')  return <TemplatesSection {...props} />
    if (activeTab === 'settings' && isAdmin) return <SettingsSection quota={quota} setQuota={setQuota} mobile={mobile} />
    return null
  }

  return (
    <div style={{ display: 'flex', flexDirection: mobile ? 'column' : 'row', minHeight: '100vh', background: '#f8fafc', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{CSS}</style>

      {/* Desktop sidebar */}
      {!mobile && (
        <div style={{ width: 220, background: '#fff', borderRight: '1px solid #e2e8f0', padding: '20px 12px', flexShrink: 0 }}>
          <div style={{ padding: '0 6px 16px', borderBottom: '1px solid #f1f5f9', marginBottom: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#0f2744' }}>🔗 Connect</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>GNSI Communication Hub</div>
          </div>
          {visibleTabs.map(t => {
            const n = notifBadge(t.id)
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: activeTab === t.id ? 700 : 500, display: 'flex', alignItems: 'center', gap: 10, borderRadius: 8, marginBottom: 2, background: activeTab === t.id ? '#ebf2ff' : 'transparent', color: activeTab === t.id ? '#1a56db' : '#334155', transition: 'all .15s' }}>
                <span>{t.icon}</span>
                <span style={{ flex: 1 }}>{t.label}</span>
                {n > 0 && <span style={{ background: t.id === 'inbox' ? '#c81e1e' : '#b45309', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>{n}</span>}
              </button>
            )
          })}
          <div style={{ marginTop: 16, padding: '12px 10px', background: '#f8fafc', borderRadius: 8, fontSize: 11, color: '#64748b' }}>
            <strong style={{ color: '#334155' }}>Quota</strong><br />
            <span style={{ fontWeight: 800, fontSize: 18, color: quotaLeft < 20 ? '#c81e1e' : '#057a55' }}>{quotaLeft}</span> / {quota}
          </div>
        </div>
      )}

      {/* Mobile top nav — horizontal scroll */}
      {mobile && (
        <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ padding: '12px 14px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#0f2744' }}>🔗 Connect</div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>GNSI Communication Hub</div>
            </div>
            <div style={{ fontSize: 11, color: quotaLeft < 20 ? '#c81e1e' : '#057a55', fontWeight: 700 }}>Quota: {quotaLeft}/{quota}</div>
          </div>
          <div className="conn-mob-nav">
            {visibleTabs.map(t => {
              const n = notifBadge(t.id)
              return (
                <button key={t.id} className={`conn-mob-nav-btn ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
                  {n > 0 && <span style={{ position: 'absolute', top: 4, right: 4, width: 14, height: 14, borderRadius: '50%', background: '#c81e1e', color: '#fff', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{n}</span>}
                  <span className="icon">{t.icon}</span>
                  <span className="label">{t.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, padding: mobile ? '16px 12px' : '24px 28px', overflowY: 'auto' }}>
        {!mobile && (
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0f2744' }}>{currentTabLabel?.icon} {currentTabLabel?.label}</h1>
            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>GNSI Portal · Khangabok, Manipur</p>
          </div>
        )}
        {renderSection()}
      </div>
    </div>
  )
}