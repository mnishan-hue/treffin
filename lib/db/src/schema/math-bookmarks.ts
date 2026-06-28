import { pgTable, serial, text, timestamp, integer, index, unique } from "drizzle-orm/pg-core";

export const mathBookmarksTable = pgTable(
  "math_bookmarks",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    problemId: integer("problem_id").notNull(),
    note: text("note"),
    listName: text("list_name").notNull().default("Default"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("math_bookmarks_user_idx").on(t.userId),
    unique("math_bookmarks_user_problem").on(t.userId, t.problemId),
  ],
);
