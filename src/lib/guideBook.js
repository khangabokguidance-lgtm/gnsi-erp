// guideBook.js — turns the guide data (front matter + module guides) into one
// document, as HTML (screen / print / Word) or Markdown. Pure functions, no imports
// from the app, so the same code builds the in-app book and docs/*.md.

const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// chapters: [{ group, title, guides: [guide…] }] in reading order.
export function orderChapters(guides, order, groupTitles) {
  const by = Object.fromEntries(guides.map(g => [g.id, g]))
  const seen = new Set()
  const out = order.map(([group, ids]) => {
    const list = ids.map(id => by[id]).filter(Boolean)
    list.forEach(g => seen.add(g.id))
    return { group, title: groupTitles[group] || group, guides: list }
  }).filter(c => c.guides.length)
  const rest = guides.filter(g => !seen.has(g.id))
  if (rest.length) out.push({ group: 'OTHER', title: 'Other modules', guides: rest })
  return out
}

function blockHtml(b) {
  let h = ''
  if (b.h) h += `<h3>${esc(b.h)}</h3>`
  ;(b.p || []).forEach(x => { h += `<p>${esc(x)}</p>` })
  if (b.ul) h += `<ul>${b.ul.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`
  if (b.ol) h += `<ol>${b.ol.map(x => `<li>${esc(x)}</li>`).join('')}</ol>`
  if (b.table) h += `<table><thead><tr>${b.table.head.map(x => `<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${b.table.rows.map(r => `<tr>${r.map((c, i) => i === 0 ? `<td class="k">${esc(c)}</td>` : `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
  if (b.note) h += `<div class="note">${esc(b.note)}</div>`
  return h
}

function guideHtml(g, n) {
  let h = `<section class="chapter" id="m-${slug(g.id)}"><h3 class="ch">${n}. ${esc(g.title)}</h3>`
  h += `<div class="meta">Used by: ${esc((g.roles || []).join(', ') || '—')}</div><p>${esc(g.summary)}</p>`
  if (g.before?.length) h += `<h4>Before you start</h4><ul>${g.before.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`
  if (g.tabs?.length) h += `<h4>Screens in this module</h4><table><tbody>${g.tabs.map(t => `<tr><td class="k">${esc(t.name)}</td><td>${esc(t.what)}</td></tr>`).join('')}</tbody></table>`
  if (g.steps?.length) h += `<h4>How to…</h4>` + g.steps.map((s, i) => `<div class="step"><div class="sh">${i + 1}. ${esc(s.title)}</div><ol>${(s.body || []).map(x => `<li>${esc(x)}</li>`).join('')}</ol>${s.tip ? `<div class="tip">💡 ${esc(s.tip)}</div>` : ''}</div>`).join('')
  if (g.tips?.length) h += `<h4>Good habits</h4><ul>${g.tips.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`
  if (g.mistakes?.length) h += `<h4>Common mistakes</h4><ul>${g.mistakes.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`
  if (g.faq?.length) h += `<h4>Questions people ask</h4>${g.faq.map(f => `<p><b>${esc(f.q)}</b><br>${esc(f.a)}</p>`).join('')}`
  return h + '</section>'
}

export const BOOK_CSS = `
.book{font:14px/1.6 system-ui,'Segoe UI',sans-serif;color:#14213d;max-width:860px;margin:0 auto}
.book h1{font-size:30px;color:#1e3a6e;margin:0 0 4px}.book .sub{color:#a7771f;font-weight:700;margin-bottom:6px}
.book h2{font-size:22px;color:#1e3a6e;border-bottom:3px solid #c9a24b;padding-bottom:4px;margin:38px 0 10px}
.book h3{font-size:16px;color:#1e3a6e;margin:20px 0 6px}.book h3.ch{font-size:18px;margin-top:26px;border-left:4px solid #c9a24b;padding-left:9px}
.book h4{font-size:13.5px;color:#a7771f;margin:14px 0 4px;text-transform:uppercase;letter-spacing:.05em}
.book .meta{color:#64748b;font-size:12px;margin-bottom:4px}.book ul,.book ol{margin:4px 0 8px 22px;padding:0}.book li{margin:2px 0}
.book table{border-collapse:collapse;width:100%;margin:6px 0 10px}.book td,.book th{border:1px solid #e8e3d8;padding:6px 9px;vertical-align:top;text-align:left}
.book th{background:#f3f0e8}.book td.k{font-weight:700;width:30%;color:#1e3a6e}
.book .note{background:#eef3fb;border-left:3px solid #1e3a6e;padding:7px 11px;margin:8px 0}.book .tip{background:#fffbeb;border-left:3px solid #f59e0b;padding:5px 10px;margin:4px 0}
.book .step{margin:8px 0;padding:8px 12px;border:1px solid #eee7d6;border-radius:8px;break-inside:avoid}.book .sh{font-weight:800;color:#1e3a6e}
.book .toc a{color:#1e3a6e;text-decoration:none}.book .toc li{margin:1px 0}.book .cover{text-align:center;padding:60px 0 40px;border-bottom:3px solid #c9a24b;margin-bottom:24px}
.book .part{break-before:page}@media print{.book h2{break-after:avoid}.book section{break-inside:auto}}`

export function bookHtml({ title, subtitle, parts, appendix, chapters, generated }) {
  let n = 0
  const toc = [
    ...parts.map(p => `<li><a href="#${p.id}">${esc(p.title)}</a></li>`),
    `<li><a href="#modules">Part 4 — Module guides</a><ul>${chapters.map(c => `<li>${esc(c.title)}: ${c.guides.map(g => `<a href="#m-${slug(g.id)}">${esc(g.title)}</a>`).join(', ')}</li>`).join('')}</ul></li>`,
    ...appendix.map(p => `<li><a href="#${p.id}">${esc(p.title)}</a></li>`),
  ].join('')
  const body = parts.map(p => `<h2 class="part" id="${p.id}">${esc(p.title)}</h2>${p.blocks.map(blockHtml).join('')}`).join('')
    + `<h2 class="part" id="modules">Part 4 — Module guides</h2><p>One chapter per module, in the same order as the sidebar. Each lists the screens, then step-by-step instructions for the main tasks.</p>`
    + chapters.map(c => `<h3 style="font-size:20px;margin-top:30px">${esc(c.title)}</h3>${c.guides.map(g => guideHtml(g, ++n)).join('')}`).join('')
    + appendix.map(p => `<h2 class="part" id="${p.id}">${esc(p.title)}</h2>${p.blocks.map(blockHtml).join('')}`).join('')
  return `<div class="book"><div class="cover"><h1>${esc(title)}</h1><div class="sub">${esc(subtitle)}</div><div class="meta">${esc(generated || '')}</div></div>
    <h2 id="toc" style="margin-top:0">Contents</h2><ul class="toc">${toc}</ul>${body}</div>`
}

const mdCell = v => String(v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
function blockMd(b) {
  let m = ''
  if (b.h) m += `### ${b.h}\n\n`
  ;(b.p || []).forEach(x => { m += `${x}\n\n` })
  if (b.ul) m += b.ul.map(x => `- ${x}`).join('\n') + '\n\n'
  if (b.ol) m += b.ol.map((x, i) => `${i + 1}. ${x}`).join('\n') + '\n\n'
  if (b.table) m += `| ${b.table.head.map(mdCell).join(' | ')} |\n|${b.table.head.map(() => '---').join('|')}|\n${b.table.rows.map(r => `| ${r.map(mdCell).join(' | ')} |`).join('\n')}\n\n`
  if (b.note) m += `> ${b.note}\n\n`
  return m
}
function guideMd(g, n) {
  let m = `### ${n}. ${g.title}\n\n_Used by: ${(g.roles || []).join(', ') || '—'}_\n\n${g.summary}\n\n`
  if (g.before?.length) m += `**Before you start**\n\n${g.before.map(x => `- ${x}`).join('\n')}\n\n`
  if (g.tabs?.length) m += `**Screens in this module**\n\n| Screen | What it is for |\n|---|---|\n${g.tabs.map(t => `| ${mdCell(t.name)} | ${mdCell(t.what)} |`).join('\n')}\n\n`
  if (g.steps?.length) m += `**How to…**\n\n` + g.steps.map((s, i) => `#### ${n}.${i + 1} ${s.title}\n\n${(s.body || []).map((x, j) => `${j + 1}. ${x}`).join('\n')}\n\n${s.tip ? `> 💡 ${s.tip}\n\n` : ''}`).join('')
  if (g.tips?.length) m += `**Good habits**\n\n${g.tips.map(x => `- ${x}`).join('\n')}\n\n`
  if (g.mistakes?.length) m += `**Common mistakes**\n\n${g.mistakes.map(x => `- ${x}`).join('\n')}\n\n`
  if (g.faq?.length) m += `**Questions people ask**\n\n${g.faq.map(f => `- **${f.q}** ${f.a}`).join('\n')}\n\n`
  return m
}
export function bookMarkdown({ title, subtitle, parts, appendix, chapters, generated }) {
  let n = 0
  let m = `# ${title}\n\n_${subtitle}_\n\n${generated ? `${generated}\n\n` : ''}`
  m += `## Contents\n\n${parts.map(p => `- ${p.title}`).join('\n')}\n- Part 4 — Module guides\n${chapters.map(c => `  - ${c.title}: ${c.guides.map(g => g.title).join(', ')}`).join('\n')}\n${appendix.map(p => `- ${p.title}`).join('\n')}\n\n`
  m += parts.map(p => `## ${p.title}\n\n${p.blocks.map(blockMd).join('')}`).join('')
  m += `## Part 4 — Module guides\n\n` + chapters.map(c => `### ${c.title}\n\n${c.guides.map(g => guideMd(g, ++n)).join('')}`).join('')
  m += appendix.map(p => `## ${p.title}\n\n${p.blocks.map(blockMd).join('')}`).join('')
  return m
}
