import { useState, useCallback } from "react";
import { DomainId, MindsetId, ResilienceSignal } from "@/data/types";
import { GenZCategoryId, GenZSignal } from "@/data/genzTypes";
import { CompanyId } from "@/data/companies";
import ModeToggle from "./ModeToggle";
import DomainSelector from "./DomainSelector";
import GenZCategorySelector from "./GenZCategorySelector";
import CompanySelector from "./CompanySelector";
import AIInsightPanel from "./AIInsightPanel";
import CountryOutlookPanel from "./CountryOutlookPanel";
import GlobalMap from "./GlobalMap";

export type DashboardMode = "resilience" | "genz";

const DashboardLayout = () => {
  const [mode, setMode] = useState<DashboardMode>("resilience");
  const [activeDomains, setActiveDomains] = useState<DomainId[]>(["work"]);
  const [activeMindset] = useState<MindsetId>("cracks");
  const [activeCategories, setActiveCategories] = useState<GenZCategoryId[]>(["authenticity"]);
  const [selectedCompany, setSelectedCompany] = useState<CompanyId | null>("mori_building");
  const [selectedSignal, setSelectedSignal] = useState<ResilienceSignal | GenZSignal | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  const toggleDomain = (id: DomainId) => {
    setActiveDomains((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  const toggleCategory = (id: GenZCategoryId) => {
    setActiveCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleSignalClick = useCallback((signal: ResilienceSignal | GenZSignal, _mode: DashboardMode) => {
    setSelectedSignal(signal);
    setSelectedCountry(null);
  }, []);

  const handleCountryClick = useCallback((countryName: string) => {
    setSelectedCountry(countryName);
    setSelectedSignal(null);
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedSignal(null);
    setSelectedCountry(null);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Top bar: mode toggle + company selector */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-card">
        <div className="flex flex-col">
          <h1 className="text-lg font-bold tracking-tight text-foreground">
            Flourishing Through Resilience
          </h1>
          <span className="text-[11px] text-muted-foreground">
            Anchorstar × Mori Building
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Company Lens inline */}
          <div className="w-52">
            <CompanySelector selectedCompany={selectedCompany} onSelect={setSelectedCompany} />
          </div>

          {/* Mode buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode("resilience")}
              className={`px-4 py-1.5 text-sm font-semibold rounded-oval transition-colors ${
                mode === "resilience"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              Global Resilience
            </button>
            <button
              onClick={() => setMode("genz")}
              className={`px-4 py-1.5 text-sm font-semibold rounded-oval transition-colors ${
                mode === "genz"
                  ? "bg-genz text-white"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              Gen Z Signal
            </button>
          </div>
        </div>
      </header>

      {/* Main area: map + right panel */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Map */}
        <div className="flex-1 relative">
          <GlobalMap
            mode={mode}
            activeDomains={activeDomains}
            activeMindset={activeMindset}
            activeCategories={activeCategories}
            selectedCompany={selectedCompany}
            onSignalClick={handleSignalClick}
            onCountryClick={handleCountryClick}
            selectedSignalId={selectedSignal?.id || null}
            selectedCountry={selectedCountry}
          />

          {/* Bottom-right floating domain/category selector */}
          <div className="absolute bottom-4 right-[340px] z-10 bg-card/90 backdrop-blur-md border border-border rounded-xl p-3 shadow-lg max-w-[280px]">
            {mode === "resilience" ? (
              <DomainSelector activeDomains={activeDomains} onToggle={toggleDomain} />
            ) : (
              <GenZCategorySelector activeCategories={activeCategories} onToggle={toggleCategory} />
            )}
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-80 shrink-0">
          {selectedCountry && !selectedSignal ? (
            <CountryOutlookPanel
              countryName={selectedCountry}
              mode={mode}
              onClose={handleClosePanel}
              onSignalClick={handleSignalClick}
            />
          ) : (
            <AIInsightPanel
              mode={mode}
              activeDomains={activeDomains}
              activeMindset={activeMindset}
              activeCategories={activeCategories}
              selectedCompany={selectedCompany}
              selectedSignal={selectedSignal}
              onClose={handleClosePanel}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;
