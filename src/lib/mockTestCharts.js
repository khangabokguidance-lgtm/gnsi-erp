// ─── mockTestCharts.js ───────────────────────────────────────────────────────
// Dependency-free SVG chart builders.  They return SVG *strings* so the exact
// same chart is shown on screen (dangerouslySetInnerHTML) and in the printed
// report.  Every colour carries a text label as well, so charts survive a
// black-and-white printout.

export const SUBJECT_COLORS = ['#1d4ed8', '#d97706', '#047857', '#7c3aed', '#be123c', '#0e7490', '#4d7c0f', '#64748b'];
export const subjColor = (subjects, s) => SUBJECT_COLORS[Math.max(0, subjects.indexOf(s)) % SUBJECT_COLORS.length];

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const f1 = (n) => (Math.round(n * 10) / 10).toString();
const AXIS = '#94a3b8', GRID = '#e2e8f0', TEXT = '#334155';

// Multi-series line chart.  series: [{name,color,values:[number|null],dashed?}], labels: x labels
export function lineChart({ labels, series, yMax = 100, yMin = 0, width = 640, height = 260, unit = '', title = '' }) {
  const m = { l: 40, r: 16, t: title ? 30 : 14, b: 44 };
  const W = width - m.l - m.r, H = height - m.t - m.b;
  const n = labels.length;
  const x = (i) => m.l + (n === 1 ? W / 2 : (i * W) / (n - 1));
  const y = (v) => m.t + H - ((v - yMin) / (yMax - yMin || 1)) * H;
  let g = '';
  const ticks = 5;
  for (let i = 0; i <= ticks; i++) {
    const v = yMin + ((yMax - yMin) * i) / ticks;
    g += `<line x1="${m.l}" x2="${m.l + W}" y1="${y(v)}" y2="${y(v)}" stroke="${GRID}" stroke-width="1"/>`;
    g += `<text x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end" font-size="10" fill="${TEXT}">${f1(v)}${unit}</text>`;
  }
  labels.forEach((l, i) => {
    g += `<text x="${x(i)}" y="${m.t + H + 16}" text-anchor="middle" font-size="10" fill="${TEXT}">${esc(l)}</text>`;
  });
  series.forEach((s) => {
    const pts = s.values.map((v, i) => (v === null || v === undefined ? null : [x(i), y(v)]));
    let d = '', pen = false;
    pts.forEach((p) => { if (!p) { pen = false; return; } d += `${pen ? 'L' : 'M'}${p[0]},${p[1]} `; pen = true; });
    g += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.thick ? 3 : 2}" ${s.dashed ? 'stroke-dasharray="5 4"' : ''} stroke-linejoin="round" stroke-linecap="round"/>`;
    pts.forEach((p, i) => {
      if (!p) return;
      g += `<circle cx="${p[0]}" cy="${p[1]}" r="3.4" fill="#fff" stroke="${s.color}" stroke-width="2"/>`;
      if (series.length <= 2 && !s.dashed) g += `<text x="${p[0]}" y="${p[1] - 8}" text-anchor="middle" font-size="9.5" font-weight="600" fill="${s.color}">${f1(s.values[i])}</text>`;
    });
  });
  // legend
  let lx = m.l, ly = height - 8;
  series.forEach((s) => {
    g += `<rect x="${lx}" y="${ly - 8}" width="14" height="3" fill="${s.color}" rx="1.5"/><text x="${lx + 19}" y="${ly - 3}" font-size="10" fill="${TEXT}">${esc(s.name)}</text>`;
    lx += 28 + String(s.name).length * 5.6;
  });
  const t = title ? `<text x="${m.l}" y="16" font-size="12" font-weight="700" fill="#0f172a">${esc(title)}</text>` : '';
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${width}px" xmlns="http://www.w3.org/2000/svg" font-family="Inter,Arial,sans-serif" role="img" aria-label="${esc(title || 'Line chart')}">${t}${g}<line x1="${m.l}" x2="${m.l}" y1="${m.t}" y2="${m.t + H}" stroke="${AXIS}"/><line x1="${m.l}" x2="${m.l + W}" y1="${m.t + H}" y2="${m.t + H}" stroke="${AXIS}"/></svg>`;
}

