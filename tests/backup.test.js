// Run with: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { gunzipSync } from 'node:zlib'
import { runBackup } from '../server/backup.js'

// A stand-in for the service-role client: tables with rows, plus a fake bucket.
function fakeClient({ data = {}, failTables = [], existing = [], bucketExists = true, uploadError = null } = {}) {
  const files = new Map(existing.map(p => [p, Buffer.from('old')]))
  const removed = []
  const settings = {}
  let bucketMade = false
  const client = {
    from(name) {
      let range = [0, 999]
      const q = {
        select() { return q },
        order() { return q },
        range(a, b) { range = [a, b]; return q },
        upsert(row) { settings[row.key] = row.value; return Promise.resolve({ error: null }) },
        then(ok, err) {
          const res = failTables.includes(name) ? { data: null, error: { message: 'no such table' } } : { data: (data[name] || []).slice(range[0], range[1] + 1), error: null }
          return Promise.resolve(res).then(ok, err)
        },
      }
      return q
    },
    storage: {
      getBucket: async () => ({ data: bucketExists || bucketMade ? { id: 'backups' } : null }),
      createBucket: async () => { bucketMade = true; return { error: null } },
      from: () => ({
        upload: async (path, body) => { if (uploadError) return { error: { message: uploadError } }; files.set(path, body); return { error: null } },
        list: async folder => ({ data: [...files.keys()].filter(p => p.startsWith(folder + '/')).map(p => ({ name: p.split('/')[1] })) }),
        remove: async paths => { paths.forEach(p => { files.delete(p); removed.push(p) }); return { error: null } },
      }),
    },
  }
  return { client, files, removed, settings, made: () => bucketMade }
}

const monday = new Date('2026-10-12T00:00:00Z') // Monday in India
const sunday = new Date('2026-10-11T00:00:00Z') // Sunday in India

test('a weekday backup saves the core tables as a gzip JSON file', async () => {
  const f = fakeClient({ data: { students: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }], attendance_records: [{ id: 9 }] } })
  const s = await runBackup({ client: f.client, now: monday })
  assert.equal(s.kind, 'daily')
  assert.equal(s.path, 'daily/2026-10-12.json.gz')
  assert.equal(s.rows.students, 2)
  assert.ok(!('attendance_records' in s.rows), 'large tables wait for the weekly backup')
  const saved = JSON.parse(gunzipSync(f.files.get(s.path)).toString())
  assert.deepEqual(saved.tables.students, [{ id: 1, name: 'A' }, { id: 2, name: 'B' }])
  assert.equal(JSON.parse(f.settings.last_backup).path, s.path)
  assert.equal(s.ok, true)
})

test('the Sunday backup also includes the large tables', async () => {
  const f = fakeClient({ data: { attendance_records: [{ id: 9 }] } })
  const s = await runBackup({ client: f.client, now: sunday })
  assert.equal(s.kind, 'weekly')
  assert.equal(s.rows.attendance_records, 1)
})

test('more than 1000 rows are paged', async () => {
  const students = Array.from({ length: 2500 }, (_, i) => ({ id: i }))
  const f = fakeClient({ data: { students } })
  const s = await runBackup({ client: f.client, now: monday })
  assert.equal(s.rows.students, 2500)
})

test('a missing table is reported but does not stop the backup', async () => {
  const f = fakeClient({ data: { students: [{ id: 1 }] }, failTables: ['sickbay_records'] })
  const s = await runBackup({ client: f.client, now: monday })
  assert.equal(s.ok, false)
  assert.match(s.errors.sickbay_records, /no such table/)
  assert.equal(s.rows.students, 1)
  assert.ok(f.files.has(s.path))
})

test('the bucket is created when missing, and old files are removed', async () => {
  const f = fakeClient({ bucketExists: false, existing: ['daily/2026-09-01.json.gz', 'daily/2026-10-10.json.gz', 'weekly/2026-07-01.json.gz', 'weekly/2026-09-27.json.gz'] })
  const s = await runBackup({ client: f.client, now: monday })
  assert.equal(f.made(), true)
  assert.deepEqual(f.removed.sort(), ['daily/2026-09-01.json.gz', 'weekly/2026-07-01.json.gz'])
  assert.equal(s.pruned, 2)
  assert.ok(f.files.has('daily/2026-10-10.json.gz') && f.files.has('weekly/2026-09-27.json.gz'))
})

test('an upload failure is reported, not thrown', async () => {
  const f = fakeClient({ uploadError: 'quota' })
  const s = await runBackup({ client: f.client, now: monday })
  assert.equal(s.ok, false)
  assert.match(s.fatal, /upload failed: quota/)
  assert.ok(JSON.parse(f.settings.last_backup).fatal)
})
