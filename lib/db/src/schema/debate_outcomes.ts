import { pgTable, serial, integer, text, timestamp, pgEnum, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const winningSideEnum = pgEnum("winning_side", ["support", "against", "draw"]);

export const debateOutcomesTable = pgTable("debate_outcomes", {
  id: serial("id").primaryKey(),
  debateId: integer("debate_id").notNull().unique(),
  winningSide: winningSideEnum("winning_side").notNull(),
  justification: text("justification").notNull(),
  topSupportCommentId: integer("top_support_comment_id"),
  topOppositionCommentId: integer("top_opposition_comment_id"),
  publishedAt: timestamp("published_at").notNull().defaultNow(),
});

export const insertDebateOutcomeSchema = createInsertSchema(debateOutcomesTable).omit({ id: true, publishedAt: true });
export type InsertDebateOutcome = z.infer<typeof insertDebateOutcomeSchema>;
export type DebateOutcome = typeof debateOutcomesTable.$inferSelect;
