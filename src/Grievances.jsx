import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from './supabase';

// ============================================================
// Grievances.jsx
// Parent complaints against teachers (e.g. concerns about a
// student's academic weakness). Admin/staff can log grievances
// directly; parent-portal submissions land here with source
// tagged 'parent_portal' for triage.
//
// Design language: Ledger & Crest
//   navy  #0B1E3D   |   brass gold #C9A24B   |   serif headers
// ============================================================

const NAVY = '#0B1E3D';
const GOLD = '#C9A24B';
const CREAM = '#FBF8F1';

const STATUS_FLOW = ['Open', 'In Progress', 'Resolved', 'Closed'];
const CATEGORIES = [
  'Academic Weakness',
  'Behavioral',
  'Communication',
  'Attendance Handling',
  'Discipline',
  'Other',
];

const STATUS_COLORS = {
  Open: { bg: '#FDEBEC', text: '#B3261E', border: '#F3C0C2' },
  'In Progress': { bg: '#FFF6E0', text: '#8A6100', border: '#F0DDA0' },
  Resolved: { bg: '#E7F5EC', text: '#1E7A43', border: '#B9E3C6' },
  Closed: { bg: '#EDEDED', text: '#555', border: '#D6D6D6' },
};

export default function Grievances({ currentStaff }) {
  const [grievances, setGrievances] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filterStatus, setFilterStatus] = useState('All');
  const [filterSource, setFilterSource] = useState('All');
  const [filterCategory, setFilterCategory] = useState('All');
  const [search, setSearch] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selected, setSelected] = useState(null); // for detail/resolution drawer

  const emptyForm = {
    student_id: '',
    teacher_id: '',
    category: 'Academic Weakness',
    description: '',
    filed_by_name: '',
    filed_by_contact: '',
    assigned_staff_id: '',
  };
  const [form, setForm] = useState(emptyForm);

  // ---------------- Data loading ----------------

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [gRes, sRes, stRes] = await Promise.all([
        supabase
          .from('grievances')
          .select(`
            *,
            student:student_id ( id, full_name, class_name, course ),
            teacher:teacher_id ( id, full_name ),
            assigned:assigned_staff_id ( id, full_name ),
            logger:logged_by_staff_id ( id, full_name )
          `)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false }),
        supabase.from('staff_profiles').select('id, full_name, role').order('full_name'),
        supabase.from('students').select('id, full_name, class_name, course').order('full_name'),
      ]);

      if (gRes.error) throw gRes.error;
      if (sRes.error) throw sRes.error;
      if (stRes.error) throw stRes.error;

      setGrievances(gRes.data || []);
      setStaffList(sRes.data || []);
      setStudents(stRes.data || []);
    } catch (err) {
      console.error('Grievances load error:', err);
      setError(err.message || 'Failed to load grievances.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ---------------- Derived / filtered list ----------------

  const filtered = useMemo(() => {
    return grievances.filter((g) => {
      if (filterStatus !== 'All' && g.status !== filterStatus) return false;
      if (filterSource !== 'All' && g.source !== filterSource) return false;
      if (filterCategory !== 'All' && g.category !== filterCategory) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = [
          g.description,
          g.filed_by_name,
          g.student?.full_name,
          g.teacher?.full_name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [grievances, filterStatus, filterSource, filterCategory, search]);

  const counts = useMemo(() => {
    const c = { Open: 0, 'In Progress': 0, Resolved: 0, Closed: 0 };
    grievances.forEach((g) => {
      if (c[g.status] !== undefined) c[g.status] += 1;
    });
    return c;
  }, [grievances]);

  // ---------------- Actions ----------------

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmitNew = async (e) => {
    e.preventDefault();
    if (!form.description.trim()) {
      alert('Please describe the grievance.');
      return;
    }
    try {
      const payload = {
        student_id: form.student_id || null,
        teacher_id: form.teacher_id || null,
        subject: form.category,
        category: form.category,
        description: form.description.trim(),
        source: 'admin_logged',
        filed_by_name: form.filed_by_name || null,
        filed_by_contact: form.filed_by_contact || null,
        logged_by_staff_id: currentStaff?.id || null,
        assigned_staff_id: form.assigned_staff_id || null,
        status: 'Open',
      };
      const { error: insertError } = await supabase.from('grievances').insert(payload);
      if (insertError) throw insertError;
      resetForm();
      loadAll();
    } catch (err) {
      console.error('Insert grievance error:', err);
      alert('Failed to save grievance: ' + err.message);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      const { error: updErr } = await supabase.from('grievances').update({ status }).eq('id', id);
      if (updErr) throw updErr;
      loadAll();
      if (selected?.id === id) setSelected((prev) => ({ ...prev, status }));
    } catch (err) {
      alert('Failed to update status: ' + err.message);
    }
  };

  const saveResolution = async (id, { assigned_staff_id, resolution_notes, follow_up_date, status }) => {
    try {
      const { error: updErr } = await supabase
        .from('grievances')
        .update({ assigned_staff_id, resolution_notes, follow_up_date, status })
        .eq('id', id);
      if (updErr) throw updErr;
      loadAll();
      setSelected(null);
    } catch (err) {
      alert('Failed to save resolution: ' + err.message);
    }
  };

  const softDelete = async (id) => {
    if (!window.confirm('Remove this grievance record? It will be archived, not permanently deleted.')) return;
    try {
      const { error: delErr } = await supabase.from('grievances').update({ is_deleted: true }).eq('id', id);
      if (delErr) throw delErr;
      loadAll();
      setSelected(null);
    } catch (err) {
      alert('Failed to remove: ' + err.message);
    }
  };

  // ---------------- Export ----------------

  const exportTSV = () => {
    const headers = [
      'Date', 'Student', 'Class', 'Teacher', 'Category', 'Description',
      'Filed By', 'Contact', 'Source', 'Status', 'Assigned To', 'Resolution Notes', 'Follow-up Date',
    ];
    const rows = filtered.map((g) => [
      new Date(g.created_at).toLocaleDateString('en-IN'),
      g.student?.full_name || '',
      g.student?.class_name || '',
      g.teacher?.full_name || '',
      g.category,
      (g.description || '').replace(/\t|\n/g, ' '),
      g.filed_by_name || '',
      g.filed_by_contact || '',
      g.source === 'parent_portal' ? 'Parent Portal' : 'Admin Logged',
      g.status,
      g.assigned?.full_name || '',
      (g.resolution_notes || '').replace(/\t|\n/g, ' '),
      g.follow_up_date || '',
    ]);
    const tsv = [headers, ...rows].map((r) => r.join('\t')).join('\n');
    const blob = new Blob([tsv], { type: 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Grievances_${new Date().toISOString().slice(0, 10)}.tsv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printRecord = (g) => {
    const win = window.open('', '_blank');
    win.document.write(`
      <html>
      <head>
        <title>Grievance Record - ${g.id}</title>
        <style>
          body { font-family: Georgia, 'Times New Roman', serif; color: #0B1E3D; padding: 40px; }
          .letterhead { text-align: center; border-bottom: 3px solid #C9A24B; padding-bottom: 16px; margin-bottom: 24px; }
          .letterhead h1 { margin: 0; font-size: 22px; letter-spacing: 1px; }
          .letterhead p { margin: 4px 0 0; font-size: 12px; color: #555; }
          h2 { font-size: 16px; border-bottom: 1px solid #C9A24B; padding-bottom: 6px; margin-top: 28px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          td { padding: 6px 8px; vertical-align: top; font-size: 13px; }
          td.label { font-weight: bold; width: 180px; color: #0B1E3D; }
          .desc-box { border: 1px solid #ccc; padding: 12px; margin-top: 8px; font-size: 13px; min-height: 60px; }
          .status-badge { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; }
          .footer { margin-top: 60px; display: flex; justify-content: space-between; font-size: 12px; }
          .sig-line { border-top: 1px solid #333; width: 200px; text-align: center; padding-top: 4px; margin-top: 40px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="letterhead">
          <h1>GUIDANCE NAVODAYA &amp; SAINIK INSTITUTE</h1>
          <p>Khangabok, Thoubal, Manipur</p>
          <p style="margin-top:8px; font-weight:bold;">GRIEVANCE RECORD</p>
        </div>
        <table>
          <tr><td class="label">Record ID</td><td>GRV-${String(g.id).padStart(5, '0')}</td></tr>
          <tr><td class="label">Date Filed</td><td>${new Date(g.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</td></tr>
          <tr><td class="label">Category</td><td>${g.category}</td></tr>
          <tr><td class="label">Student Concerned</td><td>${g.student?.full_name || '—'} ${g.student?.class_name ? '(' + g.student.class_name + ')' : ''}</td></tr>
          <tr><td class="label">Teacher Concerned</td><td>${g.teacher?.full_name || '—'}</td></tr>
          <tr><td class="label">Filed By</td><td>${g.filed_by_name || '—'} ${g.filed_by_contact ? '· ' + g.filed_by_contact : ''}</td></tr>
          <tr><td class="label">Source</td><td>${g.source === 'parent_portal' ? 'Parents Portal (Self-Service)' : 'Logged by Staff' + (g.logger?.full_name ? ' — ' + g.logger.full_name : '')}</td></tr>
          <tr><td class="label">Status</td><td>${g.status}</td></tr>
          <tr><td class="label">Assigned To</td><td>${g.assigned?.full_name || 'Not yet assigned'}</td></tr>
        </table>

        <h2>Description of Grievance</h2>
        <div class="desc-box">${(g.description || '').replace(/\n/g, '<br/>')}</div>

        <h2>Resolution Notes</h2>
        <div class="desc-box">${(g.resolution_notes || 'Pending resolution.').replace(/\n/g, '<br/>')}</div>

        ${g.follow_up_date ? `<p style="margin-top:12px; font-size:13px;"><strong>Follow-up Date:</strong> ${new Date(g.follow_up_date).toLocaleDateString('en-IN')}</p>` : ''}

        <div class="footer">
          <div class="sig-line">Staff Signature</div>
          <div class="sig-line">Principal / Coordinator</div>
        </div>
      </body>
      </html>
    `);
    win.document.close();
    win.print();
  };

  // ---------------- Render ----------------

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: NAVY, fontFamily: 'Georgia, serif' }}>
        Loading grievance records…
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'Georgia, serif', color: NAVY, background: CREAM, minHeight: '100vh', padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, letterSpacing: 0.5 }}>Grievance Records</h1>
          <p style={{ margin: '4px 0 0', color: '#666', fontSize: 13 }}>
            Parent complaints against teachers — logged by staff or submitted via Parents Portal
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={exportTSV} style={btnSecondary}>Export TSV</button>
          <button onClick={() => setShowForm(true)} style={btnPrimary}>+ Log New Grievance</button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#FDEBEC', border: '1px solid #F3C0C2', color: '#B3261E', padding: 12, borderRadius: 6, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Status summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {STATUS_FLOW.map((s) => (
          <div
            key={s}
            onClick={() => setFilterStatus(filterStatus === s ? 'All' : s)}
            style={{
              cursor: 'pointer',
              background: '#fff',
              border: `1px solid ${filterStatus === s ? GOLD : '#e5ded0'}`,
              borderRadius: 8,
              padding: '14px 16px',
              boxShadow: filterStatus === s ? '0 0 0 2px rgba(201,162,75,0.25)' : 'none',
            }}
          >
            <div style={{ fontSize: 12, color: STATUS_COLORS[s].text, fontWeight: 'bold' }}>{s}</div>
            <div style={{ fontSize: 24, fontWeight: 'bold' }}>{counts[s]}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          placeholder="Search description, student, teacher, parent…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, flex: '1 1 260px' }}
        />
        <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} style={inputStyle}>
          <option value="All">All Sources</option>
          <option value="admin_logged">Admin Logged</option>
          <option value="parent_portal">Parent Portal</option>
        </select>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={inputStyle}>
          <option value="All">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', border: '1px solid #e5ded0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: NAVY, color: '#fff' }}>
              <th style={th}>Date</th>
              <th style={th}>Student</th>
              <th style={th}>Teacher</th>
              <th style={th}>Category</th>
              <th style={th}>Filed By</th>
              <th style={th}>Source</th>
              <th style={th}>Status</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#888' }}>
                  No grievance records match the current filters.
                </td>
              </tr>
            )}
            {filtered.map((g) => (
              <tr key={g.id} style={{ borderTop: '1px solid #eee' }}>
                <td style={td}>{new Date(g.created_at).toLocaleDateString('en-IN')}</td>
                <td style={td}>{g.student?.full_name || '—'}</td>
                <td style={td}>{g.teacher?.full_name || '—'}</td>
                <td style={td}>{g.category}</td>
                <td style={td}>{g.filed_by_name || '—'}</td>
                <td style={td}>
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 10,
                    background: g.source === 'parent_portal' ? '#EAF1FB' : '#F3EFE4',
                    color: g.source === 'parent_portal' ? '#1E4C8A' : '#7A6A3A',
                  }}>
                    {g.source === 'parent_portal' ? 'Parent Portal' : 'Admin Logged'}
                  </span>
                </td>
                <td style={td}>
                  <select
                    value={g.status}
                    onChange={(e) => updateStatus(g.id, e.target.value)}
                    style={{
                      ...statusPill(g.status),
                      border: `1px solid ${STATUS_COLORS[g.status].border}`,
                    }}
                  >
                    {STATUS_FLOW.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td style={td}>
                  <button onClick={() => setSelected(g)} style={linkBtn}>Details</button>
                  <button onClick={() => printRecord(g)} style={linkBtn}>Print</button>
                  <button onClick={() => softDelete(g.id)} style={{ ...linkBtn, color: '#B3261E' }}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New grievance form modal */}
      {showForm && (
        <Modal onClose={resetForm} title="Log New Grievance">
          <form onSubmit={handleSubmitNew} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Student Concerned">
              <select value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} style={inputStyle}>
                <option value="">— Select student —</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.full_name} {s.class_name ? `(${s.class_name})` : ''}</option>
                ))}
              </select>
            </Field>
            <Field label="Teacher Concerned">
              <select value={form.teacher_id} onChange={(e) => setForm({ ...form, teacher_id: e.target.value })} style={inputStyle}>
                <option value="">— Select teacher —</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </select>
            </Field>
            <Field label="Category">
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={inputStyle}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Description">
              <textarea
                required
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="e.g. Parent expressed concern that their daughter is falling behind in Mathematics and feels the teacher has not addressed it despite raising it earlier…"
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </Field>
            <div style={{ display: 'flex', gap: 12 }}>
              <Field label="Parent / Guardian Name" style={{ flex: 1 }}>
                <input value={form.filed_by_name} onChange={(e) => setForm({ ...form, filed_by_name: e.target.value })} style={inputStyle} />
              </Field>
              <Field label="Contact (Phone/Email)" style={{ flex: 1 }}>
                <input value={form.filed_by_contact} onChange={(e) => setForm({ ...form, filed_by_contact: e.target.value })} style={inputStyle} />
              </Field>
            </div>
            <Field label="Assign To (optional)">
              <select value={form.assigned_staff_id} onChange={(e) => setForm({ ...form, assigned_staff_id: e.target.value })} style={inputStyle}>
                <option value="">— Unassigned —</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </select>
            </Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
              <button type="button" onClick={resetForm} style={btnSecondary}>Cancel</button>
              <button type="submit" style={btnPrimary}>Save Grievance</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Detail / resolution drawer */}
      {selected && (
        <ResolutionModal
          grievance={selected}
          staffList={staffList}
          onClose={() => setSelected(null)}
          onSave={saveResolution}
        />
      )}
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function Field({ label, children, style }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 'bold', ...style }}>
      {label}
      {children}
    </label>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={{ ...modalStyle, maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div style={modalHeader}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={closeBtn}>×</button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}

function ResolutionModal({ grievance, staffList, onClose, onSave }) {
  const [assigned, setAssigned] = useState(grievance.assigned_staff_id || '');
  const [notes, setNotes] = useState(grievance.resolution_notes || '');
  const [followUp, setFollowUp] = useState(grievance.follow_up_date || '');
  const [status, setStatus] = useState(grievance.status);

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={{ ...modalStyle, maxWidth: 620 }} onClick={(e) => e.stopPropagation()}>
        <div style={modalHeader}>
          <h3 style={{ margin: 0 }}>Grievance GRV-{String(grievance.id).padStart(5, '0')}</h3>
          <button onClick={onClose} style={closeBtn}>×</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, color: '#555' }}>
            <strong>{grievance.student?.full_name || 'Unknown student'}</strong>
            {grievance.teacher?.full_name && <> · Teacher: {grievance.teacher.full_name}</>}
            {' · '}{grievance.category}
          </div>
          <div style={{ background: '#F8F5EC', border: '1px solid #eee2c4', borderRadius: 6, padding: 12, fontSize: 13 }}>
            {grievance.description}
          </div>
          {grievance.filed_by_name && (
            <div style={{ fontSize: 12, color: '#777' }}>
              Filed by {grievance.filed_by_name}{grievance.filed_by_contact ? ` · ${grievance.filed_by_contact}` : ''}
              {' · '}{grievance.source === 'parent_portal' ? 'Parents Portal' : 'Admin Logged'}
            </div>
          )}

          <Field label="Assign To">
            <select value={assigned} onChange={(e) => setAssigned(e.target.value)} style={inputStyle}>
              <option value="">— Unassigned —</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>{s.full_name}</option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
              {STATUS_FLOW.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Resolution Notes">
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Action taken, teacher's response, plan going forward…"
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </Field>
          <Field label="Follow-up Date (optional)">
            <input type="date" value={followUp || ''} onChange={(e) => setFollowUp(e.target.value)} style={inputStyle} />
          </Field>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button onClick={onClose} style={btnSecondary}>Cancel</button>
            <button
              onClick={() =>
                onSave(grievance.id, {
                  assigned_staff_id: assigned || null,
                  resolution_notes: notes || null,
                  follow_up_date: followUp || null,
                  status,
                })
              }
              style={btnPrimary}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Styles
// ============================================================

const btnPrimary = {
  background: NAVY, color: '#fff', border: 'none', borderRadius: 6,
  padding: '9px 16px', fontSize: 13, fontWeight: 'bold', cursor: 'pointer',
};
const btnSecondary = {
  background: '#fff', color: NAVY, border: `1px solid ${NAVY}`, borderRadius: 6,
  padding: '9px 16px', fontSize: 13, fontWeight: 'bold', cursor: 'pointer',
};
const inputStyle = {
  padding: '8px 10px', border: '1px solid #d8d0bd', borderRadius: 6, fontSize: 13,
  fontFamily: 'inherit', background: '#fff', color: NAVY,
};
const th = { textAlign: 'left', padding: '10px 12px', fontSize: 12, fontWeight: 'bold', letterSpacing: 0.4 };
const td = { padding: '10px 12px', verticalAlign: 'top' };
const linkBtn = {
  background: 'none', border: 'none', color: NAVY, textDecoration: 'underline',
  cursor: 'pointer', fontSize: 12, marginRight: 10, padding: 0,
};
const overlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(11,30,61,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};
const modalStyle = {
  background: '#fff', borderRadius: 10, width: '90%', maxHeight: '85vh', overflowY: 'auto',
};
const modalHeader = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '16px 20px', borderBottom: `2px solid ${GOLD}`,
};
const closeBtn = { background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#888' };

function statusPill(status) {
  const c = STATUS_COLORS[status];
  return {
    background: c.bg, color: c.text, borderRadius: 6, padding: '4px 8px',
    fontSize: 12, fontWeight: 'bold', cursor: 'pointer',
  };
}