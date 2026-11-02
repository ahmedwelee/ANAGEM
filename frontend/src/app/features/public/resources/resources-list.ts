import { Component, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { CategoryPublic, PublicApi, ResourceCard } from '../../../core/api/public-api';
import { LangService } from '../../../core/i18n/lang.service';
import { SeoService } from '../../../core/seo/seo.service';
import { SiteStore } from '../../../core/seo/site.store';
import { EmptyStateComponent, ErrorStateComponent } from '../../../shared/components/states';
import { IconComponent } from '../../../shared/components/icon';
import { PaginationComponent } from '../../../shared/components/pagination';
import { PagedList, debounced } from '../../../shared/util/paged-list';
import { PageBannerComponent, ResourceCardComponent } from '../shared/public-ui';

const KINDS = ['DOCUMENT', 'MAP', 'RESEARCH', 'REPORT', 'OFFICIAL', 'EDUCATIONAL'];

@Component({
  selector: 'app-public-resources-list',
  imports: [FormsModule, TranslocoPipe, PageBannerComponent, ResourceCardComponent, PaginationComponent, EmptyStateComponent, ErrorStateComponent, IconComponent],
  template: `
    <app-page-banner [title]="'public.nav.resources' | transloco" [subtitle]="'public.resourcesSubtitle' | transloco" />
    <div class="mx-auto my-8 w-[min(100%-2rem,1240px)]">
      <div class="mb-6 flex flex-wrap items-center gap-3">
        <div class="relative min-w-52 flex-1 sm:max-w-xs"><app-icon name="search" class="pointer-events-none absolute inset-y-0 start-3 text-muted" /><input type="search" class="input ps-9" [ngModel]="q" (ngModelChange)="onSearch($event)" [placeholder]="'public.searchResources' | transloco" [attr.aria-label]="'public.searchResources' | transloco" /></div>
        <select class="input w-auto" [(ngModel)]="kind" (ngModelChange)="reload()" [attr.aria-label]="'public.resourceKind' | transloco"><option value="">{{ 'public.allKinds' | transloco }}</option>@for (k of kinds; track k) { <option [value]="k">{{ 'resourceKind.' + k | transloco }}</option> }</select>
        @if (categories().length) { <select class="input w-auto" [(ngModel)]="categoryId" (ngModelChange)="reload()" [attr.aria-label]="'common.category' | transloco"><option value="">{{ 'common.allCategories' | transloco }}</option>@for (c of categories(); track c.id) { <option [value]="c.id">{{ c.name }}</option> }</select> }
      </div>
      @if (list.error(); as e) { <app-error-state [message]="e.message" (retry)="list.load()" /> }
      @else if (list.loading() && !list.items().length) { <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">@for (i of [1,2,3]; track i) { <div class="skeleton h-44 rounded-card"></div> }</div> }
      @else if (!list.items().length) { <app-empty-state icon="folder-open" title="public.noResources" /> }
      @else {
        <ul class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" [class.opacity-60]="list.loading()">@for (r of list.items(); track r.id) { <li><app-resource-card [r]="r" /></li> }</ul>
        <div class="mt-6 overflow-hidden rounded-card border border-line bg-surface"><app-pagination [page]="list.page()" [size]="list.size" [total]="list.total()" [totalPages]="list.totalPages()" (pageChange)="list.load($event)" /></div>
      }
    </div>`,
})
export class PublicResourcesListComponent {
  private readonly api = inject(PublicApi);
  private readonly lang = inject(LangService);
  private readonly seo = inject(SeoService);
  private readonly site = inject(SiteStore);
  private readonly t = inject(TranslocoService);
  protected readonly kinds = KINDS;
  protected readonly categories = signal<CategoryPublic[]>([]);
  protected kind = '';
  protected categoryId: number | string = '';
  protected q = '';
  protected readonly list = new PagedList<ResourceCard>((page, size) => this.api.resources({ lang: this.lang.lang(), kind: this.kind, categoryId: this.categoryId, q: this.q, page, size }), 12);
  protected readonly onSearch = debounced((v: string) => { this.q = v.trim(); this.reload(); });

  constructor() {
    effect(() => {
      const l = this.lang.lang();
      untracked(() => {
        this.api.categories('RESOURCE', l).subscribe({ next: (c) => this.categories.set(c), error: () => undefined });
        this.list.load(0);
        this.seo.set({ title: this.t.translate('public.nav.resources'), description: this.t.translate('public.resourcesSubtitle'), path: '/resources', lang: l, siteName: this.site.siteName });
      });
    });
  }

  protected reload() { this.list.load(0); }
}
