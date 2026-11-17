// Pixel helpers for "scan a figure": clean up a phone photo of a printed page. All work on canvas ImageData-like
// objects ({ data: Uint8ClampedArray RGBA, width, height }) so they can be tested without a browser.

const lum = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]

// Stretch the tonal range so paper becomes white and ink dark (auto-levels on the 1st–99th percentile).
export function autoLevels(img) {
  const d = img.data, hist = new Uint32Array(256)
  for (let i = 0; i < d.length; i += 4) hist[Math.round(lum(d, i))]++
  const total = d.length / 4
  let lo = 0, hi = 255, acc = 0
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= total * 0.01) { lo = v; break } }
  acc = 0
  for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc >= total * 0.01) { hi = v; break } }
  if (hi - lo < 16) return img                      // flat image: nothing to stretch
  const k = 255 / (hi - lo)
  for (let i = 0; i < d.length; i += 4) for (let c = 0; c < 3; c++) d[i + c] = Math.max(0, Math.min(255, (d[i + c] - lo) * k))
  return img
}

// Otsu's method: the threshold that best separates dark ink from light paper.
export function otsu(img) {
  const d = img.data, hist = new Uint32Array(256)
  for (let i = 0; i < d.length; i += 4) hist[Math.round(lum(d, i))]++
  const total = d.length / 4
  let sum = 0; for (let v = 0; v < 256; v++) sum += v * hist[v]
  let sumB = 0, wB = 0, best = 0, thr = 127
  for (let v = 0; v < 256; v++) {
    wB += hist[v]; if (!wB) continue
    const wF = total - wB; if (!wF) break
    sumB += v * hist[v]
    const mB = sumB / wB, mF = (sum - sumB) / wF, between = wB * wF * (mB - mF) ** 2
    if (between > best) { best = between; thr = v }
  }
  return thr
}

// Pure black and white at the given threshold.
export function blackAndWhite(img, t = otsu(img)) {
  const d = img.data
  for (let i = 0; i < d.length; i += 4) { const v = lum(d, i) > t ? 255 : 0; d[i] = d[i + 1] = d[i + 2] = v }
  return img
}

// Bounding box of everything that is not (near) white, with a little padding — used to trim page margins.
export function trimBox(img, { bg = 235, pad = 8 } = {}) {
  const { data: d, width: w, height: h } = img
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (lum(d, (y * w + x) * 4) < bg) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y } }
  if (x1 < 0) return null
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad)
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}
