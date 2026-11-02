import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ADMIN, SUPER_ADMIN, fail, respond, settle, signIn, text } from '../../../../testing/fixtures';
import { provideAppTesting } from '../../../../testing/test-providers';
import { PermissionDto, RoleDto, UserDto } from '../../../core/api/models';
import { ConfirmService } from '../../../core/ui/confirm.service';
import { ToastService } from '../../../core/ui/toast.service';
import { UsersComponent } from './users';

const user = (id: number, o: Partial<UserDto> = {}): UserDto => ({ id, email: `user${id}@anagem.test`, fullName: `Utilisateur ${id}`, role: 'EDITOR', permissions: [], enabled: true, preferredLocale: 'ar', lastLoginAt: null, createdAt: '2026-01-01T00:00:00Z', ...o });
const ROLES: RoleDto[] = [
  { id: 1, name: 'SUPER_ADMIN', description: 'All', systemRole: true, permissions: ['CONTENT_WRITE', 'CONTENT_PUBLISH', 'USER_MANAGE'] },
  { id: 2, name: 'ADMIN', description: 'Admin', systemRole: true, permissions: ['CONTENT_WRITE', 'CONTENT_PUBLISH'] },
  { id: 3, name: 'EDITOR', description: 'Editor', systemRole: true, permissions: ['CONTENT_WRITE'] },
];
const PERMISSIONS: PermissionDto[] = [{ code: 'CONTENT_PUBLISH', description: 'Publish' }, { code: 'CONTENT_WRITE', description: 'Write' }, { code: 'USER_MANAGE', description: 'Users' }];

