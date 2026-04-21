import { useState, useEffect, useRef, useMemo } from "react";
import { invokeNewsFeed, type NewsFeedRequestBody } from "@/api/newsFeed";
import { DomainId } from "@/data/types";
import { GenZCategoryId } from "@/data/genzTypes";
import { CompanyId } from "@/data/companies";
import { SIGNALS } from "@/data/signals";
import { GENZ_SIGNALS } from "@/data/genzSignals";
import { WORLD_CITIES } from "@/data/capitals";
import { UnifiedSignal } from "@/data/unifiedSignalTypes";
import { calculateResilienceScore, scoreToUrgency } from "@/lib/resilienceScore";
import { isNewsApiAiConfigured } from "@/lib/newsApiConfigured";
import { readSessionCache, writeSessionCache } from "@/lib/newsSessionCache";
import { readPersistentCache, writePersistentCache } from "@/lib/newsPersistentCache";
import { DashboardMode } from "@/components/dashboard/DashboardLayout";

interface CacheEntry {
  signals: UnifiedSignal[];
  timestamp: number;
}

const CACHE_DURATION = 60 * 60 * 1000;
const cache = new Map<string, CacheEntry>();
/** Process this many countries at a time to avoid rate limits and flaky partial responses. */
const COUNTRY_FETCH_CHUNK = 3;
const BUSINESS_ARTICLES_PER_PAGE = 6;
const BUSINESS_PAGES = 1;
const GENZ_ARTICLES_PER_PAGE = 4;
const GENZ_PAGES = 1;
const MAX_COUNTRIES_PER_REFRESH = 10;
const COUNTRY_CODES: Record<string, string> = {
  "United States of America": "us",
  "United Kingdom": "gb",
  "Japan": "jp",
  "Germany": "de",
  "France": "fr",
  "India": "in",
  "Brazil": "br",
  "Australia": "au",
  "Canada": "ca",
  "South Korea": "kr",
  "Mexico": "mx",
  "Indonesia": "id",
  "Egypt": "eg",
  "Argentina": "ar",
  "Turkey": "tr",
  "Thailand": "th",
  "Saudi Arabia": "sa",
  "Iran": "ir",
  "Italy": "it",
  "Spain": "es",
  "South Africa": "za",
  "Nigeria": "ng",
  "Kenya": "ke",
  "Poland": "pl",
  "Ukraine": "ua",
  "Colombia": "co",
  "Peru": "pe",
  "Vietnam": "vn",
  "Sweden": "se",
  "Singapore": "sg",
  "Netherlands": "nl",
  "Belgium": "be",
  "Denmark": "dk",
  "Norway": "no",
  "Finland": "fi",
  "Portugal": "pt",
  "Austria": "at",
  "Romania": "ro",
  "Philippines": "ph",
  "Chile": "cl",
  "Ghana": "gh",
  "Malaysia": "my",
  "United Arab Emirates": "ae",
  "Pakistan": "pk",
  "Bangladesh": "bd",
};

const NEWS_COUNTRIES = WORLD_CITIES
  .filter((city) => city.isCapital && COUNTRY_CODES[city.country])
  .map((city) => ({
    code: COUNTRY_CODES[city.country],
    name: city.country,
    coords: city.coordinates,
  }))
  .filter((country, index, arr) => arr.findIndex((item) => item.name === country.name) === index);

function stableCountryOrder(list: typeof NEWS_COUNTRIES): typeof NEWS_COUNTRIES {
  return [...list].sort((a, b) => a.name.localeCompare(b.name));
}

function getFetchCountries(): typeof NEWS_COUNTRIES {
  const ordered = stableCountryOrder(NEWS_COUNTRIES);
  const dayBucket = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
  const offset = ordered.length > 0 ? dayBucket % ordered.length : 0;
  const rotated = ordered.slice(offset).concat(ordered.slice(0, offset));
  return rotated.slice(0, Math.min(MAX_COUNTRIES_PER_REFRESH, rotated.length));
}

function newsApiKeyFingerprint(): string {
  const key = (import.meta.env.VITE_NEWSAPI_AI_KEY as string | undefined)?.trim() || "";
  if (!key) return "nokey";
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) + hash) ^ key.charCodeAt(i);
  }
  return Math.abs(hash >>> 0).toString(36);
}

function jitter(coords: [number, number], index: number, offset = 0): [number, number] {
  const seed = index + offset * 7;
  const angle = (seed * 137.5) * (Math.PI / 180);
  const r = 2 + (seed % 5) * 1.2;
  return [coords[0] + r * Math.cos(angle), coords[1] + r * Math.sin(angle)];
}

/** One retry after a short wait when the API looks rate-limited. */
async function invokeNewsFeedResilient(body: NewsFeedRequestBody) {
  let res = await invokeNewsFeed(body);
  const err = String(res.data?.error ?? "");
  const looksRateLimited = /429|rate|too many|quota|limit exceeded|throttl/i.test(err);
  if (looksRateLimited && (!res.data?.articles?.length)) {
    await new Promise((r) => setTimeout(r, 750));
    res = await invokeNewsFeed(body);
  }
  return res;
}

