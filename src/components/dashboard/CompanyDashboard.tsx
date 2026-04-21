import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { translateJapaneseArticleRows } from "@/api/translateJapaneseUi";
import { useJpUi } from "@/i18n/jpUiContext";
import { getCompanyDisplayName, getCompanyDisplaySector } from "@/i18n/companyLocale";
import { COMPANIES, CompanyId } from "@/data/companies";
import { COMPANY_DASHBOARD_DATA } from "@/data/companyDashboardData";
import { UnifiedSignal } from "@/data/unifiedSignalTypes";
import { calculateResilienceScore } from "@/lib/resilienceScore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLang } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translations";
import { invokeNewsFeed } from "@/api/newsFeed";
import {
  invokeArticleSentimentBatch,
  invokeSentimentFallbackOpinion,
  invokeCompanyNewsletter,
  invokeSentimentSectionSummary,
  ArticleSentiment,
} from "@/api/aiInsight";
import { buildArticlePageSignal } from "@/lib/articlePageSignal";
import {
  articleStrictlyAboutCompany,
  isJapanInternationalCoverageArticle,
} from "@/lib/sentimentArticleFilters";
import { ChevronDown, ChevronUp, ArrowRight } from "lucide-react";

type TimeFilter = "24h" | "7d" | "30d";
type SentimentView = "company" | "japan";
type SentimentArticle = { id: string; title: string; source: string; description: string; date: string; url: string };

type NewsletterArticleRoundup = {
  index: number;
  title: string;
  source: string;
  location: string;
  sentiment: "positive" | "mixed" | "negative";
  summary: string;
  url?: string;
  signalId: string;
};

type NewsletterBlock = {
  title: string;
  dek: string;
  paragraphs: string[];
  roundupTitle: string;
  articleRoundup: NewsletterArticleRoundup[];
  risingRisks: string[];
  risingOpportunities: string[];
};

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

function sentimentToneLabel(tone: ArticleSentiment, t: (key: TranslationKey) => string): string {
  return t(`sentiment.${tone}` as TranslationKey);
}

