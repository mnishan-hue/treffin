import { useState, useEffect, useRef, useCallback } from "react";
import { useCreateArticle, useGetTopics } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAppContext } from "@/context/app-context";
import { cn } from "@/lib/utils";
import { MathText } from "@/components/math/math-renderer";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowLeft,
  Bold,
  Italic,
  Heading2,
  Quote,
  Code2,
  Link2,
  Image as ImageIcon,
  Eye,
  FileText,
  CheckCircle,
  AlertCircle,
  X,
  Plus,
  Save,
  Sparkles,
  Focus,
  Minimize2,
  Zap,
} from "lucide-react";

const MIN_WORDS = 500;
const DRAFT_KEY = "treffin:article-draft-v2";
const AUTOSAVE_INTERVAL = 30_000;
const GHOST_IDLE_MS = 90_000; // 90s before momentum bar pulses

const GHOST_PROMPTS = [
  "What happens next?",
  "Back that up with an example…",
  "What's the counterargument?",
  "Why does this matter to the reader?",
  "Say more about that…",
  "Give it a concrete detail…",
  "What would a skeptic say here?",
  "Push further — what's the implication?",
];

const MILESTONES: { at: number; title: string; desc: string }[] = [
  { at: 100,  title: "You've got an opening",   desc: "Keep the momentum going." },
  { at: 250,  title: "Halfway there 🔥",         desc: "You're finding your voice." },
  { at: MIN_WORDS, title: "Ready to publish 🎉", desc: "Your article can go live now." },
];

/* ── Draft persistence ─────────────────────────────────────────── */
type ArticleDraft = {
  title: string; body: string; selectedTags: string[];
  peerReview: boolean; imageUrl: string; savedAt: number;
};

