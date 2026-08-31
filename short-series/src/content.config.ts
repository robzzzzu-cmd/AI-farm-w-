// short-series/src/content/config.ts
import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z
    .object({
      title: z.string().optional(),
      date: z.union([z.string(), z.date()]).optional(),
      pubDate: z.union([z.string(), z.date()]).optional(),
      description: z.string().optional(),
      summary: z.string().optional(),
      draft: z.boolean().optional(),
    })
    .passthrough(),
});

export const collections = { blog };
