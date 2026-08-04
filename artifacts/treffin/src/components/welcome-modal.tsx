import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft } from "lucide-react";

const STORAGE_KEY = "treffin_welcomed_v1";
const SHOW_FLAG = "treffin_show_welcome";

/* ─── Slide data ─────────────────────────────────────────────────────────── */
const SLIDES = [
  {
    id: "hero",
    emoji: null,
    logo: true,
    accent: "from-indigo-500 via-violet-500 to-purple-600",
    glow: "rgba(99,102,241,0.45)",
    headline: "Where Minds\nCelebrate.",
    sub: "Treffin is the intellectual playground built for students and thinkers who want to do more than scroll — debate live, publish ideas, solve hard problems, and build a reputation that actually means something.",
    tag: null,
  },
  {
    id: "debates",
    emoji: "⚡",
    logo: false,
    accent: "from-rose-500 via-orange-400 to-amber-500",
    glow: "rgba(244,63,94,0.4)",
    headline: "Clash of\nIdeas.",
    sub: "Step into structured, two-sided debates on real topics. Pick a stance, argue your case, and let the community decide who made the stronger case. Every word sharpens your thinking.",
    tag: "Live Debates",
  },
  {
    id: "articles",
    emoji: "✍️",
    logo: false,
    accent: "from-sky-400 via-blue-500 to-indigo-600",
    glow: "rgba(56,189,248,0.4)",
    headline: "Write What\nMatters.",
    sub: "Publish long-form articles, analysis, and essays. Get real feedback from a community that reads carefully. Your ideas deserve more than a tweet.",
    tag: "Articles",
  },
  {
    id: "communities",
    emoji: "🏘️",
    logo: false,
    accent: "from-emerald-400 via-teal-500 to-cyan-600",
    glow: "rgba(52,211,153,0.4)",
    headline: "Find Your\nTribe.",
    sub: "Join topic-based communities of curious people. Participate in events, weekly challenges, and discussions that go deep — no shallow hot takes allowed.",
    tag: "Communities",
  },
  {
    id: "math",
    emoji: "∑",
    logo: false,
    accent: "from-violet-500 via-purple-500 to-fuchsia-600",
    glow: "rgba(167,139,250,0.4)",
    headline: "Math Hub\nAwakens.",
    sub: "Post original problems, solve others', compete in timed contests, and climb the leaderboard. From calculus to combinatorics — if it's hard, it belongs here.",
    tag: "Mathematics",
  },
  {
    id: "reputation",
    emoji: "🏆",
    logo: false,
    accent: "from-amber-400 via-yellow-500 to-orange-500",
    glow: "rgba(251,191,36,0.4)",
    headline: "Earn Your\nReputation.",
    sub: "Every quality post, winning debate, and solved problem builds your rep score. Rise through the ranks — from Curious Mind to Elite Thinker — and let your intellectual record speak for itself.",
    tag: "Reputation",
    cta: true,
  },
];

const TOTAL = SLIDES.length;

/* ─── Floating star particles ─────────────────────────────────────────────── */
const PARTICLES = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: 1 + Math.random() * 3,
  delay: Math.random() * 4,
  dur: 3 + Math.random() * 5,
}));

/* ─── Splash star field ──────────────────────────────────────────────────── */
const STARS = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: 0.8 + Math.random() * 2.2,
  delay: Math.random() * 3,
  dur: 2 + Math.random() * 4,
  opacity: 0.15 + Math.random() * 0.55,
}));

