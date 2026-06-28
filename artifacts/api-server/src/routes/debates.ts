import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { debatesTable, commentsTable, debateOutcomesTable, notificationsTable, debateDailyVotesTable, debateAgreementsTable, debateAgreementUpvotesTable, debateParticipantVotesTable, usersTable, debateRulesAcksTable, debateOptOutsTable, modAuditLogTable, commentLikesTable } from "@workspace/db";
import { eq, desc, inArray, and, sql } from "drizzle-orm";
import { createNotification } from "../lib/notify";
import { checkToxicity, detectAiContent } from "../lib/content-moderation";
import { awardRep } from "./reputation";

const router = Router();

const PERSONAL_ATTACK_PATTERNS = [
  /\byou('re| are)\s+(just|always|never|stupid|dumb|ignorant|wrong|lying|clueless)\b/i,
  /\byour\s+(argument is\s+)?(stupid|dumb|garbage|trash|nonsense)\b/i,
  /\byou\s+(don't|cant|can't)\s+(even|possibly)\b/i,
];

function detectPersonalAttack(text: string): string | null {
  for (const pattern of PERSONAL_ATTACK_PATTERNS) {
    if (pattern.test(text)) {
      return "Your argument seems to address the person rather than the idea. Consider focusing on the argument itself.";
    }
  }
  if ((text.match(/\byou\b/gi) ?? []).length >= 4) {
    return "Your argument contains many direct references to the other person. Consider focusing on the ideas instead.";
  }
  return null;
}

function detectSelfPromotion(text: string, authorId: string): boolean {
  const urlPattern = /https?:\/\/[^\s]+/g;
  const urls = text.match(urlPattern) ?? [];
  return urls.some((url) => url.includes(`/articles/`) && url.includes(authorId));
}

function serializeDebate(d: typeof debatesTable.$inferSelect) {
  return {
    id: d.id,
    title: d.title,
    description: d.description ?? null,
    category: d.category,
    supportPercent: d.supportPercent,
    againstPercent: d.againstPercent,
    participantCount: d.participantCount,
    isLive: d.isLive,
    imageUrl: d.imageUrl ?? null,
    rank: d.rank ?? null,
    isTrending: d.isTrending,
    isFeatured: d.isFeatured,
    endsAt: d.endsAt ? d.endsAt.toISOString() : null,
    isFrozen: d.isFrozen ?? false,
    frozenReason: d.frozenReason ?? null,
    isAnonymous: d.isAnonymous ?? false,
    sourcesRequired: d.sourcesRequired ?? false,
    closingArgMinHours: d.closingArgMinHours ?? 24,
    contentWarning: d.contentWarning ?? null,
    healthScore: d.healthScore ?? 100,
  };
}

router.get("/debates", async (req, res) => {
  try {
    const debates = await db
      .select()
      .from(debatesTable)
      .orderBy(desc(debatesTable.participantCount));

    res.json(debates.map((d) => serializeDebate(d)));
  } catch (err) {
    req.log.error({ err }, "Failed to get debates");
    res.status(500).json({ error: "Failed to get debates" });
  }
});

router.get("/debates/trending", async (req, res) => {
  try {
    const debates = await db
      .select()
      .from(debatesTable)
      .orderBy(desc(debatesTable.participantCount))
      .limit(5);

    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().slice(0, 10);
    });

    const debateIds = debates.map((d) => d.id);
    const snapshots = debateIds.length > 0
      ? await db
          .select()
          .from(debateDailyVotesTable)
          .where(
            and(
              inArray(debateDailyVotesTable.debateId, debateIds),
              inArray(debateDailyVotesTable.date, last7Days)
            )
          )
      : [];

    res.json(debates.map((d, i) => ({
      id: d.id,
      title: d.title,
      participantCount: d.participantCount,
      rank: i + 1,
      trend: d.trend,
      dailyVotes: last7Days.map((date) => {
        const snap = snapshots.find((s) => s.debateId === d.id && s.date === date);
        return snap?.voteCount ?? 0;
      }),
      endsAt: d.endsAt ? d.endsAt.toISOString() : null,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get trending debates");
    res.status(500).json({ error: "Failed to get trending debates" });
  }
});

// ── Rules acknowledgment (MUST be before /debates/:id to avoid wildcard shadow) ──
router.get("/debates/rules-ack", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const [ack] = await db
      .select()
      .from(debateRulesAcksTable)
      .where(eq(debateRulesAcksTable.userId, userId))
      .limit(1);

    res.json({
      acknowledged: !!ack,
      acknowledgedAt: ack ? ack.acknowledgedAt.toISOString() : null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get rules ack");
    res.status(500).json({ error: "Failed to get rules ack" });
  }
});

router.post("/debates/rules-ack", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    await db
      .insert(debateRulesAcksTable)
      .values({ userId })
      .onConflictDoNothing();

    res.json({ acknowledged: true, acknowledgedAt: new Date().toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to ack rules");
    res.status(500).json({ error: "Failed to acknowledge rules" });
  }
});

router.get("/debates/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [debate] = await db
      .select()
      .from(debatesTable)
      .where(eq(debatesTable.id, id))
      .limit(1);

    if (!debate) {
      res.status(404).json({ error: "Debate not found" }); return;
    }

    res.json(serializeDebate(debate));
  } catch (err) {
    req.log.error({ err }, "Failed to get debate");
    res.status(500).json({ error: "Failed to get debate" });
  }
});

router.post("/debates", async (req, res) => {
  try {
    const { title, description, category } = req.body;
    const { userId: creatorUserId } = getAuth(req);

    const [debate] = await db
      .insert(debatesTable)
      .values({ title, description, category, isLive: false, creatorUserId: creatorUserId ?? null })
      .returning();

    res.status(201).json(serializeDebate(debate));
  } catch (err) {
    req.log.error({ err }, "Failed to create debate");
    res.status(500).json({ error: "Failed to create debate" });
  }
});

router.get("/debates/:id/my-vote", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const { userId } = getAuth(req);
    if (!userId) {
      res.json({ side: null }); return;
    }

    const [vote] = await db
      .select({ side: debateParticipantVotesTable.side })
      .from(debateParticipantVotesTable)
      .where(
        and(
          eq(debateParticipantVotesTable.debateId, id),
          eq(debateParticipantVotesTable.userId, userId)
        )
      )
      .limit(1);

    res.json({ side: vote?.side ?? null });
  } catch (err) {
    req.log.error({ err }, "Failed to get user vote");
    res.status(500).json({ error: "Failed to get user vote" });
  }
});

