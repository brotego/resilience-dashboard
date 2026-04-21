import { useState, useEffect, useRef } from "react";
import { invokeNewsFeed } from "@/api/newsFeed";
import { isNewsApiAiConfigured } from "@/lib/newsApiConfigured";
import { readSessionCache, writeSessionCache } from "@/lib/newsSessionCache";
import { DomainId, ResilienceSignal } from "@/data/types";
import { SIGNALS } from "@/data/signals";

interface CacheEntry {
  signals: ResilienceSignal[];
  timestamp: number;
}

const CACHE_DURATION = 60 * 60 * 1000; // 1 hour
const cache = new Map<string, CacheEntry>();

// Countries to fetch live domain news from, with map coordinates.
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
  { code: "ae", name: "United Arab Emirates", coords: [55.27, 25.20] },
];

function jitter(coords: [number, number], index: number, domainIndex: number): [number, number] {
  const seed = index + domainIndex * 7;
  const angle = (seed * 137.5) * (Math.PI / 180);
  const r = 3 + (seed % 5) * 1.5;
  return [coords[0] + r * Math.cos(angle), coords[1] + r * Math.sin(angle)];
}

/**
 * Fetches live news (NewsAPI.ai) for each active domain across multiple countries.
 * With VITE_NEWSAPI_AI_KEY set, does not fall back to hardcoded SIGNALS.
 */
export function useLiveSignals(activeDomains: DomainId[]) {
  const [signals, setSignals] = useState<ResilienceSignal[]>([]);
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

    const cacheMapKey = `${isNewsApiAiConfigured() ? "api" : "seed"}:${domainKey}`;
    const cached = cache.get(cacheMapKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setSignals(cached.signals);
      setIsLive(true);
      setLoading(false);
      return;
    }

    const sessionEntry = readSessionCache<ResilienceSignal[]>(cacheMapKey);
    if (sessionEntry?.data?.length) {
      cache.set(cacheMapKey, { signals: sessionEntry.data, timestamp: sessionEntry.savedAt });
      setSignals(sessionEntry.data);
      setIsLive(true);
      setLoading(false);
    }

    // If domains haven't changed and we already have live data, skip
    if (domainKey === prevDomainsRef.current && isLive) return;
    prevDomainsRef.current = domainKey;

    if (isNewsApiAiConfigured()) {
      setSignals([]);
    } else {
      setSignals(SIGNALS.filter((s) => activeDomains.includes(s.domain)));
    }
    setLoading(true);

    const fetchDomainNews = async () => {
      const allSignals: ResilienceSignal[] = [];
      let gotLiveData = false;

      // For each domain, fetch from 3-4 countries to spread dots globally
      const promises = activeDomains.flatMap((domain) => {
        // Pick a subset of countries per domain to avoid too many API calls
        const countries = NEWS_COUNTRIES;
        return countries.map(async (country) => {
          try {
            const { data } = await invokeNewsFeed({
              type: "domain",
              domain,
              countryCode: country.code,
              countryName: country.name,
              pageSize: 3,
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
                  coordinates: jitter(country.coords, i, activeDomains.indexOf(domain)),
                  intensity: 7,
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
        const now = Date.now();
        cache.set(cacheMapKey, { signals: allSignals, timestamp: now });
        writeSessionCache(cacheMapKey, allSignals);
        setSignals(allSignals);
        setIsLive(true);
      } else if (isNewsApiAiConfigured()) {
        const snap = cache.get(cacheMapKey);
        if (snap?.signals?.length) {
          setSignals(snap.signals);
          setIsLive(true);
        } else {
          setSignals([]);
          setIsLive(false);
        }
      } else {
        setSignals(SIGNALS.filter((s) => activeDomains.includes(s.domain)));
        setIsLive(false);
      }
      setLoading(false);
    };

    fetchDomainNews();
  }, [activeDomains]);

  return { signals, loading, isLive };
}
