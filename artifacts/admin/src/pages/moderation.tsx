import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface AdminDebate {
  id: number;
  title: string;
  description: string | null;
  category: string;
  participantCount: number;
  isLive: boolean;
  isTrending: boolean;
  isFeatured: boolean;
  isFrozen: boolean;
  frozenReason: string | null;
  healthScore: number | null;
  createdAt: string;
  hasOutcome: boolean;
}

interface AdminArticle {
  id: number;
  title: string;
  excerpt: string | null;
  content: string | null;
  authorId: number;
  category: string | null;
  readTime: number;
  likes: number;
  isTrending: boolean;
  isFeatured: boolean;
  createdAt: string;
}

interface AdminPost {
  id: number;
  type: string;
  authorId: number;
  content: string | null;
  title: string | null;
  isRemoved: boolean;
  createdAt: string;
}

interface AdminCommunity {
  id: number;
  name: string;
  emoji: string;
  memberCount: number;
  totalPosts: number;
  isPrivate: boolean;
  isLive: boolean;
  createdAt: string;
}

interface AdminReport {
  id: number;
  postId: number;
  reporterUserId: number | null;
  reason: string | null;
  createdAt: string;
  postContent: string | null;
  postTitle: string | null;
  reportCount: number;
  isFlagged: boolean;
  isRemoved: boolean;
}

type Tab = "reports" | "debates" | "articles" | "posts" | "communities";

function HealthBadge({ score }: { score: number | null }) {
  if (score === null) return null;
  const color = score >= 70 ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
    : score >= 40 ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
    : "bg-red-500/15 text-red-400 border-red-500/30";
  return (
    <span className={`text-[10px] font-bold border px-1.5 py-0.5 rounded-full ${color}`}>
      ❤ {score}
    </span>
  );
}

