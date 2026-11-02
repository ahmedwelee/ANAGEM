import { Component, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiError } from '../../../core/api/models';
import { PublicApi } from '../../../core/api/public-api';
import { LangService } from '../../../core/i18n/lang.service';
import { SeoService } from '../../../core/seo/seo.service';
import { SiteStore } from '../../../core/seo/site.store';
import { IconComponent } from '../../../shared/components/icon';
import { ErrorStateComponent } from '../../../shared/components/states';
import { PageBannerComponent, injectNotFound } from '../shared/public-ui';
import { mediaUrl, stripHtml } from '../shared/util';

interface Item { name?: string; text?: string }
/** What a CMS page may contain; unknown fields are ignored so new pages can be added from the admin without code. */
interface PageContent {
  title?: string; intro?: string; body?: string;
  objectivesTitle?: string; objectives?: Item[]; structureTitle?: string; bodies?: Item[];
  categoriesTitle?: string; categories?: Item[]; joinTitle?: string; join?: string; statutesMediaId?: string | null;
}

/** One component for every static page (About, Members, Legal, Privacy): the route's data.slug picks the CMS section. */
@Component({
  selector: 'app-cms-page',
  imports: [RouterLink, TranslocoPipe, IconComponent, PageBannerComponent, ErrorStateComponent],
  template: `
    @if (error(); as e) {
      @if (e.status === 404) { <div class="mx-auto my-24 max-w-md px-6 text-center"><h1 class="text-xl font-bold text-primary-dark">{{ 'errors.notFoundTitle' | transloco }}</h1><a [routerLink]="['/', lang.lang()]" class="btn btn-primary mt-5">{{ 'public.backHome' | transloco }}</a></div> }
      @else { <div class="my-16"><app-error-state [message]="e.message" (retry)="load()" /></div> }
    } @else if (c(); as page) {
      <app-page-banner [title]="page.title ?? ''" [subtitle]="page.intro ?? null" />
      <div class="mx-auto my-10 w-[min(100%-2rem,60rem)] space-y-12">
        @if (page.objectives?.length) {
          <section><h2 class="mb-5 text-xl font-extrabold text-primary-dark">{{ page.objectivesTitle }}</h2>
            <ol class="grid gap-3 sm:grid-cols-2">@for (o of page.objectives; track $index) { <li class="flex gap-3 rounded-card border border-line bg-surface p-4"><span class="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-white tabular-nums">{{ $index + 1 }}</span><p class="text-sm leading-relaxed">{{ o.text }}</p></li> }</ol></section>
        }
        @if (page.bodies?.length) {
          <section><h2 class="mb-5 text-xl font-extrabold text-primary-dark">{{ page.structureTitle }}</h2>
            <ul class="grid gap-4 sm:grid-cols-2">@for (b of page.bodies; track $index) { <li class="rounded-card border border-line bg-surface p-5 shadow-card"><h3 class="font-bold text-primary-dark">{{ b.name }}</h3><p class="mt-1.5 text-sm text-muted">{{ b.text }}</p></li> }</ul></section>
        }
        @if (page.categories?.length) {
          <section><h2 class="mb-5 text-xl font-extrabold text-primary-dark">{{ page.categoriesTitle }}</h2>
            <ul class="grid gap-4 sm:grid-cols-2">@for (b of page.categories; track $index) { <li class="rounded-card border border-line bg-surface p-5 shadow-card"><h3 class="font-bold text-primary-dark">{{ b.name }}</h3><p class="mt-1.5 text-sm text-muted">{{ b.text }}</p></li> }</ul></section>
        }
        @if (page.join) {
          <section class="rounded-card bg-gradient-to-br from-primary to-primary-deep p-6 text-white sm:p-8"><h2 class="text-xl font-extrabold">{{ page.joinTitle }}</h2><p class="mt-2 max-w-3xl text-white/90">{{ page.join }}</p>
            <a [routerLink]="['/', lang.lang(), 'contact']" class="btn mt-5 bg-white text-primary-dark hover:bg-primary-soft"><app-icon name="mail" />{{ 'public.contactUs' | transloco }}</a></section>
        }
        @if (page.body) { <div class="rte-content text-[1.02rem]" [innerHTML]="page.body"></div> }
        @else if (isEmpty(page)) {
          <div class="flex gap-3 rounded-card border border-dashed border-line-strong bg-surface p-6 text-sm text-muted"><app-icon name="info" class="mt-0.5 text-lg text-primary" /><p>{{ 'public.pageEmpty' | transloco }}</p></div>
        }
        @if (page.statutesMediaId; as sid) {
          <section class="flex flex-wrap items-center gap-4 rounded-card border border-line bg-surface p-5 shadow-card"><span class="grid size-12 place-items-center rounded-xl bg-primary-soft text-2xl text-primary"><app-icon name="file-text" /></span>
            <div class="min-w-0 flex-1"><h2 class="font-bold text-primary-dark">{{ 'public.statutes' | transloco }}</h2><p class="text-sm text-muted">{{ 'public.statutesHint' | transloco }}</p></div>
            <a [href]="media(sid)" target="_blank" rel="noopener" class="btn btn-primary"><app-icon name="download" />{{ 'public.download' | transloco }}</a></section>
        }
      </div>
    } @else {
      <div class="mx-auto my-12 w-[min(100%-2rem,60rem)] space-y-4" aria-busy="true"><div class="skeleton h-12 w-2/3"></div><div class="skeleton h-40"></div><div class="skeleton h-40"></div></div>
    }`,
})
export class CmsPageComponent {
  private readonly api = inject(PublicApi);
  private readonly seo = inject(SeoService);
  private readonly site = inject(SiteStore);
  private readonly slug = inject(ActivatedRoute).snapshot.data['slug'] as string;
  protected readonly lang = inject(LangService);
  private readonly notFound = injectNotFound();
  protected readonly c = signal<PageContent | null>(null);
  protected readonly error = signal<ApiError | null>(null);

  constructor() {
    effect(() => { this.lang.lang(); untracked(() => this.load()); });
  }

  protected load() {
    const l = this.lang.lang();
    this.error.set(null);
    this.api.page(this.slug, l).subscribe({
      next: (p) => {
        const c = p.content as PageContent;
        this.c.set(c);
        this.seo.set({ title: c.title ?? '', description: c.intro || stripHtml(c.body), path: `/${this.slug}`, lang: l, siteName: this.site.siteName });
      },
      error: (e: ApiError) => { this.error.set(e); if (e.status === 404) this.notFound(); this.seo.set({ title: '', path: `/${this.slug}`, lang: l, noindex: true, siteName: this.site.siteName }); },
    });
  }
  protected media(id: string) { return mediaUrl(id, '#'); }
  protected isEmpty(p: PageContent) { return !p.objectives?.length && !p.bodies?.length && !p.categories?.length && !p.join; }
}
