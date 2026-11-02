import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ADMIN, EDITOR, fail, respond, settle, signIn, text } from '../../../testing/fixtures';
import { provideAppTesting } from '../../../testing/test-providers';
import { CategoryAdmin, PartnerAdmin } from '../../core/api/models';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ToastService } from '../../core/ui/toast.service';
import { CategoriesComponent } from './categories/categories';
import { PartnersComponent } from './partners/partners';

const category = (id: number, type: CategoryAdmin['type'], slug: string, name: string, o: Partial<CategoryAdmin> = {}): CategoryAdmin =>
  ({ id, type, slug, sortOrder: id * 10, active: true, translations: { ar: { name }, fr: { name: name + ' (fr)' } }, usageCount: 0, ...o });

describe('CategoriesComponent', () => {
  const API = '/api/admin/categories';
  let http: HttpTestingController;
  let fixture: ComponentFixture<CategoriesComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const rows = () => [...el().querySelectorAll('tbody tr')].map((r) => text(r));
  const toast = () => TestBed.inject(ToastService).toasts().at(-1);

  async function open(permissions = ADMIN) {
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    signIn(permissions);
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CategoriesComponent);
    await fixture.whenStable();
  }
  const all = () => [category(1, 'NEWS', 'colloques', 'ندوات', { usageCount: 3 }), category(2, 'NEWS', 'archives', 'أرشيف', { active: false }), category(3, 'EVENT', 'terrain', 'ميداني')];
  const tab = (ty: string) => [...el().querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((b) => text(b).includes(`categories.type.${ty}`))!;
  const type = (id: string, v: string) => { const i = el().querySelector<HTMLInputElement>('#' + id)!; i.value = v; i.dispatchEvent(new Event('input')); };

  it('lists the categories of the selected type, starting with news, with their usage and state', async () => {
    await open();
    respond(http, API, all());
    await settle(fixture);
    const list = rows();
    expect(list).toHaveLength(2);
    expect(list[0]).toContain('ندوات');
    expect(list[0]).toContain('colloques');
    expect(list[0]).toContain('3');
    expect(list[0]).toContain('common.active');
    expect(list[1]).toContain('common.inactive');
  });

  it('switches type without asking the server again', async () => {
    await open();
    respond(http, API, all());
    await settle(fixture);
    tab('EVENT').click();
    await settle(fixture);
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toContain('terrain');
    http.expectNone(API);
    tab('RESOURCE').click();
    await settle(fixture);
    expect(el().textContent).toContain('categories.empty');
  });

  it('creates a category of the selected type with the names that were typed', async () => {
    await open();
    respond(http, API, all());
    await settle(fixture);
    tab('EVENT').click();
    await settle(fixture);
    [...el().querySelectorAll<HTMLButtonElement>('app-page-header button')][0].click();
    await settle(fixture);
    type('cn-fr', '  Journées d\'étude ');
    type('cs', 'journees');
    el().querySelector<HTMLFormElement>('#cat-form')!.dispatchEvent(new Event('submit'));
    await settle(fixture);
    const req = http.expectOne({ method: 'POST', url: API });
    expect(req.request.body).toMatchObject({ type: 'EVENT', slug: 'journees', active: true });
    expect(req.request.body.translations.fr.name).toBe('Journées d\'étude');
    expect(req.request.body.translations.ar).toBeUndefined();
    req.flush(category(9, 'EVENT', 'journees', 'x'), { status: 201, statusText: 'Created' });
    await settle(fixture);
    expect(toast()).toMatchObject({ kind: 'success', message: 'common.saved' });
    respond(http, API, all()); // the list is reloaded
  });

  it('refuses a category without a name or with a bad address, and sends nothing', async () => {
    await open();
    respond(http, API, all());
    await settle(fixture);
    [...el().querySelectorAll<HTMLButtonElement>('app-page-header button')][0].click();
    await settle(fixture);
    el().querySelector<HTMLFormElement>('#cat-form')!.dispatchEvent(new Event('submit'));
    await settle(fixture);
    http.expectNone({ method: 'POST', url: API });
    type('cn-fr', 'Nom');
    type('cs', 'Mauvaise Adresse!');
    el().querySelector<HTMLFormElement>('#cat-form')!.dispatchEvent(new Event('submit'));
    await settle(fixture);
    http.expectNone({ method: 'POST', url: API });
  });

  it('shows the server message when the address is already taken and keeps the dialog open', async () => {
    await open();
    respond(http, API, all());
    await settle(fixture);
    [...el().querySelectorAll<HTMLButtonElement>('app-page-header button')][0].click();
    await settle(fixture);
    type('cn-fr', 'Doublon');
    el().querySelector<HTMLFormElement>('#cat-form')!.dispatchEvent(new Event('submit'));
    await settle(fixture);
    http.expectOne({ method: 'POST', url: API }).flush({ status: 409, code: 'SLUG_TAKEN', message: 'Another category already uses this slug' }, { status: 409, statusText: 'Conflict' });
    await settle(fixture);
    expect(el().querySelector('app-modal [role="alert"]')).not.toBeNull();
    expect(el().querySelector('#cat-form')).not.toBeNull();
  });

  it('edits a category with PUT, filling the form with what is stored', async () => {
    await open();
    respond(http, API, all());
    await settle(fixture);
    el().querySelector<HTMLButtonElement>('tbody tr button[aria-label="common.edit"]')!.click();
    await settle(fixture);
    expect(el().querySelector<HTMLInputElement>('#cs')!.value).toBe('colloques');
    expect(el().querySelector<HTMLInputElement>('#cn-ar')!.value).toBe('ندوات');
    type('cn-ar', 'ندوات علمية');
    el().querySelector<HTMLFormElement>('#cat-form')!.dispatchEvent(new Event('submit'));
    await settle(fixture);
    const req = http.expectOne({ method: 'PUT', url: `${API}/1` });
    expect(req.request.body.type).toBe('NEWS');
    expect(req.request.body.translations.ar.name).toBe('ندوات علمية');
    req.flush(all()[0]);
  });

  it('switches a category on and off from the list', async () => {
    await open();
    respond(http, API, all());
    await settle(fixture);
    el().querySelectorAll<HTMLButtonElement>('tbody tr')[1].querySelector<HTMLButtonElement>('button[aria-label="categories.activate"]')!.click();
    await settle(fixture);
    const req = http.expectOne({ method: 'PUT', url: `${API}/2` });
    expect(req.request.body.active).toBe(true);
    req.flush(all()[1]);
    await settle(fixture);
    respond(http, API, all());
  });

  it('deletes after confirmation and explains when the category is still in use', async () => {
    await open();
    respond(http, API, all());
    await settle(fixture);
    el().querySelector<HTMLButtonElement>('tbody tr button[aria-label="common.delete"]')!.click();
    TestBed.inject(ConfirmService).answer(true);
    await settle(fixture);
    http.expectOne({ method: 'DELETE', url: `${API}/1` }).flush({ status: 409, code: 'CATEGORY_IN_USE', message: 'used by 3 item(s)' }, { status: 409, statusText: 'Conflict' });
    await settle(fixture);
    expect(toast()?.kind).toBe('error');
    expect(rows()).toHaveLength(2);

    el().querySelectorAll<HTMLButtonElement>('tbody tr')[1].querySelector<HTMLButtonElement>('button[aria-label="common.delete"]')!.click();
    TestBed.inject(ConfirmService).answer(true);
    await settle(fixture);
    http.expectOne({ method: 'DELETE', url: `${API}/2` }).flush(null, { status: 204, statusText: 'No Content' });
    await settle(fixture);
    expect(toast()).toMatchObject({ kind: 'success', message: 'common.deleted' });
    respond(http, API, [all()[0], all()[2]]);
  });

  it('is read-only for people who may not manage categories', async () => {
    await open(EDITOR);
    respond(http, API, all());
    await settle(fixture);
    expect(el().querySelector('app-page-header button')).toBeNull();
    expect(el().querySelector('tbody button')).toBeNull();
  });

  it('shows a loading error and retries', async () => {
    await open();
    fail(http, API, 500, 'INTERNAL_ERROR', 'Hors service');
    await settle(fixture);
    expect(el().querySelector('[role="alert"]')?.textContent).toContain('Hors service');
    el().querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    await settle(fixture);
    respond(http, API, all());
    await settle(fixture);
    expect(rows()).toHaveLength(2);
  });
});

