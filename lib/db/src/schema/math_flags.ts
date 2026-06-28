import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const mathFlagsTable = pgTable("math_flags", {
  id: serial("id").primaryKey(),
  targetType: text("target_type").notNull(),
  targetId: integer("target_id").notNull(),
  userId: text("user_id").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"),
  resolvedBy: text("resolved_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export type MathFlag = typeof mathFlagsTable.$inferSelect;
export type InsertMathFlag = typeof mathFlagsTable.$inferInsert;
