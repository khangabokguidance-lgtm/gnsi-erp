// missionSainikDocx.js — Word (.docx) versions of the Mission Sainik printed reports.
// Same content as the print preview, as an editable Word file. `docx` is loaded on demand so it stays out of the main bundle.
const NAVY = '132A4F', GOLD = 'B8923A', LINE = 'D6DDE8', SOFT = 'F1F4FA', RED = 'B42318', MUT = '5B6678'
const TONES = ['2563EB', '7C3AED', '16A34A', 'D97706', 'DB2777', '0891B2']
const splitChapters = v => String(v || '').split(';').map(s => s.trim()).filter(Boolean)
const safeName = s => String(s).replace(/[^\w.-]+/g, '-')

async function lib() { return import('docx') }

// Letterhead + footer shared by every report.
function frame(d, institute, label, width = 10300) {
  const { Paragraph, TextRun, AlignmentType, BorderStyle, Footer, PageNumber, TabStopType } = d
  const name = institute?.name || 'Guidance Navodaya & Sainik Institute'
  const info = [institute?.tagline, institute?.address, institute?.phone && 'Phone: ' + institute.phone, institute?.email && 'Email: ' + institute.email].filter(Boolean).join('  ·  ')
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  // Compact office / government style: name in capitals, one info line, a thick-over-thin rule, Ref. No. and Date on one line.
  const head = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: name.toUpperCase(), bold: true, size: 28, color: NAVY, font: 'Georgia', characterSpacing: 10 })] }),
    ...(info ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: info, size: 16, color: '333333' })] })] : []),
    new Paragraph({ spacing: { before: 20, after: 20 }, border: { top: { style: BorderStyle.THICK, size: 14, color: NAVY, space: 1 }, bottom: { style: BorderStyle.SINGLE, size: 4, color: NAVY, space: 1 } }, children: [] }),
    new Paragraph({ spacing: { after: 80 }, tabStops: [{ type: TabStopType.RIGHT, position: width }], children: [new TextRun({ text: 'Ref. No.: ____________________', size: 17, bold: true }), new TextRun({ text: `\tDate: ${today}`, size: 17, bold: true })] }),
  ]
  const footer = new Footer({ children: [new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: width }], border: { top: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 4 } },
    children: [new TextRun({ text: `${name} · ${label}`, size: 16, color: NAVY, bold: true }), new TextRun({ text: '\tPage ', size: 16, color: MUT }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: MUT }), new TextRun({ text: '   ·   Design by Moirangthem Himan Singh', size: 16, italics: true, color: GOLD })],
  })] })
  return { head, footer }
}

const titleBar = (d, text) => new d.Paragraph({
  alignment: d.AlignmentType.CENTER, spacing: { before: 60, after: 60 },
  border: { top: { style: d.BorderStyle.SINGLE, size: 10, color: NAVY, space: 4 }, bottom: { style: d.BorderStyle.SINGLE, size: 10, color: NAVY, space: 4 } },
  children: [new d.TextRun({ text: text.toUpperCase(), bold: true, size: 22, color: NAVY, characterSpacing: 40 })],
})
const subLine = (d, text) => new d.Paragraph({ alignment: d.AlignmentType.CENTER, spacing: { after: 140 }, children: [new d.TextRun({ text, size: 19, color: MUT })] })

const cell = (d, children, { fill, width, color, header, span } = {}) => new d.TableCell({
  width: width ? { size: width, type: d.WidthType.DXA } : undefined, columnSpan: span, margins: { top: 50, bottom: 50, left: 90, right: 90 },
  shading: fill ? { type: d.ShadingType.CLEAR, fill, color: 'auto' } : undefined,
  borders: { top: { style: d.BorderStyle.SINGLE, size: 4, color: LINE }, bottom: header && color ? { style: d.BorderStyle.SINGLE, size: 12, color } : { style: d.BorderStyle.SINGLE, size: 4, color: LINE }, left: { style: d.BorderStyle.SINGLE, size: 4, color: LINE }, right: { style: d.BorderStyle.SINGLE, size: 4, color: LINE } },
  children,
})
const para = (d, text, o = {}) => new d.Paragraph({ spacing: { after: o.after ?? 0 }, children: [new d.TextRun({ text: String(text), size: o.size ?? 17, bold: o.bold, color: o.color, italics: o.italics })] })

async function pack(d, { children, institute, label, landscape }) {
  const { head, footer } = frame(d, institute, label, landscape ? 14200 : 10300)
  const doc = new d.Document({
    creator: 'GNSI ERP', title: label,
    sections: [{ properties: { page: { size: { orientation: landscape ? d.PageOrientation.LANDSCAPE : d.PageOrientation.PORTRAIT }, margin: { top: 800, bottom: 800, left: 800, right: 800, footer: 300 } } }, footers: { default: footer }, children: [...head, ...children] }],
  })
  return d.Packer.toBlob(doc)
}

