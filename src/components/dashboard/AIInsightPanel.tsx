import { useState, useEffect, useRef } from "react";
import { DomainId, MindsetId } from "@/data/types";
import { GenZCategoryId } from "@/data/genzTypes";
import { DOMAINS, MINDSETS } from "@/data/domains";
import { GENZ_CATEGORIES } from "@/data/genzCategories";
import { COMPANIES, CompanyId } from "@/data/companies";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { DashboardMode } from "./DashboardLayout";

interface Props {
  mode: DashboardMode;
  activeDomains: DomainId[];
  activeMindset: MindsetId;
  activeCategories: GenZCategoryId[];
  selectedCompany: CompanyId | null;
}

const AIInsightPanel = ({ mode, activeDomains, activeMindset, activeCategories, selectedCompany }: Props) => {
  const [insight, setInsight] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const isResilience = mode === "resilience";
  const company = selectedCompany ? COMPANIES.find((c) => c.id === selectedCompany) : null;

  const contextLabel = isResilience
    ? `${activeDomains.map((d) => DOMAINS.find((x) => x.id === d)?.label).filter(Boolean).join(", ") || "No domain"} × ${MINDSETS.find((m) => m.id === activeMindset)?.label || ""}`
    : `${activeCategories.map((c) => GENZ_CATEGORIES.find((x) => x.id === c)?.label).filter(Boolean).join(", ") || "No category"}`;

  const hasSelection = isResilience ? activeDomains.length > 0 : activeCategories.length > 0;

  useEffect(() => {
    if (!hasSelection) {
      setInsight(isResilience ? "Select at least one domain to generate an AI insight brief." : "Select at least one Gen Z category to generate insights.");
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      setInsight("");

      try {
        const body = isResilience
          ? { domains: activeDomains, mindset: activeMindset, mode: "resilience", company: selectedCompany }
          : { categories: activeCategories, mode: "genz", company: selectedCompany };

        const resp = await supabase.functions.invoke("ai-insight", { body });

        if (resp.error) {
          throw new Error(resp.error.message || "Failed to generate insight");
        }

        setInsight(resp.data?.insight || "No insight generated.");
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

  const accentClass = isResilience ? "text-primary" : "text-genz";

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      <div className="px-4 py-3 border-b border-border">
        <h3 className={`text-xs font-semibold uppercase tracking-wider ${accentClass}`}>
          {company ? `${company.name} Insight Brief` : isResilience ? "AI Insight Brief" : "Gen Z Insight Brief"}
        </h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">{contextLabel}</p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/6" />
            <div className="flex items-center gap-2 mt-4">
              <div className={`h-2 w-2 rounded-full animate-pulse-glow ${isResilience ? "bg-primary" : "bg-genz"}`} />
              <span className="text-xs text-muted-foreground">
                {company ? `Generating ${company.name} brief…` : "Generating executive brief…"}
              </span>
            </div>
          </div>
        ) : error ? (
          <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
            {error}
          </div>
        ) : (
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{insight}</p>
        )}
      </div>
    </div>
  );
};

export default AIInsightPanel;
