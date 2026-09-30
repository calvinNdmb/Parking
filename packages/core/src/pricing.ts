// Moteur de prix : stationnement sur voirie (grille officielle progressive de
// la Ville de Paris) et parkings (grilles publiées par les exploitants).

import { isHoliday } from './holidays';
import { parisDateKey, parisTime } from './time';
import type { PriceTable, TariffTable, Vehicle, VoirieCategory } from './types';

/** Règles du stationnement payant de surface (paris.fr, vérifiées en septembre 2026). */
export const RULES = {
  /** Payant du lundi (1) au samedi (6), hors jours fériés. */
  paidWeekdays: [1, 2, 3, 4, 5, 6],
  paidStartMin: 9 * 60,
  paidEndMin: 20 * 60,
  /** Paiement fractionnable par tranches de 15 minutes. */
  stepMin: 15,
  /** Durée maximale pour un visiteur au même endroit. */
  maxVisitorMin: 6 * 60,
  residentDay: 1.5,
  residentWeek: 9,
  motoResidentDay: 0.75,
  motoResidentWeek: 4.5,
  /** Seuils « véhicule lourd » (masse en service, champ G de la carte grise). */
  suvThermalKg: 1600,
  suvElectricKg: 2000,
} as const;

export interface Quote {
  /** Prix en € pour la durée demandée (null = inconnu ou sans objet). */
  price: number | null;
  /** Le véhicule peut-il stationner ici pour cette durée ? */
  allowed: boolean;
  /** Prix estimé / interpolé plutôt que publié. */
  approx?: boolean;
  /** Minutes réellement payantes sur le créneau (voirie). */
  paidMinutes?: number;
  reason?: string;
  note?: string;
}

/** Nombre de minutes payantes (lun.–sam. 9h–20h hors fériés, heure de Paris) dans [start, start + minutes[. */
export function paidMinutes(start: Date, minutes: number): number {
  const t = parisTime(start);
  let minuteOfDay = t.hour * 60 + t.minute;
  let weekday = t.weekday;
  let y = t.year;
  let m = t.month;
  let d = t.day;
  const isPaidDay = () => (RULES.paidWeekdays as readonly number[]).includes(weekday) && !isHoliday(parisDateKey({ ...t, year: y, month: m, day: d }));
  let paidDay = isPaidDay();
  let paid = 0;
  for (let i = 0; i < minutes; i++) {
    if (paidDay && minuteOfDay >= RULES.paidStartMin && minuteOfDay < RULES.paidEndMin) paid++;
    minuteOfDay++;
    if (minuteOfDay === 1440) {
      // Les changements d'heure ont lieu la nuit du samedi au dimanche, hors plage payante.
      minuteOfDay = 0;
      weekday = (weekday + 1) % 7;
      const next = new Date(Date.UTC(y, m - 1, d + 1));
      y = next.getUTCFullYear();
      m = next.getUTCMonth() + 1;
      d = next.getUTCDate();
      paidDay = isPaidDay();
    }
  }
  return paid;
}

export function isPaidNow(now: Date): boolean {
  return paidMinutes(now, 1) === 1;
}

const cents = (v: number) => Math.round(v * 100) / 100;

/** Coût progressif : chaque quart d'heure coûte le quart du tarif de l'heure en cours. */
export function progressiveCost(slots: number[], minutes: number): number {
  const quarters = Math.ceil(minutes / RULES.stepMin);
  let cost = 0;
  for (let q = 0; q < quarters; q++) cost += slots[Math.min(Math.floor(q / 4), slots.length - 1)] / 4;
  return cents(cost);
}

export function streetGrid(tariffs: TariffTable, zone: number, vehicle: Vehicle, saturday = false): number[] | null {
  const z = tariffs[String(zone)];
  if (!z || vehicle === 'velo') return null;
  if (vehicle === 'suv') return z.suv;
  if (vehicle === 'moto') return saturday ? z.motoSamedi : z.moto;
  return saturday ? z.vlSamedi : z.vl;
}

/** Forfait post-stationnement = coût des 6 heures maximales. */
export function fps(tariffs: TariffTable, zone: number, vehicle: Vehicle): number | null {
  const grid = streetGrid(tariffs, zone, vehicle === 'electrique' || vehicle === 'velo' ? 'voiture' : vehicle);
  return grid ? progressiveCost(grid, RULES.maxVisitorMin) : null;
}

export interface StreetQuoteInput {
  zone: number;
  category: VoirieCategory;
  vehicle: Vehicle;
  start: Date;
  minutes: number;
  tariffs: TariffTable;
}

