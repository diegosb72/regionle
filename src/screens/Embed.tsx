/**
 * The game alone, for a box in another page (lib/embed.ts). First a card that says what it is, with a button
 * to start: nothing starts by itself in a page that someone is reading, and no map is fetched for a reader
 * who goes past. Then the game, and leaving the game comes back to the card. A map to look at has nothing
 * to start, and is shown at once.
 *
 * The game is kept here and not as the game in course of whoever plays: where the box shares what the
 * browser keeps with the whole of the game, the game left half-way there is not written over.
 */
import './embed.css';
import { ExternalLink, Infinity as InfinityIcon, Play as PlayIcon } from 'lucide-react';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { lazyScreen } from '../components/lazy';
import { Flag, Spinner } from '../components/ui';
import { embedGame, parseEmbed } from '../lib/embed';
import { L } from '../lib/i18n';
import { modeNameIn } from '../lib/modes';
import { linkTo } from '../lib/routes';
import type { GameConfig } from '../lib/store';
import { cx } from '../lib/text';
import type { World } from '../lib/world';

/**
 * The game itself, and with it the code of every game, comes when it is started: whoever reads the other
 * page and goes past the card is not made to fetch it.
 */
const Session = lazyScreen(() => import('./Play').then((m) => m.Session));

/** How many flags the card shows before it says how many more there are. */
const FLAGS = 9;

/** The line under whatever the box shows: whose game this is, and the way to the whole of it. */
function Credit({ full }: { full?: string }) {
  return (
    <footer className="embed-foot">
      <a href={linkTo(full ?? '')} target="_blank" rel="noopener">
        <span className="embed-brand">
          Regionle
          <InfinityIcon size={15} strokeWidth={2.6} aria-hidden="true" />
        </span>
        <span>{full ? L('Abrir en una pestaña nueva', 'Open in a new tab') : L('Ir al juego', 'Go to the game')}</span>
        <ExternalLink size={13} aria-hidden="true" />
      </a>
    </footer>
  );
}

export function Embed({ rest, world }: { rest: string; world: World }) {
  const game = useMemo(() => {
    const what = parseEmbed(rest);
    return what ? embedGame(what, world) : null;
  }, [rest, world]);
  /** The game being played; none while the card is on show. */
  const [run, setRun] = useState<GameConfig | null>(null);

  // The game and the card take each other's place with no change of address, and the button that was pressed
  // goes away with what it was on: the keyboard is put at the top of what has come, as on any new screen,
  // unless that has taken it already. Never as the box comes up: until someone uses it, the keys belong to
  // the page around it.
  const shown = useRef(run);
  useEffect(() => {
    if (shown.current === run) return;
    shown.current = run;
    const content = document.getElementById('contenido');
    if (content && !content.contains(document.activeElement)) content.focus({ preventScroll: true });
  }, [run]);

  if (!game) {
    return (
      <div className="embed">
        <div className="embed-card">
          <div className="embed-box" role="alert">
            <p className="kicker">{L('Mapa incrustado', 'Embedded map')}</p>
            <h1>{L('Esta dirección no es la de ningún mapa', 'This address is not that of any map')}</h1>
            <p className="embed-desc">
              {L(
                'Puede que el código se haya cortado al copiarlo. Quien lleva esta página lo puede sacar otra vez en Regionle: el botón «Incrustar», junto al enlace del mapa.',
                'The code may have been cut when it was copied. Whoever runs this page can get it again in Regionle: the “Embed” button, next to the link to the map.',
              )}
            </p>
          </div>
        </div>
        <Credit />
      </div>
    );
  }

  const { def, title, full } = game;
  const begin = (next: Omit<GameConfig, 'nonce'> = game.cfg) => setRun({ ...next, nonce: Math.max(Date.now(), (run?.nonce ?? 0) + 1) });
  // A map to look at has nothing to start: no clock, no questions.
  const still = def.id === 'explore';
  const cfg = run ?? (still ? { ...game.cfg, nonce: 1 } : null);
  const name = modeNameIn(game.cfg.section, def.id);
  /** The flags of the countries of the map: something of it to see before any of it is fetched. A physical map has none. */
  const flags = game.cfg.section === 'physical' ? [] : game.cfg.countries.map((id) => world.byId.get(id)).filter((c) => c != null);

  return (
    // With nowhere to leave to, the map to look at has no button to leave by (embed.css).
    <div className={cx('embed', cfg && !run && 'embed-still')}>
      {cfg ? (
        <Suspense
          fallback={
            <div className="embed-card">
              <Spinner label={L('Cargando el juego…', 'Loading the game…')} />
            </div>
          }
        >
          <Session key={cfg.nonce} cfg={cfg} world={world} host={{ onExit: () => setRun(null), onAgain: begin }} />
        </Suspense>
      ) : (
        <div className="embed-card">
          <div className="embed-box">
            {flags.length > 0 && (
              <div className="embed-flags" aria-hidden="true">
                {flags.slice(0, FLAGS).map((c) => (
                  <Flag key={c.id} code={c.fl} size="sm" />
                ))}
                {flags.length > FLAGS && <small>+{flags.length - FLAGS}</small>}
              </div>
            )}
            <p className="kicker">{name}</p>
            {/* Folded in a narrow column, the dot between two parts ends a line: it never starts one. */}
            <h1>{title.replace(/ · /g, '\u00a0· ')}</h1>
            <p className="embed-desc">{def.desc}</p>
            {/* Whoever is about to press it gets the code of the game on its way. */}
            <button type="button" className="btn btn-primary btn-lg" onClick={() => begin()} onPointerEnter={Session.warm} onFocus={Session.warm}>
              <PlayIcon size={18} aria-hidden="true" />
              {L('Empezar', 'Start')}
            </button>
          </div>
        </div>
      )}
      <Credit full={full} />
    </div>
  );
}
