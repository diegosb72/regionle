import fs from 'node:fs';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const FLAG_DIR = path.resolve(process.cwd(), 'node_modules/flag-icons/flags/4x3');

/**
 * Serves the flag-icons SVGs at `<base>flags/<code>.svg`.
 * They stay in node_modules: the dev server reads them on demand and the build copies them into dist.
 */
function flags(): Plugin {
  return {
    name: 'regionle-flags',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = /\/flags\/([a-z-]+)\.svg(?:\?.*)?$/.exec(req.url ?? '');
        if (!m) return next();
        fs.readFile(path.join(FLAG_DIR, `${m[1]}.svg`), (err, data) => {
          if (err) return next();
          res.setHeader('Content-Type', 'image/svg+xml');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          res.end(data);
        });
      });
    },
    generateBundle() {
      for (const file of fs.readdirSync(FLAG_DIR)) {
        if (file.endsWith('.svg')) {
          this.emitFile({ type: 'asset', fileName: `flags/${file}`, source: fs.readFileSync(path.join(FLAG_DIR, file)) });
        }
      }
    },
  };
}

export default defineConfig({
  // Relative base: the built site works from any folder (GitHub Pages, a sub-path, file server…).
  base: './',
  plugins: [react(), flags()],
  server: { host: '0.0.0.0', port: 5173, strictPort: true, allowedHosts: true },
  preview: { host: '0.0.0.0', port: 4173, strictPort: true, allowedHosts: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
