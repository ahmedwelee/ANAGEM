import { Pipe, PipeTransform, inject } from '@angular/core';
import { LangService } from '../../../core/i18n/lang.service';

/** "14–15 octobre 2026" / "14 oct. 2026, 10:00" for an event, in Moroccan time and the page language. */
@Pipe({ name: 'eventDates', pure: false })
export class EventDatesPipe implements PipeTransform {
  private readonly lang = inject(LangService);

  transform(e: { startsAt: string; endsAt: string | null; allDay: boolean; timezone?: string }, mode: 'long' | 'short' = 'long'): string {
    const tz = e.timezone ?? 'Africa/Casablanca';
    const a = new Date(e.startsAt), b = e.endsAt ? new Date(e.endsAt) : null;
    const dateOpts: Intl.DateTimeFormatOptions = { timeZone: tz, day: 'numeric', month: mode === 'long' ? 'long' : 'short', year: 'numeric' };
    const full: Intl.DateTimeFormatOptions = e.allDay ? dateOpts : { ...dateOpts, hour: '2-digit', minute: '2-digit' };
    const f = new Intl.DateTimeFormat(this.lang.locale(), full);
    const sameDay = !!b && new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(a) === new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(b);
    if (!b || (sameDay && e.allDay)) return f.format(a);
    return typeof f.formatRange === 'function' ? f.formatRange(a, b) : `${f.format(a)} – ${f.format(b)}`;
  }
}

type EventLike = { startsAt: string; endsAt: string | null; allDay: boolean; timezone?: string };
const dayIn = (iso: string, tz: string) => Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, day: 'numeric' }).format(new Date(iso)));

/** "14" or "14–15" (day numbers in Moroccan time) for the date tile of an event. */
@Pipe({ name: 'eventDay' })
export class EventDayPipe implements PipeTransform {
  transform(e: EventLike): string {
    const tz = e.timezone ?? 'Africa/Casablanca';
    const a = dayIn(e.startsAt, tz), b = e.endsAt ? dayIn(e.endsAt, tz) : a;
    return b !== a && new Date(e.endsAt!).getTime() - new Date(e.startsAt).getTime() < 15 * 86_400_000 ? `${a}–${b}` : String(a);
  }
}

/** Short upper-case month for the date tile. */
@Pipe({ name: 'eventMonth', pure: false })
export class EventMonthPipe implements PipeTransform {
  private readonly lang = inject(LangService);
  transform(e: EventLike): string {
    return new Intl.DateTimeFormat(this.lang.locale(), { timeZone: e.timezone ?? 'Africa/Casablanca', month: 'short' }).format(new Date(e.startsAt)).replace(/\./g, '').toUpperCase();
  }
}
