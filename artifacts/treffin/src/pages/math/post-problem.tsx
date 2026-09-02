import { useEffect, useMemo, useState } from "react";
import {
  getListMathCategoriesQueryKey,
  useCreateMathProblem,
  useListMathCategories,
} from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { MathText } from "@/components/math/math-renderer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getMathUserId } from "@/lib/math-auth";
import { LatexSymbolPicker } from "@/components/math/latex-symbol-picker";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronRight,
  Clock3,
  Eye,
  FileText,
  Lightbulb,
  Plus,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Tag,
  X,
} from "lucide-react";

type ProblemType = "solve" | "prove" | "explain" | "counterexample" | "optimize" | "open";
type ComposerStep = 1 | 2 | 3;

type Draft = {
  title: string;
  body: string;
  categoryId: string;
  difficulty: string;
  problemType: ProblemType;
  estimatedMinutes: string;
  prerequisites: string;
  tags: string[];
  hints: string[];
  isOriginal: boolean;
  sourceUrl: string;
  sourceAttribution: string;
};

const EMPTY_DRAFT: Draft = {
  title: "",
  body: "",
  categoryId: "",
  difficulty: "intermediate",
  problemType: "solve",
  estimatedMinutes: "",
  prerequisites: "",
  tags: [],
  hints: [],
  isOriginal: true,
  sourceUrl: "",
  sourceAttribution: "",
};

const PROBLEM_TYPES: Array<{ value: ProblemType; label: string; description: string; symbol: string }> = [
  { value: "solve", label: "Solve", description: "Find a value, object, or construction", symbol: "=" },
  { value: "prove", label: "Prove", description: "Build a rigorous mathematical argument", symbol: "∴" },
  { value: "explain", label: "Explain", description: "Develop intuition or clarify why", symbol: "∵" },
  { value: "counterexample", label: "Counterexample", description: "Disprove a statement constructively", symbol: "≠" },
  { value: "optimize", label: "Optimize", description: "Find an extremum or best strategy", symbol: "∇" },
  { value: "open", label: "Open inquiry", description: "Invite multiple reasoned approaches", symbol: "∞" },
];

const STEP_LABELS = [
  { number: 1 as const, label: "Define", sub: "Shape the question" },
  { number: 2 as const, label: "Compose", sub: "Write and guide" },
  { number: 3 as const, label: "Review", sub: "Preview and publish" },
];

function draftKey(userId: string | null) {
  return `treffin:math-problem-draft:${userId ?? "anonymous"}`;
}

