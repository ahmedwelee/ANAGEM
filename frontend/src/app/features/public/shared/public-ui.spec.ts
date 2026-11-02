import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideAppTesting } from '../../../../testing/test-providers';
import { MediaRef, NewsCard, PublicationCard, ResourceCard } from '../../../core/api/public-api';
import { SITE_ORIGIN } from '../../../core/seo/seo.service';
import { NewsCardComponent, PageBannerComponent, PublicationCardComponent, ResourceCardComponent, ShareComponent } from './public-ui';

const img: MediaRef = { id: 'm1', url: '/api/public/media/m1', thumbnailUrl: '/api/public/media/m1/thumb', altText: 'Vue du Rif', width: 800, height: 500, contentType: 'image/jpeg' };
const base = { locale: 'fr' as const, fallback: false };

@Component({
  imports: [PageBannerComponent, ShareComponent, NewsCardComponent, PublicationCardComponent, ResourceCardComponent],
  template: `
    <app-page-banner title="Actualités" subtitle="Les nouvelles" />
    <app-share path="/fr/news/mon-article" title="Mon article & plus" />
    <app-news-card [n]="news" />
    <app-publication-card [p]="pub()" />
    <app-resource-card [r]="res" />`,
})
class Host {
  news: NewsCard = { ...base, id: 1, slug: 'mon-article', title: 'Mon article', summary: 'Résumé', publishedAt: '2026-10-01T10:00:00Z', category: { id: 1, slug: 'c', name: 'Événements' }, tags: [], featured: false, image: img };
  pub = signal<PublicationCard>({ ...base, id: 7, kind: 'MAGAZINE_ISSUE', year: 2026, issueNumber: '12', title: 'Numéro 12', description: '<p>Territoires</p>', publishedAt: '2026-10-01T10:00:00Z', category: null, coverImage: null, pdf: null, pdfDownloadUrl: '/api/public/publications/7/download', featured: false });
  res: ResourceCard = { ...base, id: 3, kind: 'MAP', title: 'Carte', description: null, publishedAt: '2026-10-01T10:00:00Z', category: null, file: null, downloadUrl: null, externalUrl: 'https://example.org/carte' };
}

describe('public UI building blocks', () => {
  const render = async () => {
    TestBed.configureTestingModule({ providers: [...provideAppTesting(), { provide: SITE_ORIGIN, useValue: 'https://anagem.ma' }] });
    const f = TestBed.createComponent(Host);
    await f.whenStable();
    return { f, el: f.nativeElement as HTMLElement };
  };

  it('the banner shows the title as the page heading, with a breadcrumb back home', async () => {
    const { el } = await render();
    expect(el.querySelector('h1')?.textContent?.trim()).toBe('Actualités');
    expect(el.querySelector('app-page-banner nav a')?.getAttribute('href')).toBe('/ar');
    expect(el.querySelector('app-page-banner [aria-current="page"]')?.textContent).toBe('Actualités');
  });

  it('share links carry the absolute, URL-encoded address of the page', async () => {
    const { el } = await render();
    const hrefs = [...el.querySelectorAll('app-share a')].map((a) => a.getAttribute('href')!);
    const u = encodeURIComponent('https://anagem.ma/fr/news/mon-article');
    expect(hrefs[0]).toBe('https://www.facebook.com/sharer/sharer.php?u=' + u);
    expect(hrefs[1]).toContain('twitter.com/intent/tweet?url=' + u + '&text=' + encodeURIComponent('Mon article & plus'));
    expect(hrefs[2]).toBe('https://www.linkedin.com/sharing/share-offsite/?url=' + u);
    expect(hrefs[3]).toBe('mailto:?subject=' + encodeURIComponent('Mon article & plus') + '&body=' + u);
    expect([...el.querySelectorAll('app-share a[target="_blank"]')].every((a) => a.getAttribute('rel')?.includes('noopener'))).toBe(true);
  });

  it('copy-link writes to the clipboard when available and never throws when it is not', async () => {
    const { el } = await render();
    const copy = el.querySelector<HTMLButtonElement>('app-share button')!;
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    copy.click();
    expect(writeText).toHaveBeenCalledWith('https://anagem.ma/fr/news/mon-article');
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    expect(() => copy.click()).not.toThrow();
  });

  it('news card links to the article and uses the image alt text', async () => {
    const { el } = await render();
    const card = el.querySelector('app-news-card')!;
    expect(card.querySelector('h3 a')?.getAttribute('href')).toBe('/ar/news/mon-article');
    const i = card.querySelector('img')!;
    expect(i.getAttribute('src')).toBe('/api/public/media/m1/thumb');
    expect(i.getAttribute('alt')).toBe('Vue du Rif');
    expect(i.getAttribute('loading')).toBe('lazy');
    expect(card.textContent).toContain('Événements');
  });

  it('publication card offers the PDF only when there is one, and shows a plain-text excerpt', async () => {
    const { f, el } = await render();
    const card = () => el.querySelector('app-publication-card')!;
    expect(card().querySelector('a[href="/api/public/publications/7/download"]')).not.toBeNull();
    expect(card().textContent).toContain('Territoires');
    expect(card().innerHTML).not.toContain('<p>Territoires');
    f.componentInstance.pub.update((p) => ({ ...p, pdfDownloadUrl: null }));
    await f.whenStable();
    expect(card().querySelector('a[href*="download"]')).toBeNull();
  });

  it('resource card shows only the actions that exist; external links are safe', async () => {
    const { el } = await render();
    const links = [...el.querySelectorAll('app-resource-card a')];
    expect(links.length).toBe(1);
    expect(links[0].getAttribute('href')).toBe('https://example.org/carte');
    expect(links[0].getAttribute('rel')).toBe('noopener noreferrer');
  });
});
