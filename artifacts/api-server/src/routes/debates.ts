import { Router } from "express";
import { jitProvisionUser } from "../lib/jit-provision";
import { db } from "@workspace/db";
import { debatesTable, commentsTable, debateOutcomesTable, debateDailyVotesTable, debateAgreementsTable, debateAgreementUpvotesTable, debateParticipantVotesTable, usersTable, debateRulesAcksTable, debateOptOutsTable, modAuditLogTable, commentLikesTable, debateCreatorReportsTable, commentReactionsTable, debateAxisWinnersTable } from "@workspace/db";
import { eq, desc, inArray, and, sql } from "drizzle-orm";
import { createNotification } from "../lib/notify";
import { checkToxicity, detectAiContent } from "../lib/content-moderation";
import { awardRep } from "./reputation";
import { debateAcceptsParticipation, isDebateSide, isDebateWinnerSide } from "../lib/security-policy";

const router = Router();

// ── In-memory viewer tracker ─────────────────────────────────────────────────
// Maps debateId → (clientId → lastSeen timestamp)
const debateViewers = new Map<number, Map<string, number>>();
function getViewerCount(debateId: number): number {
  const now = Date.now();
  const viewers = debateViewers.get(debateId);
  if (!viewers) return 0;
  let count = 0;
  for (const ts of viewers.values()) { if (now - ts < 45_000) count++; }
  return count;
}
// Clean up stale entries every 60 s
setInterval(() => {
  const now = Date.now();
  for (const [did, viewers] of debateViewers) {
    for (const [cid, ts] of viewers) { if (now - ts > 90_000) viewers.delete(cid); }
    if (viewers.size === 0) debateViewers.delete(did);
  }
}, 60_000);

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

function serializeDebate(d: typeof debatesTable.$inferSelect, extra: { viewerCount?: number } = {}) {
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
    mathProblemId: d.mathProblemId ?? null,
    creatorUserId: d.creatorUserId ?? null,
    creatorIsModerator: d.creatorIsModerator ?? false,
    winnerAuthority: (d.winnerAuthority as "creator" | "admin") ?? "creator",
    winnerStatus: (d.winnerStatus as "undecided" | "creator_declared" | "pending_admin" | "admin_decided") ?? "undecided",
    endedEarly: d.endedEarly ?? false,
    endedAt: d.endedAt ? d.endedAt.toISOString() : null,
    wordLimit: d.wordLimit ?? null,
    adminModerating: d.adminModerating ?? false,
    viewerCount: extra.viewerCount ?? 0,
  };
}

function serializeDebateComment(
  c: typeof commentsTable.$inferSelect,
  extra: {
    likes: number;
    likedByMe: boolean;
    personalAttackWarning?: string | null;
    reactions?: { fire: number; think: number; bulb: number; myReaction: string | null };
  } = { likes: 0, likedByMe: false }
) {
  return {
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
    likes: extra.likes,
    likedByMe: extra.likedByMe,
    personalAttackWarning: extra.personalAttackWarning ?? null,
    parentCommentId: c.parentCommentId ?? null,
    isPinned: c.isPinned ?? false,
    pinnedAt: c.pinnedAt ? c.pinnedAt.toISOString() : null,
    isFeatured: c.isFeatured ?? false,
    repliesLocked: c.repliesLocked ?? false,
    reactions: extra.reactions ?? { fire: 0, think: 0, bulb: 0, myReaction: null },
  };
}

// A creator who opted to moderate their own debate cannot vote/argue in it —
// that power trade-off is what keeps their moderation fair.
function isBlockedModeratorParticipant(debate: typeof debatesTable.$inferSelect, userId: string): boolean {
  return !!debate.creatorIsModerator && debate.creatorUserId === userId;
}

function isCreatorModerator(debate: typeof debatesTable.$inferSelect, userId: string | null | undefined): boolean {
  return !!userId && !!debate.creatorIsModerator && debate.creatorUserId === userId;
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
    const userId = req.betterAuthSession?.user?.id ?? null;
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
    const userId = req.betterAuthSession?.user?.id ?? null;
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

    res.json(serializeDebate(debate, { viewerCount: getViewerCount(id) }));
  } catch (err) {
    req.log.error({ err }, "Failed to get debate");
    res.status(500).json({ error: "Failed to get debate" });
  }
});

// ── Viewer ping — keeps the live viewer count accurate ─────────────────────
router.post("/debates/:id/ping", (req, res) => {
  const id = Number(req.params.id);
  const { clientId } = req.body as { clientId?: string };
  if (isNaN(id) || !clientId) { res.json({ viewerCount: 0 }); return; }
  let viewers = debateViewers.get(id);
  if (!viewers) { viewers = new Map(); debateViewers.set(id, viewers); }
  viewers.set(clientId, Date.now());
  res.json({ viewerCount: getViewerCount(id) });
});

