import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useGetFeed, getGetFeedQueryKey, useGetDailyQuestion, useGetDebates, useGetArticles, useGetTopThinkers, useGetCurrentUser, getGetCurrentUserQueryKey, useGetCommunities, getGetCommunitiesQueryKey, useVoteDailyQuestion, useSubmitWeeklyChallenge, useGetWeeklyChallenge } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PostCard } from "@/components/feed/post-card";
import { ArticleCard } from "@/components/feed/article-card";
import { DailyQuestionCard } from "@/components/feed/daily-question-card";
import { KnowledgeCard } from "@/components/feed/knowledge-card";
import { PostComposer } from "@/components/feed/post-composer";
import { Zap, Users, X, Trophy, Clock, Send, Crown, MessageSquare, FileText, TrendingUp, Brain, Globe2 } from "lucide-react";
import { CategoryPill } from "@/components/debate/category-pill";
import { CountdownChip } from "@/components/debate/countdown-chip";
import { InterestOnboardingModal, INTERESTS_STORAGE_KEY } from "@/components/onboarding/interest-onboarding-modal";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatNumber } from "@/lib/utils";
import { Link, useSearch, useLocation } from "wouter";
import { useUser, Show } from "@clerk/react";
import { useAppContext } from "@/context/app-context";

const TABS = [
  { value: "for_you", label: "For You" },
  { value: "following", label: "Discover", href: "/discover" },
  { value: "debates", label: "Debates" },
  { value: "articles", label: "Articles" },
  { value: "communities", label: "Communities" },
] as const;

type Tab = typeof TABS[number]["value"];

const CHALLENGE_FALLBACK = {
  prompt: "Make the case AGAINST social media in under 300 words. Use first principles. No clichés.",
  deadline: "Ends Sunday 11:59 PM",
  totalEntries: 0,
  prize: "Featured on homepage + Elite Thinkers invite",
};

/* ── Quick Action Cards ─────────────────────────────────────────────────── */
const QUICK_ACTIONS = [
  { icon: MessageSquare, emoji: "⚡", label: "Today's Debate", sub: "Join now", href: "/debates", gradient: "from-indigo-500/20 to-card border-indigo-500/30" },
  { icon: TrendingUp, emoji: "🔥", label: "Trending", sub: "Hot topics", href: "/debates", gradient: "from-rose-500/20 to-card border-rose-500/25" },
  { icon: FileText, emoji: "📰", label: "Articles", sub: "Long-form", href: "/articles", gradient: "from-blue-500/20 to-card border-blue-500/25" },
  { icon: Brain, emoji: "🧠", label: "Top Thinkers", sub: "Leaderboard", href: "/analytics", gradient: "from-amber-500/20 to-card border-amber-500/25" },
  { icon: Globe2, emoji: "🏘️", label: "Communities", sub: "Join tribes", href: "/communities", gradient: "from-emerald-500/20 to-card border-emerald-500/25" },
  { icon: Brain, emoji: "∑", label: "Mathematics", sub: "Solve problems", href: "/math", gradient: "from-violet-500/20 to-card border-violet-500/25" },
];

