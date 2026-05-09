import { useState } from 'react';
import { useHouse } from '../hooks/useHouse';
import { fmtDate, HOUSES, today } from '../utils/hostelUtils';
import StatusBadge from '../components/StatusBadge';

export default function HousemasterPage() {
  const { behaviour, health, academic, loading, saveBehaviour, saveHealth, saveAcademic } = useHouse();
  const [tab, setTab] = useState('behaviour');
  const [selectedHouse, setSelectedHouse] = useState(HOUSES[0]);

  if (loading) return <div className="page-loading">Loading…</div>;

  const houseBeh  = behaviour.filter(r => r.house === selectedHouse);
  const houseHlth = health.filter(r => r.house === selectedHouse);
  const houseAcad = academic.filter(r => r.house === selectedHouse);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-eyebrow">Boarding — Housemaster</div>
        <div className="page-header-title">Housemaster Dashboard</div>
        <div className="page-header-sub">Monitor students by house — Behaviour · Health · Academic</div>
      </div>

      {/* House Selector */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {HOUSES.map(h => (
          <button key={h} onClick={() => setSelectedHouse(h)}
            style={{ padding: '7px 14px', borderRadius: 8, border: selectedHouse === h ? 'none' : '1.5px solid var(--border)',
              background: selectedHouse === h ? 'var(--accent)' : 'var(--surface)', color: selectedHouse === h ? '#fff' : 'var(--muted)',
              fontWeight: selectedHouse === h ? 700 : 500, cursor: 'pointer', fontSize: 12 }}>{h}</button>
        ))}
      </div>

      {/* KPI Cards for selected house */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 14, marginBottom: 20 }}>
        {[
          ['Open Behaviour', houseBeh.filter(r => r.status === 'Open').length,           '#dc2626'],
          ['Health Watch',   houseHlth.filter(r => r.status === 'Monitoring').length,    '#f59e0b'],
          ['Academic Flag',  houseAcad.filter(r => r.flag === 'Yes').length,             '#7c3aed'],
          ['Total Records',  houseBeh.length + houseHlth.length + houseAcad.length,      '#1d4ed8'],
        ].map(([label, value, color]) => (
          <div key={label} className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase' }}>{label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color, margin: '4px 0' }}>{value}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{selectedHouse} House</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[['behaviour','⚠️ Behaviour'],['health','💊 Health'],['academic','📚 Academic']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ padding: '8px 16px', borderRadius: 8, border: tab === id ? 'none' : '1.5px solid var(--border)',
              background: tab === id ? 'var(--accent)' : 'var(--surface)', color: tab === id ? '#fff' : 'var(--muted)',
              fontWeight: tab === id ? 700 : 600, cursor: 'pointer', fontSize: 13 }}>{label}</button>
        ))}
      </div>

      {/* Add Behaviour Record */}
      {tab === 'behaviour' && (
        <>
          <AddBehaviourForm house={selectedHouse} onAdd={async (rec) => await saveBehaviour([...behaviour, { id: behaviour.length ? Math.max(...behaviour.map(r => r.id)) + 1 : 1, ...rec }])} />
          <div className="card">
            <div className="card-head"><span className="card-title">Behaviour — {selectedHouse}</span>
              <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>{houseBeh.length} records</span></div>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead><tr><th>Date</th><th>Student</th><th>Type</th><th>Severity</th><th>Description</th><th>Action Taken</th><th>Status</th><th>Delete</th></tr></thead>
                <tbody>
                  {houseBeh.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>No records for {selectedHouse}.</td></tr>
                  ) : houseBeh.slice().reverse().map(r => (
                    <tr key={r.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtDate(r.date)}</td>
                      <td><b>{r.stuName}</b></td><td>{r.type}</td>
                      <td><StatusBadge label={r.severity} /></td>
                      <td style={{ fontSize: 12 }}>{r.description || '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--muted)' }}>{r.actionTaken || '—'}</td>
                      <td><StatusBadge label={r.status || 'Open'} /></td>
                      <td>
                        <button onClick={() => saveBehaviour(behaviour.filter(x => x.id !== r.id))}
                          style={{ padding: '3px 9px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fee2e2', color: '#dc2626', fontSize: 11, cursor: 'pointer' }}>Del</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Add Health Record */}
      {tab === 'health' && (
        <>
          <AddHealthForm house={selectedHouse} onAdd={async (rec) => await saveHealth([...health, { id: health.length ? Math.max(...health.map(r => r.id)) + 1 : 1, ...rec }])} />
          <div className="card">
            <div className="card-head"><span className="card-title">Health Watch — {selectedHouse}</span></div>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead><tr><th>Date</th><th>Student</th><th>Condition</th><th>Medication</th><th>Referred To</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {houseHlth.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>No health records for {selectedHouse}.</td></tr>
                  ) : houseHlth.slice().reverse().map(r => (
                    <tr key={r.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtDate(r.date)}</td>
                      <td><b>{r.stuName}</b></td>
                      <td>{r.condition || '—'}</td>
                      <td style={{ fontSize: 12 }}>{r.medication || '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--muted)' }}>{r.referredTo || '—'}</td>
                      <td><StatusBadge label={r.status || 'Monitoring'} /></td>
                      <td>
                        {r.status === 'Monitoring' && (
                          <button onClick={() => saveHealth(health.map(x => x.id === r.id ? { ...x, status: 'Healthy' } : x))}
                            style={{ padding: '3px 9px', borderRadius: 6, border: '1px solid #86efac', background: '#f0fdf4', color: '#16a34a', fontSize: 11, cursor: 'pointer' }}>Mark Healthy</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Add Academic Record */}
      {tab === 'academic' && (
        <>
          <AddAcademicForm house={selectedHouse} onAdd={async (rec) => await saveAcademic([...academic, { id: academic.length ? Math.max(...academic.map(r => r.id)) + 1 : 1, ...rec }])} />
          <div className="card">
            <div className="card-head"><span className="card-title">Academic Watch — {selectedHouse}</span></div>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead><tr><th>Date</th><th>Student</th><th>Subject</th><th>Concern</th><th>Coaching</th><th>Flag</th><th>Action</th></tr></thead>
                <tbody>
                  {houseAcad.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>No academic records for {selectedHouse}.</td></tr>
                  ) : houseAcad.slice().reverse().map(r => (
                    <tr key={r.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtDate(r.date)}</td>
                      <td><b>{r.stuName}</b></td>
                      <td>{r.subject || '—'}</td>
                      <td>{r.concern || '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--muted)' }}>{r.coaching || '—'}</td>
                      <td><StatusBadge label={r.flag === 'Yes' ? 'Flagged' : 'Clear'} color={r.flag === 'Yes' ? '#dc2626' : '#16a34a'} /></td>
                      <td>
                        {r.flag === 'Yes' && (
                          <button onClick={() => saveAcademic(academic.map(x => x.id === r.id ? { ...x, flag: 'No' } : x))}
                            style={{ padding: '3px 9px', borderRadius: 6, border: '1px solid #86efac', background: '#f0fdf4', color: '#16a34a', fontSize: 11, cursor: 'pointer' }}>Clear Flag</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function AddBehaviourForm({ house, onAdd }) {
  const [form, setForm] = useState({ date: today(), stuName: '', house, type: '', severity: 'Medium', description: '', actionTaken: '', reportedBy: '', status: 'Open' });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const is = { width: '100%', padding: '7px 10px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 13, marginTop: 4, background: 'var(--surface)', color: 'var(--text)' };
  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="card-head"><span className="card-title">Add Behaviour Record</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
        {[['stuName','Student Name'],['date','Date,date'],['type','Incident Type'],['description','Description'],['actionTaken','Action Taken'],['reportedBy','Reported By']].map(item => {
          const [key, label, type='text'] = item[0].includes(',') ? [item[0].split(',')[0], item[1], item[0].split(',')[1]] : [item[0], item[1], 'text'];
          return <div key={key}><label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)' }}>{label}</label>
            <input type={type} value={form[key]} onChange={set(key)} style={is} /></div>;
        })}
        <div><label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)' }}>Severity</label>
          <select value={form.severity} onChange={set('severity')} style={is}>
            {['Low','Medium','High','Critical'].map(s=><option key={s}>{s}</option>)}
          </select></div>
      </div>
      <div style={{ marginTop: 12 }}>
        <button className="btn btn-primary" onClick={() => { if (!form.stuName) return alert('Enter student name'); onAdd({ ...form, house }); }}>Save</button>
      </div>
    </div>
  );
}

function AddHealthForm({ house, onAdd }) {
  const [form, setForm] = useState({ date: today(), stuName: '', house, condition: '', medication: '', referredTo: '', notes: '', status: 'Monitoring' });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const is = { width: '100%', padding: '7px 10px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 13, marginTop: 4, background: 'var(--surface)', color: 'var(--text)' };
  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="card-head"><span className="card-title">Add Health Record</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
        {[['stuName','Student Name'],['date','Date'],['condition','Condition'],['medication','Medication'],['referredTo','Referred To'],['notes','Notes']].map(([key,label])=>(
          <div key={key}><label style={{ fontSize:11.5,fontWeight:700,color:'var(--muted)' }}>{label}</label>
            <input type={key==='date'?'date':'text'} value={form[key]} onChange={set(key)} style={is}/></div>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <button className="btn btn-primary" onClick={() => { if (!form.stuName) return alert('Enter student name'); onAdd({ ...form, house }); }}>Save</button>
      </div>
    </div>
  );
}

function AddAcademicForm({ house, onAdd }) {
  const [form, setForm] = useState({ date: today(), stuName: '', house, subject: '', concern: '', coaching: '', notes: '', flag: 'Yes' });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const is = { width: '100%', padding: '7px 10px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 13, marginTop: 4, background: 'var(--surface)', color: 'var(--text)' };
  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="card-head"><span className="card-title">Add Academic Record</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
        {[['stuName','Student Name'],['date','Date'],['subject','Subject'],['concern','Concern'],['coaching','Coaching Required'],['notes','Notes']].map(([key,label])=>(
          <div key={key}><label style={{ fontSize:11.5,fontWeight:700,color:'var(--muted)' }}>{label}</label>
            <input type={key==='date'?'date':'text'} value={form[key]} onChange={set(key)} style={is}/></div>
        ))}
        <div><label style={{ fontSize:11.5,fontWeight:700,color:'var(--muted)' }}>Flag</label>
          <select value={form.flag} onChange={set('flag')} style={is}>
            <option value="Yes">Yes — Flag this student</option>
            <option value="No">No — Just a note</option>
          </select></div>
      </div>
      <div style={{ marginTop: 12 }}>
        <button className="btn btn-primary" onClick={() => { if (!form.stuName) return alert('Enter student name'); onAdd({ ...form, house }); }}>Save</button>
      </div>
    </div>
  );
}
