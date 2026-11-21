// MissionSainikCertificates.jsx — merit certificates and the result list for the Mission Sainik mock tests.
// Ranks come from the marks the analyzers use (entered in Mock marks or uploaded): one test, or all tests of the series together.
import { useEffect, useMemo, useState } from 'react'
import { PremiumCard, PX } from './premiumUI'
import { Pill } from './MissionSainikUI'
import { loadAll } from './lib/mockTestStore'
import { downloadCsv } from './lib/missionSainikExport'
import { printPremium } from './lib/printPremium'
import { EXAM_KINDS, rankResults } from './lib/missionSainikExam'
import { downloadSainikCertificates, ordinal } from './lib/missionSainikCerts'

const esc = x => String(x ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

export default function MissionSainikCertificates({ institute, setMsg, isMobile }) {
  const [kind, setKind] = useState('pre')
  const [stored, setStored] = useState(null)
  const [series, setSeries] = useState('')
  const [testNo, setTestNo] = useState(0)          // 0 = all tests of the series together
  const [top, setTop] = useState(10)
  const [batch, setBatch] = useState('')
  const [busy, setBusy] = useState('')
  useEffect(() => { loadAll().then(setStored).catch(e => { setStored({ rows: [], mode: 'cloud' }); setMsg?.('❌ Could not load results: ' + (e.message || e)) }) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const inKind = n => (kind === 'mega') === /mega/i.test(n || '')
  const seriesList = useMemo(() => [...new Set((stored?.rows || []).map(r => r.series).filter(inKind))].sort(), [stored, kind]) // eslint-disable-line react-hooks/exhaustive-deps
  const current = seriesList.includes(series) ? series : seriesList[0] || ''
  const rows = useMemo(() => (stored?.rows || []).filter(r => r.series === current), [stored, current])
  const testsIn = useMemo(() => [...new Set(rows.map(r => Number(r.test_no)))].sort((a, b) => a - b), [rows])
  const batches = useMemo(() => [...new Set(rows.map(r => r.batch).filter(Boolean))].sort(), [rows])
  const ranked = useMemo(() => rankResults(batch ? rows.filter(r => r.batch === batch) : rows, { testNo }), [rows, testNo, batch])
  const winners = ranked.filter(r => r.rank <= top)
  const testLabel = testNo ? (EXAM_KINDS[kind].tests().find(t => t.no === testNo)?.id || 'Test ' + testNo) : 'all tests'
  const label = `${current} · ${testLabel}`
  const chip = on => ({ padding: '7px 14px', borderRadius: 99, border: `1.5px solid ${on ? PX.navy : PX.line}`, background: on ? PX.navy : '#fff', color: on ? '#fff' : PX.navy, fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' })
  const lab = { fontSize: 12, fontWeight: 700, color: PX.sub, display: 'block' }

  const certs = async list => {
    if (!list.length) return setMsg?.('❌ No results to make certificates from.')
    setBusy('Making…')
    try { await downloadSainikCertificates(list, label, `Mission_Sainik_${testLabel.replace(/\W+/g, '_')}_certificates.pdf`, (i, n) => setBusy(`Making ${i} of ${n}…`)); setMsg?.(`✅ ${list.length} certificate${list.length === 1 ? '' : 's'} downloaded.`) }
    catch (e) { setMsg?.('❌ Could not make certificates: ' + (e?.message || e)) }
    setBusy('')
  }
  const csv = () => downloadCsv(`Mission_Sainik_result_${testLabel.replace(/\W+/g, '_')}.csv`, [['Rank', 'Student', 'GCC', 'Batch', 'Total', 'Out of', '%', 'Tests'], ...ranked.map(r => [r.rank, r.name, r.gcc, r.batch, r.total, r.max, r.pct, r.tests])])
  const print = () => {
    if (!ranked.length) return setMsg?.('❌ No results to print.')
    printPremium(`<div class="title">Mission Sainik 2027 · Result list</div><div class="sub">${esc(label)}${batch ? ' · ' + esc(batch) : ''} · ${ranked.length} students ranked by percentage</div>
      <table class="t"><thead><tr><th>Rank</th><th class="l">Student</th><th>GCC</th><th>Batch</th><th>Total</th><th>%</th></tr></thead>
      <tbody>${ranked.map(r => `<tr${r.rank <= 3 ? ' style="background:#fdf6e3"' : ''}><td><b>${r.rank}</b></td><td class="l">${esc(r.name)}</td><td>${esc(r.gcc || '—')}</td><td>${esc(r.batch)}</td><td>${r.total}/${r.max}</td><td><b>${r.pct}%</b></td></tr>`).join('')}</tbody></table>
      <div class="sig"><span>Exam in-charge</span><span>Principal</span></div>`, { title: `Mission Sainik result · ${label}`, institute, docLabel: `Mission Sainik result · ${label}`, official: true })
  }

  return (
    <PremiumCard title="Results & certificates" subtitle="Rank the students of a mock test, print the result list and download merit certificates for the toppers."
      right={<span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button type="button" className="px-hbtn" onClick={print}>🖨 Result list</button><button type="button" className="px-hbtn" onClick={csv}>⬇ CSV</button><button type="button" className="px-btn gold" disabled={!!busy || !winners.length} onClick={() => certs(winners)}>{busy || `🏆 ${winners.length} certificate${winners.length === 1 ? '' : 's'}`}</button></span>}>
      <div role="tablist" aria-label="Test series" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {Object.entries(EXAM_KINDS).map(([k, v]) => <button key={k} type="button" role="tab" aria-selected={kind === k} style={chip(kind === k)} onClick={() => { setKind(k); setSeries(''); setTestNo(0); setBatch('') }}>{v.label}</button>)}
      </div>
      {stored === null ? <div style={{ padding: 18, color: PX.sub }}>Loading results…</div> : !seriesList.length ? <div style={{ padding: 18, color: PX.sub }}>No {EXAM_KINDS[kind].label} results yet. Enter marks in <b>Mock marks</b> or upload a result sheet in the analyzer, then come back here.</div> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1.6fr 1.2fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
            <label style={lab}>Series<select className="px-input" value={current} onChange={e => { setSeries(e.target.value); setTestNo(0); setBatch('') }}>{seriesList.map(n => <option key={n}>{n}</option>)}</select></label>
            <label style={lab}>Test<select className="px-input" value={testNo} onChange={e => setTestNo(Number(e.target.value))}><option value={0}>All tests together</option>{testsIn.map(n => <option key={n} value={n}>{EXAM_KINDS[kind].tests().find(t => t.no === n)?.id || 'Test ' + n}</option>)}</select></label>
            <label style={lab}>Batch<select className="px-input" value={batch} onChange={e => setBatch(e.target.value)}><option value="">All batches</option>{batches.map(b => <option key={b}>{b}</option>)}</select></label>
            <label style={lab}>Certificates for the top<select className="px-input" value={top} onChange={e => setTop(Number(e.target.value))}>{[3, 5, 10, 15, 20].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
          </div>
          {!ranked.length ? <div style={{ padding: 14, color: PX.sub }}>No results for this choice.</div> : (
            isMobile ? (
              <div style={{ display: 'grid', gap: 8 }}>
                {ranked.slice(0, Math.max(top, 30)).map(r => (
                  <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: `1px solid ${r.rank <= top ? '#ecdcae' : PX.line}`, borderRadius: 16, background: r.rank <= top ? '#fffaf0' : '#fff' }}>
                    <b style={{ fontSize: 17, minWidth: 44, color: PX.navy }}>{r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : ordinal(r.rank)}</b>
                    <span style={{ flex: 1, minWidth: 0 }}><b style={{ display: 'block', color: PX.ink, fontSize: 14.5 }}>{r.name}</b><small style={{ color: PX.sub }}>{r.batch} · {r.total}/{r.max}</small></span>
                    <Pill tone={r.pct >= 75 ? 'ok' : r.pct >= 50 ? 'gold' : 'bad'} dot={false}>{r.pct}%</Pill>
                    <button type="button" className="px-hbtn" aria-label={`Certificate for ${r.name}`} disabled={!!busy} onClick={() => certs([r])} style={{ minHeight: 44, minWidth: 44 }}>🏆</button>
                  </div>))}
                <div style={{ fontSize: 12.5, color: PX.sub }}>{ranked.length} students ranked{ranked.length > 30 && top < ranked.length ? ' · the first 30 are shown, the result list and CSV have everyone' : ''}.</div>
              </div>
            ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="px-table" style={{ width: '100%', minWidth: 560 }}>
                <thead><tr><th>Rank</th><th>Student</th><th>Batch</th><th>Total</th><th>%</th><th /></tr></thead>
                <tbody>
                  {ranked.slice(0, Math.max(top, 30)).map(r => (
                    <tr key={r.key} style={r.rank <= top ? { background: '#fffaf0' } : undefined}>
                      <td><b>{r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] + ' ' : ''}{ordinal(r.rank)}</b></td>
                      <td><b>{r.name}</b>{r.gcc ? <small style={{ color: PX.sub }}> · GCC {r.gcc}</small> : null}</td><td>{r.batch}</td><td>{r.total}/{r.max}</td>
                      <td><Pill tone={r.pct >= 75 ? 'ok' : r.pct >= 50 ? 'gold' : 'bad'} dot={false}>{r.pct}%</Pill></td>
                      <td><button type="button" className="px-hbtn" disabled={!!busy} onClick={() => certs([r])}>🏆 Certificate</button></td>
                    </tr>))}
                </tbody>
              </table>
              <div style={{ marginTop: 8, fontSize: 12.5, color: PX.sub }}>{ranked.length} students ranked{ranked.length > 30 && top < ranked.length ? ' · the first 30 are shown, the result list and CSV have everyone' : ''}.</div>
            </div>))}
        </>)}
    </PremiumCard>
  )
}
