// collector.js — who is collecting a fee. "Collected By" is never typed: it is the signed-in user's own
// name, so the audit trail always names whoever was actually logged in.

// The signed-in user's name, trimmed ('' when the session carries none).
export const loggedInName = user => String(user?.userName || user?.name || user?.username || '').trim()
