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
//  ⑫ Site Settings (deadline, brochure, UPI, social, stats)
//  ⑬ Events & Schedule (website_events)
// ============================================================

import { useState, useEffect, useCallback } from "react";
import {
  getAllEnquiries, markEnquiryReplied, deleteEnquiry,
  getAllNotices, saveNotice, archiveNotice, deleteNotice,
  getAllEvents, saveEvent, deleteEvent, toggleEventActive,
  getRankers, saveRanker, deleteRanker,
  getGallery, addGalleryImage, updateGalleryCaption, deleteGalleryImage,
  getVideos, saveVideo, deleteVideo, getYouTubeThumb, getYouTubeEmbed,
  getAllPosts, savePost, togglePostPublished, deletePost,
  getAllReviews, saveReview, toggleReviewFeatured, deleteReview,
  getPapers, savePaper, deletePaper,
  getAllBanners, saveBanner, toggleBannerActive, deleteBanner,
  getFaculty, saveFaculty, deleteFaculty,
  getSettings, saveSettings,
} from './websiteApi';

// ── colours ─────────────────────────────────────────────────
const C = {
  navy:"#0B1F3A", navy2:"#0F2A4E", navy3:"#153561",
  gold:"#B8922A", goldL:"#D4AE50", goldLL:"#EDD180",
  cream:"#F8F3E8", slate:"#3D4F6B", mist:"#7A8FA8",
  red:"#8B1A1A", green:"#1A5C2A",
};

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
  { id:"settings",   icon:"⚙️",  label:"Settings" },
];

// ── helpers ─────────────────────────────────────────────────
const fmt = d => d ? new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}) : "—";
const toast = (msg, type="success") => {
  const el = document.createElement("div");
  el.textContent = msg;
  el.style.cssText = `position:fixed;bottom:1.5rem;right:1.5rem;z-index:9999;padding:.75rem 1.4rem;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.85rem;letter-spacing:.06em;border-left:4px solid ${type==="success"?"#4AE382":"#f87171"};background:${C.navy2};color:${type==="success"?"#4AE382":"#f87171"};box-shadow:0 4px 20px rgba(0,0,0,.4);transition:.3s`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
};

