// Calques « stationnement » posés sur le fond de carte, sous forme de
// spécifications MapLibre standard :
//   - web : map.addSource(id, …) puis map.addLayer(spec)
//   - Expo : <GeoJSONSource id=… data=…><Layer {...spec} /></GeoJSONSource>

import type { ExpressionSpecification, FilterSpecification, LayerSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { FeatureCollection, Point } from 'geojson';
import type { VoirieData } from '../data';
import type { VoirieCategory } from '../types';
import { FONT_BOLD, type Theme } from './basemap';

export const SOURCES = {
  zones: 'pp-zones',
  zoneLabels: 'pp-zone-labels',
  voirie: 'pp-voirie',
  voiriePoints: 'pp-voirie-points',
  parkings: 'pp-parkings',
  belib: 'pp-belib',
  coverage: 'pp-coverage',
} as const;

/** Options conseillées pour la source GeoJSON des 60 000 emprises de voirie. */
export const VOIRIE_SOURCE_OPTIONS = { tolerance: 0, maxzoom: 16, buffer: 16 } as const;

export const LAYERS = {
  zonesFill: 'pp-zones-fill',
  coverage: 'pp-coverage',
  zonesLine: 'pp-zones-line',
  voirieFill: 'pp-voirie-fill',
  voirieLine: 'pp-voirie-line',
  voirieSel: 'pp-voirie-sel',
  spotIcons: 'pp-spot-icons',
  belib: 'pp-belib',
  parkP: 'pp-parkings-p',
  parkBubble: 'pp-parkings-bubble',
  zonesLabel: 'pp-zones-label',
} as const;

/** Groupes de calques pilotés par les interrupteurs de l'interface. */
export const LAYER_GROUPS = {
  street: [LAYERS.voirieFill, LAYERS.voirieLine, LAYERS.voirieSel],
  parkings: [LAYERS.parkP, LAYERS.parkBubble],
  zones: [LAYERS.zonesFill, LAYERS.zonesLine, LAYERS.zonesLabel],
  spotIcons: [LAYERS.spotIcons],
  belib: [LAYERS.belib],
  coverage: [LAYERS.coverage],
} as const;

/** Calques sur lesquels un toucher / clic ouvre une fiche (ordre de priorité). */
export const INTERACTIVE_LAYERS = [LAYERS.parkP, LAYERS.parkBubble, LAYERS.belib, LAYERS.spotIcons, LAYERS.voirieLine, LAYERS.voirieFill] as const;

export interface ParkingLayerPaint {
  voirieColor: ExpressionSpecification;
  voirieOpacity: ExpressionSpecification;
  zoneColor: ExpressionSpecification;
}

export interface ParkingLayerOptions {
  theme: Theme;
  paint: ParkingLayerPaint;
  categories: VoirieCategory[];
  /** Catégories dont on affiche une icône (vélo, moto) au centre de chaque emplacement. */
  iconCategories: VoirieCategory[];
}

/** Filtre des icônes d'emplacements (vélo / moto) selon les catégories visibles. */
export function spotIconsFilter<F = FilterSpecification>(categories: VoirieCategory[], visible: VoirieCategory[]): F {
  return ['match', ['get', 'c'], visible.length ? visible.map((c) => categories.indexOf(c)) : [-1], true, false] as unknown as F;
}

/** Type de calque paramétrable (voir buildBasemapStyle) : parkingLayers<LayerSpecification>(…). */
export function parkingLayers<L = LayerSpecification>(options: ParkingLayerOptions): { below: L[]; above: L[] } {
  const { below, above } = buildParkingLayers(options);
  return { below: below as unknown as L[], above: above as unknown as L[] };
}

function buildParkingLayers({ theme, paint, categories, iconCategories }: ParkingLayerOptions): { below: LayerSpecification[]; above: LayerSpecification[] } {
  const night = theme === 'night';
  const idx = (c: VoirieCategory) => categories.indexOf(c);
  const below: LayerSpecification[] = [
    {
      id: LAYERS.zonesFill,
      type: 'fill',
      source: SOURCES.zones,
      maxzoom: 16,
      paint: { 'fill-color': paint.zoneColor, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 10, night ? 0.13 : 0.16, 13.5, night ? 0.08 : 0.09, 15.5, 0] },
    },
    {
      id: LAYERS.coverage,
      type: 'fill',
      source: SOURCES.coverage,
      layout: { visibility: 'none' },
      paint: {
        'fill-color': ['case', ['==', ['get', 'ok'], 1], '#1bab50', '#ff3528'],
        'fill-opacity': 0.3,
        'fill-outline-color': night ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.5)',
      },
    },
    {
      id: LAYERS.zonesLine,
      type: 'line',
      source: SOURCES.zones,
      paint: {
        'line-color': paint.zoneColor,
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.5, 15, 3],
        'line-dasharray': [2, 1.5],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.8, 16, 0.3],
      },
    },
    {
      id: LAYERS.voirieFill,
      type: 'fill',
      source: SOURCES.voirie,
      minzoom: 17,
      paint: { 'fill-color': paint.voirieColor, 'fill-opacity': ['*', 0.85, paint.voirieOpacity] as unknown as ExpressionSpecification },
    },
    {
      id: LAYERS.voirieLine,
      type: 'line',
      source: SOURCES.voirie,
      minzoom: 13.5,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': paint.voirieColor,
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 13.5, 1, 15, 2.2, 16, 3.2, 18, 3.5, 20, 5],
        'line-opacity': paint.voirieOpacity,
      },
    },
    {
      id: LAYERS.voirieSel,
      type: 'line',
      source: SOURCES.voirie,
      filter: ['==', ['id'], -1],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#1a73e8', 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 5, 18, 8], 'line-opacity': 0.9 },
    },
  ];
  const above: LayerSpecification[] = [
    {
      id: LAYERS.spotIcons,
      type: 'symbol',
      source: SOURCES.voiriePoints,
      minzoom: 15,
      filter: spotIconsFilter(categories, iconCategories),
      layout: {
        'icon-image': ['match', ['get', 'c'], idx('moto'), 'icon-moto', 'icon-velo'],
        'icon-size': ['interpolate', ['linear'], ['zoom'], 15, 0.7, 17, 1],
        'icon-padding': 1,
      },
    },
    {
      id: LAYERS.belib,
      type: 'symbol',
      source: SOURCES.belib,
      minzoom: 13,
      layout: {
        visibility: 'none',
        'icon-image': 'icon-belib',
        'icon-size': ['interpolate', ['linear'], ['zoom'], 13, 0.65, 16, 1],
        'icon-allow-overlap': true,
      },
    },
    {
      // Bulle de prix accolée à droite du « P » (affichée quand la place le permet).
      id: LAYERS.parkBubble,
      type: 'symbol',
      source: SOURCES.parkings,
      minzoom: 12.5,
      filter: ['!=', ['get', 'bubble'], ''],
      layout: {
        'text-field': ['get', 'label'],
        'text-font': FONT_BOLD,
        'text-size': ['interpolate', ['linear'], ['zoom'], 12.5, 11, 15, 12.5, 17, 13.5],
        'text-anchor': 'left',
        'text-offset': ['interpolate', ['linear'], ['zoom'], 12.5, ['literal', [1.1, 0]], 15, ['literal', [1.3, 0]], 17, ['literal', [1.4, 0]]],
        'text-padding': 1,
        'icon-image': ['get', 'bubble'],
        'icon-text-fit': 'both',
        'icon-text-fit-padding': [2, 6, 2, 6],
        'symbol-sort-key': ['get', 'sort'],
      },
      paint: { 'text-color': ['get', 'ink'] },
    },
    {
      // Chaque parking fermé est marqué d'un « P » (bleu, gris si réservé aux abonnés),
      // toujours visible : il ne masque pas les bulles et n'est jamais masqué.
      id: LAYERS.parkP,
      type: 'symbol',
      source: SOURCES.parkings,
      minzoom: 11.5,
      layout: {
        'icon-image': ['get', 'p'],
        'icon-size': ['interpolate', ['linear'], ['zoom'], 11.5, 0.55, 13, 0.72, 15, 0.9, 17, 1],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'symbol-sort-key': ['get', 'sort'],
      },
    },
    {
      id: LAYERS.zonesLabel,
      type: 'symbol',
      source: SOURCES.zoneLabels,
      maxzoom: 14.5,
      layout: {
        'text-field': ['get', 'label'],
        'text-font': FONT_BOLD,
        'text-size': 13,
        'text-max-width': 14,
        'text-line-height': 1.25,
        'icon-image': night ? 'label-bg-night' : 'label-bg',
        'icon-text-fit': 'both',
        'icon-text-fit-padding': [2, 4, 2, 4],
      },
      paint: { 'text-color': night ? '#e8eef5' : '#202124' },
    },
  ];
  return { below, above };
}

/** Points (centres) des emplacements des catégories données, pour les icônes vélo / moto. */
export function voiriePointsCollection(voirie: VoirieData, categories: VoirieCategory[]): FeatureCollection<Point, { c: number; i: number; places: number }> {
  const wanted = new Set(categories.map((c) => voirie.categories.indexOf(c)));
  const features: FeatureCollection<Point, { c: number; i: number; places: number }>['features'] = [];
  for (let i = 0; i < voirie.count; i++) {
    const f = voirie.geojson.features[i];
    if (!wanted.has(f.properties.c)) continue;
    features.push({
      type: 'Feature',
      id: i,
      geometry: { type: 'Point', coordinates: [voirie.centers[i * 2], voirie.centers[i * 2 + 1]] },
      properties: { c: f.properties.c, i, places: voirie.spot(i).places },
    });
  }
  return { type: 'FeatureCollection', features };
}