// ── Syllabus plan: one row per test, one column per subject (landscape A4) ──────────────────────────────────────────
export async function buildPlanDocx({ tests, subjects, syl, institute, fmtDate = x => x, year = 2027 }) {
  const d = await lib()
  const val = (t, x) => syl[t.no + '|' + x.label] || ''
  const total = tests.length * subjects.length
  const filled = tests.reduce((n, t) => n + subjects.filter(x => val(t, x)).length, 0)
  const W = 15840 - 1600, first = 1300, w = Math.floor((W - first) / subjects.length)
  const header = new d.TableRow({ tableHeader: true, children: [cell(d, [para(d, 'TEST', { bold: true, color: 'FFFFFF', size: 16 })], { fill: NAVY, width: first }),
    ...subjects.map((x, i) => cell(d, [para(d, x.label.toUpperCase(), { bold: true, color: 'FFFFFF', size: 16 })], { fill: NAVY, width: w, header: true, color: TONES[i % TONES.length] }))] })
  const rows = tests.map(t => new d.TableRow({ cantSplit: true, children: [
    cell(d, [para(d, t.id, { bold: true, color: NAVY, size: 17 }), para(d, fmtDate(t.date), { size: 14, color: MUT })], { fill: SOFT, width: first }),
    ...subjects.map(x => { const cs = splitChapters(val(t, x)); return cell(d, cs.length ? cs.map(c => para(d, '• ' + c, { size: 16 })) : [para(d, '—', { color: RED, size: 16 })], { width: w }) }),
  ] }))
  const children = [
    titleBar(d, `Mission Sainik ${year} · Syllabus Plan`),
    subLine(d, `Chapter for each section of each Pre Mock Test · ${filled} of ${total} chapters planned (${total ? Math.round((filled / total) * 100) : 0}%)`),
    new d.Table({ width: { size: W, type: d.WidthType.DXA }, columnWidths: [first, ...subjects.map(() => w)], rows: [header, ...rows] }),
    new d.Paragraph({ spacing: { before: 500 }, tabStops: [{ type: d.TabStopType.CENTER, position: 7000 }, { type: d.TabStopType.RIGHT, position: 14000 }], children: [new d.TextRun({ text: 'Prepared by\tAcademic Head\tPrincipal', size: 17, color: MUT })] }),
  ]
  return pack(d, { children, institute, label: 'Mission Sainik syllabus plan', landscape: true })
}

// ── Official AISSEE syllabus for one class (portrait A4) ──────────────────────────────────────────────────────────
export async function buildOfficialDocx({ cls, pattern, subjects, institute }) {
  const d = await lib()
  const qs = pattern.sections.reduce((n, x) => n + x.questions, 0), marks = pattern.sections.reduce((n, x) => n + x.questions * x.marksEach, 0)
  const W = 11906 - 1600, c4 = Math.floor(W / 4)
  const kpiCell = (v, l) => cell(d, [new d.Paragraph({ alignment: d.AlignmentType.CENTER, children: [new d.TextRun({ text: String(v), bold: true, size: 30, color: NAVY })] }), new d.Paragraph({ alignment: d.AlignmentType.CENTER, children: [new d.TextRun({ text: l.toUpperCase(), size: 14, color: MUT, bold: true })] })], { fill: SOFT, width: c4 })
  const kpis = new d.Table({ width: { size: W, type: d.WidthType.DXA }, columnWidths: [c4, c4, c4, c4], rows: [new d.TableRow({ children: [kpiCell(qs, 'Questions'), kpiCell(marks, 'Marks'), kpiCell(pattern.durationMin + ' min', 'Duration'), kpiCell(pattern.negative ? 'Yes' : 'None', 'Negative marking')] })] })
  const secW = [Math.floor(W * 0.4), Math.floor(W * 0.2), Math.floor(W * 0.2), Math.floor(W * 0.2)]
  const patt = new d.Table({ width: { size: W, type: d.WidthType.DXA }, columnWidths: secW, rows: [
    new d.TableRow({ tableHeader: true, children: ['Section', 'Questions', 'Marks each', 'Total'].map((h, i) => cell(d, [para(d, h.toUpperCase(), { bold: true, color: 'FFFFFF', size: 16 })], { fill: NAVY, width: secW[i] })) }),
    ...pattern.sections.map(s => new d.TableRow({ children: [s.subject, s.questions, s.marksEach, s.questions * s.marksEach].map((v, i) => cell(d, [para(d, v, { size: 18, bold: i === 0 })], { width: secW[i] })) })),
  ] })
  const sec = n => pattern.sections.find(x => x.subject === n)
  const blocks = subjects.flatMap(([name, chs], si) => {
    const s = sec(name)
    const h = new d.Paragraph({ keepNext: true, spacing: { before: 240, after: 60 }, border: { bottom: { style: d.BorderStyle.SINGLE, size: 8, color: NAVY, space: 2 } },
      children: [new d.TextRun({ text: name.toUpperCase(), bold: true, size: 21, color: NAVY }), ...(s ? [new d.TextRun({ text: `   ${s.questions} questions · ${s.questions * s.marksEach} marks`, size: 17, color: MUT })] : [])] })
    return [h, ...chs.map((c, i) => new d.Paragraph({ spacing: { after: 20 }, indent: { left: 360, hanging: 360 }, children: [new d.TextRun({ text: `${i + 1}.\t`, size: 19, color: TONES[si % TONES.length], bold: true }), new d.TextRun({ text: c, size: 19 })] }))]
  })
  const children = [
    titleBar(d, `AISSEE 2027 · Class ${cls} Syllabus`), subLine(d, 'Sainik School entrance exam · exam 31 Jan 2027'),
    kpis, new d.Paragraph({ spacing: { after: 100 }, children: [] }), patt,
    ...blocks,
    new d.Paragraph({ spacing: { before: 240 }, children: [new d.TextRun({ text: `Source: NTA Information Bulletin AISSEE-2027, Appendix ${cls === 6 ? 'II' : 'III'}.`, size: 16, color: MUT, italics: true })] }),
  ]
  return pack(d, { children, institute, label: `AISSEE 2027 · Class ${cls} syllabus`, landscape: false })
}

