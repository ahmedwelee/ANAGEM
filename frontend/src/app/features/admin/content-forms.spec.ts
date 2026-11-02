import { Type } from '@angular/core';
import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ADMIN, respond, routeWith, settle, signIn, text } from '../../../testing/fixtures';
import { provideAppTesting } from '../../../testing/test-providers';
import { EventAdmin, PublicationAdmin, ResourceAdmin } from '../../core/api/models';
import { ToastService } from '../../core/ui/toast.service';
import { EventFormComponent } from './events/event-form';
import { PublicationFormComponent } from './publications/publication-form';
import { ResourceFormComponent } from './resources/resource-form';

const TS = [{ locale: 'fr', present: true, complete: true, missingFields: [] }] as never;
const base = { status: 'DRAFT' as const, publishedAt: null, translationStatus: TS, authorName: 'Amina', version: 0, createdAt: '2026-09-01T09:00:00Z', updatedAt: '2026-09-02T09:00:00Z' };

class Harness<T> {
  http!: HttpTestingController;
  fixture!: ComponentFixture<T>;
  router!: Router;
  constructor(private readonly component: Type<T>, private readonly api: string, private readonly categoryType: string) {}
  get el() { return this.fixture.nativeElement as HTMLElement; }
  input<E extends HTMLElement = HTMLInputElement>(selector: string) { return this.el.querySelector<E>(selector)!; }
  type(selector: string, value: string, event = 'input') { const i = this.input<HTMLInputElement>(selector); i.value = value; i.dispatchEvent(new Event(event)); }
  choose(selector: string, value: string) { this.type(selector, value, 'change'); }
  async save() { [...this.el.querySelectorAll<HTMLButtonElement>('app-page-header button')].find((b) => text(b).includes('common.save'))!.click(); await settle(this.fixture); }
  async open(id?: string, entity?: unknown) {
    TestBed.configureTestingModule({ providers: [...provideAppTesting(), routeWith({ params: id ? { id } : {} })] });
    signIn(ADMIN);
    this.http = TestBed.inject(HttpTestingController);
    this.router = TestBed.inject(Router);
    vi.spyOn(this.router, 'navigate').mockResolvedValue(true);
    this.fixture = TestBed.createComponent(this.component);
    await this.fixture.whenStable();
    if (id) respond(this.http, `${this.api}/${id}`, entity);
    respond(this.http, '/api/admin/categories', []);
    await settle(this.fixture);
  }
  get toast() { return TestBed.inject(ToastService).toasts().at(-1); }
}

