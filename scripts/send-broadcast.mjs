import fs from 'node:fs';
import path from 'node:path';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

async function run() {
  try {
    const blogDir = path.join(process.cwd(), 'short-series/src/content/blog');
    const files = fs.readdirSync(blogDir).filter((f) => f.endsWith('.md')).sort().reverse();

    if (files.length === 0) {
      console.log('No blog posts found to broadcast.');
      return;
    }

    const latestFile = files[0];
    const content = fs.readFileSync(path.join(blogDir, latestFile), 'utf-8');
    const dateMatch = latestFile.match(/\d{4}-\d{2}-\d{2}/);
    const dateStr = dateMatch ? dateMatch[0] : new Date().toISOString().split('T')[0];

    // 1. Fetch the default Audience ID from Resend
    const audiencesResponse = await resend.audiences.list();
    const audienceList = audiencesResponse.data?.data || audiencesResponse.data || [];
    const audienceId = audienceList[0]?.id;

    if (!audienceId) {
      console.warn('No Audience found in Resend. Create an Audience or add a contact first.');
      return;
    }

    // 2. Strip frontmatter and render content to clean HTML
    const body = content.replace(/^---[\s\S]*?---/, '').trim();
    const htmlBody = body
      .split('\n\n')
      .map((p) => {
        if (p.startsWith('# ')) return `<h1 style="color:#111827;font-size:20px;margin-bottom:8px;">${p.slice(2)}</h1>`;
        if (p.startsWith('## ')) return `<h2 style="color:#1f2937;font-size:16px;margin-top:16px;margin-bottom:6px;">${p.slice(3)}</h2>`;
        if (p.startsWith('### ')) return `<h3 style="color:#374151;font-size:14px;margin-top:12px;margin-bottom:4px;">${p.slice(4)}</h3>`;
        if (p.startsWith('* ') || p.startsWith('- ')) {
          const items = p.split('\n').map((li) => `<li style="margin-bottom:4px;">${li.replace(/^[\*\-]\s*/, '')}</li>`).join('');
          return `<ul style="padding-left:20px;color:#374151;line-height:1.5;">${items}</ul>`;
        }
        return `<p style="line-height:1.6;color:#374151;margin:8px 0;">${p.replace(/\n/g, '<br/>')}</p>`;
      })
      .join('');

    const emailHtml = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px;">
        <div style="border-bottom:2px solid #2563eb;padding-bottom:12px;margin-bottom:20px;">
          <h1 style="font-size:20px;margin:0;color:#2563eb;">Trade Opportunities Daily</h1>
          <p style="font-size:13px;color:#6b7280;margin:4px 0 0 0;">Market Intelligence Brief • ${dateStr}</p>
        </div>

        <div>
          ${htmlBody}
        </div>

        <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center;">
          <p>Read live setups at <a href="https://tradeopportunities.trade" style="color:#2563eb;text-decoration:none;">tradeopportunities.trade</a></p>
          <p>To stop receiving updates, <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#9ca3af;">unsubscribe</a>.</p>
        </div>
      </div>
    `;

    console.log(`Creating broadcast for ${latestFile} using Audience ID: ${audienceId}...`);

    // 3. Create the Broadcast with audienceId attached
    const { data: broadcast, error: createError } = await resend.broadcasts.create({
      audienceId: audienceId,
      name: `Market Update - ${dateStr}`,
      from: 'Trade Opportunities <newsletter@tradeopportunities.trade>',
      subject: `Market Intelligence [${dateStr}]: Daily Momentum & Key Setups`,
      html: emailHtml,
    });

    if (createError) throw createError;

    console.log(`Sending broadcast ID: ${broadcast.id}...`);
    const { error: sendError } = await resend.broadcasts.send(broadcast.id);
    if (sendError) throw sendError;

    console.log('Daily broadcast sent successfully.');
  } catch (err) {
    console.error('Broadcast dispatch error:', err);
    process.exit(1);
  }
}

run();
