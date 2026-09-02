import { Router } from "express";
import { db } from "@workspace/db";
import { communitiesTable, communityMembersTable, postsTable, usersTable, postLikesTable } from "@workspace/db";
import { eq, desc, and, sql, inArray, gte, isNotNull } from "drizzle-orm";
import { createNotification } from "../lib/notify";
import { jitProvisionUser } from "../lib/jit-provision";
import { awardRep } from "./reputation";

const router = Router();

router.get("/communities", async (req, res) => {
  try {
    const clerkId = req.betterAuthSession?.user?.id ?? null;

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [communities, recentPostCounts] = await Promise.all([
      db.select().from(communitiesTable).orderBy(desc(communitiesTable.memberCount)),
      db
        .select({ communityId: postsTable.communityId, count: sql<number>`count(*)::int` })
        .from(postsTable)
        .where(and(isNotNull(postsTable.communityId), gte(postsTable.createdAt, oneDayAgo)))
        .groupBy(postsTable.communityId),
    ]);

    const postsPerDayMap = new Map<number, number>(
      recentPostCounts
        .filter(r => r.communityId !== null)
        .map(r => [r.communityId as number, r.count])
    );

    let membershipMap = new Map<number, string>();
    if (clerkId) {
      const [currentUser] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.betterAuthId, clerkId)).limit(1);
      if (currentUser) {
        const rows = await db
          .select({ communityId: communityMembersTable.communityId, status: communityMembersTable.status })
          .from(communityMembersTable)
          .where(eq(communityMembersTable.userId, currentUser.id));
        membershipMap = new Map(rows.map(r => [r.communityId, r.status]));
      }
    }

    res.json(communities.map(c => {
      const status = membershipMap.get(c.id);
      return {
        id: c.id,
        name: c.name,
        description: c.description,
        emoji: c.emoji,
        category: c.category,
        badge: c.badge,
        badgeColor: c.badgeColor,
        gradient: c.gradient,
        isPrivate: c.isPrivate,
        isLive: c.isLive,
        memberCount: c.memberCount,
        postsPerDay: postsPerDayMap.get(c.id) ?? 0,
        totalPosts: c.totalPosts,
        isMember: status === "member",
        joinStatus: status === "member" ? "member" : status === "pending" ? "pending" : "none",
      };
    }));
  } catch (err) {
    req.log.error({ err }, "Failed to get communities");
    res.status(500).json({ error: "Failed to get communities" });
  }
});

router.post("/communities", async (req, res) => {
  try {
    const { name, description, emoji, category, isPrivate, rules } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ error: "Name is required" }); return;
    }

    const clerkId = req.betterAuthSession?.user?.id ?? null;
    if (!clerkId) { res.status(401).json({ error: "Sign in required" }); return; }
    let [creatorUser] = await db.select().from(usersTable).where(eq(usersTable.betterAuthId, clerkId)).limit(1);
    if (!creatorUser) {
      const provisioned = await jitProvisionUser(req.betterAuthSession?.user ?? null);
      if (!provisioned) { res.status(503).json({ error: "Could not create user profile. Please try again." }); return; }
      creatorUser = provisioned;
    }
    const creatorId = creatorUser.id;

    const gradient = pickGradient(category);
    const badge = isPrivate ? "Private" : "New";
    const badgeColor = isPrivate
      ? "text-yellow-300 bg-yellow-400/10 border-yellow-400/25"
      : "text-emerald-300 bg-emerald-400/10 border-emerald-400/20";

    const defaultRules = [
      "Be respectful and constructive",
      "Back claims with evidence",
      "No personal attacks",
      "Stay on topic",
      "Quality over quantity",
    ];
    const communityRules: string[] = Array.isArray(rules) && rules.length > 0
      ? rules.slice(0, 10).map((r: string) => String(r).trim()).filter(Boolean)
      : defaultRules;

    const [community] = await db
      .insert(communitiesTable)
      .values({
        name: name.trim(),
        description: description?.trim() ?? "",
        emoji: emoji ?? "💬",
        category: category ?? "General",
        badge,
        badgeColor,
        gradient,
        isPrivate: Boolean(isPrivate),
        isLive: false,
        memberCount: 1,
        postsPerDay: 0,
        totalPosts: 0,
        creatorId,
        rules: communityRules,
      })
      .returning();

    await db.insert(communityMembersTable).values({
      communityId: community.id,
      userId: creatorId,
      role: "moderator",
      status: "member",
    });

    res.status(201).json({
      id: community.id,
      name: community.name,
      description: community.description,
      emoji: community.emoji,
      category: community.category,
      badge: community.badge,
      badgeColor: community.badgeColor,
      gradient: community.gradient,
      isPrivate: community.isPrivate,
      isLive: community.isLive,
      memberCount: community.memberCount,
      postsPerDay: community.postsPerDay,
      totalPosts: community.totalPosts,
      creatorId: community.creatorId ?? null,
      rules: community.rules ?? defaultRules,
      isMember: true,
      joinStatus: "member",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create community");
    res.status(500).json({ error: "Failed to create community" });
  }
});

