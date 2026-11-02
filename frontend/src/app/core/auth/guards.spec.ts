import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { loginResponse, provideAppTesting } from '../../../testing/test-providers';
import { AuthService } from './auth.service';
import { authGuard, guestGuard, permissionGuard } from './guards';

describe('route guards', () => {
  beforeEach(() => { localStorage.clear(); TestBed.configureTestingModule({ providers: provideAppTesting() }); });
  afterEach(() => localStorage.clear());

  const run = (guard: typeof authGuard, route: Partial<ActivatedRouteSnapshot> = {}, url = '/admin/news') =>
    TestBed.runInInjectionContext(() => guard(route as ActivatedRouteSnapshot, { url } as RouterStateSnapshot));
  const signIn = (permissions: string[]) => {
    const auth = TestBed.inject(AuthService);
    // the guards only read the session signal, so set it directly instead of going through HTTP
    (auth as unknown as { set: (s: unknown) => void }).set({ token: 't', expiresAt: loginResponse(permissions).expiresAt, user: loginResponse(permissions).user });
  };
  const serialize = (t: unknown) => TestBed.inject(Router).serializeUrl(t as UrlTree);

  it('sends signed-out visitors to the login page and remembers where they were going', () => {
    expect(serialize(run(authGuard, {}, '/admin/news/5'))).toBe('/admin/login?redirect=%2Fadmin%2Fnews%2F5');
  });

  it('lets signed-in users through', () => {
    signIn([]);
    expect(run(authGuard)).toBe(true);
  });

  it('keeps signed-in users away from the login page', () => {
    expect(run(guestGuard)).toBe(true);
    signIn([]);
    expect(serialize(run(guestGuard))).toBe('/admin');
  });

  it('checks permissions: any one of the listed ones is enough', () => {
    signIn(['CONTENT_WRITE']);
    expect(run(permissionGuard, { data: { permissions: ['USER_MANAGE', 'CONTENT_WRITE'] } })).toBe(true);
    expect(serialize(run(permissionGuard, { data: { permissions: ['USER_MANAGE'] } }))).toBe('/admin/forbidden');
  });

  it('lets everyone in when a route lists no permission', () => {
    signIn([]);
    expect(run(permissionGuard, { data: {} })).toBe(true);
  });

  it('refuses permission-protected routes when signed out', () => {
    expect(serialize(run(permissionGuard, { data: { permissions: ['CONTENT_WRITE'] } }))).toBe('/admin/forbidden');
  });
});
