import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Generic key-value store for admin-configurable platform settings.
 * Each row is one setting; the value is always stored as text and cast
 * by the consumer (e.g. parseInt for numeric thresholds).
 */
export const appSettingsTable = pgTable("app_settings", {
  id:        serial("id").primaryKey(),
  key:       text("key").notNull().unique(),
  value:     text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: text("updated_by"),          // admin identifier for audit
});

export type AppSetting = typeof appSettingsTable.$inferSelect;
