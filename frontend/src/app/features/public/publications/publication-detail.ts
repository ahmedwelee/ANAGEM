import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiError } from '../../../core/api/models';
import { PublicApi, PublicationCard } from '../../../core/api/public-api';
import { LangService } from '../../../core/i18n/lang.service';
import { SeoService } from '../../../core/seo/seo.service';
import { SiteStore } from '../../../core/seo/site.store';
import { IconComponent } from '../../../shared/components/icon';
import { ShareComponent, injectNotFound } from '../shared/public-ui';
import { stripHtml } from '../shared/util';

@Component({
  selector: 'app-public-publication-detail',
  imports: [RouterLink, TranslocoPipe, IconComponent, ShareComponent],
  template: `
    @if (error(); as err) {
      <div class="mx-auto my-24 max-w-md px-6 text-center"><span class="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-primary-soft text-2xl text-primary"><app-icon name="library" /></span>
        <h1 class="text-xl font-bold text-primary-dark">{{ (err.status === 404 ? 'public.publicationNotFound' : 'public.loadError') | transloco }}</h1>
        <a [routerLink]="['/', lang.lang(), 'publications']" class="btn btn-primary mt-5">{{ 'public.backToPublications' | transloco }}</a></div>
    } @else if (p(); as pub) {
      <article class="mx-auto w-[min(100%-2rem,60rem)] py-8 sm:py-12" [attr.lang]="pub.locale" [attr.dir]="pub.locale === 'ar' ? 'rtl' : 'ltr'">
        <nav class="mb-5 flex items-center gap-1.5 text-xs text-muted" [attr.aria-label]="'public.breadcrumb' | transloco" [attr.dir]="lang.dir()">
          <a [routerLink]="['/', lang.lang()]" class="hover:text-primary hover:underline">{{ 'public.nav.home' | transloco }}</a><app-icon name="chevron-right" class="rtl:-scale-x-100" /><a [routerLink]="['/', lang.lang(), 'publications']" class="hover:text-primary hover:underline">{{ 'public.nav.publications' | transloco }}</a></nav>
        <div class="grid gap-8 md:grid-cols-[13rem_1fr]">
          <div class="mx-auto w-44 md:w-full">
            <div class="relative aspect-[3/4] overflow-hidden rounded-[4px_12px_12px_4px] bg-gradient-to-br from-primary to-primary-deep shadow-pop">
              @if (pub.coverImage; as c) { <img [src]="c.url" [alt]="c.altText ?? ''" class="size-full object-cover" fetchpriority="high" /> }
              @else { <span class="absolute inset-0 flex flex-col justify-between p-4 text-sm leading-snug font-bold text-white"><app-icon name="book-open" class="text-3xl opacity-80" /><span>{{ pub.title }}</span></span> }</div>
          </div>
          <div>
            <div class="mb-2 flex flex-wrap items-center gap-2 text-xs" [attr.dir]="lang.dir()"><span class="rounded-full bg-primary-soft px-2.5 py-0.5 font-bold text-primary">{{ 'kind.' + pub.kind | transloco }}</span>
              <span class="text-muted tabular-nums">{{ pub.year }}@if (pub.issueNumber) { · N° {{ pub.issueNumber }} }</span>
              @if (pub.fallback) { <span class="badge badge-review">{{ 'public.fallbackNote' | transloco: { lang: ('lang.' + pub.locale | transloco) } }}</span> }</div>
            <h1 class="text-[clamp(1.6rem,1.2rem+1.4vw,2.3rem)] leading-tight font-extrabold text-primary-dark rtl:leading-snug">{{ pub.title }}</h1>
            @if (pub.description) { <div class="rte-content mt-4" [innerHTML]="pub.description"></div> }
            <div class="mt-6 flex flex-wrap gap-2" [attr.dir]="lang.dir()">
              @if (pub.pdfDownloadUrl) { <a [href]="pub.pdfDownloadUrl" class="btn btn-primary"><app-icon name="download" />{{ 'public.downloadPdf' | transloco }}</a> }
              @if (pub.pdf; as f) { <a [href]="f.url" target="_blank" rel="noopener" class="btn btn-secondary"><app-icon name="eye" />{{ 'public.openPdf' | transloco }}</a> }
            </div>
            <div class="mt-6 border-t border-line pt-5" [attr.dir]="lang.dir()"><app-share [path]="'/' + lang.lang() + '/publications/' + pub.id" [title]="pub.title" /></div>
          </div>
        </div>
        @if (viewer(); as src) {
          <section class="mt-10" [attr.aria-label]="'public.preview' | transloco" [attr.dir]="lang.dir()"><h2 class="mb-3 text-lg font-bold text-primary-dark">{{ 'public.preview' | transloco }}</h2>
            <iframe [src]="src" [title]="pub.title" class="h-[70vh] min-h-96 w-full rounded-card border border-line bg-canvas" loading="lazy"></iframe>
            <p class="mt-2 text-xs text-muted">{{ 'public.previewHint' | transloco }}</p></section>
        }
      </article>
    } @else {
      <div class="mx-auto w-[min(100%-2rem,60rem)] space-y-4 py-12" aria-busy="true"><div class="skeleton h-10 w-3/4"></div><div class="skeleton h-72"></div></div>
    }`,
})
export class PublicPublicationDetailComponent {
  private readonly api = inject(PublicApi);
  private readonly seo = inject(SeoService);
  private readonly site = inject(SiteStore);
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly lang = inject(LangService);
  private readonly notFound = injectNotFound();
  readonly id = input.required<string>();
  protected readonly p = signal<PublicationCard | null>(null);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly viewer = signal<SafeResourceUrl | null>(null);

  constructor() {
    effect(() => {
      const id = this.id(), l = this.lang.lang();
      untracked(() => {
        this.p.set(null); this.error.set(null); this.viewer.set(null);
        this.api.publicationDetail(id, l).subscribe({
          next: (pub) => {
            this.p.set(pub);
            // The PDF is served from our own origin by the backend; only the first-party URL is allowed in the frame.
            if (pub.pdf?.url.startsWith('/api/public/media/')) this.viewer.set(this.sanitizer.bypassSecurityTrustResourceUrl(pub.pdf.url));
            this.seo.set({ title: pub.title, description: stripHtml(pub.description) || pub.title, path: `/publications/${pub.id}`, lang: l, image: pub.coverImage?.url, siteName: this.site.siteName,
              jsonLd: { '@context': 'https://schema.org', '@type': pub.kind === 'MAGAZINE_ISSUE' ? 'PublicationIssue' : 'Book', name: pub.title, datePublished: pub.publishedAt, inLanguage: pub.locale, issueNumber: pub.issueNumber ?? undefined } });
          },
          error: (err: ApiError) => { this.error.set(err); if (err.status === 404) this.notFound(); this.seo.set({ title: '', path: `/publications/${id}`, lang: l, noindex: true, siteName: this.site.siteName }); },
        });
      });
    });
  }
}
