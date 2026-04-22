/**
 * News feed via NewsAPI.ai (Event Registry). Key: VITE_NEWSAPI_AI_KEY — see .env.example.
 */

/** Stored on signals; cap avoids huge session payloads (ER body can be very long). */
const MAX_ARTICLE_BODY_STORE_CHARS = 150_000;

const STANDARD_PLAN_MAX_LIMIT = 100;
const DEFAULT_ARTICLE_LIMIT = 5;
const DEFAULT_EVENT_REGISTRY_ORIGIN = "https://eventregistry.org";
const PROVIDER_COOLDOWN_MS = 8 * 1000;
const MIN_REQUEST_SPACING_MS = 350;
let providerCooldownUntil = 0;
let lastRequestAt = 0;
let requestGate: Promise<void> = Promise.resolve();

function isProviderLimitedMessage(msg: string): boolean {
  return /429|403|forbidden|rate|too many|quota|limit exceeded|throttl/i.test(msg);
}

function parseRetryAfterMs(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds > 0) return Math.trunc(seconds * 1000);
  const when = Date.parse(value);
  if (Number.isFinite(when)) {
    const delta = when - Date.now();
    return delta > 0 ? delta : null;
  }
  return null;
}

/** POST target for Event Registry `getArticles` (dev uses Vite proxy — see vite.config.ts). */
function getEventRegistryArticleUrl(): string {
  const custom = (import.meta.env.VITE_NEWSAPI_AI_ORIGIN as string | undefined)?.trim();
  if (custom) return `${custom.replace(/\/$/, "")}/api/v1/article`;
  if (import.meta.env.DEV) return "/api/event-registry/api/v1/article";
  return `${DEFAULT_EVENT_REGISTRY_ORIGIN}/api/v1/article`;
}

function resolveNewsApiAiKey(): string | undefined {
  return (import.meta.env.VITE_NEWSAPI_AI_KEY as string | undefined)?.trim();
}

/** Keyword text for domain-based Event Registry searches */
const DOMAIN_KEYWORDS_ER: Record<string, string> = {
  work: "workforce remote work employment labor market AI jobs future of work",
  selfhood: "mental health wellness personal development self-care",
  community: "community building social infrastructure mutual aid civic engagement",
  aging: "aging population eldercare longevity retirement senior care",
  environment: "climate change renewable energy sustainability carbon emissions green energy",
};

/** Country labels → Wikipedia URIs expected by Event Registry for `sourceLocationUri` */
const COUNTRY_LOCATION_URI: Record<string, string> = {
  "United States of America": "http://en.wikipedia.org/wiki/United_States",
  "United Kingdom": "http://en.wikipedia.org/wiki/United_Kingdom",
  Japan: "http://en.wikipedia.org/wiki/Japan",
  Germany: "http://en.wikipedia.org/wiki/Germany",
  France: "http://en.wikipedia.org/wiki/France",
  India: "http://en.wikipedia.org/wiki/India",
  Brazil: "http://en.wikipedia.org/wiki/Brazil",
  Australia: "http://en.wikipedia.org/wiki/Australia",
  Canada: "http://en.wikipedia.org/wiki/Canada",
  "South Korea": "http://en.wikipedia.org/wiki/South_Korea",
  Mexico: "http://en.wikipedia.org/wiki/Mexico",
  Indonesia: "http://en.wikipedia.org/wiki/Indonesia",
  Egypt: "http://en.wikipedia.org/wiki/Egypt",
  Argentina: "http://en.wikipedia.org/wiki/Argentina",
  Turkey: "http://en.wikipedia.org/wiki/Turkey",
  Thailand: "http://en.wikipedia.org/wiki/Thailand",
  "Saudi Arabia": "http://en.wikipedia.org/wiki/Saudi_Arabia",
  Iran: "http://en.wikipedia.org/wiki/Iran",
  Italy: "http://en.wikipedia.org/wiki/Italy",
  Spain: "http://en.wikipedia.org/wiki/Spain",
  "South Africa": "http://en.wikipedia.org/wiki/South_Africa",
  Nigeria: "http://en.wikipedia.org/wiki/Nigeria",
  Kenya: "http://en.wikipedia.org/wiki/Kenya",
  Poland: "http://en.wikipedia.org/wiki/Poland",
  Ukraine: "http://en.wikipedia.org/wiki/Ukraine",
  Colombia: "http://en.wikipedia.org/wiki/Colombia",
  Peru: "http://en.wikipedia.org/wiki/Peru",
  Vietnam: "http://en.wikipedia.org/wiki/Vietnam",
  Sweden: "http://en.wikipedia.org/wiki/Sweden",
  Singapore: "http://en.wikipedia.org/wiki/Singapore",
  Netherlands: "http://en.wikipedia.org/wiki/Netherlands",
  Belgium: "http://en.wikipedia.org/wiki/Belgium",
  Denmark: "http://en.wikipedia.org/wiki/Denmark",
  Norway: "http://en.wikipedia.org/wiki/Norway",
  Finland: "http://en.wikipedia.org/wiki/Finland",
  Portugal: "http://en.wikipedia.org/wiki/Portugal",
  Austria: "http://en.wikipedia.org/wiki/Austria",
  Romania: "http://en.wikipedia.org/wiki/Romania",
  Philippines: "http://en.wikipedia.org/wiki/Philippines",
  Chile: "http://en.wikipedia.org/wiki/Chile",
  Ghana: "http://en.wikipedia.org/wiki/Ghana",
  Malaysia: "http://en.wikipedia.org/wiki/Malaysia",
  "United Arab Emirates": "http://en.wikipedia.org/wiki/United_Arab_Emirates",
  Pakistan: "http://en.wikipedia.org/wiki/Pakistan",
  Bangladesh: "http://en.wikipedia.org/wiki/Bangladesh",
  China: "http://en.wikipedia.org/wiki/China",
  Russia: "http://en.wikipedia.org/wiki/Russia",
  Ethiopia: "http://en.wikipedia.org/wiki/Ethiopia",
  Nepal: "http://en.wikipedia.org/wiki/Nepal",
  Cambodia: "http://en.wikipedia.org/wiki/Cambodia",
};

