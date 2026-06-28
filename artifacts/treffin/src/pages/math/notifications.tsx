import {
  useGetMathNotifications,
  useMarkMathNotificationsRead,
  getGetMathNotificationsQueryKey,
} from "@workspace/api-client-react";
import { getMathUserId } from "@/lib/math-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, CheckCheck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";

export default function MathNotifications() {
  const userId = getMathUserId();
  const queryClient = useQueryClient();

  const { data: notifications, isLoading } = useGetMathNotifications({
    query: {
      queryKey: getGetMathNotificationsQueryKey(),
      enabled: !!userId,
    },
  });

  const markRead = useMarkMathNotificationsRead();

  const handleMarkAllRead = () => {
    if (!userId) return;
    markRead.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMathNotificationsQueryKey() });
      },
    });
  };

  if (!userId) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <Bell className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
        <h1 className="text-2xl font-serif font-bold mb-3">Math Notifications</h1>
        <p className="text-muted-foreground mb-6">Sign in to receive notifications</p>
        <Link href="/sign-in" className="bg-primary text-primary-foreground hover:bg-primary/90 px-5 py-2 rounded-lg font-medium transition-colors">
          Sign in
        </Link>
      </div>
    );
  }

  const unread = notifications?.filter((n) => !n.isRead).length ?? 0;

  return (
    <div className="container mx-auto px-4 py-10 max-w-2xl">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Bell className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-serif font-bold">Math Notifications</h1>
          {unread > 0 && (
            <span className="px-2 py-0.5 bg-primary/15 text-primary rounded-full text-sm font-medium">
              {unread} new
            </span>
          )}
        </div>
        {unread > 0 && (
          <Button variant="ghost" size="sm" onClick={handleMarkAllRead} disabled={markRead.isPending}>
            <CheckCheck className="w-4 h-4 mr-1" /> Mark all read
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : notifications && notifications.length > 0 ? (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`bg-card border rounded-xl px-5 py-4 transition-all ${
                !n.isRead ? "border-primary/30 bg-primary/5" : "border-border"
              }`}
            >
              <div className="flex items-start gap-3">
                {!n.isRead && (
                  <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground mb-0.5">{n.title}</div>
                  <p className="text-sm text-muted-foreground">{n.body}</p>
                  <div className="text-xs text-muted-foreground mt-1.5">
                    {new Date(n.createdAt).toLocaleString()}
                  </div>
                </div>
                {n.targetType === "problem" && n.targetId && (
                  <Link href={`/math/problem/${n.targetId}`}>
                    <Button variant="ghost" size="sm" className="text-xs">View</Button>
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card/30 border border-dashed border-border rounded-2xl p-8 sm:p-16 text-center">
          <BellOff className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground text-lg">All caught up!</p>
          <p className="text-sm text-muted-foreground/60 mt-1">No notifications at the moment.</p>
        </div>
      )}
    </div>
  );
}
