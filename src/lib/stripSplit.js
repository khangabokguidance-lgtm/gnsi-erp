// Splits a "strip" figure picture — the question figure on the left, a thin vertical divider, then four
// option figures with their "(A) (B) (C) (D)" captions underneath — into a question picture plus four
// option pictures. All functions here are pure (they work on ink counts), so they are easy to test; the
// canvas work lives in StripSplit.jsx.

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// colInk[x] / rowInk[y] = how many dark pixels sit in that column / row.
export function inkCounts(lum, w, h, dark = 150) {
  const colInk = new Array(w).fill(0), rowInk = new Array(h).fill(0)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (lum[y * w + x] < dark) { colInk[x]++; rowInk[y]++ }
    }
  }
  return { colInk, rowInk }
}

// The divider is a long thin vertical line. Returns its x, or null when there is none.
export function findDivider(colInk, h, { from = 0.1, to = 0.65, minRatio = 0.55 } = {}) {
  const w = colInk.length
  let best = -1, bestV = 0
  for (let x = Math.floor(w * from); x < Math.floor(w * to); x++) {
    const v = colInk[x] / h
    if (v > bestV) { bestV = v; best = x }
  }
  if (bestV < minRatio) return null
  // a line is a few pixels wide — report its middle
  let lo = best, hi = best
  while (lo > 0 && colInk[lo - 1] / h >= bestV * 0.6) lo--
  while (hi < w - 1 && colInk[hi + 1] / h >= bestV * 0.6) hi++
  return Math.round((lo + hi) / 2)
}

// Where the printed captions start: a thin band of ink at the very bottom, separated from the figures by blank rows.
// Returns the y to cut at (rows from there down are dropped); h when there is no separate caption band.
export function findCaptionCut(rowInk, { minGap = 0.015, maxBand = 0.2 } = {}) {
  const h = rowInk.length
  const blank = y => rowInk[y] <= 1
  let y = h - 1
  while (y > 0 && blank(y)) y--           // trailing blank rows
  const bandBottom = y
  while (y > 0 && !blank(y)) y--          // the band itself
  const bandTop = y + 1
  if (bandBottom <= bandTop || (bandBottom - bandTop) / h > maxBand) return h
  let gapEnd = y
  while (y > 0 && blank(y)) y--           // gap between figures and the band
  const gapStart = y + 1
  if ((gapEnd - gapStart + 1) / h < minGap) return h
  return gapStart                          // the figures end here
}

// Four equal option columns between x0 and x1.
export function optionColumns(x0, x1, n = 4) {
  const span = x1 - x0, cols = []
  for (let i = 0; i < n; i++) cols.push([Math.round(x0 + (span * i) / n), Math.round(x0 + (span * (i + 1)) / n)])
  return cols
}

// The four option figures themselves: runs of columns with ink, separated by blank gaps. Returns four [x0,x1)
// ranges, or null when the picture does not show exactly four clear figures (then equal columns are used).
export function findOptionRuns(lum, w, x0, y1, minGap) {
  const ink = x => { for (let y = 0; y < y1; y++) if (lum[y * w + x] < 150) return true; return false }
  const runs = []
  let start = -1, blankRun = 0
  for (let x = x0; x < w; x++) {
    if (ink(x)) { if (start < 0) start = x; blankRun = 0 }
    else if (start >= 0) { blankRun++; if (blankRun >= minGap) { runs.push([start, x - blankRun + 1]); start = -1; blankRun = 0 } }
  }
  if (start >= 0) runs.push([start, w])
  // specks next to the divider are not figures
  let found = runs.filter(([a, b]) => b - a >= Math.max(8, (w - x0) * 0.04))
  if (found.length === 4) return found
  // frames that touch each other come out as one wide run: split it into as many equal frames as it holds
  if (found.length > 0 && found.length < 4) {
    const unit = Math.min(...found.map(([a, b]) => b - a))
    const parts = found.map(([a, b]) => Math.max(1, Math.round((b - a) / unit)))
    if (parts.reduce((x, y) => x + y, 0) === 4) {
      found = found.flatMap(([a, b], i) => Array.from({ length: parts[i] }, (_, k) => [Math.round(a + ((b - a) * k) / parts[i]), Math.round(a + ((b - a) * (k + 1)) / parts[i])]))
      return found
    }
  }
  return null
}

// Smallest box holding all the ink inside [x0,x1)×[y0,y1), padded; null when empty.
export function inkBox(lum, w, x0, x1, y0, y1, pad = 4, dark = 150) {
  let minX = x1, maxX = x0 - 1, minY = y1, maxY = y0 - 1
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    if (lum[y * w + x] < dark) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y }
  }
  if (maxX < minX) return null
  return { x0: clamp(minX - pad, x0, x1), x1: clamp(maxX + 1 + pad, x0, x1), y0: clamp(minY - pad, y0, y1), y1: clamp(maxY + 1 + pad, y0, y1) }
}

// The whole plan from a grayscale picture: where to cut. dividerPct / captionPct override the detection.
export function planSplit(lum, w, h, { dividerX = null, cutY = null } = {}) {
  const { colInk, rowInk } = inkCounts(lum, w, h)
  const div = dividerX ?? findDivider(colInk, h) ?? Math.round(w * 0.25)
  // look for captions only in the options area so the question figure cannot hide the gap
  const optRows = new Array(h).fill(0)
  for (let y = 0; y < h; y++) { let n = 0; for (let x = div + 3; x < w; x++) if (lum[y * w + x] < 150) n++; optRows[y] = n }
  const cut = cutY ?? findCaptionCut(optRows)
  const divider = div
  const qBox = inkBox(lum, w, 0, Math.max(1, divider - 2), 0, cut, 6)
  const runs = findOptionRuns(lum, w, divider + 3, cut, Math.max(6, Math.round(w * 0.006)))
  let cols
  if (runs) {
    // same width for all four, each centred on its own figure, so the pictures print the same size
    const widest = Math.max(...runs.map(([a, b]) => b - a)) + 12
    cols = runs.map(([a, b]) => { const mid = (a + b) / 2; return [Math.max(0, Math.round(mid - widest / 2)), Math.min(w, Math.round(mid + widest / 2))] })
  } else cols = optionColumns(divider + 3, w, 4)
  const boxes = cols.map(([a, b]) => inkBox(lum, w, a, b, 0, cut, 6))
  // keep the four option pictures the same size: one shared top/bottom
  const ys = boxes.filter(Boolean)
  const top = ys.length ? Math.min(...ys.map(b => b.y0)) : 0, bottom = ys.length ? Math.max(...ys.map(b => b.y1)) : cut
  return { divider, cut, question: qBox, options: cols.map(([a, b]) => ({ x0: a, x1: b, y0: top, y1: bottom })), detected: { divider: dividerX == null && findDivider(colInk, h) != null, caption: cutY == null && cut < h, frames: !!runs } }
}
