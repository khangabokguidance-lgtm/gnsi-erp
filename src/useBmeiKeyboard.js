// useBmeiKeyboard.js — state and typing logic for BmeiKeyboard.jsx (see there).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { typeBmeiKey } from './meetei_mayek'

const STORE = 'gnsi.bmeiKeyboard'
const readOn = () => { try { return localStorage.getItem(STORE) === '1' } catch { return false } }

// Replace [from, to) of a field and let React see it as typing.
function replaceRange(el, text, from, to) {
  el.setRangeText(text, from, to, 'end')
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

// Type one BMEI04 key at the caret. false when the key has no Mayek letter.
function typeKey(el, key) {
  const start = el.selectionStart ?? el.value.length
  const end = el.selectionEnd ?? start
  const before = el.value.slice(0, start)
  const next = typeBmeiKey(before, key)
  if (next == null) return false
  let k = 0
  while (k < before.length && k < next.length && before[k] === next[k]) k++
  replaceRange(el, next.slice(k), k, end)
  return true
}

/** { areaRef, kb }: put areaRef on the element around the fields; pass kb to the toggle and key pad. */
export function useBmeiKeyboard() {
  const [on, setOnState] = useState(readOn)
  const [pad, setPad] = useState(false)
  const areaRef = useRef(null)
  const lastField = useRef(null)

  const setOn = useCallback(v => {
    setOnState(v)
    if (!v) setPad(false)
    try { localStorage.setItem(STORE, v ? '1' : '0') } catch { /* per-browser preference only */ }
  }, [])

  useEffect(() => {
    const area = areaRef.current
    if (!area) return
    const isField = t => t?.matches?.('textarea[data-bmei], input[data-bmei]')
    const onFocus = e => { if (isField(e.target)) lastField.current = e.target }
    const onBeforeInput = e => {
      if (!on || !isField(e.target) || e.isComposing) return
      if (e.inputType !== 'insertText' || !e.data || e.data.length !== 1) return
      if (typeKey(e.target, e.data)) e.preventDefault()
    }
    area.addEventListener('focusin', onFocus)
    area.addEventListener('beforeinput', onBeforeInput)
    return () => { area.removeEventListener('focusin', onFocus); area.removeEventListener('beforeinput', onBeforeInput) }
  }, [on])

  // On-screen keys: into the last field used (or the first one in the area).
  const press = useCallback(key => {
    let el = lastField.current
    if (!el || !el.isConnected) el = areaRef.current?.querySelector('textarea[data-bmei], input[data-bmei]')
    if (!el) return
    el.focus()
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? start
    if (key === 'Backspace') {
      if (start !== end) replaceRange(el, '', start, end)
      else if (start > 0) replaceRange(el, '', start - 1, start)
    } else if (!typeKey(el, key)) {
      replaceRange(el, key, start, end)
    }
    lastField.current = el
  }, [])

  const kb = useMemo(() => ({ on, setOn, pad, setPad, press }), [on, setOn, pad, press])
  return { areaRef, kb }
}

