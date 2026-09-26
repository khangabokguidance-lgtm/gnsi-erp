// EntranceResults.jsx — Entrance stages 6-8: OMR evaluation, results &
// merit, admission (seat allocation, waitlist, offer letters).

import { useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { PX, PremiumCard, PIcon } from './premiumUI'
import {
  CATEGORIES, RESERVED, parseJson, fmtDate, hallTicketNo, keyForSet, sectionRanges, cleanResponses, evaluate,
  rankRows, qualifies, allocateSeats, parseCSV, toCSV, downloadText, safeWrite, audit, inChunks,
} from './entranceCore'
import { printWindow, openPrint, meritListHtml, scorecardHtml, offerLetterHtml } from './entrancePrint'
import { useManualKeys } from './entranceHooks'
import { Chip, StatusChip, Field, Kpi, Empty, Modal } from './entranceUI'

const r2 = n => Math.round(n * 100) / 100

// Evaluated, non-disqualified candidates → ranked merit rows.
function buildMerit(exam, cands, resMap, sections) {
  const rows = []
  for (const c of cands) {
    const r = resMap[c.id]
    if (!r || r.total_marks == null || c.status === 'Disqualified') continue
    rows.push({
      ...c, resultId: r.id, total: Number(r.total_marks) || 0, scores: parseJson(r.subject_scores, {}) || {},
      correct: r.correct_count, wrong: r.wrong_count, result_status: r.result_status || 'Pending', quota: r.allotted_quota || '',
      decision: ['Admitted', 'Rejected'].includes(r.result_status) ? r.result_status : '', saved_rank: r.overall_rank,
    })
  }
  return rankRows(rows, sections).map(r => ({ ...r, qualified: qualifies(r, exam, sections) }))
}

async function saveResult(exam, c, existing, fields) {
  const payload = { candidate_id: c.id, exam_id: exam.id, ...fields }
  return existing?.id
    ? safeWrite('entrance_results', 'update', payload, { id: existing.id })
    : safeWrite('entrance_results', 'insert', { result_status: 'Pending', ...payload })
}

// ═══════════════════════════════════════════════════════════════════════════
// Evaluation
// ═══════════════════════════════════════════════════════════════════════════
export function EvaluationTab({ exam, cands, resMap, sections, can, reload, notify, user, go }) {
  const paper = parseJson(exam.paper)
  const manualKeys = useManualKeys(exam.id)
  const hasKey = !!paper?.questions?.length || (manualKeys?.length > 0)
  const sets = useMemo(() => (paper?.sets?.length ? paper.sets : ['A']), [paper])
  const keys = useMemo(() => Object.fromEntries(sets.map(s => [s, keyForSet(exam, paper, manualKeys, s)])), [exam, paper, manualKeys, sets])
  const [mode, setMode] = useState('omr')
  const [sel, setSel] = useState(null)
  const [busy, setBusy] = useState(false)
  const [importing, setImporting] = useState(false)
  const [q, setQ] = useState('')

  const pool = cands.filter(c => c.status === 'Appeared' || resMap[c.id]?.total_marks != null)
    .filter(c => !q.trim() || [c.student_name, hallTicketNo(exam.id, c.roll_number)].join(' ').toLowerCase().includes(q.trim().toLowerCase()))
  const done = pool.filter(c => resMap[c.id]?.total_marks != null).length
  const withResp = cands.filter(c => resMap[c.id]?.responses)

  const scoreAndSave = async (c, responses, set) => {
    const key = keys[set] || keys.A
    const ev = evaluate(responses, key, sections, exam.negative_marks)
    const res = await saveResult(exam, c, resMap[c.id], {
      responses: cleanResponses(responses), total_marks: ev.total, subject_scores: JSON.stringify(ev.subject_scores),
      correct_count: ev.correct, wrong_count: ev.wrong, blank_count: ev.blank, evaluated_at: new Date().toISOString(),
    })
    if (res.error) return res
    const patch = {}
    if (['Registered', 'Hall Ticket Issued', 'Absent'].includes(c.status)) patch.status = 'Appeared'
    if (set !== (c.paper_set || 'A')) patch.paper_set = set
    if (Object.keys(patch).length) await safeWrite('entrance_candidates', 'update', patch, { id: c.id })
    return res
  }

  const reEvaluate = async () => {
    setBusy(true)
    const res = await inChunks(withResp, 20, c => scoreAndSave(c, resMap[c.id].responses, c.paper_set || 'A'))
    setBusy(false)
    const err = res.find(r => r.error)
    audit('re_evaluate', user, exam.id, { count: withResp.length })
    notify(err ? err.error.message : `Re-evaluated ${withResp.length} answer sheets with the current key`, err ? 'bad' : 'ok')
    reload()
  }

  if (!hasKey && mode === 'omr') {
    return (
      <div style={{ display: 'grid', gap: 14 }}>
        <PremiumCard title="No answer key yet">
          <Empty icon="🔑" title="OMR evaluation needs an answer key">
            Generate the paper from the Question Bank, or type the key in the Question Paper tab.
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14 }}>
              <button className="px-btn" onClick={() => go('paper')}>Go to Question Paper</button>
              <button className="px-btn ghost" onClick={() => setMode('marks')}>Enter section marks instead</button>
            </div>
          </Empty>
        </PremiumCard>
      </div>
    )
  }

  const selC = sel && cands.find(c => c.id === sel)
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="ex-grid ex-g4">
        <Kpi k="Answer sheets" v={pool.length} sub="present candidates" />
        <Kpi k="Evaluated" v={done} tone={PX.ok} sub={`${pool.length - done} to go`} />
        <Kpi k="Key" v={paper?.questions?.length ? `${paper.questions.length} Q` : manualKeys?.length ? `${manualKeys.length} Q` : '—'} sub={paper ? `sets ${sets.join(', ')}` : 'manual key'} />
        <Kpi k="Negative marking" v={Number(exam.negative_marks) ? `−${exam.negative_marks}` : 'None'} />
      </div>

      <PremiumCard title="Evaluation" subtitle={mode === 'omr' ? 'Enter each OMR sheet (or import scanner output) — scores are computed against the key for the candidate\'s set' : 'Direct section marks, for papers checked by hand'}
        right={<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <div className="px-tabs" style={{ margin: 0, padding: 3 }}>
            <button className={'px-tab' + (mode === 'omr' ? ' on' : '')} style={{ padding: '6px 11px' }} onClick={() => setMode('omr')}>OMR</button>
            <button className={'px-tab' + (mode === 'marks' ? ' on' : '')} style={{ padding: '6px 11px' }} onClick={() => setMode('marks')}>Marks</button>
          </div>
          {mode === 'omr' && can.edit && <button className="px-btn ghost ex-btn-sm" onClick={() => setImporting(true)}>Import scanner CSV</button>}
          {mode === 'omr' && can.edit && withResp.length > 0 && <button className="px-btn ghost ex-btn-sm" disabled={busy} onClick={reEvaluate}>{busy ? 'Working…' : `↻ Re-evaluate ${withResp.length}`}</button>}
        </div>}>
        <div className="ex-bar"><input className="px-input" style={{ maxWidth: 260 }} placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} /></div>
        {pool.length === 0 ? <Empty icon="📝" title="No one marked present yet">Mark attendance on the Exam Day tab first.</Empty> : mode === 'marks' ? (
          <MarksGrid exam={exam} pool={pool} resMap={resMap} sections={sections} can={can} notify={notify} reload={reload} user={user} />
        ) : (
          <div className="ex-tablewrap" style={{ marginTop: 0 }}>
            <table className="px-table">
              <thead><tr><th>Roll no.</th><th>Candidate</th><th>Set</th>{sections.map(s => <th key={s.name}>{s.name}</th>)}<th>Total</th><th>✓ / ✗ / –</th><th /></tr></thead>
              <tbody>{pool.map(c => {
                const r = resMap[c.id]
                const sc = parseJson(r?.subject_scores, {}) || {}
                return (
                  <tr key={c.id} className={sel === c.id ? 'ex-row-sel' : undefined}>
                    <td className="ex-mono" style={{ fontSize: 12 }}>{hallTicketNo(exam.id, c.roll_number)}</td>
                    <td><b>{c.student_name}</b></td>
                    <td>{c.paper_set || 'A'}</td>
                    {sections.map(s => <td key={s.name}>{r?.total_marks != null ? sc[s.name] ?? '—' : '—'}</td>)}
                    <td><b>{r?.total_marks ?? '—'}</b></td>
                    <td style={{ fontSize: 12 }}>{r?.correct_count != null ? `${r.correct_count} / ${r.wrong_count} / ${r.blank_count}` : r?.total_marks != null ? 'marks' : '—'}</td>
                    <td>{can.edit && <button className="px-btn ghost ex-btn-sm" onClick={() => setSel(c.id)}>{r?.responses ? 'Edit sheet' : 'Enter sheet'}</button>}</td>
                  </tr>
                )
              })}</tbody>
            </table>
          </div>
        )}
      </PremiumCard>

      {selC && (
        <OMREntry key={selC.id} exam={exam} c={selC} existing={resMap[selC.id]} sets={sets} keys={keys} sections={sections}
          onClose={() => setSel(null)}
          onSave={async (responses, set, next) => {
            const res = await scoreAndSave(selC, responses, set)
            if (res.error) return notify(res.error.message, 'bad')
            audit('omr_entry', user, selC.id, { set })
            notify(`Saved ${selC.student_name}`, 'ok'); reload()
            if (next) {
              const i = pool.findIndex(c => c.id === selC.id)
              const nxt = pool.slice(i + 1).find(c => !resMap[c.id]?.responses) || pool[i + 1]
              setSel(nxt ? nxt.id : null)
            } else setSel(null)
          }} />
      )}
      {importing && <ImportResponses exam={exam} cands={cands} keys={keys} sets={sets} onClose={() => setImporting(false)} notify={notify} user={user}
        save={scoreAndSave} onDone={() => { setImporting(false); reload() }} />}
    </div>
  )
}

