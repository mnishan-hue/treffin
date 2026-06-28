import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCreatePost, getGetFeedQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { useToast } from "@/hooks/use-toast";
import { EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppContext } from "@/context/app-context";

export function PostComposer() {
  const [content, setContent] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createPost = useCreatePost();
  const { triggerRep } = useAppContext();

  const handlePost = () => {
    if (!content.trim()) return;
    createPost.mutate(
      { data: { content: content.trim(), type: "opinion", isAnonymous } },
      {
        onSuccess: () => {
          setContent("");
          setIsAnonymous(false);
          queryClient.invalidateQueries({ queryKey: getGetFeedQueryKey() });
          if (!isAnonymous) triggerRep(10, "post");
          toast({
            title: isAnonymous ? "Posted anonymously!" : "Posted! +10 rep",
            description: isAnonymous
              ? "Your thought is live — your identity is hidden."
              : "Your thought is now live.",
          });
        },
        onError: () => toast({ title: "Failed to post", variant: "destructive" }),
      }
    );
  };

  const initials = user?.firstName
    ? `${user.firstName[0]}${user.lastName?.[0] ?? ""}`.toUpperCase()
    : "T";

  return (
    <div className="bg-card/50 backdrop-blur-md border border-border rounded-xl p-4">
      <div className="flex gap-3">
        <div className="relative shrink-0">
          <Avatar className={cn("w-10 h-10 border border-border transition-all", isAnonymous && "opacity-30")}>
            <AvatarImage src={isAnonymous ? undefined : user?.imageUrl} />
            <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
              {isAnonymous ? "?" : initials}
            </AvatarFallback>
          </Avatar>
          {isAnonymous && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-muted/80 border border-border">
              <EyeOff className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="flex-1 flex flex-col gap-3">
          <textarea
            placeholder="What's on your mind? Share your thoughts, debate a topic..."
            className="w-full bg-transparent resize-none text-[15px] outline-none placeholder:text-muted-foreground min-h-[56px] pt-1"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && e.metaKey) handlePost(); }}
            data-testid="input-post-content"
          />
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIsAnonymous(p => !p)}
              className={cn(
                "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all",
                isAnonymous
                  ? "bg-muted/80 border-primary/40 text-primary"
                  : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
              )}
              data-testid="toggle-anonymous"
            >
              <EyeOff className="w-3.5 h-3.5" />
              {isAnonymous ? "Posting anonymously" : "Post anonymously"}
            </button>
            <button
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-5 py-1.5 rounded-full text-sm transition-all shadow-[0_0_10px_rgba(37,99,235,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handlePost}
              disabled={!content.trim() || createPost.isPending}
              data-testid="button-post"
            >
              {createPost.isPending ? "Posting..." : "Post"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
