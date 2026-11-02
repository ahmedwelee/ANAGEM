/** Events are entered and shown in Moroccan time, whatever the browser's time zone is. */
export const SITE_TZ = 'Africa/Casablanca';

function offsetMinutes(utc: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(utc);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return (Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')) - Math.floor(utc.getTime() / 1000) * 1000) / 60000;
}

/** "2026-10-14T09:30" (wall-clock time in tz) -> ISO instant. Accepts "YYYY-MM-DD" (midnight) too. */
export function zonedToIso(local: string, tz = SITE_TZ): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(local);
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0));
  let t = guess - offsetMinutes(new Date(guess), tz) * 60000;
  t = guess - offsetMinutes(new Date(t), tz) * 60000; // second pass settles offset changes (Ramadan clock shift)
  return new Date(t).toISOString();
}

/** ISO instant -> "YYYY-MM-DDTHH:mm" wall-clock time in tz (value for <input type="datetime-local">). */
export function isoToZoned(iso: string | null | undefined, tz = SITE_TZ, dateOnly = false): string {
  if (!iso) return '';
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(iso));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  const date = `${g('year')}-${g('month')}-${g('day')}`;
  return dateOnly ? date : `${date}T${g('hour')}:${g('minute')}`;
}
