import { db } from "@workspace/db";
import { notificationsTable, usersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import type { Logger } from "pino";

export interface NotifyParams {
  targetDbUserId: number;
  actorClerkId: string;
  actorDisplayName?: string;
  type: string;
  title: string;
  body: string;
  targetClerkIdOverride?: string;
  batchKey?: string;
}

export async function resolveClerkId(dbUserId: number): Promise<string | null> {
  const [user] = await db
    .select({ clerkId: usersTable.clerkId, name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, dbUserId))
    .limit(1);
  return user?.clerkId ?? null;
}

export async function createNotification(
  params: NotifyParams,
  log: Logger
): Promise<void> {
  const { targetDbUserId, actorClerkId, actorDisplayName, type, title, body, targetClerkIdOverride, batchKey } = params;

  const targetClerkId = targetClerkIdOverride ?? (await resolveClerkId(targetDbUserId));
  if (!targetClerkId) {
    log.debug({ targetDbUserId }, "Skipping notification: target user has no clerkId");
    return;
  }

  if (targetClerkId === actorClerkId) {
    return;
  }

  const actorInitials = (actorDisplayName ?? actorClerkId).substring(0, 2).toUpperCase();

  try {
    // Notification batching: if same batchKey exists within 30 min, increment count
    if (batchKey) {
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
      const [existing] = await db
        .select()
        .from(notificationsTable)
        .where(
          and(
            eq(notificationsTable.userId, targetClerkId),
            eq(notificationsTable.batchKey, batchKey),
            eq(notificationsTable.read, false),
            sql`${notificationsTable.createdAt} > ${thirtyMinAgo.toISOString()}`
          )
        )
        .limit(1);

      if (existing) {
        await db
          .update(notificationsTable)
          .set({
            count: sql`${notificationsTable.count} + 1`,
            body: `${existing.count + 1} people replied to your argument`,
            createdAt: new Date(),
          })
          .where(eq(notificationsTable.id, existing.id));
        return;
      }
    }

    await db.insert(notificationsTable).values({
      userId: targetClerkId,
      type,
      title,
      body,
      actorName: actorDisplayName ?? actorClerkId,
      actorInitials,
      count: 1,
      batchKey: batchKey ?? null,
    });
  } catch (err) {
    log.error({ err, targetDbUserId, type }, "Failed to insert notification");
  }
}
