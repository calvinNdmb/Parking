// Sources et calques « stationnement » ajoutés par-dessus le fond de carte.

import type { ExpressionSpecification, FilterSpecification, GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import { FIRST_LABEL_LAYER, FONT_BOLD, type Theme } from './basemap';
import { addPinImages } from './icons';

export const SRC = {
  zones: 'pp-zones',
  zoneLabels: 'pp-zone-labels',
  voirie: 'pp-voirie',
  parkings: 'pp-parkings',
  belib: 'pp-belib',
  coverage: 'pp-coverage',
} as const;

export const LAYER = {
  zonesFill: 'pp-zones-fill',
  zonesLine: 'pp-zones-line',
  zonesLabel: 'pp-zones-label',
  coverage: 'pp-coverage',
  voirieFill: 'pp-voirie-fill',
  voirieLine: 'pp-voirie-line',
  voirieSel: 'pp-voirie-sel',
  belib: 'pp-belib',
  parkDot: 'pp-parkings-dot',
  parkPin: 'pp-parkings-pin',
} as const;

export interface LayerSources {
  zones: FeatureCollection;
  zoneLabels: FeatureCollection;
  parkings: FeatureCollection;
  belib: FeatureCollection;
  voirie: FeatureCollection | null;
  coverage: FeatureCollection | null;
}

export interface LayerPaint {
  voirieColor: ExpressionSpecification;
  voirieOpacity: ExpressionSpecification;
  zoneColor: ExpressionSpecification;
}

const empty: FeatureCollection = { type: 'FeatureCollection', features: [] };

function ensureSource(map: MapLibreMap, id: string, data: FeatureCollection, extra: Record<string, unknown> = {}) {
  const src = map.getSource(id) as GeoJSONSource | undefined;
  if (src) src.setData(data);
  else map.addSource(id, { type: 'geojson', data, ...extra });
}

/** Installe (ou ré-installe après un changement de thème) tous les calques. */
export function installLayers(map: MapLibreMap, sources: LayerSources, paint: LayerPaint, theme: Theme) {
  addPinImages(map);
  ensureSource(map, SRC.zones, sources.zones);
  ensureSource(map, SRC.zoneLabels, sources.zoneLabels);
  ensureSource(map, SRC.parkings, sources.parkings);
  ensureSource(map, SRC.belib, sources.belib);
  ensureSource(map, SRC.coverage, sources.coverage ?? empty);
  ensureSource(map, SRC.voirie, sources.voirie ?? empty, { tolerance: 0, maxzoom: 16, buffer: 16 });

  const night = theme === 'night';
  const before = map.getLayer(FIRST_LABEL_LAYER) ? FIRST_LABEL_LAYER : undefined;
  const add = (layer: Parameters<MapLibreMap['addLayer']>[0], beforeId?: string) => {
    if (!map.getLayer(layer.id)) map.addLayer(layer, beforeId);
  };

  add(
    {
      id: LAYER.zonesFill,
      type: 'fill',
      source: SRC.zones,
      maxzoom: 16,
      paint: {
        'fill-color': paint.zoneColor,
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 10, night ? 0.16 : 0.2, 13.5, night ? 0.1 : 0.12, 15.5, 0],
      },
    },
    before,
  );
  add(
    {
      id: LAYER.coverage,
      type: 'fill',
      source: SRC.coverage,
      layout: { visibility: 'none' },
      paint: {
        'fill-color': ['case', ['==', ['get', 'ok'], 1], '#12b76a', '#f0463c'],
        'fill-opacity': 0.32,
        'fill-outline-color': night ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.5)',
      },
    },
    before,
  );
  add(
    {
      id: LAYER.zonesLine,
      type: 'line',
      source: SRC.zones,
      paint: {
        'line-color': paint.zoneColor,
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.5, 15, 3],
        'line-dasharray': [2, 1.5],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.8, 16, 0.35],
      },
    },
    before,
  );
  add(
    {
      id: LAYER.voirieFill,
      type: 'fill',
      source: SRC.voirie,
      minzoom: 17,
      paint: { 'fill-color': paint.voirieColor, 'fill-opacity': ['*', 0.85, paint.voirieOpacity] as unknown as ExpressionSpecification },
    },
    before,
  );
  add(
    {
      id: LAYER.voirieLine,
      type: 'line',
      source: SRC.voirie,
      minzoom: 13.5,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': paint.voirieColor,
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 13.5, 1, 15, 2.2, 16, 3.2, 18, 3.5, 20, 5],
        'line-opacity': paint.voirieOpacity,
      },
    },
    before,
  );
  add(
    {
      id: LAYER.voirieSel,
      type: 'line',
      source: SRC.voirie,
      filter: ['==', ['id'], -1],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#0a84ff', 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 5, 18, 8], 'line-opacity': 0.9 },
    },
    before,
  );
  add({
    id: LAYER.belib,
    type: 'symbol',
    source: SRC.belib,
    minzoom: 13,
    layout: {
      visibility: 'none',
      'icon-image': 'belib',
      'icon-size': ['interpolate', ['linear'], ['zoom'], 13, 0.65, 16, 1],
      'icon-allow-overlap': true,
    },
  });
  add({
    id: LAYER.parkDot,
    type: 'circle',
    source: SRC.parkings,
    minzoom: 10.5,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 10.5, 3, 16, 5],
      'circle-color': ['get', 'dot'],
      'circle-stroke-color': night ? '#18212c' : '#ffffff',
      'circle-stroke-width': 2,
    },
  });
  add({
    id: LAYER.parkPin,
    type: 'symbol',
    source: SRC.parkings,
    minzoom: 11.5,
    layout: {
      'text-field': ['get', 'label'],
      'text-font': FONT_BOLD,
      'text-size': ['interpolate', ['linear'], ['zoom'], 11.5, 11.5, 15, 14],
      'text-anchor': 'bottom',
      'text-offset': [0, -1],
      'text-padding': 1,
      'icon-image': ['get', 'icon'],
      // Largeur seule : la hauteur de la pastille (et le badge « P ») ne se déforme pas.
      'icon-text-fit': 'width',
      'icon-text-fit-padding': [0, 4, 0, 2],
      'symbol-sort-key': ['get', 'sort'],
    },
    paint: { 'text-color': ['get', 'ink'] },
  });
  add({
    id: LAYER.zonesLabel,
    type: 'symbol',
    source: SRC.zoneLabels,
    maxzoom: 14.5,
    layout: {
      'text-field': ['get', 'label'],
      'text-font': FONT_BOLD,
      'text-size': 13,
      'text-max-width': 14,
      'text-line-height': 1.25,
      'icon-image': night ? 'label-bg-dark' : 'label-bg',
      'icon-text-fit': 'both',
      'icon-text-fit-padding': [2, 4, 2, 4],
      'text-allow-overlap': false,
    },
    paint: { 'text-color': night ? '#e8eef5' : '#253240' },
  });
}

