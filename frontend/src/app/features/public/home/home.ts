import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiError } from '../../../core/api/models';
import { HomepageData, PublicApi } from '../../../core/api/public-api';
import { LangService } from '../../../core/i18n/lang.service';
import { SeoService } from '../../../core/seo/seo.service';
import { SiteStore } from '../../../core/seo/site.store';
import { IconComponent } from '../../../shared/components/icon';
import { AppDatePipe } from '../../../shared/util/app-date.pipe';
import { MoroccoMapComponent } from '../shared/morocco-map';
import { RevealDirective } from '../shared/reveal.directive';
import { imageOf, isExternal, linkTo, mediaUrl, stripHtml } from '../shared/util';
import { EventDatesPipe, EventDayPipe, EventMonthPipe } from '../shared/event-dates.pipe';

@Component({
  selector: 'app-home',
  imports: [RouterLink, TranslocoPipe, IconComponent, MoroccoMapComponent, RevealDirective, AppDatePipe, EventDatesPipe, EventDayPipe, EventMonthPipe],
  templateUrl: './home.html',
})
export class HomeComponent {
  private readonly api = inject(PublicApi);
  private readonly seo = inject(SeoService);
  private readonly site = inject(SiteStore);
  protected readonly lang = inject(LangService);
  protected readonly data = signal<HomepageData | null>(null);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly imageOf = imageOf;
  protected readonly isExternal = isExternal;
  protected readonly stripHtml = stripHtml;

  protected readonly hero = computed(() => this.data()?.sections['HERO'] ?? null);
  protected readonly words = computed(() => String(this.hero()?.title ?? '').split(/\s+/).filter(Boolean));
  protected readonly heroImage = computed(() => mediaUrl(this.hero()?.heroImageMediaId, '/img/village.jpg'));
  protected readonly sideImage = computed(() => mediaUrl(this.hero()?.sideImageMediaId, '/img/beach.jpg'));
  protected readonly firstUpcoming = computed(() => this.data()?.events.find((e) => e.timeStatus !== 'PAST')?.id ?? null);

  constructor() {
    // Reload when the visitor switches language: the page component stays alive across /fr → /ar
    effect(() => { this.lang.lang(); untracked(() => this.load()); });
  }

  protected load() {
    const l = this.lang.lang();
    this.error.set(null);
    this.api.homepage(l).subscribe({
      next: (d) => {
        this.data.set(d);
        this.seo.set({ title: this.site.siteName, description: String(d.sections['HERO']?.description ?? this.site.text('seo.default_description')), path: '', lang: l, siteName: this.site.siteName,
          jsonLd: { '@context': 'https://schema.org', '@type': 'Organization', name: this.site.siteName, alternateName: 'ANAGEM', logo: this.seo.absolute('/anagem-logo-white.png'), url: this.seo.absolute(`/${l}`) } });
      },
      error: (e: ApiError) => this.error.set(e),
    });
  }

  protected link(url: string | null | undefined) { return linkTo(this.lang.lang(), url); }
  protected featuredLabel(e: { timeStatus: string }) { return e.timeStatus === 'UPCOMING' ? 'public.event.next' : e.timeStatus === 'ONGOING' ? 'public.event.ongoing' : 'public.event.latest'; }
}
