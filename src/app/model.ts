// État dérivé : prix des parkings / de la voirie pour les réglages courants,
// expressions de couleur MapLibre, options les moins chères autour d'un point.

import type { ExpressionSpecification } from 'maplibre-gl';
import type { Feature, FeatureCollection, Point } from 'geojson';
import { formatDuration, formatPrice, paidMinutes, quoteCarPark, quoteStreet, tierFor, type Quote, type Tier } from '../pricing';
import { PIN_TEXT, TIER_COLORS, type PinStyle } from '../map/icons';
import type { VoirieData } from '../data';
import type { CarPark, TariffTable, Vehicle, VoirieCategory } from '../types';

export const DURATIONS = [
  { min: 30, label: '30 min' },
  { min: 60, label: '1 h' },
  { min: 120, label: '2 h' },
  { min: 180, label: '3 h' },
  { min: 240, label: '4 h' },
  { min: 360, label: '6 h' },
  { min: 600, label: '10 h' },
  { min: 1440, label: '24 h' },
] as const;

export const VEHICLES: { id: Vehicle; label: string; hint: string }[] = [
  { id: 'voiture', label: 'Voiture', hint: 'Véhicule thermique ≤ 1,6 t ou électrique > 2 t exclu' },
  { id: 'suv', label: 'SUV / lourd', hint: 'Thermique ou hybride > 1,6 t, électrique > 2 t : tarif ×3 en voirie' },
  { id: 'moto', label: '2-roues', hint: 'Moto, scooter (thermique)' },
  { id: 'electrique', label: 'Électrique', hint: 'Voiture électrique ≤ 2 t : gratuit en voirie' },
];

export const CATEGORY_LABELS: Record<VoirieCategory, string> = {
  mixte: 'Payant mixte (résidents + visiteurs)',
  rotatif: 'Payant rotatif (visiteurs)',
  gratuit: 'Gratuit',
  moto: 'Deux-roues motorisés',
  pmr: 'Place PMR (carte mobilité inclusion)',
  electrique: "Recharge Belib'",
  livraison: 'Aire de livraison',
};

export const SPECIAL_COLORS = { pmr: '#3478f6', livraison: '#8e98a4', electrique: '#00a6c8', moto: '#9b7bf2' } as const;

export interface Settings {
  vehicle: Vehicle;
  minutes: number;
  /** null = « maintenant » */
  start: Date | null;
}

export const effectiveStart = (s: Settings) => s.start ?? new Date();
export const durationLabel = (min: number) => DURATIONS.find((d) => d.min === min)?.label ?? formatDuration(min);

// ---------------------------------------------------------------------------
// Parkings
// ---------------------------------------------------------------------------
export interface ParkQuote {
  price: number | null;
  approx: boolean;
  estimate: boolean;
  tier: Tier;
  pin: PinStyle;
  label: string;
  note?: string;
}

export function quoteParking(p: CarPark, s: Settings): ParkQuote {
  if (!p.public) return { price: null, approx: false, estimate: false, tier: 'unknown', pin: 'sub', label: 'Abonnés' };
  const table = s.vehicle === 'moto' ? p.motoPrices : p.prices;
  const q = quoteCarPark(table, s.minutes);
  if (q) {
    const tier = tierFor(q.price, s.minutes);
    return { price: q.price, approx: q.approx, estimate: false, tier, pin: tier, label: `${q.approx ? '≈ ' : ''}${formatPrice(q.price)}` };
  }
  if (s.vehicle !== 'moto' && p.estimate?.[60] != null) {
    const est: Record<string, number> = { 60: p.estimate[60] };
    if (p.estimate[1440] != null) est[1440] = p.estimate[1440];
    const e = quoteCarPark(est, s.minutes);
    if (e) {
      // Arrondi au demi-euro : une estimation ne doit pas afficher une fausse précision.
      const price = Math.max(0.5, Math.round(e.price * 2) / 2);
      return {
        price,
        approx: true,
        estimate: true,
        tier: tierFor(price, s.minutes),
        pin: 'estimate',
        label: `≈ ${formatPrice(price)}`,
        note: `Estimation : médiane des ${p.estimate.n} parkings tarifés à moins de ${p.estimate.radiusM / 1000} km (tarif non publié en open data).`,
      };
    }
  }
  return {
    price: null,
    approx: false,
    estimate: false,
    tier: 'unknown',
    pin: 'unknown',
    label: '?',
    note: s.vehicle === 'moto' && p.prices ? 'Tarif deux-roues non publié.' : 'Tarif non publié en open data.',
  };
}

export interface PinProps {
  id: string;
  label: string;
  icon: string;
  ink: string;
  dot: string;
  sort: number;
}

