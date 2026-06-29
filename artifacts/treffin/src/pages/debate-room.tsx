import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { useGetDebate, useVoteDebate, getGetDebateQueryKey, useGetMyDebateVote, getGetMyDebateVoteQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatNumber, cn } from "@/lib/utils";
import { Users, ArrowLeft, ThumbsUp, ThumbsDown, MessageCircle, Share, Heart, Send, Link as LinkIcon, CheckCircle, Trophy, Star, Zap, FileDown, Loader2, Handshake, ChevronUp, Snowflake, AlertTriangle, LogOut, ShieldCheck, BarChart2, Pencil, ShieldAlert } from "lucide-react";
import { exportDebatePDF } from "@/lib/export-debate-pdf";
import { useGetDebateAgreements, getGetDebateAgreementsQueryKey, useCreateDebateAgreement, useUpvoteDebateAgreement } from "@workspace/api-client-react";
import type { DebateAgreement } from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useUser, useAuth, useClerk } from "@clerk/react";
import { useAppContext } from "@/context/app-context";
import { ConfettiCelebration } from "@/components/confetti-celebration";

type Source = { url: string; label: string };
type Arg = { id: number; author: string; text: string; likes: number; likedByMe?: boolean; time: string; sources?: Source[]; isFlagged?: boolean; flagLabel?: string | null; editedAt?: string | null; isRemoved?: boolean; debateId?: number; parentCommentId?: number | null; replies?: Arg[] };

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


