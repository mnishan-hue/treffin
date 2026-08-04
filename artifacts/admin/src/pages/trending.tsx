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

type ToggleType = "debate" | "article";

interface ToggleRowProps {
  id: number;
  label: string;
  sub: string;
  isTrending: boolean;
  type: ToggleType;
  onToggle: (id: number, type: ToggleType, value: boolean) => void;
  busy: boolean;
}

function ToggleRow({ id, label, sub, isTrending, type, onToggle, busy }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between px-3 py-3 border-b border-border/50 hover:bg-accent/20 transition-colors gap-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground text-sm line-clamp-2">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </div>
      <button
        onClick={() => onToggle(id, type, !isTrending)}
        disabled={busy}
        className={`shrink-0 px-3 py-2.5 min-h-[40px] rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${
          isTrending
            ? "bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25"
            : "bg-secondary text-muted-foreground border-border hover:text-foreground"
        }`}
      >
        {isTrending ? "🔥 Trending" : "Set"}
      </button>
    </div>
  );
}

export default function Trending() {
  const [debates, setDebates] = useState<AdminDebate[]>([]);
  const [articles, setArticles] = useState<AdminArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<"debates" | "articles">("debates");

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

  const handleToggle = async (id: number, type: ToggleType, value: boolean) => {
    const key = `${type}-${id}`;
    setBusyId(key);
    if (type === "debate") {
      await api.patch(`/admin/debates/${id}/trending`, { isTrending: value });
      setDebates((ds) => ds.map((d) => d.id === id ? { ...d, isTrending: value } : d));
    } else {
      await api.patch(`/admin/articles/${id}/trending`, { isTrending: value });
      setArticles((as) => as.map((a) => a.id === id ? { ...a, isTrending: value } : a));
    }
    setBusyId(null);
  };

  if (loading) return <div className="text-muted-foreground py-8 text-center">Loading…</div>;

  const trendingDebates = debates.filter((d) => d.isTrending).length;
  const trendingArticles = articles.filter((a) => a.isTrending).length;

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-4">Trending Control</h2>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex bg-card border border-border rounded-lg overflow-hidden w-full sm:w-auto">
          <button
            onClick={() => setTab("debates")}
            className={`flex-1 sm:flex-none px-4 py-2.5 min-h-[40px] text-sm transition-colors ${tab === "debates" ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
          >
            <span>Debates</span>
            <span className={`block sm:inline sm:ml-1 text-xs ${tab === "debates" ? "opacity-80" : "opacity-60"}`}>
              <span className="sm:hidden">{trendingDebates} trending</span>
              <span className="hidden sm:inline">({trendingDebates} trending)</span>
            </span>
          </button>
          <button
            onClick={() => setTab("articles")}
            className={`flex-1 sm:flex-none px-4 py-2.5 min-h-[40px] text-sm transition-colors ${tab === "articles" ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
          >
            <span>Articles</span>
            <span className={`block sm:inline sm:ml-1 text-xs ${tab === "articles" ? "opacity-80" : "opacity-60"}`}>
              <span className="sm:hidden">{trendingArticles} trending</span>
              <span className="hidden sm:inline">({trendingArticles} trending)</span>
            </span>
          </button>
        </div>
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {tab === "debates" && debates.map((d) => (
          <ToggleRow
            key={d.id}
            id={d.id}
            type="debate"
            label={d.title}
            sub={`${d.category} · ${d.participantCount} participants`}
            isTrending={d.isTrending}
            onToggle={handleToggle}
            busy={busyId === `debate-${d.id}`}
          />
        ))}
        {tab === "articles" && articles.map((a) => (
          <ToggleRow
            key={a.id}
            id={a.id}
            type="article"
            label={a.title}
            sub={`${a.category ?? "Uncategorized"} · ${a.likes} likes`}
            isTrending={a.isTrending}
            onToggle={handleToggle}
            busy={busyId === `article-${a.id}`}
          />
        ))}
        {((tab === "debates" && debates.length === 0) || (tab === "articles" && articles.length === 0)) && (
          <div className="py-12 text-center text-muted-foreground text-sm">No items</div>
        )}
      </div>
    </div>
  );
}
