import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { reputationEventsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";



const router = Router();

export const REP_VALUES: Record<string, number> = {
  post_created: 10,
  post_liked: 3,
  article_created: 25,
  article_liked: 5,
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
  const points = REP_VALUES[eventType] ?? 5;
  await db.insert(reputationEventsTable).values({
    userId,
    eventType: eventType as any,
    points,
    description,
    referenceId: referenceId ?? null,
  });
  return points;
}

const BLOCKED_EVENT_TYPES = new Set(["streak_bonus"]);
const BLOCKED_DESCRIPTIONS = new Set(["repost", "streak"]);

const CLIENT_ALLOWED_EVENT_TYPES = new Set([
  "post_created",
  "post_liked",
  "article_created",
  "article_liked",
  "debate_joined",
  "daily_question_voted",
  "community_joined",
  "comment_posted",
  "content_saved",
  "profile_completed",
  "long_comment",
]);

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
  const { userId } = getAuth(req);
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

router.post("/reputation/award", (_req, res) => {
  res.status(403).json({ error: "Reputation is awarded automatically by server-side actions" });
});

export default router;
