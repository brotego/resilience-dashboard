import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const COMPANY_INFO: Record<string, { name: string; sector: string; context: string }> = {
  kodansha: { name: "Kodansha", sector: "Publishing & Media", context: "Japan's largest publisher — manga, digital media, IP licensing." },
  persol: { name: "PERSOL", sector: "HR & Workforce Solutions", context: "Leading HR and staffing group — workforce transformation, talent platforms." },
  ntt_east: { name: "NTT East", sector: "Telecommunications & Infrastructure", context: "Regional telecom giant — digital infrastructure, smart cities, rural connectivity." },
  kikkoman: { name: "Kikkoman", sector: "Food & Beverage", context: "Global soy sauce & food company with 300+ year heritage, sustainability leader." },
  kirin: { name: "Kirin", sector: "Beverages & Health Sciences", context: "Beverage conglomerate expanding into health sciences and functional foods." },
  nintendo: { name: "Nintendo", sector: "Gaming & Entertainment", context: "Global gaming powerhouse — community building through play, cognitive health." },
  mori_building: { name: "Mori Building", sector: "Real Estate & Urban Development", context: "Tokyo-based urban developer — Roppongi Hills, Toranomon Hills, Azabudai Hills." },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Support the new "signal" mode — generate insight for a specific news article
    const signalTitle = body.signalTitle || "";
    const signalDescription = body.signalDescription || "";
    const signalLocation = body.signalLocation || "";
    const signalDomain = body.signalDomain || "";
    const companyId = body.company || null;

    const companyInfo = companyId ? COMPANY_INFO[companyId] : null;

    const companyInstruction = companyInfo
      ? `You are briefing the CEO of ${companyInfo.name} (${companyInfo.sector}). ${companyInfo.context}\nFrame every recommendation and risk specifically for ${companyInfo.name}.`
      : `You are briefing a general executive audience. Frame recommendations and risks for any large enterprise that might be affected.`;

    const systemPrompt = `You are a senior strategy analyst at Anchorstar Consulting. You produce razor-sharp intelligence briefs from live news. No fluff. Solution-first. These executives have 30 seconds.

${companyInstruction}

OUTPUT FORMAT — use EXACTLY these labels, each on its own line:

URGENCY: high, medium, or low
HEADLINE: One sentence (max 15 words) summarizing what happened
ACTIONS:
1 First recommended action (one concrete sentence)
2 Second recommended action (one concrete sentence)
3 Third recommended action (one concrete sentence)
RISKS:
First risk (one sentence)
Second risk (one sentence)
OPPORTUNITIES:
First opportunity (one sentence)
Second opportunity (one sentence)
WHY_IT_MATTERS: ${companyInfo ? `2 sentences on why this matters for ${companyInfo.name} specifically` : "2 sentences on why this matters for business leaders"}
GENZ_SIGNAL: 1 sentence on how Gen Z relates to this
PATTERN_TAG: One label (e.g. Structural Shift, Early Warning, Accelerating Trend, Strategic Opportunity)

Rules:
- No asterisks, no markdown, no bold. Plain text only.
- Be specific: name companies, cite numbers, reference real markets.
- ALWAYS provide exactly 3 numbered action items under ACTIONS. Never fewer.
- ALWAYS provide exactly 2 items under RISKS and 2 under OPPORTUNITIES. Never fewer.
- Under 200 words total.
- Sound like McKinsey, not an AI.`;

    const userPrompt = `Analyze this live news signal and produce an intelligence brief:

Title: ${signalTitle}
Description: ${signalDescription}
Location: ${signalLocation}
Domain: ${signalDomain}`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      }
    );

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please wait a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "AI usage credits depleted." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", status, text);
      throw new Error(`AI gateway returned ${status}`);
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "";

    // Parse the labeled output into structured JSON
    const parsed = parseInsight(raw);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-insight error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function parseInsight(raw: string) {
  const get = (label: string): string => {
    const re = new RegExp(`^${label}:\\s*(.+)`, "mi");
    const m = raw.match(re);
    return m ? m[1].trim() : "";
  };

  const getBlock = (label: string): string[] => {
    // Match block: label followed by lines until next LABEL: or end
    // Try multiline block first
    const re = new RegExp(`${label}:\\s*\\n([\\s\\S]*?)(?=\\n[A-Z_]+:|$)`, "m");
    const m = raw.match(re);
    if (m && m[1] && m[1].trim().length > 0) {
      return m[1]
        .split("\n")
        .map((l: string) => l.replace(/^\d+[\.\):\s]*/, "").trim())
        .filter((l: string) => l.length > 0);
    }
    // Fallback: try inline after label (sometimes AI puts everything on one line or uses semicolons)
    const inlineRe = new RegExp(`${label}:\\s*(.+)`, "mi");
    const im = raw.match(inlineRe);
    if (im && im[1]) {
      // Split by numbered patterns like "1." "2." "3." or semicolons
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
