// LandingMenu.jsx — full-screen "command centre" menu opened by the hamburger.
// Holds every section of the site as a tile (grouped by category), live search,
// the primary actions (Apply / Pay Fee / Parents) and contact + login footer.
import { useEffect, useMemo, useRef, useState } from 'react';
import './LandingMenu.css';

const GROUPS = [
  { cat: 'gold', label: 'Admissions & Fees' },
  { cat: 'red', label: 'Exams & Preparation' },
  { cat: 'green', label: 'Results & Community' },
  { cat: 'blue', label: 'Our Institute' },
  { cat: 'purple', label: 'Updates & Help' },
];

// Public ERP pages (full-page links)
const SERVICES = [
  { href: '/apply', icon: '📝', label: 'Apply Online' },
  { href: '/apply-status', icon: '🔎', label: 'Application Status' },
  { href: '/exam-registration', icon: '🪪', label: 'Exam Registration' },
  { act: 'verify', icon: '🧾', label: 'Verify Fee Receipt' },
  { href: '/store', icon: '🛍️', label: 'GNSI Store' },
  { href: '/student-leave', icon: '🏖️', label: 'Student Leave' },
];

export function MenuButton({ open, onClick }) {
  return (
    <button type="button" className={'mm-burger' + (open ? ' open' : '')} onClick={onClick}
      aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="mmPanel">
      <span className="mm-burger-lines" aria-hidden="true"><i /><i /><i /></span>
      <span className="mm-burger-lbl">Menu</span>
    </button>
  );
}

export default function MegaMenu({ open, onClose, tabs, icons, active, goToTab, site, actions }) {
  const [q, setQ] = useState('');
  const inputRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const t = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 350);
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  const needle = q.trim().toLowerCase();
  const match = (label, extra = '') => !needle || (label + ' ' + extra).toLowerCase().includes(needle);

  const groups = useMemo(() => GROUPS.map((g) => ({
    ...g, items: tabs.filter((t) => t.id !== 'home' && t.cat === g.cat && match(t.label, t.id)),
  })).filter((g) => g.items.length), [tabs, needle]); // eslint-disable-line react-hooks/exhaustive-deps
  const services = SERVICES.filter((s) => match(s.label));
  const nothing = !groups.length && !services.length;

  const pick = (fn) => () => { fn(); onClose(); setQ(''); };
  const firstHit = () => {
    if (groups[0]) return pick(() => goToTab(groups[0].items[0].id))();
    if (services[0]) window.location.href = services[0].href;
  };

  let idx = 0;
  const stagger = () => ({ '--i': idx++ });

  return (
    <div className={'mm' + (open ? ' open' : '')} id="mmPanel" role="dialog" aria-modal="true" aria-label="Site menu" aria-hidden={!open} ref={panelRef}>
      <div className="mm-bg" aria-hidden="true"><i className="mm-orb mm-orb1" /><i className="mm-orb mm-orb2" /><i className="mm-grid" /></div>

      <header className="mm-top">
        <button type="button" className="mm-brand" onClick={pick(() => goToTab('home'))} aria-label="GNSI home">
          <span className="mm-crest"><img src={site.emblem} alt="" width="46" height="47" /></span>
          <span className="mm-brand-tx"><strong>GNSI</strong><small>Guidance Navodaya &amp; Sainik Institute</small></span>
        </button>
        <label className="mm-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sections — courses, fees, results…"
            aria-label="Search sections" onKeyDown={(e) => { if (e.key === 'Enter') firstHit(); }} />
          {q && <button type="button" className="mm-clear" onClick={() => setQ('')} aria-label="Clear search">✕</button>}
        </label>
        <button type="button" className="mm-close" onClick={onClose} aria-label="Close menu">
          <span aria-hidden="true" />
        </button>
      </header>

      <div className="mm-scroll">
        <div className="mm-inner">
          {!needle && (
            <div className="mm-actions">
              <a href="#enquiry" className="mm-act mm-act-p" style={stagger()} onClick={(e) => { e.preventDefault(); pick(() => goToTab('enquiry'))(); }}>
                <span className="mm-act-ic">✍️</span><span><strong>Apply / Enquire</strong><small>Admissions 2026–27</small></span><b aria-hidden="true">→</b>
              </a>
              <button type="button" className="mm-act" style={stagger()} onClick={pick(actions.openFee)}>
                <span className="mm-act-ic">💳</span><span><strong>Pay Fee</strong><small>UPI · Cards · Net banking</small></span><b aria-hidden="true">→</b>
              </button>
              <button type="button" className="mm-act" style={stagger()} onClick={pick(actions.openPortal)}>
                <span className="mm-act-ic">👪</span><span><strong>Parents Portal</strong><small>Attendance, marks, notices</small></span><b aria-hidden="true">→</b>
              </button>
            </div>
          )}

          {groups.map((g) => (
            <section className={'mm-group cat-' + g.cat} key={g.cat} aria-label={g.label}>
              <h3><span className="mm-dot" />{g.label}<em>{g.items.length}</em></h3>
              <div className="mm-tiles">
                {g.items.map((t) => (
                  <button type="button" key={t.id} className={'mm-tile' + (active === t.id ? ' on' : '')} style={stagger()}
                    aria-current={active === t.id ? 'page' : undefined} onClick={pick(() => goToTab(t.id))}>
                    <span className="mm-tile-ic" aria-hidden="true">{icons[t.id] || '•'}</span>
                    <span className="mm-tile-lb">{t.label}</span>
                    <svg className="mm-tile-go" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                  </button>
                ))}
              </div>
            </section>
          ))}

          {services.length > 0 && (
            <section className="mm-group cat-svc" aria-label="Online services">
              <h3><span className="mm-dot" />Online Services<em>{services.length}</em></h3>
              <div className="mm-tiles">
                {services.map((s) => {
                  const inner = (
                    <>
                      <span className="mm-tile-ic" aria-hidden="true">{s.icon}</span>
                      <span className="mm-tile-lb">{s.label}</span>
                      <svg className="mm-tile-go" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                    </>
                  );
                  return s.href
                    ? <a key={s.label} href={s.href} className="mm-tile" style={stagger()} onClick={onClose}>{inner}</a>
                    : <button type="button" key={s.label} className="mm-tile" style={stagger()} onClick={pick(actions.openVerify)}>{inner}</button>;
                })}
              </div>
            </section>
          )}

          {nothing && <p className="mm-empty">No section matches “{q}”. Try “fees”, “results” or “hostel”.</p>}

          <footer className="mm-foot" style={stagger()}>
            <div className="mm-contact">
              <a href={site.tel}>📞 {site.phone}</a>
              <a href={'mailto:' + site.email}>✉️ {site.email}</a>
              <span>📍 {site.address}</span>
            </div>
            <div className="mm-foot-btns">
              <a href={site.apk} download="" className="mm-pill" onClick={onClose}>📱 Get Android App</a>
              <a href={site.wa} target="_blank" rel="noopener noreferrer" className="mm-pill mm-pill-wa">WhatsApp</a>
              <button type="button" className="mm-pill mm-pill-gold" onClick={pick(actions.onLogin)}>Staff Login →</button>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
