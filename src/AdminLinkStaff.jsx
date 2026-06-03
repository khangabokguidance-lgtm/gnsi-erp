import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import CreateAuthUser from './CreateAuthUser'
import { EventBus, GNSI_EVENTS } from './EventBus'

export default function AdminLinkStaff() {
  const [staff,         setStaff]         = useState([])
  const [authUsers,     setAuthUsers]     = useState([])
  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(null)
  const [toast,         setToast]         = useState({ msg:'', type:'success' })
  const [showCreate,    setShowCreate]    = useState(false)
  const [bulkCreating,  setBulkCreating]  = useState(false)
  const [bulkResults,   setBulkResults]   = useState([])
  const [liveStatus,    setLiveStatus]    = useState('connecting')
  const [flashIds,      setFlashIds]      = useState(new Set())  // newly changed rows
  const channelRef = useRef(null)
  const toastTimer = useRef(null)

  // ── Toast ─────────────────────────────────────────────────────────────────
  const showToast = (msg, type = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ msg, type })
    toastTimer.current = setTimeout(() => setToast({ msg:'', type:'success' }), 3500)
  }

  // ── Flash highlight helper ────────────────────────────────────────────────
  const flash = (id) => {
    setFlashIds(prev => new Set(prev).add(id))
    setTimeout(() => setFlashIds(prev => { const n = new Set(prev); n.delete(id); return n }), 3500)
  }

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    loadData()
    setupRealtime()
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [])

  const loadData = async () => {
    setLoading(true)
    // Fetch ALL staff columns so edits to role/designation/status reflect here
    const { data: staffData } = await supabase
      .from('staff_profiles')
      .select('id, name, email, phone, department, designation, role, status, user_id, joining_date')
      .order('name')

    const { data: authData, error: rpcError } = await supabase.rpc('get_auth_users')
    let users = []
    if (rpcError || !authData) {
      try { const { data } = await supabase.auth.admin.listUsers(); users = data?.users || [] }
      catch (e) { console.error('Auth users fetch failed:', e) }
    } else {
      users = authData
    }

    setStaff(staffData || [])
    setAuthUsers(users)
    setLoading(false)
  }

  // ── Realtime: listens to INSERT / UPDATE / DELETE on staff_profiles ───────
  const setupRealtime = () => {
    const ch = supabase
      .channel('adminlink-staff-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'staff_profiles' }, ({ new: row }) => {
        setStaff(prev => {
          if (prev.find(s => s.id === row.id)) return prev
          flash(row.id)
          showToast(`➕ New staff: ${row.name}`, 'success')
          return [...prev, row].sort((a, b) => a.name.localeCompare(b.name))
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'staff_profiles' }, ({ new: row }) => {
        setStaff(prev => prev.map(s => s.id === row.id ? { ...s, ...row } : s))
        flash(row.id)
        showToast(`✏️ Updated: ${row.name}`, 'info')
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'staff_profiles' }, ({ old }) => {
        setStaff(prev => prev.filter(s => s.id !== old.id))
        showToast(`🗑️ Removed: staff #${old.id}`, 'warning')
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED')    setLiveStatus('live')
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setLiveStatus('error')
        else setLiveStatus('connecting')
      })
    channelRef.current = ch
  }

  // ── Link ──────────────────────────────────────────────────────────────────
  const linkStaff = async (staffId, userId) => {
    if (!userId) return
    setSaving(staffId)
    const { error } = await supabase.from('staff_profiles').update({ user_id: userId }).eq('id', staffId)
    if (error) {
      showToast(`❌ ${error.message}`, 'error')
    } else {
      // realtime UPDATE will handle it; optimistic update for speed
      setStaff(prev => prev.map(s => s.id === staffId ? { ...s, user_id: userId } : s))
      flash(staffId)
      showToast('✅ Linked!', 'success')
      const s = staff.find(x => x.id === staffId)
      EventBus.emit(GNSI_EVENTS.STAFF_UPDATED, { staffId, change:'auth_linked', userId, name:s?.name })
    }
    setSaving(null)
  }

  // ── Unlink ────────────────────────────────────────────────────────────────
  const unlinkStaff = async (staffId) => {
    if (!window.confirm('Unlink this staff member?')) return
    setSaving(staffId)
    const s = staff.find(x => x.id === staffId)
    await supabase.from('staff_profiles').update({ user_id: null }).eq('id', staffId)
    setStaff(prev => prev.map(x => x.id === staffId ? { ...x, user_id: null } : x))
    flash(staffId)
    showToast('🗑️ Unlinked', 'warning')
    EventBus.emit(GNSI_EVENTS.STAFF_UPDATED, { staffId, change:'auth_unlinked', name:s?.name })
    setSaving(null)
  }

  // ── Bulk create ───────────────────────────────────────────────────────────
  const createAllMissingUsers = async () => {
    const unlinked = staff.filter(s => !s.user_id)
    if (!window.confirm(`Create auth users for ${unlinked.length} unlinked staff?`)) return
    setBulkCreating(true); setBulkResults([])
    const results = []
    for (const s of unlinked) {
      const email    = s.email || `${s.name.toLowerCase().replace(/[^a-z]/g,'')}${s.id}@gnsi.edu`
      const password = Math.random().toString(36).slice(2, 10)
      try {
        const { data, error } = await supabase.auth.admin.createUser({
          email, password, email_confirm: true,
          user_metadata: { name: s.name, staff_id: s.id }
        })
        if (error) { results.push({ name:s.name, status:'failed', error:error.message }); continue }
        await supabase.from('staff_profiles').update({ user_id: data.user.id, email }).eq('id', s.id)
        results.push({ name:s.name, status:'created', email, password })
        EventBus.emit(GNSI_EVENTS.STAFF_CREATED, { staffId:s.id, name:s.name, email, userId:data.user.id, action:'auth_created' })
      } catch (e) {
        results.push({ name:s.name, status:'error', error:e.message })
      }
    }
    setBulkResults(results); setBulkCreating(false)
    loadData()
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const linked   = staff.filter(s => s.user_id)
  const unlinked = staff.filter(s => !s.user_id)

  const ROLE_COLOR = {
    'Teaching':         '#0891b2',
    'Non-Teaching':     '#6366f1',
    'Admin':            '#7c3aed',
    'Teaching + Admin': '#d97706',
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ padding:60, textAlign:'center', color:'#94a3b8', fontFamily:'system-ui' }}>
      <div style={{ fontSize:32, marginBottom:12 }}>⏳</div>
      <div style={{ fontWeight:600 }}>Loading staff data…</div>
    </div>
  )

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding:24, maxWidth:960, margin:'0 auto', fontFamily:"'Outfit',system-ui,sans-serif" }}>
      <style>{`
        @keyframes slideUp { from{transform:translateX(-50%) translateY(12px);opacity:0} to{transform:translateX(-50%) translateY(0);opacity:1} }
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:.35} }
        @keyframes flashIn { 0%{background:#dcfce7} 100%{background:transparent} }
        .staff-row { transition: box-shadow .2s, border-color .2s; }
        .staff-row:hover { box-shadow: 0 4px 16px rgba(0,0,0,.10) !important; }
        .flash-row { animation: flashIn 3.5s ease forwards; }
      `}</style>

      {/* Toast */}
      {toast.msg && (
        <div style={{
          position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)',
          padding:'12px 22px', borderRadius:10, fontWeight:700, fontSize:13,
          zIndex:9999, boxShadow:'0 8px 32px rgba(0,0,0,.18)', whiteSpace:'nowrap',
          animation:'slideUp .2s ease',
          background: toast.type==='error'?'#fee2e2':toast.type==='warning'?'#fef3c7':toast.type==='info'?'#eff6ff':'#dcfce7',
          color:       toast.type==='error'?'#dc2626':toast.type==='warning'?'#b45309':toast.type==='info'?'#1e3a5f':'#16a34a',
          border:`1px solid ${toast.type==='error'?'#fca5a5':toast.type==='warning'?'#fcd34d':toast.type==='info'?'#bfdbfe':'#86efac'}`,
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:800, color:'#1e3a5f', margin:0, letterSpacing:'-.02em' }}>
            🔗 Link Staff to Auth Users
          </h1>
          <div style={{ fontSize:13, color:'#64748b', marginTop:6, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
            <span>👥 {staff.length} total</span>
            <span style={{ color:'#16a34a', fontWeight:700 }}>✅ {linked.length} linked</span>
            <span style={{ color:'#dc2626', fontWeight:700 }}>⚠️ {unlinked.length} unlinked</span>
            {/* Live sync badge */}
            <span style={{
              display:'inline-flex', alignItems:'center', gap:5,
              padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:700,
              background: liveStatus==='live'?'#dcfce7':liveStatus==='error'?'#fee2e2':'#fef3c7',
              color:       liveStatus==='live'?'#16a34a':liveStatus==='error'?'#dc2626':'#b45309',
            }}>
              <span style={{
                width:6, height:6, borderRadius:'50%', display:'inline-block',
                background: liveStatus==='live'?'#16a34a':liveStatus==='error'?'#dc2626':'#f59e0b',
                animation: liveStatus==='live'?'pulse 2s infinite':'none',
              }}/>
              {liveStatus==='live'?'Live sync ON':liveStatus==='error'?'Sync error':'Connecting…'}
            </span>
          </div>
        </div>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <button onClick={loadData} style={Btn('#64748b')}>🔄 Refresh</button>
          <button onClick={() => setShowCreate(true)} style={Btn('#16a34a')}>➕ Create User</button>
          <button
            onClick={createAllMissingUsers}
            disabled={bulkCreating || unlinked.length===0}
            style={Btn(bulkCreating||unlinked.length===0?'#94a3b8':'#2563eb', bulkCreating||unlinked.length===0)}
          >
            {bulkCreating?'⏳ Creating…':`⚡ Create All (${unlinked.length})`}
          </button>
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:16 }}>
          <div style={{ background:'white', borderRadius:16, padding:24, width:'100%', maxWidth:440, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,.25)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <h3 style={{ margin:0, color:'#1e3a5f', fontWeight:800 }}>Create Auth User</h3>
              <button onClick={() => setShowCreate(false)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#64748b' }}>✕</button>
            </div>
            <CreateAuthUser onCreated={() => { loadData(); setShowCreate(false); showToast('✅ Auth user created','success') }}/>
          </div>
        </div>
      )}

      {/* Bulk results */}
      {bulkResults.length > 0 && (
        <div style={{ marginBottom:24, padding:16, background:'#f8fafc', borderRadius:12, border:'1px solid #e2e8f0' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <h3 style={{ margin:0, fontSize:14, fontWeight:800, color:'#1e3a5f' }}>⚡ Bulk Results</h3>
            <button onClick={() => setBulkResults([])} style={{ background:'none', border:'none', color:'#94a3b8', cursor:'pointer', fontSize:18 }}>✕</button>
          </div>
          <div style={{ maxHeight:260, overflowY:'auto' }}>
            <table style={{ width:'100%', fontSize:12, borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#f1f5f9' }}>
                  {['Staff','Status','Email','Temp Password'].map(h=>(
                    <th key={h} style={{ padding:'7px 10px', textAlign:'left', fontWeight:700, color:'#374151' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bulkResults.map((r,i) => (
                  <tr key={i} style={{ borderTop:'1px solid #e2e8f0' }}>
                    <td style={{ padding:'7px 10px', fontWeight:600 }}>{r.name}</td>
                    <td style={{ padding:'7px 10px', color:r.status==='created'?'#16a34a':'#dc2626', fontWeight:700 }}>
                      {r.status==='created'?'✅ Created':'❌ Failed'}
                    </td>
                    <td style={{ padding:'7px 10px', fontFamily:'monospace', fontSize:11 }}>{r.email||'—'}</td>
                    <td style={{ padding:'7px 10px' }}>
                      {r.password
                        ? <span style={{ background:'#fef9c3', padding:'2px 8px', borderRadius:4, fontFamily:'monospace', fontWeight:700 }}>{r.password}</span>
                        : <span style={{ color:'#94a3b8', fontSize:11 }}>{r.error}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ margin:'10px 0 0', fontSize:11, color:'#dc2626', fontWeight:600 }}>
            ⚠️ Copy temp passwords now — they won't be shown again!
          </p>
        </div>
      )}

      {/* ── UNLINKED ── */}
      <SectionHeader label="⚠️ Unlinked Staff" count={unlinked.length} color="#dc2626" bg="#fee2e2"/>
      <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:28 }}>
        {unlinked.map(s => (
          <StaffRow
            key={s.id} s={s}
            authUsers={authUsers}
            saving={saving}
            flash={flashIds.has(s.id)}
            roleColor={ROLE_COLOR}
            onLink={userId => linkStaff(s.id, userId)}
            isLinked={false}
          />
        ))}
        {unlinked.length===0 && (
          <div style={{ textAlign:'center', padding:40, color:'#16a34a', background:'#f0fdf4', borderRadius:12, border:'1px solid #bbf7d0', fontWeight:600 }}>
            ✅ All staff are linked!
          </div>
        )}
      </div>

      {/* ── LINKED ── */}
      <SectionHeader label="✅ Linked Staff" count={linked.length} color="#16a34a" bg="#dcfce7"/>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {linked.map(s => {
          const linkedUser = authUsers.find(u => u.id === s.user_id)
          return (
            <StaffRow
              key={s.id} s={s}
              authUsers={authUsers}
              saving={saving}
              flash={flashIds.has(s.id)}
              roleColor={ROLE_COLOR}
              linkedUser={linkedUser}
              isLinked={true}
              onUnlink={() => unlinkStaff(s.id)}
            />
          )
        })}
      </div>
    </div>
  )
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ label, count, color, bg }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
      <h2 style={{ fontSize:15, fontWeight:800, color, margin:0 }}>{label}</h2>
      <span style={{ padding:'3px 10px', borderRadius:99, background:bg, color, fontSize:12, fontWeight:700 }}>{count}</span>
    </div>
  )
}

// ── Staff row — shared for both linked/unlinked ───────────────────────────────
function StaffRow({ s, authUsers, saving, flash, roleColor, isLinked, linkedUser, onLink, onUnlink }) {
  const rc = roleColor[s.role] || '#64748b'
  return (
    <div className={`staff-row${flash?' flash-row':''}`} style={{
      display:'flex', alignItems:'center', gap:12, padding:'14px 16px',
      borderRadius:12, background: isLinked?'#f8fafc':'white',
      border: flash?'2px solid #22c55e':'1px solid #e2e8f0',
      boxShadow:'0 1px 4px rgba(0,0,0,.06)',
      position:'relative', overflow:'hidden',
    }}>
      {/* NEW/CHANGED flash tag */}
      {flash && (
        <div style={{
          position:'absolute', top:0, right:0,
          background:'#16a34a', color:'white',
          fontSize:9, fontWeight:800, padding:'2px 8px',
          borderBottomLeftRadius:8,
        }}>UPDATED</div>
      )}

      {/* Avatar */}
      <div style={{
        width:42, height:42, borderRadius:'50%', flexShrink:0,
        background:`linear-gradient(135deg,${rc},${rc}99)`,
        color:'white', display:'flex', alignItems:'center',
        justifyContent:'center', fontWeight:800, fontSize:15,
      }}>
        {s.name?.[0]?.toUpperCase()}
      </div>

      {/* Info */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:700, color:'#1e293b', fontSize:14 }}>{s.name}</div>
        <div style={{ fontSize:12, color:'#64748b', marginTop:1 }}>
          {s.designation} · {s.department}
          {/* Role badge */}
          {s.role && (
            <span style={{
              marginLeft:7, padding:'1px 7px', borderRadius:99,
              fontSize:10, fontWeight:700,
              background:`${rc}18`, color:rc,
            }}>{s.role}</span>
          )}
          {/* Status badge */}
          <span style={{
            marginLeft:5, padding:'1px 7px', borderRadius:99,
            fontSize:10, fontWeight:700,
            background: s.status==='Active'?'#dcfce7':'#fee2e2',
            color:       s.status==='Active'?'#16a34a':'#dc2626',
          }}>{s.status||'Active'}</span>
        </div>
        {/* Email */}
        <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>
          {s.email || <span style={{ color:'#f59e0b', fontWeight:600 }}>⚠️ No email — auto email will be generated on bulk create</span>}
        </div>
        {/* Linked user info */}
        {isLinked && (
          <div style={{ fontSize:11, color:'#16a34a', fontWeight:600, marginTop:2 }}>
            🔗 {linkedUser?.email || linkedUser?.phone || s.user_id?.slice(0,14) || 'Unknown auth user'}
          </div>
        )}
      </div>

      {/* Action: select to link OR unlink button */}
      {!isLinked ? (
        <select
          value=""
          onChange={e => onLink(e.target.value)}
          disabled={saving===s.id || authUsers.length===0}
          style={{
            padding:'9px 12px', borderRadius:8, border:'1.5px solid #d1d5db',
            fontSize:13, minWidth:220, background:'white', cursor:'pointer',
            fontFamily:'inherit',
          }}
        >
          <option value="">— Select Auth User to Link —</option>
          {authUsers.map(u => (
            <option key={u.id} value={u.id}>
              {u.email || u.phone || u.id.slice(0,8)}
              {u.user_metadata?.name ? ` (${u.user_metadata.name})` : ''}
            </option>
          ))}
        </select>
      ) : (
        <button
          onClick={onUnlink}
          disabled={saving===s.id}
          style={{
            padding:'7px 14px', borderRadius:8,
            border:'1px solid #fecaca', background:'#fee2e2',
            color:'#dc2626', fontSize:12, fontWeight:700,
            cursor: saving===s.id?'not-allowed':'pointer',
            fontFamily:'inherit', opacity: saving===s.id?.6:1,
          }}
        >
          {saving===s.id?'⏳':'Unlink'}
        </button>
      )}
    </div>
  )
}

// ── Button helper ─────────────────────────────────────────────────────────────
function Btn(bg, disabled=false) {
  return {
    padding:'10px 18px', borderRadius:8, border:'none',
    background:bg, color:'white', fontWeight:700, fontSize:13,
    cursor:disabled?'not-allowed':'pointer', fontFamily:'inherit',
    opacity:disabled?.7:1, minHeight:40,
  }
}