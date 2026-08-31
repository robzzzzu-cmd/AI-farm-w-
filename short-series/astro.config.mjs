// short-series/astro.config.mjs
// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://tradeopportunities.trade',
  adapter: vercel(),
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
        } else if (item.url.includes('/blog/')) {
          item.priority = 0.9;
          item.changefreq = 'daily';
        } else if (item.url.includes('/category/')) {
          item.priority = 0.7;
          item.changefreq = 'daily';
        } else {
          item.priority = 0.3;
          item.changefreq = 'monthly';
        }
        return item;
      },
    }),
  ],
});