router.get("/communities/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const [community] = await db
      .select()
      .from(communitiesTable)
      .where(eq(communitiesTable.id, id))
      .limit(1);

    if (!community) { res.status(404).json({ error: "Community not found" }); return; }

    const clerkId = req.betterAuthSession?.user?.id ?? null;

    const [memberRows, postsToday] = await Promise.all([
      db
        .select({
          userId: communityMembersTable.userId,
          role: communityMembersTable.role,
          status: communityMembersTable.status,
          name: usersTable.name,
          title: usersTable.title,
          avatarUrl: usersTable.avatarUrl,
          isVerified: usersTable.isVerified,
          reputationScore: usersTable.reputationScore,
        })
        .from(communityMembersTable)
        .leftJoin(usersTable, eq(communityMembersTable.userId, usersTable.id))
        .where(and(eq(communityMembersTable.communityId, id), eq(communityMembersTable.status, "member")))
        .limit(20),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(postsTable)
        .where(and(
          eq(postsTable.communityId, id),
          sql`${postsTable.createdAt} > NOW() - INTERVAL '1 day'`
        )),
    ]);

    const postsPerDay = postsToday[0]?.count ?? 0;
    const memberDetails = memberRows.map((m) => ({
      userId: m.userId,
      role: m.role,
      name: m.name ?? "Unknown",
      title: m.title ?? "",
      avatarUrl: m.avatarUrl ?? null,
      isVerified: m.isVerified ?? false,
      reputationScore: m.reputationScore ?? 0,
    }));

    const defaultRules = ["Be respectful and constructive", "Back claims with evidence", "No personal attacks", "Stay on topic", "Quality over quantity"];

    let joinStatus: "none" | "pending" | "member" = "none";
    if (clerkId) {
      const [currentUser] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.betterAuthId, clerkId)).limit(1);
      if (currentUser) {
        const [membership] = await db
          .select({ status: communityMembersTable.status })
          .from(communityMembersTable)
          .where(and(eq(communityMembersTable.communityId, id), eq(communityMembersTable.userId, currentUser.id)))
          .limit(1);
        if (membership) {
          joinStatus = membership.status === "member" ? "member" : "pending";
        }
      }
    }

    res.json({
      id: community.id,
      name: community.name,
      description: community.description,
      emoji: community.emoji,
      category: community.category,
      badge: community.badge,
      badgeColor: community.badgeColor,
      gradient: community.gradient,
      isPrivate: community.isPrivate,
      isLive: community.isLive,
      memberCount: community.memberCount,
      postsPerDay,
      totalPosts: community.totalPosts,
      creatorId: community.creatorId ?? null,
      rules: community.rules ?? defaultRules,
      members: memberDetails,
      isMember: joinStatus === "member",
      joinStatus,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get community");
    res.status(500).json({ error: "Failed to get community" });
  }
});

