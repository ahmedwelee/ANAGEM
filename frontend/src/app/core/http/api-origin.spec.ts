import { FetchBackend, HttpEvent, HttpRequest, HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { API_ORIGIN, ApiOriginBackend } from './api-origin';

describe('ApiOriginBackend (server-side rendering)', () => {
  const setup = (origin: string, reply: () => Observable<HttpEvent<unknown>> = () => of(new HttpResponse({ status: 200 }))) => {
    const handle = vi.fn((_req: HttpRequest<unknown>) => reply());
    TestBed.configureTestingModule({ providers: [ApiOriginBackend, { provide: FetchBackend, useValue: { handle } }, { provide: API_ORIGIN, useValue: origin }] });
    const backend = TestBed.inject(ApiOriginBackend);
    const call = (url: string) => { backend.handle(new HttpRequest('GET', url)).subscribe({ error: () => undefined }); return handle.mock.calls.at(-1)?.[0].url; };
    return { call, handle };
  };

  it('sends API calls to the backend even after the server platform made the URL absolute (regression: the server called itself in a loop)', () => {
    const { call } = setup('http://backend:8080');
    expect(call('http://localhost:4000/api/public/news?lang=fr&page=0')).toBe('http://backend:8080/api/public/news?lang=fr&page=0');
    expect(call('/api/public/settings?lang=ar')).toBe('http://backend:8080/api/public/settings?lang=ar');
  });

  it('copes with a trailing slash in the configured origin', () => {
    expect(setup('http://backend:8080/').call('http://localhost/api/x')).toBe('http://backend:8080/api/x');
  });

  it('leaves everything else alone', () => {
    const { call } = setup('http://backend:8080');
    expect(call('http://localhost:4000/i18n/fr.json')).toBe('http://localhost:4000/i18n/fr.json');
    expect(call('https://cdn.example.org/lib.js')).toBe('https://cdn.example.org/lib.js');
  });

  it('does nothing when no origin is configured (browser)', () => {
    expect(setup('').call('/api/public/news')).toBe('/api/public/news');
  });

  it('logs server failures but not ordinary 4xx answers', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    setup('http://backend:8080', () => throwError(() => ({ status: 404, message: 'nf' }))).call('/api/x');
    expect(log).not.toHaveBeenCalled();
    TestBed.resetTestingModule();
    setup('http://backend:8080', () => throwError(() => ({ status: 502, message: 'bad gateway' }))).call('/api/x');
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toContain('http://backend:8080/api/x');
    log.mockRestore();
  });
});