describe('EventFormComponent', () => {
  const h = new Harness(EventFormComponent, '/api/admin/events', 'EVENT');
  const API = '/api/admin/events';
  const event = (o: Partial<EventAdmin> = {}): EventAdmin => ({
    ...base, id: 4, slug: 'colloque', type: 'CONFERENCE', startsAt: '2026-10-13T08:00:00Z', endsAt: '2026-10-15T16:00:00Z', allDay: false, registrationUrl: 'https://example.org/register',
    featured: true, categoryId: null, image: null, programFile: null, translations: { fr: { title: 'Colloque', location: 'Kénitra', organizer: 'ANAGEM' } }, timeStatus: 'UPCOMING', ...o,
  });

  it('refuses an event without a start date', async () => {
    await h.open();
    h.type('#title-fr', 'Journée');
    await h.save();
    h.http.expectNone(API);
    expect(h.toast).toMatchObject({ kind: 'error', message: 'form.invalid' });
  });

  it('refuses an event that ends before it starts', async () => {
    await h.open();
    h.type('#title-fr', 'Journée');
    h.type('#starts', '2026-10-14T09:00');
    h.type('#ends', '2026-10-13T09:00');
    await h.save();
    h.http.expectNone(API);
  });

  it.each(['ftp://example.org', 'javascript:alert(1)', 'example.org/register'])('refuses the registration address %s', async (url) => {
    await h.open();
    h.type('#title-fr', 'Journée');
    h.type('#starts', '2026-10-14T09:00');
    h.type('#reg', url);
    await h.save();
    h.http.expectNone(API);
  });

  it('sends Moroccan local times as UTC instants, with empty optional fields as null', async () => {
    await h.open();
    h.type('#title-ar', 'يوم دراسي');
    h.choose('#type', 'WORKSHOP');
    h.type('#starts', '2026-10-13T09:00');
    h.type('#ends', '2026-10-13T17:30');
    await h.save();
    const req = h.http.expectOne({ method: 'POST', url: API });
    expect(req.request.body).toMatchObject({ type: 'WORKSHOP', allDay: false, startsAt: '2026-10-13T08:00:00.000Z', endsAt: '2026-10-13T16:30:00.000Z', registrationUrl: null, slug: null, categoryId: null, imageId: null, programFileId: null });
    expect(Object.keys(req.request.body.translations)).toEqual(['ar']);
    req.flush(event({ id: 11 }), { status: 201, statusText: 'Created' });
    await settle(h.fixture);
    expect(h.router.navigate).toHaveBeenCalledWith(['/admin/events', 11], { replaceUrl: true });
  });

  it('shows stored instants as Moroccan local time when editing', async () => {
    await h.open('4', event());
    expect(h.input('#starts').value).toBe('2026-10-13T09:00');
    expect(h.input('#ends').value).toBe('2026-10-15T17:00');
    expect(h.input('#reg').value).toBe('https://example.org/register');
    expect(h.input('#title-fr').value).toBe('Colloque');
    expect(h.input('#loc-fr').value).toBe('Kénitra');
    expect(h.input('#org-fr').value).toBe('ANAGEM');
  });

  it('switches between date-only and date-and-time entry for all-day events without losing the day', async () => {
    await h.open();
    h.type('#starts', '2026-10-13T09:00');
    expect(h.input('#starts').getAttribute('type')).toBe('datetime-local');
    const allDay = h.input('input[formControlName="allDay"]');
    allDay.click();
    await settle(h.fixture);
    expect(h.input('#starts').getAttribute('type')).toBe('date');
    expect(h.input('#starts').value).toBe('2026-10-13');
    allDay.click();
    await settle(h.fixture);
    expect(h.input('#starts').getAttribute('type')).toBe('datetime-local');
    expect(h.input('#starts').value).toBe('2026-10-13T09:00');
  });

  it('updates an existing event with PUT', async () => {
    await h.open('4', event());
    h.type('#title-fr', 'Colloque national');
    await h.save();
    const req = h.http.expectOne({ method: 'PUT', url: `${API}/4` });
    expect(req.request.body.translations.fr).toMatchObject({ title: 'Colloque national', location: 'Kénitra', organizer: 'ANAGEM' });
    expect(req.request.body.startsAt).toBe('2026-10-13T08:00:00.000Z');
    expect(req.request.body.featured).toBe(true);
    req.flush(event());
  });
});