const partner = (id: number, name: string, o: Partial<PartnerAdmin> = {}): PartnerAdmin => ({ id, name, websiteUrl: null, logo: null, sortOrder: id * 10, active: true, translations: {}, ...o });

describe('PartnersComponent', () => {
  const API = '/api/admin/partners';
  let http: HttpTestingController;
  let fixture: ComponentFixture<PartnersComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const type = (id: string, v: string) => { const i = el().querySelector<HTMLInputElement>('#' + id)!; i.value = v; i.dispatchEvent(new Event('input')); };
  const submit = async () => { el().querySelector<HTMLFormElement>('#partner-form')!.dispatchEvent(new Event('submit')); await settle(fixture); };

  async function open(permissions = ADMIN) {
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    signIn(permissions);
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PartnersComponent);
    await fixture.whenStable();
  }

  it('lists the partners in their display order', async () => {
    await open();
    respond(http, API, [partner(1, 'Université Ibn Tofail', { websiteUrl: 'https://uit.ac.ma' }), partner(2, 'Ministère', { active: false })]);
    await settle(fixture);
    const rows = [...el().querySelectorAll('tbody tr')].map((r) => text(r));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('Université Ibn Tofail');
    expect(rows[1]).toContain('Ministère');
  });

  it('adds a partner with its translated names, the next display position and an optional link', async () => {
    await open();
    respond(http, API, [partner(1, 'Premier')]);
    await settle(fixture);
    el().querySelector<HTMLButtonElement>('app-page-header button')!.click();
    await settle(fixture);
    expect(el().querySelector<HTMLInputElement>('#po')!.value).toBe('20');
    type('pn', '  Faculté des Lettres ');
    type('pw', 'https://flsh.example.ma');
    await submit();
    const req = http.expectOne({ method: 'POST', url: API });
    expect(req.request.body).toMatchObject({ name: 'Faculté des Lettres', websiteUrl: 'https://flsh.example.ma', logoId: null, sortOrder: 20, active: true, translations: {} });
    req.flush(partner(2, 'Faculté des Lettres'), { status: 201, statusText: 'Created' });
    await settle(fixture);
    expect(TestBed.inject(ToastService).toasts().at(-1)?.message).toBe('common.saved');
    respond(http, API, [partner(1, 'Premier'), partner(2, 'Faculté des Lettres')]);
  });

  it('requires a name and a valid link', async () => {
    await open();
    respond(http, API, []);
    await settle(fixture);
    el().querySelector<HTMLButtonElement>('app-page-header button')!.click();
    await settle(fixture);
    await submit();
    http.expectNone({ method: 'POST', url: API });
    type('pn', 'Partenaire');
    type('pw', 'ftp://x.example');
    await submit();
    http.expectNone({ method: 'POST', url: API });
    type('pw', '');
    await submit();
    expect(http.expectOne({ method: 'POST', url: API }).request.body.websiteUrl).toBeNull();
  });

  it('edits a partner, keeping what is stored and sending the translated names', async () => {
    await open();
    respond(http, API, [partner(1, 'Premier', { websiteUrl: 'https://a.example', translations: { ar: { name: 'الأول' } } })]);
    await settle(fixture);
    el().querySelector<HTMLButtonElement>('tbody button[aria-label="common.edit"]')!.click();
    await settle(fixture);
    expect(el().querySelector<HTMLInputElement>('#pn')!.value).toBe('Premier');
    expect(el().querySelector<HTMLInputElement>('#pw')!.value).toBe('https://a.example');
    await submit();
    const req = http.expectOne({ method: 'PUT', url: `${API}/1` });
    expect(req.request.body.translations).toEqual({ ar: { name: 'الأول' } });
    req.flush(partner(1, 'Premier'));
  });

  it('deletes only after confirmation', async () => {
    await open();
    respond(http, API, [partner(1, 'À retirer')]);
    await settle(fixture);
    el().querySelector<HTMLButtonElement>('tbody button[aria-label="common.delete"]')!.click();
    expect(TestBed.inject(ConfirmService).request()?.params).toEqual({ name: 'À retirer' });
    TestBed.inject(ConfirmService).answer(false);
    await settle(fixture);
    http.expectNone({ method: 'DELETE', url: `${API}/1` });
    el().querySelector<HTMLButtonElement>('tbody button[aria-label="common.delete"]')!.click();
    TestBed.inject(ConfirmService).answer(true);
    await settle(fixture);
    http.expectOne({ method: 'DELETE', url: `${API}/1` }).flush(null, { status: 204, statusText: 'No Content' });
    await settle(fixture);
    respond(http, API, []);
    await settle(fixture);
    expect(el().querySelector('tbody')).toBeNull();
  });

  it('shows the server message when saving fails', async () => {
    await open();
    respond(http, API, []);
    await settle(fixture);
    el().querySelector<HTMLButtonElement>('app-page-header button')!.click();
    await settle(fixture);
    type('pn', 'Partenaire');
    await submit();
    http.expectOne({ method: 'POST', url: API }).flush({ status: 400, code: 'UNKNOWN_MEDIA', message: 'Logo not found' }, { status: 400, statusText: 'Bad Request' });
    await settle(fixture);
    expect(el().querySelector('app-modal [role="alert"]')).not.toBeNull();
  });

  it('is read-only without the partner permission', async () => {
    await open(EDITOR);
    respond(http, API, [partner(1, 'Premier')]);
    await settle(fixture);
    expect(el().querySelector('app-page-header button')).toBeNull();
    expect(el().querySelector('tbody button')).toBeNull();
  });
});