export default function PostProblem() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createProblem = useCreateMathProblem();
  const userId = getMathUserId();
  const { data: categories } = useListMathCategories({
    query: { queryKey: getListMathCategoriesQueryKey() },
  });

  const [step, setStep] = useState<ComposerStep>(1);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [tagInput, setTagInput] = useState("");
  const [hintInput, setHintInput] = useState("");
  const [mobilePreview, setMobilePreview] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(draftKey(userId));
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<Draft>;
        setDraft({ ...EMPTY_DRAFT, ...parsed });
      }
    } catch {
      window.localStorage.removeItem(draftKey(userId));
    } finally {
      setDraftLoaded(true);
    }
  }, [userId]);

  useEffect(() => {
    if (!draftLoaded) return;
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(draftKey(userId), JSON.stringify(draft));
      setSavedAt(new Date());
    }, 650);
    return () => window.clearTimeout(timer);
  }, [draft, draftLoaded, userId]);

  const setField = <K extends keyof Draft,>(field: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase().replace(/^#/, "");
    if (!tag || draft.tags.includes(tag) || draft.tags.length >= 8) return;
    setField("tags", [...draft.tags, tag]);
    setTagInput("");
  };

  const addHint = () => {
    const hint = hintInput.trim();
    if (!hint || draft.hints.length >= 6) return;
    setField("hints", [...draft.hints, hint]);
    setHintInput("");
  };

  const selectedCategory = categories?.find((category) => category.id.toString() === draft.categoryId);
  const titleValid = draft.title.trim().length >= 8;
  const bodyValid = draft.body.trim().length >= 20;
  const sourceValid = draft.isOriginal || Boolean(draft.sourceAttribution.trim());
  const defineValid = titleValid && Boolean(draft.categoryId);
  const composeValid = bodyValid;
  const canPublish = defineValid && composeValid && sourceValid && !createProblem.isPending;

  const completion = useMemo(() => {
    const checks = [
      titleValid,
      Boolean(draft.categoryId),
      bodyValid,
      Boolean(draft.problemType),
      sourceValid,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [bodyValid, draft.categoryId, draft.problemType, sourceValid, titleValid]);

  const goNext = () => {
    if (step === 1 && !defineValid) {
      toast({
        title: "Finish the essentials",
        description: "Add a descriptive title and choose a mathematics category.",
        variant: "destructive",
      });
      return;
    }
    if (step === 2 && !composeValid) {
      toast({
        title: "Problem statement is too short",
        description: "Give solvers enough information to understand the question.",
        variant: "destructive",
      });
      return;
    }
    setStep((current) => Math.min(3, current + 1) as ComposerStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canPublish) {
      toast({
        title: "Problem is not ready",
        description: sourceValid
          ? "Complete the required title, category, and problem statement."
          : "Add source attribution or confirm that this is your original problem.",
        variant: "destructive",
      });
      return;
    }
    if (!userId) {
      toast({ title: "Sign in required", description: "Please sign in to publish a problem.", variant: "destructive" });
      return;
    }

    createProblem.mutate(
      {
        data: {
          title: draft.title.trim(),
          body: draft.body.trim(),
          categoryId: Number(draft.categoryId),
          difficulty: draft.difficulty as "beginner" | "intermediate" | "advanced" | "olympiad" | "research",
          hints: draft.hints.length ? JSON.stringify(draft.hints) : undefined,
          problemType: draft.problemType,
          tags: draft.tags,
          estimatedMinutes: draft.estimatedMinutes ? Number(draft.estimatedMinutes) : undefined,
          prerequisites: draft.prerequisites.trim() || undefined,
          sourceUrl: !draft.isOriginal ? draft.sourceUrl.trim() || undefined : undefined,
          sourceAttribution: !draft.isOriginal ? draft.sourceAttribution.trim() || undefined : undefined,
          isOriginal: draft.isOriginal,
        },
      },
      {
        onSuccess: (problem) => {
          window.localStorage.removeItem(draftKey(userId));
          toast({
            title: "Problem published",
            description: "Your question is now live in the Mathematics Arena.",
          });
          queryClient.invalidateQueries({ queryKey: ["/api/math/problems"] });
          setLocation(`/math/problem/${problem.id}`);
        },
        onError: (error) => {
          toast({
            title: "Could not publish",
            description: error instanceof Error ? error.message : "Please check your connection and try again.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const renderPreview = () => (
    <div className="math-preview-card min-w-0 rounded-[22px] border border-indigo-500/20 p-4 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-400">Problem canvas</p>
          <p className="mt-1 text-xs text-muted-foreground">A live view of the solver experience.</p>
        </div>
        <Eye className="h-5 w-5 text-indigo-400" aria-hidden="true" />
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-indigo-500/10 px-2 py-1 text-[11px] font-bold text-indigo-400">
          {selectedCategory?.icon ?? "∑"} {selectedCategory?.name ?? "Category"}
        </span>
        <span className="rounded-md border border-border px-2 py-1 text-[11px] capitalize text-muted-foreground">
          {draft.difficulty}
        </span>
        <span className="rounded-md border border-border px-2 py-1 text-[11px] capitalize text-muted-foreground">
          {PROBLEM_TYPES.find((item) => item.value === draft.problemType)?.label}
        </span>
        {draft.estimatedMinutes && (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock3 className="h-3 w-3" /> {draft.estimatedMinutes} min
          </span>
        )}
      </div>
      <h2 className="break-words font-serif text-xl font-bold leading-snug text-foreground sm:text-2xl">
        {draft.title ? <MathText text={draft.title} /> : "Your problem title will appear here"}
      </h2>
      <div className="math-paper mt-5 min-h-40 overflow-x-auto whitespace-pre-wrap break-words rounded-2xl border border-border p-4 font-serif text-sm leading-7 text-foreground sm:p-5">
        {draft.body ? <MathText text={draft.body} /> : <span className="text-muted-foreground">Write the statement to see the rendered mathematics.</span>}
      </div>
      {draft.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {draft.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground">#{tag}</span>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="math-composer-page relative min-h-screen overflow-x-hidden bg-background">
      <style>{`
        .math-composer-page {
          isolation: isolate;
          background:
            radial-gradient(circle at 10% -10%, rgba(99,102,241,.13), transparent 34rem),
            radial-gradient(circle at 100% 24%, rgba(34,211,238,.07), transparent 30rem),
            var(--color-background);
        }
        .math-composer-page::before {
          content: "";
          position: fixed;
          inset: 0;
          z-index: -1;
          pointer-events: none;
          opacity: .14;
          background-image:
            linear-gradient(rgba(99,102,241,.12) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99,102,241,.12) 1px, transparent 1px);
          background-size: 42px 42px;
          mask-image: linear-gradient(to bottom, black, transparent 72%);
        }
        .math-studio-hero {
          background:
            linear-gradient(120deg, color-mix(in srgb, var(--color-card) 93%, #6366f1 7%), color-mix(in srgb, var(--color-card) 97%, #22d3ee 3%));
          box-shadow: 0 24px 80px rgba(15,23,42,.08);
        }
        .math-studio-card {
          background: color-mix(in srgb, var(--color-card) 94%, transparent);
          box-shadow: 0 22px 60px rgba(15,23,42,.08), inset 0 1px rgba(255,255,255,.035);
          backdrop-filter: blur(18px);
        }
        .math-preview-card {
          background:
            linear-gradient(145deg, color-mix(in srgb, var(--color-card) 96%, #6366f1 4%), color-mix(in srgb, var(--color-card) 98%, #22d3ee 2%));
          box-shadow: 0 24px 70px rgba(30,41,59,.12), inset 0 1px rgba(255,255,255,.05);
        }
        .math-paper {
          background:
            linear-gradient(90deg, rgba(99,102,241,.055) 1px, transparent 1px),
            linear-gradient(rgba(99,102,241,.055) 1px, transparent 1px),
            color-mix(in srgb, var(--color-background) 90%, var(--color-card));
          background-size: 22px 22px;
        }
        .math-type-card:hover { transform: translateY(-2px); }
        @media (prefers-reduced-motion: reduce) {
          .math-type-card:hover { transform: none; }
        }
      `}</style>
      <div className="relative px-3 pt-3 sm:px-5 sm:pt-5">
        <div aria-hidden="true" className="pointer-events-none absolute right-[8%] top-5 hidden select-none font-serif text-8xl text-indigo-400/[0.07] lg:block">
          ∫ <span className="text-6xl">∑</span> π
        </div>
        <div className="math-studio-hero mx-auto max-w-7xl rounded-[24px] border border-indigo-500/15 px-4 py-6 sm:rounded-[30px] sm:px-8 sm:py-9">
          <Link href="/math">
            <span className="mb-5 inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Back to Mathematics Arena
            </span>
          </Link>
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-400">
                <Sparkles className="h-3.5 w-3.5" /> Treffin Mathematics · Problem Studio
              </div>
              <h1 className="max-w-3xl font-serif text-3xl font-semibold leading-[1.08] tracking-[-0.03em] text-foreground sm:text-5xl lg:text-[3.4rem]">
                Shape a problem worth <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">solving.</span>
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                Build a precise mathematical challenge, render it beautifully, and invite the community to discover more than one way through it.
              </p>
            </div>
            <div className="flex items-center gap-2 self-start rounded-xl border border-border bg-card/80 px-3 py-2 text-xs text-muted-foreground md:self-auto">
              <Save className="h-4 w-4 text-emerald-500" />
              {savedAt ? `Draft saved at ${savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Draft saves automatically"}
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[200px_minmax(0,1fr)_350px]">
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-2">
            {STEP_LABELS.map((item) => {
              const active = item.number === step;
              const complete = item.number < step;
              return (
                <button
                  key={item.number}
                  type="button"
                  onClick={() => (item.number < step || (item.number === 2 && defineValid) || (item.number === 3 && defineValid && composeValid)) && setStep(item.number)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${active ? "border-indigo-500/40 bg-indigo-500/10" : "border-transparent hover:bg-secondary/70"}`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${active ? "bg-indigo-500 text-white" : complete ? "bg-emerald-500/15 text-emerald-500" : "bg-secondary text-muted-foreground"}`}>
                    {complete ? <Check className="h-4 w-4" /> : item.number}
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-foreground">{item.label}</span>
                    <span className="block text-[11px] text-muted-foreground">{item.sub}</span>
                  </span>
                </button>
              );
            })}
            <div className="mt-5 rounded-xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-semibold text-muted-foreground">Readiness</span>
                <span className="font-bold text-indigo-400">{completion}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all" style={{ width: `${completion}%` }} />
              </div>
            </div>
          </div>
        </aside>

        <section className="min-w-0">
          <div className="mb-5 grid grid-cols-3 gap-2 lg:hidden">
            {STEP_LABELS.map((item) => (
              <button
                key={item.number}
                type="button"
                onClick={() => (item.number < step || (item.number === 2 && defineValid) || (item.number === 3 && defineValid && composeValid)) && setStep(item.number)}
                className={`rounded-lg border px-2 py-2 text-xs font-bold ${step === item.number ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-400" : item.number < step ? "border-emerald-500/20 text-emerald-500" : "border-border text-muted-foreground"}`}
              >
                {item.number < step ? "✓ " : `${item.number}. `}{item.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            {step === 1 && (
              <div className="math-studio-card space-y-6 rounded-[22px] border border-border p-4 sm:rounded-[26px] sm:p-8">
                <SectionHeading icon={BookOpen} title="Define the challenge" description="Give solvers enough context to understand what kind of thinking the problem invites." />
                <Field label="Problem title" required hint="Aim for a clear mathematical question, not a clickbait headline.">
                  <Input value={draft.title} onChange={(event) => setField("title", event.target.value)} maxLength={180} placeholder={'e.g. Prove that $\\sqrt{2}$ is irrational'} className="h-12 bg-background text-base" />
                  <Count current={draft.title.length} max={180} />
                </Field>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Mathematics category" required>
                    <Select value={draft.categoryId} onValueChange={(value) => setField("categoryId", value)}>
                      <SelectTrigger className="h-11 bg-background"><SelectValue placeholder="Choose an area" /></SelectTrigger>
                      <SelectContent>
                        {categories?.map((category) => <SelectItem key={category.id} value={category.id.toString()}>{category.icon} {category.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Difficulty" required>
                    <Select value={draft.difficulty} onValueChange={(value) => setField("difficulty", value)}>
                      <SelectTrigger className="h-11 bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="beginner">Beginner</SelectItem>
                        <SelectItem value="intermediate">Intermediate</SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                        <SelectItem value="olympiad">Olympiad</SelectItem>
                        <SelectItem value="research">Research</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <Field label="What should solvers do?" required>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {PROBLEM_TYPES.map((item) => (
                      <button key={item.value} type="button" onClick={() => setField("problemType", item.value)} className={`math-type-card group rounded-2xl border p-3.5 text-left transition-all ${draft.problemType === item.value ? "border-indigo-500/50 bg-indigo-500/10 ring-1 ring-indigo-500/20" : "border-border bg-background/70 hover:border-indigo-500/30"}`}>
                        <span className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg font-serif text-lg ${draft.problemType === item.value ? "bg-indigo-500 text-white" : "bg-secondary text-indigo-400"}`}>{item.symbol}</span>
                        <span className="block text-sm font-bold text-foreground">{item.label}</span>
                        <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">{item.description}</span>
                      </button>
                    ))}
                  </div>
                </Field>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Estimated solve time" hint="Optional">
                    <div className="relative">
                      <Clock3 className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                      <Input type="number" min={1} max={1440} value={draft.estimatedMinutes} onChange={(event) => setField("estimatedMinutes", event.target.value)} placeholder="e.g. 30 minutes" className="h-11 bg-background pl-9" />
                    </div>
                  </Field>
                  <Field label="Prerequisites" hint="Optional">
                    <Input value={draft.prerequisites} onChange={(event) => setField("prerequisites", event.target.value)} maxLength={500} placeholder="e.g. modular arithmetic, induction" className="h-11 bg-background" />
                  </Field>
                </div>

                <Field label="Topic tags" hint="Up to 8">
                  <div className="flex gap-2">
                    <div className="relative min-w-0 flex-1">
                      <Tag className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                      <Input value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); addTag(); } }} maxLength={32} placeholder="Type a tag and press Enter" className="h-11 bg-background pl-9" />
                    </div>
                    <Button type="button" variant="outline" onClick={addTag} disabled={!tagInput.trim() || draft.tags.length >= 8}><Plus className="h-4 w-4" /> Add</Button>
                  </div>
                  {draft.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{draft.tags.map((tag) => <button key={tag} type="button" onClick={() => setField("tags", draft.tags.filter((item) => item !== tag))} className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-400">#{tag}<X className="h-3 w-3" /></button>)}</div>}
                </Field>
              </div>
            )}

            {step === 2 && (
              <div className="math-studio-card space-y-6 rounded-[22px] border border-border p-4 sm:rounded-[26px] sm:p-8">
                <SectionHeading icon={FileText} title="Compose the problem" description="Write a self-contained statement. Use LaTeX for precise mathematical notation." />
                <div className="flex rounded-xl border border-border bg-background p-1 lg:hidden">
                  <button type="button" onClick={() => setMobilePreview(false)} className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold ${!mobilePreview ? "bg-indigo-500 text-white" : "text-muted-foreground"}`}>Write</button>
                  <button type="button" onClick={() => setMobilePreview(true)} className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold ${mobilePreview ? "bg-indigo-500 text-white" : "text-muted-foreground"}`}>Preview</button>
                </div>
                {!mobilePreview ? (
                  <>
                    <Field label="Problem statement" required hint="LaTeX and Markdown supported">
                      <div className="mb-2 flex justify-end"><LatexSymbolPicker onInsert={(latex) => setField("body", draft.body + (draft.body && !draft.body.endsWith(" ") ? " " : "") + "$" + latex + "$")} /></div>
                      <Textarea value={draft.body} onChange={(event) => setField("body", event.target.value)} maxLength={20000} placeholder={"State the problem clearly. Use $...$ for inline math and $$...$$ for display math.\n\nInclude all assumptions and define uncommon notation."} className="min-h-[310px] resize-y bg-background font-mono text-sm leading-6" />
                      <Count current={draft.body.length} max={20000} />
                    </Field>
                    <Field label="Progressive hints" hint="Optional · maximum 6">
                      {draft.hints.length > 0 && <div className="mb-3 space-y-2">{draft.hints.map((hint, index) => <div key={`${index}-${hint}`} className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3"><span className="mt-0.5 shrink-0 text-xs font-black text-amber-500">H{index + 1}</span><span className="min-w-0 flex-1 break-words text-sm text-foreground"><MathText text={hint} /></span><button type="button" aria-label={`Remove hint ${index + 1}`} onClick={() => setField("hints", draft.hints.filter((_, itemIndex) => itemIndex !== index))} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button></div>)}</div>}
                      <div className="flex gap-2">
                        <Input value={hintInput} onChange={(event) => setHintInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addHint(); } }} maxLength={1000} placeholder="Nudge solvers without giving away the answer" className="h-11 min-w-0 bg-background" />
                        <Button type="button" variant="outline" onClick={addHint} disabled={!hintInput.trim() || draft.hints.length >= 6}><Lightbulb className="h-4 w-4" /><span className="hidden sm:inline">Add hint</span></Button>
                      </div>
                    </Field>
                  </>
                ) : renderPreview()}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div className="math-studio-card rounded-[22px] border border-border p-4 sm:rounded-[26px] sm:p-8">
                  <SectionHeading icon={ShieldCheck} title="Review and publish" description="Confirm the source and inspect the final presentation before it enters the arena." />
                  <div className="mt-6">{renderPreview()}</div>
                </div>
                <div className="math-studio-card space-y-5 rounded-[22px] border border-border p-4 sm:rounded-[26px] sm:p-8">
                  <Field label="Source and originality" required>
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-4">
                      <input type="checkbox" checked={draft.isOriginal} onChange={(event) => setField("isOriginal", event.target.checked)} className="mt-1 h-4 w-4 accent-indigo-500" />
                      <span><span className="block text-sm font-bold text-foreground">This is my original problem</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">If adapted from a book, contest, paper, or another author, turn this off and credit the source below.</span></span>
                    </label>
                  </Field>
                  {!draft.isOriginal && (
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field label="Source attribution" required>
                        <Input value={draft.sourceAttribution} onChange={(event) => setField("sourceAttribution", event.target.value)} maxLength={500} placeholder="Author, book, contest, or publication" className="h-11 bg-background" />
                      </Field>
                      <Field label="Source link" hint="Optional">
                        <Input type="url" value={draft.sourceUrl} onChange={(event) => setField("sourceUrl", event.target.value)} maxLength={1000} placeholder="https://…" className="h-11 bg-background" />
                      </Field>
                    </div>
                  )}
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4 text-xs leading-5 text-muted-foreground">
                    <span className="font-bold text-emerald-500">Community standard:</span> publish a complete, respectful, and answerable question. Treffin may archive spam, copied material without attribution, or unsafe content.
                  </div>
                </div>
              </div>
            )}

            <div className="sticky bottom-[calc(env(safe-area-inset-bottom,0px)+62px)] z-20 mt-5 flex items-center justify-between gap-3 rounded-2xl border border-border bg-background/95 p-3 shadow-2xl backdrop-blur lg:static lg:bg-transparent lg:p-0 lg:shadow-none">
              <Button type="button" variant="outline" onClick={() => step === 1 ? setLocation("/math") : setStep((step - 1) as ComposerStep)}>
                {step === 1 ? "Cancel" : "Back"}
              </Button>
              <div className="flex min-w-0 items-center gap-2">
                <span className="hidden text-xs text-muted-foreground sm:inline">{completion}% ready</span>
                {step < 3 ? (
                  <Button type="button" onClick={goNext} className="min-w-28 bg-indigo-600 text-white hover:bg-indigo-500">Continue <ChevronRight className="h-4 w-4" /></Button>
                ) : (
                  <Button type="submit" disabled={!canPublish} className="min-w-36 bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-500 hover:to-blue-500">
                    {createProblem.isPending ? "Publishing…" : <><Send className="h-4 w-4" /> Publish problem</>}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </section>

        <aside className="hidden xl:block">
          <div className="sticky top-24">{renderPreview()}</div>
        </aside>
      </main>
    </div>
  );
}

function SectionHeading({ icon: Icon, title, description }: { icon: typeof Sparkles; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 border-b border-border pb-5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400"><Icon className="h-5 w-5" /></span>
      <div><h2 className="text-lg font-bold text-foreground sm:text-xl">{title}</h2><p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-sm">{description}</p></div>
    </div>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-semibold text-foreground">{label}{required && <span className="ml-1 text-indigo-400">*</span>}</label>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Count({ current, max }: { current: number; max: number }) {
  return <p className={`text-right text-[10px] ${current > max * 0.9 ? "text-amber-500" : "text-muted-foreground"}`}>{current.toLocaleString()} / {max.toLocaleString()}</p>;
}
