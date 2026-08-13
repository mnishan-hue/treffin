import { Router } from "express";
import { jitProvisionUser } from "../lib/jit-provision";
import { db } from "@workspace/db";
import { articlesTable, usersTable, commentsTable, articleReviewRequestsTable, annotationsTable, articleLikesTable } from "@workspace/db";
import { eq, desc, sql, and, asc, inArray } from "drizzle-orm";
import { createNotification } from "../lib/notify";
import { checkToxicity, detectAiContent, checkSourceRequirement } from "../lib/content-moderation";
import { awardRep } from "./reputation";
import { reputationReference } from "../lib/security-policy";

const router = Router();

router.post("/articles/:id/review-request", async (req, res) => {
  const authUser = req.betterAuthSession?.user ?? null;
  if (!authUser) {
    res.status(401).json({ error: "Sign in to request a review" }); return;
  }
  const articleId = Number(req.params.id);
  if (!Number.isInteger(articleId) || articleId <= 0) {
    res.status(400).json({ error: "Invalid article id" }); return;
  }

  try {
    const dbUser = await jitProvisionUser(authUser);
    if (!dbUser) {
      res.status(503).json({ error: "Could not load your user profile" }); return;
    }

    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(3, ${articleId})`);
      const [article] = await tx
        .select()
        .from(articlesTable)
        .where(and(
          eq(articlesTable.id, articleId),
          eq(articlesTable.status, "published"),
          eq(articlesTable.isRemoved, false),
        ))
        .limit(1);
      if (!article) return { kind: "missing" as const };
      if (article.authorId !== dbUser.id) return { kind: "forbidden" as const };

      const [existing] = await tx
        .select({ id: articleReviewRequestsTable.id })
        .from(articleReviewRequestsTable)
        .where(eq(articleReviewRequestsTable.articleId, articleId))
        .limit(1);
      if (existing) return { kind: "duplicate" as const };

      const [request] = await tx
        .insert(articleReviewRequestsTable)
        .values({ articleId, requesterId: dbUser.id, status: "pending" })
        .returning();
      return { kind: "created" as const, request };
    });

    if (result.kind === "missing") {
      res.status(404).json({ error: "Published article not found" }); return;
    }
    if (result.kind === "forbidden") {
      res.status(403).json({ error: "Only the article author can request a review" }); return;
    }
    if (result.kind === "duplicate") {
      res.status(409).json({ error: "Review request already exists" }); return;
    }

    const { request } = result;
    res.status(201).json({
      id: request.id,
      articleId: request.articleId,
      requesterId: request.requesterId,
      status: request.status,
      reviewerNote: request.reviewerNote ?? null,
      createdAt: request.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to submit review request");
    res.status(500).json({ error: "Failed to submit review request" });
  }
});
router.get("/articles", async (req, res) => {
  try {
    const category = typeof req.query.category === "string" && req.query.category.trim() && req.query.category.toLowerCase() !== "all"
      ? req.query.category.trim()
      : null;
    const sort = typeof req.query.sort === "string" ? req.query.sort : "newest";

    const orderBy =
      sort === "most_liked" ? [desc(articlesTable.likes), desc(articlesTable.createdAt)]
      : sort === "trending" ? [desc(articlesTable.isTrending), desc(articlesTable.isFeatured), desc(articlesTable.createdAt)]
      : [desc(articlesTable.createdAt)];

    const visibility = and(eq(articlesTable.status, "published"), eq(articlesTable.isRemoved, false));
    const where = category
      ? and(visibility, sql`lower(${articlesTable.category}) = lower(${category})`)
      : visibility;

    // Single JOIN to get articles + authors — no N+1
    const rows = await db
      .select({ article: articlesTable, author: usersTable })
      .from(articlesTable)
      .leftJoin(usersTable, eq(articlesTable.authorId, usersTable.id))
      .where(where as any)
      .orderBy(...orderBy);

    // Batch liked-check for the current user
    const clerkId = req.betterAuthSession?.user?.id ?? null;
    const articleIds = rows.map(r => r.article.id);
    const likedSet = new Set<number>();
    if (clerkId && articleIds.length > 0) {
      const likedRows = await db
        .select({ articleId: articleLikesTable.articleId })
        .from(articleLikesTable)
        .where(and(
          inArray(articleLikesTable.articleId, articleIds),
          eq(articleLikesTable.userId, clerkId),
        ));
      likedRows.forEach(r => likedSet.add(r.articleId));
    }

    // Batch review request status — one query for all articles
    const reviewRequestMap = new Map<number, string>();
    if (articleIds.length > 0) {
      const reviewRows = await db
        .select({ articleId: articleReviewRequestsTable.articleId, status: articleReviewRequestsTable.status })
        .from(articleReviewRequestsTable)
        .where(inArray(articleReviewRequestsTable.articleId, articleIds));
      reviewRows.forEach(r => reviewRequestMap.set(r.articleId, r.status));
    }

    const commentCountMap = new Map<number, number>();
    if (articleIds.length > 0) {
      const commentCounts = await db
        .select({ articleId: commentsTable.articleId, count: sql<number>`count(*)::int` })
        .from(commentsTable)
        .where(and(
          inArray(commentsTable.articleId, articleIds),
          eq(commentsTable.isRemoved, false),
        ))
        .groupBy(commentsTable.articleId);
      for (const row of commentCounts) {
        if (row.articleId !== null) commentCountMap.set(row.articleId, row.count);
      }
    }
    const result = rows.map(({ article: a, author }) => ({
      id: a.id,
      title: a.title,
      excerpt: a.excerpt ?? null,
      imageUrl: a.imageUrl ?? null,
      authorId: a.authorId,
      authorName: author?.name ?? "Unknown",
      authorTitle: author?.title ?? "",
      authorAvatar: author?.avatarUrl ?? null,
      category: a.category ?? null,
      readTime: a.readTime,
      likes: a.likes,
      comments: commentCountMap.get(a.id) ?? 0,
      liked: likedSet.has(a.id),
      isVerified: author?.isVerified ?? false,
      createdAt: a.createdAt.toISOString(),
      isTrending: a.isTrending,
      isFeatured: a.isFeatured,
      isExpertReviewed: a.isExpertReviewed,
      reviewRequestStatus: reviewRequestMap.get(a.id) ?? null,
    }));

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get articles");
    res.status(500).json({ error: "Failed to get articles" });
  }
});

router.get("/articles/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid article id" }); return; }

    // Parallel: fetch article+author (JOIN), review request, and liked status
    const clerkId = req.betterAuthSession?.user?.id ?? null;
    const [[row], [reviewReq], likedRows] = await Promise.all([
      db.select({ article: articlesTable, author: usersTable })
        .from(articlesTable)
        .leftJoin(usersTable, eq(articlesTable.authorId, usersTable.id))
        .where(and(eq(articlesTable.id, id), eq(articlesTable.status, "published"), eq(articlesTable.isRemoved, false)))
        .limit(1),
      db.select()
        .from(articleReviewRequestsTable)
        .where(eq(articleReviewRequestsTable.articleId, id))
        .limit(1),
      clerkId
        ? db.select({ articleId: articleLikesTable.articleId })
            .from(articleLikesTable)
            .where(and(eq(articleLikesTable.articleId, id), eq(articleLikesTable.userId, clerkId)))
            .limit(1)
        : Promise.resolve([]),
    ]);

    if (!row) { res.status(404).json({ error: "Article not found" }); return; }

    const { article, author } = row;
    res.json({
      id: article.id,
      title: article.title,
      excerpt: article.excerpt ?? null,
      imageUrl: article.imageUrl ?? null,
      authorId: article.authorId,
      authorName: author?.name ?? "Unknown",
      authorTitle: author?.title ?? "",
      authorAvatar: author?.avatarUrl ?? null,
      category: article.category ?? null,
      readTime: article.readTime,
      likes: article.likes,
      isVerified: author?.isVerified ?? false,
      createdAt: article.createdAt.toISOString(),
      isTrending: article.isTrending,
      isFeatured: article.isFeatured,
      isExpertReviewed: article.isExpertReviewed,
      reviewRequestStatus: reviewReq?.status ?? null,
      content: article.content ?? null,
      liked: likedRows.length > 0,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get article");
    res.status(500).json({ error: "Failed to get article" });
  }
});

router.post("/articles", async (req, res) => {
  try {
    const authUser = req.betterAuthSession?.user ?? null;
    if (!authUser) {
      res.status(401).json({ error: "Sign in to publish an article" }); return;
    }
    const author = await jitProvisionUser(authUser);
    if (!author) {
      res.status(503).json({ error: "Could not create your profile. Please try again." }); return;
    }

    const raw = req.body as {
      title?: unknown;
      excerpt?: unknown;
      content?: unknown;
      category?: unknown;
      imageUrl?: unknown;
      peerReview?: unknown;
    };
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    const excerpt = typeof raw.excerpt === "string" ? raw.excerpt.trim() : "";
    const content = typeof raw.content === "string" ? raw.content.trim() : "";
    const category = typeof raw.category === "string" ? raw.category.trim() : "";
    const imageUrl = typeof raw.imageUrl === "string" ? raw.imageUrl.trim() : "";
    const peerReview = raw.peerReview === true;

    if (title.length < 5 || title.length > 240) {
      res.status(400).json({ error: "Title must be between 5 and 240 characters" }); return;
    }
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    if (wordCount < 500 || content.length > 100_000) {
      res.status(400).json({ error: "Article content must contain at least 500 words and cannot exceed 100,000 characters" }); return;
    }
    if (excerpt.length > 1000 || category.length > 100) {
      res.status(400).json({ error: "Excerpt or category is too long" }); return;
    }
    if (imageUrl) {
      try {
        const parsed = new URL(imageUrl);
        if (!["http:", "https:"].includes(parsed.protocol) || imageUrl.length > 2048) throw new Error("invalid");
      } catch {
        res.status(400).json({ error: "Cover image must be a valid http or https URL" }); return;
      }
    }

    const toxicityResult = checkToxicity(`${title} ${content}`);
    if (toxicityResult.blocked) {
      res.status(400).json({ error: "Your article contains content that violates our community guidelines. Please revise it before publishing." }); return;
    }
    const sourceCheck = checkSourceRequirement(content, 1000);
    if (sourceCheck.required && !sourceCheck.hasSources) {
      res.status(400).json({ error: "Articles of 1000 or more words must include at least one source link starting with https://" }); return;
    }
    const aiResult = detectAiContent(`${title} ${content}`);
    const readTime = Math.max(1, Math.ceil(wordCount / 200));

    const article = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(articlesTable)
        .values({
          title,
          excerpt: excerpt || null,
          content,
          category: category || null,
          imageUrl: imageUrl || null,
          authorId: author.id,
          readTime,
          likes: 0,
          toxicityFlagged: toxicityResult.flagged,
          aiSuspected: aiResult.flagged,
        })
        .returning();
      await tx
        .update(usersTable)
        .set({ articlesPublished: sql`${usersTable.articlesPublished} + 1` })
        .where(eq(usersTable.id, author.id));
      if (peerReview) {
        await tx.insert(articleReviewRequestsTable).values({
          articleId: inserted.id,
          requesterId: author.id,
          status: "pending",
        });
      }
      return inserted;
    });

    await awardRep(authUser.id, "article_created", "Published an article", article.id)
      .catch((err) => req.log.warn({ err, articleId: article.id }, "Failed to award article-created reputation"));

    res.status(201).json({
      id: article.id,
      title: article.title,
      excerpt: article.excerpt ?? null,
      content: article.content ?? null,
      imageUrl: article.imageUrl ?? null,
      authorId: author.id,
      authorName: author.name,
      authorTitle: author.title ?? "",
      authorAvatar: author.avatarUrl ?? null,
      category: article.category ?? null,
      readTime: article.readTime,
      likes: 0,
      liked: false,
      isVerified: author.isVerified ?? false,
      isTrending: false,
      isFeatured: false,
      isExpertReviewed: false,
      reviewRequestStatus: peerReview ? "pending" : null,
      createdAt: article.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create article");
    res.status(500).json({ error: "Failed to create article" });
  }
});
router.post("/articles/:id/like", async (req, res) => {
  const actorId = req.betterAuthSession?.user?.id ?? null;
  if (!actorId) { res.status(401).json({ error: "Sign in to like articles" }); return; }

  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid article id" }); return; }
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(2, ${id})`);
      const [article] = await tx.select().from(articlesTable).where(eq(articlesTable.id, id)).limit(1);
      if (!article || article.isRemoved || article.status !== "published") return { kind: "missing" as const };
      const [existing] = await tx
        .select({ id: articleLikesTable.id })
        .from(articleLikesTable)
        .where(and(eq(articleLikesTable.articleId, id), eq(articleLikesTable.userId, actorId)))
        .limit(1);
      const liked = !existing;
      if (existing) {
        await tx.delete(articleLikesTable).where(eq(articleLikesTable.id, existing.id));
      } else {
        await tx.insert(articleLikesTable).values({ articleId: id, userId: actorId }).onConflictDoNothing();
      }
      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(articleLikesTable)
        .where(eq(articleLikesTable.articleId, id));
      const [updated] = await tx
        .update(articlesTable)
        .set({ likes: count })
        .where(eq(articlesTable.id, id))
        .returning();
      return { kind: "ok" as const, updated, liked };
    });
    if (result.kind === "missing") { res.status(404).json({ error: "Article not found" }); return; }
    const { updated, liked } = result;
    const [author] = await db.select().from(usersTable).where(eq(usersTable.id, updated.authorId)).limit(1);
    if (liked && author?.betterAuthId && author.betterAuthId !== actorId) {
      awardRep(author.betterAuthId, "article_liked", "Article received a like", reputationReference(updated.id, actorId))
        .catch((err) => req.log.warn({ err, articleId: id }, "Failed to award article-like reputation"));
      const [actor] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.betterAuthId, actorId)).limit(1);
      createNotification({
        targetDbUserId: updated.authorId,
        actorClerkId: actorId,
        actorDisplayName: actor?.name ?? "Someone",
        type: "like",
        title: "Someone liked your article",
        body: `"${updated.title}"`,
        batchKey: `article_liked:${id}`,
        batchBody: "{count} people liked your article",
      }, req.log).catch((err) => req.log.warn({ err, articleId: id }, "Failed to send article-like notification"));
    }
    res.json({
      id: updated.id,
      title: updated.title,
      excerpt: updated.excerpt ?? null,
      imageUrl: updated.imageUrl ?? null,
      authorId: updated.authorId,
      authorName: author?.name ?? "Unknown",
      authorTitle: author?.title ?? "",
      authorAvatar: author?.avatarUrl ?? null,
      category: updated.category ?? null,
      readTime: updated.readTime,
      likes: updated.likes,
      isVerified: author?.isVerified ?? false,
      liked,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to like article");
    res.status(500).json({ error: "Failed to like article" });
  }
});

