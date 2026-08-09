import { Router } from "express";
import { logger } from "../lib/logger";
import { db } from "@workspace/db";
import { usersTable, notificationsTable, articleReviewRequestsTable, articlesTable, debatesTable, debateParticipantVotesTable, userPositionsTable } from "@workspace/db";
import { eq, desc, and, inArray, gte, sql } from "drizzle-orm";
import { reputationEventsTable } from "@workspace/db";
import { sendWelcomeEmail } from "../lib/email";
import { jitProvisionUser } from "../lib/jit-provision";

const router = Router();

router.get("/users/me", async (req, res) => {
  const userId = req.betterAuthSession?.user?.id ?? null;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    let [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.betterAuthId, userId))
      .limit(1);

    // JIT provisioning: auto-create DB profile on first login
    if (!user) {
      const provisioned = await jitProvisionUser(req.betterAuthSession?.user ?? null);
      if (!provisioned) {
        res.status(503).json({ error: "Could not create user profile. Please try again." });
        return;
      }
      user = provisioned;
    }

    res.json({
      id: user.id,
      name: user.name,
      title: user.title,
      bio: user.bio ?? null,
      avatarUrl: user.avatarUrl ?? null,
      reputationScore: user.reputationScore,
      followers: user.followers,
      following: user.following,
      debatesJoined: user.debatesJoined,
      articlesPublished: user.articlesPublished,
      isVerified: user.isVerified,
      streakDays: user.streakDays,
      interests: user.interests ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get current user");
    res.status(500).json({ error: "Failed to get current user" });
  }
});

router.get("/users/me/review-requests", async (req, res) => {
  const userId = req.betterAuthSession?.user?.id ?? null;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.betterAuthId, userId))
      .limit(1);

    if (!user) { res.status(404).json({ error: "User not synced yet" }); return; }

    const rows = await db
      .select({
        id: articleReviewRequestsTable.id,
        articleId: articleReviewRequestsTable.articleId,
        articleTitle: articlesTable.title,
        status: articleReviewRequestsTable.status,
        reviewerNote: articleReviewRequestsTable.reviewerNote,
        createdAt: articleReviewRequestsTable.createdAt,
      })
      .from(articleReviewRequestsTable)
      .innerJoin(articlesTable, eq(articleReviewRequestsTable.articleId, articlesTable.id))
      .where(eq(articleReviewRequestsTable.requesterId, user.id))
      .orderBy(desc(articleReviewRequestsTable.createdAt));

    res.json(rows.map(r => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get review requests");
    res.status(500).json({ error: "Failed to get review requests" });
  }
});

router.get("/users/top-thinkers", async (req, res) => {
  const period = (req.query.period as string) || "all_time";
  const LIMIT = 20;

  try {
    if (period === "all_time") {
      const users = await db
        .select()
        .from(usersTable)
        .orderBy(desc(usersTable.reputationScore))
        .limit(LIMIT);

      res.json(users.map((u, i) => ({
        id: u.id,
        name: u.name,
        title: u.title,
        avatarUrl: u.avatarUrl ?? null,
        reputationScore: u.reputationScore,
        periodRep: u.reputationScore,
        rank: i + 1,
      })));
      return;
    }

    // Compute cutoff for this_week / this_month
    const days = period === "this_week" ? 7 : 30;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Sum rep earned in the period per user
    const periodRows = await db
      .select({
        userId: reputationEventsTable.userId,
        periodRep: sql<number>`cast(sum(${reputationEventsTable.points}) as int)`,
      })
      .from(reputationEventsTable)
      .where(gte(reputationEventsTable.createdAt, cutoff))
      .groupBy(reputationEventsTable.userId)
      .orderBy(desc(sql`sum(${reputationEventsTable.points})`))
      .limit(LIMIT);

    if (periodRows.length === 0) {
      res.json([]);
      return;
    }

    const userIds = periodRows.map((r) => r.userId);
    // Try betterAuthId first (new users), fall back to clerkId (legacy users)
    const userRows = await db
      .select()
      .from(usersTable)
      .where(inArray(usersTable.betterAuthId, userIds));

    const userMap = new Map(userRows.map((u) => [u.betterAuthId, u]));

    const result = periodRows
      .map((r, i) => {
        const u = userMap.get(r.userId);
        if (!u) return null;
        return {
          id: u.id,
          name: u.name,
          title: u.title,
          avatarUrl: u.avatarUrl ?? null,
          reputationScore: u.reputationScore,
          periodRep: r.periodRep ?? 0,
          rank: i + 1,
        };
      })
      .filter(Boolean);

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get top thinkers");
    res.status(500).json({ error: "Failed to get top thinkers" });
  }
});

