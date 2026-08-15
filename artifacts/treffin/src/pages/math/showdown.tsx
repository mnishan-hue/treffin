import {
  useGetMathShowdown,
  getGetMathShowdownQueryKey,
  useVoteMathShowdown,
  useStartEleganceDebate,
  useGetEleganceBattle,
  getGetEleganceBattleQueryKey,
} from "@workspace/api-client-react";
import type { MathShowdownSolution } from "@workspace/api-client-react";
import { useParams, Link, useLocation } from "wouter";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MathText } from "@/components/math/math-renderer";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/lib/auth-client";
import { parseSteps } from "@/pages/math/problem-detail";
import {
  ArrowLeft, Sparkles, Eye, ShieldCheck, Zap, MessageSquare,
  ChevronDown, ChevronUp, ArrowUpDown, EyeOff, Swords,
} from "lucide-react";

type Axis = "elegant" | "clear" | "rigorous" | "efficient";
type SortBy = "default" | "steps" | "votes" | "fastest";

const AXES: { id: Axis; label: string; question: string; icon: typeof Sparkles; color: string }[] = [
  { id: "elegant", label: "Elegant", question: "Which is more elegant?", icon: Sparkles, color: "#a78bfa" },
  { id: "clear", label: "Clearest", question: "Which is easiest to follow?", icon: Eye, color: "#60a5fa" },
  { id: "rigorous", label: "Rigorous", question: "Which is most rigorous?", icon: ShieldCheck, color: "#34d399" },
  { id: "efficient", label: "Efficient", question: "Which is most efficient?", icon: Zap, color: "#fbbf24" },
];

const APPROACH_COLORS: Record<string, string> = {
  calculus: "#60a5fa",
  geometric: "#34d399",
  algebraic: "#a78bfa",
  proof: "#fbbf24",
  intuitive: "#fb7185",
  combinatorial: "#22d3ee",
  other: "#94a3b8",
};

function axisTotal(votes: { elegant: number; clear: number; rigorous: number; efficient: number }) {
  return votes.elegant + votes.clear + votes.rigorous + votes.efficient;
}

