import { Router } from "express";
import { db } from "@workspace/db";
import { reputationEventsTable, usersTable, notificationsTable, appSettingsTable } from "@workspace/db";
import { and, eq, desc, sql } from "drizzle-orm";
import {
  DEFAULT_ELITE_THRESHOLD,
  ELITE_THRESHOLD_SETTING_KEY,
  parseEliteThreshold,
  titleForReputation,
} from "../lib/reputation-settings";

let _eliteThreshold = DEFAULT_ELITE_THRESHOLD;

/** Returns the threshold cached by the API process. */
export function getEliteThreshold(): number {
  return _eliteThreshold;
}

/** Updates the process cache after a successful transactional DB write. */
export function setEliteThreshold(value: number): void {
  const parsed = parseEliteThreshold(value);
  if (parsed === null) throw new Error("Invalid Elite Thinker threshold");
  _eliteThreshold = parsed;
}

/** Refreshes the cache from the authoritative database value. */
export async function loadEliteThreshold(): Promise<number> {
  const [row] = await db
    .select({ value: appSettingsTable.value })
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, ELITE_THRESHOLD_SETTING_KEY))
    .limit(1);
  const parsed = row ? parseEliteThreshold(row.value) : DEFAULT_ELITE_THRESHOLD;
  if (parsed === null) throw new Error("Stored Elite Thinker threshold is invalid");
  _eliteThreshold = parsed;
  return parsed;
}

const router = Router();

router.get("/reputation/settings", async (req, res) => {
  try {
    const eliteThreshold = await loadEliteThreshold();
    res.setHeader("Cache-Control", "no-store");
    res.json({ eliteThreshold });
  } catch (err) {
    req.log.error({ err }, "Failed to load public reputation settings");
    res.status(500).json({ error: "Reputation settings are unavailable" });
  }
});

export const REP_VALUES: Record<string, number> = {
  post_created: 10,
  post_liked: 3,
  article_created: 25,
  article_liked: 5,
  debate_created: 30,
  debate_joined: 15,
  debate_won: 75,
  daily_question_voted: 5,
  weekly_challenge_won: 150,
  community_joined: 10,
  comment_posted: 2,
  content_saved: 1,
  profile_completed: 20,
  long_comment: 5,
};

export async function awardRep(
  userId: string,
  eventType: string,
  description: string,
  referenceId?: number
) {
  // Refresh before calculating a title so every API instance observes admin changes.
  const eliteThreshold = await loadEliteThreshold().catch(() => _eliteThreshold);
  const points = REP_VALUES[eventType] ?? 5;
  const idempotentEvents = new Set([
    "post_created", "article_created", "article_liked", "debate_created", "debate_joined",
    "debate_won", "daily_question_voted", "weekly_challenge_won",
    "community_joined", "comment_posted", "content_saved",
    "profile_completed", "long_comment",
  ]);
  let awarded = false;
  // Both writes are in a transaction so the event log and the denormalized
  // leaderboard score are always consistent — neither can succeed without the other.
  await db.transaction(async (tx) => {
    if (referenceId !== undefined && idempotentEvents.has(eventType)) {
      const lockKey = [userId, eventType, referenceId].join(":");
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);
      const [existing] = await tx
        .select({ id: reputationEventsTable.id })
        .from(reputationEventsTable)
        .where(and(
          eq(reputationEventsTable.userId, userId),
          eq(reputationEventsTable.eventType, eventType as any),
          eq(reputationEventsTable.referenceId, referenceId),
        ))
        .limit(1);
      if (existing) return;
    }
    await tx.insert(reputationEventsTable).values({
      userId,
      eventType: eventType as any,
      points,
      description,
      referenceId: referenceId ?? null,
    });
    awarded = true;
    const [updated] = await tx
      .update(usersTable)
      .set({ reputationScore: sql`${usersTable.reputationScore} + ${points}` })
      .where(eq(usersTable.betterAuthId, userId))
      .returning({ reputationScore: usersTable.reputationScore });
    if (updated) {
      const newTitle = titleForReputation(updated.reputationScore, eliteThreshold);
      await tx
        .update(usersTable)
        .set({ title: newTitle })
        .where(eq(usersTable.betterAuthId, userId));
    }
  });
  if (!awarded) return 0;
  // Fire-and-forget: notify the user of their rep gain (direct insert — no actor, self-event)
  db.insert(notificationsTable).values({
    userId,
    type: "rep_gain",
    title: `+${points} reputation`,
    body: description,
    actorName: "Treffin",
    actorInitials: "TR",
  }).catch(() => { /* non-blocking */ });

  return points;
}

const BLOCKED_EVENT_TYPES = new Set(["streak_bonus"]);
const BLOCKED_DESCRIPTIONS = new Set(["repost", "streak"]);

function buildSummary(events: typeof reputationEventsTable.$inferSelect[]) {
  const filtered = events.filter(
    e => !BLOCKED_EVENT_TYPES.has(e.eventType) && !BLOCKED_DESCRIPTIONS.has(e.description)
  );
  const total = filtered.reduce((acc, e) => acc + e.points, 0);
  const breakdown = { debates: 0, articles: 0, community: 0, votes: 0, posts: 0 };
  for (const e of filtered) {
    if (e.eventType === "debate_joined" || e.eventType === "debate_won") {
      breakdown.debates += e.points;
    } else if (e.eventType === "article_created" || e.eventType === "article_liked") {
      breakdown.articles += e.points;
    } else if (e.eventType === "community_joined") {
      breakdown.community += e.points;
    } else if (e.eventType === "daily_question_voted" || e.eventType === "weekly_challenge_won") {
      breakdown.votes += e.points;
    } else {
      breakdown.posts += e.points;
    }
  }
  const recentEvents = filtered.slice(0, 15).map((e) => ({
    id: e.id,
    eventType: e.eventType,
    points: e.points,
    description: e.description,
    referenceId: e.referenceId ?? null,
    createdAt: e.createdAt.toISOString(),
  }));
  return { total, breakdown, recentEvents };
}

router.get("/reputation", async (req, res) => {
  const userId = req.betterAuthSession?.user?.id ?? null;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const events = await db
      .select()
      .from(reputationEventsTable)
      .where(eq(reputationEventsTable.userId, userId))
      .orderBy(desc(reputationEventsTable.createdAt))
      .limit(50);

    res.json(buildSummary(events));
  } catch (err) {
    req.log.error({ err }, "Failed to get reputation");
    res.status(500).json({ error: "Failed to get reputation" });
  }
});

router.post("/reputation/award", async (_req, res) => {
  res.status(403).json({ error: "Reputation is awarded automatically by the server" });
});

export default router;
