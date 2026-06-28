import { useGetMathLeaderboard } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getMathUserId } from "@/lib/math-auth";
import { Link } from "wouter";
import { Trophy, Star, FlaskConical, BookOpen } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";

function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-2xl">🥇</span>;
  if (rank === 2) return <span className="text-2xl">🥈</span>;
  if (rank === 3) return <span className="text-2xl">🥉</span>;
  return (
    <span className="w-9 h-9 flex items-center justify-center font-bold text-sm text-muted-foreground">
      #{rank}
    </span>
  );
}

export default function Leaderboard() {
  const myUserId = getMathUserId();
  const { data: entries, isLoading } = useGetMathLeaderboard({ limit: 50 });

  return (
    <AppLayout>
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <div className="mb-10 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
          <Trophy className="w-8 h-8 text-amber-500" />
        </div>
        <h1 className="text-2xl sm:text-4xl font-serif font-bold mb-2">Math Leaderboard</h1>
        <p className="text-muted-foreground text-lg">Top problem solvers across all categories</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : entries && entries.length > 0 ? (
        <div className="space-y-3">
          {entries.map((entry) => {
            const isMe = entry.userId === myUserId;
            return (
              <Link
                key={entry.userId}
                href={`/math/users/${entry.userId}`}
                className={`block bg-card border rounded-xl p-4 hover:border-primary/40 transition-all group ${
                  isMe ? "border-primary/50 bg-primary/5" : "border-border"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="shrink-0 flex items-center justify-center w-12">
                    <RankMedal rank={entry.rank} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {entry.displayName}
                      </span>
                      {isMe && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-primary/15 text-primary rounded-full font-medium">
                          You
                        </span>
                      )}
                      {entry.favoriteCategory && (
                        <span className="text-xs text-muted-foreground hidden sm:inline">{entry.favoriteCategory}</span>
                      )}
                    </div>
                    {entry.bio && (
                      <p className="text-sm text-muted-foreground truncate">{entry.bio}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-6 shrink-0">
                    <div className="text-center hidden sm:block">
                      <div className="flex items-center gap-1 justify-center">
                        <FlaskConical className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="font-semibold">{entry.totalSolutions}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">solutions</div>
                    </div>
                    <div className="text-center hidden sm:block">
                      <div className="flex items-center gap-1 justify-center">
                        <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="font-semibold">{entry.totalProblems}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">problems</div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center gap-1 justify-center text-amber-500">
                        <Star className="w-3.5 h-3.5" />
                        <span className="font-bold">{entry.reputationScore}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">rep</div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="bg-card/30 border border-border border-dashed rounded-2xl p-16 text-center">
          <Trophy className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground text-lg">No rankings yet.</p>
          <p className="text-muted-foreground/60 text-sm mt-1">Submit solutions to appear here!</p>
        </div>
      )}
    </div>
    </AppLayout>
  );
}
