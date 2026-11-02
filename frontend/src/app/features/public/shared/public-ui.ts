import { RESPONSE_INIT, Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NewsCard, PublicationCard, ResourceCard } from '../../../core/api/public-api';
import { LangService } from '../../../core/i18n/lang.service';
import { SeoService } from '../../../core/seo/seo.service';
import { IconComponent } from '../../../shared/components/icon';
import { AppDatePipe } from '../../../shared/util/app-date.pipe';
import { imageOf, stripHtml } from './util';

/** Marks the server response as 404 (real status for crawlers); no-op in the browser. Call from a constructor. */
export function markNotFound(): void { injectNotFound()(); }

/** Captures the response in the injection context and returns a function that can be called later, e.g. from an HTTP error callback. */
export function injectNotFound(): () => void {
  const init = inject(RESPONSE_INIT, { optional: true });
  return () => { if (init) init.status = 404; };
}

@Component({
  selector: 'app-page-banner',
  imports: [RouterLink, TranslocoPipe, IconComponent],
  template: `
    <section class="relative isolate overflow-hidden bg-gradient-to-r from-primary-dark to-primary text-white rtl:bg-gradient-to-l">
      <svg class="pointer-events-none absolute inset-0 -z-10 size-full opacity-[.12]" viewBox="0 0 600 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g fill="none" stroke="#fff" stroke-width="1.2">@for (i of [0,1,2,3,4,5]; track i) { <path [attr.d]="'M-20 ' + (150 - i * 26) + 'c110-70 210 30 330-10s170-100 330-50'" /> }</g></svg>
      <div class="mx-auto w-[min(100%-2rem,1240px)] py-10 sm:py-12">
        <nav class="mb-3 flex items-center gap-1.5 text-xs text-white/75" [attr.aria-label]="'public.breadcrumb' | transloco">
          <a [routerLink]="['/', lang.lang()]" class="hover:text-white hover:underline">{{ 'public.nav.home' | transloco }}</a><app-icon name="chevron-right" class="rtl:-scale-x-100" /><span aria-current="page" class="text-white">{{ crumb() ?? title() }}</span>
        </nav>
        <h1 class="text-[clamp(1.6rem,1.2rem+1.6vw,2.4rem)] leading-tight font-extrabold rtl:leading-snug">{{ title() }}</h1>
        @if (subtitle()) { <p class="mt-2 max-w-3xl text-white/85">{{ subtitle() }}</p> }
      </div>
    </section>`,
})
export class PageBannerComponent {
  protected readonly lang = inject(LangService);
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  readonly crumb = input<string | null>(null);
}

@Component({
  selector: 'app-news-card',
  imports: [RouterLink, TranslocoPipe, AppDatePipe, IconComponent],
  template: `
    <article class="group flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface transition duration-500 hover:-translate-y-1 hover:border-line-strong hover:shadow-pop">
      <a [routerLink]="['/', lang.lang(), 'news', n().slug]" tabindex="-1" aria-hidden="true" class="relative block aspect-[16/10] overflow-hidden bg-primary-soft">
        @if (img(); as src) { <img [src]="src" [alt]="n().image?.altText ?? ''" loading="lazy" width="480" height="300" class="size-full object-cover transition duration-700 group-hover:scale-105" /> }
        @else { <span class="absolute inset-0 grid place-items-center bg-gradient-to-br from-primary to-primary-deep text-white/80"><app-icon name="newspaper" class="text-4xl" /></span> }
      </a>
      <div class="flex flex-1 flex-col p-4">
        <div class="mb-2 flex flex-wrap items-center gap-2 text-xs">@if (n().category; as c) { <span class="rounded-full bg-primary-soft px-2 py-0.5 font-bold text-primary">{{ c.name }}</span> }<time class="text-muted" [attr.datetime]="n().publishedAt">{{ n().publishedAt | appDate }}</time></div>
        <h3 class="text-base leading-snug font-bold text-primary-dark"><a [routerLink]="['/', lang.lang(), 'news', n().slug]" class="hover:text-primary">{{ n().title }}</a></h3>
        @if (n().summary) { <p class="mt-2 line-clamp-3 text-sm text-muted">{{ n().summary }}</p> }
        <a [routerLink]="['/', lang.lang(), 'news', n().slug]" class="mt-auto inline-flex items-center gap-1.5 pt-3 text-sm font-semibold text-primary hover:underline">{{ 'public.readMore' | transloco }}<app-icon name="arrow-right" class="rtl:-scale-x-100" /></a>
      </div>
    </article>`,
})
export class NewsCardComponent {
  protected readonly lang = inject(LangService);
  readonly n = input.required<NewsCard>();
  protected img() { return imageOf(this.n().image); }
}

