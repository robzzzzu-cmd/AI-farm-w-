// scripts/send-broadcast.mjs
import fs from 'node:fs';
import path from 'node:path';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

function formatInlineMarkdown(text) {
  return text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #2563eb; font-weight: 600; text-decoration: none;">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong style="color: #0f172a; font-weight: 700;">$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em style="color: #475569;">$1</em>')
    .replace(/`(\+[^`]+)`/g, '<span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; background-color: #dcfce7; color: #15803d; font-family: monospace;">$1</span>')
    .replace(/`(\-[^`]+)`/g, '<span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; background-color: #fee2e2; color: #b91c1c; font-family: monospace;">$1</span>')
    .replace(/`([^`]+)`/g, '<code style="background-color: #f1f5f9; color: #0f172a; padding: 2px 6px; border-radius: 4px; font-size: 12px; font-family: monospace;">$1</code>');
}

function markdownToEmailHtml(markdown) {
  const blocks = markdown.split(/\n\s*\n/);
  const htmlOut = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('# ')) {
      htmlOut.push(`<h1 style="color: #0f172a; font-size: 20px; font-weight: 800; margin: 24px 0 12px 0; letter-spacing: -0.02em;">${formatInlineMarkdown(trimmed.slice(2))}</h1>`);
      continue;
    }
    if (trimmed.startsWith('## ')) {
      htmlOut.push(`<h2 style="color: #0f172a; font-size: 15px; font-weight: 700; margin: 22px 0 8px 0; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; text-transform: uppercase; letter-spacing: 0.05em;">${formatInlineMarkdown(trimmed.slice(3))}</h2>`);
      continue;
    }
    if (trimmed.startsWith('### ')) {
      htmlOut.push(`<h3 style="color: #1e293b; font-size: 13px; font-weight: 700; margin: 16px 0 6px 0; text-transform: uppercase; letter-spacing: 0.04em;">${formatInlineMarkdown(trimmed.slice(4))}</h3>`);
      continue;
    }

    if (trimmed.startsWith('|')) {
      const rows = trimmed.split('\n').filter((r) => r.trim().startsWith('|'));
      if (rows.length >= 2) {
        const headerCols = rows[0].split('|').map((c) => c.trim()).filter(Boolean);
        const dataRows = rows.slice(2);

        let tableHtml = `
          <div style="overflow-x: auto; margin: 12px 0 20px 0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
              <thead>
                <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                  ${headerCols.map((col) => `<th style="text-align: left; padding: 8px 10px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.05em;">${col}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
        `;

        for (let i = 0; i < dataRows.length; i++) {
          const cols = dataRows[i].split('|').map((c) => c.trim()).filter(Boolean);
          const bg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
          tableHtml += `<tr style="background-color: ${bg}; border-bottom: 1px solid #f1f5f9;">`;
          for (const col of cols) {
            tableHtml += `<td style="padding: 8px 10px; color: #1e293b; white-space: nowrap;">${formatInlineMarkdown(col)}</td>`;
          }
          tableHtml += `</tr>`;
        }

        tableHtml += `
              </tbody>
            </table>
          </div>
        `;

        htmlOut.push(tableHtml);
        continue;
      }
    }

    if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
      const items = trimmed
        .split('\n')
        .map((li) => `<li style="margin-bottom: 6px; line-height: 1.6; color: #334155;">${formatInlineMarkdown(li.replace(/^[\*\-]\s*/, ''))}</li>`)
        .join('');
      htmlOut.push(`<ul style="margin: 8px 0 16px 0; padding-left: 20px;">${items}</ul>`);
      continue;
    }

    htmlOut.push(`<p style="margin: 0 0 14px 0; font-size: 14px; line-height: 1.65; color: #334155;">${formatInlineMarkdown(trimmed.replace(/\n/g, '<br/>'))}</p>`);
  }

  return htmlOut.join('');
}

