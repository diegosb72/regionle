import { Infinity as InfinityIcon, Moon, Settings as Gear, Sun, SunMoon } from 'lucide-react';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { lazyScreen, savingData, whenIdle } from './components/lazy';
import { OfflineBar, UpdateNotice } from './components/Offline';
import { Seg, Spinner, Toggle } from './components/ui';
import { badgeSchedule, badgeSupported, keepBadgeFresh, showBadge, tellWorker, waitingAt } from './lib/appBadge';
import { PULSES, TONES, buzz, canBuzz, play, prime } from './lib/feedback';
import { useFullscreen } from './lib/fullscreen';
import { L, getLang } from './lib/i18n';
import { SECTIONS, SECTION_IDS } from './lib/modes';
import { applyMeta } from './lib/pageMeta';
import { PALETTES, applyPalette, paletteHint, paletteName } from './lib/palette';
import { followLang, go, inGame, useRoute } from './lib/router';
import { ABOUT_PATH, PATHS, PROGRESS_PATH, SETTINGS_PATH, routeOf, screenPage } from './lib/routes';
import { shortcutOf } from './lib/shortcuts';
import { useStore, type Theme } from './lib/store';
import { cx, today } from './lib/text';
import { VERSION } from './lib/version';
import { loadIndex, loadWorldGeo, type World } from './lib/world';
import { Home } from './screens/Home';
import { NotFound } from './screens/NotFound';

// Every screen but the first is fetched when it is first needed, and all of them once the first is on screen.
const Setup = lazyScreen(() => import('./screens/Setup').then((m) => m.Setup));
const Play = lazyScreen(() => import('./screens/Play').then((m) => m.Play));
const Daily = lazyScreen(() => import('./daily/Daily').then((m) => m.Daily));
const Duel = lazyScreen(() => import('./screens/Duel').then((m) => m.Duel));
const ListLink = lazyScreen(() => import('./screens/ListLink').then((m) => m.ListLink));
const Progress = lazyScreen(() => import('./screens/Progress').then((m) => m.Progress));
const Settings = lazyScreen(() => import('./screens/Settings').then((m) => m.Settings));
const About = lazyScreen(() => import('./screens/About').then((m) => m.About));
/** In the order they are most likely to be asked for. */
const SCREENS = [Setup, Play, Daily, Progress, Settings, Duel, ListLink, About];
/** The panel of keyboard shortcuts: asked for with "?" by few, so it comes when it is asked for. */
const KeysDialog = lazyScreen(() => import('./components/KeyHelp').then((m) => m.KeysDialog));
/** The achievements are worked out once the page is drawn: none is earned before something is played. */
const BadgeWatcher = lazyScreen(() => import('./components/Badges').then((m) => m.BadgeWatcher));

const THEME_NEXT: Record<Theme, Theme> = { auto: 'light', light: 'dark', dark: 'auto' };
const themeLabel = (theme: Theme): string => (theme === 'auto' ? L('Tema: automático', 'Theme: automatic') : theme === 'light' ? L('Tema: claro', 'Theme: light') : L('Tema: oscuro', 'Theme: dark'));
const THEME_ICON = { auto: SunMoon, light: Sun, dark: Moon } as const;

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

/**
 * The number of waiting reviews on the icon of the installed game, kept up while the game is open: at each
 * answer, every few minutes (reviews fall due as time passes) and when the game is left, which is when the
 * service worker gets the count for the days ahead (`lib/appBadge.ts`).
 */
function useIconBadge(on: boolean): void {
  useEffect(() => {
    if (!badgeSupported()) return;
    if (!on) {
      showBadge(0);
      tellWorker(null);
      void keepBadgeFresh(false);
      return;
    }
    const update = (ahead: boolean) => {
      const { stats, where } = useStore.getState();
      const now = Date.now();
      showBadge(waitingAt(stats, where, now));
      if (ahead) tellWorker(badgeSchedule(stats, where, now));
    };
    let soon = 0;
    update(true);
    void keepBadgeFresh(true);
    const stop = useStore.subscribe((s, was) => {
      // The pace of the reviews says what is waiting, as much as the answers do.
      if (s.stats === was.stats && s.where === was.where && s.reviewPace === was.reviewPace) return;
      // Answers come in bursts: one count when they stop.
      window.clearTimeout(soon);
      soon = window.setTimeout(() => update(true), 1500);
    });
    const tick = window.setInterval(() => update(false), 5 * 60_000);
    const seen = () => update(true);
    document.addEventListener('visibilitychange', seen);
    return () => {
      stop();
      window.clearTimeout(soon);
      window.clearInterval(tick);
      document.removeEventListener('visibilitychange', seen);
    };
  }, [on]);
}

