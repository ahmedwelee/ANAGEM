import { Type } from '@angular/core';
import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ToastService } from '../../core/ui/toast.service';
import { ADMIN, EDITOR, adminRow, fail, pageOf, pending, respond, settle, signIn, text } from '../../../testing/fixtures';
import { provideAppTesting } from '../../../testing/test-providers';
import { EventsListComponent } from './events/events-list';
import { NewsListComponent } from './news/news-list';
import { PublicationsListComponent } from './publications/publications-list';
import { ResourcesListComponent } from './resources/resources-list';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Screen {
  name: string;
  component: Type<unknown>;
  api: string;
  route: string;
  /** Filters the screen offers: [select aria-label key, option value, query parameter]. */
  filters: [string, string, string][];
  /** The empty-state translation key. */
  empty: string;
}

const SCREENS: Screen[] = [
  { name: 'news', component: NewsListComponent, api: '/api/admin/news', route: '/admin/news', filters: [['common.status', 'PUBLISHED', 'status']], empty: 'news.empty' },
  { name: 'events', component: EventsListComponent, api: '/api/admin/events', route: '/admin/events', filters: [['common.status', 'DRAFT', 'status'], ['common.type', 'WORKSHOP', 'type'], ['events.when', 'PAST', 'scope']], empty: 'events.empty' },
  { name: 'publications', component: PublicationsListComponent, api: '/api/admin/publications', route: '/admin/publications', filters: [['common.status', 'ARCHIVED', 'status'], ['common.kind', 'REPORT', 'kind']], empty: 'publications.empty' },
  { name: 'resources', component: ResourcesListComponent, api: '/api/admin/resources', route: '/admin/resources', filters: [['common.status', 'PENDING_REVIEW', 'status'], ['common.kind', 'MAP', 'kind']], empty: 'resources.empty' },
];

