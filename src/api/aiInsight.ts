/**
 * AI insight panel. Uses Anthropic when `VITE_ANTHROPIC_API_KEY` is provided.
 */

export type AiInsightRequestBody = {
  signalTitle?: string;
  signalDescription?: string;
  signalLocation?: string;
  signalDomain?: string;
  company?: string | null;
  mode?: "resilience" | "genz";
  language?: string;
};

export type AiInsightResult = {
  urgency: string;
  articleSummary: string;
  headline: string;
  actions: string[];
  risks: string[];
  opportunities: string[];
  whyItMatters: string;
  genzSignal: string;
  patternTag: string;
  error?: string;
};

export type ArticleSentiment = "positive" | "mixed" | "negative";
export type SentimentLens = "company" | "japan";
export type SentimentFallbackOpinion = {
  tone: ArticleSentiment;
  opinion: string;
};
export type CountryCompanyInsight = {
  insight: string;
};
export type CompanyNewsletterResult = {
  title: string;
  dek: string;
  paragraphs: string[];
  roundupTitle: string;
  selectedIds: string[];
  roundup: Array<{
    id: string;
    title: string;
    source: string;
    location: string;
    sentiment: ArticleSentiment;
    summary: string;
  }>;
};
export type SentimentArticleInput = {
  id: string;
  title: string;
  description?: string;
  source?: string;
  date?: string;
  url?: string;
};

type AiInsightCacheEntry = {
  savedAt: number;
  data: AiInsightResult;
};

const AI_INSIGHT_CACHE_PREFIX = "rr.ai.insight.v1.";
const AI_INSIGHT_CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const AI_SENTIMENT_CACHE_PREFIX = "rr.ai.sentiment.v1.";
const AI_SENTIMENT_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const AI_SENTIMENT_OPINION_CACHE_PREFIX = "rr.ai.sentiment.opinion.v1.";
const AI_SENTIMENT_OPINION_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const AI_COUNTRY_INSIGHT_CACHE_PREFIX = "rr.ai.country.insight.v1.";
const AI_COUNTRY_INSIGHT_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const AI_NEWSLETTER_CACHE_PREFIX = "rr.ai.newsletter.v1.";
const AI_NEWSLETTER_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

function insightCacheKey(body: AiInsightRequestBody): string {
  return JSON.stringify({
    t: body.signalTitle || "",
    d: body.signalDescription || "",
    l: body.signalLocation || "",
    g: body.signalDomain || "",
    c: body.company || "",
    lang: body.language || "en",
  });
}

