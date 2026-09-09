// short-series/src/pages/api/catalysts.ts
import type { APIRoute } from 'astro';
import { fetchFinnhubEarnings, fetchFinnhubEconomicCalendar, fetchLiveNews } from '../../utils/apiProviders';

export const prerender = false;

// In-memory cache to respect API rate limits (60-second TTL)
let cachedPayload: any = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 60000;

export const GET: APIRoute = async () => {
  const now = Date.now();
  if (cachedPayload && now - lastCacheTime < CACHE_TTL_MS) {
    return new Response(JSON.stringify(cachedPayload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=120'
      }
    });
  }

  try {
    const [earnings, economic, breakingNews] = await Promise.all([
      fetchFinnhubEarnings(7),
      fetchFinnhubEconomicCalendar(),
      fetchLiveNews(undefined, 6)
    ]);

    const payload = {
      success: true,
      timestamp: new Date().toISOString(),
      counts: {
        earnings: earnings.length,
        economic: economic.length,
        breakingNews: breakingNews.length
      },
      earnings,
      economic,
      breakingNews
    };

    cachedPayload = payload;
    lastCacheTime = now;

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=120'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to aggregate live catalyst telemetry',
      details: (error as Error).message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
