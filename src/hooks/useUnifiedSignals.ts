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
const LIVE_CACHE_VERSION = "api-v12-stratified-geo-sources";
const LEGACY_LIVE_CACHE_VERSIONS: string[] = ["api-v10-country-high-volume", "api-v11-company-scoped-24h"];
const BUSINESS_ARTICLES_PER_PAGE = 100;
const BUSINESS_PAGES = 2;
const GENZ_ARTICLES_PER_PAGE = 50;
const GENZ_PAGES = 2;
const MAX_COMPANY_SIGNALS = 500;
/** Avoid one wire dominating the map / click stack (per normalized outlet name). */
const MAX_SIGNALS_PER_SOURCE = 10;
const MAX_ER_TOPIC_CHARS = 480;
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

/** Event Registry keyword string: selected company industry + dossier context (not other companies). */
function buildCompanyIndustryTopicQuery(company: Company): string {
  const intel = company.intel;
  const parts = [
    `"${company.name.replace(/"/g, " ").trim()}"`,
    company.sector,
    company.description,
    ...company.keywords.slice(0, 14),
    ...(intel.brandsAndAssets?.slice(0, 6) ?? []),
    ...intel.coreBusinessLines.slice(0, 2),
    ...intel.strategicPriorities.slice(0, 2),
    ...(intel.riskAndWatchThemes?.slice(0, 2) ?? []),
  ];
  let q = parts.join(" ").replace(/\s+/g, " ").trim();
  if (q.length > MAX_ER_TOPIC_CHARS) q = q.slice(0, MAX_ER_TOPIC_CHARS);
  return q;
}

function buildCompanyTopicQueryRelaxed(company: Company): string {
  const q = [
    `"${company.name.replace(/"/g, " ").trim()}"`,
    company.sector,
    ...company.keywords.slice(0, 8),
  ].join(" ");
  return q.slice(0, MAX_ER_TOPIC_CHARS);
}

