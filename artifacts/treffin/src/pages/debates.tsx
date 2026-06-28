import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useGetDebates, useCreateDebate, getGetDebatesQueryKey, useGetTopics } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Users, Flame, Plus, X, Search } from "lucide-react";
import { CategoryPill } from "@/components/debate/category-pill";
import { CountdownChip } from "@/components/debate/countdown-chip";
import { formatNumber } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function Debates() {
  const { data: debates, isLoading } = useGetDebates();
  const { data: topicsData } = useGetTopics();
  const categories = ["All", ...(topicsData?.map(t => t.name) ?? [])];
  const createDebate = useCreateDebate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCat, setNewCat] = useState("Artificial Intelligence");

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    createDebate.mutate(
      { data: { title: newTitle.trim(), description: newDesc.trim(), category: newCat } },
      {
        onSuccess: () => {
          setShowCreate(false);
          setNewTitle("");
          setNewDesc("");
          queryClient.invalidateQueries({ queryKey: getGetDebatesQueryKey() });
          toast({ title: "Debate created!", description: "Your debate is now live in the arena." });
        },
        onError: () => toast({ title: "Failed to create debate", variant: "destructive" }),
      }
    );
  };

  const filtered = debates
    ?.filter(d => {
      const matchCat = category === "All" || d.category === category;
      const matchSearch = !search || d.title.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    })
    .sort((a, b) => {
      if (a.isTrending && !b.isTrending) return -1;
      if (!a.isTrending && b.isTrending) return 1;
      if (a.isFeatured && !b.isFeatured) return -1;
      if (!a.isFeatured && b.isFeatured) return 1;
      return 0;
    });

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between sticky top-[88px] z-40 bg-background/95 backdrop-blur-sm pb-4 border-b border-border">
          <div>
            <h1 className="text-2xl font-bold">Debate Arena</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Where ideas are tested, challenged, and refined</p>
          </div>
          <button
            className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white font-semibold px-3 sm:px-4 py-2 rounded-full text-sm shadow-[0_0_15px_rgba(37,99,235,0.3)] transition-all hover:-translate-y-0.5 whitespace-nowrap shrink-0"
            onClick={() => setShowCreate(true)}
            data-testid="button-start-debate"
          >
            <Plus className="w-4 h-4" /> <span className="hidden xs:inline">Start </span>Debate
          </button>
        </div>

        {/* Create debate dialog */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-lg">Start a New Debate</h2>
                <button className="p-1.5 rounded-full hover:bg-muted transition-colors" onClick={() => setShowCreate(false)} data-testid="button-close-dialog">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Debate Topic *</label>
                  <input
                    className="bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground"
                    placeholder="E.g. Should universal basic income be implemented?"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    data-testid="input-debate-title"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</label>
                  <textarea
                    className="bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground resize-none"
                    placeholder="Provide context for your debate topic..."
                    rows={3}
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    data-testid="input-debate-desc"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Category</label>
                  <select
                    className="bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary appearance-none"
                    value={newCat}
                    onChange={(e) => setNewCat(e.target.value)}
                    data-testid="select-debate-category"
                  >
                    {categories.filter(c => c !== "All").map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-colors" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button
                  className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                  onClick={handleCreate}
                  disabled={!newTitle.trim() || createDebate.isPending}
                  data-testid="button-create-debate"
                >
                  {createDebate.isPending ? "Creating..." : "Launch Debate"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search debates..."
            className="w-full bg-muted/50 border border-border rounded-full pl-10 pr-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-debates"
          />
        </div>

        {/* Category filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mb-1 scrollbar-none">
          {categories.map(c => (
            <button
              key={c}
              className={cn("text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap transition-colors shrink-0", category === c ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground bg-muted")}
              onClick={() => setCategory(c)}
              data-testid={`filter-category-${c}`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Debates list */}
        <div className="flex flex-col gap-3">
          {isLoading ? (
            Array(5).fill(0).map((_, i) => <Skeleton key={i} className="w-full h-[140px] rounded-xl" />)
          ) : !filtered?.length ? (
            <div className="text-center text-muted-foreground py-16">No debates found for this filter.</div>
          ) : (
            filtered.map(debate => (
              <Link key={debate.id} href={`/debates/${debate.id}`}>
                <div
                  data-testid={`card-debate-${debate.id}`}
                  className="bg-card border border-border rounded-xl p-5 hover:border-primary/50 hover:shadow-[0_0_15px_rgba(37,99,235,0.05)] cursor-pointer transition-all group"
                >
                  <div className="flex justify-between items-start mb-3 gap-2 flex-wrap">
                    <CategoryPill category={debate.category} />
                    <div className="flex items-center gap-1.5 ml-auto">
                      <CountdownChip endsAt={debate.endsAt} />
                      {debate.isLive && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-red-400 uppercase tracking-widest">
                          <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" /> Live Now
                        </span>
                      )}
                    </div>
                  </div>
                  <h3 className="font-bold text-base group-hover:text-primary transition-colors">{debate.title}</h3>
                  {debate.description && (
                    <p className="text-sm text-muted-foreground line-clamp-1 mt-1">{debate.description}</p>
                  )}
                  <div className="flex flex-col gap-2 mt-4">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-indigo-400">Support {debate.supportPercent}%</span>
                      <span className="text-rose-400">Against {debate.againstPercent}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden flex">
                      <div className="h-full bg-indigo-500" style={{ width: `${debate.supportPercent}%` }} />
                      <div className="h-full bg-rose-500" style={{ width: `${debate.againstPercent}%` }} />
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Users className="w-3.5 h-3.5" /> {formatNumber(debate.participantCount)} participants
                      {debate.isLive && <Flame className="w-3.5 h-3.5 text-orange-400 ml-auto" />}
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}
