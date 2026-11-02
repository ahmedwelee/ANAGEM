import { TestBed } from '@angular/core/testing';
import { provideAppTesting } from '../../../../testing/test-providers';
import { LangService } from '../../../core/i18n/lang.service';
import { EventDatesPipe, EventDayPipe, EventMonthPipe } from './event-dates.pipe';

describe('event date pipes', () => {
  const ev = (startsAt: string, endsAt: string | null, allDay = true) => ({ startsAt, endsAt, allDay, timezone: 'Africa/Casablanca' });
  beforeEach(() => TestBed.configureTestingModule({ providers: provideAppTesting() }));
  const pipes = () => TestBed.runInInjectionContext(() => ({ dates: new EventDatesPipe(), day: new EventDayPipe(), month: new EventMonthPipe() }));

  it('shows one day number for a single day and a range for a multi-day event', () => {
    const { day } = pipes();
    expect(day.transform(ev('2026-10-14T00:00:00Z', null))).toBe('14');
    expect(day.transform(ev('2026-10-13T23:00:00Z', '2026-10-15T22:00:00Z'))).toBe('14–15');
  });

  it('uses Moroccan time for the day, whatever the browser zone is', () => {
    // 23:30 UTC on the 14th is already the 15th at UTC+1
    expect(pipes().day.transform(ev('2026-10-14T23:30:00Z', null, false))).toBe('15');
  });

  it('does not turn an open-ended or very long event into a "1–30" tile', () => {
    expect(pipes().day.transform(ev('2026-01-01T00:00:00Z', '2026-12-31T00:00:00Z'))).toBe('1');
  });

  it('formats the month for the current language', async () => {
    const lang = TestBed.inject(LangService);
    await lang.set('fr');
    expect(pipes().month.transform(ev('2026-10-14T00:00:00Z', null))).toBe('OCT');
    await lang.set('en');
    expect(pipes().month.transform(ev('2026-12-14T00:00:00Z', null))).toBe('DEC');
  });

  it('writes a readable long date and a range', async () => {
    await TestBed.inject(LangService).set('fr');
    const { dates } = pipes();
    expect(dates.transform(ev('2026-10-14T00:00:00Z', null))).toMatch(/14 octobre 2026/);
    expect(dates.transform(ev('2026-10-13T23:00:00Z', '2026-10-15T22:00:00Z'))).toMatch(/14.*15.*octobre.*2026/);
  });

  it('includes the time for events that are not all-day', async () => {
    await TestBed.inject(LangService).set('en');
    expect(pipes().dates.transform(ev('2026-10-14T08:30:00Z', null, false), 'short')).toMatch(/09:30/);
  });
});
