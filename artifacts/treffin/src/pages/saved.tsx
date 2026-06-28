import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Bookmark, BookOpen, MessageSquare, Trash2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAppContext } from "@/context/app-context";

const typeConfig = {
  article: { icon: BookOpen, label: "Article", color: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
  debate: { icon: MessageSquare, label: "Debate", color: "text-orange-400 bg-orange-400/10 border-orange-400/20" },
  post: { icon: Bookmark, label: "Post", color: "text-indigo-400 bg-indigo-400/10 border-indigo-400/20" },
};

export default function Saved() {
  const { savedItems, removeSaved } = useAppContext();
  const [filter, setFilter] = useState<"all" | "article" | "debate" | "post">("all");
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const filtered = savedItems.filter(i => {
    const matchesType = filter === "all" || i.type === filter;
    const matchesSearch = !search || i.title.toLowerCase().includes(search.toLowerCase()) || i.author.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  const handleRemove = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    removeSaved(id);
    toast({ title: "Removed from saved" });
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 max-w-2xl">
        <div className="flex flex-col gap-4 sticky top-[64px] z-40 bg-background/95 backdrop-blur-sm pt-4 pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Bookmark className="w-6 h-6 text-primary" /> Saved
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">{savedItems.length} saved items</p>
            </div>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 bg-muted/50 border border-border rounded-full px-4 py-2">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Search saved items..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              data-testid="input-search-saved"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-1.5">
            {(["all", "article", "debate", "post"] as const).map(f => (
              <button
                key={f}
                className={cn("text-xs font-semibold px-3 py-1.5 rounded-full capitalize transition-colors", filter === f ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80")}
                onClick={() => setFilter(f)}
                data-testid={`button-filter-${f}`}
              >
                {f === "all" ? `All (${savedItems.length})` : `${f.charAt(0).toUpperCase() + f.slice(1)}s (${savedItems.filter(i => i.type === f).length})`}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
              <Bookmark className="w-7 h-7 text-muted-foreground/40" />
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">
                {search ? `No results for "${search}"` : `No ${filter === "all" ? "saved items" : filter + "s"} yet`}
              </p>
              <p className="text-sm text-muted-foreground">
                {search ? "Try a different search term" : "Save articles, debates, and posts to read them later"}
              </p>
            </div>
            {!search && (
              <button className="text-sm text-primary hover:underline" onClick={() => setLocation("/")}>
                Explore the feed →
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((item) => {
              const { icon: Icon, label, color } = typeConfig[item.type];
              return (
                <div
                  key={item.id}
                  data-testid={`saved-item-${item.id}`}
                  className="bg-card border border-border rounded-xl p-4 flex gap-3 hover:border-primary/30 transition-all cursor-pointer group"
                  onClick={() => setLocation(item.href)}
                >
                  <div className={cn("w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 mt-0.5", color)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className={cn("text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border", color)}>{label}</span>
                        <h3 className="font-semibold text-sm mt-1.5 leading-snug group-hover:text-primary transition-colors line-clamp-2">{item.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.excerpt}</p>
                        <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                          <span>{item.author}</span>
                          <span>·</span>
                          <span>{item.time}</span>
                        </div>
                      </div>
                      <button
                        className="shrink-0 p-1.5 rounded-full hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
                        onClick={(e) => handleRemove(item.id, e)}
                        data-testid={`button-remove-saved-${item.id}`}
                        title="Remove from saved"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
