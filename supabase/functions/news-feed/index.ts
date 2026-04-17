const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const THENEWSAPI_BASE = 'https://api.thenewsapi.com/v1/news';
const STANDARD_PLAN_MAX_LIMIT = 100;
const DEFAULT_ARTICLE_LIMIT = 5;

const DOMAIN_KEYWORDS: Record<string, string> = {
  work: '("workforce" | "remote work" | employment | "labor market" | "AI jobs" | "future of work")',
  selfhood: '("mental health" | wellness | "personal development" | "identity crisis" | "self-care")',
  community: '("community building" | "social infrastructure" | "mutual aid" | "civic engagement" | volunteer)',
  aging: '("aging population" | eldercare | longevity | retirement | "senior care" | dementia)',
  environment: '("climate change" | "renewable energy" | sustainability | "carbon emissions" | "green energy")',
};

function buildUrl(path: string, params: Record<string, string>) {
  const url = new URL(`${THENEWSAPI_BASE}/${path}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return url.toString();
}

function normalizeArticles(payload: unknown) {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload.map((article: any) => ({
    title: article.title,
    source: article.source || 'Unknown',
    date: article.published_at,
    description: article.description || '',
    content: article.snippet || article.description || '',
    url: article.url,
  }));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const apiKey = Deno.env.get('THENEWSAPI_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'THENEWSAPI_KEY not configured', fallback: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { type, countryCode, countryName, domain, pageSize, page, topicQuery } = await req.json();

    if (!type) {
      return new Response(JSON.stringify({ error: 'Missing type param' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let url: string;
    const requestedSize = Number(pageSize);
    const size = Number.isFinite(requestedSize)
      ? Math.min(Math.max(Math.trunc(requestedSize), 1), STANDARD_PLAN_MAX_LIMIT)
      : DEFAULT_ARTICLE_LIMIT;
    const requestedPage = Number(page);
    const currentPage = Number.isFinite(requestedPage)
      ? Math.max(Math.trunc(requestedPage), 1)
      : 1;
    const locale = countryCode || 'us';

    if (type === 'business') {
      if (!countryCode) {
        return new Response(JSON.stringify({ error: 'Missing countryCode' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      url = buildUrl('top', {
        api_token: apiKey,
        locale,
        language: 'en',
        categories: 'business',
        limit: String(size),
        page: String(currentPage),
      });
    } else if (type === 'genz') {
      const query = '("Gen Z" | "TikTok trend" | viral | "youth culture" | sustainability)';
      url = buildUrl('all', {
        api_token: apiKey,
        locale,
        language: 'en',
        search: countryName ? `${query} + "${countryName}"` : query,
        search_fields: 'title,description,keywords',
        sort: 'published_at',
        limit: String(size),
        page: String(currentPage),
      });
    } else if (type === 'domain') {
      const keywords = DOMAIN_KEYWORDS[domain];
      if (!keywords) {
        return new Response(JSON.stringify({ error: `Unknown domain: ${domain}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const countryFilter = countryName ? ` + "${countryName}"` : '';
      const query = `(${keywords})${countryFilter}`;
      url = buildUrl('all', {
        api_token: apiKey,
        locale,
        language: 'en',
        search: query,
        search_fields: 'title,description,keywords',
        sort: 'published_at',
        limit: String(size),
        page: String(currentPage),
      });
    } else if (type === 'sentiment') {
      if (!topicQuery || typeof topicQuery !== 'string') {
        return new Response(JSON.stringify({ error: 'Missing topicQuery' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      url = buildUrl('all', {
        api_token: apiKey,
        locale,
        language: 'en',
        search: countryName ? `(${topicQuery}) + "${countryName}"` : `(${topicQuery})`,
        search_fields: 'title,description,keywords',
        sort: 'published_at',
        limit: String(size),
        page: String(currentPage),
      });
    } else {
      return new Response(JSON.stringify({ error: 'Invalid type' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      console.error('TheNewsAPI error:', data);
      return new Response(JSON.stringify({ error: `TheNewsAPI error [${response.status}]`, details: data, fallback: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const articles = normalizeArticles(data.data);

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
