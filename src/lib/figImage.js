// Resize a picked image to at most 640px wide and return a compact data: URL (figures are stored with the question).
export function figFromFile(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type)) return reject(new Error('Choose an image file.'))
    const fr = new FileReader()
    fr.onerror = () => reject(new Error('Could not read the image.'))
    fr.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Could not open the image.'))
      img.onload = () => {
        const k = Math.min(1, 640 / img.width), c = document.createElement('canvas')
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height)
        const out = c.toDataURL('image/jpeg', 0.8)
        out.length > 350000 ? reject(new Error('Figure is too large — use a smaller or simpler image.')) : resolve(out)
      }
      img.src = fr.result
    }
    fr.readAsDataURL(file)
  })
}
