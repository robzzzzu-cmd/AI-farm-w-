import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const posts = await getCollection('blog');

  return rss({
    title: 'Trade Opportunities Market Updates',
    description: 'Daily automated market analysis and trade setups.',
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title || post.id,
      pubDate: post.data.pubDate || new Date(),
      description: post.data.description || '',
      link: `/blog/${post.slug || post.id}/`,
    })),
    customData: `<language>en-us</language>`,
  });
}