export function App() {
  const path = useRoute();
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const sound = useStore((s) => s.sound);
  const setSound = useStore((s) => s.setSound);
  const haptic = useStore((s) => s.haptic);
  const setHaptic = useStore((s) => s.setHaptic);
  const [buzzes] = useState(canBuzz);
  const iconBadge = useStore((s) => s.iconBadge);
  const setIconBadge = useStore((s) => s.setIconBadge);
  const [badges] = useState(badgeSupported);
  useIconBadge(iconBadge);
  const miles = useStore((s) => s.miles);
  const setMiles = useStore((s) => s.setMiles);
  const palette = useStore((s) => s.palette);
  const setPalette = useStore((s) => s.setPalette);
  const full = useFullscreen();
  const setLang = useStore((s) => s.setLang);
  const cb = useStore((s) => s.cb);
  const setCb = useStore((s) => s.setCb);
  const [world, setWorld] = useState<World | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const lang = getLang();
  const now = today();
  const route = useMemo(() => routeOf(path, now), [path, now]);
  const content = useRef<HTMLElement>(null);
  const shown = useRef(path);

  useEffect(() => {
    let alive = true;
    setError(null);
    loadIndex()
      .then((w) => {
        if (alive) setWorld(w);
        // The world outline is needed by every map: it is fetched while the player chooses, once the
        // index, which the first screen is waiting for, has the line to itself.
        loadWorldGeo().catch(() => undefined);
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [attempt]);

  // With the first screen in place, the code of the others is brought in the background.
  const ready = world != null;
  useEffect(() => {
    if (!ready || savingData()) return;
    return whenIdle(() => {
      for (const screen of SCREENS) screen.warm();
    });
  }, [ready]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme = theme === 'auto' ? (mq.matches ? 'dark' : 'light') : theme;
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  // Colours that do not depend on telling red from green: the stylesheet does the rest.
  useEffect(() => {
    if (cb) document.documentElement.dataset.cb = '1';
    else delete document.documentElement.dataset.cb;
  }, [cb]);

  // The colours of the maps: the stylesheet has each palette under its name.
  useEffect(() => applyPalette(palette), [palette]);

  useEffect(() => {
    applyMeta(route);
  }, [route]);

  // A new screen starts at its top, as a new page would, for the eye and for whoever moves with the keyboard
  // or listens to the page: the focus goes to the content unless the screen has already taken it.
  useEffect(() => {
    if (shown.current === path) return;
    shown.current = path;
    window.scrollTo(0, 0);
    const box = content.current;
    if (box && !box.contains(document.activeElement)) box.focus({ preventScroll: true });
  }, [path]);

  // Browsers let a page make sound only once the player has done something on it: the first click or key
  // gets it ready, so that the first answer is heard.
  useEffect(() => {
    if (!sound) return;
    const ready = () => prime();
    window.addEventListener('pointerdown', ready, { once: true, capture: true });
    window.addEventListener('keydown', ready, { once: true, capture: true });
    return () => {
      window.removeEventListener('pointerdown', ready, { capture: true });
      window.removeEventListener('keydown', ready, { capture: true });
    };
  }, [sound]);

  // Keys that work on any screen. They stand aside while something is typed, while a map holds the keyboard
  // and while a panel is open, and they do not take anyone out of a game.
  const playing = route.kind === 'play' || route.kind === 'daily';
  const [help, setHelp] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.isComposing) return;
      const at = e.target instanceof Element ? e.target : null;
      const busy = !!at?.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="application"], dialog[open]');
      const st = useStore.getState();
      const act = shortcutOf({ key: e.key, ctrl: e.ctrlKey, meta: e.metaKey, alt: e.altKey, busy, playing, off: !st.hotkeys });
      if (!act) return;
      e.preventDefault();
      if (act.kind === 'go') go(act.path);
      else if (act.kind === 'theme') st.setTheme(THEME_NEXT[st.theme]);
      else setHelp(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playing]);
  const keys = help ? (
    <ErrorBoundary>
      <Suspense fallback={null}>
        <KeysDialog onClose={() => setHelp(false)} />
      </Suspense>
    </ErrorBoundary>
  ) : null;
  // If its code does not come, the game goes on without the notice: the achievement is worked out the next time.
  const watcher = world ? (
    <ErrorBoundary fallback={() => null}>
      <Suspense fallback={null}>
        <BadgeWatcher world={world} />
      </Suspense>
    </ErrorBoundary>
  ) : null;

  const section = route.kind === 'section' ? route.section : null;
  const settings = route.kind === 'settings';
  const progress = route.kind === 'progress';
  const about = route.kind === 'about';
  const ThemeIcon = THEME_ICON[theme];
  // The whole window is the game: no header, no footer.
  const immersive = (route.kind === 'play' || route.kind === 'daily') && world != null && !error;

  let page;
  if (route.kind === 'unknown') page = <NotFound path={route.path} />;
  else if (about) page = <About />;
  else if (error) {
    page = (
      <div className="empty-state" role="alert">
        <p>{L(`No se han podido cargar los datos del juego (${error}).`, `The game data could not be loaded (${error}).`)}</p>
        <button type="button" className="btn btn-primary" onClick={() => setAttempt((n) => n + 1)}>
          {L('Reintentar', 'Retry')}
        </button>
      </div>
    );
  } else if (!world) page = <Spinner label={L('Cargando el atlas…', 'Loading the atlas…')} />;
  else if (route.kind === 'play') page = <Play world={world} />;
  else if (route.kind === 'daily') page = <Daily key={route.date} world={world} date={route.date} />;
  else if (route.kind === 'duel') page = <Duel key={route.code} code={route.code} world={world} />;
  else if (route.kind === 'list') page = <ListLink key={route.code} code={route.code} world={world} />;
  else if (section) page = <Setup key={section} section={section} world={world} link={route.kind === 'section' ? route.link : undefined} />;
  else if (progress) page = <Progress world={world} />;
  else if (route.kind === 'settings') page = <Settings world={world} path={route.path} />;
  else page = <Home world={world} />;

  // What breaks stays inside its screen, and moving to another one leaves it behind. A screen is also
  // mounted afresh when the unit of the distances changes: every text that tells one is read again.
  const guarded = (
    <ErrorBoundary key={`${miles ? 'mi' : 'km'} ${route.kind === 'settings' ? SETTINGS_PATH : route.kind === 'section' ? PATHS[route.section] : path}`}>
      <Suspense fallback={<Spinner label={L('Cargando…', 'Loading…')} />}>{page}</Suspense>
    </ErrorBoundary>
  );

  if (immersive)
    return (
      <div className="app app-play">
        <main id="contenido" className="play-main" ref={content} tabIndex={-1}>
          {guarded}
        </main>
        {watcher}
        {keys}
      </div>
    );

  return (
    <div className="app">
      <a
        className="skip"
        href="#contenido"
        onClick={(e) => {
          // What comes after "#" is the address of the screen: followed as it is, this link would ask for a
          // screen called "contenido" instead of moving down the page.
          e.preventDefault();
          content.current?.focus();
        }}
      >
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
          <a href={`#/${PROGRESS_PATH}`} className={cx(progress && 'on')} aria-current={progress ? 'page' : undefined}>
            {L('Progreso', 'Progress')}
          </a>
        </nav>
        <div className="top-tools">
          <div className="lang" role="group" aria-label={L('Idioma', 'Language')}>
            {(['es', 'en'] as const).map((code) => (
              <button
                key={code}
                type="button"
                className={cx(lang === code && 'on')}
                aria-pressed={lang === code}
                lang={code}
                title={code === 'es' ? 'Español' : 'English'}
                onClick={() => {
                  setLang(code);
                  followLang(code, true);
                }}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>
          <button type="button" className="icon-btn" onClick={() => setTheme(THEME_NEXT[theme])} aria-label={`${themeLabel(theme)}. ${L('Cambiar', 'Change')}`} title={themeLabel(theme)}>
            <ThemeIcon size={18} aria-hidden="true" />
          </button>
          <a className={cx('icon-btn', settings && 'on')} href={`#/${SETTINGS_PATH}`} aria-label={L('Configuración', 'Settings')} title={L('Configuración', 'Settings')} aria-current={settings ? 'page' : undefined}>
            <Gear size={18} aria-hidden="true" />
          </a>
        </div>
      </header>
      <main id="contenido" className="main" ref={content} tabIndex={-1}>
        {guarded}
      </main>
      <footer className="foot">
        <OfflineBar />
        <div className="foot-prefs">
          <div className="foot-pick">
            <b>{L('Colores del mapa', 'Colours of the map')}</b>
            <Seg
              small
              label={L('Colores del mapa', 'Colours of the map')}
              value={palette}
              onChange={setPalette}
              options={PALETTES.map((p) => ({
                value: p,
                title: paletteHint(p),
                label: (
                  <>
                    <i className={`pal pal-${p}`} aria-hidden="true" />
                    {paletteName(p)}
                  </>
                ),
              }))}
            />
            <small>{paletteHint(palette)}</small>
          </div>
          <Toggle checked={cb} onChange={setCb} hint={L('Azul, amarillo y rojo con tramas en lugar de verde, amarillo y rojo.', 'Blue, yellow and red with textures instead of green, yellow and red.')}>
            {L('Colores para daltónicos', 'Colour-blind friendly colours')}
          </Toggle>
          <Toggle
            checked={sound}
            onChange={(on) => {
              setSound(on);
              // Turned on, it is heard at once: that is how a right answer sounds.
              if (on) play(TONES.ok);
            }}
            hint={L('Dos notas hacia arriba al acertar y dos hacia abajo al fallar.', 'Two notes up for a right answer and two down for a miss.')}
          >
            {L('Sonidos al responder', 'Sounds when you answer')}
          </Toggle>
          {buzzes && (
            <Toggle
              checked={haptic}
              onChange={(on) => {
                setHaptic(on);
                if (on) buzz(PULSES.ok);
              }}
              hint={L('Un toque al acertar y dos al fallar.', 'One tap for a right answer and two for a miss.')}
            >
              {L('Vibración al responder', 'Vibration when you answer')}
            </Toggle>
          )}
          <Toggle checked={miles} onChange={setMiles} hint={L('Las distancias, en millas, y las superficies, en millas cuadradas. Las altitudes siguen en metros.', 'Distances in miles and surfaces in square miles. Heights stay in metres.')}>
            {L('Distancias en millas', 'Distances in miles')}
          </Toggle>
          {badges && (
            <Toggle
              checked={iconBadge}
              onChange={setIconBadge}
              hint={L('Con el juego instalado, su icono lleva el número de repasos que te esperan.', 'With the game installed, its icon carries the number of reviews waiting for you.')}
            >
              {L('Repasos pendientes en el icono', 'Waiting reviews on the icon')}
            </Toggle>
          )}
        </div>
        <p>
          {L('Inspirado en', 'Inspired by')}{' '}
          <a href="https://regionle.xyz" target="_blank" rel="noopener noreferrer">
            regionle.xyz
          </a>
          . {L('Mapas de', 'Maps from')}{' '}
          <a href="https://www.naturalearthdata.com" target="_blank" rel="noopener noreferrer">
            Natural Earth
          </a>{' '}
          {L('(dominio público), ríos y relieve de España del', '(public domain), rivers and relief of Spain from the')}{' '}
          <a href="https://www.ign.es/web/ane-area-ane" target="_blank" rel="noopener noreferrer">
            Atlas Nacional de España
          </a>{' '}
          {L('(CC BY 4.0 ign.es), población del Banco Mundial y datos de países de', '(CC BY 4.0 ign.es), population from the World Bank and country data from')}{' '}
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
        <p className="foot-about">
          <a href={screenPage(ABOUT_PATH, lang)} onClick={inGame(ABOUT_PATH)} aria-current={about ? 'page' : undefined}>
            {L('Acerca de, privacidad y licencias', 'About, privacy and licences')}
          </a>
          <span aria-hidden="true"> · </span>
          {full.can && (
            <>
              <button type="button" className="foot-full" onClick={full.toggle} aria-pressed={full.on}>
                {full.on ? L('Salir de pantalla completa', 'Leave full screen') : L('Pantalla completa', 'Full screen')}
              </button>
              <span aria-hidden="true"> · </span>
            </>
          )}
          <button type="button" className="foot-keys" onClick={() => setHelp(true)} aria-haspopup="dialog">
            {L('Atajos de teclado', 'Keyboard shortcuts')}
          </button>
          <span aria-hidden="true"> · </span>
          <span>
            {L('Versión', 'Version')} {VERSION}
          </span>
        </p>
      </footer>
      <UpdateNotice />
      {keys}
      {watcher}
    </div>
  );
}
