// index.js
const fs = require('fs');
const path = require('path');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url, options = {}, retries = 3, backoffMs = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP Error ${response.status}: ${response.statusText} - ${errorText}`);
      }
      return await response.json();
    } catch (error) {
      console.warn(`Fetch attempt ${attempt} failed: ${error.message}`);
      if (attempt === retries) throw error;
      await wait(backoffMs * attempt);
    }
  }
}

// Compact metric formatter: turns 116127 into 116.1K, 32100000 into 32.1M
function formatCompactNumber(val) {
  if (val === undefined || val === null || val === '') return '0';
  const num = typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : val;
  if (isNaN(num)) return String(val);
  if (Math.abs(num) >= 1e9) {
    return (num / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  }
  if (Math.abs(num) >= 1e6) {
    return (num / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (Math.abs(num) >= 1e3) {
    return (num / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toLocaleString();
}

function buildCompactTable(title, items) {
  if (!items || items.length === 0) return '';

  let table = `#### ${title}\n\n`;
  table += `| Ticker | Price | Delta | Volume | Action |\n`;
  table += `| :--- | :--- | :--- | :--- | :--- |\n`;

  for (const s of items) {
    const rawPrice = parseFloat(s.price);
    const rawChange = parseFloat(s.change_percentage);
    const price = !isNaN(rawPrice) ? `$${rawPrice.toFixed(2)}` : '$0.00';
    const sign = rawChange > 0 ? '+' : '';
    const change = !isNaN(rawChange) ? `${sign}${rawChange.toFixed(2)}%` : '0.00%';
    const vol = formatCompactNumber(s.volume);
    const link = `[Trade ${s.ticker}](https://www.tradingview.com/symbols/${s.ticker}/?aff_id=170147)`;

    table += `| **$${s.ticker}** | ${price} | \`${change}\` | ${vol} | ${link} |\n`;
  }

  return table + '\n';
}

function sanitizeAndLinkify(text, tickers) {
  let cleaned = text
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

  const sorted = [...tickers].sort((a, b) => b.length - a.length);

  for (const t of sorted) {
    const regex = new RegExp(`(?<!\\[)\\$${t}\\b(?!\\])`, 'g');
    cleaned = cleaned.replace(
      regex,
      `[$${t}](https://www.tradingview.com/symbols/${t}/?aff_id=170147)`
    );
  }

  return cleaned;
}

