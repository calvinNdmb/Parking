// Jours fériés en France métropolitaine (le stationnement de surface y est gratuit à Paris).

/** Dimanche de Pâques (algorithme de Meeus / Jones / Butcher). */
export function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

const cache = new Map<number, Set<string>>();
const key = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** Ensemble des jours fériés d'une année, au format « AAAA-MM-JJ ». */
export function holidays(year: number): Set<string> {
  const cached = cache.get(year);
  if (cached) return cached;
  const set = new Set<string>();
  for (const [m, d] of [
    [1, 1], // Jour de l'an
    [5, 1], // Fête du travail
    [5, 8], // Victoire 1945
    [7, 14], // Fête nationale
    [8, 15], // Assomption
    [11, 1], // Toussaint
    [11, 11], // Armistice
    [12, 25], // Noël
  ])
    set.add(key(year, m, d));
  const easter = easterSunday(year);
  const base = Date.UTC(year, easter.month - 1, easter.day);
  for (const offset of [1, 39, 50]) {
    // Lundi de Pâques, Ascension, Lundi de Pentecôte
    const dt = new Date(base + offset * 86_400_000);
    set.add(key(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()));
  }
  cache.set(year, set);
  return set;
}

export function isHoliday(dateKey: string): boolean {
  return holidays(Number(dateKey.slice(0, 4))).has(dateKey);
}
