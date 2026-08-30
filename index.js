const fs = require('fs');

async function run() {
  const alphaVantageKey = process.env.ALPHA_VANTAGE_API_KEY;
  const llmApiKey = process.env.LLM_API_KEY;
  const resendApiKey = process.env.RESEND_API_KEY;

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
Review the provided market movers and write a concise 2-3 sentence institutional market summary explaining price action, volume expansion, and risk factors.
CRITICAL FORMATTING INSTRUCTION: Whenever you mention a stock ticker, format it strictly as a markdown hyperlink in this exact format: [$TICKER](https://www.tradingview.com/symbols/$TICKER/?aff_id=170147).
Maintain a rigorous, data-driven institutional tone. Do not include promotional filler.`;

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
    
    const fileName = `market-update-${timestamp}.md`;
    const folderPath = './short-series/src/content/blog';

    if (!fs.existsSync(folderPath)){
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const markdownContent = `---
title: "Momentum Scan: ${leadStock.ticker} Leads Expansion (+${parseFloat(leadStock.change_percentage).toFixed(1)}%)"
date: "${now.toISOString()}"
displayDate: "${date} ${displayTime}"
category: "Equities Momentum"
leadTicker: "${leadStock.ticker}"
leadGain: "+${parseFloat(leadStock.change_percentage).toFixed(1)}%"
tickers: [${topGainers.map(s => `"${s.ticker}"`).join(', ')}]
gainers: ${JSON.stringify(topGainers)}
losers: ${JSON.stringify(topLosers)}
active: ${JSON.stringify(mostActive)}
refUrl: "https://changenow.app.link/referral?link_id=1c434a8e93e8ff"
refLabel: "Execute Spot Order on ChangeNOW"
---

${generatedContent}
`;

    fs.writeFileSync(`${folderPath}/${fileName}`, markdownContent);
    console.log(`Saved markdown: ${fileName}`);

    // 4. Automated Zero-Token Broadcast via Resend
    if (resendApiKey) {
      console.log("4. Fetching Audience and dispatching email broadcast...");
      
      const audienceRes = await fetch('https://api.resend.com/audiences', {
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        }
      });
      const audienceJson = await audienceRes.json();
      const audienceId = audienceJson.data?.[0]?.id;

      if (!audienceId) {
        console.warn("No Resend audience found. Email broadcast skipped.");
      } else {
        const broadcastRes = await fetch('https://api.resend.com/broadcasts', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            audience_id: audienceId,
            from: 'Trade Opportunities <intel@tradeopportunities.trade>',
            subject: `Market Momentum: ${leadStock.ticker} (+${parseFloat(leadStock.change_percentage).toFixed(1)}%)`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #0f172a; padding: 20px;">
                <h2 style="font-size: 18px; margin-bottom: 12px; color: #1e293b;">Market Intelligence Brief (${displayTime})</h2>
                <div style="font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 24px;">
                  ${generatedContent.replace(/\n/g, '<br/>')}
                </div>
                <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; margin-bottom: 16px;">
                  <a href="https://tradeopportunities.trade" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 600; padding: 8px 16px; border-radius: 4px;">
                    Open Live Terminal &rarr;
                  </a>
                </div>
                <p style="font-size: 11px; color: #94a3b8;">
                  You received this because you subscribed on tradeopportunities.trade.<br/>
                  <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color: #64748b;">Unsubscribe</a>
                </p>
              </div>
            `,
            send: true
          })
        });

        const broadcastData = await broadcastRes.json();
        console.log("Broadcast status:", broadcastData);
      }
    }

  } catch (error) {
    console.error("Pipeline failure:", error.message);
    process.exit(1);
  }
}

run();
