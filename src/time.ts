// Heure légale de Paris, indépendamment du fuseau du navigateur.

const PARIS_TZ = 'Europe/Paris';
const partsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: PARIS_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  weekday: 'short',
  hourCycle: 'h23',
});
const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };

export interface ParisTime {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  /** 0 = dimanche … 6 = samedi */
  weekday: number;
}

export function parisTime(date: Date): ParisTime {
  const p: Record<string, string> = {};
  for (const { type, value } of partsFormatter.formatToParts(date)) p[type] = value;
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour) % 24,
    minute: Number(p.minute),
    weekday: WEEKDAYS[p.weekday] ?? 0,
  };
}

/** Clé de date « AAAA-MM-JJ » (heure de Paris). */
export function parisDateKey(t: ParisTime): string {
  return `${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}`;
}

/**
 * Convertit une date/heure « murale » de Paris (ex. saisie dans un champ
 * datetime-local) en instant absolu, en tenant compte de l'heure d'été.
 */
export function fromParisWallClock(year: number, month: number, day: number, hour: number, minute: number): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  // Deux passes suffisent pour converger, y compris autour des changements d'heure.
  let ts = guess;
  for (let i = 0; i < 2; i++) {
    const t = parisTime(new Date(ts));
    const asUtc = Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute);
    ts += guess - asUtc;
  }
  return new Date(ts);
}
