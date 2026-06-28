import { useMemo, useEffect, useState } from "react";
import { Link } from "wouter";
import {
  useGetMathLeaderboard,
  useGetMathStats, getGetMathStatsQueryKey,
} from "@workspace/api-client-react";
import { getMathUserId } from "@/lib/math-auth";

/* ── streak helpers (localStorage) ─────────────────────────────── */
function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadStreak(): { count: number; lastDate: string | null; solvedToday: number } {
  try {
    return {
      count:       parseInt(localStorage.getItem("math_streak_count")  ?? "0", 10) || 0,
      lastDate:    localStorage.getItem("math_streak_date"),
      solvedToday: parseInt(localStorage.getItem("math_solved_today")  ?? "0", 10) || 0,
    };
  } catch { return { count: 0, lastDate: null, solvedToday: 0 }; }
}

function bumpStreak(): { count: number; solvedToday: number } {
  try {
    const today = todayKey();
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const stored = loadStreak();
    let next = 1;
    if (stored.lastDate === today) {
      next = stored.count;
    } else if (stored.lastDate === yesterday) {
      next = stored.count + 1;
    }
    localStorage.setItem("math_streak_count", String(next));
    localStorage.setItem("math_streak_date",  today);
    return { count: next, solvedToday: stored.lastDate === today ? stored.solvedToday : 0 };
  } catch { return { count: 1, solvedToday: 0 }; }
}

/* ── daily math insights (editorial, rotates daily) ─────────────── */
const INSIGHTS = [
  {
    title: "Euler's Identity",
    body:  "e^{iπ} + 1 = 0 — five fundamental constants in one equation. Euler called it the most beautiful formula in mathematics.",
    tag:   "Complex Analysis",
    href:  "/math",
  },
  {
    title: "Infinitely many primes",
    body:  "Euclid's 300 BC proof: assume finitely many, multiply them all and add 1 — the result is divisible by none of them. Contradiction.",
    tag:   "Number Theory",
    href:  "/math",
  },
  {
    title: "Cantor's diagonal argument",
    body:  "No matter how you list the real numbers, a diagonal construction produces one you missed. The reals are strictly larger than the naturals.",
    tag:   "Set Theory",
    href:  "/math",
  },
  {
    title: "The Banach-Tarski paradox",
    body:  "A solid sphere can be decomposed into 5 pieces and reassembled into two identical spheres — using only rotations and translations.",
    tag:   "Topology",
    href:  "/math",
  },
  {
    title: "Fermat's Last Theorem",
    body:  "No three positive integers satisfy a^n + b^n = c^n for n > 2. Stated in 1637, proved by Wiles in 1995 after 7 years of secret work.",
    tag:   "Number Theory",
    href:  "/math",
  },
  {
    title: "The Monty Hall problem",
    body:  "Switching doors wins 2/3 of the time — counterintuitive but provably correct. Most mathematicians initially got it wrong.",
    tag:   "Probability",
    href:  "/math",
  },
  {
    title: "P vs NP",
    body:  "Can every problem whose solution is quick to verify also be quick to solve? One of the 7 Millennium Prize Problems, worth $1 million.",
    tag:   "Theoretical CS",
    href:  "/math",
  },
];

