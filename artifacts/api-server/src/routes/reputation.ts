import { Router } from "express";
import { db } from "@workspace/db";
import { reputationEventsTable, usersTable, notificationsTable, appSettingsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Elite Thinker threshold — loaded from DB at startup, cached in memory.
// Use getEliteThreshold() everywhere; call setEliteThreshold() when admin
// updates it so the change takes effect instantly without a server restart.
// ---------------------------------------------------------------------------
const SETTING_KEY = "elite_thinker_threshold";
const DEFAULT_THRESHOLD = 1000;

let _eliteThreshold = DEFAULT_THRESHOLD;

/** Returns the cached Elite Thinker reputation threshold. */
export function getEliteThreshold(): number {
  return _eliteThreshold;
}

/** Updates the in-memory cache (called after DB write by the admin route). */
export function setEliteThreshold(value: number): void {
  _eliteThreshold = value;
}

/** Initialise the threshold from the DB. Call once during server startup. */
export async function loadEliteThreshold(): Promise<void> {
  try {
    const [row] = await db
      .select({ value: appSettingsTable.value })
      .from(appSettingsTable)
      .where(eq(appSettingsTable.key, SETTING_KEY))
      .limit(1);
    if (row) _eliteThreshold = Math.max(1, parseInt(row.value, 10) || DEFAULT_THRESHOLD);
  } catch {
    // DB might not have the table yet (before first migration) — use default.
  }
}



const router = Router();

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

function titleForScore(score: number): string {
  const elite = _eliteThreshold;
  // Tiers below Elite Thinker are evenly distributed at 10%/30%/60% of the threshold.
  if (score >= elite)              return "Elite Thinker";
  if (score >= Math.floor(elite * 0.6)) return "Intellectual";
  if (score >= Math.floor(elite * 0.3)) return "Scholar";
  if (score >= Math.floor(elite * 0.1)) return "Thinker";
  return "Novice";
}

export async function awardRep(
  userId: string,
  eventType: string,
  description: string,
  referenceId?: number
) {
  const points = REP_VALUES[eventType] ?? 5;
  // Both writes are in a transaction so the event log and the denormalized
  // leaderboard score are always consistent — neither can succeed without the other.
  await db.transaction(async (tx) => {
    await tx.insert(reputationEventsTable).values({
      userId,
      eventType: eventType as any,
      points,
      description,
      referenceId: referenceId ?? null,
    });
    const [updated] = await tx
      .update(usersTable)
      .set({ reputationScore: sql`${usersTable.reputationScore} + ${points}` })
      .where(eq(usersTable.betterAuthId, userId))
      .returning({ reputationScore: usersTable.reputationScore });
    if (updated) {
      const newTitle = titleForScore(updated.reputationScore);
      await tx
        .update(usersTable)
        .set({ title: newTitle })
        .where(eq(usersTable.betterAuthId, userId));
    }
  });
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
