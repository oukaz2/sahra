import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Invoice, Tenant } from "@shared/schema";
import { ArrowRight, Search, Receipt } from "lucide-react";
import { useState } from "react";

type EnrichedInvoice = Invoice & { tenant?: Tenant };

function fmtEgp(n: number) {
  return `${new Intl.NumberFormat("en-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} EGP`;
}

export default function Invoices() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: invoices, isLoading } = useQuery<EnrichedInvoice[]>({
    queryKey: ["/api/invoices-all"],
    queryFn: async () => {
      // Get all invoices via billing periods
      const props = await apiRequest("GET", "/api/properties").then(r => r.json());
      const allInvs: EnrichedInvoice[] = [];
      for (const p of props) {
        const periods = await apiRequest("GET", `/api/properties/${p.id}/billing-periods`).then(r => r.json());
        for (const period of periods) {
          const invs = await apiRequest("GET", `/api/billing-periods/${period.id}/invoices`).then(r => r.json());
          allInvs.push(...invs);
        }
      }
      return allInvs;
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ invId, status }: { invId: number; status: string }) =>
      apiRequest("PATCH", `/api/invoices/${invId}/status`, { status }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/invoices-all"] }),
  });

  const filtered = invoices?.filter(inv => {
    const matchesSearch = !search ||
      inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      inv.tenant?.name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) ?? [];

  const totalDue = filtered.reduce((s, i) => s + i.totalDueEgp, 0);
  const totalSolarCredit = filtered.reduce((s, i) => s + i.solarCreditEgp, 0);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold">Invoices</h1>
        <p className="text-sm text-muted-foreground mt-0.5">All tenant invoices across all properties</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search invoice or tenant..."
            className="pl-9 h-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
            data-testid="input-search"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter} data-testid="select-status">
          <SelectTrigger className="w-36 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} invoice{filtered.length !== 1 ? "s" : ""}
          {filtered.length > 0 && <span className="ml-2 font-medium text-foreground">{fmtEgp(totalDue)} total · <span className="text-amber-600 dark:text-amber-400">{fmtEgp(totalSolarCredit)} in solar credits</span></span>}
        </span>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: "hsl(var(--border))" }}>
                {["Invoice #", "Tenant", "Consumption", "Solar Credit", "Total Due", "Status", ""].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wide px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? [1,2,3,4,5].map(i => <tr key={i}><td colSpan={7} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td></tr>)
                : filtered.length === 0
                ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                        <Receipt size={32} className="mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No invoices found</p>
                      </td>
                    </tr>
                  )
                : filtered.map(inv => (
                    <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                      style={{ borderColor: "hsl(var(--border))" }} data-testid={`row-invoice-${inv.id}`}>
                      <td className="px-4 py-3">
                        <Link href={`/invoices/${inv.id}`}>
                          <a className="font-mono text-xs text-primary hover:underline">{inv.invoiceNumber}</a>
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-medium">{inv.tenant?.name ?? "—"}</td>
                      <td className="px-4 py-3 tabular text-muted-foreground">{inv.consumptionKwh.toLocaleString()} kWh</td>
                      <td className="px-4 py-3 tabular text-amber-600 dark:text-amber-400">-{fmtEgp(inv.solarCreditEgp)}</td>
                      <td className="px-4 py-3 tabular font-semibold">{fmtEgp(inv.totalDueEgp)}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-xs badge-${inv.status}`}>{inv.status}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {inv.status !== "paid" && (
                            <Button size="sm" variant="ghost" className="h-6 text-xs px-2"
                              onClick={() => statusMutation.mutate({ invId: inv.id, status: "paid" })}
                              disabled={statusMutation.isPending}>
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
          </table>
        </div>
      </Card>
    </div>
  );
}
