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
  mathProblemId: integer("math_problem_id"),
  // ── Creator moderation powers ──────────────────────────────────────────
  // If true, the creator chose to moderate their own debate (pin/remove
  // comments, end it early, edit its details) — in exchange they cannot
  // vote or post arguments in it, to keep moderation fair.
  creatorIsModerator: boolean("creator_is_moderator").notNull().default(false),
  // Who has authority to declare the winning side: the creator themself,
  // or the admin team. Creator-declared results still surface in the admin
  // panel and can be overridden with a reason.
  winnerAuthority: text("winner_authority").notNull().default("creator"),
  winnerStatus: text("winner_status").notNull().default("undecided"),
  endedEarly: boolean("ended_early").notNull().default(false),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  // Optional per-argument word cap set by the creator at debate creation time.
  // When set, the backend rejects arguments that exceed this word count.
  wordLimit: integer("word_limit"),
  // Elegance Battle verdict (set by conclude endpoint)
  verdictText: text("verdict_text"),
  verdictByUserId: text("verdict_by_user_id"),
  // When true, admin has taken over active moderation of this debate.
  // The creator's moderation is already revoked; this flag signals that an
  // admin is actively moderating (pin/feature/remove) through the admin panel.
  adminModerating: boolean("admin_moderating").notNull().default(false),
});

export const insertDebateSchema = createInsertSchema(debatesTable).omit({ id: true, createdAt: true });
export type InsertDebate = z.infer<typeof insertDebateSchema>;
export type Debate = typeof debatesTable.$inferSelect;
