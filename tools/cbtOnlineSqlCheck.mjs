// cbtOnlineSqlCheck.mjs — runs supabase/migrations/20261034_cbt_online_exam.sql on a real (in-memory) Postgres and
// checks the candidate functions: access code, one attempt per roll, no answers in the paper, server-side clock and
// marking, results hidden when the exam says so. Needs:   npm i --no-save @electric-sql/pglite
// Run:   node tools/cbtOnlineSqlCheck.mjs
let PGlite
try { ({ PGlite } = await import('@electric-sql/pglite')) } catch { console.error('Install the checker first:  npm i --no-save @electric-sql/pglite'); process.exit(1) }
import fs from 'node:fs'
const db = new PGlite()
await db.exec(`create role anon; create role authenticated; create function public.qbank_is_staff() returns boolean language sql as $$ select true $$;`)
await db.exec(`create table public.students (id serial primary key, name text, gcc_no text, status text, batch text, parent_phone text, father_phone text);
  insert into public.students (name, gcc_no, status, batch, father_phone) values ('Asha Devi','0042','Active','VI A','9876543210'),('Ashok Singh','43','Active','VI B',null),('Old Ashir','44','Left','VI A','9000000000')`)
await db.exec(fs.readFileSync('supabase/migrations/20261034_cbt_online_exam.sql', 'utf8'))
await db.exec(fs.readFileSync('supabase/migrations/20261034_cbt_online_exam.sql', 'utf8'))   // twice: safe to re-run
await db.exec(fs.readFileSync('supabase/migrations/20261035_cbt_erp_lookup.sql', 'utf8'))
await db.exec(fs.readFileSync('supabase/migrations/20261035_cbt_erp_lookup.sql', 'utf8'))
console.log('migrations ran twice OK')
const sections = [{ id: 's1', label: 'A', title: 'MA', questions: [{ no: 1 }, { no: 2 }, { no: 3 }] }, { id: 's2', label: 'B', title: 'AR', questions: [{ no: 4 }, { no: 5 }] }]
await db.query(`insert into cbt_tests (id,name,duration_min,marking,instructions,sections,status,access_code,grace_seconds) values ('t1','Mock',60,'{"correct":1.25,"wrong":0.25}','read',$1,'live','abc',0)`, [JSON.stringify(sections)])
await db.query(`insert into cbt_keys values ('t1', '{"1":"A","2":"B","3":"C","4":"D"}')`)
const call = async (sql, params = []) => { try { return (await db.query(sql, params)).rows[0]?.r ?? (await db.query(sql, params)).rows[0] } catch (e) { return 'ERR ' + e.message } }
const one = async (sql, params = []) => { try { const r = await db.query(sql, params); return Object.values(r.rows[0])[0] } catch (e) { return 'ERR ' + e.message } }
const info = await one(`select cbt_exam_info('t1')`); console.log('info', JSON.stringify(info).slice(0, 220))
console.log('wrong code ->', await one(`select cbt_start('t1','nope','Asha Devi','R1')`))
console.log('short name ->', await one(`select cbt_start('t1','ABC','A','R1')`))
const st = await one(`select cbt_start('t1',' ABC ','Asha Devi','R1','999')`)
console.log('start ok: token len', st.token.length, 'paper has key?', JSON.stringify(st.test).includes('"answer"'), 'serverNow', !!st.attempt.serverNow)
console.log('duplicate roll ->', await one(`select cbt_start('t1','abc','Other','r1 ')`))
const id = st.attempt.id, tok = st.token
console.log('bad token ->', await one(`select cbt_save($1,'x','{}'::jsonb,'{}'::jsonb,1,'en',0)`, [id]))
console.log('save ->', JSON.stringify(await one(`select cbt_save($1,$2,'{"1":"A","2":"C"}'::jsonb,'{"2":true}'::jsonb,2,'mm',1)`, [id, tok])))
const res = await one(`select cbt_resume($1,$2)`, [id, tok]); console.log('resume answers', JSON.stringify(res.attempt.answers), 'current', res.attempt.current, 'lang', res.attempt.lang)
const done = await one(`select cbt_submit($1,$2,'{"1":"A","2":"C","3":"C","5":"A"}'::jsonb,'{}'::jsonb,2)`, [id, tok])
console.log('submit score', done.score.marks, '/', done.score.max, 'correct', done.score.correct, 'wrong', done.score.wrong, 'skipped', done.score.skipped, 'key shown', !!done.key)
console.log('expected 1.25*2 - 0.25*2 = 2 of 5 scored questions max', 4 * 1.25)
console.log('resubmit idempotent ->', (await one(`select cbt_submit($1,$2,'{"1":"B"}'::jsonb,'{}'::jsonb,2)`, [id, tok])).score.marks)
console.log('resume after submit has result ->', !!(await one(`select cbt_resume($1,$2)`, [id, tok])).result)
console.log('save after submit ->', JSON.stringify(await one(`select cbt_save($1,$2,'{"1":"B"}'::jsonb,null,1,'en',0)`, [id, tok])))
// hidden result
await db.query(`update cbt_tests set show_answers=false where id='t1'`)
const r2 = await one(`select cbt_resume($1,$2)`, [id, tok]); console.log('show_answers off -> key', r2.result.key, 'score present', !!r2.result.score)
await db.query(`update cbt_tests set show_result=false where id='t1'`)
const r3 = await one(`select cbt_resume($1,$2)`, [id, tok]); console.log('show_result off -> score', r3.result.score, 'answers', r3.result.answers, 'key', r3.result.key)
// deadline: 0.01 min = 0.6s, grace 0
await db.query(`insert into cbt_tests (id,name,duration_min,sections,status,grace_seconds) values ('t2','Short',0.01,$1,'live',0)`, [JSON.stringify(sections)])
await db.query(`insert into cbt_keys values ('t2', '{"1":"A","2":"B"}')`)
const s2 = await one(`select cbt_start('t2',null,'Late One','L1')`)
await one(`select cbt_save($1,$2,'{"1":"A"}'::jsonb,null,1,'en',0)`, [s2.attempt.id, s2.token])
await new Promise(r => setTimeout(r, 1200))
console.log('late save ->', JSON.stringify(await one(`select cbt_save($1,$2,'{"1":"A","2":"B"}'::jsonb,null,2,'en',0)`, [s2.attempt.id, s2.token])))
const late = await one(`select cbt_resume($1,$2)`, [s2.attempt.id, s2.token])
console.log('late attempt: auto', late.result.attempt.autoSubmitted, 'answers kept', JSON.stringify(late.result.answers), 'marks', late.result.score.marks)
// closed / not open / draft
await db.query(`update cbt_tests set status='closed' where id='t2'`); console.log('closed ->', await one(`select cbt_start('t2',null,'Newbie','N1')`))
await db.query(`update cbt_tests set status='live', opens_at=now()+interval '1 day' where id='t2'`); console.log('not open ->', await one(`select cbt_start('t2',null,'Newbie','N1')`))
await db.query(`update cbt_tests set status='draft' where id='t2'`); console.log('draft ->', await one(`select cbt_exam_info('t2')`))
console.log('no code needed test info needsCode:', (await one(`select cbt_exam_info('t1')`)).needsCode)

