import AIInsightPanel from "@/components/dashboard/AIInsightPanel";
import { Button } from "@/components/ui/button";
import { COMPANIES, CompanyId } from "@/data/companies";
import { DomainId, MindsetId } from "@/data/types";
import { UnifiedSignal } from "@/data/unifiedSignalTypes";
import { GenZCategoryId } from "@/data/genzTypes";
import { DashboardMode } from "@/components/dashboard/DashboardLayout";
import { useLang } from "@/i18n/LanguageContext";
import { useJpUi } from "@/i18n/jpUiContext";
import { getCompanyDisplayName } from "@/i18n/companyLocale";
import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArticleStoryMeta } from "@/components/dashboard/ArticleStoryMeta";
import { invokeArticleContent } from "@/api/articleContent";
import { splitArticleIntoParagraphs } from "@/lib/formatArticleBody";
import { looksLikeHtmlChromeDump, sanitizeNewsArticleText } from "@/lib/articleTextCleanup";

type SignalDetailState = {
  signal?: UnifiedSignal;
  mode?: DashboardMode;
  selectedCompany?: CompanyId | null;
  activeDomains?: DomainId[];
  activeCategories?: GenZCategoryId[];
  originTab?: "dashboard" | "map";
  originMode?: DashboardMode;
};

function normalizeArticleContent(content?: string): string {
  if (!content) return "";
  return content.replace(/\s*\[\+\d+\s+chars\]\s*$/i, "").trim();
}

