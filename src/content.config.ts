import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

export const collections = {
  writing: defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/writing' }),
    schema: z.object({
      title: z.string(),
      date: z.coerce.date(),
      description: z.string().optional(),
      draft: z.boolean().default(false),
    }),
  }),
};
