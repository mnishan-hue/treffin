import { Router } from "express";
import { db } from "@workspace/db";
import {
  dailyQuestionsTable,
  weeklyChallengesTable,
  dailyQuestionVotesTable,
  weeklyChallengeSubmissionsTable,
  usersTable,
} from "@workspace/db";
import { desc, eq, sql, and, gte, lte } from "drizzle-orm";
import { awardRep } from "./reputation";
import { jitProvisionUser } from "../lib/jit-provision";

const router = Router();

type DailySide = "support" | "against";

async function dailyQuestionPayload(question: typeof dailyQuestionsTable.$inferSelect, viewerId: string | null) {
  const myVoteRows = viewerId
    ? await db
        .select({ side: dailyQuestionVotesTable.side })
        .from(dailyQuestionVotesTable)
        .where(and(
          eq(dailyQuestionVotesTable.questionId, question.id),
          eq(dailyQuestionVotesTable.userId, viewerId),
        ))
        .limit(1)
    : [];
  const myVote = myVoteRows[0]?.side;
  return {
    id: question.id,
    question: question.question,
    supportPercent: question.supportPercent,
    againstPercent: question.againstPercent,
    participantCount: question.participantCount,
    isLive: question.isLive,
    imageUrl: question.imageUrl,
    myVote: myVote === "support" || myVote === "against" ? myVote : null,
  };
}

router.get("/stats/daily-question", async (req, res) => {
  try {
    const [question] = await db
      .select()
      .from(dailyQuestionsTable)
      .where(eq(dailyQuestionsTable.isLive, true))
      .orderBy(desc(dailyQuestionsTable.createdAt))
      .limit(1);

    if (!question) {
      res.json(null);
      return;
    }

    res.json(await dailyQuestionPayload(question, req.betterAuthSession?.user?.id ?? null));
  } catch (err) {
    req.log.error({ err }, "Failed to get daily question");
    res.status(500).json({ error: "Failed to get daily question" });
  }
});

router.post("/stats/daily-question/vote", async (req, res) => {
  const userId = req.betterAuthSession?.user?.id ?? null;
  if (!userId) {
    res.status(401).json({ error: "Sign in to vote" });
    return;
  }
  const provisioned = await jitProvisionUser(req.betterAuthSession?.user ?? null);
  if (!provisioned) {
    res.status(503).json({ error: "Could not create user profile" });
    return;
  }

  const side = (req.body as { side?: unknown })?.side;
  if (side !== "support" && side !== "against") {
    res.status(400).json({ error: "side must be 'support' or 'against'" });
    return;
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [question] = await tx
        .select()
        .from(dailyQuestionsTable)
        .where(eq(dailyQuestionsTable.isLive, true))
        .orderBy(desc(dailyQuestionsTable.createdAt))
        .limit(1);
      if (!question) return { kind: "missing" as const };

      await tx.execute(sql`SELECT pg_advisory_xact_lock(51, ${question.id})`);
      const [inserted] = await tx
        .insert(dailyQuestionVotesTable)
        .values({ questionId: question.id, userId, side })
        .onConflictDoNothing()
        .returning({ side: dailyQuestionVotesTable.side });

      const voteCounts = await tx
        .select({ side: dailyQuestionVotesTable.side, count: sql<number>`count(*)::int` })
        .from(dailyQuestionVotesTable)
        .where(eq(dailyQuestionVotesTable.questionId, question.id))
        .groupBy(dailyQuestionVotesTable.side);
      const supportCount = voteCounts.find((vote) => vote.side === "support")?.count ?? 0;
      const againstCount = voteCounts.find((vote) => vote.side === "against")?.count ?? 0;
      const total = supportCount + againstCount;
      const supportPercent = total === 0 ? 50 : Math.round((supportCount / total) * 100);
      const againstPercent = 100 - supportPercent;
      const [updated] = await tx
        .update(dailyQuestionsTable)
        .set({ supportPercent, againstPercent, participantCount: total })
        .where(eq(dailyQuestionsTable.id, question.id))
        .returning();
      if (!updated) throw new Error("Daily question disappeared during vote update");

      let myVote: DailySide = side;
      if (!inserted) {
        const [existing] = await tx
          .select({ side: dailyQuestionVotesTable.side })
          .from(dailyQuestionVotesTable)
          .where(and(
            eq(dailyQuestionVotesTable.questionId, question.id),
            eq(dailyQuestionVotesTable.userId, userId),
          ))
          .limit(1);
        if (existing?.side === "support" || existing?.side === "against") myVote = existing.side;
      }
      return { kind: "ok" as const, updated, myVote, inserted: Boolean(inserted) };
    });

    if (result.kind === "missing") {
      res.status(404).json({ error: "No active daily question" });
      return;
    }
    if (result.inserted) {
      await awardRep(userId, "daily_question_voted", "Voted on daily question", result.updated.id);
    }
    res.json({
      id: result.updated.id,
      question: result.updated.question,
      supportPercent: result.updated.supportPercent,
      againstPercent: result.updated.againstPercent,
      participantCount: result.updated.participantCount,
      isLive: result.updated.isLive,
      imageUrl: result.updated.imageUrl,
      myVote: result.myVote,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to record vote");
    res.status(500).json({ error: "Failed to record vote" });
  }
});