function formatCompactNumber(val) {
  if (val === undefined || val === null || val === '') return '0';
  const num = typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : val;
  if (isNaN(num)) return String(val);
  if (Math.abs(num) >= 1e9) return (num / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (Math.abs(num) >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (Math.abs(num) >= 1e3) return (num / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return num.toLocaleString();
}

function parsePostFrontmatter(content) {
  const match = content.match(/^---([\s\S]*?)---/);
  if (!match) return {};
  const yamlBlock = match[1];

  const extractJson = (key) => {
    const regex = new RegExp(`${key}:\\s*(\\[[\\s\\S]*?\\])(?=\\r?\\n[a-zA-Z]+:|$)`);
    const jsonMatch = yamlBlock.match(regex);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch (_) {}
    }
    return [];
  };

  const extractField = (key) => {
    const regex = new RegExp(`${key}:\\s*["']?([^"'\r\n]+)["']?`);
    const fieldMatch = yamlBlock.match(regex);
    return fieldMatch ? fieldMatch[1].trim() : '';
  };

  return {
    title: extractField('title'),
    leadTicker: extractField('leadTicker'),
    leadGain: extractField('leadGain'),
    displayDate: extractField('displayDate') || extractField('date'),
    gainers: extractJson('gainers'),
    losers: extractJson('losers'),
    active: extractJson('active'),
  };
}

async function run() {
  const isForce = process.argv.includes('--force');
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday
  const utcHour = now.getUTCHours();

  // Restrict sending: Only Friday after 20:00 UTC (closing bell) or weekends
  const isEndOfWeek = (dayOfWeek === 5 && utcHour >= 20) || dayOfWeek === 6 || dayOfWeek === 0;

  if (!isEndOfWeek && !isForce) {
    console.log(`Broadcast gate: Day ${dayOfWeek} at ${utcHour}:00 UTC is not the end of the week. Newsletter only dispatches Friday close / weekends. Use --force to test manually.`);
    process.exit(0);
  }

  try {
    const blogDir = fs.existsSync('./short-series/src/content/blog')
      ? path.join(process.cwd(), 'short-series/src/content/blog')
      : path.join(process.cwd(), 'src/content/blog');

    const files = fs.readdirSync(blogDir).filter((f) => f.endsWith('.md')).sort().reverse();
    if (files.length === 0) {
      console.log('No scans cataloged to aggregate.');
      return;
    }

    // Inspect reports from the trailing 7 days
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weeklyFiles = files.filter((f) => {
      const stats = fs.statSync(path.join(blogDir, f));
      const dateMatch = f.match(/\d{4}-\d{2}-\d{2}/);
      const fileTime = dateMatch ? new Date(dateMatch[0]).getTime() : stats.mtimeMs;
      return fileTime >= sevenDaysAgo;
    });

    const activeFiles = weeklyFiles.length > 0 ? weeklyFiles : files.slice(0, 5);

    const gainerMap = new Map();
    const activeMap = new Map();
    const declinerMap = new Map();

    for (const f of activeFiles) {
      const content = fs.readFileSync(path.join(blogDir, f), 'utf-8');
      const data = parsePostFrontmatter(content);

      (data.gainers || []).forEach((g) => {
        const change = parseFloat(g.change_percentage || 0);
        if (!gainerMap.has(g.ticker) || change > gainerMap.get(g.ticker).change) {
          gainerMap.set(g.ticker, { ...g, change });
        }
      });

      (data.active || []).forEach((a) => {
        const vol = Number(a.volume || 0);
        if (!activeMap.has(a.ticker) || vol > activeMap.get(a.ticker).vol) {
          activeMap.set(a.ticker, { ...a, vol });
        }
      });

      (data.losers || []).forEach((l) => {
        const change = parseFloat(l.change_percentage || 0);
        if (!declinerMap.has(l.ticker) || change < declinerMap.get(l.ticker).change) {
          declinerMap.set(l.ticker, { ...l, change });
        }
      });
    }

    const topWeeklyGainers = Array.from(gainerMap.values()).sort((a, b) => b.change - a.change).slice(0, 5);
    const topWeeklyActive = Array.from(activeMap.values()).sort((a, b) => b.vol - a.vol).slice(0, 5);
    const topWeeklyDecliners = Array.from(declinerMap.values()).sort((a, b) => a.change - b.change).slice(0, 3);

    const weekStr = now.toISOString().split('T')[0];

    // Build the Markdown body with executive takeaways and summary tables
    let markdownBody = `## Weekly Session Wrap: Liquidity & Breakout Matrix\n\n`;
    markdownBody += `Throughout this week's trading sessions, algorithmic market surveillance monitored persistent capital rotation between speculative low-float breakouts and high-volume institutional liquidity anchors. Sub-dollar momentum assets registered extreme volatility, while closing auction flows established critical support baselines across primary index leaders.\n\n`;

    markdownBody += `### Top Momentum Breakouts of the Week\n\n`;
    markdownBody += `| Asset | Observed Price | Peak Gain | Monitored Volume | Action |\n`;
    markdownBody += `| :--- | :--- | :--- | :--- | :--- |\n`;
    for (const s of topWeeklyGainers) {
      markdownBody += `| **$${s.ticker}** | $${parseFloat(s.price).toFixed(2)} | \`+${s.change.toFixed(2)}%\` | ${formatCompactNumber(s.volume)} | [Analyze ${s.ticker}](https://www.tradingview.com/symbols/${s.ticker}/?aff_id=170147) |\n`;
    }

    markdownBody += `\n### Heaviest Institutional Volume Leaders\n\n`;
    markdownBody += `| Asset | Price | Net Delta | Peak Session Volume | Action |\n`;
    markdownBody += `| :--- | :--- | :--- | :--- | :--- |\n`;
    for (const s of topWeeklyActive) {
      const c = parseFloat(s.change_percentage || 0);
      const sign = c >= 0 ? '+' : '';
      markdownBody += `| **$${s.ticker}** | $${parseFloat(s.price).toFixed(2)} | \`${sign}${c.toFixed(2)}%\` | ${formatCompactNumber(s.volume)} | [Chart Tape](https://www.tradingview.com/symbols/${s.ticker}/?aff_id=170147) |\n`;
    }

    if (topWeeklyDecliners.length > 0) {
      markdownBody += `\n### Notable Mean-Reversions & Pullbacks\n\n`;
      markdownBody += `| Asset | Price | Retracement | Volume | Action |\n`;
      markdownBody += `| :--- | :--- | :--- | :--- | :--- |\n`;
      for (const s of topWeeklyDecliners) {
        markdownBody += `| **$${s.ticker}** | $${parseFloat(s.price).toFixed(2)} | \`${s.change.toFixed(2)}%\` | ${formatCompactNumber(s.volume)} | [Inspect Setup](https://www.tradingview.com/symbols/${s.ticker}/?aff_id=170147) |\n`;
      }
    }

    // Fetch subscribers from Resend audience
    const audiencesResponse = await resend.audiences.list();
    const audienceList = audiencesResponse.data?.data || audiencesResponse.data || [];
    let subscriberEmails = new Set();

    for (const aud of audienceList) {
      try {
        const contactsRes = await resend.contacts.list({ audienceId: aud.id });
        const list = contactsRes.data?.data || contactsRes.data || [];
        for (const contact of list) {
          if (contact.email && !contact.unsubscribed) {
            subscriberEmails.add(contact.email.toLowerCase());
          }
        }
      } catch (err) {
        console.warn(`Could not query audience ${aud.id}:`, err.message);
      }
    }

    if (subscriberEmails.size === 0) {
      subscriberEmails.add('robzzzzu@gmail.com');
      subscriberEmails.add('robin.kaldam1@gmail.com');
    }

    const recipients = Array.from(subscriberEmails);
    const parsedBodyHtml = markdownToEmailHtml(markdownBody);

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 24px 12px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <div style="max-width: 620px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);">
          
          <div style="background-color: #0f172a; padding: 24px 28px; border-bottom: 3px solid #2563eb;">
            <div style="font-size: 11px; font-weight: 700; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px;">
              Trade Opportunities &bull; Weekly Intelligence Wrap
            </div>
            <h1 style="color: #ffffff; font-size: 22px; font-weight: 800; margin: 0; letter-spacing: -0.02em;">
              Week in Review: Breakouts & Liquidity
            </h1>
            <div style="color: #94a3b8; font-size: 12px; margin-top: 6px;">
              Multi-Session Conclusion &bull; Week ending ${weekStr}
            </div>
          </div>

          <div style="padding: 24px 28px;">
            ${parsedBodyHtml}
          </div>

          <div style="padding: 0 28px 28px 28px; text-align: center;">
            <a href="https://tradeopportunities.trade" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; padding: 12px 24px; border-radius: 6px;">
              Open Terminal & Real-Time Sector Matrix &rarr;
            </a>
          </div>

          <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 28px; font-size: 11px; line-height: 1.6; color: #94a3b8; text-align: center;">
            <p style="margin: 0 0 8px 0;">
              <strong>Disclaimer:</strong> Weekly market reviews are compiled algorithmically for educational purposes. Nothing herein constitutes investment advice.
            </p>
            <p style="margin: 0;">
              You received this weekly digest because you subscribed at <a href="https://tradeopportunities.trade" style="color: #2563eb; text-decoration: none;">tradeopportunities.trade</a>.<br/>
              <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color: #94a3b8; text-decoration: underline;">Unsubscribe from alerts</a>
            </p>
          </div>

        </div>
      </body>
      </html>
    `;

    console.log(`Dispatching weekly conclusion digest to ${recipients.length} subscriber(s)...`);

    for (const recipient of recipients) {
      const { data, error } = await resend.emails.send({
        from: 'Trade Opportunities <newsletter@tradeopportunities.trade>',
        to: recipient,
        subject: `Weekly Market Wrap: Top Breakouts, Volume Flows & Retracements [${weekStr}]`,
        html: emailHtml,
      });

      if (error) {
        console.error(`Failed delivery to ${recipient}:`, error);
      } else {
        console.log(`Delivered weekly wrap to ${recipient} (Email ID: ${data.id})`);
      }
    }

    console.log('Weekly digest transmission completed successfully.');
  } catch (err) {
    console.error('Fatal dispatch error:', err);
    process.exit(1);
  }
}

run();
