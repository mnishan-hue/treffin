import { Router } from "express";
import { db } from "@workspace/db";
import { topicsTable } from "@workspace/db";

const router = Router();

router.get("/topics", async (req, res) => {
  try {
    const topics = await db.select().from(topicsTable);
    res.json(topics.map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get topics");
    res.status(500).json({ error: "Failed to get topics" });
  }
});

export default router;
