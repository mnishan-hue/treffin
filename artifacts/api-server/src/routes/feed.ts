import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { postsTable, usersTable, commentsTable, postReportsTable, modAuditLogTable, postLikesTable, commentLikesTable } from "@workspace/db";
import { eq, desc, and, or, isNotNull, sql, gte, inArray } from "drizzle-orm";
import { createNotification } from "../lib/notify";
import { checkToxicity, detectAiContent } from "../lib/content-moderation";

const router = Router();

function recencyBonus(createdAt: Date): number {
  const ageHours = (Date.now() - createdAt.getTime()) / 3600000;
  if (ageHours < 6) return 20;
  if (ageHours < 24) return 10;
  if (ageHours < 72) return 5;
  return 0;
}

function engagementScore(post: { likes: number; comments: number; reposts: number; createdAt: Date }): number {
  return post.likes * 2 + post.comments * 3 + post.reposts + recencyBonus(post.createdAt);
}

// Hacker News-style gravity: hot content rises fast, then decays.
// score = engagement / (ageHours + 2)^gravity
function trendingScore(post: { likes: number; comments: number; reposts: number; createdAt: Date }): number {
  const ageHours = (Date.now() - post.createdAt.getTime()) / 3600000;
  const engagement = post.likes * 2 + post.comments * 3 + post.reposts * 1.5 + 1;
  return engagement / Math.pow(ageHours + 2, 1.8);
}

function buildPostResponse(
  post: typeof postsTable.$inferSelect,
  author: typeof usersTable.$inferSelect | undefined,
  timeAgo: string,
  requestingUserId: number | null,
  liked = false,
) {
  const isOwner = requestingUserId !== null && post.authorId === requestingUserId;
  const isAnonymous = post.isAnonymous && !isOwner;

  return {
    id: post.id,
    type: post.type,
    authorId: isAnonymous ? 0 : post.authorId,
    authorName: isAnonymous ? "Anonymous Thinker" : (author?.name ?? "Unknown"),
    authorTitle: isAnonymous ? "" : (author?.title ?? ""),
    authorAvatar: isAnonymous ? null : (author?.avatarUrl ?? null),
    isVerified: isAnonymous ? false : (author?.isVerified ?? false),
    createdAt: timeAgo,
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
    isOwner,
    liked,
  };
}

router.get("/feed", async (req, res) => {
  try {
    const { tab, authorId } = req.query as { tab?: string; authorId?: string };
    const authorIdNum = authorId ? Number(authorId) : undefined;

    const typeFilter =
      tab === "articles" ? eq(postsTable.type, "article")
      : tab === "debates" ? or(eq(postsTable.type, "debate_room"), eq(postsTable.type, "debate"))
      : tab === "communities" ? isNotNull(postsTable.communityId)
      : undefined;

    const { userId: clerkId } = getAuth(req);
    let requestingUserId: number | null = null;
    if (clerkId) {
      const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1);
      requestingUserId = dbUser?.id ?? null;
    }

    const authorFilter = authorIdNum && !isNaN(authorIdNum) ? eq(postsTable.authorId, authorIdNum) : undefined;

    // When filtering by authorId for a non-owner, exclude anonymous posts to prevent
    // identity inference (a third-party querying ?authorId=X should not see anonymous posts
    // authored by X, as that would prove authorship even with fields redacted).
    const isViewingOwnPosts = authorIdNum && requestingUserId === authorIdNum;
    const anonymousFilter =
      authorFilter && !isViewingOwnPosts ? eq(postsTable.isAnonymous, false) : undefined;

    const filters = [typeFilter, authorFilter, anonymousFilter].filter(Boolean);
    const whereClause = filters.length > 1 ? and(...(filters as Parameters<typeof and>)) : filters[0];

    // Single JOIN — eliminates N+1 per-post author lookups
    const rows = await db
      .select({ post: postsTable, author: usersTable })
      .from(postsTable)
      .leftJoin(usersTable, eq(postsTable.authorId, usersTable.id))
      .where(whereClause)
      .orderBy(desc(postsTable.createdAt))
      .limit(50);

    // Batch liked-check: one query for all post IDs the current user has liked
    const postIds = rows.map(r => r.post.id);
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

    const now = new Date();
    const result = rows.map(({ post, author }) => {
      const diff = now.getTime() - post.createdAt.getTime();
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor(diff / 60000);
      const timeAgo = hours > 0 ? `${hours}h ago` : `${mins}m ago`;

      return {
        ...buildPostResponse(post, author ?? undefined, timeAgo, requestingUserId, likedSet.has(post.id)),
        _score: tab === "following" ? trendingScore(post) : engagementScore(post),
      };
    });

    result.sort((a, b) => b._score - a._score);
    const ranked = result.slice(0, 20).map(({ _score: _, ...p }) => p);
    res.json(ranked);
  } catch (err) {
    req.log.error({ err }, "Failed to get feed");
    res.status(500).json({ error: "Failed to get feed" });
  }
});

