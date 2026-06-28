import { useLocation } from "wouter";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  Sparkles, Brain, Shield, Users, Star, Zap, Globe, BookOpen,
  MessageSquare, TrendingUp, Lightbulb, Heart, ArrowRight,
  Mail, ChevronRight, Flame, Award, Target, Phone, Sigma
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Reusable fade-in wrapper ───────────────────────────────────────────────

function FadeIn({
  children,
  delay = 0,
  className,
  direction = "up",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  direction?: "up" | "left" | "right" | "none";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const yInit = direction === "up" ? 36 : 0;
  const xInit = direction === "left" ? -36 : direction === "right" ? 36 : 0;
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: yInit, x: xInit }}
      animate={inView ? { opacity: 1, y: 0, x: 0 } : {}}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── Atmospheric background ─────────────────────────────────────────────────

function AtmosphericBg() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(37,99,235,0.12)_0%,transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_80%,rgba(99,102,241,0.10)_0%,transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(79,70,229,0.05)_0%,transparent_70%)]" />

      <motion.div
        className="absolute top-[10%] left-[15%] w-[500px] h-[500px] rounded-full opacity-[0.04]"
        style={{ background: "radial-gradient(circle, #4F6AF7, transparent)" }}
        animate={{ scale: [1, 1.15, 1], x: [0, 20, 0], y: [0, -15, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[15%] right-[10%] w-[400px] h-[400px] rounded-full opacity-[0.05]"
        style={{ background: "radial-gradient(circle, #2563EB, transparent)" }}
        animate={{ scale: [1, 1.2, 1], x: [0, -25, 0], y: [0, 20, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 3 }}
      />

      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `linear-gradient(rgba(99,102,241,0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99,102,241,0.5) 1px, transparent 1px)`,
          backgroundSize: "80px 80px",
        }}
      />

      {[...Array(18)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: (i % 3) + 1.5,
            height: (i % 3) + 1.5,
            left: `${(i * 17 + 5) % 100}%`,
            top: `${(i * 23 + 8) % 100}%`,
            background: i % 3 === 0 ? "#4F6AF7" : i % 3 === 1 ? "#2563EB" : "#818CF8",
            opacity: 0.2 + (i % 4) * 0.08,
          }}
          animate={{
            y: [0, -((i % 4) * 15 + 30), 0],
            opacity: [0.1, 0.5, 0.1],
          }}
          transition={{
            duration: (i % 5) + 6,
            repeat: Infinity,
            ease: "easeInOut",
            delay: (i % 7) * 0.8,
          }}
        />
      ))}
    </div>
  );
}

// ── Floating debate card ───────────────────────────────────────────────────

function FloatingDebateCard({
  question,
  support,
  oppose,
  style,
  delay = 0,
}: {
  question: string;
  support: number;
  oppose: number;
  style: React.CSSProperties;
  delay?: number;
}) {
  return (
    <motion.div
      className="absolute hidden xl:block w-60 rounded-2xl border border-white/10 p-4 backdrop-blur-md"
      style={{
        background: "rgba(10,16,36,0.75)",
        boxShadow: "0 8px 32px rgba(37,99,235,0.15), inset 0 1px 0 rgba(255,255,255,0.05)",
        ...style,
      }}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, delay, ease: "easeOut" }}
    >
      <motion.div
        animate={{ y: [0, -7, 0] }}
        transition={{ duration: 4 + delay, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Live Debate</span>
        </div>
        <p className="text-sm text-white/90 font-semibold leading-snug mb-4">{question}</p>
        <div className="space-y-2">
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-indigo-400 font-semibold">Support</span>
              <span className="text-white/60">{support}%</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: "linear-gradient(90deg,#2563EB,#4F6AF7)" }}
                initial={{ width: 0 }}
                animate={{ width: `${support}%` }}
                transition={{ duration: 1.2, delay: delay + 0.5 }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-rose-400 font-semibold">Oppose</span>
              <span className="text-white/60">{oppose}%</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: "linear-gradient(90deg,#f43f5e,#ec4899)" }}
                initial={{ width: 0 }}
                animate={{ width: `${oppose}%` }}
                transition={{ duration: 1.2, delay: delay + 0.6 }}
              />
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Founder signature with animated underline ─────────────────────────────

