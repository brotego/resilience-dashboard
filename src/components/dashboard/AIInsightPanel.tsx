import { useState, useEffect, useRef } from "react";
import { DomainId, MindsetId } from "@/data/types";
import { GenZCategoryId } from "@/data/genzTypes";
import { DOMAINS, MINDSETS } from "@/data/domains";
import { GENZ_CATEGORIES } from "@/data/genzCategories";
import { COMPANIES, CompanyId } from "@/data/companies";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { DashboardMode } from "./DashboardLayout";
import { ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  mode: DashboardMode;
  activeDomains: DomainId[];
  activeMindset: MindsetId;
  activeCategories: GenZCategoryId[];
  selectedCompany: CompanyId | null;
}

interface StructuredInsight {
  eventTitle: string;
  source: string;
  date: string;
  location: string;
  domainTags: string[];
  patternTag: string;
  genzTags: string[];
  actions: string[];
  companyNote: string;
  risks: string[];
  opportunities: string[];
  globalContext: string;
  genzSignal: string;
  generationalContrast: string;
}

function parseInsight(raw: string): StructuredInsight {
  const getSection = (label: string): string => {
    const regex = new RegExp(`${label}[:\\s]*([\\s\\S]*?)(?=(?:EVENT_TITLE|SOURCE|DATE|LOCATION|DOMAIN_TAGS|PATTERN_TAG|GENZ_TAGS|ACTIONS|COMPANY_NOTE|RISKS|OPPORTUNITIES|GLOBAL_CONTEXT|GENZ_SIGNAL|GENERATIONAL_CONTRAST):|$)`, "i");
    const match = raw.match(regex);
    return match?.[1]?.trim() || "";
  };

  const splitLines = (s: string) => s.split(/\n/).map(l => l.replace(/^[\d①②③④⑤.\-•]\s*/, "").trim()).filter(Boolean);

  return {
    eventTitle: getSection("EVENT_TITLE") || "Intelligence Brief",
    source: getSection("SOURCE") || "Anchorstar Research",
    date: getSection("DATE") || new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }),
    location: getSection("LOCATION") || "Global",
    domainTags: getSection("DOMAIN_TAGS").split(",").map(s => s.trim()).filter(Boolean),
    patternTag: getSection("PATTERN_TAG") || "",
    genzTags: getSection("GENZ_TAGS").split(",").map(s => s.trim()).filter(Boolean),
    actions: splitLines(getSection("ACTIONS")).slice(0, 3),
    companyNote: getSection("COMPANY_NOTE"),
    risks: splitLines(getSection("RISKS")).slice(0, 1),
    opportunities: splitLines(getSection("OPPORTUNITIES")).slice(0, 2),
    globalContext: getSection("GLOBAL_CONTEXT"),
    genzSignal: getSection("GENZ_SIGNAL"),
    generationalContrast: getSection("GENERATIONAL_CONTRAST"),
  };
}

const Tag = ({ label, color }: { label: string; color: string }) => (
  <span
    className="inline-block px-2.5 py-0.5 text-[10px] font-semibold rounded-oval"
    style={{ backgroundColor: color, color: "#fff" }}
  >
    {label}
  </span>
);

