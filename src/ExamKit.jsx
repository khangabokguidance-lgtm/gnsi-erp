// ExamKit.jsx — the "Exam kit" tab of Mission Sainik and Mission Foundation.
// Pick a test from the mission's test series (Pre Mock / Mega Mock, or the Foundation weekly tests), then load it into the
// roll chart or OMR sheets: the test's name, date, time, sections and marks, plus the live student list from Students.
// The tools are self-contained pages in /public/exam-kit, framed like Design Studio's makers; each keeps its work in this browser,
// and the OMR page keeps a separate answer key and marks for every test.
import { useEffect, useMemo, useRef, useState } from 'react'
import { PremiumCard, PX } from './premiumUI'
import { Pill } from './MissionSainikUI'
import { useSainikRoster } from './useSainikRoster'
import { TESTS, MOCK_TESTS, SUBJECTS as SAINIK_SUBJECTS, MOCK_SECTIONS } from './missionSainikData'
import { SUBJECTS as FOUNDATION_SUBJECTS } from './missionFoundationData'
import {
  EXAM_KIT_BASE, EXAM_KIT_TOOLS, sainikKitRows, foundationKitRows, kitCsv, kitCountLine,
  sainikSeries, foundationSeries, pickTest, examMessage, durationText,
} from './lib/examKit'

const ACCENT = { sainik: PX.navy, foundation: '#1f5f2a' }
const NAME = { sainik: 'Mission Sainik 2027', foundation: 'Mission Foundation' }
const localToday = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) }
const shortDate = iso => { const d = new Date(iso + 'T00:00:00'); return isNaN(d) ? '' : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) }

function KitFrame({ mission, rows, loading, series, kinds, kind, setKind, extra, isMobile }) {
  const tools = EXAM_KIT_TOOLS[mission]
  const accent = ACCENT[mission]
  const today = localToday()
  const store = 'examkit-' + mission
  const [tool, setTool] = useState(() => { try { const t = localStorage.getItem(store + '-tool'); if (tools.some(x => x.id === t)) return t } catch { /* private mode */ } return tools[0].id })
  const [opened, setOpened] = useState(() => new Set([tool]))   // frames stay mounted once opened, so switching tools keeps your place
  const [pick, setPick] = useState('')                          // the chosen test's tag ('' = today's or the next one)
  const [status, setStatus] = useState('')
  const frames = useRef({})
  const strip = useRef(null)
  const cur = tools.find(t => t.id === tool) || tools[0]
  const test = series.find(t => t.tag === pick) || pickTest(series, today)
  const csv = useMemo(() => kitCsv(rows || []), [rows])

  useEffect(() => { try { localStorage.setItem(store + '-tool', tool) } catch { /* private mode */ } }, [store, tool])
  // keep the chosen test in view in the strip
  useEffect(() => { strip.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView?.({ block: 'nearest', inline: 'center' }) }, [test?.tag, tool])
  useEffect(() => {
    const got = {}
    const onMsg = e => {
      if (e.origin !== window.location.origin) return
      if (e.data?.type === 'gnsi-exam-ok') got.title = e.data.title
      else if (e.data?.type === 'gnsi-roster-ok') got.n = e.data.n
      else return
      setStatus([got.title, got.n != null && `${got.n} students`].filter(Boolean).join(' and ') + ` ${got.title && got.n != null ? 'are' : 'is'} in the ${cur.label.toLowerCase()}.`)
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [cur.label])

  const open = id => { setTool(id); setStatus(''); setOpened(s => (s.has(id) ? s : new Set([...s, id]))) }
  const load = () => {
    const w = frames.current[cur.id]?.contentWindow
    if (!w) return
    if (test) w.postMessage(examMessage(test), window.location.origin)
    if (rows?.length) w.postMessage({ type: 'gnsi-roster', csv }, window.location.origin)
    setStatus('Loading…')
  }

  const tab = on => ({
    minHeight: 40, padding: '0 14px', borderRadius: 11, cursor: 'pointer', fontWeight: 700, fontSize: 13.5, fontFamily: PX.sans,
    border: `1px solid ${on ? accent : PX.line2}`, background: on ? accent : '#fff', color: on ? '#fff' : PX.ink2,
  })

  const toolTabs = (
    <div role="tablist" aria-label="Exam kit tools" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {tools.map(t => <button key={t.id} type="button" role="tab" aria-selected={t.id === tool} style={tab(t.id === tool)} onClick={() => open(t.id)}>{t.label}</button>)}
    </div>
  )

  return (
    <PremiumCard title="Exam kit" subtitle={`${NAME[mission]} · ${cur.hint}`} right={toolTabs} bodyStyle={{ padding: 0 }}>
      {cur.roster ? (
        <div style={{ padding: isMobile ? 12 : '14px 20px', background: PX.tint, borderBottom: `1px solid ${PX.line}`, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: PX.sub, letterSpacing: '.04em' }}>TEST SERIES</div>
            {kinds && <div role="tablist" aria-label="Series" style={{ display: 'flex', gap: 4, background: '#fff', border: `1px solid ${PX.line2}`, borderRadius: 11, padding: 3 }}>
              {kinds.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)}
                style={{ border: 0, borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: kind === k ? accent : 'transparent', color: kind === k ? '#fff' : PX.ink2 }}>{l}</button>)}
            </div>}
            {!series.length && <span style={{ fontSize: 13.5, color: PX.sub }}>No tests in the schedule yet. Add them in Schedule &amp; syllabus.</span>}
          </div>

          {!!series.length && <div ref={strip} style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollSnapType: 'x proximity' }}>
            {series.map(t => {
              const on = t.tag === test?.tag, done = t.date < today, next = t === pickTest(series, today)
              return (
                <button key={t.tag} type="button" aria-pressed={on} onClick={() => { setPick(t.tag); setStatus('') }}
                  style={{ flex: 'none', scrollSnapAlign: 'center', minWidth: 104, textAlign: 'left', padding: '8px 12px', borderRadius: 12, cursor: 'pointer', fontFamily: PX.sans,
                    border: `1.5px solid ${on ? accent : next ? PX.gold : PX.line2}`, background: on ? accent : '#fff', color: on ? '#fff' : done ? PX.faint : PX.ink }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{t.id}</div>
                  <div style={{ fontSize: 12, opacity: on ? 0.85 : 1 }}>{shortDate(t.date)}{next && !on ? ' · next' : ''}</div>
                </button>
              )
            })}
          </div>}

          {test && <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
            <div style={{ marginRight: 'auto', minWidth: 0 }}>
              <div style={{ fontFamily: PX.serif, fontWeight: 600, fontSize: 19, color: PX.ink }}>{test.title}</div>
              <div style={{ fontSize: 13, color: PX.sub, marginTop: 2 }}>{test.sections.map(s => `${s.name} ${s.q}×${s.each}`).join(' · ')}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                <Pill tone="info">{shortDate(test.date)}</Pill>
                <Pill tone="mute">{test.q} questions</Pill>
                <Pill tone="gold">{test.marks} marks</Pill>
                {test.minutes ? <Pill tone="mute">{durationText(test.minutes)}</Pill> : <Pill tone="warn" title="Set the time in the tool">Time not set</Pill>}
                <Pill tone={rows?.length ? 'ok' : 'warn'}>{loading ? 'Loading students…' : rows?.length ? kitCountLine(rows) : 'No students found'}</Pill>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              {extra}
              <button type="button" className="px-btn" onClick={load} style={{ background: accent }}>Load {test.id} {rows?.length ? `+ ${rows.length} students` : ''}</button>
            </div>
          </div>}
          {status && <div style={{ fontSize: 13.5, color: PX.ok, fontWeight: 700 }}>{status}</div>}
        </div>
      ) : (
        <div style={{ padding: isMobile ? 12 : '12px 20px', background: PX.tint, borderBottom: `1px solid ${PX.line}`, fontSize: 13.5, color: PX.sub }}>
          Edit with ✎ Edit and keep your changes with 💾 Save HTML. Print the Udaan and Pragati papers from the booklet's own bar.
        </div>
      )}

      <div style={{ position: 'relative', height: isMobile ? 'calc(100vh - 150px)' : 'calc(100vh - 200px)', minHeight: 560, background: '#f4f2ec' }}>
        {tools.filter(t => opened.has(t.id)).map(t => (
          <iframe key={t.id} ref={el => { frames.current[t.id] = el }} title={`${NAME[mission]} · ${t.label}`} src={`${EXAM_KIT_BASE}/${t.file}`}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, display: t.id === tool ? 'block' : 'none' }} />
        ))}
      </div>
      <div style={{ padding: '10px 20px', display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 12.5, color: PX.sub, borderTop: `1px solid ${PX.line}` }}>
        <span style={{ marginRight: 'auto' }}>Work is kept in this browser on this device. Print with the tool's own Print button: A4, scale 100%, background graphics on.</span>
        <a href={`${EXAM_KIT_BASE}/${cur.file}`} target="_blank" rel="noreferrer" style={{ color: accent, fontWeight: 700 }}>Open in new tab ↗</a>
      </div>
    </PremiumCard>
  )
}

