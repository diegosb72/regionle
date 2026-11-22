/** Runs the game stored in the configuration: builds the deck and hands it to the right game. */
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { HelpPanel } from '../components/Help';
import { lazyScreen } from '../components/lazy';
import { Spinner } from '../components/ui';
import { CardsGame } from '../games/Cards';
import { ExploreGame } from '../games/Explore';
import { TopTenGame, TrueFalseGame } from '../games/FactGames';
import { LearnGame } from '../games/Learn';
import { ListEditor } from '../games/ListEditor';
import { NameAllGame } from '../games/NameAll';
import { NeighboursGame } from '../games/Neighbours';
import { FigGame } from '../games/PopGames';
import { PrintSheet } from '../games/PrintSheet';
import { QuizGame } from '../games/QuizGame';
import { RegionleGame } from '../games/Regionle';
import { TravelGame } from '../games/Travel';
import { GameShell, HelpContext, type GameProps } from '../games/common';
import { answersItself, belongsItself, capitalsNeedTyping } from '../games/quiz';
import { countryAnswers, countryItem, eligible, levelOf, type World } from '../lib/data';
import { editionNow } from '../lib/dated';
import { deckFor } from '../lib/decks';
import { TOP_MIN, countryFigs, deckFigs, figPlayable, metricsIn, positionFigs, type Fig } from '../lib/figures';
import { L } from '../lib/i18n';
import { MODE_NAME, PATHS } from '../lib/modes';
import { pauseClock } from '../lib/pause';
import { goneFrom } from '../lib/review';
import { CONNECT_MIN, FIGURE_MODES, ODD_MIN, PAIRS_MIN } from '../lib/rules';
import { rulesOfGame, rulesText } from '../lib/ruleset';
import { go } from '../lib/router';
import { isDated, useStore, type GameConfig } from '../lib/store';
import { nf, today } from '../lib/text';
import type { Deck, Mode } from '../lib/types';

/**
 * Games that come in a file of their own, fetched when one of them is played: with every game in it, the
 * file of this screen grew past what a screen is allowed to weigh (`scripts/budget.mjs`).
 */
const BlindGame = lazyScreen(() => import('../games/Blind').then((m) => m.BlindGame));
const BearingGame = lazyScreen(() => import('../games/Bearings').then((m) => m.BearingGame));
const CoordsGame = lazyScreen(() => import('../games/Coords').then((m) => m.CoordsGame));
const ChainGame = lazyScreen(() => import('../games/Chain').then((m) => m.ChainGame));
const BorderGame = lazyScreen(() => import('../games/Borders').then((m) => m.BorderGame));
const GroupGame = lazyScreen(() => import('../games/Groups').then((m) => m.GroupGame));
const WhoAmIGame = lazyScreen(() => import('../games/WhoAmI').then((m) => m.WhoAmIGame));
const OddOneGame = lazyScreen(() => import('../games/OddOne').then((m) => m.OddOneGame));
const PairsGame = lazyScreen(() => import('../games/Pairs').then((m) => m.PairsGame));
const AlphabetGame = lazyScreen(() => import('../games/Alphabet').then((m) => m.AlphabetGame));
const ConnectGame = lazyScreen(() => import('../games/Connect').then((m) => m.ConnectGame));
const BingoGame = lazyScreen(() => import('../games/Bingo').then((m) => m.BingoGame));
const HangmanGame = lazyScreen(() => import('../games/Hangman').then((m) => m.HangmanGame));
const WordSearchGame = lazyScreen(() => import('../games/WordSearch').then((m) => m.WordSearchGame));
/** Which of them each mode needs: asked for while the map is being drawn, so that it is here when the map is. */
const APART: Partial<Record<Mode, { warm(): void }>> = { blind: BlindGame, hotcold: BlindGame, bearing: BearingGame, coords: CoordsGame, chain: ChainGame, border: BorderGame, group: GroupGame, whoami: WhoAmIGame, oddone: OddOneGame, pairs: PairsGame, alphabet: AlphabetGame, connect: ConnectGame, bingo: BingoGame, hangman: HangmanGame, wordsearch: WordSearchGame };

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