// ── shared styles ────────────────────────────────────────────
const s = {
  wrap:    { padding:"1.5rem", fontFamily:"'Source Sans 3',sans-serif", background:C.navy, minHeight:"100vh", color:"#F8F3E8" },
  subNav:  { display:"flex", gap:".35rem", marginBottom:"1.5rem", borderBottom:`1px solid rgba(184,146,42,.15)`, paddingBottom:"1rem", flexWrap:"wrap" },
  subBtn:  a => ({ background:a?C.gold:"transparent", color:a?C.navy:"rgba(248,243,232,.5)", border:`1px solid ${a?C.gold:"rgba(184,146,42,.2)"}`, padding:".38rem .85rem", fontFamily:"'Rajdhani',sans-serif", fontWeight:700, fontSize:".7rem", letterSpacing:".1em", textTransform:"uppercase", cursor:"pointer", transition:".2s", display:"flex", alignItems:"center", gap:".35rem" }),
  card:    { background:"rgba(21,53,97,.4)", border:"1px solid rgba(184,146,42,.18)", marginBottom:"1rem" },
  cardHd:  { padding:".8rem 1.1rem", borderBottom:"1px solid rgba(184,146,42,.1)", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:".5rem" },
  cardTit: { fontFamily:"'Rajdhani',sans-serif", fontWeight:700, fontSize:".72rem", letterSpacing:".15em", textTransform:"uppercase", color:C.goldL },
  cardBdy: { padding:"1rem 1.1rem" },
  row:     { display:"flex", justifyContent:"space-between", alignItems:"center", padding:".6rem 0", borderBottom:"1px solid rgba(184,146,42,.07)", fontSize:".85rem" },
  lbl:     { display:"block", fontFamily:"'Rajdhani',sans-serif", fontWeight:700, fontSize:".66rem", letterSpacing:".14em", textTransform:"uppercase", color:"rgba(248,243,232,.45)", marginBottom:".35rem" },
  inp:     { width:"100%", padding:"10px 14px", background:"rgba(255,255,255,.05)", border:"1px solid rgba(184,146,42,.22)", color:"#F8F3E8", fontSize:".88rem", fontFamily:"'Source Sans 3',sans-serif", outline:"none", marginBottom:"1rem", transition:".2s", boxSizing:"border-box" },
  ta:      { width:"100%", padding:"10px 14px", background:"rgba(255,255,255,.05)", border:"1px solid rgba(184,146,42,.22)", color:"#F8F3E8", fontSize:".88rem", fontFamily:"'Source Sans 3',sans-serif", outline:"none", marginBottom:"1rem", resize:"vertical", minHeight:"80px", boxSizing:"border-box" },
  sel:     { width:"100%", padding:"10px 14px", background:C.navy2, border:"1px solid rgba(184,146,42,.22)", color:"#F8F3E8", fontSize:".88rem", fontFamily:"'Source Sans 3',sans-serif", outline:"none", marginBottom:"1rem", boxSizing:"border-box" },
  btnG:    { background:C.gold, color:C.navy, border:"none", padding:".52rem 1.2rem", fontFamily:"'Rajdhani',sans-serif", fontWeight:700, fontSize:".75rem", letterSpacing:".1em", textTransform:"uppercase", cursor:"pointer", transition:".2s" },
  btnR:    { background:"rgba(139,26,26,.4)", color:"#f87171", border:"1px solid rgba(139,26,26,.4)", padding:".4rem .8rem", fontFamily:"'Rajdhani',sans-serif", fontWeight:700, fontSize:".68rem", letterSpacing:".08em", textTransform:"uppercase", cursor:"pointer" },
  btnGrn:  { background:"rgba(26,92,42,.4)", color:"#4AE382", border:"1px solid rgba(26,92,42,.4)", padding:".4rem .8rem", fontFamily:"'Rajdhani',sans-serif", fontWeight:700, fontSize:".68rem", letterSpacing:".08em", textTransform:"uppercase", cursor:"pointer" },
  btnN:    { background:"rgba(21,53,97,.6)", color:C.goldL, border:"1px solid rgba(184,146,42,.22)", padding:".4rem .8rem", fontFamily:"'Rajdhani',sans-serif", fontWeight:700, fontSize:".68rem", letterSpacing:".08em", textTransform:"uppercase", cursor:"pointer" },
  g2:      { display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1rem" },
  g3:      { display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:".8rem" },
  stat:    { background:"rgba(11,31,58,.5)", padding:"1rem", textAlign:"center" },
  statN:   { display:"block", fontFamily:"'EB Garamond',serif", fontSize:"1.8rem", color:C.goldLL, lineHeight:1, marginBottom:".2rem" },
  statL:   { fontSize:".62rem", fontFamily:"'Rajdhani',sans-serif", letterSpacing:".08em", textTransform:"uppercase", color:"rgba(248,243,232,.3)" },
  badge:   c => ({ display:"inline-block", padding:".18rem .55rem", fontFamily:"'Rajdhani',sans-serif", fontWeight:700, fontSize:".6rem", letterSpacing:".1em", textTransform:"uppercase", background:c==="High"?"rgba(139,26,26,.3)":c==="Low"?"rgba(61,79,107,.3)":"rgba(184,146,42,.2)", color:c==="High"?"#f87171":c==="Low"?C.mist:C.goldLL, border:`1px solid ${c==="High"?"rgba(139,26,26,.4)":c==="Low"?"rgba(61,79,107,.4)":"rgba(184,146,42,.3)"}` }),
  loading: { display:"flex", alignItems:"center", justifyContent:"center", padding:"3rem", gap:".6rem", color:"rgba(248,243,232,.28)", fontFamily:"'Rajdhani',sans-serif", letterSpacing:".1em", textTransform:"uppercase", fontSize:".78rem" },
  empty:   { textAlign:"center", padding:"2.5rem", color:"rgba(248,243,232,.25)", fontFamily:"'Rajdhani',sans-serif", letterSpacing:".1em", textTransform:"uppercase", fontSize:".75rem" },
};

// Spin component
const Spin = () => <div style={{width:"16px",height:"16px",border:"2px solid rgba(184,146,42,.28)",borderTopColor:C.gold,borderRadius:"50%",animation:"spin .8s linear infinite",flexShrink:0}} />;

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
        {[["Total",stats.total,C.goldLL],["Today",stats.today,"#4AE382"],["This Week",stats.week,C.goldL],["Unread",stats.unread,"#f87171"],["Grievances",stats.grievances,"#E87A3A"]].map(([l,v,c])=>(
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
          <div style={s.cardHd}><span style={s.cardTit}>Enquiries ({filtered.length})</span><span style={{color:"rgba(248,243,232,.3)",fontSize:".72rem",fontFamily:"'Rajdhani',sans-serif"}}>Click row to view details</span></div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:".83rem"}}>
              <thead>
                <tr>{["Date","Student","Parent","Phone","Course","Type","Status",""].map(h=>(
                  <th key={h} style={{background:"rgba(11,31,58,.6)",padding:".6rem .9rem",textAlign:"left",fontFamily:"'Rajdhani',sans-serif",fontWeight:700,fontSize:".64rem",letterSpacing:".12em",textTransform:"uppercase",color:C.goldL,borderBottom:"1px solid rgba(184,146,42,.12)",whiteSpace:"nowrap"}}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {filtered.map(r=>(
                  <tr key={r.id} style={{cursor:"pointer",background:r.replied?"transparent":"rgba(184,146,42,.03)"}} onClick={()=>setOpen(r)}>
                    <td style={{padding:".55rem .9rem",borderBottom:"1px solid rgba(184,146,42,.06)",color:"rgba(248,243,232,.45)",fontSize:".72rem",fontFamily:"'Rajdhani',sans-serif",whiteSpace:"nowrap"}}>{fmt(r.created_at)}</td>
                    <td style={{padding:".55rem .9rem",borderBottom:"1px solid rgba(184,146,42,.06)",color:r.replied?"rgba(248,243,232,.65)":"#F8F3E8",fontWeight:r.replied?400:600}}>{r.student_name||"—"}</td>
                    <td style={{padding:".55rem .9rem",borderBottom:"1px solid rgba(184,146,42,.06)",color:"rgba(248,243,232,.55)"}}>{r.parent_name||"—"}</td>
                    <td style={{padding:".55rem .9rem",borderBottom:"1px solid rgba(184,146,42,.06)",color:C.goldL}}><a href={`tel:${r.phone}`} style={{color:C.goldL}} onClick={e=>e.stopPropagation()}>{r.phone||"—"}</a></td>
                    <td style={{padding:".55rem .9rem",borderBottom:"1px solid rgba(184,146,42,.06)",color:"rgba(248,243,232,.6)",fontSize:".78rem",maxWidth:"180px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.course||"—"}</td>
                    <td style={{padding:".55rem .9rem",borderBottom:"1px solid rgba(184,146,42,.06)"}}><span style={{...s.badge(r.course?.startsWith("GRIEVANCE")?"High":"Medium"),fontSize:".58rem"}}>{r.course?.startsWith("GRIEVANCE")?"Grievance":"Admission"}</span></td>
                    <td style={{padding:".55rem .9rem",borderBottom:"1px solid rgba(184,146,42,.06)"}}><span style={{...s.badge(r.replied?"Low":"High"),fontSize:".58rem"}}>{r.replied?"Replied":"New"}</span></td>
                    <td style={{padding:".55rem .9rem",borderBottom:"1px solid rgba(184,146,42,.06)"}} onClick={e=>e.stopPropagation()}>
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
        <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.92)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem",overflowY:"auto"}} onClick={()=>setOpen(null)}>
          <div style={{background:C.navy2,border:`1px solid rgba(184,146,42,.3)`,padding:"1.8rem",width:"100%",maxWidth:"520px"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.2rem"}}>
              <h3 style={{fontFamily:"'EB Garamond',serif",color:"#F8F3E8",fontSize:"1.3rem"}}>{open.course?.startsWith("GRIEVANCE")?"🔴 Grievance":"📬 Enquiry"} Details</h3>
              <button onClick={()=>setOpen(null)} style={{background:"none",border:"none",color:"rgba(248,243,232,.4)",cursor:"pointer",fontSize:"1.2rem"}}>✕</button>
            </div>
            {open.course?.startsWith("GRIEVANCE")&&(
              <div style={{padding:".6rem .9rem",background:"rgba(139,26,26,.2)",border:"1px solid rgba(139,26,26,.3)",marginBottom:"1rem",fontFamily:"'Rajdhani',sans-serif",fontSize:".78rem",color:"#f87171",letterSpacing:".06em"}}>
                ⚠ GRIEVANCE — Requires response within 48 hours · Ticket: {open.message?.match(/GNSI-GRV-\d+/)?.[0]||"—"}
              </div>
            )}
            {[["Student Name",open.student_name],["Parent / Guardian",open.parent_name],["Phone",open.phone],["Class / Age",open.class_grade],["Course / Type",open.course],["Submitted",fmt(open.created_at)],open.replied_at&&["Replied At",fmt(open.replied_at)]].filter(Boolean).map(([l,v])=>(
              <div key={l} style={s.row}><span style={{color:"rgba(248,243,232,.38)",fontFamily:"'Rajdhani',sans-serif",fontSize:".72rem",letterSpacing:".08em",textTransform:"uppercase"}}>{l}</span><strong style={{color:"#F8F3E8",fontSize:".85rem"}}>{v||"—"}</strong></div>
            ))}
            {open.message&&<div style={{marginTop:"1rem",padding:".9rem",background:"rgba(11,31,58,.5)",border:"1px solid rgba(184,146,42,.12)"}}><div style={{...s.lbl,marginBottom:".5rem"}}>Message</div><p style={{color:"rgba(248,243,232,.65)",fontSize:".85rem",lineHeight:1.7}}>{open.message}</p></div>}
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
          <p style={{color:"rgba(248,243,232,.28)",fontSize:".72rem",fontFamily:"'Rajdhani',sans-serif",marginTop:".5rem"}}>High priority → red border on website · Top 3 active notices shown on homepage</p>
        </div>
      </div>
      {load?<div style={s.loading}><Spin/>Loading…</div>:rows.map(n=>(
        <div key={n.id} style={{...s.card,opacity:n.is_archived?.55:1}}>
          <div style={s.cardHd}>
            <div style={{display:"flex",alignItems:"center",gap:".7rem",flexWrap:"wrap"}}>
              <span style={s.badge(n.priority)}>{n.priority||"Medium"}</span>
              <span style={{color:"#F8F3E8",fontFamily:"'EB Garamond',serif",fontSize:"1rem"}}>{n.title}</span>
              {n.is_archived&&<span style={{...s.badge("Low"),fontSize:".55rem"}}>Archived</span>}
            </div>
            <div style={{display:"flex",gap:".4rem"}}>
              <button style={s.btnG} onClick={()=>startEdit(n)}>Edit</button>
              <button style={s.btnGrn} onClick={()=>archive(n.id,n.is_archived)}>{n.is_archived?"Restore":"Archive"}</button>
              <button style={s.btnR} onClick={()=>del(n.id)}>Delete</button>
            </div>
          </div>
          <div style={{padding:".7rem 1.1rem"}}>
            <p style={{color:"rgba(248,243,232,.55)",fontSize:".83rem",lineHeight:1.7,marginBottom:".4rem"}}>{n.body?.slice(0,180)}{n.body?.length>180?"…":""}</p>
            <span style={{color:"rgba(248,243,232,.28)",fontSize:".68rem",fontFamily:"'Rajdhani',sans-serif",letterSpacing:".06em",textTransform:"uppercase"}}>{fmt(n.notice_date||n.created_at)}</span>
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
  const [rows,setRows]=useState([]);
  const [load,setLoad]=useState(true);
  const [form,setForm]=useState({name:"",school:"",batch:"",rank:"",photo_url:"",sort_order:0});
  const [editing,setEdit]=useState(null);
  const [saving,setSave]=useState(false);

  const load_=useCallback(async()=>{
    setLoad(true);
    const data=await getRankers();
    if(data)setRows(data);
    setLoad(false);
  },[]);
  useEffect(()=>{load_();},[load_]);

  const save=async()=>{
    if(!form.name||!form.school)return toast("Name and school required","error");
    setSave(true);
    const{error}=await saveRanker(form,editing);
    setSave(false);
    if(error)return toast("Error: "+error.message,"error");
    toast(editing?"Ranker updated ✓":"Ranker added to website ✓");
    setForm({name:"",school:"",batch:"",rank:"",photo_url:"",sort_order:rows.length});
    setEdit(null);load_();
  };
  const del=async id=>{if(!confirm("Remove ranker?"))return;await deleteRanker(id);toast("Removed");load_();};
  const startEdit=r=>{setEdit(r.id);setForm({name:r.name,school:r.school||"",batch:r.batch||"",rank:r.rank||"",photo_url:r.photo_url||"",sort_order:r.sort_order||0});};

  const SQL=`CREATE TABLE IF NOT EXISTS website_rankers (
  id         bigserial primary key,
  name       text not null,
  school     text,
  batch      text,
  rank       text,
  photo_url  text,
  sort_order int default 0
);`;

  return (
    <div>
      <div style={{...s.card,borderColor:"rgba(184,146,42,.3)",marginBottom:"1rem"}}>
        <div style={s.cardHd}><span style={s.cardTit}>📋 Setup — Create Table First</span></div>
        <div style={s.cardBdy}>
          <pre style={{background:"rgba(0,0,0,.3)",padding:".8rem",fontSize:".72rem",color:"#4AE382",overflowX:"auto",lineHeight:1.6,whiteSpace:"pre-wrap",marginBottom:".7rem"}}>{SQL}</pre>
          <button style={{...s.btnG,fontSize:".72rem"}} onClick={()=>{navigator.clipboard.writeText(SQL);toast("SQL copied ✓");}}>📋 Copy SQL</button>
        </div>
      </div>

      <div style={s.card}>
        <div style={s.cardHd}><span style={s.cardTit}>{editing?"✏️ Edit Ranker":"🏆 Add Selected Student"}</span>{editing&&<button style={s.btnR} onClick={()=>{setEdit(null);setForm({name:"",school:"",batch:"",rank:"",photo_url:"",sort_order:0})}}>Cancel</button>}</div>
        <div style={s.cardBdy}>
          <div style={s.g2}>
            <div><label style={s.lbl}>Student Name *</label><input style={s.inp} placeholder="e.g. Laishram Ibeton Singh" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></div>
            <div><label style={s.lbl}>School Selected *</label><input style={s.inp} placeholder="e.g. Sainik School Tilaiya" value={form.school} onChange={e=>setForm(f=>({...f,school:e.target.value}))}/></div>
          </div>
          <div style={s.g2}>
            <div><label style={s.lbl}>Batch / Year</label><input style={s.inp} placeholder="e.g. Batch 2025–26" value={form.batch} onChange={e=>setForm(f=>({...f,batch:e.target.value}))}/></div>
            <div><label style={s.lbl}>Rank / Achievement (optional)</label><input style={s.inp} placeholder="e.g. AIR 1 or District Topper" value={form.rank} onChange={e=>setForm(f=>({...f,rank:e.target.value}))}/></div>
          </div>
          <label style={s.lbl}>Photo URL (from Supabase Storage)</label>
          <input style={s.inp} placeholder="https://…supabase…/gnsi-public/rankers/student.jpg" value={form.photo_url} onChange={e=>setForm(f=>({...f,photo_url:e.target.value}))}/>
          {form.photo_url&&<img src={form.photo_url} alt="preview" style={{width:"70px",height:"70px",objectFit:"cover",borderRadius:"50%",border:`2px solid ${C.gold}`,marginBottom:"1rem"}} onError={e=>e.target.style.display="none"}/>}
          <div style={s.g2}>
            <div><label style={s.lbl}>Sort Order</label><input type="number" style={s.inp} value={form.sort_order} onChange={e=>setForm(f=>({...f,sort_order:+e.target.value}))}/></div>
          </div>
          <button style={{...s.btnG,opacity:saving?.6:1}} onClick={save} disabled={saving}>{saving?"Saving…":editing?"Update Ranker":"Add to Ranker Wall →"}</button>
        </div>
      </div>

      {load?<div style={s.loading}><Spin/>Loading rankers…</div>:!rows.length?<div style={s.empty}>No rankers yet — add your first selected student above</div>:(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:".8rem"}}>
          {rows.map(r=>(
            <div key={r.id} style={{...s.card,marginBottom:0}}>
              <div style={{padding:"1rem",textAlign:"center"}}>
                {r.photo_url
                  ?<img src={r.photo_url} alt={r.name} style={{width:"64px",height:"64px",borderRadius:"50%",objectFit:"cover",border:`2px solid ${C.gold}`,margin:"0 auto .7rem"}} onError={e=>e.target.style.display="none"}/>
                  :<div style={{width:"64px",height:"64px",borderRadius:"50%",background:C.navy,border:`2px solid ${C.gold}`,margin:"0 auto .7rem",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'EB Garamond',serif",fontSize:"1.3rem",color:C.goldL}}>{(r.name||"S")[0]}</div>
                }
                {r.rank&&<div style={{background:"rgba(184,146,42,.2)",color:C.goldLL,fontFamily:"'Rajdhani',sans-serif",fontWeight:700,fontSize:".6rem",letterSpacing:".1em",textTransform:"uppercase",padding:".15rem .5rem",marginBottom:".4rem",display:"inline-block"}}>{r.rank}</div>}
                <div style={{color:"#F8F3E8",fontFamily:"'EB Garamond',serif",fontSize:".97rem",marginBottom:".2rem"}}>{r.name}</div>
                <div style={{color:C.goldL,fontFamily:"'Rajdhani',sans-serif",fontSize:".68rem",letterSpacing:".08em",textTransform:"uppercase",marginBottom:".15rem"}}>{r.school}</div>
                <div style={{color:"rgba(248,243,232,.35)",fontFamily:"'Rajdhani',sans-serif",fontSize:".65rem"}}>{r.batch}</div>
              </div>
              <div style={{padding:".5rem",borderTop:"1px solid rgba(184,146,42,.1)",display:"flex",gap:".4rem",justifyContent:"center"}}>
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

  return (
    <div>
      <div style={{...s.card,borderColor:"rgba(184,146,42,.3)"}}>
        <div style={{...s.cardHd,cursor:"pointer"}} onClick={()=>setHint(!hint)}>
          <span style={s.cardTit}>📤 How to Upload Photos to Supabase</span>
          <span style={{color:C.goldL,fontSize:".75rem",fontFamily:"'Rajdhani',sans-serif"}}>{hint?"Hide ▲":"Show ▼"}</span>
        </div>
        {hint&&<div style={s.cardBdy}>
          {[["1","Supabase Dashboard","supabase.com → your project → Storage → Buckets"],["2","Create bucket","New Bucket → name: gnsi-public → enable Public access → Create"],["3","Upload photos","Open gnsi-public bucket → Upload → drag & drop photos (campus, rankers, faculty, results)"],["4","Get URL","Click any uploaded file → Copy URL → paste below"],["5","Folder structure (recommended)","gnsi-public/gallery/ · /rankers/ · /faculty/ · /results/ · /banners/ · /papers/"]].map(([n,t,d])=>(
            <div key={n} style={{display:"flex",gap:"1rem",marginBottom:".8rem",alignItems:"flex-start"}}>
              <div style={{width:"26px",height:"26px",background:C.gold,color:C.navy,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Rajdhani',sans-serif",fontWeight:700,fontSize:".75rem",flexShrink:0}}>{n}</div>
              <div><div style={{color:"#F8F3E8",fontWeight:600,fontSize:".85rem",marginBottom:".15rem"}}>{t}</div><div style={{color:"rgba(248,243,232,.45)",fontSize:".8rem"}}>{d}</div></div>
            </div>
          ))}
        </div>}
      </div>

      <div style={s.card}>
        <div style={s.cardHd}><span style={s.cardTit}>➕ Add Gallery Image</span></div>
        <div style={s.cardBdy}>
          <label style={s.lbl}>Image URL *</label>
          <input style={s.inp} placeholder="https://hiqaqdfhopuakaydfkgb.supabase.co/storage/v1/object/public/gnsi-public/gallery/photo.jpg" value={form.image_url} onChange={e=>setForm(f=>({...f,image_url:e.target.value}))}/>
          {form.image_url&&<img src={form.image_url} alt="preview" style={{width:"100%",maxHeight:"180px",objectFit:"cover",marginBottom:"1rem",border:"1px solid rgba(184,146,42,.2)"}} onError={e=>e.target.style.display="none"}/>}
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
            <div key={img.id} style={{background:"rgba(21,53,97,.4)",border:"1px solid rgba(184,146,42,.15)",overflow:"hidden"}}>
              <img src={img.image_url} alt={img.caption} style={{width:"100%",aspectRatio:"4/3",objectFit:"cover",display:"block"}} onError={e=>e.target.style.display="none"}/>
              <div style={{padding:".7rem"}}>
                <input defaultValue={img.caption} onBlur={e=>{if(e.target.value!==img.caption)updateCaption(img.id,e.target.value)}} style={{...s.inp,marginBottom:".5rem",fontSize:".78rem",padding:"6px 10px"}} placeholder="Caption…"/>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{color:"rgba(248,243,232,.3)",fontSize:".62rem",fontFamily:"'Rajdhani',sans-serif",letterSpacing:".06em",textTransform:"uppercase"}}>{img.category}</span>
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
      <div style={{...s.card,borderColor:"rgba(184,146,42,.3)",marginBottom:"1rem"}}>
        <div style={s.cardHd}><span style={s.cardTit}>📋 Setup — Create Table First</span></div>
        <div style={s.cardBdy}>
          <pre style={{background:"rgba(0,0,0,.3)",padding:".8rem",fontSize:".72rem",color:"#4AE382",overflowX:"auto",lineHeight:1.6,whiteSpace:"pre-wrap",marginBottom:".7rem"}}>{SQL}</pre>
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
          <p style={{color:"rgba(248,243,232,.28)",fontSize:".72rem",fontFamily:"'Rajdhani',sans-serif",marginTop:".5rem"}}>Past events remain in the list but won't show on the homepage automatically — delete or mark inactive once they've passed.</p>
        </div>
      </div>

      {load?<div style={s.loading}><Spin/>Loading events…</div>:!rows.length?<div style={s.empty}>No events yet — add your first event above</div>:(
        rows.map(ev=>{
          const isPast=ev.event_date<new Date().toISOString().slice(0,10);
          return(
            <div key={ev.id} style={{...s.card,opacity:(!ev.is_active||isPast)?.55:1}}>
              <div style={s.cardHd}>
                <div style={{display:"flex",alignItems:"center",gap:".7rem",flexWrap:"wrap"}}>
                  <span style={{color:C.goldLL,fontFamily:"'EB Garamond',serif",fontSize:"1.1rem",minWidth:"3.5rem"}}>{fmt(ev.event_date)}</span>
                  <span style={{color:"#F8F3E8",fontFamily:"'EB Garamond',serif",fontSize:"1rem"}}>{ev.title}</span>
                  {!ev.is_active&&<span style={{...s.badge("Low"),fontSize:".55rem"}}>Hidden</span>}
                  {isPast&&<span style={{...s.badge("Medium"),fontSize:".55rem"}}>Past</span>}
                </div>
                <div style={{display:"flex",gap:".4rem"}}>
                  <button style={s.btnG} onClick={()=>startEdit(ev)}>Edit</button>
                  <button style={s.btnGrn} onClick={()=>toggleActive(ev.id,ev.is_active)}>{ev.is_active?"Hide":"Show"}</button>
                  <button style={s.btnR} onClick={()=>del(ev.id)}>Delete</button>
                </div>
              </div>
              {ev.description&&<div style={{padding:".7rem 1.1rem"}}><p style={{color:"rgba(248,243,232,.55)",fontSize:".83rem",lineHeight:1.7}}>{ev.description}</p></div>}
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
      <div style={{...s.card,borderColor:"rgba(184,146,42,.3)",marginBottom:"1rem"}}>
        <div style={s.cardHd}><span style={s.cardTit}>📋 Setup SQL</span></div>
        <div style={s.cardBdy}>
          <pre style={{background:"rgba(0,0,0,.3)",padding:".8rem",fontSize:".72rem",color:"#4AE382",overflowX:"auto",lineHeight:1.6,whiteSpace:"pre-wrap",marginBottom:".7rem"}}>{SQL}</pre>
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
          {thumb&&<img src={thumb} alt="thumb" style={{width:"200px",height:"112px",objectFit:"cover",marginBottom:"1rem",border:"1px solid rgba(184,146,42,.2)"}} onError={e=>e.target.style.display="none"}/>}
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
              {!t&&<div style={{width:"100%",aspectRatio:"16/9",background:"rgba(11,31,58,.5)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"2rem"}}>▶</div>}
              <div style={{padding:".8rem"}}>
                <div style={{color:"#F8F3E8",fontSize:".88rem",marginBottom:".25rem"}}>{v.title}</div>
                <div style={{color:"rgba(248,243,232,.35)",fontFamily:"'Rajdhani',sans-serif",fontSize:".68rem",letterSpacing:".06em",textTransform:"uppercase",marginBottom:".5rem"}}>{v.category} · {v.description}</div>
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
      <div style={{...s.card,borderColor:"rgba(184,146,42,.3)",marginBottom:"1rem"}}>
        <div style={s.cardHd}><span style={s.cardTit}>📋 Setup SQL</span></div>
        <div style={s.cardBdy}>
          <pre style={{background:"rgba(0,0,0,.3)",padding:".8rem",fontSize:".72rem",color:"#4AE382",overflowX:"auto",lineHeight:1.6,whiteSpace:"pre-wrap",marginBottom:".7rem"}}>{SQL}</pre>
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
          <label style={s.lbl}>Cover Image URL (optional)</label>
          <input style={s.inp} placeholder="https://…supabase…/blog-cover.jpg" value={form.image_url} onChange={e=>setForm(f=>({...f,image_url:e.target.value}))}/>
          {form.image_url&&<img src={form.image_url} alt="preview" style={{width:"100%",maxHeight:"140px",objectFit:"cover",marginBottom:"1rem",border:"1px solid rgba(184,146,42,.2)"}} onError={e=>e.target.style.display="none"}/>}
          <label style={s.lbl}>Body *</label>
          <textarea style={{...s.ta,minHeight:"140px"}} placeholder="Write the full article or news post here…" value={form.body} onChange={e=>setForm(f=>({...f,body:e.target.value}))} rows={6}/>
          <div style={{display:"flex",gap:".8rem",alignItems:"center"}}>
            <button style={{...s.btnG,opacity:saving?.6:1}} onClick={save} disabled={saving}>{saving?"Saving…":editing?"Update Post":"Publish Post →"}</button>
            <label style={{display:"flex",alignItems:"center",gap:".4rem",cursor:"pointer",fontFamily:"'Rajdhani',sans-serif",fontSize:".75rem",color:"rgba(248,243,232,.5)"}}>
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
              <span style={{color:"#F8F3E8",fontFamily:"'EB Garamond',serif",fontSize:"1rem"}}>{p.title}</span>
              {!p.is_published&&<span style={{...s.badge("Low"),fontSize:".55rem"}}>Draft</span>}
            </div>
            <div style={{display:"flex",gap:".4rem"}}>
              <button style={s.btnG} onClick={()=>startEdit(p)}>Edit</button>
              <button style={s.btnGrn} onClick={()=>toggle(p.id,p.is_published)}>{p.is_published?"Unpublish":"Publish"}</button>
              <button style={s.btnR} onClick={()=>del(p.id)}>Delete</button>
            </div>
          </div>
          <div style={{padding:".7rem 1.1rem"}}>
            <p style={{color:"rgba(248,243,232,.55)",fontSize:".83rem",lineHeight:1.7,marginBottom:".4rem"}}>{p.body?.slice(0,160)}{p.body?.length>160?"…":""}</p>
            <span style={{color:"rgba(248,243,232,.28)",fontSize:".68rem",fontFamily:"'Rajdhani',sans-serif",letterSpacing:".06em",textTransform:"uppercase"}}>{fmt(p.published_date)}</span>
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
      <div style={{...s.card,borderColor:"rgba(184,146,42,.3)",marginBottom:"1rem"}}>
        <div style={s.cardHd}><span style={s.cardTit}>📋 Setup SQL</span></div>
        <div style={s.cardBdy}>
          <pre style={{background:"rgba(0,0,0,.3)",padding:".8rem",fontSize:".72rem",color:"#4AE382",overflowX:"auto",lineHeight:1.6,whiteSpace:"pre-wrap",marginBottom:".7rem"}}>{SQL}</pre>
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
            <label style={{display:"flex",alignItems:"center",gap:".4rem",cursor:"pointer",fontFamily:"'Rajdhani',sans-serif",fontSize:".75rem",color:"rgba(248,243,232,.5)"}}>
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
              <span style={{color:"#F8F3E8",fontSize:".9rem"}}>{r.reviewer_name}</span>
              <span style={{color:"rgba(248,243,232,.3)",fontFamily:"'Rajdhani',sans-serif",fontSize:".68rem"}}>{fmt(r.review_date)}</span>
              {!r.is_featured&&<span style={{...s.badge("Low"),fontSize:".55rem"}}>Hidden</span>}
            </div>
            <div style={{display:"flex",gap:".4rem"}}>
              <button style={s.btnG} onClick={()=>startEdit(r)}>Edit</button>
              <button style={s.btnGrn} onClick={()=>toggle(r.id,r.is_featured)}>{r.is_featured?"Hide":"Show"}</button>
              <button style={s.btnR} onClick={()=>del(r.id)}>Delete</button>
            </div>
          </div>
          <div style={{padding:".7rem 1.1rem"}}>
            <p style={{color:"rgba(248,243,232,.6)",fontSize:".83rem",lineHeight:1.7,fontStyle:"italic"}}>"{r.review_text?.slice(0,200)}{r.review_text?.length>200?"…":""}"</p>
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
      <div style={{...s.card,borderColor:"rgba(184,146,42,.3)",marginBottom:"1rem"}}>
        <div style={s.cardHd}><span style={s.cardTit}>📋 Setup SQL + Upload Instructions</span></div>
        <div style={s.cardBdy}>
          <pre style={{background:"rgba(0,0,0,.3)",padding:".8rem",fontSize:".72rem",color:"#4AE382",overflowX:"auto",lineHeight:1.6,whiteSpace:"pre-wrap",marginBottom:".7rem"}}>{SQL}</pre>
          <button style={{...s.btnG,fontSize:".72rem",marginBottom:"1rem"}} onClick={()=>{navigator.clipboard.writeText(SQL);toast("SQL copied ✓");}}>📋 Copy SQL</button>
          <p style={{color:"rgba(248,243,232,.45)",fontSize:".82rem",lineHeight:1.7}}>📂 Upload PDFs to Supabase Storage: <strong style={{color:C.goldL}}>gnsi-public/papers/</strong> → e.g. <code style={{color:"#4AE382"}}>nvs-class6-2025.pdf</code>, <code style={{color:"#4AE382"}}>sainik-class6-2024.pdf</code></p>
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
              <thead><tr>{["Title","Class","Year","PDF Link",""].map(h=><th key={h} style={{background:"rgba(11,31,58,.6)",padding:".55rem .9rem",textAlign:"left",fontFamily:"'Rajdhani',sans-serif",fontWeight:700,fontSize:".64rem",letterSpacing:".12em",textTransform:"uppercase",color:C.goldL,borderBottom:"1px solid rgba(184,146,42,.12)"}}>{h}</th>)}</tr></thead>
              <tbody>{papers.map(p=>(
                <tr key={p.id}>
                  <td style={{padding:".55rem .9rem",borderBottom:"1px solid rgba(184,146,42,.06)",color:"rgba(248,243,232,.82)"}}>{p.title}</td>
                  <td style={{padding:".55rem .9rem",borderBottom:"1px solid rgba(184,146,42,.06)",color:"rgba(248,243,232,.5)",fontSize:".78rem"}}>{p.class_level}</td>
                  <td style={{padding:".55rem .9rem",borderBottom:"1px solid rgba(184,146,42,.06)",color:C.goldL,fontFamily:"'Rajdhani',sans-serif",fontWeight:600}}>{p.year}</td>
                  <td style={{padding:".55rem .9rem",borderBottom:"1px solid rgba(184,146,42,.06)"}}>{p.pdf_url?<a href={p.pdf_url} target="_blank" rel="noopener noreferrer" style={{color:"#4AE382",fontFamily:"'Rajdhani',sans-serif",fontSize:".72rem"}}>⬇ Download</a>:<span style={{color:"rgba(248,243,232,.25)",fontSize:".72rem"}}>No URL set</span>}</td>
                  <td style={{padding:".55rem .9rem",borderBottom:"1px solid rgba(184,146,42,.06)"}}><div style={{display:"flex",gap:".4rem"}}><button style={s.btnG} onClick={()=>startEdit(p)}>Edit</button><button style={s.btnR} onClick={()=>del(p.id)}>Del</button></div></td>
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
      <div style={{...s.card,borderColor:"rgba(184,146,42,.3)",marginBottom:"1rem"}}>
        <div style={s.cardHd}><span style={s.cardTit}>📋 Setup SQL</span></div>
        <div style={s.cardBdy}>
          <pre style={{background:"rgba(0,0,0,.3)",padding:".8rem",fontSize:".72rem",color:"#4AE382",overflowX:"auto",lineHeight:1.6,whiteSpace:"pre-wrap",marginBottom:".7rem"}}>{SQL}</pre>
          <button style={{...s.btnG,fontSize:".72rem"}} onClick={()=>{navigator.clipboard.writeText(SQL);toast("SQL copied ✓");}}>📋 Copy SQL</button>
          <p style={{color:"rgba(248,243,232,.45)",fontSize:".82rem",lineHeight:1.7,marginTop:".7rem"}}>📸 Upload celebration/result photos to <strong style={{color:C.goldL}}>gnsi-public/banners/</strong> in Supabase Storage. Recommended size: 1200×400px landscape.</p>
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
          <label style={s.lbl}>Background Image URL</label>
          <input style={s.inp} placeholder="https://…/gnsi-public/banners/result-2025.jpg" value={form.image_url} onChange={e=>setForm(f=>({...f,image_url:e.target.value}))}/>
          {form.image_url&&<img src={form.image_url} alt="preview" style={{width:"100%",maxHeight:"140px",objectFit:"cover",marginBottom:"1rem",border:"1px solid rgba(184,146,42,.2)"}} onError={e=>e.target.style.display="none"}/>}
          <div style={{display:"flex",gap:".8rem",alignItems:"center"}}>
            <button style={{...s.btnG,opacity:saving?.6:1}} onClick={save} disabled={saving}>{saving?"Saving…":editing?"Update Banner":"Add Banner →"}</button>
            <label style={{display:"flex",alignItems:"center",gap:".4rem",cursor:"pointer",fontFamily:"'Rajdhani',sans-serif",fontSize:".75rem",color:"rgba(248,243,232,.5)"}}>
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
              <span style={{color:C.goldL,fontFamily:"'Rajdhani',sans-serif",fontSize:".72rem"}}>{b.year_label}</span>
              <span style={{color:"#F8F3E8",fontFamily:"'EB Garamond',serif",fontSize:"1rem"}}>{b.title}</span>
            </div>
            <div style={{display:"flex",gap:".4rem"}}>
              <button style={s.btnG} onClick={()=>startEdit(b)}>Edit</button>
              <button style={s.btnGrn} onClick={()=>toggle(b.id,b.is_active)}>{b.is_active?"Hide":"Show"}</button>
              <button style={s.btnR} onClick={()=>del(b.id)}>Delete</button>
            </div>
          </div>
          {b.image_url&&<div style={{height:"100px",overflow:"hidden"}}><img src={b.image_url} alt={b.title} style={{width:"100%",height:"100%",objectFit:"cover",opacity:.6}} onError={e=>e.target.style.display="none"}/></div>}
          <div style={{padding:".6rem 1.1rem"}}>
            <p style={{color:"rgba(248,243,232,.45)",fontSize:".82rem"}}>{b.subtitle}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  ⑩ FACULTY
// ════════════════════════════════════════════════════════════
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
  const startEdit=f=>{setEdit(f.id);setForm({name:f.name,role:f.role,subject:f.subject||"",experience:f.experience||"",photo_url:f.photo_url||"",sort_order:f.sort_order||0});};

  return (
    <div>
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
          <label style={s.lbl}>Photo URL (Supabase Storage → gnsi-public/faculty/)</label>
          <input style={s.inp} placeholder="https://…supabase…/gnsi-public/faculty/name.jpg" value={form.photo_url} onChange={e=>setForm(f=>({...f,photo_url:e.target.value}))}/>
          {form.photo_url&&<img src={form.photo_url} alt="preview" style={{width:"80px",height:"80px",objectFit:"cover",borderRadius:"50%",border:`2px solid ${C.gold}`,marginBottom:"1rem"}} onError={e=>e.target.style.display="none"}/>}
          <button style={{...s.btnG,opacity:saving?.6:1}} onClick={save} disabled={saving}>{saving?"Saving…":editing?"Update Faculty":"Add to Website →"}</button>
        </div>
      </div>
      {load?<div style={s.loading}><Spin/>Loading…</div>:!rows.length?<div style={s.empty}>No faculty added yet</div>:(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:".8rem"}}>
          {rows.map(f=>(
            <div key={f.id} style={{...s.card,marginBottom:0}}>
              <div style={{padding:"1.1rem",textAlign:"center"}}>
                {f.photo_url?<img src={f.photo_url} alt={f.name} style={{width:"70px",height:"70px",borderRadius:"50%",objectFit:"cover",border:`2px solid ${C.gold}`,margin:"0 auto .8rem"}} onError={e=>e.target.style.display="none"}/>
                :<div style={{width:"70px",height:"70px",borderRadius:"50%",background:C.navy,border:`2px solid ${C.gold}`,margin:"0 auto .8rem",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'EB Garamond',serif",fontSize:"1.5rem",color:C.goldL}}>{(f.name||"F").split(" ").map(w=>w[0]).join("").slice(0,2)}</div>}
                <div style={{color:"#F8F3E8",fontFamily:"'EB Garamond',serif",fontSize:"1rem",marginBottom:".2rem"}}>{f.name}</div>
                <div style={{color:C.goldL,fontSize:".72rem",fontFamily:"'Rajdhani',sans-serif",letterSpacing:".08em",textTransform:"uppercase",marginBottom:".2rem"}}>{f.role}</div>
                {f.subject&&<div style={{color:"rgba(248,243,232,.45)",fontSize:".78rem",marginBottom:".15rem"}}>{f.subject}</div>}
                {f.experience&&<div style={{color:"rgba(248,243,232,.28)",fontSize:".68rem",fontFamily:"'Rajdhani',sans-serif"}}>{f.experience}</div>}
              </div>
              <div style={{padding:".6rem",borderTop:"1px solid rgba(184,146,42,.1)",display:"flex",gap:".5rem",justifyContent:"center"}}>
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
//  ⑪ SITE SETTINGS
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
    {key:"stat_students",       label:"Students Trained",            type:"text",    ph:"500+",               group:"Homepage Stats"},
    {key:"stat_officers",       label:"Officers Produced",           type:"text",    ph:"200+",               group:"Homepage Stats"},
    {key:"stat_years",          label:"Years of Excellence",         type:"text",    ph:"10+",                group:"Homepage Stats"},
    {key:"stat_rate",           label:"Selection Rate",              type:"text",    ph:"95%",                group:"Homepage Stats"},
    {key:"stat_selected",       label:"Selected Last Batch",         type:"text",    ph:"66",                 group:"Homepage Stats"},
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
CREATE TABLE IF NOT EXISTS website_rankers (id bigserial primary key, name text not null, school text, batch text, rank text, photo_url text, sort_order int default 0);
CREATE TABLE IF NOT EXISTS website_reviews (id bigserial primary key, reviewer_name text not null, review_text text, rating int default 5, review_date date default current_date, is_featured boolean default true, created_at timestamptz default now());
CREATE TABLE IF NOT EXISTS website_blog (id bigserial primary key, title text not null, body text, category text default 'News', image_url text, published_date date default current_date, is_published boolean default true, created_at timestamptz default now());
CREATE TABLE IF NOT EXISTS website_videos (id bigserial primary key, title text not null, youtube_url text, description text, category text default 'Campus', sort_order int default 0, created_at timestamptz default now());
CREATE TABLE IF NOT EXISTS website_result_banners (id bigserial primary key, title text not null, subtitle text, year_label text, image_url text, sort_order int default 0, is_active boolean default true, created_at timestamptz default now());
CREATE TABLE IF NOT EXISTS website_papers (id bigserial primary key, title text not null, exam_type text default 'NVS', class_level text default 'Class 6', year text, pdf_url text, sort_order int default 0, created_at timestamptz default now());
CREATE TABLE IF NOT EXISTS website_settings (key text primary key, value text, updated_at timestamptz default now());
CREATE TABLE IF NOT EXISTS enquiries (id bigserial primary key, student_name text, parent_name text, phone text, class_grade text, course text, message text, replied boolean default false, replied_at timestamptz, created_at timestamptz default now());
CREATE TABLE IF NOT EXISTS website_gallery (id bigserial primary key, image_url text not null, caption text, category text default 'Campus', sort_order int default 0, created_at timestamptz default now());
CREATE TABLE IF NOT EXISTS website_faculty (id bigserial primary key, name text not null, role text, subject text, experience text, photo_url text, sort_order int default 0);
CREATE TABLE IF NOT EXISTS website_events (id bigserial primary key, title text not null, description text, event_date date not null, sort_order int default 0, is_active boolean default true, created_at timestamptz default now());`;

  if(load)return<div style={s.loading}><Spin/>Loading settings…</div>;

  return (
    <div>
      {/* Master SQL block */}
      <div style={{...s.card,borderColor:"rgba(184,146,42,.35)",marginBottom:"1rem"}}>
        <div style={s.cardHd}><span style={s.cardTit}>🗄️ All Required Tables — Copy & Run in Supabase</span></div>
        <div style={s.cardBdy}>
          <p style={{color:"rgba(248,243,232,.45)",fontSize:".82rem",lineHeight:1.7,marginBottom:".8rem"}}>Run this SQL once in your Supabase SQL Editor (Dashboard → SQL Editor → New Query → Paste → Run):</p>
          <pre style={{background:"rgba(0,0,0,.35)",padding:".9rem",fontSize:".7rem",color:"#4AE382",overflowX:"auto",lineHeight:1.7,whiteSpace:"pre-wrap",marginBottom:".8rem"}}>{ALL_SQL}</pre>
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
                          style={{width:120,height:120,objectFit:"contain",background:"#fff",border:"1px solid rgba(184,146,42,.3)",padding:"6px"}}
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
    settings:  <SettingsSection/>,
  };

  return(
    <div style={{...s.wrap,background:C.navy,minHeight:"100vh"}}>
      {/* Header */}
      <div style={{marginBottom:"1.4rem",paddingBottom:"1rem",borderBottom:"1px solid rgba(184,146,42,.15)"}}>
        <h2 style={{fontFamily:"'EB Garamond',serif",color:"#F8F3E8",fontSize:"1.6rem",marginBottom:".3rem"}}>🌐 Website Manager</h2>
        <p style={{color:"rgba(248,243,232,.35)",fontFamily:"'Rajdhani',sans-serif",fontSize:".75rem",letterSpacing:".08em",textTransform:"uppercase"}}>
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