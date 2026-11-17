import { figureLine } from './materialMarkup.js'
import { mathPlain } from './mathText.js'

// Questions from the bank → the notes text format (renders as a question, an options grid and an answer pill).
export function questionsToNotes(rows, { answers, explain, start = 1 }) {
  let lastPassage = ''
  return rows.map((q, i) => {
    const out = []
    if (q.passage && q.passage !== lastPassage) out.push(`> Note: Passage — ${String(q.passage).replace(/\s*\n\s*/g, ' ')}`, '')
    lastPassage = q.passage || ''
    if (q.image_data) out.push(figureLine(q.image_data, 'Figure'))
    out.push(`Q${start + i}. ${String(q.question).replace(/\s*\n\s*/g, ' ')}`)
    ;['A', 'B', 'C', 'D'].forEach(k => out.push(`${k}) ${String(q['option_' + k.toLowerCase()]).replace(/\s*\n\s*/g, ' ')}`))
    if (answers) out.push(`Answer: ${q.answer}) ${mathPlain(q['option_' + String(q.answer).toLowerCase()]).replace(/\n/g, ' ')}`.replace(/\) IMG$/, ')'))
    if (explain && q.explanation) out.push('', `> Note: ${String(q.explanation).replace(/\s*\n\s*/g, ' ')}`)
    return out.join('\n')
  }).join('\n\n')
}

