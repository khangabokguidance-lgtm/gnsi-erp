// ─── ExamsMobile.jsx ─────────────────────────────────────────────────────────
// Phone shell for the Exams module, laid out like a payments-app: a blue hero
// with search and stat cards, round quick actions, a promo card, one white card
// per tab group with a 4-column icon grid — then, inside any screen, a fixed
// top bar with a back arrow and a 5-slot bottom navigation.
// Styles live in examsTheme.css (.xm-* classes).
import { useMemo, useState } from 'react';
import ExamIcon from './examIcons';

const tint = (hex, a = '1F') => `${hex}${a}`;

export function ExamHomeMobile({ groups, onSelect, institute, stats, role }) {
  const [q, setQ] = useState('');
  const flat = useMemo(() => groups.flatMap((g) => g.tabs.map((t) => ({ ...t, color: g.color, group: g.groupLabel }))), [groups]);
  const needle = q.trim().toLowerCase();
  const hits = needle ? flat.filter((t) => `${t.label} ${t.tip} ${t.group}`.toLowerCase().includes(needle)) : null;
  const quick = ['entry', 'rankings', 'mockanalyzer', 'reportcard'].map((id) => flat.find((t) => t.id === id)).filter(Boolean);
  const hasMock = flat.some((t) => t.id === 'mockanalyzer');

  const Tile = ({ t }) => (
    <button className="xm-tile" onClick={() => onSelect(t.id)}>
      <span className="xm-ico" style={{ background: tint(t.color), color: t.color }}><ExamIcon id={t.id} size={24} /></span>
      <span className="xm-lbl">{t.label}</span>
    </button>
  );

  return (
    <div className="xm-home">
      <div className="xm-hero">
        <div className="xm-hero-top">
          <div>
            <div className="xm-hero-title">Exam <span>HUB</span></div>
            <div className="xm-hero-sub">{institute?.name}</div>
          </div>
          {role ? <div className="xm-chip">{role}</div> : null}
        </div>
        <label className="xm-search">
          <span aria-hidden="true" style={{ display: "flex" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /></svg></span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search marks, reports, analyzer…" />
          {q ? <button type="button" onClick={() => setQ('')} aria-label="Clear search">✕</button> : null}
        </label>
      </div>

      <div className="xm-stats">
        {stats.map((s) => (
          <div key={s.label} className="xm-stat"><b>{s.val}</b><span>{s.label}</span></div>
        ))}
      </div>

      {hits ? (
        <div className="xm-card">
          <div className="xm-card-h">{hits.length ? `${hits.length} result${hits.length > 1 ? 's' : ''}` : 'Nothing found'}</div>
          <div className="xm-grid">{hits.map((t) => <Tile key={t.id} t={t} />)}</div>
        </div>
      ) : (
        <>
          {quick.length ? (
            <div className="xm-card xm-quick">
              {quick.map((t) => (
                <button key={t.id} onClick={() => onSelect(t.id)}>
                  <span className="xm-round" style={{ background: t.color }}><ExamIcon id={t.id} size={25} /></span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          ) : null}
          {hasMock ? (
            <button className="xm-promo" onClick={() => onSelect('mockanalyzer')}>
              <div>
                <em>NEW</em>
                <b>Mock Test Analyzer</b>
                <span>Upload Excel results, track every student &amp; print reports</span>
              </div>
              <span className="xm-promo-ico"><ExamIcon id="mockanalyzer" size={44} stroke={1.5} /></span>
            </button>
          ) : null}
          {groups.map((g) => (
            <div key={g.groupLabel} className="xm-card">
              <div className="xm-card-h"><i style={{ background: g.color }} />{g.groupLabel}</div>
              <div className="xm-grid">{g.tabs.map((t) => <Tile key={t.id} t={{ ...t, color: g.color }} />)}</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export function ExamTopBar({ title, id, subtitle, onBack }) {
  return (
    <div className="xm-top">
      <button className="xm-back" onClick={onBack} aria-label="Back to Exam HUB">‹</button>
      <span className="xm-top-ico"><ExamIcon id={id} size={20} /></span>
      <div className="xm-top-t"><b>{title}</b>{subtitle ? <small>{subtitle}</small> : null}</div>
    </div>
  );
}

// items: [{id, label}] — icons come from examIcons by id.
export function ExamBottomBar({ items, active, onSelect }) {
  return (
    <nav className="xm-bottom" aria-label="Exam navigation">
      {items.map((it) => (
        <button key={it.id} className={active === it.id ? 'on' : ''} onClick={() => onSelect(it.id)}>
          <span className="xm-bi"><ExamIcon id={it.id === '__more' ? 'more' : it.id} size={22} /></span>
          <span>{it.label}</span>
        </button>
      ))}
    </nav>
  );
}
