import { FetchBackend, HttpBackend, HttpEvent, HttpRequest } from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';

/** Absolute backend origin used only while rendering on the server (browser calls stay same-origin: /api is proxied). */
export const API_ORIGIN = new InjectionToken<string>('API_ORIGIN', { providedIn: 'root', factory: () => '' });

/**
 * Server-only HttpBackend: sends every /api/… call to the backend instead of back to this server.
 * By the time a request reaches the backend the server platform has already turned "/api/x" into "http://<this server>/api/x",
 * so the rewrite is by path, not by prefix. It sits below the HTTP transfer cache on purpose: the cache still sees "/api/x",
 * the same URL the browser uses, so the browser reuses the data the server fetched.
 */
@Injectable()
export class ApiOriginBackend implements HttpBackend {
  private readonly fetch = inject(FetchBackend);
  private readonly origin = inject(API_ORIGIN).replace(/\/$/, '');

  handle(req: HttpRequest<unknown>): Observable<HttpEvent<unknown>> {
    const url = new URL(req.url, 'http://placeholder.invalid');
    const target = this.origin && url.pathname.startsWith('/api/') ? req.clone({ url: this.origin + url.pathname + url.search }) : req;
    // 4xx are normal answers (unknown slug); anything else is worth a line in the server log
    return this.fetch.handle(target).pipe(tap({ error: (e: { status?: number; message?: string }) => { if (!e.status || e.status >= 500) console.error(`[ssr] API call failed: ${req.method} ${target.url} -> ${e.status ?? 'no response'} ${e.message ?? ''}`); } }));
  }
}