router.post("/debates/:id/vote", async (req, res) => {
  const auth = getAuth(req);
  const actorClerkId = auth.userId;
  if (!actorClerkId) {
    req.log.warn({
      sessionId: auth.sessionId ?? null,
      hasCookie: !!(req.headers.cookie),
      cookieKeys: req.headers.cookie?.split(";").map(c => c.trim().split("=")[0]) ?? [],
      authorization: req.headers.authorization ? "present" : "absent",
    }, "Vote 401 — Clerk found no userId");
    res.status(401).json({ error: "Sign in to vote" }); return;
  }
  try {
    const id = Number(req.params.id);
    const { vote } = req.body;

    const [debate] = await db
      .select()
      .from(debatesTable)
      .where(eq(debatesTable.id, id))
      .limit(1);

    if (!debate) {
      res.status(404).json({ error: "Debate not found" }); return;
    }

    const [existingVote] = await db
      .select({ side: debateParticipantVotesTable.side })
      .from(debateParticipantVotesTable)
      .where(
        and(
          eq(debateParticipantVotesTable.debateId, id),
          eq(debateParticipantVotesTable.userId, actorClerkId)
        )
      )
      .limit(1);

    const isNewParticipant = !existingVote;
    const newSide = vote === "support" ? "support" : "against";

    await db
      .insert(debateParticipantVotesTable)
      .values({ debateId: id, userId: actorClerkId, side: newSide })
      .onConflictDoUpdate({
        target: [debateParticipantVotesTable.debateId, debateParticipantVotesTable.userId],
        set: { side: newSide },
      });

    const allVotes = await db
      .select({ side: debateParticipantVotesTable.side })
      .from(debateParticipantVotesTable)
      .where(eq(debateParticipantVotesTable.debateId, id));

    const supportCount = allVotes.filter(v => v.side === "support").length;
    const againstCount = allVotes.filter(v => v.side === "against").length;
    const total = allVotes.length || 1;
    const support = Math.round((supportCount / total) * 100);
    const against = 100 - support;

    const [updated] = await db
      .update(debatesTable)
      .set({ supportPercent: support, againstPercent: against, participantCount: total })
      .where(eq(debatesTable.id, id))
      .returning();

    const today = new Date().toISOString().slice(0, 10);
    if (isNewParticipant) {
      await db
        .insert(debateDailyVotesTable)
        .values({ debateId: id, date: today, voteCount: 1 })
        .onConflictDoUpdate({
          target: [debateDailyVotesTable.debateId, debateDailyVotesTable.date],
          set: { voteCount: sql`${debateDailyVotesTable.voteCount} + 1` },
        });
    }

    if (isNewParticipant) {
      try {
        await awardRep(actorClerkId, "debate_joined", "Voted in a debate", id);
      } catch (err) {
        req.log.error({ err }, "Failed to award debate_joined rep");
      }
    }

    if (debate.creatorUserId && debate.creatorUserId !== actorClerkId) {
      try {
        await db.insert(notificationsTable).values({
          userId: debate.creatorUserId,
          type: "debate",
          title: "Someone joined your debate",
          body: `A new participant joined "${debate.title}"`,
          actorName: actorClerkId,
          actorInitials: actorClerkId.substring(0, 2).toUpperCase(),
        });
      } catch (err) {
        req.log.error({ err, debateId: id }, "Failed to insert debate join notification");
      }
    }

    res.json(serializeDebate(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to vote on debate");
    res.status(500).json({ error: "Failed to vote on debate" });
  }
});

router.delete("/debates/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Sign in required" }); return; }
  try {
    const [debate] = await db
      .select({ creatorUserId: debatesTable.creatorUserId })
      .from(debatesTable)
      .where(eq(debatesTable.id, id))
      .limit(1);
    if (!debate) { res.status(404).json({ error: "Debate not found" }); return; }
    if (debate.creatorUserId && debate.creatorUserId !== clerkId) {
      res.status(403).json({ error: "Only the creator can delete this debate" }); return;
    }
    await db.delete(debatesTable).where(eq(debatesTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete debate");
    res.status(500).json({ error: "Failed to delete debate" });
  }
});

