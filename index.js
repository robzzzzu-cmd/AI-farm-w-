import fs from 'fs';

interface StockItem {
  ticker: string;
  price: string;
  change_amount: string;
  change_percentage: string;
  volume: string;
}

interface AVResponse {
  top_gainers?: StockItem[];
  top_losers?: StockItem[];
  most_actively_traded?: StockItem[];
  Information?: string;
  Note?: string;
}

async function run() {
  const alphaVantageKey = process.env.ALPHA_VANTAGE_API_KEY;
  const llmApiKey = process.env.LLM_API_KEY;

  if (!alphaVantageKey || !llmApiKey) {
    console.error("Missing API keys in environment variables.");
    process.exit(1);
  }

  try {
    console.log("1. Fetching comprehensive market data...");
    const avUrl = `https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${alphaVantageKey}`;
    const avRes = await fetch(avUrl);
    const marketData = (await avRes.json()) as AVResponse;

    if (!marketData.top_gainers || marketData.top_gainers.length === 0) {
      throw new Error(`Alpha Vantage Response Issue: ${JSON.stringify(marketData)}`);
    }

    const topGainers = marketData.top_gainers.slice(0, 5);
    const topLosers = marketData.top_losers?.slice(0, 5) || [];
    const mostActive = marketData.most_actively_traded?.slice(0, 5) || [];
    const leadStock = topGainers[0];

    const dataSummary = `
TOP GAINERS:
${topGainers.map(s => `${s.ticker}: $${s.price} (+${s.change_percentage}) Vol: ${Number(s.volume).toLocaleString()}`).join('\n')}

TOP LOSERS:
${topLosers.map(s => `${s.ticker}: $${s.price} (${s.change_percentage}) Vol: ${Number(s.volume).toLocaleString()}`).join('\n')}

MOST ACTIVE:
${mostActive.map(s => `${s.ticker}: $${s.price} (${s.change_percentage}) Vol: ${Number(s.volume).toLocaleString()}`).join('\n')}
    `.trim();

    console.log("2. Generating quantitative synthesis...");
    const systemPrompt = `You are a quantitative market analyst at Trade Opportunities.
Review the market movers and provide a sharp 3-sentence technical briefing covering:
1. Primary momentum drivers in the top gainer.
2. Volume conviction and divergence across active names.
3. Volatility/liquidity risks traders must account for.
Tone: Institutional, concise, analytical. No sensationalism or hype.`;

    const llmResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${llmApiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: `${systemPrompt}\n\nMarket Data Feed:\n${dataSummary}` }]
        }]
      })
    });

    const llmData = await llmResponse.json();
    const generatedContent = llmData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!generatedContent) {
      throw new Error(`Gemini synthesis failed: ${JSON.stringify(llmData)}`);
    }

    console.log("3. Writing dispatch and live snapshot data...");
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
    const fileName = `market-update-${dateStr}-${timeStr}.md`;
    const folderPath = './short-series/src/content/blog';

    if (!fs.existsSync(folderPath)){
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const markdownContent = `---
title: "Market Scan: ${leadStock.ticker} Outperforms (+${parseFloat(leadStock.change_percentage).toFixed(1)}%)"
date: "${now.toISOString()}"
displayDate: "${dateStr} ${now.toTimeString().split(' ')[0].slice(0, 5)} UTC"
category: "Momentum Scan"
leadTicker: "${leadStock.ticker}"
leadGain: "+${parseFloat(leadStock.change_percentage).toFixed(1)}%"
tickers: [${topGainers.map(s => `"${s.ticker}"`).join(', ')}]
moversData: ${JSON.stringify({ gainers: topGainers, losers: topLosers, active: mostActive })}
refUrl: "https://www.tradingview.com/symbols/${leadStock.ticker}/?aff_id=170147"
refLabel: "Analyze ${leadStock.ticker} on TradingView"
---

${generatedContent}
`;

    fs.writeFileSync(`${folderPath}/${fileName}`, markdownContent);
    console.log(`Saved: ${fileName}`);

  } catch (error: any) {
    console.error("Pipeline failure:", error.message);
    process.exit(1);
  }
}

run();
