import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  useGetDebates,
  useGetFeed,
  useGetArticles,
  useListMathProblems,
  getListMathProblemsQueryKey,
} from "@workspace/api-client-react";
import type { Debate, FeedPost, MathProblem, Article } from "@workspace/api-client-react";
import { Link } from "wouter";
import {
  Compass, MessageSquare, FileText, MessageCircle,
  Calculator, Clock, Users, Eye, Zap, TrendingUp,
  BookOpen, Hash, Search, X as XIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatNumber } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { MathText } from "@/components/math/math-renderer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/* ── Types ─────────────────────────────────────────────────────────── */
type FilterType = "all" | "debate" | "article" | "post" | "math";

type DiscoverItem =
  | { kind: "debate";  score: number; data: Debate }
  | { kind: "article"; score: number; data: Article }
  | { kind: "post";    score: number; data: FeedPost }
  | { kind: "math";    score: number; data: MathProblem };

/* ── Scoring: higher = show earlier ────────────────────────────────── */
function debateScore(d: Debate, idx: number): number {
  return d.participantCount * 10 + (d.isLive ? 500 : 0) + (d.isTrending ? 200 : 0) - idx * 2;
}
function feedScore(p: FeedPost, idx: number): number {
  const age = p.createdAt ? (Date.now() - new Date(p.createdAt).getTime()) / 3_600_000 : 48;
  return (p.likes ?? 0) * 5 + (p.comments ?? 0) * 8 - age * 3 - idx;
}
function articleScore(a: Article, idx: number): number {
  const age = a.createdAt ? (Date.now() - new Date(a.createdAt).getTime()) / 3_600_000 : 48;
  return a.likes * 5 + (a.isTrending ? 200 : 0) + (a.isFeatured ? 100 : 0) - age * 2 - idx;
}
function mathScore(m: MathProblem, idx: number): number {
  const age = m.createdAt ? (Date.now() - new Date(m.createdAt).getTime()) / 3_600_000 : 48;
  return m.viewCount * 2 + m.solutionCount * 15 - age * 2 - idx;
}

