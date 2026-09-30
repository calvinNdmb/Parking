import { describe, expect, it } from 'vitest';
// @ts-expect-error — modules JS du pipeline (sans types)
import { streetName, titleCase } from '../scripts/lib/text.mjs';
// @ts-expect-error — modules JS du pipeline (sans types)
import { parseCsv } from '../scripts/lib/bnls.mjs';
// @ts-expect-error — modules JS du pipeline (sans types)
import { distanceM, pointInGeometry, simplifyLine } from '../scripts/lib/geo.mjs';

describe('pipeline : textes', () => {
  it('met en forme les noms de voies', () => {
    expect(streetName('AV DE', 'CHOISY')).toBe('Avenue de Choisy');
    expect(streetName("RUE D'", 'ALESIA')).toBe("Rue d'Alesia");
    expect(streetName('BD', 'SAINT-GERMAIN')).toBe('Boulevard Saint-Germain');
    expect(titleCase('13 ter rue fremicourt')).toBe('13 ter Rue Fremicourt');
  });
});

describe('pipeline : CSV', () => {
  it('gère séparateur « ; » et guillemets', () => {
    const rows = parseCsv('id;nom;info\n1;"Parking ""Centre""";"a;b"\n2;Autre;\n');
    expect(rows).toEqual([
      { id: '1', nom: 'Parking "Centre"', info: 'a;b' },
      { id: '2', nom: 'Autre', info: '' },
    ]);
  });
});

describe('pipeline : géométrie', () => {
  const square = { type: 'Polygon', coordinates: [[[2.3, 48.85], [2.31, 48.85], [2.31, 48.86], [2.3, 48.86], [2.3, 48.85]]] };
  it('teste l’appartenance à un polygone', () => {
    expect(pointInGeometry([2.305, 48.855], square)).toBe(true);
    expect(pointInGeometry([2.32, 48.855], square)).toBe(false);
  });
  it('mesure des distances en mètres', () => {
    expect(distanceM([2.3, 48.85], [2.3, 48.86])).toBeGreaterThan(1100);
    expect(distanceM([2.3, 48.85], [2.3, 48.86])).toBeLessThan(1120);
  });
  it('simplifie une ligne presque droite', () => {
    expect(simplifyLine([[2.3, 48.85], [2.30001, 48.850001], [2.30015, 48.850001], [2.3002, 48.85]], 1)).toHaveLength(2);
  });
});