async function fetchPagedArticles(
  type: "business" | "genz",
  country: { code: string; name: string },
  pageSize: number,
  pages: number,
): Promise<any[]> {
  const responses = await Promise.all(
    Array.from({ length: pages }, (_, pageIndex) =>
      invokeNewsFeedResilient({
        type,
        countryCode: country.code,
        countryName: country.name,
        pageSize,
        page: pageIndex + 1,
      }),
    ),
  );

  const seen = new Set<string>();
  const articles: any[] = [];

  responses.forEach(({ data }) => {
    if (data?.fallback || !Array.isArray(data?.articles)) return;
    data.articles.forEach((article: any) => {
      const dedupeKey = article.url || `${article.title}-${article.date}-${article.source}`;
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      articles.push(article);
    });
  });

  return articles;
}

function dedupeSignalsByArticleUrl(signals: UnifiedSignal[]): UnifiedSignal[] {
  const seen = new Set<string>();
  const out: UnifiedSignal[] = [];
  for (const s of signals) {
    const key = (s.articleUrl && s.articleUrl !== "#" ? s.articleUrl : s.id) || s.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/**
 * Converts static seed signals to UnifiedSignal format with dynamic scoring.
 */
function seedToUnified(companyId: CompanyId | null): UnifiedSignal[] {
  const resilience: UnifiedSignal[] = SIGNALS.map(s => {
    const score = calculateResilienceScore({
      title: s.title, description: s.description,
      domain: s.domain, companyId, baseIntensity: s.intensity,
    });
    return {
      id: s.id, title: s.title, description: s.description,
      location: s.location, coordinates: s.coordinates,
      layer: "resilience" as const,
      domain: s.domain,
      resilienceScore: score.total,
      urgency: scoreToUrgency(score.total),
      isJapan: s.isJapan,
      mindsetRelevance: s.mindsetRelevance,
      source: s.source,
    };
  });

  const genz: UnifiedSignal[] = GENZ_SIGNALS.map(s => {
    const score = calculateResilienceScore({
      title: s.title, description: s.description,
      category: s.category, companyId, baseIntensity: s.intensity,
    });
    return {
      id: s.id, title: s.title, description: s.description,
      location: s.location, coordinates: s.coordinates,
      layer: "genz" as const,
      category: s.category,
      resilienceScore: score.total,
      urgency: scoreToUrgency(score.total),
      isJapan: s.isJapan,
      insight: s.insight,
    };
  });

  return [...resilience, ...genz];
}

/**
 * Single unified hook that replaces useLiveSignals, useGlobalNewsDots,
 * and the static SIGNALS/GENZ_SIGNALS arrays.
 *
 * Returns a single array of UnifiedSignal[] with dynamic resilience scores.
 */
export function useUnifiedSignals(
  mode: DashboardMode,
  activeDomains: DomainId[],
  activeCategories: GenZCategoryId[],
  selectedCompany: CompanyId | null,
) {
  const [liveSignals, setLiveSignals] = useState<UnifiedSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const fetchedRef = useRef(false);

  // Seed signals with dynamic scores, re-scored when company changes
  const seedSignals = useMemo(() => seedToUnified(selectedCompany), [selectedCompany]);

  // Static demo seeds — omitted when NewsAPI.ai is configured (live news only)
  const filteredSeeds = useMemo(() => {
    if (isNewsApiAiConfigured()) return [];
    return seedSignals.filter(s => {
      if (s.layer === "resilience" && s.domain) return activeDomains.includes(s.domain);
      if (s.layer === "genz" && s.category) return activeCategories.includes(s.category);
      return true;
    });
  }, [seedSignals, activeDomains, activeCategories]);

  // Fetch live news and convert to UnifiedSignal
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const apiKeySuffix = isNewsApiAiConfigured() ? newsApiKeyFingerprint() : "seed";
    const cacheKey = `unified-live-${isNewsApiAiConfigured() ? "api-v4-article-meta" : "seed"}-${apiKeySuffix}`;
    const sharedApiCacheKey = "unified-live-api-v4-article-meta-shared";
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setLiveSignals(cached.signals);
      setIsLive(true);
      setLoading(false);
      return;
    }

    const persistentEntry = readPersistentCache<UnifiedSignal[]>(cacheKey);
    if (persistentEntry?.data?.length) {
      cache.set(cacheKey, { signals: persistentEntry.data, timestamp: persistentEntry.savedAt });
      setLiveSignals(persistentEntry.data);
      setIsLive(true);
      setLoading(false);
      return;
    }
    const sharedPersistentEntry = readPersistentCache<UnifiedSignal[]>(sharedApiCacheKey);
    if (sharedPersistentEntry?.data?.length) {
      cache.set(cacheKey, { signals: sharedPersistentEntry.data, timestamp: sharedPersistentEntry.savedAt });
      setLiveSignals(sharedPersistentEntry.data);
      setIsLive(true);
      setLoading(false);
      return;
    }

    const fetchAll = async () => {
      const results: UnifiedSignal[] = [];
      let gotLive = false;

      const fetchCountries = getFetchCountries();
      for (let ci = 0; ci < fetchCountries.length; ci++) {
        const country = fetchCountries[ci];
        const bizArticles = await fetchPagedArticles("business", country, BUSINESS_ARTICLES_PER_PAGE, BUSINESS_PAGES)
          .catch(() => [] as any[]);
        if (bizArticles.length > 0) {
          gotLive = true;
          results.push(
            ...bizArticles.map((a: any, i: number) => {
              const score = calculateResilienceScore({
                title: a.title || "", description: a.description || "",
                source: a.source, date: a.date, companyId: selectedCompany,
              });
              return {
                id: `live-biz-${country.code}-${a.url || i}`,
                title: a.title || "Untitled",
                description: a.description || "",
                location: country.name,
                coordinates: jitter(country.coords, i, ci),
                layer: "live-news" as const,
                resilienceScore: score.total,
                urgency: scoreToUrgency(score.total),
                source: a.source,
                author: a.author,
                articleUrl: a.url,
                articleContent: a.content,
                date: a.date,
                isJapan: country.code === "jp",
              } as UnifiedSignal;
            }),
          );
        }

        await new Promise((r) => setTimeout(r, 120));

        const gzArticles = await fetchPagedArticles("genz", country, GENZ_ARTICLES_PER_PAGE, GENZ_PAGES)
          .catch(() => [] as any[]);
        if (gzArticles.length > 0) {
          gotLive = true;
          results.push(
            ...gzArticles.map((a: any, i: number) => {
              const score = calculateResilienceScore({
                title: a.title || "", description: a.description || "",
                source: a.source, date: a.date, companyId: selectedCompany,
              });
              return {
                id: `live-gz-${country.code}-${a.url || i}`,
                title: a.title || "Untitled",
                description: a.description || "",
                location: country.name,
                coordinates: jitter(country.coords, i + 10, ci),
                layer: "live-news" as const,
                category: "digital" as GenZCategoryId,
                resilienceScore: score.total,
                urgency: scoreToUrgency(score.total),
                source: a.source,
                author: a.author,
                articleUrl: a.url,
                articleContent: a.content,
                date: a.date,
                isJapan: country.code === "jp",
              } as UnifiedSignal;
            }),
          );
        }

        await new Promise((r) => setTimeout(r, 120));
      }

      const merged = dedupeSignalsByArticleUrl(results);
      merged.sort((a, b) => {
        if (b.resilienceScore !== a.resilienceScore) return b.resilienceScore - a.resilienceScore;
        return a.id.localeCompare(b.id);
      });

      if (gotLive && merged.length > 0) {
        const now = Date.now();
        cache.set(cacheKey, { signals: merged, timestamp: now });
        writeSessionCache(cacheKey, merged);
        writePersistentCache(cacheKey, merged);
        writePersistentCache(sharedApiCacheKey, merged);
        setLiveSignals(merged);
        setIsLive(true);
      } else if (isNewsApiAiConfigured()) {
        const persistentFallback = readPersistentCache<UnifiedSignal[]>(cacheKey);
        if (persistentFallback?.data?.length) {
          setLiveSignals(persistentFallback.data);
          setIsLive(true);
        } else {
          const sharedPersistentFallback = readPersistentCache<UnifiedSignal[]>(sharedApiCacheKey);
          if (sharedPersistentFallback?.data?.length) {
            setLiveSignals(sharedPersistentFallback.data);
            setIsLive(true);
          } else {
          const sessionFallback = readSessionCache<UnifiedSignal[]>(cacheKey);
          if (sessionFallback?.data?.length) {
            setLiveSignals(sessionFallback.data);
            setIsLive(true);
          } else {
            const snap = cache.get(cacheKey);
            if (snap?.signals?.length) {
              setLiveSignals(snap.signals);
              setIsLive(true);
            }
          }
        }
        }
      }
      setLoading(false);
    };

    fetchAll();
  }, []);

  /**
   * Live articles are fetched with generic NewsAPI.ai queries (not company-filtered).
   * Company “curation” is scoring via {@link calculateResilienceScore} (keywords, etc.).
   * Re-score whenever the selected company changes — fetch only ran once with initial company.
   */
  const liveSignalsForCompany = useMemo(() => {
    return liveSignals.map((s) => {
      if (s.layer !== "live-news") return s;
      const score = calculateResilienceScore({
        title: s.title,
        description: s.description,
        source: s.source,
        date: s.date,
        domain: s.domain,
        category: s.category,
        companyId: selectedCompany,
      });
      return {
        ...s,
        resilienceScore: score.total,
        urgency: scoreToUrgency(score.total),
      };
    });
  }, [liveSignals, selectedCompany]);

  // Merge seeds + live, sorted by score descending
  const allSignals = useMemo(() => {
    const merged = [...filteredSeeds, ...liveSignalsForCompany];
    merged.sort((a, b) => b.resilienceScore - a.resilienceScore);
    return merged;
  }, [filteredSeeds, liveSignalsForCompany]);

  return { signals: allSignals, loading, isLive, seedSignals };
}
