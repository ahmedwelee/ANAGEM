import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { Provider } from '@angular/core';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NewsDetail, Page } from '../app/core/api/models';
import { EventCard, MediaRef, NewsCard, PublicationCard, ResourceCard } from '../app/core/api/public-api';
import { AuthService } from '../app/core/auth/auth.service';
import { loginResponse } from './test-providers';

export const pageOf = <T>(content: T[], o: Partial<Page<T>> = {}): Page<T> => ({ content, page: 0, size: 10, totalElements: content.length, totalPages: content.length ? 1 : 0, ...o });

export const mediaRef = (o: Partial<MediaRef> = {}): MediaRef => ({ id: 'm1', url: '/api/public/media/m1', thumbnailUrl: '/api/public/media/m1/thumbnail', altText: 'Texte alternatif', width: 800, height: 600, contentType: 'image/png', ...o });

export const newsCard = (o: Partial<NewsCard> = {}): NewsCard => ({ id: 1, slug: 'premiere-actualite', title: 'Première actualité', summary: 'Un résumé', publishedAt: '2026-09-01T10:00:00Z', category: null, tags: [], featured: false, image: null, locale: 'fr', fallback: false, ...o });

export const newsDetail = (o: Partial<NewsDetail> = {}): NewsDetail => ({
  id: 1, slug: 'premiere-actualite', title: 'Première actualité', summary: 'Un résumé', content: '<p>Corps de l\'article</p>', seoTitle: null, seoDescription: null, publishedAt: '2026-09-01T10:00:00Z',
  category: null, tags: [], featured: false, image: null, locale: 'fr', fallback: false, availableLocales: ['fr'], ...o,
});

export const eventCard = (o: Partial<EventCard> = {}): EventCard => ({
  id: 1, slug: 'colloque-kenitra', type: 'CONFERENCE', title: 'Colloque de Kénitra', description: '<p>Programme</p>', location: 'Kénitra', organizer: null, startsAt: '2026-10-13T08:00:00Z', endsAt: '2026-10-15T16:00:00Z', allDay: false,
  timezone: 'Africa/Casablanca', timeStatus: 'UPCOMING', registrationUrl: null, category: null, image: null, program: null, programDownloadUrl: null, featured: false, locale: 'fr', fallback: false, ...o,
});

export const publicationCard = (o: Partial<PublicationCard> = {}): PublicationCard => ({
  id: 7, kind: 'MAGAZINE_ISSUE', year: 2026, issueNumber: '12', title: 'Géographie du Maroc n°12', description: '<p>Dossier</p>', publishedAt: '2026-06-01T00:00:00Z', category: null, coverImage: null, pdf: null, pdfDownloadUrl: null, featured: false, locale: 'fr', fallback: false, ...o,
});

export const resourceCard = (o: Partial<ResourceCard> = {}): ResourceCard => ({ id: 3, kind: 'MAP', title: 'Carte du Maroc', description: '<p>Carte</p>', publishedAt: '2026-05-01T00:00:00Z', category: null, file: null, downloadUrl: null, externalUrl: null, locale: 'fr', fallback: false, ...o });

/** Takes (and so removes) all pending requests to {@code url}, path only. Flush the returned requests yourself, or use {@link respond}. */
export function pending(http: HttpTestingController, url: string, method?: string): TestRequest[] {
  return http.match((r) => r.url === url && (!method || r.method === method));
}

/** Answers every pending request to {@code url}; fails when there is none, so a forgotten call is a test failure. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function respond(http: HttpTestingController, url: string, body: any, status = 200, method?: string): TestRequest[] {
  const reqs = pending(http, url, method);
  if (!reqs.length) throw new Error(`No request to ${url}. Pending: ${describe(http)}`);
  for (const r of reqs) r.flush(body, { status, statusText: String(status) });
  return reqs;
}

/** Fails a request the way the backend does: with the ApiError JSON the interceptor turns into a thrown ApiError. */
export function fail(http: HttpTestingController, url: string, status: number, code = 'ERROR', message = 'Something went wrong'): TestRequest[] {
  return respond(http, url, { status, code, message }, status);
}

function describe(http: HttpTestingController): string {
  try { return JSON.stringify((http as unknown as { open: { request: { urlWithParams: string } }[] }).open.map((o) => o.request.urlWithParams)); } catch { return '?'; }
}

/** Lets effects, microtasks and signal-driven change detection settle (twice: an HTTP answer can start a second round). */
export async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  await fixture.whenStable();
  fixture.detectChanges();
  await fixture.whenStable();
}

/** A route that carries a query string and/or route data, for components that read {@code ActivatedRoute.snapshot}. */
export function routeWith(opts: { query?: Record<string, string>; data?: Record<string, unknown>; params?: Record<string, string> }): Provider {
  const queryParamMap = convertToParamMap(opts.query ?? {});
  const paramMap = convertToParamMap(opts.params ?? {});
  return { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap, data: opts.data ?? {}, paramMap }, queryParamMap: of(queryParamMap), paramMap: of(paramMap), data: of(opts.data ?? {}) } };
}

/** A writer who cannot publish (a role a super administrator can still set up): their content goes through review. */
export const WRITER = ['DASHBOARD_VIEW', 'CONTENT_WRITE', 'MEDIA_UPLOAD'];
/** The Editor role as delivered: writes and publishes on their own. */
export const EDITOR = [...WRITER, 'CONTENT_PUBLISH'];
export const ADMIN = [...EDITOR, 'CONTENT_DELETE', 'MEDIA_DELETE', 'CATEGORY_MANAGE', 'HOMEPAGE_MANAGE', 'PARTNER_MANAGE', 'MESSAGES_VIEW'];
export const SUPER_ADMIN = [...ADMIN, 'AUDIT_VIEW', 'USER_MANAGE', 'ROLE_MANAGE', 'SETTINGS_MANAGE'];

/** Signs the test session in with the given permissions (no request is made). Call after configureTestingModule. */
export function signIn(permissions: string[], user: Record<string, unknown> = {}): void {
  const r = loginResponse(permissions);
  (TestBed.inject(AuthService) as unknown as { set: (s: unknown) => void }).set({ token: 'test-token', expiresAt: r.expiresAt, user: { ...r.user, ...user } });
}

/** A list row that satisfies every admin list screen (news, events, publications, resources). */
export const adminRow = (id: number, title: string, o: Record<string, unknown> = {}) => ({
  id, slug: `slug-${id}`, status: 'DRAFT', publishedAt: null, featured: false, categoryId: null, categoryName: null, title, titleLocale: 'fr',
  translationStatus: [{ locale: 'fr', present: true, complete: true, missingFields: [] }, { locale: 'ar', present: false, complete: false, missingFields: ['title'] }, { locale: 'en', present: false, complete: false, missingFields: ['title'] }],
  authorName: 'Amina Alaoui', updatedAt: '2026-10-01T09:00:00Z',
  type: 'CONFERENCE', startsAt: '2026-10-13T08:00:00Z', endsAt: null, allDay: false, location: null, timeStatus: 'UPCOMING',
  kind: 'BOOK', year: 2026, issueNumber: null, ...o,
});

export const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
