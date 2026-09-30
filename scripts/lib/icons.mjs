// Icônes de la carte en SVG (taille 1x, en pixels CSS). Rendues en planche de
// sprites PNG par scripts/build-sprites.mjs : utilisables par MapLibre GL JS
// (web) et MapLibre Native (React Native / Expo) sans canvas.

const PARKING_BLUE = '#1a73e8';
const PARKING_GRAY = '#7b8794';
const SHADOW = `<filter id="s" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="1" stdDeviation="1.1" flood-color="#10202f" flood-opacity="0.35"/></filter>`;

// Lettre « P » en contour (pas de police nécessaire), dans une boîte 24×24.
const P_GLYPH = 'M7 5h5.8a4.2 4.2 0 0 1 0 8.4H10.2V19H7Z M10.2 7.8v2.8h2.4a1.4 1.4 0 0 0 0-2.8Z';

function parkingSquare(fill, { size = 24, ring = false } = {}) {
  const pad = ring ? 6 : 3;
  const w = size + pad * 2;
  const s = size / 24;
  return {
    width: w,
    height: w,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${w}" viewBox="0 0 ${w} ${w}"><defs>${SHADOW}</defs>
      ${ring ? `<rect x="1" y="1" width="${w - 2}" height="${w - 2}" rx="${(size * 0.29 + 5).toFixed(1)}" fill="${fill}" fill-opacity="0.25"/>` : ''}
      <g filter="url(#s)"><rect x="${pad}" y="${pad}" width="${size}" height="${size}" rx="${(size * 0.29).toFixed(1)}" fill="${fill}" stroke="#ffffff" stroke-width="${(1.8 * s).toFixed(2)}"/></g>
      <path transform="translate(${pad} ${pad}) scale(${s})" d="${P_GLYPH}" fill="#ffffff" fill-rule="evenodd"/></svg>`,
  };
}

/** Bulle de prix étirable (icon-text-fit « both ») : coins fixes, milieu étirable. */
function bubble(fill, { stroke = 'rgba(255,255,255,0.95)', dashed = false, selected = false } = {}) {
  const W = 40;
  const H = 28;
  const P = 3;
  const r = 9;
  return {
    width: W,
    height: H,
    stretchX: [[P + r, W - P - r]],
    stretchY: [[P + r, H - P - r]],
    content: [P, P, W - P, H - P],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${SHADOW}</defs>
      <g filter="url(#s)"><rect x="${P}" y="${P}" width="${W - 2 * P}" height="${H - 2 * P}" rx="${r}" fill="${fill}"/></g>
      <rect x="${P + 0.75}" y="${P + 0.75}" width="${W - 2 * P - 1.5}" height="${H - 2 * P - 1.5}" rx="${r - 0.75}" fill="none"
        stroke="${selected ? PARKING_BLUE : stroke}" stroke-width="${selected ? 2.5 : 1.5}" ${dashed ? 'stroke-dasharray="3 2"' : ''}/></svg>`,
  };
}

function roundIcon(fill, glyph, size = 22) {
  return {
    width: size,
    height: size,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 22 22"><defs>${SHADOW}</defs>
      <g filter="url(#s)"><circle cx="11" cy="11" r="9" fill="${fill}" stroke="#ffffff" stroke-width="1.6"/></g>${glyph}</svg>`,
  };
}

const BIKE_GLYPH = `<g fill="none" stroke="#fff" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="7.2" cy="12.8" r="2.4"/><circle cx="14.8" cy="12.8" r="2.4"/>
  <path d="M7.2 12.8 9.4 8.6h4l1.4 4.2M9.4 8.6 11 12.8h-3.8M12.4 7.2h1.9"/></g>`;
const MOTO_GLYPH = `<g fill="none" stroke="#fff" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="6.6" cy="13" r="2.3"/><circle cx="15.4" cy="13" r="2.3"/>
  <path d="M6.6 13h4.6l2.2-3.6h-3.2M13.4 9.4l2 3.6M12.2 7h2l1.2 2.4"/></g><path d="M8.4 10.2h3.4l-1 1.6H8Z" fill="#fff"/>`;
const BOLT_GLYPH = `<path d="M12.3 4.6 7.2 12h3.3l-.9 5.4 5.2-7.5h-3.3Z" fill="#fff"/>`;
const METRO_GLYPH = `<path d="M6.8 15.2V7.2h1.7l2.5 4 2.5-4h1.7v8h-1.9v-4.7l-2.3 3.6-2.3-3.6v4.7Z" fill="#fff"/>`;

function arrow(color) {
  return {
    width: 14,
    height: 10,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="10" viewBox="0 0 14 10"><path d="M1.5 5h8.5M7.2 1.8 10.6 5 7.2 8.2" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  };
}

function shield(fill) {
  const W = 30;
  const H = 18;
  return {
    width: W,
    height: H,
    stretchX: [[5, W - 5]],
    stretchY: [[5, H - 5]],
    content: [3, 2, W - 3, H - 2],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="4" fill="${fill}" stroke="#ffffff" stroke-width="1"/></svg>`,
  };
}

