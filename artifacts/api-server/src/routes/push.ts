import { Router } from "express";
import { db } from "@workspace/db";
import { pushSubscriptionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

/**
 * POST /api/push/subscribe
 * Save a Web Push subscription for the authenticated user.
 * Body: { endpoint: string, keys: { p256dh: string, auth: string } }
 */
router.post("/push/subscribe", async (req, res) => {
  const userId = req.betterAuthSession?.user?.id ?? null;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { endpoint, keys } = req.body as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    res.status(400).json({ error: "endpoint, keys.p256dh, and keys.auth are required" });
    return;
  }

  try {
    // Upsert: if the same endpoint resubscribes (e.g. after a browser restart
    // rotates the auth secret) update its keys and re-link to the current user.
    await db
      .insert(pushSubscriptionsTable)
      .values({ userId, endpoint, p256dh: keys.p256dh, auth: keys.auth })
      .onConflictDoUpdate({
        target: pushSubscriptionsTable.endpoint,
        set: { userId, p256dh: keys.p256dh, auth: keys.auth },
      });

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to save push subscription");
    res.status(500).json({ error: "Failed to save subscription" });
  }
});

/**
 * DELETE /api/push/unsubscribe
 * Remove a push subscription for the authenticated user.
 * Body: { endpoint: string }
 */
router.delete("/push/unsubscribe", async (req, res) => {
  const userId = req.betterAuthSession?.user?.id ?? null;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { endpoint } = req.body as { endpoint?: string };
  if (!endpoint) { res.status(400).json({ error: "endpoint is required" }); return; }

  try {
    await db.delete(pushSubscriptionsTable).where(
      and(
        eq(pushSubscriptionsTable.userId, userId),
        eq(pushSubscriptionsTable.endpoint, endpoint),
      )
    );
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete push subscription");
    res.status(500).json({ error: "Failed to remove subscription" });
  }
});

export default router;
