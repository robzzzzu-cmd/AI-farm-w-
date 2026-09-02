// short-series/src/pages/api/sectors.ts
import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async () => {
  const sectors = [
    { name: "Technology", symbol: "XLK", baseline: 1.32 },
    { name: "Communication", symbol: "XLC", baseline: 0.89 },
    { name: "Industrials", symbol: "XLI", baseline: 0.56 },
    { name: "Consumer Cyclical", symbol: "XLY", baseline: 0.41 },
    { name: "Financials", symbol: "XLF", baseline: 0.21 },
    { name: "Health Care", symbol: "XLV", baseline: -0.18 },
    { name: "Utilities", symbol: "XLU", baseline: -0.32 },
    { name: "Real Estate", symbol: "XLRE", baseline: -0.41 }
  ];

  try {
    const symbols = sectors.map((s) => s.symbol).join(',');
    const res = await fetch(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });

    if (res.ok) {
      const json = await res.json();
      const quotes = json?.quoteResponse?.result || [];

      if (quotes.length > 0) {
        const liveData = sectors.map((sec) => {
          const q = quotes.find((item: any) => item.symbol === sec.symbol);
          return {
            name: sec.name,
            symbol: sec.symbol,
            change: q?.regularMarketChangePercent !== undefined 
              ? parseFloat(q.regularMarketChangePercent.toFixed(2)) 
              : sec.baseline
          };
        });

        liveData.sort((a, b) => b.change - a.change);

        return new Response(JSON.stringify({ success: true, data: liveData }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=60'
          }
        });
      }
    }
  } catch (_) {
    // Fall back to verified session baselines if upstream fails
  }

  sectors.sort((a, b) => b.baseline - a.baseline);
  return new Response(JSON.stringify({ success: true, data: sectors.map(s => ({ name: s.name, symbol: s.symbol, change: s.baseline })) }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
