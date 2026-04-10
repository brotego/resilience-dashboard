import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DomainId, ResilienceSignal } from "@/data/types";
import { SIGNALS } from "@/data/signals";

interface CacheEntry {
  signals: ResilienceSignal[];
  timestamp: number;
}

const CACHE_DURATION = 60 * 60 * 1000; // 1 hour
const cache = new Map<string, CacheEntry>();

// Countries to fetch domain news from, with coordinates for placing dots
const NEWS_COUNTRIES: { code: string; name: string; coords: [number, number] }[] = [
  { code: "us", name: "United States", coords: [-98, 39] },
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

const COUNTRY_FULL_NAMES: Record<string, string> = {
  "United States": "United States of America",
  "United Kingdom": "United Kingdom",
  "Japan": "Japan",
  "Germany": "Germany",
  "France": "France",
  "India": "India",
  "Brazil": "Brazil",
  "Australia": "Australia",
  "South Korea": "South Korea",
  "Singapore": "Singapore",
  "Nigeria": "Nigeria",
  "UAE": "United Arab Emirates",
};

function jitter(coords: [number, number], index: number): [number, number] {
  const angle = (index * 137.5) * (Math.PI / 180);
  const r = 2 + (index % 3) * 1.2;
  return [coords[0] + r * Math.cos(angle), coords[1] + r * Math.sin(angle)];
}

/**
 * Fetches live news from NewsAPI for each active domain across multiple countries.
 * Returns ResilienceSignal[] that can be rendered as map dots.
 * Falls back to hardcoded SIGNALS if API is unavailable.
 */
export function useLiveSignals(activeDomains: DomainId[]) {
  const [signals, setSignals] = useState<ResilienceSignal[]>(
    SIGNALS.filter((s) => activeDomains.includes(s.domain))
  );
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const prevDomainsRef = useRef<string>("");

  useEffect(() => {
    const domainKey = activeDomains.sort().join(",");
    if (!domainKey) {
      setSignals([]);
      setLoading(false);
      return;
    }

    // Check cache
    const cached = cache.get(domainKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setSignals(cached.signals);
      setIsLive(true);
      setLoading(false);
      return;
    }

    // If domains haven't changed and we already have live data, skip
    if (domainKey === prevDomainsRef.current && isLive) return;
    prevDomainsRef.current = domainKey;

    // Show hardcoded signals immediately while loading
    setSignals(SIGNALS.filter((s) => activeDomains.includes(s.domain)));
    setLoading(true);

    const fetchDomainNews = async () => {
      const allSignals: ResilienceSignal[] = [];
      let gotLiveData = false;

      // For each domain, fetch from 3-4 countries to spread dots globally
      const promises = activeDomains.flatMap((domain) => {
        // Pick a subset of countries per domain to avoid too many API calls
        const countries = NEWS_COUNTRIES.slice(0, 6);
        return countries.map(async (country) => {
          try {
            const { data } = await supabase.functions.invoke("news-feed", {
              body: { type: "domain", domain, countryName: country.name, pageSize: 3 },
            });

            if (data?.articles && !data?.fallback && data.articles.length > 0) {
              gotLiveData = true;
              return data.articles.map((article: any, i: number) => {
                const signal: ResilienceSignal = {
                  id: `live-${domain}-${country.code}-${i}`,
                  domain,
                  title: article.title || "Untitled",
                  description: article.description || "",
                  location: `${country.name}`,
                  coordinates: jitter(country.coords, i + activeDomains.indexOf(domain) * 3),
                  intensity: 6 + Math.floor(Math.random() * 4),
                  isJapan: country.code === "jp",
                  mindsetRelevance: {
                    cracks: `This development reveals emerging opportunities in ${domain} within ${country.name}.`,
                    reinvention: `Signals fundamental shifts in how ${domain} is approached in ${country.name}.`,
                    redefining: `Challenges conventional norms around ${domain} in the ${country.name} context.`,
                    collective: `Points to collective action and shared growth patterns in ${domain}.`,
                  },
                  source: article.source,
                };
                return signal;
              });
            }
          } catch { /* fallback */ }
          return [];
        });
      });

      const results = await Promise.all(promises);
      results.forEach((r) => allSignals.push(...r));

      if (gotLiveData && allSignals.length > 0) {
        cache.set(domainKey, { signals: allSignals, timestamp: Date.now() });
        setSignals(allSignals);
        setIsLive(true);
      } else {
        // Keep hardcoded fallback
        setSignals(SIGNALS.filter((s) => activeDomains.includes(s.domain)));
        setIsLive(false);
      }
      setLoading(false);
    };

    fetchDomainNews();
  }, [activeDomains]);

  return { signals, loading, isLive };
}
