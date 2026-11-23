// SetPrintDialog.jsx — print one Practice bank set (paper or answer key) with the shared print options:
// 2 columns, space saver, 2 copies per sheet, student lines, answer-sheet bubbles, and a page / sheet count.
import { useState, useEffect, useMemo } from 'react'
import { PX } from './premiumUI'
import { supabase } from './supabase'
import { fetchAll } from './lib/missionSainikQuestions'
import { materialDocHtml, PRINT_DEFAULTS } from './lib/materialMarkup'
import { setMathStacked } from './lib/mathText'
import { creatorOf } from './lib/staffLookup'
import { questionsToNotes } from './lib/questionNotes'
import { PrintDialog, CSS_ALL } from './MissionSainikMaterial'

const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* private mode */ } }

export default function SetPrintDialog({ subject, setNo, instName, staff = [], userName = '', isMobile, onClose, setMsg }) {
  const [rows, setRows] = useState(null), [err, setErr] = useState('')
  const [key, setKey] = useState(false)   // false = question paper, true = answer key
  const [popts, setPopts] = useState(() => ({ ...PRINT_DEFAULTS, ...load('msm-print', {}) }))
  useEffect(() => { save('msm-print', popts) }, [popts])
  useEffect(() => {
    let live = true
    ;(async () => {
      const q = () => supabase.from('mission_sainik_questions').select('*').eq('series', 'practice').eq('section', subject).eq('test_no', setNo)
      let { data, error } = await fetchAll(() => q().is('deleted_at', null).order('id'))
      if (error) ({ data, error } = await fetchAll(() => q().order('id')))
      if (!live) return
      if (error) setErr(error.message || 'Could not load this set'); else setRows(data || [])
    })()
    return () => { live = false }
  }, [subject, setNo])
  const me = useMemo(() => creatorOf(staff, userName), [staff, userName])
  const title = `${subject} — Practice PB-${String(setNo).padStart(2, '0')} (for PMT-${String(setNo).padStart(2, '0')})`   // one practice set per Pre Mock test
  const doc = useMemo(() => {
    if (!rows) return null
    if (key) return { title: title + ' — Answer key', subject, uploaded_by: userName, body: `| Q | Answer | Level | Topic |\n|---|---|---|---|\n${rows.map((q, i) => `| ${i + 1} | ${q.answer} | ${q.difficulty || '—'} | ${(q.topic || '').trim() || '—'} |`).join('\n')}\n\n---\n\n${rows.filter(q => q.explanation).map(q => `**Q${rows.indexOf(q) + 1}.** ${String(q.explanation).replace(/\s*\n\s*/g, ' ')}`).join('\n\n')}` }
    return { title, subject, uploaded_by: userName, body: `**Questions:** ${rows.length}\n\n` + questionsToNotes(rows, { answers: false }) }
  }, [rows, key, title, subject, userName])
  const optsFor = o => ({ ...o, institute: instName, author: me })
  const doPrint = (m, o) => { const w = window.open('', '_blank'); if (!w) return setMsg?.('❌ Allow pop-ups to print'); w.document.write(materialDocHtml(m, { ...optsFor(o), auto: true }, CSS_ALL)); w.document.close() }
  const doWord = (m, o) => {
    setMathStacked(false); let html; try { html = materialDocHtml(m, { ...optsFor(o), columns: 1, nup: 1 }, CSS_ALL) } finally { setMathStacked(true) }
    const url = URL.createObjectURL(new Blob(['﻿' + html], { type: 'application/msword' }))
    const a = document.createElement('a'); a.href = url; a.download = m.title.replace(/[^\w-]+/g, '_') + '.doc'; a.click(); URL.revokeObjectURL(url)
  }

  if (err || (rows && !rows.length)) {
    return (
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(14,32,63,.6)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
        <div role="dialog" aria-modal="true" aria-label="Print set" onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, padding: 24, maxWidth: 420, textAlign: 'center' }}>
          <div style={{ fontSize: 36 }}>📭</div>
          <div style={{ fontWeight: 800, margin: '6px 0' }}>{err ? '❌ ' + err : `${title} has no questions yet`}</div>
          <div style={{ fontSize: 13, color: PX.sub, marginBottom: 12 }}>Add questions to this set first, then print it.</div>
          <button className="px-btn gold" onClick={onClose}>Close</button>
        </div>
      </div>
    )
  }
  if (!doc) return <div role="status" style={{ position: 'fixed', inset: 0, background: 'rgba(14,32,63,.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>Loading {title}…</div>
  return (
    <>
      <PrintDialog m={doc} opts={popts} setOpts={setPopts} creator={me} onClose={onClose} onPrint={o => doPrint(doc, o)} onWord={o => doWord(doc, o)} isMobile={isMobile} instName={instName} />
      <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', top: 14, zIndex: 1200, display: 'flex', gap: 4, padding: 3, background: '#fff', borderRadius: 14, boxShadow: '0 8px 24px rgba(10,20,40,.35)' }} role="tablist" aria-label="What to print">
        {[[false, '📄 Question paper'], [true, '🔑 Answer key']].map(([k, l]) => <button key={l} type="button" role="tab" aria-selected={key === k} onClick={() => setKey(k)} style={{ padding: '8px 14px', borderRadius: 11, border: 'none', background: key === k ? '#132a4f' : 'transparent', color: key === k ? '#fff' : '#132a4f', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>)}
      </div>
    </>
  )
}
