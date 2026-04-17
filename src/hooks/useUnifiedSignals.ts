import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DomainId } from "@/data/types";
import { GenZCategoryId } from "@/data/genzTypes";
import { CompanyId } from "@/data/companies";
import { SIGNALS } from "@/data/signals";
import { GENZ_SIGNALS } from "@/data/genzSignals";
import { WORLD_CITIES } from "@/data/capitals";
import { UnifiedSignal } from "@/data/unifiedSignalTypes";
import { calculateResilienceScore, scoreToUrgency } from "@/lib/resilienceScore";
import { DashboardMode } from "@/components/dashboard/DashboardLayout";

interface CacheEntry {
  signals: UnifiedSignal[];
  timestamp: number;
}

const CACHE_DURATION = 60 * 60 * 1000;
const cache = new Map<string, CacheEntry>();
const BUSINESS_ARTICLES_PER_PAGE = 15;
const BUSINESS_PAGES = 2;
const GENZ_ARTICLES_PER_PAGE = 10;
const GENZ_PAGES = 2;
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

function jitter(coords: [number, number], index: number, offset = 0): [number, number] {
  const seed = index + offset * 7;
  const angle = (seed * 137.5) * (Math.PI / 180);
  const r = 2 + (seed % 5) * 1.2;
  return [coords[0] + r * Math.cos(angle), coords[1] + r * Math.sin(angle)];
}

async function fetchPagedArticles(
  type: "business" | "genz",
  country: { code: string; name: string },
  pageSize: number,
  pages: number,
) {
  const responses = await Promise.all(
    Array.from({ length: pages }, (_, pageIndex) =>
      supabase.functions.invoke("news-feed", {
        body: {
          type,
          countryCode: country.code,
          countryName: country.name,
          pageSize,
          page: pageIndex + 1,
        },
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

  // Filter seeds by active domains/categories
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

    const cacheKey = `unified-live`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setLiveSignals(cached.signals);
      setIsLive(true);
      setLoading(false);
      return;
    }

    const fetchAll = async () => {
      const results: UnifiedSignal[] = [];
      let gotLive = false;

      // Fetch substantially larger business + Gen Z batches so the map can render well over 100 live signals.
      const promises = NEWS_COUNTRIES.flatMap((country, ci) => {
        const biz = fetchPagedArticles("business", country, BUSINESS_ARTICLES_PER_PAGE, BUSINESS_PAGES)
        .then((articles) => {
          if (articles.length > 0) {
            gotLive = true;
            return articles.map((a: any, i: number) => {
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
                articleUrl: a.url,
                articleContent: a.content,
                date: a.date,
                isJapan: country.code === "jp",
              } as UnifiedSignal;
            });
          }
          return [];
        }).catch(() => [] as UnifiedSignal[]);

        const gz = fetchPagedArticles("genz", country, GENZ_ARTICLES_PER_PAGE, GENZ_PAGES)
        .then((articles) => {
          if (articles.length > 0) {
            gotLive = true;
            return articles.map((a: any, i: number) => {
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
                articleUrl: a.url,
                articleContent: a.content,
                date: a.date,
                isJapan: country.code === "jp",
              } as UnifiedSignal;
            });
          }
          return [];
        }).catch(() => [] as UnifiedSignal[]);

        return [biz, gz];
      });

      const allResults = await Promise.all(promises);
      allResults.forEach(r => results.push(...r));

      if (gotLive && results.length > 0) {
        cache.set(cacheKey, { signals: results, timestamp: Date.now() });
        setLiveSignals(results);
        setIsLive(true);
      }
      setLoading(false);
    };

    fetchAll();
  }, []);

  // Merge seeds + live, sorted by score descending
  const allSignals = useMemo(() => {
    const merged = [...filteredSeeds, ...liveSignals];
    merged.sort((a, b) => b.resilienceScore - a.resilienceScore);
    return merged;
  }, [filteredSeeds, liveSignals]);

  return { signals: allSignals, loading, isLive, seedSignals };
}
