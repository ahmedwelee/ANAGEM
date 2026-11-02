import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, UrlSegment, provideRouter } from '@angular/router';
import { provideAppTesting } from '../../../testing/test-providers';
import { PUBLIC_ROUTES, homeMatcher, langMatcher } from './public.routes';

describe('public language prefix', () => {
  const seg = (...p: string[]) => p.map((x) => new UrlSegment(x, {}));

  it.each(['fr', 'ar', 'en'])('matches /%s and exposes it as the lang param', (l) => {
    const r = langMatcher(seg(l, 'news'), null as never, null as never);
    expect(r?.consumed.map((s) => s.path)).toEqual([l]);
    expect(r?.posParams?.['lang'].path).toBe(l);
  });

  it('does not match other languages, the admin, or an empty path', () => {
    expect(langMatcher(seg('de', 'news'), null as never, null as never)).toBeNull();
    expect(langMatcher(seg('admin', 'news'), null as never, null as never)).toBeNull();
    expect(langMatcher(seg('news', 'fr'), null as never, null as never)).toBeNull();
    expect(langMatcher([], null as never, null as never)).toBeNull();
  });
});

describe('home matcher', () => {
  const seg = (...p: string[]) => p.map((x) => new UrlSegment(x, {}));
  it('matches nothing after the language and empty trailing segments', () => {
    expect(homeMatcher([], null as never, null as never)?.consumed).toEqual([]);
    expect(homeMatcher(seg(''), null as never, null as never)?.consumed).toHaveLength(1);
  });
  it('does not match any real page', () => {
    expect(homeMatcher(seg('news'), null as never, null as never)).toBeNull();
    expect(homeMatcher(seg('', 'news'), null as never, null as never)).toBeNull();
    expect(homeMatcher(seg('home'), null as never, null as never)).toBeNull();
  });
});

/** Regression: the "Home" entries of the menu and footer produced "/ar/" (trailing empty segment) and that showed the "Page not found" page. */
describe('public routes: which page an address leads to', () => {
  async function leaf(go: (router: Router) => Promise<boolean> | Promise<unknown>) {
    TestBed.configureTestingModule({ providers: [...provideAppTesting(), provideRouter(PUBLIC_ROUTES)] });
    const router = TestBed.inject(Router);
    const http = TestBed.inject(HttpTestingController);
    const done = go(router);
    // the language guard asks for the site settings before the page opens
    for (let i = 0; i < 20 && !http.match((r) => r.url === '/api/public/settings').map((r) => r.flush({})).length; i++) await new Promise((r) => setTimeout(r, 5));
    await done;
    let snap = router.routerState.snapshot.root;
    while (snap.firstChild) snap = snap.firstChild;
    return { url: router.url, config: snap.routeConfig };
  }
  const isNotFound = (c: { path?: string } | null) => c?.path === '**';

  it.each(['/ar', '/fr', '/en'])('%s is the home page', async (url) => {
    const r = await leaf((router) => router.navigateByUrl(url));
    expect(isNotFound(r.config)).toBe(false);
  });

  it('a trailing slash is the home page too (as in a typed or pasted address)', async () => {
    const r = await leaf((router) => router.navigateByUrl('/ar/'));
    expect(isNotFound(r.config)).toBe(false);
  });

  it('a link built with an empty path segment is the home page too', async () => {
    const r = await leaf((router) => router.navigateByUrl(router.createUrlTree(['/', 'ar', ''])));
    expect(isNotFound(r.config)).toBe(false);
  });

  it('an address that does not exist is still the not-found page', async () => {
    const r = await leaf((router) => router.navigateByUrl('/ar/does-not-exist'));
    expect(isNotFound(r.config)).toBe(true);
  });
});
