import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { fakeUser, loginResponse, provideAppTesting } from '../../../testing/test-providers';
import { AuthService } from './auth.service';

const KEY = 'anagem.admin.session';

describe('AuthService', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  const setup = () => {
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    return { auth: TestBed.inject(AuthService), http: TestBed.inject(HttpTestingController), router: TestBed.inject(Router) };
  };

  it('starts signed out', () => {
    const { auth } = setup();
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.user()).toBeNull();
    expect(auth.token()).toBeNull();
    expect(auth.can('CONTENT_WRITE')).toBe(false);
  });

  it('signs in, keeps the session and answers permission questions', () => {
    const { auth, http } = setup();
    let done = false;
    auth.login('a@b.test', 'secret').subscribe(() => (done = true));
    const req = http.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'a@b.test', password: 'secret' });
    req.flush(loginResponse(['CONTENT_WRITE', 'MEDIA_UPLOAD']));
    expect(done).toBe(true);
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.token()).toBe('tok-123');
    expect(auth.can('CONTENT_WRITE')).toBe(true);
    expect(auth.can('USER_MANAGE')).toBe(false);
    expect(auth.canAny('USER_MANAGE', 'MEDIA_UPLOAD')).toBe(true);
    expect(auth.canAny('USER_MANAGE', 'ROLE_MANAGE')).toBe(false);
    expect(auth.canAny()).toBe(true);
    expect(JSON.parse(localStorage.getItem(KEY)!).token).toBe('tok-123');
  });

  it('restores a saved session that has not expired', () => {
    localStorage.setItem(KEY, JSON.stringify({ token: 't', expiresAt: new Date(Date.now() + 60_000).toISOString(), user: fakeUser(['CONTENT_WRITE']) }));
    const { auth } = setup();
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.can('CONTENT_WRITE')).toBe(true);
  });

  it('ignores an expired or corrupt saved session', () => {
    localStorage.setItem(KEY, JSON.stringify({ token: 't', expiresAt: new Date(Date.now() - 1000).toISOString(), user: fakeUser([]) }));
    expect(setup().auth.isAuthenticated()).toBe(false);
    TestBed.resetTestingModule();
    localStorage.setItem(KEY, '{not json');
    expect(setup().auth.isAuthenticated()).toBe(false);
  });

  it('logout tells the server, drops the session and goes to the login page', () => {
    const { auth, http, router } = setup();
    const nav = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    auth.login('a@b.test', 'x').subscribe();
    http.expectOne('/api/auth/login').flush(loginResponse(['CONTENT_WRITE']));
    auth.logout();
    http.expectOne('/api/auth/logout').flush(null);
    expect(auth.isAuthenticated()).toBe(false);
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(nav).toHaveBeenCalledWith(['/admin/login']);
  });

  it('clear() forgets the session without calling the server', () => {
    const { auth, http } = setup();
    auth.login('a@b.test', 'x').subscribe();
    http.expectOne('/api/auth/login').flush(loginResponse([]));
    auth.clear();
    http.expectNone('/api/auth/logout');
    expect(auth.token()).toBeNull();
  });

  it('refreshProfile picks up permission changes made since sign-in', () => {
    const { auth, http } = setup();
    auth.login('a@b.test', 'x').subscribe();
    http.expectOne('/api/auth/login').flush(loginResponse(['CONTENT_WRITE']));
    auth.refreshProfile().subscribe();
    http.expectOne('/api/auth/me').flush(fakeUser(['CONTENT_WRITE', 'CONTENT_PUBLISH']));
    expect(auth.can('CONTENT_PUBLISH')).toBe(true);
    expect(auth.token()).toBe('tok-123');
  });

  it('refreshProfile survives a failure', () => {
    const { auth, http } = setup();
    let result: unknown = 'unset';
    auth.refreshProfile().subscribe((u) => (result = u));
    http.expectOne('/api/auth/me').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(result).toBeNull();
  });
});
