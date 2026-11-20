/**
 * Connections: sixteen countries on the table that go four by four, and what each four have in common is
 * not said. A game with no map, in a file of its own that is fetched when it is played. The boards and
 * what a guess is are in lib/connect.ts.
 */
import { Check, Flag as FlagIcon, Lightbulb, Shuffle } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { Flag } from '../components/ui';
import { CONNECT_MISSES, GROUP_SIZE, gameOver, gameTally, guessFour, makeBoard, newGame, tellLink, type ConnGame, type LinkWorld, type Said } from '../lib/connect';
import { countryItem } from '../lib/data';
import { L, getLang, nm } from '../lib/i18n';
import { modeNameIn } from '../lib/modes';
import { softened } from '../lib/pairs';
import { useStore, type GameConfig } from '../lib/store';
import { cx, listed, nf, shuffle } from '../lib/text';
import type { Country } from '../lib/types';
import { GameShell, Hud, Results, answered, useElapsed, type ResultRow } from './common';
import { guessWidth, useWidest } from './useWidest';
import './connect.css';

/** The last group, or the last wrong guess, is left in sight this long before the result takes its place. */
const END_MS = 1100;

/** What the line under the table says: what the last guess was, or which group has just been told. */
type Line = Said | { res: 'told'; index: number } | null;

const start = (countries: readonly Country[], world: LinkWorld): ConnGame | null => {
  const board = makeBoard(countries, world);
  return board ? newGame(board) : null;
};

