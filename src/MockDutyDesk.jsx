// MockDutyDesk.jsx — the Duty Desk of the Self-Study Groups.
//   • every duty person (House Master / Mistress, teacher) with the groups and students they look after, per subject
//   • the duty teacher — or an admin — can REMOVE a student or TRANSFER them to another group (restorable)
//   • groups built from a MANUAL CHOICE of students, with a name, a subject and the person on duty
//   • premium A4 duty sheets (one page set per person) and Excel
// Logic lives in lib/mockTestDuty.js; saving is done by GroupsView (MockTestAnalyzer.jsx).
import { useMemo, useState } from 'react';
import { printDocument, letterhead } from './lib/mockTestReports';
import { studentAverages, GROUP_META } from './lib/mockTestGroups';
import { removedList, mayAct, sameName, initials } from './lib/mockTestDuty';
import { pickInstruction, slotText, slotClashes, instructionMessage, hasInstruction, emptyInstruction } from './lib/dutyInstruction';
import { InstructionForm, InstructionSummary } from './DutyInstruction';

const NAVY = '#132a4f';
const GOLD = '#b8923a';
const REASONS = ['Transferred to another group', 'Left the institute', 'Not attending self-study', 'Other'];
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fx = (n) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : String(Math.round(n * 10) / 10));
const HUES = [212, 262, 330, 24, 160, 190, 45, 290];
const hue = (name) => HUES[[...String(name || '')].reduce((t, c) => t + c.charCodeAt(0), 0) % HUES.length];
const scoreColor = (p) => (p === null || p === undefined ? '#94a3b8' : p >= 75 ? '#16a34a' : p >= 60 ? '#65a30d' : p >= 40 ? '#ca8a04' : '#dc2626');
const toggleIn = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

