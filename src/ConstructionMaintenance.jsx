import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { supabase } from './supabase'
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ═══════════════════════════════════════════════════════════════════════════
// GNSI — Construction & Maintenance
// Projects, budgets, payments, milestones, site photos, BOQ, issues, site
// diary, contractors and recurring maintenance. Kept separate from Accounts.
// Tables: cm_projects, cm_project_payments, cm_milestones, cm_activity_log
// (+ cm_advanced.sql: cm_photos, cm_materials, cm_issues, cm_site_logs,
//    cm_contractors, cm_maintenance). Storage bucket: cm-attachments.
// ═══════════════════════════════════════════════════════════════════════════

const CATEGORIES     = ['Construction', 'Maintenance']
const STATUS_OPTIONS = ['Planned', 'Ongoing', 'Completed', 'On Hold', 'Cancelled']
const PRIORITIES     = ['Low', 'Medium', 'High', 'Critical']
const PAYMENT_MODES  = ['Cash', 'Bank', 'UPI', 'Card']
const WEATHER        = ['☀️ Sunny', '⛅ Cloudy', '🌧️ Rain', '⛈️ Storm', '🌫️ Fog']
const CM_BUCKET      = 'cm-attachments'
const CHART_COLORS   = ['#1e3a6e', '#16a34a', '#dc2626', '#f59e0b', '#7c3aed', '#0891b2', '#be185d', '#047857']
const SQL_HINT       = 'Run cm_advanced.sql in the Supabase SQL Editor to enable this.'

const STATUS_COLORS = {
  Planned:   { bg: '#eff6ff', fg: '#1d4ed8', dot: '#3b82f6' },
  Ongoing:   { bg: '#fffbeb', fg: '#b45309', dot: '#f59e0b' },
  Completed: { bg: '#f0fdf4', fg: '#15803d', dot: '#22c55e' },
  'On Hold': { bg: '#fef2f2', fg: '#b91c1c', dot: '#ef4444' },
  Cancelled: { bg: '#f3f4f6', fg: '#6b7280', dot: '#9ca3af' },
}
const PRIORITY_COLORS = { Low: '#64748b', Medium: '#0e7490', High: '#d97706', Critical: '#dc2626' }
const CATEGORY_ICON = { Construction: '🏗️', Maintenance: '🔧' }
const INSTITUTE_INFO = { name: 'GUIDANCE NAVODAYA & SAINIK INSTITUTE (GNSI)', tagline: 'NVS · Sainik School · RMS Entrance Coaching', address: 'Khangabok, Thoubal, Manipur, India' }

const emptyProject = {
  name: '', category: 'Construction', description: '', contractor: '', contractor_phone: '', budget_amount: '',
  status: 'Ongoing', start_date: new Date().toLocaleDateString('en-CA'), target_end_date: '', completed_date: '', notes: '', progress_pct: 0,
  priority: 'Medium', location: '', retention_pct: '',
}
const emptyPayment = { amount: '', pay_date: new Date().toLocaleDateString('en-CA'), pay_mode: 'Cash', txn_ref: '', paid_by: '', received_by: '', notes: '' }
const emptyMilestone = { label: '', due_date: '', planned_amount: '' }

