import { pgTable, serial, text, integer, timestamp, unique } from "drizzle-orm/pg-core";

export const weeklyChallengeSubmissionsTable = pgTable("weekly_challenge_submissions", {
  id: serial("id").primaryKey(),
  challengeId: integer("challenge_id").notNull(),
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull(),
  userAvatar: text("user_avatar"),
  response: text("response").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  unique("weekly_challenge_submissions_challenge_user_uniq").on(t.challengeId, t.userId),
]);

export type WeeklyChallengeSubmission = typeof weeklyChallengeSubmissionsTable.$inferSelect;
