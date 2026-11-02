import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiError } from '../../../core/api/models';
import { EventCard, PublicApi } from '../../../core/api/public-api';
import { LangService } from '../../../core/i18n/lang.service';
import { SeoService } from '../../../core/seo/seo.service';
import { SiteStore } from '../../../core/seo/site.store';
import { IconComponent } from '../../../shared/components/icon';
import { EventDatesPipe } from '../shared/event-dates.pipe';
import { ShareComponent, injectNotFound } from '../shared/public-ui';
import { stripHtml } from '../shared/util';

@Component({
  selector: 'app-public-event-detail',
  imports: [RouterLink, TranslocoPipe, IconComponent, EventDatesPipe, ShareComponent],
  template: `
    @if (error(); as err) {
      <div class="mx-auto my-24 max-w-md px-6 text-center"><span class="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-primary-soft text-2xl text-primary"><app-icon name="calendar-x" /></span>
        <h1 class="text-xl font-bold text-primary-dark">{{ (err.status === 404 ? 'public.eventNotFound' : 'public.loadError') | transloco }}</h1>
        <a [routerLink]="['/', lang.lang(), 'events']" class="btn btn-primary mt-5">{{ 'public.backToEvents' | transloco }}</a></div>
    } @else if (e(); as ev) {
      <article class="mx-auto w-[min(100%-2rem,60rem)] py-8 sm:py-12" [attr.lang]="ev.locale" [attr.dir]="ev.locale === 'ar' ? 'rtl' : 'ltr'">
        <nav class="mb-5 flex items-center gap-1.5 text-xs text-muted" [attr.aria-label]="'public.breadcrumb' | transloco" [attr.dir]="lang.dir()">
          <a [routerLink]="['/', lang.lang()]" class="hover:text-primary hover:underline">{{ 'public.nav.home' | transloco }}</a><app-icon name="chevron-right" class="rtl:-scale-x-100" /><a [routerLink]="['/', lang.lang(), 'events']" class="hover:text-primary hover:underline">{{ 'public.nav.events' | transloco }}</a></nav>
        <div class="mb-3 flex flex-wrap items-center gap-2 text-xs" [attr.dir]="lang.dir()"><span class="rounded-full bg-primary-soft px-2.5 py-0.5 font-bold text-primary">{{ 'eventType.' + ev.type | transloco }}</span>
          <span class="rounded-full px-2.5 py-0.5 font-bold" [class]="ev.timeStatus === 'ONGOING' ? 'bg-accent-soft text-accent' : ev.timeStatus === 'PAST' ? 'bg-line text-primary-dark' : 'bg-primary-soft text-primary'">{{ 'public.status.' + ev.timeStatus | transloco }}</span>
          @if (ev.fallback) { <span class="badge badge-review">{{ 'public.fallbackNote' | transloco: { lang: ('lang.' + ev.locale | transloco) } }}</span> }</div>
        <h1 class="text-[clamp(1.7rem,1.3rem+1.6vw,2.6rem)] leading-tight font-extrabold text-primary-dark rtl:leading-snug">{{ ev.title }}</h1>

        <div class="mt-6 grid gap-6 lg:grid-cols-[1fr_19rem]">
          <div>
            @if (ev.image; as img) { <figure class="mb-6"><img [src]="img.url" [alt]="img.altText ?? ''" class="max-h-[26rem] w-full rounded-card object-cover" fetchpriority="high" /></figure> }
            @if (ev.description) { <div class="rte-content text-[1.02rem]" [innerHTML]="ev.description"></div> }
            <div class="mt-8 border-t border-line pt-5" [attr.dir]="lang.dir()"><app-share [path]="'/' + lang.lang() + '/events/' + ev.slug" [title]="ev.title" /></div>
          </div>
          <aside class="space-y-4 self-start rounded-card border border-line bg-surface p-5 shadow-card" [attr.dir]="lang.dir()">
            <h2 class="text-sm font-bold tracking-wide text-primary-dark uppercase rtl:tracking-normal rtl:normal-case">{{ 'public.eventInfo' | transloco }}</h2>
            <dl class="space-y-3 text-sm">
              <div class="flex gap-3"><app-icon name="calendar" class="mt-0.5 text-lg text-primary" /><div><dt class="font-semibold text-primary-dark">{{ 'public.when' | transloco }}</dt><dd class="text-muted"><time [attr.datetime]="ev.startsAt">{{ ev | eventDates }}</time></dd></div></div>
              @if (ev.location) { <div class="flex gap-3"><app-icon name="map-pin" class="mt-0.5 text-lg text-primary" /><div><dt class="font-semibold text-primary-dark">{{ 'public.where' | transloco }}</dt><dd class="text-muted">{{ ev.location }}</dd></div></div> }
              @if (ev.organizer) { <div class="flex gap-3"><app-icon name="users" class="mt-0.5 text-lg text-primary" /><div><dt class="font-semibold text-primary-dark">{{ 'public.organizer' | transloco }}</dt><dd class="text-muted">{{ ev.organizer }}</dd></div></div> }
            </dl>
            <div class="flex flex-col gap-2 pt-1">
              @if (ev.registrationUrl && ev.timeStatus !== 'PAST') { <a [href]="ev.registrationUrl" target="_blank" rel="noopener noreferrer" class="btn btn-primary"><app-icon name="external-link" />{{ 'public.register' | transloco }}</a> }
              @if (ev.programDownloadUrl) { <a [href]="ev.programDownloadUrl" class="btn btn-secondary"><app-icon name="download" />{{ 'public.downloadProgram' | transloco }}</a> }
            </div>
          </aside>
        </div>
      </article>
    } @else {
      <div class="mx-auto w-[min(100%-2rem,60rem)] space-y-4 py-12" aria-busy="true"><div class="skeleton h-10 w-3/4"></div><div class="skeleton h-72"></div><div class="skeleton h-4"></div><div class="skeleton h-4 w-5/6"></div></div>
    }`,
})
export class PublicEventDetailComponent {
  private readonly api = inject(PublicApi);
  private readonly seo = inject(SeoService);
  private readonly site = inject(SiteStore);
  protected readonly lang = inject(LangService);
  private readonly notFound = injectNotFound();
  readonly slug = input.required<string>();
  protected readonly e = signal<EventCard | null>(null);
  protected readonly error = signal<ApiError | null>(null);

