import { Router, type Request, type Response, type NextFunction } from "express";
import { exec } from "child_process";
import path from "path";
import { db } from "@workspace/db";
import {
  debatesTable,
  articlesTable,
  postsTable,
  communitiesTable,
  commentsTable,
  debateOutcomesTable,
  dailyQuestionsTable,
  topicsTable,
  usersTable,
  reputationEventsTable,
  weeklyChallengesTable,
  weeklyChallengeSubmissionsTable,
  dailyQuestionVotesTable,
  postReportsTable,
  articleReviewRequestsTable,
  modAuditLogTable,
  contentAppealsTable,
  mathFlagsTable,
  mathProblemsTable,
  mathSolutionsTable,
  mathProblemOfWeekTable,
  mathContestsTable,
  mathContestProblemsTable,
  mathContestEntriesTable,
  mathNotificationsTable,
  debateCreatorReportsTable,
  debateParticipantVotesTable,
  notificationsTable,
  appSettingsTable,
  baUser,
} from "@workspace/db";
import { eq, desc, sql, and, gte } from "drizzle-orm";
import { createNotification, notifyUser } from "../lib/notify";
import { createHash, timingSafeEqual } from "crypto";
import { awardRep, getEliteThreshold, setEliteThreshold } from "./reputation";
import { sendPushToAll } from "../lib/push";
import { appSettingsTable } from "@workspace/db";
import bcrypt from "bcryptjs";

const adminEmail    = process.env["ADMIN_EMAIL"];
const adminPassword = process.env["ADMIN_PASSWORD"];
const adminPwHash   = process.env["ADMIN_PASSWORD_HASH"];

// Derive a deterministic session token so requireAdmin keeps its simple header-comparison flow.
// When ADMIN_PASSWORD_HASH (bcrypt) is present we derive from that; otherwise from the plain password.
function deriveSessionToken(seed: string): string {
  return createHash("sha256").update(seed).digest("hex");
}

const ADMIN_TOKEN: string | null = (() => {
  if (adminEmail && adminPwHash) {
    // bcrypt mode — token derived from email + hash (both are fixed env vars)
    return deriveSessionToken(`${adminEmail}:${adminPwHash}`);
  }
  if (adminEmail && adminPassword) {
    // plain-password fallback (original behaviour)
    return deriveSessionToken(`${adminEmail}:${adminPassword}`);
  }
  console.error("[admin] Neither ADMIN_PASSWORD_HASH nor ADMIN_PASSWORD is set — admin routes will return 401");
  return null;
})();

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!ADMIN_TOKEN) {
    res.status(401).json({ error: "Unauthorized" }); return;
  }
  const token = req.headers["x-admin-token"];
  if (typeof token !== "string" || token.length !== ADMIN_TOKEN.length) {
    res.status(401).json({ error: "Unauthorized" }); return;
  }
  if (!timingSafeEqual(Buffer.from(token), Buffer.from(ADMIN_TOKEN))) {
    res.status(401).json({ error: "Unauthorized" }); return;
  }
  next();
}

const router = Router();

