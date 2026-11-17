/** Runs the game stored in the configuration: builds the deck and hands it to the right game. */
import { useEffect, useMemo, useState } from 'react';
import { Spinner } from '../components/ui';
import { BlindGame } from '../games/Blind';
import { ExploreGame } from '../games/Explore';
import { LearnGame } from '../games/Learn';
import { ListEditor } from '../games/ListEditor';
import { NameAllGame } from '../games/NameAll';
import { NeighboursGame } from '../games/Neighbours';
import { PopGame } from '../games/PopGames';
import { QuizGame } from '../games/QuizGame';
import { RegionleGame } from '../games/Regionle';
import { TravelGame } from '../games/Travel';
import { GameShell, type GameProps } from '../games/common';
import { answersItself, capitalsNeedTyping } from '../games/quiz';
import { eligible, levelOf, type World } from '../lib/data';
import { deckFor } from '../lib/decks';
import { L } from '../lib/i18n';
import { MODE_NAME, PATHS } from '../lib/modes';
import { goneFrom } from '../lib/review';
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

function Session({ cfg, world }: { cfg: GameConfig; world: World }) {
  const start = useStore((s) => s.start);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<[number, number] | null>(null);
  const [attempt, setAttempt] = useState(0);
  const onExit = () => go(cfg.review ? '' : PATHS[cfg.section]);
  // Starting again drops the limit to some pieces unless the game asks to keep it.
  const onAgain: GameProps['onAgain'] = (patch) => start({ ...cfg, only: undefined, list: undefined, listId: undefined, ...patch });

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

  // A review can be about things the data no longer has. They cannot come up again, so what was known
  // about them is dropped, or they would be due for ever.
  const gone = useMemo(() => {
    if (!deck || !cfg.review || !cfg.only) return [];
    const levelIn = (id: string) => {
      const country = world.byId.get(id);
      return country ? levelOf(country, cfg.levels).k : undefined;
    };
    return goneFrom(cfg.only, (id) => deck.byId.has(id), useStore.getState().where, cfg.section, levelIn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck]);
  useEffect(() => {
    if (gone.length) useStore.getState().drop(gone);
  }, [gone]);
  // The same for capitals the data no longer vouches for (those of divisions that have been abolished).
  const capless = useMemo(() => {
    if (!deck || !cfg.review || cfg.mode !== 'capital' || !cfg.only) return [];
    return cfg.only.filter((id) => deck.byId.has(id) && !deck.byId.get(id)!.capital?.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck]);
  useEffect(() => {
    if (capless.length) useStore.getState().forget('cap', capless);
  }, [capless]);

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
  if (cfg.review && cfg.only?.length && gone.length + capless.length === cfg.only.length) {
    return (
      <Message
        title={L('Este repaso ya no hace falta', 'This review is no longer needed')}
        text={L(
          'Lo que tocaba repasar aquí ya no está en el juego: se han corregido los datos de origen (lugares que figuraban en el país de al lado o que no eran lo que decían, capitales de divisiones que ya no existen). Lo hemos quitado de tu repaso.',
          'What was due here is no longer in the game: the source data has been corrected (places filed under the country next door or that were not what they said, capitals of divisions that no longer exist). It has been taken off your review.',
        )}
        onExit={onExit}
      />
    );
  }
  if (cfg.mode === 'edit') return <ListEditor deck={deck} cfg={cfg} onExit={onExit} onAgain={onAgain} />;
  if (deck.items.length < 2 && cfg.mode !== 'explore') {
    return <Message title={L('Este mapa tiene una sola pieza', 'This map has a single piece')} text={L('Elige más países o un nivel con más divisiones para poder jugar.', 'Choose more countries or a level with more divisions to play.')} onExit={onExit} />;
  }
  if (cfg.mode === 'capital' && !deck.items.some((it) => it.capital?.length)) {
    return <Message title={L('No tenemos esas capitales', 'We do not have those capitals')} text={L('Los datos no traen la capital de estas regiones. Prueba con otro país o con otro nivel.', 'The data has no capital for these regions. Try another country or another level.')} onExit={onExit} />;
  }
  // A place named after its capital answers itself: where every one is, there is nothing left to ask.
  // With too few capitals that have to be known, the game asks them typed (see QuizGame).
  const picks = cfg.opts.answer !== 'type' && !cfg.review && !capitalsNeedTyping(deck.items);
  if (cfg.mode === 'capital' && !cfg.challenge?.legacy && !deck.items.some((it) => it.capital?.length && !answersItself(it, picks))) {
    return (
      <Message
        title={L('Aquí no hay nada que preguntar', 'There is nothing to ask here')}
        text={L(
          `En este mapa cada capital se llama como su ${deck.noun.one}, así que la pregunta se contestaría sola. Prueba con otro país o con otro nivel.`,
          `On this map every capital is named after its ${deck.noun.one}, so the question would answer itself. Try another country or another level.`,
        )}
        onExit={onExit}
      />
    );
  }
  if (cfg.mode === 'regionle' && deck.items.filter((it) => it.shape === 'area').length < 2) {
    return <Message title={L('Este mapa no tiene siluetas', 'This map has no outlines')} text={L('Regionle necesita un mapa de regiones o de países.', 'Regionle needs a map of regions or countries.')} onExit={onExit} />;
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
    case 'learn':
      return <LearnGame {...props} />;
    case 'regionle':
      return <RegionleGame {...props} />;
    case 'blind':
      return <BlindGame {...props} />;
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
