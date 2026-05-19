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
    key: 'students',
    label: 'Students',
    icon: '🎓',
    table: 'students',
    dateCol: 'created_at',
    columns: [
      { key: 'name',         label: 'Name'        },
      { key: 'gcc_no',       label: 'GCC No.'     },
      { key: 'batch',        label: 'Batch'        },
      { key: 'course',       label: 'Course'       },
      { key: 'session',      label: 'Session'      },
      { key: 'house',        label: 'House'        },
      { key: 'hostel_type',  label: 'Hostel Type'  },
      { key: 'gender',       label: 'Gender'       },
      { key: 'phone',        label: 'Phone'        },
      { key: 'father_name',  label: 'Father'       },
      { key: 'dob',          label: 'DOB'          },
      { key: 'admission_date',label:'Adm. Date'    },
      { key: 'status',       label: 'Status'       },
      { key: 'created_at',   label: 'Joined'       },
    ],
    statusCol: 'status',
    groupCols: ['house', 'course', 'batch', 'gender', 'hostel_type', 'session'],
    aggregates: [],
  },
  {
    key: 'admissions',
    label: 'Admissions',
    icon: '📋',
    table: 'admissions',
    dateCol: 'created_at',
    columns: [
      { key: 'applicant_name', label: 'Name'        },
      { key: 'gcc_no',         label: 'GCC No.'     },
      { key: 'course',         label: 'Course'      },
      { key: 'batch',          label: 'Batch'       },
      { key: 'hostel_type',    label: 'Hostel Type' },
      { key: 'gender',         label: 'Gender'      },
      { key: 'phone',          label: 'Phone'       },
      { key: 'source',         label: 'Source'      },
      { key: 'status',         label: 'Status'      },
      { key: 'created_at',     label: 'Date'        },
    ],
    statusCol: 'status',
    groupCols: ['course', 'batch', 'gender', 'hostel_type', 'status'],
    aggregates: [],
  },
  {
    key: 'fees',
    label: 'Fees',
    icon: '💰',
    table: 'fees',
    dateCol: 'due_date',
    columns: [
      { key: 'student_id', label: 'Student ID' },
      { key: 'amount',     label: 'Amount (₹)' },
      { key: 'paid',       label: 'Paid (₹)'   },
      { key: 'due_date',   label: 'Due Date'   },
    ],
    statusCol: null,
    groupCols: [],
    aggregates: ['amount', 'paid'],
  },
  {
    key: 'fee_invoices',
    label: 'Fee Invoices',
    icon: '🧾',
    table: 'fee_invoices',
    dateCol: 'due_date',
    columns: [
      { key: 'student_name',  label: 'Student'      },
      { key: 'gcc_no',        label: 'GCC No.'      },
      { key: 'course',        label: 'Course'       },
      { key: 'hostel_type',   label: 'Hostel'       },
      { key: 'fee_type',      label: 'Fee Type'     },
      { key: 'invoice_month', label: 'Month'        },
      { key: 'total_amount',  label: 'Total (₹)'    },
      { key: 'amount_paid',   label: 'Paid (₹)'     },
      { key: 'amount_due',    label: 'Due (₹)'      },
      { key: 'status',        label: 'Status'       },
      { key: 'due_date',      label: 'Due Date'     },
      { key: 'session_year',  label: 'Session'      },
    ],
    statusCol: 'status',
    groupCols: ['course', 'hostel_type', 'fee_type', 'status', 'session_year'],
    aggregates: ['total_amount', 'amount_paid', 'amount_due'],
  },
  {
    key: 'adm_fee_collections',
    label: 'Fee Collections',
    icon: '💵',
    table: 'adm_fee_collections',
    dateCol: 'pay_date',
    columns: [
      { key: 'student_name', label: 'Student'     },
      { key: 'adm_app_id',   label: 'Adm. No.'    },
      { key: 'fee_type',     label: 'Fee Type'    },
      { key: 'amount_paid',  label: 'Amount (₹)'  },
      { key: 'pay_date',     label: 'Pay Date'    },
      { key: 'pay_mode',     label: 'Mode'        },
      { key: 'collected_by', label: 'Collected By'},
    ],
    statusCol: null,
    groupCols: ['fee_type', 'pay_mode'],
    aggregates: ['amount_paid'],
  },
  {
    key: 'accounts',
    label: 'Accounts',
    icon: '🧾',
    table: 'accounts',
    dateCol: 'entry_date',
    columns: [
      { key: 'entry_date',   label: 'Date'        },
      { key: 'type',         label: 'Type'        },
      { key: 'category',     label: 'Category'    },
      { key: 'amount',       label: 'Amount (₹)'  },
      { key: 'payment_mode', label: 'Mode'        },
      { key: 'note',         label: 'Note'        },
    ],
    statusCol: 'type',
    groupCols: ['type', 'category', 'payment_mode'],
    aggregates: ['amount'],
  },
  {
    key: 'attendance',
    label: 'Attendance',
    icon: '📅',
    table: 'attendance',
    dateCol: 'date',
    columns: [
      { key: 'student_id', label: 'Student ID' },
      { key: 'status',     label: 'Status'     },
      { key: 'date',       label: 'Date'       },
    ],
    statusCol: 'status',
    groupCols: ['status'],
    aggregates: [],
  },
  {
    key: 'exams',
    label: 'Exams',
    icon: '📝',
    table: 'exams',
    dateCol: 'date',
    columns: [
      { key: 'subject', label: 'Subject' },
      { key: 'date',    label: 'Date'    },
      { key: 'time',    label: 'Time'    },
    ],
    statusCol: null,
    groupCols: [],
    aggregates: [],
  },
  {
    key: 'exam_scores',
    label: 'Exam Scores',
    icon: '📊',
    table: 'exam_scores',
    dateCol: 'created_at',
    columns: [
      { key: 'student_id',  label: 'Student ID'  },
      { key: 'exam_name',   label: 'Exam'        },
      { key: 'session',     label: 'Session'     },
      { key: 'Mathematics', label: 'Math'        },
      { key: 'Science',     label: 'Science'     },
      { key: 'English',     label: 'English'     },
      { key: 'Hindi',       label: 'Hindi'       },
      { key: 'GK',          label: 'GK'          },
      { key: 'Reasoning',   label: 'Reasoning'   },
      { key: 'total',       label: 'Total'       },
    ],
    statusCol: null,
    groupCols: ['session', 'exam_name'],
    aggregates: ['total'],
  },
  {
    key: 'staff_profiles',
    label: 'Staff',
    icon: '👨‍🏫',
    table: 'staff_profiles',
    dateCol: 'created_at',
    columns: [
      { key: 'name',               label: 'Name'          },
      { key: 'department',         label: 'Department'    },
      { key: 'role',               label: 'Role'          },
      { key: 'status',             label: 'Status'        },
      { key: 'basic_salary',       label: 'Basic (₹)'     },
      { key: 'seniority_allowance',label: 'Seniority (₹)' },
      { key: 'loyalty_bonus',      label: 'Loyalty (₹)'   },
      { key: 'role_bonus',         label: 'Role Bonus (₹)'},
      { key: 'phone',              label: 'Phone'         },
      { key: 'created_at',         label: 'Joined'        },
    ],
    statusCol: 'status',
    groupCols: ['department', 'role', 'status'],
    aggregates: ['basic_salary'],
  },
  {
    key: 'salary',
    label: 'Salary',
    icon: '💵',
    table: 'salary',
    dateCol: null,
    columns: [
      { key: 'amount', label: 'Amount (₹)' },
      { key: 'status', label: 'Status'     },
    ],
    statusCol: 'status',
    groupCols: ['status'],
    aggregates: ['amount'],
  },
  {
    key: 'leave',
    label: 'Leave',
    icon: '🏖️',
    table: 'leave',
    dateCol: 'created_at',
    columns: [
      { key: 'type',       label: 'Type'       },
      { key: 'from_date',  label: 'From'       },
      { key: 'to_date',    label: 'To'         },
      { key: 'status',     label: 'Status'     },
      { key: 'created_at', label: 'Applied On' },
    ],
    statusCol: 'status',
    groupCols: ['type', 'status'],
    aggregates: [],
  },
  {
    key: 'staff_tasks',
    label: 'Tasks',
    icon: '✅',
    table: 'staff_tasks',
    dateCol: 'due_date',
    columns: [
      { key: 'title',      label: 'Task'       },
      { key: 'department', label: 'Department' },
      { key: 'status',     label: 'Status'     },
      { key: 'due_date',   label: 'Due Date'   },
    ],
    statusCol: 'status',
    groupCols: ['department', 'status'],
    aggregates: [],
  },
  {
    key: 'course_enrollments',
    label: 'Enrollments',
    icon: '🗂️',
    table: 'course_enrollments',
    dateCol: 'enrolled_at',
    columns: [
      { key: 'student_name', label: 'Student'     },
      { key: 'gcc_no',       label: 'GCC No.'     },
      { key: 'course',       label: 'Course'      },
      { key: 'subtype',      label: 'Batch'       },
      { key: 'hostel_type',  label: 'Hostel'      },
      { key: 'session_year', label: 'Session'     },
      { key: 'enrolled_at',  label: 'Enrolled On' },
      { key: 'status',       label: 'Status'      },
    ],
    statusCol: 'status',
    groupCols: ['course', 'subtype', 'hostel_type', 'session_year', 'status'],
    aggregates: [],
  },
  {
    key: 'hostel_rooms',
    label: 'Hostel Rooms',
    icon: '🛏️',
    table: 'hostel_rooms',
    dateCol: null,
    columns: [
      { key: 'block',         label: 'Block'      },
      { key: 'total_beds',    label: 'Total Beds' },
      { key: 'occupied_beds', label: 'Occupied'   },
    ],
    statusCol: null,
    groupCols: ['block'],
    aggregates: ['total_beds', 'occupied_beds'],
  },
  {
    key: 'hostel_incidents',
    label: 'Hostel Incidents',
    icon: '⚠️',
    table: 'hostel_incidents',
    dateCol: 'incident_date',
    columns: [
      { key: 'incident_date', label: 'Date'     },
      { key: 'type',          label: 'Type'     },
      { key: 'severity',      label: 'Severity' },
    ],
    statusCol: 'severity',
    groupCols: ['type', 'severity'],
    aggregates: [],
  },
  {
    key: 'notices',
    label: 'Notices',
    icon: '🔔',
    table: 'notices',
    dateCol: 'created_at',
    columns: [
      { key: 'title',      label: 'Title'      },
      { key: 'content',    label: 'Content'    },
      { key: 'created_at', label: 'Date'       },
    ],
    statusCol: null,
    groupCols: [],
    aggregates: [],
  },
]

