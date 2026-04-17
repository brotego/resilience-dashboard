import { useState, useMemo, useEffect } from "react";
import { COMPANIES, CompanyId } from "@/data/companies";
import { COMPANY_DASHBOARD_DATA } from "@/data/companyDashboardData";
import { UnifiedSignal } from "@/data/unifiedSignalTypes";
import { calculateResilienceScore } from "@/lib/resilienceScore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLang } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, ChevronUp, ArrowRight } from "lucide-react";

type TimeFilter = "24h" | "7d" | "30d";
type SentimentView = "company" | "japan";
type SentimentArticle = { title: string; source: string; description: string; date: string; url: string };

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

function toneFromArticle(article: SentimentArticle): "positive" | "mixed" | "negative" {
  const text = `${article.title} ${article.description}`.toLowerCase();
  const positiveHints = ["partnership", "growth", "expands", "trusted", "innovation", "agreement"];
  const negativeHints = ["tension", "risk", "decline", "pressure", "conflict", "crisis"];
  const hasPositive = positiveHints.some((hint) => text.includes(hint));
  const hasNegative = negativeHints.some((hint) => text.includes(hint));
  if (hasPositive && !hasNegative) return "positive";
  if (hasNegative && !hasPositive) return "negative";
  return "mixed";
}