export default function Moderation() {
  const [tab, setTab] = useState<Tab>("reports");
  const [debates, setDebates] = useState<AdminDebate[]>([]);
  const [articles, setArticles] = useState<AdminArticle[]>([]);
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [communities, setCommunities] = useState<AdminCommunity[]>([]);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [freezeLoading, setFreezeLoading] = useState<number | null>(null);

  // soft-remove flow
  const [removePostId, setRemovePostId] = useState<number | null>(null);
  const [removeReason, setRemoveReason] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      if (tab === "reports") setReports(await api.get<AdminReport[]>("/admin/reports"));
      if (tab === "debates") setDebates(await api.get<AdminDebate[]>("/admin/debates"));
      if (tab === "articles") setArticles(await api.get<AdminArticle[]>("/admin/articles"));
      if (tab === "posts") setPosts(await api.get<AdminPost[]>("/admin/posts"));
      if (tab === "communities") setCommunities(await api.get<AdminCommunity[]>("/admin/communities"));
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [tab]);

  const handleDelete = async (id: number) => {
    const paths: Record<Tab, string> = {
      reports: `/admin/posts/${id}`,
      debates: `/admin/debates/${id}`,
      articles: `/admin/articles/${id}`,
      posts: `/admin/posts/${id}`,
      communities: `/admin/communities/${id}`,
    };
    await api.delete(paths[tab]);
    setConfirmId(null);
    await load();
  };

  const handleDeleteReportedPost = async (postId: number) => {
    setActionLoading(postId);
    try {
      await api.delete(`/admin/reports/posts/${postId}`);
      setReports(prev => prev.filter(r => r.postId !== postId));
    } catch {}
    setActionLoading(null);
    setConfirmId(null);
  };

  const handleDismissReport = async (postId: number) => {
    setActionLoading(postId);
    try {
      await api.patch(`/admin/reports/posts/${postId}/dismiss`, {});
      setReports(prev => prev.filter(r => r.postId !== postId));
    } catch {}
    setActionLoading(null);
  };

  const handleSoftRemove = async (postId: number) => {
    setActionLoading(postId);
    try {
      await api.patch(`/admin/posts/${postId}/remove`, { isRemoved: true, reason: removeReason || "Violated community guidelines" });
      setReports(prev => prev.filter(r => r.postId !== postId));
    } catch {}
    setActionLoading(null);
    setRemovePostId(null);
    setRemoveReason("");
  };

  const handleFreeze = async (debate: AdminDebate) => {
    setFreezeLoading(debate.id);
    try {
      await api.patch(`/admin/debates/${debate.id}/freeze`, { isFrozen: !debate.isFrozen });
      setDebates(prev => prev.map(d => d.id === debate.id ? { ...d, isFrozen: !d.isFrozen } : d));
    } catch {}
    setFreezeLoading(null);
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "reports", label: "Reports" },
    { id: "debates", label: "Debates" },
    { id: "articles", label: "Articles" },
    { id: "posts", label: "Posts" },
    { id: "communities", label: "Communities" },
  ];

  const filterItems = <T extends { title?: string | null; name?: string | null; content?: string | null }>(items: T[]) =>
    items.filter((item) => {
      const text = ((item.title ?? item.name ?? item.content) || "").toLowerCase();
      return !search || text.includes(search.toLowerCase());
    });

  const uniqueReportedPosts = Array.from(
    new Map(reports.map(r => [r.postId, r])).values()
  ).filter(r => {
    if (!search) return true;
    const text = (r.postContent ?? r.postTitle ?? "").toLowerCase();
    return text.includes(search.toLowerCase());
  });

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString();

  const isEmpty =
    (tab === "reports" && uniqueReportedPosts.length === 0) ||
    (tab === "debates" && filterItems(debates).length === 0) ||
    (tab === "articles" && filterItems(articles).length === 0) ||
    (tab === "posts" && filterItems(posts).length === 0) ||
    (tab === "communities" && filterItems(communities).length === 0);

  function HardDeleteActions({ id }: { id: number }) {
    if (confirmId === id) {
      return (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Delete?</span>
          <button
            onClick={() => handleDelete(id)}
            className="text-xs px-3 py-2 bg-destructive text-destructive-foreground rounded-lg font-medium min-h-[36px]"
          >
            Yes
          </button>
          <button
            onClick={() => setConfirmId(null)}
            className="text-xs px-3 py-2 bg-secondary text-secondary-foreground rounded-lg min-h-[36px]"
          >
            No
          </button>
        </div>
      );
    }
    return (
      <button
        onClick={() => setConfirmId(id)}
        className="text-xs px-3 py-2 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg hover:bg-destructive hover:text-white transition-colors min-h-[36px]"
      >
        Delete
      </button>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-4">Content Moderation</h2>

      {/* Tab bar */}
      <div className="flex bg-card border border-border rounded-xl overflow-hidden mb-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setSearch(""); setConfirmId(null); setExpanded(null); setRemovePostId(null); setRemoveReason(""); }}
            className={`flex-1 py-2.5 min-h-[40px] text-sm capitalize transition-colors text-center relative ${
              tab === t.id
                ? "bg-primary text-primary-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            {t.id === "reports" && reports.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
                {uniqueReportedPosts.length > 9 ? "9+" : uniqueReportedPosts.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search…"
        className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 mb-3 min-h-[44px]"
      />

      {loading ? (
        <div className="text-muted-foreground py-8 text-center flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Loading…
        </div>
      ) : isEmpty ? (
        <div className="bg-card border border-border rounded-xl py-12 text-center text-muted-foreground text-sm">
          {tab === "reports" ? "✓ No reported posts — all clear!" : "No items found"}
        </div>
      ) : (
        <div className="flex flex-col gap-2">

          {/* REPORTS TAB */}
          {tab === "reports" && uniqueReportedPosts.map((r) => {
            const isLoading = actionLoading === r.postId;
            const isRemoving = removePostId === r.postId;
            const isConfirmingDelete = confirmId === r.postId;
            return (
              <div key={r.postId} className={`bg-card border rounded-xl overflow-hidden ${r.isFlagged ? "border-red-500/30" : "border-border"}`}>
                {/* Header row */}
                <button
                  className="w-full text-left px-4 py-3 hover:bg-accent/20 transition-colors"
                  onClick={() => setExpanded(expanded === r.postId ? null : r.postId)}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm leading-snug line-clamp-2">
                        {r.postContent ?? r.postTitle ?? "(empty post)"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Post #{r.postId} · <span className="font-semibold text-destructive">{r.reportCount} report{r.reportCount !== 1 ? "s" : ""}</span>
                        {r.reason ? ` · "${r.reason}"` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {r.isFlagged && (
                        <span className="text-[10px] font-bold bg-destructive/20 text-destructive border border-destructive/30 px-2 py-0.5 rounded-full">
                          Auto-flagged
                        </span>
                      )}
                      {r.isRemoved && (
                        <span className="text-[10px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full">
                          Removed
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                {/* Expanded content */}
                {expanded === r.postId && (
                  <div className="px-4 py-2.5 bg-accent/20 border-t border-border/50 text-sm text-muted-foreground whitespace-pre-wrap">
                    {r.postContent ?? r.postTitle ?? "(no content)"}
                  </div>
                )}

                {/* Soft-remove form */}
                {isRemoving && (
                  <div className="px-4 py-3 bg-orange-500/5 border-t border-orange-500/20">
                    <p className="text-xs text-orange-400 font-medium mb-2">Remove reason (shown to user if they appeal):</p>
                    <textarea
                      value={removeReason}
                      onChange={(e) => setRemoveReason(e.target.value)}
                      placeholder="e.g. Violates community guidelines — personal attacks"
                      rows={2}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/40 resize-none mb-2"
                    />
                    <div className="flex gap-2">
                      <button
                        disabled={isLoading}
                        onClick={() => handleSoftRemove(r.postId)}
                        className="text-xs px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
                      >
                        Confirm Remove
                      </button>
                      <button
                        onClick={() => { setRemovePostId(null); setRemoveReason(""); }}
                        className="text-xs px-3 py-2 bg-secondary text-secondary-foreground rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Action bar */}
                {!isRemoving && (
                  <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/50 bg-accent/5">
                    <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span>
                    <div className="flex items-center gap-2">
                      <button
                        disabled={isLoading}
                        onClick={() => handleDismissReport(r.postId)}
                        className="text-xs px-3 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors min-h-[36px] disabled:opacity-50"
                      >
                        Dismiss
                      </button>
                      {!r.isRemoved && (
                        <button
                          disabled={isLoading}
                          onClick={() => { setRemovePostId(r.postId); setRemoveReason(""); }}
                          className="text-xs px-3 py-2 bg-orange-500/15 text-orange-400 border border-orange-500/25 rounded-lg hover:bg-orange-500 hover:text-white transition-colors min-h-[36px] disabled:opacity-50"
                        >
                          Soft Remove
                        </button>
                      )}
                      {isConfirmingDelete ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">Hard delete?</span>
                          <button
                            onClick={() => handleDeleteReportedPost(r.postId)}
                            className="text-xs px-3 py-2 bg-destructive text-destructive-foreground rounded-lg font-medium min-h-[36px]"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setConfirmId(null)}
                            className="text-xs px-3 py-2 bg-secondary text-secondary-foreground rounded-lg min-h-[36px]"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          disabled={isLoading}
                          onClick={() => setConfirmId(r.postId)}
                          className="text-xs px-3 py-2 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg hover:bg-destructive hover:text-white transition-colors min-h-[36px] disabled:opacity-50"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* DEBATES TAB */}
          {tab === "debates" && filterItems(debates).map((d) => (
            <div key={d.id} className={`bg-card border rounded-xl overflow-hidden ${d.isFrozen ? "border-blue-500/30" : "border-border"}`}>
              <button
                className="w-full text-left px-4 py-3 hover:bg-accent/20 transition-colors"
                onClick={() => setExpanded(expanded === d.id ? null : d.id)}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm leading-snug">{d.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {d.category} · {d.participantCount} participants
                      {d.isTrending && " · 🔥"}
                      {d.isFeatured && " · ⭐"}
                      {d.isLive && " · 🔴 Live"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <HealthBadge score={d.healthScore ?? null} />
                    {d.isFrozen && (
                      <span className="text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">
                        ❄ Frozen
                      </span>
                    )}
                  </div>
                </div>
              </button>
              {expanded === d.id && d.description && (
                <div className="px-4 py-2.5 bg-accent/20 border-t border-border/50 text-sm text-muted-foreground">
                  {d.description}
                  {d.frozenReason && (
                    <p className="mt-1 text-blue-400 text-xs">Freeze reason: {d.frozenReason}</p>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/50 bg-accent/5">
                <span className="text-xs text-muted-foreground">{formatDate(d.createdAt)}</span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={freezeLoading === d.id}
                    onClick={() => handleFreeze(d)}
                    className={`text-xs px-3 py-2 rounded-lg border transition-colors min-h-[36px] disabled:opacity-50 ${
                      d.isFrozen
                        ? "bg-blue-500/15 text-blue-400 border-blue-500/30 hover:bg-blue-500 hover:text-white"
                        : "bg-secondary text-secondary-foreground border-transparent hover:bg-secondary/80"
                    }`}
                  >
                    {freezeLoading === d.id ? "…" : d.isFrozen ? "❄ Unfreeze" : "Freeze"}
                  </button>
                  <HardDeleteActions id={d.id} />
                </div>
              </div>
            </div>
          ))}

          {/* ARTICLES TAB */}
          {tab === "articles" && filterItems(articles).map((a) => (
            <div key={a.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <button
                className="w-full text-left px-4 py-3 hover:bg-accent/20 transition-colors"
                onClick={() => setExpanded(expanded === a.id ? null : a.id)}
              >
                <p className="font-medium text-foreground text-sm leading-snug">{a.title}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {a.category ?? "Uncategorized"} · {a.likes} likes
                  {a.isTrending && " · 🔥"}
                  {a.isFeatured && " · ⭐"}
                </p>
              </button>
              {expanded === a.id && (a.content || a.excerpt) && (
                <div className="px-4 py-2.5 bg-accent/20 border-t border-border/50 text-sm text-muted-foreground whitespace-pre-wrap line-clamp-6">
                  {a.content ?? a.excerpt}
                </div>
              )}
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/50 bg-accent/5">
                <span className="text-xs text-muted-foreground">{formatDate(a.createdAt)}</span>
                <HardDeleteActions id={a.id} />
              </div>
            </div>
          ))}

          {/* POSTS TAB */}
          {tab === "posts" && filterItems(posts).map((p) => (
            <div key={p.id} className={`bg-card border rounded-xl overflow-hidden ${p.isRemoved ? "border-orange-500/25 opacity-60" : "border-border"}`}>
              <div className="px-4 py-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm leading-snug line-clamp-3">{p.content ?? p.title ?? "(empty)"}</p>
                    <p className="text-xs text-muted-foreground mt-1 capitalize">{p.type} · User #{p.authorId}</p>
                  </div>
                  {p.isRemoved && (
                    <span className="text-[10px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full shrink-0">
                      Removed
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/50 bg-accent/5">
                <span className="text-xs text-muted-foreground">{formatDate(p.createdAt)}</span>
                <HardDeleteActions id={p.id} />
              </div>
            </div>
          ))}

          {/* COMMUNITIES TAB */}
          {tab === "communities" && filterItems(communities).map((c) => (
            <div key={c.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3">
                <p className="font-medium text-foreground text-sm">{c.emoji} {c.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {c.memberCount.toLocaleString()} members · {c.totalPosts} posts
                  {c.isPrivate && " · Private"}
                  {c.isLive && " · 🔴 Live"}
                </p>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/50 bg-accent/5">
                <span className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</span>
                <HardDeleteActions id={c.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
