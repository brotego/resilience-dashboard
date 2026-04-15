import { useState, useMemo } from "react";
import { COMPANIES, CompanyId } from "@/data/companies";
import { COMPANY_DASHBOARD_DATA } from "@/data/companyDashboardData";
import { UnifiedSignal } from "@/data/unifiedSignalTypes";
import { calculateResilienceScore } from "@/lib/resilienceScore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLang } from "@/i18n/LanguageContext";
import { ChevronDown, ChevronUp, ArrowRight } from "lucide-react";

type TimeFilter = "24h" | "7d" | "30d";

interface Props {
  selectedCompany: CompanyId | null;
  signals: UnifiedSignal[];
  onSignalClick: (signal: UnifiedSignal) => void;
}

function timeAgo(date: Date, lang: string): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (lang === "jp") {
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分前`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}時間前`;
    return `${Math.floor(seconds / 86400)}日前`;
  }
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// Assign random dates to signals that don't have them
function assignDates(signals: UnifiedSignal[]): (UnifiedSignal & { _date: Date })[] {
  const now = Date.now();
  return signals.map((s, i) => {
    if (s.date) return { ...s, _date: new Date(s.date) };
    // Deterministic pseudo-random based on id
    const hash = s.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const daysAgo = (hash * 7 + i * 3) % 30;
    const hoursAgo = (hash * 13 + i * 5) % 24;
    return { ...s, _date: new Date(now - daysAgo * 86400000 - hoursAgo * 3600000) };
  });
}

const URGENCY_BAR_COLORS: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-amber-500",
  low: "bg-muted-foreground/40",
};

const DOMAIN_LABELS: Record<string, { en: string; jp: string }> = {
  work: { en: "Work", jp: "仕事" },
  selfhood: { en: "Selfhood", jp: "自己" },
  community: { en: "Community", jp: "コミュニティ" },
  aging: { en: "Aging", jp: "高齢化" },
  environment: { en: "Environment", jp: "環境" },
};

