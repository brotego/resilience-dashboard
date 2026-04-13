import { useState, useCallback, useEffect } from "react";
import { DomainId, MindsetId } from "@/data/types";
import { GenZCategoryId } from "@/data/genzTypes";
import { CompanyId } from "@/data/companies";
import { UnifiedSignal } from "@/data/unifiedSignalTypes";
import DomainSelector from "./DomainSelector";
import GenZCategorySelector from "./GenZCategorySelector";
import CompanySelector from "./CompanySelector";
import AIInsightPanel from "./AIInsightPanel";
import CountryOutlookPanel from "./CountryOutlookPanel";
import GlobalMap from "./GlobalMap";
import { useUnifiedSignals } from "@/hooks/useUnifiedSignals";
import { useLang } from "@/i18n/LanguageContext";

export type DashboardMode = "resilience" | "genz";

const LiveClock = () => {
  const [now, setNow] = useState(new Date());
  const { lang, t } = useLang();
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const locale = t("clock.locale");
  return (
    <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
      {now.toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
      {" · "}
      {now.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
    </span>
  );
};

const DashboardLayout = () => {
  const { lang, setLang, t } = useLang();
  const [mode, setMode] = useState<DashboardMode>("resilience");
  const [activeDomains, setActiveDomains] = useState<DomainId[]>(["work", "selfhood", "community", "aging", "environment"]);
  const [activeMindset] = useState<MindsetId>("cracks");
  const [activeCategories, setActiveCategories] = useState<GenZCategoryId[]>(["authenticity"]);
  const [selectedCompany, setSelectedCompany] = useState<CompanyId | null>("mori_building");
  const [selectedSignal, setSelectedSignal] = useState<UnifiedSignal | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  const { signals, isLive } = useUnifiedSignals(mode, activeDomains, activeCategories, selectedCompany);

  const visibleSignals = signals.filter(s => {
    if (mode === "resilience") return s.layer === "resilience" || s.layer === "live-news";
    return s.layer === "genz" || s.layer === "live-news";
  });

  const signalCount = visibleSignals.length;

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

  const handleSignalClick = useCallback((signal: UnifiedSignal) => {
    setSelectedSignal(signal);
    setSelectedCountry(null);
  }, []);

  const handleCountryClick = useCallback((countryName: string, _geo: any) => {
    setSelectedCountry(countryName);
    setSelectedSignal(null);
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedSignal(null);
    setSelectedCountry(null);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-2.5 border-b border-border bg-card">
        <div className="flex flex-col">
          <h1 className="text-lg font-bold tracking-tight text-foreground">
            {t("app.title")}
          </h1>
          <span className="text-[11px] text-muted-foreground">
            {t("app.subtitle")}
          </span>
        </div>

        {/* Center info strip */}
        <div className="flex items-center gap-4">
          <LiveClock />
          <div className="h-4 w-px bg-border" />
          <span className="text-[11px] font-semibold text-primary tabular-nums">
            {signalCount} {t("header.activeSignals")}
          </span>
          {isLive && (
            <>
              <div className="h-4 w-px bg-border" />
              <span className="text-[9px] font-bold text-green-400 uppercase tracking-wider flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                {t("header.live")}
              </span>
            </>
          )}
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setLang("en")}
              className={`px-2 py-0.5 text-[10px] font-bold rounded-l-md transition-colors ${
                lang === "en"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setLang("jp")}
              className={`px-2 py-0.5 text-[10px] font-bold rounded-r-md transition-colors ${
                lang === "jp"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              JP
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-52">
            <CompanySelector selectedCompany={selectedCompany} onSelect={setSelectedCompany} />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode("resilience")}
              className={`px-4 py-1.5 text-sm font-semibold rounded-oval transition-colors ${
                mode === "resilience"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("mode.resilience")}
            </button>
            <button
              onClick={() => setMode("genz")}
              className={`px-4 py-1.5 text-sm font-semibold rounded-oval transition-colors ${
                mode === "genz"
                  ? "bg-genz text-white"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("mode.genz")}
            </button>
          </div>
        </div>
      </header>

      {/* Main area: map + right panel */}
      <div className="flex-1 flex overflow-hidden relative">
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
            signals={visibleSignals}
          />

          {/* Bottom-left floating domain/category selector */}
          <div className="absolute bottom-4 left-4 z-10 bg-card/90 backdrop-blur-md border border-border rounded-lg p-2 shadow-lg">
            {mode === "resilience" ? (
              <DomainSelector activeDomains={activeDomains} onToggle={toggleDomain} />
            ) : (
              <GenZCategorySelector activeCategories={activeCategories} onToggle={toggleCategory} />
            )}
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-[420px] shrink-0">
          {selectedCountry && !selectedSignal ? (
            <CountryOutlookPanel
              countryName={selectedCountry}
              mode={mode}
              selectedCompany={selectedCompany}
              onClose={handleClosePanel}
              onSignalClick={(signal: any) => handleSignalClick(signal)}
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
