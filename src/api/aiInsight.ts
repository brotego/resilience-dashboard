/**
 * AI insight panel — no external LLM API is called. News data uses NewsAPI.ai only (`VITE_NEWSAPI_AI_KEY`).
 */

export type AiInsightRequestBody = {
  signalTitle?: string;
  signalDescription?: string;
  signalLocation?: string;
  signalDomain?: string;
  company?: string | null;
  language?: string;
};

export type AiInsightResult = {
  urgency: string;
  headline: string;
  actions: string[];
  risks: string[];
  opportunities: string[];
  whyItMatters: string;
  genzSignal: string;
  patternTag: string;
  error?: string;
};

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
    headline: get("HEADLINE") || "",
    actions: actions.length > 0 ? actions : ["Assess strategic impact and develop response plan."],
    risks: risks.length > 0 ? risks : ["Delayed response risks competitive disadvantage."],
    opportunities: opportunities.length > 0 ? opportunities : ["First-mover positioning available."],
    whyItMatters: get("WHY_IT_MATTERS") || get("WHY IT MATTERS") || "Strategic implications for market positioning.",
    genzSignal: get("GENZ_SIGNAL") || get("GENZ SIGNAL") || "",
    patternTag: get("PATTERN_TAG") || get("PATTERN TAG") || "Emerging Signal",
  };
}

export async function invokeAiInsight(body: AiInsightRequestBody): Promise<{ data: AiInsightResult | null; error: Error | null }> {
  const jp = body.language === "jp";
  return {
    data: {
      ...parseInsight(""),
      error: jp
        ? "AIインサイトは未設定です。ニュースは NewsAPI.ai（VITE_NEWSAPI_AI_KEY）のみ使用しています。"
        : "AI insights are not connected to an LLM. This app uses NewsAPI.ai for news only (VITE_NEWSAPI_AI_KEY).",
    },
    error: null,
  };
}
