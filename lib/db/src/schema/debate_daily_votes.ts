import { pgTable, serial, integer, text, unique } from "drizzle-orm/pg-core";
import { debatesTable } from "./debates";

export const debateDailyVotesTable = pgTable(
  "debate_daily_votes",
  {
    id: serial("id").primaryKey(),
    debateId: integer("debate_id")
      .notNull()
      .references(() => debatesTable.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    voteCount: integer("vote_count").notNull().default(0),
  },
  (table) => [unique("debate_date_unique").on(table.debateId, table.date)]
);

export type DebateDailyVote = typeof debateDailyVotesTable.$inferSelect;
