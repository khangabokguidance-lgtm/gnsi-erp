import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from './supabase'

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_CAMPUS = { lat: 24.6821, lng: 93.9876, radius: 100 }
const FRAUD_TYPES = {
  outside_campus: { label: 'Outside Campus',    color: '#ef4444', icon: '📍' },
  fake_gps:       { label: 'Fake GPS Suspected', color: '#f97316', icon: '🛰️' },
  wrong_time:     { label: 'Outside Time Window',color: '#f59e0b', icon: '⏰' },
  duplicate:      { label: 'Duplicate Attempt',  color: '#8b5cf6', icon: '🔁' },
  device_clash:   { label: 'Shared Device',      color: '#ec4899', icon: '📱' },
  velocity:       { label: 'Velocity Anomaly',   color: '#06b6d4', icon: '⚡' },
}

// ─── Utility Functions ────────────────────────────────────────────────────────

function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

function getDeviceFingerprint() {
  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    ctx.textBaseline = 'top'
    ctx.font = '14px Arial'
    ctx.fillStyle = '#1e3a5f'
    ctx.fillText('GNSI-FP-2026', 2, 2)
    return btoa([
      canvas.toDataURL().slice(-50),
      navigator.userAgent,
      screen.width + 'x' + screen.height,
      navigator.language,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || 0,
    ].join('|')).slice(0, 64)
  } catch { return 'unknown-' + Date.now() }
}

function isWithinWindow(shiftStart, windowMin) {
  const now = new Date()
  const [h, m] = shiftStart.split(':').map(Number)
  const shiftMin = h * 60 + m
  const nowMin   = now.getHours() * 60 + now.getMinutes()
  const diff     = nowMin - shiftMin
  return diff >= -windowMin && diff <= windowMin
}

function minutesUntilWindow(shiftStart, windowMin) {
  const now = new Date()
  const [h, m] = shiftStart.split(':').map(Number)
  const shiftMin = h * 60 + m
  const nowMin   = now.getHours() * 60 + now.getMinutes()
  return shiftMin - windowMin - nowMin
}

const today = () => new Date().toISOString().split('T')[0]
const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}) : '—'
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—'
const fmt12   = (t) => {
  if (!t) return '—'
  const [h,m] = t.split(':').map(Number)
  return `${h%12||12}:${String(m).padStart(2,'0')} ${h<12?'AM':'PM'}`
}

// ─── Shared Styles ────────────────────────────────────────────────────────────

const S = {
  page:  { padding:'24px', fontFamily:"'Segoe UI',sans-serif", background:'#f8fafc', minHeight:'100vh' },
  card:  { background:'white', borderRadius:'12px', boxShadow:'0 2px 8px rgba(0,0,0,0.08)', padding:'24px', marginBottom:'20px' },
  btn:   (c='#1e3a5f',dis=false) => ({ backgroundColor:dis?'#94a3b8':c, color:'white', border:'none', borderRadius:'8px', padding:'10px 20px', fontWeight:'600', cursor:dis?'not-allowed':'pointer', fontSize:'14px', opacity:dis?0.7:1 }),
  btnSm: (c='#1e3a5f') => ({ backgroundColor:c, color:'white', border:'none', borderRadius:'6px', padding:'6px 12px', fontWeight:'600', cursor:'pointer', fontSize:'12px' }),
  input: { width:'100%', padding:'10px 14px', borderRadius:'8px', border:'1px solid #d1d5db', fontSize:'14px', boxSizing:'border-box' },
  label: { display:'block', fontSize:'13px', fontWeight:'600', color:'#374151', marginBottom:'6px' },
  tab:   (a) => ({ padding:'10px 18px', fontWeight:'600', fontSize:'13px', cursor:'pointer', background:'none', border:'none', borderBottom:`3px solid ${a?'#1e3a5f':'transparent'}`, color:a?'#1e3a5f':'#64748b' }),
}
const th = { padding:'11px 14px', textAlign:'left', fontWeight:'600', color:'#374151', fontSize:'12px', background:'#f8fafc' }
const td = { padding:'11px 14px', verticalAlign:'middle', color:'#334155', fontSize:'13px' }

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const map = {
    Present: { bg:'#dcfce7', color:'#16a34a', icon:'✅' },
    Late:    { bg:'#fef3c7', color:'#b45309', icon:'🕐' },
    Outside: { bg:'#fee2e2', color:'#dc2626', icon:'📍' },
    Flagged: { bg:'#fce7f3', color:'#be185d', icon:'🚨' },
    Absent:  { bg:'#f1f5f9', color:'#64748b', icon:'⭕' },
    Pending: { bg:'#eff6ff', color:'#1d4ed8', icon:'⏳' },
  }
  const m = map[status] || map.Pending
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:'4px', padding:'3px 10px', borderRadius:'999px', fontSize:'12px', fontWeight:'700', background:m.bg, color:m.color }}>
      {m.icon} {status}
    </span>
  )
}

// ─── Fraud Badge ──────────────────────────────────────────────────────────────

function FraudBadge({ type }) {
  const m = FRAUD_TYPES[type] || { label:type, color:'#64748b', icon:'⚠️' }
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:'3px', padding:'2px 8px', borderRadius:'6px', fontSize:'11px', fontWeight:'700', background:m.color+'18', color:m.color, border:`1px solid ${m.color}44` }}>
      {m.icon} {m.label}
    </span>
  )
}

// ─── GPS Status Ring ──────────────────────────────────────────────────────────

