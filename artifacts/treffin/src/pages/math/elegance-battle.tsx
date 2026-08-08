import { useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getEleganceBattleFull,
  postEleganceBattleArgument,
  voteEleganceBattleArgument,
  concludeEleganceBattle,
  voteMathShowdown,
  type EleganceBattleArgumentVoteResult,
  type MathBattleArgument,
  type MathBattleFullResponse,
  type MathBattleSolution,
} from "@workspace/api-client-react";
import { getMathUserId, getMathUsername } from "@/lib/math-auth";
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
  BarChart3, BookOpen, ChevronRight,
} from "lucide-react";
import { parseSteps } from "./problem-detail";
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";

// ── constants ─────────────────────────────────────────────────────────────────

const AXIS_META = [
  { key: "elegant",   label: "Elegant",   icon: "💎", color: "#a855f7", bg: "rgba(168,85,247,0.12)", border: "rgba(168,85,247,0.35)" },
  { key: "rigorous",  label: "Rigorous",  icon: "🛡",  color: "#3b82f6", bg: "rgba(59,130,246,0.12)",  border: "rgba(59,130,246,0.35)"  },
  { key: "clear",     label: "Clear",     icon: "👁",  color: "#10b981", bg: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.35)"  },
  { key: "efficient", label: "Efficient", icon: "⚡",  color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.35)"  },
] as const;

type AxisKey = "elegant" | "rigorous" | "clear" | "efficient";

const APPROACH_PALETTE: Record<string, { gradient: string; border: string; glow: string; badge: string; text: string; dim: string }> = {
  algebraic:     { gradient: "from-blue-950/60 to-blue-900/30",     border: "border-blue-500/30",    glow: "shadow-blue-900/40",    badge: "bg-blue-900/50 text-blue-300 border-blue-500/40",    text: "text-blue-300",    dim: "rgba(59,130,246,0.07)"  },
  geometric:     { gradient: "from-purple-950/60 to-purple-900/30", border: "border-purple-500/30",  glow: "shadow-purple-900/40",  badge: "bg-purple-900/50 text-purple-300 border-purple-500/40", text: "text-purple-300", dim: "rgba(168,85,247,0.07)"  },
  combinatorial: { gradient: "from-amber-950/60 to-amber-900/30",   border: "border-amber-500/30",   glow: "shadow-amber-900/40",   badge: "bg-amber-900/50 text-amber-300 border-amber-500/40",   text: "text-amber-300",   dim: "rgba(245,158,11,0.07)"  },
  calculus:      { gradient: "from-emerald-950/60 to-emerald-900/30",border:"border-emerald-500/30", glow: "shadow-emerald-900/40", badge: "bg-emerald-900/50 text-emerald-300 border-emerald-500/40",text:"text-emerald-300",dim: "rgba(16,185,129,0.07)" },
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
interface Burst { id: number; emoji: string; x: number }

function FloatingBurst({ emoji, x }: { emoji: string; x: number }) {
  return (
    <motion.span
      initial={{ y: 0, opacity: 1, scale: 1 }}
      animate={{ y: -140, opacity: 0, scale: 2 }}
      transition={{ duration: 1.4, ease: "easeOut" }}
      className="pointer-events-none fixed bottom-24 text-2xl z-50 select-none"
      style={{ left: x }}
    >
      {emoji}
    </motion.span>
  );
}

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
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm font-bold">
        <span className={palA.text}>{solA.approach.charAt(0).toUpperCase() + solA.approach.slice(1)}</span>
        <span className="text-xs text-muted-foreground uppercase tracking-widest">Live Score</span>
        <span className={palB.text}>{solB.approach.charAt(0).toUpperCase() + solB.approach.slice(1)}</span>
      </div>

      <div className="relative h-4 rounded-full overflow-hidden bg-white/5 border border-white/8">
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
        <div className="absolute left-1/2 inset-y-0 -translate-x-1/2 w-0.5 bg-white/50 z-10" />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{pA}% · {a} pts</span>
        <span className="text-white/30">vs</span>
        <span>{pB}% · {b} pts</span>
      </div>
    </div>
  );
}

