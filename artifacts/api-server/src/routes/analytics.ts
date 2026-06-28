import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { reputationEventsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

const router = Router();

router.get("/analytics/me", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const events = await db
      .select()
      .from(reputationEventsTable)
      .where(eq(reputationEventsTable.userId, userId))
      .orderBy(asc(reputationEventsTable.createdAt));

    const totalRep = events.reduce((acc, e) => acc + e.points, 0);

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const repThisWeek = events
      .filter(e => e.createdAt >= weekAgo)
      .reduce((acc, e) => acc + e.points, 0);

    const countByType = (type: string) =>
      events.filter(e => e.eventType === type).length;

    const totals = {
      rep: totalRep,
      repThisWeek,
      articlesCreated: countByType("article_created"),
      debatesJoined: countByType("debate_joined"),
      postsCreated: countByType("post_created"),
      commentsPosted: countByType("comment_posted"),
    };

    // Rep earned per day for the last 14 days
    const repByDay = Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (13 - i));
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      const rep = events
        .filter(e => e.createdAt >= start && e.createdAt < end)
        .reduce((acc, e) => acc + e.points, 0);
      return {
        date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        rep,
      };
    });

    // Rep by category
    const repByCategory = { debates: 0, articles: 0, votes: 0, posts: 0, community: 0 };
    for (const e of events) {
      if (e.eventType === "debate_joined" || e.eventType === "debate_won") {
        repByCategory.debates += e.points;
      } else if (e.eventType === "article_created" || e.eventType === "article_liked") {
        repByCategory.articles += e.points;
      } else if (e.eventType === "community_joined") {
        repByCategory.community += e.points;
      } else if (e.eventType === "daily_question_voted" || e.eventType === "weekly_challenge_won") {
        repByCategory.votes += e.points;
      } else {
        repByCategory.posts += e.points;
      }
    }

    // Per-event-type breakdown
    const EVENT_LABELS: Record<string, string> = {
      post_created: "Posts Published",
      post_liked: "Likes Received",
      article_created: "Articles Published",
      article_liked: "Article Likes",
      debate_joined: "Debates Joined",
      debate_won: "Debates Won",
      daily_question_voted: "Daily Question Votes",
      weekly_challenge_won: "Weekly Challenges Won",
      community_joined: "Communities Joined",
      streak_bonus: "Streak Bonuses",
      comment_posted: "Comments Posted",
    };

    const eventBreakdown = Object.keys(EVENT_LABELS)
      .map(type => ({
        type,
        label: EVENT_LABELS[type],
        count: events.filter(e => e.eventType === type).length,
        totalPoints: events
          .filter(e => e.eventType === type)
          .reduce((acc, e) => acc + e.points, 0),
      }))
      .filter(e => e.count > 0)
      .sort((a, b) => b.totalPoints - a.totalPoints);

    res.json({ totals, repByDay, repByCategory, eventBreakdown });
  } catch (err) {
    req.log.error({ err }, "Failed to get analytics");
    res.status(500).json({ error: "Failed to get analytics" });
  }
});

export default router;