function readInsightCache(body: AiInsightRequestBody): AiInsightResult | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(AI_INSIGHT_CACHE_PREFIX + insightCacheKey(body));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AiInsightCacheEntry;
    if (!parsed?.data || typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > AI_INSIGHT_CACHE_MAX_AGE_MS) {
      sessionStorage.removeItem(AI_INSIGHT_CACHE_PREFIX + insightCacheKey(body));
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function writeInsightCache(body: AiInsightRequestBody, data: AiInsightResult): void {
  if (typeof sessionStorage === "undefined") return;
  if (data.error) return;
  try {
    const entry: AiInsightCacheEntry = { savedAt: Date.now(), data };
    sessionStorage.setItem(AI_INSIGHT_CACHE_PREFIX + insightCacheKey(body), JSON.stringify(entry));
  } catch {
    // ignore quota/cache errors
  }
}

type AiSentimentCacheEntry = {
  savedAt: number;
  data: Record<string, ArticleSentiment>;
};

function sentimentCacheKey(params: {
  lens: SentimentLens;
  company?: string | null;
  industry?: string | null;
  countryName?: string | null;
  language?: string;
  articles: SentimentArticleInput[];
}): string {
  return JSON.stringify({
    lens: params.lens,
    company: params.company || "",
    industry: params.industry || "",
    country: params.countryName || "",
    lang: params.language || "en",
    articles: params.articles.map((a) => ({
      id: a.id,
      t: a.title || "",
      d: a.description || "",
      u: a.url || "",
    })),
  });
}

function readSentimentCache(cacheKey: string): Record<string, ArticleSentiment> | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(AI_SENTIMENT_CACHE_PREFIX + cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AiSentimentCacheEntry;
    if (!parsed?.data || typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > AI_SENTIMENT_CACHE_MAX_AGE_MS) {
      sessionStorage.removeItem(AI_SENTIMENT_CACHE_PREFIX + cacheKey);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function writeSentimentCache(cacheKey: string, data: Record<string, ArticleSentiment>): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const entry: AiSentimentCacheEntry = { savedAt: Date.now(), data };
    sessionStorage.setItem(AI_SENTIMENT_CACHE_PREFIX + cacheKey, JSON.stringify(entry));
  } catch {
    // ignore cache write failures
  }
}

function resolveAnthropicKey(): string | undefined {
  return (import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined)?.trim();
}

function resolveAnthropicModels(): string[] {
  const fromEnv = (import.meta.env.VITE_ANTHROPIC_MODEL as string | undefined)?.trim();
  if (fromEnv) return [fromEnv];
  return [
    // User-preferred latest family first.
    "claude-4.6-sonnet",
    // Common aliases/backward-compatible fallbacks.
    "claude-sonnet-4-6",
    "claude-3-7-sonnet-20250219",
  ];
}

function parseInsight(raw: string): AiInsightResult {
  const get = (label: string): string => {
    const re = new RegExp(`^${label}:\\s*(.+)`, "mi");
    const m = raw.match(re);
    return m ? m[1].trim() : "";
  };

  const getBlock = (label: string): string[] => {
    const re = new RegExp(`${label}:\\s*\\n([\\s\\S]*?)(?=\\n[A-Z_]+:|$)`, "m");
    const m = raw.match(re);
    if (m && m[1] && m[1].trim().length > 0) {
      return m[1]
        .split("\n")
        .map((l: string) => l.replace(/^\d+[\.\):\s]*/, "").trim())
        .filter((l: string) => l.length > 0);
    }
    const inlineRe = new RegExp(`${label}:\\s*(.+)`, "mi");
    const im = raw.match(inlineRe);
    if (im && im[1]) {
      const parts = im[1].split(/(?:\d+[\.\)]\s*)|(?:;\s*)/).filter((s: string) => s.trim().length > 0);
      if (parts.length > 1) return parts.map((s: string) => s.trim());
      return [im[1].trim()];
    }
    return [];
  };

  const actions = getBlock("ACTIONS");
  const risks = getBlock("RISKS");
  const opportunities = getBlock("OPPORTUNITIES");

  return {
    urgency: (get("URGENCY") || "medium").toLowerCase(),
    articleSummary: get("ARTICLE_SUMMARY") || get("SUMMARY") || get("HEADLINE") || "",
    headline: get("HEADLINE") || "",
    actions: actions.length > 0 ? actions : ["Assess strategic impact and develop response plan."],
    risks: risks.length > 0 ? risks : ["Delayed response risks competitive disadvantage."],
    opportunities: opportunities.length > 0 ? opportunities : ["First-mover positioning available."],
    whyItMatters: get("WHY_IT_MATTERS") || get("WHY IT MATTERS") || "Strategic implications for market positioning.",
    genzSignal: get("GENZ_SIGNAL") || get("GENZ SIGNAL") || "",
    patternTag: get("PATTERN_TAG") || get("PATTERN TAG") || "Emerging Signal",
  };
}

function parseSentimentMap(raw: string): Record<string, ArticleSentiment> | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const json = JSON.parse(raw.slice(start, end + 1)) as Record<string, string>;
    const out: Record<string, ArticleSentiment> = {};
    for (const [k, v] of Object.entries(json)) {
      const n = String(v).toLowerCase();
      if (n === "positive" || n === "mixed" || n === "negative") out[k] = n;
    }
    return out;
  } catch {
    return null;
  }
}

