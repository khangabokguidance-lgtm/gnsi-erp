// ─────────────────────────────────────────────────────────────────────────────
// src/features/hostel/index.js
// This is the PUBLIC entry point for the whole hostel module.
// Import pages from here; never import directly from the sub-folders
// in other parts of your app (e.g. in your router file, use this).
// ─────────────────────────────────────────────────────────────────────────────
export { default as BoarderPage }     from './pages/BoarderPage';
export { default as KitchenPage }     from './pages/KitchenPage';
export { default as HostelPage }      from './pages/HostelPage';
export { default as HousePage }       from './pages/HousePage';
export { default as HousemasterPage } from './pages/HousemasterPage';
export { default as DisciplinePage }  from './pages/DisciplinePage';
export { default as SickbayPage }     from './pages/SickbayPage';
export { default as NightDutyPage }   from './pages/NightDutyPage';
