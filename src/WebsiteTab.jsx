// ============================================================
//  WebsiteTab.jsx — GNSI Website Manager v2
//  Manages ALL landing page v5 sections:
//  ① Enquiries Inbox (with grievance tickets)
//  ② Public Notices
//  ③ Gallery
//  ④ Faculty Cards
//  ⑤ Ranker Wall (website_rankers)
//  ⑥ Google Reviews (website_reviews)
//  ⑦ Blog / News Posts (website_blog)
//  ⑧ Videos (website_videos)
//  ⑨ Result Banners (website_result_banners)
//  ⑩ Question Papers (website_papers)
//  ⑪ Scholarship Test Dates (website_settings)
//  ⑫ Site Settings (deadline, brochure, UPI, social, stats, results cards)
//  ⑬ Events & Schedule (website_events)
//  ⑭ Testimonials (website_testimonials)
//  ⑮ Exam Calendar (website_exam_calendar)
//  ⑯ Important Dates Timeline (website_timeline)
// ============================================================

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getAllEnquiries, markEnquiryReplied, deleteEnquiry,
  getAllNotices, saveNotice, archiveNotice, deleteNotice,
  getAllEvents, saveEvent, deleteEvent, toggleEventActive,
  getRankers, saveRanker, deleteRanker,
  rankerSession, sessionOptions, groupRankersBySession, EARLIER_SESSION,
  getGallery, addGalleryImage, updateGalleryCaption, deleteGalleryImage,
  getVideos, saveVideo, deleteVideo, getYouTubeThumb, getYouTubeEmbed,
  getAllPosts, savePost, togglePostPublished, deletePost,
  getAllReviews, saveReview, toggleReviewFeatured, deleteReview,
  getPapers, savePaper, deletePaper,
  getAllBanners, saveBanner, toggleBannerActive, deleteBanner,
  getFaculty, saveFaculty, deleteFaculty,
  getSettings, saveSettings,
  getAllTestimonials, saveTestimonial, toggleTestimonialFeatured, deleteTestimonial,
  getExamCalendar, saveExamCalendarRow, deleteExamCalendarRow,
  getTimeline, saveTimelineItem, deleteTimelineItem,
  uploadWebsiteImage, uploadWebsiteFile,
  getFacilities, saveFacility, deleteFacility,
  getMockTests, saveMockTest, deleteMockTest,
  getFaqs, saveFaq, deleteFaq,
} from './websiteApi';

// ── colours ─────────────────────────────────────────────────
const C = {
  navy:"#1e3a5f", navy2:"#f8fafc", navy3:"#e2e8f0",
  gold:"#1e3a5f", goldL:"#2c5282", goldLL:"#1e3a5f",
  cream:"#1e293b", slate:"#64748b", mist:"#94a3b8",
  red:"#dc2626", green:"#16a34a",
};
// Category accent palette, matching Accounts.jsx's card-border convention
const CHART_COLORS = ['#1e3a5f','#16a34a','#dc2626','#f59e0b','#7c3aed','#0891b2','#be185d','#047857'];

// ── sub-tabs ────────────────────────────────────────────────
const SUB_TABS = [
  { id:"enquiries",  icon:"📬", label:"Enquiries" },
  { id:"notices",    icon:"📣", label:"Notices" },
  { id:"events",     icon:"📅", label:"Events" },
  { id:"rankers",    icon:"🏆", label:"Ranker Wall" },
  { id:"gallery",    icon:"🖼️",  label:"Gallery" },
  { id:"videos",     icon:"▶️",  label:"Videos" },
  { id:"blog",       icon:"📰", label:"Blog/News" },
  { id:"reviews",    icon:"⭐", label:"Reviews" },
  { id:"papers",     icon:"📄", label:"Papers" },
  { id:"banners",    icon:"🎉", label:"Result Banners" },
  { id:"faculty",    icon:"👨‍🏫", label:"Faculty" },
  { id:"facilities", icon:"🏫", label:"Facilities" },
  { id:"mocktests",  icon:"📝", label:"Mock Tests" },
  { id:"faq",        icon:"❓", label:"FAQs" },
  { id:"testimonials", icon:"💬", label:"Testimonials" },
  { id:"examcal",    icon:"🗓️",  label:"Exam Calendar" },
  { id:"timeline",   icon:"📌", label:"Timeline" },
  { id:"settings",   icon:"⚙️",  label:"Settings" },
];

// ── helpers ─────────────────────────────────────────────────
const fmt = d => d ? new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}) : "—";
const toast = (msg, type="success") => {
  const el = document.createElement("div");
  el.textContent = msg;
  el.style.cssText = `position:fixed;bottom:1.5rem;right:1.5rem;z-index:9999;padding:.75rem 1.4rem;font-family:inherit;font-weight:600;font-size:.85rem;letter-spacing:0;border-radius:8px;border-left:4px solid ${type==="success"?"#16a34a":"#dc2626"};background:#ffffff;color:${type==="success"?"#166534":"#991b1b"};box-shadow:0 4px 16px rgba(0,0,0,.08);transition:.3s`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
};

// ── shared styles ────────────────────────────────────────────
const s = {
  wrap:    { padding:"1.5rem", fontFamily:"inherit", background:"#f8fafc", minHeight:"100vh", color:"#1e293b" },
  subNav:  { display:"flex", gap:"8px", marginBottom:"20px", flexWrap:"wrap" },
  subBtn:  a => ({ background:a?"#1e3a5f":"#ffffff", color:a?"#ffffff":"#1e3a5f", border:`1px solid ${a?"#1e3a5f":"#e2e8f0"}`, borderRadius:"8px", padding:"8px 16px", fontFamily:"inherit", fontWeight:600, fontSize:".85rem", letterSpacing:"0", textTransform:"none", cursor:"pointer", transition:".2s", display:"flex", alignItems:"center", gap:".4rem", boxShadow:a?"0 2px 6px rgba(30,58,95,.25)":"0 1px 3px rgba(0,0,0,.08)" }),
  card:    { background:"#ffffff", border:"1px solid #e2e8f0", borderRadius:"12px", boxShadow:"0 2px 8px rgba(0,0,0,.08)", marginBottom:"1rem" },
  cardHd:  { padding:"14px 18px", borderBottom:"1px solid #f1f5f9", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:".5rem" },
  cardTit: { fontFamily:"inherit", fontWeight:700, fontSize:".95rem", letterSpacing:"0", textTransform:"none", color:"#1e3a5f" },
  cardBdy: { padding:"18px" },
  row:     { display:"flex", justifyContent:"space-between", alignItems:"center", padding:".6rem 0", borderBottom:"1px solid #f1f5f9", fontSize:".85rem" },
  lbl:     { display:"block", fontFamily:"inherit", fontWeight:600, fontSize:".78rem", letterSpacing:"0", textTransform:"none", color:"#475569", marginBottom:".35rem" },
  inp:     { width:"100%", padding:"10px 14px", background:"#ffffff", border:"1px solid #cbd5e1", borderRadius:"8px", color:"#1e293b", fontSize:".9rem", fontFamily:"inherit", outline:"none", marginBottom:"1rem", transition:".2s", boxSizing:"border-box" },
  ta:      { width:"100%", padding:"10px 14px", background:"#ffffff", border:"1px solid #cbd5e1", borderRadius:"8px", color:"#1e293b", fontSize:".9rem", fontFamily:"inherit", outline:"none", marginBottom:"1rem", resize:"vertical", minHeight:"80px", boxSizing:"border-box" },
  sel:     { width:"100%", padding:"10px 14px", background:"#ffffff", border:"1px solid #cbd5e1", borderRadius:"8px", color:"#1e293b", fontSize:".9rem", fontFamily:"inherit", outline:"none", marginBottom:"1rem", boxSizing:"border-box" },
  btnG:    { background:"#1e3a5f", color:"#ffffff", border:"none", borderRadius:"8px", padding:"10px 20px", fontFamily:"inherit", fontWeight:600, fontSize:".85rem", letterSpacing:"0", textTransform:"none", cursor:"pointer", transition:".2s" },
  btnR:    { background:"#fee2e2", color:"#dc2626", border:"1px solid #fecaca", borderRadius:"8px", padding:"7px 14px", fontFamily:"inherit", fontWeight:600, fontSize:".8rem", letterSpacing:"0", textTransform:"none", cursor:"pointer" },
  btnGrn:  { background:"#dcfce7", color:"#16a34a", border:"1px solid #bbf7d0", borderRadius:"8px", padding:"7px 14px", fontFamily:"inherit", fontWeight:600, fontSize:".8rem", letterSpacing:"0", textTransform:"none", cursor:"pointer" },
  btnN:    { background:"#f1f5f9", color:"#1e3a5f", border:"1px solid #e2e8f0", borderRadius:"8px", padding:"7px 14px", fontFamily:"inherit", fontWeight:600, fontSize:".8rem", letterSpacing:"0", textTransform:"none", cursor:"pointer" },
  g2:      { display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1rem" },
  g3:      { display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:".8rem" },
  stat:    { background:"#f8fafc", borderRadius:"10px", padding:"1rem", textAlign:"center" },
  statN:   { display:"block", fontFamily:"inherit", fontSize:"1.8rem", fontWeight:700, color:"#1e3a5f", lineHeight:1, marginBottom:".2rem" },
  statL:   { fontSize:".72rem", fontFamily:"inherit", letterSpacing:"0", textTransform:"none", color:"#64748b" },
  badge:   c => ({ display:"inline-block", padding:".22rem .6rem", fontFamily:"inherit", fontWeight:600, fontSize:".68rem", letterSpacing:"0", textTransform:"none", borderRadius:"6px", background:c==="High"?"#fee2e2":c==="Low"?"#f1f5f9":"#fef3c7", color:c==="High"?"#dc2626":c==="Low"?"#64748b":"#b45309", border:`1px solid ${c==="High"?"#fecaca":c==="Low"?"#e2e8f0":"#fde68a"}` }),
  loading: { display:"flex", alignItems:"center", justifyContent:"center", padding:"3rem", gap:".6rem", color:"#94a3b8", fontFamily:"inherit", letterSpacing:"0", textTransform:"none", fontSize:".85rem" },
  empty:   { textAlign:"center", padding:"2.5rem", color:"#94a3b8", fontFamily:"inherit", letterSpacing:"0", textTransform:"none", fontSize:".85rem" },
};

// Spin component
const Spin = () => <div style={{width:"16px",height:"16px",border:"2px solid #e2e8f0",borderTopColor:"#1e3a5f",borderRadius:"50%",animation:"spin .8s linear infinite",flexShrink:0}} />;

// Resizes/re-encodes an image File in the browser before upload, via
// Canvas — no extra dependency needed. Downscales so the longer edge is
// at most maxDim (1920px covers anything the site actually displays —
// gallery/banner images render nowhere near full camera resolution) and
// re-encodes as JPEG at the given quality. Phone camera photos are
// routinely 10–20MB at ~4000px+ on the long edge; this typically gets
// them under 1–2MB with no visible quality loss at web display sizes.
// Falls back to the original file untouched if anything goes wrong
// (unsupported format, canvas/security error, etc.) rather than blocking
// the upload — compression is a nice-to-have, not a requirement.
async function compressImage(file, { maxDim = 1920, quality = 0.85 } = {}) {
  // Skip already-tiny files and formats Canvas can't safely re-encode
  // (SVG has no pixel raster; GIF would lose animation).
  if (file.size <= 1.5 * 1024 * 1024) return file;
  if (/svg|gif/i.test(file.type)) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) return file;

    // Only use the compressed version if it's actually smaller — a
    // already-efficient small JPEG can occasionally re-encode larger.
    if (blob.size >= file.size) return file;

    const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], newName, { type: 'image/jpeg', lastModified: Date.now() });
  } catch (e) {
    console.error('compressImage failed, using original file:', e);
    return file;
  }
}

