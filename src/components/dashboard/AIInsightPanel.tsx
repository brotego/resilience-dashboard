import { X, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { DomainId, MindsetId } from "@/data/types";
import { GenZCategoryId } from "@/data/genzTypes";
import { DOMAINS } from "@/data/domains";
import { GENZ_CATEGORIES } from "@/data/genzCategories";
import { COMPANIES, CompanyId } from "@/data/companies";
import { UnifiedSignal } from "@/data/unifiedSignalTypes";
import { DashboardMode } from "./DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { calculateResilienceScore } from "@/lib/resilienceScore";
import { useLang } from "@/i18n/LanguageContext";

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
  selectedSignal: UnifiedSignal | null;
  onClose: () => void;
  signals?: UnifiedSignal[];
}

function timeAgo(date: Date, lang: string): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (lang === "jp") {
    if (seconds < 60) return "たった今";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}分前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}時間前`;
    const days = Math.floor(hours / 24);
    return `${days}日前`;
  }
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const UrgencyBadge = ({ level }: { level: string }) => {
  const { t } = useLang();
  const colors: Record<string, string> = {
    critical: "bg-red-600/25 text-red-300 border-red-500/40",
    high: "bg-red-500/20 text-red-400 border-red-500/30",
    medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    low: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  };
  const urgencyKey = `urgency.${level}` as any;
  const translated = t(urgencyKey);
  return (
    <span className={`text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm border ${colors[level] || colors.medium}`}>
      {translated} {t("panel.urgency")}
    </span>
  );
};

const Tag = ({ label, color }: { label: string; color: string }) => (
  <span className="inline-block px-2 py-0.5 text-[9px] font-mono font-semibold rounded-sm" style={{ backgroundColor: color, color: "#fff" }}>
    {label}
  </span>
);

const SectionHeader = ({ children, color = "text-primary" }: { children: React.ReactNode; color?: string }) => (
  <h4 className={`text-[10px] font-mono font-bold uppercase tracking-widest ${color} mb-1`}>{children}</h4>
);

const ScoreBar = ({ score, label }: { score: number; label: string }) => (
  <div className="flex items-center gap-2">
    <span className="text-[9px] font-mono text-muted-foreground w-24 shrink-0">{label}</span>
    <div className="flex-1 h-1 bg-muted rounded-sm overflow-hidden">
      <div className="h-full bg-primary rounded-sm transition-all" style={{ width: `${score * 10}%` }} />
    </div>
    <span className="text-[9px] font-mono font-bold text-foreground w-4 text-right">{score}</span>
  </div>
);

/** Auto-cycling preview of top signals when nothing is selected */
const AutoCyclePreview = ({ signals, onSignalClick }: { signals: UnifiedSignal[]; onSignalClick: (s: UnifiedSignal) => void }) => {
  const { lang } = useLang();
  const topSignals = signals
    .sort((a, b) => b.resilienceScore - a.resilienceScore)
    .slice(0, 3);
  const [index, setIndex] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    if (topSignals.length === 0) return;
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setIndex(prev => (prev + 1) % topSignals.length);
        setFade(true);
      }, 300);
    }, 4000);
    return () => clearInterval(interval);
  }, [topSignals.length]);

  if (topSignals.length === 0) return null;
  const signal = topSignals[index % topSignals.length];
  if (!signal) return null;

  return (
    <div className="flex-1 flex flex-col">
      <button
        onClick={() => onSignalClick(signal)}
        className={`flex-1 flex flex-col justify-center px-4 transition-opacity duration-300 hover:bg-secondary/20 ${fade ? "opacity-100" : "opacity-0"}`}
      >
        <div className="space-y-2">
          <UrgencyBadge level={signal.urgency} />
          <h3 className="text-sm font-bold text-foreground leading-snug">{signal.title}</h3>
          <p className="text-[10px] font-mono text-muted-foreground">{signal.location}</p>
          <p className="text-[11px] text-foreground/60 leading-snug line-clamp-2">{signal.description}</p>
        </div>
      </button>
      <div className="px-4 pb-2 flex items-center justify-between">
        <div className="flex gap-1">
          {topSignals.map((_, i) => (
            <span key={i} className={`h-1 w-4 rounded-sm transition-colors ${i === index % topSignals.length ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>
        <span className="text-[8px] font-mono text-muted-foreground/50 uppercase tracking-widest">
          {lang === "jp" ? "自動巡回中" : "auto-cycling"}
        </span>
      </div>
    </div>
  );
};

