import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft } from "lucide-react";

const STORAGE_KEY = "treffin_math_welcomed_v1";

/* ─── Floating math symbols ──────────────────────────────────────────────── */
const SYMBOLS = ["∑", "∫", "π", "√", "∞", "Δ", "θ", "φ", "∂", "∇", "≡", "∈", "⊂", "λ", "α", "β"];

function MathParticles({ glow }: { glow: string }) {
  const items = useRef(
    Array.from({ length: 18 }, (_, i) => ({
      id: i,
      symbol: SYMBOLS[i % SYMBOLS.length],
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 10 + Math.random() * 14,
      dur: 6 + Math.random() * 8,
      delay: Math.random() * 4,
      amp: 12 + Math.random() * 20,
    }))
  ).current;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {items.map((p) => (
        <motion.span
          key={p.id}
          className="absolute select-none font-mono font-bold"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            fontSize: p.size,
            color: glow.replace(/[\d.]+\)$/, "0.18)"),
            textShadow: `0 0 8px ${glow.replace(/[\d.]+\)$/, "0.4)")}`,
          }}
          animate={{ y: [-p.amp, p.amp, -p.amp], opacity: [0.08, 0.22, 0.08] }}
          transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: "easeInOut" }}
        >
          {p.symbol}
        </motion.span>
      ))}
    </div>
  );
}

/* ─── Slide data ─────────────────────────────────────────────────────────── */
const SLIDES = [
  {
    id: "hero",
    icon: "∑",
    accent: "from-emerald-400 via-teal-400 to-cyan-500",
    glow: "rgba(16,185,129,0.45)",
    bg: "from-emerald-950/80 via-teal-950/60 to-cyan-950/80",
    headline: "Where Elegant\nMinds Solve.",
    sub: "Treffin Mathematics is a rigorous, competitive, and beautiful space for students and thinkers. Explore hard problems, write proofs, battle solutions, and build a mathematical reputation that truly means something.",
    tag: null,
    badge: null,
  },
  {
    id: "problems",
    icon: "📐",
    accent: "from-teal-400 via-cyan-400 to-sky-500",
    glow: "rgba(20,184,166,0.4)",
    bg: "from-teal-950/80 via-cyan-950/60 to-sky-950/80",
    headline: "Problems\nWorth Solving.",
    sub: "Browse hundreds of curated problems across Algebra, Calculus, Number Theory, Geometry, and more. Each problem is community-difficulty-rated from Beginner to Research level — there is always a challenge waiting for you.",
    tag: "Problem Library",
    badge: "🔢",
    pills: ["Algebra", "Calculus", "Number Theory", "Geometry", "Combinatorics"],
    difficulty: ["Beginner", "Intermediate", "Advanced", "Research"],
  },
  {
    id: "showdown",
    icon: "⚔️",
    accent: "from-amber-400 via-orange-400 to-rose-500",
    glow: "rgba(251,191,36,0.4)",
    bg: "from-amber-950/80 via-orange-950/60 to-rose-950/80",
    headline: "Elegance\nBattle.",
    sub: "When multiple solutions exist, they clash in a Showdown. The community votes on four axes — Elegant, Clear, Rigorous, and Efficient. Compare solutions head-to-head and crown the best proof. Open a live Debate Room to argue your approach.",
    tag: "Showdown",
    badge: null,
    axes: [
      { icon: "✨", label: "Elegant", color: "#a78bfa" },
      { icon: "👁️", label: "Clearest", color: "#38bdf8" },
      { icon: "🛡️", label: "Rigorous", color: "#34d399" },
      { icon: "⚡", label: "Efficient", color: "#fbbf24" },
    ],
  },
  {
    id: "contests",
    icon: "🏆",
    accent: "from-yellow-400 via-amber-400 to-orange-500",
    glow: "rgba(234,179,8,0.4)",
    bg: "from-yellow-950/80 via-amber-950/60 to-orange-950/80",
    headline: "Timed\nContests.",
    sub: "Compete in formal math contests with prizes, live countdown timers, and real pressure. Enter while they are Live, prepare for Upcoming events, and study Past contest problems to sharpen your edge.",
    tag: "Contests",
    badge: "⏱️",
    statuses: [
      { label: "Live", color: "#4ade80", dot: "#22c55e" },
      { label: "Upcoming", color: "#60a5fa", dot: "#3b82f6" },
      { label: "Past", color: "#94a3b8", dot: "#64748b" },
    ],
  },
  {
    id: "potw",
    icon: "⭐",
    accent: "from-violet-400 via-fuchsia-400 to-pink-500",
    glow: "rgba(139,92,246,0.4)",
    bg: "from-violet-950/80 via-fuchsia-950/60 to-pink-950/80",
    headline: "Problem of\nthe Week.",
    sub: "Every Monday a hand-picked problem is spotlighted as Problem of the Week. Solve it, earn recognition, and see the featured solution and winner in the archive. It is the most prestigious single problem on the platform.",
    tag: "POTW",
    badge: "📅",
  },
  {
    id: "reputation",
    icon: "🎖️",
    accent: "from-cyan-400 via-teal-400 to-emerald-500",
    glow: "rgba(6,182,212,0.4)",
    bg: "from-cyan-950/80 via-teal-950/60 to-emerald-950/80",
    headline: "Reputation\nand Reactions.",
    sub: "Earn reputation through solving problems and receiving community recognition. React to solutions with Eureka badges — Elegant, Creative, Insightful, Rigorous, Beginner Friendly, and Learning Moment. Climb the leaderboard and show the math world what you are made of.",
    tag: "Reputation",
    badge: null,
    reactions: [
      { emoji: "💡", label: "Elegant" },
      { emoji: "🎨", label: "Creative" },
      { emoji: "🔭", label: "Insightful" },
      { emoji: "🔬", label: "Rigorous" },
      { emoji: "🌱", label: "Friendly" },
      { emoji: "📚", label: "Learning" },
    ],
  },
  {
    id: "bookmarks",
    icon: "🔖",
    accent: "from-sky-400 via-indigo-400 to-violet-500",
    glow: "rgba(56,189,248,0.4)",
    bg: "from-sky-950/80 via-indigo-950/60 to-violet-950/80",
    headline: "Save, Note,\nRevisit.",
    sub: "Bookmark any problem to custom-named lists and attach private notes to remember why you saved it. Build your personal problem library and revisit the ones that matter most. Your mathematical journey, organised.",
    tag: "Bookmarks",
    badge: "📒",
  },
];

