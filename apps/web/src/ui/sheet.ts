// Contenu du panneau (fiche détaillée et liste « les moins chers autour »).

import {
  CATEGORY_LABELS,
  RULES,
  durationLabel,
  formatDuration,
  formatNumber,
  formatPrice,
  fps,
  paidMinutes,
  progressiveCost,
  quoteCarPark,
  streetGrid,
  tierFor,
  vehicleLabel,
  type BelibProps,
  type CarPark,
  type NearbyOption,
  type NearbyResult,
  type ParkQuote,
  type Quote,
  type Settings,
  type Spot,
  type TariffTable,
  type Vehicle,
} from '@parkprix/core';
import { esc, formatDistance, safeUrl, walkMinutes } from './dom';
import { ICONS } from './svg';

const SOURCE_LABELS: Record<string, string> = {
  paris: 'Paris Data (Ville de Paris)',
  saemes: 'Open data Saemes',
  bnls: 'Base nationale des lieux de stationnement',
  indigo: 'Open data Indigo',
  osm: 'OpenStreetMap',
};

const KIND_LABELS: Record<string, string> = {
  underground: 'Parking souterrain',
  'multi-storey': 'Parking en élévation',
  rooftop: 'Parking en toiture',
  surface: 'Parking en surface',
};

const frDate = (iso: string | null | undefined) => (iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : null);

function navButtons(lat: number, lon: number, url?: string | null) {
  const site = safeUrl(url);
  return `<div class="actions">
    <a class="btn btn-primary" href="https://waze.com/ul?ll=${lat},${lon}&navigate=yes" target="_blank" rel="noopener">${ICONS.nav}<span>Y aller avec Waze</span></a>
    <a class="btn" href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}" target="_blank" rel="noopener">${ICONS.pin}<span>Google Maps</span></a>
    ${site ? `<a class="btn" href="${esc(site)}" target="_blank" rel="noopener">${ICONS.external}<span>Site</span></a>` : ''}
  </div>`;
}

function hero(price: number | null, label: string, s: Settings, tierClass: string, extra = '') {
  const perHour = price != null && price > 0 ? ` · ${formatPrice(Math.round((price / (s.minutes / 60)) * 100) / 100)}/h` : '';
  return `<div class="price-hero ${tierClass}">
    <div class="price">${esc(label)}</div>
    <div class="for">${s.vehicle === 'velo' ? 'Vélo' : `pour ${esc(durationLabel(s.minutes))}${perHour} · ${esc(vehicleLabel(s.vehicle))}`}</div>
    ${extra}
  </div>`;
}

const fact = (icon: string, html: string) => `<li><span class="fact-icon">${icon}</span><span>${html}</span></li>`;
const note = (text?: string) => (text ? `<div class="hero-note">${esc(text)}</div>` : '');

