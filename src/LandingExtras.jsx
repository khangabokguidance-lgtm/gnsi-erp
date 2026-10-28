// LandingExtras.jsx — extra public-site sections for the landing page:
// quick services, admissions banner, seat availability, hostel, alumni/TC,
// careers and site search. Content comes from website_settings (via `site`)
// with sensible fallbacks, so nothing renders empty.
import { useEffect, useMemo, useRef, useState } from 'react';
import { submitTcRequest, submitCareerApplication } from './websiteApi';
import './LandingExtras.css';
import './SectionsThemes.css';

const PHONE_RE = /^[6-9]\d{9}$/;
const cleanPhone = (v) => (v || '').replace(/[\s\-()]/g, '').replace(/^\+?91/, '');

// ── Quick services: links to the public ERP pages ───────────────────────────
export function QuickServices({ goToTab, openFee, openPortal }) {
  const items = [
    { ic: '📝', t: 'Apply Online', d: 'Admission application', href: '/apply' },
    { ic: '🔎', t: 'Application Status', d: 'Track your application', href: '/apply-status' },
    { ic: '🪪', t: 'Exam Registration', d: 'Register & admit card', href: '/exam-registration' },
    { ic: '💳', t: 'Pay Fees', d: 'Online fee payment', onClick: openFee },
    { ic: '🧾', t: 'Verify Receipt / Certificate', d: 'Check authenticity', href: '/verify' },
    { ic: '🛍️', t: 'GNSI Store', d: 'Uniforms, books & more', href: '/store' },
    { ic: '🏖️', t: 'Student Leave', d: 'Parent leave request', href: '/student-leave' },
    { ic: '👪', t: 'Parents Portal', d: 'Attendance, results, fees', onClick: openPortal },
    { ic: '🏠', t: 'Hostel Life', d: 'Rooms, meals, routine', onClick: () => goToTab('hostel') },
    { ic: '🎓', t: 'Alumni & TC', d: 'Certificates & alumni', onClick: () => goToTab('alumni') },
  ];
  return (
    <section className="lx-services" aria-label="Quick services">
      <div className="lx-wrap">
        <div className="lx-eyebrow">Quick services</div>
        <div className="lx-grid">
          {items.map((i) => {
            const inner = (
              <>
                <span className="lx-ic" aria-hidden="true">{i.ic}</span>
                <span className="lx-tx"><strong>{i.t}</strong><small>{i.d}</small></span>
              </>
            );
            return i.href
              ? <a key={i.t} className="lx-tile" href={i.href}>{inner}</a>
              : <button key={i.t} type="button" className="lx-tile" onClick={i.onClick}>{inner}</button>;
          })}
        </div>
      </div>
    </section>
  );
}

// ── Admissions banner (toggled from Website → Settings) ─────────────────────
export function AdmissionsBanner({ site }) {
  if (!site.admissionsOpen) return null;
  return (
    <div className="lx-banner" role="status">
      <span className="lx-pulse" aria-hidden="true" />
      <span>
        <b>{site.admissionBanner}</b>
        {site.admissionDeadline && <> · Apply by {site.admissionDeadline}</>}
      </span>
      <a href="/apply" className="lx-banner-cta">Apply now →</a>
    </div>
  );
}

// ── Seat availability (numbers set in Website → Settings) ───────────────────
export function SeatAvailability({ site }) {
  const rows = site.seats || [];
  if (!rows.length) return null;
  return (
    <div className="lx-seats">
      <h3>Seat availability</h3>
      <div className="lx-seat-grid">
        {rows.map((r) => {
          const pct = r.total ? Math.max(0, Math.min(100, Math.round(((r.total - r.left) / r.total) * 100))) : 0;
          return (
            <div className="lx-seat" key={r.label}>
              <div className="lx-seat-top"><strong>{r.label}</strong>
                <span className={r.left <= 5 ? 'lx-low' : ''}>{r.left} of {r.total} left</span></div>
              <div className="lx-bar" aria-hidden="true"><i style={{ width: pct + '%' }} /></div>
            </div>
          );
        })}
      </div>
      <p className="lx-note">Updated by the admissions office. Seats are confirmed on payment of admission fee.</p>
    </div>
  );
}

