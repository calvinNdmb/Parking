import { describe, expect, it } from 'vitest';
import { easterSunday, isHoliday } from '../src/holidays';
import { fps, formatPrice, paidMinutes, progressiveCost, quoteCarPark, quoteStreet, tierFor } from '../src/pricing';
import { fromParisWallClock, parisTime } from '../src/time';
import type { TariffTable } from '../src/types';

// Grille officielle (jeu « zones tarifaires » de Paris Data).
const TARIFFS: TariffTable = {
  '1': { vl: [6, 6, 12, 15, 18, 18], vlSamedi: [6, 6, 12, 15, 18, 18], suv: [18, 18, 36, 45, 54, 54], moto: [3, 3, 6, 7.5, 9, 9], motoSamedi: [3, 3, 6, 7.5, 9, 9] },
  '2': { vl: [4, 4, 8, 10, 12, 12], vlSamedi: [4, 4, 8, 10, 12, 12], suv: [12, 12, 24, 30, 36, 36], moto: [2, 2, 4, 5, 6, 6], motoSamedi: [2, 2, 4, 5, 6, 6] },
};
const paris = (y: number, mo: number, d: number, h: number, mi = 0) => fromParisWallClock(y, mo, d, h, mi);

describe('heure de Paris', () => {
  it('convertit une heure murale en instant (été et hiver)', () => {
    expect(paris(2026, 7, 1, 10).toISOString()).toBe('2026-07-01T08:00:00.000Z');
    expect(paris(2026, 1, 15, 10).toISOString()).toBe('2026-01-15T09:00:00.000Z');
    const t = parisTime(paris(2026, 9, 30, 14, 30));
    expect([t.weekday, t.hour, t.minute]).toEqual([3, 14, 30]);
  });
});

describe('jours fériés', () => {
  it('calcule Pâques et les fêtes mobiles', () => {
    expect(easterSunday(2026)).toEqual({ month: 4, day: 5 });
    expect(easterSunday(2027)).toEqual({ month: 3, day: 28 });
    expect(isHoliday('2026-04-06')).toBe(true); // lundi de Pâques
    expect(isHoliday('2026-05-14')).toBe(true); // Ascension
    expect(isHoliday('2026-05-25')).toBe(true); // lundi de Pentecôte
    expect(isHoliday('2026-07-14')).toBe(true);
    expect(isHoliday('2026-09-30')).toBe(false);
  });
});

describe('minutes payantes', () => {
  it('compte uniquement lun.–sam. 9h–20h hors fériés', () => {
    expect(paidMinutes(paris(2026, 9, 30, 10), 120)).toBe(120); // mercredi
    expect(paidMinutes(paris(2026, 9, 30, 19), 120)).toBe(60); // 19h → 21h
    expect(paidMinutes(paris(2026, 9, 30, 8, 30), 60)).toBe(30);
    expect(paidMinutes(paris(2026, 10, 4, 10), 180)).toBe(0); // dimanche
    expect(paidMinutes(paris(2026, 11, 11, 10), 180)).toBe(0); // 11 novembre
    expect(paidMinutes(paris(2026, 10, 3, 18), 24 * 60)).toBe(120); // samedi 18h → dimanche 18h
    expect(paidMinutes(paris(2026, 9, 30, 18), 24 * 60)).toBe(120 + 9 * 60); // mer. 18h → jeu. 18h
  });
});