export async function invokeArticleSentimentBatch(params: {
  lens: SentimentLens;
  company?: string | null;
  industry?: string | null;
  countryName?: string | null;
  language?: string;
  articles: SentimentArticleInput[];
}): Promise<{ data: Record<string, ArticleSentiment> | null; error: Error | null }> {
  const articles = params.articles.filter((a) => !!a.id && !!a.title).slice(0, 12);
  if (articles.length === 0) return { data: {}, error: null };
  const cacheKey = sentimentCacheKey({ ...params, articles });
  const cached = readSentimentCache(cacheKey);
  if (cached) return { data: cached, error: null };

  const apiKey = resolveAnthropicKey();
  if (!apiKey) return { data: null, error: new Error("VITE_ANTHROPIC_API_KEY is not configured.") };

  const jp = params.language === "jp";
  const lensText = params.lens === "japan"
    ? (jp ? "日本関連の文脈だけで評価すること。" : "Evaluate sentiment only through a Japan-related lens.")
    : (jp
      ? `企業/業界関連の文脈だけで評価すること。企業: ${params.company || "N/A"} / 業界: ${params.industry || "N/A"}`
      : `Evaluate sentiment only through company/industry relevance. Company: ${params.company || "N/A"} / Industry: ${params.industry || "N/A"}`);
  const prompt = jp
    ? `以下の記事ごとに sentiment を判定してください。出力はJSONのみ。
- 値は positive / mixed / negative のいずれか
- 日本語や英語の見出しどちらでも判定
- 推測しすぎず、内容が中立なら mixed
- ${lensText}

JSON形式:
{"id1":"positive","id2":"mixed"}

記事:
${articles.map((a) => `- id=${a.id}\n  title=${a.title}\n  description=${a.description || ""}`).join("\n")}`
    : `Classify sentiment for each article and return JSON only.
- Allowed values: positive, mixed, negative
- If the article is neutral or ambiguous, use mixed
- ${lensText}

Output format:
{"id1":"positive","id2":"mixed"}

Articles:
${articles.map((a) => `- id=${a.id}\n  title=${a.title}\n  description=${a.description || ""}`).join("\n")}`;

  try {
    let lastError = "Unknown Anthropic error";
    for (const model of resolveAnthropicModels()) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model,
          max_tokens: 400,
          temperature: 0,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          (json && typeof json === "object" && "error" in json
            ? JSON.stringify((json as { error?: unknown }).error)
            : `HTTP ${res.status}`) || `HTTP ${res.status}`;
        lastError = `Anthropic: ${msg}`;
        continue;
      }

      const text = Array.isArray((json as any)?.content)
        ? (json as any).content.map((c: any) => (c?.type === "text" ? c.text : "")).join("\n")
        : "";
      const parsed = parseSentimentMap(text);
      if (!parsed) continue;
      writeSentimentCache(cacheKey, parsed);
      return { data: parsed, error: null };
    }
    return { data: null, error: new Error(lastError) };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error("Sentiment request failed") };
  }
}

function sentimentOpinionCacheKey(params: {
  lens: SentimentLens;
  company?: string | null;
  industry?: string | null;
  countryName?: string | null;
  language?: string;
}): string {
  return JSON.stringify({
    lens: params.lens,
    company: params.company || "",
    industry: params.industry || "",
    country: params.countryName || "",
    lang: params.language || "en",
  });
}

type SentimentOpinionCacheEntry = {
  savedAt: number;
  data: SentimentFallbackOpinion;
};

function readSentimentOpinionCache(cacheKey: string): SentimentFallbackOpinion | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(AI_SENTIMENT_OPINION_CACHE_PREFIX + cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SentimentOpinionCacheEntry;
    if (!parsed?.data || typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > AI_SENTIMENT_OPINION_MAX_AGE_MS) {
      sessionStorage.removeItem(AI_SENTIMENT_OPINION_CACHE_PREFIX + cacheKey);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function writeSentimentOpinionCache(cacheKey: string, data: SentimentFallbackOpinion): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const entry: SentimentOpinionCacheEntry = { savedAt: Date.now(), data };
    sessionStorage.setItem(AI_SENTIMENT_OPINION_CACHE_PREFIX + cacheKey, JSON.stringify(entry));
  } catch {
    // ignore cache write errors
  }
}

