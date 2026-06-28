import { Router } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { db } from "@workspace/db";
import { usersTable, notificationsTable, articleReviewRequestsTable, articlesTable, debatesTable, debateParticipantVotesTable, userPositionsTable } from "@workspace/db";
import { eq, desc, and, inArray } from "drizzle-orm";
import { sendWelcomeEmail } from "../lib/email";

const router = Router();

/**
 * JIT-provision a Treffin user profile for a Clerk user on their first API call.
 * Fetches their name/avatar from Clerk and creates a DB row automatically.
 */
async function jitProvisionUser(clerkId: string) {
  try {
    const clerkUser = await clerkClient.users.getUser(clerkId);
    const firstName = clerkUser.firstName ?? "";
    const lastName = clerkUser.lastName ?? "";
    const fullName = [firstName, lastName].filter(Boolean).join(" ") || "Treffin User";
    const avatarUrl = clerkUser.imageUrl ?? null;
    const primaryEmail = clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId,
    );
    const emailVerified = primaryEmail?.verification?.status === "verified";
    const email = primaryEmail?.emailAddress ?? "";

    const [newUser] = await db
      .insert(usersTable)
      .values({
        clerkId,
        name: fullName,
        title: "New Member",
        bio: null,
        avatarUrl,
        reputationScore: 0,
        followers: 0,
        following: 0,
        debatesJoined: 0,
        articlesPublished: 0,
        isVerified: false,
        streakDays: 0,
        interests: [],
        emailVerified,
      })
      .onConflictDoNothing()
      .returning();

    if (email && firstName) {
      void sendWelcomeEmail(email, firstName);
    }

    return newUser ?? null;
  } catch {
    return null;
  }
}

router.get("/users/me", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    let [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.clerkId, userId))
      .limit(1);

    // JIT provisioning: auto-create DB profile on first login
    if (!user) {
      const provisioned = await jitProvisionUser(userId);
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
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.clerkId, userId))
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
  try {
    const users = await db
      .select()
      .from(usersTable)
      .orderBy(desc(usersTable.reputationScore))
      .limit(5);

    res.json(users.map((u, i) => ({
      id: u.id,
      name: u.name,
      title: u.title,
      avatarUrl: u.avatarUrl ?? null,
      reputationScore: u.reputationScore,
      rank: i + 1,
    })));
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

async function computeDomainScores(userId: number, clerkId: string | null): Promise<Array<{ domain: string; score: number }>> {
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

  if (clerkId) {
    const participations = await db
      .select({ debateId: debateParticipantVotesTable.debateId })
      .from(debateParticipantVotesTable)
      .where(eq(debateParticipantVotesTable.userId, clerkId));

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
      .where(eq(debatesTable.creatorUserId, clerkId));

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

    const result = await computeDomainScores(id, user.clerkId ?? null);
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
      .select({ id: usersTable.id, clerkId: usersTable.clerkId })
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);

    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    if (!user.clerkId) {
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
      .where(eq(debateParticipantVotesTable.userId, user.clerkId))
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

const ALL_INTEREST_DOMAINS = ["Philosophy", "Science", "History", "Economics", "Law", "Logic", "Psychology", "Politics"] as const;

router.patch("/users/me/interests", async (req, res) => {
  const { userId } = getAuth(req);
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
    const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.clerkId, userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not synced yet" }); return; }

    await db.update(usersTable).set({ interests: interests as string[] }).where(eq(usersTable.clerkId, userId));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to update user interests");
    res.status(500).json({ error: "Failed to update user interests" });
  }
});

router.post("/users/me/positions", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { topic, stance } = req.body as { topic?: string; stance?: string };
  if (!topic?.trim() || !stance?.trim()) {
    res.status(400).json({ error: "topic and stance are required" }); return;
  }

  try {
    const [user] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.clerkId, userId))
      .limit(1);

    if (!user) { res.status(404).json({ error: "User not synced yet" }); return; }

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

    const { userId: actorClerkIdGuard } = getAuth(req);
    if (!actorClerkIdGuard) {
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

    if (target.clerkId === actorClerkIdGuard) {
      res.status(400).json({ error: "You cannot follow yourself" }); return;
    }

    await db
      .update(usersTable)
      .set({ followers: target.followers + 1 })
      .where(eq(usersTable.id, id));

    const { userId: actorClerkId } = getAuth(req);
    if (actorClerkId && target.clerkId && target.clerkId !== actorClerkId) {
      try {
        const [actor] = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.clerkId, actorClerkId))
          .limit(1);
        const actorName = actor?.name ?? "A Treffin member";
        const actorInitials = (actor?.name ?? "TM")
          .split(/\s+/)
          .map((p) => p[0])
          .filter(Boolean)
          .slice(0, 2)
          .join("")
          .toUpperCase();
        await db.insert(notificationsTable).values({
          userId: target.clerkId,
          type: "follow",
          title: "Someone followed you",
          body: `${actorName} started following you.`,
          actorName,
          actorInitials,
        });
      } catch (err) {
        req.log.error({ err, targetId: id }, "Failed to insert follow notification");
      }
    }

    res.json({ ok: true, followers: target.followers + 1 });
  } catch (err) {
    req.log.error({ err }, "Failed to follow user");
    res.status(500).json({ error: "Failed to follow user" });
  }
});

router.put("/users/me", async (req, res) => {
  const { userId } = getAuth(req);
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
      .where(eq(usersTable.clerkId, userId))
      .limit(1);

    if (existing) {
      const updates: Partial<typeof usersTable.$inferInsert> = { clerkId: userId };
      if (name) updates.name = name;
      if (title) updates.title = title;
      if (bio !== undefined) updates.bio = bio;
      if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;

      await db.update(usersTable).set(updates).where(eq(usersTable.clerkId, userId));
      res.json({ ok: true, id: existing.id });
    } else {
      const [inserted] = await db
        .insert(usersTable)
        .values({
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
        const clerkUser = await clerkClient.users.getUser(userId);
        const email = clerkUser.emailAddresses[0]?.emailAddress;
        const firstName = clerkUser.firstName ?? "";
        if (email) {
          void sendWelcomeEmail(email, firstName);
        }
      } catch (emailErr) {
        req.log.warn({ emailErr }, "Could not fetch Clerk user for welcome email");
      }
    }
  } catch (err) {
    req.log.error({ err }, "Failed to sync user");
    res.status(500).json({ error: "Failed to sync user" });
  }
});

export default router;
