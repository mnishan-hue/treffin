import { useState, useRef, useEffect } from "react";
import {
  FeedPost,
  useLikePost,
  useReportPost,
  useRevealPost,
  getGetFeedQueryKey,
  useGetPostComments,
  useCreatePostComment,
  useDeletePostComment,
  useLikePostComment,
  getGetPostCommentsQueryKey,
  useGetCurrentUser,
  getGetCurrentUserQueryKey,
  customFetch,
} from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatNumber } from "@/lib/utils";
import { MessageCircle, Heart, Share, Bookmark, Send, MoreHorizontal, Trash2, Flag, Copy, EyeOff, Eye } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAppContext } from "@/context/app-context";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@clerk/react";

function PostMenu({ postId, isOwner, onDelete, onReported }: { postId: number; isOwner: boolean; onDelete: () => void; onReported: () => void }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const reportMutation = useReportPost();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).catch(() => {});
    toast({ title: "Link copied!" });
    setOpen(false);
  };

  const handleReport = () => {
    setOpen(false);
    reportMutation.mutate(
      { id: postId },
      {
        onSuccess: () => {
          toast({ title: "Post reported", description: "Our team will review it." });
          onReported();
        },
        onError: () => {
          toast({ title: "Couldn't send report", description: "Please try again.", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        onClick={(e) => { e.stopPropagation(); setOpen(p => !p); }}
        data-testid={`button-menu-${postId}`}
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border/80 rounded-xl shadow-xl shadow-black/30 overflow-hidden min-w-[160px]"
          >
            <button
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors text-left"
              onClick={handleCopyLink}
            >
              <Copy className="w-3.5 h-3.5 shrink-0" /> Copy link
            </button>
            {!isOwner && (
              <button
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors text-left"
                onClick={handleReport}
              >
                <Flag className="w-3.5 h-3.5 shrink-0" /> Report post
              </button>
            )}
            {isOwner && (
              <>
                <div className="h-px bg-border/50 mx-2" />
                <button
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors text-left"
                  onClick={() => { setOpen(false); onDelete(); }}
                  data-testid={`button-delete-post-${postId}`}
                >
                  <Trash2 className="w-3.5 h-3.5 shrink-0" /> Delete post
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function PostCard({ post: initialPost, onInteraction }: { post: FeedPost; onInteraction?: () => void }) {
  const { toggleSaved, isSaved, triggerRep } = useAppContext();
  const { user } = useUser();
  const [post, setPost] = useState(initialPost);
  const [liked, setLiked] = useState(initialPost.liked ?? false);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [showComments, setShowComments] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [commentLikes, setCommentLikes] = useState<Record<number, boolean>>({});
  const [commentLikeCounts, setCommentLikeCounts] = useState<Record<number, number>>({});
  const [deleted, setDeleted] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const likePost = useLikePost();
  const revealPost = useRevealPost();
  const { data: currentUserProfile } = useGetCurrentUser({
    query: { enabled: !!user, queryKey: getGetCurrentUserQueryKey() },
  });
  const saved = isSaved(post.id);
  const isOwner = post.isOwner ?? false;
  const isAnonymous = post.isAnonymous ?? false;

  const authorName = user?.firstName
    ? `${user.firstName}${user.lastName ? " " + user.lastName : ""}`
    : "You";
  const authorId = currentUserProfile?.id ?? 0;

  const { data: comments = [], isLoading: commentsLoading } = useGetPostComments(post.id, {
    query: { queryKey: getGetPostCommentsQueryKey(post.id), enabled: showComments },
  });

  const createComment = useCreatePostComment();
  const deleteComment = useDeletePostComment();
  const likePostComment = useLikePostComment();

  useEffect(() => {
    if (showComments) setTimeout(() => inputRef.current?.focus(), 80);
  }, [showComments]);

  useEffect(() => {
    if (comments.length === 0) return;
    setCommentLikes(prev => {
      const next = { ...prev };
      for (const c of comments) { next[c.id] = c.likedByMe ?? false; }
      return next;
    });
    setCommentLikeCounts(prev => {
      const next = { ...prev };
      for (const c of comments) { next[c.id] = c.likes ?? 0; }
      return next;
    });
  }, [comments]);

  const handleLike = () => {
    setLiked(prev => !prev);
    setLikeCount(prev => liked ? prev - 1 : prev + 1);
    if (!liked) triggerRep(5, "like");
    likePost.mutate(
      { id: post.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetFeedQueryKey() });
          onInteraction?.();
        },
        onError: () => {
          setLiked(prev => !prev);
          setLikeCount(prev => liked ? prev + 1 : prev - 1);
        },
      }
    );
  };

  const handleSave = () => {
    toggleSaved({
      id: post.id,
      type: "post",
      title: (post.content ?? "").substring(0, 60) + ((post.content ?? "").length > 60 ? "..." : ""),
      excerpt: (post.content ?? "").substring(0, 120),
      author: post.authorName,
      time: post.createdAt,
      href: "/",
    });
    toast({ title: saved ? "Removed from saved" : "Saved!", description: saved ? "" : "Post added to your saved items." });
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: post.authorName ? `${post.authorName} on Treffin` : "Treffin", text: post.content?.slice(0, 100) ?? "Check this out on Treffin, where minds debate.", url });
      } catch {}
    } else {
      navigator.clipboard.writeText(url).catch(() => {});
      toast({ title: "Link copied!", description: "Share link copied to clipboard." });
    }
  };

  const handleReveal = () => {
    revealPost.mutate(
      { id: post.id },
      {
        onSuccess: (updated) => {
          setPost(updated);
          queryClient.invalidateQueries({ queryKey: getGetFeedQueryKey() });
          toast({ title: "Identity revealed!", description: "Your name is now visible to everyone." });
        },
        onError: () => toast({ title: "Couldn't reveal identity", variant: "destructive" }),
      }
    );
  };

  const handleAddComment = () => {
    if (!commentInput.trim()) return;
    createComment.mutate(
      { id: post.id, data: { authorId, authorName, content: commentInput.trim() } },
      {
        onSuccess: () => {
          setCommentInput("");
          setPost(prev => ({ ...prev, comments: prev.comments + 1 }));
          queryClient.invalidateQueries({ queryKey: getGetPostCommentsQueryKey(post.id) });
          queryClient.invalidateQueries({ queryKey: getGetFeedQueryKey() });
          triggerRep(5, "comment");
          toast({ title: "Comment posted!" });
          onInteraction?.();
        },
        onError: () => toast({ title: "Failed to post comment", variant: "destructive" }),
      }
    );
  };

  const handleDeleteComment = (commentId: number) => {
    deleteComment.mutate(
      { id: post.id, commentId },
      {
        onSuccess: () => {
          setPost(prev => ({ ...prev, comments: Math.max(0, prev.comments - 1) }));
          queryClient.invalidateQueries({ queryKey: getGetPostCommentsQueryKey(post.id) });
          queryClient.invalidateQueries({ queryKey: getGetFeedQueryKey() });
          toast({ title: "Comment removed" });
          onInteraction?.();
        },
        onError: () => toast({ title: "Couldn't remove comment", variant: "destructive" }),
      }
    );
  };

  const handleCommentLike = (id: number) => {
    const wasLiked = commentLikes[id] ?? false;
    setCommentLikes(prev => ({ ...prev, [id]: !wasLiked }));
    setCommentLikeCounts(prev => ({ ...prev, [id]: (prev[id] ?? 0) + (wasLiked ? -1 : 1) }));
    likePostComment.mutate(
      { id: post.id, commentId: id },
      {
        onSuccess: (data) => {
          setCommentLikes(prev => ({ ...prev, [id]: data.liked }));
          setCommentLikeCounts(prev => ({ ...prev, [id]: data.likes }));
        },
        onError: () => {
          setCommentLikes(prev => ({ ...prev, [id]: wasLiked }));
          setCommentLikeCounts(prev => ({ ...prev, [id]: (prev[id] ?? 0) + (wasLiked ? 1 : -1) }));
        },
      }
    );
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await customFetch(`/api/posts/${post.id}`, { method: "DELETE" });
      setDeleted(true);
      queryClient.invalidateQueries({ queryKey: getGetFeedQueryKey() });
      onInteraction?.();
      toast({ title: "Post deleted", description: "Your post has been removed." });
    } catch {
      setDeleting(false);
      toast({ title: "Couldn't delete", description: "Something went wrong. Please try again.", variant: "destructive" });
    }
  };

  const totalComments = post.comments;

  const [reported, setReported] = useState(false);

  if (deleted || reported) {
    return (
      <motion.div
        initial={{ opacity: 1, height: "auto" }}
        animate={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.25 }}
      />
    );
  }

  return (
    <motion.div
      layout
      data-testid={`card-post-${post.id}`}
      className={cn(
        "bg-card border border-border/60 rounded-xl hover:border-primary/35 hover:shadow-[0_0_20px_rgba(124,58,237,0.08)] transition-all group",
        deleting && "opacity-50 pointer-events-none"
      )}
    >
      <div className="p-4">
        <div className="flex gap-3">
          <div className="relative shrink-0">
            <Avatar className={cn("w-10 h-10 border border-border/60", isAnonymous && "opacity-50")}>
              {!isAnonymous && <AvatarImage src={post.authorAvatar || undefined} />}
              <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">
                {isAnonymous ? "?" : post.authorName.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {isAnonymous && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-muted/70">
                <EyeOff className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold text-[15px]">{post.authorName}</span>
              {!isAnonymous && post.isVerified && (
                <svg className="w-4 h-4 text-indigo-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              )}
              {isOwner && (
                <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full">You</span>
              )}
              {isAnonymous && isOwner && (
                <span className="text-[10px] font-medium text-muted-foreground bg-muted/60 border border-border/40 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                  <EyeOff className="w-2.5 h-2.5" /> Anonymous
                </span>
              )}
              {!isAnonymous && <span className="text-xs text-muted-foreground">{post.authorTitle}</span>}
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">{post.createdAt}</span>
              <div className="ml-auto flex items-center gap-1.5">
                {isOwner && isAnonymous && (
                  <button
                    className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-primary border border-border/50 hover:border-primary/40 px-2 py-0.5 rounded-full transition-all"
                    onClick={handleReveal}
                    disabled={revealPost.isPending}
                    data-testid={`button-reveal-${post.id}`}
                    title="Reveal your identity on this post"
                  >
                    <Eye className="w-3 h-3" />
                    {revealPost.isPending ? "Revealing..." : "Reveal"}
                  </button>
                )}
                <PostMenu postId={post.id} isOwner={isOwner} onDelete={handleDelete} onReported={() => setReported(true)} />
              </div>
            </div>

            <div className="mt-2">
              {post.topic && (
                <span className="inline-block text-[11px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full mb-2 uppercase tracking-wide">
                  {post.topic}
                </span>
              )}
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{post.content}</p>
            </div>

            <div className="flex items-center justify-between mt-4 text-muted-foreground max-w-sm">
              <button
                className="flex items-center gap-1.5 text-[13px] hover:text-indigo-400 transition-colors"
                onClick={() => setShowComments(p => !p)}
                data-testid={`button-comment-${post.id}`}
              >
                <div className={cn("p-1.5 rounded-lg hover:bg-indigo-400/10 transition-colors", showComments && "text-indigo-400")}>
                  <MessageCircle className="w-4 h-4" />
                </div>
                <span>{formatNumber(totalComments)}</span>
              </button>
              <button
                className={cn("flex items-center gap-1.5 text-[13px] transition-colors", liked ? "text-rose-500" : "hover:text-rose-400")}
                onClick={handleLike}
                data-testid={`button-like-${post.id}`}
              >
                <div className="p-1.5 rounded-lg hover:bg-rose-400/10 transition-colors">
                  <Heart className={cn("w-4 h-4", liked && "fill-current")} />
                </div>
                <span>{formatNumber(likeCount)}</span>
              </button>
              <button
                className={cn("flex items-center gap-1.5 text-[13px] transition-colors", saved ? "text-primary" : "hover:text-primary")}
                onClick={handleSave}
                data-testid={`button-save-${post.id}`}
              >
                <div className="p-1.5 rounded-lg hover:bg-primary/10 transition-colors">
                  <Bookmark className={cn("w-4 h-4", saved && "fill-current")} />
                </div>
              </button>
              <button
                className="flex items-center gap-1.5 text-[13px] hover:text-primary transition-colors"
                onClick={handleShare}
                data-testid={`button-share-${post.id}`}
              >
                <div className="p-1.5 rounded-lg hover:bg-primary/10 transition-colors">
                  <Share className="w-4 h-4" />
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/50 px-4 py-3 flex flex-col gap-3 bg-muted/20 rounded-b-xl">
              {/* Input row */}
              <div className="flex gap-2 items-center">
                <Avatar className="w-7 h-7 shrink-0 border border-border/50">
                  <AvatarImage src={user?.imageUrl} />
                  <AvatarFallback className="text-[10px] bg-primary/15 text-primary">
                    {authorName.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 flex items-center gap-2 bg-background/60 border border-border/60 rounded-xl px-3 py-1.5 focus-within:border-primary/50 transition-colors">
                  <input
                    ref={inputRef}
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                    placeholder="Share your thoughts..."
                    value={commentInput}
                    onChange={e => setCommentInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAddComment()}
                    data-testid={`input-comment-${post.id}`}
                  />
                  <button
                    className={cn("p-1 rounded-lg transition-colors shrink-0", commentInput.trim() && !createComment.isPending ? "text-primary hover:bg-primary/10" : "text-muted-foreground/40 cursor-default")}
                    onClick={handleAddComment}
                    disabled={!commentInput.trim() || createComment.isPending}
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Comments list */}
              {commentsLoading ? (
                <div className="flex flex-col gap-2">
                  {[1, 2].map(i => (
                    <div key={i} className="flex gap-2.5 animate-pulse">
                      <div className="w-7 h-7 rounded-full bg-muted/60 shrink-0" />
                      <div className="flex-1 h-12 rounded-xl bg-muted/40" />
                    </div>
                  ))}
                </div>
              ) : comments.length === 0 ? (
                <p className="text-xs text-muted-foreground/60 text-center py-2 italic">
                  Be the first to share your thoughts
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  <AnimatePresence initial={false}>
                    {comments.map(c => {
                      const isOwnComment = c.authorId === authorId;
                      const timeAgo = (() => {
                        const diff = Date.now() - new Date(c.createdAt).getTime();
                        const mins = Math.floor(diff / 60000);
                        const hours = Math.floor(diff / 3600000);
                        if (mins < 1) return "Just now";
                        if (hours < 1) return `${mins}m ago`;
                        return `${hours}h ago`;
                      })();
                      return (
                        <motion.div
                          key={c.id}
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -10, height: 0 }}
                          transition={{ duration: 0.18 }}
                          className="flex gap-2.5 group/comment"
                        >
                          <Avatar className="w-7 h-7 shrink-0 mt-0.5">
                            <AvatarFallback className="text-[10px]">
                              {c.authorName.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="bg-muted/40 rounded-xl px-3 py-2">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-semibold">{isOwnComment ? "You" : c.authorName}</span>
                                  <span className="text-[10px] text-muted-foreground">{timeAgo}</span>
                                </div>
                                {isOwnComment && (
                                  <button
                                    className="opacity-0 group-hover/comment:opacity-100 p-0.5 rounded text-muted-foreground hover:text-destructive transition-all"
                                    onClick={() => handleDeleteComment(c.id)}
                                    title="Delete comment"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                              <p className="text-sm leading-snug">{c.content}</p>
                            </div>
                            <div className="flex items-center gap-3 mt-1 px-1">
                              <button
                                className={cn("flex items-center gap-1 text-[11px] transition-colors", commentLikes[c.id] ? "text-rose-400" : "text-muted-foreground hover:text-rose-400")}
                                onClick={() => handleCommentLike(c.id)}
                              >
                                <Heart className={cn("w-3 h-3", commentLikes[c.id] && "fill-current")} />
                                {commentLikeCounts[c.id] ?? c.likes ?? 0}
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
