import { pgTable, serial, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const topicsTable = pgTable("topics", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  slug: text("slug"),
  icon: text("icon"),
  description: text("description"),
});

export const insertTopicSchema = createInsertSchema(topicsTable).omit({ id: true });
export type InsertTopic = z.infer<typeof insertTopicSchema>;
export type Topic = typeof topicsTable.$inferSelect;
