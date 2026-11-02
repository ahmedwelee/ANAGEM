import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ADMIN, SUPER_ADMIN, fail, pageOf, respond, settle, signIn, text } from '../../../testing/fixtures';
import { provideAppTesting } from '../../../testing/test-providers';
import { AuditLog, ContactMessage } from '../../core/api/models';
import { AuthService } from '../../core/auth/auth.service';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ToastService } from '../../core/ui/toast.service';
import { AuditLogComponent } from './audit/audit-log';
import { MessagesComponent } from './messages/messages';
import { ProfileComponent } from './profile/profile';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('MessagesComponent', () => {
  const API = '/api/admin/contact-messages';
  let http: HttpTestingController;
  let fixture: ComponentFixture<MessagesComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const msg = (id: number, o: Partial<ContactMessage> = {}): ContactMessage => ({ id, name: `Visiteur ${id}`, email: `v${id}@example.org`, subject: 'Adhésion', message: 'Comment adhérer ?', locale: 'fr', status: 'NEW', createdAt: '2026-10-01T09:00:00Z', handledAt: null, ...o });
  const toast = () => TestBed.inject(ToastService).toasts().at(-1);

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    signIn(ADMIN);
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MessagesComponent);
    await fixture.whenStable();
  });

  it('lists messages with new ones in bold', async () => {
    respond(http, API, pageOf([msg(1), msg(2, { status: 'READ', subject: null })], { size: 20 }));
    await settle(fixture);
    const items = [...el().querySelectorAll('ul > li button')];
    expect(items).toHaveLength(2);
    expect(items[0].querySelector('.font-bold')).not.toBeNull();
    expect(items[1].querySelector('.font-bold')).toBeNull();
    expect(text(items[1])).toContain('messages.noSubject');
  });

  it('opens a message and marks a new one as read without bothering the user', async () => {
    respond(http, API, pageOf([msg(1)]));
    await settle(fixture);
    el().querySelector<HTMLButtonElement>('ul > li button')!.click();
    await settle(fixture);
    const req = http.expectOne({ method: 'PATCH', url: `${API}/1` });
    expect(req.request.body).toEqual({ status: 'READ' });
    req.flush(msg(1, { status: 'READ' }));
    await settle(fixture);
    expect(toast()).toBeUndefined(); // silent
    expect(el().querySelector('app-modal')?.textContent).toContain('Comment adhérer ?');
    expect(el().querySelector('app-modal a[href^="mailto:v1@example.org"]')).not.toBeNull();
    expect(el().querySelector('ul > li .font-bold')).toBeNull();
  });

  it('does not touch a message that was already read', async () => {
    respond(http, API, pageOf([msg(2, { status: 'READ' })]));
    await settle(fixture);
    el().querySelector<HTMLButtonElement>('ul > li button')!.click();
    await settle(fixture);
    http.expectNone({ method: 'PATCH', url: `${API}/2` });
  });

  it('archives a message and says so', async () => {
    respond(http, API, pageOf([msg(2, { status: 'READ' })]));
    await settle(fixture);
    el().querySelector<HTMLButtonElement>('ul > li button')!.click();
    await settle(fixture);
    [...el().querySelectorAll<HTMLButtonElement>('app-modal button')].find((b) => text(b).includes('messages.archive'))!.click();
    await settle(fixture);
    const req = http.expectOne({ method: 'PATCH', url: `${API}/2` });
    expect(req.request.body).toEqual({ status: 'ARCHIVED' });
    req.flush(msg(2, { status: 'ARCHIVED' }));
    await settle(fixture);
    expect(toast()).toMatchObject({ kind: 'success', message: 'common.saved' });
    expect([...el().querySelectorAll('app-modal button')].some((b) => text(b).includes('messages.archive'))).toBe(false); // already archived
  });

  it('deletes after confirmation and closes the message', async () => {
    respond(http, API, pageOf([msg(2, { status: 'READ', name: 'Amina' })]));
    await settle(fixture);
    el().querySelector<HTMLButtonElement>('ul > li button')!.click();
    await settle(fixture);
    [...el().querySelectorAll<HTMLButtonElement>('app-modal button')].find((b) => text(b).includes('common.delete'))!.click();
    expect(TestBed.inject(ConfirmService).request()?.params).toEqual({ name: 'Amina' });
    TestBed.inject(ConfirmService).answer(true);
    await settle(fixture);
    http.expectOne({ method: 'DELETE', url: `${API}/2` }).flush(null, { status: 204, statusText: 'No Content' });
    await settle(fixture);
    expect(toast()).toMatchObject({ kind: 'success', message: 'common.deleted' });
    respond(http, API, pageOf([]));
    await settle(fixture);
    expect(el().textContent).toContain('messages.empty');
  });

  it('filters by status', async () => {
    respond(http, API, pageOf([msg(1)]));
    await settle(fixture);
    const select = el().querySelector<HTMLSelectElement>('select')!;
    select.value = 'ARCHIVED';
    select.dispatchEvent(new Event('change'));
    await settle(fixture);
    const [req] = respond(http, API, pageOf([]));
    expect(req.request.params.get('status')).toBe('ARCHIVED');
    expect(req.request.params.get('page')).toBe('0');
  });

  it('shows a loading error and retries', async () => {
    fail(http, API, 500, 'INTERNAL_ERROR', 'Hors service');
    await settle(fixture);
    expect(el().querySelector('[role="alert"]')?.textContent).toContain('Hors service');
    el().querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    await settle(fixture);
    respond(http, API, pageOf([msg(1)]));
    await settle(fixture);
    expect(el().querySelectorAll('ul > li')).toHaveLength(1);
  });
});

