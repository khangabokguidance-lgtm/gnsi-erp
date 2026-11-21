// While a module is open on a phone, dragging the page down must not trigger the browser's pull-to-refresh
// (it reloads the page and throws away what was being typed or pasted). Scrolling itself is not affected.
import { useEffect } from 'react'

export function useNoPullToRefresh() {
  useEffect(() => {
    const els = [document.documentElement, document.body]
    const old = els.map(e => e.style.overscrollBehaviorY)
    els.forEach(e => { e.style.overscrollBehaviorY = 'contain' })
    return () => els.forEach((e, i) => { e.style.overscrollBehaviorY = old[i] })
  }, [])
}
