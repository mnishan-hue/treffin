import { useState } from "react";
import { cn } from "@/lib/utils";
import { getMathUserId } from "@/lib/math-auth";
import { useToast } from "@/hooks/use-toast";

type ReactionType = "elegant" | "surprising" | "rigorous";

const REACTIONS: { type: ReactionType; icon: string; label: string; color: string; bg: string }[] = [
  { type: "elegant",    icon: "✦", label: "Elegant",    color: "#a78bfa", bg: "rgba(167,139,250,0.15)" },
  { type: "surprising", icon: "⚡", label: "Surprising", color: "#fbbf24", bg: "rgba(251,191,36,0.12)"  },
  { type: "rigorous",   icon: "⬡", label: "Rigorous",   color: "#34d399", bg: "rgba(52,211,153,0.12)"  },
];

function seedCount(problemId: number, type: ReactionType): number {
  const seeds: Record<ReactionType, number[]> = {
    elegant:    [47, 12, 88, 23, 61, 34, 9, 72, 18, 44],
    surprising: [8,  41, 14, 5,  29, 11, 3, 19, 6,  22],
    rigorous:   [31, 19, 52, 12, 44, 27, 8, 38, 15, 33],
  };
  return seeds[type][problemId % 10];
}

function storageKey(problemId: number): string {
  const uid = getMathUserId() ?? "anon";
  return `math_eureka_${problemId}_${uid}`;
}

export function EurekaReactions({
  problemId,
  className,
  compact = false,
}: {
  problemId: number;
  className?: string;
  compact?: boolean;
}) {
  const { toast } = useToast();
  const [myReaction, setMyReaction] = useState<ReactionType | null>(() => {
    try { return localStorage.getItem(storageKey(problemId)) as ReactionType | null; }
    catch { return null; }
  });

  const toggle = (type: ReactionType) => {
    const next = myReaction === type ? null : type;
    try { next ? localStorage.setItem(storageKey(problemId), next) : localStorage.removeItem(storageKey(problemId)); }
    catch { /* storage unavailable */ }
    setMyReaction(next);
    if (next) {
      toast({ description: `Marked as ${next}!`, duration: 1500 });
    }
  };

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {!compact && (
        <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider mr-0.5">
          Rate:
        </span>
      )}
      {REACTIONS.map(r => {
        const base = seedCount(problemId, r.type);
        const active = myReaction === r.type;
        const count = active ? base + 1 : base;
        return (
          <button
            key={r.type}
            onClick={() => toggle(r.type)}
            title={r.label}
            style={{
              background: active ? r.bg : "transparent",
              color: active ? r.color : "hsl(220 15% 50%)",
              border: `1px solid ${active ? r.color + "55" : "hsl(220 30% 20%)"}`,
            }}
            className={cn(
              "inline-flex items-center gap-1 rounded-md transition-all cursor-pointer select-none",
              compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-[11px]",
              "hover:opacity-80 font-semibold"
            )}
          >
            <span>{r.icon}</span>
            <span>{compact ? "" : count}</span>
          </button>
        );
      })}
    </div>
  );
}
