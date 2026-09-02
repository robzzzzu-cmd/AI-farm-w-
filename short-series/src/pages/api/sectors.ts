// short-series/src/pages/api/sectors.ts
import type { APIRoute } from 'astro';
import yahooFinance from 'yahoo-finance2';

export const prerender = false;

// Suppress console notices regarding Yahoo survey popups
yahooFinance.suppressNotices(['yahooSurvey']);

const SECTOR_DEFS = [
  { name: 'Technology', symbol: 'XLK' },
  { name: 'Communication', symbol: 'XLC' },
  { name: 'Industrials', symbol: 'XLI' },
  { name: 'Consumer Cyclical', symbol: 'XLY' },
  { name: 'Financials', symbol: 'XLF' },
  { name: 'Health Care', symbol: 'XLV' },
  { name: 'Utilities', symbol: 'XLU' },
  { name: 'Real Estate', symbol: 'XLRE' },
];

export const GET: APIRoute = async () => {
  try {
    const symbols = SECTOR_DEFS.map((s) => s.symbol);

    // yahoo-finance2 handles session crumbs, cookies, and batching under the hood
    const quotes = await yahooFinance.quote(symbols);

    const liveData = SECTOR_DEFS.map((sec) => {
      const q = Array.isArray(quotes)
        ? quotes.find((item) => item.symbol === sec.symbol)
        : quotes;

      const changePct =
        typeof q?.regularMarketChangePercent === 'number'
          ? parseFloat(q.regularMarketChangePercent.toFixed(2))
          : 0.0;

      return {
        name: sec.name,
        symbol: sec.symbol,
        change: changePct,
      };
    });

    // Sort descending so the strongest performing sector stays on top
    liveData.sort((a, b) => b.change - a.change);

    return new Response(
      JSON.stringify({ success: true, data: liveData }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          // Cache at edge for 60 seconds to avoid hitting rate limits on Vercel
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
        },
      }
    );
  } catch (err: any) {
    console.error('Yahoo Finance sector fetch failed:', err?.message || err);

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to retrieve live sector metrics.',
      }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
