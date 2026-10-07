// ─── TabIcons.jsx ────────────────────────────────────────────────────────────
// One global enhancer that puts a professional line icon on every module tab.
//
// Modules were built at different times: some tabs lead with an emoji ("📋
// Applications"), others are plain text ("Transactions"). Emoji render with a
// different size and look on every phone; this swaps them for one consistent
// 24-grid line-icon set that inherits the tab's own colour (so active/inactive
// states keep working) and gives text-only tabs an icon chosen from the label.
//
// It is non-destructive, in the same spirit as ResponsiveTables: it never
// removes a React-owned node. The leading emoji is trimmed from the existing
// text node and an <svg> span is inserted next to it. React re-applying its own
// text simply triggers one more (idempotent) pass.
//
// What counts as a tab: role="tab"; buttons inside role="tablist"; buttons whose
// class has a tab/tabs/qt token (ac-tab, st-tab, rx-tab, hs-qt …); and a strip of
// 3+ sibling buttons that mostly lead with an emoji (inline-styled tab bars).
// Every iconised tab also gets its own colour (by position in its strip, so
// neighbouring tabs always differ) and a Material-3 / Google Play layout: icon
// over a small label, the selected tab's icon in a tinted pill with a bold label. Only data-* attrs
// are added, never touching React-owned props.
// Opt out with data-ti-skip on the button or any ancestor. Buttons that already
// contain an <svg> (bottom bars, icon grids) are left alone.
// Tab bars that are wider than the screen wrap onto more rows (data-ti-wrap)
// instead of scrolling sideways, so every tab is visible without dragging.
import { useEffect } from 'react';