// ─── Built-in presets ──────────────────────────────────────────
const BUILTIN_PRESETS = [
  {
    id: 'fee-defaulters',
    label: '⚠️ Fee Defaulters',
    builtin: true,
    config: {
      sourceKey: 'fee_invoices',
      selectedCols: ['student_name','gcc_no','course','hostel_type','invoice_month','total_amount','amount_paid','amount_due','status'],
      statusFilter: 'All',
      search: '',
      dateFrom: '',
      dateTo: '',
      groupBy: 'course',
      sortCol: 'amount_due',
      sortDir: 'desc',
    },
    postFilter: (rows) => rows.filter(r => parseFloat(r.amount_due || 0) > 0),
  },
  {
    id: 'active-students',
    label: '✅ Active Students',
    builtin: true,
    config: {
      sourceKey: 'students',
      selectedCols: ['name','gcc_no','batch','course','session','house','hostel_type','status'],
      statusFilter: 'Active',
      search: '',
      dateFrom: '',
      dateTo: '',
      groupBy: 'house',
      sortCol: 'name',
      sortDir: 'asc',
    },
    postFilter: null,
  },
  {
    id: 'pending-admissions',
    label: '⏳ Pending Admissions',
    builtin: true,
    config: {
      sourceKey: 'admissions',
      selectedCols: ['applicant_name','gcc_no','course','batch','hostel_type','status'],
      statusFilter: 'Applied',
      search: '',
      dateFrom: '',
      dateTo: '',
      groupBy: '',
      sortCol: 'created_at',
      sortDir: 'desc',
    },
    postFilter: null,
  },
  {
    id: 'boarders',
    label: '🏠 Boarders',
    builtin: true,
    config: {
      sourceKey: 'students',
      selectedCols: ['name','gcc_no','batch','course','session','house','hostel_type','phone','status'],
      statusFilter: 'Active',
      search: '',
      dateFrom: '',
      dateTo: '',
      groupBy: 'house',
      sortCol: 'name',
      sortDir: 'asc',
    },
    postFilter: (rows) => rows.filter(r => r.hostel_type === 'Boarder'),
  },
  {
    id: 'fee-collections-today',
    label: '💰 Today\'s Collections',
    builtin: true,
    config: {
      sourceKey: 'adm_fee_collections',
      selectedCols: ['student_name','adm_app_id','fee_type','amount_paid','pay_date','pay_mode','collected_by'],
      statusFilter: 'All',
      search: '',
      dateFrom: new Date().toISOString().slice(0,10),
      dateTo:   new Date().toISOString().slice(0,10),
      groupBy: 'fee_type',
      sortCol: 'pay_date',
      sortDir: 'desc',
    },
    postFilter: null,
  },
  {
    id: 'staff-active',
    label: '👨‍🏫 Active Staff',
    builtin: true,
    config: {
      sourceKey: 'staff_profiles',
      selectedCols: ['name','department','role','basic_salary','status'],
      statusFilter: 'Active',
      search: '',
      dateFrom: '',
      dateTo: '',
      groupBy: 'department',
      sortCol: 'name',
      sortDir: 'asc',
    },
    postFilter: null,
  },
  {
    id: 'course-enrollments',
    label: '🗂️ All Enrollments',
    builtin: true,
    config: {
      sourceKey: 'course_enrollments',
      selectedCols: ['student_name','gcc_no','course','subtype','hostel_type','session_year','status'],
      statusFilter: 'Active',
      search: '',
      dateFrom: '',
      dateTo: '',
      groupBy: 'course',
      sortCol: 'student_name',
      sortDir: 'asc',
    },
    postFilter: null,
  },
]

