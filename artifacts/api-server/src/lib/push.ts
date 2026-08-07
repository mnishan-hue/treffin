/**
 * Web Push helper for the Treffin API server.
 *
 * Uses the `web-push` library with VAPID authentication.  VAPID keys are read
 * from VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY environment variables.
 *
 * If either variable is missing the module still loads safely — sendPushToUser
 * becomes a no-op so the rest of the app is unaffected during local dev.
 */

import webpush from "web-push";
import { db } from "@workspace/db";
import { pushSubscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Logger } from "pino";

const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:admin@thetreffin.com",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
  );
} else {
  console.warn("[push] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set — push notifications disabled");
}

export interface PushPayload {
  title: string;
  body: string;
  /** Deep-link URL opened when the notification is tapped */
  url?: string;
  /** Notification tag — collapses duplicate notifications of the same type */
  tag?: string;
}

/**
 * Send a Web Push notification to all registered devices for a given user.
 * Expired or unregistered subscriptions (410/404) are cleaned up automatically.
 * Always resolves — never throws; errors are logged and skipped per subscription.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
  log: Logger,
): Promise<void> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

  let subs: typeof pushSubscriptionsTable.$inferSelect[];
  try {
    subs = await db
      .select()
      .from(pushSubscriptionsTable)
      .where(eq(pushSubscriptionsTable.userId, userId));
  } catch (err) {
    log.warn({ err, userId }, "[push] failed to fetch subscriptions");
    return;
  }

  if (subs.length === 0) return;

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload),
          { urgency: "normal", TTL: 60 * 60 * 24 }, // 24-hour TTL
        );
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          // Subscription expired or user revoked permission — remove it
          await db
            .delete(pushSubscriptionsTable)
            .where(eq(pushSubscriptionsTable.endpoint, sub.endpoint))
            .catch(() => {});
        } else {
          log.warn({ err, userId, endpoint: sub.endpoint }, "[push] sendNotification failed");
        }
      }
    })
  );
}