export function parkingsFeatureCollection(
  parkings: CarPark[],
  quotes: Map<string, ParkQuote>,
  s: Settings,
  opts: { showSubscribers: boolean; selectedId: string | null },
): FeatureCollection<Point, PinProps> {
  const features: Feature<Point, PinProps>[] = [];
  for (const p of parkings) {
    if (!p.public && !opts.showSubscribers && p.id !== opts.selectedId) continue;
    const q = quotes.get(p.id)!;
    const selected = p.id === opts.selectedId;
    const perHour = q.price == null ? 1000 : q.price / (s.minutes / 60);
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
      properties: {
        id: p.id,
        label: q.label,
        icon: `pin-${q.pin}${selected ? '-sel' : ''}`,
        ink: PIN_TEXT[q.pin],
        dot: q.pin === 'sub' ? '#61708a' : q.pin === 'unknown' || q.pin === 'estimate' ? '#9aa4b1' : TIER_COLORS[q.tier],
        sort: selected ? -1 : q.pin === 'sub' ? 3000 : q.estimate ? 1500 + perHour : perHour,
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

// ---------------------------------------------------------------------------
// Voirie et zones
// ---------------------------------------------------------------------------
export function streetColor(cat: VoirieCategory, q: Quote, s: Settings): string {
  if (cat === 'pmr') return SPECIAL_COLORS.pmr;
  if (cat === 'livraison') return SPECIAL_COLORS.livraison;
  if (cat === 'electrique') return SPECIAL_COLORS.electrique;
  if (cat === 'moto' && s.vehicle !== 'moto') return SPECIAL_COLORS.moto;
  return TIER_COLORS[tierFor(q.price, s.minutes, q.allowed)];
}

export interface StreetStyle {
  color: ExpressionSpecification;
  opacity: ExpressionSpecification;
  zoneColor: ExpressionSpecification;
  zoneQuotes: Record<number, Quote>;
}

export function streetStyle(s: Settings, tariffs: TariffTable, categories: VoirieCategory[]): StreetStyle {
  const start = effectiveStart(s);
  const pairs: (number | string)[] = [];
  categories.forEach((cat, c) => {
    for (const z of [0, 1, 2]) pairs.push(c * 10 + z, streetColor(cat, quoteStreet({ zone: z, category: cat, vehicle: s.vehicle, start, minutes: s.minutes, tariffs }), s));
  });
  const idx = (cat: VoirieCategory) => categories.indexOf(cat);
  const zoneQuotes: Record<number, Quote> = {};
  for (const z of [1, 2]) zoneQuotes[z] = quoteStreet({ zone: z, category: 'mixte', vehicle: s.vehicle, start, minutes: s.minutes, tariffs });
  return {
    color: ['match', ['get', 'k'], ...pairs, '#b8c0c9'] as unknown as ExpressionSpecification,
    opacity: [
      'match',
      ['get', 'c'],
      idx('moto'),
      s.vehicle === 'moto' ? 1 : 0.45,
      idx('livraison'),
      0.55,
      idx('electrique'),
      s.vehicle === 'electrique' ? 1 : 0.7,
      idx('pmr'),
      0.85,
      1,
    ] as ExpressionSpecification,
    zoneColor: ['match', ['get', 'zone'], 1, TIER_COLORS[tierFor(zoneQuotes[1].price, s.minutes, zoneQuotes[1].allowed)], 2, TIER_COLORS[tierFor(zoneQuotes[2].price, s.minutes, zoneQuotes[2].allowed)], '#b8c0c9'] as ExpressionSpecification,
    zoneQuotes,
  };
}

/** Points d'ancrage des étiquettes de zones (la zone 2 forme un anneau autour de la zone 1). */
const ZONE_LABEL_POINTS: [number, [number, number]][] = [
  [1, [2.3415, 48.8625]],
  [2, [2.3486, 48.8925]],
  [2, [2.3595, 48.8265]],
  [2, [2.4035, 48.8645]],
  [2, [2.2905, 48.8405]],
  [2, [2.2735, 48.8645]],
];

export function zoneLabel(zone: number, q: Quote, s: Settings): string {
  const d = durationLabel(s.minutes);
  if (!q.allowed) return `ZONE ${zone}\nmax 6 h en voirie`;
  if (q.price === 0) return `ZONE ${zone}\n${s.vehicle === 'electrique' ? 'Gratuit (VE ≤ 2 t)' : `Gratuit · ${d}`}`;
  return `ZONE ${zone}\n${d} = ${formatPrice(q.price)}`;
}

export function zoneLabelsFeatureCollection(style: StreetStyle, s: Settings): FeatureCollection<Point, { label: string; zone: number }> {
  return {
    type: 'FeatureCollection',
    features: ZONE_LABEL_POINTS.map(([zone, coordinates]) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates },
      properties: { zone, label: zoneLabel(zone, style.zoneQuotes[zone], s) },
    })),
  };
}

// ---------------------------------------------------------------------------
// Options les moins chères autour d'un point
// ---------------------------------------------------------------------------
const M_LON = 111_320 * Math.cos((48.8566 * Math.PI) / 180);
const M_LAT = 110_574;
export const distanceM = (a: [number, number], b: [number, number]) => Math.hypot((a[0] - b[0]) * M_LON, (a[1] - b[1]) * M_LAT);

export interface NearbyOption {
  kind: 'parking' | 'spot';
  key: string | number;
  title: string;
  subtitle: string;
  price: number | null;
  label: string;
  tier: Tier;
  approx: boolean;
  estimate: boolean;
  allowed: boolean;
  distance: number;
  lon: number;
  lat: number;
}