function labelBg(fill) {
  const W = 40;
  const H = 30;
  const P = 4;
  return {
    width: W,
    height: H,
    stretchX: [[P + 9, W - P - 9]],
    stretchY: [[P + 9, H - P - 9]],
    content: [P + 2, P + 2, W - P - 2, H - P - 2],
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${SHADOW}</defs><g filter="url(#s)"><rect x="${P}" y="${P}" width="${W - 2 * P}" height="${H - 2 * P}" rx="9" fill="${fill}"/></g></svg>`,
  };
}

const focusPin = {
  width: 34,
  height: 44,
  svg: `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44"><defs>${SHADOW}</defs><g filter="url(#s)"><path d="M17 42s14-13.4 14-24.2a14 14 0 1 0-28 0C3 28.6 17 42 17 42Z" fill="#33ccff" stroke="#0b2533" stroke-width="2.2"/></g><circle cx="17" cy="17.5" r="5.5" fill="#fff" stroke="#0b2533" stroke-width="2.2"/></svg>`,
};

/** Couleurs de bulles : niveaux de prix (voir packages/core/src/colors.ts). */
export const TIER_FILL = {
  free: '#1bab50',
  t1: '#4cc15c',
  t2: '#a5cc2e',
  t3: '#ffc400',
  t4: '#ff8a1f',
  t5: '#ff3528',
  na: '#a4acb6',
};

export function buildIcons() {
  const icons = {
    'p-public': parkingSquare(PARKING_BLUE),
    'p-subscribers': parkingSquare(PARKING_GRAY),
    'p-selected': parkingSquare(PARKING_BLUE, { size: 30, ring: true }),
    'icon-velo': roundIcon('#0e9f8e', BIKE_GLYPH),
    'icon-moto': roundIcon('#8e63e8', MOTO_GLYPH),
    'icon-belib': roundIcon('#00a4eb', BOLT_GLYPH),
    'icon-metro': roundIcon('#6f7a85', METRO_GLYPH, 18),
    oneway: arrow('#9aa0a6'),
    'oneway-night': arrow('#6b7784'),
    shield: shield('#a3b19c'),
    'shield-night': shield('#4d5a4f'),
    'label-bg': labelBg('#ffffff'),
    'label-bg-night': labelBg('#263241'),
    'pin-focus': focusPin,
  };
  const bubbles = {
    ...Object.fromEntries(Object.entries(TIER_FILL).map(([k, v]) => [k, { fill: v }])),
    unknown: { fill: '#ffffff', stroke: '#c7ced6' },
    estimate: { fill: '#ffffff', stroke: '#8a939c', dashed: true },
    sub: { fill: '#7b8794' },
    velo: { fill: '#0e9f8e' },
    moto: { fill: '#8e63e8' },
  };
  for (const [name, opts] of Object.entries(bubbles)) {
    icons[`bubble-${name}`] = bubble(opts.fill, opts);
    icons[`bubble-${name}-sel`] = bubble(opts.fill, { ...opts, selected: true });
  }
  return icons;
}
