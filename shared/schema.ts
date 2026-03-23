import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Properties ──────────────────────────────────────────────────────────────
export const properties = sqliteTable("properties", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  location: text("location").notNull(),
  solarCapacityKw: real("solar_capacity_kw").notNull(),
  tenantCount: integer("tenant_count").notNull().default(0),
  discountPct: real("discount_pct").notNull().default(15), // solar discount %
  status: text("status").notNull().default("active"), // active | inactive
});

export const insertPropertySchema = createInsertSchema(properties).omit({ id: true });
export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type Property = typeof properties.$inferSelect;

// ─── Tenants ─────────────────────────────────────────────────────────────────
export const tenants = sqliteTable("tenants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  propertyId: integer("property_id").notNull().references(() => properties.id),
  name: text("name").notNull(),
  unit: text("unit").notNull(), // e.g. "Shop 14", "Unit A3"
  meterCode: text("meter_code").notNull(),
  email: text("email"),
  phone: text("phone"),
  status: text("status").notNull().default("active"),
});

export const insertTenantSchema = createInsertSchema(tenants).omit({ id: true });
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenants.$inferSelect;

// ─── Billing Periods ─────────────────────────────────────────────────────────
export const billingPeriods = sqliteTable("billing_periods", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  propertyId: integer("property_id").notNull().references(() => properties.id),
  label: text("label").notNull(), // e.g. "February 2026"
  month: integer("month").notNull(), // 1-12
  year: integer("year").notNull(),
  totalGridKwh: real("total_grid_kwh").notNull().default(0),
  totalSolarKwh: real("total_solar_kwh").notNull().default(0),
  status: text("status").notNull().default("draft"), // draft | issued | closed
  createdAt: integer("created_at").notNull().$defaultFn(() => Date.now()),
});

export const insertBillingPeriodSchema = createInsertSchema(billingPeriods).omit({ id: true, createdAt: true });
export type InsertBillingPeriod = z.infer<typeof insertBillingPeriodSchema>;
export type BillingPeriod = typeof billingPeriods.$inferSelect;

// ─── Meter Readings ───────────────────────────────────────────────────────────
export const meterReadings = sqliteTable("meter_readings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  billingPeriodId: integer("billing_period_id").notNull().references(() => billingPeriods.id),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  consumptionKwh: real("consumption_kwh").notNull(),
  // Calculated fields stored for audit
  solarShareKwh: real("solar_share_kwh").notNull().default(0),
  gridChargeEgp: real("grid_charge_egp").notNull().default(0),
  solarCreditEgp: real("solar_credit_egp").notNull().default(0),
  totalDueEgp: real("total_due_egp").notNull().default(0),
});

export const insertMeterReadingSchema = createInsertSchema(meterReadings).omit({ id: true });
export type InsertMeterReading = z.infer<typeof insertMeterReadingSchema>;
export type MeterReading = typeof meterReadings.$inferSelect;

// ─── Invoices ─────────────────────────────────────────────────────────────────
export const invoices = sqliteTable("invoices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  billingPeriodId: integer("billing_period_id").notNull().references(() => billingPeriods.id),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  meterReadingId: integer("meter_reading_id").notNull().references(() => meterReadings.id),
  invoiceNumber: text("invoice_number").notNull(), // SAH-2026-001
  consumptionKwh: real("consumption_kwh").notNull(),
  solarShareKwh: real("solar_share_kwh").notNull(),
  gridChargeEgp: real("grid_charge_egp").notNull(),
  solarCreditEgp: real("solar_credit_egp").notNull(),
  totalDueEgp: real("total_due_egp").notNull(),
  status: text("status").notNull().default("unpaid"), // unpaid | paid | overdue
  paymentRef: text("payment_ref"), // Paymob/Fawry reference
  issuedAt: integer("issued_at").notNull().$defaultFn(() => Date.now()),
  paidAt: integer("paid_at"),
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, issuedAt: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;
