// ExamKit.jsx — the "Exam kit" tab of Mission Sainik and Mission Foundation.
// The roll chart, OMR sheets and (Foundation) question booklet are self-contained pages in /public/exam-kit, shown in a frame
// the same way Design Studio shows its makers. Each page keeps its own work in this browser; the ERP only sends it the live
// student list when you press "Send students from ERP" (the page then replaces its list with these students).
import { useEffect, useMemo, useRef, useState } from 'react'
import { PX } from './premiumUI'
import { useSainikRoster } from './useSainikRoster'
import { EXAM_KIT_BASE, EXAM_KIT_TOOLS, sainikKitRows, foundationKitRows, kitCsv, kitCountLine } from './lib/examKit'

const THEME = {
  sainik: { accent: '#0A1224', accentInk: '#fff', gold: '#b8892f', name: 'Mission Sainik 2027' },
  foundation: { accent: '#1f5f2a', accentInk: '#fff', gold: '#3a9d46', name: 'Mission Foundation' },
}

function KitFrame({ mission, rows, loading, includeCombined, setIncludeCombined, isMobile }) {
  const tools = EXAM_KIT_TOOLS[mission]
  const th = THEME[mission]
  const key = 'examkit-' + mission + '-tool'
  const [tool, setTool] = useState(() => { try { const t = localStorage.getItem(key); if (tools.some(x => x.id === t)) return t } catch { /* private mode */ } return tools[0].id })
  const [opened, setOpened] = useState(() => new Set([tool]))   // frames stay mounted once opened, so switching tools keeps your place
  const [status, setStatus] = useState('')
  const frames = useRef({})
  const cur = tools.find(t => t.id === tool) || tools[0]
  const csv = useMemo(() => kitCsv(rows || []), [rows])

  useEffect(() => { try { localStorage.setItem(key, tool) } catch { /* private mode */ } }, [key, tool])
  useEffect(() => {
    const onMsg = e => {
      if (e.origin !== window.location.origin || e.data?.type !== 'gnsi-roster-ok') return
      setStatus(`${e.data.n} students are now in the ${cur.label.toLowerCase()}.`)
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [cur.label])

  const open = id => { setTool(id); setStatus(''); setOpened(s => (s.has(id) ? s : new Set([...s, id]))) }
  const send = () => {
    const w = frames.current[cur.id]?.contentWindow
    if (!w || !rows?.length) return
    w.postMessage({ type: 'gnsi-roster', csv }, window.location.origin)
    setStatus('Sending ' + rows.length + ' students…')
  }

  const btn = on => ({
    minHeight: 40, padding: '0 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14, fontFamily: PX.sans,
    border: `1px solid ${on ? th.accent : PX.line2}`, background: on ? th.accent : '#fff', color: on ? th.accentInk : PX.ink,
  })

  return (
    <div style={{ background: '#fff', border: `1px solid ${PX.line}`, borderRadius: 14, overflow: 'hidden', fontFamily: PX.sans }}>
      <div style={{ padding: isMobile ? 12 : '14px 18px', borderBottom: `3px solid ${th.gold}`, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <div style={{ marginRight: 'auto' }}>
          <div style={{ fontFamily: PX.serif, fontWeight: 600, fontSize: 20, color: PX.ink }}>Exam kit</div>
          <div style={{ fontSize: 13, color: PX.sub }}>{th.name} · {cur.hint}</div>
        </div>
        <div role="tablist" aria-label="Exam kit tools" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {tools.map(t => <button key={t.id} type="button" role="tab" aria-selected={t.id === tool} style={btn(t.id === tool)} onClick={() => open(t.id)}>{t.label}</button>)}
        </div>
      </div>

      <div style={{ padding: isMobile ? '10px 12px' : '10px 18px', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', background: PX.tint, borderBottom: `1px solid ${PX.line}`, fontSize: 13.5 }}>
        {cur.roster ? <>
          <button type="button" onClick={send} disabled={!rows?.length} style={{ ...btn(true), background: th.gold, borderColor: th.gold, opacity: rows?.length ? 1 : 0.5 }}>
            Send {loading ? '…' : rows?.length || 0} students from ERP
          </button>
          {mission === 'sainik' && <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', color: PX.ink2, cursor: 'pointer' }}>
            <input type="checkbox" checked={includeCombined} onChange={e => setIncludeCombined(e.target.checked)} /> Include Combined course
          </label>}
          <span style={{ color: PX.sub }}>{loading ? 'Loading students…' : rows?.length ? kitCountLine(rows) : 'No students found in Students.'}</span>
        </> : <span style={{ color: PX.sub }}>Edit with ✎ Edit, then save with 💾 Save HTML. Print the papers from the booklet's own bar.</span>}
        {status && <span style={{ color: PX.ok, fontWeight: 600 }}>{status}</span>}
        <a href={`${EXAM_KIT_BASE}/${cur.file}`} target="_blank" rel="noreferrer" style={{ marginLeft: 'auto', color: th.accent, fontWeight: 600 }}>Open in new tab ↗</a>
      </div>

      <div style={{ position: 'relative', height: isMobile ? 'calc(100vh - 170px)' : 'calc(100vh - 230px)', minHeight: 560, background: '#f4f2ec' }}>
        {tools.filter(t => opened.has(t.id)).map(t => (
          <iframe key={t.id} ref={el => { frames.current[t.id] = el }} title={`${th.name} · ${t.label}`} src={`${EXAM_KIT_BASE}/${t.file}`}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, display: t.id === tool ? 'block' : 'none' }} />
        ))}
      </div>
      <div style={{ padding: '8px 18px', fontSize: 12.5, color: PX.sub }}>
        Each tool keeps its work in this browser on this device. To print, use the tool's own Print button (A4, scale 100%, background graphics on).
      </div>
    </div>
  )
}

function SainikKit({ isMobile }) {
  const roster = useSainikRoster({ photos: false })
  const [includeCombined, setIncludeCombined] = useState(false)
  const rows = useMemo(() => (roster ? sainikKitRows(roster, { includeCombined }) : null), [roster, includeCombined])
  return <KitFrame mission="sainik" rows={rows} loading={!roster} includeCombined={includeCombined} setIncludeCombined={setIncludeCombined} isMobile={isMobile} />
}

function FoundationKit({ students, isMobile }) {
  const rows = useMemo(() => (students ? foundationKitRows(students) : null), [students])
  return <KitFrame mission="foundation" rows={rows} loading={!students} isMobile={isMobile} />
}

export default function ExamKit({ mission, students, isMobile }) {
  return mission === 'sainik' ? <SainikKit isMobile={isMobile} /> : <FoundationKit students={students} isMobile={isMobile} />
}
