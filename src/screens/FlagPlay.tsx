/**
 * A game of the section «Banderas», at `#/banderas/jugar/<game>/<flags>/<how many>[/escrita]`
 * (lib/flagGames.ts, `flagPlayOf`): the address says the whole game, so that it can be kept and sent. This
 * screen fetches what the game needs — the list of flags, the pictures that are the same as another and,
 * for the games that ask for it, which flags look alike or what is written of the flags of other times —
 * and runs it (games/FlagQuiz.tsx; «Parejas», games/FlagPairs.tsx).
 */
import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { HelpPanel } from '../components/Help';
import { Spinner } from '../components/ui';
import { FlagQuiz } from '../games/FlagQuiz';
import { HelpContext } from '../games/common';
import { groupAt, loadAlike, nearCards, type AlikeFile, type AlikeKind, type Near } from '../lib/flagAlike';
import { flagGameDef, flagGameHelp, flagGamesPath, flagPlayOf, flagPlayText, questionCount, type FlagExtra, type FlagPlay as Game } from '../lib/flagGames';
import { oddPool } from '../lib/flagOdd';
import { PAST_MIN, loadPast, pastCards, pastPlace, type PastFile } from '../lib/flagPast';
import { FLAG_SET_MIN, alikePlace, deckOf, flagSetName, galleryPage, loadSame, sameMap, type FlagSet } from '../lib/flagSets';
import { flagsRest, loadFlags, type FlagsFile } from '../lib/flags';
import { L } from '../lib/i18n';
import { pauseClock } from '../lib/pause';
import { go } from '../lib/router';
import { FLAGS_PATH } from '../lib/routes';
import { useStore } from '../lib/store';
import type { FlagGame } from '../lib/types';
import type { World } from '../lib/world';

