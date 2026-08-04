import { useGetMathUserProfile } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { MathText } from "@/components/math/math-renderer";
import { getMathUserId } from "@/lib/math-auth";
import { FlaskConical, BookOpen, Star, Trophy, Flame } from "lucide-react";

function StatCard({ icon: Icon, value, label, color }: { icon: React.ElementType; value: number; label: string; color: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 text-center">
      <Icon className={`w-5 h-5 mx-auto mb-2 ${color}`} />
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

export default function MathUserProfile() {
  const { userId } = useParams<{ userId: string }>();
  const myUserId = getMathUserId();
  const isMe = userId === myUserId;

  const { data: profile, isLoading } = useGetMathUserProfile(userId);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-10 max-w-3xl space-y-6">
        <div className="flex items-center gap-6">
          <Skeleton className="w-20 h-20 rounded-2xl" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-2xl font-serif mb-4">User not found</h1>
        <Link href="/math/leaderboard" className="text-primary hover:underline">
          View leaderboard
        </Link>
      </div>
    );
  }

  const initials = profile.displayName.slice(0, 2).toUpperCase();

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl space-y-8">
      {/* Profile Header */}
      <div className="bg-card border border-border rounded-2xl p-4 sm:p-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
        <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6 relative">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white font-bold text-2xl font-serif shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h1 className="text-2xl font-serif font-bold">{profile.displayName}</h1>
              {isMe && (
                <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary">
                  You
                </Badge>
              )}
            </div>
            {profile.bio && (
              <p className="text-muted-foreground mb-2">{profile.bio}</p>
            )}
            <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
              {profile.favoriteCategory && (
                <span>📐 {profile.favoriteCategory}</span>
              )}
              <span>Joined {new Date(profile.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Star} value={profile.reputationScore} label="Rep Score" color="text-amber-500" />
        <StatCard icon={FlaskConical} value={profile.totalSolutions} label="Solutions" color="text-blue-500" />
        <StatCard icon={BookOpen} value={profile.totalProblems} label="Problems" color="text-green-500" />
        <StatCard icon={Flame} value={profile.streak} label="Day Streak" color="text-orange-500" />
      </div>

      {/* Recent Problems */}
      {profile.recentProblems && profile.recentProblems.length > 0 && (
        <section>
          <h2 className="font-serif font-bold text-xl mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-muted-foreground" />
            Recent Problems
          </h2>
          <div className="space-y-2">
            {profile.recentProblems.map((p) => (
              <Link key={p.id} href={`/math/problem/${p.id}`}>
                <div className="bg-card border border-border hover:border-primary/30 rounded-xl px-5 py-4 transition-all group">
                  <div className="font-medium font-serif text-foreground group-hover:text-primary transition-colors mb-1">
                    <MathText text={p.title} />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="capitalize">{p.difficulty}</span>
                    <span>·</span>
                    <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recent Solutions */}
      {profile.recentSolutions && profile.recentSolutions.length > 0 && (
        <section>
          <h2 className="font-serif font-bold text-xl mb-4 flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-muted-foreground" />
            Recent Solutions
          </h2>
          <div className="space-y-2">
            {profile.recentSolutions.map((s) => (
              <Link key={s.id} href={`/math/problem/${s.problemId}`}>
                <div className="bg-card border border-border hover:border-primary/30 rounded-xl px-5 py-4 transition-all group">
                  <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors mb-1.5 font-serif line-clamp-2">
                    <MathText text={s.body} />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px] h-4">{s.approach}</Badge>
                    <span>{new Date(s.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {profile.totalSolutions === 0 && profile.totalProblems === 0 && (
        <div className="bg-card/30 border border-dashed border-border rounded-2xl p-8 sm:p-12 text-center">
          <Trophy className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">No activity yet</p>
        </div>
      )}
    </div>
  );
}
