import { Component, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { PublicApi, PublicationCard } from '../../../core/api/public-api';
import { LangService } from '../../../core/i18n/lang.service';
import { SeoService } from '../../../core/seo/seo.service';
import { SiteStore } from '../../../core/seo/site.store';
import { EmptyStateComponent, ErrorStateComponent } from '../../../shared/components/states';
import { IconComponent } from '../../../shared/components/icon';
import { PaginationComponent } from '../../../shared/components/pagination';
import { PagedList, debounced } from '../../../shared/util/paged-list';
import { PageBannerComponent, PublicationCardComponent } from '../shared/public-ui';

const KINDS = ['MAGAZINE_ISSUE', 'BOOK', 'PROCEEDINGS', 'REPORT', 'OTHER'];

@Component({
  selector: 'app-public-publications-list',
  imports: [FormsModule, TranslocoPipe, PageBannerComponent, PublicationCardComponent, PaginationComponent, EmptyStateComponent, ErrorStateComponent, IconComponent],
  template: `
    <app-page-banner [title]="'public.nav.publications' | transloco" [subtitle]="'public.publicationsSubtitle' | transloco" />
    <div class="mx-auto my-8 w-[min(100%-2rem,1240px)]">
      <div class="mb-6 flex flex-wrap items-center gap-3">
        <div class="relative min-w-52 flex-1 sm:max-w-xs"><app-icon name="search" class="pointer-events-none absolute inset-y-0 start-3 text-muted" /><input type="search" class="input ps-9" [ngModel]="q" (ngModelChange)="onSearch($event)" [placeholder]="'public.searchPublications' | transloco" [attr.aria-label]="'public.searchPublications' | transloco" /></div>
        <select class="input w-auto" [(ngModel)]="kind" (ngModelChange)="reload()" [attr.aria-label]="'public.publicationKind' | transloco"><option value="">{{ 'public.allKinds' | transloco }}</option>@for (k of kinds; track k) { <option [value]="k">{{ 'kind.' + k | transloco }}</option> }</select>
        <select class="input w-auto" [(ngModel)]="year" (ngModelChange)="reload()" [attr.aria-label]="'public.year' | transloco"><option value="">{{ 'public.allYears' | transloco }}</option>@for (y of years(); track y) { <option [value]="y">{{ y }}</option> }</select>
      </div>
      @if (list.error(); as e) { <app-error-state [message]="e.message" (retry)="list.load()" /> }
      @else if (list.loading() && !list.items().length) { <div class="grid gap-5 md:grid-cols-2">@for (i of [1,2,3,4]; track i) { <div class="skeleton h-44 rounded-card"></div> }</div> }
      @else if (!list.items().length) { <app-empty-state icon="library" title="public.noPublications" /> }
      @else {
        <ul class="grid gap-5 md:grid-cols-2" [class.opacity-60]="list.loading()">@for (p of list.items(); track p.id) { <li><app-publication-card [p]="p" /></li> }</ul>
        <div class="mt-6 overflow-hidden rounded-card border border-line bg-surface"><app-pagination [page]="list.page()" [size]="list.size" [total]="list.total()" [totalPages]="list.totalPages()" (pageChange)="list.load($event)" /></div>
      }
    </div>`,
})
export class PublicPublicationsListComponent {
  private readonly api = inject(PublicApi);
  private readonly lang = inject(LangService);
  private readonly seo = inject(SeoService);
  private readonly site = inject(SiteStore);
  private readonly t = inject(TranslocoService);
  protected readonly kinds = KINDS;
  protected readonly years = signal<number[]>([]);
  protected kind = '';
  protected year: number | string = '';
  protected q = '';
  protected readonly list = new PagedList<PublicationCard>((page, size) => this.api.publications({ lang: this.lang.lang(), kind: this.kind, year: this.year, q: this.q, page, size }), 10);
  protected readonly onSearch = debounced((v: string) => { this.q = v.trim(); this.reload(); });

  constructor() {
    this.api.publicationYears().subscribe({ next: (y) => this.years.set(y), error: () => undefined });
    effect(() => {
      const l = this.lang.lang();
      untracked(() => {
        this.list.load(0);
        this.seo.set({ title: this.t.translate('public.nav.publications'), description: this.t.translate('public.publicationsSubtitle'), path: '/publications', lang: l, siteName: this.site.siteName });
      });
    });
  }

  protected reload() { this.list.load(0); }
}
