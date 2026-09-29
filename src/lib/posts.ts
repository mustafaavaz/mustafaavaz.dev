import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'writing'>;

export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('writing', ({ data }) => import.meta.env.DEV || !data.draft);
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

// Tags (inline SVG diagrams, figures) are markup, not words to read.
export const readingTime = (body = '') => Math.max(1, Math.ceil(body.replace(/<[^>]*>/g, ' ').trim().split(/\s+/).length / 200));
