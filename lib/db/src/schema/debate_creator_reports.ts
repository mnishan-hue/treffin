import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Users can report a debate's creator for unfair moderation (e.g. abusing
// pin/remove powers, or being biased when declaring a winner). Reports land
// in the admin panel for review; upholding one revokes the creator's
// moderator powers on that debate.
export const debateCreatorReportsTable = pgTable("debate_creator_reports", {
  id: serial("id").primaryKey(),
  debateId: integer("debate_id").notNull(),
  creatorUserId: text("creator_user_id").notNull(),
  reporterUserId: text("reporter_user_id"),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"), // pending | dismissed | upheld
  adminNote: text("admin_note"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDebateCreatorReportSchema = createInsertSchema(debateCreatorReportsTable).omit({ id: true, createdAt: true });
export type InsertDebateCreatorReport = z.infer<typeof insertDebateCreatorReportSchema>;
export type DebateCreatorReport = typeof debateCreatorReportsTable.$inferSelect;
