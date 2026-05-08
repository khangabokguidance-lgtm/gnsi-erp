// src/modules/Admissions/admissionsData.js
// Data helpers for Admissions module — Supabase-backed with localStorage fallback
import { supabase } from '../../core/supabase'

export const ADM_STATUSES = ['Applied', 'Under Review', 'Admitted', 'Enrolled', 'Rejected', 'Waitlisted']
export const STAT_COLORS = {
  Applied: '#3b78c9',
  'Under Review': '#f59e0b',
  Admitted: '#8b5cf6',
  Enrolled: '#16a34a',
  Rejected: '#dc2626',
  Waitlisted: '#94a3b8',
}
export const ADM_DOCS = [
  'Birth Certificate', 'Aadhaar Card', 'Passport Photo', 'Mark Sheet',
  'Transfer Certificate', 'Medical Certificate', 'Caste Certificate', 'Address Proof',
]
export const CLASSES = ['Achiever', 'Leader', 'Champion', 'Lakshya', 'Umeed', 'Elite', 'Prime']
export const SESSIONS = ['2024-25', '2025-26', '2026-27']
export const CATEGORIES = ['--', 'General', 'OBC', 'SC', 'ST', 'EWS', 'Other']
export const ADM_FEE_DEFAULT = 6000
export const PROSPECTUS_AMT = 200
export const DRESS_ITEMS_DEFAULT = [
  { id: 'dk1', name: 'Aqua T-Shirt', price: 450, qty: 1 },
  { id: 'dk2', name: 'Blue T-Shirt', price: 450, qty: 1 },
  { id: 'dk3', name: 'Track Suit', price: 900, qty: 1 },
  { id: 'dk4', name: 'Track Pant', price: 600, qty: 1 },
  { id: 'dk5', name: 'Track Suit set 2', price: 600, qty: 1 },
]

const LS_KEY = 'gnsiadmapps'
const LS_COLS = 'gnsifeecols'

// ── LocalStorage helpers ──────────────────────────────────────────────────────
export function loadAppsLocal() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] }
}
export function saveAppsLocal(apps) {
  localStorage.setItem(LS_KEY, JSON.stringify(apps))
  localStorage.setItem('gnsikvts' + LS_KEY, new Date().toISOString())
}
export function loadColsLocal() {
  try { return JSON.parse(localStorage.getItem(LS_COLS) || '[]') } catch { return [] }
}
export function saveColsLocal(cols) {
  localStorage.setItem(LS_COLS, JSON.stringify(cols))
}

// ── Supabase helpers ──────────────────────────────────────────────────────────
export async function fetchAppsFromSupabase() {
  const { data, error } = await supabase
    .from('adm_applications')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) { console.error('[Admissions] fetch error:', error); return null }
  return data
}

export async function upsertAppToSupabase(app) {
  const { error } = await supabase
    .from('adm_applications')
    .upsert(app, { onConflict: 'id' })
  if (error) console.error('[Admissions] upsert error:', error)
  return !error
}

export async function deleteAppFromSupabase(id) {
  const { error } = await supabase
    .from('adm_applications')
    .delete()
    .eq('id', id)
  if (error) console.error('[Admissions] delete error:', error)
  return !error
}

export async function fetchColsFromSupabase() {
  const { data, error } = await supabase
    .from('adm_fee_collections')
    .select('*')
  if (error) { console.error('[Admissions] cols fetch error:', error); return null }
  return data
}

export async function upsertColToSupabase(col) {
  const { error } = await supabase
    .from('adm_fee_collections')
    .upsert(col, { onConflict: 'id' })
  if (error) console.error('[Admissions] col upsert error:', error)
  return !error
}

// ── Utility helpers ───────────────────────────────────────────────────────────
export function nextId(list) {
  return list.length ? Math.max(...list.map(a => Number(a.id) || 0)) + 1 : 1
}

export function genAdmNo(apps) {
  const yr = new Date().getFullYear()
  let maxSeq = 0
  apps.forEach(a => {
    const m = (a.admNo || a.adm_no || '').match(/GNSI-\d{4}-(\d+)/)
    if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10))
  })
  return `GNSI-${yr}-${String(maxSeq + 1).padStart(3, '0')}`
}

export function checkFeePaid(appId, cols = []) {
  return cols.some(
    c => c.feeType === 'admission' && String(c.admAppId) === String(appId)
  )
}

export function maskPhone(phone) {
  return String(phone || '').replace(/\d(?=\d{4})/g, '*')
}

// ── Role helpers ──────────────────────────────────────────────────────────────
export function canDeleteAdm(user) {
  return user && ['admin', 'manager'].includes(user.role)
}
export function canCollectFee(user) {
  return user && ['admin', 'manager', 'accounts'].includes(user.role)
}
