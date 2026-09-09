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
  const llmApiKey = process.env.LLM_API_KEY;

  if (!alphaVantageKey || !llmApiKey) {
    console.error('Missing required API keys.');
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

    console.log(`1. Fetching live market movers from Alpha Vantage for ${briefPrefix}...`);
    const avUrl = `https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${alphaVantageKey}`;
    const marketData = await fetchWithRetry(avUrl);

    if (marketData.Note || marketData.Information) {
      throw new Error(`Alpha Vantage rate-limited: ${marketData.Note || marketData.Information}`);
    }

    if (!marketData.top_gainers || marketData.top_gainers.length === 0) {
      throw new Error(`Invalid Alpha Vantage payload: ${JSON.stringify(marketData)}`);
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

    const stockDataSummary = `
SESSION MOVERS FOR ${briefPrefix}:
LEAD MOVER: $${leadStock.ticker} (Price: $${parseFloat(leadStock.price).toFixed(2)}, Change: +${parseFloat(leadStock.change_percentage).toFixed(2)}%, Vol: ${formatCompactNumber(leadStock.volume)})

TOP GAINERS (Momentum Breakouts):
${topGainers.map((s) => `Ticker: $${s.ticker} | Price: $${parseFloat(s.price).toFixed(2)} | Change: +${parseFloat(s.change_percentage).toFixed(2)}% | Volume: ${formatCompactNumber(s.volume)} shares`).join('\n')}

MOST ACTIVELY TRADED (Liquidity Anchors):
${mostActive.slice(0, 3).map((s) => `Ticker: $${s.ticker} | Price: $${parseFloat(s.price).toFixed(2)} | Change: ${parseFloat(s.change_percentage).toFixed(2)}% | Volume: ${formatCompactNumber(s.volume)} shares`).join('\n')}

TOP DECLINERS (Distribution & Pullbacks):
${topLosers.slice(0, 2).map((s) => `Ticker: $${s.ticker} | Price: $${parseFloat(s.price).toFixed(2)} | Change: ${parseFloat(s.change_percentage).toFixed(2)}% | Volume: ${formatCompactNumber(s.volume)} shares`).join('\n')}
    `.trim();

    const systemPrompt = `You are the Chief Market Strategist for Trade Opportunities (tradeopportunities.trade).
Write the analytical narrative for today's "${briefPrefix}".
Primary focus: ${briefFocus}

TONE REQUIREMENTS:
- Use concise, objective, institutional trader vernacular.
- DO NOT use hyperbolic, tabloid, or AI-cliché phrases ("stunned institutional desks", "speculative frenzy", "sharp liquidity rotation").
- Prefer measured analytical formulations:
  * "Unusual price expansion accompanied by elevated relative volume."
  * "Liquidity remains thin across sub-$5 equities, increasing execution slippage risk."
  * "Volume concentration indicates localized retail interest."

STRUCTURE:
1. Lead with market regime context and lead mover $${leadStock.ticker} stating its percentage expansion and volume.
2. Analyze secondary momentum across adjacent gainers and whether morning volume is consolidating or fading.
3. Quantify liquidity distribution and contrast micro-cap volatility with active volume anchors.
4. Detail execution risks, order book depth, and key pivot levels for the next trading window.

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