export function MathSidebar() {
  const userId   = getMathUserId();
  const { data: leaderboard } = useGetMathLeaderboard({ limit: 5 });
  const { data: stats }       = useGetMathStats({ query: { queryKey: getGetMathStatsQueryKey() } });

  const [streak, setStreak] = useState<{ count: number; solvedToday: number }>({ count: 0, solvedToday: 0 });

  useEffect(() => {
    setStreak(bumpStreak());
  }, []);

  const todayInsight = useMemo(() => {
    const dow = new Date().getDay();
    return INSIGHTS[dow % INSIGHTS.length];
  }, []);

  const streakLabel = streak.count === 0
    ? "Start your streak!"
    : streak.count === 1
    ? "1 day — keep going!"
    : `${streak.count} days 🔥`;

  const milestoneNext = streak.count < 3 ? 3 : streak.count < 7 ? 7 : streak.count < 30 ? 30 : streak.count < 100 ? 100 : 365;
  const milestoneProgress = Math.min(streak.count / milestoneNext, 1);

  return (
    <div className="flex flex-col gap-3">

      {/* ── 1. Top Solvers ────────────────────────────────────── */}
      <div className="bg-card border border-border/60 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[13px] font-bold">🏆 Top Solvers</span>
          <Link href="/math/leaderboard">
            <span className="text-[11px] text-primary cursor-pointer hover:underline">Full board →</span>
          </Link>
        </div>
        {leaderboard && leaderboard.length > 0 ? (
          <div className="flex flex-col gap-1">
            {leaderboard.slice(0, 5).map((entry, i) => (
              <Link key={entry.userId} href={`/math/users/${entry.userId}`}>
                <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors -mx-2">
                  <span className="text-base w-5 text-center shrink-0">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "✦"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold truncate leading-tight">{entry.displayName}</p>
                    <p className="text-[11px] text-muted-foreground">{entry.reputationScore.toLocaleString()} pts · {entry.totalSolutions} solved</p>
                  </div>
                  {(entry.streak ?? 0) > 0 && (
                    <span className="text-[10px] font-bold shrink-0" style={{ color: "#f97316" }}>
                      🔥{entry.streak}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-muted-foreground">No rankings yet — solve to be first!</p>
        )}
      </div>

      {/* ── 2. Your Streak ────────────────────────────────────── */}
      <div className="rounded-xl border border-border/60 p-4" style={{ background: streak.count >= 3 ? "linear-gradient(135deg,rgba(249,115,22,0.08),rgba(234,88,12,0.04))" : undefined }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-bold">
            {streak.count >= 7 ? "🔥" : streak.count >= 3 ? "⚡" : "📅"} Your Streak
          </span>
          {streak.count > 0 && (
            <span className="text-[11px] font-bold" style={{ color: streak.count >= 7 ? "#f97316" : streak.count >= 3 ? "#fbbf24" : "hsl(220 15% 55%)" }}>
              {streakLabel}
            </span>
          )}
        </div>

        {streak.count === 0 ? (
          <p className="text-[12px] text-muted-foreground leading-relaxed mb-3">
            Solve a problem today to start your streak. Come back every day to keep it going.
          </p>
        ) : (
          <p className="text-[12px] text-muted-foreground leading-relaxed mb-3">
            {streak.solvedToday > 0
              ? `${streak.solvedToday} problem${streak.solvedToday > 1 ? "s" : ""} solved today ·`
              : "Visit again tomorrow ·"}{" "}
            next milestone: {milestoneNext} days
          </p>
        )}

        {/* Progress bar toward next milestone */}
        <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: "hsl(220 30% 14%)" }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${milestoneProgress * 100}%`,
              background: streak.count >= 7 ? "linear-gradient(to right,#f97316,#fbbf24)" : streak.count >= 3 ? "#fbbf24" : "#6366f1",
            }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-muted-foreground/60">{streak.count} days</span>
          <span className="text-[10px] text-muted-foreground/60">{milestoneNext} days</span>
        </div>

        <Link href="/math">
          <div className="mt-3 text-center py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors hover:opacity-80"
            style={{ background: "hsl(220 44% 13%)", border: "1px solid hsl(220 30% 20%)", color: "hsl(0 0% 75%)" }}>
            Solve a problem today →
          </div>
        </Link>
      </div>

      {/* ── 3. Community Stats ────────────────────────────────── */}
      {stats && (
        <div className="bg-card border border-border/60 rounded-xl p-4">
          <p className="text-[13px] font-bold mb-3">📊 Community</p>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { value: stats.totalProblems,  label: "Problems",  color: "#6366f1" },
              { value: stats.totalSolutions, label: "Solutions", color: "#60a5fa" },
              { value: stats.activeCategories, label: "Branches", color: "#34d399" },
            ].map(({ value, label, color }) => (
              <div key={label} className="flex flex-col items-center gap-0.5 p-2 rounded-lg" style={{ background: "hsl(220 44% 10%)" }}>
                <span className="text-[15px] font-extrabold" style={{ color }}>{value}</span>
                <span className="text-[10px] text-muted-foreground/70 text-center leading-tight">{label}</span>
              </div>
            ))}
          </div>
          {stats.topCategory && (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px]" style={{ background: "hsl(220 44% 10%)" }}>
              <span className="text-muted-foreground/60">Most active:</span>
              <span className="font-semibold text-primary">{stats.topCategory}</span>
            </div>
          )}
        </div>
      )}

      {/* ── 4. Daily Math Insight ─────────────────────────────── */}
      <div className="rounded-xl border p-4" style={{ background: "linear-gradient(135deg,rgba(16,185,129,0.07),rgba(6,182,212,0.05))", borderColor: "rgba(52,211,153,0.2)" }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-bold">💡 Today's Insight</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(52,211,153,0.12)", color: "#34d399" }}>
            {todayInsight.tag}
          </span>
        </div>
        <p className="text-[12px] font-bold text-foreground mb-1.5">{todayInsight.title}</p>
        <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">{todayInsight.body}</p>
        <Link href={todayInsight.href}>
          <span className="text-[11px] font-semibold cursor-pointer hover:underline" style={{ color: "#34d399" }}>
            Explore related problems →
          </span>
        </Link>
      </div>

      {/* ── 5. Explore Quick Links ────────────────────────────── */}
      <div className="bg-card border border-border/60 rounded-xl p-4">
        <p className="text-[13px] font-bold mb-3">Explore</p>
        <div className="flex flex-col gap-0.5">
          {[
            { href: "/math/problems",        icon: "📚", label: "All Problems",        sub: `${stats?.totalProblems ?? 0} to explore` },
            { href: "/math/potw",            icon: "⭐", label: "Problem of the Week", sub: "Featured spotlight" },
            { href: "/math/contests",        icon: "⚔️", label: "Competitions",         sub: "Timed challenges" },
            { href: "/math/leaderboard",     icon: "📈", label: "Leaderboard",          sub: "Top mathematicians" },
            ...(userId
              ? [
                  { href: "/math/bookmarks",     icon: "🔖", label: "My Bookmarks",    sub: "Saved problems" },
                  { href: "/math/notifications", icon: "🔔", label: "Notifications",    sub: "Activity & replies" },
                ]
              : []),
            { href: "/math/post", icon: "✏️", label: "Post a Problem", sub: "Share with community" },
          ].map(({ href, icon, label, sub }) => (
            <Link key={href} href={href}>
              <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors -mx-2">
                <span className="text-base w-5 text-center shrink-0">{icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate">{label}</p>
                  <p className="text-[11px] text-muted-foreground">{sub}</p>
                </div>
                <span className="text-[11px] text-muted-foreground/50">→</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── 6. Proof Debates callout ──────────────────────────── */}
      <div className="rounded-xl border p-4" style={{ background: "linear-gradient(135deg,rgba(167,139,250,0.1),rgba(99,102,241,0.07))", borderColor: "rgba(167,139,250,0.25)" }}>
        <div className="text-xl mb-1.5">⚔️</div>
        <p className="text-[13px] font-bold mb-1.5">Proof Debates</p>
        <p className="text-[12px] text-muted-foreground leading-relaxed mb-3">
          Challenge any solution to a structured Oxford-style proof debate. Unique to Treffin — coming soon.
        </p>
        <div className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: "#a78bfa" }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse inline-block" style={{ background: "#a78bfa" }}/>
          In development · Stay tuned ✦
        </div>
      </div>

      {/* ── 7. Eureka reactions legend ───────────────────────── */}
      <div className="bg-card border border-border/60 rounded-xl p-4">
        <p className="text-[13px] font-bold mb-1.5">Eureka Reactions</p>
        <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">
          Rate a proof's character — beyond just upvotes.
        </p>
        {([
          ["✦", "Elegant",    "#a78bfa", "rgba(167,139,250,0.12)", "A proof of uncommon beauty"],
          ["⚡", "Surprising", "#fbbf24", "rgba(251,191,36,0.1)",   "Unexpected insight"],
          ["⬡", "Rigorous",   "#34d399", "rgba(52,211,153,0.1)",   "Airtight logic"],
        ] as [string,string,string,string,string][]).map(([icon, label, col, bg, desc]) => (
          <div key={label} className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold" style={{ background: bg, color: col }}>
              {icon} {label}
            </span>
            <span className="text-[11px] text-muted-foreground">{desc}</span>
          </div>
        ))}
      </div>

    </div>
  );
}
