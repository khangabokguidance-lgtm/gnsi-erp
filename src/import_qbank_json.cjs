// Generic importer: node src/import_qbank_json.cjs supabase/qbank-imports/<file>.json
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Skips rows already in the bank.
const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }
const file = process.argv[2]
if (!file) { console.error('Usage: node src/import_qbank_json.cjs <file.json>'); process.exit(1) }
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
;(async () => {
  const rows = JSON.parse(fs.readFileSync(file, 'utf-8'))
  const chapters = [...new Set(rows.map(r => r.chapter))]
  const { data: ex, error: e1 } = await sb.from('qbank_questions').select('question,chapter').eq('course', rows[0].course).eq('subject', rows[0].subject).in('chapter', chapters)
  if (e1) { console.error(e1.message); process.exit(1) }
  const have = new Set((ex || []).map(r => r.chapter + '␟' + r.question))
  const fresh = rows.filter(r => !have.has(r.chapter + '␟' + r.question))
  for (let i = 0; i < fresh.length; i += 200) {
    const { error } = await sb.from('qbank_questions').insert(fresh.slice(i, i + 200))
    if (error) { console.error(error.message); process.exit(1) }
  }
  console.log(`Inserted ${fresh.length}, skipped ${rows.length - fresh.length} existing.`)
})()
