const fs = require('fs');

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

function buildMarkdownTable(title, items) {
  if (!items || items.length === 0) return '';

  let table = `### ${title}\n\n`;
  table += `| Ticker | Last Price | 24h Change | Volume | Action |\n`;
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

async function run() {
  const alphaVantageKey = process.env.ALPHA_VANTAGE_API_KEY;
  const llmApiKey = process.env.LLM_API_KEY;

  if (!alphaVantageKey || !llmApiKey) {
    console.error('Missing required API keys. Verify ALPHA_VANTAGE_API_KEY and LLM_API_KEY.');
    process.exit(1);
  }

  try {
    console.log('1. Fetching market movers from Alpha Vantage...');
    const avUrl = `https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${alphaVantageKey}`;
    const marketData = await fetchWithRetry(avUrl);

    if (marketData.Note || marketData.Information) {
      throw new Error(`Alpha Vantage API rate-limited: ${marketData.Note || marketData.Information}`);
    }

    if (!marketData.top_gainers || marketData.top_gainers.length === 0) {
      throw new Error(`Invalid Alpha Vantage payload: ${JSON.stringify(marketData)}`);
    }

    // FILTER: Require at least 50,000 volume to eliminate phantom warrant spikes (e.g., 521 volume)
    const liquidGainers = (marketData.top_gainers || []).filter((s) => Number(s.volume || 0) >= 50000);
    const topGainers = (liquidGainers.length >= 3 ? liquidGainers : marketData.top_gainers).slice(0, 5);
    const topLosers = (marketData.top_losers || []).slice(0, 5);
    const mostActive = (marketData.most_actively_traded || []).slice(0, 5);

    const leadStock = topGainers[0];

    const stockDataSummary = `
TOP GAINER: ${leadStock.ticker} (Price: $${parseFloat(leadStock.price).toFixed(2)}, Gain: +${parseFloat(leadStock.change_percentage).toFixed(2)}%, Volume: ${Number(leadStock.volume).toLocaleString()})
OTHER GAINERS: ${topGainers.slice(1).map((s) => `${s.ticker} (+${parseFloat(s.change_percentage).toFixed(1)}%)`).join(', ')}
MOST ACTIVE VOLUME: ${mostActive.slice(0, 3).map((s) => `${s.ticker} (${Number(s.volume).toLocaleString()} vol)`).join(', ')}
    `.trim();

    // STRICT, SHORT PROMPT: Eliminates code blocks, ASCII tables, and multi-page essays
    const systemPrompt = `You are a concise financial momentum analyst.
Write a punchy, ultra-concise market dispatch under 100 words total.
DO NOT output code blocks, markdown tables, ASCII tables, or disclaimers.

Respond with EXACTLY three short bullet points:
- **Momentum Overview:** 1 short sentence on overall market breadth and leading volume.
- **Key Levels for $${leadStock.ticker}:** 1 sentence noting immediate support and resistance.
- **Risk Takeaway:** 1 short sentence on execution or volatility risk.

CRITICAL FORMATTING:
- Every ticker MUST be linked as: [$TICKER](https://www.tradingview.com/symbols/$TICKER/?aff_id=170147)`;

    console.log('2. Generating concise synthesis with Gemini...');
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${llmApiKey}`;
    
    const llmData = await fetchWithRetry(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: `${systemPrompt}\n\nMarket Data:\n${stockDataSummary}` }
            ]
          }
        ],
        generationConfig: {
          maxOutputTokens: 250,
          temperature: 0.3
        }
      })
    });

    if (!llmData.candidates || !llmData.candidates[0]?.content?.parts?.[0]?.text) {
      throw new Error(`Gemini synthesis returned empty structure: ${JSON.stringify(llmData)}`);
    }

    const generatedAnalysis = llmData.candidates[0].content.parts[0].text.trim();

    console.log('3. Assembling structured markdown post...');
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    const displayTime = now.toTimeString().split(' ')[0].slice(0, 5) + ' UTC';

    const fileName = `market-update-${timestamp}.md`;
    const folderPath = './short-series/src/content/blog';

    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const gainersTable = buildMarkdownTable('Top Momentum Gainers', topGainers);
    const losersTable = buildMarkdownTable('Top Session Decliners', topLosers);
    const activeTable = buildMarkdownTable('Highest Volume Liquidity Leaders', mostActive);

    const allTickers = Array.from(
      new Set([
        ...topGainers.map((s) => s.ticker),
        ...topLosers.map((s) => s.ticker),
        ...mostActive.map((s) => s.ticker)
      ])
    );

    const markdownContent = `---
title: "Momentum Scan: ${leadStock.ticker} Leads Expansion (+${parseFloat(leadStock.change_percentage).toFixed(1)}%)"
description: "US equity market momentum scan detailing volume expansion in ${leadStock.ticker}, session gainers, decliners, and high-volume leaders."
date: "${now.toISOString()}"
pubDate: "${now.toISOString()}"
displayDate: "${date} ${displayTime}"
category: "Equities"
categories:
  - Equities
tags:
  - Equities
  - Momentum
  - VolumeLeaders
  - ${leadStock.ticker}
leadTicker: "${leadStock.ticker}"
leadGain: "+${parseFloat(leadStock.change_percentage).toFixed(1)}%"
tickers: [${allTickers.map((t) => `"${t}"`).join(', ')}]
gainers: ${JSON.stringify(topGainers)}
losers: ${JSON.stringify(topLosers)}
active: ${JSON.stringify(mostActive)}
refUrl: "https://www.tradingview.com/symbols/${leadStock.ticker}/?aff_id=170147"
refLabel: "Analyze ${leadStock.ticker} on TradingView"
---

${gainersTable}
${losersTable}
${activeTable}

### Market Intelligence & Key Levels

${generatedAnalysis}
`;

    fs.writeFileSync(`${folderPath}/${fileName}`, markdownContent);
    console.log(`Saved structured markdown: ${fileName}`);
  } catch (error) {
    console.error('Pipeline execution error:', error.message);
    process.exit(1);
  }
}

run();
