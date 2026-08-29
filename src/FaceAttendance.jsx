// FaceAttendance.jsx — standalone sidebar page for managing face-recognition
// attendance: enroll staff, review pending self-enrollments, see coverage.
// Reuses FaceEnroll / FaceApprovalQueue from FaceEnroll.jsx — this page is
// just the admin-facing shell around them, separate from the inline button
// in Staff.jsx's row actions.

import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'
import FaceEnroll, { FaceApprovalQueue } from './FaceEnroll'

const S = {
  page:  { padding: 20, fontFamily: "'Outfit',system-ui,sans-serif", background: '#f1f5f9', minHeight: '100vh' },
  card:  { background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,.07)', padding: 20, marginBottom: 16 },
  input: { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit', minHeight: 44 },
  tab:   (active) => ({
    padding: '10px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer',
    background: 'none', border: 'none',
    borderBottom: `3px solid ${active ? '#0B1E3D' : 'transparent'}`,
    color: active ? '#0B1E3D' : '#64748b',
  }),
}

function useToast() {
  const [toast, setToast] = useState(null)
  const show = useCallback((message, type = 'ok') => { setToast({ message, type }); setTimeout(() => setToast(null), 3500) }, [])
  const el = toast ? (
    <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: toast.type === 'err' ? '#fee2e2' : toast.type === 'warn' ? '#fef9c3' : '#dcfce7', color: toast.type === 'err' ? '#dc2626' : toast.type === 'warn' ? '#ca8a04' : '#16a34a', padding: '12px 20px', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,.15)', fontSize: 13, fontWeight: 600 }}>
      {toast.message}
    </div>
  ) : null
  return { show, el }
}

export default function FaceAttendance({ currentUser, isAdmin, staff = [] }) {
  const { show: showToast, el: toastEl } = useToast()
  const [tab, setTab] = useState('coverage') // coverage | approvals
  const [faceRows, setFaceRows] = useState([]) // staff_face_descriptors, latest per staff
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [enrollTarget, setEnrollTarget] = useState(null)

  const fetchFaceRows = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('staff_face_descriptors')
      .select('staff_id, status, enrolled_at')
      .order('enrolled_at', { ascending: false })
    if (!error) {
      const latestByStaff = {}
      for (const r of data || []) if (!latestByStaff[r.staff_id]) latestByStaff[r.staff_id] = r
      setFaceRows(Object.values(latestByStaff))
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchFaceRows() }, [fetchFaceRows])

  const statusFor = (staffId) => faceRows.find(r => r.staff_id === staffId)?.status || 'none'

  const filteredStaff = staff
    .filter(s => s.status !== 'Inactive')
    .filter(s => !search || s.name?.toLowerCase().includes(search.toLowerCase()))

  const counts = {
    approved: filteredStaff.filter(s => statusFor(s.id) === 'approved').length,
    pending:  filteredStaff.filter(s => statusFor(s.id) === 'pending').length,
    none:     filteredStaff.filter(s => statusFor(s.id) === 'none').length,
  }

  if (!isAdmin) {
    return <div style={S.page}><div style={S.card}>Admin access required to manage face attendance.</div></div>
  }

  return (
    <div style={S.page}>
      {toastEl}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0B1E3D' }}>🧑‍💼 Face Attendance</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
          Manage face enrollment for staff biometric check-in. Check-in is blocked for anyone without an approved enrollment.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
        <div style={{ ...S.card, marginBottom: 0, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#16a34a' }}>{counts.approved}</div>
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Enrolled</div>
        </div>
        <div style={{ ...S.card, marginBottom: 0, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#ca8a04' }}>{counts.pending}</div>
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Pending approval</div>
        </div>
        <div style={{ ...S.card, marginBottom: 0, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#dc2626' }}>{counts.none}</div>
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Not enrolled</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #e2e8f0' }}>
        <button style={S.tab(tab === 'coverage')} onClick={() => setTab('coverage')}>Staff coverage</button>
        <button style={S.tab(tab === 'approvals')} onClick={() => setTab('approvals')}>
          Pending approvals {counts.pending > 0 && `(${counts.pending})`}
        </button>
      </div>

      {tab === 'coverage' && (
        <div style={S.card}>
          <input style={{ ...S.input, marginBottom: 14 }} placeholder="Search staff by name…" value={search} onChange={e => setSearch(e.target.value)} />
          {loading ? (
            <p style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>Loading…</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredStaff.map(s => {
                const status = statusFor(s.id)
                const meta = {
                  approved: { label: 'Enrolled', color: '#16a34a', bg: '#dcfce7' },
                  pending:  { label: 'Pending approval', color: '#ca8a04', bg: '#fef9c3' },
                  none:     { label: 'Not enrolled', color: '#dc2626', bg: '#fee2e2' },
                }[status]
                return (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #f1f5f9', borderRadius: 10, padding: '10px 14px' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{s.designation || ''}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, color: meta.color, background: meta.bg }}>{meta.label}</span>
                      <button onClick={() => setEnrollTarget(s)} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#0B1E3D', color: 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                        {status === 'approved' ? 'Re-enroll' : 'Enroll'}
                      </button>
                    </div>
                  </div>
                )
              })}
              {!filteredStaff.length && <p style={{ textAlign: 'center', color: '#94a3b8', padding: 24 }}>No staff found.</p>}
            </div>
          )}
        </div>
      )}

      {tab === 'approvals' && (
        <div style={S.card}>
          <FaceApprovalQueue currentAdminId={currentUser?.staff_profile_id || null} showToast={showToast} />
        </div>
      )}

      {enrollTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 9997, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setEnrollTarget(null)} style={{ position: 'absolute', top: -14, right: -14, width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'white', color: '#374151', fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,.2)', zIndex: 1 }}>✕</button>
            <FaceEnroll
              staffMember={enrollTarget}
              mode="admin"
              currentAdminId={currentUser?.staff_profile_id || null}
              onDone={() => { setEnrollTarget(null); fetchFaceRows() }}
              showToast={showToast}
            />
          </div>
        </div>
      )}
    </div>
  )
}
