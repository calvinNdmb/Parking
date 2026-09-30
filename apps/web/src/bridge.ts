// Pont avec une application hôte : app Expo / React Native (react-native-webview)
// ou page web parente (iframe). La carte envoie des événements et accepte des
// commandes JSON — voir docs/EXPO.md.

import { DURATIONS, type Theme, type Vehicle } from '@parkprix/core';

export type LayerKey = 'street' | 'parkings' | 'subscribers' | 'zones' | 'velo' | 'moto' | 'belib' | 'coverage';

export type HostEvent =
  | { type: 'ready'; dataVersion: string }
  | { type: 'settings'; vehicle: Vehicle; minutes: number; start: string | null; theme: Theme }
  | { type: 'select'; kind: 'parking'; id: string; name: string; price: number | null; label: string; lon: number; lat: number }
  | { type: 'select'; kind: 'spot'; index: number; street: string; category: string; zone: number; price: number | null; lon: number; lat: number }
  | { type: 'select'; kind: 'belib'; name: string; lon: number; lat: number }
  | { type: 'deselect' }
  | { type: 'focus'; lon: number; lat: number; label: string }
  | { type: 'moveend'; lon: number; lat: number; zoom: number };

export type HostCommand =
  | { type: 'setVehicle'; vehicle: Vehicle }
  | { type: 'setDuration'; minutes: number }
  | { type: 'setStart'; start: string | null }
  | { type: 'setTheme'; theme: Theme }
  | { type: 'flyTo'; lon: number; lat: number; zoom?: number }
  | { type: 'focus'; lon: number; lat: number; label?: string }
  | { type: 'selectParking'; id: string }
  | { type: 'deselect' }
  | { type: 'setLayers'; layers: Partial<Record<LayerKey, boolean>> }
  | { type: 'setChrome'; visible: boolean };

interface RNWebView {
  postMessage(message: string): void;
}

const VEHICLES: Vehicle[] = ['voiture', 'suv', 'electrique', 'moto', 'velo'];
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Valide une commande reçue (les messages viennent d'une source externe). */
export function parseCommand(raw: unknown): HostCommand | null {
  let data = raw;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== 'object') return null;
  const c = data as Record<string, unknown>;
  switch (c.type) {
    case 'setVehicle':
      return VEHICLES.includes(c.vehicle as Vehicle) ? { type: 'setVehicle', vehicle: c.vehicle as Vehicle } : null;
    case 'setDuration':
      return DURATIONS.some((d) => d.min === c.minutes) ? { type: 'setDuration', minutes: c.minutes as number } : null;
    case 'setStart':
      return c.start === null || (typeof c.start === 'string' && !Number.isNaN(Date.parse(c.start))) ? { type: 'setStart', start: c.start as string | null } : null;
    case 'setTheme':
      return c.theme === 'day' || c.theme === 'night' ? { type: 'setTheme', theme: c.theme } : null;
    case 'flyTo':
      return isNum(c.lon) && isNum(c.lat) ? { type: 'flyTo', lon: c.lon, lat: c.lat, zoom: isNum(c.zoom) ? c.zoom : undefined } : null;
    case 'focus':
      return isNum(c.lon) && isNum(c.lat) ? { type: 'focus', lon: c.lon, lat: c.lat, label: typeof c.label === 'string' ? c.label.slice(0, 120) : undefined } : null;
    case 'selectParking':
      return typeof c.id === 'string' ? { type: 'selectParking', id: c.id } : null;
    case 'deselect':
      return { type: 'deselect' };
    case 'setLayers': {
      if (!c.layers || typeof c.layers !== 'object') return null;
      const layers: Partial<Record<LayerKey, boolean>> = {};
      for (const [k, v] of Object.entries(c.layers as Record<string, unknown>)) if (typeof v === 'boolean') layers[k as LayerKey] = v;
      return { type: 'setLayers', layers };
    }
    case 'setChrome':
      return typeof c.visible === 'boolean' ? { type: 'setChrome', visible: c.visible } : null;
    default:
      return null;
  }
}

export function postToHost(event: HostEvent) {
  const message = { source: 'parkprix', ...event };
  const rn = (window as unknown as { ReactNativeWebView?: RNWebView }).ReactNativeWebView;
  if (rn?.postMessage) rn.postMessage(JSON.stringify(message));
  else if (window.parent !== window) window.parent.postMessage(message, '*');
}

export function onHostCommand(handler: (command: HostCommand) => void) {
  const listener = (e: Event) => {
    const command = parseCommand((e as MessageEvent).data);
    if (command) handler(command);
  };
  window.addEventListener('message', listener);
  // Android (react-native-webview) émet les messages sur document.
  document.addEventListener('message', listener);
}

/** Réglages initiaux passés dans l'URL : ?vehicle=moto&duration=60&theme=night&chrome=0 */
export function readUrlOptions(search = location.search) {
  const q = new URLSearchParams(search);
  const vehicle = q.get('vehicle') as Vehicle | null;
  const minutes = Number(q.get('duration'));
  const theme = q.get('theme');
  return {
    vehicle: vehicle && VEHICLES.includes(vehicle) ? vehicle : null,
    minutes: DURATIONS.some((d) => d.min === minutes) ? minutes : null,
    theme: theme === 'day' || theme === 'night' ? (theme as Theme) : null,
    chrome: q.get('chrome') !== '0' && q.get('embed') !== 'map',
    parking: q.get('parking'),
  };
}