function loadDraft(): ArticleDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ArticleDraft;
    if (typeof parsed.title !== "string" || typeof parsed.body !== "string") return null;
    return parsed;
  } catch { return null; }
}
function saveDraft(d: Omit<ArticleDraft, "savedAt">) {
  try {
    if (!d.title.trim() && !d.body.trim()) { localStorage.removeItem(DRAFT_KEY); return; }
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...d, savedAt: Date.now() }));
  } catch { /* best-effort */ }
}
function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ } }
function wordCount(t: string) { return t.trim().split(/\s+/).filter(Boolean).length; }
function fmtDuration(secs: number) {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

/**
 * Returns the pixel top offset of the caret inside the textarea,
 * already adjusted for the current scrollTop. Works correctly with
 * soft-wrapped lines by using a mirror-div measurement.
 */
function getCaretTop(ta: HTMLTextAreaElement): number {
  const cs = getComputedStyle(ta);
  const mirror = document.createElement("div");
  for (const p of [
    "fontFamily","fontSize","fontWeight","lineHeight","letterSpacing",
    "paddingTop","paddingRight","paddingBottom","paddingLeft",
    "borderTopWidth","borderRightWidth","borderBottomWidth","borderLeftWidth",
    "boxSizing","whiteSpace","wordBreak","overflowWrap","tabSize",
  ] as const) {
    (mirror.style as unknown as Record<string, string>)[p] = (cs as unknown as Record<string, string>)[p];
  }
  mirror.style.position  = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.top       = "0";
  mirror.style.left      = "-9999px";
  mirror.style.width     = ta.clientWidth + "px";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordBreak  = "break-word";
  mirror.style.overflow   = "hidden";
  mirror.style.height     = "auto";

  mirror.appendChild(document.createTextNode(ta.value.slice(0, ta.selectionStart)));
  const marker = document.createElement("span");
  marker.textContent = "\u200b";
  mirror.appendChild(marker);

  document.body.appendChild(mirror);
  const top = marker.offsetTop;
  document.body.removeChild(mirror);
  return top - ta.scrollTop;
}

/* ── Formatting toolbar ────────────────────────────────────────── */
function applyFormat(
  textarea: HTMLTextAreaElement,
  type: "bold" | "italic" | "h2" | "quote" | "code" | "link",
  setter: (v: string) => void,
) {
  const { selectionStart: s, selectionEnd: e, value } = textarea;
  const sel = value.slice(s, e);
  let before = value.slice(0, s);
  let after = value.slice(e);
  let insert = sel;
  let cursorOffset = 0;

  switch (type) {
    case "bold":   insert = sel ? `**${sel}**` : "**bold text**"; cursorOffset = sel ? insert.length : 2; break;
    case "italic": insert = sel ? `*${sel}*` : "*italic text*"; cursorOffset = sel ? insert.length : 1; break;
    case "h2": {
      const lineStart = before.lastIndexOf("\n") + 1;
      const lineContent = value.slice(lineStart, e);
      before = before.slice(0, lineStart);
      insert = lineContent.startsWith("## ") ? lineContent.slice(3) : "## " + lineContent;
      cursorOffset = insert.length; break;
    }
    case "quote": {
      const lineStart = before.lastIndexOf("\n") + 1;
      before = before.slice(0, lineStart);
      const lineContent = value.slice(lineStart, e);
      insert = lineContent.startsWith("> ") ? lineContent.slice(2) : "> " + lineContent;
      cursorOffset = insert.length; break;
    }
    case "code":  insert = sel ? `\`${sel}\`` : "`code`"; cursorOffset = sel ? insert.length : 1; break;
    case "link":  insert = sel ? `[${sel}](url)` : "[link text](url)"; cursorOffset = sel ? insert.length - 5 : 12; break;
  }

  const newVal = before + insert + after;
  setter(newVal);
  requestAnimationFrame(() => {
    textarea.focus();
    const pos = before.length + cursorOffset;
    textarea.setSelectionRange(pos, pos);
  });
}

function FormattingToolbar({
  textareaRef,
  onFormat,
  focusMode,
  hasSelection,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onFormat: (type: "bold" | "italic" | "h2" | "quote" | "code" | "link") => void;
  focusMode: boolean;
  hasSelection: boolean;
}) {
  const tools = [
    { id: "bold" as const,   icon: Bold,     label: "Bold (Ctrl+B)" },
    { id: "italic" as const, icon: Italic,   label: "Italic (Ctrl+I)" },
    { id: "h2" as const,     icon: Heading2, label: "Heading" },
    { id: "quote" as const,  icon: Quote,    label: "Blockquote" },
    { id: "code" as const,   icon: Code2,    label: "Inline code" },
    { id: "link" as const,   icon: Link2,    label: "Link" },
  ];
  const visible = !focusMode || hasSelection;
  return (
    <div className="mb-6 transition-all duration-300" style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? "auto" : "none" }}>
      <div className="flex items-center gap-0.5 px-2 py-1.5 bg-card border border-border rounded-full w-fit shadow-sm">
        {tools.map((t, i) => (
          <>
            {i === 2 && <div key="sep1" className="w-px h-4 bg-border mx-1" />}
            {i === 4 && <div key="sep2" className="w-px h-4 bg-border mx-1" />}
            <button
              key={t.id}
              title={t.label}
              onMouseDown={(e) => { e.preventDefault(); onFormat(t.id); }}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <t.icon className="w-4 h-4" />
            </button>
          </>
        ))}
      </div>
    </div>
  );
}

/* ── Cover image zone ───────────────────────────────────────────── */
function CoverZone({ imageUrl, imageError, onSet, onError, onClear }: {
  imageUrl: string; imageError: boolean;
  onSet: (url: string) => void; onError: () => void; onClear: () => void;
}) {
  const [inputVisible, setInputVisible] = useState(false);
  const [inputVal, setInputVal] = useState(imageUrl);

  if (imageUrl.trim() && !imageError) {
    return (
      <div className="relative w-full h-56 rounded-2xl overflow-hidden border border-border group mb-6">
        <img src={imageUrl} alt="Cover" className="w-full h-full object-cover" onError={onError} />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
          <button onClick={() => { setInputVal(imageUrl); setInputVisible(true); }} className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg text-white text-sm font-medium hover:bg-white/30 transition">
            <ImageIcon className="w-4 h-4 inline mr-1.5" />Change
          </button>
          <button onClick={onClear} className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg text-white text-sm font-medium hover:bg-white/30 transition">
            <X className="w-4 h-4 inline mr-1" />Remove
          </button>
        </div>
      </div>
    );
  }
  if (inputVisible) {
    return (
      <div className="mb-6 flex gap-2">
        <input autoFocus value={inputVal} onChange={(e) => setInputVal(e.target.value)}
          placeholder="Paste image URL…"
          className="flex-1 bg-secondary/30 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
          onKeyDown={(e) => {
            if (e.key === "Enter") { onSet(inputVal); setInputVisible(false); }
            if (e.key === "Escape") setInputVisible(false);
          }} />
        <button onClick={() => { onSet(inputVal); setInputVisible(false); }} className="px-4 py-2 bg-primary text-white text-sm rounded-lg font-medium hover:bg-primary/90 transition">Set</button>
        <button onClick={() => setInputVisible(false)} className="px-3 py-2 text-muted-foreground hover:text-foreground transition"><X className="w-4 h-4" /></button>
      </div>
    );
  }
  return (
    <button onClick={() => setInputVisible(true)}
      className="w-full h-36 rounded-2xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/3 transition-all flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground mb-6 group">
      <div className="w-10 h-10 rounded-xl bg-secondary/60 group-hover:bg-primary/10 transition-colors flex items-center justify-center">
        <ImageIcon className="w-5 h-5" />
      </div>
      <span className="text-sm font-medium">Add cover image</span>
      <span className="text-xs opacity-60">Paste a URL to add a hero image</span>
    </button>
  );
}

