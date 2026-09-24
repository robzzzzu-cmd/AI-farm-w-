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

  // Only permit valid tickers for autolinking
  const validTickers = (tickers || []).filter(
    (t) => t && typeof t === 'string' && /^[A-Z0-9.-]{1,8}$/.test(t) && !/[\^#+/?&=%]/.test(t)
  );
  const sorted = [...validTickers].sort((a, b) => b.length - a.length);

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
    const scheduleCron = process.env.SCHEDULE_CRON || '';
    const cadenceOverride = (process.env.CADENCE_OVERRIDE || process.env.INPUT_CADENCE || '').toLowerCase();
    const isForce = process.env.INPUT_FORCE === 'true' || process.argv.includes('--force');

    // 1. Determine time-gated brief cadence with queue-delay resilience
    // Checks explicit schedule cron trigger first so delayed GitHub runs retain their intended cadence identity.
    let briefType = 'MORNING';
    let briefPrefix = 'Morning Momentum Brief';
    let briefCategory = 'Morning Brief';
    let briefFocus = 'Pre-market gap catalysts, opening range breakouts (ORB), early relative volume (RVOL) expansion, float rotation velocity, and initial support/resistance targets.';

    if (cadenceOverride === 'morning' || scheduleCron.includes('13 * *') || (!cadenceOverride && !scheduleCron && currentUtcHour >= 12 && currentUtcHour < 15)) {
      briefType = 'MORNING';
      briefPrefix = 'Morning Momentum Brief';
      briefCategory = 'Morning Brief';
      briefFocus = 'Pre-market gap catalysts, opening range breakouts (ORB), early relative volume (RVOL) expansion, float rotation velocity, and initial support/resistance targets.';
    } else if (cadenceOverride === 'midday' || scheduleCron.includes('16 * *') || (!cadenceOverride && !scheduleCron && currentUtcHour >= 15 && currentUtcHour < 18)) {
      briefType = 'MIDDAY';
      briefPrefix = 'Midday Market Update';
      briefCategory = 'Midday Update';
      briefFocus = 'Morning breakout leaders testing intraday VWAP support vs fading into distribution traps, lunchtime volume dry-up, and afternoon continuation pivots.';
    } else if (cadenceOverride === 'afternoon' || scheduleCron.includes('18 * *') || (!cadenceOverride && !scheduleCron && currentUtcHour >= 18 && currentUtcHour < 20)) {
      briefType = 'AFTERNOON';
      briefPrefix = 'Afternoon Momentum Brief';
      briefCategory = 'Market Brief';
      briefFocus = 'Power-hour volume acceleration, institutional block order accumulation, sector sympathy rotations, and intraday highs re-tests into the final hour.';
    } else if (cadenceOverride === 'closing' || scheduleCron.includes('20 * *') || (!cadenceOverride && !scheduleCron && (currentUtcHour >= 20 || currentUtcHour < 4))) {
      briefType = 'CLOSING';
      briefPrefix = 'Closing Momentum Report';
      briefCategory = 'Closing Report';
      briefFocus = 'Full cash session wrap, post-mortem attribution on top winners & losers, verified news vs short squeeze reality, after-hours movers, and overnight watchlists.';
    } else {
      // General hour fallback
      if (currentUtcHour >= 12 && currentUtcHour < 15) {
        briefType = 'MORNING';
        briefPrefix = 'Morning Momentum Brief';
        briefCategory = 'Morning Brief';
        briefFocus = 'Pre-market gap catalysts, opening range breakouts (ORB), early RVOL expansion, float rotation velocity, and initial support/resistance targets.';
      } else if (currentUtcHour >= 15 && currentUtcHour < 18) {
        briefType = 'MIDDAY';
        briefPrefix = 'Midday Market Update';
        briefCategory = 'Midday Update';
        briefFocus = 'Morning breakout leaders testing intraday VWAP support vs fading into distribution traps, lunchtime volume dry-up, and afternoon continuation pivots.';
      } else if (currentUtcHour >= 18 && currentUtcHour < 20) {
        briefType = 'AFTERNOON';
        briefPrefix = 'Afternoon Momentum Brief';
        briefCategory = 'Market Brief';
        briefFocus = 'Power-hour volume acceleration, institutional block order accumulation, sector sympathy rotations, and intraday highs re-tests into the final hour.';
      } else {
        briefType = 'CLOSING';
        briefPrefix = 'Closing Momentum Report';
        briefCategory = 'Closing Report';
        briefFocus = 'Full cash session wrap, post-mortem attribution on top winners & losers, verified news vs short squeeze reality, after-hours movers, and overnight watchlists.';
      }
    }

    console.log(`Resolved Target Cadence: ${briefPrefix} (${briefType}) [Trigger: ${scheduleCron || cadenceOverride || `UTC ${currentUtcHour}:00`}]`);

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

    if (!isForce && briefAlreadyPublished) {
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

    // 1b. Fallback or Primary with Polygon.io
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

    // Filter out illiquid sub-penny warrants and invalid ticker formats
    const isValidTicker = (t) => t && typeof t === 'string' && /^[A-Z0-9.-]{1,8}$/.test(t) && !/[\^#+/?&=%]/.test(t);

    const liquidGainers = (marketData.top_gainers || []).filter((s) => {
      if (!isValidTicker(s.ticker)) return false;
      const vol = Number(s.volume || 0);
      const price = parseFloat(s.price || 0);
      const dollarVolume = vol * price;
      const isPennyWarrant = s.ticker.endsWith('W') && price < 0.05;
      return vol >= 50000 && dollarVolume >= 100000 && !isPennyWarrant;
    });

    const candidateGainers = liquidGainers.length >= 2 ? liquidGainers : (marketData.top_gainers || []).filter((s) => isValidTicker(s.ticker));
    const leadStock = candidateGainers[0] || marketData.top_gainers[0];
    const otherGainers = candidateGainers.filter((s) => s.ticker.toUpperCase() !== leadStock.ticker.toUpperCase());
    const topGainers = [leadStock, ...otherGainers].slice(0, 5);
    const topLosers = (marketData.top_losers || []).filter((s) => isValidTicker(s.ticker)).slice(0, 5);
    const mostActive = (marketData.most_actively_traded || []).filter((s) => isValidTicker(s.ticker)).slice(0, 5);

    // Fetch verified breaking news headlines for the lead runner across 3 tiers (Finnhub -> Polygon -> Alpha Vantage)
    let liveCatalystHeadlines = [];
    if (finnhubKey) {
      try {
        console.log(`1c. Fetching live news headlines for lead runner $${leadStock.ticker} from Finnhub...`);
        const past2Days = new Date(now.getTime() - (2 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
        const todayStr = now.toISOString().split('T')[0];
        const fnUrl = `https://finnhub.io/api/v1/company-news?symbol=${leadStock.ticker}&from=${past2Days}&to=${todayStr}&token=${finnhubKey}`;
        const fnData = await fetchWithRetry(fnUrl);
        if (Array.isArray(fnData) && fnData.length > 0) {
          liveCatalystHeadlines = fnData.slice(0, 3).map((n) => `"${n.headline}" (${n.source || 'Finnhub Wire'})`);
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
          liveCatalystHeadlines = polyNews.results.slice(0, 3).map((n) => `"${n.title}" (${n.publisher?.name || 'Polygon Wire'})`);
        }
      } catch (err) {
        console.warn(`Polygon news error: ${err.message}`);
      }
    }

    if (liveCatalystHeadlines.length === 0 && alphaVantageKey) {
      try {
        console.log(`1e. Fetching news headlines for lead runner $${leadStock.ticker} from Alpha Vantage NEWS_SENTIMENT...`);
        const avNewsUrl = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${leadStock.ticker}&limit=5&apikey=${alphaVantageKey}`;
        const avNews = await fetchWithRetry(avNewsUrl);
        if (avNews && Array.isArray(avNews.feed) && avNews.feed.length > 0) {
          liveCatalystHeadlines = avNews.feed.slice(0, 3).map((n) => `"${n.title}" (${n.source || 'Market Wire'}) - Sentiment: ${n.overall_sentiment_label || 'Neutral'}`);
        }
      } catch (err) {
        console.warn(`Alpha Vantage news fetch error: ${err.message}`);
      }
    }

    let stockDataSummary = `
SESSION MOVERS FOR ${briefPrefix}:
LEAD MOVER: $${leadStock.ticker} (Price: $${parseFloat(leadStock.price).toFixed(2)}, Change: +${parseFloat(leadStock.change_percentage).toFixed(2)}%, Vol: ${formatCompactNumber(leadStock.volume)} shares)

TOP GAINERS (Momentum Breakouts):
${topGainers.map((s) => `Ticker: $${s.ticker} | Price: $${parseFloat(s.price).toFixed(2)} | Change: +${parseFloat(s.change_percentage).toFixed(2)}% | Volume: ${formatCompactNumber(s.volume)} shares`).join('\n')}

MOST ACTIVELY TRADED (Liquidity Anchors):
${mostActive.slice(0, 3).map((s) => `Ticker: $${s.ticker} | Price: $${parseFloat(s.price).toFixed(2)} | Change: ${parseFloat(s.change_percentage).toFixed(2)}% | Volume: ${formatCompactNumber(s.volume)} shares`).join('\n')}

TOP DECLINERS (Distribution Traps & Pullbacks):
${topLosers.slice(0, 2).map((s) => `Ticker: $${s.ticker} | Price: $${parseFloat(s.price).toFixed(2)} | Change: ${parseFloat(s.change_percentage).toFixed(2)}% | Volume: ${formatCompactNumber(s.volume)} shares`).join('\n')}
    `.trim();

    if (liveCatalystHeadlines.length > 0) {
      stockDataSummary += `\n\nVERIFIED BREAKING CATALYSTS FOR $${leadStock.ticker}:\n${liveCatalystHeadlines.map((h) => `- ${h}`).join('\n')}`;
    } else {
      stockDataSummary += `\n\nVERIFIED BREAKING CATALYSTS FOR $${leadStock.ticker}:\nNo immediate corporate press release or SEC filing detected. Move is primarily driven by technical float turnover, relative volume surges, and retail momentum interest.`;
    }

    const systemPrompt = `You are the Senior Technical Market Strategist for Trade Opportunities (tradeopportunities.trade), an algorithmic momentum intelligence terminal for active equity traders.
Write the tactical market intelligence report for today's "${briefPrefix}".
Cadence Focus: ${briefFocus}

CRITICAL ANTI-REPETITION & VOICE MANDATE:
- Do NOT repeat the exact same canned sentences across dispatches.
- NEVER use these overused cliches:
  * "Unusual price breakout backed by heavy relative volume."
  * "Thin liquidity on sub-$5 names means price moves fast and spreads can widen."
  * "Heavy volume concentration signals strong retail and momentum interest."
  * "Absolute masterclass in high-beta momentum trading."
  * "Pacing the session."
  * "Caught flat-footed."
- Write with sharp, practitioner-grade desk authority: discuss float rotation velocity, relative volume multiples, intraday tape pressure, VWAP defense/reversion, and spread slippage.
- Clearly differentiate between fundamental catalyst-driven surges vs pure technical low-float short squeezes.
- Highlight specific, concrete price levels (support baseline, VWAP anchor, breakout pivot, and hard invalidation stop).

REQUIRED OUTPUT FORMAT:
Line 1: TITLE: <A punchy, informative, unique title highlighting $${leadStock.ticker} and its specific catalyst or session behavior. Example: "$${leadStock.ticker} Explosive Volume Expansion: Midday VWAP Defense (+XX%)">
Line 2: DESCRIPTION: <A 1-sentence meta description summarizing the session move, primary driver, and key pivot level>
Line 3: (blank)
Followed by the article body in structured markdown:
1. Executive Market Pulse (2-3 crisp sentences summarizing current session momentum, volume distribution, and lead mover $${leadStock.ticker}).
2. ### Catalysts & Volume Drivers (Analyze the primary drivers behind $${leadStock.ticker}. Reference the verified news headlines if provided, or explain technical float turnover and momentum if no filing is present).
3. ### Technical Structure & Key Levels (Provide specific tactical levels: VWAP anchor, primary resistance, support baseline, and hard invalidation boundary for $${leadStock.ticker}).
4. ### Market Breadth & Secondary Watchlist (Analyze secondary runners, sympathy plays, and warn against distribution traps among decliners).
5. ### Tactical Execution Plan (3 bullet points providing clear, disciplined risk-reward rules for active traders).

FORMATTING RULES:
- Use standard markdown (### for section headers, * or - for bullet points, bold for emphasis).
- Refer to every ticker using dollar notation (e.g. $${leadStock.ticker}).
- DO NOT invent or embed raw markdown links or HTML.`;

    console.log(`2. Generating differentiated narrative with Gemini for ${briefPrefix} (Lead $${leadStock.ticker})...`);
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
          maxOutputTokens: 2500,
          temperature: 0.65
        }
      })
    });

    if (!llmData.candidates || !llmData.candidates[0]?.content?.parts?.[0]?.text) {
      throw new Error(`Gemini synthesis returned empty structure: ${JSON.stringify(llmData)}`);
    }

    const rawResponse = llmData.candidates[0].content.parts[0].text.trim();

    // Parse dynamic Title, Description, and Body from LLM output
    let parsedTitle = '';
    let parsedDescription = '';
    let parsedBody = rawResponse;

    const lines = rawResponse.split('\n');
    let contentStartIndex = 0;

    for (let i = 0; i < Math.min(lines.length, 6); i++) {
      const line = lines[i].trim();
      if (line.toUpperCase().startsWith('TITLE:')) {
        parsedTitle = line.replace(/^TITLE:\s*/i, '').replace(/^["']|["']$/g, '').trim();
        contentStartIndex = Math.max(contentStartIndex, i + 1);
      } else if (line.toUpperCase().startsWith('DESCRIPTION:')) {
        parsedDescription = line.replace(/^DESCRIPTION:\s*/i, '').replace(/^["']|["']$/g, '').trim();
        contentStartIndex = Math.max(contentStartIndex, i + 1);
      }
    }

    if (contentStartIndex > 0) {
      parsedBody = lines.slice(contentStartIndex).join('\n').trim();
    }

    // Dynamic fallback titles if LLM did not provide structured header
    const leadGainFormatted = `+${parseFloat(leadStock.change_percentage).toFixed(1)}%`;
    if (!parsedTitle) {
      if (briefType === 'MORNING') {
        parsedTitle = `${briefPrefix}: $${leadStock.ticker} Breaks Out (${leadGainFormatted}) on Heavy Opening Drive`;
      } else if (briefType === 'MIDDAY') {
        parsedTitle = `${briefPrefix}: $${leadStock.ticker} (${leadGainFormatted}) Tests Key Midday VWAP Support`;
      } else if (briefType === 'AFTERNOON') {
        parsedTitle = `${briefPrefix}: $${leadStock.ticker} (${leadGainFormatted}) Accelerates into Power Hour`;
      } else {
        parsedTitle = `${briefPrefix}: $${leadStock.ticker} (${leadGainFormatted}) Concludes Session as Primary Momentum Anchor`;
      }
    }

    if (!parsedDescription) {
      parsedDescription = `${briefPrefix} dissecting volume surge in $${leadStock.ticker} (${leadGainFormatted}), breakout catalysts, and key invalidation levels.`;
    }

    console.log('3. Assembling structured brief markdown post...');
    const date = now.toISOString().split('T')[0];
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    const displayTime = now.toTimeString().split(' ')[0].slice(0, 5) + ' UTC';

    const fileName = `brief-${briefType.toLowerCase()}-${timestamp}.md`;
    const compactTable = buildCompactTable('Session Top Movers & Liquidity', topGainers);

    // Sanitize tickers: only allow valid tickers with no special characters
    const allTickers = Array.from(
      new Set([
        ...topGainers.map((s) => s.ticker),
        ...topLosers.map((s) => s.ticker),
        ...mostActive.map((s) => s.ticker)
      ])
    ).filter(isValidTicker);

    const generatedAnalysis = sanitizeAndLinkify(parsedBody, allTickers);

    const markdownContent = `---
title: "${parsedTitle.replace(/"/g, '\\"')}"
description: "${parsedDescription.replace(/"/g, '\\"')}"
briefType: "${briefType}"
date: "${now.toISOString()}"
pubDate: "${now.toISOString()}"
updatedDate: "${now.toISOString()}"
displayDate: "${date} ${displayTime}"
category: "Equities"
categories: ["Equities", "Momentum", "${briefCategory}"]
image: "https://tradeopportunities.trade/favicon.svg"
leadTicker: "${leadStock.ticker}"
leadGain: "${leadGainFormatted}"
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