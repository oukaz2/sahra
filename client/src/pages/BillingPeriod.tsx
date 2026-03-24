import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef } from "react";
import Papa from "papaparse";
import type { BillingPeriod as BP, Invoice, Tenant } from "@shared/schema";
import { Upload, FileText, Leaf, AlertTriangle, CheckCircle2, ArrowRight, Zap, Download, Building, TrendingUp, TrendingDown, Minus } from "lucide-react";

type EnrichedInvoice = Invoice & { tenant?: Tenant };

function fmt(n: number) {
  return new Intl.NumberFormat("en-EG", { maximumFractionDigits: 0 }).format(n);
}
function fmtEgp(n: number) {
  return `${new Intl.NumberFormat("en-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} EGP`;
}

export default function BillingPeriod() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [csvRows, setCsvRows] = useState<Array<{ tenantId: number; meterCode: string; name: string; consumptionKwh: number }>>([]);
  const [solarKwh, setSolarKwh] = useState("");
  const [eehcBill, setEehcBill] = useState("");
  const [eehcSaved, setEehcSaved] = useState(false);

  const { data: period, isLoading: periodLoading } = useQuery<BP>({
    queryKey: ["/api/billing-periods", id],
    queryFn: () => apiRequest("GET", `/api/billing-periods/${id}`).then(r => r.json()),
  });

  const { data: tenants } = useQuery<Tenant[]>({
    queryKey: ["/api/properties", period?.propertyId, "tenants"],
    queryFn: () => apiRequest("GET", `/api/properties/${period!.propertyId}/tenants`).then(r => r.json()),
    enabled: !!period?.propertyId,
  });

  // Get property for context
  const { data: invoices, isLoading: invoicesLoading, refetch: refetchInvoices } = useQuery<EnrichedInvoice[]>({
    queryKey: ["/api/billing-periods", id, "invoices"],
    queryFn: () => apiRequest("GET", `/api/billing-periods/${id}/invoices`).then(r => r.json()),
  });

  const settleMutation = useMutation({
    mutationFn: (payload: { totalSolarKwh: number; readings: Array<{ tenantId: number; consumptionKwh: number }> }) =>
      apiRequest("POST", `/api/billing-periods/${id}/settle`, payload).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing-periods", id, "invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Settlement complete", description: `${csvRows.length} invoices generated.` });
      setCsvRows([]);
      setSolarKwh("");
    },
    onError: () => toast({ title: "Settlement failed", variant: "destructive" }),
  });

  const eehcMutation = useMutation({
    mutationFn: (amount: number) =>
      apiRequest("PATCH", `/api/billing-periods/${id}/eehc`, { eehcBillEgp: amount }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing-periods", id] });
      setEehcSaved(true);
      setTimeout(() => setEehcSaved(false), 2000);
      toast({ title: "EEHC bill saved", description: "Reconciliation updated." });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ invId, status }: { invId: number; status: string }) =>
      apiRequest("PATCH", `/api/invoices/${invId}/status`, { status }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing-periods", id, "invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
  });

  const handleFileUpload = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as any[];
        // Expected CSV columns: meter_code, consumption_kwh (we'll try to match by meter code against tenants)
        const parsed = rows.map((r, i) => ({
          tenantId: Number(r.tenant_id || r.tenantId || 0),
          meterCode: String(r.meter_code || r.meterCode || ""),
          name: String(r.name || r.tenant_name || `Tenant ${i + 1}`),
          consumptionKwh: Number(r.consumption_kwh || r.consumptionKwh || 0),
        })).filter(r => r.consumptionKwh > 0);
        setCsvRows(parsed);
        toast({ title: `${parsed.length} readings loaded`, description: "Review and enter solar production to settle." });
      },
      error: () => toast({ title: "CSV parse error", variant: "destructive" }),
    });
  };

  const downloadCsvTemplate = () => {
    // Use real tenants if available, else generic placeholders
    const rows = tenants && tenants.length > 0
      ? tenants.map(t => ({ tenantId: t.id, meterCode: t.meterCode, name: t.name, consumptionKwh: 0 }))
      : [
          { tenantId: 1, meterCode: "MTR-001", name: "Tenant Name Here", consumptionKwh: 0 },
          { tenantId: 2, meterCode: "MTR-002", name: "Tenant Name Here", consumptionKwh: 0 },
        ];
    const header = "tenant_id,meter_code,name,consumption_kwh";
    const lines = rows.map(r => `${r.tenantId},${r.meterCode},${r.name},${r.consumptionKwh}`);
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sahra-readings-${period?.label?.replace(" ", "-") ?? "template"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSettle = () => {
    if (csvRows.length === 0) return;
    const readings = csvRows.map(r => ({ tenantId: r.tenantId, consumptionKwh: r.consumptionKwh }));
    settleMutation.mutate({ totalSolarKwh: solarKwh ? Number(solarKwh) : 0, readings });
  };

  const totalDue = invoices?.reduce((s, i) => s + i.totalDueEgp, 0) ?? 0;
  const totalCollected = invoices?.filter(i => i.status === "paid").reduce((s, i) => s + i.totalDueEgp, 0) ?? 0;
  const totalSolarCredit = invoices?.reduce((s, i) => s + i.solarCreditEgp, 0) ?? 0;
  const paidCount = invoices?.filter(i => i.status === "paid").length ?? 0;
  const overdueCount = invoices?.filter(i => i.status === "overdue").length ?? 0;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Billing Period</p>
          <h1 className="text-xl font-semibold">{period?.label ?? "Loading..."}</h1>
        </div>
        <div className="flex items-center gap-2">
          {period && (
            <Badge variant="outline" className={
              period.status === "issued" ? "badge-issued" :
              period.status === "closed" ? "badge-paid" : "badge-draft"
            }>
              {period.status}
            </Badge>
          )}
        </div>
      </div>

      {/* Summary KPIs (only if invoices exist) */}
      {invoices && invoices.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MiniKpi label="Total Billed" value={fmtEgp(totalDue)} />
          <MiniKpi label="Collected" value={fmtEgp(totalCollected)} accent="green" />
          <MiniKpi label="Solar Credits" value={fmtEgp(totalSolarCredit)} accent="amber" icon={<Leaf size={13} />} />
          <MiniKpi label="Paid / Total" value={`${paidCount} / ${invoices.length}`} accent={overdueCount > 0 ? "red" : undefined} />
        </div>
      )}

      {/* CSV Upload (only in draft) */}
      {(period?.status === "draft" || !invoices || invoices.length === 0) && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Upload size={15} /> Upload Meter Readings
              </CardTitle>
              {csvRows.length === 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                  onClick={downloadCsvTemplate}
                  data-testid="button-download-template"
                >
                  <Download size={12} /> Download Template
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Dropzone */}
            <div
              className={`dropzone ${dragOver ? "drag-over" : ""}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files[0];
                if (file) handleFileUpload(file);
              }}
              onClick={() => fileRef.current?.click()}
              data-testid="dropzone-csv"
            >
              <Upload size={24} className="mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Drop CSV file here or click to upload</p>
              <p className="text-xs text-muted-foreground mt-1">Columns: <code className="bg-muted px-1 py-0.5 rounded text-xs">tenant_id, meter_code, name, consumption_kwh</code></p>
              <input ref={fileRef} type="file" accept=".csv" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
            </div>

            {/* Or use demo button */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <Button
              variant="outline" size="sm" className="w-full" data-testid="button-load-demo"
              onClick={() => {
                downloadCsvTemplate();
                toast({ title: "Template downloaded", description: "Fill in consumption_kwh for each tenant and upload." });
              }}
            >
              <Download size={13} className="mr-1.5" /> Download CSV Template
            </Button>

            {/* Preview loaded rows */}
            {csvRows.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
                  {csvRows.length} readings loaded
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b" style={{ borderColor: "hsl(var(--border))" }}>
                        <th className="text-left px-3 py-2 text-muted-foreground">Tenant</th>
                        <th className="text-left px-3 py-2 text-muted-foreground">Meter</th>
                        <th className="text-right px-3 py-2 text-muted-foreground">kWh</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.map((r, i) => (
                        <tr key={i} className="border-b last:border-0" style={{ borderColor: "hsl(var(--border))" }}>
                          <td className="px-3 py-2">{r.name}</td>
                          <td className="px-3 py-2 font-mono text-muted-foreground">{r.meterCode}</td>
                          <td className="px-3 py-2 text-right tabular">{r.consumptionKwh.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Solar production input + settle */}
            <div className="space-y-3">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                    <Zap size={12} /> Solar Production This Period (kWh)
                    <span className="ml-1 text-xs px-1 py-0.5 rounded"
                      style={{ background: "hsl(220 15% 15%)", color: "hsl(220 15% 50%)" }}>
                      optional
                    </span>
                  </Label>
                  <Input
                    type="number"
                    placeholder="0 if no solar plant"
                    value={solarKwh}
                    onChange={e => setSolarKwh(e.target.value)}
                    data-testid="input-solar-kwh"
                  />
                </div>
                <Button
                  onClick={handleSettle}
                  disabled={csvRows.length === 0 || settleMutation.isPending}
                  data-testid="button-settle"
                >
                  {settleMutation.isPending ? "Settling..." : "Run Settlement"}
                </Button>
              </div>
              {!solarKwh && csvRows.length > 0 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertTriangle size={11} className="text-amber-500" />
                  No solar input — invoices will show grid cost only, no solar credit.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoice table */}
      {invoices && invoices.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <FileText size={15} /> Invoices ({invoices.length})
          </h2>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: "hsl(var(--border))" }}>
                    {["Invoice #", "Tenant", "Consumption", "Grid Cost", "Solar Credit", "Total Due", "Status", ""].map(h => (
                      <th key={h} className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wide px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoicesLoading
                    ? [1,2,3].map(i => <tr key={i}><td colSpan={8} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td></tr>)
                    : invoices.map(inv => (
                        <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                          style={{ borderColor: "hsl(var(--border))" }} data-testid={`row-invoice-${inv.id}`}>
                          <td className="px-4 py-3">
                            <Link href={`/invoices/${inv.id}`}>
                              <a className="font-mono text-xs text-primary hover:underline">{inv.invoiceNumber}</a>
                            </Link>
                          </td>
                          <td className="px-4 py-3 font-medium">{inv.tenant?.name ?? "—"}</td>
                          <td className="px-4 py-3 tabular text-muted-foreground">{fmt(inv.consumptionKwh)} kWh</td>
                          <td className="px-4 py-3 tabular">{fmtEgp(inv.gridChargeEgp)}</td>
                          <td className="px-4 py-3 tabular text-amber-600 dark:text-amber-400">{inv.solarCreditEgp > 0 ? `-${fmtEgp(inv.solarCreditEgp)}` : <span className="text-muted-foreground">—</span>}</td>
                          <td className="px-4 py-3 tabular font-semibold">{fmtEgp(inv.totalDueEgp)}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={`text-xs badge-${inv.status}`}>{inv.status}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              {inv.status !== "paid" && (
                                <Button size="sm" variant="ghost" className="h-6 text-xs px-2"
                                  onClick={() => statusMutation.mutate({ invId: inv.id, status: "paid" })}
                                  data-testid={`button-mark-paid-${inv.id}`}>
                                  Mark Paid
                                </Button>
                              )}
                              <Link href={`/invoices/${inv.id}`}>
                                <a><ArrowRight size={13} className="text-muted-foreground" /></a>
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))
                  }
                </tbody>
                {invoices && invoices.length > 0 && (
                  <tfoot>
                    <tr className="border-t bg-muted/30" style={{ borderColor: "hsl(var(--border))" }}>
                      <td colSpan={3} className="px-4 py-3 text-xs font-medium text-muted-foreground">Totals</td>
                      <td className="px-4 py-3 tabular text-xs font-semibold">
                        {fmtEgp(invoices.reduce((s, i) => s + i.gridChargeEgp, 0))}
                      </td>
                      <td className="px-4 py-3 tabular text-xs font-semibold text-amber-600 dark:text-amber-400">
                        -{fmtEgp(invoices.reduce((s, i) => s + i.solarCreditEgp, 0))}
                      </td>
                      <td className="px-4 py-3 tabular text-xs font-semibold">
                        {fmtEgp(invoices.reduce((s, i) => s + i.totalDueEgp, 0))}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>
        </div>
      )}
      {/* EEHC Reconciliation — shown after invoices exist */}
      {invoices && invoices.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Building size={15} /> EEHC Reconciliation
            <span className="text-xs font-normal text-muted-foreground ml-1">Enter your government electricity bill to see your net position</span>
          </h2>
          <Card>
            <CardContent className="pt-4 pb-4 space-y-4">
              {/* EEHC bill input */}
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground mb-1.5 block">EEHC Master Meter Bill (EGP)</Label>
                  <Input
                    type="number"
                    placeholder={period?.eehcBillEgp ? String(period.eehcBillEgp) : "e.g. 85000"}
                    value={eehcBill}
                    onChange={e => setEehcBill(e.target.value)}
                    data-testid="input-eehc-bill"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!eehcBill || eehcMutation.isPending}
                  onClick={() => eehcMutation.mutate(Number(eehcBill))}
                  data-testid="button-save-eehc"
                >
                  {eehcSaved ? <CheckCircle2 size={13} className="text-green-500" /> : "Save"}
                </Button>
              </div>

              {/* Reconciliation breakdown */}
              {period?.eehcBillEgp != null && (
                <ReconciliationView
                  eehcBill={period.eehcBillEgp}
                  totalCollected={totalCollected}
                  totalSolarCredit={totalSolarCredit}
                  totalBilled={totalDue}
                />
              )}

              {/* Loss Allocation — coming soon */}
              <div className="flex items-center gap-2 pt-1 border-t" style={{ borderColor: "hsl(var(--border))" }}>
                <span className="text-xs text-muted-foreground">Loss Allocation (hallway / common area losses)</span>
                <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                  style={{ background: "hsl(38 88% 52% / 0.12)", color: "hsl(38 88% 45%)" }}>
                  Coming soon
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function ReconciliationView({ eehcBill, totalCollected, totalSolarCredit, totalBilled }: {
  eehcBill: number;
  totalCollected: number;
  totalSolarCredit: number;
  totalBilled: number;
}) {
  // Net = what you collected from tenants - what EEHC billed you
  // Solar value = the credit you passed through to tenants (your solar plant's contribution)
  const netPosition = totalCollected - eehcBill;
  const isProfit = netPosition >= 0;

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: "1px solid hsl(var(--border))" }}>
      <div className="grid grid-cols-3 divide-x" style={{ borderColor: "hsl(var(--border))" }}>
        <ReconCell
          label="Collected from Tenants"
          value={`${new Intl.NumberFormat("en-EG", { maximumFractionDigits: 0 }).format(totalCollected)} EGP`}
          icon={<TrendingUp size={13} />}
          color="green"
        />
        <ReconCell
          label="EEHC Government Bill"
          value={`${new Intl.NumberFormat("en-EG", { maximumFractionDigits: 0 }).format(eehcBill)} EGP`}
          icon={<TrendingDown size={13} />}
          color="red"
        />
        <ReconCell
          label={isProfit ? "Net Surplus" : "Net Shortfall"}
          value={`${isProfit ? "+" : ""}${new Intl.NumberFormat("en-EG", { maximumFractionDigits: 0 }).format(netPosition)} EGP`}
          icon={<Minus size={13} />}
          color={isProfit ? "green" : "red"}
          highlight
        />
      </div>
      <div className="px-4 py-2.5 flex items-center gap-2"
        style={{ background: "hsl(38 88% 52% / 0.06)", borderTop: "1px solid hsl(var(--border))" }}>
        <Leaf size={12} className="text-amber-500" />
        <span className="text-xs text-muted-foreground">
          Solar plant offset <span className="font-semibold text-amber-600 dark:text-amber-400">
            {new Intl.NumberFormat("en-EG", { maximumFractionDigits: 0 }).format(totalSolarCredit)} EGP
          </span> in tenant grid costs this period
        </span>
      </div>
    </div>
  );
}

function ReconCell({ label, value, icon, color, highlight }: {
  label: string; value: string; icon: React.ReactNode;
  color: "green" | "red" | "amber"; highlight?: boolean;
}) {
  const colorMap = {
    green: "text-green-600 dark:text-green-400",
    red: "text-red-600 dark:text-red-400",
    amber: "text-amber-600 dark:text-amber-400",
  };
  return (
    <div className={`px-4 py-3 ${highlight ? "bg-muted/40" : ""}`}>
      <p className={`text-xs flex items-center gap-1 mb-1 ${colorMap[color]}`}>{icon}{label}</p>
      <p className={`text-sm font-bold tabular ${colorMap[color]}`}>{value}</p>
    </div>
  );
}

function MiniKpi({ label, value, accent, icon }: { label: string; value: string; accent?: string; icon?: React.ReactNode }) {
  const colorMap: Record<string, string> = { green: "text-green-600 dark:text-green-400", amber: "text-amber-600 dark:text-amber-400", red: "text-red-600 dark:text-red-400" };
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <p className="text-xs text-muted-foreground flex items-center gap-1">{icon}{label}</p>
        <p className={`text-base font-semibold tabular mt-0.5 ${accent ? colorMap[accent] : "text-foreground"}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