describe('PublicationFormComponent', () => {
  const h = new Harness(PublicationFormComponent, '/api/admin/publications', 'PUBLICATION');
  const API = '/api/admin/publications';
  const publication = (o: Partial<PublicationAdmin> = {}): PublicationAdmin => ({
    ...base, id: 8, kind: 'MAGAZINE_ISSUE', year: 2026, issueNumber: '12', featured: false, categoryId: null, coverImage: null, pdfFile: null,
    translations: { fr: { title: 'Géographie du Maroc n°12', description: '<p>Dossier</p>' } }, ...o,
  });

  it('starts on the current year and the journal kind', async () => {
    await h.open();
    expect(h.input('#year').value).toBe(String(new Date().getFullYear()));
    expect(h.input<HTMLSelectElement>('#kind').value).toBe('MAGAZINE_ISSUE');
    expect(h.el.querySelectorAll('app-media-field')).toHaveLength(2); // cover and PDF
  });

  it.each(['1800', '2101', ''])('refuses the year "%s"', async (year) => {
    await h.open();
    h.type('#title-fr', 'Livre');
    h.type('#year', year);
    await h.save();
    h.http.expectNone(API);
  });

  it('sends the publication with an empty issue number as null', async () => {
    await h.open();
    h.type('#title-fr', 'Atlas du Maroc');
    h.choose('#kind', 'BOOK');
    h.type('#year', '2027');
    await h.save();
    const req = h.http.expectOne({ method: 'POST', url: API });
    expect(req.request.body).toMatchObject({ kind: 'BOOK', year: 2027, issueNumber: null, coverImageId: null, pdfFileId: null, featured: false });
    expect(req.request.body.translations.fr.title).toBe('Atlas du Maroc');
    req.flush(publication({ id: 20 }), { status: 201, statusText: 'Created' });
    await settle(h.fixture);
    expect(h.router.navigate).toHaveBeenCalledWith(['/admin/publications', 20], { replaceUrl: true });
  });

  it('loads and updates an existing publication', async () => {
    await h.open('8', publication());
    expect(h.input('#issue').value).toBe('12');
    expect(h.input('#title-fr').value).toBe('Géographie du Maroc n°12');
    h.type('#issue', ' 13 ');
    await h.save();
    const req = h.http.expectOne({ method: 'PUT', url: `${API}/8` });
    expect(req.request.body.issueNumber).toBe('13');
    expect(req.request.body.year).toBe(2026);
    req.flush(publication({ issueNumber: '13' }));
  });

  it('shows the server message when the files do not fit', async () => {
    await h.open();
    h.type('#title-fr', 'Atlas');
    await h.save();
    h.http.expectOne({ method: 'POST', url: API }).flush({ status: 400, code: 'UNKNOWN_MEDIA', message: 'File not found' }, { status: 400, statusText: 'Bad Request' });
    await settle(h.fixture);
    expect(h.el.querySelector('app-api-error-banner [role="alert"]')).not.toBeNull();
    expect(h.router.navigate).not.toHaveBeenCalled();
  });
});

describe('ResourceFormComponent', () => {
  const h = new Harness(ResourceFormComponent, '/api/admin/resources', 'RESOURCE');
  const API = '/api/admin/resources';
  const resource = (o: Partial<ResourceAdmin> = {}): ResourceAdmin => ({
    ...base, id: 3, kind: 'MAP', externalUrl: 'https://example.org/carte.pdf', categoryId: null, file: null, translations: { fr: { title: 'Carte du Maroc' } }, ...o,
  });

  it.each(['ftp://example.org/a', 'example.org', 'javascript:alert(1)'])('refuses the link %s', async (url) => {
    await h.open();
    h.type('#title-fr', 'Carte');
    h.type('#url', url);
    await h.save();
    h.http.expectNone(API);
  });

  it('creates a resource from a link, leaving the file and category empty', async () => {
    await h.open();
    h.type('#title-fr', 'Carte du littoral');
    h.choose('#kind', 'MAP');
    h.type('#url', ' https://example.org/littoral.pdf ');
    await h.save();
    const req = h.http.expectOne({ method: 'POST', url: API });
    expect(req.request.body).toMatchObject({ kind: 'MAP', externalUrl: 'https://example.org/littoral.pdf', fileId: null, categoryId: null });
    req.flush(resource({ id: 30 }), { status: 201, statusText: 'Created' });
    await settle(h.fixture);
    expect(h.router.navigate).toHaveBeenCalledWith(['/admin/resources', 30], { replaceUrl: true });
  });

  it('sends a blank link as null', async () => {
    await h.open();
    h.type('#title-fr', 'Sans lien');
    await h.save();
    expect(h.http.expectOne({ method: 'POST', url: API }).request.body.externalUrl).toBeNull();
  });

  it('loads and updates an existing resource', async () => {
    await h.open('3', resource());
    expect(h.input<HTMLSelectElement>('#kind').value).toBe('MAP');
    expect(h.input('#url').value).toBe('https://example.org/carte.pdf');
    h.type('#title-ar', 'خريطة المغرب');
    await h.save();
    const req = h.http.expectOne({ method: 'PUT', url: `${API}/3` });
    expect(Object.keys(req.request.body.translations).sort()).toEqual(['ar', 'fr']);
    req.flush(resource());
  });
});
