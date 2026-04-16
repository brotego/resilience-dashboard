import AIInsightPanel from "@/components/dashboard/AIInsightPanel";
import { Button } from "@/components/ui/button";
import { CompanyId } from "@/data/companies";
import { DomainId, MindsetId } from "@/data/types";
import { UnifiedSignal } from "@/data/unifiedSignalTypes";
import { GenZCategoryId } from "@/data/genzTypes";
import { DashboardMode } from "@/components/dashboard/DashboardLayout";
import { useLang } from "@/i18n/LanguageContext";
import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

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
  const navigate = useNavigate();
  const { id } = useParams();
  const { state } = useLocation() as { state: SignalDetailState | null };

  const signal = state?.signal ?? null;
  const [fetchedContent, setFetchedContent] = useState("");
  const [loadingContent, setLoadingContent] = useState(false);
  const [now, setNow] = useState(new Date());

  if (!signal) {
    return (
      <div className="h-screen bg-background text-foreground flex items-center justify-center px-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-lg font-semibold">{lang === "jp" ? "シグナルが見つかりません" : "Signal not found"}</h1>
          <p className="text-sm text-muted-foreground">
            {lang === "jp"
              ? "このページはアプリ内の「More info」から開いてください。"
              : "Open this page from the in-app More info button."}
          </p>
          <Button onClick={() => navigate("/")}>{lang === "jp" ? "ダッシュボードに戻る" : "Back to dashboard"}</Button>
          {id && <p className="text-[11px] font-mono text-muted-foreground/70">{id}</p>}
        </div>
      </div>
    );
  }

  const articleContent = normalizeArticleContent(signal.articleContent);
  const effectiveContent = articleContent || fetchedContent;
  const hasArticleContent = effectiveContent.length > 0;
  const hasExternalUrl = Boolean(signal.articleUrl && signal.articleUrl !== "#");
  const originTab = state?.originTab ?? "dashboard";
  const originMode = state?.originMode ?? "resilience";

  useEffect(() => {
    const url = signal?.articleUrl;
    if (!signal || articleContent || !url || url === "#") return;

    let cancelled = false;
    setLoadingContent(true);

    supabase.functions
      .invoke("article-content", { body: { url } })
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
  }, [signal?.articleUrl, articleContent, signal?.id]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
            {lang === "jp" ? "ダッシュボード" : "Dashboard"}
          </button>
          <button
            className="px-3 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider rounded-sm transition-colors bg-primary text-primary-foreground"
          >
            {lang === "jp" ? "詳細" : "Detail"}
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
              {lang === "jp" ? "記事詳細" : "Article details"}
            </h2>
            <p className="text-sm font-semibold mt-1">{signal.title}</p>
          </div>

          {hasArticleContent ? (
            <div className="space-y-4">
              <p className="text-sm leading-6 text-foreground/90 whitespace-pre-wrap">{effectiveContent}</p>
              {hasExternalUrl && (
                <a href={signal.articleUrl} target="_blank" rel="noreferrer">
                  <Button variant="outline" className="gap-2">
                    <ExternalLink className="h-4 w-4" />
                    {lang === "jp" ? "元記事を開く" : "Open original article"}
                  </Button>
                </a>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {loadingContent && (
                <p className="text-sm text-muted-foreground">
                  {lang === "jp" ? "記事本文を取得中..." : "Fetching full article text..."}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                {lang === "jp"
                  ? "全文記事は現在利用できません。外部サイトで確認してください。"
                  : "The full article is not available in-app right now. Open the source site for complete coverage."}
              </p>
              {hasExternalUrl ? (
                <a href={signal.articleUrl} target="_blank" rel="noreferrer">
                  <Button className="gap-2">
                    <ExternalLink className="h-4 w-4" />
                    {lang === "jp" ? "外部サイトへ移動" : "Go to external site"}
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
