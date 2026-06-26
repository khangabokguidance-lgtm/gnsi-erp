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

// ─── LIGHT THEME TOKENS ──────────────────────────────────────────────────────
const T = {
  bg:       "#f4f6fb",
  bgCard:   "#ffffff",
  bgCardAlt:"#f8fafd",
  bgInset:  "#f0f3f8",
  border:   "rgba(0,0,0,.07)",
  borderMd: "rgba(0,0,0,.11)",
  ink:      "#0f172a",
  inkMid:   "#334155",
  inkSub:   "#64748b",
  gold:     "#c89b3c",
  goldLt:   "#f0c96a",
  emerald:  "#059669",
  rose:     "#e11d48",
  sky:      "#0284c7",
  violet:   "#7c3aed",
  amber:    "#d97706",
  teal:     "#0d9488",
  pink:     "#db2777",
  indigo:   "#4f46e5",
  orange:   "#ea580c",
  lime:     "#65a30d",
  slate:    "#64748b",
  slateL:   "#94a3b8",
  navy:     "#f4f6fb",
  navyLt:   "#eef1f8",
  navyCard: "#ffffff",
  white:    "#0f172a",
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
  Overdue:T.rose, Partial:T.amber, Pending:T.slate, Done:T.emerald, Active:T.emerald,
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

// FIX: Supabase/PostgREST caps a plain .select() at 1000 rows. Page through with
// .range() so tables like adm_flat_fees / adm_course_fees aren't silently truncated
// for a multi-year institute. Mirrors the pagination pattern already used in Accounts.jsx.
async function fetchAllRows(table, selectCols, orderCol = "created_at") {
  const PAGE_SIZE = 1000
  let all = [], from = 0
  try {
    while (true) {
      const { data, error } = await supabase.from(table).select(selectCols)
        .order(orderCol, { ascending: false })
        .range(from, from + PAGE_SIZE - 1)
      if (error) { console.warn(`Supabase pagination warning (${table}):`, error.message); break }
      all = all.concat(data || [])
      if (!data || data.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  } catch (e) {
    console.warn(`Supabase pagination failed (${table}):`, e.message)
  }
  return all
}

// ─── REUSABLE UI COMPONENTS ──────────────────────────────────────────────────

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
    <div style={{background:"rgba(0,0,0,.07)",borderRadius:99,height,overflow:"hidden"}}>
      <div style={{height:"100%",width:`${w}%`,borderRadius:99,background:`linear-gradient(90deg,${color}99,${color})`,transition:"width 1.2s cubic-bezier(.4,0,.2,1)"}}/>
    </div>
  )
}

function Panel({ children, style={}, accent, title, sub }) {
  return (
    <div style={{
      background:T.bgCard,
      border:`1px solid ${accent ? accent+"28" : T.border}`,
      borderRadius:14,
      padding:"18px 20px",
      boxShadow:"0 1px 4px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.04)",
      ...style
    }}>
      {title && (
        <div style={{marginBottom:14}}>
          <div style={{fontSize:13,fontWeight:800,color:T.ink}}>{title}</div>
          {sub && <div style={{fontSize:11,color:T.inkSub,marginTop:2}}>{sub}</div>}
        </div>
      )}
      {children}
    </div>
  )
}

function Badge({ label, color }) {
  return (
    <span style={{
      fontSize:10,fontWeight:700,color,textTransform:"uppercase",letterSpacing:".07em",
      background:`${color}15`,padding:"2px 7px",borderRadius:5,
      border:`1px solid ${color}25`
    }}>{label}</span>
  )
}

function Tip({ active, payload, label }) {
  if (!active||!payload?.length) return null
  return (
    <div style={{
      background:T.bgCard,
      border:`1px solid ${T.borderMd}`,
      borderRadius:10,padding:"10px 14px",fontSize:12,
      boxShadow:"0 4px 16px rgba(0,0,0,.12)"
    }}>
      <div style={{color:T.inkSub,marginBottom:4}}>{label}</div>
      {payload.map((p,i)=>(<div key={i} style={{color:p.color,fontWeight:700}}>{p.name}: {p.value>999?fmt(p.value):p.value}</div>))}
    </div>
  )
}

function KPI({ icon, label, value, sub, color, progress, progressMax, isMoney, trend }) {
  return (
    <div style={{
      background:T.bgCard,
      border:`1px solid ${color}20`,
      borderRadius:14,padding:"16px 18px",
      display:"flex",flexDirection:"column",gap:7,
      position:"relative",overflow:"hidden",
      boxShadow:"0 1px 3px rgba(0,0,0,.05), 0 4px 16px rgba(0,0,0,.04)"
    }}>
      <div style={{position:"absolute",top:-16,right:-16,width:70,height:70,borderRadius:"50%",background:`${color}10`,filter:"blur(16px)"}}/>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontSize:20}}>{icon}</span>
        <Badge label={label} color={color}/>
      </div>
      <div style={{fontSize:24,fontWeight:900,color:T.ink,letterSpacing:"-.02em",lineHeight:1}}>
        {isMoney ? fmt(value) : <Counter value={value}/>}
      </div>
      {sub && <div style={{fontSize:11,color:T.inkSub}}>{sub}</div>}
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
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(0,0,0,.08)" strokeWidth={8} strokeDasharray={`${arc} ${circumference-arc}`} strokeDashoffset={-circumference*0.125} strokeLinecap="round"/>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={8} strokeDasharray={`${filled} ${circumference-filled}`} strokeDashoffset={-circumference*0.125} strokeLinecap="round"/>
      <text x={cx} y={cy+6} textAnchor="middle" fill={T.ink} fontSize={15} fontWeight={900}>{Math.round(value)}%</text>
    </svg>
  )
}

function Skeleton({ h=20, w="100%", r=8 }) {
  return <div style={{height:h,width:w,borderRadius:r,background:"rgba(0,0,0,.06)",animation:"shimmer 1.5s infinite"}}/>
}

function EmptyState({ msg }) {
  return <div style={{color:T.inkSub,fontSize:12,padding:"12px 0",textAlign:"center"}}>{msg}</div>
}

function SectionHeader({ icon, title }) {
  return (
    <h2 style={{fontSize:19,fontWeight:900,margin:"0 0 18px",color:T.ink,display:"flex",alignItems:"center",gap:8}}>
      <span style={{fontSize:20}}>{icon}</span> {title}
    </h2>
  )
}

function TableWrap({ children }) {
  return <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>{children}</div>
}

