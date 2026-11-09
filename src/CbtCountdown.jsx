// CbtCountdown.jsx — a live countdown (days · hours · minutes · seconds) to a moment in the future.
// Used by the landing-page flash message and by the public exam page while a test has not opened yet.
import { useEffect, useState } from 'react'
import { countdownParts } from './lib/cbtFlash'

const two = n => String(n).padStart(2, '0')

export default function CbtCountdown({ to, onDone, className = 'cbt-cd' }) {
  const target = Date.parse(to)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!Number.isFinite(target)) return undefined
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [target])
  const left = target - now
  useEffect(() => { if (Number.isFinite(target) && left <= 0) onDone?.() }, [left, target, onDone])
  if (!Number.isFinite(target)) return null
  const { d, h, m, s } = countdownParts(left)
  const cell = (n, l) => <span className={`${className}-c`}><b>{two(n)}</b><small>{l}</small></span>
  return (
    <span className={className} role="timer" aria-label={`Starts in ${d} days ${h} hours ${m} minutes ${s} seconds`}>
      {d > 0 && cell(d, 'days')}{cell(h, 'hrs')}{cell(m, 'min')}{cell(s, 'sec')}
    </span>
  )
}
