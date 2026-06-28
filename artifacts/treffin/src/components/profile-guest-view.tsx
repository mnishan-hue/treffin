import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { Shield, Trophy, Zap, BookOpen, MessageSquare, Award } from "lucide-react";

const PERKS = [
  {
    icon: <Trophy className="w-5 h-5 text-yellow-400" />,
    bg: "bg-yellow-400/10 border-yellow-400/20",
    title: "Build your reputation",
    desc: "Earn rep points for every great argument, article, and debate win. Climb from Novice to Elite Thinker.",
  },
  {
    icon: <Zap className="w-5 h-5 text-indigo-400" />,
    bg: "bg-indigo-400/10 border-indigo-400/20",
    title: "Join live debates",
    desc: "Pick a side, post arguments, and get voted on by the community. Your best takes are highlighted.",
  },
  {
    icon: <BookOpen className="w-5 h-5 text-blue-400" />,
    bg: "bg-blue-400/10 border-blue-400/20",
    title: "Publish long-form articles",
    desc: "Share your ideas with an audience that actually reads. Get cited, liked, and featured.",
  },
  {
    icon: <MessageSquare className="w-5 h-5 text-emerald-400" />,
    bg: "bg-emerald-400/10 border-emerald-400/20",
    title: "Join intellectual communities",
    desc: "Find your people — philosophers, scientists, economists — and discuss ideas that matter.",
  },
  {
    icon: <Award className="w-5 h-5 text-orange-400" />,
    bg: "bg-orange-400/10 border-orange-400/20",
    title: "Earn rank badges",
    desc: "Unlock Thinker, Scholar, Intellectual, and Elite Thinker badges as your impact grows.",
  },
  {
    icon: <Shield className="w-5 h-5 text-violet-400" />,
    bg: "bg-violet-400/10 border-violet-400/20",
    title: "Your verified identity",
    desc: "A public profile that showcases your best work, debate record, and intellectual portfolio.",
  },
];

const LEVEL_PREVIEW = [
  { name: "Novice", color: "bg-slate-500" },
  { name: "Thinker", color: "bg-blue-500" },
  { name: "Scholar", color: "bg-indigo-500" },
  { name: "Intellectual", color: "bg-orange-500" },
  { name: "Elite Thinker", color: "bg-yellow-500" },
];

export function ProfileGuestView() {
  const [, setLocation] = useLocation();

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        <div className="relative rounded-2xl overflow-hidden border border-border bg-card mb-6">
          <div
            className="absolute inset-0 opacity-30"
            style={{ background: "radial-gradient(ellipse at 60% 0%, #3b5bdb33 0%, transparent 70%)" }}
          />

          <div className="relative px-6 pt-8 pb-6 flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500/30 to-blue-600/30 border-2 border-indigo-500/40 flex items-center justify-center mb-4 shadow-[0_0_32px_rgba(99,102,241,0.25)]">
              <Shield className="w-9 h-9 text-indigo-400" />
            </div>

            <h1 className="text-2xl font-bold text-foreground mb-2">
              Your profile awaits
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-md">
              Treffin is where serious thinkers build a reputation that speaks for itself. Sign up to create your profile, track your progress, and let your ideas earn their place.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mt-6 w-full sm:w-auto">
              <button
                onClick={() => setLocation("/sign-up")}
                className="px-8 py-3 rounded-xl text-sm font-semibold text-white transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-600/40 hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: "linear-gradient(135deg, #2563EB 0%, #4F6AF7 100%)" }}
              >
                Create your profile
              </button>
              <button
                onClick={() => setLocation("/sign-in")}
                className="px-8 py-3 rounded-xl text-sm font-medium text-foreground bg-secondary border border-border hover:bg-accent transition-colors"
              >
                Sign in
              </button>
            </div>
          </div>

          <div className="relative px-6 pb-6">
            <div className="flex items-center justify-between gap-1 mb-1">
              {LEVEL_PREVIEW.map((l) => (
                <div key={l.name} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className={`h-1.5 w-full rounded-full ${l.color} opacity-40`} />
                  <span className="text-[10px] text-muted-foreground hidden sm:block">{l.name}</span>
                </div>
              ))}
            </div>
            <p className="text-center text-[11px] text-muted-foreground mt-1 sm:hidden">Novice → Thinker → Scholar → Intellectual → Elite Thinker</p>
          </div>
        </div>

        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 px-1">
          What you unlock
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PERKS.map((perk) => (
            <div
              key={perk.title}
              className="flex items-start gap-3 p-4 rounded-xl bg-card border border-border hover:border-border/80 transition-colors"
            >
              <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${perk.bg}`}>
                {perk.icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground mb-0.5">{perk.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{perk.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Already have an account?{" "}
          <button
            onClick={() => setLocation("/sign-in")}
            className="text-primary hover:text-primary/80 font-medium underline-offset-2 hover:underline transition-colors"
          >
            Sign in here
          </button>
        </p>
      </div>
    </AppLayout>
  );
}
