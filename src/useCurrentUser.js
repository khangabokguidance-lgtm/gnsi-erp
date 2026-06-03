// useCurrentUser.js
// Your app passes currentUser as a prop from App.jsx
// This hook just normalises it for use across modules

export function useCurrentUser(currentUserProp) {
  const currentUser   = currentUserProp || null
  const userLoading   = false

  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Administrator' || currentUser?.role === 'Teaching + Admin'
  const isTeaching    = currentUser?.role === 'Teaching' || currentUser?.role === 'Teaching + Admin'
  const isNonTeaching = currentUser?.role === 'Non-Teaching'
  const canManage     = isAdmin

  return { currentUser, userLoading, isAdmin, isTeaching, isNonTeaching, canManage }
}