// Generic table report: a title, a sub line, a header row and body rows (strings / numbers). Used by the Foundation results and merit lists.
//   columns: [{ h: 'Rank', w: 1 (relative width), left: false }]   rows: [[...cells]]   foot: optional rows shown shaded under the table
export async function buildTableDocx({ title, sub = '', columns, rows, foot = [], institute, label, landscape = true, signatures = ['Class teacher', 'Exam in-charge', 'Principal'] }) {
  const d = await lib()
  const W = (landscape ? 15840 : 11906) - 1600, sum = columns.reduce((n, c) => n + (c.w || 1), 0)
  const widths = columns.map(c => Math.floor((W * (c.w || 1)) / sum))
  const mk = (r, o = {}) => new d.TableRow({ cantSplit: true, children: r.map((v, i) => new d.TableCell({
    width: { size: widths[i], type: d.WidthType.DXA }, margins: { top: 40, bottom: 40, left: 70, right: 70 },
    shading: o.fill ? { type: d.ShadingType.CLEAR, fill: o.fill, color: 'auto' } : undefined,
    borders: ['top', 'bottom', 'left', 'right'].reduce((b, k) => ({ ...b, [k]: { style: d.BorderStyle.SINGLE, size: 4, color: LINE } }), {}),
    children: [new d.Paragraph({ alignment: columns[i].left ? d.AlignmentType.LEFT : d.AlignmentType.CENTER, children: [new d.TextRun({ text: String(v ?? '—'), size: o.size || 17, bold: o.bold, color: o.color })] })],
  })) })
  const table = new d.Table({ width: { size: W, type: d.WidthType.DXA }, columnWidths: widths, rows: [
    new d.TableRow({ tableHeader: true, children: columns.map((c, i) => new d.TableCell({ width: { size: widths[i], type: d.WidthType.DXA }, margins: { top: 50, bottom: 50, left: 70, right: 70 }, shading: { type: d.ShadingType.CLEAR, fill: NAVY, color: 'auto' }, children: [new d.Paragraph({ alignment: c.left ? d.AlignmentType.LEFT : d.AlignmentType.CENTER, children: [new d.TextRun({ text: String(c.h), bold: true, size: 16, color: 'FFFFFF' })] })] })) }),
    ...rows.map((r, i) => mk(r, { fill: i % 2 ? 'F7F9FC' : undefined })),
    ...foot.map(r => mk(r, { fill: SOFT, bold: true })),
  ] })
  const sig = signatures.length ? [new d.Paragraph({ spacing: { before: 500 }, tabStops: signatures.length === 3 ? [{ type: d.TabStopType.CENTER, position: Math.floor(W / 2) }, { type: d.TabStopType.RIGHT, position: W }] : [], children: [new d.TextRun({ text: signatures.join('\t'), size: 17, color: MUT })] })] : []
  return pack(d, { children: [titleBar(d, title), ...(sub ? [subLine(d, sub)] : []), table, ...sig], institute, label: label || title, landscape })
}

export function downloadDocx(name, blob) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a')
  a.href = url; a.download = safeName(name).replace(/(\.docx)?$/, '.docx'); a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000)
}
