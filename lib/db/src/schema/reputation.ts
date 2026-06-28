import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const repEventTypeEnum = pgEnum("rep_event_type", [
  "post_created",
  "post_liked",
  "article_created",
  "article_liked",
  "debate_joined",
  "debate_won",
  "daily_question_voted",
  "weekly_challenge_won",
  "community_joined",
  "streak_bonus",
  "comment_posted",
]);

export const reputationEventsTable = pgTable("reputation_events", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  eventType: repEventTypeEnum("event_type").notNull(),
  points: integer("points").notNull(),
  description: text("description").notNull(),
  referenceId: integer("reference_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ReputationEvent = typeof reputationEventsTable.$inferSelect;