describe('AuditLogComponent', () => {
  const API = '/api/admin/audit-logs';
  let http: HttpTestingController;
  let fixture: ComponentFixture<AuditLogComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const log = (id: number, o: Partial<AuditLog> = {}): AuditLog => ({ id, occurredAt: '2026-10-01T09:00:00Z', actorId: 1, actorEmail: 'admin@anagem.test', action: 'CREATE', resourceType: 'NEWS', resourceId: '7', summary: 'Created news', ipAddress: '10.0.0.1', ...o });

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    signIn(SUPER_ADMIN);
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AuditLogComponent);
    await fixture.whenStable();
  });

  it('shows who did what, 30 entries at a time, with failures and deletions flagged', async () => {
    const [req] = respond(http, API, pageOf([log(1), log(2, { action: 'LOGIN_FAILED', actorEmail: null, resourceType: null, resourceId: null }), log(3, { action: 'DELETE' })], { size: 30 }));
    expect(req.request.params.get('size')).toBe('30');
    await settle(fixture);
    const rows = [...el().querySelectorAll('tbody tr')];
    expect(rows).toHaveLength(3);
    expect(text(rows[0])).toContain('admin@anagem.test');
    expect(text(rows[0])).toContain('NEWS #7');
    expect(rows[0].querySelector('.badge-published')).not.toBeNull();
    expect(rows[1].querySelector('.badge-danger')).not.toBeNull();
    expect(text(rows[1])).toContain('—');
    expect(rows[2].querySelector('.badge-danger')).not.toBeNull();
  });

  it('filters by action, resource, person and dates (whole days)', async () => {
    respond(http, API, pageOf([log(1)]));
    await settle(fixture);
    const [action, resource] = [...el().querySelectorAll<HTMLSelectElement>('select')];
    action.value = 'LOGIN_FAILED';
    action.dispatchEvent(new Event('change'));
    await settle(fixture);
    expect(respond(http, API, pageOf([]))[0].request.params.get('action')).toBe('LOGIN_FAILED');
    await settle(fixture);
    resource.value = resource.options[1].value;
    resource.dispatchEvent(new Event('change'));
    await settle(fixture);
    expect(respond(http, API, pageOf([]))[0].request.params.get('resourceType')).toBe(resource.options[1].value);
    await settle(fixture);

    const [from, to] = [...el().querySelectorAll<HTMLInputElement>('input[type="date"]')];
    from.value = '2026-10-01';
    from.dispatchEvent(new Event('input'));
    await settle(fixture);
    to.value = '2026-10-02';
    to.dispatchEvent(new Event('input'));
    await settle(fixture);
    const reqs = http.match((r) => r.url === API);
    const last = reqs.at(-1)!;
    const f = new Date(last.request.params.get('from')!), t = new Date(last.request.params.get('to')!);
    expect(t.getTime() - f.getTime()).toBe(2 * 86_400_000); // 1 Oct and 2 Oct inclusive
    reqs.forEach((r) => r.flush(pageOf([])));

    const person = el().querySelector<HTMLInputElement>('input[type="search"]')!;
    person.value = ' amina ';
    person.dispatchEvent(new Event('input'));
    await wait(380);
    expect(respond(http, API, pageOf([]))[0].request.params.get('actor')).toBe('amina');
  });

  it('shows an empty state and a retryable error', async () => {
    respond(http, API, pageOf([]));
    await settle(fixture);
    expect(el().textContent).toContain('audit.empty');
    const select = el().querySelector<HTMLSelectElement>('select')!;
    select.value = 'DELETE';
    select.dispatchEvent(new Event('change'));
    await settle(fixture);
    fail(http, API, 403, 'ACCESS_DENIED', 'Interdit');
    await settle(fixture);
    expect(el().querySelector('[role="alert"]')?.textContent).toContain('Interdit');
  });
});

