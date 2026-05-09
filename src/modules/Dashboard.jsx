// ============================================================
//  GNSI PORTAL — Dashboard.jsx
//  Migrated from: modules/dashboard.js
//  Replaces: renderDashboard(), miniStaffRow(), dashSearch()
//  Props / context expected:
//    - currentUser   : { id, name, role }
//    - students      : array
//    - staff         : array
//    - notices       : array
//    - attendance    : object  (key = "YYYY-MM-DD-SNN", value = 'P'|'A')
//    - navigate      : function(page, opts?)
//    - gnsiGetHouseMap : function() => { [studentId]: houseName }
//    - DEPT_COLORS   : object
//    - _isAdminOrArunkumar : function()
//    - _isAdminOrAccounts  : function()
//    - _gnsiRTStatus : { connected, total }   (optional)
//    - _gnsiOnlineDevices : object            (optional)
//    - TENANT        : { name, address }      (optional, window.TENANT)
// ============================================================

import { useState, useMemo, useEffect, useCallback } from 'react';

// ── Constants ────────────────────────────────────────────────
const HM_HOUSES_LIST = [
  'KOMBIREI','LOKTAK','SINGAREI','KANGLA',
  'KOUBRU','SHIROI','SANGAI','SANAREI','NONGIN',
];

const HOUSE_COLORS = {
  KOMBIREI:'#e63946', LOKTAK:'#3b78c9',   SINGAREI:'#f59e0b',
  KANGLA:  '#16a34a', KOUBRU: '#8b5cf6',  SHIROI:  '#0891b2',
  SANGAI:  '#ec4899', SANAREI:'#94a3b8',  NONGIN:  '#2563eb',
};

const HOUSE_ICONS = {
  KOMBIREI:'🔴', LOKTAK:'🔵', SINGAREI:'🟡', KANGLA:'🟢',
  KOUBRU:  '🟣', SHIROI: '🩵', SANGAI:  '🩷', SANAREI:'⚪',
  NONGIN:  '🔷',
};

// ── Tiny helper: initials avatar ─────────────────────────────
function Avatar({ name, size = 30 }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const colors = ['#1433a8','#059669','#d97706','#7c3aed','#0891b2','#e63946'];
  const bg = colors[name.charCodeAt(0) % colors.length];
  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%',
        background: bg, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.38, fontWeight: 700, flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

// ── Dept badge ───────────────────────────────────────────────
function DeptBadge({ dept, deptColors }) {
  const color = (deptColors && deptColors[dept]) || '#7a7468';
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px',
      borderRadius: 20, background: color + '22', color,
      border: `1px solid ${color}44`, whiteSpace: 'nowrap',
    }}>
      {dept}
    </span>
  );
}

// ── Pulse chip ───────────────────────────────────────────────
function PulseChip({ type = 'ok', children }) {
  const map = {
    ok:   { bg: '#f0fdf4', border: '#86efac', dot: '#16a34a', text: '#15803d' },
    warn: { bg: '#fffbeb', border: '#fde68a', dot: '#f59e0b', text: '#92400e' },
    alert:{ bg: '#fef2f2', border: '#fca5a5', dot: '#ef4444', text: '#b91c1c' },
  };
  const c = map[type] || map.ok;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 20,
      background: c.bg, border: `1px solid ${c.border}`,
      fontSize: 11, fontWeight: 600, color: c.text,
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: c.dot, display: 'inline-block', flexShrink: 0,
      }} />
      {children}
    </div>
  );
}

// ── KPI card ─────────────────────────────────────────────────
const KPI_THEMES = {
  blue:   { bg: '#eff6ff', border: '#bfdbfe', val: '#1d4ed8' },
  green:  { bg: '#f0fdf4', border: '#bbf7d0', val: '#15803d' },
  amber:  { bg: '#fffbeb', border: '#fde68a', val: '#b45309' },
  teal:   { bg: '#f0fdfa', border: '#99f6e4', val: '#0f766e' },
  purple: { bg: '#f5f3ff', border: '#ddd6fe', val: '#7c3aed' },
  indigo: { bg: '#eef2ff', border: '#c7d2fe', val: '#4338ca' },
  cyan:   { bg: '#ecfeff', border: '#a5f3fc', val: '#0e7490' },
};