export function renderParkingDetail(p: CarPark, q: ParkQuote, s: Settings): string {
  const kicker = [p.public ? (p.kind ? KIND_LABELS[p.kind] : 'Parking') : 'Parking réservé aux abonnés', p.operator].filter(Boolean).join(' · ');
  const table = s.vehicle === 'moto' ? p.motoPrices : p.prices;
  const rows = [15, 30, 60, 120, 180, 240, 360, 600, 1440]
    .map((m) => ({ m, q: quoteCarPark(table, m) }))
    .filter((r) => r.q)
    .map(
      (r) =>
        `<tr class="${r.m === s.minutes ? 'current' : ''}"><td>${formatDuration(r.m)}</td><td>${r.q!.approx ? '<span class="approx" title="Interpolé entre deux paliers publiés">≈</span> ' : ''}${formatPrice(r.q!.price)}</td></tr>`,
    )
    .join('');
  const subs = p.subscriptions ?? {};
  const subRows = [
    ['residentMonth', 'Abonnement résident / mois'],
    ['month', 'Abonnement / mois'],
    ['year', 'Abonnement / an'],
    ['evMonth', 'Véhicule électrique / mois'],
    ['motoMonth', 'Deux-roues / mois'],
    ['pmrMonth', 'PMR / mois'],
    ['veloDay', 'Vélo / jour'],
    ['veloMonth', 'Vélo / mois'],
  ]
    .filter(([k]) => subs[k] != null)
    .map(([k, l]) => `<tr class="${(s.vehicle === 'velo' && k.startsWith('velo')) || (s.vehicle === 'moto' && k === 'motoMonth') ? 'current' : ''}"><td>${l}</td><td>${formatPrice(subs[k])}</td></tr>`)
    .join('');
  const forfaits = (p.forfaits ?? []).map((f) => `<tr><td>${esc(f.label)}</td><td>${formatPrice(f.price)}</td></tr>`).join('');
  const twoWheels = [
    p.placesMoto ? `${p.placesMoto} places deux-roues motorisés` : p.motoAccess ? 'Deux-roues motorisés acceptés' : p.motoAccess === false ? 'Deux-roues motorisés non acceptés' : '',
    p.placesVelo ? `${p.placesVelo} places vélo` : p.veloAccess ? 'Vélos acceptés' : p.veloAccess === false ? 'Vélos non acceptés' : '',
  ].filter(Boolean);
  const facts = [
    p.address ? fact(ICONS.pin, esc(p.address)) : '',
    p.hours ? fact(ICONS.clock, esc(p.hours)) : '',
    p.places ? fact(ICONS.parking, `${formatNumber(p.places)} places${p.placesPmr ? ` · ${p.placesPmr} PMR` : ''}`) : '',
    twoWheels.length ? fact(s.vehicle === 'velo' ? ICONS.bike : ICONS.moto, esc(twoWheels.join(' · '))) : '',
    p.heightMax ? fact(ICONS.info, `Hauteur max. ${String(p.heightMax).replace('.', ',')} m`) : '',
    p.ev || p.placesEv ? fact(ICONS.bolt, `Recharge électrique${p.placesEv ? ` (${p.placesEv} places)` : ''}`) : '',
    p.relay ? fact(ICONS.info, 'Parc relais') : '',
    ...(p.info ?? []).map((i) => fact(ICONS.info, esc(i))),
  ].join('');
  const priceDate = frDate(p.pricesDate);
  const sources = p.sources.map((x) => SOURCE_LABELS[x] ?? x).join(', ');
  let heroBlock: string;
  if (!p.public && s.vehicle !== 'velo') {
    heroBlock = `<div class="price-hero tier-sub"><div class="price">Abonnés</div><div class="for">Réservé aux abonnés${subs.month != null || subs.residentMonth != null ? ` · dès ${formatPrice(subs.residentMonth ?? subs.month)}/mois` : ''}</div></div>`;
  } else if (q.bubble === 'velo' || q.bubble === 'moto') {
    heroBlock = `<div class="price-hero tier-${q.bubble}"><div class="price">${esc(q.label)}</div><div class="for">${s.vehicle === 'velo' ? 'Stationnement vélo' : 'Deux-roues motorisés'}</div>${note(q.note)}</div>`;
  } else {
    heroBlock = hero(q.price, q.price == null ? 'Prix inconnu' : q.label, s, `tier-${q.estimate ? 'estimate' : q.price == null ? 'unknown' : q.tier}`, note(q.note));
  }
  return `<article class="detail">
    <header class="detail-head">
      <button class="icon-btn" data-action="back" aria-label="Retour à la liste">${ICONS.back}</button>
      <div><div class="kicker">${esc(kicker)}</div><h2>${esc(p.name)}</h2></div>
    </header>
    ${heroBlock}
    ${navButtons(p.lat, p.lon, p.url)}
    ${rows && s.vehicle !== 'velo' ? `<h3>Tarifs ${s.vehicle === 'moto' ? 'deux-roues' : 'horaires'}</h3><table class="grid">${rows}</table>` : ''}
    ${forfaits && s.vehicle !== 'velo' ? `<h3>Forfaits</h3><table class="grid">${forfaits}</table>` : ''}
    ${subRows ? `<h3>Abonnements</h3><table class="grid">${subRows}</table>` : ''}
    ${facts ? `<h3>Infos pratiques</h3><ul class="facts">${facts}</ul>` : ''}
    <p class="source">Sources : ${esc(sources)}${priceDate ? ` · tarifs du ${esc(priceDate)}` : ''}${p.pricesSource ? ` (${esc(SOURCE_LABELS[p.pricesSource] ?? p.pricesSource)})` : ''}.</p>
  </article>`;
}

