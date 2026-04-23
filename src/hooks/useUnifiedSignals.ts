import { useState, useEffect, useRef, useMemo } from "react";
import { invokeNewsFeed, type NewsFeedRequestBody } from "@/api/newsFeed";
import { DomainId } from "@/data/types";
import { GenZCategoryId } from "@/data/genzTypes";
import { CompanyId, COMPANIES, type Company } from "@/data/companies";
import { SIGNALS } from "@/data/signals";
import { GENZ_SIGNALS } from "@/data/genzSignals";
import { WORLD_CITIES } from "@/data/capitals";
import { UnifiedSignal } from "@/data/unifiedSignalTypes";
import { calculateResilienceScore, scoreToUrgency } from "@/lib/resilienceScore";
import { isNewsApiAiConfigured } from "@/lib/newsApiConfigured";
import { readSessionCache, writeSessionCache } from "@/lib/newsSessionCache";
import { readPersistentCache, writePersistentCache } from "@/lib/newsPersistentCache";
import {
  isSupabaseSignalBundleCacheConfigured,
  readSignalBundleCache,
  writeSignalBundleCache,
} from "@/lib/projectSupabaseCache";
import { DashboardMode } from "@/components/dashboard/DashboardLayout";

interface CacheEntry {
  signals: UnifiedSignal[];
  timestamp: number;
}

/** Event Registry article bodies are huge; persisting them blows localStorage quota and fails silently. */
const MAX_DESCRIPTION_CHARS_IN_CACHE = 800;

function slimUnifiedSignalsForCache(signals: UnifiedSignal[]): UnifiedSignal[] {
  return signals.map((s) => {
    const d = s.description || "";
    const description =
      d.length > MAX_DESCRIPTION_CHARS_IN_CACHE ? `${d.slice(0, MAX_DESCRIPTION_CHARS_IN_CACHE)}…` : d;
    const { articleContent: _drop, ...rest } = s;
    void _drop;
    return { ...rest, description } as UnifiedSignal;
  });
}

/** In-memory mirror of persistent TTL: refresh article bundles daily. */
const CACHE_DURATION = 24 * 60 * 60 * 1000;
const cache = new Map<string, CacheEntry>();
const LIVE_CACHE_VERSION = "api-v15-atomic-bundle-ui";
const LEGACY_LIVE_CACHE_VERSIONS: string[] = ["api-v10-country-high-volume", "api-v11-company-scoped-24h"];
const BUSINESS_ARTICLES_PER_PAGE = 100;
const BUSINESS_PAGES = 2;
const GENZ_ARTICLES_PER_PAGE = 80;
const GENZ_PAGES = 3;
const MAX_COMPANY_SIGNALS = 500;
const MIN_COMPANY_SIGNALS = 250;
/** Avoid one wire dominating the map / click stack (per normalized outlet name). */
const MAX_SIGNALS_PER_SOURCE = 25;
/** After packing, keep pushing unique countries into the bundle so the map doesn't collapse to a handful of markets. */
const MIN_DISPLAY_COUNTRIES = 22;
const MAX_ER_TOPIC_CHARS = 480;

function dayBucketKey(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function prevUtcDayBucketKey(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Supabase jsonb sometimes arrives stringified or wrapped; normalize before finalize. */
function coerceUnifiedBundlePayload(raw: unknown): UnifiedSignal[] {
  if (Array.isArray(raw)) return raw as UnifiedSignal[];
  if (raw == null) return [];
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw) as unknown;
      return Array.isArray(p) ? (p as UnifiedSignal[]) : [];
    } catch {
      return [];
    }
  }
  if (typeof raw === "object" && raw !== null && "signals" in (raw as object)) {
    const s = (raw as { signals?: unknown }).signals;
    return Array.isArray(s) ? (s as UnifiedSignal[]) : [];
  }
  return [];
}
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
  China: "cn",
  Russia: "ru",
  Ethiopia: "et",
  Nepal: "np",
  Cambodia: "kh",
};

function durablePersistentKey(mode: DashboardMode, companyKey: string): string {
  return `unified-live-durable-v2-${mode}-${companyKey}`;
}

function companyIndustryAnchorsLower(company: Company): string[] {
  return company.industryNewsTerms
    .map((t) => t.toLowerCase().trim())
    .filter((t) => t.length >= 4);
}

/** Sector tokens long enough to avoid junk hits (e.g. "real" from real estate). */
function companySectorBitsStrict(company: Company): string[] {
  return company.sector
    .toLowerCase()
    .split(/[^a-z0-9+]+/)
    .filter((w) => w.length >= 6 && w !== "and");
}

/** Title + description match company industry lens (name, curated industry terms, strict sector). */
function liveNewsTextMatchesCompanyIndustry(title: string, description: string, company: Company): boolean {
  const text = `${title || ""} ${description || ""}`.toLowerCase();
  const name = company.name.toLowerCase();
  if (name && text.includes(name)) return true;
  if (companyIndustryAnchorsLower(company).some((t) => text.includes(t))) return true;
  return companySectorBitsStrict(company).some((w) => text.includes(w));
}

/**
 * Resilience-map Event Registry query: quoted name + sector + curated industry phrases (+ short description).
 * Avoids long intel/brand lists that pull unrelated culture, VC, or city-generic news.
 */
function buildResilienceMapBusinessTopicQuery(company: Company): string {
  const desc = (company.description || "").trim();
  const parts = [
    `"${company.name.replace(/"/g, " ").trim()}"`,
    company.sector,
    ...company.industryNewsTerms,
    desc.length > 140 ? `${desc.slice(0, 140)}…` : desc,
  ];
  let q = parts.join(" ").replace(/\s+/g, " ").trim();
  if (q.length > MAX_ER_TOPIC_CHARS) q = q.slice(0, MAX_ER_TOPIC_CHARS);
  return q;
}

