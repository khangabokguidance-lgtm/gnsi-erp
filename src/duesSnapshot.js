// duesSnapshot.js — the school-wide fee dues, worked out from the same fee engine the Fees module uses
// (rates × months owed − payments), so the dashboard shows what Fees shows. Read-only.
import { supabase } from './supabase'
import { getSessionYear, gccStr } from './feeEngine'
import { getDuesForStudents } from './feeDues'
import { loadHostelHistory } from './hostelHistory'

// Every row of a table (a plain select stops at 1000 rows).
export async function fetchAll(table, select = '*', filters = []) {
  let all = []
  for (let from = 0; ; from += 1000) {
    let q = supabase.from(table).select(select)
    for (const [c, op, v] of filters) q = q[op](c, v)
    const { data, error } = await q.range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    all = all.concat(data || [])
    if (!data || data.length < 1000) return all
  }
}

const group = (rows, col) => {
  const m = new Map()
  for (const r of rows) { const g = gccStr(r[col]); if (!m.has(g)) m.set(g, []); m.get(g).push(r) }
  return m
}

// → { total, count, of, partial, top: [{ name, gcc, course, due, months }], aging: { one, two, three } }
export async function computeDuesSnapshot(onProgress) {
  const students = (await fetchAll('students', '*')).filter(s => (!s.status || s.status === 'Active') && !s.deleted_at && gccStr(s.gcc_no) !== '0')
  const [adm, flat, course] = await Promise.all([
    fetchAll('adm_fee_collections', 'amount_paid, description, fee_type, pay_date, adm_app_id', [['reverted', 'eq', false]]),
    fetchAll('adm_flat_fees', '*', [['reverted', 'eq', false], ['paid', 'eq', true]]),
    fetchAll('adm_course_fees', '*', [['reverted', 'eq', false]]),
  ])
  const [ai, fi, ci, hist] = [group(adm, 'adm_app_id'), group(flat, 'adm_app_id'), group(course, 'adm_app_id'), await loadHostelHistory()]
  const preload = s => { const g = gccStr(s.gcc_no); return { adm: ai.get(g) || [], flat: fi.get(g) || [], course: ci.get(g) || [], ...(hist.failed ? {} : { history: hist.map.get(g) || [] }) } }
  const res = await getDuesForStudents(students, getSessionYear(), { preload, onProgress })
  const owing = res.filter(r => r.dues?.totalDue > 0)
  const aging = { one: { amount: 0, count: 0 }, two: { amount: 0, count: 0 }, three: { amount: 0, count: 0 } }
  for (const r of owing) {
    const k = r.dues.monthsOverdue >= 3 ? 'three' : r.dues.monthsOverdue === 2 ? 'two' : 'one'
    aging[k].amount += r.dues.totalDue; aging[k].count += 1
  }
  return {
    total: owing.reduce((t, r) => t + r.dues.totalDue, 0),
    count: owing.length,
    of: students.length,
    partial: res.some(r => r.dues?.incomplete),
    aging,
    top: owing.slice().sort((a, b) => b.dues.totalDue - a.dues.totalDue).slice(0, 8)
      .map(r => ({ name: r.student.name || '—', gcc: gccStr(r.student.gcc_no), course: r.student.course || '—', due: r.dues.totalDue, months: r.dues.monthsOverdue })),
  }
}
