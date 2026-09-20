import { useEffect, useMemo, useState, useRef, useCallback, Fragment } from 'react'
import { supabase } from './supabase'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import IncomeAnalysis from './IncomeAnalysis'
import AuditMonitor from './AuditMonitor'
import { TransactionsViewBanking } from './Accounts_Transactions_Banking'
import { AccountsDashboardBanking } from './AccountsDashboardBanking'
// ── Report Generator dependencies ───────────────────────────────────────────
// npm install jspdf jspdf-autotable docx xlsx
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, PageOrientation, ImageRun,
} from 'docx'

// ── constants ──────────────────────────────────────────────────────────────
const INCOME_CATEGORIES  = ['Admission', 'Fees', 'Hostel', 'Advance', 'Donation', 'Registration', 'Other']
const EXPENSE_CATEGORIES = ['Salary', 'Electricity', 'Stationery', 'Maintenance', 'Transport', 'Event', 'Other']
const PAYMENT_MODES      = ['Cash', 'Bank', 'UPI', 'Card']
const ACCOUNT_TYPES      = ['Cash A/c', '2026-27 A/c', '2025-26 A/c']
const CHART_COLORS       = ['#1e3a5f','#16a34a','#dc2626','#f59e0b','#7c3aed','#0891b2','#be185d','#047857']
const STATUS_OPTIONS     = ['Confirmed', 'Pending']
const PAGE_SIZES         = [25, 50, 100]
const RECEIPT_BUCKET     = 'account-receipts'

// ── Expenditure v2: multi-level category ────────────────────────────────
// Built-in starter sub-categories per top-level expense category. Purely a
// convenience list for the dropdown — a sub-category is free text under the
// hood (same "type your own" pattern as the existing custom-category
// feature), so this never blocks an entry, it just seeds sensible options.
const EXPENSE_SUBCATEGORIES = {
  Maintenance : ['Plumbing', 'Electrical', 'Carpentry', 'Painting', 'Cleaning', 'General Repair'],
  Transport   : ['Fuel', 'Vehicle Repair', 'Bus Hire', 'Driver Payment'],
  Electricity : ['Main Building', 'Hostel', 'Generator/Diesel'],
  Stationery  : ['Office Supplies', 'Printing', 'Books & Study Material'],
  Event       : ['Decoration', 'Refreshment', 'Prizes & Certificates', 'Guest Honorarium'],
  Salary      : ['Teaching Staff', 'Non-Teaching Staff', 'Bonus/Incentive'],
}

// ── Expenditure v2: approval workflow defaults ──────────────────────────
// Mirrors expenditure_approval_settings in the DB migration — used as a
// fallback only until that row loads (or if the table doesn't exist yet
// because the migration hasn't been run), so the feature degrades to
// "nothing needs approval" rather than erroring if the table is missing.
const DEFAULT_APPROVAL_THRESHOLD = 10000
const DEFAULT_LOWER_TRUST_ROLES  = ['superintendent']

// ── institute info (letterhead used by the Report Generator) ───────────────
// Edit these once — every generated PDF / DOCX / Excel report reads from here.
const INSTITUTE_INFO = {
  name    : 'GUIDANCE NAVODAYA & SAINIK INSTITUTE (GNSI)',
  tagline : 'NVS · Sainik School · RMS Entrance Coaching',
  address : 'Khangabok, Thoubal, Manipur, India',
  phone   : '',   // TODO: add contact number
  email   : '',   // TODO: add contact email
  website : 'guidancekhangabok.in',
}

// report type presets
const REPORT_TYPES = [
  'Transaction Statement',
  'Income Statement',
  'Expenditure Statement',
  'Category-wise Summary',
  'Account-wise Summary',
]

// ── PHASE 1: removed module-level today constant (now reactive state inside component) ──

const emptyRow = {
  entry_date   : new Date().toLocaleDateString('en-CA'),
  payment_date : new Date().toLocaleDateString('en-CA'), // actual date money was received (Income only)
  type         : 'Income',
  category     : '',
  sub_category : '',   // Expenditure v2: optional finer-grained category, Expense only
  vendor_id    : '',   // Expenditure v2: optional linked vendor/payee, Expense only
  payer_id     : '',   // Accounts v3: optional linked payer/source, Income only
  amount       : '',
  payment_mode : 'Cash',
  account_type : 'Cash A/c',
  voucher_head : '',
  note         : '',
  is_recurring : false,
  receipt_url  : '',
  status       : 'Confirmed',
}

const DEFAULT_BUDGETS = {
  Salary:0, Electricity:0, Stationery:0,
  Maintenance:0, Transport:0, Event:0, Other:0,
}

// ── helpers ────────────────────────────────────────────────────────────────
const fmt      = (n) => `₹${Number(n).toLocaleString('en-IN')}`
const monthKey = (d) => d ? d.slice(0,7) : ''
// PHASE 1 FIX: getToday() helper used for reactive today state
const getToday = () => new Date().toLocaleDateString('en-CA')

// BUGFIX (audit): single shared rule for "does this entry represent money
// that has actually moved". A Pending/unconfirmed entry hasn't been
// received or paid yet, so it must never count toward a real total. This
// was previously re-implemented inline as `(e.status||'Confirmed')==='Confirmed'`
// in some memos (Analytics charts, Transactions-tab header cards, Daily
// register, Daily Expenditure tab, savingsTracker) but was missing entirely
// from others (Report Generator, P&L modal by default, the Weekly PA
// report, the "All Entries" export, the Budget tracker) — so a Pending
// entry could be silently included in a printed/exported report or a
// budget's "spent so far" figure while correctly excluded from the
// on-screen dashboard right next to it. Every total-producing memo in this
// file now goes through this one function so there is exactly one place
// that rule lives.
//
// LOOPHOLE CLOSED: the original version was `(e.status||'Confirmed')==='Confirmed'`
// — this fails OPEN for anything that isn't the literal string 'Confirmed':
// null/undefined/'' all defaulted to counting as confirmed (intentional,
// for legacy rows predating the status column), but so would any OTHER
// unrecognized value nobody anticipated. The UI's <select> only ever
// writes 'Confirmed' or 'Pending' (STATUS_OPTIONS), but that constraint
// doesn't reach a direct DB edit, a future migration, or another tool
// touching this same table — a row landing with status:'Cancelled' or
// status:'Void' would previously have been silently treated as REAL money
// (fails open) rather than excluded (fails closed), which is backwards for
// a financial total: an unrecognized status should never count as
// confirmed by default. Now explicit: null/undefined/'' (truly absent,
// the legacy-row case) still means Confirmed; every other value must
// match STATUS_OPTIONS, and anything outside that known set is treated as
// NOT confirmed rather than silently passed through as real money.
const isConfirmed = (e) => {
  const s = e.status
  if (s === null || s === undefined || s === '') return true // legacy rows predating the status column
  return s === 'Confirmed'
}

// PHASE 6 FIX: timezone-safe weekday label for a 'YYYY-MM-DD' string.
// new Date('YYYY-MM-DD') parses as UTC midnight, so formatting it back in a
// timezone behind UTC (or any browser not set to IST) can print the wrong
// weekday. Parsing the parts explicitly and constructing a local Date avoids
// the UTC round-trip entirely. Was previously duplicated inline in two report
// generators (transaction report + daily-grouped report) — now a single
// shared helper used by both.
const weekdayOf = (dateStr) => {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'long' })
}

// PHASE 6 FIX: single place for every Supabase insert/update/delete so error
// handling can no longer be silently dropped in a copy-pasted call site.
// Always alerts the user and logs to console on failure; returns true/false
// so callers can decide whether to proceed (e.g. skip fetchEntries() on fail).
// on Success can be used for the follow up chain and toasts / audit logs.
async function mutateAccountsTable(queryBuilderFn, { errorContext = 'Action' } = {}) {
  try {
    const { error } = await queryBuilderFn()
    if (error) {
      console.error(`${errorContext} failed:`, error)
      alert(`${errorContext} failed: ${error.message}`)
      return false
    }
    return true
  } catch (e) {
    console.error(`${errorContext} threw:`, e)
    alert(`${errorContext} failed: ${e.message || 'Unknown error'}`)
    return false
  }
}

// ── responsive hook ────────────────────────────────────────────────────────
function useWindowWidth() {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024)
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return width
}

function getQuickRange(key) {
  const now=new Date(),yyyy=now.getFullYear(),mm=String(now.getMonth()+1).padStart(2,'0')
  const pad=(n)=>String(n).padStart(2,'0')
  const todayStr=getToday()
  if (key==='today')    return {from:todayStr,to:todayStr}
  if (key==='week'){const d=new Date(now);d.setDate(now.getDate()-now.getDay());return{from:d.toLocaleDateString('en-CA'),to:todayStr}}
  if (key==='month')    return {from:`${yyyy}-${mm}-01`,to:todayStr}
  if (key==='lastmonth'){
    const d=new Date(yyyy,now.getMonth()-1,1),last=new Date(yyyy,now.getMonth(),0)
    return{from:`${d.getFullYear()}-${pad(d.getMonth()+1)}-01`,to:`${last.getFullYear()}-${pad(last.getMonth()+1)}-${pad(last.getDate())}`}
  }
  if (key==='year')     return {from:`${yyyy}-01-01`,to:todayStr}
  return {from:'',to:''}
}

// ── audit log ──────────────────────────────────────────────────────────────
async function writeAuditLog({action,role,targetId,oldValues,newValues}){
  try{
    await supabase.from('audit_log').insert({
      action,changed_by:role,target_id:targetId,
      old_values:oldValues?JSON.stringify(oldValues):null,
      new_values:newValues?JSON.stringify(newValues):null,
      created_at:new Date().toISOString(),
    })
  }catch(e){console.warn('Audit log failed',e)}
}

// ── PHASE 3: client-side fraud helpers kept for frequency anomaly display only ──
function detectFrequencyAnomalies(entries, todayStr){
  const thisMonth=todayStr.slice(0,7),map={}
  entries.filter(e=>monthKey(e.entry_date)===thisMonth).forEach(e=>{const k=`${e.category}-${e.amount}`;if(!map[k])map[k]=[];map[k].push(e)})
  return Object.entries(map).filter(([,arr])=>arr.length>2).map(([key,arr])=>({key,count:arr.length,entries:arr}))
}

// ── daily expenditure helpers ──────────────────────────────────────────────
function groupByDate(entries, getDate=(e)=>e.entry_date){
  const map={}
  entries.forEach(e=>{const d=getDate(e);if(!map[d])map[d]=[];map[d].push(e)})
  return Object.entries(map).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0)
}

// ── sub-components ─────────────────────────────────────────────────────────
function StatCard({label,value,color,bg,icon,isCurrency=true,sub}){
  return(
    <div style={{backgroundColor:bg,borderRadius:12,padding:18,boxShadow:'0 2px 8px rgba(0,0,0,0.06)',borderLeft:`4px solid ${color}`}}>
      <div style={{fontSize:22,marginBottom:6}}>{icon}</div>
      <p style={{fontSize:13,color,fontWeight:600,margin:0}}>{label}</p>
      <h2 style={{fontSize:22,fontWeight:'bold',color,marginTop:4,marginBottom:0}}>{isCurrency?fmt(value):value}</h2>
      {sub&&<p style={{fontSize:11,color,opacity:0.7,marginTop:2,marginBottom:0}}>{sub}</p>}
    </div>
  )
}

function SeverityBadge({severity}){
  const map={high:{bg:'#fee2e2',color:'#dc2626',label:'High'},medium:{bg:'#fef3c7',color:'#d97706',label:'Med'},low:{bg:'#f1f5f9',color:'#64748b',label:'Low'}}
  const s=map[severity]||map.low
  return <span style={{padding:'2px 7px',borderRadius:999,fontSize:10,fontWeight:700,backgroundColor:s.bg,color:s.color}}>{s.label}</span>
}

// ── shared style helpers (module scope, declared before the component so
// they can never be affected by build-tool scope-hoisting/minification
// reordering relative to where Accounts() is defined) ──────────────────────
const iStyle     = {width:'100%',padding:'11px 14px',borderRadius:8,border:'1px solid #e5e7eb',fontSize:13,backgroundColor:'white',boxSizing:'border-box',transition:'all 0.2s cubic-bezier(0.4,0,0.2,1)'}
const lStyle     = {display:'block',fontSize:12,fontWeight:700,color:'#374151',marginBottom:7,letterSpacing:'0.2px',textTransform:'capitalize'}
const tdS        = {padding:'13px 14px',color:'#64748b',fontSize:'13px',fontWeight:500}
const chartCard  = {backgroundColor:'white',borderRadius:14,padding:24,boxShadow:'0 4px 16px rgba(0,0,0,0.08)',border:'1px solid #f3f4f6',transition:'all 0.3s cubic-bezier(0.4,0,0.2,1)'}
const chartTitle = {fontSize:17,fontWeight:800,color:'#1e3a5f',marginBottom:20,marginTop:0,letterSpacing:'-0.4px'}
const smallBtn   = (bg,color)=>({backgroundColor:bg,color,border:'none',borderRadius:6,padding:'6px 11px',fontSize:12,fontWeight:700,cursor:'pointer',transition:'all 0.25s ease',boxShadow:'0 2px 4px rgba(0,0,0,0.05)'})
const pgBtn      = (disabled)=>({padding:'7px 13px',borderRadius:7,border:'1px solid #e5e7eb',cursor:disabled?'not-allowed':'pointer',fontSize:13,fontWeight:600,backgroundColor:'#f8fafc',color:disabled?'#cbd5e1':'#64748b',transition:'all 0.2s ease',boxShadow:'0 1px 2px rgba(0,0,0,0.04)'})

// ══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════
function Accounts({role,userId}){
  const isAdmin      = role==='admin'
  // Named users authorized to edit expenditure entries regardless of their
  // generic `role` string — matched against staff.id (see currentStaff below).
  // Add/remove staff.id values here as authorized editors change.
  const AUTHORIZED_EXPENDITURE_EDITOR_IDS = [
    '28d0346d-97b7-41b9-b4a5-6692262d47b5', // Ranbir (Administrator)
    'dfe4e59a-3f20-4b0c-9f19-cb64996f788f', // Moirangthem Arunkumar Singh (Administrator)
  ]
  const canWrite     = isAdmin||role==='accounts'||role==='manager'
  const isSuperintendent = role==='superintendent'
  const canAddIncome = isAdmin
  // Any non-admin user can log an expenditure entry, even without full write
  // access — edit/delete/budgets/income stay restricted to canWrite/canAddIncome.
  // Superintendent is edit-only (see canEditExpenditure below) — explicitly
  // excluded here so they cannot add new entries, only edit existing ones.
  //
  // LOOPHOLE CLOSED: this was previously `(canWrite||!isAdmin) || isSuperintendent`.
  // `!isAdmin` is true for a Superintendent too (their role is 'superintendent',
  // not 'admin'), so the `canWrite||!isAdmin` term alone already evaluated to
  // true for them — the trailing `||isSuperintendent` was redundant and the
  // exclusion the comment describes never actually happened. A Superintendent
  // got the "➕ Add Expenditure" button and could insert brand-new entries,
  // directly contradicting "edit-only" and letting them add un-reviewed
  // expenditure that (unlike edits) isn't auto-flagged for admin verification
  // anywhere in handleSubmit's insert path. Superintendent is now explicitly
  // excluded so the only way they can touch this table is through an edit.
  const canAddEntry  = !isSuperintendent && (canWrite||!isAdmin)

  // responsive
  const windowWidth  = useWindowWidth()
  const isMobile     = windowWidth < 640
  const isTablet     = windowWidth >= 640 && windowWidth < 1024

  // PHASE 1 FIX: reactive today — updates at midnight, never stale
  const [today, setToday] = useState(getToday)
  useEffect(()=>{
    const t=setInterval(()=>setToday(getToday()),60_000)
    return()=>clearInterval(t)
  },[])

  // data
  const [entries,   setEntries]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)

  // receipt
  const [receiptFile,      setReceiptFile]      = useState(null)
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const [viewReceipt,      setViewReceipt]      = useState(null)
  const [receiptMemoEntry, setReceiptMemoEntry]  = useState(null)
  const fileInputRef = useRef(null)

  // tabs
  const [activeTab, setActiveTab] = useState('analytics')

  // stat cards (Total Income / Expense / Net / Transactions / Pending) — hidden by default
  const [showStatCards, setShowStatCards] = useState(false)

  // form
  const [showForm,  setShowForm]  = useState(false)
  const [editEntry, setEditEntry] = useState(null)
  const [rows,      setRows]      = useState([{...emptyRow}])

  // custom expense categories — user-added, persisted locally, merged with the built-in list
  const [customExpCats, setCustomExpCats] = useState(()=>{
    try{return JSON.parse(localStorage.getItem('acc_custom_expense_categories')||'[]')}catch{return []}
  })
  const expenseCategoryOptions = useMemo(()=>{
    const base=EXPENSE_CATEGORIES.filter(c=>c!=='Other')
    // Pull in every category that has ever actually been used on an Expense
    // entry (e.g. typed in by a staff member before this list existed, or
    // added on a different device so it never made it into this browser's
    // localStorage custom-category list) — not just the hardcoded list and
    // this browser's own saved custom categories.
    const fromEntries = entries.filter(e=>e.type==='Expense'&&e.category).map(e=>e.category)
    const merged = [...base, ...customExpCats, ...fromEntries].filter(c=>c&&c!=='Other')
    const deduped = [...new Set(merged)].sort((a,b)=>a.localeCompare(b))
    return [...deduped,'Other']
  },[customExpCats,entries])

  // ── All-expense category summary (built straight off actual entries) ────
  // Every distinct expense category ever used, with total spent, entry
  // count, and last-used date — independent of the fixed EXPENSE_CATEGORIES
  // list or any budget being set, so a category shows up here even if it
  // was only ever typed in as a one-off custom category.
  const allExpenseCategorySummary = useMemo(()=>{
    const map={}
    entries.filter(e=>e.type==='Expense'&&isConfirmed(e)).forEach(e=>{
      const cat=e.category||'Uncategorized'
      if(!map[cat])map[cat]={category:cat,total:0,count:0,lastDate:null}
      map[cat].total+=Number(e.amount);map[cat].count+=1
      if(!map[cat].lastDate||e.entry_date>map[cat].lastDate)map[cat].lastDate=e.entry_date
    })
    return Object.values(map).sort((a,b)=>b.total-a.total)
  },[entries])

  // filters
  const [search,       setSearch]       = useState('')
  const [typeFilter,   setTypeFilter]   = useState('All')
  const [modeFilter,   setModeFilter]   = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [acctFilter,   setAcctFilter]   = useState('All')
  const [dateFrom,     setDateFrom]     = useState('')
  const [dateTo,       setDateTo]       = useState('')
  const [activeQuick,  setActiveQuick]  = useState('')
  const [sortField,    setSortField]    = useState('entry_date')
  const [sortDir,      setSortDir]      = useState('desc')

  // pagination
  const [page,     setPage]     = useState(1)
  const [pageSize, setPageSize] = useState(25)

  // bulk select
  const [selected, setSelected] = useState(new Set())

  // budgets
  const [budgets,     setBudgets]     = useState(DEFAULT_BUDGETS)
  const [budgetMeta,  setBudgetMeta]  = useState(null)
  const [editBudgets, setEditBudgets] = useState(false)
  const [expandedBudgetCat, setExpandedBudgetCat] = useState(null) // category name currently showing its "where spent" entry list, or null
  const [budgetDraft, setBudgetDraft] = useState(DEFAULT_BUDGETS)

  // staff list — powers the Voucher Head "who takes it" field
  const [staffList,   setStaffList]   = useState([])
  const [staffLoaded, setStaffLoaded] = useState(false)

  // AI insights
  const [insights,  setInsights]  = useState('')
  const [loadingAI, setLoadingAI] = useState(false)

  // P&L modal
  const [showPL,  setShowPL]  = useState(false)
  const [plMonth, setPlMonth] = useState(()=>getToday().slice(0,7))
  // P&L: custom date-range mode (in addition to the month picker) + advanced filters
  const [plRangeMode,  setPlRangeMode]  = useState('month') // 'month' | 'range'
  const [plDateFrom,   setPlDateFrom]   = useState('')
  const [plDateTo,     setPlDateTo]     = useState('')
  const [showPlFilters, setShowPlFilters] = useState(false)
  const [plShowDatewise, setPlShowDatewise] = useState(false) // toggles category view vs date-wise (per-day, not combined) view in the P&L modal
  const [plManualIncome, setPlManualIncome] = useState('') // admin-entered manual cashbook total, for mismatch comparison
  const [plAccountType, setPlAccountType] = useState('All')
  const [plPaymentMode, setPlPaymentMode] = useState('All')
  const [plStatus,      setPlStatus]      = useState('All')

  // daily expenditure filters
  const [dailySearch,      setDailySearch]      = useState('')
  const [dailyAcctFilter,  setDailyAcctFilter]  = useState('All')
  const [dailyModeFilter,  setDailyModeFilter]  = useState('All')
  const [voucherHead,      setVoucherHead]      = useState('')
  // PAYMENT-DATE FILTER FIX: Daily register can now show Income (payments) or Expense
  const [dailyTypeFilter,  setDailyTypeFilter]  = useState('Expense')

  // ── dedicated Daily Expenditure tab (separate table, sits side by side with Daily/Reports) ──
  const [expSearch,     setExpSearch]     = useState('')
  const [expAcctFilter, setExpAcctFilter] = useState('All')
  const [expModeFilter, setExpModeFilter] = useState('All')
  const [expCategory,   setExpCategory]   = useState('All')
  const [expDateFrom,   setExpDateFrom]   = useState('')
  const [expDateTo,     setExpDateTo]     = useState('')
  const [expQuick,      setExpQuick]      = useState('')
  const [generatingExpReport, setGeneratingExpReport] = useState('') // '' | 'pdf' | 'docx' | 'excel'
  // ACTUAL PAYMENT DATE FIX: for Income, choose whether the date filter goes by when money was
  // actually received (payment_date) or when the row was recorded (entry_date)
  const [dailyDateMode,    setDailyDateMode]    = useState('payment') // 'payment' | 'entry'

  // admin extras
  const [deletedRows, setDeletedRows] = useState([])
  const [auditLog,    setAuditLog]    = useState([])
  const [exportLog,   setExportLog]   = useState([])
  const [superintendentFlags, setSuperintendentFlags] = useState([])

  // PHASE 3: fraud flags now fetched from DB (fraud_alerts table)
  const [fraudFlags,  setFraudFlags]  = useState({})

  // PHASE 4: balance sheet + trial balance
  const [trialBalance,      setTrialBalance]      = useState([])
  const [balanceSheet,      setBalanceSheet]      = useState([])
  const [loadingFinancials, setLoadingFinancials] = useState(false)

  // ── Report Generator state (independent filter set, doesn't touch Transactions tab) ──
  const [rptReportType,  setRptReportType]  = useState(REPORT_TYPES[0])
  const [rptType,        setRptType]        = useState('All')
  const [rptCategory,    setRptCategory]    = useState('All')
  const [rptMode,        setRptMode]        = useState('All')
  const [rptAccount,     setRptAccount]     = useState('All')
  const [rptStatus,      setRptStatus]      = useState('All')
  const [rptVoucherHead, setRptVoucherHead] = useState('')
  const [rptSearch,      setRptSearch]      = useState('')
  const [rptDateFrom,    setRptDateFrom]    = useState('')
  const [rptDateTo,      setRptDateTo]      = useState('')
  const [rptQuick,       setRptQuick]       = useState('')

  // ── Accounts v3: one-click monthly report (pick any past month) ─────────
  const [monthlyRptMonth, setMonthlyRptMonth] = useState(()=>getToday().slice(0,7))
  const [rptViewMode,    setRptViewMode]    = useState('list') // 'list' | 'datewise'
  const [rptExpandedDate,setRptExpandedDate]= useState(null)   // which date is expanded in datewise view
  const [generatingReport, setGeneratingReport] = useState('') // '' | 'pdf' | 'docx' | 'excel'

  // ── Expenditure v2: vendor/payee tracking ────────────────────────────────
  const [vendors,       setVendors]       = useState([])
  const [vendorsLoaded, setVendorsLoaded] = useState(false)

  // ── Accounts v3: payers / income sources ─────────────────────────────────
  const [payers,       setPayers]       = useState([])
  const [expPayerFilter, setExpPayerFilter] = useState('All') // reused naming convention; filters the Income-side daily view if added later
  const [payerDrilldown, setPayerDrilldown] = useState(null)
  const [incTargets,   setIncTargets]   = useState([])   // rows from income_targets for the current view
  const [editIncTarget, setEditIncTarget] = useState(null) // category currently being edited, or null
  const [incTargetDraft, setIncTargetDraft] = useState('')
  const [catAllIncDrilldown, setCatAllIncDrilldown] = useState(null)

  // ── Accounts v3: cash flow & forecasting ─────────────────────────────────
  const [recurringTemplates, setRecurringTemplates] = useState([])
  const [showAddRecurringTpl, setShowAddRecurringTpl] = useState(false)
  const [newRecurringTpl, setNewRecurringTpl] = useState({type:'Expense',category:'',label:'',expected_amount:'',day_of_month:''})

  // ── Accounts v3: reconciliation & closing ────────────────────────────────
  const [monthLocks, setMonthLocks] = useState([])
  const [reconAcctType, setReconAcctType] = useState('Cash A/c')
  const [reconBusyId, setReconBusyId] = useState(null)
  const [openingBalances, setOpeningBalances] = useState([])
  const [expVendorFilter, setExpVendorFilter] = useState('All')   // Daily Expenditure tab filter
  const [vendorDrilldown, setVendorDrilldown] = useState(null)    // vendor id currently showing its spend-history panel, or null
  const [catAllDrilldown, setCatAllDrilldown] = useState(null)    // category name currently showing its all-expense drilldown, or null
  // Drilldown lists (vendor/payer/category expanded views) show only the 10
  // most recent entries by default with a "+N more — Show all" link; keys
  // here are e.g. 'vendor:<id>', 'payer:<id>', 'expcat:<category>',
  // 'inccat:<category>' — any key present shows its full list uncapped.
  const [showAllDrilldown, setShowAllDrilldown] = useState(()=>new Set())
  const toggleShowAllDrilldown=(key)=>setShowAllDrilldown(prev=>{
    const next=new Set(prev)
    next.has(key)?next.delete(key):next.add(key)
    return next
  })

  // ── Expenditure v2: multi-level category ─────────────────────────────────
  const [expSubCategory, setExpSubCategory] = useState('All')     // Daily Expenditure tab filter
  const [customSubCats, setCustomSubCats] = useState(()=>{
    try{return JSON.parse(localStorage.getItem('acc_custom_subcategories')||'{}')}catch{return {}}
  }) // { [category]: string[] } — user-added sub-categories, merged with EXPENSE_SUBCATEGORIES

  // ── Expenditure v2: approval workflow ────────────────────────────────────
  const [approvalSettings, setApprovalSettings] = useState({threshold_amount:DEFAULT_APPROVAL_THRESHOLD, lower_trust_roles:DEFAULT_LOWER_TRUST_ROLES})
  const [pendingApprovals, setPendingApprovals] = useState([])   // rows from expenditure_approvals, status='pending', joined with their accounts row
  const [approvalHistory,  setApprovalHistory]  = useState([])   // today's approved/rejected decisions, for the "approval list for the day"
  const [approvalsLoaded,  setApprovalsLoaded]  = useState(false)
  const [approvalBusyId,   setApprovalBusyId]   = useState(null)
  const [showApprovalQueue, setShowApprovalQueue] = useState(false) // collapsed/expanded state of the always-visible header widget
  const [editThreshold, setEditThreshold] = useState(false)
  const [thresholdDraft, setThresholdDraft] = useState('')

  // ── Expenditure v2: monitoring (spend-velocity, per-staff, audit trail) ──
  const [expAuditLog, setExpAuditLog] = useState([])   // audit_log rows filtered to expenditure-only actions, for the dedicated audit viewer

  // ── fetch ─────────────────────────────────────────────────────────────
  // PHASE 3 FIX: fraud flags fetched from DB, not computed client-side
  const fetchEntries = useCallback(async()=>{
    setLoading(true)
    // PHASE 5 FIX: Supabase/PostgREST caps a plain .select() at 1000 rows.
    // Page through with .range() so entries (and every total derived from it) is complete.
    const PAGE_SIZE=1000
    let all=[],from=0,pageError=null
    while(true){
      const {data,error}=await supabase.from('accounts').select('*')
        .eq('is_soft_deleted',false)
        .order('entry_date',{ascending:false})
        .order('created_at',{ascending:false})
        .order('id',{ascending:false})
        .range(from,from+PAGE_SIZE-1)
      if(error){pageError=error;break}
      all=all.concat(data||[])
      if(!data||data.length<PAGE_SIZE)break
      from+=PAGE_SIZE
    }
    if(pageError)console.error(pageError)
    else setEntries(all)

    if(isAdmin){
      const {data:alerts}=await supabase
        .from('fraud_alerts')
        .select('*')
        .eq('resolved',false)
        .order('detected_at',{ascending:false})
      const flags={}
      ;(alerts||[]).forEach(a=>{
        if(!flags[a.entry_id])flags[a.entry_id]=[]
        flags[a.entry_id].push({type:a.flag_type,label:a.label,severity:a.severity,alertId:a.id})
      })
      setFraudFlags(flags)
    }
    setLoading(false)
  },[isAdmin])

  const fetchBudgets = useCallback(async()=>{
    const {data,error}=await supabase.from('account_budgets').select('*').single()
    if(!error&&data?.budgets){setBudgets(data.budgets);setBudgetDraft(data.budgets);setBudgetMeta({edited_by:data.budget_edited_by,edited_at:data.budget_edited_at})}
    else{try{const b=JSON.parse(localStorage.getItem('acc_budgets')||'null');if(b){setBudgets(b);setBudgetDraft(b)}}catch{}}
  },[])

  // staff list — used to populate the Voucher Head "who takes it" field.
  // Matches the logged-in user via staff.user_id === userId (falls back to staff.id).
  const fetchStaff = useCallback(async()=>{
    const {data,error}=await supabase.from('staff').select('*').order('name')
    if(!error)setStaffList(data||[])
    else console.error('Could not load staff list:',error.message)
    setStaffLoaded(true)
  },[])

  const fetchDeletedRows = useCallback(async()=>{
    if(!isAdmin)return
    const PAGE_SIZE=1000
    let all=[],from=0
    while(true){
      const {data,error}=await supabase.from('accounts').select('*')
        .eq('is_soft_deleted',true)
        .order('deleted_at',{ascending:false})
        .order('id',{ascending:false})
        .range(from,from+PAGE_SIZE-1)
      if(error){console.error(error);break}
      all=all.concat(data||[])
      if(!data||data.length<PAGE_SIZE)break
      from+=PAGE_SIZE
    }
    setDeletedRows(all)
  },[isAdmin])

  const fetchAuditLog = useCallback(async()=>{
    if(!isAdmin)return
    const {data}=await supabase.from('audit_log').select('*').order('created_at',{ascending:false}).limit(200)
    setAuditLog(data||[])
  },[isAdmin])

  const fetchExportLog = useCallback(async()=>{
    if(!isAdmin)return
    const {data}=await supabase.from('export_log').select('*').order('created_at',{ascending:false}).limit(100)
    setExportLog(data||[])
  },[isAdmin])

  // Superintendent edit flags — every edit a superintendent makes is auto-
  // flagged (see handleSubmit); admin reviews and marks each Verified here.
  const fetchSuperintendentFlags = useCallback(async()=>{
    if(!isAdmin)return
    const {data}=await supabase.from('superintendent_edit_flags').select('*').order('created_at',{ascending:false}).limit(200)
    setSuperintendentFlags(data||[])
  },[isAdmin])

  // PHASE 4: fetch trial balance + balance sheet from DB views
  const fetchFinancials = useCallback(async()=>{
    if(!isAdmin)return
    setLoadingFinancials(true)
    const [{data:tb},{data:bs}]=await Promise.all([
      supabase.from('trial_balance').select('*'),
      supabase.from('balance_sheet').select('*'),
    ])
    setTrialBalance(tb||[])
    setBalanceSheet(bs||[])
    setLoadingFinancials(false)
  },[isAdmin])

  // ── Expenditure v2: vendors ──────────────────────────────────────────────
  const fetchVendors = useCallback(async()=>{
    const {data,error}=await supabase.from('vendors').select('*').eq('is_active',true).order('name')
    // Table may not exist yet if the migration hasn't been run — fail quiet,
    // same "degrade gracefully" approach as fetchBudgets above, since vendor
    // tracking is additive and shouldn't block the rest of the module.
    if(!error)setVendors(data||[])
    else console.warn('Vendors not loaded (has the expenditure v2 migration been run?):',error.message)
    setVendorsLoaded(true)
  },[])

  // ── Expenditure v2: approval settings (threshold + lower-trust roles) ───
  const fetchApprovalSettings = useCallback(async()=>{
    const {data,error}=await supabase.from('expenditure_approval_settings').select('*').eq('id',1).maybeSingle()
    if(!error&&data){
      setApprovalSettings({threshold_amount:Number(data.threshold_amount)||DEFAULT_APPROVAL_THRESHOLD,lower_trust_roles:data.lower_trust_roles||DEFAULT_LOWER_TRUST_ROLES})
      setThresholdDraft(String(data.threshold_amount??DEFAULT_APPROVAL_THRESHOLD))
    }else{
      setThresholdDraft(String(DEFAULT_APPROVAL_THRESHOLD))
    }
  },[])

  // ── Expenditure v2: pending approval queue (everyone can see the count;
  // only admin/canWrite sees the entries themselves — see render gating) ──
  const fetchPendingApprovals = useCallback(async()=>{
    const {data,error}=await supabase.from('expenditure_approvals').select('*,accounts:entry_id(*)').eq('status','pending').order('requested_at',{ascending:false})
    if(!error)setPendingApprovals(data||[])
    else console.warn('Pending approvals not loaded (has the expenditure v2 migration been run?):',error.message)
    setApprovalsLoaded(true)
  },[])

  // "approval list for the day" — every approve/reject DECIDED today,
  // regardless of when it was originally requested, so admin can see what
  // was actioned today at a glance.
  const fetchApprovalHistoryToday = useCallback(async(todayStr)=>{
    if(!isAdmin)return
    const startOfDay=`${todayStr}T00:00:00`,endOfDay=`${todayStr}T23:59:59.999`
    const {data,error}=await supabase.from('expenditure_approvals').select('*,accounts:entry_id(*)')
      .neq('status','pending').gte('decided_at',startOfDay).lte('decided_at',endOfDay)
      .order('decided_at',{ascending:false})
    if(!error)setApprovalHistory(data||[])
    else console.warn('Approval history not loaded:',error.message)
  },[isAdmin])

  // ── Expenditure v2: dedicated audit trail (expenditure-only slice of
  // audit_log — separate view from the general Activity Timeline) ────────
  const fetchExpAuditLog = useCallback(async()=>{
    if(!isAdmin)return
    const {data,error}=await supabase.from('audit_log').select('*')
      .in('action',['insert','update','delete','restore','permanent_delete'])
      .order('created_at',{ascending:false}).limit(500)
    if(error){console.warn('Expenditure audit log failed:',error.message);return}
    // Filter to expenditure-only entries client-side: old_values/new_values
    // are JSON strings on this table and there's no indexed "type" column
    // to filter by in SQL without a schema change to audit_log itself,
    // which existing code elsewhere already treats as a generic log for
    // several tables (accounts, budgets, fee actions, etc.) — narrowing
    // here keeps this migration additive-only.
    const expenditureOnly=(data||[]).filter(log=>{
      try{
        const nv=log.new_values?JSON.parse(log.new_values):null
        const ov=log.old_values?JSON.parse(log.old_values):null
        return (nv&&nv.type==='Expense')||(ov&&ov.type==='Expense')
      }catch{return false}
    })
    setExpAuditLog(expenditureOnly)
  },[isAdmin])

  // ── Accounts v3: payers ────────────────────────────────────────────────
  const fetchPayers = useCallback(async()=>{
    const {data,error}=await supabase.from('payers').select('*').eq('is_active',true).order('name')
    // Table may not exist yet if the v3 migration hasn't been run — fail
    // quiet, same "degrade gracefully" approach used for vendors/budgets.
    if(!error)setPayers(data||[])
    else console.warn('Payers not loaded (has the accounts v3 migration been run?):',error.message)
  },[])

  // ── Accounts v3: income collection targets for the current month ────────
  const fetchIncTargets = useCallback(async(monthStr)=>{
    const {data,error}=await supabase.from('income_targets').select('*').eq('month',monthStr)
    if(!error)setIncTargets(data||[])
    else console.warn('Income targets not loaded (has the accounts v3 migration been run?):',error.message)
  },[])

  // ── Accounts v3: recurring templates (forecast side only — see table
  // comment in the migration; these never write to `accounts` directly) ──
  const fetchRecurringTemplates = useCallback(async()=>{
    const {data,error}=await supabase.from('recurring_templates').select('*').eq('is_active',true).order('day_of_month',{ascending:true,nullsFirst:false})
    if(!error)setRecurringTemplates(data||[])
    else console.warn('Recurring templates not loaded (has the accounts v3 migration been run?):',error.message)
  },[])

  // ── Accounts v3: month locks + opening-balance records ──────────────────
  const fetchMonthLocks = useCallback(async()=>{
    const {data,error}=await supabase.from('month_locks').select('*').eq('is_locked',true)
    if(!error)setMonthLocks(data||[])
    else console.warn('Month locks not loaded (has the accounts v3 migration been run?):',error.message)
  },[])
  const fetchOpeningBalances = useCallback(async()=>{
    if(!isAdmin)return
    const {data,error}=await supabase.from('month_opening_balances').select('*').order('month',{ascending:false}).limit(24)
    if(!error)setOpeningBalances(data||[])
    else console.warn('Opening balances not loaded (has the accounts v3 migration been run?):',error.message)
  },[isAdmin])

  useEffect(()=>{
    fetchEntries();fetchBudgets();fetchStaff();fetchVendors();fetchApprovalSettings();fetchPendingApprovals();fetchPayers();fetchRecurringTemplates();fetchMonthLocks()
    if(isAdmin){fetchDeletedRows();fetchAuditLog();fetchExportLog();fetchFinancials();fetchSuperintendentFlags();fetchExpAuditLog();fetchOpeningBalances()}
  },[fetchEntries,fetchBudgets,fetchStaff,fetchVendors,fetchApprovalSettings,fetchPendingApprovals,fetchPayers,fetchRecurringTemplates,fetchMonthLocks,fetchDeletedRows,fetchAuditLog,fetchExportLog,fetchFinancials,fetchSuperintendentFlags,fetchExpAuditLog,fetchOpeningBalances,isAdmin])

  useEffect(()=>{
    fetchIncTargets(today.slice(0,7))
  },[today,fetchIncTargets])

  // ── Accounts v3: is a given (account_type, date) inside a locked month? ──
  // Admin can still act on locked months (that's how a month gets reopened
  // or corrected); everyone else is blocked. Pure lookup — no network call.
  const isMonthLocked = useCallback((accountType,dateStr)=>{
    if(isAdmin)return false
    const mk=monthKey(dateStr)
    return monthLocks.some(l=>l.account_type===accountType&&l.month===mk)
  },[isAdmin,monthLocks])

  useEffect(()=>{
    if(isAdmin)fetchApprovalHistoryToday(today)
  },[isAdmin,today,fetchApprovalHistoryToday])

  // Voucher Head / person pickers should only show real people — system rows
  // (e.g. "Admin", test/placeholder entries) are flagged is_system=true in the
  // staff table and excluded here, without removing them from the DB.
  const selectableStaffList = useMemo(
    ()=>staffList.filter(s=>!s.is_system),
    [staffList]
  )

  // ── detect logged-in user against the staff list, auto-add if missing ───
  const currentStaff = useMemo(
    ()=>staffList.find(s=>String(s.user_id)===String(userId)||String(s.id)===String(userId)),
    [staffList,userId]
  )

  // Named-user override: Accountant (canWrite via role), the two named
  // Administrators (matched by staff.id), and Superintendent (edit-only,
  // every edit auto-flagged for admin verification — see handleSubmit).
  const canEditExpenditure = canWrite || isSuperintendent || AUTHORIZED_EXPENDITURE_EDITOR_IDS.includes(String(currentStaff?.id))

  useEffect(()=>{
    if(!staffLoaded||!userId||currentStaff)return
    const cacheKey=`acc_staff_registered_${userId}`
    if(localStorage.getItem(cacheKey))return // already registered / already asked this device
    const name=window.prompt("We don't have you listed under Staff yet. Enter your name to add yourself as a Voucher Head option:")?.trim()
    if(!name)return
    ;(async()=>{
      const{data,error}=await supabase.from('staff').insert({user_id:userId,name}).select()
      if(error){console.error('Could not auto-register staff member:',error.message);return}
      localStorage.setItem(cacheKey,'1')
      setStaffList(prev=>[...prev,...(data||[{user_id:userId,name}])])
    })()
  },[staffLoaded,currentStaff,userId])

  // ── recurring (REMOVED) ──────────────────────────────────────────────
  // The auto-recurring feature has been fully removed: it caused duplicate
  // and future-dated expenditure rows (the localStorage-based "already ran
  // today" guard didn't work across devices/browsers, and the day-of-month
  // reused from the template could land after today's date with no check).
  // The "Mark as recurring" checkbox and the Recurring tab have been removed
  // from the UI. This effect is now a permanent no-op — nothing auto-inserts
  // into the accounts table. Recurring expenses must be entered manually
  // each month.
  //
  // If a recurring-expense feature is rebuilt in the future: do NOT reuse a
  // client-side (localStorage) "already ran" check — that is exactly what
  // failed here, since it doesn't sync across devices/browsers. Instead:
  //
  //   1. Every auto-inserted recurring row MUST set is_recurring = true and
  //      recurring_period = the 'YYYY-MM' string for the month the entry is
  //      FOR (e.g. '2026-09'), not derived from entry_date at query time —
  //      set it explicitly at insert time so it can't drift if entry_date
  //      is later edited.
  //   2. The database enforces uniqueness for you: a partial unique index
  //      — uq_recurring_once_per_period on (note, amount, recurring_period)
  //      WHERE is_recurring = true AND status != 'Superseded' — already
  //      exists in this table. Any second insert attempt for the same
  //      recurring item + amount + month will fail with a unique-violation
  //      error from Postgres itself, regardless of what any client-side
  //      check does or doesn't catch. Catch that error and treat it as
  //      "already exists this month" rather than retrying the insert.
  //   3. Manual entries are NOT affected by this index — is_recurring only
  //      gets set to true by the auto-insert path itself, never by a normal
  //      manual entry, so staff can still enter "Saturday Chicken" or
  //      "Water Supply" by hand as many times a month as genuinely happened
  //      without hitting this constraint.
  //   4. Still validate the day-of-month before inserting: never create a
  //      row dated later than today (the second bug mentioned above).
  useEffect(()=>{
    return
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[entries.length, today])

  // ── quick date ────────────────────────────────────────────────────────
  const applyQuick=(key)=>{const{from,to}=getQuickRange(key);setDateFrom(from);setDateTo(to);setActiveQuick(key);setPage(1)}
  const clearQuick=()=>{setDateFrom('');setDateTo('');setActiveQuick('');setPage(1)}

  // ── report quick date (independent of the Transactions tab filters) ─────
  const applyRptQuick=(key)=>{const{from,to}=getQuickRange(key);setRptDateFrom(from);setRptDateTo(to);setRptQuick(key)}
  const clearRptQuick=()=>{setRptDateFrom('');setRptDateTo('');setRptQuick('')}
  const resetRptFilters=()=>{
    setRptType('All');setRptCategory('All');setRptMode('All');setRptAccount('All');setRptStatus('All')
    setRptVoucherHead('');setRptSearch('');setRptDateFrom('');setRptDateTo('');setRptQuick('')
  }

  // ── dedicated Daily Expenditure tab: quick-range + reset ─────────────────
  const applyExpQuick=(key)=>{const{from,to}=getQuickRange(key);setExpDateFrom(from);setExpDateTo(to);setExpQuick(key)}
  const clearExpQuick=()=>{setExpDateFrom('');setExpDateTo('');setExpQuick('')}
  const resetExpFilters=()=>{
    setExpSearch('');setExpAcctFilter('All');setExpModeFilter('All');setExpCategory('All')
    setExpSubCategory('All');setExpVendorFilter('All')
    setExpDateFrom('');setExpDateTo('');setExpQuick('')
  }

  // ── CRUD ──────────────────────────────────────────────────────────────
  const openAdd=()=>{
    setEditEntry(null)
    setRows([{...emptyRow,type:canAddIncome?'Income':'Expense',entry_date:today,payment_date:today,voucher_head:currentStaff?.name||''}])
    setReceiptFile(null);setShowForm(true)
  }

  const openEdit=(item)=>{
    setEditEntry(item)
    setRows([{
      entry_date:item.entry_date,payment_date:item.payment_date||item.entry_date,type:item.type,category:item.category,
      sub_category:item.sub_category||'',vendor_id:item.vendor_id||'',payer_id:item.payer_id||'',
      amount:String(item.amount),payment_mode:item.payment_mode,
      account_type:item.account_type||'Cash A/c',
      voucher_head:item.voucher_head||'',
      note:item.note||'',is_recurring:!!item.is_recurring,
      receipt_url:item.receipt_url||'',status:item.status||'Confirmed',
    }])
    setReceiptFile(null);setShowForm(true);setActiveTab('transactions')
    window.scrollTo({top:0,behavior:'smooth'})
  }

  const openDuplicate=(item)=>{
    setEditEntry(null)
    setRows([{
      entry_date:today,payment_date:today,type:item.type,category:item.category,
      sub_category:item.sub_category||'',vendor_id:item.vendor_id||'',payer_id:item.payer_id||'',
      amount:String(item.amount),payment_mode:item.payment_mode,
      account_type:item.account_type||'Cash A/c',
      voucher_head:item.voucher_head||'',
      note:item.note||'',is_recurring:false,receipt_url:'',status:'Confirmed',
    }])
    setReceiptFile(null);setShowForm(true);setActiveTab('transactions')
    window.scrollTo({top:0,behavior:'smooth'})
  }

  const uploadReceipt=async(entryId)=>{
    if(!receiptFile)return rows[0]?.receipt_url||null
    setUploadingReceipt(true)
    const ext=receiptFile.name.split('.').pop(),path=`${entryId||Date.now()}.${ext}`
    const{error:upErr}=await supabase.storage.from(RECEIPT_BUCKET).upload(path,receiptFile,{upsert:true})
    if(upErr){alert('Receipt upload failed: '+upErr.message);setUploadingReceipt(false);return null}
    const{data}=supabase.storage.from(RECEIPT_BUCKET).getPublicUrl(path)
    setUploadingReceipt(false);return data.publicUrl
  }

  const deleteReceipt=async(item)=>{
    if(!item.receipt_url)return
    const path=item.receipt_url.split('/').pop()
    await supabase.storage.from(RECEIPT_BUCKET).remove([path])
    const ok=await mutateAccountsTable(
      ()=>supabase.from('accounts').update({receipt_url:null}).eq('id',item.id),
      {errorContext:'Remove receipt'}
    )
    if(!ok)return
    fetchEntries()
  }

  const handleSubmit=async(e)=>{
    e.preventDefault()
    const hasFutureDate=rows.some(r=>(r.entry_date&&r.entry_date>today)||(r.payment_date&&r.payment_date>today))
    if(hasFutureDate){
      alert('Transaction date cannot be in the future. Please check the date entered.')
      return
    }
    // Accounts v3: month-end close/lock — a non-admin can't add/edit an
    // entry dated inside a month that's already been closed for that
    // account type. Admin is exempt (that's how a month gets corrected or
    // reopened). Checked here rather than only at insert time so an edit
    // that MOVES an entry INTO a locked month is caught too.
    const lockedRow=rows.find(r=>isMonthLocked(r.account_type,r.entry_date))
    if(lockedRow){
      alert(`${monthKey(lockedRow.entry_date)} is closed for ${lockedRow.account_type}. Ask an admin to reopen that month before adding or editing entries in it.`)
      return
    }
    setSaving(true)
    const enteredByName = currentStaff?.name || role
    if(editEntry){
      let editReason=''
      if(isSuperintendent){
        editReason=window.prompt('Reason for this change (required):','')
        if(!editReason||!editReason.trim()){
          alert('A reason is required to save this edit.')
          setSaving(false)
          return
        }
      }
      const r=rows[0],receiptUrl=await uploadReceipt(editEntry.id)
      const payload={
        entry_date:r.entry_date,payment_date:r.payment_date||r.entry_date,type:r.type,category:r.category,
        sub_category:r.sub_category||null,vendor_id:r.vendor_id||null,payer_id:r.payer_id||null,
        amount:Number(r.amount)||0,payment_mode:r.payment_mode,
        account_type:r.account_type,voucher_head:r.voucher_head,
        note:r.note,is_recurring:r.is_recurring,status:r.status,
        recurring_period: r.is_recurring ? (r.entry_date||'').slice(0,7) : null,
        receipt_url:receiptUrl,edited_by:enteredByName,edited_at:new Date().toISOString(),
      }
      const{error}=await supabase.from('accounts').update(payload).eq('id',editEntry.id)
      if(error){
        if(error.code==='23505'){
          alert('This recurring expense already has an entry for this month (same description and amount). Saving this edit would create a duplicate — check the existing entry for this month instead.')
        } else {
          alert('Error: '+error.message)
        }
      }
      else{
        await writeAuditLog({action:'update',role:enteredByName,targetId:editEntry.id,oldValues:editEntry,newValues:payload})
        // Superintendent is edit-only — every edit they make is auto-flagged
        // here for admin verification. This is a permanent record; admin can
        // separately mark it "Verified" once reviewed (see Fraud/Alerts tab).
        if(isSuperintendent){
          await supabase.from('superintendent_edit_flags').insert({
            entry_id:editEntry.id,edited_by:enteredByName,
            old_values:editEntry,new_values:payload,reason:editReason.trim(),
          })
        }
        setShowForm(false);setEditEntry(null);setReceiptFile(null);fetchEntries()
      }
    }else{
      // Every row marked is_recurring gets recurring_period set explicitly
      // here — 'YYYY-MM' of its own entry_date — rather than left null or
      // derived later from entry_date at query time. This is what the
      // uq_recurring_once_per_period unique index (note, amount,
      // recurring_period) actually matches against; without setting it at
      // insert time, every recurring row would insert with
      // recurring_period = null and the constraint would never catch a
      // real duplicate (NULL never equals NULL in a uniqueness check).
      //
      // ── Expenditure v2: approval gate ──────────────────────────────────
      // An Expense row needs admin approval before it counts as real money
      // when EITHER: (a) it's from a "lower-trust" submitter — anyone who
      // isn't admin/accounts/manager, i.e. Superintendent or general staff
      // (canWrite already means exactly "admin/accounts/manager", so
      // !canWrite captures both in one check) — OR (b) its amount is at or
      // above the admin-configured threshold, regardless of who entered it.
      // A gated row is inserted immediately as status='Pending' (reusing
      // the existing Pending status, so every total/report/budget/register
      // that already excludes Pending via isConfirmed() correctly excludes
      // it with zero further changes) plus a matching expenditure_approvals
      // row for the queue. Income is never gated — only admin can add
      // Income at all (canAddIncome), which is already the highest trust
      // level in this app.
      const rowMeta=rows.filter(r=>canAddIncome||r.type==='Expense').map(r=>{
        const amt=Number(r.amount)||0
        const isExpense=r.type==='Expense'
        const overThreshold=amt>=(Number(approvalSettings.threshold_amount)||DEFAULT_APPROVAL_THRESHOLD)
        const lowerTrust=!canWrite
        const needsApproval=isExpense&&(lowerTrust||overThreshold)
        const approvalReason=lowerTrust&&overThreshold?'both':(lowerTrust?'role':(overThreshold?'threshold':null))
        return{r,amt,needsApproval,approvalReason}
      })
      const payloads=rowMeta.map(({r,amt,needsApproval})=>({
        entry_date:r.entry_date,payment_date:r.payment_date||r.entry_date,type:r.type,category:r.category,
        sub_category:r.sub_category||null,vendor_id:r.vendor_id||null,payer_id:r.payer_id||null,
        amount:amt,payment_mode:r.payment_mode,
        account_type:r.account_type,voucher_head:r.voucher_head,
        note:r.note,is_recurring:r.is_recurring,status:needsApproval?'Pending':r.status,added_by:enteredByName,
        recurring_period: r.is_recurring ? (r.entry_date||'').slice(0,7) : null,
      }))
      const{data:inserted,error}=await supabase.from('accounts').insert(payloads).select()
      if(error){
        // Postgres unique_violation is code 23505. This is the
        // uq_recurring_once_per_period index rejecting a second recurring
        // entry for the same note+amount+month — surface it as a clear,
        // specific message instead of the raw constraint-name error text,
        // so whoever's entering data understands WHY it was blocked.
        if(error.code==='23505'){
          alert('This recurring expense already has an entry for this month (same description and amount). A duplicate was blocked — check the existing entry for this month instead of adding a new one.')
        } else {
          alert('Error: '+error.message)
        }
      }
      else{
        if(receiptFile&&inserted?.[0]){
          const ru=await uploadReceipt(inserted[0].id)
          if(ru)await mutateAccountsTable(
            ()=>supabase.from('accounts').update({receipt_url:ru}).eq('id',inserted[0].id),
            {errorContext:'Attach receipt'}
          )
        }
        for(const ins of(inserted||[]))await writeAuditLog({action:'insert',role:enteredByName,targetId:ins.id,newValues:ins})
        // File an expenditure_approvals row for every gated row, matched
        // positionally to rowMeta — Supabase/Postgres returns RETURNING
        // rows in insert order for a plain multi-row VALUES insert (this
        // file already relies on that same assumption via inserted[0]
        // above), so index i of `inserted` corresponds to index i of `rowMeta`.
        let anyGated=false
        for(let i=0;i<(inserted||[]).length;i++){
          const meta=rowMeta[i]
          if(!meta?.needsApproval)continue
          anyGated=true
          const{error:apErr}=await supabase.from('expenditure_approvals').insert({
            entry_id:inserted[i].id,requested_by:enteredByName,requested_by_id:String(currentStaff?.id||userId||''),
            reason:meta.approvalReason,amount:meta.amt,
          })
          if(apErr)console.warn('Could not file approval request (has the expenditure v2 migration been run?):',apErr.message)
        }
        if(anyGated){
          fetchPendingApprovals()
          alert(`Saved. ${rowMeta.filter(m=>m.needsApproval).length} of ${inserted?.length||0} entr${rowMeta.filter(m=>m.needsApproval).length===1?'y is':'ies are'} pending admin approval before counting as confirmed.`)
        }
        setShowForm(false);setReceiptFile(null);setRows([{...emptyRow}])
        if(inserted?.[0]&&!rowMeta[0]?.needsApproval)setReceiptMemoEntry({...inserted[0],receipt_url:rows[0].receipt_url||inserted[0].receipt_url})
        fetchEntries()
      }
    }
    setSaving(false)
  }

  const handleDelete=async(id)=>{
    if(!isAdmin){alert('Only admin can delete transactions.');return}
    if(!window.confirm('Delete this transaction?'))return
    const original=entries.find(e=>e.id===id)
    const ok=await mutateAccountsTable(
      ()=>supabase.from('accounts').update({is_soft_deleted:true,deleted_by:role,deleted_at:new Date().toISOString()}).eq('id',id),
      {errorContext:'Delete'}
    )
    if(!ok)return
    await writeAuditLog({action:'delete',role,targetId:id,oldValues:original})
    fetchEntries();fetchDeletedRows()
  }

  const handleRestore=async(id)=>{
    if(!isAdmin)return
    // PHASE 6 FIX: was previously fire-and-forget with no error check —
    // a failed restore looked identical to a successful one to the user.
    const ok=await mutateAccountsTable(
      ()=>supabase.from('accounts').update({is_soft_deleted:false,deleted_by:null,deleted_at:null}).eq('id',id),
      {errorContext:'Restore'}
    )
    if(!ok)return
    await writeAuditLog({action:'restore',role,targetId:id})
    fetchEntries();fetchDeletedRows()
  }

  const handlePermanentDelete=async(id)=>{
    if(!isAdmin)return
    const item=deletedRows.find(e=>e.id===id)
    if(!window.confirm(`Permanently delete this entry?\n\n"${item?.category||''} — ${item?.type||''} — ₹${Number(item?.amount||0).toLocaleString('en-IN')}"\n\nThis CANNOT be undone.`))return
    if(item?.receipt_url){
      const path=item.receipt_url.split('/').pop()
      await supabase.storage.from(RECEIPT_BUCKET).remove([path])
    }
    const ok=await mutateAccountsTable(
      ()=>supabase.from('accounts').delete().eq('id',id),
      {errorContext:'Permanent delete'}
    )
    if(!ok)return
    await writeAuditLog({action:'permanent_delete',role,targetId:id,oldValues:item})
    fetchDeletedRows()
  }

  const handleBulkDelete=async()=>{
    if(!isAdmin){alert('Only admin can delete transactions.');return}
    if(!selected.size)return
    if(!window.confirm(`Delete ${selected.size} selected transaction(s)?`))return
    // PHASE 6 FIX: previously no error check per-row — one failed row in the
    // loop would silently continue to the next, and the audit log could end
    // up recording a 'bulk_delete' for a row that was never actually updated
    // in the database. Now each row's result is tracked and failures are
    // reported to the user by id, without aborting the rest of the batch.
    const failedIds=[]
    for(const id of[...selected]){
      const original=entries.find(e=>e.id===id)
      const{error}=await supabase.from('accounts').update({is_soft_deleted:true,deleted_by:role,deleted_at:new Date().toISOString()}).eq('id',id)
      if(error){
        console.error(`Bulk delete failed for id ${id}:`,error)
        failedIds.push(id)
        continue
      }
      await writeAuditLog({action:'bulk_delete',role,targetId:id,oldValues:original})
    }
    if(failedIds.length){
      alert(`${failedIds.length} of ${selected.size} deletion(s) failed (id: ${failedIds.join(', ')}). The rest were deleted successfully.`)
    }
    setSelected(new Set());fetchEntries();fetchDeletedRows()
  }

  // ── Expenditure v2: approval queue actions ───────────────────────────────
  // Admin-only. Approving flips the underlying accounts row to Confirmed (so
  // it now counts in every total/report) and marks the request approved;
  // rejecting leaves the accounts row as-is (still Pending, still excluded
  // from every total via isConfirmed()) so a rejected entry never silently
  // vanishes — it stays visible and editable, just permanently non-counting
  // unless someone corrects and resubmits it.
  const approveExpenditure=async(req)=>{
    if(!isAdmin)return
    if(!window.confirm(`Approve this ${fmt(req.amount)} expenditure?\n\nRequested by: ${req.requested_by}\nReason for approval gate: ${req.reason==='both'?'role + amount threshold':req.reason==='role'?'submitter role':'amount threshold'}`))return
    setApprovalBusyId(req.id)
    const ok=await mutateAccountsTable(
      ()=>supabase.from('accounts').update({status:'Confirmed'}).eq('id',req.entry_id),
      {errorContext:'Approve expenditure'}
    )
    if(ok){
      const decidedAt=new Date().toISOString()
      await supabase.from('expenditure_approvals').update({status:'approved',decided_by:role,decided_by_id:String(currentStaff?.id||userId||''),decided_at:decidedAt}).eq('id',req.id)
      await writeAuditLog({action:'expenditure_approved',role,targetId:req.entry_id,oldValues:{status:'Pending'},newValues:{status:'Confirmed',amount:req.amount}})
      fetchPendingApprovals();fetchEntries();fetchApprovalHistoryToday(today)
    }
    setApprovalBusyId(null)
  }

  const rejectExpenditure=async(req)=>{
    if(!isAdmin)return
    const note=window.prompt('Reason for rejecting this expenditure (optional, recorded for the record):','')
    if(note===null)return
    setApprovalBusyId(req.id)
    const decidedAt=new Date().toISOString()
    const{error}=await supabase.from('expenditure_approvals').update({status:'rejected',decided_by:role,decided_by_id:String(currentStaff?.id||userId||''),decided_at:decidedAt,decision_note:note||null}).eq('id',req.id)
    if(error){alert('Reject failed: '+error.message)}
    else{
      await writeAuditLog({action:'expenditure_rejected',role,targetId:req.entry_id,newValues:{amount:req.amount,note}})
      fetchPendingApprovals();fetchApprovalHistoryToday(today)
    }
    setApprovalBusyId(null)
  }

  // ── Expenditure v2: admin-editable approval threshold ───────────────────
  const saveApprovalThreshold=async()=>{
    const amt=Number(thresholdDraft)
    if(!(amt>=0)){alert('Enter a valid amount.');return}
    const editedAt=new Date().toISOString()
    const{error}=await supabase.from('expenditure_approval_settings').upsert({id:1,threshold_amount:amt,lower_trust_roles:approvalSettings.lower_trust_roles,edited_by:role,edited_at:editedAt})
    if(error){alert('Could not save threshold (has the expenditure v2 migration been run?): '+error.message);return}
    setApprovalSettings(prev=>({...prev,threshold_amount:amt}))
    setEditThreshold(false)
  }

  const toggleSelect=(id)=>setSelected(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n})

  const updateRow=(i,key,val)=>setRows(prev=>prev.map((r,idx)=>{
    if(idx!==i)return r
    // ACTUAL PAYMENT DATE FIX: keep payment_date following entry_date until the user
    // explicitly diverges them (i.e. payment_date currently still mirrors entry_date)
    if(key==='entry_date'&&(r.payment_date===r.entry_date||!r.payment_date))return{...r,entry_date:val,payment_date:val}
    return{...r,[key]:val}
  }))
  const addRow=()=>setRows(prev=>[...prev,{...emptyRow,type:canAddIncome?'Income':'Expense',entry_date:today,payment_date:today,voucher_head:currentStaff?.name||''}])
  const removeRow=(i)=>setRows(prev=>prev.filter((_,idx)=>idx!==i))

  const addCustomExpenseCategory=(i)=>{
    const name=window.prompt('New expense category name:')?.trim()
    if(!name)return
    const existing=expenseCategoryOptions.find(c=>c.toLowerCase()===name.toLowerCase())
    if(existing){updateRow(i,'category',existing);return}
    const next=[...customExpCats,name]
    setCustomExpCats(next)
    localStorage.setItem('acc_custom_expense_categories',JSON.stringify(next))
    updateRow(i,'category',name)
  }

  const addNewStaffMember=async(i)=>{
    const name=window.prompt('New staff member name (Voucher Head):')?.trim()
    if(!name)return
    const existing=staffList.find(s=>s.name?.toLowerCase()===name.toLowerCase())
    if(existing){updateRow(i,'voucher_head',existing.name);return}
    const{data,error}=await supabase.from('staff').insert({name}).select()
    if(error){alert('Could not add staff member: '+error.message);return}
    setStaffList(prev=>[...prev,...(data||[{name}])])
    updateRow(i,'voucher_head',name)
  }

  // ── Expenditure v2: sub-category (built-in + user-added, per top-level category) ──
  const subCategoryOptionsFor=useCallback((category)=>{
    const builtin=EXPENSE_SUBCATEGORIES[category]||[]
    const custom=customSubCats[category]||[]
    return [...new Set([...builtin,...custom])]
  },[customSubCats])

  const addCustomSubCategory=(i,category)=>{
    const name=window.prompt(`New sub-category under "${category}":`)?.trim()
    if(!name)return
    const existing=subCategoryOptionsFor(category).find(c=>c.toLowerCase()===name.toLowerCase())
    if(existing){updateRow(i,'sub_category',existing);return}
    const next={...customSubCats,[category]:[...(customSubCats[category]||[]),name]}
    setCustomSubCats(next)
    localStorage.setItem('acc_custom_subcategories',JSON.stringify(next))
    updateRow(i,'sub_category',name)
  }

  // ── Expenditure v2: vendor/payee ──────────────────────────────────────────
  const addNewVendor=async(i)=>{
    const name=window.prompt('New vendor/payee name:')?.trim()
    if(!name)return
    const existing=vendors.find(v=>v.name?.toLowerCase()===name.toLowerCase())
    if(existing){updateRow(i,'vendor_id',existing.id);return}
    const{data,error}=await supabase.from('vendors').insert({name,created_by:currentStaff?.name||role}).select()
    if(error){alert('Could not add vendor (has the expenditure v2 migration been run?): '+error.message);return}
    if(data?.[0]){setVendors(prev=>[...prev,data[0]].sort((a,b)=>a.name.localeCompare(b.name)));updateRow(i,'vendor_id',data[0].id)}
  }

  // ── Accounts v3: payers / income sources (mirrors addNewVendor) ─────────
  const addNewPayer=async(i)=>{
    const name=window.prompt('New payer/source name:')?.trim()
    if(!name)return
    const existing=payers.find(p=>p.name?.toLowerCase()===name.toLowerCase())
    if(existing){updateRow(i,'payer_id',existing.id);return}
    const{data,error}=await supabase.from('payers').insert({name,created_by:currentStaff?.name||role}).select()
    if(error){alert('Could not add payer (has the accounts v3 migration been run?): '+error.message);return}
    if(data?.[0]){setPayers(prev=>[...prev,data[0]].sort((a,b)=>a.name.localeCompare(b.name)));updateRow(i,'payer_id',data[0].id)}
  }

  // ── Accounts v3: save an income collection target for a category/month ──
  const saveIncTarget=async(category,amount)=>{
    const monthStr=today.slice(0,7)
    const amt=Number(amount)||0
    const{error}=await supabase.from('income_targets').upsert({category,month:monthStr,target_amount:amt,set_by:currentStaff?.name||role,set_at:new Date().toISOString()},{onConflict:'category,month'})
    if(error){alert('Could not save income target (has the accounts v3 migration been run?): '+error.message);return}
    setIncTargets(prev=>{
      const others=prev.filter(t=>t.category!==category)
      return [...others,{category,month:monthStr,target_amount:amt}]
    })
    setEditIncTarget(null)
  }

  // ── Accounts v3: recurring templates CRUD (forecast side only) ──────────
  const addRecurringTemplate=async()=>{
    const t=newRecurringTpl
    if(!t.category||!t.label.trim()||!(Number(t.expected_amount)>0)){alert('Category, label, and an expected amount greater than 0 are required.');return}
    const payload={
      type:t.type,category:t.category,label:t.label.trim(),
      expected_amount:Number(t.expected_amount),
      day_of_month:t.day_of_month?Number(t.day_of_month):null,
      created_by:currentStaff?.name||role,
    }
    const{data,error}=await supabase.from('recurring_templates').insert(payload).select()
    if(error){alert('Could not add recurring item (has the accounts v3 migration been run?): '+error.message);return}
    if(data?.[0])setRecurringTemplates(prev=>[...prev,data[0]].sort((a,b)=>(a.day_of_month||99)-(b.day_of_month||99)))
    setNewRecurringTpl({type:'Expense',category:'',label:'',expected_amount:'',day_of_month:''})
    setShowAddRecurringTpl(false)
  }
  const removeRecurringTemplate=async(id)=>{
    if(!window.confirm('Remove this recurring forecast item? It will no longer appear in the forecast list.'))return
    const{error}=await supabase.from('recurring_templates').update({is_active:false}).eq('id',id)
    if(error){alert('Could not remove: '+error.message);return}
    setRecurringTemplates(prev=>prev.filter(r=>r.id!==id))
  }

  // ── Accounts v3: bank reconciliation ─────────────────────────────────────
  const toggleReconciled=async(entry)=>{
    if(!isAdmin){alert('Only admin can mark entries reconciled.');return}
    setReconBusyId(entry.id)
    const nextVal=!entry.reconciled
    const{error}=await supabase.from('accounts').update({
      reconciled:nextVal,
      reconciled_by:nextVal?(currentStaff?.name||role):null,
      reconciled_at:nextVal?new Date().toISOString():null,
    }).eq('id',entry.id)
    setReconBusyId(null)
    if(error){alert('Could not update reconciliation status (has the accounts v3 migration been run?): '+error.message);return}
    fetchEntries()
  }

  // ── Accounts v3: month-end close / lock ──────────────────────────────────
  const closeMonth=async(accountType,monthStr)=>{
    if(!isAdmin)return
    if(!window.confirm(`Close ${monthStr} for ${accountType}? Non-admin staff won't be able to add or edit entries dated in this month until it's reopened.`))return
    const{error}=await supabase.from('month_locks').upsert({
      account_type:accountType,month:monthStr,is_locked:true,
      closed_by:currentStaff?.name||role,closed_at:new Date().toISOString(),
      reopened_by:null,reopened_at:null,
    },{onConflict:'account_type,month'})
    if(error){alert('Could not close month (has the accounts v3 migration been run?): '+error.message);return}
    fetchMonthLocks()
    // Record the closing balance snapshot at the moment of closing, so a
    // later month's opening balance can be checked against it.
    const monthEntries=entries.filter(e=>e.account_type===accountType&&isConfirmed(e)&&monthKey(e.entry_date)<=monthStr)
    const closingBalance=monthEntries.reduce((s,e)=>s+(e.type==='Income'?Number(e.amount):-Number(e.amount)),0)
    const priorMonthEntries=entries.filter(e=>e.account_type===accountType&&isConfirmed(e)&&monthKey(e.entry_date)<monthStr)
    const openingBalance=priorMonthEntries.reduce((s,e)=>s+(e.type==='Income'?Number(e.amount):-Number(e.amount)),0)
    await supabase.from('month_opening_balances').upsert({account_type:accountType,month:monthStr,opening_balance:openingBalance,closing_balance:closingBalance},{onConflict:'account_type,month'})
    fetchOpeningBalances()
  }
  const reopenMonth=async(accountType,monthStr)=>{
    if(!isAdmin)return
    if(!window.confirm(`Reopen ${monthStr} for ${accountType}? Staff will be able to add/edit entries in this month again.`))return
    const{error}=await supabase.from('month_locks').update({is_locked:false,reopened_by:currentStaff?.name||role,reopened_at:new Date().toISOString()}).eq('account_type',accountType).eq('month',monthStr)
    if(error){alert('Could not reopen month: '+error.message);return}
    fetchMonthLocks()
  }

  // PHASE 1 FIX: budget save confirmation to prevent silent overwrite
  const saveBudgets=async()=>{
    if(!window.confirm('Save budget changes? This will overwrite any edits made by other admins.'))return
    const oldBudgets={...budgets};setBudgets(budgetDraft)
    localStorage.setItem('acc_budgets',JSON.stringify(budgetDraft))
    const editedAt=new Date().toISOString()
    await supabase.from('account_budgets').upsert({id:1,budgets:budgetDraft,budget_edited_by:role,budget_edited_at:editedAt})
    setBudgetMeta({edited_by:role,edited_at:editedAt})
    await writeAuditLog({action:'budget_edit',role,targetId:1,oldValues:oldBudgets,newValues:budgetDraft})
    setEditBudgets(false)
  }

  // BUGFIX: exportCSV and exportDailyCSV below used to join raw fields with
  // a bare `,` and no quoting/escaping. Any free-text field (note,
  // voucher_head, category) containing a comma — e.g. "Stationery, ink &
  // paper" — silently shifted every column after it out of alignment for
  // that row in the exported file, with no error or warning. A field
  // containing a double-quote had the same problem the other way (an
  // unescaped `"` inside an unquoted field is technically fine for a bare
  // comma-join, but breaks the moment the value is later opened in Excel/
  // Sheets, which still tries to interpret quote characters). Both exports
  // below now go through the same quote-and-escape rule already used
  // correctly by exportExpenditureCSV, so a comma or quote in a note can
  // never corrupt neighboring columns.
  const csvCell=(v)=>`"${String(v??'').replace(/"/g,'""')}"`
  const exportCSV=async()=>{
    const header=['Date','Type','Category','Amount','Mode','Account','Voucher Head','Status','Note']
    const rows_=filteredEntries.map(e=>[e.entry_date,e.type,e.category,e.amount,e.payment_mode,e.account_type||'Cash A/c',e.voucher_head||'',e.status||'Confirmed',e.note||''])
    const csv=[header,...rows_].map(r=>r.map(csvCell).join(',')).join('\n')
    const blob=new Blob([csv],{type:'text/csv'}),url=URL.createObjectURL(blob)
    const a=Object.assign(document.createElement('a'),{href:url,download:'accounts.csv'})
    a.click();URL.revokeObjectURL(url)
    // PHASE 1 FIX: export log with proper error handling
    try{
      const{error:logErr}=await supabase.from('export_log').insert({exported_by:role,filter_type:typeFilter,filter_dates:`${dateFrom}–${dateTo}`,row_count:filteredEntries.length,created_at:new Date().toISOString()})
      if(logErr)console.warn('Export log failed:',logErr.message)
      if(isAdmin)fetchExportLog()
    }catch(e){console.warn('Export log error:',e)}
  }

  const exportDailyCSV=()=>{
    const filtered=dailyFilteredEntries
    const header=dailyIsIncome
      ? ['#','Payment Date','Entry Date','Voucher Head','Account','Description','Payment Mode','Amount']
      : ['#','Date','Voucher Head','Account','Description','Payment Mode','Amount']
    const rows_=filtered.map((e,i)=>dailyIsIncome
      ? [i+1,e.payment_date||e.entry_date,e.entry_date,e.voucher_head||'',e.account_type||'Cash A/c',e.note||e.category,e.payment_mode,e.amount]
      : [i+1,e.entry_date,e.voucher_head||'',e.account_type||'Cash A/c',e.note||e.category,e.payment_mode,e.amount])
    const csv=[header,...rows_].map(r=>r.map(csvCell).join(',')).join('\n')
    const blob=new Blob([csv],{type:'text/csv'}),url=URL.createObjectURL(blob)
    const a=Object.assign(document.createElement('a'),{href:url,download:`daily-${dailyTypeFilter.toLowerCase()}.csv`})
    a.click();URL.revokeObjectURL(url)
  }

  const printDailyRegister=()=>{
    const filtered=dailyFilteredEntries
    const groups=groupByDate(filtered)
    const totalAmt=filtered.reduce((s,e)=>s+Number(e.amount),0)
    const cashAmt=filtered.filter(e=>e.payment_mode==='Cash').reduce((s,e)=>s+Number(e.amount),0)
    const bankAmt=filtered.filter(e=>e.payment_mode==='Bank').reduce((s,e)=>s+Number(e.amount),0)
    const w=window.open('','_blank')
    const regTitle=`Daily ${dailyLabelWord} Register`
    const dateModeLabel=dailyIsIncome?(dailyDateMode==='payment'?'Actual Payment Date':'Entry Date'):'Entry Date'
    let rowNum=0
    w.document.write(`<html><head><title>${regTitle}</title><style>
      body{font-family:Arial,sans-serif;padding:24px;font-size:12px;color:#1a2535}
      h1{font-size:18px;margin-bottom:4px}p{color:#666;margin:0 0 16px}
      table{width:100%;border-collapse:collapse;margin-bottom:20px}
      th{background:#1e3a5f;color:#fff;padding:7px 10px;text-align:left;font-size:11px}
      td{padding:7px 10px;border-bottom:1px solid #eee}
      .day-header{background:#e8f0fa;font-weight:bold;padding:6px 10px}
      .subtotal{background:#f7fafd;font-weight:bold}
      .grand{background:#1e3a5f;color:#fff;font-weight:bold}
      .amt{text-align:right;color:${dailyAmtColor};font-weight:600}
      .total-amt{text-align:right;font-weight:bold}
      @page{margin:15mm}
    </style></head><body>
    <h1>📊 ${regTitle} — GNSI Portal</h1>
    <p>Grouped by: ${dateModeLabel} &nbsp;|&nbsp; Voucher Head: ${voucherHead||'All'} &nbsp;|&nbsp; Range: ${dateFrom||'All'}–${dateTo||'present'} &nbsp;|&nbsp; Generated: ${new Date().toLocaleString('en-IN')}</p>
    <table><tr><th>#</th><th>Sl</th><th>Account</th><th>Description</th><th>Pay Mode</th>${dailyIsIncome?'<th>Entry Date</th>':''}<th style="text-align:right">Amount (${dailyDrCr})</th></tr>
    ${groups.map(([date,rows])=>{
      const dayTotal=rows.reduce((s,e)=>s+Number(e.amount),0)
      const dayRows=rows.map(e=>{rowNum++;return`<tr><td>${rowNum}</td><td style="color:#888;font-size:11px">${e.id||''}</td><td><b>${e.account_type||'Cash A/c'}</b></td><td>${(e.note||e.category||'').replace(/</g,'&lt;')}</td><td>${e.payment_mode}</td>${dailyIsIncome?`<td style="font-size:11px;color:#888">${e.entry_date}</td>`:''}<td class="amt">${fmt(e.amount)}</td></tr>`}).join('')
      return`<tr><td colspan="${dailyIsIncome?7:6}" class="day-header">${date} — ${weekdayOf(date)} (${rows.length} entries)</td></tr>${dayRows}<tr class="subtotal"><td colspan="${dailyIsIncome?6:5}">Daily Total</td><td class="total-amt">${fmt(dayTotal)}</td></tr>`
    }).join('')}
    <tr class="grand"><td colspan="4">GRAND TOTAL</td><td colspan="${dailyIsIncome?2:1}">Cash: ${fmt(cashAmt)} | Bank: ${fmt(bankAmt)}</td><td class="total-amt">${fmt(totalAmt)}</td></tr>
    </table></body></html>`)
    w.document.close();w.print()
  }

  // ── Receipt / Voucher Memo (print-ready, single entry) ───────────────────
  const printReceiptMemo=(item)=>{
    const w=window.open('','_blank');if(!w)return
    const isIncome=item.type==='Income'
    w.document.write(`<html><head><title>Voucher Memo - ${item.id||''}</title><style>
      body{font-family:Arial,sans-serif;padding:36px;color:#1e293b}
      .head{text-align:center;border-bottom:2px solid #1e3a5f;padding-bottom:12px;margin-bottom:20px}
      .head h1{font-size:18px;color:#1e3a5f;margin:0 0 4px}
      .head p{font-size:12px;color:#64748b;margin:2px 0}
      h2{font-size:15px;color:#1e3a5f;margin:20px 0 10px;text-align:center;text-decoration:underline}
      table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px}
      td{padding:8px 12px;border-bottom:1px solid #f1f5f9}
      td.label{color:#64748b;font-weight:600;width:40%}
      .amt{font-size:20px;font-weight:800;text-align:center;padding:14px;border:2px solid ${isIncome?'#16a34a':'#dc2626'};border-radius:8px;color:${isIncome?'#16a34a':'#dc2626'};margin:16px 0}
      .sig{display:flex;justify-content:space-between;margin-top:60px}
      .sig div{width:45%;text-align:center;border-top:1px solid #1e293b;padding-top:6px;font-size:12px;color:#374151}
    </style></head><body>
    <div class="head">
      <h1>${INSTITUTE_INFO.name}</h1>
      <p>${INSTITUTE_INFO.tagline}</p>
      <p>${INSTITUTE_INFO.address}</p>
    </div>
    <h2>${isIncome?'RECEIPT VOUCHER':'PAYMENT VOUCHER'}</h2>
    <table>
      <tr><td class="label">Voucher No.</td><td>${item.id||'-'}</td></tr>
      <tr><td class="label">Date</td><td>${item.entry_date}</td></tr>
      <tr><td class="label">Type</td><td>${item.type}</td></tr>
      <tr><td class="label">Category</td><td>${item.category}</td></tr>
      <tr><td class="label">Account</td><td>${item.account_type||'Cash A/c'}</td></tr>
      <tr><td class="label">Payment Mode</td><td>${item.payment_mode}</td></tr>
      <tr><td class="label">Voucher Head</td><td>${item.voucher_head||'-'}</td></tr>
      <tr><td class="label">Particulars / Note</td><td>${(item.note||'-').replace(/</g,'&lt;')}</td></tr>
      <tr><td class="label">Entered By</td><td>${item.added_by||item.edited_by||'-'}</td></tr>
      <tr><td class="label">Status</td><td>${item.status||'Confirmed'}</td></tr>
    </table>
    <div class="amt">${isIncome?'Received':'Paid'}: ${fmt(item.amount)}</div>
    <div class="sig">
      <div>Received/Paid By</div>
      <div>Authorized Signature</div>
    </div>
    </body></html>`)
    w.document.close();w.print()
  }

  const printPL=()=>{
    const w=window.open('','_blank')
    const{thisInc,thisExp,totalThisInc,totalThisExp}=plData,net=totalThisInc-totalThisExp
    const advParts=[]
    if(plAccountType!=='All')advParts.push(`Account: ${plAccountType}`)
    if(plPaymentMode!=='All')advParts.push(`Mode: ${plPaymentMode}`)
    if(plStatus!=='All')advParts.push(`Status: ${plStatus}`)
    const advLabel=advParts.length?` | Filters: ${advParts.join(', ')}`:''
    const manualAmt=Number(plManualIncome)||0
    const mismatchDiff=manualAmt-totalThisInc
    const mismatchSection=plManualIncome!==''?`<h2>Manual Ledger Reconciliation</h2><table>
    <tr><td>System Income (this period)</td><td class="green">${fmt(totalThisInc)}</td></tr>
    <tr><td>Manual Cash Book Income</td><td>${fmt(manualAmt)}</td></tr>
    <tr class="total"><td>Difference (Manual − System)</td><td class="${mismatchDiff===0?'green':(mismatchDiff>0?'red':'red')}">${mismatchDiff>=0?'+':''}${fmt(mismatchDiff)}</td></tr>
    </table>`:''
    const datewiseSection=plShowDatewise?`<h2>Date-wise Income &amp; Expenditure</h2><table><tr><th>Date</th><th>Income</th><th>Expenditure</th><th>Net</th></tr>
    ${plDatewise.map(d=>`<tr><td>${d.date}</td><td class="green">${fmt(d.income)}</td><td class="red">${fmt(d.expense)}</td><td class="${d.income-d.expense>=0?'green':'red'}">${fmt(d.income-d.expense)}</td></tr>`).join('')}
    <tr class="total"><td>Total</td><td class="green">${fmt(totalThisInc)}</td><td class="red">${fmt(totalThisExp)}</td><td class="${net>=0?'green':'red'}">${fmt(net)}</td></tr>
    </table>`:''
    w.document.write(`<html><head><title>P&L - ${plPeriodLabel}</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#1e293b}h1{font-size:22px}h2{font-size:15px;font-weight:600;margin:20px 0 8px;color:#1e3a5f}p{font-size:13px;color:#64748b;margin:0 0 16px}table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px}th{background:#f8fafc;padding:8px 12px;text-align:left;border-bottom:1px solid #e2e8f0;font-size:12px}td{padding:8px 12px;border-bottom:1px solid #f1f5f9}.total{font-weight:bold;background:#f8fafc}.green{color:#16a34a}.red{color:#dc2626}</style></head><body>
    <h1>Income & Expenditure Statement</h1>
    <p>Period: ${plPeriodLabel}${advLabel} | Generated: ${new Date().toLocaleString('en-IN')}</p>
    ${plShowDatewise?datewiseSection:`<h2>Income</h2><table><tr><th>Category</th><th>Amount</th></tr>
    ${Object.entries(thisInc).map(([k,v])=>`<tr><td>${k.replace(/</g,'&lt;')}</td><td class="green">${fmt(v)}</td></tr>`).join('')}
    <tr class="total"><td>Total Income</td><td class="green">${fmt(totalThisInc)}</td></tr></table>
    <h2>Expenditure</h2><table><tr><th>Category</th><th>Amount</th></tr>
    ${Object.entries(thisExp).map(([k,v])=>`<tr><td>${k.replace(/</g,'&lt;')}</td><td class="red">${fmt(v)}</td></tr>`).join('')}
    <tr class="total"><td>Total Expenditure</td><td class="red">${fmt(totalThisExp)}</td></tr></table>`}
    ${mismatchSection}
    <h2>Summary</h2><table>
    <tr><td>Total Income</td><td class="green">${fmt(totalThisInc)}</td></tr>
    <tr><td>Total Expenditure</td><td class="red">${fmt(totalThisExp)}</td></tr>
    <tr class="total"><td>Net Surplus / Deficit</td><td class="${net>=0?'green':'red'}">${fmt(net)}</td></tr>
    </table></body></html>`)
    w.document.close();w.print()
  }

  // ── Date-wise report print — one row per date with income/expense/net,
  // matching the on-screen "Date-wise" preview mode in the Reports tab.
  const printDatewise=()=>{
    const w=window.open('','_blank')
    const periodLabel=`${rptDateFrom||'Beginning'} to ${rptDateTo||'Present'}`
    w.document.write(`<html><head><title>Date-wise Income &amp; Expenditure - ${periodLabel}</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#1e293b}h1{font-size:22px}p{font-size:13px;color:#64748b;margin:0 0 16px}table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px}th{background:#f8fafc;padding:8px 12px;text-align:left;border-bottom:1px solid #e2e8f0;font-size:12px}td{padding:8px 12px;border-bottom:1px solid #f1f5f9}.total{font-weight:bold;background:#f8fafc}.green{color:#16a34a}.red{color:#dc2626}</style></head><body>
    <h1>Date-wise Income &amp; Expenditure</h1>
    <p>Period: ${periodLabel} | Generated: ${new Date().toLocaleString('en-IN')}</p>
    <table><tr><th>Date</th><th>Income</th><th>Expense</th><th>Net</th></tr>
    ${[...reportByDate].sort((a,b)=>a.date<b.date?-1:1).map(d=>`<tr><td>${d.date}</td><td class="green">${fmt(d.income)}</td><td class="red">${fmt(d.expense)}</td><td class="${d.income-d.expense>=0?'green':'red'}">${fmt(d.income-d.expense)}</td></tr>`).join('')}
    <tr class="total"><td>Total</td><td class="green">${fmt(reportTotals.income)}</td><td class="red">${fmt(reportTotals.expense)}</td><td class="${reportTotals.net>=0?'green':'red'}">${fmt(reportTotals.net)}</td></tr>
    </table></body></html>`)
    w.document.close();w.print()
  }

  // ── Report Generator: shared export-log helper ──────────────────────────
  // opts lets callers (e.g. the dedicated Expenditure report) override what gets logged
  const logReportExport=(format,opts={})=>{
    supabase.from('export_log').insert({
      exported_by:role,
      filter_type:opts.logLabel||`Report (${format}): ${rptReportType} / ${rptType}`,
      filter_dates:`${(opts.dateFrom??rptDateFrom)||'all'}–${(opts.dateTo??rptDateTo)||'present'}`,
      row_count:opts.rowCount??reportEntries.length,
      created_at:new Date().toISOString(),
    }).then(({error})=>{
      if(error)console.warn('Export log failed:',error.message)
      else if(isAdmin)fetchExportLog()
    })
  }

  // ── Report Generator: Professional PDF (jsPDF + autoTable) ──────────────
  // opts (optional) lets the dedicated Expenditure tab reuse this exact letterheaded
  // export with its own filtered dataset, without touching the generic Reports tab state.
  // ── Report Generator: chart image (Canvas 2D → PNG data URL) ────────────
  // Renders a compact bar chart (Income vs Expense, or category break-up) to
  // an off-screen canvas and returns a PNG data URL for embedding into PDF/DOCX.
  // Kept dependency-free (no charting library) since jsPDF/docx only need a bitmap.
  const renderChartImage = ({ bars, width = 900, height = 320, title = '' }) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')

    // background
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, width, height)

    const padLeft = 70, padRight = 30, padTop = title ? 44 : 20, padBottom = 60
    const chartW = width - padLeft - padRight
    const chartH = height - padTop - padBottom
    const maxVal = Math.max(1, ...bars.map(b => b.value))

    if (title) {
      ctx.fillStyle = '#1E3A5F'
      ctx.font = 'bold 18px Arial, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(title, width / 2, 26)
    }

    // gridlines + y-axis labels (4 steps)
    ctx.strokeStyle = '#E2E8F0'
    ctx.lineWidth = 1
    ctx.font = '11px Arial, sans-serif'
    ctx.fillStyle = '#94A3B8'
    ctx.textAlign = 'right'
    const steps = 4
    for (let i = 0; i <= steps; i++) {
      const y = padTop + chartH - (chartH * i) / steps
      ctx.beginPath()
      ctx.moveTo(padLeft, y)
      ctx.lineTo(width - padRight, y)
      ctx.stroke()
      const val = (maxVal * i) / steps
      ctx.fillText('₹' + Math.round(val).toLocaleString('en-IN'), padLeft - 10, y + 4)
    }

    // bars
    const gap = 18
    const barW = Math.min(70, (chartW - gap * (bars.length + 1)) / Math.max(1, bars.length))
    let x = padLeft + gap
    bars.forEach((b) => {
      const barH = (b.value / maxVal) * chartH
      const y = padTop + chartH - barH
      ctx.fillStyle = b.color || '#1E3A5F'
      ctx.beginPath()
      const r = 4
      ctx.moveTo(x, y + r)
      ctx.arcTo(x, y, x + r, y, r)
      ctx.lineTo(x + barW - r, y)
      ctx.arcTo(x + barW, y, x + barW, y + r, r)
      ctx.lineTo(x + barW, padTop + chartH)
      ctx.lineTo(x, padTop + chartH)
      ctx.closePath()
      ctx.fill()

      // value label above bar
      ctx.fillStyle = '#1E293B'
      ctx.font = 'bold 11px Arial, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('₹' + Math.round(b.value).toLocaleString('en-IN'), x + barW / 2, y - 6)

      // x-axis label (wrapped if long)
      ctx.fillStyle = '#475569'
      ctx.font = '11px Arial, sans-serif'
      const label = b.label.length > 14 ? b.label.slice(0, 13) + '…' : b.label
      ctx.fillText(label, x + barW / 2, padTop + chartH + 18)

      x += barW + gap
    })

    // baseline
    ctx.strokeStyle = '#CBD5E1'
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(padLeft, padTop + chartH)
    ctx.lineTo(width - padRight, padTop + chartH)
    ctx.stroke()

    return canvas.toDataURL('image/png')
  }

  // Builds the two standard chart images (Income vs Expense, Top Categories)
  // reused across PDF/DOCX. Returns { summaryChart, categoryChart } data URLs,
  // or nulls for a chart if there's nothing to plot.
  const buildReportCharts = (totalsData, byCategoryData) => {
    const summaryChart = renderChartImage({
      title: 'Income vs Expense',
      bars: [
        { label: 'Income', value: totalsData.income, color: '#16A34A' },
        { label: 'Expense', value: totalsData.expense, color: '#DC2626' },
      ],
    })
    let categoryChart = null
    if (byCategoryData && byCategoryData.length) {
      const top = [...byCategoryData].sort((a, b) => b.total - a.total).slice(0, 6)
      categoryChart = renderChartImage({
        title: 'Top Categories',
        bars: top.map(c => ({
          label: c.category,
          value: c.total,
          color: c.type === 'Income' ? '#16A34A' : '#DC2626',
        })),
      })
    }
    return { summaryChart, categoryChart }
  }

  const generateReportPDF=(opts={})=>{
    const entriesData     = opts.entries     || reportEntries
    const totalsData      = opts.totals      || reportTotals
    const byCategoryData  = opts.byCategory  || reportByCategory
    const titleData       = opts.title       || rptReportType
    const filterSummaryData = opts.filterSummary || reportFilterSummary
    const setBusy         = opts.setBusy     || setGeneratingReport
    if(entriesData.length===0){alert('No entries match the selected filters.');return}
    setBusy('pdf')
    try{
      // jsPDF's built-in fonts don't render the ₹ glyph, so PDF output uses "Rs." prefix
      const fmtPdf=(n)=>`Rs. ${Number(n).toLocaleString('en-IN')}`
      const printDate=new Date().toLocaleString('en-IN')
      const doc=new jsPDF({orientation:'landscape',unit:'pt',format:'a4'})
      const pageW=doc.internal.pageSize.getWidth()
      const pageH=doc.internal.pageSize.getHeight()
      const margin=40

      // letterhead
      doc.setFont('helvetica','bold');doc.setFontSize(16);doc.setTextColor(30,58,95)
      doc.text(INSTITUTE_INFO.name,pageW/2,42,{align:'center'})
      doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(100,116,139)
      doc.text(INSTITUTE_INFO.tagline,pageW/2,56,{align:'center'})
      doc.text(INSTITUTE_INFO.address,pageW/2,68,{align:'center'})
      const contact=[INSTITUTE_INFO.phone,INSTITUTE_INFO.email,INSTITUTE_INFO.website].filter(Boolean).join('   |   ')
      if(contact)doc.text(contact,pageW/2,80,{align:'center'})
      doc.setDrawColor(30,58,95);doc.setLineWidth(1.2);doc.line(margin,90,pageW-margin,90)
      doc.setFont('helvetica','bold');doc.setFontSize(13);doc.setTextColor(30,41,59)
      doc.text(titleData,pageW/2,108,{align:'center'})
      doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(100,116,139)
      doc.text(filterSummaryData,pageW/2,121,{align:'center',maxWidth:pageW-2*margin})
      doc.setFontSize(8)
      doc.text(`Printed on: ${printDate}`,pageW-margin,121,{align:'right'})
      let y=134

      // summary cards — colored boxes instead of a plain table for a more
      // "dashboard" feel
      const cardW=(pageW-2*margin-3*12)/4
      const cardH=48
      const cards=[
        {label:'Total Income',value:fmtPdf(totalsData.income),bg:[220,252,231],fg:[22,163,74]},
        {label:'Total Expense',value:fmtPdf(totalsData.expense),bg:[254,226,226],fg:[220,38,38]},
        {label:'Net Balance',value:fmtPdf(totalsData.net),bg:[239,246,255],fg:[30,58,95]},
        {label:'Total Entries',value:String(totalsData.count),bg:[243,232,255],fg:[124,58,237]},
      ]
      cards.forEach((c,i)=>{
        const cx=margin+i*(cardW+12)
        doc.setFillColor(...c.bg)
        doc.roundedRect(cx,y,cardW,cardH,4,4,'F')
        doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(100,116,139)
        doc.text(c.label,cx+10,y+16)
        doc.setFont('helvetica','bold');doc.setFontSize(13);doc.setTextColor(...c.fg)
        doc.text(c.value,cx+10,y+34)
      })
      y+=cardH+18

      // charts — Income vs Expense, and Top Categories (if any breakdown exists)
      try{
        const {summaryChart,categoryChart}=buildReportCharts(totalsData,byCategoryData)
        const chartW=(pageW-2*margin-16)/(categoryChart?2:1)
        const chartH=chartW*(320/900)
        if(summaryChart)doc.addImage(summaryChart,'PNG',margin,y,chartW,chartH)
        if(categoryChart)doc.addImage(categoryChart,'PNG',margin+chartW+16,y,chartW,chartH)
        y+=chartH+16
      }catch(chartErr){console.error('Chart render skipped:',chartErr)}

      // break-up by category
      if(byCategoryData.length){
        doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(30,58,95)
        doc.text('Break-up by Category',margin,y);y+=6
        autoTable(doc,{
          startY:y,
          head:[['Category','Type','Entries','Amount']],
          body:byCategoryData.map(r=>[r.category,r.type,String(r.count),fmtPdf(r.total)]),
          headStyles:{fillColor:[30,58,95],textColor:255,fontSize:8.5},
          bodyStyles:{fontSize:8.5},
          columnStyles:{3:{halign:'right'}},
          margin:{left:margin,right:margin},
          didParseCell:(data)=>{
            if(data.section==='body'&&data.column.index===3){
              const type=data.row.raw[1]
              data.cell.styles.textColor=type==='Income'?[22,163,74]:[220,38,38]
              data.cell.styles.fontStyle='bold'
            }
          },
        })
        y=doc.lastAutoTable.finalY+16
      }

      // transaction detail
      doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(30,58,95)
      doc.text('Transaction Detail',margin,y);y+=6
      autoTable(doc,{
        startY:y,
        head:[['#','Date','Type','Category','Account','Mode','Voucher Head','Particulars / Note','Entered By','Receipt','Status','Amount']],
        body:entriesData.map((e,i)=>[i+1,e.entry_date,e.type,e.category,e.account_type||'Cash A/c',e.payment_mode,e.voucher_head||'-',e.note||'-',e.added_by||e.edited_by||'admin',e.receipt_url?'Yes':'No',e.status||'Confirmed',`${e.type==='Income'?'+':'-'} ${fmtPdf(e.amount)}`]),
        headStyles:{fillColor:[30,58,95],textColor:255,fontSize:8},
        bodyStyles:{fontSize:7.5},
        alternateRowStyles:{fillColor:[248,250,252]},
        columnStyles:{0:{cellWidth:20},7:{cellWidth:110},11:{halign:'right'}},
        margin:{left:margin,right:margin,bottom:70},
        didParseCell:(data)=>{
          if(data.section==='body'&&data.column.index===11){
            const type=data.row.raw[2]
            data.cell.styles.textColor=type==='Income'?[22,163,74]:[220,38,38]
          }
          if(data.section==='body'&&data.column.index===9){
            data.cell.styles.textColor=data.cell.raw==='Yes'?[22,163,74]:[148,163,184]
          }
        },
        didDrawPage:(data)=>{
          doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(148,163,184)
          doc.text(`Page ${data.pageNumber}`,pageW-margin,pageH-20,{align:'right'})
          doc.text(`${INSTITUTE_INFO.name} · GNSI Portal`,margin,pageH-20)
        },
      })

      // signature block
      let sigY=doc.lastAutoTable.finalY+60
      if(sigY>pageH-70){doc.addPage('a4','landscape');sigY=80}
      doc.setDrawColor(30,41,59);doc.setLineWidth(0.6)
      doc.line(margin,sigY,margin+180,sigY)
      doc.line(pageW-margin-180,sigY,pageW-margin,sigY)
      doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(30,41,59)
      doc.text('Prepared By',margin,sigY+14)
      doc.text('Authorized Signature',pageW-margin-180,sigY+14)
      doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(148,163,184)
      doc.text(`Date: ${getToday()}`,margin,sigY+27)
      doc.text(`Date: ${getToday()}`,pageW-margin-180,sigY+27)

      doc.save(`GNSI-${titleData.replace(/\s+/g,'-')}-${getToday()}.pdf`)
      logReportExport('PDF',{logLabel:opts.logLabel,dateFrom:opts.dateFrom,dateTo:opts.dateTo,rowCount:entriesData.length})
    }catch(err){
      console.error(err)
      alert('PDF generation failed: '+err.message+'\n\nMake sure these packages are installed:\nnpm install jspdf jspdf-autotable')
    }
    setBusy('')
  }

  // ── Report Generator: Professional DOCX (docx library) ──────────────────
  const generateReportDOCX=async(opts={})=>{
    const entriesData     = opts.entries     || reportEntries
    const totalsData      = opts.totals      || reportTotals
    const titleData       = opts.title       || rptReportType
    const filterSummaryData = opts.filterSummary || reportFilterSummary
    const setBusy         = opts.setBusy     || setGeneratingReport
    if(entriesData.length===0){alert('No entries match the selected filters.');return}
    setBusy('docx')
    try{
      const printDate=new Date().toLocaleString('en-IN')
      const headerCellShade='1E3A5F'
      const noBorder={style:BorderStyle.NONE,size:0,color:'FFFFFF'}

      const titleHeading=new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:INSTITUTE_INFO.name,bold:true,size:32,color:'1E3A5F'})]})
      const taglineLine=new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:INSTITUTE_INFO.tagline,size:18,italics:true,color:'64748B'})]})
      const contact=[INSTITUTE_INFO.phone,INSTITUTE_INFO.email,INSTITUTE_INFO.website].filter(Boolean).join('  |  ')
      const addressLine=new Paragraph({
        alignment:AlignmentType.CENTER,
        border:{bottom:{style:BorderStyle.SINGLE,size:8,color:'1E3A5F'}},
        spacing:{after:200},
        children:[new TextRun({text:contact?`${INSTITUTE_INFO.address}   |   ${contact}`:INSTITUTE_INFO.address,size:20,color:'475569'})],
      })
      const reportTitlePara=new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:60},children:[new TextRun({text:titleData,bold:true,size:26,color:'1E293B'})]})
      const filterLine=new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:60},children:[new TextRun({text:filterSummaryData,size:16,italics:true,color:'64748B'})]})
      const printedLine=new Paragraph({alignment:AlignmentType.RIGHT,spacing:{after:200},children:[new TextRun({text:`Printed on: ${printDate}`,size:16,color:'94A3B8'})]})

      const sumCell=(label,value,color)=>new TableCell({
        width:{size:25,type:WidthType.PERCENTAGE},
        children:[
          new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:label,size:16,color:'64748B'})]}),
          new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:value,bold:true,size:22,color})]}),
        ],
      })
      const summaryTable=new Table({
        width:{size:100,type:WidthType.PERCENTAGE},
        rows:[new TableRow({children:[
          sumCell('Total Income',fmt(totalsData.income),'16A34A'),
          sumCell('Total Expense',fmt(totalsData.expense),'DC2626'),
          sumCell('Net Balance',fmt(totalsData.net),'1E3A5F'),
          sumCell('Entries',String(totalsData.count),'7C3AED'),
        ]})],
      })

      // charts — embedded as PNG images for visual polish, same generator as PDF
      let chartParas=[]
      try{
        const byCategoryForChart = opts.byCategory || reportByCategory
        const {summaryChart,categoryChart}=buildReportCharts(totalsData,byCategoryForChart)
        const toBuffer=async(dataUrl)=>{
          const res=await fetch(dataUrl)
          return new Uint8Array(await res.arrayBuffer())
        }
        const imgChildren=[]
        if(summaryChart)imgChildren.push(new ImageRun({data:await toBuffer(summaryChart),transformation:{width:430,height:153}}))
        if(categoryChart)imgChildren.push(new ImageRun({data:await toBuffer(categoryChart),transformation:{width:430,height:153}}))
        if(imgChildren.length){
          chartParas=[
            new Paragraph({text:'',spacing:{after:200}}),
            new Paragraph({alignment:AlignmentType.CENTER,children:imgChildren.flatMap((img,i)=>i===0?[img]:[new TextRun({text:'   '}),img])}),
          ]
        }
      }catch(chartErr){console.error('Chart render skipped:',chartErr)}

      const headRow=new TableRow({
        tableHeader:true,
        children:['#','Date','Type','Category','Account','Mode','Voucher Head','Particulars / Note','Entered By','Receipt','Status','Amount'].map(h=>new TableCell({
          shading:{type:ShadingType.CLEAR,fill:headerCellShade},
          children:[new Paragraph({children:[new TextRun({text:h,bold:true,color:'FFFFFF',size:16})]})],
        })),
      })
      const dataRows=entriesData.map((e,i)=>new TableRow({
        children:[String(i+1),e.entry_date,e.type,e.category,e.account_type||'Cash A/c',e.payment_mode,e.voucher_head||'-',e.note||'-',e.added_by||e.edited_by||'admin',e.receipt_url?'Yes':'No',e.status||'Confirmed',`${e.type==='Income'?'+':'-'} ${fmt(e.amount)}`]
          .map((val,ci)=>new TableCell({
            shading:i%2===1?{type:ShadingType.CLEAR,fill:'F8FAFC'}:undefined,
            children:[new Paragraph({
              alignment:ci===11?AlignmentType.RIGHT:AlignmentType.LEFT,
              children:[new TextRun({text:String(val),size:16,color:ci===11?(e.type==='Income'?'16A34A':'DC2626'):(ci===9?(val==='Yes'?'16A34A':'94A3B8'):'1E293B')})],
            })],
          })),
      }))
      const totalRow=new TableRow({
        children:[
          new TableCell({columnSpan:11,children:[new Paragraph({alignment:AlignmentType.RIGHT,children:[new TextRun({text:'NET TOTAL',bold:true,size:16})]})]}),
          new TableCell({children:[new Paragraph({alignment:AlignmentType.RIGHT,children:[new TextRun({text:fmt(totalsData.net),bold:true,size:16})]})]}),
        ],
      })
      const detailTable=new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:[headRow,...dataRows,totalRow]})

      const sigCell=(label)=>new TableCell({
        borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder},
        width:{size:50,type:WidthType.PERCENTAGE},
        children:[
          new Paragraph({spacing:{after:400},children:[new TextRun({text:' '})]}),
          new Paragraph({border:{top:{style:BorderStyle.SINGLE,size:6,color:'1E293B'}},children:[new TextRun({text:' '})]}),
          new Paragraph({children:[new TextRun({text:label,bold:true,size:18})]}),
          new Paragraph({children:[new TextRun({text:`Date: ${getToday()}`,size:14,color:'64748B'})]}),
        ],
      })
      const sigTable=new Table({
        width:{size:100,type:WidthType.PERCENTAGE},
        borders:{top:noBorder,bottom:noBorder,left:noBorder,right:noBorder,insideHorizontal:noBorder,insideVertical:noBorder},
        rows:[new TableRow({children:[sigCell('Prepared By'),sigCell('Authorized Signature')]})],
      })

      const docFile=new Document({
        sections:[{
          properties:{page:{size:{orientation:PageOrientation.LANDSCAPE},margin:{top:720,bottom:720,left:600,right:600}}},
          children:[
            titleHeading,taglineLine,addressLine,
            reportTitlePara,filterLine,printedLine,
            summaryTable,
            ...chartParas,
            new Paragraph({text:'',spacing:{after:200}}),
            detailTable,
            new Paragraph({text:'',spacing:{after:600}}),
            sigTable,
          ],
        }],
      })

      const blob=await Packer.toBlob(docFile)
      const url=URL.createObjectURL(blob)
      const a=Object.assign(document.createElement('a'),{href:url,download:`GNSI-${titleData.replace(/\s+/g,'-')}-${getToday()}.docx`})
      a.click();URL.revokeObjectURL(url)
      logReportExport('DOCX',{logLabel:opts.logLabel,dateFrom:opts.dateFrom,dateTo:opts.dateTo,rowCount:entriesData.length})
    }catch(err){
      console.error(err)
      alert('DOCX generation failed: '+err.message+'\n\nMake sure the "docx" package is installed:\nnpm install docx')
    }
    setBusy('')
  }

  // ── Report Generator: Professional Excel (SheetJS) ──────────────────────
  const generateReportExcel=(opts={})=>{
    const entriesData     = opts.entries     || reportEntries
    const totalsData      = opts.totals      || reportTotals
    const byCategoryData  = opts.byCategory  || reportByCategory
    const titleData       = opts.title       || rptReportType
    const filterSummaryData = opts.filterSummary || reportFilterSummary
    const setBusy         = opts.setBusy     || setGeneratingReport
    if(entriesData.length===0){alert('No entries match the selected filters.');return}
    setBusy('excel')
    try{
      const printDate=new Date().toLocaleString('en-IN')
      const headerLines=[INSTITUTE_INFO.name,INSTITUTE_INFO.tagline,INSTITUTE_INFO.address]
      const contact=[INSTITUTE_INFO.phone,INSTITUTE_INFO.email,INSTITUTE_INFO.website].filter(Boolean).join('  |  ')
      if(contact)headerLines.push(contact)
      headerLines.push('')
      headerLines.push(titleData)
      headerLines.push(filterSummaryData)
      headerLines.push(`Printed on: ${printDate}`)

      const wsData=headerLines.map(l=>[l])
      wsData.push([])
      const summaryRowIdx=wsData.length
      wsData.push(['Total Income',totalsData.income,'','Total Expense',totalsData.expense,'','Net Balance',totalsData.net,'','Entries',totalsData.count])
      wsData.push([])
      const headRowIdx=wsData.length
      wsData.push(['#','Date','Type','Category','Account','Mode','Voucher Head','Particulars / Note','Entered By','Receipt','Status','Amount'])
      const firstDataRowIdx=wsData.length
      entriesData.forEach((e,i)=>{
        wsData.push([i+1,e.entry_date,e.type,e.category,e.account_type||'Cash A/c',e.payment_mode,e.voucher_head||'-',e.note||'-',e.added_by||e.edited_by||'admin',e.receipt_url?'Yes':'No',e.status||'Confirmed',e.type==='Income'?Number(e.amount):-Number(e.amount)])
      })
      const lastDataRowIdx=wsData.length-1
      wsData.push(['','','','','','','','','','','NET TOTAL',totalsData.net])
      wsData.push([])
      wsData.push([])
      wsData.push(['Prepared By:','','','','','','Authorized Signature:'])
      wsData.push(['______________________','','','','','','______________________'])
      wsData.push([`Date: ${getToday()}`,'','','','','',`Date: ${getToday()}`])

      const ws=XLSX.utils.aoa_to_sheet(wsData)
      ws['!cols']=[{wch:6},{wch:12},{wch:10},{wch:16},{wch:14},{wch:10},{wch:20},{wch:30},{wch:14},{wch:10},{wch:12},{wch:14}]
      ws['!merges']=headerLines.map((_,r)=>({s:{r,c:0},e:{r,c:11}}))
      // freeze the header rows so the ledger scrolls under a fixed title/column-header
      // (freeze panes + cell styling below require the SheetJS Pro build;
      // on the free/community build these properties are simply ignored,
      // so the file still opens correctly either way)
      ws['!freeze']={xSplit:0,ySplit:headRowIdx+1}
      ws['!sheetView']=[{state:'frozen',ySplit:headRowIdx+1}]
      // number-format the amount column and summary figures as Rupee currency
      const currencyFmt='₹#,##0.00;[RED]-₹#,##0.00'
      for(let r=firstDataRowIdx;r<=lastDataRowIdx;r++){
        const cell=ws[XLSX.utils.encode_cell({r,c:11})]
        if(cell)cell.z=currencyFmt
      }
      ;[1,4,7].forEach(c=>{
        const cell=ws[XLSX.utils.encode_cell({r:summaryRowIdx,c})]
        if(cell)cell.z=currencyFmt
      })
      // bold the header row + summary labels (cell styling requires the
      // SheetJS Pro build; safely ignored on the free/community build)
      for(let c=0;c<=11;c++){
        const cell=ws[XLSX.utils.encode_cell({r:headRowIdx,c})]
        if(cell)cell.s={font:{bold:true,color:{rgb:'FFFFFF'}},fill:{fgColor:{rgb:'1E3A5F'}}}
      }

      const wb=XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb,ws,'Report')

      // ── Chart Data sheet — a tidy category/amount table laid out so the
      // user can select it and hit Insert → Chart in Excel for a one-click
      // bar chart. SheetJS (free) can't embed a chart object directly, so
      // this hands the person a ready-made range instead of raw ledger rows.
      if(byCategoryData && byCategoryData.length){
        const chartRows=[['Category','Type','Amount']]
        byCategoryData.forEach(c=>chartRows.push([c.category,c.type,c.type==='Income'?c.total:-c.total]))
        chartRows.push(['Total Income','',totalsData.income])
        chartRows.push(['Total Expense','',-totalsData.expense])
        const chartWs=XLSX.utils.aoa_to_sheet(chartRows)
        chartWs['!cols']=[{wch:22},{wch:10},{wch:14}]
        for(let r=1;r<chartRows.length;r++){
          const cell=chartWs[XLSX.utils.encode_cell({r,c:2})]
          if(cell)cell.z=currencyFmt
        }
        for(let c=0;c<=2;c++){
          const cell=chartWs[XLSX.utils.encode_cell({r:0,c})]
          if(cell)cell.s={font:{bold:true,color:{rgb:'FFFFFF'}},fill:{fgColor:{rgb:'1E3A5F'}}}
        }
        XLSX.utils.book_append_sheet(wb,chartWs,'Chart Data')
      }

      XLSX.writeFile(wb,`GNSI-${titleData.replace(/\s+/g,'-')}-${getToday()}.xlsx`)
      logReportExport('Excel',{logLabel:opts.logLabel,dateFrom:opts.dateFrom,dateTo:opts.dateTo,rowCount:entriesData.length})
    }catch(err){
      console.error(err)
      alert('Excel generation failed: '+err.message+'\n\nMake sure the "xlsx" package is installed:\nnpm install xlsx')
    }
    setBusy('')
  }

  // PHASE 1 FIX: AI insights routed through /api/ai-insights serverless function
  const getInsights=async()=>{
    setLoadingAI(true);setInsights('')
    const summary={totalIncome,totalExpense,netBalance:totalIncome-totalExpense,pendingCount,
      topExpenseCategories:categoryData.filter(c=>c.type==='Expense').slice(0,3),
      monthlyTrend:monthlyData.slice(-3),
      budgetAlerts:Object.entries(budgets).filter(([cat,limit])=>limit>0&&(monthlyExpenses[cat]||0)>limit).map(([cat])=>cat),
    }
    try{
      const res=await fetch('/api/ai-insights',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({summary})})
      const data=await res.json()
      setInsights(data.content?.[0]?.text||'No insights available.')
    }catch{setInsights('Failed to load AI insights.')}
    setLoadingAI(false)
  }

  const toggleSort=(field)=>{if(sortField===field)setSortDir(d=>d==='asc'?'desc':'asc');else{setSortField(field);setSortDir('asc')};setPage(1)}
  const sortArrow=(field)=>sortField===field?(sortDir==='asc'?' ▲':' ▼'):''

  // ── memos ─────────────────────────────────────────────────────────────
  const filteredEntries=useMemo(()=>{
    let list=entries.filter(item=>{
      if(typeFilter!=='All'&&item.type!==typeFilter)return false
      if(modeFilter!=='All'&&item.payment_mode!==modeFilter)return false
      if(statusFilter!=='All'&&(item.status||'Confirmed')!==statusFilter)return false
      if(acctFilter!=='All'&&(item.account_type||'Cash A/c')!==acctFilter)return false
      if(dateFrom&&item.entry_date<dateFrom)return false
      if(dateTo&&item.entry_date>dateTo)return false
      const q=search.toLowerCase()
      return(item.category||'').toLowerCase().includes(q)||(item.payment_mode||'').toLowerCase().includes(q)||(item.note||'').toLowerCase().includes(q)||(item.type||'').toLowerCase().includes(q)||(item.voucher_head||'').toLowerCase().includes(q)
    })
    return[...list].sort((a,b)=>{let av=a[sortField],bv=b[sortField];if(sortField==='amount'){av=Number(av);bv=Number(bv)};if(av<bv)return sortDir==='asc'?-1:1;if(av>bv)return sortDir==='asc'?1:-1;return 0})
  },[entries,search,typeFilter,modeFilter,statusFilter,acctFilter,dateFrom,dateTo,sortField,sortDir])

  // ── Report Generator memos ───────────────────────────────────────────────
  const rptCategoryOptions = useMemo(()=>{
    if(rptType==='Income')return INCOME_CATEGORIES
    if(rptType==='Expense')return expenseCategoryOptions
    return [...new Set([...INCOME_CATEGORIES,...expenseCategoryOptions])]
  },[rptType,expenseCategoryOptions])

  const reportEntries = useMemo(()=>{
    const list = entries.filter(item=>{
      if(!isConfirmed(item))return false
      if(rptType!=='All'&&item.type!==rptType)return false
      if(rptCategory!=='All'&&item.category!==rptCategory)return false
      if(rptMode!=='All'&&item.payment_mode!==rptMode)return false
      if(rptAccount!=='All'&&(item.account_type||'Cash A/c')!==rptAccount)return false
      if(rptStatus!=='All'&&(item.status||'Confirmed')!==rptStatus)return false
      if(rptVoucherHead&&!(item.voucher_head||'').toLowerCase().includes(rptVoucherHead.toLowerCase()))return false
      if(rptDateFrom&&item.entry_date<rptDateFrom)return false
      if(rptDateTo&&item.entry_date>rptDateTo)return false
      const q=rptSearch.toLowerCase()
      if(!q)return true
      return(item.category||'').toLowerCase().includes(q)||(item.note||'').toLowerCase().includes(q)||(item.voucher_head||'').toLowerCase().includes(q)
    })
    return [...list].sort((a,b)=>a.entry_date<b.entry_date?-1:a.entry_date>b.entry_date?1:0)
  },[entries,rptType,rptCategory,rptMode,rptAccount,rptStatus,rptVoucherHead,rptSearch,rptDateFrom,rptDateTo])

  const reportTotals = useMemo(()=>{
    const income  = reportEntries.filter(e=>e.type==='Income').reduce((s,e)=>s+Number(e.amount),0)
    const expense = reportEntries.filter(e=>e.type==='Expense').reduce((s,e)=>s+Number(e.amount),0)
    return { income, expense, net: income-expense, count: reportEntries.length }
  },[reportEntries])

  // ── Date-wise breakdown of reportEntries — income/expense/net per day, for the
  // clickable "Date-wise" preview mode. Groups whatever reportEntries already
  // has (same filters/date-range as the flat list), so it always matches.
  const reportByDate = useMemo(()=>{
    const map = {}
    for(const e of reportEntries){
      const d = e.entry_date
      if(!map[d]) map[d] = { date:d, income:0, expense:0, entries:[] }
      if(e.type==='Income') map[d].income += Number(e.amount)
      else if(e.type==='Expense') map[d].expense += Number(e.amount)
      map[d].entries.push(e)
    }
    return Object.values(map).sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:0) // newest first
  },[reportEntries])

  const reportByCategory = useMemo(()=>{
    const map={}
    reportEntries.forEach(e=>{
      const k=e.category||'Other'
      if(!map[k])map[k]={category:k,type:e.type,total:0,count:0}
      map[k].total+=Number(e.amount);map[k].count+=1
    })
    return Object.values(map).sort((a,b)=>b.total-a.total)
  },[reportEntries])

  // ── "All Entries" export — used by the Transactions / Daily / Expenditure
  // modules' Export buttons. Deliberately ignores every on-screen filter
  // (search, date range, type, etc.) and reuses the same PDF/DOCX/Excel
  // generators as the main Reports tab, just fed the complete entries list.
  const allEntriesTotals = useMemo(()=>{
    const income  = entries.filter(e=>isConfirmed(e)&&e.type==='Income').reduce((s,e)=>s+Number(e.amount),0)
    const expense = entries.filter(e=>isConfirmed(e)&&e.type==='Expense').reduce((s,e)=>s+Number(e.amount),0)
    return { income, expense, net: income-expense, count: entries.filter(isConfirmed).length }
  },[entries])

  const allEntriesByCategory = useMemo(()=>{
    const map={}
    entries.filter(isConfirmed).forEach(e=>{
      const k=e.category||'Other'
      if(!map[k])map[k]={category:k,type:e.type,total:0,count:0}
      map[k].total+=Number(e.amount);map[k].count+=1
    })
    return Object.values(map).sort((a,b)=>b.total-a.total)
  },[entries])

  const sortedAllEntries = useMemo(
    ()=>entries.filter(isConfirmed).sort((a,b)=>a.entry_date<b.entry_date?-1:a.entry_date>b.entry_date?1:0),
    [entries]
  )

  const exportAllEntriesReport = (format, moduleLabel='All Entries')=>{
    const opts={
      entries:sortedAllEntries,
      totals:allEntriesTotals,
      byCategory:allEntriesByCategory,
      title:`Transaction Statement — ${moduleLabel}`,
      filterSummary:'All entries · no filters applied',
      setBusy:setGeneratingReport,
      logLabel:`Report (${format.toUpperCase()}): All Entries / ${moduleLabel}`,
    }
    if(format==='pdf')generateReportPDF(opts)
    else if(format==='docx')generateReportDOCX(opts)
    else generateReportExcel(opts)
  }

  const reportByAccount = useMemo(()=>{
    const map={}
    reportEntries.forEach(e=>{
      const k=e.account_type||'Cash A/c'
      if(!map[k])map[k]={account:k,income:0,expense:0}
      if(e.type==='Income')map[k].income+=Number(e.amount);else map[k].expense+=Number(e.amount)
    })
    return Object.values(map)
  },[reportEntries])

  // ── Weekly Income & Expenditure Report (for Admin's PA) ──────────────────
  // Independent of the manual Reports-tab filters above — always "last 7 days
  // including today", all types/categories/accounts. One-click PDF/DOCX/Excel
  // using the same letterheaded generator functions.
  const weeklyRange = useMemo(()=>{
    const to=new Date(today)
    const from=new Date(to);from.setDate(to.getDate()-6) // last 7 days inclusive
    const pad=(n)=>String(n).padStart(2,'0')
    const fmtDate=(d)=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
    return {from:fmtDate(from),to:fmtDate(to)}
  },[today])

  const weeklyEntries = useMemo(()=>{
    return entries
      .filter(e=>isConfirmed(e)&&e.entry_date>=weeklyRange.from&&e.entry_date<=weeklyRange.to)
      .sort((a,b)=>a.entry_date<b.entry_date?-1:a.entry_date>b.entry_date?1:0)
  },[entries,weeklyRange])

  const weeklyTotals = useMemo(()=>{
    const income  = weeklyEntries.filter(e=>e.type==='Income').reduce((s,e)=>s+Number(e.amount),0)
    const expense = weeklyEntries.filter(e=>e.type==='Expense').reduce((s,e)=>s+Number(e.amount),0)
    return { income, expense, net: income-expense, count: weeklyEntries.length }
  },[weeklyEntries])

  const weeklyByCategory = useMemo(()=>{
    const map={}
    weeklyEntries.forEach(e=>{
      const k=e.category||'Other'
      if(!map[k])map[k]={category:k,type:e.type,total:0,count:0}
      map[k].total+=Number(e.amount);map[k].count+=1
    })
    return Object.values(map).sort((a,b)=>b.total-a.total)
  },[weeklyEntries])

  const weeklyFilterSummary = `Weekly Report for Admin's PA — ${weeklyRange.from} to ${weeklyRange.to} (all types, categories, accounts)`

  const generateWeeklyReport=(format)=>{
    const opts={
      entries:weeklyEntries,totals:weeklyTotals,byCategory:weeklyByCategory,
      title:'Weekly Income & Expenditure Report',filterSummary:weeklyFilterSummary,
      logLabel:`Report (${format}): Weekly Income & Expenditure Report (${weeklyRange.from} to ${weeklyRange.to})`,
      dateFrom:weeklyRange.from,dateTo:weeklyRange.to,
    }
    if(format==='PDF')generateReportPDF(opts)
    else if(format==='DOCX')generateReportDOCX(opts)
    else generateReportExcel(opts)
  }

  // ── Weekly Report — direct browser print (separate from PDF/DOCX/Excel
  // export above). Same window.open + write + print pattern already used by
  // printDailyRegister/printExpenditureRegister/printPL, so it matches their
  // look, opens instantly, and needs no library — just the browser's own
  // print dialog. Grouped by day like the other print views, with a
  // grand total and a by-category breakdown since a 7-day report is short
  // enough that both fit on one printed page.
  const printWeeklyReport=()=>{
    const groups=groupByDate(weeklyEntries)
    const w=window.open('','_blank');if(!w)return
    let rowNum=0
    w.document.write(`<html><head><title>Weekly Report — GNSI Portal</title><style>
      body{font-family:Arial,sans-serif;padding:24px;font-size:12px;color:#1a2535}
      h1{font-size:18px;margin-bottom:4px}p{color:#666;margin:0 0 16px}
      table{width:100%;border-collapse:collapse;margin-bottom:20px}
      th{background:#831843;color:#fff;padding:7px 10px;text-align:left;font-size:11px}
      td{padding:7px 10px;border-bottom:1px solid #eee}
      .day-header{background:#fdf2f8;font-weight:bold;padding:6px 10px}
      .subtotal{background:#fdf7fa;font-weight:bold}
      .grand{background:#831843;color:#fff;font-weight:bold}
      .type-income{color:#16a34a;font-weight:600}
      .type-expense{color:#dc2626;font-weight:600}
      .amt{text-align:right;font-weight:600}
      .total-amt{text-align:right;font-weight:bold}
      .summary{display:flex;gap:14px;margin-bottom:18px}
      .card{flex:1;border-radius:8px;padding:10px 14px}
      .card.income{background:#dcfce7;border-left:3px solid #16a34a}
      .card.expense{background:#fee2e2;border-left:3px solid #dc2626}
      .card.net{background:#eff6ff;border-left:3px solid #1e3a5f}
      .card p{margin:0}.card .lbl{font-size:11px;color:#475569;font-weight:600}.card .val{font-size:16px;font-weight:800;color:#0f172a}
      @page{margin:15mm}
    </style></head><body>
    <h1>🗓️ Weekly Income &amp; Expenditure Report — GNSI Portal</h1>
    <p>${weeklyFilterSummary} &nbsp;|&nbsp; Generated: ${new Date().toLocaleString('en-IN')}</p>
    <div class="summary">
      <div class="card income"><p class="lbl">Income (7 days)</p><p class="val">${fmt(weeklyTotals.income)}</p></div>
      <div class="card expense"><p class="lbl">Expense (7 days)</p><p class="val">${fmt(weeklyTotals.expense)}</p></div>
      <div class="card net"><p class="lbl">Net</p><p class="val">${fmt(weeklyTotals.net)}</p></div>
    </div>
    <table><tr><th>#</th><th>Date</th><th>Type</th><th>Category</th><th>Account</th><th>Description</th><th>Pay Mode</th><th style="text-align:right">Amount</th></tr>
    ${groups.map(([date,rows])=>{
      const dayTotal=rows.reduce((s,e)=>s+Number(e.amount),0)
      const dayRows=rows.map(e=>{rowNum++;return`<tr><td>${rowNum}</td><td style="font-size:11px;color:#888">${date}</td><td class="${e.type==='Income'?'type-income':'type-expense'}">${e.type}</td><td>${e.category||'—'}</td><td>${e.account_type||'Cash A/c'}</td><td>${(e.note||'').replace(/</g,'&lt;')}</td><td>${e.payment_mode}</td><td class="amt">${fmt(e.amount)}</td></tr>`}).join('')
      return`<tr><td colspan="7" class="day-header">${date} — ${weekdayOf(date)} (${rows.length} entries)</td></tr>${dayRows}<tr class="subtotal"><td colspan="7">Daily Total</td><td class="total-amt">${fmt(dayTotal)}</td></tr>`
    }).join('')}
    <tr class="grand"><td colspan="7">GRAND TOTAL (7 days)</td><td class="total-amt">${fmt(weeklyTotals.net)}</td></tr>
    </table>
    <h1 style="font-size:14px">By Category</h1>
    <table><tr><th>Category</th><th>Type</th><th>Entries</th><th style="text-align:right">Total</th></tr>
    ${weeklyByCategory.map(c=>`<tr><td>${c.category}</td><td class="${c.type==='Income'?'type-income':'type-expense'}">${c.type}</td><td>${c.count}</td><td class="amt">${fmt(c.total)}</td></tr>`).join('')}
    </table></body></html>`)
    w.document.close();w.print()
  }

  // ── Accounts v3: one-click Monthly Report — pick any past month ─────────
  // Same idea as the Weekly Report above (always all types/categories/
  // accounts, no filter fiddling) but for a chosen 'YYYY-MM' month instead
  // of a fixed last-7-days window, so admin can pull last month's (or any
  // earlier month's) summary in one click without manually setting the
  // Reports tab's date range each time.
  const monthlyRptEntries = useMemo(()=>{
    return entries
      .filter(e=>isConfirmed(e)&&monthKey(e.entry_date)===monthlyRptMonth)
      .sort((a,b)=>a.entry_date<b.entry_date?-1:a.entry_date>b.entry_date?1:0)
  },[entries,monthlyRptMonth])

  const monthlyRptTotals = useMemo(()=>{
    const income  = monthlyRptEntries.filter(e=>e.type==='Income').reduce((s,e)=>s+Number(e.amount),0)
    const expense = monthlyRptEntries.filter(e=>e.type==='Expense').reduce((s,e)=>s+Number(e.amount),0)
    return { income, expense, net: income-expense, count: monthlyRptEntries.length }
  },[monthlyRptEntries])

  const monthlyRptByCategory = useMemo(()=>{
    const map={}
    monthlyRptEntries.forEach(e=>{
      const k=e.category||'Other'
      if(!map[k])map[k]={category:k,type:e.type,total:0,count:0}
      map[k].total+=Number(e.amount);map[k].count+=1
    })
    return Object.values(map).sort((a,b)=>b.total-a.total)
  },[monthlyRptEntries])

  const monthlyRptLabel = useMemo(()=>new Date(monthlyRptMonth+'-01').toLocaleDateString('en-IN',{month:'long',year:'numeric'}),[monthlyRptMonth])
  const monthlyRptFilterSummary = useMemo(()=>`Monthly Report — ${monthlyRptLabel} (all types, categories, accounts)`,[monthlyRptLabel])

  const generateMonthlyReport=(format)=>{
    const opts={
      entries:monthlyRptEntries,totals:monthlyRptTotals,byCategory:monthlyRptByCategory,
      title:`Monthly Report — ${monthlyRptLabel}`,filterSummary:monthlyRptFilterSummary,
      logLabel:`Report (${format}): Monthly Report (${monthlyRptLabel})`,
      dateFrom:`${monthlyRptMonth}-01`,dateTo:monthlyRptMonth,
    }
    if(format==='PDF')generateReportPDF(opts)
    else if(format==='DOCX')generateReportDOCX(opts)
    else generateReportExcel(opts)
  }

  const reportFilterSummary = useMemo(()=>{
    const parts=[`Type: ${rptType}`]
    if(rptCategory!=='All')parts.push(`Category: ${rptCategory}`)
    if(rptMode!=='All')parts.push(`Mode: ${rptMode}`)
    if(rptAccount!=='All')parts.push(`Account: ${rptAccount}`)
    if(rptStatus!=='All')parts.push(`Status: ${rptStatus}`)
    if(rptVoucherHead)parts.push(`Voucher Head: "${rptVoucherHead}"`)
    if(rptSearch)parts.push(`Search: "${rptSearch}"`)
    parts.push(`Period: ${rptDateFrom||'Beginning'} to ${rptDateTo||'Present'}`)
    return parts.join('   •   ')
  },[rptType,rptCategory,rptMode,rptAccount,rptStatus,rptVoucherHead,rptSearch,rptDateFrom,rptDateTo])

  // ── dedicated Daily Expenditure tab: filtered dataset, totals, category break-up ──
  // Always type==='Expense' — a separate table from the combined Daily register above,
  // and feeds its own one-click PDF/DOCX/Excel report generation (side by side with the
  // generic multi-type Reports tab, not a replacement for it).
  // BUGFIX: excludes Pending entries — see dailyFilteredEntries fix above
  // for the same reasoning; this register's totals, category breakdown,
  // cash/bank split, and print/CSV export were all silently including
  // uncleared expenses as if they'd already been paid.
  const expenditureFilteredEntries = useMemo(()=>{
    const list = entries.filter(item=>{
      if(item.type!=='Expense')return false
      if((item.status||'Confirmed')!=='Confirmed')return false
      if(expCategory!=='All'&&item.category!==expCategory)return false
      if(expSubCategory!=='All'&&(item.sub_category||'')!==expSubCategory)return false
      if(expVendorFilter!=='All'&&(item.vendor_id||'')!==expVendorFilter)return false
      if(expAcctFilter!=='All'&&(item.account_type||'Cash A/c')!==expAcctFilter)return false
      if(expModeFilter!=='All'&&item.payment_mode!==expModeFilter)return false
      if(expDateFrom&&item.entry_date<expDateFrom)return false
      if(expDateTo&&item.entry_date>expDateTo)return false
      const q=expSearch.toLowerCase()
      if(!q)return true
      return(item.category||'').toLowerCase().includes(q)||(item.sub_category||'').toLowerCase().includes(q)||(item.note||'').toLowerCase().includes(q)||(item.voucher_head||'').toLowerCase().includes(q)
    })
    return [...list].sort((a,b)=>a.entry_date<b.entry_date?-1:a.entry_date>b.entry_date?1:0)
  },[entries,expCategory,expSubCategory,expVendorFilter,expAcctFilter,expModeFilter,expDateFrom,expDateTo,expSearch])

  const expenditureGroups = useMemo(()=>groupByDate(expenditureFilteredEntries),[expenditureFilteredEntries])

  const expenditureTotals = useMemo(()=>{
    const expense = expenditureFilteredEntries.reduce((s,e)=>s+Number(e.amount),0)
    return { income:0, expense, net:-expense, count: expenditureFilteredEntries.length }
  },[expenditureFilteredEntries])

  const expenditureByCategory = useMemo(()=>{
    const map={}
    expenditureFilteredEntries.forEach(e=>{
      const k=e.category||'Other'
      if(!map[k])map[k]={category:k,type:'Expense',total:0,count:0}
      map[k].total+=Number(e.amount);map[k].count+=1
    })
    return Object.values(map).sort((a,b)=>b.total-a.total)
  },[expenditureFilteredEntries])

  const expenditureCashAmt = useMemo(()=>expenditureFilteredEntries.filter(e=>e.payment_mode==='Cash').reduce((s,e)=>s+Number(e.amount),0),[expenditureFilteredEntries])
  const expenditureBankAmt = useMemo(()=>expenditureFilteredEntries.filter(e=>e.payment_mode==='Bank').reduce((s,e)=>s+Number(e.amount),0),[expenditureFilteredEntries])

  const expenditureFilterSummary = useMemo(()=>{
    const parts=['Type: Expense']
    if(expCategory!=='All')parts.push(`Category: ${expCategory}`)
    if(expSubCategory!=='All')parts.push(`Sub-category: ${expSubCategory}`)
    if(expVendorFilter!=='All')parts.push(`Vendor: ${vendors.find(v=>v.id===expVendorFilter)?.name||expVendorFilter}`)
    if(expModeFilter!=='All')parts.push(`Mode: ${expModeFilter}`)
    if(expAcctFilter!=='All')parts.push(`Account: ${expAcctFilter}`)
    if(expSearch)parts.push(`Search: "${expSearch}"`)
    parts.push(`Period: ${expDateFrom||'Beginning'} to ${expDateTo||'Present'}`)
    return parts.join('   •   ')
  },[expCategory,expSubCategory,expVendorFilter,vendors,expModeFilter,expAcctFilter,expSearch,expDateFrom,expDateTo])

  // ── Expenditure v2: per-vendor spend history — powers the vendor
  // drilldown panel and lets admin see which outside parties are getting
  // paid the most, over time, regardless of the current table filters
  // (uses ALL confirmed expense entries, not expenditureFilteredEntries).
  const vendorSpendSummary = useMemo(()=>{
    const map={}
    entries.filter(e=>e.type==='Expense'&&isConfirmed(e)&&e.vendor_id).forEach(e=>{
      if(!map[e.vendor_id])map[e.vendor_id]={vendor_id:e.vendor_id,total:0,count:0,lastDate:null,entries:[]}
      map[e.vendor_id].total+=Number(e.amount);map[e.vendor_id].count+=1
      if(!map[e.vendor_id].lastDate||e.entry_date>map[e.vendor_id].lastDate)map[e.vendor_id].lastDate=e.entry_date
      map[e.vendor_id].entries.push(e)
    })
    return Object.values(map).map(v=>({
      ...v,
      vendorName:vendors.find(x=>x.id===v.vendor_id)?.name||'Unknown vendor',
      entries:v.entries.sort((a,b)=>b.entry_date<a.entry_date?-1:b.entry_date>a.entry_date?1:0),
    })).sort((a,b)=>b.total-a.total)
  },[entries,vendors])

  // ── Accounts v3: per-payer income summary (mirrors vendorSpendSummary) ──
  const payerSpendSummary = useMemo(()=>{
    const map={}
    entries.filter(e=>e.type==='Income'&&isConfirmed(e)&&e.payer_id).forEach(e=>{
      if(!map[e.payer_id])map[e.payer_id]={payer_id:e.payer_id,total:0,count:0,lastDate:null,entries:[]}
      map[e.payer_id].total+=Number(e.amount);map[e.payer_id].count+=1
      if(!map[e.payer_id].lastDate||e.entry_date>map[e.payer_id].lastDate)map[e.payer_id].lastDate=e.entry_date
      map[e.payer_id].entries.push(e)
    })
    return Object.values(map).map(p=>({
      ...p,
      payerName:payers.find(x=>x.id===p.payer_id)?.name||'Unknown payer',
      entries:p.entries.sort((a,b)=>b.entry_date<a.entry_date?-1:b.entry_date>a.entry_date?1:0),
    })).sort((a,b)=>b.total-a.total)
  },[entries,payers])

  // ── Accounts v3: all-income category summary (mirrors
  // allExpenseCategorySummary) + collection target vs actual for this month ──
  const allIncomeCategorySummary = useMemo(()=>{
    const map={}
    entries.filter(e=>e.type==='Income'&&isConfirmed(e)).forEach(e=>{
      const cat=e.category||'Uncategorized'
      if(!map[cat])map[cat]={category:cat,total:0,count:0,lastDate:null}
      map[cat].total+=Number(e.amount);map[cat].count+=1
      if(!map[cat].lastDate||e.entry_date>map[cat].lastDate)map[cat].lastDate=e.entry_date
    })
    const thisMonthStr=today.slice(0,7)
    return Object.values(map).map(c=>{
      const monthTotal=entries.filter(e=>e.type==='Income'&&isConfirmed(e)&&(e.category||'Uncategorized')===c.category&&monthKey(e.entry_date)===thisMonthStr).reduce((s,e)=>s+Number(e.amount),0)
      const target=incTargets.find(t=>t.category===c.category)?.target_amount||0
      return {...c,monthTotal,target,pctOfTarget:target>0?(monthTotal/target)*100:null}
    }).sort((a,b)=>b.total-a.total)
  },[entries,today,incTargets])

  // ── dedicated Daily Expenditure tab: CSV export + print register ─────────
  const exportExpenditureCSV=()=>{
    const filtered=expenditureFilteredEntries
    const header=['Date','Category','Account','Mode','Voucher Head','Note','Amount']
    const rows_=filtered.map(e=>[e.entry_date,e.category,e.account_type||'Cash A/c',e.payment_mode,e.voucher_head||'',e.note||'',e.amount])
    const csv=[header,...rows_].map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob=new Blob([csv],{type:'text/csv'})
    const url=URL.createObjectURL(blob)
    const a=Object.assign(document.createElement('a'),{href:url,download:`daily-expenditure-${getToday()}.csv`})
    a.click();URL.revokeObjectURL(url)
  }

  const printExpenditureRegister=()=>{
    const filtered=expenditureFilteredEntries
    const groups=groupByDate(filtered)
    const totalAmt=filtered.reduce((s,e)=>s+Number(e.amount),0)
    const win=window.open('','_blank')
    win.document.write(`<html><head><title>Daily Expenditure Register</title><style>
      body{font-family:Arial,sans-serif;padding:24px;color:#1e293b}
      h1{font-size:16px;color:#1e3a5f;margin-bottom:2px}
      p{font-size:11px;color:#64748b;margin:2px 0}
      table{width:100%;border-collapse:collapse;margin-top:14px;font-size:11px}
      th{background:#1e3a5f;color:white;padding:6px 8px;text-align:left}
      td{padding:5px 8px;border-bottom:1px solid #f1f5f9}
      .day-header{background:#f0f9ff;font-weight:bold;color:#0369a1}
      .subtotal{background:#f8fafc;font-weight:bold}
      .amt{text-align:right;color:#c0392b;font-weight:600}
      .total-amt{text-align:right;font-weight:bold}
      .grand{background:#1e3a5f;color:white;font-weight:bold}
    </style></head><body>
    <h1>${INSTITUTE_INFO.name}</h1>
    <p>${INSTITUTE_INFO.tagline} · ${INSTITUTE_INFO.address}</p>
    <p><b>Daily Expenditure Register</b> — ${expenditureFilterSummary}</p>
    <p>Printed on: ${new Date().toLocaleString('en-IN')}</p>
    <table><tr><th>#</th><th>Sl</th><th>Account</th><th>Description</th><th>Pay Mode</th><th style="text-align:right">Amount (Dr.)</th></tr>
    ${Object.entries(groups).map(([date,rows])=>{
      let rowNum=0
      const dayTotal=rows.reduce((s,e)=>s+Number(e.amount),0)
      const dayRows=rows.map(e=>{rowNum++;return`<tr><td>${rowNum}</td><td style="color:#888;font-size:10px">${e.id||''}</td><td><b>${e.account_type||'Cash A/c'}</b></td><td>${(e.note||e.category||'').replace(/</g,'&lt;')}</td><td>${e.payment_mode}</td><td class="amt">${fmt(e.amount)}</td></tr>`}).join('')
      return`<tr><td colspan="6" class="day-header">${date} — ${weekdayOf(date)} (${rows.length} entries)</td></tr>${dayRows}<tr class="subtotal"><td colspan="5">Daily Total</td><td class="total-amt">${fmt(dayTotal)}</td></tr>`
    }).join('')}
    <tr class="grand"><td colspan="4">GRAND TOTAL</td><td>Cash: ${fmt(expenditureCashAmt)} | Bank: ${fmt(expenditureBankAmt)}</td><td class="total-amt">${fmt(totalAmt)}</td></tr>
    </table></body></html>`)
    win.document.close();win.focus();win.print()
  }

  // ACTUAL PAYMENT DATE FIX: resolves which date field the Daily register filters/groups by
  const getDailyDate = useCallback((e)=>{
    if(dailyTypeFilter==='Income'&&dailyDateMode==='payment')return e.payment_date||e.entry_date
    return e.entry_date
  },[dailyTypeFilter,dailyDateMode])

  // PAYMENT-DATE FILTER FIX: now driven by dailyTypeFilter (Income or Expense) instead of being hard-locked to Expense
  // BUGFIX: also excludes Pending entries — this register (and its print/CSV
  // exports) is a record of actual cash/bank movement for the day, so an
  // uncleared/Pending entry showing up here alongside Confirmed ones
  // overstated the day's real collection or expenditure.
  const dailyFilteredEntries=useMemo(()=>{
    return entries.filter(e=>{
      if(e.type!==dailyTypeFilter)return false
      if((e.status||'Confirmed')!=='Confirmed')return false
      if(dailyAcctFilter!=='All'&&(e.account_type||'Cash A/c')!==dailyAcctFilter)return false
      if(dailyModeFilter!=='All'&&e.payment_mode!==dailyModeFilter)return false
      if(voucherHead&&!(e.voucher_head||'').toLowerCase().includes(voucherHead.toLowerCase()))return false
      const d=getDailyDate(e)
      if(dateFrom&&d<dateFrom)return false
      if(dateTo&&d>dateTo)return false
      const q=dailySearch.toLowerCase()
      return!q||(e.note||'').toLowerCase().includes(q)||(e.category||'').toLowerCase().includes(q)
    }).sort((a,b)=>{const da=getDailyDate(a),db=getDailyDate(b);return da<db?-1:da>db?1:0})
  },[entries,dailySearch,dailyAcctFilter,dailyModeFilter,voucherHead,dateFrom,dateTo,dailyTypeFilter,getDailyDate])

  // PAYMENT-DATE FILTER FIX: derived label/color for the Daily register, used across header, table, CSV, print
  const dailyIsIncome  = dailyTypeFilter==='Income'
  const dailyAmtColor  = dailyIsIncome ? '#16a34a' : '#c0392b'
  const dailyLabelWord = dailyIsIncome ? 'Collection' : 'Expenditure'
  const dailyDrCr       = dailyIsIncome ? 'Cr.' : 'Dr.'

  // PHASE 2 FIX: running balance computed from ALL entries, not filtered subset
  // BUGFIX: excludes Pending — same reasoning as totalIncome/totalExpense
  // above; an uncleared entry hasn't actually moved money yet, so it
  // shouldn't shift a running account balance.
  const runningBalanceMap=useMemo(()=>{
    const sorted=[...entries].filter(e=>(e.status||'Confirmed')==='Confirmed').sort((a,b)=>a.entry_date<b.entry_date?-1:a.entry_date>b.entry_date?1:0)
    let balance=0;const map={}
    sorted.forEach(e=>{balance+=e.type==='Income'?Number(e.amount):-Number(e.amount);map[e.id]=balance})
    return map
  },[entries])

  const totalPages   = Math.max(1,Math.ceil(filteredEntries.length/pageSize))
  const pagedEntries = filteredEntries.slice((page-1)*pageSize,page*pageSize)

  // BUGFIX: this used to compare selected.size===pagedEntries.length to
  // decide "is the current page fully selected". That only checked the
  // COUNT, not which ids — e.g. select all 25 rows on page 1, then flip to
  // page 2 (also a full 25-row page with completely different ids): the
  // sizes still matched, so clicking "select all" here immediately CLEARED
  // the selection instead of selecting page 2, because it looked like page
  // 2 was already "fully selected" when none of its rows were. Now checks
  // that every row actually on the current page is present in `selected`.
  // (Moved here from just after toggleSelect() — it was declared ~1000
  // lines before pagedEntries existed, which threw "Cannot access
  // 'pagedEntries' before initialization" at runtime once the file grew
  // large enough for the production minifier's variable-name mangling to
  // surface it as the cryptic single-letter TDZ error.)
  const isPageFullySelected = pagedEntries.length>0 && pagedEntries.every(e=>selected.has(e.id))
  const toggleSelectAll=()=>isPageFullySelected?setSelected(new Set()):setSelected(new Set(pagedEntries.map(e=>e.id)))

  // BUGFIX (audit): these six lines still used the raw inline
  // `(e.status||'Confirmed')==='Confirmed'` check rather than the shared
  // isConfirmed() helper — harmless while the two were equivalent, but
  // isConfirmed() was just hardened to fail CLOSED for any unrecognized
  // status value (not just null/undefined/''), and these six lines would
  // have silently drifted back out of sync with that stricter rule if left
  // as their own copy. Routed through the one shared helper so this can't
  // happen again.
  const filteredIncome  = filteredEntries.filter(e=>isConfirmed(e)&&e.type==='Income').reduce((s,e)=>s+Number(e.amount),0)
  const filteredExpense = filteredEntries.filter(e=>isConfirmed(e)&&e.type==='Expense').reduce((s,e)=>s+Number(e.amount),0)
  const filteredNet     = filteredIncome-filteredExpense
  const pendingCount    = entries.filter(e=>e.status==='Pending').length
  // BUGFIX: these previously summed ALL entries regardless of status, while
  // filteredIncome/filteredExpense above (used the instant any filter is
  // applied) already excluded Pending — so the dashboard's Total
  // Income/Expense/Net cards would visibly change the moment a user typed
  // into search or picked a date range, purely because Pending entries
  // silently dropped out. Confirmed is the only status that represents
  // money that has actually moved, so these headline totals now match that
  // same "Confirmed only" rule everywhere, filtered or not.
  const totalIncome     = entries.filter(e=>isConfirmed(e)&&e.type==='Income').reduce((s,e)=>s+Number(e.amount),0)
  const totalExpense    = entries.filter(e=>isConfirmed(e)&&e.type==='Expense').reduce((s,e)=>s+Number(e.amount),0)
  const todayIncome     = entries.filter(e=>isConfirmed(e)&&e.type==='Income'&&e.entry_date===today).reduce((s,e)=>s+Number(e.amount),0)
  const todayExpense    = entries.filter(e=>isConfirmed(e)&&e.type==='Expense'&&e.entry_date===today).reduce((s,e)=>s+Number(e.amount),0)
  const todayNet        = todayIncome-todayExpense
  const todayCount      = entries.filter(e=>e.entry_date===today).length
  const isFiltered      = dateFrom||dateTo||typeFilter!=='All'||modeFilter!=='All'||statusFilter!=='All'||acctFilter!=='All'||search

  // BUGFIX (audit): surfaces any entry whose status is neither 'Confirmed',
  // 'Pending', nor empty/null (the only values the UI's own <select> can
  // ever write — see STATUS_OPTIONS). isConfirmed() now treats any such
  // value as NOT confirmed (fails closed) rather than silently counting it
  // as real money, which is the safe default for a total — but "safe
  // default" still means that entry is invisibly missing from every report
  // until someone notices. This surfaces it instead of leaving it silent:
  // a row can only get an unrecognized status via a direct DB edit, a
  // migration, or another tool touching this table, so seeing this banner
  // at all is itself a signal something outside this UI touched the data.
  const unrecognizedStatusEntries = useMemo(
    ()=>entries.filter(e=>e.status!=null&&e.status!==''&&!STATUS_OPTIONS.includes(e.status)),
    [entries]
  )

  const monthlyData=useMemo(()=>{
    const map={}
    entries.filter(e=>(e.status||'Confirmed')==='Confirmed').forEach(e=>{const m=monthKey(e.entry_date);if(!m)return;if(!map[m])map[m]={month:m,Income:0,Expense:0};map[m][e.type]+=Number(e.amount)})
    return Object.values(map).sort((a,b)=>a.month.localeCompare(b.month)).slice(-12)
  },[entries])

  const categoryData=useMemo(()=>{
    const map={}
    entries.filter(e=>(e.status||'Confirmed')==='Confirmed').forEach(e=>{if(!map[e.category])map[e.category]={name:e.category,value:0,type:e.type};map[e.category].value+=Number(e.amount)})
    return Object.values(map).sort((a,b)=>b.value-a.value).slice(0,8)
  },[entries])

  const modeData=useMemo(()=>{
    const map={}
    entries.filter(e=>(e.status||'Confirmed')==='Confirmed').forEach(e=>{if(!map[e.payment_mode])map[e.payment_mode]={name:e.payment_mode,value:0};map[e.payment_mode].value+=Number(e.amount)})
    return Object.values(map)
  },[entries])

  // ── Savings Tracker: daily/weekly income vs expense + category trends ────
  // Admin-only tab. Reuses groupByDate/monthKey — no new data sources, just
  // a different lens on the same entries: last 14 days, last 8 weeks, an
  // all-time running savings figure, and category-level week-over-week flags.
  const dailyTrend=useMemo(()=>{
    if(!isAdmin)return[]
    const map={}
    entries.filter(e=>(e.status||'Confirmed')==='Confirmed').forEach(e=>{
      const d=e.entry_date;if(!d)return
      if(!map[d])map[d]={date:d,Income:0,Expense:0}
      map[d][e.type]+=Number(e.amount)
    })
    return Object.values(map).sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0).slice(-14)
      .map(r=>({...r,Net:r.Income-r.Expense}))
  },[entries,isAdmin])

  const weekKey=(dateStr)=>{
    const d=new Date(dateStr)
    const day=(d.getDay()+6)%7 // Monday=0
    const monday=new Date(d);monday.setDate(d.getDate()-day)
    const pad=(n)=>String(n).padStart(2,'0')
    return `${monday.getFullYear()}-${pad(monday.getMonth()+1)}-${pad(monday.getDate())}`
  }

  const weeklyTrend=useMemo(()=>{
    if(!isAdmin)return[]
    const map={}
    entries.filter(e=>(e.status||'Confirmed')==='Confirmed').forEach(e=>{
      if(!e.entry_date)return
      const wk=weekKey(e.entry_date)
      if(!map[wk])map[wk]={week:wk,Income:0,Expense:0}
      map[wk][e.type]+=Number(e.amount)
    })
    return Object.values(map).sort((a,b)=>a.week<b.week?-1:a.week>b.week?1:0).slice(-8)
      .map(r=>({...r,Net:r.Income-r.Expense}))
  },[entries,isAdmin])

  const savingsTracker=useMemo(()=>{
    if(!isAdmin)return null
    // BUGFIX: excludes Pending — a savings rate calculated on money that
    // hasn't actually been received/paid yet isn't a real savings rate.
    const totalIncomeAll=entries.filter(e=>e.type==='Income'&&(e.status||'Confirmed')==='Confirmed').reduce((s,e)=>s+Number(e.amount),0)
    const totalExpenseAll=entries.filter(e=>e.type==='Expense'&&(e.status||'Confirmed')==='Confirmed').reduce((s,e)=>s+Number(e.amount),0)
    const netSavings=totalIncomeAll-totalExpenseAll
    const savingsRate=totalIncomeAll>0?(netSavings/totalIncomeAll)*100:0
    const thisWeek=weeklyTrend[weeklyTrend.length-1]||{Income:0,Expense:0,Net:0}
    const lastWeek=weeklyTrend[weeklyTrend.length-2]||{Income:0,Expense:0,Net:0}
    return{totalIncomeAll,totalExpenseAll,netSavings,savingsRate,thisWeek,lastWeek}
  },[entries,weeklyTrend,isAdmin])

  const categoryTrendFlags=useMemo(()=>{
    if(!isAdmin||weeklyTrend.length<2)return[]
    // Compare this week's per-category expense spend vs last week's, per category.
    const thisWk=weeklyTrend[weeklyTrend.length-1]?.week
    const lastWk=weeklyTrend[weeklyTrend.length-2]?.week
    if(!thisWk||!lastWk)return[]
    const sumByCatWeek=(wk)=>{
      const map={}
      entries.filter(e=>isConfirmed(e)&&e.type==='Expense'&&e.entry_date&&weekKey(e.entry_date)===wk)
        .forEach(e=>{map[e.category]=(map[e.category]||0)+Number(e.amount)})
      return map
    }
    const thisMap=sumByCatWeek(thisWk),lastMap=sumByCatWeek(lastWk)
    const cats=new Set([...Object.keys(thisMap),...Object.keys(lastMap)])
    return[...cats].map(cat=>{
      const cur=thisMap[cat]||0,prev=lastMap[cat]||0
      const change=prev>0?((cur-prev)/prev)*100:(cur>0?100:0)
      return{category:cat,current:cur,previous:prev,change}
    }).filter(r=>r.current>0||r.previous>0)
      .sort((a,b)=>b.change-a.change)
      .slice(0,6)
  },[entries,weeklyTrend,isAdmin])

  const plData=useMemo(()=>{
    // BUGFIX (audit): plStatus==='All' previously meant "every status,
    // including Pending" — so the P&L's default view (nobody has touched
    // this filter) counted uncleared money as real income/expense. The
    // admin can still explicitly select "Pending" here to review what's
    // uncleared, or "Confirmed" to match every other report in this file —
    // but the 'All' default now means "all CONFIRMED entries" rather than
    // literally all statuses, consistent with how 'All' behaves nowhere
    // else in this codebase actually meaning "including unconfirmed money".
    const passesAdv=(e)=>(plAccountType==='All'||e.account_type===plAccountType)&&(plPaymentMode==='All'||e.payment_mode===plPaymentMode)&&(plStatus==='All'?isConfirmed(e):e.status===plStatus)
    let thisM,prevM
    if(plRangeMode==='range'&&plDateFrom&&plDateTo){
      thisM=entries.filter(e=>e.entry_date>=plDateFrom&&e.entry_date<=plDateTo&&passesAdv(e))
      // previous period = equal-length window immediately preceding the selected range
      const from=new Date(plDateFrom+'T00:00:00'),to=new Date(plDateTo+'T00:00:00')
      const days=Math.round((to-from)/86400000)+1
      const prevTo=new Date(from);prevTo.setDate(prevTo.getDate()-1)
      const prevFrom=new Date(prevTo);prevFrom.setDate(prevFrom.getDate()-(days-1))
      const toKey=(d)=>d.toLocaleDateString('en-CA')
      prevM=entries.filter(e=>e.entry_date>=toKey(prevFrom)&&e.entry_date<=toKey(prevTo)&&passesAdv(e))
    }else{
      thisM=entries.filter(e=>e.entry_date.startsWith(plMonth)&&passesAdv(e))
      prevM=(()=>{const[y,m]=plMonth.split('-').map(Number);const d=new Date(y,m-2,1);const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;return entries.filter(e=>e.entry_date.startsWith(key)&&passesAdv(e))})()
    }
    const sumBy=(arr,type)=>{const map={};arr.filter(e=>e.type===type).forEach(e=>{map[e.category]=(map[e.category]||0)+Number(e.amount)});return map}
    const thisInc=sumBy(thisM,'Income'),thisExp=sumBy(thisM,'Expense'),prevInc=sumBy(prevM,'Income'),prevExp=sumBy(prevM,'Expense')
    return{thisInc,thisExp,prevInc,prevExp,totalThisInc:Object.values(thisInc).reduce((s,v)=>s+v,0),totalThisExp:Object.values(thisExp).reduce((s,v)=>s+v,0),totalPrevInc:Object.values(prevInc).reduce((s,v)=>s+v,0),totalPrevExp:Object.values(prevExp).reduce((s,v)=>s+v,0),thisMEntries:thisM}
  },[entries,plMonth,plRangeMode,plDateFrom,plDateTo,plAccountType,plPaymentMode,plStatus])

  // BUGFIX (audit): plManualIncome was never cleared when the P&L period
  // changed — type a manual cash-book figure while viewing September, flip
  // to August, and the Manual Ledger Reconciliation banner silently
  // compared the stale September number against August's system total,
  // with nothing on screen indicating the figure was stale. Resets to
  // empty on any change to which period is being viewed, so a leftover
  // manual figure can never be compared against the wrong month/range.
  useEffect(()=>{
    setPlManualIncome('')
  },[plMonth,plRangeMode,plDateFrom,plDateTo])

  // ── Date-wise breakdown for the P&L modal — one row per date with income
  // total and expense total (NOT combined into categories), for the exact
  // same period/filters plData already computed. Toggled via plShowDatewise.
  const plDatewise=useMemo(()=>{
    const map={}
    for(const e of plData.thisMEntries){
      const d=e.entry_date
      if(!map[d])map[d]={date:d,income:0,expense:0}
      if(e.type==='Income')map[d].income+=Number(e.amount)
      else if(e.type==='Expense')map[d].expense+=Number(e.amount)
    }
    return Object.values(map).sort((a,b)=>a.date<b.date?-1:1) // oldest first, matches from-date to-date reading order
  },[plData])

  // human-readable period label used in the P&L modal header and printout
  const plPeriodLabel=useMemo(()=>{
    if(plRangeMode==='range'&&plDateFrom&&plDateTo){
      const fmtD=(s)=>new Date(s+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})
      return `${fmtD(plDateFrom)} – ${fmtD(plDateTo)}`
    }
    return new Date(plMonth+'-01').toLocaleDateString('en-IN',{month:'long',year:'numeric'})
  },[plRangeMode,plDateFrom,plDateTo,plMonth])

  const thisMonth=today.slice(0,7)
  const monthlyExpenses=useMemo(()=>{
    const map={}
    entries.filter(e=>isConfirmed(e)&&e.type==='Expense'&&monthKey(e.entry_date)===thisMonth).forEach(e=>{map[e.category]=(map[e.category]||0)+Number(e.amount)})
    return map
  },[entries,thisMonth])

  // ── Accounts v3: cash flow & forecasting (admin only) ────────────────────
  // Three independent pieces, all derived from the same confirmed-entries
  // data plus the recurring_templates table — none of them ever write to
  // `accounts`, they only project/estimate:
  //   1. monthEndProjection — where the cash balance is headed by month end,
  //      given what's already confirmed this month plus what's still
  //      expected (recurring templates not yet logged this month).
  //   2. recurringForecast — which recurring templates are still
  //      outstanding this month (expected but no matching entry logged
  //      yet), so nothing gets forgotten.
  //   3. trendProjection — a simple next-month estimate for income and
  //      expense, based on the trailing 3-6 months' average.
  const recurringForecast = useMemo(()=>{
    if(!isAdmin||recurringTemplates.length===0)return[]
    const thisMonthEntries=entries.filter(e=>isConfirmed(e)&&monthKey(e.entry_date)===thisMonth)
    return recurringTemplates.map(t=>{
      // "Logged already" = any confirmed entry this month of the same
      // type+category whose amount is at least close to what's expected —
      // a template isn't linked 1:1 to a specific entry, so this is a
      // best-effort match rather than a hard foreign key.
      const matched=thisMonthEntries.filter(e=>e.type===t.type&&e.category===t.category)
      const loggedTotal=matched.reduce((s,e)=>s+Number(e.amount),0)
      const outstanding=Math.max(t.expected_amount-loggedTotal,0)
      return {...t,loggedTotal,outstanding,isLogged:loggedTotal>=t.expected_amount}
    }).sort((a,b)=>(a.day_of_month||99)-(b.day_of_month||99))
  },[isAdmin,recurringTemplates,entries,thisMonth])

  const monthEndProjection = useMemo(()=>{
    if(!isAdmin)return null
    const thisMonthEntries=entries.filter(e=>isConfirmed(e)&&monthKey(e.entry_date)===thisMonth)
    const incomeSoFar=thisMonthEntries.filter(e=>e.type==='Income').reduce((s,e)=>s+Number(e.amount),0)
    const expenseSoFar=thisMonthEntries.filter(e=>e.type==='Expense').reduce((s,e)=>s+Number(e.amount),0)
    const outstandingIncome=recurringForecast.filter(t=>t.type==='Income').reduce((s,t)=>s+t.outstanding,0)
    const outstandingExpense=recurringForecast.filter(t=>t.type==='Expense').reduce((s,t)=>s+t.outstanding,0)
    return {
      incomeSoFar,expenseSoFar,netSoFar:incomeSoFar-expenseSoFar,
      outstandingIncome,outstandingExpense,
      projectedIncome:incomeSoFar+outstandingIncome,
      projectedExpense:expenseSoFar+outstandingExpense,
      projectedNet:(incomeSoFar+outstandingIncome)-(expenseSoFar+outstandingExpense),
    }
  },[isAdmin,entries,thisMonth,recurringForecast])

  const trendProjection = useMemo(()=>{
    if(!isAdmin)return null
    // Trailing months, most recent first, EXCLUDING the current (still
    // in-progress) month — a partial current month would understate the
    // trend average.
    const [ty,tm]=thisMonth.split('-').map(Number)
    const trailing=[1,2,3,4,5,6].map(n=>{
      const d=new Date(ty,tm-1-n,1)
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    })
    const monthlyTotals=trailing.map(mk=>{
      const monthEntries=entries.filter(e=>isConfirmed(e)&&monthKey(e.entry_date)===mk)
      return {
        month:mk,
        income:monthEntries.filter(e=>e.type==='Income').reduce((s,e)=>s+Number(e.amount),0),
        expense:monthEntries.filter(e=>e.type==='Expense').reduce((s,e)=>s+Number(e.amount),0),
      }
    }).filter(m=>m.income>0||m.expense>0) // skip months with no data at all (e.g. before the portal was in use)
    if(monthlyTotals.length===0)return null
    const usedMonths=monthlyTotals.slice(0,Math.min(6,monthlyTotals.length))
    const avgIncome=usedMonths.reduce((s,m)=>s+m.income,0)/usedMonths.length
    const avgExpense=usedMonths.reduce((s,m)=>s+m.expense,0)/usedMonths.length
    const nextMonthDate=new Date(ty,tm,1) // JS Date month is 0-indexed, so tm (1-indexed "this month") lands on next month
    const nextMonthLabel=nextMonthDate.toLocaleDateString('en-IN',{month:'long',year:'numeric'})
    return {
      monthsUsed:usedMonths.length,avgIncome,avgExpense,avgNet:avgIncome-avgExpense,
      nextMonthLabel,projectedIncome:avgIncome,projectedExpense:avgExpense,projectedNet:avgIncome-avgExpense,
    }
  },[isAdmin,entries,thisMonth])

  // ── Accounts v3: reconciliation & closing (admin only) ───────────────────
  const reconSummaryByAccount = useMemo(()=>{
    if(!isAdmin)return[]
    return ACCOUNT_TYPES.map(acct=>{
      const acctEntries=entries.filter(e=>e.account_type===acct&&isConfirmed(e))
      const unreconciled=acctEntries.filter(e=>!e.reconciled)
      const unreconciledBalance=unreconciled.reduce((s,e)=>s+(e.type==='Income'?Number(e.amount):-Number(e.amount)),0)
      return {account_type:acct,totalCount:acctEntries.length,unreconciledCount:unreconciled.length,unreconciledBalance}
    })
  },[isAdmin,entries])

  // list of entries for the currently-selected reconciliation account/month,
  // newest first — powers the checklist in the Reconciliation tab
  const reconEntries = useMemo(()=>{
    if(!isAdmin)return[]
    return entries.filter(e=>e.account_type===reconAcctType&&isConfirmed(e)&&monthKey(e.entry_date)===thisMonth)
      .sort((a,b)=>b.entry_date<a.entry_date?-1:b.entry_date>a.entry_date?1:0)
  },[isAdmin,entries,reconAcctType,thisMonth])

  // Every account type × the last 12 months, each flagged locked/open, so
  // admin can close/reopen from one place rather than hunting for a month.
  const monthLockGrid = useMemo(()=>{
    if(!isAdmin)return[]
    const [ty,tm]=thisMonth.split('-').map(Number)
    const months=[0,1,2,3,4,5,6,7,8,9,10,11].map(n=>{
      const d=new Date(ty,tm-1-n,1)
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    })
    return ACCOUNT_TYPES.map(acct=>({
      account_type:acct,
      months:months.map(m=>({month:m,isLocked:monthLocks.some(l=>l.account_type===acct&&l.month===m)})),
    }))
  },[isAdmin,thisMonth,monthLocks])

  // Opening-balance carry-forward check: for every recorded month, does its
  // opening balance actually match the PRIOR recorded month's closing
  // balance? A mismatch means something changed history after that prior
  // month was closed (a backdated edit, a deleted/restored entry, etc.).
  const openingBalanceChecks = useMemo(()=>{
    if(!isAdmin)return[]
    const byAccount={}
    openingBalances.forEach(b=>{
      if(!byAccount[b.account_type])byAccount[b.account_type]=[]
      byAccount[b.account_type].push(b)
    })
    const results=[]
    Object.entries(byAccount).forEach(([acct,rows])=>{
      const sorted=[...rows].sort((a,b)=>a.month<b.month?-1:1)
      for(let i=1;i<sorted.length;i++){
        const prior=sorted[i-1],cur=sorted[i]
        const expectedOpening=prior.closing_balance
        const drift=Number(cur.opening_balance)-Number(expectedOpening)
        if(Math.abs(drift)>0.5){ // ignore sub-rupee floating point noise
          results.push({account_type:acct,month:cur.month,priorMonth:prior.month,expectedOpening,actualOpening:cur.opening_balance,drift})
        }
      }
    })
    return results
  },[isAdmin,openingBalances])

  // ── Expenditure v2: per-staff expenditure dashboard (admin only) ────────
  // Who is entering how much, how often, and in which categories — surfaces
  // a staff member who suddenly starts logging much more than usual.
  const perStaffExpenditure = useMemo(()=>{
    if(!isAdmin)return[]
    const map={}
    entries.filter(e=>e.type==='Expense'&&isConfirmed(e)).forEach(e=>{
      const k=e.added_by||e.edited_by||'Unknown'
      if(!map[k])map[k]={staff:k,total:0,count:0,byCategory:{},thisMonthTotal:0,lastMonthTotal:0}
      map[k].total+=Number(e.amount);map[k].count+=1
      map[k].byCategory[e.category||'Other']=(map[k].byCategory[e.category||'Other']||0)+Number(e.amount)
      const mk=monthKey(e.entry_date)
      if(mk===thisMonth)map[k].thisMonthTotal+=Number(e.amount)
    })
    // last full calendar month, for a simple month-over-month comparison per staff
    const [ty,tm]=thisMonth.split('-').map(Number)
    const lm=new Date(ty,tm-2,1),lastMonthKey=`${lm.getFullYear()}-${String(lm.getMonth()+1).padStart(2,'0')}`
    entries.filter(e=>e.type==='Expense'&&isConfirmed(e)&&monthKey(e.entry_date)===lastMonthKey).forEach(e=>{
      const k=e.added_by||e.edited_by||'Unknown'
      if(!map[k])map[k]={staff:k,total:0,count:0,byCategory:{},thisMonthTotal:0,lastMonthTotal:0}
      map[k].lastMonthTotal+=Number(e.amount)
    })
    return Object.values(map).map(s=>({
      ...s,
      topCategory:Object.entries(s.byCategory).sort((a,b)=>b[1]-a[1])[0]?.[0]||'—',
      momChange: s.lastMonthTotal>0 ? ((s.thisMonthTotal-s.lastMonthTotal)/s.lastMonthTotal)*100 : (s.thisMonthTotal>0?100:0),
    })).sort((a,b)=>b.total-a.total)
  },[entries,isAdmin,thisMonth])

  // ── Expenditure v2: spend-velocity alerts (admin only) ──────────────────
  // Beyond the existing fixed budget-limit alerts: flags a category OR
  // voucher head whose spend rate THIS week/month is unusually high
  // relative to its OWN trailing average — catches a sudden spike even in
  // a category with no budget limit set at all, or one whose limit is set
  // so high a spike wouldn't trip it.
  const spendVelocityAlerts = useMemo(()=>{
    if(!isAdmin)return[]
    const expenseEntries=entries.filter(e=>e.type==='Expense'&&isConfirmed(e)&&e.entry_date)
    const alerts=[]
    // by category: compare this month's spend to the trailing-3-month average of the PRIOR 3 months
    const byCatMonth={}
    expenseEntries.forEach(e=>{
      const mk=monthKey(e.entry_date),cat=e.category||'Other'
      if(!byCatMonth[cat])byCatMonth[cat]={}
      byCatMonth[cat][mk]=(byCatMonth[cat][mk]||0)+Number(e.amount)
    })
    const [ty2,tm2]=thisMonth.split('-').map(Number)
    const priorMonths=[1,2,3].map(n=>{const d=new Date(ty2,tm2-1-n,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`})
    Object.entries(byCatMonth).forEach(([cat,months])=>{
      const thisVal=months[thisMonth]||0
      const priorVals=priorMonths.map(m=>months[m]||0)
      const priorAvg=priorVals.reduce((s,v)=>s+v,0)/priorVals.length
      if(priorAvg>=500&&thisVal>priorAvg*2){ // needs a meaningful baseline to avoid noise on brand-new categories
        alerts.push({
          scope:'category',label:cat,current:thisVal,baseline:priorAvg,
          pctOver:((thisVal-priorAvg)/priorAvg)*100,
        })
      }
    })
    // by voucher head: same idea, using entry total this week vs trailing-4-week
    // average total, since a voucher head "spending 3x more than usual" is a
    // signal even in a category with no budget limit at all
    const byHeadWeek={}
    expenseEntries.forEach(e=>{
      const head=e.voucher_head||'Unassigned',wk=weekKey(e.entry_date)
      if(!byHeadWeek[head])byHeadWeek[head]={}
      if(!byHeadWeek[head][wk])byHeadWeek[head][wk]={total:0,count:0}
      byHeadWeek[head][wk].total+=Number(e.amount);byHeadWeek[head][wk].count+=1
    })
    const thisWk=weekKey(today)
    Object.entries(byHeadWeek).forEach(([head,weeks])=>{
      const weekKeys=Object.keys(weeks).filter(w=>w!==thisWk).sort().slice(-4)
      if(weekKeys.length<2)return // not enough history to call anything a spike
      const thisWeekTotal=weeks[thisWk]?.total||0
      const avgWeekTotal=weekKeys.reduce((s,w)=>s+weeks[w].total,0)/weekKeys.length
      if(avgWeekTotal>=300&&thisWeekTotal>avgWeekTotal*2){
        alerts.push({
          scope:'voucher_head',label:head,current:thisWeekTotal,baseline:avgWeekTotal,
          pctOver:((thisWeekTotal-avgWeekTotal)/avgWeekTotal)*100,
        })
      }
    })
    return alerts.sort((a,b)=>b.pctOver-a.pctOver)
  },[entries,isAdmin,thisMonth,today,weekKey])

  // ── Budget drilldown: "where it was spent" — this month's individual
  // expense entries, grouped by category, newest first. Powers the
  // expandable entry list under each budget category card.
  const monthlyExpensesByCategory=useMemo(()=>{
    const map={}
    entries
      .filter(e=>isConfirmed(e)&&e.type==='Expense'&&monthKey(e.entry_date)===thisMonth)
      .forEach(e=>{
        const k=e.category||'Other'
        if(!map[k])map[k]=[]
        map[k].push(e)
      })
    Object.keys(map).forEach(k=>map[k].sort((a,b)=>b.entry_date<a.entry_date?-1:b.entry_date>a.entry_date?1:0))
    return map
  },[entries,thisMonth])

  const budgetChartData=useMemo(()=>{
    const months=[]
    for(let i=5;i>=0;i--){const d=new Date();d.setMonth(d.getMonth()-i);months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)}
    return months.map(m=>{
      const row={month:m}
      EXPENSE_CATEGORIES.forEach(cat=>{row[cat]=entries.filter(e=>e.type==='Expense'&&e.category===cat&&monthKey(e.entry_date)===m).reduce((s,e)=>s+Number(e.amount),0);row[`${cat}_budget`]=Number(budgets[cat])||0})
      return row
    })
  },[entries,budgets])

  const fraudSummary=useMemo(()=>{
    if(!isAdmin)return{}
    const all=Object.values(fraudFlags).flat()
    return{
      high:all.filter(f=>f.severity==='high').length,
      medium:all.filter(f=>f.severity==='medium').length,
      flaggedEntries:entries.filter(e=>fraudFlags[e.id]?.length>0),
      freqAnomalies:detectFrequencyAnomalies(entries,today),
      phantoms:deletedRows.filter(e=>e.entry_date===today&&e.deleted_at?.startsWith(today)),
    }
  },[fraudFlags,entries,deletedRows,isAdmin,today])

  const totalFraudAlerts=isAdmin?(fraudSummary.high||0)+(fraudSummary.medium||0):0
  const pendingSuperintendentCount=isAdmin?superintendentFlags.filter(f=>!f.verified).length:0
  const superintendentFlaggedIds=useMemo(
    ()=>new Set(superintendentFlags.filter(f=>!f.verified).map(f=>f.entry_id)),
    [superintendentFlags]
  )

  // ── For Admin: daily/weekly digest ───────────────────────────────────────
  // Pulls together everything already computed elsewhere (fraud flags,
  // superintendent edits, budget overruns, pending status, recent deletes)
  // into one prioritized "what needs your attention" list. No new data
  // sources — just surfaces what's already tracked, in one glance.
  const overBudgetCategories=useMemo(()=>{
    if(!isAdmin)return[]
    return EXPENSE_CATEGORIES
      .map(cat=>{
        const limit=Number(budgets[cat])||0
        const spent=monthlyExpenses[cat]||0
        return{cat,limit,spent,pct:limit>0?(spent/limit)*100:0}
      })
      .filter(r=>r.limit>0&&r.spent>r.limit)
      .sort((a,b)=>b.pct-a.pct)
  },[budgets,monthlyExpenses,isAdmin])

  const recentDeletesToday=useMemo(()=>{
    if(!isAdmin)return[]
    return deletedRows.filter(e=>e.deleted_at?.startsWith(today))
  },[deletedRows,today,isAdmin])

  const digestItems=useMemo(()=>{
    if(!isAdmin)return[]
    const items=[]
    if(pendingApprovals.length>0)items.push({
      severity:'high',icon:'🔏',
      title:`${pendingApprovals.length} expenditure entr${pendingApprovals.length>1?'ies':'y'} awaiting your approval`,
      detail:'Flagged by amount threshold or submitter role — not yet counted in any total until approved.',
      tab:'approvals',
    })
    if(spendVelocityAlerts.length>0)items.push({
      severity:'medium',icon:'📈',
      title:`${spendVelocityAlerts.length} spend-velocity alert${spendVelocityAlerts.length>1?'s':''}`,
      detail:`${spendVelocityAlerts[0].label} is running ${Math.round(spendVelocityAlerts[0].pctOver)}% above its own recent average.`,
      tab:'expenditure',
    })
    if(pendingSuperintendentCount>0)items.push({
      severity:'high',icon:'🛡️',
      title:`${pendingSuperintendentCount} Superintendent edit${pendingSuperintendentCount>1?'s':''} awaiting verification`,
      detail:'Edits made under the edit-only Superintendent role need your review.',
      tab:'fraud',
    })
    if((fraudSummary.high||0)>0)items.push({
      severity:'high',icon:'🚨',
      title:`${fraudSummary.high} high-risk flagged transaction${fraudSummary.high>1?'s':''}`,
      detail:'Outside campus, device clash, or other high-severity fraud signals.',
      tab:'fraud',
    })
    if((fraudSummary.medium||0)>0)items.push({
      severity:'medium',icon:'⚠️',
      title:`${fraudSummary.medium} medium-risk flagged transaction${fraudSummary.medium>1?'s':''}`,
      detail:'Worth a second look when you have a moment.',
      tab:'fraud',
    })
    if(recentDeletesToday.length>0)items.push({
      severity:'medium',icon:'👻',
      title:`${recentDeletesToday.length} entr${recentDeletesToday.length>1?'ies':'y'} deleted today`,
      detail:'Confirm these were intentional — restorable from Fraud & Alerts.',
      tab:'fraud',
    })
    overBudgetCategories.forEach(r=>items.push({
      severity:r.pct>150?'high':'medium',icon:'💸',
      title:`${r.cat} is over budget — ${fmt(r.spent)} of ${fmt(r.limit)}`,
      detail:`${Math.round(r.pct)}% of this month's ${r.cat} budget used.`,
      tab:'budgets',
    }))
    if(pendingCount>0)items.push({
      severity:'low',icon:'⏳',
      title:`${pendingCount} entr${pendingCount>1?'ies':'y'} still marked Pending`,
      detail:'Uncleared transactions waiting on confirmation.',
      tab:'transactions',
    })
    // BUGFIX (audit): a status value outside 'Confirmed'/'Pending' can only
    // reach this table via a direct DB edit, a migration, or another tool
    // — never through this UI's own <select>, which only ever writes one
    // of those two. isConfirmed() now treats any such row as NOT confirmed
    // (excluded from every total, the safe default) rather than silently
    // counting it as real money — but "excluded from totals" is itself
    // invisible unless it's surfaced somewhere, so this alert is that
    // surface: high severity, since it means this table has data outside
    // what the UI believes is possible.
    if(unrecognizedStatusEntries.length>0)items.push({
      severity:'high',icon:'❗',
      title:`${unrecognizedStatusEntries.length} entr${unrecognizedStatusEntries.length>1?'ies have':'y has'} an unrecognized status`,
      detail:`Status values other than "Confirmed"/"Pending" found (e.g. id ${unrecognizedStatusEntries[0].id}: "${unrecognizedStatusEntries[0].status}"). These are excluded from every total until fixed — check for a direct database edit outside this app.`,
      tab:'transactions',
    })
    if(fraudSummary.freqAnomalies?.length>0)items.push({
      severity:'low',icon:'🔁',
      title:`${fraudSummary.freqAnomalies.length} repeated-entry pattern${fraudSummary.freqAnomalies.length>1?'s':''} this month`,
      detail:'Same category and amount logged more than twice — worth a glance.',
      tab:'fraud',
    })
    const order={high:0,medium:1,low:2}
    return items.sort((a,b)=>order[a.severity]-order[b.severity])
  },[isAdmin,pendingSuperintendentCount,fraudSummary,recentDeletesToday,overBudgetCategories,pendingCount,unrecognizedStatusEntries,fmt,pendingApprovals,spendVelocityAlerts])

  const dailyGroups=useMemo(()=>groupByDate(dailyFilteredEntries,getDailyDate),[dailyFilteredEntries,getDailyDate])
  const dailyTotalAmt=dailyFilteredEntries.reduce((s,e)=>s+Number(e.amount),0)
  const dailyCashAmt=dailyFilteredEntries.filter(e=>e.payment_mode==='Cash').reduce((s,e)=>s+Number(e.amount),0)
  const dailyBankAmt=dailyFilteredEntries.filter(e=>e.payment_mode==='Bank').reduce((s,e)=>s+Number(e.amount),0)

  // ── responsive style helpers ───────────────────────────────────────────
  const tabStyle=(t)=>({
    padding: isMobile ? '7px 12px' : '8px 18px',
    borderRadius:8, border:'none', cursor:'pointer', fontWeight:600,
    fontSize: isMobile ? 12 : 13,
    backgroundColor:activeTab===t?'#1e3a5f':'#f1f5f9',
    color:activeTab===t?'white':'#64748b', transition:'all .15s',
  })
  const qBtn=(key)=>({padding: isMobile ? '5px 10px' : '5px 12px',borderRadius:6,border:'none',cursor:'pointer',fontSize:isMobile?11:12,fontWeight:600,transition:'all .15s',backgroundColor:activeQuick===key?'#1e3a5f':'#f1f5f9',color:activeQuick===key?'white':'#64748b'})

  // ── responsive grid columns ────────────────────────────────────────────
  const statCardCols    = isMobile ? 'repeat(2,1fr)' : isTablet ? 'repeat(3,1fr)' : 'repeat(5,1fr)'
  const todayCols       = isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)'
  const formCols        = isMobile ? '1fr' : isTablet ? 'repeat(2,1fr)' : 'repeat(4,1fr)'
  const filterCols      = isMobile ? '1fr' : isTablet ? 'repeat(2,1fr)' : '2fr 1fr 1fr 1fr 1fr 1fr 1fr'
  const chartGridCols   = isMobile ? '1fr' : '1fr 1fr'
  const budgetGridCols  = isMobile ? '1fr' : 'repeat(2,1fr)'
  const fraudGridCols   = isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)'
  const dailySumCols    = isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)'
  const plModalCols     = isMobile ? '1fr' : 'repeat(3,1fr)'
  const plContentCols   = isMobile ? '1fr' : '1fr 1fr'

  // ══════════════════════════════════════════════════════════════════════
  return(
  <div style={{padding: isMobile ? 12 : 24, fontFamily:'inherit'}}>

    {/* ── header ── */}
    <div style={{
      display:'flex',
      flexDirection: isMobile ? 'column' : 'row',
      justifyContent:'space-between',
      alignItems: isMobile ? 'flex-start' : 'center',
      gap: isMobile ? 12 : 0,
      marginBottom:24,
    }}>
      <div>
        <h1 style={{fontSize: isMobile ? 20 : 26, fontWeight:'bold',color:'#1e3a5f',margin:0}}>💼 Accounts</h1>
        <p style={{color:'#64748b',fontSize:14,margin:'4px 0 0'}}>Manage income &amp; expense transactions</p>
      </div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap', width: isMobile ? '100%' : 'auto'}}>
        <button onClick={()=>setShowStatCards(s=>!s)} style={{backgroundColor:'#f8fafc',color:'#475569',border:'1px solid #e2e8f0',borderRadius:8,padding: isMobile ? '8px 12px' : '10px 16px',fontWeight:600,cursor:'pointer',fontSize: isMobile ? 12 : 13, flex: isMobile ? '1' : 'none'}}>{showStatCards?'▲ Hide Summary':'▼ Show Summary'}</button>
        <button onClick={()=>setShowPL(true)} style={{backgroundColor:'#f0f9ff',color:'#0369a1',border:'1px solid #bae6fd',borderRadius:8,padding: isMobile ? '8px 12px' : '10px 16px',fontWeight:600,cursor:'pointer',fontSize: isMobile ? 12 : 13, flex: isMobile ? '1' : 'none'}}>📋 P&L</button>
        <button onClick={exportCSV} style={{backgroundColor:'#f0fdf4',color:'#16a34a',border:'1px solid #bbf7d0',borderRadius:8,padding: isMobile ? '8px 12px' : '10px 16px',fontWeight:600,cursor:'pointer',fontSize: isMobile ? 12 : 13, flex: isMobile ? '1' : 'none'}}>⬇ Export</button>
        {canAddEntry&&<button onClick={()=>(showForm&&!editEntry)?setShowForm(false):openAdd()} style={{backgroundColor:'#1e3a5f',color:'white',border:'none',borderRadius:8,padding: isMobile ? '8px 12px' : '10px 20px',fontWeight:600,cursor:'pointer',fontSize: isMobile ? 12 : 14, flex: isMobile ? '1' : 'none'}}>{showForm&&!editEntry?'✖ Cancel':canAddIncome?'➕ Add':'➕ Add Expenditure'}</button>}
      </div>
    </div>

    {/* ── Expenditure v2: always-visible pending-approval widget (admin only) ──
        Deliberately NOT gated behind a tab — the whole point is that a pending
        approval is never just sitting quietly somewhere unnoticed. */}
    {isAdmin&&pendingApprovals.length>0&&(
      <div style={{backgroundColor:'#fffbeb',border:'1.5px solid #fde68a',borderRadius:12,padding:'12px 18px',marginBottom:20,cursor:'pointer'}} onClick={()=>setShowApprovalQueue(s=>!s)}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:20}}>🔏</span>
            <div>
              <p style={{margin:0,fontSize:13,fontWeight:800,color:'#92400e'}}>{pendingApprovals.length} expenditure entr{pendingApprovals.length>1?'ies':'y'} awaiting your approval</p>
              <p style={{margin:'2px 0 0',fontSize:11,color:'#b45309'}}>Total pending: {fmt(pendingApprovals.reduce((s,r)=>s+Number(r.amount),0))} — not counted in any total until approved</p>
            </div>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <button onClick={(e)=>{e.stopPropagation();setActiveTab('approvals')}} style={{backgroundColor:'#92400e',color:'white',border:'none',borderRadius:8,padding:'7px 14px',fontWeight:700,cursor:'pointer',fontSize:12}}>Review Queue →</button>
            <span style={{fontSize:12,color:'#92400e'}}>{showApprovalQueue?'▲':'▼'}</span>
          </div>
        </div>
        {showApprovalQueue&&(
          <div style={{marginTop:12,borderTop:'1px solid #fde68a',paddingTop:10,display:'flex',flexDirection:'column',gap:6}} onClick={e=>e.stopPropagation()}>
            {pendingApprovals.slice(0,5).map(req=>(
              <div key={req.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,backgroundColor:'white',borderRadius:8,padding:'8px 12px',fontSize:12}}>
                <div style={{minWidth:0}}>
                  <strong style={{color:'#1e293b'}}>{fmt(req.amount)}</strong> — {req.accounts?.category||'—'}{req.accounts?.note?` · ${req.accounts.note}`:''}
                  <div style={{fontSize:11,color:'#94a3b8'}}>by {req.requested_by} · {req.reason==='both'?'role + amount':req.reason==='role'?'role':'amount'}</div>
                </div>
                <div style={{display:'flex',gap:6,flexShrink:0}}>
                  <button disabled={approvalBusyId===req.id} onClick={()=>approveExpenditure(req)} style={{...smallBtn('#f0fdf4','#16a34a'),fontSize:11}}>✓ Approve</button>
                  <button disabled={approvalBusyId===req.id} onClick={()=>rejectExpenditure(req)} style={{...smallBtn('#fee2e2','#dc2626'),fontSize:11}}>✗ Reject</button>
                </div>
              </div>
            ))}
            {pendingApprovals.length>5&&<button onClick={()=>setActiveTab('approvals')} style={{background:'none',border:'none',color:'#92400e',fontWeight:700,fontSize:12,cursor:'pointer',padding:'4px 0'}}>+{pendingApprovals.length-5} more — view full queue →</button>}
          </div>
        )}
      </div>
    )}

    {/* ── stat cards (hidden by default — toggled via "Show Summary" button) ── */}
    {showStatCards&&(
    <div style={{display:'grid',gridTemplateColumns:statCardCols,gap: isMobile ? 10 : 14,marginBottom:16}}>
      <StatCard label={isFiltered?'Income (filtered)':'Total Income'} value={isFiltered?filteredIncome:totalIncome} color="#16a34a" bg="#dcfce7" icon="📈" sub={isFiltered?`All-time: ${fmt(totalIncome)}`:null}/>
      <StatCard label={isFiltered?'Expense (filtered)':'Total Expense'} value={isFiltered?filteredExpense:totalExpense} color="#dc2626" bg="#fee2e2" icon="📉" sub={isFiltered?`All-time: ${fmt(totalExpense)}`:null}/>
      <StatCard label={isFiltered?'Net (filtered)':'Net Balance'} value={isFiltered?filteredNet:totalIncome-totalExpense} color="#1e3a5f" bg="#eff6ff" icon="💼"/>
      <StatCard label="Transactions" value={entries.length} color="#7c3aed" bg="#f3e8ff" icon="🧾" isCurrency={false}/>
      <StatCard label="Pending" value={pendingCount} color="#f59e0b" bg="#fffbeb" icon="⏳" isCurrency={false} sub={pendingCount>0?'Uncleared entries':'All confirmed'}/>
    </div>
    )}

    {/* ── today summary ── */}
    <div style={{backgroundColor:'white',borderRadius:12,padding: isMobile ? '12px 14px' : '14px 20px',marginBottom:24,boxShadow:'0 2px 8px rgba(0,0,0,0.06)',borderTop:'3px solid #1e3a5f'}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12,flexWrap:'wrap'}}>
        <span style={{fontSize:16}}>📅</span>
        <span style={{fontSize:14,fontWeight:700,color:'#1e3a5f'}}>Today's Summary</span>
        {!isMobile && <span style={{fontSize:12,color:'#94a3b8'}}>{new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</span>}
        {todayCount===0&&<span style={{marginLeft:'auto',fontSize:12,color:'#94a3b8',fontStyle:'italic'}}>No transactions today</span>}
      </div>
      <div style={{display:'grid',gridTemplateColumns:todayCols,gap: isMobile ? 10 : 12}}>
        {[{label:"Today's Income",value:todayIncome,color:'#16a34a',bg:'#f0fdf4',icon:'⬆️'},{label:"Today's Expense",value:todayExpense,color:'#dc2626',bg:'#fff5f5',icon:'⬇️'},{label:"Today's Net",value:todayNet,color:todayNet>=0?'#1e3a5f':'#dc2626',bg:'#eff6ff',icon:todayNet>=0?'✅':'⚠️'},{label:"Today's Entries",value:todayCount,color:'#7c3aed',bg:'#faf5ff',icon:'🔢',isCurrency:false}].map(card=>(
          <div key={card.label} style={{backgroundColor:card.bg,borderRadius:10,padding: isMobile ? '10px 12px' : '12px 16px',borderLeft:`3px solid ${card.color}`}}>
            <div style={{fontSize: isMobile ? 16 : 18,marginBottom:4}}>{card.icon}</div>
            <p style={{fontSize: isMobile ? 11 : 12,color:card.color,fontWeight:600,margin:'0 0 4px'}}>{card.label}</p>
            <p style={{fontSize: isMobile ? 16 : 20,fontWeight:800,color:card.color,margin:0}}>{card.isCurrency===false?card.value:fmt(card.value)}</p>
          </div>
        ))}
      </div>
    </div>

    {/* ── add/edit form ── */}
    {showForm&&(editEntry?canEditExpenditure:canAddEntry)&&(
      <div style={{backgroundColor:'white',borderRadius:12,padding: isMobile ? 16 : 24,marginBottom:24,boxShadow:'0 2px 8px rgba(0,0,0,0.08)',borderLeft:'4px solid #1e3a5f'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:10}}>
          <h2 style={{fontSize: isMobile ? 16 : 18,fontWeight:600,color:'#1e3a5f',margin:0}}>{editEntry?'✏️ Edit Entry':`➕ Add ${rows.length>1?`${rows.length} Entries`:'Entry'}`}</h2>
          {!editEntry&&<button onClick={addRow} style={{backgroundColor:'#eff6ff',color:'#1e3a5f',border:'1px solid #bfdbfe',borderRadius:8,padding:'7px 14px',fontWeight:600,cursor:'pointer',fontSize:13}}>+ Add Row</button>}
        </div>
        {!canAddIncome&&<div style={{backgroundColor:'#fffbeb',border:'1px solid #fde68a',borderRadius:8,padding:'8px 14px',marginBottom:14,fontSize:13,color:'#92400e'}}>⚠️ You can only add <strong>Expense</strong> entries.</div>}
        <form onSubmit={handleSubmit}>
          {rows.map((row,i)=>(
            <div key={i} style={{border:rows.length>1?'1px solid #e2e8f0':'none',borderRadius:10,padding:rows.length>1?16:0,marginBottom:rows.length>1?14:0}}>
              {rows.length>1&&<div style={{display:'flex',justifyContent:'space-between',marginBottom:10,alignItems:'center'}}><span style={{fontSize:13,fontWeight:600,color:'#1e3a5f'}}>Row {i+1}</span>{i>0&&<button type="button" onClick={()=>removeRow(i)} style={{backgroundColor:'#fee2e2',color:'#dc2626',border:'none',borderRadius:6,padding:'3px 10px',fontSize:12,cursor:'pointer'}}>✖ Remove</button>}</div>}
              <div style={{display:'grid',gridTemplateColumns:formCols,gap:14}}>
                <div><label style={lStyle}>Date {row.type==='Income'?'(Entered)':''} <span style={{color:'#dc2626'}}>*</span></label><input type="date" value={row.entry_date} max={today} onChange={e=>updateRow(i,'entry_date',e.target.value)} required style={iStyle}/></div>
                {row.type==='Income'&&<div><label style={lStyle}>💰 Actual Payment Date <span style={{color:'#dc2626'}}>*</span></label><input type="date" value={row.payment_date||row.entry_date} max={today} onChange={e=>updateRow(i,'payment_date',e.target.value)} required style={iStyle}/></div>}
                <div><label style={lStyle}>Type <span style={{color:'#dc2626'}}>*</span></label>
                  <select value={row.type} disabled={!canAddIncome} onChange={e=>{updateRow(i,'type',e.target.value);updateRow(i,'category','')}} required style={{...iStyle,backgroundColor:!canAddIncome?'#f8fafc':'white'}}>
                    {canAddIncome&&<option>Income</option>}<option>Expense</option>
                  </select>
                </div>
                <div><label style={lStyle}>Category <span style={{color:'#dc2626'}}>*</span></label>
                  <select value={row.category} onChange={e=>{
                    if(e.target.value==='__add_new__'){addCustomExpenseCategory(i);return}
                    updateRow(i,'category',e.target.value)
                  }} required style={iStyle}>
                    <option value="">Select</option>
                    {(row.type==='Income'?INCOME_CATEGORIES:expenseCategoryOptions).map(c=><option key={c}>{c}</option>)}
                    {row.type==='Expense'&&<option value="__add_new__">+ Add New Category…</option>}
                  </select>
                </div>
                {row.type==='Expense'&&(
                  <div><label style={lStyle}>Sub-category <span style={{fontWeight:400,color:'#94a3b8'}}>(optional)</span></label>
                    <select value={row.sub_category||''} onChange={e=>{
                      if(e.target.value==='__add_new_sub__'){addCustomSubCategory(i,row.category);return}
                      updateRow(i,'sub_category',e.target.value)
                    }} disabled={!row.category} style={{...iStyle,backgroundColor:!row.category?'#f8fafc':'white'}}>
                      <option value="">{row.category?'None':'Select a category first'}</option>
                      {subCategoryOptionsFor(row.category).map(c=><option key={c}>{c}</option>)}
                      {row.category&&<option value="__add_new_sub__">+ Add New Sub-category…</option>}
                    </select>
                  </div>
                )}
                {row.type==='Expense'&&(
                  <div><label style={lStyle}>Vendor / Payee <span style={{fontWeight:400,color:'#94a3b8'}}>(optional)</span></label>
                    <select value={row.vendor_id||''} onChange={e=>{
                      if(e.target.value==='__add_vendor__'){addNewVendor(i);return}
                      updateRow(i,'vendor_id',e.target.value)
                    }} style={iStyle}>
                      <option value="">None</option>
                      {vendors.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
                      <option value="__add_vendor__">+ Add New Vendor…</option>
                    </select>
                  </div>
                )}
                {row.type==='Income'&&(
                  <div><label style={lStyle}>Payer / Source <span style={{fontWeight:400,color:'#94a3b8'}}>(optional)</span></label>
                    <select value={row.payer_id||''} onChange={e=>{
                      if(e.target.value==='__add_payer__'){addNewPayer(i);return}
                      updateRow(i,'payer_id',e.target.value)
                    }} style={iStyle}>
                      <option value="">None</option>
                      {payers.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                      <option value="__add_payer__">+ Add New Payer…</option>
                    </select>
                  </div>
                )}
                <div><label style={lStyle}>Amount <span style={{color:'#dc2626'}}>*</span></label><input type="number" min="0.01" step="0.01" placeholder="0" value={row.amount} onChange={e=>updateRow(i,'amount',e.target.value)} required style={iStyle}/>
                  {row.type==='Expense'&&(()=>{
                    const amt=Number(row.amount)||0
                    const overThreshold=amt>=(Number(approvalSettings.threshold_amount)||DEFAULT_APPROVAL_THRESHOLD)
                    const lowerTrust=!canWrite
                    return (amt>0&&(overThreshold||lowerTrust))?(
                      <p style={{fontSize:11,color:'#b45309',margin:'5px 0 0',fontWeight:600}}>⚠ Will need admin approval before it counts as confirmed{overThreshold?` (≥ ${fmt(approvalSettings.threshold_amount)} threshold)`:' (your role always requires approval)'}.</p>
                    ):null
                  })()}
                </div>
                <div><label style={lStyle}>Payment Mode <span style={{color:'#dc2626'}}>*</span></label>
                  <select value={row.payment_mode} onChange={e=>updateRow(i,'payment_mode',e.target.value)} required style={iStyle}>
                    <option value="">Select</option>
                    {PAYMENT_MODES.map(m=><option key={m}>{m}</option>)}
                  </select>
                </div>
                <div><label style={lStyle}>Account Type <span style={{color:'#dc2626'}}>*</span></label>
                  <select value={row.account_type||'Cash A/c'} onChange={e=>updateRow(i,'account_type',e.target.value)} required style={iStyle}>
                    {ACCOUNT_TYPES.map(a=><option key={a}>{a}</option>)}
                  </select>
                </div>
                <div><label style={lStyle}>Voucher Head <span style={{fontWeight:400,color:'#94a3b8'}}>(who takes it)</span> <span style={{color:'#dc2626'}}>*</span></label>
                  <select value={row.voucher_head||''} onChange={e=>{
                    if(e.target.value==='__add_staff__'){addNewStaffMember(i);return}
                    updateRow(i,'voucher_head',e.target.value)
                  }} required style={iStyle}>
                    <option value="">Select from Staff…</option>
                    {selectableStaffList.map(s=><option key={s.id??s.name} value={s.name}>{s.name}{String(s.user_id)===String(userId)||String(s.id)===String(userId)?' (You)':''}</option>)}
                    <option value="__add_staff__">+ Add New Staff Member…</option>
                  </select>
                </div>
                <div><label style={lStyle}>Entered By</label>
                  <input type="text" value={currentStaff?.name||role||'Unknown'} readOnly disabled style={{...iStyle,backgroundColor:'#f8fafc',color:'#64748b',fontWeight:600,cursor:'not-allowed'}}/>
                </div>
                <div><label style={lStyle}>Status <span style={{color:'#dc2626'}}>*</span></label>
                  <select value={row.status} onChange={e=>updateRow(i,'status',e.target.value)} required style={iStyle}>
                    {STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{gridColumn: isMobile ? '1' : 'span 4'}}><label style={lStyle}>Description / Note <span style={{color:'#dc2626'}}>*</span></label><input type="text" placeholder="Transaction description" value={row.note} onChange={e=>updateRow(i,'note',e.target.value)} required style={iStyle}/></div>
              </div>
            </div>
          ))}
          <div style={{marginTop:16}}>
            <label style={lStyle}>🧾 Receipt / Attachment <span style={{fontWeight:400,color:'#94a3b8'}}>(optional)</span></label>
            <div style={{display:'flex',gap:10,alignItems:'center',marginTop:6,flexWrap:'wrap'}}>
              <input ref={fileInputRef} type="file" accept="image/*,application/pdf" onChange={e=>setReceiptFile(e.target.files[0]||null)} style={{fontSize:13,maxWidth:'100%'}}/>
              {(rows[0]?.receipt_url||receiptFile)&&<button type="button" onClick={()=>setViewReceipt(receiptFile?URL.createObjectURL(receiptFile):rows[0].receipt_url)} style={{backgroundColor:'#eff6ff',color:'#1e3a5f',border:'1px solid #bfdbfe',borderRadius:6,padding:'5px 12px',fontSize:12,cursor:'pointer',fontWeight:500}}>👁 Preview</button>}
              {rows[0]?.receipt_url&&!receiptFile&&<span style={{fontSize:12,color:'#16a34a'}}>✅ Receipt on file</span>}
            </div>
          </div>
          <div style={{display:'flex',gap:12,marginTop:20,flexWrap:'wrap'}}>
            <button type="submit" disabled={saving||uploadingReceipt} style={{backgroundColor:(saving||uploadingReceipt)?'#94a3b8':'#1e3a5f',color:'white',border:'none',borderRadius:8,padding:'10px 24px',fontWeight:600,cursor:(saving||uploadingReceipt)?'not-allowed':'pointer',fontSize:14,flex: isMobile ? '1' : 'none'}}>
              {uploadingReceipt?'⏳ Uploading…':saving?'⏳ Saving…':editEntry?'✅ Update':'✅ Save'}
            </button>
            <button type="button" onClick={()=>{setShowForm(false);setEditEntry(null);setRows([{...emptyRow}])}} style={{backgroundColor:'#f1f5f9',color:'#64748b',border:'none',borderRadius:8,padding:'10px 20px',fontWeight:600,cursor:'pointer',fontSize:14}}>Cancel</button>
          </div>
        </form>
      </div>
    )}

    {/* ── tabs ── */}
    <div style={{display:'flex',gap: isMobile ? 6 : 8,marginBottom:20,flexWrap:'wrap'}}>
      {[
        ['transactions','🧾 Transactions'],
        ['analytics','📊 Analytics'],
        ['budgets','💰 Budgets'],
        ['daily','📋 Daily'],
        ['expenditure','💵 Expenditure'],
        ['reports','📑 Reports'],
        ...(isAdmin?[['fraud',digestItems.length>0?`📌 For Admin (${digestItems.length})`:'📌 For Admin']]:[] ),
        // Expenditure v2: approval queue is admin-only to ACT on, but the
        // pending count itself is meaningful to canWrite roles too (they can
        // see their own team's requests move through review) — restricted to
        // isAdmin here since only admin can actually approve/reject.
        ...(isAdmin?[['approvals',pendingApprovals.length>0?`🔏 Approvals (${pendingApprovals.length})`:'🔏 Approvals']]:[] ),
        ...(isAdmin?[['staffspend','🧑‍💼 Staff Spend']]:[] ),
        ...(isAdmin?[['savings','💹 Savings Tracker']]:[] ),
        ...(isAdmin?[['forecast','📈 Forecast']]:[] ),
        ...(isAdmin?[['reconciliation','🔒 Reconciliation']]:[] ),
        // PHASE 4: Balance Sheet tab (admin only)
        ...(isAdmin?[['balancesheet','📒 Balance Sheet']]:[] ),
        // Course-wise fee collection + automated anomaly detection for the
        // specific patterns found in this ledger's audit (duplicate
        // recurring entries, fee-rate mismatches, missing voucher heads,
        // outlier amounts, category label fragmentation). Admin only —
        // this surfaces amounts and per-student detail across the whole
        // ledger that other roles shouldn't see.
        ...(isAdmin?[['audit','🛡️ Audit Monitor']]:[] ),
        ['income','💰 Income Analysis'],
        // Activity Timeline shows every user's inserts/edits/deletes — admin-only visibility.
        // Entries are still logged the same way for everyone; this only restricts who can view the log.
        ...(isAdmin?[['timeline','🕐 Activity']]:[] ),
      ].map(([id,label])=>(
        <button key={id} style={{
          ...tabStyle(id),
          ...(id==='fraud'?{backgroundColor:activeTab===id?'#7c3aed':'#faf5ff',color:activeTab===id?'white':'#7c3aed',border:'1px solid #e9d5ff'}:{}),
          ...(id==='daily'?{backgroundColor:activeTab===id?'#0369a1':'#f0f9ff',color:activeTab===id?'white':'#0369a1',border:'1px solid #bae6fd'}:{}),
          ...(id==='expenditure'?{backgroundColor:activeTab===id?'#b91c1c':'#fef2f2',color:activeTab===id?'white':'#b91c1c',border:'1px solid #fecaca'}:{}),
          ...(id==='reports'?{backgroundColor:activeTab===id?'#be185d':'#fdf2f8',color:activeTab===id?'white':'#be185d',border:'1px solid #fbcfe8'}:{}),
          ...(id==='balancesheet'?{backgroundColor:activeTab===id?'#047857':'#f0fdf4',color:activeTab===id?'white':'#047857',border:'1px solid #bbf7d0'}:{}),
          ...(id==='audit'?{backgroundColor:activeTab===id?'#312e81':'#eef2ff',color:activeTab===id?'white':'#312e81',border:'1px solid #c7d2fe'}:{}),
        }} onClick={()=>setActiveTab(id)}>{label}</button>
      ))}
    </div>

    {/* ══ TAB: TRANSACTIONS ══ */}
{activeTab==='transactions'&&(
  <AccountsDashboardBanking
    entries={entries}
    fraudFlags={fraudFlags}
    budgets={budgets}
    canWrite={canWrite}
            canEditExpenditure={canEditExpenditure}
            superintendentFlaggedIds={superintendentFlaggedIds}
    fmt={fmt}
    isMobile={isMobile}
    openEdit={openEdit}
            printReceiptMemo={printReceiptMemo}
    handleDelete={handleDelete}
            onExportReport={(fmt)=>exportAllEntriesReport(fmt,'Transactions')}
            exportingReport={generatingReport}
  />
)}

    {activeTab==='daily'&&(
      <div>
        <div style={{backgroundColor:'#1e3a5f',borderRadius:12,padding: isMobile ? '16px' : '20px 24px',marginBottom:20}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16,flexWrap:'wrap',gap:10}}>
            <div>
              <h2 style={{fontSize: isMobile ? 15 : 18,fontWeight:800,color:'white',margin:0}}>📊 Daily {dailyLabelWord} Register</h2>
              <p style={{fontSize:12,color:'rgba(255,255,255,0.5)',margin:'4px 0 0'}}>{dailyTypeFilter} entries grouped by {dailyIsIncome?(dailyDateMode==='payment'?'actual payment date':'entry date'):'entry date'}</p>
            </div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              <button onClick={exportDailyCSV} style={{backgroundColor:'rgba(255,255,255,0.1)',color:'white',border:'1px solid rgba(255,255,255,0.2)',borderRadius:8,padding:'8px 12px',fontWeight:600,cursor:'pointer',fontSize:12}}>⬇ CSV</button>
              <button onClick={printDailyRegister} style={{backgroundColor:'rgba(255,255,255,0.15)',color:'white',border:'1px solid rgba(255,255,255,0.3)',borderRadius:8,padding:'8px 12px',fontWeight:600,cursor:'pointer',fontSize:12}}>🖨 Print</button>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:dailySumCols,gap:12}}>
            {[{label:'Total Days',value:dailyGroups.length,isCurrency:false},{label:dailyIsIncome?'Payments Received':'Total Entries',value:dailyFilteredEntries.length,isCurrency:false},{label:'Cash Total',value:dailyCashAmt,color:'#fbbf24'},{label:'Bank Transfer',value:dailyBankAmt,color:'#f87171'}].map(c=>(
              <div key={c.label} style={{backgroundColor:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:10,padding:'12px 14px'}}>
                <p style={{fontSize:11,color:'rgba(255,255,255,0.5)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.6px',margin:'0 0 6px'}}>{c.label}</p>
                <p style={{fontFamily:'monospace',fontSize: isMobile ? 16 : 20,fontWeight:600,color:c.color||'white',margin:0}}>{c.isCurrency===false?c.value:fmt(c.value)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* PAYMENT-DATE FILTER FIX: Income/Expense toggle + quick date range, so you can instantly see "how many paid on date X" */}
        <div style={{display:'flex',gap: isMobile ? 6 : 8,marginBottom:12,alignItems:'center',flexWrap:'wrap'}}>
          <span style={{fontSize:12,color:'#94a3b8',fontWeight:600}}>Showing:</span>
          <button onClick={()=>setDailyTypeFilter('Income')} style={{padding: isMobile ? '5px 10px' : '5px 14px',borderRadius:6,border:'1px solid',borderColor:dailyIsIncome?'#16a34a':'#bbf7d0',cursor:'pointer',fontSize:isMobile?11:12,fontWeight:700,backgroundColor:dailyIsIncome?'#16a34a':'#f0fdf4',color:dailyIsIncome?'white':'#16a34a'}}>📈 Income / Payments</button>
          <button onClick={()=>setDailyTypeFilter('Expense')} style={{padding: isMobile ? '5px 10px' : '5px 14px',borderRadius:6,border:'1px solid',borderColor:!dailyIsIncome?'#dc2626':'#fecaca',cursor:'pointer',fontSize:isMobile?11:12,fontWeight:700,backgroundColor:!dailyIsIncome?'#dc2626':'#fef2f2',color:!dailyIsIncome?'white':'#dc2626'}}>📉 Expense</button>
          {dailyIsIncome&&(
            <>
              <span style={{width:1,height:20,backgroundColor:'#e2e8f0',margin:'0 4px'}}/>
              <span style={{fontSize:12,color:'#94a3b8',fontWeight:600}}>Filter by:</span>
              <button onClick={()=>setDailyDateMode('payment')} style={{padding: isMobile ? '5px 10px' : '5px 14px',borderRadius:6,border:'1px solid',borderColor:dailyDateMode==='payment'?'#1e3a5f':'#cbd5e1',cursor:'pointer',fontSize:isMobile?11:12,fontWeight:700,backgroundColor:dailyDateMode==='payment'?'#1e3a5f':'#f1f5f9',color:dailyDateMode==='payment'?'white':'#64748b'}}>💰 Payment Date</button>
              <button onClick={()=>setDailyDateMode('entry')} style={{padding: isMobile ? '5px 10px' : '5px 14px',borderRadius:6,border:'1px solid',borderColor:dailyDateMode==='entry'?'#1e3a5f':'#cbd5e1',cursor:'pointer',fontSize:isMobile?11:12,fontWeight:700,backgroundColor:dailyDateMode==='entry'?'#1e3a5f':'#f1f5f9',color:dailyDateMode==='entry'?'white':'#64748b'}}>🗓 Entry Date</button>
            </>
          )}
          <span style={{width:1,height:20,backgroundColor:'#e2e8f0',margin:'0 4px'}}/>
          <span style={{fontSize:12,color:'#94a3b8',fontWeight:600}}>Quick:</span>
          {[['today','Today'],['week','Week'],['month','Month'],['lastmonth','Last Mo.'],['year','Year']].map(([k,l])=>(
            <button key={k} style={qBtn(k)} onClick={()=>activeQuick===k?clearQuick():applyQuick(k)}>{l}</button>
          ))}
          {activeQuick&&<button onClick={clearQuick} style={{padding:'5px 8px',borderRadius:6,border:'none',cursor:'pointer',fontSize:11,backgroundColor:'#fee2e2',color:'#dc2626',fontWeight:600}}>✖</button>}
        </div>

        <div style={{display:'grid',gridTemplateColumns: isMobile ? '1fr 1fr' : 'auto auto auto auto auto auto auto',gap:8,marginBottom:16,alignItems:'center'}}>
          <input placeholder="🔍 Search…" value={dailySearch} onChange={e=>setDailySearch(e.target.value)} style={{...iStyle, gridColumn: isMobile ? 'span 2' : 'auto'}}/>
          <select value={dailyAcctFilter} onChange={e=>setDailyAcctFilter(e.target.value)} style={iStyle}><option value="All">All Accounts</option>{ACCOUNT_TYPES.map(a=><option key={a}>{a}</option>)}</select>
          <select value={dailyModeFilter} onChange={e=>setDailyModeFilter(e.target.value)} style={iStyle}><option value="All">All Modes</option>{PAYMENT_MODES.map(m=><option key={m}>{m}</option>)}</select>
          <input placeholder="Voucher head…" value={voucherHead} onChange={e=>setVoucherHead(e.target.value)} style={iStyle}/>
          <input type="date" value={dateFrom} onChange={e=>{setDateFrom(e.target.value);setActiveQuick('')}} title={dailyIsIncome&&dailyDateMode==='payment'?'Payment date from':'Entry date from'} style={iStyle}/>
          <input type="date" value={dateTo} onChange={e=>{setDateTo(e.target.value);setActiveQuick('')}} title={dailyIsIncome&&dailyDateMode==='payment'?'Payment date to':'Entry date to'} style={iStyle}/>
          {(dailySearch||dailyAcctFilter!=='All'||dailyModeFilter!=='All'||voucherHead||dateFrom||dateTo)&&
            <button onClick={()=>{setDailySearch('');setDailyAcctFilter('All');setDailyModeFilter('All');setVoucherHead('');setDateFrom('');setDateTo('');setActiveQuick('')}} style={{...smallBtn('#fee2e2','#dc2626'),padding:'9px 14px',fontSize:12, gridColumn: isMobile ? 'span 2' : 'auto'}}>✖ Clear</button>}
        </div>

        {dailyGroups.length===0?<div style={{textAlign:'center',padding:48,color:'#94a3b8',backgroundColor:'white',borderRadius:12}}>No {dailyTypeFilter.toLowerCase()} entries found for this date range.</div>:(
          <TransactionsViewBanking
            dayRows={dailyFilteredEntries}
            dailyIsIncome={dailyIsIncome}
            dailyDateMode={dailyDateMode}
            dailyAmtColor={dailyAmtColor}
            dayTotal={dailyFilteredEntries.reduce((s,e)=>s+Number(e.amount),0)}
            dailyCashAmt={dailyFilteredEntries.filter(e=>e.payment_mode==='Cash').reduce((s,e)=>s+Number(e.amount),0)}
            dailyBankAmt={dailyFilteredEntries.filter(e=>e.payment_mode==='Bank').reduce((s,e)=>s+Number(e.amount),0)}
            dailyTotalAmt={dailyFilteredEntries.reduce((s,e)=>s+Number(e.amount),0)}
            fraudFlags={fraudFlags}
            canWrite={canWrite}
            canEditExpenditure={canEditExpenditure}
            superintendentFlaggedIds={superintendentFlaggedIds}
            fmt={fmt}
            openEdit={openEdit}
            printReceiptMemo={printReceiptMemo}
            handleDelete={handleDelete}
            isMobile={isMobile}
            onExportReport={(fmt2)=>exportAllEntriesReport(fmt2,'Daily')}
            exportingReport={generatingReport}
          />
        )}
      </div>
    )}

    {/* ══ TAB: DAILY EXPENDITURE (dedicated — separate from the combined Daily register) ══ */}
    {activeTab==='expenditure'&&(
      <div>
        <div style={{backgroundColor:'#7f1d1d',borderRadius:12,padding: isMobile ? '16px' : '20px 24px',marginBottom:20}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16,flexWrap:'wrap',gap:10}}>
            <div>
              <h2 style={{fontSize: isMobile ? 15 : 18,fontWeight:800,color:'white',margin:0}}>💵 Daily Expenditure</h2>
              <p style={{fontSize:12,color:'rgba(255,255,255,0.55)',margin:'4px 0 0'}}>All expense entries, grouped by entry date — a dedicated table separate from the combined Daily register.</p>
            </div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              <button onClick={exportExpenditureCSV} style={{backgroundColor:'rgba(255,255,255,0.1)',color:'white',border:'1px solid rgba(255,255,255,0.2)',borderRadius:8,padding:'8px 12px',fontWeight:600,cursor:'pointer',fontSize:12}}>⬇ CSV</button>
              <button onClick={printExpenditureRegister} style={{backgroundColor:'rgba(255,255,255,0.15)',color:'white',border:'1px solid rgba(255,255,255,0.3)',borderRadius:8,padding:'8px 12px',fontWeight:600,cursor:'pointer',fontSize:12}}>🖨 Print</button>
            </div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:dailySumCols,gap:12}}>
            {[{label:'Total Days',value:expenditureGroups.length,isCurrency:false},{label:'Total Entries',value:expenditureFilteredEntries.length,isCurrency:false},{label:'Cash Total',value:expenditureCashAmt,color:'#fbbf24'},{label:'Bank Transfer',value:expenditureBankAmt,color:'#f87171'}].map(c=>(
              <div key={c.label} style={{backgroundColor:'rgba(255,255,255,0.08)',borderRadius:10,padding:'12px 14px'}}>
                <p style={{fontSize:11,color:c.color||'rgba(255,255,255,0.6)',fontWeight:600,margin:'0 0 4px'}}>{c.label}</p>
                <p style={{fontSize: isMobile ? 16 : 19,fontWeight:800,color:'white',margin:0}}>{c.isCurrency===false?c.value:fmt(c.value)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── one-click Expenditure Report — reuses the same letterheaded PDF/DOCX/Excel export as the Reports tab ── */}
        <div style={{backgroundColor:'white',borderRadius:12,padding: isMobile ? 14 : 20,marginBottom:20,boxShadow:'0 2px 8px rgba(0,0,0,0.06)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:10}}>
            <div>
              <h3 style={{...chartTitle,fontSize:15,margin:0}}>📑 Expenditure Report</h3>
              <p style={{fontSize:12,color:'#94a3b8',margin:'4px 0 0'}}>Generates the same letterheaded report as the Reports tab, pre-filtered to Expense entries using the filters below.</p>
            </div>
            <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
              <button onClick={()=>generateReportPDF({entries:expenditureFilteredEntries,totals:expenditureTotals,byCategory:expenditureByCategory,title:'Expenditure Statement',filterSummary:expenditureFilterSummary,setBusy:setGeneratingExpReport,logLabel:`Report (PDF): Expenditure Statement / Expense`,dateFrom:expDateFrom,dateTo:expDateTo})} disabled={!!generatingExpReport} style={{backgroundColor:generatingExpReport==='pdf'?'#94a3b8':'#dc2626',color:'white',border:'none',borderRadius:8,padding:'9px 18px',fontWeight:700,cursor:generatingExpReport?'not-allowed':'pointer',fontSize:13}}>{generatingExpReport==='pdf'?'⏳ Generating…':'📄 PDF'}</button>
              <button onClick={()=>generateReportDOCX({entries:expenditureFilteredEntries,totals:expenditureTotals,title:'Expenditure Statement',filterSummary:expenditureFilterSummary,setBusy:setGeneratingExpReport,logLabel:`Report (DOCX): Expenditure Statement / Expense`,dateFrom:expDateFrom,dateTo:expDateTo})} disabled={!!generatingExpReport} style={{backgroundColor:generatingExpReport==='docx'?'#94a3b8':'#1d4ed8',color:'white',border:'none',borderRadius:8,padding:'9px 18px',fontWeight:700,cursor:generatingExpReport?'not-allowed':'pointer',fontSize:13}}>{generatingExpReport==='docx'?'⏳ Generating…':'📝 DOCX'}</button>
              <button onClick={()=>generateReportExcel({entries:expenditureFilteredEntries,totals:expenditureTotals,title:'Expenditure Statement',filterSummary:expenditureFilterSummary,setBusy:setGeneratingExpReport,logLabel:`Report (Excel): Expenditure Statement / Expense`,dateFrom:expDateFrom,dateTo:expDateTo})} disabled={!!generatingExpReport} style={{backgroundColor:generatingExpReport==='excel'?'#94a3b8':'#16a34a',color:'white',border:'none',borderRadius:8,padding:'9px 18px',fontWeight:700,cursor:generatingExpReport?'not-allowed':'pointer',fontSize:13}}>{generatingExpReport==='excel'?'⏳ Generating…':'📊 Excel'}</button>
            </div>
          </div>

          {/* ── filters (shared by the table below and the report export above) ── */}
          <div style={{display:'grid',gridTemplateColumns: isMobile ? '1fr 1fr' : isTablet ? 'repeat(3,1fr)' : 'repeat(6,1fr)',gap:12}}>
            <input placeholder="🔍 Search…" value={expSearch} onChange={e=>setExpSearch(e.target.value)} style={{...iStyle, gridColumn: isMobile ? 'span 2' : 'auto'}}/>
            <select value={expCategory} onChange={e=>{setExpCategory(e.target.value);setExpSubCategory('All')}} style={iStyle}><option value="All">All Categories</option>{expenseCategoryOptions.map(c=><option key={c}>{c}</option>)}</select>
            <select value={expSubCategory} onChange={e=>setExpSubCategory(e.target.value)} disabled={expCategory==='All'} style={{...iStyle,backgroundColor:expCategory==='All'?'#f8fafc':'white'}}><option value="All">All Sub-categories</option>{expCategory!=='All'&&subCategoryOptionsFor(expCategory).map(c=><option key={c}>{c}</option>)}</select>
            <select value={expVendorFilter} onChange={e=>setExpVendorFilter(e.target.value)} style={iStyle}><option value="All">All Vendors</option>{vendors.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select>
            <select value={expAcctFilter} onChange={e=>setExpAcctFilter(e.target.value)} style={iStyle}><option value="All">All Accounts</option>{ACCOUNT_TYPES.map(a=><option key={a}>{a}</option>)}</select>
            <select value={expModeFilter} onChange={e=>setExpModeFilter(e.target.value)} style={iStyle}><option value="All">All Modes</option>{PAYMENT_MODES.map(m=><option key={m}>{m}</option>)}</select>
            <input type="date" value={expDateFrom} onChange={e=>{setExpDateFrom(e.target.value);setExpQuick('')}} title="Entry date from" style={iStyle}/>
            <input type="date" value={expDateTo} onChange={e=>{setExpDateTo(e.target.value);setExpQuick('')}} title="Entry date to" style={iStyle}/>
          </div>
          <div style={{display:'flex',gap:8,marginTop:12,alignItems:'center',flexWrap:'wrap'}}>
            <span style={{fontSize:12,color:'#94a3b8',fontWeight:600}}>Quick:</span>
            {[['today','Today'],['week','Week'],['month','Month'],['lastmonth','Last Mo.'],['year','Year']].map(([k,l])=>(
              <button key={k} style={{padding: isMobile?'5px 10px':'5px 12px',borderRadius:6,border:'none',cursor:'pointer',fontSize:isMobile?11:12,fontWeight:600,backgroundColor:expQuick===k?'#7f1d1d':'#f1f5f9',color:expQuick===k?'white':'#64748b'}} onClick={()=>expQuick===k?clearExpQuick():applyExpQuick(k)}>{l}</button>
            ))}
            {(expSearch||expAcctFilter!=='All'||expModeFilter!=='All'||expCategory!=='All'||expSubCategory!=='All'||expVendorFilter!=='All'||expDateFrom||expDateTo)&&
              <button onClick={resetExpFilters} style={{...smallBtn('#fee2e2','#dc2626'),padding:'5px 12px',fontSize:12}}>✖ Reset</button>}
          </div>
        </div>

        {/* ── All expense categories, built from every actual expense entry ── */}
        {allExpenseCategorySummary.length>0&&(()=>{
          const catIcons={Salary:'💼',Electricity:'💡',Stationery:'📎',Maintenance:'🔧',Transport:'🚌',Event:'🎉',Uncategorized:'❔'}
          const grandTotal=allExpenseCategorySummary.reduce((s,c)=>s+c.total,0)
          const topCat=allExpenseCategorySummary[0]
          return(
          <div style={{...chartCard,marginBottom:20}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems: isMobile?'flex-start':'center',flexDirection: isMobile?'column':'row',gap:10,marginBottom:18}}>
              <div>
                <h3 style={{...chartTitle,marginBottom:3}}>📂 All Expense Categories</h3>
                <p style={{fontSize:12,color:'#94a3b8',margin:0}}>Every category ever used across your expense entries, ranked by total spend</p>
              </div>
              <div style={{display:'flex',gap: isMobile?10:18,flexWrap:'wrap'}}>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:10,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.4px'}}>Categories</div>
                  <div style={{fontSize:18,fontWeight:800,color:'#1e3a5f'}}>{allExpenseCategorySummary.length}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:10,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.4px'}}>Total Spend</div>
                  <div style={{fontSize:18,fontWeight:800,color:'#7f1d1d'}}>{fmt(grandTotal)}</div>
                </div>
                {topCat&&<div style={{textAlign:'right'}}>
                  <div style={{fontSize:10,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.4px'}}>Top Category</div>
                  <div style={{fontSize:14,fontWeight:800,color:'#1e3a5f'}}>{catIcons[topCat.category]||'🏷️'} {topCat.category}</div>
                </div>}
              </div>
            </div>

            <div style={{display:'grid',gridTemplateColumns: isMobile?'1fr':'repeat(auto-fill,minmax(260px,1fr))',gap:12}}>
              {allExpenseCategorySummary.map((c,idx)=>{
                const expanded=catAllDrilldown===c.category
                const pct=grandTotal>0?(c.total/grandTotal)*100:0
                const color=CHART_COLORS[idx%CHART_COLORS.length]
                const catEntries=expanded?entries.filter(e=>e.type==='Expense'&&isConfirmed(e)&&(e.category||'Uncategorized')===c.category).sort((a,b)=>b.entry_date<a.entry_date?-1:b.entry_date>a.entry_date?1:0):[]
                return (
                  <div key={c.category} style={{border:'1px solid #f1f5f9',borderRadius:10,overflow:'hidden',backgroundColor:expanded?'#fafbfc':'white',transition:'background-color 0.2s ease',gridColumn: expanded&&!isMobile?'1 / -1':undefined}}>
                    <div onClick={()=>setCatAllDrilldown(expanded?null:c.category)} style={{padding:'14px 16px',cursor:'pointer'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                        <div style={{display:'flex',alignItems:'center',gap:9,minWidth:0}}>
                          <span style={{fontSize:20,width:34,height:34,borderRadius:9,backgroundColor:`${color}1a`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{catIcons[c.category]||'🏷️'}</span>
                          <div style={{minWidth:0}}>
                            <div style={{fontWeight:700,color:'#1e293b',fontSize:14,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{c.category}</div>
                            <div style={{fontSize:11,color:'#94a3b8'}}>{c.count} entr{c.count===1?'y':'ies'} · last {c.lastDate}</div>
                          </div>
                        </div>
                        <span style={{fontSize:14,color:'#cbd5e1',flexShrink:0,marginLeft:6}}>{expanded?'▾':'▸'}</span>
                      </div>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:6}}>
                        <strong style={{fontSize:17,fontWeight:800,color:'#1e3a5f'}}>{fmt(c.total)}</strong>
                        <span style={{fontSize:11,fontWeight:700,color:'#94a3b8'}}>{pct.toFixed(1)}% of total</span>
                      </div>
                      <div style={{height:6,borderRadius:999,backgroundColor:'#f1f5f9',overflow:'hidden'}}>
                        <div style={{height:'100%',width:`${Math.max(pct,2)}%`,borderRadius:999,backgroundColor:color,transition:'width 0.3s ease'}}/>
                      </div>
                    </div>
                    {expanded&&(
                      <div style={{padding:'0 16px 14px',borderTop:'1px solid #f1f5f9',marginTop:2}}>
                        <div style={{display:'flex',flexDirection:'column',gap:0,marginTop:10}}>
                          {(showAllDrilldown.has(`expcat:${c.category}`)?catEntries:catEntries.slice(0,10)).map(e=>(
                            <div key={e.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 0',fontSize:12,borderBottom:'1px solid #f8fafc'}}>
                              <span style={{color:'#64748b'}}>{e.entry_date}{e.sub_category?` · ${e.sub_category}`:''}{e.voucher_head?` · ${e.voucher_head}`:''}{e.note?` — ${e.note}`:''}</span>
                              <strong style={{color:'#dc2626',flexShrink:0,marginLeft:8}}>{fmt(e.amount)}</strong>
                            </div>
                          ))}
                          {catEntries.length>10&&(
                            <button onClick={()=>toggleShowAllDrilldown(`expcat:${c.category}`)} style={{background:'none',border:'none',color:'#0891b2',fontSize:11,fontWeight:700,cursor:'pointer',padding:'8px 0 0',textAlign:'left'}}>
                              {showAllDrilldown.has(`expcat:${c.category}`)?'Show less':`+${catEntries.length-10} more entr${catEntries.length-10===1?'y':'ies'} — Show all`}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          )
        })()}

        {/* ── Expenditure v2: vendor spend summary + drilldown ── */}
        {vendorSpendSummary.length>0&&(
          <div style={{backgroundColor:'white',borderRadius:12,padding: isMobile ? 14 : 20,marginBottom:20,boxShadow:'0 2px 8px rgba(0,0,0,0.06)'}}>
            <h3 style={{...chartTitle,fontSize:15,marginBottom:12}}>🏷️ Vendor / Payee Spend</h3>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {vendorSpendSummary.map(v=>{
                const expanded=vendorDrilldown===v.vendor_id
                return (
                  <div key={v.vendor_id} style={{border:'1px solid #f1f5f9',borderRadius:8}}>
                    <div onClick={()=>setVendorDrilldown(expanded?null:v.vendor_id)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',cursor:'pointer'}}>
                      <div>
                        <strong style={{color:'#1e293b'}}>{expanded?'▾':'▸'} {v.vendorName}</strong>
                        <span style={{fontSize:11,color:'#94a3b8',marginLeft:8}}>{v.count} payment{v.count===1?'':'s'} · last on {v.lastDate}</span>
                      </div>
                      <strong style={{color:'#7f1d1d'}}>{fmt(v.total)}</strong>
                    </div>
                    {expanded&&(
                      <div style={{padding:'0 14px 12px',borderTop:'1px solid #f8fafc'}}>
                        {(showAllDrilldown.has(`vendor:${v.vendor_id}`)?v.entries:v.entries.slice(0,10)).map(e=>(
                          <div key={e.id} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',fontSize:12,borderBottom:'1px solid #f8fafc'}}>
                            <span style={{color:'#64748b'}}>{e.entry_date} · {e.category}{e.note?` — ${e.note}`:''}</span>
                            <strong style={{color:'#dc2626'}}>{fmt(e.amount)}</strong>
                          </div>
                        ))}
                        {v.entries.length>10&&(
                          <button onClick={()=>toggleShowAllDrilldown(`vendor:${v.vendor_id}`)} style={{background:'none',border:'none',color:'#0891b2',fontSize:11,fontWeight:700,cursor:'pointer',padding:'6px 0 0',textAlign:'left'}}>
                            {showAllDrilldown.has(`vendor:${v.vendor_id}`)?'Show less':`+${v.entries.length-10} more payment(s) — Show all`}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── separate daily expenditure table ── */}
        {expenditureGroups.length===0?<div style={{textAlign:'center',padding:48,color:'#94a3b8',backgroundColor:'white',borderRadius:12}}>No expenditure entries found for this date range.</div>:(
          <TransactionsViewBanking
            dayRows={expenditureFilteredEntries}
            dailyIsIncome={false}
            dailyDateMode="entry"
            dailyAmtColor="#c0392b"
            dayTotal={expenditureTotals.expense}
            dailyCashAmt={expenditureCashAmt}
            dailyBankAmt={expenditureBankAmt}
            dailyTotalAmt={expenditureTotals.expense}
            fraudFlags={fraudFlags}
            canWrite={canWrite}
            canEditExpenditure={canEditExpenditure}
            superintendentFlaggedIds={superintendentFlaggedIds}
            fmt={fmt}
            openEdit={openEdit}
            printReceiptMemo={printReceiptMemo}
            handleDelete={handleDelete}
            isMobile={isMobile}
            onExportReport={(fmt2)=>exportAllEntriesReport(fmt2,'Expenditure')}
            exportingReport={generatingReport}
          />
        )}
      </div>
    )}

    {/* ══ TAB: REPORT GENERATOR ══ */}
    {activeTab==='reports'&&(
      <div>
        <div style={{backgroundColor:'#831843',borderRadius:12,padding: isMobile ? '16px' : '20px 24px',marginBottom:20}}>
          <h2 style={{fontSize: isMobile ? 15 : 18,fontWeight:800,color:'white',margin:0}}>📑 Professional Report Generator</h2>
          <p style={{fontSize:12,color:'rgba(255,255,255,0.65)',margin:'4px 0 0'}}>Build a filtered financial report and export it as a letterheaded PDF, Word (DOCX), or Excel file — ready to print and sign.</p>
        </div>

        {/* ── Accounts v3: one-click Monthly Report — pick any past month ── */}
        <div style={{backgroundColor:'white',borderRadius:12,padding: isMobile ? 14 : 20,marginBottom:16,boxShadow:'0 2px 8px rgba(0,0,0,0.06)',borderLeft:'4px solid #0c4a6e'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10,flexWrap:'wrap',gap:10}}>
            <div>
              <h3 style={{...chartTitle,fontSize:15,margin:0}}>🗓️ Monthly Report — pick any month</h3>
              <p style={{fontSize:12,color:'#94a3b8',margin:'4px 0 0'}}>{monthlyRptLabel} · {monthlyRptTotals.count} entries · no filters needed, one click</p>
            </div>
            <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
              <input type="month" value={monthlyRptMonth} max={today.slice(0,7)} onChange={e=>setMonthlyRptMonth(e.target.value)} style={{...iStyle,width:'auto'}}/>
              <button onClick={()=>generateMonthlyReport('PDF')} disabled={!!generatingReport} style={{backgroundColor:generatingReport==='pdf'?'#94a3b8':'#dc2626',color:'white',border:'none',borderRadius:8,padding:'9px 18px',fontWeight:700,cursor:generatingReport?'not-allowed':'pointer',fontSize:13}}>{generatingReport==='pdf'?'⏳ Generating…':'📄 PDF'}</button>
              <button onClick={()=>generateMonthlyReport('DOCX')} disabled={!!generatingReport} style={{backgroundColor:generatingReport==='docx'?'#94a3b8':'#1d4ed8',color:'white',border:'none',borderRadius:8,padding:'9px 18px',fontWeight:700,cursor:generatingReport?'not-allowed':'pointer',fontSize:13}}>{generatingReport==='docx'?'⏳ Generating…':'📝 DOCX'}</button>
              <button onClick={()=>generateMonthlyReport('Excel')} disabled={!!generatingReport} style={{backgroundColor:generatingReport==='excel'?'#94a3b8':'#16a34a',color:'white',border:'none',borderRadius:8,padding:'9px 18px',fontWeight:700,cursor:generatingReport?'not-allowed':'pointer',fontSize:13}}>{generatingReport==='excel'?'⏳ Generating…':'📊 Excel'}</button>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginTop:8}}>
            <div style={{backgroundColor:'#dcfce7',borderRadius:8,padding:'10px 14px',borderLeft:'3px solid #16a34a'}}>
              <p style={{fontSize:11,color:'#16a34a',fontWeight:600,margin:'0 0 2px'}}>Income</p>
              <p style={{fontSize:16,fontWeight:800,color:'#16a34a',margin:0}}>{fmt(monthlyRptTotals.income)}</p>
            </div>
            <div style={{backgroundColor:'#fee2e2',borderRadius:8,padding:'10px 14px',borderLeft:'3px solid #dc2626'}}>
              <p style={{fontSize:11,color:'#dc2626',fontWeight:600,margin:'0 0 2px'}}>Expense</p>
              <p style={{fontSize:16,fontWeight:800,color:'#dc2626',margin:0}}>{fmt(monthlyRptTotals.expense)}</p>
            </div>
            <div style={{backgroundColor:'#eff6ff',borderRadius:8,padding:'10px 14px',borderLeft:'3px solid #1e3a5f'}}>
              <p style={{fontSize:11,color:'#1e3a5f',fontWeight:600,margin:'0 0 2px'}}>Net</p>
              <p style={{fontSize:16,fontWeight:800,color:'#1e3a5f',margin:0}}>{fmt(monthlyRptTotals.net)}</p>
            </div>
          </div>
        </div>

        {/* ── Weekly Report for Admin's PA — one-click, always last 7 days ── */}
        <div style={{backgroundColor:'white',borderRadius:12,padding: isMobile ? 14 : 20,marginBottom:16,boxShadow:'0 2px 8px rgba(0,0,0,0.06)',borderLeft:'4px solid #831843'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10,flexWrap:'wrap',gap:10}}>
            <div>
              <h3 style={{...chartTitle,fontSize:15,margin:0}}>🗓️ Weekly Report — for Admin's PA</h3>
              <p style={{fontSize:12,color:'#94a3b8',margin:'4px 0 0'}}>{weeklyRange.from} to {weeklyRange.to} · {weeklyTotals.count} entries · always the last 7 days, no filters needed</p>
            </div>
            <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
              <button onClick={printWeeklyReport} style={{backgroundColor:'rgba(131,24,67,0.08)',color:'#831843',border:'1px solid #fbcfe8',borderRadius:8,padding:'8px 12px',fontWeight:600,cursor:'pointer',fontSize:12}}>🖨 Print</button>
              <button onClick={()=>generateWeeklyReport('PDF')} disabled={!!generatingReport} style={{backgroundColor:generatingReport==='pdf'?'#94a3b8':'#dc2626',color:'white',border:'none',borderRadius:8,padding:'9px 18px',fontWeight:700,cursor:generatingReport?'not-allowed':'pointer',fontSize:13}}>{generatingReport==='pdf'?'⏳ Generating…':'📄 PDF'}</button>
              <button onClick={()=>generateWeeklyReport('DOCX')} disabled={!!generatingReport} style={{backgroundColor:generatingReport==='docx'?'#94a3b8':'#1d4ed8',color:'white',border:'none',borderRadius:8,padding:'9px 18px',fontWeight:700,cursor:generatingReport?'not-allowed':'pointer',fontSize:13}}>{generatingReport==='docx'?'⏳ Generating…':'📝 DOCX'}</button>
              <button onClick={()=>generateWeeklyReport('Excel')} disabled={!!generatingReport} style={{backgroundColor:generatingReport==='excel'?'#94a3b8':'#16a34a',color:'white',border:'none',borderRadius:8,padding:'9px 18px',fontWeight:700,cursor:generatingReport?'not-allowed':'pointer',fontSize:13}}>{generatingReport==='excel'?'⏳ Generating…':'📊 Excel'}</button>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginTop:8}}>
            <div style={{backgroundColor:'#dcfce7',borderRadius:8,padding:'10px 14px',borderLeft:'3px solid #16a34a'}}>
              <p style={{fontSize:11,color:'#16a34a',fontWeight:600,margin:'0 0 2px'}}>Income (7 days)</p>
              <p style={{fontSize:16,fontWeight:800,color:'#16a34a',margin:0}}>{fmt(weeklyTotals.income)}</p>
            </div>
            <div style={{backgroundColor:'#fee2e2',borderRadius:8,padding:'10px 14px',borderLeft:'3px solid #dc2626'}}>
              <p style={{fontSize:11,color:'#dc2626',fontWeight:600,margin:'0 0 2px'}}>Expense (7 days)</p>
              <p style={{fontSize:16,fontWeight:800,color:'#dc2626',margin:0}}>{fmt(weeklyTotals.expense)}</p>
            </div>
            <div style={{backgroundColor:'#eff6ff',borderRadius:8,padding:'10px 14px',borderLeft:'3px solid #1e3a5f'}}>
              <p style={{fontSize:11,color:'#1e3a5f',fontWeight:600,margin:'0 0 2px'}}>Net</p>
              <p style={{fontSize:16,fontWeight:800,color:'#1e3a5f',margin:0}}>{fmt(weeklyTotals.net)}</p>
            </div>
          </div>
        </div>

        {/* ── report type ── */}
        <div style={{backgroundColor:'white',borderRadius:12,padding: isMobile ? 14 : 20,marginBottom:16,boxShadow:'0 2px 8px rgba(0,0,0,0.06)'}}>
          <label style={lStyle}>Report Title</label>
          <select value={rptReportType} onChange={e=>setRptReportType(e.target.value)} style={{...iStyle,maxWidth: isMobile ? '100%' : 360,fontWeight:600}}>
            {REPORT_TYPES.map(t=><option key={t}>{t}</option>)}
          </select>

          {/* ── filters ── */}
          <div style={{display:'grid',gridTemplateColumns: isMobile ? '1fr 1fr' : isTablet ? 'repeat(3,1fr)' : 'repeat(5,1fr)',gap:12,marginTop:18}}>
            <div>
              <label style={lStyle}>Type</label>
              <select value={rptType} onChange={e=>{setRptType(e.target.value);setRptCategory('All')}} style={iStyle}>
                <option value="All">All (Income + Expense)</option>
                <option value="Income">Income only</option>
                <option value="Expense">Expense only</option>
              </select>
            </div>
            <div>
              <label style={lStyle}>Category</label>
              <select value={rptCategory} onChange={e=>setRptCategory(e.target.value)} style={iStyle}>
                <option value="All">All Categories</option>
                {rptCategoryOptions.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={lStyle}>Payment Mode</label>
              <select value={rptMode} onChange={e=>setRptMode(e.target.value)} style={iStyle}>
                <option value="All">All Modes</option>
                {PAYMENT_MODES.map(m=><option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={lStyle}>Account Type</label>
              <select value={rptAccount} onChange={e=>setRptAccount(e.target.value)} style={iStyle}>
                <option value="All">All Accounts</option>
                {ACCOUNT_TYPES.map(a=><option key={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label style={lStyle}>Status</label>
              <select value={rptStatus} onChange={e=>setRptStatus(e.target.value)} style={iStyle}>
                <option value="All">All Statuses</option>
                {STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={lStyle}>Voucher Head</label>
              <input type="text" placeholder="e.g. Sir Arunkumar" value={rptVoucherHead} onChange={e=>setRptVoucherHead(e.target.value)} style={iStyle}/>
            </div>
            <div>
              <label style={lStyle}>Search</label>
              <input type="text" placeholder="🔍 Category, note…" value={rptSearch} onChange={e=>setRptSearch(e.target.value)} style={iStyle}/>
            </div>
            <div>
              <label style={lStyle}>Date From</label>
              <input type="date" value={rptDateFrom} onChange={e=>{setRptDateFrom(e.target.value);setRptQuick('')}} style={iStyle}/>
            </div>
            <div>
              <label style={lStyle}>Date To</label>
              <input type="date" value={rptDateTo} onChange={e=>{setRptDateTo(e.target.value);setRptQuick('')}} style={iStyle}/>
            </div>
          </div>

          {/* ── quick range + reset ── */}
          <div style={{display:'flex',gap:8,marginTop:14,alignItems:'center',flexWrap:'wrap'}}>
            <span style={{fontSize:12,color:'#94a3b8',fontWeight:600}}>Quick:</span>
            {[['today','Today'],['week','Week'],['month','Month'],['lastmonth','Last Mo.'],['year','Year']].map(([k,l])=>(
              <button key={k} style={{padding: isMobile?'5px 10px':'5px 12px',borderRadius:6,border:'none',cursor:'pointer',fontSize:isMobile?11:12,fontWeight:600,backgroundColor:rptQuick===k?'#831843':'#f1f5f9',color:rptQuick===k?'white':'#64748b'}} onClick={()=>rptQuick===k?clearRptQuick():applyRptQuick(k)}>{l}</button>
            ))}
            <button onClick={resetRptFilters} style={{...smallBtn('#fee2e2','#dc2626'),padding:'5px 12px',fontSize:12}}>✖ Reset Filters</button>
          </div>
        </div>

        {/* ── live preview ── */}
        <div style={{display:'grid',gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)',gap: isMobile ? 10 : 14,marginBottom:16}}>
          <StatCard label="Income (matched)" value={reportTotals.income} color="#16a34a" bg="#dcfce7" icon="📈"/>
          <StatCard label="Expense (matched)" value={reportTotals.expense} color="#dc2626" bg="#fee2e2" icon="📉"/>
          <StatCard label="Net" value={reportTotals.net} color="#1e3a5f" bg="#eff6ff" icon="💼"/>
          <StatCard label="Entries Matched" value={reportTotals.count} color="#7c3aed" bg="#f3e8ff" icon="🧾" isCurrency={false}/>
        </div>

        {/* ── export actions ── */}
        <div style={{backgroundColor:'white',borderRadius:12,padding: isMobile ? 14 : 20,marginBottom:16,boxShadow:'0 2px 8px rgba(0,0,0,0.06)'}}>
          <p style={{fontSize:12,color:'#94a3b8',margin:'0 0 12px',fontWeight:600}}>EXPORT — every file includes the GNSI letterhead, applied filters, print date, and signature lines for "Prepared By" &amp; "Authorized Signature".</p>
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            <button onClick={()=>generateReportPDF()} disabled={!!generatingReport} style={{backgroundColor:generatingReport==='pdf'?'#94a3b8':'#dc2626',color:'white',border:'none',borderRadius:8,padding: isMobile ? '10px 16px' : '11px 22px',fontWeight:700,cursor:generatingReport?'not-allowed':'pointer',fontSize:13,flex: isMobile ? '1 1 100%' : 'none'}}>{generatingReport==='pdf'?'⏳ Generating…':'📄 Generate PDF'}</button>
            <button onClick={()=>generateReportDOCX()} disabled={!!generatingReport} style={{backgroundColor:generatingReport==='docx'?'#94a3b8':'#1d4ed8',color:'white',border:'none',borderRadius:8,padding: isMobile ? '10px 16px' : '11px 22px',fontWeight:700,cursor:generatingReport?'not-allowed':'pointer',fontSize:13,flex: isMobile ? '1 1 100%' : 'none'}}>{generatingReport==='docx'?'⏳ Generating…':'📝 Generate Word (DOCX)'}</button>
            <button onClick={()=>generateReportExcel()} disabled={!!generatingReport} style={{backgroundColor:generatingReport==='excel'?'#94a3b8':'#16a34a',color:'white',border:'none',borderRadius:8,padding: isMobile ? '10px 16px' : '11px 22px',fontWeight:700,cursor:generatingReport?'not-allowed':'pointer',fontSize:13,flex: isMobile ? '1 1 100%' : 'none'}}>{generatingReport==='excel'?'⏳ Generating…':'📊 Generate Excel'}</button>
          </div>
        </div>

        {/* ── preview table ── */}
        <div style={{backgroundColor:'white',borderRadius:12,padding: isMobile ? 14 : 20,boxShadow:'0 2px 8px rgba(0,0,0,0.06)',overflowX:'auto'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10,marginBottom:12}}>
            <h3 style={{...chartTitle,fontSize:15,margin:0}}>{rptViewMode==='datewise'?`Date-wise (${reportByDate.length} day${reportByDate.length===1?'':'s'})`:`Preview ${reportEntries.length>8?`(first 8 of ${reportEntries.length})`:`(${reportEntries.length} entries)`}`}</h3>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <div style={{display:'flex',borderRadius:8,overflow:'hidden',border:'1px solid #e5e7eb'}}>
                <button onClick={()=>setRptViewMode('list')} style={{padding:'6px 12px',fontSize:12,fontWeight:600,cursor:'pointer',border:'none',backgroundColor:rptViewMode==='list'?'#1e3a5f':'#f8fafc',color:rptViewMode==='list'?'white':'#64748b'}}>List</button>
                <button onClick={()=>setRptViewMode('datewise')} style={{padding:'6px 12px',fontSize:12,fontWeight:600,cursor:'pointer',border:'none',backgroundColor:rptViewMode==='datewise'?'#1e3a5f':'#f8fafc',color:rptViewMode==='datewise'?'white':'#64748b'}}>Date-wise</button>
              </div>
              {rptViewMode==='datewise'&&<button onClick={printDatewise} style={{backgroundColor:'#1e3a5f',color:'white',border:'none',borderRadius:8,padding:'6px 14px',fontWeight:600,cursor:'pointer',fontSize:12}}>🖨 Print</button>}
            </div>
          </div>

          {rptViewMode==='datewise'?(
            reportByDate.length===0?(
              <p style={{color:'#94a3b8',textAlign:'center',padding:24}}>No entries match the selected filters.</p>
            ):(
              <table style={{width:'100%',borderCollapse:'collapse',fontSize: isMobile ? 12 : 13}}>
                <thead><tr style={{backgroundColor:'#f8fafc'}}>{['Date','Income','Expense','Net',''].map(h=><th key={h} style={{padding:'10px 12px',textAlign:'left',fontWeight:600,color:'#374151',fontSize:12,borderBottom:'1px solid #e2e8f0'}}>{h}</th>)}</tr></thead>
                <tbody>
                  {reportByDate.map(d=>{
                    const net=d.income-d.expense, expanded=rptExpandedDate===d.date
                    return (
                      <Fragment key={d.date}>
                        <tr onClick={()=>setRptExpandedDate(expanded?null:d.date)} style={{borderBottom:'1px solid #f1f5f9',cursor:'pointer',backgroundColor:expanded?'#f8fafc':'transparent'}}>
                          <td style={{...tdS,color:'#1e293b',fontWeight:600}}>{expanded?'▾':'▸'} {d.date}</td>
                          <td style={{...tdS,fontWeight:700,color:'#16a34a'}}>{fmt(d.income)}</td>
                          <td style={{...tdS,fontWeight:700,color:'#dc2626'}}>{fmt(d.expense)}</td>
                          <td style={{...tdS,fontWeight:700,color:net>=0?'#16a34a':'#dc2626'}}>{fmt(net)}</td>
                          <td style={{...tdS,color:'#94a3b8',fontSize:11}}>{d.entries.length} entr{d.entries.length===1?'y':'ies'}</td>
                        </tr>
                        {expanded&&d.entries.map((e,i)=>(
                          <tr key={i} style={{borderBottom:'1px solid #f1f5f9',backgroundColor:'#fafbfc'}}>
                            <td style={{...tdS,paddingLeft:28,fontSize:12}} colSpan={2}>{e.category}{e.note?` — ${e.note}`:''}</td>
                            <td style={{...tdS,fontSize:12}}>{e.payment_mode}</td>
                            <td colSpan={2} style={{...tdS,textAlign:'right',fontWeight:600,fontSize:12,color:e.type==='Income'?'#16a34a':'#dc2626'}}>{fmt(e.amount)}</td>
                          </tr>
                        ))}
                      </Fragment>
                    )
                  })}
                  <tr style={{borderTop:'2px solid #1e3a5f'}}>
                    <td style={{...tdS,fontWeight:800,color:'#1e293b'}}>Total</td>
                    <td style={{...tdS,fontWeight:800,color:'#16a34a'}}>{fmt(reportTotals.income)}</td>
                    <td style={{...tdS,fontWeight:800,color:'#dc2626'}}>{fmt(reportTotals.expense)}</td>
                    <td style={{...tdS,fontWeight:800,color:reportTotals.net>=0?'#16a34a':'#dc2626'}}>{fmt(reportTotals.net)}</td>
                    <td/>
                  </tr>
                </tbody>
              </table>
            )
          ):(
          reportEntries.length===0?(
            <p style={{color:'#94a3b8',textAlign:'center',padding:24}}>No entries match the selected filters.</p>
          ):(
            <table style={{width:'100%',borderCollapse:'collapse',fontSize: isMobile ? 12 : 13}}>
              <thead><tr style={{backgroundColor:'#f8fafc'}}>{['Date','Type','Category','Account','Mode','Voucher Head','Status','Amount'].map(h=><th key={h} style={{padding:'10px 12px',textAlign:'left',fontWeight:600,color:'#374151',fontSize:12,borderBottom:'1px solid #e2e8f0'}}>{h}</th>)}</tr></thead>
              <tbody>
                {reportEntries.slice(0,8).map((e,i)=>(
                  <tr key={i} style={{borderBottom:'1px solid #f1f5f9'}}>
                    <td style={tdS}>{e.entry_date}</td>
                    <td style={tdS}><span style={{padding:'2px 8px',borderRadius:999,fontSize:11,fontWeight:600,backgroundColor:e.type==='Income'?'#dcfce7':'#fee2e2',color:e.type==='Income'?'#16a34a':'#dc2626'}}>{e.type}</span></td>
                    <td style={{...tdS,color:'#1e293b',fontWeight:500}}>{e.category}</td>
                    <td style={tdS}>{e.account_type||'Cash A/c'}</td>
                    <td style={tdS}>{e.payment_mode}</td>
                    <td style={tdS}>{e.voucher_head||'-'}</td>
                    <td style={tdS}>{e.status||'Confirmed'}</td>
                    <td style={{...tdS,fontWeight:700,color:e.type==='Income'?'#16a34a':'#dc2626'}}>{fmt(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
          )}
        </div>
      </div>
    )}

    {/* ══ TAB: ANALYTICS ══ */}
    {activeTab==='analytics'&&(
      <div>
        <div style={{backgroundColor:'#eff6ff',borderRadius:12,padding: isMobile ? 14 : 20,marginBottom:24,borderLeft:'4px solid #1e3a5f'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:insights?12:0,flexWrap:'wrap',gap:10}}>
            <h3 style={{fontSize: isMobile ? 14 : 16,fontWeight:600,color:'#1e3a5f',margin:0}}>🤖 AI Financial Insights</h3>
            <button onClick={getInsights} disabled={loadingAI} style={{backgroundColor:'#1e3a5f',color:'white',border:'none',borderRadius:8,padding:'8px 16px',fontWeight:600,cursor:loadingAI?'not-allowed':'pointer',fontSize:13}}>{loadingAI?'⏳ Analysing…':'✨ Get Insights'}</button>
          </div>
          {insights&&<div style={{fontSize:14,color:'#1e3a5f',lineHeight:1.7,whiteSpace:'pre-wrap'}}>{insights}</div>}
        </div>
        <div style={{display:'grid',gridTemplateColumns:chartGridCols,gap:20,marginBottom:20}}>
          <div style={chartCard}><h3 style={chartTitle}>Monthly Income vs Expense</h3><ResponsiveContainer width="100%" height={isMobile?200:250}><BarChart data={monthlyData}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/><XAxis dataKey="month" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`}/><Tooltip formatter={v=>fmt(v)}/><Legend/><Bar dataKey="Income" fill="#16a34a" radius={[4,4,0,0]}/><Bar dataKey="Expense" fill="#dc2626" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>
          <div style={chartCard}><h3 style={chartTitle}>Net Balance Trend</h3><ResponsiveContainer width="100%" height={isMobile?200:250}><LineChart data={monthlyData.map(m=>({...m,Net:m.Income-m.Expense}))}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/><XAxis dataKey="month" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`}/><Tooltip formatter={v=>fmt(v)}/><Line dataKey="Net" stroke="#1e3a5f" strokeWidth={2} dot={{r:4}}/></LineChart></ResponsiveContainer></div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:chartGridCols,gap:20,marginBottom:20}}>
          <div style={chartCard}><h3 style={chartTitle}>Top Categories</h3><ResponsiveContainer width="100%" height={isMobile?200:250}><PieChart><Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={isMobile?70:90} label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>{categoryData.map((_,idx)=><Cell key={idx} fill={CHART_COLORS[idx%CHART_COLORS.length]}/>)}</Pie><Tooltip formatter={v=>fmt(v)}/></PieChart></ResponsiveContainer></div>
          <div style={chartCard}><h3 style={chartTitle}>Payment Mode</h3><ResponsiveContainer width="100%" height={isMobile?200:250}><PieChart><Pie data={modeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={isMobile?70:90} label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>{modeData.map((_,idx)=><Cell key={idx} fill={CHART_COLORS[(idx+4)%CHART_COLORS.length]}/>)}</Pie><Tooltip formatter={v=>fmt(v)}/></PieChart></ResponsiveContainer></div>
        </div>
        {(()=>{
          const thisMonthLabel=new Date(`${today.slice(0,7)}-01`).toLocaleDateString('en-IN',{month:'long',year:'numeric'})
          const lastMonthDate=(()=>{const [y,m]=today.slice(0,7).split('-').map(Number);return new Date(y,m-2,1)})()
          const lastMonthLabel=lastMonthDate.toLocaleDateString('en-IN',{month:'long',year:'numeric'})
          const rows=[...INCOME_CATEGORIES.map(cat=>({cat,type:'Income',thisVal:plData.thisInc[cat]||0,prevVal:plData.prevInc[cat]||0})),...EXPENSE_CATEGORIES.map(cat=>({cat,type:'Expense',thisVal:plData.thisExp[cat]||0,prevVal:plData.prevExp[cat]||0}))].filter(r=>r.thisVal>0||r.prevVal>0)
          const incomeRows=rows.filter(r=>r.type==='Income').sort((a,b)=>b.thisVal-a.thisVal)
          const expenseRows=rows.filter(r=>r.type==='Expense').sort((a,b)=>b.thisVal-a.thisVal)
          const netThis=plData.totalThisInc-plData.totalThisExp,netPrev=plData.totalPrevInc-plData.totalPrevExp
          const netDiff=netThis-netPrev,netPct=netPrev!==0?((netDiff/Math.abs(netPrev))*100):null
          const marginThis=plData.totalThisInc>0?(netThis/plData.totalThisInc)*100:0
          const marginPrev=plData.totalPrevInc>0?(netPrev/plData.totalPrevInc)*100:0
          const maxVal=Math.max(...rows.map(r=>Math.max(r.thisVal,r.prevVal)),1)

          const Section=({label,sectionRows,totalThis,totalPrev,accent,icon})=>(
            <div style={{marginBottom:22}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,paddingBottom:8,borderBottom:`2px solid ${accent}22`}}>
                <span style={{fontSize:15}}>{icon}</span>
                <h4 style={{fontSize:13,fontWeight:800,color:accent,margin:0,textTransform:'uppercase',letterSpacing:'0.4px'}}>{label}</h4>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:2}}>
                {sectionRows.map(({cat,thisVal,prevVal})=>{
                  const diff=thisVal-prevVal
                  const pct=prevVal>0?((diff/prevVal)*100):(thisVal>0?100:0)
                  const hasHistory=prevVal>0||thisVal>0
                  const trendUp=diff>0,trendFlat=diff===0
                  // For expense categories a rise is unfavorable (shown red); for income a rise is favorable (green) — flip the color logic by section.
                  const favorable=label==='Income'?diff>=0:diff<=0
                  return(
                    <div key={cat} style={{display:'grid',gridTemplateColumns: isMobile?'1fr':'1.4fr 100px 100px 90px 70px',gap: isMobile?6:14,alignItems:'center',padding:'9px 10px',borderRadius:8,transition:'background-color 0.15s ease'}}>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:600,color:'#1e293b',marginBottom:4}}>{cat}</div>
                        <div style={{height:4,borderRadius:999,backgroundColor:'#f1f5f9',overflow:'hidden',maxWidth:220}}>
                          <div style={{height:'100%',width:`${Math.max((thisVal/maxVal)*100,thisVal>0?2:0)}%`,borderRadius:999,backgroundColor:accent,transition:'width 0.3s ease'}}/>
                        </div>
                      </div>
                      <div style={{textAlign: isMobile?'left':'right',fontSize:13,fontWeight:700,color:accent}}>{fmt(thisVal)}</div>
                      <div style={{textAlign: isMobile?'left':'right',fontSize:12,color:'#94a3b8'}}>{fmt(prevVal)}</div>
                      <div style={{textAlign: isMobile?'left':'right',fontSize:12,fontWeight:700,color:hasHistory?(favorable?'#16a34a':'#dc2626'):'#94a3b8'}}>{diff>=0?'+':''}{fmt(diff)}</div>
                      <div style={{display:'flex',alignItems:'center',gap:3,justifyContent: isMobile?'flex-start':'flex-end',fontSize:12,fontWeight:800,color:!hasHistory||prevVal===0?'#94a3b8':(favorable?'#16a34a':'#dc2626')}}>
                        {prevVal>0&&!trendFlat&&(trendUp?'▲':'▼')}
                        {prevVal>0?`${Math.abs(pct).toFixed(1)}%`:'—'}
                      </div>
                    </div>
                  )
                })}
                <div style={{display:'grid',gridTemplateColumns: isMobile?'1fr':'1.4fr 100px 100px 90px 70px',gap: isMobile?6:14,alignItems:'center',padding:'10px',marginTop:4,backgroundColor:`${accent}0d`,borderRadius:8}}>
                  <div style={{fontSize:12,fontWeight:800,color:accent,textTransform:'uppercase',letterSpacing:'0.3px'}}>Total {label}</div>
                  <div style={{textAlign: isMobile?'left':'right',fontSize:14,fontWeight:800,color:accent}}>{fmt(totalThis)}</div>
                  <div style={{textAlign: isMobile?'left':'right',fontSize:12,fontWeight:700,color:'#64748b'}}>{fmt(totalPrev)}</div>
                  <div style={{textAlign: isMobile?'left':'right',fontSize:12,fontWeight:800,color:(label==='Income'?totalThis>=totalPrev:totalThis<=totalPrev)?'#16a34a':'#dc2626'}}>{totalThis-totalPrev>=0?'+':''}{fmt(totalThis-totalPrev)}</div>
                  <div/>
                </div>
              </div>
            </div>
          )

          return(
          <div style={{...chartCard,marginBottom:20}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems: isMobile?'flex-start':'center',flexDirection: isMobile?'column':'row',gap:10,marginBottom:6}}>
              <div>
                <h3 style={{...chartTitle,marginBottom:3}}>📑 Profit &amp; Loss Statement</h3>
                <p style={{fontSize:12,color:'#94a3b8',margin:0}}>{thisMonthLabel} vs {lastMonthLabel} — by category</p>
              </div>
              <div style={{display:'flex',gap:8}}>
                <span style={{padding:'4px 12px',borderRadius:999,fontSize:11,fontWeight:700,backgroundColor:'#eff6ff',color:'#1e3a5f'}}>{thisMonthLabel}</span>
                <span style={{padding:'4px 12px',borderRadius:999,fontSize:11,fontWeight:700,backgroundColor:'#f8fafc',color:'#94a3b8'}}>{lastMonthLabel}</span>
              </div>
            </div>

            {!isMobile&&(
              <div style={{display:'grid',gridTemplateColumns:'1.4fr 100px 100px 90px 70px',gap:14,padding:'14px 10px 8px',fontSize:11,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.3px',borderBottom:'1px solid #f1f5f9',marginBottom:8}}>
                <div>Category</div>
                <div style={{textAlign:'right'}}>This Month</div>
                <div style={{textAlign:'right'}}>Last Month</div>
                <div style={{textAlign:'right'}}>Change</div>
                <div style={{textAlign:'right'}}>Variance</div>
              </div>
            )}

            <Section label="Income" sectionRows={incomeRows} totalThis={plData.totalThisInc} totalPrev={plData.totalPrevInc} accent="#16a34a" icon="💰"/>
            <Section label="Expense" sectionRows={expenseRows} totalThis={plData.totalThisExp} totalPrev={plData.totalPrevExp} accent="#dc2626" icon="💸"/>

            {/* ── Net result — headline card ── */}
            <div style={{marginTop:8,padding: isMobile?16:20,borderRadius:12,background:netThis>=0?'linear-gradient(135deg,#0f3d2e,#16653f)':'linear-gradient(135deg,#5c1414,#7f1d1d)',color:'white'}}>
              <div style={{display:'grid',gridTemplateColumns: isMobile?'1fr 1fr':'repeat(4,1fr)',gap: isMobile?14:20}}>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.65)',textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:4}}>Net — {thisMonthLabel}</div>
                  <div style={{fontSize: isMobile?18:22,fontWeight:800}}>{fmt(netThis)}</div>
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.65)',textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:4}}>Net — {lastMonthLabel}</div>
                  <div style={{fontSize: isMobile?18:22,fontWeight:800,color:'rgba(255,255,255,0.85)'}}>{fmt(netPrev)}</div>
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.65)',textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:4}}>Change</div>
                  <div style={{fontSize: isMobile?18:22,fontWeight:800}}>{netDiff>=0?'+':''}{fmt(netDiff)}{netPct!==null&&<span style={{fontSize:13,fontWeight:700,marginLeft:6,opacity:0.85}}>({netDiff>=0?'+':''}{netPct.toFixed(1)}%)</span>}</div>
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.65)',textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:4}}>Net Margin</div>
                  <div style={{fontSize: isMobile?18:22,fontWeight:800}}>{marginThis.toFixed(1)}%<span style={{fontSize:13,fontWeight:700,marginLeft:6,opacity:0.75}}>(was {marginPrev.toFixed(1)}%)</span></div>
                </div>
              </div>
            </div>
          </div>
          )
        })()}
      </div>
    )}

    {/* ══ TAB: BUDGETS ══ */}
    {activeTab==='budgets'&&(
      <div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,flexWrap:'wrap',gap:10}}>
          <div>
            <p style={{color:'#64748b',fontSize:14,margin:0}}>Monthly budget limits per expense category</p>
            {budgetMeta?.edited_by&&<p style={{fontSize:11,color:'#f59e0b',margin:'4px 0 0',fontWeight:600}}>✎ Last edited by <strong>{budgetMeta.edited_by}</strong></p>}
          </div>
          {!editBudgets?canWrite&&<button onClick={()=>{setEditBudgets(true);setBudgetDraft(budgets)}} style={{backgroundColor:'#1e3a5f',color:'white',border:'none',borderRadius:8,padding:'8px 16px',fontWeight:600,cursor:'pointer',fontSize:13}}>✏️ Edit Budgets</button>
          :<div style={{display:'flex',gap:10,flexWrap:'wrap'}}><button onClick={saveBudgets} style={{backgroundColor:'#16a34a',color:'white',border:'none',borderRadius:8,padding:'8px 16px',fontWeight:600,cursor:'pointer',fontSize:13}}>✅ Save</button><button onClick={()=>setEditBudgets(false)} style={{backgroundColor:'#f1f5f9',color:'#64748b',border:'none',borderRadius:8,padding:'8px 16px',fontWeight:600,cursor:'pointer',fontSize:13}}>Cancel</button></div>}
        </div>
        <div style={{display:'grid',gridTemplateColumns:budgetGridCols,gap:16,marginBottom:28}}>
          {EXPENSE_CATEGORIES.map(cat=>{const limit=Number(budgets[cat])||0,spent=monthlyExpenses[cat]||0,pct=limit>0?Math.min((spent/limit)*100,100):0,over=limit>0&&spent>limit,barColor=over?'#dc2626':pct>75?'#f59e0b':'#16a34a';const catEntries=monthlyExpensesByCategory[cat]||[];const isExpanded=expandedBudgetCat===cat;return(
            <div key={cat} style={{backgroundColor:'white',borderRadius:12,padding:18,boxShadow:'0 2px 8px rgba(0,0,0,0.06)',borderLeft:`4px solid ${over?'#dc2626':'#e2e8f0'}`}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}><span style={{fontWeight:600,color:'#1e293b'}}>{cat}</span>{over&&<span style={{fontSize:12,color:'#dc2626',fontWeight:600}}>⚠️ Over!</span>}</div>
              {editBudgets&&canWrite&&<input type="number" min="0" value={budgetDraft[cat]||''} placeholder="Set budget limit" onChange={e=>setBudgetDraft({...budgetDraft,[cat]:e.target.value})} style={{...iStyle,marginBottom:10}}/>}
              <div style={{display:'flex',justifyContent:'space-between',fontSize:13,color:'#64748b',marginBottom:6}}><span>Spent: <strong style={{color:over?'#dc2626':'#1e293b'}}>{fmt(spent)}</strong></span><span>Limit: <strong>{limit>0?fmt(limit):'Not set'}</strong></span></div>
              {limit>0&&<><div style={{backgroundColor:'#f1f5f9',borderRadius:999,height:8,overflow:'hidden'}}><div style={{width:`${pct}%`,height:'100%',backgroundColor:barColor,borderRadius:999,transition:'width .4s'}}/></div><div style={{fontSize:11,color:'#94a3b8',marginTop:4}}>{pct.toFixed(0)}% used</div></>}
              <button onClick={()=>setExpandedBudgetCat(isExpanded?null:cat)} style={{marginTop:12,width:'100%',backgroundColor:isExpanded?'#eff6ff':'#f8fafc',color:'#1e3a5f',border:'1px solid #e2e8f0',borderRadius:8,padding:'7px 10px',fontSize:12,fontWeight:600,cursor:'pointer'}}>
                {isExpanded?'▲ Hide entries':`▼ Where it was spent (${catEntries.length})`}
              </button>
              {isExpanded&&(
                <div style={{marginTop:10,maxHeight:220,overflowY:'auto',borderTop:'1px solid #f1f5f9',paddingTop:8}}>
                  {catEntries.length===0?(
                    <p style={{fontSize:12,color:'#94a3b8',textAlign:'center',padding:'8px 0'}}>No expense entries for {cat} this month.</p>
                  ):(
                    catEntries.map(e=>(
                      <div key={e.id} style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8,padding:'7px 0',borderBottom:'1px solid #f8fafc'}}>
                        <div style={{minWidth:0}}>
                          <p style={{margin:0,fontSize:12.5,fontWeight:600,color:'#1e293b',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{e.note||e.voucher_head||'—'}</p>
                          <p style={{margin:'2px 0 0',fontSize:11,color:'#94a3b8'}}>{e.entry_date} · {e.payment_mode}{e.account_type?` · ${e.account_type}`:''}</p>
                        </div>
                        <span style={{fontSize:12.5,fontWeight:700,color:'#dc2626',flexShrink:0}}>{fmt(e.amount)}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )})}
        </div>
        <div style={chartCard}>
          <h3 style={chartTitle}>Budget vs Actual — Last 6 Months</h3>
          <ResponsiveContainer width="100%" height={isMobile?200:280}><BarChart data={budgetChartData} barCategoryGap="20%"><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/><XAxis dataKey="month" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`}/><Tooltip formatter={v=>fmt(v)}/><Legend/>{EXPENSE_CATEGORIES.filter(cat=>Number(budgets[cat])>0).map((cat,idx)=><Bar key={cat} dataKey={cat} fill={CHART_COLORS[idx%CHART_COLORS.length]} radius={[3,3,0,0]}/>)}</BarChart></ResponsiveContainer>
          {EXPENSE_CATEGORIES.filter(cat=>Number(budgets[cat])>0).length===0&&<p style={{textAlign:'center',color:'#94a3b8',fontSize:14,padding:32}}>Set budget limits above to see this chart</p>}
        </div>
      </div>
    )}

    {/* ══ TAB: FRAUD WATCH (admin only) ══ */}
    {activeTab==='fraud'&&isAdmin&&(
      <div>
        {/* ══ For Admin: what needs your attention right now ══ */}
        <div style={{backgroundColor:'#1e293b',borderRadius:12,padding: isMobile ? '16px' : '20px 24px',marginBottom:20}}>
          <h2 style={{fontSize: isMobile ? 15 : 18,fontWeight:800,color:'white',margin:0}}>📌 For Admin — Today's Digest</h2>
          <p style={{fontSize:12,color:'rgba(255,255,255,0.6)',margin:'4px 0 0'}}>Everything across the portal that needs your attention, in one glance — no need to check every tab.</p>
        </div>
        <div style={{...chartCard,marginBottom:24}}>
          {digestItems.length===0?(
            <div style={{textAlign:'center',padding:32,color:'#16a34a'}}>
              <div style={{fontSize:32,marginBottom:8}}>✅</div>
              <p style={{fontSize:14,fontWeight:600,margin:0}}>Nothing needs your attention right now.</p>
            </div>
          ):(
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {digestItems.map((item,i)=>{
                const sevColor={high:'#dc2626',medium:'#d97706',low:'#64748b'}[item.severity]
                const sevBg={high:'#fee2e2',medium:'#fef3c7',low:'#f1f5f9'}[item.severity]
                return(
                  <div key={i} onClick={()=>setActiveTab(item.tab)} style={{display:'flex',gap:12,alignItems:'flex-start',padding:'12px 14px',backgroundColor:sevBg,borderRadius:10,borderLeft:`4px solid ${sevColor}`,cursor:'pointer'}}>
                    <span style={{fontSize:20,flexShrink:0}}>{item.icon}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{margin:0,fontSize:13,fontWeight:700,color:'#1e293b'}}>{item.title}</p>
                      <p style={{margin:'2px 0 0',fontSize:12,color:'#64748b'}}>{item.detail}</p>
                    </div>
                    <span style={{fontSize:11,fontWeight:700,color:sevColor,textTransform:'uppercase',flexShrink:0,paddingTop:2}}>{item.severity}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div style={{display:'grid',gridTemplateColumns:fraudGridCols,gap: isMobile ? 10 : 14,marginBottom:24}}>
          {[{label:'High Risk',value:fraudSummary.high||0,color:'#dc2626',bg:'#fee2e2',icon:'🚨'},{label:'Medium Risk',value:fraudSummary.medium||0,color:'#d97706',bg:'#fef3c7',icon:'⚠️'},{label:'Deleted Today',value:fraudSummary.phantoms?.length||0,color:'#7c3aed',bg:'#f3e8ff',icon:'👻'},{label:'CSV Exports',value:exportLog.length,color:'#1e3a5f',bg:'#eff6ff',icon:'📤'}].map(c=>(
            <div key={c.label} style={{backgroundColor:c.bg,borderRadius:12,padding:16,borderLeft:`4px solid ${c.color}`}}>
              <div style={{fontSize:20,marginBottom:4}}>{c.icon}</div>
              <p style={{fontSize:12,color:c.color,fontWeight:600,margin:0}}>{c.label}</p>
              <h2 style={{fontSize:28,fontWeight:'bold',color:c.color,margin:'4px 0 0'}}>{c.value}</h2>
            </div>
          ))}
        </div>
        <div style={{...chartCard,marginBottom:20,borderLeft:'4px solid #d97706',overflowX:'auto'}}>
          <h3 style={{...chartTitle,color:'#d97706'}}>🛡️ Superintendent Edits — Pending Verification</h3>
          <p style={{fontSize:12,color:'#94a3b8',margin:'-8px 0 12px'}}>Superintendent role can edit existing entries only (no add/delete). Every such edit is logged here permanently; mark it Verified once you've reviewed it.</p>
          {superintendentFlags.filter(f=>!f.verified).length===0?<p style={{color:'#94a3b8',fontSize:14}}>No pending superintendent edits.</p>:(
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead><tr style={{backgroundColor:'#fffbeb'}}>{['Edited At','Edited By','Entry ID','Old Amount','New Amount','Reason','Verify'].map(h=><th key={h} style={{padding:'10px 12px',textAlign:'left',fontWeight:600,color:'#92400e',fontSize:12,borderBottom:'1px solid #fde68a'}}>{h}</th>)}</tr></thead>
              <tbody>{superintendentFlags.filter(f=>!f.verified).map(f=>(<tr key={f.id} style={{borderBottom:'1px solid #fffbeb'}}>
                <td style={tdS}>{f.edited_at?new Date(f.edited_at).toLocaleString('en-IN'):''}</td>
                <td style={tdS}><strong>{f.edited_by}</strong></td>
                <td style={{...tdS,fontSize:11,color:'#94a3b8'}}>{f.entry_id}</td>
                <td style={{...tdS,color:'#94a3b8'}}>{f.old_values?.amount!=null?fmt(f.old_values.amount):'-'}</td>
                <td style={{...tdS,fontWeight:600}}>{f.new_values?.amount!=null?fmt(f.new_values.amount):'-'}</td>
                <td style={{...tdS,maxWidth:220,whiteSpace:'normal'}}>{f.reason||<span style={{color:'#cbd5e1'}}>—</span>}</td>
                <td style={tdS}><button onClick={async()=>{
                  const ok=await mutateAccountsTable(
                    ()=>supabase.from('superintendent_edit_flags').update({verified:true,verified_by:role,verified_at:new Date().toISOString()}).eq('id',f.id),
                    {errorContext:'Mark verified'}
                  )
                  if(ok)fetchSuperintendentFlags()
                }} style={{...smallBtn('#f0fdf4','#16a34a'),fontSize:12}}>✓ Verified</button></td>
              </tr>))}</tbody>
            </table>
          )}
        </div>
        <div style={{...chartCard,marginBottom:20,borderLeft:'4px solid #dc2626',overflowX:'auto'}}>
          <h3 style={{...chartTitle,color:'#dc2626'}}>🚨 Flagged Transactions</h3>
          {(fraudSummary.flaggedEntries||[]).length===0?<p style={{color:'#94a3b8',fontSize:14}}>No flagged transactions.</p>:(
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead><tr style={{backgroundColor:'#fef2f2'}}>{['Date','Type','Category','Amount','Added by','Flags'].map(h=><th key={h} style={{padding:'10px 12px',textAlign:'left',fontWeight:600,color:'#991b1b',fontSize:12,borderBottom:'1px solid #fecaca'}}>{h}</th>)}</tr></thead>
              <tbody>{(fraudSummary.flaggedEntries||[]).map(item=>(<tr key={item.id} style={{borderBottom:'1px solid #fff1f2'}}>
                <td style={tdS}>{item.entry_date}</td>
                <td style={tdS}><span style={{padding:'2px 8px',borderRadius:999,fontSize:11,fontWeight:600,backgroundColor:item.type==='Income'?'#dcfce7':'#fee2e2',color:item.type==='Income'?'#16a34a':'#dc2626'}}>{item.type}</span></td>
                <td style={{...tdS,fontWeight:500}}>{item.category}</td>
                <td style={{...tdS,fontWeight:600,color:item.type==='Income'?'#16a34a':'#dc2626'}}>{fmt(item.amount)}</td>
                <td style={tdS}>{item.added_by||item.edited_by||'admin'}</td>
                {/* PHASE 3 FIX: resolve button on each fraud flag */}
                <td style={tdS}><div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                  {(fraudFlags[item.id]||[]).map((f,i)=>(
                    <span key={i} style={{display:'flex',alignItems:'center',gap:4}}>
                      <span style={{fontSize:11,color:'#374151'}}>{f.label}</span>
                      <SeverityBadge severity={f.severity}/>
                      {f.alertId&&<button onClick={async()=>{
                        const ok=await mutateAccountsTable(
                          ()=>supabase.from('fraud_alerts').update({resolved:true,resolved_by:role,resolved_at:new Date().toISOString()}).eq('id',f.alertId),
                          {errorContext:'Resolve fraud flag'}
                        )
                        if(ok)fetchEntries()
                      }} style={{...smallBtn('#f0fdf4','#16a34a'),fontSize:10,padding:'1px 6px'}}>✓</button>}
                    </span>
                  ))}
                </div></td>
              </tr>))}</tbody>
            </table>
          )}
        </div>
        <div style={{...chartCard,marginBottom:20,borderLeft:'4px solid #7c3aed',overflowX:'auto'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:8}}>
            <h3 style={{...chartTitle,color:'#7c3aed',margin:0}}>👻 Deleted Entries</h3>
            <button onClick={fetchDeletedRows} style={{...smallBtn('#f3e8ff','#7c3aed'),fontSize:12}}>↻ Refresh</button>
          </div>
          {deletedRows.length===0?<p style={{color:'#94a3b8',fontSize:14}}>No deleted entries.</p>:(
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead><tr style={{backgroundColor:'#faf5ff'}}>{['Date','Type','Category','Amount','Deleted by','Deleted at','Restore','Purge'].map(h=><th key={h} style={{padding:'10px 12px',textAlign:'left',fontWeight:600,color:'#6d28d9',fontSize:12,borderBottom:'1px solid #e9d5ff'}}>{h}</th>)}</tr></thead>
              <tbody>{deletedRows.map(item=>(<tr key={item.id} style={{borderBottom:'1px solid #faf5ff'}}>
                <td style={tdS}>{item.entry_date}</td>
                <td style={tdS}><span style={{padding:'2px 8px',borderRadius:999,fontSize:11,fontWeight:600,backgroundColor:item.type==='Income'?'#dcfce7':'#fee2e2',color:item.type==='Income'?'#16a34a':'#dc2626'}}>{item.type}</span></td>
                <td style={{...tdS,fontWeight:500}}>{item.category}</td>
                <td style={{...tdS,fontWeight:600,color:item.type==='Income'?'#16a34a':'#dc2626'}}>{fmt(item.amount)}</td>
                <td style={{...tdS,color:'#7c3aed',fontWeight:600}}>{item.deleted_by||'—'}</td>
                <td style={tdS}>{item.deleted_at?new Date(item.deleted_at).toLocaleString('en-IN'):'—'}</td>
                <td style={tdS}><button onClick={()=>handleRestore(item.id)} style={smallBtn('#f0fdf4','#16a34a')}>↩ Restore</button></td>
                <td style={tdS}><button onClick={()=>handlePermanentDelete(item.id)} style={smallBtn('#fee2e2','#dc2626')} title="Permanently delete — cannot be undone">🗑 Purge</button></td>
              </tr>))}</tbody>
            </table>
          )}
        </div>
        <div style={{...chartCard,borderLeft:'4px solid #be185d',overflowX:'auto'}}>
          <h3 style={{...chartTitle,color:'#be185d'}}>📤 CSV Export Activity</h3>
          {exportLog.length===0?<p style={{color:'#94a3b8',fontSize:14}}>No exports recorded.</p>:(
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead><tr style={{backgroundColor:'#fdf2f8'}}>{['Exported by','Date/Time','Filter','Rows'].map(h=><th key={h} style={{padding:'10px 12px',textAlign:'left',fontWeight:600,color:'#9d174d',fontSize:12,borderBottom:'1px solid #fbcfe8'}}>{h}</th>)}</tr></thead>
              <tbody>{exportLog.map((log,i)=>(<tr key={i} style={{borderBottom:'1px solid #fdf2f8'}}>
                <td style={{...tdS,fontWeight:600,color:'#be185d'}}>{log.exported_by}</td>
                <td style={tdS}>{log.created_at?new Date(log.created_at).toLocaleString('en-IN'):'—'}</td>
                <td style={tdS}>{log.filter_type||'All'}</td>
                <td style={{...tdS,fontWeight:600}}>{log.row_count}</td>
              </tr>))}</tbody>
            </table>
          )}
        </div>
      </div>
    )}

    {/* ══ TAB: SAVINGS TRACKER (admin only) ══ */}
    {activeTab==='forecast'&&isAdmin&&(
      <div>
        <div style={{backgroundColor:'#0c4a6e',borderRadius:12,padding: isMobile ? '16px' : '20px 24px',marginBottom:20}}>
          <h2 style={{fontSize: isMobile ? 15 : 18,fontWeight:800,color:'white',margin:0}}>📈 Cash Flow & Forecast</h2>
          <p style={{fontSize:12,color:'rgba(255,255,255,0.65)',margin:'4px 0 0'}}>Where this month is headed, what recurring items are still outstanding, and a trend-based estimate for next month.</p>
        </div>

        {/* ── month-end balance projection ── */}
        {monthEndProjection&&(
          <div style={{...chartCard,marginBottom:20}}>
            <h3 style={{...chartTitle,fontSize:15}}>🎯 Month-End Projection — {new Date(thisMonth+'-01').toLocaleDateString('en-IN',{month:'long',year:'numeric'})}</h3>
            <div style={{display:'grid',gridTemplateColumns: isMobile?'1fr 1fr':'repeat(3,1fr)',gap: isMobile?10:14,marginBottom:16}}>
              <StatCard label="Confirmed So Far" value={monthEndProjection.netSoFar} color={monthEndProjection.netSoFar>=0?'#16a34a':'#dc2626'} bg={monthEndProjection.netSoFar>=0?'#dcfce7':'#fee2e2'} icon="✅" sub={`${fmt(monthEndProjection.incomeSoFar)} in · ${fmt(monthEndProjection.expenseSoFar)} out`}/>
              <StatCard label="Still Outstanding" value={monthEndProjection.outstandingIncome-monthEndProjection.outstandingExpense} color="#f59e0b" bg="#fffbeb" icon="⏳" sub={`${fmt(monthEndProjection.outstandingIncome)} in · ${fmt(monthEndProjection.outstandingExpense)} out`}/>
              <StatCard label="Projected Month-End" value={monthEndProjection.projectedNet} color={monthEndProjection.projectedNet>=0?'#16a34a':'#dc2626'} bg={monthEndProjection.projectedNet>=0?'#dcfce7':'#fee2e2'} icon="🎯" sub={`${fmt(monthEndProjection.projectedIncome)} in · ${fmt(monthEndProjection.projectedExpense)} out`}/>
            </div>
            <p style={{fontSize:11,color:'#94a3b8',margin:0}}>"Still Outstanding" is drawn from recurring items below that haven't been fully logged yet this month — set these up so the projection reflects reality.</p>
          </div>
        )}

        {/* ── recurring items forecast ── */}
        <div style={{...chartCard,marginBottom:20}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,flexWrap:'wrap',gap:8}}>
            <h3 style={{...chartTitle,fontSize:15,marginBottom:0}}>🔁 Recurring Items — This Month</h3>
            <button onClick={()=>setShowAddRecurringTpl(v=>!v)} style={{...smallBtn('#eff6ff','#1e3a5f'),fontSize:12}}>{showAddRecurringTpl?'✖ Cancel':'+ Add Recurring Item'}</button>
          </div>

          {showAddRecurringTpl&&(
            <div style={{display:'grid',gridTemplateColumns: isMobile?'1fr':'1fr 1fr 1fr 1fr auto',gap:8,marginBottom:16,padding:12,backgroundColor:'#f8fafc',borderRadius:8}}>
              <select value={newRecurringTpl.type} onChange={e=>setNewRecurringTpl(p=>({...p,type:e.target.value,category:''}))} style={iStyle}>
                <option value="Expense">Expense</option>
                <option value="Income">Income</option>
              </select>
              <select value={newRecurringTpl.category} onChange={e=>setNewRecurringTpl(p=>({...p,category:e.target.value}))} style={iStyle}>
                <option value="">Category…</option>
                {(newRecurringTpl.type==='Income'?INCOME_CATEGORIES:expenseCategoryOptions).map(c=><option key={c}>{c}</option>)}
              </select>
              <input type="text" placeholder="Label (e.g. Staff Salary)" value={newRecurringTpl.label} onChange={e=>setNewRecurringTpl(p=>({...p,label:e.target.value}))} style={iStyle}/>
              <input type="number" min="0" placeholder="Expected ₹" value={newRecurringTpl.expected_amount} onChange={e=>setNewRecurringTpl(p=>({...p,expected_amount:e.target.value}))} style={iStyle}/>
              <button onClick={addRecurringTemplate} style={{...smallBtn('#dcfce7','#16a34a'),padding:'10px 16px'}}>Add</button>
            </div>
          )}

          {recurringForecast.length===0?(
            <p style={{color:'#94a3b8',textAlign:'center',padding:24,fontSize:13}}>No recurring items set up yet. Add rent, salary, or standing donations here so the month-end projection knows what's still expected.</p>
          ):(
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {recurringForecast.map(t=>(
                <div key={t.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',border:'1px solid #f1f5f9',borderRadius:8}}>
                  <div>
                    <strong style={{color:'#1e293b',fontSize:13}}>{t.label}</strong>
                    <span style={{fontSize:11,color:'#94a3b8',marginLeft:8}}>{t.type} · {t.category}{t.day_of_month?` · around day ${t.day_of_month}`:''}</span>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    {t.isLogged?(
                      <span style={{padding:'3px 9px',borderRadius:999,fontSize:11,fontWeight:700,backgroundColor:'#dcfce7',color:'#16a34a'}}>✔ Logged {fmt(t.loggedTotal)}</span>
                    ):(
                      <span style={{padding:'3px 9px',borderRadius:999,fontSize:11,fontWeight:700,backgroundColor:'#fffbeb',color:'#b45309'}}>⏳ {fmt(t.outstanding)} outstanding</span>
                    )}
                    <button onClick={()=>removeRecurringTemplate(t.id)} style={{background:'none',border:'none',color:'#dc2626',cursor:'pointer',fontSize:13}}>✖</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── trend-based next-month projection ── */}
        {trendProjection&&(
          <div style={{...chartCard,marginBottom:20}}>
            <h3 style={{...chartTitle,fontSize:15}}>📊 Trend Projection — {trendProjection.nextMonthLabel}</h3>
            <p style={{fontSize:11,color:'#94a3b8',margin:'0 0 14px'}}>Based on the average of the last {trendProjection.monthsUsed} month{trendProjection.monthsUsed===1?'':'s'} with recorded activity.</p>
            <div style={{display:'grid',gridTemplateColumns: isMobile?'1fr 1fr':'repeat(3,1fr)',gap: isMobile?10:14}}>
              <StatCard label="Projected Income" value={trendProjection.projectedIncome} color="#16a34a" bg="#dcfce7" icon="💰"/>
              <StatCard label="Projected Expense" value={trendProjection.projectedExpense} color="#dc2626" bg="#fee2e2" icon="💸"/>
              <StatCard label="Projected Net" value={trendProjection.projectedNet} color={trendProjection.projectedNet>=0?'#16a34a':'#dc2626'} bg={trendProjection.projectedNet>=0?'#dcfce7':'#fee2e2'} icon="📈"/>
            </div>
          </div>
        )}
      </div>
    )}

    {activeTab==='reconciliation'&&isAdmin&&(
      <div>
        <div style={{backgroundColor:'#374151',borderRadius:12,padding: isMobile ? '16px' : '20px 24px',marginBottom:20}}>
          <h2 style={{fontSize: isMobile ? 15 : 18,fontWeight:800,color:'white',margin:0}}>🔒 Reconciliation & Closing</h2>
          <p style={{fontSize:12,color:'rgba(255,255,255,0.65)',margin:'4px 0 0'}}>Match entries against your bank statement, close a month once it's settled, and check for backdated changes to closed history.</p>
        </div>

        {/* ── unreconciled balance per account type ── */}
        <div style={{display:'grid',gridTemplateColumns: isMobile ? '1fr 1fr' : `repeat(${ACCOUNT_TYPES.length},1fr)`,gap: isMobile ? 10 : 14,marginBottom:24}}>
          {reconSummaryByAccount.map(r=>(
            <StatCard key={r.account_type} label={`${r.account_type} — Unreconciled`} value={r.unreconciledBalance} color={r.unreconciledCount>0?'#b45309':'#16a34a'} bg={r.unreconciledCount>0?'#fffbeb':'#dcfce7'} icon={r.unreconciledCount>0?'⏳':'✔'} sub={`${r.unreconciledCount} of ${r.totalCount} entries`}/>
          ))}
        </div>

        {/* ── per-entry reconciliation checklist for this month ── */}
        <div style={{...chartCard,marginBottom:20}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,flexWrap:'wrap',gap:8}}>
            <h3 style={{...chartTitle,fontSize:15,marginBottom:0}}>🏦 Bank Reconciliation — {new Date(thisMonth+'-01').toLocaleDateString('en-IN',{month:'long',year:'numeric'})}</h3>
            <select value={reconAcctType} onChange={e=>setReconAcctType(e.target.value)} style={{...iStyle,width:'auto'}}>
              {ACCOUNT_TYPES.map(a=><option key={a}>{a}</option>)}
            </select>
          </div>
          {reconEntries.length===0?(
            <p style={{color:'#94a3b8',textAlign:'center',padding:24,fontSize:13}}>No confirmed entries for {reconAcctType} this month.</p>
          ):(
            <div style={{display:'flex',flexDirection:'column',gap:0,maxHeight:420,overflowY:'auto'}}>
              {reconEntries.map(e=>(
                <label key={e.id} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 4px',borderBottom:'1px solid #f8fafc',cursor:reconBusyId===e.id?'wait':'pointer',opacity:reconBusyId===e.id?0.6:1}}>
                  <input type="checkbox" checked={!!e.reconciled} disabled={reconBusyId===e.id} onChange={()=>toggleReconciled(e)}/>
                  <span style={{fontSize:12,color:'#64748b',minWidth:80}}>{e.entry_date}</span>
                  <span style={{fontSize:12,color:'#1e293b',flex:1,minWidth:0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{e.category}{e.note?` — ${e.note}`:''}</span>
                  <strong style={{fontSize:13,color:e.type==='Income'?'#16a34a':'#dc2626',flexShrink:0}}>{e.type==='Income'?'+':'−'}{fmt(e.amount)}</strong>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* ── month-end close / lock ── */}
        <div style={{...chartCard,marginBottom:20}}>
          <h3 style={{...chartTitle,fontSize:15}}>📅 Month-End Close</h3>
          <p style={{fontSize:11,color:'#94a3b8',margin:'0 0 14px'}}>Closing a month blocks non-admin staff from adding or editing entries dated in it. You can always reopen it here.</p>
          {monthLockGrid.map(g=>(
            <div key={g.account_type} style={{marginBottom:16}}>
              <div style={{fontSize:12,fontWeight:700,color:'#374151',marginBottom:8}}>{g.account_type}</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                {g.months.map(m=>(
                  <button key={m.month} onClick={()=>m.isLocked?reopenMonth(g.account_type,m.month):closeMonth(g.account_type,m.month)}
                    style={{padding:'6px 12px',borderRadius:999,border:'1px solid',borderColor:m.isLocked?'#fecaca':'#e2e8f0',backgroundColor:m.isLocked?'#fef2f2':'#f8fafc',color:m.isLocked?'#b91c1c':'#64748b',fontSize:11,fontWeight:700,cursor:'pointer'}}>
                    {m.isLocked?'🔒':'🔓'} {m.month}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ── opening-balance carry-forward check ── */}
        <div style={chartCard}>
          <h3 style={{...chartTitle,fontSize:15}}>🔍 Opening Balance Carry-Forward Check</h3>
          {openingBalanceChecks.length===0?(
            <p style={{color:'#16a34a',fontSize:13,padding:'8px 0'}}>✔ No mismatches found — every checked month's opening balance matches the prior month's closing balance.</p>
          ):(
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {openingBalanceChecks.map((c,i)=>(
                <div key={i} style={{padding:'10px 14px',border:'1px solid #fecaca',backgroundColor:'#fef2f2',borderRadius:8}}>
                  <strong style={{color:'#b91c1c',fontSize:13}}>⚠ {c.account_type} — {c.month}</strong>
                  <p style={{fontSize:12,color:'#7f1d1d',margin:'4px 0 0'}}>Opening balance is {fmt(c.actualOpening)}, but {c.priorMonth}'s closing balance was {fmt(c.expectedOpening)} — a difference of {fmt(Math.abs(c.drift))}. This usually means an entry in {c.priorMonth} or earlier was added, edited, or deleted after that month was closed.</p>
                </div>
              ))}
            </div>
          )}
          <p style={{fontSize:11,color:'#94a3b8',margin:'12px 0 0'}}>This check only compares months that have been closed at least once (closing a month records its balance snapshot above).</p>
        </div>
      </div>
    )}

    {activeTab==='savings'&&isAdmin&&(
      <div>
        <div style={{backgroundColor:'#064e3b',borderRadius:12,padding: isMobile ? '16px' : '20px 24px',marginBottom:20}}>
          <h2 style={{fontSize: isMobile ? 15 : 18,fontWeight:800,color:'white',margin:0}}>💹 Savings Tracker</h2>
          <p style={{fontSize:12,color:'rgba(255,255,255,0.65)',margin:'4px 0 0'}}>Daily and weekly income vs. expense, and which categories to watch for future saving.</p>
        </div>

        {/* ── overall savings summary ── */}
        <div style={{display:'grid',gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)',gap: isMobile ? 10 : 14,marginBottom:24}}>
          <StatCard label="Total Income (All Time)" value={savingsTracker?.totalIncomeAll||0} color="#16a34a" bg="#dcfce7" icon="💰"/>
          <StatCard label="Total Expense (All Time)" value={savingsTracker?.totalExpenseAll||0} color="#dc2626" bg="#fee2e2" icon="💸"/>
          <StatCard label="Net Savings (All Time)" value={savingsTracker?.netSavings||0} color={savingsTracker?.netSavings>=0?'#16a34a':'#dc2626'} bg={savingsTracker?.netSavings>=0?'#dcfce7':'#fee2e2'} icon="🏦"/>
          <StatCard label="Savings Rate" value={`${(savingsTracker?.savingsRate||0).toFixed(1)}%`} color="#1e3a5f" bg="#eff6ff" icon="📈" isCurrency={false} sub="of total income saved"/>
        </div>

        {/* ── this week vs last week ── */}
        <div style={{...chartCard,marginBottom:24}}>
          <h3 style={chartTitle}>This Week vs Last Week</h3>
          <div style={{display:'grid',gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',gap:16}}>
            {[{label:'Last Week',data:savingsTracker?.lastWeek},{label:'This Week',data:savingsTracker?.thisWeek}].map(({label,data})=>(
              <div key={label} style={{backgroundColor:'#f8fafc',borderRadius:10,padding:16}}>
                <p style={{fontSize:12,color:'#64748b',fontWeight:600,margin:'0 0 8px'}}>{label}</p>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}><span style={{fontSize:12,color:'#16a34a'}}>Income</span><strong style={{fontSize:13,color:'#16a34a'}}>{fmt(data?.Income||0)}</strong></div>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}><span style={{fontSize:12,color:'#dc2626'}}>Expense</span><strong style={{fontSize:13,color:'#dc2626'}}>{fmt(data?.Expense||0)}</strong></div>
                <div style={{display:'flex',justifyContent:'space-between',paddingTop:6,borderTop:'1px solid #e2e8f0'}}><span style={{fontSize:12,color:'#1e3a5f',fontWeight:700}}>Net</span><strong style={{fontSize:14,color:data?.Net>=0?'#16a34a':'#dc2626'}}>{fmt(data?.Net||0)}</strong></div>
              </div>
            ))}
          </div>
        </div>

        {/* ── daily trend (last 14 days) ── */}
        <div style={{...chartCard,marginBottom:24}}>
          <h3 style={chartTitle}>📅 Daily Income vs Expense — Last 14 Days</h3>
          {dailyTrend.length===0?<p style={{textAlign:'center',color:'#94a3b8',fontSize:14,padding:32}}>No entries yet.</p>:(
            <ResponsiveContainer width="100%" height={isMobile?220:280}>
              <LineChart data={dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="date" tick={{fontSize:10}} tickFormatter={d=>d.slice(5)}/>
                <YAxis tick={{fontSize:10}} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`}/>
                <Tooltip formatter={v=>fmt(v)}/>
                <Legend/>
                <Line type="monotone" dataKey="Income" stroke="#16a34a" strokeWidth={2} dot={false}/>
                <Line type="monotone" dataKey="Expense" stroke="#dc2626" strokeWidth={2} dot={false}/>
                <Line type="monotone" dataKey="Net" stroke="#1e3a5f" strokeWidth={2} strokeDasharray="4 4" dot={false}/>
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── weekly trend (last 8 weeks) ── */}
        <div style={{...chartCard,marginBottom:24}}>
          <h3 style={chartTitle}>🗓️ Weekly Income vs Expense — Last 8 Weeks</h3>
          {weeklyTrend.length===0?<p style={{textAlign:'center',color:'#94a3b8',fontSize:14,padding:32}}>No entries yet.</p>:(
            <ResponsiveContainer width="100%" height={isMobile?220:280}>
              <BarChart data={weeklyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="week" tick={{fontSize:10}} tickFormatter={d=>d.slice(5)}/>
                <YAxis tick={{fontSize:10}} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`}/>
                <Tooltip formatter={v=>fmt(v)}/>
                <Legend/>
                <Bar dataKey="Income" fill="#16a34a" radius={[3,3,0,0]}/>
                <Bar dataKey="Expense" fill="#dc2626" radius={[3,3,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── category trend flags: what to watch for future saving ── */}
        <div style={{...chartCard,marginBottom:20}}>
          <h3 style={chartTitle}>🔍 Categories to Watch — This Week vs Last Week</h3>
          {categoryTrendFlags.length===0?<p style={{color:'#94a3b8',fontSize:14}}>Not enough weekly data yet to compare trends.</p>:(
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead><tr style={{backgroundColor:'#f8fafc'}}>{['Category','Last Week','This Week','Change','Signal'].map(h=><th key={h} style={{padding:'10px 12px',textAlign:'left',fontWeight:600,color:'#374151',fontSize:12,borderBottom:'1px solid #e2e8f0'}}>{h}</th>)}</tr></thead>
              <tbody>{categoryTrendFlags.map(r=>{
                const rising=r.change>20,falling=r.change<-20
                return(
                  <tr key={r.category} style={{borderBottom:'1px solid #f1f5f9'}}>
                    <td style={{...tdS,fontWeight:600,color:'#1e293b'}}>{r.category}</td>
                    <td style={tdS}>{fmt(r.previous)}</td>
                    <td style={{...tdS,fontWeight:600}}>{fmt(r.current)}</td>
                    <td style={{...tdS,fontWeight:700,color:rising?'#dc2626':falling?'#16a34a':'#64748b'}}>{r.change>0?'+':''}{r.change.toFixed(0)}%</td>
                    <td style={tdS}>
                      {rising&&<span style={{padding:'2px 8px',borderRadius:999,fontSize:11,fontWeight:700,backgroundColor:'#fee2e2',color:'#dc2626'}}>⬆ Trending up — consider cutting back</span>}
                      {falling&&<span style={{padding:'2px 8px',borderRadius:999,fontSize:11,fontWeight:700,backgroundColor:'#dcfce7',color:'#16a34a'}}>⬇ Trending down</span>}
                      {!rising&&!falling&&<span style={{padding:'2px 8px',borderRadius:999,fontSize:11,fontWeight:600,backgroundColor:'#f1f5f9',color:'#64748b'}}>Stable</span>}
                    </td>
                  </tr>
                )
              })}</tbody>
            </table>
          )}
        </div>
      </div>
    )}

    {/* ══ TAB: BALANCE SHEET (PHASE 4) ══ */}
    {activeTab==='balancesheet'&&isAdmin&&(
      <div>
        {loadingFinancials?<div style={{textAlign:'center',padding:48,color:'#64748b'}}>⏳ Loading financials…</div>:(
          <>
            {/* Trial Balance */}
            <div style={{backgroundColor:'white',borderRadius:12,padding: isMobile?14:20,boxShadow:'0 2px 8px rgba(0,0,0,0.06)',marginBottom:20,borderLeft:'4px solid #047857'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:8}}>
                <h3 style={{fontSize:16,fontWeight:700,color:'#047857',margin:0}}>📊 Trial Balance</h3>
                <button onClick={fetchFinancials} style={{...smallBtn('#f0fdf4','#047857'),padding:'6px 14px',fontSize:12}}>↻ Refresh</button>
              </div>
              {trialBalance.length===0
                ?<div style={{backgroundColor:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'14px 18px'}}>
                  <p style={{color:'#047857',fontSize:13,margin:0,fontWeight:500}}>📋 No journal entries yet.</p>
                  <p style={{color:'#64748b',fontSize:12,margin:'6px 0 0'}}>Run the Phase 4 SQL migration in your Supabase SQL editor. New transactions added after migration will auto-generate DR/CR journal lines via the <code>sync_journal_entry</code> trigger.</p>
                </div>
                :<div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                    <thead>
                      <tr style={{backgroundColor:'#f8fafc'}}>
                        {['Account Head','Type','Total Debit','Total Credit','Net Balance'].map(h=>(
                          <th key={h} style={{padding:'10px 14px',textAlign:h.includes('Total')||h.includes('Net')?'right':'left',fontWeight:600,color:'#374151',fontSize:12,borderBottom:'1px solid #e2e8f0'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {trialBalance.map((row,i)=>(
                        <tr key={i} style={{borderBottom:'1px solid #f1f5f9'}}>
                          <td style={{...tdS,fontWeight:500,color:'#1e293b'}}>{row.account_head}</td>
                          <td style={tdS}><span style={{padding:'2px 8px',borderRadius:999,fontSize:11,fontWeight:600,
                            backgroundColor:row.account_type==='Income'?'#dcfce7':row.account_type==='Expense'?'#fee2e2':row.account_type==='Asset'?'#eff6ff':row.account_type==='Liability'?'#fef3c7':'#f3e8ff',
                            color:row.account_type==='Income'?'#16a34a':row.account_type==='Expense'?'#dc2626':row.account_type==='Asset'?'#1e3a5f':row.account_type==='Liability'?'#92400e':'#7c3aed'
                          }}>{row.account_type}</span></td>
                          <td style={{...tdS,textAlign:'right',color:'#16a34a',fontWeight:600}}>{fmt(row.total_debit)}</td>
                          <td style={{...tdS,textAlign:'right',color:'#dc2626',fontWeight:600}}>{fmt(row.total_credit)}</td>
                          <td style={{...tdS,textAlign:'right',fontWeight:700,color:Number(row.net_balance)>=0?'#1e3a5f':'#dc2626'}}>{fmt(Math.abs(row.net_balance))}<span style={{fontSize:10,marginLeft:4,opacity:0.7}}>{Number(row.net_balance)<0?'Cr':'Dr'}</span></td>
                        </tr>
                      ))}
                      <tr style={{backgroundColor:'#f8fafc',fontWeight:700,borderTop:'2px solid #e2e8f0'}}>
                        <td style={{...tdS,fontWeight:700,color:'#1e293b'}} colSpan={2}>Totals</td>
                        <td style={{...tdS,textAlign:'right',fontWeight:700,color:'#16a34a'}}>{fmt(trialBalance.reduce((s,r)=>s+Number(r.total_debit),0))}</td>
                        <td style={{...tdS,textAlign:'right',fontWeight:700,color:'#dc2626'}}>{fmt(trialBalance.reduce((s,r)=>s+Number(r.total_credit),0))}</td>
                        <td/>
                      </tr>
                    </tbody>
                  </table>
                </div>
              }
            </div>

            {/* Balance check banner */}
            {trialBalance.length>0&&(()=>{
              const totalDr=trialBalance.reduce((s,r)=>s+Number(r.total_debit),0)
              const totalCr=trialBalance.reduce((s,r)=>s+Number(r.total_credit),0)
              const balanced=Math.abs(totalDr-totalCr)<0.01
              return(
                <div style={{marginBottom:20,backgroundColor:balanced?'#dcfce7':'#fee2e2',borderRadius:10,padding:'12px 18px',display:'flex',alignItems:'center',gap:10,border:`1px solid ${balanced?'#bbf7d0':'#fecaca'}`}}>
                  <span style={{fontSize:20}}>{balanced?'✅':'⚠️'}</span>
                  <div>
                    <p style={{fontWeight:700,color:balanced?'#166534':'#dc2626',margin:0,fontSize:14}}>{balanced?'Books are balanced':'Books are OUT OF BALANCE'}</p>
                    <p style={{fontSize:12,color:balanced?'#166534':'#dc2626',margin:'2px 0 0'}}>
                      Total Debits: {fmt(totalDr)} &nbsp;|&nbsp; Total Credits: {fmt(totalCr)} &nbsp;|&nbsp; Difference: {fmt(Math.abs(totalDr-totalCr))}
                    </p>
                  </div>
                </div>
              )
            })()}

            {/* Balance Sheet — Assets vs Liabilities & Equity */}
            <div style={{display:'grid',gridTemplateColumns: isMobile?'1fr':'1fr 1fr',gap:16,marginBottom:20}}>
              {[
                {title:'Assets',filterFn:(r)=>r.account_type==='Asset',color:'#1e3a5f',bg:'#eff6ff',border:'#bfdbfe'},
                {title:'Liabilities & Equity',filterFn:(r)=>r.account_type==='Liability'||r.account_type==='Equity',color:'#7c3aed',bg:'#f3e8ff',border:'#e9d5ff'},
              ].map(sec=>{
                const rows=balanceSheet.filter(sec.filterFn)
                const total=rows.reduce((s,r)=>s+Number(r.balance),0)
                return(
                  <div key={sec.title} style={{backgroundColor:'white',borderRadius:12,padding:18,boxShadow:'0 2px 8px rgba(0,0,0,0.06)',borderLeft:`4px solid ${sec.color}`}}>
                    <h3 style={{fontSize:14,fontWeight:700,color:sec.color,marginBottom:14,borderBottom:`2px solid ${sec.bg}`,paddingBottom:8}}>{sec.title}</h3>
                    {rows.length===0
                      ?<p style={{color:'#94a3b8',fontSize:13,fontStyle:'italic'}}>No entries yet</p>
                      :<table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                        <tbody>
                          {rows.map((r,i)=>(
                            <tr key={i} style={{borderBottom:'1px solid #f1f5f9'}}>
                              <td style={{padding:'7px 0',color:'#374151'}}>{r.account_head}</td>
                              <td style={{padding:'7px 0',textAlign:'right',fontWeight:600,color:sec.color}}>{fmt(Math.abs(Number(r.balance)))}</td>
                            </tr>
                          ))}
                          <tr style={{borderTop:`2px solid ${sec.color}`}}>
                            <td style={{padding:'8px 0',fontWeight:700,color:'#1e293b'}}>Total {sec.title}</td>
                            <td style={{padding:'8px 0',textAlign:'right',fontWeight:700,color:sec.color}}>{fmt(Math.abs(total))}</td>
                          </tr>
                        </tbody>
                      </table>
                    }
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    )}

    {/* ══ TAB: INCOME ANALYSIS ══ */}
    {activeTab==='audit'&&isAdmin&&(
      <AuditMonitor entries={entries} isMobile={isMobile}/>
    )}
    {activeTab==='income'&&(
      <div>
        <IncomeAnalysis entries={entries} today={today} isMobile={isMobile}/>

        {/* ── Accounts v3: income collection targets vs actual + all
            income categories, built from every actual income entry
            (mirrors the expense "All Expense Categories" panel) ── */}
        {allIncomeCategorySummary.length>0&&(()=>{
          const catIcons={Admission:'🎓',Fees:'💳',Hostel:'🏠',Advance:'⏩',Donation:'🎁',Registration:'📝',Uncategorized:'❔'}
          const grandTotal=allIncomeCategorySummary.reduce((s,c)=>s+c.total,0)
          const topCat=allIncomeCategorySummary[0]
          return(
          <div style={{...chartCard,marginTop:20,marginBottom:20}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems: isMobile?'flex-start':'center',flexDirection: isMobile?'column':'row',gap:10,marginBottom:18}}>
              <div>
                <h3 style={{...chartTitle,marginBottom:3}}>📂 All Income Categories</h3>
                <p style={{fontSize:12,color:'#94a3b8',margin:0}}>Every category ever used across your income entries, with this month's collection target</p>
              </div>
              <div style={{display:'flex',gap: isMobile?10:18,flexWrap:'wrap'}}>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:10,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.4px'}}>Categories</div>
                  <div style={{fontSize:18,fontWeight:800,color:'#1e3a5f'}}>{allIncomeCategorySummary.length}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:10,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.4px'}}>Total Collected</div>
                  <div style={{fontSize:18,fontWeight:800,color:'#047857'}}>{fmt(grandTotal)}</div>
                </div>
                {topCat&&<div style={{textAlign:'right'}}>
                  <div style={{fontSize:10,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.4px'}}>Top Category</div>
                  <div style={{fontSize:14,fontWeight:800,color:'#1e3a5f'}}>{catIcons[topCat.category]||'🏷️'} {topCat.category}</div>
                </div>}
              </div>
            </div>

            <div style={{display:'grid',gridTemplateColumns: isMobile?'1fr':'repeat(auto-fill,minmax(270px,1fr))',gap:12}}>
              {allIncomeCategorySummary.map((c,idx)=>{
                const expanded=catAllIncDrilldown===c.category
                const pct=grandTotal>0?(c.total/grandTotal)*100:0
                const color=CHART_COLORS[idx%CHART_COLORS.length]
                const catEntries=expanded?entries.filter(e=>e.type==='Income'&&isConfirmed(e)&&(e.category||'Uncategorized')===c.category).sort((a,b)=>b.entry_date<a.entry_date?-1:b.entry_date>a.entry_date?1:0):[]
                const editingTarget=editIncTarget===c.category
                return (
                  <div key={c.category} style={{border:'1px solid #f1f5f9',borderRadius:10,overflow:'hidden',backgroundColor:expanded?'#fafbfc':'white',transition:'background-color 0.2s ease',gridColumn: expanded&&!isMobile?'1 / -1':undefined}}>
                    <div style={{padding:'14px 16px'}}>
                      <div onClick={()=>setCatAllIncDrilldown(expanded?null:c.category)} style={{cursor:'pointer'}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                          <div style={{display:'flex',alignItems:'center',gap:9,minWidth:0}}>
                            <span style={{fontSize:20,width:34,height:34,borderRadius:9,backgroundColor:`${color}1a`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{catIcons[c.category]||'🏷️'}</span>
                            <div style={{minWidth:0}}>
                              <div style={{fontWeight:700,color:'#1e293b',fontSize:14,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{c.category}</div>
                              <div style={{fontSize:11,color:'#94a3b8'}}>{c.count} entr{c.count===1?'y':'ies'} · last {c.lastDate}</div>
                            </div>
                          </div>
                          <span style={{fontSize:14,color:'#cbd5e1',flexShrink:0,marginLeft:6}}>{expanded?'▾':'▸'}</span>
                        </div>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:6}}>
                          <strong style={{fontSize:17,fontWeight:800,color:'#1e3a5f'}}>{fmt(c.total)}</strong>
                          <span style={{fontSize:11,fontWeight:700,color:'#94a3b8'}}>{pct.toFixed(1)}% of total</span>
                        </div>
                        <div style={{height:6,borderRadius:999,backgroundColor:'#f1f5f9',overflow:'hidden'}}>
                          <div style={{height:'100%',width:`${Math.max(pct,2)}%`,borderRadius:999,backgroundColor:color,transition:'width 0.3s ease'}}/>
                        </div>
                      </div>

                      {/* ── collection target vs actual, this month ── */}
                      <div style={{marginTop:12,paddingTop:10,borderTop:'1px dashed #f1f5f9'}} onClick={e=>e.stopPropagation()}>
                        {editingTarget?(
                          <div style={{display:'flex',gap:6,alignItems:'center'}}>
                            <input type="number" min="0" step="1" autoFocus value={incTargetDraft} onChange={e=>setIncTargetDraft(e.target.value)} placeholder="Target ₹" style={{...iStyle,padding:'6px 9px',fontSize:12}}/>
                            <button onClick={()=>saveIncTarget(c.category,incTargetDraft)} style={{...smallBtn('#dcfce7','#16a34a'),fontSize:11}}>✔</button>
                            <button onClick={()=>setEditIncTarget(null)} style={{...smallBtn('#f1f5f9','#64748b'),fontSize:11}}>✖</button>
                          </div>
                        ):c.target>0?(
                          <div>
                            <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#64748b',marginBottom:4}}>
                              <span>This month: {fmt(c.monthTotal)} of {fmt(c.target)} target</span>
                              <button onClick={()=>{setEditIncTarget(c.category);setIncTargetDraft(String(c.target))}} style={{background:'none',border:'none',color:'#0891b2',fontSize:11,fontWeight:700,cursor:'pointer',padding:0}}>Edit</button>
                            </div>
                            <div style={{height:5,borderRadius:999,backgroundColor:'#f1f5f9',overflow:'hidden'}}>
                              <div style={{height:'100%',width:`${Math.min(c.pctOfTarget||0,100)}%`,borderRadius:999,backgroundColor:(c.pctOfTarget||0)>=100?'#16a34a':(c.pctOfTarget||0)>=60?'#f59e0b':'#dc2626',transition:'width 0.3s ease'}}/>
                            </div>
                          </div>
                        ):(
                          <button onClick={()=>{setEditIncTarget(c.category);setIncTargetDraft('')}} style={{background:'none',border:'none',color:'#0891b2',fontSize:11,fontWeight:700,cursor:'pointer',padding:0}}>+ Set this month's target</button>
                        )}
                      </div>
                    </div>
                    {expanded&&(
                      <div style={{padding:'0 16px 14px',borderTop:'1px solid #f1f5f9',marginTop:2}}>
                        <div style={{display:'flex',flexDirection:'column',gap:0,marginTop:10}}>
                          {(showAllDrilldown.has(`inccat:${c.category}`)?catEntries:catEntries.slice(0,10)).map(e=>(
                            <div key={e.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 0',fontSize:12,borderBottom:'1px solid #f8fafc'}}>
                              <span style={{color:'#64748b'}}>{e.entry_date}{e.note?` — ${e.note}`:''}</span>
                              <strong style={{color:'#16a34a',flexShrink:0,marginLeft:8}}>{fmt(e.amount)}</strong>
                            </div>
                          ))}
                          {catEntries.length>10&&(
                            <button onClick={()=>toggleShowAllDrilldown(`inccat:${c.category}`)} style={{background:'none',border:'none',color:'#0891b2',fontSize:11,fontWeight:700,cursor:'pointer',padding:'8px 0 0',textAlign:'left'}}>
                              {showAllDrilldown.has(`inccat:${c.category}`)?'Show less':`+${catEntries.length-10} more entr${catEntries.length-10===1?'y':'ies'} — Show all`}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          )
        })()}

        {/* ── Accounts v3: payer / source spend summary + drilldown
            (mirrors the expenditure Vendor/Payee Spend panel) ── */}
        {payerSpendSummary.length>0&&(
          <div style={{backgroundColor:'white',borderRadius:12,padding: isMobile ? 14 : 20,boxShadow:'0 2px 8px rgba(0,0,0,0.06)'}}>
            <h3 style={{...chartTitle,fontSize:15,marginBottom:12}}>🧑‍🤝‍🧑 Payer / Source Collection</h3>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {payerSpendSummary.map(p=>{
                const expanded=payerDrilldown===p.payer_id
                return (
                  <div key={p.payer_id} style={{border:'1px solid #f1f5f9',borderRadius:8}}>
                    <div onClick={()=>setPayerDrilldown(expanded?null:p.payer_id)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',cursor:'pointer'}}>
                      <div>
                        <strong style={{color:'#1e293b'}}>{expanded?'▾':'▸'} {p.payerName}</strong>
                        <span style={{fontSize:11,color:'#94a3b8',marginLeft:8}}>{p.count} payment{p.count===1?'':'s'} · last on {p.lastDate}</span>
                      </div>
                      <strong style={{color:'#047857'}}>{fmt(p.total)}</strong>
                    </div>
                    {expanded&&(
                      <div style={{padding:'0 14px 12px',borderTop:'1px solid #f8fafc'}}>
                        {(showAllDrilldown.has(`payer:${p.payer_id}`)?p.entries:p.entries.slice(0,10)).map(e=>(
                          <div key={e.id} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',fontSize:12,borderBottom:'1px solid #f8fafc'}}>
                            <span style={{color:'#64748b'}}>{e.entry_date} · {e.category}{e.note?` — ${e.note}`:''}</span>
                            <strong style={{color:'#16a34a'}}>{fmt(e.amount)}</strong>
                          </div>
                        ))}
                        {p.entries.length>10&&(
                          <button onClick={()=>toggleShowAllDrilldown(`payer:${p.payer_id}`)} style={{background:'none',border:'none',color:'#0891b2',fontSize:11,fontWeight:700,cursor:'pointer',padding:'6px 0 0',textAlign:'left'}}>
                            {showAllDrilldown.has(`payer:${p.payer_id}`)?'Show less':`+${p.entries.length-10} more payment(s) — Show all`}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )}
    {/* ══ TAB: TIMELINE ══ */}
    {activeTab==='timeline'&&isAdmin&&(
      <div>
        <div style={{backgroundColor:'white',borderRadius:12,padding: isMobile ? 14 : 20,boxShadow:'0 2px 8px rgba(0,0,0,0.06)',marginBottom:20}}>
          <h3 style={{fontSize:16,fontWeight:700,color:'#1e3a5f',marginBottom:16}}>🕐 Activity Timeline</h3>
          {auditLog.length===0
            ? <p style={{color:'#94a3b8',textAlign:'center',padding:32}}>No activity recorded yet.</p>
            : auditLog.map((log,i)=>{
                const actionColor={insert:'#16a34a',update:'#f59e0b',delete:'#dc2626',restore:'#7c3aed',bulk_delete:'#dc2626',budget_edit:'#0891b2',expenditure_approved:'#16a34a',expenditure_rejected:'#dc2626'}[log.action]||'#64748b'
                const actionIcon={insert:'➕',update:'✏️',delete:'🗑',restore:'↩️',bulk_delete:'🗑',budget_edit:'💰',expenditure_approved:'✅',expenditure_rejected:'🚫'}[log.action]||'•'
                return(
                  <div key={i} style={{display:'flex',gap:14,paddingBottom:16,borderBottom:'1px solid #f1f5f9',marginBottom:16}}>
                    <div style={{width:36,height:36,borderRadius:'50%',backgroundColor:actionColor+'20',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>{actionIcon}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:4}}>
                        <span style={{fontWeight:700,fontSize:13,color:'#1e293b',textTransform:'capitalize'}}>{log.action.replace(/_/g,' ')}</span>
                        <span style={{fontSize:11,color:'#94a3b8'}}>{log.created_at?new Date(log.created_at).toLocaleString('en-IN'):''}</span>
                      </div>
                      <div style={{fontSize:12,color:'#64748b',marginTop:2}}>By <strong style={{color:actionColor}}>{log.changed_by||'system'}</strong>{log.target_id?` · ID: ${log.target_id}`:''}</div>
                      {log.new_values&&<div style={{fontSize:11,color:'#94a3b8',marginTop:4,fontFamily:'monospace',background:'#f8fafc',padding:'4px 8px',borderRadius:4,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{log.new_values}</div>}
                    </div>
                  </div>
                )
              })
          }
        </div>

        {/* ── Expenditure v2: dedicated audit trail viewer ──────────────────
            Same audit_log source as the Timeline above, but filtered to
            Expense-only entries and rendered as an explicit before/after
            diff (old_values vs new_values) instead of a flat activity feed —
            for someone specifically reviewing expenditure history rather
            than scanning everything the whole portal logs. */}
        <div style={{backgroundColor:'white',borderRadius:12,padding: isMobile ? 14 : 20,boxShadow:'0 2px 8px rgba(0,0,0,0.06)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6,flexWrap:'wrap',gap:8}}>
            <h3 style={{fontSize:16,fontWeight:700,color:'#7f1d1d',margin:0}}>💵 Expenditure Audit Trail</h3>
            <button onClick={fetchExpAuditLog} style={{...smallBtn('#fef2f2','#7f1d1d'),fontSize:12}}>↻ Refresh</button>
          </div>
          <p style={{fontSize:12,color:'#94a3b8',margin:'0 0 16px'}}>Every insert/edit/delete/restore touching an Expense entry, with a before/after diff for edits.</p>
          {expAuditLog.length===0?<p style={{color:'#94a3b8',textAlign:'center',padding:24}}>No expenditure edits/deletes recorded yet.</p>:(
            expAuditLog.map((log,i)=>{
              let ov=null,nv=null
              try{ov=log.old_values?JSON.parse(log.old_values):null}catch{}
              try{nv=log.new_values?JSON.parse(log.new_values):null}catch{}
              const changedFields=(ov&&nv)?Object.keys(nv).filter(k=>['amount','category','sub_category','note','voucher_head','payment_mode','account_type','status','entry_date'].includes(k)&&String(ov[k]??'')!==String(nv[k]??'')):[]
              return(
                <div key={i} style={{borderBottom:'1px solid #fef2f2',paddingBottom:14,marginBottom:14}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:4}}>
                    <span style={{fontWeight:700,fontSize:13,color:'#7f1d1d',textTransform:'capitalize'}}>{log.action.replace(/_/g,' ')}</span>
                    <span style={{fontSize:11,color:'#94a3b8'}}>{log.created_at?new Date(log.created_at).toLocaleString('en-IN'):''}</span>
                  </div>
                  <div style={{fontSize:12,color:'#64748b',margin:'2px 0 6px'}}>By <strong>{log.changed_by||'system'}</strong> · ID: {log.target_id}</div>
                  {changedFields.length>0?(
                    <div style={{display:'flex',flexDirection:'column',gap:4}}>
                      {changedFields.map(f=>(
                        <div key={f} style={{fontSize:12,display:'flex',gap:8,alignItems:'center'}}>
                          <span style={{fontWeight:600,color:'#374151',minWidth:90}}>{f}:</span>
                          <span style={{color:'#dc2626',textDecoration:'line-through'}}>{f==='amount'?fmt(ov[f]):String(ov[f]??'—')}</span>
                          <span>→</span>
                          <span style={{color:'#16a34a',fontWeight:600}}>{f==='amount'?fmt(nv[f]):String(nv[f]??'—')}</span>
                        </div>
                      ))}
                    </div>
                  ):(nv&&<div style={{fontSize:12,color:'#64748b'}}>{nv.category} — {fmt(nv.amount)}{nv.note?` · ${nv.note}`:''}</div>)}
                </div>
              )
            })
          )}
        </div>
      </div>
    )}

    {/* ══ TAB: EXPENDITURE APPROVALS (admin only) ══
        Pending queue + "approval list for the day" (everything decided today). ══ */}
    {activeTab==='approvals'&&isAdmin&&(
      <div>
        <div style={{backgroundColor:'#92400e',borderRadius:12,padding: isMobile ? '16px' : '20px 24px',marginBottom:20}}>
          <h2 style={{fontSize: isMobile ? 15 : 18,fontWeight:800,color:'white',margin:0}}>🔏 Expenditure Approvals</h2>
          <p style={{fontSize:12,color:'rgba(255,255,255,0.7)',margin:'4px 0 0'}}>Entries flagged for approval by amount threshold or submitter role — pending queue and today's decisions.</p>
        </div>

        {/* ── admin-editable threshold ── */}
        <div style={{...chartCard,marginBottom:20,borderLeft:'4px solid #92400e'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
            <div>
              <h3 style={{...chartTitle,fontSize:15,margin:0}}>Approval Threshold</h3>
              <p style={{fontSize:12,color:'#94a3b8',margin:'4px 0 0'}}>Any Expense entry at or above this amount needs approval, regardless of who enters it. Superintendent and general staff entries always need approval, regardless of amount.</p>
            </div>
            {!editThreshold?(
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <span style={{fontSize:20,fontWeight:800,color:'#92400e'}}>{fmt(approvalSettings.threshold_amount)}</span>
                <button onClick={()=>{setEditThreshold(true);setThresholdDraft(String(approvalSettings.threshold_amount))}} style={{...smallBtn('#fffbeb','#92400e')}}>✏️ Edit</button>
              </div>
            ):(
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <input type="number" min="0" value={thresholdDraft} onChange={e=>setThresholdDraft(e.target.value)} style={{...iStyle,width:140}}/>
                <button onClick={saveApprovalThreshold} style={{...smallBtn('#f0fdf4','#16a34a')}}>✅ Save</button>
                <button onClick={()=>setEditThreshold(false)} style={{...smallBtn('#f1f5f9','#64748b')}}>Cancel</button>
              </div>
            )}
          </div>
        </div>

        {/* ── pending queue ── */}
        <div style={{...chartCard,marginBottom:20,borderLeft:'4px solid #d97706',overflowX:'auto'}}>
          <h3 style={{...chartTitle,color:'#d97706'}}>⏳ Pending Queue ({pendingApprovals.length})</h3>
          {pendingApprovals.length===0?<p style={{color:'#94a3b8',fontSize:14}}>Nothing waiting on approval.</p>:(
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead><tr style={{backgroundColor:'#fffbeb'}}>{['Requested','Amount','Category','Note','Requested By','Reason','Actions'].map(h=><th key={h} style={{padding:'10px 12px',textAlign:'left',fontWeight:600,color:'#92400e',fontSize:12,borderBottom:'1px solid #fde68a'}}>{h}</th>)}</tr></thead>
              <tbody>{pendingApprovals.map(req=>(
                <tr key={req.id} style={{borderBottom:'1px solid #fffbeb'}}>
                  <td style={tdS}>{req.requested_at?new Date(req.requested_at).toLocaleString('en-IN'):''}</td>
                  <td style={{...tdS,fontWeight:700,color:'#dc2626'}}>{fmt(req.amount)}</td>
                  <td style={tdS}>{req.accounts?.category||'—'}{req.accounts?.sub_category?` / ${req.accounts.sub_category}`:''}</td>
                  <td style={{...tdS,maxWidth:220}}>{req.accounts?.note||'—'}</td>
                  <td style={tdS}><strong>{req.requested_by}</strong></td>
                  <td style={tdS}><span style={{padding:'2px 8px',borderRadius:999,fontSize:11,fontWeight:700,backgroundColor:'#fef3c7',color:'#92400e'}}>{req.reason==='both'?'role + amount':req.reason==='role'?'role':'amount'}</span></td>
                  <td style={tdS}>
                    <div style={{display:'flex',gap:6}}>
                      <button disabled={approvalBusyId===req.id} onClick={()=>approveExpenditure(req)} style={smallBtn('#f0fdf4','#16a34a')}>✓ Approve</button>
                      <button disabled={approvalBusyId===req.id} onClick={()=>rejectExpenditure(req)} style={smallBtn('#fee2e2','#dc2626')}>✗ Reject</button>
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>

        {/* ── "approval list for the day": everything DECIDED today ── */}
        <div style={{...chartCard,borderLeft:'4px solid #1e3a5f',overflowX:'auto'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4,flexWrap:'wrap',gap:8}}>
            <h3 style={{...chartTitle,margin:0}}>📅 Today's Approval List — {new Date().toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</h3>
            <button onClick={()=>fetchApprovalHistoryToday(today)} style={{...smallBtn('#eff6ff','#1e3a5f'),fontSize:12}}>↻ Refresh</button>
          </div>
          <p style={{fontSize:12,color:'#94a3b8',margin:'0 0 14px'}}>Every expenditure approval decision made today, approved or rejected — regardless of when it was originally submitted.</p>
          {approvalHistory.length===0?<p style={{color:'#94a3b8',fontSize:14}}>No approval decisions made today yet.</p>:(
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead><tr style={{backgroundColor:'#f8fafc'}}>{['Decided At','Decision','Amount','Category','Requested By','Decided By','Note'].map(h=><th key={h} style={{padding:'10px 12px',textAlign:'left',fontWeight:600,color:'#374151',fontSize:12,borderBottom:'1px solid #e2e8f0'}}>{h}</th>)}</tr></thead>
              <tbody>{approvalHistory.map(h=>(
                <tr key={h.id} style={{borderBottom:'1px solid #f1f5f9'}}>
                  <td style={tdS}>{h.decided_at?new Date(h.decided_at).toLocaleString('en-IN'):''}</td>
                  <td style={tdS}><span style={{padding:'2px 8px',borderRadius:999,fontSize:11,fontWeight:700,backgroundColor:h.status==='approved'?'#dcfce7':'#fee2e2',color:h.status==='approved'?'#16a34a':'#dc2626'}}>{h.status==='approved'?'✓ Approved':'✗ Rejected'}</span></td>
                  <td style={{...tdS,fontWeight:600}}>{fmt(h.amount)}</td>
                  <td style={tdS}>{h.accounts?.category||'—'}</td>
                  <td style={tdS}>{h.requested_by}</td>
                  <td style={tdS}><strong>{h.decided_by}</strong></td>
                  <td style={{...tdS,maxWidth:200}}>{h.decision_note||'—'}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </div>
    )}

    {/* ══ TAB: PER-STAFF EXPENDITURE DASHBOARD (admin only) ══ */}
    {activeTab==='staffspend'&&isAdmin&&(
      <div>
        <div style={{backgroundColor:'#1e3a5f',borderRadius:12,padding: isMobile ? '16px' : '20px 24px',marginBottom:20}}>
          <h2 style={{fontSize: isMobile ? 15 : 18,fontWeight:800,color:'white',margin:0}}>🧑‍💼 Per-Staff Expenditure Dashboard</h2>
          <p style={{fontSize:12,color:'rgba(255,255,255,0.65)',margin:'4px 0 0'}}>Who is entering how much, how often, and where — helps spot a sudden change in someone's entry pattern.</p>
        </div>

        {spendVelocityAlerts.length>0&&(
          <div style={{...chartCard,marginBottom:20,borderLeft:'4px solid #dc2626'}}>
            <h3 style={{...chartTitle,color:'#dc2626'}}>📈 Spend-Velocity Alerts</h3>
            <p style={{fontSize:12,color:'#94a3b8',margin:'-8px 0 12px'}}>A category or voucher head running well above its own recent average — independent of any fixed budget limit.</p>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {spendVelocityAlerts.map((a,i)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',backgroundColor:'#fef2f2',borderRadius:8,padding:'10px 14px'}}>
                  <div>
                    <strong style={{color:'#1e293b'}}>{a.label}</strong>
                    <span style={{fontSize:11,color:'#94a3b8',marginLeft:8}}>{a.scope==='category'?'category · this month vs prior 3-month avg':'voucher head · this week vs prior 4-week avg'}</span>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontWeight:800,color:'#dc2626'}}>{fmt(a.current)} <span style={{fontSize:11,fontWeight:600}}>vs avg {fmt(a.baseline)}</span></div>
                    <div style={{fontSize:11,color:'#dc2626',fontWeight:700}}>+{Math.round(a.pctOver)}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{...chartCard,overflowX:'auto'}}>
          <h3 style={chartTitle}>By Staff Member</h3>
          {perStaffExpenditure.length===0?<p style={{color:'#94a3b8',fontSize:14}}>No expenditure entries yet.</p>:(
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead><tr style={{backgroundColor:'#f8fafc'}}>{['Staff','Total (All Time)','Entries','This Month','Last Month','Change','Top Category'].map(h=><th key={h} style={{padding:'10px 12px',textAlign:'left',fontWeight:600,color:'#374151',fontSize:12,borderBottom:'1px solid #e2e8f0'}}>{h}</th>)}</tr></thead>
              <tbody>{perStaffExpenditure.map(s=>{
                const spiking=s.momChange>50&&s.thisMonthTotal>1000
                return(
                <tr key={s.staff} style={{borderBottom:'1px solid #f1f5f9',backgroundColor:spiking?'#fff7ed':'transparent'}}>
                  <td style={{...tdS,fontWeight:700,color:'#1e293b'}}>{s.staff}{spiking&&<span style={{marginLeft:6,fontSize:11,color:'#c2410c'}}>⚠ spiking</span>}</td>
                  <td style={{...tdS,fontWeight:600}}>{fmt(s.total)}</td>
                  <td style={tdS}>{s.count}</td>
                  <td style={tdS}>{fmt(s.thisMonthTotal)}</td>
                  <td style={tdS}>{fmt(s.lastMonthTotal)}</td>
                  <td style={{...tdS,fontWeight:700,color:s.momChange>0?'#dc2626':'#16a34a'}}>{s.momChange>=0?'+':''}{s.momChange.toFixed(0)}%</td>
                  <td style={tdS}>{s.topCategory}</td>
                </tr>
              )})}</tbody>
            </table>
          )}
        </div>
      </div>
    )}

    {/* ══ RECEIPT MEMO MODAL (auto-shown after saving a new entry) ══ */}
    {receiptMemoEntry&&(
      <div onClick={()=>setReceiptMemoEntry(null)} style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding: isMobile ? 12 : 0}}>
        <div onClick={e=>e.stopPropagation()} style={{backgroundColor:'white',borderRadius:14,padding: isMobile ? 20 : 28,width: isMobile ? '100%' : 420,maxWidth:'95vw',boxShadow:'0 20px 60px rgba(0,0,0,0.3)',textAlign:'center'}}>
          <div style={{fontSize:36,marginBottom:8}}>✅</div>
          <h2 style={{fontSize:17,fontWeight:800,color:'#1e3a5f',margin:'0 0 6px'}}>Entry Saved</h2>
          <p style={{fontSize:13,color:'#64748b',margin:'0 0 20px'}}>
            {receiptMemoEntry.type} of <strong>{fmt(receiptMemoEntry.amount)}</strong> recorded for <strong>{receiptMemoEntry.voucher_head||'-'}</strong>.
          </p>
          <div style={{display:'flex',gap:10}}>
            <button onClick={()=>setReceiptMemoEntry(null)} style={{backgroundColor:'#f1f5f9',color:'#64748b',border:'none',borderRadius:8,padding:'10px 16px',fontWeight:600,cursor:'pointer',fontSize:14,flex:1}}>Close</button>
            <button onClick={()=>{printReceiptMemo(receiptMemoEntry);setReceiptMemoEntry(null)}} style={{backgroundColor:'#16a34a',color:'white',border:'none',borderRadius:8,padding:'10px 16px',fontWeight:600,cursor:'pointer',fontSize:14,flex:1}}>🧾 Print Receipt Memo</button>
          </div>
        </div>
      </div>
    )}

    {/* ══ P&L MODAL ══ */}
    {showPL&&(
      <div onClick={()=>setShowPL(false)} style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding: isMobile ? 12 : 0}}>
        <div onClick={e=>e.stopPropagation()} style={{backgroundColor:'white',borderRadius:14,padding: isMobile ? 16 : 28,width: isMobile ? '100%' : 680,maxWidth:'95vw',maxHeight:'90vh',overflow:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:10}}>
            <div><h2 style={{fontSize: isMobile ? 16 : 20,fontWeight:700,color:'#1e3a5f',margin:0}}>📋 P&L Statement</h2><p style={{fontSize:13,color:'#64748b',margin:'4px 0 0'}}>Income &amp; Expenditure Report · {plPeriodLabel}</p></div>
            <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
              <button onClick={printPL} style={{backgroundColor:'#1e3a5f',color:'white',border:'none',borderRadius:8,padding:'8px 16px',fontWeight:600,cursor:'pointer',fontSize:13}}>🖨 Print</button>
              <button onClick={()=>setShowPL(false)} style={{backgroundColor:'#fee2e2',color:'#dc2626',border:'none',borderRadius:8,padding:'8px 12px',fontWeight:600,cursor:'pointer',fontSize:13}}>✖</button>
            </div>
          </div>

          {/* ── period selector: Month vs Custom Range ── */}
          <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',marginBottom:12}}>
            <div style={{display:'flex',borderRadius:8,overflow:'hidden',border:'1px solid #e5e7eb'}}>
              <button onClick={()=>setPlRangeMode('month')} style={{padding:'8px 14px',fontSize:12,fontWeight:600,cursor:'pointer',border:'none',backgroundColor:plRangeMode==='month'?'#1e3a5f':'#f8fafc',color:plRangeMode==='month'?'white':'#64748b'}}>Month</button>
              <button onClick={()=>setPlRangeMode('range')} style={{padding:'8px 14px',fontSize:12,fontWeight:600,cursor:'pointer',border:'none',backgroundColor:plRangeMode==='range'?'#1e3a5f':'#f8fafc',color:plRangeMode==='range'?'white':'#64748b'}}>Custom Range</button>
            </div>
            {plRangeMode==='month'
              ? <input type="month" value={plMonth} onChange={e=>setPlMonth(e.target.value)} style={{...iStyle,width: isMobile ? '100%' : 160}}/>
              : <>
                  <input type="date" value={plDateFrom} onChange={e=>setPlDateFrom(e.target.value)} style={{...iStyle,width: isMobile ? '48%' : 150}}/>
                  <span style={{color:'#94a3b8',fontSize:13}}>to</span>
                  <input type="date" value={plDateTo} onChange={e=>setPlDateTo(e.target.value)} style={{...iStyle,width: isMobile ? '48%' : 150}}/>
                </>
            }
            <button onClick={()=>setShowPlFilters(s=>!s)} style={{backgroundColor: showPlFilters?'#eef2ff':'#f8fafc',color:'#312e81',border:'1px solid #e0e7ff',borderRadius:8,padding:'8px 12px',fontWeight:600,cursor:'pointer',fontSize:12}}>⚙ Advanced Filters{(plAccountType!=='All'||plPaymentMode!=='All'||plStatus!=='All')?' •':''}</button>
          </div>

          {/* ── advanced filters panel ── */}
          {showPlFilters&&(
            <div style={{display:'grid',gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)',gap:10,marginBottom:16,backgroundColor:'#f8fafc',borderRadius:10,padding:14,border:'1px solid #e2e8f0'}}>
              <div>
                <label style={lStyle}>Account Type</label>
                <select value={plAccountType} onChange={e=>setPlAccountType(e.target.value)} style={iStyle}>
                  <option value="All">All Accounts</option>
                  {ACCOUNT_TYPES.map(a=><option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label style={lStyle}>Payment Mode</label>
                <select value={plPaymentMode} onChange={e=>setPlPaymentMode(e.target.value)} style={iStyle}>
                  <option value="All">All Modes</option>
                  {PAYMENT_MODES.map(m=><option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={lStyle}>Status</label>
                <select value={plStatus} onChange={e=>setPlStatus(e.target.value)} style={iStyle}>
                  <option value="All">All Statuses</option>
                  {STATUS_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {(plAccountType!=='All'||plPaymentMode!=='All'||plStatus!=='All')&&(
                <div style={{gridColumn: isMobile ? '1' : '1 / -1'}}>
                  <button onClick={()=>{setPlAccountType('All');setPlPaymentMode('All');setPlStatus('All')}} style={{backgroundColor:'#fee2e2',color:'#dc2626',border:'none',borderRadius:6,padding:'6px 12px',fontSize:12,fontWeight:600,cursor:'pointer'}}>✖ Clear Filters</button>
                </div>
              )}
            </div>
          )}

          <div style={{display:'grid',gridTemplateColumns:plModalCols,gap:12,marginBottom:20}}>
            {[{label:'Total Income',value:plData.totalThisInc,color:'#16a34a',bg:'#dcfce7'},{label:'Total Expense',value:plData.totalThisExp,color:'#dc2626',bg:'#fee2e2'},{label:'Net Surplus/Deficit',value:plData.totalThisInc-plData.totalThisExp,color:'#1e3a5f',bg:'#eff6ff'}].map(c=>(
              <div key={c.label} style={{backgroundColor:c.bg,borderRadius:10,padding:'14px 16px',borderLeft:`3px solid ${c.color}`}}>
                <p style={{fontSize:12,color:c.color,fontWeight:600,margin:'0 0 4px'}}>{c.label}</p>
                <p style={{fontSize: isMobile ? 18 : 22,fontWeight:800,color:c.color,margin:0}}>{fmt(c.value)}</p>
              </div>
            ))}
          </div>

          {/* ── Manual Ledger Reconciliation — compares system income for this period against a manually-entered cash book total ── */}
          <div style={{backgroundColor:'#fffbeb',border:'1px solid #fde68a',borderRadius:10,padding:14,marginBottom:20}}>
            <p style={{fontSize:12,fontWeight:700,color:'#92400e',margin:'0 0 8px'}}>⚠ Manual Ledger Reconciliation</p>
            <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
              <div style={{flex:'1 1 180px'}}>
                <label style={{...lStyle,marginBottom:4}}>Manual cash book income for this period</label>
                <input type="number" value={plManualIncome} onChange={e=>setPlManualIncome(e.target.value)} placeholder="Enter manual total" style={{...iStyle,width:'100%'}}/>
              </div>
              {plManualIncome!==''&&(()=>{
                const manualAmt=Number(plManualIncome)||0
                const diff=manualAmt-plData.totalThisInc
                const diffColor=diff===0?'#16a34a':'#dc2626'
                return (
                  <div style={{flex:'1 1 180px',backgroundColor:'white',borderRadius:8,padding:'10px 14px',border:`1px solid ${diffColor}33`}}>
                    <p style={{fontSize:11,color:'#64748b',margin:'0 0 2px'}}>Difference (Manual − System)</p>
                    <p style={{fontSize:16,fontWeight:800,color:diffColor,margin:0}}>{diff>=0?'+':''}{fmt(diff)}</p>
                  </div>
                )
              })()}
            </div>
          </div>

          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:10}}>
            <div style={{display:'flex',borderRadius:8,overflow:'hidden',border:'1px solid #e5e7eb'}}>
              <button onClick={()=>setPlShowDatewise(false)} style={{padding:'6px 14px',fontSize:12,fontWeight:600,cursor:'pointer',border:'none',backgroundColor:!plShowDatewise?'#1e3a5f':'#f8fafc',color:!plShowDatewise?'white':'#64748b'}}>By Category</button>
              <button onClick={()=>setPlShowDatewise(true)} style={{padding:'6px 14px',fontSize:12,fontWeight:600,cursor:'pointer',border:'none',backgroundColor:plShowDatewise?'#1e3a5f':'#f8fafc',color:plShowDatewise?'white':'#64748b'}}>Date-wise</button>
            </div>
          </div>

          {plShowDatewise?(
            <div>
              <h3 style={{fontSize:14,fontWeight:700,color:'#1e3a5f',marginBottom:10,borderBottom:'2px solid #eff6ff',paddingBottom:6}}>Date-wise Income &amp; Expenditure — {plPeriodLabel}</h3>
              {plDatewise.length===0?(
                <p style={{color:'#94a3b8',textAlign:'center',padding:20}}>No entries in this period.</p>
              ):(
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                  <thead><tr style={{backgroundColor:'#f8fafc'}}>{['Date','Income','Expenditure','Net'].map(h=><th key={h} style={{padding:'8px 10px',textAlign:h==='Date'?'left':'right',fontWeight:600,color:'#374151',fontSize:12,borderBottom:'1px solid #e2e8f0'}}>{h}</th>)}</tr></thead>
                  <tbody>
                    {plDatewise.map(d=>{
                      const net=d.income-d.expense
                      return (
                        <tr key={d.date} style={{borderBottom:'1px solid #f1f5f9'}}>
                          <td style={{padding:'7px 10px',color:'#374151'}}>{d.date}</td>
                          <td style={{padding:'7px 10px',textAlign:'right',fontWeight:600,color:'#16a34a'}}>{fmt(d.income)}</td>
                          <td style={{padding:'7px 10px',textAlign:'right',fontWeight:600,color:'#dc2626'}}>{fmt(d.expense)}</td>
                          <td style={{padding:'7px 10px',textAlign:'right',fontWeight:600,color:net>=0?'#16a34a':'#dc2626'}}>{fmt(net)}</td>
                        </tr>
                      )
                    })}
                    <tr style={{borderTop:'2px solid #1e3a5f'}}>
                      <td style={{padding:'8px 10px',fontWeight:700,color:'#1e293b'}}>Total</td>
                      <td style={{padding:'8px 10px',textAlign:'right',fontWeight:700,color:'#16a34a'}}>{fmt(plData.totalThisInc)}</td>
                      <td style={{padding:'8px 10px',textAlign:'right',fontWeight:700,color:'#dc2626'}}>{fmt(plData.totalThisExp)}</td>
                      <td style={{padding:'8px 10px',textAlign:'right',fontWeight:700,color:(plData.totalThisInc-plData.totalThisExp)>=0?'#16a34a':'#dc2626'}}>{fmt(plData.totalThisInc-plData.totalThisExp)}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          ):(
          <div style={{display:'grid',gridTemplateColumns:plContentCols,gap:20}}>
            {[{title:'Income',color:'#16a34a',bg:'#dcfce7',data:plData.thisInc,total:plData.totalThisInc},{title:'Expenditure',color:'#dc2626',bg:'#fee2e2',data:plData.thisExp,total:plData.totalThisExp}].map(sec=>(
              <div key={sec.title}>
                <h3 style={{fontSize:14,fontWeight:700,color:sec.color,marginBottom:10,borderBottom:`2px solid ${sec.bg}`,paddingBottom:6}}>{sec.title}</h3>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                  <tbody>
                    {Object.entries(sec.data).map(([k,v])=><tr key={k} style={{borderBottom:'1px solid #f1f5f9'}}><td style={{padding:'7px 0',color:'#374151'}}>{k}</td><td style={{padding:'7px 0',textAlign:'right',fontWeight:600,color:sec.color}}>{fmt(v)}</td></tr>)}
                    {Object.keys(sec.data).length===0&&<tr><td colSpan={2} style={{padding:'12px 0',color:'#94a3b8',textAlign:'center'}}>No {sec.title.toLowerCase()} in this period</td></tr>}
                    <tr style={{borderTop:`2px solid ${sec.color}`}}><td style={{padding:'8px 0',fontWeight:700,color:'#1e293b'}}>Total</td><td style={{padding:'8px 0',textAlign:'right',fontWeight:700,color:sec.color}}>{fmt(sec.total)}</td></tr>
                  </tbody>
                </table>
              </div>
            ))}
          </div>
          )}
        </div>
      </div>
    )}

    {/* ══ RECEIPT MODAL ══ */}
    {viewReceipt&&(
      <div onClick={()=>setViewReceipt(null)} style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.65)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding: isMobile ? 8 : 0}}>
        <div onClick={e=>e.stopPropagation()} style={{backgroundColor:'white',borderRadius:12,padding: isMobile ? 14 : 20,maxWidth:720,width:'100%',maxHeight:'90vh',overflow:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:8}}>
            <h3 style={{fontSize:16,fontWeight:600,color:'#1e3a5f',margin:0}}>🧾 Receipt Preview</h3>
            <div style={{display:'flex',gap:10}}>
              <a href={viewReceipt} target="_blank" rel="noopener noreferrer" style={{backgroundColor:'#eff6ff',color:'#1e3a5f',borderRadius:6,padding:'6px 14px',fontSize:13,fontWeight:600,textDecoration:'none'}}>↗ Open</a>
              <button onClick={()=>setViewReceipt(null)} style={{backgroundColor:'#fee2e2',color:'#dc2626',border:'none',borderRadius:6,padding:'6px 12px',fontSize:13,fontWeight:600,cursor:'pointer'}}>✖</button>
            </div>
          </div>
          {(viewReceipt.toLowerCase().endsWith('.pdf')||viewReceipt.includes('application/pdf'))?<iframe src={viewReceipt} title="Receipt PDF" style={{width:'100%',height: isMobile ? 320 : 520,border:'none',borderRadius:8}}/>:<img src={viewReceipt} alt="Receipt" style={{width:'100%',borderRadius:8,objectFit:'contain',maxHeight: isMobile ? 400 : 600}}/>}
        </div>
      </div>
    )}

  </div>
  )
}

export default Accounts