const DOMAIN_MAP: Record<string, string> = {
  philosophy: "Philosophy",
  ethics: "Philosophy",
  metaphysics: "Philosophy",
  science: "Science",
  ai: "Science",
  technology: "Science",
  biology: "Science",
  physics: "Science",
  history: "History",
  economics: "Economics",
  finance: "Economics",
  business: "Economics",
  law: "Law",
  justice: "Law",
  politics: "Politics",
  governance: "Politics",
  psychology: "Psychology",
  culture: "Psychology",
  sociology: "Psychology",
  logic: "Logic",
  mathematics: "Logic",
  linguistics: "Logic",
  reasoning: "Logic",
};

const ALL_DOMAINS = ["Philosophy", "Science", "History", "Economics", "Law", "Logic", "Psychology", "Politics"];

async function computeDomainScores(userId: number, legacyId: string | null): Promise<Array<{ domain: string; score: number }>> {
  const scores: Record<string, number> = {};
  for (const d of ALL_DOMAINS) scores[d] = 0;

  const userArticles = await db
    .select({ category: articlesTable.category })
    .from(articlesTable)
    .where(eq(articlesTable.authorId, userId));

  for (const a of userArticles) {
    if (!a.category) continue;
    const domain = DOMAIN_MAP[a.category.toLowerCase()];
    if (domain) scores[domain] = (scores[domain] ?? 0) + 15;
  }

  if (legacyId) {
    const participations = await db
      .select({ debateId: debateParticipantVotesTable.debateId })
      .from(debateParticipantVotesTable)
      .where(eq(debateParticipantVotesTable.userId, legacyId));

    const joinedDebateIds = participations.map(p => p.debateId);

    if (joinedDebateIds.length > 0) {
      const participated = await db
        .select({ category: debatesTable.category })
        .from(debatesTable)
        .where(inArray(debatesTable.id, joinedDebateIds));

      for (const d of participated) {
        const domain = DOMAIN_MAP[d.category.toLowerCase()];
        if (domain) scores[domain] = (scores[domain] ?? 0) + 10;
      }
    }

    const createdDebates = await db
      .select({ category: debatesTable.category })
      .from(debatesTable)
      .where(eq(debatesTable.creatorUserId, legacyId));

    for (const d of createdDebates) {
      const domain = DOMAIN_MAP[d.category.toLowerCase()];
      if (domain) scores[domain] = (scores[domain] ?? 0) + 5;
    }
  }

  const maxScore = Math.max(...Object.values(scores), 1);
  return ALL_DOMAINS.map(domain => ({
    domain,
    score: Math.min(100, Math.round((scores[domain] / maxScore) * 100)),
  }));
}

router.get("/users/:id/dna", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid user id" }); return; }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);

    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    // Pass either betterAuthId (new users) or clerkId (legacy) for participation lookups
    const legacyId = user.betterAuthId ?? user.clerkId ?? null;
    const result = await computeDomainScores(id, legacyId);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get user DNA");
    res.status(500).json({ error: "Failed to get user DNA" });
  }
});

router.get("/users/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "User not found" }); return;
    }

    res.json({
      id: user.id,
      name: user.name,
      title: user.title,
      bio: user.bio ?? null,
      avatarUrl: user.avatarUrl ?? null,
      reputationScore: user.reputationScore,
      followers: user.followers,
      following: user.following,
      debatesJoined: user.debatesJoined,
      articlesPublished: user.articlesPublished,
      isVerified: user.isVerified,
      streakDays: user.streakDays,
      interests: user.interests ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get user");
    res.status(500).json({ error: "Failed to get user" });
  }
});

