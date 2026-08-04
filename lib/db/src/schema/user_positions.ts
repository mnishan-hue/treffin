import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const userPositionsTable = pgTable("user_positions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  topic: text("topic").notNull(),
  stance: text("stance").notNull(),
  isRevised: boolean("is_revised").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserPositionSchema = createInsertSchema(userPositionsTable).omit({ id: true, createdAt: true });
export type InsertUserPosition = z.infer<typeof insertUserPositionSchema>;
export type UserPosition = typeof userPositionsTable.$inferSelect;
