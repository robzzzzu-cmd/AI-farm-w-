import type { APIRoute } from 'astro';

export const prerender = false;

export interface StockItem {
  ticker: string;
  name: string;
  price: number;
  change: number;
  volume: number;
}

const cache: Record<string, { timestamp: number; data: StockItem[] }> = {};
const CACHE_DURATION_MS = 8000; // 8-second caching to ensure instant response & eliminate rate limits

async function queryTradingView(filter: any[], range: [number, number] = [0, 50]): Promise<StockItem[]> {
  const payload = {
    filter,
    options: { lang: 'en' },
    symbols: { query: { types: [] }, tickers: [] },
    columns: ['name', 'close', 'change', 'volume', 'description'],
    sort: { sortBy: 'change', sortOrder: 'desc' },
    range
  };

  const res = await fetch('https://scanner.tradingview.com/america/scan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error(`TradingView API returned status ${res.status}`);
  }

  const json = await res.json();
  const rows = json?.data || [];

  return rows.map((r: any) => ({
    ticker: r.s ? r.s.split(':').pop() : (r.d?.[0] || ''),
    price: typeof r.d?.[1] === 'number' ? parseFloat(r.d[1].toFixed(2)) : 0,
    change: typeof r.d?.[2] === 'number' ? parseFloat(r.d[2].toFixed(2)) : 0,
    volume: typeof r.d?.[3] === 'number' ? r.d[3] : 0,
    name: r.d?.[4] || r.s || ''
  }));
}

export const GET: APIRoute = async ({ url }) => {
  const query = url.searchParams.get('q')?.trim() || '';
  const tier = url.searchParams.get('tier') || 'all';

  // 1. Search Mode (Any stock ticker or company name)
  if (query.length > 0) {
    try {
      const sanitized = query.toUpperCase();
      const searchFilter = [
        { left: 'name', operation: 'match', right: sanitized }
      ];
      const items = await queryTradingView(searchFilter, [0, 40]);
      return new Response(JSON.stringify({ success: true, items, mode: 'search' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // 2. Multi-Tier Feed Mode with In-Memory Caching
  const now = Date.now();
  if (cache[tier] && (now - cache[tier].timestamp < CACHE_DURATION_MS)) {
    return new Response(JSON.stringify({ success: true, items: cache[tier].data, cached: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=8, stale-while-revalidate=15'
      }
    });
  }

  try {
    let filter: any[] = [];

    if (tier === 'penny') {
      // Penny Equities: Under $5.00, volume floor 100k
      filter = [
        { left: 'volume', operation: 'greater', right: 100000 },
        { left: 'close', operation: 'in_range', right: [0.01, 5.0] }
      ];
    } else if (tier === 'mid') {
      // Mid-Tier Momentum: $5.00 to $50.00, volume floor 150k
      filter = [
        { left: 'volume', operation: 'greater', right: 150000 },
        { left: 'close', operation: 'in_range', right: [5.0, 50.0] }
      ];
    } else if (tier === 'high') {
      // Large-Cap / High-Value: Above $50.00, volume floor 250k
      filter = [
        { left: 'volume', operation: 'greater', right: 250000 },
        { left: 'close', operation: 'greater', right: 50.0 }
      ];
    } else {
      // Default: Top active US gainers
      filter = [
        { left: 'volume', operation: 'greater', right: 150000 },
        { left: 'change', operation: 'greater', right: 0 }
      ];
    }

    const items = await queryTradingView(filter, [0, 50]);
    cache[tier] = { timestamp: now, data: items };

    return new Response(JSON.stringify({ success: true, items }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=8, stale-while-revalidate=15'
      }
    });
  } catch (err: any) {
    if (cache[tier]) {
      return new Response(JSON.stringify({ success: true, items: cache[tier].data, fallback: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
