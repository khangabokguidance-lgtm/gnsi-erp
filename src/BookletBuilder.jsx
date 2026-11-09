// BookletBuilder.jsx — Question Bank → "Booklet Builder".
//
// Turns a chapter question file (.docx) into the GNSI premium booklet (navy
// and gold, Sir Moirangthem Himan Singh's design): cover, contents, questions
// sorted by type in two columns, answer key and worked solutions — the same
// as tools/booklet/gnsi_booklet.py, but in the browser. Settings files (.json)
// are the same as the Python program's, so one file works in both.
import { useMemo, useRef, useState } from 'react'
import { readChapterDocx, applyEdits, resolveGroups, buildBooklet, bookletFileName } from './lib/bookletBuilder'

const NAVY = '#1B2A4A', GOLD = '#B8892B', RULE = '#E5DCC7', INK = '#1F2937', MUTED = '#6B7280'
const LETTERS = ['A', 'B', 'C', 'D']
const card = { background: '#fff', border: `1px solid ${RULE}`, borderRadius: 18, boxShadow: '0 1px 2px rgba(27,42,74,.05), 0 16px 32px -26px rgba(27,42,74,.45)', padding: 18, marginBottom: 14 }
const label = { display: 'block', fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: MUTED, marginBottom: 5 }
const input = { width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 10, border: `1px solid ${RULE}`, fontSize: 13.5, fontFamily: 'inherit', color: INK, background: '#fff' }
const btn = (primary) => ({
  padding: '10px 16px', borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
  border: primary ? 'none' : `1px solid ${RULE}`, color: primary ? '#1A1406' : NAVY,
  background: primary ? 'linear-gradient(160deg,#D4AE58,#B8892B)' : '#fff',
  boxShadow: primary ? 'inset 0 1px 0 rgba(255,255,255,.45), 0 10px 18px -10px rgba(184,137,43,.9)' : 'none',
})
const h3 = { margin: '0 0 12px', fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 600, color: NAVY }

// "1, 2, 5-8" → [1, 2, 5, 6, 7, 8]
const parseNumbers = s => String(s || '').split(/[\s,]+/).flatMap(part => {
  const m = part.match(/^(\d+)\s*[-–]\s*(\d+)$/)
  if (m) { const a = +m[1], b = +m[2]; return a <= b && b - a < 500 ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : [] }
  return /^\d+$/.test(part) ? [+part] : []
})
const download = (blob, name) => {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}
const without = (obj, n) => { const o = { ...(obj || {}) }; delete o[n]; return o }

// Manipuri line: Bmei04 runs in the embedded BMEI04 font, the rest as is.
function MmLine({ runs, size = 15 }) {
  if (!runs?.length) return <span style={{ color: '#CBD5E1' }}>—</span>
  return <span>{runs.map(([t, isMm], i) => <span key={i} style={isMm ? { fontFamily: 'BMEI04', fontSize: size } : { fontSize: size - 2 }}>{t}</span>)}</span>
}

