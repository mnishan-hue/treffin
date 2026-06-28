import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  useGetMathStats, getGetMathStatsQueryKey,
  useListMathProblems, getListMathProblemsQueryKey,
  useGetMathProblemOfWeek, getGetMathProblemOfWeekQueryKey,
  useGetMathLeaderboard,
  useListMathCategories, getListMathCategoriesQueryKey,
  useListMathContests,
} from "@workspace/api-client-react";
import { getMathUserId } from "@/lib/math-auth";
import { MathText } from "@/components/math/math-renderer";
import { EurekaReactions } from "@/components/math/eureka-reactions";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtCountdown } from "@/lib/math-utils";
import { Clock, Users, Search, Swords } from "lucide-react";

/* ── helpers ────────────────────────────────────────────────────── */
const MATH_SYMBOLS = ["∫","∑","π","∞","√","∂","∇","Δ","θ","λ","φ","ε","∈","∀","∃","≡","≈","∝","ℝ","ℕ","⊕","∮","∏"];

const DIFF_STYLE: Record<string, { color: string; bg: string }> = {
  beginner:     { color: "#34d399", bg: "rgba(52,211,153,0.12)"  },
  intermediate: { color: "#60a5fa", bg: "rgba(96,165,250,0.12)"  },
  advanced:     { color: "#fbbf24", bg: "rgba(251,191,36,0.12)"  },
  olympiad:     { color: "#f87171", bg: "rgba(248,113,113,0.12)" },
  research:     { color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
};

const BRANCH_COLORS: Record<string, string> = {
  Algebra: "#818cf8", Calculus: "#60a5fa", "Number Theory": "#34d399",
  Geometry: "#a78bfa", Combinatorics: "#fbbf24", Olympiad: "#f87171",
  Analysis: "#fb923c", Statistics: "#38bdf8", Topology: "#e879f9",
};

function branchColor(name: string) {
  return BRANCH_COLORS[name] ?? "#818cf8";
}

/* ── Floating symbols background ───────────────────────────────── */
function CosmosBackground() {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {MATH_SYMBOLS.map((s, i) => (
        <span key={i} style={{
          position: "absolute",
          left: `${(i * 439 + 71) % 92}%`,
          top:  `${(i * 317 + 41) % 90}%`,
          fontSize: `${1.0 + (i % 4) * 0.45}rem`,
          fontFamily: "serif",
          fontWeight: 700,
          color: i % 4 === 0 ? "rgba(99,102,241,0.09)"
               : i % 4 === 1 ? "rgba(96,165,250,0.07)"
               : i % 4 === 2 ? "rgba(167,139,250,0.08)"
               :                "rgba(52,211,153,0.06)",
          animation: `mathFloat ${7 + (i % 5) * 2}s ease-in-out infinite`,
          animationDelay: `${(i * 0.7) % 6}s`,
          userSelect: "none",
        }}>{s}</span>
      ))}
      <div style={{ position: "absolute", top: "5%",  left: "8%",  width: 420, height: 420, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%)" }}/>
      <div style={{ position: "absolute", top: "30%", right: "5%", width: 360, height: 360, borderRadius: "50%", background: "radial-gradient(circle, rgba(96,165,250,0.05) 0%, transparent 70%)" }}/>
      <div style={{ position: "absolute", bottom: "10%", left: "42%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(167,139,250,0.05) 0%, transparent 70%)" }}/>
    </div>
  );
}

/* ── Difficulty dot ─────────────────────────────────────────────── */
function DiffDot({ diff }: { diff: string }) {
  const s = DIFF_STYLE[diff.toLowerCase()] ?? DIFF_STYLE.intermediate;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 6, fontSize: "0.68rem", fontWeight: 700, background: s.bg, color: s.color }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.color, display: "inline-block" }}/>
      {diff.charAt(0).toUpperCase() + diff.slice(1)}
    </span>
  );
}

/* ── Main Hub component ─────────────────────────────────────────── */
type FilterMode = "all" | "unsolved" | "mine";

