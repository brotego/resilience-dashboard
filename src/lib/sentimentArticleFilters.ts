import type { Company } from "@/data/companies";

export type SentimentArticleLike = {
  title: string;
  description: string;
  source: string;
  url: string;
};

function normalizeText(v: string): string {
  return v.toLowerCase();
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((kw) => text.includes(kw.toLowerCase()));
}

/** Company tab: title + description must mention the company name or an explicit brand marker (no generic industry-only hits). */
export function articleStrictlyAboutCompany(article: SentimentArticleLike, company: Company): boolean {
  const body = normalizeText(`${article.title} ${article.description}`);
  const name = normalizeText(company.name);
  if (name.length >= 3 && body.includes(name)) return true;
  const markers = company.sentimentBrandMarkers?.map((m) => normalizeText(m)) ?? [];
  return markers.some((m) => m.length >= 4 && body.includes(m));
}

/** Japan tab: story is clearly about Japan as a country / economy / society (headline + snippet). */
export function isJapanTopicArticle(article: SentimentArticleLike): boolean {
  const text = normalizeText(`${article.title} ${article.description}`);
  return includesAny(text, [
    "japan",
    "japanese",
    "tokyo",
    "osaka",
    "kyoto",
    "hiroshima",
    "fukuoka",
    "sapporo",
    "nagoya",
    "kobe",
    "yokohama",
    "okinawa",
    "yen",
    "the yen",
    "bank of japan",
    "nikkei 225",
    "topix",
    "prime minister of japan",
    "japanese government",
    "japanese economy",
  ]);
}

const JAPAN_DOMESTIC_SOURCE_SUBSTRINGS = [
  "nikkei",
  "nhk",
  "asahi",
  "yomiuri",
  "mainichi",
  "kyodo",
  "sankei",
  "japan times",
  "japan today",
  "the japan news",
  "diamond online",
  "itmedia",
  "impress",
  "newswitch",
  "toyo keizai",
  "president.jp",
  "livedoor",
  "excite",
  "goo.ne",
];

/** Japan tab: exclude major domestic Japanese outlets; prefer wire / foreign press (and non-.jp hosts). */
export function isArticlePublishedOutsideJapan(article: SentimentArticleLike): boolean {
  const src = normalizeText(article.source);
  if (JAPAN_DOMESTIC_SOURCE_SUBSTRINGS.some((frag) => src.includes(frag))) return false;
  const url = article.url?.trim();
  if (!url) return true;
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.endsWith(".jp") || host.endsWith(".co.jp")) return false;
  } catch {
    /* ignore malformed URL */
  }
  return true;
}

export function isJapanInternationalCoverageArticle(article: SentimentArticleLike): boolean {
  return isJapanTopicArticle(article) && isArticlePublishedOutsideJapan(article);
}
