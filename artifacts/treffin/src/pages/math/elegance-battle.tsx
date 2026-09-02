import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getEleganceBattleFull,
  postEleganceBattleArgument,
  voteEleganceBattleArgument,
  concludeEleganceBattle,
  voteMathShowdown,
  voteEleganceBattleStep,
  type EleganceBattleArgumentVoteResult,
  type MathBattleArgument,
  type MathBattleFullResponse,
  type MathBattleSolution,
} from "@workspace/api-client-react";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, ChevronUp, ChevronDown, MessageSquare, Trophy,
  Zap, X, Send, Crown, CheckCircle, Flame, Sparkles,
  Target, Users, Shield, TrendingUp, Star, Award, Swords,
  BarChart3, BookOpen, ChevronRight, Gem, Eye, Gauge,
  type LucideIcon,
} from "lucide-react";
import { parseSteps } from "./problem-detail";
import { motion, AnimatePresence } from "framer-motion";

// ── constants ─────────────────────────────────────────────────────────────────

const AXIS_META = [
  { key: "elegant",   label: "Elegant",   Icon: Gem,    color: "#a855f7", bg: "rgba(168,85,247,0.12)", border: "rgba(168,85,247,0.35)" },
  { key: "rigorous",  label: "Rigorous",  Icon: Shield, color: "#3b82f6", bg: "rgba(59,130,246,0.12)",  border: "rgba(59,130,246,0.35)"  },
  { key: "clear",     label: "Clear",      Icon: Eye,    color: "#10b981", bg: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.35)"  },
  { key: "efficient", label: "Efficient",  Icon: Gauge,  color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.35)"  },
] as const;

type AxisKey = "elegant" | "rigorous" | "clear" | "efficient";

const APPROACH_PALETTE: Record<string, { border: string; text: string }> = {
  algebraic:     { border: "border-blue-500/30",    text: "text-blue-600 dark:text-blue-300" },
  geometric:     { border: "border-purple-500/30",  text: "text-purple-600 dark:text-purple-300" },
  combinatorial: { border: "border-amber-500/30",   text: "text-amber-600 dark:text-amber-300" },
  calculus:      { border: "border-emerald-500/30", text: "text-emerald-600 dark:text-emerald-300" },
};
const fallbackPalette = APPROACH_PALETTE.algebraic;
function palette(approach: string) {
  return APPROACH_PALETTE[approach.toLowerCase()] ?? fallbackPalette;
}

