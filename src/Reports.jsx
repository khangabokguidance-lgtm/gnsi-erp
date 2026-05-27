import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { supabase } from './supabase'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import ExcelJS from 'exceljs'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts'

// ─── Source config ─────────────────────────────────────────────
const SOURCES = [
  {
    key: 'students', label: 'Students', icon: '🎓',
    table: 'students', dateCol: 'created_at',
    columns: [
      { key: 'name', label: 'Name' }, { key: 'gcc_no', label: 'GCC No.' },
      { key: 'batch', label: 'Batch' }, { key: 'course', label: 'Course' },
      { key: 'session', label: 'Session' }, { key: 'house', label: 'House' },
      { key: 'hostel_type', label: 'Hostel Type' }, { key: 'gender', label: 'Gender' },
      { key: 'phone', label: 'Phone' }, { key: 'father_name', label: 'Father' },
      { key: 'dob', label: 'DOB' }, { key: 'admission_date', label: 'Adm. Date' },
      { key: 'status', label: 'Status' }, { key: 'created_at', label: 'Joined' },
    ],
    statusCol: 'status', groupCols: ['house', 'course', 'batch', 'gender', 'hostel_type', 'session'], aggregates: [],
  },
  {
    key: 'admissions', label: 'Admissions', icon: '📋',
    table: 'admissions', dateCol: 'created_at',
    columns: [
      { key: 'applicant_name', label: 'Name' }, { key: 'gcc_no', label: 'GCC No.' },
      { key: 'course', label: 'Course' }, { key: 'batch', label: 'Batch' },
      { key: 'hostel_type', label: 'Hostel Type' }, { key: 'gender', label: 'Gender' },
      { key: 'phone', label: 'Phone' }, { key: 'source', label: 'Source' },
      { key: 'status', label: 'Status' }, { key: 'created_at', label: 'Date' },
    ],
    statusCol: 'status', groupCols: ['course', 'batch', 'gender', 'hostel_type', 'status'], aggregates: [],
  },
  {
    key: 'fees', label: 'Fees', icon: '💰',
    table: 'fees', dateCol: 'due_date',
    columns: [
      { key: 'student_id', label: 'Student ID' }, { key: 'amount', label: 'Amount (₹)' },
      { key: 'paid', label: 'Paid (₹)' }, { key: 'due_date', label: 'Due Date' },
    ],
    statusCol: null, groupCols: [], aggregates: ['amount', 'paid'],
  },
  {
    key: 'fee_invoices', label: 'Fee Invoices', icon: '🧾',
    table: 'fee_invoices', dateCol: 'due_date',
    columns: [
      { key: 'student_name', label: 'Student' }, { key: 'gcc_no', label: 'GCC No.' },
      { key: 'course', label: 'Course' }, { key: 'hostel_type', label: 'Hostel' },
      { key: 'fee_type', label: 'Fee Type' }, { key: 'invoice_month', label: 'Month' },
      { key: 'total_amount', label: 'Total (₹)' }, { key: 'amount_paid', label: 'Paid (₹)' },
      { key: 'amount_due', label: 'Due (₹)' }, { key: 'status', label: 'Status' },
      { key: 'due_date', label: 'Due Date' }, { key: 'session_year', label: 'Session' },
    ],
    statusCol: 'status', groupCols: ['course', 'hostel_type', 'fee_type', 'status', 'session_year'],
    aggregates: ['total_amount', 'amount_paid', 'amount_due'],
  },
  {
    key: 'adm_fee_collections', label: 'Fee Collections', icon: '💵',
    table: 'adm_fee_collections', dateCol: 'pay_date',
    columns: [
      { key: 'student_name', label: 'Student' }, { key: 'adm_app_id', label: 'Adm. No.' },
      { key: 'fee_type', label: 'Fee Type' }, { key: 'amount_paid', label: 'Amount (₹)' },
      { key: 'pay_date', label: 'Pay Date' }, { key: 'pay_mode', label: 'Mode' },
      { key: 'collected_by', label: 'Collected By' },
    ],
    statusCol: null, groupCols: ['fee_type', 'pay_mode'], aggregates: ['amount_paid'],
  },
  {
    key: 'accounts', label: 'Accounts', icon: '🧾',
    table: 'accounts', dateCol: 'entry_date',
    columns: [
      { key: 'entry_date', label: 'Date' }, { key: 'type', label: 'Type' },
      { key: 'category', label: 'Category' }, { key: 'amount', label: 'Amount (₹)' },
      { key: 'payment_mode', label: 'Mode' }, { key: 'note', label: 'Note' },
    ],
    statusCol: 'type', groupCols: ['type', 'category', 'payment_mode'], aggregates: ['amount'],
  },
  {
    key: 'attendance', label: 'Attendance', icon: '📅',
    table: 'attendance', dateCol: 'date',
    columns: [
      { key: 'student_id', label: 'Student ID' }, { key: 'status', label: 'Status' }, { key: 'date', label: 'Date' },
    ],
    statusCol: 'status', groupCols: ['status'], aggregates: [],
  },
  {
    key: 'exams', label: 'Exams', icon: '📝',
    table: 'exams', dateCol: 'date',
    columns: [
      { key: 'subject', label: 'Subject' }, { key: 'date', label: 'Date' }, { key: 'time', label: 'Time' },
    ],
    statusCol: null, groupCols: [], aggregates: [],
  },
  {
    key: 'exam_scores', label: 'Exam Scores', icon: '📊',
    table: 'exam_scores', dateCol: 'created_at',
    columns: [
      { key: 'student_id', label: 'Student ID' }, { key: 'exam_name', label: 'Exam' },
      { key: 'session', label: 'Session' }, { key: 'Mathematics', label: 'Math' },
      { key: 'Science', label: 'Science' }, { key: 'English', label: 'English' },
      { key: 'Hindi', label: 'Hindi' }, { key: 'GK', label: 'GK' },
      { key: 'Reasoning', label: 'Reasoning' }, { key: 'total', label: 'Total' },
    ],
    statusCol: null, groupCols: ['session', 'exam_name'], aggregates: ['total'],
  },
  {
    key: 'staff_profiles', label: 'Staff', icon: '👨‍🏫',
    table: 'staff_profiles', dateCol: 'created_at',
    columns: [
      { key: 'name', label: 'Name' }, { key: 'department', label: 'Department' },
      { key: 'role', label: 'Role' }, { key: 'status', label: 'Status' },
      { key: 'basic_salary', label: 'Basic (₹)' }, { key: 'seniority_allowance', label: 'Seniority (₹)' },
      { key: 'loyalty_bonus', label: 'Loyalty (₹)' }, { key: 'role_bonus', label: 'Role Bonus (₹)' },
      { key: 'phone', label: 'Phone' }, { key: 'created_at', label: 'Joined' },
    ],
    statusCol: 'status', groupCols: ['department', 'role', 'status'], aggregates: ['basic_salary'],
  },
  {
    key: 'salary', label: 'Salary', icon: '💵',
    table: 'salary', dateCol: null,
    columns: [{ key: 'amount', label: 'Amount (₹)' }, { key: 'status', label: 'Status' }],
    statusCol: 'status', groupCols: ['status'], aggregates: ['amount'],
  },
  {
    key: 'leave', label: 'Leave', icon: '🏖️',
    table: 'leave', dateCol: 'created_at',
    columns: [
      { key: 'type', label: 'Type' }, { key: 'from_date', label: 'From' },
      { key: 'to_date', label: 'To' }, { key: 'status', label: 'Status' },
      { key: 'created_at', label: 'Applied On' },
    ],
    statusCol: 'status', groupCols: ['type', 'status'], aggregates: [],
  },
  {
    key: 'staff_tasks', label: 'Tasks', icon: '✅',
    table: 'staff_tasks', dateCol: 'due_date',
    columns: [
      { key: 'title', label: 'Task' }, { key: 'department', label: 'Department' },
      { key: 'status', label: 'Status' }, { key: 'due_date', label: 'Due Date' },
    ],
    statusCol: 'status', groupCols: ['department', 'status'], aggregates: [],
  },
  {
    key: 'course_enrollments', label: 'Enrollments', icon: '🗂️',
    table: 'course_enrollments', dateCol: 'enrolled_at',
    columns: [
      { key: 'student_name', label: 'Student' }, { key: 'gcc_no', label: 'GCC No.' },
      { key: 'course', label: 'Course' }, { key: 'subtype', label: 'Batch' },
      { key: 'hostel_type', label: 'Hostel' }, { key: 'session_year', label: 'Session' },
      { key: 'enrolled_at', label: 'Enrolled On' }, { key: 'status', label: 'Status' },
    ],
    statusCol: 'status', groupCols: ['course', 'subtype', 'hostel_type', 'session_year', 'status'], aggregates: [],
  },
  {
    key: 'hostel_rooms', label: 'Hostel Rooms', icon: '🛏️',
    table: 'hostel_rooms', dateCol: null,
    columns: [
      { key: 'block', label: 'Block' }, { key: 'total_beds', label: 'Total Beds' }, { key: 'occupied_beds', label: 'Occupied' },
    ],
    statusCol: null, groupCols: ['block'], aggregates: ['total_beds', 'occupied_beds'],
  },
  {
    key: 'hostel_incidents', label: 'Hostel Incidents', icon: '⚠️',
    table: 'hostel_incidents', dateCol: 'incident_date',
    columns: [
      { key: 'incident_date', label: 'Date' }, { key: 'type', label: 'Type' }, { key: 'severity', label: 'Severity' },
    ],
    statusCol: 'severity', groupCols: ['type', 'severity'], aggregates: [],
  },
  {
    key: 'notices', label: 'Notices', icon: '🔔',
    table: 'notices', dateCol: 'created_at',
    columns: [
      { key: 'title', label: 'Title' }, { key: 'content', label: 'Content' }, { key: 'created_at', label: 'Date' },
    ],
    statusCol: null, groupCols: [], aggregates: [],
  },
]