router.post("/debates", async (req, res) => {
  try {
    const { title, description, category, creatorIsModerator, winnerAuthority, wordLimit } = req.body as {
      title: string; description?: string; category: string;
      creatorIsModerator?: boolean; winnerAuthority?: "creator" | "admin";
      wordLimit?: number;
    };
    const creatorUserId = req.betterAuthSession?.user?.id ?? null;

    if (!creatorUserId) {
      res.status(401).json({ error: "Sign in required to create a debate" });
      return;
    }

    // Ensure the user exists in our DB before creating a debate
    await jitProvisionUser(req.betterAuthSession?.user ?? null);

    const [debate] = await db
      .insert(debatesTable)
      .values({
        title,
        description,
        category,
        isLive: true,
        creatorUserId: creatorUserId ?? null,
        creatorIsModerator: !!creatorIsModerator,
        winnerAuthority: winnerAuthority === "admin" ? "admin" : "creator",
        wordLimit: wordLimit && wordLimit > 0 ? Math.min(wordLimit, 1000) : null,
      })
      .returning();

    // Award rep for debate creation (fire-and-forget — don't block the response)
    awardRep(creatorUserId, "debate_created", `Created debate: ${title.substring(0, 60)}`, debate.id).catch((err: unknown) => {
      req.log.warn({ err, debateId: debate.id }, "Failed to award debate_created reputation");
    });

    res.status(201).json(serializeDebate(debate));
  } catch (err) {
    req.log.error({ err }, "Failed to create debate");
    res.status(500).json({ error: "Failed to create debate" });
  }
});

router.patch("/debates/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const userId = req.betterAuthSession?.user?.id ?? null;
    if (!userId) { res.status(401).json({ error: "Sign in required" }); return; }

    const [debate] = await db.select().from(debatesTable).where(eq(debatesTable.id, id)).limit(1);
    if (!debate) { res.status(404).json({ error: "Debate not found" }); return; }
    if (!isCreatorModerator(debate, userId)) {
      res.status(403).json({ error: "Only this debate's creator-moderator can edit it" }); return;
    }

    const { title, description } = req.body as { title?: string; description?: string };
    const [updated] = await db
      .update(debatesTable)
      .set({
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
      })
      .where(eq(debatesTable.id, id))
      .returning();

    res.json(serializeDebate(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to edit debate");
    res.status(500).json({ error: "Failed to edit debate" });
  }
});

router.post("/debates/:id/end", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const userId = req.betterAuthSession?.user?.id ?? null;
    if (!userId) { res.status(401).json({ error: "Sign in required" }); return; }

    const [debate] = await db.select().from(debatesTable).where(eq(debatesTable.id, id)).limit(1);
    if (!debate) { res.status(404).json({ error: "Debate not found" }); return; }
    if (!isCreatorModerator(debate, userId)) {
      res.status(403).json({ error: "Only this debate's creator-moderator can end it early" }); return;
    }

    const [updated] = await db
      .update(debatesTable)
      .set({ isLive: false, endedEarly: true, endedAt: new Date() })
      .where(eq(debatesTable.id, id))
      .returning();

    res.json(serializeDebate(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to end debate early");
    res.status(500).json({ error: "Failed to end debate early" });
  }
});

