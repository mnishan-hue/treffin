import { Router } from "express";
import { db } from "@workspace/db";
import { jitProvisionUser } from "../lib/jit-provision";
import { battleAcceptsInteraction, mathBattlePermissions, normalizeMathBattleText, validMathBattleStep } from "../lib/security-policy";
import {
  mathCategoriesTable,
  mathProblemsTable,
  mathSolutionsTable,
  mathReactionsTable,
  mathFlagsTable,
  mathProblemOfWeekTable,
  mathContestsTable,
  mathContestProblemsTable,
  mathContestEntriesTable,
  mathAnnotationsTable,
  mathBookmarksTable,
  mathUserProfilesTable,
  mathNotificationsTable,
  mathDifficultyVotesTable,
  mathShowdownVotesTable,
  debatesTable,
  mathBattleStepArgumentsTable,
  mathBattleStepArgumentVotesTable,
  mathBattleStepVotesTable,
  notificationsTable,
} from "@workspace/db";
import {
  eq,
  desc,
  asc,
  sql,
  and,
  or,
  ilike,
  inArray,
  notInArray,
  notExists,
  isNull,
} from "drizzle-orm";
import {
  ListMathProblemsQueryParams,
  CreateMathProblemBody,
  GetMathProblemParams,
  SubmitMathSolutionParams,
  SubmitMathSolutionBody,
  ToggleMathReactionBody,
  FlagMathContentBody,
  GetMathLeaderboardQueryParams,
  GetMathUserProfileParams,
  UpdateMathUserProfileParams,
  UpdateMathUserProfileBody,
  ListMathContestsQueryParams,
  GetMathContestParams,
  EnterMathContestParams,
  GetMathAnnotationsQueryParams,
  AddMathAnnotationBody,
  GetRelatedMathProblemsQueryParams,
  AddMathBookmarkBody,
  RemoveMathBookmarkParams,
  UpdateMathSolutionParams,
  UpdateMathSolutionBody,
  DeleteMathSolutionParams,
} from "@workspace/api-zod";

const router = Router();