const AIInsightPanel = ({ mode, activeDomains, activeMindset, activeCategories, selectedCompany }: Props) => {
  const [insight, setInsight] = useState<StructuredInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contextOpen, setContextOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const isResilience = mode === "resilience";
  const company = selectedCompany ? COMPANIES.find((c) => c.id === selectedCompany) : null;

  const contextLabel = isResilience
    ? `${activeDomains.map((d) => DOMAINS.find((x) => x.id === d)?.label).filter(Boolean).join(", ") || "No domain"} × ${MINDSETS.find((m) => m.id === activeMindset)?.label || ""}`
    : `${activeCategories.map((c) => GENZ_CATEGORIES.find((x) => x.id === c)?.label).filter(Boolean).join(", ") || "No category"}`;

  const hasSelection = isResilience ? activeDomains.length > 0 : activeCategories.length > 0;

  useEffect(() => {
    if (!hasSelection) {
      setInsight(null);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      setInsight(null);
      setContextOpen(false);

      try {
        const body = isResilience
          ? { domains: activeDomains, mindset: activeMindset, mode: "resilience", company: selectedCompany }
          : { categories: activeCategories, mode: "genz", company: selectedCompany };

        const resp = await supabase.functions.invoke("ai-insight", { body });

        if (resp.error) {
          throw new Error(resp.error.message || "Failed to generate insight");
        }

        const raw = resp.data?.insight || "";
        setInsight(parseInsight(raw));
      } catch (e: any) {
        console.error("AI Insight error:", e);
        setError(e.message || "Failed to generate insight");
      } finally {
        setLoading(false);
      }
    }, 800);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [mode, activeDomains.join(","), activeMindset, activeCategories.join(","), selectedCompany]);

  const numberedIcon = (i: number) => ["①", "②", "③"][i] || `${i + 1}`;

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
          {company ? `${company.name} Intel` : isResilience ? "Intelligence Brief" : "Gen Z Intel"}
        </h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">{contextLabel}</p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <div className="flex gap-1.5 mt-2">
              <Skeleton className="h-5 w-16 rounded-oval" />
              <Skeleton className="h-5 w-20 rounded-oval" />
              <Skeleton className="h-5 w-14 rounded-oval" />
            </div>
            <Skeleton className="h-4 w-full mt-3" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-full" />
            <div className="flex items-center gap-2 mt-4">
              <div className="h-2 w-2 rounded-full animate-pulse-glow bg-primary" />
              <span className="text-xs text-muted-foreground">
                {company ? `Analyzing for ${company.name}…` : "Generating intelligence…"}
              </span>
            </div>
          </div>
        ) : error ? (
          <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            {error}
          </div>
        ) : !insight ? (
          <p className="text-sm text-muted-foreground">
            {isResilience ? "Select at least one domain to generate intelligence." : "Select at least one Gen Z category to generate insights."}
          </p>
        ) : (
          <>
            {/* Event Title */}
            <h2 className="text-base font-bold text-foreground leading-snug">{insight.eventTitle}</h2>

            {/* Source + Date + Location */}
            <p className="text-[11px] text-muted-foreground">
              {[insight.source, insight.date, insight.location].filter(Boolean).join(" · ")}
            </p>

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5">
              {insight.domainTags.map((t) => (
                <Tag key={t} label={t} color="hsl(226, 89%, 53%)" />
              ))}
              {insight.patternTag && <Tag label={insight.patternTag} color="hsl(220, 14%, 30%)" />}
              {insight.genzTags.map((t) => (
                <Tag key={t} label={t} color="hsl(170, 55%, 40%)" />
              ))}
            </div>

            {/* Recommended Actions */}
            <div className="rounded-xl bg-accent/10 border border-accent/20 p-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-accent mb-2">Recommended Actions</h4>
              <div className="space-y-1.5">
                {insight.actions.map((a, i) => (
                  <div key={i} className="flex gap-2 text-[12px] text-foreground leading-snug">
                    <span className="text-accent font-bold shrink-0">{numberedIcon(i)}</span>
                    <span>{a}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Company Note */}
            {insight.companyNote && company && (
              <div className="rounded-xl bg-primary/10 border border-primary/20 p-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-1">For {company.name}</h4>
                <p className="text-[12px] text-foreground leading-snug">{insight.companyNote}</p>
              </div>
            )}

            {/* Risks */}
            {insight.risks.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-destructive mb-1">Risks</h4>
                {insight.risks.map((r, i) => (
                  <p key={i} className="text-[12px] text-foreground/80 leading-snug">• {r}</p>
                ))}
              </div>
            )}

            {/* Opportunities */}
            {insight.opportunities.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-accent mb-1">Opportunities</h4>
                {insight.opportunities.map((o, i) => (
                  <p key={i} className="text-[12px] text-foreground/80 leading-snug">• {o}</p>
                ))}
              </div>
            )}

            {/* Collapsible Context */}
            {(insight.globalContext || insight.genzSignal || insight.generationalContrast) && (
              <div className="border-t border-border pt-2">
                <button
                  onClick={() => setContextOpen(!contextOpen)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors w-full"
                >
                  {contextOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  Deeper Context
                </button>
                {contextOpen && (
                  <div className="mt-2 space-y-2.5">
                    {insight.globalContext && (
                      <div>
                        <h5 className="text-[10px] font-bold uppercase tracking-wider text-primary mb-0.5">Why This Matters Globally</h5>
                        <p className="text-[11px] text-foreground/70 leading-snug">{insight.globalContext}</p>
                      </div>
                    )}
                    {insight.genzSignal && (
                      <div>
                        <h5 className="text-[10px] font-bold uppercase tracking-wider text-genz mb-0.5">Gen Z Signal</h5>
                        <p className="text-[11px] text-foreground/70 leading-snug">{insight.genzSignal}</p>
                      </div>
                    )}
                    {insight.generationalContrast && (
                      <div>
                        <h5 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Generational Contrast</h5>
                        <p className="text-[11px] text-foreground/70 leading-snug">{insight.generationalContrast}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AIInsightPanel;
