import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { articlesTable, usersTable, commentsTable, articleReviewRequestsTable, annotationsTable, articleLikesTable } from "@workspace/db";
import { eq, desc, sql, and, asc, inArray } from "drizzle-orm";
import { createNotification } from "../lib/notify";
import { checkToxicity, detectAiContent, checkSourceRequirement } from "../lib/content-moderation";

const router = Router();

router.post("/articles/:id/review-request", async (req, res) => {
  try {
    const articleId = Number(req.params.id);
    if (isNaN(articleId)) {
      res.status(400).json({ error: "Invalid article id" }); return;
    }

    const [article] = await db
      .select()
      .from(articlesTable)
      .where(eq(articlesTable.id, articleId))
      .limit(1);

    if (!article) {
      res.status(404).json({ error: "Article not found" }); return;
    }

    const existing = await db
      .select()
      .from(articleReviewRequestsTable)
      .where(eq(articleReviewRequestsTable.articleId, articleId))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: "Review request already exists" }); return;
    }

    let requesterId = article.authorId;
    const { userId: clerkId } = getAuth(req);
    if (clerkId) {
      const [dbUser] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.clerkId, clerkId))
        .limit(1);
      if (dbUser) {
        requesterId = dbUser.id;
      }
    }

    const [request] = await db
      .insert(articleReviewRequestsTable)
      .values({ articleId, requesterId, status: "pending" })
      .returning();

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

    const where = category
      ? and(sql`lower(${articlesTable.category}) = lower(${category})`)
      : undefined;

    // Single JOIN to get articles + authors — no N+1
    const rows = await db
      .select({ article: articlesTable, author: usersTable })
      .from(articlesTable)
      .leftJoin(usersTable, eq(articlesTable.authorId, usersTable.id))
      .where(where as any)
      .orderBy(...orderBy);

    // Batch liked-check for the current user
    const { userId: clerkId } = getAuth(req);
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

    // Parallel: fetch article+author (JOIN), review request, and liked status
    const { userId: clerkId } = getAuth(req);
    const [[row], [reviewReq], likedRows] = await Promise.all([
      db.select({ article: articlesTable, author: usersTable })
        .from(articlesTable)
        .leftJoin(usersTable, eq(articlesTable.authorId, usersTable.id))
        .where(eq(articlesTable.id, id))
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
    const { userId: clerkId } = getAuth(req);
    if (!clerkId) {
      return res.status(401).json({ error: "Sign in to publish an article" });
    }
    const [author] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.clerkId, clerkId))
      .limit(1);
    if (!author) {
      return res.status(401).json({ error: "Author profile not found" });
    }

    const { title, excerpt, content, category, imageUrl, peerReview } = req.body as {
      title: string;
      excerpt?: string;
      content?: string;
      category?: string;
      imageUrl?: string;
      peerReview?: boolean;
    };

    // Toxicity check (blocking)
    const toxicityResult = checkToxicity(`${title ?? ""} ${content ?? ""}`);
    if (toxicityResult.blocked) {
      return res.status(400).json({ error: "Your article contains content that violates our community guidelines. Please revise it before publishing." });
    }

    // Source requirement: articles ≥ 300 words must include at least one URL
    const sourceCheck = checkSourceRequirement(content ?? "", 300);
    if (sourceCheck.required && !sourceCheck.hasSources) {
      return res.status(400).json({ error: "Articles of 300 or more words must include at least one source link (starting with https://). Please cite your sources." });
    }

    // AI content detection (non-blocking — flags for human review)
    const aiResult = detectAiContent(`${title ?? ""} ${content ?? ""}`);

    // Calculate read time from word count (200 words per minute)
    const wordCount = (content ?? "").trim().split(/\s+/).filter(Boolean).length;
    const readTime = Math.max(1, Math.ceil(wordCount / 200));

    const [article] = await db
      .insert(articlesTable)
      .values({ title, excerpt, content, category, imageUrl: imageUrl ?? null, authorId: author.id, readTime, likes: 0, toxicityFlagged: toxicityResult.flagged, aiSuspected: aiResult.flagged })
      .returning();

    // If peer review requested, create a review request
    if (peerReview) {
      await db
        .insert(articleReviewRequestsTable)
        .values({ articleId: article.id, requesterId: author.id, status: "pending" })
        .onConflictDoNothing();
    }

    return res.status(201).json({
      id: article.id,
      title: article.title,
      excerpt: article.excerpt ?? null,
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
    return res.status(500).json({ error: "Failed to create article" });
  }
});

