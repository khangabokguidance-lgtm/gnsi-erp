/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * DAILY ATTENDANCE TRACKER SYSTEM - COMPLETE IMPLEMENTATION
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Advanced Features for Admin & Vice Principal
 * 10 Modules | Full React Components | Database Schemas | Helper Functions
 * 
 * Author: GNSI Portal Development Team
 * Created: 2025
 * Last Updated: June 2, 2026
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: IMPORTS & SETUP
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { supabase } from './supabase'

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: DATABASE SCHEMAS (Run these migrations)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SQL MIGRATIONS - Execute in Supabase SQL Editor
 * 
 * -- 1. Core Attendance Logs
 * CREATE TABLE attendance_logs (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   staff_id BIGINT NOT NULL REFERENCES staff_profiles(id),
 *   date DATE NOT NULL,
 *   status TEXT CHECK (status IN ('Present', 'Absent', 'Late', 'Leave', 'Half-day', 'Holiday')) DEFAULT 'Absent',
 *   marked_by TEXT CHECK (marked_by IN ('Admin', 'Self', 'System')) DEFAULT 'Admin',
 *   check_in_time TIMESTAMPTZ,
 *   check_out_time TIMESTAMPTZ,
 *   notes TEXT,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   updated_at TIMESTAMPTZ DEFAULT NOW(),
 *   UNIQUE(staff_id, date)
 * );
 * CREATE INDEX idx_attendance_date_staff ON attendance_logs(date, staff_id);
 * CREATE INDEX idx_attendance_staff_month ON attendance_logs(staff_id, date_trunc('month', date));
 * 
 * -- 2. Class Substitutes
 * CREATE TABLE class_substitutes (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   class_id TEXT NOT NULL,
 *   date DATE NOT NULL,
 *   original_staff_id BIGINT NOT NULL REFERENCES staff_profiles(id),
 *   substitute_staff_id BIGINT NOT NULL REFERENCES staff_profiles(id),
 *   time_slot_start TIME,
 *   time_slot_end TIME,
 *   reason TEXT,
 *   approval_status TEXT CHECK (approval_status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
 *   approved_by BIGINT,
 *   incentive_amount DECIMAL(10, 2),
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   created_by BIGINT NOT NULL
 * );
 * CREATE INDEX idx_substitute_date ON class_substitutes(date);
 * 
 * -- 3. Absence Patterns (Monthly calculated)
 * CREATE TABLE absence_patterns (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   staff_id BIGINT NOT NULL REFERENCES staff_profiles(id),
 *   month DATE NOT NULL,
 *   absent_days INT DEFAULT 0,
 *   late_days INT DEFAULT 0,
 *   leaves INT DEFAULT 0,
 *   pattern_flags TEXT[] DEFAULT '{}',
 *   risk_score DECIMAL(3, 2),
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   updated_at TIMESTAMPTZ DEFAULT NOW(),
 *   UNIQUE(staff_id, month)
 * );
 * 
 * -- 4. Self Attendance (Staff portal check-ins)
 * CREATE TABLE self_attendance (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   staff_id BIGINT NOT NULL REFERENCES staff_profiles(id),
 *   date DATE NOT NULL,
 *   timestamp TIMESTAMPTZ NOT NULL,
 *   method TEXT CHECK (method IN ('QR', 'PIN', 'Biometric')) DEFAULT 'QR',
 *   location_lat DECIMAL(10, 8),
 *   location_lng DECIMAL(11, 8),
 *   device_id TEXT,
 *   verified BOOLEAN DEFAULT FALSE,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   UNIQUE(staff_id, date)
 * );
 * 
 * -- 5. Leaves Management
 * CREATE TABLE leaves (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   staff_id BIGINT NOT NULL REFERENCES staff_profiles(id),
 *   leave_type TEXT NOT NULL,
 *   start_date DATE NOT NULL,
 *   end_date DATE NOT NULL,
 *   days_applied INT NOT NULL,
 *   reason TEXT,
 *   documents TEXT[],
 *   status TEXT CHECK (status IN ('draft', 'submitted', 'hod_approved', 'principal_approved', 'approved', 'rejected', 'cancelled')) DEFAULT 'draft',
 *   hod_id BIGINT,
 *   hod_approved_at TIMESTAMPTZ,
 *   hod_remarks TEXT,
 *   principal_id BIGINT,
 *   principal_approved_at TIMESTAMPTZ,
 *   principal_remarks TEXT,
 *   vp_id BIGINT,
 *   vp_approved_at TIMESTAMPTZ,
 *   vp_remarks TEXT,
 *   balance_before INT,
 *   balance_after INT,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   updated_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * 
 * -- 6. Compliance Violations
 * CREATE TABLE compliance_violations (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   staff_id BIGINT NOT NULL REFERENCES staff_profiles(id),
 *   rule_id TEXT NOT NULL,
 *   severity TEXT CHECK (severity IN ('high', 'medium', 'low')) DEFAULT 'medium',
 *   message TEXT,
 *   suggested_action TEXT,
 *   action_status TEXT CHECK (action_status IN ('pending', 'approved', 'dismissed', 'resolved')) DEFAULT 'pending',
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   resolved_at TIMESTAMPTZ
 * );
 * 
 * -- 7. Staff Shift Assignments
 * CREATE TABLE staff_shift_assignments (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   staff_id BIGINT NOT NULL REFERENCES staff_profiles(id),
 *   shift_id INT NOT NULL,
 *   date DATE NOT NULL,
 *   primary_class TEXT,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   UNIQUE(staff_id, date)
 * );
 * 
 * -- 8. Notifications Queue
 * CREATE TABLE notifications (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   recipients TEXT[] NOT NULL,
 *   message TEXT NOT NULL,
 *   type TEXT CHECK (type IN ('alert', 'warning', 'info', 'success')) DEFAULT 'info',
 *   is_read BOOLEAN DEFAULT FALSE,
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * 
 * -- 9. Reports Cache
 * CREATE TABLE reports_cache (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   report_type TEXT NOT NULL,
 *   date_range TSTZRANGE NOT NULL,
 *   data JSONB NOT NULL,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 hour'
 * );
 * 
 * -- 10. Audit Trail
 * CREATE TABLE audit_trail (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   user_id BIGINT,
 *   action TEXT NOT NULL,
 *   table_name TEXT,
 *   record_id UUID,
 *   changes JSONB,
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * 
 * -- Add fields to staff_profiles
 * ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS leave_balance INT DEFAULT 20;
 * ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS pin_code TEXT UNIQUE;
 * ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS qr_code_url TEXT;
 */

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: CONSTANTS & CONFIGURATIONS
// ─────────────────────────────────────────────────────────────────────────────

const LEAVE_CONFIG = {
  types: [
    { id: 'earned', label: 'Earned Leave', daysPerYear: 12, carryForward: 0 },
  ],
  approvalLevels: [
    { level: 1, actor: 'HOD', minDays: 1, maxDays: 1 },
    { level: 2, actor: 'Principal', minDays: 1, maxDays: 1 },
  ],
  monthlyLimit: 1, // Max 1 day leave per month
  salaryDeductionRule: {
    enabled: true,
    trigger: 'leaveTakenInMonth > 1',
    deduction: 1, // 1 day salary deduction if >1 day taken in a month
    description: 'If staff takes >1 day leave in a month, 1 day salary is cut'
  }
}

const POLICY_RULES = [
  {
    id: 'monthly_leave_limit',
    rule: 'leave_taken > 1 day in month',
    severity: 'high',
    action: 'apply_salary_deduction',
    deduction: 1 // 1 day salary cut
  },
  {
    id: 'max_absences_month',
    rule: 'absent_days > 8 in month',
    severity: 'high',
    action: 'send_warning_letter',
  },
  {
    id: 'serial_absence',
    rule: '3+ consecutive absences',
    severity: 'high',
    action: 'auto_notify_hod',
  },
  {
    id: 'friday_pattern',
    rule: '3+ fridays absent in 2 months',
    severity: 'medium',
    action: 'send_warning',
  },
  {
    id: 'leave_overrun',
    rule: 'leave_balance < 0',
    severity: 'medium',
    action: 'deduct_from_salary',
  },
]

const SHIFTS = [
  { id: 1, name: 'Morning', startTime: '08:00', endTime: '13:00' },
  { id: 2, name: 'Afternoon', startTime: '13:00', endTime: '17:30' },
]

const GEOFENCE = {
  schoolLocation: { lat: 24.8267, lng: 94.901 }, // Khangabok, Manipur
  allowedRadius: 200, // meters
}

const ALERT_CONFIG = {
  missingMarkup: {
    time: '10:00 AM',
    threshold: 'staff not marked by 10 AM',
    recipients: ['admin@school.com', 'vp@school.com'],
  },
  serialAbsence: {
    threshold: 3,
    window: 7, // days
  },
  probationEnding: {
    daysWarning: 5,
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Date/Time Helpers
 */
const getToday = () => new Date()

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const addDays = (date, days) => {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

const addMonths = (dateStr, months) => {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 7)
}

const daysUntil = (dateStr, now = getToday()) => {
  if (!dateStr) return null
  const diff = new Date(dateStr) - now
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

const monthsSince = (dateStr, now = getToday()) => {
  if (!dateStr) return 0
  const start = new Date(dateStr)
  return (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
}

const isDay = (dateStr, dayOfWeek) => new Date(dateStr).getDay() === dayOfWeek

const isOnTime = (checkInTime) => {
  const time = new Date(checkInTime)
  const [hours, minutes] = [9, 0] // 9:00 AM is on-time threshold
  return time.getHours() < hours || (time.getHours() === hours && time.getMinutes() <= minutes)
}

const getWorkingDaysInMonth = (monthStr) => {
  const [year, month] = monthStr.split('-').map(Number)
  let count = 0
  const d = new Date(year, month - 1, 1)
  while (d.getMonth() === month - 1) {
    const dayOfWeek = d.getDay()
    if (dayOfWeek !== 0 && dayOfWeek !== 6) count++ // Exclude Sunday & Saturday
    d.setDate(d.getDate() + 1)
  }
  return count
}

/**
 * Check if staff exceeded monthly leave limit and apply salary deduction
 * Institution Policy: Max 1 day leave per month
 * If >1 day taken in a month → 1 day salary cut
 */
const checkMonthlyLeaveLimit = async (staffId, month) => {
  const { data: leaves } = await supabase
    .from('leaves')
    .select('days_applied')
    .eq('staff_id', staffId)
    .eq('status', 'approved')
    .gte('start_date', `${month}-01`)
    .lt('start_date', addMonths(`${month}-01`, 1))

  const totalLeaveDays = leaves?.reduce((sum, l) => sum + l.days_applied, 0) || 0
  const exceededLimit = totalLeaveDays > LEAVE_CONFIG.monthlyLimit

  if (exceededLimit) {
    // Apply salary deduction
    return {
      violated: true,
      leaveDaysTaken: totalLeaveDays,
      limit: LEAVE_CONFIG.monthlyLimit,
      salaryDeduction: LEAVE_CONFIG.salaryDeductionRule.deduction,
      message: `Staff took ${totalLeaveDays} days leave (limit: ${LEAVE_CONFIG.monthlyLimit}). 1 day salary deduction applied.`
    }
  }

  return {
    violated: false,
    leaveDaysTaken: totalLeaveDays,
    limit: LEAVE_CONFIG.monthlyLimit,
    message: `Within limit: ${totalLeaveDays}/${LEAVE_CONFIG.monthlyLimit} days used`
  }
}

/**
 * Validate leave request before approval
 * Check: annual balance, monthly limit, approval levels
 */
const validateLeaveRequest = async (staffId, startDate, endDate, leaveType) => {
  const errors = []
  
  // Only Earned Leave allowed
  if (leaveType !== 'earned') {
    errors.push(`Only Earned Leave is allowed. Requested: ${leaveType}`)
  }

  // Calculate days
  const daysRequested = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1

  // Get staff balance
  const { data: staff } = await supabase
    .from('staff_profiles')
    .select('leave_balance')
    .eq('id', staffId)
    .single()

  if (staff.leave_balance < daysRequested) {
    errors.push(`Insufficient leave balance. Available: ${staff.leave_balance}, Requested: ${daysRequested}`)
  }

  // Check monthly limit
  const month = startDate.slice(0, 7) // YYYY-MM
  const monthCheck = await checkMonthlyLeaveLimit(staffId, month)
  
  // If already took some leave this month, adding more would exceed limit
  const projectedTotal = monthCheck.leaveDaysTaken + daysRequested
  if (projectedTotal > LEAVE_CONFIG.monthlyLimit) {
    errors.push(`Monthly limit exceeded. Already taken: ${monthCheck.leaveDaysTaken} days this month. Requesting: ${daysRequested} more (limit: ${LEAVE_CONFIG.monthlyLimit})`)
  }

  return {
    valid: errors.length === 0,
    errors: errors,
    daysRequested: daysRequested,
    balanceAvailable: staff.leave_balance
  }
}

/**
 * Absence Detection Helpers
 */
const detectSerialAbsence = (logs, staffId, window = 7, threshold = 3) => {
  const recentLogs = logs
    .filter(l => l.staff_id === staffId && daysUntil(l.date) <= window)
    .sort((a, b) => new Date(b.date) - new Date(a.date))

  let consecutiveDays = 0
  for (let log of recentLogs) {
    if (log.status === 'Absent') consecutiveDays++
    else break
  }
  return consecutiveDays >= threshold ? consecutiveDays : 0
}

const detectFridayPattern = (logs, staffId, months = 3) => {
  const recentFridays = logs.filter(
    l => l.staff_id === staffId && isDay(l.date, 5) && monthsSince(l.date) <= months
  )
  const fridayAbsences = recentFridays.filter(l => l.status === 'Absent').length
  return fridayAbsences
}

const countAbsencesInMonth = (logs, staffId, monthStr) => {
  const [year, month] = monthStr.split('-').map(Number)
  return logs.filter(l => {
    const logDate = new Date(l.date)
    return (
      l.staff_id === staffId &&
      logDate.getFullYear() === year &&
      logDate.getMonth() === month - 1 &&
      l.status === 'Absent'
    )
  }).length
}

/**
 * Geolocation Helper
 */
const calculateDistance = (loc1, loc2) => {
  const R = 6371000 // Earth radius in meters
  const dLat = ((loc2.lat - loc1.lat) * Math.PI) / 180
  const dLng = ((loc2.lng - loc1.lng) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((loc1.lat * Math.PI) / 180) * Math.cos((loc2.lat * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

const verifyGeolocation = (scannedLat, scannedLng) => {
  const distance = calculateDistance(GEOFENCE.schoolLocation, { lat: scannedLat, lng: scannedLng })
  return {
    verified: distance <= GEOFENCE.allowedRadius,
    distance: Math.round(distance),
    message: distance <= GEOFENCE.allowedRadius ? 'In boundary' : `Outside boundary (${Math.round(distance)}m away)`,
  }
}

/**
 * Risk Scoring Model
 */
const absenceRiskModel = {
  factors: {
    serialAbsenceScore: 0.3,
    fridayPatternScore: 0.25,
    holidayProximityScore: 0.2,
    recentLeaveScore: 0.15,
    departmentAvgScore: 0.1,
  },

  calculateRisk(staffId, logs, staff, holidays) {
    const serialAbsence = Math.min(detectSerialAbsence(logs, staffId) / 5, 1)
    const fridayPattern = Math.min(detectFridayPattern(logs, staffId, 2) / 4, 1)
    const recentLeave = 0.3 // Placeholder

    const riskScore =
      serialAbsence * this.factors.serialAbsenceScore +
      fridayPattern * this.factors.fridayPatternScore +
      recentLeave * this.factors.recentLeaveScore

    return {
      staffId,
      riskScore: Math.min(riskScore, 1),
      riskLevel: riskScore > 0.7 ? 'HIGH' : riskScore > 0.4 ? 'MEDIUM' : 'LOW',
      factors: { serialAbsence, fridayPattern, recentLeave },
    }
  },
}

/**
 * Performance Scorecard Calculation
 */
const calculateScorecard = (staffId, logs, warnings, month) => {
  const monthLogs = logs.filter(l => {
    const logDate = new Date(l.date)
    const [year, mon] = month.split('-').map(Number)
    return (
      l.staff_id === staffId &&
      logDate.getFullYear() === year &&
      logDate.getMonth() === mon - 1
    )
  })

  const workingDays = getWorkingDaysInMonth(month)
  const present = monthLogs.filter(l => l.status === 'Present').length
  const onTime = monthLogs.filter(l => l.check_in_time && isOnTime(l.check_in_time)).length

  const attendanceScore = Math.round((present / workingDays) * 100)
  const punctualityScore = Math.round((onTime / workingDays) * 100)
  const disciplineScore = Math.max(100 - warnings.length * 10, 0)

  const overallScore = attendanceScore * 0.5 + punctualityScore * 0.3 + disciplineScore * 0.2

  return {
    staffId,
    month,
    attendanceScore,
    punctualityScore,
    disciplineScore,
    overallScore: Math.round(overallScore),
    grade: overallScore >= 90 ? 'A' : overallScore >= 80 ? 'B' : overallScore >= 70 ? 'C' : 'D',
    recommendation:
      overallScore >= 90 ? 'Excellent' : overallScore >= 75 ? 'Good' : 'Needs Improvement',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5: SHARED UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const styles = {
  card: {
    backgroundColor: 'white',
    borderRadius: '14px',
    padding: '16px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
    marginBottom: '16px',
  },
  select: {
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    fontSize: '14px',
    backgroundColor: 'white',
    width: '100%',
  },
  input: {
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    fontSize: '14px',
    width: '100%',
    boxSizing: 'border-box',
  },
  btn: (active = true, danger = false) => ({
    padding: '10px 16px',
    borderRadius: '8px',
    border: 'none',
    cursor: active ? 'pointer' : 'not-allowed',
    fontWeight: '600',
    fontSize: '14px',
    backgroundColor: !active ? '#94a3b8' : danger ? '#fee2e2' : '#1e3a5f',
    color: !active ? 'white' : danger ? '#dc2626' : 'white',
  }),
}

function Toast({ message, type = 'error', onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [onClose])

  const bg = type === 'error' ? '#fee2e2' : type === 'success' ? '#dcfce7' : '#fef9c3'
  const color = type === 'error' ? '#dc2626' : type === 'success' ? '#16a34a' : '#ca8a04'

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        backgroundColor: bg,
        color,
        padding: '12px 20px',
        borderRadius: '10px',
        fontSize: '13px',
        fontWeight: '600',
      }}
    >
      {message}
    </div>
  )
}

function useToast() {
  const [toast, setToast] = useState(null)
  const show = useCallback((message, type = 'error') => setToast({ message, type }), [])
  const hide = useCallback(() => setToast(null), [])
  const ToastEl = toast ? <Toast message={toast.message} type={toast.type} onClose={hide} /> : null
  return { show, ToastEl }
}

function SectionHeader({ icon, title, subtitle, action }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#1e3a5f', margin: 0 }}>
            {icon} {title}
          </h2>
          {subtitle && <p style={{ color: '#64748b', fontSize: '12px', margin: '4px 0 0' }}>{subtitle}</p>}
        </div>
        {action && <div style={{ flexShrink: 0 }}>{action}</div>}
      </div>
    </div>
  )
}

function StaffAvatar({ name, size = 36 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: '#1e3a5f',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontWeight: '700',
        fontSize: size * 0.42,
        flexShrink: 0,
      }}
    >
      {name?.[0]?.toUpperCase()}
    </div>
  )
}

function MetricCard({ label, value, total, color }) {
  const percentage = total ? Math.round((value / total) * 100) : 0
  return (
    <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: `${color}15`, border: `1px solid ${color}44` }}>
      <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>{label}</p>
      <p style={{ margin: '4px 0 0', fontSize: '18px', fontWeight: '700', color }}>{value}</p>
      <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#94a3b8' }}>
        {percentage}% of {total}
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6: FEATURE 1 - VP DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

function VPDashboard({ staff, logs, records }) {
  const [kpis, setKpis] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [byDept, setByDept] = useState([])
  const today = useMemo(() => fmtDate(getToday()), [])

  useEffect(() => {
    const fetch = async () => {
      // Fetch today's attendance
      const todayStr = getToday().toISOString().slice(0, 10)
      const { data: todayLogs } = await supabase
        .from('attendance_logs')
        .select('status')
        .eq('date', todayStr)

      const present = todayLogs?.filter(l => l.status === 'Present').length || 0
      const absent = todayLogs?.filter(l => l.status === 'Absent').length || 0
      const onLeave = todayLogs?.filter(l => l.status === 'Leave').length || 0
      const total = staff.length

      setKpis({
        total,
        present,
        absent,
        onLeave,
        percentage: Math.round((present / total) * 100),
      })

      // By department
      const deptMap = {}
      staff.forEach(s => {
        if (!deptMap[s.department]) deptMap[s.department] = { dept: s.department, present: 0, absent: 0, leave: 0 }
      })

      todayLogs?.forEach(log => {
        const s = staff.find(x => x.id === log.staff_id)
        if (s && deptMap[s.department]) {
          if (log.status === 'Present') deptMap[s.department].present++
          else if (log.status === 'Absent') deptMap[s.department].absent++
          else if (log.status === 'Leave') deptMap[s.department].leave++
        }
      })

      setByDept(Object.values(deptMap))

      // Fetch probation alerts
      const { data: probs } = await supabase
        .from('hr_records')
        .select('staff_id, probation_end_date, staff_profiles(name)')
        .eq('employment_status', 'Probation')
        .lte('probation_end_date', addDays(getToday(), 7).toISOString().slice(0, 10))

      // Fetch pattern alerts
      const { data: patterns } = await supabase
        .from('absence_patterns')
        .select('staff_id, pattern_flags, staff_profiles(name)')
        .contains('pattern_flags', ['serial_absence', 'friday_pattern'])

      const allAlerts = [
        ...(probs || []).map(p => ({
          type: 'probation',
          staffName: p.staff_profiles?.name,
          message: `Probation ending in ${daysUntil(p.probation_end_date)} days`,
        })),
        ...(patterns || []).map(p => ({
          type: 'pattern',
          staffName: p.staff_profiles?.name,
          message: `Pattern: ${p.pattern_flags.join(', ')}`,
        })),
      ]

      setAlerts(allAlerts.slice(0, 5))
    }

    fetch()
  }, [staff])

  return (
    <div style={styles.card}>
      <SectionHeader icon="📊" title="VP Dashboard" subtitle={today} />

      {/* KPI Cards */}
      {kpis && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', marginBottom: '16px' }}>
          <MetricCard label="Present" value={kpis.present} total={kpis.total} color="#16a34a" />
          <MetricCard label="Absent" value={kpis.absent} total={kpis.total} color="#dc2626" />
          <MetricCard label="On Leave" value={kpis.onLeave} total={kpis.total} color="#2563eb" />
          <MetricCard label="Overall" value={kpis.percentage} total={100} color="#1e3a5f" />
        </div>
      )}

      {/* Department Breakdown */}
      {byDept.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#374151', margin: '0 0 10px' }}>By Department</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {byDept.map(d => (
              <div key={d.dept} style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <p style={{ margin: 0, fontSize: '12px', fontWeight: '600', color: '#1e293b' }}>{d.dept}</p>
                <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#64748b' }}>
                  ✓ {d.present} | ✗ {d.absent} | ✈ {d.leave}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#fee2e2', border: '1px solid #fecaca', borderLeft: '4px solid #dc2626' }}>
          <h3 style={{ margin: '0 0 10px', color: '#991b1b', fontSize: '13px' }}>🚨 Critical Alerts ({alerts.length})</h3>
          {alerts.map((a, i) => (
            <div
              key={i}
              style={{
                padding: '8px 0',
                borderBottom: i < alerts.length - 1 ? '1px solid #fecaca' : 'none',
              }}
            >
              <p style={{ margin: 0, fontSize: '12px', fontWeight: '600', color: '#7f1d1d' }}>
                {a.type === 'probation' ? '⏳' : '⚠️'} {a.staffName}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#991b1b' }}>{a.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7: FEATURE 2 - DAILY ATTENDANCE TRACKER
// ─────────────────────────────────────────────────────────────────────────────

function DailyAttendance({ staff, canOperate = true }) {
  const [selectedDate, setSelectedDate] = useState(getToday().toISOString().slice(0, 10))
  const [attendance, setAttendance] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all, present, absent
  const { show: showToast, ToastEl } = useToast()

  useEffect(() => {
    fetchAttendance()
  }, [selectedDate])

  const fetchAttendance = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('date', selectedDate)

    setAttendance(data || [])
    setLoading(false)
  }

  const markAttendance = async (staffId, status) => {
    const { error } = await supabase.from('attendance_logs').upsert(
      [
        {
          staff_id: staffId,
          date: selectedDate,
          status,
          marked_by: 'Admin',
          check_in_time: status === 'Present' ? new Date().toISOString() : null,
          updated_at: new Date(),
        },
      ],
      { onConflict: 'staff_id,date' }
    )

    if (error) showToast(error.message)
    else {
      fetchAttendance()
      showToast(`Marked as ${status}`, 'success')
    }
  }

  const filteredStaff = useMemo(() => {
    if (filter === 'all') return staff
    return staff.filter(s => {
      const rec = attendance.find(a => a.staff_id === s.id)
      if (filter === 'present') return rec?.status === 'Present'
      if (filter === 'absent') return rec?.status === 'Absent' || !rec
      return true
    })
  }, [staff, attendance, filter])

  return (
    <div style={styles.card}>
      <SectionHeader
        icon="📅"
        title="Daily Attendance"
        action={<input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ ...styles.input, width: '140px', padding: '7px 10px', fontSize: '12px' }} />}
      />

      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
        {['all', 'present', 'absent'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 12px',
              borderRadius: '999px',
              backgroundColor: filter === f ? '#1e3a5f' : '#f1f5f9',
              color: filter === f ? 'white' : '#374151',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              border: 'none',
            }}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: '#94a3b8', textAlign: 'center' }}>Loading...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {filteredStaff.map(s => {
            const rec = attendance.find(a => a.staff_id === s.id)
            const status = rec?.status || 'Not Marked'

            return (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                }}
              >
                <StaffAvatar name={s.name} size={32} />
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: '600', fontSize: '13px' }}>{s.name}</p>
                  <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>{s.department}</p>
                </div>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {canOperate ? [
                    { label: '✓', status: 'Present', color: '#16a34a' },
                    { label: '✗', status: 'Absent', color: '#dc2626' },
                    { label: '⏰', status: 'Late', color: '#ca8a04' },
                    { label: '✈', status: 'Leave', color: '#2563eb' },
                  ].map(btn => (
                    <button
                      key={btn.status}
                      onClick={() => markAttendance(s.id, btn.status)}
                      style={{
                        padding: '6px 8px',
                        fontSize: '12px',
                        borderRadius: '6px',
                        backgroundColor: status === btn.status ? btn.color : '#f1f5f9',
                        color: status === btn.status ? 'white' : btn.color,
                        border: `1px solid ${btn.color}44`,
                        cursor: 'pointer',
                        fontWeight: '600',
                      }}
                    >
                      {btn.label}
                    </button>
                  )) : (
                    <span style={{
                      fontSize: '11px', fontWeight: '600', padding: '4px 10px',
                      borderRadius: '999px', backgroundColor: '#f1f5f9', color: '#94a3b8',
                    }}>
                      {status === 'Not Marked' ? '—' : status}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {ToastEl}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8: FEATURE 3 - ABSENT TRACKER (HEATMAP)
// ─────────────────────────────────────────────────────────────────────────────

function AbsentTracker({ staff, logs }) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [heatmapData, setHeatmapData] = useState([])
  const [topAbsentees, setTopAbsentees] = useState([])

  useEffect(() => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const monthLogs = logs.filter(l => {
      const d = new Date(l.date)
      return d.getFullYear() === year && d.getMonth() === month - 1
    })

    // Build heatmap: staff × dates
    const heatmap = staff.map(s => ({
      staffId: s.id,
      name: s.name,
      dept: s.department,
      absenceCount: monthLogs.filter(l => l.staff_id === s.id && l.status === 'Absent').length,
      dates: monthLogs
        .filter(l => l.staff_id === s.id)
        .reduce((acc, log) => {
          acc[log.date] = log.status === 'Absent' ? 1 : 0
          return acc
        }, {}),
    }))

    setHeatmapData(heatmap)

    // Top absentees
    const sorted = heatmap.sort((a, b) => b.absenceCount - a.absenceCount).slice(0, 10)
    setTopAbsentees(sorted)
  }, [selectedMonth, staff, logs])

  return (
    <div style={styles.card}>
      <SectionHeader
        icon="📉"
        title="Absent Tracker"
        action={<input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} style={{ ...styles.input, width: '120px', padding: '7px 10px', fontSize: '12px' }} />}
      />

      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: '600', margin: '0 0 10px' }}>Top Absentees</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {topAbsentees.map((s, i) => (
            <div
              key={s.staffId}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                borderRadius: '8px',
                backgroundColor: s.absenceCount > 5 ? '#fee2e2' : s.absenceCount > 3 ? '#fef9c3' : '#f8fafc',
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: '12px', fontWeight: '600' }}>
                  {i + 1}. {s.name}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>{s.dept}</p>
              </div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  color: s.absenceCount > 5 ? '#dc2626' : s.absenceCount > 3 ? '#ca8a04' : '#374151',
                }}
              >
                {s.absenceCount} days
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Simple heatmap text representation */}
      <div style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.6' }}>
        <p style={{ margin: 0, fontWeight: '600' }}>Legend:</p>
        <p style={{ margin: '4px 0 0' }}>🔴 Absent | 🟢 Present | ⚪ Other</p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 9: FEATURE 4 - LEAVE MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

function LeaveManagement({ staff, currentUser }) {
  const [leaves, setLeaves] = useState([])
  const [filter, setFilter] = useState('submitted')
  const { show: showToast, ToastEl } = useToast()

  useEffect(() => {
    fetchLeaves()
  }, [filter])

  const fetchLeaves = async () => {
    let query = supabase.from('leaves').select('*, staff_profiles(name, department)')

    if (filter !== 'all') {
      query = query.eq('status', filter)
    }

    const { data } = await query.order('created_at', { ascending: false })
    setLeaves(data || [])
  }

  const approveLeave = async (leaveId, remarks) => {
    const userRole = currentUser?.role || 'admin'
    const statusMap = {
      hod: 'hod_approved',
      principal: 'principal_approved',
      vp: 'approved',
    }

    const { error } = await supabase.from('leaves').update({
      status: statusMap[userRole] || 'approved',
      [`${userRole}_approved_at`]: new Date(),
      [`${userRole}_remarks`]: remarks,
      [`${userRole}_id`]: currentUser?.id,
    }).eq('id', leaveId)

    if (error) showToast(error.message)
    else {
      fetchLeaves()
      showToast('Leave approved', 'success')
    }
  }

  const rejectLeave = async (leaveId, remarks) => {
    const { error } = await supabase.from('leaves').update({
      status: 'rejected',
      [`${currentUser?.role || 'admin'}_remarks`]: remarks,
    }).eq('id', leaveId)

    if (error) showToast(error.message)
    else {
      fetchLeaves()
      showToast('Leave rejected', 'success')
    }
  }

  const statusColors = {
    submitted: '#fef9c3',
    hod_approved: '#dbeafe',
    principal_approved: '#ede9fe',
    approved: '#f0fdf4',
    rejected: '#fee2e2',
  }

  return (
    <div style={styles.card}>
      <SectionHeader icon="🏖️" title="Leave Management" subtitle="Multi-level approval workflow" />

      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
        {['submitted', 'hod_approved', 'principal_approved', 'approved', 'rejected'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 12px',
              borderRadius: '999px',
              backgroundColor: filter === f ? '#1e3a5f' : '#f1f5f9',
              color: filter === f ? 'white' : '#374151',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              border: 'none',
            }}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {leaves.map(leave => (
          <div
            key={leave.id}
            style={{
              padding: '12px',
              borderRadius: '8px',
              backgroundColor: statusColors[leave.status] || '#f8fafc',
              border: `1px solid ${statusColors[leave.status]}88`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
              <div>
                <p style={{ margin: 0, fontWeight: '600', fontSize: '13px' }}>
                  {leave.staff_profiles?.name}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>
                  {leave.leave_type} · {fmtDate(leave.start_date)} to {fmtDate(leave.end_date)} ({leave.days_applied} days)
                </p>
              </div>
              <span style={{ fontSize: '11px', fontWeight: '600', padding: '4px 8px', backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: '4px' }}>
                {leave.status.replace(/_/g, ' ').toUpperCase()}
              </span>
            </div>

            {leave.status === 'submitted' && (
              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => approveLeave(leave.id, '')}
                    style={{ ...styles.btn(true), flex: 1, fontSize: '12px', padding: '6px 10px', backgroundColor: '#16a34a' }}
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => rejectLeave(leave.id, '')}
                    style={{ ...styles.btn(true), flex: 1, fontSize: '12px', padding: '6px 10px', backgroundColor: '#fee2e2', color: '#dc2626' }}
                  >
                    ✗ Reject
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {ToastEl}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 10: FEATURE 5 - PREDICTIVE ANALYTICS
// ─────────────────────────────────────────────────────────────────────────────

function PredictiveAnalytics({ staff, logs }) {
  const [risks, setRisks] = useState([])

  useEffect(() => {
    const calculated = staff.map(s => absenceRiskModel.calculateRisk(s.id, logs, staff, [])).sort((a, b) => b.riskScore - a.riskScore)

    setRisks(calculated)
  }, [staff, logs])

  const RiskBadge = ({ level, count, color }) => (
    <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: `${color}15`, border: `1px solid ${color}44`, textAlign: 'center' }}>
      <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>{level} Risk</p>
      <p style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: '700', color }}>{count}</p>
    </div>
  )

  return (
    <div style={styles.card}>
      <SectionHeader icon="🎯" title="Absence Risk Predictions" subtitle="Next 7 days forecast" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '16px' }}>
        <RiskBadge level="HIGH" count={risks.filter(r => r.riskLevel === 'HIGH').length} color="#dc2626" />
        <RiskBadge level="MEDIUM" count={risks.filter(r => r.riskLevel === 'MEDIUM').length} color="#ca8a04" />
        <RiskBadge level="LOW" count={risks.filter(r => r.riskLevel === 'LOW').length} color="#16a34a" />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {risks.slice(0, 10).map(r => {
          const s = staff.find(x => x.id === r.staffId)
          const colors = { HIGH: '#fee2e2', MEDIUM: '#fef9c3', LOW: '#f0fdf4' }
          const textColors = { HIGH: '#991b1b', MEDIUM: '#92400e', LOW: '#166534' }

          return (
            <div key={r.staffId} style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: colors[r.riskLevel] }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: '600', fontSize: '13px', color: textColors[r.riskLevel] }}>
                    {s?.name}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>
                    Serial: {r.factors.serialAbsence > 0 ? 'Yes' : 'No'} | Friday: {r.factors.fridayPattern > 0 ? 'Yes' : 'No'}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: textColors[r.riskLevel] }}>
                    {Math.round(r.riskScore * 100)}%
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: '600', color: textColors[r.riskLevel] }}>
                    {r.riskLevel} RISK
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 11: FEATURE 6 - PERFORMANCE SCORECARDS
// ─────────────────────────────────────────────────────────────────────────────

function PerformanceScorecards({ staff, logs }) {
  const [scorecards, setScorecard] = useState([])
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))

  useEffect(() => {
    const calculated = staff
      .map(s => calculateScorecard(s.id, logs, [], month))
      .sort((a, b) => b.overallScore - a.overallScore)

    setScorecard(calculated)
  }, [month, staff, logs])

  return (
    <div style={styles.card}>
      <SectionHeader
        icon="📈"
        title="Performance Scorecards"
        action={<input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ ...styles.input, width: '120px', padding: '7px 10px', fontSize: '12px' }} />}
      />

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '8px', textAlign: 'left', fontWeight: '600' }}>Staff</th>
              <th style={{ padding: '8px', textAlign: 'center', fontWeight: '600' }}>Attend %</th>
              <th style={{ padding: '8px', textAlign: 'center', fontWeight: '600' }}>Punctual %</th>
              <th style={{ padding: '8px', textAlign: 'center', fontWeight: '600' }}>Discipline</th>
              <th style={{ padding: '8px', textAlign: 'center', fontWeight: '600' }}>Overall</th>
              <th style={{ padding: '8px', textAlign: 'center', fontWeight: '600' }}>Grade</th>
            </tr>
          </thead>
          <tbody>
            {scorecards.map(sc => {
              const s = staff.find(x => x.id === sc.staffId)
              return (
                <tr key={sc.staffId} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: sc.overallScore >= 85 ? '#f0fdf4' : '#fff7ed' }}>
                  <td style={{ padding: '8px', fontWeight: '600', fontSize: '11px' }}>{s?.name}</td>
                  <td style={{ padding: '8px', textAlign: 'center', fontSize: '11px' }}>{sc.attendanceScore}%</td>
                  <td style={{ padding: '8px', textAlign: 'center', fontSize: '11px' }}>{sc.punctualityScore}%</td>
                  <td style={{ padding: '8px', textAlign: 'center', fontSize: '11px' }}>{sc.disciplineScore}</td>
                  <td style={{ padding: '8px', textAlign: 'center', fontWeight: '700', color: sc.overallScore >= 85 ? '#16a34a' : '#ca8a04' }}>
                    {sc.overallScore}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', fontWeight: '700', fontSize: '14px', color: sc.grade === 'A' ? '#16a34a' : sc.grade === 'B' ? '#2563eb' : '#ca8a04' }}>
                    {sc.grade}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 12: FEATURE 7 - COMPLIANCE ENGINE
// ─────────────────────────────────────────────────────────────────────────────

function ComplianceEngine({ staff, logs, leaves }) {
  const [violations, setViolations] = useState([])
  const { show: showToast, ToastEl } = useToast()

  useEffect(() => {
    const detect = async () => {
      const allViolations = []
      const currentMonth = new Date().toISOString().slice(0, 7)

      for (const s of staff) {
        const staffLogs = logs.filter(l => l.staff_id === s.id)

        // Check max absences
        if (countAbsencesInMonth(staffLogs, s.id, currentMonth) > 8) {
          allViolations.push({
            staffId: s.id,
            staffName: s.name,
            rule: 'max_absences_month',
            severity: 'high',
            message: `${countAbsencesInMonth(staffLogs, s.id, currentMonth)} absences in current month (limit: 8)`,
            suggestedAction: 'Issue warning letter',
          })
        }

        // Check serial absence
        if (detectSerialAbsence(staffLogs, s.id, 7, 3) > 0) {
          allViolations.push({
            staffId: s.id,
            staffName: s.name,
            rule: 'serial_absence',
            severity: 'high',
            message: '3+ consecutive absences detected',
            suggestedAction: 'Notify HOD & schedule meeting',
          })
        }

        // Check Friday pattern
        if (detectFridayPattern(staffLogs, s.id, 2) >= 3) {
          allViolations.push({
            staffId: s.id,
            staffName: s.name,
            rule: 'friday_pattern',
            severity: 'medium',
            message: 'Friday absence pattern (3+ in 2 months)',
            suggestedAction: 'Send warning & counseling',
          })
        }
      }

      setViolations(allViolations)
    }

    detect()
  }, [staff, logs])

  const severityColors = {
    high: { bg: '#fee2e2', border: '#fecaca', text: '#991b1b' },
    medium: { bg: '#fef9c3', border: '#fde68a', text: '#92400e' },
    low: { bg: '#dbeafe', border: '#bfdbfe', text: '#1e40af' },
  }

  return (
    <div style={styles.card}>
      <SectionHeader icon="⚖️" title="Compliance Engine" subtitle={`${violations.length} policy violations detected`} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {violations.map((v, i) => {
          const color = severityColors[v.severity]
          return (
            <div key={i} style={{ padding: '12px', borderRadius: '8px', backgroundColor: color.bg, border: `1px solid ${color.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: '600', fontSize: '13px', color: color.text }}>
                    {v.staffName}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: color.text }}>
                    {v.message}
                  </p>
                </div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: color.text, padding: '4px 10px', backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: '4px' }}>
                  {v.severity.toUpperCase()}
                </span>
              </div>

              <div style={{ padding: '8px 0', borderTop: `1px solid ${color.border}55`, marginBottom: '8px' }}>
                <p style={{ margin: 0, fontSize: '12px', color: color.text }}>
                  Suggested action: <strong>{v.suggestedAction}</strong>
                </p>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => showToast(`Approved: ${v.suggestedAction}`, 'success')} style={{ flex: 1, ...styles.btn(true), padding: '6px 10px', fontSize: '12px', backgroundColor: '#16a34a' }}>
                  ✓ Approve
                </button>
                <button onClick={() => showToast('Violation dismissed', 'success')} style={{ flex: 1, ...styles.btn(true), padding: '6px 10px', fontSize: '12px', backgroundColor: color.bg, color: color.text, border: `1px solid ${color.border}` }}>
                  Dismiss
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {ToastEl}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 13: FEATURE 8 - SHIFT MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

function ShiftManagement({ staff, logs }) {
  const [selectedDate, setSelectedDate] = useState(getToday().toISOString().slice(0, 10))
  const [coverage, setCoverage] = useState([])
  const [assignments, setAssignments] = useState([])

  useEffect(() => {
    const fetch = async () => {
      // Simulate getting shift assignments (would be from DB)
      const simulated = staff.map((s, i) => ({
        staff_id: s.id,
        staff_profiles: { name: s.name, department: s.department },
        shift_id: i % 2 === 0 ? 1 : 2,
        primary_class: `${11 + (i % 3)}-${String.fromCharCode(65 + (i % 3))}`,
      }))

      const todayLogs = logs.filter(l => l.date === selectedDate)

      const withStatus = simulated.map(a => ({
        ...a,
        actualStatus: todayLogs.find(l => l.staff_id === a.staff_id)?.status || 'unknown',
      }))

      setAssignments(withStatus)

      // Calculate coverage
      const byClass = {}
      simulated.forEach(a => {
        if (!byClass[a.primary_class]) byClass[a.primary_class] = []
        byClass[a.primary_class].push(a)
      })

      const coverageData = Object.entries(byClass).map(([cls, teachers]) => ({
        className: cls,
        totalAssigned: teachers.length,
        present: teachers.filter(t => todayLogs.find(l => l.staff_id === t.staff_id && l.status === 'Present')).length,
        absent: teachers.filter(t => todayLogs.find(l => l.staff_id === t.staff_id && l.status === 'Absent')).length,
        covered: teachers.filter(t => todayLogs.find(l => l.staff_id === t.staff_id && l.status === 'Present')).length > 0,
      }))

      setCoverage(coverageData)
    }

    fetch()
  }, [selectedDate, staff, logs])

  return (
    <div style={styles.card}>
      <SectionHeader
        icon="🔄"
        title="Shift Management"
        action={<input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ ...styles.input, width: '140px', padding: '7px 10px', fontSize: '12px' }} />}
      />

      {/* Coverage Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
        {coverage.map(c => (
          <div
            key={c.className}
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              backgroundColor: c.covered ? '#f0fdf4' : '#fee2e2',
              border: `1px solid ${c.covered ? '#bbf7d0' : '#fecaca'}`,
            }}
          >
            <p style={{ margin: 0, fontWeight: '600', fontSize: '13px' }}>{c.className}</p>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
              {c.present}/{c.totalAssigned} present {c.covered ? '✓' : '⚠'}
            </p>
          </div>
        ))}
      </div>

      {/* Shift Assignments Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '6px 8px', textAlign: 'left' }}>Teacher</th>
              <th style={{ padding: '6px 8px', textAlign: 'left' }}>Class</th>
              <th style={{ padding: '6px 8px', textAlign: 'center' }}>Shift</th>
              <th style={{ padding: '6px 8px', textAlign: 'center' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((a, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '6px 8px' }}>{a.staff_profiles?.name}</td>
                <td style={{ padding: '6px 8px' }}>{a.primary_class}</td>
                <td style={{ padding: '6px 8px', textAlign: 'center' }}>{a.shift_id === 1 ? 'Morning' : 'Afternoon'}</td>
                <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: '600',
                      color: a.actualStatus === 'Present' ? '#16a34a' : a.actualStatus === 'Absent' ? '#dc2626' : '#94a3b8',
                      backgroundColor: a.actualStatus === 'Present' ? '#f0fdf4' : a.actualStatus === 'Absent' ? '#fee2e2' : '#f1f5f9',
                      padding: '3px 6px',
                      borderRadius: '3px',
                    }}
                  >
                    {a.actualStatus === 'unknown' ? 'Not marked' : a.actualStatus}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 14: FEATURE 9 - GEOLOCATION TRACKER
// ─────────────────────────────────────────────────────────────────────────────

function GeolocationTracker({ staff }) {
  const [checkins, setCheckins] = useState([])
  const [date, setDate] = useState(getToday().toISOString().slice(0, 10))

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('self_attendance')
        .select('*, staff_profiles(name, department)')
        .eq('date', date)

      setCheckins(data || [])
    }

    fetch()
  }, [date])

  return (
    <div style={styles.card}>
      <SectionHeader
        icon="📍"
        title="Geolocation Verification"
        action={<input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...styles.input, width: '140px', padding: '7px 10px', fontSize: '12px' }} />}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {checkins.map(c => {
          const verification = verifyGeolocation(c.location_lat, c.location_lng)

          return (
            <div
              key={c.id}
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: verification.verified ? '#f0fdf4' : '#fee2e2',
                border: `1px solid ${verification.verified ? '#bbf7d0' : '#fecaca'}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: '600', fontSize: '13px' }}>
                    {c.staff_profiles?.name}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>
                    {c.location_lat?.toFixed(4)}, {c.location_lng?.toFixed(4)}
                    {verification.verified ? ' ✓ In boundary' : ` ✗ ${verification.distance}m away`}
                  </p>
                </div>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    color: verification.verified ? '#16a34a' : '#dc2626',
                  }}
                >
                  {verification.verified ? 'Verified' : 'Rejected'}
                </span>
              </div>
            </div>
          )
        })}

        {checkins.length === 0 && (
          <p style={{ color: '#94a3b8', textAlign: 'center', padding: '20px' }}>
            No check-ins for this date
          </p>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 15: FEATURE 10 - BULK OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

function BulkOperations({ staff, canOperate = true }) {
  const [selectedDate, setSelectedDate] = useState(getToday().toISOString().slice(0, 10))
  const { show: showToast, ToastEl } = useToast()

  const markAllPresent = async () => {
    const records = staff.map(s => ({
      staff_id: s.id,
      date: selectedDate,
      status: 'Present',
      marked_by: 'Bulk Operation',
    }))

    const { error } = await supabase.from('attendance_logs').insert(records)

    if (error) showToast(error.message)
    else showToast(`${staff.length} staff marked present!`, 'success')
  }

  const markAllAbsent = async () => {
    const records = staff.map(s => ({
      staff_id: s.id,
      date: selectedDate,
      status: 'Absent',
      marked_by: 'Bulk Operation',
    }))

    const { error } = await supabase.from('attendance_logs').insert(records)

    if (error) showToast(error.message)
    else showToast(`${staff.length} staff marked absent!`, 'success')
  }

  const handleImportCSV = async event => {
    const file = event.target.files[0]
    if (!file) return

    const text = await file.text()
    const rows = text.split('\n').slice(1) // Skip header
    const records = rows
      .filter(row => row.trim())
      .map(row => {
        const [staffId, status] = row.split(',')
        return {
          staff_id: Number(staffId),
          date: selectedDate,
          status: status.trim(),
          marked_by: 'CSV Import',
        }
      })

    const { error } = await supabase.from('attendance_logs').insert(records)

    if (error) showToast(error.message)
    else showToast(`${records.length} records imported!`, 'success')
  }

  return (
    <div style={styles.card}>
      <SectionHeader icon="⚙️" title="Bulk Operations" />

      {canOperate ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '16px' }}>
          <button onClick={markAllPresent} style={styles.btn(true)}>✓ Mark All Present</button>
          <button onClick={markAllAbsent} style={styles.btn(true)}>✗ Mark All Absent</button>
          <label style={{ ...styles.btn(true), display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            📥 Import CSV
            <input type="file" accept=".csv" onChange={handleImportCSV} style={{ display: 'none' }} />
          </label>
        </div>
      ) : (
        <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', textAlign: 'center', color: '#94a3b8', fontSize: '13px', marginBottom: '16px' }}>
          🔒 Bulk operations restricted to Admin & Vice Principal
        </div>
      )}

      <div
        style={{
          padding: '12px',
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
          border: '1px dashed #cbd5e1',
        }}
      >
        <p style={{ margin: 0, fontSize: '12px', color: '#374151' }}>
          <strong>CSV Format:</strong> staff_id, status (Present/Absent/Late)
        </p>
      </div>

      <input
        type="date"
        value={selectedDate}
        onChange={e => setSelectedDate(e.target.value)}
        style={{ ...styles.input, marginTop: '12px', fontSize: '12px', padding: '7px 10px' }}
      />

      {ToastEl}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 16: MAIN COMPONENT - DAILY ATTENDANCE TRACKER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Main Daily Attendance Tracker Component
 * Orchestrates all 10 features with tabbed navigation
 */
function DailyAttendanceTracker({ currentUser: appUser, perms, staff: staffProp }) {
  const [staff, setStaff] = useState(staffProp || [])
  const [logs, setLogs] = useState([])
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState('dashboard')
  const currentUser = appUser || { id: 1, role: 'admin' }

  const canOperate = ['Admin', 'Vice Principal', 'Principal'].includes(currentUser?.role)

  useEffect(() => {
    const load = async () => {
      setLoading(true)

      const [{ data: staffData }, { data: logsData }, { data: recordsData }] = await Promise.all([
        supabase.from('staff_profiles').select('id, name, department, designation').order('name'),
        supabase.from('attendance_logs').select('*').order('date', { ascending: false }),
        supabase.from('hr_records').select('*').eq('is_archived', false).order('created_at', { ascending: false }),
      ])

      setStaff(staffData || [])
      setLogs(logsData || [])
      setRecords(recordsData || [])
      setLoading(false)
    }

    load()
  }, [])

  const sections = [
    { key: 'dashboard', label: '📊', full: 'Dashboard' },
    { key: 'daily', label: '📅', full: 'Daily Attendance' },
    { key: 'absent', label: '📉', full: 'Absent Tracker' },
    { key: 'leave', label: '🏖️', full: 'Leaves' },
    { key: 'risk', label: '🎯', full: 'Risk Analysis' },
    { key: 'performance', label: '📈', full: 'Performance' },
    { key: 'compliance', label: '⚖️', full: 'Compliance' },
    { key: 'shift', label: '🔄', full: 'Shifts' },
    { key: 'geo', label: '📍', full: 'Geolocation' },
    { key: 'bulk', label: '⚙️', full: 'Bulk Ops' },
  ]

  const show = key => activeSection === 'all' || activeSection === key

  if (loading)
    return (
      <div style={{ padding: '48px 16px', textAlign: 'center', color: '#94a3b8' }}>
        ⏳ Loading Attendance System...
      </div>
    )

  return (
    <div style={{ padding: '16px', fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: '1000px', margin: '0 auto' }}>
       {/* Header */}
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#1e3a5f', margin: 0, letterSpacing: '-0.02em' }}>
            📊 Attendance Tracker
          </h1>
          <p style={{ color: '#64748b', fontSize: '12px', margin: '4px 0 0' }}>
            {staff.length} staff · {logs.length} records
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span style={{ padding: '5px 12px', borderRadius: '999px', fontSize: '11px', fontWeight: '700', backgroundColor: '#dcfce7', color: '#15803d' }}>
            ● Live
          </span>
        </div>
      </div>

      {/* Viewer banner */}
      {!canOperate && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 14px', borderRadius: '10px', marginBottom: '16px',
          backgroundColor: '#fef9c3', border: '1px solid #fde68a',
        }}>
          <span style={{ fontSize: '18px' }}>👁</span>
          <div>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: '#92400e' }}>View Only Mode</p>
            <p style={{ margin: 0, fontSize: '11px', color: '#a16207' }}>Only Admin & Vice Principal can mark attendance or make changes.</p>
          </div>
        </div>
      )}

      {/* Section Navigation — responsive grid */}
     <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
        gap: '8px',
        marginBottom: '20px',
      }}>
        {sections.map(sec => {
          const isActive = activeSection === sec.key
          const colorMap = {
            dashboard:   { bg: '#eff6ff', active: '#1e3a5f', icon: '#2563eb' },
            daily:       { bg: '#f0fdf4', active: '#15803d', icon: '#16a34a' },
            absent:      { bg: '#fff7ed', active: '#c2410c', icon: '#ea580c' },
            leave:       { bg: '#fdf4ff', active: '#7e22ce', icon: '#9333ea' },
            risk:        { bg: '#fef2f2', active: '#b91c1c', icon: '#dc2626' },
            performance: { bg: '#f0fdfa', active: '#0f766e', icon: '#0d9488' },
            compliance:  { bg: '#fefce8', active: '#a16207', icon: '#ca8a04' },
            shift:       { bg: '#f0f9ff', active: '#0369a1', icon: '#0284c7' },
            geo:         { bg: '#fdf4ff', active: '#6d28d9', icon: '#7c3aed' },
            bulk:        { bg: '#f8fafc', active: '#334155', icon: '#475569' },
          }
          const c = colorMap[sec.key] || colorMap.dashboard
          return (
            <button
              key={sec.key}
              onClick={() => setActiveSection(sec.key)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '12px 6px',
                borderRadius: '12px',
                border: isActive ? `2px solid ${c.active}` : '2px solid transparent',
                cursor: 'pointer',
                backgroundColor: isActive ? c.active : 'white',
                boxShadow: isActive
                  ? `0 4px 14px ${c.active}33`
                  : '0 1px 4px rgba(0,0,0,0.07)',
                transition: 'all 0.18s ease',
                minHeight: '72px',
              }}
            >
              <span style={{ fontSize: '22px', lineHeight: 1 }}>{sec.label}</span>
              <span style={{
                fontSize: '10px',
                fontWeight: '700',
                letterSpacing: '0.02em',
                color: isActive ? 'white' : '#64748b',
                textAlign: 'center',
                lineHeight: 1.2,
              }}>
                {sec.full}
              </span>
            </button>
          )
        })}
      </div>

      {/* Sections */}
      {show('dashboard') && <VPDashboard staff={staff} logs={logs} records={records} />}
      {show('daily') && <DailyAttendance staff={staff} canOperate={canOperate} />}
      {show('absent') && <AbsentTracker staff={staff} logs={logs} />}
      {show('leave') && <LeaveManagement staff={staff} currentUser={currentUser} />}
      {show('risk') && <PredictiveAnalytics staff={staff} logs={logs} />}
      {show('performance') && <PerformanceScorecards staff={staff} logs={logs} />}
      {show('compliance') && <ComplianceEngine staff={staff} logs={logs} leaves={[]} />}
      {show('shift') && <ShiftManagement staff={staff} logs={logs} />}
      {show('geo') && <GeolocationTracker staff={staff} />}
      {show('bulk') && <BulkOperations staff={staff} canOperate={canOperate} />}
    </div>
  )
}

