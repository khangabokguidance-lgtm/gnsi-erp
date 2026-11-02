// houseMasters.js — which House Master / Mistress is assigned to a student's house (pure, no React).
//
// Sources (see housemasters table + Staff Records):
//   housemasters   one row per assignment: house, name, phone, staff_profile_id, status
//   staff_profiles the Staff Records — the master's/mistress's name and designation come from here when
//                  the assignment is linked (staff_profile_id), otherwise from the housemasters row
//   students       each student's house
const gccKey = (v) => String(parseInt(String(v ?? '').replace(/\D/g, ''), 10) || '');
const houseKey = (h) => String(h ?? '').trim().toLowerCase();

// "House Mistress" / "House Master" from the staff designation; generic when it says neither.
export function hmTitle(designation) {
  const d = String(designation || '');
  if (/mistress/i.test(d)) return 'House Mistress';
  if (/master/i.test(d)) return 'House Master';
  return 'House Master/Mistress';
}

export function buildHouseDirectory({ students = [], housemasters = [], staff = [] }) {
  const staffById = new Map(staff.map((s) => [String(s.id), s]));
  const byHouse = new Map();
  housemasters.filter((h) => String(h.status || 'Active').toLowerCase() !== 'inactive').forEach((h) => {
    const k = houseKey(h.house);
    if (!k) return;
    const sp = h.staff_profile_id != null ? staffById.get(String(h.staff_profile_id)) : null;
    const name = String(sp?.name || h.name || '').trim();
    if (!name) return;
    const list = byHouse.get(k) || [];
    list.push({ name, title: hmTitle(sp?.designation), phone: sp?.phone || h.phone || '', fromStaffRecord: !!sp });
    byHouse.set(k, list);
  });
  const houseOf = new Map();
  students.forEach((s) => {
    if (s.deleted_at || (s.status && s.status !== 'Active')) return;
    const g = gccKey(s.gcc_no);
    if (g && String(s.house || '').trim()) houseOf.set(g, String(s.house).trim());
  });
  const houses = [...new Set(houseOf.values())].sort((a, b) => a.localeCompare(b));
  // For a GCC: its house and the master(s)/mistress(es) assigned to that house.
  const lookup = (gcc) => {
    const house = houseOf.get(gccKey(gcc)) || '';
    const masters = house ? (byHouse.get(houseKey(house)) || []) : [];
    return { house, masters, label: masters.map((m) => m.name).join(' / ') };
  };
  // Everyone who can be chosen as a House Master / Mistress (one entry per person), for assigning to a group.
  const seen = new Set();
  const masters = [];
  [...byHouse.values()].flat().forEach((m) => { const k = m.name.toLowerCase(); if (!seen.has(k)) { seen.add(k); masters.push({ key: k, name: m.name, title: m.title }); } });
  masters.sort((a, b) => a.name.localeCompare(b.name));
  return { lookup, houses, masters };
}