// ── DNA Radar ─────────────────────────────────────────────────────────────────
function SolutionDNA({ sol, compact }: { sol: MathBattleSolution; compact?: boolean }) {
  const color = dnaColor(sol.approach);
  const data = AXIS_META.map(({ key, label }) => ({
    axis: label,
    value: sol.votes[key as AxisKey] ?? 0,
  }));
  const max = Math.max(...data.map(d => d.value), 1);
  const norm = data.map(d => ({ ...d, value: Math.round((d.value / max) * 100) }));
  const h = compact ? 140 : 180;

  return (
    <div style={{ height: h }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={norm} margin={{ top: 8, right: 18, bottom: 8, left: 18 }}>
          <PolarGrid stroke="rgba(255,255,255,0.06)" />
          <PolarAngleAxis dataKey="axis" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} />
          <Radar
            name={sol.approach}
            dataKey="value"
            stroke={color}
            fill={color}
            fillOpacity={0.2}
            strokeWidth={2}
          />
          <Tooltip
            contentStyle={{ background: "#0d0d20", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }}
            formatter={(v: number) => [`${v}`, "Strength"]}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Axis vote tile ─────────────────────────────────────────────────────────────
function AxisVoteTile({
  axisKey, icon, label, color, bg, border,
  count, isMine, canVote, onVote, isPending,
}: {
  axisKey: AxisKey; icon: string; label: string; color: string; bg: string; border: string;
  count: number; isMine: boolean; canVote: boolean; onVote: () => void; isPending: boolean;
}) {
  return (
    <motion.button
      onClick={canVote ? onVote : undefined}
      disabled={!canVote || isPending}
      whileTap={canVote ? { scale: 0.93 } : undefined}
      style={{
        background: isMine ? bg : "rgba(255,255,255,0.03)",
        border: `1px solid ${isMine ? border : "rgba(255,255,255,0.08)"}`,
        boxShadow: isMine ? `0 0 14px ${bg}` : "none",
      }}
      className={cn(
        "flex flex-col items-center gap-1 py-3 px-1 rounded-xl text-center transition-all",
        canVote && !isMine && "hover:bg-white/7 hover:border-white/20",
        isMine && "ring-1",
      )}
    >
      <span className="text-xl leading-none">{icon}</span>
      <span className="text-[11px] font-black tabular-nums" style={{ color: isMine ? color : "rgba(255,255,255,0.7)" }}>
        {count}
      </span>
      <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground leading-none">{label}</span>
      {isMine && (
        <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color }}>✓ Voted</span>
      )}
    </motion.button>
  );
}