function KpiCard({ theme = 'blue', icon, value, label, sub, onClick }) {
  const t = KPI_THEMES[theme] || KPI_THEMES.blue;
  return (
    <div
      onClick={onClick}
      style={{
        background: t.bg, border: `1.5px solid ${t.border}`,
        borderRadius: 16, padding: '18px 20px', cursor: onClick ? 'pointer' : 'default',
        transition: 'transform .15s, box-shadow .15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,.08)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
    >
      <div style={{ fontSize: 26, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: t.val, fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ── OTP password modal ───────────────────────────────────────
function OtpModal({ staffName, newPwd, onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)',
      zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '"DM Sans", sans-serif',
    }}>
      <div style={{
        background: '#fff', borderRadius: 18, padding: '28px 28px 24px',
        maxWidth: 400, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,.35)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>
          📋 Pending Password to Share
        </div>
        <div style={{ fontSize: 14, color: '#475569', marginBottom: 8 }}>
          Staff member <b>{staffName}</b> logged in via OTP.<br />Their new password is:
        </div>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700,
          color: '#1433a8', background: '#f0f4ff', borderRadius: 12,
          padding: '14px 0', marginBottom: 10, letterSpacing: '.1em',
        }}>
          {newPwd}
        </div>
        <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 18 }}>
          Please share this with them now. You will not see this again.
        </div>
        <button
          onClick={onClose}
          style={{
            width: '100%', padding: 11,
            background: 'linear-gradient(135deg,#059669,#047857)',
            color: '#fff', border: 'none', borderRadius: 10,
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}
        >
          Done — Password Shared
        </button>
      </div>
    </div>
  );
}

// ── Mini staff row ───────────────────────────────────────────
function MiniStaffRow({ s, deptColors }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 16px', borderBottom: '1px solid #e2e8f0',
        background: hovered ? '#f8fafc' : 'transparent', transition: 'background .15s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Avatar name={s.name} size={30} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{s.name}</div>
        <div style={{ fontSize: 11, color: '#64748b' }}>{s.role}</div>
      </div>
      <DeptBadge dept={s.dept} deptColors={deptColors} />
    </div>
  );
}

// ── House leaderboard row ────────────────────────────────────
function LeaderboardRow({ house, pts, rank, maxPts }) {
  const col = HOUSE_COLORS[house] || '#64748b';
  const pct = Math.round((pts / maxPts) * 100);
  const medal = rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 8px', borderRadius: 8,
      background: rank === 0 ? col + '12' : 'transparent',
      border: `1.5px solid ${rank === 0 ? col + '44' : 'transparent'}`,
      marginBottom: 4,
    }}>
      <div style={{ width: 22, textAlign: 'center', fontSize: 14 }}>
        {medal || <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: '#94a3b8' }}>#{rank + 1}</span>}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: col, minWidth: 80, whiteSpace: 'nowrap' }}>
        {HOUSE_ICONS[house]} {house}
      </div>
      <div style={{ flex: 1, height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: col, borderRadius: 4, transition: 'width .6s ease' }} />
      </div>
      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 800, color: col, minWidth: 30, textAlign: 'right' }}>
        {pts}
      </div>
    </div>
  );
}