/** What is opened without being told how it goes: there is nothing in them to get wrong. */
const QUIET: readonly Mode[] = ['explore', 'print', 'bingo'];

/**
 * A game with «Cómo se juega» at hand: its frame gets the button, and the first time a player opens that
 * game the rules are shown before the first question. While they are read, the clock of the game is stopped.
 */
function WithHelp({ cfg, children }: { cfg: GameConfig; children: ReactNode }) {
  const [help, setHelp] = useState<'first' | 'asked' | null>(() => {
    const s = useStore.getState();
    // A review is of what has been played; and a game that is in the latest ones has been played too.
    const fresh = s.helpAuto && !cfg.review && !QUIET.includes(cfg.mode) && !s.helpSeen.includes(cfg.mode) && !s.sessions.some((r) => r.mode === cfg.mode);
    return fresh ? 'first' : null;
  });
  // Once shown it is not shown again by itself, whether it is read or closed at once.
  useEffect(() => {
    if (help === 'first') useStore.getState().seeHelp(cfg.mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Before the game below has done anything of its own: it must find its clock stopped, and say nothing aloud.
  useLayoutEffect(() => {
    if (help) return pauseClock();
  }, [help]);
  const show = useCallback(() => setHelp('asked'), []);
  return (
    <HelpContext.Provider value={show}>
      {children}
      {help && <HelpPanel mode={cfg.mode} section={cfg.section} first={help === 'first'} playing rules={rulesText(rulesOfGame(cfg)) || undefined} onClose={() => setHelp(null)} />}
    </HelpContext.Provider>
  );
}

/** Whoever shows a game somewhere other than the screen of the games: where leaving it goes, and how it is started again. */
export interface SessionHost {
  onExit(): void;
  onAgain(next: Omit<GameConfig, 'nonce'>): void;
}

export function Session({ cfg, world, host }: { cfg: GameConfig; world: World; host?: SessionHost }) {
  const start = useStore((s) => s.start);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<[number, number] | null>(null);
  const [attempt, setAttempt] = useState(0);
  // A review and a challenge with a date are started from the first page, and that is where leaving them goes.
  const onExit = host ? host.onExit : () => go(cfg.review || isDated(cfg) ? '' : PATHS[cfg.section]);
  // Starting again drops the limit to some pieces unless the game asks to keep it.
  const onAgain: GameProps['onAgain'] = (patch) => {
    const next = { ...cfg, only: undefined, list: undefined, listId: undefined, ...patch };
    if (host) host.onAgain(next);
    else start(next);
  };
  // Shown by a host, this is not the player's game in course: the store is told which game is on screen, for
  // what is drawn inside it and for what it writes down (the result as a picture, the maps played lately).
  const hosted = host != null;
  useLayoutEffect(() => {
    if (!hosted) return undefined;
    useStore.setState({ hosted: cfg });
    return () => {
      useStore.setState({ hosted: null });
    };
  }, [cfg, hosted]);

  useEffect(() => {
    APART[cfg.mode]?.warm();
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

  /** The countries the games without a map are played with. */
  const chosen = useMemo(() => (cfg.section === 'pops' ? cfg.countries.map((id) => world.byId.get(id)).filter((c) => c != null && eligible('pops', c)).map((c) => c!) : []), [cfg, world]);
  const statementWorld = useMemo(() => ({ byId: world.byId, continents: world.index.continents, subregions: world.index.subregions }), [world]);
  /** The games of figures are played with the figure of each thing, or with where it lies. */
  const figured = FIGURE_MODES.includes(cfg.mode) || cfg.mode === 'compass';
  const figs = useMemo((): Fig[] | null => {
    if (!figured) return null;
    if (cfg.section === 'pops') return countryFigs(chosen, cfg.opts.metric, countryItem, countryAnswers);
    if (!deck) return null;
    const all = cfg.mode === 'compass' ? positionFigs(deck, cfg.opts.axis === 'we' ? 'lon' : 'lat') : deckFigs(deck);
    // A custom list is asked about its pieces alone.
    const only = cfg.only ? new Set(cfg.only) : null;
    return only ? all.filter((f) => only.has(f.id)) : all;
  }, [figured, cfg, chosen, deck]);

  if (cfg.section === 'pops') {
    const what = `${nf(chosen.length)} ${L('países', 'countries')}`;
    if (cfg.mode === 'truefalse') {
      if (chosen.length < 2) return <Message title={L('Faltan países', 'Not enough countries')} text={L('Este juego necesita al menos dos países.', 'This game needs at least two countries.')} onExit={onExit} />;
      return (
        <WithHelp cfg={cfg}>
          <TrueFalseGame countries={chosen} world={statementWorld} cfg={cfg} onExit={onExit} />
        </WithHelp>
      );
    }
    if (cfg.mode === 'oddone') {
      if (chosen.length < ODD_MIN) return <Message title={L('Faltan países', 'Not enough countries')} text={L(`Este juego necesita al menos ${ODD_MIN} países.`, `This game needs at least ${ODD_MIN} countries.`)} onExit={onExit} />;
      return (
        <WithHelp cfg={cfg}>
          <Suspense fallback={<Spinner />}>
            <OddOneGame countries={chosen} world={statementWorld} cfg={cfg} onExit={onExit} />
          </Suspense>
        </WithHelp>
      );
    }
    if (cfg.mode === 'pairs') {
      const of = cfg.opts.pairOf === 'capital' ? 'capital' : 'flag';
      // What `pairable` (lib/pairs.ts) lets through, said here so that this screen does not carry the game.
      if (chosen.filter((c) => (of === 'capital' ? !!c.cap : !!c.fl)).length < PAIRS_MIN) {
        return (
          <Message
            title={L('Faltan países', 'Not enough countries')}
            text={of === 'capital' ? L(`Este juego necesita al menos ${PAIRS_MIN} países con capital.`, `This game needs at least ${PAIRS_MIN} countries with a capital.`) : L(`Este juego necesita al menos ${PAIRS_MIN} países.`, `This game needs at least ${PAIRS_MIN} countries.`)}
            onExit={onExit}
          />
        );
      }
      return (
        <WithHelp cfg={cfg}>
          <Suspense fallback={<Spinner />}>
            <PairsGame countries={chosen} cfg={cfg} onExit={onExit} />
          </Suspense>
        </WithHelp>
      );
    }
    if (cfg.mode === 'alphabet') {
      if (chosen.length < 2) return <Message title={L('Faltan países', 'Not enough countries')} text={L('Este juego necesita al menos dos países.', 'This game needs at least two countries.')} onExit={onExit} />;
      return (
        <WithHelp cfg={cfg}>
          <Suspense fallback={<Spinner />}>
            <AlphabetGame countries={chosen} world={statementWorld} cfg={cfg} onExit={onExit} />
          </Suspense>
        </WithHelp>
      );
    }
    if (cfg.mode === 'connect') {
      if (chosen.length < CONNECT_MIN) return <Message title={L('Faltan países', 'Not enough countries')} text={L(`Este juego necesita al menos ${CONNECT_MIN} países.`, `This game needs at least ${CONNECT_MIN} countries.`)} onExit={onExit} />;
      return (
        <WithHelp cfg={cfg}>
          <Suspense fallback={<Spinner />}>
            <ConnectGame countries={chosen} world={statementWorld} cfg={cfg} onExit={onExit} />
          </Suspense>
        </WithHelp>
      );
    }
    if (cfg.mode === 'topten') {
      if (!figs || figs.length < TOP_MIN) {
        return <Message title={L('Faltan países', 'Not enough countries')} text={L(`Para preguntar por los primeros hacen falta al menos ${TOP_MIN} países con datos.`, `Asking for the top ones takes at least ${TOP_MIN} countries with data.`)} onExit={onExit} />;
      }
      return (
        <WithHelp cfg={cfg}>
          <TopTenGame figs={figs} what={what} cfg={cfg} onExit={onExit} onAgain={onAgain} />
        </WithHelp>
      );
    }
    if (!figs || !figPlayable(figs)) return <Message title={L('Faltan países', 'Not enough countries')} text={L('Este juego necesita al menos dos países con datos.', 'This game needs at least two countries with data.')} onExit={onExit} />;
    return (
      <WithHelp cfg={cfg}>
        <FigGame figs={figs} cfg={cfg} what={`${nf(figs.length)} ${L('países', 'countries')}`} onExit={onExit} onAgain={onAgain} />
      </WithHelp>
    );
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
  // A sheet can be printed of any map, also of one with a single piece.
  if (cfg.mode === 'print') {
    return (
      <WithHelp cfg={cfg}>
        <PrintSheet deck={deck} cfg={cfg} onExit={onExit} onAgain={onAgain} />
      </WithHelp>
    );
  }
  // A bingo says for itself how many pieces it needs: which ones take part depends on how they are called.
  if (cfg.mode === 'bingo') {
    return (
      <WithHelp cfg={cfg}>
        <Suspense fallback={<Spinner />}>
          <BingoGame deck={deck} cfg={cfg} onExit={onExit} onAgain={onAgain} />
        </Suspense>
      </WithHelp>
    );
  }
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
  if (cfg.mode === 'parent' && (new Set(deck.items.map((it) => it.belongs?.id).filter(Boolean)).size < 2 || !deck.items.some((it) => it.belongs && !belongsItself(it, cfg.opts.answer !== 'type')))) {
    return (
      <Message
        title={L('Aquí todo pertenece a lo mismo', 'Everything here belongs to the same thing')}
        text={
          cfg.section === 'cities'
            ? L('Elige varios países, o uno solo que tenga regiones en el juego.', 'Choose several countries, or a single one that has regions in the game.')
            : L('Este juego pregunta a qué grupo pertenece cada pieza: elige un país que se juegue a varios niveles (España, Francia, Italia…) y ponlo en el más fino, el de provincias o departamentos.', 'This game asks which group each piece is in: choose a country played at several levels (Spain, France, Italy…) and set it to the finest one, that of provinces or departments.')
        }
        onExit={onExit}
      />
    );
  }
  if (cfg.mode === 'regionle' && deck.items.filter((it) => it.shape === 'area').length < 2) {
    return <Message title={L('Este mapa no tiene siluetas', 'This map has no outlines')} text={L('Regionle necesita un mapa de regiones o de países.', 'Regionle needs a map of regions or countries.')} onExit={onExit} />;
  }

  if (figured) {
    if (!figs || !figPlayable(figs)) {
      return (
        <Message
          title={L('Aquí no hay cifras que comparar', 'There are no figures to compare here')}
          text={
            cfg.section === 'physical'
              ? L('Los ríos, las cordilleras y los desiertos no tienen cifra en los datos. Elige picos (altitud) o lagos, islas y mares (superficie), y al menos dos de lo mismo.', 'Rivers, ranges and deserts have no figure in the data. Choose peaks (height) or lakes, islands and seas (area), and at least two of a kind.')
              : L('Este mapa necesita al menos dos piezas con datos.', 'This map needs at least two pieces with data.')
          }
          onExit={onExit}
        />
      );
    }
    if (cfg.mode === 'topten') {
      // One figure at a time: on a map of peaks and lakes, the one it has most things of.
      const main = metricsIn(figs)[0];
      const list = figs.filter((f) => f.metric === main);
      if (list.length < TOP_MIN) {
        return <Message title={L('Faltan piezas', 'Not enough pieces')} text={L(`Para preguntar por los primeros hacen falta al menos ${TOP_MIN} cosas con la misma cifra.`, `Asking for the top ones takes at least ${TOP_MIN} things with the same figure.`)} onExit={onExit} />;
      }
      return (
        <WithHelp cfg={cfg}>
          <TopTenGame figs={list} what={deck.title} cfg={cfg} onExit={onExit} onAgain={onAgain} />
        </WithHelp>
      );
    }
    return (
      <WithHelp cfg={cfg}>
        <FigGame figs={figs} cfg={cfg} what={deck.title} deck={cfg.mode === 'compass' ? deck : undefined} onExit={onExit} onAgain={onAgain} />
      </WithHelp>
    );
  }

  const props: GameProps = { deck, cfg, onExit, onAgain };
  const game = (): ReactElement | null => {
    switch (cfg.mode) {
      case 'explore':
        return <ExploreGame {...props} />;
      case 'nameall':
        return <NameAllGame {...props} />;
      case 'travel':
        return <TravelGame {...props} />;
      case 'neighbours':
        return <NeighboursGame {...props} />;
      case 'chain':
        return <ChainGame {...props} />;
      case 'border':
        return <BorderGame {...props} />;
      case 'group':
        return <GroupGame {...props} places={world.index} />;
      case 'whoami':
        return <WhoAmIGame {...props} places={world.index} />;
      case 'learn':
        return <LearnGame {...props} />;
      case 'regionle':
        return <RegionleGame {...props} />;
      case 'blind':
      case 'hotcold':
        return <BlindGame {...props} />;
      case 'bearing':
        return <BearingGame {...props} />;
      case 'coords':
        return <CoordsGame {...props} />;
      case 'cards':
        return <CardsGame {...props} />;
      case 'hangman':
        return <HangmanGame {...props} />;
      case 'wordsearch':
        return <WordSearchGame {...props} />;
      case 'pin':
      case 'puzzle':
      case 'identify':
      case 'outline':
      case 'capital':
      case 'flag':
      case 'parent':
      case 'mix':
      case 'listen':
        return <QuizGame {...props} places={world.index} />;
      default:
        return null;
    }
  };
  const playing = game();
  if (!playing) return <Message title={L(`«${MODE_NAME[cfg.mode]}» no está disponible aquí`, `“${MODE_NAME[cfg.mode]}” is not available here`)} text={L('Elige otro modo de juego.', 'Choose another game mode.')} onExit={onExit} />;
  // A game that comes in a file of its own may still be on its way: the map goes on being drawn until it is here.
  return (
    <WithHelp cfg={cfg}>
      <Suspense
        fallback={
          <div className="play play-loading">
            <Spinner label={L('Dibujando el mapa…', 'Drawing the map…')} />
          </div>
        }
      >
        {playing}
      </Suspense>
    </WithHelp>
  );
}

/**
 * A game of the player as it starts. A challenge with a date that is started once its day or its week has
 * passed is put aside for the one of now (`editionNow`), before anything of it is drawn. It is looked at
 * once, as the game starts: one that is being played when midnight comes is still the game that was started.
 */
function Started({ cfg, world }: { cfg: GameConfig; world: World }) {
  const start = useStore((s) => s.start);
  const [now] = useState(() => editionNow(cfg, world.index, today()));
  useLayoutEffect(() => {
    if (now) start(now);
  }, [now, start]);
  return now ? null : <Session cfg={cfg} world={world} />;
}

export function Play({ world }: { world: World }) {
  const cfg = useStore((s) => s.game);
  if (!cfg) return <Message title={L('No hay ninguna partida en marcha', 'There is no game in progress')} text={L('Elige países y un modo de juego para empezar.', 'Choose countries and a game mode to start.')} onExit={() => go('')} />;
  return <Started key={cfg.nonce} cfg={cfg} world={world} />;
}