// ── Login endpoint — exempt from requireAdmin ──────────────────────────────
router.post("/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: "email and password required" }); return;
    }
    if (!adminEmail) {
      res.status(500).json({ error: "Server admin credentials not configured" }); return;
    }

    // Case-insensitive, trimmed email comparison to avoid whitespace surprises
    if (email.trim().toLowerCase() !== adminEmail.trim().toLowerCase()) {
      res.status(401).json({ error: "Unauthorized" }); return;
    }

    let valid = false;
    if (adminPwHash) {
      // bcrypt path — ADMIN_PASSWORD_HASH is set on the server
      valid = await bcrypt.compare(password, adminPwHash);
    } else if (adminPassword) {
      // Plain-text fallback — safe string compare (avoids timingSafeEqual RangeError on length mismatch)
      try {
        const a = Buffer.from(password.trim());
        const b = Buffer.from(adminPassword.trim());
        valid = a.length === b.length && timingSafeEqual(a, b);
      } catch {
        valid = false;
      }
    }

    if (!valid) {
      res.status(401).json({ error: "Unauthorized" }); return;
    }

    res.json({ token: ADMIN_TOKEN });
  } catch (err) {
    req.log?.error({ err }, "[admin/login] Unexpected error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.use("/admin", requireAdmin);

router.get("/admin/stats", async (req, res) => {
  try {
    const [usersCount] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable);
    const [postsCount] = await db.select({ count: sql<number>`count(*)::int` }).from(postsTable);
    const [debatesCount] = await db.select({ count: sql<number>`count(*)::int` }).from(debatesTable);
    const [articlesCount] = await db.select({ count: sql<number>`count(*)::int` }).from(articlesTable);
    const [communitiesCount] = await db.select({ count: sql<number>`count(*)::int` }).from(communitiesTable);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [repToday] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(reputationEventsTable)
      .where(gte(reputationEventsTable.createdAt, today));

    const [activeUserRow] = await db
      .select({ name: usersTable.name, count: sql<number>`count(*)::int` })
      .from(postsTable)
      .innerJoin(usersTable, eq(postsTable.authorId, usersTable.id))
      .where(gte(postsTable.createdAt, today))
      .groupBy(usersTable.id, usersTable.name)
      .orderBy(desc(sql`count(*)`))
      .limit(1);

    const [openAppealsRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(contentAppealsTable)
      .where(eq(contentAppealsTable.status, "open"));

    const [flaggedPostsRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(postsTable)
      .where(and(eq(postsTable.isFlagged, true), eq(postsTable.isRemoved, false)));

    const [pendingReviewsRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(articleReviewRequestsTable)
      .where(eq(articleReviewRequestsTable.status, "pending"));

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const highRiskUsers = await db
      .select({ authorId: postsTable.authorId, count: sql<number>`count(*)::int` })
      .from(postReportsTable)
      .innerJoin(postsTable, eq(postReportsTable.postId, postsTable.id))
      .where(gte(postReportsTable.createdAt, twentyFourHoursAgo))
      .groupBy(postsTable.authorId)
      .having(sql`count(*) >= 5`);

    res.json({
      totalUsers: usersCount?.count ?? 0,
      totalPosts: postsCount?.count ?? 0,
      totalDebates: debatesCount?.count ?? 0,
      totalArticles: articlesCount?.count ?? 0,
      totalCommunities: communitiesCount?.count ?? 0,
      repEventsToday: repToday?.count ?? 0,
      mostActiveUser: activeUserRow?.name ?? null,
      openAppeals: openAppealsRow?.count ?? 0,
      flaggedPosts: flaggedPostsRow?.count ?? 0,
      pendingReviews: pendingReviewsRow?.count ?? 0,
      highRiskUsers: highRiskUsers.length,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get admin stats");
    res.status(500).json({ error: "Failed to get stats" });
  }
});

router.get("/admin/debates", async (req, res) => {
  try {
    const debates = await db.select().from(debatesTable).orderBy(desc(debatesTable.createdAt));
    const outcomes = await db.select({ debateId: debateOutcomesTable.debateId }).from(debateOutcomesTable);
    const outcomeIds = new Set(outcomes.map((o) => o.debateId));

    res.json(debates.map((d) => ({
      id: d.id,
      title: d.title,
      description: d.description ?? null,
      category: d.category,
      participantCount: d.participantCount,
      isLive: d.isLive,
      isTrending: d.isTrending,
      isFeatured: d.isFeatured,
      isFrozen: d.isFrozen ?? false,
      frozenReason: d.frozenReason ?? null,
      healthScore: d.healthScore ?? 100,
      createdAt: d.createdAt.toISOString(),
      hasOutcome: outcomeIds.has(d.id),
      creatorUserId: d.creatorUserId ?? null,
      creatorIsModerator: d.creatorIsModerator ?? false,
      winnerAuthority: (d.winnerAuthority as "creator" | "admin") ?? "creator",
      winnerStatus: (d.winnerStatus as "undecided" | "creator_declared" | "pending_admin" | "admin_decided") ?? "undecided",
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get admin debates");
    res.status(500).json({ error: "Failed to get debates" });
  }
});

router.delete("/admin/debates/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(debatesTable).where(eq(debatesTable.id, id));
    await db.insert(modAuditLogTable).values({ action: "admin_delete_debate", targetType: "debate", targetId: id, reason: "Admin deleted debate" });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete debate");
    res.status(500).json({ error: "Failed to delete debate" });
  }
});

router.patch("/admin/debates/:id/trending", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { isTrending } = req.body;
    await db.update(debatesTable).set({ isTrending }).where(eq(debatesTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to set debate trending");
    res.status(500).json({ error: "Failed to update debate" });
  }
});

router.patch("/admin/debates/:id/featured", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { isFeatured } = req.body;
    await db.update(debatesTable).set({ isFeatured }).where(eq(debatesTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to set debate featured");
    res.status(500).json({ error: "Failed to update debate" });
  }
});

router.post("/admin/debates/:id/outcome", async (req, res) => {
  try {
    const debateId = Number(req.params.id);
    const { winningSide, justification, topSupportCommentId, topOppositionCommentId, overrideReason } = req.body as {
      winningSide: "support" | "against" | "draw"; justification: string;
      topSupportCommentId?: number; topOppositionCommentId?: number; overrideReason?: string;
    };

    const existing = await db
      .select()
      .from(debateOutcomesTable)
      .where(eq(debateOutcomesTable.debateId, debateId))
      .limit(1);

    // Overriding a result the creator themselves declared requires a reason,
    // so the creator can see why admin changed their ruling.
    if (existing.length > 0 && existing[0]!.decidedBy === "creator" && !overrideReason?.trim()) {
      res.status(400).json({ error: "overrideReason is required to override a creator-declared outcome" }); return;
    }

    if (existing.length > 0) {
      await db
        .update(debateOutcomesTable)
        .set({
          winningSide, justification, topSupportCommentId, topOppositionCommentId,
          publishedAt: new Date(), decidedBy: "admin",
          overrideReason: existing[0]!.decidedBy === "creator" ? overrideReason!.trim() : null,
        })
        .where(eq(debateOutcomesTable.debateId, debateId));
    } else {
      await db.insert(debateOutcomesTable).values({
        debateId,
        winningSide,
        justification,
        topSupportCommentId: topSupportCommentId ?? null,
        topOppositionCommentId: topOppositionCommentId ?? null,
        decidedBy: "admin",
      });
    }

    await db.update(debatesTable).set({ winnerStatus: "admin_decided" }).where(eq(debatesTable.id, debateId));

    await db.insert(modAuditLogTable).values({
      action: "admin_publish_outcome",
      targetType: "debate",
      targetId: debateId,
      reason: overrideReason?.trim() ?? null,
    });

    // Notify participants on the winning side
    if (winningSide !== "draw") {
      try {
        const [debateRow] = await db
          .select({ title: debatesTable.title })
          .from(debatesTable)
          .where(eq(debatesTable.id, debateId))
          .limit(1);
        if (debateRow) {
          const { debateParticipantVotesTable } = await import("@workspace/db");
          const winners = await db
            .select({ userId: debateParticipantVotesTable.userId })
            .from(debateParticipantVotesTable)
            .where(
              and(
                eq(debateParticipantVotesTable.debateId, debateId),
                eq(debateParticipantVotesTable.side, winningSide),
              )
            );
          for (const w of winners) {
            try {
              await createNotification({
                targetDbUserId: 0,
                targetClerkIdOverride: w.userId,
                actorClerkId: "admin",
                actorDisplayName: "Treffin Admin",
                type: "debate",
                title: "You won the debate! 🏆",
                body: `The "${debateRow.title.substring(0, 60)}${debateRow.title.length > 60 ? "…" : ""}" debate has ended — your side won!`,
              }, req.log);
            } catch { /* non-blocking */ }
          }
        }
      } catch (err) {
        req.log.error({ err, debateId }, "Failed to send admin winner notifications");
      }
    }

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to publish debate outcome");
    res.status(500).json({ error: "Failed to publish outcome" });
  }
});

// ── Debate creator reports ──────────────────────────────────────────────────
router.get("/admin/debate-creator-reports", async (req, res) => {
  try {
    const reports = await db
      .select({
        id: debateCreatorReportsTable.id,
        debateId: debateCreatorReportsTable.debateId,
        creatorUserId: debateCreatorReportsTable.creatorUserId,
        reporterUserId: debateCreatorReportsTable.reporterUserId,
        reason: debateCreatorReportsTable.reason,
        status: debateCreatorReportsTable.status,
        adminNote: debateCreatorReportsTable.adminNote,
        resolvedAt: debateCreatorReportsTable.resolvedAt,
        createdAt: debateCreatorReportsTable.createdAt,
        debateTitle: debatesTable.title,
        adminModerating: debatesTable.adminModerating,
      })
      .from(debateCreatorReportsTable)
      .leftJoin(debatesTable, eq(debateCreatorReportsTable.debateId, debatesTable.id))
      .orderBy(desc(debateCreatorReportsTable.createdAt));

    res.json(reports.map((r) => ({
      id: r.id,
      debateId: r.debateId,
      debateTitle: r.debateTitle ?? null,
      adminModerating: r.adminModerating ?? false,
      creatorUserId: r.creatorUserId,
      reporterUserId: r.reporterUserId ?? null,
      reason: r.reason,
      status: r.status,
      adminNote: r.adminNote ?? null,
      resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get debate creator reports");
    res.status(500).json({ error: "Failed to get reports" });
  }
});

router.patch("/admin/debate-creator-reports/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const { status, adminNote } = req.body as { status: "dismissed" | "upheld"; adminNote?: string };

    const [report] = await db
      .update(debateCreatorReportsTable)
      .set({ status, adminNote: adminNote ?? null, resolvedAt: new Date() })
      .where(eq(debateCreatorReportsTable.id, id))
      .returning();
    if (!report) { res.status(404).json({ error: "Report not found" }); return; }

    if (status === "upheld") {
      // Revoke the creator's moderator powers on that debate — the report
      // being upheld means they abused them.
      await db.update(debatesTable).set({ creatorIsModerator: false }).where(eq(debatesTable.id, report.debateId));
    }

    await db.insert(modAuditLogTable).values({
      action: status === "upheld" ? "uphold_creator_report" : "dismiss_creator_report",
      targetType: "debate",
      targetId: report.debateId,
      reason: adminNote ?? null,
    });

    // Notify the creator when their report is upheld so they know why their
    // moderation powers disappeared.
    if (status === "upheld" && report.creatorUserId) {
      try {
        const [debateRow] = await db
          .select({ title: debatesTable.title })
          .from(debatesTable)
          .where(eq(debatesTable.id, report.debateId))
          .limit(1);
        const title = debateRow?.title ?? `Debate #${report.debateId}`;
        const shortTitle = title.length > 60 ? title.substring(0, 60) + "…" : title;
        await notifyUser(
          report.creatorUserId,
          "admin",
          {
            type: "creator_report_upheld",
            title: "Moderation report upheld",
            body: `A report against your moderation of "${shortTitle}" was reviewed and upheld. Your moderation powers for this debate have been removed.`,
            actorDisplayName: "Treffin Admin",
          },
          req.log,
        );
      } catch (err) {
        req.log.error({ err }, "Failed to notify creator of upheld report");
      }
    }

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to resolve debate creator report");
    res.status(500).json({ error: "Failed to resolve report" });
  }
});

router.get("/admin/articles", async (req, res) => {
  try {
    const articles = await db.select().from(articlesTable).orderBy(desc(articlesTable.createdAt));
    res.json(articles.map((a) => ({
      id: a.id,
      title: a.title,
      excerpt: a.excerpt ?? null,
      content: a.content ?? null,
      authorId: a.authorId,
      category: a.category ?? null,
      readTime: a.readTime,
      likes: a.likes,
      isTrending: a.isTrending,
      isFeatured: a.isFeatured,
      createdAt: a.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get admin articles");
    res.status(500).json({ error: "Failed to get articles" });
  }
});

router.delete("/admin/articles/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(articlesTable).where(eq(articlesTable.id, id));
    await db.insert(modAuditLogTable).values({ action: "admin_delete_article", targetType: "article", targetId: id, reason: "Admin deleted article" });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete article");
    res.status(500).json({ error: "Failed to delete article" });
  }
});

router.patch("/admin/articles/:id/trending", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { isTrending } = req.body;
    await db.update(articlesTable).set({ isTrending }).where(eq(articlesTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to set article trending");
    res.status(500).json({ error: "Failed to update article" });
  }
});

router.patch("/admin/articles/:id/featured", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { isFeatured } = req.body;
    await db.update(articlesTable).set({ isFeatured }).where(eq(articlesTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to set article featured");
    res.status(500).json({ error: "Failed to update article" });
  }
});

router.get("/admin/posts", async (req, res) => {
  try {
    const posts = await db.select().from(postsTable).orderBy(desc(postsTable.createdAt));
    res.json(posts.map((p) => ({
      id: p.id,
      type: p.type,
      authorId: p.authorId,
      content: p.content ?? null,
      title: p.title ?? null,
      isRemoved: p.isRemoved,
      isFlagged: p.isFlagged,
      createdAt: p.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get admin posts");
    res.status(500).json({ error: "Failed to get posts" });
  }
});

router.delete("/admin/posts/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(postsTable).where(eq(postsTable.id, id));
    await db.insert(modAuditLogTable).values({ action: "admin_delete_post", targetType: "post", targetId: id, reason: "Admin deleted post" });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete post");
    res.status(500).json({ error: "Failed to delete post" });
  }
});

router.get("/admin/communities", async (req, res) => {
  try {
    const communities = await db.select().from(communitiesTable).orderBy(desc(communitiesTable.createdAt));
    res.json(communities.map((c) => ({
      id: c.id,
      name: c.name,
      emoji: c.emoji,
      memberCount: c.memberCount,
      totalPosts: c.totalPosts,
      isPrivate: c.isPrivate,
      isLive: c.isLive,
      createdAt: c.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get admin communities");
    res.status(500).json({ error: "Failed to get communities" });
  }
});

router.delete("/admin/communities/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(communitiesTable).where(eq(communitiesTable.id, id));
    await db.insert(modAuditLogTable).values({ action: "admin_delete_community", targetType: "community", targetId: id, reason: "Admin deleted community" });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete community");
    res.status(500).json({ error: "Failed to delete community" });
  }
});

router.get("/admin/reports", async (req, res) => {
  try {
    const reports = await db
      .select({
        id: postReportsTable.id,
        postId: postReportsTable.postId,
        reporterUserId: postReportsTable.reporterUserId,
        reason: postReportsTable.reason,
        createdAt: postReportsTable.createdAt,
        postContent: postsTable.content,
        postTitle: postsTable.title,
        reportCount: postsTable.reportCount,
        isFlagged: postsTable.isFlagged,
      })
      .from(postReportsTable)
      .leftJoin(postsTable, eq(postReportsTable.postId, postsTable.id))
      .orderBy(desc(postReportsTable.createdAt));
    res.json(reports.map((r) => ({
      id: r.id,
      postId: r.postId,
      reporterUserId: r.reporterUserId ?? null,
      reason: r.reason ?? null,
      createdAt: r.createdAt.toISOString(),
      postContent: r.postContent ?? null,
      postTitle: r.postTitle ?? null,
      reportCount: r.reportCount ?? 0,
      isFlagged: r.isFlagged ?? false,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get admin reports");
    res.status(500).json({ error: "Failed to get reports" });
  }
});

router.delete("/admin/reports/posts/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(postReportsTable).where(eq(postReportsTable.postId, id));
    await db.delete(postsTable).where(eq(postsTable.id, id));
    await db.insert(modAuditLogTable).values({ action: "admin_delete_reported_post", targetType: "post", targetId: id, reason: "Admin deleted reported post" });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete reported post");
    res.status(500).json({ error: "Failed to delete post" });
  }
});

router.patch("/admin/reports/posts/:id/dismiss", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(postReportsTable).where(eq(postReportsTable.postId, id));
    await db.update(postsTable)
      .set({ isFlagged: false, reportCount: 0 })
      .where(eq(postsTable.id, id));
    await db.insert(modAuditLogTable).values({ action: "admin_dismiss_reports", targetType: "post", targetId: id, reason: "Admin dismissed reports for post" });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to dismiss reports");
    res.status(500).json({ error: "Failed to dismiss" });
  }
});

router.get("/admin/comments", async (req, res) => {
  try {
    const comments = await db.select().from(commentsTable).orderBy(desc(commentsTable.createdAt));
    res.json(comments.map((c) => ({
      id: c.id,
      postId: c.postId ?? null,
      debateId: c.debateId ?? null,
      authorId: c.authorId,
      authorName: c.authorName,
      content: c.content,
      isFlagged: c.isFlagged,
      flagLabel: c.flagLabel ?? null,
      createdAt: c.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get admin comments");
    res.status(500).json({ error: "Failed to get comments" });
  }
});

router.delete("/admin/comments/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(commentsTable).where(eq(commentsTable.id, id));
    await db.insert(modAuditLogTable).values({ action: "admin_delete_comment", targetType: "comment", targetId: id, reason: "Admin deleted comment" });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete comment");
    res.status(500).json({ error: "Failed to delete comment" });
  }
});

router.patch("/admin/comments/:id/flag", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { isFlagged, flagLabel } = req.body;
    await db
      .update(commentsTable)
      .set({ isFlagged, flagLabel: flagLabel ?? null })
      .where(eq(commentsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to flag comment");
    res.status(500).json({ error: "Failed to update comment" });
  }
});

router.get("/admin/daily-question", async (req, res) => {
  try {
    const [question] = await db
      .select()
      .from(dailyQuestionsTable)
      .where(eq(dailyQuestionsTable.isLive, true))
      .orderBy(desc(dailyQuestionsTable.createdAt))
      .limit(1);

    if (!question) {
      res.status(404).json({ error: "No active daily question" }); return;
    }

    res.json({
      id: question.id,
      question: question.question,
      supportPercent: question.supportPercent,
      againstPercent: question.againstPercent,
      participantCount: question.participantCount,
      isActive: question.isLive,
      imageUrl: question.imageUrl,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get daily question");
    res.status(500).json({ error: "Failed to get daily question" });
  }
});

router.post("/admin/daily-question", async (req, res) => {
  try {
    const { question, imageUrl } = req.body;

    await db
      .update(dailyQuestionsTable)
      .set({ isLive: false })
      .where(eq(dailyQuestionsTable.isLive, true));

    const [created] = await db
      .insert(dailyQuestionsTable)
      .values({
        question,
        imageUrl: imageUrl ?? "",
        isLive: true,
        supportPercent: 50,
        againstPercent: 50,
        participantCount: 0,
      })
      .returning();

    await db.insert(modAuditLogTable).values({
      action: "set_daily_question",
      targetType: "daily_question",
      targetId: created.id,
      reason: question,
    });

    res.json({
      id: created.id,
      question: created.question,
      supportPercent: created.supportPercent,
      againstPercent: created.againstPercent,
      participantCount: created.participantCount,
      isActive: created.isLive,
      imageUrl: created.imageUrl,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to set daily question");
    res.status(500).json({ error: "Failed to set daily question" });
  }
});

router.get("/admin/topics", async (req, res) => {
  try {
    const topics = await db.select().from(topicsTable);
    res.json(topics.map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      slug: t.slug ?? null,
      icon: t.icon ?? null,
      description: t.description ?? null,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get admin topics");
    res.status(500).json({ error: "Failed to get topics" });
  }
});

router.post("/admin/topics", async (req, res) => {
  try {
    const { name, color, slug, icon, description } = req.body;
    const [topic] = await db
      .insert(topicsTable)
      .values({ name, color, slug, icon, description })
      .returning();
    res.status(201).json({
      id: topic.id,
      name: topic.name,
      color: topic.color,
      slug: topic.slug ?? null,
      icon: topic.icon ?? null,
      description: topic.description ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create topic");
    res.status(500).json({ error: "Failed to create topic" });
  }
});

router.patch("/admin/topics/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, color, slug, icon, description } = req.body;
    const [topic] = await db
      .update(topicsTable)
      .set({ name, color, slug, icon, description })
      .where(eq(topicsTable.id, id))
      .returning();
    res.json({
      id: topic.id,
      name: topic.name,
      color: topic.color,
      slug: topic.slug ?? null,
      icon: topic.icon ?? null,
      description: topic.description ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update topic");
    res.status(500).json({ error: "Failed to update topic" });
  }
});

router.delete("/admin/topics/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(topicsTable).where(eq(topicsTable.id, id));
    await db.insert(modAuditLogTable).values({ action: "admin_delete_topic", targetType: "topic", targetId: id, reason: "Admin deleted topic" });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete topic");
    res.status(500).json({ error: "Failed to delete topic" });
  }
});

router.get("/admin/users", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = 20;
    const offset = (page - 1) * pageSize;

    const [countRow] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable);
    const users = await db
      .select()
      .from(usersTable)
      .orderBy(desc(usersTable.createdAt))
      .limit(pageSize)
      .offset(offset);

    res.json({
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        title: u.title,
        reputationScore: u.reputationScore,
        isVerified: u.isVerified,
        isSuspended: u.isSuspended,
        createdAt: u.createdAt.toISOString(),
      })),
      total: countRow?.count ?? 0,
      page,
      pageSize,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get admin users");
    res.status(500).json({ error: "Failed to get users" });
  }
});

router.get("/admin/users/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    // reputation_events.userId stores Clerk IDs — look up via user.clerkId
    const repHistory = user.clerkId
      ? await db
          .select()
          .from(reputationEventsTable)
          .where(eq(reputationEventsTable.userId, user.clerkId))
          .orderBy(desc(reputationEventsTable.createdAt))
          .limit(20)
      : [];

    res.json({
      id: user.id,
      name: user.name,
      title: user.title,
      bio: user.bio ?? null,
      reputationScore: user.reputationScore,
      followers: user.followers,
      following: user.following,
      debatesJoined: user.debatesJoined,
      articlesPublished: user.articlesPublished,
      isVerified: user.isVerified,
      isSuspended: user.isSuspended,
      suspendedReason: user.suspendedReason ?? null,
      streakDays: user.streakDays,
      createdAt: user.createdAt.toISOString(),
      repHistory: repHistory.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        points: e.points,
        description: e.description,
        createdAt: e.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get admin user detail");
    res.status(500).json({ error: "Failed to get user detail" });
  }
});

// ── Suspend / unsuspend user ─────────────────────────────────────────────────
router.patch("/admin/users/:id/suspend", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const { isSuspended, reason } = req.body as { isSuspended: boolean; reason?: string };

    const [updated] = await db
      .update(usersTable)
      .set({
        isSuspended,
        suspendedReason: isSuspended ? (reason ?? null) : null,
      })
      .where(eq(usersTable.id, id))
      .returning();

    if (!updated) { res.status(404).json({ error: "User not found" }); return; }

    await db.insert(modAuditLogTable).values({
      action: isSuspended ? "suspend_user" : "unsuspend_user",
      targetType: "user",
      targetId: id,
      reason: reason ?? null,
    });

    // Notify and email the affected user
    if (updated?.clerkId) {
      try {
        await db.insert(notificationsTable).values({
          userId: updated.clerkId,
          type: isSuspended ? "suspended" : "unsuspended",
          title: isSuspended ? "Your account has been suspended" : "Your account has been reinstated ✅",
          body: isSuspended
            ? (reason ? `Reason: ${reason}` : "Your account has been suspended by a moderator.")
            : "Your account suspension has been lifted. Welcome back.",
          actorName: "Treffin Admin",
          actorInitials: "TA",
        });
      } catch { /* non-blocking */ }
      if (isSuspended) {
        try {
          const [suspendedUser] = await db
            .select({ betterAuthId: usersTable.betterAuthId, name: usersTable.name })
            .from(usersTable)
            .where(eq(usersTable.id, id))
            .limit(1);
          if (suspendedUser?.betterAuthId) {
            const [baUserRow] = await db
              .select({ email: baUser.email })
              .from(baUser)
              .where(eq(baUser.id, suspendedUser.betterAuthId))
              .limit(1);
            if (baUserRow?.email) {
              const { sendSuspensionEmail } = await import("../lib/email");
              sendSuspensionEmail(baUserRow.email, suspendedUser.name?.split(" ")[0] ?? "", true, reason).catch(() => {});
            }
          }
        } catch { /* non-blocking */ }
      }
    }

    res.json({ ok: true, isSuspended: updated.isSuspended, suspendedReason: updated.suspendedReason ?? null });
  } catch (err) {
    req.log.error({ err }, "Failed to suspend/unsuspend user");
    res.status(500).json({ error: "Failed to update user suspension" });
  }
});

router.get("/admin/review-requests", async (req, res) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;

    const rows = await db
      .select({
        id: articleReviewRequestsTable.id,
        articleId: articleReviewRequestsTable.articleId,
        articleTitle: articlesTable.title,
        requesterId: articleReviewRequestsTable.requesterId,
        requesterName: usersTable.name,
        status: articleReviewRequestsTable.status,
        reviewerNote: articleReviewRequestsTable.reviewerNote,
        createdAt: articleReviewRequestsTable.createdAt,
      })
      .from(articleReviewRequestsTable)
      .innerJoin(articlesTable, eq(articleReviewRequestsTable.articleId, articlesTable.id))
      .innerJoin(usersTable, eq(articleReviewRequestsTable.requesterId, usersTable.id))
      .orderBy(desc(articleReviewRequestsTable.createdAt));

    const filtered = status
      ? rows.filter((r) => r.status === status)
      : rows;

    res.json(filtered.map((r) => ({
      id: r.id,
      articleId: r.articleId,
      articleTitle: r.articleTitle,
      requesterId: r.requesterId,
      requesterName: r.requesterName,
      status: r.status,
      reviewerNote: r.reviewerNote ?? null,
      createdAt: r.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get review requests");
    res.status(500).json({ error: "Failed to get review requests" });
  }
});

router.patch("/admin/review-requests/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const { status, reviewerNote } = req.body as { status?: string; reviewerNote?: string };

    if (!status || !["approved", "rejected"].includes(status)) {
      res.status(400).json({ error: "status must be 'approved' or 'rejected'" }); return;
    }
    if (reviewerNote !== undefined && typeof reviewerNote !== "string") {
      res.status(400).json({ error: "reviewerNote must be a string" }); return;
    }

    const validStatus = status as "approved" | "rejected";

    const [existing] = await db
      .select()
      .from(articleReviewRequestsTable)
      .where(eq(articleReviewRequestsTable.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Review request not found" }); return;
    }

    if (existing.status !== "pending") {
      res.status(409).json({ error: "Review request has already been actioned" }); return;
    }

    await db
      .update(articleReviewRequestsTable)
      .set({ status: validStatus, reviewerNote: reviewerNote ?? null, updatedAt: new Date() })
      .where(eq(articleReviewRequestsTable.id, id));

    if (validStatus === "approved") {
      await db
        .update(articlesTable)
        .set({ isExpertReviewed: true })
        .where(eq(articlesTable.id, existing.articleId));
    }

    const [article] = await db
      .select()
      .from(articlesTable)
      .where(eq(articlesTable.id, existing.articleId))
      .limit(1);

    if (article) {
      const notifTitle = validStatus === "approved"
        ? "Your article was approved for peer review!"
        : "Your article review request was rejected";
      const notifBody = validStatus === "approved"
        ? `"${article.title}" has received an Expert Reviewed badge.`
        : `"${article.title}"${reviewerNote ? ` — ${reviewerNote}` : ""}`;

      await createNotification({
        targetDbUserId: article.authorId,
        actorClerkId: "admin",
        actorDisplayName: "Treffin Admin",
        type: "review",
        title: notifTitle,
        body: notifBody,
      }, req.log);
    }

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to action review request");
    res.status(500).json({ error: "Failed to action review request" });
  }
});

router.get("/admin/weekly-challenge", async (req, res) => {
  try {
    const [challenge] = await db
      .select()
      .from(weeklyChallengesTable)
      .where(eq(weeklyChallengesTable.isActive, true))
      .orderBy(desc(weeklyChallengesTable.createdAt))
      .limit(1);

    if (!challenge) {
      res.status(404).json({ error: "No active weekly challenge" }); return;
    }

    res.json({
      id: challenge.id,
      question: challenge.question,
      startDate: challenge.startDate.toISOString(),
      endDate: challenge.endDate.toISOString(),
      isActive: challenge.isActive,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get weekly challenge");
    res.status(500).json({ error: "Failed to get weekly challenge" });
  }
});

router.post("/admin/weekly-challenge", async (req, res) => {
  try {
    const { question, startDate, endDate } = req.body;

    await db
      .update(weeklyChallengesTable)
      .set({ isActive: false })
      .where(eq(weeklyChallengesTable.isActive, true));

    const [challenge] = await db
      .insert(weeklyChallengesTable)
      .values({
        question,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive: true,
      })
      .returning();

    await db.insert(modAuditLogTable).values({
      action: "set_weekly_challenge",
      targetType: "weekly_challenge",
      targetId: challenge.id,
      reason: question,
    });

    res.json({
      id: challenge.id,
      question: challenge.question,
      startDate: challenge.startDate.toISOString(),
      endDate: challenge.endDate.toISOString(),
      isActive: challenge.isActive,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to set weekly challenge");
    res.status(500).json({ error: "Failed to set weekly challenge" });
  }
});

router.get("/admin/weekly-challenge/submissions", async (req, res) => {
  try {
    const [challenge] = await db
      .select()
      .from(weeklyChallengesTable)
      .where(eq(weeklyChallengesTable.isActive, true))
      .orderBy(desc(weeklyChallengesTable.createdAt))
      .limit(1);

    if (!challenge) {
      res.json({ challenge: null, submissions: [] }); return;
    }

    const submissions = await db
      .select()
      .from(weeklyChallengeSubmissionsTable)
      .where(eq(weeklyChallengeSubmissionsTable.challengeId, challenge.id))
      .orderBy(desc(weeklyChallengeSubmissionsTable.createdAt));

    res.json({
      challenge: {
        id: challenge.id,
        question: challenge.question,
        startDate: challenge.startDate.toISOString(),
        endDate: challenge.endDate.toISOString(),
        isActive: challenge.isActive,
        winnerUserId: challenge.winnerUserId ?? null,
        winnerName: challenge.winnerName ?? null,
        winnerAvatar: challenge.winnerAvatar ?? null,
        winnerResponse: challenge.winnerResponse ?? null,
      },
      submissions: submissions.map((s) => ({
        id: s.id,
        challengeId: s.challengeId,
        userId: s.userId,
        userName: s.userName,
        userAvatar: s.userAvatar ?? null,
        response: s.response,
        createdAt: s.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get weekly challenge submissions");
    res.status(500).json({ error: "Failed to get submissions" });
  }
});

router.post("/admin/weekly-challenge/:id/winner", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { submissionId, userId, userName, userAvatar, response } = req.body as {
    submissionId: number;
    userId: string;
    userName: string;
    userAvatar: string | null;
    response: string;
  };

  try {
    const [challenge] = await db
      .update(weeklyChallengesTable)
      .set({
        winnerUserId: userId,
        winnerName: userName,
        winnerAvatar: userAvatar ?? null,
        winnerResponse: response,
      })
      .where(eq(weeklyChallengesTable.id, id))
      .returning();

    if (!challenge) {
      res.status(404).json({ error: "Challenge not found" }); return;
    }

    await awardRep(userId, "weekly_challenge_won", "Won the weekly intellectual challenge", id);

    await db.insert(modAuditLogTable).values({
      action: "award_rep_challenge_winner",
      targetType: "weekly_challenge",
      targetId: id,
      reason: `Winner: ${userName} (userId: ${userId})`,
    });

    res.json({
      id: challenge.id,
      winnerUserId: challenge.winnerUserId,
      winnerName: challenge.winnerName,
      winnerResponse: challenge.winnerResponse,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to set weekly challenge winner");
    res.status(500).json({ error: "Failed to set winner" });
  }
});

router.get("/admin/daily-question/votes", async (req, res) => {
  try {
    const [question] = await db
      .select()
      .from(dailyQuestionsTable)
      .where(eq(dailyQuestionsTable.isLive, true))
      .orderBy(desc(dailyQuestionsTable.createdAt))
      .limit(1);

    if (!question) {
      res.json({ question: null, supportCount: 0, againstCount: 0, total: 0 }); return;
    }

    const voteCounts = await db
      .select({ side: dailyQuestionVotesTable.side, count: sql<number>`count(*)::int` })
      .from(dailyQuestionVotesTable)
      .where(eq(dailyQuestionVotesTable.questionId, question.id))
      .groupBy(dailyQuestionVotesTable.side);

    const supportCount = voteCounts.find((v) => v.side === "support")?.count ?? 0;
    const againstCount = voteCounts.find((v) => v.side === "against")?.count ?? 0;
    const total = supportCount + againstCount;

    res.json({
      question: {
        id: question.id,
        question: question.question,
        supportPercent: question.supportPercent,
        againstPercent: question.againstPercent,
        participantCount: question.participantCount,
      },
      supportCount,
      againstCount,
      total,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get daily question votes");
    res.status(500).json({ error: "Failed to get votes" });
  }
});

// ── Freeze / unfreeze debate ────────────────────────────────────────────────
router.patch("/admin/debates/:id/freeze", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const { isFrozen, reason } = req.body as { isFrozen: boolean; reason?: string };

    const [updated] = await db
      .update(debatesTable)
      .set({ isFrozen, frozenReason: isFrozen ? (reason ?? null) : null })
      .where(eq(debatesTable.id, id))
      .returning();

    if (!updated) { res.status(404).json({ error: "Debate not found" }); return; }

    await db.insert(modAuditLogTable).values({
      action: isFrozen ? "freeze_debate" : "unfreeze_debate",
      targetType: "debate",
      targetId: id,
      reason: reason ?? null,
    });

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to freeze debate");
    res.status(500).json({ error: "Failed to freeze debate" });
  }
});

// ── Soft-remove comment ──────────────────────────────────────────────────────
router.patch("/admin/comments/:id/remove", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const { reason } = req.body as { reason: string };

    if (!reason?.trim()) { res.status(400).json({ error: "reason is required" }); return; }

    await db
      .update(commentsTable)
      .set({ isRemoved: true, removedReason: reason.trim() })
      .where(eq(commentsTable.id, id));

    await db.insert(modAuditLogTable).values({
      action: "remove_comment",
      targetType: "comment",
      targetId: id,
      reason: reason.trim(),
    });

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to soft-remove comment");
    res.status(500).json({ error: "Failed to remove comment" });
  }
});

// ── Soft-remove post ─────────────────────────────────────────────────────────
router.patch("/admin/posts/:id/remove", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const { reason } = req.body as { reason: string };

    if (!reason?.trim()) { res.status(400).json({ error: "reason is required" }); return; }

    await db
      .update(postsTable)
      .set({ isRemoved: true, removedReason: reason.trim(), isFlagged: true })
      .where(eq(postsTable.id, id));

    await db.insert(modAuditLogTable).values({
      action: "remove_post",
      targetType: "post",
      targetId: id,
      reason: reason.trim(),
    });

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to soft-remove post");
    res.status(500).json({ error: "Failed to remove post" });
  }
});

// ── Mod audit log ────────────────────────────────────────────────────────────
router.get("/admin/audit-log", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;

    const entries = await db
      .select()
      .from(modAuditLogTable)
      .orderBy(desc(modAuditLogTable.createdAt))
      .limit(limit)
      .offset(offset);

    res.json(entries.map((e) => ({
      id: e.id,
      adminIdentifier: e.adminIdentifier ?? null,
      action: e.action,
      targetType: e.targetType,
      targetId: e.targetId,
      reason: e.reason ?? null,
      meta: e.meta ?? null,
      createdAt: e.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get audit log");
    res.status(500).json({ error: "Failed to get audit log" });
  }
});

// ── Content appeals ──────────────────────────────────────────────────────────
router.get("/admin/appeals", async (req, res) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;

    const appeals = await db
      .select()
      .from(contentAppealsTable)
      .orderBy(desc(contentAppealsTable.createdAt));

    const filtered = status ? appeals.filter((a) => a.status === status) : appeals;

    res.json(filtered.map((a) => ({
      id: a.id,
      userId: a.userId,
      contentType: a.contentType,
      contentId: a.contentId,
      reason: a.reason,
      status: a.status,
      reviewNote: a.reviewNote ?? null,
      reviewedAt: a.reviewedAt ? a.reviewedAt.toISOString() : null,
      createdAt: a.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get appeals");
    res.status(500).json({ error: "Failed to get appeals" });
  }
});

router.patch("/admin/appeals/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const { status, reviewNote } = req.body as { status: string; reviewNote?: string };
    if (!["approved", "denied"].includes(status)) {
      res.status(400).json({ error: "status must be 'approved' or 'denied'" }); return;
    }

    const [appeal] = await db
      .select()
      .from(contentAppealsTable)
      .where(eq(contentAppealsTable.id, id))
      .limit(1);

    if (!appeal) { res.status(404).json({ error: "Appeal not found" }); return; }
    if (appeal.status !== "open") { res.status(409).json({ error: "Appeal already reviewed" }); return; }

    const [updated] = await db
      .update(contentAppealsTable)
      .set({ status, reviewNote: reviewNote ?? null, reviewedAt: new Date() })
      .where(eq(contentAppealsTable.id, id))
      .returning();

    // If approved, restore the content
    if (status === "approved") {
      if (appeal.contentType === "comment") {
        await db.update(commentsTable).set({ isRemoved: false, removedReason: null }).where(eq(commentsTable.id, appeal.contentId));
      } else if (appeal.contentType === "post") {
        await db.update(postsTable).set({ isRemoved: false, removedReason: null, isFlagged: false }).where(eq(postsTable.id, appeal.contentId));
      }
    }

    await db.insert(modAuditLogTable).values({
      action: status === "approved" ? "approve_appeal" : "deny_appeal",
      targetType: "appeal",
      targetId: id,
      reason: reviewNote ?? null,
    });

    // Notify the user who submitted the appeal
    try {
      await db.insert(notificationsTable).values({
        userId: appeal.userId,
        type: "appeal_decided",
        title: status === "approved" ? "Your appeal was approved ✅" : "Your appeal was denied",
        body: status === "approved"
          ? `Your ${appeal.contentType} appeal was reviewed and approved — your content has been restored.`
          : (reviewNote
            ? `Your ${appeal.contentType} appeal was denied. Note: ${reviewNote.substring(0, 120)}`
            : `Your ${appeal.contentType} appeal was reviewed and denied.`),
        actorName: "Treffin Admin",
        actorInitials: "TA",
      });
    } catch { /* non-blocking */ }

    res.json({
      id: updated.id,
      userId: updated.userId,
      contentType: updated.contentType,
      contentId: updated.contentId,
      reason: updated.reason,
      status: updated.status,
      reviewNote: updated.reviewNote ?? null,
      reviewedAt: updated.reviewedAt ? updated.reviewedAt.toISOString() : null,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to review appeal");
    res.status(500).json({ error: "Failed to review appeal" });
  }
});

/* ── Math admin routes ──────────────────────────────────────────── */

router.get("/admin/math-flags", async (req, res) => {
  try {
    const flags = await db
      .select()
      .from(mathFlagsTable)
      .orderBy(desc(mathFlagsTable.createdAt))
      .limit(200);
    res.json(flags);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch math flags");
    res.status(500).json({ error: "Failed to fetch math flags" });
  }
});

router.put("/admin/math-flags/:id/resolve", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const { status, resolvedBy } = req.body as { status: string; resolvedBy?: string };
    if (!["resolved", "dismissed"].includes(status)) {
      res.status(400).json({ error: "status must be resolved or dismissed" }); return;
    }
    const [updated] = await db
      .update(mathFlagsTable)
      .set({ status, resolvedBy: resolvedBy ?? "admin", resolvedAt: new Date() })
      .where(eq(mathFlagsTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Flag not found" }); return; }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to resolve math flag");
    res.status(500).json({ error: "Failed to resolve math flag" });
  }
});

// PATCH /admin/math-problems/:id — change status; notifies submitter on approval
router.patch("/admin/math-problems/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const { status } = req.body as { status?: string };
    const VALID = ["open", "locked", "archived"];
    if (!status || !VALID.includes(status)) {
      res.status(400).json({ error: `status must be one of: ${VALID.join(", ")}` }); return;
    }

    const [before] = await db.select().from(mathProblemsTable).where(eq(mathProblemsTable.id, id));
    if (!before) { res.status(404).json({ error: "Problem not found" }); return; }

    const [updated] = await db
      .update(mathProblemsTable)
      .set({ status })
      .where(eq(mathProblemsTable.id, id))
      .returning();

    // Notify the problem author when their submission is approved (open)
    if (status === "open" && before.status !== "open" && updated.userId) {
      try {
        await db.insert(mathNotificationsTable).values({
          userId: updated.userId,
          type: "problem_approved",
          title: "Your problem was approved! 🎉",
          body: `Your problem "${updated.title.length > 70 ? updated.title.slice(0, 70) + "…" : updated.title}" has been approved and is now live.`,
          targetType: "problem",
          targetId: id,
          fromUserId: "admin",
          fromUserName: "Treffin Admin",
        });
      } catch { /* non-blocking */ }
    }

    await db.insert(modAuditLogTable).values({
      action: "admin_update_math_problem_status",
      targetType: "math_problem",
      targetId: id,
      reason: `Status changed to ${status}`,
    });

    res.json({ ok: true, status });
  } catch (err) {
    req.log.error({ err }, "Failed to update math problem status");
    res.status(500).json({ error: "Failed to update problem status" });
  }
});

router.delete("/admin/math-problems/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    await db.delete(mathSolutionsTable).where(eq(mathSolutionsTable.problemId, id));
    await db.delete(mathFlagsTable).where(and(eq(mathFlagsTable.targetType, "problem"), eq(mathFlagsTable.targetId, id)));
    await db.delete(mathProblemOfWeekTable).where(eq(mathProblemOfWeekTable.problemId, id));
    const [deleted] = await db.delete(mathProblemsTable).where(eq(mathProblemsTable.id, id)).returning();
    if (!deleted) { res.status(404).json({ error: "Problem not found" }); return; }
    await db.insert(modAuditLogTable).values({ action: "admin_delete_math_problem", targetType: "math_problem", targetId: id, reason: "Admin deleted math problem" });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete math problem");
    res.status(500).json({ error: "Failed to delete math problem" });
  }
});

router.delete("/admin/math-solutions/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    await db.delete(mathFlagsTable).where(and(eq(mathFlagsTable.targetType, "solution"), eq(mathFlagsTable.targetId, id)));
    const [deleted] = await db.delete(mathSolutionsTable).where(eq(mathSolutionsTable.id, id)).returning();
    if (!deleted) { res.status(404).json({ error: "Solution not found" }); return; }
    await db.insert(modAuditLogTable).values({ action: "admin_delete_math_solution", targetType: "math_solution", targetId: id, reason: "Admin deleted math solution" });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete math solution");
    res.status(500).json({ error: "Failed to delete math solution" });
  }
});

router.put("/admin/math-potw", async (req, res) => {
  try {
    const { problemId, note } = req.body as { problemId: number; note?: string };
    if (!problemId || isNaN(Number(problemId))) {
      res.status(400).json({ error: "problemId required" }); return;
    }
    const pid = Number(problemId);
    const problem = await db.select().from(mathProblemsTable).where(eq(mathProblemsTable.id, pid)).limit(1);
    if (!problem.length) { res.status(404).json({ error: "Problem not found" }); return; }

    const now = new Date();
    const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    await db.update(mathProblemsTable).set({ isProblemOfWeek: false }).where(eq(mathProblemsTable.isProblemOfWeek, true));
    await db.update(mathProblemsTable).set({ isProblemOfWeek: true }).where(eq(mathProblemsTable.id, pid));
    const [entry] = await db
      .insert(mathProblemOfWeekTable)
      .values({ problemId: pid, weekStart: now, weekEnd, note: note ?? null })
      .returning();
    res.json({ ok: true, entry });
  } catch (err) {
    req.log.error({ err }, "Failed to set math POTW");
    res.status(500).json({ error: "Failed to set POTW" });
  }
});

/* ── Math Contest admin routes ──────────────────────────────────────────── */

router.get("/admin/math-contests", async (req, res) => {
  try {
    const contests = await db
      .select()
      .from(mathContestsTable)
      .orderBy(desc(mathContestsTable.createdAt));

    const contestProblems = await db
      .select({
        contestId: mathContestProblemsTable.contestId,
        problemId: mathContestProblemsTable.problemId,
      })
      .from(mathContestProblemsTable)
      .orderBy(mathContestProblemsTable.sortOrder);

    const problemIdsByContest = new Map<number, number[]>();
    for (const row of contestProblems) {
      const list = problemIdsByContest.get(row.contestId) ?? [];
      list.push(row.problemId);
      problemIdsByContest.set(row.contestId, list);
    }

    res.json(contests.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      difficulty: c.difficulty,
      startTime: c.startTime.toISOString(),
      endTime: c.endTime.toISOString(),
      isActive: c.isActive,
      createdBy: c.createdBy,
      prizeDescription: c.prizeDescription ?? null,
      totalParticipants: c.totalParticipants,
      createdAt: c.createdAt.toISOString(),
      problemIds: problemIdsByContest.get(c.id) ?? [],
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get math contests");
    res.status(500).json({ error: "Failed to get math contests" });
  }
});

router.post("/admin/math-contests", async (req, res) => {
  try {
    const { title, description, difficulty, startTime, endTime, prizeDescription, problemIds } = req.body as {
      title: string;
      description: string;
      difficulty?: string;
      startTime: string;
      endTime: string;
      prizeDescription?: string;
      problemIds?: number[];
    };

    if (!title || !description || !startTime || !endTime) {
      res.status(400).json({ error: "title, description, startTime, and endTime are required" }); return;
    }

    const [contest] = await db
      .insert(mathContestsTable)
      .values({
        title,
        description,
        difficulty: difficulty ?? "intermediate",
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        prizeDescription: prizeDescription ?? null,
        createdBy: "admin",
        isActive: true,
        totalParticipants: 0,
      })
      .returning();

    if (problemIds && problemIds.length > 0) {
      await db.insert(mathContestProblemsTable).values(
        problemIds.map((pid, idx) => ({
          contestId: contest.id,
          problemId: pid,
          points: 100,
          sortOrder: idx,
        })),
      );
    }

    await db.insert(modAuditLogTable).values({
      action: "create_math_contest",
      targetType: "math_contest",
      targetId: contest.id,
      reason: title,
    });

    res.json({
      id: contest.id,
      title: contest.title,
      description: contest.description,
      difficulty: contest.difficulty,
      startTime: contest.startTime.toISOString(),
      endTime: contest.endTime.toISOString(),
      isActive: contest.isActive,
      createdBy: contest.createdBy,
      prizeDescription: contest.prizeDescription ?? null,
      totalParticipants: contest.totalParticipants,
      createdAt: contest.createdAt.toISOString(),
      problemIds: problemIds ?? [],
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create math contest");
    res.status(500).json({ error: "Failed to create math contest" });
  }
});

router.patch("/admin/math-contests/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const { title, description, difficulty, startTime, endTime, prizeDescription, isActive, problemIds } = req.body as {
      title?: string;
      description?: string;
      difficulty?: string;
      startTime?: string;
      endTime?: string;
      prizeDescription?: string | null;
      isActive?: boolean;
      problemIds?: number[];
    };

    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (difficulty !== undefined) updates.difficulty = difficulty;
    if (startTime !== undefined) updates.startTime = new Date(startTime);
    if (endTime !== undefined) updates.endTime = new Date(endTime);
    if (prizeDescription !== undefined) updates.prizeDescription = prizeDescription;
    if (isActive !== undefined) updates.isActive = isActive;

    let updated;
    if (Object.keys(updates).length > 0) {
      [updated] = await db
        .update(mathContestsTable)
        .set(updates)
        .where(eq(mathContestsTable.id, id))
        .returning();
    } else {
      [updated] = await db
        .select()
        .from(mathContestsTable)
        .where(eq(mathContestsTable.id, id));
    }

    if (!updated) { res.status(404).json({ error: "Contest not found" }); return; }

    // Replace the problem set wholesale when problemIds is provided — the
    // admin form always sends the full desired set, so a delete + reinsert
    // keeps sortOrder in sync with no separate add/remove endpoints needed.
    if (problemIds !== undefined) {
      await db
        .delete(mathContestProblemsTable)
        .where(eq(mathContestProblemsTable.contestId, id));

      if (problemIds.length > 0) {
        await db.insert(mathContestProblemsTable).values(
          problemIds.map((pid, idx) => ({
            contestId: id,
            problemId: pid,
            points: 100,
            sortOrder: idx,
          })),
        );
      }
    }

    await db.insert(modAuditLogTable).values({
      action: "update_math_contest",
      targetType: "math_contest",
      targetId: id,
      reason: updated.title,
    });

    const finalProblemIds = problemIds !== undefined
      ? problemIds
      : (
          await db
            .select({ problemId: mathContestProblemsTable.problemId })
            .from(mathContestProblemsTable)
            .where(eq(mathContestProblemsTable.contestId, id))
            .orderBy(mathContestProblemsTable.sortOrder)
        ).map((r) => r.problemId);

    res.json({
      id: updated.id,
      title: updated.title,
      description: updated.description,
      difficulty: updated.difficulty,
      startTime: updated.startTime.toISOString(),
      endTime: updated.endTime.toISOString(),
      isActive: updated.isActive,
      createdBy: updated.createdBy,
      prizeDescription: updated.prizeDescription ?? null,
      totalParticipants: updated.totalParticipants,
      createdAt: updated.createdAt.toISOString(),
      problemIds: finalProblemIds,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update math contest");
    res.status(500).json({ error: "Failed to update math contest" });
  }
});

router.delete("/admin/math-contests/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const [deleted] = await db
      .delete(mathContestsTable)
      .where(eq(mathContestsTable.id, id))
      .returning();

    if (!deleted) { res.status(404).json({ error: "Contest not found" }); return; }

    await db.insert(modAuditLogTable).values({
      action: "delete_math_contest",
      targetType: "math_contest",
      targetId: id,
      reason: `Deleted contest: ${deleted.title}`,
    });

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete math contest");
    res.status(500).json({ error: "Failed to delete math contest" });
  }
});

router.get("/admin/math-contests/:id/leaderboard", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const [contest] = await db
      .select({ id: mathContestsTable.id })
      .from(mathContestsTable)
      .where(eq(mathContestsTable.id, id));

    if (!contest) { res.status(404).json({ error: "Contest not found" }); return; }

    const entries = await db
      .select()
      .from(mathContestEntriesTable)
      .where(eq(mathContestEntriesTable.contestId, id))
      .orderBy(desc(mathContestEntriesTable.score), mathContestEntriesTable.joinedAt);

    res.json(
      entries.map((entry, idx) => ({
        rank: entry.rank ?? idx + 1,
        userId: entry.userId,
        userName: entry.userName,
        score: entry.score,
        solutionsCount: entry.solutionsCount,
        joinedAt: entry.joinedAt.toISOString(),
        lastSubmittedAt: entry.lastSubmittedAt ? entry.lastSubmittedAt.toISOString() : null,
      })),
    );
  } catch (err) {
    req.log.error({ err }, "Failed to get math contest leaderboard");
    res.status(500).json({ error: "Failed to get math contest leaderboard" });
  }
});

// ── DB TOOLS ──────────────────────────────────────────────────────────────────

const WORKSPACE_ROOT = path.resolve(process.cwd(), "../..");

function runCommand(cmd: string, timeoutMs = 120_000): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(
      cmd,
      { cwd: WORKSPACE_ROOT, timeout: timeoutMs },
      (err, stdout, stderr) => {
        if (err) reject(new Error(stderr || err.message));
        else resolve(stdout);
      },
    );
  });
}

/** Push the Drizzle schema to the database (creates any missing tables). */
async function runSchemaPush(): Promise<string> {
  return runCommand("pnpm --filter @workspace/db run push-force", 90_000);
}

function runSeedScript(): Promise<string> {
  return runCommand("pnpm --filter @workspace/scripts run seed", 120_000);
}

router.get("/admin/db/counts", async (req, res) => {
  try {
    const [users] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable);
    const [debates] = await db.select({ count: sql<number>`count(*)::int` }).from(debatesTable);
    const [articles] = await db.select({ count: sql<number>`count(*)::int` }).from(articlesTable);
    const [communities] = await db.select({ count: sql<number>`count(*)::int` }).from(communitiesTable);
    const [posts] = await db.select({ count: sql<number>`count(*)::int` }).from(postsTable);
    const [mathProblems] = await db.select({ count: sql<number>`count(*)::int` }).from(mathProblemsTable);
    res.json({
      users: users?.count ?? 0,
      debates: debates?.count ?? 0,
      articles: articles?.count ?? 0,
      communities: communities?.count ?? 0,
      posts: posts?.count ?? 0,
      mathProblems: mathProblems?.count ?? 0,
    });
  } catch (err) {
    req.log.error({ err }, "db/counts failed");
    res.status(500).json({ error: "Failed to get counts" });
  }
});

/** Standalone schema push — creates missing tables without touching data. */
router.post("/admin/db/push-schema", requireAdmin, async (req, res) => {
  try {
    const out = await runSchemaPush();
    res.json({ ok: true, output: out });
  } catch (err) {
    req.log.error({ err }, "db/push-schema failed");
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.post("/admin/db/seed", async (req, res) => {
  try {
    const schemaOut = await runSchemaPush();
    const stdout = await runSeedScript();
    res.json({ ok: true, message: "Seed complete", stdout: schemaOut + "\n" + stdout });
  } catch (err) {
    req.log.error({ err }, "db/seed failed");
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.post("/admin/db/reset-and-seed", async (req, res) => {
  try {
    // Audit log BEFORE the reset (tables will be truncated, so log first)
    await db.insert(modAuditLogTable).values({
      action: "db_reset",
      targetType: "system",
      targetId: 0,
      reason: "Admin triggered database reset and reseed",
      adminIdentifier: "admin-panel",
    });

    // Push schema first so all tables exist before truncating
    await runSchemaPush();

    // Truncate all main content tables — CASCADE handles FK dependencies
    await db.execute(sql`
      DO $$
      DECLARE
        tbl text;
        tbls text[] := ARRAY[
          'reputation_events','weekly_challenge_submissions','weekly_challenges',
          'daily_question_votes','daily_questions','math_contest_entries',
          'math_contest_problems','math_contests','math_problem_of_week',
          'math_reactions','math_flags','math_annotations','math_bookmarks',
          'math_difficulty_votes','math_notifications','math_user_profiles',
          'math_solutions','math_problems','math_categories',
          'post_reports','post_likes','comment_likes','comments','posts',
          'community_members','communities','article_likes',
          'article_review_requests','articles','debate_daily_votes',
          'debate_participant_votes','debate_agreements','debate_outcomes',
          'debate_opt_outs','debate_rules_acks','debates','content_appeals',
          'mod_audit_log','notifications','user_positions','user_domain_scores',
          'topics','users'
        ];
      BEGIN
        FOREACH tbl IN ARRAY tbls LOOP
          IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = tbl
          ) THEN
            EXECUTE format('TRUNCATE %I RESTART IDENTITY CASCADE', tbl);
          END IF;
        END LOOP;
      END $$
    `);

    const stdout = await runSeedScript();
    res.json({ ok: true, message: "Reset & reseed complete", stdout });
  } catch (err) {
    req.log.error({ err }, "db/reset-and-seed failed");
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// ── Admin debate moderation take-over ───────────────────────────────────────

/** Set/clear the adminModerating flag on a debate. */
router.patch("/admin/debates/:id/take-control", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const active = req.body?.active !== false; // default true
    const [debateRow] = await db
      .select({ title: debatesTable.title, creatorUserId: debatesTable.creatorUserId })
      .from(debatesTable)
      .where(eq(debatesTable.id, id))
      .limit(1);

    await db.update(debatesTable).set({ adminModerating: active }).where(eq(debatesTable.id, id));
    await db.insert(modAuditLogTable).values({
      action: active ? "admin_take_control" : "admin_release_control",
      targetType: "debate",
      targetId: id,
      reason: active ? "Admin took over moderation" : "Admin released moderation",
    });

    // Notify the creator when admin takes over so they understand what happened.
    if (active && debateRow?.creatorUserId) {
      try {
        const title = debateRow.title;
        const shortTitle = title.length > 60 ? title.substring(0, 60) + "…" : title;
        await notifyUser(
          debateRow.creatorUserId,
          "admin",
          {
            type: "admin_took_control",
            title: "Admin has taken over your debate",
            body: `An admin has taken over active moderation of your debate "${shortTitle}". Participants will see an oversight notice.`,
            actorDisplayName: "Treffin Admin",
          },
          req.log,
        );
      } catch (err) {
        req.log.error({ err }, "Failed to notify creator of admin takeover");
      }
    }

    res.json({ ok: true, adminModerating: active });
  } catch (err) {
    req.log.error({ err }, "Failed to toggle admin debate control");
    res.status(500).json({ error: "Failed to update debate" });
  }
});

/** List all top-level comments in a debate (admin moderation view). */
router.get("/admin/debates/:id/arguments", async (req, res) => {
  try {
    const debateId = Number(req.params.id);
    if (isNaN(debateId)) { res.status(400).json({ error: "Invalid id" }); return; }
    const rows = await db
      .select()
      .from(commentsTable)
      .where(and(eq(commentsTable.debateId, debateId), isNull(commentsTable.parentCommentId)))
      .orderBy(desc(commentsTable.createdAt));
    res.json(rows.map(c => ({
      id: c.id,
      authorName: c.isRemoved ? "Deleted User" : c.authorName,
      content: c.isRemoved ? "[removed]" : c.content,
      side: c.side ?? null,
      isFlagged: c.isFlagged,
      flagLabel: c.flagLabel ?? null,
      isRemoved: c.isRemoved,
      isPinned: c.isPinned ?? false,
      isFeatured: c.isFeatured ?? false,
      createdAt: c.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get debate arguments");
    res.status(500).json({ error: "Failed to get arguments" });
  }
});

/** Admin-level pin/unpin a debate argument. */
router.patch("/admin/debates/:debateId/arguments/:commentId/pin", async (req, res) => {
  try {
    const debateId = Number(req.params.debateId);
    const commentId = Number(req.params.commentId);
    if (isNaN(debateId) || isNaN(commentId)) { res.status(400).json({ error: "Invalid id" }); return; }
    const pin = req.body?.pin !== false;
    await db.update(commentsTable).set({ isPinned: pin, pinnedAt: pin ? new Date() : null })
      .where(and(eq(commentsTable.id, commentId), eq(commentsTable.debateId, debateId)));
    await db.insert(modAuditLogTable).values({
      action: pin ? "admin_pin_argument" : "admin_unpin_argument",
      targetType: "comment",
      targetId: commentId,
    });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to admin-pin argument");
    res.status(500).json({ error: "Failed to pin argument" });
  }
});

/** Admin-level feature/unfeature a debate argument. */
router.patch("/admin/debates/:debateId/arguments/:commentId/feature", async (req, res) => {
  try {
    const debateId = Number(req.params.debateId);
    const commentId = Number(req.params.commentId);
    if (isNaN(debateId) || isNaN(commentId)) { res.status(400).json({ error: "Invalid id" }); return; }
    const feature = req.body?.feature !== false;
    await db.update(commentsTable).set({ isFeatured: feature })
      .where(and(eq(commentsTable.id, commentId), eq(commentsTable.debateId, debateId)));
    await db.insert(modAuditLogTable).values({
      action: feature ? "admin_feature_argument" : "admin_unfeature_argument",
      targetType: "comment",
      targetId: commentId,
    });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to admin-feature argument");
    res.status(500).json({ error: "Failed to feature argument" });
  }
});

/** Admin-level remove a debate argument. */
router.delete("/admin/debates/:debateId/arguments/:commentId", async (req, res) => {
  try {
    const debateId = Number(req.params.debateId);
    const commentId = Number(req.params.commentId);
    if (isNaN(debateId) || isNaN(commentId)) { res.status(400).json({ error: "Invalid id" }); return; }
    const reason = (req.body?.reason as string | undefined) ?? "Removed by admin";
    await db.update(commentsTable)
      .set({ isRemoved: true, removedReason: reason })
      .where(and(eq(commentsTable.id, commentId), eq(commentsTable.debateId, debateId)));
    await db.insert(modAuditLogTable).values({
      action: "admin_remove_argument",
      targetType: "comment",
      targetId: commentId,
      reason,
    });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to admin-remove argument");
    res.status(500).json({ error: "Failed to remove argument" });
  }
});

// ── Elite Thinker threshold settings ────────────────────────────────────────

router.get("/admin/settings/elite-threshold", async (_req, res) => {
  res.json({ threshold: getEliteThreshold() });
});

router.put("/admin/settings/elite-threshold", async (req, res) => {
  const raw = req.body?.threshold;
  const threshold = typeof raw === "number" ? raw : parseInt(raw, 10);
  if (!threshold || isNaN(threshold) || threshold < 1 || threshold > 1_000_000) {
    res.status(400).json({ error: "threshold must be a whole number between 1 and 1,000,000" });
    return;
  }

  const oldThreshold = getEliteThreshold();

  try {
    // 1. Persist to DB (upsert)
    await db
      .insert(appSettingsTable)
      .values({ key: "elite_thinker_threshold", value: String(threshold), updatedBy: "admin" })
      .onConflictDoUpdate({
        target: appSettingsTable.key,
        set: { value: String(threshold), updatedAt: new Date(), updatedBy: "admin" },
      });

    // 2. Update in-memory cache so titleForScore() is immediately consistent
    setEliteThreshold(threshold);

    // 3. Audit log
    await db.insert(modAuditLogTable).values({
      action: "update_elite_threshold",
      targetType: "setting",
      reason: `Elite Thinker threshold changed ${oldThreshold.toLocaleString()} → ${threshold.toLocaleString()} rep`,
    });

    // 4. Broadcast in-app notification to every user
    const title = "🏆 Elite Thinker Threshold Updated";
    const body = `The Elite Thinker reputation threshold is now ${threshold.toLocaleString()} rep. Keep contributing to reach the top!`;

    const allUsers = await db.select({ id: usersTable.id }).from(usersTable);
    if (allUsers.length > 0) {
      // Insert in chunks of 500 to avoid hitting Postgres parameter limits
      const CHUNK = 500;
      for (let i = 0; i < allUsers.length; i += CHUNK) {
        await db.insert(notificationsTable).values(
          allUsers.slice(i, i + CHUNK).map((u) => ({
            userId: u.id,
            type: "system_announcement",
            title,
            body,
            actorName: "Treffin",
            actorInitials: "TR",
            count: 1,
            batchKey: `elite_threshold_${Date.now()}`,
          }))
        );
      }
    }

    // 5. Web push broadcast (best-effort, non-blocking)
    void sendPushToAll({ title, body, url: "/notifications", tag: "elite_threshold" }, req.log);

    res.json({ ok: true, threshold, notified: allUsers.length });
  } catch (err) {
    req.log.error({ err }, "Failed to update elite threshold");
    res.status(500).json({ error: "Failed to update threshold" });
  }
});

// ── Admin notification counts ────────────────────────────────────────────────
router.get("/admin/notifications/counts", async (req, res) => {
  try {
    const [appeals, reviews, creatorReports] = await Promise.all([
      db.select({ id: contentAppealsTable.id }).from(contentAppealsTable).where(eq(contentAppealsTable.status, "open")),
      db.select({ id: articleReviewRequestsTable.id }).from(articleReviewRequestsTable).where(eq(articleReviewRequestsTable.status, "pending")),
      db.select({ id: debateCreatorReportsTable.id }).from(debateCreatorReportsTable).where(eq(debateCreatorReportsTable.status, "pending")),
    ]);
    res.json({
      openAppeals: appeals.length,
      pendingReviews: reviews.length,
      openCreatorReports: creatorReports.length,
      total: appeals.length + reviews.length + creatorReports.length,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get admin notification counts");
    res.status(500).json({ error: "Failed to get counts" });
  }
});

export default router;
