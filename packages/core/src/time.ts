// Heure légale de Paris calculée sans Intl : même résultat dans un navigateur,
// Node et React Native (Hermes), quel que soit le fuseau de l'appareil.
// Europe/Paris = UTC+1 (CET), UTC+2 (CEST) du dernier dimanche de mars 01:00 UTC
// au dernier dimanche d'octobre 01:00 UTC.

export interface ParisTime {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  /** 0 = dimanche … 6 = samedi */
  weekday: number;
}

const MIN = 60_000;

/** Instant (ms UTC) du dernier dimanche du mois (0-11) à 01:00 UTC. */
function lastSundayAt1Utc(year: number, month: number): number {
  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  return Date.UTC(year, month, lastDay.getUTCDate() - lastDay.getUTCDay(), 1, 0);
}

/** Décalage de Paris par rapport à UTC, en minutes, à un instant donné. */
export function parisOffsetMinutes(timestamp: number): number {
  const year = new Date(timestamp).getUTCFullYear();
  return timestamp >= lastSundayAt1Utc(year, 2) && timestamp < lastSundayAt1Utc(year, 9) ? 120 : 60;
}

export function parisTime(date: Date): ParisTime {
  const local = new Date(date.getTime() + parisOffsetMinutes(date.getTime()) * MIN);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    hour: local.getUTCHours(),
    minute: local.getUTCMinutes(),
    weekday: local.getUTCDay(),
  };
}

/** Clé de date « AAAA-MM-JJ » (heure de Paris). */
export function parisDateKey(t: Pick<ParisTime, 'year' | 'month' | 'day'>): string {
  return `${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}`;
}

/**
 * Instant correspondant à une date/heure « murale » de Paris (ex. saisie
 * utilisateur). Heure ambiguë d'octobre : première occurrence (heure d'été) ;
 * heure inexistante de mars : décalée d'une heure.
 */
export function fromParisWallClock(year: number, month: number, day: number, hour: number, minute: number): Date {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const summer = wall - 120 * MIN;
  if (parisOffsetMinutes(summer) === 120) return new Date(summer);
  return new Date(wall - 60 * MIN);
}

const WEEKDAYS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const pad = (n: number) => String(n).padStart(2, '0');

/** « 20:00 », « lundi 09:00 » ou « lun. 4 14:00 » (heure de Paris), sans Intl. */
export function formatParisTime(date: Date, style: 'time' | 'weekday-time' | 'short-date-time' = 'time'): string {
  const t = parisTime(date);
  const hm = `${pad(t.hour)}:${pad(t.minute)}`;
  if (style === 'time') return hm;
  if (style === 'weekday-time') return `${WEEKDAYS_FR[t.weekday]} ${hm}`;
  return `${WEEKDAYS_FR[t.weekday].slice(0, 3)}. ${t.day} ${hm}`;
}
