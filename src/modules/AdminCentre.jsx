// ============================================================
//  GNSI PORTAL — AdminCentre.jsx
//  Migrated from: modules/admin.js
//  Replaces: renderAdminCentre(), renderLeaderboard(),
//            lbExportCSV(), lbStreak(), computeBadges()
//
//  Props expected:
//    - currentUser        : { id, name, role }
//    - students           : array
//    - staff              : array
//    - notices            : array
//    - attendance         : object  { "YYYY-MM-DD-S-ID": "P"|"A"|"L"|"ED" }
//    - navigate           : function(page)
//    - gnsiGetHouseMap    : function() => { [studentId]: houseName }
//    - getFacultyStaff    : function() => array
//    - loadLessonPlans    : function() => object
//    - gnsiGetReports     : function() => array
//    - gnsiMonitorAlertCount : function() => number
//    - renderFeeMonitorPanel : function(mini) => JSX (optional)
//    - DEPT_COLORS        : object
// ============================================================

import { useState, useMemo, useEffect, useCallback } from 'react';

// ── Helpers ──────────────────────────────────────────────────
function lsGet(key, fallback = '[]') {
  try { return JSON.parse(localStorage.getItem(key) || fallback); }
  catch (_) { return JSON.parse(fallback); }
}

function Avatar({ name, size = 36 }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const colors = ['#1433a8','#059669','#d97706','#7c3aed','#0891b2','#e63946'];
  const bg = colors[name.charCodeAt(0) % colors.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: bg,
      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 700, flexShrink: 0,
    }}>{initials}</div>
  );
}

const SEV_COLOR = { high: '#dc2626', med: '#f59e0b', low: '#3b78c9' };
const SEV_BG    = { high: '#fef2f2', med: '#fffbeb', low: '#eff6ff' };
const SEV_BDR   = { high: '#fca5a5', med: '#fde68a', low: '#93c5fd' };

// ── KPI strip card ───────────────────────────────────────────
function KpiCard({ icon, label, value, sub, col }) {
  return (
    <div style={{
      background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 14,
      padding: '14px 16px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: -10, right: -10, fontSize: 36, opacity: 0.07 }}>{icon}</div>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.1em', fontFamily: "'JetBrains Mono',monospace", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: col, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 4 }}>{sub}</div>
    </div>
  );
}

// ── Issue card ───────────────────────────────────────────────
function IssueCard({ iss }) {
  return (
    <div style={{
      background: SEV_BG[iss.sev], border: `1.5px solid ${SEV_BDR[iss.sev]}`,
      borderRadius: 12, padding: '14px 18px', marginBottom: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 18 }}>{iss.icon}</span>
        <span style={{ fontWeight: 700, fontSize: 13, flex: 1 }}>{iss.title}</span>
        <span style={{
          fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 20,
          background: SEV_COLOR[iss.sev], color: '#fff',
        }}>{iss.sev.toUpperCase()}</span>
      </div>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>{iss.detail}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: SEV_COLOR[iss.sev] }}>💡 {iss.fix}</div>
    </div>
  );
}

