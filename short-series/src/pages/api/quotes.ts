// short-series/src/pages/api/quotes.ts
import type { APIRoute } from 'astro';

export const prerender = false;

// In-memory cache with 15s TTL to respect upstream limits
const cache = new Map<string, { timestamp: number; payload: any }>();
const CACHE_TTL_MS = 15000;

// Curated list of premier US mega-caps & market movers
const DEFAULT_TOP_TICKERS = [
  'NVDA', 'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA', 'AMD', 'PLTR', 'SMCI', 'COIN', 'AVGO', 'NFLX', 'LLY', 'JPM'
];

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const tickersParam = url.searchParams.get('tickers');
  const isTop = url.searchParams.get('top') === 'true' || (!tickersParam && !url.searchParams.get('search'));
  const searchQuery = url.searchParams.get('search')?.trim();

  const cacheKey = searchQuery 
    ? `search:${searchQuery.toUpperCase()}` 
    : isTop 
      ? 'top_megacaps' 
      : `tickers:${tickersParam?.toUpperCase()}`;

  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return new Response(JSON.stringify(cached.payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=15, stale-while-revalidate=30'
      }
    });
  }

  const columns = [
    'name',
    'description',
    'close',
    'change',
    'change_abs',
    'volume',
    'relative_volume_10d_calc',
    'market_cap_basic',
    'high',
    'low',
    'VWAP',
    'sector'
  ];

  try {
    let bodyPayload: any;

    if (searchQuery) {
      const cleanSearch = searchQuery.toUpperCase().replace(/[^A-Z0-9]/g, '');
      bodyPayload = {
        filter: [
          { left: 'type', operation: 'in_range', right: ['stock', 'dr'] },
          { left: 'name', operation: 'match', right: cleanSearch }
        ],
        columns,
        sort: { sortBy: 'market_cap_basic', sortOrder: 'desc' },
        range: [0, 8]
      };
    } else if (isTop) {
      bodyPayload = {
        filter: [
          { left: 'name', operation: 'in_range', right: DEFAULT_TOP_TICKERS }
        ],
        columns,
        sort: { sortBy: 'market_cap_basic', sortOrder: 'desc' },
        range: [0, 20]
      };
    } else {
      const symbols = (tickersParam || '')
        .split(',')
        .map(s => s.trim().toUpperCase().replace(/[^A-Z0-9.]/g, ''))
        .filter(Boolean);

      if (symbols.length === 0) {
        return new Response(JSON.stringify({ success: true, count: 0, data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      bodyPayload = {
        filter: [
          { left: 'name', operation: 'in_range', right: symbols }
        ],
        columns,
        sort: { sortBy: 'market_cap_basic', sortOrder: 'desc' },
        range: [0, Math.min(symbols.length + 10, 100)]
      };
    }

    const tvRes = await fetch('https://scanner.tradingview.com/america/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify(bodyPayload)
    });

    if (!tvRes.ok) {
      throw new Error(`TradingView scanner responded with status ${tvRes.status}`);
    }

    const json = await tvRes.json();
    const rows = json?.data || [];

    const data = rows.map((r: any) => {
      const d = r.d || [];
      const ticker = String(d[0] || r.s?.split(':')?.[1] || '');
      const name = String(d[1] || ticker);
      const price = typeof d[2] === 'number' ? d[2] : parseFloat(d[2]) || 0;
      const change = typeof d[3] === 'number' ? d[3] : parseFloat(d[3]) || 0;
      const changeAbs = typeof d[4] === 'number' ? d[4] : parseFloat(d[4]) || 0;
      const volume = typeof d[5] === 'number' ? d[5] : parseInt(d[5], 10) || 0;
      const rvol = typeof d[6] === 'number' ? parseFloat(d[6].toFixed(2)) : 1.0;
      const marketCap = typeof d[7] === 'number' ? d[7] : parseFloat(d[7]) || 0;
      const high = typeof d[8] === 'number' ? d[8] : price;
      const low = typeof d[9] === 'number' ? d[9] : price;
      const vwap = typeof d[10] === 'number' ? parseFloat(d[10].toFixed(2)) : price;
      const sector = String(d[11] || 'Equities');

      // Compute signal state
      let signal = 'NEUTRAL';
      if (change >= 3.5 && rvol >= 2.0) signal = 'BREAKOUT';
      else if (change >= 2.0) signal = 'MOMENTUM';
      else if (change <= -3.0 && rvol >= 1.5) signal = 'DISTRIBUTION';
      else if (change <= -1.5) signal = 'PULLBACK';
      else if (rvol >= 2.5) signal = 'VOLUME_SURGE';

      return {
        ticker,
        name,
        price,
        changePercent: change,
        changeAbs,
        volume,
        rvol,
        marketCap,
        high,
        low,
        vwap,
        sector,
        signal
      };
    });

    const payload = {
      success: true,
      count: data.length,
      timestamp: Date.now(),
      lastUpdated: new Date().toISOString(),
      data
    };

    cache.set(cacheKey, { timestamp: now, payload });

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
        error: err.message || 'Failed to fetch live quotes',
        data: []
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
