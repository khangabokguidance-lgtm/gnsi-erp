import webpush from "web-push"

webpush.setVapidDetails(
  "mailto:admin@guidancekhangabok.in",
  process.env.VITE_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

export default async function handler(req, res) {
  if(req.method!=="POST") return res.status(405).end()

  const { createClient } = await import("@supabase/supabase-js")
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

  // Supabase webhook sends: { type, table, record, old_record, schema }
  const { type, table, record } = req.body

  let title = "GNSI Portal"
  let body = "New activity"
  let url = "/"

  if(table==="accounts" && type==="INSERT"){
    if(record.type==="Income"){
      title = "💰 New Payment Received"
      body = `₹${Number(record.amount).toLocaleString("en-IN")} — ${record.note||record.category||"Fee collected"}`
      url = "/accounts"
    } else {
      title = "📉 New Expense Recorded"
      body = `₹${Number(record.amount).toLocaleString("en-IN")} — ${record.note||record.category||""}`
      url = "/accounts"
    }
  }
  else if(table==="students" && type==="INSERT"){
    title = "🎓 New Student Added"
    body = `${record.name||record.gcc_no||"Unknown"} enrolled`
    url = "/students"
  }
  else if(table==="adm_applications" && type==="INSERT"){
    title = "📋 New Application"
    body = `${record.applicant_name||"Unknown"} applied for ${record.course||"—"}`
    url = "/admissions"
  }
  else if(table==="adm_fee_collections" && type==="INSERT"){
    title = "💵 Fee Collection"
    body = `₹${Number(record.amount_paid).toLocaleString("en-IN")} — ${record.student_name||""} (${record.fee_type||""})`
    url = "/accounts"
  }
  else if(table==="management_checklist"){
    if(type==="INSERT"){
      title = "📋 New Task Added"
      body = record.task||"New checklist item"
      url = "/checklist"
    } else if(type==="UPDATE" && record.status==="Done"){
      title = "✅ Task Completed"
      body = record.task||"Checklist item marked done"
      url = "/checklist"
    }
  }

  // Fetch all subscriptions
  const { data: subs } = await supabase.from("push_subscriptions").select("subscription")
  if(!subs?.length) return res.json({ sent:0 })

  const payload = JSON.stringify({ title, body, url })
  let sent=0, failed=0

  await Promise.all(subs.map(async row=>{
    try {
      await webpush.sendNotification(JSON.parse(row.subscription), payload)
      sent++
    } catch(e) {
      failed++
      if(e.statusCode===410){
        await supabase.from("push_subscriptions").delete().eq("subscription", row.subscription)
      }
    }
  }))

  res.json({ sent, failed })
}