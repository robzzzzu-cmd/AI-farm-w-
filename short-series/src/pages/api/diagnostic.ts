// short-series/src/pages/api/diagnostic.ts
import type { APIRoute } from 'astro';
import { fetchLiveNews } from '../../utils/apiProviders';

export const prerender = false;

// 45-second server cache per ticker to eliminate redundant external fetches
const cache = new Map<string, { timestamp: number; payload: any }>();
const CACHE_TTL_MS = 45000;

export type CatalystCategory =
  | 'EARNINGS_BEAT'
  | 'FDA_APPROVAL'
  | 'CONTRACT_AWARD'
  | 'PARTNERSHIP'
  | 'M&A_SPECULATION'
  | 'ANALYST_UPGRADE'
  | 'OFFERING_DILUTION'
  | 'UNCONFIRMED_SOCIAL_MOMENTUM'
  | 'NONE_DETECTED';

export type SynthesisVerdict =
  | 'CLEAN CATALYST / LOW RISK'
  | 'INSTITUTIONAL ACCUMULATION'
  | 'HIGH MOMENTUM / HIGH RISK'
  | 'SHORT SQUEEZE EXPANSION'
  | 'DILUTION RISK / OFFERING PENDING'
  | 'EXHAUSTION GAP / FADE BIAS'
  | 'SYMPATHY ROTATION / SECTOR FLOW'
  | 'BALANCED FLOW / RANGEBOUND';

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

interface SecFiling {
  form: string;
  title: string;
  filingDate: string;
  link: string;
}

function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, 'is'));
  if (!match) return '';
  return match[1]
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/<[^>]+>/g, '')
    .trim();
}

async function fetchGoogleNews(ticker: string): Promise<NewsItem[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2800);
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(ticker + ' stock')}+when:3d&hl=en-US&gl=US&ceid=US:en`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }
    });
    clearTimeout(timeout);
    if (!res.ok) return [];

    const xml = await res.text();
    const items = xml.split('<item>').slice(1);
    const results: NewsItem[] = [];

    for (const itemXml of items.slice(0, 5)) {
      const title = extractTag(itemXml, 'title');
      const link = extractTag(itemXml, 'link');
      const pubDate = extractTag(itemXml, 'pubDate');
      const source = extractTag(itemXml, 'source') || 'Financial News';
      if (title) {
        results.push({ title, link, pubDate, source });
      }
    }
    return results;
  } catch (err) {
    return [];
  }
}

async function fetchSecFilings(ticker: string): Promise<SecFiling[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const url = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${encodeURIComponent(ticker)}&type=&dateb=&owner=exclude&count=8&output=atom`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'TradeOpportunities/1.0 (intel@tradeopportunities.trade)'
      }
    });
    clearTimeout(timeout);
    if (!res.ok) return [];

    const xml = await res.text();
    const entries = xml.split('<entry>').slice(1);
    const filings: SecFiling[] = [];

    for (const entry of entries.slice(0, 6)) {
      const title = extractTag(entry, 'title');
      const filingDate = extractTag(entry, 'updated');
      const linkMatch = entry.match(/<link[^>]+href="([^"]+)"/i);
      const link = linkMatch ? linkMatch[1] : '';
      
      let form = 'FILING';
      const formMatch = title.match(/^(8-K|10-K|10-Q|S-3|S-1|424B[0-9]|13D|13G|4)\b/i);
      if (formMatch) {
        form = formMatch[1].toUpperCase();
      }

      if (title) {
        filings.push({ form, title, filingDate, link });
      }
    }
    return filings;
  } catch (err) {
    return [];
  }
}

