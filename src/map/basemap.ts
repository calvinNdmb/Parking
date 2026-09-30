// Fond de carte vectoriel « façon Waze » : couleurs douces, routes blanches bien
// lisibles, grands axes jaunes/orangés, peu de points d'intérêt. Tuiles et
// polices OpenFreeMap (gratuites, sans clé, données OpenStreetMap).

import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from 'maplibre-gl';

export type Theme = 'day' | 'night';

interface Palette {
  background: string;
  park: string;
  wood: string;
  cemetery: string;
  hospital: string;
  school: string;
  water: string;
  waterLabel: string;
  building: string;
  buildingOutline: string;
  rail: string;
  path: string;
  minor: string;
  minorCasing: string;
  secondary: string;
  secondaryCasing: string;
  primary: string;
  primaryCasing: string;
  motorway: string;
  motorwayCasing: string;
  label: string;
  labelHalo: string;
  placeLabel: string;
  poiLabel: string;
}

const PALETTES: Record<Theme, Palette> = {
  day: {
    background: '#f3f0ea',
    park: '#cdeabb',
    wood: '#bfe2ab',
    cemetery: '#d9e7cf',
    hospital: '#f8e1e3',
    school: '#f5ecd4',
    water: '#a6d8f6',
    waterLabel: '#3d86c6',
    building: '#e6e0d5',
    buildingOutline: '#d8d0c1',
    rail: '#c9c2b6',
    path: '#e6dfd2',
    minor: '#ffffff',
    minorCasing: '#d8d1c3',
    secondary: '#ffffff',
    secondaryCasing: '#cfc5b3',
    primary: '#ffe38f',
    primaryCasing: '#e5bf5c',
    motorway: '#ffbd59',
    motorwayCasing: '#dc9a37',
    label: '#4b5663',
    labelHalo: '#ffffff',
    placeLabel: '#7d8793',
    poiLabel: '#5f6b78',
  },
  night: {
    background: '#18212c',
    park: '#1d3328',
    wood: '#1b3126',
    cemetery: '#1f2d27',
    hospital: '#2a2230',
    school: '#282a2a',
    water: '#123a5e',
    waterLabel: '#7fb2e0',
    building: '#222c38',
    buildingOutline: '#2b3746',
    rail: '#3a4655',
    path: '#2b3644',
    minor: '#394656',
    minorCasing: '#1c2530',
    secondary: '#4a5869',
    secondaryCasing: '#1c2530',
    primary: '#8a7440',
    primaryCasing: '#3d3521',
    motorway: '#b07a33',
    motorwayCasing: '#4a3519',
    label: '#c9d3df',
    labelHalo: '#18212c',
    placeLabel: '#8e9aa8',
    poiLabel: '#aab5c2',
  },
};

export const TILE_SOURCE = 'https://tiles.openfreemap.org/planet';
export const GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
export const SPRITE = 'https://tiles.openfreemap.org/sprites/ofm_f384/ofm';
export const FONT_REGULAR = ['Noto Sans Regular'];
export const FONT_BOLD = ['Noto Sans Bold'];
export const FONT_ITALIC = ['Noto Sans Italic'];

type Stops = [number, number][];
const width = (stops: Stops, base = 1.4): ExpressionSpecification => ['interpolate', ['exponential', base], ['zoom'], ...stops.flat()];
const plus = (stops: Stops, extra: (z: number) => number): Stops => stops.map(([z, w]) => [z, w + extra(z)]);
const casingExtra = (z: number) => (z < 13 ? 0.6 : z < 16 ? 1.6 : 2.6);

