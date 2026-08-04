import { Link } from "wouter";
import { useGetMathStats, getGetMathStatsQueryKey, useGetMathProblemOfWeek, getGetMathProblemOfWeekQueryKey } from "@workspace/api-client-react";
import { MathText } from "@/components/math/math-renderer";

export function MathHomeTeaser() {
  const { data: stats } = useGetMathStats({ query: { queryKey: getGetMathStatsQueryKey() } });
  const { data: potw }  = useGetMathProblemOfWeek({ query: { queryKey: getGetMathProblemOfWeekQueryKey() } });

  return (
    <Link href="/math">
      <div
        className="group cursor-pointer rounded-xl overflow-hidden transition-all hover:scale-[1.01]"
        style={{
          background: "linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(59,130,246,0.08) 60%, hsl(220 44% 11%) 100%)",
          border: "1px solid rgba(99,102,241,0.25)",
        }}
      >
        {/* Top accent bar */}
        <div style={{ height: 2, background: "linear-gradient(to right,#6366f1,#3b82f6,#06b6d4)" }}/>

        <div className="p-4">
          {/* Header row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg,#6366f1,#3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.95rem", flexShrink: 0, boxShadow: "0 2px 8px rgba(99,102,241,0.4)" }}>
                ∑
              </div>
              <div>
                <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "hsl(231 89% 68%)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Mathematics</div>
                <div style={{ fontSize: "0.6rem", color: "hsl(220 15% 50%)" }}>Treffin Universe</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {stats && (
                <>
                  <div className="text-center">
                    <div style={{ fontSize: "0.9rem", fontWeight: 900, color: "hsl(231 89% 68%)", lineHeight: 1.1 }}>{stats.totalProblems}</div>
                    <div style={{ fontSize: "0.56rem", color: "hsl(220 15% 48%)", textTransform: "uppercase", letterSpacing: "0.04em" }}>problems</div>
                  </div>
                  <div className="text-center">
                    <div style={{ fontSize: "0.9rem", fontWeight: 900, color: "#60a5fa", lineHeight: 1.1 }}>{stats.totalSolutions}</div>
                    <div style={{ fontSize: "0.56rem", color: "hsl(220 15% 48%)", textTransform: "uppercase", letterSpacing: "0.04em" }}>solutions</div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* POTW snippet */}
          {potw?.problem && (
            <div style={{ background: "hsl(220 52% 7%)", borderRadius: 10, padding: "9px 12px", marginBottom: 10 }}>
              <div style={{ fontSize: "0.58rem", fontWeight: 800, color: "hsl(43 74% 60%)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 3 }}>⭐ Problem of the Week</div>
              <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "hsl(0 0% 90%)", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } as React.CSSProperties}>
                <MathText text={potw.problem.title} />
              </div>
            </div>
          )}

          {/* Floating math symbols decorative */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {["∫","∑","π","∞","√"].map((s, i) => (
                <span key={i} style={{ fontSize: "0.75rem", fontFamily: "serif", color: i % 2 === 0 ? "rgba(99,102,241,0.5)" : "rgba(96,165,250,0.4)", fontWeight: 700 }}>{s}</span>
              ))}
            </div>
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "hsl(231 89% 68%)", opacity: 0, transition: "opacity 0.2s" }} className="group-hover:opacity-100">
              Explore universe →
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
