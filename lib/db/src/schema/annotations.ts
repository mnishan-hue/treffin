import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { articlesTable } from "./articles";
import { usersTable } from "./users";

export const annotationsTable = pgTable("annotations", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id").notNull().references(() => articlesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  selectedText: text("selected_text").notNull(),
  comment: text("comment").notNull(),
  paragraphIndex: integer("paragraph_index").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAnnotationSchema = createInsertSchema(annotationsTable).omit({ id: true, createdAt: true });
export type InsertAnnotation = z.infer<typeof insertAnnotationSchema>;
export type Annotation = typeof annotationsTable.$inferSelect;
