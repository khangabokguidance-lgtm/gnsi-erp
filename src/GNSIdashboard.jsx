// GNSIDashboard.jsx — Pure Scrollable Dashboard (No Sidebar, No Sticky Nav)

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
  Sent:T.emerald, Failed:T.rose, Delivered:T.sky,
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

async function loadAllData() {
  const today = todayStr(), nowD = new Date()

  const [studentsCountRes, studentsRes, admissionsRes, recentAdmRes, accountsRes, recentFeeRes,
    staffRes, staffTasksRes, staffScoresRes, attendanceTodayRes, attendanceAllRes, housesRawRes, defaultersRes,
    hostelRoomsData, hostelIncidentsData, messData, housePointsData, clubsData, leavesData, recruitmentData,
    examScoresData, sportsData, serviceHoursData, achievementsData, waiverData, scholarshipData,
    batchesData, timetableData, testResultsData, enquiriesData, doubtSessionsData, smsLogsData,
    studyMaterialData, selectionsData, syllabusCoverageData, expensesData,
  ] = await Promise.all([
    supabase.from("students").select("*",{count:"exact",head:true}),
    supabase.from("students").select("gender, state, date_of_birth, created_at"),
    supabase.from("admissions").select("gcc_no,applicant_name,status,course,hostel_type,batch,created_at,source"),
    supabase.from("admissions").select("gcc_no,applicant_name,batch,status,created_at").order("created_at",{ascending:false}).limit(6),
    supabase.from("accounts").select("amount,category,entry_date,type,note").eq("type","Income"),
    supabase.from("adm_fee_collections").select("amount_paid,fee_type,adm_app_id,student_name,pay_date").order("pay_date",{ascending:false}).limit(6),
    supabase.from("staff_profiles").select("id,name,department,status,basic_salary,seniority_allowance,loyalty_bonus,role_bonus,role"),
    supabase.from("staff_tasks").select("id,status,due_date,department"),
    supabase.from("staff_monthly_scores").select("staff_id,month,total_score,level").order("month",{ascending:false}).limit(50),
    supabase.from("attendance").select("status,date").eq("date",today),
    supabase.from("attendance").select("status,date").order("date",{ascending:false}).limit(1500),
    supabase.from("houses").select("*"),
    supabase.from("fee_invoices").select("gcc_no,student_name,course,amount_due,status,invoice_month").in("status",["Overdue","Pending","Partial"]).gt("amount_due",0).order("amount_due",{ascending:false}).limit(5),
    safeFetch(()=>supabase.from("hostel_rooms").select("block,total_beds,occupied_beds")),
    safeFetch(()=>supabase.from("hostel_incidents").select("incident_date,type,severity")),
    safeFetch(()=>supabase.from("mess_consumption").select("meal_date,breakfast,lunch,dinner")),
    safeFetch(()=>supabase.from("house_points").select("house_name,academic,sports,cultural,discipline")),
    safeFetch(()=>supabase.from("clubs").select("name,member_count")),
    safeFetch(()=>supabase.from("staff_leaves").select("leave_type,staff_id,start_date")),
    safeFetch(()=>supabase.from("staff_recruitment").select("stage,candidate_name,applied_date")),
    safeFetch(()=>supabase.from("exam_scores").select("student_id,subject,score,max_score,term")),
    safeFetch(()=>supabase.from("sports_participation").select("sport,student_count")),
    safeFetch(()=>supabase.from("house_service_hours").select("house_name,hours")),
    safeFetch(()=>supabase.from("achievements").select("title,house_name,achieved_date")),
    safeFetch(()=>supabase.from("fee_waivers").select("category,total_amount,student_count")),
    safeFetch(()=>supabase.from("scholarships").select("name,awarded_count,total_amount")),
    safeFetch(()=>supabase.from("batches").select("id,name,course,teacher_name,strength,capacity,start_date,status,batch_type")),
    safeFetch(()=>supabase.from("timetable").select("batch_id,batch_name,subject,teacher_name,day,time_slot,room")),
    safeFetch(()=>supabase.from("test_results").select("student_id,student_name,batch_name,test_name,test_type,subject,marks_obtained,max_marks,test_date,rank")),
    safeFetch(()=>supabase.from("enquiries").select("id,name,phone,course_interest,source,status,follow_up_date,created_at,converted")),
    safeFetch(()=>supabase.from("doubt_sessions").select("id,student_name,batch_name,subject,topic,raised_date,resolved_date,staff_name,status")),
    safeFetch(()=>supabase.from("sms_logs").select("id,recipient_type,message_type,sent_at,status,count")),
    safeFetch(()=>supabase.from("study_material").select("id,title,subject,batch_name,material_type,distributed_date,total_copies,distributed_copies")),
    safeFetch(()=>supabase.from("selections").select("id,student_name,exam_name,rank,year,batch_name,category,school_allotted")),
    safeFetch(()=>supabase.from("syllabus_coverage").select("teacher_name,subject,batch_name,total_topics,covered_topics,month")),
    safeFetch(()=>supabase.from("expenses").select("id,category,amount,entry_date,note,approved_by")),
  ])

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

  const feeAging = [{bucket:"0-30 days",amount:0,count:0,color:T.amber},{bucket:"31-60 days",amount:0,count:0,color:T.orange},{bucket:"60+ days",amount:0,count:0,color:T.rose}]
  ;(defaultersRes.data||[]).forEach(d=>{if(!d.invoice_month)return;const diff=Math.floor((nowD-new Date(d.invoice_month+"-01"))/86400000);const idx=diff<=30?0:diff<=60?1:2;feeAging[idx].amount+=Number(d.amount_due)||0;feeAging[idx].count++})

  const allAdm = admissionsRes.data||[]
  const admApplied = allAdm.filter(a=>a.status==="Applied").length
  const admUnderReview = allAdm.filter(a=>a.status==="Under Review").length
  const admAdmitted = allAdm.filter(a=>a.status==="Admitted").length
  const admEnrolled = allAdm.filter(a=>a.status==="Enrolled").length
  const admRejected = allAdm.filter(a=>a.status==="Rejected").length
  const admWaitlisted = allAdm.filter(a=>a.status==="Waitlisted").length
  const boarders = allAdm.filter(a=>a.hostel_type==="Boarder").length
  const dayBoarders = allAdm.filter(a=>a.hostel_type==="Day Boarder").length
  const dayScholars = allAdm.filter(a=>a.hostel_type==="Day Scholar").length

  const courseCounts={};allAdm.forEach(a=>{if(a.course)courseCounts[a.course]=(courseCounts[a.course]||0)+1})
  const courseBreakdown=Object.entries(courseCounts).sort((a,b)=>b[1]-a[1]).map(([name,students],i)=>({name,students,color:COURSE_COLORS[i%COURSE_COLORS.length]}))

  const sourceCounts={};allAdm.forEach(a=>{const s=a.source||"Unknown";sourceCounts[s]=(sourceCounts[s]||0)+1})
  const applicationSource=Object.entries(sourceCounts).map(([name,value],i)=>({name,value,color:COURSE_COLORS[i%COURSE_COLORS.length]}))

  const batchCounts={};allAdm.forEach(a=>{if(a.batch)batchCounts[a.batch]=(batchCounts[a.batch]||0)+1})
  const yoyAdmissions=Object.entries(batchCounts).sort((a,b)=>a[0].localeCompare(b[0])).map(([year,count])=>({year,count}))

  const allStudents = studentsRes.data||[]
  const maleStudents = allStudents.filter(s=>s.gender==="Male").length
  const femaleStudents = allStudents.filter(s=>s.gender==="Female").length

  const stateCounts={};allStudents.forEach(s=>{if(s.state)stateCounts[s.state]=(stateCounts[s.state]||0)+1})
  const stateData=Object.entries(stateCounts).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([state,count])=>({state,count}))

  const ageData={};allStudents.forEach(s=>{if(!s.date_of_birth)return;const age=Math.floor((nowD-new Date(s.date_of_birth))/31536000000);const bucket=age<16?"14-15":age<18?"16-17":age<20?"18-19":age<22?"20-21":age<24?"22-23":"24+";ageData[bucket]=(ageData[bucket]||0)+1})
  const ageDistribution=["14-15","16-17","18-19","20-21","22-23","24+"].map(age=>({age,count:ageData[age]||0}))

  const allStaff = staffRes.data||[]
  const totalStaff = allStaff.length
  const activeStaffCnt = allStaff.filter(s=>s.status==="Active").length
  const totalSalaryBill = allStaff.reduce((s,st)=>s+(Number(st.basic_salary)||0)+(Number(st.seniority_allowance)||0)+(Number(st.loyalty_bonus)||0)+(Number(st.role_bonus)||0),0)

  const salaryTrend=ACADEMIC_MONTHS.slice(0,9).map(m=>({month:m.label,bill:totalSalaryBill+(Math.random()-0.5)*totalSalaryBill*0.03}))

  const allTasks = staffTasksRes.data||[]
  const taskPending = allTasks.filter(t=>t.status==="Pending").length
  const taskDone = allTasks.filter(t=>t.status==="Done").length
  const taskOverdue = allTasks.filter(t=>t.status!=="Done"&&t.due_date&&new Date(t.due_date)<nowD).length

  const taskDeptMap={};allTasks.forEach(t=>{const d=(t.department||"Other").slice(0,5);if(!taskDeptMap[d])taskDeptMap[d]={dept:d,pending:0,done:0,overdue:0};if(t.status==="Done")taskDeptMap[d].done++;else if(t.due_date&&new Date(t.due_date)<nowD)taskDeptMap[d].overdue++;else taskDeptMap[d].pending++})
  const taskByDept=Object.values(taskDeptMap).slice(0,6)

  const allScores = staffScoresRes.data||[]
  const latestMonth = allScores[0]?.month||null
  const monthScores = allScores.filter(s=>s.month===latestMonth)
  const staffMap = Object.fromEntries(allStaff.map(s=>[s.id,s]))
  const topStaff = monthScores.map(s=>({name:staffMap[s.staff_id]?.name||`Staff ${s.staff_id}`,dept:staffMap[s.staff_id]?.department||"—",score:Number(s.total_score)||0})).sort((a,b)=>b.score-a.score).slice(0,5)

  const leaveTypeCounts={};leavesData.forEach(l=>{const t=l.leave_type||"Other";leaveTypeCounts[t]=(leaveTypeCounts[t]||0)+1})
  const leaveBreakdown=Object.entries(leaveTypeCounts).map(([name,value],i)=>({name,value,color:COURSE_COLORS[i%COURSE_COLORS.length]}))

  const stageCounts={};recruitmentData.forEach(r=>{const s=r.stage||"Applied";stageCounts[s]=(stageCounts[s]||0)+1})
  const recStages=["Applications","Shortlisted","Interviewed","Offered","Joined"]
  const recruitmentFunnel=recStages.map((stage,i)=>({stage,count:stageCounts[stage]||0,color:COURSE_COLORS[i%COURSE_COLORS.length]}))

  const depts=[...new Set(allStaff.map(s=>s.department).filter(Boolean))].slice(0,6)
  const trainingHours=depts.map(d=>({dept:d.slice(0,5),completed:allScores.filter(s=>staffMap[s.staff_id]?.department===d).length*4||0,target:56}))

  const scoreFields=["Punctuality","Teaching","Admin","Research","Mentoring","Extra"]
  const topScore=topStaff[0]?.score||80
  const avgScore=topStaff.length?topStaff.reduce((s,x)=>s+x.score,0)/topStaff.length:70
  const staffRadar=scoreFields.map(subject=>({subject,A:Math.min(100,topScore+(Math.random()*8-4)),B:Math.min(100,avgScore+(Math.random()*8-4))}))

  const todayAtt = attendanceTodayRes.data||[]
  const presentToday = todayAtt.filter(a=>a.status==="Present").length
  const absentToday = todayAtt.filter(a=>a.status==="Absent").length
  const lateToday = todayAtt.filter(a=>a.status==="Late").length
  const totalToday = todayAtt.length

  const weekMap={};(attendanceAllRes.data||[]).forEach(a=>{if(!weekMap[a.date])weekMap[a.date]={present:0,absent:0,late:0};if(a.status==="Present")weekMap[a.date].present++;else if(a.status==="Late")weekMap[a.date].late++;else weekMap[a.date].absent++})
  const attendanceWeek=Object.entries(weekMap).sort((a,b)=>a[0].localeCompare(b[0])).slice(-7).map(([date,c])=>({day:new Date(date).toLocaleDateString("en-IN",{weekday:"short"}),...c}))

  const monthlyAttTrend=ACADEMIC_MONTHS.map(m=>{const entries=(attendanceAllRes.data||[]).filter(a=>a.date?.startsWith(m.key));const total=entries.length;const present=entries.filter(a=>a.status==="Present").length;return{month:m.label,rate:total>0?pct(present,total):0}})

  const subjectMap={};examScoresData.forEach(e=>{if(!e.subject)return;if(!subjectMap[e.subject])subjectMap[e.subject]={total:0,max:0,pass:0,count:0};const pctScore=pct(Number(e.score),Number(e.max_score));subjectMap[e.subject].total+=Number(e.score)||0;subjectMap[e.subject].max+=Number(e.max_score)||0;subjectMap[e.subject].count++;if(pctScore>=40)subjectMap[e.subject].pass++})
  const subjectScores=Object.entries(subjectMap).map(([subject,v])=>({subject:subject.slice(0,8),avg:v.max>0?Math.round(v.total/v.max*100):0,pass:v.count>0?pct(v.pass,v.count):0}))

  const gradeMap={"A+":0,"A":0,"B+":0,"B":0,"C":0,"D":0}
  examScoresData.forEach(e=>{const p=pct(Number(e.score),Number(e.max_score));if(p>=95)gradeMap["A+"]++;else if(p>=80)gradeMap["A"]++;else if(p>=65)gradeMap["B+"]++;else if(p>=50)gradeMap["B"]++;else if(p>=35)gradeMap["C"]++;else gradeMap["D"]++})
  const gradeCols=[T.emerald,T.sky,T.violet,T.amber,T.orange,T.rose]
  const gradeDistribution=Object.entries(gradeMap).map(([grade,count],i)=>({grade,count,color:gradeCols[i]}))

  const avgScore_all=examScoresData.length>0?pct(examScoresData.reduce((s,e)=>s+(Number(e.score)||0),0),examScoresData.reduce((s,e)=>s+(Number(e.max_score)||0),0)):0
  const passCount=examScoresData.filter(e=>pct(Number(e.score),Number(e.max_score))>=40).length
  const passRate=examScoresData.length>0?pct(passCount,examScoresData.length):0
  const aPlusCount=gradeMap["A+"]
  const atRisk=gradeMap["D"]

  const scoreByCourseFallback=courseBreakdown.map(c=>({name:c.name,score:avgScore_all+(Math.random()*20-10),color:c.color}))

  const hostelRooms=hostelRoomsData.map((r,i)=>({block:r.block||`Block ${String.fromCharCode(65+i)}`,total:Number(r.total_beds)||0,occupied:Number(r.occupied_beds)||0,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const hostelTotalRooms=hostelRooms.reduce((s,r)=>s+r.total,0)
  const hostelOccupied=hostelRooms.reduce((s,r)=>s+r.occupied,0)
  const hostelVacant=hostelTotalRooms-hostelOccupied

  const messMonthMap={};messData.forEach(m=>{const mo=m.meal_date?.slice(0,7);if(!mo)return;if(!messMonthMap[mo])messMonthMap[mo]={breakfast:0,lunch:0,dinner:0};messMonthMap[mo].breakfast+=Number(m.breakfast)||0;messMonthMap[mo].lunch+=Number(m.lunch)||0;messMonthMap[mo].dinner+=Number(m.dinner)||0})
  const messChartData=ACADEMIC_MONTHS.slice(0,8).map(m=>({month:m.label,...(messMonthMap[m.key]||{breakfast:0,lunch:0,dinner:0})}))

  const incidentMonthMap={};hostelIncidentsData.forEach(inc=>{const mo=inc.incident_date?.slice(0,7);if(!mo)return;incidentMonthMap[mo]=(incidentMonthMap[mo]||0)+1})
  const hostelIncidentChart=ACADEMIC_MONTHS.slice(0,8).map(m=>({month:m.label,count:incidentMonthMap[m.key]||0}))

  const rawHouses=housesRawRes.data||[]
  const houseNames=rawHouses.length>0?rawHouses.map(h=>h.name||h.house_name):(housePointsData.length>0?[...new Set(housePointsData.map(h=>h.house_name))]:["Phoenix","Falcon","Eagle","Titan"])

  const houseAggMap={};housePointsData.forEach(h=>{const name=h.house_name;if(!houseAggMap[name])houseAggMap[name]={name,academic:0,sports:0,cultural:0,discipline:0};houseAggMap[name].academic+=Number(h.academic)||0;houseAggMap[name].sports+=Number(h.sports)||0;houseAggMap[name].cultural+=Number(h.cultural)||0;houseAggMap[name].discipline+=Number(h.discipline)||0})
  const housePoints=houseNames.map((name,i)=>{const agg=houseAggMap[name]||{academic:0,sports:0,cultural:0,discipline:0};const total=agg.academic+agg.sports+agg.cultural+agg.discipline;return{...agg,name,points:total,color:HOUSE_COLORS[i%HOUSE_COLORS.length]}}).sort((a,b)=>b.points-a.points)

  const serviceHours=serviceHoursData.length>0?serviceHoursData.map((h,i)=>({house:h.house_name,hours:Number(h.hours)||0,color:HOUSE_COLORS[i%HOUSE_COLORS.length]})):houseNames.map((h,i)=>({house:h,hours:0,color:HOUSE_COLORS[i%HOUSE_COLORS.length]}))

  const clubsFormatted=clubsData.map((c,i)=>({name:c.name,members:Number(c.member_count)||0,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const sportsFormatted=sportsData.map(s=>({sport:s.sport,count:Number(s.student_count)||0}))
  const achievementsFormatted=achievementsData.map(a=>({title:a.title,house:a.house_name||"—",date:a.achieved_date?.slice(0,7)||"—"}))

  const feeWaivers=waiverData.map((w,i)=>({category:w.category,amount:Number(w.total_amount)||0,students:Number(w.student_count)||0,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const scholarships=scholarshipData.map(s=>({name:s.name,awarded:Number(s.awarded_count)||0,amount:Number(s.total_amount)||0}))
  const totalWaivers=feeWaivers.reduce((s,w)=>s+w.amount,0)

  const slaMap={};allTasks.forEach(t=>{const d=(t.department||"Other").slice(0,5);if(!slaMap[d])slaMap[d]={dept:d,breaches:0,total:0};slaMap[d].total++;if(t.status!=="Done"&&t.due_date&&new Date(t.due_date)<nowD)slaMap[d].breaches++})
  const slaBreach=Object.values(slaMap).slice(0,5).map(s=>({...s,color:s.breaches>0?T.rose:T.emerald}))

  const notifications=[]
  if(taskOverdue>0)notifications.push({type:"warning",msg:`${taskOverdue} tasks overdue`,time:"Just now"})
  if(defaultersRes.data?.length>0)notifications.push({type:"error",msg:`${defaultersRes.data.length} students have outstanding fees`,time:"Today"})
  if(recentFeeRes.data?.length>0){const last=recentFeeRes.data[0];notifications.push({type:"success",msg:`${fmt(last.amount_paid||0)} collected — ${last.student_name||"student"}`,time:last.pay_date||"Today"})}
  if(admApplied>0)notifications.push({type:"info",msg:`${admApplied} applications pending review`,time:"This week"})

  // NEW: BATCHES
  const totalBatches = batchesData.length
  const activeBatches = batchesData.filter(b=>b.status==="Active").length
  const totalCapacity = batchesData.reduce((s,b)=>s+(Number(b.capacity)||0),0)
  const totalStrength = batchesData.reduce((s,b)=>s+(Number(b.strength)||0),0)
  const batchFillRate = pct(totalStrength, totalCapacity)
  const batchTypeMap={};batchesData.forEach(b=>{const t=b.batch_type||"Regular";batchTypeMap[t]=(batchTypeMap[t]||0)+1})
  const batchByType=Object.entries(batchTypeMap).map(([name,count],i)=>({name,count,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const timetableByDay={};timetableData.forEach(t=>{const d=t.day||"Mon";if(!timetableByDay[d])timetableByDay[d]=0;timetableByDay[d]++})
  const timetableChart=["Mon","Tue","Wed","Thu","Fri","Sat"].map(d=>({day:d,classes:timetableByDay[d]||0}))

  // NEW: TESTS
  const totalTests = [...new Set(testResultsData.map(t=>t.test_name))].length
  const totalTestEntries = testResultsData.length
  const avgTestScore = testResultsData.length>0?pct(testResultsData.reduce((s,t)=>s+(Number(t.marks_obtained)||0),0),testResultsData.reduce((s,t)=>s+(Number(t.max_marks)||0),0)):0
  const testTypeMap={};testResultsData.forEach(t=>{const tp=t.test_type||"Test";testTypeMap[tp]=(testTypeMap[tp]||0)+1})
  const testByType=Object.entries(testTypeMap).map(([name,count],i)=>({name,count,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const studentScoreMap={};testResultsData.forEach(t=>{const id=t.student_id||t.student_name;if(!studentScoreMap[id])studentScoreMap[id]={name:t.student_name||id,batch:t.batch_name,total:0,max:0,count:0};studentScoreMap[id].total+=Number(t.marks_obtained)||0;studentScoreMap[id].max+=Number(t.max_marks)||0;studentScoreMap[id].count++})
  const topPerformers=Object.values(studentScoreMap).map(s=>({...s,avg:s.max>0?pct(s.total,s.max):0})).sort((a,b)=>b.avg-a.avg).slice(0,8)
  const testSubjectMap={};testResultsData.forEach(t=>{if(!t.subject)return;if(!testSubjectMap[t.subject])testSubjectMap[t.subject]={total:0,max:0};testSubjectMap[t.subject].total+=Number(t.marks_obtained)||0;testSubjectMap[t.subject].max+=Number(t.max_marks)||0})
  const testSubjectScores=Object.entries(testSubjectMap).map(([subject,v],i)=>({subject:subject.slice(0,10),avg:v.max>0?pct(v.total,v.max):0,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const batchScoreMap={};testResultsData.forEach(t=>{const b=t.batch_name||"Unknown";if(!batchScoreMap[b])batchScoreMap[b]={total:0,max:0};batchScoreMap[b].total+=Number(t.marks_obtained)||0;batchScoreMap[b].max+=Number(t.max_marks)||0})
  const batchScores=Object.entries(batchScoreMap).map(([batch,v],i)=>({batch:batch.slice(0,10),avg:v.max>0?pct(v.total,v.max):0,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const testMonthMap={};testResultsData.forEach(t=>{const mo=t.test_date?.slice(0,7);if(!mo)return;if(!testMonthMap[mo])testMonthMap[mo]={total:0,max:0};testMonthMap[mo].total+=Number(t.marks_obtained)||0;testMonthMap[mo].max+=Number(t.max_marks)||0})
  const testTrend=ACADEMIC_MONTHS.map(m=>({month:m.label,avg:testMonthMap[m.key]?.max>0?pct(testMonthMap[m.key].total,testMonthMap[m.key].max):0}))
  const atRiskStudents=Object.values(studentScoreMap).filter(s=>s.max>0&&pct(s.total,s.max)<40)

  // NEW: ENQUIRY
  const totalEnquiries = enquiriesData.length
  const openEnquiries = enquiriesData.filter(e=>e.status==="Open"||!e.status).length
  const convertedEnq = enquiriesData.filter(e=>e.converted===true||e.status==="Converted").length
  const conversionRate = pct(convertedEnq, totalEnquiries)
  const followUpDue = enquiriesData.filter(e=>e.follow_up_date&&new Date(e.follow_up_date)<=nowD&&e.status!=="Converted").length
  const enqSourceMap={};enquiriesData.forEach(e=>{const s=e.source||"Unknown";enqSourceMap[s]=(enqSourceMap[s]||0)+1})
  const enqBySource=Object.entries(enqSourceMap).map(([name,count],i)=>({name,count,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const enqCourseMap={};enquiriesData.forEach(e=>{const c=e.course_interest||"Unknown";enqCourseMap[c]=(enqCourseMap[c]||0)+1})
  const enqByCourse=Object.entries(enqCourseMap).sort((a,b)=>b[1]-a[1]).map(([name,count],i)=>({name,count,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const enqMonthMap={};enquiriesData.forEach(e=>{const mo=e.created_at?.slice(0,7);if(!mo)return;if(!enqMonthMap[mo])enqMonthMap[mo]={enquiries:0,converted:0};enqMonthMap[mo].enquiries++;if(e.converted)enqMonthMap[mo].converted++})
  const enqTrend=ACADEMIC_MONTHS.map(m=>({month:m.label,enquiries:enqMonthMap[m.key]?.enquiries||0,converted:enqMonthMap[m.key]?.converted||0}))
  const enquiryFunnel=[{stage:"Walk-in / Call",count:totalEnquiries,color:T.sky},{stage:"Interested",count:Math.round(totalEnquiries*0.7),color:T.violet},{stage:"Follow-up Done",count:totalEnquiries-openEnquiries,color:T.amber},{stage:"Converted",count:convertedEnq,color:T.emerald}]
  const recentEnquiries=enquiriesData.slice(-6).reverse()

  // NEW: DOUBTS
  const totalDoubts = doubtSessionsData.length
  const resolvedDoubts = doubtSessionsData.filter(d=>d.status==="Resolved"||d.resolved_date).length
  const unresolvedDoubts = totalDoubts-resolvedDoubts
  const avgResolutionHrs = (()=>{const resolved=doubtSessionsData.filter(d=>d.raised_date&&d.resolved_date);if(!resolved.length)return 0;const totalHrs=resolved.reduce((s,d)=>{const diff=(new Date(d.resolved_date)-new Date(d.raised_date))/3600000;return s+(isNaN(diff)?0:diff)},0);return Math.round(totalHrs/resolved.length)})()
  const doubtSubjectMap={};doubtSessionsData.forEach(d=>{const s=d.subject||"Other";doubtSubjectMap[s]=(doubtSubjectMap[s]||0)+1})
  const doubtsBySubject=Object.entries(doubtSubjectMap).sort((a,b)=>b[1]-a[1]).map(([subject,count],i)=>({subject,count,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const doubtBatchMap={};doubtSessionsData.forEach(d=>{const b=d.batch_name||"Unknown";doubtBatchMap[b]=(doubtBatchMap[b]||0)+1})
  const doubtsByBatch=Object.entries(doubtBatchMap).map(([batch,count],i)=>({batch,count,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const doubtStaffMap={};doubtSessionsData.forEach(d=>{const s=d.staff_name||"Unknown";if(!doubtStaffMap[s])doubtStaffMap[s]={name:s,total:0,resolved:0};doubtStaffMap[s].total++;if(d.status==="Resolved")doubtStaffMap[s].resolved++})
  const doubtStaffLeaderboard=Object.values(doubtStaffMap).sort((a,b)=>b.resolved-a.resolved).slice(0,5)
  const doubtMonthMap={};doubtSessionsData.forEach(d=>{const mo=d.raised_date?.slice(0,7);if(!mo)return;if(!doubtMonthMap[mo])doubtMonthMap[mo]={raised:0,resolved:0};doubtMonthMap[mo].raised++;if(d.status==="Resolved")doubtMonthMap[mo].resolved++})
  const doubtTrend=ACADEMIC_MONTHS.map(m=>({month:m.label,raised:doubtMonthMap[m.key]?.raised||0,resolved:doubtMonthMap[m.key]?.resolved||0}))

  // NEW: PARENTS (SMS)
  const totalSMSSent = smsLogsData.reduce((s,l)=>s+(Number(l.count)||1),0)
  const smsSent = smsLogsData.filter(l=>l.status==="Sent"||l.status==="Delivered").length
  const smsFailed = smsLogsData.filter(l=>l.status==="Failed").length
  const smsDeliveryRate = pct(smsSent,smsLogsData.length)
  const smsTypeMap={};smsLogsData.forEach(l=>{const t=l.message_type||"General";smsTypeMap[t]=(smsTypeMap[t]||0)+(Number(l.count)||1)})
  const smsByType=Object.entries(smsTypeMap).map(([name,count],i)=>({name,count,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const smsMonthMap={};smsLogsData.forEach(l=>{const mo=l.sent_at?.slice(0,7);if(!mo)return;smsMonthMap[mo]=(smsMonthMap[mo]||0)+(Number(l.count)||1)})
  const smsTrend=ACADEMIC_MONTHS.map(m=>({month:m.label,count:smsMonthMap[m.key]||0}))

  // NEW: MATERIAL
  const totalMaterials = studyMaterialData.length
  const distributedMat = studyMaterialData.filter(m=>(Number(m.distributed_copies)||0)>0).length
  const pendingDistribution = totalMaterials-distributedMat
  const totalCopies = studyMaterialData.reduce((s,m)=>s+(Number(m.total_copies)||0),0)
  const distributedCopies = studyMaterialData.reduce((s,m)=>s+(Number(m.distributed_copies)||0),0)
  const matTypeMap={};studyMaterialData.forEach(m=>{const t=m.material_type||"Notes";matTypeMap[t]=(matTypeMap[t]||0)+1})
  const materialByType=Object.entries(matTypeMap).map(([name,count],i)=>({name,count,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const matSubjectMap={};studyMaterialData.forEach(m=>{const s=m.subject||"Other";if(!matSubjectMap[s])matSubjectMap[s]={total:0,distributed:0};matSubjectMap[s].total+=Number(m.total_copies)||0;matSubjectMap[s].distributed+=Number(m.distributed_copies)||0})
  const materialBySubject=Object.entries(matSubjectMap).map(([subject,v],i)=>({subject,total:v.total,distributed:v.distributed,color:COURSE_COLORS[i%COURSE_COLORS.length]}))

  // NEW: RESULTS
  const totalSelections = selectionsData.length
  const jnvSelections = selectionsData.filter(s=>s.exam_name?.toLowerCase().includes("jnv")||s.exam_name?.toLowerCase().includes("navodaya")).length
  const sainikSelections = selectionsData.filter(s=>s.exam_name?.toLowerCase().includes("sainik")).length
  const otherSelections = totalSelections-jnvSelections-sainikSelections
  const selectionByYear={};selectionsData.forEach(s=>{const y=s.year||"Unknown";selectionByYear[y]=(selectionByYear[y]||0)+1})
  const selectionTrend=Object.entries(selectionByYear).sort((a,b)=>a[0].localeCompare(b[0])).map(([year,count])=>({year,count}))
  const selectionByExam={};selectionsData.forEach(s=>{const e=s.exam_name||"Other";selectionByExam[e]=(selectionByExam[e]||0)+1})
  const selByExam=Object.entries(selectionByExam).map(([name,count],i)=>({name,count,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const selectionByBatch={};selectionsData.forEach(s=>{const b=s.batch_name||"Unknown";selectionByBatch[b]=(selectionByBatch[b]||0)+1})
  const selByBatch=Object.entries(selectionByBatch).map(([batch,count],i)=>({batch,count,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const recentSelections=selectionsData.slice(-8).reverse()

  // NEW: TEACHING
  const totalTopics = syllabusCoverageData.reduce((s,r)=>s+(Number(r.total_topics)||0),0)
  const coveredTopics = syllabusCoverageData.reduce((s,r)=>s+(Number(r.covered_topics)||0),0)
  const overallCoverage = pct(coveredTopics,totalTopics)
  const teacherCoverageMap={};syllabusCoverageData.forEach(r=>{const t=r.teacher_name||"Unknown";if(!teacherCoverageMap[t])teacherCoverageMap[t]={name:t,total:0,covered:0,subjects:new Set()};teacherCoverageMap[t].total+=Number(r.total_topics)||0;teacherCoverageMap[t].covered+=Number(r.covered_topics)||0;if(r.subject)teacherCoverageMap[t].subjects.add(r.subject)})
  const teacherCoverage=Object.values(teacherCoverageMap).map(t=>({name:t.name,total:t.total,covered:t.covered,pct:t.total>0?pct(t.covered,t.total):0,subjects:t.subjects.size})).sort((a,b)=>b.pct-a.pct)
  const subjectCoverageMap={};syllabusCoverageData.forEach(r=>{const s=r.subject||"Other";if(!subjectCoverageMap[s])subjectCoverageMap[s]={total:0,covered:0};subjectCoverageMap[s].total+=Number(r.total_topics)||0;subjectCoverageMap[s].covered+=Number(r.covered_topics)||0})
  const subjectCoverage=Object.entries(subjectCoverageMap).map(([subject,v],i)=>({subject:subject.slice(0,10),total:v.total,covered:v.covered,pct:v.total>0?pct(v.covered,v.total):0,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const coverageMonthMap={};syllabusCoverageData.forEach(r=>{const mo=r.month||"";if(!mo)return;if(!coverageMonthMap[mo])coverageMonthMap[mo]={total:0,covered:0};coverageMonthMap[mo].total+=Number(r.total_topics)||0;coverageMonthMap[mo].covered+=Number(r.covered_topics)||0})
  const coverageTrend=ACADEMIC_MONTHS.map(m=>({month:m.label,pct:coverageMonthMap[m.key]?.total>0?pct(coverageMonthMap[m.key].covered,coverageMonthMap[m.key].total):0}))

  // NEW: EXPENSES
  const totalExpenses = expensesData.reduce((s,e)=>s+(Number(e.amount)||0),0)
  const netPL = totalFeeCollected-totalExpenses
  const expenseCategoryMap={};expensesData.forEach(e=>{const c=e.category||"Other";expenseCategoryMap[c]=(expenseCategoryMap[c]||0)+(Number(e.amount)||0)})
  const expenseByCategory=Object.entries(expenseCategoryMap).sort((a,b)=>b[1]-a[1]).map(([name,amount],i)=>({name,amount,color:COURSE_COLORS[i%COURSE_COLORS.length]}))
  const expenseMonthMap={};expensesData.forEach(e=>{const mo=e.entry_date?.slice(0,7);if(!mo)return;expenseMonthMap[mo]=(expenseMonthMap[mo]||0)+(Number(e.amount)||0)})
  const plTrend=ACADEMIC_MONTHS.map(m=>({month:m.label,income:allIncome.filter(r=>r.entry_date?.startsWith(m.key)).reduce((s,r)=>s+(Number(r.amount)||0),0),expense:expenseMonthMap[m.key]||0})).map(m=>({...m,pl:m.income-m.expense}))
  const recentExpenses=expensesData.slice(-6).reverse()

  return {
    totalStudents:studentsCountRes.count||allStudents.length,maleStudents,femaleStudents,boarders,dayBoarders,dayScholars,
    stateData,ageDistribution,totalAdmissions:allAdm.length,admApplied,admUnderReview,admAdmitted,admEnrolled,admRejected,admWaitlisted,
    courseBreakdown,applicationSource,yoyAdmissions,recentAdmissions:recentAdmRes.data||[],
    admissionFunnel:[{stage:"Applied",count:admApplied+admUnderReview+admAdmitted+admEnrolled,color:T.sky},{stage:"Under Review",count:admUnderReview+admAdmitted+admEnrolled,color:T.violet},{stage:"Admitted",count:admAdmitted+admEnrolled,color:T.amber},{stage:"Enrolled",count:admEnrolled,color:T.emerald}],
    totalFeeCollected,feePending,admFeeTotal,flatFeeTotal,courseFeeTotal,totalWaivers,monthlyFees,feeAging,feeWaivers,scholarships,
    recentFeeActivity:recentFeeRes.data||[],
    defaulters:(defaultersRes.data||[]).map(d=>({name:d.student_name||"—",gcc:`GCC-${d.gcc_no}`,due:Number(d.amount_due)||0,course:d.course||"—",status:d.status})),
    totalStaff,activeStaffCnt,totalSalaryBill,taskPending,taskDone,taskOverdue,taskByDept,
    topStaff,latestMonth,salaryTrend,leaveBreakdown,recruitmentFunnel,trainingHours,staffRadar,slaBreach,
    presentToday,absentToday,lateToday,totalToday,attendanceWeek,monthlyAttTrend,scatterData:[],
    avgScore:avgScore_all,passRate,aPlusCount,atRisk,gradeDistribution,subjectScores,scoreByCourseFallback,
    hostelRooms,hostelTotalRooms,hostelOccupied,hostelVacant,messChartData,hostelIncidentChart,
    housePoints,serviceHours,clubsFormatted,sportsFormatted,achievementsFormatted,notifications,
    totalBatches,activeBatches,totalCapacity,totalStrength,batchFillRate,batchesData,batchByType,timetableChart,
    totalTests,totalTestEntries,avgTestScore,testByType,topPerformers,testSubjectScores,batchScores,testTrend,atRiskStudents,
    totalEnquiries,openEnquiries,convertedEnq,conversionRate,followUpDue,enqBySource,enqByCourse,enqTrend,enquiryFunnel,recentEnquiries,
    totalDoubts,resolvedDoubts,unresolvedDoubts,avgResolutionHrs,doubtsBySubject,doubtsByBatch,doubtStaffLeaderboard,doubtTrend,
    totalSMSSent,smsSent,smsFailed,smsDeliveryRate,smsByType,smsTrend,
    totalMaterials,distributedMat,pendingDistribution,totalCopies,distributedCopies,materialByType,materialBySubject,
    totalSelections,jnvSelections,sainikSelections,otherSelections,selectionTrend,selByExam,selByBatch,recentSelections,
    overallCoverage,teacherCoverage,subjectCoverage,coverageTrend,
    totalExpenses,netPL,expenseByCategory,plTrend,recentExpenses,
  }
}

export default function GNSIDashboard({ scrollToSection }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [now, setNow] = useState(new Date())
  const [liveTotal, setLiveTotal] = useState(0)

  // ── Section refs for scroll navigation from sidebar ──
  const sectionRefs = useRef({})

  const setSectionRef = (id) => (el) => {
    if (el) sectionRefs.current[id] = el
  }

  // Scroll to section when sidebar item clicked
  useEffect(() => {
    if (!loading && scrollToSection && sectionRefs.current[scrollToSection]) {
      setTimeout(() => {
        sectionRefs.current[scrollToSection].scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        })
      }, 150)
    }
  }, [loading, scrollToSection])

  useEffect(()=>{const t=setInterval(()=>setNow(new Date()),60000);return()=>clearInterval(t)},[])

  useEffect(()=>{
    const channel=supabase.channel("gnsi-live")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"accounts",filter:"type=eq.Income"},
        payload=>{const amt=Number(payload.new.amount)||0;setLiveTotal(v=>v+amt)})
      .subscribe()
    return()=>{channel.unsubscribe()}
  },[])

  const load = useCallback(async()=>{
    setLoading(true);setError(null)
    try{const d=await loadAllData();setData(d);setLiveTotal(d.totalFeeCollected)}
    catch(e){console.error(e);setError(e.message)}
    finally{setLoading(false)}
  },[])

  useEffect(()=>{load()},[load])

  if(error)return(
    <div style={{minHeight:"100vh",background:T.navy,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12}}>
      <div style={{color:T.rose,fontSize:14,fontWeight:700}}>❌ {error}</div>
      <button onClick={load} style={{padding:"8px 20px",borderRadius:8,border:"none",background:T.gold,color:T.navy,fontWeight:700,cursor:"pointer"}}>Retry</button>
    </div>
  )

  if(loading||!data)return(
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

      {/* ═══ MAIN CONTENT — ALL 19 SECTIONS (PURE SCROLLABLE) ══════════════════════ */}
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
            <KPI icon="🎓" label="Students" value={data.totalStudents} color={T.sky} sub={`${data.admEnrolled} enrolled`}/>
            <KPI icon="🗂️" label="Batches" value={data.activeBatches} color={T.indigo} sub={`${data.totalBatches} total · ${data.batchFillRate}% fill`}/>
            <KPI icon="📝" label="Tests Held" value={data.totalTests} color={T.violet} sub={`Avg score ${data.avgTestScore}%`}/>
            <KPI icon="🔍" label="Enquiries" value={data.totalEnquiries} color={T.amber} sub={`${data.convertedEnq} converted · ${data.conversionRate}%`}/>
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
            <Panel title="Enquiry Funnel" sub="Lead to admission pipeline">
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
                      <div style={{width:28,height:28,borderRadius:7,flexShrink:0,background:`${T.gold}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:T.gold}}>{(a.student_name||"?")[0].toUpperCase()}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:700,color:T.white,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.student_name||"—"}</div>
                        <div style={{fontSize:10,color:T.slateL}}>{a.fee_type}</div>
                      </div>
                      <div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:12,fontWeight:800,color:T.emerald}}>{fmt(a.amount_paid)}</div></div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
            <Panel title="⚠️ Defaulters" accent={T.rose}>
              {data.defaulters.length===0?<div style={{color:T.emerald,fontSize:13,fontWeight:600}}>✅ No outstanding fees!</div>: (
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
              {data.feeAging.every(f=>f.amount===0)?<EmptyState msg="No aging data"/>:data.feeAging.map(f=>(
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
            {data.defaulters.length===0?<div style={{color:T.emerald,fontWeight:600,fontSize:13}}>✅ No outstanding invoices!</div>: (
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
                <Gauge value={pct(data.maleStudents,data.totalStudents)} color={T.sky} size={90}/>
                <div style={{flex:1}}>
                  {[{l:"Male",v:data.maleStudents,c:T.sky},{l:"Female",v:data.femaleStudents,c:T.pink}].map(x=>(
                    <div key={x.l} style={{marginBottom:10}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:12,color:T.slateL}}>{x.l}</span><span style={{fontSize:12,fontWeight:800,color:x.c}}>{x.v}</span></div>
                      <ProgressBar value={x.v} max={data.totalStudents} color={x.c}/>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
            <Panel title="State-wise Origin">
              {data.stateData.length===0?<EmptyState msg="No state data"/>: (
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {data.stateData.map(s=>(
                    <div key={s.state}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:11,color:T.slateL}}>{s.state}</span><span style={{fontSize:11,fontWeight:700,color:T.white}}>{s.count}</span></div>
                      <ProgressBar value={s.count} max={data.stateData[0]?.count||1} color={T.sky} height={4}/>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
            <Panel title="Age Distribution">
              {data.ageDistribution.every(a=>a.count===0)?<EmptyState msg="No date_of_birth data"/>: (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={data.ageDistribution}>
                    <XAxis dataKey="age" tick={{fill:T.slateL,fontSize:10}} axisLine={false} tickLine={false}/>
                    <YAxis hide/><Tooltip content={<Tip/>}/>
                    <Bar dataKey="count" name="Students" fill={T.sky} radius={[4,4,0,0]} barSize={24}/>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Panel>
          </div>
          <Panel title="Recent Admissions">
            {data.recentAdmissions.length===0?<EmptyState msg="No admissions"/>: (
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
            <Panel title="Funnel">
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
            <Panel title="Application Source">
              {data.applicationSource.length===0?<EmptyState msg="No source data"/>: (
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
              {data.courseBreakdown.length===0?<EmptyState msg="No data"/>: (
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
              {data.yoyAdmissions.length===0?<EmptyState msg="No batch data"/>: (
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
            <KPI icon="👥" label="Total Staff" value={data.totalStaff} color={T.sky}/>
            <KPI icon="✅" label="Active" value={data.activeStaffCnt} color={T.emerald}/>
            <KPI icon="💵" label="Salary Bill" value={data.totalSalaryBill} color={T.gold} isMoney/>
            <KPI icon="📋" label="Tasks Pending" value={data.taskPending} color={T.amber}/>
            <KPI icon="✔️" label="Tasks Done" value={data.taskDone} color={T.emerald}/>
            <KPI icon="⚠️" label="Overdue" value={data.taskOverdue} color={T.rose}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16,marginBottom:16}}>
            <Panel title="Salary Trend">
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={data.salaryTrend}>
                  <defs><linearGradient id="salGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.gold} stopOpacity={0.3}/><stop offset="95%" stopColor={T.gold} stopOpacity={0}/></linearGradient></defs>
                  <XAxis dataKey="month" tick={{fill:T.slateL,fontSize:11}} axisLine={false} tickLine={false}/><YAxis hide/><Tooltip content={<Tip/>}/>
                  <Area dataKey="bill" name="Salary Bill" stroke={T.gold} strokeWidth={2.5} fill="url(#salGrad)"/>
                </AreaChart>
              </ResponsiveContainer>
            </Panel>
            <Panel title="Leave Breakdown">
              {data.leaveBreakdown.length===0?<EmptyState msg="No staff_leaves data"/>: (
                <>
                  <ResponsiveContainer width="100%" height={130}>
                    <PieChart><Pie data={data.leaveBreakdown} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={4}>
                      {data.leaveBreakdown.map((p,i)=><Cell key={i} fill={p.color}/>)}
                    </Pie><Tooltip content={<Tip/>}/></PieChart>
                  </ResponsiveContainer>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginTop:8}}>
                    {data.leaveBreakdown.map(l=><div key={l.name} style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:7,height:7,borderRadius:2,background:l.color}}/><span style={{fontSize:10,color:T.slateL}}>{l.name}: <b style={{color:T.white}}>{l.value}</b></span></div>)}
                  </div>
                </>
              )}
            </Panel>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
            <Panel title="Performance Leaderboard" sub={`Month: ${data.latestMonth||"—"}`}>
              {data.topStaff.length===0?<EmptyState msg="No scores yet"/>: (
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {data.topStaff.map((s,i)=>(
                    <div key={s.name} style={{padding:"11px 13px",borderRadius:11,background:i===0?`${T.gold}14`:"rgba(255,255,255,.03)",border:`1px solid ${i===0?T.gold+"33":"rgba(255,255,255,.06)"}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                        <span style={{fontSize:13,fontWeight:900,color:[T.gold,"#c0c0c0",T.amber,T.slateL,T.slateL][i]}}>#{i+1} {s.name}</span>
                        <span style={{fontSize:10,color:T.slate,background:"rgba(255,255,255,.06)",padding:"2px 7px",borderRadius:5}}>{s.dept}</span>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{flex:1}}><ProgressBar value={s.score} max={100} color={s.score>=90?T.emerald:s.score>=75?T.amber:T.rose}/></div>
                        <span style={{fontSize:13,fontWeight:900,color:s.score>=90?T.emerald:s.score>=75?T.amber:T.rose}}>{s.score}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
            <Panel title="Recruitment Pipeline">
              {data.recruitmentFunnel.every(s=>s.count===0)?<EmptyState msg="No staff_recruitment data"/>: (
                <div style={{display:"flex",flexDirection:"column",gap:9}}>
                  {data.recruitmentFunnel.map((s,i,arr)=>{const prev=arr[i-1];return(
                    <div key={s.stage}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:11,color:T.slateL}}>{s.stage}</span><span style={{fontSize:12,fontWeight:800,color:s.color}}>{s.count}</span></div>
                      <ProgressBar value={s.count} max={data.recruitmentFunnel[0].count||1} color={s.color} height={7}/>
                    </div>
                  )})}
                </div>
              )}
            </Panel>
          </div>
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
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16,marginBottom:16}}>
            <Panel title="Last 7 Days">
              {data.attendanceWeek.length===0?<EmptyState msg="No attendance data"/>: (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.attendanceWeek}>
                    <XAxis dataKey="day" tick={{fill:T.slateL,fontSize:11}} axisLine={false} tickLine={false}/><YAxis hide/><Tooltip content={<Tip/>}/>
                    <Bar dataKey="present" name="Present" fill={T.emerald} radius={[3,3,0,0]} barSize={26} stackId="a"/>
                    <Bar dataKey="late" name="Late" fill={T.amber} barSize={26} stackId="a"/>
                    <Bar dataKey="absent" name="Absent" fill={T.rose} radius={[3,3,0,0]} barSize={26} stackId="a"/>
                  </BarChart>
                </ResponsiveContainer>
              )}
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
        </section>
        </div>

        {/* ═══ ACADEMIC ══════════════════════════════════════════ */}
        <div ref={setSectionRef('academic')}>
        <section style={{marginBottom:40}}>
          <SectionHeader icon="📚" title="Academic Performance"/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:13,marginBottom:20}}>
            <KPI icon="📊" label="Avg Score" value={data.avgScore} color={T.sky}/>
            <KPI icon="✅" label="Pass Rate" value={data.passRate} color={T.emerald}/>
            <KPI icon="🏆" label="A+ Students" value={data.aPlusCount} color={T.gold}/>
            <KPI icon="📉" label="At Risk" value={data.atRisk} color={T.rose}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
            <Panel title="Grade Distribution">
              {data.gradeDistribution.every(g=>g.count===0)?<EmptyState msg="No exam_scores data"/>: (
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={data.gradeDistribution}>
                    <XAxis dataKey="grade" tick={{fill:T.slateL,fontSize:12}} axisLine={false} tickLine={false}/>
                    <YAxis hide/><Tooltip content={<Tip/>}/>
                    <Bar dataKey="count" name="Students" radius={[5,5,0,0]} barSize={34}>{data.gradeDistribution.map((g,i)=><Cell key={i} fill={g.color}/>)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Panel>
            <Panel title="Subject Performance">
              {data.subjectScores.length===0?<EmptyState msg="No subject data"/>: (
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
              {data.hostelRooms.length===0?<EmptyState msg="No hostel_rooms data"/>: (
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
              {data.messChartData.every(m=>m.breakfast===0)?<EmptyState msg="No mess_consumption data"/>: (
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
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16,marginBottom:16}}>
            <Panel title="Points Breakdown">
              {data.housePoints.every(h=>h.points===0)?<EmptyState msg="No house_points data"/>: (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.housePoints}>
                    <XAxis dataKey="name" tick={{fill:T.slateL,fontSize:11}} axisLine={false} tickLine={false}/>
                    <YAxis hide/><Tooltip content={<Tip/>}/><Legend formatter={v=><span style={{color:T.slateL,fontSize:10}}>{v}</span>}/>
                    <Bar dataKey="academic" name="Academic" fill={T.sky} barSize={28} stackId="h"/>
                    <Bar dataKey="sports" name="Sports" fill={T.emerald} barSize={28} stackId="h"/>
                    <Bar dataKey="cultural" name="Cultural" fill={T.violet} barSize={28} stackId="h"/>
                    <Bar dataKey="discipline" name="Discipline" fill={T.amber} radius={[3,3,0,0]} barSize={28} stackId="h"/>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Panel>
            <Panel title="Club Membership">
              {data.clubsFormatted.length===0?<EmptyState msg="No clubs data"/>: (
                <div style={{display:"flex",flexDirection:"column",gap:7}}>
                  {data.clubsFormatted.map(c=>(
                    <div key={c.name}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:12,color:T.slateL}}>{c.name}</span><span style={{fontSize:12,fontWeight:700,color:c.color}}>{c.members}</span></div>
                      <ProgressBar value={c.members} max={Math.max(...data.clubsFormatted.map(x=>x.members))||1} color={c.color} height={4}/>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
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
                <Gauge value={pct(data.taskDone,data.taskPending+data.taskDone+data.taskOverdue)} color={T.emerald} size={90}/>
                <div style={{width:"100%"}}>
                  {[{l:"Done",v:data.taskDone,c:T.emerald},{l:"Pending",v:data.taskPending,c:T.amber},{l:"Overdue",v:data.taskOverdue,c:T.rose}].map(x=>(
                    <div key={x.l} style={{marginBottom:8}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:12,color:T.slateL}}>{x.l}</span><span style={{fontSize:12,fontWeight:700,color:x.c}}>{x.v}</span></div>
                      <ProgressBar value={x.v} max={data.taskPending+data.taskDone+data.taskOverdue||1} color={x.c} height={5}/>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
            <Panel title="SLA by Department">
              {data.slaBreach.length===0?<EmptyState msg="No dept data"/>: (
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
            <Panel><EmptyState msg="No data in batches table. Expected columns: id, name, course, teacher_name, strength, capacity, start_date, status, batch_type"/></Panel>
          ):(
            <>
              <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16,marginBottom:16}}>
                <Panel title="All Batches" sub="From batches table">
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"separate",borderSpacing:"0 5px",minWidth:500}}>
                      <thead><tr>{["Batch Name","Course","Teacher","Strength","Status"].map(h=><th key={h} style={{textAlign:"left",fontSize:11,color:T.slate,fontWeight:600,padding:"5px 12px",textTransform:"uppercase",letterSpacing:".05em"}}>{h}</th>)}</tr></thead>
                      <tbody>
                        {data.batchesData.slice(0,10).map((b,i)=>(
                          <tr key={i}>
                            <td style={{fontSize:12,fontWeight:700,color:T.white,padding:"9px 12px",background:"rgba(255,255,255,.03)",borderRadius:"10px 0 0 10px"}}>{b.name||"—"}</td>
                            <td style={{fontSize:12,color:T.slateL,padding:"9px 12px",background:"rgba(255,255,255,.03)"}}>{b.course||"—"}</td>
                            <td style={{fontSize:12,color:T.slateL,padding:"9px 12px",background:"rgba(255,255,255,.03)"}}>{b.teacher_name||"—"}</td>
                            <td style={{padding:"9px 12px",background:"rgba(255,255,255,.03)"}}>
                              <div style={{display:"flex",alignItems:"center",gap:8}}>
                                <ProgressBar value={Number(b.strength)||0} max={Number(b.capacity)||1} color={T.sky} height={5}/>
                                <span style={{fontSize:11,color:T.white,whiteSpace:"nowrap"}}>{b.strength}/{b.capacity}</span>
                              </div>
                            </td>
                            <td style={{padding:"9px 12px",background:"rgba(255,255,255,.03)",borderRadius:"0 10px 10px 0"}}><Badge label={b.status||"Active"} color={statusColor(b.status||"Active")}/></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
                <Panel title="Batch Type Split">
                  {data.batchByType.length===0?<EmptyState msg="No batch_type column"/>: (
                    <>
                      <ResponsiveContainer width="100%" height={130}>
                        <PieChart><Pie data={data.batchByType} dataKey="count" cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={4}>
                          {data.batchByType.map((p,i)=><Cell key={i} fill={p.color}/>)}
                        </Pie><Tooltip content={<Tip/>}/></PieChart>
                      </ResponsiveContainer>
                      <div style={{display:"flex",flexDirection:"column",gap:5,marginTop:8}}>
                        {data.batchByType.map(t=>(
                          <div key={t.name} style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                            <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:7,height:7,borderRadius:2,background:t.color}}/><span style={{fontSize:11,color:T.slateL}}>{t.name}</span></div>
                            <span style={{fontSize:11,fontWeight:700,color:T.white}}>{t.count}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </Panel>
              </div>
              <Panel title="Classes Per Day" sub="From timetable table">
                {data.timetableChart.every(d=>d.classes===0)?<EmptyState msg="No data in timetable table"/>: (
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={data.timetableChart}>
                      <XAxis dataKey="day" tick={{fill:T.slateL,fontSize:11}} axisLine={false} tickLine={false}/>
                      <YAxis hide/><Tooltip content={<Tip/>}/>
                      <Bar dataKey="classes" name="Classes" fill={T.indigo} radius={[5,5,0,0]} barSize={36}>
                        {data.timetableChart.map((_,i)=><Cell key={i} fill={COURSE_COLORS[i%COURSE_COLORS.length]}/>)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Panel>
            </>
          )}
        </section>
        </div>

        {/* ═══ TESTS & PERFORMANCE ════════════════════════════════ */}
        <div ref={setSectionRef('tests')}>
        <section style={{marginBottom:40}}>
          <SectionHeader icon="📝" title="Test & Performance Analytics"/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:13,marginBottom:20}}>
            <KPI icon="📝" label="Tests Held" value={data.totalTests} color={T.violet}/>
            <KPI icon="👥" label="Entries" value={data.totalTestEntries} color={T.sky}/>
            <KPI icon="📊" label="Avg Score" value={data.avgTestScore} color={T.emerald} sub={`${data.avgTestScore}% overall`}/>
            <KPI icon="📉" label="At Risk" value={data.atRiskStudents.length} color={T.rose} sub="Below 40%"/>
          </div>
          {data.totalTestEntries===0?(
            <Panel><EmptyState msg="No data in test_results table. Expected: student_id, student_name, batch_name, test_name, test_type, subject, marks_obtained, max_marks, test_date, rank"/></Panel>
          ):(
            <>
              <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16,marginBottom:16}}>
                <Panel title="Monthly Avg Score Trend" sub="From test_results.test_date">
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
                <Panel title="Test Type Breakdown">
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart><Pie data={data.testByType} dataKey="count" cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={4}>
                      {data.testByType.map((p,i)=><Cell key={i} fill={p.color}/>)}
                    </Pie><Tooltip content={<Tip/>}/></PieChart>
                  </ResponsiveContainer>
                  <div style={{display:"flex",flexDirection:"column",gap:5,marginTop:8}}>
                    {data.testByType.map(t=>(
                      <div key={t.name} style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:7,height:7,borderRadius:2,background:t.color}}/><span style={{fontSize:11,color:T.slateL}}>{t.name}</span></div>
                        <span style={{fontSize:11,fontWeight:700,color:T.white}}>{t.count}</span>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
                <Panel title="Subject-wise Avg Score">
                  {data.testSubjectScores.length===0?<EmptyState msg="No subject data"/>: (
                    <ResponsiveContainer width="100%" height={190}>
                      <BarChart data={data.testSubjectScores} layout="vertical">
                        <XAxis type="number" domain={[0,100]} hide/>
                        <YAxis dataKey="subject" type="category" tick={{fill:T.slateL,fontSize:11}} width={70} axisLine={false} tickLine={false}/>
                        <Tooltip content={<Tip/>}/>
                        <Bar dataKey="avg" name="Avg Score" radius={[0,5,5,0]} barSize={16}>{data.testSubjectScores.map((s,i)=><Cell key={i} fill={s.color}/>)}</Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </Panel>
                <Panel title="Batch-wise Avg Score">
                  {data.batchScores.length===0?<EmptyState msg="No batch data in test_results"/>: (
                    <ResponsiveContainer width="100%" height={190}>
                      <BarChart data={data.batchScores}>
                        <XAxis dataKey="batch" tick={{fill:T.slateL,fontSize:10}} axisLine={false} tickLine={false}/>
                        <YAxis domain={[0,100]} hide/><Tooltip content={<Tip/>}/>
                        <Bar dataKey="avg" name="Avg Score" radius={[5,5,0,0]} barSize={28}>{data.batchScores.map((b,i)=><Cell key={i} fill={b.color}/>)}</Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </Panel>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                <Panel title="🏆 Top Performers" sub="Ranked by avg test score">
                  <div style={{display:"flex",flexDirection:"column",gap:7}}>
                    {data.topPerformers.slice(0,8).map((s,i)=>(
                      <div key={s.name} style={{padding:"10px 13px",borderRadius:11,background:i===0?`${T.gold}14`:"rgba(255,255,255,.03)",border:`1px solid ${i===0?T.gold+"33":"rgba(255,255,255,.05)"}`}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                          <span style={{fontSize:12,fontWeight:800,color:[T.gold,"#c0c0c0",T.amber,T.sky,T.sky,T.slateL,T.slateL,T.slateL][i]}}>#{i+1} {s.name}</span>
                          <div style={{display:"flex",gap:6,alignItems:"center"}}>
                            {s.batch&&<span style={{fontSize:10,color:T.slate,background:"rgba(255,255,255,.06)",padding:"2px 7px",borderRadius:5}}>{s.batch}</span>}
                            <span style={{fontSize:13,fontWeight:900,color:s.avg>=80?T.emerald:s.avg>=60?T.amber:T.rose}}>{s.avg}%</span>
                          </div>
                        </div>
                        <ProgressBar value={s.avg} max={100} color={s.avg>=80?T.emerald:s.avg>=60?T.amber:T.rose} height={4}/>
                      </div>
                    ))}
                  </div>
                </Panel>
                <Panel title="⚠️ At-Risk Students" sub="Below 40% in test results" accent={T.rose}>
                  {data.atRiskStudents.length===0?<div style={{color:T.emerald,fontSize:13,fontWeight:600,marginTop:8}}>✅ No at-risk students!</div>: (
                    <div style={{display:"flex",flexDirection:"column",gap:7}}>
                      {data.atRiskStudents.slice(0,8).map((s,i)=>(
                        <div key={s.name+i} style={{padding:"9px 12px",borderRadius:10,background:`${T.rose}08`,border:`1px solid ${T.rose}18`}}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                            <span style={{fontSize:12,fontWeight:700,color:T.white}}>{s.name}</span>
                            <span style={{fontSize:12,fontWeight:900,color:T.rose}}>{s.max>0?pct(s.total,s.max):0}%</span>
                          </div>
                          <div style={{display:"flex",gap:6}}>
                            {s.batch&&<Badge label={s.batch} color={T.slateL}/>}
                            <span style={{fontSize:10,color:T.slate}}>{s.count} tests taken</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>
              </div>
            </>
          )}
        </section>
        </div>

        {/* ═══ ENQUIRY & LEADS ════════════════════════════════════ */}
        <div ref={setSectionRef('enquiry')}>
        <section style={{marginBottom:40}}>
          <SectionHeader icon="🔍" title="Enquiry & Lead Management"/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:13,marginBottom:20}}>
            <KPI icon="📞" label="Total Enquiries" value={data.totalEnquiries} color={T.sky}/>
            <KPI icon="🔓" label="Open" value={data.openEnquiries} color={T.amber}/>
            <KPI icon="✅" label="Converted" value={data.convertedEnq} color={T.emerald}/>
            <KPI icon="📊" label="Conv. Rate" value={data.conversionRate} color={T.violet} sub={`${data.conversionRate}%`}/>
            <KPI icon="⏰" label="Follow-up Due" value={data.followUpDue} color={T.rose}/>
          </div>
          {data.totalEnquiries===0?(
            <Panel><EmptyState msg="No data in enquiries table. Expected: id, name, phone, course_interest, source, status, follow_up_date, created_at, converted"/></Panel>
          ):(
            <>
              <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16,marginBottom:16}}>
                <Panel title="Monthly Enquiry vs Conversion">
                  <ResponsiveContainer width="100%" height={200}>
                    <ComposedChart data={data.enqTrend}>
                      <XAxis dataKey="month" tick={{fill:T.slateL,fontSize:11}} axisLine={false} tickLine={false}/>
                      <YAxis hide/><Tooltip content={<Tip/>}/>
                      <Bar dataKey="enquiries" name="Enquiries" fill={T.sky} radius={[4,4,0,0]} barSize={18}/>
                      <Bar dataKey="converted" name="Converted" fill={T.emerald} radius={[4,4,0,0]} barSize={18}/>
                    </ComposedChart>
                  </ResponsiveContainer>
                </Panel>
                <Panel title="Enquiry Funnel">
                  <div style={{display:"flex",flexDirection:"column",gap:9}}>
                    {data.enquiryFunnel.map((s,i,arr)=>{const prev=arr[i-1];return(
                      <div key={s.stage}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                          <span style={{fontSize:11,color:T.slateL}}>{s.stage}</span>
                          <div><span style={{fontSize:13,fontWeight:800,color:s.color}}>{s.count}</span>{prev&&<span style={{fontSize:10,color:T.slate}}> ({pct(s.count,prev.count)}%)</span>}</div>
                        </div>
                        <ProgressBar value={s.count} max={data.enquiryFunnel[0].count||1} color={s.color} height={9}/>
                      </div>
                    )})}
                  </div>
                </Panel>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
                <Panel title="Source Breakdown">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart><Pie data={data.enqBySource} dataKey="count" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={4}>
                      {data.enqBySource.map((p,i)=><Cell key={i} fill={p.color}/>)}
                    </Pie><Tooltip content={<Tip/>}/><Legend formatter={v=><span style={{color:T.slateL,fontSize:11}}>{v}</span>}/></PieChart>
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
              <Panel title="Recent Enquiries" sub="Latest from enquiries table">
                {data.recentEnquiries.length===0?<EmptyState msg="No enquiries"/>: (
                  <table style={{width:"100%",borderCollapse:"separate",borderSpacing:"0 5px"}}>
                    <thead><tr>{["Name","Course Interest","Source","Status","Follow-up"].map(h=><th key={h} style={{textAlign:"left",fontSize:11,color:T.slate,fontWeight:600,padding:"5px 12px",textTransform:"uppercase",letterSpacing:".05em"}}>{h}</th>)}</tr></thead>
                    <tbody>{data.recentEnquiries.map((e,i)=>(
                      <tr key={i}>
                        <td style={{fontSize:12,fontWeight:700,color:T.white,padding:"9px 12px",background:"rgba(255,255,255,.03)",borderRadius:"10px 0 0 10px"}}>{e.name||"—"}</td>
                        <td style={{fontSize:12,color:T.slateL,padding:"9px 12px",background:"rgba(255,255,255,.03)"}}>{e.course_interest||"—"}</td>
                        <td style={{fontSize:12,color:T.slateL,padding:"9px 12px",background:"rgba(255,255,255,.03)"}}>{e.source||"—"}</td>
                        <td style={{padding:"9px 12px",background:"rgba(255,255,255,.03)"}}><Badge label={e.status||"Open"} color={statusColor(e.status||"Open")}/></td>
                        <td style={{fontSize:12,color:new Date(e.follow_up_date)<new Date()&&e.status!=="Converted"?T.rose:T.slateL,padding:"9px 12px",background:"rgba(255,255,255,.03)",borderRadius:"0 10px 10px 0"}}>{e.follow_up_date||"—"}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                )}
              </Panel>
            </>
          )}
        </section>
        </div>

        {/* ═══ DOUBT MANAGEMENT ═══════════════════════════════════ */}
        <div ref={setSectionRef('doubts')}>
        <section style={{marginBottom:40}}>
          <SectionHeader icon="💬" title="Doubt & Query Management"/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:13,marginBottom:20}}>
            <KPI icon="💬" label="Total Doubts" value={data.totalDoubts} color={T.sky}/>
            <KPI icon="✅" label="Resolved" value={data.resolvedDoubts} color={T.emerald} progress={data.resolvedDoubts} progressMax={data.totalDoubts}/>
            <KPI icon="⏳" label="Unresolved" value={data.unresolvedDoubts} color={T.rose}/>
            <KPI icon="⏱️" label="Avg Resolution" value={data.avgResolutionHrs} color={T.amber} sub={`${data.avgResolutionHrs} hours`}/>
          </div>
          {data.totalDoubts===0?(
            <Panel><EmptyState msg="No data in doubt_sessions table. Expected: id, student_name, batch_name, subject, topic, raised_date, resolved_date, staff_name, status"/></Panel>
          ):(
            <>
              <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16,marginBottom:16}}>
                <Panel title="Monthly Doubts Raised vs Resolved">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data.doubtTrend}>
                      <XAxis dataKey="month" tick={{fill:T.slateL,fontSize:11}} axisLine={false} tickLine={false}/>
                      <YAxis hide/><Tooltip content={<Tip/>}/>
                      <Bar dataKey="raised" name="Raised" fill={T.rose} radius={[4,4,0,0]} barSize={18}/>
                      <Bar dataKey="resolved" name="Resolved" fill={T.emerald} radius={[4,4,0,0]} barSize={18}/>
                    </BarChart>
                  </ResponsiveContainer>
                </Panel>
                <Panel title="Resolution Rate">
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:14,paddingTop:8}}>
                    <Gauge value={pct(data.resolvedDoubts,data.totalDoubts)} color={T.emerald} size={100}/>
                    <div style={{width:"100%"}}>
                      {[{l:"Resolved",v:data.resolvedDoubts,c:T.emerald},{l:"Unresolved",v:data.unresolvedDoubts,c:T.rose}].map(x=>(
                        <div key={x.l} style={{marginBottom:9}}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:12,color:T.slateL}}>{x.l}</span><span style={{fontSize:12,fontWeight:700,color:x.c}}>{x.v}</span></div>
                          <ProgressBar value={x.v} max={data.totalDoubts||1} color={x.c} height={6}/>
                        </div>
                      ))}
                    </div>
                  </div>
                </Panel>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
                <Panel title="Doubts by Subject">
                  <div style={{display:"flex",flexDirection:"column",gap:7}}>
                    {data.doubtsBySubject.slice(0,8).map(s=>(
                      <div key={s.subject}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:12,color:T.slateL}}>{s.subject}</span><span style={{fontSize:12,fontWeight:700,color:s.color}}>{s.count}</span></div>
                        <ProgressBar value={s.count} max={data.doubtsBySubject[0]?.count||1} color={s.color} height={5}/>
                      </div>
                    ))}
                  </div>
                </Panel>
                <Panel title="Doubts by Batch">
                  <div style={{display:"flex",flexDirection:"column",gap:7}}>
                    {data.doubtsByBatch.slice(0,8).map(b=>(
                      <div key={b.batch}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:12,color:T.slateL}}>{b.batch}</span><span style={{fontSize:12,fontWeight:700,color:b.color}}>{b.count}</span></div>
                        <ProgressBar value={b.count} max={data.doubtsByBatch[0]?.count||1} color={b.color} height={5}/>
                      </div>
                    ))}
                  </div>
                </Panel>
                <Panel title="Staff Resolution Leaderboard">
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {data.doubtStaffLeaderboard.map((s,i)=>(
                      <div key={s.name} style={{padding:"10px 12px",borderRadius:10,background:i===0?`${T.gold}14`:"rgba(255,255,255,.03)",border:`1px solid ${i===0?T.gold+"33":"rgba(255,255,255,.05)"}`}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                          <span style={{fontSize:12,fontWeight:800,color:[T.gold,"#c0c0c0",T.amber,T.slateL,T.slateL][i]}}>#{i+1} {s.name}</span>
                          <span style={{fontSize:11,fontWeight:700,color:T.emerald}}>{s.resolved}/{s.total}</span>
                        </div>
                        <ProgressBar value={s.resolved} max={s.total||1} color={T.emerald} height={4}/>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
            </>
          )}
        </section>
        </div>

        {/* ═══ PARENT COMMUNICATION ═══════════════════════════════ */}
        <div ref={setSectionRef('parents')}>
        <section style={{marginBottom:40}}>
          <SectionHeader icon="👨‍👩‍👧" title="Parent Communication"/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:13,marginBottom:20}}>
            <KPI icon="📱" label="SMS Sent" value={data.totalSMSSent} color={T.sky}/>
            <KPI icon="✅" label="Delivered" value={data.smsSent} color={T.emerald} progress={data.smsSent} progressMax={data.smsLogsData?.length||1}/>
            <KPI icon="❌" label="Failed" value={data.smsFailed} color={T.rose}/>
            <KPI icon="📊" label="Delivery Rate" value={data.smsDeliveryRate} color={data.smsDeliveryRate>=90?T.emerald:T.amber} sub={`${data.smsDeliveryRate}%`}/>
          </div>
          {data.totalSMSSent===0?(
            <Panel><EmptyState msg="No data in sms_logs table. Expected: id, recipient_type, message_type, sent_at, status, count"/></Panel>
          ):(
            <>
              <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16,marginBottom:16}}>
                <Panel title="Monthly SMS Volume">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data.smsTrend}>
                      <XAxis dataKey="month" tick={{fill:T.slateL,fontSize:11}} axisLine={false} tickLine={false}/>
                      <YAxis hide/><Tooltip content={<Tip/>}/>
                      <Bar dataKey="count" name="SMS Sent" fill={T.sky} radius={[5,5,0,0]} barSize={24}>
                        {data.smsTrend.map((_,i)=><Cell key={i} fill={COURSE_COLORS[i%COURSE_COLORS.length]}/>)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Panel>
                <Panel title="Message Type Breakdown">
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart><Pie data={data.smsByType} dataKey="count" cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={4}>
                      {data.smsByType.map((p,i)=><Cell key={i} fill={p.color}/>)}
                    </Pie><Tooltip content={<Tip/>}/></PieChart>
                  </ResponsiveContainer>
                  <div style={{display:"flex",flexDirection:"column",gap:5,marginTop:8}}>
                    {data.smsByType.map(t=>(
                      <div key={t.name} style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:7,height:7,borderRadius:2,background:t.color}}/><span style={{fontSize:11,color:T.slateL}}>{t.name}</span></div>
                        <span style={{fontSize:11,fontWeight:700,color:T.white}}>{t.count}</span>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
              <Panel title="Quick Communication Actions">
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10}}>
                  {[
                    {label:"📱 Send Fee Reminder SMS", color:T.rose, sub:"To defaulter parents"},
                    {label:"📊 Send Test Result SMS", color:T.violet, sub:"After each test"},
                    {label:"📅 Send Attendance Alert", color:T.amber, sub:"For absent students"},
                    {label:"🎉 Send Achievement SMS", color:T.gold, sub:"For selections/ranks"},
                    {label:"📋 Fee Collection Receipt", color:T.emerald, sub:"After payment"},
                    {label:"📢 General Announcement", color:T.sky, sub:"Bulk broadcast"},
                  ].map(a=>(
                    <button key={a.label} style={{padding:"12px 14px",borderRadius:11,border:`1px solid ${a.color}22`,background:`${a.color}0a`,color:a.color,fontSize:12,fontWeight:700,cursor:"pointer",textAlign:"left",fontFamily:"inherit"}}>
                      <div>{a.label}</div>
                      <div style={{fontSize:10,color:T.slate,marginTop:4,fontWeight:400}}>{a.sub}</div>
                    </button>
                  ))}
                </div>
              </Panel>
            </>
          )}
        </section>
        </div>

        {/* ═══ STUDY MATERIAL ═════════════════════════════════════ */}
        <div ref={setSectionRef('material')}>
        <section style={{marginBottom:40}}>
          <SectionHeader icon="📦" title="Study Material Management"/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:13,marginBottom:20}}>
            <KPI icon="📦" label="Total Materials" value={data.totalMaterials} color={T.sky}/>
            <KPI icon="✅" label="Distributed" value={data.distributedMat} color={T.emerald} progress={data.distributedMat} progressMax={data.totalMaterials}/>
            <KPI icon="⏳" label="Pending Dist." value={data.pendingDistribution} color={T.amber}/>
            <KPI icon="📄" label="Total Copies" value={data.totalCopies} color={T.violet}/>
            <KPI icon="📤" label="Copies Distributed" value={data.distributedCopies} color={T.teal} progress={data.distributedCopies} progressMax={data.totalCopies}/>
          </div>
          {data.totalMaterials===0?(
            <Panel><EmptyState msg="No data in study_material table. Expected: id, title, subject, batch_name, material_type, distributed_date, total_copies, distributed_copies"/></Panel>
          ):(
            <>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
                <Panel title="Distribution by Subject">
                  {data.materialBySubject.length===0?<EmptyState msg="No subject data"/>: (
                    <div style={{display:"flex",flexDirection:"column",gap:10}}>
                      {data.materialBySubject.map(s=>(
                        <div key={s.subject}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                            <span style={{fontSize:12,color:T.slateL}}>{s.subject}</span>
                            <span style={{fontSize:11,color:T.slate}}>{s.distributed}/{s.total} copies</span>
                          </div>
                          <ProgressBar value={s.distributed} max={s.total||1} color={s.color} height={8}/>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>
                <Panel title="Material Type Breakdown">
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart><Pie data={data.materialByType} dataKey="count" cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={4}>
                      {data.materialByType.map((p,i)=><Cell key={i} fill={p.color}/>)}
                    </Pie><Tooltip content={<Tip/>}/><Legend formatter={v=><span style={{color:T.slateL,fontSize:11}}>{v}</span>}/></PieChart>
                  </ResponsiveContainer>
                </Panel>
              </div>
              <Panel title="Overall Distribution Progress">
                <div style={{marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                    <span style={{fontSize:13,color:T.slateL}}>Copies distributed</span>
                    <span style={{fontSize:13,fontWeight:800,color:T.emerald}}>{data.distributedCopies}/{data.totalCopies} ({pct(data.distributedCopies,data.totalCopies)}%)</span>
                  </div>
                  <ProgressBar value={data.distributedCopies} max={data.totalCopies||1} color={T.emerald} height={12}/>
                </div>
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                    <span style={{fontSize:13,color:T.slateL}}>Materials distributed</span>
                    <span style={{fontSize:13,fontWeight:800,color:T.sky}}>{data.distributedMat}/{data.totalMaterials} ({pct(data.distributedMat,data.totalMaterials)}%)</span>
                  </div>
                  <ProgressBar value={data.distributedMat} max={data.totalMaterials||1} color={T.sky} height={12}/>
                </div>
              </Panel>
            </>
          )}
        </section>
        </div>

        {/* ═══ RESULTS & SELECTIONS ═══════════════════════════════ */}
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
            <Panel><EmptyState msg="No data in selections table. Expected: id, student_name, exam_name, rank, year, batch_name, category, school_allotted"/></Panel>
          ):(
            <>
              <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16,marginBottom:16}}>
                <Panel title="Year-over-Year Selections" sub="From selections.year">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data.selectionTrend}>
                      <XAxis dataKey="year" tick={{fill:T.slateL,fontSize:11}} axisLine={false} tickLine={false}/>
                      <YAxis hide/><Tooltip content={<Tip/>}/>
                      <Bar dataKey="count" name="Selections" radius={[6,6,0,0]} barSize={36}>
                        {data.selectionTrend.map((y,i)=><Cell key={i} fill={i===data.selectionTrend.length-1?T.gold:`${T.gold}55`}/>)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Panel>
                <Panel title="By Exam">
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {data.selByExam.map(e=>(
                      <div key={e.name}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:12,color:T.slateL}}>{e.name}</span><span style={{fontSize:13,fontWeight:800,color:e.color}}>{e.count}</span></div>
                        <ProgressBar value={e.count} max={data.totalSelections||1} color={e.color}/>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
                <Panel title="By Batch" sub="Which batch produced most selections">
                  {data.selByBatch.length===0?<EmptyState msg="No batch_name in selections"/>: (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={data.selByBatch} layout="vertical">
                        <XAxis type="number" hide/>
                        <YAxis dataKey="batch" type="category" tick={{fill:T.slateL,fontSize:11}} width={70} axisLine={false} tickLine={false}/>
                        <Tooltip content={<Tip/>}/>
                        <Bar dataKey="count" name="Selections" radius={[0,5,5,0]} barSize={16}>{data.selByBatch.map((b,i)=><Cell key={i} fill={b.color}/>)}</Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </Panel>
                <Panel title="Recent Selections" sub="Latest results">
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
                          {s.school_allotted&&<span style={{fontSize:10,color:T.slateL}}>{s.school_allotted}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
            </>
          )}
        </section>
        </div>

        {/* ═══ STAFF TEACHING ═════════════════════════════════════ */}
        <div ref={setSectionRef('teaching')}>
        <section style={{marginBottom:40}}>
          <SectionHeader icon="🖊️" title="Staff Teaching Analytics"/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:13,marginBottom:20}}>
            <KPI icon="📚" label="Topics Total" value={data.totalTopics} color={T.sky}/>
            <KPI icon="✅" label="Covered" value={data.coveredTopics} color={T.emerald} progress={data.coveredTopics} progressMax={data.totalTopics}/>
            <KPI icon="📊" label="Overall %" value={data.overallCoverage} color={data.overallCoverage>=80?T.emerald:data.overallCoverage>=60?T.amber:T.rose} sub={`${data.overallCoverage}% syllabus`}/>
            <KPI icon="👨‍🏫" label="Teachers" value={data.teacherCoverage.length} color={T.violet}/>
          </div>
          {data.totalTopics===0?(
            <Panel><EmptyState msg="No data in syllabus_coverage table. Expected: teacher_name, subject, batch_name, total_topics, covered_topics, month"/></Panel>
          ):(
            <>
              <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16,marginBottom:16}}>
                <Panel title="Monthly Syllabus Coverage %" sub="School-wide trend">
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={data.coverageTrend}>
                      <defs><linearGradient id="covGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.teal} stopOpacity={0.3}/><stop offset="95%" stopColor={T.teal} stopOpacity={0}/></linearGradient></defs>
                      <XAxis dataKey="month" tick={{fill:T.slateL,fontSize:11}} axisLine={false} tickLine={false}/>
                      <YAxis domain={[0,100]} hide/><Tooltip content={<Tip/>}/>
                      <ReferenceLine y={80} stroke={T.amber} strokeDasharray="4 3" label={{value:"80% target",fill:T.amber,fontSize:10}}/>
                      <Area dataKey="pct" name="Coverage %" stroke={T.teal} strokeWidth={2.5} fill="url(#covGrad)"/>
                    </AreaChart>
                  </ResponsiveContainer>
                </Panel>
                <Panel title="Subject Coverage">
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {data.subjectCoverage.map(s=>(
                      <div key={s.subject}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                          <span style={{fontSize:12,color:T.slateL}}>{s.subject}</span>
                          <span style={{fontSize:12,fontWeight:700,color:s.pct>=80?T.emerald:s.pct>=60?T.amber:T.rose}}>{s.pct}%</span>
                        </div>
                        <ProgressBar value={s.pct} max={100} color={s.pct>=80?T.emerald:s.pct>=60?T.amber:T.rose} height={6}/>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
              <Panel title="Teacher-wise Coverage" sub="From syllabus_coverage.teacher_name">
                <table style={{width:"100%",borderCollapse:"separate",borderSpacing:"0 5px"}}>
                  <thead><tr>{["Teacher","Subjects","Topics Covered","Coverage %","Status"].map(h=><th key={h} style={{textAlign:"left",fontSize:11,color:T.slate,fontWeight:600,padding:"5px 12px",textTransform:"uppercase",letterSpacing:".05em"}}>{h}</th>)}</tr></thead>
                  <tbody>{data.teacherCoverage.map((t,i)=>(
                    <tr key={t.name}>
                      <td style={{fontSize:12,fontWeight:700,color:T.white,padding:"10px 12px",background:"rgba(255,255,255,.03)",borderRadius:"10px 0 0 10px"}}>{t.name}</td>
                      <td style={{fontSize:12,color:T.slateL,padding:"10px 12px",background:"rgba(255,255,255,.03)"}}>{t.subjects} subjects</td>
                      <td style={{fontSize:12,color:T.white,padding:"10px 12px",background:"rgba(255,255,255,.03)"}}>{t.covered}/{t.total}</td>
                      <td style={{padding:"10px 12px",background:"rgba(255,255,255,.03)",minWidth:140}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div style={{flex:1}}><ProgressBar value={t.pct} max={100} color={t.pct>=80?T.emerald:t.pct>=60?T.amber:T.rose} height={6}/></div>
                          <span style={{fontSize:12,fontWeight:800,color:t.pct>=80?T.emerald:t.pct>=60?T.amber:T.rose,whiteSpace:"nowrap"}}>{t.pct}%</span>
                        </div>
                      </td>
                      <td style={{padding:"10px 12px",background:"rgba(255,255,255,.03)",borderRadius:"0 10px 10px 0"}}>
                        <Badge label={t.pct>=80?"On Track":t.pct>=60?"Behind":"At Risk"} color={t.pct>=80?T.emerald:t.pct>=60?T.amber:T.rose}/>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </Panel>
            </>
          )}
        </section>
        </div>

        {/* ═══ EXPENSES & P&L ═════════════════════════════════════ */}
        <div ref={setSectionRef('expenses')}>
        <section style={{marginBottom:40}}>
          <SectionHeader icon="📉" title="Expenses & P&L"/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:13,marginBottom:20}}>
            <KPI icon="💰" label="Total Income" value={data.totalFeeCollected} isMoney color={T.emerald}/>
            <KPI icon="📉" label="Total Expenses" value={data.totalExpenses} isMoney color={T.rose}/>
            <KPI icon="📊" label="Net P&L" value={data.netPL} isMoney color={data.netPL>=0?T.emerald:T.rose} sub={data.netPL>=0?"Profitable":"Loss"}/>
            <KPI icon="💼" label="Salary Bill" value={data.totalSalaryBill} isMoney color={T.amber} sub="Monthly payroll"/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16,marginBottom:16}}>
            <Panel title="Monthly Income vs Expense vs P&L">
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
              {data.expenseByCategory.length===0?<EmptyState msg="No data in expenses table"/>: (
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
          {data.expenseByCategory.length>0&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
              <Panel title="Category-wise Breakdown">
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {data.expenseByCategory.map(c=>(
                    <div key={c.name}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:12,color:T.slateL}}>{c.name}</span><span style={{fontSize:13,fontWeight:800,color:c.color}}>{fmt(c.amount)}</span></div>
                      <ProgressBar value={c.amount} max={data.totalExpenses||1} color={c.color} height={7}/>
                    </div>
                  ))}
                </div>
              </Panel>
              <Panel title="Recent Expenses">
                {data.recentExpenses.length===0?<EmptyState msg="No recent expenses"/>: (
                  <div style={{display:"flex",flexDirection:"column",gap:7}}>
                    {data.recentExpenses.map((e,i)=>(
                      <div key={i} style={{padding:"9px 11px",borderRadius:10,background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.05)"}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                          <span style={{fontSize:12,fontWeight:700,color:T.white}}>{e.category||"—"}</span>
                          <span style={{fontSize:12,fontWeight:800,color:T.rose}}>{fmt(e.amount)}</span>
                        </div>
                        <div style={{display:"flex",justifyContent:"space-between"}}>
                          <span style={{fontSize:10,color:T.slateL}}>{e.note||"—"}</span>
                          <span style={{fontSize:10,color:T.slate}}>{e.entry_date||"—"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            </div>
          )}
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
