// short-series/src/pages/api/screener.ts
import type { APIRoute } from 'astro';
import { SCREENER_CONFIG, calculateMomentumScore, calculateConvictionScore } from '../../config/screenerConfig';

export const prerender = false;

// In-memory cache to respect free upstream limits
const cache = new Map<string, { timestamp: number; payload: any }>();
const CACHE_TTL_MS = 15000; // 15s server cache

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const categoryParam = (url.searchParams.get('category') || 'penny') as 'penny' | 'smallMid' | 'large';
  const categoryConfig = SCREENER_CONFIG.categories[categoryParam] || SCREENER_CONFIG.categories.penny;

  const now = Date.now();
  const cached = cache.get(categoryParam);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return new Response(JSON.stringify(cached.payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=15, stale-while-revalidate=30'
      }
    });
  }

  try {
    const filters: any[] = [
      { left: 'market_cap_basic', operation: 'nempty' },
      { left: 'type', operation: 'in_range', right: ['stock', 'dr'] },
      { left: 'subtype', operation: 'in_range', right: ['common'] }
    ];

    if (categoryConfig.priceMax !== undefined) {
      filters.push({ left: 'close', operation: 'less', right: categoryConfig.priceMax });
    }
    if (categoryConfig.priceMin !== undefined) {
      filters.push({ left: 'close', operation: 'greater', right: categoryConfig.priceMin });
    }
    if (categoryConfig.marketCapMin !== undefined) {
      filters.push({ left: 'market_cap_basic', operation: 'greater', right: categoryConfig.marketCapMin });
    }
    if (categoryConfig.marketCapMax !== undefined) {
      filters.push({ left: 'market_cap_basic', operation: 'less', right: categoryConfig.marketCapMax });
    }
    if (categoryConfig.volumeFloor !== undefined) {
      filters.push({ left: 'volume', operation: 'greater', right: categoryConfig.volumeFloor });
    }

    const columns = [
      'name',
      'description',
      'close',
      'change_abs',
      'change',
      'volume',
      'relative_volume_10d_calc',
      'market_cap_basic',
      'high',
      'low',
      'sector',
      'Recommend.All',
      'RSI'
    ];

    const tvResponse = await fetch('https://scanner.tradingview.com/america/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify({
        filter: filters,
        options: { lang: 'en' },
        symbols: { query: { types: [] }, tickers: [] },
        columns: columns,
        sort: { sortBy: 'change', sortOrder: 'desc' },
        range: [0, 60]
      })
    });

    if (!tvResponse.ok) {
      throw new Error(`TradingView scanner responded with status ${tvResponse.status}`);
    }

    const rawJson = await tvResponse.json();
    const rows = rawJson?.data || [];

    const formattedStocks = rows.map((row: any) => {
      const d = row.d || [];
      const ticker = String(d[0] || row.s?.split(':')?.[1] || '');
      const name = String(d[1] || ticker);
      const price = typeof d[2] === 'number' ? d[2] : parseFloat(d[2]) || 0;
      const changeAbs = typeof d[3] === 'number' ? d[3] : parseFloat(d[3]) || 0;
      const changePercent = typeof d[4] === 'number' ? d[4] : parseFloat(d[4]) || 0;
      const volume = typeof d[5] === 'number' ? d[5] : parseInt(d[5], 10) || 0;
      const rvol = typeof d[6] === 'number' ? parseFloat(d[6].toFixed(2)) : 1.0;
      const marketCap = typeof d[7] === 'number' ? d[7] : parseFloat(d[7]) || 0;
      const high = typeof d[8] === 'number' ? d[8] : price;
      const low = typeof d[9] === 'number' ? d[9] : price;
      const sector = String(d[10] || 'Unclassified');
      const recommendAll = typeof d[11] === 'number' ? d[11] : 0;
      const rsi = typeof d[12] === 'number' ? d[12] : 50;

      const momentumScore = calculateMomentumScore(changePercent, rvol, rsi, price, high, low);
      const { score: convictionScore, label: convictionLabel } = calculateConvictionScore(recommendAll, momentumScore);

      return {
        ticker,
        name,
        price,
        changeAbs,
        changePercent,
        volume,
        relativeVolume: rvol,
        marketCap,
        high,
        low,
        sector,
        momentumScore,
        convictionScore,
        convictionLabel,
        lastUpdatedTime: new Date().toTimeString().split(' ')[0] + ' UTC'
      };
    });

    const payload = {
      success: true,
      category: categoryParam,
      totalCount: formattedStocks.length,
      lastUpdated: new Date().toISOString(),
      timestamp: Date.now(),
      data: formattedStocks
    };

    cache.set(categoryParam, { timestamp: now, payload });

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=15, stale-while-revalidate=30'
      }
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || 'Failed to fetch screener data',
        category: categoryParam
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
