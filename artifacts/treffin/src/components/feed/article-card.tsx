import { useState } from "react";
import { FeedPost } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatNumber } from "@/lib/utils";
import { Bookmark, Clock, Heart, MessageCircle, Users, CheckCircle } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/* Gradient placeholder thumbnails based on topic */
const TOPIC_GRADIENTS: Record<string, string> = {
  "AI": "from-blue-600 to-indigo-700",
  "Philosophy": "from-indigo-600 to-blue-700",
  "Economics": "from-emerald-600 to-teal-700",
  "Technology": "from-cyan-600 to-blue-700",
  "Science": "from-teal-600 to-green-700",
  "Politics": "from-rose-600 to-red-700",
  "Psychology": "from-amber-600 to-orange-700",
  "Culture": "from-pink-600 to-rose-700",
};

const TOPIC_ICONS: Record<string, string> = {
  "AI": "🤖", "Philosophy": "🧠", "Economics": "📈", "Technology": "💻",
  "Science": "🔬", "Politics": "🌍", "Psychology": "💭", "Culture": "🎨",
};

function formatRelativeDate(isoString: string | null | undefined): string {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    const diffMs = Date.now() - date.getTime();
    const mins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMs / 3600000);
    const days = Math.floor(diffMs / 86400000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return isoString;
  }
}

export function ArticleCard({ post }: { post: FeedPost & { id: number; reviewRequestStatus?: string | null; isExpertReviewed?: boolean } }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [saved, setSaved] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes);

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaved((p) => !p);
    toast({ title: saved ? "Removed from saved" : "Article saved!" });
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLiked((p) => !p);
    setLikeCount((p) => (liked ? p - 1 : p + 1));
  };

  const topicGrad = post.topic ? (TOPIC_GRADIENTS[post.topic] ?? "from-indigo-600 to-blue-700") : "from-indigo-600 to-blue-700";
  const topicIcon = post.topic ? (TOPIC_ICONS[post.topic] ?? "📝") : "📝";

  return (
    <div
      data-testid={`card-article-${post.id}`}
      className="bg-card border border-border/60 rounded-xl hover:border-primary/35 hover:shadow-[0_0_20px_rgba(124,58,237,0.08)] transition-all group cursor-pointer overflow-hidden"
      onClick={() => setLocation(`/articles/${post.id}`)}
    >
      <div className="p-4">
        {/* Author row */}
        <div className="flex items-center gap-2 mb-3">
          <Avatar className="w-6 h-6 border border-border/50">
            <AvatarImage src={post.authorAvatar || undefined} />
            <AvatarFallback className="text-[10px] bg-primary/15 text-primary font-bold">
              {post.authorName.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium text-xs">{post.authorName}</span>
          {post.isVerified && (
            <svg className="w-3.5 h-3.5 text-indigo-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          )}
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full uppercase tracking-wide">Article</span>
          {post.topic && (
            <>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">{post.topic}</span>
            </>
          )}
          {post.isExpertReviewed && (
            <span className="flex items-center gap-0.5 text-[10px] font-bold text-green-400 bg-green-400/10 border border-green-400/20 px-1.5 py-0.5 rounded-full">
              <CheckCircle className="w-2.5 h-2.5" /> Reviewed
            </span>
          )}
          {!post.isExpertReviewed && post.reviewRequestStatus === "pending" && (
            <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded-full">
              <Users className="w-2.5 h-2.5" /> Pending Review
            </span>
          )}
        </div>

        {/* Content + Thumbnail */}
        <div className="flex gap-4">
          <div className="flex-1 flex flex-col gap-1.5 min-w-0">
            <h3 className="font-bold text-[15px] leading-snug group-hover:text-primary transition-colors line-clamp-2">
              {post.title}
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
              {post.excerpt}
            </p>
          </div>

          {/* Thumbnail — real image or gradient placeholder */}
          <div className="w-20 h-20 shrink-0 rounded-xl overflow-hidden border border-border/50">
            {post.imageUrl ? (
              <img src={post.imageUrl} alt={post.title || ""} className="w-full h-full object-cover" />
            ) : (
              <div className={cn("w-full h-full bg-gradient-to-br flex items-center justify-center text-2xl", topicGrad)}>
                {topicIcon}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {post.readTime && (
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {post.readTime} min read</span>
            )}
            <span>{formatRelativeDate(post.createdAt)}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              className={cn("flex items-center gap-1 text-xs transition-colors", liked ? "text-rose-400" : "text-muted-foreground hover:text-rose-400")}
              onClick={handleLike}
              data-testid={`button-like-article-${post.id}`}
            >
              <Heart className={cn("w-3.5 h-3.5", liked && "fill-current")} />
              <span>{formatNumber(likeCount)}</span>
            </button>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MessageCircle className="w-3.5 h-3.5" />
              <span>{post.comments ?? 0}</span>
            </span>
            <button
              className={cn("flex items-center gap-1 text-xs font-medium transition-colors", saved ? "text-primary" : "text-muted-foreground hover:text-primary")}
              onClick={handleSave}
              data-testid={`button-save-article-${post.id}`}
            >
              <Bookmark className={cn("w-3.5 h-3.5", saved && "fill-current")} />
              {saved ? "Saved" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
