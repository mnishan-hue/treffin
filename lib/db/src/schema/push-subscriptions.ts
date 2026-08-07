import { pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";

/**
 * Stores Web Push subscriptions per user device.
 * One row per browser/device — endpoint is globally unique per Push API spec.
 */
export const pushSubscriptionsTable = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  /** betterAuthId of the subscribing user */
  userId: text("user_id").notNull(),
  /** The push endpoint URL assigned by the browser's push service */
  endpoint: text("endpoint").notNull().unique(),
  /** Client ECDH public key (base64url) */
  p256dh: text("p256dh").notNull(),
  /** Auth secret (base64url) */
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("push_subscriptions_user_id_idx").on(t.userId),
]);

export type PushSubscriptionRow = typeof pushSubscriptionsTable.$inferSelect;