  constructor() {
    effect(() => {
      const slug = this.slug(), l = this.lang.lang();
      untracked(() => {
        this.e.set(null); this.error.set(null);
        this.api.eventDetail(slug, l).subscribe({
          next: (ev) => {
            this.e.set(ev);
            const url = this.seo.absolute(`/${l}/events/${ev.slug}`);
            this.seo.set({ title: ev.title, description: stripHtml(ev.description) || ev.location, path: `/events/${ev.slug}`, lang: l, image: ev.image?.url, type: 'website', siteName: this.site.siteName,
              jsonLd: { '@context': 'https://schema.org', '@type': 'Event', name: ev.title, startDate: ev.startsAt, endDate: ev.endsAt ?? undefined, inLanguage: ev.locale, url,
                eventStatus: 'https://schema.org/EventScheduled', eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
                location: ev.location ? { '@type': 'Place', name: ev.location } : undefined, organizer: { '@type': 'Organization', name: ev.organizer || this.site.siteName },
                image: ev.image ? [this.seo.absolute(ev.image.url)] : undefined, description: stripHtml(ev.description) || undefined } });
          },
          error: (err: ApiError) => { this.error.set(err); if (err.status === 404) this.notFound(); this.seo.set({ title: '', path: `/events/${slug}`, lang: l, noindex: true, siteName: this.site.siteName }); },
        });
      });
    });
  }
}
