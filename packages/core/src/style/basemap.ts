// Fond de carte reproduisant la carte Waze (live map), couleurs mesurées sur ses
// tuiles : fond crème, rues gris clair liserées, axes vert sauge, autoroutes vert
// canard, eau turquoise, aucun bâtiment, libellés gris posés sur les routes.
// Données : tuiles vectorielles OpenFreeMap (schéma OpenMapTiles, sans clé).
// Le style produit est un objet MapLibre standard : utilisable par MapLibre GL JS
// (web) comme par MapLibre React Native (<Map mapStyle={style} />).

import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from '@maplibre/maplibre-gl-style-spec';

export type Theme = 'day' | 'night';

export interface BasemapPalette {
  background: string;
  landmark: string;
  plaza: string;
  park: string;
  grass: string;
  hospital: string;
  water: string;
  streetFill: string;
  streetCasing: string;
  tertiaryFill: string;
  tertiaryCasing: string;
  secondaryFill: string;
  secondaryCasing: string;
  primaryFill: string;
  primaryCasing: string;
  motorwayFill: string;
  motorwayCasing: string;
  path: string;
  pathCasing: string;
  rail: string;
  label: string;
  labelHalo: string;
  majorLabel: string;
  majorLabelHalo: string;
  placeLabel: string;
  waterLabel: string;
  waterHalo: string;
  parkLabel: string;
  parkHalo: string;
  poiLabel: string;
}

export const PALETTES: Record<Theme, BasemapPalette> = {
  day: {
    background: '#faf7ef',
    landmark: '#f5f2ea',
    plaza: '#eeebe3',
    park: '#cce5a6',
    grass: '#e3f1cd',
    hospital: '#e5c6c3',
    water: '#9fd4da',
    streetFill: '#eeebe3',
    streetCasing: '#c5cdc2',
    tertiaryFill: '#e8e8d3',
    tertiaryCasing: '#bcc4b8',
    secondaryFill: '#dae2ce',
    secondaryCasing: '#aeb89c',
    primaryFill: '#c2cfae',
    primaryCasing: '#9ba68b',
    motorwayFill: '#63a08a',
    motorwayCasing: '#4d8a74',
    path: '#f4ead1',
    pathCasing: '#d7cdb0',
    rail: '#bbbbbb',
    label: '#777777',
    labelHalo: '#faf7ef',
    majorLabel: '#4e5346',
    majorLabelHalo: '#dae2ce',
    placeLabel: '#6d7167',
    waterLabel: '#678a8e',
    waterHalo: '#c4e4e8',
    parkLabel: '#85956c',
    parkHalo: '#e3f1cd',
    poiLabel: '#848484',
  },
  night: {
    background: '#1c2632',
    landmark: '#202b37',
    plaza: '#25303d',
    park: '#22392d',
    grass: '#21322a',
    hospital: '#3a2b31',
    water: '#1b4853',
    streetFill: '#33404e',
    streetCasing: '#141b23',
    tertiaryFill: '#3b4856',
    tertiaryCasing: '#141b23',
    secondaryFill: '#48584a',
    secondaryCasing: '#1b231c',
    primaryFill: '#5a6c52',
    primaryCasing: '#232c21',
    motorwayFill: '#2f7d68',
    motorwayCasing: '#153a30',
    path: '#3d3a30',
    pathCasing: '#232a31',
    rail: '#56616d',
    label: '#aab4bf',
    labelHalo: '#1c2632',
    majorLabel: '#e2e9d9',
    majorLabelHalo: '#3c4b3a',
    placeLabel: '#b7c0ca',
    waterLabel: '#8fc3cc',
    waterHalo: '#1b4853',
    parkLabel: '#a3c28d',
    parkHalo: '#22392d',
    poiLabel: '#98a3ae',
  },
};

export const OPENFREEMAP_TILES = 'https://tiles.openfreemap.org/planet';
export const OPENFREEMAP_GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
export const FONT_REGULAR = ['Noto Sans Regular'];
export const FONT_BOLD = ['Noto Sans Bold'];
export const FONT_ITALIC = ['Noto Sans Italic'];

/** Premier calque de libellés : les calques de stationnement s'insèrent juste en dessous. */
export const FIRST_LABEL_LAYER = 'label-waterway';

