// Combined paper for verification — every subject of a test in ONE document, built from what the setters uploaded.
// Pure functions (unit-tested); the builder passes in its own escaper / maths renderer.
//
// Who may build it: admins only (it holds every subject's answers). Staff keep the normal per-section view.

export const canBuildCombined = ({ isAdmin }) => !!isAdmin
export const testsAllowed = ({ isAdmin, testNos }) => (isAdmin ? [...testNos] : [])

const CSS = `@page{size:A4;margin:14mm}body{font-family:Arial,Helvetica,sans-serif;color:#111827;font-size:12.5px;line-height:1.45}
h1{font-size:19px;margin:0 0 2px;color:#132a4f}h2{font-size:15px;margin:0;color:#132a4f}.sub{color:#555;font-size:11.5px;margin-bottom:10px}
.test{page-break-before:always}.test:first-of-type{page-break-before:auto}
.hd{border-bottom:3px double #132a4f;padding-bottom:6px;margin:0 0 8px}
table{width:100%;border-collapse:collapse;margin:6px 0 10px}td,th{border:1px solid #999;padding:3px 6px;text-align:left;vertical-align:top;font-size:11.5px}th{background:#eef1f6}
.sec{background:#eef1f6;border:1px solid #c9d1de;padding:4px 8px;font-weight:700;margin:12px 0 6px}
.q{margin:0 0 8px;page-break-inside:avoid}.o{margin-left:18px}.o span{display:block}.ok{font-weight:700;color:#0a7a3d}
.exp{margin-left:18px;color:#444;font-size:11.5px}.m{color:#777}.pass{border:1px solid #ddd;padding:5px 8px;margin:6px 0;font-size:12px}
.warn{background:#fff6dc;border:1px solid #e9d9b0;padding:5px 9px;margin:6px 0;font-size:12px}.bad{color:#b42318;font-weight:700}.good{color:#0a7a3d;font-weight:700}
.empty{color:#8a93a6;font-style:italic;border:1px dashed #c9cfda;padding:5px;margin:4px 0}.conf{margin-top:12px;font-size:10.5px;color:#a00;text-align:center}`

// test: { id, date, sections: [{label, q, from, items, setters, uploaders, verifier, signoff:{verified_by,verified_at}|null, openNotes}], checks: [{ok,text}] }
export function combinedHtml({ inst = '', title = 'Combined paper', tests = [], preparedBy = '', preparedAt = '', esc, math = x => x, extraCss = '' }) {
  const e = esc || (s => String(s ?? ''))
  const body = tests.map(t => {
    const secs = t.sections || []
    const need = secs.reduce((a, s) => a + s.q, 0), have = secs.reduce((a, s) => a + Math.min(s.items.length, s.q), 0)
    const unverified = secs.filter(s => !s.signoff).length
    const summary = `<table><tr><th>Subject</th><th>Q no.</th><th>Uploaded</th><th>Setter(s)</th><th>Uploaded by</th><th>Verifier</th><th>Status</th></tr>${secs.map(s => `<tr><td>${e(s.label)}</td><td>${s.from}–${s.from + s.q - 1}</td><td class="${s.items.length >= s.q ? 'good' : 'bad'}">${s.items.length} / ${s.q}</td><td>${e((s.setters || []).join(', ') || '—')}</td><td>${e((s.uploaders || []).join(', ') || '—')}</td><td>${e(s.verifier || '—')}</td><td>${s.signoff ? `<span class="good">Verified</span> by ${e(s.signoff.verified_by || '')}` : '<span class="bad">Not verified</span>'}${s.openNotes ? ` · <span class="bad">${s.openNotes} open note(s)</span>` : ''}</td></tr>`).join('')}</table>`
    const issues = (t.checks || []).filter(c => !c.ok)
    const issueHtml = issues.length ? `<div class="warn"><b>Fix before the test:</b><br>${issues.map(c => '• ' + e(c.text)).join('<br>')}</div>` : '<div class="warn good">All paper health checks pass.</div>'
    const qs = secs.map(s => `<div class="sec">${e(s.label)} · Q${s.from}–Q${s.from + s.q - 1}</div>${s.items.length ? '' : '<div class="empty">No questions uploaded yet.</div>'}${s.items.map((q, i) => {
      const prev = s.items[i - 1]
      const pass = q.passage && !(prev && prev.passage === q.passage) ? `<div class="pass">${e(q.passage)}</div>` : ''
      const opts = ['A', 'B', 'C', 'D'].map(k => `<span class="${q.answer === k ? 'ok' : ''}">(${k}) ${math(q['option_' + k.toLowerCase()] || '')}${q.answer === k ? ' ✔' : ''}</span>`).join('')
      return `${pass}<div class="q"><b>${q.no}.</b> ${math(q.question || '')}${q.image_data && /^data:image\//.test(q.image_data) ? `<div><img src="${q.image_data}" alt="Figure" style="max-width:60%"></div>` : ''}<div class="o">${opts}</div><div class="exp"><b>Ans: ${e(q.answer || '?')}</b>${q.explanation ? ' — ' + math(q.explanation) : ' — <span class="bad">no explanation</span>'}${q.topic || q.difficulty ? ` <span class="m">[${e([q.topic, q.difficulty].filter(Boolean).join(' · '))}]</span>` : ''}</div></div>`
    }).join('')}`).join('')
    return `<div class="test"><div class="hd"><h2>${e(t.id)}${t.date ? ' · ' + e(t.date) : ''} — all subjects</h2><div class="sub">${have} of ${need} questions uploaded · ${unverified ? `<span class="bad">${unverified} of ${secs.length} section(s) not verified</span>` : '<span class="good">every section verified</span>'}</div></div>${summary}${issueHtml}${qs}</div>`
  }).join('')
  return `<h1>${e(inst)}</h1><div class="sub">${e(title)} — for verification${preparedBy ? ' · prepared by ' + e(preparedBy) : ''}${preparedAt ? ' · ' + e(preparedAt) : ''}</div><style>${CSS}${extraCss}</style>${body}<div class="conf">CONFIDENTIAL — contains answers. For admins only. Do not share.</div>`
}