function commentToArg(c: { id: number; authorName: string; content: string; createdAt: string; isFlagged?: boolean; flagLabel?: string | null; editedAt?: string | null; isRemoved?: boolean; likes?: number; likedByMe?: boolean; parentCommentId?: number | null }, debateId?: number): Arg {
  return {
    id: c.id,
    author: c.authorName,
    text: c.content,
    likes: c.likes ?? 0,
    likedByMe: c.likedByMe ?? false,
    time: new Date(c.createdAt).toLocaleDateString(),
    isFlagged: c.isFlagged,
    flagLabel: c.flagLabel,
    editedAt: c.editedAt ?? null,
    isRemoved: c.isRemoved ?? false,
    debateId,
    parentCommentId: c.parentCommentId ?? null,
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

function ArgumentCard({ arg, side, isOxford, round }: { arg: Arg; side: "support" | "against"; isOxford?: boolean; round?: OxfordRound }) {
  const [liked, setLiked] = useState(arg.likedByMe ?? false);
  const [likeCount, setLikeCount] = useState(arg.likes);
  const [showReply, setShowReply] = useState(false);
  const [replyInput, setReplyInput] = useState("");
  const [isPostingReply, setIsPostingReply] = useState(false);
  const { toast } = useToast();
  const { user } = useUser();
  const { getToken, isSignedIn } = useAuth();
  const { openSignIn } = useClerk();
  const queryClient = useQueryClient();
  const qs = qualityScore({ ...arg, likes: likeCount });
  const serverReplies = arg.replies ?? [];

  const isSupport = side === "support";
  const borderCls = isSupport ? "bg-indigo-950/30 border-indigo-500/20 hover:border-indigo-500/40" : "bg-rose-950/30 border-rose-500/20 hover:border-rose-500/40";

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
      openSignIn();
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
      const res = await fetch(`/api/debates/${arg.debateId}/comments/${arg.id}/like`, {
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
          openSignIn();
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
      openSignIn();
      return;
    }
    setIsPostingReply(true);
    try {
      const token = await getToken();
      const authorName = user?.fullName || user?.firstName || "Anonymous";
      const res = await fetch(`/api/debates/${arg.debateId}/comments`, {
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
    <div className={cn("border rounded-xl p-4 flex flex-col gap-2.5 transition-colors", borderCls)}>
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

      <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 border-t border-white/5">
        <button
          className={cn("flex items-center gap-1 transition-colors", liked ? (isSupport ? "text-indigo-400" : "text-rose-400") : (isSupport ? "hover:text-indigo-400" : "hover:text-rose-400"))}
          onClick={handleLike}
          data-testid={`button-like-arg-${arg.id}`}
        >
          <Heart className={cn("w-3 h-3", liked && "fill-current")} /> {likeCount}
        </button>
        <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => setShowReply(p => !p)} data-testid={`button-reply-arg-${arg.id}`}>
          <MessageCircle className="w-3 h-3" /> {showReply ? "Cancel" : `Reply${serverReplies.length > 0 ? ` (${serverReplies.length})` : ""}`}
        </button>
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
  const { user } = useUser();
  const { triggerRep } = useAppContext();

  const { getToken, isSignedIn } = useAuth();
  const { openSignIn } = useClerk();

  const { data: debate, isLoading } = useGetDebate(debateId, {
    query: { enabled: !!debateId, queryKey: getGetDebateQueryKey(debateId), refetchInterval: 15_000 },
  });

  const outcomeQuery = useQuery({
    queryKey: ["debate-outcome", debateId],
    queryFn: () =>
      fetch(`/api/debates/${debateId}/outcome`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    enabled: !!debateId,
    retry: false,
  });

  const commentsQuery = useQuery({
    queryKey: ["debate-comments", debateId],
    queryFn: () =>
      fetch(`/api/debates/${debateId}/comments`)
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
    enabled: !!debateId,
    refetchInterval: 10_000,
  });

  const outcome = outcomeQuery.data ?? null;

  const voteDebate = useVoteDebate();
  const [userVote, setUserVote] = useState<"support" | "against" | null>(null);
  const [voteInitialized, setVoteInitialized] = useState(false);
  const [support, setSupport] = useState<number | null>(null);
  const [against, setAgainst] = useState<number | null>(null);

  const { data: myVoteData, isLoading: myVoteLoading } = useGetMyDebateVote(debateId, {
    query: {
      enabled: !!debateId,
      queryKey: getGetMyDebateVoteQueryKey(debateId),
    },
  });

  useEffect(() => {
    setUserVote(null);
    setVoteInitialized(false);
  }, [debateId]);

  useEffect(() => {
    if (!voteInitialized && myVoteData !== undefined) {
      if (myVoteData.side === "support" || myVoteData.side === "against") {
        setUserVote(myVoteData.side);
      }
      setVoteInitialized(true);
    }
  }, [myVoteData, voteInitialized]);

  useEffect(() => {
    if (debate) {
      setSupport(null);
      setAgainst(null);
    }
  }, [debate]);

  const [newArg, setNewArg] = useState("");
  const [argSide, setArgSide] = useState<"support" | "against">("support");
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
  const [showCelebration, setShowCelebration] = useState(false);

  const rulesAckQuery = useQuery({
    queryKey: ["debate-rules-ack"],
    queryFn: () =>
      fetch("/api/debates/rules-ack").then((r) => r.ok ? r.json() : { acknowledged: false }).catch(() => ({ acknowledged: false })),
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
      // Top-level args only (no parentCommentId), with nested replies attached
      const topLevel = all.filter((c) => !c.parentCommentId);
      setSupportArgs(topLevel.filter((c) => c.side === "support").map((c) => ({ ...commentToArg(c, debateId), replies: replyMap.get(c.id) ?? [] })));
      setAgainstArgs(topLevel.filter((c) => c.side === "against").map((c) => ({ ...commentToArg(c, debateId), replies: replyMap.get(c.id) ?? [] })));
    }
  }, [commentsQuery.data, debateId]);

  const topSupportArg =
    outcome?.topSupportCommentId
      ? supportArgs.find((a) => a.id === outcome.topSupportCommentId) ?? supportArgs[0]
      : supportArgs[0];
  const topAgainstArg =
    outcome?.topOppositionCommentId
      ? againstArgs.find((a) => a.id === outcome.topOppositionCommentId) ?? againstArgs[0]
      : againstArgs[0];

  const handleVote = (vote: "support" | "against") => {
    if (userVote) return;
    if (!user) {
      toast({ title: "Sign in to vote", description: "Create a free account to take a stance and join the debate.", variant: "destructive" });
      setTimeout(() => setLocation("/sign-in"), 1200);
      return;
    }
    voteDebate.mutate(
      { id: debateId, data: { vote } },
      {
        onSuccess: (d) => {
          setUserVote(vote);
          setSupport(d.supportPercent);
          setAgainst(d.againstPercent);
          queryClient.invalidateQueries({ queryKey: getGetDebateQueryKey(debateId) });
          toast({ title: `Voted ${vote === "support" ? "in support" : "against"}!` });
          const isFirstVote = !localStorage.getItem("treffin_first_vote");
          if (isFirstVote) {
            localStorage.setItem("treffin_first_vote", "1");
            triggerRep(10, "vote");
            setTimeout(() => setShowCelebration(true), 350);
          }
        },
        onError: (err: unknown) => {
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
    setSources(p => [...p, { url: sourceInput.trim(), label: sourceLabelInput.trim() || sourceInput.trim() }]);
    setSourceInput(""); setSourceLabelInput(""); setShowSourceField(false);
  };

  const handlePostArgument = async () => {
    if (!newArg.trim() || isPostingArg) return;
    if (!isSignedIn) {
      toast({ title: "Sign in required", description: "Please sign in to post an argument.", variant: "destructive" });
      openSignIn();
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
      const res = await fetch(`/api/debates/${debateId}/comments`, {
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
      await fetch("/api/debates/rules-ack", { method: "POST", headers: { "Content-Type": "application/json" } });
      setRulesAcked(true);
      setShowRulesModal(false);
      handlePostArgument();
    } catch {
      toast({ title: "Could not save acknowledgment", variant: "destructive" });
    }
  };

  const handleLeaveDebate = async () => {
    try {
      const res = await fetch(`/api/debates/${debateId}/leave`, { method: "POST", headers: { "Content-Type": "application/json" } });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to leave" }));
        toast({ title: err.error ?? "Could not leave debate", variant: "destructive" }); return;
      }
      setHasLeftDebate(true);
      queryClient.invalidateQueries({ queryKey: getGetDebateQueryKey(debateId) });
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
        fetch(`/api/debates/${debateId}/comments`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch(`/api/debates/${debateId}/agreements`)
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
        time: new Date(c.createdAt).toLocaleDateString(),
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
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
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
                {!!outcome && (
                  <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded uppercase tracking-wider">Closed</span>
                )}
                <div className="flex items-center gap-3 ml-auto">
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

              <h1 className="text-xl sm:text-2xl font-bold leading-tight">{debate.title}</h1>
              {debate.description && <p className="text-sm text-muted-foreground">{debate.description}</p>}

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

              {!outcome && (
                <div className="flex flex-col gap-2 mt-2">
                  <div className="flex gap-3">
                    <button
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold transition-colors disabled:opacity-50",
                        userVote === "support"
                          ? "bg-indigo-600/40 border-2 border-indigo-400 text-indigo-300 ring-1 ring-indigo-400/30"
                          : userVote === "against"
                          ? "bg-muted/20 border border-border text-muted-foreground cursor-not-allowed"
                          : "bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/30"
                      )}
                      onClick={() => handleVote("support")}
                      disabled={voteDebate.isPending || !!userVote || myVoteLoading}
                      title={userVote === "against" ? "You have already voted against" : undefined}
                      data-testid="button-vote-support"
                    >
                      <ThumbsUp className={cn("w-4 h-4", userVote === "support" && "fill-current")} />
                      {userVote === "support" ? "Your stance: Support" : "I Support"}
                    </button>
                    <button
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold transition-colors disabled:opacity-50",
                        userVote === "against"
                          ? "bg-rose-600/40 border-2 border-rose-400 text-rose-300 ring-1 ring-rose-400/30"
                          : userVote === "support"
                          ? "bg-muted/20 border border-border text-muted-foreground cursor-not-allowed"
                          : "bg-rose-600/20 border border-rose-500/30 text-rose-400 hover:bg-rose-600/30"
                      )}
                      onClick={() => handleVote("against")}
                      disabled={voteDebate.isPending || !!userVote || myVoteLoading}
                      title={userVote === "support" ? "You have already voted in support" : undefined}
                      data-testid="button-vote-against"
                    >
                      <ThumbsDown className={cn("w-4 h-4", userVote === "against" && "fill-current")} />
                      {userVote === "against" ? "Your stance: Oppose" : "I Oppose"}
                    </button>
                  </div>
                  {userVote && (
                    <p className="text-center text-xs text-muted-foreground">
                      You&apos;ve taken a stance — read the arguments and share yours below.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Debate Outcome Panel — rendered only when admin has published an outcome */}
            {!!outcome && (
              <div className="bg-gradient-to-br from-yellow-950/40 to-card border border-yellow-500/30 rounded-xl p-5 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  <h3 className="font-bold text-yellow-300">Debate Outcome</h3>
                  <span className={cn(
                    "ml-auto text-xs font-bold px-3 py-1 rounded-full",
                    outcome.winningSide === "support"
                      ? "bg-indigo-400/10 text-indigo-400 border border-indigo-400/20"
                      : outcome.winningSide === "against"
                      ? "bg-rose-400/10 text-rose-400 border border-rose-400/20"
                      : "bg-yellow-400/10 text-yellow-400 border border-yellow-400/20"
                  )}>
                    {outcome.winningSide === "support"
                      ? "Support Won"
                      : outcome.winningSide === "against"
                      ? "Opposition Won"
                      : "Draw"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{outcome.justification}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-yellow-500/10 pt-3">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-400"><Star className="w-3 h-3" /> Top Support Argument</div>
                    <p className="text-xs text-muted-foreground bg-indigo-950/30 border border-indigo-500/20 rounded-lg p-3 line-clamp-3">{topSupportArg?.text ?? "—"}</p>
                    <span className="text-[10px] text-muted-foreground">— {topSupportArg?.author ?? "—"}</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400"><Star className="w-3 h-3" /> Top Opposition Argument</div>
                    <p className="text-xs text-muted-foreground bg-rose-950/30 border border-rose-500/20 rounded-lg p-3 line-clamp-3">{topAgainstArg?.text ?? "—"}</p>
                    <span className="text-[10px] text-muted-foreground">— {topAgainstArg?.author ?? "—"}</span>
                  </div>
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
            {!outcome && !(debate as { isFrozen?: boolean }).isFrozen && !hasLeftDebate && (
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
                    <div className="flex gap-2">
                      <button className={cn("text-xs font-bold px-3 py-1 rounded-full transition-colors", argSide === "support" ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30" : "text-muted-foreground hover:text-foreground")} onClick={() => setArgSide("support")} data-testid="button-side-support">For</button>
                      <button className={cn("text-xs font-bold px-3 py-1 rounded-full transition-colors", argSide === "against" ? "bg-rose-600/20 text-rose-400 border border-rose-500/30" : "text-muted-foreground hover:text-foreground")} onClick={() => setArgSide("against")} data-testid="button-side-against">Against</button>
                    </div>
                  </>
                ) : (
                  <div className="flex gap-2">
                    <button className={cn("text-xs font-bold px-3 py-1 rounded-full transition-colors", argSide === "support" ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30" : "text-muted-foreground hover:text-foreground")} onClick={() => setArgSide("support")} data-testid="button-side-support">For</button>
                    <button className={cn("text-xs font-bold px-3 py-1 rounded-full transition-colors", argSide === "against" ? "bg-rose-600/20 text-rose-400 border border-rose-500/30" : "text-muted-foreground hover:text-foreground")} onClick={() => setArgSide("against")} data-testid="button-side-against">Against</button>
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
                  <span className={cn("text-[11px]", wordCount >= 30 ? "text-green-400" : wordCount > 0 ? "text-yellow-400" : "text-muted-foreground")}>
                    {wordCount} / 30 words min{wordCount >= 30 ? " ✓" : ""}
                  </span>
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
                    disabled={!newArg.trim() || wordCount < 30 || isPostingArg}
                    data-testid="button-post-argument"
                  >
                    {isPostingArg ? <><Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" />Posting…</> : "Post Argument"}
                  </button>
                </div>
              </div>
            )}

            {/* Arguments */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-bold text-indigo-400 flex items-center gap-2">
                  <ThumbsUp className="w-4 h-4" /> Supporting Arguments
                  <span className="ml-auto text-xs text-muted-foreground font-normal">{supportArgs.length}</span>
                </h3>
                {supportArgs.length > 0
                  ? supportArgs.map(arg => <ArgumentCard key={arg.id} arg={arg} side="support" isOxford={isOxford} />)
                  : <p className="text-xs text-muted-foreground py-4 text-center">No support arguments yet. Be the first!</p>
                }
              </div>
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-bold text-rose-400 flex items-center gap-2">
                  <ThumbsDown className="w-4 h-4" /> Opposing Arguments
                  <span className="ml-auto text-xs text-muted-foreground font-normal">{againstArgs.length}</span>
                </h3>
                {againstArgs.length > 0
                  ? againstArgs.map(arg => <ArgumentCard key={arg.id} arg={arg} side="against" isOxford={isOxford} />)
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

              {canPost && (
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
      {showCelebration && (
        <ConfettiCelebration onDismiss={() => setShowCelebration(false)} />
      )}
    </AppLayout>
  );
}
