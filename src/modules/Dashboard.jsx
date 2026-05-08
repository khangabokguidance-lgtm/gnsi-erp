import { useEffect, useState } from 'react'
import { supabase } from '../core/supabase'

export default function Dashboard() {
  const [stats, setStats] = useState({ students: 0, collected: 0, due: 0, admissions: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadStats() {
      try {
        const [{ count: students }, { count: admissions }] = await Promise.all([
          supabase.from('students').select('*', { count: 'exact', head: true }),
          supabase.from('gnsi_admissions').select('*', { count: 'exact', head: true }),
        ])
        setStats(s => ({ ...s, students: students || 0, admissions: admissions || 0 }))
      } catch(e) {}
      setLoading(false)
    }
    loadStats()
  }, [])

  return (
    <div>
      <div className="page-header">
        <div className="page-header-eyebrow">GNSI · PORTAL</div>
        <div className="page-header-title">📊 Dashboard</div>
        <div className="page-header-sub">Welcome back! Here's what's happening today.</div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '24px' }}>
        <div className="stat-card" style={{ '--c': '#1433a8' }}>
          <div className="stat-label">👨‍🎓 Students</div>
          <div className="stat-val">{loading ? '…' : stats.students}</div>
        </div>
        <div className="stat-card" style={{ '--c': '#16a34a' }}>
          <div className="stat-label">📝 Admissions</div>
          <div className="stat-val">{loading ? '…' : stats.admissions}</div>
        </div>
        <div className="stat-card" style={{ '--c': '#d97706' }}>
          <div className="stat-label">💰 Fee Due</div>
          <div className="stat-val">—</div>
        </div>
        <div className="stat-card" style={{ '--c': '#7c3aed' }}>
          <div className="stat-label">✅ Collected</div>
          <div className="stat-val">—</div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="card">
        <div className="card-head">
          <span className="card-title">⚡ Quick Actions</span>
        </div>
        <div style={{ padding: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {[
            { icon: '💳', label: 'Collect Fee', color: '#1433a8' },
            { icon: '📝', label: 'New Admission', color: '#16a34a' },
            { icon: '✅', label: 'Mark Attendance', color: '#d97706' },
            { icon: '📈', label: 'View Reports', color: '#7c3aed' },
          ].map(action => (
            <button key={action.label} className="btn" style={{
              background: action.color + '15', color: action.color,
              border: `1.5px solid ${action.color}33`, fontSize: '13px'
            }}>
              {action.icon} {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* Migration notice */}
      <div style={{
        background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: '12px',
        padding: '16px 20px', display: 'flex', gap: '12px', alignItems: 'flex-start'
      }}>
        <span style={{ fontSize: '20px' }}>🚧</span>
        <div>
          <div style={{ fontWeight: 800, color: '#92400e', marginBottom: '4px' }}>Migration in Progress</div>
          <div style={{ fontSize: '13px', color: '#78350f' }}>
            GNSI Portal is being upgraded to React. All your data is safe in Supabase.
            Modules are being migrated one by one. Use the existing portal for full functionality.
          </div>
        </div>
      </div>
    </div>
  )
}
