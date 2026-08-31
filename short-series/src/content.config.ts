import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    pubDate: z.preprocess(
      (val) => (val instanceof Date || typeof val === 'string' ? new Date(val) : val),
      z.date()
    ),
    updatedDate: z.preprocess(
      (val) => (val instanceof Date || typeof val === 'string' ? new Date(val) : undefined),
      z.date().optional()
    ),
    heroImage: z.string().optional(),
  }),
});

export const collections = { blog };
