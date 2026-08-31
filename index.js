const fs = require('fs');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url, options = {}, retries = 3, backoffMs = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.warn(`Fetch attempt ${attempt} failed: ${error.message}`);
      if (attempt === retries) throw error;
      await wait(backoffMs * attempt);
    }
  }
}

function markdownToEmailHtml(text) {
  return text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #2563eb; font-weight: 600; text-decoration: none;">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong style="color: #0f172a;">$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\n\n/g, '</p><p style="margin: 0 0 14px 0; font-size: 14.5px; line-height: 1.65; color: #334155;">')
    .replace(/\n/g, '<br/>');
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
  const resendApiKey = process.env.RESEND_API_KEY;

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

    const topGainers = marketData.top_gainers.slice(0, 5);
    const topLosers = (marketData.top_losers || []).slice(0, 5);
    const mostActive = (marketData.most_actively_traded || []).slice(0, 5);
    const leadStock = topGainers[0];

    const stockDataSummary = `
TOP GAINERS:
${topGainers.map((s) => `Ticker: ${s.ticker} | Price: $${parseFloat(s.price).toFixed(2)} | Change: +${parseFloat(s.change_percentage).toFixed(2)}% | Volume: ${Number(s.volume).toLocaleString()}`).join('\n')}

TOP LOSERS:
${topLosers.map((s) => `Ticker: ${s.ticker} | Price: $${parseFloat(s.price).toFixed(2)} | Change: ${parseFloat(s.change_percentage).toFixed(2)}% | Volume: ${Number(s.volume).toLocaleString()}`).join('\n')}

MOST ACTIVE:
${mostActive.map((s) => `Ticker: ${s.ticker} | Price: $${parseFloat(s.price).toFixed(2)} | Change: ${parseFloat(s.change_percentage).toFixed(2)}% | Volume: ${Number(s.volume).toLocaleString()}`).join('\n')}
    `.trim();

    const systemPrompt = `You are a quantitative institutional equity analyst at Trade Opportunities.
Review the provided market movers feed and write a structured, high-value intelligence report.
Include:
1. Executive Macro & Momentum Summary (2-3 sentences analyzing breadth and aggressive order flow).
2. Key Technical Levels & Support/Resistance zones for the lead mover (${leadStock.ticker}).
3. Risk Parameters & Volume Distribution insights for active names.

CRITICAL FORMATTING INSTRUCTION:
- Every mention of a ticker symbol MUST be formatted as: [$TICKER](https://www.tradingview.com/symbols/$TICKER/?aff_id=170147).
- Maintain an institutional, data-driven tone. Avoid filler buzzwords, robotic meta-announcements, and disclaimers.`;

    console.log('2. Generating quantitative synthesis with Gemini...');
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${llmApiKey}`;
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
        ]
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
refUrl: "https://changenow.app.link/referral?link_id=1c434a8e93e8ff"
refLabel: "Execute Spot Order on ChangeNOW"
---

${gainersTable}
${losersTable}
${activeTable}

## Institutional Market Intelligence

${generatedAnalysis}
`;

    fs.writeFileSync(`${folderPath}/${fileName}`, markdownContent);
    console.log(`Saved structured markdown: ${fileName}`);

    // 4. Automated Zero-Token Broadcast via Resend
    if (resendApiKey) {
      console.log('4. Dispatching audience email broadcast via Resend...');

      const audienceRes = await fetch('https://api.resend.com/audiences', {
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        }
      });
      const audienceJson = await audienceRes.json();
      const audienceId = audienceJson.data?.[0]?.id;

      if (!audienceId) {
        console.warn('No Resend audience found. Email broadcast skipped.');
      } else {
        const emailFormattedBody = markdownToEmailHtml(generatedAnalysis);

        const broadcastRes = await fetch('https://api.resend.com/broadcasts', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            audience_id: audienceId,
            from: 'Trade Opportunities <intel@tradeopportunities.trade>',
            subject: `Market Momentum: ${leadStock.ticker} (+${parseFloat(leadStock.change_percentage).toFixed(1)}%)`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #0f172a; padding: 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
                <div style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px;">
                  <span style="font-size: 11px; font-weight: 700; color: #2563eb; text-transform: uppercase; letter-spacing: 0.05em;">Quantitative Market Intelligence</span>
                  <h2 style="font-size: 20px; margin: 4px 0 0; color: #0f172a;">${leadStock.ticker} Momentum Expansion (+${parseFloat(leadStock.change_percentage).toFixed(1)}%)</h2>
                  <span style="font-size: 12px; color: #64748b;">${date} &bull; ${displayTime}</span>
                </div>

                <div style="margin-bottom: 24px;">
                  <p style="margin: 0 0 14px 0; font-size: 14.5px; line-height: 1.65; color: #334155;">
                    ${emailFormattedBody}
                  </p>
                </div>

                <div style="margin-bottom: 24px; text-align: center;">
                  <a href="https://tradeopportunities.trade" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 600; padding: 10px 20px; border-radius: 5px;">
                    Open Live Terminal & View Full Scan &rarr;
                  </a>
                </div>

                <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 24px; font-size: 11px; line-height: 1.5; color: #94a3b8;">
                  <p style="margin: 0 0 8px 0;">
                    <strong>Financial Disclaimer:</strong> Market commentary is generated algorithmically for informational and educational purposes only. Nothing herein constitutes investment, legal, or tax advice. Equities and digital assets carry risk of capital loss.
                  </p>
                  <p style="margin: 0;">
                    You received this dispatch because you subscribed at <a href="https://tradeopportunities.trade" style="color: #64748b;">tradeopportunities.trade</a>.<br/>
                    <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color: #64748b; text-decoration: underline;">Unsubscribe from alerts</a>
                  </p>
                </div>
              </div>
            `,
            send: true
          })
        });

        const broadcastData = await broadcastRes.json();
        console.log('Broadcast status:', broadcastData);
      }
    }
  } catch (error) {
    console.error('Pipeline execution error:', error.message);
    process.exit(1);
  }
}

run();
