/**
 * Public tenant-facing payment page.
 * Route: /#/pay/:invoiceId
 * No authentication required — accessed via a link sent to the tenant.
 */
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useParams } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Leaf, Zap, Building2, CheckCircle2, Phone, CreditCard } from "lucide-react";

function fmtEgp(n: number) {
  return new Intl.NumberFormat("en-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}
function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-EG", { day: "numeric", month: "long", year: "numeric" });
}

export default function PayInvoice() {
  const { id } = useParams<{ id: string }>();

  const { data: inv, isLoading } = useQuery<any>({
    queryKey: ["/api/invoices", id],
    queryFn: () => apiRequest("GET", `/api/invoices/${id}`).then(r => r.json()),
  });

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "hsl(222 28% 7%)" }}>
      <div className="w-full max-w-md space-y-4">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    </div>
  );

  if (!inv) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(222 28% 7%)" }}>
      <p className="text-muted-foreground text-sm">Invoice not found.</p>
    </div>
  );

  const savings = inv.gridChargeEgp - inv.totalDueEgp;
  const solarPct = inv.consumptionKwh > 0 ? Math.round((inv.solarShareKwh / inv.consumptionKwh) * 100) : 0;
  const isPaid = inv.status === "paid";

  return (
    <div className="min-h-screen flex flex-col items-center justify-start py-10 px-4"
      style={{ background: "hsl(222 28% 7%)" }}>
      <div className="w-full max-w-md space-y-4">

        {/* Sahra header */}
        <div className="text-center mb-2">
          <div className="flex items-center justify-center gap-2 mb-1">
            <svg viewBox="0 0 32 32" width="24" height="24" fill="none" aria-label="Sahra">
              <circle cx="16" cy="13" r="5" fill="hsl(38 88% 52%)" />
              <g stroke="hsl(38 88% 52%)" strokeWidth="1.8" strokeLinecap="round">
                <line x1="16" y1="4" x2="16" y2="2" />
                <line x1="16" y1="24" x2="16" y2="22" />
                <line x1="7" y1="13" x2="5" y2="13" />
                <line x1="27" y1="13" x2="25" y2="13" />
                <line x1="9.5" y1="6.5" x2="8.1" y2="5.1" />
                <line x1="23.9" y1="20.9" x2="22.5" y2="19.5" />
                <line x1="22.5" y1="6.5" x2="23.9" y2="5.1" />
                <line x1="8.1" y1="20.9" x2="9.5" y2="19.5" />
              </g>
              <path d="M6 26 Q16 20 26 26" stroke="hsl(38 88% 52%)" strokeWidth="1.8" strokeLinecap="round" fill="none" />
            </svg>
            <span className="font-bold text-base" style={{ color: "hsl(38 88% 52%)" }}>Sahra</span>
            <span className="text-xs" style={{ color: "hsl(220 15% 45%)" }}>Solar Billing Engine</span>
          </div>
        </div>

        {/* Invoice card */}
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid hsl(220 15% 18%)" }}>
          {/* Dark header */}
          <div className="px-6 py-5" style={{ background: "hsl(222 28% 11%)" }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs mb-0.5" style={{ color: "hsl(220 15% 45%)" }}>Invoice</p>
                <p className="font-mono font-semibold text-sm" style={{ color: "hsl(38 88% 52%)" }}>{inv.invoiceNumber}</p>
              </div>
              <div className="text-right">
                <Badge variant="outline" className={`badge-${inv.status} text-xs`}>{inv.status}</Badge>
                <p className="text-xs mt-1" style={{ color: "hsl(220 15% 45%)" }}>
                  {fmtDate(inv.issuedAt)}
                </p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4" style={{ background: "hsl(222 28% 9%)" }}>
            {/* Billed to */}
            <div className="flex items-start gap-3">
              <Building2 size={15} className="mt-0.5 flex-shrink-0" style={{ color: "hsl(220 15% 45%)" }} />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: "hsl(220 15% 45%)" }}>Billed To</p>
                <p className="font-medium text-sm text-white">{inv.tenant?.name}</p>
                <p className="text-xs" style={{ color: "hsl(220 15% 55%)" }}>{inv.tenant?.unit} · Meter {inv.tenant?.meterCode}</p>
                <p className="text-xs" style={{ color: "hsl(220 15% 45%)" }}>{inv.property?.name} · {inv.period?.label}</p>
              </div>
            </div>

            <div className="h-px" style={{ background: "hsl(220 15% 18%)" }} />

            {/* Breakdown */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-white">Grid Electricity</p>
                  <p className="text-xs" style={{ color: "hsl(220 15% 45%)" }}>{inv.consumptionKwh.toLocaleString()} kWh · Egyptian tiered tariff</p>
                </div>
                <p className="text-sm font-semibold text-white tabular">{fmtEgp(inv.gridChargeEgp)} EGP</p>
              </div>

              {/* Solar credit */}
              <div className="flex justify-between items-center rounded-lg px-3 py-2.5"
                style={{ background: "hsl(38 88% 52% / 0.08)", border: "1px solid hsl(38 88% 52% / 0.2)" }}>
                <div>
                  <p className="text-sm flex items-center gap-1.5 text-white">
                    <Leaf size={13} style={{ color: "hsl(38 88% 52%)" }} />
                    Solar Credit
                  </p>
                  <p className="text-xs" style={{ color: "hsl(220 15% 50%)" }}>
                    {inv.solarShareKwh.toLocaleString()} kWh solar · {inv.property?.discountPct ?? 15}% discount
                  </p>
                </div>
                <p className="text-sm font-semibold tabular" style={{ color: "hsl(38 88% 52%)" }}>
                  -{fmtEgp(inv.solarCreditEgp)} EGP
                </p>
              </div>
            </div>

            <div className="h-px" style={{ background: "hsl(220 15% 18%)" }} />

            {/* Total */}
            <div className="flex justify-between items-center">
              <p className="font-bold text-white text-base">Total Due</p>
              <p className="font-bold text-xl text-white tabular">{fmtEgp(inv.totalDueEgp)} EGP</p>
            </div>

            {/* Savings callout */}
            <div className="rounded-lg px-4 py-3 flex items-center gap-3"
              style={{ background: "hsl(38 88% 52% / 0.08)", border: "1px solid hsl(38 88% 52% / 0.2)" }}>
              <Zap size={16} style={{ color: "hsl(38 88% 52%)" }} className="flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold" style={{ color: "hsl(38 88% 60%)" }}>
                  You saved {fmtEgp(savings)} EGP this month
                </p>
                <p className="text-xs" style={{ color: "hsl(220 15% 50%)" }}>
                  {solarPct}% of your electricity came from on-site solar
                </p>
              </div>
            </div>

            {/* Payment status or CTA */}
            {isPaid ? (
              <div className="flex items-center justify-center gap-2 py-3 rounded-lg"
                style={{ background: "hsl(142 60% 20% / 0.3)", border: "1px solid hsl(142 60% 30%)" }}>
                <CheckCircle2 size={16} className="text-green-400" />
                <p className="text-green-400 text-sm font-semibold">
                  Paid{inv.paidAt ? ` on ${fmtDate(inv.paidAt)}` : ""}
                </p>
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                <p className="text-xs text-center mb-3" style={{ color: "hsl(220 15% 45%)" }}>
                  Choose a payment method
                </p>
                {/* Paymob — placeholder until API is wired */}
                <Button
                  className="w-full gap-2"
                  style={{ background: "hsl(38 88% 52%)", color: "hsl(222 28% 10%)" }}
                  onClick={() => window.open("https://paymob.com", "_blank")}
                  data-testid="button-pay-card"
                >
                  <CreditCard size={15} />
                  Pay by Card / Mobile Wallet
                </Button>

                {/* Contact landlord */}
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  style={{ borderColor: "hsl(220 15% 25%)", color: "hsl(220 15% 70%)" }}
                  onClick={() => window.open(`https://wa.me/?text=Hi, I'd like to pay invoice ${inv.invoiceNumber} of ${fmtEgp(inv.totalDueEgp)} EGP`, "_blank")}
                  data-testid="button-pay-whatsapp"
                >
                  <Phone size={15} />
                  Contact via WhatsApp
                </Button>

                <p className="text-xs text-center pt-1" style={{ color: "hsl(220 15% 35%)" }}>
                  Reference: <span className="font-mono">{inv.invoiceNumber}</span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs" style={{ color: "hsl(220 15% 30%)" }}>
          Powered by <a href="https://sahra.energy" className="underline" style={{ color: "hsl(38 88% 45%)" }}>sahra.energy</a>
        </p>
      </div>
    </div>
  );
}