function countryLocationUri(countryName?: string): string | undefined {
  if (!countryName) return undefined;
  return COUNTRY_LOCATION_URI[countryName] ?? `http://en.wikipedia.org/wiki/${countryName.replace(/ /g, "_")}`;
}

export type NewsFeedRequestBody = {
  type: "business" | "genz" | "domain" | "sentiment";
  countryCode?: string;
  countryName?: string;
  domain?: string;
  pageSize?: number;
  page?: number;
  topicQuery?: string;
};

export type NewsFeedArticle = {
  title: string;
  source: string;
  /** ISO-like publish time from Event Registry */
  date: string;
  /** Comma-separated author names when provided */
  author?: string;
  description: string;
  content: string;
  url: string;
};

export type NewsFeedData = {
  articles: NewsFeedArticle[];
  meta?: unknown;
  error?: string;
  fallback?: boolean;
};

function extractErSource(source: unknown): string {
  if (typeof source === "string") return source;
  if (source && typeof source === "object" && "title" in source) {
    return String((source as { title?: string }).title ?? "Unknown");
  }
  return "Unknown";
}

function extractErAuthors(raw: Record<string, unknown>): string | undefined {
  const authors = raw.authors;
  if (!Array.isArray(authors) || authors.length === 0) return undefined;
  const names = authors
    .map((item) => {
      if (item && typeof item === "object" && "name" in item) {
        return String((item as { name?: string }).name ?? "").trim();
      }
      return "";
    })
    .filter(Boolean);
  if (names.length === 0) return undefined;
  return names.join(", ");
}

function normalizeErArticles(results: unknown): NewsFeedArticle[] {
  if (!Array.isArray(results)) return [];
  return results.map((raw) => {
    const a = raw as Record<string, unknown>;
    const body = typeof a.body === "string" ? a.body : "";
    const title = String(a.title ?? "");
    const stored =
      body.length > MAX_ARTICLE_BODY_STORE_CHARS
        ? body.slice(0, MAX_ARTICLE_BODY_STORE_CHARS)
        : body;
    return {
      title,
      source: extractErSource(a.source),
      date: String(a.dateTimePub ?? a.dateTime ?? a.date ?? ""),
      author: extractErAuthors(a),
      description: body.slice(0, 400) || title,
      content: stored,
      url: String(a.url ?? ""),
    };
  });
}

function eventRegistryArticlePayload(
  apiKey: string,
  page: number,
  count: number,
  query: Record<string, unknown>,
): Record<string, unknown> {
  return {
    action: "getArticles",
    apiKey,
    forceMaxDataTimeWindow: 31,
    resultType: ["articles"],
    /** Full article body; without this, Event Registry often returns a short excerpt only. */
    articlesArticleBodyLen: -1,
    articlesPage: page,
    articlesCount: Math.min(Math.max(count, 1), 100),
    articlesSortBy: "date",
    articlesSortByAsc: false,
    dataType: "news",
    keywordSearchMode: "simple",
    ...query,
  };
}

