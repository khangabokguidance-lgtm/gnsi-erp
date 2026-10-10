// server/backup.js — the nightly database backup.
// ─────────────────────────────────────────────────────────────────────────────
// Runs from the existing daily job (api/window-notifier?job=daily), so it adds
// no new function or cron. Each night it saves the core tables as one gzip-
// compressed JSON file in the private Supabase Storage bucket "backups":
//     daily/YYYY-MM-DD.json.gz     core tables (kept 14 days)
//     weekly/YYYY-MM-DD.json.gz    everything incl. the large tables (Sundays,
//                                  kept 8 weeks)
// The result is written to system_settings (key "last_backup") for the
// System Settings screen. Download files from Supabase → Storage → backups.
// To restore, use System Settings → Data Mgmt → Import (it reads .json.gz).
// ─────────────────────────────────────────────────────────────────────────────

import { gzipSync } from 'node:zlib'
import { createClient } from '@supabase/supabase-js'
import { tablesForTier, pkOf } from '../src/backupTables.js'

const BUCKET = 'backups'
const PAGE = 1000
const KEEP_DAILY_DAYS = 14
const KEEP_WEEKLY_DAYS = 56
const TIME_BUDGET_MS = 40_000

const istDate = now => now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
const istWeekday = now => new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).getDay()

async function fetchTable(client, name) {
  const pk = pkOf(name)
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client.from(name).select('*').order(pk, { ascending: true }).range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    rows.push(...(data || []))
    if (!data || data.length < PAGE) break
  }
  return rows
}

async function ensureBucket(client) {
  const { data } = await client.storage.getBucket(BUCKET)
  if (data) return
  const { error } = await client.storage.createBucket(BUCKET, { public: false })
  if (error && !/already exists/i.test(error.message)) throw new Error(`could not create the "${BUCKET}" bucket: ${error.message}`)
}

async function pruneOld(client, folder, keepDays, now) {
  const { data } = await client.storage.from(BUCKET).list(folder, { limit: 200 })
  const cutoff = istDate(new Date(now.getTime() - keepDays * 86400000))
  const old = (data || []).map(f => f.name).filter(n => /^\d{4}-\d{2}-\d{2}\.json\.gz$/.test(n) && n.slice(0, 10) < cutoff)
  if (old.length) await client.storage.from(BUCKET).remove(old.map(n => `${folder}/${n}`))
  return old.length
}

// `client` is injectable for tests; production uses the service-role client.
export async function runBackup({ client, now = new Date(), force } = {}) {
  const db = client || createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const started = Date.now()
  const weekly = force ? force === 'weekly' : istWeekday(now) === 0
  const folder = weekly ? 'weekly' : 'daily'
  const path = `${folder}/${istDate(now)}.json.gz`
  const summary = { at: now.toISOString(), kind: folder, path, rows: {}, errors: {}, skipped: [], bytes: 0 }

  try {
    await ensureBucket(db)
    const tables = {}
    for (const t of tablesForTier(weekly)) {
      if (Date.now() - started > TIME_BUDGET_MS) { summary.skipped.push(t.name); continue }
      try {
        tables[t.name] = await fetchTable(db, t.name)
        summary.rows[t.name] = tables[t.name].length
      } catch (e) { summary.errors[t.name] = e.message }
    }
    const body = gzipSync(Buffer.from(JSON.stringify({ app: 'gnsi-erp', kind: folder, taken_at: summary.at, tables })))
    summary.bytes = body.length
    const { error } = await db.storage.from(BUCKET).upload(path, body, { contentType: 'application/gzip', upsert: true })
    if (error) throw new Error(`upload failed: ${error.message}`)
    summary.pruned = (await pruneOld(db, 'daily', KEEP_DAILY_DAYS, now)) + (await pruneOld(db, 'weekly', KEEP_WEEKLY_DAYS, now))
    summary.ok = Object.keys(summary.errors).length === 0 && summary.skipped.length === 0
  } catch (e) {
    summary.ok = false
    summary.fatal = e.message
  }

  try {
    await db.from('system_settings').upsert(
      { key: 'last_backup', value: JSON.stringify(summary), updated_at: new Date().toISOString() },
      { onConflict: 'key' })
  } catch { /* the backup file is what matters */ }
  return summary
}
