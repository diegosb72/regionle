/** Runs the game stored in the configuration: builds the deck and hands it to the right game. */
import { useEffect, useState } from 'react';
import { Spinner } from '../components/ui';
import { ExploreGame } from '../games/Explore';
import { NameAllGame } from '../games/NameAll';
import { NeighboursGame } from '../games/Neighbours';
import { PopGame } from '../games/PopGames';
import { QuizGame } from '../games/QuizGame';
import { TravelGame } from '../games/Travel';
import { GameShell, type GameProps } from '../games/common';
import { buildDeck, eligible, loadIndex, type World } from '../lib/data';
import { buildCityDeck, buildPhysicalDeck } from '../lib/extra';
import { L } from '../lib/i18n';
import { MODE_NAME, PATHS } from '../lib/modes';
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
            <p className="kicker">{L('Vaya', 'Oops')}</p>
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
              {L('Volver', 'Back')}
            </button>
          </div>
        </div>
      }
    />
  );
}

/** The deck a configuration asks for, whatever its section. */
export async function deckFor(cfg: GameConfig, onProgress?: (done: number, total: number) => void): Promise<Deck> {
  let countries = cfg.countries;
  // A review of countries or of capitals is played on the whole of their continents, not among the few that are due.
  if (cfg.review && (cfg.section === 'countries' || (cfg.section === 'cities' && cfg.opts.cityPick === 'caps'))) {
    const { index, byId } = await loadIndex();
    const mine = new Set(countries);
    const continents = new Set(countries.map((id) => byId.get(id)?.ct));
    countries = index.countries.filter((c) => mine.has(c.id) || (c.cl === 'un' && continents.has(c.ct))).map((c) => c.id);
  }
  if (cfg.section === 'cities') return buildCityDeck(countries, cfg.opts.cityPick, cfg.opts.cityCount, cfg.review ? cfg.only : undefined);
  if (cfg.section === 'physical') return buildPhysicalDeck(countries, cfg.review ? cfg.only : undefined);
  return buildDeck({ scope: cfg.section === 'regions' ? 'regions' : 'countries', countries, levels: cfg.levels }, onProgress);
}

function Session({ cfg, world }: { cfg: GameConfig; world: World }) {
  const start = useStore((s) => s.start);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<[number, number] | null>(null);
  const [attempt, setAttempt] = useState(0);
  const onExit = () => go(cfg.review ? '' : PATHS[cfg.section]);
  const onAgain: GameProps['onAgain'] = (patch) => start({ ...cfg, only: undefined, ...patch });

  useEffect(() => {
    if (cfg.section === 'pops') return;
    let alive = true;
    setError(null);
    deckFor(cfg, (done, total) => alive && setLoaded([done, total]))
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
    if (countries.length < 2) return <Message title={L('Faltan países', 'Not enough countries')} text={L('Este juego necesita al menos dos países con datos.', 'This game needs at least two countries with data.')} onExit={onExit} />;
    return <PopGame countries={countries} cfg={cfg} onExit={onExit} onAgain={onAgain} />;
  }

  if (error) {
    return (
      <Message
        title={L('No se ha podido cargar el mapa', 'The map could not be loaded')}
        text={L(`${error}. Comprueba la conexión y vuelve a intentarlo.`, `${error}. Check your connection and try again.`)}
        onExit={onExit}
        action={{ label: L('Reintentar', 'Retry'), run: () => setAttempt((n) => n + 1) }}
      />
    );
  }
  if (!deck) {
    return (
      <div className="play play-loading">
        <Spinner label={loaded && loaded[1] > 3 ? L(`Dibujando el mapa… ${loaded[0]} de ${loaded[1]} países`, `Drawing the map… ${loaded[0]} of ${loaded[1]} countries`) : L('Dibujando el mapa…', 'Drawing the map…')} />
      </div>
    );
  }
  if (deck.items.length < 2 && cfg.mode !== 'explore') {
    return <Message title={L('Este mapa tiene una sola pieza', 'This map has a single piece')} text={L('Elige más países o un nivel con más divisiones para poder jugar.', 'Choose more countries or a level with more divisions to play.')} onExit={onExit} />;
  }
  if (cfg.mode === 'capital' && !deck.items.some((it) => it.capital?.length)) {
    return <Message title={L('No tenemos esas capitales', 'We do not have those capitals')} text={L('Los datos no traen la capital de estas regiones. Prueba con otro país o con otro nivel.', 'The data has no capital for these regions. Try another country or another level.')} onExit={onExit} />;
  }

  const props: GameProps = { deck, cfg, onExit, onAgain };
  switch (cfg.mode) {
    case 'explore':
      return <ExploreGame {...props} />;
    case 'nameall':
      return <NameAllGame {...props} />;
    case 'travel':
      return <TravelGame {...props} />;
    case 'neighbours':
      return <NeighboursGame {...props} />;
    case 'pin':
    case 'puzzle':
    case 'identify':
    case 'outline':
    case 'capital':
    case 'flag':
      return <QuizGame {...props} />;
    default:
      return <Message title={L(`«${MODE_NAME[cfg.mode]}» no está disponible aquí`, `“${MODE_NAME[cfg.mode]}” is not available here`)} text={L('Elige otro modo de juego.', 'Choose another game mode.')} onExit={onExit} />;
  }
}

export function Play({ world }: { world: World }) {
  const cfg = useStore((s) => s.game);
  if (!cfg) return <Message title={L('No hay ninguna partida en marcha', 'There is no game in progress')} text={L('Elige países y un modo de juego para empezar.', 'Choose countries and a game mode to start.')} onExit={() => go('')} />;
  return <Session key={cfg.nonce} cfg={cfg} world={world} />;
}