/* ─── Splash screen ──────────────────────────────────────────────────────── */
function WelcomeSplash({ onContinue }: { onContinue: () => void }) {
  const autoRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    autoRef.current = setTimeout(onContinue, 3200);
    return () => { if (autoRef.current) clearTimeout(autoRef.current); };
  }, [onContinue]);

  const skip = () => {
    if (autoRef.current) clearTimeout(autoRef.current);
    onContinue();
  };

  return (
    <motion.div
      key="splash"
      initial={{ opacity: 0, scale: 0.96, y: 24 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 1.04, y: -8 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative w-full max-w-md rounded-3xl overflow-hidden flex flex-col items-center justify-center"
      style={{
        minHeight: 520,
        background: "linear-gradient(160deg, hsl(245 60% 6%) 0%, hsl(260 55% 9%) 40%, hsl(240 50% 7%) 100%)",
        border: "1px solid rgba(139,92,246,0.2)",
        boxShadow: "0 0 120px rgba(99,102,241,0.5), 0 0 40px rgba(139,92,246,0.3), 0 40px 80px rgba(0,0,0,0.7)",
      }}
      onClick={skip}
    >
      {/* Pulsing background orbs */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 340, height: 340,
          top: "50%", left: "50%",
          transform: "translate(-50%,-50%)",
          background: "radial-gradient(circle, rgba(99,102,241,0.22) 0%, transparent 70%)",
        }}
        animate={{ scale: [1, 1.18, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 200, height: 200,
          top: "50%", left: "50%",
          transform: "translate(-50%,-50%)",
          background: "radial-gradient(circle, rgba(167,139,250,0.28) 0%, transparent 70%)",
        }}
        animate={{ scale: [1.1, 0.9, 1.1], opacity: [0.5, 0.9, 0.5] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
      />

      {/* Corner glows */}
      <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-violet-700/20 blur-[70px] pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full bg-indigo-700/20 blur-[70px] pointer-events-none" />

      {/* Star field */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {STARS.map(s => (
          <motion.div
            key={s.id}
            className="absolute rounded-full bg-white"
            style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.size, height: s.size }}
            animate={{ opacity: [0, s.opacity, 0], scale: [0.6, 1.2, 0.6] }}
            transition={{ duration: s.dur, delay: s.delay, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </div>

      {/* Close button */}
      <button
        onClick={(e) => { e.stopPropagation(); skip(); }}
        className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/8 transition-all"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-10 py-14 gap-0">
        {/* Logo mark — bounces in */}
        <motion.div
          initial={{ scale: 0, opacity: 0, y: -20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", damping: 14, stiffness: 200, delay: 0.15 }}
          className="mb-7"
        >
          <div
            className="w-20 h-20 rounded-[22px] flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)",
              boxShadow: "0 0 40px rgba(139,92,246,0.7), 0 0 80px rgba(99,102,241,0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
            }}
          >
            <svg viewBox="0 0 48 48" fill="none" className="w-11 h-11">
              <path d="M14 10 L24 10 L24 38 L14 38 Z" fill="white" opacity="0.95" />
              <path d="M24 10 L38 10 L38 24 L24 24 Z" fill="white" opacity="0.65" />
            </svg>
          </div>
        </motion.div>

        {/* "Welcome to" — fades in */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.55, ease: "easeOut" }}
          className="text-[13px] font-semibold tracking-[0.25em] uppercase text-white/45 mb-2"
        >
          Welcome to
        </motion.p>

        {/* "Treffin" — each letter staggers in */}
        <div className="flex items-end gap-0 mb-5" aria-label="Treffin">
          {"Treffin".split("").map((char, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 28, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{
                duration: 0.55,
                delay: 0.75 + i * 0.07,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="text-[56px] font-black leading-none"
              style={{
                background: "linear-gradient(135deg, #e0e7ff 0%, #a5b4fc 35%, #c4b5fd 65%, #f0abfc 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                textShadow: "none",
                letterSpacing: "-0.03em",
              }}
            >
              {char}
            </motion.span>
          ))}
        </div>

        {/* Divider line */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.4, ease: "easeOut" }}
          className="w-14 h-px mb-5"
          style={{ background: "linear-gradient(to right, transparent, rgba(167,139,250,0.7), transparent)" }}
        />

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.55, ease: "easeOut" }}
          className="text-[13px] font-medium tracking-[0.18em] uppercase text-white/35"
        >
          Where Minds Celebrate
        </motion.p>

        {/* Tap hint */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 2.2 }}
          className="text-[11px] text-white/20 mt-8 tracking-wide"
        >
          Tap anywhere to continue
        </motion.p>
      </div>

      {/* Bottom shimmer bar */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-[3px] pointer-events-none"
        style={{
          background: "linear-gradient(to right, transparent, #8b5cf6, #6366f1, #8b5cf6, transparent)",
        }}
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
      />
    </motion.div>
  );
}

export function WelcomeModal() {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"splash" | "slides">("splash");
  const [page, setPage] = useState(0);
  const [dir, setDir] = useState(1);
  const [location] = useLocation();

  useEffect(() => {
    if (localStorage.getItem(SHOW_FLAG) === "1") {
      const t = setTimeout(() => {
        localStorage.removeItem(SHOW_FLAG);
        localStorage.setItem(STORAGE_KEY, "1");
        setPhase("splash");
        setPage(0);
        setOpen(true);
      }, 10000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [location]);

  const dismiss = useCallback(() => setOpen(false), []);

  const goTo = useCallback((next: number, direction: number) => {
    setDir(direction);
    setPage(next);
  }, []);

  const prev = useCallback(() => { if (page > 0) goTo(page - 1, -1); }, [page, goTo]);
  const next = useCallback(() => {
    if (page < TOTAL - 1) goTo(page + 1, 1);
    else dismiss();
  }, [page, dismiss, goTo]);

  useEffect(() => {
    if (!open || phase !== "slides") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, phase, next, prev, dismiss]);

  const slide = SLIDES[page];
  const isLast = page === TOTAL - 1;

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? 60 : -60, opacity: 0, scale: 0.96 }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit: (d: number) => ({ x: d > 0 ? -60 : 60, opacity: 0, scale: 0.96 }),
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
          animate={{ opacity: 1, backdropFilter: "blur(20px)" }}
          exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[300] flex items-center justify-center p-4"
          style={{ background: "rgba(4,6,15,0.88)" }}
          onClick={phase === "slides" ? dismiss : undefined}
        >
          <AnimatePresence mode="wait">
            {phase === "splash" ? (
              <WelcomeSplash key="splash" onContinue={() => setPhase("slides")} />
            ) : (
              /* ── Slides carousel ── */
              <motion.div
                key="card"
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.92, opacity: 0, y: 12 }}
                transition={{ type: "spring", damping: 22, stiffness: 260 }}
                className="relative w-full max-w-md rounded-3xl overflow-hidden"
                style={{
                  background: "linear-gradient(145deg,hsl(220 52% 9%),hsl(220 52% 7%))",
                  border: "1px solid rgba(255,255,255,0.08)",
                  boxShadow: `0 0 80px ${slide.glow}, 0 32px 64px rgba(0,0,0,0.6)`,
                }}
                onClick={e => e.stopPropagation()}
              >
                {/* Glow ring */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={slide.id + "-glow"}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    className={`absolute -top-24 -right-24 w-72 h-72 rounded-full bg-gradient-to-br ${slide.accent} blur-[80px] opacity-25 pointer-events-none`}
                  />
                </AnimatePresence>
                <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-indigo-900/30 blur-[60px] pointer-events-none" />

                {/* Particles */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  {PARTICLES.map(p => (
                    <motion.div
                      key={p.id}
                      className="absolute rounded-full bg-white"
                      style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size }}
                      animate={{ opacity: [0.08, 0.35, 0.08], y: [0, -8, 0] }}
                      transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: "easeInOut" }}
                    />
                  ))}
                </div>

                {/* Close */}
                <button
                  onClick={dismiss}
                  className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/8 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Slide content */}
                <div className="relative min-h-[420px] flex flex-col px-8 pt-10 pb-8">
                  <AnimatePresence mode="wait" custom={dir}>
                    <motion.div
                      key={slide.id}
                      custom={dir}
                      variants={variants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
                      className="flex flex-col flex-1"
                    >
                      {slide.tag && (
                        <div className="mb-5">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide bg-gradient-to-r ${slide.accent} text-white shadow-md`}>
                            {slide.emoji && <span className="text-sm leading-none">{slide.emoji}</span>}
                            {slide.tag}
                          </span>
                        </div>
                      )}

                      {slide.logo && (
                        <div className="mb-6">
                          <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${slide.accent} flex items-center justify-center shadow-xl shadow-indigo-900/50 mb-1`}>
                            <svg viewBox="0 0 48 48" fill="none" className="w-9 h-9">
                              <path d="M14 10 L24 10 L24 38 L14 38 Z" fill="white" opacity="0.9" />
                              <path d="M24 10 L38 10 L38 24 L24 24 Z" fill="white" opacity="0.6" />
                            </svg>
                          </div>
                        </div>
                      )}

                      {slide.emoji && !slide.tag && (
                        <div className="mb-5 text-5xl leading-none">{slide.emoji}</div>
                      )}

                      <h2 className={`text-4xl font-black leading-[1.1] mb-4 bg-gradient-to-br ${slide.accent} bg-clip-text text-transparent whitespace-pre-line`}>
                        {slide.headline}
                      </h2>

                      <p className="text-[15px] leading-relaxed text-white/60 flex-1">
                        {slide.sub}
                      </p>

                      {"cta" in slide && slide.cta && (
                        <motion.button
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 }}
                          onClick={dismiss}
                          className={`mt-6 w-full py-3.5 rounded-2xl font-bold text-[15px] text-white bg-gradient-to-r ${slide.accent} shadow-lg hover:opacity-90 active:scale-[0.98] transition-all`}
                        >
                          Let's go →
                        </motion.button>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Footer */}
                <div className="relative px-8 pb-7 flex items-center justify-between">
                  <button
                    onClick={prev}
                    disabled={page === 0}
                    className="w-9 h-9 rounded-full flex items-center justify-center border border-white/10 text-white/40 hover:text-white/80 hover:border-white/25 disabled:opacity-0 disabled:pointer-events-none transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

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
                            ? `linear-gradient(to right, ${slide.glow.replace("0.4)", "1)").replace("0.45)", "1)")}, white)`
                            : "rgba(255,255,255,0.2)",
                        }}
                      />
                    ))}
                  </div>

                  <button
                    onClick={next}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                      isLast
                        ? "opacity-0 pointer-events-none"
                        : `bg-gradient-to-br ${slide.accent} text-white shadow-md hover:opacity-90`
                    }`}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
