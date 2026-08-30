// short-series/src/pages/rss.xml.js (Direct File Glob Fallback)
import rss, { pagesGlobToRssItems } from '@astrojs/rss';

export async function GET(context) {
  return rss({
    title: 'Trade Opportunities | Daily Market Analysis',
    description: 'Daily algorithmic market updates, technical setups, and financial research.',
    site: context.site || 'https://tradeopportunities.trade',
    items: await pagesGlobToRssItems(
      import.meta.glob('../content/blog/*.{md,mdx}')
    ),
    customData: `<language>en-us</language>`,
  });
}
