// short-series/src/pages/rss.xml.js
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const posts = await getCollection('blog');
  
  // Sort posts in descending order by publication date
  const sortedPosts = posts.sort((a, b) => {
    const dateA = new Date(a.data.pubDate || a.data.date || 0).getTime();
    const dateB = new Date(b.data.pubDate || b.data.date || 0).getTime();
    return dateB - dateA;
  });

  return rss({
    title: 'Trade Opportunities | Daily Market Analysis',
    description: 'Daily algorithmic market updates, technical setups, and financial research.',
    site: context.site || 'https://tradeopportunities.trade',
    items: sortedPosts.map((post) => ({
      title: post.data.title,
      pubDate: new Date(post.data.pubDate || post.data.date || new Date()),
      description: post.data.description || '',
      link: `/blog/${post.slug}/`,
    })),
    customData: `<language>en-us</language>`,
  });
}
