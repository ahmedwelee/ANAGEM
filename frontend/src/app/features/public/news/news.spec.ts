import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { fail, newsCard, newsDetail, pageOf, pending, respond, routeWith, settle, text } from '../../../../testing/fixtures';
import { provideAppTesting } from '../../../../testing/test-providers';
import { LangService } from '../../../core/i18n/lang.service';
import { PublicNewsDetailComponent } from './news-detail';
import { PublicNewsListComponent } from './news-list';

const NEWS = '/api/public/news';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('PublicNewsListComponent', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<PublicNewsListComponent>;
  const el = () => fixture.nativeElement as HTMLElement;

  async function open(query: Record<string, string> = {}) {
    TestBed.configureTestingModule({ providers: [...provideAppTesting(), routeWith({ query })] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PublicNewsListComponent);
    await fixture.whenStable();
  }

  it('asks for the first page of news in the default language (Arabic) and lists the articles with links in that language', async () => {
    await open();
    const [req] = pending(http, NEWS);
    expect(req.request.params.get('lang')).toBe('ar');
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('9');
    req.flush(pageOf([newsCard({ id: 1, slug: 'a', title: 'Alpha' }), newsCard({ id: 2, slug: 'b', title: 'Beta', category: { id: 5, slug: 'c', name: 'Colloques' } })], { size: 9 }));
    respond(http, '/api/public/categories', []);
    await settle(fixture);

    const titles = [...el().querySelectorAll('h3')].map((h) => text(h));
    expect(titles).toEqual(['Alpha', 'Beta']);
    expect(el().querySelector('h3 a')?.getAttribute('href')).toBe('/ar/news/a');
    expect(el().textContent).toContain('Colloques');
  });

  it('shows a loading skeleton, then the empty state when there is no news', async () => {
    await open();
    await settle(fixture);
    expect(el().querySelectorAll('.skeleton').length).toBeGreaterThan(0);
    respond(http, NEWS, pageOf([]));
    respond(http, '/api/public/categories', []);
    await settle(fixture);
    expect(el().querySelector('.skeleton')).toBeNull();
    expect(el().textContent).toContain('public.noNews');
  });

  it('explains a failure and retries on demand', async () => {
    await open();
    fail(http, NEWS, 500, 'INTERNAL_ERROR', 'Boom');
    respond(http, '/api/public/categories', []);
    await settle(fixture);
    expect(el().querySelector('[role="alert"]')?.textContent).toContain('Boom');

    el().querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    await settle(fixture);
    respond(http, NEWS, pageOf([newsCard({ title: 'Revenue' })]));
    await settle(fixture);
    expect(el().querySelector('[role="alert"]')).toBeNull();
    expect(el().textContent).toContain('Revenue');
  });

  it('filters by category from the drop-down and goes back to the first page', async () => {
    await open();
    respond(http, NEWS, pageOf([newsCard()]));
    respond(http, '/api/public/categories', [{ id: 1, type: 'NEWS', slug: 'colloques', name: 'Colloques', description: null }]);
    await settle(fixture);
    const select = el().querySelector<HTMLSelectElement>('select')!;
    select.value = 'colloques';
    select.dispatchEvent(new Event('change'));
    await settle(fixture);
    const [req] = pending(http, NEWS);
    expect(req.request.params.get('category')).toBe('colloques');
    expect(req.request.params.get('page')).toBe('0');
    req.flush(pageOf([]));
  });

  it('pages through the results', async () => {
    await open();
    respond(http, NEWS, pageOf([newsCard()], { size: 9, totalElements: 12, totalPages: 2 }));
    respond(http, '/api/public/categories', []);
    await settle(fixture);
    expect(el().textContent).toContain('1 / 2');
    el().querySelector<HTMLButtonElement>('button[aria-label="common.next"]')!.click();
    await settle(fixture);
    const [req] = pending(http, NEWS);
    expect(req.request.params.get('page')).toBe('1');
    req.flush(pageOf([newsCard({ id: 2, title: 'Page 2' })], { page: 1, size: 9, totalElements: 12, totalPages: 2 }));
    await settle(fixture);
    expect(el().textContent).toContain('2 / 2');
    expect(el().textContent).toContain('Page 2');
  });

  it('waits for the visitor to stop typing before searching', async () => {
    await open();
    respond(http, NEWS, pageOf([newsCard()]));
    respond(http, '/api/public/categories', []);
    await settle(fixture);
    const input = el().querySelector<HTMLInputElement>('input[type="search"]')!;
    for (const v of ['g', 'gé', '  géo  ']) { input.value = v; input.dispatchEvent(new Event('input')); }
    expect(pending(http, NEWS)).toHaveLength(0);
    await wait(380);
    const reqs = pending(http, NEWS);
    expect(reqs).toHaveLength(1);
    expect(reqs[0].request.params.get('q')).toBe('géo');
    reqs[0].flush(pageOf([]));
  });

  it('reloads the list and the categories in the new language', async () => {
    await open();
    respond(http, NEWS, pageOf([newsCard()]));
    respond(http, '/api/public/categories', []);
    await settle(fixture);
    await TestBed.inject(LangService).set('en');
    await settle(fixture);
    expect(pending(http, NEWS)[0].request.params.get('lang')).toBe('en');
    expect(pending(http, '/api/public/categories')[0].request.params.get('lang')).toBe('en');
  });

  it('applies a tag from the address and lets the visitor remove it', async () => {
    await open({ tag: 'colloque' });
    const [req] = pending(http, NEWS);
    expect(req.request.params.get('tag')).toBe('colloque');
    req.flush(pageOf([newsCard()]));
    respond(http, '/api/public/categories', []);
    await settle(fixture);
    const chip = [...el().querySelectorAll('button')].find((b) => text(b).includes('#colloque'))!;
    chip.click();
    await settle(fixture);
    const [again] = pending(http, NEWS);
    expect(again.request.params.has('tag')).toBe(false);
    again.flush(pageOf([newsCard()]));
    await settle(fixture);
    expect([...el().querySelectorAll('button')].some((b) => text(b).includes('#colloque'))).toBe(false);
  });

  it('sets the page title and keeps the page indexable', async () => {
    await open();
    respond(http, NEWS, pageOf([]));
    respond(http, '/api/public/categories', []);
    await settle(fixture);
    expect(TestBed.inject(Title).getTitle()).toContain('public.nav.news');
    expect(TestBed.inject(Meta).getTag('name="robots"')?.content).toBe('index, follow');
  });
});

