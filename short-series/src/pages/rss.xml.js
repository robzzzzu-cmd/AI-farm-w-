// short-series/src/pages/rss.xml.js
import rss from '@astrojs/rss';

export async function GET(context) {
  // Directly load all markdown files in src/content/blog/
  const postFiles = import.meta.glob('../content/blog/*.md', { eager: true });
  
  const items = Object.entries(postFiles).map(([filepath, post]) => {
    // Extract filename (e.g., "market-update-2026-08-28") to construct the URL
    const slug = filepath.split('/').pop().replace(/\.md$/, '');
    const frontmatter = post.frontmatter || {};

    const rawDate = frontmatter.pubDate || frontmatter.date || Date.now();
    const parsedDate = new Date(rawDate);

    return {
      title: frontmatter.title || slug.replace(/-/g, ' '),
      pubDate: isNaN(parsedDate.getTime()) ? new Date() : parsedDate,
      description: frontmatter.description || frontmatter.summary || 'Daily market analysis update.',
      link: `/blog/${slug}/`,
    };
  });

  // Sort descending by date (newest first)
  items.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  return rss({
    title: 'Trade Opportunities | Daily Market Analysis',
    description: 'Daily algorithmic market updates, technical setups, and financial research.',
    site: context.site || 'https://tradeopportunities.trade',
    items,
    customData: `<language>en-us</language>`,
  });
}
