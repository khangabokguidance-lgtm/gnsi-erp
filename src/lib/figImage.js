// Resize a picked image to at most 640px wide and return a compact data: URL (figures are stored with the question).
export function figFromFile(file, { maxW = 640, quality = 0.8, cap = 350000, label = 'Figure' } = {}) {
  return new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type)) return reject(new Error('Choose an image file.'))
    const fr = new FileReader()
    fr.onerror = () => reject(new Error('Could not read the image.'))
    fr.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Could not open the image.'))
      img.onload = () => {
        const k = Math.min(1, maxW / img.width), c = document.createElement('canvas')
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height)
        const out = c.toDataURL('image/jpeg', quality)
        out.length > cap ? reject(new Error(label + ' is too large — use a smaller or simpler image.')) : resolve(out)
      }
      img.src = fr.result
    }
    fr.readAsDataURL(file)
  })
}

// Draw an SVG string onto a white JPEG data URL (used for generated Venn diagrams and option pictures).
export function svgToJpeg(svg, w, h, { scale = 2, quality = 0.85 } = {}) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
    const img = new Image()
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not draw the diagram.')) }
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = Math.round(w * scale); c.height = Math.round(h * scale)
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', quality))
    }
    img.src = url
  })
}
