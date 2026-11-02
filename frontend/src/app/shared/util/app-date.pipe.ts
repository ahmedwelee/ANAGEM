import { Pipe, PipeTransform, inject } from '@angular/core';
import { LangService } from '../../core/i18n/lang.service';

/** Formats ISO dates in the admin language: {{ iso | appDate }} (date), 'datetime', or 'relative'. Impure so it follows language changes. */
@Pipe({ name: 'appDate', pure: false })
export class AppDatePipe implements PipeTransform {
  private readonly lang = inject(LangService);

  transform(value: string | null | undefined, mode: 'date' | 'datetime' | 'month' = 'date'): string {
    if (!value) return '—';
    const d = value.length === 7 ? new Date(value + '-01T00:00:00') : new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    const opts: Intl.DateTimeFormatOptions = mode === 'month' ? { month: 'short', year: '2-digit' }
      : mode === 'datetime' ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' };
    return new Intl.DateTimeFormat(this.lang.locale(), opts).format(d);
  }
}
