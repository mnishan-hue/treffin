import {
  useGetMathProblem,
  getGetMathProblemQueryKey,
  useSubmitMathSolution,
  useToggleMathReaction,
  useFlagMathContent,
  useAddMathBookmark,
  useRemoveMathBookmark,
  useGetMathAnnotations,
  useAddMathAnnotation,
  getGetMathAnnotationsQueryKey,
  useGetMathBookmarks,
  getGetMathBookmarksQueryKey,
  useGetRelatedMathProblems,
  getGetRelatedMathProblemsQueryKey,
  useRateMathDifficulty,
  useUpdateMathSolution,
  useDeleteMathSolution,
  useGetDebates,
  useGetMathShowdown,
  getGetMathShowdownQueryKey,
} from "@workspace/api-client-react";
import type {
  MathSolution,
  MathReactionInputReactionType,
  MathSolutionInputApproach,
} from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { MathText } from "@/components/math/math-renderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useRef, useCallback } from "react";
import { getMathUserId, getMathUsername } from "@/lib/math-auth";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LatexSymbolPicker } from "@/components/math/latex-symbol-picker";
import { DesmosEmbed } from "@/components/math/desmos-embed";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BookmarkPlus, BookmarkCheck, MessageSquarePlus, ChevronDown, ChevronUp, Swords, Lightbulb, Star, Flag, Pencil, Trash2, Check, X, Plus, Trophy, Zap, Timer, CheckCircle2 } from "lucide-react";
import { authenticatedFetch } from "@/lib/api-url";

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const colors: Record<string, string> = {
    beginner: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    intermediate: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    advanced: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    olympiad: "bg-red-500/10 text-red-500 border-red-500/20",
    research: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  };
  return (
    <Badge variant="outline" className={`${colors[difficulty] ?? "bg-gray-500/10 text-gray-400 border-gray-500/20"} font-medium`}>
      {difficulty}
    </Badge>
  );
}

function ApproachBadge({ approach }: { approach: string }) {
  const colors: Record<string, string> = {
    calculus: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    geometric: "bg-green-500/10 text-green-500 border-green-500/20",
    algebraic: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    proof: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    intuitive: "bg-rose-500/10 text-rose-500 border-rose-500/20",
    combinatorial: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
    other: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  };
  return (
    <Badge variant="outline" className={`${colors[approach] ?? colors["other"]} font-medium`}>
      {approach}
    </Badge>
  );
}

const REACTION_TYPES = [
  { id: "elegant" as MathReactionInputReactionType, label: "Elegant" },
  { id: "creative" as MathReactionInputReactionType, label: "Creative" },
  { id: "insightful" as MathReactionInputReactionType, label: "Insightful" },
  { id: "rigorous" as MathReactionInputReactionType, label: "Rigorous" },
  { id: "beginner_friendly" as MathReactionInputReactionType, label: "Beginner Friendly" },
  { id: "great_learning_moment" as MathReactionInputReactionType, label: "Learning Moment" },
] as const;

