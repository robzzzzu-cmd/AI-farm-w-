const fs = require('fs');

async function run() {
  const alphaVantageKey = process.env.ALPHA_VANTAGE_API_KEY;
  const llmApiKey = process.env.LLM_API_KEY;

  if (!alphaVantageKey || !llmApiKey) {
    console.error("Missing API keys. Please check GitHub Secrets.");
    process.exit(1);
  }

  try {
    console.log("1. Fetching market data from Alpha Vantage...");
    
    const avUrl = `https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${alphaVantageKey}`;
    const avResponse = await fetch(avUrl);
    const marketData = await avResponse.json();

    if (!marketData.top_gainers) {
      throw new Error(`Alpha Vantage API error: ${JSON.stringify(marketData)}`);
    }

    const topGainers = marketData.top_gainers.slice(0, 3).map(stock => 
      `${stock.ticker}: +${stock.change_percentage} (Volume: ${stock.volume})`
    ).join("\n");

    const systemPrompt = "You are a financial copywriter. Write a punchy, 2-sentence push notification update based on these top gaining stocks.";
    
    console.log("2. Generating content with AI...");

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
              { text: `${systemPrompt}\n\nHere are today's top gainers:\n${topGainers}` }
            ]
          }
        ]
      })
    });

    const llmData = await llmResponse.json();

    if (!llmData.candidates || !llmData.candidates[0]) {
      throw new Error("Failed to get a valid response from Gemini.");
    }

    const generatedContent = llmData.candidates[0].content.parts[0].text;

    console.log("3. Formatting output for the static website...");
    const date = new Date().toISOString().split('T')[0];
    const fileName = `market-update-${date}.md`;
    const folderPath = './short-series/src/content/blog';

    if (!fs.existsSync(folderPath)){
        fs.mkdirSync(folderPath, { recursive: true });
    }

    const markdownContent = `---
title: Market Movers for ${date}
date: ${date}
tags: [finance, stocks, market-update]
---

# Top Market Gainers - ${date}

${generatedContent}

---
*Disclaimer: This is an automated AI report. Not financial advice.*

🚀 **[Trade these breakouts on Binance and get a $100 Signup Bonus!](https://accounts.binance.com/register?ref=YOUR_REFERRAL_CODE)**
`;

    fs.writeFileSync(`${folderPath}/${fileName}`, markdownContent);
    console.log(`✅ Successfully saved ${fileName}`);

  } catch (error) {
    console.error("Workflow failed:", error.message);
    process.exit(1);
  }
}

run();