export default function MathHub() {
  const [activeCat, setActiveCat] = useState<number | null>(null);
  const [sortMode, setSortMode] = useState<"trending" | "newest" | "elegant">("trending");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [now, setNow] = useState(Date.now());
  const userId = getMathUserId();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const apiSort = sortMode === "trending" ? "views" : sortMode === "newest" ? "recent" : "popular";

  const apiParams = {
    categoryId: activeCat ?? undefined,
    sort: apiSort,
    search: debouncedSearch || undefined,
    limit: 12,
    unsolved: filterMode === "unsolved" ? true : undefined,
    solvedBy: filterMode === "mine" && userId ? userId : undefined,
  };

  const { data: stats }       = useGetMathStats({ query: { queryKey: getGetMathStatsQueryKey() } });
  const { data: problems, isLoading: probLoading } = useListMathProblems(
    apiParams,
    { query: { queryKey: getListMathProblemsQueryKey(apiParams) } }
  );
  const { data: potw }        = useGetMathProblemOfWeek({ query: { queryKey: getGetMathProblemOfWeekQueryKey() } });
  const { data: leaderboard } = useGetMathLeaderboard({ limit: 4 });
  const { data: categories }  = useListMathCategories({ query: { queryKey: getListMathCategoriesQueryKey() } });
  const { data: contests }    = useListMathContests();

  const featuredContest = contests?.find(c => c.status === "active") ?? contests?.find(c => c.status === "upcoming") ?? null;

  const displayedProblems = problems ?? [];

  return (
    <div style={{ margin: "-16px -16px 0", minHeight: "calc(100vh - 60px)" }}>
      {/* Global animation styles */}
      <style>{`
        @keyframes mathFloat {
          0%,100% { transform: translateY(0px) rotate(0deg); }
          50%      { transform: translateY(-26px) rotate(7deg); }
        }
        @keyframes shimmerGrad {
          0%   { background-position: -300% center; }
          100% { background-position: 300% center; }
        }
        @keyframes pulseGlow {
          0%,100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.4); }
          50%      { box-shadow: 0 0 0 8px rgba(99,102,241,0); }
        }
        @keyframes liveBlink {
          0%,100% { opacity: 1; } 50% { opacity: 0.25; }
        }
        .math-shimmer {
          background: linear-gradient(90deg, #c7d2fe 10%, #818cf8 30%, #60a5fa 50%, #a78bfa 70%, #c7d2fe 90%);
          background-size: 300% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmerGrad 5s linear infinite;
        }
        .dark .math-shimmer {
          background: linear-gradient(90deg, #c7d2fe 10%, #818cf8 30%, #60a5fa 50%, #a78bfa 70%, #c7d2fe 90%);
          background-size: 300% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .light .math-shimmer {
          background: linear-gradient(90deg, #4338ca 10%, #6366f1 30%, #3b82f6 50%, #7c3aed 70%, #4338ca 90%);
          background-size: 300% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .prob-row { transition: all 0.15s; }
        .prob-row:hover { border-color: rgba(99,102,241,0.4) !important; background: var(--color-secondary) !important; }
        .branch-chip:hover { transform: scale(1.05); opacity: 0.9; }
        .math-hero-grid {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 28px;
          align-items: start;
        }
        .math-hero-stats {
          display: flex;
          gap: 28px;
          flex-wrap: wrap;
          margin-bottom: 26px;
        }
        .math-hero-ctas {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .math-hero-section {
          padding: 48px 24px 36px;
        }
        .math-sort-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 14px;
          flex-wrap: wrap;
        }
        @media (max-width: 768px) {
          .math-hero-grid { grid-template-columns: 1fr; gap: 20px; }
          .math-hero-stats { gap: 16px; }
          .math-hero-section { padding: 28px 16px 24px; }
          .math-prob-rank { display: none !important; }
          .math-prob-actions { display: none !important; }
          .math-sort-bar .math-sort-all-link { display: none; }
        }
        @media (max-width: 480px) {
          .math-hero-stats > div { min-width: calc(50% - 8px); }
        }
      `}</style>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="math-hero-section" style={{
        position: "relative", overflow: "hidden",
        background: "var(--color-background)",
        borderBottom: "1px solid var(--color-border)",
      }}>
        <CosmosBackground />
        {/* Grid lines */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(color-mix(in srgb, var(--color-border) 40%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--color-border) 40%, transparent) 1px, transparent 1px)", backgroundSize: "52px 52px", pointerEvents: "none" }}/>

        <div style={{ position: "relative", zIndex: 1, maxWidth: 1120, margin: "0 auto" }}>
          <div className="math-hero-grid">

            {/* Left: headline + stats + CTAs */}
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 100, padding: "4px 14px", fontSize: "0.67rem", fontWeight: 700, color: "hsl(231 89% 68%)", marginBottom: 20, letterSpacing: "0.07em", textTransform: "uppercase" }}>
                ✦ The Mathematical Universe · Treffin
              </div>

              <h1 style={{ fontSize: "clamp(2.4rem, 4.5vw, 4rem)", fontWeight: 900, lineHeight: 1.06, letterSpacing: "-0.04em", marginBottom: 14 }}>
                <span className="math-shimmer">Where elegant minds</span>
                <br/>
                <span style={{ color: "var(--color-foreground)" }}>solve beautiful problems.</span>
              </h1>

              <p style={{ fontSize: "1.05rem", color: "var(--color-muted-foreground)", maxWidth: 500, lineHeight: 1.75, marginBottom: 24 }}>
                Explore rigorous problems, write elegant proofs, challenge solutions in live debates, and build your mathematical reputation — all inside Treffin.
              </p>

              {/* Stats */}
              <div className="math-hero-stats">
                {[
                  [stats?.totalProblems ?? "—", "Problems"],
                  [stats?.totalSolutions ?? "—", "Solutions"],
                  [String(leaderboard?.length ?? "—"), "Top Solvers"],
                  [String(contests?.filter(c => c.status === "active").length ?? "—"), "Live Contests"],
                ].map(([n, l]) => (
                  <div key={String(l)}>
                    <div style={{ fontSize: "2rem", fontWeight: 900, background: "linear-gradient(135deg,#818cf8,#60a5fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1.1 }}>{n}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--color-muted-foreground)", letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 2 }}>{l}</div>
                  </div>
                ))}
              </div>

              <div className="math-hero-ctas">
                <Link href="/math">
                  <button style={{ padding: "11px 26px", borderRadius: 11, fontWeight: 800, fontSize: "0.97rem", background: "linear-gradient(135deg,#6366f1,#3b82f6)", color: "white", border: "none", cursor: "pointer", boxShadow: "0 6px 24px rgba(99,102,241,0.4)" }}>
                    Explore Problems →
                  </button>
                </Link>
                <Link href="/math/contests">
                  <button style={{ padding: "11px 20px", borderRadius: 11, fontWeight: 600, fontSize: "0.94rem", background: "var(--color-secondary)", border: "1px solid var(--color-border)", color: "var(--color-muted-foreground)", cursor: "pointer" }}>
                    Join a Contest
                  </button>
                </Link>
              </div>
            </div>

            {/* Right: Daily challenge card + contest widget */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* POTW card */}
              {potw?.problem ? (
                <div style={{ background: "var(--color-card)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 18, padding: 20, position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(to right,#6366f1,#3b82f6,#06b6d4)" }}/>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#ef4444", display: "inline-block", animation: "liveBlink 1.4s ease-in-out infinite" }}/>
                    <span style={{ fontSize: "0.63rem", fontWeight: 800, color: "#f87171", letterSpacing: "0.09em", textTransform: "uppercase" }}>Problem of the Week</span>
                    <span style={{ marginLeft: "auto", fontSize: "0.62rem", color: "var(--color-muted-foreground)", background: "var(--color-secondary)", borderRadius: 100, padding: "1px 8px" }}>Featured</span>
                  </div>
                  <h3 style={{ fontSize: "0.9rem", fontWeight: 700, lineHeight: 1.45, marginBottom: 10, color: "var(--color-foreground)" }}>
                    <MathText text={potw.problem.title} />
                  </h3>
                  <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                    <DiffDot diff={potw.problem.difficulty} />
                    <span style={{ fontSize: "0.68rem", color: "var(--color-muted-foreground)" }}>
                      {potw.problem.solutionCount ?? 0} solutions
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Link href={`/math/problem/${potw.problem.id}`} style={{ flex: 1 }}>
                      <button style={{ width: "100%", padding: "8px", borderRadius: 9, fontSize: "0.77rem", fontWeight: 700, background: "linear-gradient(135deg,rgba(99,102,241,0.2),rgba(59,130,246,0.2))", border: "1px solid rgba(99,102,241,0.35)", color: "hsl(231 89% 72%)", cursor: "pointer" }}>
                        Submit Proof →
                      </button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div style={{ background: "var(--color-card)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 18, padding: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                    <span style={{ fontSize: "0.63rem", fontWeight: 800, color: "hsl(231 89% 68%)", letterSpacing: "0.09em", textTransform: "uppercase" }}>⭐ Problem of the Week</span>
                  </div>
                  <p style={{ fontSize: "0.8rem", color: "var(--color-muted-foreground)", lineHeight: 1.6 }}>A featured problem is selected every Monday. Check back soon!</p>
                  <Link href="/math/potw">
                    <button style={{ marginTop: 12, width: "100%", padding: "8px", borderRadius: 9, fontSize: "0.77rem", fontWeight: 600, background: "var(--color-secondary)", border: "1px solid var(--color-border)", color: "var(--color-muted-foreground)", cursor: "pointer" }}>
                      View Past Problems →
                    </button>
                  </Link>
                </div>
              )}

              {/* Live Contest Widget (replaces dead Coming Soon card) */}
              {featuredContest ? (() => {
                const isLive = featuredContest.status === "active";
                const end = new Date(featuredContest.endTime).getTime();
                const start = new Date(featuredContest.startTime).getTime();
                const msLeft = isLive ? end - now : start - now;
                return (
                  <Link href={`/math/contests/${featuredContest.id}`}>
                    <div style={{
                      background: isLive
                        ? "linear-gradient(135deg, rgba(34,197,94,0.06) 0%, rgba(99,102,241,0.08) 100%)"
                        : "linear-gradient(135deg, rgba(59,130,246,0.06) 0%, rgba(99,102,241,0.08) 100%)",
                      border: `1px solid ${isLive ? "rgba(34,197,94,0.3)" : "rgba(59,130,246,0.25)"}`,
                      borderRadius: 16,
                      padding: "16px 18px",
                      position: "relative",
                      overflow: "hidden",
                      cursor: "pointer",
                    }}>
                      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: isLive ? "linear-gradient(to right,#22c55e,#6366f1,#3b82f6)" : "linear-gradient(to right,#3b82f6,#6366f1,#8b5cf6)" }} />

                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                        {isLive ? (
                          <>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", display: "inline-block", animation: "liveBlink 1.2s ease-in-out infinite" }}/>
                            <span style={{ fontSize: "0.62rem", fontWeight: 800, color: "#22c55e", letterSpacing: "0.09em", textTransform: "uppercase" }}>Live Contest</span>
                          </>
                        ) : (
                          <>
                            <Swords style={{ width: 12, height: 12, color: "#60a5fa" }} />
                            <span style={{ fontSize: "0.62rem", fontWeight: 800, color: "#60a5fa", letterSpacing: "0.09em", textTransform: "uppercase" }}>Upcoming Contest</span>
                          </>
                        )}
                      </div>

                      <div style={{ fontSize: "0.88rem", fontWeight: 800, color: "var(--color-foreground)", marginBottom: 6, lineHeight: 1.3 }}>
                        {featuredContest.title}
                      </div>

                      {featuredContest.description && (
                        <p style={{ fontSize: "0.72rem", color: "var(--color-muted-foreground)", lineHeight: 1.55, marginBottom: 10 }}>
                          {featuredContest.description.length > 100 ? featuredContest.description.slice(0, 100) + "…" : featuredContest.description}
                        </p>
                      )}

                      <div style={{ display: "flex", gap: 12, marginBottom: 12, fontSize: "0.71rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, color: isLive ? "#22c55e" : "#60a5fa", fontWeight: 700 }}>
                          <Clock style={{ width: 12, height: 12 }} />
                          <span className="tabular-nums">{msLeft > 0 ? (isLive ? `${fmtCountdown(msLeft)} left` : `Starts in ${fmtCountdown(msLeft)}`) : "Starting soon"}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--color-muted-foreground)" }}>
                          <Users style={{ width: 12, height: 12 }} />
                          <span>{featuredContest.totalParticipants} entered</span>
                        </div>
                      </div>

                      <button style={{
                        width: "100%", padding: "8px", borderRadius: 9,
                        fontSize: "0.77rem", fontWeight: 700,
                        background: isLive ? "rgba(34,197,94,0.12)" : "rgba(59,130,246,0.12)",
                        border: `1px solid ${isLive ? "rgba(34,197,94,0.3)" : "rgba(59,130,246,0.3)"}`,
                        color: isLive ? "#22c55e" : "#60a5fa", cursor: "pointer",
                      }}>
                        {isLive ? "⚔ Compete Now →" : "🔵 View Details →"}
                      </button>
                    </div>
                  </Link>
                );
              })() : (
                <Link href="/math/contests">
                  <div style={{
                    background: "linear-gradient(135deg, rgba(248,113,113,0.04) 0%, rgba(99,102,241,0.06) 100%)",
                    border: "1px solid rgba(99,102,241,0.2)",
                    borderRadius: 16,
                    padding: "16px 18px",
                    cursor: "pointer",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                      <span style={{ fontSize: "1.1rem" }}>🏆</span>
                      <span style={{ fontSize: "0.88rem", fontWeight: 800, color: "var(--color-foreground)" }}>Math Competitions</span>
                    </div>
                    <p style={{ fontSize: "0.72rem", color: "var(--color-muted-foreground)", lineHeight: 1.6, marginBottom: 10 }}>
                      Timed olympiad-style contests with live rankings, medals, and rep rewards. Open to all levels.
                    </p>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 12 }}>
                      {["Live Rankings", "Medal Rewards", "Global Leaderboard"].map(f => (
                        <span key={f} style={{ fontSize: "0.62rem", fontWeight: 600, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 100, padding: "2px 8px", color: "hsl(231 89% 68%)" }}>
                          {f}
                        </span>
                      ))}
                    </div>
                    <button style={{ width: "100%", padding: "8px", borderRadius: 9, fontSize: "0.77rem", fontWeight: 700, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", color: "hsl(231 89% 68%)", cursor: "pointer" }}>
                      Browse Contests →
                    </button>
                  </div>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Branch / category picker ─────────────────────────── */}
      <div style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-background)", padding: "12px 24px" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", display: "flex", alignItems: "center", gap: 8, overflowX: "auto" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-muted-foreground)", letterSpacing: "0.07em", textTransform: "uppercase", flexShrink: 0, marginRight: 4 }}>Branch:</span>
          {[{ id: null as null | number, name: "All", problemCount: stats?.totalProblems }, ...(categories ?? [])].map(cat => {
            const isAll = cat.id === null;
            const active = isAll ? activeCat === null : activeCat === cat.id;
            const col = branchColor(cat.name);
            return (
              <button
                key={String(cat.id)}
                className="branch-chip"
                onClick={() => setActiveCat(isAll ? null : cat.id as number)}
                style={{
                  flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "6px 14px", borderRadius: 100, fontSize: "0.84rem",
                  fontWeight: active ? 700 : 500,
                  background: active ? "hsl(231 89% 65%)" : "var(--color-secondary)",
                  border: `1px solid ${active ? "transparent" : "var(--color-border)"}`,
                  color: active ? "white" : col,
                  cursor: "pointer", transition: "all 0.15s", transform: "scale(1)",
                }}
              >
                {cat.name}
                {cat.problemCount != null && cat.problemCount > 0 && (
                  <span style={{ fontSize: "0.72em", opacity: active ? 0.8 : 0.55, fontWeight: 600 }}>
                    {cat.problemCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main content: full-width problem feed ─────────────── */}
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "22px 16px 56px" }}>

        {/* ── Problem feed ─────────────────────────── */}
        <div>
          {/* Filter + Search + Sort bar */}
          {/* Filter tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 10, alignItems: "center", flexWrap: "wrap" }}>
            {(["all", "unsolved", "mine"] as const).map(f => {
              const active = filterMode === f;
              const disabled = f === "mine" && !userId;
              return (
                <button
                  key={f}
                  onClick={() => !disabled && setFilterMode(f)}
                  title={disabled ? "Sign in to see your solutions" : undefined}
                  style={{
                    padding: "5px 14px", borderRadius: 100, fontSize: "0.78rem",
                    fontWeight: active ? 700 : 500,
                    background: active ? "hsl(231 89% 65%)" : "var(--color-secondary)",
                    border: `1px solid ${active ? "transparent" : "var(--color-border)"}`,
                    color: active ? "white" : disabled ? "var(--color-muted-foreground)" : "var(--color-foreground)",
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.5 : 1,
                    transition: "all 0.12s",
                  }}
                >
                  {f === "all" ? "📚 All" : f === "unsolved" ? "❓ Unsolved" : "✅ My Solutions"}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
            {/* Search */}
            <div style={{ position: "relative", flex: "1", minWidth: 180, maxWidth: 320 }}>
              <Search style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "var(--color-muted-foreground)", pointerEvents: "none" }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search problems…"
                style={{
                  width: "100%", paddingLeft: 32, paddingRight: 12, paddingTop: 7, paddingBottom: 7,
                  borderRadius: 9, fontSize: "0.83rem",
                  background: "var(--color-secondary)", border: "1px solid var(--color-border)",
                  color: "var(--color-foreground)", outline: "none",
                }}
              />
            </div>

            <div className="math-sort-bar" style={{ margin: 0 }}>
              {(["trending","newest","elegant"] as const).map(m => (
                <button key={m} onClick={() => setSortMode(m)} style={{ padding: "6px 14px", borderRadius: 8, fontSize: "0.83rem", fontWeight: sortMode === m ? 700 : 500, background: sortMode === m ? "var(--color-secondary)" : "transparent", border: `1px solid ${sortMode === m ? "var(--color-border)" : "transparent"}`, color: sortMode === m ? "var(--color-foreground)" : "var(--color-muted-foreground)", cursor: "pointer", textTransform: "capitalize" }}>
                  {m === "trending" ? "🔥 Trending" : m === "newest" ? "✨ Newest" : "✦ Most Elegant"}
                </button>
              ))}
            </div>

            <Link href="/math" style={{ marginLeft: "auto" }} className="math-sort-all-link">
              <span style={{ fontSize: "0.83rem", color: "hsl(231 89% 65%)", fontWeight: 600 }}>All problems →</span>
            </Link>
          </div>

          {/* Problem rows */}
          {probLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-2xl" />
              ))}
            </div>
          ) : displayedProblems.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 0", color: "var(--color-muted-foreground)" }}>
              <div style={{ fontSize: "2rem", marginBottom: 8 }}>∅</div>
              <p style={{ fontSize: "0.88rem" }}>{debouncedSearch ? `No problems matching "${debouncedSearch}".` : "No problems in this branch yet."}</p>
              {debouncedSearch ? (
                <button onClick={() => { setSearch(""); }} style={{ marginTop: 16, padding: "8px 20px", borderRadius: 10, fontSize: "0.8rem", fontWeight: 600, background: "var(--color-secondary)", border: "1px solid var(--color-border)", color: "var(--color-muted-foreground)", cursor: "pointer" }}>
                  Clear search
                </button>
              ) : (
                <Link href="/math/post">
                  <button style={{ marginTop: 16, padding: "8px 20px", borderRadius: 10, fontSize: "0.8rem", fontWeight: 700, background: "hsl(231 89% 65%)", color: "white", border: "none", cursor: "pointer" }}>
                    Post the first one →
                  </button>
                </Link>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {displayedProblems.map((p, i) => (
                <Link key={p.id} href={`/math/problem/${p.id}`} style={{ display: "block" }}>
                  <div className="prob-row" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 14, padding: "15px 18px", cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      {/* Rank */}
                      <div className="math-prob-rank" style={{ width: 32, height: 32, borderRadius: 8, background: "var(--color-secondary)", border: "1px solid var(--color-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", fontWeight: 700, color: "var(--color-muted-foreground)", flexShrink: 0 }}>
                        {i + 1}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                          {(p.viewCount ?? 0) > 100 && (
                            <span style={{ fontSize: "0.72rem", background: "rgba(239,68,68,0.12)", color: "#f87171", borderRadius: 5, padding: "2px 7px", fontWeight: 800, flexShrink: 0 }}>🔥 HOT</span>
                          )}
                          {p.isProblemOfWeek && (
                            <span style={{ fontSize: "0.72rem", background: "rgba(251,191,36,0.1)", color: "#fbbf24", borderRadius: 5, padding: "2px 7px", fontWeight: 700, flexShrink: 0 }}>⭐ POTW</span>
                          )}
                          {p.isFeatured && (
                            <span style={{ fontSize: "0.72rem", background: "rgba(99,102,241,0.1)", color: "hsl(231 89% 68%)", borderRadius: 5, padding: "2px 7px", fontWeight: 700, flexShrink: 0 }}>✦ Featured</span>
                          )}
                        </div>
                        <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--color-foreground)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <MathText text={p.title} />
                        </h3>

                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, marginBottom: 8, flexWrap: "wrap" }}>
                          {p.categoryName && (
                            <span style={{ fontSize: "0.76rem", background: "var(--color-secondary)", border: "1px solid var(--color-border)", borderRadius: 6, padding: "2px 8px", color: branchColor(p.categoryName), fontWeight: 600 }}>
                              {p.categoryName}
                            </span>
                          )}
                          <DiffDot diff={p.difficulty} />
                          {(p.solutionCount ?? 0) > 0 && (
                            <span style={{ fontSize: "0.65rem", color: "var(--color-muted-foreground)" }}>
                              👥 {p.solutionCount} {p.solutionCount === 1 ? "solution" : "solutions"}
                            </span>
                          )}
                          {(p.viewCount ?? 0) > 0 && (
                            <span style={{ fontSize: "0.65rem", color: "var(--color-muted-foreground)" }}>👁 {p.viewCount}</span>
                          )}
                        </div>

                        {/* Eureka reactions */}
                        <EurekaReactions problemId={p.id} />
                      </div>

                      {/* Actions */}
                      <div className="math-prob-actions" style={{ display: "flex", flexDirection: "column", gap: 5, flexShrink: 0 }}>
                        <span style={{ padding: "5px 12px", borderRadius: 8, fontSize: "0.71rem", fontWeight: 700, background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)", color: "hsl(231 89% 70%)", whiteSpace: "nowrap" }}>
                          Solve →
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Post CTA */}
        <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
          <Link href="/math/post">
            <button style={{ padding: "9px 20px", borderRadius: 10, fontSize: "0.8rem", fontWeight: 700, background: "var(--color-secondary)", border: "1px solid var(--color-border)", color: "var(--color-muted-foreground)", cursor: "pointer" }}>
              + Post a Problem
            </button>
          </Link>
          <Link href="/math">
            <button style={{ padding: "9px 20px", borderRadius: 10, fontSize: "0.8rem", fontWeight: 600, background: "transparent", border: "1px solid var(--color-border)", color: "var(--color-muted-foreground)", cursor: "pointer" }}>
              Browse All Problems →
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
