import { useState } from "react";
import { FeedPost } from "@workspace/api-client-react";
import { formatNumber } from "@/lib/utils";
import { MessageCircle, Heart, Share, Bookmark } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function KnowledgeCard({ post }: { post: FeedPost }) {
  const { toast } = useToast();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [saved, setSaved] = useState(false);

  return (
    <div
      data-testid={`card-knowledge-${post.id}`}
      className="relative overflow-hidden rounded-xl border border-blue-500/20 p-5 hover:border-blue-500/40 transition-all bg-gradient-to-br from-primary/10 via-card to-card"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl pointer-events-none" />
      <div className="relative z-10 flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center text-white font-bold text-xs shadow-[0_0_10px_rgba(249,115,22,0.3)]">
            T
          </div>
          <span className="font-bold text-sm">Treffin Insights</span>
          <svg className="w-3.5 h-3.5 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span className="text-[10px] font-bold text-green-400 bg-green-400/10 px-2 py-0.5 rounded uppercase tracking-wide border border-green-400/20 ml-auto">
            Knowledge
          </span>
        </div>

        <p className="text-[16px] font-semibold leading-snug">{post.content}</p>

        <div className="flex items-center justify-between text-muted-foreground pt-2 border-t border-border/30">
          <div className="flex items-center gap-1">
            <button className="flex items-center gap-1.5 text-[13px] hover:text-blue-400 transition-colors p-1.5 rounded-full hover:bg-blue-400/10" onClick={() => toast({ title: "Replies coming soon" })}>
              <MessageCircle className="w-4 h-4" /><span>{formatNumber(post.comments)}</span>
            </button>
            <button
              className={cn("flex items-center gap-1.5 text-[13px] transition-colors p-1.5 rounded-full hover:bg-red-400/10", liked ? "text-red-400" : "hover:text-red-400")}
              onClick={() => { setLiked(p => !p); setLikeCount(p => liked ? p - 1 : p + 1); }}
            >
              <Heart className={cn("w-4 h-4", liked && "fill-current")} /><span>{formatNumber(likeCount)}</span>
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button className={cn("p-1.5 rounded-full hover:bg-primary/10 transition-colors", saved ? "text-primary" : "hover:text-primary")} onClick={() => { setSaved(p => !p); toast({ title: saved ? "Removed" : "Saved!" }); }}>
              <Bookmark className={cn("w-4 h-4", saved && "fill-current")} />
            </button>
            <button
              className="p-1.5 rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
              onClick={async () => {
                const url = window.location.href;
                if (navigator.share) {
                  try { await navigator.share({ title: "Treffin", text: "Check this out on Treffin — where minds debate.", url }); } catch {}
                } else {
                  navigator.clipboard.writeText(url).catch(() => {});
                  toast({ title: "Link copied!" });
                }
              }}
            >
              <Share className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
