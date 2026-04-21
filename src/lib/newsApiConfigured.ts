/** True when NewsAPI.ai (Event Registry) is configured — demo/seed data should not replace failed API responses. */
export function isNewsApiAiConfigured(): boolean {
  return Boolean(import.meta.env.VITE_NEWSAPI_AI_KEY?.trim());
}