describe('UsersComponent', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<UsersComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const toast = () => TestBed.inject(ToastService).toasts().at(-1);
  const type = (id: string, v: string) => { const i = el().querySelector<HTMLInputElement>('#' + id)!; i.value = v; i.dispatchEvent(new Event('input')); };
  const submit = async () => { el().querySelector<HTMLFormElement>('#user-form')!.dispatchEvent(new Event('submit')); await settle(fixture); };
  const rows = () => [...el().querySelectorAll('tbody tr')];
  const tab = (name: string) => [...el().querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((b) => text(b).includes(name))!;

  async function open(permissions = SUPER_ADMIN, self = { id: 1 }) {
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    signIn(permissions, self);
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(UsersComponent);
    await fixture.whenStable();
  }
  async function loaded(users = [user(1, { fullName: 'Moi', role: 'SUPER_ADMIN' }), user(2), user(3, { enabled: false })]) {
    respond(http, '/api/admin/users', users);
    respond(http, '/api/admin/roles', ROLES);
    respond(http, '/api/admin/permissions', PERMISSIONS);
    await settle(fixture);
  }

  it('lists the accounts with their role and whether they are enabled', async () => {
    await open();
    await loaded();
    expect(rows()).toHaveLength(3);
    expect(text(rows()[0])).toContain('Moi');
    expect(text(rows()[1])).toContain('roles.EDITOR');
    expect(text(rows()[2])).toContain('common.inactive');
  });

  it('creates an account with a generated password the administrator can read and copy', async () => {
    await open();
    await loaded();
    el().querySelector<HTMLButtonElement>('app-page-header button')!.click();
    await settle(fixture);
    const generated = el().querySelector<HTMLInputElement>('#up')!.value;
    expect(generated).toMatch(/^[A-HJ-NP-Za-km-z2-9]{18}$/); // no look-alike characters
    expect(el().querySelector('#up')?.getAttribute('type')).toBe('text');
    expect(el().querySelector<HTMLInputElement>('#ul')?.value).toBe('ar');
    type('ue', ' nouvelle@anagem.test ');
    type('un', ' Nouvelle Personne ');
    await submit();
    const req = http.expectOne({ method: 'POST', url: '/api/admin/users' });
    expect(req.request.body).toEqual({ email: 'nouvelle@anagem.test', fullName: 'Nouvelle Personne', roleName: 'EDITOR', password: generated, preferredLocale: 'ar' });
    req.flush(user(9), { status: 201, statusText: 'Created' });
    await settle(fixture);
    expect(toast()).toMatchObject({ kind: 'success', message: 'common.saved' });
    await loaded();
  });

  it('generates a different password each time', async () => {
    await open();
    await loaded();
    el().querySelector<HTMLButtonElement>('app-page-header button')!.click();
    await settle(fixture);
    const first = el().querySelector<HTMLInputElement>('#up')!.value;
    [...el().querySelectorAll<HTMLButtonElement>('app-modal button')].find((b) => b.getAttribute('aria-label')?.includes('regenerate') || text(b).includes('users.regenerate'))?.click();
    await settle(fixture);
    expect(first).toHaveLength(18);
  });

  it('refuses an invalid e-mail, a missing name and a short password', async () => {
    await open();
    await loaded();
    el().querySelector<HTMLButtonElement>('app-page-header button')!.click();
    await settle(fixture);
    type('ue', 'not-an-email');
    await submit();
    http.expectNone('/api/admin/users');
    type('ue', 'ok@anagem.test');
    type('un', 'Nom');
    type('up', 'short');
    await submit();
    http.expectNone('/api/admin/users');
  });

  it('shows the server message when the e-mail is taken and keeps the dialog open', async () => {
    await open();
    await loaded();
    el().querySelector<HTMLButtonElement>('app-page-header button')!.click();
    await settle(fixture);
    type('ue', 'user2@anagem.test');
    type('un', 'Doublon');
    await submit();
    http.expectOne({ method: 'POST', url: '/api/admin/users' }).flush({ status: 409, code: 'EMAIL_TAKEN', message: 'An account with this email already exists' }, { status: 409, statusText: 'Conflict' });
    await settle(fixture);
    expect(el().querySelector('app-modal [role="alert"]')).not.toBeNull();
    expect(el().querySelector('#user-form')).not.toBeNull();
  });

  it('edits somebody else: the e-mail is fixed, role and state can change', async () => {
    await open();
    await loaded();
    rows()[1].querySelector<HTMLButtonElement>('button[aria-label="common.edit"]')!.click();
    await settle(fixture);
    expect(el().querySelector<HTMLInputElement>('#ue')!.disabled).toBe(true);
    const role = el().querySelector<HTMLSelectElement>('#ur')!;
    role.value = 'ADMIN';
    role.dispatchEvent(new Event('change'));
    el().querySelector<HTMLInputElement>('input[formControlName="enabled"]')!.click();
    await submit();
    const req = http.expectOne({ method: 'PUT', url: '/api/admin/users/2' });
    expect(req.request.body).toMatchObject({ roleName: 'ADMIN', enabled: false, fullName: 'Utilisateur 2' });
    req.flush(user(2));
  });

  it('never sends a role or state change for your own account', async () => {
    await open();
    await loaded();
    rows()[0].querySelector<HTMLButtonElement>('button[aria-label="common.edit"]')!.click();
    await settle(fixture);
    expect(el().querySelector<HTMLSelectElement>('#ur')!.disabled).toBe(true);
    await submit();
    const body = http.expectOne({ method: 'PUT', url: '/api/admin/users/1' }).request.body;
    expect(body.roleName).toBeUndefined();
    expect(body.enabled).toBeUndefined();
  });

  it('cannot delete yourself from the list', async () => {
    await open();
    await loaded();
    expect(rows()[0].querySelector('button[aria-label="common.delete"]')).toBeNull();
    expect(rows()[1].querySelector('button[aria-label="common.delete"]')).not.toBeNull();
  });

  it('resets a password with a generated one and confirms', async () => {
    await open();
    await loaded();
    rows()[1].querySelector<HTMLButtonElement>('button[aria-label="users.resetPassword"]')!.click();
    await settle(fixture);
    const generated = el().querySelector<HTMLInputElement>('#up')!.value;
    expect(generated).toHaveLength(18);
    await submit();
    const req = http.expectOne({ method: 'POST', url: '/api/admin/users/2/reset-password' });
    expect(req.request.body).toEqual({ newPassword: generated });
    req.flush(null, { status: 204, statusText: 'No Content' });
    await settle(fixture);
    expect(toast()).toMatchObject({ kind: 'success', message: 'users.passwordReset' });
    await loaded();
  });

  it('deletes after confirmation', async () => {
    await open();
    await loaded();
    rows()[1].querySelector<HTMLButtonElement>('button[aria-label="common.delete"]')!.click();
    expect(TestBed.inject(ConfirmService).request()?.params).toEqual({ name: 'Utilisateur 2' });
    TestBed.inject(ConfirmService).answer(true);
    await settle(fixture);
    http.expectOne({ method: 'DELETE', url: '/api/admin/users/2' }).flush(null, { status: 204, statusText: 'No Content' });
    await settle(fixture);
    expect(toast()).toMatchObject({ kind: 'success', message: 'common.deleted' });
    await loaded();
  });

  describe('roles and permissions', () => {
    const box = (role: string, code: string) => el().querySelector<HTMLInputElement>(`input[aria-label="roles.${role}: ${code}"]`)!;

    it('shows the permission matrix, with the super administrator column fixed', async () => {
      await open();
      await loaded();
      tab('users.tabRoles').click();
      await settle(fixture);
      expect(box('SUPER_ADMIN', 'USER_MANAGE').checked).toBe(true);
      expect(box('SUPER_ADMIN', 'USER_MANAGE').disabled).toBe(true);
      expect(box('EDITOR', 'CONTENT_WRITE').checked).toBe(true);
      expect(box('EDITOR', 'CONTENT_PUBLISH').checked).toBe(false);
      expect(box('EDITOR', 'CONTENT_PUBLISH').disabled).toBe(false);
    });

    it('saves only the roles that changed', async () => {
      await open();
      await loaded();
      tab('users.tabRoles').click();
      await settle(fixture);
      const save = () => [...el().querySelectorAll<HTMLButtonElement>('app-page-header button')].find((b) => text(b).includes('common.save'))!;
      expect(save().disabled).toBe(true);
      box('EDITOR', 'CONTENT_PUBLISH').click();
      await settle(fixture);
      expect(save().disabled).toBe(false);
      box('EDITOR', 'CONTENT_PUBLISH').click(); // back to the original
      await settle(fixture);
      expect(save().disabled).toBe(true);
      box('EDITOR', 'CONTENT_PUBLISH').click();
      await settle(fixture);
      save().click();
      await settle(fixture);
      const req = http.expectOne({ method: 'PUT', url: '/api/admin/roles/3/permissions' });
      expect([...req.request.body.permissions].sort()).toEqual(['CONTENT_PUBLISH', 'CONTENT_WRITE']);
      http.expectNone({ method: 'PUT', url: '/api/admin/roles/2/permissions' });
      req.flush({ ...ROLES[2], permissions: ['CONTENT_PUBLISH', 'CONTENT_WRITE'] });
      await settle(fixture);
      expect(toast()).toMatchObject({ kind: 'success', message: 'common.saved' });
    });

    it('reports a refused change', async () => {
      await open();
      await loaded();
      tab('users.tabRoles').click();
      await settle(fixture);
      box('ADMIN', 'USER_MANAGE').click();
      await settle(fixture);
      [...el().querySelectorAll<HTMLButtonElement>('app-page-header button')].find((b) => text(b).includes('common.save'))!.click();
      await settle(fixture);
      http.expectOne({ method: 'PUT', url: '/api/admin/roles/2/permissions' }).flush({ status: 400, code: 'UNKNOWN_PERMISSION', message: 'unknown' }, { status: 400, statusText: 'Bad Request' });
      await settle(fixture);
      expect(toast()?.kind).toBe('error');
    });
  });

  it('shows only the role matrix to someone who may manage roles but not accounts', async () => {
    await open([...ADMIN, 'ROLE_MANAGE'], { id: 5 });
    respond(http, '/api/admin/roles', ROLES);
    respond(http, '/api/admin/permissions', PERMISSIONS);
    await settle(fixture);
    expect([...el().querySelectorAll('[role="tab"]')].map((b) => text(b))).toEqual(['users.tabRoles']);
    http.expectNone('/api/admin/users');
  });

  it('shows a loading error and retries', async () => {
    await open();
    fail(http, '/api/admin/users', 500, 'INTERNAL_ERROR', 'Hors service');
    respond(http, '/api/admin/roles', ROLES);
    respond(http, '/api/admin/permissions', PERMISSIONS);
    await settle(fixture);
    expect(el().querySelector('[role="alert"]')?.textContent).toContain('Hors service');
  });
});
