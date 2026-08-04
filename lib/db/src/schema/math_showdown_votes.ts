import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";

// One vote per (problem, user, axis) — voting for a new solution on the same
// axis overwrites the previous pick (upsert), it does not add a second vote.
export const mathShowdownVotesTable = pgTable(
  "math_showdown_votes",
  {
    id: serial("id").primaryKey(),
    problemId: integer("problem_id").notNull(),
    solutionId: integer("solution_id").notNull(),
    userId: text("user_id").notNull(),
    axis: text("axis").notNull(), // "elegant" | "clear" | "rigorous"
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.problemId, t.userId, t.axis)],
);

export type MathShowdownVote = typeof mathShowdownVotesTable.$inferSelect;
export type InsertMathShowdownVote = typeof mathShowdownVotesTable.$inferInsert;