// ── Activity feed row ────────────────────────────────────────
function FeedRow({ a }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 20px', borderBottom: '1px solid #f1f5f9', background: hov ? '#f8fafc' : 'transparent', transition: 'background .15s' }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
    >
      <div style={{ width: 40, height: 40, borderRadius: 12, background: a.color + '18', border: `1.5px solid ${a.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{a.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>{a.title}</div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{a.detail}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 5 }}>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 10, background: a.color + '18', color: a.color }}>{a.section}</span>
          <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: "'JetBrains Mono',monospace" }}>{a.time}</span>
        </div>
      </div>
    </div>
  );
}

// ── Attendance bar mini chart ─────────────────────────────────
function AttendanceTrend({ attendance, staff, today }) {
  const bars = useMemo(() => {
    const attKeys = Object.keys(attendance);
    const result = [];
    for (let di = 6; di >= 0; di--) {
      const dd = new Date(); dd.setDate(dd.getDate() - di);
      const ds = dd.toISOString().split('T')[0];
      if (dd.getDay() === 0) { result.push({ date: ds, pct: null, isSun: true }); continue; }
      const k = attKeys.filter(k => k.startsWith(ds + '-S'));
      const p = k.filter(k => ['P','L','ED'].includes(attendance[k])).length;
      result.push({ date: ds, pct: k.length > 0 ? Math.round(p / staff.length * 100) : null });
    }
    return result;
  }, [attendance, staff, today]);

  return (
    <div style={{ padding: 20, display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'flex-end' }}>
      {bars.map((d, i) => {
        const lbl = new Date(d.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' });
        const isT = d.date === today;
        if (d.isSun) return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, opacity: 0.4 }}>
            <div style={{ height: 80, width: 32, background: '#f1f5f9', borderRadius: 6 }} />
            <div style={{ fontSize: 10, color: '#94a3b8' }}>Sun</div>
          </div>
        );
        const col = d.pct === null ? '#f1f5f9' : d.pct >= 80 ? '#16a34a' : d.pct >= 60 ? '#f59e0b' : '#dc2626';
        const h = d.pct === null ? 4 : Math.max(6, Math.round(d.pct * 0.8));
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: d.pct === null ? '#94a3b8' : col }}>{d.pct === null ? '—' : d.pct + '%'}</div>
            <div style={{ width: 32, height: 80, background: '#f1f5f9', borderRadius: 6, display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
              <div style={{ width: '100%', height: h, background: col, borderRadius: 6 }} />
            </div>
            <div style={{ fontSize: 10, color: isT ? '#1433a8' : '#94a3b8', fontWeight: isT ? 800 : 500 }}>{lbl}{isT ? ' ★' : ''}</div>
          </div>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
//  LEADERBOARD LOGIC  (migrated from renderLeaderboard)
// ────────────────────────────────────────────────────────────
const LEADERBOARD_EXCLUDED_IDS = [1, 2];

const LB_SCORING_DEFS = {
  overall: {
    title: 'Overall Performance',
    desc: 'Combines attendance, lesson plans, duty, reports and punctuality',
    criteria: [
      { icon: '✅', label: 'Attendance', max: 40, col: '#16a34a', desc: '40pts for 100% attendance, scaled down' },
      { icon: '📝', label: 'Lesson Plans', max: 25, col: '#1433a8', desc: 'Plan entry compliance over 30 days' },
      { icon: '⏱', label: 'Duty', max: 15, col: '#8b5cf6', desc: 'Duty hours logged this month' },
      { icon: '📄', label: 'Reports', max: 15, col: '#3b82f6', desc: 'Reports filed this month' },
      { icon: '🎯', label: 'Punctuality', max: 10, col: '#0ea5e9', desc: 'On-time arrival ratio' },
    ],
  },
  teachers: {
    title: 'Teacher Performance',
    desc: 'Weighted toward lesson plan compliance and quality',
    criteria: [
      { icon: '✅', label: 'Attendance', max: 30, col: '#16a34a', desc: 'Scaled attendance score' },
      { icon: '📝', label: 'Plan Compliance', max: 40, col: '#1433a8', desc: 'Lesson plan entry rate' },
      { icon: '🎓', label: 'Plan Quality', max: 20, col: '#7c3aed', desc: 'Average plan score' },
      { icon: '🎯', label: 'Punctuality', max: 10, col: '#0ea5e9', desc: 'On-time ratio' },
    ],
  },
  housemaster: {
    title: 'House Staff Performance',
    desc: 'Weighted toward duty and house management',
    criteria: [
      { icon: '✅', label: 'Attendance', max: 30, col: '#16a34a', desc: 'Scaled attendance score' },
      { icon: '⏱', label: 'Duty', max: 35, col: '#8b5cf6', desc: 'Duty shifts logged' },
      { icon: '📄', label: 'Reports', max: 25, col: '#3b82f6', desc: 'Reports filed' },
      { icon: '🎯', label: 'Punctuality', max: 10, col: '#0ea5e9', desc: 'On-time ratio' },
    ],
  },
  admin: {
    title: 'Admin Staff Performance',
    desc: 'Weighted toward reports and attendance',
    criteria: [
      { icon: '✅', label: 'Attendance', max: 35, col: '#16a34a', desc: 'Attendance score' },
      { icon: '📄', label: 'Reports', max: 35, col: '#3b82f6', desc: 'Reports filed' },
      { icon: '⏱', label: 'Duty', max: 20, col: '#8b5cf6', desc: 'Duty shifts' },
      { icon: '🎯', label: 'Punctuality', max: 10, col: '#0ea5e9', desc: 'On-time ratio' },
    ],
  },
  support: {
    title: 'Support Staff Performance',
    desc: 'Attendance and duty focused',
    criteria: [
      { icon: '✅', label: 'Attendance', max: 45, col: '#16a34a', desc: 'Attendance score' },
      { icon: '⏱', label: 'Duty', max: 40, col: '#8b5cf6', desc: 'Duty shifts' },
      { icon: '🎯', label: 'Punctuality', max: 15, col: '#0ea5e9', desc: 'On-time ratio' },
    ],
  },
};

function lbStreak(s, attendance) {
  let streak = 0;
  for (let i = 0; i < 90; i++) {
    const dd = new Date(); dd.setDate(dd.getDate() - i);
    if (dd.getDay() === 0) continue;
    const ds = dd.toISOString().split('T')[0];
    const v = attendance[ds + '-S-' + s.id];
    if (v === 'P' || v === 'L' || v === 'ED') { streak++; }
    else { if (i > 0 && streak === 0) continue; break; }
  }
  return streak;
}

function lbMetrics(s, attendance, allPlans, dutyData) {
  const attKeys = Object.keys(attendance).filter(k => k.includes('-S-' + s.id));
  const present = attKeys.filter(k => ['P','L','ED'].includes(attendance[k])).length;
  const late    = attKeys.filter(k => attendance[k] === 'L').length;
  const attPct  = attKeys.length > 0 ? Math.round(present / attKeys.length * 100) : 0;
  const punctPct= attKeys.length > 0 ? Math.round((present - late) / attKeys.length * 100) : 0;

  // Lesson plans (30 days)
  let lpWorked = 0, lpEntered = 0, lpScores = [];
  for (let di = 0; di < 30; di++) {
    const dd = new Date(); dd.setDate(dd.getDate() - di);
    if (dd.getDay() === 0) continue;
    const ds = dd.toISOString().split('T')[0];
    lpWorked++;
    if (allPlans[s.id]?.[ds]?.length) {
      lpEntered++;
      allPlans[s.id][ds].forEach(p => { if (p.score) lpScores.push(p.score); });
    }
  }
  const lpCompPct  = lpWorked > 0 ? Math.round(lpEntered / lpWorked * 100) : 0;
  const lpAvgScore = lpScores.length > 0 ? Math.round(lpScores.reduce((a, b) => a + b, 0) / lpScores.length) : 0;

  const dutyEntries = (dutyData?.entries || []).filter(e => e.staffId === s.id);
  const reports = lsGet('gnsi_report_collection').filter(r => r.staffId === s.id);

  return { attPct, punctPct, present, lpCompPct, lpAvgScore, dutyCount: dutyEntries.length, reports };
}

function scoreOverall(s, m) {
  const att  = Math.round(m.attPct * 0.4);
  const lp   = Math.round(m.lpCompPct * 0.25);
  const duty = Math.min(15, Math.round(m.dutyCount * 3));
  const rep  = Math.min(15, Math.round(m.reports.length * 3));
  const punc = Math.round(m.punctPct * 0.1);
  const score = Math.min(100, att + lp + duty + rep + punc);
  return { score, breakdown: { Attendance: att, 'Lesson Plans': lp, Duty: duty, Reports: rep, Punctuality: punc } };
}

function scoreTeachers(s, m) {
  const att  = Math.round(m.attPct * 0.3);
  const lp   = Math.round(m.lpCompPct * 0.4);
  const qual = Math.round(m.lpAvgScore * 0.2);
  const punc = Math.round(m.punctPct * 0.1);
  return { score: Math.min(100, att + lp + qual + punc), breakdown: { Attendance: att, 'Plan Compliance': lp, 'Plan Quality': qual, Punctuality: punc } };
}

function scoreHousemaster(s, m) {
  const att  = Math.round(m.attPct * 0.3);
  const duty = Math.min(35, Math.round(m.dutyCount * 7));
  const rep  = Math.min(25, Math.round(m.reports.length * 5));
  const punc = Math.round(m.punctPct * 0.1);
  return { score: Math.min(100, att + duty + rep + punc), breakdown: { Attendance: att, Duty: duty, Reports: rep, Punctuality: punc } };
}

function scoreAdmin(s, m) {
  const att  = Math.round(m.attPct * 0.35);
  const rep  = Math.min(35, Math.round(m.reports.length * 7));
  const duty = Math.min(20, Math.round(m.dutyCount * 4));
  const punc = Math.round(m.punctPct * 0.1);
  return { score: Math.min(100, att + rep + duty + punc), breakdown: { Attendance: att, Reports: rep, Duty: duty, Punctuality: punc } };
}

function scoreSupport(s, m) {
  const att  = Math.round(m.attPct * 0.45);
  const duty = Math.min(40, Math.round(m.dutyCount * 8));
  const punc = Math.round(m.punctPct * 0.15);
  return { score: Math.min(100, att + duty + punc), breakdown: { Attendance: att, Duty: duty, Punctuality: punc } };
}

function computeBadges(m, score, streak, tab) {
  const b = [];
  if (m.attPct >= 100) b.push({ ic: '⭐', lbl: 'Perfect Att.', ttl: '100% Attendance', col: '#f59e0b', bg: '#fef3dc' });
  else if (m.attPct >= 95) b.push({ ic: '✨', lbl: 'Star Att.', ttl: '95%+ Attendance', col: '#d97706', bg: '#fef9c3' });
  if (streak >= 14) b.push({ ic: '🔥', lbl: streak + 'd Streak', ttl: streak + '-Day Streak!', col: '#dc2626', bg: '#fee2e2' });
  else if (streak >= 7) b.push({ ic: '🔥', lbl: streak + 'd', ttl: streak + '-Day Streak', col: '#f97316', bg: '#fff7ed' });
  if (['teachers','overall'].includes(tab)) {
    if (m.lpCompPct >= 95) b.push({ ic: '📝', lbl: 'Plan Star', ttl: '95%+ Plan Compliance', col: '#1433a8', bg: '#e0e8f9' });
    if (m.lpAvgScore >= 85) b.push({ ic: '🎓', lbl: 'Quality', ttl: 'Plan Avg Score 85+', col: '#7c3aed', bg: '#f5f3ff' });
  }
  if (['housemaster','support','overall'].includes(tab)) {
    if (m.dutyCount >= 5) b.push({ ic: '⚡', lbl: 'Duty Hero', ttl: '5+ Duty Shifts', col: '#8b5cf6', bg: '#f5f3ff' });
  }
  if (['admin','overall'].includes(tab)) {
    if (m.reports.length >= 5) b.push({ ic: '📄', lbl: 'Reporter', ttl: '5+ Reports Filed', col: '#3b82f6', bg: '#eff6ff' });
  }
  if (m.punctPct >= 98 && m.present > 5) b.push({ ic: '🎯', lbl: 'Punctual', ttl: '98%+ On-Time', col: '#0ea5e9', bg: '#f0f9ff' });
  if (score >= 90) b.push({ ic: '🏆', lbl: 'Elite', ttl: 'Score 90+', col: '#c9870a', bg: '#fef9c3' });
  else if (score >= 80) b.push({ ic: '🎖', lbl: 'Excellent', ttl: 'Score 80+', col: '#16a34a', bg: '#f0fdf4' });
  return b;
}

const TAB_FILTERS = {
  overall:     () => true,
  teachers:    s => s.role === 'teacher',
  housemaster: s => s.role === 'housemaster' || s.role === 'hostel',
  admin:       s => ['admin','manager','accounts'].includes(s.role),
  support:     s => ['it','staff'].includes(s.role),
};

// ── Leaderboard score ring ────────────────────────────────────
function ScoreRing({ score, size = 80 }) {
  const col = score >= 80 ? '#16a34a' : score >= 60 ? '#d97706' : '#dc2626';
  const r = size * 0.425;
  const circ = 2 * Math.PI * r;
  const arc = (score / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill={col + '11'} stroke={col + '33'} strokeWidth={size * 0.1} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={size * 0.1}
        strokeDasharray={`${arc} ${circ}`} strokeDashoffset={circ / 4}
        strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x={size/2} y={size/2 - 4} textAnchor="middle" fontSize={size * 0.22} fontWeight={800} fill={col}>{score}</text>
      <text x={size/2} y={size/2 + 10} textAnchor="middle" fontSize={size * 0.1} fill="#8896bb">/ 100</text>
    </svg>
  );
}

// ── Leaderboard sub-component ─────────────────────────────────
function Leaderboard({ staff, attendance, currentUser, loadLessonPlans, navigate }) {
  const [lbTab, setLbTab]       = useState('overall');
  const [lbView, setLbView]     = useState('table');
  const [lbSearch, setLbSearch] = useState('');
  const [lbSortBy, setLbSortBy] = useState('score');
  const [breakdown, setBreakdown] = useState(null);

  const isAdmin = currentUser?.role === 'admin';
  const allPlans = useMemo(() => loadLessonPlans ? loadLessonPlans() : {}, [loadLessonPlans]);
  const dutyData = useMemo(() => lsGet('ims_dutydata', '{}'), []);
  const starData = useMemo(() => lsGet('gnsi_lb_stars', '{}'), []);

  const getScorerForTab = (tab) => ({
    teachers: scoreTeachers, housemaster: scoreHousemaster,
    admin: scoreAdmin, support: scoreSupport,
  }[tab] || scoreOverall);

  const allRanked = useMemo(() => staff
    .filter(s => s.status === 'Active' && !LEADERBOARD_EXCLUDED_IDS.includes(s.id))
    .map(s => {
      const m = lbMetrics(s, attendance, allPlans, dutyData);
      const sc = scoreOverall(s, m);
      const streak = lbStreak(s, attendance);
      return { ...s, ...m, score: sc.score, breakdown: sc.breakdown, streak, badges: computeBadges(m, sc.score, streak, 'overall'), stars: starData[s.id] || 0 };
    })
    .sort((a, b) => b.score - a.score),
  [staff, attendance, allPlans, dutyData, starData]);

  const catRanked = useMemo(() => {
    const scorer = getScorerForTab(lbTab);
    const filter = TAB_FILTERS[lbTab] || TAB_FILTERS.overall;
    return staff
      .filter(s => s.status === 'Active' && !LEADERBOARD_EXCLUDED_IDS.includes(s.id) && filter(s))
      .map(s => {
        const m = lbMetrics(s, attendance, allPlans, dutyData);
        const sc = scorer(s, m);
        const streak = lbStreak(s, attendance);
        return { ...s, ...m, score: sc.score, breakdown: sc.breakdown, streak, badges: computeBadges(m, sc.score, streak, lbTab), stars: starData[s.id] || 0 };
      })
      .sort((a, b) => {
        if (lbSortBy === 'name')       return a.name.localeCompare(b.name);
        if (lbSortBy === 'attendance') return b.attPct - a.attPct;
        if (lbSortBy === 'streak')     return b.streak - a.streak;
        return b.score - a.score;
      });
  }, [staff, attendance, allPlans, dutyData, starData, lbTab, lbSortBy]);

  const filtered = useMemo(() => {
    if (!lbSearch.trim()) return catRanked;
    const q = lbSearch.trim().toLowerCase();
    return catRanked.filter(s => s.name.toLowerCase().includes(q) || (s.role||'').toLowerCase().includes(q) || (s.dept||'').toLowerCase().includes(q));
  }, [catRanked, lbSearch]);

  const deptMap = useMemo(() => {
    const m = {};
    allRanked.forEach(s => {
      const d = s.dept || 'Other';
      if (!m[d]) m[d] = { total: 0, sum: 0 };
      m[d].total++; m[d].sum += s.score;
    });
    return m;
  }, [allRanked]);

  const scoringDef = LB_SCORING_DEFS[lbTab] || LB_SCORING_DEFS.overall;
  const sotm = allRanked[0];

  const exportCSV = () => {
    const rows = [['Rank','Name','Role','Department','Score','Attendance%','Streak','Badges','Stars']];
    allRanked.forEach((s, i) => {
      rows.push([i+1, s.name, s.role, s.dept||'', s.score, s.attPct, s.streak, s.badges.map(b=>b.lbl).join('; '), s.stars]);
    });
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'gnsi_leaderboard.csv';
    a.click();
  };

  const TABS = [
    { id:'overall', label:'🏆 Overall' },
    { id:'teachers', label:'📚 Teachers' },
    { id:'housemaster', label:'🏠 House Staff' },
    { id:'admin', label:'⚙️ Admin Staff' },
    { id:'support', label:'🛠 Support' },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: '#94a3b8', letterSpacing: '.16em', textTransform: 'uppercase', marginBottom: 4 }}>GNSI — PERFORMANCE</div>
        <div style={{ fontSize: 26, fontWeight: 700, color: '#1e293b' }}>🏆 Staff Leaderboard</div>
        <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Each category ranked on its own criteria · Badges · Streaks · Recognition</div>
      </div>

      {/* Staff of the Month */}
      {sotm && (
        <div style={{ background: 'linear-gradient(135deg,#1433a8,#1e40af)', borderRadius: 18, padding: '20px 24px', marginBottom: 20, color: '#fff', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 40 }}>🥇</div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4 }}>Staff of the Month</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{sotm.name}</div>
            <div style={{ fontSize: 13, opacity: 0.8 }}>{sotm.role} · Score: {sotm.score}/100</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {sotm.badges.slice(0, 3).map((b, i) => (
              <span key={i} title={b.ttl} style={{ background: 'rgba(255,255,255,.2)', borderRadius: 12, padding: '4px 10px', fontSize: 11, fontWeight: 700 }}>{b.ic} {b.lbl}</span>
            ))}
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map(t => {
          const act = lbTab === t.id;
          return (
            <button key={t.id} onClick={() => setLbTab(t.id)} style={{
              padding: '8px 18px', borderRadius: 24,
              border: act ? 'none' : '1.5px solid #e2e8f0',
              background: act ? 'linear-gradient(135deg,#1433a8,#1e40af)' : '#f8fafc',
              color: act ? '#fff' : '#64748b',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              boxShadow: act ? '0 4px 14px rgba(20,51,168,.3)' : 'none',
              transition: 'all .15s',
            }}>{t.label}</button>
          );
        })}
      </div>

      {/* Scoring banner */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 18px', marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.1em', fontFamily: "'JetBrains Mono',monospace", marginBottom: 3 }}>Scoring — {scoringDef.title}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{scoringDef.desc}</div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {scoringDef.criteria.map((c, i) => (
            <span key={i} title={c.desc} style={{ background: c.col + '18', border: `1px solid ${c.col}44`, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: c.col }}>
              {c.icon} {c.label} ({c.max}pts)
            </span>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 16px' }}>
        <input
          value={lbSearch} onChange={e => setLbSearch(e.target.value)}
          placeholder="🔍 Search staff..."
          style={{ flex: 1, minWidth: 180, border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '8px 14px', fontSize: 13, background: '#f8fafc', outline: 'none' }}
        />
        <select value={lbSortBy} onChange={e => setLbSortBy(e.target.value)} style={{ padding: '8px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#f8fafc', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <option value="score">Sort: Score</option>
          <option value="attendance">Sort: Attendance</option>
          <option value="streak">Sort: Streak</option>
          <option value="name">Sort: Name A–Z</option>
        </select>
        <div style={{ display: 'flex', border: '1.5px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
          {['table','cards'].map(v => (
            <button key={v} onClick={() => setLbView(v)} style={{ padding: '8px 14px', border: 'none', background: lbView === v ? '#1433a8' : '#f8fafc', color: lbView === v ? '#fff' : '#64748b', fontSize: 13, cursor: 'pointer' }}>
              {v === 'table' ? '☰' : '⊞'}
            </button>
          ))}
        </div>
        {isAdmin && <button onClick={exportCSV} style={{ padding: '8px 16px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>📥 Export</button>}
      </div>

      {/* Rankings */}
      {filtered.length === 0
        ? <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 16, padding: 48, textAlign: 'center', color: '#94a3b8' }}>No staff match your search.</div>
        : (
          <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 16, marginBottom: 20, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 13, fontWeight: 800 }}>🏅 {scoringDef.title} Rankings</span>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>{filtered.length} staff ranked</span>
            </div>
            {lbView === 'table' ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['Rank','Staff Member','Role','Attendance','Streak','Badges','Score',...(isAdmin?['Actions']:[])].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.08em', borderBottom: '1px solid #f1f5f9' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s, i) => {
                      const scoreCol = s.score >= 80 ? '#16a34a' : s.score >= 60 ? '#d97706' : '#dc2626';
                      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i+1);
                      return (
                        <tr key={s.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                          <td style={{ padding: '10px 14px', fontWeight: 800 }}>{medal}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <Avatar name={s.name} size={32} />
                              <div>
                                <div style={{ fontWeight: 700 }}>{s.name}</div>
                                <div style={{ fontSize: 11, color: '#94a3b8' }}>{s.dept}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 12, color: '#64748b' }}>{s.role}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: s.attPct >= 90 ? '#16a34a' : '#d97706' }}>{s.attPct}%</div>
                            <div style={{ height: 4, width: 60, background: '#f1f5f9', borderRadius: 2, overflow: 'hidden', marginTop: 3 }}>
                              <div style={{ height: '100%', width: `${s.attPct}%`, background: s.attPct >= 90 ? '#16a34a' : '#d97706', borderRadius: 2 }} />
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            {s.streak >= 3 && <span style={{ background: '#fff7ed', color: '#f97316', borderRadius: 12, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>🔥 {s.streak}d</span>}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {s.badges.slice(0, 3).map((b, bi) => (
                                <span key={bi} title={b.ttl} style={{ background: b.bg, color: b.col, borderRadius: 12, padding: '2px 6px', fontSize: 10, fontWeight: 700 }}>{b.ic}</span>
                              ))}
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ fontSize: 18, fontWeight: 800, color: scoreCol, fontFamily: "'JetBrains Mono',monospace" }}>{s.score}</div>
                          </td>
                          {isAdmin && (
                            <td style={{ padding: '10px 14px' }}>
                              <button onClick={() => setBreakdown(s)} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 8, border: '1.5px solid #1433a8', background: '#e8ecff', color: '#1433a8', cursor: 'pointer', fontWeight: 700 }}>Details</button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 16, padding: 16 }}>
                {filtered.map((s, i) => {
                  const scoreCol = s.score >= 80 ? '#16a34a' : s.score >= 60 ? '#d97706' : '#dc2626';
                  const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i+1);
                  return (
                    <div key={s.id} style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 16, padding: 20, position: 'relative' }}>
                      <div style={{ position: 'absolute', top: 10, left: 12, fontSize: i < 3 ? 18 : 12, fontWeight: 800 }}>{medal}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: 8 }}>
                        <ScoreRing score={s.score} />
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 14, fontWeight: 800 }}>{s.name.split(' ').slice(0,3).join(' ')}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{s.role}</div>
                        </div>
                        <div style={{ width: '100%' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94a3b8', marginBottom: 4 }}><span>Attendance</span><span style={{ fontWeight: 700, color: '#1e293b' }}>{s.attPct}%</span></div>
                          <div style={{ height: 5, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${s.attPct}%`, background: s.attPct >= 90 ? '#16a34a' : s.attPct >= 75 ? '#d97706' : '#dc2626', borderRadius: 3 }} />
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                          {s.streak >= 3 && <span style={{ background: '#fff7ed', color: '#f97316', borderRadius: 12, padding: '3px 8px', fontSize: 10, fontWeight: 700 }}>🔥 {s.streak}d</span>}
                          {s.badges.slice(0, 3).map((b, bi) => (
                            <span key={bi} title={b.ttl} style={{ background: b.bg, color: b.col, borderRadius: 12, padding: '3px 8px', fontSize: 10, fontWeight: 700 }}>{b.ic}</span>
                          ))}
                        </div>
                        {isAdmin && (
                          <div style={{ display: 'flex', gap: 6, width: '100%', marginTop: 4 }}>
                            <button onClick={() => setBreakdown(s)} style={{ flex: 1, fontSize: 11, padding: 6, borderRadius: 8, border: '1.5px solid #1433a8', background: '#e8ecff', color: '#1433a8', cursor: 'pointer', fontWeight: 700 }}>Details</button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )
      }

      {/* Dept performance + Scoring breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 16, padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 14, fontFamily: "'JetBrains Mono',monospace" }}>Department Performance</div>
          {Object.keys(deptMap).sort((a, b) => (deptMap[b].sum/deptMap[b].total) - (deptMap[a].sum/deptMap[a].total)).map(d => {
            const avg = Math.round(deptMap[d].sum / deptMap[d].total);
            const col = avg >= 80 ? '#16a34a' : avg >= 60 ? '#f59e0b' : '#dc2626';
            return (
              <div key={d} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700 }}>{d}</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>{deptMap[d].total} staff</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: col }}>{avg}</span>
                  </div>
                </div>
                <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${avg}%`, background: col, borderRadius: 4, transition: 'width .8s ease' }} />
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: 13, fontWeight: 800 }}>📐 {scoringDef.title} Scoring</span>
          </div>
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {scoringDef.criteria.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }} title={c.desc}>
                <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{c.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{c.label}</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: c.col }}>{c.max} pts</span>
                  </div>
                  <div style={{ height: 5, background: '#f1f5f9', borderRadius: 3, marginTop: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(c.max / 105) * 100}%`, background: c.col, borderRadius: 3 }} />
                  </div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{c.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Breakdown modal */}
      {breakdown && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(8,15,38,.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setBreakdown(null)}>
          <div style={{ background: '#fff', borderRadius: 24, padding: 28, width: 460, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>📊 {breakdown.name} — Score Breakdown</div>
              <button onClick={() => setBreakdown(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8' }}>×</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <ScoreRing score={breakdown.score} size={100} />
            </div>
            {Object.entries(breakdown.breakdown).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: 13 }}>{k}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#1433a8' }}>{v} pts</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
              {breakdown.badges.map((b, i) => (
                <span key={i} title={b.ttl} style={{ background: b.bg, color: b.col, borderRadius: 12, padding: '4px 10px', fontSize: 11, fontWeight: 700 }}>{b.ic} {b.lbl}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  MAIN ADMIN CENTRE COMPONENT
// ════════════════════════════════════════════════════════════
export default function AdminCentre({
  currentUser,
  students = [],
  staff = [],
  notices = [],
  attendance = {},
  navigate,
  gnsiGetHouseMap,
  getFacultyStaff,
  loadLessonPlans,
  gnsiGetReports,
  gnsiMonitorAlertCount,
  renderFeeMonitorPanel,
  DEPT_COLORS = {},
}) {
  const [acTab, setAcTab] = useState('overview');

  // Guard: admin only
  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <div style={{ fontSize: 48 }}>🔒</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#dc2626', marginTop: 12 }}>Admin Only</div>
      </div>
    );
  }

  const today = new Date().toISOString().split('T')[0];
  const attKeys = Object.keys(attendance);
  const attToday = attKeys.filter(k => k.startsWith(today + '-S'));
  const attP  = attToday.filter(k => attendance[k] === 'P').length;
  const attA  = attToday.filter(k => attendance[k] === 'A').length;
  const attL  = attToday.filter(k => attendance[k] === 'L').length;
  const attED = attToday.filter(k => attendance[k] === 'ED').length;

  const admApps      = lsGet('gnsi_adm_apps');
  const visitors     = lsGet('gnsi_visitors');
  const todayVisitors= visitors.filter(v => (v.date||'').startsWith(today));
  const visitorsIn   = todayVisitors.filter(v => v.status === 'In').length;
  const dutyData     = lsGet('ims_dutydata', '{}');
  const dutyCount    = (dutyData.entries || []).length;
  const behaviour    = lsGet('gnsi_hmsa_behaviour');
  const openBeh      = behaviour.filter(r => r.status === 'Open').length;
  const health       = lsGet('gnsi_hmsa_health');
  const monitoring   = health.filter(r => r.status === 'Monitoring').length;
  const feePending   = students.filter(s => s.fees === 'Pending').length;
  const feePaid      = students.filter(s => s.fees === 'Paid').length;
  const totalIncome  = (lsGet('ims_income')||[]).reduce((t,r) => t+(parseFloat(r.amount)||0), 0);
  const totalExpend  = (lsGet('ims_expend')||[]).reduce((t,r) => t+(parseFloat(r.amount)||0), 0);
  const allReports   = gnsiGetReports ? gnsiGetReports() : lsGet('gnsi_report_collection');
  const pendingReports = allReports.filter(r => r.status === 'Pending Review');
  const allPlans     = loadLessonPlans ? loadLessonPlans() : {};
  const sessions     = lsGet('gnsi_sessions');
  const activeSess   = sessions.filter(s => s.active);
  const ttPeriods    = lsGet('ims_gnsi_periods');
  const examTypes    = lsGet('gnsi_exam_types');
  const noUsername   = staff.filter(s => !localStorage.getItem('gnsi_uname_' + s.id));
  const noPwd        = staff.filter(s => !localStorage.getItem('gnsi_pwd_' + s.id));
  const boarders     = students.filter(s => s.hostel === 'Yes');
  const houseMap     = gnsiGetHouseMap ? gnsiGetHouseMap() : {};
  const noHouse      = boarders.filter(s => !houseMap[String(s.id)]).length;
  const faculty      = getFacultyStaff ? getFacultyStaff() : [];
  const monAlerts    = gnsiMonitorAlertCount ? gnsiMonitorAlertCount() : 0;
  const _rlsFixed    = localStorage.getItem('gnsi_rls_fix_applied') === 'yes';

  // ── System issues ─────────────────────────────────────────
  const issues = [];
  if (noUsername.length) issues.push({ sev:'high', icon:'🔑', title:'Staff Without Login Username', detail: noUsername.slice(0,5).map(s=>s.name).join(', ')+(noUsername.length>5?' +more':''), fix:'Settings → Staff Credentials Overview → Quick Setup' });
  if (noPwd.length) issues.push({ sev:'med', icon:'🔐', title:'Staff Using Default Passwords', detail: noPwd.length+' still on default password', fix:'Settings → Staff Credentials Overview → Password button' });
  if (students.filter(s=>!s.cls).length) issues.push({ sev:'high', icon:'🎓', title:'Students Not Assigned to Class', detail: students.filter(s=>!s.cls).length+' student(s) without class', fix:'Students → Edit → assign class' });
  if (students.filter(s=>!s.fees).length) issues.push({ sev:'med', icon:'💳', title:'Students With No Fee Status', detail: students.filter(s=>!s.fees).length+' student(s) fee status blank', fix:'Fees section → mark payment status' });
  if (!activeSess.length) issues.push({ sev:'high', icon:'📅', title:'No Active Academic Session', detail:'No session is currently marked active', fix:'Sessions → Set Active' });
  if (!ttPeriods.length) issues.push({ sev:'med', icon:'📋', title:'Timetable Not Configured', detail:'No periods in timetable', fix:'Timetable → Add Periods' });
  if (!dutyCount) issues.push({ sev:'low', icon:'⏱', title:'Duty Schedule Not Set Up', detail:'No duty entries found', fix:'Duty Hours → Add entries' });
  if (noHouse > 0) issues.push({ sev:'med', icon:'🏠', title:'Boarders Without House', detail: noHouse+' boarder(s) not in any house', fix:'House Master → assign houses' });
  if (!examTypes.length) issues.push({ sev:'low', icon:'📝', title:'No Exam Types Configured', detail:'Exam types not set up', fix:'Exam & Results → Exam Types' });
  if (pendingReports.length >= 5) issues.push({ sev:'med', icon:'📄', title:'Reports Awaiting Review', detail: pendingReports.length+' reports pending admin review', fix:'Report Collection → Review' });
  if (openBeh >= 3) issues.push({ sev:'high', icon:'⚠️', title:'Multiple Open Behaviour Cases', detail: openBeh+' unresolved incidents', fix:'House Master → Behaviour tab' });
  if (monitoring >= 3) issues.push({ sev:'high', icon:'🏥', title:'Multiple Students Under Medical Watch', detail: monitoring+' boarders under health monitoring', fix:'House Master → Health tab' });
  if (!_rlsFixed) issues.push({ sev:'high', icon:'🔓', title:'Supabase RLS Policy Needs Updating', detail:'gnsi_keyvalue anon policy exposes credentials to unauthenticated users', fix:'Admin Centre → Security tab → Apply RLS Fix' });

  const AC_TABS = [
    { id:'overview',       icon:'🏠', label:'Overview' },
    { id:'feemonitor',     icon:'🕵️', label:`Fee Monitor${monAlerts > 0 ? ` (${monAlerts})` : ''}` },
    { id:'monitor',        icon:'📡', label:'Live Monitor' },
    { id:'analytics',      icon:'📊', label:'Analytics' },
    { id:'students',       icon:'🎓', label:'Student Intel' },
    { id:'staffintel',     icon:'👥', label:'Staff Intel' },
    { id:'leaderboard',    icon:'🏆', label:'Leaderboard' },
    { id:'audit',          icon:'🔐', label:'Audit Log' },
    { id:'security',       icon:'🔒', label:'Security' },
    { id:'schoolsettings', icon:'🏫', label:'School Settings' },
  ];

  // KPI strip data
  const kpiItems = [
    { lbl:'Staff',        val: staff.length,      sub:`Active: ${staff.filter(s=>s.status==='Active').length}`, col:'#1433a8',  icon:'👥' },
    { lbl:'Students',     val: students.length,   sub:`Boarders: ${boarders.length}`,                          col:'#7c3aed',  icon:'🎓' },
    { lbl:'Present Today',val: attP,              sub:`Absent: ${attA} Late: ${attL}`,                         col:'#16a34a',  icon:'✅' },
    { lbl:'Pending Fees', val: feePending,        sub:`Paid: ${feePaid}`,                                      col: feePending > 0 ? '#dc2626' : '#16a34a', icon:'💰' },
    { lbl:'Open Issues',  val: issues.length,     sub:`${issues.filter(x=>x.sev==='high').length} critical`,   col: issues.filter(x=>x.sev==='high').length ? '#dc2626' : '#16a34a', icon:'🔍' },
    { lbl:'Fee Alerts',   val: monAlerts,         sub: monAlerts > 0 ? 'Suspicious activity' : 'All clear',   col: monAlerts > 0 ? '#dc2626' : '#16a34a', icon:'🕵️' },
    { lbl:'Rpts Pending', val: pendingReports.length, sub:`Total: ${allReports.length}`,                       col: pendingReports.length > 3 ? '#f59e0b' : '#16a34a', icon:'📄' },
    { lbl:'Net Balance',  val: `₹${Math.round((totalIncome-totalExpend)/1000)}K`, sub:'Inc−Exp',              col: (totalIncome-totalExpend) >= 0 ? '#16a34a' : '#dc2626', icon:'📈' },
    { lbl:'Visitors In',  val: visitorsIn,        sub:`Today: ${todayVisitors.length}`,                        col:'#0891b2',  icon:'👤' },
  ];

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4 }}>GNSI Portal</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#1e293b' }}>🛡 Admin Centre</div>
        <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Full system visibility · Staff management · Analytics · Security</div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 20, padding: '6px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14 }}>
        {AC_TABS.map(t => {
          const act = acTab === t.id;
          return (
            <button key={t.id} onClick={() => setAcTab(t.id)} style={{
              padding: '7px 14px', borderRadius: 10, border: 'none',
              background: act ? '#1433a8' : 'transparent',
              color: act ? '#fff' : '#64748b',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all .15s',
            }}>{t.icon} {t.label}</button>
          );
        })}
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 12, marginBottom: 22 }}>
        {kpiItems.map(k => <KpiCard key={k.lbl} {...k} />)}
      </div>

      {/* ── Tab content ─────────────────────────────── */}

      {acTab === 'feemonitor' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4 }}>Admin Centre</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>🕵️ Fee Monitoring System</div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Smart detection of suspicious fee activity · Real-time collection audit</div>
          </div>
          {renderFeeMonitorPanel ? renderFeeMonitorPanel(false) : <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Fee Monitor panel not connected.</div>}
        </div>
      )}

      {acTab === 'overview' && (
        <OverviewTab
          actFeed={buildActivityFeed({ attToday, attendance, attP, attA, attL, attED, notices, admApps, todayVisitors, visitorsIn, dutyCount, openBeh, monitoring, feePending, pendingReports })}
          issues={issues}
          renderFeeMonitorPanel={renderFeeMonitorPanel}
        />
      )}

      {acTab === 'monitor' && (
        <MonitorTab
          attendance={attendance}
          staff={staff}
          students={students}
          today={today}
          attKeys={attKeys}
          pendingReports={pendingReports}
          openBeh={openBeh}
          monitoring={monitoring}
          feePending={feePending}
          admApps={admApps}
          noHouse={noHouse}
          noUsername={noUsername}
          activeSess={activeSess}
          navigate={navigate}
        />
      )}

      {acTab === 'analytics' && (
        <AnalyticsTab
          students={students}
          staff={staff}
          feePaid={feePaid}
          feePending={feePending}
          faculty={faculty}
          allPlans={allPlans}
          totalIncome={totalIncome}
          totalExpend={totalExpend}
        />
      )}

      {acTab === 'leaderboard' && (
        <Leaderboard
          staff={staff}
          attendance={attendance}
          currentUser={currentUser}
          loadLessonPlans={loadLessonPlans}
          navigate={navigate}
        />
      )}

      {['audit','security','schoolsettings','students','staffintel'].includes(acTab) && (
        <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 16, padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🚧</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#64748b' }}>
            {AC_TABS.find(t => t.id === acTab)?.label} — migrating from legacy module
          </div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 8 }}>Use the existing portal for this section while migration is in progress.</div>
        </div>
      )}
    </div>
  );
}

