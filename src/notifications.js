import { supabase } from './supabase'

// ══════════════════════════════════════════════════════════════
//  SHARED PUSH NOTIFICATION HELPERS
//  Used by both Hostel.jsx and LeaveTab.jsx. Lives in its own file
//  (rather than being exported from Hostel.jsx) specifically to avoid
//  a circular import — Hostel.jsx already imports LeaveTab.jsx, so
//  LeaveTab.jsx importing back from Hostel.jsx would create a cycle.
//
//  Resolution path: housemasters.house → housemasters.name → staff_profiles
//  (matched by name) → staff_profiles.id → push_subscriptions.staff_id.
// ══════════════════════════════════════════════════════════════

export async function sendPushToStaffId(staffId, title, body, url = '/hostel') {
  if (!staffId) return
  try {
    await fetch('/api/send-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, url, staffId }),
    })
  } catch (e) {
    console.error('sendPushToStaffId failed:', e)
  }
}

export async function notifyHousemasterByName(housemasterName, title, body, url = '/hostel') {
  const name = (housemasterName || '').trim()
  if (!name) return
  try {
    const { data: staff } = await supabase
      .from('staff_profiles')
      .select('id')
      .ilike('name', name)
      .maybeSingle()
    if (!staff?.id) {
      console.warn(`notifyHousemasterByName: no staff_profiles match for "${name}"`)
      return
    }
    await sendPushToStaffId(staff.id, title, body, url)
  } catch (e) {
    console.error('notifyHousemasterByName failed:', e)
  }
}

export async function notifyHousemasterByHouse(house, title, body, url = '/hostel') {
  const h = (house || '').trim()
  if (!h) return
  try {
    const { data: hm } = await supabase
      .from('housemasters')
      .select('name')
      .ilike('house', h)
      .eq('status', 'Active')
      .maybeSingle()
    if (!hm?.name) {
      console.warn(`notifyHousemasterByHouse: no active housemaster for house "${h}"`)
      return
    }
    await notifyHousemasterByName(hm.name, title, body, url)
  } catch (e) {
    console.error('notifyHousemasterByHouse failed:', e)
  }
}