function SolutionCard({
  solution,
  myVotes,
  totalsByAxis,
  onVote,
  pending,
  similarCount,
  rank,
  isMostVoted,
  isH2hSelected,
  onH2hToggle,
  h2hFull,
}: {
  solution: MathShowdownSolution;
  myVotes: Record<Axis, number | null>;
  totalsByAxis: Record<Axis, number>;
  onVote: (axis: Axis, solutionId: number) => void;
  pending: boolean;
  similarCount: number;
  rank: number;
  isMostVoted: boolean;
  isH2hSelected: boolean;
  onH2hToggle: () => void;
  h2hFull: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const steps = useMemo(() => parseSteps(solution.body), [solution.body]);
  const color = APPROACH_COLORS[solution.approach] ?? APPROACH_COLORS["other"];
  const previewSteps = steps.slice(0, expanded ? steps.length : 2);

  return (
    <div
      className="rounded-xl border flex flex-col overflow-hidden relative"
      style={{
        borderColor: isMostVoted ? "rgba(251,191,36,0.55)" : "var(--border)",
        background: "var(--card)",
        boxShadow: isMostVoted ? "0 0 0 1px rgba(251,191,36,0.2), 0 4px 16px rgba(251,191,36,0.08)" : undefined,
      }}
    >
      {/* ── #1 Result ribbon — visible when this is the overall top pick ── */}
      {isMostVoted && (
        <div
          className="w-full flex items-center justify-center gap-1 py-1 text-[10px] font-black tracking-wider uppercase"
          style={{ background: "linear-gradient(90deg, rgba(251,191,36,0.25), rgba(251,191,36,0.5), rgba(251,191,36,0.25))", color: "#fbbf24", borderBottom: "1px solid rgba(251,191,36,0.3)" }}
        >
          👑 Community Top Pick
        </div>
      )}
      {/* ── Header ── */}
      <div className="p-4 border-b border-border/60">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {/* Rank badge */}
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0"
              style={rank === 1
                ? { background: "rgba(251,191,36,0.2)", color: "#fbbf24", border: "1.5px solid rgba(251,191,36,0.5)" }
                : rank === 2
                ? { background: "rgba(148,163,184,0.2)", color: "#94a3b8", border: "1.5px solid rgba(148,163,184,0.4)" }
                : { background: "rgba(180,120,80,0.2)", color: "#cd7f32", border: "1.5px solid rgba(180,120,80,0.4)" }
              }
            >
              #{rank}
            </div>
            <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-[11px] font-bold overflow-hidden">
              {solution.userAvatar ? (
                <img src={solution.userAvatar} alt="" className="w-full h-full object-cover" />
              ) : (
                solution.userName.slice(0, 1).toUpperCase()
              )}
            </div>
            <span className="text-[12px] font-semibold">{solution.userName}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {isMostVoted && (
              <span
                className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: "rgba(251,191,36,0.2)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.5)" }}
              >
                👑 Most voted
              </span>
            )}
            {solution.isFastest && (
              <span
                className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.4)" }}
              >
                <Zap className="w-3 h-3" /> Fewest steps
              </span>
            )}
            {solution.solvingTime != null && (
              <span
                className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                style={{ background: "rgba(34,211,238,0.12)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.3)" }}
              >
                ⏱ {solution.solvingTime}m
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" style={{ borderColor: `${color}55`, color }} className="text-[10px] font-medium">
            {solution.approach}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            {solution.stepCount} step{solution.stepCount === 1 ? "" : "s"}
          </span>
          {/* Similar-approach hint */}
          {similarCount > 0 && (
            <span
              className="text-[9px] px-1.5 py-0.5 rounded-full cursor-default"
              style={{
                background: `${color}18`,
                color: `${color}cc`,
                border: `1px solid ${color}33`,
              }}
              title={`${similarCount} other solution${similarCount === 1 ? "" : "s"} use the same approach — different notation, same idea`}
            >
              ≈ {similarCount} similar method{similarCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>

      {/* ── Steps ── */}
      <div className="p-4 flex-1 space-y-3">
        {previewSteps.map((step, i) => (
          <div key={i} className="flex gap-2.5">
            <div
              className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black mt-0.5"
              style={{ background: `${color}22`, color, border: `1.5px solid ${color}44` }}
            >
              {step.label?.match(/\d+/)?.[0] ?? i + 1}
            </div>
            <div className="flex-1 min-w-0">
              {step.label && (
                <div className="text-[9px] font-black uppercase tracking-wider mb-0.5" style={{ color }}>
                  {step.label}
                </div>
              )}
              <div className="text-[13px] font-serif text-foreground/90 leading-relaxed">
                <MathText text={step.content} />
              </div>
            </div>
          </div>
        ))}

        {steps.length > 2 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expanded ? "Show less" : `Show ${steps.length - 2} more step${steps.length - 2 === 1 ? "" : "s"}`}
          </button>
        )}
      </div>

      {/* ── Axis vote bars ── */}
      <div className="p-3 border-t border-border/60 bg-muted/10 space-y-2">
        {AXES.map((axis) => {
          const votesForAxis = solution.votes[axis.id];
          const total = totalsByAxis[axis.id] || 1;
          const pct = Math.round((votesForAxis / total) * 100);
          const isMine = myVotes[axis.id] === solution.id;
          const Icon = axis.icon;
          return (
            <button
              key={axis.id}
              disabled={pending}
              onClick={() => onVote(axis.id, solution.id)}
              className="w-full text-left group disabled:opacity-60"
            >
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span className="flex items-center gap-1 font-medium" style={{ color: isMine ? axis.color : undefined }}>
                  <Icon className="w-3 h-3" style={{ color: axis.color }} />
                  {axis.label}
                  {isMine && <span className="text-[9px]">(your pick)</span>}
                </span>
                <span className="text-muted-foreground">{votesForAxis}</span>
              </div>
              <div className="h-1.5 rounded-full bg-secondary/40 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300 group-hover:opacity-80"
                  style={{ width: `${votesForAxis > 0 ? pct : 0}%`, background: isMine ? axis.color : `${axis.color}77` }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Compare button ── */}
      <div className="border-t border-border/50 px-4 py-2.5 flex items-center justify-between">
        <button
          onClick={onH2hToggle}
          disabled={h2hFull}
          className={`text-[10px] font-bold px-2.5 py-1 rounded-full transition-colors ${
            isH2hSelected
              ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/40"
              : h2hFull
              ? "opacity-30 cursor-not-allowed border border-border text-muted-foreground"
              : "border border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
          }`}
        >
          {isH2hSelected ? "✓ In comparison" : "Compare"}
        </button>
        {isH2hSelected && <span className="text-[9px] text-muted-foreground">Select one more to compare</span>}
      </div>
    </div>
  );
}

const SORT_OPTIONS: { id: SortBy; label: string }[] = [
  { id: "default", label: "Best" },
  { id: "votes", label: "Most voted" },
  { id: "steps", label: "Fewest steps" },
  { id: "fastest", label: "Fastest solve" },
];

export default function MathShowdown() {
  const { id } = useParams<{ id: string }>();
  const problemId = Number(id);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isLoaded: isSessionLoaded } = useSession();
  const showdownQueryKey = [...getGetMathShowdownQueryKey(problemId), user?.id ?? "guest"] as const;

  const { data, isLoading, isError, refetch } = useGetMathShowdown(problemId, {
    query: { queryKey: showdownQueryKey, enabled: !isNaN(problemId) && isSessionLoaded },
  });
  const { data: existingBattle } = useGetEleganceBattle(problemId, {
    query: { queryKey: getGetEleganceBattleQueryKey(problemId), enabled: !isNaN(problemId) },
  });
  const vote = useVoteMathShowdown();
  const startDebate = useStartEleganceDebate();

  // ── Moderator choice state ────────────────────────────────────────
  const [showModChoice, setShowModChoice] = useState(false);
  const [wantsModerator, setWantsModerator] = useState<boolean | null>(null);
  const [winnerAuthority, setWinnerAuthority] = useState<"creator" | "admin">("creator");

  // ── Head-to-head comparison state ────────────────────────────────
  const [h2hSelected, setH2hSelected] = useState<number[]>([]);
  const toggleH2h = (id: number) => {
    setH2hSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 2 ? [...prev, id] : prev
    );
  };

  // ── Filter & sort state ───────────────────────────────────────────
  const [approachFilter, setApproachFilter] = useState<string | null>(null);
  const [hiddenApproaches, setHiddenApproaches] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortBy>("default");

  const toggleHide = (approach: string) => {
    setHiddenApproaches((prev) => {
      const next = new Set(prev);
      if (next.has(approach)) {
        next.delete(approach);
      } else {
        next.add(approach);
        // clear the "show only" filter if we're hiding the active one
        if (approachFilter === approach) setApproachFilter(null);
      }
      return next;
    });
  };

  const handleVote = (axis: Axis, solutionId: number) => {
    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in to vote.", variant: "destructive" });
      return;
    }
    vote.mutate(
      { id: problemId, data: { axis, solutionId } },
      {
        onSuccess: (updated) => {
          queryClient.setQueryData(showdownQueryKey, updated);
        },
        onError: (error: unknown) => {
          const message = (error as { data?: { error?: string } })?.data?.error ?? "Failed to record your vote.";
          toast({ title: "Vote not recorded", description: message, variant: "destructive" });
        },
      },
    );
  };

  const handleDiscuss = () => {
    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in to discuss.", variant: "destructive" });
      return;
    }
    setWantsModerator(null);
    setWinnerAuthority("creator");
    setShowModChoice(true);
  };

  const handleStartEleganceDebate = () => {
    if ((data?.solutions?.length ?? 0) < 2) {
      toast({
        title: "Not enough solutions yet",
        description: "At least 2 submitted solutions are needed to open an Elegance Battle.",
        variant: "destructive",
      });
      return;
    }
    if (startDebate.isPending) return;
    const isMod = wantsModerator === true;
    startDebate.mutate(
      { id: problemId, data: {
          creatorIsModerator: isMod,
          winnerAuthority: isMod ? winnerAuthority : "admin",
      }},
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetEleganceBattleQueryKey(problemId) });
          setShowModChoice(false);
          navigate(`/math/problem/${problemId}/elegance-battle`);
        },
        onError: (err: unknown) => {
          const msg =
            (err as { data?: { error?: string } })?.data?.error ??
            "Failed to open discussion.";
          toast({ title: "Cannot open battle", description: msg, variant: "destructive" });
        },
      },
    );
  };

  if (isError) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-2xl text-center space-y-4">
        <Swords className="w-10 h-10 mx-auto text-muted-foreground/40" />
        <p className="font-semibold">Could not load this solution showdown.</p>
        <p className="text-sm text-muted-foreground">Check your connection and try again.</p>
        <button className="px-4 py-2 rounded-lg border border-border" onClick={() => refetch()}>Try again</button>
      </div>
    );
  }
  if (isLoading || !data) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl space-y-5">
        <Skeleton className="h-5 w-32 rounded-lg" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="flex gap-2">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-8 w-24 rounded-full" />)}
        </div>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-80 w-full rounded-xl" />)}
        </div>
      </div>
    );
  }

  // ── Derived ───────────────────────────────────────────────────────
  const approaches = Array.from(new Set(data.solutions.map((s) => s.approach)));

  // How many solutions share each approach (for the "similar method" hint)
  const approachGroupSize: Record<string, number> = {};
  for (const s of data.solutions) {
    approachGroupSize[s.approach] = (approachGroupSize[s.approach] ?? 0) + 1;
  }

  // Apply approach filter + hidden-approach exclusions
  let visibleSolutions = data.solutions.filter((s) => {
    if (hiddenApproaches.has(s.approach)) return false;
    if (approachFilter && s.approach !== approachFilter) return false;
    return true;
  });

  // Apply sort
  if (sortBy === "steps") {
    visibleSolutions = [...visibleSolutions].sort((a, b) => a.stepCount - b.stepCount);
  } else if (sortBy === "votes") {
    visibleSolutions = [...visibleSolutions].sort((a, b) => axisTotal(b.votes) - axisTotal(a.votes));
  } else if (sortBy === "fastest") {
    visibleSolutions = [...visibleSolutions].sort((a, b) => {
      const at = a.solvingTime ?? Infinity;
      const bt = b.solvingTime ?? Infinity;
      return at - bt;
    });
  }

  // Rank by composite total votes (used for rank badge on each card)
  const rankedIds = [...data.solutions]
    .sort((a, b) => axisTotal(b.votes) - axisTotal(a.votes))
    .map((s) => s.id);
  const rankMap = new Map(rankedIds.map((id, i) => [id, i + 1]));

  const totalsByAxis: Record<Axis, number> = {
    elegant: Math.max(1, ...data.solutions.map((s) => s.votes.elegant)),
    clear: Math.max(1, ...data.solutions.map((s) => s.votes.clear)),
    rigorous: Math.max(1, ...data.solutions.map((s) => s.votes.rigorous)),
    efficient: Math.max(1, ...data.solutions.map((s) => s.votes.efficient)),
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Link
        href={`/math/problem/${problemId}`}
        className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Problem
      </Link>

      {/* ── Hero ── */}
      <div
        className="mb-6 rounded-2xl border overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.06) 50%, rgba(59,130,246,0.05) 100%)",
          borderColor: "rgba(99,102,241,0.25)",
          position: "relative",
        }}
      >
        {/* Top accent bar */}
        <div style={{ height: 3, background: "linear-gradient(to right, #6366f1, #8b5cf6, #3b82f6)", flexShrink: 0 }} />
        <div className="p-5 md:p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-2">
              <div
                className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded-full"
                style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)", color: "#a5b4fc" }}
              >
                <Swords className="w-3.5 h-3.5" /> Solution Showdown
              </div>
              <h1 className="text-lg md:text-xl font-bold text-foreground leading-snug">
                <MathText text={data.problemTitle} />
              </h1>
              <p className="text-[12px] text-muted-foreground leading-relaxed max-w-2xl">
                Compare every solution side by side. Vote for the most elegant, rigorous, clear, and efficient approach — then challenge the community in the Elegance Battle.
              </p>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              {[
                { label: "Solutions", value: data.solutions.length },
                { label: "Voters", value: data.solutions.reduce((s, sol) => s + axisTotal(sol.votes), 0) },
              ].map(({ label, value }) => (
                <div key={label} className="text-center">
                  <div className="text-xl font-black text-white">{value}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Controls: filter · hide · sort ──────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {approaches.length > 1 && (
          <>
            {/* "All" pill */}
            <button
              onClick={() => { setApproachFilter(null); setHiddenApproaches(new Set()); }}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                !approachFilter && hiddenApproaches.size === 0
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/30"
              }`}
            >
              All approaches
            </button>

            {/* Per-approach: show-only button + hide eye icon */}
            {approaches.map((a) => {
              const color = APPROACH_COLORS[a] ?? APPROACH_COLORS["other"];
              const isHidden = hiddenApproaches.has(a);
              const isActive = approachFilter === a && !isHidden;
              return (
                <span
                  key={a}
                  className="inline-flex items-center rounded-full border overflow-hidden transition-colors"
                  style={{
                    borderColor: isHidden
                      ? "var(--border)"
                      : isActive
                      ? `${color}55`
                      : "var(--border)",
                  }}
                >
                  {/* Approach label — click to show only this */}
                  <button
                    disabled={isHidden}
                    onClick={() => setApproachFilter(isActive ? null : a)}
                    className="text-[11px] px-2.5 py-1 transition-colors"
                    style={{
                      color: isHidden ? "var(--muted-foreground)" : isActive ? color : undefined,
                      background: isActive ? `${color}18` : undefined,
                      opacity: isHidden ? 0.45 : 1,
                      textDecoration: isHidden ? "line-through" : undefined,
                    }}
                  >
                    {a}
                  </button>
                  {/* Eye-off toggle — click to hide/unhide this approach */}
                  <button
                    onClick={() => toggleHide(a)}
                    className="pr-1.5 pl-0.5 py-1 transition-colors hover:text-foreground"
                    title={isHidden ? `Show ${a} solutions` : `Hide ${a} solutions`}
                  >
                    <EyeOff
                      className="w-2.5 h-2.5"
                      style={{
                        color: isHidden ? "#fb7185" : "var(--muted-foreground)",
                        opacity: isHidden ? 1 : 0.5,
                      }}
                    />
                  </button>
                </span>
              );
            })}
          </>
        )}

        <span className="flex-1" />

        {/* Sort controls */}
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground pr-1">
          <ArrowUpDown className="w-3 h-3" /> Sort:
        </span>
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            onClick={() => setSortBy(opt.id)}
            className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
              sortBy === opt.id
                ? "bg-primary/10 border-primary/30 text-primary"
                : "border-border text-muted-foreground hover:border-primary/30"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Hidden-approaches notice */}
      {hiddenApproaches.size > 0 && (
        <div className="flex items-center gap-1.5 mb-3 text-[11px] text-muted-foreground">
          <EyeOff className="w-3 h-3 text-rose-400" />
          Hiding:{" "}
          {Array.from(hiddenApproaches).map((a, i) => (
            <span key={a}>
              {i > 0 && ", "}
              <span style={{ color: APPROACH_COLORS[a] ?? "#94a3b8" }}>{a}</span>
            </span>
          ))}
          <button
            onClick={() => setHiddenApproaches(new Set())}
            className="ml-1 underline hover:text-foreground"
          >
            show all
          </button>
        </div>
      )}

      {/* ── Head-to-head comparison panel ───────────────────────────── */}
      {h2hSelected.length === 2 && (() => {
        const [aId, bId] = h2hSelected;
        const solA = data.solutions.find(s => s.id === aId);
        const solB = data.solutions.find(s => s.id === bId);
        if (!solA || !solB) return null;
        const colorA = APPROACH_COLORS[solA.approach] ?? APPROACH_COLORS["other"];
        const colorB = APPROACH_COLORS[solB.approach] ?? APPROACH_COLORS["other"];
        return (
          <div className="mb-6 rounded-xl border border-indigo-500/30 overflow-hidden" style={{ background: "rgba(99,102,241,0.04)" }}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-indigo-500/20 bg-indigo-500/10">
              <span className="text-[11px] font-black uppercase tracking-widest text-indigo-400">⚔ Head-to-head</span>
              <button onClick={() => setH2hSelected([])} className="text-[10px] text-muted-foreground hover:text-foreground">Clear</button>
            </div>
            <div className="grid md:grid-cols-2 divide-x divide-border/50">
              {[{ sol: solA, color: colorA, label: "A" }, { sol: solB, color: colorB, label: "B" }].map(({ sol, color, label }) => (
                <div key={sol.id} className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black" style={{ background: `${color}25`, color, border: `1.5px solid ${color}55` }}>{label}</div>
                    <span className="text-[12px] font-semibold">{sol.userName}</span>
                    <Badge variant="outline" style={{ borderColor: `${color}55`, color }} className="text-[10px] ml-auto">{sol.approach}</Badge>
                  </div>
                  <div className="space-y-2">
                    {AXES.map(axis => {
                      const Icon = axis.icon;
                      const myPick = data.myVotes[axis.id] === sol.id;
                      return (
                        <div key={axis.id} className="flex items-center gap-2">
                          <Icon className="w-3 h-3 shrink-0" style={{ color: axis.color }} />
                          <span className="text-[10px] text-muted-foreground w-16">{axis.label}</span>
                          <div className="flex-1 h-1.5 rounded-full bg-secondary/40 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${Math.round((sol.votes[axis.id] / Math.max(1, totalsByAxis[axis.id])) * 100)}%`, background: myPick ? axis.color : `${axis.color}66` }} />
                          </div>
                          <span className="text-[10px] text-muted-foreground w-6 text-right">{sol.votes[axis.id]}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 pt-3 border-t border-border/40">
                    <span className="text-[10px] text-muted-foreground">{sol.stepCount} step{sol.stepCount === 1 ? "" : "s"}</span>
                    {sol.isFastest && <span className="ml-2 text-[10px] text-yellow-400">⚡ Fewest steps</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Solution grid ────────────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
        {visibleSolutions.map((s) => (
          <SolutionCard
            key={s.id}
            solution={s}
            myVotes={data.myVotes}
            totalsByAxis={totalsByAxis}
            onVote={handleVote}
            pending={vote.isPending}
            similarCount={(approachGroupSize[s.approach] ?? 1) - 1}
            rank={rankMap.get(s.id) ?? visibleSolutions.indexOf(s) + 1}
            isMostVoted={rankedIds[0] === s.id}
            isH2hSelected={h2hSelected.includes(s.id)}
            onH2hToggle={() => toggleH2h(s.id)}
            h2hFull={h2hSelected.length === 2 && !h2hSelected.includes(s.id)}
          />
        ))}
        {visibleSolutions.length === 0 && (
          <div className="col-span-full py-12 text-center text-[13px] text-muted-foreground">
            No solutions match the current filters.{" "}
            <button
              onClick={() => { setApproachFilter(null); setHiddenApproaches(new Set()); }}
              className="underline text-primary hover:opacity-80"
            >
              Reset filters
            </button>
          </div>
        )}
      </div>

      {/* ── Discuss / Battle CTA ─────────────────────────────────────── */}
      <div
        className="rounded-xl border p-4 flex items-center justify-between gap-4"
        style={{ background: "rgba(99,102,241,0.05)", borderColor: existingBattle ? "rgba(99,102,241,0.35)" : "rgba(99,102,241,0.2)" }}
      >
        <div>
          {existingBattle ? (
            <>
              <div className="text-[13px] font-bold mb-0.5 flex items-center gap-1.5">
                <span>⚔</span>
                {existingBattle.isEnded ? "Battle concluded" : "Elegance Battle is live"}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {existingBattle.isEnded
                  ? "The debate room is archived — see who the community crowned."
                  : "A debate room is already open for this problem. Jump in and argue your case."}
              </p>
            </>
          ) : (
            <>
              <div className="text-[13px] font-bold mb-0.5">Think there's a gap in someone's proof?</div>
              <p className="text-[11px] text-muted-foreground">
                Open a debate room to argue which approach is most elegant, clear, or rigorous.
              </p>
            </>
          )}
        </div>
        {existingBattle ? (
          <Link
            href={`/math/problem/${problemId}/elegance-battle`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-bold whitespace-nowrap"
            style={{
              background: existingBattle.isEnded ? "rgba(148,163,184,0.12)" : "rgba(99,102,241,0.18)",
              border: `1.5px solid ${existingBattle.isEnded ? "rgba(148,163,184,0.35)" : "rgba(99,102,241,0.5)"}`,
              color: existingBattle.isEnded ? "#94a3b8" : "#a5b4fc",
            }}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            {existingBattle.isEnded ? "View Archive →" : "View Battle →"}
          </Link>
        ) : (
          <button
            onClick={handleDiscuss}
            disabled={startDebate.isPending}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-bold whitespace-nowrap"
            style={{ background: "rgba(99,102,241,0.15)", border: "1.5px solid rgba(99,102,241,0.4)", color: "#a5b4fc" }}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            {startDebate.isPending ? "Opening…" : "Start Battle ⚔"}
          </button>
        )}
      </div>

      {/* ── Elegance Battle Moderator Choice Modal ────────────────── */}
      {showModChoice && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 overflow-y-auto flex items-center justify-center p-4" onClick={() => setShowModChoice(false)}>
          <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto shadow-2xl flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">⚔</span>
                <h3 className="font-bold text-base text-foreground">Open Elegance Discussion</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                This creates a debate room where participants can argue which solution approach is best. As the opener, choose how you want to run it.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              {[
                { val: true, label: "🛡 I'll moderate the discussion", sub: "You keep order — pin arguments, remove off-topic replies, and end early. You won't be able to vote or argue." },
                { val: false, label: "⚡ I want to participate", sub: "You join as a regular participant. Admin handles the outcome." },
              ].map(({ val, label, sub }) => (
                <button
                  key={String(val)}
                  onClick={() => setWantsModerator(val)}
                  className={`text-left p-3.5 rounded-xl border transition-all ${wantsModerator === val ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`}
                >
                  <p className="text-sm font-semibold text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
                </button>
              ))}
            </div>

            {wantsModerator === true && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Who declares the winning approach?</label>
                <div className="flex gap-2">
                  {[
                    { val: "creator" as const, label: "I decide", sub: "You declare the outcome yourself." },
                    { val: "admin" as const, label: "Treffin admin", sub: "Goes to admin for review." },
                  ].map(({ val, label, sub }) => (
                    <button key={val} onClick={() => setWinnerAuthority(val)} className={`flex-1 p-3 rounded-xl border text-left transition-all ${winnerAuthority === val ? "border-primary bg-primary/10" : "border-border hover:border-primary/30"}`}>
                      <p className="text-xs font-semibold text-foreground">{label}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setShowModChoice(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-colors">Cancel</button>
              <button
                onClick={handleStartEleganceDebate}
                disabled={wantsModerator === null || startDebate.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
                style={{ background: "rgba(99,102,241,0.2)", border: "1.5px solid rgba(99,102,241,0.5)", color: "#a5b4fc" }}
              >
                {startDebate.isPending ? "Opening…" : "Open Discussion →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
