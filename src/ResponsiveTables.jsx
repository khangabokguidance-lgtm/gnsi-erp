// ─── ResponsiveTables.jsx ────────────────────────────────────────────────────
// Wrap any screen in <ResponsiveTables> and every <table> inside it (including
// tables in modals and tables added later) becomes a stacked-card list on
// phones (≤ 767px, matching the Exams `isMobile` breakpoint).  Desktop is
// untouched.
//
//   • Each row becomes a card; the first real column is the card title.
//   • If the first column is a serial / rank (#, Sr, Rank …) it becomes a badge
//     and the next column becomes the title.
//   • Remaining cells sit in a 2-column grid, each with its column heading as a
//     small label.  Cells with no heading (action buttons) or colSpan > 1
//     (empty states, totals) span the full width.
//   • Inline cell colours (heat-map tints, flagged rows) are preserved.
//   • Opt a table out with  data-rt-skip  on the <table>.
//
// Labels are applied with data-* attributes only (never className/style), so
// React re-renders cannot clobber them.  A MutationObserver re-labels tables
// the moment React changes the DOM, before the browser paints.
import { useEffect, useLayoutEffect, useRef } from 'react';

const RANK_RX = /^(#|sr\.?|s\.?\s?no\.?|sl\.?(\s?no\.?)?|rank|pos\.?|position)$/i;

const setAttr = (el, name, value) => { if (el.getAttribute(name) !== value) el.setAttribute(name, value); };

function enhance(root) {
  root.querySelectorAll('table').forEach((table) => {
    if (table.hasAttribute('data-rt-skip')) return;
    const head = table.tHead && table.tHead.rows[table.tHead.rows.length - 1];
    if (!head) return; // no header row → nothing to label with; keep scrolling table

    const labels = [];
    Array.from(head.cells).forEach((c) => {
      const text = (c.textContent || '').replace(/\s+/g, ' ').trim();
      for (let i = 0; i < (c.colSpan || 1); i += 1) labels.push(text);
    });
    setAttr(table, 'data-rt-table', '');

    const rows = [];
    Array.from(table.tBodies).forEach((tb) => rows.push(...Array.from(tb.rows)));
    if (table.tFoot) rows.push(...Array.from(table.tFoot.rows));

    rows.forEach((row) => {
      const cells = Array.from(row.cells);
      const rankLead = cells.length >= 2 && RANK_RX.test(labels[0] || '') && cells[0].colSpan === 1 && cells[1].colSpan === 1;
      let col = 0;
      cells.forEach((cell, i) => {
        const label = cell.colSpan > 1 ? '' : (labels[col] || '');
        let role = 'cell';
        if (rankLead && i === 0) role = 'rank';
        else if (i === (rankLead ? 1 : 0) && cells.length > 1 && cell.colSpan === 1 && label) role = 'title';
        else if (cell.colSpan > 1 || !label || cells.length === 1) role = 'full';
        setAttr(cell, 'data-label', label);
        setAttr(cell, 'data-rt', role);
        col += cell.colSpan || 1;
      });
    });
  });
}

export const RESPONSIVE_TABLES_CSS = `
@media screen and (max-width: 767px) {
  div:has(> table[data-rt-table]) { overflow: visible !important; max-height: none !important; border: 0 !important; box-shadow: none !important; background: transparent !important; border-radius: 0 !important; }
  table[data-rt-table] { display: block; width: 100% !important; min-width: 0 !important; max-width: 100%; border: 0 !important; background: transparent !important; font-size: 13px !important; }
  table[data-rt-table] > colgroup { display: none; }
  table[data-rt-table] > thead { position: absolute !important; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  table[data-rt-table] > tbody, table[data-rt-table] > tfoot { display: block; }
  table[data-rt-table] tr { display: grid !important; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px 14px; position: relative; background: #fff; border: 1px solid #E2E8F0 !important; border-radius: 14px; padding: 12px 14px !important; margin: 0 0 10px !important; box-shadow: 0 1px 3px rgba(15, 23, 42, .06); }
  table[data-rt-table] > tfoot tr { background: #F1F5F9; }
  table[data-rt-table] td { display: block !important; min-width: 0; padding: 0 !important; border: 0 !important; text-align: left !important; white-space: normal !important; overflow-wrap: anywhere; font-size: 13px; line-height: 1.4; color: #0f172a; }
  table[data-rt-table] td:empty { display: none !important; }
  table[data-rt-table] td[data-label]:not([data-label=""]):not([data-rt="title"]):not([data-rt="rank"])::before { content: attr(data-label); display: block; font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #64748B; margin-bottom: 3px; }
  table[data-rt-table] td[data-rt="title"] { grid-column: 1 / -1; font-size: 15px; font-weight: 700; color: #002E6E; padding-bottom: 10px !important; border-bottom: 1px solid #EEF2F7 !important; }
  table[data-rt-table] td[data-rt="rank"] { position: absolute; top: 12px; left: 14px; z-index: 1; display: flex !important; align-items: center; justify-content: center; box-sizing: border-box; min-width: 26px; height: 26px; padding: 0 7px !important; border-radius: 999px; background: #002E6E; color: #fff; font-size: 12px; font-weight: 700; }
  table[data-rt-table] td[data-rt="rank"] + td[data-rt="title"] { padding-left: 38px !important; min-height: 26px; }
  table[data-rt-table] td[data-rt="full"] { grid-column: 1 / -1; display: flex !important; flex-wrap: wrap; align-items: center; gap: 8px; }
  table[data-rt-table] td[style*="background"]:not([data-rt="rank"]):not([data-rt="title"]) { padding: 6px 8px !important; border-radius: 8px; }
  table[data-rt-table] td button { min-height: 36px; }
  table[data-rt-table] td input:not([type="checkbox"]):not([type="radio"]), table[data-rt-table] td select, table[data-rt-table] td textarea { width: 100% !important; max-width: 100%; box-sizing: border-box; font-size: 16px !important; }
}`;

export default function ResponsiveTables({ children }) {
  const ref = useRef(null);
  const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

  useIsoLayoutEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    enhance(root); // before first paint → no flash of the desktop table
    // MutationObserver callbacks run as microtasks, i.e. before the next paint.
    const mo = new MutationObserver(() => enhance(root));
    mo.observe(root, { childList: true, subtree: true, characterData: true });
    return () => mo.disconnect();
  }, []);

  return (
    <>
      <style>{RESPONSIVE_TABLES_CSS}</style>
      <div ref={ref} style={{ display: 'contents' }}>{children}</div>
    </>
  );
}
