// houseDirectory.js — loads students' houses and the assigned House Masters / Mistresses from the Staff Records.
import { supabase } from './supabase';
import { buildHouseDirectory } from './lib/houseMasters';

export async function loadHouseDirectory() {
  const [st, hm, sp] = await Promise.all([
    supabase.from('students').select('gcc_no, house, status, deleted_at'),
    supabase.from('housemasters').select('name, house, phone, staff_profile_id, status'),
    supabase.from('staff_profiles').select('id, name, designation, phone, role, status'),
  ]);
  const err = st.error || hm.error;   // staff_profiles is optional: an assignment then falls back to its own name
  if (err) throw new Error(err.message);
  return buildHouseDirectory({ students: st.data || [], housemasters: hm.data || [], staff: sp.data || [] });
}