// ── Hostel tab ──────────────────────────────────────────────────────────────
export function HostelTab({ site, goToTab }) {
  const h = site.hostel;
  const cards = [
    { ic: '🛏️', t: 'Rooms', d: h.rooms },
    { ic: '🍛', t: 'Meals', d: h.meals },
    { ic: '⏰', t: 'Daily routine', d: h.routine },
    { ic: '🛡️', t: 'Safety & care', d: h.safety },
    { ic: '👨‍👩‍👧', t: 'Parent visits', d: h.visits },
    { ic: '🩺', t: 'Medical', d: h.medical },
  ];
  return (
    <section className="pad-alt lx-section" id="hostel">
      <div className="lx-wrap">
        <div className="lx-eyebrow">Residential life</div>
        <h2 className="st">Hostel at GNSI</h2>
        <p className="lx-lead">{h.intro}</p>
        <div className="lx-cards">
          {cards.map((c) => (
            <div className="lx-card" key={c.t}>
              <div className="lx-card-ic">{c.ic}</div>
              <h4>{c.t}</h4>
              <p>{c.d}</p>
            </div>
          ))}
        </div>
        <SeatAvailability site={site} />
        <div className="lx-cta-row">
          <a href="/apply" className="lx-btn lx-btn-p">Apply for hostel admission</a>
          <button type="button" className="lx-btn" onClick={() => goToTab('enquiry')}>Ask about hostel fees</button>
        </div>
      </div>
    </section>
  );
}

// ── Alumni & TC tab ─────────────────────────────────────────────────────────
export function AlumniTab({ site }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const form = Object.fromEntries(f.entries());
    if (form.website) return setMsg({ ok: true, t: 'Request received.' }); // honeypot
    if (!form.student_name?.trim() || !PHONE_RE.test(cleanPhone(form.phone))) {
      return setMsg({ ok: false, t: 'Please enter the student name and a valid 10-digit phone number.' });
    }
    setBusy(true); setMsg(null);
    try {
      const { error } = await submitTcRequest(form);
      if (error) throw error;
      setMsg({ ok: true, t: 'Request received. The office will contact you within 2 working days.' });
      e.currentTarget.reset();
    } catch {
      setMsg({ ok: false, t: 'Something went wrong. Please call ' + site.phone + '.' });
    } finally { setBusy(false); }
  };
  return (
    <section className="pad-alt lx-section" id="alumni">
      <div className="lx-wrap">
        <div className="lx-eyebrow">Alumni & certificates</div>
        <h2 className="st">Alumni, TC & Certificates</h2>
        <p className="lx-lead">Former students can request a Transfer / Character / Study certificate or stay connected with GNSI. Issued certificates can be checked at <a href="/verify">Verify</a>.</p>
        <form className="lx-form" onSubmit={submit} noValidate>
          <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="lx-hp" />
          <label>Request type
            <select name="request_type" defaultValue="Transfer Certificate">
              <option>Transfer Certificate</option><option>Character Certificate</option>
              <option>Study / Bonafide Certificate</option><option>Alumni Registration</option><option>Other</option>
            </select>
          </label>
          <div className="lx-row">
            <label>Student name *<input name="student_name" required autoComplete="name" /></label>
            <label>Parent / guardian<input name="parent_name" /></label>
          </div>
          <div className="lx-row">
            <label>Phone *<input name="phone" type="tel" required autoComplete="tel" /></label>
            <label>GCC / admission no.<input name="gcc_no" /></label>
          </div>
          <label>Year of leaving / passing out<input name="passout_year" placeholder="e.g. 2025" /></label>
          <label>Details<textarea name="message" rows={3} /></label>
          {msg && <div className={'lx-msg ' + (msg.ok ? 'ok' : 'err')}>{msg.t}</div>}
          <button className="lx-btn lx-btn-p" disabled={busy}>{busy ? 'Sending…' : 'Submit request'}</button>
        </form>
      </div>
    </section>
  );
}