function parseSentimentOpinion(raw: string): SentimentFallbackOpinion | null {
  const toneMatch = raw.match(/TONE:\s*(positive|mixed|negative)/i);
  const opinionMatch = raw.match(/OPINION:\s*([\s\S]+)/i);
  if (!toneMatch || !opinionMatch) return null;
  const tone = toneMatch[1].toLowerCase();
  if (tone !== "positive" && tone !== "mixed" && tone !== "negative") return null;
  const opinion = opinionMatch[1].trim();
  if (!opinion) return null;
  return { tone, opinion };
}

export async function invokeSentimentFallbackOpinion(params: {
  lens: SentimentLens;
  company?: string | null;
  industry?: string | null;
  countryName?: string | null;
  language?: string;
}): Promise<{ data: SentimentFallbackOpinion | null; error: Error | null }> {
  const cacheKey = sentimentOpinionCacheKey(params);
  const cached = readSentimentOpinionCache(cacheKey);
  if (cached) return { data: cached, error: null };

  const apiKey = resolveAnthropicKey();
  if (!apiKey) return { data: null, error: new Error("VITE_ANTHROPIC_API_KEY is not configured.") };
  const jp = params.language === "jp";
  const lensContext = params.lens === "japan"
    ? (jp
      ? `${params.countryName || "対象国"}における日本関連の報道空気感を推定`
      : `Estimate likely Japan-related coverage sentiment in ${params.countryName || "the selected country"}`)
    : (jp
      ? `${params.countryName || "対象国"}の報道文脈における、企業: ${params.company || "N/A"}（業界: ${params.industry || "N/A"}）への見方を推定`
      : `Estimate how media in ${params.countryName || "the selected market"} likely views company ${params.company || "N/A"} in industry ${params.industry || "N/A"}`);
  const prompt = jp
    ? `記事が不足しているため、推定意見を生成してください。過度に断定せず、実務的に。
出力は厳密に以下:
TONE: positive|mixed|negative
OPINION: <6-9文。背景、評価理由、主要リスク、機会、直近の見方の変化、実務上の示唆を含む詳細意見>

文脈: ${lensContext}
重要: companyレンズの場合は「その国の視点」で評価し、日本全体の見方にすり替えないこと。`
    : `Articles are unavailable. Generate a cautious fallback opinion.
Return strictly:
TONE: positive|mixed|negative
OPINION: <6-9 sentences. Include background context, why this tone is likely, key risks, opportunities, recent trajectory, and practical implications>

Context: ${lensContext}
IMPORTANT: For company lens, use the selected country's media perspective toward the company (not a general view of Japan).`;

  try {
    let lastError = "Unknown Anthropic error";
    for (const model of resolveAnthropicModels()) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model,
          max_tokens: 520,
          temperature: 0.2,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          (json && typeof json === "object" && "error" in json
            ? JSON.stringify((json as { error?: unknown }).error)
            : `HTTP ${res.status}`) || `HTTP ${res.status}`;
        lastError = `Anthropic: ${msg}`;
        continue;
      }
      const text = Array.isArray((json as any)?.content)
        ? (json as any).content.map((c: any) => (c?.type === "text" ? c.text : "")).join("\n")
        : "";
      const parsed = parseSentimentOpinion(text);
      if (!parsed) continue;
      writeSentimentOpinionCache(cacheKey, parsed);
      return { data: parsed, error: null };
    }
    return { data: null, error: new Error(lastError) };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error("Sentiment opinion request failed") };
  }
}

type CountrySignalInput = {
  title: string;
  description?: string;
  source?: string;
  location?: string;
  domain?: string;
  urgency?: string;
};