function OMREntry({ exam, c, existing, sets, keys, sections, onClose, onSave }) {
  const [set, setSet] = useState(c.paper_set && sets.includes(c.paper_set) ? c.paper_set : sets[0])
  const key = keys[set] || keys.A
  const n = key.length
  const [resp, setResp] = useState(() => cleanResponses(existing?.responses || '').padEnd(n, '-').slice(0, n))
  const [saving, setSaving] = useState(false)
  const ranges = sectionRanges(exam, key)
  const ev = evaluate(resp, key, sections, exam.negative_marks)
  const setSeg = (r, v) => {
    const clean = cleanResponses(v).slice(0, r.count).padEnd(r.count, '-')
    setResp(p => p.slice(0, r.from - 1) + clean + p.slice(r.to))
  }
  const save = async next => { setSaving(true); await onSave(resp, set, next); setSaving(false) }

  return (
    <Modal title={`OMR sheet · ${c.student_name}`} subtitle={`${hallTicketNo(exam.id, c.roll_number)} · ${n} questions`} onClose={onClose} width={860}
      footer={<>
        <span style={{ marginRight: 'auto', fontSize: 13, color: PX.sub }}>Score <b style={{ fontFamily: PX.serif, fontSize: 18, color: PX.ink }}>{ev.total}</b> · ✓ {ev.correct} · ✗ {ev.wrong} · – {ev.blank}</span>
        <button className="px-btn ghost" onClick={onClose}>Cancel</button>
        <button className="px-btn ghost" disabled={saving} onClick={() => save(false)}>Save</button>
        <button className="px-btn" disabled={saving} onClick={() => save(true)}>Save & next →</button>
      </>}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <span className="ex-label" style={{ margin: 0 }}>Booklet set</span>
        {sets.map(s => <button key={s} className={'px-btn ex-btn-sm' + (s === set ? '' : ' ghost')} onClick={() => setSet(s)}>{s}</button>)}
        <span style={{ fontSize: 12, color: PX.sub }}>Type the marked letters in order: A–D, <b>-</b> for blank, <b>*</b> for two circles marked.</span>
      </div>
      <div style={{ display: 'grid', gap: 12 }}>
        {ranges.filter(r => r.count).map(r => {
          const seg = resp.slice(r.from - 1, r.to)
          const segKey = key.slice(r.from - 1, r.to)
          return (
            <div key={r.index}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                <span className="ex-label" style={{ margin: 0 }}>{r.name} · Q{r.from}–{r.to}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: PX.ink2 }}>{ev.subject_scores[r.name]} / {r.max}</span>
              </div>
              <input className="px-input ex-omr" value={seg.replace(/-+$/, '')} onChange={e => setSeg(r, e.target.value)} aria-label={`${r.name} responses`} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 6 }}>
                {[...seg].map((a, i) => {
                  const k = segKey[i]?.correct
                  const ok = k === 'X' || (a !== '-' && a === k)
                  const bg = a === '-' && k !== 'X' ? '#f3f0e8' : ok ? PX.okBg : PX.badBg
                  return <span key={i} title={`Q${r.from + i}: marked ${a}, key ${k}`} style={{ width: 30, textAlign: 'center', fontSize: 10.5, borderRadius: 6, padding: '2px 0', background: bg, color: ok ? PX.ok : a === '-' ? PX.faint : PX.bad }}><span style={{ opacity: 0.6 }}>{r.from + i}</span><br /><b>{a}</b></span>
                })}
              </div>
            </div>
          )
        })}
      </div>
    </Modal>
  )
}

