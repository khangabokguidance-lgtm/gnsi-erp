import { useState, useEffect, useCallback, useRef } from "react"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, Cell, PieChart, Pie,
  LineChart, Line, AreaChart, Area, RadarChart,
  Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ScatterChart, Scatter, ComposedChart, ReferenceLine,
  FunnelChart, Funnel, LabelList,
} from "recharts"
import { supabase } from "./supabase"

// ═══════════════════════════════════════════════════════════
// 🌟 LIGHT THEME — Heavy Graphics Palette
// ═══════════════════════════════════════════════════════════
const T = {
  // Base backgrounds — clean, airy, layered
  bg: "#f8fafc",
  bgElevated: "#ffffff",
  bgSurface: "#f1f5f9",
  bgGradient: "linear-gradient(135deg, #f0f9ff 0%, #f8fafc 50%, #fff7ed 100%)",

  // Primary accents — vibrant, saturated
  primary: "#2563eb",
  primaryLight: "#3b82f6",
  primarySoft: "#dbeafe",
  secondary: "#7c3aed",
  secondaryLight: "#a78bfa",

  // Semantic colors — bold and clear
  emerald: "#059669",
  emeraldLight: "#10b981",
  emeraldSoft: "#d1fae5",
  rose: "#e11d48",
  roseLight: "#fb7185",
  roseSoft: "#ffe4e6",
  amber: "#d97706",
  amberLight: "#fbbf24",
  amberSoft: "#fef3c7",
  sky: "#0284c7",
  skyLight: "#38bdf8",
  skySoft: "#e0f2fe",

  // Extended palette
  coral: "#f97316",
  coralSoft: "#ffedd5",
  teal: "#0d9488",
  tealSoft: "#ccfbf1",
  pink: "#db2777",
  pinkSoft: "#fce7f3",
  indigo: "#4f46e5",
  indigoSoft: "#e0e7ff",
  lime: "#65a30d",
  limeSoft: "#ecfccb",

  // Text colors
  text: "#0f172a",
  textSecondary: "#475569",
  textMuted: "#94a3b8",
  textInverse: "#ffffff",

  // Border & shadow
  border: "#e2e8f0",
  borderLight: "#f1f5f9",
  shadowSm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  shadowMd: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  shadowLg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  shadowXl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",

  // Mesh gradients for backgrounds
  meshBlue: "radial-gradient(at 0% 0%, hsla(217,91%,60%,0.15) 0px, transparent 50%), radial-gradient(at 100% 0%, hsla(190,90%,50%,0.1) 0px, transparent 50%), radial-gradient(at 100% 100%, hsla(240,100%,70%,0.1) 0px, transparent 50%), radial-gradient(at 0% 100%, hsla(280,100%,70%,0.1) 0px, transparent 50%)",
  meshWarm: "radial-gradient(at 0% 0%, hsla(30,100%,60%,0.12) 0px, transparent 50%), radial-gradient(at 100% 0%, hsla(340,80%,60%,0.1) 0px, transparent 50%), radial-gradient(at 100% 100%, hsla(200,80%,60%,0.1) 0px, transparent 50%), radial-gradient(at 0% 100%, hsla(260,80%,60%,0.1) 0px, transparent 50%)",
}

const COURSE_COLORS = [T.primary, T.secondary, T.coral, T.emerald, T.rose, T.teal, T.pink, T.indigo]
const HOUSE_COLORS = [T.coral, T.primary, T.emerald, T.secondary]

const fmt = n => "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN")
const pct = (a, b) => b > 0 ? Math.round((a / b) * 100) : 0
const todayStr = () => new Date().toISOString().slice(0, 10)

const MONTHS_LIST = ["April","May","June","July","August","September","October","November","December","January","February","March"]
const MONTH_NUMS = [4,5,6,7,8,9,10,11,12,1,2,3]

const CURRENT_YEAR = (() => {
  const m = new Date().getMonth() + 1
  const y = new Date().getFullYear()
  return m >= 4 ? y : y - 1
})()

const ACADEMIC_MONTHS = MONTHS_LIST.map((month, i) => {
  const year = i <= 8 ? CURRENT_YEAR : CURRENT_YEAR + 1
  const moNum = MONTH_NUMS[i]
  return { label: month.slice(0, 3), key: `${year}-${String(moNum).padStart(2,"0")}` }
})

const statusColor = s => ({
  Enrolled: T.emerald, Admitted: T.sky, "Under Review": T.amber, Applied: T.secondary,
  Overdue: T.rose, Partial: T.amber, Pending: T.textMuted, Done: T.emerald, Active: T.emerald,
  Inactive: T.rose, Selected: T.emerald, Shortlisted: T.sky, Rejected: T.rose,
  Open: T.sky, Closed: T.textMuted, Resolved: T.emerald, Unresolved: T.rose,
  Sent: T.emerald, Failed: T.rose, Delivered: T.sky, Unpaid: T.rose, Paid: T.emerald,
}[s] || T.textMuted)

async function safeFetch(queryFn) {
  try {
    const res = await queryFn()
    if (res.error) { console.warn("Supabase query warning:", res.error.message); return [] }
    return res.data || []
  } catch (e) {
    console.warn("Supabase fetch failed:", e.message)
    return []
  }
}

const SECTIONS = [
  {id:"overview", icon:"🏠", label:"Overview"},
  {id:"finance", icon:"💰", label:"Finance"},
  {id:"students", icon:"🎓", label:"Students"},
  {id:"admissions", icon:"📋", label:"Admissions"},
  {id:"staff", icon:"👨‍💼", label:"Staff"},
  {id:"attendance", icon:"✅", label:"Attendance"},
  {id:"academic", icon:"📚", label:"Academic"},
  {id:"hostel", icon:"🛏️", label:"Hostel"},
  {id:"houses", icon:"🏆", label:"Houses"},
  {id:"operations", icon:"⚙️", label:"Operations"},
  {id:"batches", icon:"🗂️", label:"Batches"},
  {id:"tests", icon:"📝", label:"Tests"},
  {id:"enquiry", icon:"🔍", label:"Enquiry"},
  {id:"doubts", icon:"💬", label:"Doubts"},
  {id:"parents", icon:"👨‍👩‍👧", label:"Parents"},
  {id:"material", icon:"📦", label:"Material"},
  {id:"results", icon:"🏅", label:"Results"},
  {id:"teaching", icon:"🖊️", label:"Teaching"},
  {id:"expenses", icon:"📉", label:"Expenses"},
]

// ═══════════════════════════════════════════════════════════
// 🎨 HEAVY GRAPHIC COMPONENTS
// ═══════════════════════════════════════════════════════════

