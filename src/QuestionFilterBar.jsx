// QuestionFilterBar.jsx — search box plus an "Advanced filter" panel: level, setter, topic, explanation, figure, chosen for the paper,
// problems (missing options or answer, off the syllabus plan) and sort order. Used by the Mission Sainik builders and Mission Foundation.
import { useState } from 'react'
import { PX } from './premiumUI'
import { EMPTY_FILTER, activeFilters, filterChoices } from './lib/questionFilter'

export default function QuestionFilterBar({ list, value, onChange, shown, showChosen = false, showOffPlan = false }) {
  const [open, setOpen] = useState(false)
  const f = value || EMPTY_FILTER, set = patch => onChange({ ...f, ...patch })
  const { setters, topics } = filterChoices(list)
  const n = activeFilters(f)
  const sel = (label, k, opts) => (
    <label style={{ display: 'grid', gap: 3, fontSize: 11.5, fontWeight: 700, color: PX.ink2 }}>{label}
      <select className="px-input" value={f[k]} onChange={e => set({ [k]: e.target.value })} style={{ fontWeight: f[k] ? 700 : 400, borderColor: f[k] ? PX.gold : undefined }}>
        {opts.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
    </label>)
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="px-input" style={{ flex: '1 1 200px' }} type="search" value={f.search} onChange={e => set({ search: e.target.value })} placeholder="Search questions, topics, options, setter…" aria-label="Search questions" />
        <button type="button" className="px-btn ghost" aria-expanded={open} onClick={() => setOpen(v => !v)} style={n ? { borderColor: PX.gold, color: PX.navy, fontWeight: 800 } : undefined}>⚙ Advanced filter{n ? ` (${n})` : ''}</button>
        {(n > 0 || f.search || f.sort) && <button type="button" className="px-btn ghost" onClick={() => onChange(EMPTY_FILTER)}>Clear</button>}
        {(n > 0 || f.search) && <span style={{ fontSize: 12.5, color: PX.sub }}>{shown} of {list.length}</span>}
      </div>
      {open && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginTop: 8, padding: 12, borderRadius: 12, background: PX.tint, border: `1px solid ${PX.line}` }}>
          {sel('Level', 'level', [['', 'Any level'], ['Easy', 'Easy'], ['Medium', 'Medium'], ['Hard', 'Hard'], ['none', 'No level set']])}
          {sel('Setter', 'setter', [['', 'Anyone'], ...setters.map(x => [x, x])])}
          {sel('Topic', 'topic', [['', 'Any topic'], ...topics.map(x => [x, x]), ['none', 'No topic']])}
          {sel('Explanation', 'explain', [['', 'Any'], ['yes', 'With explanation'], ['no', 'Without explanation']])}
          {sel('Figure', 'figure', [['', 'Any'], ['yes', 'With a figure'], ['no', 'Text only']])}
          {showChosen && sel('In the paper', 'chosen', [['', 'Any'], ['yes', '★ Chosen'], ['no', 'Not chosen']])}
          {sel('Problems', 'problem', [['', 'Any'], ['fix', 'Missing options or answer'], ...(showOffPlan ? [['off', 'Off the syllabus plan']] : [])])}
          {sel('Order', 'sort', [['', 'As uploaded'], ['newest', 'Newest first'], ['hard', 'Hard first'], ['easy', 'Easy first'], ['setter', 'By setter']])}
        </div>)}
    </div>
  )
}
