const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NEWSAPI_BASE = 'https://newsapi.org/v2';

const DOMAIN_KEYWORDS: Record<string, string> = {
  work: '"workforce" OR "remote work" OR "employment" OR "labor market" OR "AI jobs" OR "future of work"',
  selfhood: '"mental health" OR "wellness" OR "personal development" OR "identity crisis" OR "self-care"',
  community: '"community building" OR "social infrastructure" OR "mutual aid" OR "civic engagement" OR "volunteer"',
  aging: '"aging population" OR "eldercare" OR "longevity" OR "retirement" OR "senior care" OR "dementia"',
  environment: '"climate change" OR "renewable energy" OR "sustainability" OR "carbon emissions" OR "green energy"',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const apiKey = Deno.env.get('NEWS_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'NEWS_API_KEY not configured', fallback: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { type, countryCode, countryName, domain, pageSize } = await req.json();

    if (!type) {
      return new Response(JSON.stringify({ error: 'Missing type param' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let url: string;
    const size = pageSize || 5;

    if (type === 'business') {
      if (!countryCode) {
        return new Response(JSON.stringify({ error: 'Missing countryCode' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      url = `${NEWSAPI_BASE}/top-headlines?country=${countryCode}&category=business&pageSize=${size}&apiKey=${apiKey}`;
    } else if (type === 'genz') {
      const query = `("Gen Z" OR "TikTok trend" OR "viral" OR "youth culture" OR "sustainability") AND "${countryName}"`;
      url = `${NEWSAPI_BASE}/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&pageSize=${size}&language=en&apiKey=${apiKey}`;
    } else if (type === 'domain') {
      const keywords = DOMAIN_KEYWORDS[domain];
      if (!keywords) {
        return new Response(JSON.stringify({ error: `Unknown domain: ${domain}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // Use everything endpoint with domain keywords, optionally scoped to country
      const countryFilter = countryName ? ` AND "${countryName}"` : '';
      const query = `(${keywords})${countryFilter}`;
      url = `${NEWSAPI_BASE}/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&pageSize=${size}&language=en&apiKey=${apiKey}`;
    } else {
      return new Response(JSON.stringify({ error: 'Invalid type' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      console.error('NewsAPI error:', data);
      return new Response(JSON.stringify({ error: `NewsAPI error [${response.status}]`, details: data, fallback: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const articles = (data.articles || []).map((a: any) => ({
      title: a.title,
      source: a.source?.name || 'Unknown',
      date: a.publishedAt,
      description: a.description || '',
      url: a.url,
    }));

    return new Response(JSON.stringify({ articles }), {
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
