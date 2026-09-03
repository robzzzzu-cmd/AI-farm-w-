import type { APIRoute } from 'astro';

export const prerender = false;

interface ScreenerItem {
  ticker: string;
  name: string;
  price: number;
  change: number;
  volume: number;
}

// In-memory server cache (15 seconds) to avoid redundant upstream calls
let cachedData: { timestamp: number; data: Record<string, ScreenerItem[]> } | null = null;
const CACHE_TTL = 15000;

async function fetchTier(minPrice: number, maxPrice: number | null, minVol: number): Promise<ScreenerItem[]> {
  const filter: any[] = [
    { left: 'volume', operation: 'greater', right: minVol },
    { left: 'change', operation: 'greater', right: -90 }
  ];

  if (maxPrice !== null) {
    filter.push({ left: 'close', operation: 'in_range', right: [minPrice, maxPrice] });
  } else {
    filter.push({ left: 'close', operation: 'greater', right: minPrice });
  }

  const res = await fetch('https://scanner.tradingview.com/america/scan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    },
    body: JSON.stringify({
      filter,
      options: { lang: 'en' },
      symbols: { query: { types: [] }, tickers: [] },
      columns: ['name', 'close', 'change', 'volume', 'description'],
      sort: { sortBy: 'change', sortOrder: 'desc' },
      range: [0, 40]
    })
  });

  if (!res.ok) {
    throw new Error(`TradingView Scan failed with HTTP ${res.status}`);
  }

  const json = await res.json();
  const rows = json?.data || [];

  return rows.map((r: any) => ({
    ticker: r.s ? r.s.split(':').pop() : (r.d?.[0] || ''),
    name: r.d?.[4] || r.s || '',
    price: typeof r.d?.[1] === 'number' ? parseFloat(r.d[1].toFixed(2)) : 0,
    change: typeof r.d?.[2] === 'number' ? parseFloat(r.d[2].toFixed(2)) : 0,
    volume: typeof r.d?.[3] === 'number' ? r.d[3] : 0
  }));
}

export const GET: APIRoute = async () => {
  const now = Date.now();
  if (cachedData && (now - cachedData.timestamp < CACHE_TTL)) {
    return new Response(JSON.stringify({ success: true, tiers: cachedData.data, cached: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30'
      }
    });
  }

  try {
    const [penny, mid, high] = await Promise.all([
      fetchTier(0.01, 5.0, 100000),     // Penny Stocks: < $5
      fetchTier(5.0, 50.0, 150000),      // Mid-Tier: $5 - $50
      fetchTier(50.0, null, 250000)      // Large-Cap / High: $50+
    ]);

    const result = { penny, mid, high };
    cachedData = { timestamp: now, data: result };

    return new Response(JSON.stringify({ success: true, tiers: result }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30'
      }
    });
  } catch (err: any) {
    if (cachedData) {
      return new Response(JSON.stringify({ success: true, tiers: cachedData.data, stale: true }), {
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