router.post("/communities/:id/join", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const [community] = await db
      .select()
      .from(communitiesTable)
      .where(eq(communitiesTable.id, id))
      .limit(1);

    if (!community) { res.status(404).json({ error: "Community not found" }); return; }

    const clerkId = req.betterAuthSession?.user?.id ?? null;
    if (!clerkId) { res.status(401).json({ error: "Sign in required" }); return; }
    let [joinUser] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.betterAuthId, clerkId)).limit(1);
    if (!joinUser) {
      const provisioned = await jitProvisionUser(req.betterAuthSession?.user ?? null);
      if (!provisioned) { res.status(503).json({ error: "Could not create user profile. Please try again." }); return; }
      joinUser = provisioned;
    }
    const userId = joinUser.id;

    const [existing] = await db
      .select()
      .from(communityMembersTable)
      .where(and(eq(communityMembersTable.communityId, id), eq(communityMembersTable.userId, userId)))
      .limit(1);

    if (existing) {
      const joinStatus = existing.status === "member" ? "member" : "pending";
      res.json({ memberCount: community.memberCount, joined: existing.status === "member", joinStatus });
      return;
    }

    const newStatus = community.isPrivate ? "pending" : "member";
    await db.insert(communityMembersTable).values({ communityId: id, userId, role: "member", status: newStatus });

    let memberCount = community.memberCount;
    if (!community.isPrivate) {
      const [updated] = await db
        .update(communitiesTable)
        .set({ memberCount: sql`${communitiesTable.memberCount} + 1` })
        .where(eq(communitiesTable.id, id))
        .returning();
      memberCount = updated.memberCount;
    }

    // Award rep for joining a public community (not pending ones)
    if (!community.isPrivate) {
      try {
        await awardRep(clerkId, "community_joined", `Joined community: ${community.name}`, id);
      } catch { /* non-blocking */ }
    }

    res.json({
      memberCount,
      joined: !community.isPrivate,
      joinStatus: newStatus,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to join community");
    res.status(500).json({ error: "Failed to join community" });
  }
});

router.delete("/communities/:id/leave", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const clerkId = req.betterAuthSession?.user?.id ?? null;
    if (!clerkId) { res.status(401).json({ error: "Sign in required" }); return; }
    let [leaveUser] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.betterAuthId, clerkId)).limit(1);
    if (!leaveUser) {
      const provisioned = await jitProvisionUser(req.betterAuthSession?.user ?? null);
      if (!provisioned) { res.status(503).json({ error: "Could not create user profile. Please try again." }); return; }
      leaveUser = provisioned;
    }
    const userId = leaveUser.id;

    const [community] = await db.select({ creatorId: communitiesTable.creatorId }).from(communitiesTable).where(eq(communitiesTable.id, id)).limit(1);
    if (!community) { res.status(404).json({ error: "Community not found" }); return; }
    if (community.creatorId === userId) { res.status(409).json({ error: "Transfer community ownership before leaving" }); return; }

    const [existing] = await db
      .select({ status: communityMembersTable.status })
      .from(communityMembersTable)
      .where(and(eq(communityMembersTable.communityId, id), eq(communityMembersTable.userId, userId)))
      .limit(1);

    await db
      .delete(communityMembersTable)
      .where(and(eq(communityMembersTable.communityId, id), eq(communityMembersTable.userId, userId)));

    let memberCount: number;
    if (existing?.status === "member") {
      const [updated] = await db
        .update(communitiesTable)
        .set({ memberCount: sql`GREATEST(${communitiesTable.memberCount} - 1, 0)` })
        .where(eq(communitiesTable.id, id))
        .returning();
      memberCount = updated.memberCount;
    } else {
      const [community] = await db.select({ memberCount: communitiesTable.memberCount }).from(communitiesTable).where(eq(communitiesTable.id, id)).limit(1);
      memberCount = community?.memberCount ?? 0;
    }

    res.json({ memberCount, joined: false, joinStatus: "none" });
  } catch (err) {
    req.log.error({ err }, "Failed to leave community");
    res.status(500).json({ error: "Failed to leave community" });
  }
});

