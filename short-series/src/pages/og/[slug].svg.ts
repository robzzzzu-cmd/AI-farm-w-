// short-series/src/pages/og/[slug].svg.ts
import { getCollection } from 'astro:content';

export async function getStaticPaths() {
  const posts = await getCollection('blog');
  return posts.map((post) => ({
    params: { slug: post.id.replace(/\.md$/, '') },
    props: { post },
  }));
}

export async function GET({ props }: { props: { post: any } }) {
  const { post } = props;
  
  const leadTicker = post.data?.leadTicker || post.data?.tickers?.[0] || 'MARKET';
  const leadGain = post.data?.leadGain || '+0.0%';
  const title = post.data?.title || 'Daily Market Intelligence';
  const dateStr = post.data?.displayDate || (post.data?.date ? new Date(post.data.date).toISOString().slice(0, 10) : 'Live Scan');
  const category = post.data?.category || 'Equities';

  const cleanTitle = title.length > 58 ? title.slice(0, 55) + '...' : title;

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

  <!-- Background Base -->
  <rect width="1200" height="630" fill="url(#bg)" />

  <!-- Ambient Glow -->
  <circle cx="950" cy="200" r="280" fill="#2563eb" opacity="0.25" filter="url(#blurFilter)" />
  <circle cx="1050" cy="450" r="240" fill="#22c55e" opacity="0.2" filter="url(#blurFilter)" />

  <!-- Grid Pattern -->
  <g stroke="#1e293b" stroke-width="1.5" opacity="0.7">
    <line x1="80" y1="120" x2="1120" y2="120" />
    <line x1="80" y1="240" x2="1120" y2="240" stroke-dasharray="6 6" />
    <line x1="80" y1="360" x2="1120" y2="360" stroke-dasharray="6 6" />
    <line x1="80" y1="480" x2="1120" y2="480" />
  </g>

  <!-- Stylized Breakout Curve -->
  <path d="M 500 480 Q 700 450 820 330 T 1120 180" fill="none" stroke="url(#accent)" stroke-width="6" stroke-linecap="round" />
  <path d="M 500 480 Q 700 450 820 330 T 1120 180 L 1120 480 L 500 480 Z" fill="url(#glowGrad)" />

  <!-- Top Brand Banner -->
  <text x="80" y="80" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="700" letter-spacing="3">
    TRADE OPPORTUNITIES // QUANTITATIVE SCAN
  </text>
  <rect x="80" y="100" width="80" height="3" fill="url(#accent)" />

  <!-- Category & Date Pill -->
  <rect x="80" y="160" width="220" height="42" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1.5" />
  <text x="96" y="187" fill="#38bdf8" font-family="monospace" font-size="16" font-weight="700">
    ${category.toUpperCase()} • ${dateStr.slice(0, 10)}
  </text>

  <!-- Headline Title -->
  <text x="80" y="260" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="44" font-weight="800" letter-spacing="-1">
    ${cleanTitle}
  </text>

  <!-- Lead Ticker Badge -->
  <g transform="translate(80, 320)">
    <rect width="360" height="150" rx="12" fill="#0b1120" stroke="#1e293b" stroke-width="2" />
    <text x="28" y="55" fill="#64748b" font-family="monospace" font-size="16" font-weight="700">LEAD BREAKOUT ASSET</text>
    <text x="28" y="115" fill="#ffffff" font-family="monospace" font-size="52" font-weight="900">$${leadTicker}</text>
    <rect x="210" y="70" width="125" height="48" rx="6" fill="rgba(34, 197, 94, 0.15)" stroke="rgba(34, 197, 94, 0.4)" />
    <text x="225" y="102" fill="#22c55e" font-family="monospace" font-size="24" font-weight="800">${leadGain}</text>
  </g>

  <!-- Footer Verification Badge -->
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
