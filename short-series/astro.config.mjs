// short-series/astro.config.mjs
// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://tradeopportunities.trade',
  trailingSlash: 'always',
  adapter: vercel(),
  redirects: {
    '/sitemap.xml': '/sitemap-index.xml',
  },
  integrations: [
    sitemap({
      changefreq: 'daily',
      priority: 0.8,
      serialize(item) {
        // High priority for market feed home
        if (item.url === 'https://tradeopportunities.trade/') {
          item.priority = 1.0;
          item.changefreq = 'hourly';
          item.lastmod = new Date().toISOString();
        } else if (item.url.includes('/ticker/')) {
          item.priority = 0.5;
          item.changefreq = 'weekly';
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
