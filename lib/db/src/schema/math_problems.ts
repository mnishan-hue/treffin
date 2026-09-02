import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";

export const mathProblemsTable = pgTable("math_problems", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull(),
  userAvatar: text("user_avatar"),
  title: text("title").notNull(),
  body: text("body").notNull(),
  categoryId: integer("category_id").notNull(),
  difficulty: text("difficulty").notNull().default("intermediate"),
  hints: text("hints"),
  problemType: text("problem_type").notNull().default("solve"),
  tags: text("tags"),
  estimatedMinutes: integer("estimated_minutes"),
  prerequisites: text("prerequisites"),
  sourceUrl: text("source_url"),
  sourceAttribution: text("source_attribution"),
  isOriginal: boolean("is_original").notNull().default(true),
  isProblemOfWeek: boolean("is_problem_of_week").notNull().default(false),
  isFeatured: boolean("is_featured").notNull().default(false),
  isUnsolved: boolean("is_unsolved").notNull().default(false),
  status: text("status").notNull().default("open"),
  viewCount: integer("view_count").notNull().default(0),
  solutionCount: integer("solution_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type MathProblem = typeof mathProblemsTable.$inferSelect;
export type InsertMathProblem = typeof mathProblemsTable.$inferInsert;
