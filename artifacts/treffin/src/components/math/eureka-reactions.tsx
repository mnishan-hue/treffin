import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { getMathUserId } from "@/lib/math-auth";
import { useToast } from "@/hooks/use-toast";
import { useToggleMathReaction } from "@workspace/api-client-react";
import type { MathReactionInputReactionType } from "@workspace/api-client-react";

type ReactionType = "elegant" | "insightful" | "rigorous";

const REACTIONS: {
  type: ReactionType;
  icon: string;
  label: string;
  color: string;
  bg: string;
  apiType: MathReactionInputReactionType;
}[] = [
  { type: "elegant",    apiType: "elegant",    icon: "✦", label: "Elegant",    color: "#a78bfa", bg: "rgba(167,139,250,0.15)" },
  { type: "insightful", apiType: "insightful", icon: "⚡", label: "Insightful", color: "#fbbf24", bg: "rgba(251,191,36,0.12)"  },
  { type: "rigorous",   apiType: "rigorous",   icon: "⬡", label: "Rigorous",   color: "#34d399", bg: "rgba(52,211,153,0.12)"  },
];

export function EurekaReactions({
  problemId,
  className,
  compact = false,
  counts: initialCounts = {},
  myReactions: initialMyReactions = [],
  onToggled,
}: {
  problemId: number;
  className?: string;
  compact?: boolean;
  counts?: Record<string, number>;
  myReactions?: string[];
  onToggled?: () => void;
}) {
  const { toast } = useToast();
  const toggleMut = useToggleMathReaction();

  // Sync optimistic state when props update (e.g. parent re-fetches)
  const [optimisticCounts, setOptimisticCounts] = useState<Record<string, number>>(initialCounts);
  const [optimisticMine, setOptimisticMine] = useState<Set<string>>(new Set(initialMyReactions));

  useEffect(() => {
    setOptimisticCounts(initialCounts);
    setOptimisticMine(new Set(initialMyReactions));
  }, [problemId]);                         // reset when problem changes

  const toggle = (r: (typeof REACTIONS)[number]) => {
    const uid = getMathUserId();
    if (!uid) {
      toast({
        title: "Sign in required",
        description: "Set your display name in the Math Hub to react.",
        variant: "destructive",
      });
      return;
    }

    const wasActive = optimisticMine.has(r.type);

    // Optimistic update
    setOptimisticMine((prev) => {
      const next = new Set(prev);
      wasActive ? next.delete(r.type) : next.add(r.type);
      return next;
    });
    setOptimisticCounts((prev) => ({
      ...prev,
      [r.type]: Math.max(0, (prev[r.type] ?? 0) + (wasActive ? -1 : 1)),
    }));

    toggleMut.mutate(
      { data: { targetType: "problem", targetId: problemId, reactionType: r.apiType } },
      {
        onSuccess: () => {
          onToggled?.();
        },
        onError: () => {
          // Roll back optimistic update
          setOptimisticCounts(initialCounts);
          setOptimisticMine(new Set(initialMyReactions));
          toast({ description: "Failed to update reaction.", variant: "destructive" });
        },
      },
    );
  };

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {!compact && (
        <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider mr-0.5">
          Rate:
        </span>
      )}
      {REACTIONS.map((r) => {
        const active = optimisticMine.has(r.type);
        const count  = optimisticCounts[r.type] ?? 0;
        return (
          <button
            key={r.type}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(r); }}
            title={r.label}
            disabled={toggleMut.isPending}
            style={{
              background: active ? r.bg : "transparent",
              color:      active ? r.color : "hsl(220 15% 50%)",
              border: `1px solid ${active ? r.color + "55" : "hsl(220 30% 20%)"}`,
            }}
            className={cn(
              "inline-flex items-center gap-1 rounded-md transition-all cursor-pointer select-none",
              compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-[11px]",
              "hover:opacity-80 font-semibold disabled:opacity-50",
            )}
          >
            <span>{r.icon}</span>
            {!compact && <span>{count > 0 ? count : ""}</span>}
          </button>
        );
      })}
    </div>
  );
}
