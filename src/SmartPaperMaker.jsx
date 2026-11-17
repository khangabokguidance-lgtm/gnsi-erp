// SmartPaperMaker.jsx — build a practice paper / worksheet from the Practice bank by blueprint:
// subjects, sets, chapters, number of questions and an Easy/Medium/Hard mix. Review, lock, swap, preview, print, Word,
// answer key, or send into Study material as notes.
import { useState, useEffect, useMemo, useCallback } from 'react'
import { PX } from './premiumUI'
import { supabase } from './supabase'
import { fetchAll } from './lib/missionSainikQuestions'
import { buildPaper, swapOne, levelOf, levelTargets } from './lib/paperMaker'
import { mathToHtml, mathPlain, setMathStacked } from './lib/mathText'
import { materialDocHtml, PRINT_DEFAULTS } from './lib/materialMarkup'
import { creatorOf } from './lib/staffLookup'
import { PrintDialog, CSS_ALL } from './MissionSainikMaterial'
import { questionsToNotes } from './lib/questionNotes'

const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* private mode */ } }
const LV = { Easy: ['#16a34a', '#e6f6ec'], Medium: ['#d97706', '#fff3dd'], Hard: ['#dc2626', '#fdeaea'] }
const MIXES = [['Balanced 40/40/20', { Easy: 40, Medium: 40, Hard: 20 }], ['Easy 70/30/0', { Easy: 70, Medium: 30, Hard: 0 }], ['Even thirds', { Easy: 34, Medium: 33, Hard: 33 }], ['Challenge 20/40/40', { Easy: 20, Medium: 40, Hard: 40 }]]
const DEFAULT = { title: '', count: 20, subjects: [], sets: [], topics: [], mix: { Easy: 40, Medium: 40, Hard: 20 }, figures: true, passages: true, avoidOn: true, marks: 1, minutes: 30, instructions: 'Read each question carefully. Choose the one correct answer. There is no negative marking.' }

