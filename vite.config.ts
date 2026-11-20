import fs from 'node:fs';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { RELEASES } from './src/lib/changelog.ts';
import { SITE_PAGES, localise, pageFile, pageNamed, robots, siteUrl, sitemap } from './src/lib/seo.ts';

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

const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8')) as { version: string; homepage?: string };
/** Where the site is published: `SITE_URL` when building for somewhere else, `homepage` of package.json otherwise. */
const SITE = siteUrl(process.env.SITE_URL ?? pkg.homepage);

/** The fonts of the first screen for a reader of Spanish or English: asked for at once, so that the text does not jump when they arrive. */
const FIRST_FONTS = /^assets\/(dm-sans-latin-wght-normal|fraunces-latin-opsz-normal)-[\w-]+\.woff2$/;

/**
 * What search engines and social networks read, which needs whole addresses and one language per page:
 *
 *  · `index.html` gets its title, description, canonical address, card and schema.org data (`src/lib/seo.ts`);
 *  · `es.html` and `en.html` are the same page written for one language (the game opened from them speaks it
 *    to whoever has not chosen another), each pointing at the others with `hreflang`;
 *  · each screen with something of its own to say has its page in each language (`regiones.html`,
 *    `regions.html`…): the same page again with the title and the description of that screen, which the
 *    game opens on. What comes after `#` never reaches a server, so they are the only way a search engine,
 *    or the card of a link, gets to speak of a screen;
 *  · `sitemap.xml` and `robots.txt` list them.
 *
 * While developing, the address of any of those pages is answered with that page too.
 */
function pages(): Plugin {
  return {
    name: 'regionle-pages',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const asked = /\/([a-z]+)\.html(?:$|[?#])/.exec(ctx.originalUrl ?? '');
        const fonts = Object.keys(ctx.bundle ?? {})
          .filter((file) => FIRST_FONTS.test(file))
          .sort();
        return {
          html: localise(html, (asked && pageNamed(asked[1])) || 'index', SITE, pkg.version),
          tags: fonts.map((file) => ({ tag: 'link', attrs: { rel: 'preload', as: 'font', type: 'font/woff2', crossorigin: true, href: `./${file}` }, injectTo: 'head' as const })),
        };
      },
    },
    generateBundle(_, bundle) {
      const index = bundle['index.html'];
      if (!index || index.type !== 'asset') return;
      const html = String(index.source);
      for (const page of SITE_PAGES) if (page !== 'index') this.emitFile({ type: 'asset', fileName: pageFile(page), source: localise(html, page, SITE, pkg.version) });
      if (!SITE) {
        this.warn('No se sabe dónde se publica el sitio ("homepage" en package.json o SITE_URL): no se escriben canonical, Open Graph, sitemap.xml ni robots.txt.');
        return;
      }
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap(SITE, RELEASES[0].date) });
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots(SITE) });
    },
  };
}

const LUCIDE = /node_modules[\\/]lucide-react[\\/]/;

/**
 * The icons the first screen draws, as the names of their files in lucide-react ("arrow-right"): the ones
 * imported by whatever `src/main.tsx` reaches without waiting for anything, which is what travels with the
 * page. Worked out by reading the imports, because the bundler only knows that every screen imports the one
 * file of lucide-react that names them all.
 *
 * An icon that is missed here is not lost: it lands in the second file, and the page fetches both. The size
 * check (`scripts/budget.mjs`) says so.
 */
function firstIcons(): Set<string> {
  const exts = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];
  const seen = new Set<string>();
  const names = new Set<string>();
  const walk = (file: string): void => {
    if (seen.has(file)) return;
    seen.add(file);
    if (!/\.tsx?$/.test(file)) return;
    // Static imports and re-exports, on one line or on several; what is imported with `import()` waits, and
    // `import type` brings no code.
    for (const [, type, what, from] of fs.readFileSync(file, 'utf8').matchAll(/^(?:import|export)\s+(type\s+)?([^'"]*?)\s*(?:from\s+)?['"]([^'"]+)['"]/gms)) {
      if (type) continue;
      if (from === 'lucide-react') {
        for (const one of what.replace(/[{}]/g, '').split(',')) {
          const name = one.trim().split(/\s+as\s+/)[0];
          if (name && !name.startsWith('type ')) names.add(name);
        }
      } else if (from.startsWith('.')) {
        const base = path.resolve(path.dirname(file), from);
        const found = exts.map((ext) => base + ext).find((f) => fs.existsSync(f) && fs.statSync(f).isFile());
        if (found) walk(found);
      }
    }
  };
  walk(path.resolve(process.cwd(), 'src/main.tsx'));
  // lucide-react says which file each name is in: `export { default as Flag, default as FlagIcon } from './icons/flag.mjs'`.
  const files = new Set<string>();
  const barrel = fs.readFileSync(path.resolve(process.cwd(), 'node_modules/lucide-react/dist/esm/lucide-react.mjs'), 'utf8');
  for (const [, list, file] of barrel.matchAll(/^export \{([^}]+)\} from '\.\/icons\/([\w-]+)\.m?js';/gm)) {
    if (list.split(',').some((one) => names.has(one.replace('default as', '').trim()))) files.add(file);
  }
  return files;
}
const FIRST_ICONS = firstIcons();
/** An icon of lucide-react that the first screen does not draw. */
const laterIcon = (id: string): boolean => {
  const icon = /[\\/]icons[\\/]([\w-]+)\.m?js$/.exec(id)?.[1];
  return !!icon && !FIRST_ICONS.has(icon);
};

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  // Relative base: the built site works from any folder (GitHub Pages, a sub-path, file server…).
  base: './',
  plugins: [react(), flags(), pages()],
  server: { host: '0.0.0.0', port: 5173, strictPort: true, allowedHosts: true },
  preview: { host: '0.0.0.0', port: 4173, strictPort: true, allowedHosts: true },
  build: {
    target: 'es2022',
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // What every screen stands on. It changes far less often than the game does, so a new version of
            // the game leaves it where it is in the browser's cache.
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler|zustand)[\\/]/, priority: 30 },
            // Two files of icons instead of dozens of tiny ones: those of the first screen, which travel with
            // the page, and those of the other screens and of the games, fetched with the first that needs one.
            { name: 'icons', test: (id) => LUCIDE.test(id) && !laterIcon(id), priority: 21 },
            { name: 'icons-more', test: LUCIDE, priority: 20 },
            // What draws the maps: only fetched with the first screen that has one.
            { name: 'map', test: /node_modules[\\/]d3-[^\\/]+[\\/]/, priority: 20 },
          ],
        },
      },
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
