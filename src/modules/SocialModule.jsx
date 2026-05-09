/* GNSI PORTAL — SocialModule.jsx
   Pages: gnsi_social — Staff platform with posts, tabs, composer
   Props: { currentUser, staff, showToast }
*/

import { useState, useRef } from "react";

/* ── Helpers ── */
const today = () => new Date().toISOString().split("T")[0];
const fmtRelTime = (ts) => {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};
const esc = (s) => String(s ?? "");
const nextId = () => `post_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

/* ── Initial seed posts ── */
const SEED_POSTS = [
  { id: "p1", authorName: "Admin", authorRole: "admin", category: "announcement", title: "Welcome to GNSI Social!", body: "This is the staff platform for sharing updates, resources, and staying connected. Post your achievements, announcements, and resources here!", tags: ["welcome"], createdAt: new Date(Date.now() - 3600000 * 24).toISOString(), reactions: { "👍": [], "🎉": [], "❤️": [] }, comments: [] },
  { id: "p2", authorName: "Admin", authorRole: "admin", category: "resource", title: "Exam Schedule Posted", body: "The 2nd unit test schedule has been uploaded. Please check the Timetable section for details and prepare your students accordingly.", tags: ["exam", "schedule"], createdAt: new Date(Date.now() - 3600000 * 6).toISOString(), reactions: { "👍": ["user1"], "🎉": [], "❤️": [] }, comments: [{ id: "c1", author: "Teacher", text: "Thank you for the update!", ts: new Date(Date.now() - 3600000 * 2).toISOString() }] },
];

const CATS = [
  { id: "all", icon: "🌐", label: "All", color: "#1433a8" },
  { id: "announcement", icon: "📢", label: "Announcements", color: "#dc2626" },
  { id: "achievement", icon: "🏆", label: "Achievements", color: "#d97706" },
  { id: "resource", icon: "📚", label: "Resources", color: "#16a34a" },
  { id: "discussion", icon: "💬", label: "Discussion", color: "#7c3aed" },
  { id: "event", icon: "📅", label: "Events", color: "#0891b2" },
  { id: "polls", icon: "📊", label: "Polls", color: "#db2777" },
  { id: "other", icon: "✨", label: "Other", color: "#64748b" },
];

const REACTIONS = ["👍", "🎉", "❤️", "😮", "🔥"];

const inputStyle = { width: "100%", border: "1.5px solid var(--border)", borderRadius: 10, padding: "10px 14px", fontSize: 13.5, background: "var(--surface)", color: "var(--text)", boxSizing: "border-box" };
const btnPrimary = { display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", borderRadius: 12, background: "linear-gradient(135deg,var(--accent),#2563eb)", color: "#fff", border: "none", cursor: "pointer", fontSize: 13.5, fontWeight: 800 };

/* ── Avatar ── */
function Avatar({ name, size = 36 }) {
  const hue = (name || "A").charCodeAt(0) % 360;
  const initials = (name || "?").split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: `linear-gradient(135deg,hsl(${hue},65%,35%),hsl(${hue},55%,50%))`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: size * 0.38, flexShrink: 0, border: "2px solid rgba(255,255,255,.2)" }}>
      {initials}
    </div>
  );
}

/* ── Post Card ── */
function PostCard({ post, currentUser, onReact, onComment, onDelete, onSave, isSaved }) {
  const [showComment, setShowComment] = useState(false);
  const [commentText, setCommentText] = useState("");
  const cat = CATS.find((c) => c.id === post.category) || CATS[CATS.length - 1];
  const isOwn = post.authorName === currentUser?.name;
  const isAdm = ["admin", "manager"].includes(currentUser?.role);
  const totalReactions = Object.values(post.reactions || {}).reduce((s, v) => s + v.length, 0);

  const submitComment = () => {
    if (!commentText.trim()) return;
    onComment(post.id, commentText.trim());
    setCommentText("");
    setShowComment(false);
  };

  return (
    <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 14, marginBottom: 14, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "14px 18px 10px", display: "flex", alignItems: "flex-start", gap: 12 }}>
        <Avatar name={post.authorName} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{post.authorName}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: cat.color, background: `${cat.color}18`, borderRadius: 10, padding: "2px 8px", border: `1px solid ${cat.color}33` }}>{cat.icon} {cat.label}</span>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>{fmtRelTime(post.createdAt)}</div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button onClick={() => onSave(post.id)} title={isSaved ? "Unsave" : "Save"} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: isSaved ? "#f59e0b" : "var(--muted)" }}>🔖</button>
          {(isOwn || isAdm) && <button onClick={() => onDelete(post.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "var(--muted)" }}>🗑</button>}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "0 18px 12px" }}>
        {post.title && <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{post.title}</div>}
        <div style={{ fontSize: 13.5, color: "var(--text)", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{post.body}</div>
        {post.tags?.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            {post.tags.map((t) => <span key={t} style={{ fontSize: 11, color: "#2563eb", background: "#eff6ff", borderRadius: 6, padding: "2px 8px", fontWeight: 600 }}>#{t}</span>)}
          </div>
        )}
        {post.poll && (
          <div style={{ marginTop: 12, background: "var(--surface2)", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>📊 {post.poll.question}</div>
            {post.poll.options.map((opt, i) => {
              const votes = (post.poll.votes || {})[i] || [];
              const total = Object.values(post.poll.votes || {}).reduce((s, v) => s + v.length, 0);
              const pct = total > 0 ? Math.round(votes.length / total * 100) : 0;
              const voted = votes.includes(currentUser?.id);
              return (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}><span style={{ fontWeight: voted ? 700 : 400 }}>{opt}</span><span style={{ color: "var(--muted)" }}>{pct}% ({votes.length})</span></div>
                  <div style={{ height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}><div style={{ height: "100%", width: `${pct}%`, background: "var(--accent)", borderRadius: 4, transition: "width .4s" }} /></div>
                </div>
              );
            })}
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>{Object.values(post.poll.votes || {}).reduce((s, v) => s + v.length, 0)} total votes</div>
          </div>
        )}
      </div>

      {/* Reactions & Actions */}
      <div style={{ padding: "8px 18px 12px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4, flex: 1, flexWrap: "wrap" }}>
          {REACTIONS.map((r) => {
            const count = (post.reactions?.[r] || []).length;
            const reacted = (post.reactions?.[r] || []).includes(currentUser?.id);
            return (
              <button key={r} onClick={() => onReact(post.id, r)} style={{ padding: "4px 10px", borderRadius: 20, border: `1.5px solid ${reacted ? "var(--accent)" : "var(--border)"}`, background: reacted ? "var(--accent-light)" : "transparent", cursor: "pointer", fontSize: 12.5, color: reacted ? "var(--accent)" : "var(--muted)", fontWeight: reacted ? 700 : 400 }}>
                {r}{count > 0 ? ` ${count}` : ""}
              </button>
            );
          })}
        </div>
        <button onClick={() => setShowComment(!showComment)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12.5, color: "var(--muted)", fontWeight: 600 }}>
          💬 {(post.comments || []).length} {(post.comments || []).length === 1 ? "comment" : "comments"}
        </button>
      </div>

      {/* Comments */}
      {(post.comments || []).length > 0 && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "10px 18px" }}>
          {(post.comments || []).map((c) => (
            <div key={c.id} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <Avatar name={c.author} size={28} />
              <div style={{ flex: 1, background: "var(--surface2)", borderRadius: 10, padding: "8px 12px" }}>
                <div style={{ fontWeight: 700, fontSize: 12 }}>{c.author} <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: 11 }}>{fmtRelTime(c.ts)}</span></div>
                <div style={{ fontSize: 13, marginTop: 2 }}>{c.text}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Comment Input */}
      {showComment && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "10px 18px", display: "flex", gap: 10, alignItems: "center" }}>
          <Avatar name={currentUser?.name} size={30} />
          <input value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Write a comment…" onKeyDown={(e) => e.key === "Enter" && submitComment()} style={{ ...inputStyle, padding: "8px 12px", fontSize: 13, flex: 1 }} />
          <button onClick={submitComment} style={{ ...btnPrimary, padding: "8px 14px", fontSize: 12 }}>Post</button>
        </div>
      )}
    </div>
  );
}

/* ── Composer ── */
function Composer({ currentUser, onPost, onCancel, editPost }) {
  const [form, setForm] = useState(editPost || { category: "announcement", title: "", body: "", tags: [] });
  const [tagInput, setTagInput] = useState("");
  const [hasPoll, setHasPoll] = useState(false);
  const [pollQ, setPollQ] = useState("");
  const [pollOpts, setPollOpts] = useState(["", ""]);

  const addTag = () => {
    if (!tagInput.trim()) return;
    setForm((f) => ({ ...f, tags: [...(f.tags || []), tagInput.trim().toLowerCase()] }));
    setTagInput("");
  };

  const submit = () => {
    if (!form.body.trim()) return;
    const post = {
      id: editPost?.id || nextId(),
      authorName: currentUser?.name || "Staff",
      authorRole: currentUser?.role || "staff",
      createdAt: editPost?.createdAt || new Date().toISOString(),
      reactions: editPost?.reactions || {},
      comments: editPost?.comments || [],
      ...form,
      ...(hasPoll && pollQ ? { poll: { question: pollQ, options: pollOpts.filter((o) => o.trim()), votes: {} } } : {}),
    };
    onPost(post);
  };

  const cat = CATS.find((c) => c.id === form.category) || CATS[1];

  return (
    <div style={{ background: "var(--surface)", border: `1.5px solid ${cat.color}`, borderRadius: 14, padding: 22, marginBottom: 20 }}>
      <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 700, color: cat.color, marginBottom: 16 }}>{editPost ? "✏️ Edit Post" : "✏️ New Post"}</div>

      {/* Category */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {CATS.slice(1).map((c) => (
          <button key={c.id} onClick={() => setForm((f) => ({ ...f, category: c.id }))} style={{ padding: "5px 12px", borderRadius: 20, border: `1.5px solid ${form.category === c.id ? c.color : "var(--border)"}`, background: form.category === c.id ? `${c.color}18` : "transparent", color: form.category === c.id ? c.color : "var(--muted)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      <div style={{ marginBottom: 12 }}>
        <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Post title (optional)" style={inputStyle} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <textarea value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} placeholder="What's on your mind? Share updates, resources, achievements…" rows={4} style={{ ...inputStyle, resize: "vertical" }} />
      </div>

      {/* Tags */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        {(form.tags || []).map((t, i) => (
          <span key={i} style={{ fontSize: 12, color: "#2563eb", background: "#eff6ff", borderRadius: 6, padding: "3px 10px", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
            #{t}<button onClick={() => setForm((f) => ({ ...f, tags: f.tags.filter((_, j) => j !== i) }))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#64748b", padding: 0 }}>×</button>
          </span>
        ))}
        <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTag()} placeholder="Add tag…" style={{ ...inputStyle, width: 120, padding: "5px 10px", fontSize: 12 }} />
      </div>

      {/* Poll toggle */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: hasPoll ? "#db2777" : "var(--muted)" }}>
          <input type="checkbox" checked={hasPoll} onChange={(e) => setHasPoll(e.target.checked)} style={{ accentColor: "#db2777" }} /> 📊 Add Poll
        </label>
        {hasPoll && (
          <div style={{ marginTop: 10, background: "var(--surface2)", borderRadius: 10, padding: 14 }}>
            <input value={pollQ} onChange={(e) => setPollQ(e.target.value)} placeholder="Poll question…" style={{ ...inputStyle, marginBottom: 10 }} />
            {pollOpts.map((opt, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input value={opt} onChange={(e) => setPollOpts((o) => o.map((x, j) => j === i ? e.target.value : x))} placeholder={`Option ${i + 1}`} style={{ ...inputStyle }} />
                {i > 1 && <button onClick={() => setPollOpts((o) => o.filter((_, j) => j !== i))} style={{ padding: "0 10px", borderRadius: 8, border: "none", background: "#fee2e2", color: "#dc2626", cursor: "pointer" }}>✕</button>}
              </div>
            ))}
            <button onClick={() => setPollOpts((o) => [...o, ""])} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 8, border: "1.5px solid var(--border)", background: "var(--surface)", cursor: "pointer", color: "var(--muted)" }}>+ Add Option</button>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={submit} style={btnPrimary}>{editPost ? "✅ Save Changes" : "📤 Post"}</button>
        <button onClick={onCancel} style={{ padding: "9px 16px", borderRadius: 9, border: "1.5px solid var(--border)", background: "var(--surface)", color: "var(--muted)", fontSize: 13, cursor: "pointer" }}>Cancel</button>
      </div>
    </div>
  );
}

/* ── Profile View ── */
function ProfileView({ name, posts, currentUser }) {
  const userPosts = posts.filter((p) => p.authorName === name);
  const hue = (name || "A").charCodeAt(0) % 360;
  return (
    <div>
      <div style={{ background: `linear-gradient(135deg,hsl(${hue},60%,30%),hsl(${hue},50%,45%))`, borderRadius: 14, padding: 24, display: "flex", gap: 16, alignItems: "center", marginBottom: 20, color: "#fff" }}>
        <Avatar name={name} size={60} />
        <div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 800 }}>{name}</div>
          <div style={{ fontSize: 13, opacity: .85, marginTop: 4 }}>{userPosts.length} posts · {userPosts.reduce((s, p) => s + (p.comments || []).length, 0)} comments</div>
        </div>
      </div>
      {userPosts.length ? userPosts.map((p) => (
        <div key={p.id} style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{p.title || "(no title)"}</div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>{p.body?.slice(0, 120)}{p.body?.length > 120 ? "…" : ""}</div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>{fmtRelTime(p.createdAt)}</div>
        </div>
      )) : <div style={{ textAlign: "center", color: "var(--muted)", padding: 40 }}>No posts yet.</div>}
    </div>
  );
}

/* ── Main Export ── */
export default function SocialModule({ currentUser, staff = [], showToast }) {
  const [posts, setPosts] = useState(() => {
    try { return JSON.parse(localStorage.getItem("gnsi_social_posts") || "null") || SEED_POSTS; } catch { return SEED_POSTS; }
  });
  const [savedIds, setSavedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem("gnsi_social_saved") || "[]"); } catch { return []; }
  });
  const [tab, setTab] = useState("feed");
  const [feedFilter, setFeedFilter] = useState("all");
  const [searchQ, setSearchQ] = useState("");
  const [editPost, setEditPost] = useState(null);
  const [profileUser, setProfileUser] = useState(null);

  const savePosts = (p) => { setPosts(p); try { localStorage.setItem("gnsi_social_posts", JSON.stringify(p)); } catch {} };
  const saveSaved = (s) => { setSavedIds(s); try { localStorage.setItem("gnsi_social_saved", JSON.stringify(s)); } catch {} };

  const handlePost = (post) => {
    const upd = editPost ? posts.map((p) => p.id === post.id ? post : p) : [post, ...posts];
    savePosts(upd);
    setTab("feed"); setEditPost(null);
    showToast?.(editPost ? "Post updated" : "Posted!", "#16a34a");
  };

  const handleDelete = (id) => {
    if (!window.confirm("Delete this post?")) return;
    savePosts(posts.filter((p) => p.id !== id));
    showToast?.("Post deleted", "#64748b");
  };

  const handleReact = (postId, emoji) => {
    const uid = currentUser?.id || currentUser?.name || "user";
    savePosts(posts.map((p) => {
      if (p.id !== postId) return p;
      const rMap = { ...(p.reactions || {}) };
      if (!rMap[emoji]) rMap[emoji] = [];
      if (rMap[emoji].includes(uid)) rMap[emoji] = rMap[emoji].filter((x) => x !== uid);
      else rMap[emoji] = [...rMap[emoji], uid];
      return { ...p, reactions: rMap };
    }));
  };

  const handleComment = (postId, text) => {
    const uid = currentUser?.name || "You";
    savePosts(posts.map((p) => p.id !== postId ? p : { ...p, comments: [...(p.comments || []), { id: `c${Date.now()}`, author: uid, text, ts: new Date().toISOString() }] }));
  };

  const handleSave = (id) => {
    const upd = savedIds.includes(id) ? savedIds.filter((x) => x !== id) : [...savedIds, id];
    saveSaved(upd);
  };

  /* Filtered posts for feed/saved */
  const postsToShow = tab === "saved" ? posts.filter((p) => savedIds.includes(p.id)) : posts;
  const filtered = postsToShow.filter((p) => {
    if (feedFilter !== "all") {
      if (feedFilter === "polls" && !p.poll) return false;
      if (feedFilter !== "polls" && p.category !== feedFilter) return false;
    }
    if (searchQ) {
      const q = searchQ.toLowerCase();
      return (p.title || "").toLowerCase().includes(q) || (p.body || "").toLowerCase().includes(q) || (p.authorName || "").toLowerCase().includes(q) || (p.tags || []).some((t) => t.toLowerCase().includes(q));
    }
    return true;
  });

  /* Stats */
  const totalPosts = posts.length;
  const todayPosts = posts.filter((p) => p.createdAt?.startsWith(today())).length;
  const totalComments = posts.reduce((s, p) => s + (p.comments || []).length, 0);
  const totalReactions = posts.reduce((s, p) => s + Object.values(p.reactions || {}).reduce((rs, v) => rs + v.length, 0), 0);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 23, fontWeight: 700, color: "var(--text)", display: "flex", alignItems: "center", gap: 10 }}>
            🌐 GNSI Social
            <span style={{ fontSize: 12, fontWeight: 700, color: "#16a34a", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 12, padding: "2px 10px" }}>Staff Platform</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>Share updates, achievements, resources and stay connected</div>
        </div>
        <button onClick={() => { setEditPost(null); setTab("create"); }} style={btnPrimary}>✏️ New Post</button>
      </div>

      {/* Tab Bar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {[["feed", "🏠", "Feed", ""], ["create", "✏️", "Compose", ""], ["saved", "🔖", "Saved", savedIds.length || ""], ["profile", "👤", "My Profile", ""]].map(([key, icon, label, badge]) => {
          const act = tab === key;
          return (
            <button key={key} onClick={() => setTab(key)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 18px", borderRadius: 20, border: act ? "none" : "1.5px solid var(--border)", background: act ? "linear-gradient(135deg,var(--accent),#2563eb)" : "var(--surface)", color: act ? "#fff" : "var(--muted)", fontSize: 12.5, fontWeight: act ? 800 : 600, cursor: "pointer" }}>
              {icon} {label}
              {badge ? <span style={{ background: act ? "rgba(255,255,255,.3)" : "#dc2626", color: "#fff", borderRadius: 20, padding: "1px 6px", fontSize: 10, fontWeight: 800 }}>{badge}</span> : null}
            </button>
          );
        })}
      </div>

      {/* Create / Edit */}
      {tab === "create" && (
        <Composer currentUser={currentUser} onPost={handlePost} onCancel={() => setTab("feed")} editPost={editPost} />
      )}

      {/* Feed / Saved */}
      {(tab === "feed" || tab === "saved") && (
        <div>
          {tab === "feed" && (
            <>
              {/* Category Pills */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                {CATS.map((c) => {
                  const cnt = c.id === "all" ? posts.length : c.id === "polls" ? posts.filter((p) => p.poll).length : posts.filter((p) => p.category === c.id).length;
                  const act = feedFilter === c.id;
                  return <button key={c.id} onClick={() => setFeedFilter(c.id)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 14px", borderRadius: 20, border: `1.5px solid ${act ? c.color : "var(--border)"}`, background: act ? `${c.color}18` : "var(--surface)", color: act ? c.color : "var(--muted)", fontSize: 12, fontWeight: act ? 800 : 600, cursor: "pointer" }}>{c.icon} {c.label} <span style={{ fontSize: 10.5, opacity: .7 }}>{cnt}</span></button>;
                })}
              </div>

              {/* Search */}
              <div style={{ position: "relative", marginBottom: 16 }}>
                <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="🔍 Search posts, topics, people…" style={{ ...inputStyle, paddingRight: 40 }} />
                {searchQ && <button onClick={() => setSearchQ("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 16 }}>✕</button>}
              </div>

              {/* Stats Strip */}
              {totalPosts > 0 && (
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
                  {[["📝", totalPosts, "Total Posts"], ["📅", todayPosts, "Today"], ["💬", totalComments, "Comments"], ["👍", totalReactions, "Reactions"]].map(([icon, val, label]) => (
                    <div key={label} style={{ background: "var(--surface2)", border: "1px solid var(--border-soft)", borderRadius: 10, padding: "8px 14px", display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ fontSize: 16 }}>{icon}</span><span style={{ fontWeight: 800, fontSize: 14, color: "var(--accent)" }}>{val}</span><span style={{ fontSize: 11, color: "var(--muted)" }}>{label}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === "saved" && <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", marginBottom: 16 }}>🔖 {savedIds.length} saved post{savedIds.length !== 1 ? "s" : ""}</div>}

          {/* Posts */}
          {filtered.length ? filtered.map((p) => (
            <PostCard key={p.id} post={p} currentUser={currentUser} onReact={handleReact} onComment={handleComment} onDelete={handleDelete} onSave={handleSave} isSaved={savedIds.includes(p.id)} />
          )) : (
            <div style={{ textAlign: "center", padding: "64px 24px", color: "var(--muted)" }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>🌐</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{tab === "saved" ? "No saved posts yet" : "Nothing here yet"}</div>
              <div style={{ fontSize: 13, marginBottom: 20 }}>{tab === "saved" ? "Tap 🔖 on any post to save it" : "Be the first to post something for your colleagues!"}</div>
              {tab !== "saved" && <button onClick={() => setTab("create")} style={btnPrimary}>✏️ Create First Post</button>}
            </div>
          )}
        </div>
      )}

      {/* Profile Tab */}
      {tab === "profile" && <ProfileView name={currentUser?.name || "You"} posts={posts} currentUser={currentUser} />}
    </div>
  );
}