function GPSRing({ status, distance, accuracy, campus }) {
  const colors = { idle:'#94a3b8', locating:'#f59e0b', oncampus:'#16a34a', outside:'#ef4444', error:'#ef4444', weak:'#f97316' }
  const color = colors[status] || colors.idle
  const isOnCampus = status === 'oncampus'
  const pct = campus ? Math.max(0, Math.min(100, (1 - distance/campus.radius) * 100)) : 0

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'16px', padding:'28px 20px' }}>
      <div style={{ position:'relative', width:'140px', height:'140px' }}>
        {/* Outer pulse ring */}
        {status === 'locating' && (
          <div style={{ position:'absolute', inset:'-12px', borderRadius:'50%', border:`3px solid ${color}44`, animation:'pulse 1.5s infinite' }} />
        )}
        {isOnCampus && (
          <div style={{ position:'absolute', inset:'-8px', borderRadius:'50%', border:`2px solid ${color}55`, animation:'pulse 2s infinite' }} />
        )}
        {/* SVG ring */}
        <svg width="140" height="140" style={{ transform:'rotate(-90deg)', position:'absolute', inset:0 }}>
          <circle cx="70" cy="70" r="58" fill="none" stroke="#e2e8f0" strokeWidth="10" />
          <circle cx="70" cy="70" r="58" fill="none" stroke={color} strokeWidth="10"
            strokeDasharray={`${2*Math.PI*58}`}
            strokeDashoffset={`${2*Math.PI*58*(1 - (status==='locating'?0.7:isOnCampus?pct/100:0.2))}`}
            strokeLinecap="round"
            style={{ transition:'stroke-dashoffset 0.8s ease, stroke 0.4s' }}
          />
        </svg>
        {/* Center content */}
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
          <div style={{ fontSize:'32px', lineHeight:1 }}>
            {status==='idle'     ? '📍'
            :status==='locating' ? '📡'
            :status==='oncampus' ? '✅'
            :status==='outside'  ? '❌'
            :status==='weak'     ? '⚠️'
            :'❌'}
          </div>
          {distance !== null && status !== 'locating' && status !== 'idle' && (
            <div style={{ fontSize:'13px', fontWeight:'800', color, marginTop:'4px' }}>{Math.round(distance)}m</div>
          )}
        </div>
      </div>
      {/* Labels */}
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:'15px', fontWeight:'700', color }}>
          {status==='idle'     ? 'Ready to Check In'
          :status==='locating' ? 'Detecting Location...'
          :status==='oncampus' ? 'You are ON CAMPUS'
          :status==='outside'  ? `Outside Campus — ${Math.round(distance)}m away`
          :status==='weak'     ? 'GPS Signal Weak'
          :'Location Error'}
        </div>
        {accuracy && status !== 'idle' && status !== 'error' && (
          <div style={{ fontSize:'12px', color:'#94a3b8', marginTop:'4px' }}>GPS Accuracy: ±{Math.round(accuracy)}m</div>
        )}
      </div>
      <style>{`@keyframes pulse{0%{transform:scale(1);opacity:0.8}50%{transform:scale(1.08);opacity:0.4}100%{transform:scale(1);opacity:0.8}}`}</style>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function GeoAttendance({ currentStaff, isAdmin, allStaff = [] }) {
  const [activeTab,      setActiveTab]      = useState(isAdmin ? 'admin' : 'checkin')
  const [campus,         setCampus]         = useState(null)
  const [shifts,         setShifts]         = useState([])
  const [todayLogs,      setTodayLogs]      = useState([])
  const [fraudLogs,      setFraudLogs]      = useState([])
  const [monthLogs,      setMonthLogs]      = useState([])
  const [loading,        setLoading]        = useState(true)
  const [toast,          setToast]          = useState('')
  const [toastType,      setToastType]      = useState('ok')

  // Check-in state
  const [gpsStatus,      setGpsStatus]      = useState('idle')
  const [gpsCoords,      setGpsCoords]      = useState(null)
  const [gpsDistance,    setGpsDistance]    = useState(null)
  const [gpsAccuracy,    setGpsAccuracy]    = useState(null)
  const [checkingIn,     setCheckingIn]     = useState(false)
  const [myLogs,         setMyLogs]         = useState([])
  const [myShifts,       setMyShifts]       = useState([])

  // Admin state
  const [campusForm,     setCampusForm]     = useState({ name:'Main Campus', lat:'', lng:'', radius:100 })
  const [savingCampus,   setSavingCampus]   = useState(false)
  const [shiftForms,     setShiftForms]     = useState([])
  const [savingShifts,   setSavingShifts]   = useState(false)
  const [selectedStaff,  setSelectedStaff]  = useState('')
  const [monthFilter,    setMonthFilter]    = useState(new Date().toISOString().slice(0,7))
  const [resolvingId,    setResolvingId]    = useState(null)
  const [resolveNote,    setResolveNote]    = useState('')

  const watchRef = useRef(null)

  const showToast = (msg, type='ok') => {
    setToast(msg); setToastType(type)
    setTimeout(() => setToast(''), 4000)
  }

  // ── Fetch campus zone ──
  const fetchCampus = useCallback(async () => {
    const { data } = await supabase.from('attendance_zones').select('*').eq('is_active', true).single()
    if (data) {
      setCampus({ lat: data.latitude, lng: data.longitude, radius: data.radius_meters, name: data.name, id: data.id })
      setCampusForm({ name:data.name, lat:data.latitude, lng:data.longitude, radius:data.radius_meters })
    } else {
      setCampus(DEFAULT_CAMPUS)
    }
  }, [])

  // ── Fetch shifts for a staff ──
  const fetchShiftsFor = useCallback(async (staffId) => {
    if (!staffId) return []
    const { data } = await supabase.from('staff_shifts').select('*').eq('staff_id', staffId).eq('is_active', true).order('shift_start')
    return data || []
  }, [])

  // ── Fetch today's logs ──
  const fetchTodayLogs = useCallback(async () => {
    const { data } = await supabase.from('staff_geo_attendance')
      .select('*, staff_profiles(name,designation,department)')
      .eq('date', today())
      .order('check_in_time', { ascending: false })
    setTodayLogs(data || [])
  }, [])

  // ── Fetch fraud logs ──
  const fetchFraudLogs = useCallback(async () => {
    const { data } = await supabase.from('attendance_fraud_log')
      .select('*, staff_profiles(name,designation)')
      .eq('resolved', false)
      .order('created_at', { ascending: false })
      .limit(50)
    setFraudLogs(data || [])
  }, [])

  // ── Fetch my logs ──
  const fetchMyLogs = useCallback(async () => {
    if (!currentStaff?.id) return
    const { data } = await supabase.from('staff_geo_attendance')
      .select('*')
      .eq('staff_id', currentStaff.id)
      .order('date', { ascending: false })
      .limit(30)
    setMyLogs(data || [])
  }, [currentStaff?.id])

  // ── Fetch month logs for admin ──
  const fetchMonthLogs = useCallback(async () => {
    if (!monthFilter) return
    const from = monthFilter + '-01'
    const to   = monthFilter + '-31'
    let q = supabase.from('staff_geo_attendance')
      .select('*, staff_profiles(name,designation,department)')
      .gte('date', from).lte('date', to)
      .order('date', { ascending: false })
    if (selectedStaff) q = q.eq('staff_id', selectedStaff)
    const { data } = await q
    setMonthLogs(data || [])
  }, [monthFilter, selectedStaff])

  // ── Initial load ──
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await fetchCampus()
      if (currentStaff?.id) {
        const sh = await fetchShiftsFor(currentStaff.id)
        setMyShifts(sh)
        await fetchMyLogs()
      }
      if (isAdmin) {
        await fetchTodayLogs()
        await fetchFraudLogs()
      }
      setLoading(false)
    }
    init()
  }, [currentStaff?.id, isAdmin])

  useEffect(() => { if (isAdmin && activeTab === 'monitor') fetchTodayLogs() }, [activeTab])
  useEffect(() => { if (isAdmin && activeTab === 'fraud')   fetchFraudLogs() }, [activeTab])
  useEffect(() => { if (isAdmin && activeTab === 'report')  fetchMonthLogs() }, [activeTab, monthFilter, selectedStaff])

  // ── Fetch shifts for admin selected staff ──
  useEffect(() => {
    if (isAdmin && activeTab === 'shifts' && selectedStaff) {
      fetchShiftsFor(selectedStaff).then(sh => setShiftForms(
        sh.map(s => ({ ...s, _edit: false }))
      ))
    }
  }, [activeTab, selectedStaff])

  // ── Stop GPS watch on unmount ──
  useEffect(() => () => { if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current) }, [])

  // ── Start GPS ──
  const startGPS = () => {
    if (!navigator.geolocation) {
      showToast('❌ GPS not supported on this device', 'err'); return
    }
    setGpsStatus('locating')
    if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current)
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        setGpsCoords({ lat: latitude, lng: longitude })
        setGpsAccuracy(accuracy)
        if (!campus) return
        const dist = getDistance(latitude, longitude, campus.lat, campus.lng)
        setGpsDistance(dist)
        if (accuracy > 60)       setGpsStatus('weak')
        else if (dist <= campus.radius) setGpsStatus('oncampus')
        else                     setGpsStatus('outside')
      },
      (err) => {
        setGpsStatus('error')
        const msgs = { 1:'Location permission denied. Allow in browser settings.', 2:'GPS unavailable. Try outdoors.', 3:'GPS timeout. Try again.' }
        showToast('❌ ' + (msgs[err.code] || 'Location error'), 'err')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  // ── Log fraud ──
  const logFraud = async (staffId, date, shiftLabel, type, detail, extra = {}) => {
    await supabase.from('attendance_fraud_log').insert({
      staff_id: staffId, date, shift_label: shiftLabel,
      fraud_type: type, detail,
      lat: extra.lat, lng: extra.lng,
      accuracy: extra.accuracy,
      device_fingerprint: extra.fp,
      created_at: new Date().toISOString()
    })
  }

  // ── Main check-in handler ──
  const handleCheckIn = async (shift) => {
    if (!currentStaff?.id) { showToast('❌ Staff profile not found', 'err'); return }
    if (!campus)            { showToast('❌ Campus zone not configured. Contact admin.', 'err'); return }
    if (!gpsCoords)         { showToast('❌ GPS not ready. Click Detect Location first.', 'err'); return }
    if (gpsAccuracy > 60)   { showToast('⚠️ GPS signal too weak. Move outdoors.', 'warn'); return }

    setCheckingIn(true)
    const fraudFlags = []
    const fp = getDeviceFingerprint()
    const now = new Date()
    const dateStr = today()

    try {
      // Layer 3 — time window
      if (!isWithinWindow(shift.shift_start, shift.check_in_window_min || 10)) {
        const minsLeft = minutesUntilWindow(shift.shift_start, shift.check_in_window_min || 10)
        await logFraud(currentStaff.id, dateStr, shift.shift_label, 'wrong_time',
          `Check-in at ${now.toLocaleTimeString()} outside ±${shift.check_in_window_min||10}min window of ${shift.shift_start}`)
        showToast(minsLeft > 0
          ? `⏰ Check-in window opens in ${minsLeft} minutes (${fmt12(shift.shift_start)} ±${shift.check_in_window_min||10}min)`
          : `⏰ Check-in window closed for Shift ${shift.shift_label}`, 'warn')
        setCheckingIn(false); return
      }

      // Layer 4 — duplicate
      const { data: existing } = await supabase.from('staff_geo_attendance')
        .select('id').eq('staff_id', currentStaff.id).eq('date', dateStr).eq('shift_label', shift.shift_label).single()
      if (existing) {
        await logFraud(currentStaff.id, dateStr, shift.shift_label, 'duplicate', 'Second check-in attempt')
        showToast('⚠️ Already checked in for this shift', 'warn')
        setCheckingIn(false); return
      }

      // Layer 1 — campus boundary
      const dist = getDistance(gpsCoords.lat, gpsCoords.lng, campus.lat, campus.lng)
      if (dist > campus.radius) {
        fraudFlags.push({ type:'outside_campus', detail:`${Math.round(dist)}m from campus (max ${campus.radius}m)` })
        await logFraud(currentStaff.id, dateStr, shift.shift_label, 'outside_campus',
          `${Math.round(dist)}m from campus`, { lat:gpsCoords.lat, lng:gpsCoords.lng, accuracy:gpsAccuracy, fp })
      }

      // Layer 2 — fake GPS (emulator has near-perfect accuracy)
      if (gpsAccuracy < 2) {
        fraudFlags.push({ type:'fake_gps', detail:`Suspiciously perfect accuracy: ${gpsAccuracy}m (emulator suspected)` })
        await logFraud(currentStaff.id, dateStr, shift.shift_label, 'fake_gps',
          `Accuracy ${gpsAccuracy}m`, { lat:gpsCoords.lat, lng:gpsCoords.lng, accuracy:gpsAccuracy, fp })
      }

      // Layer 5 — device fingerprint clash
      const { data: clash } = await supabase.from('staff_geo_attendance')
        .select('staff_id, staff_profiles(name)').eq('date', dateStr).eq('device_fingerprint', fp).neq('staff_id', currentStaff.id).limit(1)
      if (clash?.length > 0) {
        fraudFlags.push({ type:'device_clash', detail:`Same device used by ${clash[0].staff_profiles?.name}` })
        await logFraud(currentStaff.id, dateStr, shift.shift_label, 'device_clash',
          `Device also used by staff ID ${clash[0].staff_id}`, { fp })
      }

      // Layer 6 — velocity (checked out < 30 min ago on different shift)
      const { data: recent } = await supabase.from('staff_geo_attendance')
        .select('check_out_time').eq('staff_id', currentStaff.id).eq('date', dateStr).not('check_out_time', 'is', null).order('check_out_time', { ascending:false }).limit(1)
      if (recent?.length > 0) {
        const minsSinceOut = (now - new Date(recent[0].check_out_time)) / 60000
        if (minsSinceOut < 30) {
          fraudFlags.push({ type:'velocity', detail:`Only ${Math.round(minsSinceOut)} min since last check-out` })
          await logFraud(currentStaff.id, dateStr, shift.shift_label, 'velocity',
            `${Math.round(minsSinceOut)}min since last checkout`, { fp })
        }
      }

      const isFraud    = fraudFlags.some(f => ['outside_campus','fake_gps','device_clash'].includes(f.type))
      const isLate     = !isFraud && (() => {
        const [h,m] = shift.shift_start.split(':').map(Number)
        const shiftMs = h*60+m
        const nowMs   = now.getHours()*60+now.getMinutes()
        return nowMs > shiftMs + (shift.check_in_window_min||10)
      })()
      const status = isFraud ? 'Flagged' : dist > campus.radius ? 'Outside' : isLate ? 'Late' : 'Present'

      const { error } = await supabase.from('staff_geo_attendance').insert({
        staff_id:             currentStaff.id,
        date:                 dateStr,
        shift_id:             shift.id,
        shift_label:          shift.shift_label,
        check_in_time:        now.toISOString(),
        check_in_lat:         gpsCoords.lat,
        check_in_lng:         gpsCoords.lng,
        accuracy_meters:      gpsAccuracy,
        distance_from_campus: Math.round(dist),
        is_within_zone:       dist <= campus.radius,
        device_fingerprint:   fp,
        device_info:          navigator.userAgent.slice(0,200),
        status,
        fraud_flags:          fraudFlags,
        is_fraud_suspected:   isFraud || fraudFlags.length > 0,
        marked_by:            'self',
      })

      if (error) { showToast('❌ Error: ' + error.message, 'err'); setCheckingIn(false); return }

      await fetchMyLogs()
      if (isFraud) showToast('🚨 Check-in recorded but flagged for admin review.', 'warn')
      else         showToast(`✅ Checked in for Shift ${shift.shift_label} — ${status}`, 'ok')

    } catch (err) {
      showToast('❌ Check-in failed: ' + err.message, 'err')
    }
    setCheckingIn(false)
  }

  // ── Check-out handler ──
  const handleCheckOut = async (logId) => {
    if (!gpsCoords) { showToast('❌ Detect location first', 'err'); return }
    const { error } = await supabase.from('staff_geo_attendance').update({
      check_out_time: new Date().toISOString(),
      check_out_lat:  gpsCoords.lat,
      check_out_lng:  gpsCoords.lng,
    }).eq('id', logId)
    if (error) { showToast('❌ ' + error.message, 'err'); return }
    await fetchMyLogs()
    showToast('✅ Checked out successfully', 'ok')
  }

  // ── Save campus zone ──
  const saveCampus = async () => {
    if (!campusForm.lat || !campusForm.lng) { showToast('❌ Enter latitude and longitude', 'err'); return }
    setSavingCampus(true)
    const payload = { name:campusForm.name, latitude:parseFloat(campusForm.lat), longitude:parseFloat(campusForm.lng), radius_meters:parseInt(campusForm.radius)||100, is_active:true }
    let error
    if (campus?.id) {
      ({ error } = await supabase.from('attendance_zones').update(payload).eq('id', campus.id))
    } else {
      ({ error } = await supabase.from('attendance_zones').insert(payload))
    }
    if (error) showToast('❌ ' + error.message, 'err')
    else { showToast('✅ Campus zone saved', 'ok'); await fetchCampus() }
    setSavingCampus(false)
  }

  // ── Save shifts ──
  const saveShifts = async () => {
    if (!selectedStaff) { showToast('❌ Select a staff first', 'err'); return }
    setSavingShifts(true)
    for (const sf of shiftForms) {
      if (!sf.shift_label || !sf.shift_start || !sf.shift_end) continue
      const payload = {
        staff_id: selectedStaff, shift_label: sf.shift_label,
        shift_start: sf.shift_start, shift_end: sf.shift_end,
        check_in_window_min: parseInt(sf.check_in_window_min)||10,
        is_active: true,
        effective_from: today(),
        created_by: 'Admin'
      }
      if (sf.id) {
        await supabase.from('staff_shifts').update(payload).eq('id', sf.id)
      } else {
        await supabase.from('staff_shifts').insert(payload)
      }
    }
    showToast('✅ Shifts saved', 'ok')
    setSavingShifts(false)
    const sh = await fetchShiftsFor(selectedStaff)
    setShiftForms(sh.map(s => ({ ...s, _edit:false })))
  }

  // ── Delete shift ──
  const deleteShift = async (id) => {
    if (!window.confirm('Remove this shift?')) return
    if (id.toString().startsWith('new')) {
      setShiftForms(prev => prev.filter(s => s.id !== id)); return
    }
    await supabase.from('staff_shifts').update({ is_active:false }).eq('id', id)
    const sh = await fetchShiftsFor(selectedStaff)
    setShiftForms(sh.map(s => ({ ...s, _edit:false })))
    showToast('🗑️ Shift removed', 'ok')
  }

  // ── Resolve fraud ──
  const resolveFraud = async (logId, action) => {
    if (!resolveNote) { showToast('❌ Add a resolution note first', 'err'); return }
    await supabase.from('attendance_fraud_log').update({ resolved:true, resolved_by:'Admin', resolved_note:resolveNote }).eq('id', logId)
    if (action === 'absent') {
      const fraudEntry = fraudLogs.find(f => f.id === logId)
      if (fraudEntry) {
        await supabase.from('staff_geo_attendance')
          .update({ status:'Absent', override_by:'Admin', override_note:resolveNote })
          .eq('staff_id', fraudEntry.staff_id).eq('date', fraudEntry.date).eq('shift_label', fraudEntry.shift_label)
      }
    }
    setResolvingId(null); setResolveNote('')
    await fetchFraudLogs()
    showToast('✅ Fraud alert resolved', 'ok')
  }

  // ── Admin manual override ──
  const adminOverride = async (logId, newStatus, note) => {
    await supabase.from('staff_geo_attendance').update({
      status: newStatus, override_by:'Admin', override_note:note
    }).eq('id', logId)
    await fetchTodayLogs()
    showToast(`✅ Status updated to ${newStatus}`, 'ok')
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  const todayMyLogs = myLogs.filter(l => l.date === today())

  const tabs = [
    { key:'checkin', label:'📍 My Check-In' },
    ...(isAdmin ? [
      { key:'monitor', label:'👁️ Live Monitor' },
      { key:'fraud',   label:`🚨 Fraud Alerts${fraudLogs.length>0?` (${fraudLogs.length})`:''}` },
      { key:'shifts',  label:'⏰ Shift Setup' },
      { key:'campus',  label:'🗺️ Campus Zone' },
      { key:'report',  label:'📊 Monthly Report' },
    ] : [
      { key:'history', label:'📅 My History' },
    ])
  ]

  if (loading) return <div style={{ textAlign:'center', padding:'60px', color:'#94a3b8', fontFamily:"'Segoe UI',sans-serif" }}>⏳ Loading Geo-Attendance...</div>

  return (
    <div style={S.page}>

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', top:'20px', right:'20px', zIndex:3000, padding:'13px 20px', borderRadius:'12px', boxShadow:'0 8px 24px rgba(0,0,0,0.2)', fontSize:'14px', fontWeight:'600', color:'white', background: toastType==='err'?'#dc2626':toastType==='warn'?'#d97706':'#16a34a', maxWidth:'360px' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom:'24px' }}>
        <h1 style={{ fontSize:'24px', fontWeight:'800', color:'#1e3a5f', margin:0 }}>📍 Geo-Attendance</h1>
        <p style={{ color:'#64748b', fontSize:'13px', margin:'4px 0 0' }}>
          Campus-verified attendance · Fraud-proof · Shift-aware
          {campus && <span style={{ marginLeft:'12px', color:'#16a34a', fontWeight:'600' }}>✅ Campus: {campus.name} ({campus.radius}m radius)</span>}
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'2px solid #e2e8f0', marginBottom:'24px', gap:'4px', flexWrap:'wrap' }}>
        {tabs.map(t => <button key={t.key} onClick={() => setActiveTab(t.key)} style={S.tab(activeTab===t.key)}>{t.label}</button>)}
      </div>

      {/* ── MY CHECK-IN TAB ── */}
      {activeTab === 'checkin' && (
        <div style={{ maxWidth:'480px', margin:'0 auto' }}>

          {/* Today's status cards */}
          {todayMyLogs.length > 0 && (
            <div style={{ ...S.card, padding:'16px', marginBottom:'16px' }}>
              <div style={{ fontSize:'13px', fontWeight:'700', color:'#1e3a5f', marginBottom:'12px' }}>Today's Attendance</div>
              {todayMyLogs.map(log => (
                <div key={log.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background:'#f8fafc', borderRadius:'10px', marginBottom:'8px', border:'1px solid #e2e8f0' }}>
                  <div>
                    <div style={{ fontWeight:'700', fontSize:'13px', color:'#1e293b' }}>Shift {log.shift_label}</div>
                    <div style={{ fontSize:'12px', color:'#64748b' }}>In: {fmtTime(log.check_in_time)} · Out: {fmtTime(log.check_out_time)}</div>
                    {log.distance_from_campus !== null && (
                      <div style={{ fontSize:'11px', color:'#94a3b8' }}>{log.distance_from_campus}m from campus</div>
                    )}
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'6px' }}>
                    <StatusBadge status={log.status} />
                    {log.check_in_time && !log.check_out_time && (
                      <button onClick={() => handleCheckOut(log.id)} style={S.btnSm('#0ea5e9')}>Check Out</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* GPS Ring */}
          <div style={S.card}>
            <GPSRing status={gpsStatus} distance={gpsDistance} accuracy={gpsAccuracy} campus={campus} />

            {/* Detect button */}
            {gpsStatus === 'idle' && (
              <button onClick={startGPS} style={{ ...S.btn('#1e3a5f'), width:'100%', padding:'14px', fontSize:'15px', fontWeight:'800' }}>
                📡 Detect My Location
              </button>
            )}
            {gpsStatus === 'locating' && (
              <div style={{ textAlign:'center', color:'#f59e0b', fontWeight:'600', padding:'8px' }}>📡 Acquiring GPS signal...</div>
            )}
            {(gpsStatus === 'weak' || gpsStatus === 'error') && (
              <button onClick={startGPS} style={{ ...S.btn('#f59e0b'), width:'100%', padding:'12px' }}>🔄 Retry Detection</button>
            )}

            {/* Shift check-in buttons */}
            {(gpsStatus === 'oncampus' || gpsStatus === 'outside') && myShifts.length > 0 && (
              <div style={{ marginTop:'16px', display:'flex', flexDirection:'column', gap:'10px' }}>
                {myShifts.map(shift => {
                  const alreadyDone = todayMyLogs.some(l => l.shift_label === shift.shift_label)
                  const inWindow    = isWithinWindow(shift.shift_start, shift.check_in_window_min||10)
                  const minsLeft    = minutesUntilWindow(shift.shift_start, shift.check_in_window_min||10)
                  return (
                    <div key={shift.id} style={{ background:'#f8fafc', borderRadius:'10px', padding:'14px', border:`1px solid ${alreadyDone?'#bbf7d0':inWindow?'#1e3a5f44':'#e2e8f0'}` }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
                        <div>
                          <div style={{ fontWeight:'700', color:'#1e293b', fontSize:'14px' }}>Shift {shift.shift_label}</div>
                          <div style={{ fontSize:'12px', color:'#64748b' }}>{fmt12(shift.shift_start)} → {fmt12(shift.shift_end)}</div>
                          <div style={{ fontSize:'11px', color:'#94a3b8' }}>Window: ±{shift.check_in_window_min||10} min</div>
                        </div>
                        {alreadyDone
                          ? <StatusBadge status={todayMyLogs.find(l=>l.shift_label===shift.shift_label)?.status||'Present'} />
                          : inWindow
                            ? <button onClick={() => handleCheckIn(shift)} disabled={checkingIn || gpsStatus==='outside'}
                                style={{ ...S.btn(gpsStatus==='outside'?'#ef4444':'#16a34a', checkingIn), padding:'10px 16px', fontSize:'13px' }}>
                                {checkingIn ? '⏳' : gpsStatus==='outside' ? '❌ Outside' : '✅ Check In'}
                              </button>
                            : minsLeft > 0
                              ? <span style={{ fontSize:'12px', color:'#f59e0b', fontWeight:'700' }}>Opens in {minsLeft}m</span>
                              : <span style={{ fontSize:'12px', color:'#94a3b8', fontWeight:'600' }}>Window closed</span>
                        }
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {(gpsStatus === 'oncampus' || gpsStatus === 'outside') && myShifts.length === 0 && (
              <div style={{ marginTop:'12px', padding:'14px', background:'#fef3c7', borderRadius:'10px', textAlign:'center', fontSize:'13px', color:'#b45309', fontWeight:'600' }}>
                ⚠️ No shifts assigned. Contact admin to assign your shift.
              </div>
            )}
          </div>

          {/* Fraud warning */}
          {gpsStatus === 'outside' && (
            <div style={{ ...S.card, background:'#fee2e2', border:'1px solid #fecaca' }}>
              <div style={{ fontWeight:'700', color:'#dc2626', marginBottom:'4px' }}>🚨 Outside Campus Boundary</div>
              <div style={{ fontSize:'13px', color:'#7f1d1d' }}>
                You are {gpsDistance ? Math.round(gpsDistance) : '?'}m from campus. Check-in attempted outside campus will be flagged and reported to admin.
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── LIVE MONITOR (ADMIN) ── */}
      {activeTab === 'monitor' && isAdmin && (
        <>
          {/* Summary cards */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'14px', marginBottom:'20px' }}>
            {[
              { label:'Total',    value:todayLogs.length,                                          color:'#1e3a5f', icon:'📋' },
              { label:'Present',  value:todayLogs.filter(l=>l.status==='Present').length,           color:'#16a34a', icon:'✅' },
              { label:'Late',     value:todayLogs.filter(l=>l.status==='Late').length,              color:'#b45309', icon:'🕐' },
              { label:'Outside',  value:todayLogs.filter(l=>l.status==='Outside').length,           color:'#dc2626', icon:'📍' },
              { label:'Flagged',  value:todayLogs.filter(l=>l.is_fraud_suspected).length,           color:'#be185d', icon:'🚨' },
            ].map(c => (
              <div key={c.label} style={{ background:'white', borderRadius:'12px', padding:'16px', boxShadow:'0 1px 3px rgba(0,0,0,0.07)', borderLeft:`4px solid ${c.color}` }}>
                <div style={{ fontSize:'20px' }}>{c.icon}</div>
                <div style={{ fontSize:'24px', fontWeight:'800', color:'#0f172a' }}>{c.value}</div>
                <div style={{ fontSize:'12px', color:'#64748b' }}>{c.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
            <div style={{ fontWeight:'700', color:'#1e293b', fontSize:'15px' }}>Today — {fmtDate(today())}</div>
            <button onClick={fetchTodayLogs} style={S.btnSm('#1e3a5f')}>🔄 Refresh</button>
          </div>

          <div style={{ ...S.card, padding:0, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
              <thead>
                <tr>{['Staff','Shift','Check-In','Check-Out','Distance','Accuracy','Status','Fraud','Action'].map(h=><th key={h} style={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {todayLogs.map(log => (
                  <tr key={log.id} style={{ borderBottom:'1px solid #f1f5f9', background:log.is_fraud_suspected?'#fff7f7':'white' }}>
                    <td style={td}>
                      <div style={{ fontWeight:'600' }}>{log.staff_profiles?.name || '—'}</div>
                      <div style={{ fontSize:'11px', color:'#94a3b8' }}>{log.staff_profiles?.designation}</div>
                    </td>
                    <td style={td}><span style={{ fontWeight:'700', color:'#1e3a5f' }}>Shift {log.shift_label}</span></td>
                    <td style={td}>{fmtTime(log.check_in_time)}</td>
                    <td style={td}>{fmtTime(log.check_out_time)}</td>
                    <td style={{ ...td, fontWeight:'600', color:log.is_within_zone?'#16a34a':'#dc2626' }}>
                      {log.distance_from_campus !== null ? `${log.distance_from_campus}m` : '—'}
                    </td>
                    <td style={{ ...td, color:'#64748b' }}>{log.accuracy_meters ? `±${Math.round(log.accuracy_meters)}m` : '—'}</td>
                    <td style={td}><StatusBadge status={log.status} /></td>
                    <td style={td}>
                      {log.fraud_flags?.length > 0
                        ? <div style={{ display:'flex', flexDirection:'column', gap:'3px' }}>
                            {log.fraud_flags.map((f,i) => <FraudBadge key={i} type={f.type} />)}
                          </div>
                        : <span style={{ color:'#94a3b8', fontSize:'12px' }}>—</span>
                      }
                    </td>
                    <td style={td}>
                      <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
                        <button onClick={() => adminOverride(log.id,'Present','Admin verified')} style={S.btnSm('#16a34a')}>✅</button>
                        <button onClick={() => adminOverride(log.id,'Absent','Admin override')}  style={S.btnSm('#dc2626')}>⭕</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {todayLogs.length === 0 && (
                  <tr><td colSpan="9" style={{ padding:'40px', textAlign:'center', color:'#94a3b8' }}>No check-ins yet today</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── FRAUD ALERTS (ADMIN) ── */}
      {activeTab === 'fraud' && isAdmin && (
        <>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
            <h2 style={{ fontSize:'17px', fontWeight:'700', color:'#dc2626', margin:0 }}>🚨 Unresolved Fraud Alerts</h2>
            <button onClick={fetchFraudLogs} style={S.btnSm('#dc2626')}>🔄 Refresh</button>
          </div>

          {fraudLogs.length === 0 && (
            <div style={{ ...S.card, textAlign:'center', color:'#16a34a', padding:'48px' }}>
              <div style={{ fontSize:'32px', marginBottom:'8px' }}>✅</div>
              <div style={{ fontWeight:'700' }}>No unresolved fraud alerts</div>
            </div>
          )}

          {fraudLogs.map(fl => (
            <div key={fl.id} style={{ ...S.card, border:`1px solid ${FRAUD_TYPES[fl.fraud_type]?.color||'#ef4444'}44`, marginBottom:'16px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'12px' }}>
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px' }}>
                    <FraudBadge type={fl.fraud_type} />
                    <span style={{ fontSize:'12px', color:'#94a3b8' }}>{fmtDate(fl.date)} · Shift {fl.shift_label}</span>
                  </div>
                  <div style={{ fontWeight:'700', fontSize:'15px', color:'#1e293b' }}>{fl.staff_profiles?.name}</div>
                  <div style={{ fontSize:'12px', color:'#64748b' }}>{fl.staff_profiles?.designation}</div>
                  <div style={{ marginTop:'8px', padding:'8px 12px', background:'#f8fafc', borderRadius:'8px', fontSize:'13px', color:'#475569' }}>
                    {fl.detail}
                  </div>
                  {fl.lat && (
                    <div style={{ fontSize:'11px', color:'#94a3b8', marginTop:'4px' }}>
                      GPS: {fl.lat?.toFixed(6)}, {fl.lng?.toFixed(6)} · Accuracy: ±{fl.accuracy}m
                    </div>
                  )}
                </div>
                <div style={{ fontSize:'12px', color:'#94a3b8' }}>{new Date(fl.created_at).toLocaleTimeString('en-IN')}</div>
              </div>

              {resolvingId === fl.id ? (
                <div style={{ marginTop:'14px', padding:'14px', background:'#f8fafc', borderRadius:'10px' }}>
                  <label style={S.label}>Resolution Note *</label>
                  <textarea value={resolveNote} onChange={e=>setResolveNote(e.target.value)} rows={2}
                    placeholder="Explain why this is resolved..." style={{ ...S.input, resize:'vertical', marginBottom:'10px' }} />
                  <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                    <button onClick={() => resolveFraud(fl.id,'approve')} style={S.btn('#16a34a')}>✅ Approve Attendance</button>
                    <button onClick={() => resolveFraud(fl.id,'absent')}  style={S.btn('#dc2626')}>❌ Mark Absent</button>
                    <button onClick={() => { setResolvingId(null); setResolveNote('') }} style={S.btn('#64748b')}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setResolvingId(fl.id)} style={{ ...S.btnSm('#1e3a5f'), marginTop:'12px' }}>🔍 Review & Resolve</button>
              )}
            </div>
          ))}
        </>
      )}

      {/* ── SHIFT SETUP (ADMIN) ── */}
      {activeTab === 'shifts' && isAdmin && (
        <div style={{ maxWidth:'640px' }}>
          <div style={S.card}>
            <h2 style={{ fontSize:'17px', fontWeight:'700', color:'#1e3a5f', marginTop:0 }}>⏰ Shift Configuration</h2>
            <div style={{ marginBottom:'20px' }}>
              <label style={S.label}>Select Staff Member</label>
              <select value={selectedStaff} onChange={e=>setSelectedStaff(e.target.value)} style={{ ...S.input, backgroundColor:'white' }}>
                <option value="">— Select Staff —</option>
                {allStaff.map(s => <option key={s.id} value={s.id}>{s.name} — {s.designation}</option>)}
              </select>
            </div>

            {selectedStaff && (
              <>
                <div style={{ display:'flex', flexDirection:'column', gap:'12px', marginBottom:'16px' }}>
                  {shiftForms.map((sf, i) => (
                    <div key={sf.id||i} style={{ background:'#f8fafc', borderRadius:'10px', padding:'14px', border:'1px solid #e2e8f0' }}>
                      <div style={{ display:'grid', gridTemplateColumns:'80px 1fr 1fr 80px', gap:'10px', alignItems:'flex-end' }}>
                        <div>
                          <label style={S.label}>Label</label>
                          <input value={sf.shift_label} onChange={e=>setShiftForms(prev=>prev.map((s,j)=>j===i?{...s,shift_label:e.target.value}:s))}
                            placeholder="A/B/C" style={S.input} maxLength={3} />
                        </div>
                        <div>
                          <label style={S.label}>Start Time</label>
                          <input type="time" value={sf.shift_start} onChange={e=>setShiftForms(prev=>prev.map((s,j)=>j===i?{...s,shift_start:e.target.value}:s))} style={S.input} />
                        </div>
                        <div>
                          <label style={S.label}>End Time</label>
                          <input type="time" value={sf.shift_end} onChange={e=>setShiftForms(prev=>prev.map((s,j)=>j===i?{...s,shift_end:e.target.value}:s))} style={S.input} />
                        </div>
                        <div>
                          <label style={S.label}>Window (min)</label>
                          <input type="number" min="5" max="30" value={sf.check_in_window_min||10}
                            onChange={e=>setShiftForms(prev=>prev.map((s,j)=>j===i?{...s,check_in_window_min:e.target.value}:s))} style={S.input} />
                        </div>
                      </div>
                      <div style={{ marginTop:'10px', display:'flex', gap:'6px', alignItems:'center' }}>
                        <span style={{ fontSize:'12px', color:'#94a3b8' }}>
                          Check-in window: {fmt12(sf.shift_start)} ±{sf.check_in_window_min||10} min
                        </span>
                        <button onClick={() => deleteShift(sf.id)} style={{ ...S.btnSm('#ef4444'), marginLeft:'auto' }}>Remove</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display:'flex', gap:'10px' }}>
                  <button onClick={() => setShiftForms(prev => [...prev, { id:'new-'+Date.now(), shift_label:'', shift_start:'08:00', shift_end:'14:00', check_in_window_min:10 }])}
                    style={S.btn('#0ea5e9')}>+ Add Shift</button>
                  <button onClick={saveShifts} disabled={savingShifts} style={S.btn('#16a34a', savingShifts)}>
                    {savingShifts ? '⏳ Saving...' : '💾 Save All Shifts'}
                  </button>
                </div>

                <div style={{ marginTop:'16px', padding:'12px', background:'#f0f9ff', borderRadius:'8px', fontSize:'12px', color:'#0284c7' }}>
                  💡 <strong>Double shift:</strong> Add both Shift A and Shift B for same staff. Each shift has independent check-in window and fraud guard.
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── CAMPUS ZONE SETUP (ADMIN) ── */}
      {activeTab === 'campus' && isAdmin && (
        <div style={{ maxWidth:'520px' }}>
          <div style={S.card}>
            <h2 style={{ fontSize:'17px', fontWeight:'700', color:'#1e3a5f', marginTop:0 }}>🗺️ Campus Geofence Setup</h2>
            <p style={{ fontSize:'13px', color:'#64748b', marginTop:'-8px', marginBottom:'20px' }}>
              Set the GPS coordinates of your institute. Staff must be within the radius to check in.
            </p>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px' }}>
              <div style={{ gridColumn:'span 2' }}>
                <label style={S.label}>Zone Name</label>
                <input value={campusForm.name} onChange={e=>setCampusForm({...campusForm,name:e.target.value})} style={S.input} />
              </div>
              <div>
                <label style={S.label}>Latitude</label>
                <input type="number" step="0.0001" value={campusForm.lat} onChange={e=>setCampusForm({...campusForm,lat:e.target.value})}
                  placeholder="e.g. 24.6821" style={S.input} />
              </div>
              <div>
                <label style={S.label}>Longitude</label>
                <input type="number" step="0.0001" value={campusForm.lng} onChange={e=>setCampusForm({...campusForm,lng:e.target.value})}
                  placeholder="e.g. 93.9876" style={S.input} />
              </div>
              <div style={{ gridColumn:'span 2' }}>
                <label style={S.label}>Allowed Radius (meters)</label>
                <input type="range" min="50" max="500" step="10" value={campusForm.radius}
                  onChange={e=>setCampusForm({...campusForm,radius:e.target.value})}
                  style={{ width:'100%', marginBottom:'6px' }} />
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', color:'#64748b' }}>
                  <span>50m (strict)</span>
                  <span style={{ fontWeight:'700', color:'#1e3a5f', fontSize:'15px' }}>{campusForm.radius}m radius</span>
                  <span>500m (lenient)</span>
                </div>
              </div>
            </div>

            <div style={{ margin:'16px 0', padding:'14px', background:'#f0f9ff', borderRadius:'10px', fontSize:'13px', color:'#0369a1' }}>
              💡 <strong>How to get coordinates:</strong> Open Google Maps on your phone at the institute gate → Long press → Copy the coordinates shown at the top.
              <br/><br/>
              📍 <strong>Recommended radius:</strong> 100–150m for buildings with GPS signal issues indoors.
            </div>

            {campus && (
              <div style={{ padding:'12px 14px', background:'#dcfce7', borderRadius:'8px', marginBottom:'16px', fontSize:'13px', color:'#166534', fontWeight:'600' }}>
                ✅ Current: {campus.name} · {campus.lat}, {campus.lng} · {campus.radius}m
              </div>
            )}

            <button onClick={saveCampus} disabled={savingCampus} style={{ ...S.btn('#1e3a5f', savingCampus), width:'100%', padding:'13px' }}>
              {savingCampus ? '⏳ Saving...' : '💾 Save Campus Zone'}
            </button>
          </div>

          {/* Fraud guard summary */}
          <div style={S.card}>
            <h3 style={{ fontSize:'15px', fontWeight:'700', color:'#1e3a5f', marginTop:0 }}>🛡️ Active Fraud Guards</h3>
            {[
              { icon:'📍', label:'Campus Boundary',    desc:`Staff must be within ${campus?.radius||100}m of campus center` },
              { icon:'🛰️', label:'GPS Accuracy Check', desc:'Rejects GPS accuracy > 60m (bad signal) and < 2m (emulator)' },
              { icon:'⏰', label:'Time Window Lock',    desc:'Check-in blocked outside shift start ±10 min window' },
              { icon:'🔁', label:'Duplicate Guard',     desc:'One check-in per shift per day per staff enforced by database' },
              { icon:'📱', label:'Device Fingerprint',  desc:'Canvas-based fingerprint detects shared-device fraud' },
              { icon:'⚡', label:'Velocity Check',      desc:'Flag if check-in < 30 min after previous check-out' },
            ].map(g => (
              <div key={g.label} style={{ display:'flex', gap:'12px', padding:'10px 0', borderBottom:'1px solid #f1f5f9' }}>
                <span style={{ fontSize:'20px', flexShrink:0 }}>{g.icon}</span>
                <div>
                  <div style={{ fontWeight:'600', fontSize:'13px', color:'#1e293b' }}>{g.label}</div>
                  <div style={{ fontSize:'12px', color:'#64748b' }}>{g.desc}</div>
                </div>
                <span style={{ marginLeft:'auto', color:'#16a34a', fontWeight:'700', fontSize:'12px', flexShrink:0 }}>ACTIVE</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MONTHLY REPORT (ADMIN) ── */}
      {activeTab === 'report' && isAdmin && (
        <>
          <div style={{ display:'flex', gap:'12px', marginBottom:'16px', flexWrap:'wrap' }}>
            <div>
              <label style={S.label}>Month</label>
              <input type="month" value={monthFilter} onChange={e=>setMonthFilter(e.target.value)} style={{ padding:'8px 12px', borderRadius:'8px', border:'1px solid #d1d5db', fontSize:'14px' }} />
            </div>
            <div style={{ minWidth:'220px' }}>
              <label style={S.label}>Staff</label>
              <select value={selectedStaff} onChange={e=>setSelectedStaff(e.target.value)} style={{ ...S.input, backgroundColor:'white' }}>
                <option value="">All Staff</option>
                {allStaff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div style={{ display:'flex', alignItems:'flex-end' }}>
              <button onClick={fetchMonthLogs} style={S.btn('#1e3a5f')}>🔄 Load</button>
            </div>
          </div>

          {/* Summary per staff */}
          {!selectedStaff && (() => {
            const staffMap = {}
            monthLogs.forEach(l => {
              const name = l.staff_profiles?.name || l.staff_id
              if (!staffMap[name]) staffMap[name] = { name, designation:l.staff_profiles?.designation, total:0, present:0, late:0, absent:0, flagged:0 }
              staffMap[name].total++
              if (l.status==='Present')  staffMap[name].present++
              if (l.status==='Late')     staffMap[name].late++
              if (l.status==='Absent')   staffMap[name].absent++
              if (l.status==='Flagged')  staffMap[name].flagged++
            })
            const rows = Object.values(staffMap)
            return rows.length > 0 ? (
              <div style={{ ...S.card, padding:0, overflow:'hidden', marginBottom:'20px' }}>
                <div style={{ padding:'14px 16px', fontWeight:'700', color:'#1e3a5f', borderBottom:'1px solid #f1f5f9' }}>Staff Summary</div>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
                  <thead><tr>{['Staff','Total','Present','Late','Absent','Flagged','Rate'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {rows.map(r => {
                      const rate = r.total > 0 ? Math.round((r.present/r.total)*100) : 0
                      return (
                        <tr key={r.name} style={{ borderBottom:'1px solid #f1f5f9' }}>
                          <td style={td}><div style={{ fontWeight:'600' }}>{r.name}</div><div style={{ fontSize:'11px', color:'#94a3b8' }}>{r.designation}</div></td>
                          <td style={td}>{r.total}</td>
                          <td style={{ ...td, color:'#16a34a', fontWeight:'700' }}>{r.present}</td>
                          <td style={{ ...td, color:'#b45309', fontWeight:'700' }}>{r.late}</td>
                          <td style={{ ...td, color:'#dc2626', fontWeight:'700' }}>{r.absent}</td>
                          <td style={{ ...td, color:'#be185d', fontWeight:'700' }}>{r.flagged}</td>
                          <td style={td}><span style={{ fontWeight:'800', color:rate>=90?'#16a34a':rate>=70?'#b45309':'#dc2626' }}>{rate}%</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : null
          })()}

          {/* Detailed log */}
          <div style={{ ...S.card, padding:0, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
              <thead><tr>{['Date','Staff','Shift','Check-In','Check-Out','Distance','Status','Fraud'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {monthLogs.map(log => (
                  <tr key={log.id} style={{ borderBottom:'1px solid #f1f5f9', background:log.is_fraud_suspected?'#fff7f7':'white' }}>
                    <td style={td}>{fmtDate(log.date)}</td>
                    <td style={td}><div style={{ fontWeight:'600' }}>{log.staff_profiles?.name||'—'}</div></td>
                    <td style={td}><span style={{ fontWeight:'700', color:'#1e3a5f' }}>Shift {log.shift_label}</span></td>
                    <td style={td}>{fmtTime(log.check_in_time)}</td>
                    <td style={td}>{fmtTime(log.check_out_time)}</td>
                    <td style={{ ...td, color:log.is_within_zone?'#16a34a':'#dc2626', fontWeight:'600' }}>{log.distance_from_campus!==null?`${log.distance_from_campus}m`:'—'}</td>
                    <td style={td}><StatusBadge status={log.status} /></td>
                    <td style={td}>
                      {log.fraud_flags?.length>0
                        ? log.fraud_flags.map((f,i)=><FraudBadge key={i} type={f.type} />)
                        : <span style={{ color:'#94a3b8', fontSize:'11px' }}>—</span>}
                    </td>
                  </tr>
                ))}
                {monthLogs.length===0 && <tr><td colSpan="8" style={{ padding:'40px', textAlign:'center', color:'#94a3b8' }}>No records for this period</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── MY HISTORY (STAFF) ── */}
      {activeTab === 'history' && !isAdmin && (
        <div style={{ ...S.card, padding:0, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
            <thead><tr>{['Date','Shift','Check-In','Check-Out','Distance','Status'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {myLogs.map(log => (
                <tr key={log.id} style={{ borderBottom:'1px solid #f1f5f9' }}>
                  <td style={td}>{fmtDate(log.date)}</td>
                  <td style={td}><span style={{ fontWeight:'700', color:'#1e3a5f' }}>Shift {log.shift_label}</span></td>
                  <td style={td}>{fmtTime(log.check_in_time)}</td>
                  <td style={td}>{fmtTime(log.check_out_time)}</td>
                  <td style={{ ...td, color:log.is_within_zone?'#16a34a':'#dc2626', fontWeight:'600' }}>{log.distance_from_campus!==null?`${log.distance_from_campus}m`:'—'}</td>
                  <td style={td}><StatusBadge status={log.status} /></td>
                </tr>
              ))}
              {myLogs.length===0 && <tr><td colSpan="6" style={{ padding:'40px', textAlign:'center', color:'#94a3b8' }}>No attendance records yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}