// ── Sync strip ───────────────────────────────────────────────
function SyncStrip({ rtStatus, onlineDevices, students, staff, navigate }) {
  const rtOk = rtStatus && rtStatus.connected >= rtStatus.total && rtStatus.total > 0;
  const devCount = onlineDevices ? Object.keys(onlineDevices).length : 0;
  const bg    = rtOk ? '#f0fdf4' : '#fffbeb';
  const bdr   = rtOk ? '#86efac' : '#fcd34d';
  const txt   = rtOk ? '#16a34a' : '#d97706';
  const dot   = rtOk ? '#16a34a' : '#f59e0b';
  const msg   = rtOk ? '🟢 Live Sync Active' : '🟡 Connecting…';

  return (
    <div
      onClick={() => navigate('sync')}
      title="Click to open Sync & Backup"
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 16px', marginBottom: 16,
        background: bg, border: `1px solid ${bdr}`, borderRadius: 10,
        fontSize: 12, fontWeight: 600, color: txt,
        cursor: 'pointer', opacity: 0.85, transition: 'opacity .3s',
      }}
    >
      <span style={{
        display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
        background: dot,
        boxShadow: rtOk ? `0 0 5px ${dot}` : 'none',
        animation: rtOk ? 'pulse-dot 1.4s ease-in-out infinite' : 'none',
      }} />
      <span>{msg}</span>
      {devCount > 1 && (
        <span style={{
          marginLeft: 'auto', background: bdr + '44',
          padding: '2px 8px', borderRadius: 12, fontSize: 11,
        }}>
          {devCount} devices
        </span>
      )}
      <span style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.6 }}>
        Students: {students.length} &nbsp; Staff: {staff.length}
      </span>
    </div>
  );
}

// ── HMS Quick-action button ───────────────────────────────────
function HmsBtn({ warn, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
        fontSize: 12, fontWeight: 700, transition: 'all .15s',
        background: warn ? '#fef2f2' : '#f8fafc',
        border: `1.5px solid ${warn ? '#fca5a5' : '#e2e8f0'}`,
        color: warn ? '#dc2626' : '#334155',
      }}
    >
      {children}
    </button>
  );
}

