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
import GlobeMap from "./GlobeMap";
import CompanyDashboard from "./CompanyDashboard";
import { useUnifiedSignals } from "@/hooks/useUnifiedSignals";
import { useLang } from "@/i18n/LanguageContext";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useLocation, useNavigate } from "react-router-dom";

export type DashboardMode = "resilience" | "genz";
export type ViewTab = "dashboard" | "map";
type MapView = "map2d" | "globe3d";
const READ_SIGNALS_STORAGE_KEY = "read-signal-ids";

const LiveClock = () => {
  const [now, setNow] = useState(new Date());
  const { t } = useLang();
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const locale = t("clock.locale");
  return (
    <span className="font-mono text-[10px] text-muted-foreground/70 tabular-nums">
      {now.toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" })}
      {" "}
      {now.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
    </span>
  );
};

const DashboardLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { lang, setLang, t } = useLang();
  const [activeTab, setActiveTab] = useState<ViewTab>("dashboard");
  const [mode, setMode] = useState<DashboardMode>("resilience");
  const [activeDomains, setActiveDomains] = useState<DomainId[]>(["work", "selfhood", "community", "aging", "environment"]);
  const [activeMindset] = useState<MindsetId>("cracks");
  const [activeCategories, setActiveCategories] = useState<GenZCategoryId[]>(["authenticity"]);
  const [selectedCompany, setSelectedCompany] = useState<CompanyId | null>("mori_building");
  const [selectedSignal, setSelectedSignal] = useState<UnifiedSignal | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [mapView, setMapView] = useState<MapView>("map2d");
  const [readSignalIds, setReadSignalIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(READ_SIGNALS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
    } catch {
      return [];
    }
  });

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
    setReadSignalIds((prev) => (prev.includes(signal.id) ? prev : [...prev, signal.id]));
  }, []);

  const handleDashboardSignalClick = useCallback((signal: UnifiedSignal) => {
    setSelectedSignal(signal);
    setSelectedCountry(null);
    setActiveTab("map");
    setReadSignalIds((prev) => (prev.includes(signal.id) ? prev : [...prev, signal.id]));
  }, []);

  const handleCountryClick = useCallback((countryName: string, _geo: any) => {
    setSelectedCountry(countryName);
    setSelectedSignal(null);
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedSignal(null);
    setSelectedCountry(null);
  }, []);

  useEffect(() => {
    const routeState = (location.state as { returnTab?: ViewTab; returnMode?: DashboardMode } | null);
    const returnTab = routeState?.returnTab;
    const returnMode = routeState?.returnMode;

    if (returnMode === "resilience" || returnMode === "genz") {
      setMode(returnMode);
    }
    if (returnTab === "dashboard" || returnTab === "map") {
      setActiveTab(returnTab);
    }
    if (returnTab || returnMode) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    localStorage.setItem(READ_SIGNALS_STORAGE_KEY, JSON.stringify(readSignalIds));
  }, [readSignalIds]);

  const handleMoreInfo = useCallback((signal: UnifiedSignal) => {
    // IDs can contain URLs (slashes); must be one path segment or the route becomes /signal/* / * → 404
    navigate(`/signal/${encodeURIComponent(signal.id)}`, {
      state: {
        signal,
        mode,
        selectedCompany,
        activeDomains,
        activeCategories,
        originTab: activeTab,
        originMode: mode,
      },
    });
  }, [navigate, mode, selectedCompany, activeDomains, activeCategories, activeTab]);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header — 44px max */}
      <header className="flex items-center justify-between px-4 h-[44px] border-b border-border bg-card shrink-0">
        {/* Left: title + tabs */}
        <div className="flex items-center gap-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <h1 className="text-[13px] font-bold tracking-tight text-foreground whitespace-nowrap">
                  {t("app.title")}
                </h1>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[10px]">
                {t("app.subtitle")}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="h-4 w-px bg-border" />

          {/* Tab buttons */}
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`px-3 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider rounded-sm transition-colors ${
                activeTab === "dashboard"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {lang === "jp" ? "ダッシュボード" : "Dashboard"}
            </button>
            <button
              onClick={() => setActiveTab("map")}
              className={`px-3 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider rounded-sm transition-colors ${
                activeTab === "map"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {lang === "jp" ? "グローバルマップ" : "Global Map"}
            </button>
          </div>
        </div>

        {/* Center: info */}
        <div className="flex items-center gap-3">
          <LiveClock />
          <div className="h-3 w-px bg-border" />
          <span className="text-[10px] font-mono font-semibold text-primary tabular-nums">
            {signalCount} {lang === "jp" ? "件" : "signals"}
          </span>
          {isLive && (
            <>
              <span className="text-[9px] font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {t("header.live")}
              </span>
            </>
          )}
          <div className="h-3 w-px bg-border" />
          <div className="flex gap-0.5">
            <button
              onClick={() => setLang("en")}
              className={`px-2 py-0.5 text-[9px] font-mono font-semibold rounded-sm transition-colors ${
                lang === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setLang("jp")}
              className={`px-2 py-0.5 text-[9px] font-mono font-semibold rounded-sm transition-colors ${
                lang === "jp" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              JP
            </button>
          </div>
        </div>

        {/* Right: mode toggle + company */}
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            <button
              onClick={() => setMode("resilience")}
              className={`px-3 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider rounded-sm transition-colors ${
                mode === "resilience"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("mode.resilience")}
            </button>
            <button
              onClick={() => setMode("genz")}
              className={`px-3 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider rounded-sm transition-colors ${
                mode === "genz"
                  ? "bg-genz text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("mode.genz")}
            </button>
          </div>
          <div className="w-44">
            <CompanySelector selectedCompany={selectedCompany} onSelect={setSelectedCompany} />
          </div>
        </div>
      </header>

      {/* Main content */}
      {activeTab === "dashboard" ? (
        <div className="flex-1 overflow-hidden">
          <CompanyDashboard
            selectedCompany={selectedCompany}
            signals={visibleSignals}
            onSignalClick={handleDashboardSignalClick}
          />
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden relative">
          <div className="flex-1 relative">
            {mapView === "map2d" ? (
              <GlobalMap
                mode={mode}
                activeDomains={activeDomains}
                activeMindset={activeMindset}
                activeCategories={activeCategories}
                selectedCompany={selectedCompany}
                onSignalClick={handleSignalClick}
                onCountryClick={handleCountryClick}
                selectedSignalId={selectedSignal?.id || null}
                readSignalIds={readSignalIds}
                selectedCountry={selectedCountry}
                signals={visibleSignals}
              />
            ) : (
              <GlobeMap
                signals={visibleSignals}
                selectedCompany={selectedCompany}
                selectedSignalId={selectedSignal?.id || null}
                readSignalIds={readSignalIds}
                onSignalClick={handleSignalClick}
                onCountryClick={handleCountryClick}
                selectedCountry={selectedCountry}
              />
            )}

            {/* Bottom-left floating domain/category selector */}
            <div className="absolute bottom-3 left-3 z-10 bg-[rgba(6,10,12,0.85)] backdrop-blur-lg border border-border rounded-sm p-2">
              {mode === "resilience" ? (
                <DomainSelector activeDomains={activeDomains} onToggle={toggleDomain} />
              ) : (
                <GenZCategorySelector activeCategories={activeCategories} onToggle={toggleCategory} />
              )}
            </div>
            <div className="absolute top-3 right-3 z-10 bg-[rgba(6,10,12,0.85)] backdrop-blur-lg border border-border rounded-sm p-1 flex gap-1">
              <button
                onClick={() => setMapView("map2d")}
                className={`px-2 py-1 text-[9px] font-mono font-semibold uppercase tracking-wider rounded-sm transition-colors ${
                  mapView === "map2d" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                2D
              </button>
              <button
                onClick={() => setMapView("globe3d")}
                className={`px-2 py-1 text-[9px] font-mono font-semibold uppercase tracking-wider rounded-sm transition-colors ${
                  mapView === "globe3d" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                3D
              </button>
            </div>
          </div>

          {/* Right Panel */}
          <div className="w-[400px] shrink-0">
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
                onMoreInfo={handleMoreInfo}
                showMoreInfoButton
                signals={visibleSignals}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardLayout;
