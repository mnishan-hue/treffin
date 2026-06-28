import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dailyQuestionsTable = pgTable("daily_questions", {
  id: serial("id").primaryKey(),
  question: text("question").notNull(),
  supportPercent: integer("support_percent").notNull().default(50),
  againstPercent: integer("against_percent").notNull().default(50),
  participantCount: integer("participant_count").notNull().default(0),
  isLive: boolean("is_live").notNull().default(true),
  imageUrl: text("image_url").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDailyQuestionSchema = createInsertSchema(dailyQuestionsTable).omit({ id: true, createdAt: true });
export type InsertDailyQuestion = z.infer<typeof insertDailyQuestionSchema>;
export type DailyQuestion = typeof dailyQuestionsTable.$inferSelect;
