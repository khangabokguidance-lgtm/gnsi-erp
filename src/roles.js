// roles.js — the single source of truth for "is this user an admin",
// with zero dependencies of its own.
//
// WHY THIS FILE EXISTS
// ADMIN_ROLES/isAdminRole originally lived in App.jsx. That was fine as
// long as only App.jsx needed them — but App.jsx also imports many of the
// module screens it renders (Fees, Staff, HR, ...) for the sidebar/routing.
// The moment one of those modules also needs isAdminRole (e.g. Fees.jsx's
// FeeDashboardTab admin-only cards), importing it from App.jsx creates a
// circular import: App -> Fees -> App. Bundlers often tolerate this, but
// it's fragile and easy to break by reordering code. Pulling the constant
// and helper out into this standalone file lets App.jsx and every module
// screen import the same values without importing each other.
//
// App.jsx re-exports these (see the two-line shim there) so any file still
// importing ADMIN_ROLES/isAdminRole from './App' keeps working unchanged;
// new/updated imports should point here directly.

export const ADMIN_ROLES = ['Admin', 'Administrator', 'Co-Admin']
export const isAdminRole = (role) => ADMIN_ROLES.includes(role)