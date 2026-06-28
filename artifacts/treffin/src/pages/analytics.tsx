import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { TrendingUp, MessageCircle, Award, BookOpen, FileText, Zap, Crown, Trophy } from "lucide-react";
import { formatNumber, cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetTopThinkers } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const BASE = () => (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

type AnalyticsData = {
  totals: {
    rep: number;
    repThisWeek: number;
    articlesCreated: number;
    debatesJoined: number;
    postsCreated: number;
    commentsPosted: number;
  };
  repByDay: { date: string; rep: number }[];
  repByCategory: {
    debates: number;
    articles: number;
    votes: number;
    posts: number;
    community: number;
  };
  eventBreakdown: { type: string; label: string; count: number; totalPoints: number }[];
};

function useAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE()}/api/analytics/me`, { credentials: "include" })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { data, loading };
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-card border border-border rounded-xl p-3 shadow-xl text-xs">
        <p className="font-semibold mb-1">{label}</p>
        {payload.map((entry: any) => (
          <p key={entry.name} style={{ color: entry.color }}>
            {entry.name}: +{formatNumber(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const CAT_COLORS: Record<string, string> = {
  debates: "#6366f1",
  articles: "#3b82f6",
  votes: "#f59e0b",
  posts: "#10b981",
  community: "#f43f5e",
};

const CAT_LABELS: Record<string, string> = {
  debates: "Debates",
  articles: "Articles",
  votes: "Votes & Challenges",
  posts: "Posts & Comments",
  community: "Community",
};

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: number; sub: string; color: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Icon className={cn("w-4 h-4", color)} />
        <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{sub}</span>
      </div>
      <div className="text-xl font-bold">{formatNumber(value)}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function PublicLeaderboard() {
  const [, setLocation] = useLocation();
  const { data: thinkers, isLoading } = useGetTopThinkers({ period: "this_week" });
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-base flex items-center gap-2">
          <Trophy className="w-4 h-4 text-yellow-400" /> Top Thinkers
        </h2>
        <span className="text-xs text-muted-foreground">This week</span>
      </div>
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
        </div>
      ) : !thinkers?.length ? (
        <p className="text-xs text-muted-foreground py-6 text-center">No leaderboard data yet.</p>
      ) : (
        <div className="flex flex-col divide-y divide-border/40">
          {thinkers.slice(0, 10).map((t, i) => (
            <button
              key={t.id}
              className="flex items-center gap-3 py-2.5 text-left hover:bg-muted/30 rounded-md transition-colors"
              onClick={() => setLocation(`/profile/${t.id}`)}
              data-testid={`leaderboard-row-${t.id}`}
            >
              <span className={cn(
                "w-6 text-center text-xs font-bold shrink-0",
                i === 0 ? "text-yellow-400" : i === 1 ? "text-slate-300" : i === 2 ? "text-orange-400" : "text-muted-foreground",
              )}>
                {i === 0 ? <Crown className="w-3.5 h-3.5 mx-auto" /> : `#${i + 1}`}
              </span>
              <Avatar className="w-8 h-8 shrink-0">
                {t.avatarUrl && <AvatarImage src={t.avatarUrl} alt={t.name} />}
                <AvatarFallback className="text-[10px] bg-primary/20 text-primary">{t.name.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{t.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">{t.title}</p>
              </div>
              <span className="text-xs font-bold text-primary shrink-0">{formatNumber(t.reputationScore ?? 0)} rep</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Analytics() {
  const { isSignedIn, isLoaded } = useUser();
  const [, setLocation] = useLocation();
  const { data, loading } = useAnalytics();

  if (isLoaded && !isSignedIn) {
    return (
      <AppLayout>
        <div className="flex flex-col gap-6">
          <div className="sticky top-[60px] z-40 bg-background/95 backdrop-blur-sm pb-4 border-b border-border pt-4">
            <h1 className="text-2xl font-bold">Top Thinkers</h1>
            <p className="text-sm text-muted-foreground mt-0.5">The community's leaderboard, public for everyone.</p>
          </div>
          <PublicLeaderboard />
          <div className="bg-card border border-border rounded-xl p-5 text-center flex flex-col items-center gap-3">
            <p className="text-sm font-semibold">Want to see your own stats?</p>
            <p className="text-xs text-muted-foreground max-w-sm">Sign in to track your rep, debates joined, articles published, and more.</p>
            <button
              className="treffin-gradient text-white text-sm font-semibold px-4 py-2 rounded-full hover:opacity-90 transition-opacity"
              onClick={() => setLocation("/sign-in")}
              data-testid="button-analytics-signin"
            >
              Sign in
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const pieData = data
    ? Object.entries(data.repByCategory)
        .filter(([, v]) => v > 0)
        .map(([key, value]) => ({
          name: CAT_LABELS[key] ?? key,
          value,
          color: CAT_COLORS[key] ?? "#6b7280",
        }))
    : [];

  const barData = data
    ? Object.entries(data.repByCategory)
        .filter(([, v]) => v > 0)
        .map(([key, value]) => ({ name: CAT_LABELS[key] ?? key, value, key }))
    : [];

  const hasActivity = !!data && data.totals.rep > 0;

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div className="sticky top-[60px] z-40 bg-background/95 backdrop-blur-sm pb-4 border-b border-border pt-4">
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your real activity on Treffin</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {loading
            ? Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
            : (
              <>
                <StatCard icon={Award}         label="Total Reputation"   value={data?.totals.rep ?? 0}             sub="all time"    color="text-yellow-400" />
                <StatCard icon={Zap}           label="Rep This Week"      value={data?.totals.repThisWeek ?? 0}     sub="last 7 days" color="text-primary" />
                <StatCard icon={TrendingUp}    label="Debates Joined"     value={data?.totals.debatesJoined ?? 0}   sub="total"       color="text-indigo-400" />
                <StatCard icon={BookOpen}      label="Articles Published" value={data?.totals.articlesCreated ?? 0} sub="total"       color="text-blue-400" />
                <StatCard icon={FileText}      label="Posts Created"      value={data?.totals.postsCreated ?? 0}    sub="total"       color="text-emerald-400" />
                <StatCard icon={MessageCircle} label="Comments Posted"    value={data?.totals.commentsPosted ?? 0}  sub="total"       color="text-indigo-400" />
              </>
            )}
        </div>

        {/* Rep over time — area chart */}
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-base">Rep Earned Over Time</h2>
            <span className="text-xs text-muted-foreground">Last 14 days</span>
          </div>
          {loading ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data?.repByDay ?? []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="repGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }}
                    axisLine={false} tickLine={false} interval={3} />
                  <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="rep" name="Rep" stroke="#6366f1"
                    fill="url(#repGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
              {!hasActivity && (
                <p className="text-xs text-muted-foreground text-center -mt-2">
                  No activity yet. Vote, post, or join a debate to start earning rep.
                </p>
              )}
            </>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Rep by category — donut */}
          <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
            <h2 className="font-bold text-base">Rep by Category</h2>
            {loading ? (
              <Skeleton className="h-36 w-full rounded-xl" />
            ) : pieData.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={130} height={130}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={36} outerRadius={58}
                      paddingAngle={3} dataKey="value">
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2 flex-1 min-w-0">
                  {pieData.map(t => (
                    <div key={t.name} className="flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                      <span className="text-muted-foreground truncate">{t.name}</span>
                      <span className="font-bold ml-auto shrink-0">+{formatNumber(t.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-8 text-center">No rep earned yet.</p>
            )}
          </div>

          {/* Activity breakdown list */}
          <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
            <h2 className="font-bold text-base">Activity Breakdown</h2>
            {loading ? (
              <div className="flex flex-col gap-2">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-8 w-full rounded-lg" />)}
              </div>
            ) : data && data.eventBreakdown.length > 0 ? (
              <div className="flex flex-col divide-y divide-border/40">
                {data.eventBreakdown.map(e => (
                  <div key={e.type} className="flex items-center gap-3 py-2">
                    <span className="text-xs text-muted-foreground flex-1 truncate">{e.label}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{e.count}×</span>
                    <span className="text-xs font-bold text-primary shrink-0 w-12 text-right">
                      +{formatNumber(e.totalPoints)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-8 text-center">No activity yet.</p>
            )}
          </div>
        </div>

        <PublicLeaderboard />

        {/* Category bar chart — only shown when there's data across multiple categories */}
        {!loading && hasActivity && barData.length > 1 && (
          <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
            <h2 className="font-bold text-base">Rep by Category</h2>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={barData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="Rep" radius={[4, 4, 0, 0]}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={CAT_COLORS[entry.key] ?? "#6b7280"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