export function renderSpotDetail(spot: Spot, s: Settings, tariffs: TariffTable, q: Quote, now: Date): string {
  const address = spot.numFrom && spot.numTo && spot.numFrom !== spot.numTo ? `du n° ${spot.numFrom} au ${spot.numTo}` : spot.numFrom ? `au n° ${spot.numFrom}` : '';
  const arr = spot.arr ? `${spot.arr}${spot.arr === 1 ? 'er' : 'e'} arrondissement` : '';
  const tier = spot.cat === 'velo' && q.allowed ? 'velo' : tierFor(q.price, s.minutes, q.allowed);
  const paidCat = spot.cat === 'mixte' || spot.cat === 'rotatif' || spot.cat === 'moto';
  const label = !q.allowed ? 'Non autorisé' : q.price == null ? '—' : formatPrice(q.price);
  // Grille affichée : celle du véhicule choisi, ou celle des deux-roues sur une place moto.
  const gridVehicle: Vehicle = spot.cat === 'moto' ? 'moto' : s.vehicle === 'electrique' || s.vehicle === 'velo' ? 'voiture' : s.vehicle;
  const grid = paidCat ? streetGrid(tariffs, spot.zone, gridVehicle) : null;
  const gridRows = grid
    ? [15, 30, 60, 120, 180, 240, 300, 360]
        .map((m) => `<tr class="${m === s.minutes ? 'current' : ''}"><td>${formatDuration(m)}</td><td>${formatPrice(progressiveCost(grid, m))}</td></tr>`)
        .join('')
    : '';
  const paidNow = paidMinutes(now, 1) === 1;
  const fpsValue = paidCat ? fps(tariffs, spot.zone, gridVehicle) : null;
  const extra = note(q.reason ?? q.note);
  const bike = spot.cat === 'velo';
  const facts = [
    fact(bike ? ICONS.bike : spot.cat === 'moto' ? ICONS.moto : ICONS.parking, `${spot.places} place${spot.places > 1 ? 's' : ''}${spot.typsta ? ` · ${esc(spot.typsta.toLowerCase())}` : ''}${spot.regime ? ` · ${esc(spot.regime)}` : ''}`),
    spot.hours ? fact(ICONS.clock, `Horaires particuliers : ${esc(spot.hours)}`) : '',
    bike ? fact(ICONS.info, 'Stationnement vélo gratuit et sans limite de durée. Attachez le cadre et une roue à l’arceau.') : '',
    paidCat
      ? fact(
          ICONS.clock,
          `Payant du lundi au samedi de 9 h à 20 h (y compris en août), gratuit le dimanche et les jours fériés. ${paidNow ? '<strong>Payant en ce moment.</strong>' : '<strong>Gratuit en ce moment.</strong>'}`,
        )
      : '',
    paidCat ? fact(ICONS.info, `Durée max. visiteur : 6 h · paiement par tranches de ${RULES.stepMin} min (horodateur, PayByPhone, Flowbird…)${fpsValue ? ` · forfait post-stationnement ${formatPrice(fpsValue)}` : ''}.`) : '',
    spot.cat === 'moto' ? fact(ICONS.moto, 'Deux-roues électriques : gratuit. Les motos peuvent aussi se garer sur les places voiture payantes (tarif deux-roues).') : '',
    spot.cat === 'mixte' && spot.zoneRes
      ? fact(ICONS.info, `Secteur résidentiel <strong>${esc(spot.zoneRes)}</strong> : résidents ${formatPrice(RULES.residentDay)}/jour ou ${formatPrice(RULES.residentWeek)}/semaine (${formatPrice(RULES.motoResidentDay)}/jour en deux-roues).`)
      : '',
    spot.cat === 'rotatif' ? fact(ICONS.info, 'Voie rotative : pas de tarif résident, tout le monde paie le tarif visiteur.') : '',
    (spot.cat === 'mixte' || spot.cat === 'rotatif') && s.vehicle !== 'suv' && s.vehicle !== 'velo' ? fact(ICONS.suv, 'SUV / véhicule lourd (thermique > 1,6 t, électrique > 2 t) : tarif triplé.') : '',
    /bois/i.test(spot.regime) ? fact(ICONS.info, 'Bois de Boulogne / Vincennes : grille spécifique (jusqu’à 11 h le mercredi et le samedi), prix indicatif de la zone 2.') : '',
  ].join('');
  return `<article class="detail">
    <header class="detail-head">
      <button class="icon-btn" data-action="back" aria-label="Retour à la liste">${ICONS.back}</button>
      <div><div class="kicker">Sur rue · ${esc(CATEGORY_LABELS[spot.cat])}</div><h2>${esc(spot.street || 'Stationnement sur voirie')}</h2><div class="sub">${esc([address, arr].filter(Boolean).join(' · '))}</div></div>
    </header>
    ${hero(q.price, label, s, `tier-${tier}`, extra)}
    ${navButtons(spot.lat, spot.lon)}
    ${gridRows ? `<h3>Grille zone ${spot.zone} · ${esc(vehicleLabel(gridVehicle))}</h3><table class="grid">${gridRows}</table>` : ''}
    <h3>Règles</h3><ul class="facts">${facts}</ul>
    <p class="source">Sources : Paris Data — emprises de stationnement et zones tarifaires (ODbL), règles paris.fr.</p>
  </article>`;
}

