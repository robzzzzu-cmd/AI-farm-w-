import fs from 'node:fs';
import path from 'node:path';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

async function run() {
  try {
    const blogDir = path.join(process.cwd(), 'short-series/src/content/blog');
    const files = fs.readdirSync(blogDir).filter((f) => f.endsWith('.md')).sort().reverse();

    if (files.length === 0) {
      console.log('No market update files found. Skipping email dispatch.');
      return;
    }

    const latestFile = files[0];
    const content = fs.readFileSync(path.join(blogDir, latestFile), 'utf-8');
    const dateMatch = latestFile.match(/\d{4}-\d{2}-\d{2}/);
    const dateStr = dateMatch ? dateMatch[0] : new Date().toISOString().split('T')[0];

    // 1. Gather all audience subscriber emails
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
        console.warn(`Could not fetch contacts for audience ${aud.id}:`, err.message);
      }
    }

    // Fallback: If Audience list returned empty, include confirmed workspace admin emails
    if (subscriberEmails.size === 0) {
      subscriberEmails.add('robzzzzu@gmail.com');
      subscriberEmails.add('robin.kaldam1@gmail.com');
    }

    const recipients = Array.from(subscriberEmails);
    console.log(`Dispatching market report to ${recipients.length} subscriber(s): ${recipients.join(', ')}`);

    // 2. Format HTML email body
    const body = content.replace(/^---[\s\S]*?---/, '').trim();
    const htmlBody = body
      .split('\n\n')
      .map((p) => {
        if (p.startsWith('# ')) return `<h1 style="color:#0f172a;font-size:20px;margin-bottom:8px;">${p.slice(2)}</h1>`;
        if (p.startsWith('## ')) return `<h2 style="color:#1e293b;font-size:16px;margin-top:16px;margin-bottom:6px;">${p.slice(3)}</h2>`;
        if (p.startsWith('### ')) return `<h3 style="color:#334155;font-size:14px;margin-top:12px;margin-bottom:4px;">${p.slice(4)}</h3>`;
        if (p.startsWith('* ') || p.startsWith('- ')) {
          const items = p.split('\n').map((li) => `<li style="margin-bottom:4px;">${li.replace(/^[\*\-]\s*/, '')}</li>`).join('');
          return `<ul style="padding-left:20px;color:#334155;line-height:1.5;">${items}</ul>`;
        }
        return `<p style="line-height:1.6;color:#334155;margin:8px 0;">${p.replace(/\n/g, '<br/>')}</p>`;
      })
      .join('');

    const emailHtml = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px;background:#ffffff;">
        <div style="border-bottom:2px solid #2563eb;padding-bottom:12px;margin-bottom:20px;">
          <h1 style="font-size:20px;margin:0;color:#2563eb;">Trade Opportunities Daily</h1>
          <p style="font-size:13px;color:#64748b;margin:4px 0 0 0;">Market Intelligence Brief • ${dateStr}</p>
        </div>

        <div>
          ${htmlBody}
        </div>

        <div style="margin-top:24px;text-align:center;">
          <a href="https://tradeopportunities.trade" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 20px;border-radius:6px;">
            Open Live Terminal & View Full Scan &rarr;
          </a>
        </div>

        <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center;">
          <p style="margin:0 0 4px 0;">Financial commentary generated for educational purposes. Not investment advice.</p>
          <p style="margin:0;">You received this because you subscribed at <a href="https://tradeopportunities.trade" style="color:#2563eb;">tradeopportunities.trade</a></p>
        </div>
      </div>
    `;

    // 3. Send email to each recipient
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

    console.log('Newsletter dispatch completed successfully.');
  } catch (err) {
    console.error('Fatal dispatch error:', err);
    process.exit(1);
  }
}

run();