// ── ImageUploadField ───────────────────────────────────────────
// Drop-in replacement for the old "paste a Supabase URL" text input.
// Lets staff pick a photo straight from their device — compresses it
// client-side (see compressImage above) so a 15MB phone photo doesn't
// need to be shrunk by hand first, uploads it to the gnsi-public bucket
// under `folder` via uploadWebsiteImage(), and calls onChange(url) with
// the resulting public URL once done, same as if they'd typed/pasted
// that URL themselves. label/folder/value/onChange are the only required
// props; the rest (preview size/shape) has sane defaults.
//
// allowMultiple (optional): when true, the file picker accepts multiple
// files at once. Every picked file is compressed + uploaded, but this
// field still only holds ONE url (the record has a single photo column),
// so after a multi-pick the staff member sees thumbnails of everything
// that uploaded and taps the one they want as the record's photo — the
// rest are already safely in storage if needed again later.
function ImageUploadField({ label, folder, value, onChange, round=false, previewSize=80, allowMultiple=false }) {
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("Uploading…");
  const [err, setErr] = useState("");
  const [choices, setChoices] = useState([]); // urls from a multi-pick, awaiting selection
  const inputRef = useRef(null);

  const pick = () => inputRef.current?.click();

  const uploadOne = async (file) => {
    if (!file.type?.startsWith("image/")) return { url: null, error: new Error("Not an image file") };
    if (file.size > 30 * 1024 * 1024) return { url: null, error: new Error("Larger than 30MB") };
    setBusyLabel(file.size > 1.5 * 1024 * 1024 ? "Compressing…" : "Uploading…");
    const toUpload = await compressImage(file);
    setBusyLabel("Uploading…");
    return uploadWebsiteImage(toUpload, folder);
  };

  const handleFile = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ""; // allow re-picking the same file(s) later
    if (!files.length) return;
    setErr("");
    setBusy(true);

    if (files.length === 1) {
      const { url, error } = await uploadOne(files[0]);
      setBusy(false);
      if (error || !url) {
        setErr("Upload failed: " + (error?.message || "unknown error"));
        toast("Image upload failed", "error");
        return;
      }
      onChange(url);
      toast("Photo uploaded ✓");
      return;
    }

    // Multiple files picked: upload all, then let the user choose one.
    const uploaded = [];
    let failCount = 0;
    for (const file of files) {
      const { url, error } = await uploadOne(file);
      if (url) uploaded.push(url); else failCount++;
    }
    setBusy(false);
    if (uploaded.length) {
      setChoices(uploaded);
      toast(`${uploaded.length} photo${uploaded.length>1?"s":""} uploaded ✓ — pick one below`);
    }
    if (failCount) setErr(`${failCount} file${failCount>1?"s":""} failed to upload.`);
  };

  const choose = (url) => { onChange(url); setChoices([]); toast("Photo selected ✓"); };

  return (
    <div style={{ marginBottom: "1rem" }}>
      {label && <label style={s.lbl}>{label}</label>}
      <input ref={inputRef} type="file" accept="image/*" multiple={allowMultiple} onChange={handleFile} style={{ display: "none" }} />
      <div style={{ display: "flex", gap: ".9rem", alignItems: "center", flexWrap: "wrap" }}>
        {value ? (
          <img
            src={value}
            alt="preview"
            style={{
              width: `${previewSize}px`, height: `${previewSize}px`, objectFit: "cover",
              borderRadius: round ? "50%" : "4px", border: `2px solid ${C.gold}`, flexShrink: 0,
            }}
            onError={(e) => { e.target.style.display = "none"; }}
          />
        ) : (
          <div style={{
            width: `${previewSize}px`, height: `${previewSize}px`, borderRadius: round ? "50%" : "4px",
            background: "#ffffff", border: "1px dashed rgba(148,163,184,.35)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem",
            color: "rgba(71,85,105,.25)", flexShrink: 0,
          }}>🖼️</div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: ".4rem" }}>
          <div style={{ display: "flex", gap: ".5rem" }}>
            <button type="button" style={{ ...s.btnG, opacity: busy ? .6 : 1 }} onClick={pick} disabled={busy}>
              {busy ? <span style={{display:"flex",alignItems:"center",gap:".4rem"}}><Spin/>{busyLabel}</span> : (value ? "Replace Photo" : (allowMultiple ? "Upload Photo(s)" : "Upload Photo"))}
            </button>
            {value && !busy && <button type="button" style={s.btnR} onClick={() => onChange("")}>Remove</button>}
          </div>
          {err && <span style={{ color: "#dc2626", fontSize: ".72rem", fontFamily:"inherit" }}>{err}</span>}
        </div>
      </div>
      {choices.length > 0 && (
        <div style={{ marginTop: ".7rem" }}>
          <div style={{ fontSize: ".72rem", color: "#64748b", marginBottom: ".4rem" }}>Choose which photo to use:</div>
          <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
            {choices.map((url, i) => (
              <img
                key={url+i}
                src={url}
                alt={`option ${i+1}`}
                onClick={() => choose(url)}
                style={{
                  width: "64px", height: "64px", objectFit: "cover", cursor: "pointer",
                  borderRadius: round ? "50%" : "4px", border: `2px solid ${url===value?C.gold:"#e2e8f0"}`,
                  flexShrink: 0, transition: ".15s",
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  ① ENQUIRIES INBOX
// ════════════════════════════════════════════════════════════
function EnquiriesSection() {
  const [rows,setRows]=useState([]);
  const [load,setLoad]=useState(true);
  const [open,setOpen]=useState(null);
  const [search,setSrch]=useState("");
  const [filter,setFilter]=useState("all");
  const [stats,setStats]=useState({total:0,today:0,week:0,unread:0,grievances:0});

  const load_=useCallback(async()=>{
    setLoad(true);
    const data=await getAllEnquiries();
    if(data){
      setRows(data);
      const now=new Date(),today=now.toISOString().slice(0,10),week=new Date(now-7*86400000).toISOString();
      setStats({
        total:data.length,
        today:data.filter(r=>r.created_at?.slice(0,10)===today).length,
        week:data.filter(r=>r.created_at>week).length,
        unread:data.filter(r=>!r.replied).length,
        grievances:data.filter(r=>r.course?.startsWith("GRIEVANCE")).length,
      });
    }
    setLoad(false);
  },[]);

  useEffect(()=>{load_();},[load_]);

  const markReplied=async id=>{
    await markEnquiryReplied(id);
    toast("Marked as replied ✓");load_();setOpen(null);
  };
  const del=async id=>{
    if(!confirm("Delete this enquiry?"))return;
    await deleteEnquiry(id);
    toast("Deleted");load_();setOpen(null);
  };
  const exportCSV=()=>{
    const h=["Date","Student","Parent","Phone","Course","Message","Replied"];
    const rows2=filtered.map(r=>[fmt(r.created_at),r.student_name||"",r.parent_name||"",r.phone||"",r.course||"",r.message||"",r.replied?"Yes":"No"]);
    const csv=[h,...rows2].map(r=>r.map(v=>`"${v}"`).join(",")).join("\n");
    const a=document.createElement("a");a.href="data:text/csv;charset=utf-8,"+encodeURIComponent(csv);a.download="gnsi-enquiries.csv";a.click();
  };

  const filtered=rows.filter(r=>{
    const matchSearch=!search||[r.student_name,r.parent_name,r.phone,r.course,r.message].join(" ").toLowerCase().includes(search.toLowerCase());
    const matchFilter=filter==="all"||(filter==="unread"&&!r.replied)||(filter==="grievance"&&r.course?.startsWith("GRIEVANCE"))||(filter==="admission"&&!r.course?.startsWith("GRIEVANCE"));
    return matchSearch&&matchFilter;
  });

  return (
    <div>
      <div style={{...s.g3,gridTemplateColumns:"repeat(5,1fr)",marginBottom:"1.2rem"}}>
        {[["Total",stats.total,C.goldLL],["Today",stats.today,"#16a34a"],["This Week",stats.week,C.goldL],["Unread",stats.unread,"#dc2626"],["Grievances",stats.grievances,"#ea580c"]].map(([l,v,c])=>(
          <div key={l} style={s.stat}><strong style={{...s.statN,color:c}}>{v}</strong><span style={s.statL}>{l}</span></div>
        ))}
      </div>

      <div style={{display:"flex",gap:".6rem",marginBottom:"1rem",flexWrap:"wrap"}}>
        <input style={{...s.inp,marginBottom:0,flex:1,minWidth:"200px"}} placeholder="Search by name, phone, course, message…" value={search} onChange={e=>setSrch(e.target.value)} />
        <select style={{...s.sel,marginBottom:0,width:"auto"}} value={filter} onChange={e=>setFilter(e.target.value)}>
          <option value="all">All Enquiries</option>
          <option value="unread">Unread Only</option>
          <option value="admission">Admissions</option>
          <option value="grievance">Grievances</option>
        </select>
        <button style={s.btnN} onClick={exportCSV}>⬇ Export CSV</button>
        <button style={s.btnGrn} onClick={load_}>↻ Refresh</button>
      </div>

      {load?<div style={s.loading}><Spin/>Loading enquiries…</div>:!filtered.length?<div style={s.empty}>No enquiries found</div>:(
        <div style={s.card}>
          <div style={s.cardHd}><span style={s.cardTit}>Enquiries ({filtered.length})</span><span style={{color:"rgba(71,85,105,.3)",fontSize:".72rem",fontFamily:"inherit"}}>Click row to view details</span></div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:".83rem"}}>
              <thead>
                <tr>{["Date","Student","Parent","Phone","Course","Type","Status",""].map(h=>(
                  <th key={h} style={{background:"rgba(226,232,240,.6)",padding:".6rem .9rem",textAlign:"left",fontFamily:"inherit",fontWeight:700,fontSize:".64rem",letterSpacing:"0",textTransform:"none",color:C.goldL,borderBottom:"1px solid rgba(148,163,184,.12)",whiteSpace:"nowrap"}}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {filtered.map(r=>(
                  <tr key={r.id} style={{cursor:"pointer",background:r.replied?"transparent":"rgba(148,163,184,.03)"}} onClick={()=>setOpen(r)}>
                    <td style={{padding:".55rem .9rem",borderBottom:"1px solid rgba(148,163,184,.06)",color:"rgba(71,85,105,.45)",fontSize:".72rem",fontFamily:"inherit",whiteSpace:"nowrap"}}>{fmt(r.created_at)}</td>
                    <td style={{padding:".55rem .9rem",borderBottom:"1px solid rgba(148,163,184,.06)",color:r.replied?"rgba(71,85,105,.65)":"#1e293b",fontWeight:r.replied?400:600}}>{r.student_name||"—"}</td>
                    <td style={{padding:".55rem .9rem",borderBottom:"1px solid rgba(148,163,184,.06)",color:"rgba(71,85,105,.55)"}}>{r.parent_name||"—"}</td>
                    <td style={{padding:".55rem .9rem",borderBottom:"1px solid rgba(148,163,184,.06)",color:C.goldL}}><a href={`tel:${r.phone}`} style={{color:C.goldL}} onClick={e=>e.stopPropagation()}>{r.phone||"—"}</a></td>
                    <td style={{padding:".55rem .9rem",borderBottom:"1px solid rgba(148,163,184,.06)",color:"rgba(71,85,105,.6)",fontSize:".78rem",maxWidth:"180px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.course||"—"}</td>
                    <td style={{padding:".55rem .9rem",borderBottom:"1px solid rgba(148,163,184,.06)"}}><span style={{...s.badge(r.course?.startsWith("GRIEVANCE")?"High":"Medium"),fontSize:".58rem"}}>{r.course?.startsWith("GRIEVANCE")?"Grievance":"Admission"}</span></td>
                    <td style={{padding:".55rem .9rem",borderBottom:"1px solid rgba(148,163,184,.06)"}}><span style={{...s.badge(r.replied?"Low":"High"),fontSize:".58rem"}}>{r.replied?"Replied":"New"}</span></td>
                    <td style={{padding:".55rem .9rem",borderBottom:"1px solid rgba(148,163,184,.06)"}} onClick={e=>e.stopPropagation()}>
                      <a href={`https://wa.me/${(r.phone||"").replace(/\D/g,"")}?text=Hello%20${encodeURIComponent(r.parent_name||"")}%2C%20GNSI%20Khangabok.%20Regarding%20enquiry%20for%20${encodeURIComponent(r.student_name||"your%20child")}.`} target="_blank" rel="noopener noreferrer" style={{...s.btnGrn,fontSize:".6rem",padding:".28rem .55rem",textDecoration:"none",display:"inline-block"}}>WA</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {open&&(
        <div style={{position:"fixed",inset:0,background:"rgba(226,232,240,.92)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem",overflowY:"auto"}} onClick={()=>setOpen(null)}>
          <div style={{background:C.navy2,border:`1px solid rgba(148,163,184,.3)`,padding:"1.8rem",width:"100%",maxWidth:"520px"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.2rem"}}>
              <h3 style={{fontFamily:"inherit",color:"#1e293b",fontSize:"1.3rem"}}>{open.course?.startsWith("GRIEVANCE")?"🔴 Grievance":"📬 Enquiry"} Details</h3>
              <button onClick={()=>setOpen(null)} style={{background:"none",border:"none",color:"rgba(71,85,105,.4)",cursor:"pointer",fontSize:"1.2rem"}}>✕</button>
            </div>
            {open.course?.startsWith("GRIEVANCE")&&(
              <div style={{padding:".6rem .9rem",background:"rgba(220,38,38,.2)",border:"1px solid rgba(220,38,38,.3)",marginBottom:"1rem",fontFamily:"inherit",fontSize:".78rem",color:"#dc2626",letterSpacing:"0"}}>
                ⚠ GRIEVANCE — Requires response within 48 hours · Ticket: {open.message?.match(/GNSI-GRV-\d+/)?.[0]||"—"}
              </div>
            )}
            {[["Student Name",open.student_name],["Parent / Guardian",open.parent_name],["Phone",open.phone],["Class / Age",open.class_grade],["Course / Type",open.course],["Submitted",fmt(open.created_at)],open.replied_at&&["Replied At",fmt(open.replied_at)]].filter(Boolean).map(([l,v])=>(
              <div key={l} style={s.row}><span style={{color:"rgba(71,85,105,.38)",fontFamily:"inherit",fontSize:".72rem",letterSpacing:"0",textTransform:"none"}}>{l}</span><strong style={{color:"#1e293b",fontSize:".85rem"}}>{v||"—"}</strong></div>
            ))}
            {open.message&&<div style={{marginTop:"1rem",padding:".9rem",background:"rgba(226,232,240,.5)",border:"1px solid rgba(148,163,184,.12)"}}><div style={{...s.lbl,marginBottom:".5rem"}}>Message</div><p style={{color:"rgba(71,85,105,.65)",fontSize:".85rem",lineHeight:1.7}}>{open.message}</p></div>}
            <div style={{display:"flex",gap:".6rem",marginTop:"1.3rem",flexWrap:"wrap"}}>
              <a href={`https://wa.me/${(open.phone||"").replace(/\D/g,"")}?text=Hello%20${encodeURIComponent(open.parent_name||"")}%2C%20GNSI%20Khangabok.%20We%20received%20your%20enquiry%20for%20${encodeURIComponent(open.student_name||"your%20child")}.%20Please%20contact%20us%20at%20%2B91%2089742%2098074.`} target="_blank" rel="noopener noreferrer" style={{...s.btnGrn,textDecoration:"none",display:"inline-block"}}>📱 WhatsApp</a>
              <a href={`tel:${open.phone}`} style={{...s.btnG,textDecoration:"none",display:"inline-block"}}>📞 Call</a>
              {!open.replied&&<button style={s.btnGrn} onClick={()=>markReplied(open.id)}>✓ Mark Replied</button>}
              <button style={s.btnR} onClick={()=>del(open.id)}>🗑 Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  ② PUBLIC NOTICES
// ════════════════════════════════════════════════════════════

// ── Latest strip (ticker) editor — shown at the top of Notices ──
function TickerCard({notices}){
  const [cfg,setCfg]=useState({ticker_extra:"",ticker_show_contact:"yes",ticker_use_notices:"yes"});
  const [saving,setSave]=useState(false);
  useEffect(()=>{getSettings().then(c=>setCfg(x=>({...x,...Object.fromEntries(Object.entries(c||{}).filter(([k])=>k.startsWith("ticker_")))}))).catch(()=>{});},[]);
  const set_=(k,v)=>setCfg(c=>({...c,[k]:v}));
  const save=async()=>{setSave(true);const{error}=await saveSettings({ticker_extra:cfg.ticker_extra||"",ticker_show_contact:cfg.ticker_show_contact||"yes",ticker_use_notices:cfg.ticker_use_notices||"yes"});setSave(false);if(error)return toast("Error: "+error.message,"error");toast("Latest strip saved ✓");};
  const active=(notices||[]).filter(n=>!n.is_archived&&n.title).slice(0,8);
  const extra=(cfg.ticker_extra||"").split("\n").map(x=>x.trim()).filter(Boolean);
  const items=[...(cfg.ticker_use_notices!=="no"?active.map(n=>(n.priority==="High"?"🔴 ":"")+n.title.toUpperCase()):[]),...extra.map(x=>x.toUpperCase())];
  const preview=(items.length?items:["(nothing to show — add a notice or an extra line)"]).concat(cfg.ticker_show_contact!=="no"?["CALL +91 …","KHANGABOK, THOUBAL, MANIPUR"]:[]).join("  ◆  ");
  return(
    <div style={s.card}>
      <div style={s.cardHd}><span style={s.cardTit}>📢 "Latest" Scrolling Strip</span></div>
      <div style={s.cardBdy}>
        <div style={{background:"#0B1E3D",borderRadius:8,display:"flex",alignItems:"center",overflow:"hidden",marginBottom:"1rem"}}>
          <span style={{background:"#B8913F",color:"#0B1E3D",fontWeight:800,fontSize:".7rem",padding:".55rem .8rem",letterSpacing:".08em"}}>LATEST</span>
          <span style={{color:"#E2C57E",fontSize:".75rem",padding:"0 .8rem",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{preview}</span>
        </div>
        <div style={s.g2}>
          <div><label style={s.lbl}>Show active notices in the strip</label><select style={s.sel} value={cfg.ticker_use_notices||"yes"} onChange={e=>set_("ticker_use_notices",e.target.value)}><option value="yes">Yes — newest 8 notice titles</option><option value="no">No</option></select></div>
          <div><label style={s.lbl}>Add phone & address at the end</label><select style={s.sel} value={cfg.ticker_show_contact||"yes"} onChange={e=>set_("ticker_show_contact",e.target.value)}><option value="yes">Yes</option><option value="no">No</option></select></div>
        </div>
        <label style={s.lbl}>Extra lines (one per line — always shown)</label>
        <textarea style={s.ta} rows={3} placeholder={"New Navodaya batch commencing 20 December 2026\nSunday mock tests ongoing"} value={cfg.ticker_extra||""} onChange={e=>set_("ticker_extra",e.target.value)}/>
        <button style={{...s.btnG,opacity:saving?.6:1}} onClick={save} disabled={saving}>{saving?"Saving…":"💾 Save Strip"}</button>
        <p style={{color:"#94a3b8",fontSize:".72rem",marginTop:".5rem"}}>Archive a notice to remove it from the strip. High-priority notices get a 🔴.</p>
      </div>
    </div>
  );
}

function NoticesSection() {
  const [rows,setRows]=useState([]);
  const [load,setLoad]=useState(true);
  const [form,setForm]=useState({title:"",body:"",priority:"Medium",notice_date:new Date().toISOString().slice(0,10)});
  const [editing,setEdit]=useState(null);
  const [saving,setSave]=useState(false);

  const load_=useCallback(async()=>{
    setLoad(true);
    const data=await getAllNotices(40);
    if(data)setRows(data);
    setLoad(false);
  },[]);
  useEffect(()=>{load_();},[load_]);

  const save=async()=>{
    if(!form.title||!form.body)return toast("Title and body required","error");
    setSave(true);
    const{error}=await saveNotice(form,editing);
    setSave(false);
    if(error)return toast("Error: "+error.message,"error");
    toast(editing?"Notice updated ✓":"Published to website ✓");
    setForm({title:"",body:"",priority:"Medium",notice_date:new Date().toISOString().slice(0,10)});
    setEdit(null);load_();
  };
  const archive=async(id,cur)=>{await archiveNotice(id,cur);toast(cur?"Restored":"Archived");load_();};
  const del=async id=>{if(!confirm("Delete permanently?"))return;await deleteNotice(id);toast("Deleted");load_();};
  const startEdit=n=>{setEdit(n.id);setForm({title:n.title,body:n.body,priority:n.priority||"Medium",notice_date:n.notice_date||new Date().toISOString().slice(0,10)});window.scrollTo({top:0,behavior:"smooth"});};

  return (
    <div>
      <TickerCard notices={rows}/>
      <div style={s.card}>
        <div style={s.cardHd}><span style={s.cardTit}>{editing?"✏️ Edit Notice":"📝 New Notice"}</span>{editing&&<button style={s.btnR} onClick={()=>{setEdit(null);setForm({title:"",body:"",priority:"Medium",notice_date:new Date().toISOString().slice(0,10)})}}>Cancel</button>}</div>
        <div style={s.cardBdy}>
          <div style={s.g2}>
            <div><label style={s.lbl}>Title *</label><input style={s.inp} placeholder="e.g. Admissions Open 2026–27" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}/></div>
            <div style={s.g2}>
              <div><label style={s.lbl}>Priority</label><select style={s.sel} value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))}><option>High</option><option>Medium</option><option>Low</option></select></div>
              <div><label style={s.lbl}>Date</label><input type="date" style={s.inp} value={form.notice_date} onChange={e=>setForm(f=>({...f,notice_date:e.target.value}))}/></div>
            </div>
          </div>
          <label style={s.lbl}>Body *</label>
          <textarea style={s.ta} placeholder="Notice text shown on the public website…" value={form.body} onChange={e=>setForm(f=>({...f,body:e.target.value}))} rows={4}/>
          <button style={{...s.btnG,opacity:saving?.6:1}} onClick={save} disabled={saving}>{saving?"Publishing…":editing?"Update Notice":"Publish to Website →"}</button>
          <p style={{color:"rgba(71,85,105,.28)",fontSize:".72rem",fontFamily:"inherit",marginTop:".5rem"}}>High priority → red border on website · Top 3 active notices shown on homepage · Titles also scroll in the \u201cLatest\u201d strip</p>
        </div>
      </div>
      {load?<div style={s.loading}><Spin/>Loading…</div>:rows.map(n=>(
        <div key={n.id} style={{...s.card,opacity:n.is_archived?.55:1}}>
          <div style={s.cardHd}>
            <div style={{display:"flex",alignItems:"center",gap:".7rem",flexWrap:"wrap"}}>
              <span style={s.badge(n.priority)}>{n.priority||"Medium"}</span>
              <span style={{color:"#1e293b",fontFamily:"inherit",fontSize:"1rem"}}>{n.title}</span>
              {n.is_archived&&<span style={{...s.badge("Low"),fontSize:".55rem"}}>Archived</span>}
            </div>
            <div style={{display:"flex",gap:".4rem"}}>
              <button style={s.btnG} onClick={()=>startEdit(n)}>Edit</button>
              <button style={s.btnGrn} onClick={()=>archive(n.id,n.is_archived)}>{n.is_archived?"Restore":"Archive"}</button>
              <button style={s.btnR} onClick={()=>del(n.id)}>Delete</button>
            </div>
          </div>
          <div style={{padding:".7rem 1.1rem"}}>
            <p style={{color:"rgba(71,85,105,.55)",fontSize:".83rem",lineHeight:1.7,marginBottom:".4rem"}}>{n.body?.slice(0,180)}{n.body?.length>180?"…":""}</p>
            <span style={{color:"rgba(71,85,105,.28)",fontSize:".68rem",fontFamily:"inherit",letterSpacing:"0",textTransform:"none"}}>{fmt(n.notice_date||n.created_at)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  ③ RANKER WALL
// ════════════════════════════════════════════════════════════
function RankersSection() {
  const SESSIONS=sessionOptions();
  // Default session for new entries: the one before the current academic
  // year (results announced in 2026 belong to the 2025–26 session).
  const DEFAULT_SESSION=SESSIONS[2]||SESSIONS[0];
  const blank=(session)=>({name:"",school:"",batch:"",rank:"",photo_url:"",sort_order:0,session:session||DEFAULT_SESSION});

  const [rows,setRows]=useState([]);
  const [load,setLoad]=useState(true);
  const [form,setForm]=useState(blank());
  const [editing,setEdit]=useState(null);
  const [saving,setSave]=useState(false);
  const [view,setView]=useState("all"); // session filter for the list below
  const [needsColumn,setNeedsColumn]=useState(false);

  const load_=useCallback(async()=>{
    setLoad(true);
    const data=await getRankers();
    if(data){
      setRows(data);
      // Rows exist but none has the session column → column not added yet.
      setNeedsColumn(data.length>0&&!data.some(r=>Object.prototype.hasOwnProperty.call(r,"session")));
    }
    setLoad(false);
  },[]);
  useEffect(()=>{load_();},[load_]);

  const groups=groupRankersBySession(rows);
  const shown=view==="all"?rows:rows.filter(r=>rankerSession(r)===view);
  const nextOrder=(session)=>rows.filter(r=>rankerSession(r)===session).length;

  const save=async()=>{
    if(!form.name.trim())return toast("Student name is required","error");
    if(!form.session)return toast("Choose the session / year","error");
    setSave(true);
    const{error}=await saveRanker(form,editing);
    setSave(false);
    if(error){
      if(/session/i.test(error.message||"")){setNeedsColumn(true);return toast("Run the ‘Add Session column’ SQL above first, then save again","error");}
      return toast("Error: "+error.message,"error");
    }
    toast(editing?"Ranker updated ✓":`Ranker added to ${form.session} ✓`);
    setEdit(null);
    setForm({...blank(form.session),sort_order:nextOrder(form.session)+(editing?0:1)});
    load_();
  };
  const del=async id=>{if(!confirm("Remove ranker?"))return;await deleteRanker(id);toast("Removed");load_();};
  const startEdit=r=>{
    const sess=rankerSession(r);
    setEdit(r.id);
    setForm({name:r.name,school:r.school||"",batch:r.batch||"",rank:r.rank||"",photo_url:r.photo_url||"",sort_order:r.sort_order||0,session:sess===EARLIER_SESSION?DEFAULT_SESSION:sess});
    window.scrollTo({top:0,behavior:"smooth"});
  };

  const SQL=`CREATE TABLE IF NOT EXISTS website_rankers (
  id         bigserial primary key,
  name       text not null,
  school     text,
  batch      text,
  rank       text,
  photo_url  text,
  sort_order int default 0,
  session    text
);`;
  const ALTER_SQL=`ALTER TABLE website_rankers ADD COLUMN IF NOT EXISTS session text;`;

  const chip=(active)=>({padding:".35rem .8rem",borderRadius:"999px",border:`1px solid ${active?C.navy:"#cbd5e1"}`,background:active?C.navy:"#fff",color:active?"#fff":"#1e293b",fontSize:".75rem",fontWeight:600,cursor:"pointer",fontFamily:"inherit"});

  return (
    <div>
      <div style={{...s.card,borderColor:needsColumn?"#f59e0b":"rgba(148,163,184,.3)",marginBottom:"1rem"}}>
        <div style={s.cardHd}><span style={s.cardTit}>{needsColumn?"⚠️ One-time step — Add Session column":"📋 Setup SQL"}</span></div>
        <div style={s.cardBdy}>
          <p style={{fontSize:".8rem",color:"#475569",margin:"0 0 .5rem"}}>
            Year-wise toppers need a <b>session</b> column. Run this once in Supabase → SQL Editor (safe to run again):
          </p>
          <pre style={{background:"#0f172a",padding:".8rem",borderRadius:"8px",fontSize:".72rem",color:"#4ade80",overflowX:"auto",lineHeight:1.6,whiteSpace:"pre-wrap",marginBottom:".7rem"}}>{ALTER_SQL}</pre>
          <button style={{...s.btnG,fontSize:".72rem",marginRight:".5rem"}} onClick={()=>{navigator.clipboard.writeText(ALTER_SQL);toast("SQL copied ✓");}}>📋 Copy Session SQL</button>
          <button style={{...s.btnG,fontSize:".72rem"}} onClick={()=>{navigator.clipboard.writeText(SQL);toast("Full table SQL copied ✓");}}>📋 Copy Full Table SQL</button>
          <p style={{fontSize:".72rem",color:"#64748b",margin:".6rem 0 0"}}>
            Existing toppers without a session are placed by the year written in their Batch (e.g. “Batch 2024–25”); otherwise they show under “{EARLIER_SESSION}”. Edit them to assign a session.
          </p>
        </div>
      </div>

      <div style={s.card}>
        <div style={s.cardHd}><span style={s.cardTit}>{editing?"✏️ Edit Ranker":"🏆 Add Selected Student"}</span>{editing&&<button style={s.btnR} onClick={()=>{setEdit(null);setForm(blank(form.session))}}>Cancel</button>}</div>
        <div style={s.cardBdy}>
          <div style={s.g2}>
            <div>
              <label style={s.lbl}>Session / Year *</label>
              <select style={s.sel} value={form.session} onChange={e=>setForm(f=>({...f,session:e.target.value}))}>
                {SESSIONS.map(y=><option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div><label style={s.lbl}>Student Name *</label><input style={s.inp} placeholder="e.g. Laishram Ibeton Singh" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></div>
          </div>
          <div style={s.g2}>
            <div><label style={s.lbl}>School Selected *</label><input style={s.inp} placeholder="e.g. Sainik School Tilaiya" value={form.school} onChange={e=>setForm(f=>({...f,school:e.target.value}))}/></div>
            <div><label style={s.lbl}>Rank / Achievement (optional)</label><input style={s.inp} placeholder="e.g. AIR 1 or District Topper" value={form.rank} onChange={e=>setForm(f=>({...f,rank:e.target.value}))}/></div>
          </div>
          <div style={s.g2}>
            <div><label style={s.lbl}>Batch label (optional)</label><input style={s.inp} placeholder="e.g. NVS Batch · Class 6" value={form.batch} onChange={e=>setForm(f=>({...f,batch:e.target.value}))}/></div>
            <div><label style={s.lbl}>Sort Order (within the year)</label><input type="number" style={s.inp} value={form.sort_order} onChange={e=>setForm(f=>({...f,sort_order:+e.target.value}))}/></div>
          </div>
          <ImageUploadField label="Student Photo" folder="rankers" round previewSize={70} value={form.photo_url} onChange={url=>setForm(f=>({...f,photo_url:url}))}/>
          <button style={{...s.btnG,opacity:saving?.6:1}} onClick={save} disabled={saving}>{saving?"Saving…":editing?"Update Ranker":`Add to ${form.session} Toppers →`}</button>
        </div>
      </div>

      {!load&&rows.length>0&&(
        <div style={{display:"flex",flexWrap:"wrap",gap:".4rem",margin:"0 0 .9rem"}}>
          <button style={chip(view==="all")} onClick={()=>setView("all")}>All ({rows.length})</button>
          {groups.map(g=>(
            <button key={g.session} style={chip(view===g.session)} onClick={()=>setView(g.session)}>{g.session} ({g.rankers.length})</button>
          ))}
        </div>
      )}

      {load?<div style={s.loading}><Spin/>Loading rankers…</div>:!rows.length?<div style={s.empty}>No rankers yet — add your first selected student above</div>:!shown.length?<div style={s.empty}>No toppers in {view}</div>:(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:".8rem"}}>
          {shown.map(r=>(
            <div key={r.id} style={{...s.card,marginBottom:0}}>
              <div style={{padding:"1rem",textAlign:"center"}}>
                <div style={{display:"inline-block",background:C.navy,color:"#fff",fontSize:".6rem",fontWeight:700,padding:".12rem .5rem",borderRadius:"999px",marginBottom:".5rem"}}>{rankerSession(r)}</div>
                {r.photo_url
                  ?<img src={r.photo_url} alt={r.name} style={{width:"64px",height:"64px",borderRadius:"50%",objectFit:"cover",border:`2px solid ${C.gold}`,margin:"0 auto .7rem",display:"block"}} onError={e=>e.target.style.display="none"}/>
                  :<div style={{width:"64px",height:"64px",borderRadius:"50%",background:C.navy,border:`2px solid ${C.gold}`,margin:"0 auto .7rem",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit",fontWeight:700,fontSize:"1.3rem",color:"#ffffff"}}>{(r.name||"S")[0]}</div>
                }
                {r.rank&&<div style={{background:"rgba(148,163,184,.2)",color:C.goldLL,fontFamily:"inherit",fontWeight:700,fontSize:".6rem",letterSpacing:"0",textTransform:"none",padding:".15rem .5rem",marginBottom:".4rem",display:"inline-block"}}>{r.rank}</div>}
                <div style={{color:"#1e293b",fontFamily:"inherit",fontSize:".97rem",marginBottom:".2rem"}}>{r.name}</div>
                <div style={{color:C.goldL,fontFamily:"inherit",fontSize:".68rem",letterSpacing:"0",textTransform:"none",marginBottom:".15rem"}}>{r.school}</div>
                <div style={{color:"rgba(71,85,105,.55)",fontFamily:"inherit",fontSize:".65rem"}}>{r.batch}</div>
              </div>
              <div style={{padding:".5rem",borderTop:"1px solid rgba(148,163,184,.1)",display:"flex",gap:".4rem",justifyContent:"center"}}>
                <button style={s.btnG} onClick={()=>startEdit(r)}>Edit</button>
                <button style={s.btnR} onClick={()=>del(r.id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  ④ GALLERY
// ════════════════════════════════════════════════════════════
function GallerySection() {
  const [rows,setRows]=useState([]);
  const [load,setLoad]=useState(true);
  const [form,setForm]=useState({image_url:"",caption:"",category:"Campus",sort_order:0});
  const [saving,setSave]=useState(false);
  const [hint,setHint]=useState(false);
  const [bulkCat,setBulkCat]=useState("Campus");
  const [bulkBusy,setBulkBusy]=useState(false);
  const [bulkProgress,setBulkProgress]=useState({done:0,total:0});
  const bulkInputRef=useRef(null);
  const CATS=["Campus","Classroom","Hostel","Events","Sports","Alumni","Results","Rankers"];

  const load_=useCallback(async()=>{
    setLoad(true);
    const data=await getGallery();
    setRows(data);setLoad(false);
  },[]);
  useEffect(()=>{load_();},[load_]);

  const save=async()=>{
    if(!form.image_url)return toast("Image URL required","error");
    setSave(true);
    const{error}=await addGalleryImage(form);
    setSave(false);if(error)return toast("Error: "+error.message,"error");
    toast("Image added ✓");setForm({image_url:"",caption:"",category:"Campus",sort_order:rows.length});load_();
  };
  const del=async id=>{if(!confirm("Remove image?"))return;await deleteGalleryImage(id);toast("Removed");load_();};
  const updateCaption=async(id,caption)=>{await updateGalleryCaption(id,caption);toast("Caption updated ✓");};

  // Bulk add: pick several photos at once, each becomes its own gallery
  // row (same category for all, no caption — captions can be filled in
  // per-image afterwards in the grid below).
  const bulkPick=()=>bulkInputRef.current?.click();
  const handleBulkFiles=async(e)=>{
    const files=Array.from(e.target.files||[]);
    e.target.value="";
    if(!files.length)return;
    setBulkBusy(true);
    setBulkProgress({done:0,total:files.length});
    let okCount=0,failCount=0;
    for(const file of files){
      if(!file.type?.startsWith("image/")||file.size>30*1024*1024){
        failCount++;setBulkProgress(p=>({...p,done:p.done+1}));continue;
      }
      const toUpload=await compressImage(file);
      const{url,error}=await uploadWebsiteImage(toUpload,"gallery");
      if(url&&!error){
        const{error:saveErr}=await addGalleryImage({image_url:url,caption:"",category:bulkCat,sort_order:rows.length+okCount});
        if(!saveErr)okCount++;else failCount++;
      }else failCount++;
      setBulkProgress(p=>({...p,done:p.done+1}));
    }
    setBulkBusy(false);
    toast(`${okCount} photo${okCount!==1?"s":""} added${failCount?`, ${failCount} failed`:""} ✓`,failCount&&!okCount?"error":"success");
    load_();
  };

  return (
    <div>
      <div style={{...s.card,borderColor:"rgba(148,163,184,.3)"}}>
        <div style={{...s.cardHd,cursor:"pointer"}} onClick={()=>setHint(!hint)}>
          <span style={s.cardTit}>📤 How to Upload Photos to Supabase</span>
          <span style={{color:C.goldL,fontSize:".75rem",fontFamily:"inherit"}}>{hint?"Hide ▲":"Show ▼"}</span>
        </div>
        {hint&&<div style={s.cardBdy}>
          {[["1","Supabase Dashboard","supabase.com → your project → Storage → Buckets"],["2","Create bucket","New Bucket → name: gnsi-public → enable Public access → Create"],["3","Upload photos","Open gnsi-public bucket → Upload → drag & drop photos (campus, rankers, faculty, results)"],["4","Get URL","Click any uploaded file → Copy URL → paste below"],["5","Folder structure (recommended)","gnsi-public/gallery/ · /rankers/ · /faculty/ · /results/ · /banners/ · /papers/"]].map(([n,t,d])=>(
            <div key={n} style={{display:"flex",gap:"1rem",marginBottom:".8rem",alignItems:"flex-start"}}>
              <div style={{width:"26px",height:"26px",background:C.gold,color:C.navy,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit",fontWeight:700,fontSize:".75rem",flexShrink:0}}>{n}</div>
              <div><div style={{color:"#1e293b",fontWeight:600,fontSize:".85rem",marginBottom:".15rem"}}>{t}</div><div style={{color:"rgba(71,85,105,.45)",fontSize:".8rem"}}>{d}</div></div>
            </div>
          ))}
        </div>}
      </div>

      <div style={{...s.card,borderLeft:`4px solid ${C.gold}`}}>
        <div style={s.cardHd}><span style={s.cardTit}>📚 Bulk Upload (multiple photos at once)</span></div>
        <div style={s.cardBdy}>
          <input ref={bulkInputRef} type="file" accept="image/*" multiple onChange={handleBulkFiles} style={{display:"none"}}/>
          <div style={s.g2}>
            <div>
              <label style={s.lbl}>Category (applies to all)</label>
              <select style={s.sel} value={bulkCat} onChange={e=>setBulkCat(e.target.value)}>{CATS.map(c=><option key={c}>{c}</option>)}</select>
            </div>
            <div style={{display:"flex",alignItems:"flex-end"}}>
              <button style={{...s.btnG,opacity:bulkBusy?.6:1,width:"100%"}} onClick={bulkPick} disabled={bulkBusy}>
                {bulkBusy
                  ? <span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:".4rem"}}><Spin/>Uploading {bulkProgress.done}/{bulkProgress.total}…</span>
                  : "Select Multiple Photos →"}
              </button>
            </div>
          </div>
          <div style={{fontSize:".72rem",color:"#64748b",marginTop:"-.4rem"}}>Select several photos at once — each is compressed, uploaded, and added as its own gallery entry with the category above. Add captions per photo afterwards in the grid below.</div>
        </div>
      </div>

      <div style={s.card}>
        <div style={s.cardHd}><span style={s.cardTit}>➕ Add Single Gallery Image</span></div>
        <div style={s.cardBdy}>
          <ImageUploadField label="Photo *" folder="gallery" previewSize={140} value={form.image_url} onChange={url=>setForm(f=>({...f,image_url:url}))}/>
          <div style={s.g2}>
            <div><label style={s.lbl}>Caption</label><input style={s.inp} placeholder="e.g. Morning Assembly" value={form.caption} onChange={e=>setForm(f=>({...f,caption:e.target.value}))}/></div>
            <div><label style={s.lbl}>Category</label><select style={s.sel} value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>{CATS.map(c=><option key={c}>{c}</option>)}</select></div>
          </div>
          <button style={{...s.btnG,opacity:saving?.6:1}} onClick={save} disabled={saving}>{saving?"Adding…":"Add to Gallery →"}</button>
        </div>
      </div>

      {load?<div style={s.loading}><Spin/>Loading gallery…</div>:!rows.length?<div style={s.empty}>No gallery images yet</div>:(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:".8rem"}}>
          {rows.map(img=>(
            <div key={img.id} style={{background:"rgba(226,232,240,.4)",border:"1px solid rgba(148,163,184,.15)",overflow:"hidden"}}>
              <img src={img.image_url} alt={img.caption} style={{width:"100%",aspectRatio:"4/3",objectFit:"cover",display:"block"}} onError={e=>e.target.style.display="none"}/>
              <div style={{padding:".7rem"}}>
                <input defaultValue={img.caption} onBlur={e=>{if(e.target.value!==img.caption)updateCaption(img.id,e.target.value)}} style={{...s.inp,marginBottom:".5rem",fontSize:".78rem",padding:"6px 10px"}} placeholder="Caption…"/>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{color:"rgba(71,85,105,.3)",fontSize:".62rem",fontFamily:"inherit",letterSpacing:"0",textTransform:"none"}}>{img.category}</span>
                  <button style={s.btnR} onClick={()=>del(img.id)}>Remove</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  EVENTS & SCHEDULE
// ════════════════════════════════════════════════════════════
function EventsSection() {
  const [rows,setRows]=useState([]);
  const [load,setLoad]=useState(true);
  const [form,setForm]=useState({title:"",description:"",event_date:new Date().toISOString().slice(0,10),sort_order:0,is_active:true});
  const [editing,setEdit]=useState(null);
  const [saving,setSave]=useState(false);

  const SQL=`CREATE TABLE IF NOT EXISTS website_events (
  id          bigserial primary key,
  title       text not null,
  description text,
  event_date  date not null,
  sort_order  int default 0,
  is_active   boolean default true,
  created_at  timestamptz default now()
);`;

  const load_=useCallback(async()=>{
    setLoad(true);
    const data=await getAllEvents();
    setRows(data);
    setLoad(false);
  },[]);
  useEffect(()=>{load_();},[load_]);

  const save=async()=>{
    if(!form.title||!form.event_date)return toast("Title and date required","error");
    setSave(true);
    const{error}=await saveEvent(form,editing);
    setSave(false);
    if(error)return toast("Error: "+error.message,"error");
    toast(editing?"Event updated ✓":"Event added ✓");
    setForm({title:"",description:"",event_date:new Date().toISOString().slice(0,10),sort_order:rows.length,is_active:true});
    setEdit(null);load_();
  };
  const del=async id=>{if(!confirm("Delete this event?"))return;await deleteEvent(id);toast("Deleted");load_();};
  const toggleActive=async(id,cur)=>{await toggleEventActive(id,cur);toast(cur?"Hidden from website":"Now visible on website");load_();};
  const startEdit=ev=>{setEdit(ev.id);setForm({title:ev.title,description:ev.description||"",event_date:ev.event_date,sort_order:ev.sort_order||0,is_active:ev.is_active!==false});window.scrollTo({top:0,behavior:"smooth"});};

  return (
    <div>
      <div style={{...s.card,borderColor:"rgba(148,163,184,.3)",marginBottom:"1rem"}}>
        <div style={s.cardHd}><span style={s.cardTit}>📋 Setup — Create Table First</span></div>
        <div style={s.cardBdy}>
          <pre style={{background:"#0f172a",padding:".8rem",borderRadius:"8px",fontSize:".72rem",color:"#4ade80",overflowX:"auto",lineHeight:1.6,whiteSpace:"pre-wrap",marginBottom:".7rem"}}>{SQL}</pre>
          <button style={{...s.btnG,fontSize:".72rem"}} onClick={()=>{navigator.clipboard.writeText(SQL);toast("SQL copied ✓");}}>📋 Copy SQL</button>
        </div>
      </div>

      <div style={s.card}>
        <div style={s.cardHd}><span style={s.cardTit}>{editing?"✏️ Edit Event":"📅 Add Event"}</span>{editing&&<button style={s.btnR} onClick={()=>{setEdit(null);setForm({title:"",description:"",event_date:new Date().toISOString().slice(0,10),sort_order:0,is_active:true})}}>Cancel</button>}</div>
        <div style={s.cardBdy}>
          <div style={s.g2}>
            <div><label style={s.lbl}>Event Title *</label><input style={s.inp} placeholder="e.g. Summer Batch Begins" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}/></div>
            <div><label style={s.lbl}>Date *</label><input type="date" style={s.inp} value={form.event_date} onChange={e=>setForm(f=>({...f,event_date:e.target.value}))}/></div>
          </div>
          <label style={s.lbl}>Description (shown on website)</label>
          <textarea style={s.ta} placeholder="e.g. New session commencing — fresh admissions welcome." value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} rows={3}/>
          <div style={s.g2}>
            <div><label style={s.lbl}>Sort Order (for same-day events)</label><input type="number" style={s.inp} value={form.sort_order} onChange={e=>setForm(f=>({...f,sort_order:+e.target.value}))}/></div>
            <div>
              <label style={s.lbl}>Visible on Website</label>
              <select style={s.sel} value={form.is_active?"yes":"no"} onChange={e=>setForm(f=>({...f,is_active:e.target.value==="yes"}))}>
                <option value="yes">Yes — show on homepage</option>
                <option value="no">No — hidden</option>
              </select>
            </div>
          </div>
          <button style={{...s.btnG,opacity:saving?.6:1}} onClick={save} disabled={saving}>{saving?"Saving…":editing?"Update Event":"Add Event →"}</button>
          <p style={{color:"rgba(71,85,105,.28)",fontSize:".72rem",fontFamily:"inherit",marginTop:".5rem"}}>Past events remain in the list but won't show on the homepage automatically — delete or mark inactive once they've passed.</p>
        </div>
      </div>

      {load?<div style={s.loading}><Spin/>Loading events…</div>:!rows.length?<div style={s.empty}>No events yet — add your first event above</div>:(
        rows.map(ev=>{
          const isPast=ev.event_date<new Date().toISOString().slice(0,10);
          return(
            <div key={ev.id} style={{...s.card,opacity:(!ev.is_active||isPast)?.55:1}}>
              <div style={s.cardHd}>
                <div style={{display:"flex",alignItems:"center",gap:".7rem",flexWrap:"wrap"}}>
                  <span style={{color:C.goldLL,fontFamily:"inherit",fontSize:"1.1rem",minWidth:"3.5rem"}}>{fmt(ev.event_date)}</span>
                  <span style={{color:"#1e293b",fontFamily:"inherit",fontSize:"1rem"}}>{ev.title}</span>
                  {!ev.is_active&&<span style={{...s.badge("Low"),fontSize:".55rem"}}>Hidden</span>}
                  {isPast&&<span style={{...s.badge("Medium"),fontSize:".55rem"}}>Past</span>}
                </div>
                <div style={{display:"flex",gap:".4rem"}}>
                  <button style={s.btnG} onClick={()=>startEdit(ev)}>Edit</button>
                  <button style={s.btnGrn} onClick={()=>toggleActive(ev.id,ev.is_active)}>{ev.is_active?"Hide":"Show"}</button>
                  <button style={s.btnR} onClick={()=>del(ev.id)}>Delete</button>
                </div>
              </div>
              {ev.description&&<div style={{padding:".7rem 1.1rem"}}><p style={{color:"rgba(71,85,105,.55)",fontSize:".83rem",lineHeight:1.7}}>{ev.description}</p></div>}
            </div>
          );
        })
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  ⑤ VIDEOS
// ════════════════════════════════════════════════════════════
function VideosSection() {
  const [rows,setRows]=useState([]);
  const [load,setLoad]=useState(true);
  const [form,setForm]=useState({title:"",youtube_url:"",description:"",category:"Campus",sort_order:0});
  const [editing,setEdit]=useState(null);
  const [saving,setSave]=useState(false);

  const SQL=`CREATE TABLE IF NOT EXISTS website_videos (
  id          bigserial primary key,
  title       text not null,
  youtube_url text,
  description text,
  category    text default 'Campus',
  sort_order  int default 0,
  created_at  timestamptz default now()
);`;

  const load_=useCallback(async()=>{
    setLoad(true);
    const data=await getVideos();
    setRows(data);setLoad(false);
  },[]);
  useEffect(()=>{load_();},[load_]);

  const getThumb=getYouTubeThumb;
  const getEmbed=getYouTubeEmbed;

  const save=async()=>{
    if(!form.title)return toast("Title required","error");
    setSave(true);
    const{error}=await saveVideo(form,editing);
    setSave(false);if(error)return toast("Error: "+error.message,"error");
    toast(editing?"Video updated ✓":"Video added ✓");
    setForm({title:"",youtube_url:"",description:"",category:"Campus",sort_order:rows.length});
    setEdit(null);load_();
  };
  const del=async id=>{if(!confirm("Remove video?"))return;await deleteVideo(id);toast("Removed");load_();};
  const startEdit=v=>{setEdit(v.id);setForm({title:v.title,youtube_url:v.youtube_url||"",description:v.description||"",category:v.category||"Campus",sort_order:v.sort_order||0});};

  const thumb=form.youtube_url?getThumb(form.youtube_url):null;

  return (
    <div>
      <div style={{...s.card,borderColor:"rgba(148,163,184,.3)",marginBottom:"1rem"}}>
        <div style={s.cardHd}><span style={s.cardTit}>📋 Setup SQL</span></div>
        <div style={s.cardBdy}>
          <pre style={{background:"#0f172a",padding:".8rem",borderRadius:"8px",fontSize:".72rem",color:"#4ade80",overflowX:"auto",lineHeight:1.6,whiteSpace:"pre-wrap",marginBottom:".7rem"}}>{SQL}</pre>
          <button style={{...s.btnG,fontSize:".72rem"}} onClick={()=>{navigator.clipboard.writeText(SQL);toast("SQL copied ✓");}}>📋 Copy SQL</button>
        </div>
      </div>
      <div style={s.card}>
        <div style={s.cardHd}><span style={s.cardTit}>{editing?"✏️ Edit Video":"▶️ Add Video"}</span>{editing&&<button style={s.btnR} onClick={()=>{setEdit(null);setForm({title:"",youtube_url:"",description:"",category:"Campus",sort_order:0})}}>Cancel</button>}</div>
        <div style={s.cardBdy}>
          <label style={s.lbl}>Video Title *</label>
          <input style={s.inp} placeholder="e.g. Morning Assembly & PT Session" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}/>
          <label style={s.lbl}>YouTube URL</label>
          <input style={s.inp} placeholder="https://www.youtube.com/watch?v=XXXXXXXXXX" value={form.youtube_url} onChange={e=>setForm(f=>({...f,youtube_url:e.target.value}))}/>
          {thumb&&<img src={thumb} alt="thumb" style={{width:"200px",height:"112px",objectFit:"cover",marginBottom:"1rem",border:"1px solid rgba(148,163,184,.2)"}} onError={e=>e.target.style.display="none"}/>}
          <div style={s.g2}>
            <div><label style={s.lbl}>Category</label><select style={s.sel} value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>{["Campus","Results","Classes","Hostel","Events","PT"].map(c=><option key={c}>{c}</option>)}</select></div>
            <div><label style={s.lbl}>Sort Order</label><input type="number" style={s.inp} value={form.sort_order} onChange={e=>setForm(f=>({...f,sort_order:+e.target.value}))}/></div>
          </div>
          <label style={s.lbl}>Description (shown on website)</label>
          <input style={s.inp} placeholder="e.g. Campus Life · 3 min" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/>
          <button style={{...s.btnG,opacity:saving?.6:1}} onClick={save} disabled={saving}>{saving?"Saving…":editing?"Update Video":"Add Video →"}</button>
        </div>
      </div>
      {load?<div style={s.loading}><Spin/>Loading…</div>:!rows.length?<div style={s.empty}>No videos yet</div>:(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:".8rem"}}>
          {rows.map(v=>{const t=v.youtube_url?getThumb(v.youtube_url):null;return(
            <div key={v.id} style={{...s.card,marginBottom:0}}>
              {t&&<img src={t} alt={v.title} style={{width:"100%",aspectRatio:"16/9",objectFit:"cover",display:"block"}} onError={e=>e.target.style.display="none"}/>}
              {!t&&<div style={{width:"100%",aspectRatio:"16/9",background:"rgba(226,232,240,.5)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"2rem"}}>▶</div>}
              <div style={{padding:".8rem"}}>
                <div style={{color:"#1e293b",fontSize:".88rem",marginBottom:".25rem"}}>{v.title}</div>
                <div style={{color:"rgba(71,85,105,.35)",fontFamily:"inherit",fontSize:".68rem",letterSpacing:"0",textTransform:"none",marginBottom:".5rem"}}>{v.category} · {v.description}</div>
                <div style={{display:"flex",gap:".4rem"}}>
                  <button style={s.btnG} onClick={()=>startEdit(v)}>Edit</button>
                  <button style={s.btnR} onClick={()=>del(v.id)}>Remove</button>
                </div>
              </div>
            </div>
          );})}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  ⑥ BLOG / NEWS
// ════════════════════════════════════════════════════════════
function BlogSection() {
  const [rows,setRows]=useState([]);
  const [load,setLoad]=useState(true);
  const [form,setForm]=useState({title:"",body:"",category:"News",image_url:"",published_date:new Date().toISOString().slice(0,10),is_published:true});
  const [editing,setEdit]=useState(null);
  const [saving,setSave]=useState(false);

  const SQL=`CREATE TABLE IF NOT EXISTS website_blog (
  id             bigserial primary key,
  title          text not null,
  body           text,
  category       text default 'News',
  image_url      text,
  published_date date default current_date,
  is_published   boolean default true,
  created_at     timestamptz default now()
);`;

  const load_=useCallback(async()=>{
    setLoad(true);
    const data=await getAllPosts(20);
    setRows(data);setLoad(false);
  },[]);
  useEffect(()=>{load_();},[load_]);

  const save=async()=>{
    if(!form.title||!form.body)return toast("Title and body required","error");
    setSave(true);
    const{error}=await savePost(form,editing);
    setSave(false);if(error)return toast("Error: "+error.message,"error");
    toast(editing?"Post updated ✓":"Published ✓");
    setForm({title:"",body:"",category:"News",image_url:"",published_date:new Date().toISOString().slice(0,10),is_published:true});
    setEdit(null);load_();
  };
  const toggle=async(id,cur)=>{await togglePostPublished(id,cur);toast(cur?"Unpublished":"Published ✓");load_();};
  const del=async id=>{if(!confirm("Delete post?"))return;await deletePost(id);toast("Deleted");load_();};
  const startEdit=p=>{setEdit(p.id);setForm({title:p.title,body:p.body||"",category:p.category||"News",image_url:p.image_url||"",published_date:p.published_date||new Date().toISOString().slice(0,10),is_published:p.is_published!==false});};

  return (
    <div>
      <div style={{...s.card,borderColor:"rgba(148,163,184,.3)",marginBottom:"1rem"}}>
        <div style={s.cardHd}><span style={s.cardTit}>📋 Setup SQL</span></div>
        <div style={s.cardBdy}>
          <pre style={{background:"#0f172a",padding:".8rem",borderRadius:"8px",fontSize:".72rem",color:"#4ade80",overflowX:"auto",lineHeight:1.6,whiteSpace:"pre-wrap",marginBottom:".7rem"}}>{SQL}</pre>
          <button style={{...s.btnG,fontSize:".72rem"}} onClick={()=>{navigator.clipboard.writeText(SQL);toast("SQL copied ✓");}}>📋 Copy SQL</button>
        </div>
      </div>
      <div style={s.card}>
        <div style={s.cardHd}><span style={s.cardTit}>{editing?"✏️ Edit Post":"📰 New Post"}</span>{editing&&<button style={s.btnR} onClick={()=>{setEdit(null);setForm({title:"",body:"",category:"News",image_url:"",published_date:new Date().toISOString().slice(0,10),is_published:true})}}>Cancel</button>}</div>
        <div style={s.cardBdy}>
          <div style={s.g2}>
            <div><label style={s.lbl}>Title *</label><input style={s.inp} placeholder="e.g. GNSI Records Best-Ever Result" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}/></div>
            <div style={s.g2}>
              <div><label style={s.lbl}>Category</label><select style={s.sel} value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>{["News","Results","Admissions","Exam Tips","Events","Announcements"].map(c=><option key={c}>{c}</option>)}</select></div>
              <div><label style={s.lbl}>Date</label><input type="date" style={s.inp} value={form.published_date} onChange={e=>setForm(f=>({...f,published_date:e.target.value}))}/></div>
            </div>
          </div>
          <ImageUploadField label="Cover Image (optional)" folder="blog" previewSize={140} allowMultiple value={form.image_url} onChange={url=>setForm(f=>({...f,image_url:url}))}/>
          <label style={s.lbl}>Body *</label>
          <textarea style={{...s.ta,minHeight:"140px"}} placeholder="Write the full article or news post here…" value={form.body} onChange={e=>setForm(f=>({...f,body:e.target.value}))} rows={6}/>
          <div style={{display:"flex",gap:".8rem",alignItems:"center"}}>
            <button style={{...s.btnG,opacity:saving?.6:1}} onClick={save} disabled={saving}>{saving?"Saving…":editing?"Update Post":"Publish Post →"}</button>
            <label style={{display:"flex",alignItems:"center",gap:".4rem",cursor:"pointer",fontFamily:"inherit",fontSize:".75rem",color:"rgba(71,85,105,.5)"}}>
              <input type="checkbox" checked={form.is_published} onChange={e=>setForm(f=>({...f,is_published:e.target.checked}))}/> Publish immediately
            </label>
          </div>
        </div>
      </div>
      {load?<div style={s.loading}><Spin/>Loading…</div>:!rows.length?<div style={s.empty}>No blog posts yet</div>:rows.map(p=>(
        <div key={p.id} style={{...s.card,opacity:p.is_published?1:.6}}>
          <div style={s.cardHd}>
            <div style={{display:"flex",alignItems:"center",gap:".7rem",flexWrap:"wrap"}}>
              <span style={{...s.badge("Medium"),fontSize:".58rem"}}>{p.category}</span>
              <span style={{color:"#1e293b",fontFamily:"inherit",fontSize:"1rem"}}>{p.title}</span>
              {!p.is_published&&<span style={{...s.badge("Low"),fontSize:".55rem"}}>Draft</span>}
            </div>
            <div style={{display:"flex",gap:".4rem"}}>
              <button style={s.btnG} onClick={()=>startEdit(p)}>Edit</button>
              <button style={s.btnGrn} onClick={()=>toggle(p.id,p.is_published)}>{p.is_published?"Unpublish":"Publish"}</button>
              <button style={s.btnR} onClick={()=>del(p.id)}>Delete</button>
            </div>
          </div>
          <div style={{padding:".7rem 1.1rem"}}>
            <p style={{color:"rgba(71,85,105,.55)",fontSize:".83rem",lineHeight:1.7,marginBottom:".4rem"}}>{p.body?.slice(0,160)}{p.body?.length>160?"…":""}</p>
            <span style={{color:"rgba(71,85,105,.28)",fontSize:".68rem",fontFamily:"inherit",letterSpacing:"0",textTransform:"none"}}>{fmt(p.published_date)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  ⑦ GOOGLE REVIEWS
// ════════════════════════════════════════════════════════════
function ReviewsSection() {
  const [rows,setRows]=useState([]);
  const [load,setLoad]=useState(true);
  const [form,setForm]=useState({reviewer_name:"",review_text:"",rating:5,review_date:new Date().toISOString().slice(0,10),is_featured:true});
  const [editing,setEdit]=useState(null);
  const [saving,setSave]=useState(false);

  const SQL=`CREATE TABLE IF NOT EXISTS website_reviews (
  id            bigserial primary key,
  reviewer_name text not null,
  review_text   text,
  rating        int default 5,
  review_date   date default current_date,
  is_featured   boolean default true,
  created_at    timestamptz default now()
);`;

  const load_=useCallback(async()=>{
    setLoad(true);
    const data=await getAllReviews();
    setRows(data);setLoad(false);
  },[]);
  useEffect(()=>{load_();},[load_]);

  const save=async()=>{
    if(!form.reviewer_name||!form.review_text)return toast("Name and review text required","error");
    setSave(true);
    const{error}=await saveReview(form,editing);
    setSave(false);if(error)return toast("Error: "+error.message,"error");
    toast(editing?"Review updated ✓":"Review added ✓");
    setForm({reviewer_name:"",review_text:"",rating:5,review_date:new Date().toISOString().slice(0,10),is_featured:true});
    setEdit(null);load_();
  };
  const toggle=async(id,cur)=>{await toggleReviewFeatured(id,cur);toast(cur?"Hidden from website":"Showing on website ✓");load_();};
  const del=async id=>{if(!confirm("Delete review?"))return;await deleteReview(id);toast("Deleted");load_();};
  const startEdit=r=>{setEdit(r.id);setForm({reviewer_name:r.reviewer_name,review_text:r.review_text||"",rating:r.rating||5,review_date:r.review_date||new Date().toISOString().slice(0,10),is_featured:r.is_featured!==false});};

  return (
    <div>
      <div style={{...s.card,borderColor:"rgba(148,163,184,.3)",marginBottom:"1rem"}}>
        <div style={s.cardHd}><span style={s.cardTit}>📋 Setup SQL</span></div>
        <div style={s.cardBdy}>
          <pre style={{background:"#0f172a",padding:".8rem",borderRadius:"8px",fontSize:".72rem",color:"#4ade80",overflowX:"auto",lineHeight:1.6,whiteSpace:"pre-wrap",marginBottom:".7rem"}}>{SQL}</pre>
          <button style={{...s.btnG,fontSize:".72rem"}} onClick={()=>{navigator.clipboard.writeText(SQL);toast("SQL copied ✓");}}>📋 Copy SQL</button>
        </div>
      </div>
      <div style={s.card}>
        <div style={s.cardHd}><span style={s.cardTit}>{editing?"✏️ Edit Review":"⭐ Add Review"}</span>{editing&&<button style={s.btnR} onClick={()=>{setEdit(null);setForm({reviewer_name:"",review_text:"",rating:5,review_date:new Date().toISOString().slice(0,10),is_featured:true})}}>Cancel</button>}</div>
        <div style={s.cardBdy}>
          <div style={s.g2}>
            <div><label style={s.lbl}>Reviewer Name *</label><input style={s.inp} placeholder="e.g. Laishram Ibeton Singh" value={form.reviewer_name} onChange={e=>setForm(f=>({...f,reviewer_name:e.target.value}))}/></div>
            <div style={s.g2}>
              <div><label style={s.lbl}>Rating</label><select style={s.sel} value={form.rating} onChange={e=>setForm(f=>({...f,rating:+e.target.value}))}>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} ★</option>)}</select></div>
              <div><label style={s.lbl}>Date</label><input type="date" style={s.inp} value={form.review_date} onChange={e=>setForm(f=>({...f,review_date:e.target.value}))}/></div>
            </div>
          </div>
          <label style={s.lbl}>Review Text *</label>
          <textarea style={s.ta} placeholder="The review text shown on the public website…" value={form.review_text} onChange={e=>setForm(f=>({...f,review_text:e.target.value}))} rows={3}/>
          <div style={{display:"flex",gap:".8rem",alignItems:"center"}}>
            <button style={{...s.btnG,opacity:saving?.6:1}} onClick={save} disabled={saving}>{saving?"Saving…":editing?"Update Review":"Add to Website →"}</button>
            <label style={{display:"flex",alignItems:"center",gap:".4rem",cursor:"pointer",fontFamily:"inherit",fontSize:".75rem",color:"rgba(71,85,105,.5)"}}>
              <input type="checkbox" checked={form.is_featured} onChange={e=>setForm(f=>({...f,is_featured:e.target.checked}))}/> Show on website
            </label>
          </div>
        </div>
      </div>
      {load?<div style={s.loading}><Spin/>Loading…</div>:!rows.length?<div style={s.empty}>No reviews yet</div>:rows.map(r=>(
        <div key={r.id} style={{...s.card,opacity:r.is_featured?1:.5}}>
          <div style={s.cardHd}>
            <div style={{display:"flex",alignItems:"center",gap:".7rem",flexWrap:"wrap"}}>
              <span style={{color:C.gold,fontSize:".9rem"}}>{"★".repeat(r.rating||5)}</span>
              <span style={{color:"#1e293b",fontSize:".9rem"}}>{r.reviewer_name}</span>
              <span style={{color:"rgba(71,85,105,.3)",fontFamily:"inherit",fontSize:".68rem"}}>{fmt(r.review_date)}</span>
              {!r.is_featured&&<span style={{...s.badge("Low"),fontSize:".55rem"}}>Hidden</span>}
            </div>
            <div style={{display:"flex",gap:".4rem"}}>
              <button style={s.btnG} onClick={()=>startEdit(r)}>Edit</button>
              <button style={s.btnGrn} onClick={()=>toggle(r.id,r.is_featured)}>{r.is_featured?"Hide":"Show"}</button>
              <button style={s.btnR} onClick={()=>del(r.id)}>Delete</button>
            </div>
          </div>
          <div style={{padding:".7rem 1.1rem"}}>
            <p style={{color:"rgba(71,85,105,.6)",fontSize:".83rem",lineHeight:1.7,fontStyle:"italic"}}>"{r.review_text?.slice(0,200)}{r.review_text?.length>200?"…":""}"</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  ⑧ QUESTION PAPERS
// ════════════════════════════════════════════════════════════
function PapersSection() {
  const [rows,setRows]=useState([]);
  const [load,setLoad]=useState(true);
  const [form,setForm]=useState({title:"",exam_type:"NVS",class_level:"Class 6",year:"2025",pdf_url:"",sort_order:0});
  const [editing,setEdit]=useState(null);
  const [saving,setSave]=useState(false);

  const SQL=`CREATE TABLE IF NOT EXISTS website_papers (
  id          bigserial primary key,
  title       text not null,
  exam_type   text default 'NVS',
  class_level text default 'Class 6',
  year        text,
  pdf_url     text,
  sort_order  int default 0,
  created_at  timestamptz default now()
);`;

  const load_=useCallback(async()=>{
    setLoad(true);
    const data=await getPapers();
    setRows(data);setLoad(false);
  },[]);
  useEffect(()=>{load_();},[load_]);

  const save=async()=>{
    if(!form.title)return toast("Title required","error");
    setSave(true);
    const{error}=await savePaper(form,editing);
    setSave(false);if(error)return toast("Error: "+error.message,"error");
    toast(editing?"Paper updated ✓":"Paper added ✓");
    setForm({title:"",exam_type:"NVS",class_level:"Class 6",year:"2025",pdf_url:"",sort_order:rows.length});
    setEdit(null);load_();
  };
  const del=async id=>{if(!confirm("Remove paper?"))return;await deletePaper(id);toast("Removed");load_();};
  const startEdit=p=>{setEdit(p.id);setForm({title:p.title,exam_type:p.exam_type||"NVS",class_level:p.class_level||"Class 6",year:p.year||"2025",pdf_url:p.pdf_url||"",sort_order:p.sort_order||0});};

  const grouped=rows.reduce((acc,p)=>{const k=p.exam_type||"NVS";if(!acc[k])acc[k]=[];acc[k].push(p);return acc;},{});

  return (
    <div>
      <div style={{...s.card,borderColor:"rgba(148,163,184,.3)",marginBottom:"1rem"}}>
        <div style={s.cardHd}><span style={s.cardTit}>📋 Setup SQL + Upload Instructions</span></div>
        <div style={s.cardBdy}>
          <pre style={{background:"#0f172a",padding:".8rem",borderRadius:"8px",fontSize:".72rem",color:"#4ade80",overflowX:"auto",lineHeight:1.6,whiteSpace:"pre-wrap",marginBottom:".7rem"}}>{SQL}</pre>
          <button style={{...s.btnG,fontSize:".72rem",marginBottom:"1rem"}} onClick={()=>{navigator.clipboard.writeText(SQL);toast("SQL copied ✓");}}>📋 Copy SQL</button>
          <p style={{color:"rgba(71,85,105,.45)",fontSize:".82rem",lineHeight:1.7}}>📂 Upload PDFs to Supabase Storage: <strong style={{color:C.goldL}}>gnsi-public/papers/</strong> → e.g. <code style={{color:"#16a34a"}}>nvs-class6-2025.pdf</code>, <code style={{color:"#16a34a"}}>sainik-class6-2024.pdf</code></p>
        </div>
      </div>
      <div style={s.card}>
        <div style={s.cardHd}><span style={s.cardTit}>{editing?"✏️ Edit Paper":"📄 Add Paper"}</span>{editing&&<button style={s.btnR} onClick={()=>{setEdit(null);setForm({title:"",exam_type:"NVS",class_level:"Class 6",year:"2025",pdf_url:"",sort_order:0})}}>Cancel</button>}</div>
        <div style={s.cardBdy}>
          <div style={s.g2}>
            <div><label style={s.lbl}>Paper Title *</label><input style={s.inp} placeholder="e.g. JNVST Class 6 — 2025" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}/></div>
            <div style={s.g2}>
              <div><label style={s.lbl}>Exam Type</label><select style={s.sel} value={form.exam_type} onChange={e=>setForm(f=>({...f,exam_type:e.target.value}))}>{["NVS","Sainik","RMS","GNSI Mock"].map(c=><option key={c}>{c}</option>)}</select></div>
              <div><label style={s.lbl}>Class Level</label><select style={s.sel} value={form.class_level} onChange={e=>setForm(f=>({...f,class_level:e.target.value}))}>{["Class 6","Class 9","Class 10"].map(c=><option key={c}>{c}</option>)}</select></div>
            </div>
          </div>
          <div style={s.g2}>
            <div><label style={s.lbl}>Year</label><input style={s.inp} placeholder="2025" value={form.year} onChange={e=>setForm(f=>({...f,year:e.target.value}))}/></div>
            <div><label style={s.lbl}>PDF URL (Supabase Storage)</label><input style={s.inp} placeholder="https://…/gnsi-public/papers/nvs-class6-2025.pdf" value={form.pdf_url} onChange={e=>setForm(f=>({...f,pdf_url:e.target.value}))}/></div>
          </div>
          <button style={{...s.btnG,opacity:saving?.6:1}} onClick={save} disabled={saving}>{saving?"Saving…":editing?"Update Paper":"Add Paper →"}</button>
        </div>
      </div>
      {load?<div style={s.loading}><Spin/>Loading…</div>:!rows.length?<div style={s.empty}>No papers yet</div>:Object.entries(grouped).map(([exam,papers])=>(
        <div key={exam} style={s.card}>
          <div style={s.cardHd}><span style={s.cardTit}>{exam} Papers ({papers.length})</span></div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:".83rem"}}>
              <thead><tr>{["Title","Class","Year","PDF Link",""].map(h=><th key={h} style={{background:"rgba(226,232,240,.6)",padding:".55rem .9rem",textAlign:"left",fontFamily:"inherit",fontWeight:700,fontSize:".64rem",letterSpacing:"0",textTransform:"none",color:C.goldL,borderBottom:"1px solid rgba(148,163,184,.12)"}}>{h}</th>)}</tr></thead>
              <tbody>{papers.map(p=>(
                <tr key={p.id}>
                  <td style={{padding:".55rem .9rem",borderBottom:"1px solid rgba(148,163,184,.06)",color:"rgba(71,85,105,.82)"}}>{p.title}</td>
                  <td style={{padding:".55rem .9rem",borderBottom:"1px solid rgba(148,163,184,.06)",color:"rgba(71,85,105,.5)",fontSize:".78rem"}}>{p.class_level}</td>
                  <td style={{padding:".55rem .9rem",borderBottom:"1px solid rgba(148,163,184,.06)",color:C.goldL,fontFamily:"inherit",fontWeight:600}}>{p.year}</td>
                  <td style={{padding:".55rem .9rem",borderBottom:"1px solid rgba(148,163,184,.06)"}}>{p.pdf_url?<a href={p.pdf_url} target="_blank" rel="noopener noreferrer" style={{color:"#16a34a",fontFamily:"inherit",fontSize:".72rem"}}>⬇ Download</a>:<span style={{color:"rgba(71,85,105,.25)",fontSize:".72rem"}}>No URL set</span>}</td>
                  <td style={{padding:".55rem .9rem",borderBottom:"1px solid rgba(148,163,184,.06)"}}><div style={{display:"flex",gap:".4rem"}}><button style={s.btnG} onClick={()=>startEdit(p)}>Edit</button><button style={s.btnR} onClick={()=>del(p.id)}>Del</button></div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  ⑨ RESULT BANNERS
// ════════════════════════════════════════════════════════════
function BannersSection() {
  const [rows,setRows]=useState([]);
  const [load,setLoad]=useState(true);
  const [form,setForm]=useState({title:"",subtitle:"",year_label:"",image_url:"",sort_order:0,is_active:true});
  const [editing,setEdit]=useState(null);
  const [saving,setSave]=useState(false);

  const SQL=`CREATE TABLE IF NOT EXISTS website_result_banners (
  id          bigserial primary key,
  title       text not null,
  subtitle    text,
  year_label  text,
  image_url   text,
  sort_order  int default 0,
  is_active   boolean default true,
  created_at  timestamptz default now()
);`;

  const load_=useCallback(async()=>{
    setLoad(true);
    const data=await getAllBanners();
    setRows(data);setLoad(false);
  },[]);
  useEffect(()=>{load_();},[load_]);

  const save=async()=>{
    if(!form.title)return toast("Title required","error");
    setSave(true);
    const{error}=await saveBanner(form,editing);
    setSave(false);if(error)return toast("Error: "+error.message,"error");
    toast(editing?"Banner updated ✓":"Banner added ✓");
    setForm({title:"",subtitle:"",year_label:"",image_url:"",sort_order:rows.length,is_active:true});
    setEdit(null);load_();
  };
  const toggle=async(id,cur)=>{await toggleBannerActive(id,cur);toast(cur?"Hidden":"Active ✓");load_();};
  const del=async id=>{if(!confirm("Delete banner?"))return;await deleteBanner(id);toast("Deleted");load_();};
  const startEdit=b=>{setEdit(b.id);setForm({title:b.title,subtitle:b.subtitle||"",year_label:b.year_label||"",image_url:b.image_url||"",sort_order:b.sort_order||0,is_active:b.is_active!==false});};

  return (
    <div>
      <div style={{...s.card,borderColor:"rgba(148,163,184,.3)",marginBottom:"1rem"}}>
        <div style={s.cardHd}><span style={s.cardTit}>📋 Setup SQL</span></div>
        <div style={s.cardBdy}>
          <pre style={{background:"#0f172a",padding:".8rem",borderRadius:"8px",fontSize:".72rem",color:"#4ade80",overflowX:"auto",lineHeight:1.6,whiteSpace:"pre-wrap",marginBottom:".7rem"}}>{SQL}</pre>
          <button style={{...s.btnG,fontSize:".72rem"}} onClick={()=>{navigator.clipboard.writeText(SQL);toast("SQL copied ✓");}}>📋 Copy SQL</button>
          <p style={{color:"rgba(71,85,105,.45)",fontSize:".82rem",lineHeight:1.7,marginTop:".7rem"}}>📸 Upload celebration/result photos to <strong style={{color:C.goldL}}>gnsi-public/banners/</strong> in Supabase Storage. Recommended size: 1200×400px landscape.</p>
        </div>
      </div>
      <div style={s.card}>
        <div style={s.cardHd}><span style={s.cardTit}>{editing?"✏️ Edit Banner":"🎉 Add Result Banner"}</span>{editing&&<button style={s.btnR} onClick={()=>{setEdit(null);setForm({title:"",subtitle:"",year_label:"",image_url:"",sort_order:0,is_active:true})}}>Cancel</button>}</div>
        <div style={s.cardBdy}>
          <div style={s.g2}>
            <div><label style={s.lbl}>Banner Title *</label><input style={s.inp} placeholder="e.g. GNSI's Best Year — 66 Students Selected" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}/></div>
            <div><label style={s.lbl}>Year Label</label><input style={s.inp} placeholder="e.g. 🏆 Result 2025–26" value={form.year_label} onChange={e=>setForm(f=>({...f,year_label:e.target.value}))}/></div>
          </div>
          <label style={s.lbl}>Subtitle</label>
          <input style={s.inp} placeholder="e.g. NVS Jawahar Navodaya · Sainik School · RMS · Across Manipur" value={form.subtitle} onChange={e=>setForm(f=>({...f,subtitle:e.target.value}))}/>
          <ImageUploadField label="Background Image" folder="banners" previewSize={140} allowMultiple value={form.image_url} onChange={url=>setForm(f=>({...f,image_url:url}))}/>
          <div style={{display:"flex",gap:".8rem",alignItems:"center"}}>
            <button style={{...s.btnG,opacity:saving?.6:1}} onClick={save} disabled={saving}>{saving?"Saving…":editing?"Update Banner":"Add Banner →"}</button>
            <label style={{display:"flex",alignItems:"center",gap:".4rem",cursor:"pointer",fontFamily:"inherit",fontSize:".75rem",color:"rgba(71,85,105,.5)"}}>
              <input type="checkbox" checked={form.is_active} onChange={e=>setForm(f=>({...f,is_active:e.target.checked}))}/> Active on website
            </label>
          </div>
        </div>
      </div>
      {load?<div style={s.loading}><Spin/>Loading…</div>:!rows.length?<div style={s.empty}>No banners yet — add your first result celebration banner</div>:rows.map(b=>(
        <div key={b.id} style={{...s.card,opacity:b.is_active?1:.5}}>
          <div style={s.cardHd}>
            <div style={{display:"flex",alignItems:"center",gap:".7rem",flexWrap:"wrap"}}>
              {!b.is_active&&<span style={{...s.badge("Low"),fontSize:".55rem"}}>Hidden</span>}
              <span style={{color:C.goldL,fontFamily:"inherit",fontSize:".72rem"}}>{b.year_label}</span>
              <span style={{color:"#1e293b",fontFamily:"inherit",fontSize:"1rem"}}>{b.title}</span>
            </div>
            <div style={{display:"flex",gap:".4rem"}}>
              <button style={s.btnG} onClick={()=>startEdit(b)}>Edit</button>
              <button style={s.btnGrn} onClick={()=>toggle(b.id,b.is_active)}>{b.is_active?"Hide":"Show"}</button>
              <button style={s.btnR} onClick={()=>del(b.id)}>Delete</button>
            </div>
          </div>
          {b.image_url&&<div style={{height:"100px",overflow:"hidden"}}><img src={b.image_url} alt={b.title} style={{width:"100%",height:"100%",objectFit:"cover",opacity:.6}} onError={e=>e.target.style.display="none"}/></div>}
          <div style={{padding:".6rem 1.1rem"}}>
            <p style={{color:"rgba(71,85,105,.45)",fontSize:".82rem"}}>{b.subtitle}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  ⑩ FACULTY
// ════════════════════════════════════════════════════════════
// Bulk faculty photo helpers: turn "m-himan-singh_2.jpg" into
// "M Himan Singh" and compare names ignoring case, spaces and punctuation.
const fileStemToName = (fileName) =>
  (fileName || "").replace(/\.[^.]+$/, "").replace(/[_\-.]+/g, " ").replace(/\s*\d+\s*$/, "")
    .replace(/\s+/g, " ").trim().replace(/\b\w/g, c => c.toUpperCase());
const normName = (str) => (str || "").toLowerCase().replace(/[^a-z]/g, "");
function matchFacultyByFileName(fileName, rows) {
  const stem = normName(fileStemToName(fileName));
  if (!stem) return null;
  const exact = rows.find(r => normName(r.name) === stem);
  if (exact) return exact.id;
  // Partial: every word of the file name appears in the staff name (e.g. "himan.jpg" → "Moirangthem Himan Singh")
  const words = fileStemToName(fileName).toLowerCase().split(" ").filter(w => w.length > 2);
  const partial = rows.filter(r => {
    const n = (r.name || "").toLowerCase();
    return words.length && words.every(w => n.includes(w));
  });
  return partial.length === 1 ? partial[0].id : null; // only auto-pick when unambiguous
}

function FacultySection() {
  const [rows,setRows]=useState([]);
  const [load,setLoad]=useState(true);
  const [form,setForm]=useState({name:"",role:"",subject:"",experience:"",photo_url:"",sort_order:0});
  const [editing,setEdit]=useState(null);
  const [saving,setSave]=useState(false);

  const load_=useCallback(async()=>{
    setLoad(true);
    const data=await getFaculty();
    setRows(data);setLoad(false);
  },[]);
  useEffect(()=>{load_();},[load_]);

  const save=async()=>{
    if(!form.name||!form.role)return toast("Name and role required","error");
    setSave(true);
    const{error}=await saveFaculty(form,editing);
    setSave(false);if(error)return toast("Error: "+error.message,"error");
    toast(editing?"Updated ✓":"Added ✓");
    setForm({name:"",role:"",subject:"",experience:"",photo_url:"",sort_order:rows.length});
    setEdit(null);load_();
  };
  const del=async id=>{if(!confirm("Remove faculty?"))return;await deleteFaculty(id);toast("Removed");load_();};

  // ── Bulk photo upload ──
  // Pick many photos at once. Each is compressed + uploaded, then matched
  // to a faculty member by file name (e.g. "Himan Singh.jpg"). Review the
  // matches, change any, add unmatched ones as new faculty, then Save All.
  const bulkRef=useRef(null);
  const [bulkBusy,setBulkBusy]=useState(false);
  const [bulkProg,setBulkProg]=useState({done:0,total:0});
  const [bulkItems,setBulkItems]=useState([]); // {key,url,fileName,assign:"<id>"|"new"|"skip",newName,newRole}
  const [bulkSaving,setBulkSaving]=useState(false);

  const handleBulkFaculty=async(e)=>{
    const files=Array.from(e.target.files||[]);
    e.target.value="";
    if(!files.length)return;
    setBulkBusy(true);setBulkProg({done:0,total:files.length});
    const items=[];let fail=0;
    for(const file of files){
      if(!file.type?.startsWith("image/")||file.size>30*1024*1024){fail++;setBulkProg(p=>({...p,done:p.done+1}));continue;}
      const toUpload=await compressImage(file);
      const{url,error}=await uploadWebsiteImage(toUpload,"faculty");
      if(url&&!error){
        const match=matchFacultyByFileName(file.name,rows);
        items.push({key:url,url,fileName:file.name,assign:match?String(match):"new",newName:/^(img|dsc|pxl|photo|image|whatsapp|screenshot|camera)\b/i.test(fileStemToName(file.name))?"":fileStemToName(file.name),newRole:"Teaching Faculty"});
      }else fail++;
      setBulkProg(p=>({...p,done:p.done+1}));
    }
    setBulkBusy(false);
    setBulkItems(prev=>[...prev,...items]);
    if(items.length)toast(`${items.length} photo${items.length>1?"s":""} uploaded ✓ — check matches below`);
    if(fail)toast(`${fail} file${fail>1?"s":""} failed to upload`,"error");
  };
  const setItem=(key,patch)=>setBulkItems(list=>list.map(it=>it.key===key?{...it,...patch}:it));

  const saveBulk=async()=>{
    const todo=bulkItems.filter(it=>it.assign!=="skip");
    if(!todo.length){setBulkItems([]);return;}
    const ids=todo.filter(it=>it.assign!=="new").map(it=>it.assign);
    if(new Set(ids).size!==ids.length)return toast("Two photos are assigned to the same person — fix before saving","error");
    if(todo.some(it=>it.assign==="new"&&(!it.newName.trim()||!it.newRole.trim())))return toast("New faculty need a name and role","error");
    setBulkSaving(true);
    let ok=0,fail=0,order=rows.length;
    for(const it of todo){
      const{error}=it.assign==="new"
        ?await saveFaculty({name:it.newName.trim(),role:it.newRole.trim(),subject:"",experience:"",photo_url:it.url,sort_order:order++},null)
        :await saveFaculty({photo_url:it.url},Number(it.assign));
      if(error)fail++;else ok++;
    }
    setBulkSaving(false);
    toast(`${ok} saved${fail?`, ${fail} failed`:""} ✓`,fail&&!ok?"error":"success");
    if(!fail)setBulkItems([]);
    load_();
  };
  const startEdit=f=>{setEdit(f.id);setForm({name:f.name,role:f.role,subject:f.subject||"",experience:f.experience||"",photo_url:f.photo_url||"",sort_order:f.sort_order||0});};

  return (
    <div>
      <div style={{...s.card,borderLeft:`4px solid ${C.gold}`}}>
        <div style={s.cardHd}><span style={s.cardTit}>📚 Bulk Upload Staff Photos</span></div>
        <div style={s.cardBdy}>
          <input ref={bulkRef} type="file" accept="image/*" multiple onChange={handleBulkFaculty} style={{display:"none"}}/>
          <button style={{...s.btnG,opacity:bulkBusy?.6:1}} onClick={()=>bulkRef.current?.click()} disabled={bulkBusy||bulkSaving}>
            {bulkBusy
              ?<span style={{display:"flex",alignItems:"center",gap:".4rem"}}><Spin/>Uploading {bulkProg.done}/{bulkProg.total}…</span>
              :"Select Multiple Photos →"}
          </button>
          <div style={{fontSize:".72rem",color:"#64748b",marginTop:".5rem"}}>
            Tip: name each file after the staff member (e.g. <b>Himan Singh.jpg</b>) and it will be matched automatically. Anything unmatched can be assigned below or added as new faculty.
          </div>

          {bulkItems.length>0&&(
            <div style={{marginTop:"1rem"}}>
              {bulkItems.map(it=>(
                <div key={it.key} style={{display:"flex",gap:".8rem",alignItems:"center",flexWrap:"wrap",padding:".6rem 0",borderTop:"1px solid rgba(148,163,184,.2)"}}>
                  <img src={it.url} alt="" style={{width:"56px",height:"56px",borderRadius:"50%",objectFit:"cover",border:`2px solid ${C.gold}`,flexShrink:0}}/>
                  <div style={{flex:"1 1 220px",minWidth:0}}>
                    <div style={{fontSize:".72rem",color:"#64748b",marginBottom:".3rem",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{it.fileName}</div>
                    <select style={{...s.sel,marginBottom:it.assign==="new"?".5rem":0}} value={it.assign} onChange={e=>setItem(it.key,{assign:e.target.value})}>
                      <option value="new">➕ Add as new faculty</option>
                      <option value="skip">✕ Skip this photo</option>
                      {rows.map(r=><option key={r.id} value={String(r.id)}>{r.name}{r.photo_url?" (replace photo)":""}</option>)}
                    </select>
                    {it.assign==="new"&&(
                      <div style={s.g2}>
                        <input style={{...s.inp,marginBottom:0}} placeholder="Full name *" value={it.newName} onChange={e=>setItem(it.key,{newName:e.target.value})}/>
                        <input style={{...s.inp,marginBottom:0}} placeholder="Role *" value={it.newRole} onChange={e=>setItem(it.key,{newRole:e.target.value})}/>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div style={{display:"flex",gap:".5rem",marginTop:".8rem",flexWrap:"wrap"}}>
                <button style={{...s.btnG,opacity:bulkSaving?.6:1}} onClick={saveBulk} disabled={bulkSaving||bulkBusy}>{bulkSaving?"Saving…":`Save All (${bulkItems.filter(i=>i.assign!=="skip").length}) →`}</button>
                <button style={s.btnR} onClick={()=>setBulkItems([])} disabled={bulkSaving}>Clear</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={s.card}>
        <div style={s.cardHd}><span style={s.cardTit}>{editing?"✏️ Edit Faculty":"➕ Add Faculty"}</span>{editing&&<button style={s.btnR} onClick={()=>{setEdit(null);setForm({name:"",role:"",subject:"",experience:"",photo_url:"",sort_order:0})}}>Cancel</button>}</div>
        <div style={s.cardBdy}>
          <div style={s.g2}>
            <div><label style={s.lbl}>Full Name *</label><input style={s.inp} placeholder="e.g. Moirangthem Himan Singh" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></div>
            <div><label style={s.lbl}>Role / Designation *</label><input style={s.inp} placeholder="e.g. Founder & Administrator" value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}/></div>
          </div>
          <div style={s.g2}>
            <div><label style={s.lbl}>Subject / Department</label><input style={s.inp} placeholder="e.g. Mathematics · Strategic Leadership" value={form.subject} onChange={e=>setForm(f=>({...f,subject:e.target.value}))}/></div>
            <div><label style={s.lbl}>Experience</label><input style={s.inp} placeholder="e.g. 10+ Years · Est. GNSI 2016" value={form.experience} onChange={e=>setForm(f=>({...f,experience:e.target.value}))}/></div>
          </div>
          <ImageUploadField label="Photo" folder="faculty" round previewSize={80} allowMultiple value={form.photo_url} onChange={url=>setForm(f=>({...f,photo_url:url}))}/>
          <button style={{...s.btnG,opacity:saving?.6:1}} onClick={save} disabled={saving}>{saving?"Saving…":editing?"Update Faculty":"Add to Website →"}</button>
        </div>
      </div>
      {load?<div style={s.loading}><Spin/>Loading…</div>:!rows.length?<div style={s.empty}>No faculty added yet</div>:(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:".8rem"}}>
          {rows.map(f=>(
            <div key={f.id} style={{...s.card,marginBottom:0}}>
              <div style={{padding:"1.1rem",textAlign:"center"}}>
                {f.photo_url?<img src={f.photo_url} alt={f.name} style={{width:"70px",height:"70px",borderRadius:"50%",objectFit:"cover",border:`2px solid ${C.gold}`,margin:"0 auto .8rem"}} onError={e=>e.target.style.display="none"}/>
                :<div style={{width:"70px",height:"70px",borderRadius:"50%",background:C.navy,border:`2px solid ${C.gold}`,margin:"0 auto .8rem",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit",fontWeight:700,fontSize:"1.5rem",color:"#ffffff"}}>{(f.name||"F").split(" ").map(w=>w[0]).join("").slice(0,2)}</div>}
                <div style={{color:"#1e293b",fontFamily:"inherit",fontSize:"1rem",marginBottom:".2rem"}}>{f.name}</div>
                <div style={{color:C.goldL,fontSize:".72rem",fontFamily:"inherit",letterSpacing:"0",textTransform:"none",marginBottom:".2rem"}}>{f.role}</div>
                {f.subject&&<div style={{color:"rgba(71,85,105,.45)",fontSize:".78rem",marginBottom:".15rem"}}>{f.subject}</div>}
                {f.experience&&<div style={{color:"rgba(71,85,105,.28)",fontSize:".68rem",fontFamily:"inherit"}}>{f.experience}</div>}
              </div>
              <div style={{padding:".6rem",borderTop:"1px solid rgba(148,163,184,.1)",display:"flex",gap:".5rem",justifyContent:"center"}}>
                <button style={s.btnG} onClick={()=>startEdit(f)}>Edit</button>
                <button style={s.btnR} onClick={()=>del(f.id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  ⑪ TESTIMONIALS (What Parents Say slider)
// ════════════════════════════════════════════════════════════
function TestimonialsSection() {
  const [rows,setRows]=useState([]);
  const [load,setLoad]=useState(true);
  const [form,setForm]=useState({quote:"",attribution:"Parent",rating:5,is_featured:true,sort_order:0});
  const [editing,setEdit]=useState(null);
  const [saving,setSave]=useState(false);

  const load_=useCallback(async()=>{
    setLoad(true);
    const data=await getAllTestimonials();
    setRows(data);setLoad(false);
  },[]);
  useEffect(()=>{load_();},[load_]);

  const save=async()=>{
    if(!form.quote)return toast("Quote text is required","error");
    setSave(true);
    const{error}=await saveTestimonial(form,editing);
    setSave(false);if(error)return toast("Error: "+error.message,"error");
    toast(editing?"Updated ✓":"Added ✓");
    setForm({quote:"",attribution:"Parent",rating:5,is_featured:true,sort_order:rows.length});
    setEdit(null);load_();
  };
  const del=async id=>{if(!confirm("Remove testimonial?"))return;await deleteTestimonial(id);toast("Removed");load_();};
  const startEdit=t=>{setEdit(t.id);setForm({quote:t.quote||"",attribution:t.attribution||"Parent",rating:t.rating||5,is_featured:!!t.is_featured,sort_order:t.sort_order||0});};
  const toggleFeat=async(id,current)=>{await toggleTestimonialFeatured(id,current);toast(current?"Removed from featured":"Featured on homepage ✓");load_();};

  return (
    <div>
      <div style={s.card}>
        <div style={s.cardHd}><span style={s.cardTit}>{editing?"✏️ Edit Testimonial":"➕ Add Testimonial"}</span>{editing&&<button style={s.btnR} onClick={()=>{setEdit(null);setForm({quote:"",attribution:"Parent",rating:5,is_featured:true,sort_order:0})}}>Cancel</button>}</div>
        <div style={s.cardBdy}>
          <label style={s.lbl}>Quote *</label>
          <textarea style={s.ta} placeholder="What the parent said about GNSI…" value={form.quote} onChange={e=>setForm(f=>({...f,quote:e.target.value}))} rows={3}/>
          <div style={s.g3}>
            <div><label style={s.lbl}>Attribution</label><input style={s.inp} placeholder="e.g. Parent, Class 8" value={form.attribution} onChange={e=>setForm(f=>({...f,attribution:e.target.value}))}/></div>
            <div><label style={s.lbl}>Rating (1–5)</label><input style={s.inp} type="number" min={1} max={5} value={form.rating} onChange={e=>setForm(f=>({...f,rating:Number(e.target.value)}))}/></div>
            <div><label style={s.lbl}>Sort Order</label><input style={s.inp} type="number" value={form.sort_order} onChange={e=>setForm(f=>({...f,sort_order:Number(e.target.value)}))}/></div>
          </div>
          <label style={{...s.lbl,display:"flex",alignItems:"center",gap:".5rem",cursor:"pointer"}}>
            <input type="checkbox" checked={form.is_featured} onChange={e=>setForm(f=>({...f,is_featured:e.target.checked}))}/> Show on homepage (featured)
          </label>
          <button style={{...s.btnG,opacity:saving?.6:1,marginTop:".5rem"}} onClick={save} disabled={saving}>{saving?"Saving…":editing?"Update Testimonial":"Add Testimonial →"}</button>
        </div>
      </div>
      {load?<div style={s.loading}><Spin/>Loading…</div>:!rows.length?<div style={s.empty}>No testimonials added yet</div>:(
        rows.map(t=>(
          <div key={t.id} style={s.card}>
            <div style={s.cardBdy}>
              <p style={{color:"#1e293b",fontStyle:"italic",lineHeight:1.7,marginBottom:".6rem"}}>&ldquo;{t.quote}&rdquo;</p>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:".5rem"}}>
                <div>
                  <span style={{color:C.goldL,fontFamily:"inherit",fontWeight:700,fontSize:".78rem",letterSpacing:"0",textTransform:"none"}}>{t.attribution}</span>
                  <span style={{color:C.gold,marginLeft:".6rem"}}>{"★".repeat(t.rating||5)}</span>
                </div>
                <div style={{display:"flex",gap:".5rem"}}>
                  <button style={t.is_featured?s.btnGrn:s.btnN} onClick={()=>toggleFeat(t.id,t.is_featured)}>{t.is_featured?"★ Featured":"Feature it"}</button>
                  <button style={s.btnG} onClick={()=>startEdit(t)}>Edit</button>
                  <button style={s.btnR} onClick={()=>del(t.id)}>Remove</button>
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  ⑫ EXAM CALENDAR
// ════════════════════════════════════════════════════════════
function ExamCalendarSection() {
  const [rows,setRows]=useState([]);
  const [load,setLoad]=useState(true);
  const blank={exam_name:"",sub_label:"",exam_type:"NVS",application_opens:"",application_closes:"",exam_date:"",exam_date_sort:"",result_date:"",status:"Upcoming",sort_order:0};
  const [form,setForm]=useState(blank);
  const [editing,setEdit]=useState(null);
  const [saving,setSave]=useState(false);

  const load_=useCallback(async()=>{
    setLoad(true);
    const data=await getExamCalendar();
    setRows(data);setLoad(false);
  },[]);
  useEffect(()=>{load_();},[load_]);

  const save=async()=>{
    if(!form.exam_name)return toast("Exam name is required","error");
    setSave(true);
    const{error}=await saveExamCalendarRow(form,editing);
    setSave(false);if(error)return toast("Error: "+error.message,"error");
    toast(editing?"Updated ✓":"Added ✓");
    setForm({...blank,sort_order:rows.length});
    setEdit(null);load_();
  };
  const del=async id=>{if(!confirm("Remove this exam calendar row?"))return;await deleteExamCalendarRow(id);toast("Removed");load_();};
  const startEdit=r=>{setEdit(r.id);setForm({exam_name:r.exam_name||"",sub_label:r.sub_label||"",exam_type:r.exam_type||"NVS",application_opens:r.application_opens||"",application_closes:r.application_closes||"",exam_date:r.exam_date||"",exam_date_sort:r.exam_date_sort||"",result_date:r.result_date||"",status:r.status||"Upcoming",sort_order:r.sort_order||0});};

  return (
    <div>
      <div style={s.card}>
        <div style={s.cardHd}><span style={s.cardTit}>{editing?"✏️ Edit Exam Row":"➕ Add Exam Calendar Row"}</span>{editing&&<button style={s.btnR} onClick={()=>{setEdit(null);setForm(blank)}}>Cancel</button>}</div>
        <div style={s.cardBdy}>
          <div style={s.g2}>
            <div><label style={s.lbl}>Exam Name *</label><input style={s.inp} placeholder="e.g. Navodaya Vidyalaya (Class VI)" value={form.exam_name} onChange={e=>setForm(f=>({...f,exam_name:e.target.value}))}/></div>
            <div><label style={s.lbl}>Sub-label (optional)</label><input style={s.inp} placeholder="e.g. JNVST 2027" value={form.sub_label} onChange={e=>setForm(f=>({...f,sub_label:e.target.value}))}/></div>
          </div>
          <div style={s.g3}>
            <div>
              <label style={s.lbl}>Exam Type</label>
              <select style={s.sel} value={form.exam_type} onChange={e=>setForm(f=>({...f,exam_type:e.target.value}))}>
                <option value="NVS">NVS</option>
                <option value="Sainik">Sainik</option>
                <option value="RMS">RMS</option>
                <option value="GNSI">GNSI</option>
              </select>
            </div>
            <div>
              <label style={s.lbl}>Status</label>
              <select style={s.sel} value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                <option value="Upcoming">Upcoming</option>
                <option value="Open">Open</option>
                <option value="Closed">Closed</option>
                <option value="Done">Done</option>
              </select>
            </div>
            <div><label style={s.lbl}>Sort Order</label><input style={s.inp} type="number" value={form.sort_order} onChange={e=>setForm(f=>({...f,sort_order:Number(e.target.value)}))}/></div>
          </div>
          <div style={s.g2}>
            <div><label style={s.lbl}>Application Opens</label><input style={s.inp} placeholder="e.g. 1 Aug 2026" value={form.application_opens} onChange={e=>setForm(f=>({...f,application_opens:e.target.value}))}/></div>
            <div><label style={s.lbl}>Application Closes</label><input style={s.inp} placeholder="e.g. 30 Sep 2026" value={form.application_closes} onChange={e=>setForm(f=>({...f,application_closes:e.target.value}))}/></div>
          </div>
          <div style={s.g3}>
            <div><label style={s.lbl}>Exam Date (display text)</label><input style={s.inp} placeholder="e.g. 14 Dec 2026" value={form.exam_date} onChange={e=>setForm(f=>({...f,exam_date:e.target.value}))}/></div>
            <div><label style={s.lbl}>Exam Date (sort key, YYYY-MM-DD)</label><input style={s.inp} type="date" value={form.exam_date_sort} onChange={e=>setForm(f=>({...f,exam_date_sort:e.target.value}))}/></div>
            <div><label style={s.lbl}>Result Date</label><input style={s.inp} placeholder="e.g. Mar 2027" value={form.result_date} onChange={e=>setForm(f=>({...f,result_date:e.target.value}))}/></div>
          </div>
          <button style={{...s.btnG,opacity:saving?.6:1}} onClick={save} disabled={saving}>{saving?"Saving…":editing?"Update Row":"Add to Calendar →"}</button>
        </div>
      </div>
      {load?<div style={s.loading}><Spin/>Loading…</div>:!rows.length?<div style={s.empty}>No exam calendar rows yet</div>:(
        <div style={s.card}>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:".82rem"}}>
              <thead>
                <tr style={{borderBottom:"1px solid rgba(148,163,184,.2)"}}>
                  {["Exam","Type","Opens","Closes","Exam Date","Result","Status",""].map(h=>(
                    <th key={h} style={{textAlign:"left",padding:".6rem .7rem",color:C.goldL,fontFamily:"inherit",fontWeight:700,fontSize:".68rem",letterSpacing:"0",textTransform:"none"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r=>(
                  <tr key={r.id} style={{borderBottom:"1px solid rgba(148,163,184,.07)"}}>
                    <td style={{padding:".6rem .7rem",color:"#1e293b"}}>{r.exam_name}{r.sub_label&&<div style={{color:C.mist,fontSize:".72rem"}}>{r.sub_label}</div>}</td>
                    <td style={{padding:".6rem .7rem"}}><span style={s.badge()}>{r.exam_type}</span></td>
                    <td style={{padding:".6rem .7rem",color:"rgba(71,85,105,.6)"}}>{r.application_opens}</td>
                    <td style={{padding:".6rem .7rem",color:"rgba(71,85,105,.6)"}}>{r.application_closes}</td>
                    <td style={{padding:".6rem .7rem",color:"#1e293b",fontWeight:700}}>{r.exam_date}</td>
                    <td style={{padding:".6rem .7rem",color:"rgba(71,85,105,.6)"}}>{r.result_date}</td>
                    <td style={{padding:".6rem .7rem"}}>{r.status}</td>
                    <td style={{padding:".6rem .7rem",display:"flex",gap:".4rem"}}>
                      <button style={s.btnG} onClick={()=>startEdit(r)}>Edit</button>
                      <button style={s.btnR} onClick={()=>del(r.id)}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  ⑬ IMPORTANT DATES TIMELINE
// ════════════════════════════════════════════════════════════
function TimelineSection() {
  const [rows,setRows]=useState([]);
  const [load,setLoad]=useState(true);
  const blank={title:"",description:"",event_date:new Date().toISOString().slice(0,10),status:"upcoming",tag_html:"",sort_order:0};
  const [form,setForm]=useState(blank);
  const [editing,setEdit]=useState(null);
  const [saving,setSave]=useState(false);

  const load_=useCallback(async()=>{
    setLoad(true);
    const data=await getTimeline();
    setRows(data);setLoad(false);
  },[]);
  useEffect(()=>{load_();},[load_]);

  const save=async()=>{
    if(!form.title)return toast("Title is required","error");
    setSave(true);
    const{error}=await saveTimelineItem(form,editing);
    setSave(false);if(error)return toast("Error: "+error.message,"error");
    toast(editing?"Updated ✓":"Added ✓");
    setForm({...blank,sort_order:rows.length});
    setEdit(null);load_();
  };
  const del=async id=>{if(!confirm("Remove this timeline item?"))return;await deleteTimelineItem(id);toast("Removed");load_();};
  const startEdit=t=>{setEdit(t.id);setForm({title:t.title||"",description:t.description||"",event_date:t.event_date||new Date().toISOString().slice(0,10),status:t.status||"upcoming",tag_html:t.tag_html||"",sort_order:t.sort_order||0});};

  return (
    <div>
      <div style={s.card}>
        <div style={s.cardHd}><span style={s.cardTit}>{editing?"✏️ Edit Timeline Item":"➕ Add Timeline Item"}</span>{editing&&<button style={s.btnR} onClick={()=>{setEdit(null);setForm(blank)}}>Cancel</button>}</div>
        <div style={s.cardBdy}>
          <label style={s.lbl}>Title *</label>
          <input style={s.inp} placeholder="e.g. Scholarship Test Registration Opens" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}/>
          <label style={s.lbl}>Description</label>
          <textarea style={s.ta} placeholder="1–2 line description shown under the title" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} rows={2}/>
          <div style={s.g3}>
            <div><label style={s.lbl}>Date</label><input style={s.inp} type="date" value={form.event_date} onChange={e=>setForm(f=>({...f,event_date:e.target.value}))}/></div>
            <div>
              <label style={s.lbl}>Status</label>
              <select style={s.sel} value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                <option value="upcoming">Upcoming</option>
                <option value="open">Open</option>
                <option value="done">Done</option>
              </select>
            </div>
            <div><label style={s.lbl}>Sort Order</label><input style={s.inp} type="number" value={form.sort_order} onChange={e=>setForm(f=>({...f,sort_order:Number(e.target.value)}))}/></div>
          </div>
          <button style={{...s.btnG,opacity:saving?.6:1}} onClick={save} disabled={saving}>{saving?"Saving…":editing?"Update Item":"Add to Timeline →"}</button>
        </div>
      </div>
      {load?<div style={s.loading}><Spin/>Loading…</div>:!rows.length?<div style={s.empty}>No timeline items yet</div>:(
        rows.map(t=>(
          <div key={t.id} style={s.row}>
            <div>
              <strong style={{color:"#1e293b"}}>{fmt(t.event_date)}</strong> — {t.title}
              {t.description&&<div style={{color:"rgba(71,85,105,.45)",fontSize:".8rem",marginTop:".2rem"}}>{t.description}</div>}
              <span style={s.badge(t.status==="done"?"Low":t.status==="open"?"High":undefined)}>{t.status}</span>
            </div>
            <div style={{display:"flex",gap:".4rem"}}>
              <button style={s.btnG} onClick={()=>startEdit(t)}>Edit</button>
              <button style={s.btnR} onClick={()=>del(t.id)}>Remove</button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  ⑭ SITE SETTINGS
// ════════════════════════════════════════════════════════════
function SettingsSection() {
  const [cfg,setCfg]=useState({});
  const [load,setLoad]=useState(true);
  const [saving,setSave]=useState(false);

  const KEYS=[
    // Admission
    {key:"admission_deadline",  label:"Admission Deadline Date",     type:"text",    ph:"30 June 2026",       group:"Admissions"},
    {key:"batch_start_date",    label:"Batch Start Date",            type:"text",    ph:"1 July 2026",        group:"Admissions"},
    {key:"brochure_url",        label:"Brochure PDF URL",            type:"text",    ph:"https://…/GNSI-Brochure-2026.pdf", group:"Admissions"},
    // Fee
    {key:"upi_id",              label:"UPI ID for Fee Payment",      type:"text",    ph:"gnsikhangabok@upi",  group:"Fee Payment"},
    {key:"upi_qr_url",          label:"UPI QR Code Image URL",       type:"text",    ph:"https://…/gnsi-public/upi-qr.png", group:"Fee Payment"},
    {key:"bank_name",           label:"Bank Name",                   type:"text",    ph:"State Bank of India",group:"Fee Payment"},
    {key:"account_holder_name", label:"Account Holder Name",         type:"text",    ph:"GNSI Khangabok",     group:"Fee Payment"},
    {key:"account_number",      label:"Account Number",              type:"text",    ph:"XXXXXXXXXX",         group:"Fee Payment"},
    {key:"ifsc_code",           label:"IFSC Code",                   type:"text",    ph:"SBIN0XXXXXX",        group:"Fee Payment"},
    {key:"branch_name",         label:"Branch Name",                 type:"text",    ph:"Thoubal Branch",     group:"Fee Payment"},
    // Stats
    {key:"students_trained",       label:"Students Trained",         type:"text",    ph:"500+",               group:"Homepage Stats"},
    {key:"students_selected",      label:"Students Selected",        type:"text",    ph:"200+",               group:"Homepage Stats"},
    {key:"years_of_excellence",    label:"Years of Excellence",      type:"text",    ph:"10+",                group:"Homepage Stats"},
    {key:"selection_rate",         label:"Selection Rate",           type:"text",    ph:"95%",                group:"Homepage Stats"},
    {key:"selected_current_year",  label:"Selected Last Batch",      type:"text",    ph:"66",                 group:"Homepage Stats"},
    {key:"selected_current_year_label", label:"Selected Last Batch Label", type:"text", ph:"Selected 2025–26",  group:"Homepage Stats"},
    // Results page — "Selections & Achievements" stat cards (4 cards)
    {key:"ach1_value", label:"Card 1 · Number", type:"text", ph:"66", group:"Results & Achievements"},
    {key:"ach1_label", label:"Card 1 · Title",  type:"text", ph:"Selections in 2025–26", group:"Results & Achievements"},
    {key:"ach1_sub",   label:"Card 1 · Small line", type:"text", ph:"NVS & Sainik School combined", group:"Results & Achievements"},
    {key:"ach2_value", label:"Card 2 · Number", type:"text", ph:"10", group:"Results & Achievements"},
    {key:"ach2_label", label:"Card 2 · Title",  type:"text", ph:"Top-10 State Ranks", group:"Results & Achievements"},
    {key:"ach2_sub",   label:"Card 2 · Small line", type:"text", ph:"AISSEE 2026", group:"Results & Achievements"},
    {key:"ach3_value", label:"Card 3 · Number", type:"text", ph:"25+", group:"Results & Achievements"},
    {key:"ach3_label", label:"Card 3 · Title",  type:"text", ph:"Within Top 10,000 AIR", group:"Results & Achievements"},
    {key:"ach3_sub",   label:"Card 3 · Small line", type:"text", ph:"AISSEE 2026 All India Rank", group:"Results & Achievements"},
    {key:"ach4_value", label:"Card 4 · Number", type:"text", ph:"80+", group:"Results & Achievements"},
    {key:"ach4_label", label:"Card 4 · Title",  type:"text", ph:"Qualified Written Test", group:"Results & Achievements"},
    {key:"ach4_sub",   label:"Card 4 · Small line", type:"text", ph:"AISSEE 2026", group:"Results & Achievements"},
    {key:"ach_note",   label:"Note under the cards", type:"text", ph:"Verified result letters are available at the institute office on request.", group:"Results & Achievements"},
    // Social
    {key:"social_facebook",     label:"Facebook URL",                type:"text",    ph:"https://facebook.com/gnsikhangabok",   group:"Social Media"},
    {key:"social_youtube",      label:"YouTube URL",                 type:"text",    ph:"https://youtube.com/@gnsikhangabok",   group:"Social Media"},
    {key:"social_instagram",    label:"Instagram URL",               type:"text",    ph:"https://instagram.com/gnsikhangabok",  group:"Social Media"},
    {key:"social_whatsapp_channel",label:"WhatsApp Channel URL",     type:"text",    ph:"https://whatsapp.com/channel/…",       group:"Social Media"},
    // Founder
    {key:"founder_quote",       label:"Founder's Quote",             type:"textarea",ph:"Opening quote for founder section",    group:"Founder Section"},
    {key:"founder_bio",         label:"Founder's Bio",               type:"textarea",ph:"2–3 sentence biography",               group:"Founder Section"},
    // Contact
    {key:"contact_phone",       label:"Primary Phone",               type:"text",    ph:"+91 89742 98074",    group:"Contact"},
    {key:"contact_email",       label:"Email Address",               type:"text",    ph:"gnsikhangabok@gmail.com", group:"Contact"},
    {key:"contact_address",     label:"Campus Address",              type:"textarea",ph:"Khangabok, Thoubal District, Manipur 795138", group:"Contact"},
    // Google Reviews
    {key:"google_review_score", label:"Google Rating (e.g. 4.9)",    type:"text",    ph:"4.9",                group:"Google Reviews"},
    {key:"google_review_count", label:"Review Count (e.g. 80+)",     type:"text",    ph:"80+",                group:"Google Reviews"},
    {key:"google_review_url",   label:"Google Review Link",          type:"text",    ph:"https://g.page/gnsikhangabok/review", group:"Google Reviews"},
    // App
    {key:"app_apk_url",         label:"Android APK URL",             type:"text",    ph:"https://…/gnsi-app.apk",group:"Mobile App"},
    {key:"play_store_url",      label:"Play Store URL",              type:"text",    ph:"https://play.google.com/store/apps/…",group:"Mobile App"},
  ];

  const groups=[...new Set(KEYS.map(k=>k.group))];

  const load_=useCallback(async()=>{
    setLoad(true);
    const settings=await getSettings();
    setCfg(settings);
    setLoad(false);
  },[]);
  useEffect(()=>{load_();},[load_]);

  const saveAll=async()=>{
    setSave(true);
    const{error}=await saveSettings(cfg);
    setSave(false);
    if(error)return toast("Error: "+error.message,"error");
    toast("All settings saved ✓");
  };
  const set_=(key,val)=>setCfg(c=>({...c,[key]:val}));

  const ALL_SQL=`-- Run all at once in Supabase SQL Editor
CREATE TABLE IF NOT EXISTS website_rankers (id bigserial primary key, name text not null, school text, batch text, rank text, photo_url text, sort_order int default 0, session text);
ALTER TABLE website_rankers ADD COLUMN IF NOT EXISTS session text;
CREATE TABLE IF NOT EXISTS website_reviews (id bigserial primary key, reviewer_name text not null, review_text text, rating int default 5, review_date date default current_date, is_featured boolean default true, created_at timestamptz default now());
CREATE TABLE IF NOT EXISTS website_blog (id bigserial primary key, title text not null, body text, category text default 'News', image_url text, published_date date default current_date, is_published boolean default true, created_at timestamptz default now());
CREATE TABLE IF NOT EXISTS website_videos (id bigserial primary key, title text not null, youtube_url text, description text, category text default 'Campus', sort_order int default 0, created_at timestamptz default now());
CREATE TABLE IF NOT EXISTS website_result_banners (id bigserial primary key, title text not null, subtitle text, year_label text, image_url text, sort_order int default 0, is_active boolean default true, created_at timestamptz default now());
CREATE TABLE IF NOT EXISTS website_papers (id bigserial primary key, title text not null, exam_type text default 'NVS', class_level text default 'Class 6', year text, pdf_url text, sort_order int default 0, created_at timestamptz default now());
CREATE TABLE IF NOT EXISTS website_settings (key text primary key, value text, updated_at timestamptz default now());
CREATE TABLE IF NOT EXISTS enquiries (id bigserial primary key, student_name text, parent_name text, phone text, class_grade text, course text, message text, replied boolean default false, replied_at timestamptz, created_at timestamptz default now());
CREATE TABLE IF NOT EXISTS website_gallery (id bigserial primary key, image_url text not null, caption text, category text default 'Campus', sort_order int default 0, created_at timestamptz default now());
CREATE TABLE IF NOT EXISTS website_faculty (id bigserial primary key, name text not null, role text, subject text, experience text, photo_url text, sort_order int default 0);
CREATE TABLE IF NOT EXISTS website_events (id bigserial primary key, title text not null, description text, event_date date not null, sort_order int default 0, is_active boolean default true, created_at timestamptz default now());
CREATE TABLE IF NOT EXISTS website_testimonials (id bigserial primary key, quote text not null, attribution text default 'Parent', rating int default 5, is_featured boolean default true, sort_order int default 0, created_at timestamptz default now());
CREATE TABLE IF NOT EXISTS website_exam_calendar (id bigserial primary key, exam_name text not null, sub_label text, exam_type text default 'NVS', application_opens text, application_closes text, exam_date text, exam_date_sort date, result_date text, status text default 'Upcoming', sort_order int default 0);
CREATE TABLE IF NOT EXISTS website_timeline (id bigserial primary key, title text not null, description text, event_date date, status text default 'upcoming', tag_html text, sort_order int default 0);
${FAC_SQL}
${MOCK_SQL}
${FAQ_SQL}`;

  if(load)return<div style={s.loading}><Spin/>Loading settings…</div>;

  return (
    <div>
      {/* Master SQL block */}
      <div style={{...s.card,borderColor:"rgba(148,163,184,.35)",marginBottom:"1rem"}}>
        <div style={s.cardHd}><span style={s.cardTit}>🗄️ All Required Tables — Copy & Run in Supabase</span></div>
        <div style={s.cardBdy}>
          <p style={{color:"rgba(71,85,105,.45)",fontSize:".82rem",lineHeight:1.7,marginBottom:".8rem"}}>Run this SQL once in your Supabase SQL Editor (Dashboard → SQL Editor → New Query → Paste → Run):</p>
          <pre style={{background:"#0f172a",padding:".9rem",borderRadius:"8px",fontSize:".7rem",color:"#4ade80",overflowX:"auto",lineHeight:1.7,whiteSpace:"pre-wrap",marginBottom:".8rem"}}>{ALL_SQL}</pre>
          <button style={{...s.btnG,fontSize:".75rem"}} onClick={()=>{navigator.clipboard.writeText(ALL_SQL);toast("All SQL copied to clipboard ✓");}}>📋 Copy All SQL</button>
        </div>
      </div>

      {/* Settings by group */}
      {groups.map(g=>{
        const gKeys=KEYS.filter(k=>k.group===g);
        return(
          <div key={g} style={s.card}>
            <div style={s.cardHd}><span style={s.cardTit}>{g}</span></div>
            <div style={s.cardBdy}>
              {g==="Results & Achievements"&&(
                <>
                  <p style={{color:"#64748b",fontSize:".8rem",lineHeight:1.6,margin:"0 0 .9rem"}}>
                    The 4 number cards on the website's <b>Results</b> page. Leave a box empty to keep the current figure; type <b>-</b> as the Number to hide that card. The year-wise cards below them fill automatically from the Ranker Wall.
                  </p>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:".6rem",marginBottom:"1.1rem"}}>
                    {[1,2,3,4].map(n=>{
                      const v=(cfg[`ach${n}_value`]||"").trim()||KEYS.find(k=>k.key===`ach${n}_value`).ph;
                      if(v==="-")return <div key={n} style={{border:"1px dashed #cbd5e1",borderRadius:10,padding:".8rem",color:"#94a3b8",fontSize:".75rem",display:"flex",alignItems:"center",justifyContent:"center"}}>Card {n} hidden</div>;
                      const col=["#B8913F","#1F4E8C","#1E7A4C","#A61E30"][n-1];
                      return(
                        <div key={n} style={{border:"1px solid #e2e8f0",borderTop:`3px solid ${col}`,borderRadius:10,padding:".8rem",background:"#fff"}}>
                          <div style={{fontFamily:"Georgia,serif",fontWeight:700,fontSize:"1.6rem",color:col,lineHeight:1}}>{v}</div>
                          <div style={{fontWeight:700,fontSize:".8rem",color:"#0B1E3D",marginTop:".35rem"}}>{(cfg[`ach${n}_label`]||"").trim()||KEYS.find(k=>k.key===`ach${n}_label`).ph}</div>
                          <div style={{fontSize:".7rem",color:"#64748b"}}>{(cfg[`ach${n}_sub`]||"").trim()||KEYS.find(k=>k.key===`ach${n}_sub`).ph}</div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
              <div style={gKeys.length>=4?s.g2:undefined}>
                {gKeys.map(({key,label,type,ph})=>(
                  <div key={key}>
                    <label style={s.lbl}>{label}</label>
                    {type==="textarea"
                      ?<textarea style={s.ta} placeholder={ph} value={cfg[key]||""} onChange={e=>set_(key,e.target.value)} rows={3}/>
                      :<input style={s.inp} placeholder={ph} value={cfg[key]||""} onChange={e=>set_(key,e.target.value)}/>
                    }
                    {key==="upi_qr_url"&&cfg[key]&&(
                      <div style={{marginTop:"-.6rem",marginBottom:"1rem"}}>
                        <img
                          src={cfg[key]}
                          alt="UPI QR preview"
                          style={{width:120,height:120,objectFit:"contain",background:"#fff",border:"1px solid rgba(148,163,184,.3)",padding:"6px"}}
                          onError={e=>{e.target.style.display="none";}}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}

      <button style={{...s.btnG,padding:".75rem 2rem",fontSize:".82rem",opacity:saving?.6:1}} onClick={saveAll} disabled={saving}>
        {saving?"Saving…":"💾 Save All Settings"}
      </button>
    </div>
  );
}


// ════════════════════════════════════════════════════════════
//  PDF UPLOAD FIELD (mock tests)
// ════════════════════════════════════════════════════════════
function PdfUploadField({label,folder,value,onChange}){
  const [busy,setBusy]=useState(false);
  const ref=useRef(null);
  const handle=async e=>{
    const f=e.target.files?.[0];e.target.value="";
    if(!f)return;
    if(f.type!=="application/pdf"&&!/\.pdf$/i.test(f.name))return toast("Please choose a PDF file","error");
    if(f.size>25*1024*1024)return toast("PDF larger than 25MB","error");
    setBusy(true);
    const{url,error}=await uploadWebsiteFile(f,folder);
    setBusy(false);
    if(error||!url)return toast("Upload failed: "+(error?.message||"unknown"),"error");
    onChange(url);toast("PDF uploaded ✓");
  };
  return(
    <div style={{marginBottom:"1rem"}}>
      <label style={s.lbl}>{label}</label>
      <input ref={ref} type="file" accept="application/pdf,.pdf" onChange={handle} style={{display:"none"}}/>
      <div style={{display:"flex",gap:".6rem",alignItems:"center",flexWrap:"wrap"}}>
        <button type="button" style={{...s.btnG,opacity:busy?.6:1}} onClick={()=>ref.current?.click()} disabled={busy}>{busy?"Uploading…":value?"Replace PDF":"⬆ Upload PDF"}</button>
        {value&&<a href={value} target="_blank" rel="noreferrer" style={{fontSize:".78rem",color:"#1e3a5f",fontWeight:600}}>📄 View current PDF</a>}
        {value&&<button type="button" style={s.btnR} onClick={()=>onChange("")}>Remove</button>}
      </div>
      <input style={{...s.inp,marginTop:".5rem"}} placeholder="…or paste a PDF link" value={value||""} onChange={e=>onChange(e.target.value)}/>
    </div>
  );
}

const SQL_NOTE=(sql)=>(
  <details style={{marginBottom:"1rem",fontSize:".75rem",color:"#64748b"}}>
    <summary style={{cursor:"pointer"}}>First time? Run this SQL once in Supabase</summary>
    <pre style={{background:"#0f172a",color:"#4ade80",padding:".7rem",borderRadius:6,whiteSpace:"pre-wrap",fontSize:".68rem",marginTop:".5rem"}}>{sql}</pre>
    <button style={{...s.btnG,fontSize:".7rem"}} onClick={()=>{navigator.clipboard.writeText(sql);toast("SQL copied ✓");}}>📋 Copy SQL</button>
  </details>
);

// ════════════════════════════════════════════════════════════
//  FACILITIES (website_facilities)
// ════════════════════════════════════════════════════════════
const FAC_SQL=`CREATE TABLE IF NOT EXISTS website_facilities (id bigserial primary key, title text not null, description text, points text, icon text default '🏫', photo_url text, sort_order int default 0, is_active boolean default true, created_at timestamptz default now());`;
function FacilitiesSection(){
  const blank={title:"",description:"",points:"",icon:"🏫",photo_url:"",sort_order:0,is_active:true};
  const [rows,setRows]=useState([]);const [load,setLoad]=useState(true);
  const [form,setForm]=useState(blank);const [editing,setEdit]=useState(null);const [saving,setSave]=useState(false);
  const load_=useCallback(async()=>{setLoad(true);setRows(await getFacilities(true));setLoad(false);},[]);
  useEffect(()=>{load_();},[load_]);
  const save=async()=>{
    if(!form.title)return toast("Title required","error");
    setSave(true);const{error}=await saveFacility({...form,sort_order:Number(form.sort_order)||0},editing);setSave(false);
    if(error)return toast("Error: "+error.message,"error");
    toast(editing?"Updated ✓":"Added ✓");setForm({...blank,sort_order:rows.length+1});setEdit(null);load_();
  };
  const del=async id=>{if(!confirm("Delete this facility?"))return;await deleteFacility(id);toast("Deleted");load_();};
  const toggle=async r=>{await saveFacility({is_active:!r.is_active},r.id);load_();};
  return(
    <div>
      <div style={s.card}>
        <div style={s.cardHd}><span style={s.cardTit}>{editing?"✏️ Edit Facility":"🏫 Add Facility"}</span>{editing&&<button style={s.btnR} onClick={()=>{setEdit(null);setForm(blank);}}>Cancel</button>}</div>
        <div style={s.cardBdy}>
          {SQL_NOTE(FAC_SQL)}
          <ImageUploadField label="Photo (real campus photo)" folder="facilities" value={form.photo_url} onChange={url=>setForm(f=>({...f,photo_url:url}))} previewSize={110}/>
          <div style={s.g2}>
            <div><label style={s.lbl}>Title *</label><input style={s.inp} placeholder="Residential Hostel" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}/></div>
            <div style={s.g2}>
              <div><label style={s.lbl}>Icon</label><input style={s.inp} placeholder="🏠" value={form.icon} onChange={e=>setForm(f=>({...f,icon:e.target.value}))}/></div>
              <div><label style={s.lbl}>Order</label><input type="number" style={s.inp} value={form.sort_order} onChange={e=>setForm(f=>({...f,sort_order:e.target.value}))}/></div>
            </div>
          </div>
          <label style={s.lbl}>Short description</label>
          <textarea style={s.ta} rows={2} placeholder="Supervised residential accommodation modelled on Sainik School environment." value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/>
          <label style={s.lbl}>Key points (one per line)</label>
          <textarea style={s.ta} rows={4} placeholder={"Separate boys hostel blocks\n24/7 warden supervision"} value={form.points} onChange={e=>setForm(f=>({...f,points:e.target.value}))}/>
          <button style={{...s.btnG,opacity:saving?.6:1}} onClick={save} disabled={saving}>{saving?"Saving…":editing?"Update Facility":"Add to Website →"}</button>
          <p style={{color:"#94a3b8",fontSize:".72rem",marginTop:".5rem"}}>Until you add at least one facility here, the website keeps showing its built-in six facility cards.</p>
        </div>
      </div>
      {load?<div style={s.loading}><Spin/>Loading…</div>:
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:".8rem"}}>
        {rows.map(r=>(
          <div key={r.id} style={{...s.card,marginBottom:0,opacity:r.is_active?1:.5,overflow:"hidden"}}>
            {r.photo_url?<img src={r.photo_url} alt="" style={{width:"100%",height:140,objectFit:"cover",display:"block"}}/>:<div style={{height:140,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"2.4rem",background:"#f1f5f9"}}>{r.icon||"🏫"}</div>}
            <div style={{padding:".8rem"}}>
              <div style={{fontWeight:700,color:"#1e293b"}}>{r.icon} {r.title}</div>
              <div style={{fontSize:".75rem",color:"#64748b",margin:".3rem 0 .6rem"}}>{r.description}</div>
              <div style={{display:"flex",gap:".35rem",flexWrap:"wrap"}}>
                <button style={s.btnG} onClick={()=>{setEdit(r.id);setForm({title:r.title,description:r.description||"",points:r.points||"",icon:r.icon||"🏫",photo_url:r.photo_url||"",sort_order:r.sort_order||0,is_active:r.is_active});window.scrollTo({top:0,behavior:"smooth"});}}>Edit</button>
                <button style={s.btnGrn} onClick={()=>toggle(r)}>{r.is_active?"Hide":"Show"}</button>
                <button style={s.btnR} onClick={()=>del(r.id)}>Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  MOCK TESTS (website_mock_tests) — real PDF downloads
// ════════════════════════════════════════════════════════════
const MOCK_SQL=`CREATE TABLE IF NOT EXISTS website_mock_tests (id bigserial primary key, title text not null, exam_type text default 'NVS', details text, test_date date, pdf_url text, answer_key_url text, sort_order int default 0, is_active boolean default true, created_at timestamptz default now());`;
function MockTestsSection(){
  const blank={title:"",exam_type:"NVS",details:"",test_date:"",pdf_url:"",answer_key_url:"",sort_order:0,is_active:true};
  const [rows,setRows]=useState([]);const [load,setLoad]=useState(true);
  const [form,setForm]=useState(blank);const [editing,setEdit]=useState(null);const [saving,setSave]=useState(false);
  const load_=useCallback(async()=>{setLoad(true);setRows(await getMockTests(true));setLoad(false);},[]);
  useEffect(()=>{load_();},[load_]);
  const save=async()=>{
    if(!form.title)return toast("Title required","error");
    if(!form.pdf_url)return toast("Upload the question paper PDF","error");
    setSave(true);const{error}=await saveMockTest({...form,test_date:form.test_date||null,sort_order:Number(form.sort_order)||0},editing);setSave(false);
    if(error)return toast("Error: "+error.message,"error");
    toast(editing?"Updated ✓":"Published ✓");setForm(blank);setEdit(null);load_();
  };
  const del=async id=>{if(!confirm("Delete this mock test?"))return;await deleteMockTest(id);toast("Deleted");load_();};
  const toggle=async r=>{await saveMockTest({is_active:!r.is_active},r.id);load_();};
  return(
    <div>
      <div style={s.card}>
        <div style={s.cardHd}><span style={s.cardTit}>{editing?"✏️ Edit Mock Test":"📝 Add Mock Test PDF"}</span>{editing&&<button style={s.btnR} onClick={()=>{setEdit(null);setForm(blank);}}>Cancel</button>}</div>
        <div style={s.cardBdy}>
          {SQL_NOTE(MOCK_SQL)}
          <div style={s.g2}>
            <div><label style={s.lbl}>Title *</label><input style={s.inp} placeholder="NVS Class 6 Full Mock Test — Set 1" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}/></div>
            <div style={s.g2}>
              <div><label style={s.lbl}>Exam</label><select style={s.sel} value={form.exam_type} onChange={e=>setForm(f=>({...f,exam_type:e.target.value}))}><option>NVS</option><option>Sainik</option><option>RMS</option><option>Foundation</option><option>General</option></select></div>
              <div><label style={s.lbl}>Test date</label><input type="date" style={s.inp} value={form.test_date||""} onChange={e=>setForm(f=>({...f,test_date:e.target.value}))}/></div>
            </div>
          </div>
          <label style={s.lbl}>Details</label>
          <input style={s.inp} placeholder="80 Questions · 90 Minutes" value={form.details} onChange={e=>setForm(f=>({...f,details:e.target.value}))}/>
          <div style={s.g2}>
            <PdfUploadField label="Question paper PDF *" folder="mock-tests" value={form.pdf_url} onChange={u=>setForm(f=>({...f,pdf_url:u}))}/>
            <PdfUploadField label="Answer key PDF (optional)" folder="mock-tests" value={form.answer_key_url} onChange={u=>setForm(f=>({...f,answer_key_url:u}))}/>
          </div>
          <button style={{...s.btnG,opacity:saving?.6:1}} onClick={save} disabled={saving}>{saving?"Saving…":editing?"Update":"Publish to Website →"}</button>
        </div>
      </div>
      {load?<div style={s.loading}><Spin/>Loading…</div>:rows.map(r=>(
        <div key={r.id} style={{...s.card,opacity:r.is_active?1:.5}}>
          <div style={s.cardHd}>
            <div style={{display:"flex",gap:".6rem",alignItems:"center",flexWrap:"wrap"}}>
              <span style={s.badge("Medium")}>{r.exam_type}</span>
              <span style={{color:"#1e293b",fontWeight:600}}>{r.title}</span>
              <span style={{fontSize:".72rem",color:"#94a3b8"}}>{r.details}{r.test_date?` · ${fmt(r.test_date)}`:""}</span>
            </div>
            <div style={{display:"flex",gap:".35rem",flexWrap:"wrap"}}>
              {r.pdf_url&&<a href={r.pdf_url} target="_blank" rel="noreferrer" style={{...s.btnGrn,textDecoration:"none"}}>Paper</a>}
              {r.answer_key_url&&<a href={r.answer_key_url} target="_blank" rel="noreferrer" style={{...s.btnGrn,textDecoration:"none"}}>Key</a>}
              <button style={s.btnG} onClick={()=>{setEdit(r.id);setForm({title:r.title,exam_type:r.exam_type||"NVS",details:r.details||"",test_date:r.test_date||"",pdf_url:r.pdf_url||"",answer_key_url:r.answer_key_url||"",sort_order:r.sort_order||0,is_active:r.is_active});window.scrollTo({top:0,behavior:"smooth"});}}>Edit</button>
              <button style={s.btnGrn} onClick={()=>toggle(r)}>{r.is_active?"Hide":"Show"}</button>
              <button style={s.btnR} onClick={()=>del(r.id)}>Delete</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  FAQs (website_faq)
// ════════════════════════════════════════════════════════════
const FAQ_SQL=`CREATE TABLE IF NOT EXISTS website_faq (id bigserial primary key, question text not null, answer text not null, category text default 'General', sort_order int default 0, is_active boolean default true, created_at timestamptz default now());`;
function FaqSection(){
  const blank={question:"",answer:"",category:"General",sort_order:0,is_active:true};
  const [rows,setRows]=useState([]);const [load,setLoad]=useState(true);
  const [form,setForm]=useState(blank);const [editing,setEdit]=useState(null);const [saving,setSave]=useState(false);
  const load_=useCallback(async()=>{setLoad(true);setRows(await getFaqs(true));setLoad(false);},[]);
  useEffect(()=>{load_();},[load_]);
  const save=async()=>{
    if(!form.question||!form.answer)return toast("Question and answer required","error");
    setSave(true);const{error}=await saveFaq({...form,sort_order:Number(form.sort_order)||0},editing);setSave(false);
    if(error)return toast("Error: "+error.message,"error");
    toast(editing?"Updated ✓":"Added ✓");setForm({...blank,category:form.category,sort_order:rows.length+1});setEdit(null);load_();
  };
  const del=async id=>{if(!confirm("Delete this FAQ?"))return;await deleteFaq(id);toast("Deleted");load_();};
  const toggle=async r=>{await saveFaq({is_active:!r.is_active},r.id);load_();};
  return(
    <div>
      <div style={s.card}>
        <div style={s.cardHd}><span style={s.cardTit}>{editing?"✏️ Edit FAQ":"❓ Add FAQ"}</span>{editing&&<button style={s.btnR} onClick={()=>{setEdit(null);setForm(blank);}}>Cancel</button>}</div>
        <div style={s.cardBdy}>
          {SQL_NOTE(FAQ_SQL)}
          <label style={s.lbl}>Question *</label>
          <input style={s.inp} placeholder="Is boarding hostel facility available?" value={form.question} onChange={e=>setForm(f=>({...f,question:e.target.value}))}/>
          <label style={s.lbl}>Answer *</label>
          <textarea style={s.ta} rows={4} value={form.answer} onChange={e=>setForm(f=>({...f,answer:e.target.value}))}/>
          <div style={s.g2}>
            <div><label style={s.lbl}>Category</label><select style={s.sel} value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}><option>General</option><option>Admissions</option><option>Hostel</option><option>Fees</option><option>Exams</option><option>Parents Portal</option></select></div>
            <div><label style={s.lbl}>Order</label><input type="number" style={s.inp} value={form.sort_order} onChange={e=>setForm(f=>({...f,sort_order:e.target.value}))}/></div>
          </div>
          <button style={{...s.btnG,opacity:saving?.6:1}} onClick={save} disabled={saving}>{saving?"Saving…":editing?"Update FAQ":"Add to Website →"}</button>
          <p style={{color:"#94a3b8",fontSize:".72rem",marginTop:".5rem"}}>Until you add at least one FAQ here, the website keeps showing its built-in questions.</p>
        </div>
      </div>
      {load?<div style={s.loading}><Spin/>Loading…</div>:rows.map(r=>(
        <div key={r.id} style={{...s.card,opacity:r.is_active?1:.5}}>
          <div style={s.cardHd}>
            <div style={{display:"flex",gap:".6rem",alignItems:"center",flexWrap:"wrap"}}>
              <span style={s.badge("Low")}>{r.category}</span>
              <span style={{color:"#1e293b",fontWeight:600}}>{r.question}</span>
            </div>
            <div style={{display:"flex",gap:".35rem"}}>
              <button style={s.btnG} onClick={()=>{setEdit(r.id);setForm({question:r.question,answer:r.answer,category:r.category||"General",sort_order:r.sort_order||0,is_active:r.is_active});window.scrollTo({top:0,behavior:"smooth"});}}>Edit</button>
              <button style={s.btnGrn} onClick={()=>toggle(r)}>{r.is_active?"Hide":"Show"}</button>
              <button style={s.btnR} onClick={()=>del(r.id)}>Delete</button>
            </div>
          </div>
          <div style={{padding:".6rem 1.1rem",fontSize:".82rem",color:"#64748b",lineHeight:1.6}}>{r.answer}</div>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  MAIN EXPORT
// ════════════════════════════════════════════════════════════
export default function WebsiteTab() {
  const [tab,setTab]=useState("enquiries");

  const SECTIONS={
    enquiries: <EnquiriesSection/>,
    notices:   <NoticesSection/>,
    events:    <EventsSection/>,
    rankers:   <RankersSection/>,
    gallery:   <GallerySection/>,
    videos:    <VideosSection/>,
    blog:      <BlogSection/>,
    reviews:   <ReviewsSection/>,
    papers:    <PapersSection/>,
    banners:   <BannersSection/>,
    faculty:   <FacultySection/>,
    facilities:<FacilitiesSection/>,
    mocktests: <MockTestsSection/>,
    faq:       <FaqSection/>,
    testimonials: <TestimonialsSection/>,
    examcal:   <ExamCalendarSection/>,
    timeline:  <TimelineSection/>,
    settings:  <SettingsSection/>,
  };

  return(
    <div style={{...s.wrap,background:"#f8fafc",minHeight:"100vh"}}>
      {/* Header */}
      <div style={{marginBottom:"1.4rem",paddingBottom:"1rem",borderBottom:"1px solid #e2e8f0"}}>
        <h2 style={{fontFamily:"inherit",color:"#1e3a5f",fontSize:"1.6rem",fontWeight:700,marginBottom:".3rem"}}>🌐 Website Manager</h2>
        <p style={{color:"rgba(71,85,105,.35)",fontFamily:"inherit",fontSize:".75rem",letterSpacing:"0",textTransform:"none"}}>
          guidancekhangabok.in — {SUB_TABS.length} management sections · All data syncs live to landing page
        </p>
      </div>

      {/* Sub-tab nav */}
      <div style={s.subNav}>
        {SUB_TABS.map(t=>(
          <button key={t.id} style={s.subBtn(tab===t.id)} onClick={()=>setTab(t.id)}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {SECTIONS[tab]}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}