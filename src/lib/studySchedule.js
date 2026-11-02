// studySchedule.js — the study schedule: a time slot for each subject and a room for each group number (pure).
//
//   Passage  6:00–7:00 am     Group 1 → Room 1
//   Maths    3:15–4:45 pm     Group 2 → Room 2   … Group 7 → Room 7
//   EVS      5:30–7:00 pm
//
// These are the defaults. An admin can change them (saved per series); a duty assignment can still override
// its own room / time. The schedule fills in whatever an assignment leaves empty, so changing the schedule
// moves every group that has not been set by hand.
import { pickInstruction, emptyInstruction } from './dutyInstruction.js';

export const DEFAULT_SCHEDULE = {
  subjects: {
    Passage: { from: '06:00', to: '07:00', days: [] },
    Mathematics: { from: '15:15', to: '16:45', days: [] },
    EVS: { from: '17:30', to: '19:00', days: [] },
  },
  rooms: { 1: 'Room 1', 2: 'Room 2', 3: 'Room 3', 4: 'Room 4', 5: 'Room 5', 6: 'Room 6', 7: 'Room 7' },
};

// A saved entry always wins over the default for the same subject / group (saving an empty time clears it).
export function mergeSchedule(saved) {
  const subjects = { ...DEFAULT_SCHEDULE.subjects };
  Object.entries(saved?.subjects || {}).forEach(([k, v]) => { subjects[k] = { from: v?.from || '', to: v?.to || '', days: Array.isArray(v?.days) ? v.days : [] }; });
  const rooms = { ...DEFAULT_SCHEDULE.rooms };
  Object.entries(saved?.rooms || {}).forEach(([k, v]) => { rooms[k] = String(v ?? ''); });
  return { subjects, rooms };
}

export const slotFor = (schedule, subject) => {
  const s = schedule?.subjects?.[subject];
  return s ? { from: s.from || '', to: s.to || '', days: s.days || [] } : { from: '', to: '', days: [] };
};
export const roomFor = (schedule, group) => (group ? String(schedule?.rooms?.[group] || '').trim() : '');

// The instruction as people see it: the assignment's own room / time, and the schedule's where it has none.
// subject: a subject name, or '' / 'Overall marks' for overall marks (which has no time slot by default).
export function withSchedule(instruction, schedule, subject, group) {
  const own = pickInstruction(instruction);
  const sub = subject === 'Overall marks' ? '' : subject;
  const slot = sub ? slotFor(schedule, sub) : { from: '', to: '', days: [] };
  const ownTime = own.from || own.to;
  return {
    ...emptyInstruction(), ...own,
    venue: own.venue || roomFor(schedule, group),
    from: ownTime ? own.from : slot.from, to: ownTime ? own.to : slot.to,
    days: own.days.length || ownTime ? own.days : slot.days,
  };
}

// When saving an instruction, drop what only repeats the schedule — so a later change of the schedule still reaches this group.
export function stripScheduleDefaults(details, schedule, subject, group) {
  const d = pickInstruction(details);
  const sched = withSchedule(emptyInstruction(), schedule, subject, group);
  const sameTime = d.from === sched.from && d.to === sched.to && JSON.stringify(d.days) === JSON.stringify(sched.days);
  return { ...d, venue: d.venue === sched.venue ? '' : d.venue, ...(sameTime ? { from: '', to: '', days: [] } : {}) };
}
