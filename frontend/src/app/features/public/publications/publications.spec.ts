import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Meta } from '@angular/platform-browser';
import { fail, mediaRef, pageOf, pending, publicationCard, respond, settle, text } from '../../../../testing/fixtures';
import { provideAppTesting } from '../../../../testing/test-providers';
import { LangService } from '../../../core/i18n/lang.service';
import { PublicPublicationDetailComponent } from './publication-detail';
import { PublicPublicationsListComponent } from './publications-list';

const PUBS = '/api/public/publications';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('PublicPublicationsListComponent', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<PublicPublicationsListComponent>;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PublicPublicationsListComponent);
    await fixture.whenStable();
  });

  it('lists the publications with their kind, year, issue number and PDF link', async () => {
    respond(http, `${PUBS}/years`, [2026, 2025]);
    respond(http, PUBS, pageOf([publicationCard({ id: 7, title: 'Numéro 12', pdfDownloadUrl: '/api/public/media/x?download=true' }), publicationCard({ id: 8, kind: 'BOOK', year: 2024, issueNumber: null, title: 'Un livre' })]));
    await settle(fixture);
    const cards = [...el().querySelectorAll('article')];
    expect(cards).toHaveLength(2);
    expect(text(cards[0])).toContain('Numéro 12');
    expect(text(cards[0])).toContain('kind.MAGAZINE_ISSUE');
    expect(text(cards[0])).toContain('N° 12');
    expect(cards[0].querySelector('a[href="/api/public/media/x?download=true"]')).not.toBeNull();
    expect(text(cards[1])).not.toContain('N°');
    expect(cards[1].querySelector('a[href$="download=true"]')).toBeNull();
    expect(cards[0].querySelector('h3 a')?.getAttribute('href')).toBe('/ar/publications/7');
  });

  it('offers the years that have publications and filters by year and kind', async () => {
    respond(http, `${PUBS}/years`, [2026, 2025]);
    respond(http, PUBS, pageOf([publicationCard()]));
    await settle(fixture);
    const [kind, year] = [...el().querySelectorAll<HTMLSelectElement>('select')];
    expect([...year.options].map((o) => o.textContent?.trim())).toEqual(['public.allYears', '2026', '2025']);

    year.value = year.options[2].value;
    year.dispatchEvent(new Event('change'));
    await settle(fixture);
    const [yearReq] = respond(http, PUBS, pageOf([]));
    expect(yearReq.request.params.get('year')).toBe('2025');
    await settle(fixture);

    kind.value = 'BOOK';
    kind.dispatchEvent(new Event('change'));
    await settle(fixture);
    const [req] = pending(http, PUBS);
    expect(req.request.params.get('kind')).toBe('BOOK');
    expect(req.request.params.get('year')).toBe('2025');
    req.flush(pageOf([]));
  });

  it('searches after the visitor pauses typing', async () => {
    respond(http, `${PUBS}/years`, []);
    respond(http, PUBS, pageOf([]));
    await settle(fixture);
    const input = el().querySelector<HTMLInputElement>('input[type="search"]')!;
    input.value = 'littoral';
    input.dispatchEvent(new Event('input'));
    await wait(380);
    expect(pending(http, PUBS)[0].request.params.get('q')).toBe('littoral');
  });

  it('shows the empty state and recovers from an error', async () => {
    fail(http, `${PUBS}/years`, 500);
    fail(http, PUBS, 500, 'INTERNAL_ERROR', 'Panne');
    await settle(fixture);
    expect(el().querySelector('[role="alert"]')?.textContent).toContain('Panne');
    el().querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    await settle(fixture);
    respond(http, PUBS, pageOf([]));
    await settle(fixture);
    expect(el().textContent).toContain('public.noPublications');
  });

  it('reloads in the new language', async () => {
    respond(http, `${PUBS}/years`, []);
    respond(http, PUBS, pageOf([]));
    await settle(fixture);
    await TestBed.inject(LangService).set('en');
    await settle(fixture);
    expect(pending(http, PUBS)[0].request.params.get('lang')).toBe('en');
  });
});

describe('PublicPublicationDetailComponent', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<PublicPublicationDetailComponent>;
  const el = () => fixture.nativeElement as HTMLElement;

  async function open(id = '7') {
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PublicPublicationDetailComponent);
    fixture.componentRef.setInput('id', id);
    await fixture.whenStable();
  }

  it('shows the issue with its cover, description and download button', async () => {
    await open();
    pending(http, `${PUBS}/7`)[0].flush(publicationCard({ coverImage: mediaRef({ url: '/api/public/media/c1', altText: 'Couverture' }), pdfDownloadUrl: '/api/public/media/f1?download=true' }));
    await settle(fixture);
    expect(text(el().querySelector('h1'))).toBe('Géographie du Maroc n°12');
    expect(el().querySelector('img[alt="Couverture"]')?.getAttribute('src')).toBe('/api/public/media/c1');
    expect(el().textContent).toContain('N° 12');
    expect(el().querySelector('.rte-content')?.textContent).toBe('Dossier');
    expect(el().querySelector('a[href="/api/public/media/f1?download=true"]')).not.toBeNull();
    expect(JSON.parse(document.head.querySelector('script[data-seo-ld]')!.textContent!)['@type']).toBe('PublicationIssue');
  });

  it('shows a title card when there is no cover, and no PDF buttons or viewer without a file', async () => {
    await open();
    pending(http, `${PUBS}/7`)[0].flush(publicationCard({ kind: 'BOOK', coverImage: null, pdf: null, pdfDownloadUrl: null }));
    await settle(fixture);
    expect(el().querySelector('.aspect-\\[3\\/4\\] img')).toBeNull();
    expect(el().querySelector('iframe')).toBeNull();
    expect(el().querySelector('a[href$="download=true"]')).toBeNull();
    expect(JSON.parse(document.head.querySelector('script[data-seo-ld]')!.textContent!)['@type']).toBe('Book');
  });

  it('previews the PDF in a frame only when it is served by this site', async () => {
    await open();
    pending(http, `${PUBS}/7`)[0].flush(publicationCard({ pdf: mediaRef({ url: '/api/public/media/f1', contentType: 'application/pdf' }) }));
    await settle(fixture);
    expect(el().querySelector('iframe')?.getAttribute('src')).toBe('/api/public/media/f1');

    fixture.componentRef.setInput('id', '8');
    await settle(fixture);
    pending(http, `${PUBS}/8`)[0].flush(publicationCard({ id: 8, pdf: mediaRef({ url: 'https://evil.example/doc.pdf', contentType: 'application/pdf' }) }));
    await settle(fixture);
    expect(el().querySelector('iframe')).toBeNull(); // an outside address is never framed
  });

  it('says the publication does not exist on a 404', async () => {
    await open('999');
    fail(http, `${PUBS}/999`, 404, 'NOT_FOUND');
    await settle(fixture);
    expect(el().querySelector('h1')?.textContent).toContain('public.publicationNotFound');
    expect(TestBed.inject(Meta).getTag('name="robots"')?.content).toBe('noindex, nofollow');
    expect(el().querySelector('a')?.getAttribute('href')).toBe('/ar/publications');
  });

  it('shows a loading error for other failures', async () => {
    await open();
    fail(http, `${PUBS}/7`, 500);
    await settle(fixture);
    expect(el().querySelector('h1')?.textContent).toContain('public.loadError');
  });
});