// ── Activity feed builder ─────────────────────────────────────
function buildActivityFeed({ attToday, attendance, attP, attA, attL, attED, notices, admApps, todayVisitors, visitorsIn, dutyCount, openBeh, monitoring, feePending, pendingReports }) {
  const feed = [];
  if (attToday.length) feed.push({ icon:'✅', color:'#16a34a', title:'Attendance Marked Today', detail:`${attP} Present · ${attA} Absent · ${attL} Late · ${attED} Early Dep`, time:'Today', section:'Attendance' });
  notices.slice(0,3).forEach(n => feed.push({ icon:'📢', color:'#1433a8', title:'Notice: '+n.title, detail:'Priority: '+n.priority, time:n.date, section:'Notices' }));
  admApps.slice(0,3).forEach(a => feed.push({ icon:'📝', color:'#7c3aed', title:'Application: '+a.name, detail:'Status: '+a.status+' | '+(a.course||'—'), time:a.date||'—', section:'Admissions' }));
  if (todayVisitors.length) feed.push({ icon:'👤', color:'#0891b2', title:'Visitors Today', detail:`${todayVisitors.length} visitor(s) · ${visitorsIn} inside`, time:'Today', section:'Reception' });
  if (dutyCount) feed.push({ icon:'⏱', color:'#d4a853', title:'Duty Schedule Active', detail:`${dutyCount} duty entries`, time:'Ongoing', section:'Duty Hours' });
  if (openBeh) feed.push({ icon:'⚠️', color:'#dc2626', title:'Open Behaviour Cases', detail:`${openBeh} unresolved incident(s)`, time:'Pending', section:'House Master' });
  if (monitoring) feed.push({ icon:'🏥', color:'#f59e0b', title:'Health Monitoring Active', detail:`${monitoring} boarder(s) under watch`, time:'Active', section:'House Master' });
  if (feePending) feed.push({ icon:'💰', color:'#dc2626', title:'Pending Fee Payments', detail:`${feePending} student(s) outstanding`, time:'Overdue', section:'Fees' });
  if (pendingReports.length) feed.push({ icon:'📄', color:'#7c3aed', title:'Reports Awaiting Review', detail:`${pendingReports.length} report(s) pending`, time:'Pending', section:'Reports' });
  return feed;
}

