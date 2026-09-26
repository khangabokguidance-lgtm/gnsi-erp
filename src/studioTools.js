// studioTools.js — GNSI Portal · Material Studio helpers (no React)
//
// Tray analysis (duplicates, insights), the auto-builder's picker, the
// per-user saved-set library and print history (browser storage), sharing
// (set files, WhatsApp text, CSV) and logo resizing.

// ── Duplicate guard ──────────────────────────────────────────────────────────
const words = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{M}\p{N} ]+/gu, ' ').split(/\s+/).filter(Boolean)

// Two questions are near-duplicates when their wording is (almost) the same:
// identical after normalising, or ≥85% word overlap (Jaccard) on 4+ words.
export function similar(a, b) {
  const wa = words(a), wb = words(b)
  if (!wa.length || !wb.length) return false
  if (wa.join(' ') === wb.join(' ')) return true
  if (wa.length < 4 || wb.length < 4) return false
  const A = new Set(wa), B = new Set(wb)
  let inter = 0
  for (const w of A) if (B.has(w)) inter++
  return inter / (A.size + B.size - inter) >= 0.85
}

// Tray indexes that repeat an earlier question (by id or wording).
export function duplicateIndexes(tray) {
  const dup = new Set()
  tray.forEach((it, i) => {
    if (it.kind !== 'q') return
    for (let j = 0; j < i; j++) {
      const o = tray[j]
      if (o.kind === 'q' && !dup.has(j) && (o.id === it.id || similar(o.row.question, it.row.question))) { dup.add(i); break }
    }
  })
  return dup
}

// ── Tray tools ───────────────────────────────────────────────────────────────
const DIFF_ORDER = { Easy: 0, Medium: 1, Hard: 2 }
export function sortTray(tray, by) {
  const key = it => {
    const r = it.row
    if (by === 'difficulty') return `${it.kind}|${DIFF_ORDER[r.difficulty] ?? 1}|${r.chapter || ''}`
    if (by === 'chapter') return `${it.kind}|${r.subject || ''}|${r.chapter || ''}|${DIFF_ORDER[r.difficulty] ?? 1}`
    return `${it.kind}|${r.subject || ''}|${r.chapter || ''}`
  }
  return [...tray].sort((a, b) => key(a).localeCompare(key(b)))
}
export function shuffleTray(tray, rand = Math.random) {
  const a = [...tray]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1));[a[i], a[j]] = [a[j], a[i]] }
  return a
}

// ── Tray insights ────────────────────────────────────────────────────────────
// Rough solving time per question for class planning (seconds).
export const SECONDS = { Easy: 45, Medium: 75, Hard: 120 }
export function insights(tray, marksFor = () => 1) {
  const qs = tray.filter(t => t.kind === 'q').map(t => t.row)
  const diff = { Easy: 0, Medium: 0, Hard: 0 }
  const chapters = new Map()
  let secs = 0, marks = 0
  for (const q of qs) {
    const d = DIFF_ORDER[q.difficulty] != null ? q.difficulty : 'Medium'
    diff[d]++
    secs += SECONDS[d]
    marks += Number(marksFor(q)) || 0
    const k = [q.subject, q.chapter].filter(Boolean).join(' · ') || 'Other'
    chapters.set(k, (chapters.get(k) || 0) + 1)
  }
  return { questions: qs.length, materials: tray.length - qs.length, diff, chapters: [...chapters].sort((a, b) => b[1] - a[1]), minutes: Math.ceil(secs / 60), marks }
}

// ── Auto-builder ─────────────────────────────────────────────────────────────
// Pick `count` questions honouring a difficulty mix and spreading across
// chapters round-robin, so one large chapter can't crowd out the rest.
export function autoPick(pool, count, { mix = { Easy: 30, Medium: 50, Hard: 20 }, exclude = new Set(), rand = Math.random } = {}) {
  const usable = pool.filter(q => !exclude.has(q.id) && q.question && q.option_a && q.option_b)
  const total = (mix.Easy || 0) + (mix.Medium || 0) + (mix.Hard || 0) || 100
  const want = { Easy: Math.round(count * (mix.Easy || 0) / total), Hard: Math.round(count * (mix.Hard || 0) / total) }
  want.Medium = Math.max(0, count - want.Easy - want.Hard)
  const spread = (list, n) => {
    const byCh = new Map()
    for (const q of shuffleTray(list, rand)) { const k = q.chapter || '—'; if (!byCh.has(k)) byCh.set(k, []); byCh.get(k).push(q) }
    const lists = shuffleTray([...byCh.values()], rand)
    const out = []
    while (out.length < n && lists.some(l => l.length)) for (const l of lists) { if (out.length >= n) break; const q = l.shift(); if (q) out.push(q) }
    return out
  }
  let picked = []
  for (const d of ['Easy', 'Medium', 'Hard']) picked = picked.concat(spread(usable.filter(q => (q.difficulty || 'Medium') === d), want[d]))
  if (picked.length < count) {
    const taken = new Set(picked.map(q => q.id))
    picked = picked.concat(spread(usable.filter(q => !taken.has(q.id)), count - picked.length))
  }
  return picked.slice(0, count)
}