export default function SmartPaperMaker({ subjects, institute, staff = [], userName = '', isMobile, onClose, onUseAsNotes, setMsg }) {
  const [bank, setBank] = useState(null), [err, setErr] = useState('')
  const [spec, setSpec] = useState(() => ({ ...DEFAULT, ...load('psm-spec', {}) }))
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e6) + 1)
  const [picked, setPicked] = useState([]), [res, setRes] = useState(null)
  const [locked, setLocked] = useState([]), [removed, setRemoved] = useState([])
  const [used, setUsed] = useState(() => load('psm-used', []))
  const [showAns, setShowAns] = useState(false), [step, setStep] = useState('plan')
  const [printFor, setPrintFor] = useState(null), [preview, setPreview] = useState(null)
  const [popts, setPopts] = useState(() => ({ ...PRINT_DEFAULTS, ...load('msm-print', {}) }))
  const [presets, setPresets] = useState(() => load('psm-presets', []))
  const instName = institute?.name || 'Guidance Navodaya & Sainik Institute'
  const me = useMemo(() => creatorOf(staff, userName), [staff, userName])
  const set = patch => setSpec(s => ({ ...s, ...patch }))
  useEffect(() => { save('psm-spec', spec) }, [spec])
  useEffect(() => { save('msm-print', popts) }, [popts])
  useEffect(() => { const k = e => { if (e.key === 'Escape' && !printFor && !preview) onClose() }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose, printFor, preview])

  useEffect(() => {
    let live = true
    ;(async () => {
      let { data, error } = await fetchAll(() => supabase.from('mission_sainik_questions').select('*').eq('series', 'practice').is('deleted_at', null).order('id'))
      if (error) ({ data, error } = await fetchAll(() => supabase.from('mission_sainik_questions').select('*').eq('series', 'practice').order('id')))
      if (!live) return
      if (error) setErr(error.message || 'Could not load the Practice bank'); else setBank(data || [])
    })()
    return () => { live = false }
  }, [])

  // ── what is available for this blueprint ──
  const subjectCounts = useMemo(() => { const c = {}; (bank || []).forEach(q => { c[q.section] = (c[q.section] || 0) + 1 }); return c }, [bank])
  const chosenSubjects = spec.subjects.length ? spec.subjects : Object.keys(subjectCounts)
  const inSubj = useMemo(() => (bank || []).filter(q => chosenSubjects.includes(q.section)), [bank, chosenSubjects.join('|')]) // eslint-disable-line react-hooks/exhaustive-deps
  const setOptions = useMemo(() => [...new Set(inSubj.map(q => q.test_no))].sort((a, b) => a - b), [inSubj])
  const topicCounts = useMemo(() => { const c = {}; inSubj.filter(q => !spec.sets.length || spec.sets.includes(q.test_no)).forEach(q => { const t = (q.topic || '').trim(); if (t) c[t] = (c[t] || 0) + 1 }); return Object.entries(c).sort((a, b) => b[1] - a[1]) }, [inSubj, spec.sets])
  const avail = useMemo(() => { const a = { Easy: 0, Medium: 0, Hard: 0 }; inSubj.filter(q => (!spec.sets.length || spec.sets.includes(q.test_no)) && (!spec.topics.length || spec.topics.includes((q.topic || '').trim()))).forEach(q => { a[levelOf(q)]++ }); return a }, [inSubj, spec.sets, spec.topics])
  const total = avail.Easy + avail.Medium + avail.Hard
  const targets = levelTargets(spec.count, spec.mix)

  const run = useCallback((newSeed, keepLocked = true) => {
    if (!bank) return
    const r = buildPaper(bank, { ...spec, avoidUsed: spec.avoidOn ? used : [] }, { seed: newSeed, locked: keepLocked ? locked.filter(id => picked.some(q => q.id === id)) : [], exclude: removed })
    setRes(r); setPicked(r.picked); setStep('paper')
  }, [bank, spec, used, locked, removed, picked])
  const generate = () => { const s = Math.floor(Math.random() * 1e6) + 1; setSeed(s); run(s) }
  const toggleLock = id => setLocked(l => (l.includes(id) ? l.filter(x => x !== id) : [...l, id]))
  const remove = q => { setRemoved(r => [...r, q.id]); setPicked(p => p.filter(x => x.id !== q.id)); setLocked(l => l.filter(x => x !== q.id)) }
  const swap = q => { const n = swapOne(bank, picked, q, { ...spec, avoidUsed: spec.avoidOn ? used : [] }, Math.floor(Math.random() * 1e6) + 1); if (!n) return setMsg?.('No other question with the same subject and level to swap in.'); setPicked(p => p.map(x => (x.id === q.id ? n : x))); setLocked(l => l.filter(x => x !== q.id)) }
  const markUsed = () => { const n = [...new Set([...picked.map(q => q.id), ...used])].slice(0, 600); setUsed(n); save('psm-used', n) }

  // ── the documents ──
  const title = spec.title.trim() || `${chosenSubjects.length === 1 ? chosenSubjects[0] : 'Mixed'} practice paper`
  const paperBody = (answers) => {
    const multi = [...new Set(picked.map(q => q.section))]
    let n = 1, out = `**Time:** ${spec.minutes} min · **Marks:** ${picked.length * (Number(spec.marks) || 1)} · **Questions:** ${picked.length}\n\n`
    if (spec.instructions.trim()) out += `> Note: ${spec.instructions.trim().replace(/\n+/g, ' ')}\n\n`
    for (const s of multi) {
      const rows = picked.filter(q => q.section === s)
      if (multi.length > 1) out += `## ${s}\n\n`
      out += questionsToNotes(rows, { answers, explain: false, start: n }) + '\n\n'; n += rows.length
    }
    return out.trim()
  }
  const keyBody = () => `| Q | Answer | Level | Topic |\n|---|---|---|---|\n${picked.map((q, i) => `| ${i + 1} | ${q.answer} | ${levelOf(q)} | ${(q.topic || '').trim() || '—'} |`).join('\n')}\n\n---\n\n${picked.filter(q => q.explanation).map(q => `**Q${picked.indexOf(q) + 1}.** ${String(q.explanation).replace(/\s*\n\s*/g, ' ')}`).join('\n\n')}`
  const docFor = key => ({ title: key ? `${title} — Answer key` : title, subject: chosenSubjects.length === 1 ? chosenSubjects[0] : 'Mixed subjects', test_no: 0, uploaded_by: userName, body: key ? keyBody() : paperBody(false) })
  const optsFor = o => ({ ...o, institute: instName, author: me })
  const doPrint = (m, o) => { const w = window.open('', '_blank'); if (!w) return setMsg?.('❌ Allow pop-ups to print'); w.document.write(materialDocHtml(m, { ...optsFor(o), auto: true }, CSS_ALL)); w.document.close(); markUsed() }
  const doWord = (m, o) => {
    setMathStacked(false); let html; try { html = materialDocHtml(m, { ...optsFor(o), columns: 1 }, CSS_ALL) } finally { setMathStacked(true) }
    const url = URL.createObjectURL(new Blob(['﻿' + html], { type: 'application/msword' }))
    const a = document.createElement('a'); a.href = url; a.download = m.title.replace(/[^\w-]+/g, '_') + '.doc'; a.click(); URL.revokeObjectURL(url); markUsed()
  }
  const savePreset = () => { const name = window.prompt('Name this blueprint (for example "Class 6 Maths mixed"):'); if (!name) return; const n = [{ name: name.trim(), spec: { ...spec, title: '' } }, ...presets.filter(p => p.name !== name.trim())].slice(0, 12); setPresets(n); save('psm-presets', n) }

  // ── look ──
  const chip = on => ({ padding: isMobile ? '8px 14px' : '6px 13px', borderRadius: 99, border: `1.5px solid ${on ? PX.gold : PX.line}`, background: on ? PX.goldBg : '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: PX.ink2, whiteSpace: 'nowrap', flexShrink: 0 })
  const field = { width: '100%', boxSizing: 'border-box', border: `1.5px solid ${PX.line}`, borderRadius: 13, padding: '10px 13px', fontSize: isMobile ? 16 : 14, fontFamily: 'inherit', background: '#fff', outline: 'none' }
  const card = { background: '#fff', border: '1px solid #ebe6da', borderRadius: 20, padding: 16, marginBottom: 14, boxShadow: '0 10px 28px -22px rgba(19,42,79,.45)' }
  const lab = { fontSize: 10.5, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: PX.sub, margin: '0 0 7px', display: 'block' }
  const strip = { display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', flexWrap: 'wrap' }
  const toggleIn = (key, v) => set({ [key]: spec[key].includes(v) ? spec[key].filter(x => x !== v) : [...spec[key], v] })
  const mixTotal = spec.mix.Easy + spec.mix.Medium + spec.mix.Hard

  const plan = (
    <div>
      {presets.length > 0 && <div style={card}><span style={lab}>Saved blueprints</span><div style={strip}>{presets.map(p => <button key={p.name} type="button" style={chip(false)} onClick={() => setSpec({ ...DEFAULT, ...p.spec })}>★ {p.name}</button>)}</div></div>}
      <div style={card}>
        <span style={lab}>Title</span>
        <input style={field} aria-label="Paper title" placeholder="e.g. Fractions practice paper — Class 6" value={spec.title} onChange={e => set({ title: e.target.value })} />
        <span style={{ ...lab, marginTop: 14 }}>Subjects {bank ? <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 600 }}>(none ticked = all)</span> : null}</span>
        <div style={strip}>{subjects.filter(x => subjectCounts[x.label]).map(x => <button key={x.key} type="button" style={chip(spec.subjects.includes(x.label))} aria-pressed={spec.subjects.includes(x.label)} onClick={() => { toggleIn('subjects', x.label); set({ sets: [], topics: [] }) }}>{x.short} <span style={{ opacity: .6 }}>{subjectCounts[x.label]}</span></button>)}</div>
        {setOptions.length > 1 && <><span style={{ ...lab, marginTop: 14 }}>Practice sets to draw from</span><div style={strip}>{setOptions.map(n => <button key={n} type="button" style={chip(spec.sets.includes(n))} onClick={() => { toggleIn('sets', n); set({ topics: [] }) }}>Set {n}</button>)}</div></>}
        {topicCounts.length > 0 && <><span style={{ ...lab, marginTop: 14 }}>Chapters / topics <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 600 }}>(none ticked = all)</span></span><div style={{ ...strip, maxHeight: 130, overflowY: 'auto' }}>{topicCounts.map(([t, n]) => <button key={t} type="button" style={chip(spec.topics.includes(t))} aria-pressed={spec.topics.includes(t)} onClick={() => toggleIn('topics', t)}>{t} <span style={{ opacity: .6 }}>{n}</span></button>)}</div></>}
      </div>
      <div style={card}>
        <span style={lab}>How many questions: <b style={{ color: PX.ink, fontSize: 14 }}>{spec.count}</b> <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 600 }}>· {total} available</span></span>
        <input type="range" min="5" max="100" step="1" value={spec.count} onChange={e => set({ count: Number(e.target.value) })} style={{ width: '100%', accentColor: '#b8923a' }} aria-label="Number of questions" />
        <div style={strip}>{[10, 15, 20, 25, 30, 40, 50].map(n => <button key={n} type="button" style={chip(spec.count === n)} onClick={() => set({ count: n })}>{n}</button>)}</div>
        <span style={{ ...lab, marginTop: 16 }}>Difficulty mix</span>
        <div style={{ ...strip, marginBottom: 10 }}>{MIXES.map(([l, m]) => <button key={l} type="button" style={chip(JSON.stringify(spec.mix) === JSON.stringify(m))} onClick={() => set({ mix: m })}>{l}</button>)}</div>
        {['Easy', 'Medium', 'Hard'].map(lv => (
          <div key={lv} style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0' }}>
            <span style={{ width: 62, fontSize: 12.5, fontWeight: 800, color: LV[lv][0] }}>{lv}</span>
            <input type="range" min="0" max="100" step="5" value={spec.mix[lv]} onChange={e => set({ mix: { ...spec.mix, [lv]: Number(e.target.value) } })} style={{ flex: 1, accentColor: LV[lv][0] }} aria-label={`${lv} percentage`} />
            <span style={{ width: 92, fontSize: 12, textAlign: 'right', color: PX.ink2 }}>{spec.mix[lv]}% → <b>{targets[lv]}</b> <span style={{ color: avail[lv] < targets[lv] ? PX.bad : PX.sub }}>/ {avail[lv]}</span></span>
          </div>))}
        <div style={{ fontSize: 11.5, color: mixTotal === 100 ? PX.sub : '#b45309', marginTop: 4 }}>{mixTotal === 100 ? 'The right-hand numbers: questions wanted / questions available.' : `Mix adds to ${mixTotal}% — it is scaled to 100% automatically.`}</div>
      </div>
      <div style={card}>
        <span style={lab}>Rules</span>
        <div style={strip}>
          <button type="button" style={chip(spec.avoidOn)} aria-pressed={spec.avoidOn} onClick={() => set({ avoidOn: !spec.avoidOn })}>{spec.avoidOn ? '✓ ' : ''}Avoid questions I used before ({used.length})</button>
          <button type="button" style={chip(spec.figures)} aria-pressed={spec.figures} onClick={() => set({ figures: !spec.figures })}>{spec.figures ? '✓ ' : ''}Include figure questions</button>
          <button type="button" style={chip(spec.passages)} aria-pressed={spec.passages} onClick={() => set({ passages: !spec.passages })}>{spec.passages ? '✓ ' : ''}Include passages</button>
          {used.length > 0 && <button type="button" style={chip(false)} onClick={() => { setUsed([]); save('psm-used', []) }}>Forget used</button>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: PX.sub }}>Marks per question<input style={{ ...field, marginTop: 4 }} type="number" min="1" value={spec.marks} onChange={e => set({ marks: e.target.value })} /></label>
          <label style={{ fontSize: 12, fontWeight: 700, color: PX.sub }}>Time (minutes)<input style={{ ...field, marginTop: 4 }} type="number" min="5" value={spec.minutes} onChange={e => set({ minutes: e.target.value })} /></label>
        </div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: PX.sub, marginTop: 10 }}>Instructions<textarea style={{ ...field, marginTop: 4, resize: 'vertical' }} rows={2} value={spec.instructions} onChange={e => set({ instructions: e.target.value })} /></label>
      </div>
    </div>
  )

  const paperPane = (
    <div>
      {!res && <div style={{ ...card, textAlign: 'center', padding: 30, color: PX.sub }}><div style={{ fontSize: 38 }}>🧠</div><div style={{ fontWeight: 800, color: PX.ink, margin: '6px 0 2px' }}>Set your blueprint, then press Generate</div><div style={{ fontSize: 13 }}>The paper appears here — you can lock, swap or remove any question.</div></div>}
      {res && (
        <>
          <div style={{ ...card, background: 'linear-gradient(135deg,#132a4f,#2f5aa3)', color: '#fff', border: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 180 }}><div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase', color: '#e9d9b0' }}>Your paper</div><div style={{ fontFamily: PX.serif, fontSize: 21, fontWeight: 600 }}>{picked.length} <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,.7)' }}>of {spec.count} questions · {picked.length * (Number(spec.marks) || 1)} marks · {spec.minutes} min</span></div></div>
              <div style={{ display: 'flex', gap: 6 }}>{['Easy', 'Medium', 'Hard'].map(lv => { const n = picked.filter(q => levelOf(q) === lv).length; return <div key={lv} style={{ background: 'rgba(255,255,255,.14)', borderRadius: 14, padding: '6px 12px', textAlign: 'center', minWidth: 58 }}><div style={{ font: '700 18px Georgia,serif' }}>{n}</div><div style={{ fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', color: '#e9d9b0', fontWeight: 700 }}>{lv}</div></div> })}</div>
            </div>
            {(res.short > 0 || picked.length < spec.count) && <div style={{ marginTop: 10, padding: '7px 12px', borderRadius: 12, background: 'rgba(217,119,6,.9)', fontSize: 13 }}>⚠ Only {picked.length} matching question{picked.length === 1 ? '' : 's'} {picked.length < spec.count ? 'available' : 'left'}. Add more questions to the bank, or widen the subjects, sets or chapters.</div>}
            {Object.values(res.shortfall).some(Boolean) && picked.length >= spec.count && <div style={{ marginTop: 8, fontSize: 12.5, color: '#e9d9b0' }}>Not enough {Object.entries(res.shortfall).filter(([, n]) => n).map(([k, n]) => `${k} (${n} short)`).join(', ')} questions — other levels filled in.</div>}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>{Object.entries(picked.reduce((a, q) => { const t = (q.topic || '').trim() || 'Other'; a[t] = (a[t] || 0) + 1; return a }, {})).map(([t, n]) => <span key={t} style={{ background: 'rgba(255,255,255,.14)', borderRadius: 99, padding: '3px 10px', fontSize: 11.5, fontWeight: 700 }}>{t} {n}</span>)}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
            <button type="button" className="px-btn ghost" onClick={() => run(seed + 1 + Math.floor(Math.random() * 1000))}>🔀 Shuffle again</button>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, fontWeight: 700 }}><input type="checkbox" checked={showAns} onChange={e => setShowAns(e.target.checked)} />Show answers</label>
            <span style={{ fontSize: 12, color: PX.sub }}>🔒 locked questions stay when you shuffle</span>
          </div>
          {picked.map((q, i) => {
            const lv = levelOf(q), lock = locked.includes(q.id)
            return (
              <div key={q.id} style={{ display: 'flex', gap: 10, padding: '12px 12px', marginBottom: 8, borderRadius: 16, border: `1.5px solid ${lock ? '#e3d3a6' : '#ebe6da'}`, background: lock ? '#fffaf0' : '#fff' }}>
                <span style={{ width: 30, height: 30, borderRadius: '50%', background: '#132a4f', color: '#fff', fontWeight: 800, fontSize: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {q.passage && <div style={{ fontSize: 12, color: PX.sub, fontStyle: 'italic', marginBottom: 3 }}>📖 {mathPlain(q.passage).slice(0, 90)}…</div>}
                  <div className="md" style={{ fontSize: 14, lineHeight: 1.45 }}><span dangerouslySetInnerHTML={{ __html: mathToHtml(q.question) }} />{q.image_data ? ' 🖼' : ''}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '2px 12px', margin: '5px 0', fontSize: 13 }}>{['A', 'B', 'C', 'D'].map(k => <div key={k} className="md" style={{ color: showAns && q.answer === k ? '#14633f' : PX.ink2, fontWeight: showAns && q.answer === k ? 800 : 400, fontSize: 13 }}>{k}) <span dangerouslySetInnerHTML={{ __html: mathToHtml(q['option_' + k.toLowerCase()]) }} />{showAns && q.answer === k ? ' ✓' : ''}</div>)}</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 9px', borderRadius: 99, color: LV[lv][0], background: LV[lv][1] }}>{lv}</span>
                    <span style={{ fontSize: 11.5, color: PX.sub }}>{[q.section, 'Set ' + q.test_no, q.topic].filter(Boolean).join(' · ')}</span>
                    {used.includes(q.id) && <span style={{ fontSize: 11, color: '#b45309', fontWeight: 700 }}>used before</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 'none' }}>
                  <button type="button" title={lock ? 'Unlock' : 'Lock — keep when shuffling'} aria-label={lock ? 'Unlock question' : 'Lock question'} aria-pressed={lock} onClick={() => toggleLock(q.id)} style={{ width: 36, height: 36, borderRadius: 11, border: `1px solid ${PX.line}`, background: lock ? '#faf1d9' : '#fff', cursor: 'pointer' }}>{lock ? '🔒' : '🔓'}</button>
                  <button type="button" title="Swap for another" aria-label="Swap question" onClick={() => swap(q)} style={{ width: 36, height: 36, borderRadius: 11, border: `1px solid ${PX.line}`, background: '#fff', cursor: 'pointer' }}>🔄</button>
                  <button type="button" title="Remove" aria-label="Remove question" onClick={() => remove(q)} style={{ width: 36, height: 36, borderRadius: 11, border: `1px solid ${PX.line}`, background: '#fff', cursor: 'pointer', color: PX.bad }}>✕</button>
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )

  const ready = res && picked.length > 0
  return (
    <div role="dialog" aria-modal="true" aria-label="Smart paper maker" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#eef1f6', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'linear-gradient(135deg,#132a4f,#2f5aa3)', color: '#fff', padding: isMobile ? '10px 12px' : '12px 22px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', boxShadow: '0 8px 24px -14px rgba(10,20,40,.7)' }}>
        <button type="button" aria-label="Close" onClick={onClose} style={{ border: 'none', background: 'rgba(255,255,255,.16)', color: '#fff', width: 38, height: 38, borderRadius: '50%', cursor: 'pointer', fontSize: 18 }}>×</button>
        <div style={{ flex: '1 1 200px' }}><div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase', color: '#e9d9b0' }}>Practice bank</div><div style={{ fontFamily: PX.serif, fontSize: isMobile ? 18 : 22, fontWeight: 600 }}>🧠 Smart paper maker</div></div>
        {isMobile && <div role="tablist" aria-label="Step" style={{ display: 'inline-flex', padding: 3, background: 'rgba(255,255,255,.16)', borderRadius: 12 }}>{[['plan', '1 Plan'], ['paper', `2 Paper${picked.length ? ' (' + picked.length + ')' : ''}`]].map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={step === k} onClick={() => setStep(k)} style={{ padding: '7px 12px', borderRadius: 9, border: 'none', background: step === k ? '#fff' : 'transparent', color: step === k ? '#132a4f' : '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>)}</div>}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: isMobile ? 10 : 18 }}>
        {err && <div role="alert" style={{ padding: 14, color: '#8f1d14' }}>❌ {err}</div>}
        {!bank && !err && <div style={{ padding: 40, textAlign: 'center', color: PX.sub }}>Loading the Practice bank…</div>}
        {bank && !bank.length && <div style={{ ...card, textAlign: 'center', padding: 30 }}>The Practice bank has no questions yet. Add some from the Practice bank sets first.</div>}
        {bank && bank.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(320px,400px) minmax(0,1fr)', gap: 18, alignItems: 'start', maxWidth: 1180, margin: '0 auto' }}>
            {(!isMobile || step === 'plan') && <div>{plan}</div>}
            {(!isMobile || step === 'paper') && <div>{paperPane}</div>}
          </div>
        )}
      </div>
      <div style={{ background: '#fff', borderTop: `1px solid ${PX.line}`, padding: `10px ${isMobile ? 12 : 22}px calc(10px + env(safe-area-inset-bottom))`, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', boxShadow: '0 -8px 24px -18px rgba(19,42,79,.4)' }}>
        <button className="px-btn gold" style={{ minHeight: 46, fontSize: 15 }} disabled={!bank || !bank.length || total === 0} onClick={generate}>🧠 {res ? 'Regenerate' : 'Generate paper'}</button>
        <button className="px-btn ghost" style={{ minHeight: 46 }} onClick={savePreset} title="Save this blueprint to reuse">★ Save blueprint</button>
        <span style={{ flex: 1 }} />
        {ready && <>
          <button className="px-btn ghost" style={{ minHeight: 46 }} onClick={() => setPreview({ m: docFor(false), key: false })}>👁 Preview</button>
          <button className="px-btn ghost" style={{ minHeight: 46 }} onClick={() => setPrintFor(docFor(false))}>🖨 Paper</button>
          <button className="px-btn ghost" style={{ minHeight: 46 }} onClick={() => setPrintFor(docFor(true))}>🖨 Answer key</button>
          <button className="px-btn ghost" style={{ minHeight: 46 }} onClick={() => { markUsed(); onUseAsNotes({ title, subject: chosenSubjects.length === 1 ? chosenSubjects[0] : '', body: paperBody(true) }) }}>📎 Use as study notes</button>
        </>}
      </div>
      {printFor && <PrintDialog m={printFor} opts={popts} setOpts={setPopts} creator={me} onClose={() => setPrintFor(null)} onPrint={o => doPrint(printFor, o)} onWord={o => doWord(printFor, o)} isMobile={isMobile} instName={instName} />}
      {preview && (
        <div onClick={() => setPreview(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(14,32,63,.62)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? 0 : 14 }}>
          <div role="dialog" aria-modal="true" aria-label="Paper preview" onClick={e => e.stopPropagation()} style={{ width: 'min(900px,100%)', height: isMobile ? '100%' : '92vh', background: '#fff', borderRadius: isMobile ? 0 : 20, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: `1px solid ${PX.line}` }}>
              <b style={{ flex: 1 }}>{preview.m.title}</b>
              <button type="button" className="px-btn ghost" onClick={() => setPreview({ m: docFor(!preview.key), key: !preview.key })}>{preview.key ? 'Show paper' : 'Show answer key'}</button>
              <button type="button" className="px-btn ghost" onClick={() => setPreview(null)}>Close</button>
            </div>
            <iframe title="Paper preview" srcDoc={materialDocHtml(preview.m, { ...optsFor(popts), auto: false }, CSS_ALL + '@media screen{html{background:#cfd4dc}body{box-sizing:border-box;max-width:210mm;margin:14px auto;padding:14mm;background:#fff;box-shadow:0 4px 22px rgba(15,27,46,.28)}}')} style={{ flex: 1, border: 0, width: '100%', background: '#cfd4dc' }} sandbox="" />
          </div>
        </div>
      )}
    </div>
  )
}