router.post("/debates/:id/declare-winner", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const userId = req.betterAuthSession?.user?.id ?? null;
    if (!userId) { res.status(401).json({ error: "Sign in required" }); return; }

    const [debate] = await db.select().from(debatesTable).where(eq(debatesTable.id, id)).limit(1);
    if (!debate) { res.status(404).json({ error: "Debate not found" }); return; }
    if (debate.creatorUserId !== userId) {
      res.status(403).json({ error: "Only this debate's creator can declare a winner" }); return;
    }
    if (debateAcceptsParticipation(debate)) { res.status(409).json({ error: "End the debate before declaring a winner" }); return; }
    if (debate.winnerAuthority === "admin") {
      res.status(403).json({ error: "You've delegated winner decisions for this debate to the admin team" }); return;
    }

    const { winningSide, justification } = req.body as { winningSide: "support" | "against" | "draw"; justification: string };
    if (!isDebateWinnerSide(winningSide) || !justification?.trim()) {
      res.status(400).json({ error: "winningSide and justification are required" }); return;
    }

    const existing = await db.select().from(debateOutcomesTable).where(eq(debateOutcomesTable.debateId, id)).limit(1);
    let outcome;
    if (existing.length > 0) {
      [outcome] = await db
        .update(debateOutcomesTable)
        .set({ winningSide, justification, decidedBy: "creator", overrideReason: null, publishedAt: new Date() })
        .where(eq(debateOutcomesTable.debateId, id))
        .returning();
    } else {
      [outcome] = await db
        .insert(debateOutcomesTable)
        .values({ debateId: id, winningSide, justification, decidedBy: "creator" })
        .returning();
    }

    await db.update(debatesTable).set({ winnerStatus: "creator_declared" }).where(eq(debatesTable.id, id));

    // Notify participants on the winning side
    if (winningSide !== "draw") {
      try {
        const winners = await db
          .select({ userId: debateParticipantVotesTable.userId })
          .from(debateParticipantVotesTable)
          .where(
            and(
              eq(debateParticipantVotesTable.debateId, id),
              eq(debateParticipantVotesTable.side, winningSide),
            )
          );
        for (const w of winners) {
          if (w.userId === userId) continue;
          try {
            await createNotification({
              targetDbUserId: 0,
              targetClerkIdOverride: w.userId,
              actorClerkId: userId,
              actorDisplayName: "Debate Creator",
              type: "debate",
              title: "You won the debate! 🏆",
              body: `The "${debate.title.substring(0, 60)}${debate.title.length > 60 ? "…" : ""}" debate has ended — your side won!`,
            }, req.log);
          } catch { /* non-blocking */ }
          try {
            await awardRep(w.userId, "debate_won", `Won debate: ${debate.title.substring(0, 60)}`, id);
          } catch { /* non-blocking */ }
        }
      } catch (err) {
        req.log.error({ err, debateId: id }, "Failed to send winner notifications");
      }
    }

    // Notify losers and draw participants
    try {
      const losingSide = winningSide === "support" ? "against" : winningSide === "against" ? "support" : null;
      if (losingSide) {
        const losers = await db
          .select({ userId: debateParticipantVotesTable.userId })
          .from(debateParticipantVotesTable)
          .where(and(eq(debateParticipantVotesTable.debateId, id), eq(debateParticipantVotesTable.side, losingSide)));
        for (const l of losers) {
          if (l.userId === userId) continue;
          try {
            await createNotification({
              targetDbUserId: 0,
              targetClerkIdOverride: l.userId,
              actorClerkId: userId,
              actorDisplayName: "Debate Creator",
              type: "debate_outcome",
              title: "Debate outcome declared",
              body: `The "${debate.title.substring(0, 55)}${debate.title.length > 55 ? "…" : ""}" debate ended — the other side won this round.`,
            }, req.log);
          } catch { /* non-blocking */ }
        }
      } else if (winningSide === "draw") {
        const all = await db
          .select({ userId: debateParticipantVotesTable.userId })
          .from(debateParticipantVotesTable)
          .where(eq(debateParticipantVotesTable.debateId, id));
        for (const p of all) {
          if (p.userId === userId) continue;
          try {
            await createNotification({
              targetDbUserId: 0,
              targetClerkIdOverride: p.userId,
              actorClerkId: userId,
              actorDisplayName: "Debate Creator",
              type: "debate_outcome",
              title: "Debate ended in a draw 🤝",
              body: `The "${debate.title.substring(0, 60)}${debate.title.length > 60 ? "…" : ""}" debate ended with no clear winner.`,
            }, req.log);
          } catch { /* non-blocking */ }
        }
      }
    } catch (err) {
      req.log.error({ err, debateId: id }, "Failed to send loser/draw notifications");
    }

    res.json({
      id: outcome.id,
      debateId: outcome.debateId,
      winningSide: outcome.winningSide,
      justification: outcome.justification,
      topSupportCommentId: outcome.topSupportCommentId ?? null,
      topOppositionCommentId: outcome.topOppositionCommentId ?? null,
      publishedAt: outcome.publishedAt.toISOString(),
      decidedBy: outcome.decidedBy,
      overrideReason: outcome.overrideReason ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to declare winner");
    res.status(500).json({ error: "Failed to declare winner" });
  }
});

router.post("/debates/:id/report-creator", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const userId = req.betterAuthSession?.user?.id ?? null;
    if (!userId) { res.status(401).json({ error: "Sign in required" }); return; }

    const { reason } = req.body as { reason?: string };
    if (!reason?.trim()) { res.status(400).json({ error: "reason is required" }); return; }

    const [debate] = await db.select().from(debatesTable).where(eq(debatesTable.id, id)).limit(1);
    if (!debate) { res.status(404).json({ error: "Debate not found" }); return; }
    if (!debate.creatorUserId) { res.status(404).json({ error: "This debate has no creator to report" }); return; }

    await db.insert(debateCreatorReportsTable).values({
      debateId: id,
      creatorUserId: debate.creatorUserId,
      reporterUserId: userId,
      reason: reason.trim(),
    });

    res.status(201).json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to report debate creator");
    res.status(500).json({ error: "Failed to report debate creator" });
  }
});

