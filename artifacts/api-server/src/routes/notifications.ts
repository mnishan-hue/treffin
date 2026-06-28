import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";

const router = Router();

router.get("/notifications", async (req, res) => {
  const auth = getAuth(req);
  const { userId } = auth;
  if (!userId) {
    // Decode __session JWT (no sig verify) to inspect expiry and issuer
    const rawCookie = req.headers.cookie ?? "";
    const sessionMatch = rawCookie.match(/(?:^|;\s*)__session(?:_[^=]+)?=([^;]+)/);
    let jwtClaims: Record<string, unknown> | null = null;
    if (sessionMatch?.[1]) {
      try {
        const parts = sessionMatch[1].split(".");
        if (parts.length === 3) {
          const payload = Buffer.from(parts[1], "base64url").toString("utf8");
          jwtClaims = JSON.parse(payload);
        }
      } catch { /* ignore */ }
    }
    req.log.warn({
      sessionId: auth.sessionId ?? null,
      hasCookie: !!(req.headers.cookie),
      cookieKeys: req.headers.cookie?.split(";").map(c => c.trim().split("=")[0]) ?? [],
      authorization: req.headers.authorization ? "present" : "absent",
      jwtIss: jwtClaims?.iss ?? null,
      jwtExp: jwtClaims?.exp ?? null,
      jwtExpired: jwtClaims?.exp ? (Date.now() / 1000 > (jwtClaims.exp as number)) : null,
      jwtSub: jwtClaims?.sub ?? null,
      nowUnix: Math.floor(Date.now() / 1000),
    }, "Notifications 401 — Clerk found no userId");
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
  const { userId } = getAuth(req);
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
  const { userId } = getAuth(req);
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

export default router;