function MarksGrid({ exam, pool, resMap, sections, can, notify, reload, user }) {
  const [edits, setEdits] = useState({})
  const val = (c, s) => edits[c.id]?.[s.name] ?? (parseJson(resMap[c.id]?.subject_scores, {}) || {})[s.name] ?? ''
  const save = async c => {
    const scores = Object.fromEntries(sections.map(s => [s.name, r2(Number(val(c, s)) || 0)]))
    const total = r2(Object.values(scores).reduce((a, b) => a + b, 0))
    const res = await saveResult(exam, c, resMap[c.id], { total_marks: total, subject_scores: JSON.stringify(scores), evaluated_at: new Date().toISOString() })
    if (res.error) return notify(res.error.message, 'bad')
    audit('marks_entry', user, c.id, { total })
    setEdits(e => { const n = { ...e }; delete n[c.id]; return n })
    notify(`Saved ${c.student_name}: ${total}`, 'ok'); reload()
  }
  return (
    <div className="ex-tablewrap" style={{ marginTop: 0 }}>
      <table className="px-table">
        <thead><tr><th>Candidate</th>{sections.map(s => <th key={s.name}>{s.name}{Number(s.questions) ? ` /${Number(s.questions) * Number(s.marks_each)}` : ''}</th>)}<th>Total</th><th /></tr></thead>
        <tbody>{pool.map(c => {
          const total = r2(sections.reduce((t, s) => t + (Number(val(c, s)) || 0), 0))
          return (
            <tr key={c.id}>
              <td><b>{c.student_name}</b><div className="ex-mono" style={{ fontSize: 11, color: PX.faint }}>{hallTicketNo(exam.id, c.roll_number)}</div></td>
              {sections.map(s => <td key={s.name}><input type="number" step="0.25" className="px-input" style={{ width: 80, padding: '6px 8px' }} disabled={!can.edit} value={val(c, s)} onChange={e => setEdits(x => ({ ...x, [c.id]: { ...x[c.id], [s.name]: e.target.value } }))} aria-label={`${s.name} marks`} /></td>)}
              <td><b>{total}</b></td>
              <td>{can.edit && <button className="px-btn ex-btn-sm" disabled={!edits[c.id]} onClick={() => save(c)}>Save</button>}</td>
            </tr>
          )
        })}</tbody>
      </table>
    </div>
  )
}

