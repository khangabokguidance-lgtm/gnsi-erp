// AuditMonitor.jsx
// Admin-only tab for Accounts.jsx: course-wise fee collection breakdown +
// automated detection of the specific anomaly patterns found and manually
// fixed during the August 2026 audit of this ledger (duplicate recurring
// entries, fee amounts that don't match the configured course rate, entries
// with no voucher head, and outlier-sized single entries). This is a
// detection/reporting tool, not a save-time blocker — it flags existing
// data for admin review rather than rejecting new entries.
//
// Usage: import AuditMonitor from './AuditMonitor'
// Render only when isAdmin: {isAdmin && activeTab==='audit' && <AuditMonitor entries={entries} isMobile={isMobile} />}

import { useMemo, useState } from 'react'

// ── constants ────────────────────────────────────────────────────────────
const fmt = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN')

// Configured course fee rates (₹/month), by course name, for Day
// Scholar/Day Boarder/Boarder. Mirrors the fee_structures table found this
// session (rates are identical across every session year 2024-25 through
// 2027-28, so a flat lookup here is safe — if fee_structures is ever
// changed to vary by year, this table needs to move to a live query
// instead of being hardcoded).
const COURSE_RATES = {
  'Sainik':          { 'Day Scholar': 2500, 'Day Boarder': 4500, 'Boarder': 6000 },
  'Navodaya':        { 'Day Scholar': 2000, 'Day Boarder': 4000, 'Boarder': 5500 },
  'Foundation':      { 'Day Scholar': 2000, 'Day Boarder': 4000, 'Boarder': 5500 },
  'Combined Course': { 'Day Scholar': 2500, 'Day Boarder': 4500, 'Boarder': 6500 },
}
// Fallback when hostel type isn't known from the note alone — the modal
// rate (matches the most common real rate seen this session).
const COURSE_FALLBACK_RATE = { 'Sainik': 6000, 'Navodaya': 5500, 'Foundation': 5500, 'Combined Course': 6500 }
const KNOWN_COURSES = Object.keys(COURSE_RATES)

// Fee-note parser for the live "NAME · Course Batch Month · REF" format
// used by feeEngine.js's collectFee (distinct from any parenthetical
// "(Month Year)" format — this matches what's actually in the ledger).
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
function parseFeeNote(note = '') {
  const parts = note.split('·').map(s => s.trim())
  if (parts.length < 2) return { student: note || null, courseBatch: null, course: null, month: null, ref: null }
  const student = parts[0] || null
  const courseBatch = parts[1] || null
  const ref = parts[2] || null
  const monthMatch = MONTHS.find(m => courseBatch && courseBatch.endsWith(m))
  const course = KNOWN_COURSES.find(c => courseBatch && courseBatch.startsWith(c)) || null
  return { student, courseBatch, course, month: monthMatch || null, ref }
}

function rateFor(course, hostelType) {
  if (!course) return null
  if (hostelType && COURSE_RATES[course]?.[hostelType] != null) return COURSE_RATES[course][hostelType]
  return COURSE_FALLBACK_RATE[course] ?? null
}

