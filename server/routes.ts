import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertPropertySchema, insertTenantSchema, insertBillingPeriodSchema } from "@shared/schema";

// Egyptian tiered tariff calculation (2024 rates)
function calcTieredCost(kwh: number): number {
  let k = kwh;
  let cost = 0;
  if (k > 1000) { cost += (k - 1000) * 2.59; k = 1000; }
  if (k > 650)  { cost += (k - 650)  * 2.19; k = 650; }
  if (k > 350)  { cost += (k - 350)  * 1.63; k = 350; }
  if (k > 200)  { cost += (k - 200)  * 1.17; k = 200; }
  cost += k * 0.92;
  return Math.round(cost * 100) / 100;
}

export function registerRoutes(httpServer: Server, app: Express) {

  // Properties
  app.get("/api/properties", (_req, res) => {
    res.json(storage.getProperties());
  });

  app.get("/api/properties/:id", (req, res) => {
    const prop = storage.getProperty(Number(req.params.id));
    if (!prop) return res.status(404).json({ error: "Not found" });
    res.json(prop);
  });

  app.post("/api/properties", (req, res) => {
    const parsed = insertPropertySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
    const prop = storage.createProperty(parsed.data);
    res.status(201).json(prop);
  });

  // Tenants
  app.get("/api/properties/:propertyId/tenants", (req, res) => {
    const tenants = storage.getTenantsByProperty(Number(req.params.propertyId));
    res.json(tenants);
  });

  app.post("/api/properties/:propertyId/tenants", (req, res) => {
    const body = { ...req.body, propertyId: Number(req.params.propertyId) };
    const parsed = insertTenantSchema.safeParse(body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
    const tenant = storage.createTenant(parsed.data);
    const allTenants = storage.getTenantsByProperty(Number(req.params.propertyId));
    storage.updatePropertyTenantCount(Number(req.params.propertyId), allTenants.length);
    res.status(201).json(tenant);
  });

  // Billing Periods
  app.get("/api/properties/:propertyId/billing-periods", (req, res) => {
    const periods = storage.getBillingPeriods(Number(req.params.propertyId));
    res.json(periods);
  });

  app.get("/api/billing-periods/:id", (req, res) => {
    const period = storage.getBillingPeriod(Number(req.params.id));
    if (!period) return res.status(404).json({ error: "Not found" });
    res.json(period);
  });

  app.post("/api/properties/:propertyId/billing-periods", (req, res) => {
    const body = { ...req.body, propertyId: Number(req.params.propertyId) };
    const parsed = insertBillingPeriodSchema.safeParse(body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
    const period = storage.createBillingPeriod(parsed.data);
    res.status(201).json(period);
  });

  // Update EEHC bill for reconciliation
  app.patch("/api/billing-periods/:id/eehc", (req, res) => {
    const { eehcBillEgp } = req.body;
    const updated = storage.updateBillingPeriod(Number(req.params.id), { eehcBillEgp: Number(eehcBillEgp) });
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });

  // Settlement Engine
  app.post("/api/billing-periods/:id/settle", (req, res) => {
    const periodId = Number(req.params.id);
    const period = storage.getBillingPeriod(periodId);
    if (!period) return res.status(404).json({ error: "Billing period not found" });

    const prop = storage.getProperty(period.propertyId);
    if (!prop) return res.status(404).json({ error: "Property not found" });

    const { totalSolarKwh, readings } = req.body as {
      totalSolarKwh: number;
      readings: Array<{ tenantId: number; consumptionKwh: number }>;
    };

    if (!readings || readings.length === 0) {
      return res.status(400).json({ error: "No readings provided" });
    }

    const discountPct = prop.discountPct / 100;
    const totalConsumption = readings.reduce((s: number, r: any) => s + r.consumptionKwh, 0);
    const solarPct = Math.min(totalSolarKwh / totalConsumption, 1);

    const existingInvoices = storage.getAllInvoices(period.propertyId);
    let invoiceCounter = existingInvoices.length + 1;

    const created = readings.map((r: any) => {
      // Tier-jump fix: reduce kWh by solar share BEFORE tiered calc.
      // This correctly moves tenants into lower tiers when solar covers part
      // of their consumption — the most accurate representation of true savings.
      const solarShare = Math.round(r.consumptionKwh * solarPct * 100) / 100;
      const netKwh = Math.max(r.consumptionKwh - solarShare, 0);

      const grossGridCharge = calcTieredCost(r.consumptionKwh); // what they'd pay without solar
      const netGridCharge = calcTieredCost(netKwh);             // what they pay with solar

      // Solar credit = gross cost minus net cost, then apply the landlord's discount %
      // (the discount % represents the landlord's margin on solar — they don't pass 100% through)
      const rawCredit = Math.round((grossGridCharge - netGridCharge) * 100) / 100;
      const solarCredit = Math.round(rawCredit * discountPct * 100) / 100;

      const gridCharge = grossGridCharge; // shown on invoice as "what grid would cost"
      const totalDue = Math.round((netGridCharge + (rawCredit - solarCredit)) * 100) / 100;

      const reading = storage.createMeterReading({
        billingPeriodId: periodId,
        tenantId: r.tenantId,
        consumptionKwh: r.consumptionKwh,
        solarShareKwh: solarShare,
        gridChargeEgp: gridCharge,
        solarCreditEgp: solarCredit,
        totalDueEgp: totalDue,
      });

      const invNum = `SAH-${period.year}-${String(invoiceCounter++).padStart(3, "0")}`;
      return storage.createInvoice({
        billingPeriodId: periodId,
        tenantId: r.tenantId,
        meterReadingId: reading.id,
        invoiceNumber: invNum,
        consumptionKwh: r.consumptionKwh,
        solarShareKwh: solarShare,
        gridChargeEgp: gridCharge,
        solarCreditEgp: solarCredit,
        totalDueEgp: totalDue,
        status: "unpaid",
      });
    });

    storage.updateBillingPeriod(periodId, {
      totalSolarKwh,
      totalGridKwh: totalConsumption,
      status: "issued",
    });

    res.json({ invoices: created });
  });

  // Invoices
  app.get("/api/billing-periods/:id/invoices", (req, res) => {
    const invs = storage.getInvoices(Number(req.params.id));
    const enriched = invs.map(inv => {
      const tenant = storage.getTenant(inv.tenantId);
      return { ...inv, tenant };
    });
    res.json(enriched);
  });

  app.get("/api/invoices/:id", (req, res) => {
    const inv = storage.getInvoice(Number(req.params.id));
    if (!inv) return res.status(404).json({ error: "Not found" });
    const tenant = storage.getTenant(inv.tenantId);
    const period = storage.getBillingPeriod(inv.billingPeriodId);
    const prop = period ? storage.getProperty(period.propertyId) : null;
    res.json({ ...inv, tenant, period, property: prop });
  });

  app.patch("/api/invoices/:id/status", (req, res) => {
    const { status } = req.body;
    const paidAt = status === "paid" ? Date.now() : undefined;
    const updated = storage.updateInvoiceStatus(Number(req.params.id), status, paidAt);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });

  // Dashboard
  app.get("/api/dashboard", (_req, res) => {
    const props = storage.getProperties();
    const allInvoices = storage.getAllInvoices();

    const totalBilled = allInvoices.reduce((s, i) => s + i.totalDueEgp, 0);
    const totalCollected = allInvoices.filter(i => i.status === "paid").reduce((s, i) => s + i.totalDueEgp, 0);
    const totalOutstanding = allInvoices.filter(i => i.status !== "paid").reduce((s, i) => s + i.totalDueEgp, 0);
    const totalSolarCredits = allInvoices.reduce((s, i) => s + i.solarCreditEgp, 0);
    const totalTenants = props.reduce((s, p) => s + p.tenantCount, 0);
    const overdueCount = allInvoices.filter(i => i.status === "overdue").length;

    res.json({
      totalProperties: props.length,
      totalTenants,
      totalBilledEgp: Math.round(totalBilled * 100) / 100,
      totalCollectedEgp: Math.round(totalCollected * 100) / 100,
      totalOutstandingEgp: Math.round(totalOutstanding * 100) / 100,
      totalSolarCreditsEgp: Math.round(totalSolarCredits * 100) / 100,
      overdueCount,
      collectionRate: totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0,
    });
  });
}
