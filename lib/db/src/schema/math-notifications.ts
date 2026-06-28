import { pgTable, serial, text, timestamp, integer, boolean, index } from "drizzle-orm/pg-core";

export const mathNotificationsTable = pgTable(
  "math_notifications",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    targetType: text("target_type"),
    targetId: integer("target_id"),
    fromUserId: text("from_user_id"),
    fromUserName: text("from_user_name"),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("math_notifications_user_idx").on(t.userId, t.isRead),
  ],
);
