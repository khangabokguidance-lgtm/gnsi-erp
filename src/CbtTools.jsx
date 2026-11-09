// CbtTools.jsx — small helpers for the exam screen: an on-screen calculator and a rough-work pad. A test turns them on
// with marking.tools = { calc, rough }. Rough work stays in this browser tab only; it is never saved or sent.
import { useState } from 'react'

const OPS = { '+': (a, b) => a + b, '−': (a, b) => a - b, '×': (a, b) => a * b, '÷': (a, b) => (b === 0 ? NaN : a / b) }
const fmt = n => (Number.isFinite(n) ? String(Math.round(n * 1e9) / 1e9) : 'Error')

export function Calculator({ onClose }) {
  const [disp, setDisp] = useState('0')
  const [acc, setAcc] = useState(null)
  const [op, setOp] = useState(null)
  const [fresh, setFresh] = useState(true)
  const digit = d => { setDisp(x => (fresh || x === '0' ? (d === '.' ? '0.' : d) : d === '.' && x.includes('.') ? x : x + d)); setFresh(false) }
  const run = next => {
    const cur = Number(disp)
    const val = acc !== null && op && !fresh ? OPS[op](acc, cur) : cur
    setDisp(fmt(val)); setAcc(Number.isFinite(val) ? val : null); setOp(next); setFresh(true)
  }
  const clear = () => { setDisp('0'); setAcc(null); setOp(null); setFresh(true) }
  const keys = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '0', '.', '=', '+']
  return (
    <div className="cbt-tool" role="dialog" aria-label="Calculator" style={{ width: 220 }}>
      <div className="cbt-tool-h"><b>Calculator</b><button onClick={onClose} aria-label="Close calculator">✕</button></div>
      <div className="cbt-calc-d" aria-live="polite">{disp}</div>
      <div className="cbt-calc-g">
        {keys.map(k => <button key={k} onClick={() => (k === '=' ? run(null) : OPS[k] ? run(k) : digit(k))}>{k}</button>)}
        <button className="clr" onClick={clear}>Clear</button>
      </div>
    </div>
  )
}

export function RoughPad({ value, onChange, onClose }) {
  return (
    <div className="cbt-tool" role="dialog" aria-label="Rough work" style={{ width: 280 }}>
      <div className="cbt-tool-h"><b>Rough work</b><button onClick={onClose} aria-label="Close rough work">✕</button></div>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder="Type your rough work here. It is not saved or sent." spellCheck={false} />
    </div>
  )
}