const DEFAULT_INSTITUTE = {
  name:    'Guidance Navodaya & Sainik Institute',
  address: 'Khangabok Sorok Wangma, Thoubal, Manipur',
  phone:   '+91-8974298074',
}

const CHART_COLORS = ['#1e3a5f','#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316']

const POSITIVE = new Set(['Confirmed','Paid','Present','Passed','Occupied','Approved','Active','Enrolled','Completed','Income'])
const NEGATIVE  = new Set(['Pending','Absent','Vacant','Rejected','Unpaid','Failed','Cancelled','Dropped','Overdue','Expense'])

// ─── Helpers ───────────────────────────────────────────────────
function fmt(v) {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
    const d = new Date(v); return isNaN(d) ? v : d.toLocaleDateString('en-IN')
  }
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const d = new Date(v); return isNaN(d) ? v : d.toLocaleDateString('en-IN')
  }
  return v
}

function StatusBadge({ value }) {
  const cls = POSITIVE.has(value)
    ? 'bg-green-100 text-green-700'
    : NEGATIVE.has(value)
    ? 'bg-red-100 text-red-600'
    : 'bg-yellow-100 text-yellow-700'
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{value}</span>
}

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <span className="text-slate-300 ml-1">↕</span>
  return <span className="text-blue-500 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
}

