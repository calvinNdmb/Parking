// Couleurs partagées (carte, pastilles, interface web et mobile).

import type { Tier } from './pricing';

/** Couleur de fond par niveau de prix (€/h équivalent). */
export const TIER_COLORS: Record<Tier, string> = {
  free: '#1bab50',
  t1: '#4cc15c',
  t2: '#a5cc2e',
  t3: '#ffc400',
  t4: '#ff8a1f',
  t5: '#ff3528',
  na: '#a4acb6',
  unknown: '#ffffff',
};

/** Couleur de texte lisible sur TIER_COLORS. */
export const TIER_TEXT: Record<Tier, string> = {
  free: '#ffffff',
  t1: '#ffffff',
  t2: '#253200',
  t3: '#3b2c00',
  t4: '#ffffff',
  t5: '#ffffff',
  na: '#ffffff',
  unknown: '#4c4c4c',
};

/** Emplacements à usage réservé (couleur fixe, indépendante du prix). */
export const CATEGORY_COLORS = {
  pmr: '#2f6fe4',
  livraison: '#8f98a3',
  electrique: '#00a4eb',
  moto: '#8e63e8',
  velo: '#0e9f8e',
} as const;

/** Identité (inspirée de la live map Waze). */
export const BRAND = {
  accent: '#00a4eb',
  accentDark: '#0075e3',
  ink: '#202124',
  inkSoft: '#3c4043',
  muted: '#72767d',
  line: '#d3dae0',
  surface: '#ffffff',
  surfaceAlt: '#f2f4f7',
  parking: '#1a73e8',
  parkingSubscribers: '#7b8794',
} as const;
