import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// ══════════════════════════════════════════════════════════════
//  HOUSE DAILY REPORT MODAL
//  Auto-opens when a house hits 100% roll call. Pulls:
//   - Present / Absent / Late (from attendance_records, already loaded)
//   - On Leave students (from leave_records, from_date <= date <= to_date)
//   - Sickbay / health status (from sickbay_records, status = Admitted)
//  Printable via window.print() with a dedicated print stylesheet.
// ══════════════════════════════════════════════════════════════

const inp = {
  width: '100%', padding: '10px 12px', borderRadius: '8px',
  border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box',
}
const btn = (bg = '#1e3a5f', c = 'white') => ({
  backgroundColor: bg, color: c, border: 'none', borderRadius: '10px',
  padding: '10px 18px', fontWeight: '700', cursor: 'pointer', fontSize: '13px',
})

export default function HouseReportModal({ house, date, session, students, allRecords, onClose }) {
  const [leaveRecords, setLeaveRecords] = useState([])
  const [sickbayRecords, setSickbayRecords] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
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
      ])
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

  const handlePrint = () => window.print()

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
    }} className="hr-modal-overlay">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .hr-print-area, .hr-print-area * { visibility: visible; }
          .hr-print-area { position: absolute; top: 0; left: 0; width: 100%; }
          .hr-no-print { display: none !important; }
        }
      `}</style>
      <div style={{
        background: 'white', borderRadius: '16px', maxWidth: '720px', width: '100%',
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <div className="hr-print-area" style={{ padding: '28px 28px 20px' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px', borderBottom: '2px solid #1e3a5f', paddingBottom: '14px' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>GNSI Hostel — Daily House Report</div>
              <div style={{ fontSize: '22px', fontWeight: 900, color: '#1e3a5f', marginTop: '2px' }}>🏠 {house} House</div>
              <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                {new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} · {session === 'morning' ? '🌅 Morning' : '🌙 Night'} Roll Call
              </div>
            </div>
            <div style={{
              padding: '5px 14px', borderRadius: '99px', fontSize: '12px', fontWeight: 800,
              background: marked === total ? '#dcfce7' : '#fef9c3',
              color: marked === total ? '#16a34a' : '#ca8a04',
            }}>
              {marked === total ? '✓ Roll Call Complete' : `${marked}/${total} marked`}
            </div>
          </div>

          {/* Summary strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginBottom: '20px' }}>
            {[
              { label: 'Total', value: total, color: '#1e3a5f', bg: '#eff6ff' },
              { label: 'Present', value: present.length, color: '#16a34a', bg: '#dcfce7' },
              { label: 'Absent', value: absent.length, color: '#dc2626', bg: '#fee2e2' },
              { label: 'On Leave', value: onLeaveMarked.length, color: '#1d4ed8', bg: '#dbeafe' },
              { label: 'Sick', value: sickMarked.length, color: '#7c3aed', bg: '#f5f3ff' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center', background: s.bg, borderRadius: '10px', padding: '10px 6px' }}>
                <div style={{ fontSize: '20px', fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '10px', color: s.color, fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>⏳ Loading leave & health details...</div>
          ) : (
            <>
              {/* Absent list */}
              <Section title="❌ Absent Students" color="#dc2626" bg="#fee2e2">
                {absent.length === 0
                  ? <Empty text="No students marked absent." />
                  : absent.map(s => <NameRow key={s.id} student={s} />)
                }
              </Section>

              {/* Late list */}
              {late.length > 0 && (
                <Section title="⏰ Late" color="#ca8a04" bg="#fef9c3">
                  {late.map(s => <NameRow key={s.id} student={s} />)}
                </Section>
              )}

              {/* On Leave */}
              <Section title="🚪 On Leave" color="#1d4ed8" bg="#dbeafe">
                {onLeaveMarked.length === 0
                  ? <Empty text="No students on leave today." />
                  : onLeaveMarked.map(s => {
                    const detail = leaveDetails.find(d => d.student.id === s.id)?.leave
                    return (
                      <NameRow key={s.id} student={s}
                        sub={detail ? `${detail.from_date} → ${detail.to_date}${detail.reason ? ' · ' + detail.reason : ''} · ${detail.status}` : null}
                      />
                    )
                  })
                }
              </Section>

              {/* Health / Sickbay report */}
              <Section title="🏥 House Health Report (Sickbay)" color="#7c3aed" bg="#f5f3ff">
                {sickbayDetails.length === 0 && sickMarked.length === 0
                  ? <Empty text="No students currently in sickbay." />
                  : (
                    <>
                      {sickbayDetails.map(({ student, sickbay }) => (
                        <NameRow key={student.id} student={student}
                          sub={`${sickbay.complaint || 'Under observation'}${sickbay.attended_by ? ' · Attended by ' + sickbay.attended_by : ''}`}
                        />
                      ))}
                      {sickMarked.filter(s => !sickbayDetails.some(d => d.student.id === s.id)).map(s => (
                        <NameRow key={s.id} student={s} sub="Marked sick in roll call (no active sickbay record)" />
                      ))}
                    </>
                  )
                }
              </Section>
            </>
          )}

          <div style={{ marginTop: '18px', fontSize: '11px', color: '#94a3b8', textAlign: 'right' }}>
            Generated {new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
          </div>
        </div>

        {/* Actions */}
        <div className="hr-no-print" style={{ display: 'flex', gap: '10px', padding: '16px 28px', borderTop: '1px solid #f1f5f9' }}>
          <button onClick={handlePrint} style={{ ...btn('#1e3a5f'), flex: 1 }}>🖨️ Print Report</button>
          <button onClick={onClose} style={{ ...btn('#f1f5f9', '#374151'), flex: 1 }}>Close</button>
        </div>
      </div>
    </div>
  )
}

function Section({ title, color, bg, children }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ fontSize: '13px', fontWeight: 800, color, marginBottom: '8px' }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {children}
      </div>
    </div>
  )
}

function NameRow({ student, sub }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', fontSize: '13px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 700, color: '#1e293b' }}>{student.name}</span>
        <span style={{ color: '#94a3b8', fontSize: '12px' }}>
          GCC-{student.gcc_no || '--'} · {student.batch || student.class_name || '--'}
        </span>
      </div>
      {sub && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>{sub}</div>}
    </div>
  )
}

function Empty({ text }) {
  return <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', padding: '4px 2px' }}>{text}</div>
}