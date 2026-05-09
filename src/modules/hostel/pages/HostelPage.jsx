import { useState } from 'react';
import { useHostel } from '../hooks/useHostel';
import { today, nextId, fmtDate, HOUSES } from '../utils/hostelUtils';
import StatusBadge from '../components/StatusBadge';

const LEAVE_TYPES   = ['Home Leave','Medical','Family Emergency','Sports','Cultural','Other'];
const OUTPASS_TYPES = ['Shopping','Medical','Outing','Religious','Other'];
const ACTIVITY_TYPES= ['Sports','Cultural','Academic','Community Service','Trip','Other'];

export default function HostelPage() {
  const { leave, outpass, outing, rollCall, activities, complaints, loading,
    saveLeave, saveOutpass, saveOuting, saveRollCall, saveActivities, saveComplaints } = useHostel();
  const [tab, setTab] = useState('leave');

  if (loading) return <div className="page-loading">Loading…</div>;

  const TABS = [
    ['leave',       '✈️ Leave'],
    ['outpass',     '🎫 Outpass'],
    ['outing',      '🚶 Outing'],
    ['rollcall',    '📣 Roll Call'],
    ['activities',  '🏆 Activities'],
    ['complaints',  '📋 Complaints'],
  ];

  return (
    <div>
      <div className="page-header">
        <div className="page-header-eyebrow">Boarding</div>
        <div className="page-header-title">Hostel Management</div>
        <div className="page-header-sub">Leave · Outpass · Outing · Roll Call · Activities · Complaints</div>
      </div>

      {/* Quick KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:14, marginBottom:20 }}>
        {[
          ['Leave Pending',    leave.filter(r=>r.status==='Pending').length,               '#f59e0b'],
          ['Outpass Today',    outpass.filter(r=>r.date===today()).length,                  '#1d4ed8'],
          ['Out Now',          outing.filter(r=>r.status==='Out').length,                   '#dc2626'],
          ['Open Complaints',  complaints.filter(r=>r.status==='Open').length,              '#7c3aed'],
        ].map(([label, value, color]) => (
          <div key={label} className="card" style={{ padding:'14px 16px' }}>
            <div style={{ fontSize:11, fontWeight:700, color, textTransform:'uppercase' }}>{label}</div>
            <div style={{ fontSize:26, fontWeight:800, color, margin:'4px 0' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:20 }}>
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ padding:'8px 14px', borderRadius:8,
              border: tab === id ? 'none' : '1.5px solid var(--border)',
              background: tab === id ? 'var(--accent)' : 'var(--surface)',
              color: tab === id ? '#fff' : 'var(--muted)',
              fontWeight: tab === id ? 700 : 600, cursor:'pointer', fontSize:13 }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'leave'      && <LeaveTab       data={leave}      onSave={saveLeave} />}
      {tab === 'outpass'    && <OutpassTab      data={outpass}    onSave={saveOutpass} />}
      {tab === 'outing'     && <OutingTab       data={outing}     onSave={saveOuting} />}
      {tab === 'rollcall'   && <RollCallTab     data={rollCall}   onSave={saveRollCall} />}
      {tab === 'activities' && <ActivitiesTab   data={activities} onSave={saveActivities} />}
      {tab === 'complaints' && <ComplaintsTab   data={complaints} onSave={saveComplaints} />}
    </div>
  );
}

/* ── SHARED HELPERS ─────────────────────────────────── */
function inputStyle() {
  return { width:'100%', padding:'7px 10px', borderRadius:8, border:'1.5px solid var(--border)', fontSize:13, marginTop:4, background:'var(--surface)', color:'var(--text)' };
}

function DelBtn({ onClick }) {
  return (
    <button onClick={onClick}
      style={{ padding:'3px 9px', borderRadius:6, border:'1px solid #fca5a5', background:'#fee2e2', color:'#dc2626', fontSize:11, cursor:'pointer' }}>
      Del
    </button>
  );
}

/* ── LEAVE ──────────────────────────────────────────── */
function LeaveTab({ data, onSave }) {
  const [form, setForm] = useState({ stuName:'', house:HOUSES[0], leaveType:LEAVE_TYPES[0], from:today(), to:today(), reason:'', approvedBy:'', status:'Pending', parent:'' });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const is = inputStyle();

  return (
    <>
      <div className="card" style={{ marginBottom:18 }}>
        <div className="card-head"><span className="card-title">Apply Leave</span></div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12 }}>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Student Name</label><input value={form.stuName} onChange={set('stuName')} style={is} /></div>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>House</label>
            <select value={form.house} onChange={set('house')} style={is}>{HOUSES.map(h=><option key={h}>{h}</option>)}</select></div>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Leave Type</label>
            <select value={form.leaveType} onChange={set('leaveType')} style={is}>{LEAVE_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>From Date</label><input type="date" value={form.from} onChange={set('from')} style={is} /></div>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>To Date</label><input type="date" value={form.to} onChange={set('to')} style={is} /></div>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Parent / Guardian Name</label><input value={form.parent} onChange={set('parent')} style={is} /></div>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Reason</label><input value={form.reason} onChange={set('reason')} style={is} /></div>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Approved By</label><input value={form.approvedBy} onChange={set('approvedBy')} style={is} /></div>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Status</label>
            <select value={form.status} onChange={set('status')} style={is}>
              {['Pending','Approved','Rejected'].map(s=><option key={s}>{s}</option>)}
            </select></div>
        </div>
        <div style={{ marginTop:12 }}>
          <button className="btn btn-primary" onClick={() => {
            if (!form.stuName) return alert('Enter student name');
            onSave([...data, { id: nextId(data), ...form }]);
            setForm({ stuName:'', house:HOUSES[0], leaveType:LEAVE_TYPES[0], from:today(), to:today(), reason:'', approvedBy:'', status:'Pending', parent:'' });
          }}>Submit Leave</button>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><span className="card-title">Leave Register</span>
          <span style={{ fontSize:11, color:'var(--muted)', fontFamily:'monospace' }}>{data.length} records</span></div>
        <div style={{ overflowX:'auto' }}>
          <table>
            <thead><tr><th>Student</th><th>House</th><th>Type</th><th>From</th><th>To</th><th>Parent</th><th>Reason</th><th>Approved By</th><th>Status</th><th>Del</th></tr></thead>
            <tbody>
              {data.length === 0 ? <tr><td colSpan={10} style={{ textAlign:'center', color:'var(--muted)', padding:40, fontStyle:'italic' }}>No leave records.</td></tr>
              : data.slice().reverse().map(r => (
                <tr key={r.id}>
                  <td><b>{r.stuName}</b></td><td>{r.house}</td>
                  <td style={{ fontSize:12 }}>{r.leaveType}</td>
                  <td style={{ fontFamily:'monospace', fontSize:12 }}>{fmtDate(r.from)}</td>
                  <td style={{ fontFamily:'monospace', fontSize:12 }}>{fmtDate(r.to)}</td>
                  <td style={{ fontSize:12 }}>{r.parent||'—'}</td>
                  <td style={{ fontSize:12, color:'var(--muted)' }}>{r.reason||'—'}</td>
                  <td style={{ fontSize:12 }}>{r.approvedBy||'—'}</td>
                  <td><StatusBadge label={r.status||'Pending'} /></td>
                  <td><DelBtn onClick={() => { if(confirm('Delete?')) onSave(data.filter(x=>x.id!==r.id)); }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ── OUTPASS ────────────────────────────────────────── */
function OutpassTab({ data, onSave }) {
  const [form, setForm] = useState({ stuName:'', house:HOUSES[0], date:today(), outTime:'', returnTime:'', purpose:OUTPASS_TYPES[0], destination:'', approvedBy:'', status:'Pending' });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const is = inputStyle();

  return (
    <>
      <div className="card" style={{ marginBottom:18 }}>
        <div className="card-head"><span className="card-title">Issue Outpass</span></div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12 }}>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Student Name</label><input value={form.stuName} onChange={set('stuName')} style={is} /></div>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>House</label>
            <select value={form.house} onChange={set('house')} style={is}>{HOUSES.map(h=><option key={h}>{h}</option>)}</select></div>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Date</label><input type="date" value={form.date} onChange={set('date')} style={is} /></div>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Out Time</label><input value={form.outTime} onChange={set('outTime')} placeholder="e.g. 14:00" style={is} /></div>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Return Time</label><input value={form.returnTime} onChange={set('returnTime')} placeholder="e.g. 17:00" style={is} /></div>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Purpose</label>
            <select value={form.purpose} onChange={set('purpose')} style={is}>{OUTPASS_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Destination</label><input value={form.destination} onChange={set('destination')} style={is} /></div>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Approved By</label><input value={form.approvedBy} onChange={set('approvedBy')} style={is} /></div>
        </div>
        <div style={{ marginTop:12 }}>
          <button className="btn btn-primary" onClick={() => {
            if (!form.stuName) return alert('Enter student name');
            onSave([...data, { id: nextId(data), ...form }]);
            setForm({ stuName:'', house:HOUSES[0], date:today(), outTime:'', returnTime:'', purpose:OUTPASS_TYPES[0], destination:'', approvedBy:'', status:'Pending' });
          }}>Issue Outpass</button>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><span className="card-title">Outpass Register</span>
          <span style={{ fontSize:11, color:'var(--muted)', fontFamily:'monospace' }}>{data.length} records</span></div>
        <div style={{ overflowX:'auto' }}>
          <table>
            <thead><tr><th>Student</th><th>House</th><th>Date</th><th>Out</th><th>Return</th><th>Purpose</th><th>Destination</th><th>Approved By</th><th>Del</th></tr></thead>
            <tbody>
              {data.length === 0 ? <tr><td colSpan={9} style={{ textAlign:'center', color:'var(--muted)', padding:40, fontStyle:'italic' }}>No outpass records.</td></tr>
              : data.slice().reverse().map(r => (
                <tr key={r.id}>
                  <td><b>{r.stuName}</b></td><td>{r.house}</td>
                  <td style={{ fontFamily:'monospace', fontSize:12 }}>{fmtDate(r.date)}</td>
                  <td style={{ fontFamily:'monospace', fontSize:12 }}>{r.outTime||'—'}</td>
                  <td style={{ fontFamily:'monospace', fontSize:12 }}>{r.returnTime||'—'}</td>
                  <td style={{ fontSize:12 }}>{r.purpose}</td>
                  <td style={{ fontSize:12, color:'var(--muted)' }}>{r.destination||'—'}</td>
                  <td style={{ fontSize:12 }}>{r.approvedBy||'—'}</td>
                  <td><DelBtn onClick={() => { if(confirm('Delete?')) onSave(data.filter(x=>x.id!==r.id)); }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ── OUTING ─────────────────────────────────────────── */
function OutingTab({ data, onSave }) {
  const [form, setForm] = useState({ stuName:'', house:HOUSES[0], date:today(), outTime:'', expectedReturn:'', actualReturn:'', destination:'', escortedBy:'', status:'Out' });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const is = inputStyle();
  const outNow = data.filter(r => r.status === 'Out');

  return (
    <>
      {outNow.length > 0 && (
        <div style={{ background:'#fff7ed', border:'1.5px solid #fed7aa', borderRadius:10, padding:'10px 16px', marginBottom:16, fontSize:12.5, color:'#d97706' }}>
          🚶 <b>Currently Out ({outNow.length}):</b> {outNow.map(r => r.stuName).join(', ')}
        </div>
      )}

      <div className="card" style={{ marginBottom:18 }}>
        <div className="card-head"><span className="card-title">Record Outing</span></div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12 }}>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Student Name</label><input value={form.stuName} onChange={set('stuName')} style={is} /></div>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>House</label>
            <select value={form.house} onChange={set('house')} style={is}>{HOUSES.map(h=><option key={h}>{h}</option>)}</select></div>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Date</label><input type="date" value={form.date} onChange={set('date')} style={is} /></div>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Out Time</label><input value={form.outTime} onChange={set('outTime')} placeholder="e.g. 14:00" style={is} /></div>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Expected Return</label><input value={form.expectedReturn} onChange={set('expectedReturn')} placeholder="e.g. 18:00" style={is} /></div>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Destination</label><input value={form.destination} onChange={set('destination')} style={is} /></div>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Escorted By</label><input value={form.escortedBy} onChange={set('escortedBy')} style={is} /></div>
        </div>
        <div style={{ marginTop:12 }}>
          <button className="btn btn-primary" onClick={() => {
            if (!form.stuName) return alert('Enter student name');
            onSave([...data, { id: nextId(data), ...form }]);
            setForm({ stuName:'', house:HOUSES[0], date:today(), outTime:'', expectedReturn:'', actualReturn:'', destination:'', escortedBy:'', status:'Out' });
          }}>Record Outing</button>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><span className="card-title">Outing Register</span>
          <span style={{ fontSize:11, color:'var(--muted)', fontFamily:'monospace' }}>{data.length} records</span></div>
        <div style={{ overflowX:'auto' }}>
          <table>
            <thead><tr><th>Student</th><th>House</th><th>Date</th><th>Out Time</th><th>Exp. Return</th><th>Destination</th><th>Escorted By</th><th>Status</th><th>Return</th><th>Del</th></tr></thead>
            <tbody>
              {data.length === 0 ? <tr><td colSpan={10} style={{ textAlign:'center', color:'var(--muted)', padding:40, fontStyle:'italic' }}>No outing records.</td></tr>
              : data.slice().reverse().map(r => (
                <tr key={r.id}>
                  <td><b>{r.stuName}</b></td><td>{r.house}</td>
                  <td style={{ fontFamily:'monospace', fontSize:12 }}>{fmtDate(r.date)}</td>
                  <td style={{ fontFamily:'monospace', fontSize:12 }}>{r.outTime||'—'}</td>
                  <td style={{ fontFamily:'monospace', fontSize:12 }}>{r.expectedReturn||'—'}</td>
                  <td style={{ fontSize:12, color:'var(--muted)' }}>{r.destination||'—'}</td>
                  <td style={{ fontSize:12 }}>{r.escortedBy||'—'}</td>
                  <td><StatusBadge label={r.status||'Out'} /></td>
                  <td>
                    {r.status === 'Out' && (
                      <button onClick={() => {
                        const time = prompt('Enter actual return time:') || '';
                        onSave(data.map(x => x.id === r.id ? { ...x, status:'Returned', actualReturn: time } : x));
                      }}
                        style={{ padding:'3px 9px', borderRadius:6, border:'1px solid #86efac', background:'#f0fdf4', color:'#16a34a', fontSize:11, cursor:'pointer' }}>
                        Returned
                      </button>
                    )}
                  </td>
                  <td><DelBtn onClick={() => { if(confirm('Delete?')) onSave(data.filter(x=>x.id!==r.id)); }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ── ROLL CALL ──────────────────────────────────────── */
function RollCallTab({ data, onSave }) {
  const [form, setForm] = useState({ date:today(), time:'', session:'Morning', house:HOUSES[0], present:0, absent:0, absentees:'', takenBy:'', notes:'' });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const is = inputStyle();

  return (
    <>
      <div className="card" style={{ marginBottom:18 }}>
        <div className="card-head"><span className="card-title">Record Roll Call</span></div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12 }}>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Date</label><input type="date" value={form.date} onChange={set('date')} style={is} /></div>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Time</label><input value={form.time} onChange={set('time')} placeholder="e.g. 21:30" style={is} /></div>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Session</label>
            <select value={form.session} onChange={set('session')} style={is}>
              {['Morning','Afternoon','Evening','Night'].map(s=><option key={s}>{s}</option>)}
            </select></div>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>House</label>
            <select value={form.house} onChange={set('house')} style={is}>{HOUSES.map(h=><option key={h}>{h}</option>)}</select></div>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Present Count</label><input type="number" value={form.present} onChange={set('present')} style={is} /></div>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Absent Count</label><input type="number" value={form.absent} onChange={set('absent')} style={is} /></div>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Absent Names</label><input value={form.absentees} onChange={set('absentees')} placeholder="Comma separated" style={is} /></div>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Taken By</label><input value={form.takenBy} onChange={set('takenBy')} style={is} /></div>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Notes</label><input value={form.notes} onChange={set('notes')} style={is} /></div>
        </div>
        <div style={{ marginTop:12 }}>
          <button className="btn btn-primary" onClick={() => {
            onSave([...data, { id: nextId(data), ...form }]);
            setForm({ date:today(), time:'', session:'Morning', house:HOUSES[0], present:0, absent:0, absentees:'', takenBy:'', notes:'' });
          }}>Save Roll Call</button>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><span className="card-title">Roll Call Register</span>
          <span style={{ fontSize:11, color:'var(--muted)', fontFamily:'monospace' }}>{data.length} records</span></div>
        <div style={{ overflowX:'auto' }}>
          <table>
            <thead><tr><th>Date</th><th>Time</th><th>Session</th><th>House</th><th>Present</th><th>Absent</th><th>Absentees</th><th>Taken By</th><th>Del</th></tr></thead>
            <tbody>
              {data.length === 0 ? <tr><td colSpan={9} style={{ textAlign:'center', color:'var(--muted)', padding:40, fontStyle:'italic' }}>No roll call records.</td></tr>
              : data.slice().reverse().map(r => (
                <tr key={r.id}>
                  <td style={{ fontFamily:'monospace', fontSize:12 }}>{fmtDate(r.date)}</td>
                  <td style={{ fontFamily:'monospace', fontSize:12 }}>{r.time||'—'}</td>
                  <td style={{ fontSize:12 }}>{r.session}</td>
                  <td>{r.house}</td>
                  <td style={{ fontFamily:'monospace', fontWeight:700, color:'#16a34a' }}>{r.present}</td>
                  <td style={{ fontFamily:'monospace', fontWeight:700, color: Number(r.absent) > 0 ? '#dc2626' : 'var(--muted)' }}>{r.absent}</td>
                  <td style={{ fontSize:12, color:'var(--muted)' }}>{r.absentees||'—'}</td>
                  <td style={{ fontSize:12 }}>{r.takenBy||'—'}</td>
                  <td><DelBtn onClick={() => { if(confirm('Delete?')) onSave(data.filter(x=>x.id!==r.id)); }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ── ACTIVITIES ─────────────────────────────────────── */
function ActivitiesTab({ data, onSave }) {
  const [form, setForm] = useState({ date:today(), title:'', type:ACTIVITY_TYPES[0], house:'All', participants:'', incharge:'', venue:'', result:'', notes:'' });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const is = inputStyle();

  return (
    <>
      <div className="card" style={{ marginBottom:18 }}>
        <div className="card-head"><span className="card-title">Record Activity</span></div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12 }}>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Date</label><input type="date" value={form.date} onChange={set('date')} style={is} /></div>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Activity Title</label><input value={form.title} onChange={set('title')} style={is} /></div>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Type</label>
            <select value={form.type} onChange={set('type')} style={is}>{ACTIVITY_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>House</label>
            <select value={form.house} onChange={set('house')} style={is}><option>All</option>{HOUSES.map(h=><option key={h}>{h}</option>)}</select></div>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Participants</label><input value={form.participants} onChange={set('participants')} style={is} /></div>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>In-charge</label><input value={form.incharge} onChange={set('incharge')} style={is} /></div>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Venue</label><input value={form.venue} onChange={set('venue')} style={is} /></div>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Result / Outcome</label><input value={form.result} onChange={set('result')} style={is} /></div>
        </div>
        <div style={{ marginTop:12 }}>
          <button className="btn btn-primary" onClick={() => {
            if (!form.title) return alert('Enter activity title');
            onSave([...data, { id: nextId(data), ...form }]);
            setForm({ date:today(), title:'', type:ACTIVITY_TYPES[0], house:'All', participants:'', incharge:'', venue:'', result:'', notes:'' });
          }}>Save Activity</button>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><span className="card-title">Activities Register</span>
          <span style={{ fontSize:11, color:'var(--muted)', fontFamily:'monospace' }}>{data.length} records</span></div>
        <div style={{ overflowX:'auto' }}>
          <table>
            <thead><tr><th>Date</th><th>Title</th><th>Type</th><th>House</th><th>Participants</th><th>In-charge</th><th>Venue</th><th>Result</th><th>Del</th></tr></thead>
            <tbody>
              {data.length === 0 ? <tr><td colSpan={9} style={{ textAlign:'center', color:'var(--muted)', padding:40, fontStyle:'italic' }}>No activities recorded.</td></tr>
              : data.slice().reverse().map(r => (
                <tr key={r.id}>
                  <td style={{ fontFamily:'monospace', fontSize:12 }}>{fmtDate(r.date)}</td>
                  <td><b>{r.title}</b></td><td style={{ fontSize:12 }}>{r.type}</td><td>{r.house}</td>
                  <td style={{ fontSize:12 }}>{r.participants||'—'}</td>
                  <td style={{ fontSize:12 }}>{r.incharge||'—'}</td>
                  <td style={{ fontSize:12, color:'var(--muted)' }}>{r.venue||'—'}</td>
                  <td style={{ fontSize:12, color:'var(--muted)' }}>{r.result||'—'}</td>
                  <td><DelBtn onClick={() => { if(confirm('Delete?')) onSave(data.filter(x=>x.id!==r.id)); }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ── COMPLAINTS ─────────────────────────────────────── */
function ComplaintsTab({ data, onSave }) {
  const [form, setForm] = useState({ date:today(), stuName:'', house:HOUSES[0], category:'Food', description:'', filedBy:'', assignedTo:'', status:'Open', resolution:'' });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const is = inputStyle();

  return (
    <>
      <div className="card" style={{ marginBottom:18 }}>
        <div className="card-head"><span className="card-title">File Complaint</span></div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12 }}>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Student Name</label><input value={form.stuName} onChange={set('stuName')} style={is} /></div>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>House</label>
            <select value={form.house} onChange={set('house')} style={is}>{HOUSES.map(h=><option key={h}>{h}</option>)}</select></div>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Category</label>
            <select value={form.category} onChange={set('category')} style={is}>
              {['Food','Hostel','Bullying','Health','Academic','Staff','Facilities','Other'].map(c=><option key={c}>{c}</option>)}
            </select></div>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Date</label><input type="date" value={form.date} onChange={set('date')} style={is} /></div>
          <div style={{ gridColumn:'1 / -1' }}><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Description</label>
            <input value={form.description} onChange={set('description')} style={is} /></div>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Filed By</label><input value={form.filedBy} onChange={set('filedBy')} style={is} /></div>
          <div><label style={{ fontSize:11.5, fontWeight:700, color:'var(--muted)' }}>Assigned To</label><input value={form.assignedTo} onChange={set('assignedTo')} style={is} /></div>
        </div>
        <div style={{ marginTop:12 }}>
          <button className="btn btn-primary" onClick={() => {
            if (!form.stuName||!form.description) return alert('Fill student name and description');
            onSave([...data, { id: nextId(data), ...form }]);
            setForm({ date:today(), stuName:'', house:HOUSES[0], category:'Food', description:'', filedBy:'', assignedTo:'', status:'Open', resolution:'' });
          }}>File Complaint</button>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><span className="card-title">Complaints Register</span>
          <span style={{ fontSize:11, color:'var(--muted)', fontFamily:'monospace' }}>{data.length} records</span></div>
        <div style={{ overflowX:'auto' }}>
          <table>
            <thead><tr><th>Date</th><th>Student</th><th>House</th><th>Category</th><th>Description</th><th>Filed By</th><th>Assigned To</th><th>Status</th><th>Resolve</th><th>Del</th></tr></thead>
            <tbody>
              {data.length === 0 ? <tr><td colSpan={10} style={{ textAlign:'center', color:'var(--muted)', padding:40, fontStyle:'italic' }}>No complaints filed.</td></tr>
              : data.slice().reverse().map(r => (
                <tr key={r.id}>
                  <td style={{ fontFamily:'monospace', fontSize:12 }}>{fmtDate(r.date)}</td>
                  <td><b>{r.stuName}</b></td><td>{r.house}</td>
                  <td style={{ fontSize:12 }}>{r.category}</td>
                  <td style={{ fontSize:12, color:'var(--muted)' }}>{r.description}</td>
                  <td style={{ fontSize:12 }}>{r.filedBy||'—'}</td>
                  <td style={{ fontSize:12 }}>{r.assignedTo||'—'}</td>
                  <td><StatusBadge label={r.status||'Open'} /></td>
                  <td>
                    {r.status === 'Open' && (
                      <button onClick={() => {
                        const res = prompt('Resolution notes:') || '';
                        onSave(data.map(x => x.id === r.id ? { ...x, status:'Resolved', resolution: res } : x));
                      }}
                        style={{ padding:'3px 9px', borderRadius:6, border:'1px solid #86efac', background:'#f0fdf4', color:'#16a34a', fontSize:11, cursor:'pointer' }}>
                        Resolve
                      </button>
                    )}
                  </td>
                  <td><DelBtn onClick={() => { if(confirm('Delete?')) onSave(data.filter(x=>x.id!==r.id)); }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
