// ─────────────────────────────────────────────────────────────────────────────
// hostelApi.js
// All data is saved in localStorage for now.
// When your backend is ready, just replace each function with
// a fetch() or axios call — nothing else in the module needs to change.
// ─────────────────────────────────────────────────────────────────────────────

function lsGet(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function lsSet(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

// ── Boarder ──────────────────────────────────────────────────────────────────
export const boarderApi = {
  getSchedule:        () => Promise.resolve(lsGet('hs_boarder_schedule', [])),
  saveSchedule:       (r) => { lsSet('hs_boarder_schedule', r); return Promise.resolve(); },
  getSundaySchedule:  () => Promise.resolve(lsGet('hs_boarder_sunday', [])),
  saveSundaySchedule: (r) => { lsSet('hs_boarder_sunday', r); return Promise.resolve(); },
  getStaffArrange:    () => Promise.resolve(lsGet('hs_staffarrange', { lunchdinner: [], bathing: [], playtime: [] })),
  saveStaffArrange:   (d) => { lsSet('hs_staffarrange', d); return Promise.resolve(); },
};

// ── Kitchen ───────────────────────────────────────────────────────────────────
export const kitchenApi = {
  getStockItems:   () => Promise.resolve(lsGet('hs_stock_items', [])),
  saveStockItems:  (r) => { lsSet('hs_stock_items', r); return Promise.resolve(); },
  getMenuEntries:  () => Promise.resolve(lsGet('hs_menu', [])),
  saveMenuEntries: (r) => { lsSet('hs_menu', r); return Promise.resolve(); },
  getDailyStock:   () => Promise.resolve(lsGet('hs_daily_stock', [])),
  saveDailyStock:  (r) => { lsSet('hs_daily_stock', r); return Promise.resolve(); },
  getStockLog:     () => Promise.resolve(lsGet('hs_stock_log', [])),
  appendStockLog:  (entry) => {
    const logs = lsGet('hs_stock_log', []);
    const id = logs.length ? Math.max(...logs.map(l => l.id)) + 1 : 1;
    logs.push({ id, ...entry });
    lsSet('hs_stock_log', logs.slice(-500));
    return Promise.resolve();
  },
};

// ── Hostel ────────────────────────────────────────────────────────────────────
export const hostelApi = {
  getLeave:       () => Promise.resolve(lsGet('hs_leave', [])),
  saveLeave:      (r) => { lsSet('hs_leave', r); return Promise.resolve(); },
  getOutpass:     () => Promise.resolve(lsGet('hs_outpass', [])),
  saveOutpass:    (r) => { lsSet('hs_outpass', r); return Promise.resolve(); },
  getOuting:      () => Promise.resolve(lsGet('hs_outing', [])),
  saveOuting:     (r) => { lsSet('hs_outing', r); return Promise.resolve(); },
  getRollCall:    () => Promise.resolve(lsGet('hs_rollcall', [])),
  saveRollCall:   (r) => { lsSet('hs_rollcall', r); return Promise.resolve(); },
  getActivities:  () => Promise.resolve(lsGet('hs_activities', [])),
  saveActivities: (r) => { lsSet('hs_activities', r); return Promise.resolve(); },
  getComplaints:  () => Promise.resolve(lsGet('hs_complaints', [])),
  saveComplaints: (r) => { lsSet('hs_complaints', r); return Promise.resolve(); },
};

// ── House ─────────────────────────────────────────────────────────────────────
export const houseApi = {
  getPoints:       () => Promise.resolve(lsGet('hs_house_points', [])),
  savePoints:      (r) => { lsSet('hs_house_points', r); return Promise.resolve(); },
  getMaintenance:  () => Promise.resolve(lsGet('hs_maintenance', [])),
  saveMaintenance: (r) => { lsSet('hs_maintenance', r); return Promise.resolve(); },
  getBehaviour:    () => Promise.resolve(lsGet('hs_behaviour', [])),
  saveBehaviour:   (r) => { lsSet('hs_behaviour', r); return Promise.resolve(); },
  getHealth:       () => Promise.resolve(lsGet('hs_health', [])),
  saveHealth:      (r) => { lsSet('hs_health', r); return Promise.resolve(); },
  getAcademic:     () => Promise.resolve(lsGet('hs_academic', [])),
  saveAcademic:    (r) => { lsSet('hs_academic', r); return Promise.resolve(); },
};

// ── Discipline ────────────────────────────────────────────────────────────────
export const disciplineApi = {
  getRecords:  () => Promise.resolve(lsGet('hs_discipline', [])),
  saveRecords: (r) => { lsSet('hs_discipline', r); return Promise.resolve(); },
};

// ── Sickbay ───────────────────────────────────────────────────────────────────
export const sickbayApi = {
  getRecords:  () => Promise.resolve(lsGet('hs_sickbay', [])),
  saveRecords: (r) => { lsSet('hs_sickbay', r); return Promise.resolve(); },
};

// ── Night Duty ────────────────────────────────────────────────────────────────
export const nightDutyApi = {
  getRecords:  () => Promise.resolve(lsGet('hs_nightduty', [])),
  saveRecords: (r) => { lsSet('hs_nightduty', r); return Promise.resolve(); },
};
