#!/usr/bin/env node
// Génère la planche de sprites de la carte (1x et 2x) à partir des icônes SVG
// de scripts/lib/icons.mjs :
//   apps/web/public/sprites/parkprix.{json,png} et parkprix@2x.{json,png}
// Format standard MapLibre (web et natif), avec les métadonnées d'étirement
// (stretchX / stretchY / content) des bulles de prix et étiquettes.
//
//   npm run sprites

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { buildIcons } from './lib/icons.mjs';

const OUT_DIR = path.resolve('apps/web/public/sprites');
const SHEET_WIDTH = 256;
const GAP = 2;

function pack(icons) {
  const entries = Object.entries(icons).sort((a, b) => b[1].height - a[1].height || a[0].localeCompare(b[0]));
  let x = GAP;
  let y = GAP;
  let rowHeight = 0;
  const placed = [];
  for (const [name, icon] of entries) {
    if (x + icon.width + GAP > SHEET_WIDTH) {
      x = GAP;
      y += rowHeight + GAP;
      rowHeight = 0;
    }
    placed.push({ name, icon, x, y });
    x += icon.width + GAP;
    rowHeight = Math.max(rowHeight, icon.height);
  }
  return { placed, width: SHEET_WIDTH, height: y + rowHeight + GAP };
}

function sheetSvg({ placed, width, height }) {
  const parts = placed.map(({ icon, x, y }, i) => {
    // identifiants uniques par icône (les filtres d'ombre portent tous id="s")
    const inner = icon.svg
      .replace(/id="s"/g, `id="s${i}"`)
      .replace(/url\(#s\)/g, `url(#s${i})`)
      .replace(/^<svg[^>]*>/, '')
      .replace(/<\/svg>\s*$/, '');
    return `<svg x="${x}" y="${y}" width="${icon.width}" height="${icon.height}" viewBox="0 0 ${icon.width} ${icon.height}" overflow="hidden">${inner}</svg>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${parts.join('')}</svg>`;
}

const scale = (v, r) => (Array.isArray(v) ? v.map((x) => scale(x, r)) : v * r);

async function main() {
  const icons = buildIcons();
  const layout = pack(icons);
  const svg = sheetSvg(layout);
  await mkdir(OUT_DIR, { recursive: true });
  for (const ratio of [1, 2]) {
    const png = new Resvg(svg, { fitTo: { mode: 'zoom', value: ratio }, font: { loadSystemFonts: false } }).render().asPng();
    const index = {};
    for (const { name, icon, x, y } of layout.placed) {
      index[name] = {
        x: x * ratio,
        y: y * ratio,
        width: icon.width * ratio,
        height: icon.height * ratio,
        pixelRatio: ratio,
        ...(icon.stretchX ? { stretchX: scale(icon.stretchX, ratio) } : {}),
        ...(icon.stretchY ? { stretchY: scale(icon.stretchY, ratio) } : {}),
        ...(icon.content ? { content: scale(icon.content, ratio) } : {}),
      };
    }
    const suffix = ratio === 1 ? '' : `@${ratio}x`;
    await writeFile(path.join(OUT_DIR, `parkprix${suffix}.png`), png);
    await writeFile(path.join(OUT_DIR, `parkprix${suffix}.json`), JSON.stringify(index, null, 1));
    console.log(`  → sprites/parkprix${suffix}.png (${layout.width * ratio}×${layout.height * ratio}, ${Object.keys(index).length} icônes)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
