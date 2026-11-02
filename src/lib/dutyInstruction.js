// dutyInstruction.js — the instruction that goes with a duty assignment (pure, no React):
//   where  (venue)            — the room / place the person is assigned to
//   why    (reason)           — what the duty is for
//   when   (days + from / to) — the time slot
//   text   (instruction)      — anything else the person must do
// Used on the group card, the Duty Desk, the printed duty sheet and the message sent to the person.

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const emptyInstruction = () => ({ venue: '', reason: '', days: [], from: '', to: '', instruction: '' });

// days are kept as an array in the app and as "Mon,Tue" text in the database
export const daysFromText = (t) => (Array.isArray(t) ? t : String(t || '').split(',').map((d) => d.trim()).filter((d) => DAYS.includes(d)));
export const daysToText = (a) => DAYS.filter((d) => (a || []).includes(d)).join(',');

// Keep only the instruction fields of an object (a mentor, a custom group or a database row).
export function pickInstruction(o) {
  const x = o || {};
  return {
    venue: String(x.venue || '').trim(), reason: String(x.reason || '').trim(), days: daysFromText(x.days),
    from: String(x.from ?? x.time_from ?? '').trim(), to: String(x.to ?? x.time_to ?? '').trim(), instruction: String(x.instruction || '').trim(),
  };
}
export const hasInstruction = (d) => { const p = pickInstruction(d); return !!(p.venue || p.reason || p.days.length || p.from || p.to || p.instruction); };

const t12 = (t) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t || ''));
  if (!m) return '';
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h >= 12 ? 'pm' : 'am'}`;
};
// "Mon, Wed · 5:00 pm–6:00 pm"  ('' when no slot is set)
export function slotText(d) {
  const p = pickInstruction(d);
  const days = DAYS.filter((x) => p.days.includes(x)).join(', ');
  const time = p.from && p.to ? `${t12(p.from)}–${t12(p.to)}` : (p.from ? `from ${t12(p.from)}` : (p.to ? `until ${t12(p.to)}` : ''));
  return [days, time].filter(Boolean).join(' · ');
}

const mins = (t) => { const m = /^(\d{1,2}):(\d{2})/.exec(String(t || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
// Duties of one person whose slots overlap on the same day.
// sections: [{ label, instruction: {days, from, to} }] → [{ a, b, day }]
export function slotClashes(sections) {
  const out = [];
  for (let i = 0; i < sections.length; i++) for (let j = i + 1; j < sections.length; j++) {
    const a = pickInstruction(sections[i].instruction), b = pickInstruction(sections[j].instruction);
    const a0 = mins(a.from), a1 = mins(a.to), b0 = mins(b.from), b1 = mins(b.to);
    if ([a0, a1, b0, b1].some((v) => v === null) || a1 <= a0 || b1 <= b0) continue;
    if (!(a0 < b1 && b0 < a1)) continue;
    DAYS.filter((d) => a.days.includes(d) && b.days.includes(d)).forEach((day) => out.push({ a: sections[i].label, b: sections[j].label, day }));
  }
  return out;
}

// The message for one person, ready to paste into WhatsApp / print.
export function instructionMessage(person, series) {
  const lines = [`Dear ${person.name},`, '', `You are on duty for self-study (${series}):`];
  person.sections.forEach((s, i) => {
    const d = pickInstruction(s.instruction);
    lines.push('', `${i + 1}. ${s.label}${s.subject && s.subject !== 'Overall marks' ? ` — ${s.subject}` : ''} (${s.students.length} student${s.students.length === 1 ? '' : 's'})`);
    if (d.venue) lines.push(`   Where: ${d.venue}`);
    if (d.reason) lines.push(`   Why: ${d.reason}`);
    if (slotText(d)) lines.push(`   When: ${slotText(d)}`);
    if (d.instruction) lines.push(`   Instruction: ${d.instruction}`);
  });
  lines.push('', 'Thank you.');
  return lines.join('\n');
}
