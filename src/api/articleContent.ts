/**
 * Fetches article HTML and extracts text (same logic as Edge Function `article-content`).
 * Many sites block browser CORS — in dev, Vite proxies `/api/article-fetch` (see vite.config.ts).
 */

import { looksLikeHtmlChromeDump, sanitizeNewsArticleText } from "@/lib/articleTextCleanup";

const MAX_EXTRACTED_CHARS = 120_000;

function articleHtmlFetchUrl(targetUrl: string): string {
  if (import.meta.env.DEV) {
    return `/api/article-fetch?url=${encodeURIComponent(targetUrl)}`;
  }
  return targetUrl;
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

/** Preserve paragraph breaks from common HTML before tag stripping. */
function htmlToPlainWithBreaks(html: string): string {
  return html
    .replace(/<\/p>\s*<p\b[^>]*>/gi, "\n\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/div>\s*<div\b/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/(article|main|section|blockquote)>/gi, "\n\n");
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/");
}

function cleanText(text: string): string {
  const lines = text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").replace(/\s([.,;:!?])/g, "$1").trim());
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function removeHtmlComments(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, " ");
}

/** Drop chrome regions before we pick main content (regex is imperfect but cuts most nav). */
function removeStructuralNoise(html: string): string {
  return html
    .replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, " ")
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, " ")
    .replace(/<aside\b[^>]*>[\s\S]*?<\/aside>/gi, " ")
    .replace(/<form\b[^>]*>[\s\S]*?<\/form>/gi, " ");
}

function pickBestChunk(html: string): string {
  const articles = [...html.matchAll(/<article\b[^>]*>[\s\S]*?<\/article>/gi)];
  if (articles.length > 0) {
    let best = "";
    for (const m of articles) {
      const block = m[0];
      if (block.length > best.length) best = block;
    }
    return best;
  }

  const mainMatch = html.match(/<main\b[^>]*>[\s\S]*?<\/main>/i);
  if (mainMatch?.[0]) return mainMatch[0];

  const story = html.match(
    /<div\b[^>]*(?:class|id)=["'][^"']*(?:story|article-body|post-content|entry-content|news-text)[^"']*["'][^>]*>[\s\S]*?<\/div>/i,
  );
  if (story?.[0] && story[0].length > 400) return story[0];

  return html;
}

export async function invokeArticleContent(body: { url: string }): Promise<{
  data: { content?: string; error?: string } | null;
  error: Error | null;
}> {
  const { url } = body;
  if (!url || typeof url !== "string") {
    return { data: { error: "Missing url param" }, error: null };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { data: { error: "Invalid url" }, error: null };
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { data: { error: "Unsupported protocol" }, error: null };
  }

  try {
    const response = await fetch(articleHtmlFetchUrl(parsed.toString()), {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ResilienceInsightBot/1.0; +https://example.com)",
      },
    });

    if (!response.ok) {
      return { data: { error: `Upstream returned ${response.status}` }, error: null };
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return { data: { error: "Unsupported content type" }, error: null };
    }

    let html = await response.text();
    html = removeHtmlComments(html);
    html = removeStructuralNoise(html);
    const core = pickBestChunk(html);
    const rough = htmlToPlainWithBreaks(core);
    let text = cleanText(decodeEntities(stripTags(rough)));
    text = sanitizeNewsArticleText(text);

    if (!text || text.length < 300) {
      return { data: { error: "Could not extract full article text" }, error: null };
    }

    if (looksLikeHtmlChromeDump(text)) {
      return { data: { error: "Extracted text looked like page chrome, not article body" }, error: null };
    }

    const trimmed = text.length > MAX_EXTRACTED_CHARS ? text.slice(0, MAX_EXTRACTED_CHARS) : text;
    return { data: { content: trimmed }, error: null };
  } catch (e) {
    return {
      data: { error: e instanceof Error ? e.message : "Fetch failed (often CORS in the browser)" },
      error: e instanceof Error ? e : new Error(String(e)),
    };
  }
}
