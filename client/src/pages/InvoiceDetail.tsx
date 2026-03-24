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
    // Dynamic import to keep bundle size reasonable
    import("jspdf").then(({ default: jsPDF }) => {
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const W = 210;
      const margin = 20;

      // Header background
      doc.setFillColor(38, 38, 48);
      doc.rect(0, 0, W, 45, "F");

      // Sahra brand name
      doc.setTextColor(255, 185, 60);
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("SAHRA", margin, 22);

      doc.setTextColor(180, 180, 200);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("Solar Billing Engine · sahra.energy", margin, 30);

      // Invoice badge
      doc.setTextColor(255, 185, 60);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("INVOICE", W - margin - 30, 20);

      doc.setTextColor(200, 200, 220);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(inv.invoiceNumber, W - margin - 30, 28);
      doc.text(`Issued: ${fmtDate(inv.issuedAt)}`, W - margin - 30, 34);

      // Property + Tenant info
      let y = 60;
      doc.setTextColor(60, 60, 70);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("BILLED TO", margin, y);
      doc.text("PROPERTY", W / 2, y);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      y += 6;
      doc.setTextColor(30, 30, 40);
      doc.text(inv.tenant?.name ?? "—", margin, y);
      doc.text(inv.property?.name ?? "—", W / 2, y);
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 110);
      doc.text(`Unit: ${inv.tenant?.unit ?? "—"}`, margin, y + 5);
      doc.text(inv.property?.location ?? "—", W / 2, y + 5);
      doc.text(`Meter: ${inv.tenant?.meterCode ?? "—"}`, margin, y + 10);
      doc.text(`Period: ${inv.period?.label ?? "—"}`, W / 2, y + 10);

      // Divider
      y += 24;
      doc.setDrawColor(220, 220, 230);
      doc.line(margin, y, W - margin, y);

      // Breakdown table header
      y += 8;
      doc.setFillColor(248, 248, 252);
      doc.rect(margin, y - 4, W - 2 * margin, 8, "F");
      doc.setTextColor(80, 80, 95);
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.text("DESCRIPTION", margin + 2, y + 1);
      doc.text("AMOUNT (EGP)", W - margin - 2, y + 1, { align: "right" });

      // Row 1: Standard Grid Cost
      y += 12;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(40, 40, 50);
      doc.setFontSize(9.5);
      doc.text("Standard Grid Cost", margin + 2, y);
      doc.text(`${fmtEgp(inv.gridChargeEgp)}`, W - margin - 2, y, { align: "right" });
      doc.setTextColor(110, 110, 120);
      doc.setFontSize(8);
      doc.text(`${inv.consumptionKwh.toLocaleString()} kWh consumed · Egyptian tiered tariff`, margin + 2, y + 5);

      // Row 2: Solar Credit
      y += 14;
      doc.setFillColor(255, 251, 235);
      doc.rect(margin, y - 4, W - 2 * margin, 12, "F");
      doc.setTextColor(40, 40, 50);
      doc.setFontSize(9.5);
      doc.setFont("helvetica", "normal");
      doc.text("Solar Credit", margin + 2, y);
      doc.setTextColor(180, 100, 0);
      doc.setFont("helvetica", "bold");
      doc.text(`-${fmtEgp(inv.solarCreditEgp)}`, W - margin - 2, y, { align: "right" });
      doc.setTextColor(130, 100, 30);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`${inv.solarShareKwh.toLocaleString()} kWh from ${inv.property?.name} solar plant · ${inv.property?.discountPct ?? 15}% discount`, margin + 2, y + 5);

      // Total
      y += 18;
      doc.setDrawColor(200, 200, 210);
      doc.line(margin, y, W - margin, y);
      y += 8;
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 30, 40);
      doc.text("TOTAL DUE", margin + 2, y);
      doc.setTextColor(38, 92, 44);
      doc.text(`${fmtEgp(inv.totalDueEgp)} EGP`, W - margin - 2, y, { align: "right" });

      // Savings callout box
      y += 16;
      const savings = inv.gridChargeEgp - inv.totalDueEgp;
      doc.setFillColor(255, 248, 225);
      doc.setDrawColor(255, 185, 60);
      doc.roundedRect(margin, y, W - 2 * margin, 18, 2, 2, "FD");
      doc.setTextColor(120, 70, 0);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(`🌞 You saved ${fmtEgp(savings)} EGP this month thanks to solar energy`, margin + 6, y + 7);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`${inv.solarShareKwh.toLocaleString()} kWh of your consumption was covered by the on-site solar plant`, margin + 6, y + 13);

      // Status
      y += 26;
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      const statusColor: Record<string, [number, number, number]> = {
        paid: [34, 120, 50], unpaid: [160, 120, 0], overdue: [180, 40, 40]
      };
      const sc = statusColor[inv.status] ?? [100, 100, 100];
      doc.setTextColor(...sc);
      doc.text(`Status: ${inv.status.toUpperCase()}${inv.status === "paid" && inv.paidAt ? ` · Paid on ${fmtDate(inv.paidAt)}` : ""}`, margin, y);

      // Footer
      y = 268;
      doc.setDrawColor(220, 220, 230);
      doc.line(margin, y, W - margin, y);
      y += 6;
      doc.setTextColor(150, 150, 160);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.text("Sahra · Solar Billing Engine · sahra.energy", margin, y);
      doc.text("This invoice is generated automatically by the Sahra platform.", W - margin, y, { align: "right" });

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
