import { pgTable, serial, text, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const postsTable = pgTable("posts", {
  id: serial("id").primaryKey(),
  type: text("type").notNull().default("opinion"),
  authorId: integer("author_id").notNull(),
  communityId: integer("community_id"),
  content: text("content"),
  title: text("title"),
  excerpt: text("excerpt"),
  imageUrl: text("image_url"),
  topic: text("topic"),
  readTime: integer("read_time"),
  likes: integer("likes").notNull().default(0),
  comments: integer("comments").notNull().default(0),
  reposts: integer("reposts").notNull().default(0),
  saved: boolean("saved").notNull().default(false),
  reportCount: integer("report_count").notNull().default(0),
  isFlagged: boolean("is_flagged").notNull().default(false),
  isAnonymous: boolean("is_anonymous").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  editedAt: timestamp("edited_at"),
  isRemoved: boolean("is_removed").notNull().default(false),
  removedReason: text("removed_reason"),
}, (t) => [
  index("posts_author_id_idx").on(t.authorId),
  index("posts_community_id_idx").on(t.communityId),
  index("posts_created_at_idx").on(t.createdAt),
]);

export const insertPostSchema = createInsertSchema(postsTable).omit({ id: true, createdAt: true });
export type InsertPost = z.infer<typeof insertPostSchema>;
export type Post = typeof postsTable.$inferSelect;
