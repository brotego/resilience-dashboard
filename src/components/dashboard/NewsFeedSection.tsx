import { useState, useEffect, useMemo } from "react";
import { translateJapaneseArticleRows } from "@/api/translateJapaneseUi";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useNewsFeed, NewsArticle } from "@/hooks/useNewsFeed";
import { Skeleton } from "@/components/ui/skeleton";
import { useLang } from "@/i18n/LanguageContext";

interface Props {
  countryName: string;
  type: "business" | "genz";
  topicQuery?: string;
}

function formatDate(dateStr: string, locale: string): string {
  try {
    return new Date(dateStr).toLocaleDateString(locale, { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function articleStableId(article: { url: string; title: string }, index: number): string {
  return article.url && article.url !== "#" ? article.url : `idx-${index}-${article.title.slice(0, 48)}`;
}

function ArticleRow({ article, locale }: { article: NewsArticle; locale: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <button
      onClick={() => setExpanded(!expanded)}
      className="w-full text-left border-b border-border last:border-b-0 py-2 px-1 hover:bg-secondary/20 transition-colors"
    >
      <div className="flex items-start gap-1.5">
        <span className="shrink-0 mt-0.5">
          {expanded ? <ChevronDown className="h-2.5 w-2.5 text-muted-foreground" /> : <ChevronRight className="h-2.5 w-2.5 text-muted-foreground" />}
        </span>
        <div className="flex-1 min-w-0">
          <h5 className="text-[10px] font-semibold text-foreground leading-snug line-clamp-2">
            {article.title}
          </h5>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[9px] font-mono text-accent">{article.source}</span>
            <span className="text-[9px] font-mono text-muted-foreground/60">{formatDate(article.date, locale)}</span>
          </div>
          {expanded && article.description && (
            <p className="text-[9px] text-foreground/50 mt-1 leading-relaxed line-clamp-2">
              {article.description}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="py-2 px-1 space-y-1">
          <Skeleton className="h-2.5 w-full" />
          <Skeleton className="h-2.5 w-3/4" />
          <div className="flex gap-2">
            <Skeleton className="h-2 w-12" />
            <Skeleton className="h-2 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

const NewsFeedSection = ({ countryName, type, topicQuery }: Props) => {
  const { t, lang } = useLang();
  const { articles, loading, isFallback, fetchError } = useNewsFeed(countryName, type, topicQuery);
  const locale = t("clock.locale");
  const [jpArticleMap, setJpArticleMap] = useState<Record<string, { title: string; description: string }>>({});
  const [jpArticlesLoading, setJpArticlesLoading] = useState(false);

  const displayArticles = useMemo(() => {
    if (lang !== "jp") return articles;
    return articles.map((a, i) => {
      const id = articleStableId(a, i);
      const trRow = jpArticleMap[id];
      if (!trRow) return a;
      return { ...a, title: trRow.title, description: trRow.description };
    });
  }, [articles, lang, jpArticleMap]);

  const articlesSig = useMemo(() => articles.map((a, i) => articleStableId(a, i)).join("|"), [articles]);

  useEffect(() => {
    if (lang !== "jp" || articles.length === 0) {
      setJpArticleMap({});
      setJpArticlesLoading(false);
      return;
    }
    let cancelled = false;
    setJpArticlesLoading(true);
    const payload = articles.slice(0, 18).map((a, i) => ({
      id: articleStableId(a, i),
      title: a.title,
      description: a.description || "",
    }));
    translateJapaneseArticleRows(payload)
      .then((map) => {
        if (!cancelled) setJpArticleMap(map);
      })
      .finally(() => {
        if (!cancelled) setJpArticlesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lang, articlesSig]);
  const normalizedError = fetchError
    ? /token|quota|unsubscribed|429|rate limit|throttl/i.test(fetchError)
      ? t("news.feedUnavailable")
      : fetchError
    : null;

  const isBusiness = type === "business";
  const title = isBusiness ? t("news.businessFeed") : t("news.genzFeed");

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <h4
          className="text-[10px] font-mono font-bold uppercase tracking-widest"
          style={isBusiness ? undefined : { color: "#ff6701" }}
        >
          <span className={isBusiness ? "text-primary" : ""} style={!isBusiness ? { color: "#ff6701" } : undefined}>
            {title}
          </span>
        </h4>
        {isFallback && (
          <span className="text-[7px] font-mono text-muted-foreground/40 uppercase tracking-widest">{t("news.seedData")}</span>
        )}
        {lang === "jp" && jpArticlesLoading && articles.length > 0 && (
          <span className="text-[7px] font-mono text-muted-foreground/60">{t("news.translatingTitles")}</span>
        )}
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : displayArticles.length > 0 ? (
        <div>
          {displayArticles.map((article, i) => (
            <ArticleRow key={`${type}-${articleStableId(article, i)}`} article={article} locale={locale} />
          ))}
        </div>
      ) : normalizedError ? (
        <p className="text-[9px] font-mono text-destructive/80 text-center py-2 leading-snug px-1" title={fetchError || normalizedError}>
          {normalizedError.length > 120 ? `${normalizedError.slice(0, 120)}…` : normalizedError}
        </p>
      ) : (
        <p className="text-[10px] font-mono text-muted-foreground text-center py-2">{t("news.noArticles")}</p>
      )}
    </div>
  );
};

export default NewsFeedSection;
