import { pgTable, serial, text, integer, timestamp, unique, index } from "drizzle-orm/pg-core";

export const postLikesTable = pgTable("post_likes", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull(),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  unique("post_likes_post_user_unique").on(t.postId, t.userId),
  index("post_likes_post_id_idx").on(t.postId),
  index("post_likes_user_id_idx").on(t.userId),
]);

export type PostLike = typeof postLikesTable.$inferSelect;
export type InsertPostLike = typeof postLikesTable.$inferInsert;
