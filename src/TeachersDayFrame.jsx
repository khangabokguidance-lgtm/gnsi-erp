import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from './supabase'
import { LOGO_BASE64 } from './logo'

const FONT_URL =
  'https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;900&family=Great+Vibes&family=Cormorant+Garamond:ital,wght@0,500;0,700;1,500&display=swap'

const CSS = `
.tdf-page{width:210mm;height:297mm;position:relative;overflow:hidden;background:radial-gradient(ellipse at 50% 38%,#17356f 0%,#0d2350 38%,#07142e 80%);font-family:'Cormorant Garamond',Georgia,serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;break-after:page}
.tdf-page:before{content:"";position:absolute;inset:0;opacity:.07;background:repeating-linear-gradient(45deg,#d9b25a 0 1px,transparent 1px 14px),repeating-linear-gradient(-45deg,#d9b25a 0 1px,transparent 1px 14px)}
.tdf-b1,.tdf-b2,.tdf-b3{position:absolute;pointer-events:none}
.tdf-b1{inset:7mm;border:1.6mm solid transparent;border-image:linear-gradient(135deg,#f6e3a1,#a77d2a,#f6e3a1,#a77d2a) 1}
.tdf-b2{inset:11.5mm;border:.5mm solid #d9b25a}.tdf-b3{inset:14mm;border:.25mm dashed #d9b25a99}
.tdf-corner{position:absolute;width:30mm;height:30mm;pointer-events:none}
.tdf-corner svg{width:100%;height:100%}
.tdf-content{position:absolute;inset:18mm 20mm;display:flex;flex-direction:column;align-items:center;text-align:center;color:#f6e3a1}
.tdf-logo{width:22mm;height:22mm;border-radius:50%;border:.8mm solid #d9b25a;object-fit:cover;background:#fff;box-shadow:0 0 0 1.2mm #07142e,0 0 0 1.8mm #d9b25a}
.tdf-inst{font:700 4.6mm 'Cinzel',serif;letter-spacing:.9mm;margin-top:4mm;color:#d9b25a}
.tdf-inst small{display:block;font-size:2.8mm;letter-spacing:.7mm;color:#f6e3a1;font-weight:500;margin-top:1mm}
.tdf-rule{display:flex;align-items:center;gap:3mm;margin-top:3.5mm}
.tdf-rule i{height:.3mm;width:38mm;background:linear-gradient(90deg,transparent,#d9b25a)}.tdf-rule i:last-child{transform:scaleX(-1)}
.tdf-rule b{width:2.2mm;height:2.2mm;background:#d9b25a;transform:rotate(45deg)}
.tdf-happy{font:400 22mm/1 'Great Vibes',cursive;margin-top:5mm;background:linear-gradient(180deg,#fff3c4,#d9b25a 55%,#a77d2a);-webkit-background-clip:text;background-clip:text;color:transparent}
.tdf-td{font:900 10.5mm 'Cinzel',serif;letter-spacing:2.2mm;margin-top:1mm;color:#f6e3a1;text-shadow:0 .5mm 1mm #000a}
.tdf-photo-wrap{position:relative;margin-top:7mm;width:104mm;height:128mm}
.tdf-ring{position:absolute;inset:0;border-radius:52mm 52mm 4mm 4mm;background:linear-gradient(135deg,#f6e3a1,#a77d2a 40%,#f6e3a1 60%,#a77d2a);padding:2.4mm;box-shadow:0 3mm 9mm #000c,0 0 14mm #d9b25a55}
.tdf-ring2{width:100%;height:100%;border-radius:50mm 50mm 2.5mm 2.5mm;background:#07142e;padding:1.4mm}
.tdf-photo{width:100%;height:100%;border-radius:48.6mm 48.6mm 1.4mm 1.4mm;overflow:hidden;background:#eef0f4;position:relative}
.tdf-photo img{width:100%;height:100%;object-fit:cover;object-position:center top;display:block}
.tdf-ph{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#a9afbd}
.tdf-ph svg{width:34mm}
.tdf-star{position:absolute;color:#d9b25a;font-size:7mm}
.tdf-name{font:700 9mm 'Cinzel',serif;margin-top:8mm;letter-spacing:.8mm;color:#fff;text-shadow:0 .4mm .8mm #000;max-width:165mm}
.tdf-desig{font:italic 600 6.2mm 'Cormorant Garamond',serif;color:#d9b25a;margin-top:1.5mm}
.tdf-quote{font:italic 500 5.2mm/1.3 'Cormorant Garamond',serif;margin-top:5mm;max-width:150mm;color:#f6e3a1}
.tdf-foot{margin-top:auto;width:100%;padding-top:4mm}
.tdf-dates{display:inline-block;border:.4mm solid #d9b25a;padding:2.6mm 9mm;background:linear-gradient(90deg,#d9b25a22,#d9b25a44,#d9b25a22);font:700 5mm 'Cinzel',serif;letter-spacing:.6mm;color:#fff}
.tdf-dates sup,.tdf-batch sup{font-size:.55em;line-height:0;vertical-align:super;letter-spacing:0}
.tdf-pres{font:500 3.6mm 'Cinzel',serif;letter-spacing:1.2mm;margin-top:4mm;color:#d9b25a}
.tdf-batch{font:400 11mm/1.1 'Great Vibes',cursive;color:#f6e3a1;margin-top:1mm}
.tdf-batch b{font:900 9mm 'Cinzel',serif;color:#d9b25a}
.tdf-print{display:none}
@media print{
  @page{size:A4 portrait;margin:0}
  body>*:not(.tdf-print){display:none!important}
  .tdf-print{display:block!important}
}
`

