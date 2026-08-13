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

router.get("/stats/daily-question", async (req, res) => {
  try {
    const [question] = await db
      .select()
      .from(dailyQuestionsTable)
      .where(eq(dailyQuestionsTable.isLive, true))
      .orderBy(desc(dailyQuestionsTable.createdAt))
      .limit(1);

    if (!question) {
      res.json(null); return;
    }

    res.json({
      id: question.id,
      question: question.question,
      supportPercent: question.supportPercent,
      againstPercent: question.againstPercent,
      participantCount: question.participantCount,
      isLive: question.isLive,
      imageUrl: question.imageUrl,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get daily question");
    res.status(500).json({ error: "Failed to get daily question" });
  }
});

router.post("/stats/daily-question/vote", async (req, res) => {
  const userId = req.betterAuthSession?.user?.id ?? null;
  if (!userId) { res.status(401).json({ error: "Sign in to vote" }); return; }
  await jitProvisionUser(req.betterAuthSession?.user ?? null);

  const { side } = req.body as { side: "support" | "against" };
  if (side !== "support" && side !== "against") {
    res.status(400).json({ error: "side must be 'support' or 'against'" }); return;
  }

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

    const [existing] = await db
      .select()
      .from(dailyQuestionVotesTable)
      .where(and(
        eq(dailyQuestionVotesTable.questionId, question.id),
        eq(dailyQuestionVotesTable.userId, userId),
      ))
      .limit(1);

    if (existing) {
      res.status(409).json({ error: "Already voted on this question" }); return;
    }

    await db.insert(dailyQuestionVotesTable).values({
      questionId: question.id,
      userId,
      side,
    });

    const voteCounts = await db
      .select({ side: dailyQuestionVotesTable.side, count: sql<number>`count(*)::int` })
      .from(dailyQuestionVotesTable)
      .where(eq(dailyQuestionVotesTable.questionId, question.id))
      .groupBy(dailyQuestionVotesTable.side);

    const supportCount = voteCounts.find((v) => v.side === "support")?.count ?? 0;
    const againstCount = voteCounts.find((v) => v.side === "against")?.count ?? 0;
    const total = supportCount + againstCount;
    const supportPercent = total === 0 ? 50 : Math.round((supportCount / total) * 100);
    const againstPercent = 100 - supportPercent;

    const [updated] = await db
      .update(dailyQuestionsTable)
      .set({
        supportPercent,
        againstPercent,
        participantCount: total,
      })
      .where(eq(dailyQuestionsTable.id, question.id))
      .returning();

    await awardRep(userId, "daily_question_voted", "Voted on daily question", question.id);

    res.json({
      id: updated.id,
      question: updated.question,
      supportPercent: updated.supportPercent,
      againstPercent: updated.againstPercent,
      participantCount: updated.participantCount,
      isLive: updated.isLive,
      imageUrl: updated.imageUrl,
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
      res.json(null); return;
    }

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
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get weekly challenge");
    res.status(500).json({ error: "Failed to get weekly challenge" });
  }
});

router.post("/stats/weekly-challenge/submit", async (req, res) => {
  const userId = req.betterAuthSession?.user?.id ?? null;
  if (!userId) { res.status(401).json({ error: "Sign in to submit" }); return; }
  await jitProvisionUser(req.betterAuthSession?.user ?? null);

  const { response } = req.body as { response: string };
  if (!response?.trim() || response.trim().length > 5000) {
    res.status(400).json({ error: "Response is required and cannot exceed 5000 characters" }); return;
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
      res.status(409).json({ error: "There is no challenge currently accepting submissions" }); return;
    }
    if (challenge.winnerUserId) {
      res.status(409).json({ error: "This challenge is closed because a winner has been selected" }); return;
    }

    const [existing] = await db
      .select()
      .from(weeklyChallengeSubmissionsTable)
      .where(and(
        eq(weeklyChallengeSubmissionsTable.challengeId, challenge.id),
        eq(weeklyChallengeSubmissionsTable.userId, userId),
      ))
      .limit(1);

    if (existing) {
      res.status(409).json({ error: "Already submitted to this challenge" }); return;
    }

    const [userRow] = await db
      .select({ name: usersTable.name, avatarUrl: usersTable.avatarUrl })
      .from(usersTable)
      .where(eq(usersTable.betterAuthId, userId))
      .limit(1);

    const userName = userRow?.name ?? "Anonymous";
    const userAvatar = userRow?.avatarUrl ?? null;

    const [submission] = await db
      .insert(weeklyChallengeSubmissionsTable)
      .values({
        challengeId: challenge.id,
        userId,
        userName,
        userAvatar,
        response: response.trim(),
      })
      .returning();

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
