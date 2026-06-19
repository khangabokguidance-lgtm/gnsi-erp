import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { supabase } from './supabase'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import IncomeAnalysis from './IncomeAnalysis'

// ── constants ──────────────────────────────────────────────────────────────
const INCOME_CATEGORIES  = ['Admission', 'Fees', 'Hostel', 'Donation', 'Registration', 'Other']
const EXPENSE_CATEGORIES = ['Salary', 'Electricity', 'Stationery', 'Maintenance', 'Transport', 'Event', 'Other']
const PAYMENT_MODES      = ['Cash', 'Bank', 'UPI', 'Card']
const ACCOUNT_TYPES      = ['Cash A/c', '2026-27 A/c', '2025-26 A/c']
const CHART_COLORS       = ['#1e3a5f','#16a34a','#dc2626','#f59e0b','#7c3aed','#0891b2','#be185d','#047857']
const STATUS_OPTIONS     = ['Confirmed', 'Pending']
const PAGE_SIZES         = [25, 50, 100]
const RECEIPT_BUCKET     = 'account-receipts'

// ── PHASE 1: removed module-level today constant (now reactive state inside component) ──

const emptyRow = {
  entry_date   : new Date().toLocaleDateString('en-CA'),
  payment_date : new Date().toLocaleDateString('en-CA'), // actual date money was received (Income only)
  type         : 'Income',
  category     : '',
  amount       : '',
  payment_mode : 'Cash',
  account_type : 'Cash A/c',
  voucher_head : '',
  note         : '',
  is_recurring : false,
  receipt_url  : '',
  status       : 'Confirmed',
}

const DEFAULT_BUDGETS = {
  Salary:0, Electricity:0, Stationery:0,
  Maintenance:0, Transport:0, Event:0, Other:0,
}

// ── helpers ────────────────────────────────────────────────────────────────
const fmt      = (n) => `₹${Number(n).toLocaleString('en-IN')}`
const monthKey = (d) => d ? d.slice(0,7) : ''
// PHASE 1 FIX: getToday() helper used for reactive today state
const getToday = () => new Date().toLocaleDateString('en-CA')

// ── responsive hook ────────────────────────────────────────────────────────
function useWindowWidth() {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024)
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return width
}

function getQuickRange(key) {
  const now=new Date(),yyyy=now.getFullYear(),mm=String(now.getMonth()+1).padStart(2,'0')
  const pad=(n)=>String(n).padStart(2,'0')
  const todayStr=getToday()
  if (key==='today')    return {from:todayStr,to:todayStr}
  if (key==='week'){const d=new Date(now);d.setDate(now.getDate()-now.getDay());return{from:d.toLocaleDateString('en-CA'),to:todayStr}}
  if (key==='month')    return {from:`${yyyy}-${mm}-01`,to:todayStr}
  if (key==='lastmonth'){
    const d=new Date(yyyy,now.getMonth()-1,1),last=new Date(yyyy,now.getMonth(),0)
    return{from:`${d.getFullYear()}-${pad(d.getMonth()+1)}-01`,to:`${last.getFullYear()}-${pad(last.getMonth()+1)}-${pad(last.getDate())}`}
  }
  if (key==='year')     return {from:`${yyyy}-01-01`,to:todayStr}
  return {from:'',to:''}
}

// ── audit log ──────────────────────────────────────────────────────────────
async function writeAuditLog({action,role,targetId,oldValues,newValues}){
  try{
    await supabase.from('audit_log').insert({
      action,changed_by:role,target_id:targetId,
      old_values:oldValues?JSON.stringify(oldValues):null,
      new_values:newValues?JSON.stringify(newValues):null,
      created_at:new Date().toISOString(),
    })
  }catch(e){console.warn('Audit log failed',e)}
}

// ── PHASE 3: client-side fraud helpers kept for frequency anomaly display only ──
function detectFrequencyAnomalies(entries, todayStr){
  const thisMonth=todayStr.slice(0,7),map={}
  entries.filter(e=>monthKey(e.entry_date)===thisMonth).forEach(e=>{const k=`${e.category}-${e.amount}`;if(!map[k])map[k]=[];map[k].push(e)})
  return Object.entries(map).filter(([,arr])=>arr.length>2).map(([key,arr])=>({key,count:arr.length,entries:arr}))
}

// ── daily expenditure helpers ──────────────────────────────────────────────
function groupByDate(entries, getDate=(e)=>e.entry_date){
  const map={}
  entries.forEach(e=>{const d=getDate(e);if(!map[d])map[d]=[];map[d].push(e)})
  return Object.entries(map).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0)
}

// ── sub-components ─────────────────────────────────────────────────────────
function StatCard({label,value,color,bg,icon,isCurrency=true,sub}){
  return(
    <div style={{backgroundColor:bg,borderRadius:12,padding:18,boxShadow:'0 2px 8px rgba(0,0,0,0.06)',borderLeft:`4px solid ${color}`}}>
      <div style={{fontSize:22,marginBottom:6}}>{icon}</div>
      <p style={{fontSize:13,color,fontWeight:600,margin:0}}>{label}</p>
      <h2 style={{fontSize:22,fontWeight:'bold',color,marginTop:4,marginBottom:0}}>{isCurrency?fmt(value):value}</h2>
      {sub&&<p style={{fontSize:11,color,opacity:0.7,marginTop:2,marginBottom:0}}>{sub}</p>}
    </div>
  )
}

