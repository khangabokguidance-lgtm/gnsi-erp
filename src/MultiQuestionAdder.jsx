// MultiQuestionAdder.jsx — add many questions at once as cards (no text format to remember).
// Cards are turned into the same "Q1. … A) … Ans: B" text the paste box uses, so the builder's
// existing parser, duplicate check and upload path validate and save them.
import { useRef } from 'react'
import { PX } from './premiumUI'

export const blankCard = () => ({ id: Math.random().toString(36).slice(2), question: '', a: '', b: '', c: '', d: '', ans: '', exp: '', topic: '', level: '', passage: '', showMore: false })
const clean = s => String(s || '').replace(/\s*\n\s*/g, ' ').trim()
const isEmpty = c => !(c.question.trim() || c.a.trim() || c.b.trim() || c.c.trim() || c.d.trim() || c.exp.trim() || c.topic.trim())

export function cardsToText(cards) {
  let lastPassage = ''
  return cards.filter(c => !isEmpty(c)).map((c, i) => {
    const p = clean(c.passage)
    let head = ''
    if (p !== lastPassage) { head = (lastPassage ? 'End passage\n' : '') + (p ? `Passage: ${p}\n` : ''); lastPassage = p }
    return `${head}Q${i + 1}. ${clean(c.question)}\nA) ${clean(c.a)}\nB) ${clean(c.b)}\nC) ${clean(c.c)}\nD) ${clean(c.d)}\nAns: ${c.ans}${c.exp.trim() ? `\nExp: ${clean(c.exp)}` : ''}${c.topic.trim() ? `\nTopic: ${clean(c.topic)}` : ''}${c.level ? `\nLevel: ${c.level}` : ''}`
  }).join('\n')
}

const missingOf = c => {
  if (isEmpty(c)) return null
  const m = []
  if (!c.question.trim()) m.push('question')
  ;['a', 'b', 'c', 'd'].forEach(k => { if (!c[k].trim()) m.push('option ' + k.toUpperCase()) })
  if (!c.ans) m.push('correct answer')
  return m
}

const TONES = { A: '#2563eb', B: '#7c3aed', C: '#d97706', D: '#db2777' }
const field = { width: '100%', boxSizing: 'border-box', border: `1px solid ${PX.line}`, borderRadius: 10, padding: '9px 11px', fontSize: 14, fontFamily: 'inherit', background: '#fff', color: PX.ink, outline: 'none' }