// ── Step card ─────────────────────────────────────────────────────────────────
function StepCard({
  step, stepIndex, soundness, argCount, isActive, onJustify,
}: {
  step: { label: string | null; content: string };
  stepIndex: number;
  soundness: { up: number; down: number };
  argCount: number;
  isActive: boolean;
  onJustify: () => void;
}) {
  const total = soundness.up + soundness.down || 1;
  const health = soundness.up / total;
  const hColor = health > 0.65 ? "#10b981" : health > 0.38 ? "#f59e0b" : "#ef4444";
  const hBg    = health > 0.65 ? "rgba(16,185,129,0.12)" : health > 0.38 ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.1)";
  const hBorder = health > 0.65 ? "rgba(16,185,129,0.3)" : health > 0.38 ? "rgba(245,158,11,0.3)" : "rgba(239,68,68,0.25)";

  return (
    <div
      style={{ borderLeftColor: hColor }}
      className={cn(
        "rounded-xl border border-l-2 p-3 transition-all cursor-default",
        isActive ? "border-primary/40 bg-primary/5" : "border-white/8 bg-white/[0.025] hover:bg-white/5",
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
        {/* Soundness mini-bar */}
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-16 rounded-full bg-white/8 overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${health * 100}%`, background: hColor }} />
          </div>
          <span className="text-[10px] text-emerald-400 font-semibold">▲{soundness.up}</span>
          <span className="text-[10px] text-red-400/60">▼{soundness.down}</span>
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
  const viewerName = getMathUsername() ?? "Anonymous";

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
    onError: () => toast({ title: "Failed to vote", variant: "destructive" }),
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
    onError: () => toast({ title: "Failed to post reply", variant: "destructive" }),
  });

  const net = arg.upvotes - arg.downvotes;

  return (
    <div className={cn("space-y-2", depth > 0 && "pl-2 sm:pl-4 border-l border-white/8")}>
      <div className="flex gap-2.5 group">
        {/* Vote column */}
        <div className="flex flex-col items-center gap-0.5 pt-1 shrink-0">
          <button
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
          <div className="rounded-xl bg-white/[0.04] border border-white/8 px-3 py-2.5 group-hover:border-white/14 transition-colors">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-5 h-5 rounded-full bg-indigo-900/60 border border-indigo-500/30 flex items-center justify-center text-[9px] font-black text-indigo-300">
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
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            placeholder="Write a reply…"
            className="text-sm resize-none flex-1 bg-white/5 border-white/10 focus:border-indigo-500/50"
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
    onError: () => toast({ title: "Failed to post", variant: "destructive" }),
  });

  return (
    <div className="flex flex-col h-full bg-[#0a0a1c] border-l border-white/8">
      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3.5 border-b border-white/8 gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Step Analysis</p>
          <p className="text-sm font-semibold mt-0.5 truncate">{stepLabel}</p>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/8 transition-all"
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
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
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
        <div className="px-4 py-4 border-t border-white/8 space-y-2.5">
          <Textarea
            rows={3}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Is this step valid? Annotate your take…"
            className="text-sm resize-none bg-white/5 border-white/10 focus:border-indigo-500/40"
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
        <p className="px-4 py-4 text-xs text-muted-foreground text-center border-t border-white/8">
          Sign in to annotate steps.
        </p>
      )}
    </div>
  );
}

// ── Solution card ─────────────────────────────────────────────────────────────
function SolutionCard({
  sol, args, problemId, viewerId, queryKey,
  activePanel, onOpenPanel, myAxisVotes, onAxisVote, rank, isLive,
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
  isPendingAxisVote: boolean;
  rank: number;
  isLive: boolean;
}) {
  const pal = palette(sol.approach);
  const steps = parseSteps(sol.body);
  const total = totalVotes(sol);
  const color = dnaColor(sol.approach);

  const topArgs = args
    .filter(a => a.solutionId === sol.id && !a.parentId)
    .sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes))
    .slice(0, 3);

  return (
    <div className={cn(
      "rounded-2xl border flex flex-col overflow-hidden shadow-2xl",
      `bg-gradient-to-b ${pal.gradient}`,
      pal.border,
    )}>
      {/* ── Card header ── */}
      <div className="px-5 pt-5 pb-4 space-y-4 border-b border-white/8">
        {/* Approach badge + score */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            {rank === 0 && isLive && (
              <span className="flex items-center gap-1 text-[10px] font-black text-yellow-400 bg-yellow-400/10 border border-yellow-400/25 px-2 py-0.5 rounded-full">
                <Crown className="w-3 h-3" /> LEADING
              </span>
            )}
            <span className={cn("text-sm font-black uppercase tracking-wide", pal.text)}>
              {sol.approach}
            </span>
            <span className="text-xs text-muted-foreground">by {sol.userName}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xl font-black text-white tabular-nums">{total}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">pts</span>
          </div>
        </div>

        {/* DNA Radar */}
        <SolutionDNA sol={sol} compact />

        {/* Axis vote grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {AXIS_META.map(({ key, icon, label, color: c, bg, border }) => (
            <AxisVoteTile
              key={key}
              axisKey={key as AxisKey}
              icon={icon}
              label={label}
              color={c}
              bg={bg}
              border={border}
              count={sol.votes[key as AxisKey]}
              isMine={myAxisVotes[key as AxisKey] === sol.id}
              canVote={isLive && !!viewerId}
              onVote={() => onAxisVote(key as AxisKey, sol.id)}
              isPending={false}
            />
          ))}
        </div>
        {!viewerId && isLive && (
          <p className="text-[11px] text-center text-muted-foreground/60">Sign in to cast your votes</p>
        )}
      </div>

      {/* ── Steps ── */}
      <div className="px-5 py-4 space-y-2 flex-1">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            Solution Steps
            <span className="ml-1 text-muted-foreground/50">({steps.length})</span>
          </p>
        </div>
        <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
          {steps.map((step, i) => {
            const soundness = sol.stepSoundness?.[i] ?? { up: 0, down: 0 };
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
        <div className="px-5 py-4 border-t border-white/8 space-y-3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Top Discussions</p>
          <div className="space-y-2">
            {topArgs.map(a => (
              <ArgumentCard key={a.id} arg={a} problemId={problemId} viewerId={viewerId} queryKey={queryKey} />
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
    { label: "Most Elegant",   icon: "💎", color: "text-purple-400", bg: "bg-purple-900/20 border-purple-500/25", cat: data.categories?.mostElegant  },
    { label: "Most Rigorous",  icon: "🛡",  color: "text-blue-400",   bg: "bg-blue-900/20 border-blue-500/25",    cat: data.categories?.mostRigorous },
    { label: "Clearest",       icon: "👁",  color: "text-emerald-400",bg: "bg-emerald-900/20 border-emerald-500/25", cat: data.categories?.clearest  },
    { label: "Most Efficient", icon: "⚡",  color: "text-amber-400",  bg: "bg-amber-900/20 border-amber-500/25",   cat: data.categories?.mostEfficient},
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
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 text-center">
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
          {cats.map(({ label, icon, color, bg, cat }) => {
            const sol = cat ? data.solutions.find(s => s.id === cat.solutionId) : null;
            return (
              <div key={label} className={cn("rounded-xl border p-4 flex items-start gap-3", bg)}>
                <span className={cn("text-2xl mt-0.5 shrink-0")}>{icon}</span>
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
      {viewerId && !data.battle?.verdict && !data.battle?.isEnded && (
        <div>
          {open ? (
            <div className="space-y-3 rounded-2xl border border-white/12 bg-white/[0.03] p-5">
              <p className="text-sm font-bold">Write the Verdict</p>
              <p className="text-xs text-muted-foreground">Summarise the winning approach and reasoning.</p>
              <Textarea
                rows={5}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder="e.g. The geometric approach wins for elegance — its single diagram replaces 3 pages of algebra…"
                className="resize-none bg-white/5 border-white/10"
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

  const viewerId = getMathUserId();

  const queryKey = ["elegance-battle-full", problemId];

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => getEleganceBattleFull(problemId),
    enabled: !!problemId,
    refetchInterval: 15_000,
  });

  const [activePanel, setActivePanel] = useState<{ solutionId: number; stepIndex: number } | null>(null);
  const [activeTab, setActiveTab] = useState<"arena" | "verdict">("arena");
  const [bursts, setBursts] = useState<Burst[]>([]);
  const burstId = useRef(0);
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
                return fresh ? { ...s, votes: { ...s.votes, ...fresh } } : s;
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

  const myAxisVotes: Partial<Record<AxisKey, number | null>> = data?.myAxisVotes ?? {};

  // Sort by total votes
  const ranked = data ? [...data.solutions].sort((a, b) => totalVotes(b) - totalVotes(a)) : [];

  // Real unique participant count — authors who have posted at least one argument
  const uniqueParticipants = data
    ? new Set(data.arguments.map((a: { userId: string }) => a.userId)).size
    : 0;

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#070710]">
        <div className="container mx-auto px-4 py-10 max-w-6xl space-y-6">
          <Skeleton className="h-8 w-48 bg-white/8" />
          <Skeleton className="h-40 w-full rounded-2xl bg-white/5" />
          <div className="grid lg:grid-cols-2 gap-5">
            <Skeleton className="h-[580px] rounded-2xl bg-white/5" />
            <Skeleton className="h-[580px] rounded-2xl bg-white/5" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-[#070710] flex items-center justify-center">
        <div className="text-center space-y-4 px-4">
          <Swords className="w-12 h-12 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground">Could not load this battle.</p>
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

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-[#070710]">
      {/* Floating reaction bursts */}
      <AnimatePresence>
        {bursts.map(b => <FloatingBurst key={b.id} emoji={b.emoji} x={b.x} />)}
      </AnimatePresence>

      <div className="container mx-auto px-4 py-5 max-w-6xl space-y-5">

        {/* ── Back nav ── */}
        <button
          onClick={() => navigate(`/math/problem/${problemId}`)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-white transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to Problem
        </button>

        {/* ── Hero ── */}
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0e0e2e] via-[#090918] to-[#0a0a1e] p-6 md:p-8">
          {/* Ambient gradients */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-0 w-80 h-80 bg-blue-600/8 rounded-full blur-3xl" />
            <div className="absolute top-0 right-0 w-80 h-80 bg-purple-600/8 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-1/2 w-60 h-40 bg-indigo-500/6 rounded-full blur-2xl" />
          </div>

          <div className="relative space-y-5">
            {/* Title row */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-900/50">
                      <Swords className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-black text-lg tracking-tight bg-gradient-to-r from-indigo-300 via-purple-300 to-blue-300 bg-clip-text text-transparent">
                      ELEGANCE BATTLE
                    </span>
                  </div>

                  {isLive && (
                    <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/25 px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      LIVE
                    </span>
                  )}
                  {isEnded && (
                    <Badge variant="outline" className="text-muted-foreground border-white/15">
                      Concluded
                    </Badge>
                  )}
                </div>
                <h1 className="text-lg md:text-xl font-bold text-foreground/90 leading-snug max-w-2xl">
                  {data.problemTitle}
                </h1>
              </div>

              <div className="flex items-center gap-4 shrink-0 text-muted-foreground text-xs">
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
              <div className="max-w-xl">
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
                      className={cn("flex items-center gap-2 px-3 py-2 rounded-xl border shrink-0 transition-all", pal.border)}
                      style={{ background: `${color}10` }}
                    >
                      {i === 0 && <Trophy className="w-3.5 h-3.5 text-yellow-400" />}
                      <span className={cn("text-xs font-bold capitalize", pal.text)}>{sol.approach}</span>
                      <span className="text-sm font-black text-white tabular-nums">{totalVotes(sol)}</span>
                      <span className="text-[10px] text-muted-foreground">pts</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Tab switcher ── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex gap-1 bg-white/[0.04] rounded-xl p-1 border border-white/8">
            {(["arena", "verdict"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-5 py-2 text-sm font-semibold rounded-lg transition-all",
                  activeTab === tab
                    ? "bg-white/12 text-white shadow-sm"
                    : "text-muted-foreground hover:text-white hover:bg-white/6",
                )}
              >
                {tab === "arena" ? "⚔️ Arena" : "🏆 Verdict"}
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
              <div className="text-center py-24 rounded-2xl border border-white/8 bg-white/[0.02] space-y-4">
                <Sparkles className="w-12 h-12 mx-auto text-muted-foreground/25" />
                <div>
                  <p className="text-foreground/60 font-semibold">No solutions yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Submit a solution to this problem to start the battle.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="border-white/15"
                  onClick={() => navigate(`/math/problem/${problemId}`)}
                >
                  Submit a Solution
                </Button>
              </div>
            ) : (
              <div
                className={cn(
                  "gap-5",
                  data.solutions.length >= 2 ? "grid lg:grid-cols-2" : "max-w-2xl mx-auto",
                  activePanel && "lg:pr-[400px]",
                )}
              >
                {/* VS divider — desktop */}
                {data.solutions.length >= 2 && (
                  <div className="hidden md:flex absolute left-1/2 top-20 -translate-x-1/2 z-10 pointer-events-none">
                    <div className="w-10 h-10 rounded-full bg-[#070710] border-2 border-white/15 flex items-center justify-center text-xs font-black text-white/80 shadow-2xl">
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
                    isPendingAxisVote={axisVoteMut.isPending}
                    rank={ranked.findIndex(r => r.id === sol.id)}
                    isLive={isLive}
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
                    className="fixed right-0 top-16 bottom-0 w-full sm:w-[400px] z-30 flex flex-col shadow-2xl"
                  >
                    <JustificationPanel
                      solutionId={activePanel.solutionId}
                      stepIndex={activePanel.stepIndex}
                      stepLabel={`${activeSol.userName} · ${label}`}
                      args={data.arguments}
                      problemId={problemId}
                      onClose={() => setActivePanel(null)}
                      viewerId={viewerId}
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
