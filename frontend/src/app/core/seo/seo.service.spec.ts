import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { SITE_ORIGIN, SeoService } from './seo.service';

describe('SeoService', () => {
  const setup = (origin = 'https://anagem.ma') => {
    TestBed.configureTestingModule({ providers: [{ provide: SITE_ORIGIN, useValue: origin }] });
    return { seo: TestBed.inject(SeoService), meta: TestBed.inject(Meta), title: TestBed.inject(Title), doc: TestBed.inject(DOCUMENT) };
  };
  const links = (doc: Document, rel: string) => [...doc.head.querySelectorAll(`link[rel="${rel}"][data-seo]`)].map((l) => [l.getAttribute('hreflang'), l.getAttribute('href')]);
  afterEach(() => { document.head.querySelectorAll('[data-seo],[data-seo-ld],meta[name],meta[property]').forEach((n) => n.remove()); });

  it('sets title, description, canonical, all hreflang alternates and Open Graph', () => {
    const { seo, meta, title, doc } = setup();
    seo.set({ title: 'Actualités', description: '  Les   dernières nouvelles ', path: '/news', lang: 'fr', siteName: 'ANAGEM' });
    expect(title.getTitle()).toBe('Actualités — ANAGEM');
    expect(meta.getTag('name="description"')?.content).toBe('Les dernières nouvelles');
    expect(meta.getTag('name="robots"')?.content).toBe('index, follow');
    expect(links(doc, 'canonical')).toEqual([[null, 'https://anagem.ma/fr/news']]);
    expect(links(doc, 'alternate')).toEqual([['fr', 'https://anagem.ma/fr/news'], ['ar', 'https://anagem.ma/ar/news'], ['en', 'https://anagem.ma/en/news'], ['x-default', 'https://anagem.ma/ar/news']]);
    expect(meta.getTag('property="og:title"')?.content).toBe('Actualités — ANAGEM');
    expect(meta.getTag('property="og:url"')?.content).toBe('https://anagem.ma/fr/news');
    expect(meta.getTag('property="og:locale"')?.content).toBe('fr_MA');
    expect(meta.getTag('property="og:image"')?.content).toBe('https://anagem.ma/img/village.jpg');
    expect(meta.getTag('name="twitter:card"')?.content).toBe('summary_large_image');
  });

  it('uses the bare site name for the home page and an absolute image URL', () => {
    const { seo, meta, title } = setup();
    seo.set({ title: 'ANAGEM', path: '', lang: 'ar', image: '/api/public/media/abc', siteName: 'ANAGEM' });
    expect(title.getTitle()).toBe('ANAGEM');
    expect(meta.getTag('property="og:image"')?.content).toBe('https://anagem.ma/api/public/media/abc');
    expect(meta.getTag('property="og:locale"')?.content).toBe('ar_MA');
  });

  it('replaces tags on the next call instead of piling them up', () => {
    const { seo, doc } = setup();
    seo.set({ title: 'A', path: '/a', lang: 'fr' });
    seo.set({ title: 'B', path: '/b', lang: 'en' });
    expect(links(doc, 'canonical')).toEqual([[null, 'https://anagem.ma/en/b']]);
    expect(doc.head.querySelectorAll('meta[property="og:title"]').length).toBe(1);
    expect(links(doc, 'alternate').length).toBe(4);
  });

  it('keeps noindex pages out of the index and gives them no canonical or alternates', () => {
    const { seo, meta, doc } = setup();
    seo.set({ title: '404', path: '/nope', lang: 'fr', noindex: true });
    expect(meta.getTag('name="robots"')?.content).toBe('noindex, nofollow');
    expect(links(doc, 'canonical')).toEqual([]);
    expect(links(doc, 'alternate')).toEqual([]);
  });

  it('writes JSON-LD safely (no </script> breakout) and removes it on the next page', () => {
    const { seo, doc } = setup();
    seo.set({ title: 'X', path: '/x', lang: 'fr', jsonLd: { '@type': 'Event', name: '</script><script>alert(1)</script>' } });
    const el = doc.head.querySelector('script[data-seo-ld]')!;
    expect(el.getAttribute('type')).toBe('application/ld+json');
    expect(el.textContent).not.toContain('<');
    expect(JSON.parse(el.textContent!).name).toBe('</script><script>alert(1)</script>');
    seo.set({ title: 'Y', path: '/y', lang: 'fr' });
    expect(doc.head.querySelector('script[data-seo-ld]')).toBeNull();
  });

  it('absolute() leaves full URLs alone and prefixes paths', () => {
    const { seo } = setup('https://anagem.ma/');
    expect(seo.absolute('/fr')).toBe('https://anagem.ma/fr');
    expect(seo.absolute('https://cdn.example/x.png')).toBe('https://cdn.example/x.png');
  });
});