export default function MultiQuestionAdder({ cards, setCards, remaining }) {
  const refs = useRef({})
  const upd = (id, patch) => setCards(cs => cs.map(c => (c.id === id ? { ...c, ...patch } : c)))
  const addAfter = (id, n = 1, copyFrom) => setCards(cs => {
    const i = id ? cs.findIndex(c => c.id === id) : cs.length - 1
    const fresh = Array.from({ length: n }, () => ({ ...blankCard(), ...(copyFrom ? { topic: copyFrom.topic, level: copyFrom.level, passage: copyFrom.passage, showMore: copyFrom.showMore } : {}) }))
    const next = [...cs.slice(0, i + 1), ...fresh, ...cs.slice(i + 1)]
    setTimeout(() => refs.current[fresh[0].id]?.focus(), 30)
    return next
  })
  const remove = id => setCards(cs => (cs.length > 1 ? cs.filter(c => c.id !== id) : [blankCard()]))
  const dup = c => setCards(cs => { const i = cs.findIndex(x => x.id === c.id); return [...cs.slice(0, i + 1), { ...c, id: blankCard().id }, ...cs.slice(i + 1)] })
  const filled = cards.filter(c => !isEmpty(c))
  const ready = filled.filter(c => missingOf(c).length === 0).length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ flex: '1 1 200px', fontSize: 13, color: PX.sub }}>
          <b style={{ color: PX.ink }}>{ready} ready</b>{filled.length > ready ? <span style={{ color: '#b45309' }}> · {filled.length - ready} incomplete</span> : null}
          {typeof remaining === 'number' && <span> · {remaining > 0 ? `${remaining} more needed for this section` : 'section is full'}</span>}
        </div>
        <button type="button" className="px-btn ghost" style={{ padding: '7px 12px', fontSize: 12.5 }} onClick={() => addAfter(null, 1, cards[cards.length - 1])}>＋ Add question</button>
        <button type="button" className="px-btn ghost" style={{ padding: '7px 12px', fontSize: 12.5 }} onClick={() => addAfter(null, 5, cards[cards.length - 1])}>＋ Add 5</button>
      </div>
      <div style={{ display: 'grid', gap: 12 }}>
        {cards.map((c, i) => {
          const miss = missingOf(c)
          const ok = miss && miss.length === 0
          return (
            <div key={c.id} style={{ border: `1.5px solid ${ok ? '#bfe3cc' : miss ? '#f1d9a8' : PX.line}`, borderRadius: 16, background: ok ? '#f7fcf9' : '#fff', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: `1px solid ${PX.line}`, background: '#fcfbf7' }}>
                <span style={{ width: 26, height: 26, borderRadius: '50%', background: PX.navy, color: '#fff', fontWeight: 800, fontSize: 12, display: 'grid', placeItems: 'center' }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: 12, color: ok ? PX.ok : miss ? '#b45309' : PX.faint, fontWeight: 700 }}>{ok ? '✓ Ready' : miss ? 'Missing: ' + miss.join(', ') : 'Empty'}</span>
                <button type="button" aria-label="Duplicate question" title="Duplicate" onClick={() => dup(c)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 15 }}>⧉</button>
                <button type="button" aria-label="Remove question" title="Remove" onClick={() => remove(c.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 15 }}>🗑</button>
              </div>
              <div style={{ padding: 12, display: 'grid', gap: 10 }}>
                <textarea ref={el => { refs.current[c.id] = el }} rows={2} style={{ ...field, resize: 'vertical', fontSize: 15 }} placeholder="Type the question…" aria-label={`Question ${i + 1}`} value={c.question} onChange={e => upd(c.id, { question: e.target.value })} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,230px),1fr))', gap: 8 }}>
                  {['A', 'B', 'C', 'D'].map(k => {
                    const on = c.ans === k
                    return (
                      <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1.5px solid ${on ? TONES[k] : PX.line}`, background: on ? TONES[k] + '14' : '#fff', borderRadius: 12, padding: '4px 6px 4px 4px' }}>
                        <button type="button" aria-pressed={on} aria-label={`Mark ${k} as the correct answer`} title="Tap to mark correct" onClick={() => upd(c.id, { ans: on ? '' : k })}
                          style={{ width: 32, height: 32, borderRadius: 9, border: 'none', background: on ? TONES[k] : '#f1ede3', color: on ? '#fff' : PX.ink2, fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}>{on ? '✓' : k}</button>
                        <input style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', fontSize: 14, fontFamily: 'inherit', background: 'transparent', padding: '6px 2px' }} placeholder={`Option ${k}`} aria-label={`Question ${i + 1} option ${k}`} value={c[k.toLowerCase()]}
                          onChange={e => upd(c.id, { [k.toLowerCase()]: e.target.value })}
                          onKeyDown={e => { if (k === 'D' && e.key === 'Enter') { e.preventDefault(); addAfter(c.id, 1, c) } }} />
                      </div>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: PX.sub }}>Level</span>
                  {['Easy', 'Medium', 'Hard'].map(l => <button key={l} type="button" aria-pressed={c.level === l} onClick={() => upd(c.id, { level: c.level === l ? '' : l })}
                    style={{ padding: '5px 11px', borderRadius: 99, border: `1.5px solid ${c.level === l ? PX.gold : PX.line}`, background: c.level === l ? PX.goldBg : '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>)}
                  <button type="button" onClick={() => upd(c.id, { showMore: !c.showMore })} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: PX.navy, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>{c.showMore ? '− Less' : '＋ Explanation, topic, passage'}</button>
                </div>
                {c.showMore && (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <input style={field} placeholder="Topic (e.g. Fractions)" aria-label="Topic" value={c.topic} onChange={e => upd(c.id, { topic: e.target.value })} />
                    <textarea rows={2} style={{ ...field, resize: 'vertical' }} placeholder="Explanation (shown in the answer key)" aria-label="Explanation" value={c.exp} onChange={e => upd(c.id, { exp: e.target.value })} />
                    <textarea rows={2} style={{ ...field, resize: 'vertical' }} placeholder="Reading passage — questions with the same passage text are grouped under it" aria-label="Passage" value={c.passage} onChange={e => upd(c.id, { passage: e.target.value })} />
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <button type="button" className="px-btn ghost" style={{ marginTop: 10, width: '100%', borderStyle: 'dashed' }} onClick={() => addAfter(null, 1, cards[cards.length - 1])}>＋ Add another question</button>
      <div style={{ fontSize: 11.5, color: PX.faint, marginTop: 6 }}>Tip: tap a letter to mark the correct answer · Enter in option D starts the next question (topic, level and passage carry over).</div>
    </div>
  )
}
