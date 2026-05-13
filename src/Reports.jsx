import { useState, useMemo, useRef } from 'react'
import { supabase } from './supabase'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import ExcelJS from 'exceljs'

// ─── Source config ─────────────────────────────────────────────
const SOURCES = [
  {
    key: 'students',
    label: 'Students',
    icon: '🎓',
    table: 'students',
    columns: [
      { key: 'name',         label: 'Name'        },
      { key: 'admission_no', label: 'Adm No'      },
      { key: 'class_name',   label: 'Class'       },
      { key: 'course',       label: 'Course'      },
      { key: 'batch',        label: 'Batch'       },
      { key: 'gender',       label: 'Gender'      },
      { key: 'phone',        label: 'Phone'       },
      { key: 'house',        label: 'House'       },
      { key: 'status',       label: 'Status'      },
      { key: 'created_at',   label: 'Joined'      },
    ],
    statusCol: 'status',
  },
  {
    key: 'admissions',
    label: 'Admissions',
    icon: '📋',
    table: 'admissions',
    columns: [
      { key: 'applicant_name', label: 'Name'           },
      { key: 'adm_no',         label: 'Adm No'         },
      { key: 'class_name',     label: 'Class'          },
      { key: 'course',         label: 'Course'         },
      { key: 'batch',          label: 'Batch'          },
      { key: 'gender',         label: 'Gender'         },
      { key: 'phone',          label: 'Phone'          },
      { key: 'parent_name',    label: 'Parent'         },
      { key: 'payment_status', label: 'Payment'        },
      { key: 'status',         label: 'Status'         },
      { key: 'created_at',     label: 'Date'           },
    ],
    statusCol: 'status',
  },
  {
    key: 'fees',
    label: 'Fees',
    icon: '💰',
    table: 'fees',
    columns: [
      { key: 'student_id', label: 'Student ID' },
      { key: 'amount',     label: 'Amount (₹)' },
      { key: 'paid',       label: 'Paid (₹)'   },
      { key: 'due_date',   label: 'Due Date'   },
    ],
    statusCol: null,
  },
  {
    key: 'attendance',
    label: 'Attendance',
    icon: '📅',
    table: 'attendance',
    columns: [
      { key: 'status', label: 'Status' },
      { key: 'date',   label: 'Date'   },
    ],
    statusCol: 'status',
  },
  {
    key: 'exams',
    label: 'Exams',
    icon: '📝',
    table: 'exams',
    columns: [
      { key: 'subject', label: 'Subject' },
      { key: 'date',    label: 'Date'    },
      { key: 'time',    label: 'Time'    },
    ],
    statusCol: null,
  },
  {
    key: 'salary',
    label: 'Salary',
    icon: '💵',
    table: 'salary',
    columns: [
      { key: 'amount', label: 'Amount (₹)' },
      { key: 'status', label: 'Status'     },
    ],
    statusCol: 'status',
  },
  // ⚠️ Hostel & Leave: update table names below to match your Supabase schema
  // e.g. 'hostel_allotments', 'leave_requests' — check your Supabase Table Editor
  // {
  //   key: 'hostel',
  //   label: 'Hostel',
  //   icon: '🏨',
  //   table: 'hostel_allotments',   // ← set your actual table name
  //   columns: [
  //     { key: 'name',   label: 'Name'   },
  //     { key: 'room',   label: 'Room'   },
  //     { key: 'house',  label: 'House'  },
  //     { key: 'status', label: 'Status' },
  //   ],
  //   statusCol: 'status',
  // },
  // {
  //   key: 'leave',
  //   label: 'Leave',
  //   icon: '🏖️',
  //   table: 'leave_requests',      // ← set your actual table name
  //   columns: [
  //     { key: 'type',      label: 'Type'   },
  //     { key: 'from_date', label: 'From'   },
  //     { key: 'to_date',   label: 'To'     },
  //     { key: 'status',    label: 'Status' },
  //   ],
  //   statusCol: 'status',
  // },
]

const DEFAULT_INSTITUTE = {
  name:    'Guidance Navodaya & Sainik Institute',
  address: 'Khangabok, Thoubal, Manipur',
  phone:   '+91-XXXXXXXXXX',
}