/** Second pass: add a few flagship brands/lines from intel for branded hits, still industry-first. */
function buildResilienceMapBusinessTopicQueryRelaxed(company: Company): string {
  const intel = company.intel;
  const desc = (company.description || "").trim();
  const parts = [
    `"${company.name.replace(/"/g, " ").trim()}"`,
    company.sector,
    ...company.industryNewsTerms,
    ...(intel.brandsAndAssets?.slice(0, 4) ?? []),
    ...intel.coreBusinessLines.slice(0, 4),
    desc.length > 220 ? `${desc.slice(0, 220)}…` : desc,
  ];
  let q = parts.join(" ").replace(/\s+/g, " ").trim();
  if (q.length > MAX_ER_TOPIC_CHARS) q = q.slice(0, MAX_ER_TOPIC_CHARS);
  return q;
}

function buildCompanyGenZContextHint(company: Company): string {
  const intel = company.intel;
  const q = [
    `"${company.name.replace(/"/g, " ").trim()}"`,
    company.sector,
    ...company.industryNewsTerms.slice(0, 5),
    ...company.keywords.slice(0, 6),
    intel.reputationAndGenZ ? intel.reputationAndGenZ.slice(0, 120) : "",
  ].join(" ");
  return q.slice(0, 260);
}

function resolveArticleDomain(company: Company | null, article: unknown): DomainId {
  const inferred = inferDomainFromArticle(article);
  if (inferred) return inferred;
  const first = company?.relevantDomains?.[0];
  if (first && ["work", "selfhood", "community", "aging", "environment"].includes(first)) {
    return first as DomainId;
  }
  return "work";
}

function resolveArticleCategory(
  company: Company | null,
  article: unknown,
  opts?: { strict?: boolean },
): GenZCategoryId | undefined {
  const inferred = inferGenZCategoryFromArticle(article);
  if (inferred) return inferred;
  if (opts?.strict) return undefined;
  const first = company?.relevantGenZCategories?.[0];
  if (first && ["authenticity", "worklife", "climate", "digital", "belonging"].includes(first)) {
    return first as GenZCategoryId;
  }
  return "digital";
}

const NEWS_COUNTRIES = WORLD_CITIES
  .filter((city) => city.isCapital && COUNTRY_CODES[city.country])
  .map((city) => ({
    code: COUNTRY_CODES[city.country],
    name: city.country,
    coords: city.coordinates,
  }))
  .filter((country, index, arr) => arr.findIndex((item) => item.name === country.name) === index);

const NEWS_COUNTRY_NAME_SET = new Set(NEWS_COUNTRIES.map((c) => c.name));

/** Multiple city anchors per country so signals spread across the territory instead of one capital stack. */
const ANCHORS_BY_COUNTRY: Map<string, [number, number][]> = (() => {
  const m = new Map<string, [number, number][]>();
  for (const city of WORLD_CITIES) {
    if (!NEWS_COUNTRY_NAME_SET.has(city.country)) continue;
    if (!m.has(city.country)) m.set(city.country, []);
    m.get(city.country)!.push(city.coordinates);
  }
  for (const c of NEWS_COUNTRIES) {
    if (!m.has(c.name) || m.get(c.name)!.length === 0) m.set(c.name, [c.coords]);
  }
  return m;
})();

function spreadSignalCoordinatesInCountry(
  country: { name: string; coords: [number, number] },
  articleKey: string,
  index: number,
): [number, number] {
  const anchors = ANCHORS_BY_COUNTRY.get(country.name);
  if (!anchors || anchors.length === 0) {
    return countryScatterCoords({ coords: country.coords }, articleKey, index);
  }
  const pick = hashToUnit(`${articleKey}::citypick`);
  const anchorIdx = Math.min(anchors.length - 1, Math.floor(pick * anchors.length));
  return countryScatterCoords({ coords: anchors[anchorIdx] }, `${articleKey}::a${anchorIdx}`, index);
}

function stableCountryOrder(list: typeof NEWS_COUNTRIES): typeof NEWS_COUNTRIES {
  return [...list].sort((a, b) => a.name.localeCompare(b.name));
}

/** Major markets first so large English-language pools (e.g. US) are always retrieved, then the full rotated list. */
const FETCH_ORDER_HEAD: readonly string[] = [
  "United States of America",
  "United Kingdom",
  "Japan",
  "China",
  "Germany",
  "France",
  "India",
  "Brazil",
  "Canada",
  "Australia",
  "South Korea",
  "Mexico",
  "Singapore",
  "Netherlands",
  "Sweden",
  "Italy",
  "Spain",
] as const;

