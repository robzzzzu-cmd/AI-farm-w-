// short-series/src/pages/og/[slug].svg.ts
import { getCollection } from 'astro:content';

export const prerender = true;

export async function getStaticPaths() {
  const posts = await getCollection('blog');
  return posts.map((post) => ({
    params: { slug: post.id.replace(/\.md$/, '').toLowerCase() },
    props: { post },
  }));
}

function escapeXml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET({ params, props }: { params: { slug?: string }; props: { post?: any } }) {
  let post = props?.post;

  if (!post && params?.slug) {
    const posts = await getCollection('blog');
    post = posts.find((p) => p.id.replace(/\.md$/, '').toLowerCase() === params.slug?.toLowerCase());
  }

  const leadTicker = escapeXml(post?.data?.leadTicker || post?.data?.tickers?.[0] || 'MARKET');
  const leadGain = escapeXml(post?.data?.leadGain || '+0.0%');
  const title = post?.data?.title || 'Daily Market Intelligence';
  const dateStr = post?.data?.displayDate || (post?.data?.date ? new Date(post.data.date).toISOString().slice(0, 10) : 'Live Scan');
  const category = escapeXml(post?.data?.category || 'Equities');

  const cleanDateStr = escapeXml(dateStr.slice(0, 10));
  const pillText = `${category.toUpperCase()} • ${cleanDateStr}`;
  const pillWidth = Math.max(260, pillText.length * 10 + 36);

  // Smart word-wrapping into 1 or 2 lines to prevent text clipping
  const words = title.split(/\s+/);
  const titleLines: string[] = [];
  let currentLine = '';
  for (const word of words) {
    if ((currentLine ? currentLine + ' ' + word : word).length <= 40) {
      currentLine = currentLine ? currentLine + ' ' + word : word;
    } else {
      if (currentLine) titleLines.push(currentLine);
      currentLine = word;
      if (titleLines.length === 2) break;
    }
  }
  if (currentLine && titleLines.length < 2) titleLines.push(currentLine);
  if (titleLines.length === 2 && words.length > titleLines.join(' ').split(/\s+/).length) {
    titleLines[1] = titleLines[1].length > 36 ? titleLines[1].slice(0, 33) + '...' : titleLines[1] + '...';
  }
  if (titleLines.length === 0) titleLines.push(title);

  const isTwoLines = titleLines.length > 1;

  const titleSvg = isTwoLines
    ? `
  <text x="80" y="240" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="36" font-weight="800" letter-spacing="-0.5">
    ${escapeXml(titleLines[0])}
  </text>
  <text x="80" y="286" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="36" font-weight="800" letter-spacing="-0.5">
    ${escapeXml(titleLines[1])}
  </text>`
    : `
  <text x="80" y="260" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="42" font-weight="800" letter-spacing="-0.5">
    ${escapeXml(titleLines[0])}
  </text>`;

  const assetBoxY = isTwoLines ? 330 : 315;

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#060911" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#22c55e" />
    </linearGradient>
    <linearGradient id="glowGrad" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="rgba(34, 197, 94, 0)" />
      <stop offset="100%" stop-color="rgba(34, 197, 94, 0.25)" />
    </linearGradient>
    <filter id="blurFilter" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur stdDeviation="60" />
    </filter>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)" />

  <circle cx="950" cy="200" r="280" fill="#2563eb" opacity="0.25" filter="url(#blurFilter)" />
  <circle cx="1050" cy="450" r="240" fill="#22c55e" opacity="0.2" filter="url(#blurFilter)" />

  <g stroke="#1e293b" stroke-width="1.5" opacity="0.7">
    <line x1="80" y1="120" x2="1120" y2="120" />
    <line x1="80" y1="240" x2="1120" y2="240" stroke-dasharray="6 6" />
    <line x1="80" y1="360" x2="1120" y2="360" stroke-dasharray="6 6" />
    <line x1="80" y1="480" x2="1120" y2="480" />
  </g>

  <path d="M 500 480 Q 700 450 820 330 T 1120 180" fill="none" stroke="url(#accent)" stroke-width="6" stroke-linecap="round" />
  <path d="M 500 480 Q 700 450 820 330 T 1120 180 L 1120 480 L 500 480 Z" fill="url(#glowGrad)" />

  <text x="80" y="80" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="700" letter-spacing="3">
    TRADE OPPORTUNITIES // QUANTITATIVE SCAN
  </text>
  <rect x="80" y="100" width="80" height="3" fill="url(#accent)" />

  <rect x="80" y="155" width="${pillWidth}" height="42" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1.5" />
  <text x="96" y="182" fill="#38bdf8" font-family="monospace" font-size="16" font-weight="700">
    ${pillText}
  </text>

  ${titleSvg}

  <g transform="translate(80, ${assetBoxY})">
    <rect width="360" height="150" rx="12" fill="#0b1120" stroke="#1e293b" stroke-width="2" />
    <text x="28" y="55" fill="#64748b" font-family="monospace" font-size="16" font-weight="700">LEAD BREAKOUT ASSET</text>
    <text x="28" y="115" fill="#ffffff" font-family="monospace" font-size="52" font-weight="900">$${leadTicker}</text>
    <rect x="210" y="70" width="125" height="48" rx="6" fill="rgba(34, 197, 94, 0.15)" stroke="rgba(34, 197, 94, 0.4)" />
    <text x="225" y="102" fill="#22c55e" font-family="monospace" font-size="24" font-weight="800">${leadGain}</text>
  </g>

  <text x="80" y="540" fill="#64748b" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16">
    Verified Data Feed: Alpha Vantage API • Minimum 50k Volume Filter • tradeopportunities.trade
  </text>
</svg>
  `.trim();

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