// ─── Main Component ────────────────────────────────────────────
export default function Reports() {
  const [sourceKey,    setSourceKey]    = useState('students')
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [selectedCols, setSelectedCols] = useState([])
  const [dateFrom,     setDateFrom]     = useState('')
  const [dateTo,       setDateTo]       = useState('')
  const [groupBy,      setGroupBy]      = useState('')
  const [sortCol,      setSortCol]      = useState('')
  const [sortDir,      setSortDir]      = useState('asc')

  const [allRows,   setAllRows]   = useState([])
  const [rows,      setRows]      = useState([])
  const [loading,   setLoading]   = useState(false)
  const [generated, setGenerated] = useState(false)
  const [error,     setError]     = useState('')
  const [page,      setPage]      = useState(1)
  const PAGE_SIZE = 50

  const [institute,   setInstitute]   = useState(DEFAULT_INSTITUTE)
  const [logoDataUrl, setLogoDataUrl] = useState('')
  const [watermark,   setWatermark]   = useState('')
  const [activeTab,   setActiveTab]   = useState('table')

  const [savedPresets,  setSavedPresets]  = useState(() => {
    try { return JSON.parse(localStorage.getItem('gnsi_report_presets') || '[]') } catch { return [] }
  })
  const [presetName,    setPresetName]    = useState('')
  const [showPresetBox, setShowPresetBox] = useState(false)

  const [reportLog, setReportLog] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gnsi_report_log') || '[]') } catch { return [] }
  })
  const [showLog, setShowLog] = useState(false)

  const fileRef = useRef(null)
  const source  = SOURCES.find(s => s.key === sourceKey) || SOURCES[0]

  const [dragIdx, setDragIdx] = useState(null)
  const handleDragStart = (i) => setDragIdx(i)
  const handleDragOver  = (e, i) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === i) return
    const next = [...selectedCols]
    const [moved] = next.splice(dragIdx, 1)
    next.splice(i, 0, moved)
    setSelectedCols(next)
    setDragIdx(i)
  }
  const handleDragEnd = () => setDragIdx(null)

  const activeCols = useMemo(() => {
    const base = selectedCols.length ? selectedCols : source.columns.map(c => c.key)
    return base.map(k => source.columns.find(c => c.key === k)).filter(Boolean)
  }, [selectedCols, source])

  const handleSourceChange = (key) => {
    const s = SOURCES.find(x => x.key === key)
    setSourceKey(key)
    setSelectedCols(s.columns.map(c => c.key))
    setAllRows([]); setRows([]); setGenerated(false)
    setStatusFilter('All'); setSearch('')
    setError(''); setPage(1); setGroupBy(''); setSortCol(''); setDateFrom(''); setDateTo('')
  }

  const toggleCol = (key) => {
    setSelectedCols(prev =>
      prev.includes(key)
        ? prev.length === 1 ? prev : prev.filter(k => k !== key)
        : [...prev, key]
    )
  }

  const applyFilters = useCallback((raw) => {
    let data = [...raw]
    if (source.dateCol && dateFrom)
      data = data.filter(r => r[source.dateCol] && r[source.dateCol] >= dateFrom)
    if (source.dateCol && dateTo)
      data = data.filter(r => r[source.dateCol] && r[source.dateCol] <= dateTo + 'T23:59:59')
    if (source.statusCol && statusFilter !== 'All')
      data = data.filter(r => r[source.statusCol] === statusFilter)
    const q = search.toLowerCase()
    if (q) data = data.filter(r => Object.values(r).some(v => String(v || '').toLowerCase().includes(q)))
    if (sortCol) {
      data.sort((a, b) => {
        const av = a[sortCol] ?? '', bv = b[sortCol] ?? ''
        const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
        return sortDir === 'asc' ? cmp : -cmp
      })
    }
    return data
  }, [source, dateFrom, dateTo, statusFilter, search, sortCol, sortDir])

  useEffect(() => {
    if (allRows.length || generated) {
      setRows(applyFilters(allRows))
      setPage(1)
    }
  }, [allRows, applyFilters, generated])

  const handleGenerate = async (overrideRows = null) => {
    setLoading(true); setError('')
    try {
      let data = overrideRows
      if (!data) {
        const { data: d, error: err } = await supabase.from(source.table).select('*')
        if (err) throw err
        data = d || []
      }
      setAllRows(data)
      setGenerated(true)
      if (!selectedCols.length) setSelectedCols(source.columns.map(c => c.key))
      const entry = {
        id: Date.now(),
        source: source.label,
        filters: { statusFilter, search, dateFrom, dateTo },
        total: data.length,
        at: new Date().toLocaleString('en-IN'),
      }
      const nextLog = [entry, ...reportLog].slice(0, 50)
      setReportLog(nextLog)
      localStorage.setItem('gnsi_report_log', JSON.stringify(nextLog))
    } catch (e) {
      setError(e.message || 'Failed to fetch')
    }
    setLoading(false)
  }

  const savePreset = () => {
    if (!presetName.trim()) return
    const preset = {
      id: Date.now(),
      label: presetName.trim(),
      builtin: false,
      config: { sourceKey, selectedCols, statusFilter, search, dateFrom, dateTo, groupBy, sortCol, sortDir },
      postFilter: null,
    }
    const next = [...savedPresets, preset]
    setSavedPresets(next)
    localStorage.setItem('gnsi_report_presets', JSON.stringify(next))
    setPresetName(''); setShowPresetBox(false)
  }

  const deletePreset = (id) => {
    const next = savedPresets.filter(p => p.id !== id)
    setSavedPresets(next)
    localStorage.setItem('gnsi_report_presets', JSON.stringify(next))
  }

  const loadPreset = (preset) => {
    const c = preset.config
    const s = SOURCES.find(x => x.key === c.sourceKey) || source
    setSourceKey(c.sourceKey)
    setSelectedCols(c.selectedCols || s.columns.map(col => col.key))
    setStatusFilter(c.statusFilter || 'All')
    setSearch(c.search || '')
    setDateFrom(c.dateFrom || '')
    setDateTo(c.dateTo || '')
    setGroupBy(c.groupBy || '')
    setSortCol(c.sortCol || '')
    setSortDir(c.sortDir || 'asc')
    setAllRows([]); setRows([]); setGenerated(false); setPage(1)
  }

  const groupedRows = useMemo(() => {
    if (!groupBy) return null
    const map = {}
    rows.forEach(r => {
      const k = r[groupBy] || '(Unset)'
      if (!map[k]) map[k] = []
      map[k].push(r)
    })
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]))
  }, [rows, groupBy])

  const aggregates = useMemo(() => {
    const out = {}
    source.aggregates.forEach(col => {
      out[col] = rows.reduce((s, r) => s + parseFloat(r[col] || 0), 0)
    })
    return out
  }, [rows, source])

  const chartData = useMemo(() => {
    if (!source.statusCol) return []
    const map = {}
    rows.forEach(r => {
      const v = r[source.statusCol] || 'Unknown'
      map[v] = (map[v] || 0) + 1
    })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [rows, source])

  const groupChartData = useMemo(() => {
    if (!groupBy) return []
    const map = {}
    rows.forEach(r => {
      const k = r[groupBy] || '(Unset)'
      map[k] = (map[k] || 0) + 1
    })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [rows, groupBy])

  const availableStatuses = useMemo(() => {
    if (!source.statusCol) return []
    const vals = [...new Set(allRows.map(r => r[source.statusCol]).filter(Boolean))]
    return ['All', ...vals]
  }, [allRows, source])

  const handleSort = (key) => {
    if (sortCol === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(key); setSortDir('asc') }
  }

  const totalPages  = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const pagedRows   = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleLogo = (e) => {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setLogoDataUrl(ev.target.result)
    reader.readAsDataURL(file)
  }

  const now = new Date()
  const generatedText = now.toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })
  const fileStamp     = now.toISOString().slice(0, 19).replace(/[:T]/g, '-')

  const positiveCount = rows.filter(r => source.statusCol && POSITIVE.has(r[source.statusCol])).length
  const negativeCount = rows.filter(r => source.statusCol && NEGATIVE.has(r[source.statusCol])).length

  // ── PDF Export ─────────────────────────────────────────────
  const exportPdf = () => {
    const isWide = activeCols.length > 6
    const doc    = new jsPDF(isWide ? 'l' : 'p', 'pt', 'a4')
    const pw = doc.internal.pageSize.getWidth()
    const ph = doc.internal.pageSize.getHeight()
    const mx = 36
    const navy=[15,40,80], steel=[30,58,95], sky=[56,96,156], silver=[241,245,249], muted=[100,116,139], white=[255,255,255], gold=[180,140,40]

    doc.setFillColor(...navy); doc.rect(0,0,pw,110,'F')
    doc.setFillColor(...sky); doc.setGState(new doc.GState({opacity:0.12}))
    doc.triangle(pw-160,0,pw,0,pw,110,'F')
    doc.setGState(new doc.GState({opacity:1}))
    doc.setFillColor(...gold); doc.rect(0,0,pw,3,'F')

    let logoX=mx
    if(logoDataUrl){
      const ext=logoDataUrl.split(';')[0].split('/')[1].toUpperCase()
      try{doc.addImage(logoDataUrl,ext==='SVG'?'PNG':ext,mx,18,70,70);logoX=mx+82}catch{logoX=mx}
    } else {
      doc.setFillColor(...sky);doc.circle(mx+35,55,35,'F')
      doc.setFont('helvetica','bold').setFontSize(26).setTextColor(...white)
      doc.text('G',mx+35,62,{align:'center'});logoX=mx+82
    }

    doc.setFont('helvetica','bold').setFontSize(16).setTextColor(...white)
    doc.text(institute.name,logoX,40)
    doc.setFont('helvetica','normal').setFontSize(9).setTextColor(180,200,230)
    doc.text(institute.address,logoX,56)
    doc.text(`Phone: ${institute.phone}`,logoX,70)

    const bW=120,bH=28,bX=pw-mx-bW,bY=18
    doc.setFillColor(...sky);doc.roundedRect(bX,bY,bW,bH,4,4,'F')
    doc.setFont('helvetica','bold').setFontSize(10).setTextColor(...white)
    doc.text(`${source.label} Report`,bX+bW/2,bY+18,{align:'center'})
    doc.setFont('helvetica','normal').setFontSize(8).setTextColor(180,200,230)
    doc.text(`Generated: ${generatedText}`,pw-mx,60,{align:'right'})

    const ribbonY=110
    doc.setFillColor(...silver);doc.rect(0,ribbonY,pw,48,'F')
    const summaryItems=[
      {label:'Total Records',value:String(rows.length)},
      {label:'Status Filter',value:statusFilter},
      {label:'Date From',value:dateFrom||'All'},
      {label:'Date To',value:dateTo||'All'},
    ]
    const boxW=(pw-mx*2)/summaryItems.length
    summaryItems.forEach((item,i)=>{
      const bx=mx+i*boxW
      if(i>0){doc.setDrawColor(200,210,220).setLineWidth(0.5);doc.line(bx,ribbonY+8,bx,ribbonY+40)}
      doc.setFont('helvetica','normal').setFontSize(8).setTextColor(...muted)
      doc.text(item.label.toUpperCase(),bx+boxW/2,ribbonY+18,{align:'center'})
      doc.setFont('helvetica','bold').setFontSize(11).setTextColor(...steel)
      doc.text(item.value,bx+boxW/2,ribbonY+34,{align:'center'})
    })
    doc.setFillColor(...gold);doc.rect(0,ribbonY+48,pw,2,'F')

    let tableStartY=ribbonY+58
    if(source.aggregates.length>0){
      doc.setFont('helvetica','bold').setFontSize(9).setTextColor(...steel)
      let ax=mx
      source.aggregates.forEach(col=>{
        const colDef=source.columns.find(c=>c.key===col)
        doc.text(`Total ${colDef?colDef.label:col}: ₹${(aggregates[col]||0).toLocaleString('en-IN')}`,ax,tableStartY+10)
        ax+=180
      })
      tableStartY+=24
    }

    const renderTable=(data,startY,title)=>{
      if(title){doc.setFont('helvetica','bold').setFontSize(10).setTextColor(...steel);doc.text(title,mx,startY-4)}
      autoTable(doc,{
        startY,
        head:[['#',...activeCols.map(c=>c.label)]],
        body:data.map((row,i)=>[i+1,...activeCols.map(c=>fmt(row[c.key]))]),
        styles:{font:'helvetica',fontSize:8,cellPadding:{top:5,bottom:5,left:6,right:6},valign:'middle',textColor:[30,41,59],lineColor:[226,232,240],lineWidth:0.3},
        headStyles:{fillColor:steel,textColor:white,fontStyle:'bold',fontSize:8,cellPadding:{top:7,bottom:7,left:6,right:6}},
        alternateRowStyles:{fillColor:[248,250,252]},
        columnStyles:{0:{cellWidth:20,halign:'center',textColor:muted,fontSize:7}},
        tableWidth:'auto',
        margin:{left:mx,right:mx,bottom:52},
        didParseCell:(d)=>{
          if(d.section==='body'&&source.statusCol){
            const ci=activeCols.findIndex(c=>c.key===source.statusCol)
            if(ci!==-1&&d.column.index===ci+1){
              const v=String(d.cell.raw||'')
              if(POSITIVE.has(v)){d.cell.styles.textColor=[22,163,74];d.cell.styles.fontStyle='bold'}
              else if(NEGATIVE.has(v)){d.cell.styles.textColor=[220,38,38];d.cell.styles.fontStyle='bold'}
              else{d.cell.styles.textColor=[180,83,9];d.cell.styles.fontStyle='bold'}
            }
          }
        },
        didDrawPage:(hookData)=>{
          const pageNum=doc.internal.getCurrentPageInfo().pageNumber
          const totalPg=doc.internal.getNumberOfPages()
          if(pageNum>1){
            doc.setFillColor(...navy);doc.rect(0,0,pw,32,'F')
            doc.setFillColor(...gold);doc.rect(0,0,pw,2,'F')
            doc.setFont('helvetica','bold').setFontSize(10).setTextColor(...white)
            doc.text(institute.name,mx,21)
            doc.setFont('helvetica','normal').setFontSize(8).setTextColor(180,200,230)
            doc.text(`${source.label} Report  •  Cont.`,pw-mx,21,{align:'right'})
          }
          if(watermark){
            doc.setGState(new doc.GState({opacity:0.07}))
            doc.setFont('helvetica','bold').setFontSize(72).setTextColor(0,0,0)
            doc.text(watermark,pw/2,ph/2,{align:'center',angle:45})
            doc.setGState(new doc.GState({opacity:1}))
          }
          doc.setFillColor(...silver);doc.rect(0,ph-38,pw,38,'F')
          doc.setFillColor(...gold);doc.rect(0,ph-38,pw,1.5,'F')
          doc.setFont('helvetica','normal').setFontSize(8).setTextColor(...muted)
          doc.text(`${institute.name}  •  ${source.label} Report  •  Confidential`,mx,ph-16)
          doc.text(`Printed: ${generatedText}`,pw/2,ph-16,{align:'center'})
          const pill=`Page ${pageNum} of ${totalPg}`,pillW=70,pillH=16,pillX=pw-mx-pillW,pillY=ph-28
          doc.setFillColor(...steel);doc.roundedRect(pillX,pillY,pillW,pillH,3,3,'F')
          doc.setFont('helvetica','bold').setFontSize(8).setTextColor(...white)
          doc.text(pill,pillX+pillW/2,pillY+11,{align:'center'})
        },
      })
      return doc.lastAutoTable.finalY
    }

    if(groupedRows){
      let y=tableStartY
      groupedRows.forEach(([group,gRows],gi)=>{
        if(gi>0)y+=12
        y=renderTable(gRows,y,`${groupBy}: ${group}  (${gRows.length} records)`)+16
      })
    } else {
      renderTable(rows,tableStartY,'')
    }
    doc.save(`GNSI-${source.label}-Report-${fileStamp}.pdf`)
  }

  // ── Excel Export ────────────────────────────────────────────
  const exportExcel = async () => {
    const wb=new ExcelJS.Workbook()
    wb.creator=institute.name;wb.created=new Date()
    const ws=wb.addWorksheet(`${source.label} Report`)
    const totalCols=activeCols.length+1

    const addRow=(val,font,align='center')=>{
      const ri=ws.rowCount+1
      ws.mergeCells(`A${ri}:${String.fromCharCode(64+totalCols)}${ri}`)
      const cell=ws.getCell(`A${ri}`)
      cell.value=val;cell.font=font;cell.alignment={horizontal:align,vertical:'middle'}
    }
    addRow(institute.name,{bold:true,size:16,color:{argb:'FF1E3A5F'}})
    addRow(institute.address,{size:11,color:{argb:'FF475569'}})
    addRow(`Phone: ${institute.phone}`,{size:10,color:{argb:'FF475569'}})
    addRow(`Print Date: ${generatedText}`,{italic:true,size:10,color:{argb:'FF64748B'}})
    addRow(`${source.label} Report`,{bold:true,size:14,color:{argb:'FF1E3A5F'}})
    addRow(`Status=${statusFilter} | Total=${rows.length}`,{italic:true,size:9,color:{argb:'FF94A3B8'}})

    if(source.aggregates.length>0){
      source.aggregates.forEach(col=>{
        const colDef=source.columns.find(c=>c.key===col)
        addRow(`Total ${colDef?.label||col}: ₹${(aggregates[col]||0).toLocaleString('en-IN')}`,{bold:true,size:10,color:{argb:'FF1E3A5F'}},'left')
      })
    }
    ws.addRow([])

    const hdr=ws.addRow(['#',...activeCols.map(c=>c.label)])
    hdr.font={bold:true,color:{argb:'FFFFFFFF'},size:11}
    hdr.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1E3A5F'}}
    hdr.alignment={horizontal:'center',vertical:'middle'}
    hdr.height=24

    const dataRows=groupedRows
      ?groupedRows.flatMap(([group,gRows])=>{
        const sub=ws.addRow([`── ${groupBy}: ${group} (${gRows.length})`])
        sub.font={bold:true,color:{argb:'FF1E3A5F'},size:10}
        sub.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFE2E8F0'}}
        ws.mergeCells(`A${sub.number}:${String.fromCharCode(64+totalCols)}${sub.number}`)
        return gRows
      })
      :rows

    dataRows.forEach((row,i)=>{
      const r=ws.addRow([i+1,...activeCols.map(c=>fmt(row[c.key]))])
      r.alignment={vertical:'middle'}
      if(i%2===1)r.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF8FAFC'}}
    })
    ws.columns=[{width:6},...activeCols.map(()=>({width:22}))]
    const buf=await wb.xlsx.writeBuffer()
    const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})
    const url=URL.createObjectURL(blob)
    const a=document.createElement('a')
    a.href=url;a.download=`GNSI-${source.label}-Report-${fileStamp}.xlsx`;a.click()
    URL.revokeObjectURL(url)
  }

  const exportCsv = () => {
    const headers=['#',...activeCols.map(c=>c.label)].join(',')
    const body=rows.map((row,i)=>[i+1,...activeCols.map(c=>{const v=fmt(row[c.key]);return typeof v==='string'&&v.includes(',')? `"${v}"`:v})].join(',')).join('\n')
    const blob=new Blob([headers+'\n'+body],{type:'text/csv'})
    const url=URL.createObjectURL(blob)
    const a=document.createElement('a')
    a.href=url;a.download=`GNSI-${source.label}-${fileStamp}.csv`;a.click()
    URL.revokeObjectURL(url)
  }

  const exportWord = () => {
    const headers=['#',...activeCols.map(c=>c.label)].map(h=>`<th style="border:1px solid #cbd5e1;padding:8px 12px;background:#1e3a5f;color:#fff;font-size:12px;">${h}</th>`).join('')
    const body=rows.map((row,i)=>`<tr>${[i+1,...activeCols.map(c=>fmt(row[c.key]))].map(v=>`<td style="border:1px solid #e2e8f0;padding:8px 12px;font-size:12px;">${v}</td>`).join('')}</tr>`).join('')
    const aggRows=source.aggregates.map(col=>{const colDef=source.columns.find(c=>c.key===col);return`<p style="font-size:12px;font-weight:700;color:#1e3a5f;">Total ${colDef?.label||col}: ₹${(aggregates[col]||0).toLocaleString('en-IN')}</p>`}).join('')
    const html=`<html><head><meta charset="utf-8"/></head><body style="font-family:Arial,sans-serif;margin:30px;">
      <div style="border-bottom:2px solid #1e3a5f;padding-bottom:12px;margin-bottom:16px;">
        <div style="font-size:18px;font-weight:700;color:#1e3a5f;">${institute.name}</div>
        <div style="font-size:12px;color:#475569;">${institute.address} | ${institute.phone}</div>
        <div style="font-size:12px;color:#475569;">Report: ${source.label} | Date: ${generatedText} | Total: ${rows.length}</div>
      </div>
      ${aggRows}
      <table style="width:100%;border-collapse:collapse;"><thead><tr>${headers}</tr></thead>
      <tbody>${body||`<tr><td colspan="${activeCols.length+1}" style="padding:14px;text-align:center;">No records</td></tr>`}</tbody></table>
    </body></html>`
    const blob=new Blob([html],{type:'application/msword'})
    const url=URL.createObjectURL(blob)
    const a=document.createElement('a')
    a.href=url;a.download=`GNSI-${source.label}-Report-${fileStamp}.doc`;a.click()
    URL.revokeObjectURL(url)
  }

  const handlePrint = () => {
    const headers=['#',...activeCols.map(c=>c.label)].map(h=>`<th style="border:1px solid #cbd5e1;padding:8px 10px;background:#1e3a5f;color:#fff;font-size:11px;">${h}</th>`).join('')
    const body=rows.map((row,i)=>`<tr>${[i+1,...activeCols.map(c=>fmt(row[c.key]))].map(v=>`<td style="border:1px solid #e2e8f0;padding:8px 10px;font-size:11px;">${v}</td>`).join('')}</tr>`).join('')
    const wmStyle=watermark?`<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:80px;font-weight:900;color:rgba(0,0,0,0.06);pointer-events:none;z-index:0;">${watermark}</div>`:''
    const win=window.open('','_blank','width=1050,height=750')
    if(!win)return
    win.document.write(`<html><head><meta charset="utf-8"/>
      <style>body{font-family:Arial,sans-serif;padding:22px;color:#1e293b;}table{width:100%;border-collapse:collapse;}@page{margin:14mm;}</style>
    </head><body>${wmStyle}
      <div style="border-bottom:2px solid #1e3a5f;padding-bottom:12px;margin-bottom:16px;display:flex;justify-content:space-between;">
        <div>
          <div style="font-size:18px;font-weight:700;color:#1e3a5f;">${institute.name}</div>
          <div style="font-size:11px;color:#475569;">${institute.address} | ${institute.phone}</div>
        </div>
        <div style="text-align:right;font-size:11px;color:#475569;">
          <strong>${source.label} Report</strong><br/>Date: ${generatedText}<br/>Total: ${rows.length}
        </div>
      </div>
      <table><thead><tr>${headers}</tr></thead>
      <tbody>${body||`<tr><td colspan="${activeCols.length+1}" style="padding:14px;text-align:center;border:1px solid #e2e8f0;">No records</td></tr>`}</tbody></table>
      <script>window.onload=function(){window.print();setTimeout(()=>window.close(),400)}<\/script>
    </body></html>`)
    win.document.close()
  }

  const allPresets = [...BUILTIN_PRESETS, ...savedPresets]

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="p-6 bg-slate-50 min-h-screen">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1e3a5f]">📈 Report Generator</h1>
          <p className="text-sm text-slate-500 mt-1">
            {SOURCES.length} modules · PDF · Excel · CSV · Word · Print
          </p>
        </div>
        <button onClick={() => setShowLog(v => !v)}
          className="text-xs text-slate-500 bg-white border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50">
          📋 Report Log ({reportLog.length})
        </button>
      </div>

      {/* Report Log */}
      {showLog && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-[#1e3a5f]">📋 Report History</h2>
            <button onClick={() => { setReportLog([]); localStorage.removeItem('gnsi_report_log') }} className="text-xs text-red-500 hover:underline">Clear All</button>
          </div>
          {reportLog.length === 0
            ? <p className="text-xs text-slate-400">No reports generated yet.</p>
            : <div className="overflow-x-auto">
                <table className="w-full text-xs text-slate-600">
                  <thead><tr className="bg-slate-50 text-slate-500 uppercase text-[10px]">
                    <th className="px-3 py-2 text-left">Source</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Records</th>
                    <th className="px-3 py-2 text-left">Generated At</th>
                  </tr></thead>
                  <tbody>
                    {reportLog.map(e => (
                      <tr key={e.id} className="border-t border-slate-50">
                        <td className="px-3 py-2 font-semibold">{e.source}</td>
                        <td className="px-3 py-2">{e.filters.statusFilter}</td>
                        <td className="px-3 py-2 font-bold text-[#1e3a5f]">{e.total}</td>
                        <td className="px-3 py-2 text-slate-400">{e.at}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          }
        </div>
      )}

      {/* Institute Setup */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 mb-5">
        <h2 className="text-sm font-bold text-[#1e3a5f] uppercase tracking-wide mb-4">🏫 Institute Header</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {[{label:'Institute Name',key:'name'},{label:'Address',key:'address'},{label:'Phone',key:'phone'}].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-semibold text-slate-600 mb-1">{f.label}</label>
              <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30"
                value={institute[f.key]} onChange={e => setInstitute({...institute,[f.key]:e.target.value})} />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-6 flex-wrap">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Upload Logo</label>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleLogo} className="text-xs text-slate-500" />
          </div>
          {logoDataUrl
            ? <div className="flex flex-col items-center gap-1">
                <img src={logoDataUrl} alt="Logo" className="w-14 h-14 rounded-lg object-contain border border-slate-200" />
                <button onClick={() => setLogoDataUrl('')} className="text-xs text-red-500 hover:underline">Remove</button>
              </div>
            : <div className="w-14 h-14 rounded-lg bg-[#1e3a5f] flex items-center justify-center text-white font-bold text-xl">G</div>
          }
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Watermark</label>
            <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
              value={watermark} onChange={e => setWatermark(e.target.value)}>
              <option value="">None</option>
              <option value="CONFIDENTIAL">CONFIDENTIAL</option>
              <option value="DRAFT">DRAFT</option>
              <option value="INTERNAL">INTERNAL</option>
            </select>
          </div>
        </div>
      </div>

      {/* Presets */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 mb-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm font-bold text-[#1e3a5f] uppercase tracking-wide">⚡ Quick Presets</h2>
          <button onClick={() => setShowPresetBox(v => !v)}
            className="text-xs bg-[#1e3a5f] text-white px-3 py-1.5 rounded-lg hover:bg-[#163055]">
            + Save Current as Preset
          </button>
        </div>
        {showPresetBox && (
          <div className="flex gap-2 mb-3">
            <input className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
              placeholder="Preset name…" value={presetName} onChange={e => setPresetName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && savePreset()} />
            <button onClick={savePreset} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700">Save</button>
            <button onClick={() => setShowPresetBox(false)} className="bg-slate-200 text-slate-600 px-3 py-2 rounded-lg text-sm hover:bg-slate-300">Cancel</button>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {allPresets.map(p => (
            <div key={p.id} className="flex items-center gap-1">
              <button onClick={() => loadPreset(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${p.builtin ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                {p.label}
              </button>
              {!p.builtin && (
                <button onClick={() => deletePreset(p.id)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Source + Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 mb-5">
        <h2 className="text-sm font-bold text-[#1e3a5f] uppercase tracking-wide mb-3">📂 Report Source & Filters</h2>

        {/* Source tabs — grouped */}
        <div className="mb-4">
          <p className="text-xs text-slate-400 font-semibold uppercase mb-2">Students & Admissions</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {SOURCES.filter(s => ['students','admissions','course_enrollments'].includes(s.key)).map(s => (
              <button key={s.key} onClick={() => handleSourceChange(s.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${sourceKey===s.key?'bg-[#1e3a5f] text-white shadow':'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {s.icon} {s.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400 font-semibold uppercase mb-2">Finance</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {SOURCES.filter(s => ['fees','fee_invoices','adm_fee_collections','accounts','salary'].includes(s.key)).map(s => (
              <button key={s.key} onClick={() => handleSourceChange(s.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${sourceKey===s.key?'bg-[#1e3a5f] text-white shadow':'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {s.icon} {s.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400 font-semibold uppercase mb-2">Academic & Staff</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {SOURCES.filter(s => ['attendance','exams','exam_scores','staff_profiles','leave','staff_tasks'].includes(s.key)).map(s => (
              <button key={s.key} onClick={() => handleSourceChange(s.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${sourceKey===s.key?'bg-[#1e3a5f] text-white shadow':'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {s.icon} {s.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400 font-semibold uppercase mb-2">Hostel & Admin</p>
          <div className="flex flex-wrap gap-2">
            {SOURCES.filter(s => ['hostel_rooms','hostel_incidents','notices'].includes(s.key)).map(s => (
              <button key={s.key} onClick={() => handleSourceChange(s.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${sourceKey===s.key?'bg-[#1e3a5f] text-white shadow':'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {s.icon} {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filters grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Search</label>
            <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30"
              value={search} onChange={e => setSearch(e.target.value)} placeholder="Search any field…" />
          </div>
          {source.statusCol && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
              <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30"
                value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                {availableStatuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          {source.dateCol && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Date From</label>
                <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30"
                  value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Date To</label>
                <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30"
                  value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
            </>
          )}
          {source.groupCols?.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Group By</label>
              <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30"
                value={groupBy} onChange={e => setGroupBy(e.target.value)}>
                <option value="">— No Grouping —</option>
                {source.groupCols.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
          <div className="flex items-end">
            <button onClick={() => handleGenerate()} disabled={loading}
              className="w-full bg-[#1e3a5f] hover:bg-[#163055] text-white font-bold py-2 px-4 rounded-lg text-sm transition-all disabled:opacity-60">
              {loading ? '⏳ Loading…' : '🔄 Generate Report'}
            </button>
          </div>
        </div>

        {/* Column toggles */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-2">
            Columns — <span className="text-slate-400 font-normal">drag to reorder</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {(selectedCols.length ? selectedCols : source.columns.map(c => c.key)).map((key, i) => {
              const col = source.columns.find(c => c.key === key)
              if (!col) return null
              return (
                <div key={key} draggable
                  onDragStart={() => handleDragStart(i)}
                  onDragOver={e => handleDragOver(e, i)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs cursor-grab select-none transition-all ${dragIdx===i?'opacity-50 scale-95':''}`}
                  style={{background:selectedCols.includes(key)?'#e0e7ff':'#f1f5f9',color:selectedCols.includes(key)?'#3730a3':'#64748b'}}>
                  <span className="cursor-grab text-slate-300">⠿</span>
                  <input type="checkbox" checked={selectedCols.includes(key)} onChange={() => toggleCol(key)} className="accent-[#1e3a5f]" />
                  {col.label}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-5">
          ⚠️ {error}
        </div>
      )}

      {/* Stats */}
      {generated && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          <div className="bg-white rounded-xl border-l-4 border-blue-500 shadow-sm p-4">
            <p className="text-xs text-slate-500 font-semibold uppercase">Total Records</p>
            <p className="text-3xl font-extrabold text-[#1e3a5f]">{rows.length}</p>
            {allRows.length!==rows.length&&<p className="text-xs text-slate-400">of {allRows.length} fetched</p>}
          </div>
          <div className="bg-white rounded-xl border-l-4 border-green-500 shadow-sm p-4">
            <p className="text-xs text-slate-500 font-semibold uppercase">Positive</p>
            <p className="text-3xl font-extrabold text-green-600">{positiveCount}</p>
          </div>
          <div className="bg-white rounded-xl border-l-4 border-red-400 shadow-sm p-4">
            <p className="text-xs text-slate-500 font-semibold uppercase">Pending / Other</p>
            <p className="text-3xl font-extrabold text-red-500">{negativeCount}</p>
          </div>
          {source.aggregates.map(col => {
            const colDef=source.columns.find(c=>c.key===col)
            return(
              <div key={col} className="bg-white rounded-xl border-l-4 border-amber-400 shadow-sm p-4">
                <p className="text-xs text-slate-500 font-semibold uppercase">Total {colDef?.label||col}</p>
                <p className="text-2xl font-extrabold text-amber-600">₹{(aggregates[col]||0).toLocaleString('en-IN')}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Export + View toggle */}
      {generated && rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <button onClick={exportPdf}   className="bg-red-700 hover:bg-red-800 text-white font-semibold text-sm px-4 py-2 rounded-lg">📄 PDF</button>
          <button onClick={exportExcel} className="bg-green-700 hover:bg-green-800 text-white font-semibold text-sm px-4 py-2 rounded-lg">📊 Excel</button>
          <button onClick={exportCsv}   className="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm px-4 py-2 rounded-lg">📁 CSV</button>
          <button onClick={exportWord}  className="bg-blue-700 hover:bg-blue-800 text-white font-semibold text-sm px-4 py-2 rounded-lg">📝 Word</button>
          <button onClick={handlePrint} className="bg-slate-600 hover:bg-slate-700 text-white font-semibold text-sm px-4 py-2 rounded-lg">🖨️ Print</button>
          <div className="ml-auto flex rounded-lg overflow-hidden border border-slate-200">
            <button onClick={() => setActiveTab('table')}
              className={`px-4 py-2 text-sm font-semibold transition-all ${activeTab==='table'?'bg-[#1e3a5f] text-white':'bg-white text-slate-600 hover:bg-slate-50'}`}>
              📋 Table
            </button>
            <button onClick={() => setActiveTab('charts')}
              className={`px-4 py-2 text-sm font-semibold transition-all ${activeTab==='charts'?'bg-[#1e3a5f] text-white':'bg-white text-slate-600 hover:bg-slate-50'}`}>
              📊 Charts
            </button>
          </div>
        </div>
      )}

      {/* Charts */}
      {generated && activeTab === 'charts' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
          {chartData.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <h3 className="text-sm font-bold text-[#1e3a5f] mb-4">Status Distribution</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                    label={({name,value})=>`${name}: ${value}`}>
                    {chartData.map((_,i)=><Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]}/>)}
                  </Pie>
                  <Tooltip/><Legend/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          {groupChartData.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <h3 className="text-sm font-bold text-[#1e3a5f] mb-4">Records by {groupBy}</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={groupChartData} margin={{bottom:30}}>
                  <XAxis dataKey="name" tick={{fontSize:11}} angle={-30} textAnchor="end"/>
                  <YAxis tick={{fontSize:11}}/>
                  <Tooltip/>
                  <Bar dataKey="value" radius={[4,4,0,0]}>
                    {groupChartData.map((_,i)=><Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {source.aggregates.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <h3 className="text-sm font-bold text-[#1e3a5f] mb-4">Financial Overview</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={source.aggregates.map(col=>{const colDef=source.columns.find(c=>c.key===col);return{name:colDef?.label||col,value:aggregates[col]||0}})}>
                  <XAxis dataKey="name" tick={{fontSize:12}}/>
                  <YAxis tick={{fontSize:11}} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`}/>
                  <Tooltip formatter={v=>`₹${Number(v).toLocaleString('en-IN')}`}/>
                  <Bar dataKey="value" radius={[4,4,0,0]}>
                    {source.aggregates.map((_,i)=><Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      {activeTab === 'table' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-bold text-[#1e3a5f] text-sm">{source.icon} {source.label} Report</h2>
            {generated && (
              <div className="flex items-center gap-4">
                <span className="text-xs text-slate-400">{rows.length} records · {generatedText}</span>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1 text-xs">
                    <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}
                      className="px-2 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50">‹</button>
                    <span className="px-2 text-slate-600">{page} / {totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages}
                      className="px-2 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50">›</button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            {groupedRows && generated ? (
              groupedRows.map(([group, gRows]) => (
                <div key={group}>
                  <div className="bg-slate-100 px-4 py-2 text-xs font-bold text-[#1e3a5f] uppercase tracking-wide flex items-center justify-between">
                    <span>{groupBy}: {group}</span>
                    <span className="text-slate-400 font-normal">{gRows.length} records</span>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">#</th>
                        {activeCols.map(col => (
                          <th key={col.key} className="px-4 py-3 text-left font-semibold cursor-pointer hover:text-[#1e3a5f] select-none"
                            onClick={() => handleSort(col.key)}>
                            {col.label}<SortIcon col={col.key} sortCol={sortCol} sortDir={sortDir}/>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {gRows.map((row, i) => (
                        <tr key={row.id||i} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 text-slate-400 text-xs">{i+1}</td>
                          {activeCols.map(col => (
                            <td key={col.key} className="px-4 py-3 text-slate-700">
                              {col.key===source.statusCol?<StatusBadge value={row[col.key]}/>:<span>{fmt(row[col.key])}</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">#</th>
                    {activeCols.map(col => (
                      <th key={col.key} className="px-4 py-3 text-left font-semibold cursor-pointer hover:text-[#1e3a5f] select-none"
                        onClick={() => handleSort(col.key)}>
                        {col.label}<SortIcon col={col.key} sortCol={sortCol} sortDir={sortDir}/>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {!generated ? (
                    <tr><td colSpan={activeCols.length+1} className="px-4 py-10 text-center text-slate-400 text-sm">
                      Select a source and click <strong>Generate Report</strong>
                    </td></tr>
                  ) : pagedRows.length === 0 ? (
                    <tr><td colSpan={activeCols.length+1} className="px-4 py-10 text-center text-slate-400 text-sm">No records found</td></tr>
                  ) : (
                    pagedRows.map((row, i) => (
                      <tr key={row.id||(page-1)*PAGE_SIZE+i} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-slate-400 text-xs">{(page-1)*PAGE_SIZE+i+1}</td>
                        {activeCols.map(col => (
                          <td key={col.key} className="px-4 py-3 text-slate-700">
                            {col.key===source.statusCol?<StatusBadge value={row[col.key]}/>:<span>{fmt(row[col.key])}</span>}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          {generated && totalPages > 1 && !groupedRows && (
            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Showing {(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE,rows.length)} of {rows.length}</span>
              <div className="flex gap-1">
                <button onClick={() => setPage(1)} disabled={page===1} className="px-2 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50">«</button>
                <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} className="px-2 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50">‹</button>
                {Array.from({length:Math.min(5,totalPages)},(_,i)=>{
                  const p=Math.min(Math.max(page-2,1)+i,totalPages)
                  return(
                    <button key={p} onClick={()=>setPage(p)}
                      className={`px-2 py-1 rounded border ${p===page?'bg-[#1e3a5f] text-white border-[#1e3a5f]':'border-slate-200 hover:bg-slate-50'}`}>{p}</button>
                  )
                })}
                <button onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages} className="px-2 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50">›</button>
                <button onClick={() => setPage(totalPages)} disabled={page===totalPages} className="px-2 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50">»</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}