router.get("/users/:id/debate-history", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid user id" }); return; }

    const [user] = await db
      .select({ id: usersTable.id, clerkId: usersTable.clerkId, betterAuthId: usersTable.betterAuthId })
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);

    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    // Use betterAuthId for new users, fall back to clerkId for legacy users
    const participantId = user.betterAuthId ?? user.clerkId;
    if (!participantId) {
      res.json([]);
      return;
    }

    const rows = await db
      .select({
        id: debateParticipantVotesTable.id,
        debateId: debateParticipantVotesTable.debateId,
        side: debateParticipantVotesTable.side,
        joinedAt: debateParticipantVotesTable.createdAt,
        debateTitle: debatesTable.title,
        category: debatesTable.category,
        supportPercent: debatesTable.supportPercent,
        againstPercent: debatesTable.againstPercent,
        participantCount: debatesTable.participantCount,
      })
      .from(debateParticipantVotesTable)
      .innerJoin(debatesTable, eq(debateParticipantVotesTable.debateId, debatesTable.id))
      .where(eq(debateParticipantVotesTable.userId, participantId))
      .orderBy(desc(debateParticipantVotesTable.createdAt));

    res.json(rows.map(r => ({
      id: r.id,
      debateId: r.debateId,
      debateTitle: r.debateTitle,
      category: r.category,
      side: r.side,
      supportPercent: r.supportPercent,
      againstPercent: r.againstPercent,
      participantCount: r.participantCount,
      joinedAt: r.joinedAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get user debate history");
    res.status(500).json({ error: "Failed to get user debate history" });
  }
});

router.get("/users/:id/positions", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid user id" }); return; }

    const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const positions = await db
      .select()
      .from(userPositionsTable)
      .where(eq(userPositionsTable.userId, id))
      .orderBy(desc(userPositionsTable.createdAt));

    // Group by topic preserving newest-first order within each group
    const grouped: Record<string, { id: number; userId: number; topic: string; stance: string; isRevised: boolean; createdAt: string }[]> = {};
    const topicOrder: string[] = [];
    for (const p of positions) {
      if (!grouped[p.topic]) {
        grouped[p.topic] = [];
        topicOrder.push(p.topic);
      }
      grouped[p.topic].push({
        id: p.id,
        userId: p.userId,
        topic: p.topic,
        stance: p.stance,
        isRevised: p.isRevised,
        createdAt: p.createdAt.toISOString(),
      });
    }

    res.json(topicOrder.map(topic => ({ topic, positions: grouped[topic] })));
  } catch (err) {
    req.log.error({ err }, "Failed to get user positions");
    res.status(500).json({ error: "Failed to get user positions" });
  }
});

const ALL_INTEREST_DOMAINS = ["Artificial Intelligence", "Philosophy", "Politics", "Science", "Economics", "Technology", "Psychology", "Culture", "History", "Ethics", "Law", "Logic"] as const;

router.patch("/users/me/interests", async (req, res) => {
  const userId = req.betterAuthSession?.user?.id ?? null;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { interests } = req.body as { interests?: unknown };
  if (!Array.isArray(interests) || interests.length < 3) {
    res.status(400).json({ error: "interests must contain at least 3 domains" }); return;
  }
  const invalid = interests.filter((d) => !ALL_INTEREST_DOMAINS.includes(d as (typeof ALL_INTEREST_DOMAINS)[number]));
  if (invalid.length > 0) {
    res.status(400).json({ error: `Unknown domains: ${invalid.join(", ")}` }); return;
  }

  try {
    const user = await jitProvisionUser(req.betterAuthSession?.user ?? null);
    if (!user) { res.status(503).json({ error: "Could not provision user account, try again" }); return; }

    await db.update(usersTable).set({ interests: interests as string[] }).where(eq(usersTable.betterAuthId, userId));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to update user interests");
    res.status(500).json({ error: "Failed to update user interests" });
  }
});

