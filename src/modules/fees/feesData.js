// ─── Storage helpers ───────────────────────────────────────────────────────
const LS_COLS   = 'gnsifeecols'
const LS_ASGNS  = 'gnsifeeasgns'
const LS_CONF   = 'gnsifeeconfigls'
const LS_TXNS   = 'gnsipaymenttxns'

function ls(key, fb = []) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fb } catch { return fb }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch {}
  try { if (typeof gnsiKVPush === 'function') gnsiKVPush(key, val) } catch {}
}

// ─── Collections (payment records) ────────────────────────────────────────
export function loadCols()       { return ls(LS_COLS, []) }
export function saveCols(cols)   { lsSet(LS_COLS, cols); lsSet('gnsisfacollections', cols) }

// ─── Assignments (enrolled students in fee system) ─────────────────────────
export function loadAsgns()      { return ls(LS_ASGNS, []) }
export function saveAsgns(asgns) { lsSet(LS_ASGNS, asgns); lsSet('gnsisfaassignments', asgns) }

// ─── Fee Config ────────────────────────────────────────────────────────────
export function loadFeeConf() {
  try {
    const raw = localStorage.getItem('imsfeeconf') || localStorage.getItem(LS_CONF)
    if (raw) { const p = JSON.parse(raw); if (p?.feeGroups) return p }
  } catch {}
  return {
    admissionFees: [
      { id: 'af1', course: 'Sainik Old',    amount: 5000 },
      { id: 'af2', course: 'Combined New',  amount: 5000 },
      { id: 'af3', course: 'Navodaya Old',  amount: 4500 },
      { id: 'af4', course: 'Navodaya New',  amount: 4500 },
      { id: 'af5', course: 'Foundation V',  amount: 3500 },
      { id: 'af6', course: 'Foundation IV', amount: 3000 },
      { id: 'af7', course: 'Combined Old',  amount: 5000 },
    ],
    monthlyFees: [
      { id: 'mf1', course: 'Sainik Old',    amount: 12000, hostelAmount: 5000 },
      { id: 'mf2', course: 'Combined New',  amount: 12000, hostelAmount: 5000 },
      { id: 'mf3', course: 'Navodaya Old',  amount: 10000, hostelAmount: 5000 },
      { id: 'mf4', course: 'Navodaya New',  amount: 10000, hostelAmount: 5000 },
      { id: 'mf5', course: 'Foundation V',  amount:  8000, hostelAmount: 4000 },
      { id: 'mf6', course: 'Foundation IV', amount:  7000, hostelAmount: 4000 },
      { id: 'mf7', course: 'Combined Old',  amount: 12000, hostelAmount: 5000 },
    ],
    feeGroups: [],
    manualFeeTypes: ['Miscellaneous','Late Fee','Exam Fee','Sports Fee','Library Fee','Lab Fee','Uniform','Study Material','Tour/Trip Fee','Other'],
  }
}
export function saveFeeConf(conf) {
  const s = JSON.stringify(conf)
  try { localStorage.setItem('imsfeeconf', s); localStorage.setItem(LS_CONF, s) } catch {}
  try { if (typeof gnsiKVPush === 'function') { gnsiKVPush('imsfeeconf', conf); gnsiKVPush(LS_CONF, conf) } } catch {}
}

// ─── Online Transactions ────────────────────────────────────────────────────
export function loadTxns()      { return ls(LS_TXNS, []) }
export function saveTxns(txns)  { lsSet(LS_TXNS, txns) }

// ─── Student Fee Assignments (fee-group bindings per student) ───────────────
export function loadStuFeeAsgns() { return ls('gnsistufgasgn', []) }
export function saveStuFeeAsgns(arr) { lsSet('gnsistufgasgn', arr) }
export function getStuFeeAsgn(stuId) {
  return loadStuFeeAsgns().find(a => String(a.stuId) === String(stuId)) || null
}
export function setStuFeeAsgn(stuId, feeGroupIds, manualFeeTypes, note) {
  const arr = loadStuFeeAsgns()
  const idx = arr.findIndex(a => String(a.stuId) === String(stuId))
  const rec = { stuId: String(stuId), feeGroupIds, manualFeeTypes, note, updatedAt: new Date().toISOString() }
  if (idx >= 0) arr[idx] = rec; else arr.push(rec)
  saveStuFeeAsgns(arr)
}