const CompanyDashboard = ({ selectedCompany, signals, onSignalClick }: Props) => {
  const { lang, t } = useLang();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("7d");
  const [briefOpen, setBriefOpen] = useState(false);

  const companyId = selectedCompany || "mori_building";
  const company = COMPANIES.find(c => c.id === companyId)!;
  const dashData = COMPANY_DASHBOARD_DATA[companyId];

  // Filter and sort signals
  const datedSignals = useMemo(() => assignDates(signals), [signals]);

  const filteredSignals = useMemo(() => {
    const now = Date.now();
    const cutoff = timeFilter === "24h" ? 86400000 : timeFilter === "7d" ? 604800000 : 2592000000;
    return datedSignals
      .filter(s => now - s._date.getTime() < cutoff)
      .sort((a, b) => {
        const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return (urgencyOrder[a.urgency] || 3) - (urgencyOrder[b.urgency] || 3);
      });
  }, [datedSignals, timeFilter]);

  // Compute overall resilience score
  const overallScore = useMemo(() => {
    if (filteredSignals.length === 0) return 65;
    const avg = filteredSignals.reduce((sum, s) => sum + s.resilienceScore, 0) / filteredSignals.length;
    return Math.round(avg * 10);
  }, [filteredSignals]);

  const scoreTrend = overallScore > 65 ? "up" : overallScore < 50 ? "down" : "stable";

  return (
    <ScrollArea className="h-full">
      <div className="max-w-[1400px] mx-auto px-6 py-4">
        {/* Top area */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight text-foreground uppercase font-mono">
                {company.name}
              </h2>
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground bg-secondary px-2 py-0.5 rounded-sm">
                {company.sector}
              </span>
            </div>
            {/* Resilience score */}
            <div className="mt-3 flex items-end gap-3">
              <span className="text-[42px] font-mono font-semibold leading-none text-primary tabular-nums">
                {overallScore}
              </span>
              <div className="mb-1.5">
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block">
                  {lang === "jp" ? "レジリエンスエクスポージャー" : "RESILIENCE EXPOSURE"}
                </span>
                <div className="w-32 h-[3px] bg-muted rounded-sm mt-1 overflow-hidden">
                  <div className="h-full bg-primary rounded-sm" style={{ width: `${overallScore}%` }} />
                </div>
              </div>
              <span className={`text-[10px] font-mono mb-1.5 ${scoreTrend === "up" ? "text-emerald-400" : scoreTrend === "down" ? "text-red-400" : "text-muted-foreground"}`}>
                {scoreTrend === "up" ? "+" : scoreTrend === "down" ? "-" : "~"}
              </span>
            </div>
          </div>

          {/* Time filters */}
          <div className="flex gap-1">
            {(["24h", "7d", "30d"] as TimeFilter[]).map(tf => (
              <button
                key={tf}
                onClick={() => setTimeFilter(tf)}
                className={`px-3 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider rounded-sm transition-colors ${
                  timeFilter === tf
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Two column layout */}
        <div className="flex gap-6">
          {/* LEFT: Signal Feed — 60% */}
          <div className="flex-[3] min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-[10px] font-mono font-semibold uppercase tracking-widest text-muted-foreground">
                {lang === "jp" ? "アクティブシグナル" : "ACTIVE SIGNALS"}
              </h3>
              <span className="text-[10px] font-mono text-primary tabular-nums">
                {filteredSignals.length} {lang === "jp" ? "件" : "signals"}
              </span>
            </div>

            <div className="divide-y divide-border">
              {filteredSignals.map(signal => {
                const domainLabel = signal.domain ? (DOMAIN_LABELS[signal.domain]?.[lang] || signal.domain) : null;
                return (
                  <button
                    key={signal.id}
                    onClick={() => onSignalClick(signal)}
                    className="w-full text-left flex items-start gap-2 py-2.5 px-1 hover:bg-secondary/30 transition-colors group"
                  >
                    {/* Urgency bar */}
                    <div className={`w-[3px] self-stretch rounded-sm shrink-0 ${URGENCY_BAR_COLORS[signal.urgency]}`} />

                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-foreground leading-snug truncate group-hover:text-primary transition-colors">
                        {signal.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-snug truncate mt-0.5">
                        {signal.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[9px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-sm">
                          {signal.location}
                        </span>
                        {domainLabel && (
                          <span className="text-[9px] font-mono text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded-sm">
                            {domainLabel}
                          </span>
                        )}
                        <span className="text-[9px] font-mono text-muted-foreground/60 ml-auto">
                          {timeAgo(signal._date, lang)}
                        </span>
                      </div>
                    </div>

                    <ArrowRight className="h-3 w-3 text-muted-foreground/30 group-hover:text-primary shrink-0 mt-1 transition-colors" />
                  </button>
                );
              })}
              {filteredSignals.length === 0 && (
                <div className="py-8 text-center text-[11px] text-muted-foreground font-mono">
                  {lang === "jp" ? "この期間のシグナルはありません" : "No signals in this time period"}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Intelligence Summary — 40% */}
          <div className="flex-[2] min-w-0 space-y-4">
            {/* Rising Risks */}
            <div>
              <h3 className="text-[10px] font-mono font-semibold uppercase tracking-widest text-red-400 mb-2">
                {lang === "jp" ? "高まるリスク" : "RISING RISKS"}
              </h3>
              <div className="space-y-1.5">
                {dashData.risks.map((r, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
                    <p className="text-[11px] text-foreground/80 leading-snug">{r[lang] || r.en}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Rising Opportunities */}
            <div>
              <h3 className="text-[10px] font-mono font-semibold uppercase tracking-widest text-emerald-400 mb-2">
                {lang === "jp" ? "高まる機会" : "RISING OPPORTUNITIES"}
              </h3>
              <div className="space-y-1.5">
                {dashData.opportunities.map((o, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                    <p className="text-[11px] text-foreground/80 leading-snug">{o[lang] || o.en}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Gen Z Archetype Activation */}
            <div>
              <h3 className="text-[10px] font-mono font-semibold uppercase tracking-widest text-genz mb-2">
                {lang === "jp" ? "Z世代アーキタイプ活性度" : "GEN Z ARCHETYPE ACTIVATION"}
              </h3>
              <div className="space-y-2">
                {dashData.archetypes.map((a, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-foreground/70 w-28 shrink-0 truncate">
                      {a.name[lang] || a.name.en}
                    </span>
                    <div className="flex-1 h-[4px] bg-muted rounded-sm overflow-hidden">
                      <div className="h-full bg-genz rounded-sm transition-all" style={{ width: `${a.score * 20}%` }} />
                    </div>
                    <span className="text-[10px] font-mono font-semibold text-genz w-4 text-right">{a.score}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Company Brief — collapsible */}
            <div className="border-t border-border pt-3">
              <button
                onClick={() => setBriefOpen(!briefOpen)}
                className="flex items-center gap-1 text-[10px] font-mono font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors w-full"
              >
                {briefOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {lang === "jp" ? "企業ブリーフ" : "COMPANY BRIEF"}
              </button>
              {briefOpen && (
                <div className="mt-2 space-y-2">
                  <div>
                    <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">{lang === "jp" ? "ビジネスモデル" : "BUSINESS MODEL"}</span>
                    <p className="text-[11px] text-foreground/80 mt-0.5">{dashData.brief.businessModel[lang] || dashData.brief.businessModel.en}</p>
                  </div>
                  <div>
                    <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">{lang === "jp" ? "戦略的優先事項" : "STRATEGIC PRIORITIES"}</span>
                    <ul className="mt-0.5 space-y-0.5">
                      {dashData.brief.priorities.map((p, i) => (
                        <li key={i} className="text-[11px] text-foreground/80 flex items-start gap-1.5">
                          <span className="text-muted-foreground shrink-0">{i + 1}.</span>
                          {p[lang] || p.en}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">{lang === "jp" ? "主要市場" : "KEY MARKETS"}</span>
                    <p className="text-[11px] text-foreground/80 mt-0.5">{dashData.brief.keyMarkets[lang] || dashData.brief.keyMarkets.en}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
};

export default CompanyDashboard;
