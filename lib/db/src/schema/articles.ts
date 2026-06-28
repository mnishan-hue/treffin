import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const articlesTable = pgTable("articles", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  excerpt: text("excerpt"),
  content: text("content"),
  imageUrl: text("image_url"),
  authorId: integer("author_id").notNull(),
  category: text("category"),
  readTime: integer("read_time").notNull().default(5),
  likes: integer("likes").notNull().default(0),
  isTrending: boolean("is_trending").notNull().default(false),
  isFeatured: boolean("is_featured").notNull().default(false),
  isExpertReviewed: boolean("is_expert_reviewed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  editedAt: timestamp("edited_at"),
  isRemoved: boolean("is_removed").notNull().default(false),
  removedReason: text("removed_reason"),
  status: text("status").notNull().default("published"),
  toxicityFlagged: boolean("toxicity_flagged").notNull().default(false),
  aiSuspected: boolean("ai_suspected").notNull().default(false),
});

export const insertArticleSchema = createInsertSchema(articlesTable).omit({ id: true, createdAt: true });
export type InsertArticle = z.infer<typeof insertArticleSchema>;
export type Article = typeof articlesTable.$inferSelect;
