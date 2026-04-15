import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useNewsFeed, NewsArticle } from "@/hooks/useNewsFeed";
import { Skeleton } from "@/components/ui/skeleton";
import { useLang } from "@/i18n/LanguageContext";

interface Props {
  countryName: string;
  type: "business" | "genz";
}

function formatDate(dateStr: string, locale: string): string {
  try {
    return new Date(dateStr).toLocaleDateString(locale, { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
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

const NewsFeedSection = ({ countryName, type }: Props) => {
  const { t } = useLang();
  const { articles, loading, isFallback } = useNewsFeed(countryName, type);
  const locale = t("clock.locale");

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
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : articles.length > 0 ? (
        <div>
          {articles.map((article, i) => (
            <ArticleRow key={`${type}-${i}`} article={article} locale={locale} />
          ))}
        </div>
      ) : (
        <p className="text-[10px] font-mono text-muted-foreground text-center py-2">{t("news.noArticles")}</p>
      )}
    </div>
  );
};

export default NewsFeedSection;
