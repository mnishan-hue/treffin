import { pgTable, serial, text, integer, timestamp, unique } from "drizzle-orm/pg-core";

export const dailyQuestionVotesTable = pgTable("daily_question_votes", {
  id: serial("id").primaryKey(),
  questionId: integer("question_id").notNull(),
  userId: text("user_id").notNull(),
  side: text("side").notNull(), // 'support' | 'against'
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  unique("daily_question_votes_question_user_uniq").on(t.questionId, t.userId),
]);

export type DailyQuestionVote = typeof dailyQuestionVotesTable.$inferSelect;
