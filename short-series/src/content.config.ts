import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const stockItemSchema = z.object({
  ticker: z.string(),
  price: z.union([z.string(), z.number()]).transform((v) => String(v)),
  change_amount: z.union([z.string(), z.number()]).optional().transform((v) => (v !== undefined ? String(v) : undefined)),
  change_percentage: z.union([z.string(), z.number()]).transform((v) => String(v)),
  volume: z.union([z.string(), z.number()]).transform((v) => String(v))
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    date: z.coerce.date().optional(),
    pubDate: z.coerce.date().optional(),
    displayDate: z.string().optional(),
    category: z.string().optional(),
    categories: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    leadTicker: z.string().optional(),
    leadGain: z.string().optional(),
    tickers: z.array(z.string()).default([]),
    gainers: z.array(stockItemSchema).optional(),
    losers: z.array(stockItemSchema).optional(),
    active: z.array(stockItemSchema).optional(),
    refUrl: z.string().optional(),
    refLabel: z.string().optional()
  })
});

export const collections = { blog };
