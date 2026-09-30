import { describe, expect, it } from 'vitest';
import { formatParisTime, fromParisWallClock, parisOffsetMinutes, parisTime } from '../src/time';
import { formatNumber, formatPrice } from '../src/pricing';

// Référence : Intl (disponible dans Node), que le cœur n'utilise pas pour rester portable (Hermes).
const ref = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' });
const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
function intlParis(d: Date) {
  const p: Record<string, string> = {};
  for (const { type, value } of ref.formatToParts(d)) p[type] = value;
  return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour % 24, minute: +p.minute, weekday: WD[p.weekday] };
}

describe('heure de Paris sans Intl', () => {
  it('coïncide avec Intl sur 20 000 instants (2020-2035), changements d’heure compris', () => {
    let seed = 42;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const from = Date.UTC(2020, 0, 1);
    const to = Date.UTC(2035, 11, 31);
    for (let i = 0; i < 20_000; i++) {
      const d = new Date(from + Math.floor(rand() * (to - from)));
      expect(parisTime(d)).toEqual(intlParis(d));
    }
    // autour des bascules 2026 : 29 mars 01:00 UTC et 25 octobre 01:00 UTC
    for (const iso of ['2026-03-29T00:59:00Z', '2026-03-29T01:00:00Z', '2026-10-25T00:59:00Z', '2026-10-25T01:00:00Z']) {
      expect(parisTime(new Date(iso))).toEqual(intlParis(new Date(iso)));
    }
  });
  it('convertit une heure murale en instant', () => {
    expect(fromParisWallClock(2026, 7, 1, 10, 0).toISOString()).toBe('2026-07-01T08:00:00.000Z');
    expect(fromParisWallClock(2026, 1, 15, 10, 0).toISOString()).toBe('2026-01-15T09:00:00.000Z');
    expect(parisOffsetMinutes(Date.UTC(2026, 5, 1))).toBe(120);
  });
  it('formate sans Intl', () => {
    const d = new Date('2026-10-05T07:00:00Z'); // lundi 9h00 à Paris
    expect(formatParisTime(d)).toBe('09:00');
    expect(formatParisTime(d, 'weekday-time')).toBe('lundi 09:00');
    expect(formatParisTime(d, 'short-date-time')).toBe('lun. 5 09:00');
    expect(formatNumber(3650)).toBe('3 650');
    expect(formatPrice(3650)).toBe('3 650 €');
    expect(formatPrice(48.6)).toBe('48,60 €');
  });
});
