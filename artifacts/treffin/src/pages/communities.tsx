import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Users, Lock, Globe, Flame, Star, TrendingUp, Crown, ArrowRight, MessageSquare, Plus, Clock } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useGetCommunities, useJoinCommunity, useLeaveCommunity, getGetCommunitiesQueryKey, Community } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateCommunityModal } from "@/components/communities/create-community-modal";
import { useAppContext } from "@/context/app-context";
import { useClerk, useUser } from "@clerk/react";

export default function Communities() {
  const { toast } = useToast();
  const { triggerRep } = useAppContext();
  const [, setLocation] = useLocation();
  const [filter, setFilter] = useState<"all" | "joined">("all");
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useUser();
  const { openSignIn } = useClerk();

  const { data: communities = [], isLoading } = useGetCommunities({
    query: { queryKey: getGetCommunitiesQueryKey() },
  });

  const joinMutation = useJoinCommunity();
  const leaveMutation = useLeaveCommunity();

  const getJoinStatus = (c: Community) => c.joinStatus ?? (c.isMember ? "member" : "none");
  const isJoined = (c: Community) => getJoinStatus(c) === "member";
  const isPending = (c: Community) => getJoinStatus(c) === "pending";

  const displayed = filter === "joined" ? communities.filter(c => isJoined(c)) : communities;
  const joinedCount = communities.filter(c => isJoined(c)).length;

  const totalMembers = communities.reduce((sum, c) => sum + c.memberCount, 0);
  const liveCount = communities.filter(c => c.isLive).length;

  const handleJoin = (e: React.MouseEvent, community: Community) => {
    e.stopPropagation();

    if (!user) {
      openSignIn();
      return;
    }

    if (isJoined(community)) {
      leaveMutation.mutate(
        { id: community.id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetCommunitiesQueryKey() });
            toast({ title: "Left community" });
          },
          onError: () => {
            toast({ title: "Something went wrong", variant: "destructive" });
          },
        }
      );
      return;
    }

    if (isPending(community)) {
      leaveMutation.mutate(
        { id: community.id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetCommunitiesQueryKey() });
            toast({ title: "Request cancelled" });
          },
          onError: () => {
            toast({ title: "Something went wrong", variant: "destructive" });
          },
        }
      );
      return;
    }

    joinMutation.mutate(
      { id: community.id },
      {
        onSuccess: (result) => {
          queryClient.invalidateQueries({ queryKey: getGetCommunitiesQueryKey() });
          const status = result.joinStatus ?? (result.joined ? "member" : "none");
          if (status === "pending") {
            toast({ title: "Request sent!", description: "Your application is under review." });
          } else {
            triggerRep(10, "community");
            toast({ title: "Joined! +10 rep", description: `Welcome to ${community.name}` });
          }
        },
        onError: () => {
          toast({ title: "Something went wrong", variant: "destructive" });
        },
      }
    );
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 sticky top-[60px] z-40 bg-background/95 backdrop-blur-xl py-4 border-b border-border/60">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">Communities</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Find your intellectual tribe</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg treffin-gradient text-white border-transparent hover:opacity-90 transition-all whitespace-nowrap"
              onClick={() => {
                if (!user) {
                  toast({ title: "Sign in required", description: "Please sign in to create a community.", variant: "destructive" });
                  openSignIn();
                  return;
                }
                setShowCreate(true);
              }}
              data-testid="button-create-community"
            >
              <Plus className="w-3.5 h-3.5" /> Create
            </button>
            {(["all", "joined"] as const).map(f => (
              <button
                key={f}
                className={cn("text-xs font-semibold px-4 py-2 rounded-lg transition-colors border whitespace-nowrap", filter === f ? "treffin-gradient text-white border-transparent" : "text-muted-foreground hover:text-foreground bg-muted/60 border-border/50")}
                onClick={() => setFilter(f)}
                data-testid={`button-filter-${f}`}
              >
                {f === "all" ? "All" : "Joined"}
              </button>
            ))}
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: Users, label: "Total Members", value: isLoading ? "—" : formatNumber(totalMembers), color: "text-indigo-400", bg: "bg-indigo-400/10 border-indigo-400/20" },
            { icon: TrendingUp, label: "Live Communities", value: isLoading ? "—" : liveCount.toString(), color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20" },
            { icon: Star, label: "Your Communities", value: joinedCount.toString(), color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/20" },
          ].map(({ icon: Icon, label, value, color, bg }) => (
            <div key={label} className={cn("bg-card border border-border/60 rounded-xl p-4 flex flex-col gap-2 text-center")}>
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mx-auto border", bg)}>
                <Icon className={cn("w-4 h-4", color)} />
              </div>
              <div className="text-xl font-bold">{value}</div>
              <div className="text-[11px] text-muted-foreground leading-tight">{label}</div>
            </div>
          ))}
        </div>

        {/* Community cards */}
        <div className="flex flex-col gap-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))
          ) : displayed.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-semibold">No communities joined yet</p>
              <p className="text-sm mt-1">Browse and join communities that interest you</p>
              <button className="mt-4 text-sm text-primary hover:underline" onClick={() => setFilter("all")}>Browse all communities</button>
            </div>
          ) : (
            displayed.map((community, i) => {
              const joined = isJoined(community);
              const pending = isPending(community);
              return (
                <motion.div
                  key={community.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <div
                    data-testid={`card-community-${community.id}`}
                    className={cn("relative bg-gradient-to-br border rounded-xl p-5 hover:scale-[1.005] hover:shadow-[0_0_24px_rgba(79,70,229,0.1)] transition-all cursor-pointer", community.gradient)}
                    onClick={() => setLocation(`/communities/${community.id}`)}
                  >
                    <div className="flex items-start gap-4">
                      {/* Emoji icon */}
                      <div className="w-12 h-12 rounded-xl bg-white/8 border border-white/10 flex items-center justify-center text-2xl shrink-0">
                        {community.emoji}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-bold text-[15px]">{community.name}</h3>
                          {community.isPrivate && <Lock className="w-3.5 h-3.5 text-yellow-400 shrink-0" />}
                          {community.category === "Exclusive" && <Crown className="w-3.5 h-3.5 text-yellow-400 shrink-0" />}
                          {community.isLive && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-red-400 uppercase tracking-widest">
                              <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" /> Live
                            </span>
                          )}
                          {community.badge && !(community.isLive && community.badge.trim().toLowerCase() === "live") && (
                            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide", community.badgeColor)}>
                              {community.badge}
                            </span>
                          )}
                        </div>

                        <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full uppercase tracking-wide mb-1.5 inline-block">
                          {community.category}
                        </span>
                        <p className="text-sm text-muted-foreground leading-relaxed">{community.description}</p>

                        {/* Stats row */}
                        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5" />
                            <span className="font-medium">{formatNumber(community.memberCount)}</span>
                            <span>members</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span className="font-medium">{formatNumber(community.totalPosts)}</span>
                            <span>posts</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-orange-400">
                            <Flame className="w-3.5 h-3.5" />
                            <span className="font-bold">{community.postsPerDay}/day</span>
                          </div>
                        </div>
                      </div>

                      {/* Action button */}
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <button
                          className={cn(
                            "text-xs font-semibold px-4 py-2 rounded-xl transition-all border",
                            joined
                              ? "bg-muted/50 text-muted-foreground border-border/50 hover:border-destructive/50 hover:text-destructive"
                              : pending
                                ? "bg-yellow-400/10 text-yellow-300 border-yellow-400/30 hover:bg-yellow-400/20"
                                : "treffin-gradient text-white border-transparent hover:opacity-90 treffin-glow"
                          )}
                          onClick={(e) => handleJoin(e, community)}
                          data-testid={`button-join-community-${community.id}`}
                        >
                          {joined ? "Joined ✓" : pending ? (
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Pending</span>
                          ) : community.isPrivate ? "Apply" : "Join"}
                        </button>
                        {joined && (
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            Enter <ArrowRight className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      <AnimatePresence>
        {showCreate && (
          <CreateCommunityModal
            onClose={() => setShowCreate(false)}
            onCreated={(community) => {
              queryClient.invalidateQueries({ queryKey: getGetCommunitiesQueryKey() });
              toast({ title: `${community.name} created!`, description: "Your community is live." });
            }}
          />
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
