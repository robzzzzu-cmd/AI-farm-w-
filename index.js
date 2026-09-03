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
    console.log('1. Fetching market movers from Alpha Vantage...');
    const avUrl = `https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${alphaVantageKey}`;
    const marketData = await fetchWithRetry(avUrl);

    if (marketData.Note || marketData.Information) {
      throw new Error(`Alpha Vantage rate-limited: ${marketData.Note || marketData.Information}`);
    }

    if (!marketData.top_gainers || marketData.top_gainers.length === 0) {
      throw new Error(`Invalid Alpha Vantage payload: ${JSON.stringify(marketData)}`);
    }

    const folderPath = fs.existsSync('./src/content/blog')
      ? './src/content/blog'
      : './short-series/src/content/blog';

    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    // Identify tickers already featured today
    const todayPrefix = new Date().toISOString().split('T')[0];
    const existingPostsToday = fs.readdirSync(folderPath).filter((file) => file.includes(todayPrefix));
    const coveredLeadTickers = new Set();

    for (const file of existingPostsToday) {
      try {
        const raw = fs.readFileSync(path.join(folderPath, file), 'utf-8');
        const match = raw.match(/leadTicker:\s*["']?([A-Za-z0-9]+)["']?/);
        if (match) coveredLeadTickers.add(match[1].toUpperCase());
      } catch (_) {}
    }

    console.log('Already covered today:', Array.from(coveredLeadTickers));

    // Filter out illiquid sub-penny warrants and require minimum liquidity thresholds
    const liquidGainers = (marketData.top_gainers || []).filter((s) => {
      const vol = Number(s.volume || 0);
      const price = parseFloat(s.price || 0);
      const dollarVolume = vol * price;
      const isPennyWarrant = s.ticker.endsWith('W') && price < 0.05;
      return vol >= 50000 && dollarVolume >= 100000 && !isPennyWarrant;
    });

    const candidateGainers = liquidGainers.length >= 2 ? liquidGainers : marketData.top_gainers;

    // Pick the highest-ranked gainer not yet covered today
    let leadStock = candidateGainers.find((s) => !coveredLeadTickers.has(s.ticker.toUpperCase()));

    // Fallback: If top gainers are all covered, evaluate high-volume active rotation
    if (!leadStock) {
      leadStock = (marketData.most_actively_traded || []).find(
        (s) => !coveredLeadTickers.has(s.ticker.toUpperCase()) && Math.abs(parseFloat(s.change_percentage)) >= 5
      );
    }

    // Unproductive market check: Avoid repeating dispatches if no new momentum has developed
    if (!leadStock) {
      console.log('No new significant momentum shifts detected today. Skipping duplicate dispatch.');
      if (process.env.GITHUB_OUTPUT) {
        fs.appendFileSync(process.env.GITHUB_OUTPUT, 'has_new_post=false\n');
      }
      process.exit(0);
    }

    const otherGainers = candidateGainers.filter((s) => s.ticker.toUpperCase() !== leadStock.ticker.toUpperCase());
    const topGainers = [leadStock, ...otherGainers].slice(0, 5);
    const topLosers = (marketData.top_losers || []).slice(0, 5);
    const mostActive = (marketData.most_actively_traded || []).slice(0, 5);

    const stockDataSummary = `
TOP GAINERS (Momentum Breakouts):
${topGainers.map((s) => `Ticker: $${s.ticker} | Price: $${parseFloat(s.price).toFixed(2)} | Change: +${parseFloat(s.change_percentage).toFixed(2)}% | Volume: ${formatCompactNumber(s.volume)} shares`).join('\n')}

MOST ACTIVELY TRADED (Liquidity Anchors):
${mostActive.slice(0, 3).map((s) => `Ticker: $${s.ticker} | Price: $${parseFloat(s.price).toFixed(2)} | Change: ${parseFloat(s.change_percentage).toFixed(2)}% | Volume: ${formatCompactNumber(s.volume)} shares`).join('\n')}

TOP DECLINERS (Distribution & Pullbacks):
${topLosers.slice(0, 2).map((s) => `Ticker: $${s.ticker} | Price: $${parseFloat(s.price).toFixed(2)} | Change: ${parseFloat(s.change_percentage).toFixed(2)}% | Volume: ${formatCompactNumber(s.volume)} shares`).join('\n')}
    `.trim();

    const systemPrompt = `You are a quantitative market analyst for Trade Opportunities, a professional financial intelligence company.
Write a 6 to 9 sentence analytical market intelligence dispatch analyzing today's volume expansion and price anomalies.

TONE REQUIREMENTS:
- Use concise, objective, institutional language.
- DO NOT use hyperbolic, tabloid, or AI-cliché phrases like:
  * "stunned institutional desks"
  * "speculative frenzy"
  * "aggressive order routing"
  * "sharp liquidity rotation"
- Prefer measured analytical formulations:
  * "Unusual price expansion accompanied by elevated volume."
  * "Liquidity remains thin, increasing execution risk."
  * "Momentum is concentrated in low-priced equities."
  * "Volume concentration indicates localized retail interest."

STRUCTURE:
1. Lead with $${leadStock.ticker}, stating its measured percentage expansion and relative volume.
2. Outline secondary momentum observed across adjacent gainers.
3. Quantify liquidity distribution and contrast micro-cap momentum with active volume anchors.
4. Detail execution risks, note thin order book depth, and address potential spread slippage or mean-reversion vulnerability upon session exhaustion.

CRITICAL RULES:
- Write strictly 6 to 9 continuous sentences in a single paragraph.
- DO NOT use markdown headings (#, ##), subheadings, or bullet points.
- Refer to every ticker using standard dollar notation (e.g. $${leadStock.ticker}).
- DO NOT invent or embed raw markdown links or HTML.
- Return ONLY the paragraph text.`;

    console.log(`2. Generating news dispatch with Gemini for lead asset $${leadStock.ticker}...`);
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

    console.log('3. Assembling structured markdown post...');
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    const displayTime = now.toTimeString().split(' ')[0].slice(0, 5) + ' UTC';

    const fileName = `market-update-${timestamp}.md`;
    const compactTable = buildCompactTable('Session Top Movers & Liquidity', topGainers);

    const allTickers = Array.from(
      new Set([
        ...topGainers.map((s) => s.ticker),
        ...topLosers.map((s) => s.ticker),
        ...mostActive.map((s) => s.ticker)
      ])
    );

    const generatedAnalysis = sanitizeAndLinkify(rawAnalysis, allTickers);

    const markdownContent = `---
title: "Momentum Scan: ${leadStock.ticker} Leads Expansion (+${parseFloat(leadStock.change_percentage).toFixed(1)}%)"
description: "Quantitative market report on liquidity expansion in ${leadStock.ticker} and active breakout leaders."
date: "${now.toISOString()}"
pubDate: "${now.toISOString()}"
updatedDate: "${now.toISOString()}"
displayDate: "${date} ${displayTime}"
category: "Equities"
categories: ["Equities", "Momentum"]
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
    console.log(`Saved structured markdown: ${fileName} into ${folderPath}`);

    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, 'has_new_post=true\n');
    }
  } catch (error) {
    console.error('Pipeline execution error:', error.message);
    process.exit(1);
  }
}

run();
