import { useState } from 'react';
import { useDiscipline } from '../hooks/useDiscipline';
import { today, fmtDate, HOUSES } from '../utils/hostelUtils';
import StatusBadge from '../components/StatusBadge';

export default function DisciplinePage() {
  const { records, loading, addRecord, deleteRecord } = useDiscipline();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    date: today(), stuName: '', house: HOUSES[0],
    type: '', severity: 'Medium', description: '',
    actionTaken: '', reportedBy: '',
  });

  if (loading) return <div className="page-loading">Loading…</div>;

  const filtered = records.filter(r =>
    !search ||
    r.stuName.toLowerCase().includes(search.toLowerCase()) ||
    r.house.toLowerCase().includes(search.toLowerCase())
  );

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const inputStyle = {
    width: '100%', padding: '7px 10px', borderRadius: 8,
    border: '1.5px solid var(--border)', fontSize: 13, marginTop: 4,
    background: 'var(--surface)', color: 'var(--text)',
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-eyebrow">Boarding</div>
        <div className="page-header-title">Discipline Records</div>
        <div className="page-header-sub">Track all student discipline incidents by house</div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 14, marginBottom: 20 }}>
        {[
          ['Total',       records.length,                                                        '#1d4ed8'],
          ['This Month',  records.filter(r => r.date?.startsWith(today().slice(0,7))).length,    '#7c3aed'],
          ['Critical',    records.filter(r => r.severity === 'Critical').length,                 '#dc2626'],
          ['No Action',   records.filter(r => !r.actionTaken).length,                            '#f59e0b'],
        ].map(([label, value, color]) => (
          <div key={label} className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase' }}>{label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color, margin: '4px 0' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Add Form */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-head"><span className="card-title">Record Incident</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
          {[
            ['stuName',    'Student Name',  'text'],
            ['date',       'Date',          'date'],
            ['type',       'Incident Type', 'text'],
            ['description','Description',   'text'],
            ['actionTaken','Action Taken',  'text'],
            ['reportedBy', 'Reported By',   'text'],
          ].map(([key, label, type]) => (
            <div key={key}>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)' }}>{label}</label>
              <input type={type} value={form[key]} onChange={set(key)} style={inputStyle} />
            </div>
          ))}

          <div>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)' }}>House</label>
            <select value={form.house} onChange={set('house')} style={inputStyle}>
              {HOUSES.map(h => <option key={h}>{h}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)' }}>Severity</label>
            <select value={form.severity} onChange={set('severity')} style={inputStyle}>
              {['Low', 'Medium', 'High', 'Critical'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <button className="btn btn-primary" onClick={() => {
            if (!form.stuName || !form.type) return alert('Please fill Student Name and Incident Type');
            addRecord(form);
            setForm({ date: today(), stuName: '', house: HOUSES[0], type: '', severity: 'Medium', description: '', actionTaken: '', reportedBy: '' });
          }}>
            Save Record
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 14 }}>
        <input
          placeholder="Search by student name or house…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '7px 12px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 13, background: 'var(--surface)', color: 'var(--text)', minWidth: 280 }}
        />
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-head">
          <span className="card-title">Discipline Register</span>
          <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>{filtered.length} records</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Date</th><th>Student</th><th>House</th><th>Type</th>
                <th>Severity</th><th>Description</th><th>Action Taken</th>
                <th>Reported By</th><th>Delete</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--muted)', padding: 40, fontStyle: 'italic' }}>
                  No records found.
                </td></tr>
              ) : filtered.slice().reverse().map(r => (
                <tr key={r.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtDate(r.date)}</td>
                  <td><b>{r.stuName}</b></td>
                  <td>{r.house}</td>
                  <td>{r.type}</td>
                  <td><StatusBadge label={r.severity} /></td>
                  <td style={{ fontSize: 12 }}>{r.description || '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{r.actionTaken || '—'}</td>
                  <td style={{ fontSize: 12 }}>{r.reportedBy || '—'}</td>
                  <td>
                    <button
                      onClick={() => { if (confirm('Delete this record?')) deleteRecord(r.id); }}
                      style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fee2e2', color: '#dc2626', fontSize: 11, cursor: 'pointer' }}
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