// ── Careers tab ─────────────────────────────────────────────────────────────
export function CareersTab({ site }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const f = new FormData(formEl);
    const form = Object.fromEntries(f.entries());
    if (form.website) return setMsg({ ok: true, t: 'Application received.' }); // honeypot
    if (!form.name?.trim() || !PHONE_RE.test(cleanPhone(form.phone))) {
      return setMsg({ ok: false, t: 'Please enter your name and a valid 10-digit phone number.' });
    }
    setBusy(true); setMsg(null);
    try {
      const { error } = await submitCareerApplication(form);
      if (error) throw error;
      setMsg({ ok: true, t: 'Application received. We will contact shortlisted candidates.' });
      formEl.reset();
    } catch {
      setMsg({ ok: false, t: 'Something went wrong. Please email ' + site.email + '.' });
    } finally { setBusy(false); }
  };
  return (
    <section className="pad-alt lx-section" id="careers">
      <div className="lx-wrap">
        <div className="lx-eyebrow">Careers</div>
        <h2 className="st">Join the GNSI faculty</h2>
        <p className="lx-lead">We are always looking for dedicated teachers, wardens and support staff who share our mission of preparing students for Navodaya, Sainik School and RMS.</p>
        <form className="lx-form" onSubmit={submit} noValidate>
          <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="lx-hp" />
          <div className="lx-row">
            <label>Full name *<input name="name" required autoComplete="name" /></label>
            <label>Phone *<input name="phone" type="tel" required autoComplete="tel" /></label>
          </div>
          <div className="lx-row">
            <label>Email<input name="email" type="email" autoComplete="email" /></label>
            <label>Position
              <select name="position" defaultValue="Teacher">
                <option>Teacher</option><option>Warden / Housemaster</option><option>Office / Admin</option>
                <option>Kitchen / Support</option><option>Other</option>
              </select>
            </label>
          </div>
          <div className="lx-row">
            <label>Qualification<input name="qualification" /></label>
            <label>Experience<input name="experience" placeholder="e.g. 3 years" /></label>
          </div>
          <label>Resume link (Google Drive / any shareable link)<input name="resume_url" type="url" placeholder="https://" /></label>
          <label>About you<textarea name="message" rows={3} /></label>
          {msg && <div className={'lx-msg ' + (msg.ok ? 'ok' : 'err')}>{msg.t}</div>}
          <button className="lx-btn lx-btn-p" disabled={busy}>{busy ? 'Sending…' : 'Submit application'}</button>
        </form>
      </div>
    </section>
  );
}

// ── Site search (press "/" or the nav search button) ────────────────────────
export function SiteSearch({ open, ...rest }) {
  // Mounted only while open, so the query resets each time it opens.
  return open ? <SearchBox {...rest} /> : null;
}

function SearchBox({ onClose, entries, onPick }) {
  const [q, setQ] = useState('');
  const inputRef = useRef(null);
  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s ? entries.filter((e) => (e.label + ' ' + (e.keywords || '')).toLowerCase().includes(s)) : entries;
    return list.slice(0, 12);
  }, [q, entries]);
  return (
    <div className="lx-search-ov" onClick={onClose} role="dialog" aria-modal="true" aria-label="Search the site">
      <div className="lx-search" onClick={(e) => e.stopPropagation()}>
        <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search courses, fees, results, hostel, apply…" aria-label="Search"
          onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) onPick(results[0]); }} />
        <ul>
          {results.map((r) => (
            <li key={r.id || r.href}><button type="button" onClick={() => onPick(r)}>
              <span aria-hidden="true">{r.icon || '🔹'}</span>{r.label}
            </button></li>
          ))}
          {!results.length && <li className="lx-empty">No matches — try “apply”, “fees” or “hostel”.</li>}
        </ul>
      </div>
    </div>
  );
}