router.get("/communities/:id/requests", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const clerkId = req.betterAuthSession?.user?.id ?? null;
    if (!clerkId) { res.status(401).json({ error: "Sign in required" }); return; }

    const [community] = await db.select().from(communitiesTable).where(eq(communitiesTable.id, id)).limit(1);
    if (!community) { res.status(404).json({ error: "Community not found" }); return; }

    let [requestUser] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.betterAuthId, clerkId)).limit(1);
    if (!requestUser) {
      const provisioned = await jitProvisionUser(req.betterAuthSession?.user ?? null);
      if (!provisioned) { res.status(503).json({ error: "Could not create user profile. Please try again." }); return; }
      requestUser = provisioned;
    }

    if (community.creatorId !== requestUser.id) {
      res.status(403).json({ error: "Only the creator can view join requests" }); return;
    }

    const rows = await db
      .select({
        userId: communityMembersTable.userId,
        joinedAt: communityMembersTable.joinedAt,
        name: usersTable.name,
        title: usersTable.title,
        avatarUrl: usersTable.avatarUrl,
        reputationScore: usersTable.reputationScore,
      })
      .from(communityMembersTable)
      .leftJoin(usersTable, eq(communityMembersTable.userId, usersTable.id))
      .where(and(eq(communityMembersTable.communityId, id), eq(communityMembersTable.status, "pending")));

    res.json(rows.map(r => ({
      userId: r.userId,
      name: r.name ?? "Unknown",
      title: r.title ?? "",
      avatarUrl: r.avatarUrl ?? null,
      reputationScore: r.reputationScore ?? 0,
      joinedAt: r.joinedAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get join requests");
    res.status(500).json({ error: "Failed to get join requests" });
  }
});

router.post("/communities/:id/requests/:userId/approve", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const targetUserId = Number(req.params.userId);
    if (isNaN(id) || isNaN(targetUserId)) { res.status(400).json({ error: "Invalid id" }); return; }

    const clerkId = req.betterAuthSession?.user?.id ?? null;
    if (!clerkId) { res.status(401).json({ error: "Sign in required" }); return; }

    const [community] = await db.select().from(communitiesTable).where(eq(communitiesTable.id, id)).limit(1);
    if (!community) { res.status(404).json({ error: "Community not found" }); return; }

    const [approver] = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.betterAuthId, clerkId)).limit(1);
    if (!approver || community.creatorId !== approver.id) {
      res.status(403).json({ error: "Only the creator can approve requests" }); return;
    }

    const approved = await db.transaction(async (tx) => {
      const rows = await tx
        .update(communityMembersTable)
        .set({ status: "member" })
        .where(and(
          eq(communityMembersTable.communityId, id),
          eq(communityMembersTable.userId, targetUserId),
          eq(communityMembersTable.status, "pending"),
        ))
        .returning({ userId: communityMembersTable.userId });
      if (rows.length === 0) return false;
      await tx
        .update(communitiesTable)
        .set({ memberCount: sql`(SELECT count(*)::int FROM ${communityMembersTable} WHERE ${communityMembersTable.communityId} = ${id} AND ${communityMembersTable.status} = 'member')` })
        .where(eq(communitiesTable.id, id));
      return true;
    });
    if (!approved) {
      res.status(409).json({ error: "Join request is no longer pending" }); return;
    }

    void createNotification(
      {
        targetDbUserId: targetUserId,
        actorClerkId: clerkId,
        actorDisplayName: approver.name ?? undefined,
        type: "community",
        title: "Join request approved",
        body: `You've been approved to join ${community.name}`,
      },
      req.log,
    ).catch((err) => req.log.error({ err }, "Failed to send approval notification"));

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to approve join request");
    res.status(500).json({ error: "Failed to approve join request" });
  }
});

