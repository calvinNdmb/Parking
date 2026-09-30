// État dérivé : prix des parkings / de la voirie pour les réglages courants,
// expressions de couleur MapLibre, options les moins chères autour d'un point.
// Aucune dépendance au DOM : utilisable tel quel dans une app Expo.

import type { ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { Feature, FeatureCollection, Point } from 'geojson';
import { CATEGORY_COLORS, TIER_COLORS, TIER_TEXT } from './colors';
import type { VoirieData } from './data';
import { formatDuration, formatPrice, paidMinutes, quoteCarPark, quoteStreet, tierFor, type Quote, type Tier } from './pricing';
import { formatParisTime } from './time';
import type { CarPark, TariffTable, Vehicle, VoirieCategory } from './types';

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
  { id: 'voiture', label: 'Voiture', hint: 'Voiture thermique ≤ 1,6 t (ou électrique > 2 t : voir SUV)' },
  { id: 'suv', label: 'SUV / lourd', hint: 'Thermique ou hybride > 1,6 t, électrique > 2 t : tarif ×3 sur rue' },
  { id: 'electrique', label: 'Électrique', hint: 'Voiture électrique ≤ 2 t : gratuit sur rue' },
  { id: 'moto', label: 'Moto / scooter', hint: 'Deux-roues motorisé thermique (électrique : gratuit sur rue)' },
  { id: 'velo', label: 'Vélo', hint: 'Arceaux et emplacements vélo, parkings acceptant les vélos' },
];

export const CATEGORY_LABELS: Record<VoirieCategory, string> = {
  mixte: 'Payant mixte (résidents + visiteurs)',
  rotatif: 'Payant rotatif (visiteurs)',
  gratuit: 'Gratuit',
  moto: 'Places deux-roues motorisés',
  pmr: 'Place PMR (carte mobilité inclusion)',
  electrique: "Recharge Belib'",
  livraison: 'Aire de livraison',
  velo: 'Stationnement vélo',
};

export interface Settings {
  vehicle: Vehicle;
  minutes: number;
  /** null = « maintenant » */
  start: Date | null;
}

export const effectiveStart = (s: Settings) => s.start ?? new Date();
export const durationLabel = (min: number) => DURATIONS.find((d) => d.min === min)?.label ?? formatDuration(min);
export const vehicleLabel = (v: Vehicle) => VEHICLES.find((x) => x.id === v)?.label ?? v;

// ---------------------------------------------------------------------------
// Parkings
// ---------------------------------------------------------------------------
/** Style de bulle de prix (nom d'image du sprite : bubble-<style>). */
export type BubbleStyle = Tier | 'estimate' | 'sub' | 'velo' | 'moto';

export interface ParkQuote {
  price: number | null;
  approx: boolean;
  estimate: boolean;
  tier: Tier;
  /** null = pas de bulle (le « P » seul est affiché) */
  bubble: BubbleStyle | null;
  label: string;
  note?: string;
  /** Le parking est-il pertinent pour le véhicule choisi ? */
  relevant: boolean;
}

