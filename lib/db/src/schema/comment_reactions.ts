import { pgTable, serial, integer, text, timestamp, unique, index } from "drizzle-orm/pg-core";

/**
 * Stores emoji reactions (🔥 fire / 🤔 think / 💡 bulb) on debate arguments.
 * One reaction type per user per comment — re-reacting to the same type removes it (toggle).
 */
export const commentReactionsTable = pgTable(
  "comment_reactions",
  {
    id: serial("id").primaryKey(),
    commentId: integer("comment_id").notNull(),
    userId: text("user_id").notNull(), // Clerk user ID
    reaction: text("reaction").notNull(), // "fire" | "think" | "bulb"
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("comment_reactions_comment_user_unique").on(t.commentId, t.userId),
    index("comment_reactions_comment_id_idx").on(t.commentId),
  ],
);

export type CommentReaction = typeof commentReactionsTable.$inferSelect;
