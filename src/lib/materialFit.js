// materialFit.js — "fit this study material / paper in N pages": try layouts from the roomiest to the tightest and keep the first that fits.
// Pages are counted by laying the real print document out in a hidden frame at the page width (browser only).
import { materialDocHtml } from './materialMarkup.js'

const MM = 3.7795
const MARGIN_MM = { normal: [16, 14, 18], narrow: [10, 10, 12], minimal: [6, 7, 8] }
function pageBox(o) {
  const [w, h] = o.paper === 'a5' ? [148, 210] : [210, 297], W = o.landscape ? h : w, H = o.landscape ? w : h, mg = MARGIN_MM[o.margin] || MARGIN_MM.normal
  return { cw: Math.round((W - 2 * mg[1]) * MM), ch: Math.round((H - mg[0] - mg[2]) * MM) }
}

// Number of pages the document takes with these print options (null when it cannot be measured).
export function pagesOf(m, opts, css = '') {
  return new Promise(resolve => {
    if (typeof document === 'undefined') return resolve(null)
    const { cw, ch } = pageBox(opts), f = document.createElement('iframe')
    f.style.cssText = `position:fixed;left:-99999px;top:0;width:${cw}px;height:${ch}px;border:0;visibility:hidden`
    let done = false
    const finish = v => { if (done) return; done = true; f.remove(); resolve(v) }
    f.onload = () => { try { finish(Math.max(1, Math.ceil((f.contentDocument.documentElement.scrollHeight - 6) / ch))) } catch { finish(null) } }
    f.srcdoc = materialDocHtml(m, { ...opts, auto: false }, css)
    document.body.appendChild(f)
    setTimeout(() => finish(null), 5000)
  })
}

// Layouts, most readable first. Every step is A4, so a 50-question paper only gets as tight as it has to.
export const FIT_STEPS = [
  { margin: 'normal', columns: 1, size: 13, compact: false, header: 'full' },
  { margin: 'narrow', columns: 1, size: 12, compact: true, header: 'compact' },
  { margin: 'narrow', columns: 2, size: 12, compact: true, header: 'compact' },
  { margin: 'narrow', columns: 2, size: 11, compact: true, header: 'compact' },
  { margin: 'minimal', columns: 2, size: 10.5, compact: true, header: 'compact' },
  { margin: 'minimal', columns: 2, size: 10, compact: true, header: 'compact', smallFigs: true },
  { margin: 'minimal', columns: 2, size: 9.5, compact: true, header: 'compact', smallFigs: true },
  { margin: 'minimal', columns: 3, size: 9.5, compact: true, header: 'compact', smallFigs: true },
]

// → { step, pages, fits }: the roomiest layout that takes at most `target` pages, or the tightest one with its page count when none fits.
// base: the print options to keep (font, institute, paper…); the step overrides margin, columns, size, spacing and header.
export async function fitToPages(m, base, target, css = '') {
  let last = null
  for (const step of FIT_STEPS) {
    const pages = await pagesOf(m, { ...base, ...step }, css)
    if (pages == null) continue
    last = { step, pages, fits: pages <= target }
    if (pages <= target) return last
  }
  return last
}
