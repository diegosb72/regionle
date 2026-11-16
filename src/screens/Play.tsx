/** Runs the game stored in the configuration: builds the deck and hands it to the right game. */
import { useEffect, useState } from 'react';
import { Spinner } from '../components/ui';
import { ExploreGame } from '../games/Explore';
import { NameAllGame } from '../games/NameAll';
import { PopGame } from '../games/PopGames';
import { QuizGame } from '../games/QuizGame';
import { TravelGame } from '../games/Travel';
import { GameShell, type GameProps } from '../games/common';
import { buildDeck, eligible, type World } from '../lib/data';
import { MODE_NAME, SECTIONS } from '../lib/modes';
import { go } from '../lib/router';
import { useStore, type GameConfig } from '../lib/store';
import type { Deck } from '../lib/types';

function Message({ title, text, onExit, action }: { title: string; text: string; onExit(): void; action?: { label: string; run(): void } }) {
  return (
    <GameShell
      title="Regionle"
      subtitle=""
      onExit={onExit}
      panel={
        <div className="q">
          <div className="q-prompt">
            <p className="kicker">Vaya</p>
            <h2 className="q-ask">{title}</h2>
          </div>
          <p className="q-note">{text}</p>
          <div className="q-actions">
            {action && (
              <button type="button" className="btn btn-primary" onClick={action.run}>
                {action.label}
              </button>
            )}
            <button type="button" className="btn" onClick={onExit}>
              Volver
            </button>
          </div>
        </div>
      }
    />
  );
}

function Session({ cfg, world }: { cfg: GameConfig; world: World }) {
  const start = useStore((s) => s.start);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<[number, number] | null>(null);
  const [attempt, setAttempt] = useState(0);
  const onExit = () => go(SECTIONS[cfg.section].path);
  const onAgain: GameProps['onAgain'] = (patch) => start({ ...cfg, only: undefined, ...patch });

  useEffect(() => {
    if (cfg.section === 'pops') return;
    let alive = true;
    setError(null);
    buildDeck({ scope: cfg.section, countries: cfg.countries, levels: cfg.levels }, (done, total) => alive && setLoaded([done, total]))
      .then((d) => {
        if (!alive) return;
        // Handy when debugging from the browser console; removed from production builds.
        if (import.meta.env.DEV) (window as unknown as { __deck?: Deck }).__deck = d;
        setDeck(d);
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [cfg, attempt]);

  if (cfg.section === 'pops') {
    const metric = cfg.opts.metric;
    const countries = cfg.countries
      .map((id) => world.byId.get(id))
      .filter((c) => c != null && eligible('pops', c) && (metric === 'pop' || c.ar > 0))
      .map((c) => c!);
    if (countries.length < 2) return <Message title="Faltan países" text="Este juego necesita al menos dos países con datos." onExit={onExit} />;
    return <PopGame countries={countries} cfg={cfg} onExit={onExit} onAgain={onAgain} />;
  }

  if (error) {
    return <Message title="No se ha podido cargar el mapa" text={`${error}. Comprueba la conexión y vuelve a intentarlo.`} onExit={onExit} action={{ label: 'Reintentar', run: () => setAttempt((n) => n + 1) }} />;
  }
  if (!deck) {
    return (
      <div className="play play-loading">
        <Spinner label={loaded && loaded[1] > 3 ? `Dibujando el mapa… ${loaded[0]} de ${loaded[1]} países` : 'Dibujando el mapa…'} />
      </div>
    );
  }
  if (deck.items.length < 2 && cfg.mode !== 'explore') {
    return <Message title="Este mapa tiene una sola pieza" text="Elige más países o un nivel con más divisiones para poder jugar." onExit={onExit} />;
  }

  const props: GameProps = { deck, cfg, onExit, onAgain };
  switch (cfg.mode) {
    case 'explore':
      return <ExploreGame {...props} />;
    case 'nameall':
      return <NameAllGame {...props} />;
    case 'travel':
      return <TravelGame {...props} />;
    case 'pin':
    case 'identify':
    case 'outline':
    case 'capital':
    case 'flag':
      return <QuizGame {...props} />;
    default:
      return <Message title={`«${MODE_NAME[cfg.mode]}» no está disponible aquí`} text="Elige otro modo de juego." onExit={onExit} />;
  }
}

export function Play({ world }: { world: World }) {
  const cfg = useStore((s) => s.game);
  if (!cfg) return <Message title="No hay ninguna partida en marcha" text="Elige países y un modo de juego para empezar." onExit={() => go('')} />;
  return <Session key={cfg.nonce} cfg={cfg} world={world} />;
}