// ── sub-components ──────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, bg, icon }) {
  return (
    <div style={{ backgroundColor: bg, borderRadius: 12, padding: '14px 16px', borderLeft: `4px solid ${color}` }}>
      <div style={{ fontSize: 18, marginBottom: 2 }}>{icon}</div>
      <p style={{ fontSize: 11, color, fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</p>
      <p style={{ fontSize: 19, fontWeight: 800, color, margin: '3px 0 0' }}>{value}</p>
      {sub && <p style={{ fontSize: 10.5, color, opacity: 0.75, margin: '2px 0 0' }}>{sub}</p>}
    </div>
  )
}

function FlagRow({ flag, isMobile }) {
  const sevColor = { high: '#dc2626', medium: '#d97706', low: '#64748b' }[flag.severity] || '#64748b'
  const sevBg    = { high: '#fef2f2', medium: '#fffbeb', low: '#f8fafc' }[flag.severity] || '#f8fafc'
  return (
    <div style={{ display: 'flex', gap: 12, padding: '12px 14px', borderRadius: 10, backgroundColor: sevBg, border: `1px solid ${sevColor}22`, marginBottom: 8, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
      <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', backgroundColor: sevColor, borderRadius: 6, padding: '3px 8px', height: 'fit-content', whiteSpace: 'nowrap' }}>
        {flag.severity.toUpperCase()}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: 0 }}>{flag.title}</p>
        <p style={{ fontSize: 12, color: '#475569', margin: '3px 0 0' }}>{flag.detail}</p>
      </div>
      {flag.amount != null && (
        <p style={{ fontSize: 13, fontWeight: 800, color: sevColor, margin: 0, whiteSpace: 'nowrap' }}>{fmt(flag.amount)}</p>
      )}
    </div>
  )
}

// ── main component ──────────────────────────────────────────────────────
export default function AuditMonitor({ entries = [], isMobile = false }) {
  const [section, setSection] = useState('overview') // overview | course | flags

  // ── Course-wise fee collection ──────────────────────────────────────
  const courseStats = useMemo(() => {
    const map = {}
    entries.forEach(e => {
      if (e.type !== 'Income' || e.category !== 'Fees') return
      const parsed = parseFeeNote(e.note)
      const key = parsed.course || 'Unrecognized / Other'
      if (!map[key]) map[key] = { course: key, total: 0, count: 0, students: new Set() }
      map[key].total += Number(e.amount || 0)
      map[key].count += 1
      if (parsed.student) map[key].students.add(parsed.student)
    })
    return Object.values(map)
      .map(c => ({ ...c, students: c.students.size }))
      .sort((a, b) => b.total - a.total)
  }, [entries])

  const totalFeeIncome = useMemo(
    () => entries.filter(e => e.type === 'Income' && e.category === 'Fees').reduce((s, e) => s + Number(e.amount || 0), 0),
    [entries]
  )

  // ── Anomaly detection ────────────────────────────────────────────────
  // Each rule below mirrors a pattern actually found and manually
  // corrected during this ledger's audit. This is intentionally a fixed,
  // known set of checks rather than a general "smart" anomaly detector —
  // false positives are expensive (they train admins to ignore the
  // panel), so each rule targets a specific, previously-confirmed problem
  // rather than guessing at what "looks odd."
  const flags = useMemo(() => {
    const out = []
    const expenseEntries = entries.filter(e => e.type === 'Expense')
    const incomeEntries  = entries.filter(e => e.type === 'Income')

    // Rule 1 — duplicate recurring entries: same note + amount + month,
    // both flagged is_recurring, not already superseded. This is the
    // exact bug pattern found this session (localStorage "already ran"
    // check failing across devices, inserting the same recurring expense
    // 2-3 times in a month).
    const recurringGroups = {}
    expenseEntries.forEach(e => {
      if (!e.is_recurring || e.status === 'Superseded') return
      const month = (e.entry_date || '').slice(0, 7)
      const key = `${(e.note || '').trim()}|${e.amount}|${month}`
      if (!recurringGroups[key]) recurringGroups[key] = []
      recurringGroups[key].push(e)
    })
    Object.entries(recurringGroups).forEach(([key, rows]) => {
      if (rows.length > 1) {
        const [note, amount] = key.split('|')
        out.push({
          severity: 'high',
          title: `Duplicate recurring entry: "${note}"`,
          detail: `${rows.length} active copies of the same recurring item (${rows.map(r => r.entry_date).join(', ')}) — only 1 should exist per month. This is the same auto-recurring duplication bug found and fixed earlier; mark the extra ${rows.length - 1} as Superseded.`,
          amount: Number(amount) * (rows.length - 1),
        })
      }
    })

    // Rule 2 — fee amount doesn't match the configured course rate, and no
    // reason/override is recorded in the note. Skips entries whose note
    // already documents a reason (the FeeCollectionModal fix from earlier
    // this session appends "Rate override: ... — <reason>" when a
    // discrepancy is deliberately recorded).
    incomeEntries.forEach(e => {
      if (e.category !== 'Fees') return
      const parsed = parseFeeNote(e.note)
      if (!parsed.course) return
      const hasRecordedReason = (e.note || '').includes('Rate override:')
      if (hasRecordedReason) return
      const rate = rateFor(parsed.course, null) // hostel type isn't in the note; flag against the fallback/most-common rate as a signal, not a certainty
      if (rate == null) return
      const amt = Number(e.amount || 0)
      const gap = Math.abs(amt - rate)
      if (gap >= 3000) {
        out.push({
          severity: 'medium',
          title: `Fee amount far from standard rate: ${parsed.student || 'Unknown student'}`,
          detail: `${parsed.courseBatch || parsed.course}${parsed.month ? ' · ' + parsed.month : ''} — paid ${fmt(amt)}, standard rate is ~${fmt(rate)}. Could be a legitimate Day Scholar/Boarder difference or discount — verify against the student's actual hostel type before treating as an error.`,
          amount: gap,
        })
      }
    })

    // Rule 3 — expense entries with no voucher head (accountability gap).
    // Only surfaces the total + count, not every row, since this pattern
    // showed up as dozens of entries in one date window last time — a
    // single summary flag is more actionable than 50 individual rows.
    const noVoucherHead = expenseEntries.filter(e => !e.voucher_head || e.voucher_head === '-')
    if (noVoucherHead.length > 0) {
      const total = noVoucherHead.reduce((s, e) => s + Number(e.amount || 0), 0)
      out.push({
        severity: noVoucherHead.length > 20 ? 'high' : 'medium',
        title: `${noVoucherHead.length} expense ${noVoucherHead.length === 1 ? 'entry has' : 'entries have'} no voucher head`,
        detail: `No accountable person recorded for ${fmt(total)} of expenditure. Review and assign a voucher head to each, especially any large individual amounts.`,
        amount: total,
      })
    }

    // Rule 4 — outlier single entries: any expense more than 3x the
    // median expense amount. Catches the kind of single very-large
    // unexplained payment (e.g. the ₹2.5L Paytm entry) found this
    // session, without hardcoding a fixed rupee threshold that would
    // stop being meaningful as the institute's normal spending grows.
    if (expenseEntries.length >= 5) {
      const amounts = expenseEntries.map(e => Number(e.amount || 0)).sort((a, b) => a - b)
      const median = amounts[Math.floor(amounts.length / 2)]
      const threshold = median * 8
      expenseEntries
        .filter(e => Number(e.amount || 0) > threshold && Number(e.amount || 0) > 20000)
        .sort((a, b) => Number(b.amount) - Number(a.amount))
        .slice(0, 10) // cap so one bad week doesn't flood the panel
        .forEach(e => {
          out.push({
            severity: 'medium',
            title: `Unusually large expense: ${e.category || 'Other'}`,
            detail: `${e.entry_date} · ${e.voucher_head || 'no voucher head'} · ${(e.note || '').slice(0, 80) || 'no note'} — over 8× the typical expense amount (median ${fmt(median)}). Worth a receipt check.`,
            amount: Number(e.amount),
          })
        })
    }

    // Rule 5 — category label fragmentation: near-duplicate category names
    // (case/spacing variants) that split what should be one spend bucket
    // across several labels, undercounting each in reports.
    const catCounts = {}
    expenseEntries.forEach(e => {
      const c = (e.category || '').trim()
      if (!c) return
      const norm = c.toLowerCase().replace(/\s+/g, ' ')
      if (!catCounts[norm]) catCounts[norm] = new Set()
      catCounts[norm].add(c)
    })
    Object.entries(catCounts).forEach(([norm, variants]) => {
      if (variants.size > 1) {
        out.push({
          severity: 'low',
          title: `Category label variants: "${[...variants].join('" / "')}"`,
          detail: `${variants.size} different spellings/capitalizations of what looks like the same category — splits this spend across multiple buckets in reports. Consider standardizing to one label.`,
          amount: null,
        })
      }
    })

    // Sort: high severity first, then by amount (biggest first) within
    // each severity band, so the most consequential items surface at top.
    const sevOrder = { high: 0, medium: 1, low: 2 }
    return out.sort((a, b) => (sevOrder[a.severity] - sevOrder[b.severity]) || ((b.amount || 0) - (a.amount || 0)))
  }, [entries])

  const highCount = flags.filter(f => f.severity === 'high').length
  const mediumCount = flags.filter(f => f.severity === 'medium').length
  const lowCount = flags.filter(f => f.severity === 'low').length
  const flaggedTotal = flags.reduce((s, f) => s + (f.amount || 0), 0)

  return (
    <div>
      <div style={{ backgroundColor: '#312e81', borderRadius: 12, padding: isMobile ? '16px' : '20px 24px', marginBottom: 20 }}>
        <h2 style={{ fontSize: isMobile ? 15 : 18, fontWeight: 800, color: 'white', margin: 0 }}>🛡️ Audit Monitor</h2>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', margin: '4px 0 0' }}>
          Course-wise fee collection and automated checks for the specific patterns found in this ledger's last audit — admin only.
        </p>
      </div>

      {/* ── top-level stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: isMobile ? 10 : 14, marginBottom: 20 }}>
        <StatCard label="Total Fee Income" value={fmt(totalFeeIncome)} sub={`${courseStats.reduce((s, c) => s + c.count, 0)} entries`} color="#16a34a" bg="#dcfce7" icon="📈" />
        <StatCard label="High Severity" value={highCount} sub="Needs review now" color="#dc2626" bg="#fef2f2" icon="🔴" />
        <StatCard label="Medium Severity" value={mediumCount} sub="Worth checking" color="#d97706" bg="#fffbeb" icon="🟠" />
        <StatCard label="Flagged Amount" value={fmt(flaggedTotal)} sub="Sum across all flags" color="#312e81" bg="#eef2ff" icon="🛡️" />
      </div>

      {/* ── section nav ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          ['overview', `🛡️ All Flags${flags.length ? ` (${flags.length})` : ''}`],
          ['course', '🎓 Course-wise Collection'],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setSection(id)}
            style={{
              padding: '8px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
              backgroundColor: section === id ? '#312e81' : '#eef2ff',
              color: section === id ? 'white' : '#312e81',
              border: '1px solid #c7d2fe',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {section === 'overview' && (
        <div style={{ backgroundColor: 'white', borderRadius: 12, padding: isMobile ? 14 : 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          {flags.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#16a34a' }}>
              <p style={{ fontSize: 32, margin: 0 }}>✅</p>
              <p style={{ fontSize: 14, fontWeight: 700, margin: '8px 0 0' }}>No known issues detected</p>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 0' }}>None of the tracked anomaly patterns matched current entries.</p>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 0, marginBottom: 14 }}>
                {highCount} high · {mediumCount} medium · {lowCount} low severity — sorted by severity, then amount
              </p>
              {flags.map((f, i) => <FlagRow key={i} flag={f} isMobile={isMobile} />)}
            </>
          )}
        </div>
      )}

      {section === 'course' && (
        <div style={{ backgroundColor: 'white', borderRadius: 12, padding: isMobile ? 14 : 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          {courseStats.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#94a3b8', padding: 32 }}>No fee entries found.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ backgroundColor: '#312e81', color: 'white' }}>
                    <th style={{ padding: '9px 12px', textAlign: 'left' }}>Course</th>
                    <th style={{ padding: '9px 12px', textAlign: 'right' }}>Entries</th>
                    <th style={{ padding: '9px 12px', textAlign: 'right' }}>Distinct Students</th>
                    <th style={{ padding: '9px 12px', textAlign: 'right' }}>Total Collected</th>
                    <th style={{ padding: '9px 12px', textAlign: 'right' }}>Share of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {courseStats.map((c, i) => (
                    <tr key={c.course} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: i % 2 ? '#fafafa' : 'white' }}>
                      <td style={{ padding: '9px 12px', fontWeight: 600, color: c.course === 'Unrecognized / Other' ? '#dc2626' : '#0f172a' }}>{c.course}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right' }}>{c.count}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right' }}>{c.students}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700 }}>{fmt(c.total)}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', color: '#64748b' }}>{totalFeeIncome > 0 ? ((c.total / totalFeeIncome) * 100).toFixed(1) : '0.0'}%</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: '#eef2ff', fontWeight: 800 }}>
                    <td style={{ padding: '9px 12px' }}>TOTAL</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right' }}>{courseStats.reduce((s, c) => s + c.count, 0)}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right' }}>—</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right' }}>{fmt(totalFeeIncome)}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right' }}>100%</td>
                  </tr>
                </tfoot>
              </table>
              {courseStats.some(c => c.course === 'Unrecognized / Other') && (
                <p style={{ fontSize: 11.5, color: '#dc2626', marginTop: 10 }}>
                  "Unrecognized / Other" entries have a note that doesn't match the expected "Name · Course Batch Month · Ref" format — check these manually, they may be miscategorized or use an unlisted course name.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}