export function quoteParking(p: CarPark, s: Settings): ParkQuote {
  const none = (label: string, note: string, relevant = true): ParkQuote => ({ price: null, approx: false, estimate: false, tier: 'unknown', bubble: null, label, note, relevant });
  if (s.vehicle === 'velo') {
    if (p.veloAccess === false) return none('', 'Vélos non acceptés.', false);
    const month = p.subscriptions?.veloMonth ?? null;
    if (p.placesVelo || p.veloAccess || month != null) {
      return {
        price: null,
        approx: false,
        estimate: false,
        tier: 'unknown',
        bubble: 'velo',
        label: month != null ? `${formatPrice(month)}/mois` : p.placesVelo ? `${p.placesVelo} pl.` : 'Vélos',
        note: `Stationnement vélo${p.placesVelo ? ` : ${p.placesVelo} places` : ''}${month != null ? `, abonnement ${formatPrice(month)} par mois` : ''}.`,
        relevant: true,
      };
    }
    return none('', 'Pas d’information sur le stationnement vélo.', false);
  }
  if (!p.public) return { ...none('Abonnés', 'Réservé aux abonnés.'), bubble: 'sub' };
  if (s.vehicle === 'moto') {
    const q = quoteCarPark(p.motoPrices, s.minutes);
    if (q) {
      const tier = tierFor(q.price, s.minutes);
      return { price: q.price, approx: q.approx, estimate: false, tier, bubble: tier, label: `${q.approx ? '≈ ' : ''}${formatPrice(q.price)}`, relevant: true };
    }
    if (p.placesMoto || p.motoAccess) return { ...none('Motos', 'Deux-roues acceptés, tarif non publié.'), bubble: 'moto' };
    return none('', 'Tarif deux-roues non publié.', p.motoAccess !== false);
  }
  const q = quoteCarPark(p.prices, s.minutes);
  if (q) {
    const tier = tierFor(q.price, s.minutes);
    return { price: q.price, approx: q.approx, estimate: false, tier, bubble: tier, label: `${q.approx ? '≈ ' : ''}${formatPrice(q.price)}`, relevant: true };
  }
  if (p.estimate?.[60] != null) {
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
        bubble: 'estimate',
        label: `≈ ${formatPrice(price)}`,
        note: `Estimation : médiane des ${p.estimate.n} parkings tarifés à moins de ${p.estimate.radiusM / 1000} km (tarif non publié en open data).`,
        relevant: true,
      };
    }
  }
  return none('', 'Tarif non publié en open data.');
}

export interface ParkingPointProps {
  id: string;
  /** image du « P » : p-public, p-subscribers ou p-selected */
  p: string;
  /** image de la bulle de prix (vide = pas de bulle) */
  bubble: string;
  label: string;
  ink: string;
  sort: number;
}

