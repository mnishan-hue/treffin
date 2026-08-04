import app from "./app";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { debatesTable, commentsTable } from "@workspace/db";
import { eq, and, lt, gt, sql } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

// ── Auto-close inactive debates (runs every hour) ──────────────────────────
// A debate that has been live for more than 7 days with no comment activity
// in the last 7 days is automatically marked as closed.
const INACTIVITY_DAYS = 7;
const INACTIVITY_MS = INACTIVITY_DAYS * 24 * 60 * 60 * 1000;

async function closeInactiveDebates() {
  try {
    const cutoff = new Date(Date.now() - INACTIVITY_MS);

    // Find live debates that are old enough to be eligible
    const candidates = await db
      .select({ id: debatesTable.id, createdAt: debatesTable.createdAt })
      .from(debatesTable)
      .where(
        and(
          eq(debatesTable.isLive, true),
          lt(debatesTable.createdAt, cutoff),
        ),
      );

    if (candidates.length === 0) return;

    // Check each candidate for recent comment activity
    const toClose: number[] = [];
    for (const debate of candidates) {
      const [recent] = await db
        .select({ count: sql<number>`count(*)` })
        .from(commentsTable)
        .where(
          and(
            eq(commentsTable.debateId, debate.id),
            gt(commentsTable.createdAt, cutoff),
          ),
        );
      if (!recent || Number(recent.count) === 0) {
        toClose.push(debate.id);
      }
    }

    for (const id of toClose) {
      await db
        .update(debatesTable)
        .set({ isLive: false, endedAt: new Date() })
        .where(eq(debatesTable.id, id));
      logger.info({ debateId: id }, "Auto-closed inactive debate");
    }
  } catch (err) {
    logger.error({ err }, "Auto-close sweep failed");
  }
}

setInterval(() => { void closeInactiveDebates(); }, 60 * 60 * 1000); // every hour
void closeInactiveDebates(); // run once at startup to catch any missed on last restart
