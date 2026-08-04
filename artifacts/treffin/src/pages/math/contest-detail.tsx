import { useState, useEffect } from "react";
import { useGetMathContest, useEnterMathContest, getGetMathContestQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getMathUserId } from "@/lib/math-auth";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { MathText } from "@/components/math/math-renderer";
import { Swords, Trophy, Users, Calendar, Clock, Star, CheckCircle2 } from "lucide-react";
import { fmtCountdown } from "@/lib/math-utils";

function TimeDisplay({ startTime, endTime, status }: { startTime: string; endTime: string; status?: string }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const start = new Date(startTime);
  const end = new Date(endTime);
  const timeLeft = end.getTime() - now;
  const timeUntil = start.getTime() - now;

  if (status === "active" && timeLeft > 0) {
    return (
      <div className="flex items-center gap-2 text-green-500 font-medium">
        <Clock className="w-4 h-4" />
        <span className="tabular-nums">{fmtCountdown(timeLeft)} remaining</span>
      </div>
    );
  }
  if (status === "upcoming" && timeUntil > 0) {
    return (
      <div className="flex items-center gap-2 text-blue-500 font-medium">
        <Clock className="w-4 h-4" />
        <span className="tabular-nums">Starts in {fmtCountdown(timeUntil)}</span>
      </div>
    );
  }
  return (
    <div className="text-muted-foreground text-sm flex items-center gap-2">
      <Calendar className="w-4 h-4" />
      <span>{start.toLocaleDateString()} – {end.toLocaleDateString()}</span>
    </div>
  );
}

export default function ContestDetail() {
  const { contestId } = useParams<{ contestId: string }>();
  const id = Number(contestId);
  const userId = getMathUserId();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: contest, isLoading } = useGetMathContest(id, {
    query: { enabled: !!id, queryKey: getGetMathContestQueryKey(id) },
  });

  const enter = useEnterMathContest();

  const handleEnter = () => {
    if (!userId) {
      toast({ title: "Sign in required", description: "Please sign in to enter the contest.", variant: "destructive" });
      return;
    }
    enter.mutate(
      { contestId: id },
      {
        onSuccess: () => {
          toast({ title: "Entered!", description: "You've joined the contest." });
          queryClient.invalidateQueries({ queryKey: getGetMathContestQueryKey(id) });
        },
        onError: () => {
          toast({ title: "Error", description: "Could not join contest.", variant: "destructive" });
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-10 max-w-4xl space-y-6">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!contest) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-2xl font-serif mb-4">Contest not found</h1>
        <Link href="/math/contests" className="text-primary hover:underline">Back to contests</Link>
      </div>
    );
  }

  const hasEntered = !!contest.myEntry;
  const statusColors: Record<string, string> = {
    active: "bg-green-500/10 text-green-500 border-green-500/20",
    upcoming: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    past: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl space-y-8">
      <Link href="/math/contests" className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 w-fit">
        &larr; All Contests
      </Link>

      {/* Contest Header */}
      <div className="bg-card border border-border rounded-2xl p-4 sm:p-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
        <div className="relative">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className={statusColors[contest.status ?? "past"]}>
                {contest.status === "active" ? "🟢 Live" : contest.status === "upcoming" ? "🔵 Upcoming" : "⚫ Ended"}
              </Badge>
              <Badge variant="outline" className="capitalize">{contest.difficulty}</Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              <span>{contest.totalParticipants} participants</span>
            </div>
          </div>

          <h1 className="text-3xl font-serif font-bold mb-3">{contest.title}</h1>
          <p className="text-muted-foreground mb-5">{contest.description}</p>

          {contest.prizeDescription && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-lg text-sm font-medium mb-5">
              <Trophy className="w-4 h-4" />
              {contest.prizeDescription}
            </div>
          )}

          <div className="flex items-center justify-between flex-wrap gap-4">
            <TimeDisplay startTime={contest.startTime} endTime={contest.endTime} status={contest.status ?? undefined} />

            {hasEntered ? (
              <div className="flex items-center gap-2 text-green-500 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" />
                <span>Entered (score: {contest.myEntry?.score ?? 0})</span>
              </div>
            ) : contest.status !== "past" ? (
              <Button onClick={handleEnter} disabled={enter.isPending}>
                <Swords className="w-4 h-4 mr-2" />
                {enter.isPending ? "Joining…" : "Enter Contest"}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Problems */}
        <section>
          <h2 className="font-serif font-bold text-xl mb-4 flex items-center gap-2">
            Problems
            <Badge variant="secondary" className="font-sans font-normal">
              {contest.problems?.length ?? 0}
            </Badge>
          </h2>
          {contest.problems && contest.problems.length > 0 ? (
            <div className="space-y-2">
              {contest.problems.map((p, i) => (
                <Link key={p.id} href={`/math/problem/${p.id}`}>
                  <div className="bg-card border border-border hover:border-primary/30 rounded-xl px-5 py-4 transition-all group">
                    <div className="flex items-start gap-3">
                      <span className="text-lg font-mono font-bold text-muted-foreground/50 w-6 shrink-0">
                        {i + 1}.
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium font-serif text-foreground group-hover:text-primary transition-colors mb-1">
                          <MathText text={p.title} />
                        </div>
                        <Badge variant="outline" className="text-[10px] h-4 capitalize">{p.difficulty}</Badge>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="bg-card/30 border border-dashed border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
              Problems will be announced when the contest starts.
            </div>
          )}
        </section>

        {/* Leaderboard */}
        <section>
          <h2 className="font-serif font-bold text-xl mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            Leaderboard
          </h2>
          {contest.leaderboard && contest.leaderboard.length > 0 ? (
            <div className="space-y-2">
              {contest.leaderboard.slice(0, 10).map((entry, i) => {
                const isMe = entry.userId === userId;
                return (
                  <div
                    key={entry.id}
                    className={`flex items-center gap-3 bg-card border rounded-xl px-4 py-3 ${
                      isMe ? "border-primary/40 bg-primary/5" : "border-border"
                    }`}
                  >
                    <span className="text-sm font-bold w-6 text-center text-muted-foreground">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                    </span>
                    <div className="flex-1 font-medium text-sm">
                      {entry.userName}
                      {isMe && <span className="ml-1.5 text-[10px] px-1 py-0.5 bg-primary/15 text-primary rounded">You</span>}
                    </div>
                    <div className="flex items-center gap-1 text-sm font-bold text-amber-500">
                      <Star className="w-3.5 h-3.5" />
                      {entry.score}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-card/30 border border-dashed border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
              No entries yet. Be the first to compete!
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
