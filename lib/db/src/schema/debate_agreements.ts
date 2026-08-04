import { pgTable, serial, text, integer, timestamp, unique, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { debatesTable } from "./debates";
import { usersTable } from "./users";

export const debateAgreementsTable = pgTable(
  "debate_agreements",
  {
    id: serial("id").primaryKey(),
    debateId: integer("debate_id")
      .notNull()
      .references(() => debatesTable.id, { onDelete: "cascade" }),
    // authorId stores the Clerk user ID (clerk_id), consistent with the auth
    // identity model used across all other tables in this codebase (e.g. comments,
    // posts). The column is named authorId rather than userId to make the role
    // (author of this agreement) explicit and avoid ambiguity with voter ids.
    authorId: text("author_id")
      .notNull()
      .references(() => usersTable.clerkId, { onDelete: "cascade" }),
    authorName: text("author_name").notNull(),
    text: text("text").notNull(),
    upvotes: integer("upvotes").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [check("text_length_check", sql`length(${t.text}) <= 280`)]
);

export const debateAgreementUpvotesTable = pgTable(
  "debate_agreement_upvotes",
  {
    id: serial("id").primaryKey(),
    agreementId: integer("agreement_id")
      .notNull()
      .references(() => debateAgreementsTable.id, { onDelete: "cascade" }),
    // userId stores the Clerk user ID of the upvoter (FK to users.clerk_id)
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.clerkId, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("uniq_agreement_user").on(t.agreementId, t.userId)]
);

export const insertDebateAgreementSchema = createInsertSchema(debateAgreementsTable).omit({
  id: true,
  upvotes: true,
  createdAt: true,
});
export type InsertDebateAgreement = z.infer<typeof insertDebateAgreementSchema>;
export type DebateAgreement = typeof debateAgreementsTable.$inferSelect;
export type DebateAgreementUpvote = typeof debateAgreementUpvotesTable.$inferSelect;
