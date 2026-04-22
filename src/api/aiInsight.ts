/**
 * AI insight panel. Uses Anthropic when `VITE_ANTHROPIC_API_KEY` is provided.
 */

import { hashCompanyContextSnippet } from "@/data/companyIntel";
import { readAiOutputCache, writeAiOutputCache } from "@/lib/projectSupabaseCache";

export type AiInsightRequestBody = {
  signalTitle?: string;
  signalDescription?: string;
  signalLocation?: string;
  signalDomain?: string;
  company?: string | null;
  companyId?: string | null;
  /** Rich dossier text from formatCompanyContextForAi — improves tailoring vs name alone. */
  companyContext?: string;
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
  /** Three to four bullets grounded in the selected roundup / signal set. */
  risingRisks: string[];
  risingOpportunities: string[];
  roundup: Array<{
    id: string;
    title: string;
    source: string;
    location: string;
    sentiment: ArticleSentiment;
    summary: string;
    /** Original article URL when the signal came from live news or the model echoed it. */
    url?: string;
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
const AI_NEWSLETTER_CACHE_PREFIX = "rr.ai.newsletter.v5.";
const AI_NEWSLETTER_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const AI_SENTIMENT_SUMMARY_CACHE_PREFIX = "rr.ai.sentiment.summary.v2.";
const AI_SENTIMENT_SUMMARY_MAX_AGE_MS = 6 * 60 * 60 * 1000;

function hashLite(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function aiCacheDayBucket(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function aiSharedKey(artifact: string, mode: "resilience" | "genz", companyId: string, raw: string): string {
  return `ai:${artifact}:${mode}:${companyId}:${aiCacheDayBucket()}:${hashLite(raw)}`;
}

function companyCacheId(company?: string | null): string {
  const c = (company || "").trim().toLowerCase();
  if (!c) return "global";
  return c.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "global";
}

async function readAiShared<T>(params: {
  artifact: string;
  mode: "resilience" | "genz";
  companyId: string;
  locale?: string;
  rawKey: string;
}): Promise<T | null> {
  const cacheKey = aiSharedKey(params.artifact, params.mode, params.companyId, params.rawKey);
  const row = await readAiOutputCache<T>({ cacheKey });
  return row?.data ?? null;
}

async function writeAiShared<T>(params: {
  artifact: string;
  mode: "resilience" | "genz";
  companyId: string;
  locale?: string;
  rawKey: string;
  payload: T;
  model?: string;
  ttlHours?: number;
}): Promise<void> {
  const cacheKey = aiSharedKey(params.artifact, params.mode, params.companyId, params.rawKey);
  const promptHash = hashLite(params.rawKey);
  await writeAiOutputCache({
    cacheKey,
    companyId: params.companyId,
    mode: params.mode,
    artifactType: params.artifact,
    locale: params.locale || "en",
    model: params.model || "anthropic",
    promptHash,
    payload: params.payload,
    ttlHours: params.ttlHours ?? 24,
  });
}

function insightCacheKey(body: AiInsightRequestBody): string {
  return JSON.stringify({
    t: body.signalTitle || "",
    d: body.signalDescription || "",
    l: body.signalLocation || "",
    g: body.signalDomain || "",
    c: body.company || "",
    cc: hashCompanyContextSnippet(body.companyContext ?? ""),
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
  companyId?: string | null;
  lens: SentimentLens;
  company?: string | null;
  industry?: string | null;
  countryName?: string | null;
  companyContext?: string;
  language?: string;
  articles: SentimentArticleInput[];
}): string {
  return JSON.stringify({
    companyId: params.companyId || "",
    lens: params.lens,
    company: params.company || "",
    industry: params.industry || "",
    country: params.countryName || "",
    cc: hashCompanyContextSnippet(params.companyContext ?? ""),
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

const JP_FALLBACK_ACTION = "戦略的影響を評価し、対応プランを策定する。";
const JP_FALLBACK_RISK = "対応が遅れると競争上不利になる可能性があります。";
const JP_FALLBACK_OPP = "先行対応により優位を確保できる余地があります。";
const JP_FALLBACK_WHY = "市場ポジションと実行リスクに関わる戦略的含意です。";
const JP_FALLBACK_PATTERN = "新興シグナル";

function localizeAiInsightDefaultsForJp(data: AiInsightResult): AiInsightResult {
  const actions =
    data.actions.length === 1 && data.actions[0] === "Assess strategic impact and develop response plan."
      ? [JP_FALLBACK_ACTION]
      : data.actions;
  const risks =
    data.risks.length === 1 && data.risks[0] === "Delayed response risks competitive disadvantage."
      ? [JP_FALLBACK_RISK]
      : data.risks;
  const opportunities =
    data.opportunities.length === 1 && data.opportunities[0] === "First-mover positioning available."
      ? [JP_FALLBACK_OPP]
      : data.opportunities;
  const whyItMatters =
    data.whyItMatters === "Strategic implications for market positioning." ? JP_FALLBACK_WHY : data.whyItMatters;
  const patternTag = data.patternTag === "Emerging Signal" ? JP_FALLBACK_PATTERN : data.patternTag;
  return { ...data, actions, risks, opportunities, whyItMatters, patternTag };
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
  companyId?: string | null;
  lens: SentimentLens;
  company?: string | null;
  industry?: string | null;
  countryName?: string | null;
  /** Company lens only: helps judge relevance of headlines to the firm. */
  companyContext?: string;
  language?: string;
  articles: SentimentArticleInput[];
}): Promise<{ data: Record<string, ArticleSentiment> | null; error: Error | null }> {
  const articles = params.articles.filter((a) => !!a.id && !!a.title).slice(0, 12);
  if (articles.length === 0) return { data: {}, error: null };
  const cacheKey = sentimentCacheKey({ ...params, articles });
  const cached = readSentimentCache(cacheKey);
  if (cached) {
    void writeAiShared({
      artifact: `sentiment_batch_${params.lens}`,
      mode: "resilience",
      companyId: params.companyId || companyCacheId(params.company),
      locale: params.language || "en",
      rawKey: cacheKey,
      payload: cached,
      ttlHours: 24,
    });
    return { data: cached, error: null };
  }
  const sharedCached = await readAiShared<Record<string, ArticleSentiment>>({
    artifact: `sentiment_batch_${params.lens}`,
    mode: params.lens === "japan" ? "resilience" : "resilience",
    companyId: params.companyId || companyCacheId(params.company),
    locale: params.language || "en",
    rawKey: cacheKey,
  });
  if (sharedCached) {
    writeSentimentCache(cacheKey, sharedCached);
    return { data: sharedCached, error: null };
  }

  const apiKey = resolveAnthropicKey();
  if (!apiKey) return { data: null, error: new Error("VITE_ANTHROPIC_API_KEY is not configured.") };

  const jp = params.language === "jp";
  const lensText = params.lens === "japan"
    ? (jp ? "日本関連の文脈だけで評価すること。" : "Evaluate sentiment only through a Japan-related lens.")
    : (jp
      ? `企業/業界関連の文脈だけで評価すること。企業: ${params.company || "N/A"} / 業界: ${params.industry || "N/A"}`
      : `Evaluate sentiment only through company/industry relevance. Company: ${params.company || "N/A"} / Industry: ${params.industry || "N/A"}`);
  const dossierBlock =
    params.lens === "company" && params.companyContext?.trim()
      ? jp
        ? `\n【参照ドシエ（この企業の事業・文脈）】\n${params.companyContext.trim()}\n`
        : `\n[Company dossier for context]\n${params.companyContext.trim()}\n`
      : "";
  const prompt = jp
    ? `以下の記事ごとに sentiment を判定してください。出力はJSONのみ。
- 値は positive / mixed / negative のいずれか
- 日本語や英語の見出しどちらでも判定
- 推測しすぎず、内容が中立なら mixed
- ${lensText}
${dossierBlock}
JSON形式:
{"id1":"positive","id2":"mixed"}

記事:
${articles.map((a) => `- id=${a.id}\n  title=${a.title}\n  description=${a.description || ""}`).join("\n")}`
    : `Classify sentiment for each article and return JSON only.
- Allowed values: positive, mixed, negative
- If the article is neutral or ambiguous, use mixed
- ${lensText}
${dossierBlock}
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
      void writeAiShared({
        artifact: `sentiment_batch_${params.lens}`,
        mode: "resilience",
        companyId: params.companyId || companyCacheId(params.company),
        locale: params.language || "en",
        rawKey: cacheKey,
        payload: parsed,
        model,
        ttlHours: 24,
      });
      return { data: parsed, error: null };
    }
    return { data: null, error: new Error(lastError) };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error("Sentiment request failed") };
  }
}

function sentimentOpinionCacheKey(params: {
  companyId?: string | null;
  lens: SentimentLens;
  company?: string | null;
  industry?: string | null;
  countryName?: string | null;
  language?: string;
}): string {
  return JSON.stringify({
    companyId: params.companyId || "",
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
  companyId?: string | null;
  lens: SentimentLens;
  company?: string | null;
  industry?: string | null;
  countryName?: string | null;
  language?: string;
}): Promise<{ data: SentimentFallbackOpinion | null; error: Error | null }> {
  const cacheKey = sentimentOpinionCacheKey(params);
  const cached = readSentimentOpinionCache(cacheKey);
  if (cached) {
    void writeAiShared({
      artifact: `sentiment_fallback_${params.lens}`,
      mode: "resilience",
      companyId: params.companyId || companyCacheId(params.company),
      locale: params.language || "en",
      rawKey: cacheKey,
      payload: cached,
      ttlHours: 24,
    });
    return { data: cached, error: null };
  }
  const sharedCached = await readAiShared<SentimentFallbackOpinion>({
    artifact: `sentiment_fallback_${params.lens}`,
    mode: "resilience",
    companyId: params.companyId || companyCacheId(params.company),
    locale: params.language || "en",
    rawKey: cacheKey,
  });
  if (sharedCached) {
    writeSentimentOpinionCache(cacheKey, sharedCached);
    return { data: sharedCached, error: null };
  }

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
      void writeAiShared({
        artifact: `sentiment_fallback_${params.lens}`,
        mode: "resilience",
        companyId: params.companyId || companyCacheId(params.company),
        locale: params.language || "en",
        rawKey: cacheKey,
        payload: parsed,
        model,
        ttlHours: 24,
      });
      return { data: parsed, error: null };
    }
    return { data: null, error: new Error(lastError) };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error("Sentiment opinion request failed") };
  }
}

export type SentimentSectionSummaryInput = {
  id: string;
  title: string;
  description?: string;
  source?: string;
  tone: ArticleSentiment;
};

function sentimentSectionSummaryCacheKey(params: {
  companyId?: string | null;
  lens: SentimentLens;
  company?: string | null;
  industry?: string | null;
  countryName?: string | null;
  companyContext?: string;
  language?: string;
  articles: SentimentSectionSummaryInput[];
}): string {
  return JSON.stringify({
    companyId: params.companyId || "",
    lens: params.lens,
    company: params.company || "",
    industry: params.industry || "",
    country: params.countryName || "",
    cc: hashCompanyContextSnippet(params.companyContext ?? ""),
    lang: params.language || "en",
    articles: params.articles.map((a) => ({
      id: a.id,
      t: a.title || "",
      d: a.description || "",
      src: a.source || "",
      tone: a.tone,
    })),
  });
}

type SentimentSummaryCacheEntry = {
  savedAt: number;
  data: { summary: string };
};

function readSentimentSectionSummaryCache(cacheKey: string): { summary: string } | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(AI_SENTIMENT_SUMMARY_CACHE_PREFIX + cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SentimentSummaryCacheEntry;
    if (!parsed?.data?.summary || typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > AI_SENTIMENT_SUMMARY_MAX_AGE_MS) {
      sessionStorage.removeItem(AI_SENTIMENT_SUMMARY_CACHE_PREFIX + cacheKey);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function writeSentimentSectionSummaryCache(cacheKey: string, data: { summary: string }): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const entry: SentimentSummaryCacheEntry = { savedAt: Date.now(), data };
    sessionStorage.setItem(AI_SENTIMENT_SUMMARY_CACHE_PREFIX + cacheKey, JSON.stringify(entry));
  } catch {
    // ignore
  }
}

function parseSentimentSectionSummary(raw: string): { summary: string } | null {
  const m = raw.match(/SUMMARY:\s*([\s\S]+)/i);
  if (!m || !m[1]?.trim()) return null;
  return { summary: m[1].trim() };
}

/** Cross-article AI overview for the dashboard sentiment list (company or Japan lens). */
export async function invokeSentimentSectionSummary(params: {
  companyId?: string | null;
  lens: SentimentLens;
  company?: string | null;
  industry?: string | null;
  countryName?: string | null;
  companyContext?: string;
  language?: string;
  articles: SentimentSectionSummaryInput[];
}): Promise<{ data: { summary: string } | null; error: Error | null }> {
  const bounded = params.articles.slice(0, 10);
  if (bounded.length === 0) return { data: null, error: null };

  const cacheKey = sentimentSectionSummaryCacheKey({ ...params, articles: bounded });
  const cached = readSentimentSectionSummaryCache(cacheKey);
  if (cached) {
    void writeAiShared({
      artifact: `sentiment_summary_${params.lens}`,
      mode: "resilience",
      companyId: params.companyId || companyCacheId(params.company),
      locale: params.language || "en",
      rawKey: cacheKey,
      payload: cached,
      ttlHours: 24,
    });
    return { data: cached, error: null };
  }
  const sharedCached = await readAiShared<{ summary: string }>({
    artifact: `sentiment_summary_${params.lens}`,
    mode: "resilience",
    companyId: params.companyId || companyCacheId(params.company),
    locale: params.language || "en",
    rawKey: cacheKey,
  });
  if (sharedCached) {
    writeSentimentSectionSummaryCache(cacheKey, sharedCached);
    return { data: sharedCached, error: null };
  }

  const apiKey = resolveAnthropicKey();
  if (!apiKey) return { data: null, error: new Error("VITE_ANTHROPIC_API_KEY is not configured.") };
  const jp = params.language === "jp";
  const lines = bounded.map(
    (a, i) =>
      `${i + 1}. id=${a.id} | tone=${a.tone} | title=${a.title} | source=${a.source || ""} | snippet=${(a.description || "").slice(0, 320)}`,
  );
  const lensLine = params.lens === "japan"
    ? (jp
      ? `レンズ: グローバル報道における「日本」関連の論調`
      : `Lens: global media sentiment toward Japan-related themes`)
    : (jp
      ? `レンズ: グローバル報道における企業「${params.company || "N/A"}」（業界: ${params.industry || "N/A"}）への論調`
      : `Lens: global media sentiment toward company ${params.company || "N/A"} (industry: ${params.industry || "N/A"})`);
  const companyDossierJp =
    params.lens === "company" && params.companyContext?.trim()
      ? `\n【企業ドシエ（要約の文脈に使用）】\n${params.companyContext.trim()}\n`
      : "";
  const companyDossierEn =
    params.lens === "company" && params.companyContext?.trim()
      ? `\n[Company dossier — use for nuance]\n${params.companyContext.trim()}\n`
      : "";

  const prompt = jp
    ? `あなたは経営向けダッシュボードの編集者です。以下は同一レンズで取得した記事一覧（各件にAIが付けたtone: positive|mixed|negative）です。
${lensLine}${companyDossierJp}
記事:
${lines.join("\n")}

要件:
- 入力記事の内容にのみ根ざす（外部の事実を捏造しない）
- 4〜7文の1段落で、全体のトーン配分、繰り返しテーマ、経営が注視すべき点、時間軸の示唆を含める
- 出力は次の形式のみ（見出しや箇条書き禁止）:
SUMMARY: <段落>`
    : `You are an editor for an executive dashboard. Below is a set of articles for one lens, each with an AI-assigned tone (positive|mixed|negative).
${lensLine}${companyDossierEn}
Articles:
${lines.join("\n")}

Requirements:
- Ground only in these headlines/snippets; do not invent facts.
- One paragraph, 4-7 sentences: overall tone balance, recurring themes, what leadership should watch, and any timing nuance.
- Output ONLY this format (no headings or bullets):
SUMMARY: <paragraph>`;

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
          max_tokens: 720,
          temperature: 0.25,
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
      const parsed = parseSentimentSectionSummary(text);
      if (!parsed) continue;
      writeSentimentSectionSummaryCache(cacheKey, parsed);
      void writeAiShared({
        artifact: `sentiment_summary_${params.lens}`,
        mode: "resilience",
        companyId: params.companyId || companyCacheId(params.company),
        locale: params.language || "en",
        rawKey: cacheKey,
        payload: parsed,
        model,
        ttlHours: 24,
      });
      return { data: parsed, error: null };
    }
    return { data: null, error: new Error(lastError) };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error("Sentiment summary request failed") };
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
  companyId?: string | null;
  company?: string | null;
  industry?: string | null;
  countryName: string;
  language?: string;
  signals: CountrySignalInput[];
}): string {
  return JSON.stringify({
    companyId: params.companyId || "",
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
  companyId?: string | null;
  company?: string | null;
  industry?: string | null;
  countryName: string;
  language?: string;
  signals: CountrySignalInput[];
}): Promise<{ data: CountryCompanyInsight | null; error: Error | null }> {
  const boundedSignals = params.signals.slice(0, 40);
  const cacheKey = countryInsightCacheKey({ ...params, signals: boundedSignals });
  const cached = readCountryInsightCache(cacheKey);
  if (cached) {
    void writeAiShared({
      artifact: "country_company_insight",
      mode: "resilience",
      companyId: params.companyId || companyCacheId(params.company),
      locale: params.language || "en",
      rawKey: cacheKey,
      payload: cached,
      ttlHours: 24,
    });
    return { data: cached, error: null };
  }
  const sharedCached = await readAiShared<CountryCompanyInsight>({
    artifact: "country_company_insight",
    mode: "resilience",
    companyId: params.companyId || companyCacheId(params.company),
    locale: params.language || "en",
    rawKey: cacheKey,
  });
  if (sharedCached) {
    writeCountryInsightCache(cacheKey, sharedCached);
    return { data: sharedCached, error: null };
  }

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
      void writeAiShared({
        artifact: "country_company_insight",
        mode: "resilience",
        companyId: params.companyId || companyCacheId(params.company),
        locale: params.language || "en",
        rawKey: cacheKey,
        payload: parsed,
        model,
        ttlHours: 24,
      });
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
  /** When present (e.g. live news), shown as the roundup link target. */
  articleUrl?: string;
};

type NewsletterCacheEntry = {
  savedAt: number;
  data: CompanyNewsletterResult;
};

function newsletterCacheKey(params: {
  companyId?: string | null;
  company: string;
  industry?: string;
  companyContext?: string;
  language?: string;
  timeWindow?: string;
  signals: NewsletterSignalInput[];
}): string {
  return JSON.stringify({
    companyId: params.companyId || "",
    company: params.company,
    industry: params.industry || "",
    cc: hashCompanyContextSnippet(params.companyContext ?? ""),
    lang: params.language || "en",
    timeWindow: params.timeWindow || "",
    signals: params.signals.map((s) => ({
      id: s.id,
      t: s.title || "",
      d: s.description || "",
      src: s.source || "",
      loc: s.location || "",
      u: s.urgency || "",
      dom: s.domain || "",
      url: s.articleUrl || "",
    })),
  });
}

/** Detects the old non-AI fallback template so we can strip or replace it when the model echoes boilerplate. */
function isTemplateRisingLine(line: string): boolean {
  const s = line.trim();
  return (
    /—\s*elevated urgency;\s*monitor execution and reputational exposure\.?\s*$/i.test(s) ||
    /—\s*worth evaluating as a potential opportunity window\.?\s*$/i.test(s) ||
    /—\s*watch for adverse narrative or downside risk\.?\s*$/i.test(s) ||
    /—\s*favorable narrative worth tracking for upside\.?\s*$/i.test(s) ||
    /—\s*緊急度が高く、実行・評判リスクの監視が必要です。?\s*$/.test(s) ||
    /—\s*機会ウィンドウの検討に値する動きです。?\s*$/.test(s)
  );
}

function dedupeRisingLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const key = (line.split("—").pop() || line).slice(0, 96).toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
    if (out.length >= 6) break;
  }
  return out;
}

/** Replace thin / templated bullets with readable lines from the roundup the model already wrote. */
function polishNewsletterRisingBullets(data: CompanyNewsletterResult): CompanyNewsletterResult {
  const fillFromRoundup = (kind: "risk" | "opp") => {
    const rows = data.roundup.filter((r) => {
      if (kind === "risk") return r.sentiment === "negative" || r.sentiment === "mixed";
      return r.sentiment === "positive" || r.sentiment === "mixed";
    });
    return rows.map((r) => {
      const title = r.title.length > 76 ? `${r.title.slice(0, 73)}…` : r.title;
      const sum = (r.summary || "").replace(/\s+/g, " ").trim();
      const body = sum.length > 160 ? `${sum.slice(0, 157)}…` : sum;
      return body ? `${title} — ${body}` : `${title} — (${r.location || "Global"}) ${r.source ? `via ${r.source}` : ""}`.trim();
    });
  };

  const clean = (lines: string[], kind: "risk" | "opp") => {
    let v = dedupeRisingLines(lines.filter((l) => l.trim().length > 0 && !isTemplateRisingLine(l)));
    if (v.length < 2) {
      v = dedupeRisingLines([...v, ...fillFromRoundup(kind)]);
    }
    return v.slice(0, 5);
  };

  return {
    ...data,
    risingRisks: clean(data.risingRisks || [], "risk"),
    risingOpportunities: clean(data.risingOpportunities || [], "opp"),
  };
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
    return polishNewsletterRisingBullets(parsed.data);
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
      const risingRisks = Array.isArray((parsed as { risingRisks?: unknown }).risingRisks)
        ? (parsed as { risingRisks: unknown[] }).risingRisks.map((x) => String(x).trim()).filter(Boolean).slice(0, 5)
        : [];
      const risingOpportunities = Array.isArray((parsed as { risingOpportunities?: unknown }).risingOpportunities)
        ? (parsed as { risingOpportunities: unknown[] }).risingOpportunities.map((x) => String(x).trim()).filter(Boolean).slice(0, 5)
        : [];
      return {
        title: String(parsed.title),
        dek: String(parsed.dek || ""),
        paragraphs: parsed.paragraphs.map((p) => String(p)).filter(Boolean),
        roundupTitle,
        selectedIds,
        risingRisks,
        risingOpportunities,
        roundup: parsed.roundup
          .map((r: any) => ({
            id: String(r?.id || ""),
            title: String(r?.title || ""),
            source: String(r?.source || ""),
            location: String(r?.location || ""),
            sentiment: (String(r?.sentiment || "mixed").toLowerCase() as ArticleSentiment),
            summary: String(r?.summary || ""),
            ...(typeof r?.url === "string" && r.url.trim().length > 0 ? { url: r.url.trim() } : {}),
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
  companyId?: string | null;
  company: string;
  industry?: string;
  companyContext?: string;
  language?: string;
  timeWindow?: string;
  signals: NewsletterSignalInput[];
}): Promise<{ data: CompanyNewsletterResult | null; error: Error | null }> {
  const boundedSignals = params.signals.slice(0, 30);
  if (!params.company || boundedSignals.length === 0) return { data: null, error: new Error("Missing company or signals") };

  const cacheKey = newsletterCacheKey({
    companyId: params.companyId,
    company: params.company,
    industry: params.industry,
    companyContext: params.companyContext,
    language: params.language,
    timeWindow: params.timeWindow,
    signals: boundedSignals,
  });
  const cached = readNewsletterCache(cacheKey);
  if (cached) {
    void writeAiShared({
      artifact: "company_newsletter",
      mode: "resilience",
      companyId: params.companyId || companyCacheId(params.company),
      locale: params.language || "en",
      rawKey: cacheKey,
      payload: cached,
      ttlHours: 24,
    });
    return { data: cached, error: null };
  }
  const sharedCached = await readAiShared<CompanyNewsletterResult>({
    artifact: "company_newsletter",
    mode: "resilience",
    companyId: params.companyId || companyCacheId(params.company),
    locale: params.language || "en",
    rawKey: cacheKey,
  });
  if (sharedCached) {
    const polishedShared = polishNewsletterRisingBullets(sharedCached);
    writeNewsletterCache(cacheKey, polishedShared);
    return { data: polishedShared, error: null };
  }

  const apiKey = resolveAnthropicKey();
  if (!apiKey) return { data: null, error: new Error("VITE_ANTHROPIC_API_KEY is not configured.") };
  const jp = params.language === "jp";
  const candidateLines = boundedSignals.map(
    (s) =>
      `- id=${s.id} | title=${s.title} | desc=${s.description || ""} | source=${s.source || ""} | location=${s.location || ""} | urgency=${s.urgency || ""} | domain=${s.domain || ""} | url=${s.articleUrl || ""}`,
  );

  const dossierJp = params.companyContext?.trim()
    ? `【企業ドシエ（関連性判断・リスク/機会の文脈に必ず活用）】\n${params.companyContext.trim()}\n\n`
    : "";
  const dossierEn = params.companyContext?.trim()
    ? `[Company dossier — use for relevance, risks, and opportunities]\n${params.companyContext.trim()}\n\n`
    : "";

  const prompt = jp
    ? `あなたは企業向け編集責任者です。以下の候補シグナルから、${params.company}（業界: ${params.industry || "N/A"}）に最も関連性が高いものを5件選び、週次ニュースレターを作成してください。
${dossierJp}要件:
- 対象時間帯: ${params.timeWindow || "current window"}
- 関連性の高い順に5件選定
- JSONのみを返す
- paragraphsは3本、各2-3文
- roundupは5件（各summaryは選んだシグナルの内容に基づく）
- sentimentはpositive|mixed|negative
- selectedIdsには選んだシグナルidを格納
- risingRisks / risingOpportunities: 選んだ5件だけを根拠に、${params.company}の事業にどう効くかを1行ずつ書く（3〜4本）。各行は「具体的な論点 — なぜ${params.company}に効くか」の形にし、全行で同じ文末や定型句を繰り返さない。外国語の見出しは出力言語（日本語）に要約・翻訳してから書く。娯楽・ゴシップ・無関係な話題は選ばず、選んだ場合もライジング欄に載せない。
- roundup各要素に、候補に url があれば同じ "url" フィールドを必ずコピー（なければ省略）

JSON schema:
{
  "title":"...",
  "dek":"...",
  "paragraphs":["...","...","..."],
  "roundupTitle":"...",
  "selectedIds":["id1","id2","id3","id4","id5"],
  "risingRisks":["...","...","..."],
  "risingOpportunities":["...","...","..."],
  "roundup":[{"id":"id1","title":"...","source":"...","location":"...","sentiment":"mixed","summary":"...","url":"https://..."}]
}

候補:
${candidateLines.join("\n")}`
    : `You are an editorial strategist. From the candidate signals below, pick the 5 most relevant items for ${params.company} (industry: ${params.industry || "N/A"}) and write a weekly newsletter.
${dossierEn}Requirements:
- Time window focus: ${params.timeWindow || "current window"}
- Pick 5 most relevant items in ranked order
- Return JSON only
- Do not use markdown fences
- Provide 3 newsletter paragraphs, each 2-3 sentences
- Provide 5 roundup entries; each summary must reflect that signal's storyline
- sentiment must be one of positive|mixed|negative
- selectedIds must contain the chosen signal IDs
- risingRisks / risingOpportunities: 3-4 lines each, grounded ONLY in the five selected items. Each line must be unique: start from the story's concrete angle, then explain why it matters for ${params.company} (regulation, cost, demand, partners, reputation, etc.). Do NOT reuse the same closing phrase across lines (avoid generic "monitor execution" type endings). If a headline is not in English, translate/clarify it into the output language for readability. Do not include tabloid, sports, or celebrity gossip unless the dossier shows clear business relevance to ${params.company}.
- For each roundup item, if the candidate line includes a non-empty url=..., copy it into the same "url" field on that roundup object; omit "url" if none

JSON schema:
{
  "title":"...",
  "dek":"...",
  "paragraphs":["...","...","..."],
  "roundupTitle":"...",
  "selectedIds":["id1","id2","id3","id4","id5"],
  "risingRisks":["...","...","..."],
  "risingOpportunities":["...","...","..."],
  "roundup":[{"id":"id1","title":"...","source":"...","location":"...","sentiment":"mixed","summary":"...","url":"https://..."}]
}

Candidates:
${candidateLines.join("\n")}`;

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
          max_tokens: 2800,
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
      const urlById = new Map(
        boundedSignals.map((s) => [s.id, (s.articleUrl || "").trim()]),
      );
      const enriched: CompanyNewsletterResult = {
        ...parsed,
        roundup: parsed.roundup.map((r) => {
          const fromSignal = urlById.get(r.id) || "";
          const mergedUrl = (r.url && r.url.trim().length > 0 ? r.url.trim() : fromSignal) || undefined;
          return { ...r, ...(mergedUrl ? { url: mergedUrl } : {}) };
        }),
      };
      const polished = polishNewsletterRisingBullets(enriched);
      writeNewsletterCache(cacheKey, polished);
      void writeAiShared({
        artifact: "company_newsletter",
        mode: "resilience",
        companyId: params.companyId || companyCacheId(params.company),
        locale: params.language || "en",
        rawKey: cacheKey,
        payload: polished,
        model,
        ttlHours: 24,
      });
      return { data: polished, error: null };
    }
    return { data: null, error: new Error(lastError) };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error("Newsletter request failed") };
  }
}

export async function invokeAiInsight(body: AiInsightRequestBody): Promise<{ data: AiInsightResult | null; error: Error | null }> {
  const jp = body.language === "jp";
  const cached = readInsightCache(body);
  if (cached) {
    const rawKey = insightCacheKey(body);
    const mode: "resilience" | "genz" = body.mode === "genz" ? "genz" : "resilience";
    void writeAiShared({
      artifact: "ai_insight",
      mode,
      companyId: body.companyId || companyCacheId(body.company),
      locale: body.language || "en",
      rawKey,
      payload: cached,
      ttlHours: 24,
    });
    return { data: cached, error: null };
  }
  const rawKey = insightCacheKey(body);
  const mode: "resilience" | "genz" = body.mode === "genz" ? "genz" : "resilience";
  const sharedCached = await readAiShared<AiInsightResult>({
    artifact: "ai_insight",
    mode,
    companyId: body.companyId || companyCacheId(body.company),
    locale: body.language || "en",
    rawKey,
  });
  if (sharedCached) {
    writeInsightCache(body, sharedCached);
    return { data: sharedCached, error: null };
  }

  const apiKey = resolveAnthropicKey();
  if (!apiKey) {
    const empty = jp ? localizeAiInsightDefaultsForJp(parseInsight("")) : parseInsight("");
    return {
      data: {
        ...empty,
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

  const dossierForInsightJp = body.companyContext?.trim()
    ? `\n参照企業ドシエ（この企業の事業・優先課題に沿って分析すること）:\n${body.companyContext.trim()}\n`
    : "";
  const dossierForInsightEn = body.companyContext?.trim()
    ? `\nCompany dossier (tailor analysis to this business context):\n${body.companyContext.trim()}\n`
    : "";

  const prompt = jp
    ? `あなたは企業向け戦略アナリストです。以下のシグナルをもとに、厳密に次の形式で出力してください。
【言語】ラベル名（URGENCY 等）はそのまま。各フィールドの本文はすべて自然な日本語のみ。英語文は禁止。

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
${dossierForInsightJp}
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
${dossierForInsightEn}
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
      const parsed = jp ? localizeAiInsightDefaultsForJp(parseInsight(text)) : parseInsight(text);
      writeInsightCache(body, parsed);
      void writeAiShared({
        artifact: "ai_insight",
        mode,
        companyId: body.companyId || companyCacheId(body.company),
        locale: body.language || "en",
        rawKey,
        payload: parsed,
        model,
        ttlHours: 24,
      });
      return { data: parsed, error: null };
    }
    const emptyErr = jp ? localizeAiInsightDefaultsForJp(parseInsight("")) : parseInsight("");
    return { data: { ...emptyErr, error: lastError }, error: null };
  } catch (err) {
    const emptyErr = jp ? localizeAiInsightDefaultsForJp(parseInsight("")) : parseInsight("");
    return {
      data: { ...emptyErr, error: err instanceof Error ? err.message : "LLM request failed" },
      error: null,
    };
  }
}
