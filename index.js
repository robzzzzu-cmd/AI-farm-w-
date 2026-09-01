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

function buildCompactTable(title, items) {
  if (!items || items.length === 0) return '';

  let table = `#### ${title}\n\n`;
  table += `| Ticker | Price | 24h Change | Volume | Action |\n`;
  table += `| :--- | :--- | :--- | :--- | :--- |\n`;

  for (const s of items) {
    const rawPrice = parseFloat(s.price);
    const rawChange = parseFloat(s.change_percentage);
    const price = !isNaN(rawPrice) ? `$${rawPrice.toFixed(2)}` : '$0.00';
    const sign = rawChange > 0 ? '+' : '';
    const change = !isNaN(rawChange) ? `${sign}${rawChange.toFixed(2)}%` : '0.00%';
    const vol = Number(s.volume || 0).toLocaleString();
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

    const liquidGainers = (marketData.top_gainers || []).filter((s) => Number(s.volume || 0) >= 50000);
    const topGainers = (liquidGainers.length >= 3 ? liquidGainers : marketData.top_gainers).slice(0, 5);
    const topLosers = (marketData.top_losers || []).slice(0, 5);
    const mostActive = (marketData.most_actively_traded || []).slice(0, 5);

    const leadStock = topGainers[0];

    const stockDataSummary = `
TOP GAINERS (Momentum Breakouts):
${topGainers.map((s) => `Ticker: $${s.ticker} | Price: $${parseFloat(s.price).toFixed(2)} | Change: +${parseFloat(s.change_percentage).toFixed(2)}% | Volume: ${Number(s.volume).toLocaleString()} shares`).join('\n')}

MOST ACTIVELY TRADED (Liquidity Anchors):
${mostActive.slice(0, 3).map((s) => `Ticker: $${s.ticker} | Price: $${parseFloat(s.price).toFixed(2)} | Change: ${parseFloat(s.change_percentage).toFixed(2)}% | Volume: ${Number(s.volume).toLocaleString()} shares`).join('\n')}

TOP DECLINERS (Distribution & Pullbacks):
${topLosers.slice(0, 2).map((s) => `Ticker: $${s.ticker} | Price: $${parseFloat(s.price).toFixed(2)} | Change: ${parseFloat(s.change_percentage).toFixed(2)}% | Volume: ${Number(s.volume).toLocaleString()} shares`).join('\n')}
    `.trim();

    const systemPrompt = `You are an institutional financial news journalist for Trade Opportunities.
Write a detailed 6 to 9 sentence equity market news report analyzing today's momentum breakouts and liquidity rotation.

Key requirements:
1. Lead with the top gainer ($${leadStock.ticker}), explaining its percentage surge and volume.
2. Discuss secondary momentum across the other top gainers.
3. Analyze retail speculative interest, order routing, and liquidity flow in sub-dollar equities.
4. Compare breakout action to active volume leaders and decliners.
5. Emphasize trade execution risks, spread slippage, and mean-reversion pullbacks as session volume exhausts.

CRITICAL RULES:
- Write strictly 6 to 9 continuous, complete sentences.
- DO NOT use markdown headings (#, ##), subheadings, or bullet points.
- Refer to every ticker using standard dollar notation (e.g., $${leadStock.ticker}). DO NOT write markdown links or URLs.
- DO NOT use raw comparison symbols like "<" or ">" (write "under $1" instead of "< $1", and "greater than" instead of ">").
- Return ONLY the news text.`;

    console.log('2. Generating complete news dispatch with Gemini...');
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${llmApiKey}`;
    
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
          temperature: 0.25
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

    const slug = `market-update-${timestamp}`;
    const fileName = `${slug}.md`;
    
    const folderPath = fs.existsSync('./src/content/blog')
      ? './src/content/blog'
      : './short-series/src/content/blog';

    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const compactTable = buildCompactTable('Session Top Movers & Liquidity', topGainers);

    const allTickers = Array.from(
      new Set([
        ...topGainers.map((s) => s.ticker),
        ...topLosers.map((s) => s.ticker),
        ...mostActive.map((s) => s.ticker)
      ])
    );

    const generatedAnalysis = sanitizeAndLinkify(rawAnalysis, allTickers);
    const ogImageUrl = `https://tradeopportunities.trade/og/${slug}.svg`;

    const markdownContent = `---
title: "Momentum Scan: ${leadStock.ticker} Leads Expansion (+${parseFloat(leadStock.change_percentage).toFixed(1)}%)"
description: "Market intelligence report on liquidity expansion in ${leadStock.ticker} and active breakout leaders."
date: "${now.toISOString()}"
pubDate: "${now.toISOString()}"
updatedDate: "${now.toISOString()}"
displayDate: "${date} ${displayTime}"
category: "Equities"
categories: ["Equities", "Momentum"]
image: "${ogImageUrl}"
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
  } catch (error) {
    console.error('Pipeline execution error:', error.message);
    process.exit(1);
  }
}

run();