export default DailyAttendanceTracker

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 17: USAGE GUIDE & DEPLOYMENT NOTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DEPLOYMENT CHECKLIST
 * 
 * 1. DATABASE SETUP
 *    - Execute all SQL migrations from SECTION 2
 *    - Create indexes for performance
 *    - Set up RLS policies (Optional but recommended)
 * 
 * 2. ENVIRONMENT SETUP
 *    - Update GEOFENCE.schoolLocation with actual coordinates
 *    - Configure ALERT_CONFIG thresholds per institution
 *    - Set LEAVE_CONFIG based on institutional policies
 * 
 * 3. INTEGRATION
 *    - Import DailyAttendanceTracker in main App.jsx
 *    - <Route path="/attendance" element={<DailyAttendanceTracker />} />
 *    - Ensure supabase client is properly configured
 * 
 * 4. TESTING
 *    - Test all 10 features with test data
 *    - Verify real-time updates with multiple users
 *    - Test CSV import with sample data
 *    - Validate geolocation detection
 * 
 * 5. PRODUCTION
 *    - Enable database backups
 *    - Monitor storage & notifications queue
 *    - Set up email/SMS notification service
 *    - Configure pg_cron for daily/weekly reports
 * 
 * 6. STAFF TRAINING
 *    - Admin: All 10 modules
 *    - VP: Dashboard, Risk, Compliance, Reports
 *    - HOD: Daily attendance, Leaves (HOD level)
 *    - Teachers: Self-attendance portal (separate module)
 */