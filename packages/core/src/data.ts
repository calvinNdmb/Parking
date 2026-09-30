// Client de l'API de données statique (data/v1) et décodage de voirie.json.
// N'utilise que `fetch` : fonctionne dans le navigateur, Node et React Native.

import type { FeatureCollection, MultiPolygon, Point, Polygon } from 'geojson';
import type { CarPark, Meta, Spot, VoirieCategory } from './types';

/** Version du contrat de données publié (dossier data/v1). */
export const DATA_VERSION = 'v1';

/** Ordre des catégories dans voirie.json v1 (aussi publié dans meta.json → categories). */
export const VOIRIE_CATEGORIES_V1: VoirieCategory[] = ['mixte', 'rotatif', 'gratuit', 'moto', 'pmr', 'electrique', 'livraison', 'velo'];

export type VoirieRow = [number, number, number, number, number, number, number, number, number, number, number, number[]];

export interface VoirieFile {
  version: number;
  origin: [number, number];
  scale: number;
  columns?: string[];
  categories: VoirieCategory[];
  typsta: string[];
  streets: string[];
  zonesRes: string[];
  regimes: string[];
  hours: string[];
  rows: VoirieRow[];
}

export interface SpotProps {
  /** clé couleur = index de catégorie × 10 + zone tarifaire */
  k: number;
  /** index de catégorie */
  c: number;
}

export interface VoirieData {
  geojson: FeatureCollection<Polygon, SpotProps>;
  categories: VoirieCategory[];
  count: number;
  /** Centres des emplacements [lon0, lat0, lon1, lat1, …] */
  centers: Float64Array;
  category(index: number): VoirieCategory;
  spot(index: number): Spot;
}

/** Reconstruit les polygones (micro-degrés delta-encodés) et un index des centres. */
export function decodeVoirie(file: VoirieFile): VoirieData {
  const [ox, oy] = file.origin;
  const inv = 1 / file.scale;
  const n = file.rows.length;
  const centers = new Float64Array(n * 2);
  const features: VoirieData['geojson']['features'] = new Array(n);
  for (let i = 0; i < n; i++) {
    const row = file.rows[i];
    const deltas = row[11];
    const ring: [number, number][] = [];
    let x = 0;
    let y = 0;
    let sx = 0;
    let sy = 0;
    for (let j = 0; j < deltas.length; j += 2) {
      x += deltas[j];
      y += deltas[j + 1];
      const lon = ox + x * inv;
      const lat = oy + y * inv;
      ring.push([lon, lat]);
      sx += lon;
      sy += lat;
    }
    const count = ring.length || 1;
    centers[i * 2] = sx / count;
    centers[i * 2 + 1] = sy / count;
    ring.push(ring[0]);
    features[i] = { type: 'Feature', id: i, properties: { k: row[0] * 10 + row[2], c: row[0] }, geometry: { type: 'Polygon', coordinates: [ring] } };
  }
  return {
    geojson: { type: 'FeatureCollection', features },
    categories: file.categories,
    count: n,
    centers,
    category: (index) => file.categories[file.rows[index][0]],
    spot(index: number): Spot {
      const r = file.rows[index];
      return {
        index,
        cat: file.categories[r[0]],
        places: r[1],
        zone: r[2],
        arr: r[3],
        street: file.streets[r[4]],
        numFrom: r[5],
        numTo: r[6],
        zoneRes: file.zonesRes[r[7]],
        typsta: file.typsta[r[8]],
        regime: file.regimes[r[9]],
        hours: file.hours[r[10]],
        lon: centers[index * 2],
        lat: centers[index * 2 + 1],
      };
    },
  };
}

export interface BelibProps {
  name: string;
  address: string;
  pdc: number;
  kw: number;
  twoWheels: boolean;
  hours: string;
}

export type ZonesCollection = FeatureCollection<Polygon | MultiPolygon, { zone: number }>;
export type BelibCollection = FeatureCollection<Point, BelibProps>;
export type ArrondissementsCollection = FeatureCollection<Polygon | MultiPolygon, { ar: number; nom: string; label: string; coverage: number }>;

export interface CoreData {
  meta: Meta;
  zones: ZonesCollection;
  parkings: CarPark[];
  belib: BelibCollection;
}

type FetchLike = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/**
 * Client de l'API statique. `baseUrl` pointe sur le dossier qui contient
 * `data/v1/` (ex. « https://<compte>.github.io/Parking/ » ou « ./ » sur le web).
 */
export function createDataClient(baseUrl: string, fetchImpl: FetchLike = (url) => fetch(url)) {
  const root = `${baseUrl.replace(/\/?$/, '/')}data/${DATA_VERSION}/`;
  const get = async <T>(name: string): Promise<T> => {
    const res = await fetchImpl(root + name);
    if (!res.ok) throw new Error(`${name} : HTTP ${res.status}`);
    return (await res.json()) as T;
  };
  return {
    root,
    async loadCore(): Promise<CoreData> {
      const [meta, zones, parkingsFc, belib] = await Promise.all([
        get<Meta>('meta.json'),
        get<ZonesCollection>('zones.geojson'),
        get<FeatureCollection<Point, Omit<CarPark, 'lon' | 'lat'>>>('parkings.geojson'),
        get<BelibCollection>('belib.geojson'),
      ]);
      const parkings = parkingsFc.features.map((f) => ({ ...f.properties, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }) as CarPark);
      return { meta, zones, parkings, belib };
    },
    async loadVoirie(): Promise<VoirieData> {
      return decodeVoirie(await get<VoirieFile>('voirie.json'));
    },
    loadCoverageGrid: () => get<FeatureCollection<Polygon, { ok: number }>>('coverage-grid.geojson'),
    loadArrondissements: () => get<ArrondissementsCollection>('arrondissements.geojson'),
  };
}

export type DataClient = ReturnType<typeof createDataClient>;