/* ─── Slide variants ─────────────────────────────────────────────────────── */
const slideVariants = {
  enter: (d: number) => ({ x: d * 48, opacity: 0, scale: 0.97 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit:  (d: number) => ({ x: d * -48, opacity: 0, scale: 0.97 }),
};

/* ─── Pill component ─────────────────────────────────────────────────────── */
function Pill({ label, color }: { label: string; color?: string }) {
  return (
    <span
      className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold border"
      style={{
        borderColor: color ? `${color}55` : "rgba(255,255,255,0.15)",
        color: color ?? "rgba(255,255,255,0.75)",
        background: color ? `${color}18` : "rgba(255,255,255,0.07)",
      }}
    >
      {label}
    </span>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────── */
export function MathWelcomeModal() {
  const [open, setOpen]   = useState(false);
  const [page, setPage]   = useState(0);
  const [dir,  setDir]    = useState(1);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      const t = setTimeout(() => {
        localStorage.setItem(STORAGE_KEY, "1");
        setOpen(true);
      }, 5000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, []);

  const dismiss = useCallback(() => setOpen(false), []);

  const goTo = useCallback((next: number, direction: number) => {
    setDir(direction);
    setPage(next);
  }, []);

  const next = useCallback(() => {
    if (page < SLIDES.length - 1) goTo(page + 1, 1);
    else dismiss();
  }, [page, dismiss, goTo]);

  const prev = useCallback(() => {
    if (page > 0) goTo(page - 1, -1);
  }, [page, goTo]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape")      dismiss();
      if (e.key === "ArrowRight")  next();
      if (e.key === "ArrowLeft")   prev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, next, prev, dismiss]);

  const slide   = SLIDES[page];
  const isLast  = page === SLIDES.length - 1;
  const isFirst = page === 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={dismiss}
        >
          <motion.div
            className="relative w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
            style={{
              background: "#050f0a",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: `0 0 0 1px rgba(255,255,255,0.04), 0 32px 80px rgba(0,0,0,0.7), 0 0 80px ${slide.glow}`,
            }}
            initial={{ scale: 0.92, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.93, opacity: 0, y: 16 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Glow blob */}
            <div
              className="absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full blur-3xl pointer-events-none"
              style={{ background: slide.glow, opacity: 0.22 }}
            />

            {/* Gradient header strip */}
            <div className={`h-1.5 w-full bg-gradient-to-r ${slide.accent}`} />

            {/* Floating math particles */}
            <MathParticles glow={slide.glow} />

            {/* Close */}
            <button
              onClick={dismiss}
              className="absolute top-4 right-4 z-10 w-7 h-7 rounded-full flex items-center justify-center transition-colors"
              style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)" }}
              aria-label="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            {/* Slide content */}
            <div className="relative px-8 pt-8 pb-6 min-h-[420px] flex flex-col">
              <AnimatePresence mode="wait" custom={dir}>
                <motion.div
                  key={slide.id}
                  custom={dir}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                  className="flex flex-col gap-5 flex-1"
                >
                  {/* Icon + tag row */}
                  <div className="flex items-center gap-3">
                    <motion.div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl bg-gradient-to-br ${slide.accent} shadow-lg`}
                      initial={{ scale: 0.7, rotate: -8 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: 0.05, type: "spring", stiffness: 400, damping: 20 }}
                    >
                      {slide.icon}
                    </motion.div>
                    {slide.tag && (
                      <span
                        className={`text-[11px] font-bold uppercase tracking-widest bg-gradient-to-r ${slide.accent} bg-clip-text`}
                        style={{ WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
                      >
                        {slide.tag}
                      </span>
                    )}
                  </div>

                  {/* Headline */}
                  <motion.h2
                    className={`text-3xl font-black leading-tight bg-gradient-to-br ${slide.accent} bg-clip-text`}
                    style={{ WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", whiteSpace: "pre-line" }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 }}
                  >
                    {slide.headline}
                  </motion.h2>

                  {/* Sub text */}
                  <motion.p
                    className="text-sm leading-relaxed"
                    style={{ color: "rgba(255,255,255,0.62)" }}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12 }}
                  >
                    {slide.sub}
                  </motion.p>

                  {/* Slide-specific extras */}
                  {slide.id === "problems" && (
                    <motion.div
                      className="flex flex-col gap-2"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.18 }}
                    >
                      <div className="flex flex-wrap gap-1.5">
                        {(slide as any).pills.map((p: string) => (
                          <Pill key={p} label={p} color="#14b8a6" />
                        ))}
                      </div>
                      <div className="flex gap-1.5 mt-0.5">
                        {(["Beginner","Intermediate","Advanced","Research"] as string[]).map((d, i) => {
                          const colors = ["#4ade80","#fbbf24","#fb923c","#f43f5e"];
                          return <Pill key={d} label={d} color={colors[i]} />;
                        })}
                      </div>
                    </motion.div>
                  )}

                  {slide.id === "showdown" && (
                    <motion.div
                      className="grid grid-cols-2 sm:grid-cols-4 gap-2"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.18 }}
                    >
                      {(slide as any).axes.map((ax: { icon: string; label: string; color: string }) => (
                        <div
                          key={ax.label}
                          className="flex flex-col items-center gap-1 rounded-xl py-2.5 px-1"
                          style={{ background: `${ax.color}14`, border: `1px solid ${ax.color}33` }}
                        >
                          <span className="text-lg">{ax.icon}</span>
                          <span className="text-[10px] font-bold" style={{ color: ax.color }}>{ax.label}</span>
                        </div>
                      ))}
                    </motion.div>
                  )}

                  {slide.id === "contests" && (
                    <motion.div
                      className="flex gap-3"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.18 }}
                    >
                      {(slide as any).statuses.map((s: { label: string; color: string; dot: string }) => (
                        <div
                          key={s.label}
                          className="flex items-center gap-1.5 rounded-full px-3 py-1"
                          style={{ background: `${s.dot}18`, border: `1px solid ${s.dot}44` }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
                          <span className="text-[11px] font-semibold" style={{ color: s.color }}>{s.label}</span>
                        </div>
                      ))}
                    </motion.div>
                  )}

                  {slide.id === "reputation" && (
                    <motion.div
                      className="flex flex-wrap gap-2"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.18 }}
                    >
                      {(slide as any).reactions.map((r: { emoji: string; label: string }) => (
                        <div
                          key={r.label}
                          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                          style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.25)", color: "rgba(255,255,255,0.7)" }}
                        >
                          <span>{r.emoji}</span>
                          <span>{r.label}</span>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* ── Nav row ── */}
              <div className="flex items-center justify-between mt-6 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                {/* Back */}
                <button
                  onClick={prev}
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
                  style={{
                    background: isFirst ? "transparent" : "rgba(255,255,255,0.07)",
                    color: isFirst ? "transparent" : "rgba(255,255,255,0.5)",
                    pointerEvents: isFirst ? "none" : "auto",
                  }}
                  aria-label="Previous"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Progress dots */}
                <div className="flex items-center gap-1.5">
                  {SLIDES.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => goTo(i, i > page ? 1 : -1)}
                      className="transition-all duration-300 rounded-full"
                      style={{
                        width: i === page ? 20 : 6,
                        height: 6,
                        background: i === page
                          ? `linear-gradient(to right, ${slide.glow.replace(/[\d.]+\)$/, "1)")}, white)`
                          : "rgba(255,255,255,0.18)",
                      }}
                    />
                  ))}
                </div>

                {/* Next / finish */}
                {isLast ? (
                  <button
                    onClick={dismiss}
                    className={`px-4 h-9 rounded-full text-xs font-bold text-white bg-gradient-to-r ${slide.accent} shadow-md hover:opacity-90 transition-opacity`}
                  >
                    Explore ✦
                  </button>
                ) : (
                  <button
                    onClick={next}
                    className={`w-9 h-9 rounded-full flex items-center justify-center bg-gradient-to-br ${slide.accent} text-white shadow-md hover:opacity-90 transition-opacity`}
                    aria-label="Next"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
