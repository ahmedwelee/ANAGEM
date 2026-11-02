import { Component, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { catchError, forkJoin, of } from 'rxjs';
import { Page } from '../../../core/api/models';
import { EventCard, NewsCard, PublicApi, PublicationCard } from '../../../core/api/public-api';
import { LangService } from '../../../core/i18n/lang.service';
import { SeoService } from '../../../core/seo/seo.service';
import { SiteStore } from '../../../core/seo/site.store';
import { IconComponent } from '../../../shared/components/icon';
import { EventCardComponent } from '../shared/event-card';
import { NewsCardComponent, PageBannerComponent, PublicationCardComponent } from '../shared/public-ui';

const empty = <T>(): Page<T> => ({ content: [], page: 0, size: 0, totalElements: 0, totalPages: 0 });

/** Site search: asks the news, events and publications APIs in parallel and groups the answers. */
@Component({
  selector: 'app-search',
  imports: [RouterLink, TranslocoPipe, IconComponent, PageBannerComponent, NewsCardComponent, EventCardComponent, PublicationCardComponent],
  template: `
    <app-page-banner [title]="'public.searchTitle' | transloco" [crumb]="'public.search' | transloco" />
    <div class="mx-auto my-8 w-[min(100%-2rem,1240px)]">
      <form class="relative mb-8 max-w-2xl" role="search" (submit)="submit($event, box)"><app-icon name="search" class="pointer-events-none absolute inset-y-0 start-4 text-muted" />
        <input #box type="search" class="input h-12 ps-11 text-base" [value]="q()" [placeholder]="'public.searchPlaceholder' | transloco" [attr.aria-label]="'public.search' | transloco" /></form>
      @if (!q()) { <p class="text-muted">{{ 'public.searchHint' | transloco }}</p> }
      @else if (loading()) { <div class="space-y-3" aria-busy="true"><div class="skeleton h-6 w-48"></div><div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"><div class="skeleton h-64 rounded-card"></div><div class="skeleton h-64 rounded-card"></div><div class="skeleton h-64 rounded-card"></div></div></div> }
      @else if (!total()) {
        <div class="py-12 text-center"><span class="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-primary-soft text-2xl text-primary"><app-icon name="search-x" /></span>
          <p class="font-bold text-primary-dark">{{ 'public.searchNone' | transloco: { q: q() } }}</p><p class="mt-1 text-sm text-muted">{{ 'public.searchNoneHint' | transloco }}</p></div>
      } @else {
        <p class="mb-6 text-sm text-muted" role="status">{{ 'public.searchCount' | transloco: { count: total(), q: q() } }}</p>
        <div class="space-y-10">
          @if (news().content.length) { <section><div class="mb-4 flex items-baseline justify-between gap-3 border-b border-line pb-2"><h2 class="text-lg font-bold text-primary-dark">{{ 'public.nav.news' | transloco }} <span class="text-sm font-normal text-muted tabular-nums">({{ news().totalElements }})</span></h2>
            <a [routerLink]="['/', lang.lang(), 'news']" [queryParams]="{ q: q() }" class="text-sm font-semibold text-primary hover:underline">{{ 'public.seeAll' | transloco }}</a></div>
            <ul class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">@for (n of news().content; track n.id) { <li><app-news-card [n]="n" /></li> }</ul></section> }
          @if (events().content.length) { <section><div class="mb-4 border-b border-line pb-2"><h2 class="text-lg font-bold text-primary-dark">{{ 'public.nav.events' | transloco }} <span class="text-sm font-normal text-muted tabular-nums">({{ events().totalElements }})</span></h2></div>
            <ul class="grid gap-5 md:grid-cols-2">@for (e of events().content; track e.id) { <li><app-event-card [e]="e" /></li> }</ul></section> }
          @if (pubs().content.length) { <section><div class="mb-4 border-b border-line pb-2"><h2 class="text-lg font-bold text-primary-dark">{{ 'public.nav.publications' | transloco }} <span class="text-sm font-normal text-muted tabular-nums">({{ pubs().totalElements }})</span></h2></div>
            <ul class="grid gap-5 md:grid-cols-2">@for (p of pubs().content; track p.id) { <li><app-publication-card [p]="p" /></li> }</ul></section> }
        </div>
      }
    </div>`,
})
export class SearchComponent {
  private readonly api = inject(PublicApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);
  private readonly site = inject(SiteStore);
  private readonly t = inject(TranslocoService);
  protected readonly lang = inject(LangService);
  protected readonly q = signal((this.route.snapshot.queryParamMap.get('q') ?? '').trim());
  protected readonly loading = signal(false);
  protected readonly news = signal<Page<NewsCard>>(empty());
  protected readonly events = signal<Page<EventCard>>(empty());
  protected readonly pubs = signal<Page<PublicationCard>>(empty());

  constructor() {
    this.route.queryParamMap.subscribe((m) => this.q.set((m.get('q') ?? '').trim()));
    effect(() => {
      const q = this.q(), l = this.lang.lang();
      untracked(() => {
        // Search results are never indexed (thin, duplicate pages).
        this.seo.set({ title: this.t.translate('public.searchTitle'), path: '/search', lang: l, noindex: true, siteName: this.site.siteName });
        if (!q) return;
        this.loading.set(true);
        forkJoin({
          news: this.api.news({ lang: l, q, size: 6 }).pipe(catchError(() => of(empty<NewsCard>()))),
          events: this.api.events({ lang: l, q, scope: 'ALL', size: 6 }).pipe(catchError(() => of(empty<EventCard>()))),
          pubs: this.api.publications({ lang: l, q, size: 6 }).pipe(catchError(() => of(empty<PublicationCard>()))),
        }).subscribe((r) => { this.news.set(r.news); this.events.set(r.events); this.pubs.set(r.pubs); this.loading.set(false); });
      });
    });
  }

  protected total() { return this.news().totalElements + this.events().totalElements + this.pubs().totalElements; }
  protected submit(ev: Event, input: HTMLInputElement) {
    ev.preventDefault();
    const q = input.value.trim();
    if (q) void this.router.navigate(['/', this.lang.lang(), 'search'], { queryParams: { q } });
  }
}
