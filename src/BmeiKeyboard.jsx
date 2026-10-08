// BmeiKeyboard.jsx — type Meetei Mayek with BMEI04 keys while editing a
// translation.
//
// With the keyboard switched on, letters typed into any field marked
// data-bmei inside the keyboard's area come out as Unicode Meetei Mayek, the
// way the Bmei04 font draws them ("fy_utaIL" -> ꯐ꯭ꯌꯨꯇꯥꯏꯜ). Digits, spaces and
// other punctuation are typed as they are. An on-screen key pad inserts into
// the last field used, for touch screens and for finding a letter's key.
//
//   const { areaRef, kb } = useBmeiKeyboard()   // from useBmeiKeyboard.js
//   <div ref={areaRef}>
//     <textarea data-bmei value={v} onChange={e => setV(e.target.value)} />
//     <BmeiKeyboardToggle kb={kb} />
//     <BmeiKeyPad kb={kb} />
//   </div>
//
// Fields stay ordinary controlled inputs: each key replaces the text with
// setRangeText and fires an input event, so the field's onChange runs as if
// the person had typed.
import { useMemo } from 'react'
import { getAllCharacters } from './meetei_mayek'

const S = {
  toggle: on => ({ display:'inline-flex', alignItems:'center', gap:6, padding:'7px 12px', borderRadius:8, cursor:'pointer',
    fontSize:12, fontWeight:700, fontFamily:'inherit', border:'1px solid ' + (on ? '#0f766e' : '#cbd5e1'),
    background: on ? '#0f766e' : '#fff', color: on ? '#fff' : '#334155' }),
  pad: { marginTop:8, padding:10, borderRadius:10, background:'#f8fafc', border:'1px solid #e2e8f0' },
  group: { fontSize:10, fontWeight:800, letterSpacing:'.08em', textTransform:'uppercase', color:'#64748b', margin:'6px 0 4px' },
  keys: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(46px, 1fr))', gap:5 },
  key: { padding:'4px 2px', borderRadius:7, border:'1px solid #cbd5e1', background:'#fff', cursor:'pointer', textAlign:'center', fontFamily:'inherit', lineHeight:1.15 },
  char: { display:'block', fontSize:19, fontFamily:"'Noto Sans Meetei Mayek', sans-serif", color:'#0f172a' },
  code: { display:'block', fontSize:10.5, fontFamily:'monospace', color:'#0f766e', fontWeight:700 },
}

/** On/off switch for BMEI04 typing, plus a button to show the key pad. */
export function BmeiKeyboardToggle({ kb }) {
  return (
    <span style={{ display:'inline-flex', gap:6, flexWrap:'wrap' }}>
      <button type="button" onClick={() => kb.setOn(!kb.on)} style={S.toggle(kb.on)} aria-pressed={kb.on}
        title="Type with BMEI04 keys (as in Word with the Bmei04 font); letters appear as Meetei Mayek">
        ⌨ BMEI04 keyboard: {kb.on ? 'on' : 'off'}
      </button>
      {kb.on && (
        <button type="button" onClick={() => kb.setPad(!kb.pad)} style={S.toggle(false)} aria-expanded={kb.pad}>
          {kb.pad ? 'Hide' : 'Show'} keys
        </button>
      )}
    </span>
  )
}

const GROUPS = [
  ['Letters', k => 'kslmpnctHzYwyhUfAIgrbjdv'.includes(k)],
  ['Lonsum (word-final)', k => 'KLMPNTZ'.includes(k)],
  ['Vowel signs', k => 'aeEioOux'.includes(k)],
  ['Marks', k => '_.|'.includes(k)],
]

/** On-screen BMEI04 keys: each shows its Meetei Mayek letter and the key to type. */
export function BmeiKeyPad({ kb, style }) {
  const chars = useMemo(() => getAllCharacters(), [])
  if (!kb.on || !kb.pad) return null
  const keep = e => e.preventDefault() // keep the caret in the field
  return (
    <div style={{ ...S.pad, ...style }} onMouseDown={keep}>
      <div style={{ fontSize:11.5, color:'#475569', lineHeight:1.5 }}>
        Type BMEI04 keys straight into the box, or click a key. Apun Iyek: type <code>_</code> after the joined letters
        (<code>fy_utaIL</code> → ꯐ꯭ꯌꯨꯇꯥꯏꯜ).
      </div>
      {GROUPS.map(([label, test]) => (
        <div key={label}>
          <div style={S.group}>{label}</div>
          <div style={S.keys}>
            {chars.filter(c => test(c.key)).map(c => (
              <button type="button" key={c.key} onClick={() => kb.press(c.key)} style={S.key} title={`${c.name} — key ${c.key}`}>
                <span style={S.char}>{c.char}</span><span style={S.code}>{c.key}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
      <div style={{ display:'flex', gap:6, marginTop:8 }}>
        <button type="button" onClick={() => kb.press(' ')} style={{ ...S.key, flex:1, padding:'8px 4px', fontSize:12 }}>Space</button>
        <button type="button" onClick={() => kb.press('Backspace')} style={{ ...S.key, padding:'8px 14px', fontSize:12 }} aria-label="Backspace">⌫</button>
      </div>
    </div>
  )
}
