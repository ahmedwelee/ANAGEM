import { Component } from '@angular/core';
import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { ADMIN, EDITOR, SUPER_ADMIN, settle, signIn, text } from '../../../testing/fixtures';
import { provideAppTesting } from '../../../testing/test-providers';
import { AuthService } from '../../core/auth/auth.service';
import { LangService } from '../../core/i18n/lang.service';
import { ConfirmHostComponent } from '../../shared/components/confirm-host';
import { ToastHostComponent } from '../../shared/components/toast-host';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ToastService } from '../../core/ui/toast.service';
import { ADMIN_ROUTES } from './admin.routes';
import { AdminShellComponent } from './layout/admin-shell';

/** Who may open which admin screen. The backend enforces the same rules; this guards the navigation, so nobody lands on a screen that can only show errors. */
describe('admin routes: access by permission', () => {
  const ALL = ['', 'news', 'news/new', 'news/5', 'publications', 'publications/new', 'events', 'events/new', 'resources', 'resources/new', 'categories', 'media', 'homepage', 'partners', 'settings', 'messages', 'users', 'audit', 'profile'];

  /** A fresh router per address: leaving a screen would run its unsaved-changes guard, which needs a real component behind it. */
  async function outcomes(permissions: string[] | null) {
    const out: Record<string, boolean> = {};
    for (const path of ALL) {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [...provideAppTesting(), provideRouter(ADMIN_ROUTES)] });
      if (permissions) signIn(permissions);
      const router = TestBed.inject(Router);
      await router.navigateByUrl('/' + path);
      out[path || '(dashboard)'] = router.url === '/' + path;
    }
    return out;
  }
  const allowed = (o: Record<string, boolean>) => Object.entries(o).filter(([, ok]) => ok).map(([p]) => p);

  it('lets a writer open the content screens, the dashboard, the media library, categories and their profile only', async () => {
    expect(allowed(await outcomes(EDITOR))).toEqual(['(dashboard)', 'news', 'news/new', 'news/5', 'publications', 'publications/new', 'events', 'events/new', 'resources', 'resources/new', 'categories', 'media', 'profile']);
  });

  it('adds the homepage, partners and messages for an administrator, but not settings, users or the audit log', async () => {
    const a = allowed(await outcomes(ADMIN));
    expect(a).toEqual(expect.arrayContaining(['homepage', 'partners', 'messages']));
    expect(a).not.toEqual(expect.arrayContaining(['settings']));
    expect(a).not.toEqual(expect.arrayContaining(['users']));
    expect(a).not.toEqual(expect.arrayContaining(['audit']));
  });

  it('opens everything for a super administrator', async () => {
    expect(allowed(await outcomes(SUPER_ADMIN))).toEqual(['(dashboard)', ...ALL.filter((p) => p !== '')]);
  });

  it('sends everybody who is not signed in to the forbidden page, except for their profile page which asks them to sign in elsewhere', async () => {
    const a = allowed(await outcomes(null));
    expect(a).toEqual(['profile']);
  });

  it('answers an unknown admin address with the not-found screen, not an error', async () => {
    TestBed.configureTestingModule({ providers: [...provideAppTesting(), provideRouter(ADMIN_ROUTES)] });
    signIn(SUPER_ADMIN);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/nothing-here');
    expect(router.url).toBe('/nothing-here');
  });
});

@Component({ template: '<p id="page">page</p>' })
class DummyPage {}

