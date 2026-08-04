import { pgTable, serial, text, integer, boolean, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const communitiesTable = pgTable("communities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  emoji: text("emoji").notNull().default("💬"),
  category: text("category").notNull().default("General"),
  badge: text("badge").notNull().default(""),
  badgeColor: text("badge_color").notNull().default(""),
  gradient: text("gradient").notNull().default("from-violet-600/25 via-purple-900/15 to-card border-violet-500/25"),
  isPrivate: boolean("is_private").notNull().default(false),
  isLive: boolean("is_live").notNull().default(false),
  memberCount: integer("member_count").notNull().default(0),
  postsPerDay: integer("posts_per_day").notNull().default(0),
  totalPosts: integer("total_posts").notNull().default(0),
  creatorId: integer("creator_id"),
  rules: text("rules").array(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const communityMembersTable = pgTable("community_members", {
  communityId: integer("community_id").notNull().references(() => communitiesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull(),
  role: text("role").notNull().default("member"),
  status: text("status").notNull().default("member"),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.communityId, t.userId] })]);

export const insertCommunitySchema = createInsertSchema(communitiesTable).omit({ id: true, createdAt: true });
export const insertCommunityMemberSchema = createInsertSchema(communityMembersTable).omit({ joinedAt: true });

export type InsertCommunity = z.infer<typeof insertCommunitySchema>;
export type Community = typeof communitiesTable.$inferSelect;
export type CommunityMember = typeof communityMembersTable.$inferSelect;
