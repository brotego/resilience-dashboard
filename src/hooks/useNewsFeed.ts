import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface NewsArticle {
  title: string;
  source: string;
  date: string;
  description: string;
  url: string;
}

interface CacheEntry {
  articles: NewsArticle[];
  timestamp: number;
}

const CACHE_DURATION = 60 * 60 * 1000; // 1 hour
const cache = new Map<string, CacheEntry>();

// Country name to ISO 2-letter code for NewsAPI top-headlines
const COUNTRY_CODES: Record<string, string> = {
  "United States of America": "us", "Japan": "jp", "United Kingdom": "gb",
  "Germany": "de", "France": "fr", "China": "cn", "India": "in",
  "Brazil": "br", "Australia": "au", "South Korea": "kr", "Indonesia": "id",
  "Nigeria": "ng", "Kenya": "ke", "Thailand": "th", "Sweden": "se",
  "Denmark": "dk", "Singapore": "sg", "Egypt": "eg", "South Africa": "za",
  "Colombia": "co", "Argentina": "ar", "Vietnam": "vn", "Philippines": "ph",
  "Belgium": "be", "Netherlands": "nl", "Ghana": "gh", "Kazakhstan": "kz",
  "United Arab Emirates": "ae", "Peru": "pe", "Chile": "cl",
  "Russia": "ru", "Canada": "ca", "Mexico": "mx", "Turkey": "tr",
  "Iran": "ir", "Saudi Arabia": "sa", "Italy": "it", "Spain": "es",
  "Poland": "pl", "Ukraine": "ua", "Romania": "ro", "Czech Republic": "cz",
  "Austria": "at", "Switzerland": "ch", "Portugal": "pt", "Greece": "gr",
  "Hungary": "hu", "Norway": "no", "Finland": "fi", "Ireland": "ie",
  "New Zealand": "nz", "Israel": "il", "Malaysia": "my", "Taiwan": "tw",
  "Pakistan": "pk", "Bangladesh": "bd", "Sri Lanka": "lk",
};

// Seed data fallback
const BUSINESS_SEED: Record<string, NewsArticle[]> = {
  default: [
    { title: "Global markets rally on trade optimism", source: "Reuters", date: "2025-04-09T10:00:00Z", description: "Stock markets worldwide gained ground as investors reacted positively to new trade agreements.", url: "#" },
    { title: "Central banks signal cautious approach to rate cuts", source: "Bloomberg", date: "2025-04-08T14:30:00Z", description: "Major central banks indicated they will take a measured approach to easing monetary policy.", url: "#" },
    { title: "Tech sector leads innovation investment surge", source: "NYT", date: "2025-04-07T09:15:00Z", description: "Technology companies increased R&D spending by 18% year-over-year.", url: "#" },
    { title: "Supply chain resilience becomes board-level priority", source: "BBC", date: "2025-04-06T11:00:00Z", description: "Corporate boards are increasingly prioritizing supply chain diversification strategies.", url: "#" },
    { title: "Green bonds issuance hits record high in Q1", source: "Nikkei", date: "2025-04-05T08:45:00Z", description: "Sustainable finance instruments reached unprecedented levels in the first quarter.", url: "#" },
  ],
};

const GENZ_SEED: Record<string, NewsArticle[]> = {
  default: [
    { title: "Gen Z driving shift toward conscious consumption", source: "Vice", date: "2025-04-09T12:00:00Z", description: "Young consumers increasingly factor sustainability into purchase decisions.", url: "#" },
    { title: "TikTok trend sparks global movement for climate action", source: "The Guardian", date: "2025-04-08T16:00:00Z", description: "A viral TikTok challenge raised awareness about carbon footprint reduction.", url: "#" },
    { title: "Youth-led brands disrupting traditional retail", source: "Business Insider", date: "2025-04-07T10:30:00Z", description: "Gen Z entrepreneurs are creating D2C brands that challenge incumbent players.", url: "#" },
    { title: "Digital natives reshape workplace expectations", source: "Forbes", date: "2025-04-06T13:00:00Z", description: "Gen Z workers prioritize flexibility, purpose, and mental health support.", url: "#" },
    { title: "Viral sustainability challenges gain corporate backing", source: "Fast Company", date: "2025-04-05T09:00:00Z", description: "Companies are sponsoring youth-driven environmental challenges on social media.", url: "#" },
  ],
};

export function useNewsFeed(countryName: string, type: "business" | "genz") {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFallback, setIsFallback] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const cacheKey = `${type}:${countryName}`;
    const cached = cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setArticles(cached.articles);
      setLoading(false);
      setIsFallback(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);

    const countryCode = COUNTRY_CODES[countryName] || "us";

    supabase.functions
      .invoke("news-feed", {
        body: { type, countryCode, countryName },
      })
      .then(({ data, error }) => {
        if (controller.signal.aborted) return;

        if (error || data?.fallback || !data?.articles?.length) {
          const seed = type === "business" ? BUSINESS_SEED : GENZ_SEED;
          const fallbackArticles = seed[countryName] || seed.default || [];
          setArticles(fallbackArticles);
          setIsFallback(true);
        } else {
          setArticles(data.articles);
          setIsFallback(false);
          cache.set(cacheKey, { articles: data.articles, timestamp: Date.now() });
        }
        setLoading(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        const seed = type === "business" ? BUSINESS_SEED : GENZ_SEED;
        setArticles(seed[countryName] || seed.default || []);
        setIsFallback(true);
        setLoading(false);
      });

    return () => controller.abort();
  }, [countryName, type]);

  return { articles, loading, isFallback };
}
