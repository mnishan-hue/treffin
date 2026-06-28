import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";

export const mathCategoriesTable = pgTable("math_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
  color: text("color").notNull().default("#6366f1"),
  icon: text("icon").notNull().default("∑"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type MathCategory = typeof mathCategoriesTable.$inferSelect;
export type InsertMathCategory = typeof mathCategoriesTable.$inferInsert;