const SignalDetail = () => {
  const { t, lang, setLang } = useLang();
  const { getSignalDisplay } = useJpUi();
  const navigate = useNavigate();
  const { id: idParam } = useParams();
  const id = idParam ? decodeURIComponent(idParam) : undefined;
  const { state } = useLocation() as { state: SignalDetailState | null };

  const signal = state?.signal ?? null;
  const [fetchedContent, setFetchedContent] = useState("");
  const [loadingContent, setLoadingContent] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    setFetchedContent("");
  }, [signal?.id]);

  useEffect(() => {
    const url = signal?.articleUrl;
    if (!signal || !url || url === "#") return;

    let cancelled = false;
    setLoadingContent(true);

    invokeArticleContent({ url })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data?.content) {
          setFetchedContent(normalizeArticleContent(data.content));
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingContent(false);
      });

    return () => {
      cancelled = true;
    };
  }, [signal?.articleUrl, signal?.id]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!signal) {
    return (
      <div className="h-screen bg-background text-foreground flex items-center justify-center px-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-lg font-semibold">{t("signal.notFound")}</h1>
          <p className="text-sm text-muted-foreground">{t("signal.notFoundHintApp")}</p>
          <Button onClick={() => navigate("/")}>{t("signal.backDashboard")}</Button>
          {id && <p className="text-[11px] font-mono text-muted-foreground/70">{id}</p>}
        </div>
      </div>
    );
  }

  const signalUi = getSignalDisplay(signal);
  const articleSanitizeOpts = { author: signal.author };
  const snippetContent = sanitizeNewsArticleText(
    normalizeArticleContent(signal.articleContent),
    articleSanitizeOpts,
  );
  const fetchedClean = sanitizeNewsArticleText(fetchedContent, articleSanitizeOpts);
  const fetchedUseful = fetchedClean.length > 0 && !looksLikeHtmlChromeDump(fetchedClean);
  const effectiveContent = fetchedUseful
    ? fetchedClean.length >= snippetContent.length
      ? fetchedClean
      : snippetContent || fetchedClean
    : snippetContent || fetchedClean;
  const articleParagraphs = splitArticleIntoParagraphs(effectiveContent);
  const hasArticleContent = articleParagraphs.length > 0;
  const hasExternalUrl = Boolean(signal.articleUrl && signal.articleUrl !== "#");
  const originTab = state?.originTab ?? "dashboard";
  const originMode = state?.originMode ?? "resilience";
  const curationCompany = state?.selectedCompany
    ? COMPANIES.find((c) => c.id === state.selectedCompany)
    : undefined;
  const curationCompanyName = curationCompany
    ? getCompanyDisplayName(curationCompany, lang)
    : undefined;

  return (
    <div className="h-screen bg-background overflow-hidden flex flex-col">
      <header className="flex items-center justify-between px-4 h-[44px] border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-[13px] font-bold tracking-tight text-foreground whitespace-nowrap">
            {t("app.title")}
          </h1>
          <div className="h-4 w-px bg-border" />
          <button
            onClick={() => navigate("/")}
            className="px-3 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider rounded-sm transition-colors text-muted-foreground hover:text-foreground"
          >
            {t("tab.dashboard")}
          </button>
          <button
            className="px-3 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider rounded-sm transition-colors bg-primary text-primary-foreground"
          >
            {t("signal.detailBreadcrumb")}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-muted-foreground/70 tabular-nums">
            {now.toLocaleDateString(t("clock.locale"), { month: "short", day: "numeric", year: "numeric" })}{" "}
            {now.toLocaleTimeString(t("clock.locale"), { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
          </span>
          <div className="h-3 w-px bg-border" />
          <div className="flex gap-0.5">
            <button
              onClick={() => setLang("en")}
              className={`px-2 py-0.5 text-[9px] font-mono font-semibold rounded-sm transition-colors ${
                lang === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setLang("jp")}
              className={`px-2 py-0.5 text-[9px] font-mono font-semibold rounded-sm transition-colors ${
                lang === "jp" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              JP
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden p-3">
        <div className="h-full grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-3">
        <div className="h-full border border-border rounded-sm overflow-hidden">
          <AIInsightPanel
            mode={state?.mode ?? "resilience"}
            activeDomains={state?.activeDomains ?? []}
            activeMindset={"cracks" as MindsetId}
            activeCategories={state?.activeCategories ?? []}
            selectedCompany={state?.selectedCompany ?? null}
            selectedSignal={signal}
            onClose={() => navigate("/", { state: { returnTab: originTab, returnMode: originMode } })}
            showMoreInfoButton={false}
            signals={[]}
          />
        </div>

        <div className="h-full border border-border rounded-sm bg-card p-4 overflow-y-auto">
          <div className="mb-3 pb-3 border-b border-border">
            <h2 className="text-[11px] font-mono font-bold uppercase tracking-widest text-primary">
              {t("signal.articleDetails")}
            </h2>
            <p className="text-sm font-semibold mt-1">{signalUi.title}</p>
          </div>

          <ArticleStoryMeta
            curationCompanyName={curationCompanyName}
            publishedAt={signal.date}
            author={signal.author}
            source={signal.source}
            location={signalUi.location}
            locale={t("clock.locale")}
          />

          {hasArticleContent ? (
            <div className="space-y-4">
              {loadingContent && !fetchedContent && hasExternalUrl && (
                <p className="text-xs text-muted-foreground">
                  {t("signal.loadingFullArticle")}
                </p>
              )}
              <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/90 prose-p:leading-relaxed">
                {articleParagraphs.map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
              {hasExternalUrl && (
                <a href={signal.articleUrl} target="_blank" rel="noreferrer">
                  <Button variant="outline" className="gap-2">
                    <ExternalLink className="h-4 w-4" />
                    {t("signal.openOriginal")}
                  </Button>
                </a>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {loadingContent && (
                <p className="text-sm text-muted-foreground">
                  {t("signal.fetchingArticle")}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                {t("signal.articleUnavailableBody")}
              </p>
              {hasExternalUrl ? (
                <a href={signal.articleUrl} target="_blank" rel="noreferrer">
                  <Button className="gap-2">
                    <ExternalLink className="h-4 w-4" />
                    {t("signal.goExternal")}
                  </Button>
                </a>
              ) : (
                <p className="text-xs text-muted-foreground/70">{t("news.noArticles")}</p>
              )}
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
};

export default SignalDetail;