describe.each(SCREENS)('Admin $name list', (s) => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<unknown>;
  const el = () => fixture.nativeElement as HTMLElement;
  const rows = () => [...el().querySelectorAll('tbody tr')];

  async function open(permissions = ADMIN) {
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    signIn(permissions);
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(s.component);
    await fixture.whenStable();
  }
  /** Answers the first list request and the category request some screens make alongside it. */
  function loaded(items: unknown[], extra: Partial<{ page: number; totalElements: number; totalPages: number }> = {}) {
    const list = respond(http, s.api, pageOf(items, { size: 20, ...extra }));
    for (const r of http.match((q) => q.url === '/api/admin/categories')) r.flush([]);
    return list[0];
  }

  it('loads the first page and lists the rows with a link to edit each one', async () => {
    await open();
    const req = loaded([adminRow(1, 'Premier'), adminRow(2, 'Deuxième')]);
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('20');
    await settle(fixture);
    expect(rows()).toHaveLength(2);
    expect(text(rows()[0].querySelector('a'))).toBe('Premier');
    expect(rows()[0].querySelector('a')?.getAttribute('href')).toBe(`${s.route}/1`);
    expect(el().querySelector(`a[href="${s.route}/new"]`)).not.toBeNull();
  });

  it('shows a skeleton while loading', async () => {
    await open();
    await settle(fixture);
    expect(el().querySelector('.skeleton, app-skeleton-rows')).not.toBeNull();
    loaded([]);
  });

  it('invites to create the first item when there is none', async () => {
    await open();
    loaded([]);
    await settle(fixture);
    expect(el().textContent).toContain(s.empty);
    expect(el().querySelectorAll(`a[href="${s.route}/new"]`).length).toBeGreaterThanOrEqual(2); // header + empty state
  });

  it('explains a failure and lets the user retry', async () => {
    await open();
    fail(http, s.api, 500, 'INTERNAL_ERROR', 'Base de données indisponible');
    for (const r of http.match((q) => q.url === '/api/admin/categories')) r.flush([]);
    await settle(fixture);
    expect(el().querySelector('[role="alert"]')?.textContent).toContain('Base de données indisponible');
    el().querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    await settle(fixture);
    loaded([adminRow(1, 'Revenu')]);
    await settle(fixture);
    expect(text(rows()[0].querySelector('a'))).toBe('Revenu');
  });

  it.each(s.filters)('filters by %s and goes back to the first page', async (label, value, param) => {
    await open();
    loaded([adminRow(1, 'Un')], { page: 1, totalElements: 40, totalPages: 2 });
    await settle(fixture);
    const select = el().querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;
    select.value = value;
    select.dispatchEvent(new Event('change'));
    await settle(fixture);
    const req = loaded([]);
    expect(req.request.params.get(param)).toBe(value);
    expect(req.request.params.get('page')).toBe('0');
  });

  it('searches after the user stops typing', async () => {
    await open();
    loaded([adminRow(1, 'Un')]);
    await settle(fixture);
    const input = el().querySelector<HTMLInputElement>('input[type="search"]')!;
    input.value = 'colloque ';
    input.dispatchEvent(new Event('input'));
    expect(pending(http, s.api)).toHaveLength(0);
    await wait(380);
    expect(loaded([]).request.params.get('q')).toBe('colloque');
  });

  it('pages through the results', async () => {
    await open();
    loaded([adminRow(1, 'Un')], { totalElements: 45, totalPages: 3 });
    await settle(fixture);
    el().querySelector<HTMLButtonElement>('button[aria-label="common.next"]')!.click();
    await settle(fixture);
    const req = loaded([adminRow(21, 'Vingt et un')], { page: 1, totalElements: 45, totalPages: 3 });
    expect(req.request.params.get('page')).toBe('1');
  });

  it('asks for confirmation before deleting and does nothing when the user says no', async () => {
    await open();
    loaded([adminRow(1, 'À supprimer')]);
    await settle(fixture);
    el().querySelector<HTMLButtonElement>('button[aria-label="common.delete"]')!.click();
    const confirm = TestBed.inject(ConfirmService);
    expect(confirm.request()?.danger).toBe(true);
    expect(confirm.request()?.params).toEqual({ name: 'À supprimer' });
    confirm.answer(false);
    await settle(fixture);
    http.expectNone({ method: 'DELETE', url: `${s.api}/1` });
  });

  it('deletes after confirmation, tells the user and reloads the list', async () => {
    await open();
    loaded([adminRow(1, 'À supprimer')]);
    await settle(fixture);
    el().querySelector<HTMLButtonElement>('button[aria-label="common.delete"]')!.click();
    TestBed.inject(ConfirmService).answer(true);
    await settle(fixture);
    const del = http.expectOne({ method: 'DELETE', url: `${s.api}/1` });
    del.flush(null, { status: 204, statusText: 'No Content' });
    expect(TestBed.inject(ToastService).toasts().at(-1)).toMatchObject({ kind: 'success', message: 'common.deleted' });
    loaded([]);
    await settle(fixture);
    expect(rows()).toHaveLength(0);
  });

  it('reports a refused deletion and keeps the row', async () => {
    await open();
    loaded([adminRow(1, 'Protégé')]);
    await settle(fixture);
    el().querySelector<HTMLButtonElement>('button[aria-label="common.delete"]')!.click();
    TestBed.inject(ConfirmService).answer(true);
    await settle(fixture);
    http.expectOne({ method: 'DELETE', url: `${s.api}/1` }).flush({ status: 403, code: 'ACCESS_DENIED', message: 'no' }, { status: 403, statusText: 'Forbidden' });
    await settle(fixture);
    expect(TestBed.inject(ToastService).toasts().at(-1)?.kind).toBe('error');
    expect(rows()).toHaveLength(1);
  });

  it('hides the delete button from people who may not delete', async () => {
    await open(EDITOR);
    loaded([adminRow(1, 'Un')]);
    await settle(fixture);
    expect(el().querySelector('button[aria-label="common.delete"]')).toBeNull();
    expect(el().querySelector('a[aria-label="common.edit"]')).not.toBeNull();
  });

  it('shows the status and the languages of each row', async () => {
    await open();
    loaded([adminRow(1, 'Publié', { status: 'PUBLISHED', publishedAt: '2026-09-01T10:00:00Z' })]);
    await settle(fixture);
    expect(rows()[0].querySelector('app-status-badge')).not.toBeNull();
    expect(rows()[0].querySelector('app-translation-dots')).not.toBeNull();
  });
});