export function quoteStreet({ zone, category, vehicle, start, minutes, tariffs }: StreetQuoteInput): Quote {
  if (vehicle === 'velo') {
    return category === 'velo'
      ? { price: 0, allowed: true, note: 'Stationnement vélo gratuit (arceaux, sans limite de durée).' }
      : { price: null, allowed: false, reason: 'Emplacement non prévu pour les vélos : utilisez les arceaux ou un parking vélo.' };
  }
  switch (category) {
    case 'velo':
      return { price: null, allowed: false, reason: 'Emplacement réservé aux vélos.' };
    case 'pmr':
      return { price: null, allowed: false, reason: 'Place réservée aux titulaires de la carte mobilité inclusion (gratuit pour eux).' };
    case 'livraison':
      return { price: null, allowed: false, reason: 'Aire de livraison : arrêt réservé aux opérations de livraison.' };
    case 'electrique':
      return vehicle === 'electrique'
        ? { price: null, allowed: true, note: "Place de recharge Belib' : stationnement le temps de la recharge, tarif selon la borne." }
        : { price: null, allowed: false, reason: 'Place réservée aux véhicules électriques en recharge.' };
    case 'gratuit':
      return { price: 0, allowed: true, note: 'Stationnement gratuit sur cet emplacement.' };
    case 'moto':
      if (vehicle !== 'moto') return { price: null, allowed: false, reason: 'Place réservée aux deux-roues motorisés.' };
      break;
    default:
      break;
  }
  if (vehicle === 'electrique') {
    return { price: 0, allowed: true, note: 'Gratuit pour les véhicules électriques de 2 t ou moins, sans limite de durée (reconnaissance automatique de la plaque).' };
  }
  const saturday = parisTime(start).weekday === 6;
  const grid = streetGrid(tariffs, zone, vehicle, saturday);
  if (!grid) return { price: null, allowed: true, reason: 'Zone tarifaire inconnue.' };
  const paid = paidMinutes(start, minutes);
  if (paid === 0) return { price: 0, allowed: true, paidMinutes: 0, note: 'Gratuit sur ce créneau (dimanche, jour férié ou hors 9h–20h).' };
  if (paid > RULES.maxVisitorMin) {
    return {
      price: progressiveCost(grid, RULES.maxVisitorMin),
      allowed: false,
      paidMinutes: paid,
      reason: `Au-delà de 6 h payantes, le stationnement visiteur n'est pas autorisé (forfait post-stationnement : ${progressiveCost(grid, RULES.maxVisitorMin)} €).`,
    };
  }
  const note = paid < minutes ? `Temps payant sur ce créneau : ${formatDuration(paid)}.` : undefined;
  return { price: progressiveCost(grid, paid), allowed: true, paidMinutes: paid, note };
}

/**
 * Prix d'un parking pour une durée donnée à partir de sa grille publiée.
 * Entre deux paliers connus, on prolonge la pente du palier précédent (facturation
 * au quart d'heure) sans dépasser le palier suivant ; au-delà de 24 h, on cumule
 * des journées.
 */
export function quoteCarPark(table: PriceTable | null | undefined, minutes: number): { price: number; approx: boolean } | null {
  if (!table) return null;
  const points = Object.entries(table)
    .map(([k, v]) => [Number(k), v] as [number, number])
    .filter(([k, v]) => Number.isFinite(k) && k > 0 && v != null && Number.isFinite(v))
    .sort((a, b) => a[0] - b[0]);
  if (!points.length) return null;
  const m = Math.ceil(minutes / RULES.stepMin) * RULES.stepMin;
  const day = points.find(([k]) => k === 1440)?.[1];
  if (m > 1440 && day != null) {
    const days = Math.floor(m / 1440);
    const rest = m - days * 1440;
    const restQuote = rest ? quoteCarPark(table, rest) : null;
    return { price: cents(days * day + Math.min(day, restQuote?.price ?? 0)), approx: Boolean(restQuote?.approx) };
  }
  const exact = points.find(([k]) => k === m);
  if (exact) return { price: exact[1], approx: false };
  const nextIdx = points.findIndex(([k]) => k > m);
  if (nextIdx === 0) {
    const [k, v] = points[0];
    return { price: cents((v * m) / k), approx: true };
  }
  if (nextIdx === -1) {
    // Au-delà du dernier palier publié, on n'extrapole que modérément (les parkings plafonnent à la journée).
    const last = points[points.length - 1][0];
    if (m > last * 4 || m - last > 360) return null;
  }
  const prevIdx = nextIdx === -1 ? points.length - 1 : nextIdx - 1;
  const [a, pa] = points[prevIdx];
  const before = points[prevIdx - 1];
  const slope = before ? (pa - before[1]) / (a - before[0]) : pa / a;
  let price = pa + Math.max(0, slope) * (m - a);
  if (nextIdx !== -1) price = Math.min(points[nextIdx][1], price);
  return { price: cents(Math.max(pa, price)), approx: true };
}

export type Tier = 'free' | 't1' | 't2' | 't3' | 't4' | 't5' | 'na' | 'unknown';
/** Seuils en €/heure équivalente pour la couleur des prix. */
export const TIER_THRESHOLDS = [3, 4.5, 5.5, 7] as const;

export function tierFor(price: number | null | undefined, minutes: number, allowed = true): Tier {
  if (!allowed) return 'na';
  if (price == null) return 'unknown';
  if (price === 0) return 'free';
  const perHour = price / (minutes / 60);
  const i = TIER_THRESHOLDS.findIndex((t) => perHour <= t);
  return (['t1', 't2', 't3', 't4'] as const)[i] ?? 't5';
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

/** Nombre à la française sans Intl : « 3 650 », « 5,40 ». */
export function formatNumber(value: number, decimals = 0): string {
  const [int, dec] = Math.abs(value).toFixed(decimals).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
  return `${value < 0 ? '-' : ''}${grouped}${dec ? `,${dec}` : ''}`;
}

/** « 5,40 € », « 12 € », « 3 650 € », « Gratuit ». */
export function formatPrice(price: number | null | undefined, { free = 'Gratuit' } = {}): string {
  if (price == null) return '—';
  if (price === 0) return free;
  return `${formatNumber(price, Number.isInteger(price) ? 0 : 2)} €`;
}
