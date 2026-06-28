import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const debatesTable = pgTable("debates", {
  id: serial("id").primaryKey(),
  creatorUserId: text("creator_user_id"),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  supportPercent: integer("support_percent").notNull().default(50),
  againstPercent: integer("against_percent").notNull().default(50),
  participantCount: integer("participant_count").notNull().default(0),
  isLive: boolean("is_live").notNull().default(false),
  imageUrl: text("image_url"),
  rank: integer("rank"),
  trend: text("trend").notNull().default("stable"),
  isTrending: boolean("is_trending").notNull().default(false),
  isFeatured: boolean("is_featured").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  isFrozen: boolean("is_frozen").notNull().default(false),
  frozenReason: text("frozen_reason"),
  isAnonymous: boolean("is_anonymous").notNull().default(false),
  sourcesRequired: boolean("sources_required").notNull().default(false),
  closingArgMinHours: integer("closing_arg_min_hours").notNull().default(24),
  contentWarning: text("content_warning"),
  healthScore: integer("health_score").notNull().default(100),
});

export const insertDebateSchema = createInsertSchema(debatesTable).omit({ id: true, createdAt: true });
export type InsertDebate = z.infer<typeof insertDebateSchema>;
export type Debate = typeof debatesTable.$inferSelect;
