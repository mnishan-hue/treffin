import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, MessageSquare, Trophy } from "lucide-react";

const COLORS = [
  "#6366f1", "#818cf8",
  "#3b82f6", "#60a5fa",
  "#10b981", "#34d399",
  "#f59e0b", "#fbbf24",
  "#ef4444", "#f87171",
  "#8b5cf6", "#a78bfa",
  "#ec4899", "#f472b6",
  "#14b8a6", "#2dd4bf",
];

interface Piece {
  id: number;
  x: number;
  color: string;
  isCircle: boolean;
  isRect: boolean;
  w: number;
  h: number;
  delay: number;
  duration: number;
  rotation: number;
  drift: number;
}

function generatePieces(count: number): Piece[] {
  return Array.from({ length: count }, (_, i) => {
    const shape = Math.random();
    const size = 6 + Math.random() * 10;
    return {
      id: i,
      x: Math.random() * 100,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      isCircle: shape > 0.66,
      isRect: shape > 0.33 && shape <= 0.66,
      w: shape > 0.33 && shape <= 0.66 ? size * 2.2 : size,
      h: size,
      delay: Math.random() * 1.4,
      duration: 2.8 + Math.random() * 2,
      rotation: (Math.random() - 0.5) * 900,
      drift: (Math.random() - 0.5) * 60,
    };
  });
}

function ConfettiPiece({ p }: { p: Piece }) {
  return (
    <motion.div
      className="absolute top-0 pointer-events-none"
      style={{
        left: `${p.x}%`,
        width: p.w,
        height: p.h,
        backgroundColor: p.color,
        borderRadius: p.isCircle ? "50%" : p.isRect ? "2px" : "3px",
      }}
      initial={{ y: -30, x: 0, rotate: 0, opacity: 1 }}
      animate={{ y: "108vh", x: p.drift, rotate: p.rotation, opacity: [1, 1, 1, 0.6, 0] }}
      transition={{ duration: p.duration, delay: p.delay, ease: "easeIn" }}
    />
  );
}

interface Props {
  onDismiss: () => void;
}

export function ConfettiCelebration({ onDismiss }: Props) {
  const [pieces] = useState(() => generatePieces(90));
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 450);
    }, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const dismiss = () => {
    setVisible(false);
    setTimeout(onDismiss, 450);
  };

  return (
    <div className="fixed inset-0 z-[9999] overflow-hidden pointer-events-none">
      {pieces.map((p) => (
        <ConfettiPiece key={p.id} p={p} />
      ))}

      <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
        <AnimatePresence>
          {visible && (
            <motion.div
              initial={{ scale: 0.4, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.88, opacity: 0, y: -12 }}
              transition={{ type: "spring", stiffness: 460, damping: 28 }}
              className="relative bg-gradient-to-br from-[#0a0e1a]/97 to-[#0b1240]/97 border border-indigo-500/50 rounded-2xl p-8 max-w-sm w-full mx-4 shadow-[0_0_80px_rgba(99,102,241,0.5)] text-center backdrop-blur-sm"
            >
              <button
                onClick={dismiss}
                className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <X className="w-3.5 h-3.5 text-white/70" />
              </button>

              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: [0, 1.3, 1], rotate: [0, 10, 0] }}
                transition={{ delay: 0.05, duration: 0.5, ease: "backOut" }}
                className="text-6xl mb-3 select-none"
              >
                🎉
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-2xl font-black text-white mb-1"
              >
                First Vote!
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-sm text-indigo-200/75 mb-5 leading-relaxed"
              >
                You've officially entered the debate.<br />
                Your voice is now part of the record.
              </motion.p>

              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="inline-flex items-center gap-2 bg-yellow-500/20 border border-yellow-400/40 text-yellow-300 font-bold px-5 py-2.5 rounded-full text-sm mb-5 shadow-[0_0_20px_rgba(234,179,8,0.25)]"
              >
                <Sparkles className="w-4 h-4" />
                +10 Reputation Points earned!
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.55 }}
                className="space-y-2 text-xs text-indigo-300/60"
              >
                <div className="flex items-center justify-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                  <span>Post an argument to earn +15 more rep</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <Trophy className="w-3.5 h-3.5 shrink-0" />
                  <span>Reach Scholar rank to unlock new features</span>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
