// short-series/src/pages/api/sectors.ts
import type { APIRoute } from 'astro';

export const prerender = false;

const SECTORS = [
  { name: "Technology", symbol: "XLK.US" },
  { name: "Communication", symbol: "XLC.US" },
  { name: "Industrials", symbol: "XLI.US" },
  { name: "Consumer Cyclical", symbol: "XLY.US" },
  { name: "Financials", symbol: "XLF.US" },
  { name: "Health Care", symbol: "XLV.US" },
  { name: "Utilities", symbol: "XLU.US" },
  { name: "Real Estate", symbol: "XLRE.US" }
];

export const GET: APIRoute = async () => {
  try {
    // Stooq provides free, reliable CSV quotes for US ETFs without rate limits or crumb barriers
    const symbols = SECTORS.map(s => s.symbol.toLowerCase()).join('+');
    const url = `https://stooq.com/q/l/?s=${symbols}&f=sd2t2ohlcvp&h&e=json`;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (!res.ok) throw new Error(`Stooq HTTP error: ${res.status}`);

    const json = await res.json();
    const symbolsData = json?.symbols || [];

    const liveData = SECTORS.map(sec => {
      const item = symbolsData.find((d: any) => d.symbol?.toUpperCase() === sec.symbol.toUpperCase());
      const changePct = typeof item?.change_percent === 'number' 
        ? parseFloat(item.change_percent.toFixed(2)) 
        : (item?.open && item?.close ? parseFloat((((item.close - item.open) / item.open) * 100).toFixed(2)) : 0.0);

      return {
        name: sec.name,
        symbol: sec.symbol.replace('.US', ''),
        change: changePct
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
    console.error('Sector data retrieval failed:', err?.message || err);

    return new Response(
      JSON.stringify({ success: false, error: 'Failed to retrieve live metrics' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
