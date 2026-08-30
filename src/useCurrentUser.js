// useCurrentUser.js
// Your app passes currentUser as a prop from App.jsx
// This hook just normalises it for use across modules

export function useCurrentUser(currentUserProp) {
  const currentUser   = currentUserProp || null
  const userLoading   = false

  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Administrator' || currentUser?.role === 'Teaching + Admin'
  const isTeaching    = currentUser?.role === 'Teaching' || currentUser?.role === 'Teaching + Admin'
  const isNonTeaching = currentUser?.role === 'Non-Teaching'

  // 'Staff Manager' is a scoped, non-admin role: it unlocks editing in
  // Staff.jsx and Salary.jsx (canManage) without granting isAdmin anywhere
  // else in the app — admin-only screens/checks (isAdmin) are untouched.
  const isStaffManager = currentUser?.role === 'Staff Manager'
  const canManage       = isAdmin || isStaffManager

  return { currentUser, userLoading, isAdmin, isTeaching, isNonTeaching, isStaffManager, canManage }
}