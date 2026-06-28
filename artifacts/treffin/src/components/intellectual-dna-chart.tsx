import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

type DomainScore = { domain: string; score: number };

interface IntellectualDnaChartProps {
  data: DomainScore[] | undefined;
  isLoading: boolean;
  profileId?: number;
}

const GRADIENT_ID = "dna-fill-gradient";
const GLOW_ID = "dna-glow-filter";

function polarToCartesian(cx: number, cy: number, r: number, angleRad: number) {
  return {
    x: cx + r * Math.sin(angleRad),
    y: cy - r * Math.cos(angleRad),
  };
}

function buildPolygonPoints(
  cx: number,
  cy: number,
  maxR: number,
  scores: number[],
  total: number
): string {
  return scores
    .map((score, i) => {
      const angle = (2 * Math.PI * i) / total;
      const r = (score / 100) * maxR;
      const pt = polarToCartesian(cx, cy, r, angle);
      return `${pt.x},${pt.y}`;
    })
    .join(" ");
}

export function IntellectualDnaChart({ data, isLoading, profileId }: IntellectualDnaChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-4 w-36 rounded" />
        </div>
        <Skeleton className="h-52 w-52 rounded-full mx-auto" />
      </div>
    );
  }

  const hasActivity = data && data.some(d => d.score > 0);

  if (!hasActivity) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-bold mb-1">Intellectual DNA</h3>
        <p className="text-xs text-muted-foreground mb-4">Your domain strengths, built from debates and articles.</p>
        <div className="flex flex-col items-center gap-3 py-6">
          <svg width="80" height="80" viewBox="0 0 80 80" className="opacity-20">
            <polygon
              points="40,8 72,24 72,56 40,72 8,56 8,24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-primary"
            />
          </svg>
          <p className="text-sm text-muted-foreground font-medium text-center">No intellectual DNA yet</p>
          <p className="text-xs text-muted-foreground text-center max-w-[200px]">
            Start debating or writing articles to build your domain profile.
          </p>
          {!profileId && (
            <div className="flex gap-2 mt-1">
              <Link href="/debates">
                <button className="text-xs font-semibold text-primary border border-primary/30 bg-primary/5 px-3 py-1.5 rounded-full hover:bg-primary/10 transition-colors">
                  Browse Debates
                </button>
              </Link>
              <Link href="/articles">
                <button className="text-xs font-semibold text-primary border border-primary/30 bg-primary/5 px-3 py-1.5 rounded-full hover:bg-primary/10 transition-colors">
                  Write an Article
                </button>
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  const domains = data!;
  const n = domains.length;
  const cx = 110;
  const cy = 110;
  const maxR = 80;
  const levels = [0.25, 0.5, 0.75, 1];

  const scores = domains.map(d => d.score);
  const polygonPoints = buildPolygonPoints(cx, cy, maxR, scores, n);

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-bold">Intellectual DNA</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">Domain strengths built from debates and articles.</p>

      <div className="flex flex-col items-center gap-4">
        <svg
          width="220"
          height="220"
          viewBox="0 0 220 220"
          className="overflow-visible"
          style={{ filter: "drop-shadow(0 0 12px rgba(99,102,241,0.15))" }}
        >
          <defs>
            <linearGradient id={GRADIENT_ID} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.75" />
            </linearGradient>
            <filter id={GLOW_ID} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {levels.map((lvl) => {
            const pts = Array.from({ length: n }, (_, i) => {
              const angle = (2 * Math.PI * i) / n;
              const pt = polarToCartesian(cx, cy, maxR * lvl, angle);
              return `${pt.x},${pt.y}`;
            }).join(" ");
            return (
              <polygon
                key={lvl}
                points={pts}
                fill="none"
                stroke="rgba(99,102,241,0.15)"
                strokeWidth="1"
              />
            );
          })}

          {Array.from({ length: n }, (_, i) => {
            const angle = (2 * Math.PI * i) / n;
            const outer = polarToCartesian(cx, cy, maxR, angle);
            return (
              <line
                key={i}
                x1={cx}
                y1={cy}
                x2={outer.x}
                y2={outer.y}
                stroke="rgba(99,102,241,0.18)"
                strokeWidth="1"
              />
            );
          })}

          <polygon
            points={polygonPoints}
            fill={`url(#${GRADIENT_ID})`}
            stroke="#6366f1"
            strokeWidth="1.5"
            strokeLinejoin="round"
            filter={`url(#${GLOW_ID})`}
          />

          {domains.map((d, i) => {
            const angle = (2 * Math.PI * i) / n;
            const labelR = maxR + 22;
            const pt = polarToCartesian(cx, cy, labelR, angle);
            const dotR = maxR * (d.score / 100);
            const dotPt = polarToCartesian(cx, cy, dotR, angle);
            const isHovered = hovered === i;

            const textAnchor =
              Math.abs(pt.x - cx) < 5 ? "middle" :
              pt.x < cx ? "end" : "start";

            return (
              <g
                key={d.domain}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: "default" }}
              >
                <circle
                  cx={dotPt.x}
                  cy={dotPt.y}
                  r={isHovered ? 5 : 3.5}
                  fill={isHovered ? "#818cf8" : "#6366f1"}
                  stroke="#1e1b4b"
                  strokeWidth="1"
                  style={{ transition: "r 0.15s ease" }}
                />

                <text
                  x={pt.x}
                  y={pt.y + 4}
                  textAnchor={textAnchor}
                  fontSize="9.5"
                  fontWeight={isHovered ? "700" : "600"}
                  fill={isHovered ? "#a5b4fc" : "rgba(148,163,184,0.9)"}
                  style={{ transition: "fill 0.15s ease" }}
                  fontFamily="inherit"
                >
                  {d.domain}
                </text>

                {isHovered && (
                  <g>
                    <rect
                      x={pt.x - (textAnchor === "end" ? 56 : textAnchor === "start" ? 0 : 28)}
                      y={pt.y + 10}
                      width="56"
                      height="18"
                      rx="4"
                      fill="#312e81"
                      stroke="#4338ca"
                      strokeWidth="0.75"
                    />
                    <text
                      x={pt.x - (textAnchor === "end" ? 28 : textAnchor === "start" ? 28 : 0)}
                      y={pt.y + 23}
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="700"
                      fill="#c7d2fe"
                      fontFamily="inherit"
                    >
                      {d.score}/100
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        <div className="grid grid-cols-3 gap-x-4 gap-y-1.5 w-full max-w-[280px]">
          {domains.map((d) => (
            <div key={d.domain} className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  background: `rgba(99,102,241,${0.3 + (d.score / 100) * 0.7})`,
                  boxShadow: d.score > 50 ? "0 0 4px rgba(99,102,241,0.5)" : "none",
                }}
              />
              <span className="text-[10px] text-muted-foreground truncate">{d.domain}</span>
              <span className="text-[10px] font-bold text-primary ml-auto shrink-0">{d.score}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
