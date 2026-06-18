// websiteApi.js — GNSI Shared Data Layer
// Single source of truth for all LandingPage <-> WebsiteTab data.
// Table/column names match the real Supabase schema used by WebsiteTab.jsx
// (snake_case with underscores — e.g. website_rankers, created_at, is_featured).
// Import supabase from your existing ./supabase client.

import { supabase } from './supabase';

// ─── SETTINGS (website_settings) ────────────────────────────────────────────
export async function getSettings() {
  const { data, error } = await supabase.from('website_settings').select('key,value');
  if (error || !data) return {};
  return data.reduce((m, r) => {
    m[r.key] = r.value;
    return m;
  }, {});
}

export async function saveSettings(cfg) {
  const upserts = Object.entries(cfg)
    .filter(([, v]) => v !== undefined)
    .map(([key, value]) => ({
      key,
      value,
      updated_at: new Date().toISOString(),
    }));

  return supabase.from('website_settings').upsert(upserts, { onConflict: 'key' });
}

// ─── NOTICES (notices) ───────────────────────────────────────────────────────
export async function getActiveNotices(limit = 3) {
  const { data, error } = await supabase
    .from('notices')
    .select('id,title,body,priority,notice_date,created_at')
    .eq('is_archived', false)
    .order('notice_date', { ascending: false })
    .limit(limit);

  if (error) return [];
  return data || [];
}

export async function getAllNotices(limit = 40) {
  const { data, error } = await supabase
    .from('notices')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return [];
  return data || [];
}

export async function saveNotice(form, editingId = null) {
  const payload = {
    title: form.title,
    body: form.body,
    priority: form.priority || 'Medium',
    notice_date: form.notice_date,
    is_archived: false,
  };

  if (editingId) {
    return supabase.from('notices').update(payload).eq('id', editingId);
  }

  return supabase.from('notices').insert(payload);
}

export async function archiveNotice(id, current) {
  return supabase.from('notices').update({ is_archived: !current }).eq('id', id);
}

export async function deleteNotice(id) {
  return supabase.from('notices').delete().eq('id', id);
}

// ─── ENQUIRIES (enquiries) ───────────────────────────────────────────────────
export async function submitEnquiry(form) {
  // form: { student_name, parent_name, phone, class_grade, course, message }
  return supabase.from('enquiries').insert({
    student_name: form.student_name,
    parent_name: form.parent_name || '',
    phone: form.phone,
    class_grade: form.class_grade || '',
    course: form.course || '',
    message: form.message || '',
    replied: false,
    created_at: new Date().toISOString(),
  });
}

export async function submitScholarRegistration(form) {
  // Reuses enquiries table; prefix course with 'SCHOLAR:'
  return supabase.from('enquiries').insert({
    student_name: form.student_name,
    parent_name: form.parent_name || '',
    phone: form.phone,
    class_grade: form.class_age || '',
    course: 'SCHOLAR: ' + (form.type || 'Free Demo'),
    message: 'Scholarship/Demo registration from website.',
    replied: false,
    created_at: new Date().toISOString(),
  });
}

export async function submitGrievance(form) {
  const ticketId = 'GNSI-GRV-' + Date.now().toString().slice(-6);

  return supabase.from('enquiries').insert({
    student_name: form.student_name || 'Anonymous',
    parent_name: form.parent_name || '',
    phone: form.phone || '',
    class_grade: '',
    course: 'GRIEVANCE: ' + ticketId,
    message: form.message,
    replied: false,
    created_at: new Date().toISOString(),
  });
}

export async function getAllEnquiries() {
  const { data, error } = await supabase
    .from('enquiries')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return [];
  return data || [];
}

export async function markEnquiryReplied(id) {
  return supabase
    .from('enquiries')
    .update({
      replied: true,
      replied_at: new Date().toISOString(),
    })
    .eq('id', id);
}

export async function deleteEnquiry(id) {
  return supabase.from('enquiries').delete().eq('id', id);
}

// ─── RANKERS (website_rankers) ───────────────────────────────────────────────
export async function getRankers() {
  const { data, error } = await supabase
    .from('website_rankers')
    .select('*')
    .order('sort_order')
    .order('id');

  if (error) return [];
  return data || [];
}

