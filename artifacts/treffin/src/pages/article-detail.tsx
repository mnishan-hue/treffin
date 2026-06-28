import { useParams, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import {
  useGetArticle,
  useSubmitReviewRequest,
  useGetCurrentUser,
  useGetArticleAnnotations,
  useCreateAnnotation,
  useDeleteAnnotation,
  useLikeArticle,
  getGetArticleQueryKey,
  getGetCurrentUserQueryKey,
  getGetArticleAnnotationsQueryKey,
  type Annotation,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatNumber } from "@/lib/utils";
import {
  ArrowLeft, Clock, Heart, Bookmark, Share, CheckCircle, Send, ThumbsUp,
  Users, MessageSquare, X, Highlighter, Trash2,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAppContext } from "@/context/app-context";
import { useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";

interface SelectionInfo {
  text: string;
  paragraphIndex: number;
  x: number;
  y: number;
}

function buildParagraphHtml(
  rawText: string,
  paragraphAnnotations: Array<Annotation & { markerNum: number }>,
): string {
  let result = rawText;
  for (const ann of paragraphAnnotations) {
    const idx = result.indexOf(ann.selectedText);
    if (idx === -1) continue;
    const before = result.slice(0, idx);
    const match = result.slice(idx, idx + ann.selectedText.length);
    const after = result.slice(idx + ann.selectedText.length);
    result =
      before +
      `<span class="ann-hl" data-ann-id="${ann.id}">${match}<sup class="ann-num">${ann.markerNum}</sup></span>` +
      after;
  }
  result = result
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br/>");
  return result;
}

export default function ArticleDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { toggleSaved, isSaved, triggerRep } = useAppContext();
  const articleId = Number(id);
  const queryClient = useQueryClient();
  const { user: clerkUser } = useUser();

  const { data: currentUserProfile } = useGetCurrentUser({
    query: { enabled: !!clerkUser, queryKey: getGetCurrentUserQueryKey() },
  });

  const { data: article, isLoading } = useGetArticle(articleId, {
    query: { enabled: !!articleId, queryKey: getGetArticleQueryKey(articleId) },
  });

  const { data: annotations = [] } = useGetArticleAnnotations(articleId, {
    query: { enabled: !!articleId, queryKey: getGetArticleAnnotationsQueryKey(articleId) },
  });

  const submitReviewRequest = useSubmitReviewRequest({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetArticleQueryKey(articleId) });
        toast({ title: "Submitted for peer review!", description: "Community experts will review this article within 48 hours." });
      },
      onError: (err: unknown) => {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 409) {
          toast({ title: "Already submitted", description: "This article has already been submitted for review." });
        } else {
          toast({ title: "Failed to submit", description: "Please try again.", variant: "destructive" });
        }
      },
    },
  });

  const createAnnotation = useCreateAnnotation({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetArticleAnnotationsQueryKey(articleId) });
        setAnnotationComment("");
        setSelectionInfo(null);
        setShowAnnotationForm(false);
        toast({ title: "Annotation added!" });
      },
      onError: () => {
        toast({ title: "Failed to add annotation", variant: "destructive" });
      },
    },
  });

  const deleteAnnotation = useDeleteAnnotation({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetArticleAnnotationsQueryKey(articleId) });
        toast({ title: "Annotation deleted" });
      },
    },
  });

  const likeMutation = useLikeArticle();

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  // Sync liked/likeCount from server data when article loads
  useEffect(() => {
    if (article) {
      setLiked(article.liked ?? false);
      setLikeCount(article.likes);
    }
  }, [article?.id]);
  const [showReviews, setShowReviews] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [comments, setComments] = useState<{ id: number; authorId: number; authorName: string; content: string; createdAt: string }[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [selectionInfo, setSelectionInfo] = useState<SelectionInfo | null>(null);
  const [annotationComment, setAnnotationComment] = useState("");
  const [showAnnotationForm, setShowAnnotationForm] = useState(false);
  const [showAnnotationPanel, setShowAnnotationPanel] = useState(false);

  const articleBodyRef = useRef<HTMLDivElement>(null);

  const saved = isSaved(articleId);
  const isOwnArticle = !!(currentUserProfile && article?.authorId && currentUserProfile.id === article.authorId);
  const reviewRequestStatus = article?.reviewRequestStatus ?? null;
  const reviewSubmitted = reviewRequestStatus !== null;
  const isExpertReviewed = article?.isExpertReviewed ?? false;

  useEffect(() => {
    const handleScroll = () => {
      const el = document.documentElement;
      const scrollTop = el.scrollTop || document.body.scrollTop;
      const scrollHeight = el.scrollHeight - el.clientHeight;
      if (scrollHeight > 0) setScrollProgress((scrollTop / scrollHeight) * 100);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleTextSelect = useCallback(() => {
    if (showAnnotationForm) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setSelectionInfo(null);
      return;
    }
    const text = selection.toString().trim();
    if (text.length < 3) {
      setSelectionInfo(null);
      return;
    }
    if (!articleBodyRef.current) return;

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const nodeEl = container instanceof Element ? container : container.parentElement;

    if (!articleBodyRef.current.contains(nodeEl)) {
      setSelectionInfo(null);
      return;
    }

    const paraEl = nodeEl?.closest("[data-para-idx]");
    const paragraphIndex = paraEl ? Number(paraEl.getAttribute("data-para-idx")) : 0;
    const rect = range.getBoundingClientRect();

    setSelectionInfo({
      text,
      paragraphIndex,
      x: rect.left + rect.width / 2,
      y: rect.top + window.scrollY - 8,
    });
  }, [showAnnotationForm]);

  useEffect(() => {
    document.addEventListener("mouseup", handleTextSelect);
    return () => document.removeEventListener("mouseup", handleTextSelect);
  }, [handleTextSelect]);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: article?.title ?? "Treffin Article", text: "Check out this article on Treffin, where minds debate.", url }); } catch {}
    } else {
      navigator.clipboard.writeText(url).catch(() => {});
      toast({ title: "Link copied!", description: "Article link copied to clipboard." });
    }
  };

  const handleLike = () => {
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount(p => p + (newLiked ? 1 : -1));
    if (newLiked) triggerRep(5, "like");
    likeMutation.mutate({ id: articleId });
  };

  const handleSave = () => {
    toggleSaved({
      id: articleId,
      type: "article",
      title: article?.title ?? "Article",
      excerpt: article?.excerpt ?? "",
      author: article?.authorName ?? "Unknown",
      time: "Just now",
      href: `/articles/${articleId}`,
    });
    toast({ title: saved ? "Removed from saved" : "Article saved!" });
  };

  const handlePeerReview = () => { submitReviewRequest.mutate({ id: articleId }); };

  useEffect(() => {
    if (!articleId) return;
    setCommentsLoading(true);
    fetch(`/api/articles/${articleId}/comments`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setComments(Array.isArray(data) ? data.map((c: { id: number; authorId?: number; authorName: string; content: string; createdAt: string }) => ({ ...c, authorId: c.authorId ?? 0 })) : []))
      .catch(() => setComments([]))
      .finally(() => setCommentsLoading(false));
  }, [articleId]);

  const handleComment = async () => {
    if (!commentInput.trim()) return;
    const authorName = clerkUser?.fullName ?? clerkUser?.username ?? "Anonymous";
    const body = commentInput.trim();
    setCommentInput("");
    try {
      const r = await fetch(`/api/articles/${articleId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorName, content: body }),
      });
      if (r.ok) {
        const newComment = await r.json();
        setComments(p => [...p, { ...newComment, authorId: newComment.authorId ?? 0 }]);
        triggerRep(2, "comment");
        toast({ title: "Comment posted!" });
      }
    } catch {
      toast({ title: "Failed to post comment", variant: "destructive" });
    }
  };

  const handleSubmitAnnotation = () => {
    if (!selectionInfo || !annotationComment.trim() || !clerkUser) return;
    createAnnotation.mutate({
      id: articleId,
      data: {
        selectedText: selectionInfo.text,
        comment: annotationComment.trim(),
        paragraphIndex: selectionInfo.paragraphIndex,
      },
    });
  };

  const canDeleteAnnotation = (ann: Annotation) => {
    if (!currentUserProfile) return false;
    return ann.userId === currentUserProfile.id || currentUserProfile.id === article?.authorId;
  };

  const annotationsWithMarker = annotations.map((a, i) => ({ ...a, markerNum: i + 1 }));
  const paragraphs = (article?.content?.trim() || article?.excerpt?.trim() || "").split("\n\n");

  return (
    <AppLayout>
      {/* Annotation highlight styles */}
      <style>{`
        .ann-hl { background: rgba(99,102,241,0.18); border-bottom: 1.5px solid #6366f1; border-radius: 2px; cursor: pointer; padding: 0 1px; }
        .ann-num { color: #818cf8; font-size: 0.6em; font-weight: 700; margin-left: 1px; vertical-align: super; line-height: 1; }
      `}</style>

      {/* Reading progress bar */}
      <div className="fixed top-16 left-0 right-0 z-50 h-0.5 bg-transparent">
        <div className="h-full bg-gradient-to-r from-primary to-indigo-400 transition-all duration-100" style={{ width: `${scrollProgress}%` }} />
      </div>

      {/* Floating annotate button – fixed position relative to viewport */}
      {selectionInfo && !showAnnotationForm && (
        <div
          className="fixed z-50 flex flex-col items-center"
          style={{ left: selectionInfo.x, top: selectionInfo.y - window.scrollY, transform: "translate(-50%, -100%)" }}
        >
          {clerkUser ? (
            <button
              className="flex items-center gap-1.5 text-xs font-semibold bg-primary text-white px-3 py-1.5 rounded-full shadow-lg hover:bg-primary/90 transition-colors"
              onMouseDown={e => { e.preventDefault(); setShowAnnotationForm(true); }}
              data-testid="button-annotate"
            >
              <Highlighter className="w-3 h-3" /> Annotate
            </button>
          ) : (
            <span className="text-xs bg-card border border-border px-3 py-1.5 rounded-full shadow-lg text-muted-foreground whitespace-nowrap">
              Sign in to annotate
            </span>
          )}
          <div className="w-2 h-2 bg-primary rotate-45 -mt-1" />
        </div>
      )}

      {/* Annotation form popup – appears near selection */}
      {selectionInfo && showAnnotationForm && (
        <div
          className="fixed z-50"
          style={{
            left: Math.max(8, Math.min(selectionInfo.x, window.innerWidth - 296)),
            top: Math.max(70, selectionInfo.y - window.scrollY - 12),
            transform: "translate(-40%, -100%)",
          }}
        >
          <div className="bg-card border border-border rounded-xl shadow-xl p-4 w-72 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-muted-foreground italic line-clamp-2">
                "{selectionInfo.text.slice(0, 80)}{selectionInfo.text.length > 80 ? "…" : ""}"
              </p>
              <button
                className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
                onClick={() => { setShowAnnotationForm(false); setSelectionInfo(null); }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm resize-none outline-none focus:border-primary/50 transition-colors placeholder:text-muted-foreground"
              placeholder="Add your annotation..."
              rows={3}
              value={annotationComment}
              onChange={e => setAnnotationComment(e.target.value)}
              autoFocus
              data-testid="input-annotation-comment"
            />
            <div className="flex gap-2 justify-end">
              <button
                className="text-xs text-muted-foreground px-3 py-1.5 rounded-lg hover:bg-muted transition-colors"
                onClick={() => { setShowAnnotationForm(false); setSelectionInfo(null); }}
              >
                Cancel
              </button>
              <button
                className="text-xs font-semibold bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                onClick={handleSubmitAnnotation}
                disabled={!annotationComment.trim() || createAnnotation.isPending}
                data-testid="button-submit-annotation"
              >
                {createAnnotation.isPending ? "Saving…" : "Annotate"}
              </button>
            </div>
          </div>
          <div className="w-3 h-3 bg-card border-b border-r border-border rotate-45 mx-auto -mt-1.5" />
        </div>
      )}

      {/* Annotations sidebar panel */}
      {showAnnotationPanel && (
        <div className="fixed right-4 top-[70px] bottom-4 w-72 z-40 flex flex-col bg-card border border-border rounded-xl shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <Highlighter className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">Annotations</span>
              {annotations.length > 0 && (
                <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">{annotations.length}</span>
              )}
            </div>
            <button className="text-muted-foreground hover:text-foreground transition-colors" onClick={() => setShowAnnotationPanel(false)}>
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-none p-3 flex flex-col gap-3">
            {annotations.length === 0 ? (
              <div className="text-center py-8 flex flex-col items-center gap-2">
                <Highlighter className="w-8 h-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No annotations yet.</p>
                <p className="text-xs text-muted-foreground/60">Select any text in the article to add one.</p>
              </div>
            ) : (
              annotationsWithMarker.map(ann => (
                <div key={ann.id} className="bg-background/60 border border-border rounded-lg p-3 flex flex-col gap-2 group">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">#{ann.markerNum}</span>
                    <span className="text-[10px] text-muted-foreground truncate flex-1">para {ann.paragraphIndex + 1}</span>
                    {canDeleteAnnotation(ann) && (
                      <button
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all"
                        onClick={() => deleteAnnotation.mutate({ id: ann.id })}
                        data-testid={`button-delete-annotation-${ann.id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <blockquote className="text-[11px] text-primary/80 italic border-l-2 border-primary/30 pl-2 line-clamp-2">
                    "{ann.selectedText}"
                  </blockquote>
                  <p className="text-xs text-foreground/90 leading-relaxed">{ann.comment}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Avatar className="w-5 h-5">
                      <AvatarImage src={ann.authorAvatar ?? undefined} />
                      <AvatarFallback className="text-[8px] bg-primary/20 text-primary">
                        {(ann.authorName ?? "?").substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-[10px] text-muted-foreground truncate">{ann.authorName}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-6 max-w-2xl">
        <button
          onClick={() => setLocation("/articles")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
          data-testid="button-back-articles"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Articles
        </button>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        ) : (
          <article className="flex flex-col gap-6">
            {/* Category & badges */}
            <div className="flex items-center gap-2 flex-wrap">
              {article?.category && (
                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded uppercase tracking-widest">{article.category}</span>
              )}
              {article?.readTime && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" /> {article.readTime} min read
                </span>
              )}
              <span className="text-xs text-muted-foreground">{Math.round(scrollProgress)}% read</span>
              {isExpertReviewed && (
                <button
                  className="flex items-center gap-1.5 text-[11px] font-bold text-green-400 bg-green-400/10 border border-green-400/20 px-2.5 py-1 rounded-full hover:bg-green-400/20 transition-colors"
                  onClick={() => setShowReviews(p => !p)}
                  data-testid="button-view-reviews"
                >
                  <CheckCircle className="w-3 h-3" /> Expert Reviewed
                </button>
              )}
              {annotations.length > 0 && (
                <button
                  className={cn(
                    "flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors",
                    showAnnotationPanel
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/30 hover:text-primary"
                  )}
                  onClick={() => setShowAnnotationPanel(p => !p)}
                  data-testid="button-toggle-annotations-badge"
                >
                  <MessageSquare className="w-3 h-3" /> {annotations.length} note{annotations.length !== 1 ? "s" : ""}
                </button>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold leading-tight">{article?.title ?? "Article"}</h1>

            {article?.excerpt && (
              <p className="text-lg text-muted-foreground leading-relaxed border-l-2 border-primary pl-4">{article.excerpt}</p>
            )}

            {/* Author */}
            <div className="flex items-center gap-3 py-4 border-y border-border">
              <Avatar className="w-10 h-10 border border-border">
                <AvatarImage src={article?.authorAvatar || undefined} />
                <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                  {(article?.authorName ?? "A").substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-sm">{article?.authorName}</p>
                <p className="text-xs text-muted-foreground">{article?.authorTitle}</p>
              </div>
            </div>

            {/* Article image */}
            {article?.imageUrl && (
              <div className="rounded-xl overflow-hidden border border-border">
                <img src={article.imageUrl} alt={article.title} className="w-full h-64 object-cover" />
              </div>
            )}

            {/* Content with annotation highlights */}
            <div ref={articleBodyRef} className="prose prose-invert prose-sm max-w-none leading-relaxed select-text">
              {paragraphs.length === 1 && paragraphs[0] === "" ? (
                <p className="text-muted-foreground italic text-sm">This article is still being written. Check back soon.</p>
              ) : (
                paragraphs.map((para, i) => {
                  const paraAnns = annotationsWithMarker.filter(a => a.paragraphIndex === i);
                  const html = buildParagraphHtml(para, paraAnns);
                  return (
                    <p
                      key={i}
                      data-para-idx={i}
                      className="mb-4 text-[15px] leading-relaxed text-foreground/90"
                      dangerouslySetInnerHTML={{ __html: html }}
                    />
                  );
                })
              )}
            </div>

            {/* Annotation hint for signed-in users */}
            {clerkUser && (
              <p className="text-xs text-muted-foreground/60 flex items-center gap-1.5 -mt-2">
                <Highlighter className="w-3 h-3" /> Select any text to annotate
              </p>
            )}

            {/* Action bar */}
            <div className="flex items-center gap-3 pt-4 border-t border-border flex-wrap">
              <button
                className={cn("flex items-center gap-2 text-sm font-medium transition-colors px-4 py-2 rounded-full border", liked ? "text-red-400 border-red-400/30 bg-red-400/10" : "text-muted-foreground border-border hover:text-red-400 hover:border-red-400/30")}
                onClick={handleLike}
                data-testid="button-like-article"
              >
                <Heart className={cn("w-4 h-4", liked && "fill-current")} />
                {formatNumber(likeCount)} Likes
              </button>
              <button
                className={cn("flex items-center gap-2 text-sm font-medium transition-colors px-4 py-2 rounded-full border", saved ? "text-primary border-primary/30 bg-primary/10" : "text-muted-foreground border-border hover:text-primary hover:border-primary/30")}
                onClick={handleSave}
                data-testid="button-save-article-detail"
              >
                <Bookmark className={cn("w-4 h-4", saved && "fill-current")} />
                {saved ? "Saved" : "Save"}
              </button>
              <button
                className={cn(
                  "flex items-center gap-2 text-sm font-medium transition-colors px-4 py-2 rounded-full border",
                  showAnnotationPanel
                    ? "text-primary border-primary/30 bg-primary/10"
                    : "text-muted-foreground border-border hover:text-primary hover:border-primary/30"
                )}
                onClick={() => setShowAnnotationPanel(p => !p)}
                data-testid="button-annotations-panel"
              >
                <MessageSquare className="w-4 h-4" />
                {annotations.length > 0 ? `${annotations.length} Notes` : "Notes"}
              </button>
              {reviewSubmitted ? (
                <span className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-green-400/20 text-green-400 bg-green-400/10">
                  <CheckCircle className="w-3.5 h-3.5" />
                  {reviewRequestStatus === "approved" ? "Review Approved" : reviewRequestStatus === "rejected" ? "Review Rejected" : "Review Requested"}
                </span>
              ) : (
                <button
                  className="flex items-center gap-2 text-sm font-medium text-green-400 border border-green-400/30 bg-green-400/10 hover:bg-green-400/20 transition-colors px-4 py-2 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handlePeerReview}
                  disabled={submitReviewRequest.isPending}
                  data-testid="button-peer-review"
                >
                  <Users className="w-4 h-4" /> {submitReviewRequest.isPending ? "Submitting…" : "Request Review"}
                </button>
              )}
              <button
                className="ml-auto flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={handleShare}
                data-testid="button-share-article"
              >
                <Share className="w-4 h-4" /> Share
              </button>
            </div>

            {/* Comments */}
            <div className="flex flex-col gap-4 pt-2 border-t border-border">
              <h3 className="font-bold text-base">Discussion</h3>
              <div className="flex gap-2 items-center">
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarFallback className="text-xs bg-primary/20 text-primary">YO</AvatarFallback>
                </Avatar>
                <div className="flex-1 flex items-center gap-2 bg-muted/50 border border-border rounded-full px-4 py-2">
                  <input
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    placeholder="Share your thoughts on this article..."
                    value={commentInput}
                    onChange={e => setCommentInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleComment()}
                    data-testid="input-article-comment"
                  />
                  <button className={cn("transition-colors", commentInput.trim() ? "text-primary hover:text-primary/80" : "text-muted-foreground")} onClick={handleComment}>
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                {commentsLoading ? (
                  <div className="flex flex-col gap-2">{[1,2].map(i => <div key={i} className="h-16 bg-muted/30 rounded-xl animate-pulse" />)}</div>
                ) : comments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No comments yet. Be the first to share your thoughts.</p>
                ) : comments.map(c => {
                  const initials = c.authorName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
                  const diff = Date.now() - new Date(c.createdAt).getTime();
                  const mins = Math.floor(diff / 60000);
                  const hours = Math.floor(mins / 60);
                  const timeAgo = hours > 0 ? `${hours}h ago` : mins > 0 ? `${mins}m ago` : "Just now";
                  return (
                  <div key={c.id} className="flex gap-3">
                    <button
                      className="shrink-0 mt-0.5"
                      onClick={() => c.authorId > 0 && setLocation(`/profile/${c.authorId}`)}
                      disabled={c.authorId <= 0}
                    >
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                      </Avatar>
                    </button>
                    <div className="flex-1">
                      <div className="bg-muted/40 rounded-xl px-4 py-2.5">
                        <div className="flex items-center gap-2 mb-1">
                          {c.authorId > 0 ? (
                            <button
                              className="text-sm font-semibold hover:text-primary transition-colors"
                              onClick={() => setLocation(`/profile/${c.authorId}`)}
                            >
                              {c.authorName}
                            </button>
                          ) : (
                            <span className="text-sm font-semibold">{c.authorName}</span>
                          )}
                          <span className="text-xs text-muted-foreground">{timeAgo}</span>
                        </div>
                        <p className="text-sm leading-relaxed text-foreground/90">{c.content}</p>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          </article>
        )}
      </div>
    </AppLayout>
  );
}
