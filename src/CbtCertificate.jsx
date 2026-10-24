// CbtCertificate.jsx — premium certificate for a CBT result. Staff type a Test ID and a GCC no.; the student's full
// record (name, class, father / mother, parent contact …) is read from the ERP and the candidate's marks, rank and
// section scores are filled in. Printed on the same A4 design as the fee receipt and the other certificates.
import { useEffect, useState } from 'react'
import { fmtDate } from './premiumReceipt'
import { loadStudents, printCbtCertificates } from './cbtCertPrint'
import { findStudent, attemptForGcc, parentPhoneOf } from './lib/cbtCertLogic'

// Everything for one test's results: the Test ID + GCC finder, and printing for all submitted attempts.
export function CbtCertificateTool({ test, rows, flash }) {
  const [students, setStudents] = useState(null)
  const [err, setErr] = useState('')
  const [gcc, setGcc] = useState('')
  const [found, setFound] = useState(null)       // { student, row } | { none: true }
  useEffect(() => {
    let live = true
    loadStudents().then(s => { if (live) setStudents(s) }).catch(e => { if (live) setErr(e.message) })
    return () => { live = false }
  }, [])
  const submitted = rows.filter(r => r.submitted)
  const total = submitted.length

  const find = () => {
    if (!students) return
    const student = students.find(s => String(s.gcc_no ?? '').replace(/^0+/, '') === gcc.replace(/\D/g, '').replace(/^0+/, ''))
    if (!student) return setFound({ none: 'No student with this GCC no. in the ERP.' })
    const row = attemptForGcc(rows, students, student.gcc_no)
    setFound(row ? { student, row } : { student, none: 'This student has no submitted attempt in this test.' })
  }
  const printAll = () => {
    const items = submitted.map(row => ({ row, student: findStudent(students, row.attempt).student, test, total })).filter(i => i.student)
    const skipped = total - items.length
    if (!items.length) return flash?.('No attempt could be matched to an ERP student (needs the GCC no., or a roll no. equal to it).')
    if (skipped) flash?.(`${skipped} attempt(s) could not be matched to an ERP student and were left out.`)
    printCbtCertificates(items, `${test.name} — certificates`)
  }
  const st = found?.student
  return (
    <div className="card">
      <h3>🎓 Premium certificate</h3>
      <p className="muted">Enter the Test ID and the student's GCC no. — the student's full record is picked up from the ERP together with the result.</p>
      {err && <p style={{ color: '#b42318' }}>Could not load the students: {err}</p>}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,200px),1fr))', alignItems: 'end' }}>
        <label><span className="lbl">Test ID</span><input className="in" readOnly value={test.id} onFocus={e => e.target.select()} /></label>
        <label><span className="lbl">GCC no.</span><input className="in" inputMode="numeric" value={gcc} onChange={e => { setGcc(e.target.value); setFound(null) }} onKeyDown={e => e.key === 'Enter' && find()} /></label>
        <div><button className="btn navy" disabled={!students || !gcc.trim()} onClick={find}>{students ? 'Find student' : 'Loading students…'}</button></div>
      </div>
      {found?.none && <p style={{ color: '#9a5b00', fontWeight: 700 }}>{found.none}</p>}
      {st && (
        <div style={{ border: '1px solid #e2d9c0', borderRadius: 10, padding: 12, marginTop: 10, background: '#fffdf8' }}>
          <b>{st.name}</b> · GCC {st.gcc_no} · {st.course || '—'}{st.class_name ? ` (${st.class_name})` : ''}
          <div className="muted" style={{ marginTop: 4 }}>Father: {st.father_name || '—'} · Mother: {st.mother_name || '—'} · Parent contact: <b>{parentPhoneOf(st) || '— (add it in Students)'}</b>{st.hostel_type ? ` · ${st.hostel_type}` : ''}{st.dob ? ` · DOB ${fmtDate(st.dob)}` : ''}</div>
          {found.row && <div style={{ marginTop: 6 }}>Result: <b>{found.row.g.marks} / {found.row.g.max}</b>{found.row.rank ? ` · rank ${found.row.rank} of ${total}` : ''}
            {' '}<button className="btn gold" onClick={() => printCbtCertificates([{ student: st, row: found.row, test, total }])}>🖨 Print certificate</button></div>}
        </div>
      )}
      <div style={{ marginTop: 10 }}><button className="btn" disabled={!students || !total} onClick={printAll}>🎓 Certificates for all {total} submitted</button></div>
    </div>
  )
}