// ── Overview tab ──────────────────────────────────────────────
function OverviewTab({ actFeed, issues, renderFeeMonitorPanel }) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Activity feed */}
        <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '14px 20px', borderBottom: '1px solid #f1f5f9', background: 'linear-gradient(135deg,#eff6ff,#f0fdf4)' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800 }}>📡 Live Activity Feed</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>All section activity at a glance</div>
            </div>
            <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: "'JetBrains Mono',monospace" }}>{actFeed.length} events</span>
          </div>
          <div style={{ maxHeight: 500, overflowY: 'auto' }}>
            {actFeed.length
              ? actFeed.map((a, i) => <FeedRow key={i} a={a} />)
              : <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No activity today yet.</div>
            }
          </div>
        </div>

        {/* System health */}
        <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '14px 20px', borderBottom: '1px solid #f1f5f9', background: 'linear-gradient(135deg,#fef2f2,#fffbeb)' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800 }}>🔍 System Health</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Auto-detected configuration gaps</div>
            </div>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
              background: issues.filter(x=>x.sev==='high').length ? '#fef2f2' : '#f0fdf4',
              color: issues.filter(x=>x.sev==='high').length ? '#dc2626' : '#16a34a',
              border: `1px solid ${issues.filter(x=>x.sev==='high').length ? '#fca5a5' : '#86efac'}`,
            }}>{issues.length} issues</span>
          </div>
          <div style={{ padding: 14, maxHeight: 500, overflowY: 'auto' }}>
            {issues.length
              ? issues.map((iss, i) => <IssueCard key={i} iss={iss} />)
              : <div style={{ padding: 28, textAlign: 'center', background: '#f0fdf4', borderRadius: 14, border: '1.5px solid #86efac' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#16a34a' }}>All Systems Healthy!</div>
                </div>
            }
          </div>
        </div>
      </div>
      {renderFeeMonitorPanel && <div style={{ marginTop: 20 }}>{renderFeeMonitorPanel(true)}</div>}
    </div>
  );
}