function countryInsightCacheKey(params: {
  company?: string | null;
  industry?: string | null;
  countryName: string;
  language?: string;
  signals: CountrySignalInput[];
}): string {
  return JSON.stringify({
    company: params.company || "",
    industry: params.industry || "",
    country: params.countryName,
    lang: params.language || "en",
    signals: params.signals.map((s) => ({
      t: s.title || "",
      d: s.description || "",
      src: s.source || "",
      loc: s.location || "",
      dom: s.domain || "",
      u: s.urgency || "",
    })),
  });
}

type CountryInsightCacheEntry = {
  savedAt: number;
  data: CountryCompanyInsight;
};

function readCountryInsightCache(cacheKey: string): CountryCompanyInsight | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(AI_COUNTRY_INSIGHT_CACHE_PREFIX + cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CountryInsightCacheEntry;
    if (!parsed?.data || typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > AI_COUNTRY_INSIGHT_MAX_AGE_MS) {
      sessionStorage.removeItem(AI_COUNTRY_INSIGHT_CACHE_PREFIX + cacheKey);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCountryInsightCache(cacheKey: string, data: CountryCompanyInsight): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const entry: CountryInsightCacheEntry = { savedAt: Date.now(), data };
    sessionStorage.setItem(AI_COUNTRY_INSIGHT_CACHE_PREFIX + cacheKey, JSON.stringify(entry));
  } catch {
    // ignore cache write failures
  }
}

function parseCountryInsight(raw: string): CountryCompanyInsight | null {
  const m = raw.match(/INSIGHT:\s*([\s\S]+)/i);
  if (!m || !m[1]?.trim()) return null;
  return { insight: m[1].trim() };
}

export async function invokeCountryCompanyInsight(params: {
  company?: string | null;
  industry?: string | null;
  countryName: string;
  language?: string;
  signals: CountrySignalInput[];
}): Promise<{ data: CountryCompanyInsight | null; error: Error | null }> {
  const boundedSignals = params.signals.slice(0, 40);
  const cacheKey = countryInsightCacheKey({ ...params, signals: boundedSignals });
  const cached = readCountryInsightCache(cacheKey);
  if (cached) return { data: cached, error: null };

  const apiKey = resolveAnthropicKey();
  if (!apiKey) return { data: null, error: new Error("VITE_ANTHROPIC_API_KEY is not configured.") };
  const jp = params.language === "jp";
  const prompt = jp
    ? `あなたは企業戦略アナリストです。以下の国別シグナル一覧を読み、${params.countryName}における${params.company || "対象企業"}への示唆を詳細に要約してください。
条件:
- 7〜10文
- 「需要」「実行リスク」「優先アクション」をすべて含める
- 可能なら中期のシナリオ分岐にも触れる
- 憶測を避け、入力シグナルに基づく
- 出力は必ず次の形式のみ:
INSIGHT: ...

企業: ${params.company || "N/A"}
業界: ${params.industry || "N/A"}
国: ${params.countryName}

シグナル:
${boundedSignals.map((s, i) => `${i + 1}. ${s.title} | ${s.description || ""} | ${s.source || ""} | ${s.domain || ""} | ${s.urgency || ""}`).join("\n")}`
    : `You are a strategy analyst. Read these country-level signals and provide a detailed summary of what they mean for ${params.company || "the company"} in ${params.countryName}.
Requirements:
- 7-10 sentences
- Must include all of: demand impact, execution risk, and priority action
- If possible, include a near-term vs mid-term trajectory
- Grounded in input signals only
- Output ONLY in this format:
INSIGHT: ...

Company: ${params.company || "N/A"}
Industry: ${params.industry || "N/A"}
Country: ${params.countryName}

Signals:
${boundedSignals.map((s, i) => `${i + 1}. ${s.title} | ${s.description || ""} | ${s.source || ""} | ${s.domain || ""} | ${s.urgency || ""}`).join("\n")}`;

  try {
    let lastError = "Unknown Anthropic error";
    for (const model of resolveAnthropicModels()) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model,
          max_tokens: 620,
          temperature: 0.2,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          (json && typeof json === "object" && "error" in json
            ? JSON.stringify((json as { error?: unknown }).error)
            : `HTTP ${res.status}`) || `HTTP ${res.status}`;
        lastError = `Anthropic: ${msg}`;
        continue;
      }
      const text = Array.isArray((json as any)?.content)
        ? (json as any).content.map((c: any) => (c?.type === "text" ? c.text : "")).join("\n")
        : "";
      const parsed = parseCountryInsight(text);
      if (!parsed) continue;
      writeCountryInsightCache(cacheKey, parsed);
      return { data: parsed, error: null };
    }
    return { data: null, error: new Error(lastError) };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error("Country insight request failed") };
  }
}

