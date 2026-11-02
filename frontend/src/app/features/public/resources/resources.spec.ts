import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { fail, mediaRef, pageOf, pending, resourceCard, respond, settle, text } from '../../../../testing/fixtures';
import { provideAppTesting } from '../../../../testing/test-providers';
import { LangService } from '../../../core/i18n/lang.service';
import { PublicResourcesListComponent } from './resources-list';

const RESOURCES = '/api/public/resources';
const CATEGORIES = '/api/public/categories';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('PublicResourcesListComponent', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<PublicResourcesListComponent>;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PublicResourcesListComponent);
    await fixture.whenStable();
  });

  it('asks for 12 resources in the visitor language and the RESOURCE categories', async () => {
    const [list] = pending(http, RESOURCES);
    expect(list.request.params.get('size')).toBe('12');
    expect(list.request.params.get('lang')).toBe('ar');
    list.flush(pageOf([]));
    const [cats] = pending(http, CATEGORIES);
    expect(cats.request.params.get('type')).toBe('RESOURCE');
    cats.flush([]);
  });

  it('offers the right action for each kind of resource', async () => {
    respond(http, CATEGORIES, []);
    respond(http, RESOURCES, pageOf([
      resourceCard({ id: 1, title: 'Carte PDF', file: mediaRef({ url: '/api/public/media/f1', contentType: 'application/pdf' }), downloadUrl: '/api/public/media/f1?download=true' }),
      resourceCard({ id: 2, title: 'Lien externe', kind: 'OFFICIAL', externalUrl: 'https://example.org/data' }),
    ]));
    await settle(fixture);
    const [pdf, link] = [...el().querySelectorAll('article')];
    expect(text(pdf.querySelector('h3'))).toBe('Carte PDF');
    expect(pdf.querySelector('a[href="/api/public/media/f1?download=true"]')).not.toBeNull();
    expect(pdf.querySelector('a[target="_blank"]')?.getAttribute('rel')).toBe('noopener');
    expect(link.querySelector('a[href="https://example.org/data"]')?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.querySelector('a[href$="download=true"]')).toBeNull();
    expect(text(link)).toContain('resourceKind.OFFICIAL');
  });

  it('filters by kind, category and search text, always starting over from the first page', async () => {
    respond(http, CATEGORIES, [{ id: 4, type: 'RESOURCE', slug: 'cartes', name: 'Cartes', description: null }]);
    respond(http, RESOURCES, pageOf([resourceCard()]));
    await settle(fixture);
    const [kind, category] = [...el().querySelectorAll<HTMLSelectElement>('select')];
    expect(kind.options.length).toBe(7);

    kind.value = 'MAP';
    kind.dispatchEvent(new Event('change'));
    await settle(fixture);
    const [byKind] = respond(http, RESOURCES, pageOf([]));
    expect(byKind.request.params.get('kind')).toBe('MAP');
    expect(byKind.request.params.get('page')).toBe('0');
    await settle(fixture);

    category.value = category.options[1].value;
    category.dispatchEvent(new Event('change'));
    await settle(fixture);
    const [byCategory] = respond(http, RESOURCES, pageOf([]));
    expect(byCategory.request.params.get('categoryId')).toBe('4');
    expect(byCategory.request.params.get('kind')).toBe('MAP');
    await settle(fixture);

    const input = el().querySelector<HTMLInputElement>('input[type="search"]')!;
    input.value = 'littoral';
    input.dispatchEvent(new Event('input'));
    await wait(380);
    expect(respond(http, RESOURCES, pageOf([]))[0].request.params.get('q')).toBe('littoral');
  });

  it('hides the category filter when there are no categories', async () => {
    respond(http, CATEGORIES, []);
    respond(http, RESOURCES, pageOf([]));
    await settle(fixture);
    expect(el().querySelectorAll('select')).toHaveLength(1);
    expect(el().textContent).toContain('public.noResources');
  });

  it('reports a failure and retries', async () => {
    respond(http, CATEGORIES, []);
    fail(http, RESOURCES, 503, 'UNAVAILABLE', 'Service indisponible');
    await settle(fixture);
    expect(el().querySelector('[role="alert"]')?.textContent).toContain('Service indisponible');
    el().querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    await settle(fixture);
    respond(http, RESOURCES, pageOf([resourceCard({ title: 'De retour' })]));
    await settle(fixture);
    expect(el().textContent).toContain('De retour');
  });

  it('reloads everything in the new language', async () => {
    respond(http, CATEGORIES, []);
    respond(http, RESOURCES, pageOf([]));
    await settle(fixture);
    await TestBed.inject(LangService).set('fr');
    await settle(fixture);
    expect(pending(http, RESOURCES)[0].request.params.get('lang')).toBe('fr');
    expect(pending(http, CATEGORIES)[0].request.params.get('lang')).toBe('fr');
  });
});