async function fetchTradingViewTelemetry(ticker: string): Promise<any | null> {
  try {
    const cleanTicker = ticker.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const candidateTickers = [
      cleanTicker,
      `NASDAQ:${cleanTicker}`,
      `NYSE:${cleanTicker}`,
      `AMEX:${cleanTicker}`,
      `OTC:${cleanTicker}`,
      `BATS:${cleanTicker}`,
      `ARCA:${cleanTicker}`
    ];

    const columns = [
      'name',
      'description',
      'close',
      'change_abs',
      'change',
      'volume',
      'relative_volume_10d_calc',
      'market_cap_basic',
      'high',
      'low',
      'sector',
      'Recommend.All',
      'RSI',
      'float_shares_outstanding',
      'short_percent_of_shares_outstanding',
      'price_52_week_high',
      'price_52_week_low',
      'average_volume_30d_calc',
      'VWAP'
    ];

    let res = await fetch('https://scanner.tradingview.com/america/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: JSON.stringify({
        symbols: { tickers: candidateTickers },
        columns: columns
      })
    });

    let json = res.ok ? await res.json() : null;
    let row = json?.data?.[0];

    // Fallback: If candidate symbols didn't match (e.g. non-standard prefix), fallback to exact name filter
    if (!row) {
      const fallbackRes = await fetch('https://scanner.tradingview.com/america/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        body: JSON.stringify({
          filter: [{ left: 'name', operation: 'equal', right: cleanTicker }],
          columns: columns
        })
      });
      if (fallbackRes.ok) {
        const fallbackJson = await fallbackRes.json();
        row = fallbackJson?.data?.[0];
      }
    }

    if (!row) return null;

    const d = row.d || [];
    const exchange = String(row.s?.split(':')?.[0] || '');
    return {
      ticker: cleanTicker,
      exchange,
      name: String(d[1] || cleanTicker),
      price: typeof d[2] === 'number' ? d[2] : parseFloat(d[2]) || 0,
      changeAbs: typeof d[3] === 'number' ? d[3] : parseFloat(d[3]) || 0,
      changePercent: typeof d[4] === 'number' ? d[4] : parseFloat(d[4]) || 0,
      volume: typeof d[5] === 'number' ? d[5] : parseInt(d[5], 10) || 0,
      rvol: typeof d[6] === 'number' ? parseFloat(d[6].toFixed(2)) : 1.0,
      marketCap: typeof d[7] === 'number' ? d[7] : parseFloat(d[7]) || 0,
      dayHigh: typeof d[8] === 'number' ? d[8] : parseFloat(d[8]) || 0,
      dayLow: typeof d[9] === 'number' ? d[9] : parseFloat(d[9]) || 0,
      sector: String(d[10] || 'Equities'),
      recommendAll: typeof d[11] === 'number' ? d[11] : 0,
      rsi: typeof d[12] === 'number' ? Math.round(d[12]) : 50,
      floatShares: typeof d[13] === 'number' ? d[13] : 0,
      shortPercent: typeof d[14] === 'number' ? parseFloat(d[14].toFixed(2)) : 0,
      high52w: typeof d[15] === 'number' ? d[15] : 0,
      low52w: typeof d[16] === 'number' ? d[16] : 0,
      adv30d: typeof d[17] === 'number' ? d[17] : 0,
      vwap: typeof d[18] === 'number' ? parseFloat(d[18].toFixed(2)) : 0
    };
  } catch (err) {
    return null;
  }
}