// ── helpers ────────────────────────────────────────────────────────────────
const fmt = n => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
const fmtK = n => { const v = Number(n || 0), a = Math.abs(v); return a >= 1e7 ? `₹${(v / 1e7).toFixed(2)} Cr` : a >= 1e5 ? `₹${(v / 1e5).toFixed(1)} L` : fmt(v) }
const today = () => new Date().toLocaleDateString('en-CA')
const addDays = (d, k) => { const x = new Date((d || today()) + 'T00:00:00'); x.setDate(x.getDate() + k); return x.toLocaleDateString('en-CA') }
const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000)
const niceDate = d => d ? new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const waLink = (ph, text) => { const d = String(ph || '').replace(/\D/g, ''); return `https://wa.me/${d.length === 10 ? '91' + d : d}?text=${encodeURIComponent(text)}` }
const csvCell = v => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
function downloadCSV(name, headers, rows) {
  const text = '﻿' + [headers, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
// Indian-system amount in words, for payment vouchers.
function inWords(num) {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  const two = n => n < 20 ? a[n] : b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '')
  const three = n => (n >= 100 ? a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' : '') : '') + (n % 100 ? two(n % 100) : '')
  let n = Math.round(Number(num) || 0)
  if (n === 0) return 'Zero Rupees Only'
  const parts = []
  const cr = Math.floor(n / 1e7); n %= 1e7
  const lk = Math.floor(n / 1e5); n %= 1e5
  const th = Math.floor(n / 1000); n %= 1000
  if (cr) parts.push(`${cr >= 100 ? three(cr) : two(cr)} Crore`)
  if (lk) parts.push(`${two(lk)} Lakh`)
  if (th) parts.push(`${two(th)} Thousand`)
  if (n) parts.push(three(n))
  return `Rupees ${parts.join(' ')} Only`
}
const isMissing = err => !!err && /does not exist|schema cache|could not find/i.test(err.message || '')

async function logActivity(projectId, action, detail, actor) {
  try { await supabase.from('cm_activity_log').insert({ project_id: projectId, action, detail, actor: actor || null }) }
  catch (err) { console.warn('cm_activity_log insert failed:', err.message) }
}
async function uploadFile(folder, file, id) {
  if (!file) return null
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
  const path = `${folder}/${id || Date.now()}${folder === 'photos' ? '-' + Math.random().toString(36).slice(2, 7) : ''}.${ext}`
  const { error } = await supabase.storage.from(CM_BUCKET).upload(path, file, { upsert: true })
  if (error) throw new Error(`Upload failed: ${error.message}`)
  return supabase.storage.from(CM_BUCKET).getPublicUrl(path).data.publicUrl
}
function pdfHeader(doc, title) {
  const w = doc.internal.pageSize.getWidth()
  doc.setFillColor(19, 42, 79); doc.rect(0, 0, w, 78, 'F')
  doc.setTextColor(255); doc.setFontSize(13); doc.setFont(undefined, 'bold')
  doc.text(INSTITUTE_INFO.name, w / 2, 30, { align: 'center' })
  doc.setFontSize(8.5); doc.setFont(undefined, 'normal')
  doc.text(`${INSTITUTE_INFO.tagline} · ${INSTITUTE_INFO.address}`, w / 2, 46, { align: 'center' })
  doc.setTextColor(233, 217, 176); doc.setFontSize(11); doc.setFont(undefined, 'bold')
  doc.text(title, w / 2, 66, { align: 'center' })
  doc.setTextColor(15, 23, 42); doc.setFont(undefined, 'normal')
  return 100
}

// ── derived project analytics ─────────────────────────────────────────────
function analyse(p, pays) {
  const paid = pays.reduce((s, x) => s + (Number(x.amount) || 0), 0)
  const budget = Number(p.budget_amount) || 0
  const progress = p.status === 'Completed' ? 100 : Math.min(100, Math.max(0, Number(p.progress_pct) || 0))
  const active = ['Planned', 'Ongoing', 'On Hold'].includes(p.status)
  const t = today()
  const isOverdue = !!(p.target_end_date && p.status === 'Ongoing' && p.target_end_date < t)
  let elapsedPct = null
  if (p.start_date && p.target_end_date && p.target_end_date > p.start_date) {
    elapsedPct = Math.min(100, Math.max(0, daysBetween(p.start_date, t) / daysBetween(p.start_date, p.target_end_date) * 100))
  }
  const scheduleGap = elapsedPct == null ? null : progress - elapsedPct
  const behind = p.status === 'Ongoing' && scheduleGap != null && scheduleGap < -10
  // Estimate at completion: spend so far scaled by work done (needs ≥10% progress to be meaningful).
  const forecast = progress >= 10 && paid > 0 ? paid / (progress / 100) : Math.max(budget, paid)
  const forecastOver = active && budget > 0 && progress < 100 && forecast > budget * 1.05
  const isOverBudget = budget > 0 && paid > budget
  const daysLeft = p.target_end_date ? daysBetween(t, p.target_end_date) : null
  const retention = budget * (Number(p.retention_pct) || 0) / 100
  const health = !active ? 'closed' : isOverBudget || isOverdue ? 'critical' : behind || forecastOver ? 'risk' : 'good'
  return { ...p, paid, remaining: budget - paid, pctPaid: budget > 0 ? Math.min(100, paid / budget * 100) : 0, paymentCount: pays.length, progress,
    isOverBudget, isOverdue, elapsedPct, scheduleGap, behind, forecast, forecastOver, daysLeft, retention, health, active }
}
const HEALTH = { good: ['On track', '#15803d', '#ecfdf3'], risk: ['At risk', '#b45309', '#fffbeb'], critical: ['Critical', '#dc2626', '#fef2f2'], closed: ['Closed', '#64748b', '#f1f5f9'] }

// ── design system ─────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,600;9..144,700&display=swap');
.cm{--ink:#0e1b33;--ink2:#334155;--mute:#64748b;--faint:#94a3b8;--line:#e7e3da;--line2:#f0ece4;--bg:#f7f5f0;--navy:#132a4f;--navy2:#1e3a6e;--gold:#b8923a;--gold2:#e9d9b0;--goldbg:#fbf6ea;
  --green:#15803d;--red:#dc2626;--amber:#b45309;--sh:0 1px 2px rgba(14,27,51,.04),0 6px 20px rgba(14,27,51,.06);--sh2:0 20px 60px rgba(14,27,51,.22);
  font-family:'Plus Jakarta Sans',system-ui,-apple-system,'Segoe UI',sans-serif;color:var(--ink);background:var(--bg);min-height:100vh;-webkit-font-smoothing:antialiased;padding:0 0 40px}
.cm *{box-sizing:border-box}.cm button{font-family:inherit;cursor:pointer}.cm input,.cm select,.cm textarea{font-family:inherit}
.cm-serif{font-family:'Fraunces',Georgia,serif;letter-spacing:-.01em}
.cm-wrap{max-width:1280px;margin:0 auto;padding:0 20px}
.cm-hero{background:radial-gradient(900px 300px at 90% -30%,rgba(184,146,58,.32),transparent 60%),linear-gradient(135deg,#132a4f,#1e3a6e);color:#fff;padding:24px 0 0}
.cm-hero h1{margin:4px 0 2px;font-size:clamp(22px,3vw,30px);font-weight:700}
.cm-hero p{margin:0;color:rgba(255,255,255,.7);font-size:13.5px}
.cm-eyebrow{font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--gold2)}
.cm-tabs{display:flex;gap:4px;margin-top:18px;overflow-x:auto;scrollbar-width:none}.cm-tabs::-webkit-scrollbar{display:none}
.cm-tab{flex:none;height:44px;padding:0 16px;border:none;border-radius:12px 12px 0 0;background:transparent;color:rgba(255,255,255,.65);font-weight:700;font-size:13.5px;display:flex;align-items:center;gap:7px}
.cm-tab:hover{color:#fff;background:rgba(255,255,255,.06)}.cm-tab.on{background:var(--bg);color:var(--navy)}
.cm-tab .n{min-width:20px;height:20px;border-radius:99px;background:var(--gold);color:#132a4f;font-size:11px;display:inline-grid;place-items:center;padding:0 5px}
.cm-btn{height:40px;padding:0 16px;border-radius:11px;border:none;background:var(--navy);color:#fff;font-weight:700;font-size:13px;display:inline-flex;align-items:center;gap:7px;transition:background .15s,transform .1s;white-space:nowrap}
.cm-btn:hover{background:var(--navy2)}.cm-btn:active{transform:scale(.98)}.cm-btn:disabled{background:#b8c0cc;cursor:not-allowed}
.cm-btn.gold{background:var(--gold);color:#132a4f}.cm-btn.gold:hover{background:#c9a24a}
.cm-btn.ghost{background:#fff;color:var(--ink);border:1px solid var(--line)}.cm-btn.ghost:hover{background:#faf8f3}
.cm-btn.danger{background:#fff;color:var(--red);border:1px solid #fecaca}.cm-btn.danger:hover{background:#fef2f2}
.cm-btn.sm{height:32px;padding:0 11px;font-size:12px;border-radius:9px}
.cm-btn.glass{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2)}.cm-btn.glass:hover{background:rgba(255,255,255,.18)}
.cm-card{background:#fff;border:1px solid var(--line);border-radius:18px;box-shadow:var(--sh)}
.cm-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}
.cm-kpi{background:#fff;border:1px solid var(--line);border-radius:16px;padding:14px 16px;position:relative;overflow:hidden}
.cm-kpi:before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--c,#132a4f)}
.cm-kpi .l{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--faint)}
.cm-kpi .v{font-size:23px;font-weight:800;letter-spacing:-.02em;margin-top:4px;color:var(--c,#0e1b33)}
.cm-kpi .s{font-size:11.5px;color:var(--mute);margin-top:2px}
.cm-alert{display:flex;gap:12px;align-items:flex-start;border-radius:14px;padding:12px 14px;font-size:13px}
.cm-alert b{display:block;margin-bottom:2px}.cm-alert ul{margin:4px 0 0;padding-left:16px}.cm-alert li{margin:2px 0;cursor:pointer}.cm-alert li:hover{text-decoration:underline}
.cm-h{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px}
.cm-h h3{margin:0;font-size:15px;font-weight:800}
.cm-chip{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:800;padding:3px 9px;border-radius:99px;white-space:nowrap}
.cm-chip i{width:7px;height:7px;border-radius:99px;display:inline-block}
.cm-bar{height:8px;border-radius:99px;background:#f0ece4;overflow:hidden;position:relative}.cm-bar>div{height:100%;border-radius:99px;transition:width .4s}
.cm-bar .mark{position:absolute;top:-3px;bottom:-3px;width:2px;background:#0e1b33;border-radius:2px}
.cm-tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:16px 0 14px}
.cm-in{height:40px;border-radius:11px;border:1px solid var(--line);background:#fff;padding:0 12px;font-size:13.5px;color:var(--ink);outline:none;transition:border-color .15s,box-shadow .15s;width:100%}
.cm-in:focus{border-color:var(--navy2);box-shadow:0 0 0 4px rgba(30,58,110,.1)}
textarea.cm-in{height:auto;padding:10px 12px;resize:vertical;line-height:1.5}
.cm-lbl{display:block;font-size:11.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--mute);margin-bottom:5px}
.cm-seg{display:inline-flex;background:#fff;border:1px solid var(--line);border-radius:11px;padding:3px;gap:2px}
.cm-seg button{height:32px;padding:0 12px;border:none;border-radius:8px;background:none;font-size:12.5px;font-weight:700;color:var(--mute)}
.cm-seg button.on{background:var(--navy);color:#fff}
.cm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:14px}
@media(max-width:420px){.cm-grid{grid-template-columns:1fr}}
.cm-pcard{background:#fff;border:1px solid var(--line);border-radius:18px;padding:16px;cursor:pointer;transition:box-shadow .2s,transform .2s,border-color .2s;display:flex;flex-direction:column;gap:10px;position:relative;overflow:hidden}
.cm-pcard:hover{box-shadow:var(--sh2);transform:translateY(-2px);border-color:transparent}
.cm-pcard .top{display:flex;gap:10px;align-items:flex-start}
.cm-pcard .ic{width:42px;height:42px;border-radius:12px;background:var(--goldbg);display:grid;place-items:center;font-size:20px;flex:none}
.cm-pcard .nm{font-size:15.5px;font-weight:800;line-height:1.25}
.cm-pcard .meta{font-size:12px;color:var(--mute);display:flex;gap:10px;flex-wrap:wrap}
.cm-kv{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.cm-kv div{background:#faf8f3;border-radius:10px;padding:7px 9px}.cm-kv small{display:block;font-size:10.5px;font-weight:700;color:var(--faint);text-transform:uppercase;letter-spacing:.04em}.cm-kv b{font-size:13.5px}
.cm-board{display:grid;grid-template-columns:repeat(5,minmax(230px,1fr));gap:12px;overflow-x:auto;padding-bottom:6px}
.cm-col{background:#efece5;border-radius:16px;padding:10px;min-height:240px;border:2px solid transparent;transition:border-color .15s,background .15s}
.cm-col.drop{border-color:var(--gold);background:var(--goldbg)}
.cm-col h4{margin:2px 4px 10px;font-size:13px;display:flex;justify-content:space-between;align-items:center}
.cm-bcard{background:#fff;border-radius:13px;padding:11px;margin-bottom:8px;box-shadow:0 1px 3px rgba(0,0,0,.06);cursor:grab;border:1px solid var(--line)}
.cm-bcard:active{cursor:grabbing}
.cm-table{width:100%;border-collapse:collapse;font-size:13px}
.cm-table th{text-align:left;font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--mute);padding:10px 12px;background:#faf8f3;border-bottom:1px solid var(--line);white-space:nowrap;cursor:pointer;user-select:none}
.cm-table td{padding:10px 12px;border-bottom:1px solid var(--line2);vertical-align:middle}
.cm-table tbody tr{cursor:pointer}.cm-table tbody tr:hover{background:#fcfbf8}
.cm-gantt{position:relative}
.cm-grow{display:grid;grid-template-columns:230px 1fr;align-items:center;border-bottom:1px solid var(--line2);min-height:46px}
@media(max-width:700px){.cm-grow{grid-template-columns:120px 1fr}}
.cm-grow .n{font-size:12.5px;font-weight:700;padding:6px 10px 6px 0;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cm-track{position:relative;height:46px}
.cm-gbar{position:absolute;top:13px;height:20px;border-radius:7px;overflow:hidden;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.12)}
.cm-gbar>i{position:absolute;left:0;top:0;bottom:0;background:rgba(0,0,0,.22)}
.cm-gbar span{position:relative;font-size:10.5px;font-weight:800;color:#fff;padding:0 7px;line-height:20px;white-space:nowrap}
.cm-today{position:absolute;top:0;bottom:0;width:2px;background:var(--red);z-index:2}
.cm-today:after{content:'Today';position:absolute;bottom:-17px;left:-15px;font-size:10px;font-weight:800;color:var(--red)}
.cm-ov{position:fixed;inset:0;z-index:9000;background:rgba(10,20,40,.5);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);animation:cm-fade .2s}
.cm-drawer{position:fixed;z-index:9001;top:0;right:0;bottom:0;width:min(820px,100%);background:var(--bg);display:flex;flex-direction:column;box-shadow:var(--sh2);animation:cm-right .28s cubic-bezier(.2,.8,.2,1);font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:var(--ink)}
.cm-dhead{background:linear-gradient(135deg,#132a4f,#1e3a6e);color:#fff;padding:18px 22px 0}
.cm-dtabs{display:flex;gap:2px;overflow-x:auto;margin-top:14px;scrollbar-width:none}.cm-dtabs::-webkit-scrollbar{display:none}
.cm-dtab{flex:none;height:38px;padding:0 13px;border:none;border-radius:10px 10px 0 0;background:transparent;color:rgba(255,255,255,.65);font-weight:700;font-size:12.5px}
.cm-dtab.on{background:var(--bg);color:var(--navy)}.cm-dtab .n{opacity:.7;margin-left:3px}
.cm-dbody{flex:1;overflow-y:auto;padding:18px 22px 30px}
.cm-modal{position:fixed;z-index:9100;left:50%;top:50%;transform:translate(-50%,-50%);width:min(720px,calc(100% - 24px));max-height:calc(100vh - 32px);overflow:auto;background:#fff;border-radius:22px;box-shadow:var(--sh2);animation:cm-zoom .22s cubic-bezier(.2,.8,.2,1);font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:var(--ink)}
.cm-mhead{display:flex;justify-content:space-between;align-items:center;padding:18px 22px;border-bottom:1px solid var(--line2);position:sticky;top:0;background:#fff;z-index:1}
.cm-mhead h3{margin:0;font-size:18px}
.cm-x{width:36px;height:36px;border-radius:99px;border:none;background:#f3f0e9;font-size:18px;color:var(--ink2);display:grid;place-items:center;flex:none}
.cm-x.w{background:rgba(255,255,255,.12);color:#fff}
.cm-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
.cm-sub{background:#fff;border:1px solid var(--line);border-radius:16px;padding:14px}
.cm-empty{text-align:center;padding:36px 12px;color:var(--mute);font-size:13.5px}.cm-empty .i{font-size:34px;margin-bottom:6px}
.cm-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--line2)}
.cm-photos{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.cm-photo{position:relative;border-radius:14px;overflow:hidden;aspect-ratio:4/3;background:#eee;cursor:zoom-in}
.cm-photo img{width:100%;height:100%;object-fit:cover;transition:transform .3s}.cm-photo:hover img{transform:scale(1.05)}
.cm-photo .cap{position:absolute;left:0;right:0;bottom:0;padding:18px 9px 7px;background:linear-gradient(transparent,rgba(0,0,0,.7));color:#fff;font-size:11.5px;font-weight:600}
.cm-photo .st{position:absolute;top:7px;left:7px;font-size:10px;font-weight:800;background:rgba(19,42,79,.85);color:var(--gold2);padding:2px 7px;border-radius:6px}
.cm-light{position:fixed;inset:0;z-index:9300;background:rgba(0,0,0,.9);display:grid;place-items:center;padding:20px;cursor:zoom-out}
.cm-light img{max-width:100%;max-height:88vh;border-radius:10px}
.cm-toast{position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:9999;background:#0e1b33;color:#fff;padding:11px 16px;border-radius:12px;font-size:13.5px;font-weight:600;box-shadow:var(--sh2);max-width:calc(100% - 32px);animation:cm-toast .25s;font-family:'Plus Jakarta Sans',system-ui,sans-serif}
.cm-stars button{border:none;background:none;padding:0 1px;font-size:17px;line-height:1}
.cm-ring{--p:0;width:54px;height:54px;border-radius:99px;background:conic-gradient(var(--c,#132a4f) calc(var(--p)*1%),#f0ece4 0);display:grid;place-items:center;flex:none}
.cm-ring span{width:42px;height:42px;border-radius:99px;background:#fff;display:grid;place-items:center;font-size:12px;font-weight:800}
.cm-range{width:100%;accent-color:var(--navy)}
@keyframes cm-fade{from{opacity:0}to{opacity:1}}
@keyframes cm-right{from{transform:translateX(100%)}to{transform:none}}
@keyframes cm-zoom{from{opacity:0;transform:translate(-50%,-48%) scale(.97)}to{opacity:1;transform:translate(-50%,-50%)}}
@keyframes cm-toast{from{opacity:0;transform:translate(-50%,-8px)}to{opacity:1;transform:translate(-50%,0)}}
@media(max-width:640px){.cm-wrap{padding:0 12px}.cm-dbody{padding:14px}.cm-dhead{padding:14px 14px 0}.cm-kv{grid-template-columns:1fr 1fr}}
@media(prefers-reduced-motion:reduce){.cm *{animation:none!important;transition:none!important}}
`

const Chip = ({ status }) => { const c = STATUS_COLORS[status] || STATUS_COLORS.Ongoing; return <span className="cm-chip" style={{ background: c.bg, color: c.fg }}><i style={{ background: c.dot }} />{status}</span> }
const HealthChip = ({ h }) => { const [l, c, bg] = HEALTH[h] || HEALTH.good; return <span className="cm-chip" style={{ background: bg, color: c }}>{h === 'good' ? '●' : h === 'closed' ? '○' : '▲'} {l}</span> }
const PriorityChip = ({ p }) => p ? <span className="cm-chip" style={{ background: PRIORITY_COLORS[p] + '14', color: PRIORITY_COLORS[p] }}>⚑ {p}</span> : null
const Ring = ({ pct, color }) => <div className="cm-ring" style={{ '--p': Math.round(pct), '--c': color }}><span>{Math.round(pct)}%</span></div>
const Field = ({ label, children, span }) => <div style={span ? { gridColumn: '1 / -1' } : undefined}><label className="cm-lbl">{label}</label>{children}</div>
function Modal({ title, onClose, children, width }) {
  useEffect(() => { const k = e => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  return (<><div className="cm-ov" style={{ zIndex: 9090 }} onClick={onClose} /><div className="cm-modal" style={width ? { width: `min(${width}px, calc(100% - 24px))` } : undefined} role="dialog" aria-label={title}>
    <div className="cm-mhead"><h3>{title}</h3><button className="cm-x" onClick={onClose} aria-label="Close">×</button></div><div style={{ padding: '18px 22px 22px' }}>{children}</div></div></>)
}
const Empty = ({ icon, children }) => <div className="cm-empty"><div className="i">{icon}</div>{children}</div>
const Stars = ({ value, onChange }) => <span className="cm-stars">{[1, 2, 3, 4, 5].map(v => <button key={v} onClick={e => { e.stopPropagation(); onChange?.(v) }} disabled={!onChange} style={{ color: v <= (value || 0) ? '#d97706' : '#d6d0c4', cursor: onChange ? 'pointer' : 'default' }} aria-label={`${v} star${v > 1 ? 's' : ''}`}>★</button>)}</span>

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════
export default function ConstructionMaintenance() {
  const currentUser = useMemo(() => { try { const s = localStorage.getItem('gnsi_session'); return s ? JSON.parse(s).user : {} } catch { return {} } }, [])
  const myName = currentUser?.userName || currentUser?.name || ''

  const [projects, setProjects] = useState([])
  const [payments, setPayments] = useState([])
  const [milestones, setMilestones] = useState([])
  const [activityLog, setActivityLog] = useState([])
  const [photos, setPhotos] = useState([])
  const [materials, setMaterials] = useState([])
  const [issues, setIssues] = useState([])
  const [siteLogs, setSiteLogs] = useState([])
  const [contractors, setContractors] = useState([])
  const [maint, setMaint] = useState([])
  const [ext, setExt] = useState(false) // cm_advanced.sql has been run
  const [loading, setLoading] = useState(true)

  const [tab, setTab] = useState('dashboard')
  const [view, setView] = useState(() => { try { return localStorage.getItem('gnsi_cm_view') || 'cards' } catch { return 'cards' } })
  const [statusFilter, setStatusFilter] = useState('All')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [priorityFilter, setPriorityFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState({ key: 'updated', dir: -1 })
  const [openId, setOpenId] = useState(null)
  const [drawerTab, setDrawerTab] = useState('overview')
  const [form, setForm] = useState(null) // { mode: 'add'|'edit', project }
  const [toast, setToast] = useState(null)
  const [dragId, setDragId] = useState(null)
  const [dropCol, setDropCol] = useState(null)

  const notify = useCallback((msg, err) => { setToast({ msg, err, k: Date.now() }) }, [])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3400); return () => clearTimeout(t) }, [toast])
  useEffect(() => { try { localStorage.setItem('gnsi_cm_view', view) } catch {} }, [view])

  const loadAll = useCallback(async (quiet) => {
    if (!quiet) setLoading(true)
    try {
      const r = await Promise.all([
        supabase.from('cm_projects').select('*').order('created_at', { ascending: false }),
        supabase.from('cm_project_payments').select('*').order('pay_date', { ascending: false }),
        supabase.from('cm_milestones').select('*').order('sort_order', { ascending: true }),
        supabase.from('cm_activity_log').select('*').order('at', { ascending: false }).limit(800),
        supabase.from('cm_photos').select('*').order('taken_on', { ascending: false }),
        supabase.from('cm_materials').select('*').order('created_at', { ascending: true }),
        supabase.from('cm_issues').select('*').order('created_at', { ascending: false }),
        supabase.from('cm_site_logs').select('*').order('log_date', { ascending: false }),
        supabase.from('cm_contractors').select('*').order('name'),
        supabase.from('cm_maintenance').select('*').order('next_due', { ascending: true }),
        supabase.from('cm_projects').select('priority').limit(1),
      ])
      ;['cm_projects', 'cm_project_payments', 'cm_milestones', 'cm_activity_log'].forEach((t, i) => r[i].error && console.warn(`${t} load failed:`, r[i].error.message))
      setProjects(r[0].data || []); setPayments(r[1].data || []); setMilestones(r[2].data || []); setActivityLog(r[3].data || [])
      setPhotos(r[4].data || []); setMaterials(r[5].data || []); setIssues(r[6].data || []); setSiteLogs(r[7].data || [])
      setContractors(r[8].data || []); setMaint(r[9].data || [])
      setExt(!r[4].error && !r[10].error)
    } catch (err) { console.warn('Construction & Maintenance load failed:', err.message) }
    setLoading(false)
  }, [])
  useEffect(() => { loadAll() }, [loadAll])

  const group = (list, key = 'project_id') => { const m = {}; list.forEach(x => { (m[x[key]] ??= []).push(x) }); return m }
  const paymentsByProject = useMemo(() => group(payments), [payments])
  const milestonesByProject = useMemo(() => group(milestones), [milestones])
  const activityByProject = useMemo(() => group(activityLog), [activityLog])
  const photosByProject = useMemo(() => group(photos), [photos])
  const materialsByProject = useMemo(() => group(materials), [materials])
  const issuesByProject = useMemo(() => group(issues), [issues])
  const logsByProject = useMemo(() => group(siteLogs), [siteLogs])

  const rows = useMemo(() => projects.map(p => analyse(p, paymentsByProject[p.id] || [])), [projects, paymentsByProject])
  const byId = useMemo(() => new Map(rows.map(r => [r.id, r])), [rows])
  const open = openId ? byId.get(openId) : null

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    const list = rows.filter(p => {
      if (statusFilter !== 'All' && p.status !== statusFilter) return false
      if (categoryFilter !== 'All' && p.category !== categoryFilter) return false
      if (priorityFilter !== 'All' && (p.priority || 'Medium') !== priorityFilter) return false
      if (s && !`${p.name} ${p.contractor || ''} ${p.location || ''} ${p.description || ''}`.toLowerCase().includes(s)) return false
      return true
    })
    const val = p => ({ name: p.name.toLowerCase(), budget: Number(p.budget_amount) || 0, paid: p.paid, progress: p.progress, target: p.target_end_date || '9999', status: STATUS_OPTIONS.indexOf(p.status), priority: PRIORITIES.indexOf(p.priority || 'Medium'), health: ['critical', 'risk', 'good', 'closed'].indexOf(p.health), updated: p.updated_at || p.created_at || '' })[sort.key]
    return list.sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * sort.dir)
  }, [rows, statusFilter, categoryFilter, priorityFilter, search, sort])

  // ── portfolio analytics ──
  const summary = useMemo(() => {
    const sum = (l, f) => l.reduce((s, p) => s + f(p), 0)
    const act = rows.filter(p => p.active)
    const totalBudget = sum(rows, p => Number(p.budget_amount) || 0), totalPaid = sum(rows, p => p.paid)
    return {
      totalBudget, totalPaid, remaining: totalBudget - totalPaid, count: rows.length,
      ongoing: rows.filter(p => p.status === 'Ongoing').length, completed: rows.filter(p => p.status === 'Completed').length,
      forecast: sum(rows, p => p.status === 'Completed' || p.status === 'Cancelled' ? p.paid : Math.max(p.forecast, p.paid)),
      active: act.length, good: act.filter(p => p.health === 'good').length, risk: act.filter(p => p.health === 'risk').length, critical: act.filter(p => p.health === 'critical').length,
      score: act.length ? Math.round(act.filter(p => p.health === 'good').length / act.length * 100) : 100,
      retentionHeld: sum(rows.filter(p => !p.retention_released), p => p.retention),
    }
  }, [rows])
  const alerts = useMemo(() => {
    const t = today()
    return {
      overBudget: rows.filter(p => p.isOverBudget), overdue: rows.filter(p => p.isOverdue),
      behind: rows.filter(p => p.behind && !p.isOverdue), forecastOver: rows.filter(p => p.forecastOver && !p.isOverBudget),
      maintDue: maint.filter(m => m.active && m.next_due <= addDays(t, 7)),
      openIssues: issues.filter(i => i.status !== 'Resolved' && (i.priority === 'Critical' || i.priority === 'High')),
    }
  }, [rows, maint, issues])
  const duePayments = useMemo(() => {
    const t = today(), until = addDays(t, 30)
    return milestones.filter(m => !m.is_paid && m.due_date && m.due_date <= until && byId.get(m.project_id)?.active)
      .map(m => ({ ...m, project: byId.get(m.project_id), overdue: m.due_date < t })).sort((a, b) => a.due_date.localeCompare(b.due_date))
  }, [milestones, byId])
  const cashflow = useMemo(() => {
    const out = [], d = new Date(); d.setDate(1)
    for (let i = -11; i <= 3; i++) { const x = new Date(d); x.setMonth(d.getMonth() + i); out.push({ key: x.toLocaleDateString('en-CA').slice(0, 7), month: x.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }), paid: 0, planned: 0, future: i > 0 }) }
    const idx = Object.fromEntries(out.map((o, i) => [o.key, i]))
    payments.forEach(p => { const k = (p.pay_date || '').slice(0, 7); if (idx[k] != null) out[idx[k]].paid += Number(p.amount) || 0 })
    milestones.forEach(m => { if (m.is_paid || !m.due_date) return; const k = m.due_date.slice(0, 7), cur = out[11].key; if (idx[k] != null && k >= cur) out[idx[k]].planned += Number(m.planned_amount) || 0 })
    return out
  }, [payments, milestones])
  const contractorSpend = useMemo(() => {
    const m = {}
    rows.forEach(p => {
      const key = p.contractor?.trim() || 'Unassigned'
      m[key] ??= { contractor: key, phone: p.contractor_phone, budget: 0, paid: 0, projectCount: 0, completed: 0, onTime: 0, overBudget: 0, progress: 0, active: 0 }
      const c = m[key]; c.budget += Number(p.budget_amount) || 0; c.paid += p.paid; c.projectCount++; c.phone ||= p.contractor_phone
      if (p.status === 'Completed') { c.completed++; if (!p.target_end_date || !p.completed_date || p.completed_date <= p.target_end_date) c.onTime++ }
      if (p.isOverBudget) c.overBudget++
      if (p.active) { c.active++; c.progress += p.progress }
    })
    return Object.values(m).sort((a, b) => b.paid - a.paid)
  }, [rows])
  const categorySpend = useMemo(() => CATEGORIES.map(cat => ({ category: cat, budget: rows.filter(p => p.category === cat).reduce((s, p) => s + (Number(p.budget_amount) || 0), 0), paid: rows.filter(p => p.category === cat).reduce((s, p) => s + p.paid, 0) })), [rows])
  const statusData = useMemo(() => STATUS_OPTIONS.map(s => ({ name: s, value: rows.filter(p => p.status === s).length })).filter(x => x.value), [rows])

  // ── projects ──
  const saveProject = async (draft, file, original) => {
    if (!draft.name.trim()) { notify('Project name is required.', true); return false }
    const base = {
      name: draft.name.trim(), category: draft.category, description: draft.description || null, contractor: draft.contractor?.trim() || null,
      contractor_phone: draft.contractor_phone || null, budget_amount: Number(draft.budget_amount) || 0, status: draft.status,
      start_date: draft.start_date || null, target_end_date: draft.target_end_date || null, notes: draft.notes || null,
      ...(ext ? { priority: draft.priority || 'Medium', location: draft.location?.trim() || null, retention_pct: Number(draft.retention_pct) || 0 } : {}),
    }
    try {
      if (!original) {
        const payload = { ...base, progress_pct: draft.status === 'Completed' ? 100 : Number(draft.progress_pct) || 0, completed_date: draft.status === 'Completed' ? today() : null, created_by: myName || null }
        const { data: inserted, error } = await supabase.from('cm_projects').insert(payload).select().single()
        if (error) throw error
        if (file && inserted?.id) { const url = await uploadFile('contracts', file, inserted.id); if (url) await supabase.from('cm_projects').update({ contract_file_url: url }).eq('id', inserted.id) }
        await logActivity(inserted?.id, 'created', `Project "${payload.name}" created`, myName)
        notify(`✅ "${payload.name}" created`)
        await loadAll(true); if (inserted?.id) { setOpenId(inserted.id); setDrawerTab('overview') }
      } else {
        const payload = { ...base, completed_date: draft.status === 'Completed' ? (draft.completed_date || original.completed_date || today()) : null,
          progress_pct: draft.status === 'Completed' ? 100 : (Number(draft.progress_pct) || 0), updated_at: new Date().toISOString() }
        if (file) { const url = await uploadFile('contracts', file, original.id); if (url) payload.contract_file_url = url }
        const { error } = await supabase.from('cm_projects').update(payload).eq('id', original.id)
        if (error) throw error
        const notes = []
        if (original.status !== payload.status) notes.push(`Status changed from ${original.status} to ${payload.status}`)
        if (Number(original.budget_amount) !== payload.budget_amount) notes.push(`Budget changed from ${fmt(original.budget_amount)} to ${fmt(payload.budget_amount)}`)
        if (file) notes.push('Contract file uploaded')
        await logActivity(original.id, 'edited', notes.length ? notes.join('; ') : 'Project details updated', myName)
        notify('✅ Changes saved'); await loadAll(true)
      }
      return true
    } catch (err) { notify('Could not save: ' + err.message, true); return false }
  }
  const deleteProject = async p => {
    if (!window.confirm(`Delete "${p.name}" and everything recorded against it (${p.paymentCount} payment${p.paymentCount === 1 ? '' : 's'}, milestones, photos, issues)? This cannot be undone.`)) return
    const { error } = await supabase.from('cm_projects').delete().eq('id', p.id)
    if (error) { notify('Could not delete: ' + error.message, true); return }
    setOpenId(null); notify('Project deleted'); await loadAll(true)
  }
  const duplicateProject = async p => {
    const copy = { ...emptyProject, ...p, name: `${p.name} (copy)`, status: 'Planned', progress_pct: 0, start_date: today(), target_end_date: '', completed_date: '', budget_amount: p.budget_amount || '', retention_pct: p.retention_pct || '' }
    setForm({ mode: 'add', project: copy, from: p })
  }
  const updateProgress = async (p, pct) => {
    const { error } = await supabase.from('cm_projects').update({ progress_pct: pct, updated_at: new Date().toISOString() }).eq('id', p.id)
    if (error) { notify('Could not update progress: ' + error.message, true); return }
    await logActivity(p.id, 'edited', `Progress updated to ${pct}%`, myName); await loadAll(true)
  }
  const quickStatus = async (p, status) => {
    if (p.status === status) return
    const payload = { status, updated_at: new Date().toISOString(), completed_date: status === 'Completed' ? today() : null, ...(status === 'Completed' ? { progress_pct: 100 } : {}) }
    setProjects(ps => ps.map(x => x.id === p.id ? { ...x, ...payload } : x))
    const { error } = await supabase.from('cm_projects').update(payload).eq('id', p.id)
    if (error) { notify('Could not change status: ' + error.message, true); loadAll(true); return }
    await logActivity(p.id, 'edited', `Status changed from ${p.status} to ${status}`, myName)
    notify(`${p.name} → ${status}`); loadAll(true)
  }

  // ── payments & milestones ──
  const addPayment = async (p, pay, file) => {
    if (!pay.amount || Number(pay.amount) <= 0) { notify('Enter a valid payment amount.', true); return false }
    const payload = { project_id: p.id, amount: Number(pay.amount), pay_date: pay.pay_date || today(), pay_mode: pay.pay_mode, txn_ref: pay.txn_ref || null,
      paid_by: pay.paid_by || myName || null, received_by: pay.received_by || null, notes: pay.notes || null, created_by: myName || null }
    const { data: inserted, error } = await supabase.from('cm_project_payments').insert(payload).select().single()
    if (error) { notify('Could not record payment: ' + error.message, true); return false }
    try { if (file && inserted?.id) { const url = await uploadFile('receipts', file, inserted.id); if (url) await supabase.from('cm_project_payments').update({ receipt_url: url }).eq('id', inserted.id) } }
    catch (err) { notify(err.message, true) }
    if (ext && /^retention release/i.test(payload.notes || '')) await supabase.from('cm_projects').update({ retention_released: true }).eq('id', p.id)
    await logActivity(p.id, 'payment_added', `Payment of ${fmt(payload.amount)} recorded (${payload.pay_mode})`, myName)
    const after = p.paid + payload.amount, budget = Number(p.budget_amount) || 0
    notify(budget && after > budget ? `⚠ Payment saved — project is now ${fmt(after - budget)} over budget` : `✅ Payment of ${fmt(payload.amount)} recorded`, budget && after > budget)
    await loadAll(true); return { ...payload, id: inserted?.id }
  }
  const deletePayment = async pm => {
    if (!window.confirm(`Delete this payment of ${fmt(pm.amount)}?`)) return
    const { error } = await supabase.from('cm_project_payments').delete().eq('id', pm.id)
    if (error) { notify('Could not delete payment: ' + error.message, true); return }
    await logActivity(pm.project_id, 'payment_deleted', `Payment of ${fmt(pm.amount)} deleted`, myName); await loadAll(true)
  }
  const addMilestone = async (p, ms) => {
    if (!ms.label.trim()) { notify('Milestone label is required.', true); return false }
    const payload = { project_id: p.id, label: ms.label.trim(), due_date: ms.due_date || null, planned_amount: Number(ms.planned_amount) || 0, sort_order: (milestonesByProject[p.id] || []).length, created_by: myName || null }
    const { error } = await supabase.from('cm_milestones').insert(payload)
    if (error) { notify('Could not add milestone: ' + error.message, true); return false }
    await logActivity(p.id, 'milestone_added', `Milestone "${payload.label}" added (${fmt(payload.planned_amount)} due ${payload.due_date || 'no date set'})`, myName)
    await loadAll(true); return true
  }
  const toggleMilestonePaid = async ms => {
    const payload = ms.is_paid ? { is_paid: false, paid_at: null, linked_payment_id: null } : { is_paid: true, paid_at: new Date().toISOString() }
    const { error } = await supabase.from('cm_milestones').update(payload).eq('id', ms.id)
    if (error) { notify('Could not update milestone: ' + error.message, true); return }
    await logActivity(ms.project_id, 'milestone_paid', `Milestone "${ms.label}" marked as ${payload.is_paid ? 'paid' : 'unpaid'}`, myName); await loadAll(true)
  }
  const deleteMilestone = async ms => {
    if (!window.confirm(`Delete milestone "${ms.label}"?`)) return
    const { error } = await supabase.from('cm_milestones').delete().eq('id', ms.id)
    if (error) { notify('Could not delete milestone: ' + error.message, true); return }
    await loadAll(true)
  }

  // ── generic rows for the advanced tables ──
  const insertRow = async (table, row, log) => {
    const { data, error } = await supabase.from(table).insert({ ...row, created_by: myName || null }).select().single()
    if (error) { notify(isMissing(error) ? SQL_HINT : 'Could not save: ' + error.message, true); return null }
    if (log && row.project_id) await logActivity(row.project_id, table, log, myName)
    await loadAll(true); return data
  }
  const updateRow = async (table, id, patch, log, projectId) => {
    const { error } = await supabase.from(table).update(patch).eq('id', id)
    if (error) { notify('Could not update: ' + error.message, true); return false }
    if (log && projectId) await logActivity(projectId, table, log, myName)
    await loadAll(true); return true
  }
  const deleteRow = async (table, id, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) { notify('Could not delete: ' + error.message, true); return }
    await loadAll(true)
  }

  // ── PDFs & exports ──
  const generateProjectReport = p => {
    const pays = (paymentsByProject[p.id] || []).slice().sort((a, b) => (a.pay_date || '').localeCompare(b.pay_date || ''))
    const ms = milestonesByProject[p.id] || [], mats = materialsByProject[p.id] || [], iss = issuesByProject[p.id] || []
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    let y = pdfHeader(doc, `PROJECT REPORT — ${p.name.toUpperCase()}`)
    doc.setFontSize(10)
    const line = t => { doc.text(t, 40, y); y += 15 }
    line(`Category: ${p.category}    Status: ${p.status}    Priority: ${p.priority || 'Medium'}    Progress: ${p.progress}%    Health: ${HEALTH[p.health][0]}`)
    line(`Contractor: ${p.contractor || '—'}${p.contractor_phone ? ' · ' + p.contractor_phone : ''}${p.location ? '    Location: ' + p.location : ''}`)
    line(`Budget: ${fmt(p.budget_amount)}    Paid: ${fmt(p.paid)}    Remaining: ${fmt(p.remaining)}    Forecast final cost: ${fmt(p.forecast)}`)
    line(`Start: ${p.start_date || '—'}    Target end: ${p.target_end_date || '—'}    Completed: ${p.completed_date || '—'}`)
    if (Number(p.retention_pct) > 0) line(`Retention: ${p.retention_pct}% of budget = ${fmt(p.retention)} (${p.retention_released ? 'released' : 'held'})`)
    if (p.description) { const t = doc.splitTextToSize(`Description: ${p.description}`, 515); doc.text(t, 40, y); y += t.length * 13 }
    if (p.notes) { const t = doc.splitTextToSize(`Notes: ${p.notes}`, 515); doc.text(t, 40, y); y += t.length * 13 }
    const table = (title, head, body) => {
      if (!body.length) return
      if (y > 720) { doc.addPage(); y = 50 }
      doc.setFontSize(11); doc.setFont(undefined, 'bold'); doc.text(title, 40, y + 8); doc.setFont(undefined, 'normal')
      autoTable(doc, { startY: y + 14, head: [head], body, styles: { fontSize: 8 }, headStyles: { fillColor: [19, 42, 79] }, margin: { left: 40, right: 40 } })
      y = doc.lastAutoTable.finalY + 18
    }
    y += 6
    table('Payments', ['Date', 'Amount', 'Mode', 'Ref', 'Paid By', 'Received By', 'Receipt'], pays.map(pm => [pm.pay_date, fmt(pm.amount), pm.pay_mode || '—', pm.txn_ref || '—', pm.paid_by || '—', pm.received_by || '—', pm.receipt_url ? 'Yes' : 'No']))
    if (!pays.length) { doc.text('No payments recorded.', 40, y); y += 18 }
    table('Payment Milestones', ['Milestone', 'Due Date', 'Planned Amount', 'Status'], ms.map(m => [m.label, m.due_date || '—', fmt(m.planned_amount), m.is_paid ? 'Paid' : 'Pending']))
    table('Bill of Quantities', ['Item', 'Unit', 'Est. qty × rate', 'Estimated', 'Actual', 'Variance'], mats.map(m => { const e = m.est_qty * m.est_rate, a = m.actual_qty != null ? m.actual_qty * (m.actual_rate ?? m.est_rate) : null; return [m.item, m.unit || '—', `${m.est_qty} × ${fmt(m.est_rate)}`, fmt(e), a == null ? '—' : fmt(a), a == null ? '—' : fmt(a - e)] }))
    table('Issues', ['Issue', 'Priority', 'Status', 'Assigned', 'Due'], iss.map(i => [i.title, i.priority, i.status, i.assigned_to || '—', i.due_date || '—']))
    doc.save(`${p.name.replace(/[^a-z0-9]+/gi, '_')}_report.pdf`)
  }
  const portfolioReport = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
    let y = pdfHeader(doc, `PORTFOLIO REPORT — ${niceDate(today()).toUpperCase()}`)
    doc.setFontSize(10)
    doc.text(`Projects: ${summary.count}   Active: ${summary.active}   Budget: ${fmt(summary.totalBudget)}   Paid: ${fmt(summary.totalPaid)}   Remaining: ${fmt(summary.remaining)}   Forecast final cost: ${fmt(summary.forecast)}   Health: ${summary.score}% on track`, 40, y)
    autoTable(doc, { startY: y + 12, head: [['Project', 'Category', 'Status', 'Priority', 'Contractor', 'Budget', 'Paid', 'Remaining', 'Progress', 'Target', 'Health']],
      body: filtered.map(p => [p.name, p.category, p.status, p.priority || 'Medium', p.contractor || '—', fmt(p.budget_amount), fmt(p.paid), fmt(p.remaining), `${p.progress}%`, p.target_end_date || '—', HEALTH[p.health][0]]),
      styles: { fontSize: 8 }, headStyles: { fillColor: [19, 42, 79] }, margin: { left: 40, right: 40 } })
    if (duePayments.length) {
      let yy = doc.lastAutoTable.finalY + 22
      doc.setFont(undefined, 'bold'); doc.text('Milestone payments due in the next 30 days', 40, yy); doc.setFont(undefined, 'normal')
      autoTable(doc, { startY: yy + 8, head: [['Due', 'Project', 'Milestone', 'Amount', '']], body: duePayments.map(m => [m.due_date, m.project?.name, m.label, fmt(m.planned_amount), m.overdue ? 'OVERDUE' : '']), styles: { fontSize: 8 }, headStyles: { fillColor: [184, 146, 58] }, margin: { left: 40, right: 40 } })
    }
    doc.save(`GNSI_construction_portfolio_${today()}.pdf`)
  }
  const paymentVoucher = (p, pm) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a5' })
    const w = doc.internal.pageSize.getWidth()
    let y = pdfHeader(doc, 'PAYMENT VOUCHER')
    doc.setFontSize(9.5)
    const vno = `CMV-${String(pm.pay_date || '').replace(/-/g, '').slice(2)}-${String(pm.id).slice(-5).toUpperCase()}`
    doc.text(`Voucher No: ${vno}`, 30, y); doc.text(`Date: ${niceDate(pm.pay_date)}`, w - 30, y, { align: 'right' }); y += 22
    autoTable(doc, { startY: y, theme: 'grid', styles: { fontSize: 9.5, cellPadding: 6 }, columnStyles: { 0: { fontStyle: 'bold', cellWidth: 120, fillColor: [250, 248, 243] } }, margin: { left: 30, right: 30 },
      body: [['Paid to', pm.received_by || p.contractor || '—'], ['Project', `${p.name} (${p.category})`], ['Amount', fmt(pm.amount)], ['In words', inWords(pm.amount)],
        ['Mode / Ref', `${pm.pay_mode || '—'}${pm.txn_ref ? ' · ' + pm.txn_ref : ''}`], ['Paid by', pm.paid_by || '—'], ['Towards', pm.notes || 'Project work'],
        ['Project status', `Budget ${fmt(p.budget_amount)} · paid to date ${fmt(p.paid)} · balance ${fmt(p.remaining)}`]] })
    y = doc.lastAutoTable.finalY + 60
    doc.line(30, y, 150, y); doc.line(w / 2 - 60, y, w / 2 + 60, y); doc.line(w - 150, y, w - 30, y)
    doc.setFontSize(8.5); doc.text('Prepared by', 90, y + 12, { align: 'center' }); doc.text('Approved by', w / 2, y + 12, { align: 'center' }); doc.text('Receiver signature', w - 90, y + 12, { align: 'center' })
    doc.save(`${vno}.pdf`)
  }
  const exportCSV = () => downloadCSV(`GNSI_projects_${today()}.csv`,
    ['Project', 'Category', 'Status', 'Priority', 'Location', 'Contractor', 'Phone', 'Budget', 'Paid', 'Remaining', 'Forecast', 'Progress %', 'Start', 'Target', 'Completed', 'Health'],
    filtered.map(p => [p.name, p.category, p.status, p.priority || 'Medium', p.location, p.contractor, p.contractor_phone, p.budget_amount, p.paid, p.remaining, Math.round(p.forecast), p.progress, p.start_date, p.target_end_date, p.completed_date, HEALTH[p.health][0]]))
  const exportPayments = () => downloadCSV(`GNSI_project_payments_${today()}.csv`, ['Date', 'Project', 'Amount', 'Mode', 'Ref', 'Paid by', 'Received by', 'Notes', 'Receipt'],
    payments.map(pm => [pm.pay_date, byId.get(pm.project_id)?.name, pm.amount, pm.pay_mode, pm.txn_ref, pm.paid_by, pm.received_by, pm.notes, pm.receipt_url]))

  const openProject = (p, t = 'overview') => { setOpenId(p.id); setDrawerTab(t) }

  if (loading) {
    return (
      <div className="cm"><style>{CSS}</style>
        <div className="cm-hero" style={{ paddingBottom: 30 }}><div className="cm-wrap"><div className="cm-eyebrow">Campus works</div><h1 className="cm-serif">Construction &amp; Maintenance</h1><p>Loading projects…</p></div></div>
      </div>
    )
  }

  const TABS = [['dashboard', '📊 Dashboard'], ['projects', '🏗️ Projects', rows.filter(p => p.active).length], ['timeline', '🗓️ Timeline'], ['maintenance', '🔧 Maintenance', alerts.maintDue.length || null], ['contractors', '👷 Contractors']]
  const sortBy = key => setSort(s => ({ key, dir: s.key === key ? -s.dir : 1 }))

  return (
    <div className="cm">
      <style>{CSS}</style>
      {toast && <div className="cm-toast" role="status" style={toast.err ? { background: '#7f1d1d' } : undefined}>{toast.msg}</div>}

      <header className="cm-hero">
        <div className="cm-wrap">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div className="cm-eyebrow">Campus works · GNSI</div>
              <h1 className="cm-serif">Construction &amp; Maintenance</h1>
              <p>Projects, budgets, payments and upkeep — kept separate from the main accounts ledger.</p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="cm-btn glass" onClick={portfolioReport} disabled={!rows.length}>📄 Portfolio PDF</button>
              <button className="cm-btn gold" onClick={() => setForm({ mode: 'add', project: emptyProject })}>+ New project</button>
            </div>
          </div>
          <nav className="cm-tabs">{TABS.map(([id, l, n]) => <button key={id} className={`cm-tab${tab === id ? ' on' : ''}`} onClick={() => setTab(id)}>{l}{n ? <span className="n">{n}</span> : null}</button>)}</nav>
        </div>
      </header>

      <main className="cm-wrap" style={{ paddingTop: 18 }}>
        {!ext && (
          <div className="cm-alert" style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', marginBottom: 14 }}>
            <span style={{ fontSize: 18 }}>🧩</span><div><b>Some features are waiting for setup</b>Site photos, BOQ, issues, site diary, contractors, maintenance schedule, priority/location and retention need <code>cm_advanced.sql</code> — run it once in the Supabase SQL Editor.</div>
          </div>
        )}

        {tab === 'dashboard' && (
          <Dashboard summary={summary} alerts={alerts} duePayments={duePayments} cashflow={cashflow} categorySpend={categorySpend} statusData={statusData}
            contractorSpend={contractorSpend} rows={rows} activityLog={activityLog} byId={byId} openProject={openProject} setTab={setTab} exportPayments={exportPayments} />
        )}

        {tab === 'projects' && (
          <>
            <div className="cm-tools">
              <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 360 }}>
                <input className="cm-in" style={{ paddingLeft: 36 }} placeholder="Search project, contractor, location…" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search projects" />
                <span style={{ position: 'absolute', left: 12, top: 10, color: 'var(--faint)' }}>🔍</span>
              </div>
              <select className="cm-in" style={{ width: 'auto' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Status"><option value="All">All statuses</option>{STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}</select>
              <select className="cm-in" style={{ width: 'auto' }} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} aria-label="Category"><option value="All">All categories</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
              {ext && <select className="cm-in" style={{ width: 'auto' }} value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} aria-label="Priority"><option value="All">All priorities</option>{PRIORITIES.map(c => <option key={c}>{c}</option>)}</select>}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <div className="cm-seg">{[['cards', '▦ Cards'], ['board', '▥ Board'], ['table', '☰ Table']].map(([v, l]) => <button key={v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>{l}</button>)}</div>
                <button className="cm-btn ghost" onClick={exportCSV} disabled={!filtered.length}>⬇ Excel/CSV</button>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="cm-card"><Empty icon="🏗️">{projects.length ? 'No projects match these filters.' : <>No projects yet. <button className="cm-btn sm gold" style={{ marginLeft: 8 }} onClick={() => setForm({ mode: 'add', project: emptyProject })}>+ Create the first one</button></>}</Empty></div>
            ) : view === 'cards' ? (
              <div className="cm-grid">
                {filtered.map(p => (
                  <article key={p.id} className="cm-pcard" onClick={() => openProject(p)} style={p.health === 'critical' ? { borderColor: '#fecaca' } : p.health === 'risk' ? { borderColor: '#fde68a' } : undefined}>
                    <div className="top">
                      <div className="ic">{CATEGORY_ICON[p.category] || '📁'}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="nm">{p.name}</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 5 }}><Chip status={p.status} />{p.active && <HealthChip h={p.health} />}{ext && p.priority && p.priority !== 'Medium' && <PriorityChip p={p.priority} />}</div>
                      </div>
                      <Ring pct={p.progress} color={p.status === 'Completed' ? '#15803d' : '#132a4f'} />
                    </div>
                    <div className="meta">
                      {p.contractor && <span>👷 {p.contractor}</span>}{p.location && <span>📍 {p.location}</span>}
                      {p.daysLeft != null && p.active && <span style={{ color: p.daysLeft < 0 ? 'var(--red)' : p.daysLeft <= 14 ? 'var(--amber)' : undefined, fontWeight: 700 }}>{p.daysLeft < 0 ? `⏰ ${-p.daysLeft}d overdue` : `🎯 ${p.daysLeft}d left`}</span>}
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--mute)', marginBottom: 5 }}><span>Spent <b style={{ color: 'var(--ink)' }}>{fmtK(p.paid)}</b> of {fmtK(p.budget_amount)}</span><span style={{ fontWeight: 700, color: p.isOverBudget ? 'var(--red)' : 'var(--mute)' }}>{Math.round(p.budget_amount ? p.paid / p.budget_amount * 100 : 0)}%</span></div>
                      <div className="cm-bar"><div style={{ width: `${p.pctPaid}%`, background: p.isOverBudget ? '#dc2626' : 'linear-gradient(90deg,#1e3a6e,#132a4f)' }} />{p.progress > 0 && <span className="mark" title={`Work done ${p.progress}%`} style={{ left: `${p.progress}%` }} />}</div>
                    </div>
                    {(p.forecastOver || p.behind) && <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--amber)' }}>{p.forecastOver ? `📈 Heading for ~${fmtK(p.forecast)} (${fmtK(p.forecast - p.budget_amount)} over)` : `🐢 ${Math.round(-p.scheduleGap)}% behind schedule`}</div>}
                  </article>
                ))}
              </div>
            ) : view === 'board' ? (
              <div className="cm-board">
                {STATUS_OPTIONS.map(st => {
                  const col = filtered.filter(p => p.status === st), c = STATUS_COLORS[st]
                  return (
                    <div key={st} className={`cm-col${dropCol === st ? ' drop' : ''}`} onDragOver={e => { e.preventDefault(); setDropCol(st) }} onDragLeave={() => setDropCol(d => d === st ? null : d)}
                      onDrop={e => { e.preventDefault(); setDropCol(null); const p = byId.get(dragId); if (p) quickStatus(p, st) }}>
                      <h4><span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><i style={{ width: 9, height: 9, borderRadius: 99, background: c.dot, display: 'inline-block' }} />{st}</span><span style={{ fontSize: 11, color: 'var(--mute)' }}>{col.length} · {fmtK(col.reduce((a, p) => a + (Number(p.budget_amount) || 0), 0))}</span></h4>
                      {col.map(p => (
                        <div key={p.id} className="cm-bcard" draggable onDragStart={() => setDragId(p.id)} onDragEnd={() => setDragId(null)} onClick={() => openProject(p)} style={{ opacity: dragId === p.id ? .5 : 1, borderLeft: `3px solid ${HEALTH[p.health][1]}` }}>
                          <div style={{ fontWeight: 800, fontSize: 13.5, lineHeight: 1.3 }}>{CATEGORY_ICON[p.category]} {p.name}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--mute)', margin: '4px 0 7px' }}>{p.contractor || 'No contractor'}{p.target_end_date ? ` · due ${niceDate(p.target_end_date)}` : ''}</div>
                          <div className="cm-bar" style={{ height: 6 }}><div style={{ width: `${p.progress}%`, background: '#132a4f' }} /></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginTop: 5 }}><span>{p.progress}% done</span><b>{fmtK(p.paid)} / {fmtK(p.budget_amount)}</b></div>
                        </div>
                      ))}
                      {!col.length && <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--faint)', padding: 20 }}>Drag projects here</div>}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="cm-card" style={{ overflowX: 'auto' }}>
                <table className="cm-table" style={{ minWidth: 980 }}>
                  <thead><tr>{[['name', 'Project'], ['status', 'Status'], ['priority', 'Priority'], ['health', 'Health'], ['budget', 'Budget'], ['paid', 'Paid'], ['progress', 'Progress'], ['target', 'Target']].map(([k, l]) => <th key={k} onClick={() => sortBy(k)}>{l}{sort.key === k ? (sort.dir > 0 ? ' ▲' : ' ▼') : ''}</th>)}<th>Contractor</th></tr></thead>
                  <tbody>{filtered.map(p => (
                    <tr key={p.id} onClick={() => openProject(p)}>
                      <td><b>{CATEGORY_ICON[p.category]} {p.name}</b>{p.location && <div style={{ fontSize: 11.5, color: 'var(--mute)' }}>📍 {p.location}</div>}</td>
                      <td><Chip status={p.status} /></td><td><PriorityChip p={p.priority || 'Medium'} /></td><td><HealthChip h={p.health} /></td>
                      <td>{fmt(p.budget_amount)}</td><td style={{ fontWeight: 700, color: p.isOverBudget ? 'var(--red)' : 'var(--green)' }}>{fmt(p.paid)}</td>
                      <td style={{ minWidth: 120 }}><div className="cm-bar" style={{ height: 6 }}><div style={{ width: `${p.progress}%`, background: '#132a4f' }} /></div><span style={{ fontSize: 11.5 }}>{p.progress}%</span></td>
                      <td style={{ color: p.isOverdue ? 'var(--red)' : undefined, fontWeight: p.isOverdue ? 700 : 400 }}>{niceDate(p.target_end_date)}</td>
                      <td>{p.contractor || '—'}</td>
                    </tr>
                  ))}</tbody>
                  <tfoot><tr style={{ background: '#faf8f3', fontWeight: 800 }}><td colSpan={4} style={{ padding: '10px 12px' }}>{filtered.length} projects</td><td style={{ padding: '10px 12px' }}>{fmt(filtered.reduce((a, p) => a + (Number(p.budget_amount) || 0), 0))}</td><td style={{ padding: '10px 12px' }}>{fmt(filtered.reduce((a, p) => a + p.paid, 0))}</td><td colSpan={3} /></tr></tfoot>
                </table>
              </div>
            )}
          </>
        )}

        {tab === 'timeline' && <Timeline rows={rows.filter(p => p.status !== 'Cancelled')} milestones={milestones} openProject={openProject} />}
        {tab === 'maintenance' && <Maintenance ext={ext} items={maint} insertRow={insertRow} updateRow={updateRow} deleteRow={deleteRow} notify={notify} />}
        {tab === 'contractors' && <Contractors ext={ext} spend={contractorSpend} directory={contractors} rows={rows} insertRow={insertRow} updateRow={updateRow} openProject={openProject} />}
      </main>

      {open && (
        <ProjectDrawer p={open} tab={drawerTab} setTab={setDrawerTab} onClose={() => setOpenId(null)} ext={ext} myName={myName} notify={notify}
          pays={paymentsByProject[open.id] || []} ms={milestonesByProject[open.id] || []} log={activityByProject[open.id] || []}
          photos={photosByProject[open.id] || []} mats={materialsByProject[open.id] || []} iss={issuesByProject[open.id] || []} diary={logsByProject[open.id] || []}
          api={{ reload: () => loadAll(true), log: (id, a, d) => logActivity(id, a, d, myName), me: myName, addPayment, deletePayment, addMilestone, toggleMilestonePaid, deleteMilestone, updateProgress, quickStatus, insertRow, updateRow, deleteRow,
            edit: () => setForm({ mode: 'edit', project: open }), remove: () => deleteProject(open), duplicate: () => duplicateProject(open),
            report: () => generateProjectReport(open), voucher: pm => paymentVoucher(open, pm) }} />
      )}
      {form && <ProjectForm mode={form.mode} initial={form.project} ext={ext} contractors={contractors} onClose={() => setForm(null)}
        onSave={async (draft, file) => { const ok = await saveProject(draft, file, form.mode === 'edit' ? form.project : null); if (ok) setForm(null) }} />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════
function Dashboard({ summary, alerts, duePayments, cashflow, categorySpend, statusData, contractorSpend, rows, activityLog, byId, openProject, setTab, exportPayments }) {
  const scoreColor = summary.score >= 75 ? '#15803d' : summary.score >= 50 ? '#b45309' : '#dc2626'
  const alertCards = [
    ['⚠', 'Over budget', alerts.overBudget, '#dc2626', '#fef2f2', p => `${p.name} — ${fmt(p.paid - p.budget_amount)} over`],
    ['⏰', 'Past target date', alerts.overdue, '#b91c1c', '#fff1f2', p => `${p.name} — due ${niceDate(p.target_end_date)}`],
    ['🐢', 'Behind schedule', alerts.behind, '#b45309', '#fffbeb', p => `${p.name} — ${p.progress}% done, ${Math.round(p.elapsedPct)}% of time used`],
    ['📈', 'Heading over budget', alerts.forecastOver, '#c2410c', '#fff7ed', p => `${p.name} — forecast ${fmtK(p.forecast)} vs ${fmtK(p.budget_amount)}`],
  ].filter(a => a[2].length)
  const recent = activityLog.slice(0, 8)
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="cm-kpis">
        {[['Total budget', fmtK(summary.totalBudget), '#132a4f', `${summary.count} projects`], ['Spent so far', fmtK(summary.totalPaid), '#15803d', summary.totalBudget ? `${Math.round(summary.totalPaid / summary.totalBudget * 100)}% of budget` : ''],
          ['Remaining', fmtK(summary.remaining), summary.remaining < 0 ? '#dc2626' : '#7c3aed', summary.retentionHeld > 0 ? `${fmtK(summary.retentionHeld)} retention held` : 'budget left to spend'],
          ['Forecast final cost', fmtK(summary.forecast), summary.forecast > summary.totalBudget * 1.02 ? '#c2410c' : '#0e7490', summary.forecast > summary.totalBudget ? `${fmtK(summary.forecast - summary.totalBudget)} above budget` : 'within budget'],
          ['Active projects', summary.active, '#b45309', `${summary.ongoing} ongoing · ${summary.completed} completed`],
        ].map(([l, v, c, s]) => <div key={l} className="cm-kpi" style={{ '--c': c }}><div className="l">{l}</div><div className="v">{v}</div><div className="s">{s}</div></div>)}
        <div className="cm-kpi" style={{ '--c': scoreColor, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Ring pct={summary.score} color={scoreColor} />
          <div><div className="l">Portfolio health</div><div style={{ fontSize: 12, marginTop: 4, lineHeight: 1.5 }}><b style={{ color: '#15803d' }}>{summary.good}</b> on track · <b style={{ color: '#b45309' }}>{summary.risk}</b> at risk · <b style={{ color: '#dc2626' }}>{summary.critical}</b> critical</div></div>
        </div>
      </div>

      {(alertCards.length > 0 || alerts.maintDue.length > 0 || alerts.openIssues.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 10 }}>
          {alertCards.map(([ic, title, list, c, bg, line]) => (
            <div key={title} className="cm-alert" style={{ background: bg, border: `1px solid ${c}33`, color: c }}>
              <span style={{ fontSize: 18 }}>{ic}</span>
              <div style={{ minWidth: 0 }}><b>{list.length} {title.toLowerCase()}</b><ul>{list.slice(0, 4).map(p => <li key={p.id} onClick={() => openProject(p)}>{line(p)}</li>)}</ul></div>
            </div>
          ))}
          {alerts.maintDue.length > 0 && (
            <div className="cm-alert" style={{ background: '#ecfeff', border: '1px solid #a5f3fc', color: '#0e7490', cursor: 'pointer' }} onClick={() => setTab('maintenance')}>
              <span style={{ fontSize: 18 }}>🔧</span><div><b>{alerts.maintDue.length} maintenance task{alerts.maintDue.length > 1 ? 's' : ''} due this week</b><ul>{alerts.maintDue.slice(0, 4).map(m => <li key={m.id}>{m.asset} — {m.task} ({m.next_due < today() ? 'overdue' : niceDate(m.next_due)})</li>)}</ul></div>
            </div>
          )}
          {alerts.openIssues.length > 0 && (
            <div className="cm-alert" style={{ background: '#fdf4ff', border: '1px solid #f0abfc', color: '#a21caf' }}>
              <span style={{ fontSize: 18 }}>🚧</span><div><b>{alerts.openIssues.length} high-priority issue{alerts.openIssues.length > 1 ? 's' : ''} open</b><ul>{alerts.openIssues.slice(0, 4).map(i => <li key={i.id} onClick={() => { const p = byId.get(i.project_id); if (p) openProject(p, 'issues') }}>{i.title} — {byId.get(i.project_id)?.name}</li>)}</ul></div>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 16 }}>
        <div className="cm-card" style={{ padding: 18, gridColumn: 'span 2', minWidth: 0 }}>
          <div className="cm-h"><h3>💸 Monthly cash flow</h3><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span style={{ fontSize: 11.5, color: 'var(--mute)' }}>Paid (12 months) · planned milestones (next 3)</span><button className="cm-btn sm ghost" onClick={exportPayments}>⬇ Payments CSV</button></div></div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={cashflow} margin={{ left: -10, right: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0ece4" />
              <XAxis dataKey="month" tick={{ fontSize: 10.5, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1e5 ? `${(v / 1e5).toFixed(0)}L` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}k` : v} />
              <Tooltip formatter={v => fmt(v)} contentStyle={{ borderRadius: 10, border: '1px solid #e7e3da', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="paid" name="Paid" fill="#132a4f" radius={[5, 5, 0, 0]} />
              <Bar dataKey="planned" name="Planned (milestones)" fill="#b8923a" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="cm-card" style={{ padding: 18 }}>
          <div className="cm-h"><h3>📌 Projects by status</h3></div>
          {statusData.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart><Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>{statusData.map(d => <Cell key={d.name} fill={STATUS_COLORS[d.name]?.dot || '#94a3b8'} />)}</Pie><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} /></PieChart>
            </ResponsiveContainer>
          ) : <Empty icon="📭">No projects yet</Empty>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 16 }}>
        <div className="cm-card" style={{ padding: 18 }}>
          <div className="cm-h"><h3>🗓️ Payments due (next 30 days)</h3><b style={{ fontSize: 13 }}>{fmt(duePayments.reduce((a, m) => a + (Number(m.planned_amount) || 0), 0))}</b></div>
          {duePayments.length ? duePayments.slice(0, 8).map(m => (
            <div key={m.id} className="cm-row" style={{ cursor: 'pointer' }} onClick={() => openProject(m.project, 'milestones')}>
              <div style={{ width: 46, textAlign: 'center', flex: 'none', borderRadius: 10, padding: '4px 0', background: m.overdue ? '#fef2f2' : '#faf8f3', color: m.overdue ? 'var(--red)' : 'var(--ink)' }}>
                <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1 }}>{new Date(m.due_date + 'T00:00:00').getDate()}</div><div style={{ fontSize: 10, fontWeight: 700 }}>{new Date(m.due_date + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short' })}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, fontSize: 13.5 }}>{m.label}</div><div style={{ fontSize: 12, color: 'var(--mute)' }}>{m.project?.name}{m.overdue ? ' · overdue' : ''}</div></div>
              <b>{fmt(m.planned_amount)}</b>
            </div>
          )) : <Empty icon="✅">No milestone payments due in the next 30 days.</Empty>}
        </div>
        <div className="cm-card" style={{ padding: 18 }}>
          <div className="cm-h"><h3>📊 Category spend</h3></div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={categorySpend} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0ece4" />
              <XAxis dataKey="category" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1e5 ? `${(v / 1e5).toFixed(0)}L` : v} />
              <Tooltip formatter={v => fmt(v)} /><Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="budget" name="Budget" fill={CHART_COLORS[0]} radius={[5, 5, 0, 0]} /><Bar dataKey="paid" name="Paid" fill={CHART_COLORS[1]} radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="cm-card" style={{ padding: 18 }}>
          <div className="cm-h"><h3>👷 Top contractors</h3><button className="cm-btn sm ghost" onClick={() => setTab('contractors')}>All →</button></div>
          {contractorSpend.slice(0, 6).map(c => (
            <div key={c.contractor} className="cm-row">
              <div style={{ width: 34, height: 34, borderRadius: 99, background: 'var(--goldbg)', display: 'grid', placeItems: 'center', fontWeight: 800, color: '#6b5320', flex: 'none' }}>{c.contractor[0]}</div>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, fontSize: 13.5 }}>{c.contractor}</div><div style={{ fontSize: 11.5, color: 'var(--mute)' }}>{c.projectCount} project{c.projectCount > 1 ? 's' : ''} · budget {fmtK(c.budget)}</div></div>
              <b style={{ color: 'var(--green)' }}>{fmtK(c.paid)}</b>
            </div>
          ))}
          {!contractorSpend.length && <Empty icon="👷">No contractors yet.</Empty>}
        </div>
        <div className="cm-card" style={{ padding: 18 }}>
          <div className="cm-h"><h3>📜 Recent activity</h3></div>
          {recent.length ? recent.map(a => (
            <div key={a.id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line2)', fontSize: 12.5, cursor: 'pointer' }} onClick={() => { const p = byId.get(a.project_id); if (p) openProject(p, 'activity') }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--gold)', marginTop: 5, flex: 'none' }} />
              <div><b>{byId.get(a.project_id)?.name || 'Project'}</b> — {a.detail || a.action}<div style={{ fontSize: 11, color: 'var(--faint)' }}>{a.actor || 'Unknown'} · {new Date(a.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div></div>
            </div>
          )) : <Empty icon="📜">No activity yet.</Empty>}
        </div>
      </div>
      {!rows.length && <div className="cm-card"><Empty icon="🏗️">Add your first project with <b>+ New project</b> — the dashboard fills in as you record payments and progress.</Empty></div>}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TIMELINE (Gantt)
// ═══════════════════════════════════════════════════════════════════════════
function Timeline({ rows, milestones, openProject }) {
  const dated = rows.filter(p => p.start_date).sort((a, b) => a.start_date.localeCompare(b.start_date))
  if (!dated.length) return <div className="cm-card"><Empty icon="🗓️">Projects need a start date to appear on the timeline.</Empty></div>
  const t = today()
  const ends = dated.map(p => p.completed_date || p.target_end_date || addDays(p.start_date, 30))
  let from = dated[0].start_date, to = [...ends, addDays(t, 30)].sort().pop()
  from = from.slice(0, 8) + '01'
  const span = Math.max(1, daysBetween(from, to))
  const pos = d => Math.min(100, Math.max(0, daysBetween(from, d) / span * 100))
  const months = []; for (let d = new Date(from + 'T00:00:00'); d.toLocaleDateString('en-CA') <= to; d.setMonth(d.getMonth() + 1)) months.push(d.toLocaleDateString('en-CA'))
  const msBy = {}; milestones.forEach(m => { if (m.due_date) (msBy[m.project_id] ??= []).push(m) })
  return (
    <div className="cm-card" style={{ padding: '18px 18px 28px', overflowX: 'auto' }}>
      <div className="cm-h"><h3>🗓️ Project timeline</h3><span style={{ fontSize: 11.5, color: 'var(--mute)' }}>Bar = planned start → target · dark fill = work done · ◆ = milestone payment</span></div>
      <div className="cm-gantt" style={{ minWidth: 900 }}>
        <div className="cm-grow" style={{ minHeight: 30, borderBottom: '1px solid var(--line)' }}>
          <div />
          <div className="cm-track" style={{ height: 30, overflow: 'hidden' }}>
            {months.map(m => <span key={m} style={{ position: 'absolute', left: `${pos(m)}%`, top: 8, fontSize: 10.5, fontWeight: 700, color: 'var(--mute)', borderLeft: '1px solid var(--line)', paddingLeft: 4, height: 22 }}>{new Date(m + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}</span>)}
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: 230, right: 0, top: 0, bottom: 0, pointerEvents: 'none' }}><div className="cm-today" style={{ left: `${pos(t)}%` }} /></div>
          {dated.map(p => {
            const end = p.completed_date || p.target_end_date || addDays(p.start_date, 30)
            const left = pos(p.start_date), width = Math.max(1.5, pos(end) - left), c = STATUS_COLORS[p.status]?.dot || '#64748b'
            return (
              <div key={p.id} className="cm-grow">
                <div className="n" onClick={() => openProject(p)} title={p.name}>{CATEGORY_ICON[p.category]} {p.name}</div>
                <div className="cm-track">
                  <div className="cm-gbar" onClick={() => openProject(p)} title={`${p.name}: ${niceDate(p.start_date)} → ${niceDate(end)} · ${p.progress}% done`}
                    style={{ left: `${left}%`, width: `${width}%`, background: p.health === 'critical' ? '#dc2626' : c, outline: !p.target_end_date ? '2px dashed rgba(0,0,0,.25)' : 'none' }}>
                    <i style={{ width: `${p.progress}%` }} /><span>{p.progress}%</span>
                  </div>
                  {(msBy[p.id] || []).map(m => <span key={m.id} title={`${m.label} · ${fmt(m.planned_amount)} · ${m.is_paid ? 'paid' : 'due ' + niceDate(m.due_date)}`} style={{ position: 'absolute', left: `calc(${pos(m.due_date)}% - 6px)`, top: 36, fontSize: 11, color: m.is_paid ? '#15803d' : m.due_date < t ? '#dc2626' : '#b8923a' }}>◆</span>)}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PROJECT WORKSPACE (drawer)
// ═══════════════════════════════════════════════════════════════════════════
function ProjectDrawer({ p, tab, setTab, onClose, ext, myName, notify, pays, ms, log, photos, mats, iss, diary, api }) {
  const [payDraft, setPayDraft] = useState(null)
  const [progress, setProgress] = useState(p.progress)
  useEffect(() => { setProgress(p.progress) }, [p.id, p.progress])
  useEffect(() => { const k = e => e.key === 'Escape' && !document.querySelector('.cm-modal,.cm-light') && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  const openIssues = iss.filter(i => i.status !== 'Resolved').length
  const TABS = [['overview', 'Overview'], ['payments', 'Payments', pays.length], ['milestones', 'Milestones', ms.length], ['boq', 'BOQ', mats.length], ['photos', 'Photos', photos.length], ['issues', 'Issues', openIssues], ['diary', 'Site diary', diary.length], ['activity', 'Activity', log.length]]
  const [hl, hc] = HEALTH[p.health]
  const waProgress = p.contractor_phone && waLink(p.contractor_phone, `Dear ${p.contractor || 'Sir'},\n\nPlease share today's progress update for *${p.name}* (currently ${p.progress}% complete${p.target_end_date ? `, target ${niceDate(p.target_end_date)}` : ''}), with a few site photos if possible.\n\n— GNSI, Khangabok`)
  const commitProgress = () => { if (progress !== p.progress) api.updateProgress(p, progress) }

  return (
    <>
      <div className="cm-ov" onClick={onClose} />
      <aside className="cm-drawer" role="dialog" aria-label={p.name}>
        <div className="cm-dhead">
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ width: 46, height: 46, borderRadius: 13, background: 'rgba(255,255,255,.1)', display: 'grid', placeItems: 'center', fontSize: 22, flex: 'none' }}>{CATEGORY_ICON[p.category] || '📁'}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="cm-serif" style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>{p.name}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                <Chip status={p.status} />{p.active && <span className="cm-chip" style={{ background: 'rgba(255,255,255,.12)', color: hc === '#15803d' ? '#86efac' : hc === '#b45309' ? '#fde68a' : '#fca5a5' }}>● {hl}</span>}
                {ext && <span className="cm-chip" style={{ background: 'rgba(255,255,255,.12)', color: '#fff' }}>⚑ {p.priority || 'Medium'}</span>}
                <span className="cm-chip" style={{ background: 'rgba(255,255,255,.12)', color: 'rgba(255,255,255,.8)' }}>{p.category}</span>
              </div>
            </div>
            <button className="cm-x w" onClick={onClose} aria-label="Close">×</button>
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12.5, color: 'rgba(255,255,255,.75)', marginTop: 10 }}>
            {p.contractor && <span>👷 {p.contractor}{p.contractor_phone && <> · <a href={`tel:${p.contractor_phone}`} style={{ color: 'var(--gold2)' }}>{p.contractor_phone}</a></>}</span>}
            {p.location && <span>📍 {p.location}</span>}
            {p.start_date && <span>📅 {niceDate(p.start_date)} → {niceDate(p.completed_date || p.target_end_date)}</span>}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
            <button className="cm-btn sm glass" onClick={api.edit}>✏️ Edit</button>
            <button className="cm-btn sm glass" onClick={api.report}>📄 PDF report</button>
            {waProgress && <a className="cm-btn sm glass" style={{ textDecoration: 'none' }} href={waProgress} target="_blank" rel="noopener noreferrer">💬 Ask for update</a>}
            <button className="cm-btn sm glass" onClick={api.duplicate}>⧉ Duplicate</button>
            <button className="cm-btn sm glass" style={{ color: '#fca5a5' }} onClick={api.remove}>🗑 Delete</button>
          </div>
          <nav className="cm-dtabs">{TABS.map(([id, l, n]) => <button key={id} className={`cm-dtab${tab === id ? ' on' : ''}`} onClick={() => setTab(id)}>{l}{n ? <span className="n">{n}</span> : null}</button>)}</nav>
        </div>

        <div className="cm-dbody">
          {tab === 'overview' && (
            <div style={{ display: 'grid', gap: 14 }}>
              <div className="cm-kpis" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))' }}>
                {[['Budget', fmt(p.budget_amount), '#132a4f'], ['Paid', fmt(p.paid), '#15803d'], [p.remaining < 0 ? 'Over budget' : 'Remaining', fmt(Math.abs(p.remaining)), p.remaining < 0 ? '#dc2626' : '#7c3aed'], ['Forecast final', fmt(p.forecast), p.forecastOver ? '#c2410c' : '#0e7490']].map(([l, v, c]) => <div key={l} className="cm-kpi" style={{ '--c': c }}><div className="l">{l}</div><div className="v" style={{ fontSize: 19 }}>{v}</div></div>)}
              </div>
              <div className="cm-sub">
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Ring pct={progress} color={p.status === 'Completed' ? '#15803d' : '#132a4f'} />
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700 }}><span>Work progress</span><span>{progress}%</span></div>
                    <input className="cm-range" type="range" min="0" max="100" step="5" value={progress} disabled={p.status === 'Completed'} aria-label="Work progress"
                      onChange={e => setProgress(Number(e.target.value))} onMouseUp={commitProgress} onTouchEnd={commitProgress} onKeyUp={commitProgress} />
                    <div style={{ fontSize: 12, color: 'var(--mute)' }}>
                      {p.elapsedPct != null ? <>Time used <b>{Math.round(p.elapsedPct)}%</b> · work done <b>{p.progress}%</b> — <b style={{ color: p.behind ? 'var(--amber)' : 'var(--green)' }}>{p.behind ? `${Math.round(-p.scheduleGap)}% behind` : p.scheduleGap > 10 ? `${Math.round(p.scheduleGap)}% ahead` : 'on schedule'}</b></> : 'Set start and target dates to track the schedule.'}
                      {p.daysLeft != null && p.active && <> · {p.daysLeft < 0 ? <b style={{ color: 'var(--red)' }}>{-p.daysLeft} days overdue</b> : <>{p.daysLeft} days left</>}</>}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--mute)', marginBottom: 5 }}><span>Budget used {Math.round(p.budget_amount ? p.paid / p.budget_amount * 100 : 0)}%</span><span>▮ = work done</span></div>
                  <div className="cm-bar" style={{ height: 10 }}><div style={{ width: `${p.pctPaid}%`, background: p.isOverBudget ? '#dc2626' : 'linear-gradient(90deg,#1e3a6e,#132a4f)' }} />{p.progress > 0 && <span className="mark" style={{ left: `${p.progress}%` }} />}</div>
                  {p.forecastOver && <div style={{ fontSize: 12.5, color: '#c2410c', fontWeight: 700, marginTop: 8 }}>📈 At the current spend rate this project will cost about {fmt(p.forecast)} — {fmt(p.forecast - p.budget_amount)} over budget.</div>}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--mute)', alignSelf: 'center' }}>Status:</span>
                  {STATUS_OPTIONS.map(s => <button key={s} className={`cm-btn sm ${p.status === s ? '' : 'ghost'}`} onClick={() => api.quickStatus(p, s)}>{s}</button>)}
                </div>
              </div>

              {ext && Number(p.retention_pct) > 0 && (
                <div className="cm-sub" style={{ background: 'var(--goldbg)', borderColor: 'var(--gold2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>🔒 Retention money — {p.retention_pct}% of budget</div>
                      <div style={{ fontSize: 12.5, color: '#6b5320', marginTop: 3 }}>
                        {p.retention_released ? `Released ✓ (${fmt(p.retention)})` : <>Hold <b>{fmt(p.retention)}</b> until the work is completed and checked. Pay no more than <b>{fmt((Number(p.budget_amount) || 0) - p.retention)}</b> before then.</>}
                      </div>
                      {!p.retention_released && p.status !== 'Completed' && p.paid > (Number(p.budget_amount) || 0) - p.retention && <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--red)', marginTop: 4 }}>⚠ Payments have already gone into the retention amount.</div>}
                    </div>
                    {!p.retention_released && p.status === 'Completed' && <button className="cm-btn gold sm" onClick={() => { setPayDraft({ ...emptyPayment, amount: String(Math.round(p.retention)), notes: 'Retention release', received_by: p.contractor || '' }); setTab('payments') }}>Release retention</button>}
                  </div>
                </div>
              )}

              {(p.description || p.notes || p.contract_file_url) && (
                <div className="cm-sub">
                  {p.description && <><div className="cm-lbl">Description</div><p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.6 }}>{p.description}</p></>}
                  {p.notes && <><div className="cm-lbl">Notes</div><p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.6 }}>{p.notes}</p></>}
                  {p.contract_file_url && <a className="cm-btn sm ghost" style={{ textDecoration: 'none' }} href={p.contract_file_url} target="_blank" rel="noreferrer">📄 Contract / agreement</a>}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
                {[['payments', '💳', `${pays.length} payments`, fmt(p.paid)], ['milestones', '🎯', `${ms.filter(m => !m.is_paid).length} milestones pending`, fmt(ms.filter(m => !m.is_paid).reduce((a, m) => a + (Number(m.planned_amount) || 0), 0))],
                  ['issues', '🚧', `${openIssues} open issues`, openIssues ? 'needs attention' : 'all clear'], ['photos', '📷', `${photos.length} site photos`, photos[0] ? niceDate(photos[0].taken_on) : 'none yet']].map(([t, ic, l, s]) => (
                  <button key={t} className="cm-sub" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => setTab(t)}><div style={{ fontSize: 20 }}>{ic}</div><b style={{ fontSize: 13 }}>{l}</b><div style={{ fontSize: 12, color: 'var(--mute)' }}>{s}</div></button>
                ))}
              </div>
            </div>
          )}
          {tab === 'payments' && <PaymentsTab p={p} pays={pays} api={api} myName={myName} draft={payDraft} setDraft={setPayDraft} />}
          {tab === 'milestones' && <MilestonesTab p={p} ms={ms} api={api} />}
          {tab === 'boq' && (ext ? <BOQTab p={p} mats={mats} api={api} /> : <Empty icon="🧱">{SQL_HINT}</Empty>)}
          {tab === 'photos' && (ext ? <PhotosTab p={p} photos={photos} api={api} notify={notify} /> : <Empty icon="📷">{SQL_HINT}</Empty>)}
          {tab === 'issues' && (ext ? <IssuesTab p={p} iss={iss} api={api} /> : <Empty icon="🚧">{SQL_HINT}</Empty>)}
          {tab === 'diary' && (ext ? <DiaryTab p={p} diary={diary} api={api} /> : <Empty icon="📓">{SQL_HINT}</Empty>)}
          {tab === 'activity' && (log.length ? (
            <div className="cm-sub">
              {log.map(a => (
                <div key={a.id} style={{ display: 'flex', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--line2)' }}>
                  <span style={{ width: 30, height: 30, borderRadius: 99, background: 'var(--goldbg)', display: 'grid', placeItems: 'center', fontSize: 13, flex: 'none' }}>{a.action?.includes('payment') ? '💳' : a.action?.includes('milestone') ? '🎯' : a.action === 'created' ? '✨' : '✏️'}</span>
                  <div style={{ fontSize: 13 }}><b>{a.actor || 'Unknown'}</b> — {a.detail || a.action}<div style={{ fontSize: 11.5, color: 'var(--faint)' }}>{new Date(a.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div></div>
                </div>
              ))}
            </div>
          ) : <Empty icon="📜">No activity recorded yet.</Empty>)}
        </div>
      </aside>
    </>
  )
}

function PaymentsTab({ p, pays, api, myName, draft, setDraft }) {
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [last, setLast] = useState(null)
  const f = draft
  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }))
  const save = async () => {
    setSaving(true)
    const res = await api.addPayment(p, f, file)
    setSaving(false)
    if (res) { setLast(res); setDraft(null); setFile(null) }
  }
  const waPaid = pm => p.contractor_phone && waLink(p.contractor_phone, `Dear ${pm.received_by || p.contractor || 'Sir'},\n\nPayment of *${fmt(pm.amount)}* for *${p.name}* has been made on ${niceDate(pm.pay_date)} via ${pm.pay_mode}${pm.txn_ref ? ` (ref ${pm.txn_ref})` : ''}.\nTotal paid to date: ${fmt(p.paid + (pays.some(x => x.id === pm.id) ? 0 : Number(pm.amount)))} of ${fmt(p.budget_amount)}.\n\nKindly acknowledge.\n— GNSI, Khangabok`)
  const sorted = pays.slice().sort((a, b) => (b.pay_date || '').localeCompare(a.pay_date || ''))
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {last && (
        <div className="cm-alert" style={{ background: '#ecfdf3', border: '1px solid #bbf7d0', color: '#166534', alignItems: 'center' }}>
          <span>✅</span><div style={{ flex: 1 }}><b>{fmt(last.amount)} recorded</b>Print a voucher or send the contractor a confirmation.</div>
          <button className="cm-btn sm ghost" onClick={() => api.voucher(last)}>🧾 Voucher</button>
          {waPaid(last) && <a className="cm-btn sm" style={{ textDecoration: 'none', background: '#15803d' }} href={waPaid(last)} target="_blank" rel="noopener noreferrer">💬 WhatsApp</a>}
        </div>
      )}
      {!f ? <div><button className="cm-btn gold" onClick={() => setDraft({ ...emptyPayment, received_by: p.contractor || '' })}>+ Record payment</button></div> : (
        <div className="cm-sub">
          <div className="cm-form">
            <Field label="Amount (₹) *"><input className="cm-in" type="number" autoFocus value={f.amount} onChange={e => set('amount', e.target.value)} /></Field>
            <Field label="Date"><input className="cm-in" type="date" value={f.pay_date} onChange={e => set('pay_date', e.target.value)} /></Field>
            <Field label="Mode"><select className="cm-in" value={f.pay_mode} onChange={e => set('pay_mode', e.target.value)}>{PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}</select></Field>
            <Field label="Txn ref"><input className="cm-in" value={f.txn_ref} onChange={e => set('txn_ref', e.target.value)} placeholder={f.pay_mode === 'Cash' ? 'Optional' : 'UTR / cheque no.'} /></Field>
            <Field label="Paid by"><input className="cm-in" placeholder={myName} value={f.paid_by} onChange={e => set('paid_by', e.target.value)} /></Field>
            <Field label="Received by (contractor side)"><input className="cm-in" value={f.received_by} onChange={e => set('received_by', e.target.value)} /></Field>
            <Field label="Receipt / photo"><input className="cm-in" style={{ paddingTop: 8 }} type="file" accept="image/*,.pdf" onChange={e => setFile(e.target.files?.[0] || null)} /></Field>
            <Field label="Notes" span><input className="cm-in" value={f.notes} onChange={e => set('notes', e.target.value)} placeholder="e.g. RA bill 2 — plinth work" /></Field>
          </div>
          {Number(f.amount) > 0 && Number(p.budget_amount) > 0 && p.paid + Number(f.amount) > Number(p.budget_amount) && <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--red)', marginTop: 10 }}>⚠ This takes the project {fmt(p.paid + Number(f.amount) - p.budget_amount)} over budget.</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}><button className="cm-btn" disabled={saving} onClick={save}>{saving ? 'Saving…' : '✓ Save payment'}</button><button className="cm-btn ghost" onClick={() => { setDraft(null); setFile(null) }}>Cancel</button></div>
        </div>
      )}
      {sorted.length === 0 ? <Empty icon="💳">No payments recorded yet.</Empty> : (
        <div className="cm-sub" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="cm-table" style={{ minWidth: 640 }}>
            <thead><tr><th>Date</th><th>Amount</th><th>Mode · Ref</th><th>Received by</th><th>Notes</th><th /></tr></thead>
            <tbody>{sorted.map(pm => (
              <tr key={pm.id} style={{ cursor: 'default' }}>
                <td style={{ whiteSpace: 'nowrap' }}>{niceDate(pm.pay_date)}</td>
                <td style={{ fontWeight: 800, color: 'var(--green)' }}>{fmt(pm.amount)}</td>
                <td>{pm.pay_mode || '—'}{pm.txn_ref ? <div style={{ fontSize: 11.5, color: 'var(--mute)' }}>{pm.txn_ref}</div> : null}</td>
                <td>{pm.received_by || '—'}<div style={{ fontSize: 11.5, color: 'var(--mute)' }}>by {pm.paid_by || '—'}</div></td>
                <td style={{ fontSize: 12.5, maxWidth: 180 }}>{pm.notes || '—'}</td>
                <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                  {pm.receipt_url && <a className="cm-btn sm ghost" style={{ textDecoration: 'none', marginRight: 4 }} href={pm.receipt_url} target="_blank" rel="noreferrer" title="Receipt">📎</a>}
                  <button className="cm-btn sm ghost" style={{ marginRight: 4 }} onClick={() => api.voucher(pm)} title="Payment voucher PDF">🧾</button>
                  {waPaid(pm) && <a className="cm-btn sm ghost" style={{ textDecoration: 'none', marginRight: 4 }} href={waPaid(pm)} target="_blank" rel="noopener noreferrer" title="WhatsApp confirmation">💬</a>}
                  <button className="cm-btn sm danger" onClick={() => api.deletePayment(pm)} title="Delete">✕</button>
                </td>
              </tr>
            ))}</tbody>
            <tfoot><tr style={{ background: '#faf8f3', fontWeight: 800 }}><td style={{ padding: '10px 12px' }}>Total</td><td style={{ padding: '10px 12px', color: 'var(--green)' }}>{fmt(p.paid)}</td><td colSpan={4} style={{ padding: '10px 12px', color: 'var(--mute)', fontWeight: 600 }}>{p.remaining < 0 ? `over budget by ${fmt(-p.remaining)}` : `${fmt(p.remaining)} left of ${fmt(p.budget_amount)}`}</td></tr></tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

function MilestonesTab({ p, ms, api }) {
  const [f, setF] = useState(null)
  const [saving, setSaving] = useState(false)
  const planned = ms.reduce((a, m) => a + (Number(m.planned_amount) || 0), 0)
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {!f && <button className="cm-btn gold" onClick={() => setF(emptyMilestone)}>+ Add milestone</button>}
        {ms.length > 0 && <span style={{ fontSize: 12.5, color: planned > Number(p.budget_amount) && Number(p.budget_amount) ? 'var(--red)' : 'var(--mute)' }}>Planned {fmt(planned)} of {fmt(p.budget_amount)} budget · {ms.filter(m => m.is_paid).length}/{ms.length} paid</span>}
      </div>
      {f && (
        <div className="cm-sub">
          <div className="cm-form">
            <Field label="Milestone *"><input className="cm-in" autoFocus value={f.label} onChange={e => setF(v => ({ ...v, label: e.target.value }))} placeholder="e.g. Foundation complete" /></Field>
            <Field label="Due date"><input className="cm-in" type="date" value={f.due_date} onChange={e => setF(v => ({ ...v, due_date: e.target.value }))} /></Field>
            <Field label="Planned amount (₹)"><input className="cm-in" type="number" value={f.planned_amount} onChange={e => setF(v => ({ ...v, planned_amount: e.target.value }))} /></Field>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}><button className="cm-btn" disabled={saving} onClick={async () => { setSaving(true); const ok = await api.addMilestone(p, f); setSaving(false); if (ok) setF(null) }}>{saving ? 'Saving…' : '✓ Save milestone'}</button><button className="cm-btn ghost" onClick={() => setF(null)}>Cancel</button></div>
        </div>
      )}
      {ms.length === 0 ? <Empty icon="🎯">No milestones yet — break the contract into stage payments (plinth, roof, finishing…).</Empty> : (
        <div className="cm-sub" style={{ padding: '4px 14px' }}>
          {ms.map((m, i) => {
            const overdue = m.due_date && !m.is_paid && m.due_date < today()
            return (
              <div key={m.id} className="cm-row">
                <button onClick={() => api.toggleMilestonePaid(m)} aria-label={m.is_paid ? 'Mark unpaid' : 'Mark paid'} style={{ width: 28, height: 28, borderRadius: 99, flex: 'none', border: `2px solid ${m.is_paid ? '#15803d' : overdue ? '#dc2626' : '#cfc7b6'}`, background: m.is_paid ? '#15803d' : '#fff', color: '#fff', fontWeight: 900 }}>{m.is_paid ? '✓' : i + 1}</button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, textDecoration: m.is_paid ? 'line-through' : 'none', color: m.is_paid ? 'var(--mute)' : 'var(--ink)' }}>{m.label}</div>
                  <div style={{ fontSize: 12, color: overdue ? 'var(--red)' : 'var(--mute)', fontWeight: overdue ? 700 : 400 }}>{m.is_paid ? `Paid ${m.paid_at ? niceDate(m.paid_at.slice(0, 10)) : ''}` : `Due ${niceDate(m.due_date)}${overdue ? ' · overdue' : ''}`}</div>
                </div>
                <b>{fmt(m.planned_amount)}</b>
                <button className="cm-btn sm danger" onClick={() => api.deleteMilestone(m)} aria-label="Delete milestone">✕</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function BOQTab({ p, mats, api }) {
  const blank = { item: '', unit: '', est_qty: '', est_rate: '', supplier: '' }
  const [f, setF] = useState(null)
  const est = m => (Number(m.est_qty) || 0) * (Number(m.est_rate) || 0)
  const act = m => m.actual_qty == null ? null : (Number(m.actual_qty) || 0) * (Number(m.actual_rate ?? m.est_rate) || 0)
  const totE = mats.reduce((a, m) => a + est(m), 0), totA = mats.reduce((a, m) => a + (act(m) ?? 0), 0), counted = mats.filter(m => act(m) != null)
  const varA = counted.reduce((a, m) => a + act(m) - est(m), 0)
  const save = async () => {
    if (!f.item.trim()) return
    const ok = await api.insertRow('cm_materials', { project_id: p.id, item: f.item.trim(), unit: f.unit || null, est_qty: Number(f.est_qty) || 0, est_rate: Number(f.est_rate) || 0, supplier: f.supplier || null }, `BOQ item "${f.item.trim()}" added`)
    if (ok) setF(blank)
  }
  const saveActual = (m, k, v) => { const num = v === '' ? null : Number(v); if ((m[k] ?? null) === num) return; api.updateRow('cm_materials', m.id, { [k]: num }) }
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="cm-kpis" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
        {[['Estimated (BOQ)', fmt(totE), '#132a4f'], ['Actual so far', fmt(totA), '#15803d'], ['Variance on counted items', `${varA > 0 ? '+' : ''}${fmt(varA)}`, varA > 0 ? '#dc2626' : '#15803d'], ['vs budget', Number(p.budget_amount) ? `${Math.round(totE / p.budget_amount * 100)}%` : '—', '#7c3aed']].map(([l, v, c]) => <div key={l} className="cm-kpi" style={{ '--c': c }}><div className="l">{l}</div><div className="v" style={{ fontSize: 18 }}>{v}</div></div>)}
      </div>
      {!f ? <div><button className="cm-btn gold" onClick={() => setF(blank)}>+ Add BOQ item</button></div> : (
        <div className="cm-sub">
          <div className="cm-form" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))' }}>
            <Field label="Item *"><input className="cm-in" autoFocus value={f.item} onChange={e => setF(v => ({ ...v, item: e.target.value }))} placeholder="e.g. Cement (OPC 53)" /></Field>
            <Field label="Unit"><input className="cm-in" list="cm-units" value={f.unit} onChange={e => setF(v => ({ ...v, unit: e.target.value }))} placeholder="bag / cft / nos" /></Field>
            <Field label="Est. qty"><input className="cm-in" type="number" value={f.est_qty} onChange={e => setF(v => ({ ...v, est_qty: e.target.value }))} /></Field>
            <Field label="Est. rate ₹"><input className="cm-in" type="number" value={f.est_rate} onChange={e => setF(v => ({ ...v, est_rate: e.target.value }))} /></Field>
            <Field label="Supplier"><input className="cm-in" value={f.supplier} onChange={e => setF(v => ({ ...v, supplier: e.target.value }))} /></Field>
          </div>
          <datalist id="cm-units">{['bag', 'cft', 'cum', 'sqft', 'sqm', 'kg', 'MT', 'nos', 'rft', 'ltr', 'trip', 'day'].map(u => <option key={u} value={u} />)}</datalist>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}><button className="cm-btn" onClick={save}>✓ Add item</button><button className="cm-btn ghost" onClick={() => setF(null)}>Done</button></div>
        </div>
      )}
      {mats.length === 0 ? <Empty icon="🧱">No BOQ items yet — list materials and labour with estimated quantity and rate, then fill in actuals as bills come in.</Empty> : (
        <div className="cm-sub" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="cm-table" style={{ minWidth: 720 }}>
            <thead><tr><th>Item</th><th>Estimate</th><th>Actual qty</th><th>Actual rate</th><th>Actual</th><th>Variance</th><th /></tr></thead>
            <tbody>{mats.map(m => { const e = est(m), a = act(m), v = a == null ? null : a - e; return (
              <tr key={m.id} style={{ cursor: 'default' }}>
                <td><b>{m.item}</b><div style={{ fontSize: 11.5, color: 'var(--mute)' }}>{m.unit || ''}{m.supplier ? ` · ${m.supplier}` : ''}</div></td>
                <td style={{ whiteSpace: 'nowrap' }}>{m.est_qty} × {fmt(m.est_rate)}<div style={{ fontWeight: 700 }}>{fmt(e)}</div></td>
                <td><input className="cm-in" style={{ height: 34, width: 90 }} type="number" defaultValue={m.actual_qty ?? ''} onBlur={ev => saveActual(m, 'actual_qty', ev.target.value)} aria-label="Actual quantity" /></td>
                <td><input className="cm-in" style={{ height: 34, width: 100 }} type="number" defaultValue={m.actual_rate ?? ''} placeholder={String(m.est_rate)} onBlur={ev => saveActual(m, 'actual_rate', ev.target.value)} aria-label="Actual rate" /></td>
                <td style={{ fontWeight: 700 }}>{a == null ? '—' : fmt(a)}</td>
                <td style={{ fontWeight: 800, color: v == null ? 'var(--faint)' : v > 0 ? 'var(--red)' : 'var(--green)' }}>{v == null ? '—' : `${v > 0 ? '+' : ''}${fmt(v)}`}</td>
                <td><button className="cm-btn sm danger" onClick={() => api.deleteRow('cm_materials', m.id, `Remove "${m.item}"?`)}>✕</button></td>
              </tr>
            ) })}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function PhotosTab({ p, photos, api, notify }) {
  const [stage, setStage] = useState('During')
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState('All')
  const [light, setLight] = useState(null)
  const upload = async e => {
    const files = [...(e.target.files || [])]; e.target.value = ''
    if (!files.length) return
    setBusy(true)
    try {
      for (const file of files) {
        const url = await uploadFile('photos', file, p.id)
        const { error } = await supabase.from('cm_photos').insert({ project_id: p.id, url, caption: caption || null, stage, taken_on: today(), created_by: api.me || null })
        if (error) throw new Error('Could not save photo: ' + error.message)
      }
      await api.log(p.id, 'photos', `${files.length} site photo${files.length > 1 ? 's' : ''} added (${stage})`)
      notify(`✅ ${files.length} photo${files.length > 1 ? 's' : ''} uploaded`); setCaption('')
      await api.reload()
    } catch (err) { notify(err.message, true) }
    setBusy(false)
  }
  const shown = photos.filter(x => filter === 'All' || x.stage === filter)
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="cm-sub" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Field label="Stage"><div className="cm-seg">{['Before', 'During', 'After'].map(s => <button key={s} className={stage === s ? 'on' : ''} onClick={() => setStage(s)}>{s}</button>)}</div></Field>
        <div style={{ flex: 1, minWidth: 180 }}><Field label="Caption (optional)"><input className="cm-in" value={caption} onChange={e => setCaption(e.target.value)} placeholder="e.g. Roof slab casting, east wing" /></Field></div>
        <label className="cm-btn gold" style={{ cursor: busy ? 'wait' : 'pointer' }}>{busy ? '⏳ Uploading…' : '📷 Add photos'}<input type="file" accept="image/*" multiple capture="environment" onChange={upload} disabled={busy} style={{ display: 'none' }} /></label>
      </div>
      {photos.length > 0 && <div className="cm-seg" style={{ justifySelf: 'start' }}>{['All', 'Before', 'During', 'After'].map(s => <button key={s} className={filter === s ? 'on' : ''} onClick={() => setFilter(s)}>{s} ({s === 'All' ? photos.length : photos.filter(x => x.stage === s).length})</button>)}</div>}
      {shown.length === 0 ? <Empty icon="📷">No photos yet — add before, during and after shots to keep a visual record of the work.</Empty> : (
        <div className="cm-photos">
          {shown.map(ph => (
            <div key={ph.id} className="cm-photo" onClick={() => setLight(ph)}>
              <img src={ph.url} alt={ph.caption || 'Site photo'} loading="lazy" />
              <span className="st">{ph.stage}</span>
              <div className="cap">{ph.caption || niceDate(ph.taken_on)}</div>
            </div>
          ))}
        </div>
      )}
      {light && (
        <div className="cm-light" onClick={() => setLight(null)}>
          <div style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <img src={light.url} alt={light.caption || 'Site photo'} />
            <div style={{ color: '#fff', marginTop: 10, fontSize: 13.5, display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
              <span>{light.stage} · {niceDate(light.taken_on)}{light.caption ? ` · ${light.caption}` : ''}</span>
              <a className="cm-btn sm glass" style={{ textDecoration: 'none' }} href={light.url} target="_blank" rel="noreferrer">Open</a>
              <button className="cm-btn sm glass" style={{ color: '#fca5a5' }} onClick={async () => { await api.deleteRow('cm_photos', light.id, 'Delete this photo?'); setLight(null) }}>Delete</button>
              <button className="cm-btn sm glass" onClick={() => setLight(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function IssuesTab({ p, iss, api }) {
  const blank = { title: '', priority: 'Medium', assigned_to: p.contractor || '', due_date: '', details: '' }
  const [f, setF] = useState(null)
  const [show, setShow] = useState('open')
  const t = today()
  const list = iss.filter(i => show === 'all' || (show === 'open' ? i.status !== 'Resolved' : i.status === 'Resolved'))
    .sort((a, b) => PRIORITIES.indexOf(b.priority) - PRIORITIES.indexOf(a.priority) || (a.due_date || '9').localeCompare(b.due_date || '9'))
  const setStatus = (i, status) => api.updateRow('cm_issues', i.id, { status, resolved_at: status === 'Resolved' ? new Date().toISOString() : null }, `Issue "${i.title}" → ${status}`, p.id)
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        {!f && <button className="cm-btn gold" onClick={() => setF(blank)}>+ Report issue</button>}
        <div className="cm-seg">{[['open', `Open (${iss.filter(i => i.status !== 'Resolved').length})`], ['resolved', 'Resolved'], ['all', 'All']].map(([v, l]) => <button key={v} className={show === v ? 'on' : ''} onClick={() => setShow(v)}>{l}</button>)}</div>
      </div>
      {f && (
        <div className="cm-sub">
          <div className="cm-form">
            <Field label="Issue *" span><input className="cm-in" autoFocus value={f.title} onChange={e => setF(v => ({ ...v, title: e.target.value }))} placeholder="e.g. Seepage in hostel block B, room 12" /></Field>
            <Field label="Priority"><select className="cm-in" value={f.priority} onChange={e => setF(v => ({ ...v, priority: e.target.value }))}>{PRIORITIES.map(x => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Assigned to"><input className="cm-in" value={f.assigned_to} onChange={e => setF(v => ({ ...v, assigned_to: e.target.value }))} /></Field>
            <Field label="Fix by"><input className="cm-in" type="date" value={f.due_date} onChange={e => setF(v => ({ ...v, due_date: e.target.value }))} /></Field>
            <Field label="Details" span><textarea className="cm-in" rows={2} value={f.details} onChange={e => setF(v => ({ ...v, details: e.target.value }))} /></Field>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button className="cm-btn" onClick={async () => { if (!f.title.trim()) return; const ok = await api.insertRow('cm_issues', { project_id: p.id, title: f.title.trim(), priority: f.priority, assigned_to: f.assigned_to || null, due_date: f.due_date || null, details: f.details || null }, `Issue reported: ${f.title.trim()} (${f.priority})`); if (ok) setF(null) }}>✓ Save issue</button>
            <button className="cm-btn ghost" onClick={() => setF(null)}>Cancel</button>
          </div>
        </div>
      )}
      {list.length === 0 ? <Empty icon={show === 'open' ? '✅' : '🚧'}>{show === 'open' ? 'No open issues — all clear.' : 'Nothing here yet.'}</Empty> : (
        <div style={{ display: 'grid', gap: 8 }}>
          {list.map(i => {
            const overdue = i.status !== 'Resolved' && i.due_date && i.due_date < t
            return (
              <div key={i.id} className="cm-sub" style={{ borderLeft: `4px solid ${PRIORITY_COLORS[i.priority]}`, opacity: i.status === 'Resolved' ? .65 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 800, textDecoration: i.status === 'Resolved' ? 'line-through' : 'none' }}>{i.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--mute)', marginTop: 3, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <PriorityChip p={i.priority} />{i.assigned_to && <span>👤 {i.assigned_to}</span>}{i.due_date && <span style={{ color: overdue ? 'var(--red)' : undefined, fontWeight: overdue ? 800 : 400 }}>🗓 {overdue ? 'overdue · ' : ''}{niceDate(i.due_date)}</span>}<span>reported {niceDate(i.created_at?.slice(0, 10))}{i.created_by ? ` by ${i.created_by}` : ''}</span>
                    </div>
                    {i.details && <div style={{ fontSize: 13, marginTop: 6, color: 'var(--ink2)' }}>{i.details}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                    <select className="cm-in" style={{ height: 32, width: 'auto', fontSize: 12.5 }} value={i.status} onChange={e => setStatus(i, e.target.value)} aria-label="Issue status">{['Open', 'In Progress', 'Resolved'].map(s => <option key={s}>{s}</option>)}</select>
                    <button className="cm-btn sm danger" onClick={() => api.deleteRow('cm_issues', i.id, `Delete issue "${i.title}"?`)}>✕</button>
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

function DiaryTab({ p, diary, api }) {
  const blank = { log_date: today(), weather: WEATHER[0], workers: '', work_done: '', materials_used: '', remarks: '' }
  const [f, setF] = useState(null)
  const workerDays = diary.reduce((a, d) => a + (Number(d.workers) || 0), 0)
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {!f && <button className="cm-btn gold" onClick={() => setF(blank)}>+ Today's site entry</button>}
        {diary.length > 0 && <span style={{ fontSize: 12.5, color: 'var(--mute)' }}>{diary.length} entries · {workerDays} worker-days logged</span>}
      </div>
      {f && (
        <div className="cm-sub">
          <div className="cm-form">
            <Field label="Date"><input className="cm-in" type="date" value={f.log_date} onChange={e => setF(v => ({ ...v, log_date: e.target.value }))} /></Field>
            <Field label="Weather"><select className="cm-in" value={f.weather} onChange={e => setF(v => ({ ...v, weather: e.target.value }))}>{WEATHER.map(w => <option key={w}>{w}</option>)}</select></Field>
            <Field label="Workers on site"><input className="cm-in" type="number" min="0" value={f.workers} onChange={e => setF(v => ({ ...v, workers: e.target.value }))} /></Field>
            <Field label="Work done today *" span><textarea className="cm-in" autoFocus rows={2} value={f.work_done} onChange={e => setF(v => ({ ...v, work_done: e.target.value }))} placeholder="e.g. Brickwork 2nd floor east wall, 60% done" /></Field>
            <Field label="Materials used"><input className="cm-in" value={f.materials_used} onChange={e => setF(v => ({ ...v, materials_used: e.target.value }))} placeholder="e.g. 40 bags cement, 2 trips sand" /></Field>
            <Field label="Remarks / hold-ups"><input className="cm-in" value={f.remarks} onChange={e => setF(v => ({ ...v, remarks: e.target.value }))} /></Field>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button className="cm-btn" onClick={async () => { if (!f.work_done.trim()) return; const ok = await api.insertRow('cm_site_logs', { project_id: p.id, log_date: f.log_date, weather: f.weather, workers: f.workers === '' ? null : Number(f.workers), work_done: f.work_done.trim(), materials_used: f.materials_used || null, remarks: f.remarks || null }, `Site diary entry for ${f.log_date}`); if (ok) setF(null) }}>✓ Save entry</button>
            <button className="cm-btn ghost" onClick={() => setF(null)}>Cancel</button>
          </div>
        </div>
      )}
      {diary.length === 0 ? <Empty icon="📓">No diary entries yet — a two-line daily note builds a reliable record of who worked, what got done and why work stopped.</Empty> : (
        <div style={{ position: 'relative', paddingLeft: 18 }}>
          <div style={{ position: 'absolute', left: 6, top: 6, bottom: 6, width: 2, background: 'var(--line)' }} />
          {diary.map(d => (
            <div key={d.id} className="cm-sub" style={{ marginBottom: 10, position: 'relative' }}>
              <span style={{ position: 'absolute', left: -18, top: 16, width: 12, height: 12, borderRadius: 99, background: 'var(--gold)', border: '2px solid #fff' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <b>{niceDate(d.log_date)}</b>
                <span style={{ fontSize: 12.5, color: 'var(--mute)' }}>{d.weather}{d.workers != null ? ` · 👷 ${d.workers}` : ''}{d.created_by ? ` · ${d.created_by}` : ''} <button className="cm-btn sm danger" style={{ marginLeft: 6, height: 26 }} onClick={() => api.deleteRow('cm_site_logs', d.id, 'Delete this diary entry?')}>✕</button></span>
              </div>
              <div style={{ fontSize: 13.5, marginTop: 6, lineHeight: 1.55 }}>{d.work_done}</div>
              {(d.materials_used || d.remarks) && <div style={{ fontSize: 12.5, color: 'var(--mute)', marginTop: 4 }}>{d.materials_used && <>🧱 {d.materials_used} </>}{d.remarks && <>· ⚠ {d.remarks}</>}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PROJECT FORM (add / edit)
// ═══════════════════════════════════════════════════════════════════════════
function ProjectForm({ mode, initial, ext, contractors, onClose, onSave }) {
  const [d, setD] = useState(() => ({ ...emptyProject, ...Object.fromEntries(Object.entries(initial || {}).map(([k, v]) => [k, v ?? ''])) }))
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setD(x => ({ ...x, [k]: v }))
  const pickContractor = name => { set('contractor', name); const c = contractors.find(x => x.name === name); if (c?.phone && !d.contractor_phone) set('contractor_phone', c.phone) }
  const submit = async () => { setSaving(true); await onSave(d, file); setSaving(false) }
  const dur = d.start_date && d.target_end_date ? daysBetween(d.start_date, d.target_end_date) : null
  return (
    <Modal title={mode === 'edit' ? `Edit — ${initial.name}` : 'New project'} onClose={onClose} width={760}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {CATEGORIES.map(c => <button key={c} className={`cm-btn ${d.category === c ? '' : 'ghost'}`} style={{ flex: 1, height: 48 }} onClick={() => set('category', c)}>{CATEGORY_ICON[c]} {c}</button>)}
      </div>
      <div className="cm-form">
        <Field label="Project name *" span><input className="cm-in" autoFocus value={d.name} onChange={e => set('name', e.target.value)} placeholder="e.g. New hostel block — boys' wing" /></Field>
        <Field label="Status"><select className="cm-in" value={d.status} onChange={e => set('status', e.target.value)}>{STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}</select></Field>
        {ext && <Field label="Priority"><select className="cm-in" value={d.priority || 'Medium'} onChange={e => set('priority', e.target.value)}>{PRIORITIES.map(s => <option key={s}>{s}</option>)}</select></Field>}
        <Field label="Budget (₹)"><input className="cm-in" type="number" value={d.budget_amount} onChange={e => set('budget_amount', e.target.value)} placeholder="0" />{Number(d.budget_amount) > 0 && <div style={{ fontSize: 11.5, color: 'var(--mute)', marginTop: 3 }}>{inWords(d.budget_amount)}</div>}</Field>
        {ext && <Field label="Location / building"><input className="cm-in" value={d.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Hostel block B, 2nd floor" /></Field>}
        <Field label="Contractor / vendor"><input className="cm-in" list="cm-contractor-list" value={d.contractor} onChange={e => pickContractor(e.target.value)} /><datalist id="cm-contractor-list">{contractors.map(c => <option key={c.id} value={c.name}>{c.trade || ''}</option>)}</datalist></Field>
        <Field label="Contractor phone"><input className="cm-in" inputMode="tel" value={d.contractor_phone} onChange={e => set('contractor_phone', e.target.value)} /></Field>
        <Field label="Start date"><input className="cm-in" type="date" value={d.start_date} onChange={e => set('start_date', e.target.value)} /></Field>
        <Field label="Target end date"><input className="cm-in" type="date" value={d.target_end_date} onChange={e => set('target_end_date', e.target.value)} />{dur != null && <div style={{ fontSize: 11.5, color: dur < 0 ? 'var(--red)' : 'var(--mute)', marginTop: 3 }}>{dur < 0 ? 'Ends before it starts' : `${dur} days · ~${Math.round(dur / 30)} months`}</div>}</Field>
        {d.status === 'Completed' && mode === 'edit' && <Field label="Completed on"><input className="cm-in" type="date" value={d.completed_date} onChange={e => set('completed_date', e.target.value)} /></Field>}
        <Field label="Progress (%)"><input className="cm-in" type="number" min="0" max="100" disabled={d.status === 'Completed'} value={d.status === 'Completed' ? 100 : d.progress_pct} onChange={e => set('progress_pct', e.target.value)} /></Field>
        {ext && <Field label="Retention % (held till completion)"><input className="cm-in" type="number" min="0" max="20" step="0.5" value={d.retention_pct} onChange={e => set('retention_pct', e.target.value)} placeholder="e.g. 5" /></Field>}
        <Field label={mode === 'edit' ? 'Replace contract file' : 'Contract / agreement file'}><input className="cm-in" style={{ paddingTop: 8 }} type="file" onChange={e => setFile(e.target.files?.[0] || null)} /></Field>
        <Field label="Description" span><textarea className="cm-in" rows={2} value={d.description} onChange={e => set('description', e.target.value)} /></Field>
        <Field label="Notes" span><textarea className="cm-in" rows={2} value={d.notes} onChange={e => set('notes', e.target.value)} /></Field>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
        <button className="cm-btn ghost" onClick={onClose}>Cancel</button>
        <button className="cm-btn gold" disabled={saving} onClick={submit}>{saving ? 'Saving…' : mode === 'edit' ? '✓ Save changes' : '✓ Create project'}</button>
      </div>
    </Modal>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MAINTENANCE SCHEDULE (recurring)
// ═══════════════════════════════════════════════════════════════════════════
const MAINT_PRESETS = [['Water tank', 'Cleaning & disinfection', 90], ['Fire extinguishers', 'Refill & inspection', 365], ['Generator', 'Service & oil change', 180], ['Electrical wiring', 'Safety inspection', 365], ['Campus', 'Pest control', 90], ['RO / water purifier', 'Filter change & service', 90], ['Roof & drains', 'Pre-monsoon cleaning', 365], ['CCTV', 'Health check', 180]]
function Maintenance({ ext, items, insertRow, updateRow, deleteRow, notify }) {
  const [f, setF] = useState(null)
  const [show, setShow] = useState('active')
  if (!ext) return <div className="cm-card"><Empty icon="🔧">{SQL_HINT}</Empty></div>
  const t = today()
  const status = m => !m.active ? ['Paused', '#64748b', '#f1f5f9'] : m.next_due < t ? [`${daysBetween(m.next_due, t)}d overdue`, '#dc2626', '#fef2f2'] : m.next_due <= addDays(t, 7) ? [m.next_due === t ? 'Due today' : `Due in ${daysBetween(t, m.next_due)}d`, '#b45309', '#fffbeb'] : [`In ${daysBetween(t, m.next_due)} days`, '#15803d', '#ecfdf3']
  const list = items.filter(m => show === 'all' || (show === 'active' ? m.active : !m.active))
  const yearly = items.filter(m => m.active).reduce((a, m) => a + (Number(m.est_cost) || 0) * 365 / (m.frequency_days || 365), 0)
  const blank = { asset: '', task: '', location: '', frequency_days: 90, next_due: t, vendor: '', vendor_phone: '', est_cost: '', notes: '', active: true }
  const save = async () => {
    if (!f.asset.trim() || !f.task.trim()) { notify('Asset and task are required.', true); return }
    const row = { asset: f.asset.trim(), task: f.task.trim(), location: f.location || null, frequency_days: Math.max(1, Number(f.frequency_days) || 90), next_due: f.next_due || t, vendor: f.vendor || null, vendor_phone: f.vendor_phone || null, est_cost: Number(f.est_cost) || 0, notes: f.notes || null, active: !!f.active }
    const ok = f.id ? await updateRow('cm_maintenance', f.id, row) : await insertRow('cm_maintenance', row)
    if (ok) { setF(null); notify(f.id ? '✅ Task updated' : '✅ Task scheduled') }
  }
  const markDone = async m => {
    const ok = await updateRow('cm_maintenance', m.id, { last_done: t, next_due: addDays(t, m.frequency_days) })
    if (ok) notify(`✅ ${m.task} done — next due ${niceDate(addDays(t, m.frequency_days))}`)
  }
  const every = d => d % 365 === 0 ? `${d / 365 === 1 ? 'Yearly' : `Every ${d / 365} years`}` : d % 30 === 0 ? (d === 30 ? 'Monthly' : `Every ${d / 30} months`) : d % 7 === 0 ? (d === 7 ? 'Weekly' : `Every ${d / 7} weeks`) : `Every ${d} days`
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="cm-kpis">
        {[['Overdue', items.filter(m => m.active && m.next_due < t).length, '#dc2626'], ['Due in 7 days', items.filter(m => m.active && m.next_due >= t && m.next_due <= addDays(t, 7)).length, '#b45309'], ['Scheduled tasks', items.filter(m => m.active).length, '#132a4f'], ['Est. yearly upkeep', fmtK(yearly), '#7c3aed']].map(([l, v, c]) => <div key={l} className="cm-kpi" style={{ '--c': c }}><div className="l">{l}</div><div className="v">{v}</div></div>)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="cm-btn gold" onClick={() => setF(blank)}>+ Schedule task</button>
        <div className="cm-seg">{[['active', 'Active'], ['paused', 'Paused'], ['all', 'All']].map(([v, l]) => <button key={v} className={show === v ? 'on' : ''} onClick={() => setShow(v)}>{l}</button>)}</div>
      </div>
      {list.length === 0 ? (
        <div className="cm-card" style={{ padding: 18 }}>
          <Empty icon="🔧">No recurring tasks yet. Start with a common one:</Empty>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>{MAINT_PRESETS.map(([a, tk, fr]) => <button key={a + tk} className="cm-btn sm ghost" onClick={() => setF({ ...blank, asset: a, task: tk, frequency_days: fr })}>{a} · {tk}</button>)}</div>
        </div>
      ) : (
        <div className="cm-grid">
          {list.map(m => { const [sl, sc, sb] = status(m); return (
            <div key={m.id} className="cm-pcard" style={{ cursor: 'default', borderLeft: `4px solid ${sc}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div><div className="nm" style={{ fontSize: 15, fontWeight: 800 }}>{m.task}</div><div style={{ fontSize: 12.5, color: 'var(--mute)' }}>{m.asset}{m.location ? ` · 📍 ${m.location}` : ''}</div></div>
                <span className="cm-chip" style={{ background: sb, color: sc, alignSelf: 'flex-start' }}>{sl}</span>
              </div>
              <div className="cm-kv"><div><small>Repeats</small><b>{every(m.frequency_days)}</b></div><div><small>Next due</small><b>{niceDate(m.next_due)}</b></div><div><small>Last done</small><b>{m.last_done ? niceDate(m.last_done) : '—'}</b></div></div>
              {(m.vendor || Number(m.est_cost) > 0) && <div style={{ fontSize: 12.5, color: 'var(--mute)' }}>{m.vendor && <>🧑‍🔧 {m.vendor}{m.vendor_phone ? ` · ${m.vendor_phone}` : ''} </>}{Number(m.est_cost) > 0 && <>· ~{fmt(m.est_cost)} each time</>}</div>}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {m.active && <button className="cm-btn sm" style={{ background: '#15803d' }} onClick={() => markDone(m)}>✓ Mark done</button>}
                {m.vendor_phone && m.active && <a className="cm-btn sm ghost" style={{ textDecoration: 'none' }} href={waLink(m.vendor_phone, `Dear ${m.vendor || 'Sir'},\n\n${m.task} for the ${m.asset}${m.location ? ` (${m.location})` : ''} at GNSI is due on ${niceDate(m.next_due)}. Please confirm a visit date.\n\n— GNSI, Khangabok`)} target="_blank" rel="noopener noreferrer">💬 Book vendor</a>}
                <button className="cm-btn sm ghost" onClick={() => setF({ ...blank, ...Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v ?? ''])) })}>Edit</button>
                <button className="cm-btn sm ghost" onClick={() => updateRow('cm_maintenance', m.id, { active: !m.active })}>{m.active ? 'Pause' : 'Resume'}</button>
                <button className="cm-btn sm danger" onClick={() => deleteRow('cm_maintenance', m.id, `Delete "${m.task}"?`)}>✕</button>
              </div>
            </div>
          ) })}
        </div>
      )}
      {f && (
        <Modal title={f.id ? 'Edit maintenance task' : 'Schedule maintenance'} onClose={() => setF(null)}>
          {!f.id && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>{MAINT_PRESETS.map(([a, tk, fr]) => <button key={a + tk} className="cm-btn sm ghost" onClick={() => setF(x => ({ ...x, asset: a, task: tk, frequency_days: fr }))}>{a}</button>)}</div>}
          <div className="cm-form">
            <Field label="Asset *"><input className="cm-in" value={f.asset} onChange={e => setF(x => ({ ...x, asset: e.target.value }))} placeholder="e.g. Water tank" /></Field>
            <Field label="Task *"><input className="cm-in" value={f.task} onChange={e => setF(x => ({ ...x, task: e.target.value }))} placeholder="e.g. Cleaning" /></Field>
            <Field label="Location"><input className="cm-in" value={f.location} onChange={e => setF(x => ({ ...x, location: e.target.value }))} placeholder="e.g. Girls' hostel roof" /></Field>
            <Field label="Repeat every (days)"><input className="cm-in" type="number" min="1" value={f.frequency_days} onChange={e => setF(x => ({ ...x, frequency_days: e.target.value }))} /><div style={{ display: 'flex', gap: 4, marginTop: 5 }}>{[[30, '1m'], [90, '3m'], [180, '6m'], [365, '1y']].map(([dd, l]) => <button key={dd} className="cm-btn sm ghost" style={{ height: 26 }} onClick={() => setF(x => ({ ...x, frequency_days: dd }))}>{l}</button>)}</div></Field>
            <Field label="Next due"><input className="cm-in" type="date" value={f.next_due} onChange={e => setF(x => ({ ...x, next_due: e.target.value }))} /></Field>
            <Field label="Cost each time (₹)"><input className="cm-in" type="number" value={f.est_cost} onChange={e => setF(x => ({ ...x, est_cost: e.target.value }))} /></Field>
            <Field label="Vendor"><input className="cm-in" value={f.vendor} onChange={e => setF(x => ({ ...x, vendor: e.target.value }))} /></Field>
            <Field label="Vendor phone"><input className="cm-in" inputMode="tel" value={f.vendor_phone} onChange={e => setF(x => ({ ...x, vendor_phone: e.target.value }))} /></Field>
            <Field label="Notes" span><input className="cm-in" value={f.notes} onChange={e => setF(x => ({ ...x, notes: e.target.value }))} /></Field>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}><button className="cm-btn ghost" onClick={() => setF(null)}>Cancel</button><button className="cm-btn gold" onClick={save}>✓ Save</button></div>
        </Modal>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTRACTORS — directory + performance scorecard
// ═══════════════════════════════════════════════════════════════════════════
function Contractors({ ext, spend, directory, rows, insertRow, updateRow, openProject }) {
  const [f, setF] = useState(null)
  const [q, setQ] = useState('')
  const merged = useMemo(() => {
    const m = new Map()
    spend.filter(s => s.contractor !== 'Unassigned').forEach(s => m.set(s.contractor.toLowerCase(), { name: s.contractor, phone: s.phone, s }))
    directory.forEach(d => { const k = d.name.toLowerCase(); m.set(k, { ...(m.get(k) || { name: d.name }), dir: d, phone: d.phone || m.get(k)?.phone }) })
    return [...m.values()].filter(c => !q || `${c.name} ${c.dir?.trade || ''}`.toLowerCase().includes(q.toLowerCase())).sort((a, b) => (b.s?.paid || 0) - (a.s?.paid || 0))
  }, [spend, directory, q])
  const rate = async (c, v) => {
    if (!ext) return
    if (c.dir) await updateRow('cm_contractors', c.dir.id, { rating: v })
    else await insertRow('cm_contractors', { name: c.name, phone: c.phone || null, rating: v })
  }
  const save = async () => {
    if (!f.name.trim()) return
    const row = { name: f.name.trim(), phone: f.phone || null, trade: f.trade || null, gstin: f.gstin || null, notes: f.notes || null }
    const ok = f.id ? await updateRow('cm_contractors', f.id, row) : await insertRow('cm_contractors', row)
    if (ok) setF(null)
  }
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="cm-in" style={{ maxWidth: 320 }} placeholder="🔍 Search contractors…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search contractors" />
        {ext && <button className="cm-btn gold" style={{ marginLeft: 'auto' }} onClick={() => setF({ name: '', phone: '', trade: '', gstin: '', notes: '' })}>+ Add contractor</button>}
      </div>
      {!ext && <div className="cm-alert" style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}><span>⭐</span><div>Ratings, trades and the contractor directory need <code>cm_advanced.sql</code>. Performance below is worked out from your projects.</div></div>}
      {merged.length === 0 ? <div className="cm-card"><Empty icon="👷">No contractors yet — they appear here as you add them to projects.</Empty></div> : (
        <div className="cm-grid">
          {merged.map(c => {
            const s = c.s || { projectCount: 0, paid: 0, budget: 0, completed: 0, onTime: 0, overBudget: 0, active: 0, progress: 0 }
            const onTimePct = s.completed ? Math.round(s.onTime / s.completed * 100) : null
            const projects = rows.filter(p => (p.contractor || '').trim().toLowerCase() === c.name.toLowerCase())
            return (
              <div key={c.name} className="cm-pcard" style={{ cursor: 'default' }}>
                <div className="top">
                  <div className="ic" style={{ fontWeight: 800, color: '#6b5320', fontSize: 18 }}>{c.name[0]?.toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="nm">{c.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--mute)' }}>{c.dir?.trade || 'Contractor'}{c.dir?.gstin ? ` · GSTIN ${c.dir.gstin}` : ''}</div>
                    <Stars value={c.dir?.rating} onChange={ext ? v => rate(c, v) : null} />
                  </div>
                </div>
                <div className="cm-kv">
                  <div><small>Projects</small><b>{s.projectCount}{s.active ? ` · ${s.active} active` : ''}</b></div>
                  <div><small>Paid</small><b>{fmtK(s.paid)}</b></div>
                  <div><small>On time</small><b style={{ color: onTimePct == null ? 'var(--faint)' : onTimePct >= 80 ? 'var(--green)' : 'var(--amber)' }}>{onTimePct == null ? '—' : `${onTimePct}%`}</b></div>
                </div>
                {s.overBudget > 0 && <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)' }}>⚠ {s.overBudget} project{s.overBudget > 1 ? 's' : ''} over budget</div>}
                {projects.length > 0 && <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>{projects.slice(0, 4).map(p => <button key={p.id} className="cm-chip" style={{ background: STATUS_COLORS[p.status].bg, color: STATUS_COLORS[p.status].fg, border: 'none', cursor: 'pointer' }} onClick={() => openProject(p)}>{p.name}</button>)}</div>}
                {c.dir?.notes && <div style={{ fontSize: 12.5, color: 'var(--mute)' }}>{c.dir.notes}</div>}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {c.phone && <a className="cm-btn sm ghost" style={{ textDecoration: 'none' }} href={`tel:${c.phone}`}>📞 {c.phone}</a>}
                  {c.phone && <a className="cm-btn sm ghost" style={{ textDecoration: 'none' }} href={waLink(c.phone, `Dear ${c.name},\n\n— GNSI, Khangabok`)} target="_blank" rel="noopener noreferrer">💬</a>}
                  {ext && <button className="cm-btn sm ghost" onClick={() => setF(c.dir ? { ...c.dir, phone: c.dir.phone || '', trade: c.dir.trade || '', gstin: c.dir.gstin || '', notes: c.dir.notes || '' } : { name: c.name, phone: c.phone || '', trade: '', gstin: '', notes: '' })}>Edit</button>}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {f && (
        <Modal title={f.id ? `Edit — ${f.name}` : 'Add contractor'} onClose={() => setF(null)} width={560}>
          <div className="cm-form">
            <Field label="Name *" span><input className="cm-in" autoFocus value={f.name} onChange={e => setF(x => ({ ...x, name: e.target.value }))} /></Field>
            <Field label="Phone"><input className="cm-in" inputMode="tel" value={f.phone} onChange={e => setF(x => ({ ...x, phone: e.target.value }))} /></Field>
            <Field label="Trade"><input className="cm-in" list="cm-trades" value={f.trade} onChange={e => setF(x => ({ ...x, trade: e.target.value }))} placeholder="Civil, Electrical, Plumbing…" /><datalist id="cm-trades">{['Civil', 'Electrical', 'Plumbing', 'Painting', 'Carpentry', 'Fabrication', 'Roofing', 'Tiling', 'Landscaping'].map(t => <option key={t} value={t} />)}</datalist></Field>
            <Field label="GSTIN"><input className="cm-in" value={f.gstin} onChange={e => setF(x => ({ ...x, gstin: e.target.value.toUpperCase() }))} /></Field>
            <Field label="Notes" span><textarea className="cm-in" rows={2} value={f.notes} onChange={e => setF(x => ({ ...x, notes: e.target.value }))} /></Field>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}><button className="cm-btn ghost" onClick={() => setF(null)}>Cancel</button><button className="cm-btn gold" onClick={save}>✓ Save</button></div>
        </Modal>
      )}
    </div>
  )
}