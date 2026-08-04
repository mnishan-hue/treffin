import { pgTable, serial, integer, text, timestamp, unique, index } from "drizzle-orm/pg-core";
import { commentsTable } from "./comments";

export const commentLikesTable = pgTable("comment_likes", {
  id: serial("id").primaryKey(),
  commentId: integer("comment_id").notNull().references(() => commentsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  unique("comment_likes_comment_user_unique").on(t.commentId, t.userId),
  index("comment_likes_comment_id_idx").on(t.commentId),
  index("comment_likes_user_id_idx").on(t.userId),
]);

export type CommentLike = typeof commentLikesTable.$inferSelect;
export type InsertCommentLike = typeof commentLikesTable.$inferInsert;