router.post("/posts", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Sign in to post" }); return;
  }

  try {
    const { content, type, isAnonymous } = req.body;

    const [found] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.clerkId, userId))
      .limit(1);

    if (!found) {
      res.status(401).json({ error: "Author profile not found" }); return;
    }

    const dbUser = found;
    const authorId = found.id;
    const requestingUserId = found.id;

    const postType = type ?? "opinion";
    // Anonymous mode is only permitted for opinion posts; coerce to false for all other types
    const anonymousAllowed = postType === "opinion";

    // Toxicity check (blocking)
    const toxicityResult = checkToxicity(content ?? "");
    if (toxicityResult.blocked) {
      res.status(400).json({ error: "Your post contains content that violates our community guidelines. Please revise it." }); return;
    }

    // AI content detection for longer posts (non-blocking)
    const aiResult = detectAiContent(content ?? "");
    req.log.info({ aiSuspected: aiResult.flagged, score: aiResult.score }, "Post AI content check");

    const [post] = await db
      .insert(postsTable)
      .values({ content, type: postType, authorId, isAnonymous: anonymousAllowed && !!isAnonymous })
      .returning();

    res.status(201).json(buildPostResponse(post, dbUser, "just now", requestingUserId));
  } catch (err) {
    req.log.error({ err }, "Failed to create post");
    res.status(500).json({ error: "Failed to create post" });
  }
});

router.patch("/posts/:id/reveal", async (req, res) => {
  const { userId } = getAuth(req);

  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid post id" }); return;
    }

    if (!userId) {
      res.status(403).json({ error: "Unauthorized" }); return;
    }

    const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.clerkId, userId)).limit(1);
    if (!dbUser) {
      res.status(403).json({ error: "Unauthorized" }); return;
    }

    const [post] = await db.select().from(postsTable).where(eq(postsTable.id, id)).limit(1);
    if (!post) {
      res.status(404).json({ error: "Post not found" }); return;
    }

    if (post.authorId !== dbUser.id) {
      res.status(403).json({ error: "Not the post owner" }); return;
    }

    const [updated] = await db
      .update(postsTable)
      .set({ isAnonymous: false })
      .where(eq(postsTable.id, id))
      .returning();

    res.json(buildPostResponse(updated, dbUser, "recently", dbUser.id));
  } catch (err) {
    req.log.error({ err }, "Failed to reveal post identity");
    res.status(500).json({ error: "Failed to reveal post identity" });
  }
});

