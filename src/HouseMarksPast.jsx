import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from './supabase'
import { GRADES, gradeColor, medal, buildCalc } from './houseMarksCalc'

// Past results & analysis: every shared test, visible to all staff (read-only).
const NAVY = '#0B1E3D', GOLD = '#C9A24B', LINE = '#e2e8f0'
const card = { background: '#fff', border: '1px solid #e3e9f1', borderRadius: 18, padding: 20, marginBottom: 16, boxShadow: '0 1px 2px rgba(11,30,61,.04), 0 14px 30px -22px rgba(11,30,61,.28)', fontFamily: "'Plus Jakarta Sans',system-ui,-apple-system,'Segoe UI',sans-serif", color: NAVY }
const inp = { padding: '9px 12px', border: '1.5px solid #d3dbe7', borderRadius: 11, fontSize: 14, boxSizing: 'border-box', minHeight: 42, background: '#fff', color: NAVY, fontFamily: 'inherit', minWidth: 0 }
const btn = primary => ({ padding: '9px 16px', borderRadius: 11, border: `1.5px solid ${primary ? NAVY : '#d3dbe7'}`, background: primary ? `linear-gradient(180deg,#16335f,${NAVY})` : '#fff', color: primary ? '#fff' : NAVY, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', minHeight: 42, fontFamily: 'inherit' })
const h = { fontSize: 11.5, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: '#64748b', margin: '0 0 12px' }
const fmtDate = d => { const x = new Date(d + 'T00:00:00'); return isNaN(x) ? d : x.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }
const pctTxt = v => v == null ? '–' : v.toFixed(1) + '%'

function analyze(r, schoolById, group = '') {
  const subs = Array.isArray(r.subjects) ? r.subjects : []
  const mx = subs.reduce((a, x) => a + Number(x.max || 0), 0)
  const entries = Object.entries(r.marks || {}).filter(([, e]) => !group || (e.group || '') === group)
  const cc = buildCalc(entries.map(([id, e]) => ({ id, m: e.m || [] })), subs, mx)
  const rows = entries.map(([id, e]) => {
    const st = schoolById[id] || {}
    return { id, name: st.name || e.name || 'Student', gcc: st.gcc_no || e.gcc || '', cls: st.class_name || '', house: st.house || '', teacher: e.byName || e.by || r.created_by || 'Not recorded', group: e.group || '', m: e.m || [], c: cc[id] }
  })
  const ranked = rows.filter(x => x.c && x.c.rank).sort((a, b) => a.c.rank - b.c.rank || a.name.localeCompare(b.name))
  const rest = rows.filter(x => !(x.c && x.c.rank)).sort((a, b) => a.name.localeCompare(b.name))
  const by = key => {
    const m = new Map(); rows.forEach(x => { const k = key(x); if (k) { if (!m.has(k)) m.set(k, []); m.get(k).push(x) } })
    return [...m].map(([name, list]) => {
      const rk = list.filter(x => x.c && x.c.rank).sort((a, b) => a.c.rank - b.c.rank)
      return { name, count: list.length, ranked: rk.length, avg: rk.length ? rk.reduce((a, x) => a + x.c.pct, 0) / rk.length : null, pass: rk.length ? rk.filter(x => x.c.pass).length / rk.length * 100 : null, top: rk[0] || null }
    }).sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1))
  }
  const subjects = subs.map((sub, i) => {
    const vals = rows.map(x => ({ x, v: x.m[i] })).filter(o => typeof o.v === 'number' && o.v <= Number(sub.max))
    if (!vals.length) return { n: sub.n, max: sub.max, count: 0 }
    const hi = Math.max(...vals.map(o => o.v)), lo = Math.min(...vals.map(o => o.v)), minV = sub.min === '' || sub.min == null ? null : Number(sub.min)
    return { n: sub.n, max: sub.max, count: vals.length, avg: vals.reduce((a, o) => a + o.v, 0) / vals.length, hi, lo, hiNames: vals.filter(o => o.v === hi).map(o => o.x.name), pass: minV == null ? null : vals.filter(o => o.v >= minV).length / vals.length * 100 }
  })
  const gradeCount = {}; ranked.forEach(x => { gradeCount[x.c.grade] = (gradeCount[x.c.grade] || 0) + 1 })
  return {
    subs, mx, rows, ranked, rest, subjects, gradeCount,
    teachers: by(x => x.teacher), groups: by(x => x.group), classes: by(x => x.cls),
    avg: ranked.length ? ranked.reduce((a, x) => a + x.c.pct, 0) / ranked.length : null,
    pass: ranked.length ? ranked.filter(x => x.c.pass).length / ranked.length * 100 : null,
    top: ranked[0] || null,
  }
}

