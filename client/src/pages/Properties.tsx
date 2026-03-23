import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertPropertySchema } from "@shared/schema";
import type { InsertProperty, Property } from "@shared/schema";
import { Building2, Plus, ArrowRight, Zap, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function Properties() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const { data: properties, isLoading } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
    queryFn: () => apiRequest("GET", "/api/properties").then(r => r.json()),
  });

  const form = useForm<InsertProperty>({
    resolver: zodResolver(insertPropertySchema),
    defaultValues: { name: "", location: "", solarCapacityKw: 100, tenantCount: 0, discountPct: 15, status: "active" },
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertProperty) => apiRequest("POST", "/api/properties", data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Property added", description: "The property has been created." });
      form.reset();
      setOpen(false);
    },
    onError: () => toast({ title: "Error", description: "Could not create property.", variant: "destructive" }),
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Properties</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage malls, compounds, and industrial parks</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-property">
              <Plus size={14} className="mr-1.5" /> Add Property
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Property</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Property Name</FormLabel>
                    <FormControl><Input placeholder="Cairo Commerce Park" {...field} data-testid="input-property-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="location" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl><Input placeholder="New Cairo, Egypt" {...field} data-testid="input-location" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="solarCapacityKw" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Solar Capacity (kWp)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} data-testid="input-solar-capacity" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="discountPct" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Solar Discount (%)</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" max="50" {...field} onChange={e => field.onChange(Number(e.target.value))} data-testid="input-discount" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-property">
                  {createMutation.isPending ? "Creating..." : "Create Property"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {isLoading
          ? [1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-lg" />)
          : properties?.map(p => <PropertyCard key={p.id} property={p} />)
        }
        {!isLoading && properties?.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Building2 size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No properties yet. Add your first property to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function PropertyCard({ property }: { property: Property }) {
  return (
    <Link href={`/properties/${property.id}`}>
      <a className="block" data-testid={`card-property-${property.id}`}>
        <Card className="hover:border-primary/50 transition-colors cursor-pointer">
          <CardContent className="py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-lg bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center flex-shrink-0">
                  <Building2 size={20} className="text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{property.name}</p>
                    <Badge variant="outline" className={property.status === "active" ? "badge-paid text-xs" : "badge-draft text-xs"}>
                      {property.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{property.location}</p>
                </div>
              </div>
              <div className="flex items-center gap-6 text-right">
                <Stat label="Solar Plant" value={`${property.solarCapacityKw} kWp`} icon={<Zap size={13} />} />
                <Stat label="Tenants" value={String(property.tenantCount)} icon={<Users size={13} />} />
                <Stat label="Discount" value={`${property.discountPct}%`} accent />
                <ArrowRight size={14} className="text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </a>
    </Link>
  );
}

function Stat({ label, value, icon, accent }: { label: string; value: string; icon?: React.ReactNode; accent?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground flex items-center gap-1">{icon}{label}</p>
      <p className={`text-sm font-semibold tabular ${accent ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>{value}</p>
    </div>
  );
}
