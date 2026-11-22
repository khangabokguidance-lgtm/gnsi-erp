// MissionSainikQuickAdd.jsx — add questions ONE AT A TIME: type a question, tap the correct option, Save & next. Each question is saved
// straight away (nothing is lost if the phone locks), with a progress bar for the section. Built for phones; works everywhere.
import { useState } from 'react'
import { PX } from './premiumUI'
import { Icon } from './MissionSainikIcons'

const LETTERS = ['A', 'B', 'C', 'D']
const CSS = `
.qa-step{display:flex;align-items:center;gap:9px;margin-top:4px;font-size:13px;font-weight:800;color:#0e2a55;letter-spacing:.01em}
.qa-step i{width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:#132a4f;color:#fff;font:800 12px/1 inherit;font-style:normal;flex:none}.qa-step small{font-weight:600;color:#5d6b82}
.qa-saved{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:14px;background:linear-gradient(90deg,#e8f6ee,#f5fbf7);border:1px solid #b9e0c9;color:#0f4d30;font-size:14px;line-height:1.4;animation:qa-pop .35s cubic-bezier(.2,.9,.3,1.3) both}
.qa-saved .tick{width:30px;height:30px;border-radius:50%;background:#16a34a;color:#fff;display:flex;align-items:center;justify-content:center;flex:none;box-shadow:0 6px 14px -6px rgba(22,163,74,.9)}
@keyframes qa-pop{from{transform:translateY(-8px) scale(.97);opacity:0}to{transform:none;opacity:1}}
.qa-ready{display:flex;gap:8px;flex-wrap:wrap}.qa-ready span{display:inline-flex;align-items:center;gap:5px;padding:3px 11px;border-radius:99px;font-size:12px;font-weight:700;background:#f0f2f7;color:#6b778c;transition:background .2s,color .2s}.qa-ready span.ok{background:#e6f5ec;color:#0f7a4c}
`
const blank = () => ({ question: '', opts: ['', '', '', ''], ans: '', exp: '' })