export function ConnectGame({ countries, world, cfg, onExit }: { countries: Country[]; world: LinkWorld; cfg: GameConfig; onExit(): void }) {
  const title = modeNameIn(cfg.section, 'connect');
  const what = `${nf(countries.length)} ${L('países', 'countries')}`;
  const byId = useMemo(() => new Map(countries.map((c) => [c.id, c])), [countries]);
  const [game, setGame] = useState<ConnGame | null>(() => start(countries, world));
  const [picked, setPicked] = useState<string[]>([]);
  const [line, setLine] = useState<Line>(null);
  const [ended, setEnded] = useState(false);
  const addSession = useStore((s) => s.addSession);
  const ms = useElapsed(!ended && !!game);
  const over = !!game && gameOver(game);
  const name = (id: string): string => {
    const c = byId.get(id);
    return c ? nm(c.n) : id;
  };
  /**
   * "Bolivia, Chile y Perú": the countries of a group, in the order of the alphabet. Where what they share is not
   * in sight, each with what makes it one of the group: "Alemania (Berlín), Hungría (Budapest)…".
   */
  const names = (ids: readonly string[], why?: ReadonlyMap<string, string>): string =>
    listed(
      [...ids].sort((a, b) => name(a).localeCompare(name(b), getLang())).map((id) => (why?.get(id) ? `${name(id)} (${why.get(id)})` : name(id))),
      L('y', 'and'),
    );

  const finish = () => {
    if (game) {
      const { ok, warn, bad } = gameTally(game);
      if (ok + warn + bad > 0) addSession({ t: Date.now(), section: cfg.section, mode: cfg.mode, label: what, total: ok + warn + bad, ok, warn, bad, ms });
    }
    setEnded(true);
  };

  // The last group found, or the last guess that could go wrong, is seen before the result comes.
  useEffect(() => {
    if (!over || ended) return;
    const t = setTimeout(finish, END_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over, ended]);

  const toggle = (id: string) => {
    if (!game || over) return;
    setPicked((now) => (now.includes(id) ? now.filter((x) => x !== id) : now.length < GROUP_SIZE ? [...now, id] : now));
  };

  const check = () => {
    if (!game || over || picked.length !== GROUP_SIZE) return;
    const next = guessFour(game, picked);
    setGame(next.game);
    setLine(next.said);
    if (next.said.res === 'group') {
      setPicked([]);
      answered('ok');
    } else if (next.said.res === 'near' || next.said.res === 'no') answered(gameOver(next.game) ? 'bad' : 'try');
  };

  const tell = () => {
    if (!game || over) return;
    const next = tellLink(game);
    if (next.index < 0) return;
    setGame(next.game);
    setLine({ res: 'told', index: next.index });
  };

  /** The arrows go from country to country, as they lie on the table. */
  const onKeys = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tiles = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('.conn-tile')];
    const at = tiles.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    const row = tiles.filter((t) => t.offsetTop === tiles[0].offsetTop).length;
    const to = e.key === 'ArrowLeft' ? at - 1 : e.key === 'ArrowRight' ? at + 1 : e.key === 'ArrowUp' ? at - row : e.key === 'ArrowDown' ? at + row : e.key === 'Home' ? 0 : e.key === 'End' ? tiles.length - 1 : -1;
    if (to < 0 || to >= tiles.length || to === at) return;
    e.preventDefault();
    tiles[to].focus();
  };

  /** The names on the table, each with a place to be cut in its longest words. */
  const texts = useMemo(() => (game ? game.board.tiles.map((id) => softened(name(id))) : []), [game?.board, byId]); // eslint-disable-line react-hooks/exhaustive-deps
  const table = useRef<HTMLDivElement>(null);
  const widths = useWidest(texts, table, 'conn-text conn-probe');

  /** The groups as they are shown once found, or at the end: what they have in common and who they are. */
  const groupList = (which: number[], all: boolean) =>
    game && (
      <ol className="conn-found" aria-label={all ? L('Los cuatro grupos', 'The four groups') : L('Grupos encontrados', 'Groups found')}>
        {which.map((i) => {
          const g = game.board.groups[i];
          const at = game.found.indexOf(i);
          return (
            <li key={g.link.id} className={cx('conn-group', at >= 0 ? `n${at}` : 'left')}>
              <b>{g.link.title}</b>
              <span>{names(g.ids, g.link.why)}</span>
              {all && <small>{at < 0 ? L('sin encontrar', 'not found') : game.res[i] === 'ok' ? L('a la primera', 'first time') : game.told.includes(i) ? L('con pista', 'with a hint') : L('tras un fallo', 'after a miss')}</small>}
            </li>
          );
        })}
      </ol>
    );

  if (ended || !game) {
    const tally = game ? gameTally(game) : { ok: 0, warn: 0, bad: 0 };
    const groups = game?.board.groups ?? [];
    const left = groups.map((_, i) => i).filter((i) => !game!.found.includes(i));
    const lost = !!game && game.misses >= CONNECT_MISSES;
    const rows: ResultRow[] = [];
    if (game) {
      // The countries of each group that counts: found, or missed with the last guess.
      for (const i of [...game.found, ...(lost ? left : [])]) {
        const g = groups[i];
        const res = !game.found.includes(i) ? 'bad' : game.res[i];
        for (const id of g.ids) {
          const c = byId.get(id);
          if (c) rows.push({ item: countryItem(c), res, note: g.link.why?.get(id) ? `${g.link.title}: ${g.link.why.get(id)}` : g.link.title });
        }
      }
    }
    return (
      <GameShell
        title={title}
        subtitle={what}
        onExit={onExit}
        hud={<Hud ms={ms} />}
        panel={
          <div className="pop">
            <Results
              title={
                !game
                  ? L('Sin tablero', 'No board')
                  : !left.length
                    ? tally.warn === 0
                      ? L('¡Los cuatro grupos, a la primera!', 'All four groups, first time!')
                      : L('¡Tablero resuelto!', 'Board solved!')
                    : lost
                      ? L('Sin más intentos', 'Out of guesses')
                      : L('Partida terminada', 'Game over')
              }
              rows={rows}
              counts={tally}
              ms={ms}
              stats={game ? [{ label: L('Intentos fallidos', 'Wrong guesses'), value: nf(game.misses) }] : undefined}
              note={
                !game
                  ? L('Con estos países no sale ningún tablero: elige más, o más variados.', 'These countries give no board: choose more of them, or a wider mix.')
                  : left.length && !lost
                    ? L(left.length === 1 ? 'Quedaba un grupo por encontrar.' : `Quedaban ${left.length} grupos por encontrar.`, left.length === 1 ? 'One group was left to find.' : `${left.length} groups were left to find.`)
                    : undefined
              }
              again={!!game}
              onAgain={() => {
                setGame(start(countries, world));
                setPicked([]);
                setLine(null);
                setEnded(false);
              }}
              onExit={onExit}
            >
              {game && (
                <section className="tf-review conn-all">
                  <h3>{L('Los grupos', 'The groups')}</h3>
                  {groupList([...game.found, ...left], true)}
                </section>
              )}
            </Results>
          </div>
        }
      />
    );
  }

  const guesses = CONNECT_MISSES - game.misses;
  const leftToGuess = guesses <= 0 ? L('Se acabaron los intentos.', 'No guesses left.') : L(guesses === 1 ? 'Te queda 1 intento.' : `Te quedan ${guesses} intentos.`, guesses === 1 ? 'You have 1 guess left.' : `You have ${guesses} guesses left.`);
  const said = !line
    ? L('Elige cuatro países que tengan algo en común y comprueba.', 'Pick four countries that have something in common, and check.')
    : line.res === 'group'
      ? L(`¡Grupo! ${game.board.groups[line.index].link.title}.`, `A group! ${game.board.groups[line.index].link.title}.`)
      : line.res === 'told'
        ? L(`Pista: uno de los grupos es «${game.board.groups[line.index].link.title}».`, `Hint: one of the groups is “${game.board.groups[line.index].link.title}”.`)
        : line.res === 'other'
          ? L(`Los cuatro tienen algo en común, «${line.title}», pero no es ninguno de los cuatro grupos. No cuenta como fallo.`, `The four have something in common, “${line.title}”, but it is none of the four groups. It is no miss.`)
          : line.res === 'again'
            ? L('Esos cuatro ya los habías probado.', 'You had already tried those four.')
            : line.res === 'near'
              ? L(`Casi: tres de los cuatro van juntos. ${leftToGuess}`, `Nearly: three of the four go together. ${leftToGuess}`)
              : L(`No son un grupo. ${leftToGuess}`, `Not a group. ${leftToGuess}`);
  const told = game.told.filter((i) => !game.found.includes(i));
  const canTell = !over && game.board.groups.some((_, i) => !game.found.includes(i) && !game.told.includes(i));
  const ready = picked.length === GROUP_SIZE && !over;

  return (
    <GameShell
      title={title}
      subtitle={what}
      onExit={onExit}
      progress={game.found.length / game.board.groups.length}
      hud={<Hud ms={ms} progress={`${game.found.length} / ${game.board.groups.length}`} />}
      panel={
        <div className="pop tf conn">
          <p className="kicker center">{L('Cuatro grupos de cuatro', 'Four groups of four')}</p>
          <div className="conn-wrap" ref={table}>
            {game.found.length > 0 && groupList(game.found, false)}
            {told.length > 0 && (
              <ul className="conn-told" aria-label={L('Pistas', 'Hints')}>
                {told.map((i) => (
                  <li key={i}>
                    <Lightbulb size={14} aria-hidden="true" />
                    <span>
                      {L('Uno de los grupos:', 'One of the groups:')} <b>{game.board.groups[i].link.title}</b>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="conn-board" role="group" aria-label={L('Los países', 'The countries')} onKeyDown={onKeys}>
              {game.tiles.map((id) => {
                const text = softened(name(id));
                const on = picked.includes(id);
                return (
                  <button key={id} type="button" className={cx('conn-tile', on && 'on')} aria-pressed={on} aria-disabled={(!on && picked.length >= GROUP_SIZE) || over || undefined} onClick={() => toggle(id)}>
                    <Flag code={byId.get(id)?.fl} size="sm" />
                    <span className="conn-name">
                      <span className="conn-text" style={{ '--w': widths.get(text) ?? guessWidth(text) } as CSSProperties}>
                        {text}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          {/* What was said of the last guess and the button that checks one stay in sight while the table is scrolled: on a phone it is taller than the screen. */}
          <div className="conn-foot">
            <p className={cx('q-note center conn-said', line?.res === 'group' && 'is-ok')} role="status">
              {said}
            </p>
            <div className="q-actions center conn-actions">
              <span className="conn-lives" role="img" aria-label={L(`Fallos: ${game.misses} de ${CONNECT_MISSES}`, `Misses: ${game.misses} of ${CONNECT_MISSES}`)}>
                {Array.from({ length: CONNECT_MISSES }, (_, i) => (
                  <i key={i} className={i < game.misses ? 'gone' : undefined} />
                ))}
              </span>
              <button type="button" className="btn btn-primary" aria-disabled={!ready || undefined} onClick={check}>
                <Check size={16} aria-hidden="true" />
                {L('Comprobar', 'Check')}
                <small className="conn-count">
                  {picked.length} / {GROUP_SIZE}
                </small>
              </button>
            </div>
          </div>
          <div className="q-actions center conn-more">
            <button type="button" className="btn btn-sm" onClick={() => setGame({ ...game, tiles: shuffle(game.tiles) })} disabled={over}>
              <Shuffle size={15} aria-hidden="true" />
              {L('Barajar', 'Shuffle')}
            </button>
            <button type="button" className="btn btn-sm" onClick={tell} disabled={!canTell}>
              <Lightbulb size={15} aria-hidden="true" />
              {L('Pista', 'Hint')}
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={finish} disabled={over}>
              <FlagIcon size={15} aria-hidden="true" />
              {L('Terminar', 'Finish')}
            </button>
          </div>
        </div>
      }
    />
  );
}