@Component({
  selector: 'app-publication-card',
  imports: [RouterLink, TranslocoPipe, IconComponent],
  template: `
    <article class="group flex h-full gap-4 rounded-card border border-line bg-surface p-4 transition duration-500 hover:-translate-y-1 hover:border-line-strong hover:shadow-pop">
      <a [routerLink]="['/', lang.lang(), 'publications', p().id]" tabindex="-1" aria-hidden="true" class="relative block aspect-[3/4] w-24 shrink-0 self-start overflow-hidden rounded-[3px_8px_8px_3px] bg-gradient-to-br from-primary to-primary-deep shadow-card sm:w-28">
        @if (img(); as src) { <img [src]="src" [alt]="p().coverImage?.altText ?? ''" loading="lazy" class="size-full object-cover" /> }
        @else { <span class="absolute inset-0 flex flex-col justify-between p-2 text-[10px] leading-tight font-bold text-white"><app-icon name="book-open" class="text-lg opacity-80" /><span class="line-clamp-4">{{ p().title }}</span></span> }
      </a>
      <div class="flex min-w-0 flex-1 flex-col">
        <div class="mb-1 flex flex-wrap items-center gap-2 text-xs"><span class="rounded-full bg-primary-soft px-2 py-0.5 font-bold text-primary">{{ 'kind.' + p().kind | transloco }}</span><span class="text-muted tabular-nums">{{ p().year }}@if (p().issueNumber) { · N° {{ p().issueNumber }} }</span></div>
        <h3 class="text-base leading-snug font-bold text-primary-dark"><a [routerLink]="['/', lang.lang(), 'publications', p().id]" class="hover:text-primary">{{ p().title }}</a></h3>
        @if (excerpt()) { <p class="mt-1.5 line-clamp-3 text-sm text-muted">{{ excerpt() }}</p> }
        <div class="mt-auto flex flex-wrap gap-2 pt-3">
          <a [routerLink]="['/', lang.lang(), 'publications', p().id]" class="btn btn-secondary btn-sm">{{ 'public.viewDetails' | transloco }}</a>
          @if (p().pdfDownloadUrl) { <a [href]="p().pdfDownloadUrl" class="btn btn-ghost btn-sm"><app-icon name="download" />PDF</a> }
        </div>
      </div>
    </article>`,
})
export class PublicationCardComponent {
  protected readonly lang = inject(LangService);
  readonly p = input.required<PublicationCard>();
  protected img() { return imageOf(this.p().coverImage); }
  protected excerpt() { return stripHtml(this.p().description, 160); }
}

@Component({
  selector: 'app-resource-card',
  imports: [TranslocoPipe, IconComponent],
  template: `
    <article class="flex h-full flex-col rounded-card border border-line bg-surface p-4 transition duration-500 hover:-translate-y-1 hover:border-line-strong hover:shadow-pop">
      <div class="mb-2 flex items-center gap-3"><span class="grid size-11 place-items-center rounded-xl bg-primary-soft text-xl text-primary"><app-icon [name]="r().file ? (r().file?.contentType === 'application/pdf' ? 'file-text' : 'file-image') : 'link'" /></span>
        <span class="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary">{{ 'resourceKind.' + r().kind | transloco }}</span></div>
      <h3 class="text-base leading-snug font-bold text-primary-dark">{{ r().title }}</h3>
      @if (excerpt()) { <p class="mt-1.5 line-clamp-3 text-sm text-muted">{{ excerpt() }}</p> }
      <div class="mt-auto flex flex-wrap gap-2 pt-3">
        @if (r().downloadUrl) { <a [href]="r().downloadUrl" class="btn btn-primary btn-sm"><app-icon name="download" />{{ 'public.download' | transloco }}</a> }
        @if (r().file) { <a [href]="r().file?.url" target="_blank" rel="noopener" class="btn btn-secondary btn-sm"><app-icon name="eye" />{{ 'public.open' | transloco }}</a> }
        @if (r().externalUrl) { <a [href]="r().externalUrl" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm"><app-icon name="external-link" />{{ 'public.openLink' | transloco }}</a> }
      </div>
    </article>`,
})
export class ResourceCardComponent {
  readonly r = input.required<ResourceCard>();
  protected excerpt() { return stripHtml(this.r().description, 160); }
}

/** Share on social networks, e-mail, or copy the link. */
@Component({
  selector: 'app-share',
  imports: [IconComponent, TranslocoPipe],
  template: `
    <div class="flex flex-wrap items-center gap-2 text-sm"><span class="font-semibold text-primary-dark">{{ 'public.share' | transloco }}</span>
      <a class="grid size-9 place-items-center rounded-full bg-primary-soft text-primary transition hover:bg-primary hover:text-white" target="_blank" rel="noopener noreferrer" [href]="'https://www.facebook.com/sharer/sharer.php?u=' + enc(url())" aria-label="Facebook"><app-icon name="facebook" /></a>
      <a class="grid size-9 place-items-center rounded-full bg-primary-soft text-primary transition hover:bg-primary hover:text-white" target="_blank" rel="noopener noreferrer" [href]="'https://twitter.com/intent/tweet?url=' + enc(url()) + '&text=' + enc(title())" aria-label="X"><app-icon name="x-social" /></a>
      <a class="grid size-9 place-items-center rounded-full bg-primary-soft text-primary transition hover:bg-primary hover:text-white" target="_blank" rel="noopener noreferrer" [href]="'https://www.linkedin.com/sharing/share-offsite/?url=' + enc(url())" aria-label="LinkedIn"><app-icon name="linkedin" /></a>
      <a class="grid size-9 place-items-center rounded-full bg-primary-soft text-primary transition hover:bg-primary hover:text-white" [href]="'mailto:?subject=' + enc(title()) + '&body=' + enc(url())" [attr.aria-label]="'public.byEmail' | transloco"><app-icon name="mail" /></a>
      <button type="button" class="grid size-9 place-items-center rounded-full bg-primary-soft text-primary transition hover:bg-primary hover:text-white" (click)="copy()" [attr.aria-label]="'public.copyLink' | transloco"><app-icon [name]="copied() ? 'circle-check' : 'copy'" /></button></div>`,
})
export class ShareComponent {
  private readonly seo = inject(SeoService);
  readonly path = input.required<string>();
  readonly title = input('');
  protected readonly copied = signal(false);
  protected url() { return this.seo.absolute(this.path()); }
  protected enc(s: string) { return encodeURIComponent(s); }
  protected copy() { navigator.clipboard?.writeText(this.url()).then(() => { this.copied.set(true); setTimeout(() => this.copied.set(false), 2000); }, () => undefined); }
}