const ROADS: { id: string; classes: string[]; stops: Stops; fill: keyof Palette; casing: keyof Palette; minzoom: number }[] = [
  { id: 'service', classes: ['service', 'busway'], stops: [[14, 0.6], [16, 2.5], [18, 7], [20, 16]], fill: 'minor', casing: 'minorCasing', minzoom: 14 },
  { id: 'minor', classes: ['minor'], stops: [[12, 0.4], [14, 1.8], [16, 5.5], [18, 14], [20, 32]], fill: 'minor', casing: 'minorCasing', minzoom: 12 },
  { id: 'secondary', classes: ['secondary', 'tertiary'], stops: [[9, 0.5], [12, 1.8], [14, 4], [16, 9], [18, 20], [20, 44]], fill: 'secondary', casing: 'secondaryCasing', minzoom: 9 },
  { id: 'primary', classes: ['primary', 'trunk'], stops: [[7, 0.5], [10, 1.5], [12, 2.8], [14, 5.5], [16, 11], [18, 24], [20, 50]], fill: 'primary', casing: 'primaryCasing', minzoom: 7 },
  { id: 'motorway', classes: ['motorway'], stops: [[5, 0.6], [9, 1.6], [12, 3.2], [14, 6], [16, 12], [18, 26], [20, 54]], fill: 'motorway', casing: 'motorwayCasing', minzoom: 5 },
];

function roadLayers(p: Palette, brunnel: 'tunnel' | 'bridge' | 'normal'): LayerSpecification[] {
  const brunnelFilter: ExpressionSpecification =
    brunnel === 'normal' ? ['!', ['match', ['get', 'brunnel'], ['bridge', 'tunnel'], true, false]] : ['==', ['get', 'brunnel'], brunnel];
  const layers: LayerSpecification[] = [];
  const casings: LayerSpecification[] = [];
  const fills: LayerSpecification[] = [];
  for (const r of ROADS) {
    const filter: ExpressionSpecification = ['all', brunnelFilter, ['match', ['get', 'class'], r.classes, true, false], ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false]];
    casings.push({
      id: `road-${brunnel}-${r.id}-casing`,
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      minzoom: r.minzoom,
      filter,
      layout: { 'line-cap': brunnel === 'tunnel' ? 'butt' : 'round', 'line-join': 'round' },
      paint: {
        'line-color': p[r.casing],
        'line-width': width(plus(r.stops, casingExtra)),
        ...(brunnel === 'tunnel' ? { 'line-dasharray': [0.6, 0.4], 'line-opacity': 0.6 } : {}),
      },
    });
    fills.push({
      id: `road-${brunnel}-${r.id}`,
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      minzoom: r.minzoom,
      filter,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': p[r.fill], 'line-width': width(r.stops), ...(brunnel === 'tunnel' ? { 'line-opacity': 0.55 } : {}) },
    });
  }
  layers.push(...casings, ...fills);
  return layers;
}