type NewsletterSignalInput = {
  id: string;
  title: string;
  description?: string;
  source?: string;
  location?: string;
  urgency?: string;
  domain?: string;
};

type NewsletterCacheEntry = {
  savedAt: number;
  data: CompanyNewsletterResult;
};

function newsletterCacheKey(params: {
  company: string;
  industry?: string;
  language?: string;
  signals: NewsletterSignalInput[];
}): string {
  return JSON.stringify({
    company: params.company,
    industry: params.industry || "",
    lang: params.language || "en",
    signals: params.signals.map((s) => ({
      id: s.id,
      t: s.title || "",
      d: s.description || "",
      src: s.source || "",
      loc: s.location || "",
      u: s.urgency || "",
      dom: s.domain || "",
    })),
  });
}

function readNewsletterCache(cacheKey: string): CompanyNewsletterResult | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(AI_NEWSLETTER_CACHE_PREFIX + cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NewsletterCacheEntry;
    if (!parsed?.data || typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > AI_NEWSLETTER_CACHE_MAX_AGE_MS) {
      sessionStorage.removeItem(AI_NEWSLETTER_CACHE_PREFIX + cacheKey);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function writeNewsletterCache(cacheKey: string, data: CompanyNewsletterResult): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const entry: NewsletterCacheEntry = { savedAt: Date.now(), data };
    sessionStorage.setItem(AI_NEWSLETTER_CACHE_PREFIX + cacheKey, JSON.stringify(entry));
  } catch {
    // ignore cache write failures
  }
}

function parseNewsletter(raw: string): CompanyNewsletterResult | null {
  const candidates: string[] = [];
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) candidates.push(fenced[1].trim());
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) candidates.push(raw.slice(start, end + 1));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Partial<CompanyNewsletterResult>;
      if (!parsed?.title || !Array.isArray(parsed.paragraphs) || !Array.isArray(parsed.roundup)) continue;
      const roundupTitle = typeof parsed.roundupTitle === "string" && parsed.roundupTitle.trim().length > 0
        ? parsed.roundupTitle
        : "Article Roundup";
      const selectedIds = Array.isArray(parsed.selectedIds) ? parsed.selectedIds.map(String) : [];
      return {
        title: String(parsed.title),
        dek: String(parsed.dek || ""),
        paragraphs: parsed.paragraphs.map((p) => String(p)).filter(Boolean),
        roundupTitle,
        selectedIds,
        roundup: parsed.roundup
          .map((r: any) => ({
            id: String(r?.id || ""),
            title: String(r?.title || ""),
            source: String(r?.source || ""),
            location: String(r?.location || ""),
            sentiment: (String(r?.sentiment || "mixed").toLowerCase() as ArticleSentiment),
            summary: String(r?.summary || ""),
          }))
          .filter((r) => r.id && r.title),
      };
    } catch {
      continue;
    }
  }
  return null;
}

