import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes, UrlMatcher, UrlSegment } from '@angular/router';
import { DEFAULT_LANG, LANGS, Lang } from '../../core/api/models';
import { LangService } from '../../core/i18n/lang.service';
import { SiteStore } from '../../core/seo/site.store';

/** Matches /fr, /ar, /en as the first URL segment and exposes it as the `lang` param. */
export const langMatcher: UrlMatcher = (segments: UrlSegment[]) =>
  segments.length && (LANGS as readonly string[]).includes(segments[0].path) ? { consumed: [segments[0]], posParams: { lang: segments[0] } } : null;

/** Loads the language dictionary and the site settings before any public page renders (also on the server). */
export const publicLangGuard: CanActivateFn = async (route) => {
  const lang = route.params['lang'] as Lang;
  const langs = inject(LangService), site = inject(SiteStore);   // inject() only works before the first await
  await site.load(lang);          // settings first: pages re-run their SEO effect when the language signal flips, and need the site name by then
  await langs.setPublic(lang);
  return true;
};

const page = (load: () => Promise<unknown>) => ({ loadComponent: load as () => Promise<never> });
const cms = page(() => import('./pages/cms-page').then((m) => m.CmsPageComponent));

export const PUBLIC_ROUTES: Routes = [
  {
    matcher: langMatcher,
    canActivate: [publicLangGuard],
    runGuardsAndResolvers: 'paramsChange',
    loadComponent: () => import('./layout/public-shell').then((m) => m.PublicShellComponent),
    children: [
      { path: '', pathMatch: 'full', ...page(() => import('./home/home').then((m) => m.HomeComponent)) },
      { path: 'about', data: { slug: 'about' }, ...cms },
      { path: 'association', redirectTo: 'about' },
      { path: 'members', data: { slug: 'members' }, ...cms },
      { path: 'legal', data: { slug: 'legal' }, ...cms },
      { path: 'privacy', data: { slug: 'privacy' }, ...cms },
      { path: 'members/join', redirectTo: 'members' },
      { path: 'members/login', redirectTo: 'members' },
      { path: 'news', ...page(() => import('./news/news-list').then((m) => m.PublicNewsListComponent)) },
      { path: 'news/:slug', ...page(() => import('./news/news-detail').then((m) => m.PublicNewsDetailComponent)) },
      { path: 'events', ...page(() => import('./events/events-list').then((m) => m.PublicEventsListComponent)) },
      { path: 'events/:slug', ...page(() => import('./events/event-detail').then((m) => m.PublicEventDetailComponent)) },
      { path: 'publications', ...page(() => import('./publications/publications-list').then((m) => m.PublicPublicationsListComponent)) },
      { path: 'publications/:id', ...page(() => import('./publications/publication-detail').then((m) => m.PublicPublicationDetailComponent)) },
      { path: 'magazine', ...page(() => import('./publications/magazine').then((m) => m.MagazineComponent)) },
      { path: 'resources', ...page(() => import('./resources/resources-list').then((m) => m.PublicResourcesListComponent)) },
      { path: 'contact', ...page(() => import('./pages/contact').then((m) => m.ContactComponent)) },
      { path: 'search', ...page(() => import('./search/search').then((m) => m.SearchComponent)) },
      { path: '**', ...page(() => import('./pages/not-found').then((m) => m.PublicNotFoundComponent)) },
    ],
  },
  { path: '**', canActivate: [() => inject(Router).createUrlTree(['/', DEFAULT_LANG])], children: [] },
];
