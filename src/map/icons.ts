// Pastilles de prix dessinées au canvas (étirables autour du texte, façon Waze).

import type { Map as MapLibreMap } from 'maplibre-gl';
import type { Tier } from '../pricing';

export type PinStyle = Tier | 'estimate' | 'sub';

export const TIER_COLORS: Record<Tier, string> = {
  free: '#12b76a',
  t1: '#43c15b',
  t2: '#9ccc2e',
  t3: '#ffc21a',
  t4: '#ff8a24',
  t5: '#f0463c',
  na: '#a3acb7',
  unknown: '#ffffff',
};

export const TIER_TEXT: Record<Tier, string> = {
  free: '#ffffff',
  t1: '#ffffff',
  t2: '#243100',
  t3: '#3a2a00',
  t4: '#ffffff',
  t5: '#ffffff',
  na: '#ffffff',
  unknown: '#5b6673',
};

const PIN_BG: Record<PinStyle, string> = { ...TIER_COLORS, estimate: '#ffffff', sub: '#61708a' };
export const PIN_TEXT: Record<PinStyle, string> = { ...TIER_TEXT, estimate: '#5b6673', sub: '#ffffff' };

const PR = 2; // pixelRatio des images
const H = 30; // hauteur de la pastille (px CSS)
const PAD = 4; // marge pour l'ombre
const BADGE = 22; // pastille « P »
const W = 72;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPin(style: PinStyle, selected: boolean): ImageData {
  const cw = (W + PAD * 2) * PR;
  const ch = (H + PAD * 2) * PR;
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(PR, PR);
  const bg = PIN_BG[style];
  const light = bg === '#ffffff';
  // ombre douce
  ctx.save();
  ctx.shadowColor = 'rgba(16, 32, 48, 0.28)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 1.5;
  roundRect(ctx, PAD, PAD, W, H, H / 2);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.restore();
  // contour
  roundRect(ctx, PAD + 0.75, PAD + 0.75, W - 1.5, H - 1.5, H / 2 - 0.75);
  ctx.lineWidth = selected ? 2.5 : 1.5;
  ctx.strokeStyle = selected ? '#0a84ff' : light ? '#c7ced6' : 'rgba(255,255,255,0.9)';
  if (style === 'estimate') ctx.setLineDash([3, 2]);
  ctx.stroke();
  ctx.setLineDash([]);
  // pastille « P »
  const cx = PAD + 4 + BADGE / 2;
  const cy = PAD + H / 2;
  ctx.beginPath();
  ctx.arc(cx, cy, BADGE / 2, 0, Math.PI * 2);
  ctx.fillStyle = light ? '#3d7eea' : '#ffffff';
  ctx.fill();
  ctx.fillStyle = light ? '#ffffff' : bg === '#ffc21a' || bg === '#9ccc2e' ? '#3a3000' : bg;
  ctx.font = `800 15px "Rubik", "Noto Sans", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('P', cx, cy + 1);
  return ctx.getImageData(0, 0, cw, ch);
}

/** Ajoute (si absentes) les images de pastilles : pin-<style> et pin-<style>-sel. */
export function addPinImages(map: MapLibreMap) {
  const styles: PinStyle[] = ['free', 't1', 't2', 't3', 't4', 't5', 'na', 'unknown', 'estimate', 'sub'];
  const left = PAD + 4 + BADGE + 4;
  const right = PAD + W - 10;
  for (const s of styles) {
    for (const selected of [false, true]) {
      const id = `pin-${s}${selected ? '-sel' : ''}`;
      if (map.hasImage(id)) continue;
      // Seule la partie centrale s'étire en largeur ; la zone de contenu couvre toute la hauteur
      // pour que l'image garde sa hauteur (calque en icon-text-fit « width ») et un badge « P » intact.
      map.addImage(id, drawPin(s, selected), {
        pixelRatio: PR,
        stretchX: [[left * PR, right * PR]],
        content: [left * PR, 0, right * PR, (H + PAD * 2) * PR],
      });
    }
  }
  if (!map.hasImage('belib')) map.addImage('belib', drawBolt(), { pixelRatio: PR });
  for (const [id, dark] of [
    ['label-bg', false],
    ['label-bg-dark', true],
  ] as const) {
    if (map.hasImage(id)) continue;
    const w = 40;
    const h = 28;
    map.addImage(id, drawLabelBg(w, h, dark), {
      pixelRatio: PR,
      stretchX: [[(PAD + 12) * PR, (PAD + w - 12) * PR]],
      stretchY: [[(PAD + 10) * PR, (PAD + h - 10) * PR]],
      content: [(PAD + 8) * PR, (PAD + 5) * PR, (PAD + w - 8) * PR, (PAD + h - 5) * PR],
    });
  }
}

function drawLabelBg(w: number, h: number, dark: boolean): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = (w + PAD * 2) * PR;
  canvas.height = (h + PAD * 2) * PR;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(PR, PR);
  ctx.shadowColor = 'rgba(16, 32, 48, 0.22)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 1.5;
  roundRect(ctx, PAD, PAD, w, h, 10);
  ctx.fillStyle = dark ? '#263241' : '#ffffff';
  ctx.fill();
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function drawBolt(): ImageData {
  const size = 22;
  const canvas = document.createElement('canvas');
  canvas.width = size * PR;
  canvas.height = size * PR;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(PR, PR);
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 1.5, 0, Math.PI * 2);
  ctx.fillStyle = '#00a6c8';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(12.5, 4.5);
  ctx.lineTo(6.5, 12.5);
  ctx.lineTo(10.5, 12.5);
  ctx.lineTo(9.5, 17.5);
  ctx.lineTo(15.5, 9.5);
  ctx.lineTo(11.5, 9.5);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  return ctx.getImageData(0, 0, size * PR, size * PR);
}
