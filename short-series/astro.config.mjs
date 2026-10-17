// short-series/astro.config.mjs
// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import fs from 'node:fs';
import path from 'node:path';

function getBlogTickerUrls() {
  const tickerSet = new Set(['nvda', 'tsla', 'amd', 'pltr', 'smci', 'aapl', 'msft', 'spy', 'qqq']);
  try {
    const blogDir = path.resolve('./src/content/blog');
    if (fs.existsSync(blogDir)) {
      const files = fs.readdirSync(blogDir).filter((f) => f.endsWith('.md'));
      for (const file of files) {
        const raw = fs.readFileSync(path.join(blogDir, file), 'utf-8');
        const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (!fmMatch) continue;
        const fm = fmMatch[1];
        const tickerMatches = fm.matchAll(/(?:ticker:\s*|leadTicker:\s*|-\s*)["']?\$?([A-Z]{1,6})["']?/g);
        for (const m of tickerMatches) {
          const sym = m[1].trim().toLowerCase();
          if (sym && /^[a-z0-9.-]{1,6}$/.test(sym) && !['true', 'false', 'equities', 'morning', 'midday', 'closing', 'market'].includes(sym)) {
            tickerSet.add(sym);
          }
        }
      }
    }
  } catch (_) {}
  return Array.from(tickerSet).map((t) => `https://tradeopportunities.trade/ticker/${t}/`);
}

export default defineConfig({
  site: 'https://tradeopportunities.trade',
  trailingSlash: 'always',
  adapter: vercel(),
  redirects: {
    '/sitemap.xml': '/sitemap-index.xml',
  },
  integrations: [
    sitemap({
      customPages: getBlogTickerUrls(),
      changefreq: 'daily',
      priority: 0.8,
      serialize(item) {
        // High priority for market feed home
        if (item.url === 'https://tradeopportunities.trade/') {
          item.priority = 1.0;
          item.changefreq = 'hourly';
          item.lastmod = new Date().toISOString();
        } else if (item.url.includes('/ticker/')) {
          item.priority = 0.6;
          item.changefreq = 'daily';
          item.lastmod = new Date().toISOString();
        } else if (item.url.includes('/blog/')) {
          item.priority = 0.9;
          item.changefreq = 'daily';
        } else if (item.url.includes('/category/')) {
          item.priority = 0.7;
          item.changefreq = 'daily';
        } else if (
          item.url.includes('/screener/') ||
          item.url.includes('/rvol-screener/') ||
          item.url.includes('/calendar/') ||
          item.url.includes('/dilution-risk/') ||
          item.url.includes('/track-record/') ||
          item.url.includes('/tools/')
        ) {
          item.priority = 0.9;
          item.changefreq = 'daily';
          item.lastmod = new Date().toISOString();
        } else {
          item.priority = 0.4;
          item.changefreq = 'monthly';
        }
        return item;
      },
    }),
  ],
});

