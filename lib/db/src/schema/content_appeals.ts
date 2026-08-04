import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const contentAppealsTable = pgTable("content_appeals", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  contentType: text("content_type").notNull(),
  contentId: integer("content_id").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("open"),
  reviewNote: text("review_note"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertContentAppealSchema = createInsertSchema(contentAppealsTable).omit({ id: true, createdAt: true });
export type InsertContentAppeal = z.infer<typeof insertContentAppealSchema>;
export type ContentAppeal = typeof contentAppealsTable.$inferSelect;
