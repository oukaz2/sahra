import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and } from "drizzle-orm";
import {
  properties, tenants, billingPeriods, meterReadings, invoices,
  type Property, type InsertProperty,
  type Tenant, type InsertTenant,
  type BillingPeriod, type InsertBillingPeriod,
  type MeterReading, type InsertMeterReading,
  type Invoice, type InsertInvoice,
} from "@shared/schema";

// On Vercel serverless, only /tmp is writable. Use it in production.
const dbPath = process.env.VERCEL
  ? "/tmp/sahra.db"
  : process.env.DB_PATH ?? "sahra.db";
const sqlite = new Database(dbPath);
export const db = drizzle(sqlite);

// Auto-migrate: create tables if not exist
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    solar_capacity_kw REAL NOT NULL,
    tenant_count INTEGER NOT NULL DEFAULT 0,
    discount_pct REAL NOT NULL DEFAULT 15,
    status TEXT NOT NULL DEFAULT 'active'
  );
  CREATE TABLE IF NOT EXISTS tenants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER NOT NULL REFERENCES properties(id),
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    meter_code TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    status TEXT NOT NULL DEFAULT 'active'
  );
  CREATE TABLE IF NOT EXISTS billing_periods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER NOT NULL REFERENCES properties(id),
    label TEXT NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    total_grid_kwh REAL NOT NULL DEFAULT 0,
    total_solar_kwh REAL NOT NULL DEFAULT 0,
    eehc_bill_egp REAL,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS meter_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    billing_period_id INTEGER NOT NULL REFERENCES billing_periods(id),
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    consumption_kwh REAL NOT NULL,
    solar_share_kwh REAL NOT NULL DEFAULT 0,
    grid_charge_egp REAL NOT NULL DEFAULT 0,
    solar_credit_egp REAL NOT NULL DEFAULT 0,
    total_due_egp REAL NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    billing_period_id INTEGER NOT NULL REFERENCES billing_periods(id),
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    meter_reading_id INTEGER NOT NULL REFERENCES meter_readings(id),
    invoice_number TEXT NOT NULL,
    consumption_kwh REAL NOT NULL,
    solar_share_kwh REAL NOT NULL,
    grid_charge_egp REAL NOT NULL,
    solar_credit_egp REAL NOT NULL,
    total_due_egp REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'unpaid',
    payment_ref TEXT,
    issued_at INTEGER NOT NULL,
    paid_at INTEGER
  );
