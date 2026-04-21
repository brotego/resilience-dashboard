import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import SignalDetail from "./pages/SignalDetail";
import { LanguageProvider, useLang } from "./i18n/LanguageContext";
import { JpUiProvider } from "./i18n/jpUiContext";

const queryClient = new QueryClient();

function I18nShell({ children }: { children: ReactNode }) {
  const { lang } = useLang();
  return <JpUiProvider lang={lang}>{children}</JpUiProvider>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <I18nShell>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/signal/:id" element={<SignalDetail />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </I18nShell>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