// ── Monitor tab ───────────────────────────────────────────────
function MonitorTab({ attendance, staff, students, today, attKeys, pendingReports, openBeh, monitoring, feePending, admApps, noHouse, noUsername, activeSess, navigate }) {
  const pendingActions = [];
  if (pendingReports.length) pendingActions.push({ priority:'high', icon:'📄', action:`Review ${pendingReports.length} Pending Reports`, sub: pendingReports.slice(0,2).map(r=>r.staffName+' — '+r.type).join(' · '), page:'reports' });
  if (openBeh) pendingActions.push({ priority:'high', icon:'⚠️', action:`${openBeh} Open Behaviour Incident${openBeh>1?'s':''}`, sub:'Students involved need admin follow-up', page:'housemaster' });
  if (monitoring) pendingActions.push({ priority:'high', icon:'🏥', action:`${monitoring} Student${monitoring>1?'s':''} Under Medical Watch`, sub:'Check health status and update records', page:'housemaster' });
  if (feePending > 10) pendingActions.push({ priority:'med', icon:'💰', action:`${feePending} Students With Pending Fees`, sub:'Follow up with parents for collection', page:'fees' });
  if (admApps.filter(a=>a.status==='Pending').length) pendingActions.push({ priority:'med', icon:'📝', action:`${admApps.filter(a=>a.status==='Pending').length} Pending Admission Application(s)`, sub:'Review and process applications', page:'admissions' });
  if (noHouse > 0) pendingActions.push({ priority:'med', icon:'🏠', action:`${noHouse} Boarder(s) Without House Assignment`, sub:'Assign houses in House Master section', page:'housemaster' });
  if (noUsername.length) pendingActions.push({ priority:'med', icon:'🔑', action:`${noUsername.length} Staff Without Login Credentials`, sub: noUsername.slice(0,3).map(s=>s.name).join(', '), page:'settings' });
  if (!activeSess.length) pendingActions.push({ priority:'high', icon:'📅', action:'No Active Academic Session Set', sub:'Set the current session as active', page:'sessions' });

  const absentStaff = staff.filter(s => attendance[today + '-S-' + s.id] === 'A');
  const lateStaff   = staff.filter(s => attendance[today + '-S-' + s.id] === 'L');

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Pending actions */}
        <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #f1f5f9', background: 'linear-gradient(135deg,#fef2f2,#fffbeb)' }}>
            <span style={{ fontSize: 13, fontWeight: 800 }}>⚡ Pending Actions</span>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>{pendingActions.length} item(s)</span>
          </div>
          <div style={{ maxHeight: 340, overflowY: 'auto' }}>
            {pendingActions.length ? pendingActions.map((pa, i) => {
              const pc = { high:'#dc2626', med:'#f59e0b', low:'#3b82f6' }[pa.priority];
              const pb = { high:'#fef2f2', med:'#fffbeb', low:'#eff6ff' }[pa.priority];
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderBottom: '1px solid #f8fafc', background: pb }}>
                  <div style={{ fontSize: 22, flexShrink: 0 }}>{pa.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{pa.action}</div>
                    <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>{pa.sub}</div>
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 12, background: pc, color: '#fff', flexShrink: 0 }}>{pa.priority.toUpperCase()}</span>
                  <button onClick={() => navigate(pa.page)} style={{ padding: '5px 12px', borderRadius: 8, border: `1.5px solid ${pc}`, background: pb, color: pc, fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>Go →</button>
                </div>
              );
            }) : <div style={{ padding: 36, textAlign: 'center', color: '#16a34a', fontWeight: 700 }}>🎉 No pending actions! All clear.</div>}
          </div>
        </div>
        {/* 7-day trend */}
        <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: 13, fontWeight: 800 }}>📈 7-Day Attendance Trend</span>
          </div>
          <AttendanceTrend attendance={attendance} staff={staff} today={today} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Absent today */}
        <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #f1f5f9', background: '#fef2f2' }}>
            <span style={{ fontSize: 13, fontWeight: 800 }}>🔴 Absent Today ({absentStaff.length})</span>
            <button onClick={() => navigate('attendance')} style={{ padding: '4px 10px', borderRadius: 7, border: '1px solid #fca5a5', background: '#fee2e2', color: '#dc2626', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Mark Attendance</button>
          </div>
          {absentStaff.length
            ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '14px 18px' }}>
                {absentStaff.map(s => <span key={s.id} style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>{s.name}</span>)}
              </div>
            : <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>No absences today ✅</div>
          }
        </div>
        {/* Late today */}
        <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', background: '#fef9c3' }}>
            <span style={{ fontSize: 13, fontWeight: 800 }}>🕐 Late Today ({lateStaff.length})</span>
          </div>
          {lateStaff.length
            ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '14px 18px' }}>
                {lateStaff.map(s => <span key={s.id} style={{ background: '#fef9c3', color: '#ca8a04', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>{s.name}</span>)}
              </div>
            : <div style={{ padding: '14px 18px', color: '#94a3b8', fontSize: 13 }}>None late today ✅</div>
          }
        </div>
      </div>
    </div>
  );
}

