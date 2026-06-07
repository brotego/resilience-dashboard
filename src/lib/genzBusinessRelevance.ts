/**
 * Gen Z global map: articles that help businesses understand young consumers and workers.
 * Aligned with dashboard categories — authenticity, worklife, climate, digital, belonging.
 */

const YOUTH_ANCHORS = [
  "gen z",
  "gen-z",
  "generation z",
  "zoomer",
  "young adult",
  "young adults",
  "young consumer",
  "young consumers",
  "young people",
  "young worker",
  "young workers",
  "young employee",
  "young employees",
  "youth",
  "under 25",
  "under 30",
  "college student",
  "university student",
  "campus",
  "entry-level",
  "first job",
  "teen",
  "teenager",
  "digital native",
];

const BUSINESS_RELEVANCE_TERMS = [
  "consumer",
  "spending",
  "purchase",
  "purchasing",
  "shopping",
  "retail",
  "brand",
  "brands",
  "loyalty",
  "marketing",
  "advertising",
  "workforce",
  "talent",
  "hiring",
  "employment",
  "employer",
  "job market",
  "career",
  "workplace",
  "work-life",
  "remote work",
  "hybrid work",
  "flexible work",
  "burnout",
  "side hustle",
  "gig economy",
  "entrepreneur",
  "startup",
  "sustainability",
  "sustainable",
  "ethical",
  "transparency",
  "greenwashing",
  "climate-conscious",
  "circular economy",
  "creator economy",
  "influencer",
  "content creator",
  "social media",
  "tiktok",
  "instagram",
  "youtube",
  "platform",
  "e-commerce",
  "market research",
  "demographic",
  "demographics",
  "spending power",
  "purchasing power",
  "consumer behavior",
  "consumer behaviour",
  "brand trust",
  "authenticity",
  "mental health",
  "wellbeing",
  "well-being",
  "community",
  "belonging",
  "loneliness",
  "inclusion",
  "employer brand",
  "employee retention",
  "salary",
  "compensation",
  "housing affordability",
  "cost of living",
];

const STRONG_BUSINESS_PHRASES = [
  "gen z spending",
  "gen z consumer",
  "gen z workforce",
  "gen z employee",
  "gen z talent",
  "gen z brand",
  "gen z marketing",
  "young consumers",
  "young shoppers",
  "young workers",
  "creator economy",
  "social commerce",
  "influencer marketing",
  "brand authenticity",
  "work-life balance",
  "side hustle",
  "climate-conscious",
  "sustainable fashion",
  "employer brand",
  "talent retention",
  "youth unemployment",
  "student debt",
  "housing crisis",
];

const OFF_TOPIC_PATTERNS = [
  /\b(premier league|champions league|la liga|serie a|match report|injury update|transfer window|world cup qualifier)\b/i,
  /\b(video game|game preview|game review|gaming sequel|playstation|xbox|nintendo|fortnite patch)\b/i,
  /\b(celebrity|red carpet|dating rumor|breakup|wedding photos|paparazzi)\b/i,
  /\b(murder trial|shooting victim|stabbing|robbery suspect)\b/i,
  /\b(recipe for|horoscope|lottery winner|weather forecast)\b/i,
  /\b(bedroom|for sale for £|for sale for \$|detached house|semi-detached)\b/i,
];

const MACRO_ONLY_PATTERNS = [
  /\b(central bank|federal reserve|interest rate decision|bond yield|gdp growth|trade deficit)\b/i,
];

function articleText(title: string, description: string, content?: string): string {
  return `${title || ""} ${description || ""} ${content || ""}`.toLowerCase();
}

export function isOffTopicGenZMapNews(title: string, description: string, content?: string): boolean {
  const text = articleText(title, description, content);
  if (OFF_TOPIC_PATTERNS.some((re) => re.test(text))) return true;
  const hasYouth = YOUTH_ANCHORS.some((a) => text.includes(a));
  const hasBusiness = BUSINESS_RELEVANCE_TERMS.some((t) => text.includes(t));
  if (!hasYouth && !hasBusiness && MACRO_ONLY_PATTERNS.some((re) => re.test(text))) return true;
  return false;
}

/** 0–20+ score: higher = more useful for executives tracking Gen Z markets and talent. */
export function scoreGenZBusinessRelevance(title: string, description: string, content?: string): number {
  const text = articleText(title, description, content);
  if (isOffTopicGenZMapNews(title, description, content)) return 0;

  let score = 0;
  let youthHits = 0;
  let businessHits = 0;

  for (const anchor of YOUTH_ANCHORS) {
    if (text.includes(anchor)) {
      youthHits += 1;
      score += anchor.length >= 10 ? 4 : 3;
    }
  }

  for (const phrase of STRONG_BUSINESS_PHRASES) {
    if (text.includes(phrase)) score += 5;
  }

  for (const term of BUSINESS_RELEVANCE_TERMS) {
    if (text.includes(term)) {
      businessHits += 1;
      score += term.length >= 12 ? 3 : 2;
    }
  }

  // Youth + business intersection is the sweet spot for the map.
  if (youthHits > 0 && businessHits > 0) score += 4;

  return score;
}

/** Strict gate when ingesting live API articles onto the Gen Z map. */
export function passesGenZMapArticleGate(title: string, description: string, content?: string): boolean {
  return scoreGenZBusinessRelevance(title, description, content) >= 6;
}

/** Relaxed gate for filtering an already-built signal bundle. */
export function looksLikeBusinessGenZNews(title: string, description: string, content?: string): boolean {
  return scoreGenZBusinessRelevance(title, description, content) >= 3;
}

/**
 * Event Registry keyword buckets — one per Gen Z dashboard category, business-intelligence framed.
 */
export function buildGenZMapSearchBuckets(companyHint?: string): string[] {
  const hint = companyHint?.trim() ? ` ${companyHint.trim()}` : "";
  return [
    `Gen Z consumer spending brand loyalty purchase behavior retail marketing young shoppers${hint}`,
    `Gen Z workforce talent hiring career flexible work remote burnout side hustle employer brand${hint}`,
    `Gen Z sustainability ethical consumption climate-conscious brand transparency green marketing${hint}`,
    `Gen Z creator economy social media TikTok influencer marketing digital platforms youth advertising${hint}`,
    `Gen Z community belonging loneliness mental health workplace culture young adults social trends${hint}`,
  ];
}

/** Broader top-up queries when country buckets under-fill the map. */
export function buildGenZMapTopUpQueries(companyHint?: string): string[] {
  const hint = companyHint?.trim() ? ` ${companyHint.trim()}` : "";
  return [
    `Gen Z young consumers spending trends brand behavior market research demographics${hint}`,
    `Gen Z workforce employment talent retention workplace expectations young employees${hint}`,
    `Gen Z social media platform trends creator content marketing youth digital behavior${hint}`,
  ];
}

/** Default Event Registry prefix for type=genz requests (merged with topicQuery in newsFeed). */
export const GENZ_NEWS_API_BASE_KEYWORD =
  "Gen Z young adults consumer spending workforce social media brand trends creator economy youth market";