export function parkingsFeatureCollection(
  parkings: CarPark[],
  quotes: Map<string, ParkQuote>,
  s: Settings,
  opts: { showSubscribers: boolean; selectedId: string | null },
): FeatureCollection<Point, ParkingPointProps> {
  const features: Feature<Point, ParkingPointProps>[] = [];
  for (const p of parkings) {
    const selected = p.id === opts.selectedId;
    const q = quotes.get(p.id)!;
    const reserved = !p.public || p.customersOnly === true;
    if (reserved && !opts.showSubscribers && !selected && s.vehicle !== 'velo') continue;
    if (!q.relevant && !selected) continue;
    const perHour = q.price == null ? 1000 : q.price / (s.minutes / 60);
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
      properties: {
        id: p.id,
        p: selected ? 'p-selected' : reserved ? 'p-subscribers' : 'p-public',
        // Parkings réservés : le « P » gris suffit (pas de bulle, sauf s'il est sélectionné).
        bubble: q.bubble && (q.bubble !== 'sub' || selected) ? `bubble-${q.bubble}${selected ? '-sel' : ''}` : '',
        label: q.bubble && (q.bubble !== 'sub' || selected) ? q.label : '',
        ink: q.bubble === 'estimate' ? TIER_TEXT.unknown : q.bubble === 'sub' || q.bubble === 'velo' || q.bubble === 'moto' ? '#ffffff' : TIER_TEXT[q.tier],
        sort: selected ? -1 : q.bubble === 'sub' ? 3000 : q.estimate ? 1500 + perHour : perHour,
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

// ---------------------------------------------------------------------------
// Voirie et zones
// ---------------------------------------------------------------------------
export function streetColor(cat: VoirieCategory, q: Quote, s: Settings): string {
  if (cat === 'velo') return CATEGORY_COLORS.velo;
  if (cat === 'pmr') return CATEGORY_COLORS.pmr;
  if (cat === 'livraison') return CATEGORY_COLORS.livraison;
  if (cat === 'electrique') return CATEGORY_COLORS.electrique;
  if (cat === 'moto' && s.vehicle !== 'moto') return CATEGORY_COLORS.moto;
  if (s.vehicle === 'velo') return TIER_COLORS.na;
  return TIER_COLORS[tierFor(q.price, s.minutes, q.allowed)];
}

/** Opacité des catégories selon le véhicule (on met en avant ce qui le concerne). */
function categoryOpacity(cat: VoirieCategory, vehicle: Vehicle): number {
  if (vehicle === 'velo') return cat === 'velo' ? 1 : 0.22;
  if (vehicle === 'moto') return cat === 'moto' ? 1 : cat === 'velo' ? 0.3 : cat === 'pmr' || cat === 'livraison' ? 0.5 : 0.85;
  switch (cat) {
    case 'moto':
      return 0.45;
    case 'velo':
      return 0.35;
    case 'livraison':
      return 0.55;
    case 'electrique':
      return vehicle === 'electrique' ? 1 : 0.7;
    case 'pmr':
      return 0.85;
    default:
      return 1;
  }
}

export interface StreetStyle {
  /** Couleur des emplacements : match sur la propriété k = catégorie × 10 + zone. */
  color: ExpressionSpecification;
  /** Opacité : match sur la propriété c = index de catégorie. */
  opacity: ExpressionSpecification;
  /** Couleur des zones tarifaires : match sur la propriété zone. */
  zoneColor: ExpressionSpecification;
  zoneQuotes: Record<number, Quote>;
}

export function streetStyle(s: Settings, tariffs: TariffTable, categories: VoirieCategory[]): StreetStyle {
  const start = effectiveStart(s);
  const colorPairs: (number | string)[] = [];
  const opacityPairs: number[] = [];
  categories.forEach((cat, c) => {
    for (const z of [0, 1, 2]) colorPairs.push(c * 10 + z, streetColor(cat, quoteStreet({ zone: z, category: cat, vehicle: s.vehicle, start, minutes: s.minutes, tariffs }), s));
    opacityPairs.push(c, categoryOpacity(cat, s.vehicle));
  });
  const zoneQuotes: Record<number, Quote> = {};
  const zoneVehicle: Vehicle = s.vehicle === 'velo' ? 'voiture' : s.vehicle;
  for (const z of [1, 2]) zoneQuotes[z] = quoteStreet({ zone: z, category: 'mixte', vehicle: zoneVehicle, start, minutes: s.minutes, tariffs });
  const zoneColor = (z: number) => (s.vehicle === 'velo' ? TIER_COLORS.free : TIER_COLORS[tierFor(zoneQuotes[z].price, s.minutes, zoneQuotes[z].allowed)]);
  return {
    color: ['match', ['get', 'k'], ...colorPairs, '#b8c0c9'] as unknown as ExpressionSpecification,
    opacity: ['match', ['get', 'c'], ...opacityPairs, 1] as unknown as ExpressionSpecification,
    zoneColor: ['match', ['get', 'zone'], 1, zoneColor(1), 2, zoneColor(2), '#b8c0c9'] as unknown as ExpressionSpecification,
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
  if (s.vehicle === 'velo') return `ZONE ${zone}\nVélo : gratuit`;
  if (!q.allowed) return `ZONE ${zone}\nmax 6 h sur rue`;
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
  /** classe de pastille : niveau de prix, 'estimate', 'unknown', 'na', 'velo', 'moto' */
  badge: string;
  distance: number;
  lon: number;
  lat: number;
}

export interface NearbyResult {
  street: NearbyOption[];
  parkings: NearbyOption[];
}

const WANTED: Record<Vehicle, VoirieCategory[]> = {
  voiture: ['mixte', 'rotatif', 'gratuit'],
  suv: ['mixte', 'rotatif', 'gratuit'],
  electrique: ['mixte', 'rotatif', 'gratuit', 'electrique'],
  moto: ['moto', 'mixte', 'rotatif', 'gratuit'],
  velo: ['velo'],
};

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
    const q = quotes.get(p.id)!;
    if (!q.relevant || (!p.public && s.vehicle !== 'velo')) continue;
    const d = distanceM(center, [p.lon, p.lat]);
    if (d > radiusM) continue;
    const special = q.bubble === 'velo' || q.bubble === 'moto';
    park.push({
      kind: 'parking',
      key: p.id,
      title: p.name,
      subtitle: `Parking${p.operator ? ` · ${p.operator}` : ''}${q.estimate ? ' · prix estimé' : q.price == null && !special ? ' · prix non publié' : ''}`,
      price: q.price,
      label: q.label || '?',
      badge: special ? q.bubble! : q.price == null ? 'unknown' : q.estimate ? 'estimate' : q.tier,
      distance: d,
      lon: p.lon,
      lat: p.lat,
    });
  }
  // Prix publiés d'abord (du moins cher au plus cher), puis estimations, puis inconnus.
  const rank = (o: NearbyOption) => (o.badge === 'velo' || o.badge === 'moto' ? 1 : o.price == null ? 3 : o.badge === 'estimate' ? 2 : 0);
  park.sort((a, b) => rank(a) - rank(b) || (a.price ?? 0) - (b.price ?? 0) || a.distance - b.distance);

  const street: NearbyOption[] = [];
  if (voirie) {
    const wanted = new Set(WANTED[s.vehicle]);
    const best = new Map<string, { i: number; d: number }>();
    const { centers } = voirie;
    const dLon = radiusM / M_LON;
    const dLat = radiusM / M_LAT;
    for (let i = 0; i < voirie.count; i++) {
      const lon = centers[i * 2];
      const lat = centers[i * 2 + 1];
      if (Math.abs(lon - center[0]) > dLon || Math.abs(lat - center[1]) > dLat) continue;
      const cat = voirie.category(i);
      if (!wanted.has(cat)) continue;
      const d = distanceM(center, [lon, lat]);
      if (d > radiusM) continue;
      const spot = voirie.spot(i);
      // mixte et rotatif ont le même prix visiteur : on ne garde que le plus proche des deux.
      // Vélo : l'emplacement le plus proche de chaque rue ; sinon le plus proche par catégorie et zone.
      const key = s.vehicle === 'velo' ? `velo:${spot.street}` : `${cat === 'rotatif' ? 'mixte' : cat}:${spot.zone}`;
      const prev = best.get(key);
      if (!prev || d < prev.d) best.set(key, { i, d });
    }
    const start = effectiveStart(s);
    const entries = [...best.values()].sort((a, b) => a.d - b.d).slice(0, s.vehicle === 'velo' ? 3 : 6);
    for (const { i, d } of entries) {
      const spot = voirie.spot(i);
      const q = quoteStreet({ zone: spot.zone, category: spot.cat, vehicle: s.vehicle, start, minutes: s.minutes, tariffs });
      street.push({
        kind: 'spot',
        key: i,
        title: spot.street || 'Stationnement sur voirie',
        subtitle: `${CATEGORY_LABELS[spot.cat].split(' (')[0]}${spot.zone && spot.cat !== 'velo' ? ` · zone ${spot.zone}` : ''} · ${spot.places} pl.`,
        price: q.price,
        label: !q.allowed ? 'Max 6 h' : q.price == null ? '—' : formatPrice(q.price),
        badge: spot.cat === 'velo' ? 'velo' : tierFor(q.price, s.minutes, q.allowed),
        distance: d,
        lon: spot.lon,
        lat: spot.lat,
      });
    }
    const allowed = (o: NearbyOption) => (o.badge === 'na' ? 1 : 0);
    street.sort((a, b) => allowed(a) - allowed(b) || (a.price ?? 99) - (b.price ?? 99) || a.distance - b.distance);
  }
  return { street: street.slice(0, 3), parkings: park.slice(0, 6) };
}

/** Libellé d'état « payant / gratuit maintenant » (heure de Paris). */
export function streetStatus(now: Date): { paid: boolean; text: string } {
  const paid = paidMinutes(now, 1) === 1;
  for (let m = 15; m <= 8 * 24 * 60; m += 15) {
    const t = new Date(Math.floor((now.getTime() + m * 60_000) / 900_000) * 900_000);
    if ((paidMinutes(t, 1) === 1) !== paid) {
      const when = formatParisTime(t, m > 20 * 60 ? 'weekday-time' : 'time');
      return { paid, text: `Stationnement sur rue ${paid ? 'payant' : 'gratuit'} jusqu'à ${when}` };
    }
  }
  return { paid, text: paid ? 'Stationnement sur rue payant' : 'Stationnement sur rue gratuit' };
}
