import { pgTable, serial, text, timestamp, integer, index } from "drizzle-orm/pg-core";

export const mathAnnotationsTable = pgTable(
  "math_annotations",
  {
    id: serial("id").primaryKey(),
    solutionId: integer("solution_id"),
    problemId: integer("problem_id").notNull(),
    userId: text("user_id").notNull(),
    userName: text("user_name").notNull(),
    body: text("body").notNull(),
    selectionStart: integer("selection_start"),
    selectionEnd: integer("selection_end"),
    status: text("status").notNull().default("open"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("math_annotations_solution_idx").on(t.solutionId),
    index("math_annotations_problem_idx").on(t.problemId),
  ],
);