router.get("/debates/:id/my-vote", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const userId = req.betterAuthSession?.user?.id ?? null;
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
  const actorClerkId = req.betterAuthSession?.user?.id ?? null;
  if (!actorClerkId) {
    req.log.warn({
      hasCookie: !!(req.headers.cookie),
      authorization: req.headers.authorization ? "present" : "absent",
    }, "Vote 401 — no Better Auth session found");
    res.status(401).json({ error: "Sign in to vote" }); return;
  }
  await jitProvisionUser(req.betterAuthSession?.user ?? null);
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid debate id" }); return; }
    const { vote, annotation } = req.body as { vote: unknown; annotation?: string };
    if (!isDebateSide(vote)) { res.status(400).json({ error: "vote must be support or against" }); return; }

    const [debate] = await db
      .select()
      .from(debatesTable)
      .where(eq(debatesTable.id, id))
      .limit(1);

    if (!debate) {
      res.status(404).json({ error: "Debate not found" }); return;
    }

    if (!debateAcceptsParticipation(debate)) { res.status(409).json({ error: "This debate is no longer accepting votes" }); return; }

    if (isBlockedModeratorParticipant(debate, actorClerkId)) {
      res.status(403).json({ error: "As the moderator of this debate, you can't vote in it — that's the trade-off for holding moderation powers here." }); return;
    }

    const annotationText = (annotation ?? "").trim() || null;
    const { updated, isNewParticipant } = await db.transaction(async (tx) => {
      // Serialize aggregate updates per debate without locking unrelated debates.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${id})`);
      const [existingVote] = await tx
        .select({ side: debateParticipantVotesTable.side })
        .from(debateParticipantVotesTable)
        .where(and(
          eq(debateParticipantVotesTable.debateId, id),
          eq(debateParticipantVotesTable.userId, actorClerkId),
        ))
        .limit(1);
      const isNewParticipant = !existingVote;
      await tx
        .insert(debateParticipantVotesTable)
        .values({ debateId: id, userId: actorClerkId, side: vote, annotation: annotationText })
        .onConflictDoUpdate({
          target: [debateParticipantVotesTable.debateId, debateParticipantVotesTable.userId],
          set: { side: vote, annotation: annotationText },
        });
      const allVotes = await tx
        .select({ side: debateParticipantVotesTable.side })
        .from(debateParticipantVotesTable)
        .where(eq(debateParticipantVotesTable.debateId, id));
      const supportCount = allVotes.filter((entry) => entry.side === "support").length;
      const participantCount = allVotes.length;
      const support = participantCount === 0 ? 50 : Math.round((supportCount / participantCount) * 100);
      const [updated] = await tx
        .update(debatesTable)
        .set({ supportPercent: support, againstPercent: 100 - support, participantCount })
        .where(eq(debatesTable.id, id))
        .returning();
      if (isNewParticipant) {
        const today = new Date().toISOString().slice(0, 10);
        await tx
          .insert(debateDailyVotesTable)
          .values({ debateId: id, date: today, voteCount: 1 })
          .onConflictDoUpdate({
            target: [debateDailyVotesTable.debateId, debateDailyVotesTable.date],
            set: { voteCount: sql`${debateDailyVotesTable.voteCount} + 1` },
          });
      }
      return { updated, isNewParticipant };
    });

    if (isNewParticipant) {
      try {
        await awardRep(actorClerkId, "debate_joined", "Voted in a debate", id);
      } catch (err) {
        req.log.error({ err }, "Failed to award debate_joined rep");
      }
      try {
        await db
          .update(usersTable)
          .set({ debatesJoined: sql`${usersTable.debatesJoined} + 1` })
          .where(eq(usersTable.betterAuthId, actorClerkId));
      } catch (err) {
        req.log.error({ err }, "Failed to increment debatesJoined");
      }
    }

    if (isNewParticipant && debate.creatorUserId && debate.creatorUserId !== actorClerkId) {
      try {
        const [actorUser] = await db
          .select({ name: usersTable.name })
          .from(usersTable)
          .where(eq(usersTable.betterAuthId, actorClerkId))
          .limit(1);
        const actorDisplayName = actorUser?.name ?? "Someone";
        await createNotification({
          targetDbUserId: 0,
          targetClerkIdOverride: debate.creatorUserId,
          actorClerkId,
          actorDisplayName,
          type: "debate",
          title: "Someone joined your debate",
          body: `A new participant joined "${debate.title}"`,
          batchKey: `debate_joined:${id}`,
          batchBody: "{count} people joined your debate",
        }, req.log);
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
  const clerkId = req.betterAuthSession?.user?.id ?? null;
  if (!clerkId) { res.status(401).json({ error: "Sign in required" }); return; }
  try {
    const [debate] = await db
      .select({ creatorUserId: debatesTable.creatorUserId })
      .from(debatesTable)
      .where(eq(debatesTable.id, id))
      .limit(1);
    if (!debate) { res.status(404).json({ error: "Debate not found" }); return; }
    if (!debate.creatorUserId || debate.creatorUserId !== clerkId) {
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

    const userId = req.betterAuthSession?.user?.id ?? null;
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

    // Fetch emoji reactions for all comments in this debate
    type ReactionTotals = { fire: number; think: number; bulb: number; myReaction: string | null };
    const reactionsMap = new Map<number, ReactionTotals>();
    if (comments.length > 0) {
      const commentIds = comments.map((c) => c.id);
      const allReactions = await db
        .select()
        .from(commentReactionsTable)
        .where(inArray(commentReactionsTable.commentId, commentIds));
      for (const r of allReactions) {
        const entry = reactionsMap.get(r.commentId) ?? { fire: 0, think: 0, bulb: 0, myReaction: null };
        if (r.reaction === "fire") entry.fire++;
        else if (r.reaction === "think") entry.think++;
        else if (r.reaction === "bulb") entry.bulb++;
        if (userId && r.userId === userId) entry.myReaction = r.reaction;
        reactionsMap.set(r.commentId, entry);
      }
    }

    res.json(comments.map((c) => serializeDebateComment(c, {
      likes: c.likes ?? 0,
      likedByMe: likedCommentIds.has(c.id),
      reactions: reactionsMap.get(c.id) ?? { fire: 0, think: 0, bulb: 0, myReaction: null },
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

    const actorClerkId = req.betterAuthSession?.user?.id ?? null;
    if (!actorClerkId) { res.status(401).json({ error: "Sign in to participate" }); return; }

    const { content, side, sources, argType, parentCommentId } = req.body as {
      content: string;
      side?: string;
      sources?: string;
      argType?: string;
      parentCommentId?: number;
    };

    if (!content?.trim()) {
      res.status(400).json({ error: "content is required" }); return;
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

    if (!debateAcceptsParticipation(debate)) { res.status(409).json({ error: "This debate is no longer accepting arguments" }); return; }

    if (!isReply && !isDebateSide(side)) { res.status(400).json({ error: "side must be support or against" }); return; }

    // Word limit — enforced per debate (set by creator at creation time, replies are exempt)
    if (!isReply && debate.wordLimit && wordCount > debate.wordLimit) {
      res.status(400).json({ error: `This debate has a ${debate.wordLimit}-word limit per argument. Your argument is ${wordCount} words.` }); return;
    }

    const actorClerkIdForModCheck = req.betterAuthSession?.user?.id ?? null;
    if (actorClerkIdForModCheck && isBlockedModeratorParticipant(debate, actorClerkIdForModCheck)) {
      res.status(403).json({ error: "As the moderator of this debate, you can't post arguments in it — that's the trade-off for holding moderation powers here." }); return;
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

    // Resolve identity exclusively from the authenticated session.
    let [dbUser] = await db
      .select({ id: usersTable.id, name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.betterAuthId, actorClerkId))
      .limit(1);
    if (!dbUser) {
      const provisioned = await jitProvisionUser(req.betterAuthSession?.user ?? null);
      if (provisioned) dbUser = { id: provisioned.id, name: provisioned.name };
    }
    if (!dbUser) {
      res.status(503).json({ error: "Could not create user profile. Please try again." }); return;
    }
    const resolvedAuthorId = dbUser.id;
    const resolvedAuthorName = dbUser.name ?? req.betterAuthSession?.user?.name ?? "Member";

    // For replies, look up the parent's side so the reply lives in the same column
    let resolvedSide = side ?? null;
    if (isReply) {
      const [parent] = await db
        .select({ side: commentsTable.side, repliesLocked: commentsTable.repliesLocked })
        .from(commentsTable)
        .where(and(eq(commentsTable.id, parentCommentId!), eq(commentsTable.debateId, debateId)))
        .limit(1);
      if (!parent) {
        res.status(404).json({ error: "Parent comment not found" }); return;
      }
      if (parent.repliesLocked) {
        res.status(423).json({ error: "Replies have been locked on this argument by the moderator." }); return;
      }
      resolvedSide = parent.side ?? null;
    }

    const [comment] = await db
      .insert(commentsTable)
      .values({
        debateId,
        authorId: resolvedAuthorId,
        authorName: resolvedAuthorName,
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
          targetDbUserId: resolvedAuthorId,
          actorClerkId,
          actorDisplayName: resolvedAuthorName,
          type: "reply",
          title: "New comment on your debate",
          body: `${resolvedAuthorName} commented on "${debate.title.substring(0, 50)}${debate.title.length > 50 ? "…" : ""}"`,
          targetClerkIdOverride: debate.creatorUserId,
          batchKey: `reply:debate:${debateId}:${debate.creatorUserId}`,
        }, req.log);
      } catch (err) {
        req.log.error({ err, debateId }, "Failed to insert debate comment notification");
      }
    }

    // Notify the parent argument's author when this is a threaded reply
    if (actorClerkId && parentCommentId) {
      try {
        const [parentArg] = await db
          .select({ authorId: commentsTable.authorId })
          .from(commentsTable)
          .where(eq(commentsTable.id, parentCommentId))
          .limit(1);
        if (parentArg?.authorId) {
          await createNotification({
            targetDbUserId: parentArg.authorId,
            actorClerkId: actorClerkId ?? "",
            type: "reply",
            title: "Someone replied to your argument",
            body: `${resolvedAuthorName} replied to your argument in "${debate.title.substring(0, 50)}${debate.title.length > 50 ? "…" : ""}"`,
            actorDisplayName: resolvedAuthorName,
            batchKey: `reply:arg:${parentCommentId}:${parentArg.authorId}`,
          }, req.log);
        }
      } catch (err) {
        req.log.error({ err }, "Failed to notify parent argument author of reply");
      }
    }

    res.status(201).json(serializeDebateComment(comment, { likes: 0, likedByMe: false, personalAttackWarning }));
  } catch (err) {
    req.log.error({ err }, "Failed to create debate comment");
    res.status(500).json({ error: "Failed to create debate comment" });
  }
});

router.patch("/debates/:id/comments/:commentId/pin", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const commentId = Number(req.params.commentId);
    if (isNaN(id) || isNaN(commentId)) { res.status(400).json({ error: "Invalid id" }); return; }
    const userId = req.betterAuthSession?.user?.id ?? null;
    if (!userId) { res.status(401).json({ error: "Sign in required" }); return; }

    const [debate] = await db.select().from(debatesTable).where(eq(debatesTable.id, id)).limit(1);
    if (!debate) { res.status(404).json({ error: "Debate not found" }); return; }
    if (!isCreatorModerator(debate, userId)) {
      res.status(403).json({ error: "Only this debate's creator-moderator can pin comments" }); return;
    }

    const { isPinned } = req.body as { isPinned: boolean };
    const [comment] = await db
      .update(commentsTable)
      .set({ isPinned: !!isPinned, pinnedAt: isPinned ? new Date() : null })
      .where(and(eq(commentsTable.id, commentId), eq(commentsTable.debateId, id)))
      .returning();
    if (!comment) { res.status(404).json({ error: "Comment not found" }); return; }

    // Notify the argument author when pinned (not on unpin)
    if (isPinned && comment.authorId) {
      try {
        await createNotification({
          targetDbUserId: comment.authorId,
          actorClerkId: userId ?? "",
          type: "argument_pinned",
          title: "Your argument was pinned 📌",
          body: `The debate creator pinned your argument in "${debate.title.substring(0, 60)}${debate.title.length > 60 ? "…" : ""}"`,
        }, req.log);
      } catch { /* non-blocking */ }
    }

    res.json(serializeDebateComment(comment));
  } catch (err) {
    req.log.error({ err }, "Failed to pin comment");
    res.status(500).json({ error: "Failed to pin comment" });
  }
});

router.patch("/debates/:id/comments/:commentId/creator-remove", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const commentId = Number(req.params.commentId);
    if (isNaN(id) || isNaN(commentId)) { res.status(400).json({ error: "Invalid id" }); return; }
    const userId = req.betterAuthSession?.user?.id ?? null;
    if (!userId) { res.status(401).json({ error: "Sign in required" }); return; }

    const [debate] = await db.select().from(debatesTable).where(eq(debatesTable.id, id)).limit(1);
    if (!debate) { res.status(404).json({ error: "Debate not found" }); return; }
    if (!isCreatorModerator(debate, userId)) {
      res.status(403).json({ error: "Only this debate's creator-moderator can remove comments" }); return;
    }

    const { reason } = req.body as { reason?: string };
    if (!reason?.trim()) { res.status(400).json({ error: "reason is required" }); return; }

    const [comment] = await db
      .update(commentsTable)
      .set({ isRemoved: true, removedReason: reason.trim() })
      .where(and(eq(commentsTable.id, commentId), eq(commentsTable.debateId, id)))
      .returning();
    if (!comment) { res.status(404).json({ error: "Comment not found" }); return; }

    await db.insert(modAuditLogTable).values({
      action: "creator_remove_comment",
      targetType: "comment",
      targetId: commentId,
      reason: reason.trim(),
    });

    // Notify the argument author of removal with reason
    if (comment.authorId) {
      try {
        await createNotification({
          targetDbUserId: comment.authorId,
          actorClerkId: userId ?? "",
          type: "argument_removed",
          title: "Your argument was removed",
          body: `A moderator removed your argument: "${reason.trim().substring(0, 120)}"`,
        }, req.log);
      } catch { /* non-blocking */ }
    }

    res.json(serializeDebateComment(comment));
  } catch (err) {
    req.log.error({ err }, "Failed to remove comment");
    res.status(500).json({ error: "Failed to remove comment" });
  }
});

// ── Emoji reactions on arguments ────────────────────────────────────────────
router.post("/debates/:id/comments/:commentId/react", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const commentId = Number(req.params.commentId);
    if (isNaN(id) || isNaN(commentId)) { res.status(400).json({ error: "Invalid id" }); return; }
    const userId = req.betterAuthSession?.user?.id ?? null;
    if (!userId) { res.status(401).json({ error: "Sign in required" }); return; }
    const { reaction } = req.body as { reaction?: string };
    if (!["fire", "think", "bulb"].includes(reaction ?? "")) { res.status(400).json({ error: "Invalid reaction" }); return; }

    // Toggle: same reaction again removes it; different reaction replaces it
    const [existing] = await db
      .select({ reaction: commentReactionsTable.reaction })
      .from(commentReactionsTable)
      .where(and(eq(commentReactionsTable.commentId, commentId), eq(commentReactionsTable.userId, userId)))
      .limit(1);

    if (existing && existing.reaction === reaction) {
      await db.delete(commentReactionsTable)
        .where(and(eq(commentReactionsTable.commentId, commentId), eq(commentReactionsTable.userId, userId)));
    } else {
      await db.insert(commentReactionsTable)
        .values({ commentId, userId, reaction: reaction! })
        .onConflictDoUpdate({
          target: [commentReactionsTable.commentId, commentReactionsTable.userId],
          set: { reaction: reaction! },
        });
    }

    const allReactions = await db
      .select()
      .from(commentReactionsTable)
      .where(eq(commentReactionsTable.commentId, commentId));

    const counts = { fire: 0, think: 0, bulb: 0, myReaction: null as string | null };
    for (const r of allReactions) {
      if (r.reaction === "fire") counts.fire++;
      else if (r.reaction === "think") counts.think++;
      else if (r.reaction === "bulb") counts.bulb++;
      if (r.userId === userId) counts.myReaction = r.reaction;
    }
    res.json(counts);
  } catch (err) {
    req.log.error({ err }, "Failed to react to comment");
    res.status(500).json({ error: "Failed to react" });
  }
});