export default function MissionSainikQuickAdd({ chapters = [], count = 0, need = 25, startNo = 1, busy = false, onSave, isMobile = false }) {
  const [f, setF] = useState(blank)
  const [level, setLevel] = useState('Medium')
  const [topic, setTopic] = useState(chapters.length === 1 ? chapters[0] : '')
  const [more, setMore] = useState(false)
  const [err, setErr] = useState('')
  const [saved, setSaved] = useState(null)   // { no, left } right after a save: a short celebration, cleared when you start the next question
  const set = patch => { setErr(''); setSaved(null); setF(x => ({ ...x, ...patch })) }
  const setOpt = (i, v) => { setErr(''); setSaved(null); setF(x => ({ ...x, opts: x.opts.map((o, j) => (j === i ? v : o)) })) }
  const optsFilled = f.opts.filter(o => o.trim()).length, ready = !!f.question.trim() && optsFilled === 4 && !!f.ans

  const save = async () => {
    if (!f.question.trim()) return setErr('Type the question.')
    if (f.opts.some(o => !o.trim())) return setErr('Fill all four options A, B, C and D.')
    if (!f.ans) return setErr('Tap the correct option (A, B, C or D).')
    const ok = await onSave({ question: f.question, option_a: f.opts[0], option_b: f.opts[1], option_c: f.opts[2], option_d: f.opts[3], answer: f.ans, explanation: f.exp, topic, difficulty: level })
    if (ok) { setSaved({ no: startNo, left: Math.max(0, need - (count + 1)) }); setF(blank()); setErr(''); setMore(false); document.getElementById('qa-question')?.focus() }
  }
  const box = { width: '100%', boxSizing: 'border-box', border: `1.5px solid ${PX.line}`, borderRadius: 12, padding: '11px 12px', fontSize: 16, fontFamily: 'inherit', background: '#fff', color: PX.ink }
  const chip = on => ({ minHeight: 44, padding: '0 16px', borderRadius: 99, border: `1.5px solid ${on ? PX.navy : PX.line}`, background: on ? PX.navy : '#fff', color: on ? '#fff' : PX.navy, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' })

  return (
    <div style={{ display: 'grid', gap: 12 }} onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !busy) { e.preventDefault(); save() } }}>
      <style>{CSS}</style>
      <b style={{ color: PX.navy, fontSize: 19, fontFamily: PX.serif }}>{count >= need ? 'Add an extra question' : `Question ${startNo}`}</b>

      {saved && (
        <div role="status" className="qa-saved">
          <span className="tick"><Icon name="check" size={18} stroke={3} /></span>
          <span><b>Question {saved.no} saved.</b> {saved.left === 0 ? 'That completes this section — brilliant work!' : `${saved.left} more to go — you're doing great.`}</span>
        </div>)}

      <div className="qa-step"><i>1</i>Type the question</div>
      <textarea id="qa-question" rows={isMobile ? 4 : 3} aria-label="Question" placeholder="Type the question…" value={f.question} onChange={e => set({ question: e.target.value })} style={{ ...box, resize: 'vertical', minHeight: 96 }} />

      <div className="qa-step"><i>2</i>Write the four options, then tap the letter of the correct one</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {LETTERS.map((L, i) => (
          <div key={L} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button type="button" aria-pressed={f.ans === L} aria-label={`Option ${L} is correct`} title="Tap to mark as the correct answer" onClick={() => set({ ans: L })}
              style={{ flex: 'none', width: 46, height: 46, borderRadius: '50%', border: `2px solid ${f.ans === L ? '#0f7a4c' : PX.line}`, background: f.ans === L ? '#0f7a4c' : '#fff', color: f.ans === L ? '#fff' : PX.navy, fontWeight: 800, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}>{f.ans === L ? '✓' : L}</button>
            <input aria-label={`Option ${L}`} placeholder={`Option ${L}`} value={f.opts[i]} onChange={e => setOpt(i, e.target.value)} style={{ ...box, minHeight: 46 }} />
          </div>))}
      </div>

      <div className="qa-step"><i>3</i>Level and chapter <small>(optional)</small></div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: PX.sub }}>Level</span>
        {['Easy', 'Medium', 'Hard'].map(l => <button key={l} type="button" aria-pressed={level === l} style={chip(level === l)} onClick={() => setLevel(l)}>{l}</button>)}
      </div>

      {chapters.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: PX.sub }}>Chapter</span>
          {chapters.map(ch => <button key={ch} type="button" aria-pressed={topic === ch} style={{ ...chip(topic === ch), background: topic === ch ? '#7c3aed' : '#fff', borderColor: topic === ch ? '#7c3aed' : '#d9ccf5', color: topic === ch ? '#fff' : '#4c1d95' }} onClick={() => setTopic(topic === ch ? '' : ch)}>{ch}</button>)}
        </div>)}

      <button type="button" onClick={() => setMore(m => !m)} style={{ alignSelf: 'start', justifySelf: 'start', border: 0, background: 'transparent', color: PX.navy, fontWeight: 800, fontSize: 13.5, cursor: 'pointer', padding: '4px 0', fontFamily: 'inherit' }}>{more ? '▾ Hide' : '▸ Add'} topic</button>
      {more && (
        <div style={{ display: 'grid', gap: 8 }}>
          <input aria-label="Topic" list="msb-chapters" placeholder="Topic (e.g. Fractions)" value={topic} onChange={e => setTopic(e.target.value)} style={box} />
        </div>)}

      <div className="qa-ready" aria-live="polite">
        <span className={f.question.trim() ? 'ok' : ''}>{f.question.trim() ? <Icon name="check" size={13} stroke={3} /> : '○'} Question</span>
        <span className={optsFilled === 4 ? 'ok' : ''}>{optsFilled === 4 ? <Icon name="check" size={13} stroke={3} /> : '○'} Options {optsFilled}/4</span>
        <span className={f.ans ? 'ok' : ''}>{f.ans ? <Icon name="check" size={13} stroke={3} /> : '○'} Correct answer{f.ans ? ` ${f.ans}` : ''}</span>
      </div>
      {err && <div role="alert" style={{ padding: '9px 12px', borderRadius: 12, background: '#fdecea', color: PX.bad, fontWeight: 700, fontSize: 13.5 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 10, position: isMobile ? 'sticky' : 'static', bottom: isMobile ? 'calc(72px + env(safe-area-inset-bottom))' : undefined, zIndex: 3, padding: isMobile ? '8px 0' : 0, background: isMobile ? 'linear-gradient(180deg,rgba(255,255,255,0),#fff 30%)' : 'transparent' }}>
        <button type="button" className="px-btn ghost" disabled={busy} onClick={() => { setF(blank()); setErr('') }} style={{ minHeight: 50, flex: '0 0 auto' }}>Clear</button>
        <button type="button" className="px-btn gold" disabled={busy} onClick={save} style={{ minHeight: 50, flex: 1, fontSize: 15 }}>{busy ? 'Saving…' : ready ? '✓ Save & next question' : 'Save & next question'}</button>
      </div>
    </div>
  )
}