export interface BasemapOptions {
  theme: Theme;
  /** URL absolue de la planche de sprites, sans extension (ex. « https://…/sprites/parkprix »). */
  spriteUrl: string;
  tilesUrl?: string;
  glyphsUrl?: string;
}

type Stops = [number, number][];
const interp = (stops: Stops, base = 1.4): ExpressionSpecification =>
  ['interpolate', ['exponential', base], ['zoom'], ...stops.flat()] as unknown as ExpressionSpecification;

const isLine: ExpressionSpecification = ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false];
const classIn = (...classes: string[]): ExpressionSpecification => ['match', ['get', 'class'], classes, true, false];
const notBrunnel: ExpressionSpecification = ['!', ['match', ['get', 'brunnel'], ['bridge', 'tunnel'], true, false]];
const name: ExpressionSpecification = ['coalesce', ['get', 'name:fr'], ['get', 'name']];

/** Hiérarchie Waze : autoroute → axe majeur → axe mineur → rue principale → rue. */
const ROADS: { id: string; classes: string[]; fill: keyof BasemapPalette; casing: keyof BasemapPalette; stops: Stops; minzoom: number; fillMinzoom?: number; ramp?: boolean }[] = [
  { id: 'service', classes: ['service', 'track'], fill: 'streetFill', casing: 'streetCasing', stops: [[14, 0.4], [16, 1.8], [17, 3.5], [18, 7], [20, 18]], minzoom: 14.5, fillMinzoom: 15.5 },
  { id: 'street', classes: ['minor'], fill: 'streetFill', casing: 'streetCasing', stops: [[12, 0.2], [13, 0.4], [14, 1], [15, 2], [16, 3.8], [17, 8], [18, 14], [20, 36]], minzoom: 12, fillMinzoom: 14 },
  { id: 'tertiary', classes: ['tertiary'], fill: 'tertiaryFill', casing: 'tertiaryCasing', stops: [[11, 0.3], [13, 1], [14, 1.8], [15, 3], [16, 5], [17, 10], [18, 18], [20, 44]], minzoom: 11, fillMinzoom: 13 },
  { id: 'secondary', classes: ['secondary'], fill: 'secondaryFill', casing: 'secondaryCasing', stops: [[9, 0.4], [11, 0.9], [12, 1.4], [13, 2.2], [14, 3.2], [15, 4.8], [16, 7], [17, 12], [18, 22], [20, 50]], minzoom: 9 },
  { id: 'primary', classes: ['primary'], fill: 'primaryFill', casing: 'primaryCasing', stops: [[7, 0.5], [9, 0.9], [11, 1.8], [12, 2.4], [13, 3.2], [14, 4.4], [15, 6.4], [16, 9], [17, 15], [18, 26], [20, 58]], minzoom: 7 },
  // Le périphérique est « trunk » dans OSM : Waze le dessine comme une autoroute (vert canard).
  { id: 'motorway-link', classes: ['motorway', 'trunk'], fill: 'motorwayFill', casing: 'motorwayCasing', stops: [[12, 0.8], [14, 1.6], [15, 2.4], [16, 4], [17, 7], [18, 12], [20, 28]], minzoom: 12, ramp: true },
  { id: 'motorway', classes: ['motorway', 'trunk'], fill: 'motorwayFill', casing: 'motorwayCasing', stops: [[5, 0.6], [8, 1], [10, 1.4], [12, 2], [13, 2.6], [14, 3.4], [15, 4.6], [16, 7], [17, 12], [18, 22], [20, 50]], minzoom: 5, ramp: false },
];

/** Épaisseur ajoutée par le liseré selon le zoom. */
const casingExtra = (z: number) => (z < 14 ? 1 : z < 16 ? 1.5 : z < 17 ? 2 : 3);

