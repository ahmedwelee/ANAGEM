import { Component, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ApiError } from '../../../core/api/models';
import { PublicApi, PublicationCard } from '../../../core/api/public-api';
import { LangService } from '../../../core/i18n/lang.service';
import { SeoService } from '../../../core/seo/seo.service';
import { SiteStore } from '../../../core/seo/site.store';
import { IconComponent } from '../../../shared/components/icon';
import { EmptyStateComponent, ErrorStateComponent } from '../../../shared/components/states';
import { PageBannerComponent, PublicationCardComponent } from '../shared/public-ui';
import { imageOf, stripHtml } from '../shared/util';

/** Géographie du Maroc: the latest issue on top, the archive below. */
@Component({
  selector: 'app-magazine',
  imports: [RouterLink, TranslocoPipe, IconComponent, PageBannerComponent, PublicationCardComponent, EmptyStateComponent, ErrorStateComponent],
  template: `
    <app-page-banner [title]="'public.magazineTitle' | transloco" [subtitle]="'public.magazineSubtitle' | transloco" [crumb]="'public.nav.magazine' | transloco" />
    <div class="mx-auto my-8 w-[min(100%-2rem,1240px)]">
      @if (error(); as e) { <app-error-state [message]="e.message" (retry)="load()" /> }
      @else if (loading()) { <div class="skeleton h-72 rounded-card"></div> }
      @else if (!issues().length) { <app-empty-state icon="book-open" title="public.noIssues" hint="public.noIssuesHint" /> }
      @else {
        @if (issues()[0]; as latest) {
          <section class="grid items-center gap-8 overflow-hidden rounded-card border border-line bg-surface p-5 shadow-card sm:p-8 md:grid-cols-[14rem_1fr]" [attr.aria-label]="'public.latestIssue' | transloco">
            <div class="mx-auto w-44 md:w-full"><div class="relative aspect-[3/4] overflow-hidden rounded-[4px_12px_12px_4px] bg-gradient-to-br from-primary to-primary-deep shadow-pop transition duration-700 hover:-rotate-1 hover:scale-[1.02]">
              @if (cover(latest); as src) { <img [src]="src" [alt]="latest.coverImage?.altText ?? ''" class="size-full object-cover" fetchpriority="high" /> }
              @else { <span class="absolute inset-0 flex flex-col justify-between p-4 text-sm font-bold text-white"><app-icon name="book-open" class="text-3xl opacity-80" /><span>{{ latest.title }}</span></span> }</div></div>
            <div><span class="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-bold text-accent">{{ 'public.latestIssue' | transloco }}</span>
              <h2 class="mt-3 text-2xl leading-tight font-extrabold text-primary-dark rtl:leading-snug">{{ latest.title }}</h2>
              <p class="mt-1 text-sm text-muted tabular-nums">{{ latest.year }}@if (latest.issueNumber) { · N° {{ latest.issueNumber }} }</p>
              @if (excerpt(latest)) { <p class="mt-3 max-w-2xl text-muted">{{ excerpt(latest) }}</p> }
              <div class="mt-5 flex flex-wrap gap-2"><a [routerLink]="['/', lang.lang(), 'publications', latest.id]" class="btn btn-primary">{{ 'public.viewDetails' | transloco }}</a>
                @if (latest.pdfDownloadUrl) { <a [href]="latest.pdfDownloadUrl" class="btn btn-secondary"><app-icon name="download" />{{ 'public.downloadPdf' | transloco }}</a> }</div></div>
          </section>
        }
        @if (issues().length > 1) {
          <h2 class="mt-10 mb-4 border-b border-line pb-2 text-lg font-bold text-primary-dark">{{ 'public.archive' | transloco }}</h2>
          <ul class="grid gap-5 md:grid-cols-2">@for (p of issues().slice(1); track p.id) { <li><app-publication-card [p]="p" /></li> }</ul>
        }
      }
    </div>`,
})
export class MagazineComponent {
  private readonly api = inject(PublicApi);
  private readonly seo = inject(SeoService);
  private readonly site = inject(SiteStore);
  private readonly t = inject(TranslocoService);
  protected readonly lang = inject(LangService);
  protected readonly issues = signal<PublicationCard[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<ApiError | null>(null);

  constructor() {
    effect(() => {
      const l = this.lang.lang();
      untracked(() => {
        this.load();
        this.seo.set({ title: this.t.translate('public.magazineTitle'), description: this.t.translate('public.magazineSubtitle'), path: '/magazine', lang: l, siteName: this.site.siteName });
      });
    });
  }

  protected load() {
    this.loading.set(true); this.error.set(null);
    this.api.publications({ lang: this.lang.lang(), kind: 'MAGAZINE_ISSUE', size: 30 }).subscribe({
      next: (p) => { this.issues.set(p.content); this.loading.set(false); },
      error: (e: ApiError) => { this.error.set(e); this.loading.set(false); },
    });
  }
  protected cover(p: PublicationCard) { return imageOf(p.coverImage, true); }
  protected excerpt(p: PublicationCard) { return stripHtml(p.description, 280); }
}
