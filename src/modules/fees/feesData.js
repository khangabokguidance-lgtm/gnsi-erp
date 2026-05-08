// feesData.js — GNSI Fee Management data layer
// Matches legacy fees.js storage keys exactly for cross-compatibility

const SUPABASE_URL = 'https://pwrldrngqxbvwfztxxrd.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3cmxkcm5ncXhidndmenR4eHJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MTc5NTUsImV4cCI6MjA5MDA5Mzk1NX0.vQi6N4s5Y_iwU1eIi4g8q_T8bW4j8mBH7BFDamAhB0Y'

export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const ls = (k, fallback = null) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback } catch { return fallback } }
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }

export const todayStr = () => new Date().toISOString().split('T')[0]
export const fmtINR = n => Number(n || 0).toLocaleString('en-IN')

// ── Fee Config ────────────────────────────────────────────────────────────────
const DEFAULT_CONF = {
  admissionFees: [
    { id: 'af1', course: 'Sainik Old',     amount: 5000 },
    { id: 'af2', course: 'Combined New',   amount: 5000 },
    { id: 'af3', course: 'Navodaya Old',   amount: 4500 },
    { id: 'af4', course: 'Navodaya New',   amount: 4500 },
    { id: 'af5', course: 'Foundation V',   amount: 3500 },
    { id: 'af6', course: 'Foundation IV',  amount: 3000 },
    { id: 'af7', course: 'Combined Old',   amount: 5000 },
  ],
  monthlyFees: [
    { id: 'mf1', course: 'Sainik Old',     amount: 12000, hostelAmount: 5000 },
    { id: 'mf2', course: 'Combined New',   amount: 12000, hostelAmount: 5000 },
    { id: 'mf3', course: 'Navodaya Old',   amount: 10000, hostelAmount: 5000 },
    { id: 'mf4', course: 'Navodaya New',   amount: 10000, hostelAmount: 5000 },
    { id: 'mf5', course: 'Foundation V',   amount:  8000, hostelAmount: 4000 },
    { id: 'mf6', course: 'Foundation IV',  amount:  7000, hostelAmount: 4000 },
    { id: 'mf7', course: 'Combined Old',   amount: 12000, hostelAmount: 5000 },
  ],
  feeGroups: [],
  manualFeeTypes: ['Miscellaneous','Late Fee','Exam Fee','Sports Fee','Library Fee','Lab Fee','Uniform','Study Material','Tour/Trip Fee','Other'],
}

export function loadFeeConf() {
  // Try both storage keys the legacy portal uses
  const saved = ls('imsfeeconf') || ls('gnsifeeconfigls')
  if (saved && saved.monthlyFees && saved.admissionFees) return saved
  return JSON.parse(JSON.stringify(DEFAULT_CONF))
}

export function saveFeeConf(conf) {
  // Save to BOTH keys so legacy portal & React portal stay in sync
  lsSet('imsfeeconf', conf)
  lsSet('gnsifeeconfigls', conf)

  // Also push to Supabase gnsifeeconfig table
  try {
    const sid = (() => { try { const u = JSON.parse(localStorage.getItem('gnsijwtuser')); return u?.schoolId || u?.schoolid || null } catch { return null } })()
    const row = {
      id: sid ? `default${sid}` : 'default',
      admissionfees:  conf.admissionFees,
      monthlyfees:    conf.monthlyFees,
      feegroups:      conf.feeGroups,
      manualfeetypes: conf.manualFeeTypes,
      updatedat:      new Date().toISOString(),
      ...(sid ? { schoolid: sid } : {}),
    }
    fetch(`${SUPABASE_URL}/rest/v1/gnsifeeconfig`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify(row),
    }).catch(() => {})
  } catch {}
}

// ── Fee Assignments (enrolled students) ──────────────────────────────────────
export function loadAsgns() {
  return ls('gnsifeeassignments') || []
}

// ── Fee Collections ───────────────────────────────────────────────────────────
export function loadCols() {
  return ls('gnsifeecollections') || []
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

export function saveCol(asgnId, data, prefix = 'RCP') {
  const asgns = loadAsgns()
  const asgn  = asgns.find(a => a.id === asgnId)
  if (!asgn) return null
  const cols = loadCols()
  const receiptNo = `${prefix}-${new Date().getFullYear()}-${String(cols.length + 1).padStart(4, '0')}`
  const col = {
    id:          uid(),
    asgnId,
    studentName: asgn.studentName || asgn.name || '',
    rollNo:      asgn.rollNo  || '',
    admNo:       asgn.admNo   || '',
    className:   asgn.className || '',
    receiptNo,
    collectedBy: (() => { try { return JSON.parse(localStorage.getItem('gnsijwtuser'))?.name || 'Admin' } catch { return 'Admin' } })(),
    createdAt:   new Date().toISOString(),
    ...data,
  }
  cols.push(col)
  lsSet('gnsifeecollections', cols)

  // Push to Supabase gnsifeecollections
  try {
    const sid = (() => { try { const u = JSON.parse(localStorage.getItem('gnsijwtuser')); return u?.schoolId || u?.schoolid || null } catch { return null } })()
    fetch(`${SUPABASE_URL}/rest/v1/gnsifeecollections`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        id:          col.id,
        asgnid:      col.asgnId,
        studentname: col.studentName,
        rollno:      col.rollNo,
        admno:       col.admNo,
        classname:   col.className,
        feetype:     col.feeType,
        formonth:    col.forMonth,
        amountpaid:  col.amountPaid,
        paymode:     col.payMode,
        paydate:     col.payDate,
        receiptno:   col.receiptNo,
        remark:      col.remark,
        collectedby: col.collectedBy,
        createdat:   col.createdAt,
        ...(sid ? { schoolid: sid } : {}),
      }),
    }).catch(() => {})
  } catch {}

  return col
}

// ── Fee Calculation ───────────────────────────────────────────────────────────
export function monthsSince(dateStr) {
  if (!dateStr) return 1
  const start = new Date(dateStr)
  const now   = new Date()
  return Math.max(1, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()) + 1)
}

export function calcFee(asgn, monthNum) {
  const conf = loadFeeConf()
  const course = (asgn.className || asgn.course || '').toLowerCase()
  const mf = conf.monthlyFees.find(f => course.includes(f.course.toLowerCase())) || conf.monthlyFees[0]
  const af = conf.admissionFees.find(f => course.includes(f.course.toLowerCase())) || conf.admissionFees[0]
  const isDay    = (asgn.subTypeId || '').toLowerCase().includes('dayscholar') || (asgn.subTypeId || '').toLowerCase().includes('day')
  const monthly  = isDay ? (mf?.hostelAmount || 0) : (mf?.amount || 0)
  const admFee   = monthNum === 1 ? (af?.amount || 0) : 0
  return { monthly, admFee, total: monthly + admFee }
}

// ── KPI ───────────────────────────────────────────────────────────────────────
export function calcKPI() {
  const asgns = loadAsgns()
  const cols  = loadCols()
  let collected = 0, due = 0, overdue = 0
  asgns.forEach(a => {
    const paid = cols.filter(c => c.asgnId === a.id).reduce((s, c) => s + parseInt(c.amountPaid || 0, 10), 0)
    collected += paid
    const m = monthsSince(a.enrolledAt)
    let exp = 0; for (let i = 1; i <= m; i++) exp += calcFee(a, i).total
    const d = Math.max(0, exp - paid)
    due += d
    if (d > 0) overdue++
  })
  return { students: asgns.length, collected, due, overdue, receipts: cols.length }
}