function roadLayers(p: BasemapPalette, brunnel: 'tunnel' | 'normal' | 'bridge'): LayerSpecification[] {
  const brunnelFilter: ExpressionSpecification = brunnel === 'normal' ? notBrunnel : ['==', ['get', 'brunnel'], brunnel];
  const tunnel = brunnel === 'tunnel';
  const casings: LayerSpecification[] = [];
  const fills: LayerSpecification[] = [];
  for (const r of ROADS) {
    const rampFilter: ExpressionSpecification[] = r.ramp === undefined ? [] : [r.ramp ? ['==', ['get', 'ramp'], 1] : ['!=', ['get', 'ramp'], 1]];
    const filter = ['all', brunnelFilter, classIn(...r.classes), isLine, ...rampFilter] as unknown as ExpressionSpecification;
    const fillZoom = r.fillMinzoom ?? r.minzoom;
    // Sous fillZoom, la rue n'est qu'un fin trait (son liseré), comme sur Waze à petite échelle.
    const casingStops: Stops = r.stops.map(([z, w]) => [z, z >= fillZoom ? w + casingExtra(z) : w + 0.3]);
    const fillStops = r.stops.filter(([z]) => z >= fillZoom - 1);
    casings.push({
      id: `road-${brunnel}-${r.id}-casing`,
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      minzoom: tunnel ? Math.max(r.minzoom, 14) : r.minzoom,
      filter,
      layout: { 'line-cap': tunnel ? 'butt' : 'round', 'line-join': 'round' },
      paint: {
        'line-color': p[r.casing],
        'line-width': interp(casingStops),
        ...(tunnel ? { 'line-dasharray': [1, 0.6], 'line-opacity': 0.55 } : {}),
      },
    });
    fills.push({
      id: `road-${brunnel}-${r.id}`,
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      minzoom: tunnel ? Math.max(fillZoom, 14) : fillZoom,
      filter,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': tunnel ? p.background : p[r.fill],
        'line-width': interp(fillStops),
        ...(tunnel ? { 'line-opacity': 0.7 } : {}),
      },
    });
  }
  return [...casings, ...fills];
}

/**
 * Le type de retour est paramétrable : chaque moteur (MapLibre GL JS, MapLibre
 * React Native) embarque sa propre copie des types de style ; on l'indique à
 * l'appel, ex. buildBasemapStyle<StyleSpecification>(…) importé de son paquet.
 */
