import { useState, useEffect } from "react";
import { X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface TutorialCoachProps {
  pageKey: string;        // unique key stored in localStorage
  children: React.ReactNode;
  accent?: "indigo" | "amber" | "green" | "rose" | "violet";
}

const accentMap = {
  indigo: {
    border: "border-indigo-500/30",
    glow: "shadow-indigo-500/10",
    icon: "text-indigo-400",
    iconBg: "bg-indigo-400/10",
    dismiss: "hover:text-indigo-300",
  },
  amber: {
    border: "border-amber-500/30",
    glow: "shadow-amber-500/10",
    icon: "text-amber-400",
    iconBg: "bg-amber-400/10",
    dismiss: "hover:text-amber-300",
  },
  green: {
    border: "border-green-500/30",
    glow: "shadow-green-500/10",
    icon: "text-green-400",
    iconBg: "bg-green-400/10",
    dismiss: "hover:text-green-300",
  },
  rose: {
    border: "border-rose-500/30",
    glow: "shadow-rose-500/10",
    icon: "text-rose-400",
    iconBg: "bg-rose-400/10",
    dismiss: "hover:text-rose-300",
  },
  violet: {
    border: "border-violet-500/30",
    glow: "shadow-violet-500/10",
    icon: "text-violet-400",
    iconBg: "bg-violet-400/10",
    dismiss: "hover:text-violet-300",
  },
};

export function TutorialCoach({ pageKey, children, accent = "indigo" }: TutorialCoachProps) {
  const storageKey = `treffin_tutorial_dismissed_${pageKey}`;
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(storageKey)) {
      const t = setTimeout(() => setVisible(true), 400);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [storageKey]);

  function dismiss() {
    setLeaving(true);
    setTimeout(() => {
      localStorage.setItem(storageKey, "1");
      setVisible(false);
      setLeaving(false);
    }, 280);
  }

  if (!visible) return null;

  const a = accentMap[accent];

  return (
    <div
      className={cn(
        "relative rounded-2xl border bg-card/60 backdrop-blur-sm shadow-lg p-5 flex gap-4 transition-all duration-300",
        a.border,
        a.glow,
        leaving ? "opacity-0 -translate-y-1" : "opacity-100 translate-y-0"
      )}
    >
      {/* Subtle gradient wash */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />

      {/* Icon */}
      <div className={cn("shrink-0 w-8 h-8 rounded-xl flex items-center justify-center mt-0.5", a.iconBg)}>
        <Sparkles className={cn("w-4 h-4", a.icon)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col gap-1.5 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>

      {/* Dismiss */}
      <button
        onClick={dismiss}
        className={cn("shrink-0 text-muted-foreground/40 transition-colors mt-0.5", a.dismiss)}
        aria-label="Dismiss tip"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
