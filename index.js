const fs = require('fs');

async function run() {
  const alphaVantageKey = process.env.ALPHA_VANTAGE_API_KEY;
  const llmApiKey = process.env.LLM_API_KEY;

  if (!alphaVantageKey || !llmApiKey) {
    console.error("Missing API keys. Please verify GitHub Repository Secrets.");
    process.exit(1);
  }

  try {
    console.log("1. Fetching market data from Alpha Vantage...");
    
    const avUrl = `https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${alphaVantageKey}`;
    const avResponse = await fetch(avUrl);
    const marketData = await avResponse.json();

    if (!marketData.top_gainers || marketData.top_gainers.length === 0) {
      throw new Error(`Alpha Vantage API error: ${JSON.stringify(marketData)}`);
    }

    const topGainers = marketData.top_gainers.slice(0, 4);
    const leadStock = topGainers[0];
    
    const stockDataSummary = topGainers.map(stock => 
      `Ticker: ${stock.ticker} | Price: $${parseFloat(stock.price).toFixed(2)} | Change: +${parseFloat(stock.change_percentage).toFixed(2)}% | Volume: ${Number(stock.volume).toLocaleString()}`
    ).join("\n");

    const systemPrompt = `You are a senior quantitative equity analyst at Trade Opportunities. 
Analyze the provided high-momentum assets. Write an institutional, data-driven 2-3 sentence market summary explaining the price action, liquidity expansion, and risk factors. 
Maintain a rigorous, analytical tone. Do NOT use promotional hype or sensationalist phrasing. Focus on technical structure and volume conviction.`;

    console.log("2. Synthesizing market intelligence...");

    const llmResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent", {
      method: "POST",
      headers: {
        "x-goog-api-key": llmApiKey,
        "Content-Type": "application/json"
      },
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
    const date = new Date().toISOString().split('T')[0];
    const fileName = `market-update-${date}.md`;
    const folderPath = './short-series/src/content/blog';

    if (!fs.existsSync(folderPath)){
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const markdownContent = `---
title: "Momentum Scan: ${leadStock.ticker} Leads Expansion (${parseFloat(leadStock.change_percentage).toFixed(1)}%)"
date: "${date}"
category: "Equities Momentum"
leadTicker: "${leadStock.ticker}"
leadGain: "+${parseFloat(leadStock.change_percentage).toFixed(1)}%"
tickers: [${topGainers.map(s => `"${s.ticker}"`).join(', ')}]
refUrl: "https://changenow.app.link/referral?link_id=1c434a8e93e8ff"
refLabel: "Execute Spot Order on ChangeNOW"
---

${generatedContent}
`;

    fs.writeFileSync(`${folderPath}/${fileName}`, markdownContent);
    console.log(`Successfully generated and stored ${fileName}`);

  } catch (error) {
    console.error("Pipeline failure:", error.message);
    process.exit(1);
  }
}

run();