function SeverityBadge({severity}){
  const map={high:{bg:'#fee2e2',color:'#dc2626',label:'High'},medium:{bg:'#fef3c7',color:'#d97706',label:'Med'},low:{bg:'#f1f5f9',color:'#64748b',label:'Low'}}
  const s=map[severity]||map.low
  return <span style={{padding:'2px 7px',borderRadius:999,fontSize:10,fontWeight:700,backgroundColor:s.bg,color:s.color}}>{s.label}</span>
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════
function Accounts({role,userId}){
  const isAdmin      = role==='admin'
  const canWrite     = isAdmin||role==='accounts'||role==='manager'
  const canAddIncome = isAdmin

  // responsive
  const windowWidth  = useWindowWidth()
  const isMobile     = windowWidth < 640
  const isTablet     = windowWidth >= 640 && windowWidth < 1024

  // PHASE 1 FIX: reactive today — updates at midnight, never stale
  const [today, setToday] = useState(getToday)
  useEffect(()=>{
    const t=setInterval(()=>setToday(getToday()),60_000)
    return()=>clearInterval(t)
  },[])

  // data
  const [entries,   setEntries]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)

  // receipt
  const [receiptFile,      setReceiptFile]      = useState(null)
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const [viewReceipt,      setViewReceipt]      = useState(null)
  const fileInputRef = useRef(null)

  // tabs
  const [activeTab, setActiveTab] = useState('transactions')

  // form
  const [showForm,  setShowForm]  = useState(false)
  const [editEntry, setEditEntry] = useState(null)
  const [rows,      setRows]      = useState([{...emptyRow}])

  // filters
  const [search,       setSearch]       = useState('')
  const [typeFilter,   setTypeFilter]   = useState('All')
  const [modeFilter,   setModeFilter]   = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [acctFilter,   setAcctFilter]   = useState('All')
  const [dateFrom,     setDateFrom]     = useState('')
  const [dateTo,       setDateTo]       = useState('')
  const [activeQuick,  setActiveQuick]  = useState('')
  const [sortField,    setSortField]    = useState('entry_date')
  const [sortDir,      setSortDir]      = useState('desc')

  // pagination
  const [page,     setPage]     = useState(1)
  const [pageSize, setPageSize] = useState(25)

  // bulk select
  const [selected, setSelected] = useState(new Set())

  // budgets
  const [budgets,     setBudgets]     = useState(DEFAULT_BUDGETS)
  const [budgetMeta,  setBudgetMeta]  = useState(null)
  const [editBudgets, setEditBudgets] = useState(false)
  const [budgetDraft, setBudgetDraft] = useState(DEFAULT_BUDGETS)

  // AI insights
  const [insights,  setInsights]  = useState('')
  const [loadingAI, setLoadingAI] = useState(false)

  // P&L modal
  const [showPL,  setShowPL]  = useState(false)
  const [plMonth, setPlMonth] = useState(()=>getToday().slice(0,7))

  // daily expenditure filters
  const [dailySearch,      setDailySearch]      = useState('')
  const [dailyAcctFilter,  setDailyAcctFilter]  = useState('All')
  const [dailyModeFilter,  setDailyModeFilter]  = useState('All')
  const [dailyCollapsed,   setDailyCollapsed]   = useState({})
  const [voucherHead,      setVoucherHead]      = useState('')
  // PAYMENT-DATE FILTER FIX: Daily register can now show Income (payments) or Expense
  const [dailyTypeFilter,  setDailyTypeFilter]  = useState('Expense')
  // ACTUAL PAYMENT DATE FIX: for Income, choose whether the date filter goes by when money was
  // actually received (payment_date) or when the row was recorded (entry_date)
  const [dailyDateMode,    setDailyDateMode]    = useState('payment') // 'payment' | 'entry'

  // admin extras
  const [deletedRows, setDeletedRows] = useState([])
  const [auditLog,    setAuditLog]    = useState([])
  const [exportLog,   setExportLog]   = useState([])

  // PHASE 3: fraud flags now fetched from DB (fraud_alerts table)
  const [fraudFlags,  setFraudFlags]  = useState({})

  // PHASE 4: balance sheet + trial balance
  const [trialBalance,      setTrialBalance]      = useState([])
  const [balanceSheet,      setBalanceSheet]      = useState([])
  const [loadingFinancials, setLoadingFinancials] = useState(false)

  // ── fetch ─────────────────────────────────────────────────────────────
  // PHASE 3 FIX: fraud flags fetched from DB, not computed client-side
  const fetchEntries = useCallback(async()=>{
    setLoading(true)
    const {data,error}=await supabase.from('accounts').select('*')
      .eq('is_soft_deleted',false)
      .order('entry_date',{ascending:false})
      .order('created_at',{ascending:false})
    if(error)console.error(error)
    else setEntries(data||[])

    if(isAdmin){
      const {data:alerts}=await supabase
        .from('fraud_alerts')
        .select('*')
        .eq('resolved',false)
        .order('detected_at',{ascending:false})
      const flags={}
      ;(alerts||[]).forEach(a=>{
        if(!flags[a.entry_id])flags[a.entry_id]=[]
        flags[a.entry_id].push({type:a.flag_type,label:a.label,severity:a.severity,alertId:a.id})
      })
      setFraudFlags(flags)
    }
    setLoading(false)
  },[isAdmin])

  const fetchBudgets = useCallback(async()=>{
    const {data,error}=await supabase.from('account_budgets').select('*').single()
    if(!error&&data?.budgets){setBudgets(data.budgets);setBudgetDraft(data.budgets);setBudgetMeta({edited_by:data.budget_edited_by,edited_at:data.budget_edited_at})}
    else{try{const b=JSON.parse(localStorage.getItem('acc_budgets')||'null');if(b){setBudgets(b);setBudgetDraft(b)}}catch{}}
  },[])

  const fetchDeletedRows = useCallback(async()=>{
    if(!isAdmin)return
    const {data}=await supabase.from('accounts').select('*').eq('is_soft_deleted',true).order('deleted_at',{ascending:false})
    setDeletedRows(data||[])
  },[isAdmin])

  const fetchAuditLog = useCallback(async()=>{
    if(!isAdmin)return
    const {data}=await supabase.from('audit_log').select('*').order('created_at',{ascending:false}).limit(200)
    setAuditLog(data||[])
  },[isAdmin])

  const fetchExportLog = useCallback(async()=>{
    if(!isAdmin)return
    const {data}=await supabase.from('export_log').select('*').order('created_at',{ascending:false}).limit(100)
    setExportLog(data||[])
  },[isAdmin])

  // PHASE 4: fetch trial balance + balance sheet from DB views
  const fetchFinancials = useCallback(async()=>{
    if(!isAdmin)return
    setLoadingFinancials(true)
    const [{data:tb},{data:bs}]=await Promise.all([
      supabase.from('trial_balance').select('*'),
      supabase.from('balance_sheet').select('*'),
    ])
    setTrialBalance(tb||[])
    setBalanceSheet(bs||[])
    setLoadingFinancials(false)
  },[isAdmin])

  useEffect(()=>{
    fetchEntries();fetchBudgets()
    if(isAdmin){fetchDeletedRows();fetchAuditLog();fetchExportLog();fetchFinancials()}
  },[fetchEntries,fetchBudgets,fetchDeletedRows,fetchAuditLog,fetchExportLog,fetchFinancials,isAdmin])

  // ── recurring ─────────────────────────────────────────────────────────
  // PHASE 2 FIX: DB-level unique constraint handles dupes; error code 23505 caught gracefully
  useEffect(()=>{
    const lastRun=localStorage.getItem('acc_recurring_run')
    if(lastRun===today)return
    const recurring=entries.filter(e=>e.is_recurring)
    if(!recurring.length)return
    const thisMonth=today.slice(0,7)
    const existing=entries.map(e=>`${e.category}-${monthKey(e.entry_date)}-${e.amount}`)
    const toInsert=recurring
      .filter(e=>monthKey(e.entry_date)!==thisMonth)
      .filter(e=>!existing.includes(`${e.category}-${thisMonth}-${e.amount}`))
      .map(({id,created_at,entry_date,...rest})=>({
        ...rest,
        entry_date:`${thisMonth}-${entry_date.slice(8)}`,
        added_by:'auto-recurring',
      }))
    if(toInsert.length){
      supabase.from('accounts').insert(toInsert).then(({error})=>{
        if(!error){
          fetchEntries()
          localStorage.setItem('acc_recurring_run',today)
        }else if(error.code==='23505'){
          // unique constraint — already inserted this month
          localStorage.setItem('acc_recurring_run',today)
        }else{
          console.error('Recurring insert failed:',error.message)
        }
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[entries.length, today])

  // ── quick date ────────────────────────────────────────────────────────
  const applyQuick=(key)=>{const{from,to}=getQuickRange(key);setDateFrom(from);setDateTo(to);setActiveQuick(key);setPage(1)}
  const clearQuick=()=>{setDateFrom('');setDateTo('');setActiveQuick('');setPage(1)}

  // ── CRUD ──────────────────────────────────────────────────────────────
  const openAdd=()=>{
    setEditEntry(null)
    setRows([{...emptyRow,type:canAddIncome?'Income':'Expense',entry_date:today,payment_date:today}])
    setReceiptFile(null);setShowForm(true)
  }

  const openEdit=(item)=>{
    setEditEntry(item)
    setRows([{
      entry_date:item.entry_date,payment_date:item.payment_date||item.entry_date,type:item.type,category:item.category,
      amount:String(item.amount),payment_mode:item.payment_mode,
      account_type:item.account_type||'Cash A/c',
      voucher_head:item.voucher_head||'',
      note:item.note||'',is_recurring:!!item.is_recurring,
      receipt_url:item.receipt_url||'',status:item.status||'Confirmed',
    }])
    setReceiptFile(null);setShowForm(true);setActiveTab('transactions')
    window.scrollTo({top:0,behavior:'smooth'})
  }

  const openDuplicate=(item)=>{
    setEditEntry(null)
    setRows([{
      entry_date:today,payment_date:today,type:item.type,category:item.category,
      amount:String(item.amount),payment_mode:item.payment_mode,
      account_type:item.account_type||'Cash A/c',
      voucher_head:item.voucher_head||'',
      note:item.note||'',is_recurring:false,receipt_url:'',status:'Confirmed',
    }])
    setReceiptFile(null);setShowForm(true);setActiveTab('transactions')
    window.scrollTo({top:0,behavior:'smooth'})
  }

  const uploadReceipt=async(entryId)=>{
    if(!receiptFile)return rows[0]?.receipt_url||null
    setUploadingReceipt(true)
    const ext=receiptFile.name.split('.').pop(),path=`${entryId||Date.now()}.${ext}`
    const{error:upErr}=await supabase.storage.from(RECEIPT_BUCKET).upload(path,receiptFile,{upsert:true})
    if(upErr){alert('Receipt upload failed: '+upErr.message);setUploadingReceipt(false);return null}
    const{data}=supabase.storage.from(RECEIPT_BUCKET).getPublicUrl(path)
    setUploadingReceipt(false);return data.publicUrl
  }

  const deleteReceipt=async(item)=>{
    if(!item.receipt_url)return
    const path=item.receipt_url.split('/').pop()
    await supabase.storage.from(RECEIPT_BUCKET).remove([path])
    await supabase.from('accounts').update({receipt_url:null}).eq('id',item.id)
    fetchEntries()
  }

  const handleSubmit=async(e)=>{
    e.preventDefault();setSaving(true)
    if(editEntry){
      const r=rows[0],receiptUrl=await uploadReceipt(editEntry.id)
      const payload={
        entry_date:r.entry_date,payment_date:r.payment_date||r.entry_date,type:r.type,category:r.category,
        amount:Number(r.amount)||0,payment_mode:r.payment_mode,
        account_type:r.account_type,voucher_head:r.voucher_head,
        note:r.note,is_recurring:r.is_recurring,status:r.status,
        receipt_url:receiptUrl,edited_by:role,edited_at:new Date().toISOString(),
      }
      const{error}=await supabase.from('accounts').update(payload).eq('id',editEntry.id)
      if(error)alert('Error: '+error.message)
      else{await writeAuditLog({action:'update',role,targetId:editEntry.id,oldValues:editEntry,newValues:payload});setShowForm(false);setEditEntry(null);setReceiptFile(null);fetchEntries()}
    }else{
      const payloads=rows.filter(r=>canAddIncome||r.type==='Expense').map(r=>({
        entry_date:r.entry_date,payment_date:r.payment_date||r.entry_date,type:r.type,category:r.category,
        amount:Number(r.amount)||0,payment_mode:r.payment_mode,
        account_type:r.account_type,voucher_head:r.voucher_head,
        note:r.note,is_recurring:r.is_recurring,status:r.status,added_by:role,
      }))
      const{data:inserted,error}=await supabase.from('accounts').insert(payloads).select()
      if(error)alert('Error: '+error.message)
      else{
        if(receiptFile&&inserted?.[0]){const ru=await uploadReceipt(inserted[0].id);if(ru)await supabase.from('accounts').update({receipt_url:ru}).eq('id',inserted[0].id)}
        for(const ins of(inserted||[]))await writeAuditLog({action:'insert',role,targetId:ins.id,newValues:ins})
        setShowForm(false);setReceiptFile(null);setRows([{...emptyRow}]);fetchEntries()
      }
    }
    setSaving(false)
  }

  const handleDelete=async(id)=>{
    if(!window.confirm('Delete this transaction?'))return
    const original=entries.find(e=>e.id===id)
    const{error}=await supabase.from('accounts').update({is_soft_deleted:true,deleted_by:role,deleted_at:new Date().toISOString()}).eq('id',id)
    if(error){alert('Error: '+error.message);return}
    await writeAuditLog({action:'delete',role,targetId:id,oldValues:original})
    fetchEntries();if(isAdmin)fetchDeletedRows()
  }

  const handleRestore=async(id)=>{
    await supabase.from('accounts').update({is_soft_deleted:false,deleted_by:null,deleted_at:null}).eq('id',id)
    await writeAuditLog({action:'restore',role,targetId:id})
    fetchEntries();fetchDeletedRows()
  }

  const handleBulkDelete=async()=>{
    if(!selected.size)return
    if(!window.confirm(`Delete ${selected.size} selected transaction(s)?`))return
    for(const id of[...selected]){
      const original=entries.find(e=>e.id===id)
      await supabase.from('accounts').update({is_soft_deleted:true,deleted_by:role,deleted_at:new Date().toISOString()}).eq('id',id)
      await writeAuditLog({action:'bulk_delete',role,targetId:id,oldValues:original})
    }
    setSelected(new Set());fetchEntries();if(isAdmin)fetchDeletedRows()
  }

  const toggleSelect=(id)=>setSelected(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n})
  const toggleSelectAll=()=>selected.size===pagedEntries.length?setSelected(new Set()):setSelected(new Set(pagedEntries.map(e=>e.id)))

  const updateRow=(i,key,val)=>setRows(prev=>prev.map((r,idx)=>{
    if(idx!==i)return r
    // ACTUAL PAYMENT DATE FIX: keep payment_date following entry_date until the user
    // explicitly diverges them (i.e. payment_date currently still mirrors entry_date)
    if(key==='entry_date'&&(r.payment_date===r.entry_date||!r.payment_date))return{...r,entry_date:val,payment_date:val}
    return{...r,[key]:val}
  }))
  const addRow=()=>setRows(prev=>[...prev,{...emptyRow,type:canAddIncome?'Income':'Expense',entry_date:today,payment_date:today}])
  const removeRow=(i)=>setRows(prev=>prev.filter((_,idx)=>idx!==i))

  // PHASE 1 FIX: budget save confirmation to prevent silent overwrite
  const saveBudgets=async()=>{
    if(!window.confirm('Save budget changes? This will overwrite any edits made by other admins.'))return
    const oldBudgets={...budgets};setBudgets(budgetDraft)
    localStorage.setItem('acc_budgets',JSON.stringify(budgetDraft))
    const editedAt=new Date().toISOString()
    await supabase.from('account_budgets').upsert({id:1,budgets:budgetDraft,budget_edited_by:role,budget_edited_at:editedAt})
    setBudgetMeta({edited_by:role,edited_at:editedAt})
    await writeAuditLog({action:'budget_edit',role,targetId:1,oldValues:oldBudgets,newValues:budgetDraft})
    setEditBudgets(false)
  }

  const exportCSV=async()=>{
    const header=['Date','Type','Category','Amount','Mode','Account','Voucher Head','Status','Note']
    const rows_=filteredEntries.map(e=>[e.entry_date,e.type,e.category,e.amount,e.payment_mode,e.account_type||'Cash A/c',e.voucher_head||'',e.status||'Confirmed',e.note||''])
    const csv=[header,...rows_].map(r=>r.join(',')).join('\n')
    const blob=new Blob([csv],{type:'text/csv'}),url=URL.createObjectURL(blob)
    const a=Object.assign(document.createElement('a'),{href:url,download:'accounts.csv'})
    a.click();URL.revokeObjectURL(url)
    // PHASE 1 FIX: export log with proper error handling
    try{
      const{error:logErr}=await supabase.from('export_log').insert({exported_by:role,filter_type:typeFilter,filter_dates:`${dateFrom}–${dateTo}`,row_count:filteredEntries.length,created_at:new Date().toISOString()})
      if(logErr)console.warn('Export log failed:',logErr.message)
      if(isAdmin)fetchExportLog()
    }catch(e){console.warn('Export log error:',e)}
  }

  const exportDailyCSV=()=>{
    const filtered=dailyFilteredEntries
    const header=dailyIsIncome
      ? ['#','Payment Date','Entry Date','Voucher Head','Account','Description','Payment Mode','Amount']
      : ['#','Date','Voucher Head','Account','Description','Payment Mode','Amount']
    const rows_=filtered.map((e,i)=>dailyIsIncome
      ? [i+1,e.payment_date||e.entry_date,e.entry_date,e.voucher_head||'',e.account_type||'Cash A/c',e.note||e.category,e.payment_mode,e.amount]
      : [i+1,e.entry_date,e.voucher_head||'',e.account_type||'Cash A/c',e.note||e.category,e.payment_mode,e.amount])
    const csv=[header,...rows_].map(r=>r.join(',')).join('\n')
    const blob=new Blob([csv],{type:'text/csv'}),url=URL.createObjectURL(blob)
    const a=Object.assign(document.createElement('a'),{href:url,download:`daily-${dailyTypeFilter.toLowerCase()}.csv`})
    a.click();URL.revokeObjectURL(url)
  }

  const printDailyRegister=()=>{
    const filtered=dailyFilteredEntries
    const groups=groupByDate(filtered)
    const totalAmt=filtered.reduce((s,e)=>s+Number(e.amount),0)
    const cashAmt=filtered.filter(e=>e.payment_mode==='Cash').reduce((s,e)=>s+Number(e.amount),0)
    const bankAmt=filtered.filter(e=>e.payment_mode==='Bank').reduce((s,e)=>s+Number(e.amount),0)
    const w=window.open('','_blank')
    const regTitle=`Daily ${dailyLabelWord} Register`
    const dateModeLabel=dailyIsIncome?(dailyDateMode==='payment'?'Actual Payment Date':'Entry Date'):'Entry Date'
    let rowNum=0
    w.document.write(`<html><head><title>${regTitle}</title><style>
      body{font-family:Arial,sans-serif;padding:24px;font-size:12px;color:#1a2535}
      h1{font-size:18px;margin-bottom:4px}p{color:#666;margin:0 0 16px}
      table{width:100%;border-collapse:collapse;margin-bottom:20px}
      th{background:#1e3a5f;color:#fff;padding:7px 10px;text-align:left;font-size:11px}
      td{padding:7px 10px;border-bottom:1px solid #eee}
      .day-header{background:#e8f0fa;font-weight:bold;padding:6px 10px}
      .subtotal{background:#f7fafd;font-weight:bold}
      .grand{background:#1e3a5f;color:#fff;font-weight:bold}
      .amt{text-align:right;color:${dailyAmtColor};font-weight:600}
      .total-amt{text-align:right;font-weight:bold}
      @page{margin:15mm}
    </style></head><body>
    <h1>📊 ${regTitle} — GNSI Portal</h1>
    <p>Grouped by: ${dateModeLabel} &nbsp;|&nbsp; Voucher Head: ${voucherHead||'All'} &nbsp;|&nbsp; Range: ${dateFrom||'All'}–${dateTo||'present'} &nbsp;|&nbsp; Generated: ${new Date().toLocaleString('en-IN')}</p>
    <table><tr><th>#</th><th>Sl</th><th>Account</th><th>Description</th><th>Pay Mode</th>${dailyIsIncome?'<th>Entry Date</th>':''}<th style="text-align:right">Amount (${dailyDrCr})</th></tr>
    ${groups.map(([date,rows])=>{
      const dayTotal=rows.reduce((s,e)=>s+Number(e.amount),0)
      const dayRows=rows.map(e=>{rowNum++;return`<tr><td>${rowNum}</td><td style="color:#888;font-size:11px">${e.id||''}</td><td><b>${e.account_type||'Cash A/c'}</b></td><td>${(e.note||e.category||'').replace(/</g,'&lt;')}</td><td>${e.payment_mode}</td>${dailyIsIncome?`<td style="font-size:11px;color:#888">${e.entry_date}</td>`:''}<td class="amt">${fmt(e.amount)}</td></tr>`}).join('')
      return`<tr><td colspan="${dailyIsIncome?7:6}" class="day-header">${date} — ${new Date(date).toLocaleDateString('en-IN',{weekday:'long'})} (${rows.length} entries)</td></tr>${dayRows}<tr class="subtotal"><td colspan="${dailyIsIncome?6:5}">Daily Total</td><td class="total-amt">${fmt(dayTotal)}</td></tr>`
    }).join('')}
    <tr class="grand"><td colspan="4">GRAND TOTAL</td><td colspan="${dailyIsIncome?2:1}">Cash: ${fmt(cashAmt)} | Bank: ${fmt(bankAmt)}</td><td class="total-amt">${fmt(totalAmt)}</td></tr>
    </table></body></html>`)
    w.document.close();w.print()
  }

  const printPL=()=>{
    const w=window.open('','_blank')
    const{thisInc,thisExp,totalThisInc,totalThisExp}=plData,net=totalThisInc-totalThisExp
    w.document.write(`<html><head><title>P&L - ${plMonth}</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#1e293b}h1{font-size:22px}h2{font-size:15px;font-weight:600;margin:20px 0 8px;color:#1e3a5f}p{font-size:13px;color:#64748b;margin:0 0 16px}table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px}th{background:#f8fafc;padding:8px 12px;text-align:left;border-bottom:1px solid #e2e8f0;font-size:12px}td{padding:8px 12px;border-bottom:1px solid #f1f5f9}.total{font-weight:bold;background:#f8fafc}.green{color:#16a34a}.red{color:#dc2626}</style></head><body>
    <h1>Income & Expenditure Statement</h1>
    <p>Period: ${plMonth} | Generated: ${new Date().toLocaleString('en-IN')}</p>
    <h2>Income</h2><table><tr><th>Category</th><th>Amount</th></tr>
    ${Object.entries(thisInc).map(([k,v])=>`<tr><td>${k.replace(/</g,'&lt;')}</td><td class="green">${fmt(v)}</td></tr>`).join('')}
    <tr class="total"><td>Total Income</td><td class="green">${fmt(totalThisInc)}</td></tr></table>
    <h2>Expenditure</h2><table><tr><th>Category</th><th>Amount</th></tr>
    ${Object.entries(thisExp).map(([k,v])=>`<tr><td>${k.replace(/</g,'&lt;')}</td><td class="red">${fmt(v)}</td></tr>`).join('')}
    <tr class="total"><td>Total Expenditure</td><td class="red">${fmt(totalThisExp)}</td></tr></table>
    <h2>Summary</h2><table>
    <tr><td>Total Income</td><td class="green">${fmt(totalThisInc)}</td></tr>
    <tr><td>Total Expenditure</td><td class="red">${fmt(totalThisExp)}</td></tr>
    <tr class="total"><td>Net Surplus / Deficit</td><td class="${net>=0?'green':'red'}">${fmt(net)}</td></tr>
    </table></body></html>`)
    w.document.close();w.print()
  }

  // PHASE 1 FIX: AI insights routed through /api/ai-insights serverless function
  const getInsights=async()=>{
    setLoadingAI(true);setInsights('')
    const summary={totalIncome,totalExpense,netBalance:totalIncome-totalExpense,pendingCount,
      topExpenseCategories:categoryData.filter(c=>c.type==='Expense').slice(0,3),
      monthlyTrend:monthlyData.slice(-3),
      budgetAlerts:Object.entries(budgets).filter(([cat,limit])=>limit>0&&(monthlyExpenses[cat]||0)>limit).map(([cat])=>cat),
    }
    try{
      const res=await fetch('/api/ai-insights',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({summary})})
      const data=await res.json()
      setInsights(data.content?.[0]?.text||'No insights available.')
    }catch{setInsights('Failed to load AI insights.')}
    setLoadingAI(false)
  }

  const toggleSort=(field)=>{if(sortField===field)setSortDir(d=>d==='asc'?'desc':'asc');else{setSortField(field);setSortDir('asc')};setPage(1)}
  const sortArrow=(field)=>sortField===field?(sortDir==='asc'?' ▲':' ▼'):''

  // ── memos ─────────────────────────────────────────────────────────────
  const filteredEntries=useMemo(()=>{
    let list=entries.filter(item=>{
      if(typeFilter!=='All'&&item.type!==typeFilter)return false
      if(modeFilter!=='All'&&item.payment_mode!==modeFilter)return false
      if(statusFilter!=='All'&&(item.status||'Confirmed')!==statusFilter)return false
      if(acctFilter!=='All'&&(item.account_type||'Cash A/c')!==acctFilter)return false
      if(dateFrom&&item.entry_date<dateFrom)return false
      if(dateTo&&item.entry_date>dateTo)return false
      const q=search.toLowerCase()
      return(item.category||'').toLowerCase().includes(q)||(item.payment_mode||'').toLowerCase().includes(q)||(item.note||'').toLowerCase().includes(q)||(item.type||'').toLowerCase().includes(q)||(item.voucher_head||'').toLowerCase().includes(q)
    })
    return[...list].sort((a,b)=>{let av=a[sortField],bv=b[sortField];if(sortField==='amount'){av=Number(av);bv=Number(bv)};if(av<bv)return sortDir==='asc'?-1:1;if(av>bv)return sortDir==='asc'?1:-1;return 0})
  },[entries,search,typeFilter,modeFilter,statusFilter,acctFilter,dateFrom,dateTo,sortField,sortDir])

  // ACTUAL PAYMENT DATE FIX: resolves which date field the Daily register filters/groups by
  const getDailyDate = useCallback((e)=>{
    if(dailyTypeFilter==='Income'&&dailyDateMode==='payment')return e.payment_date||e.entry_date
    return e.entry_date
  },[dailyTypeFilter,dailyDateMode])

  // PAYMENT-DATE FILTER FIX: now driven by dailyTypeFilter (Income or Expense) instead of being hard-locked to Expense
  const dailyFilteredEntries=useMemo(()=>{
    return entries.filter(e=>{
      if(e.type!==dailyTypeFilter)return false
      if(dailyAcctFilter!=='All'&&(e.account_type||'Cash A/c')!==dailyAcctFilter)return false
      if(dailyModeFilter!=='All'&&e.payment_mode!==dailyModeFilter)return false
      if(voucherHead&&!(e.voucher_head||'').toLowerCase().includes(voucherHead.toLowerCase()))return false
      const d=getDailyDate(e)
      if(dateFrom&&d<dateFrom)return false
      if(dateTo&&d>dateTo)return false
      const q=dailySearch.toLowerCase()
      return!q||(e.note||'').toLowerCase().includes(q)||(e.category||'').toLowerCase().includes(q)
    }).sort((a,b)=>{const da=getDailyDate(a),db=getDailyDate(b);return da<db?-1:da>db?1:0})
  },[entries,dailySearch,dailyAcctFilter,dailyModeFilter,voucherHead,dateFrom,dateTo,dailyTypeFilter,getDailyDate])

  // PAYMENT-DATE FILTER FIX: derived label/color for the Daily register, used across header, table, CSV, print
  const dailyIsIncome  = dailyTypeFilter==='Income'
  const dailyAmtColor  = dailyIsIncome ? '#16a34a' : '#c0392b'
  const dailyLabelWord = dailyIsIncome ? 'Collection' : 'Expenditure'
  const dailyDrCr       = dailyIsIncome ? 'Cr.' : 'Dr.'

  // PHASE 2 FIX: running balance computed from ALL entries, not filtered subset
  const runningBalanceMap=useMemo(()=>{
    const sorted=[...entries].sort((a,b)=>a.entry_date<b.entry_date?-1:a.entry_date>b.entry_date?1:0)
    let balance=0;const map={}
    sorted.forEach(e=>{balance+=e.type==='Income'?Number(e.amount):-Number(e.amount);map[e.id]=balance})
    return map
  },[entries])

  const totalPages   = Math.max(1,Math.ceil(filteredEntries.length/pageSize))
  const pagedEntries = filteredEntries.slice((page-1)*pageSize,page*pageSize)

  const filteredIncome  = filteredEntries.filter(e=>e.type==='Income'&&(e.status||'Confirmed')==='Confirmed').reduce((s,e)=>s+Number(e.amount),0)
  const filteredExpense = filteredEntries.filter(e=>e.type==='Expense'&&(e.status||'Confirmed')==='Confirmed').reduce((s,e)=>s+Number(e.amount),0)
  const filteredNet     = filteredIncome-filteredExpense
  const pendingCount    = entries.filter(e=>e.status==='Pending').length
  const totalIncome     = entries.filter(e=>e.type==='Income').reduce((s,e)=>s+Number(e.amount),0)
  const totalExpense    = entries.filter(e=>e.type==='Expense').reduce((s,e)=>s+Number(e.amount),0)
  const todayIncome     = entries.filter(e=>e.type==='Income'&&e.entry_date===today).reduce((s,e)=>s+Number(e.amount),0)
  const todayExpense    = entries.filter(e=>e.type==='Expense'&&e.entry_date===today).reduce((s,e)=>s+Number(e.amount),0)
  const todayNet        = todayIncome-todayExpense
  const todayCount      = entries.filter(e=>e.entry_date===today).length
  const isFiltered      = dateFrom||dateTo||typeFilter!=='All'||modeFilter!=='All'||statusFilter!=='All'||acctFilter!=='All'||search

  const monthlyData=useMemo(()=>{
    const map={}
    entries.forEach(e=>{const m=monthKey(e.entry_date);if(!m)return;if(!map[m])map[m]={month:m,Income:0,Expense:0};map[m][e.type]+=Number(e.amount)})
    return Object.values(map).sort((a,b)=>a.month.localeCompare(b.month)).slice(-12)
  },[entries])

  const categoryData=useMemo(()=>{
    const map={}
    entries.forEach(e=>{if(!map[e.category])map[e.category]={name:e.category,value:0,type:e.type};map[e.category].value+=Number(e.amount)})
    return Object.values(map).sort((a,b)=>b.value-a.value).slice(0,8)
  },[entries])

  const modeData=useMemo(()=>{
    const map={}
    entries.forEach(e=>{if(!map[e.payment_mode])map[e.payment_mode]={name:e.payment_mode,value:0};map[e.payment_mode].value+=Number(e.amount)})
    return Object.values(map)
  },[entries])

  const plData=useMemo(()=>{
    const thisM=entries.filter(e=>e.entry_date.startsWith(plMonth))
    const prevM=(()=>{const[y,m]=plMonth.split('-').map(Number);const d=new Date(y,m-2,1);const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;return entries.filter(e=>e.entry_date.startsWith(key))})()
    const sumBy=(arr,type)=>{const map={};arr.filter(e=>e.type===type).forEach(e=>{map[e.category]=(map[e.category]||0)+Number(e.amount)});return map}
    const thisInc=sumBy(thisM,'Income'),thisExp=sumBy(thisM,'Expense'),prevInc=sumBy(prevM,'Income'),prevExp=sumBy(prevM,'Expense')
    return{thisInc,thisExp,prevInc,prevExp,totalThisInc:Object.values(thisInc).reduce((s,v)=>s+v,0),totalThisExp:Object.values(thisExp).reduce((s,v)=>s+v,0),totalPrevInc:Object.values(prevInc).reduce((s,v)=>s+v,0),totalPrevExp:Object.values(prevExp).reduce((s,v)=>s+v,0)}
  },[entries,plMonth])

  const thisMonth=today.slice(0,7)
  const monthlyExpenses=useMemo(()=>{
    const map={}
    entries.filter(e=>e.type==='Expense'&&monthKey(e.entry_date)===thisMonth).forEach(e=>{map[e.category]=(map[e.category]||0)+Number(e.amount)})
    return map
  },[entries,thisMonth])

  const budgetChartData=useMemo(()=>{
    const months=[]
    for(let i=5;i>=0;i--){const d=new Date();d.setMonth(d.getMonth()-i);months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)}
    return months.map(m=>{
      const row={month:m}
      EXPENSE_CATEGORIES.forEach(cat=>{row[cat]=entries.filter(e=>e.type==='Expense'&&e.category===cat&&monthKey(e.entry_date)===m).reduce((s,e)=>s+Number(e.amount),0);row[`${cat}_budget`]=Number(budgets[cat])||0})
      return row
    })
  },[entries,budgets])

  const fraudSummary=useMemo(()=>{
    if(!isAdmin)return{}
    const all=Object.values(fraudFlags).flat()
    return{
      high:all.filter(f=>f.severity==='high').length,
      medium:all.filter(f=>f.severity==='medium').length,
      flaggedEntries:entries.filter(e=>fraudFlags[e.id]?.length>0),
      freqAnomalies:detectFrequencyAnomalies(entries,today),
      phantoms:deletedRows.filter(e=>e.entry_date===today&&e.deleted_at?.startsWith(today)),
    }
  },[fraudFlags,entries,deletedRows,isAdmin,today])

  const totalFraudAlerts=isAdmin?(fraudSummary.high||0)+(fraudSummary.medium||0):0

  const dailyGroups=useMemo(()=>groupByDate(dailyFilteredEntries,getDailyDate),[dailyFilteredEntries,getDailyDate])
  const dailyTotalAmt=dailyFilteredEntries.reduce((s,e)=>s+Number(e.amount),0)
  const dailyCashAmt=dailyFilteredEntries.filter(e=>e.payment_mode==='Cash').reduce((s,e)=>s+Number(e.amount),0)
  const dailyBankAmt=dailyFilteredEntries.filter(e=>e.payment_mode==='Bank').reduce((s,e)=>s+Number(e.amount),0)

  const recurringEntries=entries.filter(e=>e.is_recurring)

  // ── responsive style helpers ───────────────────────────────────────────
  const tabStyle=(t)=>({
    padding: isMobile ? '7px 12px' : '8px 18px',
    borderRadius:8, border:'none', cursor:'pointer', fontWeight:600,
    fontSize: isMobile ? 12 : 13,
    backgroundColor:activeTab===t?'#1e3a5f':'#f1f5f9',
    color:activeTab===t?'white':'#64748b', transition:'all .15s',
  })
  const qBtn=(key)=>({padding: isMobile ? '5px 10px' : '5px 12px',borderRadius:6,border:'none',cursor:'pointer',fontSize:isMobile?11:12,fontWeight:600,transition:'all .15s',backgroundColor:activeQuick===key?'#1e3a5f':'#f1f5f9',color:activeQuick===key?'white':'#64748b'})

  // ── responsive grid columns ────────────────────────────────────────────
  const statCardCols    = isMobile ? 'repeat(2,1fr)' : isTablet ? 'repeat(3,1fr)' : 'repeat(5,1fr)'
  const todayCols       = isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)'
  const formCols        = isMobile ? '1fr' : isTablet ? 'repeat(2,1fr)' : 'repeat(4,1fr)'
  const filterCols      = isMobile ? '1fr' : isTablet ? 'repeat(2,1fr)' : '2fr 1fr 1fr 1fr 1fr 1fr 1fr'
  const chartGridCols   = isMobile ? '1fr' : '1fr 1fr'
  const budgetGridCols  = isMobile ? '1fr' : 'repeat(2,1fr)'
  const fraudGridCols   = isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)'
  const dailySumCols    = isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)'
  const plModalCols     = isMobile ? '1fr' : 'repeat(3,1fr)'
  const plContentCols   = isMobile ? '1fr' : '1fr 1fr'

  // ══════════════════════════════════════════════════════════════════════
  return(
  <div style={{padding: isMobile ? 12 : 24, fontFamily:'inherit'}}>

    {/* ── header ── */}
    <div style={{
      display:'flex',
      flexDirection: isMobile ? 'column' : 'row',
      justifyContent:'space-between',
      alignItems: isMobile ? 'flex-start' : 'center',
      gap: isMobile ? 12 : 0,
      marginBottom:24,
    }}>
      <div>
        <h1 style={{fontSize: isMobile ? 20 : 26, fontWeight:'bold',color:'#1e3a5f',margin:0}}>💼 Accounts</h1>
        <p style={{color:'#64748b',fontSize:14,margin:'4px 0 0'}}>Manage income &amp; expense transactions</p>
      </div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap', width: isMobile ? '100%' : 'auto'}}>
        <button onClick={()=>setShowPL(true)} style={{backgroundColor:'#f0f9ff',color:'#0369a1',border:'1px solid #bae6fd',borderRadius:8,padding: isMobile ? '8px 12px' : '10px 16px',fontWeight:600,cursor:'pointer',fontSize: isMobile ? 12 : 13, flex: isMobile ? '1' : 'none'}}>📋 P&L</button>
        <button onClick={exportCSV} style={{backgroundColor:'#f0fdf4',color:'#16a34a',border:'1px solid #bbf7d0',borderRadius:8,padding: isMobile ? '8px 12px' : '10px 16px',fontWeight:600,cursor:'pointer',fontSize: isMobile ? 12 : 13, flex: isMobile ? '1' : 'none'}}>⬇ Export</button>
        {canWrite&&<button onClick={()=>(showForm&&!editEntry)?setShowForm(false):openAdd()} style={{backgroundColor:'#1e3a5f',color:'white',border:'none',borderRadius:8,padding: isMobile ? '8px 12px' : '10px 20px',fontWeight:600,cursor:'pointer',fontSize: isMobile ? 12 : 14, flex: isMobile ? '1' : 'none'}}>{showForm&&!editEntry?'✖ Cancel':'➕ Add'}</button>}
      </div>
    </div>

    {/* ── stat cards ── */}
    <div style={{display:'grid',gridTemplateColumns:statCardCols,gap: isMobile ? 10 : 14,marginBottom:16}}>
      <StatCard label={isFiltered?'Income (filtered)':'Total Income'} value={isFiltered?filteredIncome:totalIncome} color="#16a34a" bg="#dcfce7" icon="📈" sub={isFiltered?`All-time: ${fmt(totalIncome)}`:null}/>
      <StatCard label={isFiltered?'Expense (filtered)':'Total Expense'} value={isFiltered?filteredExpense:totalExpense} color="#dc2626" bg="#fee2e2" icon="📉" sub={isFiltered?`All-time: ${fmt(totalExpense)}`:null}/>
      <StatCard label={isFiltered?'Net (filtered)':'Net Balance'} value={isFiltered?filteredNet:totalIncome-totalExpense} color="#1e3a5f" bg="#eff6ff" icon="💼"/>
      <StatCard label="Transactions" value={entries.length} color="#7c3aed" bg="#f3e8ff" icon="🧾" isCurrency={false}/>
      <StatCard label="Pending" value={pendingCount} color="#f59e0b" bg="#fffbeb" icon="⏳" isCurrency={false} sub={pendingCount>0?'Uncleared entries':'All confirmed'}/>
    </div>

    {/* ── today summary ── */}
    <div style={{backgroundColor:'white',borderRadius:12,padding: isMobile ? '12px 14px' : '14px 20px',marginBottom:24,boxShadow:'0 2px 8px rgba(0,0,0,0.06)',borderTop:'3px solid #1e3a5f'}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12,flexWrap:'wrap'}}>
        <span style={{fontSize:16}}>📅</span>
        <span style={{fontSize:14,fontWeight:700,color:'#1e3a5f'}}>Today's Summary</span>
        {!isMobile && <span style={{fontSize:12,color:'#94a3b8'}}>{new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</span>}
        {todayCount===0&&<span style={{marginLeft:'auto',fontSize:12,color:'#94a3b8',fontStyle:'italic'}}>No transactions today</span>}
      </div>
      <div style={{display:'grid',gridTemplateColumns:todayCols,gap: isMobile ? 10 : 12}}>
        {[{label:"Today's Income",value:todayIncome,color:'#16a34a',bg:'#f0fdf4',icon:'⬆️'},{label:"Today's Expense",value:todayExpense,color:'#dc2626',bg:'#fff5f5',icon:'⬇️'},{label:"Today's Net",value:todayNet,color:todayNet>=0?'#1e3a5f':'#dc2626',bg:'#eff6ff',icon:todayNet>=0?'✅':'⚠️'},{label:"Today's Entries",value:todayCount,color:'#7c3aed',bg:'#faf5ff',icon:'🔢',isCurrency:false}].map(card=>(
          <div key={card.label} style={{backgroundColor:card.bg,borderRadius:10,padding: isMobile ? '10px 12px' : '12px 16px',borderLeft:`3px solid ${card.color}`}}>
            <div style={{fontSize: isMobile ? 16 : 18,marginBottom:4}}>{card.icon}</div>
            <p style={{fontSize: isMobile ? 11 : 12,color:card.color,fontWeight:600,margin:'0 0 4px'}}>{card.label}</p>
            <p style={{fontSize: isMobile ? 16 : 20,fontWeight:800,color:card.color,margin:0}}>{card.isCurrency===false?card.value:fmt(card.value)}</p>
          </div>
        ))}
      </div>
    </div>

    {/* ── add/edit form ── */}
    {showForm&&canWrite&&(
      <div style={{backgroundColor:'white',borderRadius:12,padding: isMobile ? 16 : 24,marginBottom:24,boxShadow:'0 2px 8px rgba(0,0,0,0.08)',borderLeft:'4px solid #1e3a5f'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:10}}>
          <h2 style={{fontSize: isMobile ? 16 : 18,fontWeight:600,color:'#1e3a5f',margin:0}}>{editEntry?'✏️ Edit Entry':`➕ Add ${rows.length>1?`${rows.length} Entries`:'Entry'}`}</h2>
          {!editEntry&&<button onClick={addRow} style={{backgroundColor:'#eff6ff',color:'#1e3a5f',border:'1px solid #bfdbfe',borderRadius:8,padding:'7px 14px',fontWeight:600,cursor:'pointer',fontSize:13}}>+ Add Row</button>}
        </div>
        {!canAddIncome&&<div style={{backgroundColor:'#fffbeb',border:'1px solid #fde68a',borderRadius:8,padding:'8px 14px',marginBottom:14,fontSize:13,color:'#92400e'}}>⚠️ You can only add <strong>Expense</strong> entries.</div>}
        <form onSubmit={handleSubmit}>
          {rows.map((row,i)=>(
            <div key={i} style={{border:rows.length>1?'1px solid #e2e8f0':'none',borderRadius:10,padding:rows.length>1?16:0,marginBottom:rows.length>1?14:0}}>
              {rows.length>1&&<div style={{display:'flex',justifyContent:'space-between',marginBottom:10,alignItems:'center'}}><span style={{fontSize:13,fontWeight:600,color:'#1e3a5f'}}>Row {i+1}</span>{i>0&&<button type="button" onClick={()=>removeRow(i)} style={{backgroundColor:'#fee2e2',color:'#dc2626',border:'none',borderRadius:6,padding:'3px 10px',fontSize:12,cursor:'pointer'}}>✖ Remove</button>}</div>}
              <div style={{display:'grid',gridTemplateColumns:formCols,gap:14}}>
                <div><label style={lStyle}>Date {row.type==='Income'?'(Entered)':''}</label><input type="date" value={row.entry_date} onChange={e=>updateRow(i,'entry_date',e.target.value)} required style={iStyle}/></div>
                {row.type==='Income'&&<div><label style={lStyle}>💰 Actual Payment Date</label><input type="date" value={row.payment_date||row.entry_date} onChange={e=>updateRow(i,'payment_date',e.target.value)} required style={iStyle}/></div>}
                <div><label style={lStyle}>Type</label>
                  <select value={row.type} disabled={!canAddIncome} onChange={e=>{updateRow(i,'type',e.target.value);updateRow(i,'category','')}} required style={{...iStyle,backgroundColor:!canAddIncome?'#f8fafc':'white'}}>
                    {canAddIncome&&<option>Income</option>}<option>Expense</option>
                  </select>
                </div>
                <div><label style={lStyle}>Category</label>
                  <select value={row.category} onChange={e=>updateRow(i,'category',e.target.value)} required style={iStyle}>
                    <option value="">Select</option>
                    {(row.type==='Income'?INCOME_CATEGORIES:EXPENSE_CATEGORIES).map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
                <div><label style={lStyle}>Amount</label><input type="number" min="0" placeholder="0" value={row.amount} onChange={e=>updateRow(i,'amount',e.target.value)} required style={iStyle}/></div>
                <div><label style={lStyle}>Payment Mode</label>
                  <select value={row.payment_mode} onChange={e=>updateRow(i,'payment_mode',e.target.value)} style={iStyle}>
                    {PAYMENT_MODES.map(m=><option key={m}>{m}</option>)}
                  </select>
                </div>
                <div><label style={lStyle}>Account Type</label>
                  <select value={row.account_type||'Cash A/c'} onChange={e=>updateRow(i,'account_type',e.target.value)} style={iStyle}>
                    {ACCOUNT_TYPES.map(a=><option key={a}>{a}</option>)}
                  </select>
                </div>
                <div><label style={lStyle}>Voucher Head</label><input type="text" placeholder="e.g. Sir Arunkumar" value={row.voucher_head||''} onChange={e=>updateRow(i,'voucher_head',e.target.value)} style={iStyle}/></div>
                <div><label style={lStyle}>Status</label>
                  <select value={row.status} onChange={e=>updateRow(i,'status',e.target.value)} style={iStyle}>
                    {STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{gridColumn: isMobile ? '1' : 'span 4'}}><label style={lStyle}>Description / Note</label><input type="text" placeholder="Transaction description" value={row.note} onChange={e=>updateRow(i,'note',e.target.value)} style={iStyle}/></div>
              </div>
              <label style={{display:'flex',alignItems:'center',gap:8,marginTop:12,cursor:'pointer',fontSize:14,color:'#374151'}}>
                <input type="checkbox" checked={row.is_recurring} onChange={e=>updateRow(i,'is_recurring',e.target.checked)}/>
                🔁 Mark as recurring
              </label>
            </div>
          ))}
          <div style={{marginTop:16}}>
            <label style={lStyle}>🧾 Receipt / Attachment</label>
            <div style={{display:'flex',gap:10,alignItems:'center',marginTop:6,flexWrap:'wrap'}}>
              <input ref={fileInputRef} type="file" accept="image/*,application/pdf" onChange={e=>setReceiptFile(e.target.files[0]||null)} style={{fontSize:13,maxWidth:'100%'}}/>
              {(rows[0]?.receipt_url||receiptFile)&&<button type="button" onClick={()=>setViewReceipt(receiptFile?URL.createObjectURL(receiptFile):rows[0].receipt_url)} style={{backgroundColor:'#eff6ff',color:'#1e3a5f',border:'1px solid #bfdbfe',borderRadius:6,padding:'5px 12px',fontSize:12,cursor:'pointer',fontWeight:500}}>👁 Preview</button>}
              {rows[0]?.receipt_url&&!receiptFile&&<span style={{fontSize:12,color:'#16a34a'}}>✅ Receipt on file</span>}
            </div>
          </div>
          <div style={{display:'flex',gap:12,marginTop:20,flexWrap:'wrap'}}>
            <button type="submit" disabled={saving||uploadingReceipt} style={{backgroundColor:(saving||uploadingReceipt)?'#94a3b8':'#1e3a5f',color:'white',border:'none',borderRadius:8,padding:'10px 24px',fontWeight:600,cursor:(saving||uploadingReceipt)?'not-allowed':'pointer',fontSize:14,flex: isMobile ? '1' : 'none'}}>
              {uploadingReceipt?'⏳ Uploading…':saving?'⏳ Saving…':editEntry?'✅ Update':'✅ Save'}
            </button>
            <button type="button" onClick={()=>{setShowForm(false);setEditEntry(null);setRows([{...emptyRow}])}} style={{backgroundColor:'#f1f5f9',color:'#64748b',border:'none',borderRadius:8,padding:'10px 20px',fontWeight:600,cursor:'pointer',fontSize:14}}>Cancel</button>
          </div>
        </form>
      </div>
    )}

    {/* ── tabs ── */}
    <div style={{display:'flex',gap: isMobile ? 6 : 8,marginBottom:20,flexWrap:'wrap'}}>
      {[
        ['transactions','🧾 Transactions'],
        ['analytics','📊 Analytics'],
        ['budgets','💰 Budgets'],
        ['recurring','🔁 Recurring'],
        ['daily','📋 Daily'],
        ...(isAdmin?[['fraud',totalFraudAlerts>0?`🕵️ Fraud (${totalFraudAlerts})`:'🕵️ Fraud']]:[] ),
        // PHASE 4: Balance Sheet tab (admin only)
        ...(isAdmin?[['balancesheet','📒 Balance Sheet']]:[] ),
        ['income','💰 Income Analysis'],
['timeline','🕐 Activity'],
      ].map(([id,label])=>(
        <button key={id} style={{
          ...tabStyle(id),
          ...(id==='fraud'?{backgroundColor:activeTab===id?'#7c3aed':'#faf5ff',color:activeTab===id?'white':'#7c3aed',border:'1px solid #e9d5ff'}:{}),
          ...(id==='daily'?{backgroundColor:activeTab===id?'#0369a1':'#f0f9ff',color:activeTab===id?'white':'#0369a1',border:'1px solid #bae6fd'}:{}),
          ...(id==='balancesheet'?{backgroundColor:activeTab===id?'#047857':'#f0fdf4',color:activeTab===id?'white':'#047857',border:'1px solid #bbf7d0'}:{}),
        }} onClick={()=>setActiveTab(id)}>{label}</button>
      ))}
    </div>

    {/* ══ TAB: TRANSACTIONS ══ */}
    {activeTab==='transactions'&&(
      <>
        <div style={{display:'flex',gap: isMobile ? 6 : 8,marginBottom:12,alignItems:'center',flexWrap:'wrap'}}>
          <span style={{fontSize:12,color:'#94a3b8',fontWeight:600}}>Quick:</span>
          {[['today','Today'],['week','Week'],['month','Month'],['lastmonth','Last Mo.'],['year','Year']].map(([k,l])=>(
            <button key={k} style={qBtn(k)} onClick={()=>activeQuick===k?clearQuick():applyQuick(k)}>{l}</button>
          ))}
          {activeQuick&&<button onClick={clearQuick} style={{padding:'5px 8px',borderRadius:6,border:'none',cursor:'pointer',fontSize:11,backgroundColor:'#fee2e2',color:'#dc2626',fontWeight:600}}>✖</button>}
        </div>

        <div style={{display:'grid',gridTemplateColumns:filterCols,gap:10,marginBottom:16}}>
          <input placeholder="🔍 Search…" value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}} style={iStyle}/>
          <select value={typeFilter} onChange={e=>{setTypeFilter(e.target.value);setPage(1)}} style={iStyle}><option value="All">All Types</option><option>Income</option><option>Expense</option></select>
          <select value={modeFilter} onChange={e=>{setModeFilter(e.target.value);setPage(1)}} style={iStyle}><option value="All">All Modes</option>{PAYMENT_MODES.map(m=><option key={m}>{m}</option>)}</select>
          <select value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setPage(1)}} style={iStyle}><option value="All">All Status</option>{STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}</select>
          <select value={acctFilter} onChange={e=>{setAcctFilter(e.target.value);setPage(1)}} style={iStyle}><option value="All">All Accounts</option>{ACCOUNT_TYPES.map(a=><option key={a}>{a}</option>)}</select>
          <input type="date" value={dateFrom} onChange={e=>{setDateFrom(e.target.value);setActiveQuick('');setPage(1)}} title="From" style={iStyle}/>
          <input type="date" value={dateTo} onChange={e=>{setDateTo(e.target.value);setActiveQuick('');setPage(1)}} title="To" style={iStyle}/>
        </div>

        {selected.size>0&&canWrite&&(
          <div style={{display:'flex',alignItems:'center',gap:12,backgroundColor:'#fef3c7',borderRadius:8,padding:'10px 16px',marginBottom:12,border:'1px solid #fde68a',flexWrap:'wrap'}}>
            <span style={{fontSize:13,fontWeight:600,color:'#92400e'}}>{selected.size} selected</span>
            <button onClick={handleBulkDelete} style={{backgroundColor:'#dc2626',color:'white',border:'none',borderRadius:6,padding:'6px 14px',fontSize:13,fontWeight:600,cursor:'pointer'}}>🗑 Delete</button>
            <button onClick={()=>setSelected(new Set())} style={{backgroundColor:'#f1f5f9',color:'#64748b',border:'none',borderRadius:6,padding:'6px 12px',fontSize:13,fontWeight:600,cursor:'pointer'}}>✖ Deselect</button>
          </div>
        )}

        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,flexWrap:'wrap',gap:8}}>
          <span style={{fontSize:13,color:'#64748b'}}>{filteredEntries.length} result{filteredEntries.length!==1?'s':''}{isFiltered?' (filtered)':''}</span>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:12,color:'#94a3b8'}}>Show:</span>
            {PAGE_SIZES.map(s=><button key={s} onClick={()=>{setPageSize(s);setPage(1)}} style={{padding:'3px 10px',borderRadius:6,border:'none',cursor:'pointer',fontSize:12,fontWeight:600,backgroundColor:pageSize===s?'#1e3a5f':'#f1f5f9',color:pageSize===s?'white':'#64748b'}}>{s}</button>)}
          </div>
        </div>

        {loading?<div style={{textAlign:'center',padding:48,color:'#64748b'}}>⏳ Loading…</div>:(
          isMobile ? (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {pagedEntries.map((item,i)=>{
                const isPending=(item.status||'Confirmed')==='Pending'
                const runBal=runningBalanceMap[item.id]??0
                const itemFlags=isAdmin?(fraudFlags[item.id]||[]):[]
                const hasFraud=itemFlags.length>0
                return(
                  <div key={item.id} style={{backgroundColor:hasFraud&&isAdmin?'#fff7ed':isPending?'#fffbeb':'white',borderRadius:10,padding:14,boxShadow:'0 1px 4px rgba(0,0,0,0.08)',borderLeft:`4px solid ${item.type==='Income'?'#16a34a':'#dc2626'}`}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                      <div>
                        <span style={{fontWeight:700,fontSize:15,color:'#1e293b'}}>{item.category}</span>
                        {item.voucher_head&&<span style={{marginLeft:8,fontSize:11,color:'#7c3aed',fontWeight:600}}>{item.voucher_head}</span>}
                      </div>
                      <span style={{fontWeight:700,fontSize:16,color:item.type==='Income'?'#16a34a':'#dc2626'}}>{fmt(item.amount)}</span>
                    </div>
                    <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8}}>
                      <span style={{padding:'2px 8px',borderRadius:999,fontSize:11,fontWeight:600,backgroundColor:item.type==='Income'?'#dcfce7':'#fee2e2',color:item.type==='Income'?'#16a34a':'#dc2626'}}>{item.type}</span>
                      <span style={{padding:'2px 8px',borderRadius:999,fontSize:11,fontWeight:600,backgroundColor:'#f1f5f9',color:'#64748b'}}>{item.payment_mode}</span>
                      <span style={{padding:'2px 8px',borderRadius:999,fontSize:11,fontWeight:600,backgroundColor:isPending?'#fef3c7':'#dcfce7',color:isPending?'#92400e':'#166534'}}>{isPending?'⏳ Pending':'✅'}</span>
                      <span style={{fontSize:11,color:'#94a3b8'}}>{item.entry_date}</span>
                    </div>
                    {item.note&&<p style={{fontSize:12,color:'#64748b',margin:'0 0 8px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.note}</p>}
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span style={{fontSize:11,color:runBal>=0?'#1e3a5f':'#dc2626',fontWeight:600}}>Bal: {fmt(runBal)}</span>
                      <div style={{display:'flex',gap:6}}>
                        {item.receipt_url&&<button onClick={()=>setViewReceipt(item.receipt_url)} style={smallBtn('#eff6ff','#1e3a5f')}>👁</button>}
                        {canWrite&&<button onClick={()=>openEdit(item)} style={smallBtn('#eff6ff','#1e3a5f')}>✏️</button>}
                        {canWrite&&<button onClick={()=>handleDelete(item.id)} style={smallBtn('#fee2e2','#dc2626')}>🗑</button>}
                      </div>
                    </div>
                  </div>
                )
              })}
              {pagedEntries.length===0&&<div style={{textAlign:'center',padding:32,color:'#94a3b8',backgroundColor:'white',borderRadius:12}}>No entries found</div>}
            </div>
          ) : (
            <div style={{backgroundColor:'white',borderRadius:12,boxShadow:'0 2px 8px rgba(0,0,0,0.08)',overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead>
                  <tr style={{backgroundColor:'#f8fafc',borderBottom:'1px solid #e2e8f0'}}>
                    {canWrite&&<th style={{padding:'12px 12px',width:40}}><input type="checkbox" checked={pagedEntries.length>0&&selected.size===pagedEntries.length} onChange={toggleSelectAll}/></th>}
                    {[['#',null],['Date','entry_date'],['Type',null],['Category','category'],['Amount','amount'],['Mode','payment_mode'],['Account',null],['Voucher Head',null],['Status',null],['Note',null],['Running Bal.',null],['Receipt',null],['Actions',null]].map(([h,field])=>(
                      <th key={h} onClick={()=>field&&toggleSort(field)} style={{padding:'12px 12px',textAlign:'left',fontWeight:600,color:'#374151',fontSize:12,cursor:field?'pointer':'default',userSelect:'none',whiteSpace:'nowrap'}}>{h}{field?sortArrow(field):''}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedEntries.map((item,i)=>{
                    const isPending=(item.status||'Confirmed')==='Pending'
                    const runBal=runningBalanceMap[item.id]??0
                    const itemFlags=isAdmin?(fraudFlags[item.id]||[]):[]
                    const hasFraud=itemFlags.length>0
                    return(
                      <tr key={item.id} style={{borderBottom:'1px solid #f1f5f9',backgroundColor:selected.has(item.id)?'#eff6ff':hasFraud&&isAdmin?'#fff7ed':isPending?'#fffbeb':'white'}}>
                        {canWrite&&<td style={{padding:'10px 12px'}}><input type="checkbox" checked={selected.has(item.id)} onChange={()=>toggleSelect(item.id)}/></td>}
                        <td style={tdS}>{(page-1)*pageSize+i+1}</td>
                        <td style={{...tdS,whiteSpace:'nowrap'}}>{item.entry_date}{isAdmin&&itemFlags.some(f=>f.type==='after_hours')&&<span title="After-hours" style={{marginLeft:4,fontSize:10,color:'#f59e0b'}}>🌙</span>}</td>
                        <td style={tdS}><span style={{padding:'3px 10px',borderRadius:999,fontSize:11,fontWeight:600,backgroundColor:item.type==='Income'?'#dcfce7':'#fee2e2',color:item.type==='Income'?'#16a34a':'#dc2626'}}>{item.type}</span></td>
                        <td style={{...tdS,fontWeight:500,color:'#1e293b'}}>{item.category}</td>
                        <td style={{...tdS,fontWeight:600,color:item.type==='Income'?'#16a34a':'#dc2626',whiteSpace:'nowrap'}}>{fmt(item.amount)}{isAdmin&&hasFraud&&<span title={itemFlags.map(f=>f.label).join(', ')} style={{marginLeft:4,fontSize:10,color:'#dc2626',cursor:'help'}}>⚠</span>}</td>
                        <td style={tdS}>{item.payment_mode}</td>
                        <td style={tdS}><span style={{fontSize:11,padding:'2px 7px',borderRadius:4,backgroundColor:item.account_type==='2026-27 A/c'?'#ffe8c2':'#e8f5ee',color:item.account_type==='2026-27 A/c'?'#8b5e00':'#1a7a4a',fontWeight:700}}>{item.account_type||'Cash A/c'}</span></td>
                        <td style={{...tdS,fontSize:12,color:'#7c3aed',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.voucher_head||'—'}</td>
                        <td style={tdS}><span style={{padding:'2px 8px',borderRadius:999,fontSize:11,fontWeight:600,backgroundColor:isPending?'#fef3c7':'#dcfce7',color:isPending?'#92400e':'#166534'}}>{isPending?'⏳ Pending':'✅ Confirmed'}</span></td>
                        <td style={{...tdS,maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.note||'—'}</td>
                        <td style={{...tdS,fontWeight:600,whiteSpace:'nowrap',color:runBal>=0?'#1e3a5f':'#dc2626'}}>{fmt(runBal)}</td>
                        <td style={{...tdS,textAlign:'center'}}>
                          {item.receipt_url?(<div style={{display:'flex',gap:4,justifyContent:'center'}}><button onClick={()=>setViewReceipt(item.receipt_url)} style={smallBtn('#eff6ff','#1e3a5f')}>👁</button>{isAdmin&&<button onClick={()=>deleteReceipt(item)} style={smallBtn('#fee2e2','#dc2626')}>🗑</button>}</div>):<span style={{color:'#cbd5e1',fontSize:12}}>—</span>}
                        </td>
                        <td style={tdS}>
                          <div style={{display:'flex',gap:4,alignItems:'center',flexWrap:'wrap'}}>
                            {canWrite&&<button onClick={()=>openEdit(item)} style={smallBtn('#eff6ff','#1e3a5f')}>✏️</button>}
                            {isAdmin&&<button onClick={()=>openDuplicate(item)} style={smallBtn('#f0fdf4','#16a34a')} title="Duplicate">⧉</button>}
                            {canWrite&&<button onClick={()=>handleDelete(item.id)} style={smallBtn('#fee2e2','#dc2626')}>🗑</button>}
                            {item.edited_by&&<span title={`Edited by ${item.edited_by}`} style={{fontSize:10,color:'#f59e0b',fontWeight:700,cursor:'help'}}>✎</span>}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {pagedEntries.length===0&&<tr><td colSpan={canWrite?14:13} style={{padding:32,textAlign:'center',color:'#94a3b8'}}>No entries found</td></tr>}
                </tbody>
              </table>
            </div>
          )
        )}

        {totalPages>1&&(
          <div style={{display:'flex',justifyContent:'center',alignItems:'center',gap: isMobile ? 4 : 8,marginTop:16,flexWrap:'wrap'}}>
            <button onClick={()=>setPage(1)} disabled={page===1} style={pgBtn(page===1)}>«</button>
            <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} style={pgBtn(page===1)}>‹</button>
            {Array.from({length:Math.min(isMobile?5:7,totalPages)},(_,i)=>{let p;const maxPages=isMobile?5:7;if(totalPages<=maxPages)p=i+1;else if(page<=Math.floor(maxPages/2)+1)p=i+1;else if(page>=totalPages-Math.floor(maxPages/2))p=totalPages-maxPages+1+i;else p=page-Math.floor(maxPages/2)+i;return<button key={p} onClick={()=>setPage(p)} style={{...pgBtn(false),backgroundColor:page===p?'#1e3a5f':'#f1f5f9',color:page===p?'white':'#64748b'}}>{p}</button>})}
            <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} style={pgBtn(page===totalPages)}>›</button>
            <button onClick={()=>setPage(totalPages)} disabled={page===totalPages} style={pgBtn(page===totalPages)}>»</button>
            <span style={{fontSize:12,color:'#94a3b8'}}>Page {page}/{totalPages}</span>
          </div>
        )}
      </>
    )}

    {/* ══ TAB: DAILY REGISTER (Income / Expense by date) ══ */}
    {activeTab==='daily'&&(
      <div>
        <div style={{backgroundColor:'#1e3a5f',borderRadius:12,padding: isMobile ? '16px' : '20px 24px',marginBottom:20}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16,flexWrap:'wrap',gap:10}}>
            <div>
              <h2 style={{fontSize: isMobile ? 15 : 18,fontWeight:800,color:'white',margin:0}}>📊 Daily {dailyLabelWord} Register</h2>
              <p style={{fontSize:12,color:'rgba(255,255,255,0.5)',margin:'4px 0 0'}}>{dailyTypeFilter} entries grouped by {dailyIsIncome?(dailyDateMode==='payment'?'actual payment date':'entry date'):'entry date'}</p>
            </div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              <button onClick={exportDailyCSV} style={{backgroundColor:'rgba(255,255,255,0.1)',color:'white',border:'1px solid rgba(255,255,255,0.2)',borderRadius:8,padding:'8px 12px',fontWeight:600,cursor:'pointer',fontSize:12}}>⬇ CSV</button>
              <button onClick={printDailyRegister} style={{backgroundColor:'rgba(255,255,255,0.15)',color:'white',border:'1px solid rgba(255,255,255,0.3)',borderRadius:8,padding:'8px 12px',fontWeight:600,cursor:'pointer',fontSize:12}}>🖨 Print</button>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:dailySumCols,gap:12}}>
            {[{label:'Total Days',value:dailyGroups.length,isCurrency:false},{label:dailyIsIncome?'Payments Received':'Total Entries',value:dailyFilteredEntries.length,isCurrency:false},{label:'Cash Total',value:dailyCashAmt,color:'#fbbf24'},{label:'Bank Transfer',value:dailyBankAmt,color:'#f87171'}].map(c=>(
              <div key={c.label} style={{backgroundColor:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:10,padding:'12px 14px'}}>
                <p style={{fontSize:11,color:'rgba(255,255,255,0.5)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.6px',margin:'0 0 6px'}}>{c.label}</p>
                <p style={{fontFamily:'monospace',fontSize: isMobile ? 16 : 20,fontWeight:600,color:c.color||'white',margin:0}}>{c.isCurrency===false?c.value:fmt(c.value)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* PAYMENT-DATE FILTER FIX: Income/Expense toggle + quick date range, so you can instantly see "how many paid on date X" */}
        <div style={{display:'flex',gap: isMobile ? 6 : 8,marginBottom:12,alignItems:'center',flexWrap:'wrap'}}>
          <span style={{fontSize:12,color:'#94a3b8',fontWeight:600}}>Showing:</span>
          <button onClick={()=>setDailyTypeFilter('Income')} style={{padding: isMobile ? '5px 10px' : '5px 14px',borderRadius:6,border:'1px solid',borderColor:dailyIsIncome?'#16a34a':'#bbf7d0',cursor:'pointer',fontSize:isMobile?11:12,fontWeight:700,backgroundColor:dailyIsIncome?'#16a34a':'#f0fdf4',color:dailyIsIncome?'white':'#16a34a'}}>📈 Income / Payments</button>
          <button onClick={()=>setDailyTypeFilter('Expense')} style={{padding: isMobile ? '5px 10px' : '5px 14px',borderRadius:6,border:'1px solid',borderColor:!dailyIsIncome?'#dc2626':'#fecaca',cursor:'pointer',fontSize:isMobile?11:12,fontWeight:700,backgroundColor:!dailyIsIncome?'#dc2626':'#fef2f2',color:!dailyIsIncome?'white':'#dc2626'}}>📉 Expense</button>
          {dailyIsIncome&&(
            <>
              <span style={{width:1,height:20,backgroundColor:'#e2e8f0',margin:'0 4px'}}/>
              <span style={{fontSize:12,color:'#94a3b8',fontWeight:600}}>Filter by:</span>
              <button onClick={()=>setDailyDateMode('payment')} style={{padding: isMobile ? '5px 10px' : '5px 14px',borderRadius:6,border:'1px solid',borderColor:dailyDateMode==='payment'?'#1e3a5f':'#cbd5e1',cursor:'pointer',fontSize:isMobile?11:12,fontWeight:700,backgroundColor:dailyDateMode==='payment'?'#1e3a5f':'#f1f5f9',color:dailyDateMode==='payment'?'white':'#64748b'}}>💰 Payment Date</button>
              <button onClick={()=>setDailyDateMode('entry')} style={{padding: isMobile ? '5px 10px' : '5px 14px',borderRadius:6,border:'1px solid',borderColor:dailyDateMode==='entry'?'#1e3a5f':'#cbd5e1',cursor:'pointer',fontSize:isMobile?11:12,fontWeight:700,backgroundColor:dailyDateMode==='entry'?'#1e3a5f':'#f1f5f9',color:dailyDateMode==='entry'?'white':'#64748b'}}>🗓 Entry Date</button>
            </>
          )}
          <span style={{width:1,height:20,backgroundColor:'#e2e8f0',margin:'0 4px'}}/>
          <span style={{fontSize:12,color:'#94a3b8',fontWeight:600}}>Quick:</span>
          {[['today','Today'],['week','Week'],['month','Month'],['lastmonth','Last Mo.'],['year','Year']].map(([k,l])=>(
            <button key={k} style={qBtn(k)} onClick={()=>activeQuick===k?clearQuick():applyQuick(k)}>{l}</button>
          ))}
          {activeQuick&&<button onClick={clearQuick} style={{padding:'5px 8px',borderRadius:6,border:'none',cursor:'pointer',fontSize:11,backgroundColor:'#fee2e2',color:'#dc2626',fontWeight:600}}>✖</button>}
        </div>

        <div style={{display:'grid',gridTemplateColumns: isMobile ? '1fr 1fr' : 'auto auto auto auto auto auto auto',gap:8,marginBottom:16,alignItems:'center'}}>
          <input placeholder="🔍 Search…" value={dailySearch} onChange={e=>setDailySearch(e.target.value)} style={{...iStyle, gridColumn: isMobile ? 'span 2' : 'auto'}}/>
          <select value={dailyAcctFilter} onChange={e=>setDailyAcctFilter(e.target.value)} style={iStyle}><option value="All">All Accounts</option>{ACCOUNT_TYPES.map(a=><option key={a}>{a}</option>)}</select>
          <select value={dailyModeFilter} onChange={e=>setDailyModeFilter(e.target.value)} style={iStyle}><option value="All">All Modes</option>{PAYMENT_MODES.map(m=><option key={m}>{m}</option>)}</select>
          <input placeholder="Voucher head…" value={voucherHead} onChange={e=>setVoucherHead(e.target.value)} style={iStyle}/>
          <input type="date" value={dateFrom} onChange={e=>{setDateFrom(e.target.value);setActiveQuick('')}} title={dailyIsIncome&&dailyDateMode==='payment'?'Payment date from':'Entry date from'} style={iStyle}/>
          <input type="date" value={dateTo} onChange={e=>{setDateTo(e.target.value);setActiveQuick('')}} title={dailyIsIncome&&dailyDateMode==='payment'?'Payment date to':'Entry date to'} style={iStyle}/>
          {(dailySearch||dailyAcctFilter!=='All'||dailyModeFilter!=='All'||voucherHead||dateFrom||dateTo)&&
            <button onClick={()=>{setDailySearch('');setDailyAcctFilter('All');setDailyModeFilter('All');setVoucherHead('');setDateFrom('');setDateTo('');setActiveQuick('')}} style={{...smallBtn('#fee2e2','#dc2626'),padding:'9px 14px',fontSize:12, gridColumn: isMobile ? 'span 2' : 'auto'}}>✖ Clear</button>}
          <div style={{display:'flex',gap:6, gridColumn: isMobile ? 'span 2' : 'auto'}}>
            <button onClick={()=>setDailyCollapsed(prev=>{const n={};dailyGroups.forEach(([d])=>{n[d]=true});return n})} style={{...smallBtn('#f1f5f9','#64748b'),padding:'9px 12px',fontSize:12,flex:1}}>Collapse</button>
            <button onClick={()=>setDailyCollapsed({})} style={{...smallBtn('#eff6ff','#1e3a5f'),padding:'9px 12px',fontSize:12,flex:1}}>Expand</button>
          </div>
        </div>

        {dailyGroups.length===0?<div style={{textAlign:'center',padding:48,color:'#94a3b8',backgroundColor:'white',borderRadius:12}}>No {dailyTypeFilter.toLowerCase()} entries found for this date range.</div>:(
          <>
            {dailyGroups.map(([date,dayRows])=>{
              const dayTotal=dayRows.reduce((s,e)=>s+Number(e.amount),0)
              const dow=new Date(date).toLocaleDateString('en-IN',{weekday:'long'})
              const isCollapsed=dailyCollapsed[date]
              return(
                <div key={date} style={{marginBottom:14,borderRadius:10,overflow:'hidden',boxShadow:'0 2px 6px rgba(0,0,0,0.06)'}}>
                  <div onClick={()=>setDailyCollapsed(prev=>({...prev,[date]:!prev[date]}))} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 16px',backgroundColor:'#1e3a5f',cursor:'pointer',userSelect:'none',flexWrap:'wrap',gap:6}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                      <span style={{fontWeight:800,color:'white',fontSize: isMobile ? 13 : 15}}>{date}</span>
                      {!isMobile&&<span style={{fontSize:12,color:'rgba(255,255,255,0.5)',fontWeight:600}}>{dow}</span>}
                      <span style={{backgroundColor:'rgba(255,255,255,0.15)',color:'rgba(255,255,255,0.8)',fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:999}}>{dayRows.length} {dailyIsIncome?'paid':'entries'}</span>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <span style={{fontFamily:'monospace',fontSize: isMobile ? 14 : 16,fontWeight:600,color:'white'}}>{fmt(dayTotal)}</span>
                      <span style={{color:'rgba(255,255,255,0.4)',fontSize:13,transform:isCollapsed?'rotate(-90deg)':'rotate(0deg)',display:'inline-block'}}>▼</span>
                    </div>
                  </div>
                  {!isCollapsed&&(
                    isMobile ? (
                      <div style={{backgroundColor:'white',border:'1.5px solid #d8e3f0',borderTop:'none',padding:12,display:'flex',flexDirection:'column',gap:8}}>
                        {dayRows.map((item,rowIdx)=>(
                          <div key={item.id} style={{borderBottom:'1px solid #f0f4f9',paddingBottom:8}}>
                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4}}>
                              <div>
                                <span style={{fontSize:11,color:'#8a9ab0',fontFamily:'monospace'}}>{rowIdx+1}. </span>
                                <span style={{fontWeight:600,fontSize:13,color:'#1a2535'}}>{item.note||item.category||'—'}</span>
                              </div>
                              <span style={{fontFamily:'monospace',fontSize:13,fontWeight:700,color:dailyAmtColor}}>{fmt(item.amount)}</span>
                            </div>
                            <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
                              <span style={{fontSize:11,padding:'1px 6px',borderRadius:4,backgroundColor:item.account_type==='2026-27 A/c'?'#ffe8c2':'#e8f5ee',color:item.account_type==='2026-27 A/c'?'#8b5e00':'#1a7a4a',fontWeight:700}}>{item.account_type||'Cash A/c'}</span>
                              <span style={{fontSize:11,color:'#7c3aed',fontWeight:500}}>{item.voucher_head||''}</span>
                              <span style={{fontSize:11,color:'#64748b'}}>{item.payment_mode}</span>
                              {dailyIsIncome&&item.payment_date&&item.payment_date!==item.entry_date&&<span style={{fontSize:10,color:'#f59e0b',fontWeight:600}}>{dailyDateMode==='payment'?`Entered ${item.entry_date}`:`Paid ${item.payment_date}`}</span>}
                              {canWrite&&<div style={{marginLeft:'auto',display:'flex',gap:4}}>
                                <button onClick={()=>openEdit(item)} style={smallBtn('#eff6ff','#1e3a5f')}>✏️</button>
                                <button onClick={()=>handleDelete(item.id)} style={smallBtn('#fee2e2','#dc2626')}>🗑</button>
                              </div>}
                            </div>
                          </div>
                        ))}
                        <div style={{display:'flex',justifyContent:'space-between',paddingTop:4,fontWeight:700,fontSize:13,color:'#1e3a5f'}}>
                          <span>Daily Total ({dayRows.length})</span>
                          <span style={{fontFamily:'monospace'}}>{fmt(dayTotal)}</span>
                        </div>
                      </div>
                    ) : (
                      <div style={{backgroundColor:'white',border:'1.5px solid #d8e3f0',borderTop:'none',overflowX:'auto'}}>
                        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                          <thead>
                            <tr style={{backgroundColor:'#f7fafd'}}>
                              {['#','Account','Voucher Head','Description','Pay Mode',`Amount (${dailyDrCr})`,canWrite&&'Actions'].filter(Boolean).map(h=><th key={h} style={{padding:'8px 12px',textAlign:h.startsWith('Amount')?'right':'left',fontFamily:'Outfit,sans-serif',fontSize:11,fontWeight:800,color:'#5a6a7e',textTransform:'uppercase',letterSpacing:'0.5px',borderBottom:'1.5px solid #d8e3f0'}}>{h}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {dayRows.map((item,rowIdx)=>{
                              const acctColor=item.account_type==='2026-27 A/c'?{bg:'#ffe8c2',color:'#8b5e00'}:{bg:'#e8f5ee',color:'#1a7a4a'}
                              const modeColor={Cash:{bg:'#e8f0fa',color:'#1e3a5f'},Bank:{bg:'#f3e8ff',color:'#6b21a8'},UPI:{bg:'#ecfdf5',color:'#065f46'},Card:{bg:'#fde8e8',color:'#991b1b'}}[item.payment_mode]||{bg:'#f1f5f9',color:'#374151'}
                              return(
                                <tr key={item.id} style={{borderBottom:'1px solid #f0f4f9'}}>
                                  <td style={{padding:'9px 12px',fontFamily:'monospace',fontSize:11,color:'#8a9ab0'}}>{rowIdx+1}</td>
                                  <td style={{padding:'9px 12px'}}><span style={{display:'inline-block',padding:'2px 8px',borderRadius:5,fontSize:11,fontWeight:700,backgroundColor:acctColor.bg,color:acctColor.color}}>{item.account_type||'Cash A/c'}</span></td>
                                  <td style={{padding:'9px 12px',fontSize:12,color:'#7c3aed',fontWeight:500}}>{item.voucher_head||'—'}</td>
                                  <td style={{padding:'9px 12px',color:'#1a2535',fontWeight:500,maxWidth:260}}>{item.note||item.category||'—'}{dailyIsIncome&&item.payment_date&&item.payment_date!==item.entry_date&&<span style={{marginLeft:6,fontSize:10,color:'#f59e0b',fontWeight:600}}>({dailyDateMode==='payment'?`Entered ${item.entry_date}`:`Paid ${item.payment_date}`})</span>}</td>
                                  <td style={{padding:'9px 12px'}}><span style={{display:'inline-block',padding:'2px 8px',borderRadius:5,fontSize:11,fontWeight:700,backgroundColor:modeColor.bg,color:modeColor.color}}>{item.payment_mode}</span></td>
                                  <td style={{padding:'9px 12px',fontFamily:'monospace',fontSize:13,fontWeight:600,color:dailyAmtColor,textAlign:'right',whiteSpace:'nowrap'}}>{fmt(item.amount)}</td>
                                  {canWrite&&<td style={{padding:'9px 12px',textAlign:'center'}}><div style={{display:'flex',gap:4,justifyContent:'center'}}><button onClick={()=>openEdit(item)} style={smallBtn('#eff6ff','#1e3a5f')}>✏️</button><button onClick={()=>handleDelete(item.id)} style={smallBtn('#fee2e2','#dc2626')}>🗑</button></div></td>}
                                </tr>
                              )
                            })}
                            <tr style={{backgroundColor:'#f7fafd',borderTop:'1.5px solid #d8e3f0'}}>
                              <td colSpan={canWrite?5:4} style={{padding:'8px 12px',fontWeight:700,fontSize:13,color:'#1e3a5f'}}>Daily Total — {dayRows.length} {dailyIsIncome?'payments':'transactions'}</td>
                              <td style={{padding:'8px 12px',fontFamily:'monospace',fontSize:14,fontWeight:700,color:'#1e3a5f',textAlign:'right'}}>{fmt(dayTotal)}</td>
                              {canWrite&&<td/>}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )
                  )}
                </div>
              )
            })}
            <div style={{backgroundColor:'#1e3a5f',borderRadius:12,padding: isMobile ? '16px' : '20px 28px',display:'flex',flexDirection: isMobile ? 'column' : 'row',justifyContent:'space-between',alignItems: isMobile ? 'stretch' : 'center',gap:16,marginTop:8}}>
              <span style={{fontWeight:800,color:'white',fontSize: isMobile ? 14 : 16}}>Grand Total</span>
              <div style={{display:'flex',gap: isMobile ? 16 : 32,flexWrap:'wrap'}}>
                {[{label:'Cash',value:dailyCashAmt,color:'#fbbf24'},{label:'Bank',value:dailyBankAmt,color:'#fbbf24'},{label:'Total',value:dailyTotalAmt,color:'white'}].map(c=>(
                  <div key={c.label} style={{textAlign: isMobile ? 'left' : 'right'}}>
                    <p style={{fontSize:11,color:'rgba(255,255,255,0.5)',textTransform:'uppercase',letterSpacing:'0.5px',margin:'0 0 3px'}}>{c.label}</p>
                    <p style={{fontFamily:'monospace',fontSize: isMobile ? 15 : 18,fontWeight:700,color:c.color,margin:0}}>{fmt(c.value)}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    )}

    {/* ══ TAB: ANALYTICS ══ */}
    {activeTab==='analytics'&&(
      <div>
        <div style={{backgroundColor:'#eff6ff',borderRadius:12,padding: isMobile ? 14 : 20,marginBottom:24,borderLeft:'4px solid #1e3a5f'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:insights?12:0,flexWrap:'wrap',gap:10}}>
            <h3 style={{fontSize: isMobile ? 14 : 16,fontWeight:600,color:'#1e3a5f',margin:0}}>🤖 AI Financial Insights</h3>
            <button onClick={getInsights} disabled={loadingAI} style={{backgroundColor:'#1e3a5f',color:'white',border:'none',borderRadius:8,padding:'8px 16px',fontWeight:600,cursor:loadingAI?'not-allowed':'pointer',fontSize:13}}>{loadingAI?'⏳ Analysing…':'✨ Get Insights'}</button>
          </div>
          {insights&&<div style={{fontSize:14,color:'#1e3a5f',lineHeight:1.7,whiteSpace:'pre-wrap'}}>{insights}</div>}
        </div>
        <div style={{display:'grid',gridTemplateColumns:chartGridCols,gap:20,marginBottom:20}}>
          <div style={chartCard}><h3 style={chartTitle}>Monthly Income vs Expense</h3><ResponsiveContainer width="100%" height={isMobile?200:250}><BarChart data={monthlyData}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/><XAxis dataKey="month" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`}/><Tooltip formatter={v=>fmt(v)}/><Legend/><Bar dataKey="Income" fill="#16a34a" radius={[4,4,0,0]}/><Bar dataKey="Expense" fill="#dc2626" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>
          <div style={chartCard}><h3 style={chartTitle}>Net Balance Trend</h3><ResponsiveContainer width="100%" height={isMobile?200:250}><LineChart data={monthlyData.map(m=>({...m,Net:m.Income-m.Expense}))}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/><XAxis dataKey="month" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`}/><Tooltip formatter={v=>fmt(v)}/><Line dataKey="Net" stroke="#1e3a5f" strokeWidth={2} dot={{r:4}}/></LineChart></ResponsiveContainer></div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:chartGridCols,gap:20,marginBottom:20}}>
          <div style={chartCard}><h3 style={chartTitle}>Top Categories</h3><ResponsiveContainer width="100%" height={isMobile?200:250}><PieChart><Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={isMobile?70:90} label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>{categoryData.map((_,idx)=><Cell key={idx} fill={CHART_COLORS[idx%CHART_COLORS.length]}/>)}</Pie><Tooltip formatter={v=>fmt(v)}/></PieChart></ResponsiveContainer></div>
          <div style={chartCard}><h3 style={chartTitle}>Payment Mode</h3><ResponsiveContainer width="100%" height={isMobile?200:250}><PieChart><Pie data={modeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={isMobile?70:90} label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>{modeData.map((_,idx)=><Cell key={idx} fill={CHART_COLORS[(idx+4)%CHART_COLORS.length]}/>)}</Pie><Tooltip formatter={v=>fmt(v)}/></PieChart></ResponsiveContainer></div>
        </div>
        <div style={{...chartCard,marginBottom:20,overflowX:'auto'}}>
          <h3 style={chartTitle}>Category P&L — This Month vs Last Month</h3>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize: isMobile ? 12 : 13}}>
            <thead><tr style={{backgroundColor:'#f8fafc'}}>{['Category','Type','This Month','Last Month','Change','Variance'].map(h=><th key={h} style={{padding:'10px 14px',textAlign:'left',fontWeight:600,color:'#374151',fontSize:12,borderBottom:'1px solid #e2e8f0'}}>{h}</th>)}</tr></thead>
            <tbody>
              {[...INCOME_CATEGORIES.map(cat=>({cat,type:'Income',thisVal:plData.thisInc[cat]||0,prevVal:plData.prevInc[cat]||0})),...EXPENSE_CATEGORIES.map(cat=>({cat,type:'Expense',thisVal:plData.thisExp[cat]||0,prevVal:plData.prevExp[cat]||0}))].filter(r=>r.thisVal>0||r.prevVal>0).map(({cat,type,thisVal,prevVal})=>{
                const diff=thisVal-prevVal,pct=prevVal>0?((diff/prevVal)*100).toFixed(1):'—'
                return(<tr key={`${type}-${cat}`} style={{borderBottom:'1px solid #f1f5f9'}}>
                  <td style={{...tdS,fontWeight:500,color:'#1e293b'}}>{cat}</td>
                  <td style={tdS}><span style={{padding:'2px 8px',borderRadius:999,fontSize:11,fontWeight:600,backgroundColor:type==='Income'?'#dcfce7':'#fee2e2',color:type==='Income'?'#16a34a':'#dc2626'}}>{type}</span></td>
                  <td style={{...tdS,fontWeight:600,color:type==='Income'?'#16a34a':'#dc2626'}}>{fmt(thisVal)}</td>
                  <td style={tdS}>{fmt(prevVal)}</td>
                  <td style={{...tdS,fontWeight:600,color:diff>=0?'#16a34a':'#dc2626'}}>{diff>=0?'+':''}{fmt(diff)}</td>
                  <td style={{...tdS,color:diff>=0?'#16a34a':'#dc2626'}}>{pct!=='—'?`${diff>=0?'+':''}${pct}%`:'—'}</td>
                </tr>)
              })}
              <tr style={{backgroundColor:'#f8fafc',fontWeight:700}}>
                <td style={{...tdS,color:'#1e293b',fontWeight:700}} colSpan={2}>Net</td>
                <td style={{...tdS,color:plData.totalThisInc-plData.totalThisExp>=0?'#16a34a':'#dc2626',fontWeight:700}}>{fmt(plData.totalThisInc-plData.totalThisExp)}</td>
                <td style={{...tdS,fontWeight:700}}>{fmt(plData.totalPrevInc-plData.totalPrevExp)}</td>
                <td colSpan={2}/>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    )}

    {/* ══ TAB: BUDGETS ══ */}
    {activeTab==='budgets'&&(
      <div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,flexWrap:'wrap',gap:10}}>
          <div>
            <p style={{color:'#64748b',fontSize:14,margin:0}}>Monthly budget limits per expense category</p>
            {budgetMeta?.edited_by&&<p style={{fontSize:11,color:'#f59e0b',margin:'4px 0 0',fontWeight:600}}>✎ Last edited by <strong>{budgetMeta.edited_by}</strong></p>}
          </div>
          {!editBudgets?canWrite&&<button onClick={()=>{setEditBudgets(true);setBudgetDraft(budgets)}} style={{backgroundColor:'#1e3a5f',color:'white',border:'none',borderRadius:8,padding:'8px 16px',fontWeight:600,cursor:'pointer',fontSize:13}}>✏️ Edit Budgets</button>
          :<div style={{display:'flex',gap:10,flexWrap:'wrap'}}><button onClick={saveBudgets} style={{backgroundColor:'#16a34a',color:'white',border:'none',borderRadius:8,padding:'8px 16px',fontWeight:600,cursor:'pointer',fontSize:13}}>✅ Save</button><button onClick={()=>setEditBudgets(false)} style={{backgroundColor:'#f1f5f9',color:'#64748b',border:'none',borderRadius:8,padding:'8px 16px',fontWeight:600,cursor:'pointer',fontSize:13}}>Cancel</button></div>}
        </div>
        <div style={{display:'grid',gridTemplateColumns:budgetGridCols,gap:16,marginBottom:28}}>
          {EXPENSE_CATEGORIES.map(cat=>{const limit=Number(budgets[cat])||0,spent=monthlyExpenses[cat]||0,pct=limit>0?Math.min((spent/limit)*100,100):0,over=limit>0&&spent>limit,barColor=over?'#dc2626':pct>75?'#f59e0b':'#16a34a';return(
            <div key={cat} style={{backgroundColor:'white',borderRadius:12,padding:18,boxShadow:'0 2px 8px rgba(0,0,0,0.06)',borderLeft:`4px solid ${over?'#dc2626':'#e2e8f0'}`}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}><span style={{fontWeight:600,color:'#1e293b'}}>{cat}</span>{over&&<span style={{fontSize:12,color:'#dc2626',fontWeight:600}}>⚠️ Over!</span>}</div>
              {editBudgets&&canWrite&&<input type="number" min="0" value={budgetDraft[cat]||''} placeholder="Set budget limit" onChange={e=>setBudgetDraft({...budgetDraft,[cat]:e.target.value})} style={{...iStyle,marginBottom:10}}/>}
              <div style={{display:'flex',justifyContent:'space-between',fontSize:13,color:'#64748b',marginBottom:6}}><span>Spent: <strong style={{color:over?'#dc2626':'#1e293b'}}>{fmt(spent)}</strong></span><span>Limit: <strong>{limit>0?fmt(limit):'Not set'}</strong></span></div>
              {limit>0&&<><div style={{backgroundColor:'#f1f5f9',borderRadius:999,height:8,overflow:'hidden'}}><div style={{width:`${pct}%`,height:'100%',backgroundColor:barColor,borderRadius:999,transition:'width .4s'}}/></div><div style={{fontSize:11,color:'#94a3b8',marginTop:4}}>{pct.toFixed(0)}% used</div></>}
            </div>
          )})}
        </div>
        <div style={chartCard}>
          <h3 style={chartTitle}>Budget vs Actual — Last 6 Months</h3>
          <ResponsiveContainer width="100%" height={isMobile?200:280}><BarChart data={budgetChartData} barCategoryGap="20%"><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/><XAxis dataKey="month" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`}/><Tooltip formatter={v=>fmt(v)}/><Legend/>{EXPENSE_CATEGORIES.filter(cat=>Number(budgets[cat])>0).map((cat,idx)=><Bar key={cat} dataKey={cat} fill={CHART_COLORS[idx%CHART_COLORS.length]} radius={[3,3,0,0]}/>)}</BarChart></ResponsiveContainer>
          {EXPENSE_CATEGORIES.filter(cat=>Number(budgets[cat])>0).length===0&&<p style={{textAlign:'center',color:'#94a3b8',fontSize:14,padding:32}}>Set budget limits above to see this chart</p>}
        </div>
      </div>
    )}

    {/* ══ TAB: RECURRING ══ */}
    {activeTab==='recurring'&&(
      <div>
        <p style={{color:'#64748b',fontSize:14,marginBottom:20}}>Auto-added every month. Edit to remove the recurring flag.</p>
        {recurringEntries.length===0?<div style={{textAlign:'center',padding:48,color:'#94a3b8',backgroundColor:'white',borderRadius:12}}>No recurring entries yet.</div>:(
          isMobile ? (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {recurringEntries.map(item=>(
                <div key={item.id} style={{backgroundColor:'white',borderRadius:10,padding:14,boxShadow:'0 1px 4px rgba(0,0,0,0.08)',borderLeft:`4px solid ${item.type==='Income'?'#16a34a':'#dc2626'}`}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                    <span style={{fontWeight:700,color:'#1e293b'}}>{item.category}</span>
                    <span style={{fontWeight:700,color:item.type==='Income'?'#16a34a':'#dc2626'}}>{fmt(item.amount)}</span>
                  </div>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8}}>
                    <span style={{padding:'2px 8px',borderRadius:999,fontSize:11,fontWeight:600,backgroundColor:item.type==='Income'?'#dcfce7':'#fee2e2',color:item.type==='Income'?'#16a34a':'#dc2626'}}>{item.type}</span>
                    <span style={{fontSize:12,color:'#7c3aed'}}>{item.voucher_head||''}</span>
                    <span style={{fontSize:12,color:'#64748b'}}>{item.payment_mode}</span>
                  </div>
                  {canWrite&&<button onClick={()=>openEdit(item)} style={{...smallBtn('#eff6ff','#1e3a5f'),padding:'6px 12px',fontSize:12}}>✏️ Edit</button>}
                </div>
              ))}
            </div>
          ) : (
            <div style={{backgroundColor:'white',borderRadius:12,boxShadow:'0 2px 8px rgba(0,0,0,0.08)',overflow:'hidden'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:14}}>
                <thead><tr style={{backgroundColor:'#f8fafc',borderBottom:'1px solid #e2e8f0'}}>{['Type','Category','Amount','Mode','Account','Voucher Head','Note','Actions'].map(h=><th key={h} style={{padding:'12px 16px',textAlign:'left',fontWeight:600,color:'#374151',fontSize:13}}>{h}</th>)}</tr></thead>
                <tbody>
                  {recurringEntries.map(item=>(
                    <tr key={item.id} style={{borderBottom:'1px solid #f1f5f9'}}>
                      <td style={tdS}><span style={{padding:'3px 10px',borderRadius:999,fontSize:12,fontWeight:600,backgroundColor:item.type==='Income'?'#dcfce7':'#fee2e2',color:item.type==='Income'?'#16a34a':'#dc2626'}}>{item.type}</span></td>
                      <td style={{...tdS,fontWeight:500,color:'#1e293b'}}>{item.category}</td>
                      <td style={{...tdS,fontWeight:600,color:item.type==='Income'?'#16a34a':'#dc2626'}}>{fmt(item.amount)}</td>
                      <td style={tdS}>{item.payment_mode}</td>
                      <td style={tdS}><span style={{fontSize:11,padding:'2px 7px',borderRadius:4,backgroundColor:'#e8f0fa',color:'#1e3a5f',fontWeight:700}}>{item.account_type||'Cash A/c'}</span></td>
                      <td style={{...tdS,color:'#7c3aed'}}>{item.voucher_head||'—'}</td>
                      <td style={tdS}>{item.note||'—'}</td>
                      <td style={tdS}>{canWrite&&<button onClick={()=>openEdit(item)} style={smallBtn('#eff6ff','#1e3a5f')}>✏️ Edit</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    )}

    {/* ══ TAB: FRAUD WATCH (admin only) ══ */}
    {activeTab==='fraud'&&isAdmin&&(
      <div>
        <div style={{display:'grid',gridTemplateColumns:fraudGridCols,gap: isMobile ? 10 : 14,marginBottom:24}}>
          {[{label:'High Risk',value:fraudSummary.high||0,color:'#dc2626',bg:'#fee2e2',icon:'🚨'},{label:'Medium Risk',value:fraudSummary.medium||0,color:'#d97706',bg:'#fef3c7',icon:'⚠️'},{label:'Deleted Today',value:fraudSummary.phantoms?.length||0,color:'#7c3aed',bg:'#f3e8ff',icon:'👻'},{label:'CSV Exports',value:exportLog.length,color:'#1e3a5f',bg:'#eff6ff',icon:'📤'}].map(c=>(
            <div key={c.label} style={{backgroundColor:c.bg,borderRadius:12,padding:16,borderLeft:`4px solid ${c.color}`}}>
              <div style={{fontSize:20,marginBottom:4}}>{c.icon}</div>
              <p style={{fontSize:12,color:c.color,fontWeight:600,margin:0}}>{c.label}</p>
              <h2 style={{fontSize:28,fontWeight:'bold',color:c.color,margin:'4px 0 0'}}>{c.value}</h2>
            </div>
          ))}
        </div>
        <div style={{...chartCard,marginBottom:20,borderLeft:'4px solid #dc2626',overflowX:'auto'}}>
          <h3 style={{...chartTitle,color:'#dc2626'}}>🚨 Flagged Transactions</h3>
          {(fraudSummary.flaggedEntries||[]).length===0?<p style={{color:'#94a3b8',fontSize:14}}>No flagged transactions.</p>:(
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead><tr style={{backgroundColor:'#fef2f2'}}>{['Date','Type','Category','Amount','Added by','Flags'].map(h=><th key={h} style={{padding:'10px 12px',textAlign:'left',fontWeight:600,color:'#991b1b',fontSize:12,borderBottom:'1px solid #fecaca'}}>{h}</th>)}</tr></thead>
              <tbody>{(fraudSummary.flaggedEntries||[]).map(item=>(<tr key={item.id} style={{borderBottom:'1px solid #fff1f2'}}>
                <td style={tdS}>{item.entry_date}</td>
                <td style={tdS}><span style={{padding:'2px 8px',borderRadius:999,fontSize:11,fontWeight:600,backgroundColor:item.type==='Income'?'#dcfce7':'#fee2e2',color:item.type==='Income'?'#16a34a':'#dc2626'}}>{item.type}</span></td>
                <td style={{...tdS,fontWeight:500}}>{item.category}</td>
                <td style={{...tdS,fontWeight:600,color:item.type==='Income'?'#16a34a':'#dc2626'}}>{fmt(item.amount)}</td>
                <td style={tdS}>{item.added_by||item.edited_by||'admin'}</td>
                {/* PHASE 3 FIX: resolve button on each fraud flag */}
                <td style={tdS}><div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                  {(fraudFlags[item.id]||[]).map((f,i)=>(
                    <span key={i} style={{display:'flex',alignItems:'center',gap:4}}>
                      <span style={{fontSize:11,color:'#374151'}}>{f.label}</span>
                      <SeverityBadge severity={f.severity}/>
                      {f.alertId&&<button onClick={async()=>{
                        await supabase.from('fraud_alerts').update({resolved:true,resolved_by:role,resolved_at:new Date().toISOString()}).eq('id',f.alertId)
                        fetchEntries()
                      }} style={{...smallBtn('#f0fdf4','#16a34a'),fontSize:10,padding:'1px 6px'}}>✓</button>}
                    </span>
                  ))}
                </div></td>
              </tr>))}</tbody>
            </table>
          )}
        </div>
        <div style={{...chartCard,marginBottom:20,borderLeft:'4px solid #7c3aed',overflowX:'auto'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:8}}>
            <h3 style={{...chartTitle,color:'#7c3aed',margin:0}}>👻 Deleted Entries</h3>
            <button onClick={fetchDeletedRows} style={{...smallBtn('#f3e8ff','#7c3aed'),fontSize:12}}>↻ Refresh</button>
          </div>
          {deletedRows.length===0?<p style={{color:'#94a3b8',fontSize:14}}>No deleted entries.</p>:(
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead><tr style={{backgroundColor:'#faf5ff'}}>{['Date','Type','Category','Amount','Deleted by','Deleted at','Restore'].map(h=><th key={h} style={{padding:'10px 12px',textAlign:'left',fontWeight:600,color:'#6d28d9',fontSize:12,borderBottom:'1px solid #e9d5ff'}}>{h}</th>)}</tr></thead>
              <tbody>{deletedRows.map(item=>(<tr key={item.id} style={{borderBottom:'1px solid #faf5ff'}}>
                <td style={tdS}>{item.entry_date}</td>
                <td style={tdS}><span style={{padding:'2px 8px',borderRadius:999,fontSize:11,fontWeight:600,backgroundColor:item.type==='Income'?'#dcfce7':'#fee2e2',color:item.type==='Income'?'#16a34a':'#dc2626'}}>{item.type}</span></td>
                <td style={{...tdS,fontWeight:500}}>{item.category}</td>
                <td style={{...tdS,fontWeight:600,color:item.type==='Income'?'#16a34a':'#dc2626'}}>{fmt(item.amount)}</td>
                <td style={{...tdS,color:'#7c3aed',fontWeight:600}}>{item.deleted_by||'—'}</td>
                <td style={tdS}>{item.deleted_at?new Date(item.deleted_at).toLocaleString('en-IN'):'—'}</td>
                <td style={tdS}><button onClick={()=>handleRestore(item.id)} style={smallBtn('#f0fdf4','#16a34a')}>↩ Restore</button></td>
              </tr>))}</tbody>
            </table>
          )}
        </div>
        <div style={{...chartCard,borderLeft:'4px solid #be185d',overflowX:'auto'}}>
          <h3 style={{...chartTitle,color:'#be185d'}}>📤 CSV Export Activity</h3>
          {exportLog.length===0?<p style={{color:'#94a3b8',fontSize:14}}>No exports recorded.</p>:(
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead><tr style={{backgroundColor:'#fdf2f8'}}>{['Exported by','Date/Time','Filter','Rows'].map(h=><th key={h} style={{padding:'10px 12px',textAlign:'left',fontWeight:600,color:'#9d174d',fontSize:12,borderBottom:'1px solid #fbcfe8'}}>{h}</th>)}</tr></thead>
              <tbody>{exportLog.map((log,i)=>(<tr key={i} style={{borderBottom:'1px solid #fdf2f8'}}>
                <td style={{...tdS,fontWeight:600,color:'#be185d'}}>{log.exported_by}</td>
                <td style={tdS}>{log.created_at?new Date(log.created_at).toLocaleString('en-IN'):'—'}</td>
                <td style={tdS}>{log.filter_type||'All'}</td>
                <td style={{...tdS,fontWeight:600}}>{log.row_count}</td>
              </tr>))}</tbody>
            </table>
          )}
        </div>
      </div>
    )}

    {/* ══ TAB: BALANCE SHEET (PHASE 4) ══ */}
    {activeTab==='balancesheet'&&isAdmin&&(
      <div>
        {loadingFinancials?<div style={{textAlign:'center',padding:48,color:'#64748b'}}>⏳ Loading financials…</div>:(
          <>
            {/* Trial Balance */}
            <div style={{backgroundColor:'white',borderRadius:12,padding: isMobile?14:20,boxShadow:'0 2px 8px rgba(0,0,0,0.06)',marginBottom:20,borderLeft:'4px solid #047857'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:8}}>
                <h3 style={{fontSize:16,fontWeight:700,color:'#047857',margin:0}}>📊 Trial Balance</h3>
                <button onClick={fetchFinancials} style={{...smallBtn('#f0fdf4','#047857'),padding:'6px 14px',fontSize:12}}>↻ Refresh</button>
              </div>
              {trialBalance.length===0
                ?<div style={{backgroundColor:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'14px 18px'}}>
                  <p style={{color:'#047857',fontSize:13,margin:0,fontWeight:500}}>📋 No journal entries yet.</p>
                  <p style={{color:'#64748b',fontSize:12,margin:'6px 0 0'}}>Run the Phase 4 SQL migration in your Supabase SQL editor. New transactions added after migration will auto-generate DR/CR journal lines via the <code>sync_journal_entry</code> trigger.</p>
                </div>
                :<div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                    <thead>
                      <tr style={{backgroundColor:'#f8fafc'}}>
                        {['Account Head','Type','Total Debit','Total Credit','Net Balance'].map(h=>(
                          <th key={h} style={{padding:'10px 14px',textAlign:h.includes('Total')||h.includes('Net')?'right':'left',fontWeight:600,color:'#374151',fontSize:12,borderBottom:'1px solid #e2e8f0'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {trialBalance.map((row,i)=>(
                        <tr key={i} style={{borderBottom:'1px solid #f1f5f9'}}>
                          <td style={{...tdS,fontWeight:500,color:'#1e293b'}}>{row.account_head}</td>
                          <td style={tdS}><span style={{padding:'2px 8px',borderRadius:999,fontSize:11,fontWeight:600,
                            backgroundColor:row.account_type==='Income'?'#dcfce7':row.account_type==='Expense'?'#fee2e2':row.account_type==='Asset'?'#eff6ff':row.account_type==='Liability'?'#fef3c7':'#f3e8ff',
                            color:row.account_type==='Income'?'#16a34a':row.account_type==='Expense'?'#dc2626':row.account_type==='Asset'?'#1e3a5f':row.account_type==='Liability'?'#92400e':'#7c3aed'
                          }}>{row.account_type}</span></td>
                          <td style={{...tdS,textAlign:'right',color:'#16a34a',fontWeight:600}}>{fmt(row.total_debit)}</td>
                          <td style={{...tdS,textAlign:'right',color:'#dc2626',fontWeight:600}}>{fmt(row.total_credit)}</td>
                          <td style={{...tdS,textAlign:'right',fontWeight:700,color:Number(row.net_balance)>=0?'#1e3a5f':'#dc2626'}}>{fmt(Math.abs(row.net_balance))}<span style={{fontSize:10,marginLeft:4,opacity:0.7}}>{Number(row.net_balance)<0?'Cr':'Dr'}</span></td>
                        </tr>
                      ))}
                      <tr style={{backgroundColor:'#f8fafc',fontWeight:700,borderTop:'2px solid #e2e8f0'}}>
                        <td style={{...tdS,fontWeight:700,color:'#1e293b'}} colSpan={2}>Totals</td>
                        <td style={{...tdS,textAlign:'right',fontWeight:700,color:'#16a34a'}}>{fmt(trialBalance.reduce((s,r)=>s+Number(r.total_debit),0))}</td>
                        <td style={{...tdS,textAlign:'right',fontWeight:700,color:'#dc2626'}}>{fmt(trialBalance.reduce((s,r)=>s+Number(r.total_credit),0))}</td>
                        <td/>
                      </tr>
                    </tbody>
                  </table>
                </div>
              }
            </div>

            {/* Balance check banner */}
            {trialBalance.length>0&&(()=>{
              const totalDr=trialBalance.reduce((s,r)=>s+Number(r.total_debit),0)
              const totalCr=trialBalance.reduce((s,r)=>s+Number(r.total_credit),0)
              const balanced=Math.abs(totalDr-totalCr)<0.01
              return(
                <div style={{marginBottom:20,backgroundColor:balanced?'#dcfce7':'#fee2e2',borderRadius:10,padding:'12px 18px',display:'flex',alignItems:'center',gap:10,border:`1px solid ${balanced?'#bbf7d0':'#fecaca'}`}}>
                  <span style={{fontSize:20}}>{balanced?'✅':'⚠️'}</span>
                  <div>
                    <p style={{fontWeight:700,color:balanced?'#166534':'#dc2626',margin:0,fontSize:14}}>{balanced?'Books are balanced':'Books are OUT OF BALANCE'}</p>
                    <p style={{fontSize:12,color:balanced?'#166534':'#dc2626',margin:'2px 0 0'}}>
                      Total Debits: {fmt(totalDr)} &nbsp;|&nbsp; Total Credits: {fmt(totalCr)} &nbsp;|&nbsp; Difference: {fmt(Math.abs(totalDr-totalCr))}
                    </p>
                  </div>
                </div>
              )
            })()}

            {/* Balance Sheet — Assets vs Liabilities & Equity */}
            <div style={{display:'grid',gridTemplateColumns: isMobile?'1fr':'1fr 1fr',gap:16,marginBottom:20}}>
              {[
                {title:'Assets',filterFn:(r)=>r.account_type==='Asset',color:'#1e3a5f',bg:'#eff6ff',border:'#bfdbfe'},
                {title:'Liabilities & Equity',filterFn:(r)=>r.account_type==='Liability'||r.account_type==='Equity',color:'#7c3aed',bg:'#f3e8ff',border:'#e9d5ff'},
              ].map(sec=>{
                const rows=balanceSheet.filter(sec.filterFn)
                const total=rows.reduce((s,r)=>s+Number(r.balance),0)
                return(
                  <div key={sec.title} style={{backgroundColor:'white',borderRadius:12,padding:18,boxShadow:'0 2px 8px rgba(0,0,0,0.06)',borderLeft:`4px solid ${sec.color}`}}>
                    <h3 style={{fontSize:14,fontWeight:700,color:sec.color,marginBottom:14,borderBottom:`2px solid ${sec.bg}`,paddingBottom:8}}>{sec.title}</h3>
                    {rows.length===0
                      ?<p style={{color:'#94a3b8',fontSize:13,fontStyle:'italic'}}>No entries yet</p>
                      :<table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                        <tbody>
                          {rows.map((r,i)=>(
                            <tr key={i} style={{borderBottom:'1px solid #f1f5f9'}}>
                              <td style={{padding:'7px 0',color:'#374151'}}>{r.account_head}</td>
                              <td style={{padding:'7px 0',textAlign:'right',fontWeight:600,color:sec.color}}>{fmt(Math.abs(Number(r.balance)))}</td>
                            </tr>
                          ))}
                          <tr style={{borderTop:`2px solid ${sec.color}`}}>
                            <td style={{padding:'8px 0',fontWeight:700,color:'#1e293b'}}>Total {sec.title}</td>
                            <td style={{padding:'8px 0',textAlign:'right',fontWeight:700,color:sec.color}}>{fmt(Math.abs(total))}</td>
                          </tr>
                        </tbody>
                      </table>
                    }
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    )}

    {/* ══ TAB: INCOME ANALYSIS ══ */}
    {activeTab==='income'&&(
      <IncomeAnalysis entries={entries} today={today} isMobile={isMobile}/>
    )}
    {/* ══ TAB: TIMELINE ══ */}
    {activeTab==='timeline'&&(
      <div style={{backgroundColor:'white',borderRadius:12,padding: isMobile ? 14 : 20,boxShadow:'0 2px 8px rgba(0,0,0,0.06)'}}>
        <h3 style={{fontSize:16,fontWeight:700,color:'#1e3a5f',marginBottom:16}}>🕐 Activity Timeline</h3>
        {auditLog.length===0
          ? <p style={{color:'#94a3b8',textAlign:'center',padding:32}}>No activity recorded yet.</p>
          : auditLog.map((log,i)=>{
              const actionColor={insert:'#16a34a',update:'#f59e0b',delete:'#dc2626',restore:'#7c3aed',bulk_delete:'#dc2626',budget_edit:'#0891b2'}[log.action]||'#64748b'
              const actionIcon={insert:'➕',update:'✏️',delete:'🗑',restore:'↩️',bulk_delete:'🗑',budget_edit:'💰'}[log.action]||'•'
              return(
                <div key={i} style={{display:'flex',gap:14,paddingBottom:16,borderBottom:'1px solid #f1f5f9',marginBottom:16}}>
                  <div style={{width:36,height:36,borderRadius:'50%',backgroundColor:actionColor+'20',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>{actionIcon}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:4}}>
                      <span style={{fontWeight:700,fontSize:13,color:'#1e293b',textTransform:'capitalize'}}>{log.action.replace('_',' ')}</span>
                      <span style={{fontSize:11,color:'#94a3b8'}}>{log.created_at?new Date(log.created_at).toLocaleString('en-IN'):''}</span>
                    </div>
                    <div style={{fontSize:12,color:'#64748b',marginTop:2}}>By <strong style={{color:actionColor}}>{log.changed_by||'system'}</strong>{log.target_id?` · ID: ${log.target_id}`:''}</div>
                    {log.new_values&&<div style={{fontSize:11,color:'#94a3b8',marginTop:4,fontFamily:'monospace',background:'#f8fafc',padding:'4px 8px',borderRadius:4,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{log.new_values}</div>}
                  </div>
                </div>
              )
            })
        }
      </div>
    )}

    {/* ══ P&L MODAL ══ */}
    {showPL&&(
      <div onClick={()=>setShowPL(false)} style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding: isMobile ? 12 : 0}}>
        <div onClick={e=>e.stopPropagation()} style={{backgroundColor:'white',borderRadius:14,padding: isMobile ? 16 : 28,width: isMobile ? '100%' : 680,maxWidth:'95vw',maxHeight:'90vh',overflow:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,flexWrap:'wrap',gap:10}}>
            <div><h2 style={{fontSize: isMobile ? 16 : 20,fontWeight:700,color:'#1e3a5f',margin:0}}>📋 P&L Statement</h2><p style={{fontSize:13,color:'#64748b',margin:'4px 0 0'}}>Income &amp; Expenditure Report</p></div>
            <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
              <input type="month" value={plMonth} onChange={e=>setPlMonth(e.target.value)} style={{...iStyle,width: isMobile ? '100%' : 160}}/>
              <button onClick={printPL} style={{backgroundColor:'#1e3a5f',color:'white',border:'none',borderRadius:8,padding:'8px 16px',fontWeight:600,cursor:'pointer',fontSize:13}}>🖨 Print</button>
              <button onClick={()=>setShowPL(false)} style={{backgroundColor:'#fee2e2',color:'#dc2626',border:'none',borderRadius:8,padding:'8px 12px',fontWeight:600,cursor:'pointer',fontSize:13}}>✖</button>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:plModalCols,gap:12,marginBottom:20}}>
            {[{label:'Total Income',value:plData.totalThisInc,color:'#16a34a',bg:'#dcfce7'},{label:'Total Expense',value:plData.totalThisExp,color:'#dc2626',bg:'#fee2e2'},{label:'Net Surplus/Deficit',value:plData.totalThisInc-plData.totalThisExp,color:'#1e3a5f',bg:'#eff6ff'}].map(c=>(
              <div key={c.label} style={{backgroundColor:c.bg,borderRadius:10,padding:'14px 16px',borderLeft:`3px solid ${c.color}`}}>
                <p style={{fontSize:12,color:c.color,fontWeight:600,margin:'0 0 4px'}}>{c.label}</p>
                <p style={{fontSize: isMobile ? 18 : 22,fontWeight:800,color:c.color,margin:0}}>{fmt(c.value)}</p>
              </div>
            ))}
          </div>
          <div style={{display:'grid',gridTemplateColumns:plContentCols,gap:20}}>
            {[{title:'Income',color:'#16a34a',bg:'#dcfce7',data:plData.thisInc,total:plData.totalThisInc},{title:'Expenditure',color:'#dc2626',bg:'#fee2e2',data:plData.thisExp,total:plData.totalThisExp}].map(sec=>(
              <div key={sec.title}>
                <h3 style={{fontSize:14,fontWeight:700,color:sec.color,marginBottom:10,borderBottom:`2px solid ${sec.bg}`,paddingBottom:6}}>{sec.title}</h3>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                  <tbody>
                    {Object.entries(sec.data).map(([k,v])=><tr key={k} style={{borderBottom:'1px solid #f1f5f9'}}><td style={{padding:'7px 0',color:'#374151'}}>{k}</td><td style={{padding:'7px 0',textAlign:'right',fontWeight:600,color:sec.color}}>{fmt(v)}</td></tr>)}
                    {Object.keys(sec.data).length===0&&<tr><td colSpan={2} style={{padding:'12px 0',color:'#94a3b8',textAlign:'center'}}>No {sec.title.toLowerCase()} this month</td></tr>}
                    <tr style={{borderTop:`2px solid ${sec.color}`}}><td style={{padding:'8px 0',fontWeight:700,color:'#1e293b'}}>Total</td><td style={{padding:'8px 0',textAlign:'right',fontWeight:700,color:sec.color}}>{fmt(sec.total)}</td></tr>
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      </div>
    )}

    {/* ══ RECEIPT MODAL ══ */}
    {viewReceipt&&(
      <div onClick={()=>setViewReceipt(null)} style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.65)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding: isMobile ? 8 : 0}}>
        <div onClick={e=>e.stopPropagation()} style={{backgroundColor:'white',borderRadius:12,padding: isMobile ? 14 : 20,maxWidth:720,width:'100%',maxHeight:'90vh',overflow:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:8}}>
            <h3 style={{fontSize:16,fontWeight:600,color:'#1e3a5f',margin:0}}>🧾 Receipt Preview</h3>
            <div style={{display:'flex',gap:10}}>
              <a href={viewReceipt} target="_blank" rel="noopener noreferrer" style={{backgroundColor:'#eff6ff',color:'#1e3a5f',borderRadius:6,padding:'6px 14px',fontSize:13,fontWeight:600,textDecoration:'none'}}>↗ Open</a>
              <button onClick={()=>setViewReceipt(null)} style={{backgroundColor:'#fee2e2',color:'#dc2626',border:'none',borderRadius:6,padding:'6px 12px',fontSize:13,fontWeight:600,cursor:'pointer'}}>✖</button>
            </div>
          </div>
          {(viewReceipt.toLowerCase().endsWith('.pdf')||viewReceipt.includes('application/pdf'))?<iframe src={viewReceipt} title="Receipt PDF" style={{width:'100%',height: isMobile ? 320 : 520,border:'none',borderRadius:8}}/>:<img src={viewReceipt} alt="Receipt" style={{width:'100%',borderRadius:8,objectFit:'contain',maxHeight: isMobile ? 400 : 600}}/>}
        </div>
      </div>
    )}

  </div>
  )
}

const iStyle    = {width:'100%',padding:'9px 12px',borderRadius:8,border:'1px solid #d1d5db',fontSize:13,backgroundColor:'white',boxSizing:'border-box'}
const lStyle    = {display:'block',fontSize:12,fontWeight:600,color:'#374151',marginBottom:5}
const tdS       = {padding:'10px 12px',color:'#64748b'}
const chartCard  = {backgroundColor:'white',borderRadius:12,padding:20,boxShadow:'0 2px 8px rgba(0,0,0,0.06)'}
const chartTitle = {fontSize:15,fontWeight:600,color:'#1e3a5f',marginBottom:16,marginTop:0}
const smallBtn   = (bg,color)=>({backgroundColor:bg,color,border:'none',borderRadius:6,padding:'4px 8px',fontSize:12,cursor:'pointer',fontWeight:500})
const pgBtn      = (disabled)=>({padding:'4px 10px',borderRadius:6,border:'none',cursor:disabled?'not-allowed':'pointer',fontSize:12,fontWeight:600,backgroundColor:'#f1f5f9',color:disabled?'#cbd5e1':'#64748b'})

export default Accounts