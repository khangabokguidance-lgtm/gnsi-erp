import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { supabase } from './supabase'

// ─── CONSTANTS ────────────────────────────────────────────────
const CHANNELS   = ['SMS', 'Email', 'WhatsApp', 'Portal']
const AUDIENCES  = ['All', 'Parents', 'Students', 'Teachers', 'Staff', 'Fee Defaulters', 'Absent Today', 'Hostel Students']
const LANGUAGES  = ['English', 'Hindi', 'Meitei']
const PRIORITIES = ['Urgent', 'Important', 'General']
const CATEGORIES = ['Fee Reminder','Absence Alert','Exam Notice','Holiday Notice','PTM Invitation','Birthday','Emergency','General']
const ROLES      = ['Teacher','Staff','Faculty','House Master','Accountant','Computer Staffs','Administrator','Hostel Supervisor','Superintendent','Non Teaching Staffs','Receptionist']

const NAV_TABS = [
  { id: 'compose',    icon: '✏️',  label: 'Compose'         },
  { id: 'broadcasts', icon: '📡',  label: 'Broadcasts'      },
  { id: 'inbox',      icon: '📨',  label: 'Two-Way Inbox'   },
  { id: 'grievance',  icon: '🗂️',  label: 'Grievances'      },
  { id: 'consent',    icon: '✅',  label: 'Consent Slips'   },
  { id: 'calendar',   icon: '📅',  label: 'Comm. Calendar'  },
  { id: 'analytics',  icon: '📊',  label: 'Analytics'       },
  { id: 'templates',  icon: '📝',  label: 'Templates'       },
  { id: 'settings',   icon: '⚙️',  label: 'Settings'        },
]

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; }
  :root {
    --navy: #0f2744;
    --blue: #1a56db;
    --blue-light: #ebf2ff;
    --blue-mid: #c7d7f9;
    --green: #057a55;
    --green-light: #e3fcef;
    --red: #c81e1e;
    --red-light: #fde8e8;
    --amber: #b45309;
    --amber-light: #fffbeb;
    --gray-50: #f8fafc;
    --gray-100: #f1f5f9;
    --gray-200: #e2e8f0;
    --gray-300: #cbd5e1;
    --gray-400: #94a3b8;
    --gray-500: #64748b;
    --gray-700: #334155;
    --gray-900: #0f172a;
    --radius: 10px;
    --shadow: 0 1px 4px rgba(0,0,0,.08), 0 4px 16px rgba(0,0,0,.06);
  }
  .conn-sidebar-btn { width:100%;text-align:left;padding:10px 18px;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;display:flex;align-items:center;gap:10px;border-radius:8px;margin-bottom:2px;transition:all .15s; }
  .conn-sidebar-btn:hover { background: var(--blue-light); }
  .conn-sidebar-btn.active { background: var(--blue-light); color: var(--blue); font-weight:700; }
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
  .conn-tab { padding:7px 16px;border-radius:8px;border:1.5px solid var(--gray-200);background:#fff;font-family:'DM Sans',sans-serif;font-size:12px;font-weight:500;cursor:pointer;transition:all .15s;white-space:nowrap; }
  .conn-tab.active { background:var(--blue-light);color:var(--blue);border-color:var(--blue-mid);font-weight:700; }
  .conn-badge { display:inline-flex;align-items:center;gap:4px;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700; }
  .conn-table { width:100%;border-collapse:collapse;font-size:13px; }
  .conn-table th { padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:var(--gray-500);text-transform:uppercase;letter-spacing:.04em;background:var(--gray-50);border-bottom:1px solid var(--gray-200); }
  .conn-table td { padding:12px 14px;border-bottom:1px solid var(--gray-100);color:var(--gray-700); }
  .conn-table tr:last-child td { border-bottom:none; }
  .conn-table tr:hover td { background:var(--gray-50); }
  .conn-check { width:16px;height:16px;accent-color:var(--blue);cursor:pointer; }
  .conn-toggle { position:relative;display:inline-block;width:36px;height:20px; }
  .conn-toggle input { opacity:0;width:0;height:0; }
  .conn-toggle-slider { position:absolute;inset:0;background:var(--gray-300);border-radius:20px;cursor:pointer;transition:.2s; }
  .conn-toggle input:checked + .conn-toggle-slider { background:var(--blue); }
  .conn-toggle-slider:before { content:'';position:absolute;width:14px;height:14px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.2s; }
  .conn-toggle input:checked + .conn-toggle-slider:before { transform:translateX(16px); }
  @keyframes conn-fadein { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
  .conn-animate { animation:conn-fadein .2s ease; }
  @keyframes conn-pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
  .conn-pulse { animation:conn-pulse 1.5s infinite; }
  .conn-emergency-btn { background:linear-gradient(135deg,#dc2626,#991b1b);color:#fff;border:none;padding:12px 28px;border-radius:10px;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:800;cursor:pointer;letter-spacing:.02em;box-shadow:0 4px 14px rgba(220,38,38,.4);transition:all .2s; }
  .conn-emergency-btn:hover { transform:translateY(-1px);box-shadow:0 6px 20px rgba(220,38,38,.5); }
  .sms-counter { font-family:'DM Mono',monospace;font-size:11px;color:var(--gray-500); }
  .sms-counter.warn { color:var(--amber); }
  .sms-counter.danger { color:var(--red); }
`

// ─── HELPERS ──────────────────────────────────────────────────
function Spinner() {
  return <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>⏳ Loading…</div>
}

function priorityBadge(p) {
  const map = {
    Urgent:    { bg: '#fde8e8', color: '#c81e1e', dot: '#c81e1e' },
    Important: { bg: '#fffbeb', color: '#b45309', dot: '#f59e0b' },
    General:   { bg: '#f1f5f9', color: '#475569', dot: '#94a3b8' },
  }
  const s = map[p] || map.General
  return (
    <span className="conn-badge" style={{ background: s.bg, color: s.color }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, display: 'inline-block' }} />
      {p}
    </span>
  )
}

function channelBadge(c) {
  const map = {
    SMS:      { bg: '#e3fcef', color: '#057a55' },
    Email:    { bg: '#ebf2ff', color: '#1a56db' },
    WhatsApp: { bg: '#ecfdf5', color: '#065f46' },
    Portal:   { bg: '#f5f3ff', color: '#5b21b6' },
  }
  const s = map[c] || { bg: '#f1f5f9', color: '#475569' }
  return <span className="conn-badge" style={{ background: s.bg, color: s.color }}>{c}</span>
}

function statusBadge(s) {
  const map = {
    Sent:        { bg: '#e3fcef', color: '#057a55' },
    Delivered:   { bg: '#e3fcef', color: '#057a55' },
    Pending:     { bg: '#fffbeb', color: '#b45309' },
    Scheduled:   { bg: '#ebf2ff', color: '#1a56db' },
    Failed:      { bg: '#fde8e8', color: '#c81e1e' },
    Cancelled:   { bg: '#f1f5f9', color: '#475569' },
    Open:        { bg: '#fde8e8', color: '#c81e1e' },
    'In Progress':{ bg: '#fffbeb', color: '#b45309' },
    Resolved:    { bg: '#e3fcef', color: '#057a55' },
    Active:      { bg: '#e3fcef', color: '#057a55' },
    Inactive:    { bg: '#f1f5f9', color: '#475569' },
  }
  const st = map[s] || { bg: '#f1f5f9', color: '#475569' }
  return <span className="conn-badge" style={{ background: st.bg, color: st.color }}>{s}</span>
}

function fmt(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

function SMSCounter({ text, channel }) {
  if (channel !== 'SMS') return null
  const len = (text || '').length
  const msgs = Math.ceil(len / 160) || 1
  const cls = len > 320 ? 'danger' : len > 160 ? 'warn' : ''
  return (
    <span className={`sms-counter ${cls}`}>
      {len} chars · {msgs} SMS{msgs > 1 ? 'es' : ''} · ~₹{(msgs * 0.20).toFixed(2)}/recipient
    </span>
  )
}

// ─── COMPOSE (Bulk Message Sender) ────────────────────────────
function ComposeSection({ currentUser, quotaLeft, setQuotaLeft }) {
  const [form, setForm] = useState({
    title: '', audience: 'All', role_filter: '', channel: 'SMS',
    priority: 'General', language: 'English', message_body: '',
    scheduled_date: '', scheduled_time: '', use_template: false,
    attach_url: '', is_emergency: false,
  })
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

  // Live recipient count estimate
  useEffect(() => {
    const estimateCount = async () => {
      if (form.audience === 'Fee Defaulters') { setRecipientCount('~varies'); return }
      if (form.audience === 'Absent Today')   { setRecipientCount('~varies'); return }
      let q = supabase.from('portal_users').select('id', { count: 'exact', head: true }).eq('active', true)
      if (form.audience !== 'All') {
        if (form.audience === 'Teachers') q = q.eq('role', 'Teacher')
        else if (form.audience === 'Staff') q = q.eq('role', 'Staff')
        else if (form.audience === 'Parents') { setRecipientCount('~all parents'); return }
      }
      if (form.role_filter) q = q.eq('role', form.role_filter)
      const { count } = await q
      setRecipientCount(count ?? 0)
    }
    estimateCount()
  }, [form.audience, form.role_filter])

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const applyTemplate = (tpl) => {
    f('message_body', tpl.template_text)
    f('channel', tpl.channel)
  }

  const sendKey = `${form.audience}|${form.channel}|${form.message_body?.slice(0,40)}`

  const handleSend = async () => {
    if (quotaLeft <= 0) { alert('Daily quota exhausted. Ask admin to reset.'); return }
    // Duplicate guard
    if (lastSentKey === sendKey) { setDupWarn(true); return }
    setSending(true)
    const payload = {
      title: form.title || form.message_body.slice(0, 40),
      audience: form.audience, channel: form.channel,
      priority: form.priority, language: form.language,
      message_body: form.message_body, status: form.scheduled_date ? 'Scheduled' : 'Sent',
      scheduled_date: form.scheduled_date || null,
      attach_url: form.attach_url || null,
      is_emergency: form.is_emergency,
      sent_by: currentUser?.username ?? 'Admin',
      recipient_count: typeof recipientCount === 'number' ? recipientCount : null,
    }
    const { error } = await supabase.from('connect_broadcasts').insert([payload])
    if (!error) {
      setLastSentKey(sendKey)
      setQuotaLeft(q => q - 1)
      setSent(true)
      setForm(p => ({ ...p, title: '', message_body: '', scheduled_date: '', scheduled_time: '', attach_url: '', is_emergency: false }))
      setTimeout(() => setSent(false), 3000)
    } else alert(error.message)
    setSending(false)
    setShowConfirm(false)
  }

  const isScheduled = !!form.scheduled_date

  return (
    <div className="conn-animate">
      <style>{CSS}</style>

      {/* Emergency banner */}
      <div style={{ background: 'linear-gradient(135deg,#fff1f2,#fee2e2)', border: '1px solid #fca5a5', borderRadius: 12, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#991b1b' }}>🚨 Emergency Alert</div>
          <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 2 }}>Broadcasts to ALL via ALL channels simultaneously. Requires double confirmation.</div>
        </div>
        <button className="conn-emergency-btn" onClick={() => { f('is_emergency', true); f('priority', 'Urgent'); f('audience', 'All'); setShowConfirm(true) }}>
          🚨 Send Emergency Alert
        </button>
      </div>

      {sent && <div style={{ padding: '12px 18px', background: '#e3fcef', border: '1px solid #a7f3d0', borderRadius: 10, color: '#065f46', fontWeight: 600, fontSize: 13, marginBottom: 16 }}>✅ Message sent successfully!</div>}
      {dupWarn && (
        <div style={{ padding: '12px 18px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, color: '#92400e', fontSize: 13, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          ⚠️ Duplicate detected — same message sent to this group recently. Send anyway?
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="conn-btn-ghost" style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => setDupWarn(false)}>Cancel</button>
            <button className="conn-btn-primary" style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => { setDupWarn(false); setLastSentKey(null); setShowConfirm(true) }}>Send Anyway</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
        {/* Main compose */}
        <div className="conn-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#0f2744' }}>✏️ Compose Message</div>
            <div style={{ fontSize: 12, color: quotaLeft < 10 ? '#c81e1e' : '#64748b', fontWeight: 600 }}>
              Daily quota: <strong>{quotaLeft}</strong> remaining
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label className="conn-label">Message Title (optional)</label>
              <input className="conn-inp" placeholder="e.g. Fee Reminder - March 2025" value={form.title} onChange={e => f('title', e.target.value)} />
            </div>

            <div>
              <label className="conn-label">Audience Group</label>
              <select className="conn-inp" value={form.audience} onChange={e => f('audience', e.target.value)}>
                {AUDIENCES.map(a => <option key={a}>{a}</option>)}
              </select>
              {form.audience === 'Fee Defaulters' && <div style={{ fontSize: 11, color: '#b45309', marginTop: 4 }}>⚡ Auto-pulls from fee records</div>}
              {form.audience === 'Absent Today' && <div style={{ fontSize: 11, color: '#b45309', marginTop: 4 }}>⚡ Auto-pulls from today's attendance</div>}
            </div>

            <div>
              <label className="conn-label">Filter by Role (optional)</label>
              <select className="conn-inp" value={form.role_filter} onChange={e => f('role_filter', e.target.value)}>
                <option value="">All roles in group</option>
                {ROLES.map(r => <option key={r}>{r}</option>)}
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

            <div>
              <label className="conn-label">Schedule Date (leave blank to send now)</label>
              <input type="date" className="conn-inp" value={form.scheduled_date} onChange={e => f('scheduled_date', e.target.value)} min={new Date().toISOString().split('T')[0]} />
            </div>

            {isScheduled && (
              <div>
                <label className="conn-label">Schedule Time</label>
                <input type="time" className="conn-inp" value={form.scheduled_time} onChange={e => f('scheduled_time', e.target.value)} />
              </div>
            )}

            <div style={{ gridColumn: '1/-1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <label className="conn-label" style={{ margin: 0 }}>Message Body</label>
                <SMSCounter text={form.message_body} channel={form.channel} />
              </div>
              <textarea className="conn-inp" rows={5} placeholder={form.channel === 'WhatsApp' ? 'Supports *bold*, _italic_, emojis 👍' : 'Type your message…'} value={form.message_body} onChange={e => f('message_body', e.target.value)} style={{ resize: 'vertical' }} />
            </div>

            <div style={{ gridColumn: '1/-1' }}>
              <label className="conn-label">Attachment URL (PDF/Image link, optional)</label>
              <input className="conn-inp" placeholder="https://…" value={form.attach_url} onChange={e => f('attach_url', e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 20, alignItems: 'center' }}>
            <button className="conn-btn-primary" disabled={!form.message_body || sending} onClick={() => setShowConfirm(true)}>
              {isScheduled ? '🗓️ Schedule Message' : '📤 Send Now'}
            </button>
            <button className="conn-btn-ghost" onClick={() => setForm(p => ({ ...p, message_body: '', title: '' }))}>Clear</button>
            {recipientCount !== null && (
              <span style={{ marginLeft: 'auto', fontSize: 13, color: '#334155' }}>
                📬 <strong>{recipientCount}</strong> recipients
              </span>
            )}
          </div>
        </div>

        {/* Template picker sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="conn-card" style={{ padding: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#0f2744', marginBottom: 12 }}>📝 Use Template</div>
            {templates.length === 0 ? (
              <div style={{ fontSize: 12, color: '#94a3b8' }}>No templates yet. Create in Templates tab.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {templates.map(t => (
                  <div key={t.id} onClick={() => applyTemplate(t)} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'all .15s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#1a56db'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: '#0f2744' }}>{t.template_name}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{t.category} · {t.channel}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="conn-card" style={{ padding: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#0f2744', marginBottom: 10 }}>⚙️ Message Options</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Require Acknowledgement', key: 'need_ack' },
                { label: 'Send Read Receipt to admin', key: 'read_receipt' },
                { label: 'Allow replies', key: 'allow_reply' },
              ].map(opt => (
                <div key={opt.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#334155' }}>{opt.label}</span>
                  <label className="conn-toggle">
                    <input type="checkbox" />
                    <span className="conn-toggle-slider" />
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Confirm modal */}
      {showConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div className="conn-card" style={{ width: 420, padding: 28 }}>
            {form.is_emergency ? (
              <>
                <div style={{ fontSize: 28, textAlign: 'center', marginBottom: 10 }}>🚨</div>
                <div style={{ fontWeight: 800, fontSize: 18, color: '#c81e1e', textAlign: 'center', marginBottom: 6 }}>EMERGENCY ALERT</div>
                <div style={{ fontSize: 13, color: '#374151', textAlign: 'center', marginBottom: 20 }}>This will blast ALL recipients via ALL channels immediately. This action is permanent and logged.</div>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#0f2744', marginBottom: 6 }}>📤 Confirm Send</div>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>Review before sending:</div>
              </>
            )}
            <div style={{ background: '#f8fafc', borderRadius: 8, padding: 14, marginBottom: 20, fontSize: 13, lineHeight: 1.7 }}>
              <div><strong>To:</strong> {form.audience}{form.role_filter ? ` (${form.role_filter})` : ''}</div>
              <div><strong>Via:</strong> {form.is_emergency ? 'ALL CHANNELS' : form.channel}</div>
              <div><strong>Priority:</strong> {form.priority}</div>
              <div><strong>Recipients:</strong> {form.is_emergency ? 'Everyone' : recipientCount ?? '…'}</div>
              {isScheduled && <div><strong>Scheduled:</strong> {form.scheduled_date} {form.scheduled_time}</div>}
              <div style={{ marginTop: 8, padding: '8px 10px', background: '#fff', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12 }}>{form.message_body}</div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="conn-btn-ghost" onClick={() => { setShowConfirm(false); f('is_emergency', false) }}>Cancel</button>
              <button disabled={sending} onClick={handleSend} style={{ padding: '10px 22px', borderRadius: 8, border: 'none', background: form.is_emergency ? '#dc2626' : '#0f2744', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                {sending ? '⏳ Sending…' : form.is_emergency ? '🚨 CONFIRM EMERGENCY SEND' : isScheduled ? '🗓️ Schedule' : '📤 Confirm Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── BROADCASTS HISTORY ───────────────────────────────────────
function BroadcastsSection() {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('All')
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    supabase.from('connect_broadcasts').select('*').order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => { setRows(data || []); setLoading(false) })
  }, [])

  const filtered = filter === 'All' ? rows : rows.filter(r => r.status === filter || r.priority === filter || r.channel === filter)

  const del = async (id) => {
    if (!window.confirm('Delete this broadcast?')) return
    await supabase.from('connect_broadcasts').delete().eq('id', id)
    setRows(p => p.filter(r => r.id !== id))
  }

  if (loading) return <Spinner />

  return (
    <div className="conn-animate">
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {['All','Sent','Scheduled','Cancelled','Urgent','Important'].map(f => (
          <button key={f} className={`conn-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8', alignSelf: 'center' }}>{filtered.length} records</span>
      </div>
      <div className="conn-card" style={{ overflow: 'hidden' }}>
        <table className="conn-table">
          <thead><tr><th>Title</th><th>Audience</th><th>Channel</th><th>Priority</th><th>Status</th><th>Sent By</th><th>Date</th><th></th></tr></thead>
          <tbody>
            {filtered.map(r => (
              <>
                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                  <td style={{ fontWeight: 600 }}>{r.title || r.message_body?.slice(0, 40) || '—'}</td>
                  <td>{r.audience}</td>
                  <td>{channelBadge(r.channel)}</td>
                  <td>{priorityBadge(r.priority || 'General')}</td>
                  <td>{statusBadge(r.status)}</td>
                  <td style={{ fontSize: 12, color: '#94a3b8' }}>{r.sent_by || 'Admin'}</td>
                  <td style={{ fontSize: 12, color: '#94a3b8' }}>{fmt(r.created_at)}</td>
                  <td><button className="conn-btn-danger" onClick={e => { e.stopPropagation(); del(r.id) }}>Delete</button></td>
                </tr>
                {expanded === r.id && (
                  <tr key={`${r.id}-exp`}>
                    <td colSpan={8} style={{ background: '#f8fafc', padding: '16px 20px' }}>
                      <div style={{ fontSize: 13, color: '#334155', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{r.message_body}</div>
                      {r.attach_url && <a href={r.attach_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#1a56db', marginTop: 8, display: 'inline-block' }}>📎 View Attachment</a>}
                      {r.recipient_count && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>📬 Sent to {r.recipient_count} recipients</div>}
                    </td>
                  </tr>
                )}
              </>
            ))}
            {filtered.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>No broadcasts found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── TWO-WAY INBOX ────────────────────────────────────────────
// SQL: CREATE TABLE connect_replies (id bigserial PRIMARY KEY, broadcast_id bigint, sender_name text, sender_role text, message text, is_read boolean DEFAULT false, created_at timestamptz DEFAULT now());
function InboxSection() {
  const [replies, setReplies] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('all')
  const [reply, setReply]     = useState({})

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
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <button className={`conn-tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All Replies</button>
        <button className={`conn-tab ${filter === 'unread' ? 'active' : ''}`} onClick={() => setFilter('unread')}>
          Unread {replies.filter(r => !r.is_read).length > 0 && <span style={{ marginLeft: 4, background: '#c81e1e', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10 }}>{replies.filter(r => !r.is_read).length}</span>}
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(r => (
          <div key={r.id} className="conn-card" style={{ padding: '16px 20px', borderLeft: r.is_read ? '3px solid #e2e8f0' : '3px solid #1a56db', opacity: r.is_read ? .85 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{r.sender_name} <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: 12 }}>({r.sender_role})</span></div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>{fmt(r.created_at)}</span>
                {!r.is_read && <button className="conn-btn-ghost" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => markRead(r.id)}>Mark Read</button>}
              </div>
            </div>
            <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.6 }}>{r.message}</div>
            <div style={{ marginTop: 10 }}>
              <textarea className="conn-inp" rows={2} placeholder="Type admin reply…" value={reply[r.id] || ''} onChange={e => setReply(p => ({ ...p, [r.id]: e.target.value }))} style={{ fontSize: 12, marginBottom: 6 }} />
              <button className="conn-btn-primary" style={{ fontSize: 12, padding: '6px 14px' }}>Send Reply</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No replies yet.</div>}
      </div>
    </div>
  )
}

// ─── GRIEVANCE CHANNEL ────────────────────────────────────────
// SQL: CREATE TABLE connect_grievances (id bigserial PRIMARY KEY, ticket_no text UNIQUE, sender_name text, sender_role text, subject text, message text, status text DEFAULT 'Open', admin_note text, created_at timestamptz DEFAULT now());
function GrievanceSection() {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('Open')
  const [note, setNote]       = useState({})

  useEffect(() => {
    supabase.from('connect_grievances').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setRows(data || []); setLoading(false) })
  }, [])

  const updateStatus = async (id, status, adminNote) => {
    await supabase.from('connect_grievances').update({ status, admin_note: adminNote || null }).eq('id', id)
    setRows(p => p.map(r => r.id === id ? { ...r, status, admin_note: adminNote } : r))
  }

  const filtered = filter === 'All' ? rows : rows.filter(r => r.status === filter)
  if (loading) return <Spinner />

  return (
    <div className="conn-animate">
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {['All','Open','In Progress','Resolved'].map(f => (
          <button key={f} className={`conn-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(r => (
          <div key={r.id} className="conn-card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <span style={{ fontFamily: 'DM Mono', fontSize: 11, background: '#f1f5f9', padding: '2px 8px', borderRadius: 4, color: '#475569', marginRight: 8 }}>{r.ticket_no || `TKT-${r.id}`}</span>
                <strong style={{ fontSize: 14 }}>{r.subject}</strong>
              </div>
              {statusBadge(r.status)}
            </div>
            <div style={{ fontSize: 13, color: '#334155', marginBottom: 8 }}>{r.message}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>From: {r.sender_name} ({r.sender_role}) · {fmt(r.created_at)}</div>
            {r.admin_note && <div style={{ fontSize: 12, background: '#f0f9ff', padding: '8px 12px', borderRadius: 6, color: '#0369a1', marginBottom: 10 }}>Admin note: {r.admin_note}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="conn-inp" placeholder="Admin note…" value={note[r.id] || ''} onChange={e => setNote(p => ({ ...p, [r.id]: e.target.value }))} style={{ fontSize: 12, flex: 1 }} />
              <button className="conn-btn-ghost" style={{ fontSize: 12 }} onClick={() => updateStatus(r.id, 'In Progress', note[r.id])}>In Progress</button>
              <button className="conn-btn-primary" style={{ fontSize: 12, background: '#057a55' }} onClick={() => updateStatus(r.id, 'Resolved', note[r.id])}>✓ Resolve</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No grievances in this category.</div>}
      </div>
    </div>
  )
}

// ─── CONSENT SLIPS ────────────────────────────────────────────
// SQL: CREATE TABLE connect_consent (id bigserial PRIMARY KEY, title text, description text, options text[], deadline date, status text DEFAULT 'Active', responses jsonb DEFAULT '{}', created_at timestamptz DEFAULT now());
function ConsentSection() {
  const [slips, setSlips]   = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm]     = useState({ title: '', description: '', options: 'Yes,No,Maybe', deadline: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('connect_consent').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setSlips(data || []); setLoading(false) })
  }, [])

  const create = async () => {
    setSaving(true)
    const payload = { title: form.title, description: form.description, options: form.options.split(',').map(s => s.trim()), deadline: form.deadline || null, status: 'Active', responses: {} }
    const { error } = await supabase.from('connect_consent').insert([payload])
    if (!error) {
      setSlips(p => [{ ...payload, id: Date.now(), created_at: new Date().toISOString() }, ...p])
      setForm({ title: '', description: '', options: 'Yes,No,Maybe', deadline: '' })
    }
    setSaving(false)
  }

  if (loading) return <Spinner />

  return (
    <div className="conn-animate">
      <div className="conn-card" style={{ padding: 22, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#0f2744', marginBottom: 16 }}>➕ Create Consent Slip</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ gridColumn: '1/-1' }}>
            <label className="conn-label">Title *</label>
            <input className="conn-inp" placeholder="e.g. Annual Sports Day Trip Permission" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label className="conn-label">Description</label>
            <textarea className="conn-inp" rows={3} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div>
            <label className="conn-label">Response Options (comma-separated)</label>
            <input className="conn-inp" value={form.options} onChange={e => setForm(p => ({ ...p, options: e.target.value }))} />
          </div>
          <div>
            <label className="conn-label">Response Deadline</label>
            <input type="date" className="conn-inp" value={form.deadline} onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))} />
          </div>
        </div>
        <button className="conn-btn-primary" style={{ marginTop: 14 }} disabled={!form.title || saving} onClick={create}>
          {saving ? 'Creating…' : '✅ Create Consent Slip'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {slips.map(s => {
          const resp = s.responses || {}
          const total = Object.values(resp).reduce((a, b) => a + b, 0)
          return (
            <div key={s.id} className="conn-card" style={{ padding: '18px 22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{s.title}</div>
                {statusBadge(s.status || 'Active')}
              </div>
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>{s.description}</div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
                {(s.options || ['Yes','No','Maybe']).map(opt => {
                  const count = resp[opt] || 0
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0
                  const colors = { Yes: '#057a55', No: '#c81e1e', Maybe: '#b45309' }
                  const col = colors[opt] || '#1a56db'
                  return (
                    <div key={opt} style={{ flex: '1 1 120px', background: '#f8fafc', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
                      <div style={{ fontWeight: 700, fontSize: 20, color: col }}>{count}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{opt} ({pct}%)</div>
                      <div style={{ height: 4, background: '#e2e8f0', borderRadius: 2, marginTop: 6 }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: col, borderRadius: 2 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                {s.deadline && `Deadline: ${s.deadline} · `}Total responses: {total}
              </div>
            </div>
          )
        })}
        {slips.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No consent slips yet.</div>}
      </div>
    </div>
  )
}

// ─── COMMUNICATION CALENDAR ───────────────────────────────────
function CalendarSection() {
  const [broadcasts, setBroadcasts] = useState([])
  const [loading, setLoading]       = useState(true)
  const [month, setMonth]           = useState(new Date())

  useEffect(() => {
    supabase.from('connect_broadcasts').select('id,title,audience,channel,priority,status,created_at,scheduled_date')
      .then(({ data }) => { setBroadcasts(data || []); setLoading(false) })
  }, [])

  const year = month.getFullYear()
  const mon  = month.getMonth()
  const firstDay = new Date(year, mon, 1).getDay()
  const daysInMonth = new Date(year, mon + 1, 0).getDate()

  const eventsOnDay = (day) => {
    const d = `${year}-${String(mon+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    return broadcasts.filter(b => {
      const bd = (b.scheduled_date || b.created_at || '').slice(0,10)
      return bd === d
    })
  }

  const monthName = month.toLocaleString('en-IN', { month: 'long', year: 'numeric' })
  const today = new Date()

  if (loading) return <Spinner />

  return (
    <div className="conn-animate">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <button className="conn-btn-ghost" onClick={() => setMonth(new Date(year, mon - 1))}>← Prev</button>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#0f2744' }}>{monthName}</div>
        <button className="conn-btn-ghost" onClick={() => setMonth(new Date(year, mon + 1))}>Next →</button>
      </div>
      <div className="conn-card" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: '1px solid #e2e8f0' }}>
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
            <div key={d} style={{ padding: '10px 0', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '.04em' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} style={{ minHeight: 90, borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const isToday = today.getFullYear() === year && today.getMonth() === mon && today.getDate() === day
            const events = eventsOnDay(day)
            return (
              <div key={day} style={{ minHeight: 90, padding: '8px 6px', borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', background: isToday ? '#ebf2ff' : '#fff' }}>
                <div style={{ fontWeight: isToday ? 800 : 400, fontSize: 13, color: isToday ? '#1a56db' : '#334155', marginBottom: 4 }}>{day}</div>
                {events.slice(0,3).map(ev => {
                  const pColors = { Urgent: '#fde8e8', Important: '#fffbeb', General: '#f1f5f9' }
                  const pText   = { Urgent: '#c81e1e', Important: '#b45309', General: '#475569' }
                  return (
                    <div key={ev.id} style={{ fontSize: 10, fontWeight: 600, padding: '2px 5px', borderRadius: 4, marginBottom: 2, background: pColors[ev.priority || 'General'], color: pText[ev.priority || 'General'], whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={ev.title || ev.audience}>
                      {ev.title || ev.audience}
                    </div>
                  )
                })}
                {events.length > 3 && <div style={{ fontSize: 10, color: '#94a3b8' }}>+{events.length - 3} more</div>}
              </div>
            )
          })}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 14, fontSize: 12 }}>
        {[['Urgent','#fde8e8','#c81e1e'],['Important','#fffbeb','#b45309'],['General','#f1f5f9','#475569']].map(([label,bg,color]) => (
          <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: bg, border: `1px solid ${color}` }} />
            <span style={{ color: '#64748b' }}>{label}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── ANALYTICS ────────────────────────────────────────────────
function AnalyticsSection() {
  const [data, setData]     = useState({ broadcasts: [], messages: [] })
  const [loading, setLoading] = useState(true)
  const [range, setRange]   = useState('30d')

  useEffect(() => {
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90
    const since = new Date(Date.now() - days * 864e5).toISOString()
    Promise.all([
      supabase.from('connect_broadcasts').select('channel,status,priority,audience,created_at,recipient_count').gte('created_at', since),
      supabase.from('connect_messages').select('channel,status,created_at').gte('created_at', since),
    ]).then(([b, m]) => {
      setData({ broadcasts: b.data || [], messages: m.data || [] })
      setLoading(false)
    })
  }, [range])

  const all = [...data.broadcasts, ...data.messages]
  const byChannel = CHANNELS.map(c => ({ name: c, count: all.filter(r => r.channel === c).length })).filter(c => c.count > 0)
  const byAudience = AUDIENCES.map(a => ({ name: a, count: data.broadcasts.filter(r => r.audience === a).length })).filter(a => a.count > 0)
  const totalRecip = data.broadcasts.reduce((s, b) => s + (b.recipient_count || 0), 0)
  const sentCount  = all.filter(r => r.status === 'Sent' || r.status === 'Delivered').length
  const maxBar = Math.max(...byChannel.map(c => c.count), 1)

  if (loading) return <Spinner />

  return (
    <div className="conn-animate">
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[['7d','7 Days'],['30d','30 Days'],['90d','90 Days']].map(([k,l]) => (
          <button key={k} className={`conn-tab ${range === k ? 'active' : ''}`} onClick={() => setRange(k)}>{l}</button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Total Sent', value: sentCount, icon: '📤', color: '#1a56db' },
          { label: 'Broadcasts', value: data.broadcasts.length, icon: '📡', color: '#7c3aed' },
          { label: 'Total Recipients', value: totalRecip, icon: '👥', color: '#057a55' },
          { label: 'Pending / Failed', value: all.filter(r => r.status === 'Pending' || r.status === 'Failed').length, icon: '⚠️', color: '#b45309' },
        ].map(s => (
          <div key={s.label} className="conn-card" style={{ padding: '18px 20px' }}>
            <div style={{ fontSize: 22 }}>{s.icon}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color, marginTop: 4 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="conn-card" style={{ padding: 22 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>📊 Channel Breakdown</div>
          {byChannel.length === 0 ? <div style={{ color: '#94a3b8', fontSize: 13 }}>No data.</div> : byChannel.map(c => (
            <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 80, fontSize: 12, fontWeight: 600, color: '#334155' }}>{c.name}</div>
              <div style={{ flex: 1, height: 8, background: '#f1f5f9', borderRadius: 4 }}>
                <div style={{ height: '100%', width: `${(c.count / maxBar) * 100}%`, background: '#1a56db', borderRadius: 4, transition: 'width .4s' }} />
              </div>
              <div style={{ width: 30, fontSize: 12, fontWeight: 700, color: '#0f2744', textAlign: 'right' }}>{c.count}</div>
            </div>
          ))}
        </div>

        <div className="conn-card" style={{ padding: 22 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>👥 Audience Reach</div>
          {byAudience.length === 0 ? <div style={{ color: '#94a3b8', fontSize: 13 }}>No data.</div> : byAudience.map(a => {
            const pct = Math.round((a.count / Math.max(...byAudience.map(x => x.count), 1)) * 100)
            return (
              <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 90, fontSize: 12, fontWeight: 600, color: '#334151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                <div style={{ flex: 1, height: 8, background: '#f1f5f9', borderRadius: 4 }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: '#7c3aed', borderRadius: 4, transition: 'width .4s' }} />
                </div>
                <div style={{ width: 30, fontSize: 12, fontWeight: 700, color: '#0f2744', textAlign: 'right' }}>{a.count}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── TEMPLATES ────────────────────────────────────────────────
function TemplatesSection() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading]     = useState(true)
  const [form, setForm]           = useState({ template_name: '', category: 'Fee Reminder', channel: 'SMS', language: 'English', template_text: '', status: 'Active' })
  const [saving, setSaving]       = useState(false)

  const fetch = () => supabase.from('connect_templates').select('*').order('created_at', { ascending: false }).then(({ data }) => { setTemplates(data || []); setLoading(false) })
  useEffect(() => { fetch() }, [])

  const save = async () => {
    setSaving(true)
    const { error } = await supabase.from('connect_templates').insert([form])
    if (!error) { setForm({ template_name: '', category: 'Fee Reminder', channel: 'SMS', language: 'English', template_text: '', status: 'Active' }); fetch() }
    else alert(error.message)
    setSaving(false)
  }

  const del = async (id) => {
    if (!window.confirm('Delete template?')) return
    await supabase.from('connect_templates').delete().eq('id', id)
    setTemplates(p => p.filter(t => t.id !== id))
  }

  if (loading) return <Spinner />

  return (
    <div className="conn-animate">
      <div className="conn-card" style={{ padding: 22, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#0f2744', marginBottom: 16 }}>➕ New Template</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div><label className="conn-label">Template Name *</label><input className="conn-inp" value={form.template_name} onChange={e => setForm(p => ({ ...p, template_name: e.target.value }))} /></div>
          <div><label className="conn-label">Category</label><select className="conn-inp" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
          <div><label className="conn-label">Channel</label><select className="conn-inp" value={form.channel} onChange={e => setForm(p => ({ ...p, channel: e.target.value }))}>{CHANNELS.map(c => <option key={c}>{c}</option>)}</select></div>
          <div><label className="conn-label">Language</label><select className="conn-inp" value={form.language} onChange={e => setForm(p => ({ ...p, language: e.target.value }))}>{LANGUAGES.map(l => <option key={l}>{l}</option>)}</select></div>
          <div style={{ gridColumn: '1/-1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <label className="conn-label" style={{ margin: 0 }}>Template Text — use {'{name}'}, {'{amount}'}, {'{date}'} as variables</label>
              <SMSCounter text={form.template_text} channel={form.channel} />
            </div>
            <textarea className="conn-inp" rows={4} value={form.template_text} onChange={e => setForm(p => ({ ...p, template_text: e.target.value }))} />
          </div>
        </div>
        <button className="conn-btn-primary" style={{ marginTop: 14 }} disabled={!form.template_name || !form.template_text || saving} onClick={save}>
          {saving ? 'Saving…' : '💾 Save Template'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
        {templates.map(t => (
          <div key={t.id} className="conn-card" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{t.template_name}</div>
              <button className="conn-btn-danger" onClick={() => del(t.id)}>Delete</button>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              {channelBadge(t.channel)}
              <span className="conn-badge" style={{ background: '#f5f3ff', color: '#5b21b6' }}>{t.category}</span>
              {t.language !== 'English' && <span className="conn-badge" style={{ background: '#fef3c7', color: '#92400e' }}>{t.language}</span>}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6, background: '#f8fafc', padding: '8px 10px', borderRadius: 6 }}>{t.template_text}</div>
          </div>
        ))}
        {templates.length === 0 && <div style={{ gridColumn: '1/-1', padding: 40, textAlign: 'center', color: '#94a3b8' }}>No templates yet.</div>}
      </div>
    </div>
  )
}

// ─── SETTINGS ─────────────────────────────────────────────────
function SettingsSection({ quota, setQuota }) {
  const [dnd, setDnd]     = useState({ start: '20:00', end: '07:00', enabled: true })
  const [limits, setLimits] = useState(
    Object.fromEntries(ROLES.map(r => [r, 50]))
  )
  const [saved, setSaved] = useState(false)

  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2000) }

  return (
    <div className="conn-animate">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* DND */}
        <div className="conn-card" style={{ padding: 22 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#0f2744', marginBottom: 16 }}>🌙 Do Not Disturb (DND)</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 13, color: '#334155' }}>Enable DND window</span>
            <label className="conn-toggle"><input type="checkbox" checked={dnd.enabled} onChange={e => setDnd(p => ({ ...p, enabled: e.target.checked }))} /><span className="conn-toggle-slider" /></label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, opacity: dnd.enabled ? 1 : .4 }}>
            <div><label className="conn-label">DND Start</label><input type="time" className="conn-inp" value={dnd.start} onChange={e => setDnd(p => ({ ...p, start: e.target.value }))} disabled={!dnd.enabled} /></div>
            <div><label className="conn-label">DND End</label><input type="time" className="conn-inp" value={dnd.end} onChange={e => setDnd(p => ({ ...p, end: e.target.value }))} disabled={!dnd.enabled} /></div>
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: '#94a3b8' }}>Messages sent in DND window will be queued and delivered at DND end time.</div>
        </div>

        {/* Quota */}
        <div className="conn-card" style={{ padding: 22 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#0f2744', marginBottom: 16 }}>📊 Daily Send Quota</div>
          <div style={{ marginBottom: 12 }}>
            <label className="conn-label">Admin Quota (per day)</label>
            <input type="number" className="conn-inp" value={quota} onChange={e => setQuota(Number(e.target.value))} min={1} />
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Quota resets at midnight. Applies to all bulk sends from this admin account.</div>
        </div>

        {/* Per-role limits */}
        <div className="conn-card" style={{ padding: 22, gridColumn: '1/-1' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#0f2744', marginBottom: 16 }}>🎭 Per-Role Daily Message Limits</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {ROLES.map(r => (
              <div key={r}>
                <label className="conn-label" style={{ fontSize: 11 }}>{r}</label>
                <input type="number" className="conn-inp" value={limits[r]} min={0} onChange={e => setLimits(p => ({ ...p, [r]: Number(e.target.value) }))} />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: '#94a3b8' }}>Staff exceeding their limit will see a quota warning when composing. Admin can override.</div>
        </div>
      </div>

      <button className="conn-btn-primary" style={{ marginTop: 20 }} onClick={save}>
        {saved ? '✓ Saved!' : '💾 Save Settings'}
      </button>
    </div>
  )
}

// ─── ROOT ─────────────────────────────────────────────────────
export default function Connect({ currentUser }) {
  const [activeTab, setActiveTab] = useState('compose')
  const [quota, setQuota]         = useState(200)
  const [quotaLeft, setQuotaLeft] = useState(200)
  const [unreadReplies, setUnreadReplies] = useState(0)
  const [openGrievances, setOpenGrievances] = useState(0)

  useEffect(() => {
    supabase.from('connect_replies').select('id', { count: 'exact', head: true }).eq('is_read', false).then(({ count }) => setUnreadReplies(count || 0))
    supabase.from('connect_grievances').select('id', { count: 'exact', head: true }).eq('status', 'Open').then(({ count }) => setOpenGrievances(count || 0))
  }, [activeTab])

  const badge = (n, color = '#c81e1e') => n > 0 ? (
    <span style={{ marginLeft: 'auto', background: color, color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>{n}</span>
  ) : null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{CSS}</style>

      {/* Sidebar */}
      <div style={{ width: 220, background: '#fff', borderRight: '1px solid #e2e8f0', padding: '20px 12px', flexShrink: 0 }}>
        <div style={{ padding: '0 6px 16px', borderBottom: '1px solid #f1f5f9', marginBottom: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: '#0f2744' }}>🔗 Connect</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>GNSI Communication Hub</div>
        </div>
        {NAV_TABS.map(t => (
          <button key={t.id} className={`conn-sidebar-btn ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
            <span>{t.icon}</span>
            <span style={{ flex: 1 }}>{t.label}</span>
            {t.id === 'inbox' && badge(unreadReplies)}
            {t.id === 'grievance' && badge(openGrievances, '#b45309')}
          </button>
        ))}
        <div style={{ marginTop: 16, padding: '12px 10px', background: '#f8fafc', borderRadius: 8, fontSize: 11, color: '#64748b', lineHeight: 1.6 }}>
          <strong style={{ color: '#334155' }}>Today's quota</strong><br />
          <span style={{ fontWeight: 800, fontSize: 18, color: quotaLeft < 20 ? '#c81e1e' : '#057a55' }}>{quotaLeft}</span> / {quota} remaining
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, padding: '24px 28px', overflow: 'auto' }}>
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f2744' }}>
            {NAV_TABS.find(t => t.id === activeTab)?.icon} {NAV_TABS.find(t => t.id === activeTab)?.label}
          </h1>
          <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>GNSI Portal · Khangabok, Manipur</p>
        </div>

        {activeTab === 'compose'    && <ComposeSection   currentUser={currentUser} quotaLeft={quotaLeft} setQuotaLeft={setQuotaLeft} />}
        {activeTab === 'broadcasts' && <BroadcastsSection />}
        {activeTab === 'inbox'      && <InboxSection />}
        {activeTab === 'grievance'  && <GrievanceSection />}
        {activeTab === 'consent'    && <ConsentSection />}
        {activeTab === 'calendar'   && <CalendarSection />}
        {activeTab === 'analytics'  && <AnalyticsSection />}
        {activeTab === 'templates'  && <TemplatesSection />}
        {activeTab === 'settings'   && <SettingsSection quota={quota} setQuota={setQuota} />}
      </div>
    </div>
  )
}