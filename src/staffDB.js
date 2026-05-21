// ─── staffDB.js — GNSI Portal Central Staff Database Layer ───────────────────
// Single source of truth for all staff data across:
//   Staff.jsx · Checklist · Salary · TimeTable · Teaching · Attendance · Hostel
//
// Usage:
//   import { staffDB } from './staffDB'
//
// All modules call staffDB.getAll(), staffDB.getTeaching(), etc.
// No module fetches staff_profiles directly — always go through staffDB.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase'

// ─── Internal cache ───────────────────────────────────────────────────────────
let _cache       = null
let _lastFetched = null
const CACHE_TTL  = 5 * 60 * 1000  // 5 minutes

// ─── Core fetch ──────────────────────────────────────────────────────────────
async function _fetchFresh() {
  const { data, error } = await supabase
    .from('staff_profiles')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw new Error('staffDB: fetch failed — ' + error.message)
  _cache       = data || []
  _lastFetched = Date.now()
  return _cache
}

async function _get(force = false) {
  if (!force && _cache && _lastFetched && (Date.now() - _lastFetched < CACHE_TTL)) {
    return _cache
  }
  return _fetchFresh()
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const isTeaching    = s => s.role === 'Teaching' || s.role === 'Teaching + Admin'
const isAdmin       = s => s.role === 'Admin'    || s.role === 'Teaching + Admin'
const isNonTeaching = s => s.role === 'Non-Teaching'
const isActive      = s => s.status === 'Active'
const isHostel      = s => s.department === 'Hostel'

// ─── Public API ───────────────────────────────────────────────────────────────
export const staffDB = {

  // ── Raw access ─────────────────────────────────────────────────────────────

  /** All staff (cached) */
  getAll: (force = false) => _get(force),

  /** Force refresh — call after insert/update/delete */
  refresh: () => _get(true),

  /** Single staff by id */
  async getById(id) {
    const all = await _get()
    return all.find(s => s.id === id) || null
  },

  /** Single staff by name (case-insensitive) */
  async getByName(name) {
    const all = await _get()
    return all.find(s => s.name?.toLowerCase() === name?.toLowerCase()) || null
  },

  // ── Filtered subsets ────────────────────────────────────────────────────────

  /** Active staff only */
  async getActive() {
    return (await _get()).filter(isActive)
  },

  /** Teaching staff (Teaching + Teaching+Admin) */
  async getTeaching() {
    return (await _get()).filter(s => isActive(s) && isTeaching(s))
  },

  /** Non-teaching staff */
  async getNonTeaching() {
    return (await _get()).filter(s => isActive(s) && isNonTeaching(s))
  },

  /** Admin / management staff */
  async getAdmin() {
    return (await _get()).filter(s => isActive(s) && isAdmin(s))
  },

  /** Hostel staff (department = Hostel) */
  async getHostelStaff() {
    return (await _get()).filter(s => isActive(s) && isHostel(s))
  },

  /** Staff by department */
  async getByDepartment(dept) {
    return (await _get()).filter(s => isActive(s) && s.department === dept)
  },

  /** Staff by role */
  async getByRole(role) {
    return (await _get()).filter(s => isActive(s) && s.role === role)
  },

  // ── Module-specific selectors ───────────────────────────────────────────────

  /**
   * Staff.jsx — full list with salary & role info
   * Returns all staff regardless of status (admin needs to see inactive too)
   */
  async forStaffPage() {
    return _get()
  },

  /**
   * Checklist / Task Monitor — active staff with name + designation + role
   * Used to populate "Assign To" dropdowns
   */
  async forChecklist() {
    return (await _get())
      .filter(isActive)
      .map(s => ({
        id:          s.id,
        name:        s.name,
        designation: s.designation,
        department:  s.department,
        role:        s.role,
      }))
  },

  /**
   * Salary module — active staff with full salary breakdown
   */
  async forSalary() {
    return (await _get())
      .filter(isActive)
      .map(s => ({
        id:                  s.id,
        name:                s.name,
        designation:         s.designation,
        department:          s.department,
        role:                s.role,
        basic_salary:        Number(s.basic_salary)        || 0,
        seniority_allowance: Number(s.seniority_allowance) || 0,
        loyalty_bonus:       Number(s.loyalty_bonus)       || 0,
        role_bonus:          Number(s.role_bonus)          || 0,
        gross:               (Number(s.basic_salary) || 0) +
                             (Number(s.seniority_allowance) || 0) +
                             (Number(s.loyalty_bonus) || 0) +
                             (Number(s.role_bonus) || 0),
        salarySet:           Number(s.basic_salary) > 0,
      }))
  },

  /**
   * TimeTable module — teaching staff only, with subject info
   * Timetable slots are assigned to teachers
   */
  async forTimetable() {
    return (await _get())
      .filter(s => isActive(s) && isTeaching(s))
      .map(s => ({
        id:          s.id,
        name:        s.name,
        designation: s.designation,
        department:  s.department,
        role:        s.role,
        phone:       s.phone,
      }))
  },

  /**
   * Teaching module — teaching staff with full profile
   * Used for lesson plans, course assignments, batch linking
   */
  async forTeaching() {
    return (await _get())
      .filter(s => isActive(s) && isTeaching(s))
  },

  /**
   * Attendance module — all active staff
   * Includes joining date for tenure calculation
   */
  async forAttendance() {
    return (await _get())
      .filter(isActive)
      .map(s => ({
        id:           s.id,
        name:         s.name,
        designation:  s.designation,
        department:   s.department,
        role:         s.role,
        joining_date: s.joining_date,
        phone:        s.phone,
      }))
  },

  /**
   * Hostel module — hostel department staff
   * Wardens, house masters/mistresses, supervisors
   */
  async forHostel() {
    return (await _get())
      .filter(s => isActive(s) && isHostel(s))
      .map(s => ({
        id:          s.id,
        name:        s.name,
        designation: s.designation,
        role:        s.role,
        phone:       s.phone,
      }))
  },

  // ── Dropdown helpers ────────────────────────────────────────────────────────

  /** Simple name list for any dropdown */
  async nameList(filterFn = null) {
    const all = await _get()
    const filtered = filterFn ? all.filter(isActive).filter(filterFn) : all.filter(isActive)
    return filtered.map(s => s.name)
  },

  /** { value: id, label: 'Name — Designation' } pairs for select inputs */
  async selectOptions(filterFn = null) {
    const all = await _get()
    const filtered = filterFn ? all.filter(isActive).filter(filterFn) : all.filter(isActive)
    return filtered.map(s => ({ value: s.id, label: `${s.name} — ${s.designation}` }))
  },

  // ── Stats ───────────────────────────────────────────────────────────────────

  /** Summary counts used in dashboard stat cards */
  async stats() {
    const all = await _get()
    const active = all.filter(isActive)
    return {
      total:          all.length,
      active:         active.length,
      inactive:       all.filter(s => !isActive(s)).length,
      teaching:       active.filter(isTeaching).length,
      nonTeaching:    active.filter(isNonTeaching).length,
      admin:          active.filter(isAdmin).length,
      hostel:         active.filter(isHostel).length,
      salarySet:      active.filter(s => Number(s.basic_salary) > 0).length,
      salaryNotSet:   active.filter(s => !(Number(s.basic_salary) > 0)).length,
    }
  },

  // ── CRUD wrappers ───────────────────────────────────────────────────────────
  // All writes go through staffDB so cache is always invalidated after mutations

  async insert(payload) {
    const { data, error } = await supabase
      .from('staff_profiles')
      .insert([{
        ...payload,
        basic_salary:        payload.basic_salary        || 0,
        seniority_allowance: payload.seniority_allowance || 0,
        loyalty_bonus:       payload.loyalty_bonus       || 0,
        role_bonus:          payload.role_bonus           || 0,
      }])
      .select()
    if (error) throw error
    await staffDB.refresh()
    return data?.[0]
  },

  async update(id, payload) {
    const { data, error } = await supabase
      .from('staff_profiles')
      .update({ ...payload, joining_date: payload.joining_date || null })
      .eq('id', id)
      .select()
    if (error) throw error
    await staffDB.refresh()
    return data?.[0]
  },

  async updateSalary(id, { basic_salary, seniority_allowance, loyalty_bonus, role_bonus }) {
    const { data, error } = await supabase
      .from('staff_profiles')
      .update({
        basic_salary:        Number(basic_salary)        || 0,
        seniority_allowance: Number(seniority_allowance) || 0,
        loyalty_bonus:       Number(loyalty_bonus)       || 0,
        role_bonus:          Number(role_bonus)          || 0,
      })
      .eq('id', id)
      .select()
    if (error) throw error
    await staffDB.refresh()
    return data?.[0]
  },

  async delete(id) {
    const { error } = await supabase
      .from('staff_profiles')
      .delete()
      .eq('id', id)
    if (error) throw error
    await staffDB.refresh()
  },

  // ── Attendance helpers ──────────────────────────────────────────────────────

  /** Mark attendance for a date — upserts into staff_attendance table */
  async markAttendance(staffId, date, status, note = '') {
    const { data, error } = await supabase
      .from('staff_attendance')
      .upsert([{ staff_id: staffId, date, status, note }], { onConflict: 'staff_id,date' })
      .select()
    if (error) throw error
    return data?.[0]
  },

  /** Get attendance for all staff for a given month (YYYY-MM) */
  async getMonthAttendance(month) {
    const from = `${month}-01`
    const to   = `${month}-31`
    const { data, error } = await supabase
      .from('staff_attendance')
      .select('*, staff_profiles(name, designation, department, role)')
      .gte('date', from)
      .lte('date', to)
      .order('date')
    if (error) throw error
    return data || []
  },

  /** Get attendance for a single staff member for a month */
  async getStaffMonthAttendance(staffId, month) {
    const from = `${month}-01`
    const to   = `${month}-31`
    const { data, error } = await supabase
      .from('staff_attendance')
      .select('*')
      .eq('staff_id', staffId)
      .gte('date', from)
      .lte('date', to)
      .order('date')
    if (error) throw error
    return data || []
  },

  // ── Timetable helpers ───────────────────────────────────────────────────────

  /** Get all timetable slots with staff info */
  async getTimetable(filters = {}) {
    let query = supabase
      .from('staff_timetable')
      .select('*, staff_profiles(name, designation, role)')
      .order('day_of_week')
      .order('period_no')
    if (filters.staffId)   query = query.eq('staff_id', filters.staffId)
    if (filters.class)     query = query.eq('class_name', filters.class)
    if (filters.day)       query = query.eq('day_of_week', filters.day)
    const { data, error } = await query
    if (error) throw error
    return data || []
  },

  /** Upsert a timetable slot */
  async upsertTimetableSlot(slot) {
    const { data, error } = await supabase
      .from('staff_timetable')
      .upsert([slot], { onConflict: 'class_name,day_of_week,period_no' })
      .select()
    if (error) throw error
    return data?.[0]
  },

  // ── Hostel helpers ──────────────────────────────────────────────────────────

  /** Get hostel duty roster */
  async getHostelDutyRoster(filters = {}) {
    let query = supabase
      .from('hostel_duty_roster')
      .select('*, staff_profiles(name, designation)')
      .order('duty_date', { ascending: false })
    if (filters.staffId) query = query.eq('staff_id', filters.staffId)
    if (filters.from)    query = query.gte('duty_date', filters.from)
    if (filters.to)      query = query.lte('duty_date', filters.to)
    const { data, error } = await query
    if (error) throw error
    return data || []
  },

  /** Upsert hostel duty */
  async upsertHostelDuty(duty) {
    const { data, error } = await supabase
      .from('hostel_duty_roster')
      .upsert([duty], { onConflict: 'staff_id,duty_date' })
      .select()
    if (error) throw error
    return data?.[0]
  },

  // ── Task helpers ────────────────────────────────────────────────────────────

  /** Get all tasks with optional staff filter */
  async getTasks(filters = {}) {
    let query = supabase
      .from('staff_tasks')
      .select('*')
      .order('created_at', { ascending: false })
    if (filters.assignedTo) query = query.eq('assigned_to', filters.assignedTo)
    if (filters.status)     query = query.eq('status', filters.status)
    if (filters.priority)   query = query.eq('priority', filters.priority)
    const { data, error }   = await query
    if (error) throw error
    return data || []
  },

  /** Assign a new task */
  async assignTask(payload) {
    const { data, error } = await supabase
      .from('staff_tasks')
      .insert([{ ...payload, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }])
      .select()
    if (error) throw error
    return data?.[0]
  },

  /** Update task status */
  async updateTaskStatus(taskId, status) {
    const update = { status, updated_at: new Date().toISOString() }
    if (status === 'Done') update.completed_at = new Date().toISOString()
    const { data, error } = await supabase
      .from('staff_tasks')
      .update(update)
      .eq('id', taskId)
      .select()
    if (error) throw error
    return data?.[0]
  },

  // ── Salary helpers ──────────────────────────────────────────────────────────

  /** Get salary disbursement records for a month */
  async getSalaryDisbursements(month) {
    const { data, error } = await supabase
      .from('staff_salary_disbursements')
      .select('*, staff_profiles(name, designation, department, role)')
      .eq('month', month)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  },

  /** Record salary disbursement */
  async recordDisbursement(staffId, month, { grossAmount, deductions = 0, netAmount, paidOn, paidBy, remarks = '' }) {
    const { data, error } = await supabase
      .from('staff_salary_disbursements')
      .upsert([{
        staff_id:     staffId,
        month,
        gross_amount: grossAmount,
        deductions,
        net_amount:   netAmount,
        paid_on:      paidOn,
        paid_by:      paidBy,
        remarks,
      }], { onConflict: 'staff_id,month' })
      .select()
    if (error) throw error
    return data?.[0]
  },

  // ── Monthly scores ──────────────────────────────────────────────────────────

  /** Get monthly performance scores */
  async getMonthlyScores(month) {
    const { data, error } = await supabase
      .from('staff_monthly_scores')
      .select('*')
      .eq('month', month)
    if (error) throw error
    const map = {}
    ;(data || []).forEach(r => { map[r.staff_id] = r })
    return map
  },

  /** Upsert monthly scores for all staff */
  async saveMonthlyScores(rows) {
    const { error } = await supabase
      .from('staff_monthly_scores')
      .upsert(rows, { onConflict: 'staff_id,month' })
    if (error) throw error
  },

  // ── Teaching helpers ────────────────────────────────────────────────────────

  /** Get teaching assignments — which teacher handles which batch/course */
  async getTeachingAssignments(filters = {}) {
    let query = supabase
      .from('staff_teaching_assignments')
      .select('*, staff_profiles(name, designation, role)')
      .order('created_at', { ascending: false })
    if (filters.staffId) query = query.eq('staff_id', filters.staffId)
    if (filters.course)  query = query.eq('course', filters.course)
    if (filters.class)   query = query.eq('class_name', filters.class)
    const { data, error } = await query
    if (error) throw error
    return data || []
  },

  /** Assign teacher to a batch */
  async assignTeaching(payload) {
    const { data, error } = await supabase
      .from('staff_teaching_assignments')
      .insert([{ ...payload, created_at: new Date().toISOString() }])
      .select()
    if (error) throw error
    return data?.[0]
  },
}

// ─── React hook — use in any component ───────────────────────────────────────
// import { useStaffDB } from './staffDB'
//
// function MyComponent() {
//   const { staff, loading, error, refresh } = useStaffDB('forTeaching')
//   ...
// }

import { useState, useEffect, useCallback } from 'react'

export function useStaffDB(selector = 'getAll', deps = []) {
  const [staff,   setStaff]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const fn = staffDB[selector]
      if (typeof fn !== 'function') throw new Error(`staffDB.${selector} is not a function`)
      const data = await fn.call(staffDB)
      setStaff(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [selector, ...deps])

  useEffect(() => { load() }, [load])

  return { staff, loading, error, refresh: load }
}

// ─── Supabase table SQL (run once in SQL editor) ───────────────────────────
//
// -- Role column on staff_profiles (if not already added)
// alter table staff_profiles
//   add column if not exists role text default 'Non-Teaching';
//
// -- Staff attendance
// create table if not exists staff_attendance (
//   id         bigint generated always as identity primary key,
//   staff_id   uuid references staff_profiles(id) on delete cascade,
//   date       date not null,
//   status     text not null default 'Present', -- Present/Absent/Late/Half Day/Leave
//   note       text,
//   created_at timestamptz default now(),
//   unique(staff_id, date)
// );
//
// -- Timetable slots
// create table if not exists staff_timetable (
//   id           bigint generated always as identity primary key,
//   staff_id     uuid references staff_profiles(id) on delete cascade,
//   class_name   text not null,
//   day_of_week  text not null, -- Monday-Saturday
//   period_no    int  not null,
//   subject      text,
//   start_time   time,
//   end_time     time,
//   created_at   timestamptz default now(),
//   unique(class_name, day_of_week, period_no)
// );
//
// -- Hostel duty roster
// create table if not exists hostel_duty_roster (
//   id         bigint generated always as identity primary key,
//   staff_id   uuid references staff_profiles(id) on delete cascade,
//   duty_date  date not null,
//   shift      text default 'Night', -- Morning/Evening/Night
//   remarks    text,
//   created_at timestamptz default now(),
//   unique(staff_id, duty_date)
// );
//
// -- Salary disbursements
// create table if not exists staff_salary_disbursements (
//   id           bigint generated always as identity primary key,
//   staff_id     uuid references staff_profiles(id) on delete cascade,
//   month        text not null, -- YYYY-MM
//   gross_amount numeric default 0,
//   deductions   numeric default 0,
//   net_amount   numeric default 0,
//   paid_on      date,
//   paid_by      text,
//   remarks      text,
//   created_at   timestamptz default now(),
//   unique(staff_id, month)
// );
//
// -- Teaching assignments
// create table if not exists staff_teaching_assignments (
//   id         bigint generated always as identity primary key,
//   staff_id   uuid references staff_profiles(id) on delete cascade,
//   course     text,
//   class_name text,
//   batch_id   text,
//   subject    text,
//   created_at timestamptz default now()
// );
//
// ─────────────────────────────────────────────────────────────────────────────