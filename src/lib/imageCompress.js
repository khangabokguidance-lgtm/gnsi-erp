// ─── imageCompress.js ────────────────────────────────────────────────────────
// Shrinks a photo in the browser BEFORE it is uploaded, so student photos stay
// small (a phone camera photo is typically 3–8 MB; this brings it to ~100–250 KB)
// without a visible loss for ID cards, receipts and reports.
//
//   const info = await compressImage(file)            // File from <input type=file>
//   info.file     → the File to upload (JPEG, or the original if it was already small)
//   info.before / info.after → sizes in bytes;  info.changed → false if left as-is
//
// How: decode (honouring the camera's rotation), scale down so the longest side is
// at most `maxDim`, draw on a white background (JPEG has no transparency) and encode
// as JPEG. If the result is still above `targetKB`, lower the quality step by step,
// then shrink the picture a little more and try again. If anything fails, or the
// result would not be smaller, the original file is returned untouched.

const KB = 1024

export const fmtSize = bytes =>
  bytes >= KB * KB ? `${(bytes / KB / KB).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / KB))} KB`

// "3.1 MB → 212 KB (93% smaller)"
export const sizeNote = info => {
  if (!info) return ''
  if (!info.changed) return `${fmtSize(info.before)} (already small, kept as is)`
  const pct = Math.max(0, Math.round((1 - info.after / info.before) * 100))
  return `${fmtSize(info.before)} → ${fmtSize(info.after)} (${pct}% smaller)`
}

async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }) } catch { /* fall back to <img> */ }
  }
  const url = URL.createObjectURL(file)
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Could not read this image.'))
      img.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

const toBlob = (canvas, quality) => new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))

export async function compressImage(file, { maxDim = 1000, quality = 0.85, minQuality = 0.55, targetKB = 250 } = {}) {
  const before = file?.size || 0
  const unchanged = { file, before, after: before, width: null, height: null, changed: false }
  if (!file || !file.type || !file.type.startsWith('image/')) return unchanged

  let img
  try { img = await decode(file) } catch { return unchanged }
  const w0 = img.width || img.naturalWidth
  const h0 = img.height || img.naturalHeight
  if (!w0 || !h0) return unchanged

  let scale = Math.min(1, maxDim / Math.max(w0, h0))
  let best = null
  try {
    for (let round = 0; round < 5; round++) {
      const w = Math.max(1, Math.round(w0 * scale))
      const h = Math.max(1, Math.round(h0 * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return unchanged
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, w, h)
      for (let q = quality; q >= minQuality - 1e-9; q -= 0.07) {
        const blob = await toBlob(canvas, q)
        if (!blob) return unchanged
        best = { blob, w, h }
        if (blob.size <= targetKB * KB) break
      }
      if (best.blob.size <= targetKB * KB) break
      scale *= 0.85 // still too big at the lowest quality: make the picture itself a bit smaller
    }
  } catch {
    return unchanged
  } finally {
    if (typeof img.close === 'function') img.close()
  }

  // Never make a small, already-fine photo bigger.
  if (!best || best.blob.size >= before) return unchanged

  const base = (file.name || 'photo').replace(/\.[^.]+$/, '') || 'photo'
  const out = new File([best.blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
  return { file: out, before, after: out.size, width: best.w, height: best.h, changed: true }
}
