import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';

// ============================================================
// GrievanceSubmitForm.jsx
// Drop into the Parents Portal overlay. Lets a parent raise a
// concern about a teacher (e.g. their child's academic weakness)
// without staff needing to log it manually.
//
// Requires: the logged-in parent session to resolve to a student
// (adjust `studentId`/`studentName` props to however your Parents
// Portal already identifies the linked child).
// ============================================================

const NAVY = '#0B1E3D';
const GOLD = '#C9A24B';

const CATEGORIES = [
  'Academic Weakness',
  'Behavioral',
  'Communication',
  'Attendance Handling',
  'Discipline',
  'Other',
];

export default function GrievanceSubmitForm({ studentId, studentName, onSubmitted }) {
  const [teachers, setTeachers] = useState([]);
  const [category, setCategory] = useState('Academic Weakness');
  const [teacherId, setTeacherId] = useState('');
  const [description, setDescription] = useState('');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase
      .from('staff_profiles')
      .select('id, full_name, role')
      .order('full_name')
      .then(({ data, error: err }) => {
        if (!err) setTeachers(data || []);
      });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim()) {
      setError('Please describe your concern.');
      return;
    }
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { error: insertError } = await supabase.from('grievances').insert({
        student_id: studentId || null,
        teacher_id: teacherId || null,
        subject: category,
        category,
        description: description.trim(),
        source: 'parent_portal',
        filed_by_name: name.trim(),
        filed_by_contact: contact.trim() || null,
        status: 'Open',
      });
      if (insertError) throw insertError;
      setDone(true);
      if (onSubmitted) onSubmitted();
    } catch (err) {
      console.error('Parent grievance submit error:', err);
      setError('Something went wrong. Please try again or contact the office directly.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div style={{ ...card, textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
        <h3 style={{ margin: '0 0 6px', color: NAVY }}>Your concern has been recorded</h3>
        <p style={{ color: '#666', fontSize: 13 }}>
          A staff member will review this and follow up with you shortly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={card}>
      <h3 style={{ margin: '0 0 4px', color: NAVY, fontFamily: 'Georgia, serif' }}>
        Raise a Concern
      </h3>
      <p style={{ margin: '0 0 16px', fontSize: 12, color: '#777' }}>
        {studentName ? `Regarding: ${studentName}` : 'Tell us what\'s on your mind — we take every concern seriously.'}
      </p>

      {error && (
        <div style={{ background: '#FDEBEC', border: '1px solid #F3C0C2', color: '#B3261E', padding: 10, borderRadius: 6, fontSize: 12, marginBottom: 12 }}>
          {error}
        </div>
      )}

      <Field label="Category">
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </Field>

      <Field label="Concerning Teacher (optional)">
        <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} style={inputStyle}>
          <option value="">— Not sure / general —</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>{t.full_name}</option>
          ))}
        </select>
      </Field>

      <Field label="Describe your concern">
        <textarea
          rows={4}
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. My daughter seems to be struggling with Mathematics and I'd like to understand what support is available…"
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </Field>

      <div style={{ display: 'flex', gap: 12 }}>
        <Field label="Your Name" style={{ flex: 1 }}>
          <input required value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Phone / Email (optional)" style={{ flex: 1 }}>
          <input value={contact} onChange={(e) => setContact(e.target.value)} style={inputStyle} />
        </Field>
      </div>

      <button type="submit" disabled={submitting} style={{ ...btnPrimary, marginTop: 8, width: '100%', opacity: submitting ? 0.7 : 1 }}>
        {submitting ? 'Submitting…' : 'Submit Concern'}
      </button>
    </form>
  );
}

function Field({ label, children, style }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 'bold', color: NAVY, marginBottom: 12, ...style }}>
      {label}
      {children}
    </label>
  );
}

const card = {
  background: '#fff', border: `1px solid ${GOLD}`, borderRadius: 10,
  padding: 20, maxWidth: 480, fontFamily: 'Georgia, serif',
  boxShadow: '0 2px 10px rgba(11,30,61,0.08)',
};
const inputStyle = {
  padding: '8px 10px', border: '1px solid #d8d0bd', borderRadius: 6, fontSize: 13,
  fontFamily: 'inherit', background: '#fff', color: NAVY,
};
const btnPrimary = {
  background: NAVY, color: '#fff', border: 'none', borderRadius: 6,
  padding: '10px 16px', fontSize: 13, fontWeight: 'bold', cursor: 'pointer',
};