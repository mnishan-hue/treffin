import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { contentAppealsTable } from "@workspace/db";
import { and, eq, gte, sql } from "drizzle-orm";

const router = Router();

router.post("/content-appeals", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { contentType, contentId, reason } = req.body as {
      contentType: string;
      contentId: number;
      reason: string;
    };

    if (!contentType || !contentId || !reason?.trim()) {
      res.status(400).json({ error: "contentType, contentId, and reason are required" }); return;
    }
    if (!["comment", "post", "article"].includes(contentType)) {
      res.status(400).json({ error: "contentType must be comment, post, or article" }); return;
    }

    const existing = await db
      .select()
      .from(contentAppealsTable)
      .where(
        and(
          eq(contentAppealsTable.userId, userId),
          eq(contentAppealsTable.contentType, contentType),
          eq(contentAppealsTable.contentId, contentId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: "You have already submitted an appeal for this content" }); return;
    }

    const [appeal] = await db
      .insert(contentAppealsTable)
      .values({ userId, contentType, contentId, reason: reason.trim(), status: "open" })
      .returning();

    res.status(201).json({
      id: appeal.id,
      userId: appeal.userId,
      contentType: appeal.contentType,
      contentId: appeal.contentId,
      reason: appeal.reason,
      status: appeal.status,
      reviewNote: null,
      reviewedAt: null,
      createdAt: appeal.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to submit appeal");
    res.status(500).json({ error: "Failed to submit appeal" });
  }
});

export default router;
