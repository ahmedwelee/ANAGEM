import { Lang } from '../../../core/api/models';
import { MediaRef } from '../../../core/api/public-api';

/** Router commands for a CMS-provided path such as "/publications" or "https://…" (external links are returned as a string). */
export function linkTo(lang: Lang, url: string | null | undefined): string[] | string {
  if (!url) return ['/', lang];
  if (/^https?:\/\//.test(url)) return url;
  return ['/', lang, ...url.split('/').filter(Boolean)];
}

export const isExternal = (x: string[] | string): x is string => typeof x === 'string';

export function mediaUrl(id: unknown, fallback: string): string { return typeof id === 'string' && id ? `/api/public/media/${id}` : fallback; }

/** Best image URL for a card: the thumbnail when present. */
export function imageOf(m: MediaRef | null | undefined, full = false): string | null { return m ? (full ? m.url : m.thumbnailUrl ?? m.url) : null; }

/** Plain text from an HTML string (for meta descriptions and excerpts). */
export function stripHtml(html: string | null | undefined, max = 200): string {
  const t = (html ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t;
}