router.post("/articles/:id/like", async (req, res) => {
  const { userId: actorClerkId } = getAuth(req);
  if (!actorClerkId) { res.status(401).json({ error: "Sign in to like articles" }); return; }

  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid article id" }); return; }

    const [article] = await db.select().from(articlesTable).where(eq(articlesTable.id, id)).limit(1);
    if (!article) { res.status(404).json({ error: "Article not found" }); return; }

    const [existing] = await db
      .select()
      .from(articleLikesTable)
      .where(and(eq(articleLikesTable.articleId, id), eq(articleLikesTable.userId, actorClerkId)))
      .limit(1);

    let updated: typeof articlesTable.$inferSelect;

    if (existing) {
      // Unlike: remove the row and decrement
      await db.delete(articleLikesTable).where(eq(articleLikesTable.id, existing.id));
      [updated] = await db
        .update(articlesTable)
        .set({ likes: sql`GREATEST(0, ${articlesTable.likes} - 1)` })
        .where(eq(articlesTable.id, id))
        .returning();
    } else {
      // Like: insert row and increment
      await db.insert(articleLikesTable).values({ articleId: id, userId: actorClerkId });
      [updated] = await db
        .update(articlesTable)
        .set({ likes: sql`${articlesTable.likes} + 1` })
        .where(eq(articlesTable.id, id))
        .returning();

      // Notify author only on new likes (not unlikes)
      const [actor] = await db
        .select({ name: usersTable.name })
        .from(usersTable)
        .where(eq(usersTable.clerkId, actorClerkId))
        .limit(1);
      await createNotification({
        targetDbUserId: updated.authorId,
        actorClerkId,
        actorDisplayName: actor?.name ?? "Someone",
        type: "like",
        title: "Someone liked your article",
        body: `"${updated.title}"`,
      }, req.log);
    }

    const [author] = await db.select().from(usersTable).where(eq(usersTable.id, updated.authorId)).limit(1);
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
      liked: !existing,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to like article");
    res.status(500).json({ error: "Failed to like article" });
  }
});