function SainikKit({ isMobile }) {
  const roster = useSainikRoster({ photos: false })
  const [includeCombined, setIncludeCombined] = useState(false)
  const [kind, setKind] = useState(() => { try { return localStorage.getItem('examkit-sainik-kind') === 'mega' ? 'mega' : 'pre' } catch { return 'pre' } })
  useEffect(() => { try { localStorage.setItem('examkit-sainik-kind', kind) } catch { /* private mode */ } }, [kind])
  const rows = useMemo(() => (roster ? sainikKitRows(roster, { includeCombined }) : null), [roster, includeCombined])
  const series = useMemo(() => sainikSeries(kind, kind === 'mega' ? MOCK_TESTS : TESTS, { subjects: SAINIK_SUBJECTS, mockSections: MOCK_SECTIONS }), [kind])
  const extra = (
    <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 13.5, color: PX.ink2, cursor: 'pointer' }}>
      <input type="checkbox" checked={includeCombined} onChange={e => setIncludeCombined(e.target.checked)} /> Combined course
    </label>
  )
  return <KitFrame mission="sainik" rows={rows} loading={!roster} series={series} kinds={[['pre', 'Pre Mock'], ['mega', 'Mega Mock']]} kind={kind} setKind={setKind} extra={extra} isMobile={isMobile} />
}

function FoundationKit({ students, tests, papersByTest, isMobile }) {
  const rows = useMemo(() => (students ? foundationKitRows(students) : null), [students])
  const series = useMemo(() => foundationSeries(tests, papersByTest, FOUNDATION_SUBJECTS), [tests, papersByTest])
  return <KitFrame mission="foundation" rows={rows} loading={!students} series={series} isMobile={isMobile} />
}

export default function ExamKit({ mission, students, tests, papersByTest, isMobile }) {
  return mission === 'sainik'
    ? <SainikKit isMobile={isMobile} />
    : <FoundationKit students={students} tests={tests || []} papersByTest={papersByTest || {}} isMobile={isMobile} />
}