export function setSourceData(map: MapLibreMap, id: string, data: FeatureCollection) {
  (map.getSource(id) as GeoJSONSource | undefined)?.setData(data);
}

export function applyPaint(map: MapLibreMap, paint: LayerPaint) {
  if (!map.getLayer(LAYER.voirieLine)) return;
  map.setPaintProperty(LAYER.voirieLine, 'line-color', paint.voirieColor);
  map.setPaintProperty(LAYER.voirieLine, 'line-opacity', paint.voirieOpacity);
  map.setPaintProperty(LAYER.voirieFill, 'fill-color', paint.voirieColor);
  map.setPaintProperty(LAYER.voirieFill, 'fill-opacity', ['*', 0.85, paint.voirieOpacity]);
  map.setPaintProperty(LAYER.zonesFill, 'fill-color', paint.zoneColor);
  map.setPaintProperty(LAYER.zonesLine, 'line-color', paint.zoneColor);
}

export function setVisible(map: MapLibreMap, layerIds: string[], visible: boolean) {
  for (const id of layerIds) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
}

export function selectSpot(map: MapLibreMap, index: number | null) {
  if (!map.getLayer(LAYER.voirieSel)) return;
  const filter: FilterSpecification = ['==', ['id'], index ?? -1];
  map.setFilter(LAYER.voirieSel, filter);
}