const CSS = `
.mdd { --navy: ${NAVY}; --gold: ${GOLD}; font-family: inherit; }
.mdd-hero { background: linear-gradient(135deg, #0f2347 0%, #1e3a6e 58%, #2b4f8f 100%); color: #fff; border-radius: 20px; padding: 18px 20px; position: relative; overflow: hidden; box-shadow: 0 14px 34px -18px rgba(19,42,79,.7); margin-bottom: 14px; }
.mdd-hero::after { content: ''; position: absolute; right: -40px; top: -40px; width: 180px; height: 180px; border-radius: 50%; background: radial-gradient(circle, rgba(226,197,126,.35), transparent 70%); }
.mdd-hero h3 { margin: 0; font-family: 'Fraunces', Georgia, serif; font-size: 21px; letter-spacing: .2px; }
.mdd-hero p { margin: 4px 0 0; font-size: 12.5px; color: #d6def0; max-width: 640px; }
.mdd-kpis { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; position: relative; z-index: 1; }
.mdd-kpi { background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.18); border-radius: 14px; padding: 8px 14px; min-width: 96px; backdrop-filter: blur(4px); }
.mdd-kpi b { display: block; font-size: 20px; line-height: 1.15; color: #f3d58a; }
.mdd-kpi small { font-size: 10.5px; text-transform: uppercase; letter-spacing: .9px; color: #cdd6ea; }
.mdd-grid { display: grid; grid-template-columns: 290px 1fr; gap: 14px; align-items: start; }
.mdd-rail { display: flex; flex-direction: column; gap: 8px; position: sticky; top: 8px; max-height: 80vh; overflow-y: auto; padding: 2px; }
.mdd-person { display: flex; gap: 11px; align-items: center; text-align: left; background: #fff; border: 1px solid #e8e3d8; border-radius: 16px; padding: 10px 12px; cursor: pointer; font-family: inherit; box-shadow: 0 2px 10px rgba(19,42,79,.05); transition: transform .12s, box-shadow .12s; }
.mdd-person:hover { transform: translateY(-1px); box-shadow: 0 8px 18px -10px rgba(19,42,79,.4); }
.mdd-person.on { border-color: var(--navy); box-shadow: 0 0 0 2px rgba(19,42,79,.14), 0 10px 22px -12px rgba(19,42,79,.55); background: linear-gradient(180deg, #fff, #f5f8fd); }
.mdd-av { flex: 0 0 auto; width: 40px; height: 40px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 14px; letter-spacing: .5px; box-shadow: inset 0 -6px 10px rgba(0,0,0,.14); }
.mdd-av.sm { width: 30px; height: 30px; font-size: 11px; }
.mdd-person b { display: block; font-size: 13.5px; color: #0f1b2e; }
.mdd-person small { display: block; font-size: 11.5px; color: #5d6b82; }
.mdd-main { min-width: 0; }
.mdd-card { background: #fff; border: 1px solid #e8e3d8; border-radius: 18px; box-shadow: 0 10px 26px -20px rgba(19,42,79,.55); margin-bottom: 14px; overflow: hidden; }
.mdd-ph { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; padding: 14px 16px; background: linear-gradient(180deg, #fbf8f1, #fff); border-bottom: 1px solid #f0ebde; }
.mdd-ph h4 { margin: 0; font-size: 17px; font-family: 'Fraunces', Georgia, serif; color: #0f1b2e; }
.mdd-sec-h { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; padding: 10px 16px; border-top: 1px solid #f1ede3; background: #fcfbf8; }
.mdd-badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 800; color: #fff; }
.mdd-row { display: flex; gap: 11px; align-items: center; padding: 8px 16px; border-top: 1px solid #f4f0e6; flex-wrap: wrap; }
.mdd-row:hover { background: #fafcff; }
.mdd-name { flex: 1 1 190px; min-width: 0; }
.mdd-name b { display: block; font-size: 13.5px; color: #0f1b2e; }
.mdd-name small { color: #5d6b82; font-size: 11.5px; }
.mdd-score { flex: 0 0 120px; }
.mdd-bar { height: 7px; border-radius: 999px; background: #eceff4; overflow: hidden; margin-top: 3px; }
.mdd-bar i { display: block; height: 100%; border-radius: 999px; }
.mdd-chip { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 11px; font-weight: 700; background: #eef2f9; color: #1e3a6e; }
.mdd-btn { padding: 8px 15px; border-radius: 12px; border: none; font-size: 13px; font-weight: 700; cursor: pointer; background: linear-gradient(180deg, #1e3a6e, #132a4f); color: #fff; font-family: inherit; box-shadow: 0 6px 14px -8px rgba(19,42,79,.8); }
.mdd-btn.gold { background: linear-gradient(180deg, #d4af58, #b8923a); color: #1b1303; box-shadow: 0 6px 14px -8px rgba(184,146,58,.9); }
.mdd-ghost { padding: 7px 12px; border-radius: 12px; border: 1px solid #d9d2c2; font-size: 12.5px; font-weight: 700; cursor: pointer; background: #fff; color: #2e3b52; font-family: inherit; }
.mdd-ghost.danger { color: #b42318; border-color: #f2b8b2; }
.mdd-ghost:disabled, .mdd-btn:disabled { opacity: .5; cursor: not-allowed; }
.mdd select, .mdd input:not([type=checkbox]) { border: 1px solid #d9d2c2; border-radius: 10px; padding: 6px 9px; font-size: 13px; font-family: inherit; background: #fff; color: #0f1b2e; box-sizing: border-box; min-width: 0; }
.mdd-pop { flex: 1 1 100%; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; background: #fff7ed; border: 1px solid #fdba74; border-radius: 12px; padding: 8px 12px; }
.mdd-empty { text-align: center; padding: 30px 16px; color: #5d6b82; }
.mdd-picker { max-height: 330px; overflow-y: auto; border: 1px solid #e8e3d8; border-radius: 14px; }
.mdd-pick { display: flex; gap: 10px; align-items: center; padding: 7px 12px; border-top: 1px solid #f4f0e6; cursor: pointer; }
.mdd-pick:first-child { border-top: 0; }
.mdd-pick.on { background: #eef6ff; }
@media screen and (max-width: 820px) {
  .mdd-grid { grid-template-columns: 1fr; }
  .mdd-rail { position: static; max-height: none; flex-direction: row; flex-wrap: wrap; }
  .mdd-person { flex: 1 1 calc(50% - 8px); min-width: 0; padding: 8px 10px; }
  .mdd-av { width: 34px; height: 34px; }
  .mdd-score { flex: 1 1 100%; }
  .mdd select, .mdd input:not([type=checkbox]) { font-size: 16px; }
}
`;

const Avatar = ({ name, sm }) => <span className={`mdd-av${sm ? ' sm' : ''}`} style={{ background: `linear-gradient(135deg, hsl(${hue(name)} 62% 46%), hsl(${hue(name)} 62% 34%))` }}>{initials(name)}</span>;

