import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userDomainScoresTable = pgTable("user_domain_scores", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  domain: text("domain").notNull(),
  score: integer("score").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type UserDomainScore = typeof userDomainScoresTable.$inferSelect;
