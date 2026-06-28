import { useState, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useGetDebates } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import {
  User, Heart, Zap, Star, Rocket,
  GraduationCap, Briefcase, Pen, CircleDot,
  Monitor, Scale, Lightbulb, FlaskConical, Brain,
  BarChart2, Globe, Leaf, Clock, Palette,
  BookOpen, Check, ArrowRight, Shield, Lock,
  Users, MessageSquare, TrendingUp, Sparkles,
  ChevronDown,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";

// ── Data ──────────────────────────────────────────────────────────────────────

const FOCUS_OPTIONS = [
  { id: "student", label: "Student", desc: "Learning and growing academically", icon: GraduationCap },
  { id: "professional", label: "Professional", desc: "Industry expert or practitioner", icon: Briefcase },
  { id: "creator", label: "Creator", desc: "Writer, content creator, or thinker", icon: Pen },
  { id: "other", label: "Other", desc: "Just here to explore and debate", icon: CircleDot },
];

const INTERESTS = [
  { id: "technology", label: "Technology", icon: Monitor },
  { id: "politics", label: "Politics", icon: Scale },
  { id: "philosophy", label: "Philosophy", icon: Lightbulb },
  { id: "science", label: "Science", icon: FlaskConical },
  { id: "psychology", label: "Psychology", icon: Brain },
  { id: "economics", label: "Economics", icon: BarChart2 },
  { id: "social_issues", label: "Social Issues", icon: Globe },
  { id: "environment", label: "Environment", icon: Leaf },
  { id: "history", label: "History", icon: Clock },
  { id: "art_culture", label: "Art & Culture", icon: Palette },
  { id: "education", label: "Education", icon: BookOpen },
  { id: "startups", label: "Startups", icon: Rocket },
];

const DEBATE_STYLES = [
  { id: "serious", label: "Serious & Intellectual", desc: "Deep, thoughtful, and informative debates.", icon: Brain },
  { id: "balanced", label: "Balanced & Respectful", desc: "Healthy discussions with different perspectives.", icon: Scale },
  { id: "fun", label: "Fun & Engaging", desc: "Light-hearted, trending, and entertaining debates.", icon: Sparkles },
  { id: "competitive", label: "Competitive & Challenging", desc: "High-energy debates and intellectual challenges.", icon: Zap },
];

const GOALS = [
  { id: "learn", label: "Learn & Grow", desc: "Expand my knowledge and perspectives.", icon: Brain },
  { id: "share", label: "Share Ideas", desc: "Express my thoughts and opinions.", icon: MessageSquare },
  { id: "connect", label: "Find My People", desc: "Connect with like-minded thinkers.", icon: Users },
  { id: "impact", label: "Make an Impact", desc: "Create change through discussions.", icon: TrendingUp },
];

const UPDATE_FREQS = ["Daily", "Weekly", "Monthly", "Never"];

// ── Logo ──────────────────────────────────────────────────────────────────────

function TreffinLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const iconH = size === "lg" ? "h-24" : size === "sm" ? "h-10" : "h-16";
  const nameSize = size === "lg" ? "text-4xl" : size === "sm" ? "text-lg" : "text-2xl";
  const subSize = size === "lg" ? "text-sm" : size === "sm" ? "text-[9px]" : "text-xs";
  return (
    <div className="flex flex-col items-center gap-3">
      <img
        src={`${import.meta.env.BASE_URL}treffin-mark.png`}
        alt="Treffin"
        className={cn("w-auto object-contain mix-blend-screen drop-shadow-[0_0_28px_rgba(139,92,246,0.8)]", iconH)}
      />
      <div className="flex flex-col items-center gap-1">
        <span className={cn("font-black tracking-tight text-foreground leading-none", nameSize)}>Treffin</span>
        <span className={cn("text-muted-foreground uppercase tracking-[0.2em] leading-none", subSize)}>Where Minds Celebrate.</span>
      </div>
    </div>
  );
}