/* ── Utility ───────────────────────────────────────────────────────── */
function rel(iso?: string | null) {
  if (!iso) return "";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

const DIFF_COLORS: Record<string, string> = {
  beginner: "#34d399", intermediate: "#60a5fa",
  advanced: "#fbbf24", olympiad: "#f87171", research: "#a78bfa",
};
const TOPIC_GRAD: Record<string, string> = {
  "AI": "from-blue-600 to-indigo-700", "Philosophy": "from-indigo-600 to-blue-700",
  "Economics": "from-emerald-600 to-teal-700", "Technology": "from-cyan-600 to-blue-700",
  "Science": "from-teal-600 to-green-700", "Politics": "from-rose-600 to-red-700",
  "Psychology": "from-amber-600 to-orange-700", "Culture": "from-pink-600 to-rose-700",
};
const TOPIC_ICON: Record<string, string> = {
  "AI": "🤖", "Philosophy": "🧠", "Economics": "📈", "Technology": "💻",
  "Science": "🔬", "Politics": "🌍", "Psychology": "💭", "Culture": "🎨",
};

/* ── FILTER BAR ─────────────────────────────────────────────────────── */
const FILTERS: { value: FilterType; label: string; icon: string; color: string }[] = [
  { value: "all",     label: "All",     icon: "✦",  color: "text-foreground" },
  { value: "debate",  label: "Debates", icon: "⚡", color: "text-indigo-400" },
  { value: "article", label: "Articles",icon: "📰", color: "text-blue-400" },
  { value: "post",    label: "Posts",   icon: "💬", color: "text-rose-400" },
  { value: "math",    label: "Math",    icon: "∑",  color: "text-violet-400" },
];

/* ── CARDS ──────────────────────────────────────────────────────────── */
function DebateCard({ debate }: { debate: Debate }) {
  return (
    <Link href={`/debates/${debate.id}`}>
      <div className="group bg-card border border-border/60 rounded-xl overflow-hidden hover:border-indigo-500/40 hover:shadow-[0_0_20px_rgba(99,102,241,0.1)] transition-all cursor-pointer">
        <div className="h-1 w-full bg-gradient-to-r from-indigo-500 to-blue-500" />
        <div className="p-4">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-[10px] font-black uppercase tracking-widest bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 px-2 py-0.5 rounded-full flex items-center gap-1">
              <MessageSquare className="w-2.5 h-2.5" /> Debate
            </span>
            {debate.isLive && (
              <span className="text-[10px] font-black uppercase tracking-widest bg-red-500/15 text-red-400 border border-red-500/25 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" /> Live
              </span>
            )}
            {debate.isTrending && !debate.isLive && (
              <span className="text-[10px] font-black uppercase tracking-widest bg-amber-500/15 text-amber-400 border border-amber-500/25 px-2 py-0.5 rounded-full flex items-center gap-1">
                <TrendingUp className="w-2.5 h-2.5" /> Trending
              </span>
            )}
            <span className="ml-auto text-[10px] text-muted-foreground">{debate.category}</span>
          </div>

          <h3 className="font-bold text-[15px] leading-snug mb-3 group-hover:text-primary transition-colors line-clamp-2">
            {debate.title}
          </h3>

          {/* Vote bar */}
          <div className="mb-3">
            <div className="flex justify-between text-[11px] font-bold mb-1">
              <span className="text-indigo-400">Support {debate.supportPercent}%</span>
              <span className="text-rose-400">Against {debate.againstPercent}%</span>
            </div>
            <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden flex">
              <div className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all" style={{ width: `${debate.supportPercent}%` }} />
              <div className="h-full bg-gradient-to-r from-rose-500 to-rose-400 transition-all" style={{ width: `${debate.againstPercent}%` }} />
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Users className="w-3 h-3" />{formatNumber(debate.participantCount)}</span>
            {debate.endsAt && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Ends {rel(debate.endsAt)}</span>}
            <span className="ml-auto text-[10px] font-bold text-primary">Join debate →</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function ArticleCard({ article }: { article: Article }) {
  const topic = article.category ?? "Article";
  const grad = TOPIC_GRAD[topic] ?? "from-blue-600 to-indigo-700";
  const icon = TOPIC_ICON[topic] ?? "📝";
  return (
    <Link href={`/articles/${article.id}`}>
      <div className="group bg-card border border-border/60 rounded-xl overflow-hidden hover:border-blue-500/40 hover:shadow-[0_0_20px_rgba(59,130,246,0.08)] transition-all cursor-pointer">
        <div className="h-1 w-full bg-gradient-to-r from-blue-500 to-cyan-500" />
        <div className="p-4 flex gap-3">
          {/* Thumbnail */}
          <div className="w-[72px] h-[72px] shrink-0 rounded-lg overflow-hidden border border-border/50">
            {article.imageUrl ? (
              <img src={article.imageUrl} alt={article.title} className="w-full h-full object-cover" />
            ) : (
              <div className={cn("w-full h-full bg-gradient-to-br flex items-center justify-center text-xl", grad)}>{icon}</div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest bg-blue-500/15 text-blue-400 border border-blue-500/25 px-2 py-0.5 rounded-full flex items-center gap-1">
                <BookOpen className="w-2.5 h-2.5" /> Article
              </span>
              {article.isTrending && (
                <span className="text-[10px] font-black uppercase tracking-widest bg-amber-500/15 text-amber-400 border border-amber-500/25 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <TrendingUp className="w-2.5 h-2.5" /> Trending
                </span>
              )}
              {article.isExpertReviewed && (
                <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded-full">
                  ✓ Expert
                </span>
              )}
              {topic && <span className="ml-auto text-[10px] text-muted-foreground">{topic}</span>}
            </div>
            <h3 className="font-bold text-[14px] leading-snug group-hover:text-primary transition-colors line-clamp-2 mb-1">
              {article.title}
            </h3>
            {article.excerpt && (
              <p className="text-[12px] text-muted-foreground line-clamp-1 mb-1">{article.excerpt}</p>
            )}
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>{article.authorName}</span>
              <span>·</span><span>{article.readTime}m read</span>
              <span>·</span><span>{rel(article.createdAt)}</span>
              <span className="ml-auto flex items-center gap-1">❤️ {formatNumber(article.likes)}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function PostCard({ post }: { post: FeedPost }) {
  return (
    <div className="group bg-card border border-border/60 rounded-xl overflow-hidden hover:border-rose-500/30 hover:shadow-[0_0_16px_rgba(244,63,94,0.06)] transition-all">
      <div className="h-1 w-full bg-gradient-to-r from-rose-500 to-pink-500" />
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <Avatar className="w-8 h-8 border border-border/50 shrink-0">
            <AvatarImage src={post.authorAvatar ?? undefined} />
            <AvatarFallback className="text-[11px] bg-primary/15 text-primary font-bold">
              {post.authorName.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[13px] font-semibold">{post.authorName}</span>
              <span className="text-[10px] font-black uppercase tracking-widest bg-rose-500/12 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                <MessageCircle className="w-2.5 h-2.5" /> Post
              </span>
              {post.topic && <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full"><Hash className="w-2 h-2 inline" />{post.topic}</span>}
            </div>
            <span className="text-[11px] text-muted-foreground">{rel(post.createdAt)}</span>
          </div>
        </div>

        {post.title && <p className="font-semibold text-[14px] mb-1.5 line-clamp-1">{post.title}</p>}
        {post.excerpt && <p className="text-[13px] text-muted-foreground line-clamp-3 leading-relaxed">{post.excerpt}</p>}

        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/40 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">❤️ {formatNumber(post.likes ?? 0)}</span>
          <span className="flex items-center gap-1.5"><MessageCircle className="w-3 h-3" />{post.comments ?? 0}</span>
        </div>
      </div>
    </div>
  );
}

function MathCard({ problem }: { problem: MathProblem }) {
  const diffColor = DIFF_COLORS[problem.difficulty?.toLowerCase()] ?? "#a78bfa";
  return (
    <Link href={`/math/problem/${problem.id}`}>
      <div className="group bg-card border border-border/60 rounded-xl overflow-hidden hover:border-violet-500/40 hover:shadow-[0_0_20px_rgba(139,92,246,0.1)] transition-all cursor-pointer">
        <div className="h-1 w-full bg-gradient-to-r from-violet-500 to-purple-500" />
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-[10px] font-black uppercase tracking-widest bg-violet-500/15 text-violet-400 border border-violet-500/25 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Calculator className="w-2.5 h-2.5" /> Math
            </span>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize"
              style={{ color: diffColor, background: `${diffColor}20`, border: `1px solid ${diffColor}40` }}
            >
              {problem.difficulty}
            </span>
            <span className="text-[10px] text-muted-foreground ml-auto" style={{ color: problem.categoryColor }}>
              {problem.categoryName}
            </span>
          </div>

          <h3 className="font-bold font-serif text-[14px] leading-snug group-hover:text-violet-400 transition-colors line-clamp-2 mb-2.5">
            <MathText text={problem.title} />
          </h3>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{formatNumber(problem.viewCount)}</span>
            <span className="flex items-center gap-1">✦ {problem.solutionCount} solutions</span>
            {problem.isUnsolved && (
              <span className="ml-auto text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">Unsolved</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ── Skeleton feed ──────────────────────────────────────────────────── */
function FeedSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-card border border-border/60 rounded-xl overflow-hidden">
          <div className="h-1 w-full bg-muted" />
          <div className="p-4 space-y-2">
            <Skeleton className="h-3 w-24 rounded-full" />
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-3 w-3/4 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── MAIN PAGE ──────────────────────────────────────────────────────── */
export default function Discover() {
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: debates,  isLoading: debatesLoading  } = useGetDebates();
  const { data: feed,     isLoading: feedLoading     } = useGetFeed({ tab: "for_you" });
  const { data: articles, isLoading: articlesLoading } = useGetArticles();
  const { data: mathProbs,isLoading: mathLoading     } = useListMathProblems(
    {},
    { query: { queryKey: getListMathProblemsQueryKey({}) } }
  );

  const isLoading = debatesLoading || feedLoading || articlesLoading || mathLoading;

  const items = useMemo<DiscoverItem[]>(() => {
    const result: DiscoverItem[] = [];

    (debates ?? []).forEach((d, i) => {
      result.push({ kind: "debate", score: debateScore(d, i), data: d });
    });

    (articles ?? []).forEach((a, i) => {
      result.push({ kind: "article", score: articleScore(a, i), data: a });
    });

    (feed ?? []).forEach((p, i) => {
      result.push({ kind: "post", score: feedScore(p, i), data: p });
    });

    (mathProbs ?? []).forEach((m, i) => {
      result.push({ kind: "math", score: mathScore(m, i), data: m });
    });

    return result.sort((a, b) => b.score - a.score);
  }, [debates, articles, feed, mathProbs]);

  const filtered = useMemo(() => {
    let result = filter === "all" ? items : items.filter(item => item.kind === filter);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(item => {
        if (item.kind === "debate")  return item.data.title.toLowerCase().includes(q) || (item.data.category ?? "").toLowerCase().includes(q);
        if (item.kind === "article") return item.data.title.toLowerCase().includes(q) || (item.data.authorName ?? "").toLowerCase().includes(q) || (item.data.category ?? "").toLowerCase().includes(q);
        if (item.kind === "post")    return (item.data.title ?? "").toLowerCase().includes(q) || (item.data.excerpt ?? "").toLowerCase().includes(q) || (item.data.authorName ?? "").toLowerCase().includes(q);
        if (item.kind === "math")    return item.data.title.toLowerCase().includes(q) || (item.data.userName ?? "").toLowerCase().includes(q) || (item.data.categoryName ?? "").toLowerCase().includes(q);
        return true;
      });
    }
    return result;
  }, [items, filter, searchQuery]);

  const counts = useMemo(() => ({
    debate:  items.filter(i => i.kind === "debate").length,
    article: items.filter(i => i.kind === "article").length,
    post:    items.filter(i => i.kind === "post").length,
    math:    items.filter(i => i.kind === "math").length,
  }), [items]);

  return (
    <AppLayout rightSidebar={
      <div className="space-y-5">
        {/* Content breakdown */}
        <div className="bg-card border border-border/60 rounded-xl p-4">
          <h3 className="text-sm font-bold mb-3 text-foreground">In this feed</h3>
          <div className="space-y-2">
            {[
              { label: "Debates",  count: counts.debate,  color: "bg-indigo-500", icon: "⚡" },
              { label: "Articles", count: counts.article, color: "bg-blue-500",   icon: "📰" },
              { label: "Posts",    count: counts.post,    color: "bg-rose-500",   icon: "💬" },
              { label: "Math",     count: counts.math,    color: "bg-violet-500", icon: "∑" },
            ].map(({ label, count, color, icon }) => (
              <div key={label} className="flex items-center gap-2 text-sm">
                <span className="text-base leading-none">{icon}</span>
                <span className="text-muted-foreground flex-1">{label}</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-muted/50 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full", color)} style={{ width: `${Math.min((count / Math.max(items.length, 1)) * 100 * 4, 100)}%` }} />
                  </div>
                  <span className="text-xs font-bold text-foreground w-4 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick links */}
        <div className="bg-card border border-border/60 rounded-xl p-4">
          <h3 className="text-sm font-bold mb-3">Jump to</h3>
          <div className="space-y-1">
            {[
              { href: "/debates",    label: "Live Debates",    icon: "⚡" },
              { href: "/articles",   label: "Articles",        icon: "📰" },
              { href: "/math",       label: "Math Hub",        icon: "∑" },
              { href: "/communities",label: "Communities",     icon: "🏘️" },
            ].map(({ href, label, icon }) => (
              <Link key={href} href={href}>
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer">
                  <span className="text-base">{icon}</span>{label}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    }>
      <div className="space-y-4">
        {/* ── Page header ─────────────────────────────────────── */}
        <div className="flex items-center gap-3 pb-1">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0">
            <Compass className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground leading-tight">Discover</h1>
            <p className="text-xs text-muted-foreground">Debates · Articles · Posts · Math — all in one feed</p>
          </div>
          {!isLoading && (
            <span className="ml-auto text-xs text-muted-foreground font-medium bg-muted/50 border border-border/60 px-2.5 py-1 rounded-full">
              {searchQuery ? `${filtered.length} found` : `${items.length} items`}
            </span>
          )}
        </div>

        {/* ── Search ──────────────────────────────────────────── */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search debates, articles, posts, math…"
            className="w-full bg-card border border-border/60 rounded-xl pl-10 pr-10 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-muted/80 hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <XIcon className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* ── Filter bar ──────────────────────────────────────── */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5 -mx-1 px-1">
          {FILTERS.map(({ value, label, icon, color }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={cn(
                "flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-all border",
                filter === value
                  ? "bg-foreground text-background border-foreground shadow-sm"
                  : "bg-card text-muted-foreground border-border/60 hover:text-foreground hover:border-border"
              )}
            >
              <span className={filter === value ? "" : color}>{icon}</span>
              {label}
              {value !== "all" && (
                <span className={cn("text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center",
                  filter === value ? "bg-background/20" : "bg-muted"
                )}>
                  {counts[value as keyof typeof counts] ?? 0}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Feed ────────────────────────────────────────────── */}
        {isLoading ? (
          <FeedSkeleton />
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Compass className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">{searchQuery ? "No results found" : "Nothing here yet"}</p>
            <p className="text-sm mt-1">
              {searchQuery
                ? `No content matching "${searchQuery}"`
                : "Check back soon for fresh content"}
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="space-y-3">
              {filtered.map((item, idx) => (
                <motion.div
                  key={`${item.kind}-${item.data.id}`}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.18, delay: idx < 8 ? idx * 0.04 : 0 }}
                >
                  {item.kind === "debate"  && <DebateCard  debate={item.data} />}
                  {item.kind === "article" && <ArticleCard article={item.data} />}
                  {item.kind === "post"    && <PostCard    post={item.data} />}
                  {item.kind === "math"    && <MathCard    problem={item.data} />}
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        )}
      </div>
    </AppLayout>
  );
}
