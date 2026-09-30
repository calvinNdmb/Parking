// Normalisation de libellés (les jeux de données sont souvent en MAJUSCULES).

const LOWER_WORDS = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'sur', 'en', 'aux', 'au', 'à', 'd', 'l', 'sous', 'lès', 'ter', 'bis']);

/** "RUE D'ALESIA" → "Rue d'Alesia", "BD SAINT-GERMAIN" → "Bd Saint-Germain". */
export function titleCase(input) {
  if (!input) return '';
  const s = String(input).trim().replace(/\s+/g, ' ').toLowerCase();
  let first = true;
  return s.replace(/([\p{L}\p{N}]+)/gu, (word) => {
    const out = !first && LOWER_WORDS.has(word) ? word : word[0].toUpperCase() + word.slice(1);
    first = false;
    return out;
  });
}

const STREET_TYPES = {
  AV: 'AVENUE',
  BD: 'BOULEVARD',
  PL: 'PLACE',
  QU: 'QUAI',
  RTE: 'ROUTE',
  PAS: 'PASSAGE',
  CRS: 'COURS',
  SQ: 'SQUARE',
  ALL: 'ALLÉE',
  VLA: 'VILLA',
  IMP: 'IMPASSE',
  PROM: 'PROMENADE',
  CHEM: 'CHEMIN',
  CITE: 'CITÉ',
  SENT: 'SENTIER',
  GAL: 'GALERIE',
  HAM: 'HAMEAU',
  PTE: 'PORTE',
  RPT: 'ROND-POINT',
  ESP: 'ESPLANADE',
  PRV: 'PARVIS',
  CAR: 'CARREFOUR',
  CHAU: 'CHAUSSÉE',
  RLE: 'RUELLE',
  TER: 'TERRASSE',
  TSSE: 'TERRASSE',
};

/** Nom de voie complet à partir du type (« AV DE ») et du nom (« CHOISY ») → « Avenue de Choisy ». */
export function streetName(type, name) {
  const t = String(type ?? '').trim().replace(/^(\S+)/, (w) => STREET_TYPES[w.toUpperCase()] ?? w);
  const full = /['’]$/.test(t) && name ? `${t}${String(name).trim()}` : [t, name].filter(Boolean).join(' ');
  return titleCase(full);
}

/** Petit dictionnaire de chaînes → index (pour un JSON compact). */
export class Dict {
  constructor() {
    this.values = [''];
    this.index = new Map([['', 0]]);
  }
  id(value) {
    const v = value ?? '';
    if (!this.index.has(v)) {
      this.index.set(v, this.values.length);
      this.values.push(v);
    }
    return this.index.get(v);
  }
}
