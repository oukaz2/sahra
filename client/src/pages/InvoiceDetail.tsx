import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Download, CheckCircle2, Leaf, Zap, Building2, User, Share2, Copy } from "lucide-react";

function fmtEgp(n: number) {
  return new Intl.NumberFormat("en-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}
function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-EG", { day: "numeric", month: "long", year: "numeric" });
}

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const { data: inv, isLoading } = useQuery<any>({
    queryKey: ["/api/invoices", id],
    queryFn: () => apiRequest("GET", `/api/invoices/${id}`).then(r => r.json()),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) =>
      apiRequest("PATCH", `/api/invoices/${id}/status`, { status }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices-all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Invoice updated" });
    },
  });

  const handleCopyPayLink = () => {
    const base = window.location.href.replace(/#.*$/, "");
    const link = `${base}#/pay/${id}`;
    navigator.clipboard.writeText(link).then(() => {
      toast({ title: "Payment link copied", description: "Share this link with your tenant to collect payment." });
    }).catch(() => {
      // Fallback: show the link in a prompt
      window.prompt("Copy this payment link:", link);
    });
  };

  const handleDownloadPDF = () => {
    if (!inv) return;
    import("jspdf").then(({ default: jsPDF }) => {
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const W = 210;
      const margin = 20;
      const col2 = W - margin;
      const hasSolar = inv.solarCreditEgp > 0;

      // ── Header ──────────────────────────────────────────────────
      doc.setFillColor(28, 28, 40);
      doc.rect(0, 0, W, 48, "F");
      doc.setTextColor(255, 185, 60);
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("SAHRA", margin, 22);
      doc.setTextColor(160, 160, 185);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("Solar Billing Engine  |  sahra.energy", margin, 31);
      doc.setTextColor(255, 185, 60);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("INVOICE", col2, 20, { align: "right" });
      doc.setTextColor(200, 200, 220);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(inv.invoiceNumber, col2, 28, { align: "right" });
      doc.text(`Issued: ${fmtDate(inv.issuedAt)}`, col2, 35, { align: "right" });

      // ── Billed To / Property ─────────────────────────────────────
      let y = 62;
      doc.setTextColor(100, 100, 115);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("BILLED TO", margin, y);
      doc.text("PROPERTY", W / 2 + 5, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(25, 25, 35);
      doc.text(inv.tenant?.name ?? "-", margin, y);
      doc.text(inv.property?.name ?? "-", W / 2 + 5, y);
      doc.setFontSize(8.5);
      doc.setTextColor(100, 100, 115);
      doc.text(`Unit: ${inv.tenant?.unit ?? "-"}`, margin, y + 5);
      doc.text(inv.property?.location ?? "-", W / 2 + 5, y + 5);
      doc.text(`Meter: ${inv.tenant?.meterCode ?? "-"}`, margin, y + 10);
      doc.text(`Billing Period: ${inv.period?.label ?? "-"}`, W / 2 + 5, y + 10);

      // ── Section: Tariff Breakdown ─────────────────────────────────
      y += 22;
      doc.setDrawColor(220, 220, 230);
      doc.line(margin, y, col2, y);
      y += 7;

      // Table header
      doc.setFillColor(245, 245, 250);
      doc.rect(margin, y - 3, col2 - margin, 7, "F");
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(80, 80, 100);
      doc.text("TARIFF BRACKET", margin + 2, y + 2);
      doc.text("kWh", 120, y + 2, { align: "right" });
      doc.text("RATE (EGP/kWh)", 155, y + 2, { align: "right" });
      doc.text("AMOUNT (EGP)", col2 - 1, y + 2, { align: "right" });
      y += 9;

      // Calculate tier breakdown
      const tiers = [
        { label: "Tier 1: 0 - 200 kWh", from: 0, to: 200, rate: 0.92 },
        { label: "Tier 2: 201 - 350 kWh", from: 200, to: 350, rate: 1.17 },
        { label: "Tier 3: 351 - 650 kWh", from: 350, to: 650, rate: 1.63 },
        { label: "Tier 4: 651 - 1000 kWh", from: 650, to: 1000, rate: 2.19 },
        { label: "Tier 5: > 1000 kWh", from: 1000, to: Infinity, rate: 2.59 },
      ];
      const kwh = inv.consumptionKwh;
      let remaining = kwh;
      let rowAlt = false;
      tiers.forEach(tier => {
        const used = Math.min(Math.max(remaining, 0), tier.to - tier.from);
        remaining -= used;
        if (used <= 0) return;
        const amt = used * tier.rate;
        if (rowAlt) { doc.setFillColor(250, 250, 253); doc.rect(margin, y - 3, col2 - margin, 6, "F"); }
        rowAlt = !rowAlt;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(40, 40, 55);
        doc.text(tier.label, margin + 2, y + 1);
        doc.setTextColor(80, 80, 100);
        doc.text(used.toFixed(0), 120, y + 1, { align: "right" });
        doc.text(tier.rate.toFixed(2), 155, y + 1, { align: "right" });
        doc.setTextColor(40, 40, 55);
        doc.text(fmtEgp(amt), col2 - 1, y + 1, { align: "right" });
        y += 6;
      });

      // Subtotal grid cost
      doc.setDrawColor(210, 210, 220);
      doc.line(margin, y, col2, y);
      y += 5;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(40, 40, 55);
      doc.text(`Total Grid Cost (${kwh.toLocaleString()} kWh)`, margin + 2, y);
      doc.text(`${fmtEgp(inv.gridChargeEgp)} EGP`, col2 - 1, y, { align: "right" });
      y += 8;

      // ── Solar Credit (conditional) ────────────────────────────────
      if (hasSolar) {
        doc.setFillColor(255, 251, 235);
        doc.rect(margin, y - 3, col2 - margin, 14, "F");
        doc.setDrawColor(230, 170, 60);
        doc.rect(margin, y - 3, col2 - margin, 14, "S");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(40, 40, 55);
        doc.text("Solar Credit", margin + 3, y + 2);
        doc.setTextColor(170, 95, 0);
        doc.text(`-${fmtEgp(inv.solarCreditEgp)} EGP`, col2 - 1, y + 2, { align: "right" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(130, 95, 25);
        doc.text(`${inv.solarShareKwh.toFixed(1)} kWh from on-site solar plant  |  ${inv.property?.discountPct ?? 15}% tenant discount applied`, margin + 3, y + 8);
        y += 18;
      }

      // ── Total Due ─────────────────────────────────────────────────
      doc.setDrawColor(180, 180, 195);
      doc.line(margin, y, col2, y);
      y += 6;
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(25, 25, 35);
      doc.text("TOTAL DUE", margin + 2, y);
      doc.setTextColor(20, 110, 45);
      doc.text(`${fmtEgp(inv.totalDueEgp)} EGP`, col2 - 1, y, { align: "right" });
      y += 10;

      // ── Savings callout (solar only, no emoji) ────────────────────
      if (hasSolar) {
        const savings = inv.gridChargeEgp - inv.totalDueEgp;
        doc.setFillColor(255, 248, 225);
        doc.setDrawColor(255, 185, 60);
        doc.roundedRect(margin, y, col2 - margin, 16, 2, 2, "FD");
        doc.setTextColor(120, 70, 0);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(`>> Solar savings this month: ${fmtEgp(savings)} EGP`, margin + 4, y + 6);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text(`${inv.solarShareKwh.toFixed(1)} kWh of your consumption was covered by the on-site solar plant`, margin + 4, y + 12);
        y += 20;
      }

      // ── Status ────────────────────────────────────────────────────
      y += 2;
      const statusColor: Record<string, [number, number, number]> = {
        paid: [25, 110, 45], unpaid: [150, 110, 0], overdue: [180, 40, 40]
      };
      const sc = statusColor[inv.status] ?? [100, 100, 100];
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...sc);
      doc.text(`Status: ${inv.status.toUpperCase()}${inv.status === "paid" && inv.paidAt ? `  |  Paid on ${fmtDate(inv.paidAt)}` : ""}`, margin, y);

      // ── Footer ────────────────────────────────────────────────────
      doc.setDrawColor(210, 210, 225);
      doc.line(margin, 275, col2, 275);
      doc.setTextColor(150, 150, 165);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.text("Sahra  |  Solar Billing Engine  |  sahra.energy", margin, 280);
      doc.text("Generated automatically by the Sahra platform.", col2, 280, { align: "right" });

      doc.save(`${inv.invoiceNumber}.pdf`);
      toast({ title: "Invoice downloaded" });
    });
  };

  if (isLoading) return (
    <div className="space-y-4 max-w-2xl">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-96 w-full rounded-lg" />
    </div>
  );

  if (!inv) return <div className="text-muted-foreground text-sm">Invoice not found.</div>;

  const savings = inv.gridChargeEgp - inv.totalDueEgp;
  const solarPct = inv.consumptionKwh > 0 ? Math.round((inv.solarShareKwh / inv.consumptionKwh) * 100) : 0;

  return (
    <div className="max-w-2xl space-y-5">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Invoice</p>
          <h1 className="text-xl font-semibold font-mono">{inv.invoiceNumber}</h1>
        </div>
        <div className="flex items-center gap-2">
          {inv.status !== "paid" && (
            <Button size="sm" variant="outline" onClick={() => statusMutation.mutate("paid")}
              disabled={statusMutation.isPending} data-testid="button-mark-paid">
              <CheckCircle2 size={13} className="mr-1.5" /> Mark as Paid
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={handleCopyPayLink} data-testid="button-copy-pay-link">
            <Share2 size={13} className="mr-1.5" /> Send to Tenant
          </Button>
          <Button size="sm" onClick={handleDownloadPDF} data-testid="button-download-pdf">
            <Download size={13} className="mr-1.5" /> Download PDF
          </Button>
        </div>
      </div>

      {/* Invoice card */}
      <Card className="overflow-hidden">
        {/* Dark header */}
        <div className="px-6 py-5" style={{ background: "hsl(222 28% 11%)" }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg font-bold" style={{ color: "hsl(38 88% 52%)" }}>SAHRA</span>
                <span className="text-xs" style={{ color: "hsl(220 15% 55%)" }}>Solar Billing Engine</span>
              </div>
              <p className="text-xs" style={{ color: "hsl(220 15% 45%)" }}>sahra.energy</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold font-mono" style={{ color: "hsl(38 88% 52%)" }}>{inv.invoiceNumber}</p>
              <p className="text-xs" style={{ color: "hsl(220 15% 55%)" }}>Issued {fmtDate(inv.issuedAt)}</p>
              <Badge variant="outline" className={`mt-1 text-xs badge-${inv.status}`}>{inv.status}</Badge>
            </div>
          </div>
        </div>

        <CardContent className="p-6 space-y-5">
          {/* Parties */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1"><User size={11} /> Billed To</p>
              <p className="font-medium text-sm">{inv.tenant?.name}</p>
              <p className="text-xs text-muted-foreground">{inv.tenant?.unit}</p>
              <p className="text-xs text-muted-foreground font-mono">Meter: {inv.tenant?.meterCode}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1"><Building2 size={11} /> Property</p>
              <p className="font-medium text-sm">{inv.property?.name}</p>
              <p className="text-xs text-muted-foreground">{inv.property?.location}</p>
              <p className="text-xs text-muted-foreground">Period: {inv.period?.label}</p>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-border" />

          {/* Breakdown */}
          <div className="space-y-2">
            {/* Grid cost row */}
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">Standard Grid Cost</p>
                <p className="text-xs text-muted-foreground">{inv.consumptionKwh.toLocaleString()} kWh · Egyptian tiered tariff</p>
              </div>
              <p className="text-sm font-semibold tabular">{fmtEgp(inv.gridChargeEgp)} EGP</p>
            </div>

            {/* Solar credit row — only shown if solar credit exists */}
            {inv.solarCreditEgp > 0 && (
              <div className="flex items-center justify-between py-2 rounded-lg px-3"
                style={{ background: "hsl(38 92% 44% / 0.08)", border: "1px solid hsl(38 92% 44% / 0.2)" }}>
                <div>
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <Leaf size={13} className="text-amber-600 dark:text-amber-400" />
                    Solar Credit
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {inv.solarShareKwh.toLocaleString()} kWh from solar · {inv.property?.discountPct ?? 15}% discount
                  </p>
                </div>
                <p className="text-sm font-semibold tabular text-amber-600 dark:text-amber-400">-{fmtEgp(inv.solarCreditEgp)} EGP</p>
              </div>
            )}
          </div>

          {/* Total */}
          <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: "hsl(var(--border))" }}>
            <p className="text-base font-bold">Total Due</p>
            <p className="text-xl font-bold tabular">{fmtEgp(inv.totalDueEgp)} EGP</p>
          </div>

          {/* Savings callout — only shown when solar credit exists */}
          {inv.solarCreditEgp > 0 && <div className="rounded-lg px-4 py-3 flex items-center gap-3"
            style={{ background: "hsl(38 92% 44% / 0.08)", border: "1px solid hsl(38 92% 44% / 0.2)" }}>
            <Zap size={18} className="text-amber-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                You saved {fmtEgp(savings)} EGP this month
              </p>
              <p className="text-xs text-muted-foreground">
                {solarPct}% of your consumption ({inv.solarShareKwh.toLocaleString()} kWh) came from the on-site solar plant
              </p>
            </div>
          </div>}

          {/* Payment status */}
          {inv.status === "paid" && inv.paidAt && (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
              <CheckCircle2 size={14} /> Paid on {fmtDate(inv.paidAt)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
