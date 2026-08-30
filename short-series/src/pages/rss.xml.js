// short-series/src/pages/rss.xml.js
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  // Fetch all posts from the blog collection
  const posts = await getCollection('blog');

  // Sort descending by date
  const sortedPosts = posts
    .filter((post) => !post.data.draft)
    .sort((a, b) => {
      const dateA = new Date(a.data.pubDate || a.data.date || a.data.publishDate || 0).getTime();
      const dateB = new Date(b.data.pubDate || b.data.date || b.data.publishDate || 0).getTime();
      return dateB - dateA;
    });

  return rss({
    title: 'Trade Opportunities | Daily Market Analysis',
    description: 'Daily algorithmic market updates, technical setups, and financial research.',
    site: context.site || 'https://tradeopportunities.trade',
    items: sortedPosts.map((post) => {
      // Determine post slug across Astro 4 (slug) and Astro 5 (id)
      const slug = post.slug || post.id.replace(/\.(md|mdx)$/, '');
      const rawDate = post.data.pubDate || post.data.date || post.data.publishDate || new Date();

      return {
        title: post.data.title || 'Market Update',
        pubDate: new Date(rawDate),
        description: post.data.description || post.data.summary || 'Daily market opportunity update.',
        link: `/blog/${slug}/`,
      };
    }),
    customData: `<language>en-us</language>`,
  });
}