const S = (...d) => d; // icon = list of path strings (24×24 grid, stroke only)
const ICONS = {
  list:     S('M9 6h11', 'M9 12h11', 'M9 18h11', 'M4 6h.01', 'M4 12h.01', 'M4 18h.01'),
  doc:      S('M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z', 'M14 3v5h5', 'M9 13h6', 'M9 17h4'),
  note:     S('M12 20h9', 'M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z'),
  clipboard:S('M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2', 'M9 2h6v4H9z', 'M9 12h6', 'M9 16h4'),
  chart:    S('M3 3v18h18', 'M18 17V9', 'M13 17V5', 'M8 17v-3'),
  trend:    S('M22 7l-8.5 8.5-5-5L2 17', 'M16 7h6v6'),
  check:    S('M22 11.08V12a10 10 0 1 1-5.93-9.14', 'M22 4L12 14.01l-3-3'),
  calendar: S('M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M16 2v4', 'M8 2v4', 'M3 10h18'),
  alert:    S('M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z', 'M12 9v4', 'M12 17h.01'),
  gear:     S('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'),
  wrench:   S('M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z'),
  clock:    S('M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'),
  home:     S('M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10'),
  building: S('M3 21h18', 'M5 21V7l7-4 7 4v14', 'M9 21v-4h6v4', 'M9 11h.01', 'M15 11h.01', 'M9 14h.01', 'M15 14h.01'),
  xcircle:  S('M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M15 9l-6 6', 'M9 9l6 6'),
  users:    S('M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'),
  user:     S('M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'),
  trash:    S('M3 6h18', 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2', 'M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6', 'M10 11v6', 'M14 11v6'),
  printer:  S('M6 9V2h12v7', 'M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2', 'M6 14h12v8H6z'),
  card:     S('M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z', 'M2 10h20', 'M6 15h4'),
  ticket:   S('M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z', 'M13 5v2', 'M13 17v2', 'M13 11v2'),
  cross:    S('M12 5v14', 'M5 12h14', 'M19 8V5h-3', 'M5 16v3h3'),
  pulse:    S('M22 12h-4l-3 9L9 3l-3 9H2'),
  door:     S('M13 4h3a2 2 0 0 1 2 2v14', 'M2 20h3', 'M13 20h9', 'M10 12v.01', 'M13 4.56v14.88a1 1 0 0 1-1.2.98l-7-1.4A1 1 0 0 1 4 18.04V5.96a1 1 0 0 1 .8-.98l7-1.4A1 1 0 0 1 13 4.56z'),
  trophy:   S('M6 9H4.5a2.5 2.5 0 0 1 0-5H6', 'M18 9h1.5a2.5 2.5 0 0 0 0-5H18', 'M4 22h16', 'M10 14.66V17c0 .55-.47.98-1.21 1.21C7.85 18.75 7 20.24 7 22', 'M14 14.66V17c0 .55.47.98 1.21 1.21C16.15 18.75 17 20.24 17 22', 'M18 2H6v7a6 6 0 0 0 12 0V2z'),
  award:    S('M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12z', 'M8.21 13.89L7 23l5-3 5 3-1.21-9.12'),
  coins:    S('M12 8c4.42 0 8-1.34 8-3s-3.58-3-8-3-8 1.34-8 3 3.58 3 8 3z', 'M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5', 'M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6'),
  rupee:    S('M6 4h12', 'M6 9h12', 'M9 4c5 0 6 5 0 5H6l8 10'),
  book:     S('M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z', 'M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z'),
  globe:    S('M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M2 12h20', 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'),
  grid:     S('M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M3 14h7v7H3z', 'M14 14h7v7h-7z'),
  rows:     S('M3 5h18', 'M3 12h18', 'M3 19h18'),
  pin:      S('M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z', 'M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'),
  utensils: S('M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2', 'M7 2v20', 'M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7'),
  moon:     S('M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z'),
  sun:      S('M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z', 'M12 1v2', 'M12 21v2', 'M4.22 4.22l1.42 1.42', 'M18.36 18.36l1.42 1.42', 'M1 12h2', 'M21 12h2', 'M4.22 19.78l1.42-1.42', 'M18.36 5.64l1.42-1.42'),
  package:  S('M16.5 9.4L7.5 4.21', 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z', 'M3.27 6.96L12 12.01l8.73-5.05', 'M12 22.08V12'),
  bell:     S('M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9', 'M13.73 21a2 2 0 0 1-3.46 0'),
  megaphone:S('M3 11l18-5v12L3 14v-3z', 'M11.6 16.8a3 3 0 1 1-5.8-1.6'),
  phone:    S('M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z'),
  tag:      S('M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z', 'M7 7h.01'),
  cart:     S('M9 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 'M20 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 'M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6'),
  search:   S('M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.35-4.35'),
  link:     S('M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71', 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'),
  eye:      S('M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'),
  lock:     S('M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z', 'M7 11V7a5 5 0 0 1 10 0v4'),
  upload:   S('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M17 8l-5-5-5 5', 'M12 3v12'),
  download: S('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'),
  mail:     S('M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M22 6l-10 7L2 6'),
  shield:   S('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'),
  bus:      S('M8 6v6', 'M16 6v6', 'M2 12h20', 'M7 18H5a1 1 0 0 1-1-1V6a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v11a1 1 0 0 1-1 1h-2', 'M9 18h6', 'M7 18v2', 'M17 18v2'),
  refresh:  S('M23 4v6h-6', 'M1 20v-6h6', 'M3.51 9a9 9 0 0 1 14.85-3.36L23 10', 'M1 14l4.64 4.36A9 9 0 0 0 20.49 15'),
  chat:     S('M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'),
  brain:    S('M12 5a3 3 0 1 0-5.99.13A4 4 0 0 0 4 9a4 4 0 0 0 1 2.65A4 4 0 0 0 8 18a3 3 0 0 0 4 2.24', 'M12 5a3 3 0 1 1 5.99.13A4 4 0 0 1 20 9a4 4 0 0 1-1 2.65A4 4 0 0 1 16 18a3 3 0 0 1-4 2.24', 'M12 5v15'),
  plane:    S('M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z'),
  leaf:     S('M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z', 'M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12'),
  plus:     S('M12 5v14', 'M5 12h14'),
  grad:     S('M22 10L12 5 2 10l10 5z', 'M6 12v5c3 3 9 3 12 0v-5', 'M22 10v6'),
  monitor:  S('M2 4h20a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z', 'M8 21h8', 'M12 17v4'),
  star:     S('M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z'),
  image:    S('M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z', 'M21 15l-5-5L5 21'),
  layers:   S('M12 2l10 5-10 5L2 7z', 'M2 17l10 5 10-5', 'M2 12l10 5 10-5'),
  scale:    S('M12 3v18', 'M8 21h8', 'M3 7h18', 'M6 7l-3 7a4 4 0 0 0 6 0z', 'M18 7l-3 7a4 4 0 0 0 6 0z'),
  dot:      S('M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'),
};

// emoji → icon id
const EMOJI = {};
const map = (id, chars) => chars.split(/\s+/).filter(Boolean).forEach((c) => { EMOJI[c] = id; });
map('clipboard', '📋'); map('doc', '📄 📑 🧾 📃 📖'); map('note', '📝 ✏ ✎ ✍ 📓'); map('list', '☰ 📒 📕 📗');
map('layers', '🗂 🗃 🗄 📁 📂'); map('tag', '🏷');
map('chart', '📊 🕸 🧮'); map('trend', '📈 📉');
map('check', '✅ ✓ ✔ ☑'); map('calendar', '📅 📆 🗓'); map('alert', '⚠ 🚨 ❗ ‼');
map('gear', '⚙'); map('wrench', '🔧 🛠'); map('clock', '⏳ ⏰ ⏱ 🕐 🕑 🕒 🌓 ⌛');
map('home', '🏠 🏡'); map('building', '🏨 🏫 🏛 🏢'); map('xcircle', '❌ ⭕ 🚫 ✖ ✕');
map('users', '👥 🙋'); map('user', '👤 🧑 👨 👩 👷'); map('trash', '🗑');
map('printer', '🖨'); map('card', '💳 🪪'); map('ticket', '🎫'); map('cross', '🏥'); map('pulse', '💓');
map('door', '🚪 🚶 🏃'); map('trophy', '🏆 🥇 🥈 🥉 ★ 🎯'); map('award', '🌟 💎 🔰 🏅 🎖');
map('coins', '💰 💸 💵 🪙'); map('rupee', '₹'); map('book', '📚'); map('globe', '🌐 🌍 🌎');
map('grid', '⊞ ▦'); map('pin', '📌 📍'); map('utensils', '🍽'); map('moon', '🌙'); map('sun', '☀ 🌅 🌞');
map('package', '📦 🎒'); map('bell', '🔔'); map('megaphone', '📢'); map('phone', '📞');
map('cart', '🛒'); map('search', '🔍 🔎'); map('link', '🔗'); map('eye', '👁'); map('image', '🖼');
map('lock', '🔒 🔐'); map('upload', '📤'); map('download', '📥 ⬇ 💾'); map('mail', '📧 📮 ✉');
map('shield', '🛡'); map('bus', '🚌'); map('refresh', '🔄 🔀'); map('chat', '💬'); map('brain', '🧠 🤖');
map('plane', '✈ 🧳 🏖'); map('leaf', '🌿 🎉'); map('plus', '➕'); map('grad', '🎓'); map('monitor', '🖥');
map('star', '⭐ ✨'); map('scale', '⚖'); map('mail', '📨 📬'); map('megaphone', '📡 📣 📰 📲'); map('clock', '🕘'); map('building', '🏗'); map('user', '🧑‍🏫 👩‍🏫 👨‍🏫 🧑‍💼'); map('users', '👨‍👩'); map('lock', '🔑 🔓'); map('wrench', '🧰'); map('trend', '🔥 🚀'); map('pin', '🗺'); map('tag', '🔖'); map('dot', '🔵 🟢 🟡 🔴 ⚡ ➡ ⬅');

// text-only tabs: pick an icon from the label
const KEYWORDS = [
  [/dash|overview|home|summary|snapshot/, 'grid'],
  [/forecast|trend|growth|projection/, 'trend'],
  [/saving|reserve|fund|wallet/, 'coins'],
  [/fee|payment|collect|receipt|due|advance/, 'card'],
  [/transaction|income|expens|expend|budget|account|salary|payroll|bonus|money|ledger|treasury|cash|bank|purchase|sales|stock|inventory/, 'coins'],
  [/report|statement|register|book|log\b|logs|record|history|audit|master/, 'doc'],
  [/analy|trend|insight|forecast|graph|chart|stat|compare|progress|performance|rank/, 'chart'],
  [/student|child|admission|enrol|applicant|scholar/, 'grad'],
  [/staff|teacher|hr\b|people|user|member|team|batch|class|house|parent|visitor|enquir/, 'users'],
  [/attend|roll|present|absent|mark/, 'check'],
  [/leave|gate|pass|outing/, 'door'],
  [/schedule|timetable|calendar|session|date|month|day|week|year|term/, 'calendar'],
  [/setting|config|rule|setup|preference|policy/, 'gear'],
  [/approv|pending|queue|request|review/, 'clock'],
  [/alert|warning|issue|risk|fraud|monitor|anomal|neglect|discipline|complaint/, 'alert'],
  [/export|download|print|pdf|csv|xls/, 'download'],
  [/import|upload|bulk|sync/, 'upload'],
  [/exam|test|quiz|question|mock|result|paper|assess/, 'clipboard'],
  [/book|syllabus|course|subject|study|material|learn|lesson|teaching|notes?/, 'book'],
  [/notice|message|notif|announce|post|social|connect|chat|doubt|feedback/, 'megaphone'],
  [/search|find|lookup/, 'search'],
  [/hostel|room|dorm|repair|maintenance/, 'home'],
  [/kitchen|mess|meal|food/, 'utensils'],
  [/award|honou?r|certificate|merit|topper|leader|house point/, 'trophy'],
  [/security|access|role|permission|lock|admin/, 'shield'],
  [/sick|health|medical|clinic/, 'cross'],
];
const iconForText = (t) => {
  const s = t.toLowerCase();
  for (const [re, id] of KEYWORDS) if (re.test(s)) return id;
  return null;
};

const EMOJI_LEAD = /^\s*((?:\p{Extended_Pictographic}|[✓✔⭐⊞▦☰★✕✖₹⬇⬅➡])(?:️|‍\p{Extended_Pictographic}|\p{Emoji_Modifier})*)\s*/u;
const TAB_CLASS = /(?:^|[-_])(?:tab|tabs|tb|qt|subtab|subtabs)(?:$|[-_\d])/i;

const svgFor = (id) => {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  el.setAttribute('viewBox', '0 0 24 24');
  el.setAttribute('width', '16');
  el.setAttribute('height', '16');
  el.setAttribute('fill', 'none');
  el.setAttribute('stroke', 'currentColor');
  el.setAttribute('stroke-width', '1.9');
  el.setAttribute('stroke-linecap', 'round');
  el.setAttribute('stroke-linejoin', 'round');
  el.setAttribute('aria-hidden', 'true');
  (ICONS[id] || ICONS.dot).forEach((d) => {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d);
    el.appendChild(p);
  });
  return el;
};
const makeIcon = (id) => {
  const s = document.createElement('span');
  s.className = 'ti-ic';
  s.setAttribute('data-ti-icon', id);
  s.setAttribute('aria-hidden', 'true');
  s.appendChild(svgFor(id));
  return s;
};

function firstTextNode(el) {
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
  let n;
  while ((n = w.nextNode())) {
    if (n.parentNode && n.parentNode.closest && n.parentNode.closest('[data-ti-icon],svg')) continue;
    if (n.nodeValue && n.nodeValue.trim()) return n;
  }
  return null;
}

const isTabBtn = (b) => {
  if (b.closest('[data-ti-skip]')) return false;
  if (b.getAttribute('role') === 'tab') return true;
  if (b.closest('[role="tablist"]')) return true;
  const cls = (b.getAttribute('class') || '').split(/\s+/);
  if (cls.some((c) => TAB_CLASS.test(c))) return true;
  const p = b.parentElement;
  return !!(p && (p.getAttribute('role') === 'tablist' || (p.getAttribute('class') || '').split(/\s+/).some((c) => TAB_CLASS.test(c))));
};

// inline-styled strips: 3+ sibling buttons, most leading with an emoji
function emojiStrip(b) {
  const p = b.parentElement;
  if (!p) return false;
  if (p.__tiStrip !== undefined && p.__tiStripN === p.childElementCount) return p.__tiStrip;
  const kids = Array.from(p.children).filter((c) => c.tagName === 'BUTTON');
  let ok = false;
  if (kids.length >= 3 && kids.length === p.childElementCount) {
    const lead = kids.filter((k) => {
      const t = firstTextNode(k);
      return t && EMOJI_LEAD.test(t.nodeValue) && (k.textContent || '').length <= 34;
    }).length;
    ok = lead / kids.length >= 0.6;
  }
  p.__tiStrip = ok; p.__tiStripN = p.childElementCount;
  return ok;
}

function process(b) {
  if (b.hasAttribute('data-ti-skip')) return;
  const explicit = isTabBtn(b);
  const t = firstTextNode(b);
  if (!t) return;
  const lead = EMOJI_LEAD.exec(t.nodeValue);
  const existing = b.querySelector(':scope > [data-ti-icon], :scope > * > [data-ti-icon]');
  if (!lead) {
    // already iconised, or text-only tab that needs a label-based icon
    if (existing) { colorize(b); return; }
    if (!explicit) return;
    if (b.querySelector('svg')) return;
    const label = (b.textContent || '').trim();
    if (!label || label.length > 40 || /^[\d\s.,%+-]+$/.test(label)) return;
    const id = iconForText(label) || 'dot';
    t.parentNode.insertBefore(makeIcon(id), t);
    b.setAttribute('data-ti', '1');
    colorize(b);
    return;
  }
  if (!explicit && !emojiStrip(b)) return;
  const key = lead[1].replace(/️/g, '');
  let id = EMOJI[key] || EMOJI[Array.from(key)[0]];
  if (id === 'plus' && /sick|health|medical/i.test(t.nodeValue)) id = 'cross'; // ➕ used as a medical cross
  if (!id) return; // unknown emoji: leave exactly as it was
  if (existing) { // React re-applied its text: just trim the emoji again
    t.nodeValue = t.nodeValue.slice(lead[0].length);
    colorize(b);
    return;
  }
  if (!explicit && b.querySelector('svg')) return;
  t.nodeValue = t.nodeValue.slice(lead[0].length);
  t.parentNode.insertBefore(makeIcon(id), t);
  b.setAttribute('data-ti', '1');
  if (!(b.textContent || '').trim()) b.setAttribute('data-ti-only', '1');
  colorize(b);
}

function scan(root) {
  if (!root || root.nodeType !== 1) return;
  const btns = root.matches && root.matches('button,[role="tab"]') ? [root] : [];
  root.querySelectorAll && root.querySelectorAll('button,[role="tab"]').forEach((b) => btns.push(b));
  btns.forEach((b) => { try { process(b); } catch { /* never break the page for an icon */ } });
  const bars = new Set();
  btns.forEach((b) => { const s = b.closest('[role="tablist"]') || b.parentElement; if (isStrip(s) || b.hasAttribute('data-ti-c')) bars.add(s); });
  bars.forEach((s) => { try { watchStrip(s); fitStrip(s); } catch { /* cosmetic only */ } });
}

// 12 distinct mid-tone hues: readable as a stroke on white and as a chip on dark tabs.
const PALETTE = ['#2563EB', '#059669', '#D97706', '#7C3AED', '#E11D48', '#0891B2', '#EA580C', '#DB2777', '#0D9488', '#4F46E5', '#65A30D', '#C026D3'];

const CSS = `
.ti-ic{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;width:1.15em;height:1.15em;margin-right:.5em;vertical-align:-.2em;color:inherit;opacity:.92;line-height:0}
.ti-ic svg{width:100%;height:100%;display:block}
[data-ti]{align-items:center}
[data-ti-only] .ti-ic{margin-right:0}
${PALETTE.map((c, i) => `[data-ti-c="${i}"]{--ti-c:${c}}`).join('')}
/* Modules sometimes recolour svg strokes on their selected tab: keep the icon on the tab's own colour. */
[data-ti-c][data-ti-c] .ti-ic svg{color:inherit!important;stroke:currentColor!important;fill:none!important}
/* Chip look — every coloured tab: icon in a tinted chip; selected tab = solid chip + underline. */
[data-ti-c] .ti-ic{width:1.6em;height:1.6em;padding:.3em;box-sizing:border-box;border-radius:.55em;opacity:1;color:#fff;background:#132a4f;background:linear-gradient(160deg,#1f4e8c,#0b1e3d);box-shadow:inset 0 1px 0 rgba(255,255,255,.22);transition:background .15s,color .15s}
[data-ti-c][data-ti-active]:not([data-ti-m3]){box-shadow:inset 0 -3px 0 var(--ti-c)!important}
[data-ti-c][data-ti-active] .ti-ic{background:linear-gradient(160deg,#d4ae58,#b8923a);color:#1a1406}
/* Material-3 / Google Play look — only for plain tab bars (icon + label, a detectable selected tab).
   Repeated attribute selectors raise specificity above modules' own !important tab styles. */
[data-ti-m3][data-ti-m3][data-ti-m3]{flex:0 0 auto!important;width:auto!important;max-width:none!important;display:inline-flex!important;flex-direction:column!important;align-items:center!important;justify-content:flex-start!important;gap:4px!important;min-width:64px;height:auto!important;padding:6px 12px 8px!important;border:0!important;border-radius:16px!important;background:transparent!important;background-image:none!important;box-shadow:none!important;color:#5f6368!important;font-size:12px!important;font-weight:500!important;line-height:1.2!important;text-align:center!important;white-space:nowrap}
[data-ti-m3][data-ti-m3] .ti-ic{width:56px!important;height:30px!important;margin:0!important;padding:0!important;box-sizing:border-box;border-radius:16px!important;opacity:1;background:#132a4f!important;background:linear-gradient(160deg,#1f4e8c,#0b1e3d)!important;color:#fff!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.22);transition:background .18s}
[data-ti-m3][data-ti-m3] .ti-ic svg{width:21px!important;height:21px!important}
[data-ti-m3][data-ti-m3]:hover:not([data-ti-active]) .ti-ic{filter:brightness(1.15)}
[data-ti-m3][data-ti-m3][data-ti-m3][data-ti-active]{color:#202124!important;font-weight:700!important}
[data-ti-m3][data-ti-m3][data-ti-active] .ti-ic{background:linear-gradient(160deg,#d4ae58,#b8923a)!important;color:#1a1406!important}
[data-ti-m3][data-ti-m3][data-ti-m3][data-ti-dark]{color:#bdc1c6!important}
[data-ti-m3][data-ti-m3][data-ti-m3][data-ti-dark][data-ti-active]{color:#fff!important}
[data-ti-m3][data-ti-m3][data-ti-dark] .ti-ic{color:#fff!important;background:linear-gradient(160deg,#2f63a8,#1a3a6e)!important}
[data-ti-m3][data-ti-m3][data-ti-dark][data-ti-active] .ti-ic{background:linear-gradient(160deg,#d4ae58,#b8923a)!important;color:#1a1406!important}
/* A tab bar too wide for the screen wraps onto more rows instead of scrolling sideways. */
[data-ti-wrap][data-ti-wrap]{flex-wrap:wrap!important;overflow-x:visible!important;row-gap:6px;max-width:100%}
[data-ti-wrap="flex"][data-ti-wrap="flex"]{display:flex!important}
[data-ti-wrap="iflex"][data-ti-wrap="iflex"]{display:inline-flex!important}
[data-ti-wrap] > *{flex-shrink:0}
[data-ti-wrap-out][data-ti-wrap-out]{overflow-x:visible!important}
[data-ti-m3][data-ti-only]{min-width:0}
[data-ti-m3][data-ti-only] .ti-ic{width:48px!important}
`;

// ── per-tab colour + selected-tab highlight ─────────────────────────────────
const isBtn = (c) => c.nodeType === 1 && (c.tagName === 'BUTTON' || c.getAttribute('role') === 'tab');
const ACTIVE_CLASS = /(?:^|[-_])(?:on|active|act|selected|current|sel)(?:$|[-_])/i;

function stripOf(b) {
  const tl = b.closest('[role="tablist"]');
  if (tl) return tl;
  return b.parentElement;
}
const tabsOf = (strip) => (strip ? Array.from(strip.querySelectorAll('[data-ti-icon]')).map((i) => i.closest('button,[role="tab"]')).filter((b, i, a) => b && a.indexOf(b) === i && stripOf(b) === strip) : []);

// Is the surface behind a tab dark? Walks up to the first ancestor with an opaque
// colour or a gradient (gradient colour stops are averaged).
const RGB = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/g;
const lum = (m) => (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255;
function onDark(el) {
  for (let n = el; n; n = n.parentElement) {
    const cs = getComputedStyle(n);
    const stops = [];
    const grad = cs.backgroundImage || '';
    if (grad.includes('gradient')) stops.push(...grad.matchAll(RGB));
    if (!stops.length) stops.push(...(cs.backgroundColor || '').matchAll(RGB));
    const solid = stops.filter((m) => m[4] === undefined || parseFloat(m[4]) > 0.5);
    if (solid.length) return solid.reduce((t, m) => t + lum(m), 0) / solid.length < 0.45;
  }
  return false;
}

let onColored = null; // set while the enhancer is mounted: re-checks the selected tab of a strip
function colorize(b) {
  const strip = stripOf(b);
  if (!strip) return;
  const sibs = Array.from(strip.children).filter(isBtn);
  let idx = sibs.indexOf(b);
  if (idx < 0) { // tab wrapped in another element: fall back to its position among all tabs of the strip
    idx = Array.from(strip.querySelectorAll('button,[role="tab"]')).indexOf(b);
  }
  if (idx < 0) idx = 0;
  const v = String(idx % PALETTE.length);
  if (b.getAttribute('data-ti-c') !== v) b.setAttribute('data-ti-c', v);
  const dark = onDark(strip);
  if (dark !== b.hasAttribute('data-ti-dark')) { if (dark) b.setAttribute('data-ti-dark', ''); else b.removeAttribute('data-ti-dark'); }
  if (onColored) onColored(b);
}

const explicitState = (b) => {
  const sel = b.getAttribute('aria-selected'), cur = b.getAttribute('aria-current'), prs = b.getAttribute('aria-pressed');
  if (sel !== null || cur !== null || prs !== null) return { known: true, on: sel === 'true' || (cur !== null && cur !== 'false') || prs === 'true' };
  const cls = (b.getAttribute('class') || '').split(/\s+/).filter(Boolean);
  return { known: false, on: cls.some((c) => ACTIVE_CLASS.test(c)) };
};

function syncActive(strip) {
  if (!strip || !strip.isConnected) return;
  const tabs = tabsOf(strip);
  if (!tabs.length) return;
  const states = tabs.map(explicitState);
  let active = new Set();
  if (states.some((x) => x.known) || states.some((x) => x.on)) {
    tabs.forEach((b, i) => { if (states[i].on) active.add(b); });
  } else if (tabs.length >= 3) {
    // inline-styled strip: the selected tab is the one tab whose look differs from all the others
    const groups = new Map();
    tabs.forEach((b) => {
      // the tab's own inline style / class text (computed colours are flattened by the tab layout above)
      const sig = `${b.getAttribute('style') || ''}|${b.getAttribute('class') || ''}`;
      if (!groups.has(sig)) groups.set(sig, []);
      groups.get(sig).push(b);
    });
    const all = [...groups.values()];
    const singles = all.filter((g) => g.length === 1).map((g) => g[0]);
    if (all.some((g) => g.length >= 2)) {
      if (singles.length === 1) active = new Set(singles);
      // a hovered tab can look different too: then the selected one is the single that isn't hovered
      else if (singles.length === 2) {
        const calm = singles.filter((b) => !b.matches(':hover'));
        if (calm.length === 1) active = new Set(calm);
      }
    }
  }
  // Material-3 layout only for plain tabs (icon + label, nothing else inside) in a real tab bar
  const plain = tabs.every((b) => b.children.length === 1 && b.firstElementChild.hasAttribute('data-ti-icon'));
  const m3 = plain && (tabs.every(isTabBtn) || active.size > 0);
  tabs.forEach((b) => {
    const want = active.has(b);
    if (want !== b.hasAttribute('data-ti-active')) {
      if (want) b.setAttribute('data-ti-active', ''); else b.removeAttribute('data-ti-active');
    }
    if (m3 !== b.hasAttribute('data-ti-m3')) {
      if (m3) b.setAttribute('data-ti-m3', ''); else b.removeAttribute('data-ti-m3');
    }
  });
  fitStrip(strip);
}

// ── tab bars wrap instead of scrolling sideways ─────────────────────────────
// A tab bar whose tabs don't fit its width (or that is wider than the
// scrolling box around it) is switched to wrapping. Once set it stays: a bar
// that fits on one row looks the same either way.
const isStrip = (el) => {
  if (!el || el.nodeType !== 1 || el.closest('[data-ti-skip]')) return false;
  if (el.getAttribute('role') === 'tablist') return true;
  return (el.getAttribute('class') || '').split(/\s+/).some((c) => TAB_CLASS.test(c)) && !!el.querySelector(':scope > button, :scope > [role="tab"]');
};
const scrollsX = (el) => /auto|scroll/.test(getComputedStyle(el).overflowX);
function fitStrip(strip) {
  if (!strip || !strip.isConnected || strip.hasAttribute('data-ti-wrap')) return;
  if (!strip.clientWidth) return; // hidden: checked again when it appears
  const outer = strip.parentElement;
  const tooWide = strip.scrollWidth > strip.clientWidth + 1;
  const outerTooWide = !tooWide && outer && outer !== document.body && scrollsX(outer) && strip.offsetWidth > outer.clientWidth + 1;
  if (!tooWide && !outerTooWide) return;
  const d = getComputedStyle(strip).display;
  strip.setAttribute('data-ti-wrap', d === 'inline-flex' ? 'iflex' : d === 'flex' ? '' : 'flex');
  if (outerTooWide) outer.setAttribute('data-ti-wrap-out', '');
}
let fitObserver = null; // ResizeObserver: re-checks a bar when it is shown or resized
let fitWatched = new WeakSet();
function watchStrip(strip) {
  if (!fitObserver || !strip || fitWatched.has(strip)) return;
  fitWatched.add(strip);
  fitObserver.observe(strip);
}

export default function TabIcons() {
  useEffect(() => {
    const st = document.createElement('style');
    st.setAttribute('data-ti-style', '');
    st.textContent = CSS;
    document.head.appendChild(st);

    const pending = new Set();
    let raf = 0;
    const flush = () => {
      raf = 0;
      const roots = Array.from(pending); pending.clear();
      roots.forEach((r) => { if (r.isConnected) scan(r); });
    };
    const queue = (n) => {
      const el = n.nodeType === 3 ? n.parentElement : n;
      if (!el || el.nodeType !== 1) return;
      const btn = el.closest ? el.closest('button,[role="tab"]') : null;
      pending.add(btn || el);
      if (!raf) raf = requestAnimationFrame(flush);
    };
    // selected-tab highlight: re-evaluate a strip when any of its tabs change state
    const strips = new Set();
    let sraf = 0, timer = 0;
    const flushActive = () => { sraf = 0; const list = Array.from(strips); strips.clear(); list.forEach((x) => { try { syncActive(x); } catch { /* cosmetic only */ } }); };
    const queueActive = (btn) => {
      const strip = stripOf(btn);
      if (!strip) return;
      strips.add(strip);
      if (!sraf) sraf = requestAnimationFrame(flushActive);
      // CSS transitions on the tab itself are still mid-way on the next frame: look again once they settle
      clearTimeout(timer);
      timer = setTimeout(() => { strips.add(strip); flushActive(); }, 280);
    };
    onColored = queueActive;
    fitWatched = new WeakSet();
    fitObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver((entries) => entries.forEach((e) => { try { fitStrip(e.target); } catch { /* cosmetic only */ } }))
      : null;
    const mo = new MutationObserver((muts) => {
      muts.forEach((m) => {
        if (m.type === 'attributes') {
          const btn = m.target.nodeType === 1 && m.target.closest ? m.target.closest('button,[role="tab"]') : null;
          if (btn && btn.hasAttribute('data-ti-c')) queueActive(btn);
          return;
        }
        if (m.type === 'childList') {
          m.addedNodes.forEach((n) => { if (!(n.nodeType === 1 && n.hasAttribute('data-ti-icon'))) queue(n); });
          if (m.target.nodeType === 1) queue(m.target);
        } else if (m.type === 'characterData') queue(m.target);
      });
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'style', 'aria-selected', 'aria-current', 'aria-pressed'] });
    scan(document.body);
    document.querySelectorAll('[data-ti-c]').forEach((b) => queueActive(b));
    return () => { onColored = null; if (fitObserver) { fitObserver.disconnect(); fitObserver = null; } mo.disconnect(); if (raf) cancelAnimationFrame(raf); if (sraf) cancelAnimationFrame(sraf); clearTimeout(timer); st.remove(); };
  }, []);
  return null;
}
