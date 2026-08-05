import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from './supabase'
import { computeHMPerformance, normalizeHouse } from './Hostel'
import { calcScores } from './Staff'

// ══════════════════════════════════════════════════════════════
//  AWARDS MODULE — daily tick system (simple version)
//
//  ONE screen, opened daily by the Principal/supervisor. For every
//  nominee, tick each qualitative bullet yes/no for today. That's
//  the entire data-entry surface — no forms, no weights, no sliders,
//  no second evaluator.
//
//  Month-end score per bullet = (days ticked yes) / (days present) × 100
//  Category score = average of ALL bullet %s — tapped bullets and
//  auto bullets (attendance, roll call, tasks — pulled from existing
//  tables) sit on the same 0-100 scale and are averaged together
//  with equal weight. No blending formula to explain.
//
//  Auto bullets reuse:
//    - Staff.jsx  → calcScores() for Faculty/Non-Teaching attendance
//    - Hostel.jsx → computeHMPerformance() for House Master roll call
// ══════════════════════════════════════════════════════════════

const todayStr = () => new Date().toISOString().slice(0, 10)
const monthStrOf = (dateStr) => dateStr.slice(0, 7) // 'YYYY-MM'

function daysInMonth(monthStr) {
  const [y, m] = monthStr.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

function getPublishDate(monthStr) {
  const [y, m] = monthStr.split('-').map(Number)
  const d = new Date(y, m - 1, 10)
  if (d.getDay() === 0) d.setDate(11)
  return d
}

// ══════════════════════════════════════════════════════════════
//  CATEGORY DEFINITIONS — every bullet tagged 'tick' or 'auto'.
//  'tick' bullets appear on the daily checklist screen.
//  'auto' bullets are computed from existing tables, no ticking needed.
// ══════════════════════════════════════════════════════════════

const CATEGORIES = {
  house_master: {
    label: 'Best House Master of the Month',
    icon: '🏅',
    reward: 'Cash Award + Certificate of Appreciation by Head of the Institution',
    nomineeSource: 'housemasters',
    bullets: [
      { key: 'present_duty', text: 'Personally present and available during duty hours', type: 'tick' },
      { key: 'handled_issues', text: 'Handled student issues/complaints/emergencies promptly and calmly', type: 'tick' },
      { key: 'discipline_fair', text: 'Maintained discipline without excessive punishment', type: 'tick' },
      { key: 'house_clean', text: 'Kept the house clean, organized, well-maintained', type: 'tick' },
      { key: 'rapport', text: 'Approachable, fair — good rapport and trust with students', type: 'tick' },
      { key: 'coordinated', text: 'Coordinated well with kitchen, sickbay, other staff', type: 'tick' },
      { key: 'personal_example', text: 'Personal example — punctual, well turned out, professional', type: 'tick' },
      { key: 'roll_call', text: 'Roll call / compliance / neglect-free record', type: 'auto' },
    ],
  },
  doubt_session: {
    label: 'Best Doubt Session Staff of the Month',
    icon: '🏅',
    reward: 'Cash Reward + Certificate of Appreciation by Head of the Institution',
    nomineeSource: 'staff',
    role: null,
    bullets: [
      { key: 'attended', text: 'Attended assigned doubt session today', type: 'tick' },
      { key: 'patient', text: 'Patient and approachable with students', type: 'tick' },
      { key: 'clear', text: 'Explained clearly, adapted to understanding levels', type: 'tick' },
      { key: 'beyond', text: 'Went beyond scheduled time when genuinely needed', type: 'tick' },
      { key: 'prepared', text: 'Prepared in advance rather than answering on the fly', type: 'tick' },
      { key: 'positive_feedback', text: 'Positive student feedback today', type: 'tick' },
    ],
  },
  non_teaching: {
    label: 'Best Non-Teaching Staff of the Month',
    icon: '🏅',
    reward: 'Cash Award + Certificate of Appreciation by Head of the Institution',
    nomineeSource: 'staff',
    role: 'Non-Teaching',
    bullets: [
      { key: 'prompt', text: 'Prompt, willing response to tasks — no repeated follow-up', type: 'tick' },
      { key: 'area_clean', text: 'Maintained cleanliness/upkeep of assigned area', type: 'tick' },
      { key: 'cooperative', text: 'Cooperative and respectful with staff and students', type: 'tick' },
      { key: 'initiative', text: 'Showed initiative — flagged/fixed problems unasked', type: 'tick' },
      { key: 'report', text: 'Submitted day-to-day report to office', type: 'tick' },
      { key: 'attendance', text: 'Attendance and discipline in duty hours', type: 'auto' },
    ],
  },
  faculty: {
    label: 'Best Faculty of the Month',
    icon: '🏅',
    reward: 'Cash Award + Certificate of Appreciation by Head of the Institution',
    nomineeSource: 'staff',
    role: 'Teaching',
    bullets: [
      { key: 'prepared', text: 'Well-prepared, clear teaching, good classroom control', type: 'tick' },
      { key: 'approachable', text: 'Approachable to students for extra help outside class', type: 'tick' },
      { key: 'fair_eval', text: 'Fair, consistent in evaluating/correcting work', type: 'tick' },
      { key: 'motivating', text: 'Positive, motivating presence', type: 'tick' },
      { key: 'professional', text: 'Professional conduct and appearance', type: 'tick' },
      { key: 'punctual', text: 'Punctual to class, used full class time', type: 'auto' },
    ],
  },
  house: {
    label: 'Best House of the Month',
    icon: '🏆',
    reward: 'Trophy + Certificate & All Students get Garden Visit',
    nomineeSource: 'houses',
    bullets: [
      { key: 'rooms_clean', text: 'Rooms, corridors, common areas clean and orderly', type: 'tick' },
      { key: 'discipline', text: 'Good student discipline and behavior observed', type: 'tick' },
      { key: 'neatness', text: 'Beds, belongings, uniforms neat (spot check)', type: 'tick' },
      { key: 'hygiene', text: 'General hygiene — house and surroundings', type: 'tick' },
      { key: 'turnout', text: 'Punctual, good turnout at assembly/roll call', type: 'tick' },
      { key: 'atmosphere', text: 'Overall atmosphere — order and care', type: 'tick' },
    ],
  },
}

// ══════════════════════════════════════════════════════════════
//  DATA LAYER
// ══════════════════════════════════════════════════════════════

async function fetchNominees(category) {
  if (category.nomineeSource === 'housemasters') {
    const { data } = await supabase.from('housemasters').select('name, house').eq('status', 'Active')
    return (data || []).map(h => ({ id: h.name, name: `${h.name} — ${h.house}` }))
  }
  if (category.nomineeSource === 'houses') {
    const { data } = await supabase.from('houses').select('id, name').order('name')
    return (data || []).map(h => ({ id: h.id, name: h.name }))
  }
  const query = supabase.from('staff').select('id, name, role').eq('status', 'Active')
  const { data } = category.role ? await query.eq('role', category.role) : await query
  return (data || []).map(s => ({ id: s.id, name: s.name }))
}

/** Today's ticks for a category, keyed by nominee id. */
async function fetchTodayTicks(categoryKey, dateStr) {
  const { data } = await supabase.from('award_daily_ticks').select('*').eq('category_key', categoryKey).eq('tick_date', dateStr)
  const map = {}
  ;(data || []).forEach(row => { map[row.nominee_id] = row.bullet_ticks })
  return map
}

/** Saves one nominee's ticks for today. bulletTicks: { bulletKey: true|false } */
async function saveTicks(categoryKey, nomineeId, nomineeName, dateStr, bulletTicks) {
  const payload = {
    category_key: categoryKey,
    nominee_id: String(nomineeId),
    nominee_name: nomineeName,
    tick_date: dateStr,
    bullet_ticks: bulletTicks,
  }
  const { error } = await supabase.from('award_daily_ticks').upsert(payload, { onConflict: 'category_key,nominee_id,tick_date' })
  if (error) throw error
}

/** All ticks for a nominee across the month, for computing the % score. */
async function fetchMonthTicks(categoryKey, nomineeId, monthStr) {
  const { data } = await supabase
    .from('award_daily_ticks')
    .select('bullet_ticks, tick_date')
    .eq('category_key', categoryKey)
    .eq('nominee_id', String(nomineeId))
    .gte('tick_date', `${monthStr}-01`)
    .lte('tick_date', `${monthStr}-31`)
  return data || []
}

// ══════════════════════════════════════════════════════════════
//  SCORING — % of days ticked yes, per bullet, averaged with auto bullets
// ══════════════════════════════════════════════════════════════

/** % score for one tick-type bullet: days ticked yes / days recorded (not days in month — only counts days someone actually ticked). */
function bulletTickPercent(monthTickRows, bulletKey) {
  const recorded = monthTickRows.filter(r => r.bullet_ticks && bulletKey in r.bullet_ticks)
  if (recorded.length === 0) return null
  const yesCount = recorded.filter(r => r.bullet_ticks[bulletKey] === true).length
  return Math.round((yesCount / recorded.length) * 100)
}

async function computeCategoryRanking(categoryKey, monthStr) {
  const category = CATEGORIES[categoryKey]
  const nominees = await fetchNominees(category)

  // Auto bullet source per category
  let hmPerf = null
  let staffScores = null
  if (categoryKey === 'house_master') {
    const [y, m] = monthStr.split('-').map(Number)
    const start = `${monthStr}-01`
    const end = new Date(y, m, 0).toISOString().slice(0, 10)
    hmPerf = await computeHMPerformance(start, end)
  }
  if (categoryKey === 'non_teaching' || categoryKey === 'faculty') {
    const { data } = await supabase.from('staff_monthly_scores').select('*').eq('month', monthStr)
    staffScores = {}
    ;(data || []).forEach(r => { staffScores[r.staff_id] = r })
  }

  const results = await Promise.all(nominees.map(async (n) => {
    const monthRows = await fetchMonthTicks(categoryKey, n.id, monthStr)
    const tickBullets = category.bullets.filter(b => b.type === 'tick')
    const autoBullets = category.bullets.filter(b => b.type === 'auto')

    const tickPercents = tickBullets.map(b => bulletTickPercent(monthRows, b.key)).filter(v => v !== null)

    let autoPercent = null
    if (categoryKey === 'house_master' && hmPerf) {
      const match = hmPerf.find(r => r.hmName === n.id)
      autoPercent = match?.score ?? null
    }
    if ((categoryKey === 'non_teaching' || categoryKey === 'faculty') && staffScores) {
      const row = staffScores[n.id]
      if (row) {
        const wd = row.working_days || 26
        autoPercent = categoryKey === 'faculty'
          ? Math.round(((row.days_present || 0) / wd) * 100)
          : Math.round(((row.days_present || 0) / wd) * 100)
      }
    }

    const allPercents = [...tickPercents]
    if (autoBullets.length > 0 && autoPercent !== null) allPercents.push(autoPercent)

    const score = allPercents.length > 0
      ? Math.round(allPercents.reduce((a, b) => a + b, 0) / allPercents.length)
      : null

    const daysTicked = monthRows.length
    return { nomineeId: n.id, name: n.name, score, daysTicked, eligible: score !== null }
  }))

  const eligible = results.filter(r => r.eligible)
  const ineligible = results.filter(r => !r.eligible)
  eligible.sort((a, b) => b.score - a.score)
  return [...eligible, ...ineligible]
}

async function fetchPublishedWinner(categoryKey, monthStr) {
  const { data } = await supabase.from('award_winners').select('*').eq('category_key', categoryKey).eq('month', monthStr).maybeSingle()
  return data
}

async function publishWinner(categoryKey, monthStr, winner) {
  const publishDate = getPublishDate(monthStr)
  const payload = {
    category_key: categoryKey,
    month: monthStr,
    nominee_id: String(winner.nomineeId),
    nominee_name: winner.name,
    score: winner.score,
    publish_date: publishDate.toISOString().slice(0, 10),
    status: 'published',
    published_at: new Date().toISOString(),
  }
  const { error } = await supabase.from('award_winners').upsert(payload, { onConflict: 'category_key,month' })
  if (error) throw error
}

// ══════════════════════════════════════════════════════════════
//  STYLES — Ledger & Crest
// ══════════════════════════════════════════════════════════════

const S = {
  page: { fontFamily: "'Georgia', serif", background: '#F8F6F0', minHeight: '100vh', padding: 20 },
  header: { color: '#0B1E3D', borderBottom: '3px solid #C9A24B', paddingBottom: 12, marginBottom: 16 },
  modeToggle: { display: 'flex', gap: 8, marginBottom: 16 },
  modeBtn: (active) => ({ padding: '8px 16px', borderRadius: 6, border: active ? '2px solid #C9A24B' : '1px solid #ccc', background: active ? '#0B1E3D' : '#fff', color: active ? '#fff' : '#0B1E3D', cursor: 'pointer', fontWeight: 600, fontSize: 13 }),
  card: { background: '#fff', border: '1px solid #e0ddd3', borderRadius: 8, padding: 16, marginBottom: 12 },
  catTabRow: { display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' },
  catTab: (active) => ({ padding: '8px 14px', borderRadius: 6, border: active ? '2px solid #C9A24B' : '1px solid #ccc', background: active ? '#0B1E3D' : '#fff', color: active ? '#fff' : '#0B1E3D', cursor: 'pointer', fontWeight: 600, fontSize: 12 }),
  nomineeRow: { padding: '12px 0', borderBottom: '1px solid #f0eee6' },
  checkRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', fontSize: 13 },
  rankRow: (isWinner) => ({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 6, marginBottom: 6, background: isWinner ? '#FFF8E7' : '#fafafa', border: isWinner ? '2px solid #C9A24B' : '1px solid #eee' }),
  btn: { background: '#0B1E3D', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  badge: (kind) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: kind === 'ok' ? '#e6f4ea' : '#eef0f5', color: kind === 'ok' ? '#1e7e34' : '#333' }),
}

// ══════════════════════════════════════════════════════════════
//  DAILY TICK SCREEN — the screen opened every day
// ══════════════════════════════════════════════════════════════

function DailyTickScreen() {
  const [activeKey, setActiveKey] = useState('faculty')
  const [nominees, setNominees] = useState([])
  const [ticks, setTicks] = useState({}) // { nomineeId: { bulletKey: bool } }
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const category = CATEGORIES[activeKey]
  const date = todayStr()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const list = await fetchNominees(category)
      const todayMap = await fetchTodayTicks(activeKey, date)
      if (!cancelled) { setNominees(list); setTicks(todayMap); setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [activeKey])

  const handleToggle = (nomineeId, bulletKey) => {
    setTicks(prev => ({
      ...prev,
      [nomineeId]: { ...(prev[nomineeId] || {}), [bulletKey]: !(prev[nomineeId]?.[bulletKey]) },
    }))
  }

  const handleSave = async (nominee) => {
    setSavingId(nominee.id)
    try {
      await saveTicks(activeKey, nominee.id, nominee.name, date, ticks[nominee.id] || {})
    } catch (err) {
      alert('Could not save: ' + err.message)
    } finally {
      setSavingId(null)
    }
  }

  const tickBullets = category.bullets.filter(b => b.type === 'tick')
  const autoBullets = category.bullets.filter(b => b.type === 'auto')

  return (
    <div>
      <div style={S.catTabRow}>
        {Object.entries(CATEGORIES).map(([key, c]) => (
          <button key={key} style={S.catTab(activeKey === key)} onClick={() => setActiveKey(key)}>
            {c.icon} {c.label.replace('Best ', '').replace(' of the Month', '')}
          </button>
        ))}
      </div>

      <div style={{ ...S.card, background: '#FFF8E7', border: '1px solid #C9A24B' }}>
        <strong>{category.icon} {category.label}</strong>
        <p style={{ margin: '4px 0 0', fontSize: 13 }}>Today: {date}. Tick what you observed. {autoBullets.length > 0 ? `${autoBullets[0].text} is tracked automatically.` : ''}</p>
      </div>

      {loading ? <p>Loading…</p> : nominees.map(n => (
        <div key={n.id} style={S.card}>
          <div style={S.nomineeRow}>
            <strong>{n.name}</strong>
          </div>
          {tickBullets.map(b => (
            <label key={b.key} style={S.checkRow}>
              <input type="checkbox" checked={!!ticks[n.id]?.[b.key]} onChange={() => handleToggle(n.id, b.key)} />
              {b.text}
            </label>
          ))}
          <button style={{ ...S.btn, marginTop: 10 }} onClick={() => handleSave(n)} disabled={savingId === n.id}>
            {savingId === n.id ? 'Saving…' : 'Save today\u2019s ticks'}
          </button>
        </div>
      ))}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  MONTHLY LEADERBOARD — read-only, updates as ticks come in
// ══════════════════════════════════════════════════════════════

function LeaderboardScreen() {
  const [activeKey, setActiveKey] = useState('faculty')
  const [monthStr, setMonthStr] = useState(monthStrOf(todayStr()))
  const [ranking, setRanking] = useState([])
  const [loading, setLoading] = useState(true)
  const [published, setPublished] = useState(null)
  const [publishing, setPublishing] = useState(false)
  const category = CATEGORIES[activeKey]

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const results = await computeCategoryRanking(activeKey, monthStr)
      const win = await fetchPublishedWinner(activeKey, monthStr)
      if (!cancelled) { setRanking(results); setPublished(win); setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [activeKey, monthStr])

  const ranked = useMemo(() => {
    const eligible = ranking.filter(r => r.eligible)
    const rest = ranking.filter(r => !r.eligible)
    return [...eligible.map((r, i) => ({ ...r, rank: i + 1, isWinner: i === 0 })), ...rest.map(r => ({ ...r, rank: null, isWinner: false }))]
  }, [ranking])

  const topPick = ranked.find(r => r.isWinner)
  const publishDate = getPublishDate(monthStr)

  const handlePublish = async () => {
    if (!topPick) return
    setPublishing(true)
    try {
      await publishWinner(activeKey, monthStr, topPick)
      setPublished(await fetchPublishedWinner(activeKey, monthStr))
    } catch (err) {
      alert('Publish failed: ' + err.message)
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div>
      <div style={S.catTabRow}>
        {Object.entries(CATEGORIES).map(([key, c]) => (
          <button key={key} style={S.catTab(activeKey === key)} onClick={() => setActiveKey(key)}>
            {c.icon} {c.label.replace('Best ', '').replace(' of the Month', '')}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
        <input type="month" value={monthStr} onChange={e => setMonthStr(e.target.value)} style={{ padding: 6, border: '1px solid #ccc', borderRadius: 4 }} />
        <span style={{ fontSize: 13, color: '#666' }}>Publishes {publishDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
      </div>

      <div style={S.card}>
        <h3 style={{ margin: '0 0 4px', color: '#0B1E3D' }}>Rankings — average of ticked days</h3>
        {loading ? <p>Loading…</p> : ranked.length === 0 ? (
          <p style={{ color: '#999' }}>No ticks recorded yet this month.</p>
        ) : ranked.map(r => (
          <div key={r.nomineeId} style={S.rankRow(r.isWinner)}>
            <div>
              <strong>{r.rank ? `#${r.rank} ` : ''}{r.name}</strong>
              {r.isWinner && <span style={{ marginLeft: 8, ...S.badge('ok') }}>LEADING</span>}
              <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{r.daysTicked} day{r.daysTicked === 1 ? '' : 's'} recorded</div>
            </div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{r.score !== null ? `${r.score}%` : '—'}</div>
          </div>
        ))}
      </div>

      {topPick && (
        <div style={{ ...S.card, borderColor: '#C9A24B', borderWidth: 2 }}>
          {published ? (
            <p style={{ margin: 0 }}><strong>{published.nominee_name}</strong> published — {published.score}%</p>
          ) : (
            <>
              <p style={{ margin: '0 0 10px' }}><strong>{topPick.name}</strong> is leading at {topPick.score}%</p>
              <button style={S.btn} onClick={handlePublish} disabled={publishing}>{publishing ? 'Publishing…' : 'Confirm & publish winner'}</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  ROOT — two modes: tick today, or view the leaderboard
// ══════════════════════════════════════════════════════════════

export default function Awards() {
  const [mode, setMode] = useState('tick') // 'tick' | 'leaderboard'

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={{ margin: 0, fontSize: 24 }}>🏅 Staff & house awards</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#666' }}>Tick daily. Winners calculate automatically from the month's ticks.</p>
      </div>

      <div style={S.modeToggle}>
        <button style={S.modeBtn(mode === 'tick')} onClick={() => setMode('tick')}>Today's ticks</button>
        <button style={S.modeBtn(mode === 'leaderboard')} onClick={() => setMode('leaderboard')}>Leaderboard</button>
      </div>

      {mode === 'tick' ? <DailyTickScreen /> : <LeaderboardScreen />}
    </div>
  )
}