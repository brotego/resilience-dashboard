import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface NewsDot {
  id: string;
  title: string;
  source: string;
  coordinates: [number, number];
  country: string;
  type: "business" | "genz";
  date: string;
  description: string;
}

interface CacheEntry {
  dots: NewsDot[];
  timestamp: number;
}

const CACHE_DURATION = 60 * 60 * 1000; // 1 hour
let globalCache: CacheEntry | null = null;

// Capital coordinates for geocoding news by country
const COUNTRY_COORDS: Record<string, [number, number]> = {
  us: [-77.04, 38.91], jp: [139.69, 35.69], gb: [-0.12, 51.51],
  de: [13.41, 52.52], fr: [2.35, 48.86], cn: [116.41, 39.90],
  in: [77.21, 28.61], br: [-47.93, -15.78], au: [149.13, -35.28],
  kr: [126.98, 37.57], id: [106.85, -6.21], ng: [3.39, 6.45],
  ke: [36.82, -1.29], th: [100.50, 13.76], se: [18.07, 59.33],
  sg: [103.82, 1.35], eg: [31.24, 30.04], za: [28.05, -25.75],
  ar: [-58.38, -34.60], mx: [-99.13, 19.43], ca: [-75.70, 45.42],
  it: [12.50, 41.90], ru: [37.62, 55.75], sa: [46.72, 24.71],
  ae: [55.27, 25.20], nl: [4.90, 52.37], co: [-74.07, 4.71],
};

const COUNTRY_NAMES: Record<string, string> = {
  us: "United States of America", jp: "Japan", gb: "United Kingdom",
  de: "Germany", fr: "France", cn: "China", in: "India", br: "Brazil",
  au: "Australia", kr: "South Korea", id: "Indonesia", ng: "Nigeria",
  ke: "Kenya", th: "Thailand", se: "Sweden", sg: "Singapore",
  eg: "Egypt", za: "South Africa", ar: "Argentina", mx: "Mexico",
  ca: "Canada", it: "Italy", ru: "Russia", sa: "Saudi Arabia",
  ae: "United Arab Emirates", nl: "Netherlands", co: "Colombia",
};

// Slight coordinate jitter so dots don't stack on the same point
function jitter(coords: [number, number], index: number): [number, number] {
  const angle = (index * 137.5) * (Math.PI / 180); // golden angle
  const r = 1.5 + (index % 3) * 0.8;
  return [coords[0] + r * Math.cos(angle), coords[1] + r * Math.sin(angle)];
}

// Key countries to fetch headlines from
const FETCH_COUNTRIES = ["us", "gb", "jp", "de", "fr", "au", "in", "br", "kr", "sg", "ae", "za"];

export function useGlobalNewsDots() {
  const [dots, setDots] = useState<NewsDot[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    if (globalCache && Date.now() - globalCache.timestamp < CACHE_DURATION) {
      setDots(globalCache.dots);
      setLoading(false);
      return;
    }

    const fetchAll = async () => {
      const allDots: NewsDot[] = [];

      // Fetch business headlines from key countries in parallel (batched)
      const businessPromises = FETCH_COUNTRIES.map(async (cc) => {
        try {
          const { data } = await supabase.functions.invoke("news-feed", {
            body: { type: "business", countryCode: cc, countryName: COUNTRY_NAMES[cc] },
          });
          if (data?.articles && !data?.fallback) {
            return data.articles.map((a: any, i: number) => ({
              id: `biz-${cc}-${i}`,
              title: a.title,
              source: a.source,
              coordinates: jitter(COUNTRY_COORDS[cc], i),
              country: COUNTRY_NAMES[cc],
              type: "business" as const,
              date: a.date,
              description: a.description,
            }));
          }
        } catch { /* fallback below */ }
        return [];
      });

      // Fetch Gen Z signals for a subset of countries
      const genzCountries = ["us", "gb", "jp", "in", "br", "kr"];
      const genzPromises = genzCountries.map(async (cc) => {
        try {
          const { data } = await supabase.functions.invoke("news-feed", {
            body: { type: "genz", countryCode: cc, countryName: COUNTRY_NAMES[cc] },
          });
          if (data?.articles && !data?.fallback) {
            return data.articles.map((a: any, i: number) => ({
              id: `genz-${cc}-${i}`,
              title: a.title,
              source: a.source,
              coordinates: jitter(COUNTRY_COORDS[cc], i + 5),
              country: COUNTRY_NAMES[cc],
              type: "genz" as const,
              date: a.date,
              description: a.description,
            }));
          }
        } catch { /* fallback below */ }
        return [];
      });

      const results = await Promise.all([...businessPromises, ...genzPromises]);
      results.forEach((r) => allDots.push(...r));

      globalCache = { dots: allDots, timestamp: Date.now() };
      setDots(allDots);
      setLoading(false);
    };

    fetchAll();
  }, []);

  return { dots, loading };
}
