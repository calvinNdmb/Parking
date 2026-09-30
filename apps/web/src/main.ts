import 'maplibre-gl/dist/maplibre-gl.css';
import './styles.css';
import { AttributionControl, Map as MapLibreMap, Marker, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { FeatureCollection } from 'geojson';
import {
  DATA_VERSION,
  DURATIONS,
  INTERACTIVE_LAYERS,
  LAYERS,
  LAYER_GROUPS,
  SOURCES,
  TIER_COLORS,
  TIER_TEXT,
  TIER_THRESHOLDS,
  VEHICLES,
  buildBasemapStyle,
  createDataClient,
  durationLabel,
  effectiveStart,
  formatNumber,
  formatParisTime,
  fromParisWallClock,
  nearbyOptions,
  parisTime,
  parkingsFeatureCollection,
  quoteParking,
  quoteStreet,
  streetStatus,
  streetStyle,
  vehicleLabel,
  voiriePointsCollection,
  zoneLabelsFeatureCollection,
  type BelibProps,
  type CarPark,
  type CoreData,
  type ParkQuote,
  type Settings,
  type StreetStyle,
  type Theme,
  type Vehicle,
  type VoirieCategory,
  type VoirieData,
} from '@parkprix/core';
import { onHostCommand, postToHost, readUrlOptions, type HostCommand, type LayerKey } from './bridge';
import { applyPaint, installParkingLayers, selectSpot, setSourceData, setSpotIcons, setVisible } from './map/install';
import { renderBelibDetail, renderList, renderParkingDetail, renderSpotDetail } from './ui/sheet';
import { setupSearch } from './ui/search';
import { $, debounce, esc, storage } from './ui/dom';
import { ICONS } from './ui/svg';

setWorkerUrl(workerUrl);

const PARIS_CENTER: [number, number] = [2.3417, 48.859];
const data = createDataClient(import.meta.env.BASE_URL);

type Selection =
  | { kind: 'parking'; id: string }
  | { kind: 'spot'; index: number }
  | { kind: 'belib'; props: BelibProps; lon: number; lat: number }
  | null;

const url = readUrlOptions();
const storedVehicle = storage.get<Vehicle>('vehicle', 'voiture');
const storedMinutes = storage.get<number>('minutes', 120);
const state = {
  settings: {
    vehicle: url.vehicle ?? (VEHICLES.some((v) => v.id === storedVehicle) ? storedVehicle : 'voiture'),
    minutes: url.minutes ?? (DURATIONS.some((d) => d.min === storedMinutes) ? storedMinutes : 120),
    start: null,
  } as Settings,
  theme: url.theme ?? storage.get<Theme>('theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'day'),
  layers: {
    street: true,
    parkings: true,
    subscribers: true,
    zones: true,
    velo: false,
    moto: false,
    belib: false,
    coverage: false,
    ...storage.get<Partial<Record<LayerKey, boolean>>>('layers', {}),
  } as Record<LayerKey, boolean>,
  selection: null as Selection,
  focus: null as { lon: number; lat: number; label: string } | null,
  chrome: url.chrome,
};
state.layers.coverage = false;
if (state.theme !== 'day' && state.theme !== 'night') state.theme = 'day';
document.documentElement.dataset.theme = state.theme;
document.documentElement.dataset.chrome = state.chrome ? 'on' : 'off';

let core: CoreData;
let voirie: VoirieData | null = null;
let voiriePoints: FeatureCollection | null = null;
let coverageGrid: FeatureCollection | null = null;
let quotes = new Map<string, ParkQuote>();
let street: StreetStyle;
let parkById = new Map<string, CarPark>();
const categories = (): VoirieCategory[] => core.meta.categories;

const spriteUrl = () => new URL('sprites/parkprix', document.baseURI).href;
const styleFor = (theme: Theme) => buildBasemapStyle({ theme, spriteUrl: spriteUrl() });

const map = new MapLibreMap({
  container: 'map',
  style: styleFor(state.theme),
  center: PARIS_CENTER,
  zoom: window.innerWidth < 700 ? 12 : 12.6,
  minZoom: 10,
  maxZoom: 19.5,
  maxBounds: [
    [1.95, 48.68],
    [2.75, 49.03],
  ],
  attributionControl: false,
  dragRotate: false,
  pitchWithRotate: false,
  touchPitch: false,
  hash: true,
});
map.touchZoomRotate.disableRotation();
if (import.meta.env.DEV) Object.assign(window, { __parkprix: { map, state } });
map.addControl(
  new AttributionControl({
    compact: true,
    customAttribution: 'Données : <a href="https://opendata.paris.fr" target="_blank" rel="noopener">Paris Data</a> (ODbL), Saemes, Indigo, BNLS, OSM',
  }),
  'bottom-right',
);
const desktop = () => window.innerWidth >= 900 && state.chrome;
if (desktop()) map.setPadding({ left: 420, top: 0, right: 0, bottom: 0 });

// ---------------------------------------------------------------------------
// Calques
// ---------------------------------------------------------------------------
const pins = () =>
  parkingsFeatureCollection(core.parkings, quotes, state.settings, {
    showSubscribers: state.layers.subscribers,
    selectedId: state.selection?.kind === 'parking' ? state.selection.id : null,
  });

/** Catégories dont les icônes (vélo, moto) sont affichées sur la carte. */
function iconCategories(): VoirieCategory[] {
  const v = state.settings.vehicle;
  const out: VoirieCategory[] = [];
  if (state.layers.velo || v === 'velo') out.push('velo');
  if (state.layers.moto || v === 'moto') out.push('moto');
  return out;
}

function install() {
  installParkingLayers(
    map,
    {
      zones: core.zones,
      zoneLabels: zoneLabelsFeatureCollection(street, state.settings),
      parkings: pins(),
      belib: core.belib,
      voirie: voirie?.geojson ?? null,
      voiriePoints,
      coverage: coverageGrid,
    },
    {
      theme: state.theme,
      paint: { voirieColor: street.color, voirieOpacity: street.opacity, zoneColor: street.zoneColor },
      categories: categories(),
      iconCategories: iconCategories(),
    },
  );
  applyVisibility();
  selectSpot(map, state.selection?.kind === 'spot' ? state.selection.index : null);
}

function applyVisibility() {
  const L = state.layers;
  setVisible(map, LAYER_GROUPS.street, L.street);
  setVisible(map, LAYER_GROUPS.parkings, L.parkings);
  setVisible(map, LAYER_GROUPS.zones, L.zones);
  setVisible(map, LAYER_GROUPS.belib, L.belib || state.settings.vehicle === 'electrique');
  setVisible(map, LAYER_GROUPS.coverage, L.coverage);
  if (voirie) setSpotIcons(map, categories(), iconCategories());
}

/** Recalcule les prix affichés pour les réglages courants. */
function refresh({ sheet = true } = {}) {
  quotes = new Map(core.parkings.map((p) => [p.id, quoteParking(p, state.settings)]));
  street = streetStyle(state.settings, core.meta.tariffs, categories());
  if (map.getSource(SOURCES.parkings)) {
    setSourceData(map, SOURCES.parkings, pins());
    setSourceData(map, SOURCES.zoneLabels, zoneLabelsFeatureCollection(street, state.settings));
    applyPaint(map, { voirieColor: street.color, voirieOpacity: street.opacity, zoneColor: street.zoneColor });
    applyVisibility();
  }
  renderChips();
  renderStatus();
  if (sheet) renderSheet();
  postToHost({ type: 'settings', vehicle: state.settings.vehicle, minutes: state.settings.minutes, start: state.settings.start?.toISOString() ?? null, theme: state.theme });
}

// ---------------------------------------------------------------------------
// Barre du haut : véhicule, durée, heure d'arrivée
// ---------------------------------------------------------------------------
const VEHICLE_ICONS: Record<Vehicle, string> = { voiture: ICONS.car, suv: ICONS.suv, electrique: ICONS.bolt, moto: ICONS.moto, velo: ICONS.bike };

const startLabel = () => (state.settings.start ? formatParisTime(state.settings.start, 'short-date-time') : 'Maintenant');

function renderChips() {
  const s = state.settings;
  // Comme les boutons Waze : icône seule, libellé affiché pour le véhicule choisi.
  $('#vehicle-chips').innerHTML = VEHICLES.map(
    (v) =>
      `<button type="button" class="chip vehicle${v.id === s.vehicle ? '' : ' icon-only'}" role="radio" aria-checked="${v.id === s.vehicle}" data-vehicle="${v.id}" aria-label="${esc(v.label)}" title="${esc(`${v.label} — ${v.hint}`)}">${VEHICLE_ICONS[v.id]}<span>${v.label}</span></button>`,
  ).join('');
  const durations = s.vehicle === 'velo' ? '' : DURATIONS.map((d) => `<button type="button" class="chip" role="radio" aria-checked="${d.min === s.minutes}" data-minutes="${d.min}">${d.label}</button>`).join('');
  $('#duration-chips').innerHTML = `<button type="button" class="chip time" data-action="time" aria-haspopup="dialog">${ICONS.clock}<span>${esc(startLabel())}</span></button>${durations}`;
  document.querySelector<HTMLElement>('#duration-chips [aria-checked="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function setVehicle(vehicle: Vehicle) {
  state.settings.vehicle = vehicle;
  storage.set('vehicle', vehicle);
  refresh();
}
function setDuration(minutes: number) {
  state.settings.minutes = minutes;
  storage.set('minutes', minutes);
  refresh();
}

function setupChips() {
  $('#vehicle-chips').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-vehicle]');
    if (b) setVehicle(b.dataset.vehicle as Vehicle);
  });
  $('#duration-chips').addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-action="time"]')) return toggleTimePop();
    const b = t.closest<HTMLElement>('[data-minutes]');
    if (b) setDuration(Number(b.dataset.minutes));
  });
  $('#time-now').addEventListener('click', () => {
    state.settings.start = null;
    $('#time-pop').hidden = true;
    refresh();
  });
  $('#time-ok').addEventListener('click', () => {
    const v = $<HTMLInputElement>('#time-input').value; // « AAAA-MM-JJTHH:MM », heure de Paris
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v);
    state.settings.start = m ? fromParisWallClock(+m[1], +m[2], +m[3], +m[4], +m[5]) : null;
    $('#time-pop').hidden = true;
    refresh();
  });
}