export async function invokeCompanyNewsletter(params: {
  company: string;
  industry?: string;
  language?: string;
  signals: NewsletterSignalInput[];
}): Promise<{ data: CompanyNewsletterResult | null; error: Error | null }> {
  const boundedSignals = params.signals.slice(0, 30);
  if (!params.company || boundedSignals.length === 0) return { data: null, error: new Error("Missing company or signals") };

  const cacheKey = newsletterCacheKey({
    company: params.company,
    industry: params.industry,
    language: params.language,
    signals: boundedSignals,
  });
  const cached = readNewsletterCache(cacheKey);
  if (cached) return { data: cached, error: null };

  const apiKey = resolveAnthropicKey();
  if (!apiKey) return { data: null, error: new Error("VITE_ANTHROPIC_API_KEY is not configured.") };
  const jp = params.language === "jp";
  const prompt = jp
    ? `あなたは企業向け編集責任者です。以下の候補シグナルから、${params.company}（業界: ${params.industry || "N/A"}）に最も関連性が高いものを5件選び、週次ニュースレターを作成してください。
要件:
- 関連性の高い順に5件選定
- JSONのみを返す
- paragraphsは3本、各2-3文
- roundupは5件
- sentimentはpositive|mixed|negative
- selectedIdsには選んだシグナルidを格納

JSON schema:
{
  "title":"...",
  "dek":"...",
  "paragraphs":["...","...","..."],
  "roundupTitle":"...",
  "selectedIds":["id1","id2","id3","id4","id5"],
  "roundup":[{"id":"id1","title":"...","source":"...","location":"...","sentiment":"mixed","summary":"..."}]
}

候補:
${boundedSignals.map((s) => `- id=${s.id} | title=${s.title} | desc=${s.description || ""} | source=${s.source || ""} | location=${s.location || ""} | urgency=${s.urgency || ""} | domain=${s.domain || ""}`).join("\n")}`
    : `You are an editorial strategist. From the candidate signals below, pick the 5 most relevant items for ${params.company} (industry: ${params.industry || "N/A"}) and write a weekly newsletter.
Requirements:
- Pick 5 most relevant items in ranked order
- Return JSON only
- Do not use markdown fences
- Provide 3 newsletter paragraphs, each 2-3 sentences
- Provide 5 roundup entries
- sentiment must be one of positive|mixed|negative
- selectedIds must contain the chosen signal IDs

JSON schema:
{
  "title":"...",
  "dek":"...",
  "paragraphs":["...","...","..."],
  "roundupTitle":"...",
  "selectedIds":["id1","id2","id3","id4","id5"],
  "roundup":[{"id":"id1","title":"...","source":"...","location":"...","sentiment":"mixed","summary":"..."}]
}

Candidates:
${boundedSignals.map((s) => `- id=${s.id} | title=${s.title} | desc=${s.description || ""} | source=${s.source || ""} | location=${s.location || ""} | urgency=${s.urgency || ""} | domain=${s.domain || ""}`).join("\n")}`;

  try {
    let lastError = "Unknown Anthropic error";
    for (const model of resolveAnthropicModels()) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model,
          max_tokens: 1400,
          temperature: 0.3,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          (json && typeof json === "object" && "error" in json
            ? JSON.stringify((json as { error?: unknown }).error)
            : `HTTP ${res.status}`) || `HTTP ${res.status}`;
        lastError = `Anthropic: ${msg}`;
        continue;
      }
      const text = Array.isArray((json as any)?.content)
        ? (json as any).content.map((c: any) => (c?.type === "text" ? c.text : "")).join("\n")
        : "";
      const parsed = parseNewsletter(text);
      if (!parsed) continue;
      writeNewsletterCache(cacheKey, parsed);
      return { data: parsed, error: null };
    }
    return { data: null, error: new Error(lastError) };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error("Newsletter request failed") };
  }
}