const Corner = ({ flip }) => (
  <div className="tdf-corner" style={{ ...flip.pos, transform: flip.t }}>
    <svg viewBox="0 0 100 100"><g fill="none" stroke="#d9b25a" strokeWidth="1.6">
      <path d="M4 96V4h92" /><path d="M12 80V12h68" />
      <path d="M12 12c20 0 30 10 30 30M12 12c0 20 10 30 30 30" />
      <circle cx="12" cy="12" r="5" fill="#d9b25a" />
      <path d="M20 40c8-2 14 2 16 10M40 20c-2 8 2 14 10 16" />
    </g></svg>
  </div>
)
const CORNERS = [
  { pos: { top: '9mm', left: '9mm' }, t: 'none' },
  { pos: { top: '9mm', right: '9mm' }, t: 'scaleX(-1)' },
  { pos: { bottom: '9mm', left: '9mm' }, t: 'scaleY(-1)' },
  { pos: { bottom: '9mm', right: '9mm' }, t: 'scale(-1)' },
]

function Frame({ s, cfg }) {
  return (
    <div className="tdf-page">
      <div className="tdf-b1" /><div className="tdf-b2" /><div className="tdf-b3" />
      {CORNERS.map((c, i) => <Corner key={i} flip={c} />)}
      <div className="tdf-content">
        <img className="tdf-logo" src={`data:image/jpeg;base64,${LOGO_BASE64}`} alt="" />
        <div className="tdf-inst">GUIDANCE NAVODAYA &amp; SAINIK INSTITUTE<small>— GNSI —</small></div>
        <div className="tdf-rule"><i /><b /><i /></div>
        <div className="tdf-happy">Happy</div>
        <div className="tdf-td">TEACHERS&apos; DAY</div>
        <div className="tdf-photo-wrap">
          <div className="tdf-ring"><div className="tdf-ring2"><div className="tdf-photo">
            {s.photo
              ? <img src={s.photo} alt="" />
              : <div className="tdf-ph"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4.5" /><path d="M3 22c0-5 4-8 9-8s9 3 9 8z" /></svg></div>}
          </div></div></div>
          <span className="tdf-star" style={{ left: '-9mm', top: '40mm' }}>✦</span>
          <span className="tdf-star" style={{ right: '-9mm', top: '60mm' }}>✦</span>
        </div>
        <div className="tdf-name">{(s.name || '').toUpperCase()}</div>
        <div className="tdf-desig">{s.desig}</div>
        {cfg.quote && <div className="tdf-quote">{cfg.quote}</div>}
        <div className="tdf-foot">
          <div className="tdf-dates">✦ {cfg.dates} ✦</div>
          <div className="tdf-pres">WITH GRATITUDE, PRESENTED BY</div>
          <div className="tdf-batch"><b>{cfg.batch}</b> Batch Students</div>
        </div>
      </div>
    </div>
  )
}

const inp = { padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14, width: '100%', boxSizing: 'border-box' }

export default function TeachersDayFrame() {
  const [staff, setStaff] = useState([])
  const [picked, setPicked] = useState({})
  const [manual, setManual] = useState([])
  const [loading, setLoading] = useState(true)
  const [cfg, setCfg] = useState({
    dates: '16th & 17th OCTOBER 2026', batch: '10th',
    quote: '“A good teacher is like a candle — it consumes itself to light the way for others.”',
  })
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!document.getElementById('tdf-fonts')) {
      const l = document.createElement('link'); l.id = 'tdf-fonts'; l.rel = 'stylesheet'; l.href = FONT_URL
      document.head.appendChild(l)
    }
    supabase.from('website_faculty').select('*').order('sort_order').order('name').then(({ data }) => {
      setStaff((data || []).map(f => ({
        id: 'f' + f.id, name: f.name || '',
        desig: [f.role, f.subject].filter(Boolean).join(' · '),
        photo: f.photo_url || f.image_url || f.photo || '',
      })))
      setLoading(false)
    })
  }, [])

  const all = useMemo(() => [...staff, ...manual], [staff, manual])
  const selected = all.filter(s => picked[s.id])
  const shown = all.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
  const toggle = id => setPicked(p => ({ ...p, [id]: !p[id] }))
  const patch = (id, k, v) => {
    const f = list => list.map(s => (s.id === id ? { ...s, [k]: v } : s))
    setStaff(f); setManual(f)
  }
  const addManual = () => {
    const id = 'm' + Date.now()
    setManual(m => [...m, { id, name: 'New Staff', desig: '', photo: '' }])
    setPicked(p => ({ ...p, [id]: true }))
  }
  const upload = (id, file) => {
    if (!file) return
    const r = new FileReader(); r.onload = e => patch(id, 'photo', e.target.result); r.readAsDataURL(file)
  }
  const setAll = v => setPicked(Object.fromEntries(shown.map(s => [s.id, v])))
  const preview = selected[0]

  return (
    <div style={{ padding: 16 }}>
      <style>{CSS}</style>
      <h2 style={{ margin: '0 0 4px' }}>🎓 Teachers&apos; Day Frames</h2>
      <p style={{ margin: '0 0 14px', color: '#64748b', fontSize: 14 }}>
        A4 premium photo frame for each staff member — pulled from the website faculty list. Select staff, then print (one page each).
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10, marginBottom: 14 }}>
        <label>Dates<input style={inp} value={cfg.dates} onChange={e => setCfg({ ...cfg, dates: e.target.value })} /></label>
        <label>Batch<input style={inp} value={cfg.batch} onChange={e => setCfg({ ...cfg, batch: e.target.value })} /></label>
        <label style={{ gridColumn: '1/-1' }}>Quote (optional)<input style={inp} value={cfg.quote} onChange={e => setCfg({ ...cfg, quote: e.target.value })} /></label>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <input style={{ ...inp, maxWidth: 240 }} placeholder="Search staff…" value={search} onChange={e => setSearch(e.target.value)} />
        <button onClick={() => setAll(true)}>Select all</button>
        <button onClick={() => setAll(false)}>Clear</button>
        <button onClick={addManual}>＋ Add staff manually</button>
        <button disabled={!selected.length} onClick={() => window.print()}
          style={{ background: '#b8892b', color: '#fff', border: 0, borderRadius: 6, padding: '6px 14px', fontWeight: 700 }}>
          🖨 Print {selected.length || ''} frame{selected.length === 1 ? '' : 's'} (A4)
        </button>
      </div>
      <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 10px' }}>In the print dialog choose Paper A4, Margins None, and tick Background graphics.</p>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 340px', maxHeight: 620, overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 10 }}>
          {loading && <div style={{ padding: 14 }}>Loading website staff…</div>}
          {!loading && !shown.length && <div style={{ padding: 14 }}>No staff found.</div>}
          {shown.map(s => (
            <div key={s.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 10px', borderBottom: '1px solid #f1f5f9' }}>
              <input type="checkbox" checked={!!picked[s.id]} onChange={() => toggle(s.id)} />
              {s.photo
                ? <img src={s.photo} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                : <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#e2e8f0' }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <input style={{ ...inp, padding: '4px 6px', fontWeight: 600 }} value={s.name} onChange={e => patch(s.id, 'name', e.target.value)} />
                <input style={{ ...inp, padding: '4px 6px', marginTop: 3, fontSize: 12 }} placeholder="Designation" value={s.desig} onChange={e => patch(s.id, 'desig', e.target.value)} />
              </div>
              <label style={{ fontSize: 12, cursor: 'pointer', color: '#2563eb' }}>
                {s.photo ? 'Change' : 'Add'} photo
                <input type="file" accept="image/*" hidden onChange={e => upload(s.id, e.target.files[0])} />
              </label>
            </div>
          ))}
        </div>
        <div style={{ flex: '0 0 auto' }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Preview{preview ? ` — ${preview.name}` : ' (select staff)'}</div>
          <div style={{ width: 210 * 1.5, height: 297 * 1.5, overflow: 'hidden', borderRadius: 6, boxShadow: '0 4px 18px #0004' }}>
            <div style={{ transform: 'scale(.3969)', transformOrigin: 'top left', width: '210mm' }}>
              <Frame s={preview || { name: 'Staff Name', desig: 'Designation', photo: '' }} cfg={cfg} />
            </div>
          </div>
        </div>
      </div>

      {createPortal(
        <div className="tdf-print">{selected.map(s => <Frame key={s.id} s={s} cfg={cfg} />)}</div>,
        document.body,
      )}
    </div>
  )
}
