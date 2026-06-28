import { pgTable, serial, integer, text, timestamp, unique, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { debatesTable } from "./debates";

export const debateParticipantVotesTable = pgTable(
  "debate_participant_votes",
  {
    id: serial("id").primaryKey(),
    debateId: integer("debate_id")
      .notNull()
      .references(() => debatesTable.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    side: text("side").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique("participant_debate_user_unique").on(table.debateId, table.userId),
    check("side_check", sql`${table.side} IN ('support', 'against')`),
  ]
);

export type DebateParticipantVote = typeof debateParticipantVotesTable.$inferSelect;
