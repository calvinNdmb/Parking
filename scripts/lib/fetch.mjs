import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const CACHE_DIR = path.resolve(process.env.PARKPRIX_CACHE_DIR ?? '.cache/sources');
const CACHE_TTL_MS = Number(process.env.PARKPRIX_CACHE_TTL_H ?? 12) * 3600 * 1000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Télécharge une ressource texte avec cache disque (.cache/sources) et
 * nouvelles tentatives (backoff exponentiel). `--refresh` ignore le cache.
 */
export async function fetchText(url, { label = url, init, retries = 3, timeoutMs = 180_000 } = {}) {
  const key = createHash('sha1').update(url + (init?.body ?? '')).digest('hex').slice(0, 16);
  const file = path.join(CACHE_DIR, `${key}.txt`);
  const refresh = process.argv.includes('--refresh');
  if (!refresh) {
    try {
      const s = await stat(file);
      if (Date.now() - s.mtimeMs < CACHE_TTL_MS) {
        console.log(`  ↺ cache  ${label}`);
        return await readFile(file, 'utf8');
      }
    } catch {
      /* pas de cache */
    }
  }
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const t0 = Date.now();
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const text = await res.text();
      await mkdir(CACHE_DIR, { recursive: true });
      await writeFile(file, text);
      console.log(`  ↓ ${(text.length / 1e6).toFixed(1)} Mo en ${((Date.now() - t0) / 1000).toFixed(1)} s  ${label}`);
      return text;
    } catch (err) {
      lastErr = err;
      console.warn(`  ! échec (${attempt + 1}/${retries + 1}) ${label}: ${err.message}`);
      if (attempt < retries) await sleep(2000 * 2 ** attempt);
    }
  }
  throw lastErr;
}

export async function fetchJson(url, opts) {
  return JSON.parse(await fetchText(url, opts));
}