async function run() {
  const alphaVantageKey = process.env.ALPHA_VANTAGE_API_KEY;
  const polygonKey = process.env.POLYGON_API;
  const finnhubKey = process.env.FINHUB_API || process.env.FINNHUB_API;
  const llmApiKey = process.env.LLM_API_KEY;

  if (!llmApiKey) {
    console.error('Missing required LLM_API_KEY.');
    process.exit(1);
  }

  if (!alphaVantageKey && !polygonKey) {
    console.error('Missing market data API keys. Provide either ALPHA_VANTAGE_API_KEY or POLYGON_API.');
    process.exit(1);
  }

  try {
    const now = new Date();
    const currentUtcHour = now.getUTCHours();

    // 1. Determine time-gated brief cadence (Morning, Midday, Afternoon, Closing)
    let briefType = 'MORNING';
    let briefPrefix = 'Morning Momentum Brief';
    let briefCategory = 'Morning Brief';
    let briefFocus = 'Pre-market gap leaders, opening drive volume, technical breakout levels, and spread slippage precautions.';

    if (currentUtcHour >= 15 && currentUtcHour < 18) {
      briefType = 'MIDDAY';
      briefPrefix = 'Midday Market Update';
      briefCategory = 'Midday Update';
      briefFocus = 'Morning runners consolidating above VWAP, afternoon continuation setups, and midday volume dry-up analysis.';
    } else if (currentUtcHour >= 18 && currentUtcHour < 20) {
      briefType = 'AFTERNOON';
      briefPrefix = 'Afternoon Momentum Brief';
      briefCategory = 'Market Brief';
      briefFocus = 'Power hour volume acceleration, sector rotations, and institutional block accumulation.';
    } else if (currentUtcHour >= 20 || currentUtcHour < 4) {
      briefType = 'CLOSING';
      briefPrefix = 'Closing Momentum Report';
      briefCategory = 'Closing Report';
      briefFocus = 'Cash session wrap, attribution post-mortem on top gainers, after-hours earnings movers, and overnight continuation candidates.';
    }

    const folderPath = fs.existsSync('./src/content/blog')
      ? './src/content/blog'
      : './short-series/src/content/blog';

    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    // Identify posts already published today
    const todayPrefix = now.toISOString().split('T')[0];
    const existingPostsToday = fs.readdirSync(folderPath).filter((file) => file.includes(todayPrefix));
    
    // Check if this specific scheduled brief has already been generated today
    const briefAlreadyPublished = existingPostsToday.some((file) => {
      try {
        const raw = fs.readFileSync(path.join(folderPath, file), 'utf-8');
        return raw.includes(`briefType: "${briefType}"`);
      } catch (_) { return false; }
    });

    if (briefAlreadyPublished) {
      console.log(`Today's ${briefPrefix} (${briefType}) has already been generated. Skipping duplicate.`);
      if (process.env.GITHUB_OUTPUT) {
        fs.appendFileSync(process.env.GITHUB_OUTPUT, 'has_new_post=false\n');
      }
      process.exit(0);
    }

    let marketData = null;

    // 1a. Try Alpha Vantage if available
    if (alphaVantageKey) {
      try {
        console.log(`1a. Fetching market movers from Alpha Vantage for ${briefPrefix}...`);
        const avUrl = `https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${alphaVantageKey}`;
        const avData = await fetchWithRetry(avUrl);

        if (!avData.Note && !avData.Information && avData.top_gainers && avData.top_gainers.length > 0) {
          marketData = avData;
        } else {
          console.warn(`Alpha Vantage rate-limited or empty. Checking Polygon fallback...`);
        }
      } catch (err) {
        console.warn(`Alpha Vantage error: ${err.message}. Checking Polygon fallback...`);
      }
    }

    // 1b. Fallback or Primary with Polygon.io (massive.com)
    if (!marketData && polygonKey) {
      try {
        console.log(`1b. Fetching real-time market movers from Polygon.io for ${briefPrefix}...`);
        const polyUrl = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/gainers?apiKey=${polygonKey}`;
        const polyData = await fetchWithRetry(polyUrl);

        if (polyData.tickers && polyData.tickers.length > 0) {
          const mappedGainers = polyData.tickers.slice(0, 15).map((t) => ({
            ticker: t.ticker,
            price: String((t.lastTrade?.p || t.day?.c || t.prevDay?.c || 0).toFixed(2)),
            change_percentage: String((t.todaysChangePerc || 0).toFixed(2)) + '%',
            volume: String(t.day?.v || 0)
          }));

          marketData = {
            top_gainers: mappedGainers,
            top_losers: [],
            most_actively_traded: mappedGainers.slice(0, 5)
          };
        }
      } catch (err) {
        console.warn(`Polygon movers fetch error: ${err.message}`);
      }
    }

    if (!marketData || !marketData.top_gainers || marketData.top_gainers.length === 0) {
      throw new Error(`Unable to fetch market movers from Alpha Vantage or Polygon.io.`);
    }

    // Filter out illiquid sub-penny warrants
    const liquidGainers = (marketData.top_gainers || []).filter((s) => {
      const vol = Number(s.volume || 0);
      const price = parseFloat(s.price || 0);
      const dollarVolume = vol * price;
      const isPennyWarrant = s.ticker.endsWith('W') && price < 0.05;
      return vol >= 50000 && dollarVolume >= 100000 && !isPennyWarrant;
    });

    const candidateGainers = liquidGainers.length >= 2 ? liquidGainers : marketData.top_gainers;
    const leadStock = candidateGainers[0] || marketData.top_gainers[0];
    const otherGainers = candidateGainers.filter((s) => s.ticker.toUpperCase() !== leadStock.ticker.toUpperCase());
    const topGainers = [leadStock, ...otherGainers].slice(0, 5);
    const topLosers = (marketData.top_losers || []).slice(0, 5);
    const mostActive = (marketData.most_actively_traded || []).slice(0, 5);

    // Fetch real breaking news headlines for the lead runner from Finnhub or Polygon
    let liveCatalystHeadlines = [];
    if (finnhubKey) {
      try {
        console.log(`1c. Fetching live news headlines for lead runner $${leadStock.ticker} from Finnhub...`);
        const past2Days = new Date(now.getTime() - (2 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
        const todayStr = now.toISOString().split('T')[0];
        const fnUrl = `https://finnhub.io/api/v1/company-news?symbol=${leadStock.ticker}&from=${past2Days}&to=${todayStr}&token=${finnhubKey}`;
        const fnData = await fetchWithRetry(fnUrl);
        if (Array.isArray(fnData) && fnData.length > 0) {
          liveCatalystHeadlines = fnData.slice(0, 3).map(n => `"${n.headline}" (${n.source || 'Finnhub Wire'})`);
        }
      } catch (err) {
        console.warn(`Finnhub news error: ${err.message}`);
      }
    }

    if (liveCatalystHeadlines.length === 0 && polygonKey) {
      try {
        console.log(`1d. Fetching live news headlines for lead runner $${leadStock.ticker} from Polygon.io...`);
        const polyNewsUrl = `https://api.polygon.io/v2/reference/news?ticker=${leadStock.ticker}&limit=3&apiKey=${polygonKey}`;
        const polyNews = await fetchWithRetry(polyNewsUrl);
        if (polyNews.results && Array.isArray(polyNews.results) && polyNews.results.length > 0) {
          liveCatalystHeadlines = polyNews.results.slice(0, 3).map(n => `"${n.title}" (${n.publisher?.name || 'Polygon Wire'})`);
        }
      } catch (err) {
        console.warn(`Polygon news error: ${err.message}`);
      }
    }

    let stockDataSummary = `
SESSION MOVERS FOR ${briefPrefix}:
LEAD MOVER: $${leadStock.ticker} (Price: $${parseFloat(leadStock.price).toFixed(2)}, Change: +${parseFloat(leadStock.change_percentage).toFixed(2)}%, Vol: ${formatCompactNumber(leadStock.volume)})

TOP GAINERS (Momentum Breakouts):
${topGainers.map((s) => `Ticker: $${s.ticker} | Price: $${parseFloat(s.price).toFixed(2)} | Change: +${parseFloat(s.change_percentage).toFixed(2)}% | Volume: ${formatCompactNumber(s.volume)} shares`).join('\n')}

MOST ACTIVELY TRADED (Liquidity Anchors):
${mostActive.slice(0, 3).map((s) => `Ticker: $${s.ticker} | Price: $${parseFloat(s.price).toFixed(2)} | Change: ${parseFloat(s.change_percentage).toFixed(2)}% | Volume: ${formatCompactNumber(s.volume)} shares`).join('\n')}

TOP DECLINERS (Distribution & Pullbacks):
${topLosers.slice(0, 2).map((s) => `Ticker: $${s.ticker} | Price: $${parseFloat(s.price).toFixed(2)} | Change: ${parseFloat(s.change_percentage).toFixed(2)}% | Volume: ${formatCompactNumber(s.volume)} shares`).join('\n')}
    `.trim();

    if (liveCatalystHeadlines.length > 0) {
      stockDataSummary += `\n\nVERIFIED BREAKING CATALYSTS FOR $${leadStock.ticker} (Finnhub / Polygon):\n${liveCatalystHeadlines.map(h => `- ${h}`).join('\n')}`;
    }

    const systemPrompt = `You are the Lead Momentum Strategist for Trade Opportunities (tradeopportunities.trade), an AI-powered momentum intelligence terminal for active traders.
Write the tactical market narrative for today's "${briefPrefix}".
Primary focus: ${briefFocus}

TONE & VOICE REQUIREMENTS:
- Write in punchy, practitioner-focused trader language. Talk like an active, disciplined desk trader.
- DO NOT use exaggerated institutional fluff or fake desk jargon ("institutional desks", "liquidity routing", "order book depth", "speculative frenzy", "stunned desks").
- Use clean, direct market terminology:
  * "Unusual price breakout backed by heavy relative volume."
  * "Thin liquidity on sub-$5 names means price moves fast and spreads can widen."
  * "Heavy volume concentration signals strong retail and momentum interest."
  * Always highlight clear support, breakout triggers, and invalidation levels.

STRUCTURE:
1. Lead with market context and top momentum runner $${leadStock.ticker}, highlighting its percentage surge and session volume.
2. Analyze secondary breakout runners and whether volume is sustaining into continuation or showing exhaustion.
3. Highlight liquidity conditions and contrast volatile micro-caps against high-volume market leaders.
4. Provide actionable takeaways, immediate key pivot levels, and invalidation risk boundaries for active traders.

CRITICAL RULES:
- Write strictly 6 to 9 continuous sentences in a single paragraph.
- DO NOT use markdown headings (#, ##) or bullet points in your response.
- Refer to every ticker using standard dollar notation (e.g. $${leadStock.ticker}).
- DO NOT invent or embed raw markdown links or HTML.
- Return ONLY the paragraph text.`;

    console.log(`2. Generating narrative with Gemini for ${briefPrefix} (Lead $${leadStock.ticker})...`);
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${llmApiKey}`;
    
    const llmData = await fetchWithRetry(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: `${systemPrompt}\n\nMarket Data Feed:\n${stockDataSummary}` }
            ]
          }
        ],
        generationConfig: {
          maxOutputTokens: 2000,
          temperature: 0.2
        }
      })
    });

    if (!llmData.candidates || !llmData.candidates[0]?.content?.parts?.[0]?.text) {
      throw new Error(`Gemini synthesis returned empty structure: ${JSON.stringify(llmData)}`);
    }

    const rawAnalysis = llmData.candidates[0].content.parts[0].text.trim();

    console.log('3. Assembling structured brief markdown post...');
    const date = now.toISOString().split('T')[0];
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    const displayTime = now.toTimeString().split(' ')[0].slice(0, 5) + ' UTC';

    const fileName = `brief-${briefType.toLowerCase()}-${timestamp}.md`;
    const compactTable = buildCompactTable('Session Top Movers & Liquidity', topGainers);

    const allTickers = Array.from(
      new Set([
        ...topGainers.map((s) => s.ticker),
        ...topLosers.map((s) => s.ticker),
        ...mostActive.map((s) => s.ticker)
      ])
    );

    const generatedAnalysis = sanitizeAndLinkify(rawAnalysis, allTickers);
    const postTitle = `${briefPrefix}: ${leadStock.ticker} Leads Expansion (+${parseFloat(leadStock.change_percentage).toFixed(1)}%)`;

    const markdownContent = `---
title: "${postTitle}"
description: "${briefPrefix} analyzing liquidity expansion in ${leadStock.ticker}, active breakouts, and session volume anchors."
briefType: "${briefType}"
date: "${now.toISOString()}"
pubDate: "${now.toISOString()}"
updatedDate: "${now.toISOString()}"
displayDate: "${date} ${displayTime}"
category: "Equities"
categories: ["Equities", "Momentum", "${briefCategory}"]
image: "https://tradeopportunities.trade/favicon.svg"
leadTicker: "${leadStock.ticker}"
leadGain: "+${parseFloat(leadStock.change_percentage).toFixed(1)}%"
tickers: [${allTickers.map((t) => `"${t}"`).join(', ')}]
gainers: ${JSON.stringify(topGainers)}
losers: ${JSON.stringify(topLosers)}
active: ${JSON.stringify(mostActive)}
refUrl: "https://www.tradingview.com/symbols/${leadStock.ticker}/?aff_id=170147"
refLabel: "Analyze ${leadStock.ticker} on TradingView"
---

${generatedAnalysis}

${compactTable}
`;

    fs.writeFileSync(path.join(folderPath, fileName), markdownContent);
    console.log(`Saved scheduled brief: ${fileName} into ${folderPath}`);

    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, 'has_new_post=true\n');
    }
  } catch (error) {
    console.error('Pipeline execution error:', error.message);
    process.exit(1);
  }
}

run();