describe('voirie', () => {
  it('applique la grille progressive officielle (quarts d’heure)', () => {
    expect([60, 120, 180, 240, 300, 360].map((m) => progressiveCost(TARIFFS['1'].vl, m))).toEqual([6, 12, 24, 39, 57, 75]);
    expect([60, 120, 180, 240, 300, 360].map((m) => progressiveCost(TARIFFS['2'].vl, m))).toEqual([4, 8, 16, 26, 38, 50]);
    expect(progressiveCost(TARIFFS['1'].vl, 15)).toBe(1.5);
    expect(progressiveCost(TARIFFS['1'].vl, 150)).toBe(18);
    expect(progressiveCost(TARIFFS['1'].vl, 61)).toBe(7.5); // quart d'heure entamé
  });

  it('FPS = coût des 6 heures', () => {
    expect(fps(TARIFFS, 1, 'voiture')).toBe(75);
    expect(fps(TARIFFS, 2, 'voiture')).toBe(50);
    expect(fps(TARIFFS, 1, 'suv')).toBe(225);
    expect(fps(TARIFFS, 2, 'moto')).toBe(25);
  });

  const wed10 = paris(2026, 9, 30, 10);
  it('voiture, SUV, moto, électrique', () => {
    expect(quoteStreet({ zone: 1, category: 'mixte', vehicle: 'voiture', start: wed10, minutes: 120, tariffs: TARIFFS }).price).toBe(12);
    expect(quoteStreet({ zone: 2, category: 'rotatif', vehicle: 'voiture', start: wed10, minutes: 180, tariffs: TARIFFS }).price).toBe(16);
    expect(quoteStreet({ zone: 1, category: 'mixte', vehicle: 'suv', start: wed10, minutes: 60, tariffs: TARIFFS }).price).toBe(18);
    expect(quoteStreet({ zone: 2, category: 'moto', vehicle: 'moto', start: wed10, minutes: 60, tariffs: TARIFFS }).price).toBe(2);
    expect(quoteStreet({ zone: 1, category: 'mixte', vehicle: 'electrique', start: wed10, minutes: 600, tariffs: TARIFFS })).toMatchObject({ price: 0, allowed: true });
  });

  it('interdit au-delà de 6 h payantes et sur les places réservées', () => {
    const q = quoteStreet({ zone: 1, category: 'mixte', vehicle: 'voiture', start: wed10, minutes: 420, tariffs: TARIFFS });
    expect(q.allowed).toBe(false);
    expect(q.price).toBe(75);
    expect(quoteStreet({ zone: 1, category: 'livraison', vehicle: 'voiture', start: wed10, minutes: 60, tariffs: TARIFFS }).allowed).toBe(false);
    expect(quoteStreet({ zone: 1, category: 'moto', vehicle: 'voiture', start: wed10, minutes: 60, tariffs: TARIFFS }).allowed).toBe(false);
    expect(quoteStreet({ zone: 1, category: 'gratuit', vehicle: 'voiture', start: wed10, minutes: 60, tariffs: TARIFFS }).price).toBe(0);
  });

  it('gratuit le dimanche et le soir', () => {
    expect(quoteStreet({ zone: 1, category: 'mixte', vehicle: 'voiture', start: paris(2026, 10, 4, 12), minutes: 240, tariffs: TARIFFS }).price).toBe(0);
    expect(quoteStreet({ zone: 1, category: 'mixte', vehicle: 'voiture', start: paris(2026, 9, 30, 19, 30), minutes: 120, tariffs: TARIFFS }).price).toBe(3);
  });
});

describe('parkings', () => {
  // Grille réelle (Frémicourt / Paris Data).
  const full = { 15: 1.35, 30: 2.7, 60: 5.4, 90: 8.1, 120: 10.8, 180: 16.2, 240: 21.6, 420: 37.8, 480: 43.2, 540: 48.6, 600: 48.6, 660: 48.6, 720: 48.6, 1440: 48.6 };
  // Grille partielle (Saemes : 15 min, 1 h, 3 h, 24 h).
  const partial = { 15: 1.25, 60: 5, 180: 15, 1440: 55 };

  it('utilise les paliers publiés', () => {
    expect(quoteCarPark(full, 60)).toEqual({ price: 5.4, approx: false });
    expect(quoteCarPark(full, 1440)).toEqual({ price: 48.6, approx: false });
  });
  it('interpole entre deux paliers sans dépasser le suivant', () => {
    expect(quoteCarPark(full, 300)).toEqual({ price: 27, approx: true });
    expect(quoteCarPark(partial, 360)).toEqual({ price: 30, approx: true });
    expect(quoteCarPark(partial, 120)).toEqual({ price: 10, approx: true });
    expect(quoteCarPark(partial, 1200)!.price).toBeLessThanOrEqual(55);
  });
  it('cumule les journées au-delà de 24 h', () => {
    expect(quoteCarPark(full, 2880)).toEqual({ price: 97.2, approx: false });
  });
  it("n'extrapole pas un simple tarif horaire sur 24 h", () => {
    expect(quoteCarPark({ 60: 5.5 }, 120)).toEqual({ price: 11, approx: true });
    expect(quoteCarPark({ 60: 5.5 }, 1440)).toBeNull();
  });
  it('gère les grilles absentes', () => {
    expect(quoteCarPark(null, 60)).toBeNull();
    expect(quoteCarPark({}, 60)).toBeNull();
  });
});

describe('affichage', () => {
  it('classe les prix par €/h', () => {
    expect(tierFor(0, 60)).toBe('free');
    expect(tierFor(4, 60)).toBe('t2');
    expect(tierFor(6, 60)).toBe('t4');
    expect(tierFor(18, 60)).toBe('t5');
    expect(tierFor(48.6, 1440)).toBe('t1');
    expect(tierFor(null, 60)).toBe('unknown');
    expect(tierFor(12, 60, false)).toBe('na');
  });
  it('formate les prix en français', () => {
    expect(formatPrice(5.4)).toBe('5,40 €');
    expect(formatPrice(12)).toBe('12 €');
    expect(formatPrice(0)).toBe('Gratuit');
  });
});
