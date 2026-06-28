import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useUser, useClerk } from "@clerk/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatNumber, cn } from "@/lib/utils";
import { LogOut, BookOpen, MessageSquare, Award, Shield, FileText, Pencil, Check, X, Trophy, Zap, Trash2, ClipboardCheck, Clock, CheckCircle, XCircle, Target, Plus, RotateCcw } from "lucide-react";
import { useLocation, Link, useParams } from "wouter";
import { useGetFeed, useGetArticles, useGetReputation, useGetCurrentUser, useGetMyReviewRequests, useGetUserPositions, useCreateUserPosition, useGetTopics, UserPositionGroup, useGetUserDna, useGetUserDebateHistory, DebateHistoryEntry, useGetUser, getGetUserQueryKey } from "@workspace/api-client-react";
import { PostCard } from "@/components/feed/post-card";
import { ArticleCard } from "@/components/feed/article-card";
import { IntellectualDnaChart } from "@/components/intellectual-dna-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppContext } from "@/context/app-context";
import { useToast } from "@/hooks/use-toast";

const LEVELS = [
  { name: "Novice", min: 0, max: 999, color: "text-slate-400", bg: "bg-slate-400", border: "border-slate-400/30", glow: "" },
  { name: "Thinker", min: 1000, max: 2499, color: "text-blue-400", bg: "bg-blue-400", border: "border-blue-400/30", glow: "shadow-[0_0_12px_rgba(96,165,250,0.3)]" },
  { name: "Scholar", min: 2500, max: 4999, color: "text-indigo-400", bg: "bg-indigo-400", border: "border-indigo-400/30", glow: "shadow-[0_0_12px_rgba(129,140,248,0.3)]" },
  { name: "Intellectual", min: 5000, max: 7999, color: "text-orange-400", bg: "bg-orange-400", border: "border-orange-400/30", glow: "shadow-[0_0_12px_rgba(251,146,60,0.3)]" },
  { name: "Elite Thinker", min: 8000, max: Infinity, color: "text-yellow-400", bg: "bg-yellow-400", border: "border-yellow-400/30", glow: "shadow-[0_0_12px_rgba(250,204,21,0.3)]" },
];

function getLevel(rep: number) {
  return LEVELS.find(l => rep >= l.min && rep <= l.max) ?? LEVELS[0];
}

const INTEREST_MAP: Record<string, string> = {
  ai: "Artificial Intelligence", philosophy: "Philosophy", politics: "Politics",
  science: "Science", economics: "Economics", technology: "Technology",
  psychology: "Psychology", culture: "Culture", history: "History", ethics: "Ethics",
};

const ALL_INTERESTS = Object.entries(INTEREST_MAP);


function PositionTimeline({ positions }: { positions: UserPositionGroup["positions"] }) {
  return (
    <div className="flex flex-col gap-2 pl-3 border-l-2 border-border ml-1">
      {positions.map((p, i) => (
        <div key={p.id} className={cn("flex flex-col gap-1 transition-opacity", p.isRevised ? "opacity-40" : "opacity-100")}>
          <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full shrink-0 -ml-[17px] border-2 border-background", p.isRevised ? "bg-muted-foreground" : "bg-primary")} />
            <span className="text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</span>
            {p.isRevised && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground bg-muted/60 border border-border px-1.5 py-0.5 rounded">
                <RotateCcw className="w-2.5 h-2.5" /> Revised
              </span>
            )}
            {i === 0 && !p.isRevised && (
              <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded">Current</span>
            )}
          </div>
          <p className={cn("text-sm leading-relaxed pl-3", p.isRevised ? "text-muted-foreground" : "text-foreground")}>{p.stance}</p>
        </div>
      ))}
    </div>
  );
}

