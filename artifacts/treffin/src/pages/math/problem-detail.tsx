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
  useStartEleganceDebate,
  useUpdateMathSolution,
  useDeleteMathSolution,
} from "@workspace/api-client-react";
import type {
  MathSolution,
  MathReactionInputReactionType,
  MathSolutionInputApproach,
} from "@workspace/api-client-react";
import { useParams, Link, useLocation } from "wouter";
import { MathText } from "@/components/math/math-renderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { getMathUserId, getMathUsername } from "@/lib/math-auth";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LatexSymbolPicker } from "@/components/math/latex-symbol-picker";
import { DesmosEmbed } from "@/components/math/desmos-embed";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BookmarkPlus, BookmarkCheck, MessageSquarePlus, ChevronDown, ChevronUp, Swords, Lightbulb, Star, Flag, Pencil, Trash2, Check, X } from "lucide-react";

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
    <div className="border border-border rounded-xl p-5 bg-secondary/10">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-400" />
          Community Difficulty Rating
        </h4>
        {communityDifficulty != null && difficultyVoteCount > 0 && (
          <span className="text-sm font-medium text-foreground/80">
            <span className="text-amber-400 font-bold">{communityDifficulty.toFixed(1)}</span>
            <span className="text-muted-foreground">/5 · {difficultyVoteCount} vote{difficultyVoteCount !== 1 ? "s" : ""}</span>
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 mb-4">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => handleRate(n)}
            disabled={rateDifficulty.isPending}
            className={`w-9 h-9 rounded-lg border text-sm font-bold transition-all ${
              n <= (displayRating ?? 0)
                ? "bg-amber-500/20 border-amber-500/50 text-amber-400 scale-105"
                : "bg-secondary/30 border-border text-muted-foreground hover:border-amber-500/40 hover:text-amber-400/70"
            }`}
          >
            {n}
          </button>
        ))}
        {displayRating && (
          <span className="ml-3 text-sm text-muted-foreground">{labels[displayRating]}</span>
        )}
        {myDifficultyVote && !hovered && (
          <span className="ml-auto text-xs text-primary/70">Your rating: {myDifficultyVote}</span>
        )}
      </div>

      {difficultyVoteCount > 0 && (
        <div className="space-y-1.5">
          {[1, 2, 3, 4, 5].map((n) => {
            const count = difficultyDistribution[String(n)] ?? 0;
            const pct = Math.round((count / maxCount) * 100);
            return (
              <div key={n} className="flex items-center gap-2 text-xs">
                <span className="w-4 text-muted-foreground text-right">{n}</span>
                <div className="flex-1 h-2 bg-secondary/40 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500/60 rounded-full transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-5 text-muted-foreground">{count}</span>
              </div>
            );
          })}
        </div>
      )}

      {difficultyVoteCount === 0 && (
        <p className="text-xs text-muted-foreground text-center py-1">
          No ratings yet — be the first to rate this problem!
        </p>
      )}
    </div>
  );
}

