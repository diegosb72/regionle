import { Infinity as InfinityIcon, Moon, Sun, SunMoon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Spinner } from './components/ui';
import { loadIndex, loadWorldGeo, type World } from './lib/data';
import { SECTIONS } from './lib/modes';
import { useRoute } from './lib/router';
import { useStore, type Theme } from './lib/store';
import { cx } from './lib/text';
import type { Section } from './lib/types';
import { Home } from './screens/Home';
import { Play } from './screens/Play';
import { Progress } from './screens/Progress';
import { Setup } from './screens/Setup';

const THEME_NEXT: Record<Theme, Theme> = { auto: 'light', light: 'dark', dark: 'auto' };
const THEME_LABEL: Record<Theme, string> = { auto: 'Tema: automático', light: 'Tema: claro', dark: 'Tema: oscuro' };
const THEME_ICON = { auto: SunMoon, light: Sun, dark: Moon } as const;

const BY_PATH = Object.fromEntries((Object.keys(SECTIONS) as Section[]).map((s) => [SECTIONS[s].path, s])) as Record<string, Section>;

function Logo() {
  return (
    <svg className="logo" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" className="logo-bg" />
      <path className="logo-a" d="M7 9.5 15 7v8.5L7 18z" />
      <path className="logo-b" d="M17 7l8 2.5V17l-8-1.5z" />
      <path className="logo-c" d="M7 20.5l8-2.5v7l-8-1.5z" />
      <path className="logo-d" d="M17 18l8 1.5v4L17 25z" />
    </svg>
  );
}

export function App() {
  const route = useRoute();
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const [world, setWorld] = useState<World | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setError(null);
    loadIndex()
      .then((w) => alive && setWorld(w))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)));
    // The world outline is needed by every map: fetch it while the player chooses.
    loadWorldGeo().catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [attempt]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme = theme === 'auto' ? (mq.matches ? 'dark' : 'light') : theme;
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  const section = BY_PATH[route];
  const playing = route === 'jugar';
  const ThemeIcon = THEME_ICON[theme];

  let page;
  if (error) {
    page = (
      <div className="empty-state">
        <p>No se han podido cargar los datos del juego ({error}).</p>
        <button type="button" className="btn btn-primary" onClick={() => setAttempt((n) => n + 1)}>
          Reintentar
        </button>
      </div>
    );
  } else if (!world) page = <Spinner label="Cargando el atlas…" />;
  else if (playing) page = <Play world={world} />;
  else if (section) page = <Setup key={section} section={section} world={world} />;
  else if (route === 'progreso') page = <Progress world={world} />;
  else page = <Home world={world} />;

  if (playing && world && !error) return <div className="app app-play">{page}</div>;

  return (
    <div className="app">
      <a className="skip" href="#contenido">
        Saltar al contenido
      </a>
      <header className="top">
        <a className="brand" href="#/" aria-label="Regionle infinito, inicio">
          <Logo />
          <span>
            Regionle
            <InfinityIcon size={22} strokeWidth={2.6} aria-hidden="true" />
          </span>
        </a>
        <nav className="nav" aria-label="Secciones">
          {(Object.keys(SECTIONS) as Section[]).map((s) => (
            <a key={s} href={`#/${SECTIONS[s].path}`} className={cx(section === s && 'on')} aria-current={section === s ? 'page' : undefined}>
              {SECTIONS[s].name}
            </a>
          ))}
          <a href="#/progreso" className={cx(route === 'progreso' && 'on')} aria-current={route === 'progreso' ? 'page' : undefined}>
            Progreso
          </a>
        </nav>
        <button type="button" className="icon-btn" onClick={() => setTheme(THEME_NEXT[theme])} aria-label={`${THEME_LABEL[theme]}. Cambiar`} title={THEME_LABEL[theme]}>
          <ThemeIcon size={18} />
        </button>
      </header>
      <main id="contenido" className="main">
        {page}
      </main>
      <footer className="foot">
        <p>
          Inspirado en <a href="https://regionle.xyz" target="_blank" rel="noopener noreferrer">regionle.xyz</a>. Mapas de <a href="https://www.naturalearthdata.com" target="_blank" rel="noopener noreferrer">Natural Earth</a> (dominio público), población del Banco Mundial y datos de países de{' '}
          <a href="https://www.geonames.org" target="_blank" rel="noopener noreferrer">GeoNames</a> (CC BY 4.0).
        </p>
        <p>Las fronteras siguen el criterio de Naciones Unidas y no suponen ninguna toma de postura. Sin registro, sin anuncios, sin límite.</p>
      </footer>
    </div>
  );
}
