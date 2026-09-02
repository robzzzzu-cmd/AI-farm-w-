cat << 'EOF' > src/pages/api/sectors.ts
import type { APIRoute } from 'astro';

export const prerender = false;

const SECTOR_SYMBOLS = [
  { name: 'Technology', ticker: 'AMEX:XLK' },
  { name: 'Communication', ticker: 'AMEX:XLC' },
  { name: 'Industrials', ticker: 'AMEX:XLI' },
  { name: 'Consumer Cyclical', ticker: 'AMEX:XLY' },
  { name: 'Financials', ticker: 'AMEX:XLF' },
  { name: 'Health Care', ticker: 'AMEX:XLV' },
  { name: 'Utilities', ticker: 'AMEX:XLU' },
  { name: 'Real Estate', ticker: 'AMEX:XLRE' }
];

export const GET: APIRoute = async () => {
  try {
    const payload = {
      symbols: {
        tickers: SECTOR_SYMBOLS.map((s) => s.ticker)
      },
      columns: ['name', 'change']
    };

    const res = await fetch('https://scanner.tradingview.com/america/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`TradingView scanner returned HTTP ${res.status}`);
    }

    const json = await res.json();
    const rows = json?.data || [];

    const liveData = SECTOR_SYMBOLS.map((item) => {
      const match = rows.find((r: any) => r.s === item.ticker);
      // TradingView returns positional data matching the requested columns: ['name', 'change']
      const changeVal = match?.d?.[1];

      return {
        name: item.name,
        symbol: item.ticker.replace('AMEX:', ''),
        change: typeof changeVal === 'number' ? parseFloat(changeVal.toFixed(2)) : 0.0
      };
    });

    liveData.sort((a, b) => b.change - a.change);

    return new Response(JSON.stringify({ success: true, data: liveData }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30'
      }
    });
  } catch (err: any) {
    console.error('TradingView sector fetch failed:', err?.message || err);

    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Failed to retrieve live metrics' }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
EOF
