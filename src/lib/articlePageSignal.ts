import type { UnifiedSignal } from "@/data/unifiedSignalTypes";

const DEFAULT_COORDS: [number, number] = [139.6917, 35.6895];

function inferJapan(location: string, title: string, description: string): boolean {
  const blob = `${location} ${title} ${description}`.toLowerCase();
  return (
    blob.includes("japan") ||
    blob.includes("tokyo") ||
    blob.includes("osaka") ||
    blob.includes("日本") ||
    blob.includes("東京")
  );
}

/**
 * Builds a minimal {@link UnifiedSignal} so `/signal/:id` can render the in-app article view
 * (body from description/snippet + optional fetch via articleUrl) for news-feed rows and newsletter items.
 */
export function buildArticlePageSignal(input: {
  id: string;
  title: string;
  description: string;
  source: string;
  location: string;
  date?: string;
  articleUrl?: string;
}): UnifiedSignal {
  const url = input.articleUrl?.trim();
  const safeUrl = url && url !== "#" ? url : undefined;
  const desc = input.description.trim() || input.title;
  return {
    id: input.id,
    title: input.title,
    description: desc,
    location: input.location.trim() || "Global",
    coordinates: DEFAULT_COORDS,
    layer: "live-news",
    resilienceScore: 5,
    urgency: "medium",
    source: input.source.trim() || undefined,
    articleUrl: safeUrl,
    articleContent: desc,
    date: input.date,
    isJapan: inferJapan(input.location, input.title, desc),
  };
}
