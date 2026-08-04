import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";

export const mathDifficultyVotesTable = pgTable(
  "math_difficulty_votes",
  {
    id: serial("id").primaryKey(),
    problemId: integer("problem_id").notNull(),
    userId: text("user_id").notNull(),
    rating: integer("rating").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.problemId, t.userId)],
);

export type MathDifficultyVote = typeof mathDifficultyVotesTable.$inferSelect;
export type InsertMathDifficultyVote = typeof mathDifficultyVotesTable.$inferInsert;