router.delete("/communities/:id/requests/:userId/deny", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const targetUserId = Number(req.params.userId);
    if (isNaN(id) || isNaN(targetUserId)) { res.status(400).json({ error: "Invalid id" }); return; }

    const clerkId = req.betterAuthSession?.user?.id ?? null;
    if (!clerkId) { res.status(401).json({ error: "Sign in required" }); return; }

    const [community] = await db.select().from(communitiesTable).where(eq(communitiesTable.id, id)).limit(1);
    if (!community) { res.status(404).json({ error: "Community not found" }); return; }

    const [denier] = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.betterAuthId, clerkId)).limit(1);
    if (!denier || community.creatorId !== denier.id) {
      res.status(403).json({ error: "Only the creator can deny requests" }); return;
    }

    await db
      .delete(communityMembersTable)
      .where(and(eq(communityMembersTable.communityId, id), eq(communityMembersTable.userId, targetUserId)));

    void createNotification(
      {
        targetDbUserId: targetUserId,
        actorClerkId: clerkId,
        actorDisplayName: denier.name ?? undefined,
        type: "community",
        title: "Join request not approved",
        body: `Your request to join ${community.name} was not approved`,
      },
      req.log,
    ).catch((err) => req.log.error({ err }, "Failed to send denial notification"));

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to deny join request");
    res.status(500).json({ error: "Failed to deny join request" });
  }
});

router.get("/communities/:id/posts", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const clerkId = req.betterAuthSession?.user?.id ?? null;
    let requestingUserId: number | null = null;
    if (clerkId) {
      const [dbUser] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.betterAuthId, clerkId)).limit(1);
      requestingUserId = dbUser?.id ?? null;
    }

    const postRows = await db
      .select({ post: postsTable, author: usersTable })
      .from(postsTable)
      .leftJoin(usersTable, eq(postsTable.authorId, usersTable.id))
      .where(eq(postsTable.communityId, id))
      .orderBy(desc(postsTable.createdAt))
      .limit(20);

    const postIds = postRows.map(r => r.post.id);
    const likedSet = new Set<number>();
    if (clerkId && postIds.length > 0) {
      const likedRows = await db
        .select({ postId: postLikesTable.postId })
        .from(postLikesTable)
        .where(and(
          inArray(postLikesTable.postId, postIds),
          eq(postLikesTable.userId, clerkId),
        ));
      likedRows.forEach(r => likedSet.add(r.postId));
    }

    const result = postRows.map(({ post, author }) => {
      return {
        id: post.id,
        type: post.type,
        authorId: post.authorId,
        authorName: author?.name ?? "Unknown",
        authorTitle: author?.title ?? "",
        authorAvatar: author?.avatarUrl ?? null,
        isVerified: author?.isVerified ?? false,
        createdAt: post.createdAt.toISOString(),
        content: post.content ?? null,
        title: post.title ?? null,
        excerpt: post.excerpt ?? null,
        imageUrl: post.imageUrl ?? null,
        topic: post.topic ?? null,
        readTime: post.readTime ?? null,
        likes: post.likes,
        comments: post.comments,
        reposts: post.reposts,
        saved: post.saved,
        isAnonymous: post.isAnonymous,
        isOwner: requestingUserId !== null && post.authorId === requestingUserId,
        liked: likedSet.has(post.id),
      };
    });

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get community posts");
    res.status(500).json({ error: "Failed to get community posts" });
  }
});

