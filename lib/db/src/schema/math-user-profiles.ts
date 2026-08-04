import { pgTable, serial, text, timestamp, integer, index } from "drizzle-orm/pg-core";

export const mathUserProfilesTable = pgTable(
  "math_user_profiles",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().unique(),
    displayName: text("display_name").notNull(),
    bio: text("bio"),
    favoriteCategory: text("favorite_category"),
    totalProblems: integer("total_problems").notNull().default(0),
    totalSolutions: integer("total_solutions").notNull().default(0),
    totalReactionsReceived: integer("total_reactions_received").notNull().default(0),
    reputationScore: integer("reputation_score").notNull().default(0),
    streak: integer("streak").notNull().default(0),
    lastActiveAt: timestamp("last_active_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("math_user_profiles_rep_idx").on(t.reputationScore),
    index("math_user_profiles_user_idx").on(t.userId),
  ],
);
