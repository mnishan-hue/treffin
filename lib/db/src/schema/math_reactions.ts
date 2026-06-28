import { pgTable, serial, text, integer, timestamp, unique } from "drizzle-orm/pg-core";

export const mathReactionsTable = pgTable("math_reactions", {
  id: serial("id").primaryKey(),
  targetType: text("target_type").notNull(),
  targetId: integer("target_id").notNull(),
  userId: text("user_id").notNull(),
  reactionType: text("reaction_type").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  uniqueReaction: unique().on(t.targetType, t.targetId, t.userId, t.reactionType),
}));

export type MathReaction = typeof mathReactionsTable.$inferSelect;
export type InsertMathReaction = typeof mathReactionsTable.$inferInsert;
