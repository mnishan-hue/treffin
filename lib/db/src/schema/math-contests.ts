import { pgTable, serial, text, timestamp, integer, boolean, index } from "drizzle-orm/pg-core";

export const mathContestsTable = pgTable(
  "math_contests",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    difficulty: text("difficulty").notNull().default("intermediate"),
    startTime: timestamp("start_time").notNull(),
    endTime: timestamp("end_time").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: text("created_by").notNull().default("admin"),
    prizeDescription: text("prize_description"),
    totalParticipants: integer("total_participants").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("math_contests_active_idx").on(t.isActive, t.startTime)],
);

export const mathContestProblemsTable = pgTable(
  "math_contest_problems",
  {
    id: serial("id").primaryKey(),
    contestId: integer("contest_id").notNull().references(() => mathContestsTable.id, { onDelete: "cascade" }),
    problemId: integer("problem_id").notNull(),
    points: integer("points").notNull().default(100),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("math_contest_problems_contest_idx").on(t.contestId)],
);

export const mathContestEntriesTable = pgTable(
  "math_contest_entries",
  {
    id: serial("id").primaryKey(),
    contestId: integer("contest_id").notNull().references(() => mathContestsTable.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    userName: text("user_name").notNull(),
    score: integer("score").notNull().default(0),
    solutionsCount: integer("solutions_count").notNull().default(0),
    rank: integer("rank"),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
    lastSubmittedAt: timestamp("last_submitted_at"),
  },
  (t) => [
    index("math_contest_entries_contest_idx").on(t.contestId, t.score),
    index("math_contest_entries_user_idx").on(t.userId),
  ],
);