describe('PublicNewsDetailComponent', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<PublicNewsDetailComponent>;
  const el = () => fixture.nativeElement as HTMLElement;

  async function open(slug = 'premiere-actualite') {
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PublicNewsDetailComponent);
    fixture.componentRef.setInput('slug', slug);
    await fixture.whenStable();
  }

  it('shows the article, its category, date, tags and a share bar, and sets the SEO tags', async () => {
    await open();
    const [req] = pending(http, `${NEWS}/premiere-actualite`);
    expect(req.request.params.get('lang')).toBe('ar');
    req.flush(newsDetail({ title: 'Grand colloque', category: { id: 2, slug: 'colloques', name: 'Colloques' }, tags: ['kenitra', 'geographie'], image: { id: 'm1', url: '/api/public/media/m1', thumbnailUrl: null, altText: 'Affiche' }, seoDescription: 'Description SEO' }));
    respond(http, `${NEWS}/premiere-actualite/related`, [newsCard({ id: 9, slug: 'liee', title: 'Article lié' })]);
    await settle(fixture);

    expect(text(el().querySelector('h1'))).toBe('Grand colloque');
    expect(el().textContent).toContain('Colloques');
    expect(el().querySelector('img[alt="Affiche"]')?.getAttribute('src')).toBe('/api/public/media/m1');
    expect([...el().querySelectorAll('ul a')].map((a) => text(a))).toContain('#kenitra');
    expect(el().querySelector('app-share')).not.toBeNull();
    expect(el().querySelector('.rte-content')?.innerHTML).toContain('Corps de l\'article');
    expect(text(el().querySelector('section[aria-label="public.related"] h3'))).toBe('Article lié');
    expect(TestBed.inject(Title).getTitle()).toBe('Grand colloque — ANAGEM');
    expect(TestBed.inject(Meta).getTag('name="description"')?.content).toBe('Description SEO');
    expect(TestBed.inject(Meta).getTag('property="og:type"')?.content).toBe('article');
    expect(document.head.querySelector('script[data-seo-ld]')?.textContent).toContain('NewsArticle');
  });

  it('renders the article in its own language and direction, with a note when it is a fallback', async () => {
    await open();
    respond(http, `${NEWS}/premiere-actualite`, newsDetail({ locale: 'ar', fallback: true, title: 'عنوان' }));
    respond(http, `${NEWS}/premiere-actualite/related`, []);
    await settle(fixture);
    const article = el().querySelector('article')!;
    expect(article.getAttribute('lang')).toBe('ar');
    expect(article.getAttribute('dir')).toBe('rtl');
    expect(el().textContent).toContain('public.fallbackNote');
  });

  it('never executes scripts or event handlers hidden in the article text', async () => {
    await open();
    respond(http, `${NEWS}/premiere-actualite`, newsDetail({ content: '<p>ok</p><img src="x" onerror="window.__pwned=1"><script>window.__pwned=1</script><a href="javascript:window.__pwned=1">lien</a>' }));
    respond(http, `${NEWS}/premiere-actualite/related`, []);
    await settle(fixture);
    const body = el().querySelector('.rte-content')!;
    expect(body.querySelector('script')).toBeNull();
    expect(body.innerHTML).not.toContain('onerror');
    expect(body.querySelector('a')?.getAttribute('href')).toMatch(/^unsafe:/); // Angular defuses script URLs instead of keeping them live
    expect((window as unknown as Record<string, unknown>)['__pwned']).toBeUndefined();
  });

  it('survives a failing related-articles request', async () => {
    await open();
    respond(http, `${NEWS}/premiere-actualite`, newsDetail());
    fail(http, `${NEWS}/premiere-actualite/related`, 500);
    await settle(fixture);
    expect(el().querySelector('h1')).not.toBeNull();
    expect(el().querySelector('section[aria-label="public.related"]')).toBeNull();
  });

  it('says the article does not exist on a 404 and keeps the page out of the index', async () => {
    await open('inconnu');
    fail(http, `${NEWS}/inconnu`, 404, 'NOT_FOUND');
    await settle(fixture);
    expect(el().querySelector('h1')?.textContent).toContain('public.articleNotFound');
    expect(el().querySelector('a')?.getAttribute('href')).toBe('/ar/news');
    expect(TestBed.inject(Meta).getTag('name="robots"')?.content).toBe('noindex, nofollow');
  });

  it('shows a generic error for other failures', async () => {
    await open();
    fail(http, `${NEWS}/premiere-actualite`, 500);
    await settle(fixture);
    expect(el().querySelector('h1')?.textContent).toContain('public.loadError');
  });

  it('loads the other article when the address changes, and drops the old one while loading', async () => {
    await open('premiere-actualite');
    respond(http, `${NEWS}/premiere-actualite`, newsDetail({ title: 'Premier' }));
    respond(http, `${NEWS}/premiere-actualite/related`, []);
    await settle(fixture);
    fixture.componentRef.setInput('slug', 'deuxieme');
    await settle(fixture);
    expect(el().querySelector('h1')).toBeNull();
    expect(el().querySelector('[aria-busy="true"]')).not.toBeNull();
    respond(http, `${NEWS}/deuxieme`, newsDetail({ slug: 'deuxieme', title: 'Deuxième' }));
    respond(http, `${NEWS}/deuxieme/related`, []);
    await settle(fixture);
    expect(text(el().querySelector('h1'))).toBe('Deuxième');
  });

  it('refetches in the new language when the visitor switches language', async () => {
    await open();
    respond(http, `${NEWS}/premiere-actualite`, newsDetail());
    respond(http, `${NEWS}/premiere-actualite/related`, []);
    await settle(fixture);
    await TestBed.inject(LangService).set('fr');
    await settle(fixture);
    expect(pending(http, `${NEWS}/premiere-actualite`)[0].request.params.get('lang')).toBe('fr');
  });
});