// Grouped vertical bars.  groups: [{label, bars:[{name,value,color}]}]
export function barChart({ groups, yMax = 100, width = 640, height = 250, unit = '', title = '' }) {
  const m = { l: 40, r: 12, t: title ? 30 : 14, b: 54 };
  const W = width - m.l - m.r, H = height - m.t - m.b;
  const gw = W / groups.length;
  const y = (v) => m.t + H - (v / (yMax || 1)) * H;
  let g = '';
  for (let i = 0; i <= 5; i++) {
    const v = (yMax * i) / 5;
    g += `<line x1="${m.l}" x2="${m.l + W}" y1="${y(v)}" y2="${y(v)}" stroke="${GRID}"/><text x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end" font-size="10" fill="${TEXT}">${f1(v)}${unit}</text>`;
  }
  groups.forEach((gr, gi) => {
    const bw = Math.min(34, (gw * 0.78) / gr.bars.length);
    const start = m.l + gi * gw + (gw - bw * gr.bars.length) / 2;
    gr.bars.forEach((b, bi) => {
      if (b.value === null || b.value === undefined) return;
      const bx = start + bi * bw;
      g += `<rect x="${bx + 1}" y="${y(b.value)}" width="${bw - 2}" height="${m.t + H - y(b.value)}" fill="${b.color}" rx="2"/>`;
      g += `<text x="${bx + bw / 2}" y="${y(b.value) - 4}" text-anchor="middle" font-size="9" font-weight="600" fill="${TEXT}">${f1(b.value)}</text>`;
    });
    g += `<text x="${m.l + gi * gw + gw / 2}" y="${m.t + H + 15}" text-anchor="middle" font-size="10" fill="${TEXT}">${esc(gr.label)}</text>`;
  });
  const legend = [...new Map(groups.flatMap((gr) => gr.bars).map((b) => [b.name, b.color])).entries()];
  let lx = m.l;
  legend.forEach(([name, color]) => {
    g += `<rect x="${lx}" y="${height - 17}" width="10" height="10" fill="${color}" rx="2"/><text x="${lx + 14}" y="${height - 8}" font-size="10" fill="${TEXT}">${esc(name)}</text>`;
    lx += 26 + String(name).length * 5.8;
  });
  const t = title ? `<text x="${m.l}" y="16" font-size="12" font-weight="700" fill="#0f172a">${esc(title)}</text>` : '';
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${width}px" xmlns="http://www.w3.org/2000/svg" font-family="Inter,Arial,sans-serif" role="img" aria-label="${esc(title || 'Bar chart')}">${t}${g}<line x1="${m.l}" x2="${m.l + W}" y1="${m.t + H}" y2="${m.t + H}" stroke="${AXIS}"/></svg>`;
}

