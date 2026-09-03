// short-series/src/pages/api/sectors.ts
import type { APIRoute } from 'astro';

export const prerender = false;

const SECTORS = [
  { name: 'Technology', symbol: 'XLK', ticker: 'AMEX:XLK' },
  { name: 'Communication', symbol: 'XLC', ticker: 'AMEX:XLC' },
  { name: 'Industrials', symbol: 'XLI', ticker: 'AMEX:XLI' },
  { name: 'Consumer Cyclical', symbol: 'XLY', ticker: 'AMEX:XLY' },
  { name: 'Financials', symbol: 'XLF', ticker: 'AMEX:XLF' },
  { name: 'Health Care', symbol: 'XLV', ticker: 'AMEX:XLV' },
  { name: 'Utilities', symbol: 'XLU', ticker: 'AMEX:XLU' },
  { name: 'Real Estate', symbol: 'XLRE', ticker: 'AMEX:XLRE' }
];

export const GET: APIRoute = async () => {
  try {
    const res = await fetch('https://scanner.tradingview.com/america/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: JSON.stringify({
        symbols: { tickers: SECTORS.map((s) => s.ticker) },
        columns: ['name', 'change']
      })
    });

    if (res.ok) {
      const json = await res.json();
      const rows = json?.data || [];
      const liveData = SECTORS.map((s) => {
        const item = rows.find((r: any) => r.s === s.ticker);
        const change = typeof item?.d?.[1] === 'number' ? parseFloat(item.d[1].toFixed(2)) : 0.0;
        return { name: s.name, symbol: s.symbol, change };
      });
      liveData.sort((a, b) => b.change - a.change);
      return new Response(JSON.stringify({ success: true, data: liveData, timestamp: Date.now() }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          'CDN-Cache-Control': 'no-store',
          'Vercel-CDN-Cache-Control': 'no-store'
        }
      });
    }
  } catch (err) {
    console.error('Sector API proxy failure:', err);
  }

  return new Response(JSON.stringify({ success: false }), {
    status: 500,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate'
    }
  });
};
