import { db } from "@workspace/db";
import { notificationsTable, usersTable } from "@workspace/db";
import { eq, and, or, sql } from "drizzle-orm";
import type { Logger } from "pino";
import { sendPushToUser } from "./push";

export interface NotifyParams {
  targetDbUserId: number;
  actorClerkId: string;
  actorDisplayName?: string;
  type: string;
  title: string;
  body: string;
  targetClerkIdOverride?: string;
  batchKey?: string;
  /**
   * Template for the batched notification body, used when incrementing an existing
   * batched notification. Use `{count}` as a placeholder for the running total.
   * Defaults to "{count} people replied to your argument" for backwards compatibility.
   */
  batchBody?: string;
}

export const NOTIFICATION_CATEGORIES = ["likes", "replies", "follows", "debates"] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

const TYPE_TO_CATEGORY: Record<string, NotificationCategory> = {
  like: "likes",
  comment_liked: "likes",
  article_liked: "likes",
  reply: "replies",
  follow: "follows",
  debate: "debates",
  debate_joined: "debates",
  debate_outcome: "debates",
  argument_pinned: "replies",
  argument_featured: "replies",
  argument_removed: "replies",
  rep_gain: "debates",
  suspended: "debates",
  unsuspended: "debates",
  appeal_decided: "debates",
  math_event: "debates",
  creator_report_upheld: "debates",
  admin_took_control: "debates",
};

function categoryForType(type: string): NotificationCategory | null {
  return TYPE_TO_CATEGORY[type] ?? null;
}

/**
 * Resolve a DB user's notification user-id (betterAuthId for new users, clerkId
 * as legacy fallback) from their integer primary key.
 * Returns null if the user has no linked auth identity yet.
 */
export async function resolveClerkId(dbUserId: number): Promise<string | null> {
  const [user] = await db
    .select({ betterAuthId: usersTable.betterAuthId, clerkId: usersTable.clerkId })
    .from(usersTable)
    .where(eq(usersTable.id, dbUserId))
    .limit(1);
  return user?.betterAuthId ?? user?.clerkId ?? null;
}

/** Notify a user when you already have their userId (betterAuthId or clerkId) directly. */
export async function notifyUser(
  targetUserId: string,
  actorUserId: string,
  params: { type: string; title: string; body: string; actorDisplayName?: string; batchKey?: string },
  log: Logger
): Promise<void> {
  await createNotification(
    {
      targetDbUserId: 0,
      targetClerkIdOverride: targetUserId,
      actorClerkId: actorUserId,
      actorDisplayName: params.actorDisplayName,
      type: params.type,
      title: params.title,
      body: params.body,
      batchKey: params.batchKey,
    },
    log
  );
}

export async function createNotification(
  params: NotifyParams,
  log: Logger
): Promise<void> {
  const { targetDbUserId, actorClerkId, actorDisplayName, type, title, body, targetClerkIdOverride, batchKey, batchBody } = params;

  const targetUserId = targetClerkIdOverride ?? (await resolveClerkId(targetDbUserId));
  if (!targetUserId) {
    log.debug({ targetDbUserId }, "Skipping notification: target user has no auth identity");
    return;
  }

  if (targetUserId === actorClerkId) {
    return;
  }

  const actorInitials = (actorDisplayName ?? actorClerkId).substring(0, 2).toUpperCase();

  try {
    const category = categoryForType(type);
    if (category) {
      // Check muted categories via betterAuthId or clerkId (bridge both systems)
      const [targetUser] = await db
        .select({ mutedNotificationCategories: usersTable.mutedNotificationCategories })
        .from(usersTable)
        .where(or(
          eq(usersTable.betterAuthId, targetUserId),
          eq(usersTable.clerkId, targetUserId),
        ))
        .limit(1);

      if (targetUser?.mutedNotificationCategories?.includes(category)) {
        log.debug({ targetUserId, type, category }, "Skipping notification: category muted by user");
        return;
      }
    }

    // Notification batching: if same batchKey exists within 30 min, increment count
    if (batchKey) {
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
      const [existing] = await db
        .select()
        .from(notificationsTable)
        .where(
          and(
            eq(notificationsTable.userId, targetUserId),
            eq(notificationsTable.batchKey, batchKey),
            eq(notificationsTable.read, false),
            sql`${notificationsTable.createdAt} > ${thirtyMinAgo.toISOString()}`
          )
        )
        .limit(1);

      if (existing) {
        const newCount = existing.count + 1;
        const template = batchBody ?? "{count} people replied to your argument";
        await db
          .update(notificationsTable)
          .set({
            count: sql`${notificationsTable.count} + 1`,
            body: template.replace("{count}", String(newCount)),
            createdAt: new Date(),
          })
          .where(eq(notificationsTable.id, existing.id));
        return;
      }
    }

    await db.insert(notificationsTable).values({
      userId: targetUserId,
      type,
      title,
      body,
      actorName: actorDisplayName ?? actorClerkId,
      actorInitials,
      count: 1,
      batchKey: batchKey ?? null,
    });

    // Fire a Web Push notification to all registered devices (best-effort,
    // never blocks or fails the in-app notification insert above).
    void sendPushToUser(
      targetUserId,
      { title, body, url: "/notifications", tag: type },
      log,
    );
  } catch (err) {
    log.error({ err, targetDbUserId, type }, "Failed to insert notification");
  }
}