// Scanner output: one row per sheet — roll (or application no), set, and
// either a `responses` string or q1…qN columns.
function ImportResponses({ exam, cands, keys, sets, onClose, notify, user, save, onDone }) {
  const [rows, setRows] = useState(null)
  const [busy, setBusy] = useState(false)
  const find = v => {
    const s = String(v || '').trim().toUpperCase()
    if (!s) return null
    return cands.find(c => hallTicketNo(exam.id, c.roll_number).toUpperCase() === s || String(c.application_no || '').toUpperCase() === s || (/^\d+$/.test(s) && Number(c.roll_number) === Number(s)))
  }
  const read = async file => {
    const parsed = parseCSV(await file.text())
    setRows(parsed.map(r => {
      const id = r.roll ?? r.roll_no ?? r.roll_number ?? r.hall_ticket ?? r.application_no ?? ''
      const c = find(id)
      const set = String(r.set ?? r.paper_set ?? r.booklet ?? '').trim().toUpperCase()
      let resp = r.responses ?? r.answers ?? ''
      if (!resp) {
        const qs = Object.keys(r).filter(k => /^q\d+$/.test(k)).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
        resp = qs.map(k => r[k] || '-').join('')
      }
      return { id, c, set: sets.includes(set) ? set : (c?.paper_set || sets[0]), resp: cleanResponses(resp) }
    }))
  }
  const go = async () => {
    const ok = rows.filter(r => r.c)
    setBusy(true)
    const res = await inChunks(ok, 20, r => save(r.c, r.resp, r.set))
    setBusy(false)
    const err = res.find(x => x.error)
    audit('omr_import', user, exam.id, { count: ok.length })
    notify(err ? err.error.message : `Evaluated ${ok.length} answer sheets`, err ? 'bad' : 'ok')
    onDone()
  }
  const matched = rows?.filter(r => r.c).length || 0
  return (
    <Modal title="Import OMR scanner output" subtitle={exam.exam_name} onClose={onClose} width={820}
      footer={<><button className="px-btn ghost" onClick={onClose}>Cancel</button><button className="px-btn" disabled={!matched || busy} onClick={go}>{busy ? 'Evaluating…' : `Evaluate ${matched}`}</button></>}>
      <div style={{ fontSize: 12.5, color: PX.sub, marginBottom: 10, lineHeight: 1.6 }}>
        CSV with a header row: <span className="ex-mono">roll</span> (roll no., hall-ticket no. or application no.), <span className="ex-mono">set</span>, and either <span className="ex-mono">responses</span> (e.g. <span className="ex-mono">ABDC-A*…</span>) or columns <span className="ex-mono">q1…q{keys.A?.length || 'N'}</span>.
      </div>
      <input type="file" accept=".csv,text/csv" className="px-input" style={{ padding: 7 }} onChange={e => e.target.files?.[0] && read(e.target.files[0])} />
      {rows && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}><Chip tone="ok">{matched} matched</Chip><Chip tone="bad">{rows.length - matched} unknown roll</Chip></div>
          <div style={{ overflowX: 'auto', maxHeight: 300 }}>
            <table className="px-table"><thead><tr><th>Roll</th><th>Candidate</th><th>Set</th><th>Responses</th><th>Score</th></tr></thead>
              <tbody>{rows.slice(0, 60).map((r, i) => {
                const k = keys[r.set] || keys.A
                return (
                  <tr key={i} style={{ opacity: r.c ? 1 : 0.5 }}><td className="ex-mono">{r.id}</td><td>{r.c?.student_name || <Chip tone="bad">not found</Chip>}</td><td>{r.set}</td>
                    <td className="ex-mono" style={{ fontSize: 11 }}>{r.resp.slice(0, 30)}{r.resp.length > 30 ? '…' : ''} <span style={{ color: r.resp.length === k.length ? PX.ok : PX.warn }}>({r.resp.length}/{k.length})</span></td>
                    <td>{r.c ? evaluate(r.resp, k, sectionRanges(exam, k), exam.negative_marks).total : '—'}</td></tr>
                )
              })}</tbody></table>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Results & merit
// ═══════════════════════════════════════════════════════════════════════════
export function ResultsTab({ exam, cands, resMap, sections, can, reload, notify, user }) {
  const merit = useMemo(() => buildMerit(exam, cands, resMap, sections), [exam, cands, resMap, sections])
  const [fCat, setFCat] = useState('')
  const [fQ, setFQ] = useState('')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const maxMarks = Number(exam.total_marks) || sections.reduce((t, s) => t + (Number(s.questions) || 0) * (Number(s.marks_each) || 0), 0) || Math.max(1, ...merit.map(r => r.total))
  const qualified = merit.filter(r => r.qualified)
  const avg = merit.length ? r2(merit.reduce((t, r) => t + r.total, 0) / merit.length) : 0
  const nextStatus = r => (['Admitted', 'Rejected', 'Waitlist'].includes(r.result_status) ? r.result_status : r.qualified ? 'Pass' : 'Fail')
  const stale = merit.filter(r => r.saved_rank !== r.rank || nextStatus(r) !== r.result_status)
  const list = merit.filter(r => (!fCat || (r.category || 'General') === fCat) && (!fQ || (fQ === 'q' ? r.qualified : !r.qualified))
    && (!q.trim() || [r.student_name, hallTicketNo(exam.id, r.roll_number)].join(' ').toLowerCase().includes(q.trim().toLowerCase())))

  const bins = useMemo(() => {
    const b = Array.from({ length: 10 }, (_, i) => ({ from: Math.round((maxMarks * i) / 10), n: 0 }))
    for (const r of merit) b[Math.min(9, Math.max(0, Math.floor((r.total / maxMarks) * 10)))].n++
    return b
  }, [merit, maxMarks])
  const peak = Math.max(1, ...bins.map(b => b.n))

  const saveRanks = async () => {
    setBusy(true)
    const res = await inChunks(stale, 20, r => safeWrite('entrance_results', 'update', { overall_rank: r.rank, category_rank: r.category_rank, result_status: nextStatus(r) }, { id: r.resultId }))
    setBusy(false)
    const err = res.find(x => x.error)
    if (err) return notify(err.error.message, 'bad')
    audit('results_compute', user, exam.id, { updated: stale.length, qualified: qualified.length })
    notify(`Results saved — ${qualified.length} qualified`, 'ok'); reload()
  }
  const publish = async on => {
    const { error, dropped } = await safeWrite('entrance_exams', 'update', { result_published: on }, { id: exam.id })
    if (error || dropped.length) return notify(error?.message || 'Publishing needs the database upgrade', 'bad')
    audit(on ? 'results_publish' : 'results_unpublish', user, exam.id)
    notify(on ? 'Results published' : 'Results withdrawn', 'ok'); reload()
  }

  const labelled = rows => rows.map(r => ({ ...r, statusLabel: r.qualified ? 'Qualified' : 'Not qualified' }))
  const printMerit = (rows, title) => openPrint(`${title} · ${exam.exam_name}`, meritListHtml(exam, labelled(rows), sections, { title }))
  const printByCategory = () => openPrint(`Category merit · ${exam.exam_name}`, CATEGORIES.filter(c => qualified.some(r => (r.category || 'General') === c))
    .map(c => `<div class="page">${meritListHtml(exam, labelled(qualified.filter(r => (r.category || 'General') === c)), sections, { title: `MERIT LIST · ${c.toUpperCase()}` })}</div>`).join(''))
  const printScorecards = async rows => {
    if (!rows.length) return
    const win = printWindow('scorecards')
    if (!win) return
    const qrs = await Promise.all(rows.map(r => QRCode.toDataURL(`${hallTicketNo(exam.id, r.roll_number)}|${r.total}|R${r.rank}`, { margin: 0, width: 140 }).catch(() => '')))
    openPrint(`Scorecards · ${exam.exam_name}`, rows.map((r, i) => scorecardHtml(exam, r, sections, { qr: qrs[i] })).join(''), '', win)
  }
  const exportCSV = () => downloadText(`${exam.exam_name}-results.csv`, toCSV(merit, [
    { label: 'Rank', key: 'rank' }, { label: 'Category rank', key: 'category_rank' }, { label: 'Roll no', get: r => hallTicketNo(exam.id, r.roll_number) },
    { label: 'Application no', key: 'application_no' }, { label: 'Name', key: 'student_name' }, { label: 'Category', get: r => r.category || 'General' },
    ...sections.map(s => ({ label: s.name, get: r => r.scores?.[s.name] ?? '' })), { label: 'Total', key: 'total' },
    { label: 'Correct', key: 'correct' }, { label: 'Wrong', key: 'wrong' }, { label: 'Qualified', get: r => (r.qualified ? 'Yes' : 'No') }, { label: 'Status', key: 'result_status' },
  ]))

  if (!merit.length) return <PremiumCard title="Results"><Empty icon="📊" title="Nothing evaluated yet">Evaluate answer sheets in the Evaluation tab — ranks appear here automatically.</Empty></PremiumCard>

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="ex-grid ex-g4">
        <Kpi k="Evaluated" v={merit.length} />
        <Kpi k="Qualified" v={qualified.length} tone={PX.ok} sub={`${merit.length ? Math.round((qualified.length / merit.length) * 100) : 0}% · cut-off ${exam.passing_marks}`} />
        <Kpi k="Topper" v={merit[0].total} sub={merit[0].student_name} tone="#8a6118" />
        <Kpi k="Average" v={avg} sub={`out of ${maxMarks}`} />
      </div>

      <div className="ex-grid ex-side">
        <PremiumCard title="Score distribution">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 130 }}>
            {bins.map((b, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }} title={`${b.from}–${Math.round((maxMarks * (i + 1)) / 10)}: ${b.n}`}>
                <span style={{ fontSize: 10.5, color: PX.sub }}>{b.n || ''}</span>
                <div style={{ width: '100%', height: `${(b.n / peak) * 100}px`, minHeight: b.n ? 3 : 0, borderRadius: '6px 6px 0 0', background: b.from >= Number(exam.passing_marks) ? `linear-gradient(180deg,${PX.gold},#d4ae58)` : '#d9d2c2' }} />
                <span style={{ fontSize: 9.5, color: PX.faint }}>{b.from}</span>
              </div>
            ))}
          </div>
        </PremiumCard>
        <PremiumCard title="Sections">
          <table className="px-table"><thead><tr><th>Section</th><th>Avg</th><th>Top</th></tr></thead>
            <tbody>{sections.map(s => {
              const v = merit.map(r => Number(r.scores?.[s.name]) || 0)
              return <tr key={s.name}><td>{s.name}</td><td>{r2(v.reduce((a, b) => a + b, 0) / v.length)}</td><td>{Math.max(...v)}</td></tr>
            })}</tbody></table>
          <div style={{ fontSize: 12, color: PX.sub, marginTop: 10 }}>
            Lowest qualifying score · {CATEGORIES.map(c => { const x = qualified.filter(r => (r.category || 'General') === c); return x.length ? `${c} ${x[x.length - 1].total}` : null }).filter(Boolean).join(' · ') || '—'}
          </div>
        </PremiumCard>
      </div>

      <PremiumCard title="Merit list" subtitle={`${list.length} shown · ties broken by section marks, then age`}
        right={<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {exam.result_published ? <Chip tone="ok">Published</Chip> : <Chip tone="grey">Not published</Chip>}
          {can.edit && <button className="px-btn ex-btn-sm" disabled={busy || !stale.length} onClick={saveRanks}>{busy ? 'Saving…' : stale.length ? `Save ranks & results (${stale.length})` : '✓ Saved'}</button>}
          {can.edit && <button className="px-btn gold ex-btn-sm" disabled={!!stale.length && !exam.result_published} title={stale.length ? 'Save ranks first' : ''} onClick={() => publish(!exam.result_published)}>{exam.result_published ? 'Withdraw' : 'Publish results'}</button>}
        </div>}>
        <div className="ex-bar">
          <input className="px-input" style={{ maxWidth: 220 }} placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} />
          <select className="px-input" style={{ maxWidth: 150 }} value={fCat} onChange={e => setFCat(e.target.value)} aria-label="Category"><option value="">All categories</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
          <select className="px-input" style={{ maxWidth: 150 }} value={fQ} onChange={e => setFQ(e.target.value)} aria-label="Qualified"><option value="">Everyone</option><option value="q">Qualified</option><option value="n">Not qualified</option></select>
          <span style={{ marginLeft: 'auto' }} />
          <button className="px-btn ghost ex-btn-sm" onClick={() => printMerit(qualified, 'MERIT LIST')}><PIcon.print size={13} />Merit list</button>
          <button className="px-btn ghost ex-btn-sm" onClick={printByCategory}><PIcon.print size={13} />By category</button>
          <button className="px-btn ghost ex-btn-sm" onClick={() => printScorecards(list)}><PIcon.print size={13} />Scorecards ({list.length})</button>
          <button className="px-btn ghost ex-btn-sm" onClick={exportCSV}><PIcon.download size={13} />CSV</button>
        </div>
        <div className="ex-tablewrap" style={{ marginTop: 0 }}>
          <table className="px-table">
            <thead><tr><th>Rank</th><th>Cat. rank</th><th>Roll no.</th><th>Candidate</th>{sections.map(s => <th key={s.name}>{s.name}</th>)}<th>Total</th><th>Result</th></tr></thead>
            <tbody>{list.map(r => (
              <tr key={r.id} style={r.rank <= 3 ? { background: '#fffaf0' } : undefined}>
                <td><span style={{ display: 'inline-flex', width: 28, height: 28, borderRadius: '50%', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, background: r.rank === 1 ? PX.gold : r.rank <= 3 ? PX.goldBg : '#f3f0e8', color: r.rank === 1 ? '#fff' : PX.ink2 }}>{r.rank}</span></td>
                <td>{r.category || 'General'} · {r.category_rank}</td>
                <td className="ex-mono" style={{ fontSize: 12 }}>{hallTicketNo(exam.id, r.roll_number)}</td>
                <td><b>{r.student_name}</b><div style={{ fontSize: 11.5, color: PX.faint }}>{r.father_name}</div></td>
                {sections.map(s => <td key={s.name}>{r.scores?.[s.name] ?? '—'}</td>)}
                <td><b style={{ fontSize: 15, color: r.qualified ? PX.ok : PX.bad }}>{r.total}</b></td>
                <td>{r.qualified ? <Chip tone="ok">Qualified</Chip> : <Chip tone="bad">Not qualified</Chip>} {['Admitted', 'Waitlist', 'Rejected'].includes(r.result_status) && <StatusChip s={r.result_status} />}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </PremiumCard>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Admission — seat allocation, waitlist, offers
// ═══════════════════════════════════════════════════════════════════════════
export function AdmissionTab({ exam, cands, resMap, sections, can, reload, notify, user, go }) {
  const merit = useMemo(() => buildMerit(exam, cands, resMap, sections), [exam, cands, resMap, sections])
  const seats = Number(exam.total_seats) || 0
  const quotas = parseJson(exam.quotas, {}) || {}
  const [proposal, setProposal] = useState(null)
  const [busy, setBusy] = useState(false)
  const [reportBy, setReportBy] = useState('')
  const [fee, setFee] = useState('')
  const [view, setView] = useState('')
  const qualified = merit.filter(r => r.qualified)
  const admitted = merit.filter(r => r.result_status === 'Admitted')
  const waitlist = merit.filter(r => r.result_status === 'Waitlist')
  const declined = merit.filter(r => r.result_status === 'Rejected')
  const quotaSeats = Object.fromEntries(RESERVED.map(c => [c, Math.floor((seats * (Number(quotas[c]) || 0)) / 100)]))
  const openSeats = seats - Object.values(quotaSeats).reduce((a, b) => a + b, 0)

  const propose = () => {
    if (!seats) return notify('Set the number of seats in the exam set-up first', 'warn')
    const alloc = allocateSeats(qualified, { seats, quotas })
    const changes = qualified.map(r => ({ r, to: alloc[r.id] })).filter(x => x.to && !x.to.kept && (x.to.status !== x.r.result_status || (x.to.quota || '') !== (x.r.quota || '')))
    setProposal({ alloc, changes })
  }
  const apply = async () => {
    setBusy(true)
    const res = await inChunks(proposal.changes, 20, ({ r, to }) => safeWrite('entrance_results', 'update', { result_status: to.status, allotted_quota: to.quota || null }, { id: r.resultId }))
    setBusy(false)
    const err = res.find(x => x.error)
    if (err) return notify(err.error.message, 'bad')
    const nAdm = proposal.changes.filter(x => x.to.status === 'Admitted').length
    audit('seat_allocation', user, exam.id, { admitted: nAdm, waitlist: proposal.changes.length - nAdm })
    notify(`Allocation applied — ${nAdm} new admissions`, 'ok'); setProposal(null); reload()
  }
  const decide = async (r, status) => {
    const patch = { result_status: status }
    if (status === 'Admitted' && !r.quota) patch.allotted_quota = 'Open'
    if (status !== 'Admitted') patch.allotted_quota = null
    const { error } = await safeWrite('entrance_results', 'update', patch, { id: r.resultId })
    if (error) return notify(error.message, 'bad')
    audit('admission_decision', user, r.id, { student_name: r.student_name, status })
    notify(status === 'Rejected' ? `${r.student_name} declined — use "Fill vacancies" to offer the seat onwards` : `${r.student_name}: ${status}`, status === 'Rejected' ? 'warn' : 'ok'); reload()
  }
  const offers = rows => rows.length && openPrint(`Offer letters · ${exam.exam_name}`, rows.map(r => offerLetterHtml(exam, r, { reportBy, fee })).join(''))
  const printList = (rows, title) => openPrint(`${title} · ${exam.exam_name}`, meritListHtml(exam, rows.map(r => ({ ...r, statusLabel: r.result_status === 'Admitted' ? `Admitted · ${r.quota || 'Open'}` : r.result_status })), sections, { title }))

  const list = merit.filter(r => r.qualified || r.decision).filter(r => !view || r.result_status === view)
  const quotaRows = [['Open', openSeats], ...RESERVED.filter(c => quotaSeats[c] > 0).map(c => [c, quotaSeats[c]])]

  if (!merit.length) return <PremiumCard title="Admission"><Empty icon="🎓" title="No results yet">Allocation works from the merit list — evaluate answer sheets first.</Empty></PremiumCard>

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="ex-grid ex-g4">
        <Kpi k="Seats" v={seats || '—'} sub={seats ? `${openSeats} open · ${seats - openSeats} reserved` : 'set in exam set-up'} />
        <Kpi k="Admitted" v={admitted.length} tone={PX.ok} sub={seats ? `${Math.max(0, seats - admitted.length)} vacant` : ''} />
        <Kpi k="Waitlist" v={waitlist.length} tone={PX.warn} />
        <Kpi k="Declined / cancelled" v={declined.length} tone={PX.bad} />
      </div>

      <div className="ex-grid ex-side">
        <PremiumCard title="Seat allocation" subtitle="Open seats on pure merit, then each reserved quota from its own category; unfilled reserved seats go back to merit. Existing decisions are kept."
          right={can.edit && <button className="px-btn gold ex-btn-sm" onClick={propose}>{admitted.length ? 'Fill vacancies' : 'Propose allocation'}</button>}>
          {!seats ? (
            <div style={{ fontSize: 13, color: PX.sub }}>No seat count set. <button className="px-btn ghost ex-btn-sm" onClick={() => go('exams')}>Set seats & quotas</button></div>
          ) : (
            <table className="px-table"><thead><tr><th>Quota</th><th>Seats</th><th>Filled</th><th /></tr></thead>
              <tbody>{quotaRows.map(([qn, n]) => {
                const f = admitted.filter(r => (r.quota || 'Open') === qn).length
                return <tr key={qn}><td><b>{qn}</b></td><td>{n}</td><td>{f}</td><td>{f >= n ? <Chip tone="ok">full</Chip> : <Chip tone="warn">{n - f} vacant</Chip>}</td></tr>
              })}</tbody></table>
          )}
        </PremiumCard>
        <PremiumCard title="Offer letters">
          <div style={{ display: 'grid', gap: 10 }}>
            <Field label="Report by"><input type="date" className="px-input" value={reportBy} onChange={e => setReportBy(e.target.value)} /></Field>
            <Field label="Admission fee (₹)"><input className="px-input" value={fee} onChange={e => setFee(e.target.value)} placeholder="optional" /></Field>
            <button className="px-btn" disabled={!admitted.length} onClick={() => offers(admitted)}><PIcon.print size={14} />Print {admitted.length} offer letters</button>
          </div>
        </PremiumCard>
      </div>

      <PremiumCard title="Admission decisions" subtitle={`${list.length} candidates`}
        right={<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button className="px-btn ghost ex-btn-sm" onClick={() => printList(admitted, 'ADMISSION LIST')}><PIcon.print size={13} />Admitted</button>
          <button className="px-btn ghost ex-btn-sm" onClick={() => printList(waitlist, 'WAITLIST')}><PIcon.print size={13} />Waitlist</button>
          <button className="px-btn ghost ex-btn-sm" onClick={() => downloadText(`${exam.exam_name}-admissions.csv`, toCSV(admitted, [
            { label: 'Rank', key: 'rank' }, { label: 'Roll no', get: r => hallTicketNo(exam.id, r.roll_number) }, { label: 'Name', key: 'student_name' },
            { label: 'Father', key: 'father_name' }, { label: 'DOB', key: 'dob' }, { label: 'Category', key: 'category' }, { label: 'Quota', key: 'quota' },
            { label: 'Phone', key: 'phone' }, { label: 'Address', key: 'address' }, { label: 'Total', key: 'total' },
          ]))}><PIcon.download size={13} />CSV</button>
        </div>}>
        <div className="ex-bar">
          {[['', 'All'], ['Admitted', 'Admitted'], ['Waitlist', 'Waitlist'], ['Pass', 'Undecided'], ['Rejected', 'Declined']].map(([v, l]) => (
            <button key={l} className={'px-btn ex-btn-sm' + (view === v ? '' : ' ghost')} onClick={() => setView(v)}>{l}</button>
          ))}
        </div>
        <div className="ex-tablewrap" style={{ marginTop: 0 }}>
          <table className="px-table">
            <thead><tr><th>Rank</th><th>Candidate</th><th>Category</th><th>Total</th><th>Decision</th><th /></tr></thead>
            <tbody>{list.map(r => (
              <tr key={r.id}>
                <td><b>{r.rank}</b><div style={{ fontSize: 11, color: PX.faint }}>{r.category || 'General'} {r.category_rank}</div></td>
                <td><b>{r.student_name}</b><div style={{ fontSize: 11.5, color: PX.faint }}>{hallTicketNo(exam.id, r.roll_number)} · {r.phone || 'no phone'}</div></td>
                <td>{r.category || 'General'}</td>
                <td><b>{r.total}</b></td>
                <td><StatusChip s={r.result_status} />{r.result_status === 'Admitted' && <span style={{ fontSize: 11.5, color: PX.sub }}> · {r.quota || 'Open'}</span>}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{can.edit && <>
                  <button className="px-btn ghost ex-btn-sm" disabled={r.result_status === 'Admitted'} onClick={() => decide(r, 'Admitted')}>Admit</button>{' '}
                  <button className="px-btn ghost ex-btn-sm" disabled={r.result_status === 'Waitlist'} onClick={() => decide(r, 'Waitlist')}>Waitlist</button>{' '}
                  <button className="px-btn ghost ex-btn-sm" style={{ color: PX.bad }} disabled={r.result_status === 'Rejected'} onClick={() => decide(r, 'Rejected')}>Decline</button>{' '}
                </>}
                  {r.result_status === 'Admitted' && <button className="px-btn ghost ex-btn-sm" onClick={() => offers([r])} aria-label="Offer letter"><PIcon.print size={13} /></button>}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </PremiumCard>

      {proposal && (
        <Modal title="Proposed allocation" subtitle={`${seats} seats · ${qualified.length} qualified`} onClose={() => setProposal(null)} width={760}
          footer={<><button className="px-btn ghost" onClick={() => setProposal(null)}>Cancel</button><button className="px-btn gold" disabled={busy || !proposal.changes.length} onClick={apply}>{busy ? 'Applying…' : `Apply ${proposal.changes.length} changes`}</button></>}>
          {proposal.changes.length === 0 ? <Empty icon="✓" title="Nothing to change">Every seat is already filled as merit and quotas require.</Empty> : (
            <table className="px-table"><thead><tr><th>Rank</th><th>Candidate</th><th>Category</th><th>Now</th><th>Proposed</th></tr></thead>
              <tbody>{proposal.changes.map(({ r, to }) => (
                <tr key={r.id}><td>{r.rank}</td><td><b>{r.student_name}</b></td><td>{r.category || 'General'}</td><td><StatusChip s={r.result_status} /></td>
                  <td><StatusChip s={to.status} /> <span style={{ fontSize: 12, color: PX.sub }}>{to.status === 'Admitted' ? to.quota : `#${to.waitlist}`}</span></td></tr>
              ))}</tbody></table>
          )}
        </Modal>
      )}
      <div style={{ fontSize: 11.5, color: PX.faint }}>Declining an admitted candidate frees the seat; "Fill vacancies" then offers it to the next eligible candidate on the waitlist. Exam date {fmtDate(exam.exam_date)}.</div>
    </div>
  )
}