router.post("/users/me/positions", async (req, res) => {
  const userId = req.betterAuthSession?.user?.id ?? null;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { topic, stance } = req.body as { topic?: string; stance?: string };
  if (!topic?.trim() || !stance?.trim()) {
    res.status(400).json({ error: "topic and stance are required" }); return;
  }

  try {
    const user = await jitProvisionUser(req.betterAuthSession?.user ?? null);
    if (!user) { res.status(503).json({ error: "Could not provision user account, try again" }); return; }

    const inserted = await db.transaction(async (tx) => {
      // Mark all existing active positions on this topic as revised atomically
      await tx
        .update(userPositionsTable)
        .set({ isRevised: true })
        .where(and(eq(userPositionsTable.userId, user.id), eq(userPositionsTable.topic, topic.trim()), eq(userPositionsTable.isRevised, false)));

      const [row] = await tx
        .insert(userPositionsTable)
        .values({ userId: user.id, topic: topic.trim(), stance: stance.trim() })
        .returning();
      return row;
    });

    res.status(201).json({
      id: inserted.id,
      userId: inserted.userId,
      topic: inserted.topic,
      stance: inserted.stance,
      isRevised: inserted.isRevised,
      createdAt: inserted.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create user position");
    res.status(500).json({ error: "Failed to create user position" });
  }
});

router.post("/users/:id/follow", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid user id" }); return;
    }

    const actorUserId = req.betterAuthSession?.user?.id ?? null;
    if (!actorUserId) {
      res.status(401).json({ error: "Sign in to follow" }); return;
    }

    const [target] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);

    if (!target) {
      res.status(404).json({ error: "User not found" }); return;
    }

    // Prevent self-follow — check against both betterAuthId and clerkId for bridge safety
    if (target.betterAuthId === actorUserId || target.clerkId === actorUserId) {
      res.status(400).json({ error: "You cannot follow yourself" }); return;
    }

    await db
      .update(usersTable)
      .set({ followers: target.followers + 1 })
      .where(eq(usersTable.id, id));

    // Insert follow notification for the target user
    try {
      const [actor] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.betterAuthId, actorUserId))
        .limit(1);

      const actorName = actor?.name ?? "A Treffin member";
      const actorInitials = (actor?.name ?? "TM")
        .split(/\s+/)
        .map((p) => p[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase();

      // Deliver notification to the target's current identity (betterAuthId takes precedence)
      const notifTargetId = target.betterAuthId ?? target.clerkId;
      if (notifTargetId && notifTargetId !== actorUserId) {
        await db.insert(notificationsTable).values({
          userId: notifTargetId,
          type: "follow",
          title: "Someone followed you",
          body: `${actorName} started following you.`,
          actorName,
          actorInitials,
        });
      }
    } catch (err) {
      req.log.error({ err, targetId: id }, "Failed to insert follow notification");
    }

    res.json({ ok: true, followers: target.followers + 1 });
  } catch (err) {
    req.log.error({ err }, "Failed to follow user");
    res.status(500).json({ error: "Failed to follow user" });
  }
});

router.put("/users/me", async (req, res) => {
  const userId = req.betterAuthSession?.user?.id ?? null;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { name, title, bio, avatarUrl } = req.body as {
    name?: string;
    title?: string;
    bio?: string;
    avatarUrl?: string;
  };

  try {
    const [existing] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.betterAuthId, userId))
      .limit(1);

    if (existing) {
      const updates: Partial<typeof usersTable.$inferInsert> = {};
      if (name) updates.name = name;
      if (title) updates.title = title;
      if (bio !== undefined) updates.bio = bio;
      if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;

      await db.update(usersTable).set(updates).where(eq(usersTable.betterAuthId, userId));
      res.json({ ok: true, id: existing.id });
    } else {
      const [inserted] = await db
        .insert(usersTable)
        .values({
          betterAuthId: userId,
          // Keep legacy identity-backed relations valid for newly synced users.
          clerkId: userId,
          name: name ?? "New Thinker",
          title: title ?? "Member",
          bio: bio ?? null,
          avatarUrl: avatarUrl ?? null,
        })
        .returning();

      res.json({ ok: true, id: inserted.id });

      // Fire-and-forget welcome email for new signups
      try {
        const sessionUser = req.betterAuthSession?.user;
        if (sessionUser?.email) {
          const firstName = sessionUser.name?.split(" ")[0] ?? "";
          void sendWelcomeEmail(sessionUser.email, firstName);
        }
      } catch (emailErr) {
        logger.warn({ emailErr }, "Could not send welcome email on profile creation");
      }
    }
  } catch (err) {
    req.log.error({ err }, "Failed to sync user");
    res.status(500).json({ error: "Failed to sync user" });
  }
});

export default router;
