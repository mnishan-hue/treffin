import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const postReportsTable = pgTable("post_reports", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull(),
  reporterUserId: integer("reporter_user_id"),
  reason: text("reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type PostReport = typeof postReportsTable.$inferSelect;