export default function HouseMarksPast({ school = [], currentUser, onOpenTest }) {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [teacher, setTeacher] = useState('')
  const [group, setGroup] = useState('')
  const [selId, setSelId] = useState('')
  const [tab, setTab] = useState('ranking')
  const [rankQ, setRankQ] = useState('')
  const [stuQ, setStuQ] = useState('')
  const [stuId, setStuId] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const load = async () => {
    setRows(null); setErr('')
    const { data, error } = await supabase.from('house_test_marks').select('id,test_name,test_date,house,subjects,marks,created_by,updated_at').order('test_date', { ascending: false }).limit(300)
    if (error) { setErr(/house_test_marks/i.test(error.message || '') ? 'Tests are not set up yet: run supabase/RUN_house_test_marks.sql once in Supabase.' : 'Could not load: ' + error.message); setRows([]); return }
    setRows(data || [])
  }
  useEffect(() => { load() }, [])

  const schoolById = useMemo(() => { const m = {}; school.forEach(s => { m[s.id] = s }); return m }, [school])
  const tests = useMemo(() => (rows || []).map(r => ({ ...r, an: analyze(r, schoolById, group) })).filter(t => !group || t.an.rows.length), [rows, schoolById, group])
  // every group any teacher has used, across all tests (not affected by the group filter)
  const allGroups = useMemo(() => {
    const m = new Map()
    ;(rows || []).forEach(r => Object.values(r.marks || {}).forEach(e => {
      const g = (e.group || '').trim(); if (!g) return
      if (!m.has(g)) m.set(g, { name: g, tests: new Map(), teachers: new Set(), students: new Set() })
      const o = m.get(g); o.tests.set(r.id, r.test_date); o.teachers.add(e.byName || e.by || r.created_by || 'Not recorded'); o.students.add(e.name || e.gcc || '')
    }))
    return [...m.values()].map(o => ({ name: o.name, tests: o.tests.size, teachers: [...o.teachers], students: o.students.size, last: [...o.tests.values()].sort().pop() })).sort((a, b) => (b.last || '').localeCompare(a.last || '') || a.name.localeCompare(b.name))
  }, [rows])
  const teacherNames = useMemo(() => [...new Set(tests.flatMap(t => t.an.teachers.map(x => x.name)))].sort(), [tests])
  const shown = useMemo(() => tests.filter(t =>
    (!q.trim() || t.test_name.toLowerCase().includes(q.trim().toLowerCase())) &&
    (!from || t.test_date >= from) && (!to || t.test_date <= to) &&
    (!teacher || t.an.teachers.some(x => x.name === teacher))), [tests, q, from, to, teacher])
  const sel = tests.find(t => t.id === selId) || null

  // trend: average % of every shown test, oldest to newest
  const trend = useMemo(() => [...shown].filter(t => t.an.avg != null).sort((a, b) => a.test_date.localeCompare(b.test_date)).slice(-16), [shown])

  // student history across all loaded tests
  const stuHits = useMemo(() => {
    const k = stuQ.trim().toLowerCase()
    if (!k) return []
    const seen = new Map()
    tests.forEach(t => t.an.rows.forEach(x => { if (!seen.has(x.id) && (x.name.toLowerCase().includes(k) || String(x.gcc).toLowerCase().includes(k))) seen.set(x.id, x) }))
    return [...seen.values()].slice(0, 8)
  }, [stuQ, tests])
  const stuHist = useMemo(() => !stuId ? [] : tests.map(t => { const x = t.an.rows.find(r => r.id === stuId); return x && x.c && x.c.n ? { t, x } : null }).filter(Boolean).sort((a, b) => a.t.test_date.localeCompare(b.t.test_date)), [stuId, tests])

  const download = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000) }
  const fname = t => (t.test_name || 'test').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
  const exportXlsx = t => {
    const a = t.an, head = ['Rank', 'GCC No', 'Name', 'Class', 'Teacher', 'Group', ...a.subs.map(x => x.n), 'Total', 'Percent', 'Grade']
    const body = [...a.ranked, ...a.rest].map(x => [x.c && x.c.rank || '', x.gcc, x.name, x.cls, x.teacher, x.group, ...a.subs.map((_, i) => x.m[i] ?? ''), x.c && x.c.n ? x.c.tot : '', x.c && x.c.n ? Number(x.c.pct.toFixed(1)) : '', x.c && x.c.rank ? x.c.grade : ''])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Test', t.test_name], ['Date', t.test_date], ['Maximum total', a.mx], [], head, ...body]), 'Results')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Teacher', 'Students', 'Average %', 'Pass %', 'Topper'], ...a.teachers.map(x => [x.name, x.count, x.avg == null ? '' : Number(x.avg.toFixed(1)), x.pass == null ? '' : Math.round(x.pass), x.top ? `${x.top.name} (${x.top.c.tot})` : ''])]), 'Teachers')
    XLSX.writeFile(wb, fname(t) + '.xlsx')
  }
  const exportPdf = async (t, share) => {
    const a = t.an
    if (!a.rows.length) { setMsg('Nothing in this test.'); return }
    setBusy(true)
    try {
      const [{ default: jsPDF }, { default: autoTable }, { pdfLetterhead, pdfFooters }] = await Promise.all([import('jspdf'), import('jspdf-autotable'), import('./reportKit')])
      const doc = new jsPDF({ orientation: a.subs.length > 3 ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' }), mx = 12
      let y = pdfLetterhead(doc, { title: 'Test Result – ' + t.test_name, margin: mx, date: fmtDate(t.test_date) })
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(71, 85, 105)
      doc.text([`Students: ${a.rows.length}`, `Teachers: ${a.teachers.length}`, `Maximum: ${a.mx}`, a.avg == null ? null : `Average: ${a.avg.toFixed(1)}%`, a.pass == null ? null : `Pass: ${Math.round(a.pass)}%`].filter(Boolean).join('   ·   '), mx, y); y += 4
      autoTable(doc, {
        startY: y, head: [['Rank', 'Student', 'GCC', 'Class', 'Teacher', ...a.subs.map(x => `${x.n}\n/${x.max}`), 'Total\n/' + a.mx, '%', 'Grade']],
        body: [...a.ranked, ...a.rest].map(x => [x.c && x.c.rank || '–', x.name, x.gcc, x.cls, x.teacher, ...a.subs.map((_, i) => x.m[i] ?? '–'), x.c && x.c.absent ? 'AB' : x.c && x.c.n ? x.c.tot : '–', x.c && x.c.n ? x.c.pct.toFixed(1) + '%' : '–', x.c && x.c.rank ? x.c.grade : (x.c && x.c.partial ? 'Incomplete' : '')]),
        margin: { left: mx, right: mx, bottom: 16 }, styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.8, textColor: [15, 27, 46], lineColor: [226, 232, 240], lineWidth: 0.1 },
        headStyles: { fillColor: [11, 30, 61], textColor: 255, halign: 'center', fontStyle: 'bold' }, alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 0: { halign: 'center', fontStyle: 'bold', cellWidth: 11 }, 1: { fontStyle: 'bold' } },
        didParseCell: d => { if (d.section === 'body' && d.column.index === 0 && Number(d.cell.raw) >= 1 && Number(d.cell.raw) <= 3) d.cell.styles.fillColor = [[226, 197, 126], [226, 232, 240], [231, 200, 160]][Number(d.cell.raw) - 1] },
      })
      autoTable(doc, {
        startY: (doc.lastAutoTable?.finalY || y) + 8, head: [['Teacher', 'Students', 'Average %', 'Pass %', 'Topper']],
        body: a.teachers.map(x => [x.name, `${x.ranked}/${x.count}`, x.avg == null ? '–' : x.avg.toFixed(1), x.pass == null ? '–' : Math.round(x.pass), x.top ? `${x.top.name} (${x.top.c.tot}/${a.mx})` : '–']),
        margin: { left: mx, right: mx, bottom: 16 }, styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2, textColor: [15, 27, 46], lineColor: [226, 232, 240], lineWidth: 0.1 },
        headStyles: { fillColor: [201, 162, 75], textColor: [11, 30, 61], fontStyle: 'bold' },
      })
      pdfFooters(doc, { margin: mx })
      const blob = doc.output('blob'), file = new File([blob], fname(t) + '.pdf', { type: 'application/pdf' })
      if (share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: t.test_name, text: t.test_name + ' – result' }) } catch (e) { if (e?.name !== 'AbortError') download(blob, file.name) }
      } else download(blob, file.name)
    } catch (e) { setMsg('Could not make the PDF: ' + (e?.message || e)) }
    setBusy(false)
  }

  const Tile = ({ l, v, sub }) => (
    <div style={{ flex: '1 1 120px', border: `1px solid ${LINE}`, borderRadius: 14, padding: '9px 12px', background: '#fff' }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.08em', color: '#64748b', textTransform: 'uppercase' }}>{l}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: NAVY, lineHeight: 1.2 }}>{v}</div>
      {sub ? <div style={{ fontSize: 11.5, color: '#64748b' }}>{sub}</div> : null}
    </div>
  )
  const groupCards = list => !list.length ? <div style={{ fontSize: 13, color: '#64748b' }}>Nothing recorded for this view.</div> : (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 10 }}>
      {list.map(g => (
        <div key={g.name} style={{ border: `1px solid ${LINE}`, borderRadius: 14, padding: '10px 12px', background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><b style={{ color: NAVY }}>{g.name}</b><span style={{ fontSize: 12, color: '#64748b' }}>{g.ranked}/{g.count} ranked</span></div>
          {g.top && <div style={{ marginTop: 6, background: '#fffaf0', border: `1.5px solid ${GOLD}`, borderRadius: 10, padding: '6px 10px', fontSize: 13.5 }}>🥇 <b>{g.top.name}</b> · {g.top.c.tot}/{sel.an.mx}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <span style={{ flex: 1, background: '#f1f5f9', borderRadius: 10, padding: '5px 8px', fontSize: 12 }}>Avg <b style={{ fontSize: 14 }}>{pctTxt(g.avg)}</b></span>
            <span style={{ flex: 1, background: '#f1f5f9', borderRadius: 10, padding: '5px 8px', fontSize: 12 }}>Pass <b style={{ fontSize: 14 }}>{g.pass == null ? '–' : Math.round(g.pass) + '%'}</b></span>
          </div>
        </div>
      ))}
    </div>
  )

  // small bar chart of test averages
  const chart = () => {
    const W = 640, H = 150, pad = 26, bw = Math.min(40, (W - pad * 2) / Math.max(trend.length, 1) - 8)
    return (
      <svg viewBox={`0 0 ${W} ${H + 34}`} style={{ width: '100%', maxHeight: 220 }} role="img" aria-label="Average percent per test">
        {[0, 50, 100].map(v => <g key={v}><line x1={pad} x2={W - 6} y1={H - v * H / 100 + 6} y2={H - v * H / 100 + 6} stroke="#e2e8f0" /><text x={2} y={H - v * H / 100 + 10} fontSize="10" fill="#94a3b8">{v}</text></g>)}
        {trend.map((t, i) => {
          const x = pad + 8 + i * ((W - pad * 2) / trend.length), hh = Math.max(2, t.an.avg * H / 100)
          return (
            <g key={t.id} style={{ cursor: 'pointer' }} onClick={() => { setSelId(t.id); setTab('ranking') }}>
              <title>{`${t.test_name}: ${t.an.avg.toFixed(1)}%`}</title>
              <rect x={x} y={H - hh + 6} width={bw} height={hh} rx="5" fill={t.id === selId ? GOLD : NAVY} />
              <text x={x + bw / 2} y={H - hh} fontSize="10" textAnchor="middle" fill={NAVY} fontWeight="700">{t.an.avg.toFixed(0)}</text>
              <text x={x + bw / 2} y={H + 22} fontSize="9" textAnchor="middle" fill="#64748b">{t.test_date.slice(5)}</text>
            </g>
          )
        })}
      </svg>
    )
  }

  return (
    <div>
      <div style={{ ...card, background: `linear-gradient(135deg,${NAVY},#17325f)`, color: '#fff', borderColor: NAVY }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', color: GOLD }}>📚 PAST RESULTS</div>
        <div style={{ fontFamily: "'Fraunces',Georgia,serif", fontSize: 26, fontWeight: 700, marginTop: 2 }}>Every test, every teacher</div>
        <div style={{ fontSize: 13.5, opacity: .85, marginTop: 2 }}>{rows == null ? 'Loading…' : `${tests.length} saved test${tests.length === 1 ? '' : 's'} · open one to see rankings and analysis`}</div>
      </div>

      {err && <div style={{ ...card, borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c', fontSize: 14 }}>{err}</div>}
      {msg && <div role="status" style={{ ...card, padding: '10px 14px', fontSize: 13.5, color: '#047857', background: '#ecfdf5', borderColor: '#a7f3d0' }} onClick={() => setMsg('')}>{msg}</div>}

      <div style={card}>
        <p style={h}>👥 All groups ({allGroups.length}) · made by every housemaster</p>
        {!allGroups.length ? <div style={{ fontSize: 13, color: '#64748b' }}>No groups yet. A group name is saved with every test.</div> : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setGroup('')} aria-pressed={!group} style={{ ...btn(!group), minHeight: 40 }}>All groups</button>
            {allGroups.map(g => (
              <button key={g.name} type="button" onClick={() => { setGroup(group === g.name ? '' : g.name); setSelId('') }} aria-pressed={group === g.name} title={g.teachers.join(', ')}
                style={{ textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', border: `1.5px solid ${group === g.name ? NAVY : '#e3e9f1'}`, background: group === g.name ? NAVY : '#fff', color: group === g.name ? '#fff' : NAVY, borderRadius: 14, padding: '8px 12px', minWidth: 150 }}>
                <span style={{ display: 'block', fontWeight: 800, fontSize: 14 }}>{g.name}</span>
                <span style={{ display: 'block', fontSize: 11.5, opacity: .8 }}>{g.tests} test{g.tests === 1 ? '' : 's'} · {g.students} student{g.students === 1 ? '' : 's'}</span>
                <span style={{ display: 'block', fontSize: 11.5, opacity: .8 }}>{g.teachers.slice(0, 2).join(', ')}{g.teachers.length > 2 ? ` +${g.teachers.length - 2}` : ''}</span>
              </button>
            ))}
          </div>
        )}
        {group && <div style={{ fontSize: 12.5, color: '#92400e', marginTop: 10 }}>Showing only the students of group “{group}” in every test below: averages, rankings and the chart are for this group.</div>}
      </div>

      <div style={card}>
        <p style={h}>🔎 Find a test</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input style={{ ...inp, flex: '2 1 200px' }} placeholder="Search test name" value={q} onChange={e => setQ(e.target.value)} />
          <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, fontWeight: 700, color: '#64748b', flex: '1 1 140px' }}>FROM<input type="date" style={inp} value={from} onChange={e => setFrom(e.target.value)} /></label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, fontWeight: 700, color: '#64748b', flex: '1 1 140px' }}>TO<input type="date" style={inp} value={to} onChange={e => setTo(e.target.value)} /></label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, fontWeight: 700, color: '#64748b', flex: '1 1 160px' }}>TEACHER
            <select style={inp} value={teacher} onChange={e => setTeacher(e.target.value)}><option value="">All teachers</option>{teacherNames.map(n => <option key={n} value={n}>{n}</option>)}</select>
          </label>
          <button type="button" style={{ ...btn(false), alignSelf: 'flex-end' }} onClick={() => { setQ(''); setFrom(''); setTo(''); setTeacher(''); setGroup('') }}>Clear</button>
          <button type="button" style={{ ...btn(false), alignSelf: 'flex-end' }} onClick={load}>↻ Refresh</button>
        </div>
      </div>

      {trend.length > 1 && (
        <div style={card}>
          <p style={h}>📈 Average % per test</p>
          {chart()}
          <div style={{ fontSize: 12, color: '#64748b' }}>Tap a bar to open that test.</div>
        </div>
      )}

      <div style={card}>
        <p style={h}>🗂 Tests ({shown.length})</p>
        {rows == null ? <div style={{ color: '#64748b' }}>Loading…</div> : !shown.length ? <div style={{ color: '#64748b', fontSize: 13, padding: 14, border: '1.5px dashed #d3dbe7', borderRadius: 14, textAlign: 'center', lineHeight: 1.6 }}>{err ? 'Could not load tests — see the red message above.' : !(rows || []).length ? <>No test has been saved yet.<br />Go to <b>✏️ Enter marks</b>, fill the marks and press <b>Save</b> — it will appear here for all staff.<br /><button type="button" style={{ ...btn(false), marginTop: 8 }} onClick={load}>↻ Check again</button></> : 'No tests match these filters. Press Clear.'}</div> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))', gap: 10 }}>
            {shown.map(t => {
              const cur = t.id === selId, a = t.an
              return (
                <button key={t.id} type="button" onClick={() => { setSelId(cur ? '' : t.id); setTab('ranking'); setRankQ('') }} style={{ textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', gap: 12, alignItems: 'center', border: `1.5px solid ${cur ? GOLD : '#e3e9f1'}`, background: cur ? '#fffaf0' : '#fff', borderRadius: 14, padding: '10px 12px' }}>
                  <span aria-hidden="true" style={{ width: 48, flex: 'none', textAlign: 'center', borderRadius: 11, background: NAVY, color: '#fff', padding: '5px 0', lineHeight: 1.05 }}>
                    <span style={{ display: 'block', fontSize: 17, fontWeight: 800 }}>{t.test_date.slice(8, 10)}</span>
                    <span style={{ display: 'block', fontSize: 9.5, fontWeight: 800, letterSpacing: '.08em', color: '#E2C57E', textTransform: 'uppercase' }}>{new Date(t.test_date + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short' })}</span>
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'block', fontWeight: 700, color: NAVY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.test_name}</span>
                    <span style={{ display: 'block', fontSize: 12, color: '#64748b' }}>{a.rows.length} students · {a.teachers.length} teacher{a.teachers.length === 1 ? '' : 's'} · avg {pctTxt(a.avg)}</span>
                    {a.top && <span style={{ display: 'block', fontSize: 12, color: '#92400e' }}>🥇 {a.top.name} · {a.top.c.tot}/{a.mx}</span>}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {sel && (
        <div style={{ ...card, border: `2px solid ${GOLD}` }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ flex: '1 1 240px' }}>
              <div style={{ fontFamily: "'Fraunces',Georgia,serif", fontSize: 22, fontWeight: 700 }}>{sel.test_name}</div>
              <div style={{ fontSize: 13, color: '#64748b' }}>{fmtDate(sel.test_date)} · out of {sel.an.mx} · {sel.an.subs.map(x => `${x.n} ${x.max}`).join(' + ')}</div>
            </div>
            {onOpenTest && <button type="button" style={{ ...btn(false), borderColor: GOLD }} onClick={() => onOpenTest(rows.find(r => r.id === sel.id))}>✏️ Open to enter marks</button>}
            <button type="button" style={btn(true)} onClick={() => exportPdf(sel, true)} disabled={busy}>📤 Share PDF</button>
            <button type="button" style={btn(false)} onClick={() => exportPdf(sel, false)} disabled={busy}>📄 PDF</button>
            <button type="button" style={btn(false)} onClick={() => exportXlsx(sel)}>⬇ Excel</button>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <Tile l="Students" v={sel.an.rows.length} sub={`${sel.an.ranked.length} ranked`} />
            <Tile l="Teachers" v={sel.an.teachers.length} />
            <Tile l="Average" v={pctTxt(sel.an.avg)} />
            <Tile l="Pass" v={sel.an.pass == null ? '–' : Math.round(sel.an.pass) + '%'} />
            <Tile l="Topper" v={sel.an.top ? sel.an.top.c.tot + '/' + sel.an.mx : '–'} sub={sel.an.top ? sel.an.top.name : ''} />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {GRADES.map(([, g]) => <span key={g} style={{ borderRadius: 10, padding: '4px 10px', background: '#f1f5f9', fontWeight: 800, fontSize: 13, color: gradeColor(g) }}>{g} · {sel.an.gradeCount[g] || 0}</span>)}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {[['ranking', 'Ranking'], ['teachers', `Teachers (${sel.an.teachers.length})`], ['groups', `Groups (${sel.an.groups.length})`], ['classes', `Classes (${sel.an.classes.length})`], ['subjects', 'Subjects']].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setTab(k)} aria-pressed={tab === k} style={{ ...btn(tab === k), minHeight: 38, padding: '6px 14px' }}>{l}</button>
            ))}
          </div>
          {tab === 'ranking' && (
            <>
              <input style={{ ...inp, width: '100%', maxWidth: 320, marginBottom: 10 }} placeholder="Search a student in this test" value={rankQ} onChange={e => setRankQ(e.target.value)} />
              <div style={{ border: `1px solid ${LINE}`, borderRadius: 14, overflow: 'hidden' }}>
                {[...sel.an.ranked, ...sel.an.rest].filter(x => !rankQ.trim() || (x.name + ' ' + x.gcc).toLowerCase().includes(rankQ.trim().toLowerCase())).slice(0, 80).map(x => (
                  <div key={x.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderTop: `1px solid ${LINE}`, fontSize: 13.5, background: '#fff', flexWrap: 'wrap' }}>
                    <b style={{ width: 38, color: NAVY }}>{x.c && x.c.rank ? <>{x.c.rank <= 3 ? medal(x.c.rank - 1) : ''}{x.c.rank}</> : '–'}</b>
                    <span style={{ flex: '1 1 180px', minWidth: 0 }}><b style={{ color: NAVY }}>{x.name}</b><span style={{ color: '#94a3b8' }}> · {x.cls}{x.cls ? ' · ' : ''}{x.teacher}</span></span>
                    <span style={{ color: '#64748b', fontSize: 12.5 }}>{x.m.map(v => v ?? '–').join(' · ')}</span>
                    <b style={{ minWidth: 34, textAlign: 'right' }}>{x.c && x.c.absent ? 'AB' : x.c && x.c.n ? x.c.tot : '–'}</b>
                    <span style={{ color: x.c && x.c.rank ? gradeColor(x.c.grade) : '#cbd5e1', fontWeight: 800, width: 26, textAlign: 'right' }}>{x.c && x.c.rank ? x.c.grade : x.c && x.c.partial ? '⏳' : ''}</span>
                  </div>
                ))}
              </div>
              {sel.an.rows.length > 80 && !rankQ.trim() && <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>Showing the first 80. Use the search, or the PDF / Excel for everyone.</div>}
            </>
          )}
          {tab === 'teachers' && groupCards(sel.an.teachers)}
          {tab === 'groups' && groupCards(sel.an.groups)}
          {tab === 'classes' && groupCards(sel.an.classes)}
          {tab === 'subjects' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 10 }}>
              {sel.an.subjects.map((sb, i) => (
                <div key={i} style={{ border: `1px solid ${LINE}`, borderRadius: 14, padding: '10px 12px', background: '#fff' }}>
                  <b style={{ color: NAVY }}>{sb.n} <span style={{ color: '#94a3b8', fontWeight: 600 }}>/ {sb.max}</span></b>
                  {!sb.count ? <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>No marks.</div> : (
                    <div style={{ fontSize: 13, color: '#334155', marginTop: 6, lineHeight: 1.7 }}>
                      <div>🥇 <b>{sb.hi}</b> · {sb.hiNames.slice(0, 3).join(', ')}{sb.hiNames.length > 3 ? ` +${sb.hiNames.length - 3}` : ''}</div>
                      <div>Average <b>{sb.avg.toFixed(1)}</b> ({(sb.avg / (Number(sb.max) || 1) * 100).toFixed(0)}%) · Lowest <b>{sb.lo}</b></div>
                      {sb.pass != null && <div>Passed minimum: <b>{Math.round(sb.pass)}%</b></div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={card}>
        <p style={h}>🧑‍🎓 Student history across all tests</p>
        <input style={{ ...inp, width: '100%', maxWidth: 360 }} placeholder="Type a student name or GCC No" value={stuQ} onChange={e => { setStuQ(e.target.value); setStuId('') }} />
        {stuHits.length > 0 && !stuId && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            {stuHits.map(x => <button key={x.id} type="button" style={{ ...btn(false), minHeight: 34, padding: '4px 12px', fontSize: 13 }} onClick={() => { setStuId(x.id); setStuQ(x.name) }}>{x.name} <span style={{ color: '#94a3b8', fontWeight: 600 }}>{x.gcc}</span></button>)}
          </div>
        )}
        {stuId && (
          stuHist.length === 0 ? <div style={{ fontSize: 13, color: '#64748b', marginTop: 10 }}>No results yet.</div> : (
            <div style={{ marginTop: 12, overflowX: 'auto' }}>
              <table data-rt-skip style={{ borderCollapse: 'collapse', width: '100%', minWidth: 480, fontSize: 13 }}>
                <thead><tr>{['Date', 'Test', 'Total', '%', 'Rank', 'Grade', 'vs avg'].map(c => <th key={c} style={{ textAlign: 'left', padding: '7px 8px', fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: '#64748b', borderBottom: `2px solid ${LINE}` }}>{c}</th>)}</tr></thead>
                <tbody>{[...stuHist].reverse().map(({ t, x }) => {
                  const d = t.an.avg == null ? null : x.c.pct - t.an.avg
                  return (
                    <tr key={t.id}>
                      <td style={{ padding: '7px 8px', borderBottom: `1px solid ${LINE}` }}>{t.test_date}</td>
                      <td style={{ padding: '7px 8px', borderBottom: `1px solid ${LINE}` }}>{t.test_name}</td>
                      <td style={{ padding: '7px 8px', borderBottom: `1px solid ${LINE}`, fontFamily: 'monospace' }}>{x.c.absent ? 'Absent' : `${x.c.tot}/${t.an.mx}`}</td>
                      <td style={{ padding: '7px 8px', borderBottom: `1px solid ${LINE}`, fontFamily: 'monospace', fontWeight: 700 }}>{x.c.pct.toFixed(1)}</td>
                      <td style={{ padding: '7px 8px', borderBottom: `1px solid ${LINE}` }}>{x.c.rank ? `${x.c.rank} / ${t.an.ranked.length}` : '–'}</td>
                      <td style={{ padding: '7px 8px', borderBottom: `1px solid ${LINE}`, fontWeight: 800, color: x.c.rank ? gradeColor(x.c.grade) : '#cbd5e1' }}>{x.c.rank ? x.c.grade : '–'}</td>
                      <td style={{ padding: '7px 8px', borderBottom: `1px solid ${LINE}`, fontFamily: 'monospace', color: d == null ? '#94a3b8' : d >= 0 ? '#047857' : '#b91c1c' }}>{d == null ? '–' : (d >= 0 ? '+' : '') + d.toFixed(1)}</td>
                    </tr>
                  )
                })}</tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  )
}
