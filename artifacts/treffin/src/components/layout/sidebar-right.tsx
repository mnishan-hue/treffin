import React from "react";
import { Link, useLocation } from "wouter";
import { useGetTrendingDebates, useGetTopThinkers } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatNumber } from "@/lib/utils";
import { TrendingUp, Users, Crown, Zap, Lock } from "lucide-react";
import { MathHomeTeaser } from "@/components/math/math-home-teaser";
import { MathSidebar } from "@/components/math/math-sidebar";

/* tiny sparkline using SVG */
function Sparkline({ values, color = "#4F6AF7" }: { values: number[]; color?: string }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const w = 56, h = 20;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
      <polyline points={pts} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}


const RANK_COLORS = [
  "from-yellow-400/20 to-amber-400/20 border-yellow-400/30 text-yellow-300",
  "from-slate-400/20 to-gray-300/20 border-slate-400/30 text-slate-300",
  "from-amber-600/20 to-amber-700/20 border-amber-600/30 text-amber-500",
];
const RANK_ICONS = ["🥇", "🥈", "🥉"];


export function SidebarRight() {
  const [location] = useLocation();
  const isMathPage = location.startsWith("/math");

  const { data: trendingDebates, isLoading: trendingLoading } = useGetTrendingDebates();
  const { data: topThinkers, isLoading: thinkersLoading } = useGetTopThinkers({ period: "this_week" });

  /* ── Math-specific sidebar ── */
  if (isMathPage) {
    return (
      <div className="flex flex-col gap-4">
        <MathHomeTeaser />
        <MathSidebar />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Mathematics Universe teaser — shown on all pages */}
      <MathHomeTeaser />

      {/* Trending Debates */}
      <div className="bg-card border border-border/60 rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-primary" />
            <h2 className="text-[13px] font-bold tracking-tight">Trending Debates</h2>
          </div>
          <Link href="/debates">
            <span className="text-[11px] text-primary cursor-pointer hover:underline">View All</span>
          </Link>
        </div>

        {trendingLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-3 items-start">
                <Skeleton className="h-5 w-5 rounded" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {trendingDebates?.slice(0, 5).map((debate, i) => (
              <Link key={debate.id} href={`/debates/${debate.id}`}>
                <div className="flex gap-3 items-start group cursor-pointer px-2 py-2.5 rounded-lg hover:bg-muted/50 transition-colors -mx-2">
                  {/* Rank number */}
                  <div className="w-5 h-5 rounded-md bg-muted/60 flex items-center justify-center text-[11px] font-black text-muted-foreground shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium leading-snug group-hover:text-primary transition-colors line-clamp-2">
                      {debate.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Users className="w-3 h-3" />
                        {formatNumber(debate.participantCount)}
                      </div>
                      {debate.trend === "up" && (
                        <span className="text-[10px] font-bold text-green-400 flex items-center gap-0.5">
                          <TrendingUp className="w-2.5 h-2.5" /> Hot
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Real 7-day vote sparkline */}
                  <div
                    className="shrink-0 mt-1 opacity-70 group-hover:opacity-100 transition-opacity flex flex-col items-end"
                    title="Votes over the last 7 days"
                  >
                    <Sparkline
                      values={debate.dailyVotes && debate.dailyVotes.some(v => v > 0) ? debate.dailyVotes : [0,0,0,0,0,0,0]}
                      color={debate.trend === "up" ? "#4ade80" : "#4F6AF7"}
                    />
                    <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider leading-none mt-0.5">7d votes</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Top Thinkers */}
      <div className="bg-card border border-border/60 rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="w-3.5 h-3.5 text-yellow-400" />
            <h2 className="text-[13px] font-bold tracking-tight">Top Thinkers</h2>
          </div>
          <span className="text-[11px] text-muted-foreground">This Week</span>
        </div>

        {thinkersLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-2.5 items-center">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-2.5 w-16" />
                </div>
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {topThinkers?.slice(0, 5).map((thinker, i) => (
              <Link key={thinker.id} href={`/profile/${thinker.id}`}>
                <div className="flex gap-2.5 items-center group cursor-pointer px-2 py-2 rounded-lg hover:bg-muted/50 transition-colors -mx-2">
                  {/* Rank medal */}
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center text-xs shrink-0 border ${i < 3 ? RANK_COLORS[i] + " bg-gradient-to-br" : "bg-muted/50 text-muted-foreground border-border"}`}>
                    {i < 3 ? RANK_ICONS[i] : <span className="text-[10px] font-bold">{i + 1}</span>}
                  </div>
                  <Avatar className="w-7 h-7 shrink-0">
                    <AvatarImage src={thinker.avatarUrl || ""} />
                    <AvatarFallback className="text-[10px] bg-primary/20 text-primary font-bold">
                      {thinker.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold truncate group-hover:text-primary transition-colors leading-tight">
                      {thinker.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">{thinker.title}</p>
                  </div>
                  <div className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full shrink-0 border border-primary/20">
                    {formatNumber(thinker.reputationScore)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Elite Thinkers */}
      <div className="relative overflow-hidden rounded-xl border border-yellow-500/25 bg-gradient-to-br from-yellow-950/50 via-amber-950/30 to-card p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="w-3.5 h-3.5 text-yellow-400" />
            <h2 className="text-[13px] font-bold text-yellow-200">Elite Thinkers</h2>
          </div>
          <div className="flex items-center gap-1 text-[10px] font-bold text-yellow-500/80 uppercase tracking-widest">
            <Lock className="w-2.5 h-2.5" /> Top 1%
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed -mt-1">
          Exclusive tier for 8,000+ rep users. Earn your place through consistent contributions.
        </p>
        <div className="flex flex-col gap-2">
          {topThinkers?.slice(0, 3).map((t, i) => (
            <Link key={t.id} href={`/profile/${t.id}`}>
              <div className="flex items-center gap-2.5 group cursor-pointer">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 border ${
                  i === 0 ? "bg-yellow-400/15 text-yellow-300 border-yellow-400/30"
                  : i === 1 ? "bg-slate-400/15 text-slate-300 border-slate-400/30"
                  : "bg-amber-700/15 text-amber-500 border-amber-600/30"
                }`}>
                  {RANK_ICONS[i]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold truncate group-hover:text-yellow-300 transition-colors">{t.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{t.title}</p>
                </div>
                <div className="text-[10px] font-bold text-yellow-400/90 bg-yellow-400/10 px-1.5 py-0.5 rounded-full border border-yellow-400/20">
                  {formatNumber(t.reputationScore)}
                </div>
              </div>
            </Link>
          ))}
        </div>
        <Link href="/communities">
          <button className="w-full py-2 bg-yellow-400/10 hover:bg-yellow-400/15 border border-yellow-400/25 text-yellow-300 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 mt-1">
            <Zap className="w-3.5 h-3.5" /> View Elite Community
          </button>
        </Link>
      </div>

      {/* Join the Debate CTA */}
      <div className="rounded-xl border border-primary/25 bg-gradient-to-br from-primary/10 to-indigo-900/20 p-4 text-center flex flex-col gap-2">
        <p className="text-sm font-bold">Ready to debate?</p>
        <p className="text-[12px] text-muted-foreground">Challenge ideas. Build reputation. Think deeper.</p>
        <Link href="/debates">
          <button className="w-full py-2 treffin-gradient text-white text-xs font-semibold rounded-lg treffin-glow hover:opacity-90 transition-all mt-1">
            Enter the Arena →
          </button>
        </Link>
      </div>
    </div>
  );
}
