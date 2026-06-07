import type { Company } from "@/data/companies";

const REAL_ESTATE_ECONOMICS_TERMS = [
  "commercial real estate",
  "office market",
  "property market",
  "real estate market",
  "office vacancy",
  "office leasing",
  "cap rate",
  "reit",
  "interest rate",
  "interest rates",
  "macroeconom",
  "gdp",
  "inflation",
  "monetary policy",
  "central bank",
  "bond yield",
  "foreign investment",
  "foreign investor",
  "urban development",
  "mixed-use",
  "grade a office",
  "corporate landlord",
  "real estate investment",
  "property developer",
  "building development",
  "town management",
];

const OFF_TOPIC_PATTERNS = [
  /\b(bungalow|detached house|semi-detached|for sale for £|for sale for \$|bedroom|bedrooms|on the market for)\b/i,
  /\b(planet zoo|video game|game preview|gaming sequel|playstation|xbox|nintendo)\b/i,
  /\b(pachinko|gravure|photo book|celebrity|red carpet|movie premiere)\b/i,
  /\b(premier league|champions league|la liga|eredivisie|serie a|match report|injury update)\b/i,
  /\b(podcast\s*:|cap pme|trésorerie)\b/i,
  /\b(warehouse robot|robotics startup|leadership lessons:)\b/i,
  /\b(beauty writer|digital photo collection|美人)\b/i,
];

function articleText(title: string, description: string): string {
  return `${title || ""} ${description || ""}`.toLowerCase();
}

export function isOffTopicCompanyNews(title: string, description: string): boolean {
  const text = articleText(title, description);
  return OFF_TOPIC_PATTERNS.some((re) => re.test(text));
}

function includesTerm(text: string, term: string): boolean {
  const t = term.toLowerCase().trim();
  return t.length >= 3 && text.includes(t);
}

/** Industry-first relevance: company name is a bonus, not required. */
export function scoreCompanyNewsRelevance(company: Company, title: string, description: string): number {
  const text = articleText(title, description);
  if (isOffTopicCompanyNews(title, description)) return 0;

  let score = 0;
  let industryHits = 0;

  for (const term of company.industryNewsTerms) {
    if (includesTerm(text, term)) {
      industryHits += 1;
      score += term.length >= 12 ? 6 : 4;
    }
  }

  const sector = company.sector.toLowerCase();
  if (sector.includes("real estate") || sector.includes("urban development")) {
    for (const term of REAL_ESTATE_ECONOMICS_TERMS) {
      if (includesTerm(text, term)) {
        industryHits += 1;
        score += 3;
      }
    }
  }

  const name = company.name.toLowerCase();
  if (name.length >= 3 && text.includes(name)) score += 8;

  for (const marker of company.sentimentBrandMarkers ?? []) {
    if (marker.length >= 4 && text.includes(marker.toLowerCase())) score += 5;
  }

  for (const kw of company.keywords) {
    if (kw.length >= 5 && text.includes(kw.toLowerCase())) score += 2;
  }

  // Require at least one industry/economics anchor for companies with curated industry terms.
  if (company.industryNewsTerms.length > 0 && industryHits === 0) {
    return Math.max(0, score - 12);
  }

  return score;
}

export function passesCompanyNewsletterGate(company: Company, title: string, description: string): boolean {
  return scoreCompanyNewsRelevance(company, title, description) >= 8;
}

export function matchesCompanyIndustryNews(company: Company, title: string, description: string): boolean {
  return scoreCompanyNewsRelevance(company, title, description) >= 4;
}

/** Event Registry / news API keyword string: industry + economics, not name-only. */
export function buildCompanyIndustryNewsQuery(company: Company): string {
  const parts = [
    ...company.industryNewsTerms.slice(0, 6),
    company.sector.split(/&| and /i)[0]?.trim() || company.sector,
  ];
  if (company.sector.toLowerCase().includes("real estate")) {
    parts.push("commercial real estate", "office market", "property market");
  }
  parts.push(`"${company.name.replace(/"/g, " ").trim()}"`);
  return [...new Set(parts.filter(Boolean))].join(" ").replace(/\s+/g, " ").trim().slice(0, 220);
}

const MAX_MAP_KEYWORD_CHARS = 160;

/** Broad industry keywords for the global map — not company names or curated term lists. */
const SECTOR_MAP_KEYWORDS: Record<string, string> = {
  "real estate": "commercial real estate property market urban development",
  publish: "publishing media books industry",
  media: "media publishing content industry",
  entertain: "entertainment video games interactive media industry",
  game: "video games gaming entertainment industry",
  telecom: "telecommunications technology connectivity industry",
  hr: "workforce employment labor market staffing",
  staff: "workforce employment labor market staffing",
  food: "food beverage consumer industry market",
  beverage: "beverages consumer market health wellness",
  health: "health wellness consumer pharmaceuticals industry",
  tech: "technology business innovation industry market",
};

function sectorMapKeyword(sector: string): string | null {
  const s = sector.toLowerCase();
  for (const [needle, keyword] of Object.entries(SECTOR_MAP_KEYWORDS)) {
    if (s.includes(needle)) return keyword;
  }
  return null;
}

/**
 * One general industry keyword per country (Event Registry `keyword` field).
 * Country scope is sourceLocationUri; company relevance is scored after fetch.
 */
export function buildResilienceMapKeyword(company: Company | null): string {
  if (!company) {
    return "business economy finance industry market".slice(0, MAX_MAP_KEYWORD_CHARS);
  }

  const matched = sectorMapKeyword(company.sector);
  if (matched) return matched.slice(0, MAX_MAP_KEYWORD_CHARS);

  const sectorLabel = (company.sector.split(/&| and /i)[0]?.trim() || "business").slice(0, 40);
  return `${sectorLabel} industry market`.replace(/\s+/g, " ").trim().slice(0, MAX_MAP_KEYWORD_CHARS);
}