export function buildBasemapStyle(theme: Theme): StyleSpecification {
  const p = PALETTES[theme];
  const name: ExpressionSpecification = ['coalesce', ['get', 'name:fr'], ['get', 'name']];
  const layers: LayerSpecification[] = [
    { id: 'background', type: 'background', paint: { 'background-color': p.background } },
    {
      id: 'landcover-wood',
      type: 'fill',
      source: 'omt',
      'source-layer': 'landcover',
      filter: ['match', ['get', 'class'], ['wood', 'forest'], true, false],
      paint: { 'fill-color': p.wood },
    },
    {
      id: 'landcover-grass',
      type: 'fill',
      source: 'omt',
      'source-layer': 'landcover',
      filter: ['match', ['get', 'class'], ['grass', 'farmland', 'wetland'], true, false],
      paint: { 'fill-color': p.park },
    },
    { id: 'park', type: 'fill', source: 'omt', 'source-layer': 'park', paint: { 'fill-color': p.park } },
    {
      id: 'landuse-cemetery',
      type: 'fill',
      source: 'omt',
      'source-layer': 'landuse',
      filter: ['==', ['get', 'class'], 'cemetery'],
      paint: { 'fill-color': p.cemetery },
    },
    {
      id: 'landuse-hospital',
      type: 'fill',
      source: 'omt',
      'source-layer': 'landuse',
      minzoom: 12,
      filter: ['==', ['get', 'class'], 'hospital'],
      paint: { 'fill-color': p.hospital },
    },
    {
      id: 'landuse-school',
      type: 'fill',
      source: 'omt',
      'source-layer': 'landuse',
      minzoom: 12,
      filter: ['match', ['get', 'class'], ['school', 'university', 'college'], true, false],
      paint: { 'fill-color': p.school },
    },
    {
      id: 'landuse-pitch',
      type: 'fill',
      source: 'omt',
      'source-layer': 'landuse',
      minzoom: 13,
      filter: ['match', ['get', 'class'], ['pitch', 'stadium', 'playground'], true, false],
      paint: { 'fill-color': p.park, 'fill-opacity': 0.8 },
    },
    {
      id: 'water',
      type: 'fill',
      source: 'omt',
      'source-layer': 'water',
      filter: ['!=', ['get', 'brunnel'], 'tunnel'],
      paint: { 'fill-color': p.water },
    },
    {
      id: 'waterway',
      type: 'line',
      source: 'omt',
      'source-layer': 'waterway',
      filter: ['!=', ['get', 'brunnel'], 'tunnel'],
      paint: { 'line-color': p.water, 'line-width': width([[10, 0.5], [16, 3], [20, 8]]) },
    },
    {
      id: 'building',
      type: 'fill',
      source: 'omt',
      'source-layer': 'building',
      minzoom: 14,
      paint: {
        'fill-color': p.building,
        'fill-outline-color': p.buildingOutline,
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 15, 1],
      },
    },
    ...roadLayers(p, 'tunnel'),
    {
      id: 'path',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      minzoom: 16,
      filter: ['all', ['match', ['get', 'class'], ['path', 'track'], true, false], ['!=', ['get', 'brunnel'], 'tunnel']],
      paint: { 'line-color': p.path, 'line-width': width([[16, 1], [18, 2], [20, 3.5]]), 'line-dasharray': [2, 1.5], 'line-opacity': 0.8 },
    },
    {
      id: 'rail',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      minzoom: 12,
      filter: ['all', ['match', ['get', 'class'], ['rail', 'transit'], true, false], ['!=', ['get', 'brunnel'], 'tunnel']],
      paint: { 'line-color': p.rail, 'line-width': width([[12, 0.6], [16, 1.6], [20, 3]]) },
    },
    ...roadLayers(p, 'normal'),
    ...roadLayers(p, 'bridge'),
    // --- Libellés
    {
      id: 'label-water',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'water_name',
      minzoom: 12,
      filter: ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false],
      layout: { 'text-field': name, 'text-font': FONT_ITALIC, 'text-size': 13, 'symbol-placement': 'line', 'text-letter-spacing': 0.1 },
      paint: { 'text-color': p.waterLabel, 'text-halo-color': p.labelHalo, 'text-halo-width': 1.2 },
    },
    {
      id: 'label-water-point',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'water_name',
      minzoom: 12,
      filter: ['match', ['geometry-type'], ['Point', 'MultiPoint'], true, false],
      layout: { 'text-field': name, 'text-font': FONT_ITALIC, 'text-size': 13, 'text-letter-spacing': 0.1 },
      paint: { 'text-color': p.waterLabel, 'text-halo-color': p.labelHalo, 'text-halo-width': 1.2 },
    },
    {
      id: 'label-waterway',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'waterway',
      minzoom: 13,
      filter: ['==', ['get', 'class'], 'river'],
      layout: { 'text-field': name, 'text-font': FONT_ITALIC, 'text-size': 13, 'symbol-placement': 'line', 'text-letter-spacing': 0.15, 'symbol-spacing': 400 },
      paint: { 'text-color': p.waterLabel, 'text-halo-color': p.labelHalo, 'text-halo-width': 1.2 },
    },
    {
      id: 'label-road-minor',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'transportation_name',
      minzoom: 15,
      filter: ['match', ['get', 'class'], ['minor', 'service'], true, false],
      layout: {
        'symbol-placement': 'line',
        'text-field': name,
        'text-font': FONT_REGULAR,
        'text-size': ['interpolate', ['linear'], ['zoom'], 15, 10, 18, 13],
        'text-max-angle': 30,
        'symbol-spacing': 280,
      },
      paint: { 'text-color': p.label, 'text-halo-color': p.labelHalo, 'text-halo-width': 1.6 },
    },
    {
      id: 'label-road-major',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'transportation_name',
      minzoom: 12.5,
      filter: ['match', ['get', 'class'], ['primary', 'secondary', 'tertiary', 'trunk', 'motorway'], true, false],
      layout: {
        'symbol-placement': 'line',
        'text-field': name,
        'text-font': FONT_BOLD,
        'text-size': ['interpolate', ['linear'], ['zoom'], 13, 10, 18, 14],
        'text-max-angle': 30,
        'symbol-spacing': 320,
      },
      paint: { 'text-color': p.label, 'text-halo-color': p.labelHalo, 'text-halo-width': 1.8 },
    },
    {
      id: 'label-station',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'poi',
      minzoom: 14.5,
      filter: ['all', ['==', ['get', 'class'], 'railway'], ['match', ['get', 'subclass'], ['station', 'subway', 'halt'], true, false]],
      layout: {
        'icon-image': ['match', ['get', 'subclass'], 'subway', 'railway_metro_11', 'railway_11'],
        'text-field': name,
        'text-font': FONT_REGULAR,
        'text-size': 11,
        'text-offset': [0, 1.1],
        'text-anchor': 'top',
        'text-max-width': 8,
        'text-optional': true,
      },
      paint: { 'text-color': p.poiLabel, 'text-halo-color': p.labelHalo, 'text-halo-width': 1.4, 'icon-opacity': 0.85 },
    },
    {
      id: 'label-quarter',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'place',
      minzoom: 13,
      maxzoom: 16,
      filter: ['match', ['get', 'class'], ['quarter', 'neighbourhood'], true, false],
      layout: {
        'text-field': name,
        'text-font': FONT_REGULAR,
        'text-size': 11,
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.12,
        'text-max-width': 8,
      },
      paint: { 'text-color': p.placeLabel, 'text-halo-color': p.labelHalo, 'text-halo-width': 1.4 },
    },
    {
      id: 'label-suburb',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'place',
      minzoom: 10.5,
      maxzoom: 14,
      filter: ['==', ['get', 'class'], 'suburb'],
      layout: {
        'text-field': name,
        'text-font': FONT_REGULAR,
        'text-size': 12,
        'text-max-width': 7,
      },
      paint: { 'text-color': p.placeLabel, 'text-halo-color': p.labelHalo, 'text-halo-width': 1.6 },
    },
    {
      id: 'label-city',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'place',
      maxzoom: 11,
      filter: ['match', ['get', 'class'], ['city', 'town'], true, false],
      layout: { 'text-field': name, 'text-font': FONT_BOLD, 'text-size': ['interpolate', ['linear'], ['zoom'], 6, 11, 10, 15] },
      paint: { 'text-color': p.label, 'text-halo-color': p.labelHalo, 'text-halo-width': 1.8 },
    },
  ];
  return {
    version: 8,
    name: `ParkPrix ${theme}`,
    glyphs: GLYPHS,
    sprite: SPRITE,
    sources: {
      omt: {
        type: 'vector',
        url: TILE_SOURCE,
        attribution:
          '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">contributeurs OpenStreetMap</a>',
      },
    },
    layers,
  };
}

/** Premier calque de libellés : les couches de stationnement s'insèrent juste en dessous. */
export const FIRST_LABEL_LAYER = 'label-water';
