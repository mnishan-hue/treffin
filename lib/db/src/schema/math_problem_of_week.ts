import { pgTable, serial, integer, timestamp, text } from "drizzle-orm/pg-core";

export const mathProblemOfWeekTable = pgTable("math_problem_of_week", {
  id: serial("id").primaryKey(),
  problemId: integer("problem_id").notNull(),
  weekStart: timestamp("week_start").notNull(),
  weekEnd: timestamp("week_end").notNull(),
  featuredSolutionId: integer("featured_solution_id"),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type MathProblemOfWeek = typeof mathProblemOfWeekTable.$inferSelect;
export type InsertMathProblemOfWeek = typeof mathProblemOfWeekTable.$inferInsert;