function EleganceDebateButton({ problemId, solutionCount, problemTitle }: { problemId: number; solutionCount: number; problemTitle: string }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const startDebate = useStartEleganceDebate();

  if (solutionCount < 2) return null;

  const handleStart = () => {
    if (!getMathUserId()) {
      toast({ title: "Sign in required", description: "Please sign in to start a debate.", variant: "destructive" });
      return;
    }
    startDebate.mutate(
      { id: problemId },
      {
        onSuccess: (data) => {
          toast({ title: "Debate started!", description: "Taking you to the elegance battle…" });
          navigate(`/debates/${data.debateId}`);
        },
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to start debate";
          toast({ title: "Error", description: msg, variant: "destructive" });
        },
      },
    );
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleStart}
      disabled={startDebate.isPending}
      className="flex items-center gap-2 border-purple-500/30 text-purple-400 hover:border-purple-500/60 hover:bg-purple-500/10 hover:text-purple-300"
    >
      <Swords className="w-4 h-4" />
      {startDebate.isPending ? "Creating…" : "Start Elegance Debate"}
    </Button>
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
    <div className="mb-8 border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 bg-secondary/20 border-b border-border">
        <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
          <span style={{ color: categoryColor ?? "#818cf8" }}>∼</span>
          Related Problems
        </h3>
      </div>
      <div className="divide-y divide-border">
        {related.map((p) => (
          <Link key={p.id} href={`/math/problem/${p.id}`}>
            <div className="px-5 py-3.5 hover:bg-secondary/20 transition-colors cursor-pointer group">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors font-serif truncate">
                    <span>{p.title}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {p.categoryName && (
                      <span className="text-[11px] text-muted-foreground">{p.categoryName}</span>
                    )}
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                      style={{
                        color: DIFF_COLORS[p.difficulty] ?? "#60a5fa",
                        background: `${DIFF_COLORS[p.difficulty] ?? "#60a5fa"}18`,
                      }}
                    >
                      {p.difficulty}
                    </span>
                    {(p.solutionCount ?? 0) > 0 && (
                      <span className="text-[11px] text-muted-foreground">
                        {p.solutionCount} solution{p.solutionCount !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-muted-foreground/40 group-hover:text-primary/60 text-xs">→</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function SolutionCard({ sol, problemId }: { sol: MathSolution; problemId: number }) {
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

  const currentUserId = getMathUserId();
  const isOwner = !!currentUserId && currentUserId === sol.userId;

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
          toast({ title: "Delete failed", description: "Could not delete solution.", variant: "destructive" });
          setShowDeleteConfirm(false);
        },
      },
    );
  };

  return (
    <div className="bg-card/50 border border-border rounded-xl p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="font-medium text-foreground">{sol.userName}</div>
          <span className="text-muted-foreground text-xs">
            {new Date(sol.createdAt).toLocaleDateString()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ApproachBadge approach={sol.approach} />
          {isOwner && !isEditing && (
            <>
              <button
                onClick={() => { setIsEditing(true); setShowDeleteConfirm(false); setEditBody(sol.body); setEditApproach(sol.approach as MathSolutionInputApproach); }}
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
              className={`p-1.5 rounded-lg transition-colors ${
                flagged
                  ? "text-amber-500 bg-amber-500/10"
                  : "text-muted-foreground/40 hover:text-amber-500 hover:bg-amber-500/10"
              }`}
            >
              <Flag className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

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
                <SelectItem key={a} value={a} className="text-xs capitalize">{a}</SelectItem>
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
        <div className="prose prose-invert max-w-none text-foreground mb-6 font-serif">
          <MathText text={sol.body} />
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
  );
}

export default function ProblemDetail() {
  const params = useParams();
  const id = Number(params["id"]);
  const { data: problem, isLoading } = useGetMathProblem(id, {
    query: { enabled: !!id, queryKey: getGetMathProblemQueryKey(id) },
  });

  const [solutionBody, setSolutionBody] = useState("");
  const [approach, setApproach] = useState<MathSolutionInputApproach>("other");

  const submitSolution = useSubmitMathSolution();
  const flagContent = useFlagMathContent();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const insertSymbol = (latex: string) => {
    setSolutionBody((prev) => prev + (prev && !prev.endsWith(" ") ? " " : "") + "$" + latex + "$");
  };

  const handleSubmitSolution = () => {
    if (!solutionBody.trim()) {
      toast({ title: "Solution empty", description: "Enter a solution before submitting.", variant: "destructive" });
      return;
    }
    if (!getMathUserId()) {
      toast({ title: "Sign in required", description: "Please sign in to submit solutions.", variant: "destructive" });
      return;
    }
    submitSolution.mutate(
      { id, data: { body: solutionBody, approach } },
      {
        onSuccess: () => {
          setSolutionBody("");
          setApproach("other");
          toast({ title: "Solution submitted!", description: "Your solution has been posted." });
          queryClient.invalidateQueries({ queryKey: getGetMathProblemQueryKey(id) });
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to submit solution.", variant: "destructive" });
        },
      },
    );
  };

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
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/math" className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
          &larr; Back to Math Hub
        </Link>
        <BookmarkButton problemId={id} />
      </div>

      {/* Problem Card */}
      <div className="bg-card border border-border rounded-xl p-4 sm:p-8 shadow-sm mb-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: problem.categoryColor }} />

        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <span style={{ color: problem.categoryColor }}>{problem.categoryIcon}</span>
                {problem.categoryName}
              </span>
              <span className="text-muted-foreground/30">&bull;</span>
              <span className="text-foreground/80 font-medium">{problem.userName}</span>
            </div>
            <h1 className="text-3xl font-serif font-bold text-foreground">
              <MathText text={problem.title} />
            </h1>
          </div>
          <div className="flex flex-col items-end gap-2">
            <DifficultyBadge difficulty={problem.difficulty} />
            {problem.communityDifficulty != null && (problem.difficultyVoteCount ?? 0) > 0 && (
              <span className="text-xs text-muted-foreground">
                Community: <span className="text-amber-400 font-semibold">{problem.communityDifficulty.toFixed(1)}</span>/5
              </span>
            )}
          </div>
        </div>

        <div className="prose prose-invert prose-p:leading-relaxed max-w-none text-foreground mb-8 text-lg font-serif">
          <MathText text={problem.body} />
        </div>

        {/* Progressive Hints */}
        {problem.hints && problem.hints.length > 0 && (
          <ProgressiveHints hints={problem.hints} />
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

      {/* Community Difficulty Rating */}
      <div className="mb-6">
        <CommunityDifficultyRating
          problemId={id}
          communityDifficulty={problem.communityDifficulty}
          difficultyVoteCount={problem.difficultyVoteCount}
          difficultyDistribution={problem.difficultyDistribution as Record<string, number>}
          myDifficultyVote={problem.myDifficultyVote}
        />
      </div>

      {/* Desmos Visualizer */}
      <div className="mb-6">
        <DesmosEmbed />
      </div>

      {/* Related Problems */}
      <RelatedProblems problemId={id} categoryColor={problem.categoryColor} />

      {/* Annotations */}
      <div className="mb-10">
        <AnnotationsPanel problemId={id} />
      </div>

      {/* Solutions */}
      <div className="mb-12">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <h2 className="text-2xl font-serif font-bold flex items-center gap-3">
            Solutions
            <Badge variant="secondary" className="font-sans font-normal text-sm">
              {problem.solutions?.length ?? 0}
            </Badge>
          </h2>
          <EleganceDebateButton
            problemId={id}
            solutionCount={problem.solutions?.length ?? 0}
            problemTitle={problem.title}
          />
        </div>

        {problem.solutions && problem.solutions.length > 0 ? (
          <div className="space-y-6">
            {problem.solutions.map((sol: MathSolution) => (
              <SolutionCard key={sol.id} sol={sol} problemId={problem.id} />
            ))}
          </div>
        ) : (
          <div className="bg-card/30 border border-border border-dashed rounded-xl p-6 sm:p-12 text-center text-muted-foreground">
            <p>No solutions yet. Be the first to solve this!</p>
          </div>
        )}
      </div>

      {/* Submit solution */}
      <div className="bg-secondary/20 border border-border rounded-xl p-4 sm:p-8">
        <h3 className="text-xl font-serif font-bold mb-6">Submit your solution</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Approach</label>
            <Select value={approach} onValueChange={(v) => setApproach(v as MathSolutionInputApproach)}>
              <SelectTrigger className="w-full md:w-64 bg-background">
                <SelectValue placeholder="Select approach" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="calculus">Calculus</SelectItem>
                <SelectItem value="geometric">Geometric</SelectItem>
                <SelectItem value="algebraic">Algebraic</SelectItem>
                <SelectItem value="proof">Proof</SelectItem>
                <SelectItem value="intuitive">Intuitive</SelectItem>
                <SelectItem value="combinatorial">Combinatorial</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <label className="text-sm font-medium">
                Solution Body <span className="text-muted-foreground font-normal">(LaTeX: <code className="text-xs">$$...$$</code> display, <code className="text-xs">$...$</code> inline)</span>
              </label>
              <LatexSymbolPicker onInsert={insertSymbol} />
            </div>
            <Textarea
              value={solutionBody}
              onChange={(e) => setSolutionBody(e.target.value)}
              placeholder="Let $x$ be..."
              className="min-h-[200px] bg-background font-mono text-sm"
            />
          </div>

          {solutionBody.trim() && (
            <div className="p-4 bg-background border border-border rounded-lg">
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Preview</h4>
              <div className="font-serif prose prose-invert max-w-none">
                <MathText text={solutionBody} />
              </div>
            </div>
          )}

          <div className="pt-2">
            <Button
              onClick={handleSubmitSolution}
              disabled={submitSolution.isPending}
              className="w-full sm:w-auto"
            >
              {submitSolution.isPending ? "Submitting…" : "Submit Solution"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