// ── Analytics tab ─────────────────────────────────────────────
function AnalyticsTab({ students, staff, feePaid, feePending, faculty, allPlans, totalIncome, totalExpend }) {
  const feeTotal   = students.length;
  const feePaidPct = feeTotal > 0 ? Math.round(feePaid / feeTotal * 100) : 0;
  const feePendPct = feeTotal > 0 ? Math.round(feePending / feeTotal * 100) : 0;

  const clsMap = {};
  students.forEach(s => {
    const c = s.cls || 'Unassigned';
    if (!clsMap[c]) clsMap[c] = { paid: 0, pending: 0 };
    if (s.fees === 'Paid') clsMap[c].paid++; else clsMap[c].pending++;
  });

  const facCompliance = faculty.map(f => {
    let worked = 0, entered = 0;
    for (let di = 0; di < 30; di++) {
      const dd = new Date(); dd.setDate(dd.getDate() - di);
      if (dd.getDay() === 0) continue;
      const ds = dd.toISOString().split('T')[0];
      worked++;
      if (allPlans[f.id]?.[ds]?.length) entered++;
    }
    return { name: f.name.split(' ').slice(0,2).join(' '), pct: worked > 0 ? Math.round(entered / worked * 100) : 0 };
  }).sort((a, b) => b.pct - a.pct);

  const balColor = (totalIncome - totalExpend) >= 0 ? '#16a34a' : '#dc2626';
  const circ = 2 * Math.PI * 38;
  const paidArc = Math.round(feePaidPct / 100 * circ * 10) / 10;
  const pendArc = Math.round(feePendPct / 100 * circ * 10) / 10;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      {/* Fee donut */}
      <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9' }}><span style={{ fontSize: 13, fontWeight: 800 }}>💰 Fee Collection Overview</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '18px 20px' }}>
          <svg width={100} height={100} viewBox="0 0 100 100">
            <circle cx={50} cy={50} r={38} fill="none" stroke="#e5e7eb" strokeWidth={18} />
            <circle cx={50} cy={50} r={38} fill="none" stroke="#16a34a" strokeWidth={18} strokeDasharray={`${paidArc} ${Math.round(circ*10)/10}`} strokeDashoffset={Math.round(circ*10)/10/4} strokeLinecap="round" />
            <circle cx={50} cy={50} r={38} fill="none" stroke="#dc2626" strokeWidth={18} strokeDasharray={`${pendArc} ${Math.round(circ*10)/10}`} strokeDashoffset={Math.round(circ*10)/10/4 - paidArc} strokeLinecap="round" />
            <text x={50} y={46} textAnchor="middle" fontSize={14} fontWeight={800} fill="#1e293b">{feePaidPct}%</text>
            <text x={50} y={59} textAnchor="middle" fontSize={8} fill="#8896bb">Paid</text>
          </svg>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} /><span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a' }}>Paid: {feePaid} ({feePaidPct}%)</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} /><span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>Pending: {feePending} ({feePendPct}%)</span></div>
          </div>
        </div>
        <div style={{ padding: '0 16px 16px' }}>
          {Object.keys(clsMap).sort().map(c => {
            const tot = clsMap[c].paid + clsMap[c].pending;
            const pct = tot > 0 ? Math.round(clsMap[c].paid / tot * 100) : 0;
            const col = pct >= 80 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626';
            return (
              <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ width: 80, fontSize: 12, fontWeight: 700 }}>{c}</span>
                <span style={{ fontSize: 11, color: '#16a34a', width: 24, textAlign: 'center', fontWeight: 700 }}>{clsMap[c].paid}</span>
                <span style={{ fontSize: 11, color: '#dc2626', width: 24, textAlign: 'center', fontWeight: 700 }}>{clsMap[c].pending}</span>
                <div style={{ flex: 1, height: 7, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: col, borderRadius: 4 }} />
                </div>
                <span style={{ fontSize: 10, color: col, fontWeight: 700 }}>{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lesson plan compliance */}
      <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9' }}><span style={{ fontSize: 13, fontWeight: 800 }}>📝 Lesson Plan Compliance (30d)</span></div>
        <div style={{ padding: '14px 16px' }}>
          {facCompliance.map((f, i) => {
            const col = f.pct >= 80 ? '#16a34a' : f.pct >= 50 ? '#d97706' : '#dc2626';
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, minWidth: 120, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
                <div style={{ flex: 1, height: 10, background: '#f1f5f9', borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${f.pct}%`, background: col, borderRadius: 5 }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 800, color: col, minWidth: 36, textAlign: 'right' }}>{f.pct}%</span>
              </div>
            );
          })}
          {facCompliance.length === 0 && <div style={{ textAlign: 'center', color: '#94a3b8', padding: 24 }}>No faculty data.</div>}
        </div>
        {/* Net balance */}
        <div style={{ margin: '0 16px 16px', background: (totalIncome-totalExpend)>=0?'#f0fdf4':'#fef2f2', border: `1.5px solid ${balColor}44`, borderRadius: 12, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.08em' }}>Net Balance</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: balColor, fontFamily: "'JetBrains Mono',monospace" }}>₹{Math.round((totalIncome-totalExpend)/1000)}K</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 12, color: '#64748b' }}>
            <div>Income: ₹{Math.round(totalIncome/1000)}K</div>
            <div>Expend: ₹{Math.round(totalExpend/1000)}K</div>
          </div>
        </div>
      </div>
    </div>
  );
}