router.post("/communities/:id/transfer-ownership", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const targetUserId = Number(req.body?.userId);
    if (!Number.isInteger(id) || !Number.isInteger(targetUserId)) { res.status(400).json({ error: "Valid community id and userId are required" }); return; }
    const actorId = req.betterAuthSession?.user?.id ?? null;
    if (!actorId) { res.status(401).json({ error: "Sign in required" }); return; }
    const actor = await jitProvisionUser(req.betterAuthSession?.user ?? null);
    if (!actor) { res.status(503).json({ error: "Could not create user profile" }); return; }
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(4, ${id})`);
      const [community] = await tx.select().from(communitiesTable).where(eq(communitiesTable.id, id)).limit(1);
      if (!community) return { kind: "missing" as const };
      if (community.creatorId !== actor.id) return { kind: "forbidden" as const };
      if (targetUserId === actor.id) return { kind: "same" as const };
      const [target] = await tx.select({ userId: communityMembersTable.userId }).from(communityMembersTable)
        .where(and(eq(communityMembersTable.communityId, id), eq(communityMembersTable.userId, targetUserId), eq(communityMembersTable.status, "member"))).limit(1);
      if (!target) return { kind: "not-member" as const };
      await tx.update(communitiesTable).set({ creatorId: targetUserId }).where(eq(communitiesTable.id, id));
      await tx.update(communityMembersTable).set({ role: "member" }).where(and(eq(communityMembersTable.communityId, id), eq(communityMembersTable.userId, actor.id)));
      await tx.update(communityMembersTable).set({ role: "moderator" }).where(and(eq(communityMembersTable.communityId, id), eq(communityMembersTable.userId, targetUserId)));
      return { kind: "ok" as const, name: community.name };
    });
    if (result.kind === "missing") { res.status(404).json({ error: "Community not found" }); return; }
    if (result.kind === "forbidden") { res.status(403).json({ error: "Only the current owner can transfer ownership" }); return; }
    if (result.kind === "same") { res.status(409).json({ error: "You already own this community" }); return; }
    if (result.kind === "not-member") { res.status(409).json({ error: "The new owner must be an approved member" }); return; }
    createNotification({ targetDbUserId: targetUserId, actorClerkId: actorId, actorDisplayName: actor.name, type: "community", title: "Community ownership transferred", body: `You are now the owner of ${result.name}` }, req.log)
      .catch((err) => req.log.warn({ err, communityId: id }, "Failed to notify new community owner"));
    res.json({ ok: true, creatorId: targetUserId });
  } catch (err) {
    req.log.error({ err }, "Failed to transfer community ownership");
    res.status(500).json({ error: "Failed to transfer ownership" });
  }
});
router.patch("/communities/:id/rules", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const [community] = await db.select().from(communitiesTable).where(eq(communitiesTable.id, id)).limit(1);
    if (!community) { res.status(404).json({ error: "Community not found" }); return; }

    const clerkId = req.betterAuthSession?.user?.id ?? null;
    if (!clerkId) { res.status(401).json({ error: "Sign in required" }); return; }
    const rulesUser = await jitProvisionUser(req.betterAuthSession?.user ?? null);
    if (!rulesUser) { res.status(503).json({ error: "Could not provision user account, try again" }); return; }
    const userId = rulesUser.id;

    if (community.creatorId && community.creatorId !== userId) {
      res.status(403).json({ error: "Only the creator can edit rules" }); return;
    }

    const { rules } = req.body as { rules: string[] };
    if (!Array.isArray(rules)) { res.status(400).json({ error: "rules must be an array" }); return; }

    const cleaned = rules.slice(0, 10).map((r) => String(r).trim()).filter(Boolean);

    const oneDayAgoRules = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [[updated], recentRulesPosts] = await Promise.all([
      db.update(communitiesTable).set({ rules: cleaned }).where(eq(communitiesTable.id, id)).returning(),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(postsTable)
        .where(and(eq(postsTable.communityId, id), gte(postsTable.createdAt, oneDayAgoRules))),
    ]);

    const defaultRules = ["Be respectful and constructive", "Back claims with evidence", "No personal attacks", "Stay on topic", "Quality over quantity"];
    res.json({
      id: updated.id,
      name: updated.name,
      description: updated.description,
      emoji: updated.emoji,
      category: updated.category,
      badge: updated.badge,
      badgeColor: updated.badgeColor,
      gradient: updated.gradient,
      isPrivate: updated.isPrivate,
      isLive: updated.isLive,
      memberCount: updated.memberCount,
      postsPerDay: recentRulesPosts[0]?.count ?? 0,
      totalPosts: updated.totalPosts,
      creatorId: updated.creatorId ?? null,
      rules: updated.rules ?? defaultRules,
      members: [],
      isMember: true,
      joinStatus: "member",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update community rules");
    res.status(500).json({ error: "Failed to update rules" });
  }
});

router.post("/communities/:id/posts", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const clerkId = req.betterAuthSession?.user?.id ?? null;
    if (!clerkId) { res.status(401).json({ error: "Sign in required" }); return; }
    let [postAuthor] = await db.select().from(usersTable).where(eq(usersTable.betterAuthId, clerkId)).limit(1);
    if (!postAuthor) {
      const provisioned = await jitProvisionUser(req.betterAuthSession?.user ?? null);
      if (!provisioned) { res.status(503).json({ error: "Could not create user profile. Please try again." }); return; }
      postAuthor = provisioned;
    }

    const { content, type, topic } = req.body;
    if (!content?.trim()) {
      res.status(400).json({ error: "Content is required" }); return;
    }

    const [community] = await db
      .select()
      .from(communitiesTable)
      .where(eq(communitiesTable.id, id))
      .limit(1);

    if (!community) { res.status(404).json({ error: "Community not found" }); return; }

    const [membership] = await db
      .select({ status: communityMembersTable.status })
      .from(communityMembersTable)
      .where(and(eq(communityMembersTable.communityId, id), eq(communityMembersTable.userId, postAuthor.id)))
      .limit(1);

    if (!membership || membership.status !== "member") {
      res.status(403).json({ error: "You must be a member to post in this community" }); return;
    }

    const [post] = await db
      .insert(postsTable)
      .values({
        content: content.trim(),
        type: type ?? "opinion",
        topic: topic ?? null,
        authorId: postAuthor.id,
        communityId: id,
      })
      .returning();

    await db
      .update(communitiesTable)
      .set({ totalPosts: sql`${communitiesTable.totalPosts} + 1` })
      .where(eq(communitiesTable.id, id));

    res.status(201).json({
      id: post.id,
      type: post.type,
      authorId: post.authorId,
      authorName: postAuthor.name ?? "Unknown",
      authorTitle: postAuthor.title ?? "",
      authorAvatar: postAuthor.avatarUrl ?? null,
      isVerified: postAuthor.isVerified ?? false,
      createdAt: post.createdAt.toISOString(),
      content: post.content ?? null,
      title: null,
      excerpt: null,
      imageUrl: null,
      topic: post.topic ?? null,
      readTime: null,
      likes: 0,
      comments: 0,
      reposts: 0,
      saved: false,
      isAnonymous: false,
      isOwner: true,
      liked: false,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create community post");
    res.status(500).json({ error: "Failed to create community post" });
  }
});

function pickGradient(category?: string): string {
  const map: Record<string, string> = {
    Technology: "from-blue-600/25 via-indigo-900/15 to-card border-blue-500/25",
    Philosophy: "from-violet-600/25 via-purple-900/15 to-card border-violet-500/25",
    Politics: "from-rose-600/20 via-red-900/15 to-card border-rose-500/20",
    Startups: "from-emerald-600/20 via-green-900/15 to-card border-emerald-500/20",
    Science: "from-teal-600/20 via-cyan-900/15 to-card border-teal-500/20",
    Exclusive: "from-yellow-600/20 via-amber-900/15 to-card border-yellow-500/20",
  };
  return map[category ?? ""] ?? "from-violet-600/25 via-purple-900/15 to-card border-violet-500/25";
}

export default router;
