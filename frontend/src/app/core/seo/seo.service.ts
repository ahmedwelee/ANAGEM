import { DOCUMENT } from '@angular/common';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { DEFAULT_LANG, LANGS, Lang } from '../api/models';

/** Public origin (https://anagem.ma). Provided from PUBLIC_BASE_URL on the server; in the browser location.origin is used. */
export const SITE_ORIGIN = new InjectionToken<string>('SITE_ORIGIN', { providedIn: 'root', factory: () => '' });

export interface SeoData {
  title: string;
  description?: string | null;
  /** Path without the language prefix, e.g. "/news/my-article" ("" for the home page). */
  path: string;
  lang: Lang;
  image?: string | null;
  type?: 'website' | 'article' | 'event';
  noindex?: boolean;
  jsonLd?: object | null;
  siteName?: string;
}

/** Sets everything search engines and link previews read: title, description, canonical, hreflang, Open Graph, Twitter card, JSON-LD. */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly doc = inject(DOCUMENT);
  private readonly origin = inject(SITE_ORIGIN);

  private base(): string { return (this.origin || this.doc.location?.origin || '').replace(/\/$/, ''); }
  absolute(pathOrUrl: string): string { return /^https?:\/\//.test(pathOrUrl) ? pathOrUrl : this.base() + pathOrUrl; }

  set(d: SeoData): void {
    const siteName = d.siteName ?? 'ANAGEM';
    const full = d.title && d.title !== siteName ? `${d.title} — ${siteName}` : siteName;
    this.title.setTitle(full);
    const description = (d.description ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
    const url = this.absolute(`/${d.lang}${d.path}`);
    const image = d.image ? this.absolute(d.image) : this.absolute('/img/village.jpg');

    this.upsert('name', 'description', description);
    this.upsert('name', 'robots', d.noindex ? 'noindex, nofollow' : 'index, follow');
    this.upsert('property', 'og:type', d.type ?? 'website');
    this.upsert('property', 'og:site_name', siteName);
    this.upsert('property', 'og:title', full);
    this.upsert('property', 'og:description', description);
    this.upsert('property', 'og:url', url);
    this.upsert('property', 'og:image', image);
    this.upsert('property', 'og:locale', ({ fr: 'fr_MA', ar: 'ar_MA', en: 'en_GB' } as Record<Lang, string>)[d.lang]);
    this.upsert('name', 'twitter:card', 'summary_large_image');
    this.upsert('name', 'twitter:title', full);
    this.upsert('name', 'twitter:description', description);
    this.upsert('name', 'twitter:image', image);

    // Pages kept out of the index (404, search) get no canonical/alternate links.
    this.links('canonical', d.noindex ? [] : [{ href: url }]);
    this.links('alternate', d.noindex ? [] : [...LANGS.map((l) => ({ href: this.absolute(`/${l}${d.path}`), hreflang: l })), { href: this.absolute(`/${DEFAULT_LANG}${d.path}`), hreflang: 'x-default' }]);
    this.jsonLd(d.jsonLd ?? null);
  }

  private upsert(attr: 'name' | 'property', key: string, content: string) {
    if (!content) { this.meta.removeTag(`${attr}='${key}'`); return; }
    this.meta.updateTag({ [attr]: key, content }, `${attr}='${key}'`);
  }

  private links(rel: string, items: { href: string; hreflang?: string }[]) {
    this.doc.head.querySelectorAll(`link[rel="${rel}"][data-seo]`).forEach((n) => n.remove());
    for (const it of items) {
      const el = this.doc.createElement('link');
      el.setAttribute('rel', rel);
      el.setAttribute('href', it.href);
      if (it.hreflang) el.setAttribute('hreflang', it.hreflang);
      el.setAttribute('data-seo', '');
      this.doc.head.appendChild(el);
    }
  }

  private jsonLd(data: object | null) {
    this.doc.head.querySelector('script[data-seo-ld]')?.remove();
    if (!data) return;
    const el = this.doc.createElement('script');
    el.setAttribute('type', 'application/ld+json');
    el.setAttribute('data-seo-ld', '');
    el.textContent = JSON.stringify(data).replace(/</g, '\\u003c');
    this.doc.head.appendChild(el);
  }
}
