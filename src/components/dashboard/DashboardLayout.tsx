import { useState, useCallback } from "react";
import { DomainId, MindsetId, ResilienceSignal } from "@/data/types";
import { GenZCategoryId, GenZSignal } from "@/data/genzTypes";
import { CompanyId } from "@/data/companies";
import ModeToggle from "./ModeToggle";
import DomainSelector from "./DomainSelector";
import MindsetSelector from "./MindsetSelector";
import JapanFocusPanel from "./JapanFocusPanel";
import GenZCategorySelector from "./GenZCategorySelector";
import GenZFocusPanel from "./GenZFocusPanel";
import CompanySelector from "./CompanySelector";
import AIInsightPanel from "./AIInsightPanel";
import CountryOutlookPanel from "./CountryOutlookPanel";
import GlobalMap from "./GlobalMap";
import { ScrollArea } from "@/components/ui/scroll-area";

export type DashboardMode = "resilience" | "genz";

const DashboardLayout = () => {
  const [mode, setMode] = useState<DashboardMode>("resilience");
  const [activeDomains, setActiveDomains] = useState<DomainId[]>(["work"]);
  const [activeMindset, setActiveMindset] = useState<MindsetId>("cracks");
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
      <ModeToggle mode={mode} onModeChange={setMode} />
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <ScrollArea className="w-[300px] shrink-0 border-r border-border bg-card">
          <div className="p-4 space-y-6">
            <CompanySelector selectedCompany={selectedCompany} onSelect={setSelectedCompany} />
            <div className="border-t border-border" />
            {mode === "resilience" ? (
              <>
                <DomainSelector activeDomains={activeDomains} onToggle={toggleDomain} />
                <div className="border-t border-border" />
                <MindsetSelector activeMindset={activeMindset} onSelect={setActiveMindset} />
                <div className="border-t border-border" />
                <JapanFocusPanel activeDomains={activeDomains} selectedCompany={selectedCompany} />
              </>
            ) : (
              <>
                <GenZCategorySelector activeCategories={activeCategories} onToggle={toggleCategory} />
                <div className="border-t border-border" />
                <GenZFocusPanel activeCategories={activeCategories} selectedCompany={selectedCompany} />
              </>
            )}
          </div>
        </ScrollArea>

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
