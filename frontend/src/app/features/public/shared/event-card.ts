import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { EventCard } from '../../../core/api/public-api';
import { LangService } from '../../../core/i18n/lang.service';
import { IconComponent } from '../../../shared/components/icon';
import { EventDatesPipe, EventDayPipe, EventMonthPipe } from './event-dates.pipe';
import { stripHtml } from './util';

@Component({
  selector: 'app-event-card',
  imports: [RouterLink, TranslocoPipe, IconComponent, EventDatesPipe, EventDayPipe, EventMonthPipe],
  template: `
    <article class="group flex h-full gap-4 rounded-card border border-line bg-surface p-4 transition duration-500 hover:-translate-y-1 hover:border-line-strong hover:shadow-pop">
      <div class="flex size-16 shrink-0 flex-col items-center justify-center self-start rounded-xl bg-gradient-to-br from-primary to-primary-deep text-white shadow-card" aria-hidden="true">
        <span class="text-xl leading-none font-extrabold tabular-nums">{{ e() | eventDay }}</span><span class="mt-0.5 text-[11px] font-bold tracking-wider">{{ e() | eventMonth }}</span></div>
      <div class="flex min-w-0 flex-1 flex-col">
        <div class="mb-1 flex flex-wrap items-center gap-2 text-xs"><span class="rounded-full bg-primary-soft px-2 py-0.5 font-bold text-primary">{{ 'eventType.' + e().type | transloco }}</span>
          @if (e().timeStatus !== 'UPCOMING') { <span class="rounded-full px-2 py-0.5 font-bold" [class]="e().timeStatus === 'ONGOING' ? 'bg-accent-soft text-accent' : 'bg-line text-primary-dark'">{{ 'public.status.' + e().timeStatus | transloco }}</span> }</div>
        <h3 class="text-base leading-snug font-bold text-primary-dark"><a [routerLink]="['/', lang.lang(), 'events', e().slug]" class="hover:text-primary">{{ e().title }}</a></h3>
        <p class="mt-1.5 flex items-center gap-1.5 text-sm text-muted"><app-icon name="calendar" class="text-primary" /><time [attr.datetime]="e().startsAt">{{ e() | eventDates }}</time></p>
        @if (e().location) { <p class="mt-1 flex items-center gap-1.5 text-sm text-muted"><app-icon name="map-pin" class="text-primary" />{{ e().location }}</p> }
        @if (excerpt()) { <p class="mt-2 line-clamp-2 text-sm text-muted">{{ excerpt() }}</p> }
        <a [routerLink]="['/', lang.lang(), 'events', e().slug]" class="mt-auto inline-flex items-center gap-1.5 pt-3 text-sm font-semibold text-primary hover:underline">{{ 'public.viewDetails' | transloco }}<app-icon name="arrow-right" class="rtl:-scale-x-100" /></a>
      </div>
    </article>`,
})
export class EventCardComponent {
  protected readonly lang = inject(LangService);
  readonly e = input.required<EventCard>();
  protected excerpt() { return stripHtml(this.e().description, 140); }
}
