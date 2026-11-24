/**
 * A game of the section «Banderas», at `#/banderas/jugar/<game>/<flags>/<how many>[/escrita]`
 * (lib/flagGames.ts, `flagPlayOf`): the address says the whole game, so that it can be kept and sent. This
 * screen fetches what the game needs — the list of flags, the pictures that are the same as another and,
 * for «Casi iguales», which flags look alike — and runs it (games/FlagQuiz.tsx).
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { HelpPanel } from '../components/Help';
import { Spinner } from '../components/ui';
import { FlagQuiz } from '../games/FlagQuiz';
import { HelpContext } from '../games/common';
import { groupAt, loadAlike, nearCards, type AlikeFile, type Near } from '../lib/flagAlike';
import { flagGameDef, flagGameHelp, flagGamesPath, flagPlayOf, flagPlayText, questionCount, type FlagPlay as Game } from '../lib/flagGames';
import { FLAG_SET_MIN, alikePlace, deckOf, flagSetName, galleryPage, loadSame, sameMap } from '../lib/flagSets';
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

interface Loaded {
  file: FlagsFile;
  same: ReadonlyMap<string, string>;
  alike: AlikeFile | null;
}

export function FlagPlay({ world, rest }: { world: World; rest: string }) {
  // What follows `jugar/` in the address.
  const text = rest.split('/').slice(1).join('/');
  const play = useMemo<Game | null>(() => flagPlayOf(text), [text]);
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const needsAlike = play?.game === 'flag-alike';
  const alikeKind = play ? alikePlace(play.set).file : null;

  useEffect(() => {
    if (!play || !alikeKind) return;
    let alive = true;
    setFailed(null);
    setData(null);
    // Without the list of pictures that are the same the game still works: two of them may then share a question.
    Promise.all([loadFlags(), loadSame().catch(() => null), needsAlike ? loadAlike(alikeKind) : null]).then(
      ([file, same, alike]) => alive && setData({ file, same: sameMap(same), alike }),
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
  const near = useMemo<ReadonlyMap<string, readonly Near[]>>(() => (play && data?.alike ? nearCards(groupAt(data.alike, alikePlace(play.set)), deck) : new Map()), [play, data, deck]);

  if (!play) return <Message title={L('Ese juego no existe', 'There is no such game')} text={L('La dirección no es la de ningún juego de banderas, o las banderas que nombra no están.', 'The address is that of no game of flags, or the flags it names are not there.')} />;
  if (failed) return <Message title={L('No se han podido cargar las banderas', 'The flags could not be loaded')} text={failed} retry={() => setAttempt((n) => n + 1)} />;
  if (!data) return <Spinner label={L('Cargando las banderas…', 'Loading the flags…')} />;
  if (deck.length < FLAG_SET_MIN) {
    return <Message title={L('Faltan banderas', 'Not enough flags')} text={L(`Este juego necesita al menos ${FLAG_SET_MIN} banderas distintas, y de esas hay ${deck.length}.`, `This game needs at least ${FLAG_SET_MIN} different flags, and there are ${deck.length} of those.`)} />;
  }
  if (questionCount(play, deck, near) === 0) {
    return <Message title={L('Estas banderas se parecen poco', 'These flags are not much alike')} text={L('«Casi iguales» necesita banderas que se puedan confundir, y entre estas no las hay: elige otras, u otro juego.', '“Look-alikes” needs flags that can be mixed up, and there are none among these: choose others, or another game.')} />;
  }
  return (
    <WithHelp game={play.game}>
      <FlagQuiz
        play={play}
        deck={deck}
        near={near}
        name={flagSetName(play.set, world.index)}
        world={world}
        onExit={() => go(flagGamesPath())}
        onSee={() => go(`${FLAGS_PATH}/${flagsRest(galleryPage(play.set))}`)}
      />
    </WithHelp>
  );
}
