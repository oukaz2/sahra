import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/components/PasswordGate";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Properties from "@/pages/Properties";
import PropertyDetail from "@/pages/PropertyDetail";
import BillingPeriod from "@/pages/BillingPeriod";
import Invoices from "@/pages/Invoices";
import InvoiceDetail from "@/pages/InvoiceDetail";
import PayInvoice from "@/pages/PayInvoice";
import NotFound from "@/pages/not-found";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Router hook={useHashLocation}>
          <Switch>
            {/* Public route — no auth, no sidebar */}
            <Route path="/pay/:id" component={PayInvoice} />

            {/* Protected dashboard routes */}
            <Route>
              <AuthProvider>
                <Layout>
                  <Switch>
                    <Route path="/" component={Dashboard} />
                    <Route path="/properties" component={Properties} />
                    <Route path="/properties/:id" component={PropertyDetail} />
                    <Route path="/billing/:id" component={BillingPeriod} />
                    <Route path="/invoices" component={Invoices} />
                    <Route path="/invoices/:id" component={InvoiceDetail} />
                    <Route component={NotFound} />
                  </Switch>
                </Layout>
              </AuthProvider>
            </Route>
          </Switch>
        </Router>
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