export default function MockDutyDesk({
  rows, series, institute, subjects, duties, removed, custom, dir,
  canEdit, userName, userStaffId, onRemove, onRestore, onTransfer, onSaveCustom, onDeleteCustom, onSaveInstruction, storageNote, onClose,
}) {
  const everyone = useMemo(() => [...(dir?.masters || []), ...(dir?.teachers || [])], [dir]);
  const staffIdOf = (name) => everyone.find((p) => sameName(p.name, name))?.staffId ?? null;
  const canAct = (dutyName) => mayAct({ canEdit, userName, dutyName, userStaffId, dutyStaffId: staffIdOf(dutyName) });
  const me = useMemo(() => duties.find((p) => mayAct({ canEdit: false, userName, dutyName: p.name, userStaffId, dutyStaffId: staffIdOf(p.name) })) || null, [duties, userName, userStaffId]); // eslint-disable-line react-hooks/exhaustive-deps
  const [selName, setSelName] = useState(null);
  const [q, setQ] = useState('');
  const [removing, setRemoving] = useState(null);     // { key, reason }
  const [builder, setBuilder] = useState(null);       // custom group being created / edited
  const [msg, setMsg] = useState('');
  const [instEdit, setInstEdit] = useState(null);     // { id, draft, all } — the instruction being edited for a duty section

  const sel = duties.find((p) => p.name === selName) || (!canEdit && me ? me : duties[0]) || null;
  const shown = duties.filter((p) => !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()));
  const removedAll = useMemo(() => removedList(removed, rows), [removed, rows]);
  const totalStudents = new Set(duties.flatMap((p) => p.sections.flatMap((s) => s.students.map((x) => x.sid)))).size;
  const isTeacherUser = !!everyone.find((p) => sameName(p.name, userName) || (userStaffId != null && p.staffId != null && String(p.staffId) === String(userStaffId)));
  const canCreate = canEdit || isTeacherUser;

  // ── duty sheet (print) and Excel ───────────────────────────────────────────
  const dutyPages = (people) => people.map((p) => {
    const secs = p.sections.map((s) => { const d = pickInstruction(s.instruction); const slot = slotText(d); const given = d.venue || d.reason || slot || d.instruction;
      return `<div class="avoid"><h3>${esc(s.label)} <span style="font-weight:600;color:#475569;text-transform:none;letter-spacing:0">· ${esc(s.subject)} · ${s.students.length} student${s.students.length === 1 ? '' : 's'}</span></h3>
      <div style="border:1px solid #cbd5e1;border-left:4px solid ${given ? '#b8923a' : '#dc2626'};border-radius:5px;padding:6px 9px;margin:0 0 6px;background:${given ? '#fffbeb' : '#fef2f2'};font-size:10.5px">
        ${given ? `${d.venue ? `<div><b>📍 Where:</b> ${esc(d.venue)}</div>` : ''}${d.reason ? `<div><b>🎯 Why (reason):</b> ${esc(d.reason)}</div>` : ''}${slot ? `<div><b>🕔 When:</b> ${esc(slot)}</div>` : ''}${d.instruction ? `<div><b>📋 What you must do:</b> ${esc(d.instruction)}</div>` : ''}` : '<b>No instruction has been given for this group yet — please ask the admin where, why and when you are to be on duty.</b>'}
        ${s.note && !d.instruction ? `<div style="color:#475569">${esc(s.note)}</div>` : ''}</div>
      <table><thead><tr><th>#</th><th class="l">Student</th><th>GCC</th><th class="l">Class</th><th class="l">House</th><th>${esc(s.basis || 'Avg')} %</th><th class="l">Weakest</th>${[1, 2, 3, 4, 5, 6].map((n) => `<th style="width:20px">${n}</th>`).join('')}<th class="l" style="width:70px">Remarks</th></tr></thead>
      <tbody>${s.students.map((x, i) => `<tr><td>${i + 1}</td><td class="l"><b>${esc(x.name)}</b></td><td>${esc(x.gcc)}</td><td class="l">${esc(x.class)}</td><td class="l">${esc(x.house || '—')}</td><td>${fx(x.score)}</td><td class="l">${esc(x.weakest || '—')}</td>${'<td></td>'.repeat(6)}<td></td></tr>`).join('')}</tbody></table></div>`; }).join('');
    const clash = slotClashes(p.sections);
    const dutyBox = p.sections.length ? `<div style="border:2px solid #0f2d5e;border-radius:8px;padding:10px 12px;margin:0 0 12px;background:#f8fafc">
        <div style="font-weight:800;color:#0f2d5e;letter-spacing:1.5px;text-transform:uppercase;font-size:11.5px">Your duty — please read</div>
        <p style="margin:5px 0 7px;font-size:11px">Dear <b>${esc(p.name)}</b>, you have been assigned to <b>${p.groups}</b> self-study group${p.groups === 1 ? '' : 's'} (<b>${p.students}</b> student${p.students === 1 ? '' : 's'}) for ${esc(series)}. Please be at the <b>place</b> below, at the <b>time</b> shown, for the <b>reason</b> given, and follow the instruction for each group.</p>
        <table><thead><tr><th>#</th><th class="l">Group / subject</th><th class="l">Where</th><th class="l">Why (reason)</th><th class="l">Days &amp; time</th><th>Students</th></tr></thead>
        <tbody>${p.sections.map((s, i) => { const d = pickInstruction(s.instruction); return `<tr><td>${i + 1}</td><td class="l"><b>${esc(s.label)}</b><br><span style="color:#475569">${esc(s.subject)}</span></td><td class="l">${esc(d.venue || 'to be told')}</td><td class="l">${esc(d.reason || '—')}</td><td class="l"><b>${esc(slotText(d) || 'to be told')}</b></td><td>${s.students.length}</td></tr>`; }).join('')}</tbody></table>
        ${clash.length ? `<div style="color:#b42318;font-weight:700;margin-top:4px">⚠ Two of your duties overlap: ${clash.map((c) => `${esc(c.a)} and ${esc(c.b)} on ${c.day}`).join('; ')}. Please tell the admin.</div>` : ''}</div>` : '';
    const rem = removedAll.filter((r) => p.sections.some((s) => (s.basis || '') === r.basis));
    return `<div class="page"><div class="dp">${letterhead(institute)}<div class="title">Self-study duty sheet</div>
      <div class="sub">${esc(series)}</div>
      <div style="display:flex;gap:14px;align-items:center;border:1px solid #cbd5e1;border-radius:8px;padding:9px 12px;margin:6px 0 10px;background:linear-gradient(180deg,#f8fafc,#fff)">
        <div style="width:46px;height:46px;border-radius:50%;background:#0f2d5e;color:#f3d58a;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px">${esc(initials(p.name))}</div>
        <div style="flex:1"><div style="font-size:15px;font-weight:800;color:#0f2d5e">${esc(p.name)}</div><div style="color:#475569">${esc(p.title || 'On duty')}</div></div>
        <div style="text-align:center"><b style="font-size:18px">${p.groups}</b><br><span style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#475569">Groups</span></div>
        <div style="text-align:center"><b style="font-size:18px">${p.students}</b><br><span style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#475569">Students</span></div></div>
      ${dutyBox}${secs || '<p>No groups assigned.</p>'}
      ${rem.length ? `<h3>Removed / transferred out</h3><table><thead><tr><th class="l">Student</th><th>GCC</th><th class="l">Subject</th><th class="l">Reason</th><th class="l">By</th></tr></thead><tbody>${rem.map((r) => `<tr><td class="l">${esc(r.name)}</td><td>${esc(r.gcc)}</td><td class="l">${esc(r.basis || 'Overall marks')}</td><td class="l">${esc(r.reason || '—')}</td><td class="l">${esc(r.by || '—')}</td></tr>`).join('')}</tbody></table>` : ''}
      <div class="sig"><span>Duty teacher: ${esc(p.name)}</span><span>House Master / Mistress</span><span>Principal</span></div>
      <div class="foot">Generated ${esc(new Date().toLocaleString('en-IN'))} · marks 1–6 = attendance for each self-study session</div></div></div>`;
  }).join('');
  const printSheets = (people) => {
    if (!people.length) return;
    printDocument(`<style>.dp{font-size:10.5px}</style>${dutyPages(people)}`, `Duty sheet - ${people.length === 1 ? people[0].name : 'all teachers'} - ${series}`);
  };
  const exportXlsx = async (people) => {
    const XLSX = await import('xlsx');
    const data = people.flatMap((p) => p.sections.flatMap((s) => s.students.map((x) => ({
      'Person on duty': p.name, Title: p.title, Subject: s.subject, Group: s.label, Where: pickInstruction(s.instruction).venue || '', Why: pickInstruction(s.instruction).reason || '', 'Days & time': slotText(s.instruction), Instruction: pickInstruction(s.instruction).instruction || '', Class: x.class, GCC: x.gcc, Name: x.name, House: x.house || '—', 'House Master / Mistress': x.hm || '—', 'Score %': fx(x.score) === '—' ? '' : Math.round(x.score * 10) / 10, 'Weakest subject': x.weakest || '—',
    }))));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.length ? data : [{ Note: 'Nobody is on duty yet.' }]), 'Duty list');
    XLSX.writeFile(wb, `${series} - duty list${people.length === 1 ? ` - ${people[0].name}` : ''}.xlsx`);
  };

  // ── remove / transfer ───────────────────────────────────────────────────────
  const rowKey = (sec, x) => `${sec.id}|${x.sid}`;
  const doRemove = async (sec, x) => { await onRemove(sec.basis, x.sid, removing?.reason || REASONS[0]); setRemoving(null); setMsg(`${x.name} removed from ${sec.subject}. They can be restored from “Removed students”.`); };
  const doTransfer = async (sec, x, grp) => { await onTransfer(sec.basis, x.sid, grp); setMsg(`${x.name} moved to Group ${grp} (${sec.subject}).`); };
  const dropFromCustom = async (sec, x) => {
    const cg = custom.find((g) => g.id === sec.id);
    if (!cg) return;
    await onSaveCustom({ ...cg, students: cg.students.filter((s) => s !== x.sid) });
    setMsg(`${x.name} removed from “${cg.name}”.`);
  };

  // ── manual group builder ────────────────────────────────────────────────────
  const pool = useMemo(() => studentAverages(rows), [rows]);
  const openBuilder = (g) => setBuilder(g ? { ...g, ...(hasInstruction(g) || !g.note ? pickInstruction(g) : { ...pickInstruction(g), instruction: g.note }) } : { id: '', name: '', basis: '', dutyName: !canEdit && isTeacherUser ? userName : '', dutyTitle: '', students: [], note: '', ...emptyInstruction(), _q: '', _cls: [], _weak: '' });
  const pickPerson = (key) => { const p = everyone.find((x) => x.key === key); setBuilder((b) => ({ ...b, dutyName: p?.name || '', dutyTitle: p?.title || '' })); };
  const scoreIn = (s, basis) => (basis ? (s.subj?.[basis] ?? null) : s.avg);
  const builderPool = useMemo(() => {
    if (!builder) return [];
    const t = (builder._q || '').trim().toLowerCase();
    return pool.filter((s) => (!(builder._cls || []).length || builder._cls.includes(s.batch)) && (!builder._weak || s.weakest === builder._weak) && (!t || `${s.name} ${s.gcc}`.toLowerCase().includes(t)))
      .sort((a, b) => (scoreIn(a, builder.basis) ?? 999) - (scoreIn(b, builder.basis) ?? 999) || String(a.name).localeCompare(String(b.name)));
  }, [pool, builder]);
  const saveBuilder = async () => {
    if (!builder.name.trim() || !builder.students.length) return;
    const { _q, _cls, _weak, ...clean } = builder; // eslint-disable-line no-unused-vars
    await onSaveCustom({ ...clean, name: builder.name.trim() });
    setMsg(`Group “${builder.name.trim()}” saved with ${builder.students.length} student${builder.students.length === 1 ? '' : 's'}.`);
    setBuilder(null);
  };
  const classNames = useMemo(() => [...new Set(pool.map((s) => s.batch))].sort(), [pool]);
  const weakNames = useMemo(() => [...new Set(pool.map((s) => s.weakest).filter(Boolean))].sort(), [pool]);

  return (
    <div className="mdd">
      <style>{CSS}</style>
      <div className="mdd-hero">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
          <div>
            <h3>Duty Desk</h3>
            <p>Who looks after which self-study group — with each student's list. Duty teachers can remove or transfer their own students, and groups can be built from a hand-picked list of students.</p>
          </div>
          <button className="mdd-ghost" onClick={onClose} style={{ alignSelf: 'flex-start' }}>← Back to groups</button>
        </div>
        <div className="mdd-kpis">
          <div className="mdd-kpi"><b>{duties.length}</b><small>On duty</small></div>
          <div className="mdd-kpi"><b>{duties.reduce((t, p) => t + p.groups, 0)}</b><small>Groups</small></div>
          <div className="mdd-kpi"><b>{totalStudents}</b><small>Students</small></div>
          <div className="mdd-kpi"><b>{custom.length}</b><small>Manual groups</small></div>
          <div className="mdd-kpi"><b>{removedAll.length}</b><small>Removed</small></div>
        </div>
      </div>

      {msg ? <div role="status" style={{ background: '#ecfdf5', border: '1px solid #86efac', color: '#166534', borderRadius: 12, padding: '8px 14px', fontSize: 13, marginBottom: 12 }}>{msg}</div> : null}
      {storageNote ? <div style={{ fontSize: 12, color: '#92400E', marginBottom: 10 }}>{storageNote}</div> : null}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <button className="mdd-btn gold" disabled={!canCreate} onClick={() => openBuilder(null)}>➕ New group from manual choice</button>
        <button className="mdd-btn" disabled={!duties.length} onClick={() => printSheets(duties)}>🖨️ Print every duty sheet</button>
        <button className="mdd-ghost" disabled={!duties.length} onClick={() => exportXlsx(duties)}>⬇️ Excel — all</button>
      </div>

      {builder ? (
        <div className="mdd-card" style={{ border: '1.5px solid #7c3aed' }}>
          <div className="mdd-ph"><h4>{builder.id ? 'Edit group' : 'New group from manual choice'}</h4><span style={{ fontSize: 12, color: '#5d6b82' }}>Tick the students you want in this group, name it, and choose who is on duty.</span></div>
          <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
              <label style={{ flex: '1 1 200px' }}><small style={{ display: 'block', fontWeight: 700, color: '#5d6b82' }}>GROUP NAME</small><input style={{ width: '100%' }} value={builder.name} onChange={(e) => setBuilder({ ...builder, name: e.target.value })} placeholder="e.g. Maths booster" aria-label="Group name" /></label>
              <label><small style={{ display: 'block', fontWeight: 700, color: '#5d6b82' }}>SUBJECT</small>
                <select value={builder.basis} onChange={(e) => setBuilder({ ...builder, basis: e.target.value })} aria-label="Group subject"><option value="">Overall marks</option>{subjects.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
              <label><small style={{ display: 'block', fontWeight: 700, color: '#5d6b82' }}>ON DUTY</small>
                <select value={everyone.find((p) => sameName(p.name, builder.dutyName))?.key || ''} onChange={(e) => pickPerson(e.target.value)} disabled={!canEdit && isTeacherUser} aria-label="Person on duty">
                  <option value="">— nobody yet —</option>
                  {(dir?.masters || []).length ? <optgroup label="House Masters / Mistresses">{dir.masters.map((m) => <option key={m.key} value={m.key}>{m.name} ({m.title})</option>)}</optgroup> : null}
                  {(dir?.teachers || []).length ? <optgroup label="Teaching staff">{dir.teachers.map((m) => <option key={m.key} value={m.key}>{m.name} ({m.title})</option>)}</optgroup> : null}
                </select></label>
            </div>
            <div style={{ background: '#fffbeb', border: '1px solid #f1deaa', borderRadius: 14, padding: 12, marginBottom: 12 }}>
              <b style={{ fontSize: 13 }}>Instruction for {builder.dutyName || 'the person on duty'}</b>
              <div style={{ marginTop: 8 }}><InstructionForm value={builder} onChange={(d) => setBuilder({ ...builder, ...d })} who={builder.dutyName || 'they'} /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
              <input placeholder="Search name or GCC" value={builder._q} onChange={(e) => setBuilder({ ...builder, _q: e.target.value })} aria-label="Search students" style={{ flex: '1 1 180px' }} />
              <select value={builder._weak} onChange={(e) => setBuilder({ ...builder, _weak: e.target.value })} aria-label="Weakest subject filter"><option value="">Any weakest subject</option>{weakNames.map((w) => <option key={w} value={w}>Weakest: {w}</option>)}</select>
              <button className="mdd-ghost" onClick={() => setBuilder({ ...builder, students: [...new Set([...builder.students, ...builderPool.map((s) => s.sid)])] })}>Select all shown ({builderPool.length})</button>
              <button className="mdd-ghost" onClick={() => setBuilder({ ...builder, students: [] })}>Clear</button>
            </div>
            {classNames.length > 1 ? <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>{classNames.map((c) => <button key={c} className="mdd-ghost" style={builder._cls.includes(c) ? { background: NAVY, color: '#fff', borderColor: NAVY } : undefined} onClick={() => setBuilder({ ...builder, _cls: toggleIn(builder._cls, c) })}>{c}</button>)}</div> : null}
            <div className="mdd-picker" role="list" aria-label="Students to choose from">
              {builderPool.map((s) => {
                const on = builder.students.includes(s.sid), sc = scoreIn(s, builder.basis);
                return (
                  <label key={s.sid} className={`mdd-pick${on ? ' on' : ''}`} role="listitem">
                    <input type="checkbox" checked={on} onChange={() => setBuilder({ ...builder, students: toggleIn(builder.students, s.sid) })} aria-label={`Choose ${s.name}`} />
                    <Avatar name={s.name} sm />
                    <span style={{ flex: 1, minWidth: 0 }}><b style={{ fontSize: 13 }}>{s.name}</b> <small style={{ color: '#5d6b82' }}>· {s.gcc} · {s.batch}</small></span>
                    {s.weakest ? <span className="mdd-chip">weak: {s.weakest}</span> : null}
                    <b style={{ color: scoreColor(sc), minWidth: 46, textAlign: 'right' }}>{fx(sc)}%</b>
                  </label>
                );
              })}
              {!builderPool.length ? <div className="mdd-empty">No students match.</div> : null}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
              <button className="mdd-btn" disabled={!builder.name.trim() || !builder.students.length} onClick={saveBuilder}>💾 Save group ({builder.students.length} student{builder.students.length === 1 ? '' : 's'})</button>
              <button className="mdd-ghost" onClick={() => setBuilder(null)}>Cancel</button>
              {builder.id && canAct(builder.dutyName) ? <button className="mdd-ghost danger" onClick={async () => { if (window.confirm(`Delete the group “${builder.name}”? The students stay in their automatic groups.`)) { await onDeleteCustom(builder.id); setBuilder(null); setMsg('Group deleted.'); } }}>🗑 Delete group</button> : null}
            </div>
          </div>
        </div>
      ) : null}

      {!duties.length ? (
        <div className="mdd-card"><div className="mdd-empty"><div style={{ fontSize: 32 }}>🧑‍🏫</div><b>Nobody is on duty yet</b><div style={{ fontSize: 13, marginTop: 4 }}>Assign a House Master or teacher to a group (“Assigned for duty” on each group card), or build a group from a manual choice above.</div></div></div>
      ) : (
        <div className="mdd-grid">
          <div className="mdd-rail" aria-label="People on duty">
            <input placeholder="Find a person…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a person on duty" />
            {shown.map((p) => (
              <button key={p.name} className={`mdd-person${sel?.name === p.name ? ' on' : ''}`} onClick={() => setSelName(p.name)} aria-label={`Open ${p.name}`}>
                <Avatar name={p.name} />
                <span style={{ minWidth: 0 }}><b>{p.name}{me?.name === p.name ? ' (you)' : ''}</b><small>{p.title || 'On duty'} · {p.groups} group{p.groups === 1 ? '' : 's'} · {p.students} student{p.students === 1 ? '' : 's'}</small></span>
              </button>
            ))}
          </div>

          <div className="mdd-main">
            {sel ? (
              <div className="mdd-card">
                <div className="mdd-ph">
                  <Avatar name={sel.name} />
                  <div style={{ flex: '1 1 200px' }}><h4>{sel.name}</h4><div style={{ fontSize: 12.5, color: '#5d6b82' }}>{sel.title || 'On duty'} · {sel.groups} group{sel.groups === 1 ? '' : 's'} · {sel.students} student{sel.students === 1 ? '' : 's'}</div></div>
                  <button className="mdd-btn" onClick={() => printSheets([sel])}>🖨️ Print duty sheet</button>
                  <button className="mdd-ghost" onClick={async () => { try { await navigator.clipboard.writeText(instructionMessage(sel, series)); setMsg(`Instruction message for ${sel.name} copied — paste it into WhatsApp or a message.`); } catch { setMsg('Could not copy automatically.'); } }}>📋 Copy instruction message</button>
                  <button className="mdd-ghost" onClick={() => exportXlsx([sel])}>⬇️ Excel</button>
                </div>
                {slotClashes(sel.sections).length ? <div role="alert" style={{ padding: '8px 16px', background: '#fef2f2', color: '#b42318', fontSize: 12.5, fontWeight: 700 }}>⚠ Overlapping slots: {slotClashes(sel.sections).map((c) => `${c.a} and ${c.b} on ${c.day}`).join('; ')}</div> : null}
                {sel.sections.map((sec) => {
                  const act = canAct(sel.name);
                  return (
                    <div key={sec.id}>
                      <div className="mdd-sec-h">
                        <span className="mdd-badge" style={{ background: sec.color }}>{sec.kind === 'custom' ? 'Manual' : `Group ${sec.group}`}</span>
                        <b style={{ fontSize: 13.5 }}>{sec.label}</b>
                        <span className="mdd-chip">{sec.subject}</span>
                        <span style={{ fontSize: 12, color: '#5d6b82' }}>{sec.students.length} student{sec.students.length === 1 ? '' : 's'}{sec.note ? ` · ${sec.note}` : ''}</span>
                        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6 }}>
                          {canEdit ? <button className="mdd-ghost" onClick={() => setInstEdit(instEdit?.id === sec.id ? null : { id: sec.id, draft: pickInstruction(sec.instruction), all: false })} aria-label={`Instructions for ${sec.label}`}>📋 Instructions</button> : null}
                          {sec.kind === 'custom' && act ? <button className="mdd-ghost" onClick={() => openBuilder(custom.find((g) => g.id === sec.id))}>✏️ Edit group</button> : null}
                        </span>
                      </div>
                      {hasInstruction(sec.instruction) || (sec.note && !sec.instruction.instruction) ? (
                        <div style={{ padding: '8px 16px', background: '#fffbeb', borderTop: '1px solid #f4ead0' }}>
                          <InstructionSummary value={sec.instruction} />
                          {sec.note && !sec.instruction.instruction ? <div style={{ fontSize: 12.5, color: '#2e3b52' }}>📋 {sec.note}</div> : null}
                        </div>
                      ) : <div style={{ padding: '6px 16px', background: '#fef2f2', borderTop: '1px solid #fbd5d5', fontSize: 12, color: '#b42318' }}>No instruction yet — where, why and when are not set for this group.</div>}
                      {instEdit?.id === sec.id ? (
                        <div style={{ padding: 14, background: '#fffdf5', borderTop: '1px solid #f4ead0' }}>
                          <InstructionForm value={instEdit.draft} onChange={(d) => setInstEdit({ ...instEdit, draft: d })} who={sel.name} />
                          <label style={{ display: 'block', fontSize: 12.5, margin: '8px 0' }}><input type="checkbox" checked={instEdit.all} onChange={(e) => setInstEdit({ ...instEdit, all: e.target.checked })} /> Use the same instruction for all {sel.sections.length} of {sel.name}'s groups</label>
                          <button className="mdd-btn" disabled={!!(instEdit.draft.from && instEdit.draft.to && instEdit.draft.to <= instEdit.draft.from)} onClick={async () => { const targets = instEdit.all ? sel.sections : [sec]; for (const t of targets) await onSaveInstruction(t, instEdit.draft); setMsg(`Instruction saved for ${sel.name}${instEdit.all ? ` (${targets.length} groups)` : ''}.`); setInstEdit(null); }}>💾 Save instruction</button>
                          <button className="mdd-ghost" style={{ marginLeft: 8 }} onClick={() => setInstEdit(null)}>Cancel</button>
                        </div>
                      ) : null}
                      {sec.students.map((x) => (
                        <div key={rowKey(sec, x)} className="mdd-row">
                          <Avatar name={x.name} sm />
                          <div className="mdd-name"><b>{x.name}{x.manual ? <span title="Placed here by hand" style={{ color: '#be185d' }}> ✎</span> : null}</b><small>GCC {x.gcc} · {x.class}{x.house ? ` · ${x.house}` : ''}</small></div>
                          <div className="mdd-score"><b style={{ color: scoreColor(x.score), fontSize: 13 }}>{fx(x.score)}%</b><div className="mdd-bar"><i style={{ width: `${Math.max(0, Math.min(100, x.score ?? 0))}%`, background: scoreColor(x.score) }} /></div></div>
                          {x.weakest ? <span className="mdd-chip">weak: {x.weakest}</span> : null}
                          {act ? (
                            sec.kind === 'group' ? (
                              <>
                                <select aria-label={`Transfer ${x.name}`} value="" onChange={(e) => e.target.value && doTransfer(sec, x, Number(e.target.value))}>
                                  <option value="">Transfer to…</option>
                                  {GROUP_META.filter((m) => m.no !== sec.group).map((m) => <option key={m.no} value={m.no}>Group {m.no} · {m.tag}</option>)}
                                </select>
                                <button className="mdd-ghost danger" onClick={() => setRemoving({ key: rowKey(sec, x), reason: REASONS[0] })} aria-label={`Remove ${x.name}`}>Remove</button>
                              </>
                            ) : <button className="mdd-ghost danger" onClick={() => dropFromCustom(sec, x)} aria-label={`Remove ${x.name} from group`}>Remove from group</button>
                          ) : null}
                          {removing?.key === rowKey(sec, x) ? (
                            <div className="mdd-pop">
                              <b style={{ fontSize: 12.5 }}>Why is {x.name} being removed?</b>
                              <select value={removing.reason} onChange={(e) => setRemoving({ ...removing, reason: e.target.value })} aria-label="Reason for removal">{REASONS.map((r) => <option key={r}>{r}</option>)}</select>
                              <button className="mdd-btn" onClick={() => doRemove(sec, x)}>Confirm remove</button>
                              <button className="mdd-ghost" onClick={() => setRemoving(null)}>Cancel</button>
                            </div>
                          ) : null}
                        </div>
                      ))}
                      {!sec.students.length ? <div className="mdd-empty" style={{ padding: 14 }}>No students in this group.</div> : null}
                    </div>
                  );
                })}
              </div>
            ) : null}

            <div className="mdd-card">
              <div className="mdd-ph"><h4>Removed students</h4><span style={{ fontSize: 12.5, color: '#5d6b82' }}>{removedAll.length ? 'Taken out of the groups. Restoring puts them back in their automatic group.' : 'Nobody has been removed.'}</span></div>
              {removedAll.map((r) => (
                <div key={`${r.basis}|${r.sid}`} className="mdd-row">
                  <Avatar name={r.name} sm />
                  <div className="mdd-name"><b>{r.name}</b><small>GCC {r.gcc} · {r.class}</small></div>
                  <span className="mdd-chip">{r.basis || 'Overall marks'}</span>
                  <span style={{ fontSize: 12, color: '#5d6b82', flex: '1 1 180px' }}>{r.reason || '—'}{r.by ? ` · by ${r.by}` : ''}{r.at ? ` · ${new Date(r.at).toLocaleDateString('en-IN')}` : ''}</span>
                  {canEdit || sameName(userName, r.by) ? <button className="mdd-ghost" onClick={async () => { await onRestore(r.basis, r.sid); setMsg(`${r.name} restored.`); }} aria-label={`Restore ${r.name}`}>↩ Restore</button> : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
