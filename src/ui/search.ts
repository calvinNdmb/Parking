// Recherche d'adresse / de lieu : API de géocodage de la Géoplateforme IGN
// (gratuite, sans clé, CORS ouvert, 50 req/s) — successeur de api-adresse.data.gouv.fr.

import { $, debounce, esc } from './dom';

const ENDPOINT = 'https://data.geopf.fr/geocodage/search';

export interface Place {
  label: string;
  context: string;
  lon: number;
  lat: number;
  kind: 'address' | 'poi';
}

const first = (v: unknown) => (Array.isArray(v) ? v[0] : v) as string | undefined;
const isParis = (postcode: unknown) => (Array.isArray(postcode) ? postcode : [postcode]).some((p) => /^75\d{3}$/.test(String(p ?? '')));

export async function geocode(query: string, signal?: AbortSignal): Promise<Place[]> {
  const q = /paris|75\d{3}/i.test(query) ? query : `${query} Paris`;
  const url = `${ENDPOINT}?${new URLSearchParams({ q, limit: '10', index: 'address,poi', lat: '48.8566', lon: '2.3522' })}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Géocodage : HTTP ${res.status}`);
  const json = (await res.json()) as { features?: { geometry: { coordinates: [number, number] }; properties: Record<string, unknown> }[] };
  const seen = new Set<string>();
  const places: Place[] = [];
  for (const f of json.features ?? []) {
    const p = f.properties;
    if (!isParis(p.postcode)) continue;
    const kind = p._type === 'poi' ? 'poi' : 'address';
    const label = kind === 'poi' ? (first(p.name) ?? first(p.toponym) ?? '') : String(p.name ?? p.label ?? '');
    const postcode = first(p.postcode) ?? '';
    const context = kind === 'poi' ? [first(p.category), postcode].filter(Boolean).join(' · ') : `${postcode} Paris`;
    const key = `${label}|${postcode}`;
    if (!label || seen.has(key)) continue;
    seen.add(key);
    places.push({ label, context, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], kind });
  }
  return places.slice(0, 6);
}

export function setupSearch(onPick: (place: Place) => void) {
  const input = $<HTMLInputElement>('#search-input');
  const list = $<HTMLUListElement>('#search-results');
  const clear = $<HTMLButtonElement>('#search-clear');
  let controller: AbortController | undefined;
  let results: Place[] = [];
  let active = -1;

  const close = () => {
    list.hidden = true;
    active = -1;
  };
  const render = () => {
    list.innerHTML = results.length
      ? results
          .map(
            (r, i) =>
              `<li role="option" aria-selected="${i === active}" data-i="${i}"><strong>${esc(r.label)}</strong><small>${esc(r.context)}</small></li>`,
          )
          .join('')
      : '<li class="muted">Aucun résultat dans Paris</li>';
    list.hidden = false;
  };
  const pick = (i: number) => {
    const r = results[i];
    if (!r) return;
    input.value = r.label;
    close();
    input.blur();
    onPick(r);
  };
  const run = debounce(async (q: string) => {
    controller?.abort();
    if (q.trim().length < 3) return close();
    controller = new AbortController();
    try {
      results = await geocode(q.trim(), controller.signal);
      active = results.length ? 0 : -1;
      render();
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        results = [];
        list.innerHTML = '<li class="muted">Recherche indisponible pour le moment</li>';
        list.hidden = false;
      }
    }
  }, 250);

  input.addEventListener('input', () => {
    clear.hidden = !input.value;
    run(input.value);
  });
  input.addEventListener('keydown', (e) => {
    if (list.hidden) return;
    if (e.key === 'ArrowDown') active = Math.min(results.length - 1, active + 1);
    else if (e.key === 'ArrowUp') active = Math.max(0, active - 1);
    else if (e.key === 'Enter') return pick(Math.max(0, active));
    else if (e.key === 'Escape') return close();
    else return;
    e.preventDefault();
    render();
  });
  list.addEventListener('pointerdown', (e) => {
    const li = (e.target as HTMLElement).closest('li[data-i]') as HTMLElement | null;
    if (li) {
      e.preventDefault();
      pick(Number(li.dataset.i));
    }
  });
  input.addEventListener('blur', () => setTimeout(close, 150));
  clear.addEventListener('click', () => {
    input.value = '';
    clear.hidden = true;
    close();
    input.focus();
  });
}
