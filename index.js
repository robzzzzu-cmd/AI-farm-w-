const fs = require('fs');

async function run() {
  const alphaVantageKey = process.env.ALPHA_VANTAGE_API_KEY;
  const llmApiKey = process.env.LLM_API_KEY;

  if (!alphaVantageKey || !llmApiKey) {
    console.error("Missing API keys. Please verify GitHub Repository Secrets.");
    process.exit(1);
  }

  try {
    console.log("1. Fetching comprehensive market data from Alpha Vantage...");
    const avUrl = `https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${alphaVantageKey}`;
    const avResponse = await fetch(avUrl);
    const marketData = await avResponse.json();

    if (!marketData.top_gainers || marketData.top_gainers.length === 0) {
      throw new Error(`Alpha Vantage API error: ${JSON.stringify(marketData)}`);
    }

    const topGainers = marketData.top_gainers.slice(0, 4);
    const topLosers = (marketData.top_losers || []).slice(0, 4);
    const mostActive = (marketData.most_actively_traded || []).slice(0, 4);
    const leadStock = topGainers[0];

    const stockDataSummary = `
TOP GAINERS:
${topGainers.map(s => `Ticker: ${s.ticker} | Price: $${parseFloat(s.price).toFixed(2)} | Change: +${parseFloat(s.change_percentage).toFixed(2)}% | Volume: ${Number(s.volume).toLocaleString()}`).join('\n')}

TOP LOSERS:
${topLosers.map(s => `Ticker: ${s.ticker} | Price: $${parseFloat(s.price).toFixed(2)} | Change: ${parseFloat(s.change_percentage).toFixed(2)}% | Volume: ${Number(s.volume).toLocaleString()}`).join('\n')}

MOST ACTIVE:
${mostActive.map(s => `Ticker: ${s.ticker} | Price: $${parseFloat(s.price).toFixed(2)} | Change: ${parseFloat(s.change_percentage).toFixed(2)}% | Volume: ${Number(s.volume).toLocaleString()}`).join('\n')}
    `.trim();

    const systemPrompt = `You are a quantitative equity analyst at Trade Opportunities.
Review the provided market movers and write a concise 2-3 sentence technical dispatch explaining the primary momentum catalyst, liquidity flow divergence, and immediate volatility risk.
Maintain a strict institutional tone. Do NOT use promotional hype or sensationalism.`;

    console.log("2. Synthesizing market intelligence with Gemini...");
    const llmResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${llmApiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: `${systemPrompt}\n\nMarket Data Feed:\n${stockDataSummary}` }
            ]
          }
        ]
      })
    });

    const llmData = await llmResponse.json();

    if (!llmData.candidates || !llmData.candidates[0]) {
      throw new Error(`Gemini synthesis failed: ${JSON.stringify(llmData)}`);
    }

    const generatedContent = llmData.candidates[0].content.parts[0].text.trim();

    console.log("3. Writing structured dispatch file...");
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    const displayTime = now.toTimeString().split(' ')[0].slice(0, 5) + ' UTC';
    
    // Unique filename per run to avoid overwriting midday/close scans
    const fileName = `market-update-${timestamp}.md`;
    const folderPath = './short-series/src/content/blog';

    if (!fs.existsSync(folderPath)){
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const markdownContent = `---
title: "Momentum Scan: ${leadStock.ticker} Outperforms (+${parseFloat(leadStock.change_percentage).toFixed(1)}%)"
date: "${now.toISOString()}"
displayDate: "${date} ${displayTime}"
category: "Equities Momentum"
leadTicker: "${leadStock.ticker}"
leadGain: "+${parseFloat(leadStock.change_percentage).toFixed(1)}%"
tickers: [${topGainers.map(s => `"${s.ticker}"`).join(', ')}]
gainers: ${JSON.stringify(topGainers)}
losers: ${JSON.stringify(topLosers)}
active: ${JSON.stringify(mostActive)}
refUrl: "https://www.tradingview.com/symbols/${leadStock.ticker}/?aff_id=170147"
refLabel: "Analyze ${leadStock.ticker} Chart"
---

${generatedContent}
`;

    fs.writeFileSync(`${folderPath}/${fileName}`, markdownContent);
    console.log(`Successfully generated: ${fileName}`);

  } catch (error) {
    console.error("Pipeline failure:", error.message);
    process.exit(1);
  }
}

run();