const SOURCE_GROUPS = [
  { label: 'Students & Admissions', keys: ['students', 'admissions', 'course_enrollments'] },
  { label: 'Finance', keys: ['fees', 'fee_invoices', 'adm_fee_collections', 'accounts', 'salary'] },
  { label: 'Academic & Staff', keys: ['attendance', 'exams', 'exam_scores', 'staff_profiles', 'leave', 'staff_tasks'] },
  { label: 'Hostel & Admin', keys: ['hostel_rooms', 'hostel_incidents', 'notices'] },
]

const BUILTIN_PRESETS = [
  { id: 'fee-defaulters', label: '⚠️ Fee Defaulters', builtin: true, config: { sourceKey: 'fee_invoices', selectedCols: ['student_name','gcc_no','course','hostel_type','invoice_month','total_amount','amount_paid','amount_due','status'], statusFilter: 'All', search: '', dateFrom: '', dateTo: '', groupBy: 'course', sortCol: 'amount_due', sortDir: 'desc' }, postFilter: (rows) => rows.filter(r => parseFloat(r.amount_due || 0) > 0) },
  { id: 'active-students', label: '✅ Active Students', builtin: true, config: { sourceKey: 'students', selectedCols: ['name','gcc_no','batch','course','session','house','hostel_type','status'], statusFilter: 'Active', search: '', dateFrom: '', dateTo: '', groupBy: 'house', sortCol: 'name', sortDir: 'asc' }, postFilter: null },
  { id: 'pending-admissions', label: '⏳ Pending Admissions', builtin: true, config: { sourceKey: 'admissions', selectedCols: ['applicant_name','gcc_no','course','batch','hostel_type','status'], statusFilter: 'Applied', search: '', dateFrom: '', dateTo: '', groupBy: '', sortCol: 'created_at', sortDir: 'desc' }, postFilter: null },
  { id: 'boarders', label: '🏠 Boarders', builtin: true, config: { sourceKey: 'students', selectedCols: ['name','gcc_no','batch','course','session','house','hostel_type','phone','status'], statusFilter: 'Active', search: '', dateFrom: '', dateTo: '', groupBy: 'house', sortCol: 'name', sortDir: 'asc' }, postFilter: (rows) => rows.filter(r => r.hostel_type === 'Boarder') },
  { id: 'fee-collections-today', label: "💰 Today's Collections", builtin: true, config: { sourceKey: 'adm_fee_collections', selectedCols: ['student_name','adm_app_id','fee_type','amount_paid','pay_date','pay_mode','collected_by'], statusFilter: 'All', search: '', dateFrom: new Date().toISOString().slice(0,10), dateTo: new Date().toISOString().slice(0,10), groupBy: 'fee_type', sortCol: 'pay_date', sortDir: 'desc' }, postFilter: null },
  { id: 'staff-active', label: '👨‍🏫 Active Staff', builtin: true, config: { sourceKey: 'staff_profiles', selectedCols: ['name','department','role','basic_salary','status'], statusFilter: 'Active', search: '', dateFrom: '', dateTo: '', groupBy: 'department', sortCol: 'name', sortDir: 'asc' }, postFilter: null },
  { id: 'course-enrollments', label: '🗂️ All Enrollments', builtin: true, config: { sourceKey: 'course_enrollments', selectedCols: ['student_name','gcc_no','course','subtype','hostel_type','session_year','status'], statusFilter: 'Active', search: '', dateFrom: '', dateTo: '', groupBy: 'course', sortCol: 'student_name', sortDir: 'asc' }, postFilter: null },
]

