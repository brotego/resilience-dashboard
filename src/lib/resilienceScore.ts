import { CompanyId, COMPANIES } from "@/data/companies";
import { DomainId } from "@/data/types";
import { GenZCategoryId } from "@/data/genzTypes";

/**
 * Dynamic Resilience Exposure Score (1-10)
 *
 * Formula:
 *   score = (domainRelevance × 0.35) + (keywordMatch × 0.30) + (recency × 0.20) + (sourceAuthority × 0.15)
 *
 * Each sub-score is 0-10, final is clamped 1-10.
 */

const AUTHORITY_SOURCES: Record<string, number> = {
  reuters: 10, bloomberg: 10, "financial times": 10, nikkei: 9,
  bbc: 9, nyt: 9, "new york times": 9, "the guardian": 8,
  "wall street journal": 9, "washington post": 8, economist: 9,
  forbes: 7, "business insider": 6, vice: 5, techcrunch: 7,
  wired: 7, "fast company": 6, "associated press": 9, ap: 9,
};

export interface ResilienceScoreBreakdown {
  total: number;
  domainRelevance: number;
  keywordMatch: number;
  recency: number;
  sourceAuthority: number;
}

export function calculateResilienceScore(
  params: {
    title: string;
    description: string;
    source?: string;
    date?: string;
    domain?: DomainId;
    category?: GenZCategoryId;
    companyId?: CompanyId | null;
    baseIntensity?: number;
  }
): ResilienceScoreBreakdown {
  const { title, description, source, date, domain, category, companyId, baseIntensity } = params;
  const text = `${title} ${description}`.toLowerCase();

  // 1. Domain relevance (0-10)
  let domainRelevance = 5; // neutral default
  if (companyId) {
    const company = COMPANIES.find(c => c.id === companyId);
    if (company) {
      if (domain && company.relevantDomains.includes(domain)) domainRelevance = 9;
      else if (category && company.relevantGenZCategories.includes(category)) domainRelevance = 8;
      else domainRelevance = 3;
    }
  } else if (baseIntensity) {
    domainRelevance = Math.min(10, baseIntensity);
  }

  // 2. Keyword match (0-10)
  let keywordMatch = 4; // default for non-company view
  if (companyId) {
    const company = COMPANIES.find(c => c.id === companyId);
    if (company) {
      const matches = company.keywords.filter(kw => text.includes(kw.toLowerCase()));
      keywordMatch = Math.min(10, matches.length * 2.5);
    }
  }

  // 3. Recency (0-10): last 24h = 10, 7d = 7, 30d = 4, older = 2
  let recency = 5;
  if (date) {
    const ageMs = Date.now() - new Date(date).getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    if (ageHours < 24) recency = 10;
    else if (ageHours < 72) recency = 8;
    else if (ageHours < 168) recency = 7;
    else if (ageHours < 720) recency = 4;
    else recency = 2;
  }

  // 4. Source authority (0-10)
  let sourceAuthority = 5;
  if (source) {
    const srcLower = source.toLowerCase();
    for (const [name, score] of Object.entries(AUTHORITY_SOURCES)) {
      if (srcLower.includes(name)) { sourceAuthority = score; break; }
    }
  }

  const total = Math.round(
    Math.min(10, Math.max(1,
      domainRelevance * 0.35 +
      keywordMatch * 0.30 +
      recency * 0.20 +
      sourceAuthority * 0.15
    ))
  );

  return { total, domainRelevance, keywordMatch, recency, sourceAuthority };
}

/** Map score to urgency label */
export function scoreToUrgency(score: number): "critical" | "high" | "medium" | "low" {
  if (score >= 9) return "critical";
  if (score >= 7) return "high";
  if (score >= 4) return "medium";
  return "low";
}
