import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Building2, Users, TrendingUp, TrendingDown, Zap, AlertTriangle, ArrowRight, Leaf
} from "lucide-react";

interface DashboardData {
  totalProperties: number;
  totalTenants: number;
  totalBilledEgp: number;
  totalCollectedEgp: number;
  totalOutstandingEgp: number;
  totalSolarCreditsEgp: number;
  overdueCount: number;
  collectionRate: number;
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-EG", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

export default function Dashboard() {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard"],
    queryFn: () => apiRequest("GET", "/api/dashboard").then(r => r.json()),
  });

  const { data: properties, isLoading: propsLoading } = useQuery<any[]>({
    queryKey: ["/api/properties"],
    queryFn: () => apiRequest("GET", "/api/properties").then(r => r.json()),
  });

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Page heading */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">Overview</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Solar billing activity across all properties</p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Billed"
          value={isLoading ? null : `${fmt(data!.totalBilledEgp)} EGP`}
          icon={<TrendingUp size={16} />}
          sub="This cycle"
          color="text-foreground"
        />
        <KpiCard
          label="Collected"
          value={isLoading ? null : `${fmt(data!.totalCollectedEgp)} EGP`}
          icon={<TrendingUp size={16} />}
          sub={isLoading ? "" : `${data!.collectionRate}% rate`}
          color="text-green-600 dark:text-green-400"
          accent="green"
        />
        <KpiCard
          label="Outstanding"
          value={isLoading ? null : `${fmt(data!.totalOutstandingEgp)} EGP`}
          icon={isLoading || data!.overdueCount === 0 ? <TrendingDown size={16} /> : <AlertTriangle size={16} />}
          sub={isLoading ? "" : `${data!.overdueCount} overdue`}
          color={!isLoading && data!.overdueCount > 0 ? "text-red-600 dark:text-red-400" : "text-foreground"}
          accent={!isLoading && data!.overdueCount > 0 ? "red" : undefined}
        />
        <KpiCard
          label="Solar Credits Issued"
          value={isLoading ? null : `${fmt(data!.totalSolarCreditsEgp)} EGP`}
          icon={<Leaf size={16} />}
          sub="Tenant savings"
          color="text-amber-600 dark:text-amber-400"
          accent="amber"
        />
      </div>

      {/* Second row: properties + tenants */}
      <div className="grid grid-cols-2 gap-4">
        <KpiCard
          label="Properties"
          value={isLoading ? null : String(data!.totalProperties)}
          icon={<Building2 size={16} />}
          sub="Active"
          color="text-foreground"
          compact
        />
        <KpiCard
          label="Tenants"
          value={isLoading ? null : String(data!.totalTenants)}
          icon={<Users size={16} />}
          sub="Across all properties"
          color="text-foreground"
          compact
        />
      </div>

      {/* Properties list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Properties</h2>
          <Link href="/properties">
            <a className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
              View all <ArrowRight size={12} />
            </a>
          </Link>
        </div>

        <div className="space-y-2">
          {propsLoading
            ? [1, 2].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)
            : properties?.map(p => <PropertyRow key={p.id} property={p} />)
          }
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon, sub, color, accent, compact }: {
  label: string; value: string | null; icon: React.ReactNode;
  sub: string; color: string; accent?: string; compact?: boolean;
}) {
  const accentMap: Record<string, string> = {
    green: "border-l-green-500",
    red: "border-l-red-500",
    amber: "border-l-amber-500",
  };
  const border = accent ? `border-l-2 ${accentMap[accent]}` : "";

  return (
    <Card className={`kpi-glow ${border}`}>
      <CardContent className={compact ? "pt-4 pb-4" : "pt-5 pb-5"}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
            {value === null
              ? <Skeleton className="h-7 w-28 mt-1" />
              : <p className={`${compact ? "text-lg" : "text-xl"} font-semibold tabular mt-0.5 ${color}`}>{value}</p>
            }
            <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
          </div>
          <div className="text-muted-foreground mt-0.5">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function PropertyRow({ property }: { property: any }) {
  return (
    <Link href={`/properties/${property.id}`}>
      <a className="block">
        <Card className="hover:border-primary/50 transition-colors cursor-pointer">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-md bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
                  <Building2 size={16} className="text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{property.name}</p>
                  <p className="text-xs text-muted-foreground">{property.location}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-right">
                <div>
                  <p className="text-xs text-muted-foreground">Solar Capacity</p>
                  <p className="text-sm font-medium tabular">{property.solarCapacityKw} kWp</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tenants</p>
                  <p className="text-sm font-medium tabular">{property.tenantCount}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Discount</p>
                  <p className="text-sm font-medium tabular text-amber-600 dark:text-amber-400">{property.discountPct}%</p>
                </div>
                <Badge variant="outline" className={property.status === "active" ? "badge-paid" : "badge-draft"}>
                  {property.status}
                </Badge>
                <ArrowRight size={14} className="text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </a>
    </Link>
  );
}
