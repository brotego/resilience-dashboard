import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DomainId } from "@/data/types";
import { GenZCategoryId } from "@/data/genzTypes";
import { CompanyId } from "@/data/companies";
import { SIGNALS } from "@/data/signals";
import { GENZ_SIGNALS } from "@/data/genzSignals";
import { UnifiedSignal } from "@/data/unifiedSignalTypes";
import { calculateResilienceScore, scoreToUrgency } from "@/lib/resilienceScore";
import { DashboardMode } from "@/components/dashboard/DashboardLayout";

interface CacheEntry {
  signals: UnifiedSignal[];
  timestamp: number;
}

const CACHE_DURATION = 60 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

const NEWS_COUNTRIES: { code: string; name: string; coords: [number, number] }[] = [
  { code: "us", name: "United States of America", coords: [-98, 39] },
  { code: "gb", name: "United Kingdom", coords: [-0.12, 51.51] },
  { code: "jp", name: "Japan", coords: [139.69, 35.69] },
  { code: "de", name: "Germany", coords: [13.41, 52.52] },
  { code: "fr", name: "France", coords: [2.35, 48.86] },
  { code: "in", name: "India", coords: [77.21, 28.61] },
  { code: "br", name: "Brazil", coords: [-47.93, -15.78] },
  { code: "au", name: "Australia", coords: [149.13, -35.28] },
  { code: "kr", name: "South Korea", coords: [126.98, 37.57] },
  { code: "sg", name: "Singapore", coords: [103.82, 1.35] },
  { code: "ng", name: "Nigeria", coords: [3.39, 6.45] },
  { code: "ae", name: "UAE", coords: [55.27, 25.20] },
];

function jitter(coords: [number, number], index: number, offset = 0): [number, number] {
  const seed = index + offset * 7;
  const angle = (seed * 137.5) * (Math.PI / 180);
  const r = 2 + (seed % 5) * 1.2;
  return [coords[0] + r * Math.cos(angle), coords[1] + r * Math.sin(angle)];
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

      // Fetch business + genz news from key countries
      const promises = NEWS_COUNTRIES.flatMap((country, ci) => {
        const biz = supabase.functions.invoke("news-feed", {
          body: { type: "business", countryCode: country.code, countryName: country.name, pageSize: 3 },
        }).then(({ data }) => {
          if (data?.articles && !data?.fallback && data.articles.length > 0) {
            gotLive = true;
            return data.articles.map((a: any, i: number) => {
              const score = calculateResilienceScore({
                title: a.title || "", description: a.description || "",
                source: a.source, date: a.date, companyId: selectedCompany,
              });
              return {
                id: `live-biz-${country.code}-${i}`,
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

        const gz = supabase.functions.invoke("news-feed", {
          body: { type: "genz", countryCode: country.code, countryName: country.name, pageSize: 2 },
        }).then(({ data }) => {
          if (data?.articles && !data?.fallback && data.articles.length > 0) {
            gotLive = true;
            return data.articles.map((a: any, i: number) => {
              const score = calculateResilienceScore({
                title: a.title || "", description: a.description || "",
                source: a.source, date: a.date, companyId: selectedCompany,
              });
              return {
                id: `live-gz-${country.code}-${i}`,
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
