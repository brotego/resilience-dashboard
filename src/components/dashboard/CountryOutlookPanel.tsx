import { X } from "lucide-react";
import { SIGNALS } from "@/data/signals";
import { GENZ_SIGNALS } from "@/data/genzSignals";
import { DOMAINS } from "@/data/domains";
import { GENZ_CATEGORIES } from "@/data/genzCategories";
import { COUNTRY_ALIASES } from "./GlobalMap";
import { ResilienceSignal } from "@/data/types";
import { GenZSignal } from "@/data/genzTypes";
import { DashboardMode } from "./DashboardLayout";

interface Props {
  countryName: string;
  mode: DashboardMode;
  onClose: () => void;
  onSignalClick: (signal: ResilienceSignal | GenZSignal, mode: DashboardMode) => void;
}

function matchesCountry(location: string, countryName: string): boolean {
  if (location.toLowerCase().includes(countryName.toLowerCase())) return true;
  const aliases = COUNTRY_ALIASES[countryName] || [];
  return aliases.some((a) => location.toLowerCase().includes(a.toLowerCase()));
}

function findAllMatchingCountryNames(countryName: string): string[] {
  if (COUNTRY_ALIASES[countryName]) return [countryName];
  for (const [key, aliases] of Object.entries(COUNTRY_ALIASES)) {
    if (aliases.some((a) => a.toLowerCase() === countryName.toLowerCase())) {
      return [key];
    }
  }
  return [countryName];
}

const CountryOutlookPanel = ({ countryName, mode, onClose, onSignalClick }: Props) => {
  const matchNames = findAllMatchingCountryNames(countryName);

  const matchSignal = (location: string) =>
    matchNames.some((name) => matchesCountry(location, name));

  const resilienceSignals = SIGNALS.filter((s) => matchSignal(s.location));
  const genzSignals = GENZ_SIGNALS.filter((s) => matchSignal(s.location));

  const currentSignals = mode === "resilience" ? resilienceSignals : genzSignals;
  const otherSignals = mode === "resilience" ? genzSignals : resilienceSignals;

  const domainCounts: Record<string, number> = {};
  resilienceSignals.forEach((s) => {
    const d = DOMAINS.find((d) => d.id === s.domain);
    if (d) domainCounts[d.label] = (domainCounts[d.label] || 0) + 1;
  });
  const categoryCounts: Record<string, number> = {};
  genzSignals.forEach((s) => {
    const c = GENZ_CATEGORIES.find((c) => c.id === s.category);
    if (c) categoryCounts[c.label] = (categoryCounts[c.label] || 0) + 1;
  });

  const totalSignals = resilienceSignals.length + genzSignals.length;

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      <div className="px-4 py-3 border-b border-border flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-primary">
            Country Outlook
          </h3>
          <h2 className="text-lg font-bold text-foreground mt-0.5">{countryName}</h2>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors p-0.5 shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-primary/10 border border-primary/20 p-3 text-center">
            <div className="text-2xl font-bold text-primary">{totalSignals}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Total Signals</div>
          </div>
          <div className="rounded-lg bg-accent/10 border border-accent/20 p-3 text-center">
            <div className="text-2xl font-bold text-accent">{currentSignals.length}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
              {mode === "resilience" ? "Resilience" : "Gen Z"}
            </div>
          </div>
        </div>

        {Object.keys(domainCounts).length > 0 && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Domains</h4>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(domainCounts).map(([label, count]) => (
                <span key={label} className="inline-block px-2.5 py-0.5 text-[10px] font-semibold rounded-full bg-primary/15 text-primary border border-primary/20">
                  {label} ({count})
                </span>
              ))}
            </div>
          </div>
        )}
        {Object.keys(categoryCounts).length > 0 && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Gen Z Categories</h4>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(categoryCounts).map(([label, count]) => (
                <span key={label} className="inline-block px-2.5 py-0.5 text-[10px] font-semibold rounded-full bg-[#1ab5a5]/15 text-[#1ab5a5] border border-[#1ab5a5]/20">
                  {label} ({count})
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-border" />

        {currentSignals.length > 0 && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-2">
              {mode === "resilience" ? "Resilience Signals" : "Gen Z Signals"}
            </h4>
            <div className="space-y-2">
              {currentSignals.map((signal) => {
                const tag = mode === "resilience"
                  ? DOMAINS.find((d) => d.id === (signal as ResilienceSignal).domain)
                  : GENZ_CATEGORIES.find((c) => c.id === (signal as GenZSignal).category);
                return (
                  <button
                    key={signal.id}
                    onClick={() => onSignalClick(signal, mode)}
                    className="w-full text-left rounded-lg border border-border bg-background/50 hover:bg-accent/10 p-3 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h5 className="text-[12px] font-semibold text-foreground group-hover:text-primary transition-colors leading-snug">
                        {signal.title}
                      </h5>
                      {tag && (
                        <span
                          className="shrink-0 inline-block px-2 py-0.5 text-[9px] font-bold rounded-full text-white"
                          style={{ backgroundColor: mode === "resilience" ? "#1241ea" : "#1ab5a5" }}
                        >
                          {tag.label}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                      {signal.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {otherSignals.length > 0 && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Also: {mode === "resilience" ? "Gen Z Signals" : "Resilience Signals"}
            </h4>
            <div className="space-y-1.5">
              {otherSignals.map((signal) => (
                <button
                  key={signal.id}
                  onClick={() => onSignalClick(signal, mode === "resilience" ? "genz" : "resilience")}
                  className="w-full text-left rounded-lg border border-border/50 bg-background/30 hover:bg-accent/5 p-2 transition-colors"
                >
                  <h5 className="text-[11px] font-medium text-foreground/70 leading-snug">
                    {signal.title}
                  </h5>
                </button>
              ))}
            </div>
          </div>
        )}

        {totalSignals === 0 && (
          <div className="text-center py-8">
            <div className="text-3xl mb-2">🌍</div>
            <p className="text-sm text-muted-foreground">No signals tracked in {countryName} yet.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Try selecting different domains or categories.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CountryOutlookPanel;
