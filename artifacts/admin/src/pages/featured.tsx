import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface AdminDebate {
  id: number;
  title: string;
  category: string;
  participantCount: number;
  isTrending: boolean;
  isFeatured: boolean;
  createdAt: string;
  hasOutcome: boolean;
  isLive: boolean;
}

interface AdminArticle {
  id: number;
  title: string;
  excerpt: string | null;
  authorId: number;
  category: string | null;
  readTime: number;
  likes: number;
  isTrending: boolean;
  isFeatured: boolean;
  createdAt: string;
}

const MAX_FEATURED = 3;

export default function Featured() {
  const [debates, setDebates] = useState<AdminDebate[]>([]);
  const [articles, setArticles] = useState<AdminArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [d, a] = await Promise.all([
      api.get<AdminDebate[]>("/admin/debates"),
      api.get<AdminArticle[]>("/admin/articles"),
    ]);
    setDebates(d);
    setArticles(a);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleDebateFeatured = async (id: number, value: boolean) => {
    if (value && debates.filter((d) => d.isFeatured).length >= MAX_FEATURED) {
      setWarn("Max 3 featured debates allowed. Remove one first.");
      setTimeout(() => setWarn(null), 3000);
      return;
    }
    setBusyId(`debate-${id}`);
    await api.patch(`/admin/debates/${id}/featured`, { isFeatured: value });
    setDebates((ds) => ds.map((d) => d.id === id ? { ...d, isFeatured: value } : d));
    setBusyId(null);
  };

  const toggleArticleFeatured = async (id: number, value: boolean) => {
    if (value && articles.filter((a) => a.isFeatured).length >= MAX_FEATURED) {
      setWarn("Max 3 featured articles allowed. Remove one first.");
      setTimeout(() => setWarn(null), 3000);
      return;
    }
    setBusyId(`article-${id}`);
    await api.patch(`/admin/articles/${id}/featured`, { isFeatured: value });
    setArticles((as) => as.map((a) => a.id === id ? { ...a, isFeatured: value } : a));
    setBusyId(null);
  };

  if (loading) return <div className="text-muted-foreground py-8 text-center">Loading…</div>;

  const featuredDebates = debates.filter((d) => d.isFeatured);
  const featuredArticles = articles.filter((a) => a.isFeatured);

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-2">Featured Content</h2>
      <p className="text-sm text-muted-foreground mb-4">Pin up to {MAX_FEATURED} debates and {MAX_FEATURED} articles as Editor's Pick</p>
      {warn && (
        <div className="mb-4 px-4 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg text-sm">{warn}</div>
      )}
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            ⚡ Debates <span className="text-xs text-muted-foreground font-normal">({featuredDebates.length}/{MAX_FEATURED} featured)</span>
          </h3>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {debates.map((d) => (
              <div key={d.id} className="flex items-center justify-between px-4 py-3 border-b border-border/50 hover:bg-accent/20 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{d.title}</p>
                  <p className="text-xs text-muted-foreground">{d.category}</p>
                </div>
                <button
                  onClick={() => toggleDebateFeatured(d.id, !d.isFeatured)}
                  disabled={busyId === `debate-${d.id}`}
                  className={`shrink-0 ml-3 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${
                    d.isFeatured
                      ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/25"
                      : "bg-secondary text-muted-foreground border-border hover:text-foreground"
                  }`}
                >
                  {d.isFeatured ? "⭐ Featured" : "Pin"}
                </button>
              </div>
            ))}
            {debates.length === 0 && <div className="py-8 text-center text-muted-foreground text-sm">No debates</div>}
          </div>
        </div>
        <div>
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            📰 Articles <span className="text-xs text-muted-foreground font-normal">({featuredArticles.length}/{MAX_FEATURED} featured)</span>
          </h3>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {articles.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-4 py-3 border-b border-border/50 hover:bg-accent/20 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.category ?? "Uncategorized"}</p>
                </div>
                <button
                  onClick={() => toggleArticleFeatured(a.id, !a.isFeatured)}
                  disabled={busyId === `article-${a.id}`}
                  className={`shrink-0 ml-3 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${
                    a.isFeatured
                      ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/25"
                      : "bg-secondary text-muted-foreground border-border hover:text-foreground"
                  }`}
                >
                  {a.isFeatured ? "⭐ Featured" : "Pin"}
                </button>
              </div>
            ))}
            {articles.length === 0 && <div className="py-8 text-center text-muted-foreground text-sm">No articles</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