router.post("/posts/:id/like", async (req, res) => {
  const { userId: actorClerkId } = getAuth(req);
  if (!actorClerkId) { res.status(401).json({ error: "Sign in to like posts" }); return; }

  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid post id" }); return; }

    const [post] = await db.select().from(postsTable).where(eq(postsTable.id, id)).limit(1);
    if (!post) { res.status(404).json({ error: "Post not found" }); return; }

    const [actorUser] = await db.select().from(usersTable).where(eq(usersTable.clerkId, actorClerkId)).limit(1);
    const requestingUserId = actorUser?.id ?? null;

    const [existing] = await db
      .select()
      .from(postLikesTable)
      .where(and(eq(postLikesTable.postId, id), eq(postLikesTable.userId, actorClerkId)))
      .limit(1);

    let updated: typeof postsTable.$inferSelect;

    if (existing) {
      // Unlike: remove the row and decrement
      await db.delete(postLikesTable).where(eq(postLikesTable.id, existing.id));
      [updated] = await db
        .update(postsTable)
        .set({ likes: sql`GREATEST(0, ${postsTable.likes} - 1)` })
        .where(eq(postsTable.id, id))
        .returning();
    } else {
      // Like: insert row and increment
      await db.insert(postLikesTable).values({ postId: id, userId: actorClerkId });
      [updated] = await db
        .update(postsTable)
        .set({ likes: sql`${postsTable.likes} + 1` })
        .where(eq(postsTable.id, id))
        .returning();

      // Notify author only on new likes (not unlikes)
      const likeBody = updated.isAnonymous
        ? "Your post received a like"
        : updated.content
          ? `"${updated.content.substring(0, 80)}${updated.content.length > 80 ? "…" : ""}"`
          : "Your post received a like";
      await createNotification({
        targetDbUserId: updated.authorId,
        actorClerkId,
        actorDisplayName: actorClerkId,
        type: "like",
        title: "Someone liked your post",
        body: likeBody,
      }, req.log);
    }

    const [author] = await db.select().from(usersTable).where(eq(usersTable.id, updated.authorId)).limit(1);
    res.json({ ...buildPostResponse(updated, author, "recently", requestingUserId), liked: !existing });
  } catch (err) {
    req.log.error({ err }, "Failed to like post");
    res.status(500).json({ error: "Failed to like post" });
  }
});

