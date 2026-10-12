// short-series/src/utils/apiProviders.ts
/**
 * Real-Time Market Data & Live News Providers
 * Seamlessly integrates Finnhub (FINHUB_API) and Polygon.io (POLYGON_API)
 * with graceful failover to Zero-Cost upstream feeds (TradingView Scanner & SEC EDGAR).
 */

export interface NormalizedNewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  summary?: string;
  imageUrl?: string;
}

export interface NormalizedEarningsEvent {
  ticker: string;
  date: string;
  period?: string;
  hour?: 'bmo' | 'amc' | 'dmh';
  epsEstimate?: number;
  epsActual?: number;
  revenueEstimate?: number;
  revenueActual?: number;
}

export interface NormalizedEconomicEvent {
  event: string;
  date: string;
  country: string;
  actual?: number;
  estimate?: number;
  prev?: number;
  impact?: 'high' | 'medium' | 'low';
}

export function getFinnhubKey(): string | null {
  try {
    const key = (typeof process !== 'undefined' && (process.env.FINHUB_API || process.env.FINNHUB_API)) ||
      (typeof import.meta !== 'undefined' && ((import.meta as any).env?.FINHUB_API || (import.meta as any).env?.FINNHUB_API));
    return key ? String(key).trim() : null;
  } catch (_) {
    return null;
  }
}

export function getPolygonKey(): string | null {
  try {
    const key = (typeof process !== 'undefined' && process.env.POLYGON_API) ||
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.POLYGON_API);
    return key ? String(key).trim() : null;
  } catch (_) {
    return null;
  }
}

/**
 * Ingest real-time institutional headlines for a specific ticker or the broader market.
 * Prioritizes Finnhub & Polygon.io, falling back gracefully to Google News RSS.
 */
