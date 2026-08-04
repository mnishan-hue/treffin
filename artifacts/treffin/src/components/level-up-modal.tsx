import { motion } from "framer-motion";
import { useAppContext } from "@/context/app-context";
import { Trophy, Star, ArrowRight, X } from "lucide-react";
import { Link } from "wouter";

const NEXT_LEVEL = {
  name: "Intellectual",
  color: "text-orange-400",
  glow: "shadow-[0_0_50px_rgba(251,146,60,0.3)]",
  gradient: "from-orange-600 to-amber-500",
};

const STARS = Array(12).fill(0).map((_, i) => ({
  x: Math.random() * 100,
  y: Math.random() * 100,
  delay: Math.random() * 0.8,
  size: 3 + Math.random() * 4,
}));

export function LevelUpModal() {
  const { showLevelUp, dismissLevelUp } = useAppContext();
  if (!showLevelUp) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md" onClick={dismissLevelUp}>
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", damping: 15, stiffness: 200 }}
        className="relative bg-card border border-orange-500/30 rounded-3xl p-8 max-w-sm w-full mx-4 text-center overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Background glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-orange-600/10 via-transparent to-amber-600/10 pointer-events-none" />

        {/* Particle stars */}
        {STARS.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: [0, 1, 0], scale: [0, 1, 0.5], x: [0, (Math.random() - 0.5) * 60], y: [0, (Math.random() - 0.5) * 60] }}
            transition={{ duration: 1.5, delay: s.delay, repeat: Infinity, repeatDelay: 2 }}
            className="absolute text-yellow-400 pointer-events-none"
            style={{ left: `${s.x}%`, top: `${s.y}%`, fontSize: s.size }}
          >
            ✦
          </motion.div>
        ))}

        {/* Close */}
        <button className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" onClick={dismissLevelUp}>
          <X className="w-4 h-4" />
        </button>

        {/* Trophy */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className={`w-20 h-20 rounded-full bg-gradient-to-br ${NEXT_LEVEL.gradient} flex items-center justify-center mx-auto mb-5 ${NEXT_LEVEL.glow}`}
        >
          <Trophy className="w-10 h-10 text-white" />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Level Up!</p>
          <h2 className="text-3xl font-black mb-1">
            <span className={NEXT_LEVEL.color}>{NEXT_LEVEL.name}</span>
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed mb-5">
            Your intellectual depth has been recognised. You've crossed into elite territory — keep debating, writing, and engaging to reach <strong className="text-yellow-400">Elite Thinker</strong>.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="flex flex-col gap-3">
          <div className="flex gap-2 mt-1">
            <button
              className="flex-1 py-2.5 rounded-full border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => { navigator.clipboard.writeText("I just reached Intellectual level on Treffin! 🧠").catch(() => {}); dismissLevelUp(); }}
            >
              Share 🎉
            </button>
            <Link href="/profile">
              <button className={`flex-1 py-2.5 rounded-full bg-gradient-to-r ${NEXT_LEVEL.gradient} text-white font-bold text-sm flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity`} onClick={dismissLevelUp}>
                View Profile <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </Link>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