router.get("/articles/:id/comments", async (req, res) => {
  const articleId = Number(req.params.id);
  if (isNaN(articleId)) { res.status(400).json({ error: "Invalid article id" }); return; }
  try {
    const rows = await db
      .select()
      .from(commentsTable)
      .where(eq(commentsTable.postId, articleId))
      .orderBy(asc(commentsTable.createdAt));
    res.json(rows.map(c => ({
      id: c.id,
      authorId: c.authorId,
      authorName: c.authorName,
      content: c.content,
      createdAt: c.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get article comments");
    res.status(500).json({ error: "Failed to get article comments" });
  }
});

router.post("/articles/:id/comments", async (req, res) => {
  try {
    const articleId = Number(req.params.id);
    if (isNaN(articleId)) {
      res.status(400).json({ error: "Invalid article id" }); return;
    }

    const [article] = await db
      .select()
      .from(articlesTable)
      .where(eq(articlesTable.id, articleId))
      .limit(1);

    if (!article) {
      res.status(404).json({ error: "Article not found" }); return;
    }

    const { authorName, content } = req.body as {
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

    // Look up DB user from Clerk session for correct authorId
    const { userId: clerkIdForComment } = getAuth(req);
    let resolvedAuthorId = 0;
    let resolvedAuthorName = authorName;
    if (clerkIdForComment) {
      const [dbUser] = await db
        .select({ id: usersTable.id, name: usersTable.name })
        .from(usersTable)
        .where(eq(usersTable.clerkId, clerkIdForComment))
        .limit(1);
      if (dbUser) {
        resolvedAuthorId = dbUser.id;
        resolvedAuthorName = dbUser.name;
      }
    }

    const [comment] = await db
      .insert(commentsTable)
      .values({ postId: articleId, authorId: resolvedAuthorId, authorName: resolvedAuthorName, content, isFlagged: toxicityResult.flagged, toxicityFlagged: toxicityResult.flagged })
      .returning();

    if (clerkIdForComment) {
      await createNotification({
        targetDbUserId: article.authorId,
        actorClerkId: clerkIdForComment,
        actorDisplayName: resolvedAuthorName,
        type: "reply",
        title: "Someone commented on your article",
        body: `${resolvedAuthorName}: "${content.substring(0, 80)}${content.length > 80 ? "…" : ""}"`,
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
    req.log.error({ err }, "Failed to create article comment");
    res.status(500).json({ error: "Failed to create article comment" });
  }
});

router.delete("/articles/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: "Sign in required" }); return;
    }
    const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.clerkId, userId)).limit(1);
    if (!dbUser) {
      res.status(401).json({ error: "User not found" }); return;
    }
    const [article] = await db.select().from(articlesTable).where(eq(articlesTable.id, id)).limit(1);
    if (!article) {
      res.status(404).json({ error: "Article not found" }); return;
    }
    if (article.authorId !== dbUser.id) {
      res.status(403).json({ error: "Not the article owner" }); return;
    }
    await db.delete(articlesTable).where(eq(articlesTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete article");
    res.status(500).json({ error: "Failed to delete article" });
  }
});

router.get("/articles/:id/annotations", async (req, res) => {
  try {
    const articleId = Number(req.params.id);
    if (isNaN(articleId)) { res.status(400).json({ error: "Invalid article id" }); return; }

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

    const result = rows.map(r => ({
      id: r.id,
      articleId: r.articleId,
      userId: r.userId,
      selectedText: r.selectedText,
      comment: r.comment,
      paragraphIndex: r.paragraphIndex,
      createdAt: r.createdAt.toISOString(),
      authorName: r.authorName ?? "Unknown",
      authorAvatar: r.authorAvatar ?? null,
    }));

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get annotations");
    res.status(500).json({ error: "Failed to get annotations" });
  }
});

router.post("/articles/:id/annotations", async (req, res) => {
  try {
    const articleId = Number(req.params.id);
    if (isNaN(articleId)) { res.status(400).json({ error: "Invalid article id" }); return; }

    const { userId: clerkId } = getAuth(req);
    if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const [dbUser] = await db
      .select({ id: usersTable.id, name: usersTable.name, avatarUrl: usersTable.avatarUrl })
      .from(usersTable)
      .where(eq(usersTable.clerkId, clerkId))
      .limit(1);

    if (!dbUser) { res.status(401).json({ error: "User not found" }); return; }

    const { selectedText, comment, paragraphIndex } = req.body as {
      selectedText: string;
      comment: string;
      paragraphIndex: number;
    };

    if (!selectedText?.trim() || !comment?.trim()) {
      res.status(400).json({ error: "selectedText and comment are required" }); return;
    }

    const [article] = await db
      .select({ id: articlesTable.id })
      .from(articlesTable)
      .where(eq(articlesTable.id, articleId))
      .limit(1);

    if (!article) { res.status(404).json({ error: "Article not found" }); return; }

    const [annotation] = await db
      .insert(annotationsTable)
      .values({
        articleId,
        userId: dbUser.id,
        selectedText: selectedText.trim(),
        comment: comment.trim(),
        paragraphIndex: paragraphIndex ?? 0,
      })
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
    if (isNaN(id)) { res.status(400).json({ error: "Invalid annotation id" }); return; }

    const { userId: clerkId } = getAuth(req);
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
      .where(eq(usersTable.clerkId, clerkId))
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