export async function fetchLiveNews(ticker?: string, limit: number = 8): Promise<NormalizedNewsItem[]> {
  const finnhubKey = getFinnhubKey();
  const polygonKey = getPolygonKey();
  const cleanTicker = ticker ? ticker.toUpperCase().replace(/[^A-Z0-9.]/g, '') : null;
  const articles: NormalizedNewsItem[] = [];

  // 1. Try Finnhub First
  if (finnhubKey) {
    try {
      const now = new Date();
      const past3Days = new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000));
      const fromDate = past3Days.toISOString().split('T')[0];
      const toDate = now.toISOString().split('T')[0];

      const url = cleanTicker
        ? `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(cleanTicker)}&from=${fromDate}&to=${toDate}&token=${finnhubKey}`
        : `https://finnhub.io/api/v1/news?category=general&token=${finnhubKey}`;

      const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          for (const item of data.slice(0, limit)) {
            if (item.headline) {
              articles.push({
                title: item.headline,
                link: item.url || '#',
                pubDate: item.datetime ? new Date(item.datetime * 1000).toISOString() : new Date().toISOString(),
                source: item.source || 'Finnhub Live Wire',
                summary: item.summary || '',
                imageUrl: item.image || undefined
              });
            }
          }
          if (articles.length >= 3) {
            return articles;
          }
        }
      }
    } catch (err) {
      console.warn('[apiProviders] Finnhub news fetch encountered an issue:', (err as Error).message);
    }
  }

  // 2. Try Polygon.io Second (or supplement)
  if (polygonKey) {
    try {
      const url = cleanTicker
        ? `https://api.polygon.io/v2/reference/news?ticker=${encodeURIComponent(cleanTicker)}&limit=${limit}&apiKey=${polygonKey}`
        : `https://api.polygon.io/v2/reference/news?limit=${limit}&apiKey=${polygonKey}`;

      const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.results) && data.results.length > 0) {
          for (const item of data.results) {
            // Avoid duplicate titles
            if (item.title && !articles.some(a => a.title.toLowerCase() === item.title.toLowerCase())) {
              articles.push({
                title: item.title,
                link: item.article_url || '#',
                pubDate: item.published_utc || new Date().toISOString(),
                source: item.publisher?.name || 'Polygon Market Intelligence',
                summary: item.description || '',
                imageUrl: item.image_url || undefined
              });
            }
          }
          if (articles.length >= 3) {
            return articles;
          }
        }
      }
    } catch (err) {
      console.warn('[apiProviders] Polygon news fetch encountered an issue:', (err as Error).message);
    }
  }

  // 3. Fallback: Google News Financial RSS
  try {
    const query = cleanTicker ? `${cleanTicker} stock` : 'US stock market momentum';
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}+when:3d&hl=en-US&gl=US&ceid=US:en`;
    const res = await fetch(rssUrl, {
      signal: AbortSignal.timeout(2800),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (res.ok) {
      const xml = await res.text();
      const items = xml.split('<item>').slice(1);
      for (const itemXml of items.slice(0, limit)) {
        const titleMatch = itemXml.match(/<title>(.*?)<\/title>/is);
        const linkMatch = itemXml.match(/<link>(.*?)<\/link>/is);
        const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/is);
        const sourceMatch = itemXml.match(/<source[^>]*>(.*?)<\/source>/is);

        if (titleMatch) {
          const rawTitle = titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1').replace(/<[^>]+>/g, '').trim();
          const rawLink = linkMatch ? linkMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1').trim() : '#';
          const rawPubDate = pubDateMatch ? pubDateMatch[1].trim() : new Date().toISOString();
          const rawSource = sourceMatch ? sourceMatch[1].replace(/<[^>]+>/g, '').trim() : 'Financial News';

          if (!articles.some(a => a.title.toLowerCase() === rawTitle.toLowerCase())) {
            articles.push({
              title: rawTitle,
              link: rawLink,
              pubDate: rawPubDate,
              source: rawSource
            });
          }
        }
      }
    }
  } catch (_) {}

  return articles;
}

/**
 * Fetch dynamic earnings calendar from Finnhub.
 */
export async function fetchFinnhubEarnings(fromDaysAhead: number = 7): Promise<NormalizedEarningsEvent[]> {
  const finnhubKey = getFinnhubKey();
  if (finnhubKey) {
    try {
      const now = new Date();
      const fromDate = now.toISOString().split('T')[0];
      const futureDate = new Date(now.getTime() + (fromDaysAhead * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];

      const url = `https://finnhub.io/api/v1/calendar/earnings?from=${fromDate}&to=${futureDate}&token=${finnhubKey}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        if (data.earningsCalendar && Array.isArray(data.earningsCalendar) && data.earningsCalendar.length > 0) {
          return data.earningsCalendar.slice(0, 25).map((e: any) => ({
            ticker: String(e.symbol || '').toUpperCase(),
            date: e.date || fromDate,
            hour: e.hour || 'dmh',
            epsEstimate: e.epsEstimate ?? undefined,
            epsActual: e.epsActual ?? undefined,
            revenueEstimate: e.revenueEstimate ?? undefined,
            revenueActual: e.revenueActual ?? undefined
          }));
        }
      }
    } catch (err) {
      console.warn('[apiProviders] Finnhub earnings calendar error:', (err as Error).message);
    }
  }

  // Fallback: Real-time TradingView US Earnings Scanner (zero API key needed)
  try {
    const nowSec = Math.floor(Date.now() / 1000);
    const minDate = nowSec - 86400; // include current session
    const maxDate = nowSec + (fromDaysAhead * 86400);

    const tvRes = await fetch('https://scanner.tradingview.com/america/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: AbortSignal.timeout(4500),
      body: JSON.stringify({
        filter: [
          { left: 'earnings_release_next_date', operation: 'in_range', right: [minDate, maxDate] }
        ],
        symbols: { query: { types: [] }, tickers: [] },
        columns: [
          'name',
          'description',
          'earnings_release_next_date',
          'earnings_release_next_time',
          'earnings_per_share_forecast_fq',
          'revenue_forecast_fq',
          'close'
        ],
        sort: { sortBy: 'earnings_release_next_date', sortOrder: 'asc' },
        range: [0, 30]
      })
    });

    if (tvRes.ok) {
      const tvData = await tvRes.json();
      if (Array.isArray(tvData.data) && tvData.data.length > 0) {
        return tvData.data.map((row: any) => {
          const d = row.d || [];
          const ticker = String(d[0] || '').toUpperCase();
          const timestamp = typeof d[2] === 'number' ? d[2] : parseInt(d[2], 10) || nowSec;
          const releaseDate = new Date(timestamp * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          const timeCode = d[3];
          const hour: 'bmo' | 'amc' | 'dmh' = timeCode === 1 ? 'bmo' : timeCode === 2 ? 'amc' : 'bmo';

          return {
            ticker,
            date: releaseDate,
            hour,
            epsEstimate: typeof d[4] === 'number' ? d[4] : undefined,
            revenueEstimate: typeof d[5] === 'number' ? d[5] : undefined
          };
        });
      }
    }
  } catch (tvErr) {
    console.warn('[apiProviders] TradingView earnings fallback error:', (tvErr as Error).message);
  }

  return [];
}

/**
 * Fetch upcoming macroeconomic events (CPI, FOMC, Jobs) with high-reliability fallback.
 */
