import { pgTable, serial, integer, text, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { articlesTable } from "./articles";
import { usersTable } from "./users";

export const reviewStatusEnum = pgEnum("review_status", ["pending", "approved", "rejected"]);

export const articleReviewRequestsTable = pgTable("article_review_requests", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id").notNull().references(() => articlesTable.id, { onDelete: "cascade" }),
  requesterId: integer("requester_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  status: reviewStatusEnum("status").notNull().default("pending"),
  reviewerNote: text("reviewer_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertArticleReviewRequestSchema = createInsertSchema(articleReviewRequestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertArticleReviewRequest = z.infer<typeof insertArticleReviewRequestSchema>;
export type ArticleReviewRequest = typeof articleReviewRequestsTable.$inferSelect;
