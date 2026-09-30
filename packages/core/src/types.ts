export type Vehicle = 'voiture' | 'suv' | 'electrique' | 'moto' | 'velo';

/** Catégories d'emplacements sur rue, dans l'ordre des index de voirie.json (API v1). */
export type VoirieCategory = 'mixte' | 'rotatif' | 'gratuit' | 'moto' | 'pmr' | 'electrique' | 'livraison' | 'velo';

/** Prix par tranche horaire (6 tranches) : [h1, h2, …, h6] en €. */
export interface ZoneTariffs {
  vl: number[];
  vlSamedi: number[];
  suv: number[];
  moto: number[];
  motoSamedi: number[];
}
export type TariffTable = Record<string, ZoneTariffs>;

/** Grille d'un parking : durée en minutes → prix en €. */
export type PriceTable = Record<string, number>;

export type CarParkKind = 'underground' | 'multi-storey' | 'rooftop' | 'surface';

export interface CarPark {
  id: string;
  name: string;
  address: string | null;
  arr: number | null;
  operator: string | null;
  source: string;
  sources: string[];
  url: string | null;
  phone: string | null;
  public: boolean;
  customersOnly?: boolean;
  /** Parking fermé / couvert (souterrain, en élévation) : affiché avec un « P ». */
  covered: boolean;
  kind: CarParkKind | null;
  hours: string | null;
  places: number | null;
  placesPmr: number | null;
  placesMoto: number | null;
  placesVelo: number | null;
  placesEv: number | null;
  motoAccess: boolean | null;
  veloAccess: boolean | null;
  ev?: boolean;
  heightMax: number | null;
  relay: boolean;
  prices: PriceTable | null;
  pricesDate: string | null;
  pricesSource: string | null;
  motoPrices: PriceTable | null;
  estimate?: { 60: number | null; 1440: number | null; n: number; radiusM: number };
  subscriptions: Record<string, number | null> | null;
  forfaits?: { label: string; price: number }[];
  info: string[];
  updated: string | null;
  lon: number;
  lat: number;
}

export interface CoverageMeta {
  spatial: number;
  spatialStrict: number;
  cellM: number;
  walkM: number;
  cells: number;
  coveredCells: number;
  byArrondissement: Record<string, number>;
  voirie: { places: number; pricedPlaces: number; share: number; byCategory: Record<string, number>; spots: number };
  parkings: { public: number; priced: number; share: number; places: number; pricedPlaces: number; subscribersOnly: number; covered: number };
  places: { total: number; priced: number; share: number };
  meters: { ok: number; mismatch: number; total: number } | null;
}

export interface SourceMeta {
  id: string;
  name: string;
  provider: string;
  url: string;
  license: string;
  records: number | null;
}

export interface Meta {
  /** Version du contrat de données (dossier data/v1). */
  schemaVersion: number;
  generatedAt: string;
  categories: VoirieCategory[];
  tariffs: TariffTable;
  coverage: CoverageMeta;
  sources: SourceMeta[];
}

/** Emplacement de stationnement sur voirie décodé depuis voirie.json. */
export interface Spot {
  index: number;
  cat: VoirieCategory;
  places: number;
  zone: number;
  arr: number;
  street: string;
  numFrom: number;
  numTo: number;
  zoneRes: string;
  typsta: string;
  regime: string;
  hours: string;
  lon: number;
  lat: number;
}
