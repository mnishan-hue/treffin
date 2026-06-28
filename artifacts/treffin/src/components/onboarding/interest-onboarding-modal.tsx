import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useUpdateUserInterests } from "@workspace/api-client-react";
import { useUser } from "@clerk/react";

const DOMAINS = [
  { name: "Philosophy", emoji: "🧠" },
  { name: "Science",    emoji: "🔬" },
  { name: "History",    emoji: "📜" },
  { name: "Economics",  emoji: "📈" },
  { name: "Law",        emoji: "⚖️" },
  { name: "Logic",      emoji: "♟️" },
  { name: "Psychology", emoji: "🪞" },
  { name: "Politics",   emoji: "🌍" },
] as const;

export const INTERESTS_STORAGE_KEY = "treffin_interests";

interface Props {
  onDone: (selected: string[]) => void;
  onSkip: () => void;
}

export function InterestOnboardingModal({ onDone, onSkip }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { isSignedIn } = useUser();
  const { mutate: saveInterests } = useUpdateUserInterests();

  const toggle = (name: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const handleConfirm = () => {
    if (selected.size < 3) return;
    const list = Array.from(selected);
    localStorage.setItem(INTERESTS_STORAGE_KEY, JSON.stringify(list));

    if (isSignedIn) {
      saveInterests({ data: { interests: list } });
    }

    onDone(list);
  };

  const handleSkip = () => {
    onSkip();
  };

  const canConfirm = selected.size >= 3;

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <motion.div
        className="relative w-full max-w-sm bg-card border border-border/60 rounded-2xl overflow-hidden shadow-2xl"
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 20 }}
        transition={{ type: "spring", stiffness: 340, damping: 28 }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(79,106,247,0.12)_0%,_transparent_65%)] pointer-events-none" />

        <div className="relative px-6 pt-7 pb-2 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/15 border border-primary/25 mb-4">
            <span className="text-2xl">✨</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight mb-1">
            What do you think about?
          </h2>
          <p className="text-sm text-muted-foreground">
            Pick at least 3 domains to personalise your feed
          </p>
        </div>

        <div className="relative px-6 py-5">
          <div className="grid grid-cols-4 gap-2.5">
            {DOMAINS.map(({ name, emoji }) => {
              const active = selected.has(name);
              return (
                <motion.button
                  key={name}
                  onClick={() => toggle(name)}
                  whileTap={{ scale: 0.93 }}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border p-2.5 cursor-pointer transition-all select-none",
                    active
                      ? "bg-primary/20 border-primary/60 shadow-[0_0_0_1px_rgba(79,106,247,0.4)]"
                      : "bg-background/50 border-border/60 hover:border-primary/30 hover:bg-primary/5"
                  )}
                >
                  <span className="text-xl leading-none">{emoji}</span>
                  <span className={cn(
                    "text-[10px] font-semibold leading-tight text-center",
                    active ? "text-primary" : "text-muted-foreground"
                  )}>
                    {name}
                  </span>
                </motion.button>
              );
            })}
          </div>

          {/* Selection count */}
          <div className="mt-3 text-center">
            <span className={cn(
              "text-xs font-medium transition-colors",
              selected.size >= 3 ? "text-primary" : "text-muted-foreground"
            )}>
              {selected.size < 3
                ? `${3 - selected.size} more to go`
                : `${selected.size} selected — nice!`}
            </span>
          </div>
        </div>

        <div className="relative px-6 pb-6 flex flex-col gap-2.5">
          <motion.button
            onClick={handleConfirm}
            disabled={!canConfirm}
            whileTap={canConfirm ? { scale: 0.97 } : undefined}
            className={cn(
              "w-full py-3 rounded-xl text-sm font-bold transition-all",
              canConfirm
                ? "treffin-gradient text-white card-glow cursor-pointer"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            Let's go →
          </motion.button>
          <button
            onClick={handleSkip}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            Skip for now
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
