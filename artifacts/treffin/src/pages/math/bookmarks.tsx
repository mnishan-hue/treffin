import {
  useGetMathBookmarks,
  useRemoveMathBookmark,
  getGetMathBookmarksQueryKey,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { BookMarked, Trash2, ExternalLink } from "lucide-react";
import { getMathUserId } from "@/lib/math-auth";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { MathText } from "@/components/math/math-renderer";
import { AppLayout } from "@/components/layout/app-layout";

export default function Bookmarks() {
  const userId = getMathUserId();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: bookmarks, isLoading } = useGetMathBookmarks({
    query: {
      queryKey: getGetMathBookmarksQueryKey(),
      enabled: !!userId,
    },
  });

  const remove = useRemoveMathBookmark();

  const handleRemove = (problemId: number) => {
    if (!userId) return;
    remove.mutate(
      { problemId },
      {
        onSuccess: () => {
          toast({ title: "Bookmark removed" });
          queryClient.invalidateQueries({ queryKey: getGetMathBookmarksQueryKey() });
        },
      },
    );
  };

  if (!userId) {
    return (
      <AppLayout>
      <div className="container mx-auto px-4 py-24 text-center">
        <BookMarked className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
        <h1 className="text-2xl font-serif font-bold mb-3">Your Bookmarks</h1>
        <p className="text-muted-foreground mb-6">Sign in to bookmark and save problems</p>
        <Link href="/sign-in" className="bg-primary text-primary-foreground hover:bg-primary/90 px-5 py-2 rounded-lg font-medium transition-colors">
          Sign in
        </Link>
      </div>
      </AppLayout>
    );
  }

  const grouped = bookmarks
    ? bookmarks.reduce<Record<string, typeof bookmarks>>(
        (acc, b) => {
          const list = b.listName ?? "Default";
          acc[list] = [...(acc[list] ?? []), b];
          return acc;
        },
        {},
      )
    : {};

  return (
    <AppLayout>
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <div className="mb-8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <BookMarked className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-serif font-bold">My Bookmarks</h1>
          <p className="text-sm text-muted-foreground">{bookmarks?.length ?? 0} saved problems</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : bookmarks && bookmarks.length > 0 ? (
        <div className="space-y-8">
          {Object.entries(grouped).map(([listName, items]) => (
            <section key={listName}>
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">
                {listName} <span className="text-muted-foreground/50 ml-1">({items.length})</span>
              </h2>
              <div className="space-y-2">
                {items.map((bookmark) => (
                  <div
                    key={bookmark.id}
                    className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 group hover:border-primary/30 transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      {bookmark.problem ? (
                        <>
                          <div className="font-medium text-foreground mb-1 font-serif">
                            <MathText text={bookmark.problem.title} />
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="capitalize">{bookmark.problem.difficulty}</span>
                            <span>·</span>
                            <span>{new Date(bookmark.createdAt).toLocaleDateString()}</span>
                          </div>
                          {bookmark.note && (
                            <p className="text-sm text-muted-foreground mt-1 italic">{bookmark.note}</p>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">Problem #{bookmark.problemId}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {bookmark.problem && (
                        <Link href={`/math/problem/${bookmark.problemId}`}>
                          <button className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </Link>
                      )}
                      <button
                        onClick={() => handleRemove(bookmark.problemId)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="bg-card/30 border border-dashed border-border rounded-2xl p-8 sm:p-16 text-center">
          <BookMarked className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground text-lg">No bookmarks yet</p>
          <p className="text-sm text-muted-foreground/60 mt-1">
            Click the bookmark icon on any problem to save it here.
          </p>
          <Button variant="outline" className="mt-6" asChild>
            <Link href="/math">Browse Problems</Link>
          </Button>
        </div>
      )}
    </div>
    </AppLayout>
  );
}