router.get("/stats/weekly-challenge", async (req, res) => {
  try {
    const now = new Date();
    const [challenge] = await db
      .select()
      .from(weeklyChallengesTable)
      .where(and(
        eq(weeklyChallengesTable.isActive, true),
        lte(weeklyChallengesTable.startDate, now),
        gte(weeklyChallengesTable.endDate, now),
      ))
      .orderBy(desc(weeklyChallengesTable.createdAt))
      .limit(1);

    if (!challenge) {
      res.json(null);
      return;
    }

    const viewerId = req.betterAuthSession?.user?.id ?? null;
    const submissionRows = viewerId
      ? await db
          .select({ id: weeklyChallengeSubmissionsTable.id })
          .from(weeklyChallengeSubmissionsTable)
          .where(and(
            eq(weeklyChallengeSubmissionsTable.challengeId, challenge.id),
            eq(weeklyChallengeSubmissionsTable.userId, viewerId),
          ))
          .limit(1)
      : [];

    res.json({
      id: challenge.id,
      question: challenge.question,
      startDate: challenge.startDate.toISOString(),
      endDate: challenge.endDate.toISOString(),
      isActive: challenge.isActive,
      winnerUserId: challenge.winnerUserId ?? null,
      winnerName: challenge.winnerName ?? null,
      winnerAvatar: challenge.winnerAvatar ?? null,
      winnerResponse: challenge.winnerResponse ?? null,
      hasSubmitted: submissionRows.length > 0,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get weekly challenge");
    res.status(500).json({ error: "Failed to get weekly challenge" });
  }
});

router.post("/stats/weekly-challenge/submit", async (req, res) => {
  const userId = req.betterAuthSession?.user?.id ?? null;
  if (!userId) {
    res.status(401).json({ error: "Sign in to submit" });
    return;
  }
  const provisioned = await jitProvisionUser(req.betterAuthSession?.user ?? null);
  if (!provisioned) {
    res.status(503).json({ error: "Could not create user profile" });
    return;
  }

  const response = typeof req.body?.response === "string" ? req.body.response.trim() : "";
  const wordCount = response ? response.split(/\s+/).length : 0;
  if (!response || response.length > 5_000 || wordCount > 300) {
    res.status(400).json({ error: "Response is required and cannot exceed 300 words or 5000 characters" });
    return;
  }

  try {
    const now = new Date();
    const [challenge] = await db
      .select()
      .from(weeklyChallengesTable)
      .where(and(
        eq(weeklyChallengesTable.isActive, true),
        lte(weeklyChallengesTable.startDate, now),
        gte(weeklyChallengesTable.endDate, now),
      ))
      .orderBy(desc(weeklyChallengesTable.createdAt))
      .limit(1);

    if (!challenge) {
      res.status(409).json({ error: "There is no challenge currently accepting submissions" });
      return;
    }
    if (challenge.winnerUserId) {
      res.status(409).json({ error: "This challenge is closed because a winner has been selected" });
      return;
    }

    const [userRow] = await db
      .select({ name: usersTable.name, avatarUrl: usersTable.avatarUrl })
      .from(usersTable)
      .where(eq(usersTable.betterAuthId, userId))
      .limit(1);

    const [submission] = await db
      .insert(weeklyChallengeSubmissionsTable)
      .values({
        challengeId: challenge.id,
        userId,
        userName: userRow?.name ?? "Anonymous",
        userAvatar: userRow?.avatarUrl ?? null,
        response,
      })
      .onConflictDoNothing()
      .returning();

    if (!submission) {
      res.status(409).json({ error: "Already submitted to this challenge" });
      return;
    }

    res.json({
      id: submission.id,
      challengeId: submission.challengeId,
      userId: submission.userId,
      userName: submission.userName,
      userAvatar: submission.userAvatar ?? null,
      response: submission.response,
      createdAt: submission.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to record submission");
    res.status(500).json({ error: "Failed to record submission" });
  }
});

export default router;