function ReactionBar({
  targetType,
  targetId,
  counts,
  myReactions,
  problemId,
}: {
  targetType: "problem" | "solution";
  targetId: number;
  counts: Record<string, number>;
  myReactions: string[];
  problemId: number;
}) {
  const toggleReaction = useToggleMathReaction();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleToggle = (reactionId: MathReactionInputReactionType) => {
    if (!getMathUserId()) {
      toast({ title: "Sign in required", description: "Please sign in to react.", variant: "destructive" });
      return;
    }
    toggleReaction.mutate(
      { data: { targetType, targetId, reactionType: reactionId } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetMathProblemQueryKey(problemId) });
        },
        onError: () => {
          toast({ title: "Failed to update reaction", variant: "destructive" });
        },
      },
    );
  };

  return (
    <div className="flex flex-wrap gap-2 mt-4">
      {REACTION_TYPES.map((r) => {
        const count = counts?.[r.id] ?? 0;
        const isActive = myReactions?.includes(r.id);
        if (count === 0 && !isActive && targetType === "problem") return null;
        return (
          <button
            key={r.id}
            onClick={() => handleToggle(r.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              isActive
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-secondary/50 border-border text-muted-foreground hover:bg-secondary"
            }`}
          >
            <span className="opacity-70">{r.label}</span>
            {count > 0 && <span>{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

function ProgressiveHints({ hints }: { hints: string[] }) {
  const [revealed, setRevealed] = useState(0);
  if (!hints || hints.length === 0) return null;

  return (
    <div className="mb-6 space-y-3">
      {hints.slice(0, revealed).map((hint, i) => (
        <div key={i} className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-500">
              Hint {i + 1}
            </span>
          </div>
          <div className="text-sm text-foreground/85 font-serif">
            <MathText text={hint} />
          </div>
        </div>
      ))}

      {revealed < hints.length && (
        <button
          onClick={() => setRevealed((v) => v + 1)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-amber-500/30 text-amber-500/80 hover:border-amber-500/60 hover:text-amber-500 hover:bg-amber-500/5 transition-all text-sm font-medium w-full justify-center group"
        >
          <Lightbulb className="w-4 h-4 group-hover:scale-110 transition-transform" />
          {revealed === 0
            ? `Reveal Hint 1 of ${hints.length}`
            : `Reveal Hint ${revealed + 1} of ${hints.length}`}
        </button>
      )}

      {revealed > 0 && revealed === hints.length && (
        <p className="text-center text-xs text-muted-foreground py-1">
          All hints revealed — try to solve it from here!
        </p>
      )}
    </div>
  );
}

function CommunityDifficultyRating({
  problemId,
  communityDifficulty,
  difficultyVoteCount = 0,
  difficultyDistribution = {},
  myDifficultyVote,
}: {
  problemId: number;
  communityDifficulty?: number | null;
  difficultyVoteCount?: number;
  difficultyDistribution?: Record<string, number>;
  myDifficultyVote?: number | null;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const rateDifficulty = useRateMathDifficulty();

  const maxCount = Math.max(1, ...Object.values(difficultyDistribution).map(Number));

  const handleRate = (rating: number) => {
    if (!getMathUserId()) {
      toast({ title: "Sign in required", description: "Please sign in to rate.", variant: "destructive" });
      return;
    }
    rateDifficulty.mutate(
      { id: problemId, data: { rating } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetMathProblemQueryKey(problemId) });
          toast({ title: "Rating submitted", description: `You rated this problem ${rating}/5 difficulty.` });
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to submit rating.", variant: "destructive" });
        },
      },
    );
  };

  const displayRating = hovered ?? myDifficultyVote ?? null;
  const labels: Record<number, string> = {
    1: "Very Easy",
    2: "Easy",
    3: "Moderate",
    4: "Hard",
    5: "Brutal",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[13px] font-bold flex items-center gap-2">
          <Star className="w-3.5 h-3.5 text-amber-400" />
          Rate Difficulty
        </h4>
        {communityDifficulty != null && difficultyVoteCount > 0 && (
          <span className="text-[11px] text-muted-foreground">
            <span className="text-amber-400 font-bold">{communityDifficulty.toFixed(1)}</span>/5 · {difficultyVoteCount}v
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 mb-3">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => handleRate(n)}
            disabled={rateDifficulty.isPending}
            className={`w-8 h-8 rounded-lg border text-xs font-bold transition-all ${
              n <= (displayRating ?? 0)
                ? "bg-amber-500/20 border-amber-500/50 text-amber-400 scale-105"
                : "bg-secondary/30 border-border text-muted-foreground hover:border-amber-500/40 hover:text-amber-400/70"
            }`}
          >
            {n}
          </button>
        ))}
        {displayRating && (
          <span className="ml-2 text-[11px] text-muted-foreground">{labels[displayRating]}</span>
        )}
      </div>

      {difficultyVoteCount > 0 && (
        <div className="space-y-1">
          {[1, 2, 3, 4, 5].map((n) => {
            const count = difficultyDistribution[String(n)] ?? 0;
            const pct = Math.round((count / maxCount) * 100);
            return (
              <div key={n} className="flex items-center gap-2 text-[10px]">
                <span className="w-3 text-muted-foreground text-right">{n}</span>
                <div className="flex-1 h-1.5 bg-secondary/40 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500/60 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-4 text-muted-foreground">{count}</span>
              </div>
            );
          })}
        </div>
      )}

      {difficultyVoteCount === 0 && (
        <p className="text-[11px] text-muted-foreground text-center py-1">No ratings yet — be first!</p>
      )}
    </div>
  );
}

function WinnerSnapshotStrip({ problemId }: { problemId: number }) {
  const { data } = useGetMathShowdown(problemId, {
    query: { queryKey: getGetMathShowdownQueryKey(problemId) },
  });

  if (!data || data.solutions.length < 2) return null;

  const totalVotes = data.solutions.reduce(
    (acc, s) => acc + s.votes.elegant + s.votes.clear + s.votes.rigorous,
    0,
  );
  if (totalVotes < 3) return null;

  const byAxis = (axis: "elegant" | "clear" | "rigorous") =>
    data.solutions.reduce(
      (best, s) => (s.votes[axis] > (best?.votes[axis] ?? -1) ? s : best),
      data.solutions[0]!,
    );

  const mostElegant = byAxis("elegant");
  const mostClear = byAxis("clear");
  const mostRigorous = byAxis("rigorous");

  const overallFavorite = data.solutions.reduce((best, s) => {
    const t = s.votes.elegant + s.votes.clear + s.votes.rigorous;
    const bt = best.votes.elegant + best.votes.clear + best.votes.rigorous;
    return t > bt ? s : best;
  }, data.solutions[0]!);

  const badges: string[] = [];
  if (overallFavorite.isFastest) badges.push("⚡ fastest");
  if (mostElegant.id === overallFavorite.id && mostElegant.votes.elegant > 0) badges.push("🏆 most elegant");
  if (mostClear.id === overallFavorite.id && mostClear.votes.clear > 0) badges.push("✦ clearest");
  if (mostRigorous.id === overallFavorite.id && mostRigorous.votes.rigorous > 0) badges.push("🛡 most rigorous");

  return (
    <div
      className="mb-3 rounded-lg px-3 py-2"
      style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)" }}
    >
      <div className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "#a78bfa" }}>
        Community favorite
      </div>
      <div className="text-[11px] text-foreground/80">
        <span className="font-semibold">{overallFavorite.userName}</span>
        {"'s "}
        <span style={{ color: "#c4b5fd" }}>{overallFavorite.approach}</span>
        {" method"}
        {badges.length > 0 && (
          <span className="ml-1 text-muted-foreground">({badges.join(", ")})</span>
        )}
      </div>
    </div>
  );
}

/* ── Solution Rankings ────────────────────────────────────────────── */

const AXIS_ICONS: Record<string, { label: string; color: string }> = {
  elegant:   { label: "Elegant",   color: "#a78bfa" },
  clear:     { label: "Clear",     color: "#60a5fa" },
  rigorous:  { label: "Rigorous",  color: "#34d399" },
  efficient: { label: "Efficient", color: "#fbbf24" },
};

const APPROACH_COLORS_RANK: Record<string, string> = {
  calculus: "#60a5fa", geometric: "#34d399", algebraic: "#a78bfa",
  proof: "#fbbf24", intuitive: "#fb7185", combinatorial: "#22d3ee", other: "#94a3b8",
};

function SolutionRankings({ problemId }: { problemId: number }) {
  const { data } = useGetMathShowdown(problemId, {
    query: { queryKey: getGetMathShowdownQueryKey(problemId) },
  });

  if (!data || data.solutions.length < 2) return null;

  const totalVotes = data.solutions.reduce(
    (acc, s) => acc + s.votes.elegant + s.votes.clear + s.votes.rigorous + ((s.votes as unknown as Record<string, number>)["efficient"] ?? 0),
    0,
  );
  if (totalVotes < 2) return null;

  const ranked = [...data.solutions].sort((a, b) => {
    const ta = a.votes.elegant + a.votes.clear + a.votes.rigorous + ((a.votes as unknown as Record<string, number>)["efficient"] ?? 0);
    const tb = b.votes.elegant + b.votes.clear + b.votes.rigorous + ((b.votes as unknown as Record<string, number>)["efficient"] ?? 0);
    return tb - ta;
  });

  return (
    <div
      className="rounded-xl border mb-6 overflow-hidden"
      style={{ borderColor: "rgba(167,139,250,0.2)", background: "rgba(167,139,250,0.04)" }}
    >
      <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: "rgba(167,139,250,0.15)" }}>
        <div className="flex items-center gap-2">
          <Trophy className="w-3.5 h-3.5" style={{ color: "#a78bfa" }} />
          <span className="text-[12px] font-bold" style={{ color: "#c4b5fd" }}>Solution Rankings</span>
          <span className="text-[10px] text-muted-foreground">by community votes</span>
        </div>
        <Link href={`/math/problem/${problemId}/showdown`}>
          <span className="text-[11px] font-bold cursor-pointer hover:underline" style={{ color: "#a78bfa" }}>Vote ⚔ →</span>
        </Link>
      </div>
      <div className="divide-y" style={{ borderColor: "rgba(167,139,250,0.1)" }}>
        {ranked.slice(0, 5).map((s, i) => {
          const total = s.votes.elegant + s.votes.clear + s.votes.rigorous + ((s.votes as unknown as Record<string, number>)["efficient"] ?? 0);
          const color = APPROACH_COLORS_RANK[s.approach] ?? "#94a3b8";
          const medals = ["🥇", "🥈", "🥉"];
          return (
            <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="text-sm w-5 text-center shrink-0">{medals[i] ?? `#${i + 1}`}</span>
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                style={{ background: `${color}20`, color, border: `1.5px solid ${color}44` }}
              >
                {s.userName?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-foreground truncate">{s.userName}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0" style={{ background: `${color}18`, color }}>
                    {s.approach}
                  </span>
                  {s.solvingTime != null && (
                    <span className="text-[10px] text-muted-foreground shrink-0">⏱ {s.solvingTime}m</span>
                  )}
                </div>
                {total > 0 && (
                  <div className="flex items-center gap-2 mt-0.5">
                    {Object.entries(AXIS_ICONS).map(([axis, cfg]) => {
                      const v = (s.votes as unknown as Record<string, number>)[axis] ?? 0;
                      if (v === 0) return null;
                      return (
                        <span key={axis} className="text-[10px]" style={{ color: cfg.color }}>
                          {cfg.label[0]} {v}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
              <span className="text-[11px] font-bold text-muted-foreground shrink-0">{total} pts</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EleganceDebateButton({ problemId }: { problemId: number; solutionCount: number; problemTitle: string }) {
  return (
    <Link href={`/math/problem/${problemId}/showdown`}>
      <button
        className="w-full py-2 rounded-lg text-[12px] font-bold transition-all"
        style={{
          background: "rgba(139,92,246,0.18)",
          border: "1.5px solid rgba(139,92,246,0.5)",
          color: "#c4b5fd",
        }}
      >
        <Swords className="w-3.5 h-3.5 inline mr-1.5" />
        Compare Solutions
      </button>
    </Link>
  );
}

function AnnotationsPanel({ problemId }: { problemId: number }) {
  const userId = getMathUserId();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [newNote, setNewNote] = useState("");

  const { data: annotations, isLoading } = useGetMathAnnotations(
    { problemId },
    { query: { queryKey: getGetMathAnnotationsQueryKey({ problemId }), enabled: open } },
  );

  const addAnnotation = useAddMathAnnotation();

  const handleAdd = () => {
    if (!newNote.trim()) return;
    if (!getMathUserId()) {
      toast({ title: "Sign in required", description: "Please sign in to annotate.", variant: "destructive" });
      return;
    }
    addAnnotation.mutate(
      { data: { problemId, body: newNote } },
      {
        onSuccess: () => {
          setNewNote("");
          toast({ title: "Annotation added" });
          queryClient.invalidateQueries({ queryKey: getGetMathAnnotationsQueryKey({ problemId }) });
        },
      },
    );
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-secondary/20 hover:bg-secondary/40 transition-colors text-left"
      >
        <div className="flex items-center gap-2 font-medium text-sm">
          <MessageSquarePlus className="w-4 h-4 text-muted-foreground" />
          Problem Annotations
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-5 space-y-4">
          {isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : annotations && annotations.length > 0 ? (
            <div className="space-y-3">
              {annotations.map((a) => (
                <div key={a.id} className="bg-card/50 border border-border rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm font-medium">{a.userName}</span>
                    <span className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleDateString()}</span>
                    {a.userId === userId && <span className="text-[10px] px-1 py-0.5 bg-primary/10 text-primary rounded">You</span>}
                  </div>
                  <div className="text-sm text-foreground/90 font-serif">
                    <MathText text={a.body} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No annotations yet. Add a note or insight below.</p>
          )}

          <div className="space-y-2 pt-2 border-t border-border">
            <Textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a note, insight, or alternative approach hint… (LaTeX supported)"
              className="min-h-[80px] bg-background font-mono text-sm"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleAdd}
              disabled={addAnnotation.isPending || !newNote.trim()}
            >
              {addAnnotation.isPending ? "Adding…" : "Add Annotation"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function BookmarkButton({ problemId }: { problemId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [listName, setListName] = useState("Default");

  const { data: bookmarks } = useGetMathBookmarks({
    query: { queryKey: getGetMathBookmarksQueryKey(), enabled: !!getMathUserId() },
  });

  const existing = bookmarks?.find((b) => b.problemId === problemId);
  const isBookmarked = !!existing;

  const addBookmark = useAddMathBookmark();
  const removeBookmark = useRemoveMathBookmark();

  const handleSave = () => {
    if (!getMathUserId()) {
      toast({ title: "Sign in required", description: "Please sign in to bookmark.", variant: "destructive" });
      return;
    }
    addBookmark.mutate(
      { data: { problemId, note: note || undefined, listName: listName || "Default" } },
      {
        onSuccess: () => {
          toast({ title: isBookmarked ? "Bookmark updated!" : "Bookmarked!", description: "Saved to your bookmarks." });
          queryClient.invalidateQueries({ queryKey: getGetMathBookmarksQueryKey() });
          setOpen(false);
        },
      },
    );
  };

  const handleRemove = () => {
    if (!getMathUserId()) return;
    removeBookmark.mutate(
      { problemId },
      {
        onSuccess: () => {
          toast({ title: "Bookmark removed" });
          queryClient.invalidateQueries({ queryKey: getGetMathBookmarksQueryKey() });
          setOpen(false);
        },
      },
    );
  };

  const handleOpen = (nextOpen: boolean) => {
    if (nextOpen && existing) {
      setNote(existing.note ?? "");
      setListName(existing.listName ?? "Default");
    }
    setOpen(nextOpen);
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-all ${
            isBookmarked
              ? "bg-primary/10 border-primary/30 text-primary"
              : "border-border text-muted-foreground hover:border-primary/30 hover:text-primary hover:bg-primary/5"
          }`}
          title={isBookmarked ? "Edit bookmark" : "Bookmark this problem"}
        >
          {isBookmarked ? (
            <BookmarkCheck className="w-4 h-4" />
          ) : (
            <BookmarkPlus className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">{isBookmarked ? "Saved" : "Bookmark"}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-4" align="end">
        <div className="space-y-3">
          <h4 className="font-semibold text-sm">{isBookmarked ? "Edit Bookmark" : "Save Problem"}</h4>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">List</label>
            <Input
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              placeholder="Default"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Note (optional)</label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why are you saving this?"
              className="h-8 text-sm"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="flex-1" onClick={handleSave} disabled={addBookmark.isPending}>
              {addBookmark.isPending ? "Saving…" : isBookmarked ? "Update" : "Save"}
            </Button>
            {isBookmarked && (
              <Button size="sm" variant="destructive" onClick={handleRemove} disabled={removeBookmark.isPending}>
                Remove
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function RelatedProblems({ problemId, categoryColor }: { problemId: number; categoryColor?: string }) {
  const { data: related } = useGetRelatedMathProblems(
    { problemId, limit: 5 },
    { query: { queryKey: getGetRelatedMathProblemsQueryKey({ problemId, limit: 5 }) } },
  );

  if (!related || related.length === 0) return null;

  const DIFF_COLORS: Record<string, string> = {
    beginner: "#34d399", intermediate: "#60a5fa",
    advanced: "#fbbf24", olympiad: "#f87171", research: "#a78bfa",
  };

  return (
    <div className="divide-y divide-border/60">
      {related.map((p) => (
        <Link key={p.id} href={`/math/problem/${p.id}`}>
          <div className="px-4 py-3 hover:bg-secondary/20 transition-colors cursor-pointer group">
            <div className="text-[12px] font-medium text-foreground group-hover:text-primary transition-colors font-serif line-clamp-2 mb-1">
              <MathText text={p.title} />
            </div>
            <div className="flex items-center gap-2">
              {p.categoryName && (
                <span className="text-[10px] text-muted-foreground">{p.categoryName}</span>
              )}
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                style={{
                  color: DIFF_COLORS[p.difficulty] ?? "#60a5fa",
                  background: `${DIFF_COLORS[p.difficulty] ?? "#60a5fa"}18`,
                }}
              >
                {p.difficulty}
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

/* ── Step parser ──────────────────────────────────────────────────── */

export function parseSteps(text: string): { label: string | null; content: string }[] {
  // Paragraph-based parse first — this is what the step composer produces:
  // "**Step 1:** content\n\n**Step 2:** content\n\n**Final Answer:** answer"
  const paras = text.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  if (paras.length >= 2) {
    const parsed = paras.map((para) => {
      // "**Step N:** content" (colon inside the bold markers — step composer format)
      const boldStep = para.match(/^\*\*Step\s+(\d+):\*\*\s*([\s\S]+)/i);
      if (boldStep) return { label: `Step ${boldStep[1]}`, content: boldStep[2].trim() };
      // "**Final Answer:** content"
      const boldFinal = para.match(/^\*\*Final Answer:\*\*\s*([\s\S]+)/i);
      if (boldFinal) return { label: "Final Answer", content: boldFinal[1].trim() };
      // "**Label:** content" — generic bold label (letters/spaces only)
      const boldLabel = para.match(/^\*\*([A-Z][A-Za-z\s]{0,25}?):\*\*\s*([\s\S]+)/);
      if (boldLabel && boldLabel[1].split(" ").length <= 4) return { label: boldLabel[1], content: boldLabel[2].trim() };
      // "Label: content" — plain (non-bold) label, letters/spaces only
      const m = para.match(/^(?:\*\*)?([A-Z][A-Za-z\s]{1,25}?)(?:\*\*)?:\s*([\s\S]+)/);
      if (m && m[1].split(" ").length <= 4 && !/\d/.test(m[1])) return { label: m[1], content: m[2].trim() };
      return { label: null, content: para };
    });
    if (parsed.some((p) => p.label !== null)) return parsed;
  }

  // Fallback: single-block numbering like "Step 1: ..." / "1. ..." on separate lines
  const numbered = text.split(/\n(?=(?:\*\*)?(?:Step\s+)?\d+(?:\*\*)?[.):\s])/m).filter((s) => s.trim());
  if (numbered.length >= 2) {
    return numbered.map((part, i) => {
      const boldStep = part.match(/^\*\*Step\s+(\d+):\*\*\s*([\s\S]*)/i);
      if (boldStep) return { label: `Step ${boldStep[1]}`, content: boldStep[2].trim() };
      const m = part.match(/^(?:\*\*)?(?:Step\s+)?(\d+)(?:\*\*)?[.):\s]+\s*([\s\S]*)/);
      if (m) return { label: `Step ${m[1]}`, content: m[2].trim() };
      return { label: `Step ${i + 1}`, content: part.trim() };
    });
  }
  return [{ label: null, content: text }];
}

/* ── Steps Renderer (for solutions) ──────────────────────────────── */

export function StepsRenderer({ body, color }: { body: string; color: string }) {
  const steps = parseSteps(body);

  if (steps.length === 1) {
    return (
      <div className="font-serif text-foreground/90 leading-relaxed text-sm">
        <MathText text={steps[0].content} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {steps.map((step, i) => (
        <div key={i} className="flex gap-3">
          <div
            className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black mt-0.5"
            style={{ background: `${color}22`, color, border: `1.5px solid ${color}44` }}
          >
            {step.label?.match(/\d+/)?.[0] ?? i + 1}
          </div>
          <div className="flex-1 min-w-0">
            {step.label && (
              <div className="text-[10px] font-black uppercase tracking-wider mb-1" style={{ color }}>
                {step.label}
              </div>
            )}
            <div className="text-sm font-serif text-foreground/90 leading-relaxed">
              <MathText text={step.content} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Problem Body Renderer (for problem statement) ────────────────── */

const SECTION_COLORS: Record<string, string> = {
  Given: "#34d399",
  Find: "#60a5fa",
  Prove: "#a78bfa",
  Show: "#a78bfa",
  Determine: "#60a5fa",
  Solution: "#fbbf24",
  Note: "#94a3b8",
  Constraint: "#fb7185",
  Constraints: "#fb7185",
  Problem: "#818cf8",
  Question: "#818cf8",
};

function ProblemBodyRenderer({ body }: { body: string }) {
  const sections = body.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);

  if (sections.length <= 1) {
    return (
      <div className="prose prose-invert prose-p:leading-relaxed max-w-none text-foreground text-lg font-serif">
        <MathText text={body} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sections.map((section, i) => {
        const labelMatch = section.match(/^(?:\*\*)?([A-Z][A-Za-z\s]{1,25}?)(?:\*\*)?:\s*([\s\S]+)/);
        if (labelMatch && labelMatch[1].split(" ").length <= 4) {
          const label = labelMatch[1];
          const content = labelMatch[2].trim();
          const color = SECTION_COLORS[label] ?? "#818cf8";
          return (
            <div
              key={i}
              className="rounded-xl border p-4"
              style={{ borderColor: `${color}30`, background: `${color}07` }}
            >
              <div
                className="text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-1.5"
                style={{ color }}
              >
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: color }} />
                {label}
              </div>
              <div className="text-base font-serif text-foreground/90 leading-relaxed">
                <MathText text={content} />
              </div>
            </div>
          );
        }
        return (
          <div key={i} className="text-lg font-serif text-foreground/90 leading-relaxed">
            <MathText text={section} />
          </div>
        );
      })}
    </div>
  );
}

/* ── Left: Math Debates Sidebar ───────────────────────────────────── */

function MathDebatesSidebar({
  problemId,
  solutionCount,
  problemTitle,
}: {
  problemId: number;
  solutionCount: number;
  problemTitle: string;
}) {
  const { data: allDebates, isLoading: debatesLoading } = useGetDebates();

  // Only Math Elegance Battles belong in this panel — every other debate
  // topic has its own home on the main Debates page.
  const eleganceBattles = (allDebates ?? [])
    .filter((d) => d.mathProblemId != null || d.title.startsWith("Elegance Battle:"))
    .sort((a, b) => (b.participantCount ?? 0) - (a.participantCount ?? 0));

  return (
    <div className="flex flex-col gap-3">
      {/* Elegant Battles list */}
      <div
        className="rounded-xl overflow-hidden border"
        style={{
          background: "linear-gradient(135deg,rgba(167,139,250,0.06),rgba(99,102,241,0.04))",
          borderColor: "rgba(167,139,250,0.25)",
        }}
      >
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "rgba(167,139,250,0.2)" }}>
          <span className="text-[13px] font-bold flex items-center gap-1.5" style={{ color: "#c4b5fd" }}>
            <span>⚔</span> Elegant Battles
          </span>
          <Link href="/debates?category=Mathematics">
            <span className="text-[11px] text-primary cursor-pointer hover:underline">All →</span>
          </Link>
        </div>

        {debatesLoading ? (
          <div className="px-4 py-8 text-center">
            <p className="text-[12px] text-muted-foreground">Loading battles…</p>
          </div>
        ) : eleganceBattles.length > 0 ? (
          <div className="divide-y divide-border/40">
            {eleganceBattles.slice(0, 7).map((d, i) => {
              const battle = d as typeof d & { winnerStatus?: string | null; endedAt?: string | null };
              const isLive = battle.isLive !== false
                && !battle.endedAt
                && (battle.winnerStatus ?? "undecided") === "undecided";
              const displayTitle = d.title.startsWith("Elegance Battle:")
                ? d.title.slice("Elegance Battle:".length).trim()
                : d.title;
              const href = d.mathProblemId
                ? `/math/problem/${d.mathProblemId}/elegance-battle`
                : `/debates/${d.id}`;
              return (
                <Link key={d.id} href={href}>
                  <div className="px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer group">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-[10px]" style={{ color: "#a78bfa" }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "⚔"}</span>
                      <div className="text-[12px] font-medium text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-2">
                        {displayTitle}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">
                        {isLive ? "Voting open" : "Concluded"}
                      </span>
                      {isLive && (
                        <span
                          className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                          style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}
                        >
                          LIVE
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="px-4 py-8 text-center">
            <p className="text-[12px] text-muted-foreground">No elegance battles yet.</p>
          </div>
        )}
      </div>

      {/* Elegance Battle CTA */}
      {solutionCount >= 2 && (
        <div
          className="rounded-xl border p-4"
          style={{
            background: "linear-gradient(135deg,rgba(167,139,250,0.08),rgba(99,102,241,0.06))",
            borderColor: "rgba(167,139,250,0.25)",
          }}
        >
          <div className="text-[13px] font-bold mb-1.5" style={{ color: "#c4b5fd" }}>
            ⚔ Elegance Battle
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">
            Two solutions, one winner. Challenge a rival proof on this problem.
          </p>
          <WinnerSnapshotStrip problemId={problemId} />
          <EleganceDebateButton
            problemId={problemId}
            solutionCount={solutionCount}
            problemTitle={problemTitle}
          />
        </div>
      )}

      {/* Post a problem */}
      <Link href="/math/post">
        <div className="rounded-xl border border-border/60 p-4 hover:bg-muted/20 transition-colors cursor-pointer">
          <div className="text-[13px] font-bold mb-1">✏ Ask a Math Problem</div>
          <p className="text-[11px] text-muted-foreground">
            Share your own challenge with the community.
          </p>
        </div>
      </Link>
    </div>
  );
}

/* ── Right: Problem Context Panel ─────────────────────────────────── */

const DIFF_COLORS_RIGHT: Record<string, string> = {
  beginner: "#34d399",
  intermediate: "#60a5fa",
  advanced: "#fbbf24",
  olympiad: "#f87171",
  research: "#a78bfa",
};

function ProblemRightPanel({
  problem,
  problemId,
}: {
  problem: {
    difficulty: string;
    communityDifficulty?: number | null;
    difficultyVoteCount?: number | null;
    difficultyDistribution?: unknown;
    categoryColor?: string | null;
    categoryIcon?: string | null;
    categoryName?: string | null;
    userName?: string | null;
    solutions?: unknown[] | null;
    myDifficultyVote?: number | null;
  };
  problemId: number;
}) {
  return (
    <div className="flex flex-col gap-3">
      {/* Problem at a glance */}
      <div className="bg-card border border-border/60 rounded-xl p-4">
        <div className="text-[13px] font-bold mb-3">Problem Info</div>
        <div className="space-y-2.5">
          <div className="flex justify-between items-center">
            <span className="text-[12px] text-muted-foreground">Difficulty</span>
            <span
              className="text-[12px] font-bold capitalize"
              style={{ color: DIFF_COLORS_RIGHT[problem.difficulty] ?? "#60a5fa" }}
            >
              {problem.difficulty}
            </span>
          </div>
          {problem.communityDifficulty != null && (problem.difficultyVoteCount ?? 0) > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-muted-foreground">Community says</span>
              <span className="text-[12px] font-semibold text-amber-400">
                {problem.communityDifficulty.toFixed(1)}/5
              </span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-[12px] text-muted-foreground">Branch</span>
            <span
              className="text-[12px] font-semibold"
              style={{ color: problem.categoryColor ?? "#818cf8" }}
            >
              {problem.categoryIcon} {problem.categoryName}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[12px] text-muted-foreground">Posted by</span>
            <span className="text-[12px] font-medium text-foreground">{problem.userName}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[12px] text-muted-foreground">Solutions</span>
            <span className="text-[12px] font-bold text-primary">
              {problem.solutions?.length ?? 0}
            </span>
          </div>
        </div>
      </div>

      {/* Community difficulty rating */}
      <div className="bg-card border border-border/60 rounded-xl p-4">
        <CommunityDifficultyRating
          problemId={problemId}
          communityDifficulty={problem.communityDifficulty}
          difficultyVoteCount={problem.difficultyVoteCount ?? 0}
          difficultyDistribution={problem.difficultyDistribution as Record<string, number>}
          myDifficultyVote={problem.myDifficultyVote}
        />
      </div>

      {/* Related problems */}
      <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border/60">
          <span className="text-[13px] font-bold">Related Problems</span>
        </div>
        <RelatedProblems problemId={problemId} categoryColor={problem.categoryColor ?? undefined} />
      </div>
    </div>
  );
}

/* ── Solution Card ────────────────────────────────────────────────── */

const APPROACH_AVATAR_COLORS: Record<string, { bg: string; text: string }> = {
  calculus:      { bg: "rgba(96,165,250,0.18)",  text: "#60a5fa" },
  geometric:     { bg: "rgba(52,211,153,0.18)",  text: "#34d399" },
  algebraic:     { bg: "rgba(167,139,250,0.18)", text: "#a78bfa" },
  proof:         { bg: "rgba(251,191,36,0.18)",  text: "#fbbf24" },
  intuitive:     { bg: "rgba(251,113,133,0.18)", text: "#fb7185" },
  combinatorial: { bg: "rgba(34,211,238,0.18)",  text: "#22d3ee" },
  other:         { bg: "rgba(148,163,184,0.18)", text: "#94a3b8" },
};

function SolutionCard({ sol, problemId, index, problemOwnerId }: { sol: MathSolution; problemId: number; index: number; problemOwnerId?: string }) {
  const flagContent = useFlagMathContent();
  const updateSolution = useUpdateMathSolution();
  const deleteSolution = useDeleteMathSolution();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [flagged, setFlagged] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editBody, setEditBody] = useState(sol.body);
  const [editApproach, setEditApproach] = useState<MathSolutionInputApproach>(
    sol.approach as MathSolutionInputApproach,
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isAccepted, setIsAccepted] = useState(sol.isAccepted ?? false);

  const currentUserId = getMathUserId();
  const isOwner = !!currentUserId && currentUserId === sol.userId;
  const isProblemOwner = !!currentUserId && !!problemOwnerId && currentUserId === problemOwnerId;

  const acceptSolution = useMutation({
    mutationFn: async () => {
      const res = await authenticatedFetch(`/api/math/solutions/${sol.id}/accept`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as { error?: string }).error ?? "Failed"); }
      return res.json() as Promise<{ isAccepted: boolean }>;
    },
    onSuccess: (data) => {
      setIsAccepted(data.isAccepted);
      queryClient.invalidateQueries({ queryKey: getGetMathProblemQueryKey(problemId) });
      toast({ title: data.isAccepted ? "Solution accepted ✅" : "Acceptance removed" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleFlagSolution = () => {
    if (!getMathUserId()) {
      toast({ title: "Sign in required", description: "Please sign in to flag content.", variant: "destructive" });
      return;
    }
    if (flagged) return;
    flagContent.mutate(
      { data: { targetType: "solution", targetId: sol.id, reason: "Flagged by user" } },
      {
        onSuccess: () => {
          setFlagged(true);
          toast({ title: "Flagged", description: "Solution has been flagged for review." });
        },
      },
    );
  };

  const handleSaveEdit = () => {
    if (!editBody.trim()) {
      toast({ title: "Body required", description: "Solution body cannot be empty.", variant: "destructive" });
      return;
    }
    updateSolution.mutate(
      { id: sol.id, data: { body: editBody, approach: editApproach } },
      {
        onSuccess: () => {
          setIsEditing(false);
          queryClient.invalidateQueries({ queryKey: getGetMathProblemQueryKey(problemId) });
          toast({ title: "Solution updated" });
        },
        onError: () => {
          toast({ title: "Update failed", description: "Could not save changes.", variant: "destructive" });
        },
      },
    );
  };

  const handleDelete = () => {
    deleteSolution.mutate(
      { id: sol.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetMathProblemQueryKey(problemId) });
          toast({ title: "Solution deleted" });
        },
        onError: () => {
          toast({ title: "Delete failed", description: "Could not delete solution." });
          setShowDeleteConfirm(false);
        },
      },
    );
  };

  const approachColor = APPROACH_AVATAR_COLORS[sol.approach] ?? APPROACH_AVATAR_COLORS["other"]!;
  const initial = sol.userName?.charAt(0).toUpperCase() ?? "?";

  return (
    <div id={`solution-${sol.id}`} className="border border-border rounded-xl overflow-hidden scroll-mt-24" style={{ background: "var(--color-card)" }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b border-border"
        style={{ background: approachColor.bg }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-black uppercase tracking-widest" style={{ color: approachColor.text }}>
            Solution #{index + 1}
          </span>
          <ApproachBadge approach={sol.approach} />
        </div>
        <div className="flex items-center gap-2">
          {/* Challenge button — always visible */}
          <Link href={`/math/problem/${problemId}/showdown`}>
            <button
              title="Compare all solutions in the Showdown"
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-colors"
              style={{ background: "rgba(139,92,246,0.12)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.3)" }}
            >
              <Swords className="w-3 h-3" /> Compare
            </button>
          </Link>
          {/* Accepted badge — always visible when accepted */}
          {isAccepted && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
              <CheckCircle2 className="w-3 h-3" /> Accepted
            </span>
          )}

          {/* Problem owner: mark/unmark accepted */}
          {isProblemOwner && !isOwner && !isEditing && (
            <button
              onClick={() => acceptSolution.mutate()}
              disabled={acceptSolution.isPending}
              title={isAccepted ? "Remove accepted mark" : "Mark as accepted answer"}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                isAccepted
                  ? "bg-emerald-500/10 text-emerald-400 hover:bg-red-500/10 hover:text-red-400"
                  : "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              {isAccepted ? "Unaccept" : "Accept"}
            </button>
          )}

          {isOwner && !isEditing && (
            <>
              <button
                onClick={() => {
                  setIsEditing(true);
                  setShowDeleteConfirm(false);
                  setEditBody(sol.body);
                  setEditApproach(sol.approach as MathSolutionInputApproach);
                }}
                title="Edit solution"
                className="p-1.5 rounded-lg transition-colors text-muted-foreground/40 hover:text-blue-400 hover:bg-blue-500/10"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              {showDeleteConfirm ? (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">Delete?</span>
                  <button
                    onClick={handleDelete}
                    disabled={deleteSolution.isPending}
                    title="Confirm delete"
                    className="p-1.5 rounded-lg transition-colors text-red-400 hover:bg-red-500/10"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    title="Cancel"
                    className="p-1.5 rounded-lg transition-colors text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/20"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  title="Delete solution"
                  className="p-1.5 rounded-lg transition-colors text-muted-foreground/40 hover:text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}
          {!isOwner && (
            <button
              onClick={handleFlagSolution}
              disabled={flagged || flagContent.isPending}
              title="Flag this solution"
              className={`p-1.5 rounded-lg transition-colors ${flagged ? "text-amber-500 bg-amber-500/10" : "text-muted-foreground/40 hover:text-amber-500 hover:bg-amber-500/10"}`}
            >
              <Flag className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Author */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border/50">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
          style={{ background: approachColor.bg, color: approachColor.text, border: `1.5px solid ${approachColor.text}40` }}
        >
          {initial}
        </div>
        <div>
          <div className="text-sm font-semibold text-foreground leading-none mb-0.5">{sol.userName}</div>
          <div className="text-xs text-muted-foreground">
            {new Date(sol.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 sm:p-6">
        {isEditing ? (
          <div className="space-y-3 mb-4">
            <Select
              value={editApproach}
              onValueChange={(v) => setEditApproach(v as MathSolutionInputApproach)}
            >
              <SelectTrigger className="w-40 h-8 text-xs bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["calculus", "geometric", "algebraic", "proof", "intuitive", "combinatorial", "other"] as const).map((a) => (
                  <SelectItem key={a} value={a} className="text-xs capitalize">
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              className="min-h-[140px] font-mono text-sm bg-background border-border resize-y"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSaveEdit}
                disabled={updateSolution.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {updateSolution.isPending ? "Saving…" : "Save"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsEditing(false)}
                disabled={updateSolution.isPending}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="mb-6">
            <StepsRenderer body={sol.body} color={approachColor.text} />
          </div>
        )}

        {!isEditing && (
          <ReactionBar
            targetType="solution"
            targetId={sol.id}
            counts={sol.reactionCounts as Record<string, number>}
            myReactions={sol.myReactions ?? []}
            problemId={problemId}
          />
        )}
      </div>
    </div>
  );
}

/* ── Step-based Solution Composer ─────────────────────────────────── */

type StepEntry = { id: string; content: string };

const APPROACH_PALETTE: Record<string, { label: string; color: string }> = {
  calculus:      { label: "Calculus",      color: "#60a5fa" },
  geometric:     { label: "Geometric",     color: "#34d399" },
  algebraic:     { label: "Algebraic",     color: "#a78bfa" },
  proof:         { label: "Proof",         color: "#fbbf24" },
  intuitive:     { label: "Intuitive",     color: "#fb7185" },
  combinatorial: { label: "Combinatorial", color: "#22d3ee" },
  other:         { label: "Other",         color: "#94a3b8" },
};

function StepSolutionComposer({ problemId }: { problemId: number }) {
  const submitSolution = useSubmitMathSolution();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [steps, setSteps] = useState<StepEntry[]>([{ id: "step-1", content: "" }]);
  const [finalAnswer, setFinalAnswer] = useState("");
  const [approach, setApproach] = useState<MathSolutionInputApproach>("other");
  const [activeStepId, setActiveStepId] = useState<string>("step-1");
  const [solvingTime, setSolvingTime] = useState<number | null>(null);
  const stepRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const submitInFlightRef = useRef(false);

  const addStep = () => {
    const newId = `step-${Date.now()}`;
    setSteps((prev) => [...prev, { id: newId, content: "" }]);
    setActiveStepId(newId);
    requestAnimationFrame(() => stepRefs.current[newId]?.focus());
  };

  const removeStep = (id: string) => {
    if (steps.length <= 1) return;
    const idx = steps.findIndex((s) => s.id === id);
    const remaining = steps.filter((s) => s.id !== id);
    setSteps(remaining);
    const next = remaining[Math.max(0, idx - 1)];
    if (next) { setActiveStepId(next.id); requestAnimationFrame(() => stepRefs.current[next.id]?.focus()); }
  };

  const updateStep = (id: string, content: string) => {
    setSteps((prev) => prev.map((s) => s.id === id ? { ...s, content } : s));
  };

  const insertSymbol = useCallback((latex: string) => {
    const ta = stepRefs.current[activeStepId];
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const ins = "$" + latex + "$";
    updateStep(activeStepId, value.slice(0, s) + ins + value.slice(e));
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(s + ins.length, s + ins.length);
    });
  }, [activeStepId]);

  const handleSubmit = () => {
    if (submitSolution.isPending || submitInFlightRef.current) return;
    const filledSteps = steps.filter((s) => s.content.trim());
    if (filledSteps.length === 0 && !finalAnswer.trim()) {
      toast({ title: "Solution empty", description: "Add at least one step before submitting.", variant: "destructive" });
      return;
    }
    if (!getMathUserId()) {
      toast({ title: "Sign in required", description: "Please sign in to submit solutions.", variant: "destructive" });
      return;
    }
    const parts = filledSteps.map((s, i) => `**Step ${i + 1}:** ${s.content.trim()}`);
    if (finalAnswer.trim()) parts.push(`**Final Answer:** ${finalAnswer.trim()}`);
    const body = parts.join("\n\n");
    submitInFlightRef.current = true;

    submitSolution.mutate(
      { id: problemId, data: { body, approach, ...(solvingTime ? { solvingTime } : {}) } },
      {
        onSuccess: () => {
          submitInFlightRef.current = false;
          setSteps([{ id: "step-1", content: "" }]);
          setFinalAnswer("");
          setApproach("other");
          setActiveStepId("step-1");
          setSolvingTime(null);
          toast({ title: "Solution submitted!", description: "Your solution has been posted." });
          queryClient.invalidateQueries({ queryKey: getGetMathProblemQueryKey(problemId) });
        },
        onError: (error: unknown) => {
          submitInFlightRef.current = false;
          const data = (error as { data?: { error?: string } | null })?.data;
          toast({
            title: "Could not submit solution",
            description: data?.error ?? "Please try again. If you already submitted a solution, edit it above instead.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const approachCfg = APPROACH_PALETTE[approach] ?? APPROACH_PALETTE["other"]!;
  const filledCount = steps.filter((s) => s.content.trim()).length;

  return (
    <div className="rounded-2xl border border-border overflow-hidden" style={{ background: "var(--color-card)" }}>
      {/* Header */}
      <div className="px-5 sm:px-6 py-4 border-b border-border flex items-center justify-between gap-4 bg-secondary/20">
        <div>
          <h3 className="text-lg font-bold font-serif">Submit your solution</h3>
          <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">
            Build your proof step by step — each block renders LaTeX live
          </p>
        </div>
        <LatexSymbolPicker onInsert={insertSymbol} />
      </div>

      <div className="p-5 sm:p-6 space-y-6">
        {/* Approach chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1">Approach</span>
          {Object.entries(APPROACH_PALETTE).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => setApproach(key as MathSolutionInputApproach)}
              className="px-3 py-1 rounded-full text-xs font-semibold border transition-all"
              style={approach === key
                ? { background: `${cfg.color}22`, borderColor: `${cfg.color}55`, color: cfg.color }
                : { background: "transparent", borderColor: "var(--color-border)", color: "var(--color-muted-foreground)" }
              }
            >
              {cfg.label}
            </button>
          ))}
        </div>

        {/* Step blocks */}
        <div className="space-y-4">
          {steps.map((step, idx) => {
            const isActive = step.id === activeStepId;
            const hasContent = step.content.trim().length > 0;
            return (
              <div key={step.id}>
                {/* Label row */}
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 transition-colors"
                    style={{ background: `${approachCfg.color}22`, color: approachCfg.color, border: `1.5px solid ${approachCfg.color}44` }}
                  >
                    {idx + 1}
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: approachCfg.color }}>
                    Step {idx + 1}
                  </span>
                  {steps.length > 1 && (
                    <button
                      onClick={() => removeStep(step.id)}
                      className="ml-auto text-muted-foreground/40 hover:text-destructive transition-colors"
                      title="Remove step"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Editor + preview panel */}
                <div
                  className="rounded-xl border overflow-hidden transition-all"
                  style={{ borderColor: isActive ? `${approachCfg.color}50` : "var(--color-border)" }}
                >
                  <textarea
                    ref={(el) => { stepRefs.current[step.id] = el; }}
                    value={step.content}
                    onChange={(e) => updateStep(step.id, e.target.value)}
                    onFocus={() => setActiveStepId(step.id)}
                    placeholder={
                      idx === 0
                        ? "Let $x$ be… Define variables and state assumptions."
                        : "Continue the proof…"
                    }
                    className="w-full bg-background font-mono text-sm px-4 py-3 resize-none focus:outline-none"
                    style={{ color: "var(--color-foreground)", minHeight: "88px" }}
                    rows={3}
                  />
                  {hasContent && (
                    <div
                      className="px-4 py-3 border-t font-serif text-sm leading-relaxed"
                      style={{
                        borderColor: `${approachCfg.color}20`,
                        background: `${approachCfg.color}06`,
                      }}
                    >
                      <span
                        className="text-[10px] font-bold uppercase tracking-widest mr-2"
                        style={{ color: approachCfg.color }}
                      >
                        ↳ Preview
                      </span>
                      <MathText text={step.content} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add step button */}
        <button
          onClick={addStep}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-dashed border-border hover:border-foreground/30 rounded-xl px-4 py-3 w-full transition-all hover:bg-secondary/30"
        >
          <Plus className="w-4 h-4" />
          Add Step
        </button>

        {/* Final answer */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 bg-amber-500/15 border border-amber-500/35 text-amber-400">
              ✓
            </div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400">Final Answer</span>
            <span className="text-xs text-muted-foreground">(optional)</span>
          </div>
          <div className="rounded-xl border border-border overflow-hidden transition-colors focus-within:border-amber-500/35">
            <textarea
              value={finalAnswer}
              onChange={(e) => setFinalAnswer(e.target.value)}
              onFocus={() => setActiveStepId("")}
              placeholder="State your final answer — e.g. $x = 5$ or $\blacksquare$"
              className="w-full bg-background font-mono text-sm px-4 py-3 resize-none focus:outline-none"
              style={{ color: "var(--color-foreground)", minHeight: "64px" }}
              rows={2}
            />
            {finalAnswer.trim() && (
              <div className="px-4 py-3 border-t border-amber-500/20 bg-amber-500/5 font-serif text-sm leading-relaxed">
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400 mr-2">↳ Preview</span>
                <MathText text={finalAnswer} />
              </div>
            )}
          </div>
        </div>

        {/* Solve time */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Timer className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">How long did this take?</span>
            <span className="text-xs text-muted-foreground">(optional)</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={9999}
              value={solvingTime ?? ""}
              onChange={(e) => setSolvingTime(e.target.value ? Number(e.target.value) : null)}
              placeholder="e.g. 15"
              className="w-28 h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:border-primary/50"
            />
            <span className="text-xs text-muted-foreground">minutes</span>
            <span className="text-[10px] text-muted-foreground/60 ml-1">— helps rank solution speed in the Showdown</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-xs text-muted-foreground">
            {filledCount > 0
              ? `${filledCount} step${filledCount !== 1 ? "s" : ""}${finalAnswer.trim() ? " + final answer" : ""}`
              : "No steps yet"}
          </span>
          <Button onClick={handleSubmit} disabled={submitSolution.isPending} className="px-6">
            {submitSolution.isPending ? "Submitting…" : "Submit Solution →"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────────────────── */

export default function ProblemDetail() {
  const params = useParams();
  const id = Number(params["id"]);
  const { data: problem, isLoading } = useGetMathProblem(id, {
    query: { enabled: !!id, queryKey: getGetMathProblemQueryKey(id) },
  });

  const flagContent = useFlagMathContent();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const currentUserId = getMathUserId();
  const existingOwnSolution = problem?.solutions?.find((solution: MathSolution) => solution.userId === currentUserId);
  const handleFlag = () => {
    if (!getMathUserId()) {
      toast({ title: "Sign in required", description: "Please sign in to flag content.", variant: "destructive" });
      return;
    }
    flagContent.mutate(
      { data: { targetType: "problem", targetId: id, reason: "Flagged by user" } },
      {
        onSuccess: () => toast({ title: "Flagged", description: "Problem has been flagged for review." }),
      },
    );
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-2xl font-serif mb-4">Problem Not Found</h1>
        <Link href="/math" className="text-primary hover:underline">
          Return to Math Hub
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1440, margin: "0 auto", padding: "24px 16px 80px" }}>
      <style>{`
        .prob-detail-grid {
          display: grid;
          grid-template-columns: 260px 1fr 280px;
          gap: 24px;
          align-items: start;
        }
        .prob-detail-left,
        .prob-detail-right {
          position: sticky;
          top: 16px;
          max-height: calc(100vh - 40px);
          overflow-y: auto;
          scrollbar-width: thin;
        }
        @media (max-width: 1100px) {
          .prob-detail-grid { grid-template-columns: 1fr 280px; }
          .prob-detail-left { display: none; }
        }
        @media (max-width: 860px) {
          .prob-detail-grid { grid-template-columns: 1fr; }
          .prob-detail-right { display: none; }
        }
      `}</style>

      {/* Back + bookmark */}
      <div className="mb-5 flex items-center justify-between">
        <Link href="/math" className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
          ← Back to Math Hub
        </Link>
        <BookmarkButton problemId={id} />
      </div>

      <div className="prob-detail-grid">

        {/* LEFT: Math Debates */}
        <aside className="prob-detail-left">
          <MathDebatesSidebar
            problemId={id}
            solutionCount={problem.solutions?.length ?? 0}
            problemTitle={problem.title}
          />
        </aside>

        {/* CENTER: Problem + Solutions */}
        <main className="min-w-0">

          {/* Problem Card */}
          <div
            className="mb-6 overflow-hidden rounded-[24px] border border-indigo-500/15 p-4 shadow-[0_28px_80px_rgba(15,23,42,0.10)] sm:p-8"
            style={{
              position: "relative",
              background: "linear-gradient(145deg, color-mix(in srgb, var(--color-card) 96%, #6366f1 4%), color-mix(in srgb, var(--color-card) 98%, #22d3ee 2%))",
            }}
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400/70 to-transparent" />
            <div aria-hidden="true" className="pointer-events-none absolute -right-4 top-1 select-none font-serif text-8xl text-indigo-400/[0.045]">∑</div>

            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
              <div className="space-y-2">
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="flex items-center gap-1.5 rounded-full border px-3 py-1 font-bold" style={{ color: problem.categoryColor, borderColor: `${problem.categoryColor}35`, background: `${problem.categoryColor}10` }}>
                    <span style={{ color: problem.categoryColor }}>{problem.categoryIcon}</span>
                    {problem.categoryName}
                  </span>
                  <span className="rounded-full border border-border bg-background/50 px-3 py-1 text-muted-foreground">
                    Problem #{problem.id}
                  </span>
                </div>
                <h1 className="max-w-3xl break-words font-serif text-2xl font-semibold leading-tight tracking-[-0.025em] text-foreground sm:text-4xl">
                  <MathText text={problem.title} />
                </h1>
                <p className="text-xs text-muted-foreground">Proposed by <span className="font-semibold text-foreground/80">{problem.userName}</span></p>
              </div>
              <DifficultyBadge difficulty={problem.difficulty} />
            </div>

            <div className="mb-6 flex flex-wrap items-center gap-2">
              {problem.problemType && (
                <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-[11px] font-bold capitalize text-indigo-400">
                  {problem.problemType === "open" ? "Open inquiry" : problem.problemType}
                </span>
              )}
              {problem.estimatedMinutes != null && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-3 py-1 text-[11px] text-muted-foreground">
                  <Timer className="h-3 w-3" /> About {problem.estimatedMinutes} min
                </span>
              )}
              {problem.tags?.map((tag) => (
                <span key={tag} className="rounded-full bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground">
                  #{tag}
                </span>
              ))}
            </div>

            {problem.prerequisites && (
              <div className="mb-5 rounded-xl border border-border bg-secondary/30 px-4 py-3 text-xs leading-5 text-muted-foreground">
                <span className="font-bold text-foreground">Helpful prerequisites:</span> {problem.prerequisites}
              </div>
            )}

            {/* Structured problem body */}
            <div
              className="mb-8 overflow-x-auto rounded-2xl border border-border p-4 sm:p-6"
              style={{
                background: "linear-gradient(90deg, rgba(99,102,241,.045) 1px, transparent 1px), linear-gradient(rgba(99,102,241,.045) 1px, transparent 1px), color-mix(in srgb, var(--color-background) 91%, var(--color-card))",
                backgroundSize: "24px 24px",
              }}
            >
              <ProblemBodyRenderer body={problem.body} />
            </div>

            {/* Progressive hints */}
            {problem.hints && problem.hints.length > 0 && (
              <ProgressiveHints hints={problem.hints} />
            )}

            {!problem.isOriginal && problem.sourceAttribution && (
              <div className="mb-6 rounded-xl border border-border bg-background/60 px-4 py-3 text-xs leading-5 text-muted-foreground">
                <span className="font-bold text-foreground">Source:</span>{" "}
                {problem.sourceUrl ? (
                  <a href={problem.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">
                    {problem.sourceAttribution}
                  </a>
                ) : problem.sourceAttribution}
              </div>
            )}

            <div className="pt-6 border-t border-border flex justify-between items-center flex-wrap gap-3">
              <ReactionBar
                targetType="problem"
                targetId={problem.id}
                counts={problem.reactionCounts as Record<string, number>}
                myReactions={problem.myReactions ?? []}
                problemId={problem.id}
              />
              <Button variant="ghost" size="sm" className="text-muted-foreground text-xs" onClick={handleFlag}>
                Flag Issue
              </Button>
            </div>
          </div>

          {/* Desmos Visualizer */}
          <div className="mb-6">
            <DesmosEmbed />
          </div>

          {/* Annotations */}
          <div className="mb-10">
            <AnnotationsPanel problemId={id} />
          </div>

          {/* Solutions */}
          <div className="mb-12">
            <div className="flex items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-serif font-bold">Solutions</h2>
                <Badge variant="secondary" className="font-sans font-normal text-sm">
                  {problem.solutions?.length ?? 0}
                </Badge>
              </div>
              {(problem.solutions?.length ?? 0) >= 2 && (
                <Link href={`/math/problem/${problem.id}/showdown`}>
                  <button
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                    style={{ background: "rgba(139,92,246,0.15)", border: "1.5px solid rgba(139,92,246,0.4)", color: "#c4b5fd" }}
                  >
                    <Swords className="w-3.5 h-3.5" />
                    Solution Showdown ⚡
                  </button>
                </Link>
              )}
            </div>

            {/* Rankings strip — shown when 2+ solutions have votes */}
            <SolutionRankings problemId={problem.id} />

            {problem.solutions && problem.solutions.length > 0 ? (
              <div className="space-y-6">
                {problem.solutions.map((sol: MathSolution, idx: number) => (
                  <SolutionCard key={sol.id} sol={sol} problemId={problem.id} index={idx} problemOwnerId={problem.userId ?? undefined} />
                ))}
              </div>
            ) : (
              <div className="bg-card/30 border border-border border-dashed rounded-xl p-6 sm:p-12 text-center text-muted-foreground">
                <p>No solutions yet. Be the first to solve this!</p>
              </div>
            )}
          </div>

          {/* Submit one solution, or direct the author to the existing editor. */}
          {existingOwnSolution ? (
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-serif text-lg font-bold text-foreground">Your solution is already published</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Each solver gets one solution per problem. Use the pencil on your solution to improve it.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById(`solution-${existingOwnSolution.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className="shrink-0"
                >
                  View my solution
                </Button>
              </div>
            </div>
          ) : (
            <StepSolutionComposer problemId={id} />
          )}
        </main>

        {/* RIGHT: Context panel */}
        <aside className="prob-detail-right">
          <ProblemRightPanel problem={problem} problemId={id} />
        </aside>

      </div>
    </div>
  );
}
