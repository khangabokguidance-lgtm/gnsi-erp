import { useState } from 'react';
import { useBoarder } from '../hooks/useBoarder';
import { today, nextId } from '../utils/hostelUtils';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const SUNDAY_ACTIVITIES = ['Church','Study Hall','Games','Movie','Outing','Free Time','Cultural','Sports'];

export default function BoarderPage() {
  const { schedule, sundaySchedule, staffArrange, loading,
    saveSchedule, saveSundaySchedule, saveStaffArrange } = useBoarder();
  const [tab, setTab] = useState('daily');

  if (loading) return <div className="page-loading">Loading…</div>;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-eyebrow">Boarding</div>
        <div className="page-header-title">Boarder Schedule</div>
        <div className="page-header-sub">Daily timetable · Sunday programme · Staff arrangement</div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {[['daily','📅 Daily Schedule'],['sunday','☀️ Sunday Programme'],['staff','👤 Staff Arrangement']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ padding: '8px 16px', borderRadius: 8,
              border: tab === id ? 'none' : '1.5px solid var(--border)',
              background: tab === id ? 'var(--accent)' : 'var(--surface)',
              color: tab === id ? '#fff' : 'var(--muted)',
              fontWeight: tab === id ? 700 : 600, cursor: 'pointer', fontSize: 13 }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'daily'  && <DailyScheduleTab  schedule={schedule}  onSave={saveSchedule} />}
      {tab === 'sunday' && <SundayTab         schedule={sundaySchedule} onSave={saveSundaySchedule} />}
      {tab === 'staff'  && <StaffTab          arrange={staffArrange}  onSave={saveStaffArrange} />}
    </div>
  );
}

