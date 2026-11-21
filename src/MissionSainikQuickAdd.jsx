// MissionSainikQuickAdd.jsx — add questions ONE AT A TIME: type a question, tap the correct option, Save & next. Each question is saved
// straight away (nothing is lost if the phone locks), with a progress bar for the section. Built for phones; works everywhere.
import { useState } from 'react'
import { PX } from './premiumUI'

const LETTERS = ['A', 'B', 'C', 'D']
const blank = () => ({ question: '', opts: ['', '', '', ''], ans: '', exp: '' })

export default function MissionSainikQuickAdd({ chapters = [], count = 0, need = 25, startNo = 1, busy = false, onSave, isMobile = false }) {
  const [f, setF] = useState(blank)
  const [level, setLevel] = useState('Medium')
  const [topic, setTopic] = useState(chapters.length === 1 ? chapters[0] : '')
  const [more, setMore] = useState(false)
  const [err, setErr] = useState('')
  const set = patch => { setErr(''); setF(x => ({ ...x, ...patch })) }
  const setOpt = (i, v) => { setErr(''); setF(x => ({ ...x, opts: x.opts.map((o, j) => (j === i ? v : o)) })) }
  const done = Math.min(count, need), pct = need ? Math.round((done / need) * 100) : 0

  const save = async () => {
    if (!f.question.trim()) return setErr('Type the question.')
    if (f.opts.some(o => !o.trim())) return setErr('Fill all four options A, B, C and D.')
    if (!f.ans) return setErr('Tap the correct option (A, B, C or D).')
    const ok = await onSave({ question: f.question, option_a: f.opts[0], option_b: f.opts[1], option_c: f.opts[2], option_d: f.opts[3], answer: f.ans, explanation: f.exp, topic, difficulty: level })
    if (ok) { setF(blank()); setErr(''); setMore(false); document.getElementById('qa-question')?.focus() }
  }
  const box = { width: '100%', boxSizing: 'border-box', border: `1.5px solid ${PX.line}`, borderRadius: 12, padding: '11px 12px', fontSize: 16, fontFamily: 'inherit', background: '#fff', color: PX.ink }
  const chip = on => ({ minHeight: 44, padding: '0 16px', borderRadius: 99, border: `1.5px solid ${on ? PX.navy : PX.line}`, background: on ? PX.navy : '#fff', color: on ? '#fff' : PX.navy, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' })

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
          <b style={{ color: PX.navy, fontSize: 15 }}>Question {startNo}</b><span style={{ fontSize: 12.5, color: PX.sub, fontWeight: 700 }}>{done} of {need} done{count >= need ? ' ✓' : ''}</span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: '#eef1f6', overflow: 'hidden' }}><div style={{ width: pct + '%', height: '100%', background: 'linear-gradient(90deg,#b8923a,#0f7a4c)', transition: 'width .3s' }} /></div>
      </div>

      <textarea id="qa-question" rows={isMobile ? 4 : 3} aria-label="Question" placeholder="Type the question…" value={f.question} onChange={e => set({ question: e.target.value })} style={{ ...box, resize: 'vertical', minHeight: 96 }} />

      <div style={{ display: 'grid', gap: 8 }}>
        {LETTERS.map((L, i) => (
          <div key={L} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button type="button" aria-pressed={f.ans === L} aria-label={`Option ${L} is correct`} title="Tap to mark as the correct answer" onClick={() => set({ ans: L })}
              style={{ flex: 'none', width: 46, height: 46, borderRadius: '50%', border: `2px solid ${f.ans === L ? '#0f7a4c' : PX.line}`, background: f.ans === L ? '#0f7a4c' : '#fff', color: f.ans === L ? '#fff' : PX.navy, fontWeight: 800, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}>{f.ans === L ? '✓' : L}</button>
            <input aria-label={`Option ${L}`} placeholder={`Option ${L}`} value={f.opts[i]} onChange={e => setOpt(i, e.target.value)} style={{ ...box, minHeight: 46 }} />
          </div>))}
        <div style={{ fontSize: 12, color: PX.sub }}>Tap the letter of the correct option.</div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: PX.sub }}>Level</span>
        {['Easy', 'Medium', 'Hard'].map(l => <button key={l} type="button" aria-pressed={level === l} style={chip(level === l)} onClick={() => setLevel(l)}>{l}</button>)}
      </div>

      {chapters.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: PX.sub }}>Chapter</span>
          {chapters.map(ch => <button key={ch} type="button" aria-pressed={topic === ch} style={{ ...chip(topic === ch), background: topic === ch ? '#7c3aed' : '#fff', borderColor: topic === ch ? '#7c3aed' : '#d9ccf5', color: topic === ch ? '#fff' : '#4c1d95' }} onClick={() => setTopic(topic === ch ? '' : ch)}>{ch}</button>)}
        </div>)}

      <button type="button" onClick={() => setMore(m => !m)} style={{ alignSelf: 'start', border: 0, background: 'transparent', color: PX.navy, fontWeight: 800, fontSize: 13.5, cursor: 'pointer', padding: '4px 0', fontFamily: 'inherit' }}>{more ? '▾ Hide' : '▸ Add'} topic</button>
      {more && (
        <div style={{ display: 'grid', gap: 8 }}>
          <input aria-label="Topic" list="msb-chapters" placeholder="Topic (e.g. Fractions)" value={topic} onChange={e => setTopic(e.target.value)} style={box} />
        </div>)}

      {err && <div role="alert" style={{ padding: '9px 12px', borderRadius: 12, background: '#fdecea', color: PX.bad, fontWeight: 700, fontSize: 13.5 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 10, position: isMobile ? 'sticky' : 'static', bottom: isMobile ? 'calc(72px + env(safe-area-inset-bottom))' : undefined, zIndex: 3, padding: isMobile ? '8px 0' : 0, background: isMobile ? 'linear-gradient(180deg,rgba(255,255,255,0),#fff 30%)' : 'transparent' }}>
        <button type="button" className="px-btn ghost" disabled={busy} onClick={() => { setF(blank()); setErr('') }} style={{ minHeight: 50, flex: '0 0 auto' }}>Clear</button>
        <button type="button" className="px-btn gold" disabled={busy} onClick={save} style={{ minHeight: 50, flex: 1, fontSize: 15 }}>{busy ? 'Saving…' : '✓ Save & next question'}</button>
      </div>
    </div>
  )
}