const DEFAULT_INSTITUTE = { name: 'Guidance Navodaya & Sainik Institute', address: 'Khangabok Sorok Wangma, Thoubal, Manipur', phone: '+91-8974298074' }
const CHART_COLORS = ['#1e3a5f','#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316']
const POSITIVE = new Set(['Confirmed','Paid','Present','Passed','Occupied','Approved','Active','Enrolled','Completed','Income'])
const NEGATIVE  = new Set(['Pending','Absent','Vacant','Rejected','Unpaid','Failed','Cancelled','Dropped','Overdue','Expense'])

// ─── Helpers ──────────────────────────────────────────────────
function fmt(v) {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) { const d = new Date(v); return isNaN(d) ? v : d.toLocaleDateString('en-IN') }
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) { const d = new Date(v); return isNaN(d) ? v : d.toLocaleDateString('en-IN') }
  return v
}

function StatusBadge({ value }) {
  if (!value) return <span style={{ color: '#94a3b8' }}>—</span>
  const isPos = POSITIVE.has(value), isNeg = NEGATIVE.has(value)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700,
      background: isPos ? '#dcfce7' : isNeg ? '#fee2e2' : '#fef3c7',
      color: isPos ? '#16a34a' : isNeg ? '#dc2626' : '#92400e',
    }}>{value}</span>
  )
}

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <span style={{ color: '#cbd5e1', marginLeft: 4, fontSize: 10 }}>↕</span>
  return <span style={{ color: '#3b82f6', marginLeft: 4, fontSize: 10 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
}

// ─── CSS ──────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
  .rpt-root * { box-sizing: border-box; }
  .rpt-root { font-family: 'DM Sans', system-ui, sans-serif; background: #f0f4f8; min-height: 100vh; }
  .rpt-root input, .rpt-root select, .rpt-root textarea, .rpt-root button { font-family: inherit; }
  .rpt-root input:focus, .rpt-root select:focus { outline: 2px solid #1e3a5f; outline-offset: 1px; }
  .rpt-card { background: white; border-radius: 16px; box-shadow: 0 1px 4px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.04); border: 1px solid #e8edf2; }
  .rpt-input { width: 100%; padding: 10px 14px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: 14px; background: #fafbfc; color: #1e293b; transition: border-color .15s; }
  .rpt-input:focus { border-color: #1e3a5f; background: white; }
  .rpt-btn-primary { background: linear-gradient(135deg,#1e3a5f,#2d5490); color: white; border: none; border-radius: 10px; padding: 11px 20px; font-weight: 700; font-size: 14px; cursor: pointer; transition: all .15s; white-space: nowrap; }
  .rpt-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(30,58,95,.3); }
  .rpt-btn-primary:disabled { opacity: .5; cursor: not-allowed; transform: none; }
  .rpt-src-btn { padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all .15s; border: 1.5px solid transparent; white-space: nowrap; background: #f1f5f9; color: #475569; }
  .rpt-src-btn:hover { background: #e2e8f0; }
  .rpt-src-btn.active { background: #1e3a5f; color: white; border-color: #1e3a5f; box-shadow: 0 2px 8px rgba(30,58,95,.25); }
  .rpt-preset-btn { padding: 7px 13px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1.5px solid #f59e0b44; background: #fffbeb; color: #92400e; transition: all .15s; white-space: nowrap; }
  .rpt-preset-btn:hover { background: #fef3c7; border-color: #f59e0b; }
  .rpt-preset-btn.custom { border-color: #e2e8f0; background: #f8fafc; color: #475569; }
  .rpt-preset-btn.custom:hover { background: #f1f5f9; }
  .rpt-col-chip { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: grab; user-select: none; transition: all .15s; border: 1.5px solid transparent; }
  .rpt-col-chip.on { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
  .rpt-col-chip.off { background: #f8fafc; color: #94a3b8; border-color: #e2e8f0; }
  .rpt-col-chip:active { cursor: grabbing; opacity: .6; transform: scale(.95); }
  .rpt-export-btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; border-radius: 9px; font-size: 13px; font-weight: 700; cursor: pointer; border: none; transition: all .15s; white-space: nowrap; }
  .rpt-export-btn:hover { transform: translateY(-1px); }
  .rpt-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .rpt-table th { padding: 11px 14px; text-align: left; font-weight: 700; font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: .04em; background: #f8fafc; border-bottom: 1.5px solid #e8edf2; white-space: nowrap; cursor: pointer; user-select: none; }
  .rpt-table th:hover { color: #1e3a5f; }
  .rpt-table td { padding: 11px 14px; border-bottom: 1px solid #f1f5f9; color: #374151; vertical-align: middle; }
  .rpt-table tr:hover td { background: #f8fafc; }
  .rpt-table tr:last-child td { border-bottom: none; }
  .rpt-stat-card { background: white; border-radius: 14px; padding: 18px 20px; border: 1px solid #e8edf2; box-shadow: 0 1px 3px rgba(0,0,0,.05); }
  .rpt-group-hdr { background: linear-gradient(90deg,#f0f4f8,#f8fafc); padding: 9px 16px; font-size: 11px; font-weight: 800; color: #1e3a5f; text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid #e8edf2; display: flex; justify-content: space-between; align-items: center; }
  .rpt-tab { padding: 9px 18px; font-size: 13px; font-weight: 700; cursor: pointer; border: none; background: none; transition: all .15s; border-radius: 8px; color: #64748b; }
  .rpt-tab.active { background: #1e3a5f; color: white; }
  .rpt-section-label { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; color: #94a3b8; margin-bottom: 8px; display: block; }
  .rpt-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; border-radius: 99px; font-size: 11px; font-weight: 700; }
  .rpt-mono { font-family: 'DM Mono', monospace; }
  @media (max-width: 768px) {
    .rpt-grid-3 { grid-template-columns: 1fr 1fr !important; }
    .rpt-grid-4 { grid-template-columns: 1fr 1fr !important; }
    .rpt-hide-mob { display: none !important; }
    .rpt-full-mob { width: 100% !important; }
    .rpt-stack-mob { flex-direction: column !important; }
    .rpt-px-mob { padding-left: 12px !important; padding-right: 12px !important; }
  }
  @media (max-width: 480px) {
    .rpt-grid-3, .rpt-grid-4 { grid-template-columns: 1fr !important; }
    .rpt-stat-grid { grid-template-columns: 1fr 1fr !important; }
  }
  @keyframes rpt-fade-in { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
  .rpt-fade-in { animation: rpt-fade-in .25s ease both; }
`

// ─── Main Component ────────────────────────────────────────────
export default function Reports() {
  const [sourceKey,     setSourceKey]     = useState('students')
  const [search,        setSearch]        = useState('')
  const [statusFilter,  setStatusFilter]  = useState('All')
  const [selectedCols,  setSelectedCols]  = useState([])
  const [dateFrom,      setDateFrom]      = useState('')
  const [dateTo,        setDateTo]        = useState('')
  const [groupBy,       setGroupBy]       = useState('')
  const [sortCol,       setSortCol]       = useState('')
  const [sortDir,       setSortDir]       = useState('asc')
  const [allRows,       setAllRows]       = useState([])
  const [rows,          setRows]          = useState([])
  const [loading,       setLoading]       = useState(false)
  const [generated,     setGenerated]     = useState(false)
  const [error,         setError]         = useState('')
  const [page,          setPage]          = useState(1)
  const PAGE_SIZE = 50

  const [institute,     setInstitute]     = useState(DEFAULT_INSTITUTE)
  const [logoDataUrl,   setLogoDataUrl]   = useState('')
  const [watermark,     setWatermark]     = useState('')
  const [activeTab,     setActiveTab]     = useState('table')
  const [showInstHdr,   setShowInstHdr]   = useState(false)
  const [showFilters,   setShowFilters]   = useState(true)

  const [savedPresets,  setSavedPresets]  = useState(() => { try { return JSON.parse(localStorage.getItem('gnsi_report_presets') || '[]') } catch { return [] } })
  const [presetName,    setPresetName]    = useState('')
  const [showPresetBox, setShowPresetBox] = useState(false)
  const [reportLog,     setReportLog]     = useState(() => { try { return JSON.parse(localStorage.getItem('gnsi_report_log') || '[]') } catch { return [] } })
  const [showLog,       setShowLog]       = useState(false)

  const fileRef = useRef(null)
  const source  = SOURCES.find(s => s.key === sourceKey) || SOURCES[0]
  const [dragIdx, setDragIdx] = useState(null)

  const handleDragStart = (i) => setDragIdx(i)
  const handleDragOver  = (e, i) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === i) return
    const next = [...selectedCols]; const [moved] = next.splice(dragIdx, 1); next.splice(i, 0, moved)
    setSelectedCols(next); setDragIdx(i)
  }
  const handleDragEnd = () => setDragIdx(null)

  const activeCols = useMemo(() => {
    const base = selectedCols.length ? selectedCols : source.columns.map(c => c.key)
    return base.map(k => source.columns.find(c => c.key === k)).filter(Boolean)
  }, [selectedCols, source])

  const handleSourceChange = (key) => {
    const s = SOURCES.find(x => x.key === key)
    setSourceKey(key); setSelectedCols(s.columns.map(c => c.key))
    setAllRows([]); setRows([]); setGenerated(false)
    setStatusFilter('All'); setSearch(''); setError('')
    setPage(1); setGroupBy(''); setSortCol(''); setDateFrom(''); setDateTo('')
  }

  const toggleCol = (key) => setSelectedCols(prev => prev.includes(key) ? (prev.length === 1 ? prev : prev.filter(k => k !== key)) : [...prev, key])

  const applyFilters = useCallback((raw) => {
    let data = [...raw]
    if (source.dateCol && dateFrom) data = data.filter(r => r[source.dateCol] && r[source.dateCol] >= dateFrom)
    if (source.dateCol && dateTo)   data = data.filter(r => r[source.dateCol] && r[source.dateCol] <= dateTo + 'T23:59:59')
    if (source.statusCol && statusFilter !== 'All') data = data.filter(r => r[source.statusCol] === statusFilter)
    const q = search.toLowerCase()
    if (q) data = data.filter(r => Object.values(r).some(v => String(v || '').toLowerCase().includes(q)))
    if (sortCol) data.sort((a, b) => { const av = a[sortCol] ?? '', bv = b[sortCol] ?? ''; const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true }); return sortDir === 'asc' ? cmp : -cmp })
    return data
  }, [source, dateFrom, dateTo, statusFilter, search, sortCol, sortDir])

  useEffect(() => { if (allRows.length || generated) { setRows(applyFilters(allRows)); setPage(1) } }, [allRows, applyFilters, generated])

  const handleGenerate = async () => {
    setLoading(true); setError('')
    try {
      const { data: d, error: err } = await supabase.from(source.table).select('*')
      if (err) throw err
      const data = d || []
      setAllRows(data); setGenerated(true)
      if (!selectedCols.length) setSelectedCols(source.columns.map(c => c.key))
      const entry = { id: Date.now(), source: source.label, filters: { statusFilter, search, dateFrom, dateTo }, total: data.length, at: new Date().toLocaleString('en-IN') }
      const nextLog = [entry, ...reportLog].slice(0, 50)
      setReportLog(nextLog); localStorage.setItem('gnsi_report_log', JSON.stringify(nextLog))
    } catch (e) { setError(e.message || 'Failed to fetch') }
    setLoading(false)
  }

  const savePreset = () => {
    if (!presetName.trim()) return
    const preset = { id: Date.now(), label: presetName.trim(), builtin: false, config: { sourceKey, selectedCols, statusFilter, search, dateFrom, dateTo, groupBy, sortCol, sortDir }, postFilter: null }
    const next = [...savedPresets, preset]; setSavedPresets(next); localStorage.setItem('gnsi_report_presets', JSON.stringify(next))
    setPresetName(''); setShowPresetBox(false)
  }

  const deletePreset = (id) => { const next = savedPresets.filter(p => p.id !== id); setSavedPresets(next); localStorage.setItem('gnsi_report_presets', JSON.stringify(next)) }

  const loadPreset = (preset) => {
    const c = preset.config; const s = SOURCES.find(x => x.key === c.sourceKey) || source
    setSourceKey(c.sourceKey); setSelectedCols(c.selectedCols || s.columns.map(col => col.key))
    setStatusFilter(c.statusFilter || 'All'); setSearch(c.search || '')
    setDateFrom(c.dateFrom || ''); setDateTo(c.dateTo || '')
    setGroupBy(c.groupBy || ''); setSortCol(c.sortCol || ''); setSortDir(c.sortDir || 'asc')
    setAllRows([]); setRows([]); setGenerated(false); setPage(1)
  }

  const groupedRows = useMemo(() => {
    if (!groupBy) return null
    const map = {}
    rows.forEach(r => { const k = r[groupBy] || '(Unset)'; if (!map[k]) map[k] = []; map[k].push(r) })
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]))
  }, [rows, groupBy])

  const aggregates = useMemo(() => {
    const out = {}; source.aggregates.forEach(col => { out[col] = rows.reduce((s, r) => s + parseFloat(r[col] || 0), 0) }); return out
  }, [rows, source])

  const chartData = useMemo(() => {
    if (!source.statusCol) return []
    const map = {}; rows.forEach(r => { const v = r[source.statusCol] || 'Unknown'; map[v] = (map[v] || 0) + 1 })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [rows, source])

  const groupChartData = useMemo(() => {
    if (!groupBy) return []
    const map = {}; rows.forEach(r => { const k = r[groupBy] || '(Unset)'; map[k] = (map[k] || 0) + 1 })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [rows, groupBy])

  const availableStatuses = useMemo(() => {
    if (!source.statusCol) return []
    const vals = [...new Set(allRows.map(r => r[source.statusCol]).filter(Boolean))]
    return ['All', ...vals]
  }, [allRows, source])

  const handleSort = (key) => { if (sortCol === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortCol(key); setSortDir('asc') } }
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const pagedRows  = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const handleLogo = (e) => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = ev => setLogoDataUrl(ev.target.result); reader.readAsDataURL(file) }

  const now = new Date()
  const generatedText = now.toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })
  const fileStamp     = now.toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const positiveCount = rows.filter(r => source.statusCol && POSITIVE.has(r[source.statusCol])).length
  const negativeCount = rows.filter(r => source.statusCol && NEGATIVE.has(r[source.statusCol])).length
  const allPresets    = [...BUILTIN_PRESETS, ...savedPresets]

  // ── Export helpers (same logic as original) ───────────────────
  const exportPdf = () => {
    const isWide = activeCols.length > 6
    const doc    = new jsPDF(isWide ? 'l' : 'p', 'pt', 'a4')
    const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight()
    const mx = 36, navy=[15,40,80], steel=[30,58,95], sky=[56,96,156], silver=[241,245,249], muted=[100,116,139], white=[255,255,255], gold=[180,140,40]
    doc.setFillColor(...navy); doc.rect(0,0,pw,110,'F')
    doc.setFillColor(...gold); doc.rect(0,0,pw,3,'F')
    let logoX=mx
    if(logoDataUrl){ const ext=logoDataUrl.split(';')[0].split('/')[1].toUpperCase(); try{doc.addImage(logoDataUrl,ext==='SVG'?'PNG':ext,mx,18,70,70);logoX=mx+82}catch{logoX=mx} }
    else { doc.setFillColor(...sky);doc.circle(mx+35,55,35,'F');doc.setFont('helvetica','bold').setFontSize(26).setTextColor(...white);doc.text('G',mx+35,62,{align:'center'});logoX=mx+82 }
    doc.setFont('helvetica','bold').setFontSize(16).setTextColor(...white); doc.text(institute.name,logoX,40)
    doc.setFont('helvetica','normal').setFontSize(9).setTextColor(180,200,230); doc.text(institute.address,logoX,56); doc.text(`Phone: ${institute.phone}`,logoX,70)
    const bW=120,bH=28,bX=pw-mx-bW,bY=18; doc.setFillColor(...sky);doc.roundedRect(bX,bY,bW,bH,4,4,'F')
    doc.setFont('helvetica','bold').setFontSize(10).setTextColor(...white); doc.text(`${source.label} Report`,bX+bW/2,bY+18,{align:'center'})
    const ribbonY=110; doc.setFillColor(...silver);doc.rect(0,ribbonY,pw,48,'F')
    const si=[{label:'Total Records',value:String(rows.length)},{label:'Status Filter',value:statusFilter},{label:'Date From',value:dateFrom||'All'},{label:'Date To',value:dateTo||'All'}]
    const boxW=(pw-mx*2)/si.length
    si.forEach((item,i)=>{ const bx=mx+i*boxW; if(i>0){doc.setDrawColor(200,210,220).setLineWidth(0.5);doc.line(bx,ribbonY+8,bx,ribbonY+40)} doc.setFont('helvetica','normal').setFontSize(8).setTextColor(...muted);doc.text(item.label.toUpperCase(),bx+boxW/2,ribbonY+18,{align:'center'});doc.setFont('helvetica','bold').setFontSize(11).setTextColor(...steel);doc.text(item.value,bx+boxW/2,ribbonY+34,{align:'center'}) })
    doc.setFillColor(...gold);doc.rect(0,ribbonY+48,pw,2,'F')
    let tY=ribbonY+58
    autoTable(doc,{ startY:tY, head:[['#',...activeCols.map(c=>c.label)]], body:rows.map((row,i)=>[i+1,...activeCols.map(c=>fmt(row[c.key]))]), styles:{font:'helvetica',fontSize:8,cellPadding:{top:5,bottom:5,left:6,right:6},valign:'middle',textColor:[30,41,59]}, headStyles:{fillColor:steel,textColor:white,fontStyle:'bold',fontSize:8}, alternateRowStyles:{fillColor:[248,250,252]}, margin:{left:mx,right:mx,bottom:52}, didDrawPage:()=>{ const p=doc.internal.getCurrentPageInfo().pageNumber,t=doc.internal.getNumberOfPages(); doc.setFillColor(...silver);doc.rect(0,ph-38,pw,38,'F');doc.setFont('helvetica','normal').setFontSize(8).setTextColor(...muted);doc.text(`${institute.name}  •  ${source.label} Report  •  Confidential`,mx,ph-16);doc.text(`Printed: ${generatedText}`,pw/2,ph-16,{align:'center'});const pill=`Page ${p} of ${t}`,pW=70,pH2=16,pX=pw-mx-pW,pY=ph-28;doc.setFillColor(...steel);doc.roundedRect(pX,pY,pW,pH2,3,3,'F');doc.setFont('helvetica','bold').setFontSize(8).setTextColor(...white);doc.text(pill,pX+pW/2,pY+11,{align:'center'}) } })
    doc.save(`GNSI-${source.label}-Report-${fileStamp}.pdf`)
  }

  const exportExcel = async () => {
    const wb=new ExcelJS.Workbook(); wb.creator=institute.name; wb.created=new Date()
    const ws=wb.addWorksheet(`${source.label} Report`); const totalCols=activeCols.length+1
    const addRow=(val,font,align='center')=>{ const ri=ws.rowCount+1; ws.mergeCells(`A${ri}:${String.fromCharCode(64+totalCols)}${ri}`); const cell=ws.getCell(`A${ri}`); cell.value=val; cell.font=font; cell.alignment={horizontal:align,vertical:'middle'} }
    addRow(institute.name,{bold:true,size:16,color:{argb:'FF1E3A5F'}}); addRow(institute.address,{size:11,color:{argb:'FF475569'}}); addRow(`Phone: ${institute.phone}`,{size:10,color:{argb:'FF475569'}}); addRow(`Print Date: ${generatedText}`,{italic:true,size:10,color:{argb:'FF64748B'}}); addRow(`${source.label} Report`,{bold:true,size:14,color:{argb:'FF1E3A5F'}}); addRow(`Status=${statusFilter} | Total=${rows.length}`,{italic:true,size:9,color:{argb:'FF94A3B8'}}); ws.addRow([])
    const hdr=ws.addRow(['#',...activeCols.map(c=>c.label)]); hdr.font={bold:true,color:{argb:'FFFFFFFF'},size:11}; hdr.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1E3A5F'}}; hdr.alignment={horizontal:'center',vertical:'middle'}; hdr.height=24
    rows.forEach((row,i)=>{ const r=ws.addRow([i+1,...activeCols.map(c=>fmt(row[c.key]))]); r.alignment={vertical:'middle'}; if(i%2===1)r.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF8FAFC'}} })
    ws.columns=[{width:6},...activeCols.map(()=>({width:22}))]
    const buf=await wb.xlsx.writeBuffer(); const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`GNSI-${source.label}-Report-${fileStamp}.xlsx`; a.click(); URL.revokeObjectURL(url)
  }

  const exportCsv = () => {
    const headers=['#',...activeCols.map(c=>c.label)].join(',')
    const body=rows.map((row,i)=>[i+1,...activeCols.map(c=>{const v=fmt(row[c.key]);return typeof v==='string'&&v.includes(',')? `"${v}"`:v})].join(',')).join('\n')
    const blob=new Blob([headers+'\n'+body],{type:'text/csv'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`GNSI-${source.label}-${fileStamp}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  const exportWord = () => {
    const headers=['#',...activeCols.map(c=>c.label)].map(h=>`<th style="border:1px solid #cbd5e1;padding:8px 12px;background:#1e3a5f;color:#fff;font-size:12px;">${h}</th>`).join('')
    const body=rows.map((row,i)=>`<tr>${[i+1,...activeCols.map(c=>fmt(row[c.key]))].map(v=>`<td style="border:1px solid #e2e8f0;padding:8px 12px;font-size:12px;">${v}</td>`).join('')}</tr>`).join('')
    const html=`<html><head><meta charset="utf-8"/></head><body style="font-family:Arial,sans-serif;margin:30px;"><div style="border-bottom:2px solid #1e3a5f;padding-bottom:12px;margin-bottom:16px;"><div style="font-size:18px;font-weight:700;color:#1e3a5f;">${institute.name}</div><div style="font-size:12px;color:#475569;">${institute.address} | ${institute.phone}</div><div style="font-size:12px;color:#475569;">Report: ${source.label} | Date: ${generatedText} | Total: ${rows.length}</div></div><table style="width:100%;border-collapse:collapse;"><thead><tr>${headers}</tr></thead><tbody>${body}</tbody></table></body></html>`
    const blob=new Blob([html],{type:'application/msword'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`GNSI-${source.label}-Report-${fileStamp}.doc`; a.click(); URL.revokeObjectURL(url)
  }

  const handlePrint = () => {
    const headers=['#',...activeCols.map(c=>c.label)].map(h=>`<th style="border:1px solid #cbd5e1;padding:8px 10px;background:#1e3a5f;color:#fff;font-size:11px;">${h}</th>`).join('')
    const body=rows.map((row,i)=>`<tr>${[i+1,...activeCols.map(c=>fmt(row[c.key]))].map(v=>`<td style="border:1px solid #e2e8f0;padding:8px 10px;font-size:11px;">${v}</td>`).join('')}</tr>`).join('')
    const win=window.open('','_blank','width=1050,height=750'); if(!win)return
    win.document.write(`<html><head><meta charset="utf-8"/><style>body{font-family:Arial,sans-serif;padding:22px;}table{width:100%;border-collapse:collapse;}@page{margin:14mm;}</style></head><body><div style="border-bottom:2px solid #1e3a5f;padding-bottom:12px;margin-bottom:16px;display:flex;justify-content:space-between;"><div><div style="font-size:18px;font-weight:700;color:#1e3a5f;">${institute.name}</div><div style="font-size:11px;color:#475569;">${institute.address} | ${institute.phone}</div></div><div style="text-align:right;font-size:11px;color:#475569;"><strong>${source.label} Report</strong><br/>Date: ${generatedText}<br/>Total: ${rows.length}</div></div><table><thead><tr>${headers}</tr></thead><tbody>${body}</tbody></table><script>window.onload=function(){window.print();setTimeout(()=>window.close(),400)}<\/script></body></html>`)
    win.document.close()
  }

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="rpt-root">
      <style>{CSS}</style>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '20px 16px' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e3a5f', margin: 0, letterSpacing: '-.02em' }}>
              📈 Report Generator
            </h1>
            <p style={{ color: '#64748b', fontSize: 13, margin: '4px 0 0' }}>
              {SOURCES.length} modules · PDF · Excel · CSV · Word · Print
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setShowInstHdr(v => !v)}
              style={{ padding: '8px 14px', borderRadius: 9, border: '1.5px solid #e2e8f0', background: showInstHdr ? '#1e3a5f' : 'white', color: showInstHdr ? 'white' : '#475569', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              🏫 Header
            </button>
            <button onClick={() => setShowLog(v => !v)}
              style={{ padding: '8px 14px', borderRadius: 9, border: '1.5px solid #e2e8f0', background: showLog ? '#1e3a5f' : 'white', color: showLog ? 'white' : '#475569', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              📋 Log ({reportLog.length})
            </button>
          </div>
        </div>

        {/* ── Institute Header (collapsible) ── */}
        {showInstHdr && (
          <div className="rpt-card rpt-fade-in" style={{ padding: 20, marginBottom: 16 }}>
            <h2 style={{ fontSize: 12, fontWeight: 800, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 14px' }}>🏫 Institute Header</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 16 }} className="rpt-grid-3">
              {[{ label: 'Institute Name', key: 'name' }, { label: 'Address', key: 'address' }, { label: 'Phone', key: 'phone' }].map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.04em' }}>{f.label}</label>
                  <input className="rpt-input" value={institute[f.key]} onChange={e => setInstitute({ ...institute, [f.key]: e.target.value })} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.04em' }}>Upload Logo</label>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleLogo} style={{ fontSize: 12, color: '#64748b' }} />
              </div>
              {logoDataUrl
                ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <img src={logoDataUrl} alt="Logo" style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'contain', border: '1.5px solid #e2e8f0' }} />
                    <button onClick={() => setLogoDataUrl('')} style={{ fontSize: 11, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
                  </div>
                : <div style={{ width: 52, height: 52, borderRadius: 10, background: '#1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: 20 }}>G</div>}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.04em' }}>Watermark</label>
                <select className="rpt-input" style={{ width: 'auto' }} value={watermark} onChange={e => setWatermark(e.target.value)}>
                  <option value="">None</option>
                  <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                  <option value="DRAFT">DRAFT</option>
                  <option value="INTERNAL">INTERNAL</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ── Report Log (collapsible) ── */}
        {showLog && (
          <div className="rpt-card rpt-fade-in" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ fontSize: 13, fontWeight: 800, color: '#1e3a5f', margin: 0 }}>📋 Report History</h2>
              <button onClick={() => { setReportLog([]); localStorage.removeItem('gnsi_report_log') }}
                style={{ fontSize: 12, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Clear All</button>
            </div>
            {reportLog.length === 0
              ? <p style={{ fontSize: 13, color: '#94a3b8' }}>No reports generated yet.</p>
              : <div style={{ overflowX: 'auto' }}>
                  <table className="rpt-table">
                    <thead><tr><th>Source</th><th>Status</th><th>Records</th><th>Generated At</th></tr></thead>
                    <tbody>
                      {reportLog.map(e => (
                        <tr key={e.id}>
                          <td style={{ fontWeight: 600 }}>{e.source}</td>
                          <td>{e.filters.statusFilter}</td>
                          <td style={{ fontWeight: 700, color: '#1e3a5f' }} className="rpt-mono">{e.total}</td>
                          <td style={{ color: '#94a3b8', fontSize: 12 }}>{e.at}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>}
          </div>
        )}

        {/* ── Presets ── */}
        <div className="rpt-card" style={{ padding: 18, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '.06em' }}>⚡ Quick Presets</span>
            <button onClick={() => setShowPresetBox(v => !v)}
              style={{ fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 8, background: '#1e3a5f', color: 'white', border: 'none', cursor: 'pointer' }}>
              + Save Preset
            </button>
          </div>
          {showPresetBox && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <input className="rpt-input" style={{ flex: 1, minWidth: 160 }} placeholder="Preset name…" value={presetName}
                onChange={e => setPresetName(e.target.value)} onKeyDown={e => e.key === 'Enter' && savePreset()} />
              <button onClick={savePreset} style={{ padding: '10px 16px', borderRadius: 9, background: '#16a34a', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>Save</button>
              <button onClick={() => setShowPresetBox(false)} style={{ padding: '10px 14px', borderRadius: 9, background: '#f1f5f9', color: '#64748b', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Cancel</button>
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {allPresets.map(p => (
              <div key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <button className={`rpt-preset-btn${p.builtin ? '' : ' custom'}`} onClick={() => loadPreset(p)}>{p.label}</button>
                {!p.builtin && (
                  <button onClick={() => deletePreset(p.id)}
                    style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}>✕</button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Source & Filters ── */}
        <div className="rpt-card" style={{ marginBottom: 16 }}>
          {/* Card header */}
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '.06em' }}>📂 Report Source & Filters</span>
            <button onClick={() => setShowFilters(v => !v)}
              style={{ fontSize: 12, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              {showFilters ? '▲ Collapse' : '▼ Expand'}
            </button>
          </div>

          {showFilters && (
            <div style={{ padding: 18 }}>
              {/* Source groups */}
              <div style={{ marginBottom: 18 }}>
                {SOURCE_GROUPS.map(grp => (
                  <div key={grp.label} style={{ marginBottom: 14 }}>
                    <span className="rpt-section-label">{grp.label}</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {SOURCES.filter(s => grp.keys.includes(s.key)).map(s => (
                        <button key={s.key} className={`rpt-src-btn${sourceKey === s.key ? ' active' : ''}`}
                          onClick={() => handleSourceChange(s.key)}>
                          {s.icon} {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Filters */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 16 }} className="rpt-grid-3">
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.04em' }}>Search</label>
                  <input className="rpt-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search any field…" />
                </div>
                {source.statusCol && (
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.04em' }}>Status</label>
                    <select className="rpt-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                      {availableStatuses.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                )}
                {source.dateCol && (
                  <>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.04em' }}>Date From</label>
                      <input type="date" className="rpt-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.04em' }}>Date To</label>
                      <input type="date" className="rpt-input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                    </div>
                  </>
                )}
                {source.groupCols?.length > 0 && (
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.04em' }}>Group By</label>
                    <select className="rpt-input" value={groupBy} onChange={e => setGroupBy(e.target.value)}>
                      <option value="">— No Grouping —</option>
                      {source.groupCols.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button className="rpt-btn-primary" onClick={handleGenerate} disabled={loading} style={{ width: '100%' }}>
                    {loading ? '⏳ Loading…' : '🔄 Generate Report'}
                  </button>
                </div>
              </div>

              {/* Column toggles */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  Columns <span style={{ fontWeight: 400, textTransform: 'none', color: '#94a3b8' }}>— drag to reorder</span>
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {(selectedCols.length ? selectedCols : source.columns.map(c => c.key)).map((key, i) => {
                    const col = source.columns.find(c => c.key === key)
                    if (!col) return null
                    const on = selectedCols.includes(key)
                    return (
                      <div key={key} draggable className={`rpt-col-chip ${on ? 'on' : 'off'}`}
                        style={{ opacity: dragIdx === i ? .4 : 1 }}
                        onDragStart={() => handleDragStart(i)}
                        onDragOver={e => handleDragOver(e, i)}
                        onDragEnd={handleDragEnd}>
                        <span style={{ color: '#cbd5e1', fontSize: 11 }}>⠿</span>
                        <input type="checkbox" checked={on} onChange={() => toggleCol(key)} style={{ accentColor: '#1e3a5f', width: 12, height: 12 }} />
                        <span style={{ fontSize: 12 }}>{col.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Error ── */}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderLeft: '4px solid #dc2626', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#dc2626', fontWeight: 600 }}>
            ⚠️ {error}
          </div>
        )}

        {/* ── Stats ── */}
        {generated && (
          <div className="rpt-fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }} >
            <div className="rpt-stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
              <p style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em', margin: 0 }}>Total Records</p>
              <p className="rpt-mono" style={{ fontSize: 30, fontWeight: 800, color: '#1e3a5f', margin: '4px 0 0', lineHeight: 1 }}>{rows.length}</p>
              {allRows.length !== rows.length && <p style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 0' }}>of {allRows.length} fetched</p>}
            </div>
            <div className="rpt-stat-card" style={{ borderLeft: '4px solid #22c55e' }}>
              <p style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em', margin: 0 }}>Positive</p>
              <p className="rpt-mono" style={{ fontSize: 30, fontWeight: 800, color: '#16a34a', margin: '4px 0 0', lineHeight: 1 }}>{positiveCount}</p>
            </div>
            <div className="rpt-stat-card" style={{ borderLeft: '4px solid #f87171' }}>
              <p style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em', margin: 0 }}>Pending / Other</p>
              <p className="rpt-mono" style={{ fontSize: 30, fontWeight: 800, color: '#ef4444', margin: '4px 0 0', lineHeight: 1 }}>{negativeCount}</p>
            </div>
            {source.aggregates.map(col => {
              const colDef = source.columns.find(c => c.key === col)
              return (
                <div key={col} className="rpt-stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
                  <p style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em', margin: 0 }}>Total {colDef?.label || col}</p>
                  <p className="rpt-mono" style={{ fontSize: 22, fontWeight: 800, color: '#d97706', margin: '4px 0 0', lineHeight: 1 }}>₹{(aggregates[col] || 0).toLocaleString('en-IN')}</p>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Export bar + view toggle ── */}
        {generated && rows.length > 0 && (
          <div className="rpt-fade-in" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {[
              { label: '📄 PDF',   fn: exportPdf,   bg: '#dc2626' },
              { label: '📊 Excel', fn: exportExcel, bg: '#16a34a' },
              { label: '📁 CSV',   fn: exportCsv,   bg: '#0891b2' },
              { label: '📝 Word',  fn: exportWord,  bg: '#1d4ed8' },
              { label: '🖨️ Print', fn: handlePrint, bg: '#475569' },
            ].map(({ label, fn, bg }) => (
              <button key={label} className="rpt-export-btn" onClick={fn}
                style={{ background: bg, color: 'white' }}>{label}</button>
            ))}
            <div style={{ marginLeft: 'auto', display: 'flex', background: '#f1f5f9', borderRadius: 10, padding: 3, gap: 2 }}>
              {['table', 'charts'].map(t => (
                <button key={t} className={`rpt-tab${activeTab === t ? ' active' : ''}`} onClick={() => setActiveTab(t)}>
                  {t === 'table' ? '📋 Table' : '📊 Charts'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Charts ── */}
        {generated && activeTab === 'charts' && (
          <div className="rpt-fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16, marginBottom: 16 }}>
            {chartData.length > 0 && (
              <div className="rpt-card" style={{ padding: 20 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: '#1e3a5f', margin: '0 0 14px' }}>Status Distribution</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                      label={({ name, value }) => `${name}: ${value}`}>
                      {chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip /><Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            {groupChartData.length > 0 && (
              <div className="rpt-card" style={{ padding: 20 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: '#1e3a5f', margin: '0 0 14px' }}>Records by {groupBy}</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={groupChartData} margin={{ bottom: 30 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {groupChartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* ── Table ── */}
        {activeTab === 'table' && (
          <div className="rpt-card rpt-fade-in" style={{ overflow: 'hidden' }}>
            {/* Table header */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#1e3a5f' }}>{source.icon} {source.label} Report</span>
                {generated && <span style={{ fontSize: 11, color: '#94a3b8' }}>{rows.length} records</span>}
              </div>
              {generated && totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: 13, opacity: page === 1 ? .4 : 1 }}>‹</button>
                  <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{page} / {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: 13, opacity: page === totalPages ? .4 : 1 }}>›</button>
                </div>
              )}
            </div>

            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              {groupedRows && generated ? (
                groupedRows.map(([group, gRows]) => (
                  <div key={group}>
                    <div className="rpt-group-hdr">
                      <span>{groupBy}: {group}</span>
                      <span style={{ color: '#94a3b8', fontWeight: 500, fontSize: 11 }}>{gRows.length} records</span>
                    </div>
                    <table className="rpt-table">
                      <thead><tr>
                        <th style={{ width: 40 }}>#</th>
                        {activeCols.map(col => (
                          <th key={col.key} onClick={() => handleSort(col.key)}>{col.label}<SortIcon col={col.key} sortCol={sortCol} sortDir={sortDir} /></th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {gRows.map((row, i) => (
                          <tr key={row.id || i}>
                            <td style={{ color: '#94a3b8', fontSize: 11 }} className="rpt-mono">{i + 1}</td>
                            {activeCols.map(col => (
                              <td key={col.key}>{col.key === source.statusCol ? <StatusBadge value={row[col.key]} /> : <span>{fmt(row[col.key])}</span>}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))
              ) : (
                <table className="rpt-table">
                  <thead><tr>
                    <th style={{ width: 40 }}>#</th>
                    {activeCols.map(col => (
                      <th key={col.key} onClick={() => handleSort(col.key)}>{col.label}<SortIcon col={col.key} sortCol={sortCol} sortDir={sortDir} /></th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {!generated ? (
                      <tr><td colSpan={activeCols.length + 1} style={{ padding: '48px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
                        Select a source and click <strong style={{ color: '#1e3a5f' }}>Generate Report</strong>
                      </td></tr>
                    ) : pagedRows.length === 0 ? (
                      <tr><td colSpan={activeCols.length + 1} style={{ padding: '48px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>No records found</td></tr>
                    ) : (
                      pagedRows.map((row, i) => (
                        <tr key={row.id || (page - 1) * PAGE_SIZE + i}>
                          <td style={{ color: '#94a3b8', fontSize: 11 }} className="rpt-mono">{(page - 1) * PAGE_SIZE + i + 1}</td>
                          {activeCols.map(col => (
                            <td key={col.key}>{col.key === source.statusCol ? <StatusBadge value={row[col.key]} /> : <span>{fmt(row[col.key])}</span>}</td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination footer */}
            {generated && totalPages > 1 && !groupedRows && (
              <div style={{ padding: '12px 18px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, rows.length)} of {rows.length}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[
                    { label: '«', fn: () => setPage(1), dis: page === 1 },
                    { label: '‹', fn: () => setPage(p => Math.max(1, p - 1)), dis: page === 1 },
                    ...Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const p = Math.min(Math.max(page - 2, 1) + i, totalPages)
                      return { label: String(p), fn: () => setPage(p), active: p === page }
                    }),
                    { label: '›', fn: () => setPage(p => Math.min(totalPages, p + 1)), dis: page === totalPages },
                    { label: '»', fn: () => setPage(totalPages), dis: page === totalPages },
                  ].map((btn, i) => (
                    <button key={i} onClick={btn.fn} disabled={btn.dis}
                      style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid #e2e8f0', background: btn.active ? '#1e3a5f' : 'white', color: btn.active ? 'white' : '#374151', fontSize: 12, fontWeight: 600, cursor: btn.dis ? 'not-allowed' : 'pointer', opacity: btn.dis ? .4 : 1, minWidth: 32 }}>
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}