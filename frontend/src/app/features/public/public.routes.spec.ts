import { UrlSegment } from '@angular/router';
import { langMatcher } from './public.routes';

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
