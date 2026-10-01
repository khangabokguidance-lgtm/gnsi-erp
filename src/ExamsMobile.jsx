// ─── ExamsMobile.jsx ─────────────────────────────────────────────────────────
// Phone shell for the Exams module, laid out like a payments-app: a blue hero
// with search and stat cards, round quick actions, a promo card, one white card
// per tab group with a 4-column icon grid — then, inside any screen, a fixed
// top bar with a back arrow and a 5-slot bottom navigation.
// Styles live in examsTheme.css (.xm-* classes).
import { useEffect, useMemo, useRef, useState } from 'react';

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
      <span className="xm-ico" style={{ background: tint(t.color), color: t.color }}>{t.icon}</span>
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
          <span aria-hidden="true">🔍</span>
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
                  <span className="xm-round" style={{ background: t.color }}>{t.icon}</span>
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
              <span className="xm-promo-ico">🧠</span>
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

export function ExamTopBar({ title, icon, subtitle, onBack }) {
  return (
    <div className="xm-top">
      <button className="xm-back" onClick={onBack} aria-label="Back to Exam HUB">‹</button>
      <span className="xm-top-ico">{icon}</span>
      <div className="xm-top-t"><b>{title}</b>{subtitle ? <small>{subtitle}</small> : null}</div>
    </div>
  );
}

// items: [{id, icon, label}]; "home" is always first.
export function ExamBottomBar({ items, active, onSelect }) {
  return (
    <nav className="xm-bottom" aria-label="Exam navigation">
      {items.map((it) => (
        <button key={it.id} className={active === it.id ? 'on' : ''} onClick={() => onSelect(it.id)}>
          <span className="xm-bi">{it.icon}</span>
          <span>{it.label}</span>
        </button>
      ))}
    </nav>
  );
}

// ─── Responsive tables ───────────────────────────────────────────────────────
// Every <table> inside the phone shell is turned into a list of cards: the
// header text becomes a small label above each value, the "name" column
// becomes the card title, and action / checkbox / empty-state cells get their
// own treatment. It works on whatever the screens render (including after
// React re-renders), so new tables fit automatically. Opt a table out with
// data-xm-keep. Styles: examsTheme.css  [data-xm-t] / [data-xm].
const TITLE_HEAD = /^(student|name|candidate|subject|test|exam|batch|course|class|room|title|date|school|section)\b/i;
const NUMERIC = /^[#\d.,\s%/+-]*$/;
const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();

function headerLabels(table) {
  const rows = table.tHead ? Array.from(table.tHead.rows) : [];
  if (!rows.length) return [];
  const withText = (r) => Array.from(r.cells).filter((c) => txt(c)).length;
  const row = [...rows].reverse().find((r) => withText(r) >= 2) || rows[rows.length - 1];
  const labels = [];
  Array.from(row.cells).forEach((c) => {
    const t = txt(c);
    for (let i = 0; i < (c.colSpan || 1); i++) labels.push(t);
  });
  return labels;
}

function setData(el, name, val) {
  if (val === null || val === undefined || val === '') el.removeAttribute(name);
  else if (el.getAttribute(name) !== val) el.setAttribute(name, val);
}

function enhanceTables(root) {
  root.querySelectorAll('table').forEach((table) => {
    if (table.hasAttribute('data-xm-keep')) return;
    const labels = headerLabels(table);
    table.setAttribute('data-xm-t', '');
    Array.from(table.rows).forEach((tr) => {
      if (tr.parentElement && tr.parentElement.tagName === 'THEAD') return;
      const cells = Array.from(tr.cells);
      let col = 0, titleCell = null, counted = 0;
      const info = cells.map((td) => {
        const span = td.colSpan || 1;
        const label = span > 1 ? '' : (labels[col] || '');
        col += span;
        const onlyCheck = !!td.querySelector('input[type=checkbox]') && !txt(td);
        const empty = !txt(td) && !td.children.length;
        const hasControl = !!td.querySelector('button, select, textarea, a');
        return { td, span, label, onlyCheck, empty, hasControl };
      });
      // title: the "name-like" column, else first cell with real text
      titleCell = info.find((c) => c.label && TITLE_HEAD.test(c.label) && txt(c.td) && !c.onlyCheck && c.span === 1)
        || info.find((c) => c.span === 1 && !c.onlyCheck && txt(c.td) && !NUMERIC.test(txt(c.td)) && !c.hasControl);
      info.forEach((c) => {
        let kind = '';
        if (c.span > 1) kind = 'full';
        else if (c.onlyCheck) kind = 'tick';
        else if (c.empty) kind = 'empty';
        else if (c === titleCell) kind = 'title';
        else if (!c.label && c.hasControl) kind = 'full';
        else counted++;
        setData(c.td, 'data-xm', kind);
        setData(c.td, 'data-label', kind === 'title' || kind === 'full' || kind === 'tick' ? '' : c.label);
      });
      setData(tr, 'data-xm-c', counted <= 4 ? '2' : '3');
    });
  });
}

// Wrapper for phone screens: keeps tables enhanced as React re-renders them.
export function ResponsiveTables({ className, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    let raf = 0;
    const run = () => { raf = 0; enhanceTables(root); };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(run); };
    run();
    const mo = new MutationObserver(schedule);
    mo.observe(root, { childList: true, subtree: true, characterData: true });
    return () => { mo.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, []);
  return <div ref={ref} className={className}>{children}</div>;
}