// Radar chart: axes [{label}], series [{name,color,values(0-100),fill}]
export function radarChart({ axes, series, size = 280, title = '' }) {
  const c = size / 2, R = size / 2 - 52, n = axes.length;
  if (n < 3) return '';
  const pt = (i, v) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [c + Math.cos(a) * R * (v / 100), c + Math.sin(a) * R * (v / 100) + (title ? 8 : 0)];
  };
  let g = '';
  [25, 50, 75, 100].forEach((lv) => {
    g += `<polygon points="${axes.map((_, i) => pt(i, lv).join(',')).join(' ')}" fill="none" stroke="${GRID}"/>`;
    g += `<text x="${c + 3}" y="${pt(0, lv)[1] - 2}" font-size="8" fill="${AXIS}">${lv}</text>`;
  });
  axes.forEach((a, i) => {
    const [x, y] = pt(i, 100), [lx, ly] = pt(i, 122);
    g += `<line x1="${c}" y1="${c + (title ? 8 : 0)}" x2="${x}" y2="${y}" stroke="${GRID}"/>`;
    g += `<text x="${lx}" y="${ly + 3}" text-anchor="middle" font-size="10" font-weight="600" fill="${TEXT}">${esc(a.label)}</text>`;
  });
  series.forEach((s) => {
    g += `<polygon points="${s.values.map((v, i) => pt(i, Math.max(0, v || 0)).join(',')).join(' ')}" fill="${s.color}" fill-opacity="${s.fill ?? 0.18}" stroke="${s.color}" stroke-width="2" ${s.dashed ? 'stroke-dasharray="5 4"' : ''}/>`;
    s.values.forEach((v, i) => { const [x, y] = pt(i, Math.max(0, v || 0)); g += `<circle cx="${x}" cy="${y}" r="3" fill="${s.color}"/>`; });
  });
  let lx = 10;
  series.forEach((s) => {
    g += `<rect x="${lx}" y="${size + 6}" width="10" height="10" fill="${s.color}" rx="2"/><text x="${lx + 14}" y="${size + 15}" font-size="10" fill="${TEXT}">${esc(s.name)}</text>`;
    lx += 28 + String(s.name).length * 5.8;
  });
  const t = title ? `<text x="8" y="14" font-size="12" font-weight="700" fill="#0f172a">${esc(title)}</text>` : '';
  return `<svg viewBox="0 0 ${size} ${size + 22}" width="100%" style="max-width:${size}px" xmlns="http://www.w3.org/2000/svg" font-family="Inter,Arial,sans-serif" role="img" aria-label="${esc(title || 'Radar chart')}">${t}${g}</svg>`;
}

// Horizontal bars for rankings / distributions.  items: [{label,value,color,note}]
export function hBars({ items, max = 100, width = 520, rowH = 22, unit = '%', labelW = 150 }) {
  const H = items.length * rowH + 6;
  const W = width - labelW - 56;
  let g = '';
  items.forEach((it, i) => {
    const y = 3 + i * rowH;
    const w = Math.max(0, (it.value / (max || 1)) * W);
    g += `<text x="${labelW - 8}" y="${y + rowH / 2 + 3}" text-anchor="end" font-size="10.5" fill="${TEXT}">${esc(it.label)}</text>`;
    g += `<rect x="${labelW}" y="${y + 3}" width="${W}" height="${rowH - 8}" fill="#f1f5f9" rx="3"/>`;
    g += `<rect x="${labelW}" y="${y + 3}" width="${w}" height="${rowH - 8}" fill="${it.color || '#1d4ed8'}" rx="3"/>`;
    g += `<text x="${labelW + W + 6}" y="${y + rowH / 2 + 3}" font-size="10.5" font-weight="600" fill="${TEXT}">${f1(it.value)}${unit}</text>`;
  });
  return `<svg viewBox="0 0 ${width} ${H}" width="100%" style="max-width:${width}px" xmlns="http://www.w3.org/2000/svg" font-family="Inter,Arial,sans-serif" role="img" aria-label="Bar ranking">${g}</svg>`;
}

// Tiny inline trend line for table cells.
export function sparkline(values, { width = 90, height = 24, color = '#1d4ed8' } = {}) {
  const v = values.filter((x) => x !== null && x !== undefined);
  if (v.length < 2) return '';
  const mn = Math.min(...v), mx = Math.max(...v), rg = mx - mn || 1;
  const pts = v.map((val, i) => `${(i * (width - 6)) / (v.length - 1) + 3},${height - 4 - ((val - mn) / rg) * (height - 8)}`);
  const last = pts[pts.length - 1].split(',');
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round"/><circle cx="${last[0]}" cy="${last[1]}" r="2.6" fill="${color}"/></svg>`;
}
