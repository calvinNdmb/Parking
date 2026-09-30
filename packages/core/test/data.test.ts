import { describe, expect, it } from 'vitest';
import { decodeVoirie } from '../src/data';
import { nearbyOptions, quoteParking, streetStyle, type Settings } from '../src/model';
import type { CarPark, TariffTable } from '../src/types';
import { TIER_COLORS } from '../src/colors';

const TARIFFS: TariffTable = {
  '1': { vl: [6, 6, 12, 15, 18, 18], vlSamedi: [6, 6, 12, 15, 18, 18], suv: [18, 18, 36, 45, 54, 54], moto: [3, 3, 6, 7.5, 9, 9], motoSamedi: [3, 3, 6, 7.5, 9, 9] },
  '2': { vl: [4, 4, 8, 10, 12, 12], vlSamedi: [4, 4, 8, 10, 12, 12], suv: [12, 12, 24, 30, 36, 36], moto: [2, 2, 4, 5, 6, 6], motoSamedi: [2, 2, 4, 5, 6, 6] },
};
const CATS = ['mixte', 'rotatif', 'gratuit', 'moto', 'pmr', 'electrique', 'livraison'] as const;

// Deux emplacements encodés comme dans scripts/build-data.mjs (micro-degrés, deltas).
const file = {
  version: 1,
  origin: [2.2, 48.8] as [number, number],
  scale: 1e6,
  categories: [...CATS],
  typsta: ['', 'Longitudinal', 'Épi', 'Bataille'],
  streets: ['', 'Rue de Chabrol'],
  zonesRes: ['', '10G'],
  regimes: ['', 'Mixte'],
  hours: [''],
  rows: [
    [0, 3, 1, 10, 1, 59, 73, 1, 1, 1, 0, [150670, 77175, 10, 0, 0, 20, -10, 0]],
    [2, 1, 1, 10, 1, 0, 0, 1, 1, 0, 0, [150800, 77300, 10, 0, 0, 20, -10, 0]],
  ] as [number, number, number, number, number, number, number, number, number, number, number, number[]][],
};

describe('décodage voirie', () => {
  const v = decodeVoirie(file);
  it('reconstruit des polygones fermés et des centres', () => {
    expect(v.count).toBe(2);
    const ring = v.geojson.features[0].geometry.coordinates[0];
    expect(ring).toHaveLength(5);
    expect(ring[0]).toEqual(ring[4]);
    expect(ring[0][0]).toBeCloseTo(2.35067, 6);
    expect(ring[0][1]).toBeCloseTo(48.877175, 6);
    expect(v.geojson.features[0].properties).toEqual({ k: 1, c: 0 });
    expect(v.geojson.features[1].properties.k).toBe(21);
  });
  it('expose les attributs d’un emplacement', () => {
    expect(v.spot(0)).toMatchObject({ cat: 'mixte', places: 3, zone: 1, street: 'Rue de Chabrol', numFrom: 59, numTo: 73, zoneRes: '10G', typsta: 'Longitudinal' });
  });

  it('trouve les options les moins chères autour d’un point', () => {
    const s: Settings = { vehicle: 'voiture', minutes: 120, start: new Date('2026-09-30T08:00:00Z') };
    const park = {
      id: 'paris:x', name: 'Test', public: true, prices: { 60: 5, 120: 10, 1440: 40 }, motoPrices: null, lon: 2.3508, lat: 48.8773,
    } as unknown as CarPark;
    const quotes = new Map([[park.id, quoteParking(park, s)]]);
    const r = nearbyOptions([2.35068, 48.87718], s, [park], quotes, v, TARIFFS);
    expect(r.street.map((o) => o.label)).toEqual(['Gratuit', '12 €']);
    expect(r.parkings[0]).toMatchObject({ title: 'Test', label: '10 €' });
  });
});

describe('style de voirie', () => {
  it('colore selon le prix de la zone pour le véhicule choisi', () => {
    const s: Settings = { vehicle: 'suv', minutes: 60, start: new Date('2026-09-30T08:00:00Z') };
    const st = streetStyle(s, TARIFFS, [...CATS]);
    expect(st.zoneQuotes[1].price).toBe(18);
    expect(st.zoneQuotes[2].price).toBe(12);
    const pairs = st.color.slice(2, -1) as (number | string)[];
    const colorOf = (k: number) => pairs[pairs.indexOf(k) + 1];
    expect(colorOf(1)).toBe(TIER_COLORS.t5); // mixte zone 1 SUV : 18 €/h → rouge
    expect(colorOf(21)).toBe(TIER_COLORS.free); // gratuit → vert
  });
});

describe('vélo et moto', () => {
  const v = decodeVoirie({
    ...file,
    categories: [...CATS, 'velo'],
    rows: [...file.rows, [7, 12, 1, 10, 1, 0, 0, 1, 3, 0, 0, [150700, 77190, 10, 0, 0, 20, -10, 0]]],
  });
  it('liste les places vélo gratuites en mode vélo', () => {
    const s: Settings = { vehicle: 'velo', minutes: 120, start: new Date('2026-09-30T08:00:00Z') };
    const r = nearbyOptions([2.35068, 48.87718], s, [], new Map(), v, TARIFFS);
    expect(r.street).toHaveLength(1);
    expect(r.street[0]).toMatchObject({ label: 'Gratuit', badge: 'velo', subtitle: 'Stationnement vélo · 12 pl.' });
  });
  it('affiche les parkings acceptant vélos et motos', () => {
    const base = { id: 'x', name: 'P', public: true, prices: { 60: 5 }, motoPrices: null, lon: 2.35, lat: 48.87, subscriptions: { veloMonth: 10 } } as unknown as CarPark;
    expect(quoteParking({ ...base, veloAccess: true }, { vehicle: 'velo', minutes: 60, start: null })).toMatchObject({ bubble: 'velo', label: '10 €/mois', relevant: true });
    expect(quoteParking({ ...base, veloAccess: false }, { vehicle: 'velo', minutes: 60, start: null }).relevant).toBe(false);
    expect(quoteParking({ ...base, motoPrices: { 60: 1.8 } }, { vehicle: 'moto', minutes: 60, start: null })).toMatchObject({ price: 1.8, label: '1,80 €' });
  });
});
