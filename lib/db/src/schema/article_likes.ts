import { pgTable, serial, text, integer, timestamp, unique, index } from "drizzle-orm/pg-core";

export const articleLikesTable = pgTable("article_likes", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id").notNull(),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  unique("article_likes_article_user_unique").on(t.articleId, t.userId),
  index("article_likes_article_id_idx").on(t.articleId),
  index("article_likes_user_id_idx").on(t.userId),
]);

export type ArticleLike = typeof articleLikesTable.$inferSelect;
export type InsertArticleLike = typeof articleLikesTable.$inferInsert;