async function postEventRegistry(
  payload: Record<string, unknown>,
): Promise<{ data: NewsFeedData | null; error: Error | null }> {
  // Global gate: serialize provider calls so we don't burst multiple requests at once.
  const prior = requestGate;
  let release!: () => void;
  requestGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await prior;

  const sinceLast = Date.now() - lastRequestAt;
  if (sinceLast < MIN_REQUEST_SPACING_MS) {
    await new Promise((r) => setTimeout(r, MIN_REQUEST_SPACING_MS - sinceLast));
  }

  if (Date.now() < providerCooldownUntil) {
    // Soft cooldown: pause briefly, then probe again so requests/logs don't go silent.
    const waitMs = Math.min(providerCooldownUntil - Date.now(), 2000);
    if (waitMs > 0) {
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }

  try {
    lastRequestAt = Date.now();
    const url = getEventRegistryArticleUrl();
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let json: Record<string, unknown> | null = null;
    if (text) {
      try {
        json = JSON.parse(text) as Record<string, unknown>;
      } catch {
        json = null;
      }
    }

    if (!response.ok) {
      const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
      if (response.status === 429 || response.status === 403) {
        providerCooldownUntil = Date.now() + (retryAfterMs ?? PROVIDER_COOLDOWN_MS);
      }
      let msg: string;
      if (json && json.error !== undefined) {
        msg = typeof json.error === "string" ? json.error : JSON.stringify(json.error);
      } else {
        msg = text?.trim() || `HTTP ${response.status}`;
      }
      return {
        data: {
          articles: [],
          fallback: true,
          error: `NewsAPI.ai: ${msg}`,
        },
        error: null,
      };
    }

    if (!json) {
      return {
        data: { articles: [], fallback: true, error: "NewsAPI.ai: empty or non-JSON response" },
        error: null,
      };
    }

    if (json.error !== undefined) {
      const msg =
        typeof json.error === "string" ? json.error : JSON.stringify(json.error);
      if (isProviderLimitedMessage(msg)) {
        providerCooldownUntil = Date.now() + PROVIDER_COOLDOWN_MS;
      }
      return { data: { articles: [], fallback: true, error: msg }, error: null };
    }

    const results =
      json.articles && typeof json.articles === "object"
        ? (json.articles as { results?: unknown }).results
        : undefined;

    return {
      data: { articles: normalizeErArticles(results), meta: json },
      error: null,
    };
  } finally {
    release();
  }
}

/**
 * Drop-in replacement for `supabase.functions.invoke("news-feed", { body })`.
 * Requires `VITE_NEWSAPI_AI_KEY` (NewsAPI.ai / Event Registry).
 */
export async function invokeNewsFeed(body: NewsFeedRequestBody): Promise<{ data: NewsFeedData | null; error: Error | null }> {
  const apiKey = resolveNewsApiAiKey();
  if (!apiKey) {
    return {
      data: {
        articles: [],
        fallback: true,
        error: "Set VITE_NEWSAPI_AI_KEY (from https://newsapi.ai/dashboard) in your .env file.",
      },
      error: null,
    };
  }

  try {
    const {
      type,
      countryName,
      domain,
      pageSize,
      page,
      topicQuery,
    } = body;

    if (!type) {
      return { data: { articles: [], error: "Missing type param" }, error: null };
    }

    const requestedSize = Number(pageSize);
    const size = Number.isFinite(requestedSize)
      ? Math.min(Math.max(Math.trunc(requestedSize), 1), STANDARD_PLAN_MAX_LIMIT)
      : DEFAULT_ARTICLE_LIMIT;
    const requestedPage = Number(page);
    const currentPage = Number.isFinite(requestedPage) ? Math.max(Math.trunc(requestedPage), 1) : 1;

    const locUri = countryLocationUri(countryName);
    let payload: Record<string, unknown>;

    if (type === "business") {
      if (!locUri) {
        return { data: { articles: [], error: "Missing countryName for business feed" }, error: null };
      }
      const keyword = topicQuery
        ? `business finance economy markets stocks ${topicQuery}`
        : "business finance economy markets stocks";
      payload = eventRegistryArticlePayload(apiKey, currentPage, size, {
        keyword,
        sourceLocationUri: locUri,
        lang: "eng",
      });
    } else if (type === "genz") {
      const base = "Gen Z TikTok viral youth culture sustainability";
      const keyword = topicQuery ? `${base} ${topicQuery}` : base;
      payload = eventRegistryArticlePayload(apiKey, currentPage, size, {
        keyword,
        sourceLocationUri: locUri,
        lang: "eng",
      });
    } else if (type === "domain") {
      const text = domain ? DOMAIN_KEYWORDS_ER[domain] : undefined;
      if (!text) {
        return { data: { articles: [], error: `Unknown domain: ${domain}` }, error: null };
      }
      const keywordStr = countryName ? `${text} ${countryName}` : text;
      payload = eventRegistryArticlePayload(apiKey, currentPage, size, {
        keyword: keywordStr,
        lang: "eng",
      });
    } else if (type === "sentiment") {
      if (!topicQuery || typeof topicQuery !== "string") {
        return { data: { articles: [], error: "Missing topicQuery" }, error: null };
      }
      const keywordStr = countryName ? `${topicQuery} ${countryName}` : topicQuery;
      const sentimentQuery: Record<string, unknown> = {
        keyword: keywordStr,
        lang: "eng",
      };
      // Country panel sentiment should reflect that country's media perspective.
      if (locUri) sentimentQuery.sourceLocationUri = locUri;
      payload = eventRegistryArticlePayload(apiKey, currentPage, size, sentimentQuery);
    } else {
      return { data: { articles: [], error: "Invalid type" }, error: null };
    }

    return await postEventRegistry(payload);
  } catch (err) {
    return {
      data: { articles: [], fallback: true, error: err instanceof Error ? err.message : "Network error" },
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}