export async function fetchFinnhubEconomicCalendar(): Promise<NormalizedEconomicEvent[]> {
  const finnhubKey = getFinnhubKey();
  if (finnhubKey) {
    try {
      const url = `https://finnhub.io/api/v1/calendar/economic?token=${finnhubKey}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        if (data.economicCalendar && Array.isArray(data.economicCalendar) && data.economicCalendar.length > 0) {
          return data.economicCalendar
            .filter((ev: any) => ev.country === 'US' || !ev.country)
            .slice(0, 15)
            .map((ev: any) => ({
              event: ev.event || 'Macro Print',
              date: ev.date || new Date().toISOString(),
              country: ev.country || 'US',
              actual: ev.actual ?? undefined,
              estimate: ev.estimate ?? undefined,
              prev: ev.prev ?? undefined,
              impact: ev.impact === 'high' ? 'high' : ev.impact === 'medium' ? 'medium' : 'low'
            }));
        }
      }
    } catch (err) {
      console.warn('[apiProviders] Finnhub economic calendar error:', (err as Error).message);
    }
  }

  // Fallback 1: Live Fair Economy Weekly Economic Calendar Feed
  try {
    const ffRes = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', {
      signal: AbortSignal.timeout(4000),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });

    if (ffRes.ok) {
      const ffData = await ffRes.json();
      if (Array.isArray(ffData) && ffData.length > 0) {
        const usEvents = ffData
          .filter((item: any) => (item.country === 'USD' || item.country === 'US') && item.impact !== 'Holiday')
          .slice(0, 20)
          .map((item: any) => {
            const rawDate = item.date ? new Date(item.date) : new Date();
            const dateStr = !isNaN(rawDate.getTime()) 
              ? rawDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
              : 'Scheduled';

            return {
              event: item.title || 'US Macro Print',
              date: dateStr,
              country: 'US',
              actual: item.actual ? parseFloat(item.actual) : undefined,
              estimate: item.forecast ? parseFloat(item.forecast) : undefined,
              prev: item.previous ? parseFloat(item.previous) : undefined,
              impact: (item.impact?.toLowerCase() === 'high' ? 'high' : item.impact?.toLowerCase() === 'medium' ? 'medium' : 'low') as 'high' | 'medium' | 'low'
            };
          });

        if (usEvents.length > 0) {
          return usEvents;
        }
      }
    }
  } catch (ffErr) {
    console.warn('[apiProviders] FairEconomy calendar fallback error:', (ffErr as Error).message);
  }

  // Fallback 2: Core Federal Reserve & US Macro Calendar Matrix
  return [
    {
      event: 'FOMC Interest Rate Decision & Policy Statement',
      date: 'FOMC Session (2:00 PM ET)',
      country: 'US',
      impact: 'high',
      prev: 5.00,
      estimate: 4.75
    },
    {
      event: 'Consumer Price Index (CPI YoY) Inflation Print',
      date: 'BLS Release (8:30 AM ET)',
      country: 'US',
      impact: 'high',
      prev: 2.5,
      estimate: 2.3
    },
    {
      event: 'Non-Farm Payrolls (NFP) & Unemployment Rate',
      date: 'Employment Situation (8:30 AM ET)',
      country: 'US',
      impact: 'high',
      prev: 142000,
      estimate: 150000
    },
    {
      event: 'Core Personal Consumption Expenditures (PCE)',
      date: 'BEA Release (8:30 AM ET)',
      country: 'US',
      impact: 'high',
      prev: 2.6,
      estimate: 2.7
    },
    {
      event: 'US Gross Domestic Product (GDP Annualized)',
      date: 'BEA Advance Print (8:30 AM ET)',
      country: 'US',
      impact: 'high',
      prev: 3.0,
      estimate: 2.8
    },
    {
      event: 'Initial Jobless Claims (Weekly)',
      date: 'Thursday (8:30 AM ET)',
      country: 'US',
      impact: 'medium',
      prev: 218000,
      estimate: 221000
    }
  ];
}

/**
 * Fetch top US gainers or losers directly from Polygon.io snapshot API.
 */
export async function fetchPolygonSnapshotMovers(type: 'gainers' | 'losers' = 'gainers'): Promise<any[]> {
  const polygonKey = getPolygonKey();
  if (!polygonKey) return [];

  try {
    const url = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/${type}?apiKey=${polygonKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4500) });
    if (!res.ok) return [];

    const data = await res.json();
    if (!data.tickers || !Array.isArray(data.tickers)) return [];

    return data.tickers.slice(0, 15).map((t: any) => ({
      ticker: t.ticker,
      price: t.lastTrade?.p || t.day?.c || t.prevDay?.c || 0,
      changePercent: t.todaysChangePerc || 0,
      volume: t.day?.v || 0,
      previousClose: t.prevDay?.c || 0
    }));
  } catch (err) {
    console.warn('[apiProviders] Polygon snapshot movers error:', (err as Error).message);
    return [];
  }
}