router.get("/articles/:id/comments", async (req, res) => {
  const articleId = Number(req.params.id);
  if (!Number.isInteger(articleId) || articleId <= 0) {
    res.status(400).json({ error: "Invalid article id" }); return;
  }
  try {
    const [article] = await db
      .select({ id: articlesTable.id })
      .from(articlesTable)
      .where(and(
        eq(articlesTable.id, articleId),
        eq(articlesTable.status, "published"),
        eq(articlesTable.isRemoved, false),
      ))
      .limit(1);
    if (!article) {
      res.status(404).json({ error: "Published article not found" }); return;
    }

    const rows = await db
      .select()
      .from(commentsTable)
      .where(and(eq(commentsTable.articleId, articleId), eq(commentsTable.isRemoved, false)))
      .orderBy(asc(commentsTable.createdAt));
    res.json(rows.map((comment) => ({
      id: comment.id,
      authorId: comment.authorId,
      authorName: comment.authorName,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get article comments");
    res.status(500).json({ error: "Failed to get article comments" });
  }
});

router.post("/articles/:id/comments", async (req, res) => {
  const articleId = Number(req.params.id);
  if (!Number.isInteger(articleId) || articleId <= 0) {
    res.status(400).json({ error: "Invalid article id" }); return;
  }
  const authUser = req.betterAuthSession?.user ?? null;
  if (!authUser) {
    res.status(401).json({ error: "Sign in to comment" }); return;
  }
  const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
  if (!content || content.length > 5000) {
    res.status(400).json({ error: "Comment is required and cannot exceed 5000 characters" }); return;
  }

  try {
    const [[article], author] = await Promise.all([
      db.select()
        .from(articlesTable)
        .where(and(
          eq(articlesTable.id, articleId),
          eq(articlesTable.status, "published"),
          eq(articlesTable.isRemoved, false),
        ))
        .limit(1),
      jitProvisionUser(authUser),
    ]);
    if (!article) {
      res.status(404).json({ error: "Published article not found" }); return;
    }
    if (!author) {
      res.status(503).json({ error: "Could not create user profile" }); return;
    }

    const toxicityResult = checkToxicity(content);
    if (toxicityResult.blocked) {
      res.status(400).json({ error: "Your comment contains content that violates our community guidelines." }); return;
    }

    const [comment] = await db
      .insert(commentsTable)
      .values({
        articleId,
        authorId: author.id,
        authorName: author.name,
        content,
        isFlagged: toxicityResult.flagged,
        toxicityFlagged: toxicityResult.flagged,
        wordCount: content.split(/\s+/).filter(Boolean).length,
      })
      .returning();

    await awardRep(authUser.id, "comment_posted", "Posted an article comment", comment.id)
      .catch((err) => req.log.warn({ err, commentId: comment.id }, "Failed to award article-comment reputation"));
    if (content.length >= 200) {
      await awardRep(authUser.id, "long_comment", "Posted a detailed comment (200+ characters)", comment.id)
        .catch((err) => req.log.warn({ err, commentId: comment.id }, "Failed to award long-comment reputation"));
    }
    if (article.authorId !== author.id) {
      await createNotification({
        targetDbUserId: article.authorId,
        actorClerkId: authUser.id,
        actorDisplayName: author.name,
        type: "reply",
        title: "Someone commented on your article",
        body: `${author.name}: "${content.slice(0, 80)}${content.length > 80 ? "…" : ""}"`,
        batchKey: `article_comment:${articleId}`,
      }, req.log).catch((err) => req.log.warn({ err, commentId: comment.id }, "Failed to send article-comment notification"));
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
    req.log.error({ err }, "Failed to create article comment");
    res.status(500).json({ error: "Failed to create article comment" });
  }
});
router.delete("/articles/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid article id" }); return;
  }
  try {
    const authUser = req.betterAuthSession?.user ?? null;
    if (!authUser) {
      res.status(401).json({ error: "Sign in required" }); return;
    }
    const dbUser = await jitProvisionUser(authUser);
    if (!dbUser) {
      res.status(503).json({ error: "Could not load your user profile" }); return;
    }

    const result = await db.transaction(async (tx) => {
      const [article] = await tx
        .select()
        .from(articlesTable)
        .where(eq(articlesTable.id, id))
        .limit(1);
      if (!article || article.isRemoved) return "missing" as const;
      if (article.authorId !== dbUser.id) return "forbidden" as const;

      await tx
        .update(articlesTable)
        .set({ isRemoved: true, removedReason: "Deleted by article author" })
        .where(eq(articlesTable.id, id));
      await tx
        .update(usersTable)
        .set({ articlesPublished: sql`greatest(${usersTable.articlesPublished} - 1, 0)` })
        .where(eq(usersTable.id, dbUser.id));
      return "deleted" as const;
    });

    if (result === "missing") {
      res.status(404).json({ error: "Article not found" }); return;
    }
    if (result === "forbidden") {
      res.status(403).json({ error: "Not the article owner" }); return;
    }
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete article");
    res.status(500).json({ error: "Failed to delete article" });
  }
});
router.get("/articles/:id/annotations", async (req, res) => {
  try {
    const articleId = Number(req.params.id);
    if (!Number.isInteger(articleId) || articleId <= 0) {
      res.status(400).json({ error: "Invalid article id" }); return;
    }

    const [article] = await db
      .select({ id: articlesTable.id })
      .from(articlesTable)
      .where(and(
        eq(articlesTable.id, articleId),
        eq(articlesTable.status, "published"),
        eq(articlesTable.isRemoved, false),
      ))
      .limit(1);
    if (!article) {
      res.status(404).json({ error: "Published article not found" }); return;
    }

    const rows = await db
      .select({
        id: annotationsTable.id,
        articleId: annotationsTable.articleId,
        userId: annotationsTable.userId,
        selectedText: annotationsTable.selectedText,
        comment: annotationsTable.comment,
        paragraphIndex: annotationsTable.paragraphIndex,
        createdAt: annotationsTable.createdAt,
        authorName: usersTable.name,
        authorAvatar: usersTable.avatarUrl,
      })
      .from(annotationsTable)
      .leftJoin(usersTable, eq(annotationsTable.userId, usersTable.id))
      .where(eq(annotationsTable.articleId, articleId))
      .orderBy(asc(annotationsTable.paragraphIndex), asc(annotationsTable.createdAt));

    res.json(rows.map((row) => ({
      id: row.id,
      articleId: row.articleId,
      userId: row.userId,
      selectedText: row.selectedText,
      comment: row.comment,
      paragraphIndex: row.paragraphIndex,
      createdAt: row.createdAt.toISOString(),
      authorName: row.authorName ?? "Unknown",
      authorAvatar: row.authorAvatar ?? null,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get annotations");
    res.status(500).json({ error: "Failed to get annotations" });
  }
});
router.post("/articles/:id/annotations", async (req, res) => {
  try {
    const articleId = Number(req.params.id);
    if (!Number.isInteger(articleId) || articleId <= 0) {
      res.status(400).json({ error: "Invalid article id" }); return;
    }
    const authUser = req.betterAuthSession?.user ?? null;
    if (!authUser) {
      res.status(401).json({ error: "Sign in to annotate" }); return;
    }
    const dbUser = await jitProvisionUser(authUser);
    if (!dbUser) {
      res.status(503).json({ error: "Could not load your user profile" }); return;
    }

    const selectedText = typeof req.body?.selectedText === "string" ? req.body.selectedText.trim() : "";
    const comment = typeof req.body?.comment === "string" ? req.body.comment.trim() : "";
    const paragraphIndex = Number(req.body?.paragraphIndex);
    if (!selectedText || selectedText.length > 1000 || !comment || comment.length > 5000) {
      res.status(400).json({ error: "Selected text and annotation are required and must be within the allowed length" }); return;
    }
    if (!Number.isInteger(paragraphIndex) || paragraphIndex < 0) {
      res.status(400).json({ error: "Invalid paragraph index" }); return;
    }

    const [article] = await db
      .select({ content: articlesTable.content, excerpt: articlesTable.excerpt })
      .from(articlesTable)
      .where(and(
        eq(articlesTable.id, articleId),
        eq(articlesTable.status, "published"),
        eq(articlesTable.isRemoved, false),
      ))
      .limit(1);
    if (!article) {
      res.status(404).json({ error: "Published article not found" }); return;
    }
    const paragraphs = (article.content?.trim() || article.excerpt?.trim() || "").split("\n\n");
    if (!paragraphs[paragraphIndex]?.includes(selectedText)) {
      res.status(400).json({ error: "Selected text does not belong to the specified article paragraph" }); return;
    }

    const [annotation] = await db
      .insert(annotationsTable)
      .values({ articleId, userId: dbUser.id, selectedText, comment, paragraphIndex })
      .returning();

    res.status(201).json({
      id: annotation.id,
      articleId: annotation.articleId,
      userId: annotation.userId,
      selectedText: annotation.selectedText,
      comment: annotation.comment,
      paragraphIndex: annotation.paragraphIndex,
      createdAt: annotation.createdAt.toISOString(),
      authorName: dbUser.name,
      authorAvatar: dbUser.avatarUrl ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create annotation");
    res.status(500).json({ error: "Failed to create annotation" });
  }
});
router.delete("/annotations/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid annotation id" }); return; }

    const clerkId = req.betterAuthSession?.user?.id ?? null;
    if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const [annotation] = await db
      .select()
      .from(annotationsTable)
      .where(eq(annotationsTable.id, id))
      .limit(1);

    if (!annotation) { res.status(404).json({ error: "Annotation not found" }); return; }

    const [dbUser] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.betterAuthId, clerkId))
      .limit(1);

    if (!dbUser) { res.status(401).json({ error: "User not found" }); return; }

    const [articleAuthor] = await db
      .select({ authorId: articlesTable.authorId })
      .from(articlesTable)
      .where(eq(articlesTable.id, annotation.articleId))
      .limit(1);

    const isOwner = annotation.userId === dbUser.id;
    const isArticleAuthor = articleAuthor?.authorId === dbUser.id;

    if (!isOwner && !isArticleAuthor) {
      res.status(403).json({ error: "Forbidden" }); return;
    }

    await db.delete(annotationsTable).where(eq(annotationsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete annotation");
    res.status(500).json({ error: "Failed to delete annotation" });
  }
});

export default router;
