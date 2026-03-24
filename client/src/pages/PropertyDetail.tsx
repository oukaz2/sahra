import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTenantSchema } from "@shared/schema";
import type { InsertTenant, Tenant, BillingPeriod } from "@shared/schema";
import { Users, Plus, FileText, CalendarDays, Zap, ArrowRight, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [tenantDialogOpen, setTenantDialogOpen] = useState(false);

  const { data: property, isLoading: propLoading } = useQuery({
    queryKey: ["/api/properties", id],
    queryFn: () => apiRequest("GET", `/api/properties/${id}`).then(r => r.json()),
  });

  const { data: tenants, isLoading: tenantsLoading } = useQuery<Tenant[]>({
    queryKey: ["/api/properties", id, "tenants"],
    queryFn: () => apiRequest("GET", `/api/properties/${id}/tenants`).then(r => r.json()),
  });

  const { data: periods, isLoading: periodsLoading } = useQuery<BillingPeriod[]>({
    queryKey: ["/api/properties", id, "billing-periods"],
    queryFn: () => apiRequest("GET", `/api/properties/${id}/billing-periods`).then(r => r.json()),
  });

  const tenantForm = useForm<InsertTenant>({
    resolver: zodResolver(insertTenantSchema),
    defaultValues: { propertyId: Number(id), name: "", unit: "", meterCode: "", email: "", phone: "", status: "active" },
  });

  const addTenantMutation = useMutation({
    mutationFn: (data: InsertTenant) =>
      apiRequest("POST", `/api/properties/${id}/tenants`, data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties", id, "tenants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Tenant added" });
      tenantForm.reset({ propertyId: Number(id), name: "", unit: "", meterCode: "", email: "", phone: "", status: "active" });
      setTenantDialogOpen(false);
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const removeTenantMutation = useMutation({
    mutationFn: (tenantId: number) => apiRequest("DELETE", `/api/tenants/${tenantId}`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties", id, "tenants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Tenant removed" });
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const toggleTenantMutation = useMutation({
    mutationFn: ({ tenantId, status }: { tenantId: number; status: string }) =>
      apiRequest("PATCH", `/api/tenants/${tenantId}/status`, { status: status === "active" ? "inactive" : "active" }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties", id, "tenants"] });
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const newPeriodMutation = useMutation({
    mutationFn: () => {
      const now = new Date();
      return apiRequest("POST", `/api/properties/${id}/billing-periods`, {
        propertyId: Number(id),
        label: `${now.toLocaleString("default", { month: "long" })} ${now.getFullYear()}`,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        totalGridKwh: 0,
        totalSolarKwh: 0,
        status: "draft",
      }).then(r => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties", id, "billing-periods"] });
      toast({ title: "Billing period created" });
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  if (propLoading) return <Skeleton className="h-40 w-full rounded-lg" />;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{property?.name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{property?.location}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Solar Plant</p>
            <p className="text-sm font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1 justify-end">
              <Zap size={13} /> {property?.solarCapacityKw} kWp
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Discount</p>
            <p className="text-sm font-semibold text-foreground">{property?.discountPct}%</p>
          </div>
        </div>
      </div>

      {/* Tenants section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Users size={15} /> Tenants <span className="text-muted-foreground font-normal">({tenants?.length ?? 0})</span>
          </h2>
          <Dialog open={tenantDialogOpen} onOpenChange={setTenantDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" data-testid="button-add-tenant">
                <Plus size={13} className="mr-1" /> Add Tenant
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Add Tenant</DialogTitle></DialogHeader>
              <Form {...tenantForm}>
                <form onSubmit={tenantForm.handleSubmit(d => addTenantMutation.mutate(d))} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={tenantForm.control} name="name" render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Tenant / Business Name</FormLabel>
                        <FormControl><Input placeholder="Al-Rashid Electronics" {...field} data-testid="input-tenant-name" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={tenantForm.control} name="unit" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit / Shop</FormLabel>
                        <FormControl><Input placeholder="Shop 12" {...field} data-testid="input-unit" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={tenantForm.control} name="meterCode" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Meter Code</FormLabel>
                        <FormControl><Input placeholder="MTR-001" {...field} data-testid="input-meter-code" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={tenantForm.control} name="email" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email (optional)</FormLabel>
                        <FormControl><Input type="email" placeholder="tenant@email.com" {...field} data-testid="input-email" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={tenantForm.control} name="phone" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone (optional)</FormLabel>
                        <FormControl><Input placeholder="+20 100 000 0001" {...field} data-testid="input-phone" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <Button type="submit" className="w-full" disabled={addTenantMutation.isPending} data-testid="button-submit-tenant">
                    {addTenantMutation.isPending ? "Adding..." : "Add Tenant"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: "hsl(var(--border))" }}>
                  {["Tenant", "Unit", "Meter Code", "Contact", "Status", ""].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wide px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tenantsLoading
                  ? [1,2,3].map(i => (
                      <tr key={i}><td colSpan={5} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td></tr>
                    ))
                  : tenants?.map(t => (
                      <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                        style={{ borderColor: "hsl(var(--border))" }} data-testid={`row-tenant-${t.id}`}>
                        <td className="px-4 py-3 font-medium">{t.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{t.unit}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{t.meterCode}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{t.email || t.phone || "—"}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={t.status === "active" ? "badge-paid text-xs" : "badge-draft text-xs"}>
                            {t.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                              title={t.status === "active" ? "Deactivate" : "Activate"}
                              onClick={() => toggleTenantMutation.mutate({ tenantId: t.id, status: t.status })}
                              data-testid={`button-toggle-tenant-${t.id}`}>
                              {t.status === "active" ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                              title="Remove tenant"
                              onClick={() => { if (confirm(`Remove ${t.name}?`)) removeTenantMutation.mutate(t.id); }}
                              data-testid={`button-remove-tenant-${t.id}`}>
                              <Trash2 size={12} />
                            </Button>
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

      {/* Billing Periods */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <CalendarDays size={15} /> Billing Periods
          </h2>
          <Button size="sm" variant="outline" onClick={() => newPeriodMutation.mutate()} disabled={newPeriodMutation.isPending} data-testid="button-new-period">
            <Plus size={13} className="mr-1" /> New Period
          </Button>
        </div>

        <div className="space-y-2">
          {periodsLoading
            ? [1,2].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)
            : periods?.slice().reverse().map(period => (
                <Link key={period.id} href={`/billing/${period.id}`}>
                  <a className="block" data-testid={`card-period-${period.id}`}>
                    <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <FileText size={16} className="text-muted-foreground" />
                            <div>
                              <p className="font-medium text-sm">{period.label}</p>
                              <p className="text-xs text-muted-foreground">
                                {period.totalGridKwh > 0 ? `${period.totalGridKwh.toLocaleString()} kWh consumed` : "Awaiting data upload"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            {period.totalSolarKwh > 0 && (
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground">Solar</p>
                                <p className="text-sm font-medium tabular text-amber-600 dark:text-amber-400">{period.totalSolarKwh.toLocaleString()} kWh</p>
                              </div>
                            )}
                            <Badge variant="outline" className={
                              period.status === "issued" ? "badge-issued text-xs" :
                              period.status === "closed" ? "badge-paid text-xs" : "badge-draft text-xs"
                            }>
                              {period.status}
                            </Badge>
                            <ArrowRight size={14} className="text-muted-foreground" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </a>
                </Link>
              ))
          }
        </div>
      </div>
    </div>
  );
}
