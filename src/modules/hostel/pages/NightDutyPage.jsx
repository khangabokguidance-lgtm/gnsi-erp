import { useState } from 'react';
import { useNightDuty } from '../hooks/useNightDuty';
import { today, fmtDate } from '../utils/hostelUtils';
import StatusBadge from '../components/StatusBadge';

export default function NightDutyPage() {
  const { records, loading, addRecord, updateRecord, deleteRecord } = useNightDuty();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    date: today(), shift: 'Night',
    staff1: '', staff2: '', post: '', notes: '',
  });

  if (loading) return <div className="page-loading">Loading…</div>;

  const filtered = records.filter(r =>
    !search ||
    r.date.includes(search) ||
    r.staff1.toLowerCase().includes(search.toLowerCase()) ||
    (r.staff2 || '').toLowerCase().includes(search.toLowerCase())
  );

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const inputStyle = {
    width: '100%', padding: '7px 10px', borderRadius: 8,
    border: '1.5px solid var(--border)', fontSize: 13, marginTop: 4,
    background: 'var(--surface)', color: 'var(--text)',
  };

  const shiftColor = { Evening: '#7c3aed', Night: '#1d4ed8', 'Early Morning': '#16a34a' };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-eyebrow">Boarding — Security</div>
        <div className="page-header-title">Night Duty Roster</div>
        <div className="page-header-sub">Evening · Night · Early Morning shifts</div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 14, marginBottom: 20 }}>
        {[
          ['Total Shifts', records.length, '#1d4ed8'],
          ['This Month',   records.filter(r => r.date?.startsWith(today().slice(0,7))).length, '#7c3aed'],
          ['Night Shifts', records.filter(r => r.shift === 'Night').length, '#1d4ed8'],
          ['Signed',       records.filter(r => !!r.signature).length, '#16a34a'],
        ].map(([label, value, color]) => (
          <div key={label} className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase' }}>{label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color, margin: '4px 0' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Add Form */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-head"><span className="card-title">Add Shift</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)' }}>Date</label>
            <input type="date" value={form.date} onChange={set('date')} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)' }}>Shift</label>
            <select value={form.shift} onChange={set('shift')} style={inputStyle}>
              {['Evening', 'Night', 'Early Morning'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          {[['staff1','Staff 1 Name'],['staff2','Staff 2 Name'],['post','Post / Location'],['notes','Notes']].map(([key, label]) => (
            <div key={key}>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)' }}>{label}</label>
              <input value={form[key]} onChange={set(key)} style={inputStyle} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-primary" onClick={() => {
            if (!form.staff1) return alert('Enter at least Staff 1 name');
            addRecord(form);
            setForm({ date: today(), shift: 'Night', staff1: '', staff2: '', post: '', notes: '' });
          }}>
            Add Shift
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 14 }}>
        <input
          placeholder="Search by date or staff name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '7px 12px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 13, background: 'var(--surface)', color: 'var(--text)', minWidth: 280 }}
        />
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-head">
          <span className="card-title">Night Duty Register</span>
          <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>{records.length} shifts</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>#</th><th>Date</th><th>Shift</th><th>Staff 1</th>
                <th>Staff 2</th><th>Post</th><th>Notes</th><th>Signature</th><th>Delete</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--muted)', padding: 40, fontStyle: 'italic' }}>No night duty records.</td></tr>
              ) : filtered.slice().reverse().map((r, i) => (
                <tr key={r.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>{filtered.length - i}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtDate(r.date)}</td>
                  <td><StatusBadge label={r.shift} color={shiftColor[r.shift]} /></td>
                  <td><b>{r.staff1 || '—'}</b></td>
                  <td>{r.staff2 || '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{r.post || '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{r.notes || '—'}</td>
                  <td>
                    {r.signature
                      ? <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 700 }}>✓ {r.signature}</span>
                      : <button
                          onClick={() => { const sig = prompt('Enter your name to sign:'); if (sig) updateRecord(r.id, { signature: sig }); }}
                          style={{ padding: '3px 10px', borderRadius: 6, border: '1.5px solid var(--border)', background: 'var(--surface)', fontSize: 11, cursor: 'pointer' }}
                        >Sign</button>
                    }
                  </td>
                  <td>
                    <button
                      onClick={() => { if (confirm('Delete?')) deleteRecord(r.id); }}
                      style={{ padding: '3px 9px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fee2e2', color: '#dc2626', fontSize: 11, cursor: 'pointer' }}
                    >Del</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
