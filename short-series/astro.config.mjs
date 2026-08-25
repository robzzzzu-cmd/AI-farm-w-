import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://robzzzzu-cmd.github.io',
  base: '/AI-farm-w-',
  integrations: [mdx(), sitemap()],
});