function toggleTimePop() {
  const pop = $('#time-pop');
  pop.hidden = !pop.hidden;
  if (pop.hidden) return;
  const t = parisTime(effectiveStart(state.settings));
  const pad = (n: number) => String(n).padStart(2, '0');
  $<HTMLInputElement>('#time-input').value = `${t.year}-${pad(t.month)}-${pad(t.day)}T${pad(t.hour)}:${pad(Math.floor(t.minute / 15) * 15)}`;
}

function renderStatus() {
  const el = $('#status');
  if (state.settings.vehicle === 'velo') {
    el.className = 'status';
    el.innerHTML = '<span class="dot"></span>Stationnement vélo gratuit sur rue';
    return;
  }
  const st = streetStatus(new Date());
  el.className = `status${st.paid ? ' paid' : ''}`;
  el.innerHTML = `<span class="dot"></span>${esc(st.text)}`;
}

function renderLegend() {
  const [a, b, c, d] = TIER_THRESHOLDS;
  const n = (v: number) => String(v).replace('.', ',');
  const items: [keyof typeof TIER_COLORS, string][] = [
    ['free', '0'],
    ['t1', `≤${n(a)}`],
    ['t2', `≤${n(b)}`],
    ['t3', `≤${n(c)}`],
    ['t4', `≤${n(d)}`],
    ['t5', `>${n(d)}`],
  ];
  $('#legend').innerHTML =
    items.map(([t, l]) => `<span class="sw" style="background:${TIER_COLORS[t]};color:${TIER_TEXT[t]}">${l}</span>`).join('') + '<span class="unit">€/h</span>';
}

