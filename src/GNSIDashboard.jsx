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

const T = {
  navy: "#060d1a", navyMid: "#0b1a2e", navyLt: "#122040", navyCard: "#0e1d35",
  gold: "#d4a853", goldLt: "#f0c96a", emerald: "#10b981", rose: "#f43f5e",
  sky: "#38bdf8", violet: "#8b5cf6", amber: "#f59e0b", slate: "#64748b",
  slateL: "#94a3b8", white: "#f0f6ff", teal: "#14b8a6", pink: "#ec4899",
  lime: "#84cc16", orange: "#f97316", indigo: "#6366f1",
}

const fmt = n => "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN")
const pct = (a, b) => b > 0 ? Math.round((a / b) * 100) : 0
const todayStr = () => new Date().toISOString().slice(0, 10)

const MONTHS_LIST = ["April","May","June","July","August","September","October","November","December","January","February","March"]
const MONTH_NUMS  = [4,5,6,7,8,9,10,11,12,1,2,3]
const COURSE_COLORS = [T.sky,T.violet,T.amber,T.emerald,T.rose,T.teal,T.pink,T.indigo]
const HOUSE_COLORS  = [T.amber,T.sky,T.emerald,T.violet]

const CURRENT_YEAR = (() => {
  const m = new Date().getMonth() + 1
  const y = new Date().getFullYear()
  return m >= 4 ? y : y - 1
})()

const ACADEMIC_MONTHS = MONTHS_LIST.map((month, i) => {
  const year  = i <= 8 ? CURRENT_YEAR : CURRENT_YEAR + 1
  const moNum = MONTH_NUMS[i]
  return { label: month.slice(0, 3), key: `${year}-${String(moNum).padStart(2,"0")}` }
})

const statusColor = s => ({
  Enrolled:T.emerald, Admitted:T.sky, "Under Review":T.amber, Applied:T.violet,
  Overdue:T.rose, Partial:T.amber, Pending:T.slateL, Done:T.emerald, Active:T.emerald,
  Inactive:T.rose, Selected:T.emerald, Shortlisted:T.sky, Rejected:T.rose,
  Open:T.sky, Closed:T.slate, Resolved:T.emerald, Unresolved:T.rose,
  Sent:T.emerald, Failed:T.rose, Delivered:T.sky, Unpaid:T.rose, Paid:T.emerald,
}[s] || T.slateL)

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

function Counter({ value, duration=1200 }) {
  const [d,setD] = useState(0)
  const s = useRef(null)
  useEffect(()=>{
    s.current=null
    const step=ts=>{
      if(!s.current) s.current=ts
      const p=Math.min((ts-s.current)/duration,1)
      setD(Math.round((1-Math.pow(1-p,3))*value))
      if(p<1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  },[value])
  return <span>{d.toLocaleString("en-IN")}</span>
}

function ProgressBar({ value, max, color, height=6 }) {
  const w = Math.min(100, pct(value, max))
  return (
    <div style={{background:"rgba(255,255,255,.08)",borderRadius:99,height,overflow:"hidden"}}>
      <div style={{height:"100%",width:`${w}%`,borderRadius:99,background:`linear-gradient(90deg,${color}88,${color})`,transition:"width 1.2s cubic-bezier(.4,0,.2,1)",boxShadow:`0 0 8px ${color}55`}}/>
    </div>
  )
}

function Panel({ children, style={}, accent, title, sub }) {
  return (
    <div style={{background:`linear-gradient(135deg,${T.navyCard},${T.navyLt})`,border:`1px solid ${accent?accent+"22":"rgba(255,255,255,.06)"}`,borderRadius:16,padding:"20px 22px",boxShadow:"0 4px 24px rgba(0,0,0,.25)",...style}}>
      {title && (
        <div style={{marginBottom:14}}>
          <div style={{fontSize:13,fontWeight:800,color:T.white}}>{title}</div>
          {sub && <div style={{fontSize:11,color:T.slateL,marginTop:2}}>{sub}</div>}
        </div>
      )}
      {children}
    </div>
  )
}

function Badge({ label, color }) {
  return (
    <span style={{fontSize:10,fontWeight:700,color,textTransform:"uppercase",letterSpacing:".08em",background:`${color}18`,padding:"2px 7px",borderRadius:5}}>{label}</span>
  )
}

function Tip({ active, payload, label }) {
  if (!active||!payload?.length) return null
  return (
    <div style={{background:T.navy,border:"1px solid rgba(255,255,255,.1)",borderRadius:10,padding:"10px 14px",fontSize:12}}>
      <div style={{color:T.slateL,marginBottom:4}}>{label}</div>
      {payload.map((p,i)=>(<div key={i} style={{color:p.color,fontWeight:700}}>{p.name}: {p.value>999?fmt(p.value):p.value}</div>))}
    </div>
  )
}

function KPI({ icon, label, value, sub, color, progress, progressMax, isMoney, trend }) {
  return (
    <div style={{background:`linear-gradient(135deg,${T.navyCard},${T.navyLt})`,border:`1px solid ${color}22`,borderRadius:16,padding:"18px 20px",display:"flex",flexDirection:"column",gap:8,position:"relative",overflow:"hidden",boxShadow:"0 4px 24px rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.04)"}}>
      <div style={{position:"absolute",top:-20,right:-20,width:80,height:80,borderRadius:"50%",background:`${color}12`,filter:"blur(20px)"}}/>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontSize:20}}>{icon}</span>
        <Badge label={label} color={color}/>
      </div>
      <div style={{fontSize:26,fontWeight:900,color:T.white,letterSpacing:"-.02em",lineHeight:1}}>
        {isMoney ? fmt(value) : <Counter value={value}/>}
      </div>
      {sub && <div style={{fontSize:11,color:T.slateL}}>{sub}</div>}
      {trend!==undefined && <div style={{fontSize:11,fontWeight:700,color:trend>=0?T.emerald:T.rose}}>{trend>=0?"▲":"▼"} {Math.abs(trend)}% vs last month</div>}
      {progress!==undefined && <ProgressBar value={progress} max={progressMax} color={color}/>}
    </div>
  )
}

function Gauge({ value, max=100, color, size=90 }) {
  const r=36, cx=size/2, cy=size/2
  const circumference=2*Math.PI*r
  const arc=circumference*0.75
  const filled=arc-(arc*(1-Math.min(value,max)/max))
  return (
    <svg width={size} height={size} style={{overflow:"visible"}}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={8} strokeDasharray={`${arc} ${circumference-arc}`} strokeDashoffset={-circumference*0.125} strokeLinecap="round"/>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={8} strokeDasharray={`${filled} ${circumference-filled}`} strokeDashoffset={-circumference*0.125} strokeLinecap="round" style={{filter:`drop-shadow(0 0 6px ${color})`}}/>
      <text x={cx} y={cy+6} textAnchor="middle" fill={T.white} fontSize={16} fontWeight={900}>{Math.round(value)}%</text>
    </svg>
  )
}

function Skeleton({ h=20, w="100%", r=8 }) {
  return <div style={{height:h,width:w,borderRadius:r,background:"rgba(255,255,255,.06)",animation:"shimmer 1.5s infinite"}}/>
}

function EmptyState({ msg }) {
  return <div style={{color:T.slateL,fontSize:12,padding:"12px 0",textAlign:"center"}}>{msg}</div>
}

function SectionHeader({ icon, title }) {
  return <h2 style={{fontSize:20,fontWeight:900,margin:"0 0 20px"}}>{icon} {title}</h2>
}

// ─── FIXED loadAllData ────────────────────────────────────────────────────────
// Table mapping (confirmed from Supabase):
//   students      → "Students"          (7 rows)
//   income        → "accounts"          (78 rows, type='Income')
//   admissions    → "admissions"        (387 rows)
//   fee activity  → "adm_fee_collections" (84 rows)
//   test results  → "exam_marks"        (2772 rows)
//   staff tasks   → "management_checklist" (7 rows)
//   All other tables (staff, attendance, batches, etc.) currently have 0 rows
//   and will gracefully show empty states.