// ── Creator: feature one argument per side ──────────────────────────────────
router.patch("/debates/:id/comments/:commentId/feature", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const commentId = Number(req.params.commentId);
    if (isNaN(id) || isNaN(commentId)) { res.status(400).json({ error: "Invalid id" }); return; }
    const userId = req.betterAuthSession?.user?.id ?? null;
    if (!userId) { res.status(401).json({ error: "Sign in required" }); return; }

    const [debate] = await db.select().from(debatesTable).where(eq(debatesTable.id, id)).limit(1);
    if (!debate) { res.status(404).json({ error: "Debate not found" }); return; }
    if (!isCreatorModerator(debate, userId)) { res.status(403).json({ error: "Only this debate's creator-moderator can feature arguments" }); return; }

    const [comment] = await db.select().from(commentsTable)
      .where(and(eq(commentsTable.id, commentId), eq(commentsTable.debateId, id))).limit(1);
    if (!comment) { res.status(404).json({ error: "Comment not found" }); return; }

    const { isFeatured } = req.body as { isFeatured: boolean };

    if (isFeatured && comment.side) {
      // Unfeature any existing featured arg on the same side first (max 1 per side)
      await db.update(commentsTable)
        .set({ isFeatured: false })
        .where(and(eq(commentsTable.debateId, id), eq(commentsTable.side, comment.side), eq(commentsTable.isFeatured, true)));
    }

    const [updated] = await db.update(commentsTable)
      .set({ isFeatured: !!isFeatured })
      .where(eq(commentsTable.id, commentId))
      .returning();

    // Notify the argument author when featured (not on un-feature)
    if (isFeatured && comment.authorId) {
      try {
        await createNotification({
          targetDbUserId: comment.authorId,
          actorClerkId: userId ?? "",
          type: "argument_featured",
          title: "Your argument was featured ⭐",
          body: `Your ${comment.side === "support" ? "supporting" : "opposing"} argument was featured in "${debate.title.substring(0, 60)}${debate.title.length > 60 ? "…" : ""}"`,
        }, req.log);
      } catch { /* non-blocking */ }
    }

    res.json(serializeDebateComment(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to feature comment");
    res.status(500).json({ error: "Failed to feature comment" });
  }
});

