const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NEWSAPI_BASE = 'https://newsapi.org/v2';

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
    const { type, countryCode, countryName } = await req.json();

    if (!type || (!countryCode && !countryName)) {
      return new Response(JSON.stringify({ error: 'Missing type or country params' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let url: string;

    if (type === 'business') {
      url = `${NEWSAPI_BASE}/top-headlines?country=${countryCode}&category=business&pageSize=5&apiKey=${apiKey}`;
    } else if (type === 'genz') {
      const query = `("Gen Z" OR "TikTok trend" OR "viral" OR "youth culture" OR "sustainability") AND "${countryName}"`;
      url = `${NEWSAPI_BASE}/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&pageSize=5&language=en&apiKey=${apiKey}`;
    } else {
      return new Response(JSON.stringify({ error: 'Invalid type. Use "business" or "genz"' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