router.get("/debates/:id/outcome", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [outcome] = await db
      .select()
      .from(debateOutcomesTable)
      .where(eq(debateOutcomesTable.debateId, id))
      .limit(1);

    if (!outcome) {
      res.status(404).json({ error: "No outcome found" }); return;
    }

    res.json({
      id: outcome.id,
      debateId: outcome.debateId,
      winningSide: outcome.winningSide,
      justification: outcome.justification,
      topSupportCommentId: outcome.topSupportCommentId ?? null,
      topOppositionCommentId: outcome.topOppositionCommentId ?? null,
      publishedAt: outcome.publishedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get debate outcome");
    res.status(500).json({ error: "Failed to get debate outcome" });
  }
});

router.get("/debates/:id/comments", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const comments = await db
      .select()
      .from(commentsTable)
      .where(eq(commentsTable.debateId, id))
      .orderBy(desc(commentsTable.createdAt));

    const { userId } = getAuth(req);
    let likedCommentIds = new Set<number>();
    if (userId && comments.length > 0) {
      const commentIds = comments.map((c) => c.id);
      const myLikes = await db
        .select({ commentId: commentLikesTable.commentId })
        .from(commentLikesTable)
        .where(
          and(
            inArray(commentLikesTable.commentId, commentIds),
            eq(commentLikesTable.userId, userId)
          )
        );
      likedCommentIds = new Set(myLikes.map((l) => l.commentId));
    }

    res.json(comments.map((c) => ({
      id: c.id,
      authorId: c.authorId,
      authorName: c.isRemoved ? "Deleted User" : c.authorName,
      content: c.isRemoved ? "[This content was removed for violating community guidelines]" : c.content,
      side: c.side ?? null,
      isFlagged: c.isFlagged,
      flagLabel: c.flagLabel ?? null,
      createdAt: c.createdAt.toISOString(),
      editedAt: c.editedAt ? c.editedAt.toISOString() : null,
      isRemoved: c.isRemoved,
      removedReason: c.isRemoved ? (c.removedReason ?? null) : null,
      sources: c.sources ?? null,
      wordCount: c.wordCount ?? null,
      likes: c.likes ?? 0,
      likedByMe: likedCommentIds.has(c.id),
      personalAttackWarning: null,
      parentCommentId: c.parentCommentId ?? null,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get debate comments");
    res.status(500).json({ error: "Failed to get debate comments" });
  }
});

router.post("/debates/:id/comments", async (req, res) => {
  try {
    const debateId = Number(req.params.id);
    if (isNaN(debateId)) {
      res.status(400).json({ error: "Invalid debate id" }); return;
    }

    const { authorId, authorName, content, side, sources, argType, parentCommentId } = req.body as {
      authorId?: number;
      authorName: string;
      content: string;
      side?: string;
      sources?: string;
      argType?: string;
      parentCommentId?: number;
    };

    if (!authorName || !content) {
      res.status(400).json({ error: "authorName and content are required" }); return;
    }

    const isReply = !!parentCommentId;

    // Minimum word count — replies are conversational, skip the 30-word floor
    const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
    if (!isReply && wordCount < 30) {
      res.status(400).json({ error: `Arguments must be at least 30 words. Your argument is ${wordCount} word${wordCount === 1 ? "" : "s"}.` }); return;
    }

    const [debate] = await db
      .select()
      .from(debatesTable)
      .where(eq(debatesTable.id, debateId))
      .limit(1);

    if (!debate) {
      res.status(404).json({ error: "Debate not found" }); return;
    }

    // Frozen debate check
    if (debate.isFrozen) {
      res.status(423).json({ error: `This debate has been frozen${debate.frozenReason ? `: ${debate.frozenReason}` : ""}` }); return;
    }

    // Source requirement check — replies are exempt
    if (!isReply && debate.sourcesRequired && (!sources || sources === "[]")) {
      res.status(400).json({ error: "This debate requires at least one source citation. Please add a source." }); return;
    }

    // Closing argument time gate
    const minHours = debate.closingArgMinHours ?? 24;
    if (argType === "closing") {
      const ageHours = (Date.now() - new Date(debate.createdAt).getTime()) / (1000 * 60 * 60);
      if (ageHours < minHours) {
        const remaining = Math.ceil(minHours - ageHours);
        res.status(400).json({ error: `Closing arguments cannot be posted until the debate is at least ${minHours}h old. ${remaining}h remaining.` }); return;
      }
    }

    // Self-promotion detection
    const { userId: actorClerkId } = getAuth(req);
    const isSelfPromo = actorClerkId ? detectSelfPromotion(content, actorClerkId) : false;
    if (isSelfPromo) {
      res.status(400).json({ error: "Posting links to your own articles in debate arguments is not allowed." }); return;
    }

    // Toxicity / profanity check (blocking)
    const toxicityResult = checkToxicity(content);
    if (toxicityResult.blocked) {
      res.status(400).json({ error: "Your argument contains content that violates our community guidelines. Please revise it before submitting." }); return;
    }

    // Source requirement for long arguments (≥ 150 words) — replies are exempt
    if (!isReply && wordCount >= 150 && (!sources || sources === "[]" || sources.trim() === "" || sources.trim() === "null")) {
      res.status(400).json({ error: "Arguments of 150 or more words require at least one source citation. Add a supporting link in the Sources field." }); return;
    }

    // AI content detection (non-blocking — flags for human review)
    const aiResult = detectAiContent(content);

    // Personal attack check (non-blocking warning)
    const personalAttackWarning = detectPersonalAttack(content);

    // For replies, look up the parent's side so the reply lives in the same column
    let resolvedSide = side ?? null;
    if (isReply) {
      const [parent] = await db
        .select({ side: commentsTable.side })
        .from(commentsTable)
        .where(eq(commentsTable.id, parentCommentId!))
        .limit(1);
      if (!parent) {
        res.status(404).json({ error: "Parent comment not found" }); return;
      }
      resolvedSide = parent.side ?? null;
    }

    const [comment] = await db
      .insert(commentsTable)
      .values({
        debateId,
        authorId: authorId ?? 0,
        authorName,
        content,
        side: resolvedSide,
        sources: sources ?? null,
        wordCount,
        isFlagged: toxicityResult.flagged,
        toxicityFlagged: toxicityResult.flagged,
        aiSuspected: aiResult.flagged,
        parentCommentId: parentCommentId ?? null,
      })
      .returning();

    if (actorClerkId) {
      try {
        await awardRep(actorClerkId, "comment_posted", "Posted a debate argument", comment.id);
      } catch (err) {
        req.log.error({ err }, "Failed to award comment_posted rep");
      }
    }

    if (actorClerkId && debate.creatorUserId && debate.creatorUserId !== actorClerkId) {
      try {
        await createNotification({
          targetDbUserId: 0,
          actorClerkId,
          actorDisplayName: authorName,
          type: "reply",
          title: "New comment on your debate",
          body: `${authorName} commented on "${debate.title.substring(0, 50)}${debate.title.length > 50 ? "…" : ""}"`,
          targetClerkIdOverride: debate.creatorUserId,
          batchKey: `reply:debate:${debateId}:${debate.creatorUserId}`,
        }, req.log);
      } catch (err) {
        req.log.error({ err, debateId }, "Failed to insert debate comment notification");
      }
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
      editedAt: null,
      isRemoved: false,
      removedReason: null,
      sources: comment.sources ?? null,
      wordCount: comment.wordCount ?? wordCount,
      personalAttackWarning,
      parentCommentId: comment.parentCommentId ?? null,
      likes: 0,
      likedByMe: false,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create debate comment");
    res.status(500).json({ error: "Failed to create debate comment" });
  }
});

router.get("/debates/:id/agreements", async (req, res) => {
  try {
    const debateId = Number(req.params.id);
    if (isNaN(debateId)) { res.status(400).json({ error: "Invalid id" }); return; }

    const [debate] = await db.select().from(debatesTable).where(eq(debatesTable.id, debateId)).limit(1);
    if (!debate) { res.status(404).json({ error: "Debate not found" }); return; }

    const agreements = await db
      .select()
      .from(debateAgreementsTable)
      .where(eq(debateAgreementsTable.debateId, debateId))
      .orderBy(desc(debateAgreementsTable.upvotes), desc(debateAgreementsTable.createdAt));

    const { userId } = getAuth(req);
    let upvotedIds = new Set<number>();
    let canPost = false;
    if (userId) {
      const [participation] = await db
        .select()
        .from(debateParticipantVotesTable)
        .where(
          and(
            eq(debateParticipantVotesTable.debateId, debateId),
            eq(debateParticipantVotesTable.userId, userId)
          )
        )
        .limit(1);
      canPost = !!participation;

      if (agreements.length > 0) {
        const myUpvotes = await db
          .select()
          .from(debateAgreementUpvotesTable)
          .where(
            and(
              inArray(debateAgreementUpvotesTable.agreementId, agreements.map((a) => a.id)),
              eq(debateAgreementUpvotesTable.userId, userId)
            )
          );
        upvotedIds = new Set(myUpvotes.map((u) => u.agreementId));
      }
    }

    // Batch-fetch avatar URLs for all agreement authors
    const authorIds = [...new Set(agreements.map((a) => a.authorId))];
    const avatarMap = new Map<string, string | null>();
    if (authorIds.length > 0) {
      const authorProfiles = await db
        .select({ clerkId: usersTable.clerkId, avatarUrl: usersTable.avatarUrl })
        .from(usersTable)
        .where(inArray(usersTable.clerkId, authorIds));
      for (const p of authorProfiles) {
        if (p.clerkId) avatarMap.set(p.clerkId, p.avatarUrl ?? null);
      }
    }

    res.json({
      agreements: agreements.map((a) => ({
        id: a.id,
        debateId: a.debateId,
        authorId: a.authorId,
        authorName: a.authorName,
        authorAvatarUrl: avatarMap.get(a.authorId) ?? null,
        text: a.text,
        upvotes: a.upvotes,
        hasUpvoted: upvotedIds.has(a.id),
        isOwnAgreement: userId === a.authorId,
        createdAt: a.createdAt.toISOString(),
      })),
      canPost,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get debate agreements");
    res.status(500).json({ error: "Failed to get debate agreements" });
  }
});

router.post("/debates/:id/agreements", async (req, res) => {
  try {
    const debateId = Number(req.params.id);
    if (isNaN(debateId)) { res.status(400).json({ error: "Invalid id" }); return; }

    const { userId } = getAuth(req);
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { text } = req.body as { text?: string };
    if (!text || !text.trim()) { res.status(400).json({ error: "text is required" }); return; }
    if (text.trim().length > 280) { res.status(400).json({ error: "text must be 280 characters or fewer" }); return; }

    const [debate] = await db.select().from(debatesTable).where(eq(debatesTable.id, debateId)).limit(1);
    if (!debate) { res.status(404).json({ error: "Debate not found" }); return; }

    // Enforce participant-only writes
    const [participation] = await db
      .select()
      .from(debateParticipantVotesTable)
      .where(
        and(
          eq(debateParticipantVotesTable.debateId, debateId),
          eq(debateParticipantVotesTable.userId, userId)
        )
      )
      .limit(1);
    if (!participation) { res.status(403).json({ error: "You must vote in this debate before adding agreements" }); return; }

    // Derive author display name from stored user profile (not trusted from client).
    // A missing user row means the profile hasn't been materialised yet — surface a
    // clear 409 rather than letting the FK constraint produce a generic 500.
    const [dbUser] = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.clerkId, userId))
      .limit(1);
    if (!dbUser) {
      res.status(409).json({ error: "User profile not yet available — please reload and try again" });
      return;
    }
    const authorName = dbUser.name ?? "Anonymous";

    const [agreement] = await db
      .insert(debateAgreementsTable)
      .values({ debateId, authorId: userId, authorName, text: text.trim() })
      .returning();

    const [authorProfile] = await db
      .select({ avatarUrl: usersTable.avatarUrl })
      .from(usersTable)
      .where(eq(usersTable.clerkId, userId))
      .limit(1);

    res.status(201).json({
      id: agreement.id,
      debateId: agreement.debateId,
      authorId: agreement.authorId,
      authorName: agreement.authorName,
      authorAvatarUrl: authorProfile?.avatarUrl ?? null,
      text: agreement.text,
      upvotes: agreement.upvotes,
      hasUpvoted: false,
      isOwnAgreement: true,
      createdAt: agreement.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create debate agreement");
    res.status(500).json({ error: "Failed to create debate agreement" });
  }
});

router.post("/agreements/:id/upvote", async (req, res) => {
  try {
    const agreementId = Number(req.params.id);
    if (isNaN(agreementId)) { res.status(400).json({ error: "Invalid id" }); return; }

    const { userId } = getAuth(req);
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const [agreement] = await db
      .select()
      .from(debateAgreementsTable)
      .where(eq(debateAgreementsTable.id, agreementId))
      .limit(1);
    if (!agreement) { res.status(404).json({ error: "Agreement not found" }); return; }

    // Enforce participant-only upvotes
    const [participation] = await db
      .select()
      .from(debateParticipantVotesTable)
      .where(
        and(
          eq(debateParticipantVotesTable.debateId, agreement.debateId),
          eq(debateParticipantVotesTable.userId, userId)
        )
      )
      .limit(1);
    if (!participation) { res.status(403).json({ error: "You must vote in this debate before upvoting agreements" }); return; }
    if (agreement.authorId === userId) { res.status(403).json({ error: "You cannot upvote your own agreement" }); return; }

    const [existingUpvote] = await db
      .select()
      .from(debateAgreementUpvotesTable)
      .where(
        and(
          eq(debateAgreementUpvotesTable.agreementId, agreementId),
          eq(debateAgreementUpvotesTable.userId, userId)
        )
      )
      .limit(1);

    let hasUpvoted = false;
    let updated!: typeof debateAgreementsTable.$inferSelect;

    // Upvote toggle wrapped in a transaction.
    // Counter increments/decrements are conditioned on whether a row was actually
    // inserted or deleted, preventing drift under concurrent racing requests.
    // - Delete path: check .returning() length before decrementing.
    // - Insert path: ON CONFLICT DO NOTHING + check .returning() length before incrementing.
    await db.transaction(async (tx) => {
      if (existingUpvote) {
        // Only decrement if this connection actually deleted the row (race-safe)
        const deleted = await tx
          .delete(debateAgreementUpvotesTable)
          .where(eq(debateAgreementUpvotesTable.id, existingUpvote.id))
          .returning();
        if (deleted.length > 0) {
          [updated] = await tx
            .update(debateAgreementsTable)
            .set({ upvotes: sql`GREATEST(0, ${debateAgreementsTable.upvotes} - 1)` })
            .where(eq(debateAgreementsTable.id, agreementId))
            .returning();
          hasUpvoted = false;
        } else {
          // Another request beat us — counter already decremented; fetch current row
          [updated] = await tx
            .select()
            .from(debateAgreementsTable)
            .where(eq(debateAgreementsTable.id, agreementId))
            .limit(1)
            .then((r) => r);
          hasUpvoted = false;
        }
      } else {
        // Only increment if the insert actually wrote a row (skip on unique-conflict)
        const inserted = await tx
          .insert(debateAgreementUpvotesTable)
          .values({ agreementId, userId })
          .onConflictDoNothing()
          .returning();
        if (inserted.length > 0) {
          [updated] = await tx
            .update(debateAgreementsTable)
            .set({ upvotes: sql`${debateAgreementsTable.upvotes} + 1` })
            .where(eq(debateAgreementsTable.id, agreementId))
            .returning();
          hasUpvoted = true;
        } else {
          // Conflict — already upvoted; fetch current state
          [updated] = await tx
            .select()
            .from(debateAgreementsTable)
            .where(eq(debateAgreementsTable.id, agreementId))
            .limit(1)
            .then((r) => r);
          hasUpvoted = true;
        }
      }
    });

    const [upvoteAuthorProfile] = await db
      .select({ avatarUrl: usersTable.avatarUrl })
      .from(usersTable)
      .where(eq(usersTable.clerkId, updated.authorId))
      .limit(1);

    res.json({
      id: updated.id,
      debateId: updated.debateId,
      authorId: updated.authorId,
      authorName: updated.authorName,
      authorAvatarUrl: upvoteAuthorProfile?.avatarUrl ?? null,
      text: updated.text,
      upvotes: updated.upvotes,
      hasUpvoted,
      isOwnAgreement: updated.authorId === userId,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to upvote debate agreement");
    res.status(500).json({ error: "Failed to upvote debate agreement" });
  }
});

// ── Freeze / unfreeze a debate ─────────────────────────────────────────────
router.patch("/debates/:id/freeze", async (req, res) => {
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

    res.json(serializeDebate(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to freeze debate");
    res.status(500).json({ error: "Failed to freeze debate" });
  }
});

// ── Like / unlike a debate comment ─────────────────────────────────────────
router.post("/debates/:id/comments/:commentId/like", async (req, res) => {
  try {
    const debateId = Number(req.params.id);
    const commentId = Number(req.params.commentId);
    if (isNaN(debateId) || isNaN(commentId)) {
      res.status(400).json({ error: "Invalid id" }); return;
    }

    const { userId } = getAuth(req);
    if (!userId) { res.status(401).json({ error: "Sign in to like arguments" }); return; }

    const [comment] = await db
      .select({ id: commentsTable.id, debateId: commentsTable.debateId, likes: commentsTable.likes, authorId: commentsTable.authorId, authorName: commentsTable.authorName })
      .from(commentsTable)
      .where(and(eq(commentsTable.id, commentId), eq(commentsTable.debateId, debateId)))
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

    // Notify comment author when their argument gets a new like (skip on unlike)
    if (liked && comment.authorId) {
      try {
        const [actor] = await db
          .select({ name: usersTable.name })
          .from(usersTable)
          .where(eq(usersTable.clerkId, userId))
          .limit(1);
        const actorName = actor?.name ?? "Someone";

        await createNotification({
          targetDbUserId: comment.authorId,
          actorClerkId: userId,
          actorDisplayName: actorName,
          type: "comment_liked",
          title: "Your argument was liked",
          body: `${actorName} liked your argument in a debate`,
        }, req.log);
      } catch (err) {
        req.log.error({ err }, "Failed to send comment_liked notification");
      }
    }

    res.json({ likes: updatedLikes, liked });
  } catch (err) {
    req.log.error({ err }, "Failed to like comment");
    res.status(500).json({ error: "Failed to like comment" });
  }
});

// ── Opt out of a debate (leave without deleting arguments) ─────────────────
router.post("/debates/:id/leave", async (req, res) => {
  try {
    const debateId = Number(req.params.id);
    if (isNaN(debateId)) { res.status(400).json({ error: "Invalid id" }); return; }

    const { userId } = getAuth(req);
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    await db.transaction(async (tx) => {
      await tx
        .insert(debateOptOutsTable)
        .values({ userId, debateId })
        .onConflictDoNothing();

      const deleted = await tx
        .delete(debateParticipantVotesTable)
        .where(
          and(
            eq(debateParticipantVotesTable.debateId, debateId),
            eq(debateParticipantVotesTable.userId, userId)
          )
        )
        .returning({ id: debateParticipantVotesTable.id });

      if (deleted.length > 0) {
        const remaining = await tx
          .select({ side: debateParticipantVotesTable.side })
          .from(debateParticipantVotesTable)
          .where(eq(debateParticipantVotesTable.debateId, debateId));

        const total = remaining.length;
        const supportCount = remaining.filter(v => v.side === "support").length;
        const support = total > 0 ? Math.round((supportCount / total) * 100) : 50;
        const against = 100 - support;

        await tx
          .update(debatesTable)
          .set({ participantCount: total, supportPercent: support, againstPercent: against })
          .where(eq(debatesTable.id, debateId));
      }
    });

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to leave debate");
    res.status(500).json({ error: "Failed to leave debate" });
  }
});

export default router;
