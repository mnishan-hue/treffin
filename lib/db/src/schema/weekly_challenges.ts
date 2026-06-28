import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const weeklyChallengesTable = pgTable("weekly_challenges", {
  id: serial("id").primaryKey(),
  question: text("question").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  winnerUserId: text("winner_user_id"),
  winnerName: text("winner_name"),
  winnerAvatar: text("winner_avatar"),
  winnerResponse: text("winner_response"),
});

export const insertWeeklyChallengeSchema = createInsertSchema(weeklyChallengesTable).omit({ id: true, createdAt: true });
export type InsertWeeklyChallenge = z.infer<typeof insertWeeklyChallengeSchema>;
export type WeeklyChallenge = typeof weeklyChallengesTable.$inferSelect;
