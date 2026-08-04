import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";

/**
 * Per-axis winner declarations for elegance-battle debates.
 * The creator-moderator can declare a winner for each axis (elegant / clear / rigorous / efficient / overall).
 * At most one declaration per axis per debate (upserted on re-declaration).
 */
export const debateAxisWinnersTable = pgTable(
  "debate_axis_winners",
  {
    id: serial("id").primaryKey(),
    debateId: integer("debate_id").notNull(),
    axis: text("axis").notNull(), // "elegant" | "clear" | "rigorous" | "efficient" | "overall"
    declaration: text("declaration").notNull(), // free-text description of which approach/solution won
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("debate_axis_winners_debate_axis_unique").on(t.debateId, t.axis),
  ],
);

export type DebateAxisWinner = typeof debateAxisWinnersTable.$inferSelect;