// ── ERP lookup ──
await db.query(`insert into cbt_tests (id,name,duration_min,marking,instructions,sections,status,access_code,grace_seconds) values ('t3','Mock3',60,'{"correct":1,"wrong":0}','read',$1,'live','abc',0)`, [JSON.stringify(sections)])
console.log('lookup wrong code ->', await one(`select cbt_lookup('t3','nope','ash')`))
console.log('lookup short ->', JSON.stringify(await one(`select cbt_lookup('t3','abc','as')`)))
console.log('lookup name ->', JSON.stringify(await one(`select cbt_lookup('t3','abc','ash')`)))
console.log('lookup gcc (leading zeros) ->', JSON.stringify(await one(`select cbt_lookup('t3','abc','42')`)))
const erpA = await one(`select cbt_start('t3','abc','Asha Devi','42','','42','')`)
console.log('start with GCC:', JSON.stringify((await db.query(`select gcc_no, parent_phone, erp_match from cbt_attempts where id=$1`, [erpA.attempt.id])).rows[0]))
await one(`select cbt_start('t3','abc','Walk In','W1','','999','98 76-5')`)
console.log('unknown GCC:', JSON.stringify((await db.query(`select gcc_no, parent_phone, erp_match from cbt_attempts where roll='W1'`)).rows[0]))
await db.close()
