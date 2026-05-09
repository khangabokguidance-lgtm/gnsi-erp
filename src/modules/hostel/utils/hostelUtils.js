export function fmtDate(d) {
  if (!d) return '—';
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return d; }
}

export function today() {
  return new Date().toISOString().split('T')[0];
}

export function nextId(arr) {
  return arr.length ? Math.max(...arr.map(x => x.id)) + 1 : 1;
}

export const HOUSES = [
  'KOMBIREI', 'LOKTAK', 'SINGAREI', 'KANGLA', 'KOUBRU',
  'SHIROI', 'SANGAI', 'SANAREI', 'NONGIN',
];

export const MEAL_COLORS = {
  Breakfast: '#16a34a', Lunch: '#2563eb', Snacks: '#d97706', Dinner: '#7c3aed',
};

export const STATUS_COLOR = {
  Open: '#dc2626', Pending: '#f59e0b', Active: '#3b78c9',
  Approved: '#16a34a', Resolved: '#16a34a', Completed: '#16a34a',
  Returned: '#6b7280', Rejected: '#dc2626', Admitted: '#3b78c9',
  Discharged: '#16a34a', Referred: '#f59e0b', Monitoring: '#f59e0b',
  Scheduled: '#3b78c9', Out: '#f59e0b',
};
