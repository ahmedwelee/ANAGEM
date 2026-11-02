import { SITE_TZ, isoToZoned, zonedToIso } from './zoned-time';

describe('zoned time (Africa/Casablanca)', () => {
  it('uses the Moroccan site zone', () => { expect(SITE_TZ).toBe('Africa/Casablanca'); });

  it('converts wall-clock time to an ISO instant (UTC+1 in winter)', () => {
    expect(zonedToIso('2026-12-12T09:30')).toBe('2026-12-12T08:30:00.000Z');
  });

  it('accepts a bare date as midnight local time', () => {
    expect(zonedToIso('2026-12-12')).toBe('2026-12-11T23:00:00.000Z');
  });

  it('rejects malformed input', () => {
    expect(zonedToIso('12/12/2026')).toBeNull();
    expect(zonedToIso('')).toBeNull();
  });

  it('round-trips between the instant and the datetime-local value', () => {
    expect(isoToZoned('2026-12-12T08:30:00.000Z')).toBe('2026-12-12T09:30');
    expect(isoToZoned(zonedToIso('2026-03-01T18:45'))).toBe('2026-03-01T18:45');
  });

  it('returns an empty string for missing values', () => {
    expect(isoToZoned(null)).toBe('');
    expect(isoToZoned(undefined)).toBe('');
  });
});