// ── Creator: lock replies on a specific argument ────────────────────────────
router.patch("/debates/:id/comments/:commentId/lock-replies", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const commentId = Number(req.params.commentId);
    if (isNaN(id) || isNaN(commentId)) { res.status(400).json({ error: "Invalid id" }); return; }
    const userId = req.betterAuthSession?.user?.id ?? null;
    if (!userId) { res.status(401).json({ error: "Sign in required" }); return; }

    const [debate] = await db.select().from(debatesTable).where(eq(debatesTable.id, id)).limit(1);
    if (!debate) { res.status(404).json({ error: "Debate not found" }); return; }
    if (!isCreatorModerator(debate, userId)) { res.status(403).json({ error: "Only this debate's creator-moderator can lock replies" }); return; }

    const { repliesLocked } = req.body as { repliesLocked: boolean };
    const [updated] = await db.update(commentsTable)
      .set({ repliesLocked: !!repliesLocked })
      .where(and(eq(commentsTable.id, commentId), eq(commentsTable.debateId, id)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Comment not found" }); return; }

    res.json(serializeDebateComment(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to lock replies");
    res.status(500).json({ error: "Failed to lock replies" });
  }
});

// ── Axis-specific winner declarations (elegance battles) ────────────────────
router.get("/debates/:id/axis-winners", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const winners = await db
      .select()
      .from(debateAxisWinnersTable)
      .where(eq(debateAxisWinnersTable.debateId, id));
    res.json(winners.map(w => ({ id: w.id, debateId: w.debateId, axis: w.axis, declaration: w.declaration, createdAt: w.createdAt.toISOString() })));
  } catch (err) {
    req.log.error({ err }, "Failed to get axis winners");
    res.status(500).json({ error: "Failed to get axis winners" });
  }
});

