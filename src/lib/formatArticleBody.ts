/**
 * Turn feed or extracted article text into paragraph blocks for display.
 */

export function splitArticleIntoParagraphs(raw: string): string[] {
  const normalized = raw.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const blocks = normalized
    .split(/\n\s*\n+/)
    .map((b) => b.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);

  if (blocks.length > 0) return blocks;
  return [normalized.replace(/[ \t]+/g, " ").trim()];
}