function FounderSignature() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <div ref={ref} className="flex items-center justify-center gap-3.5">
      {/* Small sweet avatar */}
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm text-white/90 shrink-0"
        style={{
          background: "linear-gradient(135deg,rgba(37,99,235,0.7) 0%,rgba(79,106,247,0.7) 100%)",
          boxShadow: "0 0 0 1.5px rgba(79,106,247,0.35), 0 0 14px rgba(37,99,235,0.3)",
        }}
      >
        n
      </div>

      {/* Name + role */}
      <div>
        <div className="relative inline-block mb-1">
          <span
            className="text-[15px] font-bold tracking-tight leading-none"
            style={{ color: "rgba(255,255,255,0.92)" }}
          >
            MN Nishan
          </span>
          {/* Animated underline */}
          <motion.span
            className="absolute left-0 -bottom-[3px] h-[1.5px] rounded-full block"
            style={{
              background: "linear-gradient(90deg,#2563EB,#818CF8)",
              originX: 0,
            }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: inView ? 1 : 0 }}
            transition={{ duration: 0.8, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
        <div
          className="text-[11px] font-medium tracking-[0.08em] uppercase block"
          style={{ color: "hsl(231 89% 68%)" }}
        >
          Founder, Treffin
        </div>
      </div>
    </div>
  );
}

// ── Section label ──────────────────────────────────────────────────────────

