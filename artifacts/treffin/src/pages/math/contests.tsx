import { useState, useEffect } from "react";
import { useListMathContests } from "@workspace/api-client-react";
import type { MathContest } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Swords, Users, Calendar, Clock, ChevronRight } from "lucide-react";
import { fmtCountdown } from "@/lib/math-utils";
import { AppLayout } from "@/components/layout/app-layout";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-green-500/10 text-green-500 border-green-500/20",
    upcoming: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    past: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  };
  return (
    <Badge variant="outline" className={styles[status] ?? styles.past}>
      {status === "active" ? "🟢 Live" : status === "upcoming" ? "🔵 Upcoming" : "⚫ Ended"}
    </Badge>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const colors: Record<string, string> = {
    beginner: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    intermediate: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    advanced: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    olympiad: "bg-red-500/10 text-red-500 border-red-500/20",
  };
  return (
    <Badge variant="outline" className={colors[difficulty] ?? colors.intermediate}>
      {difficulty}
    </Badge>
  );
}

export default function Contests() {
  const { data: contests, isLoading } = useListMathContests();

  const active = contests?.filter((c) => c.status === "active") ?? [];
  const upcoming = contests?.filter((c) => c.status === "upcoming") ?? [];
  const past = contests?.filter((c) => c.status === "past") ?? [];

  return (
    <AppLayout>
    <div className="container mx-auto px-4 py-10 max-w-4xl">
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Swords className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold">Math Competitions</h1>
            <p className="text-muted-foreground">Timed contests to test your problem-solving skills</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-10">
          {active.length > 0 && (
            <section>
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Live Now
              </h2>
              <div className="space-y-3">
                {active.map((c) => <ContestCard key={c.id} contest={c} />)}
              </div>
            </section>
          )}

          {upcoming.length > 0 && (
            <section>
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Upcoming</h2>
              <div className="space-y-3">
                {upcoming.map((c) => <ContestCard key={c.id} contest={c} />)}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section>
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Past Contests</h2>
              <div className="space-y-3">
                {past.map((c) => <ContestCard key={c.id} contest={c} />)}
              </div>
            </section>
          )}

          {!isLoading && (active.length + upcoming.length + past.length) === 0 && (
            <div className="bg-card/30 border border-dashed border-border rounded-2xl p-8 sm:p-16 text-center">
              <Swords className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground text-lg">No contests yet</p>
              <p className="text-sm text-muted-foreground/60 mt-1">Check back soon for upcoming competitions!</p>
            </div>
          )}
        </div>
      )}
    </div>
    </AppLayout>
  );
}

function ContestCard({ contest }: { contest: MathContest }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const start = new Date(contest.startTime);
  const end = new Date(contest.endTime);
  const timeLeft = end.getTime() - now;
  const timeUntil = start.getTime() - now;

  return (
    <Link href={`/math/contests/${contest.id}`}>
      <div className="bg-card border border-border hover:border-primary/40 rounded-xl p-5 cursor-pointer transition-all group">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <StatusBadge status={contest.status ?? "past"} />
              <DifficultyBadge difficulty={contest.difficulty} />
            </div>
            <h3 className="font-serif font-bold text-lg text-foreground group-hover:text-primary transition-colors mb-1.5">
              {contest.title}
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-2">{contest.description}</p>
            {contest.prizeDescription && (
              <p className="text-xs text-amber-500 mt-2 font-medium">🏆 {contest.prizeDescription}</p>
            )}
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
        </div>

        <div className="flex items-center gap-6 mt-4 text-xs text-muted-foreground border-t border-border pt-3">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            <span>{contest.totalParticipants} participants</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>{start.toLocaleDateString()}</span>
          </div>
          {contest.status === "active" && timeLeft > 0 && (
            <div className="flex items-center gap-1.5 text-green-500 font-medium">
              <Clock className="w-3.5 h-3.5" />
              <span>{fmtCountdown(timeLeft)} left</span>
            </div>
          )}
          {contest.status === "upcoming" && timeUntil > 0 && (
            <div className="flex items-center gap-1.5 text-blue-500 font-medium">
              <Clock className="w-3.5 h-3.5" />
              <span>Starts in {fmtCountdown(timeUntil)}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
