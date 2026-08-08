import { useEffect, useState } from "react";
import { SectionInfo } from "@/components/section-info";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Heart, MessageCircle, UserPlus, Swords, Trophy, Bell, Check, Settings, Star, Zap, MapPin, Shield, ShieldAlert, ShieldCheck, AlertTriangle, Gavel, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth-client";
import { getApiUrl } from "@/lib/api-url";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  getGetNotificationsQueryKey,
  getGetNotificationsQueryOptions,
  useGetNotificationPreferences,
  useUpdateNotificationPreferences,
  getGetNotificationPreferencesQueryKey,
  type NotificationPreferences,
} from "@workspace/api-client-react";

const PREFERENCE_LABELS: Record<keyof NotificationPreferences, { label: string; description: string }> = {
  likes: { label: "Likes", description: "When someone likes your argument, article, or post" },
  replies: { label: "Replies", description: "When someone replies to your debate or article" },
  follows: { label: "Follows", description: "When someone starts following you" },
  debates: { label: "Debate activity", description: "When people join debates you created" },
};

type NotifType = "like" | "reply" | "follow" | "debate" | "achievement";

const iconMap: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  // Existing
  like: { icon: Heart, color: "text-red-400", bg: "bg-red-400/10 border-red-400/20" },
  comment_liked: { icon: Heart, color: "text-red-400", bg: "bg-red-400/10 border-red-400/20" },
  article_liked: { icon: Heart, color: "text-red-400", bg: "bg-red-400/10 border-red-400/20" },
  reply: { icon: MessageCircle, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20" },
  follow: { icon: UserPlus, color: "text-green-400", bg: "bg-green-400/10 border-green-400/20" },
  debate: { icon: Swords, color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/20" },
  debate_joined: { icon: Swords, color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/20" },
  achievement: { icon: Trophy, color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/20" },
  // New
  debate_outcome: { icon: Trophy, color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/20" },
  rep_gain: { icon: Zap, color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20" },
  argument_pinned: { icon: MapPin, color: "text-indigo-400", bg: "bg-indigo-400/10 border-indigo-400/20" },
  argument_featured: { icon: Star, color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/20" },
  argument_removed: { icon: AlertTriangle, color: "text-rose-400", bg: "bg-rose-400/10 border-rose-400/20" },
  suspended: { icon: ShieldAlert, color: "text-red-400", bg: "bg-red-400/10 border-red-400/20" },
  unsuspended: { icon: ShieldCheck, color: "text-green-400", bg: "bg-green-400/10 border-green-400/20" },
  appeal_decided: { icon: Gavel, color: "text-purple-400", bg: "bg-purple-400/10 border-purple-400/20" },
  math_event: { icon: Award, color: "text-cyan-400", bg: "bg-cyan-400/10 border-cyan-400/20" },
  creator_report_upheld: { icon: ShieldAlert, color: "text-rose-400", bg: "bg-rose-400/10 border-rose-400/20" },
  admin_took_control: { icon: Shield, color: "text-violet-400", bg: "bg-violet-400/10 border-violet-400/20" },
};

const fallbackIcon = { icon: Bell, color: "text-muted-foreground", bg: "bg-muted/40 border-border" };

function timeAgo(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return days === 1 ? "1 day ago" : `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (days < 30) return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

function PreferencesPanel() {
  const queryClient = useQueryClient();
  const { data: prefs, isLoading } = useGetNotificationPreferences();

  const updateMutation = useUpdateNotificationPreferences({
    mutation: {
      onMutate: async (vars) => {
        await queryClient.cancelQueries({ queryKey: getGetNotificationPreferencesQueryKey() });
        const previous = queryClient.getQueryData<NotificationPreferences>(getGetNotificationPreferencesQueryKey());
        queryClient.setQueryData(getGetNotificationPreferencesQueryKey(), vars.data);
        return { previous };
      },
      onError: (_err, _vars, context) => {
        if (context?.previous) {
          queryClient.setQueryData(getGetNotificationPreferencesQueryKey(), context.previous);
        }
      },
      onSettled: () => queryClient.invalidateQueries({ queryKey: getGetNotificationPreferencesQueryKey() }),
    },
  });

  const toggle = (key: keyof NotificationPreferences, value: boolean) => {
    if (!prefs) return;
    updateMutation.mutate({ data: { ...prefs, [key]: value } });
  };

  return (
    <div className="rounded-xl border border-border bg-card/40 p-4 flex flex-col gap-4" data-testid="panel-notification-preferences">
      <div>
        <h2 className="text-sm font-semibold flex items-center gap-1.5">
          <Settings className="w-3.5 h-3.5" /> Notification preferences
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">Choose which activity notifies you</p>
      </div>
      {isLoading || !prefs ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 rounded-lg bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {(Object.keys(PREFERENCE_LABELS) as Array<keyof NotificationPreferences>).map((key) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{PREFERENCE_LABELS[key].label}</p>
                <p className="text-xs text-muted-foreground">{PREFERENCE_LABELS[key].description}</p>
              </div>
              <Switch
                checked={prefs[key]}
                onCheckedChange={(checked) => toggle(key, checked)}
                disabled={updateMutation.isPending}
                data-testid={`switch-pref-${key}`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Notifications() {
  const queryClient = useQueryClient();
  const { isSignedIn } = useSession();
  const { data: notifs = [], isLoading } = useQuery({ ...getGetNotificationsQueryOptions(), refetchInterval: 30_000, enabled: !!isSignedIn });
  const unread = notifs.filter((n) => !n.read).length;
  const [showPrefs, setShowPrefs] = useState(false);

  useEffect(() => {
    if (!isSignedIn || typeof EventSource === "undefined") return;
    const stream = new EventSource(getApiUrl("/api/notifications/stream"), { withCredentials: true });
    stream.onmessage = () => {
      void queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
    };
    return () => stream.close();
  }, [isSignedIn, queryClient]);

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
            <h1 className="text-2xl font-bold flex items-center gap-1.5">
              Notifications
              {unread > 0 && (
                <span className="text-sm font-bold text-white bg-primary px-2 py-0.5 rounded-full">{unread}</span>
              )}
              <SectionInfo title="Notifications" icon="🔔" accent="from-indigo-500 to-violet-600" description="Stay on top of your intellectual journey. Get notified when someone responds to your debate, comments on your article, or challenges your solution." />
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
              onClick={() => setShowPrefs((v) => !v)}
              data-testid="button-toggle-preferences"
            >
              <Settings className="w-3.5 h-3.5" /> Preferences
            </button>
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
        </div>

        {showPrefs && <PreferencesPanel />}

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
