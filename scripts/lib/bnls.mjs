// Base nationale des lieux de stationnement (BNLS) — schéma
// https://schema.data.gouv.fr/etalab/schema-stationnement/ (CSV séparé par « ; » ou « , »).

/** Parseur CSV minimal (guillemets, séparateur auto-détecté). */
export function parseCsv(text) {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.slice(0, clean.indexOf('\n'));
  const sep = (firstLine.match(/;/g) ?? []).length > (firstLine.match(/,/g) ?? []).length ? ';' : ',';
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && clean[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...data] = rows;
  return data.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

const num = (v) => {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/** Lignes BNLS → objets « parking » normalisés (mêmes clés que les autres sources). */
export function parseBnlsCsv(text, { pricesDate = null } = {}) {
  return parseCsv(text)
    .map((r) => {
      const lon = num(r.Xlong ?? r.xlong);
      const lat = num(r.Ylat ?? r.ylat);
      if (lon == null || lat == null) return null;
      const free = r.gratuit === '1' || r.gratuit === 'true';
      const prices = {};
      for (const [min, k] of [
        [60, 'tarif_1h'],
        [120, 'tarif_2h'],
        [180, 'tarif_3h'],
        [240, 'tarif_4h'],
        [1440, 'tarif_24h'],
      ]) {
        const v = num(r[k]);
        if (v != null) prices[min] = v;
      }
      const subscribers = /abonn/i.test(r.type_usagers ?? '');
      return {
        id: `bnls:${r.id}`,
        name: r.nom,
        address: (r.adresse ?? '').replace(/\.\s*/g, ', ').replace(/,\s*,/g, ',').replace(/,\s*$/, ''),
        arr: null,
        operator: null,
        source: 'bnls',
        url: r.url || null,
        phone: null,
        public: !subscribers,
        hours: null,
        places: num(r.nb_places),
        placesPmr: num(r.nb_pmr),
        placesMoto: num(r.nb_2_rm),
        placesVelo: num(r.nb_velo),
        motoAccess: num(r.nb_2_rm) > 0 ? true : null,
        veloAccess: num(r.nb_velo) > 0 ? true : null,
        covered: !/surface|voirie/i.test(r.type_ouvrage ?? ''),
        kind: /surface|voirie/i.test(r.type_ouvrage ?? '') ? 'surface' : 'underground',
        placesEv: num(r.nb_voitures_electriques),
        heightMax: num(r.hauteur_max) ? num(r.hauteur_max) / 100 : null,
        relay: num(r.nb_pr) > 0,
        prices: free ? { 60: 0, 1440: 0 } : Object.keys(prices).length ? prices : null,
        pricesDate: Object.keys(prices).length ? pricesDate : null,
        motoPrices: null,
        subscriptions: { residentMonth: num(r.abo_resident), month: num(r.abo_non_resident) },
        info: r.info ? [r.info] : [],
        updated: pricesDate,
        lon,
        lat,
      };
    })
    .filter(Boolean);
}