export function renderBelibDetail(b: BelibProps, lon: number, lat: number): string {
  return `<article class="detail">
    <header class="detail-head">
      <button class="icon-btn" data-action="back" aria-label="Retour à la liste">${ICONS.back}</button>
      <div><div class="kicker">Borne de recharge · Belib'</div><h2>${esc(b.name)}</h2><div class="sub">${esc(b.address)}</div></div>
    </header>
    <div class="price-hero tier-unknown"><div class="price">${b.pdc} point${b.pdc > 1 ? 's' : ''} de charge</div><div class="for">jusqu'à ${b.kw} kW${b.twoWheels ? ' · deux-roues' : ''} · ${esc(b.hours || '24/7')}</div>
      <div class="hero-note">Tarif de recharge selon la puissance (voir belib.paris.fr). Stationnement autorisé le temps de la recharge.</div></div>
    ${navButtons(lat, lon, 'https://belib.paris.fr/')}
    <p class="source">Source : Paris Data — Belib' points de recharge (ODbL).</p>
  </article>`;
}

function optionItem(o: NearbyOption) {
  return `<li><button class="option" data-kind="${o.kind}" data-key="${esc(o.key)}">
    <span class="badge tier-${esc(o.badge)}">${esc(o.label)}</span>
    <span class="opt-main"><strong>${esc(o.title)}</strong><small>${esc(o.subtitle)}</small></span>
    <span class="opt-dist">${formatDistance(o.distance)}<small>${walkMinutes(o.distance)} min à pied</small></span>
  </button></li>`;
}

export function renderList(title: string, subtitle: string, result: NearbyResult, loadingVoirie: boolean, vehicle: Vehicle): string {
  const streetTitle = vehicle === 'velo' ? 'Places vélo' : vehicle === 'moto' ? 'Sur rue (deux-roues)' : 'Sur rue';
  const street = result.street.length
    ? `<ul>${result.street.map(optionItem).join('')}</ul>`
    : `<p class="empty">${loadingVoirie ? 'Chargement des 60 000 emplacements sur rue…' : 'Aucun emplacement connu à moins de 600 m.'}</p>`;
  const parks = result.parkings.length ? `<ul>${result.parkings.map(optionItem).join('')}</ul>` : `<p class="empty">Aucun parking${vehicle === 'velo' ? ' acceptant les vélos' : ''} à moins de 600 m.</p>`;
  return `<section class="list">
    <header class="list-head"><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></header>
    <h3 class="list-section">${streetTitle}</h3>${street}
    <h3 class="list-section">Parkings</h3>${parks}
  </section>`;
}