/** How the game is played, shown by itself the first time it is opened and whenever it is asked for (as screens/Play.tsx does for the games with a map). */
function WithHelp({ game, children }: { game: FlagGame; children: ReactNode }) {
  const [help, setHelp] = useState<'first' | 'asked' | null>(() => {
    const s = useStore.getState();
    return s.helpAuto && !s.helpSeen.includes(game) && !s.sessions.some((r) => r.mode === game) ? 'first' : null;
  });
  // Once shown it is not shown again by itself, whether it is read or closed at once.
  useEffect(() => {
    if (help === 'first') useStore.getState().seeHelp(game);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Before the game below has done anything of its own: it must find its clock stopped.
  useLayoutEffect(() => {
    if (help) return pauseClock();
  }, [help]);
  const show = useCallback(() => setHelp('asked'), []);
  const def = flagGameDef(game);
  return (
    <HelpContext.Provider value={show}>
      {children}
      {help && <HelpPanel own={{ name: def.name, desc: def.desc, icon: def.icon, help: flagGameHelp(game) }} first={help === 'first'} playing onClose={() => setHelp(null)} />}
    </HelpContext.Provider>
  );
}

/** Something that keeps the game from being played, with the way back to where the games are chosen. */
function Message({ title, text, retry }: { title: string; text: string; retry?: () => void }) {
  return (
    <div className="empty-state" role="alert">
      <h1>{title}</h1>
      <p>{text}</p>
      <p className="q-actions center">
        {retry && (
          <button type="button" className="btn btn-primary" onClick={retry}>
            {L('Reintentar', 'Retry')}
          </button>
        )}
        <button type="button" className={retry ? 'btn' : 'btn btn-primary'} onClick={() => go(flagGamesPath())}>
          {L('Elegir otro juego de banderas', 'Choose another game of flags')}
        </button>
      </p>
    </div>
  );
}

/** «Parejas» is another game altogether, with a table of its own: it comes when it is played. */
const FlagPairs = lazy(() => import('../games/FlagPairs').then((m) => ({ default: m.FlagPairs })));

interface Loaded {
  file: FlagsFile;
  same: ReadonlyMap<string, string>;
  /** Which flags look alike: what «Casi iguales» is made of, and what «El intruso» takes its flag from outside by where it comes. */
  alike: AlikeFile | null;
  /** What is written of the flags of other times: «Antes y ahora». */
  past: PastFile | null;
}

/**
 * The file of look-alikes a game reads, if it reads one. «Casi iguales» cannot be played without that of
 * its flags; «El intruso» can, and with the countries it is better with theirs.
 */
function alikeFor(play: Game): { kind: AlikeKind; needed: boolean } | null {
  if (play.game === 'flag-alike') return { kind: alikePlace(play.set).file, needed: true };
  if (play.game === 'flag-odd' && (play.set.kind === 'countries' || play.set.kind === 'territories')) return { kind: 'countries', needed: false };
  return null;
}

export function FlagPlay({ world, rest }: { world: World; rest: string }) {
  // What follows `jugar/` in the address.
  const text = rest.split('/').slice(1).join('/');
  const play = useMemo<Game | null>(() => flagPlayOf(text), [text]);
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!play) return;
    let alive = true;
    setFailed(null);
    setData(null);
    const alike = alikeFor(play);
    // Without the list of pictures that are the same the game still works: two of them may then share a question.
    Promise.all([
      loadFlags(),
      loadSame().catch(() => null),
      alike ? (alike.needed ? loadAlike(alike.kind) : loadAlike(alike.kind).catch(() => null)) : null,
      // Without what is written of them, a country that flew the flag too could be set beside it: the game waits for it.
      play.game === 'flag-past' && pastPlace(play.set) ? loadPast() : null,
    ]).then(
      ([file, same, alikeFile, past]) => alive && setData({ file, same: sameMap(same), alike: alikeFile, past }),
      (err: unknown) => alive && setFailed(err instanceof Error ? err.message : String(err)),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, attempt]);

  // A game that is opened is the one the section opens with the next time, wherever its link came from.
  const canonical = play ? flagPlayText(play) : '';
  useEffect(() => {
    if (canonical) useStore.getState().setFlagLast(canonical);
  }, [canonical]);

  const deck = useMemo(() => (play && data ? deckOf(play.set, world.index, data.file, data.same) : []), [play, data, world]);
  const near = useMemo<ReadonlyMap<string, readonly Near[]>>(() => {
    if (!play || !data?.alike) return new Map();
    if (play.game !== 'flag-odd') return nearCards(groupAt(data.alike, alikePlace(play.set)), deck);
    // «El intruso» with countries: the flag from outside is of another continent, so the look-alikes are those of all the States.
    const whole: FlagSet = play.set.kind === 'territories' ? play.set : { kind: 'countries' };
    return nearCards(groupAt(data.alike, alikePlace(whole)), play.set.kind === 'countries' && play.set.continent ? deckOf(whole, world.index, data.file, data.same) : deck);
  }, [play, data, deck, world]);
  const extra = useMemo<FlagExtra>(() => {
    if (!play || !data) return {};
    if (play.game === 'flag-past') {
      const place = pastPlace(play.set);
      return place ? { past: { cards: pastCards(deck, data.file), data: data.past, place } } : {};
    }
    if (play.game === 'flag-odd') return { odd: oddPool(play.set, deck, world.index, data.file, data.same) };
    return {};
  }, [play, data, deck, world]);

  if (!play) return <Message title={L('Ese juego no existe', 'There is no such game')} text={L('La dirección no es la de ningún juego de banderas, o las banderas que nombra no están.', 'The address is that of no game of flags, or the flags it names are not there.')} />;
  if (failed) return <Message title={L('No se han podido cargar las banderas', 'The flags could not be loaded')} text={failed} retry={() => setAttempt((n) => n + 1)} />;
  if (!data) return <Spinner label={L('Cargando las banderas…', 'Loading the flags…')} />;
  if (deck.length < FLAG_SET_MIN) {
    return <Message title={L('Faltan banderas', 'Not enough flags')} text={L(`Este juego necesita al menos ${FLAG_SET_MIN} banderas distintas, y de esas hay ${deck.length}.`, `This game needs at least ${FLAG_SET_MIN} different flags, and there are ${deck.length} of those.`)} />;
  }
  if (play.game === 'flag-past' && !extra.past) {
    return <Message title={L('Este juego es de países', 'This game is of countries')} text={L('«Antes y ahora» pregunta por las banderas que los países tuvieron antes: se juega con los países del mundo, con los de un continente o con los territorios.', '“Then and now” asks about the flags the countries flew before: it is played with the countries of the world, with those of a continent or with the territories.')} />;
  }
  if (play.game === 'flag-past' && (extra.past?.cards.size ?? 0) < PAST_MIN) {
    return <Message title={L('Pocas banderas de otros tiempos', 'Few flags of other times')} text={L('De estos países, casi ninguno ha tenido otra bandera que se conozca: elige otros, u otro juego.', 'Of these countries, hardly any has flown another flag that is known: choose others, or another game.')} />;
  }
  if (questionCount(play, deck, near, extra) === 0) {
    if (play.game === 'flag-alike') {
      return <Message title={L('Estas banderas se parecen poco', 'These flags are not much alike')} text={L('«Casi iguales» necesita banderas que se puedan confundir, y entre estas no las hay: elige otras, u otro juego.', '“Look-alikes” needs flags that can be mixed up, and there are none among these: choose others, or another game.')} />;
    }
    return <Message title={L('Faltan banderas', 'Not enough flags')} text={L('Con estas banderas no hay bastante para este juego: elige otras, u otro juego.', 'There is not enough for this game with these flags: choose others, or another game.')} />;
  }
  const name = flagSetName(play.set, world.index);
  const onExit = () => go(flagGamesPath());
  const onSee = () => go(`${FLAGS_PATH}/${flagsRest(galleryPage(play.set))}`);
  return (
    <WithHelp game={play.game}>
      {play.game === 'flag-pairs' ? (
        <Suspense fallback={<Spinner label={L('Cargando…', 'Loading…')} />}>
          <FlagPairs play={play} deck={deck} name={name} world={world} onExit={onExit} onSee={onSee} />
        </Suspense>
      ) : (
        <FlagQuiz play={play} deck={deck} near={near} extra={extra} name={name} world={world} onExit={onExit} onSee={onSee} />
      )}
    </WithHelp>
  );
}
