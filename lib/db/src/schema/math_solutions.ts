import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";

export const mathSolutionsTable = pgTable("math_solutions", {
  id: serial("id").primaryKey(),
  problemId: integer("problem_id").notNull(),
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull(),
  userAvatar: text("user_avatar"),
  body: text("body").notNull(),
  approach: text("approach").notNull().default("other"),
  isAccepted: boolean("is_accepted").notNull().default(false),
  isFeatured: boolean("is_featured").notNull().default(false),
  qualityScore: integer("quality_score").notNull().default(0),
  eleganceVotes: integer("elegance_votes").notNull().default(0),
  rigorVotes: integer("rigor_votes").notNull().default(0),
  clarityVotes: integer("clarity_votes").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type MathSolution = typeof mathSolutionsTable.$inferSelect;
export type InsertMathSolution = typeof mathSolutionsTable.$inferInsert;