function QuickActionCards({ onTabChange }: { onTabChange: (t: Tab) => void }) {
  return (
    <div className="flex gap-2.5 overflow-x-auto scrollbar-none pb-0.5 -mx-1 px-1">
      {QUICK_ACTIONS.map(({ icon: Icon, emoji, label, sub, href, gradient }) => (
        <Link key={label} href={href}>
          <div className={cn(
            "flex-shrink-0 w-[110px] bg-gradient-to-br border rounded-xl p-3.5 cursor-pointer hover:scale-[1.03] hover:shadow-lg transition-all group",
            gradient
          )}>
            <div className="text-2xl mb-2 leading-none">{emoji}</div>
            <p className="text-[13px] font-bold leading-tight text-foreground">{label}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

/* ── Hero Daily Question Banner ─────────────────────────────────────────── */
function HeroDailyQuestion() {
  const { data: dailyQuestion, isLoading } = useGetDailyQuestion();
  const { mutateAsync: voteMutation, isPending: isVoting } = useVoteDailyQuestion();
  const [voted, setVoted] = useState<"support" | "against" | null>(null);
  const [liveStats, setLiveStats] = useState<{ support: number; against: number; count: number } | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const { isSignedIn } = useUser();

  const voteKey = dailyQuestion ? `treffin_daily_vote_${dailyQuestion.id ?? dailyQuestion.question}` : null;

  useEffect(() => {
    if (!voteKey) { setVoted(null); return; }
    const stored = localStorage.getItem(voteKey);
    setVoted(stored === "support" || stored === "against" ? stored : null);
  }, [voteKey]);

  if (isLoading) return <Skeleton className="w-full h-[200px] rounded-2xl" />;
  if (!dailyQuestion) return null;

  const support = liveStats?.support ?? dailyQuestion.supportPercent;
  const against = liveStats?.against ?? dailyQuestion.againstPercent;
  const participantCount = liveStats?.count ?? dailyQuestion.participantCount;

  const handleVote = async (side: "support" | "against") => {
    if (voted || isVoting) return;
    if (!isSignedIn) { setNeedsSignIn(true); setTimeout(() => setNeedsSignIn(false), 3000); return; }
    setVoted(side);
    if (voteKey) localStorage.setItem(voteKey, side);
    try {
      const result = await voteMutation({ data: { side } });
      setLiveStats({ support: result.supportPercent, against: result.againstPercent, count: result.participantCount });
    } catch { /* 409 = already voted — local state is correct */ }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/15 via-primary/5 to-card">
      {/* Background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(79,106,247,0.15)_0%,_transparent_70%)] pointer-events-none" />
      <div className="relative p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-black text-primary bg-primary/15 border border-primary/30 px-2.5 py-1 rounded-full uppercase tracking-widest">
            Daily Big Question
          </span>
          <span className="flex items-center gap-1 text-[10px] font-bold text-red-400 uppercase tracking-widest">
            <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" /> Live
          </span>
        </div>

        <h2 className="text-[17px] font-bold leading-snug mb-4 max-w-[85%]">
          {dailyQuestion.question}
        </h2>

        {/* Vote bars */}
        <div className="flex flex-col gap-1.5 mb-4">
          <div className="flex justify-between text-xs font-bold">
            <span className="text-indigo-400">Support {voted ? support : "—"}%</span>
            <span className="text-rose-400">Against {voted ? against : "—"}%</span>
          </div>
          <div className="h-2 w-full bg-muted/50 rounded-full overflow-hidden flex">
            {voted ? (
              <>
                <div className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-700" style={{ width: `${support}%` }} />
                <div className="h-full bg-gradient-to-r from-rose-500 to-rose-600 transition-all duration-700" style={{ width: `${against}%` }} />
              </>
            ) : (
              <div className="h-full w-full bg-muted/80 rounded-full" />
            )}
          </div>
        </div>

        {/* Vote buttons + stats */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => handleVote("support")}
            disabled={!!voted}
            className={cn(
              "flex-1 py-2 rounded-xl text-sm font-bold transition-all border",
              voted === "support"
                ? "bg-indigo-500 text-white border-indigo-500"
                : voted
                ? "bg-muted/30 text-muted-foreground border-border cursor-not-allowed"
                : "bg-indigo-500/15 text-indigo-500 dark:text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/25"
            )}
          >
            👍 Support
          </button>
          <button
            onClick={() => handleVote("against")}
            disabled={!!voted}
            className={cn(
              "flex-1 py-2 rounded-xl text-sm font-bold transition-all border",
              voted === "against"
                ? "bg-rose-500 text-white border-rose-500"
                : voted
                ? "bg-muted/30 text-muted-foreground border-border cursor-not-allowed"
                : "bg-rose-500/15 text-rose-500 dark:text-rose-300 border-rose-500/30 hover:bg-rose-500/25"
            )}
          >
            👎 Against
          </button>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 pl-1">
            <Users className="w-3.5 h-3.5" />
            <span className="font-semibold">{formatNumber(participantCount)}</span>
          </div>
        </div>

        {needsSignIn && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[12px] text-amber-400 mt-3 text-center bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2"
          >
            Sign in to cast your vote and earn rep!
          </motion.p>
        )}

        {voted && !needsSignIn && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[12px] text-muted-foreground mt-3 text-center"
          >
            Vote cast! Check <Link href="/debates"><span className="text-primary hover:underline cursor-pointer">the debate room</span></Link> to see full arguments.
          </motion.p>
        )}
      </div>
    </div>
  );
}

/* ── Weekly Challenge ───────────────────────────────────────────────────── */
function WeeklyChallengeCard() {
  const [response, setResponse] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { data: apiChallenge } = useGetWeeklyChallenge();
  const { mutateAsync: submitChallenge, isPending: isSubmitting } = useSubmitWeeklyChallenge();
  const { isSignedIn } = useUser();

  const prompt = apiChallenge?.question ?? CHALLENGE_FALLBACK.prompt;
  const deadline = apiChallenge
    ? `Ends ${new Date(apiChallenge.endDate).toLocaleDateString("en-US", { weekday: "long" })} 11:59 PM`
    : CHALLENGE_FALLBACK.deadline;

  const winner = apiChallenge?.winnerName ? apiChallenge : null;

  const submitKey = `treffin_weekly_challenge_${prompt}`;

  useEffect(() => {
    setSubmitted(localStorage.getItem(submitKey) !== null);
  }, [submitKey]);

  const wc = response.trim().split(/\s+/).filter(Boolean).length;
  const pct = Math.min(100, (wc / 300) * 100);
  const overLimit = wc > 300;

  const handleSubmit = async () => {
    if (!response.trim() || overLimit || isSubmitting) return;
    if (!isSignedIn) { setSubmitError("Sign in to submit your response!"); setTimeout(() => setSubmitError(null), 3000); return; }
    setSubmitError(null);
    try {
      await submitChallenge({ data: { response: response.trim() } });
      setSubmitted(true);
      localStorage.setItem(submitKey, response.trim().slice(0, 2000));
    } catch (err: any) {
      if (err?.status === 409 || err?.response?.status === 409) {
        setSubmitted(true);
        localStorage.setItem(submitKey, "submitted");
      } else {
        setSubmitError("Submission failed. Please try again.");
      }
    }
  };

  return (
    <div className="bg-gradient-to-br from-primary/12 via-card to-card border border-primary/25 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-5 pt-5 pb-4">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/15 border border-primary/25">
          <Trophy className="w-5 h-5 text-primary" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">Weekly Intellectual Challenge</span>
            <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase tracking-wider">Week {Math.ceil(((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86400000 + new Date(new Date().getFullYear(), 0, 1).getDay() + 1) / 7)}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            <Clock className="w-3 h-3" /> {deadline}
          </div>
        </div>
      </div>

      <div className="px-5 pb-2">
        <div className="bg-background/50 border border-border/60 rounded-xl p-4">
          <p className="text-sm font-medium leading-relaxed italic">"{prompt}"</p>
        </div>
      </div>

      {/* Winner banner */}
      {winner && (
        <div className="px-5 pb-2 mt-2">
          <div className="flex items-start gap-3 bg-amber-400/10 border border-amber-400/25 rounded-xl px-4 py-3">
            <span className="text-xl shrink-0">🏆</span>
            <div className="min-w-0">
              <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-0.5">This Week's Winner</p>
              <p className="text-sm font-bold text-foreground">{winner.winnerName}</p>
              {winner.winnerResponse && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">"{winner.winnerResponse}"</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="px-5 pb-2 mt-2">
        <div className="flex items-start gap-1.5 text-xs text-yellow-400 bg-yellow-400/8 border border-yellow-400/20 rounded-lg px-3 py-2">
          <Crown className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span><strong>Prize:</strong> {CHALLENGE_FALLBACK.prize}</span>
        </div>
      </div>

      {submitError && (
        <div className="px-5 pb-0 mt-1">
          <p className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">{submitError}</p>
        </div>
      )}

      {!submitted ? (
        <div className="px-5 pb-5 mt-2 flex flex-col gap-2">
          <textarea
            className="w-full bg-background/40 border border-border/60 rounded-xl p-3 text-sm resize-none outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 placeholder:text-muted-foreground/60"
            placeholder="Write your response here..."
            rows={3}
            value={response}
            onChange={e => setResponse(e.target.value)}
            data-testid="input-challenge-response"
          />
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full transition-all", overLimit ? "bg-red-500" : pct > 80 ? "bg-orange-500" : "treffin-gradient")} style={{ width: `${pct}%` }} />
            </div>
            <span className={cn("text-xs font-medium w-16 text-right", overLimit ? "text-red-400" : pct > 80 ? "text-orange-400" : "text-muted-foreground")}>
              {wc}/300 words
            </span>
            <button
              className={cn("flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full transition-all", response.trim() && !overLimit && !isSubmitting ? "treffin-gradient text-white" : "bg-muted text-muted-foreground cursor-not-allowed")}
              onClick={handleSubmit}
              disabled={!response.trim() || overLimit || isSubmitting}
              data-testid="button-submit-challenge"
            >
              <Send className="w-3.5 h-3.5" /> {isSubmitting ? "Submitting…" : "Submit"}
            </button>
          </div>
        </div>
      ) : (
        <div className="px-5 pb-5 mt-2">
          <div className="flex items-center gap-2 bg-green-400/10 border border-green-400/20 rounded-xl px-4 py-3 text-sm text-green-400 font-medium">
            <Trophy className="w-4 h-4" /> Entry submitted! Good luck — winners are announced weekly.
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Stats Ribbon ───────────────────────────────────────────────────────── */
function StatsRibbon() {
  const { user } = useUser();
  const { sessionRep } = useAppContext();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user?.firstName ?? "Thinker";

  return (
    <div className="flex items-center gap-3 bg-card border border-border/60 rounded-xl px-4 py-3 overflow-x-auto scrollbar-none">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{greeting}, {firstName} 👋</p>
        <p className="text-xs text-muted-foreground">What will you debate today?</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {sessionRep > 0 && (
          <div className="flex items-center gap-1.5 text-primary">
            <Zap className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-xs font-bold whitespace-nowrap">+{sessionRep} rep today</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-indigo-400">
          <Trophy className="w-3.5 h-3.5" />
          <span className="text-xs font-bold whitespace-nowrap">Scholar</span>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────────────────── */
export default function Home() {
  const searchStr = useSearch();
  const params = new URLSearchParams(searchStr);
  const topicFilter = params.get("topic");
  const [, setLocation] = useLocation();
  const clearTopicFilter = () => setLocation("/");

  const [tab, setTab] = useState<Tab>("for_you");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const { data: communities, isLoading: communitiesLoading } = useGetCommunities({
    query: { queryKey: getGetCommunitiesQueryKey(), staleTime: 120_000, refetchOnWindowFocus: false },
  });

  const [showModal, setShowModal] = useState(false);
  const [banner, setBanner] = useState<string[] | null>(null);

  const { isSignedIn } = useUser();
  const { data: currentUser, isLoading: currentUserLoading } = useGetCurrentUser({
    query: { queryKey: getGetCurrentUserQueryKey(), enabled: !!isSignedIn, retry: false, staleTime: 60_000 },
  });

  useEffect(() => {
    if (localStorage.getItem(INTERESTS_STORAGE_KEY)) return;
    if (isSignedIn && currentUserLoading) return;

    if (isSignedIn && currentUser) {
      const dbInterests = currentUser.interests;
      if (Array.isArray(dbInterests) && dbInterests.length > 0) {
        localStorage.setItem(INTERESTS_STORAGE_KEY, JSON.stringify(dbInterests));
        return;
      }
    }

    if (!isSignedIn) return;

    const t = setTimeout(() => setShowModal(true), 600);
    return () => clearTimeout(t);
  }, [isSignedIn, currentUserLoading, currentUser]);

  const handleModalDone = (selected: string[]) => {
    setShowModal(false);
    setBanner(selected);
    setTimeout(() => setBanner(null), 3000);
  };

  const handleModalSkip = () => {
    setShowModal(false);
  };

  const feedParams = { tab } as const;
  const { data: feedData, isLoading: feedLoading } = useGetFeed(
    feedParams,
    { query: { queryKey: getGetFeedQueryKey(feedParams), staleTime: 30_000, refetchOnMount: true, refetchOnWindowFocus: false } }
  );
  const { data: debates, isLoading: debatesLoading } = useGetDebates(
    {},
    { query: { staleTime: 60_000, refetchOnWindowFocus: false } },
  );
  const { data: articles, isLoading: articlesLoading } = useGetArticles(
    {},
    { query: { staleTime: 60_000, refetchOnWindowFocus: false } },
  );

  useEffect(() => { if (topicFilter) setTab("for_you"); }, [topicFilter]);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 500);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const filteredFeed = topicFilter
    ? feedData?.filter(p => p.topic?.toLowerCase() === topicFilter.toLowerCase())
    : feedData;

  return (
    <AppLayout>
      <AnimatePresence>
        {showModal && (
          <InterestOnboardingModal onDone={handleModalDone} onSkip={handleModalSkip} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {banner && (
          <motion.div
            key="interests-banner"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="fixed top-[68px] left-1/2 -translate-x-1/2 z-[150] px-4 py-2.5 bg-primary/90 backdrop-blur-sm text-white text-xs font-semibold rounded-full shadow-lg border border-primary/50 whitespace-nowrap"
          >
            ✨ Feed personalised for: {banner.slice(0, 3).join(", ")}{banner.length > 3 ? ` +${banner.length - 3}` : ""}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-0">
        {/* Sticky tabs */}
        <div className="sticky top-[60px] z-40 bg-background/95 backdrop-blur-xl border-b border-border/60">
          <div className="flex items-center">
            <div className="flex items-center overflow-x-auto scrollbar-none flex-1">
              {TABS.map((t) => {
                const isDiscover = t.value === "following";
                return isDiscover ? (
                  <Link key={t.value} href="/discover">
                    <button data-testid={`tab-${t.value}`}
                      className="px-4 py-3.5 text-sm font-semibold whitespace-nowrap transition-all border-b-2 -mb-px shrink-0 border-transparent text-muted-foreground hover:text-foreground hover:border-border/50">
                      {t.label}
                    </button>
                  </Link>
                ) : (
                  <button key={t.value} onClick={() => setTab(t.value)} data-testid={`tab-${t.value}`}
                    className={cn("px-4 py-3.5 text-sm font-semibold whitespace-nowrap transition-all border-b-2 -mb-px shrink-0",
                      tab === t.value
                        ? "border-primary text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-border/50"
                    )}>
                    {t.label}
                  </button>
                );
              })}
            </div>
            <button
              className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground bg-muted/60 hover:bg-muted px-3 py-1.5 rounded-lg transition-colors mr-3 shrink-0"
              onClick={() => setTab("for_you")}
              data-testid="button-trending"
            >
              <Zap className="w-3.5 h-3.5 text-yellow-400" /> Trending
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4 pt-4">
          {/* Topic filter banner */}
          {topicFilter && (
            <div className="flex items-center justify-between bg-primary/10 border border-primary/25 rounded-xl px-4 py-2.5">
              <span className="text-sm font-semibold text-primary">Filtering by: {topicFilter}</span>
              <Link href="/"><button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /> Clear</button></Link>
            </div>
          )}

          {/* FOR YOU */}
          {tab === "for_you" && !topicFilter && (
            <>
              <Show when="signed-in">
                <StatsRibbon />
              </Show>

              {/* Quick action cards */}
              <QuickActionCards onTabChange={setTab} />

              {/* Hero daily question */}
              <HeroDailyQuestion />

              <PostComposer />

              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.05 }}>
                <WeeklyChallengeCard />
              </motion.div>
            </>
          )}

          {/* DEBATES tab */}
          {tab === "debates" && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-base">Live Debates</h2>
                <Link href="/debates"><span className="text-xs text-primary hover:underline cursor-pointer">View all →</span></Link>
              </div>
              {debatesLoading ? Array(4).fill(0).map((_, i) => <Skeleton key={i} className="w-full h-[130px] rounded-xl" />) : (
                debates?.slice(0, 8).map((debate, index) => (
                  <motion.div key={debate.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
                    <Link href={`/debates/${debate.id}`}>
                      <div className="bg-card border border-border/60 rounded-xl p-4 hover:border-primary/40 cursor-pointer transition-all group">
                        <div className="flex justify-between items-start mb-2 gap-2 flex-wrap">
                          <CategoryPill category={debate.category} />
                          <div className="flex items-center gap-1.5 ml-auto">
                            <CountdownChip endsAt={debate.endsAt} />
                            {debate.isLive && <span className="flex items-center gap-1 text-[10px] font-bold text-red-400 uppercase"><span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" /> Live</span>}
                          </div>
                        </div>
                        <h3 className="font-bold text-sm group-hover:text-primary transition-colors">{debate.title}</h3>
                        <div className="flex flex-col gap-1.5 mt-3">
                          <div className="flex justify-between text-xs font-semibold"><span className="text-indigo-400">Support {debate.supportPercent}%</span><span className="text-rose-400">Against {debate.againstPercent}%</span></div>
                          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden flex">
                            <div className="h-full bg-indigo-500" style={{ width: `${debate.supportPercent}%` }} />
                            <div className="h-full bg-rose-500" style={{ width: `${debate.againstPercent}%` }} />
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="w-3 h-3" /> {formatNumber(debate.participantCount)} participants</div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))
              )}
            </div>
          )}

          {/* ARTICLES tab */}
          {tab === "articles" && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-base">Latest Articles</h2>
                <Link href="/articles"><span className="text-xs text-primary hover:underline cursor-pointer">View all →</span></Link>
              </div>
              {articlesLoading ? Array(4).fill(0).map((_, i) => <Skeleton key={i} className="w-full h-[160px] rounded-xl" />) : (
                articles?.slice(0, 8).map((article: any, index: number) => (
                  <motion.div key={article.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
                    <ArticleCard post={{ ...article, type: "article" }} />
                  </motion.div>
                ))
              )}
            </div>
          )}

          {/* COMMUNITIES tab */}
          {tab === "communities" && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-base">Communities</h2>
                <Link href="/communities"><span className="text-xs text-primary hover:underline cursor-pointer">Browse all →</span></Link>
              </div>
              {communitiesLoading ? (
                Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
              ) : (communities ?? []).slice(0, 6).map((c, i) => {
                const GRADIENTS = [
                  "from-blue-500/20 to-card border-blue-500/25",
                  "from-indigo-500/20 to-card border-indigo-500/25",
                  "from-rose-500/20 to-card border-rose-500/20",
                  "from-emerald-500/20 to-card border-emerald-500/20",
                  "from-violet-500/20 to-card border-violet-500/20",
                  "from-amber-500/20 to-card border-amber-500/20",
                ];
                const gradient = GRADIENTS[i % GRADIENTS.length];
                const emoji = c.emoji ?? ["🤖", "🧠", "🌍", "🔬", "⚡", "📚"][i % 6];
                return (
                  <motion.div key={c.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                    <Link href={`/communities/${c.id}`}>
                      <div className={cn("bg-gradient-to-br border rounded-xl p-4 cursor-pointer hover:scale-[1.01] transition-all group", gradient)}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-xl shrink-0">{emoji}</div>
                            <div>
                              <h3 className="font-bold text-sm group-hover:text-primary transition-colors">{c.name}</h3>
                              {c.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{c.description}</p>}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="w-3.5 h-3.5" /> {formatNumber(c.memberCount)}</div>
                            {c.isLive && <span className="text-[10px] text-green-400 font-semibold">Live</span>}
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
              <Link href="/communities">
                <button className="w-full py-3 border border-dashed border-border/60 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">
                  Browse all communities →
                </button>
              </Link>
            </div>
          )}

          {/* FEED (for_you / discover) */}
          {(tab === "for_you" || tab === "following") && (
            <div className="flex flex-col gap-3">
              {feedLoading ? (
                Array(4).fill(0).map((_, i) => (
                  <div key={i} className="bg-card border border-border/60 rounded-xl p-4 flex flex-col gap-3">
                    <div className="flex items-center gap-3"><Skeleton className="w-10 h-10 rounded-full" /><div className="flex flex-col gap-1.5 flex-1"><Skeleton className="h-3.5 w-32" /><Skeleton className="h-3 w-20" /></div></div>
                    <Skeleton className="h-16 w-full" />
                  </div>
                ))
              ) : !filteredFeed?.length ? (
                <div className="flex flex-col items-center gap-3 py-16 text-center bg-card border border-border rounded-2xl">
                  <div className="w-14 h-14 rounded-full bg-muted/40 border border-border flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="text-base font-semibold">{topicFilter ? `No posts about "${topicFilter}"` : "Your feed is quiet"}</p>
                  <p className="text-xs text-muted-foreground max-w-xs">{topicFilter ? "Try clearing the topic filter or starting a debate about it." : "Share the first idea. Your thinking helps shape the community."}</p>
                  <button
                    className="mt-2 treffin-gradient text-white text-sm font-semibold px-4 py-2 rounded-full hover:opacity-90 transition-opacity"
                    onClick={() => topicFilter ? clearTopicFilter() : document.querySelector<HTMLTextAreaElement>('[data-testid="input-post-composer"]')?.focus()}
                    data-testid="button-feed-empty-cta"
                  >
                    {topicFilter ? "Clear filter" : "Share an idea"}
                  </button>
                </div>
              ) : (
                <AnimatePresence>
                  {filteredFeed?.map((item, index) => (
                    <motion.div key={item.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04, duration: 0.3 }}>
                      {item.type === "opinion" && <PostCard post={item} />}
                      {item.type === "article" && <ArticleCard post={item} />}
                      {item.type === "knowledge" && <KnowledgeCard post={item} />}
                      {(item.type === "debate_highlight" || item.type === "quote") && <PostCard post={item} />}
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Scroll-to-top button */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            key="scroll-top"
            initial={{ opacity: 0, scale: 0.8, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 8 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="fixed bottom-[88px] md:bottom-8 right-5 z-50 w-11 h-11 rounded-full flex items-center justify-center shadow-xl border border-border/60 text-foreground hover:text-primary transition-colors"
            style={{ background: "color-mix(in srgb, var(--color-background) 90%, transparent)", backdropFilter: "blur(12px)" }}
            aria-label="Back to top"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 12V4M4 7l4-4 4 4" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
