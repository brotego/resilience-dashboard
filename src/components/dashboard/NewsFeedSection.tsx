import { useState } from "react";
import { ChevronDown, ChevronRight, Newspaper, Zap } from "lucide-react";
import { useNewsFeed, NewsArticle } from "@/hooks/useNewsFeed";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  countryName: string;
  type: "business" | "genz";
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function ArticleRow({ article }: { article: NewsArticle }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <button
      onClick={() => setExpanded(!expanded)}
      className="w-full text-left rounded-lg border border-border bg-background/50 hover:bg-accent/10 p-2.5 transition-colors"
    >
      <div className="flex items-start gap-2">
        <span className="shrink-0 mt-0.5">
          {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        </span>
        <div className="flex-1 min-w-0">
          <h5 className="text-[11px] font-semibold text-foreground leading-snug line-clamp-2">
            {article.title}
          </h5>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[9px] text-primary font-medium">{article.source}</span>
            <span className="text-[9px] text-muted-foreground">{formatDate(article.date)}</span>
          </div>
          {expanded && article.description && (
            <p className="text-[10px] text-foreground/60 mt-1.5 leading-relaxed line-clamp-2">
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
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border p-2.5 space-y-1.5">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
          <div className="flex gap-2">
            <Skeleton className="h-2 w-16" />
            <Skeleton className="h-2 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

const NewsFeedSection = ({ countryName, type }: Props) => {
  const { articles, loading, isFallback } = useNewsFeed(countryName, type);

  const isBusiness = type === "business";
  const icon = isBusiness ? <Newspaper className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />;
  const title = isBusiness ? "Business News Feed" : "Gen Z Signal Feed";
  const sourceTier = isBusiness
    ? "Sources: Reuters, Bloomberg, NYT, BBC, Nikkei"
    : "Sources: Social trend coverage, Gen Z media, viral signals";

  return (
    <div>
      <h4
        className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5"
        style={isBusiness ? undefined : { color: "#ff6701" }}
      >
        {!isBusiness && <span style={{ color: "#ff6701" }}>{icon}</span>}
        {isBusiness && <span className="text-primary">{icon}</span>}
        <span className={isBusiness ? "text-primary" : ""} style={!isBusiness ? { color: "#ff6701" } : undefined}>
          {title}
        </span>
        {isFallback && (
          <span className="text-[8px] font-normal text-muted-foreground ml-auto">(seed data)</span>
        )}
      </h4>

      {loading ? (
        <LoadingSkeleton />
      ) : articles.length > 0 ? (
        <div className="space-y-1.5">
          {articles.map((article, i) => (
            <ArticleRow key={`${type}-${i}`} article={article} />
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground text-center py-3">No articles found.</p>
      )}

      <p className="text-[9px] text-muted-foreground/60 mt-2 italic">{sourceTier}</p>
    </div>
  );
};

export default NewsFeedSection;
