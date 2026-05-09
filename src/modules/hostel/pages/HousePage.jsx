import { useState } from 'react';
import { useHouse } from '../hooks/useHouse';
import { today, fmtDate, nextId, HOUSES } from '../utils/hostelUtils';
import StatusBadge from '../components/StatusBadge';

export default function HousePage() {
  const { points, maintenance, behaviour, health, academic, loading,
    savePoints, saveMaintenance, saveBehaviour, saveHealth, saveAcademic } = useHouse();
  const [tab, setTab] = useState('points');

  if (loading) return <div className="page-loading">Loading…</div>;

  // Calculate total points per house for leaderboard
  const tallies = HOUSES.reduce((acc, h) => {
    acc[h] = points.filter(p => p.house === h).reduce((s, p) => s + (Number(p.points) || 0), 0);
    return acc;
  }, {});
  const sorted = Object.entries(tallies).sort((a, b) => b[1] - a[1]);

  const TABS = [
    ['points',      '🏆 Points'],
    ['maintenance', '🔧 Maintenance'],
    ['behaviour',   '⚠️ Behaviour'],
    ['health',      '💊 Health'],
    ['academic',    '📚 Academic'],
  ];

  return (
    <div>
      <div className="page-header">
        <div className="page-header-eyebrow">Boarding — House System</div>
        <div className="page-header-title">House Management</div>
        <div className="page-header-sub">Points · Maintenance · Behaviour · Health · Academic</div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ padding: '8px 16px', borderRadius: 8, border: tab === id ? 'none' : '1.5px solid var(--border)',
              background: tab === id ? 'var(--accent)' : 'var(--surface)', color: tab === id ? '#fff' : 'var(--muted)',
              fontWeight: tab === id ? 700 : 600, cursor: 'pointer', fontSize: 13 }}>{label}</button>
        ))}
      </div>

      {/* ── POINTS ── */}
      {tab === 'points' && (
        <>
          {/* Leaderboard */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 12, marginBottom: 20 }}>
            {sorted.map(([house, total], i) => (
              <div key={house} className="card" style={{ padding: '14px 16px', borderColor: i === 0 ? '#f59e0b55' : undefined }}>
                {i === 0 && <div style={{ fontSize: 10, fontWeight: 700, color: '#d97706', marginBottom: 4 }}>🏆 LEADER</div>}
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>{house}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', margin: '4px 0' }}>{total}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>points</div>
              </div>
            ))}
          </div>

          {/* Award Points Form */}
          <PointsForm onAdd={async (rec) => await savePoints([...points, { id: nextId(points), ...rec }])} />

          {/* Points Log */}
          <div className="card">
            <div className="card-head"><span className="card-title">Points Log</span>
              <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>{points.length} entries</span></div>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead><tr><th>Date</th><th>House</th><th>Points</th><th>Reason</th><th>Awarded By</th><th>Delete</th></tr></thead>
                <tbody>
                  {points.slice().reverse().map(r => (
                    <tr key={r.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtDate(r.date)}</td>
                      <td><b>{r.house}</b></td>
                      <td style={{ fontWeight: 700, color: Number(r.points) > 0 ? '#16a34a' : '#dc2626', fontFamily: 'monospace' }}>
                        {Number(r.points) > 0 ? `+${r.points}` : r.points}
                      </td>
                      <td>{r.reason || '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--muted)' }}>{r.awardedBy || '—'}</td>
                      <td>
                        <button onClick={async () => { if (confirm('Delete?')) await savePoints(points.filter(p => p.id !== r.id)); }}
                          style={{ padding: '3px 9px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fee2e2', color: '#dc2626', fontSize: 11, cursor: 'pointer' }}>Del</button>
                      </td>
                    </tr>
                  ))}
                  {points.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>No points recorded yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── MAINTENANCE ── */}
      {tab === 'maintenance' && (
        <MaintenanceTab data={maintenance} onSave={saveMaintenance} />
      )}

      {/* ── BEHAVIOUR ── */}
      {tab === 'behaviour' && (
        <div className="card">
          <div className="card-head"><span className="card-title">Behaviour Records</span>
            <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>{behaviour.length} records</span></div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>Date</th><th>Student</th><th>House</th><th>Type</th><th>Severity</th><th>Description</th><th>Action</th><th>Status</th></tr></thead>
              <tbody>
                {behaviour.slice().reverse().map(r => (
                  <tr key={r.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtDate(r.date)}</td>
                    <td><b>{r.stuName}</b></td><td>{r.house}</td><td>{r.type}</td>
                    <td><StatusBadge label={r.severity} /></td>
                    <td style={{ fontSize: 12 }}>{r.description || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--muted)' }}>{r.actionTaken || '—'}</td>
                    <td><StatusBadge label={r.status || 'Open'} /></td>
                  </tr>
                ))}
                {behaviour.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>No behaviour records.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── HEALTH ── */}
      {tab === 'health' && (
        <div className="card">
          <div className="card-head"><span className="card-title">Health Watch</span></div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>Date</th><th>Student</th><th>House</th><th>Condition</th><th>Medication</th><th>Referred To</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {health.slice().reverse().map(r => (
                  <tr key={r.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtDate(r.date)}</td>
                    <td><b>{r.stuName}</b></td><td>{r.house}</td>
                    <td>{r.condition || '—'}</td>
                    <td style={{ fontSize: 12 }}>{r.medication || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--muted)' }}>{r.referredTo || '—'}</td>
                    <td><StatusBadge label={r.status || 'Monitoring'} /></td>
                    <td>
                      {r.status === 'Monitoring' && (
                        <button onClick={() => saveHealth(health.map(x => x.id === r.id ? { ...x, status: 'Healthy' } : x))}
                          style={{ padding: '3px 9px', borderRadius: 6, border: '1px solid #86efac', background: '#f0fdf4', color: '#16a34a', fontSize: 11, cursor: 'pointer' }}>
                          Mark Healthy
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {health.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>No health records.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── ACADEMIC ── */}
      {tab === 'academic' && (
        <div className="card">
          <div className="card-head"><span className="card-title">Academic Watch</span></div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>Date</th><th>Student</th><th>House</th><th>Subject</th><th>Concern</th><th>Coaching</th><th>Flag</th><th>Action</th></tr></thead>
              <tbody>
                {academic.slice().reverse().map(r => (
                  <tr key={r.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtDate(r.date)}</td>
                    <td><b>{r.stuName}</b></td><td>{r.house}</td>
                    <td>{r.subject || '—'}</td>
                    <td>{r.concern || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--muted)' }}>{r.coaching || '—'}</td>
                    <td><StatusBadge label={r.flag === 'Yes' ? 'Flagged' : 'Clear'} color={r.flag === 'Yes' ? '#dc2626' : '#16a34a'} /></td>
                    <td>
                      {r.flag === 'Yes' && (
                        <button onClick={() => saveAcademic(academic.map(x => x.id === r.id ? { ...x, flag: 'No' } : x))}
                          style={{ padding: '3px 9px', borderRadius: 6, border: '1px solid #86efac', background: '#f0fdf4', color: '#16a34a', fontSize: 11, cursor: 'pointer' }}>
                          Clear Flag
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {academic.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>No academic records.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function PointsForm({ onAdd }) {
  const [form, setForm] = useState({ date: today(), house: HOUSES[0], points: 5, reason: '', awardedBy: '' });
  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));
  const inputStyle = { width: '100%', padding: '7px 10px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 13, marginTop: 4, background: 'var(--surface)', color: 'var(--text)' };

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="card-head"><span className="card-title">Award / Deduct Points</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
        <div><label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)' }}>Date</label>
          <input type="date" value={form.date} onChange={set('date')} style={inputStyle} /></div>
        <div><label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)' }}>House</label>
          <select value={form.house} onChange={set('house')} style={inputStyle}>
            {HOUSES.map(h => <option key={h}>{h}</option>)}
          </select></div>
        <div><label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)' }}>Points (use − for deduction)</label>
          <input type="number" value={form.points} onChange={set('points')} style={inputStyle} /></div>
        <div><label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)' }}>Reason</label>
          <input value={form.reason} onChange={set('reason')} style={inputStyle} /></div>
        <div><label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)' }}>Awarded By</label>
          <input value={form.awardedBy} onChange={set('awardedBy')} style={inputStyle} /></div>
      </div>
      <div style={{ marginTop: 12 }}>
        <button className="btn btn-primary" onClick={() => onAdd(form)}>Save Points</button>
      </div>
    </div>
  );
}

function MaintenanceTab({ data, onSave }) {
  const [form, setForm] = useState({ date: today(), house: HOUSES[0], title: '', type: 'Electrical', priority: 'Medium', description: '', reportedBy: '', status: 'Open', completedOn: '', completedBy: '' });
  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));
  const inputStyle = { width: '100%', padding: '7px 10px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 13, marginTop: 4, background: 'var(--surface)', color: 'var(--text)' };
  const openCount = data.filter(r => r.status !== 'Completed' && r.status !== 'Cancelled').length;

  return (
    <>
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-head"><span className="card-title">Report Maintenance Issue</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
          {[['title','Title / Location','text'],['description','Description','text'],['reportedBy','Reported By','text']].map(([key,label,type]) => (
            <div key={key}><label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)' }}>{label}</label>
              <input type={type} value={form[key]} onChange={set(key)} style={inputStyle} /></div>
          ))}
          <div><label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)' }}>House</label>
            <select value={form.house} onChange={set('house')} style={inputStyle}>
              {HOUSES.map(h => <option key={h}>{h}</option>)}
            </select></div>
          <div><label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)' }}>Type</label>
            <select value={form.type} onChange={set('type')} style={inputStyle}>
              {['Electrical','Plumbing','Civil','Furniture','Cleaning','Other'].map(t => <option key={t}>{t}</option>)}
            </select></div>
          <div><label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)' }}>Priority</label>
            <select value={form.priority} onChange={set('priority')} style={inputStyle}>
              {['Low','Medium','High','Critical'].map(p => <option key={p}>{p}</option>)}
            </select></div>
        </div>
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-primary" onClick={() => {
            if (!form.title) return alert('Enter title');
            const id = data.length ? Math.max(...data.map(r => r.id)) + 1 : 1;
            onSave([...data, { id, ...form }]);
            setForm({ date: today(), house: HOUSES[0], title: '', type: 'Electrical', priority: 'Medium', description: '', reportedBy: '', status: 'Open', completedOn: '', completedBy: '' });
          }}>Report Issue</button>
        </div>
      </div>
      <div className="card">
        <div className="card-head"><span className="card-title">Maintenance Register</span>
          <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>Open: <b style={{ color: '#dc2626' }}>{openCount}</b> · Total: {data.length}</span></div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>Date</th><th>House</th><th>Title</th><th>Type</th><th>Priority</th><th>Status</th><th>Reported By</th><th>Action</th></tr></thead>
            <tbody>
              {data.slice().reverse().map(r => (
                <tr key={r.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtDate(r.date)}</td>
                  <td>{r.house}</td><td><b>{r.title}</b></td><td>{r.type}</td>
                  <td><StatusBadge label={r.priority} /></td>
                  <td><StatusBadge label={r.status || 'Open'} /></td>
                  <td style={{ fontSize: 12 }}>{r.reportedBy || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap', display: 'flex', gap: 4 }}>
                    {r.status === 'Open' && (
                      <button onClick={() => onSave(data.map(x => x.id === r.id ? { ...x, status: 'Completed', completedOn: today(), completedBy: 'Staff' } : x))}
                        style={{ padding: '3px 9px', borderRadius: 6, border: '1px solid #86efac', background: '#f0fdf4', color: '#16a34a', fontSize: 11, cursor: 'pointer' }}>Done</button>
                    )}
                    <button onClick={() => { if (confirm('Delete?')) onSave(data.filter(x => x.id !== r.id)); }}
                      style={{ padding: '3px 9px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fee2e2', color: '#dc2626', fontSize: 11, cursor: 'pointer' }}>Del</button>
                  </td>
                </tr>
              ))}
              {data.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>No maintenance issues reported.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
