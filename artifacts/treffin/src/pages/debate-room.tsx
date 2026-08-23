import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { useGetDebate, useVoteDebate, getGetDebateQueryKey, useGetMyDebateVote, getGetMyDebateVoteQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatNumber, cn, timeAgo } from "@/lib/utils";
import { Users, ArrowLeft, ThumbsUp, ThumbsDown, MessageCircle, Share, Heart, Send, Link as LinkIcon, CheckCircle, Trophy, Star, Zap, FileDown, Loader2, Handshake, ChevronUp, ChevronDown, Snowflake, AlertTriangle, LogOut, ShieldCheck, BarChart2, Pencil, ShieldAlert, Pin, Trash2, Flag, Gavel, Square, X, Shield, Activity } from "lucide-react";
import { getApiUrl } from "@/lib/api-url";
import { exportDebatePDF } from "@/lib/export-debate-pdf";
import { useGetDebateAgreements, getGetDebateAgreementsQueryKey, useCreateDebateAgreement, useUpvoteDebateAgreement } from "@workspace/api-client-react";
import type { DebateAgreement } from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useSession, getToken } from "@/lib/auth-client";
import { useAppContext } from "@/context/app-context";
import { ConfettiCelebration } from "@/components/confetti-celebration";

type Source = { url: string; label: string };
type ArgReactions = { fire: number; think: number; bulb: number; myReaction?: "fire" | "think" | "bulb" | null };
type Arg = { id: number; author: string; text: string; likes: number; likedByMe?: boolean; time: string; sources?: Source[]; isFlagged?: boolean; flagLabel?: string | null; editedAt?: string | null; isRemoved?: boolean; debateId?: number; parentCommentId?: number | null; replies?: Arg[]; isPinned?: boolean; isFeatured?: boolean; repliesLocked?: boolean; reactions?: ArgReactions };