function buildCompanyGenZContextHint(company: Company): string {
  const intel = company.intel;
  const q = [
    `"${company.name.replace(/"/g, " ").trim()}"`,
    company.sector,
    ...company.keywords.slice(0, 8),
    intel.reputationAndGenZ ? intel.reputationAndGenZ.slice(0, 140) : "",
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

function getFetchCountries(): typeof NEWS_COUNTRIES {
  const ordered = stableCountryOrder(NEWS_COUNTRIES);
  const dayBucket = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
  const offset = ordered.length > 0 ? dayBucket % ordered.length : 0;
  const rotated = ordered.slice(offset).concat(ordered.slice(0, offset));
  const byName = new Map(rotated.map((c) => [c.name, c] as const));
  const head: typeof NEWS_COUNTRIES = [];
  for (const name of FETCH_ORDER_HEAD) {
    const row = byName.get(name);
    if (row) head.push(row);
  }
  const headNames = new Set(head.map((c) => c.name));
  const tail = rotated.filter((c) => !headNames.has(c.name));
  return [...head, ...tail];
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
  anchor: { coords: [number, number] },
  articleKey: string,
  index: number,
  spreadScale = 1.75,
): [number, number] {
  const u = hashToUnit(`${articleKey}::cu`);
  const v = hashToUnit(`${articleKey}::cv`);
  const angle = 2 * Math.PI * u;
  const rLat = (0.55 + 2.4 * Math.sqrt(v)) * spreadScale;
  const lat = anchor.coords[1] + rLat * Math.sin(angle);
  const cosLat = Math.max(0.3, Math.cos((Math.abs(anchor.coords[1]) * Math.PI) / 180));
  const rLon = rLat / cosLat;
  const lon = anchor.coords[0] + rLon * Math.cos(angle);
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
  return score >= 2;
}

function isArticleRelevantToCompanyIndustry(a: any, company: Company | null): boolean {
  if (!company) return true;
  const text = articleText(a);
  const companyNameLower = company.name.toLowerCase();
  if (companyNameLower && text.includes(companyNameLower)) return true;
  if (company.keywords.some((kw) => kw.length > 2 && text.includes(kw.toLowerCase()))) return true;
  const sectorBits = company.sector
    .toLowerCase()
    .split(/[^a-z0-9+]+/)
    .filter((w) => w.length > 2 && w !== "and");
  return sectorBits.some((w) => text.includes(w));
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
function stratifiedSourceCapPack(signals: UnifiedSignal[], maxTotal: number, maxPerSource: number): UnifiedSignal[] {
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
    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    const apiConfigured = isNewsApiAiConfigured();
    const companyKey = selectedCompany ?? "none";
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
    const isCompanyRelevantSignal = (s: UnifiedSignal): boolean => {
      if (s.layer !== "live-news") return true;
      if (!selectedCompanyData) return true;
      const text = `${s.title || ""} ${s.description || ""}`.toLowerCase();
      const industryRelevant =
        (companyNameLower && text.includes(companyNameLower)) ||
        companyKeywords.some((kw) => kw.length > 2 && text.includes(kw)) ||
        companySectorBits.some((w) => text.includes(w));
      if (mode === "genz") {
        if (!industryRelevant) return false;
        return !!s.category || looksLikeGenZNews(s);
      }
      if (industryRelevant) return true;
      return s.resilienceScore >= 26;
    };
    const finalizeSignals = (arr: UnifiedSignal[]): UnifiedSignal[] => {
      const deduped = dedupeSignalsByArticleUrl(arr);
      deduped.sort((a, b) => {
        if (b.resilienceScore !== a.resilienceScore) return b.resilienceScore - a.resilienceScore;
        return a.id.localeCompare(b.id);
      });
      const companyFiltered = deduped.filter(isCompanyRelevantSignal);
      const selected = companyFiltered.length > 0 ? companyFiltered : deduped;
      return stratifiedSourceCapPack(selected, MAX_COMPANY_SIGNALS, MAX_SIGNALS_PER_SOURCE);
    };
    const apiKeySuffix = apiConfigured ? newsApiKeyFingerprint() : "seed";
    const cacheKey = `unified-live-${apiConfigured ? LIVE_CACHE_VERSION : "seed"}-${apiKeySuffix}-${mode}-${companyKey}`;
    const sharedApiCacheKey = `unified-live-${LIVE_CACHE_VERSION}-shared-${mode}-${companyKey}`;
    const durableKey = durablePersistentKey(mode, companyKey);
    const legacyCacheKeys = getLegacyCacheKeys(apiKeySuffix);
    const legacySharedKeys = LEGACY_LIVE_CACHE_VERSIONS.map((version) => `unified-live-${version}-shared`);
    const LEGACY_DURABLE_SHARED = "unified-live-durable-shared";

    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      const filtered = finalizeSignals(cached.signals);
      if (!cancelled) {
        setLiveSignals(filtered);
        setIsLive(true);
        setLoading(false);
      }
      return;
    }

    const sessionEntryEarly = readSessionCache<UnifiedSignal[]>(cacheKey);
    if (sessionEntryEarly?.data?.length) {
      const filtered = finalizeSignals(sessionEntryEarly.data);
      cache.set(cacheKey, { signals: filtered, timestamp: sessionEntryEarly.savedAt });
      if (!cancelled) {
        setLiveSignals(filtered);
        setIsLive(true);
        setLoading(false);
      }
      return;
    }

    const persistentEntry = readPersistentCache<UnifiedSignal[]>(cacheKey);
    if (persistentEntry?.data?.length) {
      const filtered = finalizeSignals(persistentEntry.data);
      cache.set(cacheKey, { signals: filtered, timestamp: persistentEntry.savedAt });
      if (!cancelled) {
        setLiveSignals(filtered);
        setIsLive(true);
        setLoading(false);
      }
      return;
    }
    const sharedPersistentEntry = readPersistentCache<UnifiedSignal[]>(sharedApiCacheKey);
    if (sharedPersistentEntry?.data?.length) {
      const filtered = finalizeSignals(sharedPersistentEntry.data);
      cache.set(cacheKey, { signals: filtered, timestamp: sharedPersistentEntry.savedAt });
      if (!cancelled) {
        setLiveSignals(filtered);
        setIsLive(true);
        setLoading(false);
      }
      return;
    }
    const durableSharedEntry = readPersistentCache<UnifiedSignal[]>(durableKey);
    if (durableSharedEntry?.data?.length) {
      const filtered = finalizeSignals(durableSharedEntry.data);
      cache.set(cacheKey, { signals: filtered, timestamp: durableSharedEntry.savedAt });
      if (!cancelled) {
        setLiveSignals(filtered);
        setIsLive(true);
        setLoading(false);
      }
      return;
    }

    setLoading(true);

    const fetchAll = async () => {
      const results: UnifiedSignal[] = [];
      let gotLive = false;
      let countryBuiltCount = 0;
      let providerLimited = false;
      const businessTopicQueryStrict = selectedCompanyData
        ? buildCompanyIndustryTopicQuery(selectedCompanyData)
        : "business finance economy innovation supply chain regulation";
      const businessTopicQueryFallback = selectedCompanyData
        ? buildCompanyTopicQueryRelaxed(selectedCompanyData)
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
              if (!isArticleRelevantToCompanyIndustry(a, selectedCompanyData)) return [];
            }
            const dom = resolveArticleDomain(selectedCompanyData, a);
            const cat = resolveArticleCategory(selectedCompanyData, a, { strict: strictGenZMode });
            if (strictGenZMode && !cat) return [];
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

      /** Push current `results` to React so dots appear country-by-country (not after the full globe pass). */
      const flushPartialToUi = async () => {
        if (cancelled) return;
        setLoading(false);
        if (results.length > 0) {
          const partial = finalizeSignals(results);
          setLiveSignals(partial);
          setIsLive(true);
        }
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });
      };

      // One country at a time: each completion updates the map (removed duplicate global bootstrap that blocked UI for minutes).
      const fetchCountries = getFetchCountries();
      for (let idx = 0; idx < fetchCountries.length; idx++) {
        if (cancelled || providerLimited) break;
        const country = fetchCountries[idx];

        if (mode === "genz") {
          let gzResult = await fetchGenZArticleBuckets(country, GENZ_ARTICLES_PER_PAGE, GENZ_PAGES, selectedCompanyData)
            .catch(() => ({ articles: [] as any[], providerLimited: false }));
          if (gzResult.providerLimited) {
            providerLimited = true;
            break;
          }
          if (!gzResult.providerLimited && gzResult.articles.length < 18) {
            const relaxedGz = await fetchPagedArticles("genz", country, GENZ_ARTICLES_PER_PAGE, GENZ_PAGES, genzTopicQueryFallback)
              .catch(() => ({ articles: [] as any[], providerLimited: false }));
            if (!relaxedGz.providerLimited && relaxedGz.articles.length > gzResult.articles.length) gzResult = relaxedGz;
          }
          appendLiveArticles(gzResult.articles, country, "live-gz");
          await flushPartialToUi();
        } else {
          let bizResult = await fetchPagedArticles("business", country, BUSINESS_ARTICLES_PER_PAGE, BUSINESS_PAGES, businessTopicQueryStrict)
            .catch(() => ({ articles: [] as any[], providerLimited: false }));
          if (bizResult.providerLimited) {
            providerLimited = true;
            break;
          }
          if (!bizResult.providerLimited && bizResult.articles.length < 18) {
            const relaxedBiz = await fetchPagedArticles("business", country, BUSINESS_ARTICLES_PER_PAGE, BUSINESS_PAGES, businessTopicQueryFallback)
              .catch(() => ({ articles: [] as any[], providerLimited: false }));
            if (!relaxedBiz.providerLimited && relaxedBiz.articles.length > bizResult.articles.length) bizResult = relaxedBiz;
          }

          appendLiveArticles(bizResult.articles, country, "live-biz");
          await flushPartialToUi();
        }

        if (idx % 10 === 9 && results.length > 0 && !cancelled) {
          writeSessionCache(cacheKey, slimUnifiedSignalsForCache(finalizeSignals(results)));
        }
      }

      // Emergency recovery: if nothing came back, run a mode-matching sweep on top countries.
      if (finalizeSignals(results).length === 0) {
        const emergencyCountries = getFetchCountries().slice(0, 6);
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
          await flushPartialToUi();
        }
      }

      const finalMerged = finalizeSignals(results);

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

      if (gotLive && finalMerged.length > 0 && !cancelled) {
        const now = Date.now();
        const forCache = slimUnifiedSignalsForCache(finalMerged);
        cache.set(cacheKey, { signals: forCache, timestamp: now });
        writeSessionCache(cacheKey, forCache);
        writePersistentCache(cacheKey, forCache);
        writePersistentCache(durableKey, forCache);
        setLiveSignals(finalMerged);
        setIsLive(true);
      } else if (apiConfigured) {
        let restored = false;
        const persistentFallback = readPersistentCache<UnifiedSignal[]>(cacheKey);
        if (persistentFallback?.data?.length && !cancelled) {
          setLiveSignals(persistentFallback.data);
          setIsLive(true);
          restored = true;
        } else {
          const sharedPersistentFallback = readPersistentCache<UnifiedSignal[]>(sharedApiCacheKey);
          if (sharedPersistentFallback?.data?.length && !cancelled) {
            setLiveSignals(sharedPersistentFallback.data);
            setIsLive(true);
            restored = true;
          } else {
            const sessionFallback = readSessionCache<UnifiedSignal[]>(cacheKey);
            if (sessionFallback?.data?.length && !cancelled) {
              setLiveSignals(sessionFallback.data);
              setIsLive(true);
              restored = true;
            } else {
              const snap = cache.get(cacheKey);
              if (snap?.signals?.length && !cancelled) {
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
          for (const key of legacySharedKeys) {
            const sharedLegacy = readPersistentCache<UnifiedSignal[]>(key);
            if (sharedLegacy?.data?.length && !cancelled) {
              setLiveSignals(sharedLegacy.data);
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
            void fetchAll();
          }, 30_000);
        }
      }
      if (!cancelled) setLoading(false);
    };

    void fetchAll();
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
