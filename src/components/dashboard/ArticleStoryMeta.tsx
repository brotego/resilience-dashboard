import { Briefcase, Calendar, MapPin, Newspaper, User } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";

export type ArticleStoryMetaProps = {
  /** Company lens used for resilience scoring / keyword curation (dashboard selection). */
  curationCompanyName?: string;
  /** ISO or parseable publish string from feed */
  publishedAt?: string;
  author?: string;
  source?: string;
  /** Region / dateline (e.g. country from map) */
  location?: string;
  locale: string;
};

function parsePublished(d?: string): Date | null {
  if (!d?.trim()) return null;
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? null : x;
}

export function ArticleStoryMeta({
  curationCompanyName,
  publishedAt,
  author,
  source,
  location,
  locale,
}: ArticleStoryMetaProps) {
  const { t } = useLang();
  const d = parsePublished(publishedAt);
  const labels = {
    curation: t("article.meta.curation"),
    published: t("article.meta.published"),
    author: t("article.meta.author"),
    source: t("article.meta.source"),
    region: t("article.meta.region"),
  };

  const hasAny =
    curationCompanyName?.trim() || d || author?.trim() || source?.trim() || location?.trim();
  if (!hasAny) return null;

  return (
    <div className="rounded-sm border border-border bg-muted/25 px-3 py-2.5 mb-4">
      <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
        {t("article.meta.title")}
      </p>
      <div className="flex flex-col gap-3 text-sm">
        {curationCompanyName?.trim() && (
          <div className="flex gap-2.5 pb-3 mb-0.5 border-b border-border/70">
            <Briefcase className="h-4 w-4 mt-0.5 text-primary shrink-0" aria-hidden />
            <div className="min-w-0 space-y-0.5">
              <div className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">{labels.curation}</div>
              <div className="text-foreground font-medium leading-snug">{curationCompanyName.trim()}</div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                {t("article.meta.curationHint")}
              </p>
            </div>
          </div>
        )}
        {d && (
          <div className="flex gap-2.5">
            <Calendar className="h-4 w-4 mt-0.5 text-primary/80 shrink-0" aria-hidden />
            <div className="min-w-0 space-y-0.5">
              <div className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">{labels.published}</div>
              <div className="text-foreground/90 tabular-nums leading-snug">
                {d.toLocaleDateString(locale, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                <span className="text-muted-foreground/80"> · </span>
                {d.toLocaleTimeString(locale, {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false,
                })}
              </div>
            </div>
          </div>
        )}
        {author?.trim() && (
          <div className="flex gap-2.5">
            <User className="h-4 w-4 mt-0.5 text-primary/80 shrink-0" aria-hidden />
            <div className="min-w-0 space-y-0.5">
              <div className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">{labels.author}</div>
              <div className="text-foreground/90 leading-snug">{author.trim()}</div>
            </div>
          </div>
        )}
        {source?.trim() && (
          <div className="flex gap-2.5">
            <Newspaper className="h-4 w-4 mt-0.5 text-primary/80 shrink-0" aria-hidden />
            <div className="min-w-0 space-y-0.5">
              <div className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">{labels.source}</div>
              <div className="text-foreground/90 leading-snug">{source.trim()}</div>
            </div>
          </div>
        )}
        {location?.trim() && (
          <div className="flex gap-2.5">
            <MapPin className="h-4 w-4 mt-0.5 text-primary/80 shrink-0" aria-hidden />
            <div className="min-w-0 space-y-0.5">
              <div className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">{labels.region}</div>
              <div className="text-foreground/90 leading-snug">{location.trim()}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
