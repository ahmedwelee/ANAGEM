import { Component, effect, inject, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { EventCard, PublicApi } from '../../../core/api/public-api';
import { LangService } from '../../../core/i18n/lang.service';
import { SeoService } from '../../../core/seo/seo.service';
import { SiteStore } from '../../../core/seo/site.store';
import { EmptyStateComponent, ErrorStateComponent } from '../../../shared/components/states';
import { IconComponent } from '../../../shared/components/icon';
import { PaginationComponent } from '../../../shared/components/pagination';
import { PagedList, debounced } from '../../../shared/util/paged-list';
import { EventCardComponent } from '../shared/event-card';
import { PageBannerComponent } from '../shared/public-ui';

const TYPES = ['CONFERENCE', 'SEMINAR', 'WORKSHOP', 'STUDY_DAY', 'FIELD_TRIP', 'EXHIBITION', 'GENERAL_ASSEMBLY', 'MEETING', 'OTHER'];

@Component({
  selector: 'app-public-events-list',
  imports: [FormsModule, TranslocoPipe, PageBannerComponent, EventCardComponent, PaginationComponent, EmptyStateComponent, ErrorStateComponent, IconComponent],
  template: `
    <app-page-banner [title]="'public.nav.events' | transloco" [subtitle]="'public.eventsSubtitle' | transloco" />
    <div class="mx-auto my-8 w-[min(100%-2rem,1240px)]">
      <div class="mb-6 flex flex-wrap items-center gap-3">
        <div class="inline-flex rounded-lg border border-line-strong bg-surface p-0.5" role="group" [attr.aria-label]="'public.eventScope' | transloco">
          @for (s of scopes; track s) { <button type="button" class="rounded-md px-3.5 py-1.5 text-sm font-semibold transition" [class]="scope === s ? 'bg-primary text-white shadow-sm' : 'text-primary-dark hover:bg-primary-soft'" [attr.aria-pressed]="scope === s" (click)="setScope(s)">{{ 'public.scope.' + s | transloco }}</button> }</div>
        <div class="relative min-w-52 flex-1 sm:max-w-xs"><app-icon name="search" class="pointer-events-none absolute inset-y-0 start-3 text-muted" /><input type="search" class="input ps-9" [ngModel]="q" (ngModelChange)="onSearch($event)" [placeholder]="'public.searchEvents' | transloco" [attr.aria-label]="'public.searchEvents' | transloco" /></div>
        <select class="input w-auto" [(ngModel)]="type" (ngModelChange)="reload()" [attr.aria-label]="'public.eventType' | transloco"><option value="">{{ 'public.allTypes' | transloco }}</option>@for (t of types; track t) { <option [value]="t">{{ 'eventType.' + t | transloco }}</option> }</select>
      </div>
      @if (list.error(); as e) { <app-error-state [message]="e.message" (retry)="list.load()" /> }
      @else if (list.loading() && !list.items().length) { <div class="grid gap-5 md:grid-cols-2">@for (i of [1,2,3,4]; track i) { <div class="skeleton h-40 rounded-card"></div> }</div> }
      @else if (!list.items().length) { <app-empty-state icon="calendar-x" title="public.noEvents" /> }
      @else {
        <ul class="grid gap-5 md:grid-cols-2" [class.opacity-60]="list.loading()">@for (e of list.items(); track e.id) { <li><app-event-card [e]="e" /></li> }</ul>
        <div class="mt-6 overflow-hidden rounded-card border border-line bg-surface"><app-pagination [page]="list.page()" [size]="list.size" [total]="list.total()" [totalPages]="list.totalPages()" (pageChange)="list.load($event)" /></div>
      }
    </div>`,
})
export class PublicEventsListComponent {
  private readonly api = inject(PublicApi);
  private readonly route = inject(ActivatedRoute);
  private readonly lang = inject(LangService);
  private readonly seo = inject(SeoService);
  private readonly site = inject(SiteStore);
  private readonly t = inject(TranslocoService);
  protected readonly scopes = ['UPCOMING', 'PAST', 'ALL'];
  protected readonly types = TYPES;
  protected scope = this.scopeFrom(this.route.snapshot.queryParamMap.get('scope'));
  protected type = '';
  protected q = '';
  protected readonly list = new PagedList<EventCard>((page, size) => this.api.events({ lang: this.lang.lang(), scope: this.scope, type: this.type, q: this.q, page, size }), 10);
  protected readonly onSearch = debounced((v: string) => { this.q = v.trim(); this.reload(); });

  constructor() {
    this.route.queryParamMap.subscribe((m) => { const s = this.scopeFrom(m.get('scope')); if (s !== this.scope) this.setScope(s); });
    effect(() => {
      const l = this.lang.lang();
      untracked(() => {
        this.list.load(0);
        this.seo.set({ title: this.t.translate('public.nav.events'), description: this.t.translate('public.eventsSubtitle'), path: '/events', lang: l, siteName: this.site.siteName });
      });
    });
  }

  private scopeFrom(v: string | null) { return this.scopes.includes(v ?? '') ? (v as string) : 'UPCOMING'; }
  protected setScope(s: string) { this.scope = s; this.reload(); }
  protected reload() { this.list.load(0); }
}