// ─── Status badge ──────────────────────────────────────────────
function StatusBadge({ value }) {
  const positive = ['Confirmed', 'Paid', 'Present', 'Passed', 'Occupied', 'Approved', 'Active', 'Enrolled', 'Completed']
  const negative  = ['Pending', 'Absent', 'Vacant', 'Rejected', 'Unpaid', 'Failed', 'Cancelled', 'Dropped']
  const cls = positive.includes(value)
    ? 'bg-green-100 text-green-700'
    : negative.includes(value)
    ? 'bg-red-100 text-red-600'
    : 'bg-yellow-100 text-yellow-700'
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {value}
    </span>
  )
}

// ─── Main Component ────────────────────────────────────────────
export default function Reports() {
  const [sourceKey,        setSourceKey]        = useState('admissions')
  const [search,           setSearch]           = useState('')
  const [statusFilter,     setStatusFilter]     = useState('All')
  const [selectedCols,     setSelectedCols]     = useState([])
  const [rows,             setRows]             = useState([])
  const [loading,          setLoading]          = useState(false)
  const [generated,        setGenerated]        = useState(false)
  const [error,            setError]            = useState('')
  const [institute,        setInstitute]        = useState(DEFAULT_INSTITUTE)
  const [logoDataUrl,      setLogoDataUrl]      = useState('')
  const fileRef = useRef(null)

  const source = SOURCES.find(s => s.key === sourceKey) || SOURCES[0]

  // Init selected columns when source changes
  const handleSourceChange = (key) => {
    const s = SOURCES.find(x => x.key === key)
    setSourceKey(key)
    setSelectedCols(s.columns.map(c => c.key))
    setRows([])
    setGenerated(false)
    setStatusFilter('All')
    setSearch('')
    setError('')
  }

  // Init cols if not set
  const activeCols = selectedCols.length
    ? source.columns.filter(c => selectedCols.includes(c.key))
    : source.columns

  const toggleCol = (key) => {
    setSelectedCols(prev =>
      prev.includes(key)
        ? prev.length === 1 ? prev : prev.filter(k => k !== key)
        : [...prev, key]
    )
  }

  // ── Fetch from Supabase ──────────────────────────────────────
  const handleGenerate = async () => {
    setLoading(true)
    setError('')
    try {
      let query = supabase.from(source.table).select('*')
      if (source.statusCol && statusFilter !== 'All') {
        query = query.eq(source.statusCol, statusFilter)
      }
      const { data, error: err } = await query
      if (err) throw err

      // Client-side search
      const q = search.toLowerCase()
      const filtered = q
        ? (data || []).filter(row =>
            Object.values(row).some(v => String(v || '').toLowerCase().includes(q))
          )
        : (data || [])

      setRows(filtered)
      setGenerated(true)

      // Init columns on first generate
      if (!selectedCols.length) setSelectedCols(source.columns.map(c => c.key))
    } catch (e) {
      setError(e.message || 'Failed to fetch data')
    }
    setLoading(false)
  }

  // Available statuses from loaded rows
  const availableStatuses = useMemo(() => {
    if (!source.statusCol) return []
    const vals = [...new Set(rows.map(r => r[source.statusCol]).filter(Boolean))]
    return ['All', ...vals]
  }, [rows, source])

  // ── Logo upload ──────────────────────────────────────────────
  const handleLogo = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setLogoDataUrl(ev.target.result)
    reader.readAsDataURL(file)
  }

  const now = new Date()
  const generatedText = now.toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })
  const fileStamp = now.toISOString().slice(0, 19).replace(/[:T]/g, '-')

  // ── Stats ────────────────────────────────────────────────────
  const positiveStatuses = ['Confirmed', 'Paid', 'Present', 'Passed', 'Occupied', 'Approved']
  const negativeStatuses = ['Pending', 'Absent', 'Vacant', 'Rejected', 'Unpaid']
  const positiveCount = rows.filter(r => source.statusCol && positiveStatuses.includes(r[source.statusCol])).length
  const negativeCount = rows.filter(r => source.statusCol && negativeStatuses.includes(r[source.statusCol])).length

  const fmt = (v) => {
    if (v === null || v === undefined || v === '') return '—'
    // Only parse actual ISO timestamps: "2026-05-10T12:34:56..."
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
      const d = new Date(v)
      return isNaN(d) ? v : d.toLocaleDateString('en-IN')
    }
    // Plain date strings: "2026-05-10"
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const d = new Date(v)
      return isNaN(d) ? v : d.toLocaleDateString('en-IN')
    }
    return v
  }

  // ── PDF Export (Professional A4) ────────────────────────────
  const exportPdf = () => {
    // Use landscape if more than 6 columns to prevent wrapping
    const isWide = activeCols.length > 6
    const doc = new jsPDF(isWide ? 'l' : 'p', 'pt', 'a4')
    const pw  = doc.internal.pageSize.getWidth()
    const ph  = doc.internal.pageSize.getHeight()
    const mx  = 36

    // ── Colours ──
    const navy   = [15,  40,  80]
    const steel  = [30,  58,  95]
    const sky    = [56,  96, 156]
    const silver = [241, 245, 249]
    const muted  = [100, 116, 139]
    const white  = [255, 255, 255]
    const gold   = [180, 140,  40]

    // ══════════════════════════════════════════════════
    // 1. DEEP NAVY HEADER BAND (full width, 110 pt tall)
    // ══════════════════════════════════════════════════
    doc.setFillColor(...navy)
    doc.rect(0, 0, pw, 110, 'F')

    // Subtle diagonal accent stripe in header
    doc.setFillColor(...sky)
    doc.setGState(new doc.GState({ opacity: 0.12 }))
    doc.triangle(pw - 160, 0, pw, 0, pw, 110, 'F')
    doc.setGState(new doc.GState({ opacity: 1 }))

    // Gold top border line (3pt)
    doc.setFillColor(...gold)
    doc.rect(0, 0, pw, 3, 'F')

    // ── Logo in header ──
    let logoX = mx
    if (logoDataUrl) {
      const ext = logoDataUrl.split(';')[0].split('/')[1].toUpperCase()
      try {
        doc.addImage(logoDataUrl, ext === 'SVG' ? 'PNG' : ext, mx, 18, 70, 70)
        logoX = mx + 82
      } catch { logoX = mx }
    } else {
      // Placeholder circle with "G"
      doc.setFillColor(...sky)
      doc.circle(mx + 35, 55, 35, 'F')
      doc.setFont('helvetica', 'bold').setFontSize(26).setTextColor(...white)
      doc.text('G', mx + 35, 62, { align: 'center' })
      logoX = mx + 82
    }

    // ── Institute name + address in header ──
    doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(...white)
    doc.text(institute.name, logoX, 40)

    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(180, 200, 230)
    doc.text(institute.address, logoX, 56)
    doc.text(`Phone: ${institute.phone}`, logoX, 70)

    // ── Report type badge (top-right of header) — no emoji, jsPDF can't render them ──
    const badgeLabel = `${source.label} Report`
    const badgeW = 120, badgeH = 28, badgeX = pw - mx - badgeW, badgeY = 18
    doc.setFillColor(...sky)
    doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 4, 4, 'F')
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...white)
    doc.text(badgeLabel, badgeX + badgeW / 2, badgeY + 18, { align: 'center' })

    // Print date below badge
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(180, 200, 230)
    doc.text(`Generated: ${generatedText}`, pw - mx, 60, { align: 'right' })

    // ══════════════════════════════════════════════════
    // 2. SUMMARY RIBBON (light silver band, 48 pt)
    // ══════════════════════════════════════════════════
    const ribbonY = 110
    doc.setFillColor(...silver)
    doc.rect(0, ribbonY, pw, 48, 'F')

    // Three summary boxes inside ribbon
    const summaryItems = [
      { label: 'Total Records', value: String(rows.length) },
      { label: 'Status Filter', value: statusFilter },
      { label: 'Search Query',  value: search || 'All records' },
    ]
    const boxW = (pw - mx * 2) / summaryItems.length
    summaryItems.forEach((item, i) => {
      const bx = mx + i * boxW
      // Divider between boxes
      if (i > 0) {
        doc.setDrawColor(200, 210, 220).setLineWidth(0.5)
        doc.line(bx, ribbonY + 8, bx, ribbonY + 40)
      }
      doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...muted)
      doc.text(item.label.toUpperCase(), bx + boxW / 2, ribbonY + 18, { align: 'center' })
      doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...steel)
      doc.text(item.value, bx + boxW / 2, ribbonY + 34, { align: 'center' })
    })

    // Gold accent line below ribbon
    doc.setFillColor(...gold)
    doc.rect(0, ribbonY + 48, pw, 2, 'F')

    // ══════════════════════════════════════════════════
    // 3. DATA TABLE
    // ══════════════════════════════════════════════════
    const tableStartY = ribbonY + 58

    // Status cell colouring
    const positiveSet = new Set(['Confirmed','Paid','Present','Passed','Occupied','Approved','Active','Enrolled','Completed'])
    const negativeSet  = new Set(['Pending','Absent','Vacant','Rejected','Unpaid','Failed','Cancelled','Dropped'])

    autoTable(doc, {
      startY: tableStartY,
      head:   [['#', ...activeCols.map(c => c.label)]],
      body:   rows.map((row, i) => [i + 1, ...activeCols.map(c => fmt(row[c.key]))]),

      styles: {
        font:        'helvetica',
        fontSize:    8,
        cellPadding: { top: 5, bottom: 5, left: 6, right: 6 },
        valign:      'middle',
        textColor:   [30, 41, 59],
        lineColor:   [226, 232, 240],
        lineWidth:   0.3,
        overflow:    'linebreak',
      },
      headStyles: {
        fillColor:   steel,
        textColor:   white,
        fontStyle:   'bold',
        fontSize:    8,
        cellPadding: { top: 7, bottom: 7, left: 6, right: 6 },
        halign:      'left',
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { cellWidth: 20, halign: 'center', textColor: muted, fontSize: 7 } },
      tableWidth: 'auto',
      margin: { left: mx, right: mx, bottom: 52 },

      // Colour status cells inline
      didParseCell: (data) => {
        if (data.section === 'body' && source.statusCol) {
          const colIndex = activeCols.findIndex(c => c.key === source.statusCol)
          if (colIndex !== -1 && data.column.index === colIndex + 1) {
            const val = String(data.cell.raw || '')
            if (positiveSet.has(val)) {
              data.cell.styles.textColor = [22, 163, 74]
              data.cell.styles.fontStyle = 'bold'
            } else if (negativeSet.has(val)) {
              data.cell.styles.textColor = [220, 38, 38]
              data.cell.styles.fontStyle = 'bold'
            } else {
              data.cell.styles.textColor = [180, 83, 9]
              data.cell.styles.fontStyle = 'bold'
            }
          }
        }
      },

      // ── Per-page header & footer ──
      didDrawPage: (hookData) => {
        const pageNum   = doc.internal.getCurrentPageInfo().pageNumber
        const totalPages = doc.internal.getNumberOfPages()

        // Repeat narrow header on pages > 1
        if (pageNum > 1) {
          doc.setFillColor(...navy)
          doc.rect(0, 0, pw, 32, 'F')
          doc.setFillColor(...gold)
          doc.rect(0, 0, pw, 2, 'F')
          doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...white)
          doc.text(institute.name, mx, 21)
          doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(180, 200, 230)
          doc.text(`${source.label} Report  •  Cont.`, pw - mx, 21, { align: 'right' })
        }

        // ── Footer band ──
        doc.setFillColor(...silver)
        doc.rect(0, ph - 38, pw, 38, 'F')
        doc.setFillColor(...gold)
        doc.rect(0, ph - 38, pw, 1.5, 'F')

        doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...muted)
        doc.text(`${institute.name}  •  ${source.label} Report  •  Confidential`, mx, ph - 16)
        doc.text(`Printed: ${generatedText}`, pw / 2, ph - 16, { align: 'center' })

        // Page number pill
        const pill = `Page ${pageNum} of ${totalPages}`
        const pillW = 70, pillH = 16, pillX = pw - mx - pillW, pillY = ph - 28
        doc.setFillColor(...steel)
        doc.roundedRect(pillX, pillY, pillW, pillH, 3, 3, 'F')
        doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(...white)
        doc.text(pill, pillX + pillW / 2, pillY + 11, { align: 'center' })
      },
    })

    doc.save(`GNSI-${source.label}-Report-${fileStamp}.pdf`)
  }

  // ── Excel Export ─────────────────────────────────────────────
  const exportExcel = async () => {
    const wb = new ExcelJS.Workbook()
    wb.creator = institute.name
    wb.created = new Date()
    const ws = wb.addWorksheet(`${source.label} Report`)
    const totalCols = activeCols.length + 1

    if (logoDataUrl && logoDataUrl.startsWith('data:image')) {
      try {
        const ext = logoDataUrl.split(';')[0].split('/')[1]
        const imgId = wb.addImage({ base64: logoDataUrl.split(',')[1], extension: ext })
        ws.addImage(imgId, { tl: { col: 0, row: 0 }, ext: { width: 60, height: 60 } })
      } catch {}
    }

    const addRow = (val, font, align = 'center') => {
      const ri = ws.rowCount + 1
      ws.mergeCells(`A${ri}:${String.fromCharCode(64 + totalCols)}${ri}`)
      const cell = ws.getCell(`A${ri}`)
      cell.value = val
      cell.font = font
      cell.alignment = { horizontal: align, vertical: 'middle' }
    }

    addRow(institute.name,      { bold: true, size: 16, color: { argb: 'FF1E3A5F' } })
    addRow(institute.address,   { size: 11,  color: { argb: 'FF475569' } })
    addRow(`Phone: ${institute.phone}`, { size: 10, color: { argb: 'FF475569' } })
    addRow(`Print Date: ${generatedText}`, { italic: true, size: 10, color: { argb: 'FF64748B' } })
    addRow(`${source.label} Report`, { bold: true, size: 14, color: { argb: 'FF1E3A5F' } })
    addRow(`Filters: Status=${statusFilter} | Search="${search || 'All'}" | Total=${rows.length}`, { italic: true, size: 9, color: { argb: 'FF94A3B8' } })
    ws.addRow([])

    const hdr = ws.addRow(['#', ...activeCols.map(c => c.label)])
    hdr.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    hdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } }
    hdr.alignment = { horizontal: 'center', vertical: 'middle' }
    hdr.height = 24

    rows.forEach((row, i) => {
      const r = ws.addRow([i + 1, ...activeCols.map(c => fmt(row[c.key]))])
      r.alignment = { vertical: 'middle' }
      if (i % 2 === 1) r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
    })

    ws.columns = [{ width: 6 }, ...activeCols.map(() => ({ width: 22 }))]

    const buf = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `GNSI-${source.label}-Report-${fileStamp}.xlsx`; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Word Export ──────────────────────────────────────────────
  const exportWord = () => {
    const headers = ['#', ...activeCols.map(c => c.label)]
      .map(h => `<th style="border:1px solid #cbd5e1;padding:8px 12px;background:#1e3a5f;color:#fff;font-size:12px;">${h}</th>`)
      .join('')
    const body = rows.map((row, i) =>
      `<tr>${[i + 1, ...activeCols.map(c => fmt(row[c.key]))]
        .map(v => `<td style="border:1px solid #e2e8f0;padding:8px 12px;font-size:12px;">${v}</td>`)
        .join('')}</tr>`
    ).join('')
    const logoTag = logoDataUrl
      ? `<img src="${logoDataUrl}" style="width:56px;height:56px;border-radius:8px;object-fit:contain;" />`
      : `<div style="width:56px;height:56px;border-radius:8px;background:#1e3a5f;color:#fff;font-size:20px;font-weight:700;display:flex;align-items:center;justify-content:center;">G</div>`

    const html = `<html><head><meta charset="utf-8"/><title>${source.label} Report</title></head>
    <body style="font-family:Arial,sans-serif;margin:30px;">
      <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #1e3a5f;padding-bottom:12px;margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:12px;">
          ${logoTag}
          <div>
            <div style="font-size:18px;font-weight:700;color:#1e3a5f;">${institute.name}</div>
            <div style="font-size:12px;color:#475569;">${institute.address}</div>
            <div style="font-size:12px;color:#475569;">Phone: ${institute.phone}</div>
          </div>
        </div>
        <div style="text-align:right;font-size:12px;color:#475569;">
          <strong>${source.label} Report</strong><br/>
          Print Date: ${generatedText}<br/>
          Total: ${rows.length} records
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr>${headers}</tr></thead>
        <tbody>${body || `<tr><td colspan="${activeCols.length + 1}" style="padding:14px;text-align:center;">No records</td></tr>`}</tbody>
      </table>
    </body></html>`

    const blob = new Blob([html], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `GNSI-${source.label}-Report-${fileStamp}.doc`; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Print ────────────────────────────────────────────────────
  const handlePrint = () => {
    const headers = ['#', ...activeCols.map(c => c.label)]
      .map(h => `<th style="border:1px solid #cbd5e1;padding:8px 10px;background:#1e3a5f;color:#fff;font-size:11px;">${h}</th>`)
      .join('')
    const body = rows.map((row, i) =>
      `<tr>${[i + 1, ...activeCols.map(c => fmt(row[c.key]))]
        .map(v => `<td style="border:1px solid #e2e8f0;padding:8px 10px;font-size:11px;">${v}</td>`)
        .join('')}</tr>`
    ).join('')
    const logoTag = logoDataUrl
      ? `<img src="${logoDataUrl}" style="width:52px;height:52px;border-radius:8px;object-fit:contain;" />`
      : `<div style="width:52px;height:52px;border-radius:8px;background:#1e3a5f;color:#fff;font-size:18px;font-weight:700;display:flex;align-items:center;justify-content:center;">G</div>`

    const win = window.open('', '_blank', 'width=1050,height=750')
    if (!win) return
    win.document.write(`<html><head><meta charset="utf-8"/>
      <style>body{font-family:Arial,sans-serif;padding:22px;color:#1e293b;}table{width:100%;border-collapse:collapse;}@page{margin:14mm;}@media print{.no-print{display:none!important;}}</style>
    </head><body>
      <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #1e3a5f;padding-bottom:12px;margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:12px;">${logoTag}<div>
          <div style="font-size:18px;font-weight:700;color:#1e3a5f;">${institute.name}</div>
          <div style="font-size:11px;color:#475569;">${institute.address} | ${institute.phone}</div>
        </div></div>
        <div style="text-align:right;font-size:11px;color:#475569;">
          <strong>${source.label} Report</strong><br/>Print Date: ${generatedText}<br/>
          Status: ${statusFilter} | Total: ${rows.length}
        </div>
      </div>
      <table><thead><tr>${headers}</tr></thead>
      <tbody>${body || `<tr><td colspan="${activeCols.length + 1}" style="padding:14px;text-align:center;border:1px solid #e2e8f0;">No records</td></tr>`}</tbody></table>
      <div style="margin-top:12px;font-size:10px;color:#94a3b8;display:flex;justify-content:space-between;">
        <span>${institute.name} • ${source.label} Report</span><span>Printed on: ${generatedText}</span>
      </div>
      <script>window.onload=function(){window.print();setTimeout(()=>window.close(),400)}<\/script>
    </body></html>`)
    win.document.close()
  }

  // ─── Render ──────────────────────────────────────────────────
  return (
    <div className="p-6 bg-slate-50 min-h-screen">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-[#1e3a5f]">📈 Report Generator</h1>
        <p className="text-sm text-slate-500 mt-1">Live data from Supabase · Export to PDF, Excel, Word or Print</p>
      </div>

      {/* Institute Setup */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 mb-5">
        <h2 className="text-sm font-bold text-[#1e3a5f] uppercase tracking-wide mb-4">🏫 Institute Header</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {[
            { label: 'Institute Name', key: 'name' },
            { label: 'Address',        key: 'address' },
            { label: 'Phone',          key: 'phone' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-semibold text-slate-600 mb-1">{f.label}</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30"
                value={institute[f.key]}
                onChange={e => setInstitute({ ...institute, [f.key]: e.target.value })}
              />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Upload Logo</label>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleLogo} className="text-xs text-slate-500" />
            <p className="text-xs text-slate-400 mt-1">PNG, JPG — appears in all exports</p>
          </div>
          {logoDataUrl ? (
            <div className="flex flex-col items-center gap-1">
              <img src={logoDataUrl} alt="Logo" className="w-14 h-14 rounded-lg object-contain border border-slate-200" />
              <button onClick={() => setLogoDataUrl('')} className="text-xs text-red-500 hover:underline">Remove</button>
            </div>
          ) : (
            <div className="w-14 h-14 rounded-lg bg-[#1e3a5f] flex items-center justify-center text-white font-bold text-xl">G</div>
          )}
        </div>
      </div>

      {/* Source Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 mb-5">
        <h2 className="text-sm font-bold text-[#1e3a5f] uppercase tracking-wide mb-3">📂 Report Source</h2>
        <div className="flex flex-wrap gap-2 mb-5">
          {SOURCES.map(s => (
            <button
              key={s.key}
              onClick={() => handleSourceChange(s.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                sourceKey === s.key
                  ? 'bg-[#1e3a5f] text-white shadow'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {s.icon} {s.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Search</label>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search any field..."
            />
          </div>
          {source.statusCol && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Status Filter</label>
              <select
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                {(generated ? availableStatuses : ['All']).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-end">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full bg-[#1e3a5f] hover:bg-[#163055] text-white font-bold py-2 px-4 rounded-lg text-sm transition-all disabled:opacity-60"
            >
              {loading ? '⏳ Loading...' : '🔄 Generate Report'}
            </button>
          </div>
        </div>

        {/* Column toggles */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-2">Columns to Show</label>
          <div className="flex flex-wrap gap-3">
            {source.columns.map(col => (
              <label key={col.key} className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedCols.includes(col.key)}
                  onChange={() => toggleCol(col.key)}
                  className="accent-[#1e3a5f]"
                />
                {col.label}
              </label>
            ))}
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
        <div className="grid grid-cols-3 gap-4 mb-5">
          <div className="bg-white rounded-xl border-l-4 border-blue-500 shadow-sm p-4">
            <p className="text-xs text-slate-500 font-semibold uppercase">Total Records</p>
            <p className="text-3xl font-extrabold text-[#1e3a5f]">{rows.length}</p>
          </div>
          <div className="bg-white rounded-xl border-l-4 border-green-500 shadow-sm p-4">
            <p className="text-xs text-slate-500 font-semibold uppercase">Positive Status</p>
            <p className="text-3xl font-extrabold text-green-600">{positiveCount}</p>
          </div>
          <div className="bg-white rounded-xl border-l-4 border-red-400 shadow-sm p-4">
            <p className="text-xs text-slate-500 font-semibold uppercase">Pending / Other</p>
            <p className="text-3xl font-extrabold text-red-500">{negativeCount}</p>
          </div>
        </div>
      )}

      {/* Export Buttons */}
      {generated && rows.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-5">
          <button onClick={exportPdf}   className="bg-red-700 hover:bg-red-800 text-white font-semibold text-sm px-4 py-2 rounded-lg transition-all">📄 Export PDF</button>
          <button onClick={exportExcel} className="bg-green-700 hover:bg-green-800 text-white font-semibold text-sm px-4 py-2 rounded-lg transition-all">📊 Export Excel</button>
          <button onClick={exportWord}  className="bg-teal-700 hover:bg-teal-800 text-white font-semibold text-sm px-4 py-2 rounded-lg transition-all">📝 Export Word</button>
          <button onClick={handlePrint} className="bg-slate-600 hover:bg-slate-700 text-white font-semibold text-sm px-4 py-2 rounded-lg transition-all">🖨️ Print</button>
        </div>
      )}

      {/* Debug: show raw keys from first row so you can fix column mappings */}
      {generated && rows.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4 text-xs text-amber-800">
          <strong>🔍 Debug — Actual column keys from Supabase ({source.table}):</strong>{' '}
          <code className="bg-amber-100 px-1 rounded">{Object.keys(rows[0]).join(', ')}</code>
          <span className="ml-2 text-amber-600">— update SOURCES config if these differ from expected keys</span>
        </div>
      )}

      {/* Result Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-[#1e3a5f] text-sm">{source.icon} {source.label} Report</h2>
          {generated && <span className="text-xs text-slate-400">{rows.length} records · {generatedText}</span>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">#</th>
                {activeCols.map(col => (
                  <th key={col.key} className="px-4 py-3 text-left font-semibold">{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!generated ? (
                <tr>
                  <td colSpan={activeCols.length + 1} className="px-4 py-10 text-center text-slate-400 text-sm">
                    Select a source and click <strong>Generate Report</strong> to load live data
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={activeCols.length + 1} className="px-4 py-10 text-center text-slate-400 text-sm">
                    No records found
                  </td>
                </tr>
              ) : (
                rows.map((row, i) => (
                  <tr key={row.id || i} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                    {activeCols.map(col => (
                      <td key={col.key} className="px-4 py-3 text-slate-700">
                        {col.key === source.statusCol
                          ? <StatusBadge value={row[col.key]} />
                          : <span>{fmt(row[col.key])}</span>
                        }
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
