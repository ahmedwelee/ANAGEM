import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Meta } from '@angular/platform-browser';
import { eventCard, fail, mediaRef, pageOf, pending, respond, routeWith, settle, text } from '../../../../testing/fixtures';
import { provideAppTesting } from '../../../../testing/test-providers';
import { LangService } from '../../../core/i18n/lang.service';
import { PublicEventDetailComponent } from './event-detail';
import { PublicEventsListComponent } from './events-list';

const EVENTS = '/api/public/events';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('PublicEventsListComponent', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<PublicEventsListComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const scopeButtons = () => [...el().querySelectorAll<HTMLButtonElement>('[role="group"] button')];

  async function open(query: Record<string, string> = {}) {
    TestBed.configureTestingModule({ providers: [...provideAppTesting(), routeWith({ query })] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PublicEventsListComponent);
    await fixture.whenStable();
  }

  it('starts with upcoming events, 10 per page, and lists them with their link', async () => {
    await open();
    const [req] = pending(http, EVENTS);
    expect(req.request.params.get('scope')).toBe('UPCOMING');
    expect(req.request.params.get('size')).toBe('10');
    expect(req.request.params.get('lang')).toBe('ar');
    req.flush(pageOf([eventCard({ id: 1, slug: 'colloque', title: 'Colloque' }), eventCard({ id: 2, slug: 'seminaire', title: 'Séminaire', type: 'SEMINAR' })]));
    await settle(fixture);
    expect([...el().querySelectorAll('h3')].map((h) => text(h))).toEqual(['Colloque', 'Séminaire']);
    expect(el().querySelector('h3 a')?.getAttribute('href')).toBe('/ar/events/colloque');
  });

  it('marks the active scope and switches between upcoming, past and all', async () => {
    await open();
    respond(http, EVENTS, pageOf([eventCard()]));
    await settle(fixture);
    expect(scopeButtons().map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false']);

    scopeButtons()[1].click();
    await settle(fixture);
    const [past] = pending(http, EVENTS);
    expect(past.request.params.get('scope')).toBe('PAST');
    expect(past.request.params.get('page')).toBe('0');
    past.flush(pageOf([eventCard({ timeStatus: 'PAST' })]));
    await settle(fixture);
    expect(scopeButtons().map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);

    scopeButtons()[2].click();
    await settle(fixture);
    expect(pending(http, EVENTS)[0].request.params.get('scope')).toBe('ALL');
  });

  it('honours the scope in the address and ignores an unknown one', async () => {
    await open({ scope: 'PAST' });
    expect(pending(http, EVENTS)[0].request.params.get('scope')).toBe('PAST');
    TestBed.resetTestingModule();
    await open({ scope: 'EVERYTHING' });
    expect(pending(http, EVENTS)[0].request.params.get('scope')).toBe('UPCOMING');
  });

  it('filters by type and by search text', async () => {
    await open();
    respond(http, EVENTS, pageOf([eventCard()]));
    await settle(fixture);
    const select = el().querySelector<HTMLSelectElement>('select')!;
    expect(select.options.length).toBe(10); // all types + "all"
    select.value = 'WORKSHOP';
    select.dispatchEvent(new Event('change'));
    await settle(fixture);
    const [typeReq] = respond(http, EVENTS, pageOf([]));
    expect(typeReq.request.params.get('type')).toBe('WORKSHOP');
    await settle(fixture);

    const input = el().querySelector<HTMLInputElement>('input[type="search"]')!;
    input.value = ' colloque ';
    input.dispatchEvent(new Event('input'));
    await wait(380);
    const [req] = pending(http, EVENTS);
    expect(req.request.params.get('q')).toBe('colloque');
    expect(req.request.params.get('type')).toBe('WORKSHOP'); // filters combine
    req.flush(pageOf([]));
  });

  it('shows the empty state, and an error with a retry button', async () => {
    await open();
    respond(http, EVENTS, pageOf([]));
    await settle(fixture);
    expect(el().textContent).toContain('public.noEvents');

    scopeButtons()[2].click();
    await settle(fixture);
    fail(http, EVENTS, 500, 'INTERNAL_ERROR', 'Indisponible');
    await settle(fixture);
    expect(el().querySelector('[role="alert"]')?.textContent).toContain('Indisponible');
    el().querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    await settle(fixture);
    expect(pending(http, EVENTS)).toHaveLength(1);
  });

  it('reloads in the new language', async () => {
    await open();
    respond(http, EVENTS, pageOf([eventCard()]));
    await settle(fixture);
    await TestBed.inject(LangService).set('fr');
    await settle(fixture);
    expect(pending(http, EVENTS)[0].request.params.get('lang')).toBe('fr');
  });
});

describe('PublicEventDetailComponent', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<PublicEventDetailComponent>;
  const el = () => fixture.nativeElement as HTMLElement;

  async function open(slug = 'colloque-kenitra') {
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PublicEventDetailComponent);
    fixture.componentRef.setInput('slug', slug);
    await fixture.whenStable();
  }

  it('shows the event with its details, type, status and structured data for search engines', async () => {
    await open();
    pending(http, `${EVENTS}/colloque-kenitra`)[0].flush(eventCard({ title: 'Colloque national', organizer: 'ANAGEM', location: 'Faculté des Lettres, Kénitra', image: mediaRef({ altText: 'Affiche' }) }));
    await settle(fixture);
    expect(text(el().querySelector('h1'))).toBe('Colloque national');
    expect(el().textContent).toContain('eventType.CONFERENCE');
    expect(el().textContent).toContain('public.status.UPCOMING');
    const facts = text(el().querySelector('dl'));
    expect(facts).toContain('Faculté des Lettres, Kénitra');
    expect(facts).toContain('ANAGEM');
    expect(el().querySelector('img[alt="Affiche"]')).not.toBeNull();
    const ld = JSON.parse(document.head.querySelector('script[data-seo-ld]')!.textContent!);
    expect(ld['@type']).toBe('Event');
    expect(ld.name).toBe('Colloque national');
    expect(ld.location.name).toBe('Faculté des Lettres, Kénitra');
    expect(ld.organizer.name).toBe('ANAGEM');
  });

  it('offers registration only for events that are not over, and the programme when there is one', async () => {
    await open();
    pending(http, `${EVENTS}/colloque-kenitra`)[0].flush(eventCard({ registrationUrl: 'https://example.org/register', programDownloadUrl: '/api/public/media/p1?download=true' }));
    await settle(fixture);
    const links = [...el().querySelectorAll('aside a')];
    expect(links.find((a) => a.getAttribute('href') === 'https://example.org/register')?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(links.some((a) => a.getAttribute('href') === '/api/public/media/p1?download=true')).toBe(true);

    fixture.componentRef.setInput('slug', 'passe');
    await settle(fixture);
    pending(http, `${EVENTS}/passe`)[0].flush(eventCard({ slug: 'passe', timeStatus: 'PAST', registrationUrl: 'https://example.org/register' }));
    await settle(fixture);
    expect([...el().querySelectorAll('aside a')].some((a) => a.getAttribute('href') === 'https://example.org/register')).toBe(false);
    expect(el().textContent).toContain('public.status.PAST');
  });

  it('omits the facts that are unknown', async () => {
    await open();
    pending(http, `${EVENTS}/colloque-kenitra`)[0].flush(eventCard({ location: null, organizer: null, description: null }));
    await settle(fixture);
    const labels = [...el().querySelectorAll('dt')].map((d) => text(d));
    expect(labels).toEqual(['public.when']);
    expect(el().querySelector('.rte-content')).toBeNull();
  });

  it('flags an event shown in another language than requested', async () => {
    await open();
    pending(http, `${EVENTS}/colloque-kenitra`)[0].flush(eventCard({ locale: 'ar', fallback: true }));
    await settle(fixture);
    expect(el().querySelector('article')?.getAttribute('dir')).toBe('rtl');
    expect(el().textContent).toContain('public.fallbackNote');
  });

  it('reports an unknown event as not found and any other failure as a loading error', async () => {
    await open('inconnu');
    fail(http, `${EVENTS}/inconnu`, 404, 'NOT_FOUND');
    await settle(fixture);
    expect(el().querySelector('h1')?.textContent).toContain('public.eventNotFound');
    expect(TestBed.inject(Meta).getTag('name="robots"')?.content).toBe('noindex, nofollow');

    fixture.componentRef.setInput('slug', 'casse');
    await settle(fixture);
    fail(http, `${EVENTS}/casse`, 500);
    await settle(fixture);
    expect(el().querySelector('h1')?.textContent).toContain('public.loadError');
  });
});
