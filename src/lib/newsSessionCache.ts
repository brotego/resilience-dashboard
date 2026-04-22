/**
 * Survives full page refresh (unlike module-level Maps). Same-tab session only.
 * Used so a successful NewsAPI.ai response isn't lost on reload when the next request fails or rate-limits.
 */

const PREFIX = "rr.news.v1.";
/** Match persistent live-bundle TTL so a refresh does not refetch the whole globe the same day. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function safeParse<T>(raw: string): { data: T; savedAt: number } | null {
  try {
    const parsed = JSON.parse(raw) as { data: T; savedAt: number };
    if (typeof parsed.savedAt !== "number" || parsed.data === undefined) return null;
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readSessionCache<T>(key: string): { data: T; savedAt: number } | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = safeParse<T>(raw);
    if (!parsed) {
      sessionStorage.removeItem(PREFIX + key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeSessionCache<T>(key: string, data: T): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    if (Array.isArray(data) && data.length === 0) return;
    sessionStorage.setItem(PREFIX + key, JSON.stringify({ data, savedAt: Date.now() }));
  } catch {
    /* quota */
  }
}

export function removeSessionCache(key: string): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}
