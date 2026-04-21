/**
 * Detect and strip HTML-scraper noise (nav, menus, CTAs, site chrome).
 */

const ATTR_LINE =
  /^\s*(id|class|className|data-[a-z0-9_-]+|role|aria-[a-z0-9_-]+|tabindex|for|href|src|style|type)\s*=/i;

/** Short nav / UI labels (whole-line). */
const NAV_LABEL = new Set(
  [
    "team",
    "trending",
    "more",
    "books",
    "media",
    "news",
    "stocks",
    "gadgets",
    "industry",
    "geography",
    "magazines",
    "cryptocurrencies",
    "promote",
    "copied",
    ">",
    "contact us",
    "about us",
    "advertise with us",
    "advertise",
    "uae edition",
    "subscribe",
    "sign in",
    "sign up",
  ].map((s) => s.toLowerCase()),
);

const PROMO_START =
  /^(also\s+read:|install\s+app|download\s+app|analytics\s+insight:|related\s+articles|recommended\s+for\s+you|you\s+may\s+also\s+like|sponsored|advertisement)\b/i;

function decodeNumericEntities(text: string): string {
  return text
    .replace(/&#(\d{1,7});/g, (_, code) => {
      const n = parseInt(code, 10);
      return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : _;
    })
    .replace(/&#x([0-9a-f]{1,6});/gi, (_, hex) => {
      const n = parseInt(hex, 16);
      return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : _;
    });
}

function decodeBasicEntities(text: string): string {
  return decodeNumericEntities(text)
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/\u00a0/g, " ");
}

/** Cut at earliest disclaimer, “top stories”, ads, login prompts, promos (Multimedia-style and generic). */
export function truncateAtTrailingJunk(text: string): string {
  let cut = text.length;
  const regexCuts: RegExp[] = [
    /\n\s*DISCLAIMER:\s*/i,
    /^DISCLAIMER:\s*/im,
    /\n\s*- Advertisement -\s*(?:\n|$)/i,
    /^- Advertisement -\s*$/im,
    /\n\s*Top stories\s+/i,
    /^Top stories\s+/im,
    /\n\s*Log in to leave a comment/i,
    /^Log in to leave a comment/im,
    /\n\s*also read:\s*/i,
    /\n\s*install app\b/i,
    /\n\s*download app\b/i,
    /\n\s*related articles\b/i,
    /\n\s*recommended for you\b/i,
    /\n\s*you may also like\b/i,
  ];

  for (const re of regexCuts) {
    const m = re.exec(text);
    if (m && m.index < cut) cut = m.index;
  }

  const lower = text.toLowerCase();
  const stringMarkers = [
    "analytics insight:",
    "multimedia group limited",
    "views or policy of multimedia",
  ];
  for (const s of stringMarkers) {
    const i = lower.indexOf(s);
    if (i !== -1 && i < cut) cut = i;
  }

  return text.slice(0, cut).trim();
}

/** @deprecated use truncateAtTrailingJunk */
export const truncateAtPromoSection = truncateAtTrailingJunk;