export async function invokeAiInsight(body: AiInsightRequestBody): Promise<{ data: AiInsightResult | null; error: Error | null }> {
  const jp = body.language === "jp";
  const cached = readInsightCache(body);
  if (cached) return { data: cached, error: null };

  const apiKey = resolveAnthropicKey();
  if (!apiKey) {
    return {
      data: {
        ...parseInsight(""),
        error: jp
          ? "VITE_ANTHROPIC_API_KEY が未設定です。"
          : "VITE_ANTHROPIC_API_KEY is not configured.",
      },
      error: null,
    };
  }

  const isGenZMode = body.mode === "genz";

  const modeDirectiveJp = isGenZMode
    ? `重要: この分析は「Gen Zシグナル」モードです。Z世代の価値観・行動・消費/就業傾向を中心に分析し、企業インパクトは必ず「${body.company || "当該企業"}がZ世代にどう対応すべきか」に限定してください。一般的なESG論やマクロ経済論だけで終わらせず、Z世代の具体的行動変化（住む場所、働く場所、支出先、ブランド選好）を明示してください。`
    : `重要: この分析はレジリエンスモードです。企業戦略上の実行可能性とリスクを中心に分析してください。`;

  const modeDirectiveEn = isGenZMode
    ? `IMPORTANT: This is Gen Z Signal mode. Center analysis on Gen Z values, behavior, and consumption/work trends, and explain impact specifically as what ${body.company || "the company"} should do for Gen Z relevance. Do NOT default to generic ESG or macro commentary; explicitly describe Gen Z behavior shifts (where they choose to live/work/spend and why).`
    : `IMPORTANT: This is Resilience mode. Focus on practical strategic implications and execution risks.`;

  const prompt = jp
    ? `あなたは企業向け戦略アナリストです。以下のシグナルをもとに、厳密に次の形式で出力してください。
URGENCY: high|medium|low
ARTICLE_SUMMARY: <記事の要点を1-2文で要約。固有名詞と出来事を明確に>
HEADLINE: <15語以内>
ACTIONS:
1) ...
2) ...
3) ...
RISKS:
1) ...
2) ...
OPPORTUNITIES:
1) ...
2) ...
WHY_IT_MATTERS: <企業にとっての現実的な意味を2-3文。Gen Zの行動変化を明示し、収益/需要/実行リスクへの影響を示す>
GENZ_SIGNAL: ...
PATTERN_TAG: ...

${modeDirectiveJp}

シグナル:
タイトル: ${body.signalTitle || ""}
説明: ${body.signalDescription || ""}
場所: ${body.signalLocation || ""}
領域: ${body.signalDomain || ""}
企業: ${body.company || "general"}`
    : `You are a strategic analyst. Based on the signal below, output ONLY in this exact format:
URGENCY: high|medium|low
ARTICLE_SUMMARY: <1-2 factual sentences summarizing what happened>
HEADLINE: <max 15 words>
ACTIONS:
1) ...
2) ...
3) ...
RISKS:
1) ...
2) ...
OPPORTUNITIES:
1) ...
2) ...
WHY_IT_MATTERS: <2-3 realistic sentences on company impact, explicitly tied to Gen Z behavior shift and at least one of revenue/demand/execution risk>
GENZ_SIGNAL: ...
PATTERN_TAG: ...

${modeDirectiveEn}

Signal:
Title: ${body.signalTitle || ""}
Description: ${body.signalDescription || ""}
Location: ${body.signalLocation || ""}
Domain: ${body.signalDomain || ""}
Company: ${body.company || "general"}`;

  try {
    let lastError = "Unknown Anthropic error";
    for (const model of resolveAnthropicModels()) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          // Required for direct browser calls.
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model,
          max_tokens: 500,
          temperature: 0.2,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          (json && typeof json === "object" && "error" in json
            ? JSON.stringify((json as { error?: unknown }).error)
            : `HTTP ${res.status}`) || `HTTP ${res.status}`;
        lastError = `Anthropic: ${msg}`;
        continue;
      }

      const text = Array.isArray((json as any)?.content)
        ? (json as any).content
            .map((c: any) => (c?.type === "text" ? c.text : ""))
            .join("\n")
        : "";
      const parsed = parseInsight(text);
      writeInsightCache(body, parsed);
      return { data: parsed, error: null };
    }
    return { data: { ...parseInsight(""), error: lastError }, error: null };
  } catch (err) {
    return {
      data: { ...parseInsight(""), error: err instanceof Error ? err.message : "LLM request failed" },
      error: null,
    };
  }
}
