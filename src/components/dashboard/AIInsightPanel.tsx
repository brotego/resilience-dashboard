import { X, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { DomainId, MindsetId } from "@/data/types";
import { GenZCategoryId } from "@/data/genzTypes";
import { DOMAINS } from "@/data/domains";
import { GENZ_CATEGORIES } from "@/data/genzCategories";
import { COMPANIES, CompanyId } from "@/data/companies";
import { UnifiedSignal } from "@/data/unifiedSignalTypes";
import { DashboardMode } from "./DashboardLayout";
import { invokeAiInsight } from "@/api/aiInsight";
import { calculateResilienceScore } from "@/lib/resilienceScore";
import { useLang } from "@/i18n/LanguageContext";
import { useJpUi } from "@/i18n/jpUiContext";
import { getCompanyDisplayName } from "@/i18n/companyLocale";
import type { TranslationKey } from "@/i18n/translations";

interface AIInsight {
  urgency: string;
  articleSummary?: string;
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
  onMoreInfo?: (signal: UnifiedSignal) => void;
  showMoreInfoButton?: boolean;
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

/** Auto-cycling preview of top signals when nothing is selected */
const AutoCyclePreview = ({ signals, onSignalClick }: { signals: UnifiedSignal[]; onSignalClick: (s: UnifiedSignal) => void }) => {
  const { t } = useLang();
  const { getSignalDisplay } = useJpUi();
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
  const disp = getSignalDisplay(signal);

  return (
    <div className="flex-1 flex flex-col">
      <button
        onClick={() => onSignalClick(signal)}
        className={`flex-1 flex flex-col justify-center px-4 transition-opacity duration-300 hover:bg-secondary/20 ${fade ? "opacity-100" : "opacity-0"}`}
      >
        <div className="space-y-2">
          <UrgencyBadge level={signal.urgency} />
          <h3 className="text-sm font-bold text-foreground leading-snug">{disp.title}</h3>
          <p className="text-[10px] font-mono text-muted-foreground">{disp.location}</p>
          <p className="text-[11px] text-foreground/60 leading-snug line-clamp-2">{disp.description}</p>
        </div>
      </button>
      <div className="px-4 pb-2 flex items-center justify-between">
        <div className="flex gap-1">
          {topSignals.map((_, i) => (
            <span key={i} className={`h-1 w-4 rounded-sm transition-colors ${i === index % topSignals.length ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>
        <span className="text-[8px] font-mono text-muted-foreground/50 uppercase tracking-widest">
          {t("panel.autoCycling")}
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
  onMoreInfo,
  showMoreInfoButton = false,
  signals = [],
}: Props) => {
  const { lang, t } = useLang();
  const { getSignalDisplay } = useJpUi();
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

    const key = `${selectedSignal.id}:${selectedCompany || "general"}:${lang}:${mode}`;
    if (key === lastSignalRef.current) return;
    lastSignalRef.current = key;

    const domainOrCategory = selectedSignal.domain
      ? DOMAINS.find(d => d.id === selectedSignal.domain)
      : selectedSignal.category
        ? GENZ_CATEGORIES.find(c => c.id === selectedSignal.category)
        : null;

    const domainOrCategoryLabel =
      selectedSignal.domain
        ? t(`domain.${selectedSignal.domain}` as TranslationKey)
        : selectedSignal.category
          ? t(`genz.${selectedSignal.category}` as TranslationKey)
          : "";

    setLoading(true);
    setError(null);

    const sUi = getSignalDisplay(selectedSignal);
    const companyForModel =
      lang === "jp" && company
        ? getCompanyDisplayName(company, lang)
        : company?.name || selectedCompany || null;

    invokeAiInsight({
        signalTitle: sUi.title,
        signalDescription: sUi.description,
        signalLocation: sUi.location,
        signalDomain: domainOrCategoryLabel,
        company: companyForModel,
        mode,
        language: lang,
      })
      .then(({ data, error: fnError }) => {
        if (fnError) { setError(t("panel.insightFailed")); }
        else if (data?.error) { setError(data.error); }
        else if (data) { setInsight(data as AIInsight); }
        setLoading(false);
      })
      .catch(() => {
        setError(t("panel.insightFailed"));
        setLoading(false);
      });
  }, [selectedSignal?.id, selectedCompany, lang, mode, t, getSignalDisplay]);

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

  const signalUi = getSignalDisplay(selectedSignal);
  const companyLabel = company ? getCompanyDisplayName(company, lang) : undefined;
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
            {domainOrCategory && (
              <Tag
                label={
                  selectedSignal.domain
                    ? t(`domain.${selectedSignal.domain}` as TranslationKey)
                    : t(`genz.${selectedSignal.category!}` as TranslationKey)
                }
                color="#1241ea"
              />
            )}
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
          <h2 className="text-[13px] font-bold text-foreground leading-snug">{signalUi.title}</h2>
          <p className="text-[10px] font-mono text-muted-foreground mt-1">
            {signalUi.location} · <span className="text-accent">{selectedSignal.source || t("panel.signalFallback")}</span> · <span className="text-muted-foreground/60">{relativeTime}</span>
          </p>
        </div>

        {/* RESILIENCE EXPOSURE SCORE */}
        <div className="rounded-sm bg-muted/30 border border-border p-2.5 space-y-1">
          <h4 className="text-[9px] font-mono font-bold uppercase tracking-widest text-muted-foreground">{t("panel.resilienceExposure")}</h4>
          <div className="pt-1">
            <div className="relative h-2 rounded-sm bg-muted overflow-hidden">
              <div className="absolute inset-y-0 left-0 bg-primary/30 rounded-sm transition-all" style={{ width: `${scoreBreakdown.total * 10}%` }} />
              <div
                className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full border border-primary bg-primary shadow-[0_0_0_2px_rgba(18,65,234,0.2)] transition-all"
                style={{ left: `calc(${scoreBreakdown.total * 10}% - 6px)` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[9px] font-mono text-muted-foreground">
              <span>{t("panel.marginalSignal")}</span>
              <span>{t("panel.companyFitSlider")}</span>
            </div>
          </div>
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
            {mode === "genz" && (insight.genzSignal || insight.whyItMatters) && (
              <div className="rounded-sm bg-genz/10 border border-genz/30 p-2.5">
                <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-genz mb-1">
                  {t("panel.genzSignal")}
                </h4>
                <p className="text-[12px] text-foreground leading-snug font-semibold whitespace-pre-wrap">
                  {(insight.genzSignal && insight.genzSignal.trim()) || insight.whyItMatters}
                </p>
              </div>
            )}

            {(insight.articleSummary || insight.headline) && (
              <div className="rounded-sm bg-muted/40 border border-border p-2.5">
                <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground mb-1">
                  {t("panel.articleSummary")}
                </h4>
                <p className="text-[11px] text-foreground/85 leading-snug">
                  {insight.articleSummary || insight.headline}
                </p>
              </div>
            )}

            {/* WHY IT MATTERS */}
            <div className="rounded-sm bg-primary/10 border border-primary/20 p-2.5">
              <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary mb-1">
                {t("panel.whyMatters")}{companyLabel ? ` — ${companyLabel}` : ""}
              </h4>
              <p className="text-[11px] text-foreground leading-snug">{insight.whyItMatters}</p>
            </div>

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
                  {insight.genzSignal && mode !== "genz" && (
                    <div>
                      <SectionHeader color="text-genz">{t("panel.genzSignal")}</SectionHeader>
                      <p className="text-[11px] text-foreground/80 leading-snug">{insight.genzSignal}</p>
                    </div>
                  )}
                  <div>
                    <SectionHeader color="text-muted-foreground">{t("panel.originalSignal")}</SectionHeader>
                    <p className="text-[10px] text-foreground/60 leading-snug">{signalUi.description}</p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      {showMoreInfoButton && (
        <div className="px-3 py-2 border-t border-border bg-card/90">
          <button
            onClick={() => onMoreInfo?.(selectedSignal)}
            className="w-full rounded-sm border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-mono font-semibold uppercase tracking-widest py-2 transition-colors"
          >
            {t("panel.moreInfo")}
          </button>
        </div>
      )}
    </div>
  );
};

export default AIInsightPanel;
