import { useState } from 'react';
import { useSickbay } from '../hooks/useSickbay';
import { today, fmtDate, HOUSES } from '../utils/hostelUtils';
import StatusBadge from '../components/StatusBadge';

export default function SickbayPage() {
  const { records, loading, admit, discharge, deleteRecord } = useSickbay();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    stuName: '', house: HOUSES[0], admittedOn: today(),
    complaint: '', temp: '', medicine: '',
    referredTo: '', attendedBy: '', notes: '',
  });

  if (loading) return <div className="page-loading">Loading…</div>;

  const admitted = records.filter(r => r.status === 'Admitted');
  const filtered = records.filter(r =>
    !search || r.stuName.toLowerCase().includes(search.toLowerCase())
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
        <div className="page-header-eyebrow">Boarding — Medical</div>
        <div className="page-header-title">Sick Bay</div>
        <div className="page-header-sub">Admissions, medication and discharge records</div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 14, marginBottom: 20 }}>
        {[
          ['Admitted Now', admitted.length,                                  '#dc2626'],
          ['Total Records',records.length,                                   '#1d4ed8'],
          ['Referred',     records.filter(r => r.referredTo).length,         '#f59e0b'],
          ['Discharged',   records.filter(r => r.status === 'Discharged').length, '#16a34a'],
        ].map(([label, value, color]) => (
          <div key={label} className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase' }}>{label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color, margin: '4px 0' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Currently Admitted Banner */}
      {admitted.length > 0 && (
        <div style={{ background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 12.5, color: '#dc2626' }}>
          🏥 <b>Currently in Sick Bay:</b> {admitted.map(r => r.stuName).join(', ')}
        </div>
      )}

      {/* Admit Form */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-head"><span className="card-title">Admit Student</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
          {[
            ['stuName',    'Student Name',          'text'],
            ['admittedOn', 'Admitted On',           'date'],
            ['complaint',  'Complaint',             'text'],
            ['temp',       'Temperature',           'text'],
            ['medicine',   'Medicine / Treatment',  'text'],
            ['referredTo', 'Referred To (Hospital)','text'],
            ['attendedBy', 'Attended By',           'text'],
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

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)' }}>Notes</label>
            <textarea value={form.notes} onChange={set('notes')} rows={2}
              style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <button className="btn btn-primary" onClick={() => {
            if (!form.stuName || !form.complaint) return alert('Please fill Student Name and Complaint');
            admit({ ...form, status: 'Admitted' });
            setForm({ stuName: '', house: HOUSES[0], admittedOn: today(), complaint: '', temp: '', medicine: '', referredTo: '', attendedBy: '', notes: '' });
          }}>
            Admit Student
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 14 }}>
        <input
          placeholder="Search by student name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '7px 12px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 13, background: 'var(--surface)', color: 'var(--text)', minWidth: 280 }}
        />
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-head">
          <span className="card-title">Sick Bay Register</span>
          <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>{records.length} total</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Student</th><th>Admitted On</th><th>Complaint</th><th>Temp</th>
                <th>Medicine</th><th>Referred To</th><th>Attended By</th>
                <th>Status</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--muted)', padding: 40, fontStyle: 'italic' }}>No sick bay records.</td></tr>
              ) : filtered.slice().reverse().map(r => (
                <tr key={r.id}>
                  <td>
                    <b>{r.stuName}</b>
                    <br />
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>{r.house}</span>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtDate(r.admittedOn)}</td>
                  <td>{r.complaint || '—'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.temp || '—'}</td>
                  <td style={{ fontSize: 12 }}>{r.medicine || '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{r.referredTo || '—'}</td>
                  <td style={{ fontSize: 12 }}>{r.attendedBy || '—'}</td>
                  <td><StatusBadge label={r.status || 'Admitted'} /></td>
                  <td style={{ whiteSpace: 'nowrap', display: 'flex', gap: 4 }}>
                    {r.status === 'Admitted' && (
                      <button
                        onClick={() => discharge(r.id, prompt('Discharge remarks:') || '')}
                        style={{ padding: '3px 9px', borderRadius: 6, border: '1px solid #86efac', background: '#f0fdf4', color: '#16a34a', fontSize: 11, cursor: 'pointer' }}
                      >Discharge</button>
                    )}
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
