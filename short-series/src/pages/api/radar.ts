// short-series/src/pages/api/radar.ts
import type { APIRoute } from 'astro';

export const prerender = false;

// In-memory cache to respect upstream limits
let cachedPayload: any = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 15000; // 15 seconds

export const GET: APIRoute = async () => {
  const now = Date.now();
  if (cachedPayload && now - lastCacheTime < CACHE_TTL_MS) {
    return new Response(JSON.stringify(cachedPayload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=15, stale-while-revalidate=30'
      }
    });
  }

  try {
    // 1. Fetch SPY & QQQ indices for Macro Regime
    const indexPromise = fetch('https://scanner.tradingview.com/america/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify({
        symbols: { tickers: ['AMEX:SPY', 'NASDAQ:QQQ'] },
        columns: ['name', 'close', 'change', 'volume']
      })
    }).then(r => r.ok ? r.json() : null).catch(() => null);

    // 2. Fetch Top Momentum & RVOL Runners
    const runnersPromise = fetch('https://scanner.tradingview.com/america/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify({
        filter: [
          { left: 'volume', operation: 'greater', right: 300000 },
          { left: 'close', operation: 'greater', right: 1.0 },
          { left: 'change', operation: 'greater', right: 3.0 }
        ],
        columns: [
          'name',
          'description',
          'close',
          'change',
          'volume',
          'relative_volume_10d_calc',
          'market_cap_basic',
          'VWAP',
          'sector'
        ],
        sort: { sortBy: 'relative_volume_10d_calc', sortOrder: 'desc' },
        range: [0, 20]
      })
    }).then(r => r.ok ? r.json() : null).catch(() => null);

    // 3. Fetch Mega-Cap Leader
    const megaCapPromise = fetch('https://scanner.tradingview.com/america/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify({
        filter: [
          { left: 'market_cap_basic', operation: 'greater', right: 200000000000 }
        ],
        columns: [
          'name',
          'description',
          'close',
          'change',
          'volume',
          'relative_volume_10d_calc',
          'market_cap_basic'
        ],
        sort: { sortBy: 'volume', sortOrder: 'desc' },
        range: [0, 5]
      })
    }).then(r => r.ok ? r.json() : null).catch(() => null);

    const [indexData, runnersData, megaCapData] = await Promise.all([
      indexPromise,
      runnersPromise,
      megaCapPromise
    ]);

    // Parse Index / Macro Regime
    const indexRows = indexData?.data || [];
    const spyRow = indexRows.find((r: any) => r.s === 'AMEX:SPY' || r.d?.[0] === 'SPY');
    const qqqRow = indexRows.find((r: any) => r.s === 'NASDAQ:QQQ' || r.d?.[0] === 'QQQ');

    const spyDelta = typeof spyRow?.d?.[2] === 'number' ? spyRow.d[2] : 0.0;
    const qqqDelta = typeof qqqRow?.d?.[2] === 'number' ? qqqRow.d[2] : 0.0;

    let regime = 'ROTATION';
    let regimeLabel = 'SELECTIVE ROTATION';
    if (spyDelta > 0.3 && qqqDelta > 0.3) {
      regime = 'RISK-ON';
      regimeLabel = 'RISK-ON';
    } else if (spyDelta < -0.35 && qqqDelta < -0.35) {
      regime = 'RISK-OFF';
      regimeLabel = 'RISK-OFF';
    }

    // Parse Runners
    const runnerRows = (runnersData?.data || []).map((r: any) => {
      const d = r.d || [];
      return {
        ticker: String(d[0] || r.s?.split(':')?.[1] || ''),
        name: String(d[1] || d[0]),
        price: typeof d[2] === 'number' ? d[2] : parseFloat(d[2]) || 0,
        change: typeof d[3] === 'number' ? d[3] : parseFloat(d[3]) || 0,
        volume: typeof d[4] === 'number' ? d[4] : parseInt(d[4], 10) || 0,
        rvol: typeof d[5] === 'number' ? parseFloat(d[5].toFixed(2)) : 1.0,
        marketCap: typeof d[6] === 'number' ? d[6] : parseFloat(d[6]) || 0,
        vwap: typeof d[7] === 'number' ? parseFloat(d[7].toFixed(2)) : 0,
        sector: String(d[8] || 'Equities')
      };
    });

    // 1. Top Setup: Best blend of RVOL and Change
    const topSetup = runnerRows.find(r => r.rvol >= 2.5 && r.price >= 1.5) || runnerRows[0] || {
      ticker: 'NVDA',
      name: 'NVIDIA Corp',
      price: 223.82,
      change: -0.85,
      rvol: 1.2,
      convictionScore: 92
    };

    const convictionScore = Math.min(98, Math.max(78, Math.round(70 + (topSetup.rvol * 2.5) + (topSetup.change * 0.4))));

    // 2. Breakout Surges (Top 3 by RVOL)
    const breakoutSurges = runnerRows
      .filter(r => r.change > 0 && r.rvol >= 2.0 && r.ticker !== topSetup.ticker)
      .slice(0, 3);

    // 3. Reversal / Fade Risks: runners trading below VWAP or pullback
    const reversalRisks = runnerRows
      .filter(r => r.vwap > 0 && r.price < r.vwap && r.change > 5.0)
      .slice(0, 2)
      .map(r => ({
        ticker: r.ticker,
        price: r.price,
        change: r.change,
        vwapDiff: parseFloat(((r.price - r.vwap) / r.vwap * 100).toFixed(1))
      }));

    // 4. Large-Cap Anchor
    const megaRows = (megaCapData?.data || []).map((r: any) => {
      const d = r.d || [];
      return {
        ticker: String(d[0] || r.s?.split(':')?.[1] || ''),
        name: String(d[1] || d[0]),
        price: typeof d[2] === 'number' ? d[2] : parseFloat(d[2]) || 0,
        change: typeof d[3] === 'number' ? d[3] : parseFloat(d[3]) || 0,
        volume: typeof d[4] === 'number' ? d[4] : parseInt(d[4], 10) || 0,
        marketCap: typeof d[6] === 'number' ? d[6] : 0
      };
    });

    const largeCapAnchor = megaRows[0] || {
      ticker: 'NVDA',
      name: 'NVIDIA Corp',
      price: 223.82,
      change: -0.85,
      marketCap: 5394061897905
    };

    const payload = {
      success: true,
      timestamp: Date.now(),
      lastUpdated: new Date().toISOString(),
      macroRegime: {
        regime,
        label: regimeLabel,
        spy: { ticker: 'SPY', change: spyDelta },
        qqq: { ticker: 'QQQ', change: qqqDelta }
      },
      topSetup: {
        ticker: topSetup.ticker,
        name: topSetup.name,
        price: topSetup.price,
        change: topSetup.change,
        rvol: topSetup.rvol,
        convictionScore
      },
      breakoutSurges,
      reversalRisks: reversalRisks.length > 0 ? reversalRisks : [
        { ticker: 'SPY/QQQ', price: 0, change: 0, vwapDiff: 0, status: 'Clean Trend Holds' }
      ],
      largeCapAnchor
    };

    cachedPayload = payload;
    lastCacheTime = now;

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
        error: err.message || 'Failed to generate radar metrics'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