/** Line looks like HTML attr residue, CSS module path, site promo, or related-story byline. */
export function isLikelyBoilerplateLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;

  if (ATTR_LINE.test(t)) return true;
  if (/^[\w.-]+=["'][^"']*["']\s*$/.test(t)) return true;
  if (/^["'][\w-./]+["']\s*$/.test(t)) return true;
  if (/__[a-z0-9_-]{4,}__/i.test(t) && !/\s/.test(t)) return true;
  if (/^(desktop|mobile|sticky|mega|secondary|header|footer|sidebar|menu|nav|ads?|banner)[-_]/i.test(t) && t.length < 160) {
    return true;
  }

  const lower = t.toLowerCase();
  if (NAV_LABEL.has(lower)) return true;
  if (
    lower === "हिन्दी" ||
    lower === "हिंदी" ||
    (/^[\u0900-\u097F\s]+$/.test(t) && t.length < 30)
  ) {
    return true;
  }

  if (PROMO_START.test(t)) return true;
  if (/install\s+app|download\s+(?:our\s+)?app|get\s+the\s+app/i.test(t)) return true;
  if (/analytics\s+insight/i.test(lower) && t.length < 120) return true;

  if (/^News\s+[A-Z]/.test(t) && t.length < 260 && !/[.!?]\s/.test(t)) return true;

  if (/^breadcrumb/i.test(t)) return true;

  if (/^DISCLAIMER:/i.test(t)) return true;
  if (/^- Advertisement -$/i.test(t)) return true;
  if (/^top stories\b/i.test(t)) return true;
  if (/log in to leave a comment/i.test(t)) return true;
  if (/multimedia group limited/i.test(t)) return true;
  if (/readers and contributors on this platform/i.test(t)) return true;

  if (/\bGhana News\s*[-–]\s*[A-Za-z]+\s+\d{1,2},\s*\d{4}\b/i.test(t)) return true;
  if (/^\w[\w\s]+\s+News\s*[-–]\s*[A-Za-z]+\s+\d{1,2},\s*\d{4}\s*$/i.test(t)) return true;

  if (/\bfacebook\.com|twitter\.com|instagram\.com\/\S+/i.test(t) && t.length < 400) return true;

  if (t.length < 500 && !/[.!?]/.test(t) && /^[\s\w&'’\-]+$/i.test(t)) {
    const words = t.split(/\s+/).filter(Boolean);
    if (words.length >= 8) {
      const cap = words.filter((w) => /^[A-Z$]/.test(w) || /^\$/.test(w)).length;
      if (cap / words.length > 0.82) return true;
    }
  }

  return false;
}

/** True if a big chunk of lines look like markup residue, not prose. */
export function looksLikeHtmlChromeDump(text: string): boolean {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 8) return false;
  const sample = lines.slice(0, Math.min(100, lines.length));
  let bad = 0;
  for (const line of sample) {
    if (isLikelyBoilerplateLine(line)) bad++;
  }
  return bad / sample.length >= 0.18;
}

/** Drop lines that are obvious chrome; keep real sentences. */
export function stripBoilerplateLines(text: string): string {
  const lines = text.split("\n");
  const kept: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (isLikelyBoilerplateLine(t)) continue;
    kept.push(t);
  }
  return kept.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** First paragraph index that looks like article body (not breadcrumb / title repeat). */
function findFirstBodyParagraphIndex(paragraphs: string[]): number {
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i].trim();
    if (p.length < 42) continue;
    if (isLikelyBoilerplateLine(p)) continue;
    if (/^news\s+[A-Z"'"']/.test(p) && p.length < 260 && !/[.!?]\s/.test(p)) continue;

    if (/[.,"""''']/.test(p)) return i;
    if (
      /^(The |This |That |In |He |She |They |It |Her |Mrs\. |Mr\. |Bier |Musk |X |Cashtags )/i.test(p)
    ) {
      return i;
    }
    if (p.length >= 120) return i;
  }
  return 0;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export type SanitizeArticleOptions = {
  /** When set, drop leading “By Author” / author-only lines duplicated from metadata. */
  author?: string;
};

/** Remove opening bylines / datelines often repeated above the real story. */
export function stripLeadingMetadataParagraphs(text: string, opts?: SanitizeArticleOptions): string {
  const paras = text
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
  let i = 0;
  const maxStrip = 3;
  while (i < paras.length && i < maxStrip) {
    const p = paras[i];
    if (p.length > 220) break;

    if (/^(by|written by)\s+/i.test(p)) {
      i++;
      continue;
    }
    if (/^(published|updated|posted)\s*:/i.test(p)) {
      i++;
      continue;
    }
    if (/^[^\n|]{1,70}\s*\|\s*[A-Za-z]+\s+\d{1,2},?\s*\d{4}\s*$/.test(p)) {
      i++;
      continue;
    }
    if (opts?.author) {
      const primary = opts.author.split(",")[0].trim();
      if (primary.length > 2) {
        if (new RegExp(`^${escapeRegExp(primary)}\\s*$`, "i").test(p)) {
          i++;
          continue;
        }
        if (new RegExp(`^by\\s+${escapeRegExp(primary)}\\s*$`, "i").test(p)) {
          i++;
          continue;
        }
      }
    }
    break;
  }
  return paras.slice(i).join("\n\n").trim();
}

/** Full cleanup for in-app article display (feed + scraped). */
export function sanitizeNewsArticleText(raw: string, opts?: SanitizeArticleOptions): string {
  let t = decodeBasicEntities(raw);
  t = truncateAtTrailingJunk(t);
  t = stripBoilerplateLines(t);
  t = truncateAtTrailingJunk(t);

  const paragraphs = t
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return stripLeadingMetadataParagraphs(t.trim(), opts);

  const start = findFirstBodyParagraphIndex(paragraphs);
  let body = paragraphs.slice(start).join("\n\n").trim();
  body = stripLeadingMetadataParagraphs(body, opts);
  return body;
}
