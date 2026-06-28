import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
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
  debatesTable,
} from "@workspace/db";
import {
  eq,
  desc,
  asc,
  sql,
  and,
  ilike,
  inArray,
  notExists,
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

    const userId = req.headers["x-math-user-id"] as string | undefined;

    // Update streak for authenticated hub visitors (fire-and-forget to avoid adding latency)
    if (userId && userId !== "anonymous") {
      const userName = (req.headers["x-math-user-name"] as string) || "Anonymous";
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

    const userId = (req.headers["x-math-user-id"] as string) || "anonymous";
    const userName = (req.headers["x-math-user-name"] as string) || "Anonymous";

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

    const userId = req.headers["x-math-user-id"] as string | undefined;

    const { id } = parsed.data;

    const [problem] = await db
      .select()
      .from(mathProblemsTable)
      .where(eq(mathProblemsTable.id, id));

    if (!problem) {
      res.status(404).json({ error: "Problem not found" });
      return;
    }

    // Increment view count
    await db
      .update(mathProblemsTable)
      .set({ viewCount: sql`${mathProblemsTable.viewCount} + 1` })
      .where(eq(mathProblemsTable.id, id));

    // Update streak for authenticated user who views a problem
    if (userId && userId !== "anonymous") {
      const userName = (req.headers["x-math-user-name"] as string) || "Anonymous";
      await upsertMathUserProfile(userId, userName);
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
        { ...problem, viewCount: problem.viewCount + 1 },
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
    const userId = req.headers["x-math-user-id"] as string | undefined;
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

    const userId = (req.headers["x-math-user-id"] as string) || "";
    if (!userId) { res.status(401).json({ error: "Sign in required" }); return; }

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
// POST /math/problems/:id/elegance-debate
// ──────────────────────────────────────────────────────────────
router.post("/math/problems/:id/elegance-debate", async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const { userId: clerkUserId } = getAuth(req);
    const mathUserId = (req.headers["x-math-user-id"] as string) || undefined;
    const userId = clerkUserId ?? mathUserId;
    if (!userId) { res.status(401).json({ error: "Sign in required to start a debate" }); return; }

    const [problem] = await db
      .select()
      .from(mathProblemsTable)
      .where(eq(mathProblemsTable.id, id));
    if (!problem) { res.status(404).json({ error: "Problem not found" }); return; }

    const solutions = await db
      .select()
      .from(mathSolutionsTable)
      .where(eq(mathSolutionsTable.problemId, id))
      .orderBy(desc(mathSolutionsTable.qualityScore), asc(mathSolutionsTable.createdAt))
      .limit(2);

    if (solutions.length < 2) {
      res.status(400).json({ error: "At least 2 solutions are needed to start an elegance debate" });
      return;
    }

    const sol1 = solutions[0]!;
    const sol2 = solutions[1]!;
    const shortTitle = problem.title.length > 60 ? problem.title.slice(0, 60) + "…" : problem.title;
    const title = `Elegance Battle: ${shortTitle}`;
    const description = [
      `Which solution approach is more mathematically elegant?`,
      ``,
      `**Approach A — ${sol1.approach}** (by ${sol1.userName}):`,
      sol1.body.length > 350 ? sol1.body.slice(0, 350) + "…" : sol1.body,
      ``,
      `**Approach B — ${sol2.approach}** (by ${sol2.userName}):`,
      sol2.body.length > 350 ? sol2.body.slice(0, 350) + "…" : sol2.body,
    ].join("\n");

    const [debate] = await db
      .insert(debatesTable)
      .values({ title, description, category: "Mathematics", creatorUserId: userId, isLive: false })
      .returning();

    if (!debate) { res.status(500).json({ error: "Failed to create debate" }); return; }

    res.status(201).json({ debateId: debate.id });
  } catch (err) {
    req.log.error({ err }, "startEleganceDebate failed");
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

    const userId = (req.headers["x-math-user-id"] as string) || "anonymous";
    const userName = (req.headers["x-math-user-name"] as string) || "Anonymous";

    const { id } = paramsParsed.data;
    const { body, approach } = bodyParsed.data;

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

    const [solution] = await db
      .insert(mathSolutionsTable)
      .values({
        problemId: id,
        userId,
        userName,
        body,
        approach,
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

    const userId = (req.headers["x-math-user-id"] as string) || "anonymous";
    if (userId === "anonymous") {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

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

    const userId = (req.headers["x-math-user-id"] as string) || "anonymous";
    if (userId === "anonymous") {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

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
// GET /math/problem-of-week
// ──────────────────────────────────────────────────────────────
router.get("/math/problem-of-week", async (req, res) => {
  try {
    const userId = req.headers["x-math-user-id"] as string | undefined;
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

    const userId = (req.headers["x-math-user-id"] as string) || "anonymous";
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

    const userId = (req.headers["x-math-user-id"] as string) || "anonymous";
    const { targetType, targetId, reason } = parsed.data;

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
  try {
    const params = UpdateMathUserProfileParams.safeParse(req.params);
    if (!params.success) { res.status(400).json({ error: "Invalid params" }); return; }
    const body = UpdateMathUserProfileBody.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: "Invalid body" }); return; }

    const { userId } = params.data;
    const reqUserId = (req.headers["x-math-user-id"] as string) || "";
    if (userId !== reqUserId) { res.status(403).json({ error: "Forbidden" }); return; }

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

// POST /math/contests (admin only via x-admin-token or just open for now)
router.post("/math/contests", async (req, res) => {
  const adminToken = req.headers["x-admin-token"];
  const { createHash } = await import("crypto");
  const email = process.env["ADMIN_EMAIL"] ?? process.env["VITE_ADMIN_EMAIL"] ?? "admin@treffin.com";
  const password = process.env["ADMIN_PASSWORD"] ?? process.env["VITE_ADMIN_PASSWORD"] ?? "treffin2025";
  const expectedToken = createHash("sha256").update(`${email}:${password}`).digest("hex");
  if (adminToken !== expectedToken) {
    res.status(401).json({ error: "Unauthorized" }); return;
  }
  try {
    const { title, description, difficulty, startTime, endTime, prizeDescription, problemIds } = req.body;
    if (!title || !description || !startTime || !endTime) {
      res.status(400).json({ error: "Missing required fields" }); return;
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
        isActive: true,
        createdBy: "admin",
      })
      .returning();

    if (Array.isArray(problemIds) && problemIds.length > 0) {
      await db.insert(mathContestProblemsTable).values(
        problemIds.map((pid: number, i: number) => ({
          contestId: contest.id,
          problemId: pid,
          sortOrder: i,
          points: 100,
        })),
      );
    }

    res.status(201).json({ ...contest, status: "upcoming" });
  } catch (err) {
    req.log.error({ err }, "createMathContest failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /math/contests/:contestId
router.get("/math/contests/:contestId", async (req, res) => {
  try {
    const parsed = GetMathContestParams.safeParse(req.params);
    if (!parsed.success) { res.status(400).json({ error: "Invalid contestId" }); return; }
    const { contestId } = parsed.data;
    const userId = (req.headers["x-math-user-id"] as string) || "";
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
    const userId = (req.headers["x-math-user-id"] as string) || "";
    const userName = (req.headers["x-math-user-name"] as string) || "Anonymous";

    if (!userId) { res.status(401).json({ error: "User ID required" }); return; }

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

    const userId = (req.headers["x-math-user-id"] as string) || "";
    const userName = (req.headers["x-math-user-name"] as string) || "Anonymous";
    if (!userId) { res.status(401).json({ error: "User ID required" }); return; }

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
    const userId = (req.headers["x-math-user-id"] as string) || "";
    if (!userId) { res.status(401).json({ error: "User ID required" }); return; }

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

    const userId = (req.headers["x-math-user-id"] as string) || "";
    if (!userId) { res.status(401).json({ error: "User ID required" }); return; }

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

    const userId = (req.headers["x-math-user-id"] as string) || "";
    if (!userId) { res.status(401).json({ error: "User ID required" }); return; }

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
    const userId = (req.headers["x-math-user-id"] as string) || "";
    if (!userId) { res.status(401).json({ error: "User ID required" }); return; }

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
    const userId = (req.headers["x-math-user-id"] as string) || "";
    if (!userId) { res.status(401).json({ error: "User ID required" }); return; }

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

export default router;
