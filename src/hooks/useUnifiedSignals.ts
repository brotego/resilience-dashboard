import { useState, useEffect, useRef, useMemo } from "react";
import { invokeNewsFeed, type NewsFeedRequestBody } from "@/api/newsFeed";
import { DomainId } from "@/data/types";
import { GenZCategoryId } from "@/data/genzTypes";
import { CompanyId, COMPANIES } from "@/data/companies";
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
const LIVE_CACHE_VERSION = "api-v10-country-high-volume";
const LEGACY_LIVE_CACHE_VERSIONS: string[] = [];
const DURABLE_SHARED_CACHE_KEY = "unified-live-durable-shared";
/** Process this many countries at a time while still keeping browser fetches manageable. */
const COUNTRY_FETCH_CHUNK = 2;
/** Conservative live mode: prioritize reliability over raw volume. */
const BUSINESS_ARTICLES_PER_PAGE = 40;
const BUSINESS_PAGES = 2;
const GENZ_ARTICLES_PER_PAGE = 20;
const GENZ_PAGES = 2;
const BOOTSTRAP_ARTICLES_PER_PAGE = 100;
const BOOTSTRAP_PAGES = 2;
const GENZ_BOOTSTRAP_ARTICLES_PER_PAGE = 60;
const GENZ_BOOTSTRAP_PAGES = 2;
const MAX_COMPANY_SIGNALS = 500;
const MIN_COMPANY_RELEVANCE_SCORE = 60;
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
  // Include all supported countries; rotate order by day for balanced startup distribution.
  const dayBucket = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
  const offset = ordered.length > 0 ? dayBucket % ordered.length : 0;
  const rotated = ordered.slice(offset).concat(ordered.slice(0, offset));
  return rotated;
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

function hashToUnit(key: string): number {
  // Deterministic 32-bit hash -> [0, 1)
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1_000_000) / 1_000_000;
}

function globalScatterCoords(key: string, i: number): [number, number] {
  // Spread points across globe (lon/lat) deterministically, avoid extreme poles.
  const u = hashToUnit(`${key}::u`);
  const v = hashToUnit(`${key}::v`);
  const lon = -180 + 360 * u;
  // Bias away from poles for nicer distribution on common map projections.
  const lat = -60 + 135 * v;
  // Tiny jitter so same-URL duplicates don’t perfectly overlap.
  const j = jitter([lon, lat], i, 7);
  return [j[0], Math.max(-70, Math.min(80, j[1]))];
}

function countryScatterCoords(
  country: { coords: [number, number] },
  articleKey: string,
  index: number,
): [number, number] {
  const u = hashToUnit(`${articleKey}::cu`);
  const v = hashToUnit(`${articleKey}::cv`);
  const angle = 2 * Math.PI * u;
  const rLat = 0.6 + 2.2 * Math.sqrt(v);
  const lat = country.coords[1] + rLat * Math.sin(angle);
  const cosLat = Math.max(0.3, Math.cos((Math.abs(country.coords[1]) * Math.PI) / 180));
  const rLon = rLat / cosLat;
  const lon = country.coords[0] + rLon * Math.cos(angle);
  const j = jitter([lon, lat], index, 13);
  return [Math.max(-179, Math.min(179, j[0])), Math.max(-70, Math.min(80, j[1]))];
}

function inferArticleGeo(article: any, index: number): { location: string; coordinates: [number, number]; isJapan: boolean } {
  const text = `${article?.title || ""} ${article?.description || ""} ${article?.content || ""}`.toLowerCase();

  // Prefer city-level matches for more precise placement.
  const cityMatch = WORLD_CITIES.find((c) => text.includes(c.name.toLowerCase()));
  if (cityMatch) {
    return {
      location: cityMatch.country,
      coordinates: jitter(cityMatch.coordinates, index, 31),
      isJapan: cityMatch.country === "Japan",
    };
  }

  // Fall back to country-level matches.
  const countryMatch = NEWS_COUNTRIES.find((c) => text.includes(c.name.toLowerCase()));
  if (countryMatch) {
    return {
      location: countryMatch.name,
      coordinates: jitter(countryMatch.coords, index, 32),
      isJapan: countryMatch.code === "jp",
    };
  }

  return {
    location: "Global",
    coordinates: globalScatterCoords(String(article?.url || article?.title || `g${index}`), index),
    isJapan: false,
  };
}