router.get("/posts/:id/comments", async (req, res) => {
  try {
    const postId = Number(req.params.id);
    if (isNaN(postId)) {
      res.status(400).json({ error: "Invalid post id" }); return;
    }

    const { userId } = getAuth(req);

    const rows = await db
      .select()
      .from(commentsTable)
      .where(eq(commentsTable.postId, postId))
      .orderBy(desc(commentsTable.createdAt));

    let likedCommentIds = new Set<number>();
    if (userId && rows.length > 0) {
      const commentIds = rows.map(r => r.id);
      const liked = await db
        .select({ commentId: commentLikesTable.commentId })
        .from(commentLikesTable)
        .where(and(inArray(commentLikesTable.commentId, commentIds), eq(commentLikesTable.userId, userId)));
      likedCommentIds = new Set(liked.map(l => l.commentId));
    }

    res.json(rows.map(c => ({
      id: c.id,
      authorId: c.authorId,
      authorName: c.authorName,
      content: c.content,
      side: c.side ?? null,
      isFlagged: c.isFlagged,
      flagLabel: c.flagLabel ?? null,
      createdAt: c.createdAt.toISOString(),
      likes: c.likes,
      likedByMe: likedCommentIds.has(c.id),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get post comments");
    res.status(500).json({ error: "Failed to get post comments" });
  }
});

router.post("/posts/:id/comments", async (req, res) => {
  try {
    const postId = Number(req.params.id);
    if (isNaN(postId)) {
      res.status(400).json({ error: "Invalid post id" }); return;
    }

    const [post] = await db
      .select()
      .from(postsTable)
      .where(eq(postsTable.id, postId))
      .limit(1);

    if (!post) {
      res.status(404).json({ error: "Post not found" }); return;
    }

    const { authorId, authorName, content } = req.body as {
      authorId?: number;
      authorName: string;
      content: string;
    };

    if (!authorName || !content) {
      res.status(400).json({ error: "authorName and content are required" }); return;
    }

    // Toxicity check (blocking)
    const toxicityResult = checkToxicity(content);
    if (toxicityResult.blocked) {
      res.status(400).json({ error: "Your comment contains content that violates our community guidelines." }); return;
    }

    const [comment] = await db
      .insert(commentsTable)
      .values({ postId, authorId: authorId ?? 0, authorName, content, isFlagged: toxicityResult.flagged, toxicityFlagged: toxicityResult.flagged })
      .returning();

    await db
      .update(postsTable)
      .set({ comments: sql`${postsTable.comments} + 1` })
      .where(eq(postsTable.id, postId));

    const { userId: actorClerkId } = getAuth(req);
    if (actorClerkId) {
      // Privacy: do not include the comment text (which references the post) in notifications
      // for anonymous posts. Including the commenter's words would implicitly associate the real
      // author (targetDbUserId) with content they chose to publish anonymously, risking identity
      // disclosure if the notification record is ever surfaced to a third party.
      const replyBody = post.isAnonymous
        ? `${authorName} commented on your post`
        : `${authorName}: "${content.substring(0, 80)}${content.length > 80 ? "…" : ""}"`;
      await createNotification({
        targetDbUserId: post.authorId,
        actorClerkId,
        actorDisplayName: authorName,
        type: "reply",
        title: "Someone commented on your post",
        body: replyBody,
      }, req.log);
    }

    res.status(201).json({
      id: comment.id,
      authorId: comment.authorId,
      authorName: comment.authorName,
      content: comment.content,
      side: comment.side ?? null,
      isFlagged: comment.isFlagged,
      flagLabel: comment.flagLabel ?? null,
      createdAt: comment.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create post comment");
    res.status(500).json({ error: "Failed to create post comment" });
  }
});

router.delete("/posts/:id/comments/:commentId", async (req, res) => {
  try {
    const { userId: clerkId } = getAuth(req);
    if (!clerkId) { res.status(401).json({ error: "Sign in required" }); return; }

    const postId = Number(req.params.id);
    const commentId = Number(req.params.commentId);
    if (isNaN(postId) || isNaN(commentId)) {
      res.status(400).json({ error: "Invalid id" }); return;
    }

    const [commentOwner] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.clerkId, clerkId))
      .limit(1);
    if (!commentOwner) { res.status(401).json({ error: "User not found" }); return; }

    const [comment] = await db
      .select()
      .from(commentsTable)
      .where(and(eq(commentsTable.id, commentId), eq(commentsTable.postId, postId)))
      .limit(1);

    if (!comment) {
      res.status(404).json({ error: "Comment not found" }); return;
    }

    if (comment.authorId !== commentOwner.id) {
      res.status(403).json({ error: "Cannot delete another user's comment" }); return;
    }

    await db.delete(commentsTable).where(eq(commentsTable.id, commentId));

    await db
      .update(postsTable)
      .set({ comments: sql<number>`GREATEST(0, comments - 1)` })
      .where(eq(postsTable.id, postId));

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete post comment");
    res.status(500).json({ error: "Failed to delete post comment" });
  }
});

// ── Like / unlike a post comment ───────────────────────────────────────────
router.post("/posts/:id/comments/:commentId/like", async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const commentId = Number(req.params.commentId);
    if (isNaN(postId) || isNaN(commentId)) {
      res.status(400).json({ error: "Invalid id" }); return;
    }

    const { userId } = getAuth(req);
    if (!userId) { res.status(401).json({ error: "Sign in to like comments" }); return; }

    const [comment] = await db
      .select({ id: commentsTable.id, postId: commentsTable.postId, likes: commentsTable.likes })
      .from(commentsTable)
      .where(and(eq(commentsTable.id, commentId), eq(commentsTable.postId, postId)))
      .limit(1);

    if (!comment) { res.status(404).json({ error: "Comment not found" }); return; }

    let liked = false;
    let updatedLikes = 0;

    await db.transaction(async (tx) => {
      const [existingLike] = await tx
        .select({ id: commentLikesTable.id })
        .from(commentLikesTable)
        .where(and(eq(commentLikesTable.commentId, commentId), eq(commentLikesTable.userId, userId)))
        .limit(1);

      if (existingLike) {
        await tx.delete(commentLikesTable).where(eq(commentLikesTable.id, existingLike.id));
        const [updated] = await tx
          .update(commentsTable)
          .set({ likes: sql`GREATEST(0, ${commentsTable.likes} - 1)` })
          .where(eq(commentsTable.id, commentId))
          .returning({ likes: commentsTable.likes });
        liked = false;
        updatedLikes = updated.likes;
      } else {
        const inserted = await tx
          .insert(commentLikesTable)
          .values({ commentId, userId })
          .onConflictDoNothing()
          .returning();
        if (inserted.length > 0) {
          const [updated] = await tx
            .update(commentsTable)
            .set({ likes: sql`${commentsTable.likes} + 1` })
            .where(eq(commentsTable.id, commentId))
            .returning({ likes: commentsTable.likes });
          liked = true;
          updatedLikes = updated.likes;
        } else {
          updatedLikes = comment.likes;
          liked = true;
        }
      }
    });

    res.json({ likes: updatedLikes, liked });
  } catch (err) {
    req.log.error({ err }, "Failed to like post comment");
    res.status(500).json({ error: "Failed to like post comment" });
  }
});

router.post("/posts/:id/report", async (req, res) => {
  try {
    const postId = Number(req.params.id);
    if (isNaN(postId)) { res.status(400).json({ error: "Invalid post id" }); return; }

    const { userId } = getAuth(req);
    const { reason } = req.body as { reason?: string };

    const [post] = await db.select().from(postsTable).where(eq(postsTable.id, postId)).limit(1);
    if (!post) { res.status(404).json({ error: "Post not found" }); return; }

    let reporterUserId: number | null = null;
    if (userId) {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, userId)).limit(1);
      reporterUserId = user?.id ?? null;
    }

    await db.insert(postReportsTable).values({ postId, reporterUserId, reason: reason ?? null });

    const newCount = post.reportCount + 1;
    const shouldFlag = newCount >= 3;
    await db.update(postsTable)
      .set({ reportCount: newCount, isFlagged: shouldFlag || post.isFlagged })
      .where(eq(postsTable.id, postId));

    // 5-report-in-24h threshold: warn user + log for admin
    if (post.authorId) {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [authorReports24h] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(postReportsTable)
        .innerJoin(postsTable, eq(postReportsTable.postId, postsTable.id))
        .where(and(
          eq(postsTable.authorId, post.authorId),
          gte(postReportsTable.createdAt, twentyFourHoursAgo)
        ));

      if ((authorReports24h?.count ?? 0) === 5) {
        await createNotification({
          targetDbUserId: post.authorId,
          actorClerkId: "system",
          actorDisplayName: "Treffin Moderation",
          type: "parliamentary_warning",
          title: "Please keep it civil",
          body: "Your posts have received multiple community reports today. Please ensure all contributions are constructive and respectful — this keeps Treffin a quality intellectual community.",
          batchKey: `parliamentary_warning_${post.authorId}_${new Date().toDateString()}`,
        }, req.log);
        await db.insert(modAuditLogTable).values({
          action: "auto_parliamentary_warning",
          targetType: "user",
          targetId: post.authorId,
          reason: `Auto: 5+ reports in 24h — parliamentary warning sent to user #${post.authorId}`,
        });
      }
    }

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to report post");
    res.status(500).json({ error: "Failed to report post" });
  }
});

router.delete("/posts/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid post id" }); return;
    }

    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: "Sign in required" }); return;
    }
    const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.clerkId, userId)).limit(1);
    if (!dbUser) {
      res.status(401).json({ error: "User not found" }); return;
    }

    const [post] = await db
      .select()
      .from(postsTable)
      .where(eq(postsTable.id, id))
      .limit(1);

    if (!post) {
      res.status(404).json({ error: "Post not found" }); return;
    }

    if (post.authorId !== dbUser.id) {
      res.status(403).json({ error: "Not the post owner" }); return;
    }

    await db.delete(postsTable).where(eq(postsTable.id, id));
    res.status(200).json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete post");
    res.status(500).json({ error: "Failed to delete post" });
  }
});

export default router;