// ─── DATA LOADING ─────────────────────────────────────────────────────────────
async function loadAllData() {
  const today = todayStr(), nowD = new Date()

  // FIX #4: removed duplicate teaching_logs fetch (was last item in Promise.all)
  // FIX: removed expensesData (was a second, 200-row-capped query against the SAME
  // accounts table already covered by accountsRes/accountsExpense — it was being
  // summed alongside accountsExpense and silently doubling totalExpenses & plTrend).
  const [
    studentsCountRes, studentsRes, admissionsRes, recentAdmRes,
    accountsRes, recentFeeRes, staffRes, staffTasksRes, staffScoresRes,
    attendanceTodayRes, attendanceAllRes, housesRawRes, defaultersRes,
    hostelRoomsData, hostelIncidentsData, messData, housePointsData,
    clubsData, leavesData, recruitmentData, examMarksData, sportsData,
    serviceHoursData, achievementsData, waiverData, scholarshipData,
    batchesData, timetableData, enquiriesData, doubtSessionsData,
    smsLogsData, studyMaterialData, selectionsData, syllabusCoverageData,
    teachingLogsRaw,
    feeStructuresData, feeOverridesData, admFlatFeesData, admCourseFeesData,
    entranceExamsData, entranceCandidatesData, entranceResultsData,
    studyLockersData, lockerMaterialsData, socialCampaignsData,
    socialLeadsData, socialPostsData, connectBroadcastsData,
    connectGrievancesData, connectRepliesData, qbankData, syllabusTopicsData,
  ] = await Promise.all([
    supabase.from("students").select("*", {count:"exact", head:true}),
supabase.from("students").select("gender, state, date_of_birth, created_at, hostel_type, course, batch"),
supabase.from("adm_applications").select("gcc_no,applicant_name,status,course,hostel_type,batch,created_at,referral_source,category,gender"),
supabase.from("adm_applications").select("gcc_no,applicant_name,batch,status,created_at").order("created_at",{ascending:false}).limit(6),
    // FIX: exclude soft-deleted rows so dashboard totals match Accounts.jsx exactly
    supabase.from("accounts").select("amount,category,entry_date,type,payment_mode,note").eq("is_soft_deleted",false),
    supabase.from("adm_fee_collections").select("amount_paid,fee_type,adm_app_id,student_name,pay_date,pay_mode,description").order("pay_date",{ascending:false}).limit(6),
    safeFetch(()=>supabase.from("staff_profiles").select("id,name,department,status,designation")),
    safeFetch(()=>supabase.from("management_checklist").select("id,status,priority,section,task,assigned_to,created_at")),
    safeFetch(()=>supabase.from("staff_monthly_scores").select("staff_id,month,total_score,level").order("month",{ascending:false}).limit(50)),
    safeFetch(()=>supabase.from("attendance_logs").select("status,date").eq("date",today)),
safeFetch(()=>supabase.from("attendance_logs").select("status,date").order("date",{ascending:false}).limit(1500)),
    supabase.from("houses").select("*"),
    safeFetch(()=>supabase.from("fee_invoices").select("gcc_no,student_name,course,amount_due,status,invoice_month").in("status",["Overdue","Pending","Partial"]).gt("amount_due",0).order("amount_due",{ascending:false}).limit(5)),
    safeFetch(()=>supabase.from("hostel_rooms").select("block,total_beds,occupied_beds")),
    safeFetch(()=>supabase.from("hostel_incidents").select("incident_date,type,severity")),
    safeFetch(()=>supabase.from("mess_consumption").select("meal_date,breakfast,lunch,dinner")),
    safeFetch(()=>supabase.from("house_points").select("house_name,academic,sports,cultural,discipline")),
    safeFetch(()=>supabase.from("clubs").select("name,member_count")),
    safeFetch(()=>supabase.from("leave_requests").select("leave_type,staff_id,start_date")),
    safeFetch(()=>supabase.from("staff_recruitment").select("stage,candidate_name,applied_date")),
    safeFetch(()=>supabase.from("student_scores").select("student_id,student_name,subject_name,score,max_score,test_date").order("test_date",{ascending:false}).limit(500)),
    safeFetch(()=>supabase.from("sports_participation").select("sport,student_count")),
    safeFetch(()=>supabase.from("house_service_hours").select("house_name,hours")),
    safeFetch(()=>supabase.from("achievements").select("title,house_name,achieved_date")),
    safeFetch(()=>supabase.from("fee_waivers").select("category,total_amount,student_count")),
    safeFetch(()=>supabase.from("scholarships").select("name,awarded_count,total_amount")),
    safeFetch(()=>supabase.from("course_batches").select("id,batch_name,course,subtype,class_name,hostel_type,session_year")),
safeFetch(()=>supabase.from("timetable_entries").select("id,class_name,subject_name,teacher_name,day_name,period_name")),
    safeFetch(()=>supabase.from("enquiries").select("id,name,phone,course_interest,source,status,follow_up_date,created_at,converted")),
    safeFetch(()=>supabase.from("doubt_sessions").select("id,student_name,batch_name,subject,topic,raised_date,resolved_date,staff_name,status")),
    safeFetch(()=>supabase.from("sms_logs").select("id,recipient_type,message_type,sent_at,status,count")),
    safeFetch(()=>supabase.from("study_material").select("id,title,subject,batch_name,material_type,distributed_date,total_copies,distributed_copies")),
    safeFetch(()=>supabase.from("selections").select("id,student_name,exam_name,rank,year,batch_name,category,school_allotted")),
    safeFetch(()=>supabase.from("monthly_syllabus").select("teacher_name,subject,batch_name,total_topics,covered_topics,month")),
    // FIX #4: single fetch with all needed columns (removed duplicate)
    safeFetch(()=>supabase.from("teaching_logs").select("teacher_name,teaching_date,late_submission,submitted_at,topic_taught,classwork,remarks,technique_detail,key_concepts")),
    safeFetch(()=>supabase.from("fee_structures").select("session_year,course,batch,hostel_type,flat_fee,course_fee,admission_fee")),
    safeFetch(()=>supabase.from("student_fee_overrides").select("gcc_no,flat_fee_override,reason,created_at")),
    // FIX: removed .limit(200) — was silently dropping older flat/course fee records
    // for a 10-year-old institute; now pages through the full table via fetchAllRows.
    fetchAllRows("adm_flat_fees","adm_app_id,amount,status,month,year"),
    fetchAllRows("adm_course_fees","adm_app_id,amount_paid,status,for_month,year"),
    safeFetch(()=>supabase.from("entrance_exams").select("id,exam_type,exam_date,status,total_seats,venue").order("exam_date",{ascending:false})),
    safeFetch(()=>supabase.from("entrance_candidates").select("id,exam_id,status,roll_number").order("created_at",{ascending:false})),
    safeFetch(()=>supabase.from("entrance_results").select("id,exam_id,total_marks,marks_obtained,result_status").order("created_at",{ascending:false})),
    safeFetch(()=>supabase.from("study_lockers").select("id,teacher_name,course,locker_name,created_at")),
    safeFetch(()=>supabase.from("study_materials").select("id,locker_id,material_type,subject,created_at").order("created_at",{ascending:false}).limit(200)),
    safeFetch(()=>supabase.from("social_campaigns").select("id,campaign_name,platform,status,budget,start_date,end_date")),
    safeFetch(()=>supabase.from("social_leads").select("id,status,source,follow_up_date,created_at").order("created_at",{ascending:false})),
    safeFetch(()=>supabase.from("social_posts").select("id,platform,status,post_date,content_type").order("post_date",{ascending:false})),
    safeFetch(()=>supabase.from("connect_broadcasts").select("id,title,channel,status,priority,created_at,recipient_count").order("created_at",{ascending:false}).limit(100)),
    safeFetch(()=>supabase.from("connect_grievances").select("id,status,created_at").order("created_at",{ascending:false})),
    safeFetch(()=>supabase.from("connect_replies").select("id,is_read,created_at").order("created_at",{ascending:false}).limit(100)),
    safeFetch(()=>supabase.from("qbank_questions").select("id,course,subject,difficulty,question_type,created_at").order("created_at",{ascending:false})),
    safeFetch(()=>supabase.from("syllabus_topics").select("id,subject_name,course,completed,completed_at,chapter_name,expected_date,display_order").order("display_order",{ascending:true})),
  ])

  // ── Finance ──
  const allIncome = (accountsRes.data || []).filter(r => r.type === "Income")
  // FIX #5: also track expense rows in accounts table so P&L is accurate
  const accountsExpense = (accountsRes.data || []).filter(r => r.type === "Expense")
  const totalFeeCollected = allIncome.reduce((s,r)=>s+(Number(r.amount)||0),0)
  const admFeeTotal    = allIncome.filter(r=>r.category==="Admission").reduce((s,r)=>s+(Number(r.amount)||0),0)
  // FIX: flatFeeTotal/courseFeeTotal now derive from the SAME accounts rows as admFeeTotal
  // (matching the categories FeeCollectionModal's upsertAccount() writes: 'Hostel' for flat
  // fees, 'Fees' for course fees) instead of separately summing adm_flat_fees/adm_course_fees.
  // This breakdown previously came from a different source than totalFeeCollected, so
  // Admission + Flat + Course never reconciled with "Total Income" shown elsewhere on this
  // dashboard or in Accounts.jsx. It now does, by construction.
  const flatFeeTotal   = allIncome.filter(r=>r.category==="Hostel").reduce((s,r)=>s+(Number(r.amount)||0),0)
  const courseFeeTotal = allIncome.filter(r=>r.category==="Fees").reduce((s,r)=>s+(Number(r.amount)||0),0)
  const feePending = 0 // fee_invoices not in use — pending calc requires fee structure setup
  const monthlyFees = ACADEMIC_MONTHS.map(m=>({month:m.label,collected:allIncome.filter(r=>r.entry_date?.startsWith(m.key)).reduce((s,r)=>s+(Number(r.amount)||0),0),target:500000}))
  const feeAging=[{bucket:"0-30 days",amount:0,count:0,color:T.amber},{bucket:"31-60 days",amount:0,count:0,color:T.orange},{bucket:"60+ days",amount:0,count:0,color:T.rose}]
  ;(defaultersRes.data||[]).forEach(d=>{if(!d.invoice_month)return;const diff=Math.floor((nowD-new Date(d.invoice_month+"-01"))/86400000);const idx=diff<=30?0:diff<=60?1:2;feeAging[idx].amount+=Number(d.amount_due)||0;feeAging[idx].count++})
  const feeWaivers=(waiverData||[]).map((w,i)=>({category:w.category,amount:Number(w.total_amount)||0,students:Number(w.student_count)||0,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const totalWaivers=feeWaivers.reduce((s,w)=>s+w.amount,0)
  const recentFeeActivity=recentFeeRes.data||[]

  // ── Admissions ──
  const allAdm=admissionsRes.data||[]
  const admApplied=allAdm.filter(a=>a.status==="Applied").length
  const admUnderReview=allAdm.filter(a=>a.status==="Under Review").length
  const admAdmitted=allAdm.filter(a=>a.status==="Admitted").length
  const admEnrolled=allAdm.filter(a=>a.status==="Enrolled").length
  const admRejected=allAdm.filter(a=>a.status==="Rejected").length
  const admWaitlisted=allAdm.filter(a=>a.status==="Waitlisted").length
  const sourceCounts={}
  allAdm.forEach(a=>{const s=a.referral_source||"Unknown";sourceCounts[s]=(sourceCounts[s]||0)+1})
  const applicationSource=Object.entries(sourceCounts).map(([name,value],i)=>({name,value,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const batchCounts={}
  allAdm.forEach(a=>{if(a.batch)batchCounts[a.batch]=(batchCounts[a.batch]||0)+1})
  const yoyAdmissions=Object.entries(batchCounts).sort((a,b)=>a[0].localeCompare(b[0])).map(([year,count])=>({year,count}))

  // FIX #2: admissionFunnel — each stage is its own exact status count, not cumulative
  const admissionFunnel=[
    {stage:"Applied",     count:admApplied,      color:T.sky},
    {stage:"Under Review",count:admUnderReview,  color:T.violet},
    {stage:"Admitted",    count:admAdmitted,      color:T.amber},
    {stage:"Enrolled",    count:admEnrolled,      color:T.emerald},
  ]

  // FIX #3: enquiryFunnel — removed hardcoded ×0.85 estimate; use real counts only
  const enquiryFunnel=[
    {stage:"Total Applications", count:allAdm.length,                                       color:T.sky},
    {stage:"Under Review",       count:admUnderReview+admAdmitted+admEnrolled,              color:T.violet},
    {stage:"Admitted",           count:admAdmitted+admEnrolled,                             color:T.amber},
    {stage:"Enrolled",           count:admEnrolled,                                          color:T.emerald},
  ]

  // ── Students ──
  const allStudents=studentsRes.data||[]
  const totalStudentsCount = studentsCountRes.count || allStudents.length
  const maleStudents=allStudents.filter(s=>s.gender==="Male"||s.gender==="male").length
  const femaleStudents=allStudents.filter(s=>s.gender==="Female"||s.gender==="female").length
  const boarders=allStudents.filter(s=>s.hostel_type==="Boarder").length
  const dayBoarders=allStudents.filter(s=>s.hostel_type==="Day Boarder").length
  const dayScholars=allStudents.filter(s=>s.hostel_type==="Day Scholar").length
  const courseCounts={}
  allStudents.forEach(a=>{if(a.course)courseCounts[a.course]=(courseCounts[a.course]||0)+1})
  const courseBreakdown=Object.entries(courseCounts).sort((a,b)=>b[1]-a[1]).map(([name,students],i)=>({name,students,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const stateCounts={}
  allStudents.forEach(s=>{if(s.state)stateCounts[s.state]=(stateCounts[s.state]||0)+1})
  const stateData=Object.entries(stateCounts).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([state,count])=>({state,count}))
  const ageData={}
  allStudents.forEach(s=>{if(!s.date_of_birth)return;const age=Math.floor((nowD-new Date(s.date_of_birth))/31536000000);const bucket=age<16?"14-15":age<18?"16-17":age<20?"18-19":age<22?"20-21":age<24?"22-23":"24+";ageData[bucket]=(ageData[bucket]||0)+1})
  const ageDistribution=["14-15","16-17","18-19","20-21","22-23","24+"].map(age=>({age,count:ageData[age]||0}))

  // ── Staff ──
  const allStaff=staffRes||[]
  const totalStaff=allStaff.length
  const activeStaffCnt=allStaff.filter(s=>s.status==="Active").length
  const totalSalaryBill=0
  const allTasks=staffTasksRes||[]
  const taskPending=allTasks.filter(t=>t.status==="Pending").length
  const taskDone=allTasks.filter(t=>t.status==="Done").length
  // FIX #6: taskOverdue — compare against start of today, not right now
  const startOfToday = new Date(today)
  const taskOverdue=allTasks.filter(t=>t.status==="Pending"&&t.created_at&&new Date(t.created_at)<startOfToday).length
  const taskDeptMap={}
  allTasks.forEach(t=>{const d=(t.section||"Other").slice(0,8);if(!taskDeptMap[d])taskDeptMap[d]={dept:d,pending:0,done:0,overdue:0};if(t.status==="Done")taskDeptMap[d].done++;else taskDeptMap[d].pending++})
  const taskByDept=Object.values(taskDeptMap).slice(0,6)
  const slaMap={}
  allTasks.forEach(t=>{const d=(t.section||"Other").slice(0,8);if(!slaMap[d])slaMap[d]={dept:d,breaches:0,total:0};slaMap[d].total++;if(t.status==="Pending")slaMap[d].breaches++})
  const slaBreach=Object.values(slaMap).slice(0,5).map(s=>({...s,color:s.breaches>0?T.rose:T.emerald}))
  const allScores=staffScoresRes||[]
  const latestMonth=allScores[0]?.month||null
  const topStaff=[],staffRadar=[],leaveBreakdown=[],recruitmentFunnel=[],trainingHours=[]
  // FIX — salaryTrend: removed Math.random() fake variation; flat real bill per month
  const salaryTrend=ACADEMIC_MONTHS.slice(0,9).map(m=>({month:m.label,bill:totalSalaryBill}))

  // ── Attendance ──
  const todayAtt=attendanceTodayRes||[]
  const presentToday=todayAtt.filter(a=>a.status==="Present").length
  const absentToday=todayAtt.filter(a=>a.status==="Absent").length
  const lateToday=todayAtt.filter(a=>a.status==="Late").length
  const totalToday=todayAtt.length
  const weekMap={}
  ;(attendanceAllRes||[]).forEach(a=>{if(!weekMap[a.date])weekMap[a.date]={present:0,absent:0,late:0};if(a.status==="Present")weekMap[a.date].present++;else if(a.status==="Late")weekMap[a.date].late++;else weekMap[a.date].absent++})
  const attendanceWeek=Object.entries(weekMap).sort((a,b)=>a[0].localeCompare(b[0])).slice(-7).map(([date,c])=>({day:new Date(date).toLocaleDateString("en-IN",{weekday:"short"}),...c}))
  const monthlyAttTrend=ACADEMIC_MONTHS.map(m=>{const entries=(attendanceAllRes||[]).filter(a=>a.date?.startsWith(m.key));const total=entries.length;const present=entries.filter(a=>a.status==="Present").length;return{month:m.label,rate:total>0?pct(present,total):0}})

  // ── Academic ──
  const subjectMap={}
  examMarksData.forEach(e=>{if(!e.subject_name)return;if(!subjectMap[e.subject_name])subjectMap[e.subject_name]={total:0,max:0,pass:0,count:0};const pctScore=pct(Number(e.score),Number(e.max_score));subjectMap[e.subject_name].total+=Number(e.score)||0;subjectMap[e.subject_name].max+=Number(e.max_score)||0;subjectMap[e.subject_name].count++;if(pctScore>=40)subjectMap[e.subject_name].pass++})
  const subjectScores=Object.entries(subjectMap).map(([subject,v])=>({subject:subject.slice(0,10),avg:v.max>0?Math.round(v.total/v.max*100):0,pass:v.count>0?pct(v.pass,v.count):0}))
  const gradeMap={"A+":0,"A":0,"B+":0,"B":0,"C":0,"D":0}
  examMarksData.forEach(e=>{const p=pct(Number(e.score),Number(e.max_score));if(p>=95)gradeMap["A+"]++;else if(p>=80)gradeMap["A"]++;else if(p>=65)gradeMap["B+"]++;else if(p>=50)gradeMap["B"]++;else if(p>=35)gradeMap["C"]++;else gradeMap["D"]++})
  const gradeCols=[T.emerald,T.sky,T.violet,T.amber,T.orange,T.rose]
  const gradeDistribution=Object.entries(gradeMap).map(([grade,count],i)=>({grade,count,color:gradeCols[i]}))
  const avgScore_all=examMarksData.length>0?pct(examMarksData.reduce((s,e)=>s+(Number(e.score)||0),0),examMarksData.reduce((s,e)=>s+(Number(e.max_score)||0),0)):0
  const passCount=examMarksData.filter(e=>pct(Number(e.score),Number(e.max_score))>=40).length
  const passRate=examMarksData.length>0?pct(passCount,examMarksData.length):0
  const aPlusCount=gradeMap["A+"]
  const atRisk=gradeMap["D"]

  // ── Tests ──
  const totalTests=[...new Set(examMarksData.map(t=>t.test_date))].length
  const totalTestEntries=examMarksData.length
  const avgTestScore=avgScore_all
  const testTypeMap={}
  examMarksData.forEach(t=>{const tp=t.gcc_no||"Unknown";testTypeMap[tp]=(testTypeMap[tp]||0)+1})
  const testByType=Object.entries(testTypeMap).map(([name,count],i)=>({name,count,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const studentScoreMap={}
  examMarksData.forEach(t=>{const id=t.student_id;if(!studentScoreMap[id])studentScoreMap[id]={name:t.student_name||String(id),batch:"Unknown",total:0,max:0,count:0};studentScoreMap[id].total+=Number(t.score)||0;studentScoreMap[id].max+=Number(t.max_score)||0;studentScoreMap[id].count++})
  const topPerformers=Object.values(studentScoreMap).map(s=>({...s,avg:s.max>0?pct(s.total,s.max):0})).sort((a,b)=>b.avg-a.avg).slice(0,8)
  const atRiskStudents=Object.values(studentScoreMap).filter(s=>s.max>0&&pct(s.total,s.max)<40)
  const testSubjectScores=subjectScores.map((s,i)=>({...s,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const batchScoreMap={}
  examMarksData.forEach(t=>{const b=t.gcc_no||"Unknown";if(!batchScoreMap[b])batchScoreMap[b]={total:0,max:0};batchScoreMap[b].total+=Number(t.score)||0;batchScoreMap[b].max+=Number(t.max_score)||0})
  const batchScores=Object.entries(batchScoreMap).map(([batch,v],i)=>({batch:batch.slice(0,10),avg:v.max>0?pct(v.total,v.max):0,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const testMonthMap={}
  examMarksData.forEach(t=>{const mo=t.test_date?.slice(0,7);if(!mo)return;if(!testMonthMap[mo])testMonthMap[mo]={total:0,max:0};testMonthMap[mo].total+=Number(t.score)||0;testMonthMap[mo].max+=Number(t.max_score)||0})
  const testTrend=ACADEMIC_MONTHS.map(m=>({month:m.label,avg:testMonthMap[m.key]?.max>0?pct(testMonthMap[m.key].total,testMonthMap[m.key].max):0}))

  // ── Hostel ──
  const hostelRooms=hostelRoomsData.map((r,i)=>({block:r.block||`Block ${String.fromCharCode(65+i)}`,total:Number(r.total_beds)||0,occupied:Number(r.occupied_beds)||0,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const hostelTotalRooms=hostelRooms.reduce((s,r)=>s+r.total,0)
  const hostelOccupied=hostelRooms.reduce((s,r)=>s+r.occupied,0)
  const hostelVacant=hostelTotalRooms-hostelOccupied
  const messMonthMap={}
  messData.forEach(m=>{const mo=m.meal_date?.slice(0,7);if(!mo)return;if(!messMonthMap[mo])messMonthMap[mo]={breakfast:0,lunch:0,dinner:0};messMonthMap[mo].breakfast+=Number(m.breakfast)||0;messMonthMap[mo].lunch+=Number(m.lunch)||0;messMonthMap[mo].dinner+=Number(m.dinner)||0})
  const messChartData=ACADEMIC_MONTHS.slice(0,8).map(m=>({month:m.label,...(messMonthMap[m.key]||{breakfast:0,lunch:0,dinner:0})}))
  const incidentMonthMap={}
  hostelIncidentsData.forEach(inc=>{const mo=inc.incident_date?.slice(0,7);if(!mo)return;incidentMonthMap[mo]=(incidentMonthMap[mo]||0)+1})
  const hostelIncidentChart=ACADEMIC_MONTHS.slice(0,8).map(m=>({month:m.label,count:incidentMonthMap[m.key]||0}))

  // ── Houses ──
  const rawHouses=housesRawRes.data||[]
  const houseNames=rawHouses.length>0?rawHouses.map(h=>h.name||h.house_name):(housePointsData.length>0?[...new Set(housePointsData.map(h=>h.house_name))]:["Phoenix","Falcon","Eagle","Titan"])
  const houseAggMap={}
  housePointsData.forEach(h=>{const name=h.house_name;if(!houseAggMap[name])houseAggMap[name]={name,academic:0,sports:0,cultural:0,discipline:0};houseAggMap[name].academic+=Number(h.academic)||0;houseAggMap[name].sports+=Number(h.sports)||0;houseAggMap[name].cultural+=Number(h.cultural)||0;houseAggMap[name].discipline+=Number(h.discipline)||0})
  const housePoints=houseNames.map((name,i)=>{const agg=houseAggMap[name]||{academic:0,sports:0,cultural:0,discipline:0};const total=agg.academic+agg.sports+agg.cultural+agg.discipline;return{...agg,name,points:total,color:HOUSE_COLORS[i%HOUSE_COLORS.length]}}).sort((a,b)=>b.points-a.points)
  const serviceHours=serviceHoursData.length>0?serviceHoursData.map((h,i)=>({house:h.house_name,hours:Number(h.hours)||0,color:HOUSE_COLORS[i%HOUSE_COLORS.length]})):houseNames.map((h,i)=>({house:h,hours:0,color:HOUSE_COLORS[i%HOUSE_COLORS.length]}))
  const clubsFormatted=clubsData.map((c,i)=>({name:c.name,members:Number(c.member_count)||0,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const sportsFormatted=sportsData.map(s=>({sport:s.sport,count:Number(s.student_count)||0}))
  const achievementsFormatted=achievementsData.map(a=>({title:a.title,house:a.house_name||"—",date:a.achieved_date?.slice(0,7)||"—"}))

  // ── Batches ──
  const totalBatches=batchesData.length
const activeBatches=batchesData.length
const totalCapacity=0
const totalStrength=admEnrolled
const batchFillRate=0
const batchTypeMap={}
batchesData.forEach(b=>{const t=b.course||"Regular";batchTypeMap[t]=(batchTypeMap[t]||0)+1})
  const batchByType=Object.entries(batchTypeMap).map(([name,count],i)=>({name,count,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const DAY_ABBR={"Monday":"Mon","Tuesday":"Tue","Wednesday":"Wed","Thursday":"Thu","Friday":"Fri","Saturday":"Sat","Sunday":"Sun"}
  const timetableByDay={}
  timetableData.forEach(t=>{const d=DAY_ABBR[t.day_name]||t.day_name||"Mon";if(!timetableByDay[d])timetableByDay[d]=0;timetableByDay[d]++})
  const timetableChart=["Mon","Tue","Wed","Thu","Fri","Sat"].map(d=>({day:d,classes:timetableByDay[d]||0}))

  // ── Enquiry ──
  const totalEnquiries=allAdm.length
  const openEnquiries=allAdm.filter(a=>a.status==="Applied"||a.status==="Under Review").length
  const convertedEnq=admEnrolled
  const conversionRate=pct(convertedEnq,totalEnquiries)
  const followUpDue=openEnquiries
  const enqSourceMap={}
  allAdm.forEach(a=>{const s=a.referral_source||"Unknown";enqSourceMap[s]=(enqSourceMap[s]||0)+1})
  const enqBySource=Object.entries(enqSourceMap).map(([name,count],i)=>({name,count,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const enqCourseMap={}
  allAdm.forEach(a=>{const c=a.course||"Unknown";enqCourseMap[c]=(enqCourseMap[c]||0)+1})
  const enqByCourse=Object.entries(enqCourseMap).sort((a,b)=>b[1]-a[1]).map(([name,count],i)=>({name,count,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const enqMonthMap={}
  allAdm.forEach(a=>{const mo=a.created_at?.slice(0,7);if(!mo)return;if(!enqMonthMap[mo])enqMonthMap[mo]={enquiries:0,converted:0};enqMonthMap[mo].enquiries++;if(a.status==="Enrolled")enqMonthMap[mo].converted++})
  const enqTrend=ACADEMIC_MONTHS.map(m=>({month:m.label,enquiries:enqMonthMap[m.key]?.enquiries||0,converted:enqMonthMap[m.key]?.converted||0}))
  const recentEnquiries=allAdm.slice(-6).reverse().map(a=>({name:a.applicant_name,course_interest:a.course,source:a.referral_source||"—",status:a.status,follow_up_date:a.created_at?.slice(0,10)}))

  // ── Doubts / SMS / Material ──
  const totalDoubts=doubtSessionsData.length,resolvedDoubts=0,unresolvedDoubts=0,avgResolutionHrs=0,doubtsBySubject=[],doubtsByBatch=[],doubtStaffLeaderboard=[],doubtTrend=ACADEMIC_MONTHS.map(m=>({month:m.label,raised:0,resolved:0}))
  const totalSMSSent=smsLogsData.reduce((s,l)=>s+(Number(l.count)||1),0),smsSent=0,smsFailed=0,smsDeliveryRate=0,smsByType=[],smsTrend=ACADEMIC_MONTHS.map(m=>({month:m.label,count:0}))
  const totalMaterials=studyMaterialData.length,distributedMat=0,pendingDistribution=0,totalCopies=0,distributedCopies=0,materialByType=[],materialBySubject=[]

  // ── Selections ──
  const totalSelections=selectionsData.length
  const jnvSelections=selectionsData.filter(s=>s.exam_name?.toLowerCase().includes("jnv")||s.exam_name?.toLowerCase().includes("navodaya")).length
  const sainikSelections=selectionsData.filter(s=>s.exam_name?.toLowerCase().includes("sainik")).length
  const otherSelections=totalSelections-jnvSelections-sainikSelections
  const selectionByYear={}
  selectionsData.forEach(s=>{const y=s.year||"Unknown";selectionByYear[y]=(selectionByYear[y]||0)+1})
  const selectionTrend=Object.entries(selectionByYear).sort((a,b)=>a[0].localeCompare(b[0])).map(([year,count])=>({year,count}))
  const selectionByExam={}
  selectionsData.forEach(s=>{const e=s.exam_name||"Other";selectionByExam[e]=(selectionByExam[e]||0)+1})
  const selByExam=Object.entries(selectionByExam).map(([name,count],i)=>({name,count,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const selectionByBatch={}
  selectionsData.forEach(s=>{const b=s.batch_name||"Unknown";selectionByBatch[b]=(selectionByBatch[b]||0)+1})
  const selByBatch=Object.entries(selectionByBatch).map(([batch,count],i)=>({batch,count,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const recentSelections=selectionsData.slice(-8).reverse()

  // ── Teaching ──
  const totalTopics=syllabusCoverageData.reduce((s,r)=>s+(Number(r.total_topics)||0),0)
  const coveredTopics=syllabusCoverageData.reduce((s,r)=>s+(Number(r.covered_topics)||0),0)
  const overallCoverage=pct(coveredTopics,totalTopics)
  const teacherCoverageMap={}
  syllabusCoverageData.forEach(r=>{const t=r.teacher_name||"Unknown";if(!teacherCoverageMap[t])teacherCoverageMap[t]={name:t,total:0,covered:0,subjects:new Set()};teacherCoverageMap[t].total+=Number(r.total_topics)||0;teacherCoverageMap[t].covered+=Number(r.covered_topics)||0;if(r.subject)teacherCoverageMap[t].subjects.add(r.subject)})
  const teacherCoverage=Object.values(teacherCoverageMap).map(t=>({name:t.name,total:t.total,covered:t.covered,pct:t.total>0?pct(t.covered,t.total):0,subjects:t.subjects.size})).sort((a,b)=>b.pct-a.pct)
  const subjectCoverageMap={}
  syllabusCoverageData.forEach(r=>{const s=r.subject||"Other";if(!subjectCoverageMap[s])subjectCoverageMap[s]={total:0,covered:0};subjectCoverageMap[s].total+=Number(r.total_topics)||0;subjectCoverageMap[s].covered+=Number(r.covered_topics)||0})
  const subjectCoverage=Object.entries(subjectCoverageMap).map(([subject,v],i)=>({subject:subject.slice(0,10),total:v.total,covered:v.covered,pct:v.total>0?pct(v.covered,v.total):0,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const coverageMonthMap={}
  syllabusCoverageData.forEach(r=>{const mo=r.month||"";if(!mo)return;if(!coverageMonthMap[mo])coverageMonthMap[mo]={total:0,covered:0};coverageMonthMap[mo].total+=Number(r.total_topics)||0;coverageMonthMap[mo].covered+=Number(r.covered_topics)||0})
  const coverageTrend=ACADEMIC_MONTHS.map(m=>({month:m.label,pct:coverageMonthMap[m.key]?.total>0?pct(coverageMonthMap[m.key].covered,coverageMonthMap[m.key].total):0}))
  const wc=str=>str?.trim().split(/\s+/).filter(Boolean).length||0
  const teacherLogMap={}
  teachingLogsRaw.forEach(l=>{const name=l.teacher_name||"Unknown";if(!teacherLogMap[name])teacherLogMap[name]=[];teacherLogMap[name].push(l)})

  // FIX #8: teacherStreaks — fixed off-by-one; now counts consecutive dates ending at/before today
  const teacherStreaks=Object.entries(teacherLogMap).map(([name,logs])=>{
    const dates=[...new Set(logs.map(l=>l.teaching_date).filter(Boolean))].sort()
    let streak=0
    if(dates.length>0){
      // Walk backwards from most-recent date, counting consecutive calendar days
      const todayMs=new Date(today).getTime()
      let expectedMs=null
      for(let i=dates.length-1;i>=0;i--){
        const dMs=new Date(dates[i]).getTime()
        if(expectedMs===null){
          // Allow the streak to start from today OR yesterday (today may not be logged yet)
          if(todayMs-dMs<=86400000){expectedMs=dMs-86400000;streak++}
          else break
        } else {
          if(dMs===expectedMs){expectedMs=dMs-86400000;streak++}
          else break
        }
      }
    }
    const monthKey=today.slice(0,7)
    const loggedDays=new Set(logs.filter(l=>l.teaching_date?.startsWith(monthKey)).map(l=>l.teaching_date)).size
    const missingDays=Math.max(0,new Date().getDate()-loggedDays)
    const lateCount=logs.filter(l=>l.late_submission).length
    const avgWc=logs.length>0?Math.round(logs.reduce((s,l)=>s+wc(l.topic_taught)+wc(l.classwork)+wc(l.remarks),0)/logs.length):0
    return{name,streak,totalLogs:logs.length,missingDays,lateCount,avgWc}
  }).sort((a,b)=>b.streak-a.streak)

  // ── Expenses ──
  // FIX: gnsiExpTotal previously summed expensesData (a separately-fetched, 200-row-capped
  // query against the SAME accounts table as accountsExpense), then ADDED it to acctExpTotal.
  // That double-counted every expense row, inflating totalExpenses (and deflating netPL) by
  // up to 2x. accountsExpense (from the unlimited accountsRes fetch) is the single correct
  // source — same one Accounts.jsx uses — so it's now used alone, with no second source to merge.
  const acctExpTotal = accountsExpense.reduce((s,r)=>s+(Number(r.amount)||0),0)
  const totalExpenses = acctExpTotal
  const netPL=totalFeeCollected-totalExpenses

  const expenseCategoryMap={}
  accountsExpense.forEach(r=>{const c=r.category||"Other";expenseCategoryMap[c]=(expenseCategoryMap[c]||0)+(Number(r.amount)||0)})
  const expenseByCategory=Object.entries(expenseCategoryMap).sort((a,b)=>b[1]-a[1]).map(([name,amount],i)=>({name,amount,color:COURSE_COLORS[i%COURSE_COLORS.length]}))

  const expenseMonthMap={}
  accountsExpense.forEach(r=>{const mo=r.entry_date?.slice(0,7);if(!mo)return;expenseMonthMap[mo]=(expenseMonthMap[mo]||0)+(Number(r.amount)||0)})
  const plTrend=ACADEMIC_MONTHS.map(m=>({month:m.label,income:allIncome.filter(r=>r.entry_date?.startsWith(m.key)).reduce((s,r)=>s+(Number(r.amount)||0),0),expense:expenseMonthMap[m.key]||0})).map(m=>({...m,pl:m.income-m.expense}))
  const recentExpenses=[...accountsExpense].sort((a,b)=>(b.entry_date||"").localeCompare(a.entry_date||"")).slice(0,6)

  // ── Notifications ──
  const notifications=[]
  if(taskOverdue>0)notifications.push({type:"warning",msg:`${taskOverdue} checklist tasks overdue`,time:"Just now"})
  if(defaultersRes.data?.length>0)notifications.push({type:"error",msg:`${defaultersRes.data.length} students have outstanding fees`,time:"Today"})
  if(recentFeeActivity.length>0){const last=recentFeeActivity[0];notifications.push({type:"success",msg:`${fmt(last.amount_paid||0)} collected — ${last.description||last.fee_type||"fee"}`,time:last.pay_date||"Today"})}
  if(openEnquiries>0)notifications.push({type:"info",msg:`${openEnquiries} applications pending review`,time:"This week"})

  // ── Fee Setup ──
  const totalFeeStructures=feeStructuresData.length
  const activeSessionStructures=feeStructuresData.filter(f=>f.session_year===`${CURRENT_YEAR}-${CURRENT_YEAR+1}`)
  const uniqueCourses_fs=[...new Set(feeStructuresData.map(f=>f.course).filter(Boolean))]
  const feeStructureByCourse=uniqueCourses_fs.map((course,i)=>{const rows=activeSessionStructures.filter(f=>f.course===course);const avgFlat=rows.length>0?Math.round(rows.reduce((s,r)=>s+(Number(r.flat_fee)||0),0)/rows.length):0;const avgCourse=rows.length>0?Math.round(rows.reduce((s,r)=>s+(Number(r.course_fee)||0),0)/rows.length):0;return{course,avgFlat,avgCourse,count:rows.length,color:COURSE_COLORS[i%COURSE_COLORS.length]}})
  const totalOverrides=feeOverridesData.length
  const hostelBreakdown_fs=["Boarder","Day Boarder","Day Scholar"].map((ht,i)=>{const rows=activeSessionStructures.filter(f=>f.hostel_type===ht);const avgFlat=rows.length>0?Math.round(rows.reduce((s,r)=>s+(Number(r.flat_fee)||0),0)/rows.length):0;return{hostel:ht,avgFlat,count:rows.length,color:COURSE_COLORS[i%COURSE_COLORS.length]}})
  const flatFeeTotal_fs=admFlatFeesData.reduce((s,r)=>s+(Number(r.amount)||0),0)
  const flatFeePaid_fs=admFlatFeesData.filter(r=>r.status==="Paid").reduce((s,r)=>s+(Number(r.amount)||0),0)
  const courseFeeTotal_fs=admCourseFeesData.reduce((s,r)=>s+(Number(r.amount_paid)||0),0)

  // FIX #9: flatFeeMonthMap — robust month→number conversion; handles name strings, numeric strings, integers
  const MONTH_NAME_TO_NUM={"January":"01","February":"02","March":"03","April":"04","May":"05","June":"06","July":"07","August":"08","September":"09","October":"10","November":"11","December":"12"}
  const flatFeeMonthMap={}
  admFlatFeesData.forEach(r=>{
    const raw = r.month
    let mo = MONTH_NAME_TO_NUM[raw]          // "April" → "04"
    if(!mo){
      const n = parseInt(raw, 10)
      if(!isNaN(n) && n>=1 && n<=12) mo = String(n).padStart(2,"0")  // 4 or "4" → "04"
    }
    if(!mo) return  // unrecognisable value — skip silently
    const k=`${r.year||"?"}-${mo}`
    flatFeeMonthMap[k]=(flatFeeMonthMap[k]||0)+(Number(r.amount)||0)
  })
  const flatFeeTrend=ACADEMIC_MONTHS.map(m=>({month:m.label,amount:flatFeeMonthMap[m.key]||0}))

  // ── Entrance ──
  const totalEntranceExams=entranceExamsData.length
  const completedExams=entranceExamsData.filter(e=>e.status==="Completed").length
  const scheduledExams=entranceExamsData.filter(e=>e.status==="Scheduled").length
  const totalEntranceCandidates=entranceCandidatesData.length
  const appearedCandidates=entranceCandidatesData.filter(c=>c.status==="Appeared").length
  const passedCandidates=entranceResultsData.filter(r=>r.result_status==="Pass").length
  const admittedFromEntrance=entranceResultsData.filter(r=>r.result_status==="Admitted").length
  const entrancePassRate=appearedCandidates>0?pct(passedCandidates,appearedCandidates):0
  const entranceTypeMap={}
  entranceExamsData.forEach(e=>{const t=e.exam_type||"Other";if(!entranceTypeMap[t])entranceTypeMap[t]={type:t,total:0,completed:0};entranceTypeMap[t].total++;if(e.status==="Completed")entranceTypeMap[t].completed++})
  const entranceByType=Object.values(entranceTypeMap).map((t,i)=>({...t,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const candidateStatusMap={}
  entranceCandidatesData.forEach(c=>{const s=c.status||"Registered";candidateStatusMap[s]=(candidateStatusMap[s]||0)+1})
  const candidatesByStatus=Object.entries(candidateStatusMap).map(([status,count],i)=>({status,count,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const recentEntranceExams=entranceExamsData.slice(0,6)

  // ── Study Lockers ──
  const totalLockers=studyLockersData.length
  const lockerCourseMap={}
  studyLockersData.forEach(l=>{const c=l.course||"Other";lockerCourseMap[c]=(lockerCourseMap[c]||0)+1})
  const lockersByCourse=Object.entries(lockerCourseMap).map(([course,count],i)=>({course,count,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const totalLockerMaterials=lockerMaterialsData.length
  const lockerMatTypeMap={}
  lockerMaterialsData.forEach(m=>{const t=m.material_type||"notes";lockerMatTypeMap[t]=(lockerMatTypeMap[t]||0)+1})
  const lockerMatByType=Object.entries(lockerMatTypeMap).sort((a,b)=>b[1]-a[1]).map(([type,count],i)=>({type,count,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const lockerTeacherMap={}
  studyLockersData.forEach(l=>{const t=l.teacher_name||"Unknown";if(!lockerTeacherMap[t])lockerTeacherMap[t]=0;lockerTeacherMap[t]++})
  const lockersByTeacher=Object.entries(lockerTeacherMap).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([name,count],i)=>({name,count,color:COURSE_COLORS[i%COURSE_COLORS.length]}))

  // ── Social ──
  const totalCampaigns=socialCampaignsData.length
  const activeCampaigns=socialCampaignsData.filter(c=>c.status==="Active").length
  const totalSocialLeads=socialLeadsData.length
  const convertedLeads=socialLeadsData.filter(l=>l.status==="Converted").length
  const newLeads=socialLeadsData.filter(l=>l.status==="New").length
  const overdueFollowUps=socialLeadsData.filter(l=>l.follow_up_date&&l.follow_up_date<todayStr()&&!["Converted","Closed"].includes(l.status)).length
  const socialConvRate=totalSocialLeads>0?pct(convertedLeads,totalSocialLeads):0
  const platformMap={}
  socialCampaignsData.forEach(c=>{const p=c.platform||"Other";platformMap[p]=(platformMap[p]||0)+1})
  const campaignsByPlatform=Object.entries(platformMap).map(([platform,count],i)=>({platform,count,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const totalBudget=socialCampaignsData.reduce((s,c)=>s+(Number(c.budget)||0),0)
  const totalPosts=socialPostsData.length
  const postedCount=socialPostsData.filter(p=>p.status==="Posted").length
  const plannedPosts_count=socialPostsData.filter(p=>p.status==="Planned").length
  const leadSourceMap={}
  socialLeadsData.forEach(l=>{const s=l.source||"Unknown";leadSourceMap[s]=(leadSourceMap[s]||0)+1})
  const leadsBySource=Object.entries(leadSourceMap).sort((a,b)=>b[1]-a[1]).map(([source,count],i)=>({source,count,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const socialMonthMap={}
  socialLeadsData.forEach(l=>{const mo=l.created_at?.slice(0,7);if(!mo)return;if(!socialMonthMap[mo])socialMonthMap[mo]={leads:0,converted:0};socialMonthMap[mo].leads++;if(l.status==="Converted")socialMonthMap[mo].converted++})
  const socialTrend=ACADEMIC_MONTHS.map(m=>({month:m.label,leads:socialMonthMap[m.key]?.leads||0,converted:socialMonthMap[m.key]?.converted||0}))

  // ── Connect ──
  const totalBroadcasts=connectBroadcastsData.length
  const sentBroadcasts=connectBroadcastsData.filter(b=>b.status==="Sent").length
  const totalRecipients=connectBroadcastsData.reduce((s,b)=>s+(Number(b.recipient_count)||0),0)
  const totalGrievances=connectGrievancesData.length
  const openGrievances=connectGrievancesData.filter(g=>g.status==="Open"||g.status==="Pending").length
  const resolvedGrievances=connectGrievancesData.filter(g=>g.status==="Resolved").length
  const unreadReplies=connectRepliesData.filter(r=>!r.is_read).length
  const broadcastChannelMap={}
  connectBroadcastsData.forEach(b=>{const c=b.channel||"SMS";broadcastChannelMap[c]=(broadcastChannelMap[c]||0)+1})
  const broadcastsByChannel=Object.entries(broadcastChannelMap).map(([channel,count],i)=>({channel,count,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const recentBroadcasts=connectBroadcastsData.slice(0,6)

  // ── Question Bank ──
  const totalQBankQuestions=qbankData.length
  const qbankCourseMap={}
  qbankData.forEach(q=>{const c=q.course||"Other";qbankCourseMap[c]=(qbankCourseMap[c]||0)+1})
  const qbankByCourse=Object.entries(qbankCourseMap).sort((a,b)=>b[1]-a[1]).map(([course,count],i)=>({course,count,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const qbankSubjectMap={}
  qbankData.forEach(q=>{const s=q.subject||"Other";qbankSubjectMap[s]=(qbankSubjectMap[s]||0)+1})
  const qbankBySubject=Object.entries(qbankSubjectMap).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([subject,count],i)=>({subject,count,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const qbankDiffMap={}
  qbankData.forEach(q=>{const d=q.difficulty||"Medium";qbankDiffMap[d]=(qbankDiffMap[d]||0)+1})
  const qbankByDifficulty=[{difficulty:"Easy",count:qbankDiffMap["Easy"]||0,color:T.emerald},{difficulty:"Medium",count:qbankDiffMap["Medium"]||0,color:T.amber},{difficulty:"Hard",count:qbankDiffMap["Hard"]||0,color:T.rose}]
  const qbankTypeMap={}
  qbankData.forEach(q=>{const t=q.question_type||"MCQ";qbankTypeMap[t]=(qbankTypeMap[t]||0)+1})
  const qbankByType=Object.entries(qbankTypeMap).map(([type,count],i)=>({type,count,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const qbankMonthMap={}
  qbankData.forEach(q=>{const mo=q.created_at?.slice(0,7);if(!mo)return;qbankMonthMap[mo]=(qbankMonthMap[mo]||0)+1})
  const qbankTrend=ACADEMIC_MONTHS.map(m=>({month:m.label,count:qbankMonthMap[m.key]||0}))

  // ── Syllabus Topics ──
  const totalSyllabusTopics=syllabusTopicsData.length
  const completedTopics_st=syllabusTopicsData.filter(t=>t.completed===true).length
  const pendingTopics_st=syllabusTopicsData.filter(t=>!t.completed&&!t.completed_at).length
  const inProgressTopics=syllabusTopicsData.filter(t=>!t.completed&&t.expected_date&&new Date(t.expected_date)<=new Date()).length
  const syllabusOverallPct=totalSyllabusTopics>0?pct(completedTopics_st,totalSyllabusTopics):0
  const syllabusCourseMap={}
  syllabusTopicsData.forEach(t=>{const c=t.course||"Other";if(!syllabusCourseMap[c])syllabusCourseMap[c]={total:0,completed:0};syllabusCourseMap[c].total++;if(t.completed)syllabusCourseMap[c].completed++})
  const syllabusByCourse=Object.entries(syllabusCourseMap).map(([course,v],i)=>({course,total:v.total,completed:v.completed,pct:v.total>0?pct(v.completed,v.total):0,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  // FIX #7: renamed syllabusTopicsBySubject (was syllabusByTeacher) — grouped by subject_name, not teacher
  const syllabusSubjectDetailMap={}
  syllabusTopicsData.forEach(t=>{const name=t.subject_name||"Other";if(!syllabusSubjectDetailMap[name])syllabusSubjectDetailMap[name]={name,total:0,completed:0};syllabusSubjectDetailMap[name].total++;if(t.completed)syllabusSubjectDetailMap[name].completed++})
  const syllabusTopicsBySubject=Object.values(syllabusSubjectDetailMap).map(t=>({...t,pct:t.total>0?pct(t.completed,t.total):0})).sort((a,b)=>b.pct-a.pct).slice(0,8)
  const syllabusSubjectMap={}
  syllabusTopicsData.forEach(t=>{const s=t.subject_name||"Other";if(!syllabusSubjectMap[s])syllabusSubjectMap[s]={total:0,completed:0};syllabusSubjectMap[s].total++;if(t.completed)syllabusSubjectMap[s].completed++})
  const syllabusBySubject=Object.entries(syllabusSubjectMap).sort((a,b)=>b[1].total-a[1].total).slice(0,8).map(([subject,v],i)=>({subject,total:v.total,completed:v.completed,pct:v.total>0?pct(v.completed,v.total):0,color:COURSE_COLORS[i%COURSE_COLORS.length]}))

  return {
    // FIX #1: expose both counts separately
    totalStudents: totalStudentsCount,
    enrolledStudents: admEnrolled,
    maleStudents, femaleStudents,
    boarders, dayBoarders, dayScholars, stateData, ageDistribution,
    totalAdmissions:allAdm.length, admApplied, admUnderReview, admAdmitted, admEnrolled, admRejected, admWaitlisted,
    courseBreakdown, applicationSource, yoyAdmissions, recentAdmissions:recentAdmRes.data||[], admissionFunnel,
    totalFeeCollected, feePending, admFeeTotal, flatFeeTotal, courseFeeTotal,
    totalWaivers, monthlyFees, feeAging, feeWaivers, recentFeeActivity,
    defaulters:(defaultersRes.data||[]).map(d=>({name:d.student_name||"—",gcc:`GCC-${d.gcc_no}`,due:Number(d.amount_due)||0,course:d.course||"—",status:d.status})),
    totalStaff, activeStaffCnt, totalSalaryBill, taskPending, taskDone, taskOverdue,
    taskByDept, topStaff, latestMonth, allTasks,
    salaryTrend, leaveBreakdown, recruitmentFunnel, trainingHours, staffRadar, slaBreach,
    presentToday, absentToday, lateToday, totalToday, attendanceWeek, monthlyAttTrend, scatterData:[],
    avgScore:avgScore_all, passRate, aPlusCount, atRisk, gradeDistribution, subjectScores, scoreByCourseFallback:[],
    hostelRooms, hostelTotalRooms, hostelOccupied, hostelVacant, messChartData, hostelIncidentChart,
    housePoints, serviceHours, clubsFormatted, sportsFormatted, achievementsFormatted, notifications,
    totalBatches, activeBatches, totalCapacity, totalStrength, batchFillRate, batchesData, batchByType, timetableChart,
    totalTests, totalTestEntries, avgTestScore, testByType, topPerformers, testSubjectScores, batchScores, testTrend, atRiskStudents,
    totalEnquiries, openEnquiries, convertedEnq, conversionRate, followUpDue, enqBySource, enqByCourse, enqTrend, enquiryFunnel, recentEnquiries,
    totalDoubts, resolvedDoubts, unresolvedDoubts, avgResolutionHrs, doubtsBySubject, doubtsByBatch, doubtStaffLeaderboard, doubtTrend,
    totalSMSSent, smsSent, smsFailed, smsDeliveryRate, smsByType, smsTrend,
    totalMaterials, distributedMat, pendingDistribution, totalCopies, distributedCopies, materialByType, materialBySubject,
    totalSelections, jnvSelections, sainikSelections, otherSelections, selectionTrend, selByExam, selByBatch, recentSelections,
    overallCoverage, teacherCoverage, subjectCoverage, coverageTrend, teacherStreaks,
    totalExpenses, netPL, expenseByCategory, plTrend, recentExpenses,
    totalFeeStructures, activeSessionStructures, feeStructureByCourse, totalOverrides, hostelBreakdown_fs, flatFeeTrend, flatFeeTotal_fs, flatFeePaid_fs, courseFeeTotal_fs,
    totalEntranceExams, completedExams, scheduledExams, totalEntranceCandidates, appearedCandidates, passedCandidates, admittedFromEntrance, entrancePassRate, entranceByType, candidatesByStatus, recentEntranceExams,
    totalLockers, lockersByCourse, totalLockerMaterials, lockerMatByType, lockersByTeacher,
    totalCampaigns, activeCampaigns, totalSocialLeads, convertedLeads, newLeads, overdueFollowUps, socialConvRate, campaignsByPlatform, totalBudget, totalPosts, postedCount, plannedPosts_count, leadsBySource, socialTrend,
    totalBroadcasts, sentBroadcasts, totalRecipients, totalGrievances, openGrievances, resolvedGrievances, unreadReplies, broadcastsByChannel, recentBroadcasts,
    totalQBankQuestions, qbankByCourse, qbankBySubject, qbankByDifficulty, qbankByType, qbankTrend,
    totalSyllabusTopics, completedTopics_st, pendingTopics_st, inProgressTopics, syllabusOverallPct, syllabusByCourse,
    // FIX #7: renamed export
    syllabusTopicsBySubject, syllabusBySubject,
  }
}

// ─── MOBILE-RESPONSIVE GRID HELPERS ─────────────────────────────────────────
const G = {
  kpi:    "grid-kpi",
  cols2:  "grid-cols2",
  cols3:  "grid-cols3",
  split:  "grid-split",
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
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
      setTimeout(() => { sectionRefs.current[scrollToSection].scrollIntoView({ behavior:"smooth", block:"start" }) }, 150)
    }
  }, [loading, scrollToSection])

  useEffect(()=>{ const t=setInterval(()=>setNow(new Date()),60000); return()=>clearInterval(t) },[])

  useEffect(()=>{
    const channel=supabase.channel("gnsi-live")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"accounts"},
        payload=>{ if(payload.new.type==="Income") setLiveTotal(v=>v+(Number(payload.new.amount)||0)) })
      .subscribe()
    return()=>{ channel.unsubscribe() }
  },[])

  const load = useCallback(async()=>{
    setLoading(true); setError(null)
    try { const d=await loadAllData(); setData(d); setLiveTotal(d.totalFeeCollected) }
    catch(e) { console.error(e); setError(e.message) }
    finally { setLoading(false) }
  },[])

  useEffect(()=>{ load() },[load])

  if(error) return (
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12}}>
      <div style={{color:T.rose,fontSize:14,fontWeight:700}}>❌ {error}</div>
      <button onClick={load} style={{padding:"8px 20px",borderRadius:8,border:"none",background:T.gold,color:"#fff",fontWeight:700,cursor:"pointer"}}>Retry</button>
    </div>
  )

  if(loading||!data) return (
    <div style={{minHeight:"100vh",background:T.bg,padding:24,display:"flex",gap:20}}>
      <style>{`@keyframes shimmer{0%{opacity:.4}50%{opacity:.7}100%{opacity:.4}}`}</style>
      <div style={{flex:1,display:"flex",flexDirection:"column",gap:16}}>
        <Skeleton h={48} w={280} r={10}/>
        <div className={G.kpi} style={{display:"grid",gap:12}}>
          {[...Array(6)].map((_,i)=><Skeleton key={i} h={120} r={14}/>)}
        </div>
        <Skeleton h={240} r={14}/>
      </div>
    </div>
  )

  // FIX #5: feeProgress — clamp feePending to ≥0 so ratio never exceeds 100%
  const feeProgress = Math.min(100, pct(liveTotal, liveTotal + Math.max(0, data.feePending)))
  const attProgress=pct(data.presentToday,data.totalToday)

  const td = (extra={}) => ({fontSize:13,color:T.inkMid,padding:"9px 12px",background:T.bgInset,...extra})
  const tdFirst = {fontSize:13,fontWeight:700,color:T.ink,padding:"9px 12px",background:T.bgInset,borderRadius:"10px 0 0 10px"}
  const tdLast  = {padding:"9px 12px",background:T.bgInset,borderRadius:"0 10px 10px 0"}
  const th = {textAlign:"left",fontSize:10,color:T.inkSub,fontWeight:700,padding:"5px 12px",textTransform:"uppercase",letterSpacing:".07em",whiteSpace:"nowrap"}

  return (
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:"'DM Sans','Segoe UI',system-ui,sans-serif",color:T.ink}}>
      <style>{`
        @keyframes shimmer{0%{opacity:.4}50%{opacity:.7}100%{opacity:.4}}
        @keyframes slideIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box;scrollbar-width:thin;scrollbar-color:#cbd5e1 transparent}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:2px}
        html{scroll-behavior:smooth}
        .grid-kpi{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
        .grid-cols2{display:grid;grid-template-columns:1fr;gap:12px}
        .grid-cols3{display:grid;grid-template-columns:1fr;gap:12px}
        .grid-split{display:grid;grid-template-columns:1fr;gap:12px}
        @media(min-width:600px){
          .grid-kpi{grid-template-columns:repeat(3,1fr);gap:12px}
          .grid-cols2{grid-template-columns:repeat(2,1fr)}
          .grid-split{grid-template-columns:2fr 1fr}
        }
        @media(min-width:900px){
          .grid-kpi{grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:13px}
          .grid-cols3{grid-template-columns:repeat(3,1fr)}
        }
        @media(min-width:1024px){
          .grid-cols2{grid-template-columns:repeat(2,1fr)}
          .grid-split{grid-template-columns:2fr 1fr}
        }
        .dash-section{margin-bottom:36px}
        .fee-banner{
          background:linear-gradient(135deg,${T.gold}14,${T.gold}06);
          border:1px solid ${T.gold}30;
          border-radius:14px;
          padding:16px 20px;
          margin-bottom:18px;
          display:flex;
          flex-wrap:wrap;
          align-items:center;
          justify-content:space-between;
          gap:14px;
        }
        .fee-banner-meta{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;text-align:center;width:100%}
        @media(min-width:700px){.fee-banner-meta{width:auto}}
        .funnel-row{display:flex;flex-wrap:wrap;gap:8px}
        .funnel-row > div{flex:1;min-width:120px}
      `}</style>

      <div style={{padding:"20px 16px",maxWidth:"100%"}}>

        {/* ═══ OVERVIEW ════════════════════════════════════════ */}
        <div ref={setSectionRef('overview')} className="dash-section">
          <div style={{marginBottom:18}}>
            <h1 style={{fontSize:20,fontWeight:900,margin:0,color:T.ink}}>
              Good {now.getHours()<12?"Morning":now.getHours()<17?"Afternoon":"Evening"} 👋
            </h1>
            <p style={{color:T.inkSub,fontSize:12,margin:"3px 0 0"}}>
              {now.toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"})} · AY {CURRENT_YEAR}–{CURRENT_YEAR+1}
            </p>
            <button onClick={async()=>{
              try{
                const reg=await navigator.serviceWorker.ready
                const existing=await reg.pushManager.getSubscription()
                if(existing){alert("✅ Already subscribed to notifications!");return}
                const sub=await reg.pushManager.subscribe({
                  userVisibleOnly:true,
                  applicationServerKey:import.meta.env.VITE_VAPID_PUBLIC_KEY
                })
                const {error}=await supabase.from("push_subscriptions").insert({
                  subscription:JSON.stringify(sub),
                  user_agent:navigator.userAgent,
                  created_at:new Date().toISOString()
                })
                if(error)throw new Error(error.message)
                alert("✅ Push notifications enabled! You'll get alerts for payments, students, and tasks.")
              }catch(e){alert("❌ Failed: "+e.message)}
            }} style={{
              marginTop:8,padding:"5px 14px",borderRadius:8,
              border:`1px solid ${T.gold}40`,background:`${T.gold}10`,
              color:T.gold,fontSize:11,fontWeight:700,
              cursor:"pointer",fontFamily:"inherit"
            }}>🔔 Enable Notifications</button>
          </div>

          <div className="fee-banner">
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:24}}>💰</span>
              <div>
                <div style={{fontSize:10,color:T.gold,fontWeight:700,textTransform:"uppercase",letterSpacing:".1em"}}>Live Fee Collection · AY {CURRENT_YEAR}–{CURRENT_YEAR+1}</div>
                <div style={{fontSize:26,fontWeight:900,color:T.ink,letterSpacing:"-.02em",marginTop:1}}>{fmt(liveTotal)}</div>
              </div>
            </div>
            <div style={{flex:1,minWidth:200,maxWidth:300}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:11,color:T.inkSub}}>
                <span>Progress</span>
                <span style={{color:T.gold,fontWeight:700}}>{feeProgress}% · {fmt(data.feePending)} pending</span>
              </div>
              <ProgressBar value={liveTotal} max={liveTotal+Math.max(0,data.feePending)} color={T.gold} height={9}/>
            </div>
            <div className="fee-banner-meta">
              {[{label:"Admission",val:data.admFeeTotal,color:T.violet},{label:"Flat Fee",val:data.flatFeeTotal,color:T.sky},{label:"Course",val:data.courseFeeTotal,color:T.emerald}].map(x=>(
                <div key={x.label}>
                  <div style={{fontSize:10,color:x.color,fontWeight:700,textTransform:"uppercase"}}>{x.label}</div>
                  <div style={{fontSize:13,fontWeight:800,color:T.ink,marginTop:1}}>{fmt(x.val)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* FIX #1: Students KPI — show DB total; sub shows enrolled count separately */}
          <div className="grid-kpi" style={{marginBottom:16}}>
            <KPI icon="🎓" label="Students" value={data.totalStudents} color={T.sky} sub={`${data.enrolledStudents} enrolled`}/>
            <KPI icon="🗂️" label="Batches" value={data.activeBatches} color={T.indigo} sub={`${data.totalBatches} total`}/>
            <KPI icon="📝" label="Exam Entries" value={data.totalTestEntries} color={T.violet} sub={`Avg ${data.avgTestScore}%`}/>
            <KPI icon="🔍" label="Applications" value={data.totalEnquiries} color={T.amber} sub={`${data.convertedEnq} enrolled · ${data.conversionRate}%`}/>
            <KPI icon="✅" label="Present Today" value={data.presentToday} color={T.emerald} progress={data.presentToday} progressMax={data.totalToday}/>
            <KPI icon="🏅" label="Selections" value={data.totalSelections} color={T.gold} sub={`JNV: ${data.jnvSelections} · Sainik: ${data.sainikSelections}`}/>
            <KPI icon="💸" label="Fee Pending" value={data.feePending} color={T.rose} isMoney/>
            <KPI icon="📉" label="Net P&L" value={data.netPL} color={data.netPL>=0?T.emerald:T.rose} isMoney sub={`Exp: ${fmt(data.totalExpenses)}`}/>
          </div>

          <div className="grid-split" style={{marginBottom:14}}>
            <Panel title="Monthly Fee Collection vs Target">
              <ResponsiveContainer width="100%" height={190}>
                <ComposedChart data={data.monthlyFees}>
                  <XAxis dataKey="month" tick={{fill:T.inkSub,fontSize:11}} axisLine={false} tickLine={false}/>
                  <YAxis hide/><Tooltip content={<Tip/>} cursor={{fill:"rgba(0,0,0,.03)"}}/>
                  <Bar dataKey="collected" name="Collected" radius={[5,5,0,0]} barSize={22}>
                    {data.monthlyFees.map((m,i)=><Cell key={i} fill={m.collected>0?T.gold:`${T.slate}22`}/>)}
                  </Bar>
                  <Line dataKey="target" name="Target" stroke={T.rose} strokeWidth={2} strokeDasharray="4 3" dot={false}/>
                </ComposedChart>
              </ResponsiveContainer>
            </Panel>
            <Panel title="Admission Pipeline" sub="Lead to enrolment">
              <div style={{display:"flex",flexDirection:"column",gap:9}}>
                {data.enquiryFunnel.map((s,i,arr)=>{const prev=arr[i-1];return(
                  <div key={s.stage}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                      <span style={{fontSize:11,color:T.inkSub}}>{s.stage}</span>
                      <div><span style={{fontSize:13,fontWeight:800,color:s.color}}>{s.count}</span>{prev&&<span style={{fontSize:10,color:T.inkSub}}> ({pct(s.count,prev.count)}%)</span>}</div>
                    </div>
                    <ProgressBar value={s.count} max={data.enquiryFunnel[0].count||1} color={s.color} height={8}/>
                  </div>
                )})}
              </div>
            </Panel>
          </div>

          <div className="grid-cols3" style={{marginBottom:14}}>
            <Panel title="Recent Fee Activity">
              {data.recentFeeActivity.length===0?<EmptyState msg="No payments yet"/>:(
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {data.recentFeeActivity.map((a,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 9px",borderRadius:9,background:T.bgInset,border:`1px solid ${T.border}`}}>
                      <div style={{width:26,height:26,borderRadius:7,flexShrink:0,background:`${T.gold}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:T.gold}}>{(a.description||a.fee_type||"?")[0].toUpperCase()}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:700,color:T.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.description||a.fee_type||"—"}</div>
                        <div style={{fontSize:10,color:T.inkSub}}>{a.pay_date||"—"} · {a.pay_mode||"—"}</div>
                      </div>
                      <div style={{fontSize:12,fontWeight:800,color:T.emerald,flexShrink:0}}>{fmt(a.amount_paid)}</div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
            <Panel title="⚠️ Defaulters" accent={T.rose}>
              {data.defaulters.length===0?<div style={{color:T.emerald,fontSize:13,fontWeight:600}}>✅ No outstanding fees!</div>:(
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {data.defaulters.map((d,i)=>(
                    <div key={i} style={{padding:"8px 10px",borderRadius:9,background:`${T.rose}08`,border:`1px solid ${T.rose}20`}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:1}}>
                        <div style={{fontSize:12,fontWeight:700,color:T.ink}}>{d.name}</div>
                        <div style={{fontSize:12,fontWeight:800,color:T.rose}}>{fmt(d.due)}</div>
                      </div>
                      <div style={{fontSize:10,color:T.inkSub}}>{d.gcc} · {d.course}</div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
            <Panel title="🔔 Notifications">
              {data.notifications.length===0?<EmptyState msg="All clear!"/>:(
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {data.notifications.map((n,i)=>{const c={warning:T.amber,error:T.rose,success:T.emerald,info:T.sky}[n.type];const ic={warning:"⚠️",error:"🔴",success:"✅",info:"ℹ️"}[n.type];return(
                    <div key={i} style={{display:"flex",gap:8,padding:"8px 10px",borderRadius:9,background:`${c}08`,border:`1px solid ${c}20`}}>
                      <span style={{fontSize:13}}>{ic}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:11,color:T.ink,lineHeight:1.4}}>{n.msg}</div>
                        <div style={{fontSize:10,color:T.inkSub,marginTop:1}}>{n.time}</div>
                      </div>
                    </div>
                  )})}
                </div>
              )}
            </Panel>
          </div>

          {/* FIX #2: admissionFunnel now uses exact-status counts — conversions will be meaningful */}
          <Panel title="Admission Pipeline" sub="Live conversion rates">
            <div className="funnel-row">
              {data.admissionFunnel.map((s,i,arr)=>{const prev=arr[i-1];const conv=prev&&prev.count>0?pct(s.count,prev.count):null;return(
                <div key={s.stage} style={{flex:1,minWidth:100,position:"relative"}}>
                  <div style={{background:`${s.color}10`,border:`1px solid ${s.color}25`,borderRadius:12,padding:"12px 8px",textAlign:"center"}}>
                    <div style={{fontSize:20,fontWeight:900,color:s.color}}><Counter value={s.count}/></div>
                    <div style={{fontSize:10,color:T.inkSub,marginTop:3,fontWeight:600}}>{s.stage}</div>
                    {conv!==null&&<div style={{fontSize:10,fontWeight:700,marginTop:3,color:conv>=80?T.emerald:conv>=60?T.amber:T.rose}}>{conv}% conv.</div>}
                  </div>
                  {i<3&&<div style={{position:"absolute",right:-6,top:"50%",transform:"translateY(-50%)",color:T.inkSub,fontSize:16,zIndex:2}}>›</div>}
                </div>
              )})}
            </div>
          </Panel>
        </div>

        {/* ═══ FINANCE ═══════════════════════════════════════ */}
        <div ref={setSectionRef('finance')} className="dash-section">
          <SectionHeader icon="💰" title="Finance & Fee Analytics"/>
          <div className="grid-kpi" style={{marginBottom:16}}>
            <KPI icon="💰" label="Total Collected" value={liveTotal} isMoney color={T.gold}/>
            <KPI icon="📌" label="Fee Pending" value={data.feePending} isMoney color={data.feePending>0?T.rose:T.emerald} sub="All fees cleared"/>
            <KPI icon="🎓" label="Admission Fee" value={data.admFeeTotal} isMoney color={T.violet}/>
            <KPI icon="📄" label="Flat Fee" value={data.flatFeeTotal} isMoney color={T.sky}/>
            <KPI icon="📚" label="Course Fee" value={data.courseFeeTotal} isMoney color={T.emerald}/>
            <KPI icon="🎁" label="Waivers Given" value={data.totalWaivers} isMoney color={T.amber}/>
          </div>
          <div className="grid-split" style={{marginBottom:14}}>
            <Panel title="Monthly Collection vs Target">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data.monthlyFees}>
                  <defs><linearGradient id="feeGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.gold} stopOpacity={0.2}/><stop offset="95%" stopColor={T.gold} stopOpacity={0}/></linearGradient></defs>
                  <XAxis dataKey="month" tick={{fill:T.inkSub,fontSize:11}} axisLine={false} tickLine={false}/>
                  <YAxis hide/><Tooltip content={<Tip/>}/>
                  <Area dataKey="collected" name="Collected" stroke={T.gold} strokeWidth={2.5} fill="url(#feeGrad)"/>
                  <Line dataKey="target" name="Target" stroke={T.rose} strokeWidth={2} strokeDasharray="4 3" dot={false}/>
                </AreaChart>
              </ResponsiveContainer>
            </Panel>
            <Panel title="Fee Aging Buckets">
              {data.feeAging.every(f=>f.amount===0)?<EmptyState msg="No outstanding invoices"/>:data.feeAging.map(f=>(
                <div key={f.bucket} style={{marginBottom:13}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:12,color:T.inkSub}}>{f.bucket}</span><span style={{fontSize:13,fontWeight:800,color:f.color}}>{fmt(f.amount)}</span></div>
                  <ProgressBar value={f.amount} max={data.feePending||1} color={f.color} height={7}/>
                </div>
              ))}
            </Panel>
          </div>
          <Panel title="Fee Defaulters">
            {data.defaulters.length===0?<div style={{color:T.emerald,fontWeight:600,fontSize:13}}>✅ No outstanding invoices!</div>:(
              <TableWrap>
                <table style={{width:"100%",borderCollapse:"separate",borderSpacing:"0 5px",minWidth:480}}>
                  <thead><tr>{["Student","GCC","Course","Due","Status"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
                  <tbody>{data.defaulters.map((d,i)=>(
                    <tr key={i}>
                      <td style={tdFirst}>{d.name}</td>
                      <td style={td()}>{d.gcc}</td>
                      <td style={td()}>{d.course}</td>
                      <td style={td({color:T.rose,fontWeight:800})}>{fmt(d.due)}</td>
                      <td style={tdLast}><Badge label={d.status} color={statusColor(d.status)}/></td>
                    </tr>
                  ))}</tbody>
                </table>
              </TableWrap>
            )}
          </Panel>
        </div>

        {/* ═══ STUDENTS ══════════════════════════════════════ */}
        <div ref={setSectionRef('students')} className="dash-section">
          <SectionHeader icon="🎓" title="Student Analytics"/>
          {/* FIX #1: main value = DB total; sub = enrolled count */}
          <div className="grid-kpi" style={{marginBottom:16}}>
            <KPI icon="👥" label="Total" value={data.totalStudents} color={T.sky} sub={`${data.enrolledStudents} enrolled`}/>
            <KPI icon="👦" label="Male" value={data.maleStudents} color={T.sky} progress={data.maleStudents} progressMax={data.totalStudents}/>
            <KPI icon="👧" label="Female" value={data.femaleStudents} color={T.pink} progress={data.femaleStudents} progressMax={data.totalStudents}/>
            <KPI icon="🏠" label="Boarders" value={data.boarders} color={T.violet}/>
            <KPI icon="🚌" label="Day Boarders" value={data.dayBoarders} color={T.amber}/>
            <KPI icon="🏡" label="Day Scholars" value={data.dayScholars} color={T.emerald}/>
          </div>
          <div className="grid-cols3" style={{marginBottom:14}}>
            <Panel title="Gender Split">
              <div style={{display:"flex",alignItems:"center",gap:14}}>
                <Gauge value={data.totalStudents>0?pct(data.maleStudents,data.totalStudents):0} color={T.sky} size={84}/>
                <div style={{flex:1}}>
                  {[{l:"Male",v:data.maleStudents,c:T.sky},{l:"Female",v:data.femaleStudents,c:T.pink}].map(x=>(
                    <div key={x.l} style={{marginBottom:9}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:12,color:T.inkSub}}>{x.l}</span><span style={{fontSize:12,fontWeight:800,color:x.c}}>{x.v}</span></div>
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
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}><span style={{fontSize:11,color:T.inkSub}}>{s.name}</span><span style={{fontSize:11,fontWeight:700,color:s.color}}>{s.students}</span></div>
                      <ProgressBar value={s.students} max={data.courseBreakdown[0]?.students||1} color={s.color} height={4}/>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
            <Panel title="Hostel Type">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={[{name:"Boarder",value:data.boarders,color:T.violet},{name:"Day Boarder",value:data.dayBoarders,color:T.amber},{name:"Day Scholar",value:data.dayScholars,color:T.emerald}].filter(x=>x.value>0)} dataKey="value" cx="50%" cy="50%" innerRadius={38} outerRadius={60} paddingAngle={4}>
                    {[T.violet,T.amber,T.emerald].map((c,i)=><Cell key={i} fill={c}/>)}
                  </Pie>
                  <Tooltip content={<Tip/>}/><Legend formatter={v=><span style={{color:T.inkSub,fontSize:11}}>{v}</span>}/>
                </PieChart>
              </ResponsiveContainer>
            </Panel>
          </div>
          <Panel title="Recent Admissions">
            {data.recentAdmissions.length===0?<EmptyState msg="No admissions"/>:(
              <TableWrap>
                <table style={{width:"100%",borderCollapse:"separate",borderSpacing:"0 5px",minWidth:400}}>
                  <thead><tr>{["Name","Batch","Status","Date"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
                  <tbody>{data.recentAdmissions.map((a,i)=>(
                    <tr key={i}>
                      <td style={tdFirst}>{a.applicant_name||"—"}</td>
                      <td style={td()}>{a.batch||"—"}</td>
                      <td style={td()}><Badge label={a.status||"—"} color={statusColor(a.status)}/></td>
                      <td style={{...tdLast,fontSize:12,color:T.inkSub}}>{a.created_at?.slice(0,10)||"—"}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </TableWrap>
            )}
          </Panel>
        </div>

        {/* ═══ ADMISSIONS ════════════════════════════════════ */}
        <div ref={setSectionRef('admissions')} className="dash-section">
          <SectionHeader icon="📋" title="Admissions Deep Dive"/>
          <div className="grid-kpi" style={{marginBottom:16}}>
            <KPI icon="📩" label="Applied" value={data.admApplied} color={T.sky}/>
            <KPI icon="🔍" label="Under Review" value={data.admUnderReview} color={T.violet}/>
            <KPI icon="✅" label="Admitted" value={data.admAdmitted} color={T.amber}/>
            <KPI icon="🎓" label="Enrolled" value={data.admEnrolled} color={T.emerald}/>
            <KPI icon="❌" label="Rejected" value={data.admRejected} color={T.rose}/>
            <KPI icon="⏳" label="Waitlisted" value={data.admWaitlisted} color={T.slateL}/>
          </div>
          <div className="grid-cols2" style={{marginBottom:14}}>
            {/* FIX #2: funnel now shows per-stage counts with accurate conversion rates */}
            <Panel title="Admission Funnel">
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {data.admissionFunnel.map((s,i,arr)=>{const prev=arr[i-1];return(
                  <div key={s.stage}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:12,color:T.inkSub}}>{s.stage}</span>
                      <div><span style={{fontSize:14,fontWeight:800,color:s.color}}>{s.count}</span>{prev&&prev.count>0&&<span style={{fontSize:11,color:T.inkSub}}> ({pct(s.count,prev.count)}%)</span>}</div>
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
                    <Pie data={data.applicationSource} dataKey="value" cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={4}>
                      {data.applicationSource.map((p,i)=><Cell key={i} fill={p.color}/>)}
                    </Pie>
                    <Tooltip content={<Tip/>}/><Legend formatter={v=><span style={{color:T.inkSub,fontSize:11}}>{v}</span>}/>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Panel>
          </div>
          <div className="grid-cols2">
            <Panel title="Course Breakdown">
              {data.courseBreakdown.length===0?<EmptyState msg="No data"/>:(
                <div style={{display:"flex",flexDirection:"column",gap:9}}>
                  {data.courseBreakdown.map(c=>(
                    <div key={c.name}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:12,color:T.inkSub}}>{c.name}</span><span style={{fontSize:12,fontWeight:700,color:c.color}}>{c.students}</span></div>
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
                    <XAxis dataKey="year" tick={{fill:T.inkSub,fontSize:11}} axisLine={false} tickLine={false}/>
                    <YAxis hide/><Tooltip content={<Tip/>}/>
                    <Bar dataKey="count" name="Admissions" radius={[6,6,0,0]} barSize={32}>
                      {data.yoyAdmissions.map((y,i)=><Cell key={i} fill={i===data.yoyAdmissions.length-1?T.gold:`${T.gold}55`}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Panel>
          </div>
        </div>

        {/* ═══ STAFF ════════════════════════════════════════ */}
        <div ref={setSectionRef('staff')} className="dash-section">
          <SectionHeader icon="👨‍💼" title="Staff & HR"/>
          <div className="grid-kpi" style={{marginBottom:16}}>
            <KPI icon="👥" label="Total Staff" value={data.totalStaff} color={T.sky} sub={`${data.activeStaffCnt} active`}/>
            <KPI icon="✅" label="Active" value={data.activeStaffCnt} color={T.emerald}/>
            <KPI icon="💵" label="Salary Bill" value={data.totalSalaryBill} color={T.gold} isMoney/>
            <KPI icon="📋" label="Tasks Pending" value={data.taskPending} color={T.amber}/>
            <KPI icon="✔️" label="Tasks Done" value={data.taskDone} color={T.emerald}/>
            <KPI icon="⚠️" label="Overdue" value={data.taskOverdue} color={T.rose}/>
          </div>
          <div className="grid-cols2" style={{marginBottom:14}}>
            <Panel title="Management Checklist" sub="From management_checklist table">
              {data.allTasks?.length===0?<EmptyState msg="No checklist data"/>:(
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {data.allTasks?.map((t,i)=>(
                    <div key={i} style={{padding:"8px 11px",borderRadius:10,background:t.status==="Done"?`${T.emerald}08`:`${T.amber}08`,border:`1px solid ${t.status==="Done"?T.emerald:T.amber}20`}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:1}}>
                        <span style={{fontSize:12,fontWeight:700,color:T.ink}}>{t.task||"—"}</span>
                        <Badge label={t.status||"Pending"} color={statusColor(t.status||"Pending")}/>
                      </div>
                      <div style={{fontSize:10,color:T.inkSub}}>{t.section} · {t.assigned_to} · {t.priority}</div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
            <Panel title="Task Status">
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:14}}>
                <Gauge value={data.taskPending+data.taskDone>0?pct(data.taskDone,data.taskPending+data.taskDone):0} color={T.emerald} size={84}/>
                <div style={{width:"100%"}}>
                  {[{l:"Done",v:data.taskDone,c:T.emerald},{l:"Pending",v:data.taskPending,c:T.amber},{l:"Overdue",v:data.taskOverdue,c:T.rose}].map(x=>(
                    <div key={x.l} style={{marginBottom:8}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:12,color:T.inkSub}}>{x.l}</span><span style={{fontSize:12,fontWeight:700,color:x.c}}>{x.v}</span></div>
                      <ProgressBar value={x.v} max={(data.taskPending+data.taskDone+data.taskOverdue)||1} color={x.c} height={5}/>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          </div>
          <Panel accent={T.slate}><EmptyState msg="Add staff records to gnsi_staff_biodata to see salary trends, performance leaderboard, and recruitment pipeline"/></Panel>
        </div>

        {/* ═══ ATTENDANCE ════════════════════════════════════ */}
        <div ref={setSectionRef('attendance')} className="dash-section">
          <SectionHeader icon="✅" title="Attendance Analytics"/>
          <div className="grid-kpi" style={{marginBottom:16}}>
            <KPI icon="✅" label="Present" value={data.presentToday} color={T.emerald} progress={data.presentToday} progressMax={data.totalToday}/>
            <KPI icon="❌" label="Absent" value={data.absentToday} color={T.rose}/>
            <KPI icon="⏰" label="Late" value={data.lateToday} color={T.amber}/>
            <KPI icon="📊" label="Rate" value={attProgress} color={T.sky} sub={`${attProgress}% today`}/>
          </div>
          {data.attendanceWeek.length===0?(
            <Panel><EmptyState msg="No attendance records yet."/></Panel>
          ):(
            <>
              <div className="grid-split" style={{marginBottom:14}}>
                <Panel title="Last 7 Days">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data.attendanceWeek}>
                      <XAxis dataKey="day" tick={{fill:T.inkSub,fontSize:11}} axisLine={false} tickLine={false}/><YAxis hide/><Tooltip content={<Tip/>}/>
                      <Bar dataKey="present" name="Present" fill={T.emerald} radius={[3,3,0,0]} barSize={22} stackId="a"/>
                      <Bar dataKey="late" name="Late" fill={T.amber} barSize={22} stackId="a"/>
                      <Bar dataKey="absent" name="Absent" fill={T.rose} radius={[3,3,0,0]} barSize={22} stackId="a"/>
                    </BarChart>
                  </ResponsiveContainer>
                </Panel>
                <Panel title="Today">
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:14,paddingTop:6}}>
                    <Gauge value={attProgress} max={100} color={T.emerald} size={94}/>
                    <div style={{width:"100%",display:"flex",flexDirection:"column",gap:7}}>
                      {[{label:"Present",val:data.presentToday,color:T.emerald},{label:"Absent",val:data.absentToday,color:T.rose},{label:"Late",val:data.lateToday,color:T.amber}].map(x=>(
                        <div key={x.label}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:12,color:T.inkSub}}>{x.label}</span><span style={{fontSize:12,fontWeight:700,color:x.color}}>{x.val}</span></div>
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
                    <defs><linearGradient id="attGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.emerald} stopOpacity={0.2}/><stop offset="95%" stopColor={T.emerald} stopOpacity={0}/></linearGradient></defs>
                    <XAxis dataKey="month" tick={{fill:T.inkSub,fontSize:11}} axisLine={false} tickLine={false}/>
                    <YAxis domain={[0,100]} hide/><Tooltip content={<Tip/>}/>
                    <ReferenceLine y={85} stroke={T.amber} strokeDasharray="4 3" label={{value:"85% target",fill:T.amber,fontSize:10}}/>
                    <Area dataKey="rate" name="Attendance %" stroke={T.emerald} strokeWidth={2.5} fill="url(#attGrad)"/>
                  </AreaChart>
                </ResponsiveContainer>
              </Panel>
            </>
          )}
        </div>

        {/* ═══ ACADEMIC ══════════════════════════════════════ */}
        <div ref={setSectionRef('academic')} className="dash-section">
          <SectionHeader icon="📚" title="Academic Performance"/>
          {/* FIX — avg score sub now shows % clearly */}
          <div className="grid-kpi" style={{marginBottom:16}}>
            <KPI icon="📊" label="Avg Score" value={data.avgScore} color={T.sky} sub={`Class average: ${data.avgScore}%`}/>
            <KPI icon="✅" label="Pass Rate" value={data.passRate} color={T.emerald} sub={`${data.passRate}% passed`}/>
            <KPI icon="🏆" label="A+ Students" value={data.aPlusCount} color={T.gold}/>
            <KPI icon="📉" label="At Risk" value={data.atRisk} color={T.rose} sub="Below 35%"/>
          </div>
          <div className="grid-cols2">
            <Panel title="Grade Distribution">
              {data.gradeDistribution.every(g=>g.count===0)?<EmptyState msg="No exam_marks data"/>:(
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={data.gradeDistribution}>
                    <XAxis dataKey="grade" tick={{fill:T.inkSub,fontSize:12}} axisLine={false} tickLine={false}/>
                    <YAxis hide/><Tooltip content={<Tip/>}/>
                    <Bar dataKey="count" name="Students" radius={[5,5,0,0]} barSize={32}>{data.gradeDistribution.map((g,i)=><Cell key={i} fill={g.color}/>)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Panel>
            <Panel title="Subject Performance">
              {data.subjectScores.length===0?<EmptyState msg="No subject data"/>:(
                <ResponsiveContainer width="100%" height={190}>
                  <ComposedChart data={data.subjectScores}>
                    <XAxis dataKey="subject" tick={{fill:T.inkSub,fontSize:10}} axisLine={false} tickLine={false}/>
                    <YAxis hide domain={[0,100]}/><Tooltip content={<Tip/>}/>
                    <Bar dataKey="avg" name="Avg Score" fill={T.sky} radius={[4,4,0,0]} barSize={14}/>
                    <Line dataKey="pass" name="Pass Rate" stroke={T.emerald} strokeWidth={2.5} dot={{fill:T.emerald,r:3}}/>
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </Panel>
          </div>
        </div>

        {/* ═══ TESTS ════════════════════════════════════════ */}
        <div ref={setSectionRef('tests')} className="dash-section">
          <SectionHeader icon="📝" title="Test & Performance Analytics"/>
          <div className="grid-kpi" style={{marginBottom:16}}>
            <KPI icon="📝" label="Exam Dates" value={data.totalTests} color={T.violet}/>
            <KPI icon="👥" label="Total Entries" value={data.totalTestEntries} color={T.sky}/>
            <KPI icon="📊" label="Avg Score" value={data.avgTestScore} color={T.emerald} sub={`${data.avgTestScore}%`}/>
            <KPI icon="📉" label="At Risk" value={data.atRiskStudents.length} color={T.rose} sub="Below 40%"/>
          </div>
          <div className="grid-split" style={{marginBottom:14}}>
            <Panel title="Monthly Avg Score Trend">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data.testTrend}>
                  <defs><linearGradient id="testGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.violet} stopOpacity={0.2}/><stop offset="95%" stopColor={T.violet} stopOpacity={0}/></linearGradient></defs>
                  <XAxis dataKey="month" tick={{fill:T.inkSub,fontSize:11}} axisLine={false} tickLine={false}/>
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
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:11,color:T.inkSub}}>{b.batch}</span><span style={{fontSize:11,fontWeight:700,color:b.color}}>{b.avg}%</span></div>
                    <ProgressBar value={b.avg} max={100} color={b.color} height={5}/>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
          <div className="grid-cols2">
            <Panel title="🏆 Top Performers">
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {data.topPerformers.map((s,i)=>(
                  <div key={s.name+i} style={{padding:"9px 12px",borderRadius:10,background:i===0?`${T.gold}10`:T.bgInset,border:`1px solid ${i===0?T.gold+"30":T.border}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:12,fontWeight:800,color:[T.gold,T.inkSub,T.amber,T.sky,T.sky,T.inkSub,T.inkSub,T.inkSub][i]}}>#{i+1} {s.name}</span>
                      <span style={{fontSize:13,fontWeight:900,color:s.avg>=80?T.emerald:s.avg>=60?T.amber:T.rose}}>{s.avg}%</span>
                    </div>
                    <ProgressBar value={s.avg} max={100} color={s.avg>=80?T.emerald:s.avg>=60?T.amber:T.rose} height={4}/>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="⚠️ At-Risk Students" accent={T.rose}>
              {data.atRiskStudents.length===0?<div style={{color:T.emerald,fontSize:13,fontWeight:600,marginTop:8}}>✅ No at-risk students!</div>:(
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {data.atRiskStudents.slice(0,8).map((s,i)=>(
                    <div key={s.name+i} style={{padding:"8px 11px",borderRadius:10,background:`${T.rose}07`,border:`1px solid ${T.rose}18`}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                        <span style={{fontSize:12,fontWeight:700,color:T.ink}}>{s.name}</span>
                        <span style={{fontSize:12,fontWeight:900,color:T.rose}}>{s.max>0?pct(s.total,s.max):0}%</span>
                      </div>
                      {s.batch&&<Badge label={s.batch} color={T.slate}/>}
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </div>

        {/* ═══ ENQUIRY ══════════════════════════════════════ */}
        <div ref={setSectionRef('enquiry')} className="dash-section">
          <SectionHeader icon="🔍" title="Enquiry & Lead Management"/>
          <div className="grid-kpi" style={{marginBottom:16}}>
            <KPI icon="📞" label="Total" value={data.totalEnquiries} color={T.sky} sub="From admissions"/>
            <KPI icon="🔓" label="Open" value={data.openEnquiries} color={T.amber}/>
            <KPI icon="✅" label="Enrolled" value={data.convertedEnq} color={T.emerald}/>
            <KPI icon="📊" label="Conv. Rate" value={data.conversionRate} color={T.violet} sub={`${data.conversionRate}%`}/>
          </div>
          <div className="grid-split" style={{marginBottom:14}}>
            <Panel title="Monthly Applications vs Enrollments">
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={data.enqTrend}>
                  <XAxis dataKey="month" tick={{fill:T.inkSub,fontSize:11}} axisLine={false} tickLine={false}/>
                  <YAxis hide/><Tooltip content={<Tip/>}/>
                  <Bar dataKey="enquiries" name="Applications" fill={T.sky} radius={[4,4,0,0]} barSize={16}/>
                  <Bar dataKey="converted" name="Enrolled" fill={T.emerald} radius={[4,4,0,0]} barSize={16}/>
                </ComposedChart>
              </ResponsiveContainer>
            </Panel>
            <Panel title="Course Interest">
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {data.enqByCourse.slice(0,7).map(c=>(
                  <div key={c.name}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:12,color:T.inkSub}}>{c.name}</span><span style={{fontSize:12,fontWeight:700,color:c.color}}>{c.count}</span></div>
                    <ProgressBar value={c.count} max={data.enqByCourse[0]?.count||1} color={c.color} height={5}/>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
          <Panel title="Recent Applications">
            <TableWrap>
              <table style={{width:"100%",borderCollapse:"separate",borderSpacing:"0 5px",minWidth:480}}>
                <thead><tr>{["Name","Course","Source","Status","Date"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>{data.recentEnquiries.map((e,i)=>(
                  <tr key={i}>
                    <td style={tdFirst}>{e.name||"—"}</td>
                    <td style={td()}>{e.course_interest||"—"}</td>
                    <td style={td()}>{e.source||"—"}</td>
                    <td style={td()}><Badge label={e.status||"—"} color={statusColor(e.status)}/></td>
                    <td style={{...tdLast,fontSize:12,color:T.inkSub}}>{e.follow_up_date||"—"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </TableWrap>
          </Panel>
        </div>

        {/* ═══ HOSTEL ════════════════════════════════════════ */}
        <div ref={setSectionRef('hostel')} className="dash-section">
          <SectionHeader icon="🛏️" title="Hostel & Boarding"/>
          <div className="grid-kpi" style={{marginBottom:16}}>
            <KPI icon="🏠" label="Boarders" value={data.boarders} color={T.sky}/>
            <KPI icon="🛏️" label="Rooms Total" value={data.hostelTotalRooms} color={T.amber}/>
            <KPI icon="✅" label="Occupied" value={data.hostelOccupied} color={T.emerald} progress={data.hostelOccupied} progressMax={data.hostelTotalRooms}/>
            <KPI icon="📋" label="Incidents" value={data.hostelIncidentChart.reduce((s,m)=>s+m.count,0)} color={T.rose}/>
          </div>
          <div className="grid-cols2">
            <Panel title="Block Occupancy">
              {data.hostelRooms.length===0?<EmptyState msg="No hostel_rooms data"/>:(
                <div style={{display:"flex",flexDirection:"column",gap:11}}>
                  {data.hostelRooms.map(b=>(
                    <div key={b.block}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:13,fontWeight:700,color:T.ink}}>{b.block}</span><span style={{fontSize:13,fontWeight:800,color:b.color}}>{b.occupied}/{b.total}</span></div>
                      <ProgressBar value={b.occupied} max={b.total||1} color={b.color} height={8}/>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
            <Panel title="Mess Consumption">
              {data.messChartData.every(m=>m.breakfast===0)?<EmptyState msg="No mess_consumption data"/>:(
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.messChartData}>
                    <XAxis dataKey="month" tick={{fill:T.inkSub,fontSize:10}} axisLine={false} tickLine={false}/>
                    <YAxis hide/><Tooltip content={<Tip/>}/><Legend formatter={v=><span style={{color:T.inkSub,fontSize:10}}>{v}</span>}/>
                    <Bar dataKey="breakfast" name="Breakfast" fill={T.amber} radius={[3,3,0,0]} barSize={8}/>
                    <Bar dataKey="lunch" name="Lunch" fill={T.emerald} radius={[3,3,0,0]} barSize={8}/>
                    <Bar dataKey="dinner" name="Dinner" fill={T.violet} radius={[3,3,0,0]} barSize={8}/>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Panel>
          </div>
        </div>

        {/* ═══ HOUSES ════════════════════════════════════════ */}
        <div ref={setSectionRef('houses')} className="dash-section">
          <SectionHeader icon="🏆" title="Houses & Co-curricular"/>
          <div className="grid-kpi" style={{marginBottom:16}}>
            {data.housePoints.map((h,i)=>(
              <div key={h.name} style={{background:`${h.color}08`,border:`1px solid ${h.color}25`,borderRadius:14,padding:"14px 16px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}><span style={{fontSize:17,fontWeight:900,color:h.color}}>#{i+1}</span><Badge label={h.name} color={h.color}/></div>
                <div style={{fontSize:22,fontWeight:900,color:T.ink,marginBottom:3}}><Counter value={h.points}/></div>
                <div style={{fontSize:10,color:T.inkSub,marginBottom:7}}>Total points</div>
                <ProgressBar value={h.points} max={data.housePoints[0]?.points||1} color={h.color} height={5}/>
              </div>
            ))}
          </div>
          {data.housePoints.every(h=>h.points===0)&&<Panel><EmptyState msg="No house_points data yet."/></Panel>}
        </div>

        {/* ═══ OPERATIONS ════════════════════════════════════ */}
        <div ref={setSectionRef('operations')} className="dash-section">
          <SectionHeader icon="⚙️" title="Operations & Admin"/>
          <div className="grid-kpi" style={{marginBottom:16}}>
            <KPI icon="📋" label="Total Tasks" value={data.taskPending+data.taskDone+data.taskOverdue} color={T.sky}/>
            <KPI icon="✅" label="Completed" value={data.taskDone} color={T.emerald} progress={data.taskDone} progressMax={data.taskPending+data.taskDone+data.taskOverdue}/>
            <KPI icon="⏳" label="Pending" value={data.taskPending} color={T.amber}/>
            <KPI icon="🚨" label="Overdue" value={data.taskOverdue} color={T.rose}/>
          </div>
          <div className="grid-cols3">
            <Panel title="Task Status">
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:14}}>
                <Gauge value={data.taskPending+data.taskDone>0?pct(data.taskDone,data.taskPending+data.taskDone):0} color={T.emerald} size={84}/>
                <div style={{width:"100%"}}>
                  {[{l:"Done",v:data.taskDone,c:T.emerald},{l:"Pending",v:data.taskPending,c:T.amber},{l:"Overdue",v:data.taskOverdue,c:T.rose}].map(x=>(
                    <div key={x.l} style={{marginBottom:7}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:12,color:T.inkSub}}>{x.l}</span><span style={{fontSize:12,fontWeight:700,color:x.c}}>{x.v}</span></div>
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
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:12,color:T.inkSub}}>{s.dept}</span><span style={{fontSize:12,fontWeight:700,color:s.breaches>0?T.rose:T.emerald}}>{s.breaches}/{s.total}</span></div>
                      <ProgressBar value={s.breaches} max={s.total||1} color={s.breaches>0?T.rose:T.emerald} height={6}/>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
            <Panel title="⚡ Quick Actions">
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {[{l:"➕ Add Student",c:T.sky},{l:"💰 Record Payment",c:T.gold},{l:"📋 New Admission",c:T.violet},{l:"✅ Mark Attendance",c:T.emerald},{l:"📤 Export Reports",c:T.amber},{l:"📧 Send Reminders",c:T.rose}].map(a=>(
                  <button key={a.l} style={{width:"100%",padding:"8px 12px",borderRadius:9,border:`1px solid ${a.c}25`,background:`${a.c}08`,color:a.c,fontSize:12,fontWeight:700,cursor:"pointer",textAlign:"left",fontFamily:"inherit"}}>{a.l}</button>
                ))}
              </div>
            </Panel>
          </div>
        </div>

        {/* ═══ BATCHES ════════════════════════════════════════ */}
        <div ref={setSectionRef('batches')} className="dash-section">
          <SectionHeader icon="🗂️" title="Batches & Timetable"/>
          <div className="grid-kpi" style={{marginBottom:16}}>
            <KPI icon="🗂️" label="Total Batches" value={data.totalBatches} color={T.indigo}/>
            <KPI icon="✅" label="Active" value={data.activeBatches} color={T.emerald}/>
            <KPI icon="👥" label="Total Strength" value={data.totalStrength} color={T.sky} sub={`Cap: ${data.totalCapacity}`}/>
            <KPI icon="📊" label="Fill Rate" value={data.batchFillRate} color={data.batchFillRate>=80?T.emerald:T.amber} sub={`${data.batchFillRate}%`}/>
          </div>
          {data.batchesData.length===0?(
            <Panel><EmptyState msg="No data in batches table yet."/></Panel>
          ):(
            <Panel title="All Batches">
              <TableWrap>
                <table style={{width:"100%",borderCollapse:"separate",borderSpacing:"0 5px",minWidth:480}}>
                <thead><tr>{["Batch","Course","Subtype","Class","Hostel"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
<tbody>{data.batchesData.map((b,i)=>(
  <tr key={i}>
    <td style={tdFirst}>{b.batch_name||"—"}</td>
    <td style={td()}>{b.course||"—"}</td>
    <td style={td()}>{b.subtype||"—"}</td>
    <td style={td()}>{b.class_name||"—"}</td>
    <td style={tdLast}>{b.hostel_type||"—"}</td>
  </tr>
))}</tbody>
                </table>
              </TableWrap>
            </Panel>
          )}
        </div>

        {/* ═══ SIMPLE EMPTY SECTIONS ════════════════════════ */}
        {[
          {id:"doubts",   icon:"💬", title:"Doubt & Query Management",      msg:"No data in doubt_sessions table yet."},
          {id:"parents",  icon:"👨‍👩‍👧", title:"Parent Communication",           msg:"No data in sms_logs table yet."},
          {id:"material", icon:"📦", title:"Study Material Management",     msg:"No data in study_material table yet."},
        ].map(s=>(
          <div key={s.id} ref={setSectionRef(s.id)} className="dash-section">
            <SectionHeader icon={s.icon} title={s.title}/>
            <Panel><EmptyState msg={s.msg}/></Panel>
          </div>
        ))}

        {/* ═══ RESULTS ════════════════════════════════════════ */}
        <div ref={setSectionRef('results')} className="dash-section">
          <SectionHeader icon="🏅" title="Results & Selections"/>
          <div className="grid-kpi" style={{marginBottom:16}}>
            <KPI icon="🏅" label="Total" value={data.totalSelections} color={T.gold}/>
            <KPI icon="🏫" label="JNV Navodaya" value={data.jnvSelections} color={T.emerald}/>
            <KPI icon="⚔️" label="Sainik School" value={data.sainikSelections} color={T.sky}/>
            <KPI icon="🎓" label="Other" value={data.otherSelections} color={T.violet}/>
          </div>
          {data.totalSelections===0?<Panel><EmptyState msg="No data in selections table yet."/></Panel>:(
            <Panel title="Recent Selections">
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {data.recentSelections.map((s,i)=>(
                  <div key={i} style={{padding:"9px 12px",borderRadius:10,background:`${T.gold}07`,border:`1px solid ${T.gold}20`}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                      <span style={{fontSize:12,fontWeight:800,color:T.ink}}>{s.student_name||"—"}</span>
                      {s.rank&&<span style={{fontSize:11,fontWeight:700,color:T.gold}}>Rank #{s.rank}</span>}
                    </div>
                    <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                      {s.exam_name&&<Badge label={s.exam_name} color={T.emerald}/>}
                      {s.year&&<Badge label={s.year} color={T.sky}/>}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>

        {/* ═══ TEACHING ═══════════════════════════════════════ */}
        <div ref={setSectionRef('teaching')} className="dash-section">
          <SectionHeader icon="🖊️" title="Staff Teaching Analytics"/>
          <div className="grid-kpi" style={{marginBottom:16}}>
            <KPI icon="📚" label="Topics Total" value={data.totalTopics} color={T.sky}/>
            <KPI icon="✅" label="Covered" value={data.coveredTopics} color={T.emerald} progress={data.coveredTopics} progressMax={data.totalTopics}/>
            <KPI icon="📊" label="Coverage" value={data.overallCoverage} color={data.overallCoverage>=80?T.emerald:data.overallCoverage>=60?T.amber:T.rose} sub={`${data.overallCoverage}%`}/>
          </div>
          <Panel title="🔥 Teacher Accountability Tracker" sub="Streak · Missing days · Late submissions · Avg word count" style={{marginBottom:14}}>
            {(data.teacherStreaks||[]).length===0?<EmptyState msg="No teaching logs yet"/>:(
              <TableWrap>
                <table style={{width:"100%",borderCollapse:"separate",borderSpacing:"0 5px",minWidth:560}}>
                  <thead><tr>{["Teacher","Streak","Logs","Missing","Late","Avg Wds","Status"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
                  <tbody>{(data.teacherStreaks||[]).map((t,i)=>{
                    const status=t.missingDays===0&&t.lateCount===0?"Excellent":t.missingDays<=2&&t.lateCount<=1?"Good":t.missingDays<=5?"Warning":"At Risk"
                    const statusCol={Excellent:T.emerald,Good:T.sky,Warning:T.amber,"At Risk":T.rose}[status]
                    return(
                      <tr key={t.name}>
                        <td style={tdFirst}>{t.name}</td>
                        <td style={td()}><span style={{fontSize:13,fontWeight:900,color:t.streak>=7?T.emerald:t.streak>=3?T.amber:T.rose}}>🔥 {t.streak}d</span></td>
                        <td style={td({fontWeight:700})}>{t.totalLogs}</td>
                        <td style={td({color:t.missingDays===0?T.emerald:t.missingDays<=2?T.amber:T.rose,fontWeight:700})}>{t.missingDays}</td>
                        <td style={td({color:t.lateCount===0?T.emerald:t.lateCount<=2?T.amber:T.rose,fontWeight:700})}>{t.lateCount}</td>
                        <td style={td({color:t.avgWc>=100?T.emerald:t.avgWc>=50?T.amber:T.rose,fontWeight:700})}>{t.avgWc}</td>
                        <td style={tdLast}><Badge label={status} color={statusCol}/></td>
                      </tr>
                    )
                  })}</tbody>
                </table>
              </TableWrap>
            )}
          </Panel>
          {data.totalTopics>0&&(
            <Panel title="Teacher Coverage">
              <TableWrap>
                <table style={{width:"100%",borderCollapse:"separate",borderSpacing:"0 5px",minWidth:440}}>
                  <thead><tr>{["Teacher","Subjs","Covered","Coverage","Status"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
                  <tbody>{data.teacherCoverage.map((t,i)=>(
                    <tr key={t.name}>
                      <td style={tdFirst}>{t.name}</td>
                      <td style={td()}>{t.subjects}</td>
                      <td style={td()}>{t.covered}/{t.total}</td>
                      <td style={{...td(),minWidth:130}}>
                        <div style={{display:"flex",alignItems:"center",gap:7}}>
                          <div style={{flex:1}}><ProgressBar value={t.pct} max={100} color={t.pct>=80?T.emerald:t.pct>=60?T.amber:T.rose} height={6}/></div>
                          <span style={{fontSize:11,fontWeight:800,color:t.pct>=80?T.emerald:t.pct>=60?T.amber:T.rose}}>{t.pct}%</span>
                        </div>
                      </td>
                      <td style={tdLast}><Badge label={t.pct>=80?"On Track":t.pct>=60?"Behind":"At Risk"} color={t.pct>=80?T.emerald:t.pct>=60?T.amber:T.rose}/></td>
                    </tr>
                  ))}</tbody>
                </table>
              </TableWrap>
            </Panel>
          )}
        </div>

        {/* ═══ FEE SETUP ══════════════════════════════════════ */}
        <div ref={setSectionRef('feesetup')} className="dash-section">
          <SectionHeader icon="💳" title="Fee Setup & Structure"/>
          <div className="grid-kpi" style={{marginBottom:16}}>
            <KPI icon="📋" label="Fee Structures" value={data.totalFeeStructures} color={T.sky} sub={`${data.activeSessionStructures.length} this session`}/>
            <KPI icon="💰" label="Flat Fee Collected" value={data.flatFeePaid_fs} isMoney color={T.emerald}/>
            <KPI icon="📄" label="Flat Fee Total" value={data.flatFeeTotal_fs} isMoney color={T.gold}/>
            <KPI icon="📚" label="Course Fee Paid" value={data.courseFeeTotal_fs} isMoney color={T.violet}/>
            <KPI icon="✏️" label="Overrides" value={data.totalOverrides} color={T.amber}/>
          </div>
          <div className="grid-cols2" style={{marginBottom:14}}>
            <Panel title={`Fee Structure by Course — AY ${CURRENT_YEAR}–${CURRENT_YEAR+1}`}>
              {data.feeStructureByCourse.length===0?<EmptyState msg="No fee_structures data yet"/>:(
                <div style={{display:"flex",flexDirection:"column",gap:9}}>
                  {data.feeStructureByCourse.map(c=>(
                    <div key={c.course} style={{padding:"9px 12px",borderRadius:10,background:T.bgInset,border:`1px solid ${T.border}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:12,fontWeight:700,color:T.ink}}>{c.course}</span><Badge label={`${c.count} rows`} color={c.color}/></div>
                      <div style={{display:"flex",gap:14,fontSize:11,color:T.inkSub}}>
                        <span>Flat: <b style={{color:T.sky}}>{fmt(c.avgFlat)}</b></span>
                        <span>Course: <b style={{color:T.violet}}>{fmt(c.avgCourse)}</b></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
            <Panel title="Hostel Type Fee Breakdown">
              {data.hostelBreakdown_fs.every(h=>h.avgFlat===0)?<EmptyState msg="No fee structures for current session"/>:(
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {data.hostelBreakdown_fs.map(h=>(
                    <div key={h.hostel}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:12,color:T.inkSub}}>{h.hostel}</span><span style={{fontSize:13,fontWeight:800,color:h.color}}>{fmt(h.avgFlat)} avg</span></div>
                      <ProgressBar value={h.avgFlat} max={data.hostelBreakdown_fs.reduce((mx,x)=>Math.max(mx,x.avgFlat),1)} color={h.color} height={7}/>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
          <Panel title="Monthly Flat Fee Collection Trend">
            {data.flatFeeTrend.every(m=>m.amount===0)?<EmptyState msg="No adm_flat_fees data yet"/>:(
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={data.flatFeeTrend}>
                  <defs><linearGradient id="ffGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.gold} stopOpacity={0.2}/><stop offset="95%" stopColor={T.gold} stopOpacity={0}/></linearGradient></defs>
                  <XAxis dataKey="month" tick={{fill:T.inkSub,fontSize:11}} axisLine={false} tickLine={false}/>
                  <YAxis hide/><Tooltip content={<Tip/>}/>
                  <Area dataKey="amount" name="Flat Fee" stroke={T.gold} strokeWidth={2.5} fill="url(#ffGrad)"/>
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Panel>
        </div>

        {/* ═══ FEE LEDGER ══════════════════════════════════════ */}
        <div ref={setSectionRef('feeledger')} className="dash-section">
          <SectionHeader icon="📒" title="Student Fee Ledger"/>
          <div className="grid-kpi" style={{marginBottom:16}}>
            <KPI icon="💰" label="Flat Fee Total" value={data.flatFeeTotal_fs} isMoney color={T.gold}/>
            <KPI icon="✅" label="Flat Fee Paid" value={data.flatFeePaid_fs} isMoney color={T.emerald} progress={data.flatFeePaid_fs} progressMax={data.flatFeeTotal_fs}/>
            <KPI icon="📚" label="Course Fee Paid" value={data.courseFeeTotal_fs} isMoney color={T.violet}/>
            <KPI icon="✏️" label="Fee Overrides" value={data.totalOverrides} color={T.amber}/>
          </div>
          <div className="grid-cols2">
            <Panel title="Flat Fee Collection Status">
              <div style={{display:"flex",alignItems:"center",gap:14,padding:"6px 0"}}>
                <Gauge value={data.flatFeeTotal_fs>0?pct(data.flatFeePaid_fs,data.flatFeeTotal_fs):0} color={T.emerald} size={84}/>
                <div style={{flex:1}}>
                  {[{l:"Paid",v:data.flatFeePaid_fs,c:T.emerald},{l:"Outstanding",v:data.flatFeeTotal_fs-data.flatFeePaid_fs,c:T.rose}].map(x=>(
                    <div key={x.l} style={{marginBottom:8}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:11,color:T.inkSub}}>{x.l}</span><span style={{fontSize:12,fontWeight:700,color:x.c}}>{fmt(x.v)}</span></div>
                      <ProgressBar value={x.v} max={data.flatFeeTotal_fs||1} color={x.c}/>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
            <Panel title="Fee Overrides / Custom Rates">
              {data.totalOverrides===0?<div style={{color:T.emerald,fontSize:13,fontWeight:600,marginTop:8}}>✅ No student overrides set</div>:(
                <div style={{textAlign:"center",padding:"20px 0"}}>
                  <div style={{fontSize:32,fontWeight:900,color:T.amber}}>{data.totalOverrides}</div>
                  <div style={{fontSize:11,color:T.inkSub,marginTop:4}}>overrides active in fee_structures</div>
                </div>
              )}
            </Panel>
          </div>
        </div>

        {/* ═══ ENTRANCE ════════════════════════════════════════ */}
        <div ref={setSectionRef('entrance')} className="dash-section">
          <SectionHeader icon="🏆" title="Entrance Exam Management"/>
          <div className="grid-kpi" style={{marginBottom:16}}>
            <KPI icon="📝" label="Total Exams" value={data.totalEntranceExams} color={T.sky}/>
            <KPI icon="✅" label="Completed" value={data.completedExams} color={T.emerald}/>
            <KPI icon="📅" label="Scheduled" value={data.scheduledExams} color={T.amber}/>
            <KPI icon="👥" label="Candidates" value={data.totalEntranceCandidates} color={T.violet}/>
            <KPI icon="🎯" label="Appeared" value={data.appearedCandidates} color={T.sky} progress={data.appearedCandidates} progressMax={data.totalEntranceCandidates}/>
            <KPI icon="✅" label="Pass Rate" value={data.entrancePassRate} color={data.entrancePassRate>=60?T.emerald:T.rose} sub={`${data.passedCandidates} passed`}/>
            <KPI icon="🎓" label="Admitted" value={data.admittedFromEntrance} color={T.gold}/>
          </div>
          {data.totalEntranceExams===0?<Panel><EmptyState msg="No data in entrance_exams table yet."/></Panel>:(
            <>
              <div className="grid-cols2" style={{marginBottom:14}}>
                <Panel title="Exams by Type">
                  {data.entranceByType.length===0?<EmptyState msg="No exam type data"/>:(
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {data.entranceByType.map(t=>(
                        <div key={t.type}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:12,color:T.inkSub}}>{t.type}</span><span style={{fontSize:13,fontWeight:800,color:t.color}}>{t.completed}/{t.total}</span></div><ProgressBar value={t.completed} max={t.total||1} color={t.color} height={6}/></div>
                      ))}
                    </div>
                  )}
                </Panel>
                <Panel title="Candidate Status">
                  {data.candidatesByStatus.length===0?<EmptyState msg="No candidate data"/>:(
                    <div style={{display:"flex",flexDirection:"column",gap:7}}>
                      {data.candidatesByStatus.map(s=>(
                        <div key={s.status}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:12,color:T.inkSub}}>{s.status}</span><span style={{fontSize:12,fontWeight:700,color:s.color}}>{s.count}</span></div><ProgressBar value={s.count} max={data.totalEntranceCandidates||1} color={s.color} height={5}/></div>
                      ))}
                    </div>
                  )}
                </Panel>
              </div>
              <Panel title="Recent Entrance Exams">
                <TableWrap>
                  <table style={{width:"100%",borderCollapse:"separate",borderSpacing:"0 5px",minWidth:440}}>
                    <thead><tr>{["Exam Type","Date","Seats","Venue","Status"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
                    <tbody>{data.recentEntranceExams.map((e,i)=>(
                      <tr key={i}>
                        <td style={tdFirst}>{e.exam_type||"—"}</td>
                        <td style={td()}>{e.exam_date?.slice(0,10)||"—"}</td>
                        <td style={td()}>{e.total_seats||"—"}</td>
                        <td style={td()}>{e.venue?.slice(0,20)||"—"}</td>
                        <td style={tdLast}><Badge label={e.status||"—"} color={statusColor(e.status||"—")}/></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </TableWrap>
              </Panel>
            </>
          )}
        </div>

        {/* ═══ STUDY LOCKERS ═══════════════════════════════════ */}
        <div ref={setSectionRef('lockers')} className="dash-section">
          <SectionHeader icon="🗃️" title="Study Lockers"/>
          <div className="grid-kpi" style={{marginBottom:16}}>
            <KPI icon="🗃️" label="Total Lockers" value={data.totalLockers} color={T.sky}/>
            <KPI icon="📦" label="Total Materials" value={data.totalLockerMaterials} color={T.violet}/>
            <KPI icon="📚" label="Courses" value={data.lockersByCourse.length} color={T.amber}/>
          </div>
          {data.totalLockers===0?<Panel><EmptyState msg="No study_lockers data yet."/></Panel>:(
            <div className="grid-cols3">
              <Panel title="By Course">
                <div style={{display:"flex",flexDirection:"column",gap:7}}>
                  {data.lockersByCourse.map(c=>(<div key={c.course}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:12,color:T.inkSub}}>{c.course}</span><span style={{fontSize:12,fontWeight:700,color:c.color}}>{c.count}</span></div><ProgressBar value={c.count} max={data.totalLockers||1} color={c.color} height={5}/></div>))}
                </div>
              </Panel>
              <Panel title="Material Types">
                {data.lockerMatByType.length===0?<EmptyState msg="No materials uploaded yet"/>:(
                  <div style={{display:"flex",flexDirection:"column",gap:7}}>
                    {data.lockerMatByType.map(m=>(<div key={m.type}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:12,color:T.inkSub}}>{m.type}</span><span style={{fontSize:12,fontWeight:700,color:m.color}}>{m.count}</span></div><ProgressBar value={m.count} max={data.totalLockerMaterials||1} color={m.color} height={5}/></div>))}
                  </div>
                )}
              </Panel>
              <Panel title="Top Teachers">
                {data.lockersByTeacher.length===0?<EmptyState msg="No teacher data"/>:(
                  <div style={{display:"flex",flexDirection:"column",gap:7}}>
                    {data.lockersByTeacher.map((t,i)=>(
                      <div key={t.name} style={{display:"flex",alignItems:"center",gap:9,padding:"6px 0",borderBottom:`1px solid ${T.border}`}}>
                        <span style={{fontSize:12,fontWeight:900,color:i===0?T.gold:T.inkSub}}>#{i+1}</span>
                        <span style={{flex:1,fontSize:12,fontWeight:700,color:T.ink}}>{t.name}</span>
                        <span style={{fontSize:12,fontWeight:800,color:t.color}}>{t.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            </div>
          )}
        </div>

        {/* ═══ SYLLABUS ════════════════════════════════════════ */}
        <div ref={setSectionRef('syllabus')} className="dash-section">
          <SectionHeader icon="📐" title="Syllabus Manager"/>
          <div className="grid-kpi" style={{marginBottom:16}}>
            <KPI icon="📐" label="Total Topics" value={data.totalSyllabusTopics} color={T.sky}/>
            <KPI icon="✅" label="Completed" value={data.completedTopics_st} color={T.emerald} progress={data.completedTopics_st} progressMax={data.totalSyllabusTopics}/>
            <KPI icon="🔄" label="In Progress" value={data.inProgressTopics} color={T.amber}/>
            <KPI icon="⏳" label="Pending" value={data.pendingTopics_st} color={T.rose}/>
            <KPI icon="📊" label="Overall" value={data.syllabusOverallPct} color={data.syllabusOverallPct>=80?T.emerald:data.syllabusOverallPct>=60?T.amber:T.rose} sub={`${data.syllabusOverallPct}%`}/>
          </div>
          {data.totalSyllabusTopics===0?<Panel><EmptyState msg="No data in syllabus_topics table yet."/></Panel>:(
            <>
              <div className="grid-cols2" style={{marginBottom:14}}>
                <Panel title="Completion by Course">
                  <div style={{display:"flex",flexDirection:"column",gap:9}}>
                    {data.syllabusByCourse.map(c=>(<div key={c.course}><div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}><span style={{fontSize:12,color:T.inkSub}}>{c.course}</span><span style={{fontSize:13,fontWeight:800,color:c.pct>=80?T.emerald:c.pct>=60?T.amber:T.rose}}>{c.pct}%</span></div><ProgressBar value={c.pct} max={100} color={c.pct>=80?T.emerald:c.pct>=60?T.amber:T.rose} height={7}/><div style={{fontSize:10,color:T.inkSub,marginTop:2}}>{c.completed}/{c.total} topics</div></div>))}
                  </div>
                </Panel>
                <Panel title="Completion by Subject">
                  <div style={{display:"flex",flexDirection:"column",gap:7}}>
                    {data.syllabusBySubject.map(s=>(<div key={s.subject}><div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}><span style={{fontSize:11,color:T.inkSub}}>{s.subject.slice(0,16)}</span><span style={{fontSize:12,fontWeight:700,color:s.color}}>{s.pct}%</span></div><ProgressBar value={s.pct} max={100} color={s.color} height={4}/></div>))}
                  </div>
                </Panel>
              </div>
              {/* FIX #7: header now correctly says "Subject", data grouped by subject_name */}
              <Panel title="Subject-wise Syllabus Progress">
                <TableWrap>
                  <table style={{width:"100%",borderCollapse:"separate",borderSpacing:"0 5px",minWidth:440}}>
                    <thead><tr>{["Subject","Total","Done","Progress","Status"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
                    <tbody>{data.syllabusTopicsBySubject.map((t,i)=>(
                      <tr key={i}>
                        <td style={tdFirst}>{t.name||"—"}</td>
                        <td style={td()}>{t.total}</td>
                        <td style={td({color:T.emerald,fontWeight:700})}>{t.completed}</td>
                        <td style={{...td(),minWidth:130}}>
                          <div style={{display:"flex",alignItems:"center",gap:7}}>
                            <div style={{flex:1}}><ProgressBar value={t.pct} max={100} color={t.pct>=80?T.emerald:t.pct>=60?T.amber:T.rose} height={5}/></div>
                            <span style={{fontSize:11,fontWeight:800,color:t.pct>=80?T.emerald:t.pct>=60?T.amber:T.rose}}>{t.pct}%</span>
                          </div>
                        </td>
                        <td style={tdLast}><Badge label={t.pct>=80?"On Track":t.pct>=60?"Behind":"At Risk"} color={t.pct>=80?T.emerald:t.pct>=60?T.amber:T.rose}/></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </TableWrap>
              </Panel>
            </>
          )}
        </div>

        {/* ═══ QUESTION BANK ════════════════════════════════════ */}
        <div ref={setSectionRef('qbank')} className="dash-section">
          <SectionHeader icon="❓" title="Question Bank"/>
          <div className="grid-kpi" style={{marginBottom:16}}>
            <KPI icon="❓" label="Total Questions" value={data.totalQBankQuestions} color={T.sky}/>
            <KPI icon="✅" label="Easy" value={data.qbankByDifficulty[0]?.count||0} color={T.emerald}/>
            <KPI icon="⚡" label="Medium" value={data.qbankByDifficulty[1]?.count||0} color={T.amber}/>
            <KPI icon="🔥" label="Hard" value={data.qbankByDifficulty[2]?.count||0} color={T.rose}/>
          </div>
          {data.totalQBankQuestions===0?<Panel><EmptyState msg="No data in qbank_questions yet."/></Panel>:(
            <>
              <div className="grid-cols3" style={{marginBottom:14}}>
                <Panel title="By Course">
                  <div style={{display:"flex",flexDirection:"column",gap:7}}>
                    {data.qbankByCourse.map(c=>(<div key={c.course}><div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}><span style={{fontSize:12,color:T.inkSub}}>{c.course}</span><span style={{fontSize:12,fontWeight:700,color:c.color}}>{c.count}</span></div><ProgressBar value={c.count} max={data.totalQBankQuestions||1} color={c.color} height={5}/></div>))}
                  </div>
                </Panel>
                <Panel title="By Difficulty">
                  <div style={{display:"flex",flexDirection:"column",gap:10,paddingTop:4}}>
                    {data.qbankByDifficulty.map(d=>(<div key={d.difficulty}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:13,fontWeight:700,color:T.ink}}>{d.difficulty}</span><span style={{fontSize:14,fontWeight:900,color:d.color}}>{d.count}</span></div><ProgressBar value={d.count} max={data.totalQBankQuestions||1} color={d.color} height={8}/></div>))}
                  </div>
                </Panel>
                <Panel title="By Question Type">
                  <div style={{display:"flex",flexDirection:"column",gap:7}}>
                    {data.qbankByType.map(t=>(<div key={t.type}><div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}><span style={{fontSize:12,color:T.inkSub}}>{t.type}</span><span style={{fontSize:12,fontWeight:700,color:t.color}}>{t.count}</span></div><ProgressBar value={t.count} max={data.totalQBankQuestions||1} color={t.color} height={5}/></div>))}
                  </div>
                </Panel>
              </div>
              <Panel title="Questions Added Monthly">
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={data.qbankTrend}>
                    <XAxis dataKey="month" tick={{fill:T.inkSub,fontSize:11}} axisLine={false} tickLine={false}/>
                    <YAxis hide/><Tooltip content={<Tip/>}/>
                    <Bar dataKey="count" name="Questions" fill={T.violet} radius={[4,4,0,0]} barSize={18}/>
                  </BarChart>
                </ResponsiveContainer>
              </Panel>
            </>
          )}
        </div>

        {/* ═══ SOCIAL ═══════════════════════════════════════════ */}
        <div ref={setSectionRef('social')} className="dash-section">
          <SectionHeader icon="📣" title="Social & Marketing"/>
          <div className="grid-kpi" style={{marginBottom:16}}>
            <KPI icon="📣" label="Campaigns" value={data.totalCampaigns} color={T.sky} sub={`${data.activeCampaigns} active`}/>
            <KPI icon="👥" label="Total Leads" value={data.totalSocialLeads} color={T.violet}/>
            <KPI icon="🆕" label="New Leads" value={data.newLeads} color={T.amber}/>
            <KPI icon="✅" label="Converted" value={data.convertedLeads} color={T.emerald} progress={data.convertedLeads} progressMax={data.totalSocialLeads}/>
            <KPI icon="📊" label="Conv. Rate" value={data.socialConvRate} color={data.socialConvRate>=20?T.emerald:T.rose} sub={`${data.socialConvRate}%`}/>
            <KPI icon="⚠️" label="Overdue Follow-ups" value={data.overdueFollowUps} color={T.rose}/>
            <KPI icon="📝" label="Posts" value={data.totalPosts} color={T.sky} sub={`${data.postedCount} posted`}/>
            <KPI icon="💰" label="Budget" value={data.totalBudget} isMoney color={T.gold}/>
          </div>
          {data.totalSocialLeads===0&&data.totalCampaigns===0?<Panel><EmptyState msg="No social data yet."/></Panel>:(
            <>
              <div className="grid-split" style={{marginBottom:14}}>
                <Panel title="Monthly Leads vs Conversions">
                  <ResponsiveContainer width="100%" height={200}>
                    <ComposedChart data={data.socialTrend}>
                      <XAxis dataKey="month" tick={{fill:T.inkSub,fontSize:11}} axisLine={false} tickLine={false}/>
                      <YAxis hide/><Tooltip content={<Tip/>}/>
                      <Bar dataKey="leads" name="Leads" fill={T.sky} radius={[4,4,0,0]} barSize={16}/>
                      <Bar dataKey="converted" name="Converted" fill={T.emerald} radius={[4,4,0,0]} barSize={16}/>
                    </ComposedChart>
                  </ResponsiveContainer>
                </Panel>
                <Panel title="Campaigns by Platform">
                  {data.campaignsByPlatform.length===0?<EmptyState msg="No campaigns"/>:(
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {data.campaignsByPlatform.map(p=>(<div key={p.platform}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:12,color:T.inkSub}}>{p.platform}</span><span style={{fontSize:12,fontWeight:700,color:p.color}}>{p.count}</span></div><ProgressBar value={p.count} max={data.totalCampaigns||1} color={p.color} height={5}/></div>))}
                    </div>
                  )}
                </Panel>
              </div>
              {data.leadsBySource.length>0&&(
                <Panel title="Leads by Source">
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:8}}>
                    {data.leadsBySource.map(s=>(<div key={s.source}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:12,color:T.inkSub}}>{s.source}</span><span style={{fontSize:12,fontWeight:700,color:s.color}}>{s.count}</span></div><ProgressBar value={s.count} max={data.leadsBySource[0]?.count||1} color={s.color} height={5}/></div>))}
                  </div>
                </Panel>
              )}
            </>
          )}
        </div>

        {/* ═══ CONNECT ══════════════════════════════════════════ */}
        <div ref={setSectionRef('connect')} className="dash-section">
          <SectionHeader icon="🔗" title="Connect — Broadcast & Communication"/>
          <div className="grid-kpi" style={{marginBottom:16}}>
            <KPI icon="📡" label="Broadcasts" value={data.totalBroadcasts} color={T.sky} sub={`${data.sentBroadcasts} sent`}/>
            <KPI icon="👥" label="Recipients" value={data.totalRecipients} color={T.violet}/>
            <KPI icon="📩" label="Unread Replies" value={data.unreadReplies} color={data.unreadReplies>0?T.rose:T.emerald}/>
            <KPI icon="📋" label="Grievances" value={data.totalGrievances} color={T.amber} sub={`${data.openGrievances} open`}/>
          </div>
          {data.totalBroadcasts===0?<Panel><EmptyState msg="No data in connect_broadcasts yet."/></Panel>:(
            <div className="grid-cols2" style={{marginBottom:14}}>
              <Panel title="Recent Broadcasts">
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {data.recentBroadcasts.map((b,i)=>(
                    <div key={i} style={{padding:"8px 11px",borderRadius:10,background:T.bgInset,border:`1px solid ${T.border}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:1}}><span style={{fontSize:12,fontWeight:700,color:T.ink}}>{b.title||"—"}</span><Badge label={b.status||"—"} color={statusColor(b.status||"Pending")}/></div>
                      <div style={{fontSize:10,color:T.inkSub}}>{b.channel||"—"} · {b.priority||"Normal"} · {b.created_at?.slice(0,10)||"—"}</div>
                    </div>
                  ))}
                </div>
              </Panel>
              <Panel title="By Channel">
                {data.broadcastsByChannel.length===0?<EmptyState msg="No channel data"/>:(
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {data.broadcastsByChannel.map(c=>(<div key={c.channel}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:12,color:T.inkSub}}>{c.channel}</span><span style={{fontSize:12,fontWeight:700,color:c.color}}>{c.count}</span></div><ProgressBar value={c.count} max={data.totalBroadcasts||1} color={c.color} height={5}/></div>))}
                  </div>
                )}
              </Panel>
            </div>
          )}
          {data.totalGrievances>0&&(
            <Panel title="Grievance Status" accent={data.openGrievances>0?T.amber:T.emerald}>
              <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                {[{l:"Total",v:data.totalGrievances,c:T.sky},{l:"Open",v:data.openGrievances,c:T.rose},{l:"Resolved",v:data.resolvedGrievances,c:T.emerald}].map(x=>(
                  <div key={x.l} style={{flex:1,minWidth:100,textAlign:"center",padding:"12px",background:`${x.c}07`,borderRadius:12,border:`1px solid ${x.c}18`}}>
                    <div style={{fontSize:22,fontWeight:900,color:x.c}}>{x.v}</div>
                    <div style={{fontSize:11,color:T.inkSub,marginTop:3}}>{x.l}</div>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>

        {/* ═══ EXPENSES ═════════════════════════════════════════ */}
        <div ref={setSectionRef('expenses')} className="dash-section">
          <SectionHeader icon="📉" title="Expenses & P&L"/>
          <div className="grid-kpi" style={{marginBottom:16}}>
            <KPI icon="💰" label="Total Income" value={data.totalFeeCollected} isMoney color={T.emerald}/>
            <KPI icon="📉" label="Total Expenses" value={data.totalExpenses} isMoney color={T.rose}/>
            <KPI icon="📊" label="Net P&L" value={data.netPL} isMoney color={data.netPL>=0?T.emerald:T.rose} sub={data.netPL>=0?"Profitable":"Loss"}/>
            <KPI icon="💼" label="Salary Bill" value={data.totalSalaryBill} isMoney color={T.amber}/>
          </div>
          <div className="grid-split" style={{marginBottom:14}}>
            <Panel title="Monthly Income vs Expense vs P&L">
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={data.plTrend}>
                  <XAxis dataKey="month" tick={{fill:T.inkSub,fontSize:11}} axisLine={false} tickLine={false}/>
                  <YAxis hide/><Tooltip content={<Tip/>}/>
                  <Bar dataKey="income" name="Income" fill={T.emerald} radius={[4,4,0,0]} barSize={12}/>
                  <Bar dataKey="expense" name="Expense" fill={T.rose} radius={[4,4,0,0]} barSize={12}/>
                  <Line dataKey="pl" name="Net P&L" stroke={T.gold} strokeWidth={2.5} dot={{fill:T.gold,r:3}}/>
                </ComposedChart>
              </ResponsiveContainer>
            </Panel>
            <Panel title="Expense by Category">
              {data.expenseByCategory.length===0?<EmptyState msg="No expense rows yet"/>:(
                <>
                  <ResponsiveContainer width="100%" height={130}>
                    <PieChart><Pie data={data.expenseByCategory} dataKey="amount" cx="50%" cy="50%" innerRadius={35} outerRadius={54} paddingAngle={4}>
                      {data.expenseByCategory.map((p,i)=><Cell key={i} fill={p.color}/>)}
                    </Pie><Tooltip content={<Tip/>}/></PieChart>
                  </ResponsiveContainer>
                  <div style={{display:"flex",flexDirection:"column",gap:5,marginTop:8}}>
                    {data.expenseByCategory.slice(0,5).map(c=>(
                      <div key={c.name} style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        <div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:6,height:6,borderRadius:2,background:c.color}}/><span style={{fontSize:11,color:T.inkSub}}>{c.name}</span></div>
                        <span style={{fontSize:11,fontWeight:700,color:c.color}}>{fmt(c.amount)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Panel>
          </div>
          <Panel title="P&L Summary" accent={data.netPL>=0?T.emerald:T.rose}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:14,textAlign:"center"}}>
              {[
                {label:"Total Income",value:data.totalFeeCollected,color:T.emerald,icon:"💰"},
                {label:"Total Expenses",value:data.totalExpenses,color:T.rose,icon:"📉"},
                {label:"Net Profit / Loss",value:data.netPL,color:data.netPL>=0?T.emerald:T.rose,icon:data.netPL>=0?"📈":"📉"},
              ].map(x=>(
                <div key={x.label} style={{padding:"14px",borderRadius:12,background:`${x.color}07`,border:`1px solid ${x.color}18`}}>
                  <div style={{fontSize:20,marginBottom:5}}>{x.icon}</div>
                  <div style={{fontSize:18,fontWeight:900,color:x.color,marginBottom:3}}>{fmt(x.value)}</div>
                  <div style={{fontSize:11,color:T.inkSub}}>{x.label}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

      </div>
    </div>
  )
}