// ---------------------------------------------------------------------------
// Panneau : liste / fiches
// ---------------------------------------------------------------------------
const sheet = $('#sheet');
const setSheet = (s: 'peek' | 'open') => (sheet.dataset.state = s);

function listCenter(): [number, number] {
  if (state.focus) return [state.focus.lon, state.focus.lat];
  const c = map.getCenter();
  return [c.lng, c.lat];
}

function renderSheet() {
  const body = $('#sheet-body');
  const sel = state.selection;
  const s = state.settings;
  if (sel?.kind === 'parking') {
    const p = parkById.get(sel.id);
    if (p) body.innerHTML = renderParkingDetail(p, quotes.get(p.id)!, s);
    return;
  }
  if (sel?.kind === 'spot' && voirie) {
    const spot = voirie.spot(sel.index);
    const q = quoteStreet({ zone: spot.zone, category: spot.cat, vehicle: s.vehicle, start: effectiveStart(s), minutes: s.minutes, tariffs: core.meta.tariffs });
    body.innerHTML = renderSpotDetail(spot, s, core.meta.tariffs, q, new Date());
    return;
  }
  if (sel?.kind === 'belib') {
    body.innerHTML = renderBelibDetail(sel.props, sel.lon, sel.lat);
    return;
  }
  const result = nearbyOptions(listCenter(), s, core.parkings, quotes, voirie, core.meta.tariffs);
  const where = state.focus ? state.focus.label : 'Centre de la carte';
  const what = s.vehicle === 'velo' ? 'Vélo' : `${durationLabel(s.minutes)} · ${vehicleLabel(s.vehicle)} · ${startLabel()}`;
  body.innerHTML = renderList(s.vehicle === 'velo' ? 'Se garer à vélo' : 'Les moins chers autour', `${where} · ${what}`, result, !voirie, s.vehicle);
}

