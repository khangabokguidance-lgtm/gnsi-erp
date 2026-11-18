import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from './supabase'
import { analyze } from './HouseMarksPast'

// Admin dashboard: every house, every housemaster and every test in one view, with edit / delete.
const NAVY = '#0B1E3D', GOLD = '#C9A24B', LINE = '#e2e8f0'
const card = { background: '#fff', border: '1px solid #e3e9f1', borderRadius: 18, padding: 20, marginBottom: 16, boxShadow: '0 1px 2px rgba(11,30,61,.04), 0 14px 30px -22px rgba(11,30,61,.28)', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", color: NAVY }
const inp = { padding: '9px 12px', border: '1.5px solid #d3dbe7', borderRadius: 11, fontSize: 14, boxSizing: 'border-box', minHeight: 42, background: '#fff', color: NAVY, fontFamily: 'inherit', minWidth: 0 }
const btn = { padding: '9px 16px', borderRadius: 11, border: '1.5px solid #d3dbe7', background: '#fff', color: NAVY, fontWeight: 700, fontSize: 14, cursor: 'pointer', minHeight: 42, fontFamily: 'inherit' }
const h = { fontSize: 11.5, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: '#64748b', margin: '0 0 12px' }
const pct = v => v == null ? '–' : v.toFixed(1) + '%'
const fmtDate = d => { const x = new Date(d + 'T00:00:00'); return isNaN(x) ? d : x.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }
const NOHOUSE = 'No house'

export default function HouseMarksDashboard({ school = [], onOpenTest }) {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const [testId, setTestId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setRows(null); setErr('')
    const { data, error } = await supabase.from('house_test_marks').select('id,test_name,test_date,house,subjects,marks,created_by,updated_at').order('test_date', { ascending: false }).limit(300)
    if (error) { setErr(/house_test_marks/i.test(error.message || '') ? 'Tests are not set up yet: run supabase/RUN_house_test_marks.sql once in Supabase.' : 'Could not load: ' + error.message); setRows([]); return }
    setRows(data || [])
  }
  useEffect(() => { load() }, [])

  const schoolById = useMemo(() => { const m = {}; school.forEach(s => { m[s.id] = s }); return m }, [school])
  const tests = useMemo(() => (rows || []).filter(r => (!from || r.test_date >= from) && (!to || r.test_date <= to)).map(r => ({ ...r, an: analyze(r, schoolById) })), [rows, schoolById, from, to])
  const scope = useMemo(() => testId ? tests.filter(t => t.id === testId) : tests, [tests, testId])

  const data = useMemo(() => {
    const houses = new Map()
    const hget = k => { k = k || NOHOUSE; if (!houses.has(k)) houses.set(k, { name: k, total: 0, tested: new Set(), pcts: [], pass: 0, passN: 0, tests: new Set(), top: null }); return houses.get(k) }
    school.filter(s => !s.status || /active/i.test(s.status)).forEach(s => { hget(s.house).total++ })
    const stu = new Map(), teachers = new Map()
    scope.forEach(t => {
      t.an.rows.forEach(x => {
        const hs = hget(x.house); hs.tested.add(x.id); hs.tests.add(t.id)
        const tk = x.teacher || 'Not recorded'
        if (!teachers.has(tk)) teachers.set(tk, { name: tk, tests: new Set(), students: 0, last: '' })
        const te = teachers.get(tk); te.tests.add(t.id); te.students++; if ((t.updated_at || '') > te.last) te.last = t.updated_at || ''
        if (x.c && x.c.rank) {
          hs.pcts.push(x.c.pct); hs.passN++; if (x.c.pass) hs.pass++
          if (!hs.top || x.c.pct > hs.top.pct) hs.top = { name: x.name, pct: x.c.pct, test: t.test_name }
          if (!stu.has(x.id)) stu.set(x.id, { id: x.id, name: x.name, house: x.house || NOHOUSE, cls: x.cls, pcts: [] })
          stu.get(x.id).pcts.push(x.c.pct)
        }
      })
    })
    const hl = [...houses.values()].map(x => ({ ...x, avg: x.pcts.length ? x.pcts.reduce((a, b) => a + b, 0) / x.pcts.length : null, passPct: x.passN ? x.pass / x.passN * 100 : null }))
      .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1) || a.name.localeCompare(b.name))
    const sl = [...stu.values()].map(x => ({ ...x, avg: x.pcts.reduce((a, b) => a + b, 0) / x.pcts.length })).sort((a, b) => b.avg - a.avg)
    const all = hl.flatMap(x => x.pcts), passN = hl.reduce((a, x) => a + x.passN, 0), passC = hl.reduce((a, x) => a + x.pass, 0)
    return { hl, sl, teachers: [...teachers.values()].sort((a, b) => b.students - a.students), avg: all.length ? all.reduce((a, b) => a + b, 0) / all.length : null, pass: passN ? passC / passN * 100 : null, tested: new Set(hl.flatMap(x => [...x.tested])).size }
  }, [scope, school])

  const delTest = async t => {
    if (!window.confirm(`Delete the whole test "${t.test_name}" with all teachers' marks? This cannot be undone.`)) return
    setBusy(true)
    const { error } = await supabase.from('house_test_marks').delete().eq('id', t.id)
    setBusy(false)
    if (error) { setErr('Delete failed: ' + error.message); return }
    if (testId === t.id) setTestId('')
    load()
  }
  const exportXlsx = () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['House', 'Students', 'Tested', 'Average %', 'Pass %', 'Topper'], ...data.hl.map(x => [x.name, x.total, x.tested.size, x.avg == null ? '' : Number(x.avg.toFixed(1)), x.passPct == null ? '' : Math.round(x.passPct), x.top ? `${x.top.name} (${x.top.pct.toFixed(1)}%)` : ''])]), 'Houses')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Rank', 'Student', 'House', 'Class', 'Average %', 'Tests'], ...data.sl.map((x, i) => [i + 1, x.name, x.house, x.cls || '', Number(x.avg.toFixed(1)), x.pcts.length])]), 'Students')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Housemaster', 'Tests', 'Students entered', 'Last saved'], ...data.teachers.map(x => [x.name, x.tests.size, x.students, x.last ? x.last.slice(0, 10) : ''])]), 'Housemasters')
    XLSX.writeFile(wb, 'Marks_dashboard.xlsx')
  }
  const Tile = ({ l, v, sub }) => (
    <div style={{ flex: '1 1 120px', border: `1px solid ${LINE}`, borderRadius: 14, padding: '9px 12px', background: '#fff' }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.08em', color: '#64748b', textTransform: 'uppercase' }}>{l}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: NAVY, lineHeight: 1.2 }}>{v}</div>
      {sub ? <div style={{ fontSize: 11.5, color: '#64748b' }}>{sub}</div> : null}
    </div>
  )
  const maxAvg = Math.max(1, ...data.hl.map(x => x.avg || 0))

  return (
    <div>
      {err && <div style={{ ...card, borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c', fontSize: 14 }}>{err}</div>}
      <div style={card}>
        <p style={h}>🏠 Admin dashboard · all houses</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ flex: '2 1 220px', fontSize: 12, fontWeight: 700, color: '#64748b', display: 'grid', gap: 4 }}>Test
            <select style={inp} value={testId} onChange={e => setTestId(e.target.value)}><option value="">All tests</option>{tests.map(t => <option key={t.id} value={t.id}>{t.test_name} · {fmtDate(t.test_date)}</option>)}</select>
          </label>
          <label style={{ flex: '1 1 130px', fontSize: 12, fontWeight: 700, color: '#64748b', display: 'grid', gap: 4 }}>From<input style={inp} type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
          <label style={{ flex: '1 1 130px', fontSize: 12, fontWeight: 700, color: '#64748b', display: 'grid', gap: 4 }}>To<input style={inp} type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
          <button type="button" style={btn} onClick={() => { setTestId(''); setFrom(''); setTo('') }}>Clear</button>
          <button type="button" style={btn} onClick={load}>↻ Refresh</button>
          <button type="button" style={btn} onClick={exportXlsx} disabled={!scope.length}>📊 Excel</button>
        </div>
      </div>

      {rows == null ? <div style={{ ...card, color: '#64748b' }}>Loading…</div> : !tests.length ? (
        <div style={{ ...card, color: '#64748b', fontSize: 13, textAlign: 'center', lineHeight: 1.6 }}>{err ? 'Could not load the dashboard.' : !(rows || []).length ? 'No test has been saved yet.' : 'No test in this date range.'}</div>
      ) : (<>
        <div style={{ ...card, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Tile l="Tests" v={scope.length} sub={testId ? 'selected' : 'in range'} />
          <Tile l="Students tested" v={data.tested} />
          <Tile l="Houses" v={data.hl.filter(x => x.tested.size).length} sub={`of ${data.hl.length}`} />
          <Tile l="Housemasters" v={data.teachers.length} />
          <Tile l="Average" v={pct(data.avg)} />
          <Tile l="Pass" v={data.pass == null ? '–' : Math.round(data.pass) + '%'} />
        </div>

        <div style={card}>
          <p style={h}>🏆 Houses compared</p>
          <div style={{ display: 'grid', gap: 8 }}>
            {data.hl.map((x, i) => (
              <div key={x.name} style={{ border: `1px solid ${LINE}`, borderRadius: 14, padding: '10px 12px', background: x.tested.size ? '#fff' : '#fffbeb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
                  <b style={{ fontSize: 15 }}>{x.avg != null && i < 3 ? ['🥇', '🥈', '🥉'][i] + ' ' : ''}{x.name}</b>
                  <span style={{ fontSize: 12.5, color: '#64748b' }}>{x.tested.size}/{x.total} students tested · {x.tests.size} test{x.tests.size === 1 ? '' : 's'}{x.passPct == null ? '' : ` · pass ${Math.round(x.passPct)}%`}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                  <div style={{ flex: 1, height: 12, borderRadius: 99, background: '#eef2f7', overflow: 'hidden' }}><div style={{ width: `${x.avg == null ? 0 : Math.max(2, x.avg / maxAvg * 100)}%`, height: '100%', background: `linear-gradient(90deg,${GOLD},#E2C57E)` }} /></div>
                  <b style={{ minWidth: 56, textAlign: 'right' }}>{pct(x.avg)}</b>
                </div>
                {x.top ? <div style={{ fontSize: 12.5, color: '#475569', marginTop: 4 }}>🥇 {x.top.name} · {x.top.pct.toFixed(1)}%</div> : <div style={{ fontSize: 12.5, color: '#b45309', marginTop: 4 }}>No marks entered for this house yet.</div>}
              </div>
            ))}
          </div>
        </div>

        <div style={card}>
          <p style={h}>⭐ Top 10 students · all houses</p>
          {!data.sl.length ? <div style={{ fontSize: 13, color: '#64748b' }}>No ranked students yet.</div> : data.sl.slice(0, 10).map((x, i) => (
            <div key={x.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 0', borderTop: i ? `1px solid ${LINE}` : 0, fontSize: 14 }}>
              <span><b style={{ display: 'inline-block', width: 26 }}>{i + 1}</b>{x.name} <span style={{ color: '#64748b', fontSize: 12.5 }}>· {x.house}{x.cls ? ' · ' + x.cls : ''}</span></span><b>{x.avg.toFixed(1)}%</b>
            </div>
          ))}
        </div>

        <div style={card}>
          <p style={h}>🧑‍🏫 Housemasters</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 8 }}>
            {data.teachers.map(x => <div key={x.name} style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: '8px 10px', fontSize: 13.5 }}><b>{x.name}</b><div style={{ color: '#64748b', fontSize: 12.5 }}>{x.tests.size} test{x.tests.size === 1 ? '' : 's'} · {x.students} student entries{x.last ? ' · ' + fmtDate(x.last.slice(0, 10)) : ''}</div></div>)}
          </div>
        </div>

        <div style={card}>
          <p style={h}>🗂 Manage tests (admin)</p>
          {tests.map(t => (
            <div key={t.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '8px 0', borderTop: `1px solid ${LINE}` }}>
              <div style={{ flex: '1 1 220px' }}><b>{t.test_name}</b><div style={{ fontSize: 12.5, color: '#64748b' }}>{fmtDate(t.test_date)} · {t.an.rows.length} students · {t.an.teachers.length} housemaster{t.an.teachers.length === 1 ? '' : 's'} · avg {pct(t.an.avg)}</div></div>
              {onOpenTest && <button type="button" style={{ ...btn, minHeight: 38, borderColor: GOLD }} onClick={() => onOpenTest(rows.find(r => r.id === t.id))}>✏️ Edit marks</button>}
              <button type="button" style={{ ...btn, minHeight: 38, color: '#b91c1c', borderColor: '#fecaca' }} onClick={() => delTest(t)} disabled={busy}>🗑 Delete</button>
            </div>
          ))}
        </div>
      </>)}
    </div>
  )
}
