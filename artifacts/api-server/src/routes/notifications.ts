import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable, usersTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { NOTIFICATION_CATEGORIES, type NotificationCategory } from "../lib/notify";

const router = Router();

function categoriesToPreferences(muted: string[]): Record<NotificationCategory, boolean> {
  const prefs = {} as Record<NotificationCategory, boolean>;
  for (const category of NOTIFICATION_CATEGORIES) {
    prefs[category] = !muted.includes(category);
  }
  return prefs;
}

router.get("/notifications/preferences", async (req, res) => {
  const userId = req.betterAuthSession?.user?.id ?? null;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const [user] = await db
      .select({ mutedNotificationCategories: usersTable.mutedNotificationCategories })
      .from(usersTable)
      .where(eq(usersTable.betterAuthId, userId))
      .limit(1);

    res.json(categoriesToPreferences(user?.mutedNotificationCategories ?? []));
  } catch (err) {
    req.log.error({ err }, "Failed to get notification preferences");
    res.status(500).json({ error: "Failed to get notification preferences" });
  }
});

router.patch("/notifications/preferences", async (req, res) => {
  const userId = req.betterAuthSession?.user?.id ?? null;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const body = req.body as Partial<Record<NotificationCategory, boolean>>;

    const [existing] = await db
      .select({ mutedNotificationCategories: usersTable.mutedNotificationCategories })
      .from(usersTable)
      .where(eq(usersTable.betterAuthId, userId))
      .limit(1);

    if (!existing) { res.status(404).json({ error: "User not found" }); return; }

    const muted = new Set(existing.mutedNotificationCategories ?? []);
    for (const category of NOTIFICATION_CATEGORIES) {
      if (typeof body[category] !== "boolean") continue;
      if (body[category]) {
        muted.delete(category);
      } else {
        muted.add(category);
      }
    }

    const mutedArray = Array.from(muted);
    await db
      .update(usersTable)
      .set({ mutedNotificationCategories: mutedArray })
      .where(eq(usersTable.betterAuthId, userId));

    res.json(categoriesToPreferences(mutedArray));
  } catch (err) {
    req.log.error({ err }, "Failed to update notification preferences");
    res.status(500).json({ error: "Failed to update notification preferences" });
  }
});

router.get("/notifications", async (req, res) => {
  const userId = req.betterAuthSession?.user?.id ?? null;
  if (!userId) {
    req.log.warn({
      hasCookie: !!(req.headers.cookie),
      authorization: req.headers.authorization ? "present" : "absent",
    }, "Notifications 401 — no Better Auth session found");
    res.status(401).json({ error: "Unauthorized" }); return;
  }

  try {
    const rows = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.userId, userId))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(50);

    res.json(rows.map((n) => ({
      id: n.id,
      userId: n.userId,
      type: n.type,
      title: n.title,
      body: n.body,
      actorName: n.actorName ?? null,
      actorInitials: n.actorInitials ?? null,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get notifications");
    res.status(500).json({ error: "Failed to get notifications" });
  }
});

router.patch("/notifications/read-all", async (req, res) => {
  const userId = req.betterAuthSession?.user?.id ?? null;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    await db
      .update(notificationsTable)
      .set({ read: true })
      .where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.read, false)));

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to mark all notifications read");
    res.status(500).json({ error: "Failed to mark all read" });
  }
});

router.patch("/notifications/:id/read", async (req, res) => {
  const userId = req.betterAuthSession?.user?.id ?? null;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  try {
    const [row] = await db
      .select()
      .from(notificationsTable)
      .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, userId)))
      .limit(1);

    if (!row) { res.status(404).json({ error: "Notification not found" }); return; }

    await db
      .update(notificationsTable)
      .set({ read: true })
      .where(eq(notificationsTable.id, id));

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to mark notification read");
    res.status(500).json({ error: "Failed to mark read" });
  }
});

// ── Server-Sent Events: real-time notification stream ───────────────────────
router.get("/notifications/stream", (req, res) => {
  const userId = req.betterAuthSession?.user?.id ?? null;
  if (!userId) { res.status(401).end(); return; }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // Immediate heartbeat so client knows the connection is alive
  res.write(": heartbeat\n\n");

  let lastChecked = new Date();

  const interval = setInterval(async () => {
    try {
      const newNotifs = await db
        .select()
        .from(notificationsTable)
        .where(
          and(
            eq(notificationsTable.userId, userId),
            sql`${notificationsTable.createdAt} > ${lastChecked.toISOString()}`
          )
        )
        .orderBy(desc(notificationsTable.createdAt))
        .limit(10);

      lastChecked = new Date();

      if (newNotifs.length > 0) {
        for (const n of newNotifs) {
          res.write(`data: ${JSON.stringify({
            id: n.id, type: n.type, title: n.title, body: n.body,
            actorName: n.actorName ?? null, actorInitials: n.actorInitials ?? null,
            read: n.read, createdAt: n.createdAt.toISOString(),
          })}\n\n`);
        }
      } else {
        res.write(": ping\n\n");
      }
    } catch {
      res.write(": error\n\n");
    }
  }, 5000);

  req.on("close", () => {
    clearInterval(interval);
    res.end();
  });
});

export default router;
