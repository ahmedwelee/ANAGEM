import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Meta } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { eventCard, fail, newsCard, pageOf, publicationCard, respond, routeWith, settle, text } from '../../../../testing/fixtures';
import { provideAppTesting } from '../../../../testing/test-providers';
import { SearchComponent } from './search';

describe('SearchComponent', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<SearchComponent>;
  const el = () => fixture.nativeElement as HTMLElement;

  async function open(q?: string) {
    TestBed.configureTestingModule({ providers: [...provideAppTesting(), routeWith({ query: q === undefined ? {} : { q } })] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SearchComponent);
    await fixture.whenStable();
  }

  it('asks for nothing and shows the hint when there is no query', async () => {
    await open();
    await settle(fixture);
    http.verify();
    expect(el().textContent).toContain('public.searchHint');
  });

  it('is never indexed by search engines', async () => {
    await open('géographie');
    respond(http, '/api/public/news', pageOf([]));
    respond(http, '/api/public/events', pageOf([]));
    respond(http, '/api/public/publications', pageOf([]));
    await settle(fixture);
    expect(TestBed.inject(Meta).getTag('name="robots"')?.content).toBe('noindex, nofollow');
  });

  it('searches news, events (past ones too) and publications at once and groups the answers', async () => {
    await open('littoral');
    const [n] = respond(http, '/api/public/news', pageOf([newsCard({ title: 'Le littoral' })], { totalElements: 8 }));
    const [e] = respond(http, '/api/public/events', pageOf([eventCard({ title: 'Journée du littoral' })]));
    const [p] = respond(http, '/api/public/publications', pageOf([publicationCard({ title: 'Atlas du littoral' })]));
    expect(n.request.params.get('q')).toBe('littoral');
    expect(n.request.params.get('size')).toBe('6');
    expect(e.request.params.get('scope')).toBe('ALL');
    expect(p.request.params.get('q')).toBe('littoral');
    await settle(fixture);

    const sections = [...el().querySelectorAll('.space-y-10 > section')];
    expect(sections.map((s) => text(s.querySelector('h2')))).toEqual(['public.nav.news (8)', 'public.nav.events (1)', 'public.nav.publications (1)']);
    expect(text(sections[0].querySelector('h3'))).toBe('Le littoral');
    expect(sections[0].querySelector('a[href^="/ar/news"][href*="q=littoral"]')).not.toBeNull(); // "see all" keeps the query
    expect(el().querySelector('[role="status"]')?.textContent).toContain('public.searchCount');
  });

  it('shows only the groups that have results', async () => {
    await open('x');
    respond(http, '/api/public/news', pageOf([]));
    respond(http, '/api/public/events', pageOf([eventCard()]));
    respond(http, '/api/public/publications', pageOf([]));
    await settle(fixture);
    expect([...el().querySelectorAll('.space-y-10 section h2')].map((h) => text(h))).toEqual(['public.nav.events (1)']);
  });

  it('tells the visitor when nothing matches', async () => {
    await open('zzz');
    respond(http, '/api/public/news', pageOf([]));
    respond(http, '/api/public/events', pageOf([]));
    respond(http, '/api/public/publications', pageOf([]));
    await settle(fixture);
    expect(el().textContent).toContain('public.searchNone');
    expect(el().querySelector('.space-y-10')).toBeNull();
  });

  it('still shows the other groups when one of the three searches fails', async () => {
    await open('littoral');
    fail(http, '/api/public/news', 500);
    respond(http, '/api/public/events', pageOf([eventCard({ title: 'Journée' })]));
    respond(http, '/api/public/publications', pageOf([]));
    await settle(fixture);
    expect([...el().querySelectorAll('.space-y-10 section h2')].map((h) => text(h))).toEqual(['public.nav.events (1)']);
  });

  it('goes to the results page for what was typed, trimmed, and ignores an empty box', async () => {
    await open();
    const nav = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const input = el().querySelector<HTMLInputElement>('input[type="search"]')!;
    const form = el().querySelector('form')!;
    input.value = '   ';
    form.dispatchEvent(new Event('submit'));
    expect(nav).not.toHaveBeenCalled();
    input.value = '  atlas  ';
    form.dispatchEvent(new Event('submit'));
    expect(nav).toHaveBeenCalledWith(['/', 'ar', 'search'], { queryParams: { q: 'atlas' } });
  });
});