// ── Atmospheric background ────────────────────────────────────────────────────

function AtmosphericBg() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Stars */}
      {[...Array(60)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            width: Math.random() * 2 + 1 + "px",
            height: Math.random() * 2 + 1 + "px",
            top: Math.random() * 75 + "%",
            left: Math.random() * 100 + "%",
            opacity: Math.random() * 0.5 + 0.1,
          }}
        />
      ))}
      {/* Main portal glow */}
      <div
        className="absolute rounded-full"
        style={{
          width: "340px",
          height: "340px",
          bottom: "14%",
          left: "50%",
          transform: "translateX(-50%)",
          background: "radial-gradient(circle, rgba(99,89,247,0.55) 0%, rgba(37,99,235,0.3) 40%, transparent 70%)",
          filter: "blur(2px)",
        }}
      />
      {/* Portal ring */}
      <div
        className="absolute rounded-full border-2"
        style={{
          width: "220px",
          height: "220px",
          bottom: "18%",
          left: "50%",
          transform: "translateX(-50%)",
          borderColor: "rgba(99,89,247,0.6)",
          boxShadow: "0 0 40px rgba(79,106,247,0.5), inset 0 0 40px rgba(79,106,247,0.15)",
        }}
      />
      {/* Warm horizon glow */}
      <div
        className="absolute"
        style={{
          width: "100%",
          height: "120px",
          bottom: "0",
          background: "radial-gradient(ellipse 80% 100% at 50% 100%, rgba(139,92,246,0.12) 0%, rgba(217,70,239,0.06) 40%, transparent 70%)",
        }}
      />
      {/* Ground silhouette */}
      <svg
        className="absolute bottom-0 left-0 right-0 w-full"
        height="120"
        viewBox="0 0 800 120"
        preserveAspectRatio="none"
        fill="none"
      >
        <path
          d="M0 120 L0 80 Q100 70 200 78 Q300 86 400 72 Q500 58 600 75 Q700 82 800 70 L800 120 Z"
          fill="rgba(4,8,18,0.95)"
        />
      </svg>
      {/* Silhouette figure */}
      <svg
        className="absolute"
        style={{ bottom: "60px", left: "50%", transform: "translateX(-50%)" }}
        width="32"
        height="72"
        viewBox="0 0 32 72"
        fill="none"
      >
        <ellipse cx="16" cy="8" rx="7" ry="7" fill="#0a0e1a" />
        <rect x="10" y="15" width="12" height="28" rx="4" fill="#0a0e1a" />
        <rect x="2" y="17" width="8" height="20" rx="3" fill="#0a0e1a" />
        <rect x="22" y="17" width="8" height="20" rx="3" fill="#0a0e1a" />
        <rect x="10" y="42" width="5" height="26" rx="2.5" fill="#0a0e1a" />
        <rect x="17" y="42" width="5" height="26" rx="2.5" fill="#0a0e1a" />
      </svg>
    </div>
  );
}

// ── Welcome screen ────────────────────────────────────────────────────────────

