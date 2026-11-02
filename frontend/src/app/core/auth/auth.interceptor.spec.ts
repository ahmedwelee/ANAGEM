import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { loginResponse } from '../../../testing/test-providers';
import { ToastService } from '../ui/toast.service';
import { AuthService } from './auth.service';
import { authInterceptor, toApiError } from './auth.interceptor';
import { HttpErrorResponse } from '@angular/common/http';

describe('authInterceptor', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(), provideRouter([])] });
  });
  afterEach(() => localStorage.clear());

  const signIn = () => {
    const auth = TestBed.inject(AuthService);
    auth.login('a@b.test', 'x').subscribe();
    TestBed.inject(HttpTestingController).expectOne('/api/auth/login').flush(loginResponse(['CONTENT_WRITE']));
    return auth;
  };

  it('adds the bearer token to admin and auth calls only', () => {
    signIn();
    const http = TestBed.inject(HttpClient), ctl = TestBed.inject(HttpTestingController);
    http.get('/api/admin/news').subscribe();
    expect(ctl.expectOne('/api/admin/news').request.headers.get('Authorization')).toBe('Bearer tok-123');
    http.get('/api/auth/me').subscribe();
    expect(ctl.expectOne('/api/auth/me').request.headers.get('Authorization')).toBe('Bearer tok-123');
    http.get('/api/public/news').subscribe();
    expect(ctl.expectOne('/api/public/news').request.headers.has('Authorization')).toBe(false);
  });

  it('never sends a token with the login request itself', () => {
    const http = TestBed.inject(HttpClient), ctl = TestBed.inject(HttpTestingController);
    http.post('/api/auth/login', {}).subscribe();
    expect(ctl.expectOne('/api/auth/login').request.headers.has('Authorization')).toBe(false);
  });

  it('on 401 for a signed-in admin call: drops the session, warns and goes to login', () => {
    const auth = signIn();
    const router = TestBed.inject(Router);
    const nav = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const toast = vi.spyOn(TestBed.inject(ToastService), 'error');
    let error: unknown;
    TestBed.inject(HttpClient).get('/api/admin/news').subscribe({ error: (e) => (error = e) });
    TestBed.inject(HttpTestingController).expectOne('/api/admin/news').flush({ code: 'UNAUTHORIZED', message: 'Token expired' }, { status: 401, statusText: 'Unauthorized' });
    expect(auth.isAuthenticated()).toBe(false);
    expect(toast).toHaveBeenCalledWith('session.expired');
    expect(nav).toHaveBeenCalled();
    expect(error).toMatchObject({ status: 401, code: 'UNAUTHORIZED', message: 'Token expired' });
  });

  it('a 401 from the login call is just a failed login: no redirect, no toast', () => {
    const nav = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    let error: unknown;
    TestBed.inject(HttpClient).post('/api/auth/login', {}).subscribe({ error: (e) => (error = e) });
    TestBed.inject(HttpTestingController).expectOne('/api/auth/login').flush({ code: 'INVALID_CREDENTIALS', message: 'Bad' }, { status: 401, statusText: 'Unauthorized' });
    expect(nav).not.toHaveBeenCalled();
    expect(error).toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });
});

describe('toApiError', () => {
  it('keeps the backend error shape, including field errors', () => {
    const e = new HttpErrorResponse({ status: 400, error: { code: 'VALIDATION_FAILED', message: 'Invalid', fieldErrors: [{ field: 'email', message: 'bad' }], path: '/x' } });
    expect(toApiError(e)).toEqual({ status: 400, code: 'VALIDATION_FAILED', message: 'Invalid', fieldErrors: [{ field: 'email', message: 'bad' }], path: '/x' });
  });
  it('marks unreachable servers as NETWORK', () => {
    expect(toApiError(new HttpErrorResponse({ status: 0 }))).toMatchObject({ status: 0, code: 'NETWORK' });
  });
  it('synthesises a code for non-JSON failures and unknown errors', () => {
    expect(toApiError(new HttpErrorResponse({ status: 502, error: '<html>' }))).toMatchObject({ status: 502, code: 'HTTP_502' });
    expect(toApiError(new Error('x'))).toMatchObject({ status: 0, code: 'UNKNOWN' });
  });
});
