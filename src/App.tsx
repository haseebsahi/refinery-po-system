import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { POProvider } from "@/context/PODraftContext";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import CatalogPage from "@/pages/CatalogPage";
import DraftPage from "@/pages/DraftPage";
import OrdersPage from "@/pages/OrdersPage";
import OrderDetailPage from "@/pages/OrderDetailPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <POProvider>
          <div className="flex flex-col min-h-screen">
            <AppHeader />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<CatalogPage />} />
                <Route path="/draft" element={<DraftPage />} />
                <Route path="/orders" element={<OrdersPage />} />
                <Route path="/orders/:id" element={<OrderDetailPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
            <AppFooter />
          </div>
        </POProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