const CompanyDashboard = ({ selectedCompany, signals, onSignalClick }: Props) => {
  const { lang, t } = useLang();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("7d");
  const [briefOpen, setBriefOpen] = useState(false);
  const [sentimentView, setSentimentView] = useState<SentimentView>("company");
  const [sentimentLoading, setSentimentLoading] = useState(false);
  const [sentimentArticles, setSentimentArticles] = useState<Record<SentimentView, SentimentArticle[]>>({
    company: [],
    japan: [],
  });

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

  const newsletter = useMemo(() => {
    const top = filteredSignals.slice(0, 5);
    const positives = top.filter((s) => s.urgency === "low" || s.urgency === "medium");
    const negatives = top.filter((s) => s.urgency === "high" || s.urgency === "critical");
    const hotspots = Array.from(new Set(top.map((s) => s.location))).slice(0, 3);
    const domains = Array.from(new Set(top.map((s) => s.domain || s.category || "cross-market"))).slice(0, 3);
    const refs = top
      .slice(0, 3)
      .map((s) => ({
        title: s.title,
        source: s.source || (lang === "jp" ? "Signal Feed" : "Signal Feed"),
      }));

    const refLineEn = refs.length
      ? refs.map((r) => `"${r.title}" (${r.source})`).join(", ")
      : "recent company-relevant coverage";
    const refLineJp = refs.length
      ? refs.map((r) => `「${r.title}」（${r.source}）`).join("、")
      : "直近の関連報道";

    const articleRoundup = top.map((s, i) => ({
      index: i + 1,
      title: s.title,
      source: s.source || (lang === "jp" ? "Signal Feed" : "Signal Feed"),
      location: s.location,
      sentiment: s.urgency === "critical" || s.urgency === "high" ? "negative" : s.urgency === "medium" ? "mixed" : "positive",
      summary:
        lang === "jp"
          ? `${company.name}にとって${s.location}発のこの動向は、短期の実行判断と中期の戦略設計の両面に影響します。${s.description.slice(0, 90)}...`
          : `For ${company.name}, this development from ${s.location} impacts both near-term operating choices and medium-term strategic positioning. ${s.description.slice(0, 100)}...`,
    }));

    if (lang === "jp") {
      return {
        title: `${company.name} 週次ニュースレター`,
        dek: `今週の注目記事を横断し、経営判断に必要な要点を1本に要約したエグゼクティブ・ダイジェスト。`,
        paragraphs: [
          `${refLineJp}といった記事群を起点に今週の論点を整理すると、${company.name}を取り巻く市場環境は、機会拡大と実行リスクが同時進行する局面です。見出し単体よりも、複数記事の共通テーマを横断して読むことで、どこに経営資源を集中すべきかが明確になります。`,
          `記事ベースで見ると、高優先シグナルは${negatives.length}件、機会寄りシグナルは${positives.length}件で、全体トーンは「慎重な前進」です。特に競争圧力・規制変化・需要シフトに関する報道は、短期の運用判断に直接影響しやすいため、意思決定のリードタイムを縮める体制が重要になります。`,
          `地域では${hotspots.join(" / ") || "グローバル"}の露出が高く、テーマは${domains.join(" / ")}に集中しています。次の7日間は、記事で示唆された変化を前提に、パートナー戦略、現場実行、対外メッセージを一体化して運用することで、ノイズの多いニュース環境でも優位性を維持しやすくなります。`,
        ],
        roundupTitle: "記事ラウンドアップ",
        articleRoundup,
      };
    }

    return {
      title: `${company.name} Weekly Newsletter`,
      dek: `An editorial-style digest that turns this week's most relevant headlines into a single readable brief for leadership.`,
      paragraphs: [
        `This week's newsletter is built directly from the most relevant article set for ${company.name}, led by ${refLineEn}. Read together, these stories show a market narrative where expansion potential is real, but execution quality will determine whether momentum converts into durable advantage.`,
        `At the article level, ${negatives.length} high-priority developments signal near-term pressure on positioning, operating cadence, or risk exposure. In parallel, ${positives.length} opportunity-leaning articles point to upside if leadership can sequence decisions quickly and avoid fragmented responses across teams.`,
        `Coverage intensity is strongest in ${hotspots.join(" / ") || "Global"}, and the dominant theme stack is ${domains.join(" / ")}. For the next seven days, treat these headlines as directional inputs for partnership moves, resource allocation, and external messaging so tactical actions stay aligned with the broader market story.`,
      ],
      roundupTitle: "Article Roundup",
      articleRoundup,
    };
  }, [filteredSignals, company.name, lang]);

  const activeSentimentArticles = sentimentArticles[sentimentView];
  const activeSentimentSummary = sentimentView === "japan"
    ? (lang === "jp"
      ? "グローバル報道における日本関連センチメントを表示。"
      : "Global coverage sentiment related to Japan.")
    : (lang === "jp"
      ? `${company.name}に関するグローバル報道センチメントを表示。`
      : `Global coverage sentiment related to ${company.name}.`);

  const sentimentBadgeClasses: Record<"positive" | "mixed" | "negative", string> = {
    positive: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
    mixed: "text-sky-300 border-sky-500/40 bg-sky-500/10",
    negative: "text-red-300 border-red-500/40 bg-red-500/10",
  };

  const newsletterToneClasses: Record<"positive" | "mixed" | "negative", string> = {
    positive: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
    mixed: "text-sky-300 border-sky-500/40 bg-sky-500/10",
    negative: "text-red-300 border-red-500/40 bg-red-500/10",
  };

  useEffect(() => {
    const companyKeywords = company.keywords.slice(0, 4).map((k) => `"${k}"`).join(" | ");
    const companyQuery = `"${company.name}"${companyKeywords ? ` | (${companyKeywords})` : ""}`;
    const japanQuery = `"Japan" | Japanese | "Japanese government" | "Japanese companies"`;

    let cancelled = false;
    setSentimentLoading(true);

    Promise.all([
      supabase.functions.invoke("news-feed", {
        body: { type: "sentiment", topicQuery: companyQuery, pageSize: 8 },
      }),
      supabase.functions.invoke("news-feed", {
        body: { type: "sentiment", topicQuery: japanQuery, pageSize: 8 },
      }),
    ])
      .then(([companyData, japanData]) => {
        if (cancelled) return;
        setSentimentArticles({
          company: companyData.data?.articles || [],
          japan: japanData.data?.articles || [],
        });
        setSentimentLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setSentimentArticles({ company: [], japan: [] });
        setSentimentLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [company.id]);

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
            {/* Company fit position bar */}
            <div className="mt-3">
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block">
                {lang === "jp" ? "COMPANY FIT" : "COMPANY FIT"}
              </span>
              <div className="relative w-56 h-[6px] bg-muted rounded-sm mt-1 overflow-hidden">
                <div className="absolute inset-y-0 left-0 bg-primary/30 rounded-sm" style={{ width: `${overallScore}%` }} />
                <div
                  className="absolute top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full border border-primary bg-primary"
                  style={{ left: `calc(${overallScore}% - 5px)` }}
                />
              </div>
              <div className="mt-1.5 w-56 flex items-center justify-between text-[9px] font-mono text-muted-foreground">
                <span>Marginal signal</span>
                <span>Company fit</span>
              </div>
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
            <div className="border border-border rounded-sm bg-card/60 p-3">
              <h3 className="text-[10px] font-mono font-semibold uppercase tracking-widest text-primary mb-2">
                {lang === "jp" ? "ニュースレター要約" : "NEWSLETTER SUMMARY"}
              </h3>
              <h4 className="text-[12px] font-semibold text-foreground mb-1">{newsletter.title}</h4>
              <p className="text-[10px] text-muted-foreground mb-2 leading-snug">{newsletter.dek}</p>
              <div className="mt-2 space-y-2">
                {newsletter.paragraphs.map((paragraph, i) => (
                  <p key={i} className="text-[11px] text-foreground/80 leading-relaxed">
                    {paragraph}
                  </p>
                ))}
              </div>

              <div className="mt-3 pt-3 border-t border-border/70">
                <h5 className="text-[10px] font-mono font-semibold uppercase tracking-widest text-accent mb-2">
                  {newsletter.roundupTitle}
                </h5>
                <div className="space-y-2">
                  {newsletter.articleRoundup.map((article) => (
                    <div key={article.index} className="border border-border/70 rounded-sm p-2 bg-background/40">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[11px] text-foreground leading-snug">
                          {article.index}. {article.title}
                        </p>
                        <span className={`shrink-0 px-1.5 py-0.5 rounded-sm border text-[8px] font-mono font-semibold uppercase tracking-wider ${newsletterToneClasses[article.sentiment as "positive" | "mixed" | "negative"]}`}>
                          {article.sentiment}
                        </span>
                      </div>
                      <p className="text-[9px] font-mono text-muted-foreground mt-1 uppercase tracking-wider">
                        {article.source} · {article.location}
                      </p>
                      <p className="text-[10px] text-foreground/70 mt-1 leading-snug">{article.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

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

        <div className="mt-6 border-t border-border pt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] font-mono font-semibold uppercase tracking-widest text-accent">
              {lang === "jp" ? "センチメント分析" : "SENTIMENT ANALYSIS"}
            </h3>
            <div className="flex gap-1">
              <button
                onClick={() => setSentimentView("company")}
                className={`px-2 py-0.5 text-[9px] font-mono font-semibold uppercase tracking-wider rounded-sm transition-colors ${
                  sentimentView === "company" ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {lang === "jp" ? "COMPANY" : "COMPANY"}
              </button>
              <button
                onClick={() => setSentimentView("japan")}
                className={`px-2 py-0.5 text-[9px] font-mono font-semibold uppercase tracking-wider rounded-sm transition-colors ${
                  sentimentView === "japan" ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {lang === "jp" ? "JAPAN" : "JAPAN"}
              </button>
            </div>
          </div>

          <div className="border border-border rounded-sm bg-card/60 px-3 py-2 mb-2">
            <p className="text-[11px] text-foreground/85 leading-snug">
              {activeSentimentSummary}
            </p>
          </div>

          <div className="divide-y divide-border border border-border rounded-sm overflow-hidden">
            {sentimentLoading ? (
              <div className="px-3 py-2.5 text-[10px] text-muted-foreground">
                {lang === "jp" ? "関連報道を読み込み中..." : "Loading relevant coverage..."}
              </div>
            ) : activeSentimentArticles.length > 0 ? (
              activeSentimentArticles.map((article, idx) => {
                const sentiment = toneFromArticle(article);
                const date = article.date ? new Date(article.date) : new Date();
                return (
                  <div key={`${sentimentView}-${idx}`} className="px-3 py-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] text-foreground leading-snug">
                          {article.title}
                        </p>
                        <p className="text-[9px] font-mono text-muted-foreground mt-1 uppercase tracking-wider">
                          {article.source} · {timeAgo(date, lang)}
                        </p>
                        <p className="text-[10px] text-foreground/65 mt-1">
                          {article.description || (lang === "jp" ? "要約なし" : "No summary available")}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 px-1.5 py-0.5 rounded-sm border text-[8px] font-mono font-semibold uppercase tracking-wider ${sentimentBadgeClasses[sentiment]}`}
                      >
                        {sentiment}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="px-3 py-2.5 text-[10px] text-muted-foreground">
                {lang === "jp" ? "この条件の関連報道はまだありません。" : "No relevant coverage found for this filter yet."}
              </div>
            )}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
};

export default CompanyDashboard;
