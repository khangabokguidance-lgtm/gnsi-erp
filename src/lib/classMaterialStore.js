// Persistence for Class Material: table class_materials + private bucket class-materials
// (supabase/migrations/20261056_class_materials.sql).
import { supabase } from '../supabase';
import { storagePath } from './classMaterialLogic.js';

export const BUCKET = 'class-materials';
const missing = (e) => !!e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist|schema cache|Could not find the table/i.test(e.message || ''));

// → { rows, setup: true when the table is not created yet }
export async function loadMaterials() {
  const { data, error } = await supabase.from('class_materials').select('*').order('created_at', { ascending: false });
  if (error) { if (missing(error)) return { rows: [], setup: true }; throw error; }
  return { rows: data, setup: false };
}

export async function uploadMaterial(row, file) {
  const path = storagePath(row.course, row.subject, file.name);
  const up = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (up.error) throw up.error;
  const { data, error } = await supabase.from('class_materials').insert({ ...row, file_path: path }).select().single();
  if (error) { await supabase.storage.from(BUCKET).remove([path]); throw error; }
  return data;
}
export async function setActive(id, active) {
  const { error } = await supabase.from('class_materials').update({ active }).eq('id', id);
  if (error) throw error;
}
export async function removeMaterial(row) {
  const { error } = await supabase.from('class_materials').delete().eq('id', row.id);
  if (error) throw error;
  await supabase.storage.from(BUCKET).remove([row.file_path]);
}
// The file's bytes for the on-screen viewer (an authenticated request — no shareable link is created).
export async function fetchFile(row) {
  const { data, error } = await supabase.storage.from(BUCKET).download(row.file_path);
  if (error) throw error;
  return data;
}