function looksLikeGenZNews(signal: UnifiedSignal): boolean {
  const text = `${signal.title || ""} ${signal.description || ""}`.toLowerCase();
  const strongGenZ = [
    "gen z",
    "zoomer",
    "teen",
    "teenager",
    "youth culture",
    "tiktok",
    "creator economy",
    "influencer",
    "college student",
    "campus",
  ];
  const mediumGenZ = [
    "youth",
    "young people",
    "young adults",
    "student",
    "social media",
    "digital native",
    "gaming community",
    "viral trend",
    "creator",
  ];
  const businessHeavy = [
    "stocks",
    "bond",
    "interest rate",
    "earnings",
    "merger",
    "acquisition",
    "gdp",
    "central bank",
    "trade deficit",
    "oil prices",
    "shareholder",
  ];

  const strongHits = strongGenZ.reduce((n, kw) => n + (text.includes(kw) ? 1 : 0), 0);
  const mediumHits = mediumGenZ.reduce((n, kw) => n + (text.includes(kw) ? 1 : 0), 0);
  const businessHits = businessHeavy.reduce((n, kw) => n + (text.includes(kw) ? 1 : 0), 0);
  const score = strongHits * 2 + mediumHits - businessHits;
  return score >= 1;
}

function inferDomainFromArticle(a: any): DomainId | undefined {
  const text = `${a?.title || ""} ${a?.description || ""} ${a?.content || ""}`.toLowerCase();
  const score = (strong: string[], medium: string[]) => {
    const strongHits = strong.reduce((n, kw) => n + (text.includes(kw) ? 1 : 0), 0);
    const mediumHits = medium.reduce((n, kw) => n + (text.includes(kw) ? 1 : 0), 0);
    return strongHits * 2 + mediumHits;
  };
  const domainScores: Record<DomainId, number> = {
    work: score(
      ["employment", "labor market", "hiring", "workforce", "office leasing", "remote work"],
      ["job", "salary", "career", "workplace", "hybrid work", "productivity"],
    ),
    selfhood: score(
      ["mental health", "burnout", "identity", "wellbeing"],
      ["self-care", "lifestyle", "anxiety", "purpose", "happiness"],
    ),
    community: score(
      ["community development", "public space", "social infrastructure", "urban policy"],
      ["community", "neighborhood", "city", "housing", "civic", "belonging"],
    ),
    aging: score(
      ["aging population", "elder care", "senior housing", "retirement system"],
      ["aging", "elderly", "senior", "retirement", "caregiving", "longevity"],
    ),
    environment: score(
      ["climate change", "carbon emissions", "renewable energy", "decarbonization"],
      ["climate", "sustainability", "green", "energy", "esg", "environment"],
    ),
  };
  const ranked = (Object.entries(domainScores) as [DomainId, number][])
    .sort((a1, b1) => b1[1] - a1[1]);
  const [best, second] = ranked;
  if (!best) return undefined;
  // Require meaningful confidence and separation from runner-up.
  if (best[1] < 2) return undefined;
  if (second && best[1] - second[1] < 1) return undefined;
  return best[0];
}