export function buildBasemapStyle<S = StyleSpecification>({ theme, spriteUrl, tilesUrl = OPENFREEMAP_TILES, glyphsUrl = OPENFREEMAP_GLYPHS }: BasemapOptions): S {
  const p = PALETTES[theme];
  const night = theme === 'night';
  const layers: LayerSpecification[] = [
    { id: 'background', type: 'background', paint: { 'background-color': p.background } },
    {
      id: 'landuse-landmark',
      type: 'fill',
      source: 'omt',
      'source-layer': 'landuse',
      minzoom: 12,
      filter: classIn('industrial', 'commercial', 'retail', 'railway', 'garages', 'school', 'university', 'college', 'stadium', 'military', 'quarry'),
      paint: { 'fill-color': p.landmark },
    },
    { id: 'landuse-hospital', type: 'fill', source: 'omt', 'source-layer': 'landuse', minzoom: 12, filter: classIn('hospital'), paint: { 'fill-color': p.hospital } },
    { id: 'landuse-cemetery', type: 'fill', source: 'omt', 'source-layer': 'landuse', filter: classIn('cemetery'), paint: { 'fill-color': p.grass } },
    { id: 'landcover-grass', type: 'fill', source: 'omt', 'source-layer': 'landcover', filter: classIn('grass', 'farmland', 'wetland'), paint: { 'fill-color': p.park } },
    { id: 'landcover-wood', type: 'fill', source: 'omt', 'source-layer': 'landcover', filter: classIn('wood', 'forest'), paint: { 'fill-color': p.park } },
    { id: 'park', type: 'fill', source: 'omt', 'source-layer': 'park', paint: { 'fill-color': p.park } },
    { id: 'landuse-pitch', type: 'fill', source: 'omt', 'source-layer': 'landuse', minzoom: 13, filter: classIn('pitch', 'playground'), paint: { 'fill-color': p.grass } },
    { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', filter: ['!=', ['get', 'brunnel'], 'tunnel'], paint: { 'fill-color': p.water, 'fill-antialias': true } },
    {
      id: 'waterway',
      type: 'line',
      source: 'omt',
      'source-layer': 'waterway',
      filter: ['!=', ['get', 'brunnel'], 'tunnel'],
      paint: { 'line-color': p.water, 'line-width': interp([[10, 0.6], [14, 2], [18, 6]]) },
    },
    {
      // Places et zones piétonnes (polygones du calque transportation)
      id: 'plaza',
      type: 'fill',
      source: 'omt',
      'source-layer': 'transportation',
      minzoom: 14,
      filter: ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false],
      paint: { 'fill-color': p.plaza },
    },
    ...roadLayers(p, 'tunnel'),
    {
      id: 'path-casing',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      minzoom: 16,
      filter: ['all', classIn('path'), notBrunnel, isLine, ['!', ['match', ['get', 'subclass'], ['steps', 'sidewalk', 'crossing'], true, false]]] as unknown as ExpressionSpecification,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': p.pathCasing, 'line-width': 4, 'line-dasharray': [0.5, 1] },
    },
    {
      id: 'path',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      minzoom: 16,
      filter: ['all', classIn('path'), notBrunnel, isLine, ['!', ['match', ['get', 'subclass'], ['steps', 'sidewalk', 'crossing'], true, false]]] as unknown as ExpressionSpecification,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      // même motif que le liseré (tirets proportionnels à l'épaisseur) : « perles » crème façon Waze
      paint: { 'line-color': p.path, 'line-width': 2.6, 'line-dasharray': [0.77, 1.54] },
    },
    {
      id: 'rail',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      minzoom: 12,
      filter: ['all', classIn('rail'), notBrunnel, isLine] as unknown as ExpressionSpecification,
      paint: { 'line-color': p.rail, 'line-width': interp([[12, 0.6], [16, 1.2], [18, 2]]) },
    },
    {
      id: 'rail-ties',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      minzoom: 13.5,
      filter: ['all', classIn('rail'), notBrunnel, isLine] as unknown as ExpressionSpecification,
      paint: { 'line-color': p.rail, 'line-width': interp([[13.5, 3], [16, 5], [18, 7]]), 'line-dasharray': [0.2, 1.6] },
    },
    ...roadLayers(p, 'normal'),
    ...roadLayers(p, 'bridge'),
    {
      id: 'oneway',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'transportation',
      minzoom: 16,
      filter: ['all', ['match', ['get', 'oneway'], [1, -1], true, false], classIn('minor', 'tertiary', 'secondary', 'service'), isLine] as unknown as ExpressionSpecification,
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 110,
        'icon-image': night ? 'oneway-night' : 'oneway',
        'icon-rotate': ['match', ['get', 'oneway'], -1, 180, 0],
        'icon-rotation-alignment': 'map',
        'icon-size': ['interpolate', ['linear'], ['zoom'], 16, 0.7, 18, 1],
        'icon-padding': 2,
      },
    },
    // --- Libellés
    {
      id: FIRST_LABEL_LAYER,
      type: 'symbol',
      source: 'omt',
      'source-layer': 'waterway',
      minzoom: 12,
      filter: classIn('river', 'canal'),
      layout: { 'symbol-placement': 'line', 'text-field': name, 'text-font': FONT_ITALIC, 'text-size': 14, 'text-letter-spacing': 0.08, 'symbol-spacing': 500 },
      paint: { 'text-color': p.waterLabel, 'text-halo-color': p.waterHalo, 'text-halo-width': 1.4 },
    },
    {
      id: 'label-water',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'water_name',
      minzoom: 11,
      layout: { 'text-field': name, 'text-font': FONT_ITALIC, 'text-size': 14, 'text-letter-spacing': 0.08 },
      paint: { 'text-color': p.waterLabel, 'text-halo-color': p.waterHalo, 'text-halo-width': 1.4 },
    },
    {
      id: 'label-park',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'poi',
      minzoom: 14.5,
      filter: ['all', classIn('park', 'garden', 'cemetery'), ['<=', ['get', 'rank'], 12]] as unknown as ExpressionSpecification,
      layout: { 'text-field': name, 'text-font': FONT_ITALIC, 'text-size': ['interpolate', ['linear'], ['zoom'], 14.5, 11.5, 17, 14], 'text-max-width': 7, 'text-padding': 8 },
      paint: { 'text-color': p.parkLabel, 'text-halo-color': p.parkHalo, 'text-halo-width': 1.2 },
    },
    {
      id: 'label-street',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'transportation_name',
      minzoom: 13.2,
      filter: classIn('minor', 'service', 'tertiary'),
      layout: {
        'symbol-placement': 'line',
        'text-field': name,
        'text-font': FONT_REGULAR,
        'text-size': ['interpolate', ['linear'], ['zoom'], 13.2, 10, 15, 11.5, 16, 12.5, 18, 14.5],
        'text-max-angle': 30,
        'symbol-spacing': 300,
        'text-padding': 3,
      },
      paint: { 'text-color': p.label, 'text-halo-color': p.labelHalo, 'text-halo-width': 1.5 },
    },
    {
      id: 'label-major',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'transportation_name',
      minzoom: 11.5,
      filter: classIn('primary', 'secondary'),
      layout: {
        'symbol-placement': 'line',
        'text-field': name,
        'text-font': FONT_REGULAR,
        'text-size': ['interpolate', ['linear'], ['zoom'], 12, 11, 15, 13, 18, 15.5],
        'text-max-angle': 28,
        'symbol-spacing': 350,
        'text-padding': 3,
      },
      paint: { 'text-color': p.majorLabel, 'text-halo-color': p.majorLabelHalo, 'text-halo-width': 1.6 },
    },
    {
      id: 'label-shield',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'transportation_name',
      minzoom: 10,
      filter: ['all', classIn('motorway', 'trunk'), ['has', 'ref'], ['<=', ['get', 'ref_length'], 6]] as unknown as ExpressionSpecification,
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 450,
        'text-field': ['get', 'ref'],
        'text-font': FONT_BOLD,
        'text-size': 10.5,
        'text-rotation-alignment': 'viewport',
        'icon-rotation-alignment': 'viewport',
        'icon-image': night ? 'shield-night' : 'shield',
        'icon-text-fit': 'both',
        'icon-text-fit-padding': [1, 4, 1, 4],
      },
      paint: { 'text-color': '#ffffff' },
    },
    {
      id: 'label-metro',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'poi',
      minzoom: 15,
      filter: ['all', classIn('railway'), ['match', ['get', 'subclass'], ['subway', 'station', 'halt'], true, false]] as unknown as ExpressionSpecification,
      layout: {
        'icon-image': 'icon-metro',
        'icon-size': 0.9,
        'text-field': name,
        'text-font': FONT_REGULAR,
        'text-size': 11,
        'text-offset': [0, 1.1],
        'text-anchor': 'top',
        'text-max-width': 8,
        'text-optional': true,
      },
      paint: { 'text-color': p.poiLabel, 'text-halo-color': p.labelHalo, 'text-halo-width': 1.4 },
    },
    {
      id: 'label-landmark',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'poi',
      minzoom: 15.5,
      filter: ['all', ['<=', ['get', 'rank'], 12], ['!', classIn('railway', 'bus', 'park', 'garden', 'parking', 'fuel', 'shop', 'clothing_store', 'restaurant', 'fast_food', 'cafe', 'bar', 'bakery', 'grocery')]] as unknown as ExpressionSpecification,
      layout: { 'text-field': name, 'text-font': FONT_REGULAR, 'text-size': ['interpolate', ['linear'], ['zoom'], 15.5, 11.5, 18, 14], 'text-max-width': 8, 'text-padding': 4 },
      paint: { 'text-color': p.poiLabel, 'text-halo-color': p.labelHalo, 'text-halo-width': 1.4 },
    },
    {
      id: 'label-quarter',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'place',
      minzoom: 12.5,
      maxzoom: 15,
      filter: classIn('quarter', 'neighbourhood'),
      layout: { 'text-field': name, 'text-font': FONT_REGULAR, 'text-size': 12, 'text-max-width': 7, 'text-letter-spacing': 0.04 },
      paint: { 'text-color': p.placeLabel, 'text-opacity': 0.75, 'text-halo-color': p.labelHalo, 'text-halo-width': 1.4 },
    },
    {
      id: 'label-city',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'place',
      maxzoom: 12.5,
      filter: classIn('city', 'town'),
      layout: {
        'text-field': ['upcase', name],
        'text-font': FONT_BOLD,
        'text-size': ['interpolate', ['linear'], ['zoom'], 6, 12, 11, 22],
        'text-letter-spacing': 0.18,
      },
      paint: { 'text-color': p.placeLabel, 'text-halo-color': p.labelHalo, 'text-halo-width': 2 },
    },
  ];
  const style: StyleSpecification = {
    version: 8,
    name: `ParkPrix — Waze ${theme === 'day' ? 'jour' : 'nuit'}`,
    glyphs: glyphsUrl,
    sprite: spriteUrl,
    sources: {
      omt: {
        type: 'vector',
        url: tilesUrl,
        attribution:
          '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">contributeurs OpenStreetMap</a>',
      },
    },
    layers,
  };
  return style as unknown as S;
}
