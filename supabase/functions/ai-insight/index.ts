import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DOMAIN_LABELS: Record<string, string> = {
  work: "Work & Workforce Transformation",
  selfhood: "Selfhood, Identity & Mental Health",
  community: "Community Rebuilding & Social Infrastructure",
  aging: "Aging Population & Longevity Economy",
  environment: "Environment, Climate & Sustainability",
};

const MINDSET_LABELS: Record<string, string> = {
  cracks: "Finding Advantage in Cracks",
  reinvention: "Existential Reinvention",
  redefining: "Redefining Normal",
  collective: "Enabling Collective Growth",
};

const GENZ_CATEGORY_LABELS: Record<string, string> = {
  authenticity: "Brand Authenticity & Transparency",
  worklife: "Work-Life Integration & Anti-Hustle",
  climate: "Climate Action & Conscious Consumption",
  digital: "Digital Identity & Creator Economy",
  belonging: "Community & Belonging",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const mode = body.mode || "resilience";
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let systemPrompt: string;
    let userPrompt: string;

    if (mode === "genz") {
      const categories = (body.categories as string[] || [])
        .map((c) => GENZ_CATEGORY_LABELS[c] || c)
        .join(", ");

      systemPrompt = `You are a senior strategy analyst for Anchorstar Consulting, specializing in Gen Z consumer behavior and its implications for Japanese business leaders. You are briefing CEOs of major Japanese corporations (Kodansha, PERSOL, NTT East, Kikkoman, Kirin, Nintendo) as part of the Mori Building 49F executive education program in Tokyo.

Your framework focuses on where Gen Z consumer demand for resilience-oriented products and experiences is strongest globally, and what this means for Japanese companies.

Write in an executive tone: direct, data-grounded, authoritative. No fluff. Reference specific companies, markets, or data points when possible.`;

      userPrompt = `Generate a 150-word executive insight brief analyzing Gen Z consumer signals through these categories:

Categories: ${categories}

Structure:
1. What Gen Z is demanding globally in these categories right now (2-3 sentences with specific data or examples)
2. Where the strongest signals are emerging and why (2-3 sentences referencing specific markets)
3. What this means specifically for Japanese business leaders — actionable, specific, connected to Japanese brands and market dynamics (2-3 sentences)

Be specific. Name countries, companies, figures. This is for CEOs who will challenge vague thinking.`;
    } else {
      const { domains, mindset } = body;
      const domainNames = (domains as string[])
        .map((d) => DOMAIN_LABELS[d] || d)
        .join(", ");
      const mindsetName = MINDSET_LABELS[mindset] || mindset;

      systemPrompt = `You are a senior strategy analyst for Anchorstar Consulting, specializing in global resilience trends and their implications for Japanese business leaders. You are briefing CEOs of major Japanese corporations (Kodansha, PERSOL, NTT East, Kikkoman, Kirin, Nintendo) as part of the Mori Building 49F executive education program in Tokyo.

Your framework is "Flourishing Through Resilience" — resilience is not just surviving disruption but actively growing and innovating through it (anchored in the WEF definition).

Write in an executive tone: direct, data-grounded, authoritative. No fluff. No generic statements. Every sentence should earn its place. Reference specific companies, markets, or data points when possible.`;

      userPrompt = `Generate a 150-word executive insight brief analyzing global resilience signals through these lenses:

Domains: ${domainNames}
Mindset: ${mindsetName}

Structure:
1. What is happening globally right now through these domains (2-3 sentences with specific data or examples)
2. How the "${mindsetName}" mindset reveals opportunities others are missing (2-3 sentences)
3. What this means specifically for Japanese business leaders in the room — actionable, specific, connected to Japanese market dynamics (2-3 sentences)

Be specific. Name countries, companies, figures. This is for CEOs who will challenge vague thinking.`;
    }

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
          JSON.stringify({ error: "AI usage credits depleted. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", status, text);
      throw new Error(`AI gateway returned ${status}`);
    }

    const data = await response.json();
    const insight = data.choices?.[0]?.message?.content || "Unable to generate insight.";

    return new Response(JSON.stringify({ insight }), {
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
