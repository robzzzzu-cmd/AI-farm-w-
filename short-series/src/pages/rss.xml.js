// short-series/src/pages/rss.xml.js
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export const prerender = true;

export async function GET(context) {
  const blogPosts = await getCollection('blog');
  const siteUrl = (context.site ? context.site.href : 'https://tradeopportunities.trade').replace(/\/$/, '');

  const items = blogPosts.map((post) => {
    const slug = post.id.replace(/\.md$/, '');
    const data = post.data || {};

    const rawDate = data.pubDate || data.date || Date.now();
    const parsedDate = new Date(rawDate);

    const imageUrl = data.image && data.image.startsWith('http') && !data.image.includes('favicon.svg')
      ? data.image
      : `${siteUrl}/og/${slug}.svg`;

    const summaryText = data.description || 'Daily algorithmic market intelligence and technical analysis report.';
    const titleText = data.title || slug.replace(/-/g, ' ');

    return {
      title: titleText,
      pubDate: isNaN(parsedDate.getTime()) ? new Date() : parsedDate,
      description: `<div><img src="${imageUrl}" alt="${titleText}" width="1200" height="630" style="display:block;max-width:100%;height:auto;border-radius:6px;margin-bottom:12px;" /></div><p>${summaryText}</p>`,
      link: `/blog/${slug}/`,
      customData: `
        <enclosure url="${imageUrl}" length="1024" type="image/svg+xml" />
        <media:content url="${imageUrl}" medium="image" type="image/svg+xml" width="1200" height="630" />
        <media:thumbnail url="${imageUrl}" />
      `.trim(),
    };
  });

  items.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  return rss({
    title: 'Trade Opportunities | Daily Market Analysis',
    description: 'Daily algorithmic market updates, technical setups, and financial research.',
    site: siteUrl,
    xmlns: {
      media: 'http://search.yahoo.com/mrss/',
      atom: 'http://www.w3.org/2005/Atom',
    },
    items,
    customData: `<language>en-us</language>`,
  });
}
