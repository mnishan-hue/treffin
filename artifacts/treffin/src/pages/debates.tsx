import { useState } from "react";
import { SectionInfo } from "@/components/section-info";
import { AppLayout } from "@/components/layout/app-layout";
import { useGetDebates, useCreateDebate, getGetDebatesQueryKey, useGetTopics } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useLocation } from "wouter";
import { Users, Flame, Plus, X, Search, Trophy, Gavel } from "lucide-react";
import { CategoryPill } from "@/components/debate/category-pill";
import { CountdownChip } from "@/components/debate/countdown-chip";
import { formatNumber } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function Debates() {
  const { data: debates, isLoading } = useGetDebates();
  const { data: topicsData } = useGetTopics();
  const categories = ["All", ...(topicsData?.map(t => t.name) ?? [])];
  const createDebate = useCreateDebate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showCreate, setShowCreate] = useState(false);
  const [createStep, setCreateStep] = useState<"details" | "moderation">("details");
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCat, setNewCat] = useState("Artificial Intelligence");
  const [wantsModerator, setWantsModerator] = useState<boolean | null>(null);
  const [winnerAuthority, setWinnerAuthority] = useState<"creator" | "admin">("creator");
  const [wordLimit, setWordLimit] = useState<number>(0); // 0 = no limit
  const [durationHours, setDurationHours] = useState(168);

  const openCreate = () => {
    setNewTitle(""); setNewDesc(""); setNewCat("Artificial Intelligence");
    setWantsModerator(null); setWinnerAuthority("creator"); setWordLimit(0); setDurationHours(168);
    setCreateStep("details");
    setShowCreate(true);
  };

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    const isMod = wantsModerator === true;
    createDebate.mutate(
      { data: {
          title: newTitle.trim(),
          description: newDesc.trim(),
          category: newCat,
          creatorIsModerator: isMod,
          winnerAuthority: isMod ? winnerAuthority : "admin",
          durationHours,
          ...(wordLimit > 0 ? { wordLimit } : {}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any },
      {
        onSuccess: (data) => {
          setShowCreate(false);
          setNewTitle(""); setNewDesc("");
          queryClient.invalidateQueries({ queryKey: getGetDebatesQueryKey() });
          // Navigate directly into the new debate room so the creator
          // can immediately start moderating or posting their first argument.
          const newId = (data as { id?: number })?.id;
          if (newId) {
            setLocation(`/debates/${newId}`);
          } else {
            toast({ title: "Debate created!", description: "Your debate is now live in the arena." });
          }
        },
        onError: () => toast({ title: "Failed to create debate", variant: "destructive" }),
      }
    );
  };

  const filtered = debates
    ?.filter(d => {
      const matchCat = category === "All" || d.category === category;
      const matchSearch = !search || d.title.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    })
    .sort((a, b) => {
      if (a.isTrending && !b.isTrending) return -1;
      if (!a.isTrending && b.isTrending) return 1;
      if (a.isFeatured && !b.isFeatured) return -1;
      if (!a.isFeatured && b.isFeatured) return 1;
      return 0;
    });

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between sticky top-[88px] z-40 bg-background/95 backdrop-blur-sm pb-4 border-b border-border">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-1.5">Debate Arena <SectionInfo title="Debate Arena" icon="⚡" accent="from-rose-500 to-orange-500" description="Browse live debates, pick a side, and argue your case. Every debate has two sides. Read the arguments, vote for the stronger one, and post your own take to earn reputation." /></h1>
          </div>
          <button
            className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white font-semibold px-3 sm:px-4 py-2 rounded-full text-sm shadow-[0_0_15px_rgba(37,99,235,0.3)] transition-all hover:-translate-y-0.5 whitespace-nowrap shrink-0"
            onClick={openCreate}
            data-testid="button-start-debate"
          >
            <Plus className="w-4 h-4" /> <span className="hidden xs:inline">Start </span>Debate
          </button>
        </div>

        {/* Create debate dialog */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
              <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
                <div>
                  <h2 className="font-bold text-lg">Start a New Debate</h2>
                  <div className="flex gap-1.5 mt-1.5">
                    {(["details", "moderation"] as const).map((s, i) => (
                      <div key={s} className={`h-1 rounded-full transition-all ${createStep === s ? "w-6 bg-primary" : i < (createStep === "moderation" ? 1 : 0) ? "w-3 bg-primary/60" : "w-3 bg-muted"}`} />
                    ))}
                  </div>
                </div>
                <button className="p-1.5 rounded-full hover:bg-muted transition-colors" onClick={() => setShowCreate(false)} data-testid="button-close-dialog">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {createStep === "details" ? (
                <>
                  <div className="overflow-y-auto flex-1 px-6 pb-2">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Debate Topic *</label>
                      <input
                        className="bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground"
                        placeholder="E.g. Should universal basic income be implemented?"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        data-testid="input-debate-title"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</label>
                      <textarea
                        className="bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground resize-none"
                        placeholder="Provide context for your debate topic..."
                        rows={3}
                        value={newDesc}
                        onChange={(e) => setNewDesc(e.target.value)}
                        data-testid="input-debate-desc"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Category</label>
                      <select
                        className="bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary appearance-none"
                        value={newCat}
                        onChange={(e) => setNewCat(e.target.value)}
                        data-testid="select-debate-category"
                      >
                        {categories.filter(c => c !== "All").map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    {newCat === "Mathematics" && (
                      <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.25)" }}>
                        <span className="text-base shrink-0">∑</span>
                        <div>
                          <p className="text-xs font-semibold mb-1" style={{ color: "#c4b5fd" }}>Math debates live in the Solution Arena</p>
                          <p className="text-xs text-muted-foreground mb-2">Post a problem, submit your solution, and let the community vote on the most elegant approach.</p>
                          <button onClick={() => { setShowCreate(false); setLocation("/math"); }} className="text-xs font-bold px-3 py-1.5 rounded-lg transition-colors" style={{ background: "rgba(167,139,250,0.2)", color: "#c4b5fd", border: "1px solid rgba(167,139,250,0.4)" }}>Go to Math Arena →</button>
                        </div>
                      </div>
                    )}
                  </div>
                  </div>{/* end scroll */}
                  <div className="flex gap-3 px-6 pb-6 pt-3 shrink-0 border-t border-border/40">
                    <button className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-colors" onClick={() => setShowCreate(false)}>Cancel</button>
                    <button
                      className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                      onClick={() => setCreateStep("moderation")}
                      disabled={!newTitle.trim() || newCat === "Mathematics"}
                    >
                      Next →
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="overflow-y-auto flex-1 px-6 pb-2">
                  <div className="flex flex-col gap-4">
                    <div>
                      <p className="text-sm font-bold text-foreground">How do you want to run this debate?</p>
                      <p className="text-xs text-muted-foreground mt-0.5">This shapes your role, your powers, and who decides the outcome.</p>
                    </div>

                    {/* Format cards */}
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => setWantsModerator(true)}
                        className={`text-left p-4 rounded-2xl border-2 transition-all ${wantsModerator === true ? "border-amber-500/60 bg-amber-400/5" : "border-border hover:border-amber-500/30 bg-card"}`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-base">🛡</span>
                          <p className="text-sm font-bold text-foreground">Oxford-style — I'll moderate</p>
                          {wantsModerator === true && <span className="ml-auto text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">Selected</span>}
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">Inspired by the Oxford Union. You step out of the argument and into the chair — pin the best arguments, remove bad-faith replies, declare a winner. <strong className="text-amber-400/80">Trade-off:</strong> you can't vote or argue in your own debate.</p>
                      </button>

                      <button
                        onClick={() => setWantsModerator(false)}
                        className={`text-left p-4 rounded-2xl border-2 transition-all ${wantsModerator === false ? "border-primary/60 bg-primary/5" : "border-border hover:border-primary/30 bg-card"}`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-base">⚡</span>
                          <p className="text-sm font-bold text-foreground">Open debate — I'll participate</p>
                          {wantsModerator === false && <span className="ml-auto text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">Selected</span>}
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">The classic format. You pick a side, post arguments, and vote like everyone else. A Treffin admin reviews and declares the outcome when it closes.</p>
                      </button>
                    </div>

                    {/* Moderator responsibilities — shown when Oxford chosen */}
                    {wantsModerator === true && (
                      <div className="flex flex-col gap-3 p-4 rounded-2xl bg-amber-400/5 border border-amber-500/20">
                        <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">What you're signing up for as moderator</p>
                        <div className="flex flex-col gap-2.5">
                          {[
                            { icon: "📌", title: "Pin the best arguments", desc: "Surface quality from each side — pin arguments that are well-reasoned and evidenced, not the ones you personally agree with." },
                            { icon: "🗑", title: "Remove fairly", desc: "Remove toxic, off-topic, or personal-attack replies. Never remove an argument because it challenges your view." },
                            { icon: "🔒", title: "Lock hostile threads", desc: "Lock further replies on a specific argument if the thread turns into a fight. Use sparingly." },
                            { icon: "⚖️", title: "Stay neutral", desc: "You're the chair — don't hint at your own position in comments or outside the debate room." },
                            { icon: "🏁", title: "End it when it's done", desc: "Close the debate early if it has run its course or gone badly off track." },
                          ].map(({ icon, title, desc }) => (
                            <div key={title} className="flex gap-2.5">
                              <span className="text-sm shrink-0 mt-0.5">{icon}</span>
                              <div>
                                <p className="text-[11px] font-bold text-foreground">{title}</p>
                                <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{desc}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Winner authority */}
                    {wantsModerator === true && (
                      <div className="flex flex-col gap-2">
                        <div>
                          <p className="text-xs font-bold text-foreground">Who declares the winner?</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">When the debate closes, who makes the final call?</p>
                        </div>
                        <div className="flex gap-2">
                          {[
                            { val: "creator" as const, label: "🎓 I decide", sub: "You study the arguments and declare a winner yourself." },
                            { val: "admin" as const, label: "⚖️ Treffin admin", sub: "Hand the decision to staff — best for sensitive topics." },
                          ].map(({ val, label, sub }) => (
                            <button key={val} onClick={() => setWinnerAuthority(val)} className={`flex-1 p-3.5 rounded-xl border text-left transition-all ${winnerAuthority === val ? "border-amber-500/50 bg-amber-400/5" : "border-border hover:border-amber-500/25"}`}>
                              <p className="text-xs font-bold text-foreground">{label}</p>
                              <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">{sub}</p>
                            </button>
                          ))}
                        </div>
                        {winnerAuthority === "creator" && (
                          <div className="p-3 rounded-xl bg-muted/40 border border-border/60">
                            <p className="text-[11px] font-bold text-foreground mb-1.5">How to judge well</p>
                            {[
                              "Look at argument quality — evidence, logic, how well they handled rebuttals",
                              "Don't let the vote % decide for you — popular isn't always right",
                              "A draw is valid if neither side clearly won",
                              "Write a brief note on why you chose — it builds trust in your call",
                            ].map(tip => (
                              <p key={tip} className="text-[11px] text-muted-foreground flex gap-1.5 mt-1">
                                <span className="text-amber-400 shrink-0">→</span>{tip}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      <div>
                        <p className="text-xs font-bold text-foreground">Debate duration</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">The arena closes automatically at the selected time.</p>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { value: 24, label: "1 day" },
                          { value: 72, label: "3 days" },
                          { value: 168, label: "7 days" },
                          { value: 336, label: "14 days" },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setDurationHours(option.value)}
                            className={cn(
                              "text-xs font-semibold px-3 py-2 rounded-lg border transition-all",
                              durationHours === option.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40",
                            )}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Word limit */}
                    <div className="flex flex-col gap-2">
                      <div>
                        <p className="text-xs font-bold text-foreground">Argument word limit</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Cap how long each top-level argument can be. Replies are always exempt.</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { val: 0, label: "No limit" },
                          { val: 75, label: "75 words" },
                          { val: 150, label: "150 words" },
                          { val: 250, label: "250 words" },
                          { val: 400, label: "400 words" },
                        ].map(({ val, label }) => (
                          <button
                            key={val}
                            onClick={() => setWordLimit(val)}
                            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${wordLimit === val ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>{/* closes flex-col gap-4 */}
                  </div>{/* closes overflow-y-auto scroll */}
                  <div className="flex gap-3 px-6 pb-6 pt-3 shrink-0 border-t border-border/40">
                    <button className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-colors" onClick={() => setCreateStep("details")}>← Back</button>
                    <button
                      className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                      onClick={handleCreate}
                      disabled={wantsModerator === null || createDebate.isPending}
                      data-testid="button-create-debate"
                    >
                      {createDebate.isPending ? "Creating..." : "Launch Debate"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search debates..."
            className="w-full bg-muted/50 border border-border rounded-full pl-10 pr-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-debates"
          />
        </div>

        {/* Category filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mb-1 scrollbar-none">
          {categories.map(c => (
            <button
              key={c}
              className={cn("text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap transition-colors shrink-0", category === c ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground bg-muted")}
              onClick={() => setCategory(c)}
              data-testid={`filter-category-${c}`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Debates list */}
        <div className="flex flex-col gap-3">
          {isLoading ? (
            Array(5).fill(0).map((_, i) => <Skeleton key={i} className="w-full h-[140px] rounded-xl" />)
          ) : !filtered?.length ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-muted-foreground">{search ? `No debates match "${search}"` : "No debates in this category yet."}</p>
              {search
                ? <p className="text-sm text-muted-foreground/70">Try a different keyword, or <button className="text-primary hover:underline" onClick={openCreate}>start this debate yourself</button>.</p>
                : <p className="text-sm text-muted-foreground/70">Be the first — <button className="text-primary hover:underline" onClick={openCreate}>start a debate</button> in this category.</p>
              }
            </div>
          ) : (
            filtered.map(debate => {
              const isElegance = debate.title.startsWith("Elegance Battle:");
              const displayTitle = isElegance
                ? debate.title.replace(/^Elegance Battle:\s*/, "")
                : debate.title;

              if (isElegance) {
                const lines = (debate.description ?? "").split("\n").filter(Boolean);
                const approachA = lines.find(l => l.startsWith("**Approach A"))?.replace(/\*\*/g, "") ?? "Approach A";
                const approachB = lines.find(l => l.startsWith("**Approach B"))?.replace(/\*\*/g, "") ?? "Approach B";

                return (
                  <Link key={debate.id} href={debate.mathProblemId ? `/math/problem/${debate.mathProblemId}/showdown` : `/debates/${debate.id}`}>
                    <div
                      data-testid={`card-debate-${debate.id}`}
                      className="rounded-xl cursor-pointer transition-all group overflow-hidden"
                      style={{
                        background: "linear-gradient(135deg, rgba(139,92,246,0.06) 0%, rgba(99,102,241,0.04) 100%)",
                        border: "1.5px solid rgba(139,92,246,0.35)",
                        boxShadow: "0 0 20px rgba(139,92,246,0.08)",
                      }}
                    >
                      {/* Math elegance header bar */}
                      <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: "rgba(139,92,246,0.2)", background: "rgba(139,92,246,0.08)" }}>
                        <span className="text-base font-black" style={{ color: "#a78bfa" }}>∑</span>
                        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "#a78bfa" }}>Math · Elegance Battle</span>
                        <div className="ml-auto flex items-center gap-1.5">
                          <CountdownChip endsAt={debate.endsAt} />
                          {debate.winnerStatus && debate.winnerStatus !== "undecided" && (
                            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.35)" }}>
                              <Trophy className="w-2.5 h-2.5" /> Decided
                            </span>
                          )}
                          {!debate.winnerStatus && debate.isLive && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-red-400 uppercase tracking-widest">
                              <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" /> Live
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="p-4">
                        <h3 className="font-bold text-base mb-1 leading-snug group-hover:text-purple-300 transition-colors" style={{ color: "var(--color-foreground)" }}>
                          {displayTitle}
                        </h3>
                        <p className="text-xs text-muted-foreground mb-4">Which solution approach is more mathematically elegant?</p>

                        {/* Approach A vs B */}
                        <div className="flex gap-2 mb-4">
                          <div className="flex-1 rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)" }}>
                            <div className="text-[10px] font-black uppercase tracking-wider text-indigo-400 mb-0.5">Approach A</div>
                            <div className="text-foreground/80 font-medium leading-tight line-clamp-1">{approachA.replace("Approach A — ", "")}</div>
                          </div>
                          <div className="flex items-center text-muted-foreground/50 font-black text-sm">⚔</div>
                          <div className="flex-1 rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)" }}>
                            <div className="text-[10px] font-black uppercase tracking-wider text-purple-400 mb-0.5">Approach B</div>
                            <div className="text-foreground/80 font-medium leading-tight line-clamp-1">{approachB.replace("Approach B — ", "")}</div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-indigo-400">A · {debate.supportPercent}%</span>
                            <span className="text-purple-400">B · {debate.againstPercent}%</span>
                          </div>
                          <div className="h-2 w-full rounded-full overflow-hidden flex" style={{ background: "rgba(139,92,246,0.1)" }}>
                            <div className="h-full bg-indigo-500 transition-all" style={{ width: `${debate.supportPercent}%` }} />
                            <div className="h-full bg-purple-500 transition-all" style={{ width: `${debate.againstPercent}%` }} />
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Users className="w-3.5 h-3.5" /> {formatNumber(debate.participantCount)} voted
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              }

              // Accent colour based on debate state
              const accentBorderCls = (debate.winnerStatus && debate.winnerStatus !== "undecided")
                ? "border-l-yellow-400/60"
                : debate.isLive
                ? "border-l-indigo-500/60"
                : "border-l-border";

              return (
                <Link key={debate.id} href={`/debates/${debate.id}`}>
                  <div
                    data-testid={`card-debate-${debate.id}`}
                    className={cn(
                      "bg-card border border-l-[3px] rounded-xl p-5 hover:border-primary/50 hover:shadow-[0_0_15px_rgba(37,99,235,0.05)] cursor-pointer transition-all group",
                      accentBorderCls
                    )}
                  >
                    <div className="flex justify-between items-start mb-3 gap-2 flex-wrap">
                      <CategoryPill category={debate.category} />
                      <div className="flex items-center gap-1.5 ml-auto">
                        <CountdownChip endsAt={debate.endsAt} />
                        {debate.winnerStatus && debate.winnerStatus !== "undecided" && (
                          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-400/10 text-yellow-400 border border-yellow-400/30">
                            <Gavel className="w-2.5 h-2.5" /> Decided
                          </span>
                        )}
                        {!debate.winnerStatus && debate.isLive && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" /> Live
                          </span>
                        )}
                      </div>
                    </div>
                    <h3 className="font-semibold text-base leading-snug group-hover:text-primary transition-colors">{displayTitle}</h3>
                    {debate.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{debate.description}</p>
                    )}
                    <div className="flex flex-col gap-2 mt-4">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-indigo-400">Support {debate.supportPercent}%</span>
                        <span className="text-rose-400">Against {debate.againstPercent}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden flex">
                        <div className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all duration-500" style={{ width: `${debate.supportPercent}%` }} />
                        <div className="h-full bg-gradient-to-r from-rose-400 to-rose-600 transition-all duration-500" style={{ width: `${debate.againstPercent}%` }} />
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users className="w-3.5 h-3.5" /> {formatNumber(debate.participantCount)} participants
                        {debate.isLive && <Flame className="w-3.5 h-3.5 text-indigo-400/70 ml-auto" />}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </AppLayout>
  );
}