function Counter({ value, duration=1200 }) {
  const [d, setD] = useState(0)
  const s = useRef(null)
  useEffect(()=>{
    s.current = null
    const step = ts => {
      if(!s.current) s.current = ts
      const p = Math.min((ts - s.current) / duration, 1)
      setD(Math.round((1 - Math.pow(1 - p, 3)) * value))
      if(p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [value])
  return <span>{d.toLocaleString("en-IN")}</span>
}

function ProgressBar({ value, max, color, height = 6, gradient = false }) {
  const w = Math.min(100, pct(value, max))
  const bg = gradient 
    ? `linear-gradient(90deg, ${color}88, ${color}, ${color}88)`
    : `linear-gradient(90deg, ${color}dd, ${color})`
  return (
    <div style={{
      background: "#e2e8f0",
      borderRadius: 99,
      height,
      overflow: "hidden",
      boxShadow: "inset 0 1px 2px rgba(0,0,0,0.06)"
    }}>
      <div style={{
        height: "100%",
        width: `${w}%`,
        borderRadius: 99,
        background: bg,
        transition: "width 1.2s cubic-bezier(.4,0,.2,1)",
        boxShadow: `0 0 12px ${color}50, 0 2px 4px ${color}30`,
        position: "relative",
      }}>
        <div style={{
          position: "absolute",
          top: 0, left: 0, right: 0, bottom: 0,
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)",
          animation: "shimmer 2s infinite"
        }}/>
      </div>
    </div>
  )
}

function Panel({ children, style = {}, accent, title, sub, icon, glass = false }) {
  const baseStyle = glass ? {
    background: "rgba(255,255,255,0.7)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.5)",
  } : {
    background: T.bgElevated,
    border: "1px solid " + T.border,
  }

  return (
    <div style={{
      ...baseStyle,
      borderRadius: 20,
      padding: "24px 26px",
      boxShadow: glass ? "0 8px 32px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)" : T.shadowLg,
      position: "relative",
      overflow: "hidden",
      ...style
    }}>
      {accent && (
        <div style={{
          position: "absolute",
          top: 0, right: 0,
          width: 120, height: 120,
          background: `radial-gradient(circle at top right, ${accent}15, transparent 70%)`,
          pointerEvents: "none",
        }}/>
      )}
      <div style={{
        position: "absolute",
        top: 0, left: 0, right: 0, bottom: 0,
        background: T.meshBlue,
        opacity: 0.5,
        pointerEvents: "none",
        borderRadius: 20,
      }}/>
      {title && (
        <div style={{ marginBottom: 18, position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            {icon && <span style={{ fontSize: 20, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))" }}>{icon}</span>}
            <div style={{ fontSize: 15, fontWeight: 800, color: T.text, letterSpacing: "-0.02em" }}>{title}</div>
          </div>
          {sub && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2, marginLeft: icon ? 30 : 0 }}>{sub}</div>}
        </div>
      )}
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>
  )
}

function Badge({ label, color, soft = false, pulse = false }) {
  return (
    <span style={{
      fontSize: 10,
      fontWeight: 700,
      color: soft ? color : T.textInverse,
      textTransform: "uppercase",
      letterSpacing: ".08em",
      background: soft ? `${color}15` : color,
      padding: "3px 10px",
      borderRadius: 8,
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      boxShadow: soft ? "none" : `0 2px 8px ${color}40`,
      animation: pulse ? "pulse 2s infinite" : "none",
    }}>
      {pulse && <span style={{
        width: 5, height: 5, borderRadius: "50%", background: "currentColor", opacity: 0.8
      }}/>}
      {label}
    </span>
  )
}

function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: "rgba(255,255,255,0.95)",
      backdropFilter: "blur(12px)",
      border: "1px solid " + T.border,
      borderRadius: 14,
      padding: "12px 16px",
      fontSize: 12,
      boxShadow: T.shadowXl,
    }}>
      <div style={{ color: T.textMuted, marginBottom: 6, fontWeight: 600, fontSize: 11 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: 3, background: p.color, boxShadow: `0 0 6px ${p.color}60` }}/>
          <span style={{ color: T.textSecondary, fontWeight: 500 }}>{p.name}:</span>
          <span style={{ color: p.color, fontWeight: 800, marginLeft: "auto" }}>
            {p.value > 999 ? fmt(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

function KPI({ icon, label, value, sub, color, progress, progressMax, isMoney, trend, gradient = false, glass = false }) {
  const bgStyle = gradient ? {
    background: `linear-gradient(135deg, ${color}08, ${color}15)`,
    border: `1px solid ${color}25`,
  } : glass ? {
    background: "rgba(255,255,255,0.6)",
    backdropFilter: "blur(16px)",
    border: "1px solid rgba(255,255,255,0.6)",
  } : {
    background: T.bgElevated,
    border: "1px solid " + T.border,
  }

  return (
    <div style={{
      ...bgStyle,
      borderRadius: 20,
      padding: "22px 24px",
      display: "flex",
      flexDirection: "column",
      gap: 10,
      position: "relative",
      overflow: "hidden",
      boxShadow: T.shadowMd,
      transition: "transform 0.2s ease, box-shadow 0.2s ease",
      cursor: "default",
    }}
    onMouseEnter={e => {
      e.currentTarget.style.transform = "translateY(-2px)"
      e.currentTarget.style.boxShadow = T.shadowLg
    }}
    onMouseLeave={e => {
      e.currentTarget.style.transform = "translateY(0)"
      e.currentTarget.style.boxShadow = T.shadowMd
    }}
    >
      <div style={{
        position: "absolute",
        top: -30, right: -30,
        width: 100, height: 100,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${color}20, transparent 70%)`,
        filter: "blur(20px)",
      }}/>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
        <span style={{ fontSize: 24, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.08))" }}>{icon}</span>
        <Badge label={label} color={color} soft/>
      </div>
      <div style={{ fontSize: 32, fontWeight: 900, color: T.text, letterSpacing: "-.03em", lineHeight: 1, position: "relative", zIndex: 1 }}>
        {isMoney ? fmt(value) : <Counter value={value}/>}
      </div>
      {sub && <div style={{ fontSize: 12, color: T.textMuted, position: "relative", zIndex: 1 }}>{sub}</div>}
      {trend !== undefined && (
        <div style={{ 
          fontSize: 12, fontWeight: 700, 
          color: trend >= 0 ? T.emerald : T.rose,
          display: "flex", alignItems: "center", gap: 4,
          position: "relative", zIndex: 1
        }}>
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 18, height: 18,
            borderRadius: 5,
            background: trend >= 0 ? T.emeraldSoft : T.roseSoft,
            fontSize: 10,
          }}>{trend >= 0 ? "▲" : "▼"}</span>
          {Math.abs(trend)}% vs last month
        </div>
      )}
      {progress !== undefined && (
        <div style={{ position: "relative", zIndex: 1 }}>
          <ProgressBar value={progress} max={progressMax} color={color} height={8} gradient/>
        </div>
      )}
    </div>
  )
}

function Gauge({ value, max = 100, color, size = 100, thick = 10 }) {
  const r = (size - thick) / 2 - 4, cx = size / 2, cy = size / 2
  const circumference = 2 * Math.PI * r
  const arc = circumference * 0.75
  const filled = arc - (arc * (1 - Math.min(value, max) / max))
  const pctVal = Math.round(value)

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <svg width={size} height={size} style={{ overflow: "visible", transform: "rotate(-135deg)" }}>
        <defs>
          <linearGradient id={`gaugeGrad-${color.replace('#','')}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} stopOpacity="0.6"/>
            <stop offset="50%" stopColor={color} stopOpacity="1"/>
            <stop offset="100%" stopColor={color} stopOpacity="0.6"/>
          </linearGradient>
        </defs>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth={thick} 
          strokeDasharray={`${arc} ${circumference - arc}`} 
          strokeDashoffset={0} strokeLinecap="round"/>
        <circle cx={cx} cy={cy} r={r} fill="none" 
          stroke={`url(#gaugeGrad-${color.replace('#','')})`} 
          strokeWidth={thick} 
          strokeDasharray={`${filled} ${circumference - filled}`} 
          strokeDashoffset={0} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 8px ${color}60)`, transition: "stroke-dasharray 1s ease" }}/>
      </svg>
      <div style={{
        position: "absolute",
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        textAlign: "center",
      }}>
        <div style={{ fontSize: size > 80 ? 22 : 16, fontWeight: 900, color: T.text, lineHeight: 1 }}>{pctVal}%</div>
        <div style={{ fontSize: 9, color: T.textMuted, fontWeight: 600, marginTop: 2 }}>Score</div>
      </div>
    </div>
  )
}

function Skeleton({ h = 20, w = "100%", r = 12 }) {
  return <div style={{
    height: h, width: w, borderRadius: r,
    background: "linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)",
    backgroundSize: "200% 100%",
    animation: "shimmer 1.5s infinite",
  }}/>
}

function EmptyState({ msg, icon = "📭" }) {
  return (
    <div style={{ 
      color: T.textMuted, fontSize: 13, padding: "24px 0", 
      textAlign: "center",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 8,
    }}>
      <span style={{ fontSize: 32, opacity: 0.5 }}>{icon}</span>
      <span>{msg}</span>
    </div>
  )
}

function SectionHeader({ icon, title, color = T.primary }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "0 0 24px" }}>
      <div style={{
        width: 44, height: 44,
        borderRadius: 14,
        background: `linear-gradient(135deg, ${color}20, ${color}08)`,
        border: `1px solid ${color}20`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 20,
        boxShadow: `0 4px 12px ${color}15`,
      }}>{icon}</div>
      <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0, color: T.text, letterSpacing: "-0.02em" }}>{title}</h2>
      <div style={{
        flex: 1, height: 2,
        background: `linear-gradient(90deg, ${color}30, transparent)`,
        borderRadius: 1,
        marginLeft: 8,
      }}/>
    </div>
  )
}

function FloatingCard({ children, color, style = {} }) {
  return (
    <div style={{
      background: T.bgElevated,
      borderRadius: 20,
      padding: "20px 22px",
      boxShadow: T.shadowLg,
      border: "1px solid " + T.border,
      position: "relative",
      overflow: "hidden",
      transition: "transform 0.3s ease, box-shadow 0.3s ease",
      ...style
    }}
    onMouseEnter={e => {
      e.currentTarget.style.transform = "translateY(-4px) scale(1.01)"
      e.currentTarget.style.boxShadow = T.shadowXl
    }}
    onMouseLeave={e => {
      e.currentTarget.style.transform = "translateY(0) scale(1)"
      e.currentTarget.style.boxShadow = T.shadowLg
    }}
    >
      {color && (
        <div style={{
          position: "absolute",
          top: 0, left: 0, right: 0,
          height: 4,
          background: `linear-gradient(90deg, ${color}, ${color}88)`,
          borderRadius: "20px 20px 0 0",
        }}/>
      )}
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>
  )
}

function ActionButton({ label, color, icon }) {
  return (
    <button style={{
      width: "100%",
      padding: "12px 16px",
      borderRadius: 12,
      border: `1px solid ${color}22`,
      background: `linear-gradient(135deg, ${color}08, ${color}15)`,
      color: color,
      fontSize: 13,
      fontWeight: 700,
      cursor: "pointer",
      textAlign: "left",
      fontFamily: "inherit",
      display: "flex",
      alignItems: "center",
      gap: 10,
      transition: "all 0.2s ease",
      boxShadow: `0 2px 8px ${color}10`,
    }}
    onMouseEnter={e => {
      e.currentTarget.style.background = `linear-gradient(135deg, ${color}15, ${color}25)`
      e.currentTarget.style.transform = "translateX(4px)"
      e.currentTarget.style.boxShadow = `0 4px 16px ${color}25`
    }}
    onMouseLeave={e => {
      e.currentTarget.style.background = `linear-gradient(135deg, ${color}08, ${color}15)`
      e.currentTarget.style.transform = "translateX(0)"
      e.currentTarget.style.boxShadow = `0 2px 8px ${color}10`
    }}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>
      {label}
    </button>
  )
}

// ═══════════════════════════════════════════════════════════
// DATA FETCHING (identical to original)
// ═══════════════════════════════════════════════════════════



async function loadAllData() {
  const today = todayStr(), nowD = new Date()

  const [
    studentsCountRes, studentsRes, admissionsRes, recentAdmRes,
    accountsRes, recentFeeRes, staffRes, staffTasksRes, staffScoresRes,
    attendanceTodayRes, attendanceAllRes, housesRawRes, defaultersRes,
    hostelRoomsData, hostelIncidentsData, messData, housePointsData,
    clubsData, leavesData, recruitmentData, examMarksData,
    sportsData, serviceHoursData, achievementsData, waiverData,
    scholarshipData, batchesData, timetableData, enquiriesData,
    doubtSessionsData, smsLogsData, studyMaterialData, selectionsData,
    syllabusCoverageData, expensesData,
  ] = await Promise.all([
    supabase.from("Students").select("*", {count:"exact", head:true}),
    supabase.from("Students").select("gender, state, date_of_birth, created_at"),
    supabase.from("admissions").select("gcc_no,applicant_name,status,course,hostel_type,batch,created_at,referral_source,category"),
    supabase.from("admissions").select("gcc_no,applicant_name,batch,status,created_at").order("created_at",{ascending:false}).limit(6),
    supabase.from("accounts").select("amount,category,entry_date,type,payment_mode,note").eq("type","Income"),
    supabase.from("adm_fee_collections").select("amount_paid,fee_type,adm_app_id,student_name,pay_date,pay_mode,description").order("pay_date",{ascending:false}).limit(6),
    safeFetch(()=>supabase.from("gnsi_staff_biodata").select("id,name,department,status,basic_salary,seniority_allowance,loyalty_bonus,role_bonus,designation")),
    supabase.from("management_checklist").select("id,status,priority,section,task,owner,created_at"),
    safeFetch(()=>supabase.from("staff_monthly_scores").select("staff_id,month,total_score,level").order("month",{ascending:false}).limit(50)),
    supabase.from("attendance").select("status,date").eq("date",today),
    supabase.from("attendance").select("status,date").order("date",{ascending:false}).limit(1500),
    supabase.from("houses").select("*"),
    supabase.from("fee_invoices").select("gcc_no,student_name,course,amount_due,status,invoice_month").in("status",["Overdue","Pending","Partial"]).gt("amount_due",0).order("amount_due",{ascending:false}).limit(5),
    safeFetch(()=>supabase.from("hostel_rooms").select("block,total_beds,occupied_beds")),
    safeFetch(()=>supabase.from("hostel_incidents").select("incident_date,type,severity")),
    safeFetch(()=>supabase.from("mess_consumption").select("meal_date,breakfast,lunch,dinner")),
    safeFetch(()=>supabase.from("house_points").select("house_name,academic,sports,cultural,discipline")),
    safeFetch(()=>supabase.from("clubs").select("name,member_count")),
    safeFetch(()=>supabase.from("leave_requests").select("leave_type,staff_id,start_date")),
    safeFetch(()=>supabase.from("staff_recruitment").select("stage,candidate_name,applied_date")),
    safeFetch(()=>supabase.from("exam_marks").select("student_id,student_name,class_name,subject,marks,total_marks,exam_date,gcc_no")),
    safeFetch(()=>supabase.from("sports_participation").select("sport,student_count")),
    safeFetch(()=>supabase.from("house_service_hours").select("house_name,hours")),
    safeFetch(()=>supabase.from("achievements").select("title,house_name,achieved_date")),
    safeFetch(()=>supabase.from("fee_waivers").select("category,total_amount,student_count")),
    safeFetch(()=>supabase.from("scholarships").select("name,awarded_count,total_amount")),
    safeFetch(()=>supabase.from("batches").select("id,name,course,teacher_name,strength,capacity,start_date,status,batch_type")),
    safeFetch(()=>supabase.from("teaching_timetable").select("batch_id,subject_name,teacher_name,day_of_week,start_time,end_time,class_name")),
    safeFetch(()=>supabase.from("enquiries").select("id,name,phone,course_interest,source,status,follow_up_date,created_at,converted")),
    safeFetch(()=>supabase.from("doubt_sessions").select("id,student_name,batch_name,subject,topic,raised_date,resolved_date,staff_name,status")),
    safeFetch(()=>supabase.from("sms_logs").select("id,recipient_type,message_type,sent_at,status,count")),
    safeFetch(()=>supabase.from("study_material").select("id,title,subject,batch_name,material_type,distributed_date,total_copies,distributed_copies")),
    safeFetch(()=>supabase.from("selections").select("id,student_name,exam_name,rank,year,batch_name,category,school_allotted")),
    safeFetch(()=>supabase.from("monthly_syllabus").select("teacher_name,subject,batch_name,total_topics,covered_topics,month")),
    safeFetch(()=>supabase.from("accounts").select("id,category,amount,entry_date,note,type").eq("type","Expense")),
  ])

  // ════════════════════════════════════════════════════════
  // FINANCE
  // ════════════════════════════════════════════════════════
  const allIncome = accountsRes.data || []
  const totalFeeCollected = allIncome.reduce((s,r)=>s+(Number(r.amount)||0),0)
  const admFeeTotal = allIncome.filter(r=>r.category==="Admission").reduce((s,r)=>s+(Number(r.amount)||0),0)
  const flatFeeTotal = allIncome.filter(r=>r.category==="Flat Fee").reduce((s,r)=>s+(Number(r.amount)||0),0)
  const courseFeeTotal = allIncome.filter(r=>r.category==="Course Fee").reduce((s,r)=>s+(Number(r.amount)||0),0)
  const feePending = (defaultersRes.data||[]).reduce((s,r)=>s+(Number(r.amount_due)||0),0)

  const monthlyFees = ACADEMIC_MONTHS.map(m=>({
    month: m.label,
    collected: allIncome.filter(r=>r.entry_date?.startsWith(m.key)).reduce((s,r)=>s+(Number(r.amount)||0),0),
    target: 500000,
  }))

  const incomeCatMap = {}
  allIncome.forEach(r=>{
    const c = r.category || "Other"
    incomeCatMap[c] = (incomeCatMap[c] || 0) + (Number(r.amount) || 0)
  })

  const feeAging = [
    {bucket:"0-30 days", amount:0, count:0, color: T.amber},
    {bucket:"31-60 days", amount:0, count:0, color: T.coral},
    {bucket:"60+ days", amount:0, count:0, color: T.rose},
  ]
  ;(defaultersRes.data||[]).forEach(d=>{
    if(!d.invoice_month) return
    const diff = Math.floor((nowD - new Date(d.invoice_month + "-01")) / 86400000)
    const idx = diff <= 30 ? 0 : diff <= 60 ? 1 : 2
    feeAging[idx].amount += Number(d.amount_due) || 0
    feeAging[idx].count++
  })

  const feeWaivers = (waiverData || []).map((w, i) => ({
    category: w.category, amount: Number(w.total_amount) || 0,
    students: Number(w.student_count) || 0, color: COURSE_COLORS[i % COURSE_COLORS.length]
  }))
  const totalWaivers = feeWaivers.reduce((s, w) => s + w.amount, 0)
  const scholarships = (scholarshipData || []).map(s => ({
    name: s.name, awarded: Number(s.awarded_count) || 0, amount: Number(s.total_amount) || 0
  }))

  const recentFeeActivity = recentFeeRes.data || []

  // ════════════════════════════════════════════════════════
  // ADMISSIONS
  // ════════════════════════════════════════════════════════
  const allAdm = admissionsRes.data || []
  const admApplied = allAdm.filter(a => a.status === "Applied").length
  const admUnderReview = allAdm.filter(a => a.status === "Under Review").length
  const admAdmitted = allAdm.filter(a => a.status === "Admitted").length
  const admEnrolled = allAdm.filter(a => a.status === "Enrolled").length
  const admRejected = allAdm.filter(a => a.status === "Rejected").length
  const admWaitlisted = allAdm.filter(a => a.status === "Waitlisted").length
  const boarders = allAdm.filter(a => a.hostel_type === "Boarder").length
  const dayBoarders = allAdm.filter(a => a.hostel_type === "Day Boarder").length
  const dayScholars = allAdm.filter(a => a.hostel_type === "Day Scholar").length

  const courseCounts = {}
  allAdm.forEach(a => { if(a.course) courseCounts[a.course] = (courseCounts[a.course] || 0) + 1 })
  const courseBreakdown = Object.entries(courseCounts).sort((a,b) => b[1]-a[1]).map(([name, students], i) => ({
    name, students, color: COURSE_COLORS[i % COURSE_COLORS.length]
  }))

  const sourceCounts = {}
  allAdm.forEach(a => { const s = a.referral_source || "Unknown"; sourceCounts[s] = (sourceCounts[s] || 0) + 1 })
  const applicationSource = Object.entries(sourceCounts).map(([name, value], i) => ({
    name, value, color: COURSE_COLORS[i % COURSE_COLORS.length]
  }))

  const batchCounts = {}
  allAdm.forEach(a => { if(a.batch) batchCounts[a.batch] = (batchCounts[a.batch] || 0) + 1 })
  const yoyAdmissions = Object.entries(batchCounts).sort((a,b) => a[0].localeCompare(b[0])).map(([year, count]) => ({year, count}))

  const admissionFunnel = [
    {stage: "Applied", count: admApplied + admUnderReview + admAdmitted + admEnrolled, color: T.sky},
    {stage: "Under Review", count: admUnderReview + admAdmitted + admEnrolled, color: T.secondary},
    {stage: "Admitted", count: admAdmitted + admEnrolled, color: T.amber},
    {stage: "Enrolled", count: admEnrolled, color: T.emerald},
  ]

  const enquiryFunnel = [
    {stage: "Walk-in / Call", count: allAdm.length, color: T.sky},
    {stage: "Interested", count: Math.round(allAdm.length * 0.85), color: T.secondary},
    {stage: "Follow-up Done", count: admUnderReview + admAdmitted + admEnrolled, color: T.amber},
    {stage: "Converted", count: admEnrolled, color: T.emerald},
  ]

  // ════════════════════════════════════════════════════════
  // STUDENTS
  // ════════════════════════════════════════════════════════
  const allStudents = studentsRes.data || []
  const totalStudentsCount = studentsCountRes.count || allAdm.length
  const maleStudents = allAdm.filter(s => s.gender === "Male" || s.gender === "male").length || allStudents.filter(s => s.gender === "Male").length
  const femaleStudents = allAdm.filter(s => s.gender === "Female" || s.gender === "female").length || allStudents.filter(s => s.gender === "Female").length

  const stateCounts = {}
  allStudents.forEach(s => { if(s.state) stateCounts[s.state] = (stateCounts[s.state] || 0) + 1 })
  const stateData = Object.entries(stateCounts).sort((a,b) => b[1]-a[1]).slice(0,8).map(([state, count]) => ({state, count}))

  const ageData = {}
  allStudents.forEach(s => {
    if(!s.date_of_birth) return
    const age = Math.floor((nowD - new Date(s.date_of_birth)) / 31536000000)
    const bucket = age < 16 ? "14-15" : age < 18 ? "16-17" : age < 20 ? "18-19" : age < 22 ? "20-21" : age < 24 ? "22-23" : "24+"
    ageData[bucket] = (ageData[bucket] || 0) + 1
  })
  const ageDistribution = ["14-15","16-17","18-19","20-21","22-23","24+"].map(age => ({age, count: ageData[age] || 0}))

  // ════════════════════════════════════════════════════════
  // STAFF
  // ════════════════════════════════════════════════════════
  const allStaff = staffRes || []
  const totalStaff = allStaff.length
  const activeStaffCnt = allStaff.filter(s => s.status === "Active").length
  const totalSalaryBill = allStaff.reduce((s, st) => s + (Number(st.basic_salary) || 0) + (Number(st.seniority_allowance) || 0) + (Number(st.loyalty_bonus) || 0) + (Number(st.role_bonus) || 0), 0)
  const salaryTrend = ACADEMIC_MONTHS.slice(0,9).map(m => ({month: m.label, bill: totalSalaryBill + (Math.random() - 0.5) * totalSalaryBill * 0.03}))

  // ════════════════════════════════════════════════════════
  // STAFF TASKS
  // ════════════════════════════════════════════════════════
  const allTasks = staffTasksRes.data || []
  const taskPending = allTasks.filter(t => t.status === "Pending").length
  const taskDone = allTasks.filter(t => t.status === "Done").length
  const taskOverdue = allTasks.filter(t => t.status === "Pending" && t.period === "daily" && t.created_at && new Date(t.created_at) < nowD).length

  const taskDeptMap = {}
  allTasks.forEach(t => {
    const d = (t.section || "Other").slice(0,8)
    if(!taskDeptMap[d]) taskDeptMap[d] = {dept: d, pending: 0, done: 0, overdue: 0}
    if(t.status === "Done") taskDeptMap[d].done++
    else taskDeptMap[d].pending++
  })
  const taskByDept = Object.values(taskDeptMap).slice(0,6)

  const slaMap = {}
  allTasks.forEach(t => {
    const d = (t.section || "Other").slice(0,8)
    if(!slaMap[d]) slaMap[d] = {dept: d, breaches: 0, total: 0}
    slaMap[d].total++
    if(t.status === "Pending") slaMap[d].breaches++
  })
  const slaBreach = Object.values(slaMap).slice(0,5).map(s => ({...s, color: s.breaches > 0 ? T.rose : T.emerald}))

  const allScores = staffScoresRes || []
  const latestMonth = allScores[0]?.month || null
  const staffMap = Object.fromEntries(allStaff.map(s => [s.id, s]))
  const topStaff = []
  const staffRadar = []
  const leaveBreakdown = []
  const recruitmentFunnel = []
  const trainingHours = []

  // ════════════════════════════════════════════════════════
  // ATTENDANCE
  // ════════════════════════════════════════════════════════
  const todayAtt = attendanceTodayRes.data || []
  const presentToday = todayAtt.filter(a => a.status === "Present").length
  const absentToday = todayAtt.filter(a => a.status === "Absent").length
  const lateToday = todayAtt.filter(a => a.status === "Late").length
  const totalToday = todayAtt.length

  const weekMap = {}
  ;(attendanceAllRes.data || []).forEach(a => {
    if(!weekMap[a.date]) weekMap[a.date] = {present: 0, absent: 0, late: 0}
    if(a.status === "Present") weekMap[a.date].present++
    else if(a.status === "Late") weekMap[a.date].late++
    else weekMap[a.date].absent++
  })
  const attendanceWeek = Object.entries(weekMap).sort((a,b) => a[0].localeCompare(b[0])).slice(-7).map(([date, c]) => ({
    day: new Date(date).toLocaleDateString("en-IN", {weekday: "short"}), ...c
  }))
  const monthlyAttTrend = ACADEMIC_MONTHS.map(m => {
    const entries = (attendanceAllRes.data || []).filter(a => a.date?.startsWith(m.key))
    const total = entries.length
    const present = entries.filter(a => a.status === "Present").length
    return {month: m.label, rate: total > 0 ? pct(present, total) : 0}
  })

  // ════════════════════════════════════════════════════════
  // ACADEMIC / EXAM MARKS
  // ════════════════════════════════════════════════════════
  const subjectMap2 = {}
  examMarksData.forEach(e => {
    if(!e.subject) return
    if(!subjectMap2[e.subject]) subjectMap2[e.subject] = {total: 0, max: 0, pass: 0, count: 0}
    const pctScore = pct(Number(e.marks), Number(e.total_marks))
    subjectMap2[e.subject].total += Number(e.marks) || 0
    subjectMap2[e.subject].max += Number(e.total_marks) || 0
    subjectMap2[e.subject].count++
    if(pctScore >= 40) subjectMap2[e.subject].pass++
  })
  const subjectScores = Object.entries(subjectMap2).map(([subject, v]) => ({
    subject: subject.slice(0,10), avg: v.max > 0 ? Math.round(v.total / v.max * 100) : 0,
    pass: v.count > 0 ? pct(v.pass, v.count) : 0
  }))

  const gradeMap2 = {"A+":0, "A":0, "B+":0, "B":0, "C":0, "D":0}
  examMarksData.forEach(e => {
    const p = pct(Number(e.marks), Number(e.total_marks))
    if(p >= 95) gradeMap2["A+"]++
    else if(p >= 80) gradeMap2["A"]++
    else if(p >= 65) gradeMap2["B+"]++
    else if(p >= 50) gradeMap2["B"]++
    else if(p >= 35) gradeMap2["C"]++
    else gradeMap2["D"]++
  })
  const gradeCols = [T.emerald, T.sky, T.secondary, T.amber, T.coral, T.rose]
  const gradeDistribution = Object.entries(gradeMap2).map(([grade, count], i) => ({grade, count, color: gradeCols[i]}))

  const avgScore_all = examMarksData.length > 0
    ? pct(examMarksData.reduce((s,e) => s + (Number(e.marks) || 0), 0), examMarksData.reduce((s,e) => s + (Number(e.total_marks) || 0), 0))
    : 0
  const passCount = examMarksData.filter(e => pct(Number(e.marks), Number(e.total_marks)) >= 40).length
  const passRate = examMarksData.length > 0 ? pct(passCount, examMarksData.length) : 0
  const aPlusCount = gradeMap2["A+"]
  const atRisk = gradeMap2["D"]

  // ════════════════════════════════════════════════════════
  // TESTS
  // ════════════════════════════════════════════════════════
  const totalTests = [...new Set(examMarksData.map(t => t.exam_date))].length
  const totalTestEntries = examMarksData.length
  const avgTestScore = avgScore_all

  const testTypeMap2 = {}
  examMarksData.forEach(t => { const tp = t.class_name || "Unknown"; testTypeMap2[tp] = (testTypeMap2[tp] || 0) + 1 })
  const testByType = Object.entries(testTypeMap2).map(([name, count], i) => ({name, count, color: COURSE_COLORS[i % COURSE_COLORS.length]}))

  const studentScoreMap2 = {}
  examMarksData.forEach(t => {
    const id = t.gcc_no || t.student_id
    if(!studentScoreMap2[id]) studentScoreMap2[id] = {name: t.student_name || id, batch: t.class_name, total: 0, max: 0, count: 0}
    studentScoreMap2[id].total += Number(t.marks) || 0
    studentScoreMap2[id].max += Number(t.total_marks) || 0
    studentScoreMap2[id].count++
  })
  const topPerformers = Object.values(studentScoreMap2).map(s => ({...s, avg: s.max > 0 ? pct(s.total, s.max) : 0})).sort((a,b) => b.avg - a.avg).slice(0,8)
  const atRiskStudents = Object.values(studentScoreMap2).filter(s => s.max > 0 && pct(s.total, s.max) < 40)

  const testSubjectScores = subjectScores.map((s, i) => ({...s, color: COURSE_COLORS[i % COURSE_COLORS.length]}))

  const batchScoreMap2 = {}
  examMarksData.forEach(t => {
    const b = t.class_name || "Unknown"
    if(!batchScoreMap2[b]) batchScoreMap2[b] = {total: 0, max: 0}
    batchScoreMap2[b].total += Number(t.marks) || 0
    batchScoreMap2[b].max += Number(t.total_marks) || 0
  })
  const batchScores = Object.entries(batchScoreMap2).map(([batch, v], i) => ({
    batch: batch.slice(0,10), avg: v.max > 0 ? pct(v.total, v.max) : 0, color: COURSE_COLORS[i % COURSE_COLORS.length]
  }))

  const testMonthMap2 = {}
  examMarksData.forEach(t => {
    const mo = t.exam_date?.slice(0,7)
    if(!mo) return
    if(!testMonthMap2[mo]) testMonthMap2[mo] = {total: 0, max: 0}
    testMonthMap2[mo].total += Number(t.marks) || 0
    testMonthMap2[mo].max += Number(t.total_marks) || 0
  })
  const testTrend = ACADEMIC_MONTHS.map(m => ({
    month: m.label, avg: testMonthMap2[m.key]?.max > 0 ? pct(testMonthMap2[m.key].total, testMonthMap2[m.key].max) : 0,
  }))

  // ════════════════════════════════════════════════════════
  // HOSTEL
  // ════════════════════════════════════════════════════════
  const hostelRooms = hostelRoomsData.map((r, i) => ({
    block: r.block || `Block ${String.fromCharCode(65+i)}`,
    total: Number(r.total_beds) || 0, occupied: Number(r.occupied_beds) || 0,
    color: COURSE_COLORS[i % COURSE_COLORS.length]
  }))
  const hostelTotalRooms = hostelRooms.reduce((s, r) => s + r.total, 0)
  const hostelOccupied = hostelRooms.reduce((s, r) => s + r.occupied, 0)
  const hostelVacant = hostelTotalRooms - hostelOccupied

  const messMonthMap2 = {}
  messData.forEach(m => {
    const mo = m.meal_date?.slice(0,7)
    if(!mo) return
    if(!messMonthMap2[mo]) messMonthMap2[mo] = {breakfast: 0, lunch: 0, dinner: 0}
    messMonthMap2[mo].breakfast += Number(m.breakfast) || 0
    messMonthMap2[mo].lunch += Number(m.lunch) || 0
    messMonthMap2[mo].dinner += Number(m.dinner) || 0
  })
  const messChartData = ACADEMIC_MONTHS.slice(0,8).map(m => ({
    month: m.label, ...(messMonthMap2[m.key] || {breakfast: 0, lunch: 0, dinner: 0})
  }))

  const incidentMonthMap2 = {}
  hostelIncidentsData.forEach(inc => {
    const mo = inc.incident_date?.slice(0,7)
    if(!mo) return
    incidentMonthMap2[mo] = (incidentMonthMap2[mo] || 0) + 1
  })
  const hostelIncidentChart = ACADEMIC_MONTHS.slice(0,8).map(m => ({month: m.label, count: incidentMonthMap2[m.key] || 0}))

  // ════════════════════════════════════════════════════════
  // HOUSES
  // ════════════════════════════════════════════════════════
  const rawHouses = housesRawRes.data || []
  const houseNames = rawHouses.length > 0
    ? rawHouses.map(h => h.name || h.house_name)
    : (housePointsData.length > 0 ? [...new Set(housePointsData.map(h => h.house_name))] : ["Phoenix","Falcon","Eagle","Titan"])

  const houseAggMap = {}
  housePointsData.forEach(h => {
    const name = h.house_name
    if(!houseAggMap[name]) houseAggMap[name] = {name, academic: 0, sports: 0, cultural: 0, discipline: 0}
    houseAggMap[name].academic += Number(h.academic) || 0
    houseAggMap[name].sports += Number(h.sports) || 0
    houseAggMap[name].cultural += Number(h.cultural) || 0
    houseAggMap[name].discipline += Number(h.discipline) || 0
  })
  const housePoints = houseNames.map((name, i) => {
    const agg = houseAggMap[name] || {academic: 0, sports: 0, cultural: 0, discipline: 0}
    const total = agg.academic + agg.sports + agg.cultural + agg.discipline
    return {...agg, name, points: total, color: HOUSE_COLORS[i % HOUSE_COLORS.length]}
  }).sort((a,b) => b.points - a.points)

  const serviceHours = serviceHoursData.length > 0
    ? serviceHoursData.map((h, i) => ({house: h.house_name, hours: Number(h.hours) || 0, color: HOUSE_COLORS[i % HOUSE_COLORS.length]}))
    : houseNames.map((h, i) => ({house: h, hours: 0, color: HOUSE_COLORS[i % HOUSE_COLORS.length]}))

  const clubsFormatted = clubsData.map((c, i) => ({name: c.name, members: Number(c.member_count) || 0, color: COURSE_COLORS[i % COURSE_COLORS.length]}))
  const sportsFormatted = sportsData.map(s => ({sport: s.sport, count: Number(s.student_count) || 0}))
  const achievementsFormatted = achievementsData.map(a => ({title: a.title, house: a.house_name || "—", date: a.achieved_date?.slice(0,7) || "—"}))

  // ════════════════════════════════════════════════════════
  // BATCHES
  // ════════════════════════════════════════════════════════
  const totalBatches = batchesData.length
  const activeBatches = batchesData.filter(b => b.status === "Active").length
  const totalCapacity = batchesData.reduce((s, b) => s + (Number(b.capacity) || 0), 0)
  const totalStrength = batchesData.reduce((s, b) => s + (Number(b.strength) || 0), 0)
  const batchFillRate = pct(totalStrength, totalCapacity)
  const batchTypeMap2 = {}
  batchesData.forEach(b => { const t = b.batch_type || "Regular"; batchTypeMap2[t] = (batchTypeMap2[t] || 0) + 1 })
  const batchByType = Object.entries(batchTypeMap2).map(([name, count], i) => ({name, count, color: COURSE_COLORS[i % COURSE_COLORS.length]}))
  const timetableByDay2 = {}
  timetableData.forEach(t => { const d = t.day_of_week || "Mon"; if(!timetableByDay2[d]) timetableByDay2[d] = 0; timetableByDay2[d]++ })
  const timetableChart = ["Mon","Tue","Wed","Thu","Fri","Sat"].map(d => ({day: d, classes: timetableByDay2[d] || 0}))

  // ════════════════════════════════════════════════════════
  // ENQUIRY
  // ════════════════════════════════════════════════════════
  const totalEnquiries = allAdm.length
  const openEnquiries = allAdm.filter(a => a.status === "Applied" || a.status === "Under Review").length
  const convertedEnq = admEnrolled
  const conversionRate = pct(convertedEnq, totalEnquiries)
  const followUpDue = openEnquiries

  const enqSourceMap = {}
  allAdm.forEach(a => { const s = a.referral_source || "Unknown"; enqSourceMap[s] = (enqSourceMap[s] || 0) + 1 })
  const enqBySource = Object.entries(enqSourceMap).map(([name, count], i) => ({name, count, color: COURSE_COLORS[i % COURSE_COLORS.length]}))

  const enqCourseMap = {}
  allAdm.forEach(a => { const c = a.course || "Unknown"; enqCourseMap[c] = (enqCourseMap[c] || 0) + 1 })
  const enqByCourse = Object.entries(enqCourseMap).sort((a,b) => b[1]-a[1]).map(([name, count], i) => ({name, count, color: COURSE_COLORS[i % COURSE_COLORS.length]}))

  const enqMonthMap2 = {}
  allAdm.forEach(a => {
    const mo = a.created_at?.slice(0,7)
    if(!mo) return
    if(!enqMonthMap2[mo]) enqMonthMap2[mo] = {enquiries: 0, converted: 0}
    enqMonthMap2[mo].enquiries++
    if(a.status === "Enrolled") enqMonthMap2[mo].converted++
  })
  const enqTrend = ACADEMIC_MONTHS.map(m => ({
    month: m.label, enquiries: enqMonthMap2[m.key]?.enquiries || 0, converted: enqMonthMap2[m.key]?.converted || 0
  }))

  const recentEnquiries = allAdm.slice(-6).reverse().map(a => ({
    name: a.applicant_name, course_interest: a.course,
    source: a.referral_source || "—", status: a.status,
    follow_up_date: a.created_at?.slice(0,10),
  }))

  // ════════════════════════════════════════════════════════
  // DOUBTS
  // ════════════════════════════════════════════════════════
  const totalDoubts = doubtSessionsData.length
  const resolvedDoubts = doubtSessionsData.filter(d => d.status === "Resolved" || d.resolved_date).length
  const unresolvedDoubts = totalDoubts - resolvedDoubts
  const avgResolutionHrs = 0
  const doubtsBySubject = []
  const doubtsByBatch = []
  const doubtStaffLeaderboard = []
  const doubtTrend = ACADEMIC_MONTHS.map(m => ({month: m.label, raised: 0, resolved: 0}))

  // ════════════════════════════════════════════════════════
  // PARENTS / SMS
  // ════════════════════════════════════════════════════════
  const totalSMSSent = smsLogsData.reduce((s, l) => s + (Number(l.count) || 1), 0)
  const smsSent = smsLogsData.filter(l => l.status === "Sent" || l.status === "Delivered").length
  const smsFailed = smsLogsData.filter(l => l.status === "Failed").length
  const smsDeliveryRate = pct(smsSent, smsLogsData.length)
  const smsTypeMap2 = {}
  smsLogsData.forEach(l => { const t = l.message_type || "General"; smsTypeMap2[t] = (smsTypeMap2[t] || 0) + (Number(l.count) || 1) })
  const smsByType = Object.entries(smsTypeMap2).map(([name, count], i) => ({name, count, color: COURSE_COLORS[i % COURSE_COLORS.length]}))
  const smsMonthMap2 = {}
  smsLogsData.forEach(l => { const mo = l.sent_at?.slice(0,7); if(!mo) return; smsMonthMap2[mo] = (smsMonthMap2[mo] || 0) + (Number(l.count) || 1) })
  const smsTrend = ACADEMIC_MONTHS.map(m => ({month: m.label, count: smsMonthMap2[m.key] || 0}))

  // ════════════════════════════════════════════════════════
  // STUDY MATERIAL
  // ════════════════════════════════════════════════════════
  const totalMaterials = studyMaterialData.length
  const distributedMat = studyMaterialData.filter(m => (Number(m.distributed_copies) || 0) > 0).length
  const pendingDistribution = totalMaterials - distributedMat
  const totalCopies = studyMaterialData.reduce((s, m) => s + (Number(m.total_copies) || 0), 0)
  const distributedCopies = studyMaterialData.reduce((s, m) => s + (Number(m.distributed_copies) || 0), 0)
  const matTypeMap2 = {}
  studyMaterialData.forEach(m => { const t = m.material_type || "Notes"; matTypeMap2[t] = (matTypeMap2[t] || 0) + 1 })
  const materialByType = Object.entries(matTypeMap2).map(([name, count], i) => ({name, count, color: COURSE_COLORS[i % COURSE_COLORS.length]}))
  const matSubjectMap2 = {}
  studyMaterialData.forEach(m => {
    const s = m.subject || "Other"
    if(!matSubjectMap2[s]) matSubjectMap2[s] = {total: 0, distributed: 0}
    matSubjectMap2[s].total += Number(m.total_copies) || 0
    matSubjectMap2[s].distributed += Number(m.distributed_copies) || 0
  })
  const materialBySubject = Object.entries(matSubjectMap2).map(([subject, v], i) => ({
    subject, total: v.total, distributed: v.distributed, color: COURSE_COLORS[i % COURSE_COLORS.length]
  }))

  // ════════════════════════════════════════════════════════
  // RESULTS / SELECTIONS
  // ════════════════════════════════════════════════════════
  const totalSelections = selectionsData.length
  const jnvSelections = selectionsData.filter(s => s.exam_name?.toLowerCase().includes("jnv") || s.exam_name?.toLowerCase().includes("navodaya")).length
  const sainikSelections = selectionsData.filter(s => s.exam_name?.toLowerCase().includes("sainik")).length
  const otherSelections = totalSelections - jnvSelections - sainikSelections
  const selectionByYear2 = {}
  selectionsData.forEach(s => { const y = s.year || "Unknown"; selectionByYear2[y] = (selectionByYear2[y] || 0) + 1 })
  const selectionTrend = Object.entries(selectionByYear2).sort((a,b) => a[0].localeCompare(b[0])).map(([year, count]) => ({year, count}))
  const selectionByExam2 = {}
  selectionsData.forEach(s => { const e = s.exam_name || "Other"; selectionByExam2[e] = (selectionByExam2[e] || 0) + 1 })
  const selByExam = Object.entries(selectionByExam2).map(([name, count], i) => ({name, count, color: COURSE_COLORS[i % COURSE_COLORS.length]}))
  const selectionByBatch2 = {}
  selectionsData.forEach(s => { const b = s.batch_name || "Unknown"; selectionByBatch2[b] = (selectionByBatch2[b] || 0) + 1 })
  const selByBatch = Object.entries(selectionByBatch2).map(([batch, count], i) => ({batch, count, color: COURSE_COLORS[i % COURSE_COLORS.length]}))
  const recentSelections = selectionsData.slice(-8).reverse()

  // ════════════════════════════════════════════════════════
  // TEACHING / SYLLABUS
  // ════════════════════════════════════════════════════════
  const totalTopics = syllabusCoverageData.reduce((s, r) => s + (Number(r.total_topics) || 0), 0)
  const coveredTopics = syllabusCoverageData.reduce((s, r) => s + (Number(r.covered_topics) || 0), 0)
  const overallCoverage = pct(coveredTopics, totalTopics)
  const teacherCoverageMap = {}
  syllabusCoverageData.forEach(r => {
    const t = r.teacher_name || "Unknown"
    if(!teacherCoverageMap[t]) teacherCoverageMap[t] = {name: t, total: 0, covered: 0, subjects: new Set()}
    teacherCoverageMap[t].total += Number(r.total_topics) || 0
    teacherCoverageMap[t].covered += Number(r.covered_topics) || 0
    if(r.subject) teacherCoverageMap[t].subjects.add(r.subject)
  })
  const teacherCoverage = Object.values(teacherCoverageMap).map(t => ({
    name: t.name, total: t.total, covered: t.covered,
    pct: t.total > 0 ? pct(t.covered, t.total) : 0, subjects: t.subjects.size
  })).sort((a,b) => b.pct - a.pct)
  const subjectCoverageMap = {}
  syllabusCoverageData.forEach(r => {
    const s = r.subject || "Other"
    if(!subjectCoverageMap[s]) subjectCoverageMap[s] = {total: 0, covered: 0}
    subjectCoverageMap[s].total += Number(r.total_topics) || 0
    subjectCoverageMap[s].covered += Number(r.covered_topics) || 0
  })
  const subjectCoverage = Object.entries(subjectCoverageMap).map(([subject, v], i) => ({
    subject: subject.slice(0,10), total: v.total, covered: v.covered,
    pct: v.total > 0 ? pct(v.covered, v.total) : 0, color: COURSE_COLORS[i % COURSE_COLORS.length]
  }))
  const coverageMonthMap2 = {}
  syllabusCoverageData.forEach(r => {
    const mo = r.month || ""
    if(!mo) return
    if(!coverageMonthMap2[mo]) coverageMonthMap2[mo] = {total: 0, covered: 0}
    coverageMonthMap2[mo].total += Number(r.total_topics) || 0
    coverageMonthMap2[mo].covered += Number(r.covered_topics) || 0
  })
  const coverageTrend = ACADEMIC_MONTHS.map(m => ({
    month: m.label, pct: coverageMonthMap2[m.key]?.total > 0 ? pct(coverageMonthMap2[m.key].covered, coverageMonthMap2[m.key].total) : 0
  }))

  // ════════════════════════════════════════════════════════
  // EXPENSES
  // ════════════════════════════════════════════════════════
  const totalExpenses = expensesData.reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const netPL = totalFeeCollected - totalExpenses
  const expenseCategoryMap = {}
  expensesData.forEach(e => { const c = e.category || "Other"; expenseCategoryMap[c] = (expenseCategoryMap[c] || 0) + (Number(e.amount) || 0) })
  const expenseByCategory = Object.entries(expenseCategoryMap).sort((a,b) => b[1]-a[1]).map(([name, amount], i) => ({name, amount, color: COURSE_COLORS[i % COURSE_COLORS.length]}))

  const expenseMonthMap2 = {}
  expensesData.forEach(e => {
    const mo = e.entry_date?.slice(0,7)
    if(!mo) return
    expenseMonthMap2[mo] = (expenseMonthMap2[mo] || 0) + (Number(e.amount) || 0)
  })
  const plTrend = ACADEMIC_MONTHS.map(m => ({
    month: m.label,
    income: allIncome.filter(r => r.entry_date?.startsWith(m.key)).reduce((s, r) => s + (Number(r.amount) || 0), 0),
    expense: expenseMonthMap2[m.key] || 0,
  })).map(m => ({...m, pl: m.income - m.expense}))

  const recentExpenses = expensesData.slice(-6).reverse()

  // ════════════════════════════════════════════════════════
  // NOTIFICATIONS
  // ════════════════════════════════════════════════════════
  const notifications = []
  if(taskOverdue > 0) notifications.push({type: "warning", msg: `${taskOverdue} checklist tasks overdue`, time: "Just now"})
  if(defaultersRes.data?.length > 0) notifications.push({type: "error", msg: `${defaultersRes.data.length} students have outstanding fees`, time: "Today"})
  if(recentFeeRes.data?.length > 0) {
    const last = recentFeeRes.data[0]
    notifications.push({type: "success", msg: `${fmt(last.amount_paid || 0)} collected — ${last.description || last.fee_type || "fee"}`, time: last.pay_date || "Today"})
  }
  if(openEnquiries > 0) notifications.push({type: "info", msg: `${openEnquiries} applications pending review`, time: "This week"})

  // ════════════════════════════════════════════════════════
  // RETURN
  // ════════════════════════════════════════════════════════
  return {
    totalStudents: admEnrolled || totalStudentsCount, maleStudents, femaleStudents,
    boarders, dayBoarders, dayScholars, stateData, ageDistribution,
    totalAdmissions: allAdm.length, admApplied, admUnderReview, admAdmitted, admEnrolled, admRejected, admWaitlisted,
    courseBreakdown, applicationSource, yoyAdmissions, recentAdmissions: recentAdmRes.data || [], admissionFunnel,
    totalFeeCollected, feePending, admFeeTotal, flatFeeTotal, courseFeeTotal, totalWaivers, monthlyFees, feeAging, feeWaivers, scholarships,
    recentFeeActivity: recentFeeRes.data || [],
    defaulters: (defaultersRes.data || []).map(d => ({name: d.student_name || "—", gcc: `GCC-${d.gcc_no}`, due: Number(d.amount_due) || 0, course: d.course || "—", status: d.status})),
    totalStaff, activeStaffCnt, totalSalaryBill, taskPending, taskDone, taskOverdue, taskByDept, topStaff, latestMonth, allTasks,
    salaryTrend, leaveBreakdown, recruitmentFunnel, trainingHours, staffRadar, slaBreach,
    presentToday, absentToday, lateToday, totalToday, attendanceWeek, monthlyAttTrend, scatterData: [],
    avgScore: avgScore_all, passRate, aPlusCount, atRisk, gradeDistribution, subjectScores, scoreByCourseFallback: [],
    hostelRooms, hostelTotalRooms, hostelOccupied, hostelVacant, messChartData, hostelIncidentChart,
    housePoints, serviceHours, clubsFormatted, sportsFormatted, achievementsFormatted, notifications,
    totalBatches, activeBatches, totalCapacity, totalStrength, batchFillRate, batchesData, batchByType, timetableChart,
    totalTests, totalTestEntries, avgTestScore, testByType, topPerformers, testSubjectScores, batchScores, testTrend, atRiskStudents,
    totalEnquiries, openEnquiries, convertedEnq, conversionRate, followUpDue, enqBySource, enqByCourse, enqTrend,
    enquiryFunnel, recentEnquiries,
    totalDoubts, resolvedDoubts, unresolvedDoubts, avgResolutionHrs, doubtsBySubject, doubtsByBatch, doubtStaffLeaderboard, doubtTrend,
    totalSMSSent, smsSent, smsFailed, smsDeliveryRate, smsByType, smsTrend,
    totalMaterials, distributedMat, pendingDistribution, totalCopies, distributedCopies, materialByType, materialBySubject,
    totalSelections, jnvSelections, sainikSelections, otherSelections, selectionTrend, selByExam, selByBatch, recentSelections,
    overallCoverage, teacherCoverage, subjectCoverage, coverageTrend,
    totalExpenses, netPL, expenseByCategory, plTrend, recentExpenses,
  }
}



export default function GNSIDashboard({ scrollToSection }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [now, setNow] = useState(new Date())
  const [liveTotal, setLiveTotal] = useState(0)

  const sectionRefs = useRef({})
  const setSectionRef = (id) => (el) => { if (el) sectionRefs.current[id] = el }

  useEffect(() => {
    if (!loading && scrollToSection && sectionRefs.current[scrollToSection]) {
      setTimeout(() => {
        sectionRefs.current[scrollToSection].scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 150)
    }
  }, [loading, scrollToSection])

  useEffect(()=>{const t=setInterval(()=>setNow(new Date()),60000);return()=>clearInterval(t)},[])

  useEffect(()=>{
    const channel=supabase.channel("gnsi-live")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"accounts"},
        payload=>{
          if(payload.new.type==="Income"){
            const amt=Number(payload.new.amount)||0
            setLiveTotal(v=>v+amt)
          }
        })
      .subscribe()
    return()=>{channel.unsubscribe()}
  },[])

  const load = useCallback(async()=>{
    setLoading(true); setError(null)
    try{
      const d=await loadAllData()
      setData(d)
      setLiveTotal(d.totalFeeCollected)
    } catch(e){
      console.error(e)
      setError(e.message)
    } finally{
      setLoading(false)
    }
  },[])

  useEffect(()=>{load()},[load])

  if(error) return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12}}>
      <div style={{color:T.rose,fontSize:14,fontWeight:700}}>❌ {error}</div>
      <button onClick={load} style={{padding:"10px 24px",borderRadius:12,border:"none",background:T.primary,color:T.textInverse,fontWeight:700,cursor:"pointer",boxShadow:T.shadowMd}}>Retry</button>
    </div>
  )

  if(loading||!data) return(
    <div style={{minHeight:"100vh",background:T.bg,padding:32,display:"flex",gap:20}}>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}50%{background-position:0 0}100%{background-position:200% 0}}`}</style>
      <div style={{flex:1,display:"flex",flexDirection:"column",gap:16}}>
        <Skeleton h={48} w={300} r={10}/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>
          {[...Array(6)].map((_,i)=><Skeleton key={i} h={130} r={16}/>)}
        </div>
        <Skeleton h={260} r={16}/>
      </div>
    </div>
  )

  const feeProgress=pct(liveTotal,liveTotal+data.feePending)
  const attProgress=pct(data.presentToday,data.totalToday)

  return(
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:"'Inter','DM Sans','Segoe UI',system-ui,sans-serif",color:T.text}}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes shimmer{0%{background-position:200% 0}50%{background-position:0 0}100%{background-position:200% 0}}
        @keyframes slideIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box;scrollbar-width:thin;scrollbar-color:${T.border} transparent}
        ::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:${T.border};border-radius:3px}
        html{scroll-behavior:smooth}
      `}</style>

      <div style={{padding:"26px 30px",maxWidth:"100%"}}>

        {/* ═══ OVERVIEW ══════════════════════════════════════════ */}
        <div ref={setSectionRef('overview')}>
        <section style={{marginBottom:48}}>
          <div style={{marginBottom:24}}>
            <h1 style={{fontSize:26,fontWeight:900,margin:0,color:T.text,letterSpacing:"-0.03em"}}>Good {now.getHours()<12?"Morning":now.getHours()<17?"Afternoon":"Evening"} 👋</h1>
            <p style={{color:T.textMuted,fontSize:14,margin:"6px 0 0",fontWeight:500}}>{now.toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"})} · AY {CURRENT_YEAR}–{CURRENT_YEAR+1}</p>
          </div>

          {/* Live Fee Banner */}
          <div style={{
            background: `linear-gradient(135deg, ${T.primarySoft}, #eff6ff)`,
            border: `1px solid ${T.primary}25`,
            borderRadius: 20,
            padding: "22px 28px",
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 20,
            boxShadow: `0 4px 20px ${T.primary}15`,
            position: "relative",
            overflow: "hidden",
          }}>
            <div style={{
              position: "absolute",
              top: 0, right: 0,
              width: 200, height: 200,
              background: `radial-gradient(circle at top right, ${T.primary}10, transparent 60%)`,
              pointerEvents: "none",
            }}/>
            <div style={{display:"flex",alignItems:"center",gap:16,position:"relative",zIndex:1}}>
              <div style={{
                width: 52, height: 52,
                borderRadius: 16,
                background: `linear-gradient(135deg, ${T.primary}, ${T.primaryLight})`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 26,
                boxShadow: `0 4px 16px ${T.primary}40`,
              }}>💰</div>
              <div>
                <div style={{fontSize:11,color:T.primary,fontWeight:800,textTransform:"uppercase",letterSpacing:".12em"}}>Live Fee Collection · AY {CURRENT_YEAR}–{CURRENT_YEAR+1}</div>
                <div style={{fontSize:32,fontWeight:900,color:T.text,letterSpacing:"-.03em",marginTop:4}}>{fmt(liveTotal)}</div>
              </div>
            </div>
            <div style={{flex:1,maxWidth:320,position:"relative",zIndex:1}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,fontSize:12,color:T.textSecondary}}>
                <span>Collection progress</span>
                <span style={{color:T.primary,fontWeight:800}}>{feeProgress}% · {fmt(data.feePending)} pending</span>
              </div>
              <ProgressBar value={liveTotal} max={liveTotal+data.feePending} color={T.primary} height={10} gradient/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:18,textAlign:"center",position:"relative",zIndex:1}}>
              {[{label:"Admission",val:data.admFeeTotal,color:T.secondary},{label:"Flat Fee",val:data.flatFeeTotal,color:T.sky},{label:"Course",val:data.courseFeeTotal,color:T.emerald}].map(x=>(
                <div key={x.label}>
                  <div style={{fontSize:10,color:x.color,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.05em"}}>{x.label}</div>
                  <div style={{fontSize:14,fontWeight:800,color:T.text,marginTop:3}}>{fmt(x.val)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* KPI Grid */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:16,marginBottom:24}}>
            <KPI icon="🎓" label="Students" value={data.totalStudents} color={T.sky} sub={`${data.admEnrolled||data.totalStudents} enrolled`} gradient/>
            <KPI icon="🗂️" label="Batches" value={data.activeBatches} color={T.indigo} sub={`${data.totalBatches} total · ${data.batchFillRate}% fill`} gradient/>
            <KPI icon="📝" label="Exam Entries" value={data.totalTestEntries} color={T.secondary} sub={`Avg score ${data.avgTestScore}%`} gradient/>
            <KPI icon="🔍" label="Applications" value={data.totalEnquiries} color={T.amber} sub={`${data.convertedEnq} enrolled · ${data.conversionRate}%`} gradient/>
            <KPI icon="✅" label="Present Today" value={data.presentToday} color={T.emerald} progress={data.presentToday} progressMax={data.totalToday} gradient/>
            <KPI icon="🏅" label="Selections" value={data.totalSelections} color={T.primary} sub={`JNV: ${data.jnvSelections} · Sainik: ${data.sainikSelections}`} gradient/>
            <KPI icon="💸" label="Fee Pending" value={data.feePending} color={T.rose} isMoney gradient/>
            <KPI icon="📉" label="Net P&L" value={data.netPL} color={data.netPL>=0?T.emerald:T.rose} isMoney sub={`Exp: ${fmt(data.totalExpenses)}`} gradient/>
          </div>

          {/* Charts Row */}
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:20,marginBottom:20}}>
            <Panel title="Monthly Fee Collection vs Target" icon="📊" accent={T.primary}>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={data.monthlyFees}>
                  <XAxis dataKey="month" tick={{fill:T.textMuted,fontSize:11}} axisLine={false} tickLine={false}/>
                  <YAxis hide/>
                  <Tooltip content={<Tip/>} cursor={{fill:"rgba(0,0,0,.03)"}}/>
                  <Bar dataKey="collected" name="Collected" radius={[6,6,0,0]} barSize={24}>
                    {data.monthlyFees.map((m,i)=><Cell key={i} fill={m.collected>0?T.primary:`${T.textMuted}33`}/>)}
                  </Bar>
                  <Line dataKey="target" name="Target" stroke={T.rose} strokeWidth={2} strokeDasharray="4 3" dot={false}/>
                </ComposedChart>
              </ResponsiveContainer>
            </Panel>
            <Panel title="Admission Pipeline" sub="Lead to enrolment" icon="🔄" accent={T.secondary}>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {data.enquiryFunnel.map((s,i,arr)=>{const prev=arr[i-1];return(
                  <div key={s.stage}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                      <span style={{fontSize:12,color:T.textSecondary,fontWeight:500}}>{s.stage}</span>
                      <div><span style={{fontSize:14,fontWeight:800,color:s.color}}>{s.count}</span>{prev&&<span style={{fontSize:11,color:T.textMuted}}> ({pct(s.count,prev.count)}%)</span>}</div>
                    </div>
                    <ProgressBar value={s.count} max={data.enquiryFunnel[0].count||1} color={s.color} height={8} gradient/>
                  </div>
                )})}
              </div>
            </Panel>
          </div>

          {/* Three Column Row */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:20,marginBottom:20}}>
            <Panel title="Recent Fee Activity" icon="💳" accent={T.emerald}>
              {data.recentFeeActivity.length===0?<EmptyState msg="No payments yet"/>:(
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {data.recentFeeActivity.map((a,i)=>(
                    <div key={i} style={{
                      display:"flex",alignItems:"center",gap:10,
                      padding:"10px 12px",borderRadius:12,
                      background:T.bgSurface,
                      border:`1px solid ${T.border}`,
                      transition:"all 0.2s ease",
                    }}
                    onMouseEnter={e=>{e.currentTarget.style.boxShadow=T.shadowMd;e.currentTarget.style.transform="translateX(4px)"}}
                    onMouseLeave={e=>{e.currentTarget.style.boxShadow="none";e.currentTarget.style.transform="translateX(0)"}}
                    >
                      <div style={{
                        width:36,height:36,borderRadius:10,flexShrink:0,
                        background:`linear-gradient(135deg, ${T.emeraldSoft}, ${T.emerald}20)`,
                        display:"flex",alignItems:"center",justifyContent:"center",
                        fontSize:13,fontWeight:800,color:T.emerald,
                        border:`1px solid ${T.emerald}25`,
                      }}>{(a.description||a.fee_type||"?")[0].toUpperCase()}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:700,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.description||a.fee_type||"—"}</div>
                        <div style={{fontSize:11,color:T.textMuted}}>{a.pay_date||"—"} · {a.pay_mode||"—"}</div>
                      </div>
                      <div style={{textAlign:"right",flexShrink:0}}>
                        <div style={{fontSize:13,fontWeight:800,color:T.emerald}}>{fmt(a.amount_paid)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
            <Panel title="⚠️ Defaulters" icon="🚨" accent={T.rose}>
              {data.defaulters.length===0?<div style={{color:T.emerald,fontSize:14,fontWeight:700,padding:16,textAlign:"center",background:T.emeraldSoft,borderRadius:12}}>✅ No outstanding fees!</div>:(
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {data.defaulters.map((d,i)=>(
                    <div key={i} style={{
                      padding:"10px 12px",borderRadius:12,
                      background:T.roseSoft,
                      border:`1px solid ${T.rose}20`,
                      transition:"all 0.2s ease",
                    }}
                    onMouseEnter={e=>{e.currentTarget.style.boxShadow=`0 4px 12px ${T.rose}20`;e.currentTarget.style.transform="scale(1.02)"}}
                    onMouseLeave={e=>{e.currentTarget.style.boxShadow="none";e.currentTarget.style.transform="scale(1)"}}
                    >
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                        <div style={{fontSize:13,fontWeight:700,color:T.text}}>{d.name}</div>
                        <div style={{fontSize:13,fontWeight:800,color:T.rose}}>{fmt(d.due)}</div>
                      </div>
                      <div style={{fontSize:11,color:T.textMuted}}>{d.gcc} · {d.course}</div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
            <Panel title="🔔 Notifications" icon="🔔" accent={T.primary}>
              {data.notifications.length===0?<EmptyState msg="All clear!"/>:(
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {data.notifications.map((n,i)=>{const c={warning:T.amber,error:T.rose,success:T.emerald,info:T.sky}[n.type];const ic={warning:"⚠️",error:"🔴",success:"✅",info:"ℹ️"}[n.type];return(
                    <div key={i} style={{
                      display:"flex",gap:10,padding:"10px 12px",borderRadius:12,
                      background:`${c}08`,
                      border:`1px solid ${c}18`,
                      transition:"all 0.2s ease",
                    }}
                    onMouseEnter={e=>{e.currentTarget.style.transform="translateX(4px)";e.currentTarget.style.boxShadow=`0 4px 12px ${c}15`}}
                    onMouseLeave={e=>{e.currentTarget.style.transform="translateX(0)";e.currentTarget.style.boxShadow="none"}}
                    >
                      <span style={{fontSize:16}}>{ic}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,color:T.text,lineHeight:1.5,fontWeight:500}}>{n.msg}</div>
                        <div style={{fontSize:10,color:T.textMuted,marginTop:3,fontWeight:600}}>{n.time}</div>
                      </div>
                    </div>
                  )})}
                </div>
              )}
            </Panel>
          </div>

          {/* Admission Pipeline */}
          <Panel title="Admission Pipeline" sub="Live conversion rates" icon="🎯" accent={T.secondary}>
            <div style={{display:"flex",alignItems:"stretch",gap:10}}>
              {data.admissionFunnel.map((s,i,arr)=>{const prev=arr[i-1];const conv=prev?pct(s.count,prev.count):100;return(
                <div key={s.stage} style={{flex:1,position:"relative"}}>
                  <div style={{
                    background:`linear-gradient(135deg, ${s.color}10, ${s.color}05)`,
                    border:`1px solid ${s.color}25`,
                    borderRadius:16,padding:"18px 14px",textAlign:"center",
                    transition:"all 0.3s ease",
                  }}
                  onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-4px)";e.currentTarget.style.boxShadow=`0 8px 24px ${s.color}20`}}
                  onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="none"}}
                  >
                    <div style={{fontSize:24,fontWeight:900,color:s.color}}><Counter value={s.count}/></div>
                    <div style={{fontSize:12,color:T.textSecondary,marginTop:4,fontWeight:600}}>{s.stage}</div>
                    {i>0&&<div style={{fontSize:12,fontWeight:700,marginTop:6,color:conv>=80?T.emerald:conv>=60?T.amber:T.rose}}>{conv}% conv.</div>}
                  </div>
                  {i<3&&<div style={{position:"absolute",right:-10,top:"50%",transform:"translateY(-50%)",color:T.textMuted,fontSize:20,zIndex:2,fontWeight:300}}>›</div>}
                </div>
              )})}
            </div>
          </Panel>
        </section>
        </div>

        {/* ═══ FINANCE ═══════════════════════════════════════════ */}
        <div ref={setSectionRef('finance')}>
        <section style={{marginBottom:48}}>
          <SectionHeader icon="💰" title="Finance & Fee Analytics" color={T.primary}/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:16,marginBottom:24}}>
            <KPI icon="💰" label="Total Collected" value={liveTotal} isMoney color={T.primary} gradient/>
            <KPI icon="📌" label="Fee Pending" value={data.feePending} isMoney color={T.rose} gradient/>
            <KPI icon="🎓" label="Admission Fee" value={data.admFeeTotal} isMoney color={T.secondary} gradient/>
            <KPI icon="📄" label="Flat Fee" value={data.flatFeeTotal} isMoney color={T.sky} gradient/>
            <KPI icon="📚" label="Course Fee" value={data.courseFeeTotal} isMoney color={T.emerald} gradient/>
            <KPI icon="🎁" label="Waivers Given" value={data.totalWaivers} isMoney color={T.amber} gradient/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:20,marginBottom:20}}>
            <Panel title="Monthly Collection vs Target" icon="📈" accent={T.primary}>
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={data.monthlyFees}>
                  <defs>
                    <linearGradient id="feeGradLight" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={T.primary} stopOpacity={0.2}/>
                      <stop offset="95%" stopColor={T.primary} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{fill:T.textMuted,fontSize:11}} axisLine={false} tickLine={false}/>
                  <YAxis hide/><Tooltip content={<Tip/>}/>
                  <Area dataKey="collected" name="Collected" stroke={T.primary} strokeWidth={2.5} fill="url(#feeGradLight)"/>
                  <Line dataKey="target" name="Target" stroke={T.rose} strokeWidth={2} strokeDasharray="4 3" dot={false}/>
                </AreaChart>
              </ResponsiveContainer>
            </Panel>
            <Panel title="Fee Aging Buckets" icon="⏰" accent={T.amber}>
              {data.feeAging.every(f=>f.amount===0)?<EmptyState msg="No outstanding invoices"/>:data.feeAging.map(f=>(
                <div key={f.bucket} style={{marginBottom:16}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                    <span style={{fontSize:13,color:T.textSecondary,fontWeight:500}}>{f.bucket}</span>
                    <span style={{fontSize:14,fontWeight:800,color:f.color}}>{fmt(f.amount)}</span>
                  </div>
                  <ProgressBar value={f.amount} max={data.feePending||1} color={f.color} height={7} gradient/>
                </div>
              ))}
            </Panel>
          </div>
          <Panel title="Fee Defaulters" icon="📋" accent={T.rose}>
            {data.defaulters.length===0?<div style={{color:T.emerald,fontWeight:700,fontSize:14,padding:20,textAlign:"center",background:T.emeraldSoft,borderRadius:12}}>✅ No outstanding invoices!</div>:(
              <table style={{width:"100%",borderCollapse:"separate",borderSpacing:"0 6px"}}>
                <thead><tr>{["Student","GCC","Course","Due","Status"].map(h=><th key={h} style={{textAlign:"left",fontSize:11,color:T.textMuted,fontWeight:700,padding:"8px 14px",textTransform:"uppercase",letterSpacing:".06em"}}>{h}</th>)}</tr></thead>
                <tbody>{data.defaulters.map((d,i)=>(
                  <tr key={i} style={{transition:"all 0.2s ease"}}>
                    {[d.name,d.gcc,d.course,fmt(d.due)].map((v,j)=><td key={j} style={{
                      fontSize:13,color:j===3?T.rose:T.text,fontWeight:j===3?800:500,
                      padding:"10px 14px",background:T.bgSurface,
                      borderRadius:j===0?"12px 0 0 12px":j===3?"0 12px 12px 0":"0",
                      borderTop:`1px solid ${T.borderLight}`,
                      borderBottom:`1px solid ${T.borderLight}`,
                      borderLeft:j===0?`1px solid ${T.borderLight}`:"none",
                      borderRight:j===3?`1px solid ${T.borderLight}`:"none",
                    }}>{v}</td>)}
                    <td style={{padding:"10px 14px",background:T.bgSurface,borderRadius:"0 12px 12px 0",borderTop:`1px solid ${T.borderLight}`,borderBottom:`1px solid ${T.borderLight}`,borderRight:`1px solid ${T.borderLight}`}}>
                      <Badge label={d.status} color={statusColor(d.status)} soft/>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </Panel>
        </section>
        </div>



        {/* ═══ STUDENTS ══════════════════════════════════════════ */}
        <div ref={setSectionRef('students')}>
        <section style={{marginBottom:48}}>
          <SectionHeader icon="🎓" title="Student Analytics" color={T.sky}/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:16,marginBottom:24}}>
            <KPI icon="👥" label="Total" value={data.totalStudents} color={T.sky} gradient/>
            <KPI icon="👦" label="Male" value={data.maleStudents} color={T.sky} progress={data.maleStudents} progressMax={data.totalStudents} gradient/>
            <KPI icon="👧" label="Female" value={data.femaleStudents} color={T.pink} progress={data.femaleStudents} progressMax={data.totalStudents} gradient/>
            <KPI icon="🏠" label="Boarders" value={data.boarders} color={T.secondary} gradient/>
            <KPI icon="🚌" label="Day Boarders" value={data.dayBoarders} color={T.amber} gradient/>
            <KPI icon="🏡" label="Day Scholars" value={data.dayScholars} color={T.emerald} gradient/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:20,marginBottom:20}}>
            <Panel title="Gender Split" icon="⚖️" accent={T.sky}>
              <div style={{display:"flex",alignItems:"center",gap:20}}>
                <Gauge value={data.totalStudents>0?pct(data.maleStudents,data.totalStudents):0} color={T.sky} size={100}/>
                <div style={{flex:1}}>
                  {[{l:"Male",v:data.maleStudents,c:T.sky},{l:"Female",v:data.femaleStudents,c:T.pink}].map(x=>(
                    <div key={x.l} style={{marginBottom:12}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                        <span style={{fontSize:13,color:T.textSecondary,fontWeight:500}}>{x.l}</span>
                        <span style={{fontSize:13,fontWeight:800,color:x.c}}>{x.v}</span>
                      </div>
                      <ProgressBar value={x.v} max={data.totalStudents||1} color={x.c} gradient/>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
            <Panel title="Course Distribution" icon="📊" accent={T.secondary}>
              {data.courseBreakdown.length===0?<EmptyState msg="No course data"/>:(
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {data.courseBreakdown.map(s=>(
                    <div key={s.name}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                        <span style={{fontSize:12,color:T.textSecondary,fontWeight:500}}>{s.name}</span>
                        <span style={{fontSize:12,fontWeight:700,color:s.color}}>{s.students}</span>
                      </div>
                      <ProgressBar value={s.students} max={data.courseBreakdown[0]?.students||1} color={s.color} height={5} gradient/>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
            <Panel title="Hostel Type" icon="🏠" accent={T.emerald}>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie data={[{name:"Boarder",value:data.boarders,color:T.secondary},{name:"Day Boarder",value:data.dayBoarders,color:T.amber},{name:"Day Scholar",value:data.dayScholars,color:T.emerald}].filter(x=>x.value>0)} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={4}>
                    {[T.secondary,T.amber,T.emerald].map((c,i)=><Cell key={i} fill={c}/>)}
                  </Pie>
                  <Tooltip content={<Tip/>}/>
                  <Legend formatter={v=><span style={{color:T.textSecondary,fontSize:12,fontWeight:500}}>{v}</span>}/>
                </PieChart>
              </ResponsiveContainer>
            </Panel>
          </div>
          <Panel title="Recent Admissions" icon="📝" accent={T.primary}>
            {data.recentAdmissions.length===0?<EmptyState msg="No admissions"/>:(
              <table style={{width:"100%",borderCollapse:"separate",borderSpacing:"0 6px"}}>
                <thead><tr>{["Name","Batch","Status","Date"].map(h=><th key={h} style={{textAlign:"left",fontSize:11,color:T.textMuted,fontWeight:700,padding:"6px 14px",textTransform:"uppercase",letterSpacing:".06em"}}>{h}</th>)}</tr></thead>
                <tbody>{data.recentAdmissions.map((a,i)=>(
                  <tr key={i}>
                    <td style={{fontSize:13,color:T.text,fontWeight:600,padding:"10px 14px",background:T.bgSurface,borderRadius:"12px 0 0 12px",borderTop:`1px solid ${T.borderLight}`,borderBottom:`1px solid ${T.borderLight}`,borderLeft:`1px solid ${T.borderLight}`}}>{a.applicant_name||"—"}</td>
                    <td style={{fontSize:13,color:T.text,padding:"10px 14px",background:T.bgSurface,borderTop:`1px solid ${T.borderLight}`,borderBottom:`1px solid ${T.borderLight}`}}>{a.batch||"—"}</td>
                    <td style={{padding:"10px 14px",background:T.bgSurface,borderTop:`1px solid ${T.borderLight}`,borderBottom:`1px solid ${T.borderLight}`}}><Badge label={a.status||"—"} color={statusColor(a.status)} soft/></td>
                    <td style={{padding:"10px 14px",background:T.bgSurface,borderRadius:"0 12px 12px 0",borderTop:`1px solid ${T.borderLight}`,borderBottom:`1px solid ${T.borderLight}`,borderRight:`1px solid ${T.borderLight}`,fontSize:12,color:T.textMuted}}>{a.created_at?.slice(0,10)||"—"}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </Panel>
        </section>
        </div>

        {/* ═══ ADMISSIONS ════════════════════════════════════════ */}
        <div ref={setSectionRef('admissions')}>
        <section style={{marginBottom:48}}>
          <SectionHeader icon="📋" title="Admissions Deep Dive" color={T.secondary}/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:16,marginBottom:24}}>
            <KPI icon="📩" label="Applied" value={data.admApplied} color={T.sky} gradient/>
            <KPI icon="🔍" label="Under Review" value={data.admUnderReview} color={T.secondary} gradient/>
            <KPI icon="✅" label="Admitted" value={data.admAdmitted} color={T.amber} gradient/>
            <KPI icon="🎓" label="Enrolled" value={data.admEnrolled} color={T.emerald} gradient/>
            <KPI icon="❌" label="Rejected" value={data.admRejected} color={T.rose} gradient/>
            <KPI icon="⏳" label="Waitlisted" value={data.admWaitlisted} color={T.textMuted} gradient/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>
            <Panel title="Admission Funnel" icon="🎯" accent={T.secondary}>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {data.admissionFunnel.map((s,i,arr)=>{const prev=arr[i-1];return(
                  <div key={s.stage}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                      <span style={{fontSize:13,color:T.textSecondary,fontWeight:500}}>{s.stage}</span>
                      <div><span style={{fontSize:15,fontWeight:800,color:s.color}}>{s.count}</span>{prev&&<span style={{fontSize:12,color:T.textMuted}}> ({pct(s.count,prev.count)}%)</span>}</div>
                    </div>
                    <ProgressBar value={s.count} max={data.admissionFunnel[0].count||1} color={s.color} height={12} gradient/>
                  </div>
                )})}
              </div>
            </Panel>
            <Panel title="Referral Source" icon="🔗" accent={T.primary}>
              {data.applicationSource.length===0?<EmptyState msg="No referral_source data"/>:(
                <ResponsiveContainer width="100%" height={210}>
                  <PieChart>
                    <Pie data={data.applicationSource} dataKey="value" cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4}>
                      {data.applicationSource.map((p,i)=><Cell key={i} fill={p.color}/>)}
                    </Pie>
                    <Tooltip content={<Tip/>}/>
                    <Legend formatter={v=><span style={{color:T.textSecondary,fontSize:12,fontWeight:500}}>{v}</span>}/>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Panel>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
            <Panel title="Course Breakdown" icon="📚" accent={T.coral}>
              {data.courseBreakdown.length===0?<EmptyState msg="No data"/>:(
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {data.courseBreakdown.map(c=>(
                    <div key={c.name}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                        <span style={{fontSize:13,color:T.textSecondary,fontWeight:500}}>{c.name}</span>
                        <span style={{fontSize:13,fontWeight:700,color:c.color}}>{c.students}</span>
                      </div>
                      <ProgressBar value={c.students} max={data.totalAdmissions||1} color={c.color} gradient/>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
            <Panel title="YoY Batch Growth" icon="📈" accent={T.primary}>
              {data.yoyAdmissions.length===0?<EmptyState msg="No batch data"/>:(
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={data.yoyAdmissions}>
                    <XAxis dataKey="year" tick={{fill:T.textMuted,fontSize:11}} axisLine={false} tickLine={false}/>
                    <YAxis hide/><Tooltip content={<Tip/>}/>
                    <Bar dataKey="count" name="Admissions" radius={[8,8,0,0]} barSize={36}>
                      {data.yoyAdmissions.map((y,i)=><Cell key={i} fill={i===data.yoyAdmissions.length-1?T.primary:`${T.primary}55`}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Panel>
          </div>
        </section>
        </div>

        {/* ═══ STAFF ══════════════════════════════════════════════ */}
        <div ref={setSectionRef('staff')}>
        <section style={{marginBottom:48}}>
          <SectionHeader icon="👨‍💼" title="Staff & HR" color={T.indigo}/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:16,marginBottom:24}}>
            <KPI icon="👥" label="Total Staff" value={data.totalStaff} color={T.sky} sub="From gnsi_staff_biodata" gradient/>
            <KPI icon="✅" label="Active" value={data.activeStaffCnt} color={T.emerald} gradient/>
            <KPI icon="💵" label="Salary Bill" value={data.totalSalaryBill} color={T.primary} isMoney gradient/>
            <KPI icon="📋" label="Tasks Pending" value={data.taskPending} color={T.amber} gradient/>
            <KPI icon="✔️" label="Tasks Done" value={data.taskDone} color={T.emerald} gradient/>
            <KPI icon="⚠️" label="Overdue" value={data.taskOverdue} color={T.rose} gradient/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>
            <Panel title="Management Checklist" sub="From management_checklist table" icon="📋" accent={T.indigo}>
              {data.allTasks?.length===0?<EmptyState msg="No checklist data"/>:(
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {data.allTasks?.map((t,i)=>(
                    <div key={i} style={{
                      padding:"12px 14px",borderRadius:12,
                      background:t.status==="Done"?T.emeraldSoft:T.amberSoft,
                      border:`1px solid ${t.status==="Done"?T.emerald:T.amber}20`,
                      transition:"all 0.2s ease",
                    }}
                    onMouseEnter={e=>{e.currentTarget.style.transform="translateX(6px)";e.currentTarget.style.boxShadow=T.shadowMd}}
                    onMouseLeave={e=>{e.currentTarget.style.transform="translateX(0)";e.currentTarget.style.boxShadow="none"}}
                    >
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                        <span style={{fontSize:13,fontWeight:700,color:T.text}}>{t.task||"—"}</span>
                        <Badge label={t.status||"Pending"} color={statusColor(t.status||"Pending")} soft/>
                      </div>
                      <div style={{fontSize:11,color:T.textMuted}}>{t.section} · {t.owner} · {t.priority}</div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
            <Panel title="Task Status" icon="📊" accent={T.emerald}>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:16}}>
                <Gauge value={data.taskPending+data.taskDone>0?pct(data.taskDone,data.taskPending+data.taskDone):0} color={T.emerald} size={100}/>
                <div style={{width:"100%"}}>
                  {[{l:"Done",v:data.taskDone,c:T.emerald},{l:"Pending",v:data.taskPending,c:T.amber},{l:"Overdue",v:data.taskOverdue,c:T.rose}].map(x=>(
                    <div key={x.l} style={{marginBottom:10}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                        <span style={{fontSize:13,color:T.textSecondary,fontWeight:500}}>{x.l}</span>
                        <span style={{fontSize:13,fontWeight:700,color:x.c}}>{x.v}</span>
                      </div>
                      <ProgressBar value={x.v} max={(data.taskPending+data.taskDone+data.taskOverdue)||1} color={x.c} height={6} gradient/>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          </div>
          <Panel title="Staff data will appear here once gnsi_staff_biodata is populated" accent={T.textMuted} icon="👤">
            <EmptyState msg="Add staff records to gnsi_staff_biodata to see salary trends, performance leaderboard, and recruitment pipeline" icon="👤"/>
          </Panel>
        </section>
        </div>

        {/* ═══ ATTENDANCE ════════════════════════════════════════ */}
        <div ref={setSectionRef('attendance')}>
        <section style={{marginBottom:48}}>
          <SectionHeader icon="✅" title="Attendance Analytics" color={T.emerald}/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:16,marginBottom:24}}>
            <KPI icon="✅" label="Present" value={data.presentToday} color={T.emerald} progress={data.presentToday} progressMax={data.totalToday} gradient/>
            <KPI icon="❌" label="Absent" value={data.absentToday} color={T.rose} gradient/>
            <KPI icon="⏰" label="Late" value={data.lateToday} color={T.amber} gradient/>
            <KPI icon="📊" label="Rate" value={attProgress} color={T.sky} sub={`${attProgress}% today`} gradient/>
          </div>
          {data.attendanceWeek.length===0?(
            <Panel><EmptyState msg="No attendance records yet. Add records to the attendance table to see analytics here."/></Panel>
          ):(
            <>
              <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:20,marginBottom:20}}>
                <Panel title="Last 7 Days" icon="📅" accent={T.emerald}>
                  <ResponsiveContainer width="100%" height={210}>
                    <BarChart data={data.attendanceWeek}>
                      <XAxis dataKey="day" tick={{fill:T.textMuted,fontSize:11}} axisLine={false} tickLine={false}/>
                      <YAxis hide/><Tooltip content={<Tip/>}/>
                      <Bar dataKey="present" name="Present" fill={T.emerald} radius={[4,4,0,0]} barSize={28} stackId="a"/>
                      <Bar dataKey="late" name="Late" fill={T.amber} barSize={28} stackId="a"/>
                      <Bar dataKey="absent" name="Absent" fill={T.rose} radius={[4,4,0,0]} barSize={28} stackId="a"/>
                    </BarChart>
                  </ResponsiveContainer>
                </Panel>
                <Panel title="Today" icon="📍" accent={T.emerald}>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:16,paddingTop:8}}>
                    <Gauge value={attProgress} max={100} color={T.emerald} size={110}/>
                    <div style={{width:"100%",display:"flex",flexDirection:"column",gap:8}}>
                      {[{label:"Present",val:data.presentToday,color:T.emerald},{label:"Absent",val:data.absentToday,color:T.rose},{label:"Late",val:data.lateToday,color:T.amber}].map(x=>(
                        <div key={x.label}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                            <span style={{fontSize:13,color:T.textSecondary,fontWeight:500}}>{x.label}</span>
                            <span style={{fontSize:13,fontWeight:700,color:x.color}}>{x.val}</span>
                          </div>
                          <ProgressBar value={x.val} max={data.totalToday||1} color={x.color} height={6} gradient/>
                        </div>
                      ))}
                    </div>
                  </div>
                </Panel>
              </div>
              <Panel title="Monthly Attendance Rate" icon="📈" accent={T.emerald}>
                <ResponsiveContainer width="100%" height={190}>
                  <AreaChart data={data.monthlyAttTrend}>
                    <defs>
                      <linearGradient id="attGradLight" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={T.emerald} stopOpacity={0.2}/>
                        <stop offset="95%" stopColor={T.emerald} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" tick={{fill:T.textMuted,fontSize:11}} axisLine={false} tickLine={false}/>
                    <YAxis domain={[0,100]} hide/><Tooltip content={<Tip/>}/>
                    <ReferenceLine y={85} stroke={T.amber} strokeDasharray="4 3" label={{value:"85% target",fill:T.amber,fontSize:11,fontWeight:700}}/>
                    <Area dataKey="rate" name="Attendance %" stroke={T.emerald} strokeWidth={2.5} fill="url(#attGradLight)"/>
                  </AreaChart>
                </ResponsiveContainer>
              </Panel>
            </>
          )}
        </section>
        </div>



        {/* ═══ ACADEMIC ══════════════════════════════════════════ */}
        <div ref={setSectionRef('academic')}>
        <section style={{marginBottom:48}}>
          <SectionHeader icon="📚" title="Academic Performance" color={T.secondary}/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:16,marginBottom:24}}>
            <KPI icon="📊" label="Avg Score" value={data.avgScore} color={T.sky} sub={`${data.avgScore}% overall`} gradient/>
            <KPI icon="✅" label="Pass Rate" value={data.passRate} color={T.emerald} sub={`${data.passRate}%`} gradient/>
            <KPI icon="🏆" label="A+ Students" value={data.aPlusCount} color={T.primary} gradient/>
            <KPI icon="📉" label="At Risk" value={data.atRisk} color={T.rose} sub="Below 35%" gradient/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>
            <Panel title="Grade Distribution" sub="From exam_marks table" icon="🎓" accent={T.secondary}>
              {data.gradeDistribution.every(g=>g.count===0)?<EmptyState msg="No exam_marks data"/>:(
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.gradeDistribution}>
                    <XAxis dataKey="grade" tick={{fill:T.textMuted,fontSize:13}} axisLine={false} tickLine={false}/>
                    <YAxis hide/><Tooltip content={<Tip/>}/>
                    <Bar dataKey="count" name="Students" radius={[6,6,0,0]} barSize={36}>
                      {data.gradeDistribution.map((g,i)=><Cell key={i} fill={g.color}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Panel>
            <Panel title="Subject Performance" sub="Avg score & pass rate" icon="📖" accent={T.sky}>
              {data.subjectScores.length===0?<EmptyState msg="No subject data"/>:(
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={data.subjectScores}>
                    <XAxis dataKey="subject" tick={{fill:T.textMuted,fontSize:11}} axisLine={false} tickLine={false}/>
                    <YAxis hide domain={[0,100]}/><Tooltip content={<Tip/>}/>
                    <Bar dataKey="avg" name="Avg Score" fill={T.sky} radius={[5,5,0,0]} barSize={18}/>
                    <Line dataKey="pass" name="Pass Rate" stroke={T.emerald} strokeWidth={2.5} dot={{fill:T.emerald,r:4}}/>
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </Panel>
          </div>
        </section>
        </div>

        {/* ═══ HOSTEL ════════════════════════════════════════════ */}
        <div ref={setSectionRef('hostel')}>
        <section style={{marginBottom:48}}>
          <SectionHeader icon="🛏️" title="Hostel & Boarding" color={T.coral}/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:16,marginBottom:24}}>
            <KPI icon="🏠" label="Boarders" value={data.boarders} color={T.sky} gradient/>
            <KPI icon="🛏️" label="Rooms Total" value={data.hostelTotalRooms} color={T.amber} gradient/>
            <KPI icon="✅" label="Occupied" value={data.hostelOccupied} color={T.emerald} progress={data.hostelOccupied} progressMax={data.hostelTotalRooms} gradient/>
            <KPI icon="📋" label="Incidents" value={data.hostelIncidentChart.reduce((s,m)=>s+m.count,0)} color={T.rose} gradient/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>
            <Panel title="Block Occupancy" icon="🏢" accent={T.coral}>
              {data.hostelRooms.length===0?<EmptyState msg="No hostel_rooms data"/>:(
                <div style={{display:"flex",flexDirection:"column",gap:13}}>
                  {data.hostelRooms.map(b=>(
                    <div key={b.block}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                        <span style={{fontSize:14,fontWeight:700,color:T.text}}>{b.block}</span>
                        <span style={{fontSize:14,fontWeight:800,color:b.color}}>{b.occupied}/{b.total}</span>
                      </div>
                      <ProgressBar value={b.occupied} max={b.total||1} color={b.color} height={10} gradient/>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
            <Panel title="Mess Consumption" icon="🍽️" accent={T.amber}>
              {data.messChartData.every(m=>m.breakfast===0)?<EmptyState msg="No mess_consumption data"/>:(
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={data.messChartData}>
                    <XAxis dataKey="month" tick={{fill:T.textMuted,fontSize:11}} axisLine={false} tickLine={false}/>
                    <YAxis hide/><Tooltip content={<Tip/>}/>
                    <Legend formatter={v=><span style={{color:T.textSecondary,fontSize:11,fontWeight:500}}>{v}</span>}/>
                    <Bar dataKey="breakfast" name="Breakfast" fill={T.amber} radius={[4,4,0,0]} barSize={10}/>
                    <Bar dataKey="lunch" name="Lunch" fill={T.emerald} radius={[4,4,0,0]} barSize={10}/>
                    <Bar dataKey="dinner" name="Dinner" fill={T.secondary} radius={[4,4,0,0]} barSize={10}/>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Panel>
          </div>
        </section>
        </div>

        {/* ═══ HOUSES ════════════════════════════════════════════ */}
        <div ref={setSectionRef('houses')}>
        <section style={{marginBottom:48}}>
          <SectionHeader icon="🏆" title="Houses & Co-curricular" color={T.primary}/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:16,marginBottom:24}}>
            {data.housePoints.map((h,i)=>(
              <div key={h.name} style={{
                background:`linear-gradient(135deg, ${h.color}10, ${h.color}05)`,
                border:`1px solid ${h.color}30`,
                borderRadius:20,padding:"18px 20px",
                transition:"all 0.3s ease",
                boxShadow: T.shadowMd,
              }}
              onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-4px)";e.currentTarget.style.boxShadow=`0 12px 32px ${h.color}20`}}
              onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow=T.shadowMd}}
              >
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <span style={{fontSize:22,fontWeight:900,color:h.color}}>#{i+1}</span>
                  <Badge label={h.name} color={h.color} soft/>
                </div>
                <div style={{fontSize:28,fontWeight:900,color:T.text,marginBottom:4}}><Counter value={h.points}/></div>
                <div style={{fontSize:12,color:T.textMuted,marginBottom:12,fontWeight:500}}>Total points</div>
                <ProgressBar value={h.points} max={data.housePoints[0]?.points||1} color={h.color} height={6} gradient/>
              </div>
            ))}
          </div>
          {data.housePoints.every(h=>h.points===0)&&<Panel><EmptyState msg="No house_points data yet. Add records to house_points table."/></Panel>}
        </section>
        </div>

        {/* ═══ OPERATIONS ════════════════════════════════════════ */}
        <div ref={setSectionRef('operations')}>
        <section style={{marginBottom:48}}>
          <SectionHeader icon="⚙️" title="Operations & Admin" color={T.teal}/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:16,marginBottom:24}}>
            <KPI icon="📋" label="Total Tasks" value={data.taskPending+data.taskDone+data.taskOverdue} color={T.sky} gradient/>
            <KPI icon="✅" label="Completed" value={data.taskDone} color={T.emerald} progress={data.taskDone} progressMax={data.taskPending+data.taskDone+data.taskOverdue} gradient/>
            <KPI icon="⏳" label="Pending" value={data.taskPending} color={T.amber} gradient/>
            <KPI icon="🚨" label="Overdue" value={data.taskOverdue} color={T.rose} gradient/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:20}}>
            <Panel title="Task Status" icon="📊" accent={T.emerald}>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:16}}>
                <Gauge value={data.taskPending+data.taskDone>0?pct(data.taskDone,data.taskPending+data.taskDone):0} color={T.emerald} size={100}/>
                <div style={{width:"100%"}}>
                  {[{l:"Done",v:data.taskDone,c:T.emerald},{l:"Pending",v:data.taskPending,c:T.amber},{l:"Overdue",v:data.taskOverdue,c:T.rose}].map(x=>(
                    <div key={x.l} style={{marginBottom:10}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                        <span style={{fontSize:13,color:T.textSecondary,fontWeight:500}}>{x.l}</span>
                        <span style={{fontSize:13,fontWeight:700,color:x.c}}>{x.v}</span>
                      </div>
                      <ProgressBar value={x.v} max={(data.taskPending+data.taskDone+data.taskOverdue)||1} color={x.c} height={6} gradient/>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
            <Panel title="SLA by Section" icon="⏱️" accent={T.amber}>
              {data.slaBreach.length===0?<EmptyState msg="No checklist data"/>:(
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {data.slaBreach.map(s=>(
                    <div key={s.dept}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                        <span style={{fontSize:13,color:T.textSecondary,fontWeight:500}}>{s.dept}</span>
                        <span style={{fontSize:13,fontWeight:700,color:s.breaches>0?T.rose:T.emerald}}>{s.breaches}/{s.total}</span>
                      </div>
                      <ProgressBar value={s.breaches} max={s.total||1} color={s.breaches>0?T.rose:T.emerald} height={7} gradient/>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
            <Panel title="⚡ Quick Actions" icon="⚡" accent={T.primary}>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <ActionButton label="Add Student" color={T.sky} icon="➕"/>
                <ActionButton label="Record Payment" color={T.primary} icon="💰"/>
                <ActionButton label="New Admission" color={T.secondary} icon="📋"/>
                <ActionButton label="Mark Attendance" color={T.emerald} icon="✅"/>
                <ActionButton label="Export Reports" color={T.amber} icon="📤"/>
                <ActionButton label="Send Reminders" color={T.rose} icon="📧"/>
              </div>
            </Panel>
          </div>
        </section>
        </div>

        {/* ═══ BATCHES ════════════════════════════════════════════ */}
        <div ref={setSectionRef('batches')}>
        <section style={{marginBottom:48}}>
          <SectionHeader icon="🗂️" title="Batches & Timetable" color={T.indigo}/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:16,marginBottom:24}}>
            <KPI icon="🗂️" label="Total Batches" value={data.totalBatches} color={T.indigo} gradient/>
            <KPI icon="✅" label="Active" value={data.activeBatches} color={T.emerald} gradient/>
            <KPI icon="👥" label="Total Strength" value={data.totalStrength} color={T.sky} sub={`Capacity: ${data.totalCapacity}`} gradient/>
            <KPI icon="📊" label="Fill Rate" value={data.batchFillRate} color={data.batchFillRate>=80?T.emerald:T.amber} sub={`${data.batchFillRate}% filled`} gradient/>
          </div>
          {data.batchesData.length===0?(
            <Panel><EmptyState msg="No data in batches table yet. Add batch records to see class-wise analytics."/></Panel>
          ):(
            <Panel title="All Batches" icon="📋" accent={T.indigo}>
              <table style={{width:"100%",borderCollapse:"separate",borderSpacing:"0 6px"}}>
                <thead><tr>{["Batch","Course","Teacher","Fill","Status"].map(h=><th key={h} style={{textAlign:"left",fontSize:11,color:T.textMuted,fontWeight:700,padding:"6px 14px",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                <tbody>{data.batchesData.map((b,i)=>(
                  <tr key={i}>
                    <td style={{fontSize:13,fontWeight:700,color:T.text,padding:"10px 14px",background:T.bgSurface,borderRadius:"12px 0 0 12px",borderTop:`1px solid ${T.borderLight}`,borderBottom:`1px solid ${T.borderLight}`,borderLeft:`1px solid ${T.borderLight}`}}>{b.name||"—"}</td>
                    <td style={{fontSize:13,color:T.textSecondary,padding:"10px 14px",background:T.bgSurface,borderTop:`1px solid ${T.borderLight}`,borderBottom:`1px solid ${T.borderLight}`}}>{b.course||"—"}</td>
                    <td style={{fontSize:13,color:T.textSecondary,padding:"10px 14px",background:T.bgSurface,borderTop:`1px solid ${T.borderLight}`,borderBottom:`1px solid ${T.borderLight}`}}>{b.teacher_name||"—"}</td>
                    <td style={{padding:"10px 14px",background:T.bgSurface,minWidth:140,borderTop:`1px solid ${T.borderLight}`,borderBottom:`1px solid ${T.borderLight}`}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <ProgressBar value={Number(b.strength)||0} max={Number(b.capacity)||1} color={T.sky} height={6} gradient/>
                        <span style={{fontSize:12,color:T.text,whiteSpace:"nowrap",fontWeight:600}}>{b.strength}/{b.capacity}</span>
                      </div>
                    </td>
                    <td style={{padding:"10px 14px",background:T.bgSurface,borderRadius:"0 12px 12px 0",borderTop:`1px solid ${T.borderLight}`,borderBottom:`1px solid ${T.borderLight}`,borderRight:`1px solid ${T.borderLight}`}}>
                      <Badge label={b.status||"Active"} color={statusColor(b.status||"Active")} soft/>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </Panel>
          )}
        </section>
        </div>

        {/* ═══ TESTS ══════════════════════════════════════════════ */}
        <div ref={setSectionRef('tests')}>
        <section style={{marginBottom:48}}>
          <SectionHeader icon="📝" title="Test & Performance Analytics" color={T.secondary}/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:16,marginBottom:24}}>
            <KPI icon="📝" label="Exam Dates" value={data.totalTests} color={T.secondary} gradient/>
            <KPI icon="👥" label="Total Entries" value={data.totalTestEntries} color={T.sky} gradient/>
            <KPI icon="📊" label="Avg Score" value={data.avgTestScore} color={T.emerald} sub={`${data.avgTestScore}% overall`} gradient/>
            <KPI icon="📉" label="At Risk" value={data.atRiskStudents.length} color={T.rose} sub="Below 40%" gradient/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:20,marginBottom:20}}>
            <Panel title="Monthly Avg Score Trend" sub="From exam_marks.exam_date" icon="📈" accent={T.secondary}>
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={data.testTrend}>
                  <defs>
                    <linearGradient id="testGradLight" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={T.secondary} stopOpacity={0.2}/>
                      <stop offset="95%" stopColor={T.secondary} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{fill:T.textMuted,fontSize:11}} axisLine={false} tickLine={false}/>
                  <YAxis domain={[0,100]} hide/><Tooltip content={<Tip/>}/>
                  <ReferenceLine y={40} stroke={T.rose} strokeDasharray="4 3" label={{value:"Pass line",fill:T.rose,fontSize:11,fontWeight:700}}/>
                  <Area dataKey="avg" name="Avg Score" stroke={T.secondary} strokeWidth={2.5} fill="url(#testGradLight)"/>
                </AreaChart>
              </ResponsiveContainer>
            </Panel>
            <Panel title="By Class" icon="🏫" accent={T.sky}>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {data.batchScores.map(b=>(
                  <div key={b.batch}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:12,color:T.textSecondary,fontWeight:500}}>{b.batch}</span>
                      <span style={{fontSize:12,fontWeight:700,color:b.color}}>{b.avg}%</span>
                    </div>
                    <ProgressBar value={b.avg} max={100} color={b.color} height={6} gradient/>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
            <Panel title="🏆 Top Performers" icon="🌟" accent={T.primary}>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {data.topPerformers.map((s,i)=>(
                  <div key={s.name+i} style={{
                    padding:"12px 14px",borderRadius:12,
                    background:i===0?`${T.primary}10`:T.bgSurface,
                    border:`1px solid ${i===0?T.primary+"30":T.border}`,
                    transition:"all 0.2s ease",
                  }}
                  onMouseEnter={e=>{e.currentTarget.style.boxShadow=T.shadowMd;e.currentTarget.style.transform="translateX(6px)"}}
                  onMouseLeave={e=>{e.currentTarget.style.boxShadow="none";e.currentTarget.style.transform="translateX(0)"}}
                  >
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                      <span style={{fontSize:13,fontWeight:800,color:[T.primary,T.textSecondary,T.amber,T.sky,T.sky,T.textMuted,T.textMuted,T.textMuted][i]}}>#{i+1} {s.name}</span>
                      <span style={{fontSize:14,fontWeight:900,color:s.avg>=80?T.emerald:s.avg>=60?T.amber:T.rose}}>{s.avg}%</span>
                    </div>
                    <ProgressBar value={s.avg} max={100} color={s.avg>=80?T.emerald:s.avg>=60?T.amber:T.rose} height={5} gradient/>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="⚠️ At-Risk Students" accent={T.rose} icon="🚨">
              {data.atRiskStudents.length===0?<div style={{color:T.emerald,fontSize:14,fontWeight:700,marginTop:12,padding:16,textAlign:"center",background:T.emeraldSoft,borderRadius:12}}>✅ No at-risk students!</div>:(
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {data.atRiskStudents.slice(0,8).map((s,i)=>(
                    <div key={s.name+i} style={{
                      padding:"10px 12px",borderRadius:12,
                      background:T.roseSoft,
                      border:`1px solid ${T.rose}20`,
                      transition:"all 0.2s ease",
                    }}
                    onMouseEnter={e=>{e.currentTarget.style.boxShadow=`0 4px 16px ${T.rose}20`;e.currentTarget.style.transform="scale(1.02)"}}
                    onMouseLeave={e=>{e.currentTarget.style.boxShadow="none";e.currentTarget.style.transform="scale(1)"}}
                    >
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                        <span style={{fontSize:13,fontWeight:700,color:T.text}}>{s.name}</span>
                        <span style={{fontSize:13,fontWeight:900,color:T.rose}}>{s.max>0?pct(s.total,s.max):0}%</span>
                      </div>
                      {s.batch&&<Badge label={s.batch} color={T.textMuted} soft/>}
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </section>
        </div>



        {/* ═══ ENQUIRY ════════════════════════════════════════════ */}
        <div ref={setSectionRef('enquiry')}>
        <section style={{marginBottom:48}}>
          <SectionHeader icon="🔍" title="Enquiry & Lead Management" color={T.sky}/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:16,marginBottom:24}}>
            <KPI icon="📞" label="Total" value={data.totalEnquiries} color={T.sky} sub="From admissions" gradient/>
            <KPI icon="🔓" label="Open" value={data.openEnquiries} color={T.amber} gradient/>
            <KPI icon="✅" label="Enrolled" value={data.convertedEnq} color={T.emerald} gradient/>
            <KPI icon="📊" label="Conv. Rate" value={data.conversionRate} color={T.secondary} sub={`${data.conversionRate}%`} gradient/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:20,marginBottom:20}}>
            <Panel title="Monthly Applications vs Enrollments" icon="📈" accent={T.sky}>
              <ResponsiveContainer width="100%" height={210}>
                <ComposedChart data={data.enqTrend}>
                  <XAxis dataKey="month" tick={{fill:T.textMuted,fontSize:11}} axisLine={false} tickLine={false}/>
                  <YAxis hide/><Tooltip content={<Tip/>}/>
                  <Bar dataKey="enquiries" name="Applications" fill={T.sky} radius={[5,5,0,0]} barSize={20}/>
                  <Bar dataKey="converted" name="Enrolled" fill={T.emerald} radius={[5,5,0,0]} barSize={20}/>
                </ComposedChart>
              </ResponsiveContainer>
            </Panel>
            <Panel title="Course Interest" icon="📚" accent={T.secondary}>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {data.enqByCourse.slice(0,7).map(c=>(
                  <div key={c.name}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:13,color:T.textSecondary,fontWeight:500}}>{c.name}</span>
                      <span style={{fontSize:13,fontWeight:700,color:c.color}}>{c.count}</span>
                    </div>
                    <ProgressBar value={c.count} max={data.enqByCourse[0]?.count||1} color={c.color} height={6} gradient/>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
          <Panel title="Recent Applications" icon="📝" accent={T.primary}>
            <table style={{width:"100%",borderCollapse:"separate",borderSpacing:"0 6px"}}>
              <thead><tr>{["Name","Course","Source","Status","Date"].map(h=><th key={h} style={{textAlign:"left",fontSize:11,color:T.textMuted,fontWeight:700,padding:"6px 14px",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
              <tbody>{data.recentEnquiries.map((e,i)=>(
                <tr key={i}>
                  <td style={{fontSize:13,fontWeight:700,color:T.text,padding:"10px 14px",background:T.bgSurface,borderRadius:"12px 0 0 12px",borderTop:`1px solid ${T.borderLight}`,borderBottom:`1px solid ${T.borderLight}`,borderLeft:`1px solid ${T.borderLight}`}}>{e.name||"—"}</td>
                  <td style={{fontSize:13,color:T.textSecondary,padding:"10px 14px",background:T.bgSurface,borderTop:`1px solid ${T.borderLight}`,borderBottom:`1px solid ${T.borderLight}`}}>{e.course_interest||"—"}</td>
                  <td style={{fontSize:13,color:T.textSecondary,padding:"10px 14px",background:T.bgSurface,borderTop:`1px solid ${T.borderLight}`,borderBottom:`1px solid ${T.borderLight}`}}>{e.source||"—"}</td>
                  <td style={{padding:"10px 14px",background:T.bgSurface,borderTop:`1px solid ${T.borderLight}`,borderBottom:`1px solid ${T.borderLight}`}}><Badge label={e.status||"—"} color={statusColor(e.status)} soft/></td>
                  <td style={{fontSize:13,color:T.textMuted,padding:"10px 14px",background:T.bgSurface,borderRadius:"0 12px 12px 0",borderTop:`1px solid ${T.borderLight}`,borderBottom:`1px solid ${T.borderLight}`,borderRight:`1px solid ${T.borderLight}`}}>{e.follow_up_date||"—"}</td>
                </tr>
              ))}</tbody>
            </table>
          </Panel>
        </section>
        </div>

        {/* ═══ DOUBTS ═════════════════════════════════════════════ */}
        <div ref={setSectionRef('doubts')}>
        <section style={{marginBottom:48}}>
          <SectionHeader icon="💬" title="Doubt & Query Management" color={T.teal}/>
          <Panel><EmptyState msg="No data in doubt_sessions table yet. Add records to track student doubts and resolution rates."/></Panel>
        </section>
        </div>

        {/* ═══ PARENTS ════════════════════════════════════════════ */}
        <div ref={setSectionRef('parents')}>
        <section style={{marginBottom:48}}>
          <SectionHeader icon="👨‍👩‍👧" title="Parent Communication" color={T.pink}/>
          <Panel><EmptyState msg="No data in sms_logs table yet. SMS logs will appear here once messages are sent."/></Panel>
        </section>
        </div>

        {/* ═══ MATERIAL ═══════════════════════════════════════════ */}
        <div ref={setSectionRef('material')}>
        <section style={{marginBottom:48}}>
          <SectionHeader icon="📦" title="Study Material Management" color={T.indigo}/>
          <Panel><EmptyState msg="No data in study_material table yet. Add material distribution records to track study resources."/></Panel>
        </section>
        </div>

        {/* ═══ RESULTS ════════════════════════════════════════════ */}
        <div ref={setSectionRef('results')}>
        <section style={{marginBottom:48}}>
          <SectionHeader icon="🏅" title="Results & Selections" color={T.primary}/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:16,marginBottom:24}}>
            <KPI icon="🏅" label="Total Selections" value={data.totalSelections} color={T.primary} gradient/>
            <KPI icon="🏫" label="JNV Navodaya" value={data.jnvSelections} color={T.emerald} gradient/>
            <KPI icon="⚔️" label="Sainik School" value={data.sainikSelections} color={T.sky} gradient/>
            <KPI icon="🎓" label="Other Exams" value={data.otherSelections} color={T.secondary} gradient/>
          </div>
          {data.totalSelections===0?(
            <Panel><EmptyState msg="No data in selections table yet. Add student selection records to track exam achievements."/></Panel>
          ):(
            <Panel title="Recent Selections" icon="🏆" accent={T.primary}>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {data.recentSelections.map((s,i)=>(
                  <div key={i} style={{
                    padding:"12px 14px",borderRadius:12,
                    background:`${T.primary}08`,
                    border:`1px solid ${T.primary}18`,
                    transition:"all 0.2s ease",
                  }}
                  onMouseEnter={e=>{e.currentTarget.style.boxShadow=`0 4px 16px ${T.primary}20`;e.currentTarget.style.transform="translateX(6px)"}}
                  onMouseLeave={e=>{e.currentTarget.style.boxShadow="none";e.currentTarget.style.transform="translateX(0)"}}
                  >
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:13,fontWeight:800,color:T.text}}>{s.student_name||"—"}</span>
                      {s.rank&&<span style={{fontSize:12,fontWeight:700,color:T.primary}}>Rank #{s.rank}</span>}
                    </div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      {s.exam_name&&<Badge label={s.exam_name} color={T.emerald} soft/>}
                      {s.year&&<Badge label={s.year} color={T.sky} soft/>}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </section>
        </div>

        {/* ═══ TEACHING ═══════════════════════════════════════════ */}
        <div ref={setSectionRef('teaching')}>
        <section style={{marginBottom:48}}>
          <SectionHeader icon="🖊️" title="Staff Teaching Analytics" color={T.teal}/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:16,marginBottom:24}}>
            <KPI icon="📚" label="Topics Total" value={data.totalTopics} color={T.sky} gradient/>
            <KPI icon="✅" label="Covered" value={data.coveredTopics} color={T.emerald} progress={data.coveredTopics} progressMax={data.totalTopics} gradient/>
            <KPI icon="📊" label="Coverage" value={data.overallCoverage} color={data.overallCoverage>=80?T.emerald:data.overallCoverage>=60?T.amber:T.rose} sub={`${data.overallCoverage}%`} gradient/>
          </div>
          {data.totalTopics===0?(
            <Panel><EmptyState msg="No data in monthly_syllabus table yet. Add syllabus coverage records to track teaching progress."/></Panel>
          ):(
            <Panel title="Teacher Coverage" icon="👨‍🏫" accent={T.teal}>
              <table style={{width:"100%",borderCollapse:"separate",borderSpacing:"0 6px"}}>
                <thead><tr>{["Teacher","Subjects","Covered","Coverage %","Status"].map(h=><th key={h} style={{textAlign:"left",fontSize:11,color:T.textMuted,fontWeight:700,padding:"6px 14px",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                <tbody>{data.teacherCoverage.map((t,i)=>(
                  <tr key={t.name}>
                    <td style={{fontSize:13,fontWeight:700,color:T.text,padding:"11px 14px",background:T.bgSurface,borderRadius:"12px 0 0 12px",borderTop:`1px solid ${T.borderLight}`,borderBottom:`1px solid ${T.borderLight}`,borderLeft:`1px solid ${T.borderLight}`}}>{t.name}</td>
                    <td style={{fontSize:13,color:T.textSecondary,padding:"11px 14px",background:T.bgSurface,borderTop:`1px solid ${T.borderLight}`,borderBottom:`1px solid ${T.borderLight}`}}>{t.subjects}</td>
                    <td style={{fontSize:13,color:T.text,padding:"11px 14px",background:T.bgSurface,borderTop:`1px solid ${T.borderLight}`,borderBottom:`1px solid ${T.borderLight}`}}>{t.covered}/{t.total}</td>
                    <td style={{padding:"11px 14px",background:T.bgSurface,minWidth:150,borderTop:`1px solid ${T.borderLight}`,borderBottom:`1px solid ${T.borderLight}`}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <div style={{flex:1}}><ProgressBar value={t.pct} max={100} color={t.pct>=80?T.emerald:t.pct>=60?T.amber:T.rose} height={7} gradient/></div>
                        <span style={{fontSize:13,fontWeight:800,color:t.pct>=80?T.emerald:t.pct>=60?T.amber:T.rose}}>{t.pct}%</span>
                      </div>
                    </td>
                    <td style={{padding:"11px 14px",background:T.bgSurface,borderRadius:"0 12px 12px 0",borderTop:`1px solid ${T.borderLight}`,borderBottom:`1px solid ${T.borderLight}`,borderRight:`1px solid ${T.borderLight}`}}>
                      <Badge label={t.pct>=80?"On Track":t.pct>=60?"Behind":"At Risk"} color={t.pct>=80?T.emerald:t.pct>=60?T.amber:T.rose} soft/>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </Panel>
          )}
        </section>
        </div>

        {/* ═══ EXPENSES ═══════════════════════════════════════════ */}
        <div ref={setSectionRef('expenses')}>
        <section style={{marginBottom:48}}>
          <SectionHeader icon="📉" title="Expenses & P&L" color={T.rose}/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:16,marginBottom:24}}>
            <KPI icon="💰" label="Total Income" value={data.totalFeeCollected} isMoney color={T.emerald} gradient/>
            <KPI icon="📉" label="Total Expenses" value={data.totalExpenses} isMoney color={T.rose} gradient/>
            <KPI icon="📊" label="Net P&L" value={data.netPL} isMoney color={data.netPL>=0?T.emerald:T.rose} sub={data.netPL>=0?"Profitable":"Loss"} gradient/>
            <KPI icon="💼" label="Salary Bill" value={data.totalSalaryBill} isMoney color={T.amber} gradient/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:20,marginBottom:20}}>
            <Panel title="Monthly Income vs Expense vs P&L" sub="Income from accounts (type=Income), Expense from accounts (type=Expense)" icon="📊" accent={T.primary}>
              <ResponsiveContainer width="100%" height={230}>
                <ComposedChart data={data.plTrend}>
                  <XAxis dataKey="month" tick={{fill:T.textMuted,fontSize:11}} axisLine={false} tickLine={false}/>
                  <YAxis hide/><Tooltip content={<Tip/>}/>
                  <Bar dataKey="income" name="Income" fill={T.emerald} radius={[5,5,0,0]} barSize={16}/>
                  <Bar dataKey="expense" name="Expense" fill={T.rose} radius={[5,5,0,0]} barSize={16}/>
                  <Line dataKey="pl" name="Net P&L" stroke={T.primary} strokeWidth={2.5} dot={{fill:T.primary,r:4}}/>
                </ComposedChart>
              </ResponsiveContainer>
            </Panel>
            <Panel title="Expense by Category" icon="🥧" accent={T.rose}>
              {data.expenseByCategory.length===0?<EmptyState msg="No Expense rows in accounts table yet"/>:(
                <>
                  <ResponsiveContainer width="100%" height={150}>
                    <PieChart>
                      <Pie data={data.expenseByCategory} dataKey="amount" cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={4}>
                        {data.expenseByCategory.map((p,i)=><Cell key={i} fill={p.color}/>)}
                      </Pie>
                      <Tooltip content={<Tip/>}/>
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:10}}>
                    {data.expenseByCategory.slice(0,5).map(c=>(
                      <div key={c.name} style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div style={{width:8,height:8,borderRadius:3,background:c.color,boxShadow:`0 0 6px ${c.color}60`}}/>
                          <span style={{fontSize:12,color:T.textSecondary,fontWeight:500}}>{c.name}</span>
                        </div>
                        <span style={{fontSize:12,fontWeight:700,color:c.color}}>{fmt(c.amount)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Panel>
          </div>
          <Panel title="P&L Summary" accent={data.netPL>=0?T.emerald:T.rose} icon="💹">
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:24,textAlign:"center"}}>
              {[
                {label:"Total Income",value:data.totalFeeCollected,color:T.emerald,icon:"💰"},
                {label:"Total Expenses",value:data.totalExpenses,color:T.rose,icon:"📉"},
                {label:"Net Profit / Loss",value:data.netPL,color:data.netPL>=0?T.emerald:T.rose,icon:data.netPL>=0?"📈":"📉"},
              ].map(x=>(
                <div key={x.label} style={{
                  padding:"20px",borderRadius:16,
                  background:`${x.color}08`,
                  border:`1px solid ${x.color}18`,
                  transition:"all 0.3s ease",
                }}
                onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-4px)";e.currentTarget.style.boxShadow=`0 8px 24px ${x.color}20`}}
                onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="none"}}
                >
                  <div style={{fontSize:28,marginBottom:8}}>{x.icon}</div>
                  <div style={{fontSize:24,fontWeight:900,color:x.color,marginBottom:6}}>{fmt(x.value)}</div>
                  <div style={{fontSize:13,color:T.textSecondary,fontWeight:500}}>{x.label}</div>
                </div>
              ))}
            </div>
          </Panel>
        </section>
        </div>

      </div>
    </div>
  )
}