// ─── Class-Course Bridge ────────────────────────────────────────────────────
export function loadBridge() {
  try {
    const r = localStorage.getItem('gnsiclassbridge')
    return r ? JSON.parse(r) : {}
  } catch { return {} }
}
export function saveBridge(map) {
  try { localStorage.setItem('gnsiclassbridge', JSON.stringify(map)) } catch {}
  try { if (typeof gnsiKVPush === 'function') gnsiKVPush('gnsiclassbridge', map) } catch {}
}

// ─── Helpers ────────────────────────────────────────────────────────────────
export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
export const COURSES = ['Sainik Old','Sainik New','Combined New','Combined Old','Navodaya Old','Navodaya New','Foundation V','Foundation IV']

export function fmtINR(n) { return Math.round(n || 0).toLocaleString('en-IN') }
export function todayStr() { return new Date().toISOString().split('T')[0] }

export function monthsSince(dateStr) {
  if (!dateStr) return 1
  const s = new Date(dateStr), n = new Date()
  return Math.max(1, (n.getFullYear() - s.getFullYear()) * 12 + (n.getMonth() - s.getMonth()) + 1)
}

export function calcFee(asgn, monthIdx) {
  const conf  = loadFeeConf()
  const course = asgn.courseId || asgn.course || ''
  const mf = conf.monthlyFees.find(f => f.course?.toLowerCase().includes(course.toLowerCase()))
  const base   = mf?.amount || 0
  const hostel = asgn.hostel ? (mf?.hostelAmount || 0) : 0
  const total  = base + hostel
  const af = conf.admissionFees.find(f => f.course?.toLowerCase().includes(course.toLowerCase()))
  return { base, hostel, total, admFee: af?.amount || 0, breakdown: [`${fmtINR(base)} tuition`, hostel ? `${fmtINR(hostel)} hostel` : null].filter(Boolean) }
}

export function nextReceipt(prefix = 'RCP') {
  const cols = loadCols()
  const nums = cols.map(c => parseInt((c.receiptNo || '').replace(/\D/g, ''), 10)).filter(n => !isNaN(n))
  const next = nums.length ? Math.max(...nums) + 1 : 1
  return `${prefix}-${String(next).padStart(4, '0')}`
}

export function saveCol(asgnId, extra, prefix = 'RCP') {
  const asgns = loadAsgns()
  const a = asgns.find(x => x.id === asgnId)
  if (!a) return null
  const cols = loadCols()
  const col = {
    id:          Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    asgnId,
    receiptNo:   nextReceipt(prefix),
    studentName: a.studentName || a.name,
    rollNo:      a.rollNo,
    admNo:       a.admNo,
    className:   a.className,
    subTypeId:   a.subTypeId || null,
    collectedBy: (typeof currentUser !== 'undefined' && currentUser?.name) || 'Admin',
    createdAt:   new Date().toISOString(),
    ...extra,
  }
  cols.push(col)
  saveCols(cols)
  return col
}

// ─── KPI ─────────────────────────────────────────────────────────────────────
export function calcKPI() {
  const cols  = loadCols()
  const asgns = loadAsgns()
  const collected = cols.reduce((s, c) => s + parseInt(c.amountPaid || 0, 10), 0)
  let due = 0, overdue = 0
  asgns.forEach(a => {
    const m    = monthsSince(a.enrolledAt)
    const paid = cols.filter(c => c.asgnId === a.id).reduce((s, c) => s + parseInt(c.amountPaid || 0, 10), 0)
    let exp = 0
    for (let i = 1; i <= m; i++) exp += calcFee(a, i).total
    const d = Math.max(0, exp - paid)
    if (d > 0) { due += d; overdue++ }
  })
  return { students: asgns.length, collected, due, overdue, receipts: cols.length }
}
