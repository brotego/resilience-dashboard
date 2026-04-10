import { X, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { DomainId, MindsetId, ResilienceSignal } from "@/data/types";
import { GenZCategoryId, GenZSignal } from "@/data/genzTypes";
import { DOMAINS } from "@/data/domains";
import { GENZ_CATEGORIES } from "@/data/genzCategories";
import { COMPANIES, CompanyId } from "@/data/companies";
import { SIGNAL_INSIGHTS, getDefaultInsight, SignalInsight } from "@/data/signalInsights";
import { DashboardMode } from "./DashboardLayout";

interface Props {
  mode: DashboardMode;
  activeDomains: DomainId[];
  activeMindset: MindsetId;
  activeCategories: GenZCategoryId[];
  selectedCompany: CompanyId | null;
  selectedSignal: ResilienceSignal | GenZSignal | null;
  onClose: () => void;
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
  const [contextOpen, setContextOpen] = useState(true);

  const company = selectedCompany ? COMPANIES.find((c) => c.id === selectedCompany) : null;
  const isResilience = mode === "resilience";

  // No signal selected — show placeholder
  if (!selectedSignal) {
    return (
      <div className="h-full flex flex-col bg-card border-l border-border">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-bold uppercase tracking-wider text-primary">
            Intelligence Panel
          </h3>
        </div>
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="text-center space-y-2">
            <div className="text-3xl">🗺️</div>
            <p className="text-sm font-semibold text-foreground">Click a signal on the map</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Select a dot to view its structured intelligence brief
              {company ? ` tailored for ${company.name}` : ""}. 
              {!company && " Choose a company from the lens for tailored insights."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Get insight data
  const signalId = selectedSignal.id;
  const companyId = selectedCompany || "mori_building";
  const companyForInsight = COMPANIES.find((c) => c.id === companyId)!;
  const insightKey = `${signalId}:${companyId}`;
  
  const domainOrCategory = isResilience 
    ? DOMAINS.find((d) => d.id === (selectedSignal as ResilienceSignal).domain)
    : GENZ_CATEGORIES.find((c) => c.id === (selectedSignal as GenZSignal).category);
  
  const insight: SignalInsight = SIGNAL_INSIGHTS[insightKey] 
    || getDefaultInsight(
      selectedSignal.title,
      selectedSignal.description,
      domainOrCategory?.label || "",
      companyForInsight.name,
    );

  const domainTags: string[] = [];
  if (isResilience) {
    const sig = selectedSignal as ResilienceSignal;
    const d = DOMAINS.find((x) => x.id === sig.domain);
    if (d) domainTags.push(d.label);
  } else {
    const sig = selectedSignal as GenZSignal;
    const c = GENZ_CATEGORIES.find((x) => x.id === sig.category);
    if (c) domainTags.push(c.label);
  }

  const numberedIcon = (i: number) => ["①", "②", "③"][i] || `${i + 1}`;

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <UrgencyBadge level={insight.urgency} />
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors p-0.5 shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Event title */}
        <h2 className="text-lg font-bold text-foreground leading-snug">{selectedSignal.title}</h2>

        {/* Source line */}
        <p className="text-[11px] text-muted-foreground">
          {selectedSignal.location} · Anchorstar Research · {new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" })}
        </p>

        <div className="border-t border-border" />

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          {domainTags.map((t) => (
            <Tag key={t} label={t} color="#1241ea" />
          ))}
          {insight.patternTag && <Tag label={insight.patternTag} color="hsl(220, 14%, 30%)" />}
          {insight.genzArchetypes.map((t) => (
            <Tag key={t} label={t} color="#1ab5a5" />
          ))}
        </div>

        <div className="border-t border-border" />

        {/* Why This Matters Globally */}
        <div>
          <SectionHeader>Why This Matters Globally</SectionHeader>
          <p className="text-[12px] text-foreground/80 leading-relaxed">{insight.globalContext}</p>
        </div>

        {/* Gen Z Signal */}
        <div>
          <SectionHeader color="text-genz">Gen Z Signal</SectionHeader>
          <p className="text-[12px] text-foreground/80 leading-relaxed">{insight.genzSignal}</p>
        </div>

        {/* Generational Contrast */}
        <div>
          <SectionHeader color="text-muted-foreground">Generational Contrast</SectionHeader>
          <p className="text-[12px] text-foreground/70 leading-relaxed italic">{insight.generationalContrast}</p>
        </div>

        <div className="border-t border-border" />

        {/* Company Implication */}
        <div className="rounded-xl bg-primary/10 border border-primary/20 p-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-1.5">
            For {companyForInsight.name}
          </h4>
          <p className="text-[12px] text-foreground leading-relaxed">{insight.companyImplication}</p>
        </div>

        {/* Risks & Opportunities side by side */}
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

        {/* Recommended Actions */}
        <div className="rounded-xl bg-accent/10 border border-accent/20 p-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-accent mb-2">Recommended Actions</h4>
          <div className="space-y-2">
            {insight.actions.map((a, i) => (
              <div key={i} className="flex gap-2 text-[12px] text-foreground leading-snug">
                <span className="text-accent font-bold shrink-0">{numberedIcon(i)}</span>
                <span>{a}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Signal description (collapsible) */}
        <div className="border-t border-border pt-2">
          <button
            onClick={() => setContextOpen(!contextOpen)}
            className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            {contextOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Original Signal
          </button>
          {contextOpen && (
            <p className="mt-2 text-[11px] text-foreground/60 leading-relaxed">{selectedSignal.description}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIInsightPanel;
