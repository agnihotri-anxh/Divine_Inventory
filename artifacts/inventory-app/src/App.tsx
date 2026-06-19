import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setBaseUrl } from "@workspace/api-client-react";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/dashboard";
import Inventory from "@/pages/inventory";
import Products from "@/pages/products";
import Warehouses from "@/pages/warehouses";
import Orders from "@/pages/orders";
import Returns from "@/pages/returns";
import Reconciliation from "@/pages/reconciliation";
import Alerts from "@/pages/alerts";
import NotFound from "@/pages/not-found";

// In production (Vercel/Netlify) set VITE_API_URL to your Render backend URL.
// In development (Replit or local) leave it unset — relative /api paths work fine.
if (import.meta.env.VITE_API_URL) {
  setBaseUrl(import.meta.env.VITE_API_URL as string);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/inventory" component={Inventory} />
        <Route path="/products" component={Products} />
        <Route path="/warehouses" component={Warehouses} />
        <Route path="/orders" component={Orders} />
        <Route path="/returns" component={Returns} />
        <Route path="/reconciliation" component={Reconciliation} />
        <Route path="/alerts" component={Alerts} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
