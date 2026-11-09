import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from './supabase'
import { drawBirthday, THEMES, LAYOUTS, MESSAGES, SIZE } from './birthdayDraw'

const FONTS = [`700 20px 'Cinzel'`, `800 20px 'Cinzel'`, `500 20px 'Cinzel'`, `400 20px 'Great Vibes'`, `italic 400 20px 'Playfair Display'`]
const inp = { padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14, width: '100%', boxSizing: 'border-box' }

const ordinal = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 >> 3) ^ 1 && n % 10 < 4 ? n % 10 : 0] || 'th')
const today = () => { const d = new Date(); return `${ordinal(d.getDate())} ${d.toLocaleString('en-GB', { month: 'long' })} ${d.getFullYear()}` }

// Design Studio → Birthday: a WhatsApp-square (1080 × 1080) greeting card for any staff member,
// using the photo from Website Manager → Faculty. Drawn on a canvas so what you see is what you download.
export default function BirthdayCard() {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [id, setId] = useState('')
  const [search, setSearch] = useState('')
  const [theme, setTheme] = useState('navy')
  const [layout, setLayout] = useState('arch')
  const [honorific, setHonorific] = useState('Sir')
  const [msgKey, setMsgKey] = useState('loyalty')
  const [msg, setMsg] = useState(MESSAGES.loyalty)
  const [date, setDate] = useState(today())
  const [from, setFrom] = useState('Your GNSI Family')
  const [photoOverride, setPhotoOverride] = useState('')
  const [loaded, setLoaded] = useState({ url: '', im: null, bad: false })
  const [actionNote, setNote] = useState('')
  const canvas = useRef(null)

  useEffect(() => {
    if (!document.getElementById('tdf-fonts-local')) {
      const l = document.createElement('link'); l.id = 'tdf-fonts-local'; l.rel = 'stylesheet'; l.href = '/design-studio/fonts/fonts.css'
      document.head.appendChild(l)
    }
    supabase.from('website_faculty').select('*').order('sort_order').order('name').then(({ data }) => {
      const rows = (data || []).map(f => ({ id: String(f.id), name: (f.name || '').trim(), role: [f.role, f.subject].filter(Boolean).join(' · '), photo: f.photo_url || f.image_url || f.photo || '' }))
      setStaff(rows)
      const first = rows.find(r => /roshan/i.test(r.name)) || rows[0]
      if (first) setId(first.id)
      setLoading(false)
    })
  }, [])

  const person = staff.find(s => s.id === id)
  const photoUrl = photoOverride || person?.photo || ''
  const shown = useMemo(() => staff.filter(s => s.name.toLowerCase().includes(search.toLowerCase())), [staff, search])

  useEffect(() => {
    if (!photoUrl) return
    let dead = false
    const im = new Image(); im.crossOrigin = 'anonymous'
    im.onload = () => { if (!dead) setLoaded({ url: photoUrl, im, bad: false }) }
    im.onerror = () => { if (!dead) setLoaded({ url: photoUrl, im: null, bad: true }) }
    im.src = photoUrl
    return () => { dead = true }
  }, [photoUrl])

  const img = loaded.url === photoUrl ? loaded.im : null
  const loadFailed = loaded.url === photoUrl && loaded.bad
  const fullName = [honorific, person?.name].filter(Boolean).join(' ')
  useEffect(() => {
    let dead = false
    Promise.all(FONTS.map(f => document.fonts.load(f).catch(() => null))).then(() => {
      const c = canvas.current; if (dead || !c) return
      drawBirthday(c.getContext('2d'), { theme, layout, name: fullName || 'Staff Name', role: person?.role || '', msg, date, from }, img)
    })
    return () => { dead = true }
  }, [theme, layout, fullName, person, msg, date, from, img])

  const upload = file => {
    if (!file) return
    const r = new FileReader(); r.onload = e => setPhotoOverride(e.target.result); r.readAsDataURL(file)
  }
  const blob = () => new Promise((res, rej) => canvas.current.toBlob(b => (b ? res(b) : rej(new Error('empty'))), 'image/png'))
  const fileName = `birthday-${(person?.name || 'staff').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`
  const download = async () => {
    try {
      const b = await blob(), a = document.createElement('a')
      a.href = URL.createObjectURL(b); a.download = fileName; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000)
    } catch { setNote('This photo blocks export — use "Upload photo" with a copy of it, then download.') }
  }
  const share = async () => {
    try {
      const f = new File([await blob()], fileName, { type: 'image/png' })
      if (navigator.canShare?.({ files: [f] })) await navigator.share({ files: [f], title: fullName })
      else await download()
    } catch (e) { if (e?.name !== 'AbortError') setNote('Could not share — use Download instead.') }
  }

  const pickMsg = k => { setMsgKey(k); if (MESSAGES[k]) setMsg(MESSAGES[k]) }

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ margin: '0 0 4px' }}>🎂 Birthday Cards</h2>
      <p style={{ margin: '0 0 14px', color: '#64748b', fontSize: 14 }}>
        Square card (1080 × 1080) for WhatsApp / Instagram, with the staff photo from Website Manager → Faculty. Pick a person, colour and message, then download or share.
      </p>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 320px', maxWidth: 520, display: 'grid', gap: 10 }}>
          <label>Staff member
            <input style={{ ...inp, marginBottom: 6 }} placeholder="Search staff…" value={search} onChange={e => setSearch(e.target.value)} />
            <select style={inp} size={6} value={id} onChange={e => { setId(e.target.value); setPhotoOverride('') }}>
              {loading && <option>Loading…</option>}
              {shown.map(s => <option key={s.id} value={s.id}>{s.name}{s.photo ? '' : ' (no photo)'}</option>)}
            </select>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 10 }}>
            <label>Title<select style={inp} value={honorific} onChange={e => setHonorific(e.target.value)}>
              {['Sir', 'Madam', 'Dr.', ''].map(h => <option key={h} value={h}>{h || '(none)'}</option>)}
            </select></label>
            <label>Photo<span style={{ display: 'block', ...inp, color: '#2563eb', cursor: 'pointer' }}>
              {photoOverride ? 'Uploaded — change' : 'Upload a different photo'}
              <input type="file" accept="image/*" hidden onChange={e => upload(e.target.files[0])} /></span></label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label>Colour<select style={inp} value={theme} onChange={e => setTheme(e.target.value)}>
              {Object.entries(THEMES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select></label>
            <label>Layout<select style={inp} value={layout} onChange={e => setLayout(e.target.value)}>
              {Object.entries(LAYOUTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></label>
          </div>
          <label>Message
            <select style={{ ...inp, marginBottom: 6 }} value={msgKey} onChange={e => pickMsg(e.target.value)}>
              <option value="loyalty">Loyalty — “stood like a wall”</option>
              <option value="family">Family — “hold up a family”</option>
              <option value="wish">Simple birthday wish</option>
              <option value="custom">Custom (edit below)</option>
            </select>
            <textarea style={{ ...inp, minHeight: 90 }} value={msg} onChange={e => { setMsg(e.target.value); setMsgKey('custom') }} />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label>Date<input style={inp} value={date} onChange={e => setDate(e.target.value)} /></label>
            <label>From<input style={inp} value={from} onChange={e => setFrom(e.target.value)} /></label>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={download} disabled={!person}
              style={{ background: '#b8892b', color: '#fff', border: 0, borderRadius: 6, padding: '8px 16px', fontWeight: 700, cursor: 'pointer' }}>⬇ Download PNG</button>
            <button onClick={share} disabled={!person} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>📲 Share to WhatsApp</button>
          </div>
          {(actionNote || loadFailed) && <div style={{ color: '#b91c1c', fontSize: 13 }}>{actionNote || 'Could not load this photo — upload one instead.'}</div>}
        </div>
        <div style={{ flex: '1 1 340px' }}>
          <canvas ref={canvas} width={SIZE} height={SIZE} style={{ width: 'min(100%,540px)', height: 'auto', aspectRatio: '1', borderRadius: 6, boxShadow: '0 4px 18px #0004', display: 'block' }} />
        </div>
      </div>
    </div>
  )
}