function inferGenZCategoryFromArticle(a: any): GenZCategoryId | undefined {
  const text = `${a?.title || ""} ${a?.description || ""} ${a?.content || ""}`.toLowerCase();
  const youthAnchors = [
    "gen z",
    "youth",
    "young",
    "student",
    "teen",
    "tiktok",
    "creator",
    "influencer",
    "campus",
    "digital native",
  ];
  const hasYouthAnchor = youthAnchors.some((kw) => text.includes(kw));
  if (!hasYouthAnchor) return undefined;
  const score = (strong: string[], medium: string[]) => {
    const strongHits = strong.reduce((n, kw) => n + (text.includes(kw) ? 1 : 0), 0);
    const mediumHits = medium.reduce((n, kw) => n + (text.includes(kw) ? 1 : 0), 0);
    return strongHits * 2 + mediumHits;
  };
  const categoryScores: Record<GenZCategoryId, number> = {
    authenticity: score(
      ["brand trust", "authenticity", "purpose-driven brand"],
      ["authentic", "values", "purpose", "trust", "ethical brand"],
    ),
    worklife: score(
      ["work-life balance", "hybrid work", "burnout", "gig economy"],
      ["worklife", "career", "remote work", "flexible work", "side hustle"],
    ),
    climate: score(
      ["climate action", "climate protest", "net zero", "decarbonization"],
      ["climate", "sustainability", "green", "carbon", "environment"],
    ),
    digital: score(
      ["tiktok", "creator economy", "social platform", "digital identity"],
      ["social media", "creator", "platform", "ai", "digital", "app", "viral"],
    ),
    belonging: score(
      ["social cohesion", "community belonging", "inclusive community"],
      ["community", "belonging", "identity", "culture", "inclusion", "social"],
    ),
  };
  const ranked = (Object.entries(categoryScores) as [GenZCategoryId, number][])
    .sort((a1, b1) => b1[1] - a1[1]);
  const [best, second] = ranked;
  if (!best) return undefined;
  if (best[1] < 2) return undefined;
  if (second && best[1] - second[1] < 1) return undefined;
  return best[0];
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

function isProviderLimitedResponse(data: { error?: string; fallback?: boolean } | null | undefined): boolean {
  const err = String(data?.error ?? "");
  return /429|403|forbidden|rate|too many|quota|limit exceeded|throttl/i.test(err);
}

async function fetchPagedArticles(
  type: "business" | "genz",
  country: { code: string; name: string },
  pageSize: number,
  pages: number,
  topicQuery?: string,
): Promise<{ articles: any[]; providerLimited: boolean }> {
  const seen = new Set<string>();
  const articles: any[] = [];
  for (let pageIndex = 0; pageIndex < pages; pageIndex++) {
    const { data } = await invokeNewsFeedResilient({
      type,
      countryCode: country.code,
      countryName: country.name,
      pageSize,
      page: pageIndex + 1,
      topicQuery,
    });
    if (isProviderLimitedResponse(data)) {
      return { articles, providerLimited: true };
    }
    if (data?.fallback || !Array.isArray(data?.articles)) continue;
    data.articles.forEach((article: any) => {
      const dedupeKey = article.url || `${article.title}-${article.date}-${article.source}`;
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      articles.push(article);
    });
  }
  return { articles, providerLimited: false };
}

async function fetchGenZArticleBuckets(
  country: { code: string; name: string },
  pageSize: number,
  pages: number,
  companyHint: string,
): Promise<{ articles: any[]; providerLimited: boolean }> {
  const hint = companyHint ? ` "${companyHint}"` : "";
  const buckets = [
    `Gen Z youth culture social media TikTok creator economy${hint}`.trim(),
    `Gen Z worklife burnout career remote work gig economy${hint}`.trim(),
    `Gen Z climate activism sustainability community belonging${hint}`.trim(),
  ];
  const seen = new Set<string>();
  const merged: any[] = [];
  let limited = false;
  for (const query of buckets) {
    const res = await fetchPagedArticles("genz", country, pageSize, pages, query)
      .catch(() => ({ articles: [] as any[], providerLimited: false }));
    if (res.providerLimited) {
      limited = true;
      continue;
    }
    for (const a of res.articles) {
      const key = a.url || `${a.title}-${a.date}-${a.source}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(a);
    }
  }
  return { articles: merged, providerLimited: limited };
}

function dedupeSignalsByArticleUrl(signals: UnifiedSignal[]): UnifiedSignal[] {
  const seen = new Set<string>();
  const out: UnifiedSignal[] = [];
  for (const s of signals) {
    const articleKey = s.articleUrl && s.articleUrl !== "#" ? s.articleUrl : s.id;
    const key = `${articleKey}::${s.location || "unknown"}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function getLegacyCacheKeys(apiKeySuffix: string): string[] {
  if (LEGACY_LIVE_CACHE_VERSIONS.length === 0) return [];
  return LEGACY_LIVE_CACHE_VERSIONS.map((version) => `unified-live-${version}-${apiKeySuffix}`);
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
  const retryTimerRef = useRef<number | null>(null);

  // Seed signals with dynamic scores, re-scored when company changes
  const seedSignals = useMemo(() => seedToUnified(selectedCompany), [selectedCompany]);

  // Static fallback seeds (used only when API mode is not configured)
  const filteredSeeds = useMemo(() => {
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

    const apiConfigured = isNewsApiAiConfigured();
    const selectedCompanyData = selectedCompany
      ? COMPANIES.find((c) => c.id === selectedCompany)
      : null;
    const companyKeywords = selectedCompanyData
      ? selectedCompanyData.keywords.map((k) => k.toLowerCase())
      : [];
    const companyNameLower = selectedCompanyData?.name.toLowerCase() || "";
    const isCompanyRelevantSignal = (s: UnifiedSignal): boolean => {
      if (mode === "genz") {
        // Gen Z mode should prioritize Gen Z relevance over strict company mention density.
        if (s.layer === "live-news") {
          if (s.category) return true;
          return looksLikeGenZNews(s) || s.resilienceScore >= 40;
        }
        return true;
      }
      if (!selectedCompanyData) return true;
      const text = `${s.title || ""} ${s.description || ""} ${s.source || ""} ${s.location || ""}`.toLowerCase();
      if (companyNameLower && text.includes(companyNameLower)) return true;
      const keywordHit = companyKeywords.some((kw) => kw.length > 2 && text.includes(kw));
      if (keywordHit) return true;
      return s.resilienceScore >= MIN_COMPANY_RELEVANCE_SCORE;
    };
    const finalizeSignals = (arr: UnifiedSignal[]): UnifiedSignal[] => {
      const deduped = dedupeSignalsByArticleUrl(arr);
      deduped.sort((a, b) => {
        if (b.resilienceScore !== a.resilienceScore) return b.resilienceScore - a.resilienceScore;
        return a.id.localeCompare(b.id);
      });
      const companyFiltered = deduped.filter(isCompanyRelevantSignal);
      const selected = companyFiltered.length > 0 ? companyFiltered : deduped;
      return selected.slice(0, MAX_COMPANY_SIGNALS);
    };
    const apiKeySuffix = isNewsApiAiConfigured() ? newsApiKeyFingerprint() : "seed";
    const cacheKey = `unified-live-${isNewsApiAiConfigured() ? LIVE_CACHE_VERSION : "seed"}-${apiKeySuffix}`;
    const sharedApiCacheKey = `unified-live-${LIVE_CACHE_VERSION}-shared`;
    const legacyCacheKeys = getLegacyCacheKeys(apiKeySuffix);
    const legacySharedKeys = LEGACY_LIVE_CACHE_VERSIONS.map((version) => `unified-live-${version}-shared`);
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      const filtered = finalizeSignals(cached.signals);
      setLiveSignals(filtered);
      setIsLive(true);
      setLoading(false);
      if (!apiConfigured) return;
    }

    const persistentEntry = readPersistentCache<UnifiedSignal[]>(cacheKey);
    if (persistentEntry?.data?.length) {
      const filtered = finalizeSignals(persistentEntry.data);
      cache.set(cacheKey, { signals: filtered, timestamp: persistentEntry.savedAt });
      setLiveSignals(filtered);
      setIsLive(true);
      setLoading(false);
      if (!apiConfigured) return;
    }
    const sharedPersistentEntry = readPersistentCache<UnifiedSignal[]>(sharedApiCacheKey);
    if (sharedPersistentEntry?.data?.length) {
      const filtered = finalizeSignals(sharedPersistentEntry.data);
      cache.set(cacheKey, { signals: filtered, timestamp: sharedPersistentEntry.savedAt });
      setLiveSignals(filtered);
      setIsLive(true);
      setLoading(false);
      if (!apiConfigured) return;
    }
    const durableSharedEntry = readPersistentCache<UnifiedSignal[]>(DURABLE_SHARED_CACHE_KEY);
    if (durableSharedEntry?.data?.length) {
      const filtered = finalizeSignals(durableSharedEntry.data);
      cache.set(cacheKey, { signals: filtered, timestamp: durableSharedEntry.savedAt });
      setLiveSignals(filtered);
      setIsLive(true);
      setLoading(false);
      if (!apiConfigured) return;
    }

    const fetchAll = async () => {
      const results: UnifiedSignal[] = [];
      let gotLive = false;
      let countryBuiltCount = 0;
      let providerLimited = false;
      const companyTopicQuery = selectedCompanyData
        ? `"${selectedCompanyData.name}" "${selectedCompanyData.sector}" ${selectedCompanyData.keywords.slice(0, 10).join(" ")}`
        : "";
      const genzCompanyHint = selectedCompanyData?.name || "";
      const businessTopicQueryStrict = companyTopicQuery
        ? `"commercial real estate" "urban redevelopment" "mixed-use" "office leasing" "property development" Tokyo Minato ${companyTopicQuery} Azabudai Toranomon Roppongi`
        : `"commercial real estate" "urban redevelopment" "mixed-use" "office leasing" "property development" Tokyo Minato`;
      const businessTopicQueryFallback = "";
      const genzTopicQueryStrict = companyTopicQuery
        ? `"urban lifestyle" "housing affordability" "city work culture" "community wellbeing" Gen Z youth Tokyo ${companyTopicQuery}`
        : `"urban lifestyle" "housing affordability" "city work culture" "community wellbeing" Gen Z youth Tokyo`;
      const genzTopicQueryFallback = "";

      // Bootstrap: use mode-specific search paths so Gen Z has its own strong retrieval.
      const bootstrapCountries = getFetchCountries();
      const bootstrapResults = await Promise.all(
        bootstrapCountries.map(async (country) => {
          if (mode === "genz") {
            const res = await fetchGenZArticleBuckets(
              country,
              GENZ_BOOTSTRAP_ARTICLES_PER_PAGE,
              GENZ_BOOTSTRAP_PAGES,
              genzCompanyHint,
            ).catch(() => ({ articles: [] as any[], providerLimited: false }));
            return { country, res };
          }
          const res = await fetchPagedArticles("business", country, BOOTSTRAP_ARTICLES_PER_PAGE, BOOTSTRAP_PAGES, "")
            .catch(() => ({ articles: [] as any[], providerLimited: false }));
          return { country, res };
        }),
      );

      let bootstrapCount = 0;
      for (const { country, res } of bootstrapResults) {
        if (res.providerLimited) providerLimited = true;
        if (res.articles.length === 0) continue;
        bootstrapCount += res.articles.length;
        gotLive = true;
        countryBuiltCount += res.articles.length;
        results.push(
          ...res.articles.map((a: any, i: number) => {
            const score = calculateResilienceScore({
              title: a.title || "", description: a.description || "",
              source: a.source, date: a.date, companyId: selectedCompany,
            });
            return {
              id: `live-bootstrap-${country.code}-${a.url || i}`,
              title: a.title || "Untitled",
              description: a.description || "",
              location: country.name,
              coordinates: country.coords,
              layer: "live-news" as const,
              domain: inferDomainFromArticle(a),
              category: inferGenZCategoryFromArticle(a),
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

      if (bootstrapCount > 0) {
        const bootMerged = finalizeSignals(results);
        setLiveSignals(bootMerged);
        setIsLive(true);
        setLoading(false);
      }

      const fetchCountries = getFetchCountries();
      for (let start = 0; start < fetchCountries.length; start += COUNTRY_FETCH_CHUNK) {
        if (providerLimited) break;
        const chunk = fetchCountries.slice(start, start + COUNTRY_FETCH_CHUNK);
        const chunkResults = await Promise.all(
          chunk.map(async (country, localIndex) => {
            const ci = start + localIndex;
            let bizResult = await fetchPagedArticles("business", country, BUSINESS_ARTICLES_PER_PAGE, BUSINESS_PAGES, businessTopicQueryStrict)
              .catch(() => ({ articles: [] as any[], providerLimited: false }));
            if (!bizResult.providerLimited && bizResult.articles.length < 6) {
              const relaxedBiz = await fetchPagedArticles("business", country, BUSINESS_ARTICLES_PER_PAGE, BUSINESS_PAGES, businessTopicQueryFallback)
                .catch(() => ({ articles: [] as any[], providerLimited: false }));
              if (!relaxedBiz.providerLimited && relaxedBiz.articles.length > bizResult.articles.length) bizResult = relaxedBiz;
            }

            let gzResult = { articles: [] as any[], providerLimited: false };
            if (mode === "genz") {
              gzResult = await fetchGenZArticleBuckets(country, GENZ_ARTICLES_PER_PAGE, GENZ_PAGES, genzCompanyHint)
                .catch(() => ({ articles: [] as any[], providerLimited: false }));
              if (!gzResult.providerLimited && gzResult.articles.length < 10) {
                const relaxedGz = await fetchPagedArticles("genz", country, GENZ_ARTICLES_PER_PAGE, GENZ_PAGES, genzTopicQueryFallback)
                  .catch(() => ({ articles: [] as any[], providerLimited: false }));
                if (!relaxedGz.providerLimited && relaxedGz.articles.length > gzResult.articles.length) gzResult = relaxedGz;
              }
            }
            return { country, ci, bizResult, gzResult };
          }),
        );

        for (const { country, ci, bizResult, gzResult } of chunkResults) {
          // Prioritize business feed continuity; genz throttling should not kill business pass.
          if (bizResult.providerLimited || (mode === "genz" && gzResult.providerLimited)) {
            providerLimited = true;
          }
          const bizArticles = bizResult.articles;
          const gzArticles = gzResult.articles;
          if (bizArticles.length > 0) {
            gotLive = true;
            countryBuiltCount += bizArticles.length;
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
                  coordinates: country.coords,
                  layer: "live-news" as const,
                  domain: inferDomainFromArticle(a),
                  category: inferGenZCategoryFromArticle(a),
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

          if (gzArticles.length > 0) {
            gotLive = true;
            countryBuiltCount += gzArticles.length;
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
                  coordinates: country.coords,
                  layer: "live-news" as const,
                  domain: inferDomainFromArticle(a),
                  category: inferGenZCategoryFromArticle(a),
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
        }

        // Stream partial results so map signals appear quickly instead of waiting for full pass.
        if (results.length > 0) {
          const partial = finalizeSignals(results);
          setLiveSignals(partial);
          setIsLive(true);
          setLoading(false);
        }

        await new Promise((r) => setTimeout(r, 100));
      }

      const merged = finalizeSignals(results);

      // Emergency recovery: if nothing came back, run a broad business-only sweep on top countries.
      if (merged.length === 0) {
        const emergencyCountries = getFetchCountries().slice(0, 6);
        for (let ci = 0; ci < emergencyCountries.length; ci++) {
          const country = emergencyCountries[ci];
          const emergencyBiz = await fetchPagedArticles("business", country, 20, 1, "")
            .catch(() => ({ articles: [] as any[], providerLimited: false }));
          if (emergencyBiz.articles.length === 0) continue;
          gotLive = true;
          countryBuiltCount += emergencyBiz.articles.length;
          merged.push(
            ...emergencyBiz.articles.map((a: any, i: number) => {
              const score = calculateResilienceScore({
                title: a.title || "", description: a.description || "",
                source: a.source, date: a.date, companyId: selectedCompany,
              });
              return {
                id: `live-biz-emergency-${country.code}-${a.url || i}`,
                title: a.title || "Untitled",
                description: a.description || "",
                location: country.name,
                coordinates: country.coords,
                layer: "live-news" as const,
                domain: inferDomainFromArticle(a),
                category: inferGenZCategoryFromArticle(a),
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
      }
      const finalMerged = finalizeSignals(merged);

      if (typeof window !== "undefined") {
        (window as any).__rrNewsDebug = {
          at: new Date().toISOString(),
          apiConfigured: isNewsApiAiConfigured(),
          fetchedCountries: getFetchCountries().map((c) => c.name),
          countryBuiltCount,
          rawResultsCount: results.length,
          mergedCount: finalMerged.length,
          gotLive,
          providerLimited,
        };
      }

      if (gotLive && finalMerged.length > 0) {
        const now = Date.now();
        cache.set(cacheKey, { signals: finalMerged, timestamp: now });
        writeSessionCache(cacheKey, finalMerged);
        writePersistentCache(cacheKey, finalMerged);
        writePersistentCache(sharedApiCacheKey, finalMerged);
        writePersistentCache(DURABLE_SHARED_CACHE_KEY, finalMerged);
        setLiveSignals(finalMerged);
        setIsLive(true);
      } else if (isNewsApiAiConfigured()) {
        let restored = false;
        const persistentFallback = readPersistentCache<UnifiedSignal[]>(cacheKey);
        if (persistentFallback?.data?.length) {
          setLiveSignals(persistentFallback.data);
          setIsLive(true);
          restored = true;
        } else {
          const sharedPersistentFallback = readPersistentCache<UnifiedSignal[]>(sharedApiCacheKey);
          if (sharedPersistentFallback?.data?.length) {
            setLiveSignals(sharedPersistentFallback.data);
            setIsLive(true);
            restored = true;
          } else {
            const sessionFallback = readSessionCache<UnifiedSignal[]>(cacheKey);
            if (sessionFallback?.data?.length) {
              setLiveSignals(sessionFallback.data);
              setIsLive(true);
              restored = true;
            } else {
              const snap = cache.get(cacheKey);
              if (snap?.signals?.length) {
                setLiveSignals(snap.signals);
                setIsLive(true);
                restored = true;
              }
            }
          }
        }

        if (!restored) {
          for (const key of legacyCacheKeys) {
            const persistentLegacy = readPersistentCache<UnifiedSignal[]>(key);
            if (persistentLegacy?.data?.length) {
              setLiveSignals(persistentLegacy.data);
              setIsLive(true);
              restored = true;
              break;
            }
            const sessionLegacy = readSessionCache<UnifiedSignal[]>(key);
            if (sessionLegacy?.data?.length) {
              setLiveSignals(sessionLegacy.data);
              setIsLive(true);
              restored = true;
              break;
            }
          }
        }

        if (!restored) {
          for (const key of legacySharedKeys) {
            const sharedLegacy = readPersistentCache<UnifiedSignal[]>(key);
            if (sharedLegacy?.data?.length) {
              setLiveSignals(sharedLegacy.data);
              setIsLive(true);
              restored = true;
              break;
            }
          }
        }

        if (!restored) {
          const durableSharedFallback = readPersistentCache<UnifiedSignal[]>(DURABLE_SHARED_CACHE_KEY);
          if (durableSharedFallback?.data?.length) {
            setLiveSignals(durableSharedFallback.data);
            setIsLive(true);
            restored = true;
          }
        }

        // Keep trying periodically in API mode if we still have no live/cached signals.
        if (!restored) {
          if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
          retryTimerRef.current = window.setTimeout(() => {
            fetchAll();
          }, 30_000);
        }
      }
      setLoading(false);
    };

    fetchAll();
    return () => {
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, []);

  /**
   * Live articles are fetched with generic NewsAPI.ai queries (not company-filtered).
   * Company “curation” is scoring via {@link calculateResilienceScore} (keywords, etc.).
   * Re-score whenever the selected company changes — fetch only ran once with initial company.
   */
  const liveSignalsForCompany = useMemo(() => {
    const rescored = liveSignals.map((s) => {
      if (s.layer !== "live-news") return s;
      const fallbackArticle = {
        title: s.title || "",
        description: s.description || "",
        content: s.articleContent || "",
      };
      const inferredDomain = s.domain || inferDomainFromArticle(fallbackArticle);
      const inferredCategory = s.category || inferGenZCategoryFromArticle(fallbackArticle);
      const score = calculateResilienceScore({
        title: s.title,
        description: s.description,
        source: s.source,
        date: s.date,
        domain: inferredDomain,
        category: inferredCategory,
        companyId: selectedCompany,
      });
      return {
        ...s,
        domain: inferredDomain,
        category: inferredCategory,
        resilienceScore: score.total,
        urgency: scoreToUrgency(score.total),
      };
    });
    return rescored;
  }, [liveSignals, selectedCompany]);

  // Merge seeds + live, sorted by score descending
  const allSignals = useMemo(() => {
    // In API mode, never show synthetic seed signals.
    const includeSeeds = !isNewsApiAiConfigured();
    const merged = includeSeeds ? [...filteredSeeds, ...liveSignalsForCompany] : [...liveSignalsForCompany];
    merged.sort((a, b) => b.resilienceScore - a.resilienceScore);
    return merged;
  }, [filteredSeeds, liveSignalsForCompany]);

  return { signals: allSignals, loading, isLive, seedSignals };
}