function targetOf(sel: NonNullable<Selection>): [number, number] {
  if (sel.kind === 'parking') {
    const p = parkById.get(sel.id)!;
    return [p.lon, p.lat];
  }
  if (sel.kind === 'spot') {
    const spot = voirie!.spot(sel.index);
    return [spot.lon, spot.lat];
  }
  return [sel.lon, sel.lat];
}

function select(sel: Selection, { fly = false } = {}) {
  state.selection = sel;
  selectSpot(map, sel?.kind === 'spot' ? sel.index : null);
  if (map.getSource(SOURCES.parkings)) setSourceData(map, SOURCES.parkings, pins());
  renderSheet();
  $('#sheet-body').scrollTop = 0;
  if (sel) setSheet('open');
  if (fly && sel) map.easeTo({ center: targetOf(sel), zoom: Math.max(map.getZoom(), sel.kind === 'spot' ? 17 : 15.5), padding: mapPadding(), duration: 700 });
  notifySelection(sel);
}

function notifySelection(sel: Selection) {
  if (!sel) return postToHost({ type: 'deselect' });
  const [lon, lat] = targetOf(sel);
  if (sel.kind === 'parking') {
    const p = parkById.get(sel.id)!;
    const q = quotes.get(p.id)!;
    postToHost({ type: 'select', kind: 'parking', id: p.id, name: p.name, price: q.price, label: q.label, lon, lat });
  } else if (sel.kind === 'spot') {
    const spot = voirie!.spot(sel.index);
    const s = state.settings;
    const q = quoteStreet({ zone: spot.zone, category: spot.cat, vehicle: s.vehicle, start: effectiveStart(s), minutes: s.minutes, tariffs: core.meta.tariffs });
    postToHost({ type: 'select', kind: 'spot', index: spot.index, street: spot.street, category: spot.cat, zone: spot.zone, price: q.allowed ? q.price : null, lon, lat });
  } else {
    postToHost({ type: 'select', kind: 'belib', name: sel.props.name, lon, lat });
  }
}

