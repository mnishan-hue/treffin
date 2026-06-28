import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const modAuditLogTable = pgTable("mod_audit_log", {
  id: serial("id").primaryKey(),
  adminIdentifier: text("admin_identifier"),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: integer("target_id").notNull(),
  reason: text("reason"),
  meta: text("meta"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertModAuditLogSchema = createInsertSchema(modAuditLogTable).omit({ id: true, createdAt: true });
export type InsertModAuditLog = z.infer<typeof insertModAuditLogSchema>;
export type ModAuditLog = typeof modAuditLogTable.$inferSelect;