/* ── Word meter ─────────────────────────────────────────────────── */
function WordMeter({ count }: { count: number }) {
  const pct = Math.min(100, (count / MIN_WORDS) * 100);
  const cfg =
    count < 200   ? { bar: "bg-red-500",     text: "text-red-400",     label: "Too short" }
    : count < 400 ? { bar: "bg-yellow-500",  text: "text-yellow-400",  label: "Getting there…" }
    : count < MIN_WORDS ? { bar: "bg-orange-500", text: "text-orange-400", label: `${MIN_WORDS - count} more words` }
    : { bar: "bg-emerald-500", text: "text-emerald-400", label: "Ready to publish!" };

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className={cn("font-semibold", cfg.text)}>{cfg.label}</span>
        <span className="text-muted-foreground">{count} / {MIN_WORDS}</span>
      </div>
      <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-500", cfg.bar)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ── Session momentum bar ───────────────────────────────────────── */
function MomentumBar({ elapsed, sessionWords, isPulsing }: { elapsed: number; sessionWords: number; isPulsing: boolean }) {
  if (elapsed === 0) return null;
  return (
    <div className={cn(
      "flex items-center gap-2 text-xs text-muted-foreground transition-all duration-300",
      isPulsing && "animate-pulse"
    )}>
      <Zap className={cn("w-3 h-3 shrink-0", isPulsing ? "text-orange-400" : "text-primary/70")} />
      <span>
        {isPulsing
          ? "Still there? Come back and finish your thought…"
          : <>Writing for <span className="font-semibold text-foreground/70">{fmtDuration(elapsed)}</span> · <span className="font-semibold text-foreground/70">+{sessionWords}</span> words this session</>
        }
      </span>
    </div>
  );
}

/* ── Article preview ─────────────────────────────────────────────── */
function ArticlePreview({ title, body, imageUrl, selectedTags, peerReview, readTime, wc, imageError }: {
  title: string; body: string; imageUrl: string; selectedTags: string[];
  peerReview: boolean; readTime: number; wc: number; imageError: boolean;
}) {
  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {selectedTags.map((t) => (
            <span key={t} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">{t}</span>
          ))}
          {peerReview && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Peer Review
            </span>
          )}
        </div>
      )}
      <h1 className="text-3xl sm:text-4xl font-bold leading-tight mb-3">{title || "Untitled"}</h1>
      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-6 pb-4 border-b border-border">
        <span>You · Just now</span>
        <span>·</span><span>~{readTime} min read</span>
        <span>·</span><span>{wc} words</span>
      </div>
      {imageUrl && !imageError && (
        <div className="w-full h-64 rounded-2xl overflow-hidden border border-border mb-8">
          <img src={imageUrl} alt="Cover" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="prose prose-invert prose-p:leading-relaxed max-w-none text-foreground/90 text-base font-serif whitespace-pre-wrap">
        <MathText text={body || "*Nothing written yet.*"} />
      </div>
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────────── */
export default function ArticleEditor() {
  const { toast } = useToast();
  const { triggerRep } = useAppContext();
  const [, setLocation] = useLocation();
  const createArticle = useCreateArticle();
  const { data: topicsData } = useGetTopics();
  const topics = topicsData?.map((t) => t.name) ?? ["Philosophy", "Economics", "Technology", "Science", "Politics", "Psychology", "Culture", "Mathematics", "History", "Literature"];

  const initial = loadDraft();
  const [title, setTitle]             = useState(initial?.title ?? "");
  const [body, setBody]               = useState(initial?.body ?? "");
  const [selectedTags, setSelectedTags] = useState<string[]>(initial?.selectedTags ?? []);
  const [peerReview, setPeerReview]   = useState(initial?.peerReview ?? false);
  const [imageUrl, setImageUrl]       = useState(initial?.imageUrl ?? "");
  const [imageError, setImageError]   = useState(false);
  const [mode, setMode]               = useState<"write" | "preview">("write");
  const [savedAt, setSavedAt]         = useState<Date | null>(initial ? new Date(initial.savedAt) : null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [restoredDraft]               = useState(!!initial);

  // ── Plan 1 state ──────────────────────────────────────────────
  const [focusMode, setFocusMode]     = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [ghostPrompt, setGhostPrompt] = useState<string | null>(null);
  const [ghostTop, setGhostTop]       = useState(0);
  const [sessionElapsed, setSessionElapsed] = useState(0); // seconds
  const [sessionWords, setSessionWords] = useState(0);
  const [isPulsing, setIsPulsing]     = useState(false);

  const textareaRef      = useRef<HTMLTextAreaElement>(null);
  const bodyWrapRef      = useRef<HTMLDivElement>(null);
  const sessionStartRef  = useRef<number | null>(null);
  const sessionBaseWcRef = useRef<number>(0);
  const lastKeystrokeRef = useRef<number>(0);
  const milestonesHit    = useRef(new Set<number>());
  const ghostIdxRef      = useRef(0);
  const wasOnBlankRef    = useRef(false); // tracks previous blank-line state for cycling
  const handleFormatRef  = useRef<(t: "bold"|"italic"|"h2"|"quote"|"code"|"link") => void>(() => {});

  const wc       = wordCount(body);
  const readTime = Math.max(1, Math.ceil(wc / 200));
  const canPublish = title.trim().length > 0 && wc >= MIN_WORDS;

  // ── Typewriter scroll (focus mode) ────────────────────────────
  const applyTypewriterScroll = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    // Use mirror-div measurement so wrapped lines are accounted for
    const caretTop = getCaretTop(ta); // already relative to current scrollTop
    const lh = parseFloat(getComputedStyle(ta).lineHeight) || 29;
    const target = ta.scrollTop + caretTop - ta.clientHeight / 2 + lh / 2;
    ta.scrollTop = Math.max(0, target);
  }, []);

  // ── Ghost prompt positioning ───────────────────────────────────
  const updateGhostPrompt = useCallback(() => {
    const ta = textareaRef.current;
    const wrap = bodyWrapRef.current;
    if (!ta || !wrap) { setGhostPrompt(null); return; }

    const cursor = ta.selectionStart;
    const text = ta.value;

    // Current line boundaries
    const lineStart = text.lastIndexOf("\n", cursor - 1) + 1;
    const lineEnd   = text.indexOf("\n", cursor);
    const currentLine = text.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);

    // Previous line
    const prevLineEnd   = lineStart > 0 ? lineStart - 1 : 0;
    const prevLineStart = text.lastIndexOf("\n", prevLineEnd - 1) + 1;
    const prevLine      = lineStart > 0 ? text.slice(prevLineStart, prevLineEnd) : "";

    const isBlankAfterContent = currentLine.trim() === "" && prevLine.trim() !== "";

    if (!isBlankAfterContent) {
      wasOnBlankRef.current = false;
      setGhostPrompt(null);
      return;
    }

    // Only advance the prompt index when we *newly* land on a blank line,
    // not on every scroll / cursor event while already on one.
    if (!wasOnBlankRef.current) {
      ghostIdxRef.current = (ghostIdxRef.current + 1) % GHOST_PROMPTS.length;
      wasOnBlankRef.current = true;
    }
    setGhostPrompt(GHOST_PROMPTS[ghostIdxRef.current]);

    // Use mirror-div measurement for accurate position (handles wrapped lines)
    setGhostTop(getCaretTop(ta) + 4);
  }, []);

  // ── Session & momentum ticker ──────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      if (sessionStartRef.current === null) return;
      const elapsed = Math.floor((Date.now() - sessionStartRef.current) / 1000);
      setSessionElapsed(elapsed);
      setSessionWords(wc - sessionBaseWcRef.current);

      const idle = Date.now() - lastKeystrokeRef.current;
      setIsPulsing(idle >= GHOST_IDLE_MS);
    }, 1000);
    return () => clearInterval(id);
  }, [wc]);

  // ── Milestone toasts ───────────────────────────────────────────
  useEffect(() => {
    for (const m of MILESTONES) {
      if (wc >= m.at && !milestonesHit.current.has(m.at)) {
        milestonesHit.current.add(m.at);
        toast({ title: m.title, description: m.desc });
      }
    }
  }, [wc, toast]);

  // ── Auto-save ─────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      saveDraft({ title, body, selectedTags, peerReview, imageUrl });
      setSavedAt(new Date());
    }, AUTOSAVE_INTERVAL);
    return () => clearInterval(id);
  }, [title, body, selectedTags, peerReview, imageUrl]);

  // ── handleFormat — declared before effects that reference it ──
  const handleFormat = useCallback((type: "bold" | "italic" | "h2" | "quote" | "code" | "link") => {
    const ta = textareaRef.current;
    if (!ta) return;
    applyFormat(ta, type, setBody);
  }, []);

  // ── Keyboard shortcuts (stable ref avoids per-render rebind) ──
  const focusModeRef = useRef(focusMode);
  useEffect(() => { focusModeRef.current = focusMode; }, [focusMode]);
  useEffect(() => {
    handleFormatRef.current = handleFormat;
  }, [handleFormat]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "b") { e.preventDefault(); handleFormatRef.current("bold"); }
      if ((e.ctrlKey || e.metaKey) && e.key === "i") { e.preventDefault(); handleFormatRef.current("italic"); }
      if (e.key === "Escape" && focusModeRef.current) setFocusMode(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []); // stable — reads latest values via refs

  // ── Focus mode: lock body scroll ──────────────────────────────
  useEffect(() => {
    document.body.style.overflow = focusMode ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [focusMode]);

  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBody(e.target.value);
    // Start session on first keystroke
    if (sessionStartRef.current === null) {
      sessionStartRef.current = Date.now();
      sessionBaseWcRef.current = wc;
    }
    lastKeystrokeRef.current = Date.now();
    setIsPulsing(false);
    if (focusMode) applyTypewriterScroll();
    updateGhostPrompt();
  };

  const handleCursorActivity = () => {
    updateGhostPrompt(); // this also updates ghostTop via getCaretTop
    const ta = textareaRef.current;
    setHasSelection(!!ta && ta.selectionStart !== ta.selectionEnd);
    if (focusMode) applyTypewriterScroll();
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((p) => p.includes(tag) ? p.filter((t) => t !== tag) : [...p, tag].slice(0, 3));
  };

  const handleSave = () => {
    saveDraft({ title, body, selectedTags, peerReview, imageUrl });
    setSavedAt(new Date());
    toast({ title: "Draft saved" });
  };

  const handlePublish = () => {
    if (!canPublish) {
      toast({ title: "Not ready", description: wc < MIN_WORDS ? `Need ${MIN_WORDS - wc} more words.` : "Add a title.", variant: "destructive" });
      return;
    }
    setPublishError(null);
    createArticle.mutate(
      { data: { title: title.trim(), content: body.trim(), category: selectedTags[0] ?? undefined, peerReview: peerReview || undefined, imageUrl: imageUrl.trim() || undefined } },
      {
        onSuccess: (article) => {
          clearDraft();
          triggerRep(25, "article");
          toast({ title: "Published! +25 rep", description: peerReview ? "Submitted for peer review." : "Your article is now live." });
          setLocation(`/articles/${article.id}`);
        },
        onError: (err: unknown) => {
          const msg = (err as { data?: { error?: string } })?.data?.error ?? "Please try again.";
          setPublishError(msg);
          toast({ title: "Failed to publish", description: msg, variant: "destructive" });
        },
      }
    );
  };

  const savedLabel = savedAt
    ? `Saved ${Math.round((Date.now() - savedAt.getTime()) / 60000) === 0 ? "just now" : `${Math.round((Date.now() - savedAt.getTime()) / 60000)}m ago`}`
    : null;

  /* ── Focus mode overlay ────────────────────────────────────────── */
  const focusModeContent = (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "var(--color-background)" }}
    >
      {/* Focus top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border/50 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-muted-foreground/60 tracking-widest uppercase">Focus</span>
          {savedLabel && (
            <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground/50">
              <Save className="w-3 h-3" />{savedLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/50 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <Save className="w-3.5 h-3.5" />Save
          </button>
          <button
            onClick={handlePublish}
            disabled={createArticle.isPending || !canPublish}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all",
              canPublish
                ? "bg-primary text-white hover:bg-primary/90 shadow-[0_0_16px_rgba(99,102,241,0.35)]"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {createArticle.isPending ? "Publishing…" : "Publish"}
          </button>
          <button
            onClick={() => setFocusMode(false)}
            title="Exit focus (Esc)"
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Focus writing area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-10">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Your title here…"
            className="w-full bg-transparent border-none outline-none text-3xl sm:text-4xl font-bold text-foreground placeholder:text-foreground/15 mb-6 resize-none"
          />
          <div className="h-px bg-border/40 mb-5" />

          <FormattingToolbar
            textareaRef={textareaRef}
            onFormat={handleFormat}
            focusMode={true}
            hasSelection={hasSelection}
          />

          {/* Body with ghost overlay */}
          <div ref={bodyWrapRef} className="relative">
            <textarea
              ref={textareaRef}
              value={body}
              onChange={handleBodyChange}
              onSelect={handleCursorActivity}
              onScroll={handleCursorActivity}
              placeholder="Start writing…"
              className="w-full min-h-[calc(100vh-280px)] bg-transparent border-none outline-none resize-none font-serif text-base sm:text-lg text-foreground/90 placeholder:text-muted-foreground/30 leading-relaxed"
              spellCheck
            />
            {ghostPrompt && (
              <div
                className="absolute left-0 right-0 pointer-events-none font-serif text-base sm:text-lg leading-relaxed select-none"
                style={{ top: ghostTop, color: "rgba(148,163,184,0.25)", fontStyle: "italic" }}
              >
                {ghostPrompt}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Focus bottom bar — momentum */}
      <div className="shrink-0 px-6 py-3 border-t border-border/50 flex items-center justify-between">
        <MomentumBar elapsed={sessionElapsed} sessionWords={sessionWords} isPulsing={isPulsing} />
        <span className={cn("text-xs font-medium", canPublish ? "text-emerald-400" : "text-muted-foreground/50")}>
          {wc.toLocaleString()} words {canPublish ? "· Ready" : `· ${MIN_WORDS - wc} to go`}
        </span>
      </div>
    </div>
  );

  if (focusMode) return focusModeContent;

  /* ── Normal mode — Design B full-page layout ───────────────────── */
  const progressPct = Math.min(100, Math.round((wc / MIN_WORDS) * 100));

  return (
    <TooltipProvider>
      <div className="min-h-screen flex flex-col bg-background text-foreground">

        {/* ── Sticky header ──────────────────────────────────────── */}
        <header className="h-14 sticky top-0 z-20 shrink-0 flex items-center justify-between px-5 border-b border-border bg-background/95 backdrop-blur-sm">
          {/* Left: back + breadcrumb */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Link
              href="/articles"
              className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <span className="text-sm text-muted-foreground truncate">
              {title.trim() || "New Article"}
            </span>
          </div>

          {/* Center: autosave status */}
          <div className="flex-1 flex justify-center">
            {savedLabel ? (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Save className="w-3 h-3" />
                {savedLabel} ✓
              </span>
            ) : null}
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2 flex-1 justify-end">
            <button
              onClick={() => setFocusMode(true)}
              title="Enter focus mode"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors"
            >
              <Focus className="w-3.5 h-3.5" />Focus
            </button>

            <button
              onClick={() => setMode((m) => m === "write" ? "preview" : "write")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors",
                mode === "preview"
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
              )}
            >
              <Eye className="w-3.5 h-3.5" />
              {mode === "write" ? "Preview" : "Edit"}
            </button>

            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <button
                    onClick={handlePublish}
                    disabled={createArticle.isPending || !canPublish}
                    className={cn(
                      "flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all",
                      canPublish
                        ? "bg-primary text-white hover:bg-primary/90 shadow-[0_0_16px_rgba(99,102,241,0.35)]"
                        : "bg-muted text-muted-foreground cursor-not-allowed"
                    )}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {createArticle.isPending ? "Publishing…" : "Publish"}
                  </button>
                </span>
              </TooltipTrigger>
              {!canPublish && (
                <TooltipContent side="bottom" className="text-xs">
                  {wc < MIN_WORDS ? `Need ${MIN_WORDS - wc} more words` : "Add a title to publish"}
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        </header>

        {/* ── System banners ─────────────────────────────────────── */}
        {(restoredDraft || publishError) && (
          <div className="px-5 pt-3 space-y-2 shrink-0">
            {restoredDraft && (
              <div className="flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
                <FileText className="w-4 h-4 text-primary shrink-0" />
                <span className="flex-1">Draft restored from your last session.</span>
                <button
                  onClick={() => { clearDraft(); setTitle(""); setBody(""); setSelectedTags([]); setPeerReview(false); setImageUrl(""); }}
                  className="text-xs font-semibold text-primary/80 hover:text-primary"
                >Discard</button>
              </div>
            )}
            {publishError && (
              <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <p className="flex-1">{publishError}</p>
                <button onClick={() => setPublishError(null)}><X className="w-4 h-4 opacity-60 hover:opacity-100" /></button>
              </div>
            )}
          </div>
        )}

        {/* ── Content area ───────────────────────────────────────── */}
        {mode === "preview" ? (
          <div className="flex-1 overflow-y-auto">
            <ArticlePreview title={title} body={body} imageUrl={imageUrl} selectedTags={selectedTags}
              peerReview={peerReview} readTime={readTime} wc={wc} imageError={imageError} />
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">

            {/* ── Left panel: writing canvas ──────────────────────── */}
            <main className="flex-[7] overflow-y-auto flex justify-center">
              <div className="w-full max-w-[800px] px-8 sm:px-14 py-10 flex flex-col">

                {/* Cover image */}
                <CoverZone
                  imageUrl={imageUrl}
                  imageError={imageError}
                  onSet={(url) => { setImageUrl(url); setImageError(false); }}
                  onError={() => setImageError(true)}
                  onClear={() => { setImageUrl(""); setImageError(false); }}
                />

                {/* Formatting toolbar — pill */}
                <FormattingToolbar
                  textareaRef={textareaRef}
                  onFormat={handleFormat}
                  focusMode={false}
                  hasSelection={hasSelection}
                />

                {/* Title */}
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Article title…"
                  className="w-full bg-transparent border-none outline-none text-3xl sm:text-4xl font-bold text-foreground placeholder:text-foreground/20 mb-6 resize-none"
                />

                {/* Short accent divider */}
                <div className="w-12 h-px bg-border mb-8" />

                {/* Body with ghost overlay */}
                <div ref={bodyWrapRef} className="relative flex-1">
                  <textarea
                    ref={textareaRef}
                    value={body}
                    onChange={handleBodyChange}
                    onSelect={handleCursorActivity}
                    onScroll={handleCursorActivity}
                    placeholder="Write your article… LaTeX is supported: use $x^2$ for inline and $\int f\,dx$ for display math."
                    className="w-full min-h-[calc(100vh-320px)] bg-transparent border-none outline-none resize-none text-base sm:text-lg text-foreground/90 placeholder:text-muted-foreground/35 leading-relaxed"
                    spellCheck
                  />
                  {ghostPrompt && (
                    <div
                      className="absolute left-0 right-0 pointer-events-none text-base sm:text-lg leading-relaxed select-none"
                      style={{ top: ghostTop, color: "rgba(148,163,184,0.22)", fontStyle: "italic" }}
                    >
                      {ghostPrompt}
                    </div>
                  )}
                </div>

                {/* Momentum strip badge */}
                {sessionElapsed > 0 && (
                  <div className="mt-8 pb-12 flex justify-center">
                    <div className={cn(
                      "flex items-center gap-2 text-xs text-muted-foreground px-4 py-2 rounded-full border border-border bg-card shadow-sm transition-all",
                      isPulsing && "animate-pulse border-orange-500/30 text-orange-400"
                    )}>
                      <Zap className={cn("w-3 h-3 shrink-0", isPulsing ? "text-orange-400" : "text-primary/70")} />
                      {isPulsing
                        ? "Still there? Come back and finish your thought…"
                        : <>Writing for <span className="font-semibold text-foreground/70 mx-0.5">{fmtDuration(sessionElapsed)}</span> · <span className="font-semibold text-foreground/70 mx-0.5">+{sessionWords}</span> words this session</>
                      }
                    </div>
                  </div>
                )}
              </div>
            </main>

            {/* ── Right panel: info sidebar ───────────────────────── */}
            <aside className="flex-[3] min-w-[220px] max-w-[300px] border-l border-border bg-secondary/10 overflow-y-auto flex flex-col">
              <div className="p-6 flex-1 flex flex-col gap-8">

                {/* Progress */}
                <section className="space-y-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Progress</h3>
                  <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                    <div className="flex items-end justify-between">
                      <div>
                        <span className="text-2xl font-bold text-foreground">{wc}</span>
                        <span className="text-sm text-muted-foreground ml-1">/ {MIN_WORDS} words</span>
                      </div>
                      <span className={cn("text-xs font-semibold", canPublish ? "text-emerald-400" : "text-muted-foreground")}>
                        {progressPct}%
                      </span>
                    </div>
                    <Progress value={progressPct} className="h-1.5 [&>div]:bg-primary [&>div]:transition-all" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{canPublish ? "Ready to publish ✓" : `${MIN_WORDS - wc} words to go`}</span>
                      <span>~{readTime} min read</span>
                    </div>
                  </div>
                </section>

                {/* Topics */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Topics</h3>
                    <span className="text-xs text-muted-foreground">up to 3</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedTags.map((t) => (
                      <span
                        key={t}
                        className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-primary/40 bg-primary/10 text-primary font-medium"
                      >
                        {t}
                        <button
                          onClick={() => toggleTag(t)}
                          className="text-primary/60 hover:text-primary transition-colors ml-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    {selectedTags.length < 3 && (
                      <div className="relative">
                        <select
                          value=""
                          onChange={(e) => { if (e.target.value) toggleTag(e.target.value); }}
                          className="appearance-none text-xs pl-6 pr-2 py-1 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 bg-card cursor-pointer transition-colors focus:outline-none"
                        >
                          <option value="">Add topic…</option>
                          {topics.filter((t) => !selectedTags.includes(t)).map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                        <Plus className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                      </div>
                    )}
                  </div>
                </section>

                {/* Settings */}
                <section className="space-y-4">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Settings</h3>

                  {/* Peer review */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-foreground leading-tight">Peer Review</div>
                      <div className="text-xs text-muted-foreground mt-0.5 leading-snug">Allow expert feedback before publish</div>
                    </div>
                    <button
                      onClick={() => setPeerReview((p) => !p)}
                      className={cn(
                        "mt-0.5 w-9 h-5 rounded-full relative transition-colors shrink-0",
                        peerReview ? "bg-primary" : "bg-muted border border-border"
                      )}
                    >
                      <span className={cn(
                        "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                        peerReview && "translate-x-4"
                      )} />
                    </button>
                  </div>
                  {peerReview && (
                    <div className="flex items-center gap-2 rounded-lg bg-green-500/8 border border-green-500/20 px-3 py-2 text-xs text-green-400">
                      <CheckCircle className="w-3.5 h-3.5 shrink-0" />Peer review requested
                    </div>
                  )}

                  {/* Cover image — compact URL input; full CoverZone lives in the writing canvas */}
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-foreground">Cover Image</div>
                    {imageUrl && !imageError ? (
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-lg overflow-hidden border border-border shrink-0">
                          <img src={imageUrl} alt="Cover" className="w-full h-full object-cover" onError={() => setImageError(true)} />
                        </div>
                        <span className="text-xs text-muted-foreground truncate flex-1">Cover set</span>
                        <button
                          onClick={() => { setImageUrl(""); setImageError(false); }}
                          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <input
                        type="url"
                        value={imageUrl}
                        onChange={(e) => { setImageUrl(e.target.value); setImageError(false); }}
                        placeholder="Paste image URL…"
                        className="w-full text-xs bg-card border border-border rounded-lg px-3 py-2 placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
                      />
                    )}
                  </div>

                  {/* Focus mode shortcut */}
                  <button
                    onClick={() => setFocusMode(true)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors text-left group"
                  >
                    <Focus className="w-3.5 h-3.5 text-primary/60 group-hover:text-primary transition-colors shrink-0" />
                    <span>Enter Focus Mode</span>
                  </button>
                </section>
              </div>

              {/* Save draft — pinned to bottom */}
              <div className="p-4 border-t border-border bg-secondary/10 shrink-0">
                <button
                  onClick={handleSave}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Save Draft
                </button>
              </div>
            </aside>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
