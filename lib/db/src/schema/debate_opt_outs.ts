import { pgTable, serial, text, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { debatesTable } from "./debates";

export const debateOptOutsTable = pgTable(
  "debate_opt_outs",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    debateId: integer("debate_id").notNull().references(() => debatesTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("opt_out_user_debate").on(t.userId, t.debateId)]
);

export type DebateOptOut = typeof debateOptOutsTable.$inferSelect;