describe('AdminShellComponent', () => {
  let fixture: ComponentFixture<AdminShellComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const links = () => [...el().querySelectorAll<HTMLAnchorElement>('aside nav a')].map((a) => a.getAttribute('href'));
  const groups = () => [...el().querySelectorAll('aside nav p')].map((p) => text(p));

  async function open(permissions: string[], user: Record<string, unknown> = {}) {
    TestBed.configureTestingModule({ providers: [...provideAppTesting(), provideRouter([{ path: '**', component: DummyPage }])] });
    signIn(permissions, { fullName: 'Amina Alaoui', email: 'amina@anagem.test', role: 'EDITOR', ...user });
    fixture = TestBed.createComponent(AdminShellComponent);
    await TestBed.inject(Router).navigateByUrl('/admin');
    await settle(fixture);
  }

  it('shows a writer only the content menu', async () => {
    await open(EDITOR);
    expect(links()).toEqual(['/admin', '/admin/news', '/admin/publications', '/admin/events', '/admin/resources', '/admin/media', '/admin/categories']);
    expect(groups()).toEqual(['nav.content']);
  });

  it('adds the site and messages entries for an administrator', async () => {
    await open(ADMIN, { role: 'ADMIN' });
    expect(links()).toEqual(expect.arrayContaining(['/admin/homepage', '/admin/partners', '/admin/messages']));
    expect(links()).not.toEqual(expect.arrayContaining(['/admin/settings']));
    expect(links()).not.toEqual(expect.arrayContaining(['/admin/users']));
    expect(links()).not.toEqual(expect.arrayContaining(['/admin/audit']));
  });

  it('shows every entry to a super administrator, grouped', async () => {
    await open(SUPER_ADMIN, { role: 'SUPER_ADMIN' });
    expect(links()).toHaveLength(13);
    expect(groups()).toEqual(['nav.content', 'nav.site', 'nav.administration']);
  });

  it('greets the signed-in person with their initials, name and role', async () => {
    await open(EDITOR);
    const header = text(el().querySelector('header'));
    expect(header).toContain('AA');
    expect(header).toContain('Amina Alaoui');
    expect(header).toContain('roles.EDITOR');
  });

  it('switches the interface language and marks the active one', async () => {
    await open(EDITOR);
    const buttons = [...el().querySelectorAll<HTMLButtonElement>('header [role="group"] button')];
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']); // Arabic is the default
    buttons[0].click();
    await settle(fixture);
    expect(TestBed.inject(LangService).lang()).toBe('fr');
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false']);
  });

  it('opens the account menu, goes to the profile and signs out', async () => {
    await open(EDITOR);
    const http = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    const toggle = () => el().querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!;
    expect(el().querySelector('[role="menu"]')).toBeNull();
    toggle().click();
    await settle(fixture);
    expect(el().querySelector('[role="menu"]')?.textContent).toContain('amina@anagem.test');

    [...el().querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find((b) => text(b).includes('nav.profile'))!.click();
    await settle(fixture);
    expect(router.url).toBe('/admin/profile');
    expect(el().querySelector('[role="menu"]')).toBeNull();

    toggle().click();
    await settle(fixture);
    [...el().querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find((b) => text(b).includes('nav.logout'))!.click();
    await settle(fixture);
    http.expectOne({ method: 'POST', url: '/api/auth/logout' }).flush(null, { status: 204, statusText: 'No Content' });
    expect(TestBed.inject(AuthService).isAuthenticated()).toBe(false);
    expect(router.url).toBe('/admin/login');
  });

  it('opens and closes the menu on phones', async () => {
    await open(EDITOR);
    expect(el().querySelector('.bg-primary-deep\\/50')).toBeNull();
    el().querySelector<HTMLButtonElement>('button[aria-label="nav.openMenu"]')!.click();
    await settle(fixture);
    const backdrop = el().querySelector<HTMLElement>('.bg-primary-deep\\/50')!;
    expect(backdrop).not.toBeNull();
    backdrop.click();
    await settle(fixture);
    expect(el().querySelector('.bg-primary-deep\\/50')).toBeNull();
  });
});

describe('toast and confirmation hosts', () => {
  it('shows toasts as translated, dismissable status messages', async () => {
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    const fixture = TestBed.createComponent(ToastHostComponent);
    TestBed.inject(ToastService).success('common.saved');
    TestBed.inject(ToastService).error('common.deleted');
    await settle(fixture);
    const el = fixture.nativeElement as HTMLElement;
    const toasts = [...el.querySelectorAll('[role="status"]')];
    expect(toasts.map((t) => text(t))).toEqual(['common.saved', 'common.deleted']);
    expect(toasts[1].className).toContain('border-danger');
    toasts[0].querySelector<HTMLButtonElement>('button')!.click();
    await settle(fixture);
    expect(el.querySelectorAll('[role="status"]')).toHaveLength(1);
  });

  it('keeps at most the last four toasts', () => {
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    const toast = TestBed.inject(ToastService);
    for (let i = 0; i < 7; i++) toast.info(`m${i}`);
    expect(toast.toasts().map((t) => t.message)).toEqual(['m3', 'm4', 'm5', 'm6']);
  });

  it('asks the question and resolves true or false depending on the button', async () => {
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    const fixture = TestBed.createComponent(ConfirmHostComponent);
    const confirm = TestBed.inject(ConfirmService);
    const el = fixture.nativeElement as HTMLElement;
    const yes = confirm.ask({ title: 'common.deleteTitle', message: 'common.deleteConfirm', params: { name: 'X' }, confirmLabel: 'common.delete', danger: true });
    await settle(fixture);
    expect(el.textContent).toContain('common.deleteConfirm');
    const confirmButton = [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => text(b).includes('common.delete'))!;
    expect(confirmButton.className).toContain('btn-danger');
    confirmButton.click();
    await expect(yes).resolves.toBe(true);
    await settle(fixture);

    const no = confirm.ask({ title: 'common.unsavedTitle', message: 'common.unsavedChanges' });
    await settle(fixture);
    [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => text(b).includes('common.cancel'))!.click();
    await expect(no).resolves.toBe(false);
  });
});