function categorizeCatalyst(news: NewsItem[], filings: SecFiling[]): { category: CatalystCategory; summary: string; source: string; link: string } {
  const s3Filing = filings.find(f => f.form.startsWith('S-3') || f.form.startsWith('424B'));
  if (s3Filing) {
    return {
      category: 'OFFERING_DILUTION',
      summary: `Active Registration / Prospectus filed (${s3Filing.form}). Potential dilution risk detected.`,
      source: 'SEC EDGAR',
      link: s3Filing.link
    };
  }

  const k8Filing = filings.find(f => f.form === '8-K');
  if (k8Filing) {
    const text = k8Filing.title.toLowerCase();
    if (text.includes('agreement') || text.includes('contract') || text.includes('award')) {
      return { category: 'CONTRACT_AWARD', summary: k8Filing.title, source: 'SEC EDGAR', link: k8Filing.link };
    }
    if (text.includes('earnings') || text.includes('financial') || text.includes('results')) {
      return { category: 'EARNINGS_BEAT', summary: k8Filing.title, source: 'SEC EDGAR', link: k8Filing.link };
    }
  }

  if (news.length > 0) {
    const top = news[0];
    const t = top.title.toLowerCase();

    if (t.includes('fda') || t.includes('clinical') || t.includes('phase 3') || t.includes('phase 2') || t.includes('drug') || t.includes('trial')) {
      return { category: 'FDA_APPROVAL', summary: top.title, source: top.source, link: top.link };
    }
    if (t.includes('earnings') || t.includes('revenue') || t.includes('q1') || t.includes('q2') || t.includes('q3') || t.includes('q4') || t.includes('profit') || t.includes('beat')) {
      return { category: 'EARNINGS_BEAT', summary: top.title, source: top.source, link: top.link };
    }
    if (t.includes('contract') || t.includes('awarded') || t.includes('order') || t.includes('deal')) {
      return { category: 'CONTRACT_AWARD', summary: top.title, source: top.source, link: top.link };
    }
    if (t.includes('partner') || t.includes('collaboration') || t.includes('alliance')) {
      return { category: 'PARTNERSHIP', summary: top.title, source: top.source, link: top.link };
    }
    if (t.includes('acquire') || t.includes('acquisition') || t.includes('merger') || t.includes('buyout') || t.includes('takeover')) {
      return { category: 'M&A_SPECULATION', summary: top.title, source: top.source, link: top.link };
    }
    if (t.includes('upgrade') || t.includes('price target') || t.includes('outperform') || t.includes('buy rating')) {
      return { category: 'ANALYST_UPGRADE', summary: top.title, source: top.source, link: top.link };
    }
    if (t.includes('offering') || t.includes('shares') || t.includes('warrants') || t.includes('pricing of')) {
      return { category: 'OFFERING_DILUTION', summary: top.title, source: top.source, link: top.link };
    }

    return {
      category: 'UNCONFIRMED_SOCIAL_MOMENTUM',
      summary: top.title,
      source: top.source,
      link: top.link
    };
  }

  return {
    category: 'NONE_DETECTED',
    summary: 'No specific company announcement indexed. Movement driven by systematic sector liquidity or order flow imbalance.',
    source: 'Trade Opportunities Scanner',
    link: ''
  };
}

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const tickerParam = (url.searchParams.get('ticker') || '').trim().toUpperCase();

  if (!tickerParam || !/^[A-Z0-9.\-]{1,8}$/.test(tickerParam)) {
    return new Response(JSON.stringify({ success: false, error: 'Invalid or missing ticker parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const fallbackPrice = parseFloat(url.searchParams.get('price') || '0') || 0;
  const fallbackChange = parseFloat(url.searchParams.get('change') || '0') || 0;
  const fallbackVolume = parseInt(url.searchParams.get('volume') || '0', 10) || 0;
  const fallbackRvol = parseFloat(url.searchParams.get('rvol') || '1.0') || 1.0;
  const fallbackMarketCap = parseFloat(url.searchParams.get('marketCap') || '0') || 0;
  const fallbackName = url.searchParams.get('name') ? decodeURIComponent(url.searchParams.get('name') || '') : '';

  const now = Date.now();
  const cached = cache.get(tickerParam);
  if (cached && (now - cached.timestamp < CACHE_TTL_MS) && !(cached.payload?.data?.price === 0 && fallbackPrice > 0)) {
    return new Response(JSON.stringify(cached.payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=60'
      }
    });
  }

  try {
    const [tvData, newsItems, secFilings] = await Promise.all([
      fetchTradingViewTelemetry(tickerParam),
      fetchLiveNews(tickerParam, 6),
      fetchSecFilings(tickerParam)
    ]);

    const exchange = tvData?.exchange || (tickerParam.endsWith('Q') ? 'OTC' : '');
    const price = tvData?.price || fallbackPrice;
    const changePercent = tvData?.changePercent ?? fallbackChange;
    const volume = tvData?.volume || fallbackVolume;
    const rvol = tvData?.rvol || fallbackRvol;
    const marketCap = tvData?.marketCap || fallbackMarketCap;
    const floatShares = tvData?.floatShares || (marketCap && price ? Math.round(marketCap / price * 0.85) : 0);
    const high52w = tvData?.high52w || 0;
    const vwap = tvData?.vwap || price;
    const shortInterest = tvData?.shortPercent || 0;
    const adv = tvData?.adv30d || volume || 1;
    const rsi = tvData?.rsi || 50;
    const name = tvData?.name || fallbackName || tickerParam;

    const catalyst = categorizeCatalyst(newsItems, secFilings);

    const is52WeekHighBreach = high52w > 0 && price >= (high52w * 0.985);
    const pctFromVWAP = vwap > 0 ? parseFloat((((price - vwap) / vwap) * 100).toFixed(2)) : 0;

    let floatCategory: 'MICRO_FLOAT' | 'LOW_FLOAT' | 'MID_FLOAT' | 'LARGE_FLOAT' = 'MID_FLOAT';
    if (floatShares > 0) {
      if (floatShares < 5_000_000) floatCategory = 'MICRO_FLOAT';
      else if (floatShares < 20_000_000) floatCategory = 'LOW_FLOAT';
      else if (floatShares < 100_000_000) floatCategory = 'MID_FLOAT';
      else floatCategory = 'LARGE_FLOAT';
    }
    const floatTurnoverPct = floatShares > 0 ? parseFloat(((volume / floatShares) * 100).toFixed(1)) : 0;
    const dollarVolume = Math.round(price * volume);

    const aggressiveAskLiftPct = changePercent > 0 ? Math.min(85, Math.round(50 + (changePercent * 1.5))) : Math.max(15, Math.round(50 + (changePercent * 1.5)));
    const orderFlowBias = changePercent >= 3.0 ? 'AGGRESSIVE_BUYING' : changePercent <= -3.0 ? 'DISTRIBUTION' : 'BALANCED';

    const hasActiveS3Shelf = secFilings.some(f => f.form.startsWith('S-3') || f.form.startsWith('424B'));
    const isBankruptcyOrOTC = exchange === 'OTC' || tickerParam.endsWith('Q');
    const isSubPenny = price > 0 && price < 0.05;
    const isSubDollarPenny = price >= 0.05 && price < 1.0;
    const isLowPriced = price >= 1.0 && price < 3.0;
    const spreadWarning = (price < 3.0 && volume < 100_000) || (dollarVolume > 0 && dollarVolume < 100_000);
    const isSevereIlliquidity = dollarVolume > 0 && dollarVolume < 50_000;
    const isLowLiquidity = dollarVolume >= 50_000 && dollarVolume < 250_000;
    const isNanoCap = marketCap > 0 && marketCap < 5_000_000;

    const isParabolic = changePercent >= 100.0;
    const isHighMomentum = changePercent >= 40.0 && changePercent < 100.0;
    const isElevatedMomentum = changePercent >= 20.0 && changePercent < 40.0;
    const isOverbought = rsi >= 80;

    let overallRiskScore = 20; // baseline market risk
    if (hasActiveS3Shelf) overallRiskScore += 35;
    if (isBankruptcyOrOTC) overallRiskScore += 25;
    if (isSubPenny) overallRiskScore += 25;
    else if (isSubDollarPenny) overallRiskScore += 18;
    else if (isLowPriced) overallRiskScore += 8;

    if (isParabolic) overallRiskScore += 30;
    else if (isHighMomentum) overallRiskScore += 20;
    else if (isElevatedMomentum) overallRiskScore += 10;
    else if (changePercent <= -20.0) overallRiskScore += 25;

    if (isOverbought) overallRiskScore += 15;
    else if (rsi >= 70) overallRiskScore += 8;

    if (pctFromVWAP >= 15.0) overallRiskScore += 10;

    if (isSevereIlliquidity) overallRiskScore += 25;
    else if (isLowLiquidity || spreadWarning) overallRiskScore += 15;

    if (isNanoCap) overallRiskScore += 15;
    else if (floatCategory === 'MICRO_FLOAT') overallRiskScore += 12;

    overallRiskScore = Math.max(5, Math.min(99, overallRiskScore));

    let riskTier: 'EXTREME_HAZARD' | 'HIGH_RISK' | 'MODERATE_RISK' | 'LOW_RISK' = 'LOW_RISK';
    if (overallRiskScore >= 80) riskTier = 'EXTREME_HAZARD';
    else if (overallRiskScore >= 65) riskTier = 'HIGH_RISK';
    else if (overallRiskScore >= 40) riskTier = 'MODERATE_RISK';

    const flags: Array<{ label: string; description: string; severity: 'hazard' | 'warning' | 'safe' }> = [];

    if (hasActiveS3Shelf) {
      flags.push({
        label: 'Active Shelf Registration (S-3/424B)',
        description: 'Company has active financing or ATM capacity on file. Extreme dilution risk upon momentum spikes.',
        severity: 'hazard'
      });
    }
    if (isBankruptcyOrOTC) {
      flags.push({
        label: `OTC / Bankruptcy Classification (${exchange || 'OTC'})`,
        description: 'Ticker trades on OTC pink sheets or carries Chapter 11 bankruptcy classification (Q-suffix). Extreme capital impairment hazard.',
        severity: 'hazard'
      });
    }
    if (isSubPenny) {
      flags.push({
        label: `Sub-Penny Asset ($${price < 0.01 ? price.toFixed(4) : price.toFixed(2)})`,
        description: 'Trades in sub-cent quotation territory. Characterized by wide bid-ask spreads, low float control, and severe order execution slippage.',
        severity: 'hazard'
      });
    } else if (isSubDollarPenny) {
      flags.push({
        label: `Sub-Dollar Penny Stock ($${price.toFixed(2)})`,
        description: 'Trades under $1.00 minimum bid requirement. Subject to exchange compliance, reverse splits, or delisting risk.',
        severity: 'warning'
      });
    }
    if (isParabolic) {
      flags.push({
        label: `Parabolic Vertical Surge (+${changePercent.toFixed(1)}%)`,
        description: 'Asset is experiencing an extreme vertical price spike. Severe vulnerability to liquidity exhaustion, circuit halts, and violent gap-fill pullbacks.',
        severity: 'hazard'
      });
    } else if (isHighMomentum) {
      flags.push({
        label: `High Momentum Expansion (+${changePercent.toFixed(1)}%)`,
        description: 'Substantial intraday expansion. Increased vulnerability to rapid profit-taking and mean reversion.',
        severity: 'warning'
      });
    } else if (isElevatedMomentum) {
      flags.push({
        label: `Elevated Intraday Volatility (+${changePercent.toFixed(1)}%)`,
        description: 'Price velocity is trading well above typical daily bands.',
        severity: 'warning'
      });
    }
    if (isOverbought) {
      flags.push({
        label: `Technical Overbought Exhaustion (RSI ${rsi})`,
        description: 'Momentum is severely stretched above normal oscillators, increasing the likelihood of an intraday pullback.',
        severity: 'warning'
      });
    }
    if (isSevereIlliquidity) {
      flags.push({
        label: `Micro Dollar Volume ($${(dollarVolume / 1000).toFixed(1)}K)`,
        description: 'Total session turnover is under $50,000. Low quotation depth creates high slippage on market orders.',
        severity: 'hazard'
      });
    } else if (spreadWarning) {
      flags.push({
        label: 'Wide Bid/Ask Spread Warning',
        description: 'Session volume is light relative to quotation depth. High slippage on market orders.',
        severity: 'warning'
      });
    }
    if (isNanoCap) {
      flags.push({
        label: `Nano-Cap Valuation ($${marketCap >= 1e6 ? (marketCap / 1e6).toFixed(1) + 'M' : (marketCap / 1e3).toFixed(0) + 'K'})`,
        description: 'Microscopic market valuation allows small capital flows to distort market pricing unpredictably.',
        severity: 'warning'
      });
    } else if (floatCategory === 'MICRO_FLOAT') {
      flags.push({
        label: 'Micro-Float Structure (< 5M Float)',
        description: 'Constrained supply can trigger violent price swings in both directions.',
        severity: 'warning'
      });
    }
    if (flags.length === 0) {
      flags.push({
        label: 'Clean Structural Profile',
        description: 'No active S-3 dilution shelves, extreme parabolic extension, or micro-liquidity warnings detected.',
        severity: 'safe'
      });
    }

    let verdict: SynthesisVerdict = 'BALANCED FLOW / RANGEBOUND';
    let verdictColor: 'GREEN' | 'YELLOW' | 'RED' | 'BLUE' | 'GRAY' = 'GRAY';

    if (hasActiveS3Shelf && (floatCategory === 'MICRO_FLOAT' || floatCategory === 'LOW_FLOAT' || isSubDollarPenny || isSubPenny)) {
      verdict = 'DILUTION RISK / OFFERING PENDING';
      verdictColor = 'RED';
    } else if (isParabolic || (overallRiskScore >= 75 && changePercent >= 15.0)) {
      verdict = 'HIGH MOMENTUM / HIGH RISK';
      verdictColor = 'RED';
    } else if (pctFromVWAP < -3.5 && rvol > 3.0) {
      verdict = 'EXHAUSTION GAP / FADE BIAS';
      verdictColor = 'RED';
    } else if (shortInterest >= 18.0 && floatTurnoverPct >= 60.0 && rvol >= 2.5) {
      verdict = 'SHORT SQUEEZE EXPANSION';
      verdictColor = 'YELLOW';
    } else if (
      (catalyst.category === 'EARNINGS_BEAT' || catalyst.category === 'FDA_APPROVAL' || catalyst.category === 'CONTRACT_AWARD') &&
      dollarVolume >= 15_000_000 && !hasActiveS3Shelf
    ) {
      verdict = 'CLEAN CATALYST / LOW RISK';
      verdictColor = 'GREEN';
    } else if (dollarVolume >= 40_000_000 && is52WeekHighBreach && pctFromVWAP > 0) {
      verdict = 'INSTITUTIONAL ACCUMULATION';
      verdictColor = 'GREEN';
    } else if (rvol >= 2.0 && changePercent >= 5.0) {
      verdict = 'HIGH MOMENTUM / HIGH RISK';
      verdictColor = overallRiskScore >= 60 ? 'RED' : 'YELLOW';
    } else if (catalyst.category === 'NONE_DETECTED' && rvol >= 2.0 && changePercent >= 3.0) {
      verdict = 'SYMPATHY ROTATION / SECTOR FLOW';
      verdictColor = 'BLUE';
    }

    const payload = {
      success: true,
      data: {
        ticker: tickerParam,
        exchange,
        name,
        timestamp: now,
        price,
        changePercent,
        volume,
        rvol,
        synthesisVerdict: verdict,
        verdictColor,
        catalyst: {
          category: catalyst.category,
          summary: catalyst.summary,
          source: catalyst.source,
          link: catalyst.link,
          verified: catalyst.category !== 'NONE_DETECTED' && catalyst.category !== 'UNCONFIRMED_SOCIAL_MOMENTUM'
        },
        technical: {
          is52WeekHighBreach,
          pctFromVWAP,
          vwap,
          rvolMultiplier: rvol,
          rsi,
          high52w
        },
        liquidity: {
          floatShares,
          floatCategory,
          floatTurnoverPct,
          volume,
          adv30d: adv,
          dollarVolume
        },
        marketBehavior: {
          shortInterestPct: shortInterest,
          aggressiveAskLiftPct,
          orderFlowBias
        },
        riskRating: {
          hasActiveS3Shelf,
          isSubDollarPenny: isSubDollarPenny || isSubPenny,
          spreadWarning,
          overallRiskScore,
          riskTier,
          flags
        },
        recentNews: newsItems.slice(0, 3),
        recentFilings: secFilings.slice(0, 3)
      }
    };

    cache.set(tickerParam, { timestamp: now, payload });

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=60'
      }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message || 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};