export async function saveRanker(form, editingId = null) {
  if (editingId) {
    return supabase.from('website_rankers').update(form).eq('id', editingId);
  }

  return supabase.from('website_rankers').insert(form);
}

export async function deleteRanker(id) {
  return supabase.from('website_rankers').delete().eq('id', id);
}

// ─── GALLERY (website_gallery) ────────────────────────────────────────────────
export async function getGallery() {
  const { data, error } = await supabase
    .from('website_gallery')
    .select('*')
    .order('sort_order')
    .order('created_at');

  if (error) return [];
  return data || [];
}

export async function addGalleryImage(form) {
  return supabase.from('website_gallery').insert({
    ...form,
    created_at: new Date().toISOString(),
  });
}

export async function updateGalleryCaption(id, caption) {
  return supabase.from('website_gallery').update({ caption }).eq('id', id);
}

export async function deleteGalleryImage(id) {
  return supabase.from('website_gallery').delete().eq('id', id);
}

// ─── VIDEOS (website_videos) ───────────────────────────────────────────────────
export function getYouTubeThumb(url) {
  const m = url?.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?\s]+)/
  );
  return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null;
}

export function getYouTubeEmbed(url) {
  const m = url?.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?\s]+)/
  );
  return m ? `https://www.youtube.com/embed/${m[1]}` : url;
}

export async function getVideos() {
  const { data, error } = await supabase
    .from('website_videos')
    .select('*')
    .order('sort_order')
    .order('created_at', { ascending: false });

  if (error) return [];
  return data || [];
}

export async function saveVideo(form, editingId = null) {
  const payload = {
    ...form,
    youtube_url: form.youtube_url ? getYouTubeEmbed(form.youtube_url) : form.youtube_url,
  };

  if (editingId) {
    return supabase.from('website_videos').update(payload).eq('id', editingId);
  }

  return supabase.from('website_videos').insert(payload);
}

export async function deleteVideo(id) {
  return supabase.from('website_videos').delete().eq('id', id);
}

// ─── BLOG (website_blog) ────────────────────────────────────────────────────
export async function getPublishedPosts(limit = 6) {
  const { data, error } = await supabase
    .from('website_blog')
    .select('id,title,body,category,image_url,published_date')
    .eq('is_published', true)
    .order('published_date', { ascending: false })
    .limit(limit);

  if (error) return [];
  return data || [];
}

export async function getAllPosts(limit = 20) {
  const { data, error } = await supabase
    .from('website_blog')
    .select('*')
    .order('published_date', { ascending: false })
    .limit(limit);

  if (error) return [];
  return data || [];
}

export async function savePost(form, editingId = null) {
  if (editingId) {
    return supabase.from('website_blog').update(form).eq('id', editingId);
  }

  return supabase.from('website_blog').insert(form);
}

export async function togglePostPublished(id, current) {
  return supabase.from('website_blog').update({ is_published: !current }).eq('id', id);
}

export async function deletePost(id) {
  return supabase.from('website_blog').delete().eq('id', id);
}

// ─── REVIEWS (website_reviews) ─────────────────────────────────────────────
export async function getFeaturedReviews(limit = 6) {
  const { data, error } = await supabase
    .from('website_reviews')
    .select('id,reviewer_name,review_text,rating,review_date')
    .eq('is_featured', true)
    .order('review_date', { ascending: false })
    .limit(limit);

  if (error) return [];
  return data || [];
}

export async function getAllReviews() {
  const { data, error } = await supabase
    .from('website_reviews')
    .select('*')
    .order('is_featured', { ascending: false })
    .order('review_date', { ascending: false });

  if (error) return [];
  return data || [];
}

export async function saveReview(form, editingId = null) {
  if (editingId) {
    return supabase.from('website_reviews').update(form).eq('id', editingId);
  }

  return supabase.from('website_reviews').insert(form);
}

export async function toggleReviewFeatured(id, current) {
  return supabase.from('website_reviews').update({ is_featured: !current }).eq('id', id);
}

export async function deleteReview(id) {
  return supabase.from('website_reviews').delete().eq('id', id);
}