export default function BookletBuilder({ showToast }) {
  const [source, setSource] = useState(null)       // { Q, key }
  const [fileName, setFileName] = useState('')
  const [cfg, setCfg] = useState({ title: '', title_mm: '', label: 'Mathematics  ·  Chapter 1', groups: [] })
  const [columns, setColumns] = useState(2)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')
  const [open, setOpen] = useState(null)            // question being edited
  const docRef = useRef(null), jsonRef = useRef(null)
  const toast = (msg, color) => showToast ? showToast(msg, color) : null

  const Q = useMemo(() => (source ? applyEdits(source.Q, cfg) : {}), [source, cfg])
  const nums = useMemo(() => Object.keys(Q).map(Number).sort((a, b) => a - b), [Q])
  const groups = useMemo(() => (source ? resolveGroups(Q, cfg) : []), [source, Q, cfg])
  const answerOf = n => (cfg.answers?.[n] || source?.key?.[n] || '')
  const set = patch => setCfg(c => ({ ...c, ...patch }))

  const loadDocx = async file => {
    if (!file) return
    setBusy('Reading the chapter…'); setError('')
    try {
      const src = await readChapterDocx(file)
      setSource(src); setFileName(file.name)
      const base = file.name.replace(/\.docx$/i, '').replace(/^\d+[-_ ]*/, '').replace(/[_-]+/g, ' ').trim()
      setCfg(c => ({ ...c, source: file.name, title: c.title || base, output: c.output || '' }))
      toast(`Read ${Object.keys(src.Q).length} questions${Object.keys(src.key).length ? ` and ${Object.keys(src.key).length} answers` : ''}.`)
    } catch (e) {
      setError(e.message || String(e))
    }
    setBusy('')
  }
  const loadJson = async file => {
    if (!file) return
    try {
      const data = JSON.parse(await file.text())
      if (typeof data !== 'object' || Array.isArray(data)) throw new Error('not a settings object')
      setCfg(c => ({ ...c, ...data, groups: data.groups || c.groups }))
      toast(`Loaded settings from ${file.name}.`)
    } catch (e) {
      setError(`Could not read ${file.name}: ${e.message}`)
    }
  }
  const saveJson = () => {
    const out = { ...cfg, source: cfg.source || fileName, output: bookletFileName(cfg) }
    download(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }), `${bookletFileName(cfg).replace(/\.docx$/i, '')}.json`)
  }
  const build = async () => {
    setBusy('Building the booklet…'); setError('')
    try {
      const r = await buildBooklet(source, cfg, { columns })
      download(r.blob, bookletFileName(cfg))
      toast(`Booklet ready: ${r.count} questions in ${r.groups.length} types.` + (r.noAnswer.length ? ` No answer for: ${r.noAnswer.join(', ')}` : ''), r.noAnswer.length ? '#b45309' : undefined)
    } catch (e) {
      setError('Could not build the booklet: ' + (e.message || e))
    }
    setBusy('')
  }

  // ── per-question edits, stored the same way as the settings file ──
  const setEnglish = (n, text) => setCfg(c => {
    const orig = source.Q[n].eng
    return { ...c, set_english: text === orig ? without(c.set_english, n) : { ...(c.set_english || {}), [n]: text }, replace_english: without(c.replace_english, n) }
  })
  const setOption = (n, i, text) => setCfg(c => {
    const now = applyEdits({ [n]: source.Q[n] }, { ...c, groups: undefined })[n].opts
    const opts = LETTERS.map((_, k) => (k === i ? text : now[k] ?? ''))
    const same = opts.every((o, k) => o === (source.Q[n].opts[k] ?? ''))
    return { ...c, set_options: same ? without(c.set_options, n) : { ...(c.set_options || {}), [n]: opts }, set_option: without(c.set_option, n) }
  })
  const setAnswer = (n, a) => setCfg(c => ({ ...c, answers: !a || a === source.key[n] ? without(c.answers, n) : { ...(c.answers || {}), [n]: a } }))
  const setSolution = (n, s) => setCfg(c => ({ ...c, solutions: s ? { ...(c.solutions || {}), [n]: s } : without(c.solutions, n) }))

  // ── types ──
  const cfgGroups = cfg.groups || []
  const setGroup = (i, patch) => set({ groups: cfgGroups.map((g, k) => (k === i ? { ...g, ...patch } : g)) })
  const addGroup = () => set({ groups: [...cfgGroups, { code: String.fromCharCode(65 + cfgGroups.length), name: '', questions: [] }] })
  const removeGroup = i => set({ groups: cfgGroups.filter((_, k) => k !== i).map((g, k) => ({ ...g, code: String.fromCharCode(65 + k) })) })
  const moveGroup = (i, d) => {
    const g = [...cfgGroups], j = i + d
    if (j < 0 || j >= g.length) return
    ;[g[i], g[j]] = [g[j], g[i]]
    set({ groups: g.map((x, k) => ({ ...x, code: String.fromCharCode(65 + k) })) })
  }
  const listed = new Set(cfgGroups.flatMap(g => (g.questions || []).map(Number)))
  const unlisted = nums.filter(n => !listed.has(n))

  const shown = nums.filter(n => {
    const t = filter.trim().toLowerCase()
    if (!t) return true
    if (t === 'no answer') return !answerOf(n)
    return String(n) === t || Q[n].eng.toLowerCase().includes(t)
  })
  const noAnswer = nums.filter(n => !answerOf(n))
  const solCount = Object.values(cfg.solutions || {}).filter(Boolean).length

  return (
    <div>
      {/* Header */}
      <div style={{ position: 'relative', overflow: 'hidden', color: '#fff', borderRadius: 22, padding: '22px 24px', marginBottom: 14,
        background: `radial-gradient(120% 160% at 100% 0%, #2B4677 0%, ${NAVY} 60%, #111C33 100%)`, boxShadow: '0 22px 40px -24px rgba(17,28,51,.85)' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 3, background: `linear-gradient(90deg,${GOLD},#E2C57E,${GOLD})` }} />
        <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.18em', textTransform: 'uppercase', color: '#E2C57E' }}>GNSI · Premium booklet builder</div>
        <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 26, fontWeight: 600, marginTop: 4 }}>Chapter file → premium booklet</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,.75)', marginTop: 6, maxWidth: 640, lineHeight: 1.5 }}>
          Cover, contents, questions sorted by type in two columns, answer key and worked solutions — English in Calibri/Cambria,
          Manipuri in Bmei04 (embedded, so it shows on any computer). Design by Sir Moirangthem Himan Singh, Founder.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
          <button style={btn(true)} onClick={() => docRef.current?.click()} disabled={!!busy}>📄 {source ? 'Change chapter file' : 'Open chapter file (.docx)'}</button>
          <button style={{ ...btn(false), background: 'rgba(255,255,255,.1)', color: '#fff', border: '1px solid rgba(255,255,255,.25)' }} onClick={() => jsonRef.current?.click()}>⚙ Load settings (.json)</button>
          {source && <button style={{ ...btn(false), background: 'rgba(255,255,255,.1)', color: '#fff', border: '1px solid rgba(255,255,255,.25)' }} onClick={saveJson}>💾 Save settings</button>}
        </div>
        <input ref={docRef} type="file" accept=".docx" hidden onChange={e => { loadDocx(e.target.files?.[0]); e.target.value = '' }} />
        <input ref={jsonRef} type="file" accept=".json,application/json" hidden onChange={e => { loadJson(e.target.files?.[0]); e.target.value = '' }} />
      </div>

      {error && <div role="alert" style={{ ...card, borderColor: '#FCA5A5', background: '#FEF2F2', color: '#B91C1C', fontSize: 13 }}>{error}</div>}
      {busy && <div style={{ ...card, textAlign: 'center', color: NAVY, fontWeight: 700 }}>{busy}</div>}

      {!source ? (
        <div style={{ ...card, cursor: 'pointer', textAlign: 'center', padding: '36px 18px', borderStyle: 'dashed', borderWidth: 2 }}
          onClick={() => docRef.current?.click()}
          onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); loadDocx(e.dataTransfer.files?.[0]) }}>
          <div style={{ fontSize: 34 }}>📘</div>
          <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 19, color: NAVY, marginTop: 6 }}>Drop a chapter question file here</div>
          <div style={{ fontSize: 12.5, color: MUTED, marginTop: 8, lineHeight: 1.7 }}>
            The file must look like your chapter files:<br />
            <code>Q1. English question</code> (bold) · Manipuri line (Bmei04) · <code>(A) … (B) … (C) … (D) …</code><br />
            Answer key at the end is optional: <code>Q1. B   Q2. C …</code>
          </div>
        </div>
      ) : (<>
        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 14 }}>
          {[
            ['Questions', nums.length, fileName],
            ['Types', groups.length, groups.map(g => g.code).join(' · ')],
            ['Answers', `${nums.length - noAnswer.length}/${nums.length}`, noAnswer.length ? `${noAnswer.length} missing` : 'all set'],
            ['Solutions', solCount, 'worked solutions'],
          ].map(([l, v, sub]) => (
            <div key={l} style={{ ...card, marginBottom: 0, padding: '12px 14px' }}>
              <div style={label}>{l}</div>
              <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 700, color: l === 'Answers' && noAnswer.length ? '#B45309' : NAVY }}>{v}</div>
              <div style={{ fontSize: 11.5, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* Details */}
        <div style={card}>
          <h3 style={h3}>Booklet details</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <label><span style={label}>Title</span><input style={input} value={cfg.title || ''} onChange={e => set({ title: e.target.value })} placeholder="Factors and Multiples" /></label>
            <label><span style={label}>Small line above the title</span><input style={input} value={cfg.label || ''} onChange={e => set({ label: e.target.value })} placeholder="Mathematics  ·  Chapter 4" /></label>
            <label>
              <span style={label}>Manipuri title (Bmei04 keys)</span>
              <input style={input} value={cfg.title_mm || ''} onChange={e => set({ title_mm: e.target.value })} placeholder="feKtr AmsuZ mLtipL" />
              {cfg.title_mm && <div style={{ fontFamily: 'BMEI04', fontSize: 20, color: NAVY, marginTop: 4 }}>{cfg.title_mm}</div>}
            </label>
            <label><span style={label}>File name</span><input style={input} value={cfg.output || ''} onChange={e => set({ output: e.target.value })} placeholder={bookletFileName({ title: cfg.title })} /></label>
            <div>
              <span style={label}>Question pages</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {[[2, 'Two columns'], [1, 'One column']].map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setColumns(v)} aria-pressed={columns === v}
                    style={{ ...btn(false), flex: 1, padding: '9px 10px', background: columns === v ? NAVY : '#fff', color: columns === v ? '#fff' : NAVY }}>{l}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Types */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <h3 style={{ ...h3, margin: 0 }}>Question types</h3>
            <button style={btn(false)} onClick={addGroup}>＋ Add type</button>
          </div>
          <div style={{ fontSize: 12, color: MUTED, margin: '6px 0 12px' }}>
            Question numbers are the numbers in the chapter file (e.g. <code>1, 2, 15, 45-51</code>). Any question not listed goes in "Other Questions". With no types, the original order is kept.
          </div>
          {cfgGroups.map((g, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '38px minmax(140px, 1fr) minmax(160px, 2fr) auto', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: NAVY, color: '#fff', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: `4px solid ${GOLD}` }}>{g.code}</span>
              <input style={input} value={g.name} onChange={e => setGroup(i, { name: e.target.value })} placeholder="Prime Factorisation" />
              <input style={input} defaultValue={(g.questions || []).join(', ')} key={`${i}-${(g.questions || []).join(',')}`}
                onBlur={e => setGroup(i, { questions: parseNumbers(e.target.value).filter(n => source.Q[n]) })} placeholder="1, 2, 15, 17" />
              <div style={{ display: 'flex', gap: 4 }}>
                <button title="Move up" style={{ ...btn(false), padding: '8px 10px' }} onClick={() => moveGroup(i, -1)}>↑</button>
                <button title="Move down" style={{ ...btn(false), padding: '8px 10px' }} onClick={() => moveGroup(i, 1)}>↓</button>
                <button title="Remove" style={{ ...btn(false), padding: '8px 10px', color: '#B91C1C' }} onClick={() => removeGroup(i)}>✕</button>
              </div>
            </div>
          ))}
          {cfgGroups.length > 0 && unlisted.length > 0 && (
            <div style={{ fontSize: 12.5, color: '#92400E', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '8px 10px', marginTop: 6 }}>
              Not in any type yet (will go in "Other Questions"): {unlisted.join(', ')}
            </div>
          )}
        </div>

        {/* Questions */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <h3 style={{ ...h3, margin: 0 }}>Questions, answers &amp; solutions</h3>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input style={{ ...input, width: 220 }} value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search, a number, or “no answer”" />
              {noAnswer.length > 0 && <button style={{ ...btn(false), color: '#B45309' }} onClick={() => setFilter('no answer')}>{noAnswer.length} without answer</button>}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {shown.map(n => {
              const q = Q[n], a = answerOf(n), isOpen = open === n
              const edited = cfg.set_english?.[n] || cfg.replace_english?.[n] || cfg.set_options?.[n] || cfg.set_option?.[n] || cfg.replace_manipuri?.[n]
              return (
                <div key={n} style={{ border: `1px solid ${isOpen ? GOLD : '#EFE8D8'}`, borderRadius: 14, background: isOpen ? '#FFFDF7' : '#FCFBF7', padding: '10px 12px' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ minWidth: 34, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, color: NAVY }}>Q{n}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: INK }}>{q.eng}{edited && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, color: GOLD }}>EDITED</span>}</div>
                      <div style={{ marginTop: 2, color: '#333' }}><MmLine runs={q.mm} /></div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 16px', fontSize: 12.5, marginTop: 4, color: INK }}>
                        {q.opts.map((o, k) => <span key={k} style={{ fontWeight: a === LETTERS[k] ? 800 : 400, color: a === LETTERS[k] ? '#15803D' : INK }}><b style={{ color: GOLD }}>({LETTERS[k]})</b> {o}</span>)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      {LETTERS.map(L => (
                        <button key={L} type="button" onClick={() => setAnswer(n, a === L ? '' : L)} aria-pressed={a === L} title={`Answer ${L}`}
                          style={{ width: 30, height: 30, borderRadius: 9, cursor: 'pointer', fontWeight: 800, fontFamily: 'inherit',
                            border: `1px solid ${a === L ? '#15803D' : RULE}`, background: a === L ? '#15803D' : '#fff', color: a === L ? '#fff' : NAVY }}>{L}</button>
                      ))}
                      <button type="button" onClick={() => setOpen(isOpen ? null : n)} style={{ ...btn(false), padding: '6px 10px', marginLeft: 4 }}>{isOpen ? 'Done' : 'Edit'}</button>
                    </div>
                  </div>
                  <input style={{ ...input, marginTop: 8, padding: '7px 10px', fontSize: 12.5, background: '#fff' }} value={cfg.solutions?.[n] || ''}
                    onChange={e => setSolution(n, e.target.value)} placeholder="Worked solution (one line), e.g. 360 = 2³ × 3² × 5" />
                  {isOpen && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${RULE}`, display: 'grid', gap: 8 }}>
                      <label><span style={label}>English question</span>
                        <textarea style={{ ...input, minHeight: 56 }} value={q.eng} onChange={e => setEnglish(n, e.target.value)} /></label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
                        {LETTERS.map((L, k) => (
                          <label key={L}><span style={label}>Option {L}</span>
                            <input style={input} value={q.opts[k] ?? ''} onChange={e => setOption(n, k, e.target.value)} /></label>
                        ))}
                      </div>
                      <div style={{ fontSize: 11.5, color: MUTED }}>The Manipuri line is kept from the chapter file; fix it there, or with "replace_manipuri" in the settings file.</div>
                    </div>
                  )}
                </div>
              )
            })}
            {!shown.length && <div style={{ textAlign: 'center', color: MUTED, padding: 16, fontSize: 13 }}>No question matches.</div>}
          </div>
        </div>

        {/* Build */}
        <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', position: 'sticky', bottom: 10, zIndex: 5 }}>
          <div style={{ fontSize: 13, color: INK }}>
            <b>{bookletFileName(cfg)}</b> · {nums.length} questions · {groups.length} types · {columns === 2 ? 'two columns' : 'one column'}
            {noAnswer.length > 0 && <span style={{ color: '#B45309' }}> · {noAnswer.length} without answer</span>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btn(false)} onClick={saveJson}>💾 Save settings</button>
            <button style={btn(true)} onClick={build} disabled={!!busy || !nums.length}>📘 Download booklet (.docx)</button>
          </div>
        </div>
      </>)}
    </div>
  )
}
