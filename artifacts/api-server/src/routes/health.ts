import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/readyz", async (req, res) => {
  try {
    await db.execute(sql`SELECT 1`);
    res.json({ status: "ready" });
  } catch (err) {
    req.log.error({ err }, "Readiness database check failed");
    res.status(503).json({ status: "not_ready" });
  }
});

export default router;