router.post("/debates/:id/axis-winners", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const userId = req.betterAuthSession?.user?.id ?? null;
    if (!userId) { res.status(401).json({ error: "Sign in required" }); return; }

    const [debate] = await db.select().from(debatesTable).where(eq(debatesTable.id, id)).limit(1);
    if (!debate) { res.status(404).json({ error: "Debate not found" }); return; }
    if (!isCreatorModerator(debate, userId)) { res.status(403).json({ error: "Only the creator-moderator can declare axis winners" }); return; }

    const { axis, declaration } = req.body as { axis?: string; declaration?: string };
    if (!axis?.trim() || !declaration?.trim()) { res.status(400).json({ error: "axis and declaration are required" }); return; }

    const [winner] = await db.insert(debateAxisWinnersTable)
      .values({ debateId: id, axis: axis.trim(), declaration: declaration.trim() })
      .onConflictDoUpdate({
        target: [debateAxisWinnersTable.debateId, debateAxisWinnersTable.axis],
        set: { declaration: declaration.trim(), createdAt: new Date() },
      })
      .returning();

    res.json({ id: winner.id, debateId: winner.debateId, axis: winner.axis, declaration: winner.declaration, createdAt: winner.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to declare axis winner");
    res.status(500).json({ error: "Failed to declare axis winner" });
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

    const userId = req.betterAuthSession?.user?.id ?? null;
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

    const userId = req.betterAuthSession?.user?.id ?? null;
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
      .where(eq(usersTable.betterAuthId, userId))
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
      .where(eq(usersTable.betterAuthId, userId))
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

    const userId = req.betterAuthSession?.user?.id ?? null;
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

// ── Creator mod log — only the creator-moderator may view ──────────────────
router.get("/debates/:id/mod-log", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const userId = req.betterAuthSession?.user?.id ?? null;
    if (!userId) { res.status(401).json({ error: "Sign in required" }); return; }

    const [debate] = await db.select().from(debatesTable).where(eq(debatesTable.id, id)).limit(1);
    if (!debate) { res.status(404).json({ error: "Debate not found" }); return; }
    if (!isCreatorModerator(debate, userId)) {
      res.status(403).json({ error: "Only this debate's creator-moderator can view the mod log" }); return;
    }

    // Fetch debate-level log entries (freeze/unfreeze)
    const debateLevelEntries = await db
      .select()
      .from(modAuditLogTable)
      .where(
        and(
          eq(modAuditLogTable.targetType, "debate"),
          eq(modAuditLogTable.targetId, id)
        )
      )
      .orderBy(desc(modAuditLogTable.createdAt))
      .limit(50);

    // Fetch comment IDs belonging to this debate to find comment-level log entries
    const debateComments = await db
      .select({ id: commentsTable.id })
      .from(commentsTable)
      .where(eq(commentsTable.debateId, id));

    const commentIds = debateComments.map((c) => c.id);
    const commentLevelEntries = commentIds.length > 0
      ? await db
          .select()
          .from(modAuditLogTable)
          .where(
            and(
              eq(modAuditLogTable.targetType, "comment"),
              inArray(modAuditLogTable.targetId, commentIds)
            )
          )
          .orderBy(desc(modAuditLogTable.createdAt))
          .limit(50)
      : [];

    // Merge and sort by createdAt descending, cap at 50
    const allEntries = [...debateLevelEntries, ...commentLevelEntries]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 50);

    res.json(allEntries.map((e) => ({
      id: e.id,
      action: e.action,
      targetType: e.targetType,
      targetId: e.targetId,
      reason: e.reason ?? null,
      meta: e.meta ?? null,
      createdAt: e.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get mod log");
    res.status(500).json({ error: "Failed to get mod log" });
  }
});

// ── Freeze / unfreeze a debate ─────────────────────────────────────────────
router.patch("/debates/:id/freeze", async (req, res) => {
  const clerkId = req.betterAuthSession?.user?.id ?? null;
  if (!clerkId) { res.status(401).json({ error: "Sign in required" }); return; }
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const { isFrozen, reason } = req.body as { isFrozen: boolean; reason?: string };

    // Only the debate creator or an admin (checked server-side via env) may freeze
    const [debate] = await db
      .select({ creatorUserId: debatesTable.creatorUserId })
      .from(debatesTable)
      .where(eq(debatesTable.id, id))
      .limit(1);
    if (!debate) { res.status(404).json({ error: "Debate not found" }); return; }
    const isAdmin = clerkId === process.env.ADMIN_CLERK_ID;
    if (!isAdmin && debate.creatorUserId !== clerkId) {
      res.status(403).json({ error: "Only the debate creator can freeze it" }); return;
    }

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

    const userId = req.betterAuthSession?.user?.id ?? null;
    if (!userId) { res.status(401).json({ error: "Sign in to like arguments" }); return; }
    await jitProvisionUser(req.betterAuthSession?.user ?? null);

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
          .where(eq(usersTable.betterAuthId, userId))
          .limit(1);
        const actorName = actor?.name ?? "Someone";

        await createNotification({
          targetDbUserId: comment.authorId,
          actorClerkId: userId,
          actorDisplayName: actorName,
          type: "comment_liked",
          title: "Your argument was liked",
          body: `${actorName} liked your argument in a debate`,
          batchKey: `comment_liked:${commentId}`,
          batchBody: "{count} people liked your argument",
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

    const userId = req.betterAuthSession?.user?.id ?? null;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    await jitProvisionUser(req.betterAuthSession?.user ?? null);

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
