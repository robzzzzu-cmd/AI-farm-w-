import fs from 'node:fs';
import path from 'node:path';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

function formatInlineMarkdown(text) {
  return text
    // Markdown Links -> Styled HTML Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #2563eb; font-weight: 600; text-decoration: none;">$1</a>')
    // Bold -> Strong
    .replace(/\*\*([^*]+)\*\*/g, '<strong style="color: #0f172a; font-weight: 700;">$1</strong>')
    // Italic -> Em
    .replace(/\*([^*]+)\*/g, '<em style="color: #475569;">$1</em>')
    // Percentage Badges in backticks
    .replace(/`(\+[^`]+)`/g, '<span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; background-color: #dcfce7; color: #15803d; font-family: monospace;">$1</span>')
    .replace(/`(\-[^`]+)`/g, '<span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; background-color: #fee2e2; color: #b91c1c; font-family: monospace;">$1</span>')
    .replace(/`([^`]+)`/g, '<code style="background-color: #f1f5f9; color: #0f172a; padding: 2px 6px; border-radius: 4px; font-size: 12px; font-family: monospace;">$1</code>');
}

function markdownToEmailHtml(markdown) {
  // Strip frontmatter
  const body = markdown.replace(/^---[\s\S]*?---/, '').trim();
  const blocks = body.split(/\n\s*\n/);
  const htmlOut = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // Headings
    if (trimmed.startsWith('# ')) {
      htmlOut.push(`<h1 style="color: #0f172a; font-size: 20px; font-weight: 800; margin: 24px 0 12px 0; letter-spacing: -0.02em;">${formatInlineMarkdown(trimmed.slice(2))}</h1>`);
      continue;
    }
    if (trimmed.startsWith('## ')) {
      htmlOut.push(`<h2 style="color: #0f172a; font-size: 16px; font-weight: 700; margin: 24px 0 10px 0; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; text-transform: uppercase; letter-spacing: 0.05em;">${formatInlineMarkdown(trimmed.slice(3))}</h2>`);
      continue;
    }
    if (trimmed.startsWith('### ')) {
      htmlOut.push(`<h3 style="color: #1e293b; font-size: 14px; font-weight: 700; margin: 18px 0 8px 0; text-transform: uppercase; letter-spacing: 0.04em;">${formatInlineMarkdown(trimmed.slice(4))}</h3>`);
      continue;
    }

    // Markdown Tables
    if (trimmed.startsWith('|')) {
      const rows = trimmed.split('\n').filter((r) => r.trim().startsWith('|'));
      if (rows.length >= 2) {
        const headerCols = rows[0].split('|').map((c) => c.trim()).filter(Boolean);
        const dataRows = rows.slice(2); // Skip header and separator row

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

    // Bullet Lists
    if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
      const items = trimmed
        .split('\n')
        .map((li) => `<li style="margin-bottom: 6px; line-height: 1.6; color: #334155;">${formatInlineMarkdown(li.replace(/^[\*\-]\s*/, ''))}</li>`)
        .join('');
      htmlOut.push(`<ul style="margin: 8px 0 16px 0; padding-left: 20px;">${items}</ul>`);
      continue;
    }

    // Standard Paragraphs
    htmlOut.push(`<p style="margin: 0 0 14px 0; font-size: 14px; line-height: 1.65; color: #334155;">${formatInlineMarkdown(trimmed.replace(/\n/g, '<br/>'))}</p>`);
  }

  return htmlOut.join('');
}

async function run() {
  try {
    const blogDir = path.join(process.cwd(), 'short-series/src/content/blog');
    const files = fs.readdirSync(blogDir).filter((f) => f.endsWith('.md')).sort().reverse();

    if (files.length === 0) {
      console.log('No market intelligence updates found to broadcast.');
      return;
    }

    const latestFile = files[0];
    const content = fs.readFileSync(path.join(blogDir, latestFile), 'utf-8');
    const dateMatch = latestFile.match(/\d{4}-\d{2}-\d{2}/);
    const dateStr = dateMatch ? dateMatch[0] : new Date().toISOString().split('T')[0];

    // Gather recipients from active Audience contacts
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
        console.warn(`Could not read audience ${aud.id}:`, err.message);
      }
    }

    if (subscriberEmails.size === 0) {
      subscriberEmails.add('robzzzzu@gmail.com');
      subscriberEmails.add('robin.kaldam1@gmail.com');
    }

    const recipients = Array.from(subscriberEmails);
    const parsedBodyHtml = markdownToEmailHtml(content);

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 24px 12px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);">
          
          <!-- Header Banner -->
          <div style="background-color: #0f172a; padding: 24px 28px; border-bottom: 3px solid #2563eb;">
            <div style="font-size: 11px; font-weight: 700; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px;">
              Trade Opportunities &bull; Daily Intelligence
            </div>
            <h1 style="color: #ffffff; font-size: 22px; font-weight: 800; margin: 0; letter-spacing: -0.02em;">
              Market Momentum Brief
            </h1>
            <div style="color: #94a3b8; font-size: 12px; margin-top: 6px;">
              Session Scan &bull; ${dateStr}
            </div>
          </div>

          <!-- Body Content -->
          <div style="padding: 24px 28px;">
            ${parsedBodyHtml}
          </div>

          <!-- CTA Button -->
          <div style="padding: 0 28px 28px 28px; text-align: center;">
            <a href="https://tradeopportunities.trade" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; padding: 12px 24px; border-radius: 6px;">
              Open Live Terminal & View Full Scan &rarr;
            </a>
          </div>

          <!-- Footer & Disclaimer -->
          <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 28px; font-size: 11px; line-height: 1.6; color: #94a3b8; text-align: center;">
            <p style="margin: 0 0 8px 0;">
              <strong>Financial Disclaimer:</strong> Market commentary is algorithmically generated for informational and educational purposes only. Nothing herein constitutes investment advice.
            </p>
            <p style="margin: 0;">
              You received this intelligence dispatch because you subscribed at <a href="https://tradeopportunities.trade" style="color: #2563eb; text-decoration: none;">tradeopportunities.trade</a>.<br/>
              <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color: #94a3b8; text-decoration: underline;">Unsubscribe from alerts</a>
            </p>
          </div>

        </div>
      </body>
      </html>
    `;

    console.log(`Dispatching newsletter to ${recipients.length} subscriber(s)...`);

    for (const recipient of recipients) {
      console.log(`Sending to ${recipient}...`);
      const { data, error } = await resend.emails.send({
        from: 'Trade Opportunities <newsletter@tradeopportunities.trade>',
        to: recipient,
        subject: `Market Intelligence [${dateStr}]: Daily Momentum & Key Setups`,
        html: emailHtml,
      });

      if (error) {
        console.error(`Failed sending to ${recipient}:`, error);
      } else {
        console.log(`Delivered to ${recipient} (Email ID: ${data.id})`);
      }
    }

    console.log('Newsletter dispatch completed.');
  } catch (err) {
    console.error('Fatal dispatch error:', err);
    process.exit(1);
  }
}

run();
