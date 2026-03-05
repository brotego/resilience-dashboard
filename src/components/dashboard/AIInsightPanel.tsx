import { useState, useEffect, useRef } from "react";
import { DomainId, MindsetId } from "@/data/types";
import { DOMAINS, MINDSETS } from "@/data/domains";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  activeDomains: DomainId[];
  activeMindset: MindsetId;
}

const AIInsightPanel = ({ activeDomains, activeMindset }: Props) => {
  const [insight, setInsight] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const domainLabels = activeDomains.map((d) => DOMAINS.find((x) => x.id === d)?.label).filter(Boolean).join(", ");
  const mindsetLabel = MINDSETS.find((m) => m.id === activeMindset)?.label || "";

  useEffect(() => {
    if (activeDomains.length === 0) {
      setInsight("Select at least one domain to generate an AI insight brief.");
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      setInsight("");

      try {
        const resp = await supabase.functions.invoke("ai-insight", {
          body: { domains: activeDomains, mindset: activeMindset },
        });

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
  }, [activeDomains.join(","), activeMindset]);

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">AI Insight Brief</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {domainLabels || "No domain"} × {mindsetLabel}
        </p>
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
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse-glow" />
              <span className="text-xs text-muted-foreground">Generating executive brief…</span>
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