function qualityScore(arg: Arg): { score: number; label: string; color: string } {
  const words = arg.text.trim().split(/\s+/).filter(Boolean).length;
  const wordPts = Math.min(40, Math.floor(words / 5));
  const likePts = Math.min(30, arg.likes);
  const citePts = (arg.sources?.length ?? 0) > 0 ? 20 : 0;
  const score = wordPts + likePts + citePts;
  if (score >= 60) return { score, label: "Excellent", color: "text-green-400 bg-green-400/10 border-green-400/20" };
  if (score >= 40) return { score, label: "Strong", color: "text-indigo-400 bg-indigo-400/10 border-indigo-400/20" };
  if (score >= 20) return { score, label: "Fair", color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" };
  return { score, label: "Developing", color: "text-muted-foreground bg-muted/30 border-border" };
}

const OXFORD_ROUNDS = ["Opening Statement", "Rebuttal", "Closing Argument"] as const;
type OxfordRound = typeof OXFORD_ROUNDS[number];


function commentToArg(c: { id: number; authorName: string; content: string; createdAt: string; isFlagged?: boolean; flagLabel?: string | null; editedAt?: string | null; isRemoved?: boolean; likes?: number; likedByMe?: boolean; parentCommentId?: number | null; isPinned?: boolean; isFeatured?: boolean; repliesLocked?: boolean; reactions?: ArgReactions }, debateId?: number): Arg {
  return {
    id: c.id,
    author: c.authorName,
    text: c.content,
    likes: c.likes ?? 0,
    likedByMe: c.likedByMe ?? false,
    time: timeAgo(c.createdAt),
    isFlagged: c.isFlagged,
    flagLabel: c.flagLabel,
    editedAt: c.editedAt ?? null,
    isRemoved: c.isRemoved ?? false,
    debateId,
    parentCommentId: c.parentCommentId ?? null,
    isPinned: c.isPinned ?? false,
    isFeatured: c.isFeatured ?? false,
    repliesLocked: c.repliesLocked ?? false,
    reactions: c.reactions ?? { fire: 0, think: 0, bulb: 0, myReaction: null },
  };
}

const PERSONAL_ATTACK_PATTERNS = [
  /\b(you('re| are) (stupid|dumb|idiot|moron|fool|ignorant))\b/i,
  /\b(idiot|moron|imbecile|dimwit|brainless)\b/i,
  /\b(shut up|go away|you suck)\b/i,
  /\b(personal(ly)? attack|ad hominem)\b/i,
];

function detectPersonalAttackFrontend(text: string): boolean {
  return PERSONAL_ATTACK_PATTERNS.some((p) => p.test(text));
}

// ── Lifecycle progress bar shown in debate header ────────────────────────────
function LifecycleBar({ isLive, endedAt, hasOutcome }: { isLive: boolean; endedAt?: string | null; hasOutcome: boolean }) {
  // currentStep: 0=created, 1=live, 2=ended/decided
  const currentStep = hasOutcome ? 2 : endedAt && !isLive ? 2 : isLive ? 1 : 0;
  const steps = ["Created", "Live", hasOutcome ? "Decided" : "Ended"];
  return (
    <div className="flex items-center gap-0 py-0.5">
      {steps.map((label, i) => {
        const isDone = i < currentStep || (i === 2 && (hasOutcome || (!!endedAt && !isLive)));
        const isActive = i === currentStep && !isDone;
        return (
          <div key={label} className="flex items-center">
            <div className="flex items-center gap-1.5">
              <div className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black border shrink-0 transition-all duration-300",
                isDone
                  ? "bg-primary/25 border-primary/60 text-primary"
                  : isActive
                  ? "bg-primary/10 border-primary text-primary animate-pulse"
                  : "bg-transparent border-border/40 text-muted-foreground/30"
              )}>
                {isDone ? "✓" : i + 1}
              </div>
              <span className={cn("text-[10px] font-bold uppercase tracking-wider hidden sm:inline",
                isDone || isActive ? "text-foreground/60" : "text-muted-foreground/30"
              )}>{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn("h-px w-6 sm:w-10 mx-1.5", isDone ? "bg-primary/40" : "bg-border/40")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ArgumentCard({ arg, side, isOxford, round, canModerate, onPin, onRemove, onFeature, onLockReplies }: { arg: Arg; side: "support" | "against"; isOxford?: boolean; round?: OxfordRound; canModerate?: boolean; onPin?: (id: number, pin: boolean) => void; onRemove?: (id: number) => void; onFeature?: (id: number, feature: boolean) => void; onLockReplies?: (id: number, lock: boolean) => void }) {
  const [liked, setLiked] = useState(arg.likedByMe ?? false);
  const [likeCount, setLikeCount] = useState(arg.likes);
  const [showReply, setShowReply] = useState(false);
  const [replyInput, setReplyInput] = useState("");
  const [isPostingReply, setIsPostingReply] = useState(false);
  const [reactState, setReactState] = useState<ArgReactions>(arg.reactions ?? { fire: 0, think: 0, bulb: 0, myReaction: null });
  const { toast } = useToast();
  const { user, isSignedIn } = useSession();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const qs = qualityScore({ ...arg, likes: likeCount });
  const serverReplies = arg.replies ?? [];

  useEffect(() => {
    setLiked(arg.likedByMe ?? false);
    setLikeCount(arg.likes);
  }, [arg.id, arg.likedByMe, arg.likes]);

  useEffect(() => {
    setReactState(arg.reactions ?? { fire: 0, think: 0, bulb: 0, myReaction: null });
  }, [arg.id, arg.reactions]);

  const handleReact = async (reaction: "fire" | "think" | "bulb") => {
    if (!arg.debateId) return;
    if (!isSignedIn) { toast({ title: "Sign in to react", variant: "destructive" }); setLocation("/sign-in"); return; }
    try {
      const token = await getToken();
      const res = await fetch(getApiUrl(`/api/debates/${arg.debateId}/comments/${arg.id}/react`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ reaction }),
      });
      if (res.ok) { const data = await res.json(); setReactState(data); }
    } catch { /* silent */ }
  };

  const isSupport = side === "support";
  const borderCls = isSupport
    ? "bg-indigo-950/20 border-indigo-500/15 hover:border-indigo-500/30 border-l-indigo-500/60"
    : "bg-rose-950/20 border-rose-500/15 hover:border-rose-500/30 border-l-rose-500/60";

  if (arg.isRemoved) {
    return (
      <div className="border border-border/40 rounded-xl p-4 bg-muted/10 flex items-center gap-2 text-muted-foreground">
        <ShieldAlert className="w-4 h-4 shrink-0" />
        <span className="text-xs italic">[This content was removed for violating community guidelines]</span>
      </div>
    );
  }

  const handleLike = async () => {
    if (!arg.debateId) return;
    if (!isSignedIn) {
      toast({ title: "Sign in required", description: "Please sign in to like arguments.", variant: "destructive" });
      setLocation("/sign-in");
      return;
    }
    const prevLiked = liked;
    const prevCount = likeCount;
    const nowLiked = !liked;
    // Optimistic update
    setLiked(nowLiked);
    setLikeCount(p => nowLiked ? p + 1 : p - 1);
    try {
      const token = await getToken();
      const res = await fetch(getApiUrl(`/api/debates/${arg.debateId}/comments/${arg.id}/like`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setLiked(prevLiked);
        setLikeCount(prevCount);
        if (res.status === 401) {
          toast({ title: "Sign in required", description: "Please sign in to like arguments.", variant: "destructive" });
          setLocation("/sign-in");
        } else {
          toast({ title: err.error ?? "Could not save like", variant: "destructive" });
        }
        return;
      }
      const data = await res.json();
      setLikeCount(data.likes);
      setLiked(data.liked);
    } catch {
      setLiked(prevLiked);
      setLikeCount(prevCount);
      toast({ title: "Could not save like", variant: "destructive" });
    }
  };

  const handlePostReply = async () => {
    if (!replyInput.trim() || isPostingReply || !arg.debateId) return;
    if (!isSignedIn) {
      toast({ title: "Sign in required", description: "Please sign in to post a reply.", variant: "destructive" });
      setLocation("/sign-in");
      return;
    }
    setIsPostingReply(true);
    try {
      const token = await getToken();
      const authorName = user?.fullName || user?.firstName || "Anonymous";
      const res = await fetch(getApiUrl(`/api/debates/${arg.debateId}/comments`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          content: replyInput.trim(),
          authorName,
          parentCommentId: arg.id,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to post reply" }));
        toast({ title: err.error ?? "Could not post reply", variant: "destructive" });
        return;
      }
      setReplyInput("");
      setShowReply(false);
      // Refetch so the new reply appears for everyone
      await queryClient.invalidateQueries({ queryKey: ["debate-comments", arg.debateId] });
      toast({ title: "Reply posted!" });
    } catch {
      toast({ title: "Network error", description: "Could not post reply.", variant: "destructive" });
    } finally {
      setIsPostingReply(false);
    }
  };

  return (
    <div className={cn("border border-l-[3px] rounded-xl p-4 flex flex-col gap-2.5 transition-colors", borderCls, arg.isPinned && "ring-1 ring-yellow-400/40 border-yellow-400/30 border-l-yellow-400/60", arg.isFeatured && !arg.isPinned && "ring-1 ring-amber-400/30 border-amber-400/20 border-l-amber-400/50")}>
      {arg.isPinned && (
        <div className="flex items-center gap-1 text-[10px] font-bold text-yellow-400 uppercase tracking-wider">
          <Pin className="w-2.5 h-2.5 fill-current" /> Pinned by creator
        </div>
      )}
      {arg.isFeatured && (
        <div className="flex items-center gap-1 text-[10px] font-bold text-amber-400 uppercase tracking-wider">
          <Star className="w-2.5 h-2.5 fill-current" /> Featured by creator
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <Avatar className="w-6 h-6">
          <AvatarFallback className={cn("text-[10px]", isSupport ? "bg-indigo-600/30 text-indigo-400" : "bg-rose-600/30 text-rose-400")}>
            {arg.author.substring(0, 2)}
          </AvatarFallback>
        </Avatar>
        <span className="text-xs font-semibold">{arg.author}</span>
        {isOxford && round && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">{round}</span>
        )}
        {arg.isFlagged && (
          <span className="text-[10px] font-bold text-orange-400 bg-orange-400/10 border border-orange-400/20 px-2 py-0.5 rounded-full">
            {arg.flagLabel ?? "Flagged"}
          </span>
        )}
        {arg.editedAt && (
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/70 italic">
            <Pencil className="w-2.5 h-2.5" /> edited
          </span>
        )}
        <span className="text-xs text-muted-foreground ml-auto">{arg.time}</span>
      </div>

      {canModerate && (
        <div className="flex items-center gap-3 text-[11px]">
          <button
            className="flex items-center gap-1 text-yellow-400/80 hover:text-yellow-400 transition-colors"
            onClick={() => onPin?.(arg.id, !arg.isPinned)}
            data-testid={`button-pin-arg-${arg.id}`}
          >
            <Pin className="w-3 h-3" /> {arg.isPinned ? "Unpin" : "Pin"}
          </button>
          <button
            className="flex items-center gap-1 text-red-400/80 hover:text-red-400 transition-colors"
            onClick={() => onRemove?.(arg.id)}
            data-testid={`button-remove-arg-${arg.id}`}
          >
            <Trash2 className="w-3 h-3" /> Remove
          </button>
          <button
            className="flex items-center gap-1 text-amber-400/80 hover:text-amber-400 transition-colors"
            onClick={() => onFeature?.(arg.id, !arg.isFeatured)}
            data-testid={`button-feature-arg-${arg.id}`}
          >
            <Star className="w-3 h-3" /> {arg.isFeatured ? "Unfeature" : "Feature"}
          </button>
          <button
            className={cn("flex items-center gap-1 transition-colors", arg.repliesLocked ? "text-blue-400/80 hover:text-blue-400" : "text-muted-foreground/70 hover:text-muted-foreground")}
            onClick={() => onLockReplies?.(arg.id, !arg.repliesLocked)}
            data-testid={`button-lock-replies-arg-${arg.id}`}
          >
            {arg.repliesLocked ? "🔓 Unlock replies" : "🔒 Lock replies"}
          </button>
        </div>
      )}

      <p className="text-sm leading-relaxed">{arg.text}</p>

      {arg.sources && arg.sources.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {arg.sources.map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] text-indigo-400 bg-indigo-400/10 border border-indigo-400/20 px-2 py-0.5 rounded-full hover:bg-indigo-400/20 transition-colors"
              onClick={e => e.stopPropagation()}
            >
              <LinkIcon className="w-2.5 h-2.5" /> {s.label}
            </a>
          ))}
          <span className="flex items-center gap-1 text-[11px] text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded-full">
            <CheckCircle className="w-2.5 h-2.5" /> Cited
          </span>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t border-white/5 flex-wrap">
        <button
          className={cn("flex items-center gap-1 transition-colors", liked ? (isSupport ? "text-indigo-400" : "text-rose-400") : (isSupport ? "hover:text-indigo-400" : "hover:text-rose-400"))}
          onClick={handleLike}
          data-testid={`button-like-arg-${arg.id}`}
        >
          <Heart className={cn("w-3 h-3", liked && "fill-current")} /> {likeCount}
        </button>
        {/* Emoji reactions: 🔥 insightful / 🤔 debatable / 💡 useful */}
        {(["fire", "think", "bulb"] as const).map((key) => {
          const emoji = key === "fire" ? "🔥" : key === "think" ? "🤔" : "💡";
          const count = reactState[key];
          const active = reactState.myReaction === key;
          return (
            <button
              key={key}
              className={cn("flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded-full border transition-colors",
                active ? "bg-primary/10 text-primary border-primary/30" : "text-muted-foreground border-border hover:border-primary/30")}
              onClick={() => handleReact(key)}
              data-testid={`button-react-${key}-${arg.id}`}
            >
              {emoji}{count > 0 ? ` ${count}` : ""}
            </button>
          );
        })}
        {arg.repliesLocked ? (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground/50">🔒 Replies locked</span>
        ) : (
          <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => setShowReply(p => !p)} data-testid={`button-reply-arg-${arg.id}`}>
            <MessageCircle className="w-3 h-3" /> {showReply ? "Cancel" : `Reply${serverReplies.length > 0 ? ` (${serverReplies.length})` : ""}`}
          </button>
        )}
        <div className={cn("ml-auto flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border", qs.color)}>
          <Zap className="w-2.5 h-2.5" /> {qs.label}
        </div>
      </div>

      {serverReplies.length > 0 && (
        <div className="flex flex-col gap-2 pl-4 border-l border-border/50">
          {serverReplies.map(r => (
            <div key={r.id} className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold">{r.author}</span>
                <span className="text-[10px] text-muted-foreground">{r.time}</span>
              </div>
              <p className="text-xs text-muted-foreground">{r.text}</p>
            </div>
          ))}
        </div>
      )}

      {showReply && (
        <div className="flex gap-2 items-center">
          <input
            className="flex-1 bg-muted/50 border border-border rounded-full px-3 py-1.5 text-xs outline-none focus:border-primary placeholder:text-muted-foreground"
            placeholder="Write a reply..."
            value={replyInput}
            onChange={e => setReplyInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handlePostReply()}
            autoFocus
            data-testid={`input-reply-arg-${arg.id}`}
            disabled={isPostingReply}
          />
          <button className={cn("p-1.5 rounded-full", replyInput.trim() && !isPostingReply ? "text-primary hover:bg-primary/10" : "text-muted-foreground")} onClick={handlePostReply} disabled={!replyInput.trim() || isPostingReply}>
            {isPostingReply ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}
    </div>
  );
}

function AgreementCard({ agreement, onUpvote, isParticipant }: { agreement: DebateAgreement; onUpvote: (id: number) => void; isParticipant: boolean }) {
  const canUpvote = isParticipant && !agreement.isOwnAgreement;
  const upvoteTitle = !isParticipant
    ? "Vote on the debate to upvote agreements"
    : agreement.isOwnAgreement
      ? "You cannot upvote your own agreement"
      : undefined;

  return (
    <div className="flex items-start gap-3 bg-green-950/20 border border-green-500/15 rounded-lg p-3 transition-colors hover:border-green-500/30">
      <Avatar className="w-6 h-6 shrink-0 mt-0.5">
        {agreement.authorAvatarUrl && <AvatarImage src={agreement.authorAvatarUrl} alt={agreement.authorName} />}
        <AvatarFallback className="text-[10px] bg-green-600/30 text-green-400">
          {agreement.authorName.substring(0, 2)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <span className="text-xs font-semibold text-green-300">{agreement.authorName}</span>
        <p className="text-sm leading-relaxed mt-0.5 text-foreground/90">{agreement.text}</p>
      </div>
      <button
        onClick={() => canUpvote && onUpvote(agreement.id)}
        disabled={!canUpvote}
        title={upvoteTitle}
        className={cn(
          "flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors shrink-0 mt-0.5",
          !canUpvote
            ? "opacity-40 cursor-not-allowed text-muted-foreground border-border"
            : agreement.hasUpvoted
              ? "bg-green-400/10 text-green-400 border-green-400/30"
              : "text-muted-foreground border-border hover:text-green-400 hover:border-green-400/30"
        )}
        data-testid={`button-upvote-agreement-${agreement.id}`}
      >
        <ChevronUp className="w-3 h-3" /> {agreement.upvotes}
      </button>
    </div>
  );
}

export default function DebateRoom() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const debateId = Number(id);
  const { user, isSignedIn, isLoaded } = useSession();
  const { triggerRep } = useAppContext();

  const { data: debate, isLoading } = useGetDebate(debateId, {
    query: { enabled: !!debateId, queryKey: getGetDebateQueryKey(debateId), refetchInterval: 15_000 },
  });

  const outcomeQuery = useQuery({
    queryKey: ["debate-outcome", debateId],
    queryFn: () =>
      fetch(getApiUrl(`/api/debates/${debateId}/outcome`))
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    enabled: !!debateId,
    retry: false,
    // Poll every 30 s so admin-published results appear without a manual refresh
    refetchInterval: 30_000,
  });

  const commentsQuery = useQuery({
    queryKey: ["debate-comments", debateId],
    queryFn: async () => {
      const token = await getToken();
      const response = await fetch(getApiUrl(`/api/debates/${debateId}/comments`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error("Could not load debate arguments");
      return response.json();
    },
    enabled: !!debateId,
    refetchInterval: 10_000,
  });

  const outcome = outcomeQuery.data ?? null;

  const voteDebate = useVoteDebate();
  const [userVote, setUserVote] = useState<"support" | "against" | null>(null);
  const [voteInitialized, setVoteInitialized] = useState(false);
  const [support, setSupport] = useState<number | null>(null);
  const [against, setAgainst] = useState<number | null>(null);
  const voteSubmissionRef = useRef(false);
  const myVoteQueryKey = [...getGetMyDebateVoteQueryKey(debateId), user?.id ?? "anonymous"] as const;

  const { data: myVoteData, isLoading: myVoteLoading } = useGetMyDebateVote(debateId, {
    query: {
      enabled: !!debateId && isLoaded && isSignedIn,
      queryKey: myVoteQueryKey,
    },
  });

  useEffect(() => {
    setUserVote(null);
    setVoteInitialized(false);
    setArgSide("support");
    setSideLocked(false);
    voteSubmissionRef.current = false;
  }, [debateId, user?.id]);

  useEffect(() => {
    if (!voteInitialized && myVoteData !== undefined) {
      if (myVoteData.side === "support" || myVoteData.side === "against") {
        setUserVote(myVoteData.side);
        setArgSide(myVoteData.side);
        setSideLocked(true);
      }
      setVoteInitialized(true);
    }
  }, [myVoteData, voteInitialized]);

  useEffect(() => {
    setSupport(null);
    setAgainst(null);
  }, [debateId]);

  const [newArg, setNewArg] = useState("");
  const [argSide, setArgSide] = useState<"support" | "against">("support");
  const [sideLocked, setSideLocked] = useState(false);
  const [sourceInput, setSourceInput] = useState("");
  const [sourceLabelInput, setSourceLabelInput] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [showSourceField, setShowSourceField] = useState(false);
  const [isOxford, setIsOxford] = useState(false);
  const [oxfordRound, setOxfordRound] = useState<OxfordRound>("Opening Statement");
  const [supportArgs, setSupportArgs] = useState<Arg[]>([]);
  const [againstArgs, setAgainstArgs] = useState<Arg[]>([]);
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const [newAgreement, setNewAgreement] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const [showAttackWarn, setShowAttackWarn] = useState(false);
  const [rulesAcked, setRulesAcked] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [hasLeftDebate, setHasLeftDebate] = useState(false);
  const [isPostingArg, setIsPostingArg] = useState(false);
  const pendingVoteCelebrationKey = `treffin_pending_first_vote_${user?.id ?? "guest"}`;
  const [celebrationDebateId, setCelebrationDebateId] = useState<number | null>(null);
  const [showOutcomeCelebration, setShowOutcomeCelebration] = useState(false);
  const voteAnnotationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outcomeCelebrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousOutcomeRef = useRef<{ debateId: number; outcome: typeof outcome } | null>(null);
  const [viewerCount, setViewerCount] = useState<number>(debate?.viewerCount ?? 0);
  const pingClientId = useRef<string>(Math.random().toString(36).slice(2));

  useEffect(() => {
    const pendingDebateId = Number(sessionStorage.getItem(pendingVoteCelebrationKey));
    setCelebrationDebateId(pendingDebateId === debateId ? debateId : null);
  }, [debateId, pendingVoteCelebrationKey]);


  // Keep viewerCount in sync with the debate object (updated by GET /debates/:id refetch)
  useEffect(() => {
    if ((debate as any)?.viewerCount !== undefined) {
      setViewerCount((debate as any).viewerCount as number);
    }
  }, [(debate as any)?.viewerCount]);

  // Ping viewer-count endpoint every 30 s while page is mounted
  useEffect(() => {
    if (!debateId) return;
    const ping = () =>
      fetch(getApiUrl(`/api/debates/${debateId}/ping`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: pingClientId.current }),
      })
        .then((r) => r.ok ? r.json() : null)
        .then((d) => { if (d?.viewerCount !== undefined) setViewerCount(d.viewerCount as number); })
        .catch(() => undefined);
    void ping();
    const iv = setInterval(() => { void ping(); }, 30_000);
    return () => clearInterval(iv);
  }, [debateId]);

  const rulesAckQuery = useQuery({
    queryKey: ["debate-rules-ack"],
    queryFn: async () => {
      const token = await getToken();
      return fetch(getApiUrl("/api/debates/rules-ack"), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((r) => (r.ok ? r.json() : { acknowledged: false }))
        .catch(() => ({ acknowledged: false }));
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (rulesAckQuery.data?.acknowledged) {
      setRulesAcked(true);
    }
  }, [rulesAckQuery.data]);

  const { data: agreementsData, isLoading: agreementsLoading } = useGetDebateAgreements(debateId, {
    query: { enabled: !!debateId, queryKey: getGetDebateAgreementsQueryKey(debateId) },
  });
  const agreements = agreementsData?.agreements ?? [];
  const canPost = agreementsData?.canPost ?? false;

  // Axis winner declarations — only meaningful for elegance-battle debates (mathProblemId set)
  const axisWinnersQuery = useQuery({
    queryKey: ["debate-axis-winners", debateId],
    queryFn: () =>
      fetch(getApiUrl(`/api/debates/${debateId}/axis-winners`))
        .then((r) => r.ok ? r.json() : [])
        .catch(() => []),
    enabled: !!debateId && !!(debate as any)?.mathProblemId,
    refetchInterval: 30_000,
  });
  const axisWinners: { id: number; axis: string; declaration: string }[] = axisWinnersQuery.data ?? [];

  const createAgreement = useCreateDebateAgreement();
  const upvoteAgreement = useUpvoteDebateAgreement();

  useEffect(() => {
    const all = commentsQuery.data as any[] | undefined;
    if (all && all.length > 0) {
      // Build a map of parentCommentId → replies
      const replyMap = new Map<number, Arg[]>();
      all.filter((c) => c.parentCommentId).forEach((c) => {
        const reply = commentToArg(c, debateId);
        if (!replyMap.has(c.parentCommentId)) replyMap.set(c.parentCommentId, []);
        replyMap.get(c.parentCommentId)!.push(reply);
      });
      // Top-level args only (no parentCommentId), with nested replies attached.
      // Pinned comments (set by the creator-moderator) surface first within their side.
      const topLevel = all.filter((c) => !c.parentCommentId);
      const bySide = (side: string) =>
        topLevel
          .filter((c) => c.side === side)
          .map((c) => ({ ...commentToArg(c, debateId), replies: replyMap.get(c.id) ?? [] }))
          .sort((a, b) => {
            if (b.isPinned !== a.isPinned) return (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0);
            if (b.isFeatured !== a.isFeatured) return (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0);
            return 0;
          });
      setSupportArgs(bySide("support"));
      setAgainstArgs(bySide("against"));
    } else if (all) {
      setSupportArgs([]);
      setAgainstArgs([]);
    }
  }, [commentsQuery.data, debateId]);

  // Celebrate only when an outcome is published while this debate is open. An
  // already-published outcome is established as the baseline on initial load.
  useEffect(() => {
    if (!outcomeQuery.isFetched) return;
    const previous = previousOutcomeRef.current;
    if (!previous || previous.debateId !== debateId) {
      previousOutcomeRef.current = { debateId, outcome };
      return;
    }
    if (outcome && !previous.outcome) {
      const isWinner = !!userVote && outcome.winningSide === userVote;
      const isDraw = outcome.winningSide === "draw";
      if (isWinner || isDraw) {
        if (outcomeCelebrationTimerRef.current) clearTimeout(outcomeCelebrationTimerRef.current);
        outcomeCelebrationTimerRef.current = setTimeout(() => {
          outcomeCelebrationTimerRef.current = null;
          setShowOutcomeCelebration(true);
        }, 500);
      }
    }
    previousOutcomeRef.current = { debateId, outcome };
  }, [debateId, outcome, outcomeQuery.isFetched, userVote]);

  const isCreator = !!user && !!debate && debate.creatorUserId === user.id;
  const creatorIsModerator = !!debate?.creatorIsModerator;
  const winnerAuthority = (debate?.winnerAuthority ?? "creator") as "creator" | "admin";
  const winnerStatus = debate?.winnerStatus ?? "undecided";
  const canModerate = isCreator && creatorIsModerator;

  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [isReporting, setIsReporting] = useState(false);
  const [showEndConfirmModal, setShowEndConfirmModal] = useState(false);
  const [showVoteAnnotationPrompt, setShowVoteAnnotationPrompt] = useState(false);
  const [voteAnnotationText, setVoteAnnotationText] = useState("");
  const [showAxisModal, setShowAxisModal] = useState(false);
  const [axisDeclareAxis, setAxisDeclareAxis] = useState("overall");
  const [axisDeclareText, setAxisDeclareText] = useState("");
  const [isDeclaringAxis, setIsDeclaringAxis] = useState(false);
  const [modDashOpen, setModDashOpen] = useState(false);

  useEffect(() => {
    setShowOutcomeCelebration(false);
    setShowVoteAnnotationPrompt(false);
    previousOutcomeRef.current = null;
    if (voteAnnotationTimerRef.current) clearTimeout(voteAnnotationTimerRef.current);
    if (outcomeCelebrationTimerRef.current) clearTimeout(outcomeCelebrationTimerRef.current);
    voteAnnotationTimerRef.current = null;
    outcomeCelebrationTimerRef.current = null;
  }, [debateId]);

  useEffect(() => () => {
    if (voteAnnotationTimerRef.current) clearTimeout(voteAnnotationTimerRef.current);
    if (outcomeCelebrationTimerRef.current) clearTimeout(outcomeCelebrationTimerRef.current);
  }, []);

  // Mod log — only fetched when the creator-moderator panel is open
  const modLogQuery = useQuery({
    queryKey: ["debate-mod-log", debateId],
    queryFn: async () => {
      const token = await getToken();
      return fetch(getApiUrl(`/api/debates/${debateId}/mod-log`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((r) => r.ok ? r.json() : [])
        .catch(() => []);
    },
    enabled: !!debateId && canModerate && modDashOpen,
    refetchInterval: modDashOpen ? 15_000 : false,
  });
  const modLogEntries: Array<{ id: number; action: string; targetType: string; targetId: number; reason: string | null; createdAt: string }> = modLogQuery.data ?? [];

  const [removeCommentTarget, setRemoveCommentTarget] = useState<number | null>(null);
  const [removeCommentReason, setRemoveCommentReason] = useState("");
  const [isRemovingComment, setIsRemovingComment] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [showDeclareModal, setShowDeclareModal] = useState(false);
  const [declareSide, setDeclareSide] = useState<"support" | "against" | "draw">("support");
  const [declareJustification, setDeclareJustification] = useState("");
  const [isDeclaring, setIsDeclaring] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  const authedFetch = async (url: string, init?: RequestInit) => {
    const token = await getToken();
    return fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
  };

  const handlePinComment = async (commentId: number, pin: boolean) => {
    try {
      const res = await authedFetch(getApiUrl(`/api/debates/${debateId}/comments/${commentId}/pin`), {
        method: "PATCH",
        body: JSON.stringify({ isPinned: pin }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: err.error ?? "Could not update pin", variant: "destructive" }); return;
      }
      await queryClient.invalidateQueries({ queryKey: ["debate-comments", debateId] });
      toast({ title: pin ? "Comment pinned" : "Comment unpinned" });
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    }
  };

  const handleFeatureComment = async (commentId: number, feature: boolean) => {
    try {
      const res = await authedFetch(getApiUrl(`/api/debates/${debateId}/comments/${commentId}/feature`), {
        method: "PATCH",
        body: JSON.stringify({ isFeatured: feature }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: err.error ?? "Could not update feature", variant: "destructive" }); return;
      }
      await queryClient.invalidateQueries({ queryKey: ["debate-comments", debateId] });
      toast({ title: feature ? "Argument featured ⭐" : "Argument unfeatured" });
    } catch { toast({ title: "Network error", variant: "destructive" }); }
  };

  const handleLockReplies = async (commentId: number, lock: boolean) => {
    try {
      const res = await authedFetch(getApiUrl(`/api/debates/${debateId}/comments/${commentId}/lock-replies`), {
        method: "PATCH",
        body: JSON.stringify({ repliesLocked: lock }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: err.error ?? "Could not lock replies", variant: "destructive" }); return;
      }
      await queryClient.invalidateQueries({ queryKey: ["debate-comments", debateId] });
      toast({ title: lock ? "Replies locked 🔒" : "Replies unlocked 🔓" });
    } catch { toast({ title: "Network error", variant: "destructive" }); }
  };

  const handleDeclareAxisWinner = async () => {
    if (!axisDeclareText.trim() || isDeclaringAxis) return;
    setIsDeclaringAxis(true);
    try {
      const res = await authedFetch(getApiUrl(`/api/debates/${debateId}/axis-winners`), {
        method: "POST",
        body: JSON.stringify({ axis: axisDeclareAxis, declaration: axisDeclareText.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: err.error ?? "Could not declare axis winner", variant: "destructive" });
      } else {
        await queryClient.invalidateQueries({ queryKey: ["debate-axis-winners", debateId] });
        toast({ title: "Axis winner declared!" });
        setShowAxisModal(false); setAxisDeclareText(""); setAxisDeclareAxis("overall");
      }
    } catch { toast({ title: "Network error", variant: "destructive" }); }
    finally { setIsDeclaringAxis(false); }
  };

  const handleSubmitVoteAnnotation = async () => {
    const trimmed = voteAnnotationText.trim();
    setShowVoteAnnotationPrompt(false);
    if (!trimmed || !userVote) return;
    try {
      const token = await getToken();
      await fetch(getApiUrl(`/api/debates/${debateId}/vote`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ vote: userVote, annotation: trimmed }),
      });
    } catch { /* non-blocking */ }
    setVoteAnnotationText("");
  };

  const handleRemoveComment = (commentId: number) => {
    setRemoveCommentTarget(commentId);
    setRemoveCommentReason("");
  };

  const handleConfirmRemoveComment = async () => {
    if (!removeCommentTarget || !removeCommentReason.trim() || isRemovingComment) return;
    setIsRemovingComment(true);
    try {
      const res = await authedFetch(getApiUrl(`/api/debates/${debateId}/comments/${removeCommentTarget}/creator-remove`), {
        method: "PATCH",
        body: JSON.stringify({ reason: removeCommentReason.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: err.error ?? "Could not remove comment", variant: "destructive" }); return;
      }
      await queryClient.invalidateQueries({ queryKey: ["debate-comments", debateId] });
      toast({ title: "Comment removed" });
      setRemoveCommentTarget(null);
      setRemoveCommentReason("");
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setIsRemovingComment(false);
    }
  };

  const handleEndDebateEarly = () => {
    if (isEnding) return;
    setShowEndConfirmModal(true);
  };

  const handleConfirmEndDebate = async () => {
    setIsEnding(true);
    setShowEndConfirmModal(false);
    try {
      const res = await authedFetch(getApiUrl(`/api/debates/${debateId}/end`), { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: err.error ?? "Could not end debate", variant: "destructive" }); return;
      }
      await queryClient.invalidateQueries({ queryKey: getGetDebateQueryKey(debateId) });
      toast({ title: "Debate ended early" });
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setIsEnding(false);
    }
  };

  const openEditModal = () => {
    if (!debate) return;
    setEditTitle(debate.title);
    setEditDescription(debate.description ?? "");
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim() || isSavingEdit) return;
    setIsSavingEdit(true);
    try {
      const res = await authedFetch(getApiUrl(`/api/debates/${debateId}`), {
        method: "PATCH",
        body: JSON.stringify({ title: editTitle.trim(), description: editDescription.trim() || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: err.error ?? "Could not save changes", variant: "destructive" }); return;
      }
      await queryClient.invalidateQueries({ queryKey: getGetDebateQueryKey(debateId) });
      setShowEditModal(false);
      toast({ title: "Debate updated" });
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeclareWinner = async () => {
    if (!declareJustification.trim() || isDeclaring) return;
    setIsDeclaring(true);
    try {
      const res = await authedFetch(getApiUrl(`/api/debates/${debateId}/declare-winner`), {
        method: "POST",
        body: JSON.stringify({ winningSide: declareSide, justification: declareJustification.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: err.error ?? "Could not declare a winner", variant: "destructive" }); return;
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["debate-outcome", debateId] }),
        queryClient.invalidateQueries({ queryKey: getGetDebateQueryKey(debateId) }),
      ]);
      setShowDeclareModal(false);
      setDeclareJustification("");
      toast({ title: "Winner declared" });
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setIsDeclaring(false);
    }
  };

  const handleReportCreator = async () => {
    if (!reportReason.trim() || isReporting) return;
    setIsReporting(true);
    try {
      const res = await authedFetch(getApiUrl(`/api/debates/${debateId}/report-creator`), {
        method: "POST",
        body: JSON.stringify({ reason: reportReason.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: err.error ?? "Could not submit report", variant: "destructive" }); return;
      }
      setShowReportModal(false);
      setReportReason("");
      toast({ title: "Report submitted", description: "Our admin team will review this debate's creator." });
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setIsReporting(false);
    }
  };

  const topSupportArg =
    outcome?.topSupportCommentId
      ? supportArgs.find((a) => a.id === outcome.topSupportCommentId) ?? supportArgs[0]
      : supportArgs[0];
  const topAgainstArg =
    outcome?.topOppositionCommentId
      ? againstArgs.find((a) => a.id === outcome.topOppositionCommentId) ?? againstArgs[0]
      : againstArgs[0];

  const handleVote = (vote: "support" | "against") => {
    if (userVote || voteSubmissionRef.current) return;
    if (!debate?.isLive) {
      toast({ title: "Voting has closed", description: "This debate is waiting for its final outcome.", variant: "destructive" });
      return;
    }
    if (!user) {
      toast({ title: "Sign in to vote", description: "Create a free account to take a stance and join the debate.", variant: "destructive" });
      setTimeout(() => setLocation("/sign-in"), 1200);
      return;
    }
    voteSubmissionRef.current = true;
    voteDebate.mutate(
      { id: debateId, data: { vote } },
      {
        onSuccess: (d) => {
          voteSubmissionRef.current = false;
          setUserVote(vote);
          setSupport(d.supportPercent);
          setAgainst(d.againstPercent);
          queryClient.setQueryData(myVoteQueryKey, { side: vote });
          setHasLeftDebate(false);
          queryClient.invalidateQueries({ queryKey: getGetDebateQueryKey(debateId) });
          queryClient.invalidateQueries({ queryKey: getGetDebateAgreementsQueryKey(debateId) });
          toast({ title: `Voted ${vote === "support" ? "in support" : "against"}!` });
          if (voteAnnotationTimerRef.current) clearTimeout(voteAnnotationTimerRef.current);
          voteAnnotationTimerRef.current = setTimeout(() => {
            voteAnnotationTimerRef.current = null;
            setShowVoteAnnotationPrompt(true);
          }, 600);
          // Key is per-user so multiple accounts on the same device each
          // get their own first-vote celebration (not just whichever user
          // happened to vote first on this device).
          const voteKey = `treffin_first_vote_${user?.id ?? "guest"}`;
          const isFirstVote = !localStorage.getItem(voteKey);
          if (isFirstVote) {
            localStorage.setItem(voteKey, "1");
            sessionStorage.setItem(pendingVoteCelebrationKey, String(debateId));
            setCelebrationDebateId(debateId);
            try {
              triggerRep(10, "vote");
            } catch (error) {
              console.warn("Could not refresh reputation after first vote", error);
            }
          }
        },
        onError: (err: unknown) => {
          voteSubmissionRef.current = false;
          const status = (err as { status?: number })?.status;
          if (status === 429) {
            toast({ title: "Slow down", description: "You're voting too fast. Please wait a moment and try again.", variant: "destructive" });
          } else if (status === 401) {
            toast({ title: "Sign in to vote", description: "Please sign in to take a stance.", variant: "destructive" });
            setTimeout(() => setLocation("/sign-in"), 1200);
          } else {
            toast({ title: "Couldn't record your vote", description: "Something went wrong. Please try again.", variant: "destructive" });
          }
        },
      }
    );
  };

  const handleAddSource = () => {
    if (!sourceInput.trim()) return;
    let parsed: URL;
    try { parsed = new URL(sourceInput.trim()); } catch {
      toast({ title: "Invalid source URL", description: "Enter a complete http:// or https:// URL.", variant: "destructive" }); return;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      toast({ title: "Invalid source URL", description: "Only http:// and https:// links are allowed.", variant: "destructive" }); return;
    }
    if (sources.length >= 10) {
      toast({ title: "Source limit reached", description: "You can attach up to 10 sources.", variant: "destructive" }); return;
    }
    setSources(p => [...p, { url: parsed.toString(), label: (sourceLabelInput.trim() || parsed.hostname).slice(0, 160) }]);
    setSourceInput(""); setSourceLabelInput(""); setShowSourceField(false);
  };

  const handlePostArgument = async () => {
    if (!newArg.trim() || isPostingArg) return;
    if (!isSignedIn) {
      toast({ title: "Sign in required", description: "Please sign in to post an argument.", variant: "destructive" });
      setLocation("/sign-in");
      return;
    }
    if (sideLocked && userVote && argSide !== userVote) {
      toast({ title: "Side mismatch", description: `You voted ${userVote} — you can only post ${userVote} arguments.`, variant: "destructive" });
      setArgSide(userVote);
      return;
    }
    const wc = newArg.trim().split(/\s+/).filter(Boolean).length;
    if (wc < 30) {
      toast({ title: "Argument too short", description: "Please write at least 30 words to keep debates substantive.", variant: "destructive" }); return;
    }
    if (detectPersonalAttackFrontend(newArg)) {
      setShowAttackWarn(true); return;
    }
    if (!rulesAcked && !showRulesModal) {
      setShowRulesModal(true); return;
    }
    setIsPostingArg(true);
    try {
      const side = argSide;
      const token = await getToken();
      const res = await fetch(getApiUrl(`/api/debates/${debateId}/comments`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ content: newArg.trim(), side, sources: sources.length > 0 ? JSON.stringify(sources) : undefined, authorName: user?.fullName || user?.firstName || "Anonymous", argType: isOxford && oxfordRound === "Closing Argument" ? "closing" : undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to post" }));
        toast({ title: err.error ?? "Could not post argument", variant: "destructive" }); return;
      }
      const created = await res.json();
      const newEntry: Arg = { id: created.id ?? Date.now(), author: "You", text: newArg.trim(), likes: 0, time: "Just now", sources };
      if (side === "support") setSupportArgs(p => [newEntry, ...p]);
      else setAgainstArgs(p => [newEntry, ...p]);
      const argKey = `treffin_debate_arg_${debateId}`;
      const isFirstArg = !localStorage.getItem(argKey);
      if (isFirstArg) { localStorage.setItem(argKey, "1"); triggerRep(15, "debate"); }
      if (wc >= 100) triggerRep(5, "long_comment");
      setNewArg(""); setSources([]); setWordCount(0); setShowAttackWarn(false);
      toast({ title: "Argument posted!" + (isFirstArg ? " +15 rep" : ""), description: `Your ${isOxford ? oxfordRound : side} argument is live.` });
    } catch {
      toast({ title: "Network error", description: "Could not post your argument. Please try again.", variant: "destructive" });
    } finally {
      setIsPostingArg(false);
    }
  };

  const handleAcknowledgeRules = async () => {
    try {
      const token = await getToken();
      const response = await fetch(getApiUrl("/api/debates/rules-ack"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Could not save acknowledgment" }));
        throw new Error(error.error ?? "Could not save acknowledgment");
      }
      setRulesAcked(true);
      setShowRulesModal(false);
      handlePostArgument();
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Could not save acknowledgment", variant: "destructive" });
    }
  };

  const handleLeaveDebate = async () => {
    try {
      const token = await getToken();
      const res = await fetch(getApiUrl(`/api/debates/${debateId}/leave`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to leave" }));
        toast({ title: err.error ?? "Could not leave debate", variant: "destructive" }); return;
      }
      setHasLeftDebate(true);
      setUserVote(null);
      setArgSide("support");
      setSideLocked(false);
      setNewAgreement("");
      queryClient.setQueryData(myVoteQueryKey, { side: null });
      queryClient.invalidateQueries({ queryKey: getGetDebateQueryKey(debateId) });
      queryClient.invalidateQueries({ queryKey: getGetDebateAgreementsQueryKey(debateId) });
      toast({ title: "Left debate", description: "You've opted out. Your arguments remain visible." });
    } catch {
      toast({ title: "Could not leave debate", variant: "destructive" });
    }
  };

  const displaySupport = support ?? debate?.supportPercent ?? 50;
  const displayAgainst = against ?? debate?.againstPercent ?? 50;

  type AgreementsCache = { agreements: DebateAgreement[]; canPost: boolean };

  const handlePostAgreement = () => {
    if (!newAgreement.trim() || createAgreement.isPending) return;
    const textToPost = newAgreement.trim();
    const tempId = -Date.now();
    const tempAgreement: DebateAgreement & { authorAvatarUrl: string | null; isOwnAgreement: boolean } = {
      id: tempId,
      debateId,
      authorId: user?.id ?? "",
      authorName: user?.fullName || user?.firstName || "You",
      authorAvatarUrl: user?.imageUrl ?? null,
      text: textToPost,
      upvotes: 0,
      hasUpvoted: false,
      isOwnAgreement: true,
      createdAt: new Date().toISOString(),
    };

    // Optimistic insert before server round-trip
    queryClient.setQueryData(
      getGetDebateAgreementsQueryKey(debateId),
      (old: AgreementsCache | undefined) => ({
        canPost: old?.canPost ?? true,
        agreements: [tempAgreement, ...(old?.agreements ?? [])],
      })
    );
    setNewAgreement("");

    createAgreement.mutate(
      { id: debateId, data: { text: textToPost } },
      {
        onSuccess: (created) => {
          queryClient.setQueryData(
            getGetDebateAgreementsQueryKey(debateId),
            (old: AgreementsCache | undefined) => ({
              canPost: old?.canPost ?? true,
              agreements: (old?.agreements ?? []).map((a) => (a.id === tempId ? created : a)),
            })
          );
          toast({ title: "Agreement added!", description: "Your point of agreement is now visible to everyone." });
        },
        onError: () => {
          // Rollback optimistic insert and restore the text
          queryClient.setQueryData(
            getGetDebateAgreementsQueryKey(debateId),
            (old: AgreementsCache | undefined) => ({
              canPost: old?.canPost ?? true,
              agreements: (old?.agreements ?? []).filter((a) => a.id !== tempId),
            })
          );
          setNewAgreement(textToPost);
          toast({ title: "Could not post agreement", description: "Please try again.", variant: "destructive" });
        },
      }
    );
  };

  const handleUpvoteAgreement = (agreementId: number) => {
    queryClient.setQueryData(
      getGetDebateAgreementsQueryKey(debateId),
      (old: AgreementsCache | undefined) => ({
        canPost: old?.canPost ?? false,
        agreements: (old?.agreements ?? []).map((a) =>
          a.id === agreementId
            ? { ...a, upvotes: a.hasUpvoted ? a.upvotes - 1 : a.upvotes + 1, hasUpvoted: !a.hasUpvoted }
            : a
        ),
      })
    );
    upvoteAgreement.mutate(
      { id: agreementId },
      {
        onSuccess: (updated) => {
          queryClient.setQueryData(
            getGetDebateAgreementsQueryKey(debateId),
            (old: AgreementsCache | undefined) => ({
              canPost: old?.canPost ?? false,
              agreements: (old?.agreements ?? []).map((a) => (a.id === agreementId ? updated : a)),
            })
          );
        },
        onError: () => {
          queryClient.invalidateQueries({ queryKey: getGetDebateAgreementsQueryKey(debateId) });
        },
      }
    );
  };

  const handleExportPDF = async () => {
    if (!debate || isPdfExporting) return;
    setIsPdfExporting(true);
    try {
      const [commentsRes, agreementsRes] = await Promise.allSettled([
        fetch(getApiUrl(`/api/debates/${debateId}/comments`)).then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch(getApiUrl(`/api/debates/${debateId}/agreements`))
          .then((r) => (r.ok ? r.json() : { agreements: [] }))
          .catch(() => ({ agreements: [] })),
      ]);

      type FreshComment = { id?: number; side: string; authorName: string; content: string; createdAt: string };
      const freshComments: FreshComment[] =
        commentsRes.status === "fulfilled" ? (commentsRes.value as FreshComment[]) : [];
      const freshAgreements: string[] =
        agreementsRes.status === "fulfilled"
          ? ((agreementsRes.value as { agreements?: Array<{ text?: string }> })?.agreements ?? [])
              .map((a) => a.text ?? "")
              .filter(Boolean)
          : agreementsData?.agreements.map((a) => a.text) ?? [];

      const toExportArg = (c: FreshComment) => ({
        author: c.authorName,
        text: c.content,
        time: timeAgo(c.createdAt),
      });
      const fetchedArgs = commentsRes.status === "fulfilled" && freshComments.length > 0;
      const freshSupport = freshComments.filter((c) => c.side === "support").map(toExportArg);
      const freshAgainst = freshComments.filter((c) => c.side === "against").map(toExportArg);

      exportDebatePDF({
        title: debate.title,
        description: debate.description,
        category: debate.category,
        supportPercent: displaySupport,
        againstPercent: displayAgainst,
        participantCount: debate.participantCount,
        supportArgs: (fetchedArgs ? freshSupport : supportArgs).map((a) => ({
          author: a.author,
          text: a.text,
          time: a.time,
        })),
        againstArgs: (fetchedArgs ? freshAgainst : againstArgs).map((a) => ({
          author: a.author,
          text: a.text,
          time: a.time,
        })),
        agreements: freshAgreements,
      });

      if (!fetchedArgs) {
        toast({
          title: "PDF exported with partial data",
          description: "Arguments may be incomplete — could not fetch the latest from the server.",
          variant: "destructive",
        });
      } else {
        toast({ title: "PDF exported!", description: "Your debate has been saved as a PDF." });
      }
    } catch {
      toast({ title: "Export failed", description: "Could not generate the PDF. Please try again.", variant: "destructive" });
    } finally {
      setIsPdfExporting(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 max-w-3xl">
        <button onClick={() => setLocation("/debates")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit" data-testid="button-back-debates">
          <ArrowLeft className="w-4 h-4" /> Back to Debates
        </button>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        ) : debate ? (
          <>
            {/* Debate Rules Acknowledgment Modal */}
            {showRulesModal && (
              <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full flex flex-col gap-4 shadow-2xl">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
                    <h2 className="text-base font-bold">Debate Community Rules</h2>
                  </div>
                  <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                    <div className="flex items-start gap-2"><span className="text-primary font-bold shrink-0">1.</span><span>Stay on topic — arguments must address the debate motion.</span></div>
                    <div className="flex items-start gap-2"><span className="text-primary font-bold shrink-0">2.</span><span>Minimum 30 words — make your argument substantive and thoughtful.</span></div>
                    <div className="flex items-start gap-2"><span className="text-primary font-bold shrink-0">3.</span><span>No personal attacks — critique ideas, not people. Violations are flagged automatically.</span></div>
                    <div className="flex items-start gap-2"><span className="text-primary font-bold shrink-0">4.</span><span>Cite sources — link evidence to strengthen your argument and earn quality points.</span></div>
                    <div className="flex items-start gap-2"><span className="text-primary font-bold shrink-0">5.</span><span>Be constructive — closing arguments should synthesize, not introduce new claims.</span></div>
                  </div>
                  <div className="flex gap-2 border-t border-border pt-3">
                    <button onClick={() => setShowRulesModal(false)} className="flex-1 text-sm text-muted-foreground border border-border py-2 rounded-full hover:bg-muted/50 transition-colors">Cancel</button>
                    <button onClick={handleAcknowledgeRules} className="flex-1 bg-primary text-white font-semibold py-2 rounded-full text-sm hover:bg-primary/90 transition-colors">I Agree — Post Argument</button>
                  </div>
                </div>
              </div>
            )}

            {/* Header */}
            <div className="bg-card border border-border rounded-xl p-6 flex flex-col gap-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded uppercase tracking-widest">{debate.category}</span>
                {debate.isLive && !outcome && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-red-400 uppercase">
                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" /> Live Now
                  </span>
                )}
                {!debate.isLive && (
                  <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded uppercase tracking-wider">Closed</span>
                )}
                {(debate as { endedEarly?: boolean }).endedEarly && (
                  <span className="text-[10px] font-bold text-blue-400 bg-blue-400/10 border border-blue-400/20 px-2 py-0.5 rounded-full uppercase tracking-wider">Ended Early</span>
                )}
                {isCreator && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    <Star className="w-2.5 h-2.5" /> Creator
                  </span>
                )}
                {canModerate && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    <Gavel className="w-2.5 h-2.5" /> Moderator
                  </span>
                )}
                <div className="flex items-center gap-3 ml-auto">
                  {debate.isLive && viewerCount > 0 && (
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-rose-400 bg-rose-400/10 border border-rose-400/20 px-2 py-0.5 rounded-full">
                      👁 {viewerCount} watching
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="w-3.5 h-3.5" /> {formatNumber(debate.participantCount)} participants
                  </div>
                  {(debate as { healthScore?: number }).healthScore !== undefined && (
                    <div className={cn("flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border",
                      ((debate as { healthScore?: number }).healthScore ?? 100) >= 70 ? "text-green-400 bg-green-400/10 border-green-400/20"
                      : ((debate as { healthScore?: number }).healthScore ?? 100) >= 40 ? "text-yellow-400 bg-yellow-400/10 border-yellow-400/20"
                      : "text-red-400 bg-red-400/10 border-red-400/20"
                    )}>
                      <BarChart2 className="w-2.5 h-2.5" /> {(debate as { healthScore?: number }).healthScore ?? 100}
                    </div>
                  )}
                  <button
                    onClick={handleExportPDF}
                    disabled={isPdfExporting}
                    data-testid="button-export-pdf"
                    className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-border hover:border-primary/40 px-2.5 py-1 rounded-full transition-colors disabled:opacity-50"
                  >
                    {isPdfExporting
                      ? <><Loader2 className="w-3 h-3 animate-spin" /> Exporting…</>
                      : <><FileDown className="w-3 h-3" /> Export PDF</>
                    }
                  </button>
                </div>
              </div>

              <LifecycleBar
                isLive={debate.isLive}
                endedAt={(debate as { endedAt?: string | null }).endedAt}
                hasOutcome={!!outcome}
              />

              <h1 className="text-xl sm:text-2xl font-bold leading-tight">{debate.title}</h1>
              {debate.description && <p className="text-sm text-muted-foreground">{debate.description}</p>}

              {/* Elegance Battle explainer — shown only for math showdown debates */}
              {!!(debate as any).mathProblemId && (
                <div className="flex flex-col gap-3 p-4 rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-500/5 to-indigo-500/5">
                  <div className="flex items-center gap-2">
                    <span className="text-base">✦</span>
                    <p className="text-xs font-bold text-violet-400 uppercase tracking-wider">Elegance Battle</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    This isn't a regular debate — it's a <strong className="text-foreground">mathematical showdown</strong>. Two or more approaches to the same problem compete not on who is "right" (all correct solutions are correct), but on whose approach is more <strong className="text-foreground">elegant, clear, rigorous, or efficient</strong>.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { icon: "✨", axis: "Elegant", desc: "Minimal steps, beautiful insight" },
                      { icon: "🔍", axis: "Clear", desc: "Easy to follow, well explained" },
                      { icon: "🛡", axis: "Rigorous", desc: "Airtight logic, no gaps" },
                      { icon: "⚡", axis: "Efficient", desc: "Fastest path to the answer" },
                    ].map(({ icon, axis, desc }) => (
                      <div key={axis} className="flex items-start gap-2 p-2.5 rounded-xl bg-violet-500/5 border border-violet-500/15">
                        <span className="text-sm shrink-0">{icon}</span>
                        <div>
                          <p className="text-[11px] font-bold text-foreground">{axis}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Vote for the approach you think excels overall. The moderator can also declare per-axis winners — so an approach can win "most elegant" even if another wins overall.
                  </p>
                </div>
              )}

              {/* ── Moderator / Creator Bar ─────────────────────────────────── */}
              {isCreator && !outcome && (
                <div className="flex flex-col gap-3 p-3.5 rounded-2xl bg-indigo-950/20 border border-l-[3px] border-indigo-500/20 border-l-indigo-500/50">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                      <Shield className="w-3.5 h-3.5 text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-indigo-300 uppercase tracking-wide">Creator Controls</p>
                      <p className="text-[10px] text-muted-foreground">Manage this debate</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {canModerate && (
                      <button onClick={openEditModal} className="flex items-center gap-1.5 text-xs font-medium border border-border hover:border-primary/40 text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-full transition-colors" data-testid="button-edit-debate">
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                    )}
                    {debate.isLive && (
                      <button onClick={handleEndDebateEarly} disabled={isEnding} className="flex items-center gap-1.5 text-xs font-medium border border-rose-500/30 text-rose-400/80 hover:text-rose-400 hover:border-rose-500/50 px-3 py-1.5 rounded-full transition-colors disabled:opacity-50" data-testid="button-end-debate">
                        <Square className="w-3 h-3" /> {isEnding ? "Ending…" : "End Debate Early"}
                      </button>
                    )}
                    {!debate.isLive && winnerAuthority === "creator" && winnerStatus === "undecided" && (
                      <button onClick={() => setShowDeclareModal(true)} className="flex items-center gap-1.5 text-xs font-bold border border-yellow-400/40 bg-yellow-400/5 text-yellow-400 hover:bg-yellow-400/15 px-3 py-1.5 rounded-full transition-colors" data-testid="button-declare-winner">
                        <Trophy className="w-3 h-3" /> Declare Winner
                      </button>
                    )}
                    {canModerate && !!(debate as any).mathProblemId && (
                      <button onClick={() => setShowAxisModal(true)} className="flex items-center gap-1.5 text-xs font-medium border border-amber-400/30 text-amber-400/80 hover:text-amber-400 hover:border-amber-400/50 px-3 py-1.5 rounded-full transition-colors">
                        🏅 Axis Winner
                      </button>
                    )}
                  </div>
                </div>
              )}
              {isCreator && winnerAuthority === "admin" && !outcome && (
                <p className="text-xs text-muted-foreground italic border-t border-border pt-3">
                  You've delegated the winner decision for this debate to the Treffin admin team.
                </p>
              )}
              {isCreator && winnerStatus === "creator_declared" && (
                <p className="text-xs text-muted-foreground italic border-t border-border pt-3">
                  You declared this debate's outcome — admin may review or override it.
                </p>
              )}
              {!isCreator && debate.creatorUserId && (
                <div className="border-t border-border pt-3">
                  <button onClick={() => setShowReportModal(true)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-400 transition-colors" data-testid="button-report-creator">
                    <Flag className="w-3 h-3" /> Report creator for unfairness
                  </button>
                </div>
              )}

              {/* ── Moderation Overview Panel (creator-moderator only) ──── */}
              {canModerate && (() => {
                const allComments = (commentsQuery.data as any[] | undefined) ?? [];
                const topLevel = allComments.filter((c: any) => !c.parentCommentId);
                const flaggedCount = topLevel.filter((c: any) => c.isFlagged && !c.isRemoved).length;
                const removedCount = topLevel.filter((c: any) => c.isRemoved).length;
                const pinnedSupport = topLevel.filter((c: any) => c.side === "support" && c.isPinned).length;
                const pinnedAgainst = topLevel.filter((c: any) => c.side === "against" && c.isPinned).length;
                const supportPct = debate.supportPercent ?? 0;
                const againstPct = debate.againstPercent ?? 0;

                const actionLabel = (action: string) => {
                  switch (action) {
                    case "creator_remove_comment": return "Removed argument";
                    case "freeze_debate": return "Froze debate";
                    case "unfreeze_debate": return "Unfroze debate";
                    default: return action.replace(/_/g, " ");
                  }
                };

                return (
                  <div className="flex flex-col border-t border-border/60 pt-3 mt-1 gap-2">
                    <button
                      className="flex items-center justify-between w-full text-left group"
                      onClick={() => setModDashOpen((p) => !p)}
                      data-testid="button-mod-overview-toggle"
                    >
                      <div className="flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5 text-violet-400" />
                        <span className="text-xs font-bold text-violet-300 uppercase tracking-wide">Moderation Overview</span>
                        {flaggedCount > 0 && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-orange-400 bg-orange-400/10 border border-orange-400/30 px-1.5 py-0.5 rounded-full animate-pulse">
                            <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                            {flaggedCount} flagged
                          </span>
                        )}
                        {removedCount > 0 && (
                          <span className="text-[10px] font-bold text-red-400/70 bg-red-400/8 border border-red-400/20 px-1.5 py-0.5 rounded-full">
                            {removedCount} removed
                          </span>
                        )}
                      </div>
                      {modDashOpen
                        ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                        : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                      }
                    </button>

                    {modDashOpen && (
                      <div className="flex flex-col gap-3 p-3.5 rounded-2xl bg-violet-950/15 border border-violet-500/15">
                        {/* Stats grid */}
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { label: "Flagged", value: flaggedCount, color: "text-orange-400 bg-orange-400/8 border-orange-400/20" },
                            { label: "Removed", value: removedCount, color: "text-red-400 bg-red-400/8 border-red-400/20" },
                            { label: "Pinned (Support)", value: pinnedSupport, color: "text-indigo-400 bg-indigo-400/8 border-indigo-400/20" },
                            { label: "Pinned (Against)", value: pinnedAgainst, color: "text-rose-400 bg-rose-400/8 border-rose-400/20" },
                          ].map(({ label, value, color }) => (
                            <div key={label} className={cn("flex flex-col gap-0.5 p-2.5 rounded-xl border", color)}>
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
                              <span className="text-lg font-black tabular-nums">{value}</span>
                            </div>
                          ))}
                        </div>

                        {/* Vote split */}
                        <div className="flex flex-col gap-1.5">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Vote Split</p>
                          <div className="h-2 w-full bg-muted/30 rounded-full overflow-hidden flex">
                            <div className="h-full bg-indigo-500/70 transition-all duration-500" style={{ width: `${supportPct}%` }} />
                            <div className="h-full bg-rose-500/70 transition-all duration-500" style={{ width: `${againstPct}%` }} />
                          </div>
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span className="text-indigo-400 font-semibold">Support {supportPct}%</span>
                            <span className="text-rose-400 font-semibold">Against {againstPct}%</span>
                          </div>
                        </div>

                        {/* Mod audit log */}
                        <div className="flex flex-col gap-1.5">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Mod Audit Log</p>
                          {modLogQuery.isLoading ? (
                            <p className="text-[11px] text-muted-foreground italic">Loading…</p>
                          ) : modLogEntries.length === 0 ? (
                            <p className="text-[11px] text-muted-foreground italic">No moderation actions yet.</p>
                          ) : (
                            <div className="flex flex-col gap-1 max-h-40 overflow-y-auto pr-1">
                              {modLogEntries.map((entry) => (
                                <div key={entry.id} className="flex flex-col gap-0.5 p-2 rounded-lg bg-muted/15 border border-border/40">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[11px] font-semibold text-foreground/80">{actionLabel(entry.action)}</span>
                                    <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(entry.createdAt)}</span>
                                  </div>
                                  {entry.reason && (
                                    <p className="text-[10px] text-muted-foreground leading-relaxed">{entry.reason}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="flex flex-col gap-2 mt-2">
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-indigo-400">Support {displaySupport}%</span>
                  <span className="text-rose-400">Against {displayAgainst}%</span>
                </div>
                <div className="h-3 w-full bg-muted rounded-full overflow-hidden flex">
                  <div className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all duration-700" style={{ width: `${displaySupport}%` }} />
                  <div className="h-full bg-gradient-to-r from-rose-400 to-rose-600 transition-all duration-700" style={{ width: `${displayAgainst}%` }} />
                </div>
              </div>

              {!outcome && debate.isLive && canModerate && (
                <div className="flex flex-col gap-3 mt-2 p-4 rounded-2xl bg-amber-400/5 border border-amber-500/20">
                  <p className="text-xs font-bold text-amber-400 uppercase tracking-wide">You're the moderator of this debate</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">You've stepped out of the argument to run it fairly. That means you can't vote or post — but you hold real power over how this debate plays out.</p>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { icon: "📌", title: "Pin", desc: "Surface the strongest argument from each side — it appears at the top. Reward quality, not agreement with your own view." },
                      { icon: "🗑", title: "Remove", desc: "Remove replies that are toxic, off-topic, or personal attacks. Remove based on conduct, never because you disagree." },
                      { icon: "🔒", title: "Lock replies", desc: "If a thread turns hostile, lock further replies on that argument. Use it sparingly — only when a thread is genuinely beyond repair." },
                      { icon: "🏁", title: "End early", desc: "Close the debate before the scheduled end if it has run its course or has gone badly off the rails." },
                      { icon: "⚖️", title: "Stay neutral", desc: "Don't hint at your opinion in the comments section or outside the room. You're the chair, not a side." },
                    ].map(({ icon, title, desc }) => (
                      <div key={title} className="flex gap-2.5 p-2.5 rounded-xl bg-amber-400/3 border border-amber-500/10">
                        <span className="text-sm shrink-0 mt-0.5">{icon}</span>
                        <div>
                          <p className="text-[11px] font-bold text-foreground">{title}</p>
                          <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!outcome && debate.isLive && !canModerate && (
                <div className="flex flex-col gap-2 mt-2">
                  {/* Dramatic split-button vote panel */}
                  <div className="relative flex h-[76px] rounded-2xl overflow-hidden border border-border">
                    <button
                      className={cn(
                        "flex-1 flex flex-col items-center justify-center gap-0.5 transition-all duration-300 font-black uppercase tracking-widest text-[11px] group overflow-hidden",
                        userVote === "support"
                          ? "bg-indigo-600/50 text-indigo-200"
                          : userVote === "against"
                          ? "bg-muted/10 text-muted-foreground/30 cursor-not-allowed"
                          : "bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600/25"
                      )}
                      onClick={() => handleVote("support")}
                      disabled={voteDebate.isPending || !!userVote || myVoteLoading}
                      data-testid="button-vote-support"
                    >
                      {userVote === "support"
                        ? <CheckCircle className="w-4 h-4 mb-0.5 fill-current" />
                        : <ThumbsUp className="w-4 h-4 mb-0.5 group-hover:scale-110 transition-transform" />}
                      <span>{userVote === "support" ? "Supporting" : "Support"}</span>
                      <span className="text-[9px] font-normal opacity-60 normal-case tracking-normal tabular-nums">{displaySupport}%</span>
                    </button>
                    <div className="w-px bg-border/60 shrink-0 self-stretch" />
                    <button
                      className={cn(
                        "flex-1 flex flex-col items-center justify-center gap-0.5 transition-all duration-300 font-black uppercase tracking-widest text-[11px] group overflow-hidden",
                        userVote === "against"
                          ? "bg-rose-600/50 text-rose-200"
                          : userVote === "support"
                          ? "bg-muted/10 text-muted-foreground/30 cursor-not-allowed"
                          : "bg-rose-600/10 text-rose-400 hover:bg-rose-600/25"
                      )}
                      onClick={() => handleVote("against")}
                      disabled={voteDebate.isPending || !!userVote || myVoteLoading}
                      data-testid="button-vote-against"
                    >
                      {userVote === "against"
                        ? <CheckCircle className="w-4 h-4 mb-0.5 fill-current" />
                        : <ThumbsDown className="w-4 h-4 mb-0.5 group-hover:scale-110 transition-transform" />}
                      <span>{userVote === "against" ? "Opposing" : "Oppose"}</span>
                      <span className="text-[9px] font-normal opacity-60 normal-case tracking-normal tabular-nums">{displayAgainst}%</span>
                    </button>
                  </div>
                  {userVote && (
                    <p className="text-center text-xs text-muted-foreground">
                      You&apos;ve taken a stance — read the arguments and share yours below.
                    </p>
                  )}
                  {/* Vote annotation — optional "why" prompt shown once after voting */}
                  {showVoteAnnotationPrompt && userVote && (
                    <div className="mt-1 p-3 rounded-xl border border-primary/20 bg-primary/5 flex flex-col gap-2">
                      <p className="text-xs font-semibold">💬 What&apos;s your main reason?</p>
                      <p className="text-[11px] text-muted-foreground">Optional — helps others understand your perspective.</p>
                      <textarea
                        className="w-full text-sm bg-background border border-border rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary/40"
                        rows={2}
                        maxLength={280}
                        placeholder="e.g. The economic data clearly shows…"
                        value={voteAnnotationText}
                        onChange={(e) => setVoteAnnotationText(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <button className="flex-1 py-1.5 text-xs font-semibold bg-primary text-white rounded-full hover:bg-primary/90 transition-colors" onClick={handleSubmitVoteAnnotation}>
                          Save perspective
                        </button>
                        <button className="py-1.5 px-4 text-xs text-muted-foreground border border-border rounded-full hover:bg-muted/50 transition-colors" onClick={() => setShowVoteAnnotationPrompt(false)}>
                          Skip
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {!outcome && !debate.isLive && (
                <div className="mt-2 rounded-xl border border-border bg-muted/20 px-4 py-3 text-center">
                  <p className="text-sm font-semibold text-foreground">Voting is closed</p>
                  <p className="mt-1 text-xs text-muted-foreground">The final outcome has not been published yet.</p>
                </div>
              )}

              {/* Axis winners strip — declared per-dimension outcomes for elegance-battle debates */}
              {axisWinners.length > 0 && (
                <div className="flex flex-col gap-1.5 pt-3 border-t border-border/40">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Declared axis winners</p>
                  <div className="flex flex-wrap gap-2">
                    {axisWinners.map((w) => (
                      <div key={w.id} className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1 rounded-full border" style={{ borderColor: "rgba(251,191,36,0.35)", background: "rgba(251,191,36,0.08)", color: "#fbbf24" }}>
                        🏅 <span className="font-black uppercase">{w.axis}:</span>&nbsp;{w.declaration}
                      </div>
                    ))}
                  </div>
                  {canModerate && (
                    <button className="self-start mt-1 text-[11px] text-amber-400/80 hover:text-amber-400 border border-amber-400/30 hover:border-amber-400/50 px-2.5 py-1 rounded-full transition-colors" onClick={() => setShowAxisModal(true)}>
                      + Declare another axis winner
                    </button>
                  )}
                </div>
              )}
              {canModerate && axisWinners.length === 0 && !!(debate as any).mathProblemId && (
                <div className="pt-3 border-t border-border/40">
                  <button className="text-[11px] font-semibold text-amber-400/80 hover:text-amber-400 border border-amber-400/30 hover:border-amber-400/50 px-3 py-1.5 rounded-full transition-colors" onClick={() => setShowAxisModal(true)}>
                    🏅 Declare axis winner
                  </button>
                </div>
              )}
            </div>

            {/* ── Debate Outcome Hero — full-width premium result card ─── */}
            {!!outcome && (
              <div className="rounded-2xl overflow-hidden border border-white/5 shadow-xl">
                {/* Coloured header */}
                <div className={cn(
                  "flex flex-col gap-3 p-5 sm:p-6",
                  outcome.winningSide === "support"
                    ? "bg-gradient-to-br from-indigo-950 to-indigo-900/50"
                    : outcome.winningSide === "against"
                    ? "bg-gradient-to-br from-rose-950 to-rose-900/50"
                    : "bg-gradient-to-br from-yellow-950 to-yellow-900/50"
                )}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Trophy className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-yellow-400/80">Debate Outcome</span>
                    {(outcome as { decidedBy?: string }).decidedBy === "admin" ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-violet-300 bg-violet-500/20 border border-violet-500/30 px-2 py-0.5 rounded-full uppercase tracking-wide">
                        <ShieldCheck className="w-2.5 h-2.5" /> Admin Adjudicated
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded-full uppercase tracking-wide">
                        <Gavel className="w-2.5 h-2.5" /> Creator Declared
                      </span>
                    )}
                  </div>
                  <div className={cn(
                    "text-3xl sm:text-4xl font-black leading-none tracking-tight",
                    outcome.winningSide === "support" ? "text-indigo-300"
                    : outcome.winningSide === "against" ? "text-rose-300"
                    : "text-yellow-300"
                  )}>
                    {outcome.winningSide === "support" ? "Support Won" : outcome.winningSide === "against" ? "Opposition Won" : "A Draw"}
                  </div>
                  <p className="text-sm text-white/70 leading-relaxed">{outcome.justification}</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    {(outcome as { publishedAt?: string }).publishedAt && (
                      <p className="text-[10px] text-white/40">Decided {new Date((outcome as { publishedAt: string }).publishedAt).toLocaleString()}</p>
                    )}
                    <button
                      className="flex items-center gap-1.5 text-xs font-semibold text-white/60 hover:text-white/90 border border-white/20 hover:border-white/40 px-3 py-1.5 rounded-full transition-colors"
                      onClick={async () => {
                        const url = window.location.href;
                        if (navigator.share) { try { await navigator.share({ title: debate?.title ?? "Debate Result", url }); } catch {} }
                        else { navigator.clipboard.writeText(url).catch(() => {}); toast({ title: "Link copied!" }); }
                      }}
                    >
                      <Share className="w-3 h-3" /> Share result
                    </button>
                  </div>
                </div>
                {/* Top argument cards */}
                {(topSupportArg || topAgainstArg) && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-white/5">
                    <div className="flex flex-col gap-2 p-4 bg-indigo-950/30">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-400">
                        <Star className="w-3 h-3 fill-current" /> Top Support Argument
                      </div>
                      <p className="text-xs text-foreground/70 leading-relaxed line-clamp-4">{topSupportArg?.text ?? "—"}</p>
                      <span className="text-[10px] text-muted-foreground">— {topSupportArg?.author ?? "—"}</span>
                    </div>
                    <div className="flex flex-col gap-2 p-4 bg-rose-950/20">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
                        <Star className="w-3 h-3 fill-current" /> Top Opposition Argument
                      </div>
                      <p className="text-xs text-foreground/70 leading-relaxed line-clamp-4">{topAgainstArg?.text ?? "—"}</p>
                      <span className="text-[10px] text-muted-foreground">— {topAgainstArg?.author ?? "—"}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Admin oversight banner */}
            {(debate as { adminModerating?: boolean }).adminModerating && (
              <div className="flex items-start gap-3 bg-violet-950/40 border border-violet-500/30 rounded-xl p-4">
                <Shield className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-violet-300">This debate is under admin oversight</p>
                  <p className="text-xs text-muted-foreground mt-0.5">An admin has taken over active moderation of this debate. Arguments may be pinned, featured, or removed by the admin team.</p>
                </div>
              </div>
            )}

            {/* Frozen debate banner */}
            {(debate as { isFrozen?: boolean }).isFrozen && (
              <div className="flex items-start gap-3 bg-blue-950/40 border border-blue-500/30 rounded-xl p-4">
                <Snowflake className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-300">This debate has been frozen</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{(debate as { frozenReason?: string }).frozenReason || "New arguments are temporarily paused by a moderator. Existing arguments and voting remain visible."}</p>
                </div>
              </div>
            )}

            {/* Post an argument */}
            {!outcome && debate.isLive && !canModerate && !(debate as { isFrozen?: boolean }).isFrozen && !hasLeftDebate && (
              <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold">Post your argument</span>
                  <button
                    className={cn("text-xs font-medium px-2.5 py-1 rounded-full border ml-auto transition-colors", isOxford ? "bg-primary/10 text-primary border-primary/30" : "border-border text-muted-foreground hover:text-foreground")}
                    onClick={() => setIsOxford(p => !p)}
                    data-testid="button-oxford-toggle"
                  >
                    {isOxford ? "Oxford Format ✓" : "Oxford Format"}
                  </button>
                </div>

                {isOxford ? (
                  <>
                    <div className="flex gap-2 flex-wrap">
                      {OXFORD_ROUNDS.map(r => (
                        <button key={r} className={cn("text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors", oxfordRound === r ? "bg-primary/10 text-primary border-primary/30" : "border-border text-muted-foreground hover:text-foreground")} onClick={() => setOxfordRound(r)} data-testid={`button-round-${r}`}>{r}</button>
                      ))}
                    </div>
                    <div className="flex gap-2 items-center">
                      <button className={cn("text-xs font-bold px-3 py-1 rounded-full transition-colors", argSide === "support" ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30" : "text-muted-foreground hover:text-foreground", sideLocked && userVote === "against" && "opacity-40 cursor-not-allowed")} onClick={() => !sideLocked || userVote === "support" ? setArgSide("support") : undefined} data-testid="button-side-support">For</button>
                      <button className={cn("text-xs font-bold px-3 py-1 rounded-full transition-colors", argSide === "against" ? "bg-rose-600/20 text-rose-400 border border-rose-500/30" : "text-muted-foreground hover:text-foreground", sideLocked && userVote === "support" && "opacity-40 cursor-not-allowed")} onClick={() => !sideLocked || userVote === "against" ? setArgSide("against") : undefined} data-testid="button-side-against">Against</button>
                      {sideLocked && <span className="text-[10px] text-muted-foreground ml-1">🔒 Locked to your vote</span>}
                    </div>
                  </>
                ) : (
                  <div className="flex gap-2 items-center">
                    <button className={cn("text-xs font-bold px-3 py-1 rounded-full transition-colors", argSide === "support" ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30" : "text-muted-foreground hover:text-foreground", sideLocked && userVote === "against" && "opacity-40 cursor-not-allowed")} onClick={() => !sideLocked || userVote === "support" ? setArgSide("support") : undefined} data-testid="button-side-support">For</button>
                    <button className={cn("text-xs font-bold px-3 py-1 rounded-full transition-colors", argSide === "against" ? "bg-rose-600/20 text-rose-400 border border-rose-500/30" : "text-muted-foreground hover:text-foreground", sideLocked && userVote === "support" && "opacity-40 cursor-not-allowed")} onClick={() => !sideLocked || userVote === "against" ? setArgSide("against") : undefined} data-testid="button-side-against">Against</button>
                    {sideLocked && <span className="text-[10px] text-muted-foreground ml-1">🔒 Locked to your vote</span>}
                  </div>
                )}

                <textarea
                  className="w-full bg-muted/30 border border-border rounded-xl p-3 text-sm resize-none outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground"
                  placeholder={isOxford ? `Write your ${oxfordRound}...` : `Make your ${argSide === "support" ? "supporting" : "opposing"} argument...`}
                  rows={3}
                  value={newArg}
                  onChange={e => { setNewArg(e.target.value); setWordCount(e.target.value.trim().split(/\s+/).filter(Boolean).length); setShowAttackWarn(false); }}
                  data-testid="input-argument"
                />

                <div className="flex items-center justify-between px-1">
                  {(() => {
                    const wl = (debate as any)?.wordLimit as number | null | undefined;
                    if (wl && wl > 0) {
                      const over = wordCount > wl;
                      const met = wordCount >= 30 && !over;
                      return (
                        <span className={cn("text-[11px]", over ? "text-red-400" : met ? "text-green-400" : wordCount > 0 ? "text-yellow-400" : "text-muted-foreground")}>
                          {wordCount} / {wl} words max{over ? " ⚠ too long" : wordCount >= 30 ? " ✓" : " (30 min)"}
                        </span>
                      );
                    }
                    return (
                      <span className={cn("text-[11px]", wordCount >= 30 ? "text-green-400" : wordCount > 0 ? "text-yellow-400" : "text-muted-foreground")}>
                        {wordCount} / 30 words min{wordCount >= 30 ? " ✓" : ""}
                      </span>
                    );
                  })()}
                  {showAttackWarn && (
                    <span className="flex items-center gap-1 text-[11px] text-orange-400">
                      <AlertTriangle className="w-3 h-3" /> Personal attack detected — please revise
                    </span>
                  )}
                </div>
                {wordCount >= 150 && sources.length === 0 && (
                  <div className="flex items-start gap-2 text-[11px] text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                    <span>Arguments over 150 words require at least one source citation. Add a source below before posting.</span>
                  </div>
                )}

                {sources.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {sources.map((s, i) => (
                      <span key={i} className="flex items-center gap-1 text-[11px] text-indigo-400 bg-indigo-400/10 border border-indigo-400/20 px-2 py-0.5 rounded-full">
                        <LinkIcon className="w-2.5 h-2.5" /> {s.label}
                        <button className="ml-1 hover:text-red-400 transition-colors" onClick={() => setSources(p => p.filter((_, j) => j !== i))}>×</button>
                      </span>
                    ))}
                  </div>
                )}

                {showSourceField && (
                  <div className="flex flex-col gap-2 bg-muted/30 rounded-lg p-3">
                    <input className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs outline-none focus:border-primary placeholder:text-muted-foreground" placeholder="Source URL (e.g. https://nature.com/...)" value={sourceInput} onChange={e => setSourceInput(e.target.value)} />
                    <input className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs outline-none focus:border-primary placeholder:text-muted-foreground" placeholder="Label (e.g. Nature: AI Study)" value={sourceLabelInput} onChange={e => setSourceLabelInput(e.target.value)} />
                    <div className="flex gap-2">
                      <button className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors" onClick={handleAddSource}>Add Source</button>
                      <button className="text-xs text-muted-foreground hover:text-foreground transition-colors" onClick={() => { setShowSourceField(false); setSourceInput(""); setSourceLabelInput(""); }}>Cancel</button>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-indigo-400 transition-colors border border-border hover:border-indigo-400/30 px-3 py-1.5 rounded-full" onClick={() => setShowSourceField(true)} data-testid="button-add-source">
                    <LinkIcon className="w-3 h-3" /> + Add Source
                  </button>
                  {!hasLeftDebate && user && (
                    <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-rose-400 transition-colors border border-border hover:border-rose-400/30 px-3 py-1.5 rounded-full" onClick={handleLeaveDebate} data-testid="button-leave-debate">
                      <LogOut className="w-3 h-3" /> Leave Debate
                    </button>
                  )}
                  <button
                    className="ml-auto bg-primary hover:bg-primary/90 text-white font-semibold px-5 py-2 rounded-full text-sm transition-colors disabled:opacity-50"
                    onClick={handlePostArgument}
                    disabled={!userVote || !newArg.trim() || wordCount < 30 || isPostingArg}
                    data-testid="button-post-argument"
                  >
                    {isPostingArg ? <><Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" />Posting…</> : !userVote ? "Vote Before Posting" : "Post Argument"}
                  </button>
                </div>
              </div>
            )}

            {/* Arguments */}
            {commentsQuery.isError && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-red-500/25 bg-red-500/5 p-4">
                <p className="text-sm text-red-300">Arguments could not be loaded. Your debate data is safe.</p>
                <button className="text-xs font-semibold text-red-300 border border-red-500/30 rounded-full px-3 py-1.5" onClick={() => commentsQuery.refetch()}>Try again</button>
              </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-bold text-indigo-400 flex items-center gap-2">
                  <ThumbsUp className="w-4 h-4" /> Supporting Arguments
                  <span className="ml-auto text-xs text-muted-foreground font-normal">{supportArgs.length}</span>
                </h3>
                {supportArgs.length > 0
                  ? supportArgs.map(arg => <ArgumentCard key={arg.id} arg={arg} side="support" isOxford={isOxford} canModerate={canModerate} onPin={handlePinComment} onRemove={handleRemoveComment} onFeature={handleFeatureComment} onLockReplies={handleLockReplies} />)
                  : <p className="text-xs text-muted-foreground py-4 text-center">No support arguments yet. Be the first!</p>
                }
              </div>
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-bold text-rose-400 flex items-center gap-2">
                  <ThumbsDown className="w-4 h-4" /> Opposing Arguments
                  <span className="ml-auto text-xs text-muted-foreground font-normal">{againstArgs.length}</span>
                </h3>
                {againstArgs.length > 0
                  ? againstArgs.map(arg => <ArgumentCard key={arg.id} arg={arg} side="against" isOxford={isOxford} canModerate={canModerate} onPin={handlePinComment} onRemove={handleRemoveComment} onFeature={handleFeatureComment} onLockReplies={handleLockReplies} />)
                  : <p className="text-xs text-muted-foreground py-4 text-center">No opposition arguments yet. Be the first!</p>
                }
              </div>
            </div>

            {/* Points of Agreement */}
            <div className="bg-card border border-green-500/20 rounded-xl p-5 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Handshake className="w-4 h-4 text-green-400" />
                <h3 className="text-sm font-bold text-green-400">Points of Agreement</h3>
                {!agreementsLoading && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    {agreements.length === 0 ? "None yet" : `${agreements.length} found`}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed -mt-2">
                Even in a debate, both sides can agree on something. This section is for shared truths — facts, limitations, or nuances that supporters <em>and</em> opponents both accept, regardless of who wins. Only participants who have voted can add one.
              </p>

              {agreementsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-14 w-full rounded-lg" />
                  <Skeleton className="h-14 w-full rounded-lg" />
                </div>
              ) : agreements.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {agreements.map((a) => (
                    <AgreementCard key={a.id} agreement={a} onUpvote={handleUpvoteAgreement} isParticipant={canPost} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-3">
                  No agreements yet — be the first to find common ground
                </p>
              )}

              {canPost && !outcome && debate?.isLive && (
                <div className="border-t border-green-500/10 pt-4 flex flex-col gap-2">
                  <textarea
                    className="w-full bg-muted/30 border border-green-500/20 rounded-xl p-3 text-sm resize-none outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/20 placeholder:text-muted-foreground"
                    placeholder="Both sides agree: more research is needed before drawing conclusions…"
                    rows={2}
                    maxLength={280}
                    value={newAgreement}
                    onChange={(e) => setNewAgreement(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handlePostAgreement();
                    }}
                    data-testid="input-agreement"
                  />
                  <div className="flex items-center justify-between">
                    <span className={cn("text-xs", newAgreement.length > 260 ? "text-yellow-400" : "text-muted-foreground")}>
                      {newAgreement.length}/280
                    </span>
                    <button
                      className="bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/30 font-semibold px-4 py-1.5 rounded-full text-sm transition-colors disabled:opacity-50"
                      onClick={handlePostAgreement}
                      disabled={!newAgreement.trim() || createAgreement.isPending}
                      data-testid="button-post-agreement"
                    >
                      {createAgreement.isPending ? "Posting…" : "Add Agreement"}
                    </button>
                  </div>
                </div>
              )}

              {!canPost && !agreementsLoading && (
                <p className="text-xs text-muted-foreground text-center">
                  Vote on the debate above to add points of agreement
                </p>
              )}
            </div>

            <button
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-fit mx-auto transition-colors"
              onClick={async () => {
                const url = window.location.href;
                if (navigator.share) {
                  try { await navigator.share({ title: debate?.title ?? "Treffin Debate", text: "Join this debate on Treffin, where minds debate.", url }); } catch {}
                } else {
                  navigator.clipboard.writeText(url).catch(() => {});
                  toast({ title: "Link copied!" });
                }
              }}
            >
              <Share className="w-4 h-4" /> Share this debate
            </button>
          </>
        ) : (
          <div className="text-center text-muted-foreground py-20">
            <p className="text-lg font-semibold">Debate not found.</p>
            <p className="text-sm mt-2">This debate may have been removed or the link is invalid.</p>
          </div>
        )}
      </div>
      {celebrationDebateId === debateId && (
        <ConfettiCelebration variant="first-vote" onDismiss={() => { sessionStorage.removeItem(pendingVoteCelebrationKey); setCelebrationDebateId(null); }} />
      )}
      {showOutcomeCelebration && (
        <ConfettiCelebration variant="outcome" onDismiss={() => setShowOutcomeCelebration(false)} />
      )}

      {/* ── End Debate Confirmation Modal ───────────────────────────── */}
      {showEndConfirmModal && (
        <div className="fixed inset-0 bg-black/60 z-50 overflow-y-auto flex items-center justify-center p-4" onClick={() => setShowEndConfirmModal(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0">
                <Square className="w-4 h-4 text-rose-400" />
              </div>
              <h3 className="font-semibold text-foreground">End debate early?</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
              No further votes or arguments will be accepted. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowEndConfirmModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmEndDebate}
                disabled={isEnding}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {isEnding ? "Ending…" : "End Debate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Remove Comment Modal ─────────────────────────────────────── */}
      {removeCommentTarget !== null && (
        <div className="fixed inset-0 bg-black/60 z-50 overflow-y-auto flex items-center justify-center p-4" onClick={() => setRemoveCommentTarget(null)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Remove comment</h3>
              <button onClick={() => setRemoveCommentTarget(null)} className="text-muted-foreground hover:text-foreground p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              Provide a reason — it will be logged in the moderation record and shown to the commenter.
            </p>
            <textarea
              value={removeCommentReason}
              onChange={(e) => setRemoveCommentReason(e.target.value)}
              rows={3}
              autoFocus
              className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none mb-4"
              placeholder="e.g. Off-topic personal attack, violated debate rules…"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setRemoveCommentTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRemoveComment}
                disabled={!removeCommentReason.trim() || isRemovingComment}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {isRemovingComment ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Declare Winner Modal ─────────────────────────────────────── */}
      {showDeclareModal && (
        <div className="fixed inset-0 bg-black/70 z-50 overflow-y-auto flex items-end sm:items-center justify-center p-4" onClick={() => setShowDeclareModal(false)}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border/60">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-400" />
                <h3 className="font-bold text-foreground">Declare a Winner</h3>
              </div>
              <button onClick={() => setShowDeclareModal(false)} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Choose the winning side and write a justification. This will be shown publicly to all participants.
              </p>
              {/* Side selection cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(["support", "against", "draw"] as const).map((side) => (
                  <button
                    key={side}
                    onClick={() => setDeclareSide(side)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl border-2 transition-all font-bold text-xs uppercase tracking-wide",
                      declareSide === side
                        ? side === "support"
                          ? "bg-indigo-600/30 border-indigo-400 text-indigo-200"
                          : side === "against"
                          ? "bg-rose-600/30 border-rose-400 text-rose-200"
                          : "bg-yellow-600/20 border-yellow-400 text-yellow-200"
                        : "border-border text-muted-foreground hover:border-primary/40 bg-muted/40"
                    )}
                  >
                    <span className="text-lg">
                      {side === "support" ? "👊" : side === "against" ? "🛡️" : "🤝"}
                    </span>
                    {side === "support" ? "Support" : side === "against" ? "Opposition" : "Draw"}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Justification <span className="text-rose-400">*</span></label>
                <textarea
                  value={declareJustification}
                  onChange={(e) => setDeclareJustification(e.target.value)}
                  rows={4}
                  autoFocus
                  className="w-full px-3 py-2.5 bg-input border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-yellow-400/30 focus:border-yellow-400/40 resize-none transition-colors"
                  placeholder="Explain your reasoning — which arguments were most compelling and why…"
                  maxLength={1000}
                />
                <p className="text-[10px] text-muted-foreground/60 text-right">{declareJustification.length}/1000</p>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setShowDeclareModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeclareWinner}
                  disabled={!declareJustification.trim() || isDeclaring}
                  className="flex-1 py-2.5 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeclaring ? "Declaring…" : "Declare Winner"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Debate Modal ─────────────────────────────────────────── */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 z-50 overflow-y-auto flex items-center justify-center p-4" onClick={() => setShowEditModal(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Edit Debate</h3>
              <button onClick={() => setShowEditModal(false)} className="text-muted-foreground hover:text-foreground p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Title</label>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Debate title"
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description <span className="text-muted-foreground/50 font-normal normal-case tracking-normal">(optional)</span></label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  placeholder="Add context or framing for participants…"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={!editTitle.trim() || isSavingEdit}
                className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {isSavingEdit ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Report Creator Modal ──────────────────────────────────────── */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/60 z-50 overflow-y-auto flex items-center justify-center p-4" onClick={() => setShowReportModal(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Flag className="w-4 h-4 text-red-400" />
                <h3 className="font-semibold text-foreground">Report Creator</h3>
              </div>
              <button onClick={() => setShowReportModal(false)} className="text-muted-foreground hover:text-foreground p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              Tell us why you think this debate's creator has acted unfairly — e.g. biased moderation, manipulating rules, or bad-faith conduct.
            </p>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              rows={3}
              autoFocus
              className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-red-400/30 resize-none mb-4"
              placeholder="e.g. Removed my argument without cause, pinned only one side's best arguments…"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowReportModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReportCreator}
                disabled={!reportReason.trim() || isReporting}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {isReporting ? "Submitting…" : "Submit Report"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Axis Winner Modal ─────────────────────────────────────────── */}
      {showAxisModal && (
        <div className="fixed inset-0 bg-black/60 z-50 overflow-y-auto flex items-center justify-center p-4" onClick={() => setShowAxisModal(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">🏅 Declare Axis Winner</h3>
              <button onClick={() => setShowAxisModal(false)} className="text-muted-foreground hover:text-foreground p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Axis</label>
                <select
                  value={axisDeclareAxis}
                  onChange={(e) => setAxisDeclareAxis(e.target.value)}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {["overall", "elegant", "clear", "rigorous", "efficient"].map((axis) => (
                    <option key={axis} value={axis}>{axis.charAt(0).toUpperCase() + axis.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Declaration</label>
                <textarea
                  value={axisDeclareText}
                  onChange={(e) => setAxisDeclareText(e.target.value)}
                  rows={3}
                  autoFocus
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  placeholder="e.g. Approach A — fewest steps, most insightful leap"
                  maxLength={280}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowAxisModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeclareAxisWinner}
                disabled={!axisDeclareText.trim() || isDeclaringAxis}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold transition-colors disabled:opacity-50"
              >
                {isDeclaringAxis ? "Declaring…" : "Declare"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
