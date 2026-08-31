import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const stockItemSchema = z.object({
  ticker: z.string(),
  price: z.string(),
  change_amount: z.string().optional(),
  change_percentage: z.string(),
  volume: z.string()
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
    categories: z.array(z.string()).default(['Equities']),
    tags: z.array(z.string()).default([]),
    leadTicker: z.string().optional(),
    leadGain: z.string().optional(),
    tickers: z.array(z.string()).optional(),
    gainers: z.array(stockItemSchema).optional(),
    losers: z.array(stockItemSchema).optional(),
    active: z.array(stockItemSchema).optional(),
    refUrl: z.string().optional(),
    refLabel: z.string().optional()
  })
});

export const collections = { blog };
