// DutyInstruction.jsx — the instruction that goes with a duty assignment: where, why, when (days + time slot) and
// what to do. One form, used on the group card, in the Duty Desk and when building a manual group.
import { DAYS, pickInstruction, slotText } from './lib/dutyInstruction';

const field = { border: '1px solid #d9d2c2', borderRadius: 10, padding: '6px 9px', fontSize: 13, fontFamily: 'inherit', background: '#fff', color: '#0f1b2e', boxSizing: 'border-box', minWidth: 0 };
const lab = { display: 'block', fontSize: 10.5, fontWeight: 800, color: '#5d6b82', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 3 };
const dayChip = (on) => ({ padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${on ? '#132a4f' : '#d9d2c2'}`, background: on ? '#132a4f' : '#fff', color: on ? '#fff' : '#2e3b52' });

// value: { venue, reason, days, from, to, instruction }; onChange(next)
export function InstructionForm({ value, onChange, who = 'this person' }) {
  const v = pickInstruction(value);
  const set = (patch) => onChange({ ...v, ...patch });
  const toggle = (d) => set({ days: v.days.includes(d) ? v.days.filter((x) => x !== d) : [...v.days, d] });
  const bad = v.from && v.to && v.to <= v.from;
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <label style={{ flex: '1 1 200px' }}><span style={lab}>📍 Where — room / place</span>
          <input style={{ ...field, width: '100%' }} value={v.venue} onChange={(e) => set({ venue: e.target.value })} placeholder="e.g. Study hall, Room 4" aria-label="Where is the duty" /></label>
        <label style={{ flex: '1 1 200px' }}><span style={lab}>🎯 Why — reason for the duty</span>
          <input style={{ ...field, width: '100%' }} value={v.reason} onChange={(e) => set({ reason: e.target.value })} placeholder="e.g. Maths revision for the weakest group" aria-label="Why is the duty" /></label>
      </div>
      <div>
        <span style={lab}>🕔 When — days and time slot</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {DAYS.map((d) => <button key={d} type="button" style={dayChip(v.days.includes(d))} onClick={() => toggle(d)} aria-pressed={v.days.includes(d)}>{d}</button>)}
          <input type="time" style={field} value={v.from} onChange={(e) => set({ from: e.target.value })} aria-label="Time slot from" />
          <span style={{ color: '#5d6b82' }}>to</span>
          <input type="time" style={field} value={v.to} onChange={(e) => set({ to: e.target.value })} aria-label="Time slot to" />
        </div>
        {bad ? <div role="alert" style={{ fontSize: 12, color: '#b42318', marginTop: 4 }}>The end time must be after the start time.</div> : null}
      </div>
      <label><span style={lab}>📋 Instruction — what {who} must do</span>
        <textarea style={{ ...field, width: '100%', minHeight: 64, resize: 'vertical' }} value={v.instruction} onChange={(e) => set({ instruction: e.target.value })} placeholder="e.g. Take attendance, give the Maths worksheet, report absentees to the House Master." aria-label="Instruction" /></label>
    </div>
  );
}

// A short, readable line / block for an instruction. compact: chips only.
export function InstructionSummary({ value, compact }) {
  const v = pickInstruction(value), slot = slotText(v);
  if (!(v.venue || v.reason || slot || v.instruction)) return null;
  const chip = (txt, bg, fg) => <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: bg, color: fg, marginRight: 6, marginBottom: 3 }}>{txt}</span>;
  return (
    <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>
      <div>
        {v.venue ? chip(`📍 ${v.venue}`, '#eef2f9', '#1e3a6e') : null}
        {slot ? chip(`🕔 ${slot}`, '#fef3c7', '#92400e') : null}
        {v.reason ? chip(`🎯 ${v.reason}`, '#ecfdf5', '#166534') : null}
      </div>
      {v.instruction && !compact ? <div style={{ color: '#2e3b52', marginTop: 2 }}>📋 {v.instruction}</div> : null}
    </div>
  );
}