/** Décale le centrage pour ne pas cacher la cible derrière le panneau. */
function mapPadding() {
  if (desktop()) return { left: 420, top: 0, right: 0, bottom: 0 };
  if (!state.chrome) return { top: 0, bottom: 0, left: 0, right: 0 };
  return { top: 150, bottom: Math.round(window.innerHeight * 0.45), left: 0, right: 0 };
}

let focusMarker: Marker | null = null;
function setFocus(lon: number, lat: number, label: string) {
  state.focus = { lon, lat, label };
  state.selection = null;
  selectSpot(map, null);
  if (map.getSource(SOURCES.parkings)) setSourceData(map, SOURCES.parkings, pins());
  if (!focusMarker) {
    const el = document.createElement('div');
    el.innerHTML = `<svg class="focus-pin" viewBox="0 0 34 44"><path d="M17 43s15-14.2 15-25.5a15 15 0 1 0-30 0C2 28.8 17 43 17 43Z" fill="#33ccff" stroke="#0b2533" stroke-width="2.5"/><circle cx="17" cy="17" r="6" fill="#fff" stroke="#0b2533" stroke-width="2.5"/></svg>`;
    focusMarker = new Marker({ element: el, anchor: 'bottom' });
  }
  focusMarker.setLngLat([lon, lat]).addTo(map);
  renderSheet();
  setSheet('open');
  postToHost({ type: 'focus', lon, lat, label });
}