function SectionLabel({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-[11px] font-bold uppercase tracking-[0.15em] mb-6">
      <Icon className="w-3.5 h-3.5" />
      {label}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────

export default function About() {
  const [, setLocation] = useLocation();

  const features = [
    {
      icon: Brain,
      title: "Intellectual Identity",
      desc: "Build a reputation on the quality of your thinking. Earn badges, climb leaderboards, and let your ideas define you.",
      color: "from-indigo-500 to-blue-500",
      glow: "rgba(99,102,241,0.25)",
    },
    {
      icon: Shield,
      title: "Respectful Debate",
      desc: "Oxford-format structured debates with quality scoring keep conversations civil, evidence-based, and genuinely productive.",
      color: "from-violet-500 to-purple-500",
      glow: "rgba(139,92,246,0.25)",
    },
    {
      icon: BookOpen,
      title: "Knowledge-Based Feed",
      desc: "Your feed surfaces debates and articles ranked by intellectual value, not engagement bait or outrage.",
      color: "from-blue-500 to-cyan-500",
      glow: "rgba(59,130,246,0.25)",
    },
    {
      icon: Users,
      title: "Student Communities",
      desc: "Topic-specific communities where students with shared curiosities gather, discuss, and grow together in depth.",
      color: "from-emerald-500 to-teal-500",
      glow: "rgba(16,185,129,0.25)",
    },
    {
      icon: Award,
      title: "Meaningful Recognition",
      desc: "Reputation points and rank badges reward thoughtful contribution, not follower counts or viral moments.",
      color: "from-amber-500 to-orange-500",
      glow: "rgba(245,158,11,0.25)",
    },
    {
      icon: Globe,
      title: "Global Network",
      desc: "Connect with serious thinkers across disciplines and borders. The first truly academic social platform built for Gen Z.",
      color: "from-rose-500 to-pink-500",
      glow: "rgba(244,63,94,0.25)",
    },
    {
      icon: Sigma,
      title: "Math Hub",
      desc: "Post olympiad-style problems, write elegant proofs, vote on solutions, and build a mathematical reputation — all with KaTeX rendering.",
      color: "from-sky-500 to-indigo-500",
      glow: "rgba(14,165,233,0.25)",
    },
  ];

  const beliefs = [
    { text: "We believe intelligence should be celebrated, not hidden.", icon: Star },
    { text: "We believe respectful disagreement is the engine of growth.", icon: Shield },
    { text: "We believe students deserve a platform where their voices are genuinely heard.", icon: Heart },
    { text: "We believe the best ideas win, regardless of who said them.", icon: Lightbulb },
  ];

  const steps = [
    {
      num: "01",
      icon: Globe,
      title: "Explore",
      desc: "Browse live debates, trending articles, and thriving communities across every topic you care about.",
      color: "from-indigo-500 to-blue-500",
      glow: "rgba(79,106,247,0.35)",
    },
    {
      num: "02",
      icon: MessageSquare,
      title: "Express",
      desc: "Post arguments, write articles, vote on debates, and share your perspective with a community that takes ideas seriously.",
      color: "from-violet-500 to-purple-500",
      glow: "rgba(139,92,246,0.35)",
    },
    {
      num: "03",
      icon: TrendingUp,
      title: "Grow",
      desc: "Earn reputation, unlock rank badges, and build an intellectual identity that reflects the real depth of your thinking.",
      color: "from-blue-500 to-indigo-500",
      glow: "rgba(59,130,246,0.35)",
    },
  ];

  const contacts = [
    {
      type: "email" as const,
      icon: Mail,
      label: "Email Us",
      value: "contact@thetreffin.com",
      href: "mailto:contact@thetreffin.com",
      desc: "Questions, feedback, ideas, or just want to say hello. We read every message.",
      cta: "Send an email",
    },
    {
      type: "whatsapp" as const,
      icon: Phone,
      label: "WhatsApp",
      value: "+91 83102 60793",
      href: "https://wa.me/918310260793",
      desc: "Reach out directly on WhatsApp for advice, feedback, or a quick conversation.",
      cta: "Message on WhatsApp",
    },
  ];

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-x-hidden scrollbar-none">
      <AtmosphericBg />

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="relative z-10 flex items-center justify-between px-6 md:px-12 py-5 border-b border-white/[0.06] backdrop-blur-sm">
        <button onClick={() => setLocation("/home")} className="flex items-center gap-3">
          <img
            src={`${import.meta.env.BASE_URL}treffin-mark.png`}
            alt="Treffin"
            className="h-8 w-auto drop-shadow-[0_0_16px_rgba(99,102,241,0.6)]"
          />
          <span className="font-black text-lg tracking-tight">Treffin</span>
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation("/home")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors px-4 py-2 rounded-lg hover:bg-white/5"
          >
            Back to App
          </button>
          <button
            onClick={() => setLocation("/onboarding")}
            className="text-sm font-bold px-5 py-2.5 rounded-xl text-white transition-all"
            style={{
              background: "linear-gradient(135deg,#2563EB,#4F6AF7)",
              boxShadow: "0 0 24px rgba(37,99,235,0.4)",
            }}
          >
            Join Now
          </button>
        </div>
      </nav>

      {/* ══════════════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 min-h-[92vh] flex flex-col items-center justify-center text-center px-6 pt-16 pb-36">

        <FloatingDebateCard
          question="Is social media more harmful than good for society?"
          support={62} oppose={38}
          style={{ top: "16%", left: "2%" }}
          delay={0.7}
        />
        <FloatingDebateCard
          question="Should AI have legal rights by 2035?"
          support={41} oppose={59}
          style={{ top: "20%", right: "2%" }}
          delay={1.0}
        />
        <FloatingDebateCard
          question="Should university education be free globally?"
          support={74} oppose={26}
          style={{ bottom: "14%", left: "2%" }}
          delay={1.2}
        />

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "backOut" }}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-primary/40 bg-primary/10 text-primary text-sm font-semibold mb-8 backdrop-blur-md"
        >
          <Sparkles className="w-4 h-4" />
          About Us
        </motion.div>

        {/* Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="text-5xl md:text-7xl lg:text-[88px] font-black tracking-tight leading-[1.04] max-w-5xl mx-auto mb-7"
        >
          We built{" "}
          <span className="relative inline-block">
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(135deg,#2563EB 0%,#818CF8 55%,#4F6AF7 100%)" }}
            >
              Treffin
            </span>
            <motion.span
              className="absolute -bottom-1.5 left-0 right-0 h-[3px] rounded-full"
              style={{ background: "linear-gradient(90deg,#2563EB,#818CF8)" }}
              initial={{ scaleX: 0, transformOrigin: "left" }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.9, delay: 0.85 }}
            />
          </span>{" "}
          for thinkers.
        </motion.h1>

        {/* Subheading */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.3 }}
          className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-11 leading-relaxed"
        >
          Treffin is a platform built for students and young thinkers to{" "}
          <span className="text-foreground/90 font-semibold">debate ideas</span>,{" "}
          <span className="text-foreground/90 font-semibold">share perspectives</span>,{" "}
          <span className="text-foreground/90 font-semibold">publish knowledge</span>, and build an
          intellectual identity through conversations that actually matter.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.45 }}
          className="flex flex-col sm:flex-row gap-4 items-center"
        >
          <motion.button
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setLocation("/home")}
            className="group flex items-center gap-3 px-9 py-4 rounded-2xl font-bold text-lg text-white"
            style={{
              background: "linear-gradient(135deg,#2563EB 0%,#4F6AF7 100%)",
              boxShadow: "0 0 36px rgba(37,99,235,0.5), 0 4px 24px rgba(0,0,0,0.3)",
            }}
          >
            <Zap className="w-5 h-5" />
            Explore Treffin
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setLocation("/onboarding")}
            className="group flex items-center gap-3 px-9 py-4 rounded-2xl font-bold text-lg border border-white/20 bg-white/5 hover:bg-white/10 backdrop-blur-md transition-colors"
          >
            <Users className="w-5 h-5 text-primary" />
            Join the Community
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
          </motion.button>
        </motion.div>

        {/* Scroll hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-muted-foreground"
        >
          <span className="text-[10px] uppercase tracking-[0.2em]">Scroll to explore</span>
          <motion.div
            className="w-px h-12 bg-gradient-to-b from-primary/60 to-transparent"
            animate={{ scaleY: [0, 1, 0], transformOrigin: "top" }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          WHY WE BUILT TREFFIN
      ══════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-28">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <FadeIn direction="left">
            <SectionLabel icon={Lightbulb} label="Why We Built This" />
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-6 leading-tight">
              Social media lost its way.{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(135deg,#4F6AF7,#818CF8)" }}
              >
                We're building something better.
              </span>
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed mb-6">
              Modern platforms are engineered to keep you scrolling through outrage, gossip, and noise.
              The smarter you are, the faster you get bored. The more you think, the less you fit in.
            </p>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Treffin is built on a different premise: that students and young thinkers deserve a healthier
              digital culture, one centred around{" "}
              <strong className="text-foreground">intelligence, curiosity, respectful debate, and genuine
              learning.</strong> Not virality. Not dopamine loops. Real intellectual growth.
            </p>
          </FadeIn>

          <FadeIn direction="right" delay={0.15}>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: "🧠", label: "Deep thinking", sub: "Not shallow scrolling" },
                { icon: "🤝", label: "Respectful debate", sub: "Not toxic arguments" },
                { icon: "📚", label: "Real knowledge", sub: "Not viral nonsense" },
                { icon: "🏆", label: "Earned reputation", sub: "Not follower counts" },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  whileHover={{ scale: 1.04, y: -3 }}
                  className="rounded-2xl border border-white/10 p-5 backdrop-blur-sm"
                  style={{
                    background: "rgba(15,23,42,0.65)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
                  }}
                >
                  <div className="text-3xl mb-3">{item.icon}</div>
                  <div className="font-bold text-sm text-foreground mb-1">{item.label}</div>
                  <div className="text-xs text-muted-foreground">{item.sub}</div>
                </motion.div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          OUR MISSION
      ══════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-24 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(37,99,235,0.08)_0%,transparent_70%)]" />
        <div className="relative max-w-5xl mx-auto px-6 text-center">
          <FadeIn>
            <SectionLabel icon={Target} label="Our Mission" />
            <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-8 leading-tight">
              Helping students{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(135deg,#2563EB 0%,#818CF8 100%)" }}
              >
                express, challenge,
              </span>
              <br />
              and grow, together
            </h2>
          </FadeIn>

          <FadeIn delay={0.12}>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed mb-16">
              Treffin exists so that every student, regardless of background, geography, or status,
              has a stage to express ideas freely, challenge perspectives respectfully, and grow
              intellectually through discussions, debates, articles, and communities built for serious minds.
            </p>
          </FadeIn>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: MessageSquare,
                title: "Express Freely",
                desc: "Every idea deserves an audience. Post arguments, write articles, vote on debates. Your voice is the product.",
                grad: "from-indigo-500/20 to-blue-500/20",
                border: "border-indigo-500/30",
              },
              {
                icon: Shield,
                title: "Challenge Respectfully",
                desc: "Disagreement sharpens thinking. Treffin's Oxford-format debates make sure opposing views meet with civility.",
                grad: "from-violet-500/20 to-purple-500/20",
                border: "border-violet-500/30",
              },
              {
                icon: TrendingUp,
                title: "Grow Intellectually",
                desc: "Reputation, rank badges, and quality scores reflect the depth of your contribution, not your follower count.",
                grad: "from-blue-500/20 to-cyan-500/20",
                border: "border-blue-500/30",
              },
            ].map((p, i) => (
              <FadeIn key={i} delay={i * 0.12}>
                <motion.div
                  whileHover={{ scale: 1.03, y: -4 }}
                  className={cn(
                    "rounded-2xl border p-7 text-left backdrop-blur-sm h-full bg-gradient-to-br",
                    p.grad,
                    p.border
                  )}
                >
                  <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center mb-5 border border-white/10">
                    <p.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-bold text-lg text-foreground mb-3">{p.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{p.desc}</p>
                </motion.div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          WHAT MAKES TREFFIN DIFFERENT
      ══════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-28">
        <div className="text-center mb-16">
          <FadeIn>
            <SectionLabel icon={Sparkles} label="What Makes Us Different" />
            <h2 className="text-4xl md:text-5xl font-black tracking-tight">
              Built differently,{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(135deg,#4F6AF7 0%,#818CF8 100%)" }}
              >
                on purpose.
              </span>
            </h2>
          </FadeIn>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <FadeIn key={i} delay={i * 0.09}>
              <motion.div
                whileHover={{ scale: 1.03, y: -5 }}
                className="group relative rounded-2xl border border-white/10 p-7 h-full overflow-hidden cursor-default"
                style={{ background: "rgba(12,18,38,0.85)", backdropFilter: "blur(12px)" }}
              >
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl"
                  style={{ background: `radial-gradient(ellipse at 50% 0%,${f.glow},transparent 70%)` }}
                />
                <div
                  className={cn("relative w-12 h-12 rounded-xl flex items-center justify-center mb-5 bg-gradient-to-br", f.color)}
                  style={{ boxShadow: `0 0 20px ${f.glow}` }}
                >
                  <f.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="relative font-bold text-lg text-foreground mb-3">{f.title}</h3>
                <p className="relative text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
                <div
                  className={cn(
                    "absolute bottom-0 left-6 right-6 h-[2px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r",
                    f.color
                  )}
                />
              </motion.div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          WHAT WE BELIEVE
      ══════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-28">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_60%,rgba(99,102,241,0.07)_0%,transparent_65%)]" />
        <div className="relative max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <FadeIn>
              <SectionLabel icon={Heart} label="What We Believe" />
              <h2 className="text-4xl md:text-5xl font-black tracking-tight">
                Principles that{" "}
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: "linear-gradient(135deg,#2563EB,#818CF8)" }}
                >
                  shape everything
                </span>{" "}
                we build.
              </h2>
            </FadeIn>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {beliefs.map((b, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <motion.div
                  whileHover={{ scale: 1.02, x: 4 }}
                  className="flex items-start gap-5 p-7 rounded-2xl border border-white/10 backdrop-blur-sm"
                  style={{
                    background: "rgba(15,23,42,0.55)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                  }}
                >
                  <div className="shrink-0 w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center mt-0.5">
                    <b.icon className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-lg font-semibold text-foreground/90 leading-snug">{b.text}</p>
                </motion.div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          HOW TREFFIN WORKS
      ══════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-28">
        <div className="text-center mb-20">
          <FadeIn>
            <SectionLabel icon={Zap} label="How It Works" />
            <h2 className="text-4xl md:text-5xl font-black tracking-tight">
              Three steps to{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(135deg,#4F6AF7,#818CF8)" }}
              >
                intellectual impact.
              </span>
            </h2>
          </FadeIn>
        </div>

        <div className="relative">
          {/* Animated connector line */}
          <div className="absolute top-[3.4rem] left-[18%] right-[18%] h-[2px] hidden lg:block overflow-hidden"
            style={{ background: "linear-gradient(90deg,rgba(37,99,235,0.2),rgba(79,106,247,0.2),rgba(129,140,248,0.2))" }}
          >
            <motion.div
              className="h-full"
              style={{ background: "linear-gradient(90deg,#2563EB,#4F6AF7,#818CF8)" }}
              initial={{ scaleX: 0, transformOrigin: "left" }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.4, ease: "easeInOut", delay: 0.3 }}
            />
          </div>

          <div className="grid md:grid-cols-3 gap-10">
            {steps.map((s, i) => (
              <FadeIn key={i} delay={i * 0.18}>
                <div className="flex flex-col items-center text-center">
                  <motion.div
                    whileHover={{ scale: 1.08 }}
                    className={cn(
                      "relative w-28 h-28 rounded-full flex flex-col items-center justify-center mb-8 bg-gradient-to-br",
                      s.color
                    )}
                    style={{ boxShadow: `0 0 48px ${s.glow}` }}
                  >
                    <span className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-1">{s.num}</span>
                    <s.icon className="w-8 h-8 text-white" />
                  </motion.div>
                  <h3 className="text-2xl font-black text-foreground mb-3">{s.title}</h3>
                  <p className="text-muted-foreground leading-relaxed max-w-xs">{s.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          VISION
      ══════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-28 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,rgba(37,99,235,0.10)_0%,transparent_65%)]" />
        <FadeIn className="relative max-w-4xl mx-auto px-6 text-center">
          <SectionLabel icon={Globe} label="Our Vision" />
          <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-8 leading-tight">
            A global platform for the world's{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(135deg,#2563EB 0%,#818CF8 100%)" }}
            >
              next generation of thinkers.
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed mb-16">
            Our long-term goal is for Treffin to become the world's premier intellectual social
            platform, where students from Lagos and London, Mumbai and Montreal, Jakarta and
            Johannesburg exchange ideas across borders and disciplines, united by shared respect
            for evidence, nuance, and good-faith debate.
          </p>

          <div className="grid grid-cols-3 gap-6 max-w-2xl mx-auto">
            {[
              { val: "∞", label: "Ideas to explore" },
              { val: "1", label: "Platform to do it" },
              { val: "You", label: "To start it all" },
            ].map((s, i) => (
              <motion.div
                key={i}
                whileHover={{ scale: 1.06 }}
                className="rounded-2xl border border-white/10 p-6 backdrop-blur-sm"
                style={{ background: "rgba(15,23,42,0.55)" }}
              >
                <div
                  className="text-4xl font-black mb-2 bg-clip-text text-transparent"
                  style={{ backgroundImage: "linear-gradient(135deg,#4F6AF7,#818CF8)" }}
                >
                  {s.val}
                </div>
                <div className="text-sm text-muted-foreground">{s.label}</div>
              </motion.div>
            ))}
          </div>
        </FadeIn>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          FROM THE FOUNDER
      ══════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 py-20">
        <FadeIn>
          {/* Section label centered */}
          <div className="flex justify-center mb-14">
            <SectionLabel icon={Star} label="From the Founder" />
          </div>

          <div className="relative">
            {/* Giant decorative quotation mark */}
            <div
              className="absolute -top-8 -left-4 md:-left-10 select-none pointer-events-none leading-none"
              style={{
                fontSize: "12rem",
                lineHeight: 1,
                fontFamily: "Georgia, serif",
                background: "linear-gradient(135deg,rgba(79,106,247,0.35),rgba(37,99,235,0.1))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              "
            </div>

            {/* Quote */}
            <blockquote className="relative pt-10 mb-12 text-center">
              <p
                className="text-2xl md:text-[1.7rem] font-semibold leading-[1.65] tracking-[-0.01em]"
                style={{ color: "rgba(255,255,255,0.93)", fontStyle: "italic" }}
              >
                We built Treffin because we were tired of scrolling through noise when we
                wanted to think. We wanted a place where writing a thoughtful argument
                meant something. Where disagreeing with someone made both of you smarter.
                Where a young voice could matter just as much as a verified account's hot take.
              </p>
            </blockquote>

            {/* Divider */}
            <div className="flex items-center gap-4 mb-10">
              <div className="flex-1 h-px" style={{ background: "linear-gradient(to right, transparent, rgba(79,106,247,0.4))" }} />
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: "hsl(231 89% 65%)" }} />
              <div className="flex-1 h-px" style={{ background: "linear-gradient(to left, transparent, rgba(79,106,247,0.4))" }} />
            </div>

            {/* Body text */}
            <div className="max-w-2xl mx-auto text-center mb-12 space-y-5">
              <p className="text-lg text-muted-foreground leading-relaxed">
                Treffin is our attempt to build the platform we always wished existed — one where
                intelligence is celebrated, meaningful conversations are the norm, and young voices
                are genuinely heard. Every feature, every design decision, every debate format is shaped
                by one question:{" "}
                <em className="font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>does this make the thinking better?</em>
              </p>
              <p className="text-muted-foreground leading-relaxed">
                We're early. We have a long way to go. But if you're reading this and you care about
                ideas, we'd love for you to be part of building this alongside us.
              </p>
            </div>

            {/* Founder signature block — horizontal */}
            <FounderSignature />
          </div>
        </FadeIn>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          HELP SHAPE TREFFIN
      ══════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-28">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(99,102,241,0.06)_0%,transparent_70%)]" />
        <div className="relative max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <FadeIn>
              <SectionLabel icon={MessageSquare} label="Help Shape Treffin" />
              <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-5">
                Your ideas{" "}
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: "linear-gradient(135deg,#2563EB,#818CF8)" }}
                >
                  build this
                </span>{" "}
                platform.
              </h2>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto">
                Treffin is shaped by its community. If you have feedback, ideas, or just want to say
                hello. We read every message.
              </p>
            </FadeIn>
          </div>

          <div className="grid md:grid-cols-2 gap-5 max-w-2xl mx-auto">
            {contacts.map((c, i) => (
              <FadeIn key={i} delay={i * 0.12}>
                <motion.a
                  href={c.href}
                  target={c.type === "whatsapp" ? "_blank" : undefined}
                  rel={c.type === "whatsapp" ? "noopener noreferrer" : undefined}
                  whileHover={{ scale: 1.03, y: -4 }}
                  className="block group rounded-2xl border border-white/10 p-8 cursor-pointer"
                  style={{
                    background: c.type === "whatsapp"
                      ? "linear-gradient(135deg,rgba(22,163,74,0.08),rgba(12,18,38,0.85))"
                      : "rgba(12,18,38,0.75)",
                    backdropFilter: "blur(12px)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                    borderColor: c.type === "whatsapp"
                      ? "rgba(22,163,74,0.25)"
                      : "rgba(255,255,255,0.1)",
                  }}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-all group-hover:scale-110"
                    style={{
                      background: c.type === "whatsapp"
                        ? "rgba(22,163,74,0.15)"
                        : "rgba(99,102,241,0.15)",
                      border: c.type === "whatsapp"
                        ? "1px solid rgba(22,163,74,0.35)"
                        : "1px solid rgba(99,102,241,0.35)",
                    }}
                  >
                    <c.icon
                      className="w-5 h-5"
                      style={{ color: c.type === "whatsapp" ? "#22c55e" : "hsl(var(--primary))" }}
                    />
                  </div>
                  <div
                    className="text-[10px] font-bold uppercase tracking-widest mb-2"
                    style={{ color: c.type === "whatsapp" ? "#22c55e" : "hsl(var(--primary))" }}
                  >
                    {c.label}
                  </div>
                  <div className="font-bold text-lg text-foreground mb-3 group-hover:text-primary transition-colors">
                    {c.value}
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-6">{c.desc}</p>
                  <div
                    className="inline-flex items-center gap-2 text-xs font-semibold opacity-60 group-hover:opacity-100 transition-opacity"
                    style={{ color: c.type === "whatsapp" ? "#22c55e" : "hsl(var(--primary))" }}
                  >
                    {c.cta} <ArrowRight className="w-3 h-3" />
                  </div>
                </motion.a>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          FINAL CTA
      ══════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-40 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(37,99,235,0.18)_0%,transparent_65%)]" />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle,rgba(79,106,247,0.07),transparent)" }}
          animate={{ scale: [1, 1.18, 1] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <FadeIn>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-[11px] font-bold uppercase tracking-[0.15em] mb-8">
              <Flame className="w-3.5 h-3.5" />
              The future of intelligent social media
            </div>

            <h2 className="text-5xl md:text-7xl font-black tracking-tight mb-7 leading-[1.04]">
              Join the Future of{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(135deg,#2563EB 0%,#818CF8 55%,#4F6AF7 100%)" }}
              >
                Intelligent
              </span>{" "}
              Social Media.
            </h2>

            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed">
              Stop scrolling. Start thinking. Your intellectual home is ready.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
              <motion.button
                whileHover={{ scale: 1.04, y: -3 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setLocation("/onboarding")}
                className="group flex items-center gap-3 px-10 py-5 rounded-2xl font-black text-xl text-white"
                style={{
                  background: "linear-gradient(135deg,#2563EB 0%,#4F6AF7 100%)",
                  boxShadow: "0 0 56px rgba(37,99,235,0.55), 0 8px 32px rgba(0,0,0,0.4)",
                }}
              >
                <Sparkles className="w-6 h-6" />
                Get Started
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.04, y: -3 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setLocation("/home")}
                className="group flex items-center gap-3 px-10 py-5 rounded-2xl font-bold text-lg border border-white/20 bg-white/5 hover:bg-white/10 backdrop-blur-md transition-colors"
              >
                <Globe className="w-5 h-5 text-primary" />
                Explore First
              </motion.button>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/[0.06] py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-5 text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <img
              src={`${import.meta.env.BASE_URL}treffin-mark.png`}
              alt="Treffin"
              className="h-6 w-auto opacity-60"
            />
            <span>© 2026 Treffin. Where minds debate.</span>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={() => setLocation("/about")} className="hover:text-foreground transition-colors">About</button>
            <button onClick={() => setLocation("/home")} className="hover:text-foreground transition-colors">Debates</button>
            <a href="mailto:contact@thetreffin.com" className="hover:text-foreground transition-colors">Contact</a>
            <a href="https://wa.me/918310260793" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">WhatsApp</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