// ── Per-user browser storage: saved sets + print history ─────────────────────
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch { return d } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true } catch { return false } },
}
const who = u => u?.username || u?.name || 'me'
export const libraryKey = u => `gnsi_studio_library_${who(u)}`
export const historyKey = u => `gnsi_studio_history_${who(u)}`
export const brandKey = u => `gnsi_studio_brand_${who(u)}`

export const loadLibrary = u => store.get(libraryKey(u), [])
export const saveLibrary = (u, list) => store.set(libraryKey(u), list)
export const loadHistory = u => store.get(historyKey(u), [])
export function pushHistory(u, entry) {
  const list = [{ ...entry, id: `h${Date.now()}`, at: new Date().toISOString() }, ...loadHistory(u)].slice(0, 15)
  store.set(historyKey(u), list)
  return list
}
export const loadBrand = u => store.get(brandKey(u), null)
export const saveBrand = (u, b) => store.set(brandKey(u), b)

export const newSetId = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

// ── Sharing a set as a file ──────────────────────────────────────────────────
export const SET_FORMAT = 'gnsi-material-set'
export function exportSet(set) {
  return JSON.stringify({ format: SET_FORMAT, version: 1, name: set.name, design: set.design, options: set.options, tray: set.tray, exportedAt: new Date().toISOString() }, null, 1)
}
// Validates a shared file and returns a library entry (or throws).
export function importSet(text) {
  let j
  try { j = JSON.parse(text) } catch { throw new Error('Not a valid set file') }
  if (j?.format !== SET_FORMAT || !Array.isArray(j.tray)) throw new Error('This file is not a GNSI material set')
  const tray = j.tray.filter(t => t && (t.kind === 'q' || t.kind === 'm') && t.row && t.id != null).map(t => ({ kind: t.kind, id: t.id, row: t.row }))
  return { id: newSetId(), name: String(j.name || 'Imported set').slice(0, 80), design: j.design || 'worksheet', options: j.options || {}, tray, savedAt: new Date().toISOString(), imported: true }
}

// ── WhatsApp text & CSV ──────────────────────────────────────────────────────
export function whatsappText(tray, { title = '', withAnswers = true } = {}) {
  const lines = []
  if (title) lines.push(`*${title}*`, '')
  let n = 0
  const answers = []
  for (const it of tray) {
    if (it.kind === 'q') {
      const q = it.row; n++
      lines.push(`*${n}.* ${q.question}`)
      for (const k of ['a', 'b', 'c', 'd']) if (q[`option_${k}`]) lines.push(`   (${k.toUpperCase()}) ${q[`option_${k}`]}`)
      lines.push('')
      answers.push(`${n}-${q.correct_option || '?'}`)
    } else {
      const m = it.row
      lines.push(`📘 *${m.title}*${m.description ? `\n${m.description}` : ''}${m.file_url ? `\n${m.file_url}` : ''}`, '')
    }
  }
  if (withAnswers && answers.length) lines.push(`_Answers:_ ${answers.join(', ')}`)
  lines.push('', '— GNSI')
  return lines.join('\n')
}

export function trayCSV(tray) {
  const q = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  const head = ['#', 'Type', 'Question / title', 'A', 'B', 'C', 'D', 'Answer', 'Course', 'Subject', 'Chapter', 'Difficulty', 'Link / notes']
  const rows = tray.map((it, i) => {
    const r = it.row
    return it.kind === 'q'
      ? [i + 1, 'Question', r.question, r.option_a, r.option_b, r.option_c, r.option_d, r.correct_option, r.course, r.subject, r.chapter, r.difficulty, '']
      : [i + 1, 'Material', r.title, '', '', '', '', '', r.course, r.subject, r.chapter, '', r.file_url || r.description || '']
  })
  return '﻿' + [head, ...rows].map(r => r.map(q).join(',')).join('\n')
}

// ── Logo: shrink an uploaded image to a small data URL for print headers ─────
export function resizeLogo(file, max = 200) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return reject(new Error('Logo must be PNG, JPG or WebP'))
    const img = new Image()
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(img.src)
      resolve(c.toDataURL('image/png'))
    }
    img.onerror = () => reject(new Error('Could not read the image'))
    img.src = URL.createObjectURL(file)
  })
}