const CompanyDashboard = ({ selectedCompany, signals, onSignalClick }: Props) => {
  const navigate = useNavigate();
  const { lang, t } = useLang();
  const { getSignalDisplay } = useJpUi();
  const [jpSentimentArticleMap, setJpSentimentArticleMap] = useState<
    Record<string, { title: string; description: string }>
  >({});
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("7d");
  const [briefOpen, setBriefOpen] = useState(false);
  const [sentimentView, setSentimentView] = useState<SentimentView>("company");
  const [sentimentLoading, setSentimentLoading] = useState(false);
  const [sentimentArticles, setSentimentArticles] = useState<Record<SentimentView, SentimentArticle[]>>({
    company: [],
    japan: [],
  });
  const [sentimentLabels, setSentimentLabels] = useState<Record<SentimentView, Record<string, ArticleSentiment>>>({
    company: {},
    japan: {},
  });
  const [sentimentFallbackOpinion, setSentimentFallbackOpinion] = useState<Record<SentimentView, { tone: ArticleSentiment; opinion: string } | null>>({
    company: null,
    japan: null,
  });
  const [sentimentAiSummary, setSentimentAiSummary] = useState<Record<SentimentView, string | null>>({
    company: null,
    japan: null,
  });
  const [sentimentSummaryLoading, setSentimentSummaryLoading] = useState(false);
  const [aiNewsletter, setAiNewsletter] = useState<NewsletterBlock | null>(null);
  const [aiNewsletterActive, setAiNewsletterActive] = useState(false);

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

  const fallbackNewsletter = useMemo(() => {
    const top = filteredSignals.slice(0, 5);
    const positives = top.filter((s) => s.urgency === "low" || s.urgency === "medium");
    const negatives = top.filter((s) => s.urgency === "high" || s.urgency === "critical");
    const hotspots = Array.from(new Set(top.map((s) => s.location))).slice(0, 3);
    const domains = Array.from(new Set(top.map((s) => s.domain || s.category || "cross-market"))).slice(0, 3);
    const refs = top
      .slice(0, 3)
      .map((s) => ({
        title: s.title,
        source: s.source || t("dashboard.signalFeed"),
      }));

    const refLineEn = refs.length
      ? refs.map((r) => `"${r.title}" (${r.source})`).join(", ")
      : "recent company-relevant coverage";
    const refLineJp = refs.length
      ? refs.map((r) => `「${r.title}」（${r.source}）`).join("、")
      : "直近の関連報道";

    const articleRoundup: NewsletterArticleRoundup[] = top.map((s, i) => ({
      index: i + 1,
      title: s.title,
      source: s.source || t("dashboard.signalFeed"),
      location: s.location,
      sentiment: s.urgency === "critical" || s.urgency === "high" ? "negative" : s.urgency === "medium" ? "mixed" : "positive",
      summary:
        lang === "jp"
          ? `${company.name}にとって${s.location}発のこの動向は、短期の実行判断と中期の戦略設計の両面に影響します。${s.description.slice(0, 90)}...`
          : `For ${company.name}, this development from ${s.location} impacts both near-term operating choices and medium-term strategic positioning. ${s.description.slice(0, 100)}...`,
      url: s.articleUrl && s.articleUrl !== "#" ? s.articleUrl : undefined,
      signalId: s.id,
    }));

    const risingRisks =
      negatives.length > 0
        ? negatives.slice(0, 4).map((s) =>
            lang === "jp"
              ? `「${s.title}」— 緊急度が高く、実行・評判リスクの監視が必要です。`
              : `"${s.title}" — elevated urgency; monitor execution and reputational exposure.`,
          )
        : [
            lang === "jp"
              ? "この週の上位セットに顕著なリスク集中はありません。"
              : "No acute risk concentration in this week's top signal set.",
          ];

    const risingOpportunities =
      positives.length > 0
        ? positives.slice(0, 4).map((s) =>
            lang === "jp"
              ? `「${s.title}」— 機会ウィンドウの検討に値する動きです。`
              : `"${s.title}" — worth evaluating as a potential opportunity window.`,
          )
        : [
            lang === "jp"
              ? "明確な機会シグナルは限定的です。継続監視を推奨します。"
              : "Limited clear opportunity signals in this slice; keep monitoring.",
          ];

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
        risingRisks,
        risingOpportunities,
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
      risingRisks,
      risingOpportunities,
    };
  }, [filteredSignals, company.name, lang, t]);
  const newsletter: NewsletterBlock = aiNewsletter || fallbackNewsletter;

  const openRoundupEntry = useCallback(
    (article: NewsletterArticleRoundup) => {
      const url = article.url?.trim();
      const mergedUrl = url && url !== "#" ? url : undefined;
      const sig = filteredSignals.find((s) => s.id === article.signalId);
      const signal =
        sig ||
        buildArticlePageSignal({
          id: article.signalId,
          title: article.title,
          description: article.summary || article.title,
          source: article.source,
          location: article.location,
          articleUrl: mergedUrl,
        });
      navigate(`/signal/${encodeURIComponent(signal.id)}`, {
        state: {
          signal,
          mode: "resilience",
          selectedCompany: companyId,
          originTab: "dashboard",
          originMode: "resilience",
        },
      });
    },
    [filteredSignals, navigate, companyId],
  );

  const openSentimentArticle = useCallback(
    (article: SentimentArticle) => {
      const signal = buildArticlePageSignal({
        id: article.id,
        title: article.title,
        description: article.description || article.title,
        source: article.source,
        location: sentimentView === "japan" ? "Japan" : "Global",
        date: article.date,
        articleUrl: article.url,
      });
      navigate(`/signal/${encodeURIComponent(signal.id)}`, {
        state: {
          signal,
          mode: "resilience",
          selectedCompany: companyId,
          originTab: "dashboard",
          originMode: "resilience",
        },
      });
    },
    [navigate, companyId, sentimentView],
  );

  const activeSentimentArticles = sentimentArticles[sentimentView];
  const companyNameUi = getCompanyDisplayName(company, lang);
  const activeSentimentSummary = sentimentView === "japan"
    ? (lang === "jp"
      ? "グローバル主要報道における日本関連の論調を、好意・慎重・懸念のバランスで要約しています。単発ニュースではなく、複数記事の共通トーンを捉えることで、対外コミュニケーションや市場対応の優先度を判断しやすくします。"
      : "This section summarizes global media sentiment toward Japan by balancing positive, cautious, and risk-heavy narratives. It is designed to capture cross-article tone direction rather than isolated headlines, helping with better market messaging and timing decisions.")
    : (lang === "jp"
      ? `${companyNameUi}に関するグローバル報道の温度感を、期待要因と懸念要因の両面から整理しています。短期的なノイズではなく、継続的に繰り返される評価軸を把握することで、事業優先順位と実行リスク対応の精度を高めます。`
      : `This section shows global sentiment around ${company.name} by organizing both upside narratives and concern signals. It focuses on recurring sentiment patterns across coverage, so strategic priorities and execution risk responses can be set with more confidence.`);

  const sentimentArticlesSig = useMemo(
    () => activeSentimentArticles.map((a) => a.id).join("|"),
    [activeSentimentArticles],
  );

  useEffect(() => {
    if (lang !== "jp" || activeSentimentArticles.length === 0) {
      setJpSentimentArticleMap({});
      return;
    }
    let cancelled = false;
    translateJapaneseArticleRows(
      activeSentimentArticles.slice(0, 14).map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description || "",
      })),
    ).then((map) => {
      if (!cancelled) setJpSentimentArticleMap(map);
    });
    return () => {
      cancelled = true;
    };
  }, [lang, sentimentArticlesSig]);

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

  const withTimeout = async <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<T>((resolve) => {
      timeout = setTimeout(() => resolve(fallback), ms);
    });
    const result = await Promise.race([promise, timeoutPromise]);
    if (timeout) clearTimeout(timeout);
    return result;
  };

  useEffect(() => {
    const markerSlice = (company.sentimentBrandMarkers ?? company.keywords).slice(0, 6);
    const companyQuery =
      `"${company.name}"` + (markerSlice.length ? ` | (${markerSlice.map((k) => `"${k}"`).join(" | ")})` : "");
    const japanQuery =
      '"Japan" OR "Japanese economy" OR "Japanese government" OR "Bank of Japan" OR "Tokyo Japan" OR "Osaka Japan"';

    let cancelled = false;
    setSentimentLoading(true);
    setSentimentAiSummary({ company: null, japan: null });
    setSentimentSummaryLoading(false);

    Promise.all([
      withTimeout(
        invokeNewsFeed({ type: "sentiment", topicQuery: companyQuery, pageSize: 45 }),
        12000,
        { data: { articles: [] }, error: new Error("timeout") },
      ),
      withTimeout(
        invokeNewsFeed({ type: "sentiment", topicQuery: japanQuery, pageSize: 45 }),
        12000,
        { data: { articles: [] }, error: new Error("timeout") },
      ),
    ])
      .then(async ([companyData, japanData]) => {
        if (cancelled) return;
        const rawCompanyArticles = (companyData.data?.articles || [])
          .map((a, idx) => ({ ...a, id: a.url || `${a.title}-${idx}` }));
        const rawJapanArticles = (japanData.data?.articles || [])
          .map((a, idx) => ({ ...a, id: a.url || `${a.title}-${idx}` }));

        const companyArticles = rawCompanyArticles
          .filter((a) => articleStrictlyAboutCompany(a, company))
          .slice(0, 8);
        const japanArticles = rawJapanArticles
          .filter((a) => isJapanInternationalCoverageArticle(a))
          .slice(0, 8);

        const [companySentiment, japanSentiment, companyOpinion, japanOpinion] = await Promise.all([
          withTimeout(
            invokeArticleSentimentBatch({
              lens: "company",
              company: company.name,
              industry: company.sector,
              language: lang,
              articles: companyArticles.map((a) => ({
                id: a.id,
                title: a.title,
                description: a.description,
                source: a.source,
                date: a.date,
                url: a.url,
              })),
            }),
            12000,
            { data: {}, error: new Error("timeout") },
          ),
          withTimeout(
            invokeArticleSentimentBatch({
              lens: "japan",
              countryName: "Japan",
              language: lang,
              articles: japanArticles.map((a) => ({
                id: a.id,
                title: a.title,
                description: a.description,
                source: a.source,
                date: a.date,
                url: a.url,
              })),
            }),
            12000,
            { data: {}, error: new Error("timeout") },
          ),
          companyArticles.length === 0
            ? withTimeout(
                invokeSentimentFallbackOpinion({
                  lens: "company",
                  company: company.name,
                  industry: company.sector,
                  language: lang,
                }),
                12000,
                { data: null, error: new Error("timeout") },
              )
            : Promise.resolve({ data: null, error: null }),
          japanArticles.length === 0
            ? withTimeout(
                invokeSentimentFallbackOpinion({
                  lens: "japan",
                  countryName: "Japan",
                  language: lang,
                }),
                12000,
                { data: null, error: new Error("timeout") },
              )
            : Promise.resolve({ data: null, error: null }),
        ]);

        if (cancelled) return;
        setSentimentArticles({
          company: companyArticles,
          japan: japanArticles,
        });
        setSentimentLabels({
          company: companySentiment.data || {},
          japan: japanSentiment.data || {},
        });
        setSentimentFallbackOpinion({
          company: companyOpinion.data || null,
          japan: japanOpinion.data || null,
        });
        setSentimentLoading(false);

        const coLabels = companySentiment.data || {};
        const jaLabels = japanSentiment.data || {};
        const coInputs = companyArticles.map((a) => ({
          id: a.id,
          title: a.title,
          description: a.description,
          source: a.source,
          tone: (coLabels[a.id] as ArticleSentiment) || "mixed",
        }));
        const jaInputs = japanArticles.map((a) => ({
          id: a.id,
          title: a.title,
          description: a.description,
          source: a.source,
          tone: (jaLabels[a.id] as ArticleSentiment) || "mixed",
        }));

        setSentimentSummaryLoading(true);
        Promise.all([
          coInputs.length > 0
            ? withTimeout(
                invokeSentimentSectionSummary({
                  lens: "company",
                  company: company.name,
                  industry: company.sector,
                  language: lang,
                  articles: coInputs,
                }),
                14000,
                { data: null, error: new Error("timeout") },
              )
            : Promise.resolve({ data: null, error: null }),
          jaInputs.length > 0
            ? withTimeout(
                invokeSentimentSectionSummary({
                  lens: "japan",
                  countryName: "Japan",
                  language: lang,
                  articles: jaInputs,
                }),
                14000,
                { data: null, error: new Error("timeout") },
              )
            : Promise.resolve({ data: null, error: null }),
        ]).then(([rCo, rJa]) => {
          if (cancelled) return;
          setSentimentAiSummary({
            company: rCo.data?.summary ?? null,
            japan: rJa.data?.summary ?? null,
          });
          setSentimentSummaryLoading(false);
        }).catch(() => {
          if (cancelled) return;
          setSentimentAiSummary({ company: null, japan: null });
          setSentimentSummaryLoading(false);
        });
      })
      .catch(() => {
        if (cancelled) return;
        setSentimentArticles({ company: [], japan: [] });
        setSentimentLabels({ company: {}, japan: {} });
        setSentimentFallbackOpinion({ company: null, japan: null });
        setSentimentAiSummary({ company: null, japan: null });
        setSentimentSummaryLoading(false);
        setSentimentLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [company.id, lang]);

  const newsletterCandidates = useMemo(
    () =>
      filteredSignals.slice(0, 30).map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        source: s.source,
        location: s.location,
        urgency: s.urgency,
        domain: s.domain || s.category,
        articleUrl: s.articleUrl,
      })),
    [filteredSignals],
  );
  const newsletterCandidatesKey = useMemo(
    () => newsletterCandidates.map((s) => `${s.id}:${s.title}:${s.articleUrl ?? ""}`).join("|"),
    [newsletterCandidates],
  );

  useEffect(() => {
    let cancelled = false;
    if (newsletterCandidates.length === 0) {
      setAiNewsletter(null);
      setAiNewsletterActive(false);
      return;
    }
    invokeCompanyNewsletter({
      company: company.name,
      industry: company.sector,
      language: lang,
      signals: newsletterCandidates,
    })
      .then((result) => {
        if (cancelled) return;
        if (!result.data) {
          setAiNewsletter(null);
          setAiNewsletterActive(false);
          return;
        }
        const urlById = new Map(newsletterCandidates.map((c) => [c.id, c.articleUrl?.trim() || ""]));
        const mapped: NewsletterArticleRoundup[] = result.data.roundup.slice(0, 5).map((a, i) => {
          const fromApi = a.url?.trim() || "";
          const fromCandidate = urlById.get(a.id) || "";
          const merged = fromApi || fromCandidate;
          return {
            index: i + 1,
            title: a.title,
            source: a.source,
            location: a.location,
            sentiment: a.sentiment,
            summary: a.summary,
            signalId: a.id,
            ...(merged && merged !== "#" ? { url: merged } : {}),
          };
        });
        const riskFallback = mapped
          .filter((a) => a.sentiment === "negative")
          .map((a) =>
            lang === "jp" ? `「${a.title}」— ネガティブ寄りの論調・リスク要因の監視が必要です。` : `"${a.title}" — watch for adverse narrative or downside risk.`,
          );
        const oppFallback = mapped
          .filter((a) => a.sentiment === "positive")
          .map((a) =>
            lang === "jp" ? `「${a.title}」— ポジティブ寄りの論調・追い風の検討に値します。` : `"${a.title}" — favorable narrative worth tracking for upside.`,
          );
        const risingRisks =
          result.data.risingRisks?.length > 0
            ? result.data.risingRisks
            : riskFallback.length > 0
              ? riskFallback.slice(0, 4)
              : [
                  lang === "jp"
                    ? "選定シグナルから顕著なリスクは抽出できませんでした。"
                    : "No distinct risk themes extracted from the selected set.",
                ];
        const risingOpportunities =
          result.data.risingOpportunities?.length > 0
            ? result.data.risingOpportunities
            : oppFallback.length > 0
              ? oppFallback.slice(0, 4)
              : [
                  lang === "jp"
                    ? "選定シグナルから顕著な機会は抽出できませんでした。"
                    : "No distinct opportunity themes extracted from the selected set.",
                ];
        setAiNewsletter({
          title: result.data.title,
          dek: result.data.dek,
          paragraphs: result.data.paragraphs,
          roundupTitle: result.data.roundupTitle,
          articleRoundup: mapped,
          risingRisks,
          risingOpportunities,
        });
        setAiNewsletterActive(true);
      })
      .catch(() => {
        if (cancelled) return;
        setAiNewsletter(null);
        setAiNewsletterActive(false);
      });
    return () => {
      cancelled = true;
    };
  }, [company.id, company.name, company.sector, lang, newsletterCandidatesKey]);

  return (
    <ScrollArea className="h-full">
      <div className="max-w-[1400px] mx-auto px-6 py-4">
        {/* Top area */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight text-foreground uppercase font-mono">
                {companyNameUi}
              </h2>
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground bg-secondary px-2 py-0.5 rounded-sm">
                {getCompanyDisplaySector(company, lang)}
              </span>
            </div>
            {/* Company fit position bar */}
            <div className="mt-3">
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block">
                {t("dashboard.companyFitHeader")}
              </span>
              <div className="relative w-56 h-[6px] bg-muted rounded-sm mt-1 overflow-hidden">
                <div className="absolute inset-y-0 left-0 bg-primary/30 rounded-sm" style={{ width: `${overallScore}%` }} />
                <div
                  className="absolute top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full border border-primary bg-primary"
                  style={{ left: `calc(${overallScore}% - 5px)` }}
                />
              </div>
              <div className="mt-1.5 w-56 flex items-center justify-between text-[9px] font-mono text-muted-foreground">
                <span>{t("panel.marginalSignal")}</span>
                <span>{t("panel.companyFitSlider")}</span>
              </div>
            </div>
          </div>

          {/* Time filters */}
          <div className="flex gap-1">
            {(["24h", "7d", "30d"] as TimeFilter[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeFilter(tf)}
                className={`px-3 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider rounded-sm transition-colors ${
                  timeFilter === tf
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {tf === "24h" ? t("dashboard.time24h") : tf === "7d" ? t("dashboard.time7d") : t("dashboard.time30d")}
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
                {t("dashboard.activeSignals")}
              </h3>
              <span className="text-[10px] font-mono text-primary tabular-nums">
                {filteredSignals.length}
                {lang === "jp" ? "" : " "}
                {t("header.signalsUnit")}
              </span>
            </div>

            <div className="divide-y divide-border">
              {filteredSignals.map(signal => {
                const disp = getSignalDisplay(signal);
                const domainLabel = signal.domain
                  ? t(`domain.${signal.domain}` as TranslationKey)
                  : signal.category
                    ? t(`genz.${signal.category}` as TranslationKey)
                    : null;
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
                        {disp.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-snug truncate mt-0.5">
                        {disp.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[9px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-sm">
                          {disp.location}
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
                  {t("dashboard.noSignalsPeriod")}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Intelligence Summary — 40% */}
          <div className="flex-[2] min-w-0 space-y-4">
            <div className="border border-border rounded-sm bg-card/60 p-3">
              <h3 className="text-[10px] font-mono font-semibold uppercase tracking-widest text-primary mb-2">
                {t("dashboard.newsletterSummary")}
              </h3>
              {aiNewsletterActive && (
                <p className="text-[9px] font-mono uppercase tracking-wider text-emerald-300 mb-1">
                  {t("dashboard.aiCurated")}
                </p>
              )}
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
                  {newsletter.articleRoundup.map((article) => {
                    const hint = t("dashboard.openArticlePage");
                    return (
                      <button
                        key={article.index}
                        type="button"
                        onClick={() => openRoundupEntry(article)}
                        title={hint}
                        className="w-full text-left border border-border/70 rounded-sm p-2 bg-background/40 hover:bg-background/70 hover:border-primary/40 transition-colors cursor-pointer group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[11px] text-foreground leading-snug group-hover:text-primary">
                            {article.index}. {article.title}
                          </p>
                          <span
                            className={`shrink-0 px-1.5 py-0.5 rounded-sm border text-[8px] font-mono font-semibold uppercase tracking-wider ${newsletterToneClasses[article.sentiment as "positive" | "mixed" | "negative"]}`}
                          >
                            {sentimentToneLabel(article.sentiment as ArticleSentiment, t)}
                          </span>
                        </div>
                        <p className="text-[9px] font-mono text-muted-foreground mt-1 uppercase tracking-wider">
                          {article.source} · {article.location}
                        </p>
                        <p className="text-[10px] text-foreground/70 mt-1 leading-snug">{article.summary}</p>
                        <p className="text-[9px] font-mono text-muted-foreground/80 mt-1.5 uppercase tracking-wider">
                          {hint}
                          <ArrowRight className="inline h-3 w-3 ml-1 align-text-bottom opacity-60 group-hover:opacity-100 group-hover:text-primary transition-opacity" />
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="border border-border rounded-sm bg-card/60 p-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-mono font-semibold uppercase tracking-widest text-accent">
                  {t("dashboard.sentimentAnalysis")}
                </h3>
                <div className="flex gap-1">
                  <button
                    onClick={() => setSentimentView("company")}
                    className={`px-2 py-0.5 text-[9px] font-mono font-semibold uppercase tracking-wider rounded-sm transition-colors ${
                      sentimentView === "company" ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t("dashboard.colCompany")}
                  </button>
                  <button
                    onClick={() => setSentimentView("japan")}
                    className={`px-2 py-0.5 text-[9px] font-mono font-semibold uppercase tracking-wider rounded-sm transition-colors ${
                      sentimentView === "japan" ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t("dashboard.colJapan")}
                  </button>
                </div>
              </div>

              <div className="border border-border rounded-sm bg-background/40 px-3 py-2 mb-2">
                <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
                  {t("dashboard.sentimentAiOverviewLabel")}
                </p>
                {sentimentSummaryLoading && !sentimentAiSummary[sentimentView] ? (
                  <p className="text-[11px] text-muted-foreground leading-snug">{t("dashboard.generatingSentimentOverview")}</p>
                ) : sentimentAiSummary[sentimentView] ? (
                  <p className="text-[11px] text-foreground/85 leading-snug">{sentimentAiSummary[sentimentView]}</p>
                ) : (
                  <p className="text-[11px] text-foreground/85 leading-snug">{activeSentimentSummary}</p>
                )}
              </div>

              <div className="divide-y divide-border border border-border rounded-sm overflow-hidden">
                {sentimentLoading ? (
                  <div className="px-3 py-2.5 text-[10px] text-muted-foreground">
                    {t("dashboard.loadingCoverage")}
                  </div>
                ) : activeSentimentArticles.length > 0 ? (
                  activeSentimentArticles.map((article, idx) => {
                    const trArt = jpSentimentArticleMap[article.id];
                    const titleUi = lang === "jp" && trArt?.title ? trArt.title : article.title;
                    const descUi =
                      lang === "jp" && trArt?.description
                        ? trArt.description
                        : article.description || t("dashboard.noSummary");
                    const sentiment = sentimentLabels[sentimentView][article.id] || "mixed";
                    const date = article.date ? new Date(article.date) : new Date();
                    return (
                      <button
                        key={`${sentimentView}-${idx}`}
                        type="button"
                        onClick={() => openSentimentArticle(article)}
                        title={t("dashboard.openArticlePage")}
                        className="w-full text-left px-3 py-2.5 hover:bg-muted/40 transition-colors cursor-pointer group"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[11px] text-foreground leading-snug group-hover:text-primary">
                              {titleUi}
                            </p>
                            <p className="text-[9px] font-mono text-muted-foreground mt-1 uppercase tracking-wider">
                              {article.source} · {timeAgo(date, lang)}
                            </p>
                            <p className="text-[10px] text-foreground/65 mt-1">
                              {descUi}
                            </p>
                            <p className="text-[9px] font-mono text-muted-foreground/80 mt-1.5 uppercase tracking-wider">
                              {t("dashboard.openArticlePage")}
                              <ArrowRight className="inline h-3 w-3 ml-1 align-text-bottom opacity-60 group-hover:opacity-100 group-hover:text-primary transition-opacity" />
                            </p>
                          </div>
                          <span
                            className={`shrink-0 px-1.5 py-0.5 rounded-sm border text-[8px] font-mono font-semibold uppercase tracking-wider ${sentimentBadgeClasses[sentiment]}`}
                          >
                            {sentimentToneLabel(sentiment, t)}
                          </span>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="px-3 py-2.5 text-[10px] text-muted-foreground">
                    {sentimentFallbackOpinion[sentimentView] ? (
                      <div className="space-y-1.5">
                        <span
                          className={`inline-flex px-1.5 py-0.5 rounded-sm border text-[8px] font-mono font-semibold uppercase tracking-wider ${sentimentBadgeClasses[sentimentFallbackOpinion[sentimentView]!.tone]}`}
                        >
                          {sentimentToneLabel(sentimentFallbackOpinion[sentimentView]!.tone, t)}
                        </span>
                        <p className="text-[11px] text-foreground/85 leading-snug">
                          {sentimentFallbackOpinion[sentimentView]!.opinion}
                        </p>
                        <p className="text-[9px] text-muted-foreground">
                          {t("dashboard.fallbackClaude")}
                        </p>
                      </div>
                    ) : (
                      t("dashboard.noCoverageYet")
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Rising Risks */}
            <div>
              <h3 className="text-[10px] font-mono font-semibold uppercase tracking-widest text-red-400 mb-2">
                {t("dashboard.risingRisks")}
              </h3>
              <div className="space-y-1.5">
                {newsletter.risingRisks.map((r, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
                    <p className="text-[11px] text-foreground/80 leading-snug">{r}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Rising Opportunities */}
            <div>
              <h3 className="text-[10px] font-mono font-semibold uppercase tracking-widest text-emerald-400 mb-2">
                {t("dashboard.risingOpportunities")}
              </h3>
              <div className="space-y-1.5">
                {newsletter.risingOpportunities.map((o, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                    <p className="text-[11px] text-foreground/80 leading-snug">{o}</p>
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
                {t("dashboard.companyBrief")}
              </button>
              {briefOpen && (
                <div className="mt-2 space-y-2">
                  <div>
                    <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">{t("dashboard.businessModel")}</span>
                    <p className="text-[11px] text-foreground/80 mt-0.5">{dashData.brief.businessModel[lang] || dashData.brief.businessModel.en}</p>
                  </div>
                  <div>
                    <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">{t("dashboard.strategicPriorities")}</span>
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
                    <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">{t("dashboard.keyMarkets")}</span>
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
