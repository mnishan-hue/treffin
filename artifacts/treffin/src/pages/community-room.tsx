import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import {
  useGetCommunity,
  useGetCommunityPosts,
  useJoinCommunity,
  useLeaveCommunity,
  useCreateCommunityPost,
  useUpdateCommunityRules,
  useGetCurrentUser,
  useGetCommunityJoinRequests,
  useApproveCommunityJoinRequest,
  useDenyCommunityJoinRequest,
  getGetCommunityQueryKey,
  getGetCommunityPostsQueryKey,
  getGetCurrentUserQueryKey,
  getGetCommunitiesQueryKey,
  getGetCommunityJoinRequestsQueryKey,
  PostInputType,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, formatNumber } from "@/lib/utils";
import {
  ArrowLeft,
  Users,
  Flame,
  Lock,
  Globe,
  Crown,
  Send,
  MessageSquare,
  Shield,
  Pencil,
  Plus,
  Trash2,
  Check,
  X,
  Clock,
  UserCheck,
  UserX,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { PostCard } from "@/components/feed/post-card";
import { motion, AnimatePresence } from "framer-motion";
import { useUser, useClerk } from "@clerk/react";

const DEFAULT_RULES = [
  "Be respectful and constructive",
  "Back claims with evidence",
  "No personal attacks",
  "Stay on topic",
  "Quality over quantity",
];

const POST_TYPES = [
  { value: "opinion", label: "Opinion" },
  { value: "knowledge", label: "Knowledge" },
  { value: "debate", label: "Debate" },
  { value: "article", label: "Article" },
];

const POST_TOPICS = [
  "General", "Technology", "Science", "Philosophy", "Politics",
  "Culture", "Economics", "Health", "Education", "Environment",
];

type Tab = "Posts" | "Members" | "About" | "Requests";

export default function CommunityRoom() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const communityId = Number(id);
  const { user } = useUser();
  const { openSignIn } = useClerk();

  const [activeTab, setActiveTab] = useState<Tab>("Posts");
  const [postContent, setPostContent] = useState("");
  const [postType, setPostType] = useState<PostInputType>(PostInputType.opinion);
  const [postTopic, setPostTopic] = useState("");
  const [editingRules, setEditingRules] = useState(false);
  const [draftRules, setDraftRules] = useState<string[]>([]);

  const { data: community, isLoading } = useGetCommunity(communityId, {
    query: {
      enabled: !!communityId,
      queryKey: getGetCommunityQueryKey(communityId),
    },
  });

  const { data: posts = [], isLoading: postsLoading } = useGetCommunityPosts(communityId, {
    query: {
      enabled: !!communityId && activeTab === "Posts",
      queryKey: getGetCommunityPostsQueryKey(communityId),
    },
  });

  const joinMutation = useJoinCommunity();
  const leaveMutation = useLeaveCommunity();
  const createPostMutation = useCreateCommunityPost();
  const updateRulesMutation = useUpdateCommunityRules();
  const approveMutation = useApproveCommunityJoinRequest();
  const denyMutation = useDenyCommunityJoinRequest();

  const { data: currentUserProfile } = useGetCurrentUser({
    query: { enabled: !!user, queryKey: getGetCurrentUserQueryKey() },
  });

  const isCreator = !!(currentUserProfile && community?.creatorId && String(currentUserProfile.id) === String(community.creatorId));

  const joinStatus = community?.joinStatus ?? (community?.isMember ? "member" : "none");
  const joined = joinStatus === "member";
  const pending = joinStatus === "pending";

  const { data: joinRequests = [] } = useGetCommunityJoinRequests(communityId, {
    query: {
      enabled: isCreator && !!community?.isPrivate && activeTab === "Requests",
      queryKey: getGetCommunityJoinRequestsQueryKey(communityId),
    },
  });

  const liveRules = community?.rules && community.rules.length > 0 ? community.rules : DEFAULT_RULES;

  const startEditingRules = () => {
    setDraftRules([...liveRules]);
    setEditingRules(true);
  };

  const saveRules = () => {
    const cleaned = draftRules.map((r) => r.trim()).filter(Boolean);
    if (!cleaned.length) return;
    updateRulesMutation.mutate(
      { id: communityId, data: { rules: cleaned } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCommunityQueryKey(communityId) });
          setEditingRules(false);
          toast({ title: "Rules updated!" });
        },
        onError: () => toast({ title: "Failed to save rules", variant: "destructive" }),
      }
    );
  };

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getGetCommunityQueryKey(communityId) });
    queryClient.invalidateQueries({ queryKey: getGetCommunitiesQueryKey() });
  };

  const handleJoinLeave = () => {
    if (!user) {
      openSignIn();
      return;
    }

    if (pending) {
      leaveMutation.mutate(
        { id: communityId },
        {
          onSuccess: () => {
            invalidateAll();
            toast({ title: "Request cancelled" });
          },
          onError: () => toast({ title: "Something went wrong", variant: "destructive" }),
        }
      );
      return;
    }

    if (joined) {
      leaveMutation.mutate(
        { id: communityId },
        {
          onSuccess: () => {
            invalidateAll();
            toast({ title: `Left ${community?.name}` });
          },
          onError: () => toast({ title: "Something went wrong", variant: "destructive" }),
        }
      );
    } else {
      joinMutation.mutate(
        { id: communityId },
        {
          onSuccess: (result) => {
            invalidateAll();
            const status = result.joinStatus ?? (result.joined ? "member" : "none");
            if (status === "pending") {
              toast({ title: "Request sent!", description: "Your application is under review." });
            } else {
              toast({ title: `Joined ${community?.name}!` });
            }
          },
          onError: () => toast({ title: "Something went wrong", variant: "destructive" }),
        }
      );
    }
  };

  const handlePost = () => {
    if (!postContent.trim()) return;
    createPostMutation.mutate(
      { id: communityId, data: { content: postContent.trim(), type: postType, topic: postTopic || undefined } },
      {
        onSuccess: () => {
          setPostContent("");
          setPostTopic("");
          queryClient.invalidateQueries({ queryKey: getGetCommunityPostsQueryKey(communityId) });
          queryClient.invalidateQueries({ queryKey: getGetCommunityQueryKey(communityId) });
          queryClient.invalidateQueries({ queryKey: getGetCommunitiesQueryKey() });
          toast({ title: "Posted!", description: "Your post is live in this community." });
        },
        onError: () => {
          toast({ title: "Failed to post", variant: "destructive" });
        },
      }
    );
  };

  const handleCommunityInteraction = () => {
    queryClient.invalidateQueries({ queryKey: getGetCommunityPostsQueryKey(communityId) });
    queryClient.invalidateQueries({ queryKey: getGetCommunityQueryKey(communityId) });
  };

  const handleApprove = (userId: number) => {
    approveMutation.mutate(
      { id: communityId, userId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCommunityJoinRequestsQueryKey(communityId) });
          queryClient.invalidateQueries({ queryKey: getGetCommunityQueryKey(communityId) });
          toast({ title: "Request approved!" });
        },
        onError: () => toast({ title: "Failed to approve", variant: "destructive" }),
      }
    );
  };

  const handleDeny = (userId: number) => {
    denyMutation.mutate(
      { id: communityId, userId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCommunityJoinRequestsQueryKey(communityId) });
          toast({ title: "Request denied" });
        },
        onError: () => toast({ title: "Failed to deny", variant: "destructive" }),
      }
    );
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex flex-col gap-6">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_296px] gap-6">
            <div className="space-y-4">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
            </div>
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!community) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <p className="text-muted-foreground text-lg">Community not found</p>
          <button onClick={() => setLocation("/communities")} className="text-primary hover:underline text-sm">
            ← Back to communities
          </button>
        </div>
      </AppLayout>
    );
  }

  const topContributors = community.members.slice(0, 3);
  const tabs: Tab[] = ["Posts", "Members", "About", ...(isCreator && community.isPrivate ? ["Requests" as Tab] : [])];

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        {/* Back link */}
        <button
          onClick={() => setLocation("/communities")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
          data-testid="button-back-communities"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Communities
        </button>

        {/* Hero header */}
        <div className={cn("relative bg-gradient-to-br border rounded-2xl overflow-hidden", community.gradient)}>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/30 pointer-events-none" />
          <div className="relative p-6 sm:p-8 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-4xl shadow-lg">
                  {community.emoji}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h1 className="text-2xl font-bold">{community.name}</h1>
                    {community.isPrivate ? (
                      <Lock className="w-4 h-4 text-yellow-400" />
                    ) : (
                      <Globe className="w-4 h-4 text-emerald-400" />
                    )}
                    {community.category === "Exclusive" && <Crown className="w-4 h-4 text-yellow-400" />}
                    {community.isLive && (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-red-400 uppercase tracking-widest">
                        <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" /> Live
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-bold text-primary bg-primary/15 border border-primary/25 px-2.5 py-0.5 rounded-full uppercase tracking-wide">
                    {community.category}
                  </span>
                </div>
              </div>

              <button
                onClick={handleJoinLeave}
                disabled={joinMutation.isPending || leaveMutation.isPending}
                className={cn(
                  "font-semibold px-6 py-2.5 rounded-xl transition-all border text-sm",
                  joined
                    ? "bg-muted/50 text-muted-foreground border-border/50 hover:border-destructive/50 hover:text-destructive"
                    : pending
                      ? "bg-yellow-400/10 text-yellow-300 border-yellow-400/30 hover:bg-yellow-400/20"
                      : "treffin-gradient text-white border-transparent hover:opacity-90 treffin-glow"
                )}
                data-testid="button-join-leave-community"
              >
                {joined ? "Joined ✓" : pending ? (
                  <span className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> Pending</span>
                ) : community.isPrivate ? "Apply to Join" : "Join Community"}
              </button>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-5 text-sm text-white/80 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                <span className="font-semibold">{formatNumber(community.memberCount)}</span>
                <span className="text-white/60">members</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4" />
                <span className="font-semibold">{formatNumber(community.totalPosts)}</span>
                <span className="text-white/60">posts</span>
              </div>
              <div className="flex items-center gap-1.5 text-orange-300">
                <Flame className="w-4 h-4" />
                <span className="font-semibold">{community.postsPerDay}/day</span>
              </div>
              {community.badge && (
                <span className={cn("text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wide", community.badgeColor)}>
                  {community.badge}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Main content + sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_296px] gap-6 items-start">
          {/* Left: tabs + content */}
          <div className="flex flex-col gap-4">
            {/* Tab bar */}
            <div className="flex items-center gap-1 bg-card border border-border/60 rounded-xl p-1">
              {tabs.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "flex-1 py-2 text-sm font-semibold rounded-lg transition-all relative",
                    activeTab === tab
                      ? "treffin-gradient text-white shadow"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  data-testid={`button-tab-${tab.toLowerCase()}`}
                >
                  {tab}
                  {tab === "Requests" && joinRequests.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {joinRequests.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Posts tab */}
            {activeTab === "Posts" && (
              <div className="flex flex-col gap-4">
                {/* Post composer — only for members */}
                {joined && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card border border-border/60 rounded-xl p-4 flex flex-col gap-3"
                  >
                    <p className="text-sm font-semibold text-muted-foreground">Share with the community</p>

                    {/* Type + Topic selectors */}
                    <div className="flex gap-2">
                      <select
                        value={postType}
                        onChange={e => setPostType(e.target.value as PostInputType)}
                        className="flex-1 bg-muted/30 border border-border/60 rounded-lg px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary transition-colors"
                        data-testid="select-post-type"
                      >
                        {POST_TYPES.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                      <select
                        value={postTopic}
                        onChange={e => setPostTopic(e.target.value)}
                        className="flex-1 bg-muted/30 border border-border/60 rounded-lg px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary transition-colors"
                        data-testid="select-post-topic"
                      >
                        <option value="">No topic</option>
                        {POST_TOPICS.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    <textarea
                      value={postContent}
                      onChange={e => setPostContent(e.target.value)}
                      placeholder={`What's on your mind about ${community.name}?`}
                      className="w-full bg-muted/30 border border-border/60 rounded-xl p-3 text-sm resize-none outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/60"
                      rows={3}
                      data-testid="input-community-post"
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={handlePost}
                        disabled={!postContent.trim() || createPostMutation.isPending}
                        className="flex items-center gap-2 treffin-gradient text-white font-semibold px-5 py-2 rounded-xl text-sm transition-all hover:opacity-90 disabled:opacity-50"
                        data-testid="button-submit-community-post"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {createPostMutation.isPending ? "Posting..." : "Post"}
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Pending notice */}
                {pending && (
                  <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-xl p-4 text-sm text-yellow-300 flex items-center gap-3">
                    <Clock className="w-4 h-4 shrink-0" />
                    <span>Your join request is pending approval. You'll be able to post once approved.</span>
                  </div>
                )}

                {/* Posts feed */}
                {postsLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-32 w-full rounded-xl" />
                  ))
                ) : posts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground bg-card border border-border/60 rounded-xl">
                    <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="font-semibold">No posts yet</p>
                    <p className="text-sm mt-1">
                      {joined ? "Be the first to post!" : "Join this community to start the conversation."}
                    </p>
                    {!joined && !community.isPrivate && (
                      <button
                        onClick={handleJoinLeave}
                        className="mt-3 text-sm text-primary hover:underline"
                      >
                        Join to post
                      </button>
                    )}
                  </div>
                ) : (
                  posts.map(post => <PostCard key={post.id} post={post} onInteraction={handleCommunityInteraction} />)
                )}
              </div>
            )}

            {/* Members tab */}
            {activeTab === "Members" && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">{formatNumber(community.memberCount)} members total</p>
                {community.members.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground bg-card border border-border/60 rounded-xl">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No members yet. Be the first!</p>
                  </div>
                ) : (
                  community.members.map((member, i) => (
                    <motion.div
                      key={member.userId}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex items-center gap-3 bg-card border border-border/60 rounded-xl p-3 hover:border-primary/30 transition-colors"
                    >
                      <Avatar className="w-9 h-9 border border-border/60">
                        <AvatarImage src={member.avatarUrl ?? undefined} />
                        <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">
                          {member.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{member.name}</span>
                          {member.isVerified && (
                            <svg className="w-3.5 h-3.5 text-indigo-400" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                          )}
                          {member.role === "moderator" && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-300 bg-indigo-400/10 border border-indigo-400/20 px-1.5 py-0.5 rounded-full">
                              <Shield className="w-2.5 h-2.5" /> Mod
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{member.title}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-primary">{formatNumber(member.reputationScore)}</p>
                        <p className="text-[10px] text-muted-foreground">rep</p>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            )}

            {/* About tab */}
            {activeTab === "About" && (
              <div className="flex flex-col gap-4">
                <div className="bg-card border border-border/60 rounded-xl p-5 flex flex-col gap-3">
                  <h3 className="font-bold">About this community</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {community.description || "No description provided."}
                  </p>
                  <div className="flex items-center gap-3 pt-2 border-t border-border/50">
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      {community.isPrivate ? (
                        <><Lock className="w-4 h-4 text-yellow-400" /> Private community</>
                      ) : (
                        <><Globe className="w-4 h-4 text-emerald-400" /> Public community</>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-card border border-border/60 rounded-xl p-5 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold flex items-center gap-2">
                      <Shield className="w-4 h-4 text-indigo-400" /> Community Rules
                    </h3>
                    {isCreator && !editingRules && (
                      <button
                        onClick={startEditingRules}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-lg hover:bg-primary/10"
                      >
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                    )}
                    {editingRules && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={saveRules}
                          disabled={updateRulesMutation.isPending}
                          className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded-lg hover:bg-emerald-400/10 transition-colors"
                        >
                          <Check className="w-3 h-3" /> Save
                        </button>
                        <button
                          onClick={() => setEditingRules(false)}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted/60 transition-colors"
                        >
                          <X className="w-3 h-3" /> Cancel
                        </button>
                      </div>
                    )}
                  </div>

                  <AnimatePresence mode="wait">
                    {editingRules ? (
                      <motion.div
                        key="editing"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col gap-2"
                      >
                        {draftRules.map((rule, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center shrink-0">
                              {i + 1}
                            </span>
                            <input
                              value={rule}
                              onChange={(e) => setDraftRules(prev => prev.map((r, j) => j === i ? e.target.value : r))}
                              className="flex-1 bg-muted/40 border border-border/60 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-primary transition-colors"
                              maxLength={120}
                            />
                            <button
                              onClick={() => setDraftRules(prev => prev.filter((_, j) => j !== i))}
                              className="text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        {draftRules.length < 10 && (
                          <button
                            onClick={() => setDraftRules(prev => [...prev, ""])}
                            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors py-1"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add rule
                          </button>
                        )}
                      </motion.div>
                    ) : (
                      <motion.ol
                        key="display"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col gap-2"
                      >
                        {liveRules.map((rule, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                              {i + 1}
                            </span>
                            {rule}
                          </li>
                        ))}
                      </motion.ol>
                    )}
                  </AnimatePresence>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Members", value: formatNumber(community.memberCount), icon: Users, color: "text-indigo-400" },
                    { label: "Posts/day", value: `${community.postsPerDay}`, icon: Flame, color: "text-orange-400" },
                    { label: "Total Posts", value: formatNumber(community.totalPosts), icon: MessageSquare, color: "text-blue-400" },
                    { label: "Category", value: community.category, icon: Crown, color: "text-yellow-400" },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="bg-card border border-border/60 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className={cn("w-4 h-4", color)} />
                        <span className="text-xs text-muted-foreground">{label}</span>
                      </div>
                      <p className="font-bold text-sm">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Requests tab (creator only) */}
            {activeTab === "Requests" && isCreator && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">{joinRequests.length} pending request{joinRequests.length !== 1 ? "s" : ""}</p>
                {joinRequests.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground bg-card border border-border/60 rounded-xl">
                    <UserCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No pending join requests</p>
                  </div>
                ) : (
                  joinRequests.map((req, i) => (
                    <motion.div
                      key={req.userId}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex items-center gap-3 bg-card border border-border/60 rounded-xl p-3"
                    >
                      <Avatar className="w-9 h-9 border border-border/60">
                        <AvatarImage src={req.avatarUrl ?? undefined} />
                        <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">
                          {req.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-sm">{req.name}</span>
                        <p className="text-xs text-muted-foreground">{req.title}</p>
                        <p className="text-[10px] text-muted-foreground">{formatNumber(req.reputationScore)} rep</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleApprove(req.userId)}
                          disabled={approveMutation.isPending}
                          className="flex items-center gap-1 text-xs text-emerald-400 border border-emerald-400/30 bg-emerald-400/10 hover:bg-emerald-400/20 px-2.5 py-1.5 rounded-lg transition-colors"
                          title="Approve"
                        >
                          <UserCheck className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button
                          onClick={() => handleDeny(req.userId)}
                          disabled={denyMutation.isPending}
                          className="flex items-center gap-1 text-xs text-rose-400 border border-rose-400/30 bg-rose-400/10 hover:bg-rose-400/20 px-2.5 py-1.5 rounded-lg transition-colors"
                          title="Deny"
                        >
                          <UserX className="w-3.5 h-3.5" /> Deny
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="flex flex-col gap-4 lg:sticky lg:top-[76px]">
            {/* Member stats */}
            <div className="bg-card border border-border/60 rounded-xl p-4 flex flex-col gap-3">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" /> Members
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center">
                  <p className="text-xl font-bold">{formatNumber(community.memberCount)}</p>
                  <p className="text-[11px] text-muted-foreground">Total</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-orange-400">{community.postsPerDay}</p>
                  <p className="text-[11px] text-muted-foreground">Posts/day</p>
                </div>
              </div>
            </div>

            {/* Top contributors */}
            {topContributors.length > 0 && (
              <div className="bg-card border border-border/60 rounded-xl p-4 flex flex-col gap-3">
                <h3 className="font-bold text-sm">Top Contributors</h3>
                <div className="flex flex-col gap-2.5">
                  {topContributors.map((member, i) => (
                    <div key={member.userId} className="flex items-center gap-2.5">
                      <span className="text-[11px] font-bold text-muted-foreground w-4">{i + 1}</span>
                      <Avatar className="w-7 h-7 border border-border/50">
                        <AvatarImage src={member.avatarUrl ?? undefined} />
                        <AvatarFallback className="text-[10px] bg-primary/15 text-primary">
                          {member.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{member.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{member.title}</p>
                      </div>
                      <span className="text-xs font-bold text-primary shrink-0">{formatNumber(member.reputationScore)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rules summary */}
            <div className="bg-card border border-border/60 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-400" /> Rules
                </h3>
                {isCreator && (
                  <button
                    onClick={() => { setActiveTab("About"); startEditingRules(); }}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
              </div>
              <ol className="flex flex-col gap-1.5">
                {liveRules.slice(0, 3).map((rule, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="text-primary font-bold shrink-0">{i + 1}.</span>
                    {rule}
                  </li>
                ))}
                {liveRules.length > 3 && (
                  <li
                    className="text-xs text-primary hover:underline cursor-pointer"
                    onClick={() => setActiveTab("About")}
                  >
                    See all {liveRules.length} rules →
                  </li>
                )}
              </ol>
            </div>

            {/* Join CTA if not joined */}
            {!joined && !pending && !community.isPrivate && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-gradient-to-br from-primary/15 to-card border border-primary/30 rounded-xl p-4 flex flex-col gap-3"
              >
                <p className="text-sm font-semibold">Join the conversation</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Become a member to post and interact with {formatNumber(community.memberCount)} others.
                </p>
                <button
                  onClick={handleJoinLeave}
                  className="w-full treffin-gradient text-white font-semibold py-2.5 rounded-xl text-sm transition-all hover:opacity-90 treffin-glow"
                >
                  Join {community.name}
                </button>
              </motion.div>
            )}

            {/* Pending notice in sidebar */}
            {pending && (
              <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-xl p-4 flex flex-col gap-2">
                <p className="text-sm font-semibold text-yellow-300 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Request Pending
                </p>
                <p className="text-xs text-muted-foreground">Waiting for creator approval.</p>
                <button
                  onClick={handleJoinLeave}
                  className="text-xs text-rose-400 hover:underline text-left"
                >
                  Cancel request
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