describe('ProfileComponent', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<ProfileComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const type = (id: string, v: string) => { const i = el().querySelector<HTMLInputElement>('#' + id)!; i.value = v; i.dispatchEvent(new Event('input')); };
  const submit = async () => { el().querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit')); await settle(fixture); };

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    signIn(ADMIN, { fullName: 'Amina Alaoui', email: 'amina@anagem.test', role: 'ADMIN' });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ProfileComponent);
    await settle(fixture);
  });

  it('shows who is signed in and what they may do', () => {
    expect(el().textContent).toContain('Amina Alaoui');
    expect(el().textContent).toContain('amina@anagem.test');
    expect(el().textContent).toContain('roles.ADMIN');
    expect(el().textContent).toContain('CONTENT_PUBLISH');
  });

  it('refuses a short new password, a mismatch and empty fields, without calling the server', async () => {
    await submit();
    http.expectNone('/api/auth/change-password');
    type('cp', 'old-password-123');
    type('np', 'short');
    type('cf', 'short');
    await submit();
    http.expectNone('/api/auth/change-password');
    type('np', 'A-long-enough-password-1');
    type('cf', 'A-different-password-1');
    await submit();
    http.expectNone('/api/auth/change-password');
    expect(el().textContent).toContain('profile.mismatch');
  });

  it('shows or hides the typed passwords', async () => {
    expect(el().querySelector('#np')?.getAttribute('type')).toBe('password');
    el().querySelector<HTMLInputElement>('input.check')!.click();
    await settle(fixture);
    expect(el().querySelector('#np')?.getAttribute('type')).toBe('text');
  });

  it('shows the server reason when the current password is wrong and keeps the session', async () => {
    type('cp', 'wrong-password-123');
    type('np', 'A-long-enough-password-1');
    type('cf', 'A-long-enough-password-1');
    await submit();
    const req = http.expectOne({ method: 'POST', url: '/api/auth/change-password' });
    expect(req.request.body).toEqual({ currentPassword: 'wrong-password-123', newPassword: 'A-long-enough-password-1' });
    req.flush({ status: 400, code: 'WRONG_PASSWORD', message: 'Current password is incorrect' }, { status: 400, statusText: 'Bad Request' });
    await settle(fixture);
    expect(el().querySelector('app-api-error-banner [role="alert"]')).not.toBeNull();
    expect(TestBed.inject(AuthService).isAuthenticated()).toBe(true);
  });

  it('signs the user out after a successful change, because the server revoked the old token', async () => {
    type('cp', 'old-password-123');
    type('np', 'A-long-enough-password-1');
    type('cf', 'A-long-enough-password-1');
    await submit();
    http.expectOne({ method: 'POST', url: '/api/auth/change-password' }).flush(null, { status: 204, statusText: 'No Content' });
    await settle(fixture);
    expect(TestBed.inject(ToastService).toasts().at(-1)?.message).toBe('profile.changed');
    expect(TestBed.inject(AuthService).isAuthenticated()).toBe(false);
  });
});