function setupSheet() {
  $('#sheet-body').addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-action="back"]')) return select(null);
    const opt = t.closest<HTMLElement>('.option');
    if (!opt) return;
    if (opt.dataset.kind === 'parking') select({ kind: 'parking', id: opt.dataset.key! }, { fly: true });
    else select({ kind: 'spot', index: Number(opt.dataset.key) }, { fly: true });
  });
  const handle = $('#sheet-handle');
  let startY: number | null = null;
  handle.addEventListener('pointerdown', (e) => {
    startY = e.clientY;
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener('pointerup', (e) => {
    if (startY == null) return;
    const dy = e.clientY - startY;
    startY = null;
    if (dy < -24) setSheet('open');
    else if (dy > 24) setSheet('peek');
    else setSheet(sheet.dataset.state === 'open' ? 'peek' : 'open');
  });
}

// ---------------------------------------------------------------------------
// Carte : clics et survol
// ---------------------------------------------------------------------------
const activeLayers = () => INTERACTIVE_LAYERS.filter((id) => map.getLayer(id) && map.getLayoutProperty(id, 'visibility') !== 'none');

function setupMapEvents() {
  map.on('click', (e) => {
    const r = 10;
    const features = map.queryRenderedFeatures(
      [
        [e.point.x - r, e.point.y - r],
        [e.point.x + r, e.point.y + r],
      ],
      { layers: [...activeLayers()] },
    );
    const park = features.find((f) => f.layer.id === LAYERS.parkP || f.layer.id === LAYERS.parkBubble);
    if (park) return select({ kind: 'parking', id: String(park.properties.id) });
    const bel = features.find((f) => f.layer.id === LAYERS.belib);
    if (bel && bel.geometry.type === 'Point') {
      const [lon, lat] = bel.geometry.coordinates;
      return select({ kind: 'belib', props: bel.properties as BelibProps, lon, lat });
    }
    const icon = features.find((f) => f.layer.id === LAYERS.spotIcons);
    if (icon) return select({ kind: 'spot', index: Number(icon.properties.i) });
    const spots = features.filter((f) => (f.layer.id === LAYERS.voirieLine || f.layer.id === LAYERS.voirieFill) && f.id != null);
    if (spots.length && voirie) {
      const { lng, lat } = e.lngLat;
      const dist = (i: number) => Math.hypot(voirie!.centers[i * 2] - lng, voirie!.centers[i * 2 + 1] - lat);
      const nearest = spots.map((f) => Number(f.id)).sort((a, b) => dist(a) - dist(b))[0];
      return select({ kind: 'spot', index: nearest });
    }
    setFocus(e.lngLat.lng, e.lngLat.lat, 'Point choisi sur la carte');
  });
  map.on('mousemove', (e) => {
    const hit = map.queryRenderedFeatures(
      [
        [e.point.x - 6, e.point.y - 6],
        [e.point.x + 6, e.point.y + 6],
      ],
      { layers: [...activeLayers()] },
    ).length;
    map.getCanvas().style.cursor = hit ? 'pointer' : '';
  });
  const onMove = debounce(() => {
    if (!state.selection && !state.focus) renderSheet();
    const c = map.getCenter();
    postToHost({ type: 'moveend', lon: c.lng, lat: c.lat, zoom: map.getZoom() });
  }, 250);
  map.on('moveend', onMove);
}

// ---------------------------------------------------------------------------
// Boutons flottants, calques, couverture
// ---------------------------------------------------------------------------
function renderFabs() {
  $('#btn-locate').innerHTML = ICONS.locate;
  $('#btn-theme').innerHTML = state.theme === 'night' ? ICONS.sun : ICONS.moon;
  $('#btn-layers').innerHTML = ICONS.layers;
  $('#search-clear').innerHTML = ICONS.close;
}

function setTheme(theme: Theme) {
  if (theme === state.theme) return;
  state.theme = theme;
  storage.set('theme', theme);
  document.documentElement.dataset.theme = theme;
  renderFabs();
  map.setStyle(styleFor(theme), { diff: false });
  map.once('style.load', install);
  postToHost({ type: 'settings', vehicle: state.settings.vehicle, minutes: state.settings.minutes, start: state.settings.start?.toISOString() ?? null, theme });
}

function setupFabs() {
  $('#btn-theme').addEventListener('click', () => setTheme(state.theme === 'night' ? 'day' : 'night'));
  $('#btn-locate').addEventListener('click', () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const inParis = coords.longitude > 2.22 && coords.longitude < 2.47 && coords.latitude > 48.81 && coords.latitude < 48.91;
        if (!inParis) {
          $('#status').innerHTML = '<span class="dot"></span>Vous semblez hors de Paris';
          return;
        }
        map.flyTo({ center: [coords.longitude, coords.latitude], zoom: 16, padding: mapPadding() });
        setFocus(coords.longitude, coords.latitude, 'Ma position');
      },
      () => ($('#status').innerHTML = '<span class="dot"></span>Localisation refusée'),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  });
  const panel = $('#layers-panel');
  $('#btn-layers').addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    $('#btn-layers').setAttribute('aria-expanded', String(!panel.hidden));
  });
  panel.querySelectorAll<HTMLInputElement>('input[data-layer]').forEach((input) => {
    const key = input.dataset.layer as LayerKey;
    input.checked = state.layers[key];
    input.addEventListener('change', () => setLayer(key, input.checked));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    panel.hidden = true;
    $('#time-pop').hidden = true;
  });
}

async function setLayer(key: LayerKey, on: boolean) {
  state.layers[key] = on;
  const input = document.querySelector<HTMLInputElement>(`input[data-layer="${key}"]`);
  if (input) input.checked = on;
  storage.set('layers', { ...state.layers, coverage: false });
  if (key === 'coverage' && on && !coverageGrid) {
    coverageGrid = await data.loadCoverageGrid();
    setSourceData(map, SOURCES.coverage, coverageGrid);
  }
  if (key === 'subscribers') setSourceData(map, SOURCES.parkings, pins());
  applyVisibility();
}

const pct = (v: number, d = 1) => `${(v * 100).toFixed(d).replace('.', ',')} %`;