function WelcomeScreen({ onGetStarted }: { onGetStarted: () => void }) {
  const [, setLocation] = useLocation();
  const { data: debates } = useGetDebates();
  const liveDebates = (debates ?? []).filter(d => d.isLive).slice(0, 3);
  const previewDebates = liveDebates.length >= 2 ? liveDebates : (debates ?? []).slice(0, 3);
  const totalParticipants = (debates ?? []).reduce((s, d) => s + d.participantCount, 0);

  return (
    <div
      className="min-h-screen w-full relative flex flex-col items-center justify-center overflow-hidden"
      style={{ background: "linear-gradient(180deg, #040810 0%, #07101e 50%, #040810 100%)" }}
    >
      <AtmosphericBg />

      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-md w-full py-16">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6"
        >
          <TreffinLogo size="lg" />
        </motion.div>

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="flex flex-col gap-3 mb-6"
        >
          <h1 className="text-3xl font-black leading-tight">Think. Write. Debate.</h1>
          <p className="text-sm text-white/55 leading-relaxed max-w-xs mx-auto">
            The intellectual platform for students and thinkers. Debate live, publish articles, join communities, and build your reputation.
          </p>
          {/* What's on Treffin */}
          <div className="grid grid-cols-2 gap-2 mt-2 w-full text-left">
            {[
              { emoji: "⚡", label: "Live Debates", desc: "Structured, two-sided arguments" },
              { emoji: "✍️", label: "Articles", desc: "Long-form ideas & analysis" },
              { emoji: "🏘️", label: "Communities", desc: "Topic-based groups & events" },
              { emoji: "🏆", label: "Reputation", desc: "Earn rank through quality" },
            ].map((item) => (
              <div key={item.label} className="bg-white/4 border border-white/8 rounded-xl px-3 py-2.5 flex items-start gap-2.5">
                <span className="text-base leading-none mt-0.5">{item.emoji}</span>
                <div>
                  <p className="text-[11px] font-bold text-white/80">{item.label}</p>
                  <p className="text-[10px] text-white/35 leading-tight mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>


        {/* Live debates preview */}
        {previewDebates.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.4 }}
            className="w-full mb-6"
          >
            <div className="flex items-center gap-2 mb-3 justify-center">
              <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
              <span className="text-[11px] font-bold text-white/50 uppercase tracking-widest">Happening Now</span>
            </div>
            <div className="flex flex-col gap-2">
              {previewDebates.map((d) => (
                <div
                  key={d.id}
                  className="bg-white/5 border border-white/8 rounded-xl p-3.5 text-left hover:bg-white/10 hover:border-white/15 transition-all cursor-pointer group"
                  onClick={onGetStarted}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-indigo-400 bg-indigo-500/15 border border-indigo-500/25 px-2 py-0.5 rounded-full">
                      {d.category}
                    </span>
                    {d.isLive && (
                      <span className="flex items-center gap-1 text-[9px] font-bold text-red-400 uppercase">
                        <span className="w-1 h-1 bg-red-400 rounded-full animate-pulse" /> Live
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-white/90 mb-2.5 line-clamp-1 group-hover:text-white transition-colors">{d.title}</p>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden flex">
                      <div className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 rounded-l-full transition-all" style={{ width: `${d.supportPercent}%` }} />
                      <div className="h-full bg-gradient-to-r from-rose-400 to-rose-600 rounded-r-full transition-all" style={{ width: `${d.againstPercent}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-indigo-400 font-bold">Support {d.supportPercent}%</span>
                    <span className="text-white/30">{d.participantCount.toLocaleString()} participants</span>
                    <span className="text-rose-400 font-bold">Against {d.againstPercent}%</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.4 }}
          className="w-full flex flex-col gap-3"
        >
          <button
            className="w-full py-3.5 rounded-xl font-bold text-white text-sm bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 shadow-[0_0_24px_rgba(79,106,247,0.4)] transition-all active:scale-[0.98]"
            onClick={onGetStarted}
            data-testid="button-get-started"
          >
            Welcome to Treffin
          </button>
          <p className="text-xs text-white/40">
            Already have an account?{" "}
            <button
              className="text-indigo-400 hover:text-indigo-300 font-semibold underline-offset-2 hover:underline transition-colors"
              onClick={() => setLocation("/sign-in")}
            >
              Log in
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

// ── Shared quiz helpers ───────────────────────────────────────────────────────

function StepProgress({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2.5 mb-6">
      <span className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
        Step {current} of {total}
      </span>
      <div className="flex-1 flex gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "flex-1 h-1 rounded-full transition-all duration-400",
              i < current ? "bg-primary" : "bg-muted"
            )}
          />
        ))}
      </div>
    </div>
  );
}

function StepIcon({ icon }: { icon: React.ReactNode }) {
  return (
    <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center text-primary mx-auto mb-4">
      {icon}
    </div>
  );
}

function OptionRow({
  icon: Icon,
  label,
  desc,
  selected,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  desc?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all",
        selected
          ? "border-primary/60 bg-primary/10"
          : "border-border bg-card/40 hover:border-primary/30 hover:bg-primary/5"
      )}
      onClick={onClick}
    >
      <div
        className={cn(
          "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors",
          selected ? "bg-primary text-white" : "bg-muted text-muted-foreground"
        )}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{label}</p>
        {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
      </div>
      {selected && (
        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}
    </button>
  );
}

function QuizNav({
  onBack,
  onNext,
  nextLabel = "Next",
  nextDisabled = false,
  onSkip,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  onSkip?: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 mt-6">
      <div className="flex gap-3">
        {onBack && (
          <button
            className="flex-1 py-3 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors font-medium"
            onClick={onBack}
          >
            Back
          </button>
        )}
        <button
          className={cn(
            "flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2",
            nextDisabled
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:opacity-90 shadow-[0_0_16px_rgba(79,106,247,0.35)] active:scale-[0.98]"
          )}
          onClick={onNext}
          disabled={nextDisabled}
        >
          {nextLabel === "Next" ? (
            <>
              Next <ArrowRight className="w-4 h-4" />
            </>
          ) : (
            nextLabel
          )}
        </button>
      </div>
      {onSkip && (
        <button
          className="text-xs text-muted-foreground hover:text-foreground transition-colors text-center py-1"
          onClick={onSkip}
        >
          Skip for now
        </button>
      )}
    </div>
  );
}

// ── Step 1: Let's get to know you ─────────────────────────────────────────────

function Step1({
  name,
  focus,
  onChangeName,
  onChangeFocus,
  onNext,
  onSkip,
}: {
  name: string;
  focus: string;
  onChangeName: (v: string) => void;
  onChangeFocus: (v: string) => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  return (
    <motion.div
      key="s1"
      initial={{ opacity: 0, x: 32 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -32 }}
      transition={{ duration: 0.22 }}
      className="w-full max-w-md"
    >
      <div className="bg-card border border-border/60 rounded-2xl p-7 shadow-2xl">
        <StepProgress current={1} total={6} />
        <StepIcon icon={<User className="w-6 h-6" />} />
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold">Let's get to know you</h2>
          <p className="text-sm text-muted-foreground mt-1">
            This helps us personalize your experience on Treffin.
          </p>
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-muted-foreground">
              What should we call you?
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => onChangeName(e.target.value)}
                className="w-full bg-muted/40 border border-border rounded-xl pl-10 pr-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all"
                data-testid="input-name"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-muted-foreground">
              What's your focus as of now?
            </label>
            <div className="flex flex-col gap-2">
              {FOCUS_OPTIONS.map((opt) => (
                <OptionRow
                  key={opt.id}
                  icon={opt.icon}
                  label={opt.label}
                  selected={focus === opt.id}
                  onClick={() => onChangeFocus(opt.id)}
                />
              ))}
            </div>
          </div>
        </div>

        <QuizNav onNext={onNext} nextDisabled={!focus} onSkip={onSkip} />
      </div>
    </motion.div>
  );
}

// ── Step 2: Interests ─────────────────────────────────────────────────────────

function Step2({
  interests,
  onToggle,
  onNext,
  onBack,
}: {
  interests: Set<string>;
  onToggle: (id: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <motion.div
      key="s2"
      initial={{ opacity: 0, x: 32 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -32 }}
      transition={{ duration: 0.22 }}
      className="w-full max-w-md"
    >
      <div className="bg-card border border-border/60 rounded-2xl p-7 shadow-2xl">
        <StepProgress current={2} total={6} />
        <StepIcon icon={<Heart className="w-6 h-6" />} />
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold">What are your interests?</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Select a few topics you enjoy.
            <br />
            You can change these later.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {INTERESTS.map(({ id, label, icon: Icon }) => {
            const active = interests.has(id);
            return (
              <button
                key={id}
                onClick={() => onToggle(id)}
                className={cn(
                  "flex flex-col items-center gap-2 p-3 rounded-xl border text-center transition-all",
                  active
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-border bg-card/40 hover:border-primary/30 text-muted-foreground hover:text-foreground"
                )}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {active && (
                    <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-2 h-2 text-white" />
                    </div>
                  )}
                </div>
                <span className="text-[11px] font-semibold leading-tight">{label}</span>
              </button>
            );
          })}
        </div>

        <p className="text-[11px] text-muted-foreground text-center mt-3">
          {interests.size === 0
            ? "Pick at least 2 topics"
            : `${interests.size} selected`}
        </p>

        <QuizNav
          onBack={onBack}
          onNext={onNext}
          nextDisabled={interests.size < 2}
        />
      </div>
    </motion.div>
  );
}

// ── Step 3: Take a side! ──────────────────────────────────────────────────────

function Step3Live({
  onNext,
  onBack,
  onSkip,
}: {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const { data: debates } = useGetDebates();
  const [voted, setVoted] = useState<"support" | "against" | null>(null);

  const debate = useMemo(() => {
    if (!debates || debates.length === 0) return null;
    return [...debates].sort(
      (a, b) =>
        ((b.isLive ? 10000 : 0) + b.participantCount) -
        ((a.isLive ? 10000 : 0) + a.participantCount)
    )[0];
  }, [debates]);

  const base = debate?.supportPercent ?? 50;
  const displaySupport =
    voted === "support" ? Math.min(98, base + 4) :
    voted === "against" ? Math.max(2, base - 3) :
    base;
  const displayAgainst = 100 - displaySupport;

  const handleVote = (side: "support" | "against") => {
    if (voted) return;
    setVoted(side);
    localStorage.setItem("treffin_onboarding_voted", "1");
  };

  return (
    <motion.div
      key="s3live"
      initial={{ opacity: 0, x: 32 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -32 }}
      transition={{ duration: 0.22 }}
      className="w-full max-w-md"
    >
      <div className="bg-card border border-border/60 rounded-2xl p-7 shadow-2xl">
        <StepProgress current={3} total={6} />
        <StepIcon icon={<Zap className="w-6 h-6" />} />
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold">Take a side!</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Join a live debate and see where the community stands.
          </p>
        </div>

        {!debate ? (
          <div className="h-28 flex items-center justify-center text-muted-foreground text-sm animate-pulse">
            Loading debates…
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="bg-muted/30 border border-border/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-widest bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 px-2 py-0.5 rounded-full">
                  {debate.category}
                </span>
                {debate.isLive && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-red-400">
                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" /> Live
                  </span>
                )}
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {(debate.participantCount ?? 0).toLocaleString()} joined
                </span>
              </div>
              <p className="text-sm font-semibold leading-snug mb-4">{debate.title}</p>

              <div className="mb-1">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className={cn("font-bold transition-colors", voted === "support" ? "text-indigo-300" : "text-indigo-400")}>
                    Support {displaySupport}%
                  </span>
                  <span className={cn("font-bold transition-colors", voted === "against" ? "text-rose-300" : "text-rose-400")}>
                    Against {displayAgainst}%
                  </span>
                </div>
                <div className="h-3 rounded-full bg-muted overflow-hidden flex">
                  <motion.div
                    className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 rounded-l-full"
                    animate={{ width: `${displaySupport}%` }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                  />
                  <motion.div
                    className="h-full bg-gradient-to-r from-rose-400 to-rose-600 rounded-r-full"
                    animate={{ width: `${displayAgainst}%` }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleVote("support")}
                disabled={!!voted}
                className={cn(
                  "py-3.5 rounded-xl font-bold text-sm transition-all border",
                  voted === "support"
                    ? "bg-indigo-600 text-white border-indigo-500 shadow-[0_0_24px_rgba(99,102,241,0.5)]"
                    : voted === "against"
                    ? "bg-muted/20 text-muted-foreground/50 border-border/30 cursor-not-allowed"
                    : "bg-indigo-500/10 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/20 hover:border-indigo-500/50 active:scale-[0.97]"
                )}
              >
                👍 I Support
              </button>
              <button
                onClick={() => handleVote("against")}
                disabled={!!voted}
                className={cn(
                  "py-3.5 rounded-xl font-bold text-sm transition-all border",
                  voted === "against"
                    ? "bg-rose-600 text-white border-rose-500 shadow-[0_0_24px_rgba(244,63,94,0.5)]"
                    : voted === "support"
                    ? "bg-muted/20 text-muted-foreground/50 border-border/30 cursor-not-allowed"
                    : "bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20 hover:border-rose-500/50 active:scale-[0.97]"
                )}
              >
                👎 I'm Against
              </button>
            </div>

            <AnimatePresence>
              {voted && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="flex items-center justify-center gap-2.5 bg-yellow-500/10 border border-yellow-500/30 rounded-xl py-3 px-4"
                >
                  <Sparkles className="w-4 h-4 text-yellow-400 shrink-0" />
                  <p className="text-sm">
                    <span className="font-bold text-yellow-300">+10 Rep!</span>
                    <span className="text-muted-foreground ml-1.5">
                      You voted {voted === "support" ? "in support 👍" : "against 👎"}.
                    </span>
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <QuizNav
          onBack={onBack}
          onNext={onNext}
          nextDisabled={!!debate && !voted}
          onSkip={onSkip}
        />
      </div>
    </motion.div>
  );
}

// ── Step 4: Debate style ───────────────────────────────────────────────────────

function Step3({
  debateStyle,
  onChange,
  onNext,
  onBack,
}: {
  debateStyle: string;
  onChange: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <motion.div
      key="s3"
      initial={{ opacity: 0, x: 32 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -32 }}
      transition={{ duration: 0.22 }}
      className="w-full max-w-md"
    >
      <div className="bg-card border border-border/60 rounded-2xl p-7 shadow-2xl">
        <StepProgress current={4} total={6} />
        <StepIcon icon={<Zap className="w-6 h-6" />} />
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold">What kind of debates excite you?</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Choose your preferred debate style.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {DEBATE_STYLES.map((opt) => (
            <OptionRow
              key={opt.id}
              icon={opt.icon}
              label={opt.label}
              desc={opt.desc}
              selected={debateStyle === opt.id}
              onClick={() => onChange(opt.id)}
            />
          ))}
        </div>

        <QuizNav onBack={onBack} onNext={onNext} nextDisabled={!debateStyle} />
      </div>
    </motion.div>
  );
}

// ── Step 4: Goal ──────────────────────────────────────────────────────────────

function Step4({
  goal,
  onChange,
  onNext,
  onBack,
}: {
  goal: string;
  onChange: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <motion.div
      key="s4"
      initial={{ opacity: 0, x: 32 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -32 }}
      transition={{ duration: 0.22 }}
      className="w-full max-w-md"
    >
      <div className="bg-card border border-border/60 rounded-2xl p-7 shadow-2xl">
        <StepProgress current={5} total={6} />
        <StepIcon icon={<Star className="w-6 h-6" />} />
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold">What's your goal on Treffin?</h2>
          <p className="text-sm text-muted-foreground mt-1">
            This helps us personalize your journey.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {GOALS.map((opt) => (
            <OptionRow
              key={opt.id}
              icon={opt.icon}
              label={opt.label}
              desc={opt.desc}
              selected={goal === opt.id}
              onClick={() => onChange(opt.id)}
            />
          ))}
        </div>

        <QuizNav onBack={onBack} onNext={onNext} nextDisabled={!goal} />
      </div>
    </motion.div>
  );
}

// ── Step 5: Preferences ───────────────────────────────────────────────────────

function Step5({
  updateFreq,
  notifications,
  autoJoin,
  onChangeFreq,
  onChangeNotif,
  onChangeAutoJoin,
  onFinish,
  onBack,
}: {
  updateFreq: string;
  notifications: boolean;
  autoJoin: boolean;
  onChangeFreq: (v: string) => void;
  onChangeNotif: (v: boolean) => void;
  onChangeAutoJoin: (v: boolean) => void;
  onFinish: () => void;
  onBack: () => void;
}) {
  const [freqOpen, setFreqOpen] = useState(false);

  return (
    <motion.div
      key="s5"
      initial={{ opacity: 0, x: 32 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -32 }}
      transition={{ duration: 0.22 }}
      className="w-full max-w-md"
    >
      <div className="bg-card border border-border/60 rounded-2xl p-7 shadow-2xl">
        <StepProgress current={6} total={6} />
        <StepIcon icon={<Sparkles className="w-6 h-6" />} />
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold">Almost there!</h2>
          <p className="text-sm text-muted-foreground mt-1">Customize your experience.</p>
        </div>

        <div className="flex flex-col gap-5">
          {/* Update frequency */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-muted-foreground">
              How often do you want updates?
            </label>
            <div className="relative">
              <button
                className="w-full flex items-center justify-between bg-muted/40 border border-border rounded-xl px-4 py-3 text-sm hover:border-primary/40 transition-colors"
                onClick={() => setFreqOpen((p) => !p)}
              >
                <span className="font-medium">{updateFreq}</span>
                <ChevronDown
                  className={cn("w-4 h-4 text-muted-foreground transition-transform", freqOpen && "rotate-180")}
                />
              </button>
              {freqOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-xl z-10 overflow-hidden">
                  {UPDATE_FREQS.map((f) => (
                    <button
                      key={f}
                      className={cn(
                        "w-full px-4 py-2.5 text-sm text-left hover:bg-muted/60 transition-colors flex items-center justify-between",
                        updateFreq === f && "text-primary font-semibold"
                      )}
                      onClick={() => { onChangeFreq(f); setFreqOpen(false); }}
                    >
                      {f}
                      {updateFreq === f && <Check className="w-4 h-4" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Toggles */}
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">Enable notifications?</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Stay updated on debates and communities.
                </p>
              </div>
              <Switch
                checked={notifications}
                onCheckedChange={onChangeNotif}
                className="shrink-0"
              />
            </div>
            <div className="h-px bg-border/50" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">Join trending communities automatically?</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  We'll add you to popular communities based on your interests.
                </p>
              </div>
              <Switch
                checked={autoJoin}
                onCheckedChange={onChangeAutoJoin}
                className="shrink-0"
              />
            </div>
          </div>
        </div>

        <QuizNav
          onBack={onBack}
          onNext={onFinish}
          nextLabel="🚀 Let's Go!"
        />
      </div>
    </motion.div>
  );
}

// ── Trust footer ──────────────────────────────────────────────────────────────

function TrustFooter() {
  return (
    <div className="w-full border-t border-border/30 bg-black/30 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto px-6 py-5 grid grid-cols-2 md:grid-cols-4 gap-6">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold">Safe &amp; Respectful</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              We prioritize respectful conversations.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Lock className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold">Your Privacy Matters</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              We never share your data with third parties.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Users className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold">Built for Thinkers</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              A platform for meaningful conversations.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="text-2xl text-indigo-400 shrink-0 leading-none mt-0.5">"</span>
          <div>
            <p className="text-[11px] text-muted-foreground leading-snug italic">
              The highest form of ignorance is when you reject something you don't know anything about.
            </p>
            <p className="text-[10px] text-muted-foreground/60 mt-1 font-semibold">— Wayne Dyer</p>
          </div>
        </div>
      </div>
      <div className="border-t border-border/30 bg-black/40">
        <div className="max-w-5xl mx-auto px-6 py-3 flex flex-wrap items-center justify-center gap-4 text-[11px] text-muted-foreground">
          <Link href="/about"><span className="hover:text-foreground transition-colors cursor-pointer">About</span></Link>
          <Link href="/terms"><span className="hover:text-foreground transition-colors cursor-pointer">Terms</span></Link>
          <Link href="/privacy"><span className="hover:text-foreground transition-colors cursor-pointer">Privacy</span></Link>
          <a href="mailto:contactreffen@gmail.com" className="hover:text-foreground transition-colors">Contact</a>
          <span className="opacity-50">© {new Date().getFullYear()} Treffin</span>
        </div>
      </div>
    </div>
  );
}

// ── Main Onboarding ───────────────────────────────────────────────────────────

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const [phase, setPhase] = useState<"welcome" | "quiz">("welcome");
  const [step, setStep] = useState(1);

  const [name, setName] = useState("");
  const [focus, setFocus] = useState("");
  const [interests, setInterests] = useState<Set<string>>(new Set());
  const [debateStyle, setDebateStyle] = useState("");
  const [goal, setGoal] = useState("");
  const [updateFreq, setUpdateFreq] = useState("Daily");
  const [notifications, setNotifications] = useState(true);
  const [autoJoin, setAutoJoin] = useState(true);

  const toggleInterest = (id: string) =>
    setInterests((p) => {
      const s = new Set(p);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });

  const finish = async () => {
    localStorage.setItem("treffin_onboarded", "true");
    if (name) localStorage.setItem("treffin_name", name);
    if (focus) localStorage.setItem("treffin_focus", focus);
    localStorage.setItem("treffin_interests", JSON.stringify(Array.from(interests)));
    if (debateStyle) localStorage.setItem("treffin_debate_style", debateStyle);
    if (goal) localStorage.setItem("treffin_goal", goal);
    localStorage.setItem("treffin_update_freq", updateFreq);

    if (name.trim()) {
      try {
        await fetch(`${import.meta.env.BASE_URL}api/users/me`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim() }),
        });
      } catch {}
    }

    setLocation("/");
  };

  const skipToEnd = () => {
    localStorage.setItem("treffin_onboarded", "true");
    setLocation("/");
  };

  if (phase === "welcome") {
    return (
      <div className="dark flex flex-col min-h-screen">
        <WelcomeScreen onGetStarted={() => setPhase("quiz")} />
        <TrustFooter />
      </div>
    );
  }

  return (
    <div className="dark flex flex-col min-h-screen">
      <div
        className="flex-1 flex items-center justify-center px-4 py-10"
        style={{ background: "radial-gradient(ellipse at top, #0b1040 0%, #060b14 60%)" }}
      >
        <AnimatePresence mode="wait">
          {step === 1 && (
            <Step1
              name={name}
              focus={focus}
              onChangeName={setName}
              onChangeFocus={setFocus}
              onNext={() => setStep(2)}
              onSkip={skipToEnd}
            />
          )}
          {step === 2 && (
            <Step2
              interests={interests}
              onToggle={toggleInterest}
              onNext={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <Step3Live
              onNext={() => setStep(4)}
              onBack={() => setStep(2)}
              onSkip={() => setStep(4)}
            />
          )}
          {step === 4 && (
            <Step3
              debateStyle={debateStyle}
              onChange={setDebateStyle}
              onNext={() => setStep(5)}
              onBack={() => setStep(3)}
            />
          )}
          {step === 5 && (
            <Step4
              goal={goal}
              onChange={setGoal}
              onNext={() => setStep(6)}
              onBack={() => setStep(4)}
            />
          )}
          {step === 6 && (
            <Step5
              updateFreq={updateFreq}
              notifications={notifications}
              autoJoin={autoJoin}
              onChangeFreq={setUpdateFreq}
              onChangeNotif={setNotifications}
              onChangeAutoJoin={setAutoJoin}
              onFinish={finish}
              onBack={() => setStep(5)}
            />
          )}
        </AnimatePresence>
      </div>
      <TrustFooter />
    </div>
  );
}
