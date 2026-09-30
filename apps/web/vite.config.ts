import { defineConfig } from 'vite';

// base relative : le site fonctionne aussi bien à la racine d'un domaine que
// dans un sous-dossier (GitHub Pages : https://<user>.github.io/<repo>/).
export default defineConfig({
  base: './',
  worker: { format: 'es' },
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  server: { host: true },
});
