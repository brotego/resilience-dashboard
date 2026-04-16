const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BASE = 'https://api.thenewsapi.com/v1/news/top';

const DOMAIN_KEYWORDS: Record<string, string> = {
  work: 'workforce | "remote work" | employment | "labor market" | "AI jobs" | "future of work"',
  selfhood: '"mental health" | wellness | "personal development" | "identity" | "self-care"',
  community: '"community building" | "social infrastructure" | "mutual aid" | "civic engagement"',
  aging: '"aging population" | eldercare | longevity | retirement | "senior care"',
  environment: '"climate change" | "renewable energy" | sustainability | "carbon emissions" | "green energy"',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const apiToken = Deno.env.get('THENEWSAPI_KEY');
  if (!apiToken) {
    return new Response(JSON.stringify({ error: 'THENEWSAPI_KEY not configured', fallback: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { type, countryCode, countryName, domain, pageSize, language } = await req.json();

    if (!type) {
      return new Response(JSON.stringify({ error: 'Missing type param' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const limit = pageSize || 5;
    const lang = language || 'en';
    const params = new URLSearchParams({
      api_token: apiToken,
      language: lang,
      limit: String(limit),
    });

    if (type === 'business') {
      if (countryCode) {
        params.set('locale', countryCode.toLowerCase());
      }
      params.set('categories', 'business');
    } else if (type === 'genz') {
      const search = `"Gen Z" | "TikTok" | "viral" | "youth culture" | "sustainability"`;
      params.set('search', search);
      if (countryCode) {
        params.set('locale', countryCode.toLowerCase());
      }
    } else if (type === 'domain') {
      const keywords = DOMAIN_KEYWORDS[domain];
      if (!keywords) {
        return new Response(JSON.stringify({ error: `Unknown domain: ${domain}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      params.set('search', keywords);
      if (countryCode) {
        params.set('locale', countryCode.toLowerCase());
      }
    } else if (type === 'all') {
      // Fetch top stories globally or by locale
      if (countryCode) {
        params.set('locale', countryCode.toLowerCase());
      }
    } else {
      return new Response(JSON.stringify({ error: 'Invalid type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = `${BASE}?${params.toString()}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || data.error) {
      console.error('TheNewsAPI error:', data);
      return new Response(JSON.stringify({ error: `TheNewsAPI error [${response.status}]`, details: data, fallback: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const articles = (data.data || []).map((a: any) => ({
      title: a.title,
      source: a.source || 'Unknown',
      date: a.published_at,
      description: a.description || '',
      snippet: a.snippet || '',
      url: a.url,
      imageUrl: a.image_url || null,
      categories: a.categories || [],
      locale: a.locale || null,
    }));

    return new Response(JSON.stringify({ articles, meta: data.meta || null }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Edge function error:', err);
    return new Response(JSON.stringify({ error: 'Internal error', fallback: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