function dnaColor(approach: string) {
  const map: Record<string, string> = {
    algebraic: "#3b82f6", geometric: "#a855f7", combinatorial: "#f59e0b", calculus: "#10b981",
  };
  return map[approach.toLowerCase()] ?? "#818cf8";
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function totalVotes(sol: MathBattleSolution) {
  return sol.votes.elegant + sol.votes.rigorous + sol.votes.clear + sol.votes.efficient;
}

// ── Floating reaction burst ────────────────────────────────────────────────────
// ── Live score bar ─────────────────────────────────────────────────────────────
function ScoreBar({ solA, solB }: { solA: MathBattleSolution; solB: MathBattleSolution }) {
  const a = totalVotes(solA);
  const b = totalVotes(solB);
  const total = a + b || 1;
  const pA = Math.round((a / total) * 100);
  const pB = 100 - pA;
  const palA = palette(solA.approach);
  const palB = palette(solB.approach);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 text-sm font-bold">
        <span className={cn("truncate", palA.text)}>{solA.approach.charAt(0).toUpperCase() + solA.approach.slice(1)}</span>
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Community score</span>
        <span className={cn("truncate text-right", palB.text)}>{solB.approach.charAt(0).toUpperCase() + solB.approach.slice(1)}</span>
      </div>

      <div className="relative h-2.5 overflow-hidden rounded-full border border-border/70 bg-secondary">
        <motion.div
          className="absolute left-0 top-0 h-full rounded-l-full"
          style={{ background: `linear-gradient(to right, ${dnaColor(solA.approach)}, ${dnaColor(solA.approach)}cc)` }}
          animate={{ width: `${pA}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
        <motion.div
          className="absolute right-0 top-0 h-full rounded-r-full"
          style={{ background: `linear-gradient(to left, ${dnaColor(solB.approach)}, ${dnaColor(solB.approach)}cc)` }}
          animate={{ width: `${pB}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
        {/* Centre divider */}
        <div className="absolute inset-y-0 left-1/2 z-10 w-px -translate-x-1/2 bg-background/80" />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{pA}% · {a} pts</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">versus</span>
        <span>{pB}% · {b} pts</span>
      </div>
    </div>
  );
}

// ── DNA Radar ─────────────────────────────────────────────────────────────────
function SolutionDNA({ sol }: { sol: MathBattleSolution; compact?: boolean }) {
  const color = dnaColor(sol.approach);
  const max = Math.max(...AXIS_META.map(({ key }) => sol.votes[key as AxisKey] ?? 0), 1);

  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-3 rounded-2xl border border-border/70 bg-background/45 p-4">
      {AXIS_META.map(({ key, label, Icon }) => {
        const value = sol.votes[key as AxisKey] ?? 0;
        return (
          <div key={key} className="min-w-0">
            <div className="mb-1.5 flex items-center justify-between gap-2 text-[10px]">
              <span className="flex items-center gap-1.5 font-semibold text-muted-foreground"><Icon className="h-3 w-3" /> {label}</span>
              <span className="font-bold tabular-nums text-foreground/75">{value}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${value === 0 ? 0 : Math.max(12, (value / max) * 100)}%`, background: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function apiErrorMessage(error: unknown, fallback: string) {
  return (error as { data?: { error?: string }; message?: string })?.data?.error
    ?? (error as { message?: string })?.message
    ?? fallback;
}

// ── Axis vote tile ─────────────────────────────────────────────────────────────
function AxisVoteTile({
  axisKey, Icon, label, color, bg, border,
  count, isMine, canVote, onVote, isPending,
}: {
  axisKey: AxisKey; Icon: LucideIcon; label: string; color: string; bg: string; border: string;
  count: number; isMine: boolean; canVote: boolean; onVote: () => void; isPending: boolean;
}) {
  return (
    <motion.button
      onClick={canVote ? onVote : undefined}
      disabled={!canVote || isPending}
      whileTap={canVote ? { scale: 0.93 } : undefined}
      style={{
        background: isMine ? bg : "color-mix(in srgb, var(--color-background) 72%, transparent)",
        border: `1px solid ${isMine ? border : "var(--color-border)"}`,
        boxShadow: isMine ? `0 8px 28px ${bg}` : "none",
      }}
      className={cn(
        "flex min-w-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-all",
        canVote && !isMine && "hover:-translate-y-0.5 hover:bg-secondary",
        isMine && "ring-1",
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ color, background: bg }}><Icon className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-bold text-foreground">{label}</span>
        <span className="block text-[9px] text-muted-foreground">{isMine ? "Your choice" : canVote ? "Select solution" : "Community votes"}</span>
      </span>
      <span className="text-sm font-black tabular-nums" style={{ color: isMine ? color : "var(--color-foreground)" }}>{count}</span>
    </motion.button>
  );
}

// ── Step card ─────────────────────────────────────────────────────────────────
function StepCard({
  step, stepIndex, soundness, argCount, isActive, onJustify, canVote, isPending, onVote,
}: {
  step: { label: string | null; content: string };
  stepIndex: number;
  soundness: { up: number; down: number; myVote?: "sound" | "unsound" | null };
  argCount: number;
  isActive: boolean;
  onJustify: () => void;
  canVote: boolean;
  isPending: boolean;
  onVote: (vote: "sound" | "unsound") => void;
}) {
  const voteCount = soundness.up + soundness.down;
  const hasSoundnessVotes = voteCount > 0;
  const total = voteCount || 1;
  const health = soundness.up / total;
  const hColor = !hasSoundnessVotes ? "#64748b" : health > 0.65 ? "#10b981" : health > 0.38 ? "#f59e0b" : "#ef4444";
  const hBg = !hasSoundnessVotes ? "rgba(100,116,139,0.1)" : health > 0.65 ? "rgba(16,185,129,0.12)" : health > 0.38 ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.1)";
  const hBorder = !hasSoundnessVotes ? "rgba(100,116,139,0.25)" : health > 0.65 ? "rgba(16,185,129,0.3)" : health > 0.38 ? "rgba(245,158,11,0.3)" : "rgba(239,68,68,0.25)";

  return (
    <div
      style={{ borderLeftColor: hColor }}
      className={cn(
        "rounded-xl border border-l-2 p-3 transition-all cursor-default",
        isActive ? "border-primary/40 bg-primary/5" : "border-border/60 bg-card hover:bg-muted/60",
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          className="shrink-0 mt-0.5 text-[9px] font-black px-1.5 py-0.5 rounded-md border"
          style={{ borderColor: hBorder, color: hColor, background: hBg }}
        >
          {step.label ?? `S${stepIndex + 1}`}
        </span>
        <p className="flex-1 text-sm text-foreground/80 leading-relaxed">{step.content}</p>
      </div>

      <div className="flex items-center gap-3 mt-2.5 pl-9">
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Community step assessment">
          <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${health * 100}%`, background: hColor }} />
          </div>
          <button
            type="button"
            aria-label={`Mark step ${stepIndex + 1} as sound`}
            aria-pressed={soundness.myVote === "sound"}
            disabled={!canVote || isPending}
            onClick={() => onVote("sound")}
            className={cn(
              "rounded-md px-1.5 py-1 text-[10px] font-semibold transition-colors disabled:cursor-not-allowed",
              soundness.myVote === "sound" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" : "text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-600 disabled:hover:bg-transparent",
            )}
          >
            Sound {soundness.up}
          </button>
          <button
            type="button"
            aria-label={`Mark step ${stepIndex + 1} as needing review`}
            aria-pressed={soundness.myVote === "unsound"}
            disabled={!canVote || isPending}
            onClick={() => onVote("unsound")}
            className={cn(
              "rounded-md px-1.5 py-1 text-[10px] transition-colors disabled:cursor-not-allowed",
              soundness.myVote === "unsound" ? "bg-red-500/15 text-red-600 dark:text-red-300" : "text-muted-foreground hover:bg-red-500/10 hover:text-red-600 disabled:hover:bg-transparent",
            )}
          >
            Review {soundness.down}
          </button>
        </div>
        <button
          onClick={onJustify}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
        >
          <MessageSquare className="w-3 h-3" />
          <span>{argCount} {argCount === 1 ? "note" : "notes"}</span>
          {argCount === 0 && <span className="text-primary/50">· annotate</span>}
        </button>
      </div>
    </div>
  );
}

// ── Argument card ─────────────────────────────────────────────────────────────
function ArgumentCard({
  arg, problemId, viewerId, queryKey, depth = 0,
}: {
  arg: MathBattleArgument;
  problemId: number;
  viewerId: string | null;
  queryKey: unknown[];
  depth?: number;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState("");


  const voteMut = useMutation({
    mutationFn: (vote: "up" | "down") => voteEleganceBattleArgument(problemId, arg.id, { vote }),
    onSuccess: (result: EleganceBattleArgumentVoteResult) => {
      queryClient.setQueryData(queryKey, (old: MathBattleFullResponse | undefined) => {
        if (!old) return old;
        function patch(list: MathBattleArgument[]): MathBattleArgument[] {
          return list.map(a => {
            if (a.id === arg.id) return { ...a, upvotes: result.upvotes, downvotes: result.downvotes, myVote: result.myVote };
            return { ...a, replies: patch(a.replies ?? []) };
          });
        }
        return { ...old, arguments: patch(old.arguments) };
      });
    },
    onError: (error) => toast({ title: apiErrorMessage(error, "Failed to vote"), variant: "destructive" }),
  });

  const replyMut = useMutation({
    mutationFn: () => postEleganceBattleArgument(problemId, {
      solutionId: arg.solutionId, stepIndex: arg.stepIndex, content: replyText.trim(), parentId: arg.id,
    }),
    onSuccess: (newArg) => {
      queryClient.setQueryData(queryKey, (old: MathBattleFullResponse | undefined) => {
        if (!old) return old;
        function addReply(list: MathBattleArgument[]): MathBattleArgument[] {
          return list.map(a => {
            if (a.id === arg.id) return { ...a, replies: [...(a.replies ?? []), newArg] };
            return { ...a, replies: addReply(a.replies ?? []) };
          });
        }
        return { ...old, arguments: addReply(old.arguments) };
      });
      setReplyText(""); setShowReply(false);
    },
    onError: (error) => toast({ title: apiErrorMessage(error, "Failed to post reply"), variant: "destructive" }),
  });

  const net = arg.upvotes - arg.downvotes;

  return (
    <div className={cn("space-y-2", depth > 0 && "pl-2 sm:pl-4 border-l border-border/60")}>
      <div className="flex gap-2.5 group">
        {/* Vote column */}
        <div className="flex flex-col items-center gap-0.5 pt-1 shrink-0">
          <button
            type="button"
            aria-label={`Upvote ${arg.userName ?? "anonymous"}'s annotation`}
            onClick={() => viewerId && voteMut.mutate("up")}
            disabled={!viewerId || voteMut.isPending}
            className={cn(
              "p-0.5 rounded transition-colors",
              arg.myVote === "up" ? "text-indigo-400" : "text-muted-foreground hover:text-indigo-400",
            )}
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <span className={cn("text-xs font-bold tabular-nums leading-none", net > 0 ? "text-indigo-400" : net < 0 ? "text-red-400" : "text-muted-foreground")}>
            {net}
          </span>
          <button
            type="button"
            aria-label={`Downvote ${arg.userName ?? "anonymous"}'s annotation`}
            onClick={() => viewerId && voteMut.mutate("down")}
            disabled={!viewerId || voteMut.isPending}
            className={cn(
              "p-0.5 rounded transition-colors",
              arg.myVote === "down" ? "text-red-400" : "text-muted-foreground hover:text-red-400",
            )}
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="rounded-xl bg-muted/60 border border-border/60 px-3 py-2.5 group-hover:border-border transition-colors">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-indigo-500/30 bg-indigo-500/10 text-[9px] font-black text-indigo-500 dark:text-indigo-300">
                {(arg.userName ?? "?").charAt(0).toUpperCase()}
              </span>
              <span className="text-[11px] font-semibold text-foreground/70">{arg.userName ?? "Anonymous"}</span>
              {(arg as MathBattleArgument & { createdAt?: string }).createdAt && <span className="text-[10px] text-muted-foreground ml-auto">{timeAgo((arg as MathBattleArgument & { createdAt?: string }).createdAt!)}</span>}
            </div>
            <p className="text-sm text-foreground/85 leading-relaxed">{arg.content}</p>
          </div>
          {viewerId && (
            <button
              onClick={() => setShowReply(v => !v)}
              className="text-[11px] text-muted-foreground hover:text-primary mt-1 ml-1 transition-colors"
            >
              ↩ Reply
            </button>
          )}
        </div>
      </div>

      {showReply && viewerId && (
        <div className="ml-8 flex gap-2">
          <Textarea
            rows={2}
            maxLength={4000}
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            placeholder="Write a reply…"
            className="text-sm resize-none flex-1 bg-muted/60 border-border focus:border-indigo-500/50"
          />
          <Button size="sm" onClick={() => replyMut.mutate()} disabled={!replyText.trim() || replyMut.isPending}>
            <Send className="w-3 h-3" />
          </Button>
        </div>
      )}

      {(arg.replies ?? []).length > 0 && (
        <div className="space-y-2">
          {(arg.replies ?? []).map(r => (
            <ArgumentCard key={r.id} arg={r} problemId={problemId} viewerId={viewerId} queryKey={queryKey} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Justification panel ───────────────────────────────────────────────────────
function JustificationPanel({
  solutionId, stepIndex, stepLabel, args, problemId, onClose, viewerId, queryKey,
}: {
  solutionId: number; stepIndex: number; stepLabel: string;
  args: MathBattleArgument[]; problemId: number; onClose: () => void;
  viewerId: string | null; queryKey: unknown[];
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");

  const filtered = args.filter(a => a.solutionId === solutionId && a.stepIndex === stepIndex && !a.parentId);

  const postMut = useMutation({
    mutationFn: () => postEleganceBattleArgument(problemId, { solutionId, stepIndex, content: draft.trim() }),
    onSuccess: (newArg) => {
      queryClient.setQueryData(queryKey, (old: MathBattleFullResponse | undefined) => {
        if (!old) return old;
        return { ...old, arguments: [...old.arguments, newArg] };
      });
      setDraft("");
    },
    onError: (error) => toast({ title: apiErrorMessage(error, "Failed to post"), variant: "destructive" }),
  });

  return (
    <div className="flex flex-col h-full bg-card border-l border-border/60">
      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3.5 border-b border-border/60 gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Step Analysis</p>
          <p className="text-sm font-semibold mt-0.5 truncate">{stepLabel}</p>
        </div>
        <button
          type="button"
          aria-label="Close step analysis"
          onClick={onClose}
          className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Note count */}
      <div className="px-4 pt-3 pb-1">
        <span className="text-xs text-muted-foreground">
          {filtered.length === 0 ? "No annotations yet" : `${filtered.length} annotation${filtered.length === 1 ? "" : "s"}`}
        </span>
      </div>

      {/* Notes */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {filtered.length === 0 ? (
          <div className="text-center pt-8 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-muted/60 border border-border flex items-center justify-center mx-auto">
              <BookOpen className="w-5 h-5 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">No annotations yet.</p>
            <p className="text-xs text-muted-foreground/60">Is this step sound? Annotate your reasoning.</p>
          </div>
        ) : (
          filtered.map(a => (
            <ArgumentCard key={a.id} arg={a} problemId={problemId} viewerId={viewerId} queryKey={queryKey} />
          ))
        )}
      </div>

      {/* Compose */}
      {viewerId ? (
        <div className="px-4 py-4 border-t border-border/60 space-y-2.5">
          <Textarea
            rows={3}
            maxLength={4000}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Is this step valid? Annotate your take…"
            className="text-sm resize-none bg-muted/60 border-border focus:border-indigo-500/40"
          />
          <Button
            className="w-full bg-indigo-600 hover:bg-indigo-500"
            size="sm"
            onClick={() => postMut.mutate()}
            disabled={!draft.trim() || postMut.isPending}
          >
            <Send className="w-3.5 h-3.5 mr-2" /> Post Annotation
          </Button>
        </div>
      ) : (
        <p className="px-4 py-4 text-xs text-muted-foreground text-center border-t border-border/60">
          Sign in to annotate steps.
        </p>
      )}
    </div>
  );
}

// ── Solution card ─────────────────────────────────────────────────────────────
function SolutionCard({
  sol, args, problemId, viewerId, queryKey,
  activePanel, onOpenPanel, myAxisVotes, onAxisVote, onStepVote, rank, isLive, canParticipate, isPendingAxisVote, isPendingStepVote,
}: {
  sol: MathBattleSolution;
  args: MathBattleArgument[];
  problemId: number;
  viewerId: string | null;
  queryKey: unknown[];
  activePanel: { solutionId: number; stepIndex: number } | null;
  onOpenPanel: (solutionId: number, stepIndex: number) => void;
  myAxisVotes: Partial<Record<AxisKey, number | null>>;
  onAxisVote: (axis: AxisKey, solutionId: number) => void;
  onStepVote: (solutionId: number, stepIndex: number, vote: "sound" | "unsound") => void;
  isPendingAxisVote: boolean;
  isPendingStepVote: boolean;
  rank: number;
  isLive: boolean;
  canParticipate: boolean;
}) {
  const pal = palette(sol.approach);
  const steps = parseSteps(sol.body);
  const total = totalVotes(sol);
  const color = dnaColor(sol.approach);
  const isOwnSolution = !!viewerId && viewerId === sol.userId;

  const topArgs = args
    .filter(a => a.solutionId === sol.id && !a.parentId)
    .sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes))
    .slice(0, 3);

  return (
    <div
      className="relative flex flex-col overflow-hidden rounded-[24px] border bg-card/90 shadow-[0_24px_70px_rgba(15,23,42,0.10)]"
      style={{ borderColor: `${color}35` }}
    >
      <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
      {/* ── Card header ── */}
      <div className="space-y-5 border-b border-border/60 px-4 pb-5 pt-5 sm:px-6 sm:pt-6">
        {/* Approach badge + score */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border font-serif text-lg font-bold" style={{ color, borderColor: `${color}35`, background: `${color}12` }}>
              {sol.approach.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
            {rank === 0 && isLive && (
                  <span className="flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-500">
                    <Crown className="h-2.5 w-2.5" /> Leading
              </span>
            )}
                <span className={cn("text-sm font-bold capitalize", pal.text)}>{sol.approach} approach</span>
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">Solution by <span className="font-semibold text-foreground/75">{sol.userName}</span></p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <span className="block text-2xl font-semibold tabular-nums text-foreground">{total}</span>
            <span className="block text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">community pts</span>
          </div>
        </div>

        {/* Community profile */}
        <SolutionDNA sol={sol} compact />

        {/* Axis vote grid */}
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Evaluate this solution</p>
            {isLive && canParticipate && viewerId && <span className="text-[10px] text-muted-foreground">One choice per quality</span>}
          </div>
          <div className="grid grid-cols-2 gap-2">
          {AXIS_META.map(({ key, Icon, label, color: c, bg, border }) => (
            <AxisVoteTile
              key={key}
              axisKey={key as AxisKey}
              Icon={Icon}
              label={label}
              color={c}
              bg={bg}
              border={border}
              count={sol.votes[key as AxisKey]}
              isMine={myAxisVotes[key as AxisKey] === sol.id}
              canVote={isLive && canParticipate && !!viewerId && !isOwnSolution}
              onVote={() => onAxisVote(key as AxisKey, sol.id)}
              isPending={isPendingAxisVote}
            />
          ))}
          </div>
        </div>
        {!viewerId && isLive && (
          <p className="text-[11px] text-center text-muted-foreground/60">Sign in to cast your votes</p>
        )}
        {isOwnSolution && isLive && (
          <p className="text-center text-[11px] text-muted-foreground">Your solution is visible to voters; self-voting is disabled.</p>
        )}
      </div>

      {/* ── Steps ── */}
      <div className="flex-1 space-y-2 px-4 py-5 sm:px-6">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            Solution Steps
            <span className="ml-1 text-muted-foreground/50">({steps.length})</span>
          </p>
        </div>
        <div className="max-h-[26rem] space-y-2 overflow-y-auto pr-0.5">
          {steps.map((step, i) => {
            const soundness = sol.stepSoundness?.[i] ?? { up: 0, down: 0, myVote: null };
            const argCount = args.filter(a => a.solutionId === sol.id && a.stepIndex === i && !a.parentId).length;
            const isActive = activePanel?.solutionId === sol.id && activePanel?.stepIndex === i;
            return (
              <StepCard
                key={i}
                step={step}
                stepIndex={i}
                soundness={soundness}
                argCount={argCount}
                isActive={isActive}
                onJustify={() => onOpenPanel(sol.id, i)}
                canVote={isLive && canParticipate && !!viewerId && !isOwnSolution}
                isPending={isPendingStepVote}
                onVote={(vote) => onStepVote(sol.id, i, vote)}
              />
            );
          })}
          {steps.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No steps parsed.</p>
          )}
        </div>
      </div>

      {/* ── Top discussions ── */}
      {topArgs.length > 0 && (
        <div className="space-y-3 border-t border-border/60 px-4 py-5 sm:px-6">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Top Discussions</p>
          <div className="space-y-2">
            {topArgs.map(a => (
              <ArgumentCard key={a.id} arg={a} problemId={problemId} viewerId={canParticipate ? viewerId : null} queryKey={queryKey} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Verdict panel ─────────────────────────────────────────────────────────────
function VerdictPanel({
  data, problemId, viewerId, queryKey,
}: {
  data: MathBattleFullResponse; problemId: number; viewerId: string | null; queryKey: unknown[];
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);

  const concludeMut = useMutation({
    mutationFn: () => concludeEleganceBattle(problemId, { verdict: draft.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Battle concluded!" });
      setOpen(false);
    },
    onError: (err: unknown) => {
      const msg = (err as { data?: { error?: string } })?.data?.error ?? "Failed to conclude.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const cats = [
    { label: "Most Elegant",   Icon: Gem,   color: "text-purple-500", bg: "bg-purple-500/[0.06] border-purple-500/25", cat: data.categories?.mostElegant  },
    { label: "Most Rigorous",  Icon: Shield,color: "text-blue-500",   bg: "bg-blue-500/[0.06] border-blue-500/25",    cat: data.categories?.mostRigorous },
    { label: "Clearest",       Icon: Eye,   color: "text-emerald-500",bg: "bg-emerald-500/[0.06] border-emerald-500/25", cat: data.categories?.clearest  },
    { label: "Most Efficient", Icon: Gauge, color: "text-amber-500",  bg: "bg-amber-500/[0.06] border-amber-500/25",   cat: data.categories?.mostEfficient},
  ] as const;

  return (
    <div className="space-y-6">
      {/* Moderator verdict */}
      {data.battle?.verdict ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl border border-yellow-500/30 bg-gradient-to-br from-yellow-900/15 to-amber-900/8 p-6"
        >
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top_left,rgba(234,179,8,0.1),transparent_60%)]" />
          <div className="relative">
            <div className="flex items-center gap-2 text-yellow-400 font-bold text-sm mb-4">
              <Crown className="w-5 h-5" />
              <span>Moderator Verdict</span>
              {data.battle.verdictAuthor && (
                <span className="ml-auto text-xs text-yellow-400/60 font-normal">by {data.battle.verdictAuthor}</span>
              )}
            </div>
            <p className="text-foreground/90 leading-relaxed text-sm">{data.battle.verdict}</p>
          </div>
        </motion.div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-5 text-center">
          <Swords className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Battle is still live — no verdict yet.</p>
        </div>
      )}

      {/* Category awards */}
      <div>
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold mb-3 flex items-center gap-2">
          <Award className="w-3.5 h-3.5" /> Category Awards
        </p>
        <div className="grid grid-cols-2 gap-3">
          {cats.map(({ label, Icon, color, bg, cat }) => {
            const sol = cat ? data.solutions.find(s => s.id === cat.solutionId) : null;
            return (
              <div key={label} className={cn("rounded-xl border p-4 flex items-start gap-3", bg)}>
                <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-background/60", color)}><Icon className="h-4 w-4" /></span>
                <div className="min-w-0">
                  <p className={cn("text-[10px] uppercase tracking-widest font-semibold", color)}>{label}</p>
                  {sol ? (
                    <>
                      <p className="font-bold capitalize text-sm mt-1 text-foreground">{sol.approach}</p>
                      <p className="text-xs text-muted-foreground">{sol.userName}</p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1">No data yet</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Conclude button (moderator only) */}
      {data.battle?.canConclude && !data.battle.verdict && !data.battle.isEnded && (
        <div>
          {open ? (
            <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
              <p className="text-sm font-bold">Write the Verdict</p>
              <p className="text-xs text-muted-foreground">Summarise the winning approach and reasoning.</p>
              <Textarea
                rows={5}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                maxLength={4000}
                placeholder="e.g. The geometric approach wins for elegance — its single diagram replaces 3 pages of algebra…"
                className="resize-none bg-muted/60 border-border"
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => concludeMut.mutate()}
                  disabled={!draft.trim() || concludeMut.isPending}
                  className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold"
                >
                  <CheckCircle className="w-4 h-4 mr-2" /> Conclude Battle
                </Button>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full border-yellow-500/30 text-yellow-400 hover:bg-yellow-400/5"
              onClick={() => setOpen(true)}
            >
              <Trophy className="w-4 h-4 mr-2" /> Declare Winner & Conclude
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MathEleganceBattle() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const problemId = Number(id);

  const { user, isLoaded: isSessionLoaded } = useSession();
  const viewerId = user?.id ?? null;

  const queryKey = ["elegance-battle-full", problemId, viewerId ?? "guest"];

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: () => getEleganceBattleFull(problemId),
    enabled: !!problemId && isSessionLoaded,
    refetchInterval: 15_000,
  });

  const [activePanel, setActivePanel] = useState<{ solutionId: number; stepIndex: number } | null>(null);
  const [activeTab, setActiveTab] = useState<"arena" | "verdict">("arena");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (!activePanel) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActivePanel(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [activePanel]);

  // ── Axis voting — wired to `voteMathShowdown` ──────────────────────────────
  const axisVoteMut = useMutation({
    mutationFn: ({ axis, solutionId }: { axis: AxisKey; solutionId: number }) =>
      voteMathShowdown(problemId, { axis, solutionId }),
    onSuccess: (result) => {
      // Merge updated `myAxisVotes` and per-solution `votes` tallies back into cache
      queryClient.setQueryData(queryKey, (old: MathBattleFullResponse | undefined) => {
        if (!old) return old;
        // result is MathShowdownDetail which has `solutions` and `myVotes`
        const myVotes = (result as unknown as { myVotes?: Partial<Record<AxisKey, number | null>> }).myVotes;
        const updatedSols = (result as unknown as { solutions?: MathBattleSolution[] }).solutions;
        return {
          ...old,
          myAxisVotes: myVotes ?? old.myAxisVotes,
          solutions: updatedSols
            ? old.solutions.map(s => {
                const fresh = updatedSols.find(u => u.id === s.id);
                return fresh ? { ...s, votes: { ...s.votes, ...fresh.votes } } : s;
              })
            : old.solutions,
        };
      });
      // Re-fetch to get canonical vote tallies
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err: unknown) => {
      const msg = (err as { data?: { error?: string } })?.data?.error;
      toast({ title: msg ?? "Vote failed", variant: "destructive" });
    },
  });

  const handleAxisVote = (axis: AxisKey, solutionId: number) => {
    if (!viewerId) {
      toast({ title: "Sign in to vote", description: "Set your name in the Math Hub to participate.", variant: "destructive" });
      return;
    }
    axisVoteMut.mutate({ axis, solutionId });
  };

  const stepVoteMut = useMutation({
    mutationFn: ({ solutionId, stepIndex, vote }: { solutionId: number; stepIndex: number; vote: "sound" | "unsound" }) =>
      voteEleganceBattleStep(problemId, solutionId, stepIndex, { vote }),
    onSuccess: (result, variables) => {
      queryClient.setQueryData(queryKey, (old: MathBattleFullResponse | undefined) => {
        if (!old) return old;
        return {
          ...old,
          solutions: old.solutions.map((solution) => {
            if (solution.id !== variables.solutionId) return solution;
            const stepSoundness = [...solution.stepSoundness];
            stepSoundness[variables.stepIndex] = result;
            return { ...solution, stepSoundness };
          }),
        };
      });
    },
    onError: (error) => toast({ title: apiErrorMessage(error, "Step assessment failed"), variant: "destructive" }),
  });

  const myAxisVotes: Partial<Record<AxisKey, number | null>> = data?.myAxisVotes ?? {};

  // Sort by total votes
  const ranked = data ? [...data.solutions].sort((a, b) => totalVotes(b) - totalVotes(a)) : [];

  const participantIds = new Set<string>();
  if (data) {
    data.solutions.forEach((solution) => participantIds.add(solution.userId));
    const collectArgumentAuthors = (argumentsList: MathBattleArgument[]) => {
      argumentsList.forEach((argument) => {
        participantIds.add(argument.userId);
        collectArgumentAuthors(argument.replies ?? []);
      });
    };
    collectArgumentAuthors(data.arguments);
  }
  const uniqueParticipants = participantIds.size;

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (!Number.isInteger(problemId) || problemId <= 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <div className="max-w-sm space-y-4 text-center">
          <Swords className="mx-auto h-12 w-12 text-muted-foreground/30" />
          <p className="font-semibold">This battle link is invalid.</p>
          <Button variant="outline" onClick={() => navigate("/math")}><ArrowLeft className="mr-2 h-4 w-4" /> Mathematics Arena</Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="container mx-auto px-4 py-10 max-w-6xl space-y-6">
          <Skeleton className="h-8 w-48 bg-muted" />
          <Skeleton className="h-40 w-full rounded-2xl bg-muted/60" />
          <div className="grid lg:grid-cols-2 gap-5">
            <Skeleton className="h-[580px] rounded-2xl bg-muted/60" />
            <Skeleton className="h-[580px] rounded-2xl bg-muted/60" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center space-y-4 px-4">
          <Swords className="w-12 h-12 text-muted-foreground/30 mx-auto" />
          <div>
            <p className="font-semibold">Could not load this battle.</p>
            <p className="mt-1 text-sm text-muted-foreground">Check your connection and try again.</p>
          </div>
          <Button onClick={() => void refetch()} disabled={isFetching}>{isFetching ? "Retrying…" : "Try Again"}</Button>
          <Button variant="outline" onClick={() => navigate(`/math/problem/${problemId}`)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Problem
          </Button>
        </div>
      </div>
    );
  }

  const [solA, solB] = ranked;
  const isLive = !!(data.battle?.isLive && !data.battle?.isEnded);
  const isEnded = !!data.battle?.isEnded;
  const canParticipate = !!data.battle?.canParticipate;
  const participantId = canParticipate ? viewerId : null;

  return (
    <div className="elegance-battle-page min-h-[calc(100dvh-4rem)] overflow-x-hidden bg-background text-foreground">
      <style>{`
        .elegance-battle-page {
          isolation: isolate;
          background:
            radial-gradient(circle at 8% 0%, rgba(99,102,241,.12), transparent 34rem),
            radial-gradient(circle at 96% 24%, rgba(168,85,247,.08), transparent 30rem),
            var(--color-background);
        }
        .elegance-battle-page::before {
          content: "";
          position: fixed;
          inset: 0;
          z-index: -1;
          pointer-events: none;
          opacity: .12;
          background-image:
            linear-gradient(rgba(99,102,241,.11) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99,102,241,.11) 1px, transparent 1px);
          background-size: 46px 46px;
          mask-image: linear-gradient(to bottom, black, transparent 68%);
        }
        .battle-hero-surface {
          background:
            linear-gradient(125deg, color-mix(in srgb, var(--color-card) 95%, #6366f1 5%), color-mix(in srgb, var(--color-card) 98%, #a855f7 2%));
          box-shadow: 0 28px 90px rgba(15,23,42,.10), inset 0 1px rgba(255,255,255,.04);
        }
      `}</style>
      <div className="container mx-auto max-w-7xl space-y-6 px-4 py-5 sm:px-6 sm:py-7">

        {/* ── Back nav ── */}
        <button
          onClick={() => navigate(`/math/problem/${problemId}`)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to Problem
        </button>

        {/* ── Hero ── */}
        <div className="battle-hero-surface relative overflow-hidden rounded-[24px] border border-indigo-500/15 p-5 sm:rounded-[30px] sm:p-8">
          {/* Ambient gradients */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -left-16 -top-20 h-72 w-72 rounded-full bg-indigo-500/[0.08] blur-3xl" />
            <div className="absolute -right-16 -top-20 h-72 w-72 rounded-full bg-purple-500/[0.07] blur-3xl" />
            <div className="absolute right-[8%] top-2 hidden select-none font-serif text-8xl text-indigo-400/[0.045] lg:block">∴</div>
          </div>

          <div className="relative space-y-5">
            {/* Title row */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="max-w-3xl space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-900/20">
                      <Swords className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-[0.19em] text-indigo-400">
                      Treffin Mathematics · Elegance Battle
                    </span>
                  </div>

                  {isLive && (
                    <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/25 px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      LIVE
                    </span>
                  )}
                  {isEnded && (
                    <Badge variant="outline" className="text-muted-foreground border-border">
                      Concluded
                    </Badge>
                  )}
                </div>
                <h1 className="font-serif text-2xl font-semibold leading-tight tracking-[-0.025em] text-foreground sm:text-4xl">
                  Which solution best balances insight and proof?
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{data.problemTitle}</p>
              </div>

              <div className="flex shrink-0 items-center gap-3 rounded-xl border border-border/70 bg-background/45 px-3 py-2 text-xs text-muted-foreground">
                {uniqueParticipants > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    {uniqueParticipants} participant{uniqueParticipants !== 1 ? "s" : ""}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  {data.solutions.length} solutions
                </span>
              </div>
            </div>

            {/* Live score bar */}
            {solA && solB && (
              <div className="max-w-2xl rounded-2xl border border-border/70 bg-background/45 p-4">
                <ScoreBar solA={solA} solB={solB} />
              </div>
            )}

            {/* Ranked score ticker */}
            {ranked.length > 0 && (
              <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
                {ranked.map((sol, i) => {
                  const pal = palette(sol.approach);
                  const color = dnaColor(sol.approach);
                  return (
                    <div
                      key={sol.id}
                      className={cn("flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 transition-all", pal.border)}
                      style={{ background: `${color}10` }}
                    >
                      {i === 0 && <Trophy className="w-3.5 h-3.5 text-yellow-400" />}
                      <span className={cn("text-xs font-bold capitalize", pal.text)}>{sol.approach}</span>
                      <span className="text-sm font-black text-foreground tabular-nums">{totalVotes(sol)}</span>
                      <span className="text-[10px] text-muted-foreground">pts</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {!data.battle && (
          <div className="flex flex-col gap-4 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-foreground">This comparison has not entered a live Elegance Battle.</p>
              <p className="mt-1 text-sm text-muted-foreground">You can review every solution below; voting and annotations open when a battle is started.</p>
            </div>
            <Button variant="outline" onClick={() => navigate(`/math/problem/${problemId}/showdown`)}>Open comparison</Button>
          </div>
        )}

        {/* ── Tab switcher ── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex gap-1 rounded-xl border border-border/70 bg-card/80 p-1 shadow-sm">
            {(["arena", "verdict"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "rounded-lg px-5 py-2 text-sm font-semibold transition-all",
                  activeTab === tab
                    ? "bg-indigo-600 text-white shadow-sm shadow-indigo-900/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                {tab === "arena" ? "Compare solutions" : "Verdict & awards"}
              </button>
            ))}
          </div>

          {/* No solutions warning */}
          {data.solutions.length === 0 && (
            <p className="text-sm text-muted-foreground">No solutions have been submitted yet.</p>
          )}
        </div>

        {/* ── Arena tab ── */}
        {activeTab === "arena" && (
          <div className="relative">
            {data.solutions.length === 0 ? (
              <div className="text-center py-24 rounded-2xl border border-border/60 bg-card space-y-4">
                <Sparkles className="w-12 h-12 mx-auto text-muted-foreground/25" />
                <div>
                  <p className="text-foreground/60 font-semibold">No solutions yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Submit a solution to this problem to start the battle.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="border-border"
                  onClick={() => navigate(`/math/problem/${problemId}`)}
                >
                  Submit a Solution
                </Button>
              </div>
            ) : (
              <div
                className={cn(
                  "gap-6",
                  data.solutions.length >= 2 ? "grid xl:grid-cols-2" : "max-w-2xl mx-auto",
                  activePanel && "xl:pr-[400px]",
                )}
              >
                {/* VS divider — desktop */}
                {data.solutions.length >= 2 && (
                  <div className="hidden xl:flex absolute left-1/2 top-20 -translate-x-1/2 z-10 pointer-events-none">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-indigo-500/25 bg-background text-[10px] font-bold uppercase tracking-wider text-indigo-400 shadow-xl">
                      VS
                    </div>
                  </div>
                )}

                {data.solutions.map((sol, i) => (
                  <SolutionCard
                    key={sol.id}
                    sol={sol}
                    args={data.arguments}
                    problemId={problemId}
                    viewerId={viewerId}
                    queryKey={queryKey}
                    activePanel={activePanel}
                    onOpenPanel={(sid, si) =>
                      setActivePanel(cur =>
                        cur?.solutionId === sid && cur?.stepIndex === si ? null : { solutionId: sid, stepIndex: si }
                      )
                    }
                    myAxisVotes={myAxisVotes}
                    onAxisVote={handleAxisVote}
                    onStepVote={(solutionId, stepIndex, vote) => stepVoteMut.mutate({ solutionId, stepIndex, vote })}
                    isPendingAxisVote={axisVoteMut.isPending}
                    isPendingStepVote={stepVoteMut.isPending}
                    rank={ranked.findIndex(r => r.id === sol.id)}
                    isLive={isLive}
                    canParticipate={canParticipate}
                  />
                ))}
              </div>
            )}

            {/* ── Justification slide-over ── */}
            <AnimatePresence>
              {activePanel && (() => {
                const activeSol = data.solutions.find(s => s.id === activePanel.solutionId);
                if (!activeSol) return null;
                const steps = parseSteps(activeSol.body);
                const s = steps[activePanel.stepIndex];
                const label = s?.label ? s.label : `Step ${activePanel.stepIndex + 1}`;
                return (
                  <motion.div
                    key="panel"
                    initial={{ x: 400 }}
                    animate={{ x: 0 }}
                    exit={{ x: 400 }}
                    transition={{ type: "spring", stiffness: 320, damping: 32 }}
                    className="fixed right-0 top-16 bottom-[calc(env(safe-area-inset-bottom,0px)+62px)] lg:bottom-0 w-full sm:w-[400px] z-30 flex flex-col shadow-2xl"
                  >
                    <JustificationPanel
                      solutionId={activePanel.solutionId}
                      stepIndex={activePanel.stepIndex}
                      stepLabel={`${activeSol.userName} · ${label}`}
                      args={data.arguments}
                      problemId={problemId}
                      onClose={() => setActivePanel(null)}
                      viewerId={participantId}
                      queryKey={queryKey}
                    />
                  </motion.div>
                );
              })()}
            </AnimatePresence>
          </div>
        )}

        {/* ── Verdict tab ── */}
        {activeTab === "verdict" && (
          <VerdictPanel data={data} problemId={problemId} viewerId={viewerId} queryKey={queryKey} />
        )}

      </div>
    </div>
  );
}
