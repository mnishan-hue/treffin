import { pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";

export const debateRulesAcksTable = pgTable(
  "debate_rules_acks",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    acknowledgedAt: timestamp("acknowledged_at").notNull().defaultNow(),
  },
  (t) => [unique("rules_ack_user").on(t.userId)]
);

export type DebateRulesAck = typeof debateRulesAcksTable.$inferSelect;