`);

// Safe migration: add new columns to existing DBs without breaking them
try { sqlite.exec(`ALTER TABLE billing_periods ADD COLUMN eehc_bill_egp REAL`); } catch (_) {}

export interface IStorage {
  // Properties
  getProperties(): Property[];
  getProperty(id: number): Property | undefined;
  createProperty(data: InsertProperty): Property;
  updatePropertyTenantCount(id: number, count: number): void;

  // Tenants
  getTenantsByProperty(propertyId: number): Tenant[];
  getTenant(id: number): Tenant | undefined;
  createTenant(data: InsertTenant): Tenant;

  // Billing Periods
  getBillingPeriods(propertyId: number): BillingPeriod[];
  getBillingPeriod(id: number): BillingPeriod | undefined;
  createBillingPeriod(data: InsertBillingPeriod): BillingPeriod;
  updateBillingPeriod(id: number, data: Partial<BillingPeriod>): BillingPeriod | undefined;

  // Meter Readings
  getMeterReadings(billingPeriodId: number): MeterReading[];
  createMeterReading(data: InsertMeterReading): MeterReading;

  // Invoices
  getInvoices(billingPeriodId: number): Invoice[];
  getAllInvoices(propertyId?: number): Invoice[];
  getInvoice(id: number): Invoice | undefined;
  createInvoice(data: InsertInvoice): Invoice;
  updateInvoiceStatus(id: number, status: string, paidAt?: number): Invoice | undefined;

  // Seed
  seedDemoData(): void;
}

export class SqliteStorage implements IStorage {
  getProperties(): Property[] {
    return db.select().from(properties).all();
  }

  getProperty(id: number): Property | undefined {
    return db.select().from(properties).where(eq(properties.id, id)).get();
  }

  createProperty(data: InsertProperty): Property {
    return db.insert(properties).values(data).returning().get();
  }

  updatePropertyTenantCount(id: number, count: number): void {
    db.update(properties).set({ tenantCount: count }).where(eq(properties.id, id)).run();
  }

  getTenantsByProperty(propertyId: number): Tenant[] {
    return db.select().from(tenants).where(eq(tenants.propertyId, propertyId)).all();
  }

  getTenant(id: number): Tenant | undefined {
    return db.select().from(tenants).where(eq(tenants.id, id)).get();
  }

  createTenant(data: InsertTenant): Tenant {
    return db.insert(tenants).values(data).returning().get();
  }

  getBillingPeriods(propertyId: number): BillingPeriod[] {
    return db.select().from(billingPeriods).where(eq(billingPeriods.propertyId, propertyId)).all();
  }

  getBillingPeriod(id: number): BillingPeriod | undefined {
    return db.select().from(billingPeriods).where(eq(billingPeriods.id, id)).get();
  }

  createBillingPeriod(data: InsertBillingPeriod): BillingPeriod {
    const toInsert = { ...data, createdAt: Date.now() };
    return db.insert(billingPeriods).values(toInsert).returning().get();
  }

  updateBillingPeriod(id: number, data: Partial<BillingPeriod>): BillingPeriod | undefined {
    return db.update(billingPeriods).set(data).where(eq(billingPeriods.id, id)).returning().get();
  }

  getMeterReadings(billingPeriodId: number): MeterReading[] {
    return db.select().from(meterReadings).where(eq(meterReadings.billingPeriodId, billingPeriodId)).all();
  }

  createMeterReading(data: InsertMeterReading): MeterReading {
    return db.insert(meterReadings).values(data).returning().get();
  }

  getInvoices(billingPeriodId: number): Invoice[] {
    return db.select().from(invoices).where(eq(invoices.billingPeriodId, billingPeriodId)).all();
  }

  getAllInvoices(propertyId?: number): Invoice[] {
    if (propertyId) {
      // Join through billing_periods
      const periods = db.select().from(billingPeriods).where(eq(billingPeriods.propertyId, propertyId)).all();
      const periodIds = periods.map(p => p.id);
      if (periodIds.length === 0) return [];
      return db.select().from(invoices).all().filter(inv => periodIds.includes(inv.billingPeriodId));
    }
    return db.select().from(invoices).all();
  }

  getInvoice(id: number): Invoice | undefined {
    return db.select().from(invoices).where(eq(invoices.id, id)).get();
  }

  createInvoice(data: InsertInvoice): Invoice {
    const toInsert = { ...data, issuedAt: Date.now() };
    return db.insert(invoices).values(toInsert).returning().get();
  }

  updateInvoiceStatus(id: number, status: string, paidAt?: number): Invoice | undefined {
    const updateData: Partial<Invoice> = { status };
    if (paidAt) updateData.paidAt = paidAt;
    return db.update(invoices).set(updateData).where(eq(invoices.id, id)).returning().get();
  }

  seedDemoData(): void {
    const existing = db.select().from(properties).all();
    if (existing.length > 0) return;

    // Property 1: D5M-style mall
    const prop1 = db.insert(properties).values({
      name: "Cairo Commerce Park",
      location: "New Cairo, Egypt",
      solarCapacityKw: 850,
      tenantCount: 0,
      discountPct: 15,
      status: "active",
    }).returning().get();

    // Property 2: Industrial park
    const prop2 = db.insert(properties).values({
      name: "6th October Industrial Hub",
      location: "6th of October City, Egypt",
      solarCapacityKw: 1200,
      tenantCount: 0,
      discountPct: 12,
      status: "active",
    }).returning().get();

    // Tenants for prop1
    const tenantData1 = [
      { name: "Al-Rashid Electronics", unit: "Shop 12", meterCode: "MTR-001", email: "ar@demo.com", phone: "+20 100 000 0001" },
      { name: "Noura Fashion", unit: "Shop 15", meterCode: "MTR-002", email: "nf@demo.com", phone: "+20 100 000 0002" },
      { name: "Cairo Café", unit: "Shop 22", meterCode: "MTR-003", email: "cc@demo.com", phone: "+20 100 000 0003" },
      { name: "TechZone", unit: "Shop 31", meterCode: "MTR-004", email: "tz@demo.com", phone: "+20 100 000 0004" },
      { name: "Pharaoh Pharma", unit: "Shop 44", meterCode: "MTR-005", email: "pp@demo.com", phone: "+20 100 000 0005" },
      { name: "Delta Textiles", unit: "Shop 51", meterCode: "MTR-006", email: "dt@demo.com", phone: "+20 100 000 0006" },
    ];

    const createdTenants1 = tenantData1.map(t =>
      db.insert(tenants).values({ ...t, propertyId: prop1.id, status: "active" }).returning().get()
    );
    db.update(properties).set({ tenantCount: createdTenants1.length }).where(eq(properties.id, prop1.id)).run();

    // Tenants for prop2
    const tenantData2 = [
      { name: "Nile Steel Co.", unit: "Unit A1", meterCode: "IND-001", email: "ns@demo.com", phone: "+20 100 000 0011" },
      { name: "Sphinx Plastics", unit: "Unit A2", meterCode: "IND-002", email: "sp@demo.com", phone: "+20 100 000 0012" },
      { name: "Pyramid Packaging", unit: "Unit B1", meterCode: "IND-003", email: "pp2@demo.com", phone: "+20 100 000 0013" },
      { name: "Desert Motors", unit: "Unit B3", meterCode: "IND-004", email: "dm@demo.com", phone: "+20 100 000 0014" },
    ];

    const createdTenants2 = tenantData2.map(t =>
      db.insert(tenants).values({ ...t, propertyId: prop2.id, status: "active" }).returning().get()
    );
    db.update(properties).set({ tenantCount: createdTenants2.length }).where(eq(properties.id, prop2.id)).run();

    // Billing period for prop1: February 2026
    const period1 = db.insert(billingPeriods).values({
      propertyId: prop1.id,
      label: "February 2026",
      month: 2,
      year: 2026,
      totalGridKwh: 48200,
      totalSolarKwh: 12400,
      status: "issued",
      createdAt: Date.now(),
    }).returning().get();

    // Egyptian tiered tariff helper (2024 rates)
    const calcTieredCost = (kwh: number): number => {
      // Residential tiered used as proxy for commercial sub-metering
      // Tier 1: 0-200 kWh → 0.92 EGP/kWh
      // Tier 2: 201-350 kWh → 1.17 EGP/kWh
      // Tier 3: 351-650 kWh → 1.63 EGP/kWh
      // Tier 4: 651-1000 kWh → 2.19 EGP/kWh
      // Tier 5: >1000 kWh → 2.59 EGP/kWh
      let cost = 0;
      if (kwh > 1000) { cost += (kwh - 1000) * 2.59; kwh = 1000; }
      if (kwh > 650)  { cost += (kwh - 650)  * 2.19; kwh = 650; }
      if (kwh > 350)  { cost += (kwh - 350)  * 1.63; kwh = 350; }
      if (kwh > 200)  { cost += (kwh - 200)  * 1.17; kwh = 200; }
      cost += kwh * 0.92;
      return Math.round(cost * 100) / 100;
    };

    // Demo consumption data (kWh per tenant for the period)
    const consumptions1 = [3200, 1800, 2100, 4500, 1200, 2800];
    const totalConsumption1 = consumptions1.reduce((a, b) => a + b, 0);
    const discountPct1 = prop1.discountPct / 100;
    const solarPct1 = period1.totalSolarKwh / totalConsumption1;

    const invoiceCounterBase = 1;
    createdTenants1.forEach((tenant, i) => {
      const consumption = consumptions1[i];
      const solarShare = Math.round(consumption * solarPct1 * 100) / 100;
      const gridCharge = calcTieredCost(consumption);
      const solarCredit = Math.round(gridCharge * (solarShare / consumption) * discountPct1 * 100) / 100;
      const totalDue = Math.round((gridCharge - solarCredit) * 100) / 100;

      const reading = db.insert(meterReadings).values({
        billingPeriodId: period1.id,
        tenantId: tenant.id,
        consumptionKwh: consumption,
        solarShareKwh: solarShare,
        gridChargeEgp: gridCharge,
        solarCreditEgp: solarCredit,
        totalDueEgp: totalDue,
      }).returning().get();

      const statuses = ["paid", "paid", "paid", "unpaid", "overdue", "unpaid"];
      const invNum = `SAH-2026-${String(invoiceCounterBase + i).padStart(3, "0")}`;
      db.insert(invoices).values({
        billingPeriodId: period1.id,
        tenantId: tenant.id,
        meterReadingId: reading.id,
        invoiceNumber: invNum,
        consumptionKwh: consumption,
        solarShareKwh: solarShare,
        gridChargeEgp: gridCharge,
        solarCreditEgp: solarCredit,
        totalDueEgp: totalDue,
        status: statuses[i],
        issuedAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
        paidAt: statuses[i] === "paid" ? Date.now() - 3 * 24 * 60 * 60 * 1000 : undefined,
      }).run();
    });

    // Billing period for prop1: March 2026 (draft)
    db.insert(billingPeriods).values({
      propertyId: prop1.id,
      label: "March 2026",
      month: 3,
      year: 2026,
      totalGridKwh: 0,
      totalSolarKwh: 0,
      status: "draft",
      createdAt: Date.now(),
    }).run();
  }
}

export const storage = new SqliteStorage();
storage.seedDemoData();