// ════════════════════════════════════════════════════════════
//  MAIN DASHBOARD COMPONENT
// ════════════════════════════════════════════════════════════
export default function Dashboard({
  currentUser,
  students = [],
  staff = [],
  notices = [],
  attendance = {},
  navigate,
  gnsiGetHouseMap,
  DEPT_COLORS = {},
  _isAdminOrArunkumar,
  _isAdminOrAccounts,
  _gnsiRTStatus,
  _gnsiOnlineDevices,
  TENANT,
}) {
  // ── OTP modal state ────────────────────────────────────────
  const [otpModal, setOtpModal] = useState(null);

  // Check localStorage for pending OTP notification (runs once on mount)
  useEffect(() => {
    if (!currentUser || currentUser.id !== 1) return;
    try {
      const raw = localStorage.getItem('_gnsi_otp_new_pwd');
      if (!raw) return;
      const n = JSON.parse(raw);
      localStorage.removeItem('_gnsi_otp_new_pwd'); // show only once
      if (n?.staffName && n?.newPwd && Date.now() - new Date(n.ts).getTime() < 300000) {
        setTimeout(() => setOtpModal(n), 1200);
      }
    } catch (_) {}
  }, [currentUser]);

  // ── Date / time ────────────────────────────────────────────
  const today   = useMemo(() => new Date().toISOString().split('T')[0], []);
  const dayName = useMemo(() => ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()], []);
  const dateStr = useMemo(() => new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }), []);
  const greeting = new Date().getHours() < 12 ? 'Morning' : 'Afternoon';

  // ── Derived stats ──────────────────────────────────────────
  const paid        = useMemo(() => students.filter(s => s.fees === 'Paid').length,    [students]);
  const pending     = useMemo(() => students.filter(s => s.fees === 'Pending').length, [students]);
  const hostelCount = useMemo(() => students.filter(s => s.hostel === 'Yes').length,   [students]);

  const deptCounts = useMemo(() => {
    const dc = {};
    staff.forEach(s => { dc[s.dept] = (dc[s.dept] || 0) + 1; });
    return dc;
  }, [staff]);

  // ── Attendance ─────────────────────────────────────────────
  const { attP, attA } = useMemo(() => {
    const keys = Object.keys(attendance).filter(k => k.startsWith(today + '-S'));
    return {
      attP: keys.filter(k => attendance[k] === 'P').length,
      attA: keys.filter(k => attendance[k] === 'A').length,
    };
  }, [attendance, today]);

  // ── HMS live data (localStorage) ──────────────────────────
  const lsGet = useCallback((key, fallback = '[]') => {
    try { return JSON.parse(localStorage.getItem(key) || fallback); }
    catch (_) { return JSON.parse(fallback); }
  }, []);

  const openBeh   = useMemo(() => lsGet('gnsi_hmsa_behaviour').filter(r => r.status === 'Open').length, [lsGet]);
  const hlMon     = useMemo(() => lsGet('gnsi_hmsa_health').filter(r => r.status === 'Monitoring').length, [lsGet]);
  const actCount  = useMemo(() => lsGet('gnsi_hmsa_activities').filter(r => r.status === 'Upcoming' || r.status === 'Ongoing').length, [lsGet]);
  const compCount = useMemo(() => lsGet('gnsi_hmsa_competitions').filter(r => r.status === 'Ongoing' || r.status === 'Upcoming').length, [lsGet]);
  const rcToday   = useMemo(() => lsGet('gnsi_hmsa_rollcall').filter(r => r.date === today).length, [lsGet, today]);

  // ── House map & points ─────────────────────────────────────
  const studentHouseMap = useMemo(() => gnsiGetHouseMap ? gnsiGetHouseMap() : {}, [gnsiGetHouseMap]);
  const assignedCount   = Object.keys(studentHouseMap).length;
  const unassignedCount = useMemo(() => students.filter(s => s.hostel === 'Yes' && !studentHouseMap[s.id]).length, [students, studentHouseMap]);

  const housePoints = useMemo(() => {
    const pts = {};
    HM_HOUSES_LIST.forEach(h => { pts[h] = 0; });
    // Direct points log
    lsGet('gnsi_hmsa_house_points').forEach(r => {
      if (pts[r.house] !== undefined) pts[r.house] += (r.pts || 0);
    });
    // Competition results
    lsGet('gnsi_hmsa_competitions').forEach(c => {
      if (c.status !== 'Completed' || !c.positions) return;
      Object.keys(c.positions).forEach(hid => {
        const pos = c.positions[hid];
        const p = pos === '1st' ? (c.pts1 || 10) : pos === '2nd' ? (c.pts2 || 7) : pos === '3rd' ? (c.pts3 || 5) : pos === 'Participated' ? 1 : 0;
        if (p && pts[hid] !== undefined) pts[hid] += p;
      });
    });
    return pts;
  }, [lsGet]);

  const sortedHouses  = useMemo(() => HM_HOUSES_LIST.slice().sort((a, b) => (housePoints[b] || 0) - (housePoints[a] || 0)), [housePoints]);
  const maxPtsGlobal  = useMemo(() => Math.max(...sortedHouses.map(h => housePoints[h] || 0)) || 1, [sortedHouses, housePoints]);

  // ── Induction timetable (admin only) ──────────────────────
  const ittData = useMemo(() => {
    if (!currentUser || currentUser.role !== 'admin') return null;
    const d = lsGet('gnsi_course_induction_tt', 'null');
    return d?.timetables ? d : { timetables: [] };
  }, [currentUser, lsGet]);

  // ── Staff search ───────────────────────────────────────────
  const [searchQ, setSearchQ] = useState('');
  const visibleStaff = useMemo(() => {
    if (!searchQ) return staff.slice(0, 6);
    return staff.filter(s => s.name.toLowerCase().includes(searchQ.toLowerCase())).slice(0, 10);
  }, [searchQ, staff]);

  // ── Tenant info ────────────────────────────────────────────
  const tenantLine = TENANT
    ? `${TENANT.name.toUpperCase()} · ${TENANT.address}`
    : 'GUIDANCE NAVODAYA & SAINIK INSTITUTE · Khangabok Sorok Wangma, Thoubal, Manipur';

  const userName = currentUser?.name || '';

  // ── Priority colour helper (notices) ──────────────────────
  const priorityColor = (p) => p === 'High' ? '#ef4444' : p === 'Medium' ? '#f59e0b' : '#22c55e';

  // ════════════════════════════════════════════════════════════
  return (
    <>
      {/* OTP Modal */}
      {otpModal && (
        <OtpModal
          staffName={otpModal.staffName}
          newPwd={otpModal.newPwd}
          onClose={() => setOtpModal(null)}
        />
      )}

      {/* Sync strip */}
      <SyncStrip
        rtStatus={_gnsiRTStatus}
        onlineDevices={_gnsiOnlineDevices}
        students={students}
        staff={staff}
        navigate={navigate}
      />

      {/* ── Hero ─────────────────────────────────────────── */}
      <div className="db-hero" style={{
        background: 'linear-gradient(135deg,#1433a8,#1e40af)',
        borderRadius: 18, padding: '24px 28px 20px',
        marginBottom: 20, color: '#fff',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.7, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>
              {tenantLine}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>
              Good {greeting} <span>👋</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 2 }}>{userName}</div>
            <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>{dayName}, {dateStr}</div>
          </div>
          <div style={{
            background: 'rgba(255,255,255,.12)', borderRadius: 14,
            padding: '14px 20px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 32 }}>🏫</div>
            <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4 }}>GNSI</div>
            <div style={{ fontSize: 11, opacity: 0.75 }}>Management Portal</div>
          </div>
        </div>

        {/* Pulse chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
          {_isAdminOrArunkumar?.() && (
            <PulseChip type={attA > 2 ? 'alert' : 'ok'}>{attP} staff present today</PulseChip>
          )}
          {openBeh > 0 && <PulseChip type="warn">{openBeh} behaviour cases open</PulseChip>}
          {hlMon > 0  && <PulseChip type="warn">{hlMon} health monitoring</PulseChip>}
          {pending > 0 && <PulseChip type="alert">{pending} fees pending</PulseChip>}
          <PulseChip type="ok">{rcToday} roll calls today</PulseChip>
        </div>
      </div>

      {/* ── KPI Grid ─────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginBottom: 20 }}>
        <KpiCard theme="blue"   icon="👥" value={staff.length}    label="Total Staff"      sub="All departments"           onClick={() => navigate('staff')} />
        <KpiCard theme="green"  icon="🎓" value={students.length} label="Students"         sub="Currently enrolled"        onClick={() => navigate('students')} />
        {_isAdminOrAccounts?.() && (
          <KpiCard
            theme={pending > 0 ? 'amber' : 'teal'}
            icon="💰" value={paid}
            label="Fees Collected"
            sub={pending > 0 ? `⚠ ${pending} pending` : 'All clear ✓'}
            onClick={() => navigate('fees')}
          />
        )}
        <KpiCard theme="purple" icon="📌" value={notices.length}  label="Active Notices"   sub="On notice board"           onClick={() => navigate('notices')} />
        <KpiCard theme="indigo" icon="🏠" value={hostelCount}     label="Hostel Students"
          sub={`${assignedCount} house-assigned${unassignedCount > 0 ? ` · ⚠ ${unassignedCount} unassigned` : ''}`}
          onClick={() => navigate('housemaster')}
        />
        <KpiCard theme="cyan"   icon="✅" value={attP}            label="Present Today"    sub={attA > 0 ? `⚠ ${attA} absent` : 'Full house'} onClick={() => navigate('attendance')} />
      </div>

      {/* ── Quick Actions ────────────────────────────────── */}
      <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 16, padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#334155', marginBottom: 12 }}>⚡ Quick Actions</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {[
            { icon: '📋', label: 'Take Attendance', page: 'attendance', color: '#1d4ed8' },
            { icon: '📝', label: 'Lesson Plans',    page: 'faculty',    color: '#15803d' },
            { icon: '📣', label: 'Roll Call',       page: 'housemaster',color: '#7c3aed', tab: 'rollcall' },
            { icon: '📌', label: 'Add Notice',      page: 'notices',    color: '#b45309' },
            { icon: '📊', label: 'Reports',         page: 'reports',    color: '#0f766e' },
            { icon: '📅', label: 'Timetable',       page: 'timetable',  color: '#475569' },
            { icon: '🌉', label: 'Lesson Bridge',   page: 'lessonbridge', color: '#15803d' },
            { icon: '🌐', label: 'GNSI Social',     page: 'gnsi_social',color: '#4338ca' },
            ...(_isAdminOrAccounts?.() ? [{ icon: '💳', label: 'Fee Records', page: 'fees', color: '#dc2626' }] : []),
            ...(currentUser?.role === 'admin' ? [{ icon: '🛡', label: 'Admin Centre', page: 'admincentre', color: '#4338ca' }] : []),
          ].map(({ icon, label, page, color, tab }) => (
            <button
              key={label}
              onClick={() => { navigate(page); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
                background: color + '12', border: `1.5px solid ${color}33`,
                fontSize: 12, fontWeight: 700, color,
                transition: 'all .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = color + '22'; }}
              onMouseLeave={e => { e.currentTarget.style.background = color + '12'; }}
            >
              <span>{icon}</span><span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Induction Timetable (admin only) ─────────────── */}
      {ittData && currentUser?.role === 'admin' && (
        <InductionTTWidget ittData={ittData} navigate={navigate} />
      )}

      {/* ── 2-col: Dept bars + Recent Notices ───────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Dept bar chart */}
        <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 16, padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#334155' }}>Staff by Department</span>
            <span style={{ fontSize: 10, background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>
              {Object.keys(deptCounts).length} depts
            </span>
          </div>
          {Object.entries(deptCounts).sort((a, b) => b[1] - a[1]).map(([dept, count]) => {
            const col = DEPT_COLORS[dept] || '#7a7468';
            const pct = Math.round((count / staff.length) * 100);
            return (
              <div key={dept} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: col, flexShrink: 0 }} />
                <div style={{ width: 100, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dept}</div>
                <div style={{ flex: 1, height: 7, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: col, borderRadius: 4 }} />
                </div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 800, color: col, minWidth: 16, textAlign: 'right' }}>{count}</div>
              </div>
            );
          })}
        </div>

        {/* Recent notices */}
        <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 16, padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#334155' }}>Recent Notices</span>
            <button onClick={() => navigate('notices')} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontWeight: 700 }}>View All</button>
          </div>
          {notices.length === 0 && (
            <div style={{ padding: '30px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No notices yet.</div>
          )}
          {notices.slice(0, 5).map((n, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: priorityColor(n.priority), marginTop: 4, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{n.title}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{n.date} · {n.priority}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── House Master Control System ──────────────────── */}
      <div style={{ background: 'linear-gradient(135deg,#f5f3ff,#ede9fe)', border: '1.5px solid #ddd6fe', borderRadius: 18, padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 4, height: 24, background: '#7c3aed', borderRadius: 2 }} />
          <div style={{ fontSize: 15, fontWeight: 800, color: '#4c1d95' }}>🏠 House Master Control System</div>
          <span style={{ fontSize: 10, background: '#7c3aed', color: '#fff', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>BOARDING SECTION</span>
        </div>

        {/* HMS KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 10, marginBottom: 16 }}>
          {[
            { icon: '🏠', val: hostelCount,  lbl: 'Hostel Students', sub: `${assignedCount} assigned${unassignedCount > 0 ? ` · ⚠ ${unassignedCount} unassigned` : ''}`, col: '#7c3aed', bg: '#f5f3ff', bdr: '#c4b5fd', page: 'housemaster' },
            { icon: '📋', val: openBeh,      lbl: 'Behaviour Cases',  sub: openBeh > 0 ? '⚠ Needs attention' : '✓ All clear',  col: openBeh > 0 ? '#dc2626' : '#16a34a', bg: openBeh > 0 ? '#fef2f2' : '#f0fdf4', bdr: openBeh > 0 ? '#fca5a5' : '#86efac', page: 'housemaster', tab: 'behaviour' },
            { icon: '🏥', val: hlMon,        lbl: 'Health Watch',     sub: hlMon > 0 ? 'Under monitoring' : '✓ All healthy', col: hlMon > 0 ? '#d97706' : '#16a34a', bg: hlMon > 0 ? '#fffbeb' : '#f0fdf4', bdr: hlMon > 0 ? '#fde68a' : '#86efac', page: 'housemaster', tab: 'health' },
            { icon: '🏆', val: actCount,     lbl: 'Activities',       sub: `${compCount} competition${compCount !== 1 ? 's' : ''}`, col: '#2563eb', bg: '#eff6ff', bdr: '#93c5fd', page: 'housemaster', tab: 'activities' },
            { icon: '📣', val: rcToday,      lbl: 'Roll Calls',       sub: rcToday === 0 ? 'None yet today' : 'Sessions recorded', col: '#16a34a', bg: '#f0fdf4', bdr: '#86efac', page: 'housemaster', tab: 'rollcall' },
          ].map(({ icon, val, lbl, sub, col, bg, bdr, page, tab }) => (
            <div
              key={lbl}
              onClick={() => navigate(page)}
              style={{ background: bg, border: `1.5px solid ${bdr}`, borderRadius: 12, padding: '12px 14px', cursor: 'pointer', transition: 'transform .15s' }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseLeave={e => e.currentTarget.style.transform = ''}
            >
              <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: col, fontFamily: "'JetBrains Mono',monospace" }}>{val}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: col }}>{lbl}</div>
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* House leaderboard + House grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          {/* Leaderboard */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ede9fe', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #ede9fe' }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#7c3aed' }}>⭐ House Leaderboard</span>
              <button onClick={() => navigate('housemaster')} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid #c4b5fd', background: '#f5f3ff', color: '#7c3aed', cursor: 'pointer', fontWeight: 700 }}>
                Full Tally →
              </button>
            </div>
            <div style={{ padding: '12px 14px' }}>
              {sortedHouses.map((h, i) => (
                <LeaderboardRow key={h} house={h} pts={housePoints[h] || 0} rank={i} maxPts={maxPtsGlobal} />
              ))}
            </div>
          </div>

          {/* House tiles */}
          <div style={{ background: 'linear-gradient(135deg,#f5f3ff,#ede9fe)', borderRadius: 14, padding: '12px 14px', border: '1.5px solid #c4b5fd' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', marginBottom: 10 }}>🏠 All Houses — Hostel Strength</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
              {HM_HOUSES_LIST.map(h => {
                const count = Object.keys(studentHouseMap).filter(sid => studentHouseMap[sid] === h).length;
                const col   = HOUSE_COLORS[h] || '#64748b';
                const isLdr = h === sortedHouses[0] && (housePoints[h] || 0) > 0;
                return (
                  <div
                    key={h}
                    onClick={() => navigate('housemaster')}
                    style={{
                      background: col + '12', border: `1.5px solid ${isLdr ? col + '77' : col + '33'}`,
                      borderRadius: 10, padding: '8px 6px', textAlign: 'center', cursor: 'pointer',
                      position: 'relative',
                    }}
                  >
                    {isLdr && <div style={{ position: 'absolute', top: -6, right: -4, fontSize: 12 }}>🏆</div>}
                    <div style={{ fontSize: 16 }}>{HOUSE_ICONS[h]}</div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: col, marginTop: 2 }}>{h}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#334155' }}>{count}</div>
                    <div style={{ fontSize: 9, color: '#94a3b8' }}>student{count !== 1 ? 's' : ''}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* HMS action buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <HmsBtn onClick={() => navigate('housemaster')}>🏠 House Overview</HmsBtn>
          <HmsBtn onClick={() => navigate('housemaster')}>📣 Roll Call</HmsBtn>
          <HmsBtn warn={openBeh > 0} onClick={() => navigate('housemaster')}>📋 Behaviour{openBeh > 0 ? ` (${openBeh})` : ''}</HmsBtn>
          <HmsBtn warn={hlMon > 0}  onClick={() => navigate('housemaster')}>🏥 Health{hlMon > 0 ? ` (${hlMon})` : ''}</HmsBtn>
          <HmsBtn onClick={() => navigate('housemaster')}>🏆 Activities</HmsBtn>
        </div>
      </div>

      {/* ── Quick Staff Lookup ───────────────────────────── */}
      <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#334155' }}>🔍 Quick Staff Lookup</span>
          <span style={{ fontSize: 10, background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>
            {staff.length} staff
          </span>
        </div>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '8px 12px' }}>
            <span>🔍</span>
            <input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder="Search staff by name…"
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, flex: 1 }}
            />
          </div>
        </div>
        <div style={{ maxHeight: 240, overflowY: 'auto' }}>
          {visibleStaff.length > 0
            ? visibleStaff.map((s, i) => <MiniStaffRow key={s.id || i} s={s} deptColors={DEPT_COLORS} />)
            : searchQ
              ? <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>No results</div>
              : null
          }
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  Induction Timetable sub-component (admin only)
// ════════════════════════════════════════════════════════════
function InductionTTWidget({ ittData, navigate }) {
  const tabs = ittData.timetables || [];
  const [activeTab, setActiveTab] = useState(0);
  const tt = tabs[activeTab];

  if (tabs.length === 0) {
    return (
      <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 16, padding: '20px 24px', marginBottom: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
        No timetable data yet.{' '}
        <span onClick={() => navigate('course_induction_tt')} style={{ color: '#1433a8', fontWeight: 700, cursor: 'pointer' }}>
          Open Induction TT →
        </span>
      </div>
    );
  }

  return (
    <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 16, marginBottom: 20, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #f1f5f9', background: 'rgba(20,51,168,.03)' }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#334155' }}>📋 Course Induction Timetable</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 10, background: '#1433a8', color: '#fff', borderRadius: 20, padding: '2px 9px', fontWeight: 700 }}>🔒 Admin</span>
          <button onClick={() => navigate('course_induction_tt')} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #c7d2fe', background: '#e8ecff', color: '#1433a8', cursor: 'pointer', fontWeight: 700 }}>
            Manage →
          </button>
        </div>
      </div>

      {tabs.length > 1 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '10px 16px', borderBottom: '1px solid #f1f5f9' }}>
          {tabs.map((t, i) => (
            <button
              key={i}
              onClick={() => setActiveTab(i)}
              style={{
                padding: '5px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0',
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
                background: i === activeTab ? '#1433a8' : '#f8fafc',
                color: i === activeTab ? '#fff' : '#64748b',
                transition: 'all .15s',
              }}
            >
              {i + 1}. {t.title.length > 36 ? t.title.substring(0, 34) + '…' : t.title}
            </button>
          ))}
        </div>
      )}

      {tt && (
        <div style={{ overflowX: 'auto', padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ background: '#1433a8', color: '#fff', padding: '7px 10px', whiteSpace: 'nowrap', textAlign: 'left' }}>Time</th>
                {tt.batches.map((b, i) => (
                  <th key={i} style={{ background: '#1433a8', color: '#fff', padding: '7px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tt.slots.map((s, si) => {
                const isSpecial = /BREAK|DINNER|OFF|LUNCH/i.test(s.cells.join(' '));
                return (
                  <tr key={si}>
                    <td style={{ padding: '7px 10px', border: '1px solid #e2e8f0', fontWeight: 700, fontSize: 10, color: '#1433a8', background: '#e8ecff', whiteSpace: 'nowrap' }}>{s.time}</td>
                    {s.cells.map((c, ci) => (
                      <td key={ci} style={{ padding: '7px 8px', border: '1px solid #e2e8f0', textAlign: 'center', background: isSpecial ? '#fef9c3' : '', color: isSpecial ? '#78350f' : '#334155', fontWeight: isSpecial ? 700 : 400 }}>
                        {c || ''}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
