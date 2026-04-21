/**
 * Cross-session cache for live news signals.
 * Survives refresh/reopen and is shared for all visitors on this browser profile.
 */

const PREFIX = "rr.news.persist.v1.";
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

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

export function readPersistentCache<T>(key: string): { data: T; savedAt: number } | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = safeParse<T>(raw);
    if (!parsed) {
      localStorage.removeItem(PREFIX + key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writePersistentCache<T>(key: string, data: T): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (Array.isArray(data) && data.length === 0) return;
    localStorage.setItem(PREFIX + key, JSON.stringify({ data, savedAt: Date.now() }));
  } catch {
    /* quota */
  }
}

