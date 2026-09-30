// Branche les sources et calques du cœur (@parkprix/core) sur une carte MapLibre GL JS.

import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import {
  FIRST_LABEL_LAYER,
  LAYERS,
  SOURCES,
  VOIRIE_SOURCE_OPTIONS,
  parkingLayers,
  spotIconsFilter,
  type ParkingLayerOptions,
  type ParkingLayerPaint,
  type VoirieCategory,
} from '@parkprix/core';

const empty: FeatureCollection = { type: 'FeatureCollection', features: [] };

export interface MapSources {
  zones: FeatureCollection;
  zoneLabels: FeatureCollection;
  parkings: FeatureCollection;
  belib: FeatureCollection;
  voirie: FeatureCollection | null;
  voiriePoints: FeatureCollection | null;
  coverage: FeatureCollection | null;
}

function ensureSource(map: MapLibreMap, id: string, data: FeatureCollection, extra: Record<string, unknown> = {}) {
  const src = map.getSource(id) as GeoJSONSource | undefined;
  if (src) src.setData(data);
  else map.addSource(id, { type: 'geojson', data, ...extra });
}

/** Installe (ou réinstalle après un changement de style jour/nuit) sources et calques. */
export function installParkingLayers(map: MapLibreMap, sources: MapSources, options: ParkingLayerOptions) {
  ensureSource(map, SOURCES.zones, sources.zones);
  ensureSource(map, SOURCES.zoneLabels, sources.zoneLabels);
  ensureSource(map, SOURCES.parkings, sources.parkings);
  ensureSource(map, SOURCES.belib, sources.belib);
  ensureSource(map, SOURCES.coverage, sources.coverage ?? empty);
  ensureSource(map, SOURCES.voirie, sources.voirie ?? empty, { ...VOIRIE_SOURCE_OPTIONS });
  ensureSource(map, SOURCES.voiriePoints, sources.voiriePoints ?? empty);
  const { below, above } = parkingLayers(options);
  const before = map.getLayer(FIRST_LABEL_LAYER) ? FIRST_LABEL_LAYER : undefined;
  for (const layer of below) if (!map.getLayer(layer.id)) map.addLayer(layer as Parameters<MapLibreMap['addLayer']>[0], before);
  for (const layer of above) if (!map.getLayer(layer.id)) map.addLayer(layer as Parameters<MapLibreMap['addLayer']>[0]);
}

export function setSourceData(map: MapLibreMap, id: string, data: FeatureCollection) {
  (map.getSource(id) as GeoJSONSource | undefined)?.setData(data);
}

export function applyPaint(map: MapLibreMap, paint: ParkingLayerPaint) {
  if (!map.getLayer(LAYERS.voirieLine)) return;
  map.setPaintProperty(LAYERS.voirieLine, 'line-color', paint.voirieColor);
  map.setPaintProperty(LAYERS.voirieLine, 'line-opacity', paint.voirieOpacity);
  map.setPaintProperty(LAYERS.voirieFill, 'fill-color', paint.voirieColor);
  map.setPaintProperty(LAYERS.voirieFill, 'fill-opacity', ['*', 0.85, paint.voirieOpacity]);
  map.setPaintProperty(LAYERS.zonesFill, 'fill-color', paint.zoneColor);
  map.setPaintProperty(LAYERS.zonesLine, 'line-color', paint.zoneColor);
}

export function setVisible(map: MapLibreMap, layerIds: readonly string[], visible: boolean) {
  for (const id of layerIds) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
}

export function setSpotIcons(map: MapLibreMap, categories: VoirieCategory[], visible: VoirieCategory[]) {
  if (map.getLayer(LAYERS.spotIcons)) map.setFilter(LAYERS.spotIcons, spotIconsFilter(categories, visible));
}

export function selectSpot(map: MapLibreMap, index: number | null) {
  if (map.getLayer(LAYERS.voirieSel)) map.setFilter(LAYERS.voirieSel, ['==', ['id'], index ?? -1]);
}
