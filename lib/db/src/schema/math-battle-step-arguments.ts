import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const mathBattleStepArgumentsTable = pgTable(
  "math_battle_step_arguments",
  {
    id: serial("id").primaryKey(),
    problemId: integer("problem_id").notNull(),
    solutionId: integer("solution_id").notNull(),
    stepIndex: integer("step_index").notNull(),   // 0-based index into parseSteps(solution.body)
    parentId: integer("parent_id"),               // null = top-level, non-null = reply
    userId: text("user_id").notNull(),
    userName: text("user_name").notNull(),
    content: text("content").notNull(),
    upvotes: integer("upvotes").notNull().default(0),
    downvotes: integer("downvotes").notNull().default(0),
    isPinned: boolean("is_pinned").notNull().default(false),
    isRemoved: boolean("is_removed").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("mbs_arg_problem_idx").on(t.problemId),
    index("mbs_arg_solution_step_idx").on(t.solutionId, t.stepIndex),
  ],
);

export const mathBattleStepArgumentVotesTable = pgTable(
  "math_battle_step_argument_votes",
  {
    userId: text("user_id").notNull(),
    argumentId: integer("argument_id").notNull(),
    vote: text("vote").notNull(), // "up" | "down"
  },
  (t) => [
    uniqueIndex("mbs_arg_vote_unique").on(t.userId, t.argumentId),
  ],
);

// Separate table for per-step soundness votes (sound / unsound)
export const mathBattleStepVotesTable = pgTable(
  "math_battle_step_votes",
  {
    userId: text("user_id").notNull(),
    problemId: integer("problem_id").notNull(),
    solutionId: integer("solution_id").notNull(),
    stepIndex: integer("step_index").notNull(),
    vote: text("vote").notNull(), // "sound" | "unsound"
  },
  (t) => [
    uniqueIndex("mbs_step_vote_unique").on(t.userId, t.solutionId, t.stepIndex),
  ],
);

export type MathBattleStepArgument = typeof mathBattleStepArgumentsTable.$inferSelect;
export type InsertMathBattleStepArgument = typeof mathBattleStepArgumentsTable.$inferInsert;
export type MathBattleStepVote = typeof mathBattleStepVotesTable.$inferSelect;
