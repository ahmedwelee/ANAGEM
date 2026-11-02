import { Component, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { PublicApi, CategoryPublic, NewsCard } from '../../../core/api/public-api';
import { LangService } from '../../../core/i18n/lang.service';
import { SeoService } from '../../../core/seo/seo.service';
import { SiteStore } from '../../../core/seo/site.store';
import { EmptyStateComponent, ErrorStateComponent } from '../../../shared/components/states';
import { PaginationComponent } from '../../../shared/components/pagination';
import { IconComponent } from '../../../shared/components/icon';
import { PagedList, debounced } from '../../../shared/util/paged-list';
import { NewsCardComponent, PageBannerComponent } from '../shared/public-ui';

@Component({
  selector: 'app-public-news-list',
  imports: [FormsModule, TranslocoPipe, PageBannerComponent, NewsCardComponent, PaginationComponent, EmptyStateComponent, ErrorStateComponent, IconComponent],
  template: `
    <app-page-banner [title]="'public.nav.news' | transloco" [subtitle]="'public.newsSubtitle' | transloco" />
    <div class="mx-auto my-8 w-[min(100%-2rem,1240px)]">
      <div class="mb-6 flex flex-wrap items-center gap-3">
        <div class="relative min-w-56 flex-1 sm:max-w-sm"><app-icon name="search" class="pointer-events-none absolute inset-y-0 start-3 text-muted" /><input type="search" class="input ps-9" [ngModel]="q" (ngModelChange)="onSearch($event)" [placeholder]="'public.searchNews' | transloco" [attr.aria-label]="'public.searchNews' | transloco" /></div>
        @if (categories().length) {
          <select class="input w-auto" [(ngModel)]="category" (ngModelChange)="reload()" [attr.aria-label]="'common.category' | transloco"><option value="">{{ 'common.allCategories' | transloco }}</option>@for (c of categories(); track c.id) { <option [value]="c.slug">{{ c.name }}</option> }</select>
        }
        @if (tag) { <button type="button" class="badge badge-info" (click)="tag = ''; reload()">#{{ tag }} <app-icon name="x" /></button> }
      </div>
      @if (list.error(); as e) { <app-error-state [message]="e.message" (retry)="list.load()" /> }
      @else if (list.loading() && !list.items().length) { <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">@for (i of [1,2,3,4,5,6]; track i) { <div class="skeleton h-72 rounded-card"></div> }</div> }
      @else if (!list.items().length) { <app-empty-state icon="newspaper" title="public.noNews" /> }
      @else {
        <ul class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" [class.opacity-60]="list.loading()">@for (n of list.items(); track n.id) { <li><app-news-card [n]="n" /></li> }</ul>
        <div class="mt-6 overflow-hidden rounded-card border border-line bg-surface"><app-pagination [page]="list.page()" [size]="list.size" [total]="list.total()" [totalPages]="list.totalPages()" (pageChange)="list.load($event); top()" /></div>
      }
    </div>`,
})
export class PublicNewsListComponent {
  private readonly api = inject(PublicApi);
  private readonly route = inject(ActivatedRoute);
  private readonly lang = inject(LangService);
  private readonly seo = inject(SeoService);
  private readonly site = inject(SiteStore);
  private readonly t = inject(TranslocoService);
  protected q = this.route.snapshot.queryParamMap.get('q') ?? '';
  protected tag = this.route.snapshot.queryParamMap.get('tag') ?? '';
  protected category = '';
  protected readonly categories = signal<CategoryPublic[]>([]);
  protected readonly list = new PagedList<NewsCard>((page, size) => this.api.news({ lang: this.lang.lang(), q: this.q, category: this.category, tag: this.tag, page, size }), 9);
  protected readonly onSearch = debounced((v: string) => { this.q = v.trim(); this.reload(); });

  constructor() {
    effect(() => {
      const l = this.lang.lang();
      untracked(() => {
        this.api.categories('NEWS', l).subscribe({ next: (c) => this.categories.set(c), error: () => undefined });
        this.list.load(0);
        this.seo.set({ title: this.t.translate('public.nav.news'), description: this.t.translate('public.newsSubtitle'), path: '/news', lang: l, siteName: this.site.siteName });
      });
    });
  }

  protected reload() { this.list.load(0); }
  protected top() { if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' }); }
}