// ──────────────────────────────────────────────────────────────
// GET /math/categories
// ──────────────────────────────────────────────────────────────
router.get("/math/categories", async (req, res) => {
  try {
    const categories = await db
      .select()
      .from(mathCategoriesTable)
      .where(eq(mathCategoriesTable.isActive, true))
      .orderBy(asc(mathCategoriesTable.sortOrder));

    // Attach problem counts
    const counts = await db
      .select({
        categoryId: mathProblemsTable.categoryId,
        count: sql<number>`count(*)::int`,
      })
      .from(mathProblemsTable)
      .groupBy(mathProblemsTable.categoryId);

    const countMap: Record<number, number> = {};
    for (const c of counts) countMap[c.categoryId] = c.count;

    const result = categories.map((cat) => ({
      ...cat,
      problemCount: countMap[cat.id] ?? 0,
    }));

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "listMathCategories failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ──────────────────────────────────────────────────────────────
// GET /math/stats
// ──────────────────────────────────────────────────────────────
router.get("/math/stats", async (req, res) => {
  try {
    const [problemsRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(mathProblemsTable);
    const [solutionsRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(mathSolutionsTable);
    const [catRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(mathCategoriesTable)
      .where(eq(mathCategoriesTable.isActive, true));

    // Top category by problem count
    const topCatRows = await db
      .select({
        name: mathCategoriesTable.name,
        count: sql<number>`count(*)::int`,
      })
      .from(mathProblemsTable)
      .innerJoin(
        mathCategoriesTable,
        eq(mathProblemsTable.categoryId, mathCategoriesTable.id),
      )
      .groupBy(mathCategoriesTable.name)
      .orderBy(desc(sql`count(*)`))
      .limit(1);

    res.json({
      totalProblems: problemsRow?.count ?? 0,
      totalSolutions: solutionsRow?.count ?? 0,
      activeCategories: catRow?.count ?? 0,
      topCategory: topCatRows[0]?.name ?? null,
      potw: null,
    });
  } catch (err) {
    req.log.error({ err }, "getMathStats failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ──────────────────────────────────────────────────────────────
// Helper: build reaction counts and myReactions for a set of targets
// ──────────────────────────────────────────────────────────────
async function getReactions(
  targetType: string,
  targetIds: number[],
  requestingUserId?: string,
): Promise<{
  counts: Record<number, Record<string, number>>;
  mine: Record<number, string[]>;
}> {
  if (targetIds.length === 0) return { counts: {}, mine: {} };

  const reactions = await db
    .select()
    .from(mathReactionsTable)
    .where(
      and(
        eq(mathReactionsTable.targetType, targetType),
        inArray(mathReactionsTable.targetId, targetIds),
      ),
    );

  const counts: Record<number, Record<string, number>> = {};
  const mine: Record<number, string[]> = {};

  for (const r of reactions) {
    if (!counts[r.targetId]) counts[r.targetId] = {};
    counts[r.targetId][r.reactionType] =
      (counts[r.targetId][r.reactionType] ?? 0) + 1;

    if (requestingUserId && r.userId === requestingUserId) {
      if (!mine[r.targetId]) mine[r.targetId] = [];
      mine[r.targetId].push(r.reactionType);
    }
  }

  return { counts, mine };
}

// ──────────────────────────────────────────────────────────────
// Helper: build problem response shape
// ──────────────────────────────────────────────────────────────
function parseHints(hintsText: string | null): string[] {
  if (!hintsText) return [];
  try {
    const parsed = JSON.parse(hintsText);
    if (Array.isArray(parsed)) return parsed.filter((h): h is string => typeof h === "string");
    return [hintsText];
  } catch {
    return [hintsText];
  }
}

async function getDifficultyStats(problemId: number, userId?: string) {
  const votes = await db
    .select()
    .from(mathDifficultyVotesTable)
    .where(eq(mathDifficultyVotesTable.problemId, problemId));

  const distribution: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  for (const v of votes) {
    const key = String(v.rating);
    distribution[key] = (distribution[key] ?? 0) + 1;
  }
  const voteCount = votes.length;
  const average = voteCount > 0 ? votes.reduce((s, v) => s + v.rating, 0) / voteCount : null;
  const myVote = userId ? (votes.find((v) => v.userId === userId)?.rating ?? null) : null;
  return { average, voteCount, distribution, myVote };
}

async function buildProblemResponse(
  problem: typeof mathProblemsTable.$inferSelect,
  category: typeof mathCategoriesTable.$inferSelect | undefined,
  reactionCounts: Record<string, number>,
  myReactions: string[],
  difficultyStats?: { average: number | null; voteCount: number; distribution: Record<string, number>; myVote: number | null },
) {
  return {
    id: problem.id,
    userId: problem.userId,
    userName: problem.userName,
    userAvatar: problem.userAvatar ?? null,
    title: problem.title,
    body: problem.body,
    categoryId: problem.categoryId,
    categoryName: category?.name ?? "",
    categoryColor: category?.color ?? "#6366f1",
    categoryIcon: category?.icon ?? "∑",
    difficulty: problem.difficulty,
    hints: parseHints(problem.hints),
    communityDifficulty: difficultyStats?.average ?? null,
    difficultyVoteCount: difficultyStats?.voteCount ?? 0,
    difficultyDistribution: difficultyStats?.distribution ?? {},
    myDifficultyVote: difficultyStats?.myVote ?? null,
    isProblemOfWeek: problem.isProblemOfWeek,
    isFeatured: problem.isFeatured,
    isUnsolved: problem.isUnsolved,
    status: problem.status,
    viewCount: problem.viewCount,
    solutionCount: problem.solutionCount,
    reactionCounts,
    myReactions,
    createdAt: problem.createdAt.toISOString(),
  };
}

// ──────────────────────────────────────────────────────────────
// GET /math/problems
// ──────────────────────────────────────────────────────────────
router.get("/math/problems", async (req, res) => {
  try {
    const parsed = ListMathProblemsQueryParams.safeParse({
      categoryId: req.query["categoryId"]
        ? Number(req.query["categoryId"])
        : undefined,
      difficulty: req.query["difficulty"],
      status: req.query["status"],
      search: req.query["search"],
      sort: req.query["sort"],
      page: req.query["page"] ? Number(req.query["page"]) : undefined,
      limit: req.query["limit"] ? Number(req.query["limit"]) : undefined,
      unsolved: req.query["unsolved"] === "true" ? true : req.query["unsolved"] === "false" ? false : undefined,
      solvedBy: req.query["solvedBy"] as string | undefined,
    });

    const userId = req.betterAuthSession?.user?.id ?? undefined;

    // Update streak for authenticated hub visitors (fire-and-forget to avoid adding latency)
    if (userId && userId !== "anonymous") {
      const userName = req.betterAuthSession?.user?.name ?? "Anonymous";
      upsertMathUserProfile(userId, userName).catch(() => {/* non-critical */});
    }

    const {
      categoryId,
      difficulty,
      status,
      search,
      sort = "recent",
      page = 1,
      limit = 20,
      unsolved,
      solvedBy,
    } = parsed.success ? parsed.data : {};

    const pageNum = page ?? 1;
    const limitNum = Math.min(limit ?? 20, 50);
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    if (categoryId) conditions.push(eq(mathProblemsTable.categoryId, categoryId));
    if (difficulty) conditions.push(eq(mathProblemsTable.difficulty, difficulty));
    if (status) conditions.push(eq(mathProblemsTable.status, status as string));
    if (search) conditions.push(ilike(mathProblemsTable.title, `%${search}%`));
    if (unsolved === true) {
      if (userId) {
        // User-specific: problems the current user hasn't solved yet
        conditions.push(
          notExists(
            db
              .select({ one: sql`1` })
              .from(mathSolutionsTable)
              .where(
                and(
                  eq(mathSolutionsTable.problemId, mathProblemsTable.id),
                  eq(mathSolutionsTable.userId, userId),
                ),
              ),
          ),
        );
      } else {
        // Anonymous: fall back to globally unsolved
        conditions.push(eq(mathProblemsTable.solutionCount, 0));
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const orderBy =
      sort === "popular"
        ? desc(mathProblemsTable.solutionCount)
        : sort === "views"
          ? desc(mathProblemsTable.viewCount)
          : desc(mathProblemsTable.createdAt);

    // "My Solutions" filter: get problem IDs where the specified user has a solution
    let solvedProblemIds: number[] | null = null;
    if (solvedBy) {
      const solvedRows = await db
        .select({ problemId: mathSolutionsTable.problemId })
        .from(mathSolutionsTable)
        .where(eq(mathSolutionsTable.userId, solvedBy));
      solvedProblemIds = solvedRows.map((r) => r.problemId);
    }

    let problems: typeof mathProblemsTable.$inferSelect[];
    if (solvedProblemIds !== null) {
      if (solvedProblemIds.length === 0) {
        res.json([]);
        return;
      }
      problems = await db
        .select()
        .from(mathProblemsTable)
        .where(and(whereClause, inArray(mathProblemsTable.id, solvedProblemIds)))
        .orderBy(orderBy)
        .limit(limitNum)
        .offset(offset);
    } else {
      problems = await db
        .select()
        .from(mathProblemsTable)
        .where(whereClause)
        .orderBy(orderBy)
        .limit(limitNum)
        .offset(offset);
    }

    if (problems.length === 0) {
      res.json([]);
      return;
    }

    const categories = await db
      .select()
      .from(mathCategoriesTable)
      .where(
        inArray(
          mathCategoriesTable.id,
          [...new Set(problems.map((p) => p.categoryId))],
        ),
      );
    const catMap: Record<number, typeof mathCategoriesTable.$inferSelect> = {};
    for (const c of categories) catMap[c.id] = c;

    const problemIds = problems.map((p) => p.id);
    const { counts: reactionCounts, mine: myReactions } = await getReactions(
      "problem",
      problemIds,
      userId,
    );

    const result = await Promise.all(
      problems.map((p) =>
        buildProblemResponse(
          p,
          catMap[p.categoryId],
          reactionCounts[p.id] ?? {},
          myReactions[p.id] ?? [],
        ),
      ),
    );

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "listMathProblems failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ──────────────────────────────────────────────────────────────
// POST /math/problems
// ──────────────────────────────────────────────────────────────
router.post("/math/problems", async (req, res) => {
  try {
    const parsed = CreateMathProblemBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const clerkUserId = req.betterAuthSession?.user?.id ?? null;
    if (!clerkUserId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const userId = clerkUserId;
    const userName = req.betterAuthSession?.user?.name ?? "Anonymous";

    const { title, body, categoryId, difficulty, hints } = parsed.data;

    // Verify category exists
    const [cat] = await db
      .select()
      .from(mathCategoriesTable)
      .where(eq(mathCategoriesTable.id, categoryId));
    if (!cat) {
      res.status(400).json({ error: "Invalid category" });
      return;
    }

    const [problem] = await db
      .insert(mathProblemsTable)
      .values({
        userId,
        userName,
        title,
        body,
        categoryId,
        difficulty,
        hints: hints ?? null,
      })
      .returning();

    if (!problem) {
      res.status(500).json({ error: "Failed to create problem" });
      return;
    }

    const response = await buildProblemResponse(problem, cat, {}, []);
    res.status(201).json(response);
  } catch (err) {
    req.log.error({ err }, "createMathProblem failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ──────────────────────────────────────────────────────────────
// Helper: build solution response shape
// ──────────────────────────────────────────────────────────────
function buildSolutionResponse(
  sol: typeof mathSolutionsTable.$inferSelect,
  reactionCounts: Record<string, number>,
  myReactions: string[],
) {
  return {
    id: sol.id,
    problemId: sol.problemId,
    userId: sol.userId,
    userName: sol.userName,
    userAvatar: sol.userAvatar ?? null,
    body: sol.body,
    approach: sol.approach,
    isAccepted: sol.isAccepted,
    isFeatured: sol.isFeatured,
    qualityScore: sol.qualityScore,
    eleganceVotes: sol.eleganceVotes,
    rigorVotes: sol.rigorVotes,
    clarityVotes: sol.clarityVotes,
    reactionCounts,
    myReactions,
    createdAt: sol.createdAt.toISOString(),
  };
}

// ──────────────────────────────────────────────────────────────
// GET /math/problems/:id
// ──────────────────────────────────────────────────────────────
router.get("/math/problems/:id", async (req, res) => {
  try {
    const parsed = GetMathProblemParams.safeParse({ id: Number(req.params["id"]) });
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const clerkUserId = req.betterAuthSession?.user?.id ?? null;
    const userId = clerkUserId ?? undefined;

    const { id } = parsed.data;

    const [problem] = await db
      .select()
      .from(mathProblemsTable)
      .where(eq(mathProblemsTable.id, id));

    if (!problem) {
      res.status(404).json({ error: "Problem not found" });
      return;
    }

    // Only mutate view count and user activity for authenticated requests
    if (clerkUserId) {
      // Increment view count
      await db
        .update(mathProblemsTable)
        .set({ viewCount: sql`${mathProblemsTable.viewCount} + 1` })
        .where(eq(mathProblemsTable.id, id));

      // Update streak for authenticated user who views a problem
      const userName = req.betterAuthSession?.user?.name ?? "Anonymous";
      await upsertMathUserProfile(clerkUserId, userName);
    }

    const [cat] = await db
      .select()
      .from(mathCategoriesTable)
      .where(eq(mathCategoriesTable.id, problem.categoryId));

    const solutions = await db
      .select()
      .from(mathSolutionsTable)
      .where(eq(mathSolutionsTable.problemId, id))
      .orderBy(desc(mathSolutionsTable.qualityScore), asc(mathSolutionsTable.createdAt));

    const { counts: problemReactions, mine: myProblemReactions } =
      await getReactions("problem", [id], userId);

    const solutionIds = solutions.map((s) => s.id);
    const { counts: solutionReactions, mine: mySolutionReactions } =
      await getReactions("solution", solutionIds, userId);

    const solutionResponses = solutions.map((s) =>
      buildSolutionResponse(
        s,
        solutionReactions[s.id] ?? {},
        mySolutionReactions[s.id] ?? [],
      ),
    );

    const diffStats = await getDifficultyStats(id, userId);

    const response = {
      ...(await buildProblemResponse(
        { ...problem, viewCount: clerkUserId ? problem.viewCount + 1 : problem.viewCount },
        cat,
        problemReactions[id] ?? {},
        myProblemReactions[id] ?? [],
        diffStats,
      )),
      solutions: solutionResponses,
    };

    res.json(response);
  } catch (err) {
    req.log.error({ err }, "getMathProblem failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ──────────────────────────────────────────────────────────────
// GET /math/problems/:id/difficulty-stats
// ──────────────────────────────────────────────────────────────
router.get("/math/problems/:id/difficulty-stats", async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const userId = req.betterAuthSession?.user?.id ?? undefined;
    const stats = await getDifficultyStats(id, userId);
    res.json(stats);
  } catch (err) {
    req.log.error({ err }, "getMathDifficultyStats failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ──────────────────────────────────────────────────────────────
// POST /math/problems/:id/rate-difficulty
// ──────────────────────────────────────────────────────────────
router.post("/math/problems/:id/rate-difficulty", async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const userId = req.betterAuthSession?.user?.id ?? null;
    if (!userId) { res.status(401).json({ error: "Sign in required" }); return; }
    await jitProvisionUser(req.betterAuthSession?.user ?? null);

    const rating = Number(req.body?.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      res.status(400).json({ error: "Rating must be an integer between 1 and 5" });
      return;
    }

    await db
      .insert(mathDifficultyVotesTable)
      .values({ problemId: id, userId, rating })
      .onConflictDoUpdate({
        target: [mathDifficultyVotesTable.problemId, mathDifficultyVotesTable.userId],
        set: { rating },
      });

    const stats = await getDifficultyStats(id, userId);
    res.json(stats);
  } catch (err) {
    req.log.error({ err }, "rateMathDifficulty failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ──────────────────────────────────────────────────────────────
// GET /math/problems/:id/elegance-battle
// Returns the existing elegance battle for this problem, or null if none exists.
// ──────────────────────────────────────────────────────────────
router.get("/math/problems/:id/elegance-battle", async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid id" }); return; }

    const [existing] = await db
      .select({ id: debatesTable.id, isLive: debatesTable.isLive, winnerStatus: debatesTable.winnerStatus, endedAt: debatesTable.endedAt })
      .from(debatesTable)
      .where(and(eq(debatesTable.mathProblemId, id), eq(debatesTable.category, "Mathematics")))
      .orderBy(desc(debatesTable.createdAt))
      .limit(1);

    if (!existing) { res.json(null); return; }
    const isEnded = !battleAcceptsInteraction(existing);
    res.json({ debateId: existing.id, isLive: existing.isLive && !isEnded, isEnded });
  } catch (err) {
    req.log.error({ err }, "getEleganceBattle failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /math/problems/:id/elegance-debate
// Creates a new elegance battle, or returns the existing one if already started.
// ──────────────────────────────────────────────────────────────
router.post("/math/problems/:id/elegance-debate", async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid id" }); return; }

    const userId = req.betterAuthSession?.user?.id ?? null;
    if (!userId) { res.status(401).json({ error: "Sign in required to start a debate" }); return; }
    const provisioned = await jitProvisionUser(req.betterAuthSession?.user ?? null);
    if (!provisioned) { res.status(503).json({ error: "Could not create user profile" }); return; }

    const { creatorIsModerator, winnerAuthority } = (req.body ?? {}) as {
      creatorIsModerator?: boolean; winnerAuthority?: "creator" | "admin";
    };
    const moderator = creatorIsModerator === true;
    const authority = moderator && winnerAuthority === "creator" ? "creator" : "admin";

    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(41, ${id})`);
      const [existing] = await tx
        .select({ id: debatesTable.id })
        .from(debatesTable)
        .where(and(eq(debatesTable.mathProblemId, id), eq(debatesTable.category, "Mathematics")))
        .orderBy(desc(debatesTable.createdAt))
        .limit(1);
      if (existing) return { kind: "existing" as const, debateId: existing.id };

      const [problem] = await tx.select().from(mathProblemsTable).where(eq(mathProblemsTable.id, id));
      if (!problem) return { kind: "missing" as const };

      const solutions = await tx
        .select()
        .from(mathSolutionsTable)
        .where(eq(mathSolutionsTable.problemId, id))
        .orderBy(desc(mathSolutionsTable.qualityScore), asc(mathSolutionsTable.createdAt))
        .limit(6);
      if (solutions.length < 2) return { kind: "insufficient" as const };

      const sol1 = solutions[0]!;
      const sol2 = solutions[1]!;
      const shortTitle = problem.title.length > 60 ? `${problem.title.slice(0, 60)}…` : problem.title;
      const description = [
        "Which solution approach is more mathematically elegant?",
        "",
        `**Approach A — ${sol1.approach}** (by ${sol1.userName}):`,
        sol1.body.length > 350 ? `${sol1.body.slice(0, 350)}…` : sol1.body,
        "",
        `**Approach B — ${sol2.approach}** (by ${sol2.userName}):`,
        sol2.body.length > 350 ? `${sol2.body.slice(0, 350)}…` : sol2.body,
      ].join("\n");

      const [debate] = await tx.insert(debatesTable).values({
        title: `Elegance Battle: ${shortTitle}`,
        description,
        category: "Mathematics",
        creatorUserId: userId,
        isLive: true,
        mathProblemId: id,
        creatorIsModerator: moderator,
        winnerAuthority: authority,
      }).returning();
      if (!debate) throw new Error("Failed to create elegance battle");
      return { kind: "created" as const, debateId: debate.id, shortTitle, solutions };
    });

    if (result.kind === "existing") { res.status(200).json({ debateId: result.debateId, existed: true }); return; }
    if (result.kind === "missing") { res.status(404).json({ error: "Problem not found" }); return; }
    if (result.kind === "insufficient") {
      res.status(400).json({ error: "At least 2 solutions are needed to start an elegance debate" }); return;
    }

    try {
      const uniqueAuthors = new Set(
        result.solutions.map((solution) => solution.userId).filter((authorId) => authorId && authorId !== userId),
      );
      for (const authorId of uniqueAuthors) {
        await db.insert(mathNotificationsTable).values({
          userId: authorId,
          type: "elegance_battle_started",
          targetType: "debate",
          targetId: result.debateId,
          title: "Elegance Battle started ⚔",
          body: `An Elegance Battle has started for "${result.shortTitle}" — your solution is in the ring! ⚔`,
        }).onConflictDoNothing();
        try {
          await db.insert(notificationsTable).values({
            userId: authorId,
            type: "math_event",
            title: "Elegance Battle started ⚔",
            body: `An Elegance Battle has started for "${result.shortTitle}" — your solution is in the ring!`,
            actorName: "Math",
            actorInitials: "M",
          });
        } catch { /* non-blocking */ }
      }
    } catch { /* non-blocking */ }

    res.status(201).json({ debateId: result.debateId, existed: false });
  } catch (err) {
    req.log.error({ err }, "startEleganceDebate failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /math/problems/:id/showdown
// POST /math/problems/:id/showdown/vote
// ──────────────────────────────────────────────────────────────

const SHOWDOWN_AXES = ["elegant", "clear", "rigorous", "efficient"] as const;
type ShowdownAxis = (typeof SHOWDOWN_AXES)[number];

function countSteps(body: string): number {
  const matches = body.match(/\*\*Step\s+\d+:\*\*/gi);
  if (matches && matches.length > 0) return matches.length;
  // Fallback: paragraph count as a rough proxy for step count
  return body.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean).length;
}

async function buildShowdownDetail(problemId: number, userId: string | undefined) {
  const solutions = await db
    .select()
    .from(mathSolutionsTable)
    .where(eq(mathSolutionsTable.problemId, problemId))
    .orderBy(desc(mathSolutionsTable.qualityScore), asc(mathSolutionsTable.createdAt));

  const solutionIds = solutions.map((s) => s.id);

  const [battle] = await db
    .select({
      creatorUserId: debatesTable.creatorUserId,
      creatorIsModerator: debatesTable.creatorIsModerator,
      winnerAuthority: debatesTable.winnerAuthority,
    })
    .from(debatesTable)
    .where(and(eq(debatesTable.mathProblemId, problemId), eq(debatesTable.category, "Mathematics")))
    .orderBy(desc(debatesTable.createdAt))
    .limit(1);
  const excludedUserIds = new Set<string>();
  if (battle?.creatorIsModerator && battle.creatorUserId) excludedUserIds.add(battle.creatorUserId);
  const adminUserId = process.env["ADMIN_CLERK_ID"];
  if (battle?.winnerAuthority === "admin" && adminUserId) excludedUserIds.add(adminUserId);
  const excludedVoters = [...excludedUserIds];

  const voteRows = solutionIds.length
    ? await db
        .select({
          solutionId: mathShowdownVotesTable.solutionId,
          axis: mathShowdownVotesTable.axis,
          count: sql<number>`count(*)::int`,
        })
        .from(mathShowdownVotesTable)
        .where(excludedVoters.length > 0
          ? and(
              inArray(mathShowdownVotesTable.solutionId, solutionIds),
              notInArray(mathShowdownVotesTable.userId, excludedVoters),
            )
          : inArray(mathShowdownVotesTable.solutionId, solutionIds))
        .groupBy(mathShowdownVotesTable.solutionId, mathShowdownVotesTable.axis)
    : [];

  const tallyBySolution = new Map<number, Record<ShowdownAxis, number>>();
  for (const s of solutions) {
    tallyBySolution.set(s.id, { elegant: 0, clear: 0, rigorous: 0, efficient: 0 });
  }
  for (const row of voteRows) {
    const tally = tallyBySolution.get(row.solutionId);
    if (tally && SHOWDOWN_AXES.includes(row.axis as ShowdownAxis)) {
      tally[row.axis as ShowdownAxis] = row.count;
    }
  }

  const myVotes: Record<ShowdownAxis, number | null> = { elegant: null, clear: null, rigorous: null, efficient: null };
  if (userId && !excludedUserIds.has(userId)) {
    const mine = await db
      .select({ solutionId: mathShowdownVotesTable.solutionId, axis: mathShowdownVotesTable.axis })
      .from(mathShowdownVotesTable)
      .where(and(eq(mathShowdownVotesTable.problemId, problemId), eq(mathShowdownVotesTable.userId, userId)));
    for (const row of mine) {
      if (SHOWDOWN_AXES.includes(row.axis as ShowdownAxis)) {
        myVotes[row.axis as ShowdownAxis] = row.solutionId;
      }
    }
  }

  const stepCounts = solutions.map((s) => countSteps(s.body));
  const minSteps = stepCounts.length ? Math.min(...stepCounts) : 0;

  return {
    solutions: solutions.map((s, i) => ({
      id: s.id,
      userId: s.userId,
      userName: s.userName,
      userAvatar: s.userAvatar ?? null,
      body: s.body,
      approach: s.approach,
      stepCount: stepCounts[i]!,
      isFastest: stepCounts.length > 1 && stepCounts[i] === minSteps,
      solvingTime: s.solvingTime ?? null,
      votes: tallyBySolution.get(s.id) ?? { elegant: 0, clear: 0, rigorous: 0, efficient: 0 },
    })),
    myVotes,
  };
}

router.get("/math/problems/:id/showdown", async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const [problem] = await db.select().from(mathProblemsTable).where(eq(mathProblemsTable.id, id));
    if (!problem) { res.status(404).json({ error: "Problem not found" }); return; }

    const clerkUserId = req.betterAuthSession?.user?.id ?? null;
    const mathUserId = req.betterAuthSession?.user?.id ?? undefined;
    const userId = clerkUserId ?? mathUserId;

    const detail = await buildShowdownDetail(id, userId);
    res.json({ problemId: id, problemTitle: problem.title, ...detail });
  } catch (err) {
    req.log.error({ err }, "getMathShowdown failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/math/problems/:id/showdown/vote", async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const userId = req.betterAuthSession?.user?.id ?? null;
    if (!userId) { res.status(401).json({ error: "Sign in required to vote" }); return; }
    await jitProvisionUser(req.betterAuthSession?.user ?? null);

    const { axis, solutionId } = req.body ?? {};
    if (!SHOWDOWN_AXES.includes(axis)) { res.status(400).json({ error: "Invalid axis" }); return; }
    if (!Number.isInteger(solutionId) || solutionId <= 0) { res.status(400).json({ error: "Invalid solutionId" }); return; }

    const [problem] = await db.select().from(mathProblemsTable).where(eq(mathProblemsTable.id, id));
    if (!problem) { res.status(404).json({ error: "Problem not found" }); return; }

    const [solution] = await db
      .select()
      .from(mathSolutionsTable)
      .where(and(eq(mathSolutionsTable.id, solutionId), eq(mathSolutionsTable.problemId, id)));
    if (!solution) { res.status(404).json({ error: "Solution not found" }); return; }

    const [battle] = await db.select().from(debatesTable)
      .where(and(eq(debatesTable.mathProblemId, id), eq(debatesTable.category, "Mathematics")))
      .orderBy(desc(debatesTable.createdAt))
      .limit(1);
    if (battle && !battleAcceptsInteraction(battle)) {
      res.status(409).json({ error: "Voting is closed because this elegance battle has ended" }); return;
    }
    if (battle && !mathBattlePermissions(battle, userId, process.env["ADMIN_CLERK_ID"]).canParticipate) {
      res.status(403).json({ error: "Battle moderators cannot vote" }); return;
    }
    // Block self-votes
    if (solution.userId === userId) {
      res.status(403).json({ error: "You cannot vote for your own solution" });
      return;
    }

    await db
      .insert(mathShowdownVotesTable)
      .values({ problemId: id, solutionId, userId, axis })
      .onConflictDoUpdate({
        target: [mathShowdownVotesTable.problemId, mathShowdownVotesTable.userId, mathShowdownVotesTable.axis],
        set: { solutionId, createdAt: new Date() },
      });

    // ── Vote-milestone notification ─────────────────────────────
    // Count total showdown votes for this solution across all axes.
    const VOTE_MILESTONES = [10, 25, 50, 100, 250, 500];
    const [voteCountRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(mathShowdownVotesTable)
      .where(eq(mathShowdownVotesTable.solutionId, solutionId));
    const totalVotes = Number(voteCountRow?.count ?? 0);
    if (VOTE_MILESTONES.includes(totalVotes) && solution.userId && solution.userId !== userId) {
      try {
        await db.insert(mathNotificationsTable).values({
          userId: solution.userId,
          type: "vote_milestone",
          title: `Your solution hit ${totalVotes} votes! 🎉`,
          body: `Your solution for "${problem.title.length > 60 ? problem.title.slice(0, 60) + "…" : problem.title}" has reached ${totalVotes} showdown votes.`,
          targetType: "solution",
          targetId: solutionId,
          fromUserId: userId,
          fromUserName: userId,
        });
        try {
          await db.insert(notificationsTable).values({ userId: solution.userId, type: "math_event", title: `Your solution hit ${totalVotes} votes! 🎉`, body: `Your solution for "${problem.title.length > 60 ? problem.title.slice(0, 60) + "…" : problem.title}" has reached ${totalVotes} showdown votes.`, actorName: "Math", actorInitials: "M" });
        } catch { /* non-blocking */ }
      } catch { /* non-blocking */ }
    }

    const detail = await buildShowdownDetail(id, userId);
    res.json({ problemId: id, problemTitle: problem.title, ...detail });
  } catch (err) {
    req.log.error({ err }, "voteMathShowdown failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ──────────────────────────────────────────────────────────────
// POST /math/problems/:id/solutions
// ──────────────────────────────────────────────────────────────
router.post("/math/problems/:id/solutions", async (req, res) => {
  try {
    const paramsParsed = SubmitMathSolutionParams.safeParse({ id: Number(req.params["id"]) });
    if (!paramsParsed.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const bodyParsed = SubmitMathSolutionBody.safeParse(req.body);
    if (!bodyParsed.success) {
      res.status(400).json({ error: "Invalid input", details: bodyParsed.error.issues });
      return;
    }

    const clerkUserId = req.betterAuthSession?.user?.id ?? null;
    if (!clerkUserId) { res.status(401).json({ error: "Sign in to submit solutions" }); return; }
    const userId = clerkUserId;
    const userName = req.betterAuthSession?.user?.name ?? "Anonymous";

    const { id } = paramsParsed.data;
    const { body, approach } = bodyParsed.data;
    const solvingTime: number | null = (typeof req.body?.solvingTime === "number" && req.body.solvingTime > 0)
      ? Math.round(req.body.solvingTime)
      : null;

    const [problem] = await db
      .select()
      .from(mathProblemsTable)
      .where(eq(mathProblemsTable.id, id));

    if (!problem) {
      res.status(404).json({ error: "Problem not found" });
      return;
    }

    if (problem.status === "locked") {
      res.status(400).json({ error: "Problem is locked" });
      return;
    }

    // Block duplicate submissions — one solution per user per problem
    const [alreadySubmitted] = await db
      .select({ id: mathSolutionsTable.id })
      .from(mathSolutionsTable)
      .where(and(eq(mathSolutionsTable.problemId, id), eq(mathSolutionsTable.userId, userId)));
    if (alreadySubmitted) {
      res.status(409).json({ error: "You have already submitted a solution to this problem. Edit your existing solution instead." });
      return;
    }

    const [solution] = await db
      .insert(mathSolutionsTable)
      .values({
        problemId: id,
        userId,
        userName,
        body,
        approach,
        ...(solvingTime !== null ? { solvingTime } : {}),
      })
      .returning();

    if (!solution) {
      res.status(500).json({ error: "Failed to submit solution" });
      return;
    }

    // Update solution count
    await db
      .update(mathProblemsTable)
      .set({ solutionCount: sql`${mathProblemsTable.solutionCount} + 1` })
      .where(eq(mathProblemsTable.id, id));

    // Update user profile stats + streak
    if (userId !== "anonymous") {
      await upsertMathUserProfile(userId, userName);
      await db
        .update(mathUserProfilesTable)
        .set({
          totalSolutions: sql`${mathUserProfilesTable.totalSolutions} + 1`,
          reputationScore: sql`${mathUserProfilesTable.reputationScore} + 10`,
        })
        .where(eq(mathUserProfilesTable.userId, userId));

      // Award contest points if problem belongs to an active contest
      // Guard: only award points for the user's FIRST solution to this problem in each contest
      const priorSolutionCount = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(mathSolutionsTable)
        .where(
          and(
            eq(mathSolutionsTable.problemId, id),
            eq(mathSolutionsTable.userId, userId),
          ),
        );
      const isFirstSolution = (priorSolutionCount[0]?.count ?? 1) <= 1; // 1 = the one we just inserted

      if (isFirstSolution) {
        const now = new Date();
        const activeContestProblems = await db
          .select({
            contestId: mathContestProblemsTable.contestId,
            points: mathContestProblemsTable.points,
          })
          .from(mathContestProblemsTable)
          .innerJoin(mathContestsTable, eq(mathContestProblemsTable.contestId, mathContestsTable.id))
          .where(
            and(
              eq(mathContestProblemsTable.problemId, id),
              eq(mathContestsTable.isActive, true),
              sql`${mathContestsTable.startTime} <= ${now}`,
              sql`${mathContestsTable.endTime} >= ${now}`,
            ),
          );

        for (const cp of activeContestProblems) {
          // Only award points if the user actually entered this contest
          const [userEntry] = await db
            .select({ id: mathContestEntriesTable.id })
            .from(mathContestEntriesTable)
            .where(
              and(
                eq(mathContestEntriesTable.contestId, cp.contestId),
                eq(mathContestEntriesTable.userId, userId),
              ),
            );
          if (!userEntry) continue;

          // Submission-order aware: count unique solvers who already solved this problem in this contest
          // Points decay: 1st = 100%, 2nd = 85%, 3rd = 70%, 4th+ = 55%
          const [solverCountRow] = await db
            .select({ count: sql<number>`count(distinct ${mathSolutionsTable.userId})::int` })
            .from(mathSolutionsTable)
            .innerJoin(
              mathContestProblemsTable,
              and(
                eq(mathContestProblemsTable.problemId, mathSolutionsTable.problemId),
                eq(mathContestProblemsTable.contestId, cp.contestId),
              ),
            )
            .where(
              and(
                eq(mathSolutionsTable.problemId, id),
                sql`${mathSolutionsTable.userId} != ${userId}`, // exclude the current user (just inserted)
              ),
            );
          const priorSolvers = solverCountRow?.count ?? 0;
          const decayMultiplier =
            priorSolvers === 0 ? 1.0
            : priorSolvers === 1 ? 0.85
            : priorSolvers === 2 ? 0.70
            : 0.55;
          const awardedPoints = Math.round(cp.points * decayMultiplier);

          await db
            .update(mathContestEntriesTable)
            .set({
              score: sql`${mathContestEntriesTable.score} + ${awardedPoints}`,
              solutionsCount: sql`${mathContestEntriesTable.solutionsCount} + 1`,
              lastSubmittedAt: now,
            })
            .where(
              and(
                eq(mathContestEntriesTable.contestId, cp.contestId),
                eq(mathContestEntriesTable.userId, userId),
              ),
            );
        }
      }
    }

    // Notify the problem author that a new solution was submitted (skip self-notification)
    if (userId !== "anonymous" && userId !== problem.userId) {
      try {
        await db.insert(mathNotificationsTable).values({
          userId: problem.userId,
          type: "new_solution",
          title: "Someone solved your problem",
          body: `${userName} submitted a solution to your problem "${problem.title.length > 60 ? problem.title.slice(0, 60) + "…" : problem.title}"`,
          targetType: "problem",
          targetId: problem.id,
          fromUserId: userId,
          fromUserName: userName,
        });
        try {
          await db.insert(notificationsTable).values({ userId: problem.userId, type: "math_event", title: "Someone solved your problem", body: `${userName} submitted a solution to your problem "${problem.title.length > 60 ? problem.title.slice(0, 60) + "…" : problem.title}"`, actorName: userName, actorInitials: userName.substring(0, 2).toUpperCase() });
        } catch { /* non-blocking */ }
      } catch (err) {
        req.log.error({ err }, "Failed to insert new_solution math notification");
      }
    }

    res.status(201).json(buildSolutionResponse(solution, {}, []));
  } catch (err) {
    req.log.error({ err }, "submitMathSolution failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ──────────────────────────────────────────────────────────────
// PATCH /math/solutions/:id  (owner only)
// ──────────────────────────────────────────────────────────────
router.patch("/math/solutions/:id", async (req, res) => {
  try {
    const paramsParsed = UpdateMathSolutionParams.safeParse({ id: Number(req.params["id"]) });
    if (!paramsParsed.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const bodyParsed = UpdateMathSolutionBody.safeParse(req.body);
    if (!bodyParsed.success) {
      res.status(400).json({ error: "Invalid input", details: bodyParsed.error.issues });
      return;
    }

    const clerkUserId = req.betterAuthSession?.user?.id ?? null;
    if (!clerkUserId) { res.status(401).json({ error: "Sign in to edit solutions" }); return; }
    const userId = clerkUserId;

    const { id } = paramsParsed.data;
    const { body, approach } = bodyParsed.data;

    const [existing] = await db
      .select()
      .from(mathSolutionsTable)
      .where(eq(mathSolutionsTable.id, id));

    if (!existing) {
      res.status(404).json({ error: "Solution not found" });
      return;
    }

    if (existing.userId !== userId) {
      res.status(403).json({ error: "You can only edit your own solutions" });
      return;
    }

    const updates: Partial<typeof mathSolutionsTable.$inferInsert> = {};
    if (body !== undefined) updates.body = body;
    if (approach !== undefined) updates.approach = approach;

    const [updated] = await db
      .update(mathSolutionsTable)
      .set(updates)
      .where(eq(mathSolutionsTable.id, id))
      .returning();

    if (!updated) {
      res.status(500).json({ error: "Failed to update solution" });
      return;
    }

    const { counts: reactionCounts, mine: myReactions } = await getReactions(
      "solution",
      [id],
      userId,
    );

    res.json(buildSolutionResponse(updated, reactionCounts[id] ?? {}, myReactions[id] ?? []));
  } catch (err) {
    req.log.error({ err }, "updateMathSolution failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ──────────────────────────────────────────────────────────────
// DELETE /math/solutions/:id  (owner only)
// ──────────────────────────────────────────────────────────────
router.delete("/math/solutions/:id", async (req, res) => {
  try {
    const paramsParsed = DeleteMathSolutionParams.safeParse({ id: Number(req.params["id"]) });
    if (!paramsParsed.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const clerkUserId = req.betterAuthSession?.user?.id ?? null;
    if (!clerkUserId) { res.status(401).json({ error: "Sign in to delete solutions" }); return; }
    const userId = clerkUserId;

    const { id } = paramsParsed.data;

    const [existing] = await db
      .select()
      .from(mathSolutionsTable)
      .where(eq(mathSolutionsTable.id, id));

    if (!existing) {
      res.status(404).json({ error: "Solution not found" });
      return;
    }

    if (existing.userId !== userId) {
      res.status(403).json({ error: "You can only delete your own solutions" });
      return;
    }

    await db.delete(mathSolutionsTable).where(eq(mathSolutionsTable.id, id));

    // Decrement the problem's solution count (floor at 0)
    await db
      .update(mathProblemsTable)
      .set({ solutionCount: sql`GREATEST(${mathProblemsTable.solutionCount} - 1, 0)` })
      .where(eq(mathProblemsTable.id, existing.problemId));

    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "deleteMathSolution failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ──────────────────────────────────────────────────────────────
// PATCH /math/solutions/:id/accept  (problem owner only)
// Marks a solution as the accepted answer; unsets any previous.
// ──────────────────────────────────────────────────────────────
router.patch("/math/solutions/:id/accept", async (req, res) => {
  try {
    const solutionId = Number(req.params["id"]);
    if (isNaN(solutionId)) { res.status(400).json({ error: "Invalid id" }); return; }

    const clerkUserId = req.betterAuthSession?.user?.id ?? null;
    if (!clerkUserId) { res.status(401).json({ error: "Sign in to accept solutions" }); return; }

    // Load the solution so we know which problem it belongs to
    const [solution] = await db
      .select()
      .from(mathSolutionsTable)
      .where(eq(mathSolutionsTable.id, solutionId));
    if (!solution) { res.status(404).json({ error: "Solution not found" }); return; }

    // Only the problem owner can mark a solution as accepted
    const [problem] = await db
      .select()
      .from(mathProblemsTable)
      .where(eq(mathProblemsTable.id, solution.problemId));
    if (!problem) { res.status(404).json({ error: "Problem not found" }); return; }
    if (problem.userId !== clerkUserId) {
      res.status(403).json({ error: "Only the problem author can accept a solution" });
      return;
    }

    // Toggle: if already accepted, unaccept it; otherwise set it as the new accepted answer
    const alreadyAccepted = solution.isAccepted;

    // Clear any previously accepted solution for this problem
    await db
      .update(mathSolutionsTable)
      .set({ isAccepted: false })
      .where(eq(mathSolutionsTable.problemId, solution.problemId));

    if (!alreadyAccepted) {
      // Mark this solution as accepted
      await db
        .update(mathSolutionsTable)
        .set({ isAccepted: true })
        .where(eq(mathSolutionsTable.id, solutionId));

      // Notify the solution author (skip self-notification)
      if (solution.userId && solution.userId !== clerkUserId) {
        try {
          await db.insert(mathNotificationsTable).values({
            userId: solution.userId,
            type: "solution_accepted",
            title: "Your solution was accepted! ✅",
            body: `The problem author marked your solution for "${problem.title.length > 60 ? problem.title.slice(0, 60) + "…" : problem.title}" as the accepted answer.`,
            targetType: "solution",
            targetId: solutionId,
            fromUserId: clerkUserId,
            fromUserName: clerkUserId,
          });
          try {
            await db.insert(notificationsTable).values({ userId: solution.userId, type: "math_event", title: "Your solution was accepted! ✅", body: `The problem author marked your solution for "${problem.title.length > 60 ? problem.title.slice(0, 60) + "…" : problem.title}" as the accepted answer.`, actorName: "Math", actorInitials: "M" });
          } catch { /* non-blocking */ }
        } catch { /* non-blocking */ }
      }
    }

    res.json({ ok: true, isAccepted: !alreadyAccepted });
  } catch (err) {
    req.log.error({ err }, "acceptMathSolution failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ──────────────────────────────────────────────────────────────
// GET /math/problem-of-week
// ──────────────────────────────────────────────────────────────
router.get("/math/problem-of-week", async (req, res) => {
  try {
    const userId = req.betterAuthSession?.user?.id ?? undefined;
    const now = new Date();

    const [potw] = await db
      .select()
      .from(mathProblemOfWeekTable)
      .where(
        and(
          sql`${mathProblemOfWeekTable.weekStart} <= ${now}`,
          sql`${mathProblemOfWeekTable.weekEnd} >= ${now}`,
        ),
      )
      .orderBy(desc(mathProblemOfWeekTable.createdAt))
      .limit(1);

    if (!potw) {
      res.json(null);
      return;
    }

    const [problem] = await db
      .select()
      .from(mathProblemsTable)
      .where(eq(mathProblemsTable.id, potw.problemId));

    if (!problem) {
      res.json(null);
      return;
    }

    const [cat] = await db
      .select()
      .from(mathCategoriesTable)
      .where(eq(mathCategoriesTable.id, problem.categoryId));

    const solutions = await db
      .select()
      .from(mathSolutionsTable)
      .where(eq(mathSolutionsTable.problemId, problem.id))
      .orderBy(desc(mathSolutionsTable.qualityScore), asc(mathSolutionsTable.createdAt));

    const { counts: probReactions, mine: myProbReactions } =
      await getReactions("problem", [problem.id], userId);

    const solutionIds = solutions.map((s) => s.id);
    const { counts: solReactions, mine: mySolReactions } =
      await getReactions("solution", solutionIds, userId);

    const solutionResponses = solutions.map((s) =>
      buildSolutionResponse(s, solReactions[s.id] ?? {}, mySolReactions[s.id] ?? []),
    );

    let featuredSolution = null;
    if (potw.featuredSolutionId) {
      const feat = solutions.find((s) => s.id === potw.featuredSolutionId);
      if (feat) {
        featuredSolution = buildSolutionResponse(
          feat,
          solReactions[feat.id] ?? {},
          mySolReactions[feat.id] ?? [],
        );
      }
    }

    const problemDetail = {
      ...(await buildProblemResponse(
        problem,
        cat,
        probReactions[problem.id] ?? {},
        myProbReactions[problem.id] ?? [],
      )),
      solutions: solutionResponses,
    };

    res.json({
      id: potw.id,
      problemId: potw.problemId,
      weekStart: potw.weekStart.toISOString(),
      weekEnd: potw.weekEnd.toISOString(),
      note: potw.note ?? null,
      featuredSolutionId: potw.featuredSolutionId ?? null,
      featuredSolution,
      problem: problemDetail,
    });
  } catch (err) {
    req.log.error({ err }, "getMathProblemOfWeek failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ──────────────────────────────────────────────────────────────
// POST /math/react
// ──────────────────────────────────────────────────────────────
router.post("/math/react", async (req, res) => {
  try {
    const parsed = ToggleMathReactionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }

    const clerkUserId = req.betterAuthSession?.user?.id ?? null;
    if (!clerkUserId) { res.status(401).json({ error: "Sign in to react" }); return; }
    await jitProvisionUser(req.betterAuthSession?.user ?? null);
    const userId = clerkUserId;
    const { targetType, targetId, reactionType } = parsed.data;

    const existing = await db
      .select()
      .from(mathReactionsTable)
      .where(
        and(
          eq(mathReactionsTable.targetType, targetType),
          eq(mathReactionsTable.targetId, targetId),
          eq(mathReactionsTable.userId, userId),
          eq(mathReactionsTable.reactionType, reactionType),
        ),
      );

    if (existing.length > 0) {
      // Remove reaction
      await db
        .delete(mathReactionsTable)
        .where(eq(mathReactionsTable.id, existing[0]!.id));

      // Update quality score for solutions
      if (targetType === "solution") {
        await updateSolutionQuality(targetId);
      }

      res.json({ added: false });
    } else {
      // Add reaction
      await db.insert(mathReactionsTable).values({
        targetType,
        targetId,
        userId,
        reactionType,
      });

      // Update quality score for solutions
      if (targetType === "solution") {
        await updateSolutionQuality(targetId);
      }

      res.json({ added: true });
    }
  } catch (err) {
    req.log.error({ err }, "toggleMathReaction failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

async function updateSolutionQuality(solutionId: number) {
  const elegance = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(mathReactionsTable)
    .where(
      and(
        eq(mathReactionsTable.targetType, "solution"),
        eq(mathReactionsTable.targetId, solutionId),
        eq(mathReactionsTable.reactionType, "elegant"),
      ),
    );
  const rigor = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(mathReactionsTable)
    .where(
      and(
        eq(mathReactionsTable.targetType, "solution"),
        eq(mathReactionsTable.targetId, solutionId),
        eq(mathReactionsTable.reactionType, "rigorous"),
      ),
    );
  const insightful = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(mathReactionsTable)
    .where(
      and(
        eq(mathReactionsTable.targetType, "solution"),
        eq(mathReactionsTable.targetId, solutionId),
        eq(mathReactionsTable.reactionType, "insightful"),
      ),
    );

  const eleganceCount = elegance[0]?.count ?? 0;
  const rigorCount = rigor[0]?.count ?? 0;
  const insightfulCount = insightful[0]?.count ?? 0;

  await db
    .update(mathSolutionsTable)
    .set({
      eleganceVotes: eleganceCount,
      rigorVotes: rigorCount,
      clarityVotes: insightfulCount,
      qualityScore: eleganceCount + rigorCount + insightfulCount,
    })
    .where(eq(mathSolutionsTable.id, solutionId));
}

// ──────────────────────────────────────────────────────────────
// POST /math/flag
// ──────────────────────────────────────────────────────────────
router.post("/math/flag", async (req, res) => {
  try {
    const parsed = FlagMathContentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }

    const clerkUserId = req.betterAuthSession?.user?.id ?? null;
    if (!clerkUserId) { res.status(401).json({ error: "Sign in to flag content" }); return; }
    await jitProvisionUser(req.betterAuthSession?.user ?? null);
    const userId = clerkUserId;
    const { targetType, targetId, reason } = parsed.data;

    // Idempotency — silently succeed if this user already flagged this content
    const [existingFlag] = await db
      .select({ id: mathFlagsTable.id })
      .from(mathFlagsTable)
      .where(
        and(
          eq(mathFlagsTable.targetType, targetType),
          eq(mathFlagsTable.targetId, targetId),
          eq(mathFlagsTable.userId, userId),
        ),
      );
    if (existingFlag) { res.json({ ok: true }); return; }

    await db.insert(mathFlagsTable).values({
      targetType,
      targetId,
      userId,
      reason,
    });

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "flagMathContent failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ──────────────────────────────────────────────────────────────
// PHASE 3 ROUTES
// ──────────────────────────────────────────────────────────────

// Helper: upsert math user profile with streak tracking
async function upsertMathUserProfile(userId: string, displayName: string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [existing] = await db
    .select({ streak: mathUserProfilesTable.streak, lastActiveAt: mathUserProfilesTable.lastActiveAt })
    .from(mathUserProfilesTable)
    .where(eq(mathUserProfilesTable.userId, userId));

  if (existing) {
    const last = existing.lastActiveAt;
    const lastDate = new Date(last.getFullYear(), last.getMonth(), last.getDate());
    const dayDiff = Math.round((today.getTime() - lastDate.getTime()) / 86400000);
    const newStreak = dayDiff === 0
      ? existing.streak          // same day — no change
      : dayDiff === 1
        ? existing.streak + 1   // consecutive day — increment
        : 1;                    // missed a day — reset

    await db
      .update(mathUserProfilesTable)
      .set({ displayName, lastActiveAt: now, streak: newStreak })
      .where(eq(mathUserProfilesTable.userId, userId));
  } else {
    await db
      .insert(mathUserProfilesTable)
      .values({ userId, displayName, lastActiveAt: now, streak: 1 })
      .onConflictDoUpdate({
        target: mathUserProfilesTable.userId,
        set: { displayName, lastActiveAt: now, streak: 1 },
      });
  }
}

// GET /math/leaderboard
router.get("/math/leaderboard", async (req, res) => {
  try {
    const parsed = GetMathLeaderboardQueryParams.safeParse(req.query);
    const limit = parsed.success ? (parsed.data.limit ?? 20) : 20;

    const users = await db
      .select()
      .from(mathUserProfilesTable)
      .orderBy(desc(mathUserProfilesTable.reputationScore))
      .limit(limit);

    const ranked = users.map((u, i) => ({ ...u, rank: i + 1 }));
    res.json(ranked);
  } catch (err) {
    req.log.error({ err }, "getMathLeaderboard failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /math/users/:userId
router.get("/math/users/:userId", async (req, res) => {
  try {
    const parsed = GetMathUserProfileParams.safeParse(req.params);
    if (!parsed.success) { res.status(400).json({ error: "Invalid userId" }); return; }
    const { userId } = parsed.data;

    const [profile] = await db
      .select()
      .from(mathUserProfilesTable)
      .where(eq(mathUserProfilesTable.userId, userId));

    if (!profile) { res.status(404).json({ error: "User not found" }); return; }

    const recentSolutions = await db
      .select()
      .from(mathSolutionsTable)
      .where(eq(mathSolutionsTable.userId, userId))
      .orderBy(desc(mathSolutionsTable.createdAt))
      .limit(5);

    const recentProblems = await db
      .select()
      .from(mathProblemsTable)
      .where(eq(mathProblemsTable.userId, userId))
      .orderBy(desc(mathProblemsTable.createdAt))
      .limit(5);

    res.json({ ...profile, recentSolutions, recentProblems });
  } catch (err) {
    req.log.error({ err }, "getMathUserProfile failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /math/users/:userId
router.put("/math/users/:userId", async (req, res) => {
  const clerkId = req.betterAuthSession?.user?.id ?? null;
  if (!clerkId) { res.status(401).json({ error: "Sign in required" }); return; }
  try {
    const params = UpdateMathUserProfileParams.safeParse(req.params);
    if (!params.success) { res.status(400).json({ error: "Invalid params" }); return; }
    const body = UpdateMathUserProfileBody.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: "Invalid body" }); return; }

    const { userId } = params.data;
    // Verify the authenticated Clerk user matches the profile being updated
    if (userId !== clerkId) { res.status(403).json({ error: "Forbidden" }); return; }

    const [updated] = await db
      .update(mathUserProfilesTable)
      .set({
        displayName: body.data.displayName,
        bio: body.data.bio ?? null,
        favoriteCategory: body.data.favoriteCategory ?? null,
        lastActiveAt: new Date(),
      })
      .where(eq(mathUserProfilesTable.userId, userId))
      .returning();

    if (!updated) { res.status(404).json({ error: "Profile not found" }); return; }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "updateMathUserProfile failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /math/contests
router.get("/math/contests", async (req, res) => {
  try {
    const parsed = ListMathContestsQueryParams.safeParse(req.query);
    const status = parsed.success ? (parsed.data.status ?? "all") : "all";
    const now = new Date();

    let query = db.select().from(mathContestsTable).$dynamic();

    if (status === "active") {
      query = query.where(and(eq(mathContestsTable.isActive, true)));
    } else if (status === "upcoming") {
      query = query.where(and(eq(mathContestsTable.isActive, true)));
    } else if (status === "past") {
      query = query.where(eq(mathContestsTable.isActive, false));
    }

    const contests = await query.orderBy(desc(mathContestsTable.createdAt));

    const enriched = contests.map((c) => {
      const startTime = new Date(c.startTime);
      const endTime = new Date(c.endTime);
      let contestStatus: "upcoming" | "active" | "past" = "past";
      if (now < startTime) contestStatus = "upcoming";
      else if (now >= startTime && now <= endTime) contestStatus = "active";
      return { ...c, status: contestStatus };
    });

    res.json(enriched);
  } catch (err) {
    req.log.error({ err }, "listMathContests failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /math/contests/:contestId
router.get("/math/contests/:contestId", async (req, res) => {
  try {
    const parsed = GetMathContestParams.safeParse(req.params);
    if (!parsed.success) { res.status(400).json({ error: "Invalid contestId" }); return; }
    const { contestId } = parsed.data;
    const userId = req.betterAuthSession?.user?.id ?? "";
    const now = new Date();

    const [contest] = await db
      .select()
      .from(mathContestsTable)
      .where(eq(mathContestsTable.id, contestId));

    if (!contest) { res.status(404).json({ error: "Contest not found" }); return; }

    const contestProblems = await db
      .select({ problemId: mathContestProblemsTable.problemId, points: mathContestProblemsTable.points })
      .from(mathContestProblemsTable)
      .where(eq(mathContestProblemsTable.contestId, contestId))
      .orderBy(asc(mathContestProblemsTable.sortOrder));

    const problemIds = contestProblems.map((cp) => cp.problemId);
    const problems = problemIds.length > 0
      ? await db.select().from(mathProblemsTable).where(inArray(mathProblemsTable.id, problemIds))
      : [];

    const leaderboard = await db
      .select()
      .from(mathContestEntriesTable)
      .where(eq(mathContestEntriesTable.contestId, contestId))
      .orderBy(desc(mathContestEntriesTable.score))
      .limit(20);

    const [myEntry] = userId
      ? await db
          .select()
          .from(mathContestEntriesTable)
          .where(and(eq(mathContestEntriesTable.contestId, contestId), eq(mathContestEntriesTable.userId, userId)))
      : [undefined];

    const startTime = new Date(contest.startTime);
    const endTime = new Date(contest.endTime);
    let contestStatus: "upcoming" | "active" | "past" = "past";
    if (now < startTime) contestStatus = "upcoming";
    else if (now >= startTime && now <= endTime) contestStatus = "active";

    res.json({
      ...contest,
      status: contestStatus,
      problems,
      leaderboard,
      myEntry: myEntry ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "getMathContest failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /math/contests/:contestId/enter
router.post("/math/contests/:contestId/enter", async (req, res) => {
  try {
    const parsed = EnterMathContestParams.safeParse(req.params);
    if (!parsed.success) { res.status(400).json({ error: "Invalid contestId" }); return; }
    const { contestId } = parsed.data;
    const clerkUserId = req.betterAuthSession?.user?.id ?? null;
    if (!clerkUserId) { res.status(401).json({ error: "Sign in to enter contests" }); return; }
    const userId = clerkUserId;
    const userName = req.betterAuthSession?.user?.name ?? "Anonymous";

    // Verify contest exists and is still active
    const [contest] = await db.select().from(mathContestsTable).where(eq(mathContestsTable.id, contestId));
    if (!contest) { res.status(404).json({ error: "Contest not found" }); return; }
    const now = new Date();
    if (now > new Date(contest.endTime)) { res.status(400).json({ error: "This contest has ended" }); return; }
    if (now < new Date(contest.startTime)) { res.status(400).json({ error: "This contest has not started yet" }); return; }

    // Check if already entered — only increment totalParticipants on first entry
    const [existing] = await db
      .select()
      .from(mathContestEntriesTable)
      .where(and(
        eq(mathContestEntriesTable.contestId, contestId),
        eq(mathContestEntriesTable.userId, userId),
      ));

    if (existing) {
      res.json(existing);
      return;
    }

    const [entry] = await db
      .insert(mathContestEntriesTable)
      .values({ contestId, userId, userName })
      .returning();

    if (!entry) { res.status(500).json({ error: "Failed to enter contest" }); return; }

    // Only increment for new entries
    await db
      .update(mathContestsTable)
      .set({ totalParticipants: sql<number>`${mathContestsTable.totalParticipants} + 1` })
      .where(eq(mathContestsTable.id, contestId));

    res.json(entry);
  } catch (err) {
    req.log.error({ err }, "enterMathContest failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /math/annotations
router.get("/math/annotations", async (req, res) => {
  try {
    const parsed = GetMathAnnotationsQueryParams.safeParse(req.query);
    if (!parsed.success || !parsed.data.problemId) {
      res.status(400).json({ error: "problemId required" }); return;
    }
    const { problemId, solutionId } = parsed.data;

    let conditions = [eq(mathAnnotationsTable.problemId, problemId)];
    if (solutionId) conditions.push(eq(mathAnnotationsTable.solutionId, solutionId));

    const annotations = await db
      .select()
      .from(mathAnnotationsTable)
      .where(and(...conditions))
      .orderBy(desc(mathAnnotationsTable.createdAt));

    res.json(annotations);
  } catch (err) {
    req.log.error({ err }, "getMathAnnotations failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /math/annotations
router.post("/math/annotations", async (req, res) => {
  try {
    const parsed = AddMathAnnotationBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

    const clerkUserId = req.betterAuthSession?.user?.id ?? null;
    if (!clerkUserId) { res.status(401).json({ error: "Sign in to annotate" }); return; }
    const userId = clerkUserId;
    const userName = req.betterAuthSession?.user?.name ?? "Anonymous";

    const { problemId, solutionId, body, selectionStart, selectionEnd } = parsed.data;

    const [annotation] = await db
      .insert(mathAnnotationsTable)
      .values({
        problemId,
        solutionId: solutionId ?? null,
        userId,
        userName,
        body,
        selectionStart: selectionStart ?? null,
        selectionEnd: selectionEnd ?? null,
      })
      .returning();

    res.status(201).json(annotation);
  } catch (err) {
    req.log.error({ err }, "addMathAnnotation failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /math/related-problems
router.get("/math/related-problems", async (req, res) => {
  try {
    const parsed = GetRelatedMathProblemsQueryParams.safeParse(req.query);
    if (!parsed.success || !parsed.data.problemId) {
      res.status(400).json({ error: "problemId required" }); return;
    }
    const { problemId, limit } = parsed.data;

    const [source] = await db
      .select({ categoryId: mathProblemsTable.categoryId, difficulty: mathProblemsTable.difficulty })
      .from(mathProblemsTable)
      .where(eq(mathProblemsTable.id, problemId));

    if (!source) { res.json([]); return; }

    const related = await db
      .select()
      .from(mathProblemsTable)
      .where(
        and(
          eq(mathProblemsTable.categoryId, source.categoryId),
          eq(mathProblemsTable.difficulty, source.difficulty),
          eq(mathProblemsTable.status, "published"),
        ),
      )
      .orderBy(desc(mathProblemsTable.createdAt))
      .limit((limit ?? 5) + 1);

    res.json(related.filter((p) => p.id !== problemId).slice(0, limit ?? 5));
  } catch (err) {
    req.log.error({ err }, "getRelatedMathProblems failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /math/bookmarks
router.get("/math/bookmarks", async (req, res) => {
  try {
    const clerkUserId = req.betterAuthSession?.user?.id ?? null;
    if (!clerkUserId) { res.status(401).json({ error: "Sign in to view bookmarks" }); return; }
    const userId = clerkUserId;

    const bookmarks = await db
      .select()
      .from(mathBookmarksTable)
      .where(eq(mathBookmarksTable.userId, userId))
      .orderBy(desc(mathBookmarksTable.createdAt));

    const problemIds = bookmarks.map((b) => b.problemId);
    const problems = problemIds.length > 0
      ? await db.select().from(mathProblemsTable).where(inArray(mathProblemsTable.id, problemIds))
      : [];

    const problemMap = new Map(problems.map((p) => [p.id, p]));
    const result = bookmarks.map((b) => ({ ...b, problem: problemMap.get(b.problemId) ?? null }));

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "getMathBookmarks failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /math/bookmarks
router.post("/math/bookmarks", async (req, res) => {
  try {
    const parsed = AddMathBookmarkBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

    const clerkUserId = req.betterAuthSession?.user?.id ?? null;
    if (!clerkUserId) { res.status(401).json({ error: "Sign in to bookmark" }); return; }
    const userId = clerkUserId;

    const { problemId, note, listName } = parsed.data;
    const [bookmark] = await db
      .insert(mathBookmarksTable)
      .values({ userId, problemId, note: note ?? null, listName: listName ?? "Default" })
      .onConflictDoUpdate({
        target: [mathBookmarksTable.userId, mathBookmarksTable.problemId],
        set: { note: note ?? null, listName: listName ?? "Default" },
      })
      .returning();

    const [problem] = await db
      .select()
      .from(mathProblemsTable)
      .where(eq(mathProblemsTable.id, problemId));

    res.status(201).json({ ...bookmark, problem: problem ?? null });
  } catch (err) {
    req.log.error({ err }, "addMathBookmark failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /math/bookmarks/:problemId
router.delete("/math/bookmarks/:problemId", async (req, res) => {
  try {
    const parsed = RemoveMathBookmarkParams.safeParse(req.params);
    if (!parsed.success) { res.status(400).json({ error: "Invalid problemId" }); return; }

    const clerkUserId = req.betterAuthSession?.user?.id ?? null;
    if (!clerkUserId) { res.status(401).json({ error: "Sign in to manage bookmarks" }); return; }
    const userId = clerkUserId;

    await db
      .delete(mathBookmarksTable)
      .where(and(eq(mathBookmarksTable.userId, userId), eq(mathBookmarksTable.problemId, parsed.data.problemId)));

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "removeMathBookmark failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /math/notifications
router.get("/math/notifications", async (req, res) => {
  try {
    const clerkUserId = req.betterAuthSession?.user?.id ?? null;
    if (!clerkUserId) { res.status(401).json({ error: "Sign in to view notifications" }); return; }
    const userId = clerkUserId;

    const notifications = await db
      .select()
      .from(mathNotificationsTable)
      .where(eq(mathNotificationsTable.userId, userId))
      .orderBy(desc(mathNotificationsTable.createdAt))
      .limit(50);

    res.json(notifications);
  } catch (err) {
    req.log.error({ err }, "getMathNotifications failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /math/notifications/read
router.post("/math/notifications/read", async (req, res) => {
  try {
    const clerkUserId = req.betterAuthSession?.user?.id ?? null;
    if (!clerkUserId) { res.status(401).json({ error: "Sign in to mark notifications" }); return; }
    const userId = clerkUserId;

    await db
      .update(mathNotificationsTable)
      .set({ isRead: true })
      .where(and(eq(mathNotificationsTable.userId, userId), eq(mathNotificationsTable.isRead, false)));

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "markMathNotificationsRead failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ──────────────────────────────────────────────────────────────
// Elegance Battle — dedicated page routes
// GET  /math/problems/:id/elegance-battle/full
// POST /math/problems/:id/elegance-battle/arguments
// POST /math/problems/:id/elegance-battle/arguments/:argId/vote
// POST /math/problems/:id/elegance-battle/conclude
// ──────────────────────────────────────────────────────────────

/** Same step-parser logic as the frontend's parseSteps util */
function parseStepsServer(text: string): { label: string | null; content: string }[] {
  const paras = text.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  if (paras.length >= 2) {
    const parsed = paras.map((para) => {
      const boldStep = para.match(/^\*\*Step\s+(\d+):\*\*\s*([\s\S]+)/i);
      if (boldStep) return { label: `Step ${boldStep[1]}`, content: boldStep[2].trim() };
      const boldFinal = para.match(/^\*\*Final Answer:\*\*\s*([\s\S]+)/i);
      if (boldFinal) return { label: "Final Answer", content: boldFinal[1].trim() };
      const boldLabel = para.match(/^\*\*([A-Z][A-Za-z\s]{0,25}?):\*\*\s*([\s\S]+)/);
      if (boldLabel && boldLabel[1].split(" ").length <= 4) return { label: boldLabel[1], content: boldLabel[2].trim() };
      const m = para.match(/^(?:\*\*)?([A-Z][A-Za-z\s]{1,25}?)(?:\*\*)?:\s*([\s\S]+)/);
      if (m && m[1].split(" ").length <= 4 && !/\d/.test(m[1])) return { label: m[1], content: m[2].trim() };
      return { label: null, content: para };
    });
    if (parsed.some((p) => p.label !== null)) return parsed;
  }
  const numbered = text.split(/\n(?=(?:\*\*)?(?:Step\s+)?\d+(?:\*\*)?[.):\s])/m).filter((s) => s.trim());
  if (numbered.length >= 2) {
    return numbered.map((part, i) => {
      const boldStep = part.match(/^\*\*Step\s+(\d+):\*\*\s*([\s\S]*)/i);
      if (boldStep) return { label: `Step ${boldStep[1]}`, content: boldStep[2].trim() };
      const m = part.match(/^(?:\*\*)?(?:Step\s+)?(\d+)(?:\*\*)?[.):\s]+\s*([\s\S]*)/);
      if (m) return { label: `Step ${m[1]}`, content: m[2].trim() };
      return { label: `Step ${i + 1}`, content: part.trim() };
    });
  }
  return [{ label: null, content: text }];
}

router.get("/math/problems/:id/elegance-battle/full", async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid id" }); return; }

    const viewerId = req.betterAuthSession?.user?.id ?? null;
    const [problem] = await db.select().from(mathProblemsTable).where(eq(mathProblemsTable.id, id));
    if (!problem) { res.status(404).json({ error: "Problem not found" }); return; }

    const [debate] = await db
      .select()
      .from(debatesTable)
      .where(and(eq(debatesTable.mathProblemId, id), eq(debatesTable.category, "Mathematics")))
      .orderBy(desc(debatesTable.createdAt))
      .limit(1);

    const solutions = await db
      .select()
      .from(mathSolutionsTable)
      .where(eq(mathSolutionsTable.problemId, id))
      .orderBy(desc(mathSolutionsTable.createdAt));
    const showdown = await buildShowdownDetail(id, viewerId ?? undefined);
    const showdownBySolution = new Map(showdown.solutions.map((solution) => [solution.id, solution]));

    const stepVotes = await db
      .select()
      .from(mathBattleStepVotesTable)
      .where(eq(mathBattleStepVotesTable.problemId, id));

    const args = await db
      .select()
      .from(mathBattleStepArgumentsTable)
      .where(and(eq(mathBattleStepArgumentsTable.problemId, id), eq(mathBattleStepArgumentsTable.isRemoved, false)))
      .orderBy(asc(mathBattleStepArgumentsTable.createdAt));

    const argIds = args.map((argument) => argument.id);
    const myArgVotes = argIds.length > 0 && viewerId
      ? await db.select().from(mathBattleStepArgumentVotesTable).where(and(
          eq(mathBattleStepArgumentVotesTable.userId, viewerId),
          inArray(mathBattleStepArgumentVotesTable.argumentId, argIds),
        ))
      : [];
    const myArgVoteMap = new Map(myArgVotes.map((vote) => [vote.argumentId, vote.vote]));

    type ArgOut = {
      id: number; solutionId: number; stepIndex: number; parentId: number | null;
      userId: string; userName: string; content: string; createdAt: string;
      upvotes: number; downvotes: number; isPinned: boolean; myVote: string | null;
      replies: ArgOut[];
    };
    const argMap = new Map<number, ArgOut>();
    for (const argument of args) {
      argMap.set(argument.id, {
        id: argument.id,
        solutionId: argument.solutionId,
        stepIndex: argument.stepIndex,
        parentId: argument.parentId ?? null,
        userId: argument.userId,
        userName: argument.userName,
        content: argument.content,
        createdAt: argument.createdAt.toISOString(),
        upvotes: argument.upvotes,
        downvotes: argument.downvotes,
        isPinned: argument.isPinned,
        myVote: myArgVoteMap.get(argument.id) ?? null,
        replies: [],
      });
    }
    const topLevelArgs: ArgOut[] = [];
    for (const argument of args) {
      const node = argMap.get(argument.id)!;
      if (argument.parentId && argMap.has(argument.parentId)) argMap.get(argument.parentId)!.replies.push(node);
      else topLevelArgs.push(node);
    }

    const stepVotesBySolution = new Map<string, { up: number; down: number }>();
    for (const vote of stepVotes) {
      const key = `${vote.solutionId}:${vote.stepIndex}`;
      const current = stepVotesBySolution.get(key) ?? { up: 0, down: 0 };
      if (vote.vote === "sound") current.up += 1;
      else current.down += 1;
      stepVotesBySolution.set(key, current);
    }

    const solutionsOut = solutions.map((solution) => {
      const steps = parseStepsServer(solution.body);
      const liveVotes = showdownBySolution.get(solution.id)?.votes ?? { elegant: 0, clear: 0, rigorous: 0, efficient: 0 };
      return {
        id: solution.id,
        userId: solution.userId,
        userName: solution.userName,
        approach: solution.approach,
        body: solution.body,
        steps: steps.map((step) => step.label ? `**${step.label}:** ${step.content}` : step.content),
        stepSoundness: steps.map((_, stepIndex) => stepVotesBySolution.get(`${solution.id}:${stepIndex}`) ?? { up: 0, down: 0 }),
        votes: liveVotes,
        isAccepted: solution.isAccepted,
        solvingTime: solution.solvingTime ?? null,
      };
    });

    function categoryWinner(axis: ShowdownAxis) {
      let winner: (typeof solutionsOut)[number] | undefined;
      for (const solution of solutionsOut) {
        if (!winner || solution.votes[axis] > winner.votes[axis]) winner = solution;
      }
      return winner && winner.votes[axis] > 0 ? winner : undefined;
    }
    const mostElegant = categoryWinner("elegant");
    const mostRigorous = categoryWinner("rigorous");
    const clearest = categoryWinner("clear");
    const mostEfficient = categoryWinner("efficient");

    let verdictAuthor: string | null = null;
    if (debate?.verdictByUserId) {
      const [profile] = await db.select({ displayName: mathUserProfilesTable.displayName })
        .from(mathUserProfilesTable)
        .where(eq(mathUserProfilesTable.userId, debate.verdictByUserId))
        .limit(1);
      verdictAuthor = profile?.displayName ?? "Moderator";
    }
    const permissions = debate
      ? mathBattlePermissions(debate, viewerId, process.env["ADMIN_CLERK_ID"])
      : { canParticipate: false, canConclude: false };
    const isEnded = debate ? !battleAcceptsInteraction(debate) : false;

    res.json({
      problemId: id,
      problemTitle: problem.title,
      battle: debate ? {
        debateId: debate.id,
        isLive: debate.isLive && !isEnded,
        isEnded,
        verdict: debate.verdictText ?? null,
        verdictAuthor,
        canParticipate: permissions.canParticipate,
        canConclude: permissions.canConclude,
      } : null,
      solutions: solutionsOut,
      arguments: topLevelArgs,
      myAxisVotes: showdown.myVotes,
      categories: {
        mostElegant: mostElegant ? { solutionId: mostElegant.id, votes: mostElegant.votes.elegant } : null,
        mostRigorous: mostRigorous ? { solutionId: mostRigorous.id, votes: mostRigorous.votes.rigorous } : null,
        clearest: clearest ? { solutionId: clearest.id, votes: clearest.votes.clear } : null,
        mostEfficient: mostEfficient ? { solutionId: mostEfficient.id, stepCount: parseStepsServer(mostEfficient.body).length } : null,
      },
    });
  } catch (err) {
    req.log.error({ err }, "getEleganceBattleFull failed");
    res.status(500).json({ error: "Internal server error" });
  }
});
router.post("/math/problems/:id/elegance-battle/arguments", async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid id" }); return; }

    const userId = req.betterAuthSession?.user?.id ?? null;
    if (!userId) { res.status(401).json({ error: "Sign in required" }); return; }

    const { solutionId, stepIndex, content, parentId } = (req.body ?? {}) as {
      solutionId?: number; stepIndex?: number; content?: string; parentId?: number;
    };
    const normalizedContent = normalizeMathBattleText(content);
    if (!Number.isInteger(solutionId) || Number(solutionId) <= 0 || !normalizedContent) {
      res.status(400).json({ error: "A valid solution and 1–4,000 characters of reasoning are required" }); return;
    }

    const [solution] = await db.select({ id: mathSolutionsTable.id, body: mathSolutionsTable.body })
      .from(mathSolutionsTable)
      .where(and(eq(mathSolutionsTable.id, Number(solutionId)), eq(mathSolutionsTable.problemId, id)))
      .limit(1);
    if (!solution) { res.status(404).json({ error: "Solution not found for this problem" }); return; }
    if (!validMathBattleStep(stepIndex, parseStepsServer(solution.body).length)) {
      res.status(400).json({ error: "stepIndex does not identify a step in this solution" }); return;
    }

    const [battle] = await db.select().from(debatesTable)
      .where(and(eq(debatesTable.mathProblemId, id), eq(debatesTable.category, "Mathematics")))
      .orderBy(desc(debatesTable.createdAt))
      .limit(1);
    if (!battle) { res.status(404).json({ error: "Elegance battle not found" }); return; }
    if (!battleAcceptsInteraction(battle)) { res.status(409).json({ error: "This elegance battle has ended" }); return; }
    const permissions = mathBattlePermissions(battle, userId, process.env["ADMIN_CLERK_ID"]);
    if (!permissions.canParticipate) {
      res.status(403).json({ error: "Battle moderators cannot participate in arguments" }); return;
    }

    if (parentId !== undefined) {
      if (!Number.isInteger(parentId) || parentId <= 0) { res.status(400).json({ error: "Invalid parentId" }); return; }
      const [parent] = await db.select({
        id: mathBattleStepArgumentsTable.id,
        stepIndex: mathBattleStepArgumentsTable.stepIndex,
        parentId: mathBattleStepArgumentsTable.parentId,
        isRemoved: mathBattleStepArgumentsTable.isRemoved,
      }).from(mathBattleStepArgumentsTable).where(and(
        eq(mathBattleStepArgumentsTable.id, parentId),
        eq(mathBattleStepArgumentsTable.problemId, id),
        eq(mathBattleStepArgumentsTable.solutionId, Number(solutionId)),
      )).limit(1);
      if (!parent || parent.isRemoved || parent.stepIndex !== stepIndex || parent.parentId !== null) {
        res.status(400).json({ error: "Replies must target a visible top-level argument on the same step" }); return;
      }
    }

    const user = await jitProvisionUser(req.betterAuthSession?.user ?? null);
    if (!user) { res.status(503).json({ error: "Could not create user profile" }); return; }
    const [argument] = await db.insert(mathBattleStepArgumentsTable).values({
      problemId: id,
      solutionId: Number(solutionId),
      stepIndex,
      content: normalizedContent,
      parentId: parentId ?? null,
      userId,
      userName: user.name ?? "Anonymous",
    }).returning();
    if (!argument) { res.status(500).json({ error: "Failed to create argument" }); return; }

    res.status(201).json({
      id: argument.id,
      solutionId: argument.solutionId,
      stepIndex: argument.stepIndex,
      parentId: argument.parentId ?? null,
      userId: argument.userId,
      userName: argument.userName,
      content: argument.content,
      createdAt: argument.createdAt.toISOString(),
      upvotes: argument.upvotes,
      downvotes: argument.downvotes,
      isPinned: argument.isPinned,
      myVote: null,
      replies: [],
    });
  } catch (err) {
    req.log.error({ err }, "postEleganceBattleArgument failed");
    res.status(500).json({ error: "Internal server error" });
  }
});
router.post("/math/problems/:id/elegance-battle/arguments/:argId/vote", async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    const argId = Number(req.params["argId"]);
    if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(argId) || argId <= 0) {
      res.status(400).json({ error: "Invalid id" }); return;
    }
    const userId = req.betterAuthSession?.user?.id ?? null;
    if (!userId) { res.status(401).json({ error: "Sign in required" }); return; }
    const { vote } = (req.body ?? {}) as { vote?: string };
    if (vote !== "up" && vote !== "down") { res.status(400).json({ error: "vote must be 'up' or 'down'" }); return; }

    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(3, ${argId})`);
      const [argument] = await tx.select().from(mathBattleStepArgumentsTable)
        .where(and(eq(mathBattleStepArgumentsTable.id, argId), eq(mathBattleStepArgumentsTable.problemId, id)))
        .limit(1);
      if (!argument || argument.isRemoved) return { kind: "missing" as const };
      if (argument.userId === userId) return { kind: "self" as const };

      const [battle] = await tx.select().from(debatesTable)
        .where(and(eq(debatesTable.mathProblemId, id), eq(debatesTable.category, "Mathematics")))
        .orderBy(desc(debatesTable.createdAt))
        .limit(1);
      if (!battle || !battleAcceptsInteraction(battle)) return { kind: "closed" as const };
      if (!mathBattlePermissions(battle, userId, process.env["ADMIN_CLERK_ID"]).canParticipate) {
        return { kind: "moderator" as const };
      }

      const [existing] = await tx.select().from(mathBattleStepArgumentVotesTable)
        .where(and(eq(mathBattleStepArgumentVotesTable.userId, userId), eq(mathBattleStepArgumentVotesTable.argumentId, argId)))
        .limit(1);
      let myVote: string | null = vote;
      if (!existing) {
        await tx.insert(mathBattleStepArgumentVotesTable).values({ userId, argumentId: argId, vote });
      } else if (existing.vote === vote) {
        await tx.delete(mathBattleStepArgumentVotesTable).where(and(
          eq(mathBattleStepArgumentVotesTable.userId, userId),
          eq(mathBattleStepArgumentVotesTable.argumentId, argId),
        ));
        myVote = null;
      } else {
        await tx.update(mathBattleStepArgumentVotesTable).set({ vote }).where(and(
          eq(mathBattleStepArgumentVotesTable.userId, userId),
          eq(mathBattleStepArgumentVotesTable.argumentId, argId),
        ));
      }
      const counts = await tx.select({ vote: mathBattleStepArgumentVotesTable.vote, count: sql<number>`count(*)::int` })
        .from(mathBattleStepArgumentVotesTable)
        .where(eq(mathBattleStepArgumentVotesTable.argumentId, argId))
        .groupBy(mathBattleStepArgumentVotesTable.vote);
      const upvotes = counts.find((row) => row.vote === "up")?.count ?? 0;
      const downvotes = counts.find((row) => row.vote === "down")?.count ?? 0;
      await tx.update(mathBattleStepArgumentsTable).set({ upvotes, downvotes })
        .where(eq(mathBattleStepArgumentsTable.id, argId));
      return { kind: "ok" as const, upvotes, downvotes, myVote };
    });

    if (result.kind === "missing") { res.status(404).json({ error: "Argument not found" }); return; }
    if (result.kind === "self") { res.status(403).json({ error: "You cannot vote on your own argument" }); return; }
    if (result.kind === "closed") { res.status(409).json({ error: "This elegance battle has ended" }); return; }
    if (result.kind === "moderator") { res.status(403).json({ error: "Battle moderators cannot vote on arguments" }); return; }
    res.json({ upvotes: result.upvotes, downvotes: result.downvotes, myVote: result.myVote });
  } catch (err) {
    req.log.error({ err }, "voteEleganceBattleArgument failed");
    res.status(500).json({ error: "Internal server error" });
  }
});
router.post("/math/problems/:id/elegance-battle/conclude", async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid id" }); return; }
    const userId = req.betterAuthSession?.user?.id ?? null;
    if (!userId) { res.status(401).json({ error: "Sign in required" }); return; }
    const verdict = normalizeMathBattleText((req.body ?? {}).verdict);
    if (!verdict) { res.status(400).json({ error: "A verdict of 1–4,000 characters is required" }); return; }

    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(42, ${id})`);
      const [debate] = await tx.select().from(debatesTable)
        .where(and(eq(debatesTable.mathProblemId, id), eq(debatesTable.category, "Mathematics")))
        .orderBy(desc(debatesTable.createdAt))
        .limit(1);
      if (!debate) return "missing" as const;
      if (!battleAcceptsInteraction(debate)) return "closed" as const;
      if (!mathBattlePermissions(debate, userId, process.env["ADMIN_CLERK_ID"]).canConclude) return "forbidden" as const;

      await tx.update(debatesTable).set({
        isLive: false,
        winnerStatus: debate.creatorUserId === userId ? "creator_declared" : "admin_decided",
        endedAt: new Date(),
        endedEarly: true,
        verdictText: verdict,
        verdictByUserId: userId,
      }).where(and(eq(debatesTable.id, debate.id), isNull(debatesTable.endedAt)));
      return "ok" as const;
    });

    if (result === "missing") { res.status(404).json({ error: "No elegance battle found for this problem" }); return; }
    if (result === "closed") { res.status(409).json({ error: "This elegance battle has already ended" }); return; }
    if (result === "forbidden") { res.status(403).json({ error: "Only the moderator or an admin can conclude this battle" }); return; }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "concludeEleganceBattle failed");
    res.status(500).json({ error: "Internal server error" });
  }
});
// Suppress unused-import warnings for or/isNull (used in future route expansions)
void or; void isNull;

export default router;