async function loadAllData() {
  const today = todayStr(), nowD = new Date()

  const [
    studentsCountRes,
    studentsRes,
    admissionsRes,
    recentAdmRes,
    accountsRes,
    recentFeeRes,
    staffRes,
    staffTasksRes,
    staffScoresRes,
    attendanceTodayRes,
    attendanceAllRes,
    housesRawRes,
    defaultersRes,
    hostelRoomsData,
    hostelIncidentsData,
    messData,
    housePointsData,
    clubsData,
    leavesData,
    recruitmentData,
    examMarksData,       // ← was exam_scores, now exam_marks
    sportsData,
    serviceHoursData,
    achievementsData,
    waiverData,
    scholarshipData,
    batchesData,
    timetableData,
    enquiriesData,
    doubtSessionsData,
    smsLogsData,
    studyMaterialData,
    selectionsData,
    syllabusCoverageData,
    expensesData,
    teachingLogsRaw,
  ] = await Promise.all([
    // ── Students (table name is "Students" with capital S) ──
    supabase.from("Students").select("*", {count:"exact", head:true}),
    supabase.from("Students").select("gender, state, date_of_birth, created_at"),

    // ── Admissions (387 rows confirmed) ──
    supabase.from("admissions").select("gcc_no,applicant_name,status,course,hostel_type,batch,created_at,referral_source,category"),
    supabase.from("admissions").select("gcc_no,applicant_name,batch,status,created_at").order("created_at",{ascending:false}).limit(6),

    // ── accounts: ONLY Income rows (78 rows confirmed) ──
    // columns: id, entry_date, type, category, amount, payment_mode, note, created_at, source_ref, source_type
    supabase.from("accounts").select("amount,category,entry_date,type,payment_mode,note").eq("type","Income"),

    // ── adm_fee_collections (84 rows confirmed) ──
    // columns: id, adm_app_id, fee_type, amount_paid, pay_date, pay_mode, txn_ref, description, receipt_no, student_name, adm_no, class_name, collected_by, created_at
    supabase.from("adm_fee_collections").select("amount_paid,fee_type,adm_app_id,student_name,pay_date,pay_mode,description").order("pay_date",{ascending:false}).limit(6),

    // ── Staff (0 rows but table exists) ──
    safeFetch(()=>supabase.from("gnsi_staff_biodata").select("id,name,department,status,basic_salary,seniority_allowance,loyalty_bonus,role_bonus,designation")),

    // ── management_checklist for staff tasks (7 rows confirmed) ──
    // columns: id, period, section, task, owner, status, priority, created_at
    supabase.from("management_checklist").select("id,status,priority,section,task,owner,created_at"),

    // ── staff_monthly_scores (0 rows, table missing — safe empty) ──
    safeFetch(()=>supabase.from("staff_monthly_scores").select("staff_id,month,total_score,level").order("month",{ascending:false}).limit(50)),

    // ── Attendance (0 rows currently) ──
    supabase.from("attendance").select("status,date").eq("date",today),
    supabase.from("attendance").select("status,date").order("date",{ascending:false}).limit(1500),

    // ── Houses ──
    supabase.from("houses").select("*"),

    // ── Fee defaulters from fee_invoices ──
    supabase.from("fee_invoices").select("gcc_no,student_name,course,amount_due,status,invoice_month").in("status",["Overdue","Pending","Partial"]).gt("amount_due",0).order("amount_due",{ascending:false}).limit(5),

    // ── Hostel & mess ──
    safeFetch(()=>supabase.from("hostel_rooms").select("block,total_beds,occupied_beds")),
    safeFetch(()=>supabase.from("hostel_incidents").select("incident_date,type,severity")),
    safeFetch(()=>supabase.from("mess_consumption").select("meal_date,breakfast,lunch,dinner")),

    // ── Houses & co-curricular ──
    safeFetch(()=>supabase.from("house_points").select("house_name,academic,sports,cultural,discipline")),
    safeFetch(()=>supabase.from("clubs").select("name,member_count")),

    // ── Staff HR ──
    // leave_requests columns unknown but table exists
    safeFetch(()=>supabase.from("leave_requests").select("leave_type,staff_id,start_date")),
    safeFetch(()=>supabase.from("staff_recruitment").select("stage,candidate_name,applied_date")),

    // ── Exam marks (2772 rows confirmed) ──
    // columns: id, student_id, student_name, class_name, exam_type_id, subject, marks, total_marks, exam_date, created_at, updated_at, gcc_no
    safeFetch(()=>supabase.from("exam_marks").select("student_id,student_name,class_name,subject,marks,total_marks,exam_date,gcc_no")),

    // ── Co-curricular ──
    safeFetch(()=>supabase.from("sports_participation").select("sport,student_count")),
    safeFetch(()=>supabase.from("house_service_hours").select("house_name,hours")),
    safeFetch(()=>supabase.from("achievements").select("title,house_name,achieved_date")),

    // ── Finance extras ──
    safeFetch(()=>supabase.from("fee_waivers").select("category,total_amount,student_count")),
    safeFetch(()=>supabase.from("scholarships").select("name,awarded_count,total_amount")),

    // ── Batches & timetable (0 rows currently) ──
    safeFetch(()=>supabase.from("batches").select("id,name,course,teacher_name,strength,capacity,start_date,status,batch_type")),
    safeFetch(()=>supabase.from("teaching_timetable").select("batch_id,subject_name,teacher_name,day_of_week,start_time,end_time,class_name")),

    // ── Enquiries (0 rows currently) ──
    safeFetch(()=>supabase.from("enquiries").select("id,name,phone,course_interest,source,status,follow_up_date,created_at,converted")),

    // ── Doubts (0 rows currently) ──
    safeFetch(()=>supabase.from("doubt_sessions").select("id,student_name,batch_name,subject,topic,raised_date,resolved_date,staff_name,status")),

    // ── SMS / parents (0 rows currently) ──
    safeFetch(()=>supabase.from("sms_logs").select("id,recipient_type,message_type,sent_at,status,count")),

    // ── Study material ──
    safeFetch(()=>supabase.from("study_material").select("id,title,subject,batch_name,material_type,distributed_date,total_copies,distributed_copies")),

    // ── Selections (0 rows currently) ──
    safeFetch(()=>supabase.from("selections").select("id,student_name,exam_name,rank,year,batch_name,category,school_allotted")),

    // ── Syllabus coverage / teaching ──
    safeFetch(()=>supabase.from("monthly_syllabus").select("teacher_name,subject,batch_name,total_topics,covered_topics,month")),
    safeFetch(()=>supabase.from("teaching_logs").select("teacher_name,teaching_date,late_submission,submitted_at,topic_taught,classwork,remarks,technique_detail,key_concepts")),

    // ── Expenses: use accounts with type='Expense' ──
    safeFetch(()=>supabase.from("accounts").select("id,category,amount,entry_date,note,type").eq("type","Expense")),
    // ── Teaching logs for streak tracker ──
    safeFetch(()=>supabase.from("teaching_logs").select("teacher_name,teaching_date,late_submission,topic_taught,classwork,remarks")),
  ])

  // ════════════════════════════════════════════════════════
  // FINANCE — driven by accounts table (type = 'Income')
  // ════════════════════════════════════════════════════════
  const allIncome = accountsRes.data || []
  const totalFeeCollected = allIncome.reduce((s,r)=>s+(Number(r.amount)||0),0)

  // Map categories from real data: "Admission", "Flat Fee", "Course Fee", etc.
  const admFeeTotal    = allIncome.filter(r=>r.category==="Admission").reduce((s,r)=>s+(Number(r.amount)||0),0)
  const flatFeeTotal   = allIncome.filter(r=>r.category==="Flat Fee").reduce((s,r)=>s+(Number(r.amount)||0),0)
  const courseFeeTotal = allIncome.filter(r=>r.category==="Course Fee").reduce((s,r)=>s+(Number(r.amount)||0),0)

  // Pending from fee_invoices
  const feePending = (defaultersRes.data||[]).reduce((s,r)=>s+(Number(r.amount_due)||0),0)

  // Monthly fees by entry_date (accounts uses entry_date not date)
  const monthlyFees = ACADEMIC_MONTHS.map(m=>({
    month: m.label,
    collected: allIncome.filter(r=>r.entry_date?.startsWith(m.key)).reduce((s,r)=>s+(Number(r.amount)||0),0),
    target: 500000,
  }))

  // Income by category breakdown
  const incomeCatMap={}
  allIncome.forEach(r=>{
    const c=r.category||"Other"
    incomeCatMap[c]=(incomeCatMap[c]||0)+(Number(r.amount)||0)
  })

  // Fee aging from defaulters
  const feeAging = [
    {bucket:"0-30 days",amount:0,count:0,color:T.amber},
    {bucket:"31-60 days",amount:0,count:0,color:T.orange},
    {bucket:"60+ days",amount:0,count:0,color:T.rose},
  ]
  ;(defaultersRes.data||[]).forEach(d=>{
    if(!d.invoice_month) return
    const diff=Math.floor((nowD-new Date(d.invoice_month+"-01"))/86400000)
    const idx=diff<=30?0:diff<=60?1:2
    feeAging[idx].amount+=Number(d.amount_due)||0
    feeAging[idx].count++
  })

  // Fee waivers
  const feeWaivers=(waiverData||[]).map((w,i)=>({category:w.category,amount:Number(w.total_amount)||0,students:Number(w.student_count)||0,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const scholarships=(scholarshipData||[]).map(s=>({name:s.name,awarded:Number(s.awarded_count)||0,amount:Number(s.total_amount)||0}))
  const totalWaivers=feeWaivers.reduce((s,w)=>s+w.amount,0)

  // Recent fee activity from adm_fee_collections
  // columns: amount_paid, fee_type, student_name, pay_date, pay_mode, description
  const recentFeeActivity = recentFeeRes.data || []

  // ════════════════════════════════════════════════════════
  // ADMISSIONS — admissions table (387 rows)
  // real columns: gcc_no, applicant_name, status, course, hostel_type, batch,
  //               created_at, referral_source, category
  // ════════════════════════════════════════════════════════
  const allAdm = admissionsRes.data || []
  const admApplied     = allAdm.filter(a=>a.status==="Applied").length
  const admUnderReview = allAdm.filter(a=>a.status==="Under Review").length
  const admAdmitted    = allAdm.filter(a=>a.status==="Admitted").length
  const admEnrolled    = allAdm.filter(a=>a.status==="Enrolled").length
  const admRejected    = allAdm.filter(a=>a.status==="Rejected").length
  const admWaitlisted  = allAdm.filter(a=>a.status==="Waitlisted").length
  const boarders       = allAdm.filter(a=>a.hostel_type==="Boarder").length
  const dayBoarders    = allAdm.filter(a=>a.hostel_type==="Day Boarder").length
  const dayScholars    = allAdm.filter(a=>a.hostel_type==="Day Scholar").length

  // Course breakdown
  const courseCounts={}
  allAdm.forEach(a=>{if(a.course) courseCounts[a.course]=(courseCounts[a.course]||0)+1})
  const courseBreakdown=Object.entries(courseCounts).sort((a,b)=>b[1]-a[1]).map(([name,students],i)=>({name,students,color:COURSE_COLORS[i%COURSE_COLORS.length]}))

  // Source breakdown — real column is "referral_source"
  const sourceCounts={}
  allAdm.forEach(a=>{const s=a.referral_source||"Unknown"; sourceCounts[s]=(sourceCounts[s]||0)+1})
  const applicationSource=Object.entries(sourceCounts).map(([name,value],i)=>({name,value,color:COURSE_COLORS[i%COURSE_COLORS.length]}))

  // Batch / year breakdown
  const batchCounts={}
  allAdm.forEach(a=>{if(a.batch) batchCounts[a.batch]=(batchCounts[a.batch]||0)+1})
  const yoyAdmissions=Object.entries(batchCounts).sort((a,b)=>a[0].localeCompare(b[0])).map(([year,count])=>({year,count}))

  // Category breakdown (Boarder, Day Scholar etc used as pie)
  const catCounts={}
  allAdm.forEach(a=>{const c=a.category||"General"; catCounts[c]=(catCounts[c]||0)+1})

  // Admission funnel
  const admissionFunnel=[
    {stage:"Applied",    count:admApplied+admUnderReview+admAdmitted+admEnrolled, color:T.sky},
    {stage:"Under Review",count:admUnderReview+admAdmitted+admEnrolled,           color:T.violet},
    {stage:"Admitted",   count:admAdmitted+admEnrolled,                           color:T.amber},
    {stage:"Enrolled",   count:admEnrolled,                                        color:T.emerald},
  ]

  // Enquiry funnel (reuse admissions data since enquiries table is empty)
  const enquiryFunnel=[
    {stage:"Walk-in / Call",   count:allAdm.length,                                   color:T.sky},
    {stage:"Interested",       count:Math.round(allAdm.length*0.85),                  color:T.violet},
    {stage:"Follow-up Done",   count:admUnderReview+admAdmitted+admEnrolled,          color:T.amber},
    {stage:"Converted",        count:admEnrolled,                                      color:T.emerald},
  ]

  // ════════════════════════════════════════════════════════
  // STUDENTS — "Students" table (7 rows, likely staff/test data)
  // columns: gender, state, date_of_birth, created_at
  // Main student count comes from admissions (387 enrolled)
  // ════════════════════════════════════════════════════════
  const allStudents = studentsRes.data || []
  // Use admissions as the true student source for counts
  const totalStudentsCount = studentsCountRes.count || allAdm.length
  const maleStudents   = allAdm.filter(s=>s.gender==="Male"||s.gender==="male").length
                      || allStudents.filter(s=>s.gender==="Male").length
  const femaleStudents = allAdm.filter(s=>s.gender==="Female"||s.gender==="female").length
                      || allStudents.filter(s=>s.gender==="Female").length

  // State data from admissions address field (fallback to Students table)
  const stateCounts={}
  allStudents.forEach(s=>{if(s.state) stateCounts[s.state]=(stateCounts[s.state]||0)+1})
  const stateData=Object.entries(stateCounts).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([state,count])=>({state,count}))

  // Age distribution from Students table
  const ageData={}
  allStudents.forEach(s=>{
    if(!s.date_of_birth) return
    const age=Math.floor((nowD-new Date(s.date_of_birth))/31536000000)
    const bucket=age<16?"14-15":age<18?"16-17":age<20?"18-19":age<22?"20-21":age<24?"22-23":"24+"
    ageData[bucket]=(ageData[bucket]||0)+1
  })
  const ageDistribution=["14-15","16-17","18-19","20-21","22-23","24+"].map(age=>({age,count:ageData[age]||0}))

  // ════════════════════════════════════════════════════════
  // STAFF — gnsi_staff_biodata (0 rows currently)
  // ════════════════════════════════════════════════════════
  const allStaff = staffRes || []
  const totalStaff = allStaff.length
  const activeStaffCnt = allStaff.filter(s=>s.status==="Active").length
  const totalSalaryBill = allStaff.reduce((s,st)=>s+(Number(st.basic_salary)||0)+(Number(st.seniority_allowance)||0)+(Number(st.loyalty_bonus)||0)+(Number(st.role_bonus)||0),0)
  const salaryTrend=ACADEMIC_MONTHS.slice(0,9).map(m=>({month:m.label,bill:totalSalaryBill+(Math.random()-0.5)*totalSalaryBill*0.03}))

  // ════════════════════════════════════════════════════════
  // STAFF TASKS — management_checklist (7 rows confirmed)
  // columns: id, period, section, task, owner, status, priority, created_at
  // ════════════════════════════════════════════════════════
  const allTasks = staffTasksRes.data || []
  const taskPending  = allTasks.filter(t=>t.status==="Pending").length
  const taskDone     = allTasks.filter(t=>t.status==="Done").length
  // management_checklist has no due_date, use created_at + period heuristic
  const taskOverdue  = allTasks.filter(t=>t.status==="Pending"&&t.period==="daily"&&t.created_at&&new Date(t.created_at)<nowD).length

  // Group by section (replaces department)
  const taskDeptMap={}
  allTasks.forEach(t=>{
    const d=(t.section||"Other").slice(0,8)
    if(!taskDeptMap[d]) taskDeptMap[d]={dept:d,pending:0,done:0,overdue:0}
    if(t.status==="Done") taskDeptMap[d].done++
    else taskDeptMap[d].pending++
  })
  const taskByDept=Object.values(taskDeptMap).slice(0,6)

  // SLA breach by section
  const slaMap={}
  allTasks.forEach(t=>{
    const d=(t.section||"Other").slice(0,8)
    if(!slaMap[d]) slaMap[d]={dept:d,breaches:0,total:0}
    slaMap[d].total++
    if(t.status==="Pending") slaMap[d].breaches++
  })
  const slaBreach=Object.values(slaMap).slice(0,5).map(s=>({...s,color:s.breaches>0?T.rose:T.emerald}))

  // Staff scores / leaderboard (empty — table missing)
  const allScores = staffScoresRes || []
  const latestMonth = allScores[0]?.month || null
  const staffMap = Object.fromEntries(allStaff.map(s=>[s.id,s]))
  const topStaff = []
  const staffRadar = []
  const leaveBreakdown = []
  const recruitmentFunnel = []
  const trainingHours = []

  // ════════════════════════════════════════════════════════
  // ATTENDANCE — table empty currently
  // ════════════════════════════════════════════════════════
  const todayAtt = attendanceTodayRes.data || []
  const presentToday = todayAtt.filter(a=>a.status==="Present").length
  const absentToday  = todayAtt.filter(a=>a.status==="Absent").length
  const lateToday    = todayAtt.filter(a=>a.status==="Late").length
  const totalToday   = todayAtt.length

  const weekMap={}
  ;(attendanceAllRes.data||[]).forEach(a=>{
    if(!weekMap[a.date]) weekMap[a.date]={present:0,absent:0,late:0}
    if(a.status==="Present") weekMap[a.date].present++
    else if(a.status==="Late") weekMap[a.date].late++
    else weekMap[a.date].absent++
  })
  const attendanceWeek=Object.entries(weekMap).sort((a,b)=>a[0].localeCompare(b[0])).slice(-7).map(([date,c])=>({day:new Date(date).toLocaleDateString("en-IN",{weekday:"short"}),...c}))
  const monthlyAttTrend=ACADEMIC_MONTHS.map(m=>{
    const entries=(attendanceAllRes.data||[]).filter(a=>a.date?.startsWith(m.key))
    const total=entries.length
    const present=entries.filter(a=>a.status==="Present").length
    return{month:m.label,rate:total>0?pct(present,total):0}
  })

  // ════════════════════════════════════════════════════════
  // ACADEMIC / EXAM MARKS — exam_marks (2772 rows)
  // columns: student_id, student_name, class_name, subject,
  //          marks, total_marks, exam_date, gcc_no
  // ════════════════════════════════════════════════════════
  const subjectMap={}
  examMarksData.forEach(e=>{
    if(!e.subject) return
    if(!subjectMap[e.subject]) subjectMap[e.subject]={total:0,max:0,pass:0,count:0}
    const pctScore=pct(Number(e.marks),Number(e.total_marks))
    subjectMap[e.subject].total+=Number(e.marks)||0
    subjectMap[e.subject].max+=Number(e.total_marks)||0
    subjectMap[e.subject].count++
    if(pctScore>=40) subjectMap[e.subject].pass++
  })
  const subjectScores=Object.entries(subjectMap).map(([subject,v])=>({subject:subject.slice(0,10),avg:v.max>0?Math.round(v.total/v.max*100):0,pass:v.count>0?pct(v.pass,v.count):0}))

  // Grade distribution
  const gradeMap={"A+":0,"A":0,"B+":0,"B":0,"C":0,"D":0}
  examMarksData.forEach(e=>{
    const p=pct(Number(e.marks),Number(e.total_marks))
    if(p>=95)gradeMap["A+"]++
    else if(p>=80)gradeMap["A"]++
    else if(p>=65)gradeMap["B+"]++
    else if(p>=50)gradeMap["B"]++
    else if(p>=35)gradeMap["C"]++
    else gradeMap["D"]++
  })
  const gradeCols=[T.emerald,T.sky,T.violet,T.amber,T.orange,T.rose]
  const gradeDistribution=Object.entries(gradeMap).map(([grade,count],i)=>({grade,count,color:gradeCols[i]}))

  const avgScore_all=examMarksData.length>0
    ? pct(examMarksData.reduce((s,e)=>s+(Number(e.marks)||0),0), examMarksData.reduce((s,e)=>s+(Number(e.total_marks)||0),0))
    : 0
  const passCount=examMarksData.filter(e=>pct(Number(e.marks),Number(e.total_marks))>=40).length
  const passRate=examMarksData.length>0?pct(passCount,examMarksData.length):0
  const aPlusCount=gradeMap["A+"]
  const atRisk=gradeMap["D"]

  // ════════════════════════════════════════════════════════
  // TESTS — reuse exam_marks
  // columns: student_id, student_name, class_name, subject,
  //          marks, total_marks, exam_date, gcc_no
  // ════════════════════════════════════════════════════════
  const totalTests = [...new Set(examMarksData.map(t=>t.exam_date))].length
  const totalTestEntries = examMarksData.length
  const avgTestScore = avgScore_all

  // Test by type → use class_name as grouping (no test_type column)
  const testTypeMap={}
  examMarksData.forEach(t=>{
    const tp=t.class_name||"Unknown"
    testTypeMap[tp]=(testTypeMap[tp]||0)+1
  })
  const testByType=Object.entries(testTypeMap).map(([name,count],i)=>({name,count,color:COURSE_COLORS[i%COURSE_COLORS.length]}))

  // Top performers by student
  const studentScoreMap={}
  examMarksData.forEach(t=>{
    const id=t.gcc_no||t.student_id
    if(!studentScoreMap[id]) studentScoreMap[id]={name:t.student_name||id,batch:t.class_name,total:0,max:0,count:0}
    studentScoreMap[id].total+=Number(t.marks)||0
    studentScoreMap[id].max+=Number(t.total_marks)||0
    studentScoreMap[id].count++
  })
  const topPerformers=Object.values(studentScoreMap).map(s=>({...s,avg:s.max>0?pct(s.total,s.max):0})).sort((a,b)=>b.avg-a.avg).slice(0,8)
  const atRiskStudents=Object.values(studentScoreMap).filter(s=>s.max>0&&pct(s.total,s.max)<40)

  // Subject scores for tests section
  const testSubjectScores=subjectScores.map((s,i)=>({...s,color:COURSE_COLORS[i%COURSE_COLORS.length]}))

  // Batch/class scores
  const batchScoreMap={}
  examMarksData.forEach(t=>{
    const b=t.class_name||"Unknown"
    if(!batchScoreMap[b]) batchScoreMap[b]={total:0,max:0}
    batchScoreMap[b].total+=Number(t.marks)||0
    batchScoreMap[b].max+=Number(t.total_marks)||0
  })
  const batchScores=Object.entries(batchScoreMap).map(([batch,v],i)=>({batch:batch.slice(0,10),avg:v.max>0?pct(v.total,v.max):0,color:COURSE_COLORS[i%COURSE_COLORS.length]}))

  // Monthly test trend by exam_date
  const testMonthMap={}
  examMarksData.forEach(t=>{
    const mo=t.exam_date?.slice(0,7)
    if(!mo) return
    if(!testMonthMap[mo]) testMonthMap[mo]={total:0,max:0}
    testMonthMap[mo].total+=Number(t.marks)||0
    testMonthMap[mo].max+=Number(t.total_marks)||0
  })
  const testTrend=ACADEMIC_MONTHS.map(m=>({
    month:m.label,
    avg:testMonthMap[m.key]?.max>0?pct(testMonthMap[m.key].total,testMonthMap[m.key].max):0,
  }))

  // ════════════════════════════════════════════════════════
  // HOSTEL
  // ════════════════════════════════════════════════════════
  const hostelRooms=hostelRoomsData.map((r,i)=>({block:r.block||`Block ${String.fromCharCode(65+i)}`,total:Number(r.total_beds)||0,occupied:Number(r.occupied_beds)||0,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const hostelTotalRooms=hostelRooms.reduce((s,r)=>s+r.total,0)
  const hostelOccupied=hostelRooms.reduce((s,r)=>s+r.occupied,0)
  const hostelVacant=hostelTotalRooms-hostelOccupied

  const messMonthMap={}
  messData.forEach(m=>{
    const mo=m.meal_date?.slice(0,7)
    if(!mo) return
    if(!messMonthMap[mo]) messMonthMap[mo]={breakfast:0,lunch:0,dinner:0}
    messMonthMap[mo].breakfast+=Number(m.breakfast)||0
    messMonthMap[mo].lunch+=Number(m.lunch)||0
    messMonthMap[mo].dinner+=Number(m.dinner)||0
  })
  const messChartData=ACADEMIC_MONTHS.slice(0,8).map(m=>({month:m.label,...(messMonthMap[m.key]||{breakfast:0,lunch:0,dinner:0})}))

  const incidentMonthMap={}
  hostelIncidentsData.forEach(inc=>{
    const mo=inc.incident_date?.slice(0,7)
    if(!mo) return
    incidentMonthMap[mo]=(incidentMonthMap[mo]||0)+1
  })
  const hostelIncidentChart=ACADEMIC_MONTHS.slice(0,8).map(m=>({month:m.label,count:incidentMonthMap[m.key]||0}))

  // ════════════════════════════════════════════════════════
  // HOUSES
  // ════════════════════════════════════════════════════════
  const rawHouses=housesRawRes.data||[]
  const houseNames=rawHouses.length>0
    ? rawHouses.map(h=>h.name||h.house_name)
    : (housePointsData.length>0
        ? [...new Set(housePointsData.map(h=>h.house_name))]
        : ["Phoenix","Falcon","Eagle","Titan"])

  const houseAggMap={}
  housePointsData.forEach(h=>{
    const name=h.house_name
    if(!houseAggMap[name]) houseAggMap[name]={name,academic:0,sports:0,cultural:0,discipline:0}
    houseAggMap[name].academic+=Number(h.academic)||0
    houseAggMap[name].sports+=Number(h.sports)||0
    houseAggMap[name].cultural+=Number(h.cultural)||0
    houseAggMap[name].discipline+=Number(h.discipline)||0
  })
  const housePoints=houseNames.map((name,i)=>{
    const agg=houseAggMap[name]||{academic:0,sports:0,cultural:0,discipline:0}
    const total=agg.academic+agg.sports+agg.cultural+agg.discipline
    return{...agg,name,points:total,color:HOUSE_COLORS[i%HOUSE_COLORS.length]}
  }).sort((a,b)=>b.points-a.points)

  const serviceHours=serviceHoursData.length>0
    ? serviceHoursData.map((h,i)=>({house:h.house_name,hours:Number(h.hours)||0,color:HOUSE_COLORS[i%HOUSE_COLORS.length]}))
    : houseNames.map((h,i)=>({house:h,hours:0,color:HOUSE_COLORS[i%HOUSE_COLORS.length]}))

  const clubsFormatted=clubsData.map((c,i)=>({name:c.name,members:Number(c.member_count)||0,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const sportsFormatted=sportsData.map(s=>({sport:s.sport,count:Number(s.student_count)||0}))
  const achievementsFormatted=achievementsData.map(a=>({title:a.title,house:a.house_name||"—",date:a.achieved_date?.slice(0,7)||"—"}))

  // ════════════════════════════════════════════════════════
  // BATCHES — empty currently
  // ════════════════════════════════════════════════════════
  const totalBatches = batchesData.length
  const activeBatches = batchesData.filter(b=>b.status==="Active").length
  const totalCapacity = batchesData.reduce((s,b)=>s+(Number(b.capacity)||0),0)
  const totalStrength = batchesData.reduce((s,b)=>s+(Number(b.strength)||0),0)
  const batchFillRate = pct(totalStrength,totalCapacity)
  const batchTypeMap={}
  batchesData.forEach(b=>{const t=b.batch_type||"Regular"; batchTypeMap[t]=(batchTypeMap[t]||0)+1})
  const batchByType=Object.entries(batchTypeMap).map(([name,count],i)=>({name,count,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const timetableByDay={}
  timetableData.forEach(t=>{const d=t.day_of_week||"Mon"; if(!timetableByDay[d]) timetableByDay[d]=0; timetableByDay[d]++})
  const timetableChart=["Mon","Tue","Wed","Thu","Fri","Sat"].map(d=>({day:d,classes:timetableByDay[d]||0}))

  // ════════════════════════════════════════════════════════
  // ENQUIRY — table empty, derive from admissions
  // ════════════════════════════════════════════════════════
  const totalEnquiries = allAdm.length
  const openEnquiries  = allAdm.filter(a=>a.status==="Applied"||a.status==="Under Review").length
  const convertedEnq   = admEnrolled
  const conversionRate = pct(convertedEnq,totalEnquiries)
  const followUpDue    = openEnquiries

  const enqSourceMap={}
  allAdm.forEach(a=>{const s=a.referral_source||"Unknown"; enqSourceMap[s]=(enqSourceMap[s]||0)+1})
  const enqBySource=Object.entries(enqSourceMap).map(([name,count],i)=>({name,count,color:COURSE_COLORS[i%COURSE_COLORS.length]}))

  const enqCourseMap={}
  allAdm.forEach(a=>{const c=a.course||"Unknown"; enqCourseMap[c]=(enqCourseMap[c]||0)+1})
  const enqByCourse=Object.entries(enqCourseMap).sort((a,b)=>b[1]-a[1]).map(([name,count],i)=>({name,count,color:COURSE_COLORS[i%COURSE_COLORS.length]}))

  const enqMonthMap={}
  allAdm.forEach(a=>{
    const mo=a.created_at?.slice(0,7)
    if(!mo) return
    if(!enqMonthMap[mo]) enqMonthMap[mo]={enquiries:0,converted:0}
    enqMonthMap[mo].enquiries++
    if(a.status==="Enrolled") enqMonthMap[mo].converted++
  })
  const enqTrend=ACADEMIC_MONTHS.map(m=>({month:m.label,enquiries:enqMonthMap[m.key]?.enquiries||0,converted:enqMonthMap[m.key]?.converted||0}))

  const recentEnquiries=allAdm.slice(-6).reverse().map(a=>({
    name:a.applicant_name,
    course_interest:a.course,
    source:a.referral_source||"—",
    status:a.status,
    follow_up_date:a.created_at?.slice(0,10),
  }))

  // ════════════════════════════════════════════════════════
  // DOUBTS — empty currently
  // ════════════════════════════════════════════════════════
  const totalDoubts = doubtSessionsData.length
  const resolvedDoubts = doubtSessionsData.filter(d=>d.status==="Resolved"||d.resolved_date).length
  const unresolvedDoubts = totalDoubts-resolvedDoubts
  const avgResolutionHrs = 0
  const doubtsBySubject=[]
  const doubtsByBatch=[]
  const doubtStaffLeaderboard=[]
  const doubtTrend=ACADEMIC_MONTHS.map(m=>({month:m.label,raised:0,resolved:0}))

  // ════════════════════════════════════════════════════════
  // PARENTS / SMS — empty currently
  // ════════════════════════════════════════════════════════
  const totalSMSSent = smsLogsData.reduce((s,l)=>s+(Number(l.count)||1),0)
  const smsSent      = smsLogsData.filter(l=>l.status==="Sent"||l.status==="Delivered").length
  const smsFailed    = smsLogsData.filter(l=>l.status==="Failed").length
  const smsDeliveryRate = pct(smsSent,smsLogsData.length)
  const smsTypeMap={}
  smsLogsData.forEach(l=>{const t=l.message_type||"General"; smsTypeMap[t]=(smsTypeMap[t]||0)+(Number(l.count)||1)})
  const smsByType=Object.entries(smsTypeMap).map(([name,count],i)=>({name,count,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const smsMonthMap={}
  smsLogsData.forEach(l=>{const mo=l.sent_at?.slice(0,7); if(!mo) return; smsMonthMap[mo]=(smsMonthMap[mo]||0)+(Number(l.count)||1)})
  const smsTrend=ACADEMIC_MONTHS.map(m=>({month:m.label,count:smsMonthMap[m.key]||0}))

  // ════════════════════════════════════════════════════════
  // STUDY MATERIAL — empty currently
  // ════════════════════════════════════════════════════════
  const totalMaterials      = studyMaterialData.length
  const distributedMat      = studyMaterialData.filter(m=>(Number(m.distributed_copies)||0)>0).length
  const pendingDistribution = totalMaterials-distributedMat
  const totalCopies         = studyMaterialData.reduce((s,m)=>s+(Number(m.total_copies)||0),0)
  const distributedCopies   = studyMaterialData.reduce((s,m)=>s+(Number(m.distributed_copies)||0),0)
  const matTypeMap={}
  studyMaterialData.forEach(m=>{const t=m.material_type||"Notes"; matTypeMap[t]=(matTypeMap[t]||0)+1})
  const materialByType=Object.entries(matTypeMap).map(([name,count],i)=>({name,count,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const matSubjectMap={}
  studyMaterialData.forEach(m=>{const s=m.subject||"Other"; if(!matSubjectMap[s]) matSubjectMap[s]={total:0,distributed:0}; matSubjectMap[s].total+=Number(m.total_copies)||0; matSubjectMap[s].distributed+=Number(m.distributed_copies)||0})
  const materialBySubject=Object.entries(matSubjectMap).map(([subject,v],i)=>({subject,total:v.total,distributed:v.distributed,color:COURSE_COLORS[i%COURSE_COLORS.length]}))

  // ════════════════════════════════════════════════════════
  // RESULTS / SELECTIONS — empty currently
  // ════════════════════════════════════════════════════════
  const totalSelections  = selectionsData.length
  const jnvSelections    = selectionsData.filter(s=>s.exam_name?.toLowerCase().includes("jnv")||s.exam_name?.toLowerCase().includes("navodaya")).length
  const sainikSelections = selectionsData.filter(s=>s.exam_name?.toLowerCase().includes("sainik")).length
  const otherSelections  = totalSelections-jnvSelections-sainikSelections
  const selectionByYear={}
  selectionsData.forEach(s=>{const y=s.year||"Unknown"; selectionByYear[y]=(selectionByYear[y]||0)+1})
  const selectionTrend=Object.entries(selectionByYear).sort((a,b)=>a[0].localeCompare(b[0])).map(([year,count])=>({year,count}))
  const selectionByExam={}
  selectionsData.forEach(s=>{const e=s.exam_name||"Other"; selectionByExam[e]=(selectionByExam[e]||0)+1})
  const selByExam=Object.entries(selectionByExam).map(([name,count],i)=>({name,count,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const selectionByBatch={}
  selectionsData.forEach(s=>{const b=s.batch_name||"Unknown"; selectionByBatch[b]=(selectionByBatch[b]||0)+1})
  const selByBatch=Object.entries(selectionByBatch).map(([batch,count],i)=>({batch,count,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const recentSelections=selectionsData.slice(-8).reverse()

  // ════════════════════════════════════════════════════════
  // TEACHING / SYLLABUS — monthly_syllabus table
  // ════════════════════════════════════════════════════════
  const totalTopics   = syllabusCoverageData.reduce((s,r)=>s+(Number(r.total_topics)||0),0)
  const coveredTopics = syllabusCoverageData.reduce((s,r)=>s+(Number(r.covered_topics)||0),0)
  const overallCoverage = pct(coveredTopics,totalTopics)
  const teacherCoverageMap={}
  syllabusCoverageData.forEach(r=>{
    const t=r.teacher_name||"Unknown"
    if(!teacherCoverageMap[t]) teacherCoverageMap[t]={name:t,total:0,covered:0,subjects:new Set()}
    teacherCoverageMap[t].total+=Number(r.total_topics)||0
    teacherCoverageMap[t].covered+=Number(r.covered_topics)||0
    if(r.subject) teacherCoverageMap[t].subjects.add(r.subject)
  })
  const teacherCoverage=Object.values(teacherCoverageMap).map(t=>({name:t.name,total:t.total,covered:t.covered,pct:t.total>0?pct(t.covered,t.total):0,subjects:t.subjects.size})).sort((a,b)=>b.pct-a.pct)
  const subjectCoverageMap={}
  syllabusCoverageData.forEach(r=>{
    const s=r.subject||"Other"
    if(!subjectCoverageMap[s]) subjectCoverageMap[s]={total:0,covered:0}
    subjectCoverageMap[s].total+=Number(r.total_topics)||0
    subjectCoverageMap[s].covered+=Number(r.covered_topics)||0
  })
  const subjectCoverage=Object.entries(subjectCoverageMap).map(([subject,v],i)=>({subject:subject.slice(0,10),total:v.total,covered:v.covered,pct:v.total>0?pct(v.covered,v.total):0,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const coverageMonthMap={}
  syllabusCoverageData.forEach(r=>{
    const mo=r.month||""
    if(!mo) return
    if(!coverageMonthMap[mo]) coverageMonthMap[mo]={total:0,covered:0}
    coverageMonthMap[mo].total+=Number(r.total_topics)||0
    coverageMonthMap[mo].covered+=Number(r.covered_topics)||0
  })
  const coverageTrend=ACADEMIC_MONTHS.map(m=>({month:m.label,pct:coverageMonthMap[m.key]?.total>0?pct(coverageMonthMap[m.key].covered,coverageMonthMap[m.key].total):0}))

  // ════════════════════════════════════════════════════════
  // TEACHER STREAK TRACKER
  // ════════════════════════════════════════════════════════
  const wc = str => str?.trim().split(/\s+/).filter(Boolean).length || 0
  const teacherLogMap = {}
  teachingLogsRaw.forEach(l => {
    const name = l.teacher_name || 'Unknown'
    if (!teacherLogMap[name]) teacherLogMap[name] = []
    teacherLogMap[name].push(l)
  })
  const teacherStreaks = Object.entries(teacherLogMap).map(([name, logs]) => {
    const dates = [...new Set(logs.map(l => l.teaching_date))].sort()
    // Streak calculation
    let streak = 0, maxStreak = 0, cur = 0
    const todayD = new Date(today)
    for (let i = dates.length - 1; i >= 0; i--) {
      const d = new Date(dates[i])
      const diff = Math.floor((todayD - d) / 86400000)
      if (diff === streak) { cur++; streak++ }
      else break
    }
    maxStreak = cur
    // Missing days this month
    const monthKey = today.slice(0, 7)
    const daysInMonth = new Date(todayD.getFullYear(), todayD.getMonth() + 1, 0).getDate()
    const loggedDays = new Set(logs.filter(l => l.teaching_date?.startsWith(monthKey)).map(l => l.teaching_date)).size
    const missingDays = todayD.getDate() - loggedDays
    // Late submissions
    const lateCount = logs.filter(l => l.late_submission).length
    // Avg word count
    const avgWc = logs.length > 0 ? Math.round(logs.reduce((s, l) => s + wc(l.topic_taught) + wc(l.classwork) + wc(l.remarks), 0) / logs.length) : 0
    return { name, streak: maxStreak, totalLogs: logs.length, missingDays: Math.max(0, missingDays), lateCount, avgWc }
  }).sort((a, b) => b.streak - a.streak)

  // ════════════════════════════════════════════════════════
  // EXPENSES — accounts table with type='Expense'
  // ════════════════════════════════════════════════════════
  const totalExpenses = expensesData.reduce((s,e)=>s+(Number(e.amount)||0),0)
  const netPL = totalFeeCollected-totalExpenses
  const expenseCategoryMap={}
  expensesData.forEach(e=>{const c=e.category||"Other"; expenseCategoryMap[c]=(expenseCategoryMap[c]||0)+(Number(e.amount)||0)})
  const expenseByCategory=Object.entries(expenseCategoryMap).sort((a,b)=>b[1]-a[1]).map(([name,amount],i)=>({name,amount,color:COURSE_COLORS[i%COURSE_COLORS.length]}))

  // P&L trend: income vs expense by month using entry_date
  const expenseMonthMap={}
  expensesData.forEach(e=>{
    const mo=e.entry_date?.slice(0,7)
    if(!mo) return
    expenseMonthMap[mo]=(expenseMonthMap[mo]||0)+(Number(e.amount)||0)
  })
  const plTrend=ACADEMIC_MONTHS.map(m=>({
    month:m.label,
    income:allIncome.filter(r=>r.entry_date?.startsWith(m.key)).reduce((s,r)=>s+(Number(r.amount)||0),0),
    expense:expenseMonthMap[m.key]||0,
  })).map(m=>({...m,pl:m.income-m.expense}))

  const recentExpenses=expensesData.slice(-6).reverse()

  // ════════════════════════════════════════════════════════
  // NOTIFICATIONS
  // ════════════════════════════════════════════════════════
  const notifications=[]
  if(taskOverdue>0)     notifications.push({type:"warning",msg:`${taskOverdue} checklist tasks overdue`,time:"Just now"})
  if(defaultersRes.data?.length>0) notifications.push({type:"error",msg:`${defaultersRes.data.length} students have outstanding fees`,time:"Today"})
  if(recentFeeActivity.length>0){
    const last=recentFeeActivity[0]
    notifications.push({type:"success",msg:`${fmt(last.amount_paid||0)} collected — ${last.description||last.fee_type||"fee"}`,time:last.pay_date||"Today"})
  }
  if(openEnquiries>0) notifications.push({type:"info",msg:`${openEnquiries} applications pending review`,time:"This week"})

  // ════════════════════════════════════════════════════════
  // RETURN — all dashboard data
  // ════════════════════════════════════════════════════════
  return {
    // Students
    totalStudents:admEnrolled||totalStudentsCount,
    maleStudents, femaleStudents,
    boarders, dayBoarders, dayScholars,
    stateData, ageDistribution,

    // Admissions
    totalAdmissions:allAdm.length,
    admApplied, admUnderReview, admAdmitted, admEnrolled, admRejected, admWaitlisted,
    courseBreakdown, applicationSource, yoyAdmissions,
    recentAdmissions:recentAdmRes.data||[],
    admissionFunnel,

    // Finance
    totalFeeCollected, feePending,
    admFeeTotal, flatFeeTotal, courseFeeTotal,
    totalWaivers, monthlyFees, feeAging, feeWaivers, scholarships,
    recentFeeActivity,
    defaulters:(defaultersRes.data||[]).map(d=>({name:d.student_name||"—",gcc:`GCC-${d.gcc_no}`,due:Number(d.amount_due)||0,course:d.course||"—",status:d.status})),

    // Staff
    totalStaff, activeStaffCnt, totalSalaryBill,
    taskPending, taskDone, taskOverdue,
    taskByDept, topStaff, latestMonth,
    allTasks,
    salaryTrend, leaveBreakdown, recruitmentFunnel, trainingHours, staffRadar, slaBreach,

    // Attendance
    presentToday, absentToday, lateToday, totalToday,
    attendanceWeek, monthlyAttTrend, scatterData:[],

    // Academic
    avgScore:avgScore_all, passRate, aPlusCount, atRisk,
    gradeDistribution, subjectScores, scoreByCourseFallback:[],

    // Hostel
    hostelRooms, hostelTotalRooms, hostelOccupied, hostelVacant,
    messChartData, hostelIncidentChart,

    // Houses
    housePoints, serviceHours, clubsFormatted, sportsFormatted,
    achievementsFormatted, notifications,

    // Batches
    totalBatches, activeBatches, totalCapacity, totalStrength,
    batchFillRate, batchesData, batchByType, timetableChart,

    // Tests
    totalTests, totalTestEntries, avgTestScore,
    testByType, topPerformers, testSubjectScores, batchScores,
    testTrend, atRiskStudents,

    // Enquiry
    totalEnquiries, openEnquiries, convertedEnq, conversionRate,
    followUpDue, enqBySource, enqByCourse, enqTrend,
    enquiryFunnel, recentEnquiries,

    // Doubts
    totalDoubts, resolvedDoubts, unresolvedDoubts, avgResolutionHrs,
    doubtsBySubject, doubtsByBatch, doubtStaffLeaderboard, doubtTrend,

    // Parents / SMS
    totalSMSSent, smsSent, smsFailed, smsDeliveryRate,
    smsByType, smsTrend,

    // Material
    totalMaterials, distributedMat, pendingDistribution,
    totalCopies, distributedCopies, materialByType, materialBySubject,

    // Results
    totalSelections, jnvSelections, sainikSelections, otherSelections,
    selectionTrend, selByExam, selByBatch, recentSelections,

    // Teaching
    overallCoverage, teacherCoverage, subjectCoverage, coverageTrend, teacherStreaks,

    // Expenses
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
    // Live updates from accounts table (Income inserts)
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
    <div style={{minHeight:"100vh",background:T.navy,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12}}>
      <div style={{color:T.rose,fontSize:14,fontWeight:700}}>❌ {error}</div>
      <button onClick={load} style={{padding:"8px 20px",borderRadius:8,border:"none",background:T.gold,color:T.navy,fontWeight:700,cursor:"pointer"}}>Retry</button>
    </div>
  )

  if(loading||!data) return(
    <div style={{minHeight:"100vh",background:T.navy,padding:32,display:"flex",gap:20}}>
      <style>{`@keyframes shimmer{0%{opacity:.4}50%{opacity:.8}100%{opacity:.4}}`}</style>
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
    <div style={{minHeight:"100vh",background:T.navy,fontFamily:"'DM Sans','Segoe UI',system-ui,sans-serif",color:T.white}}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes shimmer{0%{opacity:.4}50%{opacity:.8}100%{opacity:.4}}
        @keyframes slideIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box;scrollbar-width:thin;scrollbar-color:${T.navyLt} transparent}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:${T.navyLt};border-radius:2px}
        html{scroll-behavior:smooth}
      `}</style>

      <div style={{padding:"22px 26px",maxWidth:"100%"}}>

        {/* ═══ OVERVIEW ══════════════════════════════════════════ */}
        <div ref={setSectionRef('overview')}>
        <section style={{marginBottom:40}}>
          <div style={{marginBottom:20}}>
            <h1 style={{fontSize:22,fontWeight:900,margin:0}}>Good {now.getHours()<12?"Morning":now.getHours()<17?"Afternoon":"Evening"} 👋</h1>
            <p style={{color:T.slateL,fontSize:13,margin:"4px 0 0"}}>{now.toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"})} · AY {CURRENT_YEAR}–{CURRENT_YEAR+1}</p>
          </div>

          <div style={{background:`linear-gradient(135deg,${T.gold}18,${T.gold}08)`,border:`1px solid ${T.gold}33`,borderRadius:16,padding:"18px 22px",marginBottom:20,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:16}}>
            <div style={{display:"flex",alignItems:"center",gap:14}}>
              <span style={{fontSize:26}}>💰</span>
              <div>
                <div style={{fontSize:10,color:T.gold,fontWeight:700,textTransform:"uppercase",letterSpacing:".1em"}}>Live Fee Collection · AY {CURRENT_YEAR}–{CURRENT_YEAR+1}</div>
                <div style={{fontSize:28,fontWeight:900,color:T.white,letterSpacing:"-.03em",marginTop:2}}>{fmt(liveTotal)}</div>
              </div>
            </div>
            <div style={{flex:1,maxWidth:280}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5,fontSize:11,color:T.slateL}}>
                <span>Collection progress</span>
                <span style={{color:T.gold,fontWeight:700}}>{feeProgress}% · {fmt(data.feePending)} pending</span>
              </div>
              <ProgressBar value={liveTotal} max={liveTotal+data.feePending} color={T.gold} height={10}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,textAlign:"center"}}>
              {[{label:"Admission",val:data.admFeeTotal,color:T.violet},{label:"Flat Fee",val:data.flatFeeTotal,color:T.sky},{label:"Course",val:data.courseFeeTotal,color:T.emerald}].map(x=>(
                <div key={x.label}><div style={{fontSize:10,color:x.color,fontWeight:700,textTransform:"uppercase"}}>{x.label}</div><div style={{fontSize:13,fontWeight:800,color:T.white,marginTop:2}}>{fmt(x.val)}</div></div>
              ))}
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:13,marginBottom:20}}>
            <KPI icon="🎓" label="Students" value={data.totalStudents} color={T.sky} sub={`${data.admEnrolled||data.totalStudents} enrolled`}/>
            <KPI icon="🗂️" label="Batches" value={data.activeBatches} color={T.indigo} sub={`${data.totalBatches} total · ${data.batchFillRate}% fill`}/>
            <KPI icon="📝" label="Exam Entries" value={data.totalTestEntries} color={T.violet} sub={`Avg score ${data.avgTestScore}%`}/>
            <KPI icon="🔍" label="Applications" value={data.totalEnquiries} color={T.amber} sub={`${data.convertedEnq} enrolled · ${data.conversionRate}%`}/>
            <KPI icon="✅" label="Present Today" value={data.presentToday} color={T.emerald} progress={data.presentToday} progressMax={data.totalToday}/>
            <KPI icon="🏅" label="Selections" value={data.totalSelections} color={T.gold} sub={`JNV: ${data.jnvSelections} · Sainik: ${data.sainikSelections}`}/>
            <KPI icon="💸" label="Fee Pending" value={data.feePending} color={T.rose} isMoney/>
            <KPI icon="📉" label="Net P&L" value={data.netPL} color={data.netPL>=0?T.emerald:T.rose} isMoney sub={`Exp: ${fmt(data.totalExpenses)}`}/>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16,marginBottom:16}}>
            <Panel title="Monthly Fee Collection vs Target">
              <ResponsiveContainer width="100%" height={190}>
                <ComposedChart data={data.monthlyFees}>
                  <XAxis dataKey="month" tick={{fill:T.slateL,fontSize:11}} axisLine={false} tickLine={false}/>
                  <YAxis hide/>
                  <Tooltip content={<Tip/>} cursor={{fill:"rgba(255,255,255,.03)"}}/>
                  <Bar dataKey="collected" name="Collected" radius={[5,5,0,0]} barSize={22}>
                    {data.monthlyFees.map((m,i)=><Cell key={i} fill={m.collected>0?T.gold:`${T.slate}33`}/>)}
                  </Bar>
                  <Line dataKey="target" name="Target" stroke={T.rose} strokeWidth={2} strokeDasharray="4 3" dot={false}/>
                </ComposedChart>
              </ResponsiveContainer>
            </Panel>
            <Panel title="Admission Pipeline" sub="Lead to enrolment">
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {data.enquiryFunnel.map((s,i,arr)=>{const prev=arr[i-1];return(
                  <div key={s.stage}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:11,color:T.slateL}}>{s.stage}</span>
                      <div><span style={{fontSize:13,fontWeight:800,color:s.color}}>{s.count}</span>{prev&&<span style={{fontSize:10,color:T.slate}}> ({pct(s.count,prev.count)}%)</span>}</div>
                    </div>
                    <ProgressBar value={s.count} max={data.enquiryFunnel[0].count||1} color={s.color} height={8}/>
                  </div>
                )})}
              </div>
            </Panel>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginBottom:16}}>
            <Panel title="Recent Fee Activity">
              {data.recentFeeActivity.length===0?<EmptyState msg="No payments yet"/>:(
                <div style={{display:"flex",flexDirection:"column",gap:7}}>
                  {data.recentFeeActivity.map((a,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:9,padding:"7px 9px",borderRadius:9,background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.05)"}}>
                      <div style={{width:28,height:28,borderRadius:7,flexShrink:0,background:`${T.gold}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:T.gold}}>{(a.description||a.fee_type||"?")[0].toUpperCase()}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:700,color:T.white,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.description||a.fee_type||"—"}</div>
                        <div style={{fontSize:10,color:T.slateL}}>{a.pay_date||"—"} · {a.pay_mode||"—"}</div>
                      </div>
                      <div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:12,fontWeight:800,color:T.emerald}}>{fmt(a.amount_paid)}</div></div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
            <Panel title="⚠️ Defaulters" accent={T.rose}>
              {data.defaulters.length===0?<div style={{color:T.emerald,fontSize:13,fontWeight:600}}>✅ No outstanding fees!</div>:(
                <div style={{display:"flex",flexDirection:"column",gap:7}}>
                  {data.defaulters.map((d,i)=>(
                    <div key={i} style={{padding:"8px 10px",borderRadius:9,background:`${T.rose}08`,border:`1px solid ${T.rose}18`}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                        <div style={{fontSize:12,fontWeight:700,color:T.white}}>{d.name}</div>
                        <div style={{fontSize:12,fontWeight:800,color:T.rose}}>{fmt(d.due)}</div>
                      </div>
                      <div style={{fontSize:10,color:T.slateL}}>{d.gcc} · {d.course}</div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
            <Panel title="🔔 Notifications">
              {data.notifications.length===0?<EmptyState msg="All clear!"/>:(
                <div style={{display:"flex",flexDirection:"column",gap:7}}>
                  {data.notifications.map((n,i)=>{const c={warning:T.amber,error:T.rose,success:T.emerald,info:T.sky}[n.type];const ic={warning:"⚠️",error:"🔴",success:"✅",info:"ℹ️"}[n.type];return(
                    <div key={i} style={{display:"flex",gap:9,padding:"8px 10px",borderRadius:9,background:`${c}08`,border:`1px solid ${c}18`}}>
                      <span style={{fontSize:13}}>{ic}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:11,color:T.white,lineHeight:1.4}}>{n.msg}</div>
                        <div style={{fontSize:10,color:T.slate,marginTop:2}}>{n.time}</div>
                      </div>
                    </div>
                  )})}
                </div>
              )}
            </Panel>
          </div>

          <Panel title="Admission Pipeline" sub="Live conversion rates">
            <div style={{display:"flex",alignItems:"stretch",gap:8}}>
              {data.admissionFunnel.map((s,i,arr)=>{const prev=arr[i-1];const conv=prev?pct(s.count,prev.count):100;return(
                <div key={s.stage} style={{flex:1,position:"relative"}}>
                  <div style={{background:`${s.color}14`,border:`1px solid ${s.color}30`,borderRadius:12,padding:"14px 10px",textAlign:"center"}}>
                    <div style={{fontSize:22,fontWeight:900,color:s.color}}><Counter value={s.count}/></div>
                    <div style={{fontSize:11,color:T.slateL,marginTop:3,fontWeight:600}}>{s.stage}</div>
                    {i>0&&<div style={{fontSize:11,fontWeight:700,marginTop:4,color:conv>=80?T.emerald:conv>=60?T.amber:T.rose}}>{conv}% conv.</div>}
                  </div>
                  {i<3&&<div style={{position:"absolute",right:-8,top:"50%",transform:"translateY(-50%)",color:T.slate,fontSize:18,zIndex:2}}>›</div>}
                </div>
              )})}
            </div>
          </Panel>
        </section>
        </div>

        {/* ═══ FINANCE ═══════════════════════════════════════════ */}
        <div ref={setSectionRef('finance')}>
        <section style={{marginBottom:40}}>
          <SectionHeader icon="💰" title="Finance & Fee Analytics"/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:13,marginBottom:20}}>
            <KPI icon="💰" label="Total Collected" value={liveTotal} isMoney color={T.gold}/>
            <KPI icon="📌" label="Fee Pending" value={data.feePending} isMoney color={T.rose}/>
            <KPI icon="🎓" label="Admission Fee" value={data.admFeeTotal} isMoney color={T.violet}/>
            <KPI icon="📄" label="Flat Fee" value={data.flatFeeTotal} isMoney color={T.sky}/>
            <KPI icon="📚" label="Course Fee" value={data.courseFeeTotal} isMoney color={T.emerald}/>
            <KPI icon="🎁" label="Waivers Given" value={data.totalWaivers} isMoney color={T.amber}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16,marginBottom:16}}>
            <Panel title="Monthly Collection vs Target">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data.monthlyFees}>
                  <defs><linearGradient id="feeGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.gold} stopOpacity={0.3}/><stop offset="95%" stopColor={T.gold} stopOpacity={0}/></linearGradient></defs>
                  <XAxis dataKey="month" tick={{fill:T.slateL,fontSize:11}} axisLine={false} tickLine={false}/>
                  <YAxis hide/><Tooltip content={<Tip/>}/>
                  <Area dataKey="collected" name="Collected" stroke={T.gold} strokeWidth={2.5} fill="url(#feeGrad)"/>
                  <Line dataKey="target" name="Target" stroke={T.rose} strokeWidth={2} strokeDasharray="4 3" dot={false}/>
                </AreaChart>
              </ResponsiveContainer>
            </Panel>
            <Panel title="Fee Aging Buckets">
              {data.feeAging.every(f=>f.amount===0)?<EmptyState msg="No outstanding invoices"/>:data.feeAging.map(f=>(
                <div key={f.bucket} style={{marginBottom:14}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:12,color:T.slateL}}>{f.bucket}</span>
                    <span style={{fontSize:13,fontWeight:800,color:f.color}}>{fmt(f.amount)}</span>
                  </div>
                  <ProgressBar value={f.amount} max={data.feePending||1} color={f.color} height={7}/>
                </div>
              ))}
            </Panel>
          </div>
          <Panel title="Fee Defaulters">
            {data.defaulters.length===0?<div style={{color:T.emerald,fontWeight:600,fontSize:13}}>✅ No outstanding invoices!</div>:(
              <table style={{width:"100%",borderCollapse:"separate",borderSpacing:"0 5px"}}>
                <thead><tr>{["Student","GCC","Course","Due","Status"].map(h=><th key={h} style={{textAlign:"left",fontSize:11,color:T.slate,fontWeight:600,padding:"6px 12px",textTransform:"uppercase",letterSpacing:".06em"}}>{h}</th>)}</tr></thead>
                <tbody>{data.defaulters.map((d,i)=>(
                  <tr key={i}>
                    {[d.name,d.gcc,d.course,fmt(d.due)].map((v,j)=><td key={j} style={{fontSize:13,color:j===3?T.rose:T.white,fontWeight:j===3?800:400,padding:"9px 12px",background:"rgba(255,255,255,.03)",borderRadius:j===0?"10px 0 0 10px":j===3?"0 10px 10px 0":"0"}}>{v}</td>)}
                    <td style={{padding:"9px 12px",background:"rgba(255,255,255,.03)",borderRadius:"0 10px 10px 0"}}><Badge label={d.status} color={statusColor(d.status)}/></td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </Panel>
        </section>
        </div>

        {/* ═══ STUDENTS ══════════════════════════════════════════ */}
        <div ref={setSectionRef('students')}>
        <section style={{marginBottom:40}}>
          <SectionHeader icon="🎓" title="Student Analytics"/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:13,marginBottom:20}}>
            <KPI icon="👥" label="Total" value={data.totalStudents} color={T.sky}/>
            <KPI icon="👦" label="Male" value={data.maleStudents} color={T.sky} progress={data.maleStudents} progressMax={data.totalStudents}/>
            <KPI icon="👧" label="Female" value={data.femaleStudents} color={T.pink} progress={data.femaleStudents} progressMax={data.totalStudents}/>
            <KPI icon="🏠" label="Boarders" value={data.boarders} color={T.violet}/>
            <KPI icon="🚌" label="Day Boarders" value={data.dayBoarders} color={T.amber}/>
            <KPI icon="🏡" label="Day Scholars" value={data.dayScholars} color={T.emerald}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginBottom:16}}>
            <Panel title="Gender Split">
              <div style={{display:"flex",alignItems:"center",gap:16}}>
                <Gauge value={data.totalStudents>0?pct(data.maleStudents,data.totalStudents):0} color={T.sky} size={90}/>
                <div style={{flex:1}}>
                  {[{l:"Male",v:data.maleStudents,c:T.sky},{l:"Female",v:data.femaleStudents,c:T.pink}].map(x=>(
                    <div key={x.l} style={{marginBottom:10}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:12,color:T.slateL}}>{x.l}</span><span style={{fontSize:12,fontWeight:800,color:x.c}}>{x.v}</span></div>
                      <ProgressBar value={x.v} max={data.totalStudents||1} color={x.c}/>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
            <Panel title="Course Distribution">
              {data.courseBreakdown.length===0?<EmptyState msg="No course data"/>:(
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {data.courseBreakdown.map(s=>(
                    <div key={s.name}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:11,color:T.slateL}}>{s.name}</span><span style={{fontSize:11,fontWeight:700,color:s.color}}>{s.students}</span></div>
                      <ProgressBar value={s.students} max={data.courseBreakdown[0]?.students||1} color={s.color} height={4}/>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
            <Panel title="Hostel Type">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={[{name:"Boarder",value:data.boarders,color:T.violet},{name:"Day Boarder",value:data.dayBoarders,color:T.amber},{name:"Day Scholar",value:data.dayScholars,color:T.emerald}].filter(x=>x.value>0)} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={4}>
                    {[T.violet,T.amber,T.emerald].map((c,i)=><Cell key={i} fill={c}/>)}
                  </Pie>
                  <Tooltip content={<Tip/>}/><Legend formatter={v=><span style={{color:T.slateL,fontSize:11}}>{v}</span>}/>
                </PieChart>
              </ResponsiveContainer>
            </Panel>
          </div>
          <Panel title="Recent Admissions">
            {data.recentAdmissions.length===0?<EmptyState msg="No admissions"/>:(
              <table style={{width:"100%",borderCollapse:"separate",borderSpacing:"0 5px"}}>
                <thead><tr>{["Name","Batch","Status","Date"].map(h=><th key={h} style={{textAlign:"left",fontSize:11,color:T.slate,fontWeight:600,padding:"5px 12px",textTransform:"uppercase",letterSpacing:".06em"}}>{h}</th>)}</tr></thead>
                <tbody>{data.recentAdmissions.map((a,i)=>(
                  <tr key={i}>
                    <td style={{fontSize:13,color:T.white,padding:"9px 12px",background:"rgba(255,255,255,.03)",borderRadius:"10px 0 0 10px"}}>{a.applicant_name||"—"}</td>
                    <td style={{fontSize:13,color:T.white,padding:"9px 12px",background:"rgba(255,255,255,.03)"}}>{a.batch||"—"}</td>
                    <td style={{padding:"9px 12px",background:"rgba(255,255,255,.03)"}}><Badge label={a.status||"—"} color={statusColor(a.status)}/></td>
                    <td style={{padding:"9px 12px",background:"rgba(255,255,255,.03)",borderRadius:"0 10px 10px 0",fontSize:12,color:T.slateL}}>{a.created_at?.slice(0,10)||"—"}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </Panel>
        </section>
        </div>

        {/* ═══ ADMISSIONS ════════════════════════════════════════ */}
        <div ref={setSectionRef('admissions')}>
        <section style={{marginBottom:40}}>
          <SectionHeader icon="📋" title="Admissions Deep Dive"/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",gap:13,marginBottom:20}}>
            <KPI icon="📩" label="Applied" value={data.admApplied} color={T.sky}/>
            <KPI icon="🔍" label="Under Review" value={data.admUnderReview} color={T.violet}/>
            <KPI icon="✅" label="Admitted" value={data.admAdmitted} color={T.amber}/>
            <KPI icon="🎓" label="Enrolled" value={data.admEnrolled} color={T.emerald}/>
            <KPI icon="❌" label="Rejected" value={data.admRejected} color={T.rose}/>
            <KPI icon="⏳" label="Waitlisted" value={data.admWaitlisted} color={T.slateL}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
            <Panel title="Admission Funnel">
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {data.admissionFunnel.map((s,i,arr)=>{const prev=arr[i-1];return(
                  <div key={s.stage}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                      <span style={{fontSize:12,color:T.slateL}}>{s.stage}</span>
                      <div><span style={{fontSize:14,fontWeight:800,color:s.color}}>{s.count}</span>{prev&&<span style={{fontSize:11,color:T.slate}}> ({pct(s.count,prev.count)}%)</span>}</div>
                    </div>
                    <ProgressBar value={s.count} max={data.admissionFunnel[0].count||1} color={s.color} height={11}/>
                  </div>
                )})}
              </div>
            </Panel>
            <Panel title="Referral Source">
              {data.applicationSource.length===0?<EmptyState msg="No referral_source data"/>:(
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={data.applicationSource} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4}>
                      {data.applicationSource.map((p,i)=><Cell key={i} fill={p.color}/>)}
                    </Pie>
                    <Tooltip content={<Tip/>}/>
                    <Legend formatter={v=><span style={{color:T.slateL,fontSize:11}}>{v}</span>}/>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Panel>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <Panel title="Course Breakdown">
              {data.courseBreakdown.length===0?<EmptyState msg="No data"/>:(
                <div style={{display:"flex",flexDirection:"column",gap:9}}>
                  {data.courseBreakdown.map(c=>(
                    <div key={c.name}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:12,color:T.slateL}}>{c.name}</span><span style={{fontSize:12,fontWeight:700,color:c.color}}>{c.students}</span></div>
                      <ProgressBar value={c.students} max={data.totalAdmissions||1} color={c.color}/>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
            <Panel title="YoY Batch Growth">
              {data.yoyAdmissions.length===0?<EmptyState msg="No batch data"/>:(
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={data.yoyAdmissions}>
                    <XAxis dataKey="year" tick={{fill:T.slateL,fontSize:11}} axisLine={false} tickLine={false}/>
                    <YAxis hide/><Tooltip content={<Tip/>}/>
                    <Bar dataKey="count" name="Admissions" radius={[6,6,0,0]} barSize={32}>
                      {data.yoyAdmissions.map((y,i)=><Cell key={i} fill={i===data.yoyAdmissions.length-1?T.gold:`${T.gold}55`}/>)}
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
        <section style={{marginBottom:40}}>
          <SectionHeader icon="👨‍💼" title="Staff & HR"/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:13,marginBottom:20}}>
            <KPI icon="👥" label="Total Staff" value={data.totalStaff} color={T.sky} sub="From gnsi_staff_biodata"/>
            <KPI icon="✅" label="Active" value={data.activeStaffCnt} color={T.emerald}/>
            <KPI icon="💵" label="Salary Bill" value={data.totalSalaryBill} color={T.gold} isMoney/>
            <KPI icon="📋" label="Tasks Pending" value={data.taskPending} color={T.amber}/>
            <KPI icon="✔️" label="Tasks Done" value={data.taskDone} color={T.emerald}/>
            <KPI icon="⚠️" label="Overdue" value={data.taskOverdue} color={T.rose}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
            <Panel title="Management Checklist" sub="From management_checklist table">
              {data.allTasks?.length===0?<EmptyState msg="No checklist data"/>:(
                <div style={{display:"flex",flexDirection:"column",gap:7}}>
                  {data.allTasks?.map((t,i)=>(
                    <div key={i} style={{padding:"9px 12px",borderRadius:10,background:t.status==="Done"?`${T.emerald}08`:`${T.amber}08`,border:`1px solid ${t.status==="Done"?T.emerald:T.amber}18`}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                        <span style={{fontSize:12,fontWeight:700,color:T.white}}>{t.task||"—"}</span>
                        <Badge label={t.status||"Pending"} color={statusColor(t.status||"Pending")}/>
                      </div>
                      <div style={{fontSize:10,color:T.slateL}}>{t.section} · {t.owner} · {t.priority}</div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
            <Panel title="Task Status">
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:14}}>
                <Gauge value={data.taskPending+data.taskDone>0?pct(data.taskDone,data.taskPending+data.taskDone):0} color={T.emerald} size={90}/>
                <div style={{width:"100%"}}>
                  {[{l:"Done",v:data.taskDone,c:T.emerald},{l:"Pending",v:data.taskPending,c:T.amber},{l:"Overdue",v:data.taskOverdue,c:T.rose}].map(x=>(
                    <div key={x.l} style={{marginBottom:8}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:12,color:T.slateL}}>{x.l}</span><span style={{fontSize:12,fontWeight:700,color:x.c}}>{x.v}</span></div>
                      <ProgressBar value={x.v} max={(data.taskPending+data.taskDone+data.taskOverdue)||1} color={x.c} height={5}/>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          </div>
          <Panel title="Staff data will appear here once gnsi_staff_biodata is populated" accent={T.slate}>
            <EmptyState msg="Add staff records to gnsi_staff_biodata to see salary trends, performance leaderboard, and recruitment pipeline"/>
          </Panel>
        </section>
        </div>

        {/* ═══ ATTENDANCE ════════════════════════════════════════ */}
        <div ref={setSectionRef('attendance')}>
        <section style={{marginBottom:40}}>
          <SectionHeader icon="✅" title="Attendance Analytics"/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:13,marginBottom:20}}>
            <KPI icon="✅" label="Present" value={data.presentToday} color={T.emerald} progress={data.presentToday} progressMax={data.totalToday}/>
            <KPI icon="❌" label="Absent" value={data.absentToday} color={T.rose}/>
            <KPI icon="⏰" label="Late" value={data.lateToday} color={T.amber}/>
            <KPI icon="📊" label="Rate" value={attProgress} color={T.sky} sub={`${attProgress}% today`}/>
          </div>
          {data.attendanceWeek.length===0?(
            <Panel><EmptyState msg="No attendance records yet. Add records to the attendance table to see analytics here."/></Panel>
          ):(
            <>
              <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16,marginBottom:16}}>
                <Panel title="Last 7 Days">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data.attendanceWeek}>
                      <XAxis dataKey="day" tick={{fill:T.slateL,fontSize:11}} axisLine={false} tickLine={false}/><YAxis hide/><Tooltip content={<Tip/>}/>
                      <Bar dataKey="present" name="Present" fill={T.emerald} radius={[3,3,0,0]} barSize={26} stackId="a"/>
                      <Bar dataKey="late" name="Late" fill={T.amber} barSize={26} stackId="a"/>
                      <Bar dataKey="absent" name="Absent" fill={T.rose} radius={[3,3,0,0]} barSize={26} stackId="a"/>
                    </BarChart>
                  </ResponsiveContainer>
                </Panel>
                <Panel title="Today">
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:14,paddingTop:6}}>
                    <Gauge value={attProgress} max={100} color={T.emerald} size={100}/>
                    <div style={{width:"100%",display:"flex",flexDirection:"column",gap:7}}>
                      {[{label:"Present",val:data.presentToday,color:T.emerald},{label:"Absent",val:data.absentToday,color:T.rose},{label:"Late",val:data.lateToday,color:T.amber}].map(x=>(
                        <div key={x.label}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:12,color:T.slateL}}>{x.label}</span><span style={{fontSize:12,fontWeight:700,color:x.color}}>{x.val}</span></div>
                          <ProgressBar value={x.val} max={data.totalToday||1} color={x.color} height={5}/>
                        </div>
                      ))}
                    </div>
                  </div>
                </Panel>
              </div>
              <Panel title="Monthly Attendance Rate">
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={data.monthlyAttTrend}>
                    <defs><linearGradient id="attGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.emerald} stopOpacity={0.3}/><stop offset="95%" stopColor={T.emerald} stopOpacity={0}/></linearGradient></defs>
                    <XAxis dataKey="month" tick={{fill:T.slateL,fontSize:11}} axisLine={false} tickLine={false}/>
                    <YAxis domain={[0,100]} hide/><Tooltip content={<Tip/>}/>
                    <ReferenceLine y={85} stroke={T.amber} strokeDasharray="4 3" label={{value:"85% target",fill:T.amber,fontSize:10}}/>
                    <Area dataKey="rate" name="Attendance %" stroke={T.emerald} strokeWidth={2.5} fill="url(#attGrad)"/>
                  </AreaChart>
                </ResponsiveContainer>
              </Panel>
            </>
          )}
        </section>
        </div>

        {/* ═══ ACADEMIC ══════════════════════════════════════════ */}
        <div ref={setSectionRef('academic')}>
        <section style={{marginBottom:40}}>
          <SectionHeader icon="📚" title="Academic Performance"/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:13,marginBottom:20}}>
            <KPI icon="📊" label="Avg Score" value={data.avgScore} color={T.sky} sub={`${data.avgScore}% overall`}/>
            <KPI icon="✅" label="Pass Rate" value={data.passRate} color={T.emerald} sub={`${data.passRate}%`}/>
            <KPI icon="🏆" label="A+ Students" value={data.aPlusCount} color={T.gold}/>
            <KPI icon="📉" label="At Risk" value={data.atRisk} color={T.rose} sub="Below 35%"/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
            <Panel title="Grade Distribution" sub="From exam_marks table">
              {data.gradeDistribution.every(g=>g.count===0)?<EmptyState msg="No exam_marks data"/>:(
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={data.gradeDistribution}>
                    <XAxis dataKey="grade" tick={{fill:T.slateL,fontSize:12}} axisLine={false} tickLine={false}/>
                    <YAxis hide/><Tooltip content={<Tip/>}/>
                    <Bar dataKey="count" name="Students" radius={[5,5,0,0]} barSize={34}>{data.gradeDistribution.map((g,i)=><Cell key={i} fill={g.color}/>)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Panel>
            <Panel title="Subject Performance" sub="Avg score & pass rate">
              {data.subjectScores.length===0?<EmptyState msg="No subject data"/>:(
                <ResponsiveContainer width="100%" height={190}>
                  <ComposedChart data={data.subjectScores}>
                    <XAxis dataKey="subject" tick={{fill:T.slateL,fontSize:10}} axisLine={false} tickLine={false}/>
                    <YAxis hide domain={[0,100]}/><Tooltip content={<Tip/>}/>
                    <Bar dataKey="avg" name="Avg Score" fill={T.sky} radius={[4,4,0,0]} barSize={16}/>
                    <Line dataKey="pass" name="Pass Rate" stroke={T.emerald} strokeWidth={2.5} dot={{fill:T.emerald,r:3}}/>
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </Panel>
          </div>
        </section>
        </div>

        {/* ═══ HOSTEL ════════════════════════════════════════════ */}
        <div ref={setSectionRef('hostel')}>
        <section style={{marginBottom:40}}>
          <SectionHeader icon="🛏️" title="Hostel & Boarding"/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",gap:13,marginBottom:20}}>
            <KPI icon="🏠" label="Boarders" value={data.boarders} color={T.sky}/>
            <KPI icon="🛏️" label="Rooms Total" value={data.hostelTotalRooms} color={T.amber}/>
            <KPI icon="✅" label="Occupied" value={data.hostelOccupied} color={T.emerald} progress={data.hostelOccupied} progressMax={data.hostelTotalRooms}/>
            <KPI icon="📋" label="Incidents" value={data.hostelIncidentChart.reduce((s,m)=>s+m.count,0)} color={T.rose}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
            <Panel title="Block Occupancy">
              {data.hostelRooms.length===0?<EmptyState msg="No hostel_rooms data"/>:(
                <div style={{display:"flex",flexDirection:"column",gap:11}}>
                  {data.hostelRooms.map(b=>(
                    <div key={b.block}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:13,fontWeight:700,color:T.white}}>{b.block}</span><span style={{fontSize:13,fontWeight:800,color:b.color}}>{b.occupied}/{b.total}</span></div>
                      <ProgressBar value={b.occupied} max={b.total||1} color={b.color} height={9}/>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
            <Panel title="Mess Consumption">
              {data.messChartData.every(m=>m.breakfast===0)?<EmptyState msg="No mess_consumption data"/>:(
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.messChartData}>
                    <XAxis dataKey="month" tick={{fill:T.slateL,fontSize:10}} axisLine={false} tickLine={false}/>
                    <YAxis hide/><Tooltip content={<Tip/>}/><Legend formatter={v=><span style={{color:T.slateL,fontSize:10}}>{v}</span>}/>
                    <Bar dataKey="breakfast" name="Breakfast" fill={T.amber} radius={[3,3,0,0]} barSize={9}/>
                    <Bar dataKey="lunch" name="Lunch" fill={T.emerald} radius={[3,3,0,0]} barSize={9}/>
                    <Bar dataKey="dinner" name="Dinner" fill={T.violet} radius={[3,3,0,0]} barSize={9}/>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Panel>
          </div>
        </section>
        </div>

        {/* ═══ HOUSES ════════════════════════════════════════════ */}
        <div ref={setSectionRef('houses')}>
        <section style={{marginBottom:40}}>
          <SectionHeader icon="🏆" title="Houses & Co-curricular"/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:13,marginBottom:20}}>
            {data.housePoints.map((h,i)=>(
              <div key={h.name} style={{background:`linear-gradient(135deg,${h.color}18,${h.color}08)`,border:`1px solid ${h.color}33`,borderRadius:16,padding:"16px 18px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><span style={{fontSize:20,fontWeight:900,color:h.color}}>#{i+1}</span><Badge label={h.name} color={h.color}/></div>
                <div style={{fontSize:26,fontWeight:900,color:T.white,marginBottom:3}}><Counter value={h.points}/></div>
                <div style={{fontSize:11,color:T.slateL,marginBottom:9}}>Total points</div>
                <ProgressBar value={h.points} max={data.housePoints[0]?.points||1} color={h.color} height={5}/>
              </div>
            ))}
          </div>
          {data.housePoints.every(h=>h.points===0)&&<Panel><EmptyState msg="No house_points data yet. Add records to house_points table."/></Panel>}
        </section>
        </div>

        {/* ═══ OPERATIONS ════════════════════════════════════════ */}
        <div ref={setSectionRef('operations')}>
        <section style={{marginBottom:40}}>
          <SectionHeader icon="⚙️" title="Operations & Admin"/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",gap:13,marginBottom:20}}>
            <KPI icon="📋" label="Total Tasks" value={data.taskPending+data.taskDone+data.taskOverdue} color={T.sky}/>
            <KPI icon="✅" label="Completed" value={data.taskDone} color={T.emerald} progress={data.taskDone} progressMax={data.taskPending+data.taskDone+data.taskOverdue}/>
            <KPI icon="⏳" label="Pending" value={data.taskPending} color={T.amber}/>
            <KPI icon="🚨" label="Overdue" value={data.taskOverdue} color={T.rose}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
            <Panel title="Task Status">
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:14}}>
                <Gauge value={data.taskPending+data.taskDone>0?pct(data.taskDone,data.taskPending+data.taskDone):0} color={T.emerald} size={90}/>
                <div style={{width:"100%"}}>
                  {[{l:"Done",v:data.taskDone,c:T.emerald},{l:"Pending",v:data.taskPending,c:T.amber},{l:"Overdue",v:data.taskOverdue,c:T.rose}].map(x=>(
                    <div key={x.l} style={{marginBottom:8}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:12,color:T.slateL}}>{x.l}</span><span style={{fontSize:12,fontWeight:700,color:x.c}}>{x.v}</span></div>
                      <ProgressBar value={x.v} max={(data.taskPending+data.taskDone+data.taskOverdue)||1} color={x.c} height={5}/>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
            <Panel title="SLA by Section">
              {data.slaBreach.length===0?<EmptyState msg="No checklist data"/>:(
                <div style={{display:"flex",flexDirection:"column",gap:9}}>
                  {data.slaBreach.map(s=>(
                    <div key={s.dept}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:12,color:T.slateL}}>{s.dept}</span><span style={{fontSize:12,fontWeight:700,color:s.breaches>0?T.rose:T.emerald}}>{s.breaches}/{s.total}</span></div>
                      <ProgressBar value={s.breaches} max={s.total||1} color={s.breaches>0?T.rose:T.emerald} height={6}/>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
            <Panel title="⚡ Quick Actions">
              <div style={{display:"flex",flexDirection:"column",gap:7}}>
                {[{l:"➕ Add Student",c:T.sky},{l:"💰 Record Payment",c:T.gold},{l:"📋 New Admission",c:T.violet},{l:"✅ Mark Attendance",c:T.emerald},{l:"📤 Export Reports",c:T.amber},{l:"📧 Send Reminders",c:T.rose}].map(a=>(
                  <button key={a.l} style={{width:"100%",padding:"9px 13px",borderRadius:9,border:`1px solid ${a.c}22`,background:`${a.c}0a`,color:a.c,fontSize:12,fontWeight:700,cursor:"pointer",textAlign:"left",fontFamily:"inherit"}}>{a.l}</button>
                ))}
              </div>
            </Panel>
          </div>
        </section>
        </div>

        {/* ═══ BATCHES ════════════════════════════════════════════ */}
        <div ref={setSectionRef('batches')}>
        <section style={{marginBottom:40}}>
          <SectionHeader icon="🗂️" title="Batches & Timetable"/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:13,marginBottom:20}}>
            <KPI icon="🗂️" label="Total Batches" value={data.totalBatches} color={T.indigo}/>
            <KPI icon="✅" label="Active" value={data.activeBatches} color={T.emerald}/>
            <KPI icon="👥" label="Total Strength" value={data.totalStrength} color={T.sky} sub={`Capacity: ${data.totalCapacity}`}/>
            <KPI icon="📊" label="Fill Rate" value={data.batchFillRate} color={data.batchFillRate>=80?T.emerald:T.amber} sub={`${data.batchFillRate}% filled`}/>
          </div>
          {data.batchesData.length===0?(
            <Panel><EmptyState msg="No data in batches table yet. Add batch records to see class-wise analytics."/></Panel>
          ):(
            <Panel title="All Batches">
              <table style={{width:"100%",borderCollapse:"separate",borderSpacing:"0 5px"}}>
                <thead><tr>{["Batch","Course","Teacher","Fill","Status"].map(h=><th key={h} style={{textAlign:"left",fontSize:11,color:T.slate,fontWeight:600,padding:"5px 12px",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                <tbody>{data.batchesData.map((b,i)=>(
                  <tr key={i}>
                    <td style={{fontSize:12,fontWeight:700,color:T.white,padding:"9px 12px",background:"rgba(255,255,255,.03)",borderRadius:"10px 0 0 10px"}}>{b.name||"—"}</td>
                    <td style={{fontSize:12,color:T.slateL,padding:"9px 12px",background:"rgba(255,255,255,.03)"}}>{b.course||"—"}</td>
                    <td style={{fontSize:12,color:T.slateL,padding:"9px 12px",background:"rgba(255,255,255,.03)"}}>{b.teacher_name||"—"}</td>
                    <td style={{padding:"9px 12px",background:"rgba(255,255,255,.03)",minWidth:130}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <ProgressBar value={Number(b.strength)||0} max={Number(b.capacity)||1} color={T.sky} height={5}/>
                        <span style={{fontSize:11,color:T.white,whiteSpace:"nowrap"}}>{b.strength}/{b.capacity}</span>
                      </div>
                    </td>
                    <td style={{padding:"9px 12px",background:"rgba(255,255,255,.03)",borderRadius:"0 10px 10px 0"}}><Badge label={b.status||"Active"} color={statusColor(b.status||"Active")}/></td>
                  </tr>
                ))}</tbody>
              </table>
            </Panel>
          )}
        </section>
        </div>

        {/* ═══ TESTS ══════════════════════════════════════════════ */}
        <div ref={setSectionRef('tests')}>
        <section style={{marginBottom:40}}>
          <SectionHeader icon="📝" title="Test & Performance Analytics"/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:13,marginBottom:20}}>
            <KPI icon="📝" label="Exam Dates" value={data.totalTests} color={T.violet}/>
            <KPI icon="👥" label="Total Entries" value={data.totalTestEntries} color={T.sky}/>
            <KPI icon="📊" label="Avg Score" value={data.avgTestScore} color={T.emerald} sub={`${data.avgTestScore}% overall`}/>
            <KPI icon="📉" label="At Risk" value={data.atRiskStudents.length} color={T.rose} sub="Below 40%"/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16,marginBottom:16}}>
            <Panel title="Monthly Avg Score Trend" sub="From exam_marks.exam_date">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data.testTrend}>
                  <defs><linearGradient id="testGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.violet} stopOpacity={0.3}/><stop offset="95%" stopColor={T.violet} stopOpacity={0}/></linearGradient></defs>
                  <XAxis dataKey="month" tick={{fill:T.slateL,fontSize:11}} axisLine={false} tickLine={false}/>
                  <YAxis domain={[0,100]} hide/><Tooltip content={<Tip/>}/>
                  <ReferenceLine y={40} stroke={T.rose} strokeDasharray="4 3" label={{value:"Pass line",fill:T.rose,fontSize:10}}/>
                  <Area dataKey="avg" name="Avg Score" stroke={T.violet} strokeWidth={2.5} fill="url(#testGrad)"/>
                </AreaChart>
              </ResponsiveContainer>
            </Panel>
            <Panel title="By Class">
              <div style={{display:"flex",flexDirection:"column",gap:7}}>
                {data.batchScores.map(b=>(
                  <div key={b.batch}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:11,color:T.slateL}}>{b.batch}</span><span style={{fontSize:11,fontWeight:700,color:b.color}}>{b.avg}%</span></div>
                    <ProgressBar value={b.avg} max={100} color={b.color} height={5}/>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <Panel title="🏆 Top Performers">
              <div style={{display:"flex",flexDirection:"column",gap:7}}>
                {data.topPerformers.map((s,i)=>(
                  <div key={s.name+i} style={{padding:"10px 13px",borderRadius:11,background:i===0?`${T.gold}14`:"rgba(255,255,255,.03)",border:`1px solid ${i===0?T.gold+"33":"rgba(255,255,255,.05)"}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                      <span style={{fontSize:12,fontWeight:800,color:[T.gold,"#c0c0c0",T.amber,T.sky,T.sky,T.slateL,T.slateL,T.slateL][i]}}>#{i+1} {s.name}</span>
                      <span style={{fontSize:13,fontWeight:900,color:s.avg>=80?T.emerald:s.avg>=60?T.amber:T.rose}}>{s.avg}%</span>
                    </div>
                    <ProgressBar value={s.avg} max={100} color={s.avg>=80?T.emerald:s.avg>=60?T.amber:T.rose} height={4}/>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="⚠️ At-Risk Students" accent={T.rose}>
              {data.atRiskStudents.length===0?<div style={{color:T.emerald,fontSize:13,fontWeight:600,marginTop:8}}>✅ No at-risk students!</div>:(
                <div style={{display:"flex",flexDirection:"column",gap:7}}>
                  {data.atRiskStudents.slice(0,8).map((s,i)=>(
                    <div key={s.name+i} style={{padding:"9px 12px",borderRadius:10,background:`${T.rose}08`,border:`1px solid ${T.rose}18`}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                        <span style={{fontSize:12,fontWeight:700,color:T.white}}>{s.name}</span>
                        <span style={{fontSize:12,fontWeight:900,color:T.rose}}>{s.max>0?pct(s.total,s.max):0}%</span>
                      </div>
                      {s.batch&&<Badge label={s.batch} color={T.slateL}/>}
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
        <section style={{marginBottom:40}}>
          <SectionHeader icon="🔍" title="Enquiry & Lead Management"/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:13,marginBottom:20}}>
            <KPI icon="📞" label="Total" value={data.totalEnquiries} color={T.sky} sub="From admissions"/>
            <KPI icon="🔓" label="Open" value={data.openEnquiries} color={T.amber}/>
            <KPI icon="✅" label="Enrolled" value={data.convertedEnq} color={T.emerald}/>
            <KPI icon="📊" label="Conv. Rate" value={data.conversionRate} color={T.violet} sub={`${data.conversionRate}%`}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16,marginBottom:16}}>
            <Panel title="Monthly Applications vs Enrollments">
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={data.enqTrend}>
                  <XAxis dataKey="month" tick={{fill:T.slateL,fontSize:11}} axisLine={false} tickLine={false}/>
                  <YAxis hide/><Tooltip content={<Tip/>}/>
                  <Bar dataKey="enquiries" name="Applications" fill={T.sky} radius={[4,4,0,0]} barSize={18}/>
                  <Bar dataKey="converted" name="Enrolled" fill={T.emerald} radius={[4,4,0,0]} barSize={18}/>
                </ComposedChart>
              </ResponsiveContainer>
            </Panel>
            <Panel title="Course Interest">
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {data.enqByCourse.slice(0,7).map(c=>(
                  <div key={c.name}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:12,color:T.slateL}}>{c.name}</span><span style={{fontSize:12,fontWeight:700,color:c.color}}>{c.count}</span></div>
                    <ProgressBar value={c.count} max={data.enqByCourse[0]?.count||1} color={c.color} height={5}/>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
          <Panel title="Recent Applications">
            <table style={{width:"100%",borderCollapse:"separate",borderSpacing:"0 5px"}}>
              <thead><tr>{["Name","Course","Source","Status","Date"].map(h=><th key={h} style={{textAlign:"left",fontSize:11,color:T.slate,fontWeight:600,padding:"5px 12px",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
              <tbody>{data.recentEnquiries.map((e,i)=>(
                <tr key={i}>
                  <td style={{fontSize:12,fontWeight:700,color:T.white,padding:"9px 12px",background:"rgba(255,255,255,.03)",borderRadius:"10px 0 0 10px"}}>{e.name||"—"}</td>
                  <td style={{fontSize:12,color:T.slateL,padding:"9px 12px",background:"rgba(255,255,255,.03)"}}>{e.course_interest||"—"}</td>
                  <td style={{fontSize:12,color:T.slateL,padding:"9px 12px",background:"rgba(255,255,255,.03)"}}>{e.source||"—"}</td>
                  <td style={{padding:"9px 12px",background:"rgba(255,255,255,.03)"}}><Badge label={e.status||"—"} color={statusColor(e.status)}/></td>
                  <td style={{fontSize:12,color:T.slateL,padding:"9px 12px",background:"rgba(255,255,255,.03)",borderRadius:"0 10px 10px 0"}}>{e.follow_up_date||"—"}</td>
                </tr>
              ))}</tbody>
            </table>
          </Panel>
        </section>
        </div>

        {/* ═══ DOUBTS ═════════════════════════════════════════════ */}
        <div ref={setSectionRef('doubts')}>
        <section style={{marginBottom:40}}>
          <SectionHeader icon="💬" title="Doubt & Query Management"/>
          <Panel><EmptyState msg="No data in doubt_sessions table yet. Add records to track student doubts and resolution rates."/></Panel>
        </section>
        </div>

        {/* ═══ PARENTS ════════════════════════════════════════════ */}
        <div ref={setSectionRef('parents')}>
        <section style={{marginBottom:40}}>
          <SectionHeader icon="👨‍👩‍👧" title="Parent Communication"/>
          <Panel><EmptyState msg="No data in sms_logs table yet. SMS logs will appear here once messages are sent."/></Panel>
        </section>
        </div>

        {/* ═══ MATERIAL ═══════════════════════════════════════════ */}
        <div ref={setSectionRef('material')}>
        <section style={{marginBottom:40}}>
          <SectionHeader icon="📦" title="Study Material Management"/>
          <Panel><EmptyState msg="No data in study_material table yet. Add material distribution records to track study resources."/></Panel>
        </section>
        </div>

        {/* ═══ RESULTS ════════════════════════════════════════════ */}
        <div ref={setSectionRef('results')}>
        <section style={{marginBottom:40}}>
          <SectionHeader icon="🏅" title="Results & Selections"/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:13,marginBottom:20}}>
            <KPI icon="🏅" label="Total Selections" value={data.totalSelections} color={T.gold}/>
            <KPI icon="🏫" label="JNV Navodaya" value={data.jnvSelections} color={T.emerald}/>
            <KPI icon="⚔️" label="Sainik School" value={data.sainikSelections} color={T.sky}/>
            <KPI icon="🎓" label="Other Exams" value={data.otherSelections} color={T.violet}/>
          </div>
          {data.totalSelections===0?(
            <Panel><EmptyState msg="No data in selections table yet. Add student selection records to track exam achievements."/></Panel>
          ):(
            <Panel title="Recent Selections">
              <div style={{display:"flex",flexDirection:"column",gap:7}}>
                {data.recentSelections.map((s,i)=>(
                  <div key={i} style={{padding:"10px 12px",borderRadius:10,background:`${T.gold}08`,border:`1px solid ${T.gold}18`}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                      <span style={{fontSize:12,fontWeight:800,color:T.white}}>{s.student_name||"—"}</span>
                      {s.rank&&<span style={{fontSize:11,fontWeight:700,color:T.gold}}>Rank #{s.rank}</span>}
                    </div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      {s.exam_name&&<Badge label={s.exam_name} color={T.emerald}/>}
                      {s.year&&<Badge label={s.year} color={T.sky}/>}
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
        <section style={{marginBottom:40}}>
          <SectionHeader icon="🖊️" title="Staff Teaching Analytics"/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:13,marginBottom:20}}>
            <KPI icon="📚" label="Topics Total" value={data.totalTopics} color={T.sky}/>
            <KPI icon="✅" label="Covered" value={data.coveredTopics} color={T.emerald} progress={data.coveredTopics} progressMax={data.totalTopics}/>
            <KPI icon="📊" label="Coverage" value={data.overallCoverage} color={data.overallCoverage>=80?T.emerald:data.overallCoverage>=60?T.amber:T.rose} sub={`${data.overallCoverage}%`}/>
          </div>
          <Panel title="🔥 Teacher Accountability Tracker" sub="Streak · Missing days · Late submissions · Avg word count" style={{marginBottom:16}}>
            {(data.teacherStreaks||[]).length===0?<EmptyState msg="No teaching logs yet"/>:(
              <table style={{width:"100%",borderCollapse:"separate",borderSpacing:"0 5px"}}>
                <thead><tr>{["Teacher","Streak","Logs This Month","Missing Days","Late","Avg Words","Status"].map(h=><th key={h} style={{textAlign:"left",fontSize:11,color:T.slate,fontWeight:600,padding:"5px 12px",textTransform:"uppercase",letterSpacing:".06em"}}>{h}</th>)}</tr></thead>
                <tbody>{(data.teacherStreaks||[]).map((t,i)=>{
                  const status = t.missingDays===0&&t.lateCount===0?"Excellent":t.missingDays<=2&&t.lateCount<=1?"Good":t.missingDays<=5?"Warning":"At Risk"
                  const statusCol = {Excellent:T.emerald,Good:T.sky,Warning:T.amber,"At Risk":T.rose}[status]
                  return(
                    <tr key={t.name}>
                      <td style={{fontSize:12,fontWeight:700,color:T.white,padding:"10px 12px",background:"rgba(255,255,255,.03)",borderRadius:"10px 0 0 10px"}}>{t.name}</td>
                      <td style={{padding:"10px 12px",background:"rgba(255,255,255,.03)"}}><span style={{fontSize:14,fontWeight:900,color:t.streak>=7?T.emerald:t.streak>=3?T.amber:T.rose}}>🔥 {t.streak}d</span></td>
                      <td style={{fontSize:13,fontWeight:700,color:T.white,padding:"10px 12px",background:"rgba(255,255,255,.03)"}}>{t.totalLogs}</td>
                      <td style={{padding:"10px 12px",background:"rgba(255,255,255,.03)"}}><span style={{fontSize:13,fontWeight:700,color:t.missingDays===0?T.emerald:t.missingDays<=2?T.amber:T.rose}}>{t.missingDays}</span></td>
                      <td style={{padding:"10px 12px",background:"rgba(255,255,255,.03)"}}><span style={{fontSize:13,fontWeight:700,color:t.lateCount===0?T.emerald:t.lateCount<=2?T.amber:T.rose}}>{t.lateCount}</span></td>
                      <td style={{padding:"10px 12px",background:"rgba(255,255,255,.03)"}}><span style={{fontSize:13,fontWeight:700,color:t.avgWc>=100?T.emerald:t.avgWc>=50?T.amber:T.rose}}>{t.avgWc}</span></td>
                      <td style={{padding:"10px 12px",background:"rgba(255,255,255,.03)",borderRadius:"0 10px 10px 0"}}><Badge label={status} color={statusCol}/></td>
                    </tr>
                  )
                })}</tbody>
              </table>
            )}
          </Panel>
          {data.totalTopics===0?(
            <Panel><EmptyState msg="No data in monthly_syllabus table yet. Add syllabus coverage records to track teaching progress."/></Panel>
          ):(
            <Panel title="Teacher Coverage">
              <table style={{width:"100%",borderCollapse:"separate",borderSpacing:"0 5px"}}>
                <thead><tr>{["Teacher","Subjects","Covered","Coverage %","Status"].map(h=><th key={h} style={{textAlign:"left",fontSize:11,color:T.slate,fontWeight:600,padding:"5px 12px",textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                <tbody>{data.teacherCoverage.map((t,i)=>(
                  <tr key={t.name}>
                    <td style={{fontSize:12,fontWeight:700,color:T.white,padding:"10px 12px",background:"rgba(255,255,255,.03)",borderRadius:"10px 0 0 10px"}}>{t.name}</td>
                    <td style={{fontSize:12,color:T.slateL,padding:"10px 12px",background:"rgba(255,255,255,.03)"}}>{t.subjects}</td>
                    <td style={{fontSize:12,color:T.white,padding:"10px 12px",background:"rgba(255,255,255,.03)"}}>{t.covered}/{t.total}</td>
                    <td style={{padding:"10px 12px",background:"rgba(255,255,255,.03)",minWidth:140}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{flex:1}}><ProgressBar value={t.pct} max={100} color={t.pct>=80?T.emerald:t.pct>=60?T.amber:T.rose} height={6}/></div>
                        <span style={{fontSize:12,fontWeight:800,color:t.pct>=80?T.emerald:t.pct>=60?T.amber:T.rose}}>{t.pct}%</span>
                      </div>
                    </td>
                    <td style={{padding:"10px 12px",background:"rgba(255,255,255,.03)",borderRadius:"0 10px 10px 0"}}>
                      <Badge label={t.pct>=80?"On Track":t.pct>=60?"Behind":"At Risk"} color={t.pct>=80?T.emerald:t.pct>=60?T.amber:T.rose}/>
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
        <section style={{marginBottom:40}}>
          <SectionHeader icon="📉" title="Expenses & P&L"/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:13,marginBottom:20}}>
            <KPI icon="💰" label="Total Income" value={data.totalFeeCollected} isMoney color={T.emerald}/>
            <KPI icon="📉" label="Total Expenses" value={data.totalExpenses} isMoney color={T.rose}/>
            <KPI icon="📊" label="Net P&L" value={data.netPL} isMoney color={data.netPL>=0?T.emerald:T.rose} sub={data.netPL>=0?"Profitable":"Loss"}/>
            <KPI icon="💼" label="Salary Bill" value={data.totalSalaryBill} isMoney color={T.amber}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16,marginBottom:16}}>
            <Panel title="Monthly Income vs Expense vs P&L" sub="Income from accounts (type=Income), Expense from accounts (type=Expense)">
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={data.plTrend}>
                  <XAxis dataKey="month" tick={{fill:T.slateL,fontSize:11}} axisLine={false} tickLine={false}/>
                  <YAxis hide/><Tooltip content={<Tip/>}/>
                  <Bar dataKey="income" name="Income" fill={T.emerald} radius={[4,4,0,0]} barSize={14}/>
                  <Bar dataKey="expense" name="Expense" fill={T.rose} radius={[4,4,0,0]} barSize={14}/>
                  <Line dataKey="pl" name="Net P&L" stroke={T.gold} strokeWidth={2.5} dot={{fill:T.gold,r:3}}/>
                </ComposedChart>
              </ResponsiveContainer>
            </Panel>
            <Panel title="Expense by Category">
              {data.expenseByCategory.length===0?<EmptyState msg="No Expense rows in accounts table yet"/>:(
                <>
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart><Pie data={data.expenseByCategory} dataKey="amount" cx="50%" cy="50%" innerRadius={38} outerRadius={58} paddingAngle={4}>
                      {data.expenseByCategory.map((p,i)=><Cell key={i} fill={p.color}/>)}
                    </Pie><Tooltip content={<Tip/>}/></PieChart>
                  </ResponsiveContainer>
                  <div style={{display:"flex",flexDirection:"column",gap:5,marginTop:8}}>
                    {data.expenseByCategory.slice(0,5).map(c=>(
                      <div key={c.name} style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:7,height:7,borderRadius:2,background:c.color}}/><span style={{fontSize:11,color:T.slateL}}>{c.name}</span></div>
                        <span style={{fontSize:11,fontWeight:700,color:c.color}}>{fmt(c.amount)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Panel>
          </div>
          <Panel title="P&L Summary" accent={data.netPL>=0?T.emerald:T.rose}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:20,textAlign:"center"}}>
              {[
                {label:"Total Income",value:data.totalFeeCollected,color:T.emerald,icon:"💰"},
                {label:"Total Expenses",value:data.totalExpenses,color:T.rose,icon:"📉"},
                {label:"Net Profit / Loss",value:data.netPL,color:data.netPL>=0?T.emerald:T.rose,icon:data.netPL>=0?"📈":"📉"},
              ].map(x=>(
                <div key={x.label} style={{padding:"16px",borderRadius:12,background:`${x.color}08`,border:`1px solid ${x.color}18`}}>
                  <div style={{fontSize:22,marginBottom:6}}>{x.icon}</div>
                  <div style={{fontSize:22,fontWeight:900,color:x.color,marginBottom:4}}>{fmt(x.value)}</div>
                  <div style={{fontSize:12,color:T.slateL}}>{x.label}</div>
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