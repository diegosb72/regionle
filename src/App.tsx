import { Infinity as InfinityIcon, Moon, Sun, SunMoon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Spinner } from './components/ui';
import { Daily } from './daily/Daily';
import { dayNumber, isDate } from './daily/spec';
import { loadIndex, loadWorldGeo, type World } from './lib/data';
import { L, getLang } from './lib/i18n';
import { PATHS, SECTIONS, SECTION_IDS } from './lib/modes';
import { OfflineBar, UpdateNotice } from './components/Offline';
import { useRoute } from './lib/router';
import { useStore, type Theme } from './lib/store';
import { cx, today } from './lib/text';
import type { Section } from './lib/types';
import { Duel } from './screens/Duel';
import { Home } from './screens/Home';
import { Play } from './screens/Play';
import { Progress } from './screens/Progress';
import { Setup } from './screens/Setup';

const THEME_NEXT: Record<Theme, Theme> = { auto: 'light', light: 'dark', dark: 'auto' };
const themeLabel = (theme: Theme): string => (theme === 'auto' ? L('Tema: automático', 'Theme: automatic') : theme === 'light' ? L('Tema: claro', 'Theme: light') : L('Tema: oscuro', 'Theme: dark'));
const THEME_ICON = { auto: SunMoon, light: Sun, dark: Moon } as const;

const BY_PATH = Object.fromEntries(SECTION_IDS.map((s) => [PATHS[s], s])) as Record<string, Section>;

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
  const setLang = useStore((s) => s.setLang);
  const [world, setWorld] = useState<World | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const lang = getLang();

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
  // "#/reto" is today's challenge; "#/reto/2026-11-10" a past one.
  const isDaily = route === 'reto' || route.startsWith('reto/');
  const asked = route.slice(5);
  const dailyDate = isDate(asked) && dayNumber(asked) >= 0 && asked <= today() ? asked : today();
  // "#/duelo/<code>" is a game sent by someone else.
  const duel = route.startsWith('duelo/') ? route.slice(6) : null;
  const ThemeIcon = THEME_ICON[theme];

  let page;
  if (error) {
    page = (
      <div className="empty-state">
        <p>{L(`No se han podido cargar los datos del juego (${error}).`, `The game data could not be loaded (${error}).`)}</p>
        <button type="button" className="btn btn-primary" onClick={() => setAttempt((n) => n + 1)}>
          {L('Reintentar', 'Retry')}
        </button>
      </div>
    );
  } else if (!world) page = <Spinner label={L('Cargando el atlas…', 'Loading the atlas…')} />;
  else if (playing) page = <Play world={world} />;
  else if (isDaily) page = <Daily key={dailyDate} world={world} date={dailyDate} />;
  else if (duel != null) page = <Duel key={duel} code={duel} world={world} />;
  else if (section) page = <Setup key={section} section={section} world={world} />;
  else if (route === 'progreso') page = <Progress world={world} />;
  else page = <Home world={world} />;

  if ((playing || isDaily) && world && !error) return <div className="app app-play">{page}</div>;

  return (
    <div className="app">
      <a className="skip" href="#contenido">
        {L('Saltar al contenido', 'Skip to content')}
      </a>
      <header className="top">
        <a className="brand" href="#/" aria-label={L('Regionle infinito, inicio', 'Regionle infinite, home')}>
          <Logo />
          <span>
            Regionle
            <InfinityIcon size={22} strokeWidth={2.6} aria-hidden="true" />
          </span>
        </a>
        <nav className="nav" aria-label={L('Secciones', 'Sections')}>
          {SECTION_IDS.map((s) => (
            <a key={s} href={`#/${SECTIONS[s].path}`} className={cx(section === s && 'on')} aria-current={section === s ? 'page' : undefined}>
              {SECTIONS[s].name}
            </a>
          ))}
          <a href="#/progreso" className={cx(route === 'progreso' && 'on')} aria-current={route === 'progreso' ? 'page' : undefined}>
            {L('Progreso', 'Progress')}
          </a>
        </nav>
        <div className="top-tools">
          <div className="lang" role="group" aria-label={L('Idioma', 'Language')}>
            {(['es', 'en'] as const).map((code) => (
              <button key={code} type="button" className={cx(lang === code && 'on')} aria-pressed={lang === code} lang={code} title={code === 'es' ? 'Español' : 'English'} onClick={() => setLang(code)}>
                {code.toUpperCase()}
              </button>
            ))}
          </div>
          <button type="button" className="icon-btn" onClick={() => setTheme(THEME_NEXT[theme])} aria-label={`${themeLabel(theme)}. ${L('Cambiar', 'Change')}`} title={themeLabel(theme)}>
            <ThemeIcon size={18} />
          </button>
        </div>
      </header>
      <main id="contenido" className="main">
        {page}
      </main>
      <footer className="foot">
        <OfflineBar />
        <p>
          {L('Inspirado en', 'Inspired by')}{' '}
          <a href="https://regionle.xyz" target="_blank" rel="noopener noreferrer">
            regionle.xyz
          </a>
          . {L('Mapas de', 'Maps from')}{' '}
          <a href="https://www.naturalearthdata.com" target="_blank" rel="noopener noreferrer">
            Natural Earth
          </a>{' '}
          {L('(dominio público), población del Banco Mundial y datos de países de', '(public domain), population from the World Bank and country data from')}{' '}
          <a href="https://www.geonames.org" target="_blank" rel="noopener noreferrer">
            GeoNames
          </a>{' '}
          (CC BY 4.0).
        </p>
        <p>
          {L(
            'Las fronteras siguen el criterio de Naciones Unidas y no suponen ninguna toma de postura. Sin registro, sin anuncios, sin límite.',
            'Borders follow the United Nations’ practice and imply no position on any dispute. No sign-up, no ads, no limit.',
          )}
        </p>
      </footer>
      <UpdateNotice />
    </div>
  );
}
