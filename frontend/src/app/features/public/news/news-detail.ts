import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiError, NewsDetail } from '../../../core/api/models';
import { NewsCard, PublicApi } from '../../../core/api/public-api';
import { LangService } from '../../../core/i18n/lang.service';
import { SeoService } from '../../../core/seo/seo.service';
import { SiteStore } from '../../../core/seo/site.store';
import { IconComponent } from '../../../shared/components/icon';
import { AppDatePipe } from '../../../shared/util/app-date.pipe';
import { NewsCardComponent, ShareComponent, injectNotFound } from '../shared/public-ui';
import { stripHtml } from '../shared/util';

@Component({
  selector: 'app-public-news-detail',
  imports: [RouterLink, TranslocoPipe, IconComponent, AppDatePipe, NewsCardComponent, ShareComponent],
  template: `
    @if (error(); as e) {
      <div class="mx-auto my-24 max-w-md px-6 text-center"><span class="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-primary-soft text-2xl text-primary"><app-icon name="newspaper" /></span>
        <h1 class="text-xl font-bold text-primary-dark">{{ (e.status === 404 ? 'public.articleNotFound' : 'public.loadError') | transloco }}</h1>
        <a [routerLink]="['/', lang.lang(), 'news']" class="btn btn-primary mt-5">{{ 'public.backToNews' | transloco }}</a></div>
    } @else if (n(); as a) {
      <article class="mx-auto w-[min(100%-2rem,52rem)] py-8 sm:py-12" [attr.lang]="a.locale" [attr.dir]="a.locale === 'ar' ? 'rtl' : 'ltr'">
        <nav class="mb-5 flex items-center gap-1.5 text-xs text-muted" [attr.aria-label]="'public.breadcrumb' | transloco" [attr.dir]="lang.dir()">
          <a [routerLink]="['/', lang.lang()]" class="hover:text-primary hover:underline">{{ 'public.nav.home' | transloco }}</a><app-icon name="chevron-right" class="rtl:-scale-x-100" /><a [routerLink]="['/', lang.lang(), 'news']" class="hover:text-primary hover:underline">{{ 'public.nav.news' | transloco }}</a></nav>
        <div class="mb-3 flex flex-wrap items-center gap-2 text-sm">@if (a.category; as c) { <span class="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-bold text-primary">{{ c.name }}</span> }
          @if (a.publishedAt) { <time class="text-muted" [attr.datetime]="a.publishedAt">{{ a.publishedAt | appDate }}</time> }
          @if (a.fallback) { <span class="badge badge-review" [attr.dir]="lang.dir()">{{ 'public.fallbackNote' | transloco: { lang: ('lang.' + a.locale | transloco) } }}</span> }</div>
        <h1 class="text-[clamp(1.7rem,1.3rem+1.6vw,2.6rem)] leading-tight font-extrabold text-primary-dark rtl:leading-snug">{{ a.title }}</h1>
        @if (a.summary) { <p class="mt-3 text-lg leading-relaxed text-muted">{{ a.summary }}</p> }
        @if (a.image; as img) { <figure class="my-7"><img [src]="img.url" [alt]="img.altText ?? ''" class="max-h-[28rem] w-full rounded-card object-cover" fetchpriority="high" /></figure> }
        <div class="rte-content mt-6 text-[1.02rem]" [innerHTML]="a.content"></div>
        @if (a.tags.length) { <ul class="mt-8 flex flex-wrap gap-2" [attr.dir]="lang.dir()">@for (tg of a.tags; track tg) { <li><a [routerLink]="['/', lang.lang(), 'news']" [queryParams]="{ tag: tg }" class="badge badge-info hover:bg-primary hover:text-white">#{{ tg }}</a></li> }</ul> }
        <div class="mt-8 border-t border-line pt-5" [attr.dir]="lang.dir()"><app-share [path]="'/' + lang.lang() + '/news/' + a.slug" [title]="a.title" /></div>
      </article>
      @if (related().length) {
        <section class="mx-auto mb-4 w-[min(100%-2rem,1240px)]" [attr.aria-label]="'public.related' | transloco"><h2 class="mb-4 border-b border-line pb-2 text-lg font-bold text-primary-dark">{{ 'public.related' | transloco }}</h2>
          <ul class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">@for (r of related(); track r.id) { <li><app-news-card [n]="r" /></li> }</ul></section>
      }
    } @else {
      <div class="mx-auto w-[min(100%-2rem,52rem)] space-y-4 py-12" aria-busy="true"><div class="skeleton h-10 w-3/4"></div><div class="skeleton h-5 w-1/2"></div><div class="skeleton h-72"></div><div class="skeleton h-4"></div><div class="skeleton h-4 w-5/6"></div></div>
    }`,
})
export class PublicNewsDetailComponent {
  private readonly api = inject(PublicApi);
  private readonly seo = inject(SeoService);
  private readonly site = inject(SiteStore);
  protected readonly lang = inject(LangService);
  private readonly notFound = injectNotFound();
  readonly slug = input.required<string>();
  protected readonly n = signal<NewsDetail | null>(null);
  protected readonly related = signal<NewsCard[]>([]);
  protected readonly error = signal<ApiError | null>(null);

  constructor() {
    effect(() => {
      const slug = this.slug(), l = this.lang.lang();
      untracked(() => {
        this.n.set(null); this.error.set(null); this.related.set([]);
        this.api.newsDetail(slug, l).subscribe({
          next: (a) => {
            this.n.set(a);
            this.seo.set({ title: a.seoTitle || a.title, description: a.seoDescription || a.summary || stripHtml(a.content), path: `/news/${a.slug}`, lang: l, image: a.image?.url, type: 'article', siteName: this.site.siteName,
              jsonLd: { '@context': 'https://schema.org', '@type': 'NewsArticle', headline: a.title, datePublished: a.publishedAt, inLanguage: a.locale, image: a.image ? [this.seo.absolute(a.image.url)] : undefined, publisher: { '@type': 'Organization', name: this.site.siteName } } });
            this.api.newsRelated(slug, l).subscribe({ next: (r) => this.related.set(r), error: () => undefined });
          },
          error: (e: ApiError) => { this.error.set(e); if (e.status === 404) this.notFound(); this.seo.set({ title: '', path: `/news/${slug}`, lang: l, noindex: true, siteName: this.site.siteName }); },
        });
      });
    });
  }
}