/* ── DAILY SCHEDULE ─────────────────────────────────── */
function DailyScheduleTab({ schedule, onSave }) {
  const [form, setForm] = useState({ day: 'Monday', time: '', activity: '', location: '', notes: '' });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const is = { width:'100%', padding:'7px 10px', borderRadius:8, border:'1.5px solid var(--border)', fontSize:13, marginTop:4, background:'var(--surface)', color:'var(--text)' };

  return (
    <>
      {/* KPI */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:14, marginBottom:20 }}>
        {DAYS.map(day => (
          <div key={day} className="card" style={{ padding:'12px 14px' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--muted)', textTransform:'uppercase' }}>{day.slice(0,3)}</div>
            <div style={{ fontSize:22, fontWeight:800, color:'var(--text)', margin:'4px 0' }}>
              {schedule.filter(r => r.day === day).length}
            </div>
            <div style={{ fontSize:11, color:'var(--muted)' }}>activities</div>
          </div>
        ))}
      </div>

      {/* Add Form */}
      <div className="card" style={{ marginBottom:18 }}>
        <div className="card-head"><span className="card-title">Add Activity</span></div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12 }}>
          <div>
            <label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Day</label>
            <select value={form.day} onChange={set('day')} style={is}>
              {DAYS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          {[['time','Time (e.g. 06:00)'],['activity','Activity'],['location','Location'],['notes','Notes']].map(([key,label]) => (
            <div key={key}>
              <label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>{label}</label>
              <input value={form[key]} onChange={set(key)} style={is} />
            </div>
          ))}
        </div>
        <div style={{ marginTop:12 }}>
          <button className="btn btn-primary" onClick={() => {
            if (!form.activity) return alert('Enter activity name');
            onSave([...schedule, { id: nextId(schedule), ...form }]);
            setForm({ day:'Monday', time:'', activity:'', location:'', notes:'' });
          }}>Add Activity</button>
        </div>
      </div>

      {/* Table grouped by day */}
      {DAYS.map(day => {
        const rows = schedule.filter(r => r.day === day).sort((a,b) => a.time.localeCompare(b.time));
        if (!rows.length) return null;
        return (
          <div key={day} className="card" style={{ marginBottom:14 }}>
            <div className="card-head">
              <span className="card-title">{day}</span>
              <span style={{ fontSize:11, color:'var(--muted)', fontFamily:'monospace' }}>{rows.length} activities</span>
            </div>
            <div style={{ overflowX:'auto' }}>
              <table>
                <thead><tr><th>Time</th><th>Activity</th><th>Location</th><th>Notes</th><th>Del</th></tr></thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontFamily:'monospace', fontWeight:700, fontSize:13 }}>{r.time || '—'}</td>
                      <td><b>{r.activity}</b></td>
                      <td style={{ fontSize:12, color:'var(--muted)' }}>{r.location || '—'}</td>
                      <td style={{ fontSize:12, color:'var(--muted)' }}>{r.notes || '—'}</td>
                      <td>
                        <button onClick={() => onSave(schedule.filter(x => x.id !== r.id))}
                          style={{ padding:'3px 9px', borderRadius:6, border:'1px solid #fca5a5', background:'#fee2e2', color:'#dc2626', fontSize:11, cursor:'pointer' }}>Del</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
      {schedule.length === 0 && (
        <div className="card" style={{ textAlign:'center', padding:40, color:'var(--muted)', fontStyle:'italic' }}>
          No schedule added yet. Add your first activity above.
        </div>
      )}
    </>
  );
}

/* ── SUNDAY PROGRAMME ───────────────────────────────── */
function SundayTab({ schedule, onSave }) {
  const [form, setForm] = useState({ date: today(), time:'', activity: SUNDAY_ACTIVITIES[0], venue:'', incharge:'', notes:'' });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const is = { width:'100%', padding:'7px 10px', borderRadius:8, border:'1.5px solid var(--border)', fontSize:13, marginTop:4, background:'var(--surface)', color:'var(--text)' };

  const activityColors = {
    Church:'#7c3aed', Study: '#1d4ed8', Games:'#16a34a', Movie:'#f59e0b',
    Outing:'#0891b2', 'Free Time':'#6b7280', Cultural:'#db2777', Sports:'#dc2626',
  };

  return (
    <>
      <div className="card" style={{ marginBottom:18 }}>
        <div className="card-head"><span className="card-title">Add Sunday Activity</span></div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12 }}>
          <div>
            <label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Date (Sunday)</label>
            <input type="date" value={form.date} onChange={set('date')} style={is} />
          </div>
          <div>
            <label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Activity</label>
            <select value={form.activity} onChange={set('activity')} style={is}>
              {SUNDAY_ACTIVITIES.map(a => <option key={a}>{a}</option>)}
            </select>
          </div>
          {[['time','Time'],['venue','Venue'],['incharge','In-charge'],['notes','Notes']].map(([key,label]) => (
            <div key={key}>
              <label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>{label}</label>
              <input value={form[key]} onChange={set(key)} style={is} />
            </div>
          ))}
        </div>
        <div style={{ marginTop:12 }}>
          <button className="btn btn-primary" onClick={() => {
            onSave([...schedule, { id: nextId(schedule), ...form }]);
            setForm({ date: today(), time:'', activity: SUNDAY_ACTIVITIES[0], venue:'', incharge:'', notes:'' });
          }}>Add to Sunday Programme</button>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="card-title">Sunday Programme Register</span>
          <span style={{ fontSize:11, color:'var(--muted)', fontFamily:'monospace' }}>{schedule.length} entries</span>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table>
            <thead><tr><th>Date</th><th>Time</th><th>Activity</th><th>Venue</th><th>In-charge</th><th>Notes</th><th>Del</th></tr></thead>
            <tbody>
              {schedule.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign:'center', color:'var(--muted)', padding:40, fontStyle:'italic' }}>No Sunday activities added yet.</td></tr>
              ) : schedule.slice().reverse().map(r => (
                <tr key={r.id}>
                  <td style={{ fontFamily:'monospace', fontSize:12 }}>
                    {new Date(r.date+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
                  </td>
                  <td style={{ fontFamily:'monospace', fontWeight:700 }}>{r.time || '—'}</td>
                  <td>
                    <span style={{ padding:'2px 9px', borderRadius:10, fontSize:10.5, fontWeight:700,
                      background:(activityColors[r.activity]||'#6b7280')+'22',
                      color: activityColors[r.activity]||'#6b7280',
                      border:`1px solid ${activityColors[r.activity]||'#6b7280'}55` }}>
                      {r.activity}
                    </span>
                  </td>
                  <td>{r.venue || '—'}</td>
                  <td style={{ fontSize:12 }}>{r.incharge || '—'}</td>
                  <td style={{ fontSize:12, color:'var(--muted)' }}>{r.notes || '—'}</td>
                  <td>
                    <button onClick={() => onSave(schedule.filter(x => x.id !== r.id))}
                      style={{ padding:'3px 9px', borderRadius:6, border:'1px solid #fca5a5', background:'#fee2e2', color:'#dc2626', fontSize:11, cursor:'pointer' }}>Del</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ── STAFF ARRANGEMENT ──────────────────────────────── */
function StaffTab({ arrange, onSave }) {
  const [section, setSection] = useState('lunchdinner');
  const [form, setForm]       = useState({ staff:'', duty:'', time:'', notes:'' });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const is = { width:'100%', padding:'7px 10px', borderRadius:8, border:'1.5px solid var(--border)', fontSize:13, marginTop:4, background:'var(--surface)', color:'var(--text)' };

  const SECTIONS = [
    ['lunchdinner','🍽 Lunch & Dinner'],
    ['bathing',    '🚿 Bathing'],
    ['playtime',   '⚽ Play Time'],
  ];

  const current = arrange[section] || [];

  const addEntry = () => {
    if (!form.staff) return alert('Enter staff name');
    const updated = { ...arrange, [section]: [...current, { id: nextId(current), ...form }] };
    onSave(updated);
    setForm({ staff:'', duty:'', time:'', notes:'' });
  };

  const deleteEntry = (id) => {
    const updated = { ...arrange, [section]: current.filter(x => x.id !== id) };
    onSave(updated);
  };

  return (
    <>
      {/* Section Switcher */}
      <div style={{ display:'flex', gap:8, marginBottom:18 }}>
        {SECTIONS.map(([id, label]) => (
          <button key={id} onClick={() => setSection(id)}
            style={{ padding:'7px 16px', borderRadius:8,
              border: section === id ? 'none' : '1.5px solid var(--border)',
              background: section === id ? 'var(--accent)' : 'var(--surface)',
              color: section === id ? '#fff' : 'var(--muted)',
              fontWeight: section === id ? 700 : 600, cursor:'pointer', fontSize:13 }}>
            {label}
          </button>
        ))}
      </div>

      {/* Add Form */}
      <div className="card" style={{ marginBottom:18 }}>
        <div className="card-head"><span className="card-title">Assign Staff — {SECTIONS.find(s=>s[0]===section)[1]}</span></div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12 }}>
          {[['staff','Staff Name'],['duty','Duty / Role'],['time','Time'],['notes','Notes']].map(([key,label]) => (
            <div key={key}>
              <label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>{label}</label>
              <input value={form[key]} onChange={set(key)} style={is} />
            </div>
          ))}
        </div>
        <div style={{ marginTop:12 }}>
          <button className="btn btn-primary" onClick={addEntry}>Assign</button>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-head">
          <span className="card-title">{SECTIONS.find(s=>s[0]===section)[1]} — Roster</span>
          <span style={{ fontSize:11, color:'var(--muted)', fontFamily:'monospace' }}>{current.length} staff assigned</span>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table>
            <thead><tr><th>#</th><th>Staff Name</th><th>Duty / Role</th><th>Time</th><th>Notes</th><th>Del</th></tr></thead>
            <tbody>
              {current.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign:'center', color:'var(--muted)', padding:40, fontStyle:'italic' }}>No staff assigned yet.</td></tr>
              ) : current.map((r,i) => (
                <tr key={r.id}>
                  <td style={{ textAlign:'center', fontFamily:'monospace', color:'var(--muted)', fontSize:12 }}>{i+1}</td>
                  <td><b>{r.staff}</b></td>
                  <td>{r.duty || '—'}</td>
                  <td style={{ fontFamily:'monospace', fontSize:12 }}>{r.time || '—'}</td>
                  <td style={{ fontSize:12, color:'var(--muted)' }}>{r.notes || '—'}</td>
                  <td>
                    <button onClick={() => deleteEntry(r.id)}
                      style={{ padding:'3px 9px', borderRadius:6, border:'1px solid #fca5a5', background:'#fee2e2', color:'#dc2626', fontSize:11, cursor:'pointer' }}>Del</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
