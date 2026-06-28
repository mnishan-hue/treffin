import { useQueryClient, useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Heart, MessageCircle, UserPlus, Swords, Trophy, Bell, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@clerk/react";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  getGetNotificationsQueryKey,
  getGetNotificationsQueryOptions,
} from "@workspace/api-client-react";

type NotifType = "like" | "reply" | "follow" | "debate" | "achievement";

const iconMap: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  like: { icon: Heart, color: "text-red-400", bg: "bg-red-400/10 border-red-400/20" },
  reply: { icon: MessageCircle, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20" },
  follow: { icon: UserPlus, color: "text-green-400", bg: "bg-green-400/10 border-green-400/20" },
  debate: { icon: Swords, color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/20" },
  achievement: { icon: Trophy, color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/20" },
};

const fallbackIcon = { icon: Bell, color: "text-muted-foreground", bg: "bg-muted/40 border-border" };

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}

export default function Notifications() {
  const queryClient = useQueryClient();
  const { isSignedIn } = useUser();
  const { data: notifs = [], isLoading } = useQuery({ ...getGetNotificationsQueryOptions(), refetchInterval: 30_000, enabled: !!isSignedIn });
  const unread = notifs.filter((n) => !n.read).length;

  const markAllMutation = useMarkAllNotificationsRead({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() }),
    },
  });

  const markOneMutation = useMarkNotificationRead({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() }),
    },
  });

  const markAll = () => markAllMutation.mutate();
  const markOne = (id: number) => markOneMutation.mutate({ id });

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 max-w-2xl">
        <div className="flex items-center justify-between sticky top-[88px] z-40 bg-background/95 backdrop-blur-sm pb-4 border-b border-border">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              Notifications
              {unread > 0 && (
                <span className="text-sm font-bold text-white bg-primary px-2 py-0.5 rounded-full">{unread}</span>
              )}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Stay on top of your intellectual journey</p>
          </div>
          {unread > 0 && (
            <button
              className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline disabled:opacity-50"
              onClick={markAll}
              disabled={markAllMutation.isPending}
              data-testid="button-mark-all-read"
            >
              <Check className="w-3.5 h-3.5" /> Mark all read
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {isLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 rounded-xl bg-card/40 border border-border animate-pulse" />
              ))}
            </div>
          ) : notifs.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <div className="w-14 h-14 rounded-full bg-muted/40 border border-border flex items-center justify-center">
                <Bell className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="font-semibold text-sm">You're all caught up</p>
              <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                Notifications will appear here when people interact with your posts, debates, and articles.
              </p>
            </div>
          ) : (
            notifs.map((n) => {
              const { icon: Icon, color, bg } = iconMap[n.type as NotifType] ?? fallbackIcon;
              return (
                <div
                  key={n.id}
                  data-testid={`notif-${n.id}`}
                  className={cn(
                    "flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer hover:border-primary/30",
                    n.read ? "bg-card/40 border-border opacity-70" : "bg-card border-border shadow-sm"
                  )}
                  onClick={() => !n.read && markOne(n.id)}
                >
                  {n.actorInitials ? (
                    <Avatar className={cn("w-10 h-10 border shrink-0", bg)}>
                      <AvatarFallback className={cn("text-xs font-bold bg-transparent", color)}>{n.actorInitials}</AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className={cn("w-10 h-10 rounded-full border flex items-center justify-center shrink-0", bg)}>
                      <Icon className={cn("w-4 h-4", color)} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 justify-between">
                      <span className="font-semibold text-sm">{n.title}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(n.createdAt)}</span>
                        {!n.read && <span className="w-2 h-2 bg-primary rounded-full" />}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{n.body}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </AppLayout>
  );
}