function renderCoverage() {
  const c = core.meta.coverage;
  $('#btn-coverage').innerHTML = `<span class="ring" style="--pct:${(c.spatial * 100).toFixed(1)}"></span><span class="label">Couverture</span> ${pct(c.spatial, 0)}`;
  const bars = Object.entries(c.byArrondissement)
    .map(([ar, v]) => `<span>${ar}<sup>${ar === '1' ? 'er' : 'e'}</sup></span><span class="bar"><i style="width:${(v * 100).toFixed(1)}%"></i></span><span>${pct(v, 0)}</span>`)
    .join('');
  const sources = core.meta.sources
    .map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a> — ${esc(s.provider)}, ${esc(s.license)}${s.records != null ? ` · ${formatNumber(s.records)} enr.` : ''}</li>`)
    .join('');
  const generated = new Date(core.meta.generatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const velo = c.voirie.byCategory.velo ?? 0;
  const moto = c.voirie.byCategory.moto ?? 0;
  $('#coverage-body').innerHTML = `
    <button class="icon-btn dialog-close" data-action="close" aria-label="Fermer">${ICONS.close}</button>
    <h2 id="coverage-title">Couverture des données</h2>
    <p class="muted">Part du territoire parisien où un prix de stationnement est connu à moins de ${c.walkM} m (≈ 3 min à pied), calculée sur une grille de mailles de ${c.cellM} m.</p>
    <div class="big-stat"><strong>${pct(c.spatial)}</strong><span>de Paris couvert (objectif : 80 %)</span></div>
    <div class="stat-grid">
      <div class="stat"><strong>${formatNumber(c.voirie.places)}</strong><span>places voiture sur rue tarifées (${pct(c.voirie.share, 0)})</span></div>
      <div class="stat"><strong>${c.parkings.covered}</strong><span>parkings fermés marqués « P », dont ${c.parkings.priced} avec tarifs ouverts</span></div>
      <div class="stat"><strong>${formatNumber(velo)}</strong><span>places vélo sur rue</span></div>
      <div class="stat"><strong>${formatNumber(moto)}</strong><span>places deux-roues motorisés sur rue</span></div>
      <div class="stat"><strong>${pct(c.places.share, 0)}</strong><span>des ${formatNumber(c.places.total)} places voiture publiques ont un prix</span></div>
      <div class="stat"><strong>${pct(c.spatialStrict, 0)}</strong><span>des mailles contiennent elles-mêmes un prix</span></div>
    </div>
    <h3>Par arrondissement</h3>
    <div class="bars">${bars}</div>
    <p><button type="button" class="btn btn-primary" data-action="toggle-coverage">${state.layers.coverage ? 'Masquer' : 'Afficher'} la carte de couverture</button></p>
    <h3>Sources gratuites et ouvertes</h3>
    <ul class="sources">${sources}</ul>
    <p class="muted">Données générées le ${esc(generated)} (API de données ${DATA_VERSION}). Les bois de Boulogne (16e) et de Vincennes (12e) comptent peu de places tarifées, ce qui abaisse la moyenne de ces arrondissements. ${c.meters ? `Contrôle : ${formatNumber(c.meters.ok)} horodateurs sur ${formatNumber(c.meters.ok + c.meters.mismatch)} affichent le tarif de leur zone.` : ''}</p>`;
}

function setupCoverage() {
  const dialog = $<HTMLDialogElement>('#coverage-dialog');
  $('#btn-coverage').addEventListener('click', () => {
    renderCoverage();
    dialog.showModal();
  });
  dialog.addEventListener('click', async (e) => {
    const t = e.target as HTMLElement;
    if (t === dialog || t.closest('[data-action="close"]')) return dialog.close();
    if (t.closest('[data-action="toggle-coverage"]')) {
      await setLayer('coverage', !state.layers.coverage);
      dialog.close();
      if (state.layers.coverage) map.fitBounds([[2.224, 48.8155], [2.4698, 48.9022]], { padding: 40 });
    }
  });
}

// ---------------------------------------------------------------------------
// Commandes de l'application hôte (Expo / iframe)
// ---------------------------------------------------------------------------
function handleCommand(cmd: HostCommand) {
  switch (cmd.type) {
    case 'setVehicle':
      return setVehicle(cmd.vehicle);
    case 'setDuration':
      return setDuration(cmd.minutes);
    case 'setStart':
      state.settings.start = cmd.start ? new Date(cmd.start) : null;
      return refresh();
    case 'setTheme':
      return setTheme(cmd.theme);
    case 'flyTo':
      return void map.flyTo({ center: [cmd.lon, cmd.lat], zoom: cmd.zoom ?? Math.max(map.getZoom(), 15.5), padding: mapPadding() });
    case 'focus':
      map.flyTo({ center: [cmd.lon, cmd.lat], zoom: Math.max(map.getZoom(), 16), padding: mapPadding() });
      return setFocus(cmd.lon, cmd.lat, cmd.label ?? 'Destination');
    case 'selectParking':
      return parkById.has(cmd.id) ? select({ kind: 'parking', id: cmd.id }, { fly: true }) : undefined;
    case 'deselect':
      return select(null);
    case 'setLayers':
      for (const [k, v] of Object.entries(cmd.layers)) if (k in state.layers) void setLayer(k as LayerKey, v as boolean);
      return;
    case 'setChrome':
      state.chrome = cmd.visible;
      document.documentElement.dataset.chrome = cmd.visible ? 'on' : 'off';
      map.setPadding(desktop() ? { left: 420, top: 0, right: 0, bottom: 0 } : { left: 0, top: 0, right: 0, bottom: 0 });
      return;
  }
}

// ---------------------------------------------------------------------------
async function main() {
  renderFabs();
  renderLegend();
  renderChips();
  renderStatus();
  setupChips();
  setupSheet();
  setupFabs();
  setupCoverage();
  setupSearch((place) => {
    map.flyTo({ center: [place.lon, place.lat], zoom: 16.2, padding: mapPadding() });
    setFocus(place.lon, place.lat, place.label);
  });
  onHostCommand(handleCommand);
  document.body.insertAdjacentHTML('beforeend', '<div class="loading-bar" id="loading"></div>');

  const mapReady = new Promise<void>((resolve) => map.once('load', () => resolve()));
  core = await data.loadCore();
  parkById = new Map(core.parkings.map((p) => [p.id, p]));
  refresh({ sheet: false });
  renderCoverage();
  await mapReady;
  // L'attribution compacte s'ouvre par défaut : on la replie pour ne pas masquer la carte sur mobile.
  document.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
  install();
  setupMapEvents();
  renderSheet();
  if (url.parking && parkById.has(url.parking)) select({ kind: 'parking', id: url.parking }, { fly: true });

  voirie = await data.loadVoirie();
  voiriePoints = voiriePointsCollection(voirie, ['velo', 'moto']);
  setSourceData(map, SOURCES.voirie, voirie.geojson);
  setSourceData(map, SOURCES.voiriePoints, voiriePoints);
  applyVisibility();
  document.getElementById('loading')?.remove();
  renderSheet();
  postToHost({ type: 'ready', dataVersion: DATA_VERSION });

  // Les prix « maintenant » évoluent avec l'heure (passage payant / gratuit) : on
  // recalcule à chaque nouveau quart d'heure, granularité de la tarification.
  let quarter = Math.floor(Date.now() / 900_000);
  setInterval(() => {
    renderStatus();
    const q = Math.floor(Date.now() / 900_000);
    if (q === quarter || state.settings.start) return;
    quarter = q;
    refresh({ sheet: !state.selection });
  }, 60_000);
}

main().catch((err) => {
  console.error(err);
  $('#sheet-body').innerHTML = `<p class="empty">Impossible de charger les données (${esc((err as Error).message)}).</p>`;
  document.getElementById('loading')?.remove();
});
