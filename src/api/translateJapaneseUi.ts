/**
 * Batch-translates short UI strings (signal cards, news rows) to Japanese via Anthropic.
 * Cached in sessionStorage to avoid repeat cost when toggling JP/EN.
 */

import { SIGNALS } from "@/data/signals";
import { GENZ_SIGNALS } from "@/data/genzSignals";

export type UiTranslatableItem = {
  id: string;
  title: string;
  description: string;
  location: string;
  insight?: string;
};

export type UiJapaneseFields = {
  title: string;
  description: string;
  location: string;
  insight?: string;
};

const SEED_STORAGE_KEY = "rr.jp.seedUi.v1";
const CHUNK_SIZE = 36;

function resolveAnthropicKey(): string | undefined {
  return (import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined)?.trim();
}

function resolveAnthropicModels(): string[] {
  const fromEnv = (import.meta.env.VITE_ANTHROPIC_MODEL as string | undefined)?.trim();
  if (fromEnv) return [fromEnv];
  return ["claude-4.6-sonnet", "claude-sonnet-4-6", "claude-3-7-sonnet-20250219"];
}

function simpleHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) + h + s.charCodeAt(i);
    h |= 0;
  }
  return (h >>> 0).toString(36);
}

function readSeedCache(): Record<string, UiJapaneseFields> | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SEED_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { map?: Record<string, UiJapaneseFields> };
    if (!parsed?.map || typeof parsed.map !== "object") return null;
    return parsed.map;
  } catch {
    return null;
  }
}

function writeSeedCache(map: Record<string, UiJapaneseFields>): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(SEED_STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), map }));
  } catch {
    // ignore quota
  }
}

export function buildSeedUiTranslatableItems(): UiTranslatableItem[] {
  const resilience = SIGNALS.map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    location: s.location,
  }));
  const genz = GENZ_SIGNALS.map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    location: s.location,
    insight: s.insight,
  }));
  return [...resilience, ...genz];
}

function parseTranslationObject(raw: string): Record<string, UiJapaneseFields> | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates: string[] = [];
  if (fenced?.[1]) candidates.push(fenced[1].trim());
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) candidates.push(raw.slice(start, end + 1));

  for (const c of candidates) {
    try {
      const obj = JSON.parse(c) as Record<string, Partial<UiJapaneseFields>>;
      const out: Record<string, UiJapaneseFields> = {};
      for (const [id, row] of Object.entries(obj)) {
        if (!row || typeof row.title !== "string") continue;
        out[id] = {
          title: row.title,
          description: typeof row.description === "string" ? row.description : "",
          location: typeof row.location === "string" ? row.location : "",
          ...(typeof row.insight === "string" && row.insight.length > 0 ? { insight: row.insight } : {}),
        };
      }
      return Object.keys(out).length > 0 ? out : null;
    } catch {
      continue;
    }
  }
  return null;
}

async function anthropicUserMessage(prompt: string, maxTokens: number): Promise<string> {
  const apiKey = resolveAnthropicKey();
  if (!apiKey) return "";

  let lastError = "";
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
        max_tokens: maxTokens,
        temperature: 0.15,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      lastError = `HTTP ${res.status}`;
      continue;
    }
    const text = Array.isArray((json as { content?: unknown })?.content)
      ? (json as { content: Array<{ type?: string; text?: string }> }).content
          .map((c) => (c?.type === "text" ? c.text : ""))
          .join("\n")
      : "";
    if (text) return text;
  }
  if (lastError) console.warn("translateJapaneseUi:", lastError);
  return "";
}

async function translateChunk(items: UiTranslatableItem[]): Promise<Record<string, UiJapaneseFields>> {
  if (items.length === 0) return {};

  const payload = items.map((i) => ({
    id: i.id,
    title: i.title,
    description: i.description,
    location: i.location,
    ...(i.insight ? { insight: i.insight } : {}),
  }));

  const prompt = `あなたはプロのビジネス編集者です。入力JSON配列の各要素について、title・description・locationを自然な日本語（ビジネス向け）に翻訳してください。
insight フィールドがある要素は、Z世代向けの長文インサイトも同様に日本語へ翻訳してください。
id は変更しないこと。固有名詞・地名は読みやすい表記（カタカナ可）で統一してください。

出力はJSONオブジェクトのみ（説明文やコードフェンス禁止）:
{ "<id>": { "title": "...", "description": "...", "location": "...", "insight": "..." }, ... }
insight が元にない要素では insight キーを省略してよい。

入力:
${JSON.stringify(payload)}`;

  const text = await anthropicUserMessage(prompt, 8192);
  return parseTranslationObject(text) || {};
}

/** Loads cached seed map or fetches missing entries (requires Anthropic key). */
export async function ensureJapaneseSeedUiMap(): Promise<Record<string, UiJapaneseFields>> {
  const all = buildSeedUiTranslatableItems();
  const merged: Record<string, UiJapaneseFields> = { ...(readSeedCache() || {}) };

  const stillMissing = all.filter((i) => !merged[i.id]?.title);
  if (stillMissing.length === 0) return merged;

  const apiKey = resolveAnthropicKey();
  if (!apiKey) return merged;

  for (let i = 0; i < stillMissing.length; i += CHUNK_SIZE) {
    const chunk = stillMissing.slice(i, i + CHUNK_SIZE);
    const part = await translateChunk(chunk);
    Object.assign(merged, part);
  }
  writeSeedCache(merged);
  return merged;
}

export function loadJapaneseSeedUiFromSession(): Record<string, UiJapaneseFields> {
  return readSeedCache() || {};
}

/** News / sentiment article rows (small batches, session-cached per batch hash). */
export async function translateJapaneseArticleRows(
  items: Array<{ id: string; title: string; description: string }>,
): Promise<Record<string, { title: string; description: string }>> {
  if (items.length === 0) return {};
  const apiKey = resolveAnthropicKey();
  if (!apiKey) return {};

  const cacheKey = `rr.jp.news.${simpleHash(JSON.stringify(items.map((i) => [i.id, i.title])))}`;
  if (typeof sessionStorage !== "undefined") {
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { map?: Record<string, { title: string; description: string }> };
        if (parsed?.map) return parsed.map;
      }
    } catch {
      /* ignore */
    }
  }

  const prompt = `各ニュース項目の title と description を自然な日本語に翻訳してください。id は変更しないこと。JSONオブジェクトのみを返す形式:
{ "<id>": { "title": "...", "description": "..." }, ... }

入力:
${JSON.stringify(items)}`;

  const text = await anthropicUserMessage(prompt, 4096);
  const parsed = parseTranslationObject(text);
  if (!parsed) return {};

  const out: Record<string, { title: string; description: string }> = {};
  for (const [id, row] of Object.entries(parsed)) {
    out[id] = { title: row.title, description: row.description };
  }

  if (typeof sessionStorage !== "undefined") {
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), map: out }));
    } catch {
      /* ignore */
    }
  }
  return out;
}
