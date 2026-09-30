// Petits utilitaires géométriques (WGS84, échelle d'une ville : approximation
// équirectangulaire suffisante à Paris, erreur < 0,5 %).

const R = 6371008.8;
const DEG = Math.PI / 180;
export const PARIS_LAT = 48.8566;
/** Mètres par degré de longitude / latitude à la latitude de Paris. */
export const M_PER_DEG_LON = R * DEG * Math.cos(PARIS_LAT * DEG);
export const M_PER_DEG_LAT = R * DEG;

/** Distance approximative en mètres entre deux points [lon, lat]. */
export function distanceM(a, b) {
  const dx = (a[0] - b[0]) * M_PER_DEG_LON;
  const dy = (a[1] - b[1]) * M_PER_DEG_LAT;
  return Math.hypot(dx, dy);
}

function pointInRing(pt, ring) {
  const [x, y] = pt;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Test point-dans-polygone pour Polygon / MultiPolygon GeoJSON (trous gérés). */
export function pointInGeometry(pt, geometry) {
  if (!geometry) return false;
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
  for (const poly of polys) {
    if (!pointInRing(pt, poly[0])) continue;
    let inHole = false;
    for (let k = 1; k < poly.length; k++) if (pointInRing(pt, poly[k])) inHole = true;
    if (!inHole) return true;
  }
  return false;
}

export function bboxOf(geometry) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  const visit = (c) => {
    if (typeof c[0] === 'number') {
      if (c[0] < b[0]) b[0] = c[0];
      if (c[1] < b[1]) b[1] = c[1];
      if (c[0] > b[2]) b[2] = c[0];
      if (c[1] > b[3]) b[3] = c[1];
    } else c.forEach(visit);
  };
  visit(geometry.coordinates);
  return b;
}

/** Centre moyen des sommets d'un anneau (suffisant pour de petites emprises). */
export function ringCenter(ring) {
  const n = ring.length > 1 && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1] ? ring.length - 1 : ring.length;
  let x = 0;
  let y = 0;
  for (let i = 0; i < n; i++) {
    x += ring[i][0];
    y += ring[i][1];
  }
  return [x / n, y / n];
}

/** Aire (m²) d'un anneau, formule du lacet en projection locale. */
export function ringAreaM2(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j][0] * M_PER_DEG_LON) * (ring[i][1] * M_PER_DEG_LAT) - (ring[i][0] * M_PER_DEG_LON) * (ring[j][1] * M_PER_DEG_LAT);
  }
  return Math.abs(a) / 2;
}

function sqSegDist(p, a, b) {
  let x = a[0] * M_PER_DEG_LON;
  let y = a[1] * M_PER_DEG_LAT;
  let dx = b[0] * M_PER_DEG_LON - x;
  let dy = b[1] * M_PER_DEG_LAT - y;
  const px = p[0] * M_PER_DEG_LON;
  const py = p[1] * M_PER_DEG_LAT;
  if (dx !== 0 || dy !== 0) {
    const t = ((px - x) * dx + (py - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x += dx;
      y += dy;
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = px - x;
  dy = py - y;
  return dx * dx + dy * dy;
}

/** Douglas-Peucker, tolérance en mètres. */
export function simplifyLine(points, toleranceM) {
  if (points.length <= 3) return points;
  const sqTol = toleranceM * toleranceM;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let maxSq = 0;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const d = sqSegDist(points[i], points[first], points[last]);
      if (d > maxSq) {
        maxSq = d;
        index = i;
      }
    }
    if (maxSq > sqTol && index > 0) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;

/** Simplifie + arrondit un Polygon/MultiPolygon (pour les couches de fond). */
export function simplifyPolygonGeometry(geometry, toleranceM, decimals = 5) {
  const simplifyPoly = (poly) =>
    poly
      .map((ring) => simplifyLine(ring, toleranceM).map(([x, y]) => [round(x, decimals), round(y, decimals)]))
      .filter((ring) => ring.length >= 4);
  if (geometry.type === 'Polygon') return { type: 'Polygon', coordinates: simplifyPoly(geometry.coordinates) };
  return { type: 'MultiPolygon', coordinates: geometry.coordinates.map(simplifyPoly).filter((p) => p.length) };
}

/**
 * Index spatial minimaliste (grille) pour des recherches de voisinage rapides.
 * cellM : taille de cellule en mètres.
 */
export class GridIndex {
  constructor(cellM = 200) {
    this.cellM = cellM;
    this.cells = new Map();
  }
  key(pt) {
    return `${Math.floor((pt[0] * M_PER_DEG_LON) / this.cellM)}:${Math.floor((pt[1] * M_PER_DEG_LAT) / this.cellM)}`;
  }
  insert(pt, item) {
    const k = this.key(pt);
    if (!this.cells.has(k)) this.cells.set(k, []);
    this.cells.get(k).push({ pt, item });
  }
  /** Éléments à moins de radiusM mètres de pt. */
  within(pt, radiusM) {
    const cx = Math.floor((pt[0] * M_PER_DEG_LON) / this.cellM);
    const cy = Math.floor((pt[1] * M_PER_DEG_LAT) / this.cellM);
    const r = Math.ceil(radiusM / this.cellM);
    const out = [];
    for (let i = cx - r; i <= cx + r; i++) {
      for (let j = cy - r; j <= cy + r; j++) {
        const list = this.cells.get(`${i}:${j}`);
        if (!list) continue;
        for (const e of list) if (distanceM(pt, e.pt) <= radiusM) out.push(e.item);
      }
    }
    return out;
  }
}
