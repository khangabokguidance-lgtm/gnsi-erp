// cbtSetupCheck.mjs — the one-paste setup script must work on an empty database, on top of itself, and on top of an
// older partial state, and leave exactly one version of every public function. Needs: npm i --no-save @electric-sql/pglite
// Run:   node tools/cbtSetupCheck.mjs
let PGlite
try { ({ PGlite } = await import('@electric-sql/pglite')) } catch { console.error('Install the checker first:  npm i --no-save @electric-sql/pglite'); process.exit(1) }
import fs from 'node:fs'
const setup = fs.readFileSync('supabase/cbt_online_setup.sql', 'utf8')
const base = `create role anon; create role authenticated; create function public.qbank_is_staff() returns boolean language sql as $$ select true $$;
  create table public.students (id serial primary key, name text, gcc_no text, status text, batch text, parent_phone text, father_phone text, mother_phone text, father_name text);
  insert into public.students (name, gcc_no, status, batch, father_phone, father_name) values ('Asha Devi','0042','Active','VI A','9876543210','L. Tomba');`
let bad = 0
const check = async (label, db) => {
  const dup = (await db.query(`select proname, count(*)::int n from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and proname like 'cbt\\_%' group by 1 having count(*) > 1`)).rows
  await db.query(`insert into cbt_tests (id,name,duration_min,marking,instructions,sections,status,access_code) values ('t','T',60,'{"correct":1,"wrong":0}','x','[{"id":"s","label":"A","title":"A","questions":[{"no":1,"text":"q","options":[]}]}]','live','abc') on conflict do nothing`)
  await db.query(`insert into cbt_keys values ('t','{"1":"A"}') on conflict do nothing`)
  const look = (await db.query(`select cbt_lookup('t','abc','42') as r`)).rows[0].r[0]
  const start = (await db.query(`select cbt_start('t','abc','0042','9876543210') as r`)).rows[0].r
  const ok = !dup.length && look.fatherName === 'L. Tomba' && !!start.token && !!start.session
  if (!ok) bad++
  console.log(ok ? 'OK  ' : 'FAIL', label, dup.length ? `duplicate functions: ${JSON.stringify(dup)}` : '')
  await db.query(`delete from cbt_attempts`)
}
{ const db = new PGlite(); await db.exec(base); await db.exec(setup); await check('empty database', db); await db.exec(setup); await check('run again on top', db); await db.close() }
{ // an older partial state: only the first three migrations were ever run
  const db = new PGlite(); await db.exec(base)
  for (const f of fs.readdirSync('supabase/migrations').filter(f => /^2026103[4-6]_cbt_/.test(f)).sort()) await db.exec(fs.readFileSync(`supabase/migrations/${f}`, 'utf8'))
  await db.exec(setup); await check('on top of 34-36 only', db); await db.close() }
{ // the broken state from a real report: 34-38 plus only the old 40 (second cbt_lookup)
  const db = new PGlite(); await db.exec(base)
  for (const f of fs.readdirSync('supabase/migrations').filter(f => /^2026103[4-8]_cbt_/.test(f)).sort()) await db.exec(fs.readFileSync(`supabase/migrations/${f}`, 'utf8'))
  await db.exec(`create or replace function public.cbt_lookup(p_test text, p_code text, p_q text, p_parent text default null) returns jsonb language sql as $$ select '[]'::jsonb $$;`)
  await db.exec(setup); await check('repairs the two-cbt_lookup state', db); await db.close() }
process.exit(bad ? 1 : 0)
