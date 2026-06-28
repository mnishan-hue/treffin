import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id").unique(),
  name: text("name").notNull(),
  title: text("title").notNull(),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  reputationScore: integer("reputation_score").notNull().default(0),
  followers: integer("followers").notNull().default(0),
  following: integer("following").notNull().default(0),
  debatesJoined: integer("debates_joined").notNull().default(0),
  articlesPublished: integer("articles_published").notNull().default(0),
  isVerified: boolean("is_verified").notNull().default(false),
  streakDays: integer("streak_days").notNull().default(0),
  interests: text("interests").array(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  emailVerified: boolean("email_verified").notNull().default(false),
  reportCount: integer("report_count").notNull().default(0),
  isSuspended: boolean("is_suspended").notNull().default(false),
  suspendedReason: text("suspended_reason"),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
