import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Home, Compass, MessageSquare, FileText, Users, Bookmark, Bell, User, BarChart2, Info, X, Sigma } from "lucide-react";
import { useGetTopics, getGetNotificationsQueryOptions } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";

function notifCacheKey(userId: string) {
  return `treffin:unread_count:${userId}`;
}

function readCachedCount(userId: string): number {
  try {
    const v = localStorage.getItem(notifCacheKey(userId));
    if (v === null) return 0;
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writeCachedCount(userId: string, count: number) {
  try {
    localStorage.setItem(notifCacheKey(userId), String(count));
  } catch {
    // ignore storage errors (e.g. private-browsing quota)
  }
}

export function SidebarLeft() {
  const [location, setLocation] = useLocation();
  const { data: topics, isLoading: topicsLoading } = useGetTopics();
  const [showAllTopics, setShowAllTopics] = useState(false);
  const { isSignedIn, user } = useUser();
  const userId = user?.id ?? null;

  const [persistedUnread, setPersistedUnread] = useState<number>(
    isSignedIn && userId ? readCachedCount(userId) : 0,
  );

  const { data: notifications } = useQuery({
    ...getGetNotificationsQueryOptions(),
    enabled: !!isSignedIn,
    refetchInterval: 30_000,
  });

  // When the user signs in (without remount), rehydrate from their personal cache.
  useEffect(() => {
    if (!isSignedIn || !userId) {
      setPersistedUnread(0);
      return;
    }
    // Only rehydrate from cache if the API hasn't responded yet.
    if (notifications === undefined) {
      setPersistedUnread(readCachedCount(userId));
    }
  }, [isSignedIn, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update badge and cache once the API responds.
  useEffect(() => {
    if (!isSignedIn || !userId || notifications === undefined) return;
    const count = notifications.filter(n => !n.read).length;
    setPersistedUnread(count);
    writeCachedCount(userId, count);
  }, [notifications, isSignedIn, userId]);

  const unreadCount = persistedUnread;

  const navItems = [
    { icon: Home,        label: "Home",         href: "/" },
    { icon: Compass,     label: "Discover",     href: "/discover" },
    { icon: MessageSquare, label: "Debate Arena", href: "/debates" },
    { icon: FileText, label: "Articles", href: "/articles" },
    { icon: Users, label: "Communities", href: "/communities" },
    { icon: Sigma, label: "Mathematics", href: "/math" },
    { icon: Bookmark, label: "Saved", href: "/saved" },
    { icon: Bell, label: "Notifications", href: "/notifications", badge: unreadCount },
    { icon: User, label: "Profile", href: "/profile" },
    { icon: BarChart2, label: "Analytics", href: "/analytics" },
    { icon: Info, label: "About Us", href: "/about" },
  ];

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* Navigation */}
        <nav className="flex flex-col gap-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            const inner = (
              <div className={cn(
                "relative flex items-center justify-between px-3 py-2.5 rounded-xl transition-all cursor-pointer group",
                isActive
                  ? "bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}>
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full treffin-gradient" />
                )}
                <div className="flex items-center gap-3">
                  <Icon className={cn("w-[18px] h-[18px] transition-colors", isActive ? "text-primary" : "")} />
                  <span className={cn("text-[14px] font-medium", isActive ? "font-semibold" : "")}>{item.label}</span>
                </div>
                {(item.badge ?? 0) > 0 && (
                  <span className="treffin-gradient text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {item.badge}
                  </span>
                )}
              </div>
            );
            return (
              <Link key={item.href} href={item.href}>{inner}</Link>
            );
          })}
        </nav>

        {/* Explore Topics */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Explore Topics</h3>
            <button
              className="text-[11px] text-primary hover:text-primary/80 font-medium transition-colors"
              onClick={() => setShowAllTopics(true)}
              data-testid="button-more-topics"
            >
              See all
            </button>
          </div>
          {topicsLoading ? (
            <div className="space-y-2 px-1">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-5 w-full" />)}
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {topics?.slice(0, 7).map(topic => (
                <button
                  key={topic.id}
                  className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors px-3 py-2 rounded-xl text-left w-full group"
                  onClick={() => setLocation(`/?topic=${encodeURIComponent(topic.name)}`)}
                  data-testid={`sidebar-topic-${topic.id}`}
                >
                  <div className="w-2 h-2 rounded-full shrink-0 ring-1 ring-white/10" style={{ backgroundColor: topic.color }} />
                  <span className="truncate text-[13px] group-hover:text-foreground transition-colors">{topic.name}</span>
                </button>
              ))}
              <button
                className="flex items-center gap-2 text-[13px] text-primary/80 hover:text-primary transition-colors px-3 py-2 rounded-xl mt-0.5 w-full"
                onClick={() => setShowAllTopics(true)}
              >
                View all topics →
              </button>
            </div>
          )}
        </div>

      </div>

      {/* All Topics Modal */}
      {showAllTopics && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowAllTopics(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-base">All Topics</h2>
              <button className="p-1.5 rounded-lg hover:bg-muted transition-colors" onClick={() => setShowAllTopics(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-col gap-1 max-h-72 overflow-y-auto">
              {topicsLoading ? (
                Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-8 w-full rounded-xl" />)
              ) : (
                topics?.map(topic => (
                  <button
                    key={topic.id}
                    className="flex items-center gap-3 text-sm px-3 py-2.5 rounded-xl hover:bg-muted transition-colors text-left"
                    onClick={() => { setShowAllTopics(false); setLocation(`/?topic=${encodeURIComponent(topic.name)}`); }}
                  >
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: topic.color }} />
                    <span className="flex-1">{topic.name}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
