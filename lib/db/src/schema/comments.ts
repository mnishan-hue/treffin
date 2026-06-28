import { pgTable, serial, text, integer, boolean, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const flagLabelEnum = pgEnum("flag_label", ["strong", "fair"]);

export const commentsTable = pgTable("comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id"),
  debateId: integer("debate_id"),
  authorId: integer("author_id").notNull(),
  authorName: text("author_name").notNull(),
  content: text("content").notNull(),
  side: text("side"),
  parentCommentId: integer("parent_comment_id"),
  isFlagged: boolean("is_flagged").notNull().default(false),
  flagLabel: flagLabelEnum("flag_label"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  editedAt: timestamp("edited_at"),
  isRemoved: boolean("is_removed").notNull().default(false),
  removedReason: text("removed_reason"),
  sources: text("sources"),
  wordCount: integer("word_count"),
  toxicityFlagged: boolean("toxicity_flagged").notNull().default(false),
  aiSuspected: boolean("ai_suspected").notNull().default(false),
  likes: integer("likes").notNull().default(0),
}, (t) => [
  index("comments_post_id_idx").on(t.postId),
  index("comments_debate_id_idx").on(t.debateId),
  index("comments_author_id_idx").on(t.authorId),
]);

export const insertCommentSchema = createInsertSchema(commentsTable).omit({ id: true, createdAt: true });
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof commentsTable.$inferSelect;