function AddPositionForm({
  onAdd,
  onCancel,
  topicSuggestions,
}: {
  onAdd: (topic: string, stance: string) => Promise<void>;
  onCancel: () => void;
  topicSuggestions: string[];
}) {
  const [topic, setTopic] = useState("");
  const [stance, setStance] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!topic.trim() || !stance.trim()) return;
    setSubmitting(true);
    try { await onAdd(topic.trim(), stance.trim()); } finally { setSubmitting(false); }
  };

  return (
    <div className="border border-primary/30 rounded-xl p-4 bg-primary/5 flex flex-col gap-3">
      <div className="flex items-center gap-2 mb-1">
        <Target className="w-4 h-4 text-primary" />
        <span className="text-sm font-bold">Declare a Position</span>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Topic</label>
        <input
          list="position-topics"
          value={topic}
          onChange={e => setTopic(e.target.value)}
          placeholder="e.g. Free will, AI regulation, Democracy…"
          className="bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/50"
          data-testid="input-position-topic"
        />
        <datalist id="position-topics">
          {topicSuggestions.map(t => <option key={t} value={t} />)}
        </datalist>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your Stance</label>
        <textarea
          value={stance}
          onChange={e => setStance(e.target.value)}
          placeholder="State your position in one clear sentence…"
          rows={2}
          className="bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/50 resize-none"
          data-testid="input-position-stance"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={!topic.trim() || !stance.trim() || submitting}
          className="text-xs font-bold bg-primary text-white px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
          data-testid="button-submit-position"
        >
          {submitting ? "Saving…" : "Declare Position"}
        </button>
        <button
          onClick={onCancel}
          className="text-xs font-medium text-muted-foreground px-4 py-2 rounded-lg hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function PositionsView({
  groups,
  isLoading,
  isOwner,
  onAdd,
  topicSuggestions,
}: {
  groups: UserPositionGroup[];
  isLoading: boolean;
  isOwner: boolean;
  onAdd?: (topic: string, stance: string) => Promise<void>;
  topicSuggestions?: string[];
}) {
  const [showForm, setShowForm] = useState(false);

  const handleAdd = async (topic: string, stance: string) => {
    await onAdd?.(topic, stance);
    setShowForm(false);
  };

  if (isLoading) {
    return <div className="flex flex-col gap-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      {isOwner && (
        <div>
          {showForm ? (
            <AddPositionForm
              onAdd={handleAdd}
              onCancel={() => setShowForm(false)}
              topicSuggestions={topicSuggestions ?? []}
            />
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 text-xs font-semibold text-primary border border-primary/30 bg-primary/5 px-4 py-2 rounded-lg hover:bg-primary/10 transition-colors"
              data-testid="button-add-position"
            >
              <Plus className="w-3.5 h-3.5" /> Add Position
            </button>
          )}
        </div>
      )}

      {groups.length === 0 ? (
        <div className="text-center py-12">
          <Target className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium text-sm mb-1">No positions declared yet</p>
          {isOwner ? (
            <p className="text-xs text-muted-foreground">Declare your first stance on an intellectual topic above.</p>
          ) : (
            <p className="text-xs text-muted-foreground">This thinker hasn't declared any positions yet.</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map(group => (
            <div key={group.topic} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Target className="w-3.5 h-3.5 text-primary shrink-0" />
                <h4 className="text-sm font-bold">{group.topic}</h4>
                {group.positions.length > 1 && (
                  <span className="text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border">
                    {group.positions.length} stances
                  </span>
                )}
              </div>
              <PositionTimeline positions={group.positions} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DebateHistoryCard({ entry }: { entry: DebateHistoryEntry }) {
  const isSupport = entry.side === "support";
  return (
    <Link href={`/debates/${entry.debateId}`}>
      <div className="border border-border rounded-xl p-4 hover:border-primary/40 transition-colors cursor-pointer group">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded uppercase tracking-wide">{entry.category}</span>
            <h3 className="font-semibold text-sm mt-1.5 group-hover:text-primary leading-snug">{entry.debateTitle}</h3>
          </div>
          <span className={cn(
            "flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border shrink-0",
            isSupport
              ? "text-indigo-400 bg-indigo-400/10 border-indigo-400/25"
              : "text-rose-400 bg-rose-400/10 border-rose-400/25"
          )}>
            {isSupport ? "✓ Support" : "✗ Against"}
          </span>
        </div>
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden flex">
          <div className="h-full bg-indigo-500" style={{ width: `${entry.supportPercent}%` }} />
          <div className="h-full bg-rose-500" style={{ width: `${entry.againstPercent}%` }} />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground mt-1.5">
          <span className="text-indigo-400">{entry.supportPercent}% Support</span>
          <span>{formatNumber(entry.participantCount ?? 0)} participants</span>
          <span>{new Date(entry.joinedAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}</span>
        </div>
      </div>
    </Link>
  );
}

type DebateSideFilter = "all" | "support" | "against";

function DebateHistoryList({ entries, isLoading, isOwner }: { entries: DebateHistoryEntry[]; isLoading: boolean; isOwner: boolean }) {
  const [sideFilter, setSideFilter] = useState<DebateSideFilter>("all");

  if (isLoading) {
    return <div className="flex flex-col gap-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}</div>;
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12">
        <MessageSquare className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-muted-foreground font-medium text-sm mb-1">No debate history yet</p>
        {isOwner ? (
          <Link href="/debates"><button className="text-sm text-primary hover:underline">Browse debates →</button></Link>
        ) : (
          <p className="text-xs text-muted-foreground">This thinker hasn't voted in any debates yet.</p>
        )}
      </div>
    );
  }

  const filtered = sideFilter === "all" ? entries : entries.filter(e => e.side === sideFilter);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2" data-testid="debate-history-filters">
        {(["all", "support", "against"] as DebateSideFilter[]).map(f => (
          <button
            key={f}
            onClick={() => setSideFilter(f)}
            data-testid={`debate-filter-${f}`}
            aria-pressed={sideFilter === f}
            className={cn(
              "text-xs font-bold px-3 py-1.5 rounded-full border transition-all",
              f === "all" && sideFilter === "all" && "bg-primary/10 border-primary/40 text-primary",
              f === "all" && sideFilter !== "all" && "border-border text-muted-foreground hover:text-foreground hover:border-border/80",
              f === "support" && sideFilter === "support" && "bg-indigo-400/10 border-indigo-400/40 text-indigo-400",
              f === "support" && sideFilter !== "support" && "border-border text-muted-foreground hover:text-foreground hover:border-border/80",
              f === "against" && sideFilter === "against" && "bg-rose-400/10 border-rose-400/40 text-rose-400",
              f === "against" && sideFilter !== "against" && "border-border text-muted-foreground hover:text-foreground hover:border-border/80",
            )}
          >
            {f === "all" ? "All" : f === "support" ? "✓ Support" : "✗ Against"}
          </button>
        ))}
        {sideFilter !== "all" && (
          <span className="text-xs text-muted-foreground ml-1">{filtered.length} of {entries.length}</span>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-10">
          <MessageSquare className="w-7 h-7 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No {sideFilter} votes yet</p>
        </div>
      ) : (
        filtered.map(entry => <DebateHistoryCard key={entry.id} entry={entry} />)
      )}
    </div>
  );
}

function nameToInitials(name: string) {
  return name.split(" ").map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase();
}

function PublicProfile({ userId }: { userId: number }) {
  const [activeTab, setActiveTab] = useState<"posts" | "articles" | "debates" | "stats" | "positions">("posts");

  const { data: user, isLoading: userLoading, isError: userError } = useGetUser(userId, {
    query: { queryKey: getGetUserQueryKey(userId), retry: false },
  });
  const { data: positionsData, isLoading: positionsLoading } = useGetUserPositions(userId);
  const { data: debateHistory, isLoading: debateHistoryLoading } = useGetUserDebateHistory(userId);
  const { data: feedData } = useGetFeed({ tab: "for_you", authorId: userId });
  const { data: articles } = useGetArticles();
  const { data: dnaData, isLoading: dnaLoading } = useGetUserDna(userId);

  if (userLoading) return (
    <AppLayout>
      <div className="flex flex-col gap-4">
        <Skeleton className="w-full h-64 rounded-2xl" />
        <Skeleton className="w-full h-48 rounded-2xl" />
      </div>
    </AppLayout>
  );

  if (!user || userError) return (
    <AppLayout>
      <div className="flex flex-col items-center gap-4 py-20">
        <p className="text-muted-foreground text-lg font-semibold">Thinker not found</p>
        <Link href="/"><button className="text-sm text-primary hover:underline">← Back to feed</button></Link>
      </div>
    </AppLayout>
  );

  const initials = nameToInitials(user.name);
  const level = getLevel(user.reputationScore);
  const nextLevel = LEVELS[LEVELS.indexOf(level) + 1];
  const levelPct = nextLevel ? Math.round(((user.reputationScore - level.min) / (nextLevel.min - level.min)) * 100) : 100;
  const posts = feedData?.filter(p => p.type === "opinion").slice(0, 4) ?? [];
  const userArticles = (articles ?? []).slice(0, 4) as any[];

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 max-w-2xl">
        <Link href="/">
          <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back
          </button>
        </Link>

        {/* Header */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="h-28 w-full relative" style={{ background: "linear-gradient(135deg, #0d1830 0%, #1a0a30 50%, #0d1830 100%)" }}>
            <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 30% 50%, #3b82f6 0%, transparent 50%), radial-gradient(circle at 70% 50%, #a855f7 0%, transparent 50%)" }} />
          </div>
          <div className="px-6 pb-6">
            <div className="flex items-end justify-between -mt-12 mb-4">
              <Avatar className="w-20 h-20 border-4 border-card shadow-xl">
                <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name} />
                <AvatarFallback className="bg-primary/30 text-primary text-2xl font-bold">{initials}</AvatarFallback>
              </Avatar>
            </div>

            <div className="flex flex-col gap-2">
              <div>
                <h1 className="text-xl font-bold">{user.name}</h1>
                <p className="text-sm text-muted-foreground">{user.title ?? ""}</p>
              </div>

              <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg border w-fit", level.border, level.glow, "bg-card/50")}>
                <Trophy className={cn("w-3.5 h-3.5", level.color)} />
                <span className={cn("text-sm font-black", level.color)}>{level.name}</span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className={cn("text-xs font-semibold", level.color)}>{formatNumber(user.reputationScore)} rep</span>
              </div>

              {nextLevel && (
                <div className="flex flex-col gap-1 mt-1 max-w-xs">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{level.name}</span>
                    <span>{levelPct}% to {nextLevel.name}</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", level.bg)} style={{ width: `${levelPct}%` }} />
                  </div>
                </div>
              )}

              <p className="text-sm text-muted-foreground leading-relaxed mt-1">{user.bio ?? ""}</p>

              <div className="flex flex-wrap gap-1.5 mt-1">
                {(user.interests ?? []).map(i => (
                  <span key={i} className="text-xs font-medium text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full">{i}</span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-5 pt-5 border-t border-border">
              {[
                { label: "Debates", value: debateHistory != null ? debateHistory.length : (user.debatesJoined ?? 0) },
                { label: "Articles", value: user.articlesPublished },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <div className="text-lg font-bold">{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Intellectual DNA Chart */}
        <IntellectualDnaChart data={dnaData} isLoading={dnaLoading} profileId={userId} />

        {/* Tabs */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex border-b border-border overflow-x-auto scrollbar-none">
            {[
              { id: "posts" as const, label: "Posts", icon: FileText },
              { id: "articles" as const, label: "Articles", icon: BookOpen },
              { id: "debates" as const, label: "Debates", icon: MessageSquare },
              { id: "positions" as const, label: "Positions", icon: Target },
              { id: "stats" as const, label: "Stats", icon: Award },
            ].map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setActiveTab(id)}
                className={cn("flex-1 flex items-center justify-center gap-1.5 py-3.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap px-3",
                  activeTab === id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
                <Icon className="w-3.5 h-3.5 shrink-0" /> {label}
              </button>
            ))}
          </div>
          <div className="p-4">
            {activeTab === "posts" && (
              <div className="flex flex-col gap-3">
                {posts.length > 0 ? posts.map(p => <PostCard key={p.id} post={{ ...p, authorName: user.name }} />) : <p className="text-center text-muted-foreground py-8 text-sm">No posts yet.</p>}
              </div>
            )}
            {activeTab === "articles" && (
              <div className="flex flex-col gap-3">
                {userArticles.length > 0 ? userArticles.map((a: any) => <ArticleCard key={a.id} post={{ ...a, type: "article", authorName: user.name }} />) : <p className="text-center text-muted-foreground py-8 text-sm">No articles yet.</p>}
              </div>
            )}
            {activeTab === "debates" && (
              <DebateHistoryList
                entries={debateHistory ?? []}
                isLoading={debateHistoryLoading}
                isOwner={false}
              />
            )}
            {activeTab === "positions" && (
              <PositionsView
                groups={positionsData ?? []}
                isLoading={positionsLoading}
                isOwner={false}
              />
            )}
            {activeTab === "stats" && (
              <div className="flex flex-col gap-6">
                <div className="grid grid-cols-2 gap-3">
                  {(() => {
                    const debateCount = debateHistory != null ? debateHistory.length : (user.debatesJoined ?? 0);
                    const supportCount = debateHistory?.filter(e => e.side === "support").length ?? 0;
                    const againstCount = debateHistory?.filter(e => e.side === "against").length ?? 0;
                    return (
                      <>
                        <div className="bg-muted/30 border border-border rounded-xl p-4 flex flex-col gap-2 text-center">
                          <MessageSquare className="w-5 h-5 mx-auto text-indigo-400" />
                          <div className="text-2xl font-bold">{debateCount}</div>
                          <div className="text-xs text-muted-foreground">Debates Voted</div>
                          {debateCount > 0 && debateHistory != null && (
                            <div className="flex items-center justify-center gap-1.5 flex-wrap mt-0.5">
                              <span className="text-[11px] font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 px-2 py-0.5 rounded-full">{supportCount} support</span>
                              <span className="text-[11px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/25 px-2 py-0.5 rounded-full">{againstCount} against</span>
                            </div>
                          )}
                        </div>
                        <div className="bg-muted/30 border border-border rounded-xl p-4 flex flex-col gap-2 text-center">
                          <BookOpen className="w-5 h-5 mx-auto text-green-400" />
                          <div className="text-2xl font-bold">{user.articlesPublished}</div>
                          <div className="text-xs text-muted-foreground">Articles</div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

type ProfileTab = "posts" | "articles" | "debates" | "stats" | "positions";

function OwnProfile() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { sessionRep } = useAppContext();
  const { data: repData, isLoading: repLoading } = useGetReputation();
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const [confirmDelete, setConfirmDelete] = useState<{ id: number } | null>(null);
  const [deletedArticleIds, setDeletedArticleIds] = useState<Set<number>>(new Set());

  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  async function handleDeleteArticle(id: number) {
    try {
      const res = await fetch(`${basePath}/api/articles/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Delete failed");
      setDeletedArticleIds(prev => new Set([...prev, id]));
      toast({ title: "Article deleted" });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    } finally {
      setConfirmDelete(null);
    }
  }
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savedName, setSavedName] = useState(() => localStorage.getItem("treffin_name") ?? "");
  const [editingBio, setEditingBio] = useState(false);
  const [bio, setBio] = useState(() => localStorage.getItem("treffin_bio") ?? "");
  const [editingInterests, setEditingInterests] = useState(false);
  const [draftInterests, setDraftInterests] = useState<Set<string>>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("treffin_interests") ?? "[]");
      return new Set(Array.isArray(stored) ? stored : []);
    } catch { return new Set(["ai", "philosophy", "technology"]); }
  });

  const { data: currentUser } = useGetCurrentUser();
  const myDbId = currentUser?.id;
  const { data: dnaData, isLoading: dnaLoading } = useGetUserDna(myDbId ?? 0, { query: { enabled: !!myDbId } as never });

  const { data: feed, isLoading: feedLoading } = useGetFeed({ tab: "for_you", authorId: myDbId });
  const { data: myArticleFeed, isLoading: articlesLoading } = useGetFeed({ tab: "articles", authorId: myDbId });
  const { data: myDebateHistory, isLoading: debateHistoryLoading } = useGetUserDebateHistory(myDbId ?? 0);
  const { data: reviewRequests, isLoading: reviewRequestsLoading } = useGetMyReviewRequests();
  const { data: myPositions, isLoading: positionsLoading, refetch: refetchPositions } = useGetUserPositions(myDbId ?? 0);
  const { data: topicsData } = useGetTopics();
  const createPosition = useCreateUserPosition();
  const topicSuggestions = topicsData?.map(t => t.name) ?? [];

  const clerkName = user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.username || "Thinker" : "Guest User";
  const displayName = currentUser?.name || savedName || clerkName;
  const initials = displayName ? displayName.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2) : "GU";

  const totalRep = (repData?.total ?? 0) + sessionRep;
  const level = getLevel(totalRep);
  const nextLevel = LEVELS[LEVELS.indexOf(level) + 1];
  const levelPct = nextLevel ? Math.round(((totalRep - level.min) / (nextLevel.min - level.min)) * 100) : 100;

  const interests = Array.from(draftInterests).map(id => INTEREST_MAP[id] ?? id);

  const saveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    try {
      await fetch(`${basePath}/api/users/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      setSavedName(trimmed);
      localStorage.setItem("treffin_name", trimmed);
      toast({ title: "Name updated!" });
    } catch {
      toast({ title: "Failed to save name", variant: "destructive" });
    }
    setEditingName(false);
  };

  const saveBio = () => {
    localStorage.setItem("treffin_bio", bio);
    setEditingBio(false);
    toast({ title: "Bio saved!" });
  };

  const saveInterests = () => {
    localStorage.setItem("treffin_interests", JSON.stringify(Array.from(draftInterests)));
    setEditingInterests(false);
    toast({ title: "Interests updated!" });
  };

  const toggleDraftInterest = (id: string) => {
    setDraftInterests(p => { const s = new Set(p); if (s.has(id)) s.delete(id); else s.add(id); return s; });
  };

  const myPosts = (feed ?? []).filter(p => p.type !== "article").slice(0, 5);
  const myArticles = (myArticleFeed ?? []).slice(0, 5) as any[];

  const debatesJoinedCount = myDebateHistory != null ? myDebateHistory.length : (currentUser?.debatesJoined ?? 0);
  const debateSupportCount = myDebateHistory?.filter(e => e.side === "support").length ?? 0;
  const debateAgainstCount = myDebateHistory?.filter(e => e.side === "against").length ?? 0;

  const STATS = {
    debatesJoined: debatesJoinedCount,
    articlesPublished: currentUser?.articlesPublished ?? myArticles.length,
  };


  return (
    <AppLayout>
      <div className="flex flex-col gap-5 max-w-2xl">
        {/* Profile Header */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="h-28 w-full relative" style={{ background: "linear-gradient(135deg, #0d1830 0%, #1a0a30 50%, #0d1830 100%)" }}>
            <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 30% 50%, #3b82f6 0%, transparent 50%), radial-gradient(circle at 70% 50%, #a855f7 0%, transparent 50%)" }} />
            {sessionRep > 0 && (
              <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-primary/90 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                <Zap className="w-3 h-3 text-yellow-300" /> +{sessionRep} rep today
              </div>
            )}
          </div>
          <div className="px-6 pb-6">
            <div className="flex items-end justify-between -mt-12 mb-4">
              <Avatar className="w-20 h-20 border-4 border-card shadow-xl">
                <AvatarImage src={user?.imageUrl} />
                <AvatarFallback className="bg-primary/30 text-primary text-2xl font-bold">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex items-center gap-2 mb-1">
                {user && (
                  <button
                    className="text-xs font-medium text-destructive border border-destructive/30 px-3 py-1.5 rounded-full hover:bg-destructive/10 transition-colors flex items-center gap-1.5"
                    onClick={() => signOut({ redirectUrl: basePath || "/" })}
                    data-testid="button-sign-out"
                  >
                    <LogOut className="w-3 h-3" /> Sign out
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div>
                {editingName ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      autoFocus
                      className="bg-muted/50 border border-primary/50 rounded-lg px-3 py-1.5 text-sm font-bold outline-none focus:ring-1 focus:ring-primary/40 w-48"
                      value={nameInput}
                      onChange={e => setNameInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
                      placeholder={displayName}
                      data-testid="input-edit-name"
                    />
                    <button className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors" onClick={saveName}>Save</button>
                    <button className="text-xs text-muted-foreground hover:text-foreground transition-colors" onClick={() => setEditingName(false)}>Cancel</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl font-bold">{displayName}</h1>
                    <svg className="w-4 h-4 text-blue-500 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    <button
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => { setNameInput(displayName); setEditingName(true); }}
                      data-testid="button-edit-name"
                      title="Edit name"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">@{user?.username ?? displayName.toLowerCase().replace(/\s+/g, "_")}</p>
              </div>

              {/* Level Badge */}
              <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg border w-fit", level.border, level.glow, "bg-card/50")}>
                <Trophy className={cn("w-3.5 h-3.5", level.color)} />
                <span className={cn("text-sm font-black", level.color)}>{level.name}</span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className={cn("text-xs font-semibold", level.color)}>{formatNumber(totalRep)} rep</span>
              </div>

              {nextLevel && (
                <div className="flex flex-col gap-1 max-w-xs">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{level.name}</span>
                    <span>{levelPct}% to {nextLevel.name}</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", level.bg)} style={{ width: `${levelPct}%` }} />
                  </div>
                </div>
              )}

              {/* Editable bio */}
              <div className="mt-1">
                {editingBio ? (
                  <div className="flex flex-col gap-2">
                    <textarea
                      value={bio}
                      onChange={e => setBio(e.target.value)}
                      className="w-full bg-muted/30 border border-primary/40 rounded-lg p-2.5 text-sm resize-none outline-none focus:border-primary leading-relaxed"
                      placeholder="Tell the community who you are and what you think about..."
                      rows={3}
                      autoFocus
                      maxLength={280}
                      data-testid="input-bio"
                    />
                    <div className="flex items-center gap-2">
                      <button className="text-xs font-semibold bg-primary text-white px-3 py-1.5 rounded-full flex items-center gap-1" onClick={saveBio} data-testid="button-save-bio">
                        <Check className="w-3 h-3" /> Save
                      </button>
                      <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setEditingBio(false)}>Cancel</button>
                      <span className="text-[10px] text-muted-foreground ml-auto">{bio.length}/280</span>
                    </div>
                  </div>
                ) : (
                  <div
                    className="flex items-start gap-2 group cursor-pointer rounded-lg hover:bg-muted/20 p-1.5 -m-1.5 transition-colors"
                    onClick={() => setEditingBio(true)}
                    data-testid="button-edit-bio"
                  >
                    <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                      {bio || <span className="italic text-muted-foreground/50">Click to write your bio. Tell the community what moves your mind...</span>}
                    </p>
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 shrink-0" />
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-center mt-5 pt-5 border-t border-border">
              <div className="text-center"><div className={cn("text-lg font-bold", level.color)}>{formatNumber(totalRep)}</div><div className="text-xs text-muted-foreground">Reputation</div></div>
            </div>
          </div>
        </div>

        {/* Intellectual DNA Chart */}
        <IntellectualDnaChart data={dnaData} isLoading={myDbId ? dnaLoading : false} />

        {/* Reputation Card */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {/* Header */}
          <div className="px-5 pt-5 pb-4 flex items-center justify-between border-b border-border/60">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <h3 className="font-bold text-sm">Reputation</h3>
            </div>
            <div className="flex items-center gap-2">
              {sessionRep > 0 && (
                <span className="flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  <Zap className="w-3 h-3 text-yellow-300" />+{sessionRep} today
                </span>
              )}
              <span className={cn("text-2xl font-black", level.color)}>{formatNumber(totalRep)}</span>
            </div>
          </div>

          <div className="px-5 py-4 flex flex-col gap-5">
            {/* Level + progress */}
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <div className={cn("flex items-center gap-1.5 font-bold", level.color)}>
                  <Trophy className="w-3.5 h-3.5" />{level.name}
                </div>
                {nextLevel ? (
                  <span className="text-muted-foreground">{levelPct}% · {formatNumber(nextLevel.min - totalRep)} rep to <span className="font-semibold">{nextLevel.name}</span></span>
                ) : (
                  <span className="text-yellow-400 font-semibold">Max level reached 🏆</span>
                )}
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all duration-700", level.bg)} style={{ width: `${levelPct}%` }} />
              </div>
            </div>

            {/* Earning guide / breakdown */}
            {repLoading ? (
              <div className="flex flex-col gap-2">{[1,2,3].map(i => <Skeleton key={i} className="h-9 w-full rounded-lg" />)}</div>
            ) : repData && repData.total > 0 ? (
              <>
                <div>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">How you earned it</p>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { label: "Debates", value: repData.breakdown.debates, color: "text-indigo-400", bg: "bg-indigo-400/10 border-indigo-400/20" },
                      { label: "Articles", value: repData.breakdown.articles, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20" },
                      { label: "Votes & Challenges", value: repData.breakdown.votes, color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/20" },
                      { label: "Posts & Comments", value: repData.breakdown.posts, color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20" },
                    ] as const).filter(c => c.value > 0).map(cat => (
                      <div key={cat.label} className={cn("flex items-center justify-between px-3 py-2 rounded-lg border", cat.bg)}>
                        <span className="text-xs text-muted-foreground">{cat.label}</span>
                        <span className={cn("text-xs font-bold", cat.color)}>+{formatNumber(cat.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {repData.recentEvents.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Recent Activity</p>
                    <div className="flex flex-col divide-y divide-border/40">
                      {repData.recentEvents.slice(0, 8).map(evt => {
                        const icons: Record<string, string> = {
                          daily_question_voted: "🗳️", post_created: "✍️", post_liked: "👍",
                          article_created: "📰", article_liked: "❤️", debate_joined: "⚔️",
                          debate_won: "🏆", weekly_challenge_won: "🥇", community_joined: "🏘️",
                          comment_posted: "💬", content_saved: "🔖", long_comment: "✍️",
                        };
                        return (
                          <div key={evt.id} className="flex items-center justify-between py-2">
                            <span className="text-sm flex items-center gap-2">
                              <span>{icons[evt.eventType] ?? "⚡"}</span>
                              <span className="text-muted-foreground capitalize">{evt.description.replace(/_/g, " ")}</span>
                            </span>
                            <span className="text-xs font-bold text-primary shrink-0 ml-2">+{evt.points}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">You haven't earned any rep yet. Complete actions below to get started.</p>
            )}

            {/* Always-visible ways to earn rep */}
            {!repLoading && (
              <div>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Ways to earn rep</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { action: "Vote in Daily Question", pts: "+5" },
                    { action: "Save a post or article", pts: "+1" },
                    { action: "Comment on a post", pts: "+2" },
                    { action: "Like a post", pts: "+3" },
                    { action: "Join a community", pts: "+10" },
                    { action: "Publish a post", pts: "+10" },
                    { action: "Join a debate room", pts: "+15" },
                    { action: "Long argument (100+ words)", pts: "+5" },
                    { action: "Write an article", pts: "+25" },
                    { action: "Get your post liked", pts: "+3" },
                    { action: "Get your article liked", pts: "+5" },
                    { action: "Win a debate", pts: "+75" },
                    { action: "Win Weekly Challenge", pts: "+150" },
                  ].map(({ action, pts }) => (
                    <div key={action} className="flex items-center justify-between px-3 py-2 bg-muted/40 rounded-lg border border-border/40">
                      <span className="text-xs text-muted-foreground leading-snug">{action}</span>
                      <span className="text-xs font-bold text-primary ml-2 shrink-0">{pts}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Interests */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold">Your Interests</h3>
            <button
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
              onClick={() => setEditingInterests(p => !p)}
              data-testid="button-edit-interests"
            >
              {editingInterests ? <><X className="w-3 h-3" /> Cancel</> : <><Pencil className="w-3 h-3" /> Edit</>}
            </button>
          </div>
          {editingInterests ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {ALL_INTERESTS.map(([id, label]) => (
                  <button
                    key={id}
                    className={cn("text-xs font-semibold px-3 py-1.5 rounded-full border transition-all", draftInterests.has(id) ? "bg-primary/10 border-primary/40 text-primary" : "border-border text-muted-foreground hover:text-foreground")}
                    onClick={() => toggleDraftInterest(id)}
                  >
                    {draftInterests.has(id) && "✓ "}{label}
                  </button>
                ))}
              </div>
              <button
                className="self-start text-xs font-semibold bg-primary text-white px-4 py-1.5 rounded-full"
                onClick={saveInterests}
                disabled={draftInterests.size < 1}
                data-testid="button-save-interests"
              >
                Save interests
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {interests.map(i => <span key={i} className="text-xs font-medium text-primary bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-full">{i}</span>)}
              {interests.length === 0 && <span className="text-xs text-muted-foreground italic">No interests selected. Click Edit to add some.</span>}
            </div>
          )}
        </div>

        {/* Peer Review Status */}
        {(reviewRequestsLoading || (reviewRequests && reviewRequests.length > 0)) && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 pt-5 pb-4 flex items-center gap-2 border-b border-border/60">
              <ClipboardCheck className="w-4 h-4 text-indigo-400" />
              <h3 className="font-bold text-sm">Peer Review Requests</h3>
              {reviewRequests && reviewRequests.length > 0 && (
                <span className="ml-auto text-xs text-muted-foreground">{reviewRequests.length} {reviewRequests.length === 1 ? "request" : "requests"}</span>
              )}
            </div>
            <div className="divide-y divide-border/40">
              {reviewRequestsLoading ? (
                Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-none" />)
              ) : (
                reviewRequests!.map(req => {
                  const statusConfig = {
                    pending:  { icon: Clock,         label: "Pending",  color: "text-yellow-400",  bg: "bg-yellow-400/10 border-yellow-400/20" },
                    approved: { icon: CheckCircle,   label: "Approved", color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20" },
                    rejected: { icon: XCircle,       label: "Rejected", color: "text-rose-400",    bg: "bg-rose-400/10 border-rose-400/20" },
                  }[req.status];
                  const StatusIcon = statusConfig.icon;
                  const isRejected = req.status === "rejected";
                  return (
                    <Link key={req.id} href={`/articles/${req.articleId}`}>
                      <div className={cn("px-5 py-3.5 hover:bg-muted/20 transition-colors cursor-pointer group", isRejected && req.reviewerNote ? "flex flex-col gap-2" : "flex items-center gap-3")}>
                        <div className={cn("flex items-center gap-3", isRejected && req.reviewerNote ? "w-full" : "flex-1 min-w-0")}>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{req.articleTitle}</p>
                            {!isRejected && req.reviewerNote && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">{req.reviewerNote}</p>
                            )}
                          </div>
                          <span className={cn("flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0", statusConfig.color, statusConfig.bg)}>
                            <StatusIcon className="w-3 h-3" />
                            {statusConfig.label}
                          </span>
                        </div>
                        {isRejected && req.reviewerNote && (
                          <div className="flex items-start gap-2 bg-rose-500/8 border border-rose-500/25 rounded-lg px-3 py-2.5">
                            <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-rose-300 leading-relaxed">{req.reviewerNote}</p>
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex border-b border-border overflow-x-auto scrollbar-none">
            {[
              { id: "posts" as ProfileTab, label: "Posts", icon: FileText },
              { id: "articles" as ProfileTab, label: "Articles", icon: BookOpen },
              { id: "debates" as ProfileTab, label: "Debates", icon: MessageSquare },
              { id: "positions" as ProfileTab, label: "Positions", icon: Target },
              { id: "stats" as ProfileTab, label: "Stats", icon: Award },
            ].map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setActiveTab(id)} data-testid={`profile-tab-${id}`}
                className={cn("flex-1 flex items-center justify-center gap-1.5 py-3.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap px-3 min-w-0",
                  activeTab === id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
                <Icon className="w-3.5 h-3.5 shrink-0" /> {label}
              </button>
            ))}
          </div>

          <div className="p-4">
            {activeTab === "posts" && (
              <div className="flex flex-col gap-3">
                {feedLoading ? Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />) : myPosts.length > 0 ? myPosts.map(p => <PostCard key={p.id} post={p} />) : (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground font-medium mb-2">No posts yet</p>
                    <p className="text-sm text-muted-foreground mb-4">Share your first thought with the community</p>
                    <Link href="/"><button className="text-sm text-primary hover:underline">Go to feed →</button></Link>
                  </div>
                )}
              </div>
            )}
            {activeTab === "articles" && (
              <div className="flex flex-col gap-3">
                {articlesLoading ? Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-36 w-full rounded-xl" />) :
                myArticles.filter((a: any) => !deletedArticleIds.has(a.id)).length > 0 ?
                myArticles.filter((a: any) => !deletedArticleIds.has(a.id)).map((a: any) => (
                  <div key={a.id} className="relative group">
                    <ArticleCard post={{ ...a, type: "article" }} />
                    {confirmDelete?.id === a.id ? (
                      <div className="absolute inset-0 bg-background/90 backdrop-blur-sm rounded-xl flex items-center justify-center gap-3 z-10">
                        <span className="text-sm font-medium">Delete this article?</span>
                        <button onClick={() => handleDeleteArticle(a.id)} className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-lg transition-colors">Delete</button>
                        <button onClick={() => setConfirmDelete(null)} className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-xs font-bold rounded-lg transition-colors">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDelete({ id: a.id })}
                        className="absolute top-3 right-3 p-1.5 rounded-lg bg-background/80 border border-border opacity-0 group-hover:opacity-100 transition-opacity hover:border-rose-500/50 hover:text-rose-400 z-10">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )) : (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground font-medium mb-2">No articles yet</p>
                    <Link href="/articles"><button className="text-sm text-primary hover:underline">Write your first article →</button></Link>
                  </div>
                )}
              </div>
            )}
            {activeTab === "debates" && (
              <DebateHistoryList
                entries={myDebateHistory ?? []}
                isLoading={debateHistoryLoading}
                isOwner={true}
              />
            )}

            {activeTab === "positions" && (
              <PositionsView
                groups={myPositions ?? []}
                isLoading={positionsLoading}
                isOwner={true}
                topicSuggestions={topicSuggestions}
                onAdd={async (topic, stance) => {
                  await createPosition.mutateAsync({ data: { topic, stance } });
                  await refetchPositions();
                  toast({ title: "Position declared!" });
                }}
              />
            )}

            {activeTab === "stats" && (
              <div className="flex flex-col gap-6">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/30 border border-border rounded-xl p-4 flex flex-col gap-2 text-center">
                    <MessageSquare className="w-5 h-5 mx-auto text-indigo-400" />
                    <div className="text-2xl font-bold">{STATS.debatesJoined}</div>
                    <div className="text-xs text-muted-foreground">Debates Voted</div>
                    {STATS.debatesJoined > 0 && (
                      <div className="flex items-center justify-center gap-1.5 flex-wrap mt-0.5">
                        <span className="text-[11px] font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 px-2 py-0.5 rounded-full">{debateSupportCount} support</span>
                        <span className="text-[11px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/25 px-2 py-0.5 rounded-full">{debateAgainstCount} against</span>
                      </div>
                    )}
                  </div>
                  <div className="bg-muted/30 border border-border rounded-xl p-4 flex flex-col gap-2 text-center">
                    <BookOpen className="w-5 h-5 mx-auto text-green-400" />
                    <div className="text-2xl font-bold">{STATS.articlesPublished}</div>
                    <div className="text-xs text-muted-foreground">Articles</div>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <h3 className="font-bold text-sm">Reputation Breakdown</h3>
                  {repLoading ? (
                    <div className="flex flex-col gap-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-8 w-full rounded-lg" />)}</div>
                  ) : repData && repData.total > 0 ? (
                    <div className="flex flex-col gap-2">
                      {([
                        { label: "Debates", value: repData.breakdown.debates, color: "bg-indigo-500/60" },
                        { label: "Articles", value: repData.breakdown.articles, color: "bg-blue-500/60" },
                        { label: "Votes & Challenges", value: repData.breakdown.votes, color: "bg-yellow-500/60" },
                        { label: "Posts & Comments", value: repData.breakdown.posts, color: "bg-emerald-500/60" },
                        { label: "Community", value: repData.breakdown.community, color: "bg-rose-500/60" },
                      ] as const).filter(c => c.value > 0).map(cat => (
                        <div key={cat.label} className="flex items-center gap-3">
                          <div className="flex-1">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-muted-foreground">{cat.label}</span>
                              <span className="font-semibold text-primary">+{formatNumber(cat.value)}</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className={cn("h-full rounded-full transition-all", cat.color)} style={{ width: `${Math.round((cat.value / repData.total) * 100)}%` }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No rep earned yet. Start debating, posting, and voting!</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </AppLayout>
  );
}

export default function Profile() {
  const { id } = useParams<{ id: string }>();
  if (id) {
    const numericId = Number(id);
    if (!isNaN(numericId) && numericId > 0) {
      return <PublicProfile userId={numericId} />;
    }
    return (
      <AppLayout>
        <div className="flex flex-col items-center gap-4 py-20">
          <p className="text-muted-foreground text-lg font-semibold">Thinker not found</p>
          <Link href="/"><button className="text-sm text-primary hover:underline">← Back to feed</button></Link>
        </div>
      </AppLayout>
    );
  }
  return <OwnProfile />;
}