// ─── QUESTION PAPERS (website_papers) ───────────────────────────────────────
export async function getPapers() {
  const { data, error } = await supabase
    .from('website_papers')
    .select('*')
    .order('exam_type')
    .order('year', { ascending: false });

  if (error) return [];
  return data || [];
}

export async function savePaper(form, editingId = null) {
  if (editingId) {
    return supabase.from('website_papers').update(form).eq('id', editingId);
  }

  return supabase.from('website_papers').insert(form);
}

export async function deletePaper(id) {
  return supabase.from('website_papers').delete().eq('id', id);
}

// ─── RESULT BANNERS (website_result_banners) ───────────────────────────────
export async function getActiveBanners() {
  const { data, error } = await supabase
    .from('website_result_banners')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
    .order('created_at', { ascending: false });

  if (error) return [];
  return data || [];
}

export async function getAllBanners() {
  const { data, error } = await supabase
    .from('website_result_banners')
    .select('*')
    .order('sort_order')
    .order('created_at', { ascending: false });

  if (error) return [];
  return data || [];
}

export async function saveBanner(form, editingId = null) {
  if (editingId) {
    return supabase.from('website_result_banners').update(form).eq('id', editingId);
  }

  return supabase.from('website_result_banners').insert(form);
}

export async function toggleBannerActive(id, current) {
  return supabase.from('website_result_banners').update({ is_active: !current }).eq('id', id);
}

export async function deleteBanner(id) {
  return supabase.from('website_result_banners').delete().eq('id', id);
}

// ─── FACULTY (website_faculty) ───────────────────────────────────────────────
export async function getFaculty() {
  const { data, error } = await supabase
    .from('website_faculty')
    .select('*')
    .order('sort_order')
    .order('name');

  if (error) return [];
  return data || [];
}

export async function saveFaculty(form, editingId = null) {
  if (editingId) {
    return supabase.from('website_faculty').update(form).eq('id', editingId);
  }

  return supabase.from('website_faculty').insert(form);
}

export async function deleteFaculty(id) {
  return supabase.from('website_faculty').delete().eq('id', id);
}

// ─── EVENTS (website_events) ─────────────────────────────────────────────────
// Public landing page only ever needs active, upcoming events (soonest first).
export async function getEvents(limit) {
  const today = new Date().toISOString().slice(0, 10);
  let query = supabase
    .from('website_events')
    .select('*')
    .eq('is_active', true)
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .order('sort_order', { ascending: true });

  if (limit) query = query.limit(limit);

  const { data, error } = await query;
  if (error) return [];
  return data || [];
}

// Admin view shows everything — past, hidden, future — for management.
export async function getAllEvents() {
  const { data, error } = await supabase
    .from('website_events')
    .select('*')
    .order('event_date', { ascending: true })
    .order('sort_order', { ascending: true });

  if (error) return [];
  return data || [];
}

export async function saveEvent(form, editingId = null) {
  if (editingId) {
    return supabase.from('website_events').update(form).eq('id', editingId);
  }

  return supabase.from('website_events').insert(form);
}

export async function toggleEventActive(id, current) {
  return supabase.from('website_events').update({ is_active: !current }).eq('id', id);
}

export async function deleteEvent(id) {
  return supabase.from('website_events').delete().eq('id', id);
}

// ─── LIVE KPI (Dashboard Panel on Landing Page) ────────────────────────────
export async function getLiveKPIs() {
  const today = new Date().toISOString().slice(0, 10);

  const [staffRes, attRes, examsRes, enqRes, noticeRes] = await Promise.all([
    supabase.from('staff').select('id', { count: 'exact', head: true }),
    supabase
      .from('attendance')
      .select('id', { count: 'exact', head: true })
      .eq('date', today)
      .eq('status', 'Present'),
    supabase
      .from('exams')
      .select('id', { count: 'exact', head: true })
      .gte('exam_date', today),
    supabase
      .from('enquiries')
      .select('id', { count: 'exact', head: true })
      .eq('replied', false),
    supabase
      .from('notices')
      .select('title')
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
      .limit(1),
  ]);

  return {
    staff: staffRes.count ?? '—',
    present: attRes.count ?? '—',
    exams: examsRes.count ?? '—',
    enquiries: enqRes.count ?? '—',
    latestNotice: noticeRes.data?.[0]?.title ?? 'No active notices',
  };
}