export interface NearbyResult {
  street: NearbyOption[];
  parkings: NearbyOption[];
}

export function nearbyOptions(
  center: [number, number],
  s: Settings,
  parkings: CarPark[],
  quotes: Map<string, ParkQuote>,
  voirie: VoirieData | null,
  tariffs: TariffTable,
  radiusM = 600,
): NearbyResult {
  const park: NearbyOption[] = [];
  for (const p of parkings) {
    if (!p.public) continue;
    const d = distanceM(center, [p.lon, p.lat]);
    if (d > radiusM) continue;
    const q = quotes.get(p.id)!;
    park.push({
      kind: 'parking',
      key: p.id,
      title: p.name,
      subtitle: `Parking${p.operator ? ` · ${p.operator}` : ''}${q.estimate ? ' · prix estimé' : q.price == null ? ' · prix non publié' : ''}`,
      price: q.price,
      label: q.price == null ? '?' : q.label,
      tier: q.tier,
      approx: q.approx,
      estimate: q.estimate,
      allowed: true,
      distance: d,
      lon: p.lon,
      lat: p.lat,
    });
  }
  // Prix publiés d'abord (du moins cher au plus cher), puis estimations, puis inconnus.
  const rank = (o: NearbyOption) => (o.price == null ? 2 : o.estimate ? 1 : 0);
  park.sort((a, b) => rank(a) - rank(b) || (a.price ?? 0) - (b.price ?? 0) || a.distance - b.distance);

  const street: NearbyOption[] = [];
  if (voirie) {
    // Emplacement le plus proche pour chaque catégorie utile (et chaque zone tarifaire).
    const wanted = new Set<VoirieCategory>(
      s.vehicle === 'moto' ? ['moto', 'mixte', 'rotatif', 'gratuit'] : s.vehicle === 'electrique' ? ['mixte', 'rotatif', 'gratuit', 'electrique'] : ['mixte', 'rotatif', 'gratuit'],
    );
    const best = new Map<string, { i: number; d: number }>();
    const { centers } = voirie;
    const dLon = radiusM / M_LON;
    const dLat = radiusM / M_LAT;
    for (let i = 0; i < voirie.count; i++) {
      const lon = centers[i * 2];
      const lat = centers[i * 2 + 1];
      if (Math.abs(lon - center[0]) > dLon || Math.abs(lat - center[1]) > dLat) continue;
      const spot = voirie.spot(i);
      if (!wanted.has(spot.cat)) continue;
      const d = distanceM(center, [lon, lat]);
      if (d > radiusM) continue;
      // mixte et rotatif ont le même prix visiteur : on ne garde que le plus proche des deux
      const key = `${spot.cat === 'rotatif' ? 'mixte' : spot.cat}:${spot.zone}`;
      const prev = best.get(key);
      if (!prev || d < prev.d) best.set(key, { i, d });
    }
    const start = effectiveStart(s);
    for (const { i, d } of best.values()) {
      const spot = voirie.spot(i);
      const q = quoteStreet({ zone: spot.zone, category: spot.cat, vehicle: s.vehicle, start, minutes: s.minutes, tariffs });
      street.push({
        kind: 'spot',
        key: i,
        title: spot.street || 'Stationnement sur voirie',
        subtitle: `${CATEGORY_LABELS[spot.cat].split(' (')[0]}${spot.zone ? ` · zone ${spot.zone}` : ''} · ${spot.places} pl.`,
        price: q.price,
        label: !q.allowed ? 'Max 6 h' : q.price == null ? '—' : formatPrice(q.price),
        tier: tierFor(q.price, s.minutes, q.allowed),
        approx: false,
        estimate: false,
        allowed: q.allowed,
        distance: d,
        lon: spot.lon,
        lat: spot.lat,
      });
    }
    street.sort((a, b) => Number(b.allowed) - Number(a.allowed) || (a.price ?? 99) - (b.price ?? 99) || a.distance - b.distance);
  }
  return { street: street.slice(0, 3), parkings: park.slice(0, 6) };
}

/** Libellé d'état « payant / gratuit maintenant » (heure de Paris). */
export function streetStatus(now: Date): { paid: boolean; text: string } {
  const paid = paidMinutes(now, 1) === 1;
  // cherche le prochain changement d'état (≤ 8 jours, pas de 15 min)
  for (let m = 15; m <= 8 * 24 * 60; m += 15) {
    const t = new Date(now.getTime() + m * 60_000);
    if ((paidMinutes(t, 1) === 1) !== paid) {
      const when = new Intl.DateTimeFormat('fr-FR', {
        timeZone: 'Europe/Paris',
        weekday: m > 20 * 60 ? 'long' : undefined,
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(Math.floor(t.getTime() / 900_000) * 900_000));
      return paid ? { paid, text: `Voirie payante jusqu'à ${when}` } : { paid, text: `Voirie gratuite jusqu'à ${when}` };
    }
  }
  return { paid, text: paid ? 'Voirie payante' : 'Voirie gratuite' };
}
