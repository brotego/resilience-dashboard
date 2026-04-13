import { X, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { DomainId, MindsetId, ResilienceSignal } from "@/data/types";
import { GenZCategoryId, GenZSignal } from "@/data/genzTypes";
import { DOMAINS } from "@/data/domains";
import { GENZ_CATEGORIES } from "@/data/genzCategories";
import { COMPANIES, CompanyId } from "@/data/companies";
import { DashboardMode } from "./DashboardLayout";
import { supabase } from "@/integrations/supabase/client";

interface AIInsight {
  urgency: string;
  headline: string;
  actions: string[];
  risks: string[];
  opportunities: string[];
  whyItMatters: string;
  genzSignal: string;
  patternTag: string;
}

interface Props {
  mode: DashboardMode;
  activeDomains: DomainId[];
  activeMindset: MindsetId;
  activeCategories: GenZCategoryId[];
  selectedCompany: CompanyId | null;
  selectedSignal: ResilienceSignal | GenZSignal | null;
  onClose: () => void;
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const UrgencyBadge = ({ level }: { level: string }) => {
  const colors: Record<string, string> = {
    high: "bg-red-500/20 text-red-400 border-red-500/30",
    medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    low: "bg-green-500/20 text-green-400 border-green-500/30",
  };
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-oval border ${colors[level] || colors.medium}`}>
      {level} urgency
    </span>
  );
};

const Tag = ({ label, color }: { label: string; color: string }) => (
  <span
    className="inline-block px-2.5 py-0.5 text-[10px] font-semibold rounded-oval"
    style={{ backgroundColor: color, color: "#fff" }}
  >
    {label}
  </span>
);

const SectionHeader = ({ children, color = "text-primary" }: { children: React.ReactNode; color?: string }) => (
  <h4 className={`text-xs font-bold uppercase tracking-wider ${color} mb-1.5`}>{children}</h4>
);

const AIInsightPanel = ({
  mode,
  activeDomains,
  activeMindset,
  activeCategories,
  selectedCompany,
  selectedSignal,
  onClose,
}: Props) => {
  const [contextOpen, setContextOpen] = useState(false);
  const [insight, setInsight] = useState<AIInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSignalRef = useRef<string | null>(null);

  const company = selectedCompany ? COMPANIES.find((c) => c.id === selectedCompany) : null;
  const isResilience = mode === "resilience";

  const modeLabel = isResilience ? "RESILIENCE INTELLIGENCE BRIEF" : "GEN Z SIGNAL BRIEF";

  useEffect(() => {
    if (!selectedSignal) {
      setInsight(null);
      lastSignalRef.current = null;
      return;
    }

    const key = `${selectedSignal.id}:${selectedCompany || "general"}`;
    if (key === lastSignalRef.current) return;
    lastSignalRef.current = key;

    const domainOrCategory = isResilience
      ? DOMAINS.find((d) => d.id === (selectedSignal as ResilienceSignal).domain)
      : GENZ_CATEGORIES.find((c) => c.id === (selectedSignal as GenZSignal).category);

    setLoading(true);
    setError(null);
    setInsight(null);

    supabase.functions
      .invoke("ai-insight", {
        body: {
          signalTitle: selectedSignal.title,
          signalDescription: selectedSignal.description,
          signalLocation: selectedSignal.location,
          signalDomain: domainOrCategory?.label || "",
          company: selectedCompany || null,
        },
      })
      .then(({ data, error: fnError }) => {
        if (fnError) {
          setError("Failed to generate insight");
          console.error("AI insight error:", fnError);
        } else if (data?.error) {
          setError(data.error);
        } else {
          setInsight(data as AIInsight);
        }
        setLoading(false);
      });
  }, [selectedSignal?.id, selectedCompany]);

  // No signal — placeholder
  if (!selectedSignal) {
    return (
      <div className="h-full flex flex-col bg-card border-l border-border">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-primary mb-1">
            {modeLabel}
          </p>
          <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
            Intelligence Panel
          </h3>
        </div>
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="text-center space-y-2">
            <div className="text-3xl">🗺️</div>
            <p className="text-sm font-semibold text-foreground">Click a signal on the map</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Select a dot to view its AI intelligence brief
              {company ? ` tailored for ${company.name}` : ""}.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const domainOrCategory = isResilience
    ? DOMAINS.find((d) => d.id === (selectedSignal as ResilienceSignal).domain)
    : GENZ_CATEGORIES.find((c) => c.id === (selectedSignal as GenZSignal).category);

  const companyLabel = company?.name;
  const numberedIcon = (i: number) => ["①", "②", "③"][i] || `${i + 1}`;

  // Build a "published" date from signal year or fallback
  const signalDate = (selectedSignal as any).year
    ? new Date((selectedSignal as any).year, 0, 1)
    : new Date();
  const relativeTime = timeAgo(signalDate);

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      {/* Mode header + urgency */}
      <div className="px-4 py-3 border-b border-border">
        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-primary mb-2">
          {modeLabel}
        </p>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {insight && <UrgencyBadge level={insight.urgency} />}
            {domainOrCategory && <Tag label={domainOrCategory.label} color="#1241ea" />}
            {insight?.patternTag && <Tag label={insight.patternTag} color="hsl(220, 14%, 30%)" />}
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-0.5 shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {/* 1. NEWS TITLE */}
        <div>
          <h2 className="text-base font-bold text-foreground leading-snug">{selectedSignal.title}</h2>
          <p className="text-[11px] text-muted-foreground mt-1">
            {selectedSignal.location} · {(selectedSignal as any).source || "Live Signal"} · <span className="text-primary/70">{relativeTime}</span>
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground text-xs py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating intelligence brief...
          </div>
        )}

        {error && (
          <div className="text-xs text-red-400 bg-red-500/10 rounded-lg p-3">{error}</div>
        )}

        {insight && (
          <>
            {/* AI HEADLINE */}
            {insight.headline && (
              <p className="text-[12px] text-foreground/80 leading-relaxed italic border-l-2 border-primary pl-3">
                {insight.headline}
              </p>
            )}

            {/* 2. WHAT TO DO */}
            <div className="rounded-xl bg-accent/10 border border-accent/20 p-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-accent mb-2">
                What To Do{companyLabel ? ` — ${companyLabel}` : ""}
              </h4>
              <div className="space-y-2">
                {insight.actions.map((a, i) => (
                  <div key={i} className="flex gap-2 text-[12px] text-foreground leading-snug">
                    <span className="text-accent font-bold shrink-0">{numberedIcon(i)}</span>
                    <span>{a}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. RISKS & OPPORTUNITIES */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <SectionHeader color="text-red-400">Risks</SectionHeader>
                {insight.risks.map((r, i) => (
                  <div key={i} className="flex items-start gap-1.5 mb-1">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
                    <p className="text-[11px] text-foreground/70 leading-snug">{r}</p>
                  </div>
                ))}
              </div>
              <div>
                <SectionHeader color="text-green-400">Opportunities</SectionHeader>
                {insight.opportunities.map((o, i) => (
                  <div key={i} className="flex items-start gap-1.5 mb-1">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-green-400 shrink-0" />
                    <p className="text-[11px] text-foreground/70 leading-snug">{o}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. WHY IT MATTERS */}
            <div className="rounded-xl bg-primary/10 border border-primary/20 p-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-1.5">
                Why This Matters{companyLabel ? ` — ${companyLabel}` : ""}
              </h4>
              <p className="text-[12px] text-foreground leading-relaxed">{insight.whyItMatters}</p>
            </div>

            {/* 5. DEEPER CONTEXT */}
            <div className="border-t border-border pt-2">
              <button
                onClick={() => setContextOpen(!contextOpen)}
                className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors w-full"
              >
                {contextOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                Deeper Context
              </button>
              {contextOpen && (
                <div className="mt-3 space-y-3">
                  {insight.genzSignal && (
                    <div>
                      <SectionHeader color="text-genz">Gen Z Signal</SectionHeader>
                      <p className="text-[12px] text-foreground/80 leading-relaxed">{insight.genzSignal}</p>
                    </div>
                  )}
                  <div>
                    <SectionHeader color="text-muted-foreground">Original Signal</SectionHeader>
                    <p className="text-[11px] text-foreground/60 leading-relaxed">{selectedSignal.description}</p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AIInsightPanel;