const AIInsightPanel = ({
  mode,
  activeDomains,
  activeMindset,
  activeCategories,
  selectedCompany,
  selectedSignal,
  onClose,
  signals = [],
}: Props) => {
  const { lang, t } = useLang();
  const [contextOpen, setContextOpen] = useState(false);
  const [insight, setInsight] = useState<AIInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSignalRef = useRef<string | null>(null);

  const company = selectedCompany ? COMPANIES.find((c) => c.id === selectedCompany) : null;
  const isResilience = mode === "resilience";
  const modeLabel = isResilience ? t("panel.resilienceBrief") : t("panel.genzBrief");

  useEffect(() => {
    if (!selectedSignal) {
      setInsight(null);
      lastSignalRef.current = null;
      return;
    }

    const key = `${selectedSignal.id}:${selectedCompany || "general"}:${lang}`;
    if (key === lastSignalRef.current) return;
    lastSignalRef.current = key;

    const domainOrCategory = selectedSignal.domain
      ? DOMAINS.find(d => d.id === selectedSignal.domain)
      : selectedSignal.category
        ? GENZ_CATEGORIES.find(c => c.id === selectedSignal.category)
        : null;

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
          language: lang,
        },
      })
      .then(({ data, error: fnError }) => {
        if (fnError) { setError(lang === "jp" ? "インサイトの生成に失敗しました" : "Failed to generate insight"); }
        else if (data?.error) { setError(data.error); }
        else { setInsight(data as AIInsight); }
        setLoading(false);
      });
  }, [selectedSignal?.id, selectedCompany, lang]);

  if (!selectedSignal) {
    return (
      <div className="h-full flex flex-col bg-card border-l border-border">
        <div className="px-3 py-2 border-b border-border">
          <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-primary">{modeLabel}</p>
        </div>
        <AutoCyclePreview signals={signals} onSignalClick={(s) => { onClose(); setTimeout(() => onClose(), 0); }} />
      </div>
    );
  }

  const domainOrCategory = selectedSignal.domain
    ? DOMAINS.find(d => d.id === selectedSignal.domain)
    : selectedSignal.category
      ? GENZ_CATEGORIES.find(c => c.id === selectedSignal.category)
      : null;

  const companyLabel = company?.name;
  const numberedIcon = (i: number) => `${i + 1}`;

  const signalDate = selectedSignal.date ? new Date(selectedSignal.date) : new Date();
  const relativeTime = timeAgo(signalDate, lang);

  const scoreBreakdown = calculateResilienceScore({
    title: selectedSignal.title,
    description: selectedSignal.description,
    source: selectedSignal.source,
    date: selectedSignal.date,
    domain: selectedSignal.domain,
    category: selectedSignal.category,
    companyId: selectedCompany,
    baseIntensity: selectedSignal.resilienceScore,
  });

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      {/* Mode header + urgency */}
      <div className="px-3 py-2 border-b border-border">
        <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-primary mb-1.5">{modeLabel}</p>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {insight && <UrgencyBadge level={insight.urgency} />}
            {domainOrCategory && <Tag label={domainOrCategory.label} color="#1241ea" />}
            {insight?.patternTag && <Tag label={insight.patternTag} color="hsl(220, 14%, 30%)" />}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-0.5 shrink-0">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {/* 1. NEWS TITLE */}
        <div>
          <h2 className="text-[13px] font-bold text-foreground leading-snug">{selectedSignal.title}</h2>
          <p className="text-[10px] font-mono text-muted-foreground mt-1">
            {selectedSignal.location} · <span className="text-accent">{selectedSignal.source || "Signal"}</span> · <span className="text-muted-foreground/60">{relativeTime}</span>
          </p>
        </div>

        {/* RESILIENCE EXPOSURE SCORE */}
        <div className="rounded-sm bg-muted/30 border border-border p-2.5 space-y-1">
          <div className="flex items-center justify-between">
            <h4 className="text-[9px] font-mono font-bold uppercase tracking-widest text-muted-foreground">{t("panel.resilienceExposure")}</h4>
            <span className="text-base font-mono font-semibold text-primary">{scoreBreakdown.total}<span className="text-[9px] text-muted-foreground font-normal">/10</span></span>
          </div>
          <ScoreBar score={scoreBreakdown.domainRelevance} label={t("panel.domainFit")} />
          <ScoreBar score={scoreBreakdown.keywordMatch} label={t("panel.keywordMatch")} />
          <ScoreBar score={scoreBreakdown.recency} label={t("panel.recency")} />
          <ScoreBar score={scoreBreakdown.sourceAuthority} label={t("panel.sourceQuality")} />
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground text-[11px] py-6 justify-center">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t("panel.generating")}
          </div>
        )}

        {error && <div className="text-[11px] text-red-400 bg-red-500/10 rounded-sm p-2.5">{error}</div>}

        {insight && (
          <>
            {insight.headline && (
              <p className="text-[11px] text-foreground/80 leading-snug italic border-l-2 border-primary pl-2.5">{insight.headline}</p>
            )}

            {/* WHAT TO DO */}
            <div className="rounded-sm bg-accent/10 border border-accent/20 p-2.5">
              <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-accent mb-1.5">
                {t("panel.whatToDo")}{companyLabel ? ` — ${companyLabel}` : ""}
              </h4>
              <div className="space-y-1.5">
                {insight.actions.map((a, i) => (
                  <div key={i} className="flex gap-2 text-[11px] text-foreground leading-snug">
                    <span className="text-accent font-mono font-bold shrink-0">{numberedIcon(i)}.</span>
                    <span>{a}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* RISKS & OPPORTUNITIES */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <SectionHeader color="text-red-400">{t("panel.risks")}</SectionHeader>
                {insight.risks.map((r, i) => (
                  <div key={i} className="flex items-start gap-1.5 mb-1">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
                    <p className="text-[10px] text-foreground/70 leading-snug">{r}</p>
                  </div>
                ))}
              </div>
              <div>
                <SectionHeader color="text-emerald-400">{t("panel.opportunities")}</SectionHeader>
                {insight.opportunities.map((o, i) => (
                  <div key={i} className="flex items-start gap-1.5 mb-1">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                    <p className="text-[10px] text-foreground/70 leading-snug">{o}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* WHY IT MATTERS */}
            <div className="rounded-sm bg-primary/10 border border-primary/20 p-2.5">
              <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary mb-1">
                {t("panel.whyMatters")}{companyLabel ? ` — ${companyLabel}` : ""}
              </h4>
              <p className="text-[11px] text-foreground leading-snug">{insight.whyItMatters}</p>
            </div>

            {/* DEEPER CONTEXT */}
            <div className="border-t border-border pt-2">
              <button
                onClick={() => setContextOpen(!contextOpen)}
                className="flex items-center gap-1 text-[10px] font-mono font-semibold text-muted-foreground hover:text-foreground transition-colors w-full uppercase tracking-widest"
              >
                {contextOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {t("panel.deeperContext")}
              </button>
              {contextOpen && (
                <div className="mt-2 space-y-2">
                  {insight.genzSignal && (
                    <div>
                      <SectionHeader color="text-genz">{t("panel.genzSignal")}</SectionHeader>
                      <p className="text-[11px] text-foreground/80 leading-snug">{insight.genzSignal}</p>
                    </div>
                  )}
                  <div>
                    <SectionHeader color="text-muted-foreground">{t("panel.originalSignal")}</SectionHeader>
                    <p className="text-[10px] text-foreground/60 leading-snug">{selectedSignal.description}</p>
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
