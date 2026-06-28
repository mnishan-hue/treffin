import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useGetArticles, useCreateArticle, useGetTopics } from "@workspace/api-client-react";
import { ArticleCard } from "@/components/feed/article-card";
import { Skeleton } from "@/components/ui/skeleton";
import { X, Pen, Tag, FileText, CheckCircle, Eye, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAppContext } from "@/context/app-context";
import { useLocation } from "wouter";

const MIN_WORDS = 500;

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function WordMeter({ count }: { count: number }) {
  const pct = Math.min(100, (count / MIN_WORDS) * 100);
  const color =
    count < 200 ? { bar: "bg-red-500", text: "text-red-400", label: "Too short" }
    : count < 400 ? { bar: "bg-yellow-500", text: "text-yellow-400", label: "Getting there" }
    : count < MIN_WORDS ? { bar: "bg-orange-500", text: "text-orange-400", label: `${MIN_WORDS - count} more to go` }
    : { bar: "bg-green-500", text: "text-green-400", label: "Ready to publish!" };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className={cn("font-semibold", color.text)}>{color.label}</span>
        <span className="text-muted-foreground">{count} / {MIN_WORDS} words</span>
      </div>
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-300", color.bar)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function WriteArticleModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const { triggerRep } = useAppContext();
  const [, setLocation] = useLocation();
  const createArticle = useCreateArticle();
  const { data: topicsData } = useGetTopics();
  const articleTags = topicsData?.map(t => t.name) ?? ["Philosophy", "Economics", "Technology", "Science", "Politics", "Psychology", "Culture"];
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [step, setStep] = useState<"write" | "preview">("write");
  const [peerReview, setPeerReview] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageError, setImageError] = useState(false);

  const toggleTag = (tag: string) => {
    setSelectedTags(p => p.includes(tag) ? p.filter(t => t !== tag) : [...p, tag].slice(0, 3));
  };

  const wc = wordCount(body);
  const readTime = Math.max(1, Math.ceil(wc / 200));
  const canPublish = title.trim().length > 0 && wc >= MIN_WORDS;

  const handlePublish = () => {
    if (!canPublish) {
      toast({ title: "Not ready", description: `Your article needs at least ${MIN_WORDS} words to be published.` });
      return;
    }
    createArticle.mutate(
      {
        data: {
          title: title.trim(),
          content: body.trim(),
          category: selectedTags[0] ?? undefined,
          peerReview: peerReview || undefined,
          imageUrl: imageUrl.trim() || undefined,
        },
      },
      {
        onSuccess: (newArticle) => {
          triggerRep(25, "article");
          toast({ title: "Article published! +25 rep", description: peerReview ? "Submitted for peer review." : "Your article is now live on Treffin." });
          onClose();
          setLocation(`/articles/${newArticle.id}`);
        },
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
          toast({ title: "Failed to publish", description: msg ?? "Please try again.", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4 sm:p-8" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl my-4" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Pen className="w-4 h-4 text-primary" />
            <span className="font-bold">Write Article</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <span className={cn("font-semibold", wc >= MIN_WORDS ? "text-green-400" : wc >= 400 ? "text-orange-400" : wc >= 200 ? "text-yellow-400" : "text-red-400")}>
                {wc} words
              </span>
              <span>·</span>
              <span>~{readTime} min read</span>
            </div>
            <button
              className={cn("text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors", step === "preview" ? "border-primary/30 text-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground")}
              onClick={() => setStep(p => p === "write" ? "preview" : "write")}
            >
              <Eye className="w-3.5 h-3.5 inline mr-1" />{step === "write" ? "Preview" : "Edit"}
            </button>
            <button className="p-1.5 rounded-full hover:bg-muted" onClick={onClose}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6 flex flex-col gap-5">
          {step === "write" ? (
            <>
              <input
                className="w-full bg-transparent text-xl font-bold outline-none placeholder:text-muted-foreground/50 border-b border-transparent focus:border-border pb-2"
                placeholder="Write a compelling title..."
                value={title}
                onChange={e => setTitle(e.target.value)}
                data-testid="input-article-title"
              />
              <textarea
                className="w-full bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground/50 resize-none min-h-[280px]"
                placeholder={`Start writing your article... (minimum ${MIN_WORDS} words required)\n\nShare your ideas, arguments, and insights with the Treffin community.`}
                value={body}
                onChange={e => setBody(e.target.value)}
                data-testid="input-article-body"
              />

              {/* Word meter */}
              <WordMeter count={wc} />

              {/* Cover image */}
              <div className="border-t border-border pt-4 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <ImageIcon className="w-3.5 h-3.5" /> Cover image <span className="font-normal">(optional)</span>
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    className="flex-1 bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/50 focus:border-primary/50 transition-colors"
                    placeholder="Paste an image URL…"
                    value={imageUrl}
                    onChange={e => { setImageUrl(e.target.value); setImageError(false); }}
                    type="url"
                  />
                  {imageUrl.trim() && !imageError && (
                    <button
                      onClick={() => { setImageUrl(""); setImageError(false); }}
                      className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                      title="Remove image"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {imageUrl.trim() && (
                  <div className="relative w-full h-28 rounded-lg overflow-hidden border border-border bg-muted/30">
                    {imageError ? (
                      <div className="flex items-center justify-center h-full text-xs text-muted-foreground gap-2">
                        <ImageIcon className="w-4 h-4" /> Could not load image — check the URL
                      </div>
                    ) : (
                      <img
                        src={imageUrl.trim()}
                        alt="Cover preview"
                        className="w-full h-full object-cover"
                        onError={() => setImageError(true)}
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Tags */}
              <div className="border-t border-border pt-4 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <Tag className="w-3.5 h-3.5" /> Add topics (up to 3)
                </div>
                <div className="flex flex-wrap gap-2">
                  {articleTags.map(tag => (
                    <button
                      key={tag}
                      className={cn("text-xs font-medium px-3 py-1.5 rounded-full border transition-colors", selectedTags.includes(tag) ? "bg-primary/10 border-primary/40 text-primary" : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground")}
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Peer review option */}
              <div className="border-t border-border pt-4">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className={cn("w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors", peerReview ? "bg-primary border-primary" : "border-border group-hover:border-primary/50")}>
                    {peerReview && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <input type="checkbox" className="sr-only" checked={peerReview} onChange={e => setPeerReview(e.target.checked)} />
                  <div>
                    <p className="text-sm font-semibold">Submit for Peer Review</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Community experts will review your article. Approved articles receive a "Community Reviewed" badge and are featured prominently.</p>
                  </div>
                </label>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-4">
              {!title && !body ? (
                <div className="text-center text-muted-foreground py-12">Nothing to preview yet. Go back and write something.</div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedTags.map(tag => (
                      <span key={tag} className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded uppercase tracking-wide">{tag}</span>
                    ))}
                    {peerReview && (
                      <span className="text-[11px] font-bold text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Peer Review Requested
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl font-bold leading-tight">{title || "Untitled"}</h2>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground border-b border-border pb-4">
                    <span>You · Just now</span><span>·</span><span>{readTime} min read</span><span>·</span><span>{wc} words</span>
                  </div>
                  {imageUrl.trim() && !imageError && (
                    <div className="w-full h-48 rounded-xl overflow-hidden border border-border">
                      <img src={imageUrl.trim()} alt="Cover" className="w-full h-full object-cover" onError={() => setImageError(true)} />
                    </div>
                  )}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">{body}</p>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20 rounded-b-2xl">
          <p className="text-xs text-muted-foreground">
            {!canPublish
              ? <span className="text-orange-400 font-medium">{wc >= MIN_WORDS ? "Add a title to publish" : `${MIN_WORDS - wc} more words needed`}</span>
              : "Ready to publish!"
            }
          </p>
          <button
            className={cn(
              "font-semibold px-5 py-2 rounded-full text-sm transition-all flex items-center gap-2",
              canPublish
                ? "bg-primary hover:bg-primary/90 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)]"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
            onClick={handlePublish}
            disabled={createArticle.isPending || !canPublish}
            data-testid="button-publish-article"
          >
            <FileText className="w-4 h-4" />
            {createArticle.isPending ? "Publishing..." : "Publish Article"}
          </button>
        </div>
      </div>
    </div>
  );
}

type SortMode = "trending" | "newest" | "most_liked";

export default function Articles() {
  const [showWrite, setShowWrite] = useState(false);
  const [topicFilter, setTopicFilter] = useState<string>("All");
  const [sortMode, setSortMode] = useState<SortMode>("trending");

  const { data: topicsData } = useGetTopics();
  const topics = ["All", ...(topicsData?.map(t => t.name) ?? [])];

  const { data: articles, isLoading } = useGetArticles({
    sort: sortMode,
    ...(topicFilter !== "All" ? { category: topicFilter } : {}),
  });

  const sorted = articles ?? [];

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between sticky top-[64px] z-40 bg-background/95 backdrop-blur-sm py-4 border-b border-border">
          <div>
            <h1 className="text-2xl font-bold">Articles</h1>
            <p className="text-sm text-muted-foreground">Long-form ideas · min {MIN_WORDS} words</p>
          </div>
          <button
            className="bg-primary text-primary-foreground font-semibold px-4 py-2 rounded-full text-sm hover:bg-primary/90 transition-colors flex items-center gap-2"
            onClick={() => setShowWrite(true)}
            data-testid="button-write-article"
          >
            <Pen className="w-3.5 h-3.5" /> Write Article
          </button>
        </div>

        {/* Filters + Sort */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap overflow-x-auto scrollbar-none">
            {topics.map((t) => (
              <button
                key={t}
                onClick={() => setTopicFilter(t)}
                className={cn(
                  "text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap",
                  topicFilter === t
                    ? "treffin-gradient text-white border-transparent"
                    : "bg-muted/60 text-muted-foreground border-border/50 hover:text-foreground",
                )}
                data-testid={`button-topic-${t.toLowerCase()}`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <label className="text-xs text-muted-foreground">Sort</label>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="bg-muted/60 border border-border/50 rounded-lg text-xs font-semibold px-3 py-1.5 outline-none focus:border-primary/60"
              data-testid="select-sort"
            >
              <option value="trending">Trending</option>
              <option value="newest">Newest</option>
              <option value="most_liked">Most liked</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {isLoading ? (
            Array(5).fill(0).map((_, i) => <Skeleton key={i} className="w-full h-[160px] rounded-xl" />)
          ) : sorted.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground bg-card border border-border rounded-2xl">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-semibold">No articles yet</p>
              <p className="text-sm mt-1">{topicFilter === "All" ? "Be the first to publish a long-form idea." : `No articles in ${topicFilter}. Try a different topic.`}</p>
              <button
                className="mt-4 text-sm font-semibold text-primary hover:underline"
                onClick={() => setShowWrite(true)}
              >
                Write the first article →
              </button>
            </div>
          ) : (
            sorted.map((article) => (
              <ArticleCard key={article.id} post={{
                ...article,
                type: "article",
                topic: article.category ?? undefined,
                comments: 0,
                reposts: 0,
              }} />
            ))
          )}
        </div>
      </div>
      {showWrite && <WriteArticleModal onClose={() => setShowWrite(false)} />}
    </AppLayout>
  );
}