function hashString32(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function getFetchCountries(params: { mode: DashboardMode; companyKey: string }): typeof NEWS_COUNTRIES {
  const ordered = stableCountryOrder(NEWS_COUNTRIES);
  const dayBucket = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
  const companySalt = hashString32(`${params.mode}:${params.companyKey}`);
  const offset = ordered.length > 0 ? (dayBucket + companySalt) % ordered.length : 0;
  const rotated = ordered.slice(offset).concat(ordered.slice(0, offset));
  const byName = new Map(rotated.map((c) => [c.name, c] as const));
  const head: typeof NEWS_COUNTRIES = [];
  for (const name of FETCH_ORDER_HEAD) {
    const row = byName.get(name);
    if (row) head.push(row);
  }
  const headNames = new Set(head.map((c) => c.name));
  const tail = rotated.filter((c) => !headNames.has(c.name));
  // Rotate which "tail" countries lead after the major-market head so different companies
  // don't always bias toward the same secondary markets on partial fetches.
  const tailOffset = tail.length > 0 ? companySalt % tail.length : 0;
  const tailRotated = tail.slice(tailOffset).concat(tail.slice(0, tailOffset));
  return [...head, ...tailRotated];
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

/** Small angular jitter for map coordinates (degrees), keeps points near anchors and on-land once clamped. */
function jitter(coords: [number, number], index: number, offset = 0, maxRadiusDeg = 0.18): [number, number] {
  const seed = index + offset * 7;
  const angle = (seed * 137.5) * (Math.PI / 180);
  const u = hashToUnit(`jitter-${seed}-${offset}`);
  const r = maxRadiusDeg * (0.3 + 0.7 * u);
  const latRad = (coords[1] * Math.PI) / 180;
  const dLat = r * Math.sin(angle);
  const dLng = (r * Math.cos(angle)) / Math.max(0.35, Math.cos(latRad));
  return [coords[0] + dLng, coords[1] + dLat];
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
  const j = jitter([lon, lat], i, 7, 0.9);
  return [j[0], Math.max(-70, Math.min(80, j[1]))];
}

function countryScatterCoords(
  anchor: { coords: [number, number] },
  articleKey: string,
  index: number,
  spreadScale = 0.52,
): [number, number] {
  const u = hashToUnit(`${articleKey}::cu`);
  const v = hashToUnit(`${articleKey}::cv`);
  const angle = 2 * Math.PI * u;
  // Wider on-land scatter around city anchors; map clamp still pulls ocean points back into the polygon.
  const rLat = (0.05 + 0.48 * Math.sqrt(v)) * spreadScale;
  const lat = anchor.coords[1] + rLat * Math.sin(angle);
  const cosLat = Math.max(0.3, Math.cos((Math.abs(anchor.coords[1]) * Math.PI) / 180));
  const rLon = rLat / cosLat;
  const lon = anchor.coords[0] + rLon * Math.cos(angle);
  const j = jitter([lon, lat], index, 13, 0.17);
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

function articleText(a: any): string {
  return `${a?.title || ""} ${a?.description || ""} ${a?.content || ""}`.toLowerCase();
}

function looksLikeStrictGenZArticle(a: any): boolean {
  const text = articleText(a);
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
    "instagram",
    "youtube shorts",
    "snapchat",
    "discord",
    "reddit",
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
    "online community",
    "content creator",
  ];
  const businessHeavy = [
    "interest rate",
    "shareholder",
    "bond",
    "gdp",
    "federal reserve",
    "dividend",
    "quarterly earnings",
  ];

  const strongHits = strongGenZ.reduce((n, kw) => n + (text.includes(kw) ? 1 : 0), 0);
  const mediumHits = mediumGenZ.reduce((n, kw) => n + (text.includes(kw) ? 1 : 0), 0);
  const businessHits = businessHeavy.reduce((n, kw) => n + (text.includes(kw) ? 1 : 0), 0);
  const score = strongHits * 2 + mediumHits - businessHits;
  return score >= 1;
}

function isArticleRelevantToCompanyIndustry(a: any, company: Company | null): boolean {
  if (!company) return true;
  const title = String(a?.title || "");
  const description = String(a?.description || "");
  if (company.industryNewsTerms.length > 0) {
    if (liveNewsTextMatchesCompanyIndustry(title, description, company)) return true;
  }
  const text = articleText(a);
  const companyNameLower = company.name.toLowerCase();
  if (companyNameLower && text.includes(companyNameLower)) return true;
  if (company.keywords.some((kw) => kw.length > 2 && text.includes(kw.toLowerCase()))) return true;
  return companySectorBitsStrict(company).some((w) => text.includes(w));
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
  company: Company | null,
): Promise<{ articles: any[]; providerLimited: boolean }> {
  const hint = company ? ` ${buildCompanyGenZContextHint(company)}` : "";
  const buckets = [
    `Gen Z youth culture social media TikTok creator economy${hint}`.trim(),
    `Gen Z worklife burnout career remote work gig economy${hint}`.trim(),
    `Gen Z climate activism sustainability community belonging${hint}`.trim(),
    `young adults students university campus digital behavior social apps${hint}`.trim(),
    `Gen Z spending trends brand loyalty creator content video platforms${hint}`.trim(),
    `youth employment internships side hustle creator monetization${hint}`.trim(),
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

function normalizeOutletKey(source: string | undefined): string {
  const s = (source || "").trim().toLowerCase();
  if (!s) return "__unknown__";
  return s.slice(0, 80);
}

/**
 * Round-robin across countries (so every market gets dots), cap each outlet, then fill by score.
 * Applied after dedupe + relevance so the map stays diverse instead of one wire + one city stack.
 */
function stratifiedSourceCapPack(
  signals: UnifiedSignal[],
  maxTotal: number,
  maxPerSource: number,
  minFloor: number,
): UnifiedSignal[] {
  if (signals.length === 0) return [];

  const byCountry = new Map<string, UnifiedSignal[]>();
  for (const s of signals) {
    const loc = (s.location || "unknown").trim().toLowerCase();
    if (!byCountry.has(loc)) byCountry.set(loc, []);
    byCountry.get(loc)!.push(s);
  }
  for (const arr of byCountry.values()) {
    arr.sort((a, b) => b.resilienceScore - a.resilienceScore || a.id.localeCompare(b.id));
  }
  const countries = [...byCountry.keys()].sort((a, b) => a.localeCompare(b));
  const pointers = new Map<string, number>();
  for (const c of countries) pointers.set(c, 0);

  const out: UnifiedSignal[] = [];
  const taken = new Set<string>();
  const sourceCount = new Map<string, number>();

  const canTakeSource = (s: UnifiedSignal) => (sourceCount.get(normalizeOutletKey(s.source)) || 0) < maxPerSource;

  let progressed = true;
  while (out.length < maxTotal && progressed) {
    progressed = false;
    for (const c of countries) {
      if (out.length >= maxTotal) break;
      const arr = byCountry.get(c)!;
      let pi = pointers.get(c)!;
      while (pi < arr.length) {
        const s = arr[pi++];
        pointers.set(c, pi);
        if (taken.has(s.id)) continue;
        if (!canTakeSource(s)) continue;
        out.push(s);
        taken.add(s.id);
        const sk = normalizeOutletKey(s.source);
        sourceCount.set(sk, (sourceCount.get(sk) || 0) + 1);
        progressed = true;
        break;
      }
    }
  }

  const remainder = signals
    .filter((s) => !taken.has(s.id))
    .sort((a, b) => b.resilienceScore - a.resilienceScore || a.id.localeCompare(b.id));

  for (const s of remainder) {
    if (out.length >= maxTotal) break;
    const sk = normalizeOutletKey(s.source);
    if ((sourceCount.get(sk) || 0) >= maxPerSource) continue;
    out.push(s);
    taken.add(s.id);
    sourceCount.set(sk, (sourceCount.get(sk) || 0) + 1);
  }

  // Hard floor: if source-cap prevented enough density, keep filling (ignoring source cap)
  // until we hit the requested minimum, as long as unique signals are available.
  if (out.length < Math.min(minFloor, maxTotal)) {
    for (const s of remainder) {
      if (out.length >= Math.min(minFloor, maxTotal)) break;
      if (taken.has(s.id)) continue;
      out.push(s);
      taken.add(s.id);
    }
  }

  return out;
}

function getLegacyCacheKeys(apiKeySuffix: string, mode: DashboardMode, companyKey: string): string[] {
  if (LEGACY_LIVE_CACHE_VERSIONS.length === 0) return [];
  return LEGACY_LIVE_CACHE_VERSIONS.map(
    (version) => `unified-live-${version}-${apiKeySuffix}-${mode}-${companyKey}`,
  );
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
  selectedCompany: CompanyId,
) {
  const [liveSignals, setLiveSignals] = useState<UnifiedSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
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
    let cancelled = false;
    // Prevent cross-contamination flashes when switching company/mode:
    // clear previous bundle immediately before loading the next cache/fetch cycle.
    setLiveSignals([]);
    setIsLive(false);
    setLoading(true);
    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    const apiConfigured = isNewsApiAiConfigured();
    const companyKey = selectedCompany;
    const selectedCompanyData = selectedCompany
      ? COMPANIES.find((c) => c.id === selectedCompany)
      : null;
    const companyKeywords = selectedCompanyData
      ? selectedCompanyData.keywords.map((k) => k.toLowerCase())
      : [];
    const companyNameLower = selectedCompanyData?.name.toLowerCase() || "";
    const companySectorBits = selectedCompanyData
      ? selectedCompanyData.sector
          .toLowerCase()
          .split(/[^a-z0-9+]+/)
          .filter((w) => w.length > 2 && w !== "and")
      : [];
    const companyRelevanceScore = (s: UnifiedSignal): number => {
      if (!selectedCompanyData) return 0;
      const text = `${s.title || ""} ${s.description || ""}`.toLowerCase();
      let score = 0;
      if (companyNameLower && text.includes(companyNameLower)) score += 10;
      if (selectedCompanyData.industryNewsTerms.length > 0) {
        for (const t of companyIndustryAnchorsLower(selectedCompanyData)) {
          if (t.length >= 4 && text.includes(t)) score += 5;
        }
        for (const bit of companySectorBitsStrict(selectedCompanyData)) {
          if (text.includes(bit)) score += 3;
        }
        for (const kw of companyKeywords) {
          if (kw.length >= 10 && text.includes(kw)) score += 2;
        }
        return score;
      }
      for (const kw of companyKeywords) {
        if (kw.length > 2 && text.includes(kw)) score += 3;
      }
      for (const bit of companySectorBits) {
        if (text.includes(bit)) score += 2;
      }
      return score;
    };
    const isCompanyRelevantSignal = (s: UnifiedSignal): boolean => {
      if (s.layer !== "live-news") return true;
      if (!selectedCompanyData) return true;
      const title = s.title || "";
      const description = s.description || "";
      const text = `${title} ${description}`.toLowerCase();
      if (mode === "genz") {
        const industryRelevant =
          selectedCompanyData.industryNewsTerms.length > 0
            ? liveNewsTextMatchesCompanyIndustry(title, description, selectedCompanyData) ||
              companyKeywords.some((kw) => kw.length > 2 && text.includes(kw))
            : (companyNameLower && text.includes(companyNameLower)) ||
              companyKeywords.some((kw) => kw.length > 2 && text.includes(kw)) ||
              companySectorBits.some((w) => text.includes(w));
        return looksLikeGenZNews(s) && (industryRelevant || companyRelevanceScore(s) >= 1);
      }
      if (selectedCompanyData.industryNewsTerms.length > 0) {
        return liveNewsTextMatchesCompanyIndustry(title, description, selectedCompanyData);
      }
      return (
        (companyNameLower && text.includes(companyNameLower)) ||
        companyKeywords.some((kw) => kw.length > 2 && text.includes(kw)) ||
        companySectorBits.some((w) => text.includes(w))
      );
    };
    type FinalizeOpts = { trustPreCuratedBundle?: boolean };

    const finalizeSignals = (arr: UnifiedSignal[], opts?: FinalizeOpts): UnifiedSignal[] => {
      const deduped = dedupeSignalsByArticleUrl(Array.isArray(arr) ? arr : []);
      deduped.sort((a, b) => {
        if (b.resilienceScore !== a.resilienceScore) return b.resilienceScore - a.resilienceScore;
        return a.id.localeCompare(b.id);
      });
      if (opts?.trustPreCuratedBundle) {
        const floor = Math.min(MIN_COMPANY_SIGNALS, Math.max(1, deduped.length));
        return stratifiedSourceCapPack(deduped, MAX_COMPANY_SIGNALS, MAX_SIGNALS_PER_SOURCE, floor);
      }
      const companyFiltered = deduped.filter(isCompanyRelevantSignal);
      let selected = companyFiltered.length > 0 ? companyFiltered : deduped;
      // Adaptive widening for low-coverage companies:
      // keep company-priority, but avoid stalling at tiny bundles.
      if (selected.length < MIN_COMPANY_SIGNALS) {
        if (mode === "genz") {
          const youthPool = deduped.filter((s) => looksLikeGenZNews(s));
          if (youthPool.length > selected.length) selected = youthPool;
        } else {
          const sectorPool = deduped.filter((s) => {
            if (s.layer !== "live-news") return true;
            const st = s.title || "";
            const sd = s.description || "";
            if (selectedCompanyData.industryNewsTerms.length > 0) {
              return (
                liveNewsTextMatchesCompanyIndustry(st, sd, selectedCompanyData) ||
                companyRelevanceScore(s) >= 6
              );
            }
            const text = `${st} ${sd}`.toLowerCase();
            const sectorHit = companySectorBits.some((w) => text.includes(w));
            return sectorHit || companyRelevanceScore(s) >= 1;
          });
          if (sectorPool.length > selected.length) selected = sectorPool;
        }
      }
      // For Gen Z, if strict company filtering under-fills, widen to youth-relevant pool
      // and let company relevance ordering decide priority.
      if (mode === "genz" && selected.length < MIN_COMPANY_SIGNALS) {
        const youthPool = deduped.filter((s) => looksLikeGenZNews(s));
        if (youthPool.length > selected.length) selected = youthPool;
      }
      // Keep each map per-company dense (250-500) while still preferring company/industry relevance.
      if (selected.length < MIN_COMPANY_SIGNALS && deduped.length > selected.length) {
        const minExtraRelevance =
          mode === "genz"
            ? 0
            : selected.length < 120
              ? 0
              : selected.length < 220
                ? 1
                : 2;
        const seen = new Set(selected.map((s) => s.id));
        const extras = deduped
          .filter((s) => !seen.has(s.id))
          .sort((a, b) => {
            const diff = companyRelevanceScore(b) - companyRelevanceScore(a);
            if (diff !== 0) return diff;
            if (b.resilienceScore !== a.resilienceScore) return b.resilienceScore - a.resilienceScore;
            return a.id.localeCompare(b.id);
          });
        for (const extra of extras) {
          if (selected.length >= MIN_COMPANY_SIGNALS) break;
          if (mode !== "genz" && companyRelevanceScore(extra) < minExtraRelevance) continue;
          if (
            mode !== "genz" &&
            selectedCompanyData?.industryNewsTerms.length &&
            !liveNewsTextMatchesCompanyIndustry(extra.title || "", extra.description || "", selectedCompanyData) &&
            companyRelevanceScore(extra) < 8
          ) {
            continue;
          }
          if (mode === "genz" && !looksLikeGenZNews(extra)) continue;
          selected.push(extra);
        }
      }
      const packed = stratifiedSourceCapPack(
        selected,
        MAX_COMPANY_SIGNALS,
        MAX_SIGNALS_PER_SOURCE,
        MIN_COMPANY_SIGNALS,
      );
      const countryCount = (list: UnifiedSignal[]) =>
        new Set(list.map((s) => (s.location || "").trim().toLowerCase()).filter(Boolean)).size;
      if (countryCount(packed) >= MIN_DISPLAY_COUNTRIES || packed.length === 0) return packed;

      const taken = new Set(packed.map((s) => s.id));
      const extras = deduped
        .filter((s) => !taken.has(s.id))
        .filter((s) => s.layer === "live-news" && !!(s.location || "").trim())
        .sort((a, b) => {
          const diff = companyRelevanceScore(b) - companyRelevanceScore(a);
          if (diff !== 0) return diff;
          if (b.resilienceScore !== a.resilienceScore) return b.resilienceScore - a.resilienceScore;
          return a.id.localeCompare(b.id);
        });

      const out = [...packed];
      for (const s of extras) {
        if (out.length >= MAX_COMPANY_SIGNALS) break;
        if (countryCount(out) >= MIN_DISPLAY_COUNTRIES) break;
        const loc = (s.location || "").trim().toLowerCase();
        if (!loc) continue;
        if (out.some((x) => (x.location || "").trim().toLowerCase() === loc)) continue;
        if (
          mode !== "genz" &&
          selectedCompanyData?.industryNewsTerms.length &&
          !liveNewsTextMatchesCompanyIndustry(s.title || "", s.description || "", selectedCompanyData)
        ) {
          continue;
        }
        out.push(s);
        taken.add(s.id);
      }
      return out;
    };
    const apiKeySuffix = apiConfigured ? newsApiKeyFingerprint() : "seed";
    /** Legacy local keys (version + API fingerprint); still read for migration, no longer primary writes. */
    const versionedLiveKey = `unified-live-${apiConfigured ? LIVE_CACHE_VERSION : "seed"}-${apiKeySuffix}-${mode}-${companyKey}`;
    /** Same string as Supabase cache_key: one slot per company/mode/UTC day (upsert updates in place). */
    const signalBundleCacheKey = `signals:bundle:${mode}:${companyKey}:${dayBucketKey()}`;
    const durableKey = durablePersistentKey(mode, companyKey);
    const legacyCacheKeys = getLegacyCacheKeys(apiKeySuffix, mode, companyKey);
    const LEGACY_DURABLE_SHARED = "unified-live-durable-shared";
    const bundleStats = (signals: UnifiedSignal[]) => {
      const countries = new Set(signals.map((s) => (s.location || "").trim().toLowerCase()).filter(Boolean));
      const sources = new Set(signals.map((s) => (s.source || "").trim().toLowerCase()).filter(Boolean));
      return { coverageCountryCount: countries.size, sourceDiversityCount: sources.size };
    };
    const writeSignalBundle = (signals: UnifiedSignal[], isFinal: boolean) => {
      const slim = slimUnifiedSignalsForCache(signals);
      const stats = bundleStats(slim);
      void writeSignalBundleCache({
        cacheKey: signalBundleCacheKey,
        companyId: companyKey,
        mode,
        payload: slim,
        signalCount: slim.length,
        isFinal,
        coverageCountryCount: stats.coverageCountryCount,
        sourceDiversityCount: stats.sourceDiversityCount,
        modelVersion: LIVE_CACHE_VERSION,
        ttlHours: 24,
      });
    };
    /** In API mode we still warm the UI from local cache, but continue fetch to refresh shared source-of-truth. */
    const canShortCircuitFromLocalCache = !apiConfigured;

    type SharedBundleRow = NonNullable<Awaited<ReturnType<typeof readSignalBundleCache<UnifiedSignal[]>>>>;

    const readSharedBundleFromSupabase = async (): Promise<SharedBundleRow | null> => {
      const todayKey = dayBucketKey();
      const cacheKeysTried = Array.from(
        new Set([
          signalBundleCacheKey,
          `signals:bundle:${mode}:${companyKey}`,
          `signals:bundle:${mode}:${companyKey}:${prevUtcDayBucketKey()}`,
        ]),
      );
      if (typeof window !== "undefined") {
        (window as unknown as { __rrSignalBundleKeysTried?: string[] }).__rrSignalBundleKeysTried = cacheKeysTried;
        (window as unknown as { __rrSignalBundlePrimaryKey?: string }).__rrSignalBundlePrimaryKey =
          signalBundleCacheKey;
      }
      for (const cacheKey of cacheKeysTried) {
        const row = await readSignalBundleCache<UnifiedSignal[]>({
          cacheKey,
          minSignals: 0,
          minCoverageCountries: 0,
        });
        const n = coerceUnifiedBundlePayload(row?.data).length;
        if (row && n > 0) {
          if (import.meta.env.DEV && cacheKey !== signalBundleCacheKey) {
            console.debug("[rr] Supabase bundle matched alternate cache_key:", cacheKey, "today was", todayKey);
          }
          return row;
        }
      }
      return null;
    };

    /** Writes local caches always; paints the map only when `paintUi` (full final bundle or explicit). */
    const applySharedBundleToCaches = (entry: SharedBundleRow, opts?: { paintUi?: boolean }): boolean => {
      const filtered = finalizeSignals(coerceUnifiedBundlePayload(entry.data), {
        trustPreCuratedBundle: true,
      });
      if (!filtered.length) return false;
      cache.set(signalBundleCacheKey, { signals: filtered, timestamp: entry.savedAt });
      writeSessionCache(signalBundleCacheKey, slimUnifiedSignalsForCache(filtered));
      writePersistentCache(signalBundleCacheKey, slimUnifiedSignalsForCache(filtered));
      const paintUi = opts?.paintUi !== false;
      if (paintUi && !cancelled) {
        setLiveSignals(filtered);
        setIsLive(true);
        setLoading(false);
      }
      return true;
    };

    let memoryHit = cache.get(signalBundleCacheKey);
    if (!memoryHit || Date.now() - memoryHit.timestamp >= CACHE_DURATION) {
      const legacyMem = cache.get(versionedLiveKey);
      if (legacyMem && Date.now() - legacyMem.timestamp < CACHE_DURATION) {
        memoryHit = legacyMem;
        cache.set(signalBundleCacheKey, legacyMem);
      }
    }
    if (memoryHit && Date.now() - memoryHit.timestamp < CACHE_DURATION) {
      const filtered = finalizeSignals(memoryHit.signals);
      if (!cancelled) {
        setLiveSignals(filtered);
        setIsLive(true);
        setLoading(false);
      }
      if (canShortCircuitFromLocalCache) return;
    }

    const fetchAll = async (
      preloadedShared: SharedBundleRow | null | undefined,
      skipInitialSharedDiskWrite: boolean,
    ) => {
      const sharedSupabaseEntry =
        preloadedShared === undefined
          ? isSupabaseSignalBundleCacheConfigured()
            ? await readSharedBundleFromSupabase()
            : null
          : preloadedShared;
      let sharedWarmStart: UnifiedSignal[] = [];
      if (sharedSupabaseEntry && coerceUnifiedBundlePayload(sharedSupabaseEntry.data).length) {
        const filtered = finalizeSignals(coerceUnifiedBundlePayload(sharedSupabaseEntry.data), {
          trustPreCuratedBundle: true,
        });
        if (filtered.length) {
          sharedWarmStart = filtered;
          if (!skipInitialSharedDiskWrite) {
            cache.set(signalBundleCacheKey, { signals: filtered, timestamp: sharedSupabaseEntry.savedAt });
            writeSessionCache(signalBundleCacheKey, slimUnifiedSignalsForCache(filtered));
            writePersistentCache(signalBundleCacheKey, slimUnifiedSignalsForCache(filtered));
            if (!cancelled) {
              setLiveSignals(filtered);
              setIsLive(true);
              setLoading(false);
            }
          }
        }
        // Skip refetch when the hydrated bundle is already dense (DB signal_count can disagree with payload).
        if (filtered.length >= MIN_COMPANY_SIGNALS) {
          return;
        }
      }

      const results: UnifiedSignal[] = [...sharedWarmStart];
      let gotLive = false;
      let countryBuiltCount = 0;
      let providerLimited = false;
      const businessTopicQueryStrict = selectedCompanyData
        ? buildResilienceMapBusinessTopicQuery(selectedCompanyData)
        : "business finance economy innovation supply chain regulation";
      const businessTopicQueryFallback = selectedCompanyData
        ? buildResilienceMapBusinessTopicQueryRelaxed(selectedCompanyData)
        : "";
      const genzTopicAugment = selectedCompanyData ? buildCompanyGenZContextHint(selectedCompanyData) : "";
      const genzTopicQueryFallback = genzTopicAugment;

      const appendLiveArticles = (
        articles: any[],
        country: { code: string; name: string; coords: [number, number] },
        idStem: string,
      ) => {
        if (!articles?.length) return;
        gotLive = true;
        countryBuiltCount += articles.length;
        results.push(
          ...articles.flatMap((a: any, i: number) => {
            const strictGenZMode = mode === "genz";
            if (strictGenZMode) {
              if (!looksLikeStrictGenZArticle(a)) return [];
              const industryRelevant = isArticleRelevantToCompanyIndustry(a, selectedCompanyData);
              // Early in the run we allow youth-relevant but weakly branded items so
              // smaller company profiles can still fill density targets.
              if (!industryRelevant && results.length >= 140) return [];
            }
            if (mode === "resilience" && selectedCompanyData?.industryNewsTerms.length) {
              const at = String(a?.title || "");
              const ad = String(a?.description || "");
              if (!liveNewsTextMatchesCompanyIndustry(at, ad, selectedCompanyData)) return [];
            }
            const dom = resolveArticleDomain(selectedCompanyData, a);
            // Avoid starving Gen Z map when inference is uncertain:
            // use company/default fallback category instead of dropping.
            const cat = resolveArticleCategory(selectedCompanyData, a, { strict: false });
            const articleKey = String(a?.url || a?.title || `${idStem}-${i}`);
            const score = calculateResilienceScore({
              title: a.title || "", description: a.description || "",
              source: a.source, date: a.date, companyId: selectedCompany,
              domain: mode === "resilience" ? dom : undefined,
              category: mode === "genz" ? cat : undefined,
            });
            return {
              id: `${idStem}-${companyKey}-${country.code}-${a.url || i}`,
              title: a.title || "Untitled",
              description: a.description || "",
              location: country.name,
              coordinates: spreadSignalCoordinatesInCountry(country, articleKey, i),
              layer: "live-news" as const,
              domain: dom,
              category: cat,
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
      };

      // One country at a time (sequential) to respect provider rate limits; UI updates once after the full pass.
      const fetchCountryPlan = getFetchCountries({ mode, companyKey });
      for (let idx = 0; idx < fetchCountryPlan.length; idx++) {
        if (cancelled) break;
        const country = fetchCountryPlan[idx];

        if (mode === "genz") {
          let gzResult = await fetchGenZArticleBuckets(country, GENZ_ARTICLES_PER_PAGE, GENZ_PAGES, selectedCompanyData)
            .catch(() => ({ articles: [] as any[], providerLimited: false }));
          if (gzResult.providerLimited) {
            providerLimited = true;
            continue;
          }
          if (!gzResult.providerLimited && gzResult.articles.length < 30) {
            const relaxedGz = await fetchPagedArticles("genz", country, GENZ_ARTICLES_PER_PAGE, GENZ_PAGES, genzTopicQueryFallback)
              .catch(() => ({ articles: [] as any[], providerLimited: false }));
            if (!relaxedGz.providerLimited && relaxedGz.articles.length > gzResult.articles.length) gzResult = relaxedGz;
          }
          appendLiveArticles(gzResult.articles, country, "live-gz");
        } else {
          let bizResult = await fetchPagedArticles("business", country, BUSINESS_ARTICLES_PER_PAGE, BUSINESS_PAGES, businessTopicQueryStrict)
            .catch(() => ({ articles: [] as any[], providerLimited: false }));
          if (bizResult.providerLimited) {
            providerLimited = true;
            continue;
          }
          if (!bizResult.providerLimited && bizResult.articles.length < 18) {
            const relaxedBiz = await fetchPagedArticles("business", country, BUSINESS_ARTICLES_PER_PAGE, BUSINESS_PAGES, businessTopicQueryFallback)
              .catch(() => ({ articles: [] as any[], providerLimited: false }));
            if (!relaxedBiz.providerLimited && relaxedBiz.articles.length > bizResult.articles.length) bizResult = relaxedBiz;
          }

          appendLiveArticles(bizResult.articles, country, "live-biz");
        }

        if (idx % 10 === 9 && results.length > 0 && !cancelled) {
          writeSessionCache(signalBundleCacheKey, slimUnifiedSignalsForCache(finalizeSignals(results)));
        }
      }

      // Emergency recovery: if nothing came back, run a mode-matching sweep on top countries.
      if (finalizeSignals(results).length === 0) {
        const emergencyCountries = fetchCountryPlan.slice(0, 6);
        for (let ci = 0; ci < emergencyCountries.length; ci++) {
          if (cancelled) return;
          const country = emergencyCountries[ci];
          const emergencyType = mode === "genz" ? "genz" : "business";
          const emergencyQuery = mode === "genz" ? genzTopicQueryFallback : businessTopicQueryStrict;
          const emergencyRes = await fetchPagedArticles(
            emergencyType,
            country,
            50,
            2,
            emergencyQuery,
          ).catch(() => ({ articles: [] as any[], providerLimited: false }));
          if (emergencyRes.articles.length === 0) continue;
          appendLiveArticles(emergencyRes.articles, country, mode === "genz" ? "live-gz-emergency" : "live-biz-emergency");
        }
      }

      // Gen Z top-up: if still below minimum density, run broader youth passes across priority countries.
      if (mode === "genz" && finalizeSignals(results).length < MIN_COMPANY_SIGNALS) {
        const topUpCountries = fetchCountryPlan.slice(0, 20);
        const broadQueries = [
          `Gen Z youth social media students young adults creator economy ${genzTopicQueryFallback}`.trim(),
          `Gen Z culture digital behavior young consumers platform trends ${genzTopicQueryFallback}`.trim(),
        ];
        for (let ci = 0; ci < topUpCountries.length; ci++) {
          if (cancelled) break;
          const country = topUpCountries[ci];
          for (const query of broadQueries) {
            const res = await fetchPagedArticles("genz", country, 100, 2, query)
              .catch(() => ({ articles: [] as any[], providerLimited: false }));
            if (res.providerLimited) {
              providerLimited = true;
              continue;
            }
            appendLiveArticles(res.articles, country, "live-gz-topup");
            if (finalizeSignals(results).length >= MIN_COMPANY_SIGNALS) break;
          }
          if (finalizeSignals(results).length >= MIN_COMPANY_SIGNALS) break;
        }
      }

      // Global top-up (both modes): keep sweeping countries until we hit minimum density.
      if (finalizeSignals(results).length < MIN_COMPANY_SIGNALS) {
        const fillCountries = fetchCountryPlan;
        for (let i = 0; i < fillCountries.length; i++) {
          if (cancelled) break;
          if (finalizeSignals(results).length >= MIN_COMPANY_SIGNALS) break;
          const country = fillCountries[i];
          const type = mode === "genz" ? "genz" : "business";
          const query = mode === "genz"
            ? `Gen Z youth social media young adults ${genzTopicQueryFallback}`.trim()
            : `${businessTopicQueryStrict} ${businessTopicQueryFallback}`.trim();
          const fillRes = await fetchPagedArticles(type, country, 80, 1, query)
            .catch(() => ({ articles: [] as any[], providerLimited: false }));
          appendLiveArticles(fillRes.articles, country, mode === "genz" ? "live-gz-fill" : "live-biz-fill");
        }
      }

      const finalMerged = finalizeSignals(results);

      if (typeof window !== "undefined") {
        (window as any).__rrNewsDebug = {
          at: new Date().toISOString(),
          apiConfigured: isNewsApiAiConfigured(),
          fetchedCountries: fetchCountryPlan.map((c) => c.name),
          countryBuiltCount,
          rawResultsCount: results.length,
          mergedCount: finalMerged.length,
          gotLive,
          providerLimited,
        };
      }

      if (gotLive && finalMerged.length > 0 && !cancelled) {
        const now = Date.now();
        const forCache = slimUnifiedSignalsForCache(finalMerged);
        cache.set(signalBundleCacheKey, { signals: forCache, timestamp: now });
        writeSessionCache(signalBundleCacheKey, forCache);
        writePersistentCache(signalBundleCacheKey, forCache);
        writeSignalBundle(finalMerged, true);
        setLiveSignals(finalMerged);
        setIsLive(true);
      } else if (apiConfigured) {
        let restored = false;
        const persistentFallback =
          readPersistentCache<UnifiedSignal[]>(signalBundleCacheKey) ??
          readPersistentCache<UnifiedSignal[]>(versionedLiveKey);
        if (persistentFallback?.data?.length && !cancelled) {
          setLiveSignals(persistentFallback.data);
          setIsLive(true);
          restored = true;
        } else {
          const sessionFallback =
            readSessionCache<UnifiedSignal[]>(signalBundleCacheKey) ??
            readSessionCache<UnifiedSignal[]>(versionedLiveKey);
          if (sessionFallback?.data?.length && !cancelled) {
            setLiveSignals(sessionFallback.data);
            setIsLive(true);
            restored = true;
          } else {
            const snap = cache.get(signalBundleCacheKey) ?? cache.get(versionedLiveKey);
            if (snap?.signals?.length && !cancelled) {
              setLiveSignals(snap.signals);
              setIsLive(true);
              restored = true;
            }
          }
        }

        if (!restored) {
          for (const key of legacyCacheKeys) {
            const persistentLegacy = readPersistentCache<UnifiedSignal[]>(key);
            if (persistentLegacy?.data?.length && !cancelled) {
              setLiveSignals(persistentLegacy.data);
              setIsLive(true);
              restored = true;
              break;
            }
            const sessionLegacy = readSessionCache<UnifiedSignal[]>(key);
            if (sessionLegacy?.data?.length && !cancelled) {
              setLiveSignals(sessionLegacy.data);
              setIsLive(true);
              restored = true;
              break;
            }
          }
        }

        if (!restored) {
          const durableSharedFallback = readPersistentCache<UnifiedSignal[]>(durableKey);
          if (durableSharedFallback?.data?.length && !cancelled) {
            setLiveSignals(durableSharedFallback.data);
            setIsLive(true);
            restored = true;
          }
        }

        if (!restored) {
          const legacyDurable = readPersistentCache<UnifiedSignal[]>(LEGACY_DURABLE_SHARED);
          if (legacyDurable?.data?.length && !cancelled) {
            setLiveSignals(legacyDurable.data);
            setIsLive(true);
            restored = true;
          }
        }

        // Keep trying periodically in API mode if we still have no live/cached signals.
        if (!restored && !cancelled) {
          if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
          retryTimerRef.current = window.setTimeout(() => {
            void fetchAll(undefined, false);
          }, 30_000);
        }
      }
      if (!cancelled) setLoading(false);
    };

    const run = async () => {
      let primed: SharedBundleRow | null | undefined = undefined;
      if (isSupabaseSignalBundleCacheConfigured()) {
        primed = await readSharedBundleFromSupabase();
      }

      const primedLen = primed ? coerceUnifiedBundlePayload(primed.data).length : 0;
      const sharedBundleComplete =
        primedLen > 0 && Math.max(primedLen, primed?.signalCount ?? 0) >= MIN_COMPANY_SIGNALS;
      let hydratedFromShared = false;
      if (primed && primedLen > 0 && applySharedBundleToCaches(primed, { paintUi: true })) {
        hydratedFromShared = true;
        if (sharedBundleComplete) {
          if (!cancelled) setLoading(false);
          return;
        }
      }

      if (!hydratedFromShared) {
        const sessionEntryEarly =
          readSessionCache<UnifiedSignal[]>(signalBundleCacheKey) ??
          readSessionCache<UnifiedSignal[]>(versionedLiveKey);
        if (sessionEntryEarly?.data?.length) {
          const filtered = finalizeSignals(sessionEntryEarly.data);
          cache.set(signalBundleCacheKey, { signals: filtered, timestamp: sessionEntryEarly.savedAt });
          if (!cancelled) {
            setLiveSignals(filtered);
            setIsLive(true);
            setLoading(false);
          }
          if (canShortCircuitFromLocalCache) return;
        }

        const persistentEntry =
          readPersistentCache<UnifiedSignal[]>(signalBundleCacheKey) ??
          readPersistentCache<UnifiedSignal[]>(versionedLiveKey);
        if (persistentEntry?.data?.length) {
          const filtered = finalizeSignals(persistentEntry.data);
          cache.set(signalBundleCacheKey, { signals: filtered, timestamp: persistentEntry.savedAt });
          if (!cancelled) {
            setLiveSignals(filtered);
            setIsLive(true);
            setLoading(false);
          }
          if (canShortCircuitFromLocalCache) return;
        }
        const durableSharedEntry = readPersistentCache<UnifiedSignal[]>(durableKey);
        if (durableSharedEntry?.data?.length) {
          const filtered = finalizeSignals(durableSharedEntry.data);
          cache.set(signalBundleCacheKey, { signals: filtered, timestamp: durableSharedEntry.savedAt });
          if (!cancelled) {
            setLiveSignals(filtered);
            setIsLive(true);
            setLoading(false);
          }
          if (canShortCircuitFromLocalCache) return;
        }
      }

      await fetchAll(primed, hydratedFromShared);
    };

    void run();
    return () => {
      cancelled = true;
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [mode, selectedCompany]);

  /**
   * Live articles are fetched per selected company (industry + dossier keywords) and refreshed daily.
   * Re-score with {@link calculateResilienceScore} when the selection changes without a new network bundle yet.
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
