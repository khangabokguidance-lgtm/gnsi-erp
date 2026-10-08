import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

// ══════════════════════════════════════════════════════════════
//  HOUSE DAILY REPORT MODAL
//  Auto-opens when a house hits 100% roll call. Pulls:
//   - Present / Absent / Late (from attendance_records, already loaded)
//   - On Leave students (from leave_records, from_date <= date <= to_date)
//   - Sickbay / health status (from sickbay_records, status = Admitted)
//  Printable via window.print() with a dedicated print stylesheet.
// ══════════════════════════════════════════════════════════════

const SERIF = "'Playfair Display', Georgia, serif"
const SANS = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif"
const GOLD_LT = '#E2C57E'
// "2026-10-06" -> "6 Oct"
const shortDate = d => (d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '')

const btn = (bg = '#1e3a5f', c = 'white') => ({
  background: bg, color: c, border: 'none', borderRadius: '12px',
  padding: '11px 18px', fontWeight: '800', cursor: 'pointer', fontSize: '13px', fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
})

export default function HouseReportModal({ house, date, session, students, allRecords, onClose }) {
  const [leaveRecords, setLeaveRecords] = useState([])
  const [sickbayRecords, setSickbayRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const printAreaRef = useRef(null)
  const [whatsappStatus, setWhatsappStatus] = useState('idle') // idle | generating | ready | error

  // Lazily load html2canvas from CDN once, cache on window so repeat opens are instant
  const loadHtml2Canvas = () => {
    if (window.html2canvas) return Promise.resolve(window.html2canvas)
    if (window.__html2canvasLoading) return window.__html2canvasLoading
    window.__html2canvasLoading = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
      script.onload = () => resolve(window.html2canvas)
      script.onerror = reject
      document.head.appendChild(script)
    })
    return window.__html2canvasLoading
  }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      // A failed load (e.g. the connection dropped) still shows the report,
      // just without leave and sickbay details — never a stuck spinner.
      const [{ data: leave }, { data: sick }] = await Promise.all([
        supabase
          .from('leave_records')
          .select('*')
          .lte('from_date', date)
          .gte('to_date', date)
          .in('status', ['Approved', 'Pending']),
        supabase
          .from('sickbay_records')
          .select('*')
          .eq('status', 'Admitted'),
      ].map(q => Promise.resolve(q).catch(() => ({ data: [] }))))
      if (!cancelled) {
        setLeaveRecords(leave || [])
        setSickbayRecords(sick || [])
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [date, house])

  if (!house) return null

  const normalizeHouse = (h) => (h || '').toString().trim().toLowerCase()
  const houseStudents = students.filter(s => normalizeHouse(s.house) === normalizeHouse(house) && s.status !== 'Inactive')
  const recordMap = Object.fromEntries(allRecords.filter(r => normalizeHouse(r.house) === normalizeHouse(house)).map(r => [r.student_id, r]))

  const present = houseStudents.filter(s => recordMap[s.id]?.status === 'Present')
  const absent = houseStudents.filter(s => recordMap[s.id]?.status === 'Absent')
  const late = houseStudents.filter(s => recordMap[s.id]?.status === 'Late')
  const onLeaveMarked = houseStudents.filter(s => recordMap[s.id]?.status === 'On Leave')
  const sickMarked = houseStudents.filter(s => recordMap[s.id]?.status === 'Sick')

  // Cross-reference leave_records for richer detail (reason, dates) where available
  const leaveDetails = houseStudents
    .map(s => {
      const rec = leaveRecords.find(l => l.student_id === s.id)
      return rec ? { student: s, leave: rec } : null
    })
    .filter(Boolean)

  const sickbayDetails = houseStudents
    .map(s => {
      const rec = sickbayRecords.find(sb => sb.student_id === s.id)
      return rec ? { student: s, sickbay: rec } : null
    })
    .filter(Boolean)

  const total = houseStudents.length
  const marked = present.length + absent.length + late.length + onLeaveMarked.length + sickMarked.length

  const complete = total > 0 && marked === total
  const presentPct = total ? Math.round(((present.length + late.length) / total) * 100) : 0
  const houseName = String(house).trim().replace(/\b\w/g, c => c.toUpperCase())
  const longDate = new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const sickOnly = sickMarked.filter(s => !sickbayDetails.some(d => d.student.id === s.id))
  const STATS = [
    { label: 'Total', value: total, color: '#0B1E3D' },
    { label: 'Present', value: present.length + late.length, color: '#0F7A4C' },
    { label: 'Absent', value: absent.length, color: '#DC2626' },
    { label: 'On leave', value: onLeaveMarked.length, color: '#1D4ED8' },
    { label: 'Sick', value: sickMarked.length, color: '#7C3AED' },
  ]

  const handlePrint = () => {
    if (!printAreaRef.current) { window.print(); return }
    const clone = printAreaRef.current.cloneNode(true)
    clone.classList.add('hr-print-clone')
    document.body.appendChild(clone)
    window.print()
    document.body.removeChild(clone)
  }

  const handleSendWhatsapp = async () => {
    if (!printAreaRef.current || whatsappStatus === 'generating') return
    setWhatsappStatus('generating')
    try {
      const html2canvas = await loadHtml2Canvas()
      const canvas = await html2canvas(printAreaRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      })
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92))
      if (!blob) throw new Error('Could not generate image')

      const fileName = `${house}_report_${date}_${session}.jpg`
      const file = new File([blob], fileName, { type: 'image/jpeg' })
      const caption = `🏠 ${house} House — Daily Report\n${date} · ${session === 'morning' ? 'Morning' : 'Night'} Roll Call`

      // Mobile browsers that support the Web Share API with files can hand
      // the image straight to the WhatsApp share sheet (attached, not just text).
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: fileName, text: caption })
        setWhatsappStatus('ready')
        setTimeout(() => setWhatsappStatus('idle'), 2000)
        return
      }

      // Desktop fallback: download the JPG, then open WhatsApp Web with the
      // caption pre-filled so the user only needs to attach the file that
      // just downloaded — browsers cannot inject a file into wa.me links.
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      window.open(`https://wa.me/?text=${encodeURIComponent(caption + '\n\n(Attach the downloaded image: ' + fileName + ')')}`, '_blank')
      setWhatsappStatus('ready')
      setTimeout(() => setWhatsappStatus('idle'), 2000)
    } catch (err) {
      console.error('WhatsApp share failed:', err)
      setWhatsappStatus('error')
      setTimeout(() => setWhatsappStatus('idle'), 2500)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
    }} className="hr-modal-overlay">
      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          html, body { height: auto !important; overflow: visible !important; }
          .hr-print-clone, .hr-print-clone * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          /* Only .hr-print-clone (appended directly to <body> at print
             time) is shown; everything else in the document — including
             this modal and the rest of the app — is hidden outright. */
          body > *:not(.hr-print-clone) { display: none !important; }
          .hr-print-clone {
            display: block !important;
            position: static !important;
            width: 100% !important;
            font-size: 11px;
            line-height: 1.3;
            padding: 0;
          }
          .hr-print-clone h1, .hr-print-clone h2, .hr-print-clone h3 { margin: 0; }
          .hr-print-clone .hr-print-section { break-inside: avoid; margin-bottom: 8px !important; }
          .hr-print-clone .hr-print-row { padding: 4px 8px !important; }
        }
        @keyframes hr-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes hr-pop {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .hr-spinner {
          display: inline-block; width: 14px; height: 14px;
          border: 2px solid rgba(255,255,255,0.4); border-top-color: white;
          border-radius: 50%; animation: hr-spin 0.7s linear infinite;
        }
        .hr-pop-in { animation: hr-pop 0.35s ease-out; display: inline-block; }
      `}</style>
      <div style={{
        background: '#fff', borderRadius: '20px', maxWidth: '760px', width: '100%',
        maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 30px 80px -20px rgba(11,30,61,.55), 0 0 0 1px rgba(201,162,75,.25)',
      }}>
        <div className="hr-print-area" ref={printAreaRef} style={{ background: '#fff', fontFamily: SANS }}>
          {/* Header band */}
          <div style={{
            position: 'relative', padding: '26px 30px 24px', color: '#fff', borderRadius: '20px 20px 0 0', overflow: 'hidden',
            background: 'radial-gradient(120% 160% at 100% 0%, #1C3A6B 0%, #132B52 45%, #0B1E3D 85%)',
          }}>
            <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '3px', background: 'linear-gradient(90deg,#B8913F,#E2C57E,#B8913F)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '10.5px', fontWeight: 800, color: GOLD_LT, letterSpacing: '.18em', textTransform: 'uppercase' }}>GNSI Hostel · Daily House Report</div>
                <div style={{ fontFamily: SERIF, fontSize: '30px', fontWeight: 600, lineHeight: 1.15, marginTop: '6px' }}>{houseName} House</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,.72)', marginTop: '6px' }}>
                  {longDate} · {session === 'morning' ? 'Morning' : 'Night'} roll call
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '99px', fontSize: '12px', fontWeight: 800,
                  background: complete ? 'rgba(16,185,129,.16)' : 'rgba(234,179,8,.16)',
                  color: complete ? '#6EE7B7' : '#FDE68A',
                  border: `1px solid ${complete ? 'rgba(110,231,183,.45)' : 'rgba(253,230,138,.45)'}`,
                }}>
                  {complete ? '✓ Roll call complete' : `${marked} of ${total} marked`}
                </div>
                <div style={{ marginTop: '12px', fontFamily: SERIF, fontSize: '34px', fontWeight: 600, lineHeight: 1, color: GOLD_LT, fontVariantNumeric: 'lining-nums' }}>{presentPct}%</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,.6)', marginTop: '3px', letterSpacing: '.04em' }}>in house</div>
              </div>
            </div>
          </div>

          <div style={{ padding: '22px 30px 8px' }}>
            {/* Stat tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: '10px' }}>
              {STATS.map(st => (
                <div key={st.label} style={{ position: 'relative', background: '#fff', border: '1px solid #ECE6D8', borderRadius: '14px', padding: '14px 10px 12px', textAlign: 'center', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: '22%', right: '22%', height: '3px', borderRadius: '0 0 3px 3px', background: st.color }} />
                  <div style={{ fontFamily: SERIF, fontSize: '26px', fontWeight: 600, color: st.value ? st.color : '#CBD5E1', lineHeight: 1.1, fontVariantNumeric: 'lining-nums tabular-nums' }}>{st.value}</div>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: '#64748B', letterSpacing: '.1em', textTransform: 'uppercase', marginTop: '5px' }}>{st.label}</div>
                </div>
              ))}
            </div>

            {/* Composition bar */}
            {total > 0 && (
              <div style={{ display: 'flex', height: '8px', borderRadius: '99px', overflow: 'hidden', background: '#F1EDE4', margin: '14px 0 4px' }}>
                {STATS.slice(1).filter(st => st.value > 0).map(st => (
                  <div key={st.label} title={`${st.label}: ${st.value}`} style={{ width: `${(st.value / total) * 100}%`, background: st.color }} />
                ))}
              </div>
            )}

            {loading ? (
              <div style={{ textAlign: 'center', padding: '34px', color: '#94A3B8', fontSize: '13px' }}>Loading leave and health details…</div>
            ) : (
              <div style={{ marginTop: '18px' }}>
                <Section title="Absent" count={absent.length} color="#DC2626">
                  {absent.length === 0
                    ? <Empty text="Nobody absent" />
                    : absent.map(s => <NameRow key={s.id} student={s} color="#DC2626" />)}
                </Section>

                {late.length > 0 && (
                  <Section title="Late" count={late.length} color="#CA8A04">
                    {late.map(s => <NameRow key={s.id} student={s} color="#CA8A04" />)}
                  </Section>
                )}

                <Section title="On leave" count={onLeaveMarked.length} color="#1D4ED8">
                  {onLeaveMarked.length === 0
                    ? <Empty text="Nobody on leave today" />
                    : onLeaveMarked.map(s => {
                      const d = leaveDetails.find(x => x.student.id === s.id)?.leave
                      return (
                        <NameRow key={s.id} student={s} color="#1D4ED8"
                          sub={d ? `${shortDate(d.from_date)} → ${shortDate(d.to_date)}${d.reason ? ' · ' + d.reason : ''}` : null}
                          badge={d?.status} />
                      )
                    })}
                </Section>

                <Section title="Health · sickbay" count={sickbayDetails.length + sickOnly.length} color="#7C3AED">
                  {sickbayDetails.length === 0 && sickOnly.length === 0
                    ? <Empty text="Nobody in sickbay" />
                    : (
                      <>
                        {sickbayDetails.map(({ student, sickbay }) => (
                          <NameRow key={student.id} student={student} color="#7C3AED"
                            sub={`${sickbay.complaint || 'Under observation'}${sickbay.attended_by ? ' · Attended by ' + sickbay.attended_by : ''}`} />
                        ))}
                        {sickOnly.map(s => (
                          <NameRow key={s.id} student={s} color="#7C3AED" sub="Marked sick at roll call (no sickbay record)" />
                        ))}
                      </>
                    )}
                </Section>
              </div>
            )}

            {/* Sign-off */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px', marginTop: '26px' }}>
              {['House master', 'Warden'].map(l => (
                <div key={l} style={{ borderTop: '1px solid #CBD5E1', paddingTop: '6px', fontSize: '11px', color: '#64748B', letterSpacing: '.04em' }}>{l}</div>
              ))}
            </div>
            <div style={{ margin: '14px 0 18px', fontSize: '10.5px', color: '#94A3B8', display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
              <span>Guidance Navodaya &amp; Sainik Institute</span>
              <span>Generated {new Date().toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="hr-no-print" style={{ display: 'flex', gap: '10px', padding: '14px 30px 18px', borderTop: '1px solid #F1EDE4', flexWrap: 'wrap', background: '#FCFBF7', borderRadius: '0 0 20px 20px' }}>
          <button onClick={handlePrint} style={{ ...btn('linear-gradient(180deg,#1C3A6B,#0B1E3D)'), flex: 1, boxShadow: '0 8px 18px -10px rgba(11,30,61,.8)' }}>Print report</button>
          <button
            onClick={handleSendWhatsapp}
            disabled={whatsappStatus === 'generating'}
            style={{
              ...btn(whatsappStatus === 'error' ? '#DC2626' : whatsappStatus === 'ready' ? '#15803D' : '#1FAF54'),
              flex: 1, opacity: whatsappStatus === 'generating' ? 0.85 : 1, transition: 'background .25s ease',
            }}
          >
            {whatsappStatus === 'generating' && <><span className="hr-spinner" style={{ marginRight: '8px', verticalAlign: 'middle' }} />Preparing image…</>}
            {whatsappStatus === 'ready' && <span className="hr-pop-in">✓ Ready to send</span>}
            {whatsappStatus === 'error' && <span className="hr-pop-in">Failed — try again</span>}
            {whatsappStatus === 'idle' && <>Send on WhatsApp</>}
          </button>
          <button onClick={onClose} style={{ ...btn('#fff', '#334155'), flex: 1, border: '1px solid #DDD5C3' }}>Close</button>
        </div>
      </div>
    </div>
  )
}

function Section({ title, count, color, children }) {
  return (
    <div className="hr-print-section" style={{ marginBottom: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
        <span style={{ fontFamily: SERIF, fontSize: '16px', fontWeight: 600, color: '#0B1E3D' }}>{title}</span>
        <span style={{ fontSize: '11px', fontWeight: 800, color, background: color + '14', border: `1px solid ${color}33`, borderRadius: '99px', padding: '1px 9px' }}>{count}</span>
        <span style={{ flex: 1, height: '1px', background: '#ECE6D8', marginLeft: '4px' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>{children}</div>
    </div>
  )
}

const BADGE = {
  Approved: { c: '#15803D', b: '#DCFCE7' },
  Pending: { c: '#A16207', b: '#FEF3C7' },
}

function NameRow({ student, sub, color, badge }) {
  const initials = String(student.name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
  const bd = badge && (BADGE[badge] || { c: '#475569', b: '#F1F5F9' })
  return (
    <div className="hr-print-row" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: '#fff', border: '1px solid #ECE6D8', borderLeft: `3px solid ${color}`, borderRadius: '12px' }}>
      <div style={{ width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800, color, background: color + '12' }}>{initials}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px' }}>
          <span style={{ fontWeight: 700, color: '#0F172A', fontSize: '13.5px' }}>{student.name}</span>
          <span style={{ color: '#64748B', fontSize: '11.5px', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
            GCC {student.gcc_no || '—'} · {student.batch || student.class_name || '—'}
          </span>
        </div>
        {(sub || bd) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px', fontSize: '12px', color: '#64748B' }}>
            {sub && <span>{sub}</span>}
            {bd && <span style={{ fontSize: '10.5px', fontWeight: 800, color: bd.c, background: bd.b, borderRadius: '99px', padding: '1px 8px' }}>{badge}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

function Empty({ text }) {
  return <div style={{ fontSize: '12.5px', color: '#64748B', padding: '9px 14px', background: '#FAF8F2', border: '1px dashed #E5DCC7', borderRadius: '12px' }}>✓ {text}</div>
}
