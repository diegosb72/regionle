/**
 * «Contra tu fantasma»: the best game of a map is kept question by question (lib/ghost.ts), and the same
 * questions can be played again with that game moving alongside. Here, what the game of questions asks of
 * the ghosts — which one a game is played against, and what becomes of it when the game ends — and what is
 * drawn of them: the two lanes under the header of the game, the box of the results and the line of the setup.
 *
 * All of it comes in a file of its own (lib/ghostLazy.ts), fetched when a game is played against a ghost or
 * ends with one to tell of: neither the game nor the setup carries it.
 */
import { Ghost as GhostIcon } from 'lucide-react';
import { useMemo, type CSSProperties } from 'react';
import { ghostFrom, ghostKey, passed, runOf, sumOf, versus, type Ghost, type Run, type Trace } from '../lib/ghost';
import { ghostOf, keepGhost, useGhosts } from '../lib/ghostKept';
import { L, fmtDay, getLang } from '../lib/i18n';
import type { GameConfig } from '../lib/store';
import { cx, fmtTime, today } from '../lib/text';
import type { Country, Res } from '../lib/types';
import './ghost.css';

/** What the game of questions says of itself to be told about its ghost. */
export interface Race {
  cfg: Omit<GameConfig, 'nonce'>;
  /** A country of its map, by its code. */
  country(id: string): Country | undefined;
  /** The seed its questions were dealt with, and the questions any seed deals on its map: each a word, in order. */
  seed: number;
  dealt(seed: number): string[];
}

/** Whether a ghost is of the questions its seed deals on this map today: the map may have changed since it was kept. */
function current(ghost: Ghost, dealt: Race['dealt']): boolean {
  const now = dealt(ghost.k);
  return ghost.q.length === now.length && ghost.h === sumOf(now);
}

/**
 * The ghost a game is played against: the one kept for it, when the game was dealt its questions. Null when
 * there is none after all: none is kept any more, or the one that is kept is another, or the map no longer
 * deals to its seed the questions it answered.
 */
export function rivalOf({ cfg, country, seed, dealt }: Race): Ghost | null {
  const key = cfg.ghost ? ghostKey(cfg, country) : null;
  const kept = key ? ghostOf(key) : null;
  return kept && kept.k === seed && current(kept, dealt) ? kept : null;
}

/** How a game ended, as far as its ghost goes: what the results have to tell. */
export interface GhostEnd {
  /**
   * Against the ghost: 'won', 'lost' or 'tie', and 'left' when the game was not played to the end. Without
   * one: 'first' when the game is the first ghost of its map, 'better' when it takes the place of the one
   * there was, and 'kept' when that one stays.
   */
  how: 'won' | 'lost' | 'tie' | 'left' | 'first' | 'better' | 'kept';
  /** The game that has ended, when it was played to the end. */
  mine: Run | null;
  /** The ghost it is set beside — the one it was played against, or the one that was kept — and when that game was played. */
  other: Run | null;
  when: number;
  /** What the ghost of the map is now: this game ('mine'), the one it is set beside ('other') or neither. */
  now: 'mine' | 'other' | null;
  /** The seed of the ghost of the map as it stands: what a game against it is dealt with. */
  seed: number | null;
}

/** Whether what is kept is a ghost that was read before: read again, it is another object with the same figures. */
const same = (a: Ghost | null, b: Ghost | null): boolean => !!a && !!b && a.k === b.k && a.t === b.t && a.d === b.d;

/**
 * A game has ended: its ghost is kept if it is the best of its map so far, and what there is to say about it
 * comes back. `trace` is what the game wrote down, `ms` what its clock said at the end and `rival` the ghost
 * it was played against. Null when the game has no ghost and leaves none.
 */
export function settle(race: Race, trace: Trace, ms: number, rival: Ghost | null, now: number): GhostEnd | null {
  const { cfg, country, seed, dealt } = race;
  const key = ghostKey(cfg, country);
  if (!key) return null;
  const made = ghostFrom(seed, dealt(seed), trace, ms, now);
  const had = ghostOf(key);
  // A ghost of questions the map no longer deals can be played against no more: it goes, whatever this game was like.
  const stale = !!had && !current(had, dealt);
  const before = stale ? null : had;
  const kept = keepGhost(key, made, stale);
  const mine = made && runOf(made);
  const seedNow = kept?.k ?? null;
  if (rival) {
    const other = runOf(rival);
    // What is kept is this very game when it is the one that stays (`keepGhost`): told by the game itself and
    // not by its figures, which a tie may share with the ghost. Another tab may have kept another ghost
    // meanwhile: then the one of the map is neither of these two.
    const is = made && kept === made ? 'mine' : same(kept, rival) ? 'other' : null;
    return { how: mine ? (['lost', 'tie', 'won'] as const)[versus(mine, other) + 1] : 'left', mine, other, when: rival.t, now: is, seed: seedNow };
  }
  if (!before) return mine ? { how: 'first', mine, other: null, when: now, now: 'mine', seed: seedNow } : null;
  const other = runOf(before);
  const better = !!made && kept === made;
  return { how: better ? 'better' : 'kept', mine, other, when: before.t, now: better ? 'mine' : same(kept, before) ? 'other' : null, seed: seedNow };
}

/** Up to this many questions, each one is told from the next in a lane; past it they run together. */
const TICKS = 40;

/** A lane: how each question went, up to where the game has got; consecutive ones that went the same are one stretch. */
function Bar({ res, done, total }: { res: readonly Res[]; done: number; total: number }) {
  const parts: [string, number][] = [];
  for (let i = 0; i < done; i++) {
    const last = parts[parts.length - 1];
    if (last && last[0] === res[i]) last[1]++;
    else parts.push([res[i], 1]);
  }
  if (done < total) parts.push(['todo', total - done]);
  return (
    <span className={cx('ghost-bar', total <= TICKS && 'few')} style={{ '--n': total } as CSSProperties}>
      {parts.map(([kind, n], i) => (
        <i key={i} className={kind} style={{ flexGrow: n }} />
      ))}
    </span>
  );
}

function Lane({ ghost, res, done, total }: { ghost?: boolean; res: readonly Res[]; done: number; total: number }) {
  return (
    <div className={cx('ghost-lane', ghost && 'it')}>
      <span className="ghost-who">
        {ghost && <GhostIcon size={13} aria-hidden="true" />}
        {ghost ? L('Fantasma', 'Ghost') : L('Tú', 'You')}
      </span>
      <Bar res={res} done={done} total={total} />
      <span className="ghost-n">
        {done} / {total}
      </span>
    </div>
  );
}

const firsts = (res: readonly Res[], n: number): number => res.slice(0, n).filter((r) => r === 'ok').length;

/**
 * Under the header of a game played against its ghost: one lane for the player and one for the ghost, which
 * moves with the clock of the game as it did in its own. `rival` is null when there is no ghost to play
 * against after all (none is kept any more, or it is of other questions), and that is said instead.
 */
export function GhostTrack({ rival, trace, total, ms }: { rival: Ghost | null; trace: Trace; total: number; ms: number }) {
  const run = useMemo(() => (rival ? runOf(rival) : null), [rival]);
  if (!run) return <p className="ghost-none">{L('Ya no se puede jugar contra ese fantasma: esta partida va sin él.', 'That ghost can no longer be played against: this game goes without one.')}</p>;
  const mine = trace.map(([, res]) => res);
  const there = passed(run, ms);
  return (
    <div
      className="ghost-lanes"
      role="img"
      aria-label={L(
        `Tú: ${mine.length} de ${total} preguntas, ${firsts(mine, mine.length)} a la primera. Tu fantasma: ${there} de ${total}, ${firsts(run.res, there)} a la primera.`,
        `You: ${mine.length} of ${total} questions, ${firsts(mine, mine.length)} right first time. Your ghost: ${there} of ${total}, ${firsts(run.res, there)} right first time.`,
      )}
    >
      <Lane res={mine} done={mine.length} total={total} />
      <Lane ghost res={run.res} done={there} total={total} />
    </div>
  );
}

/** "85 %", which is never broken between the figure and its sign. */
const percent = (n: number): string => L(`${n}\u00a0%`, `${n}%`);
/** "90 % en 1:12" */
const resultOf = (run: Run): string => L(`${percent(run.score)} en ${fmtTime(run.ms)}`, `${percent(run.score)} in ${fmtTime(run.ms)}`);

/** "tu partida de hoy", "tu partida del 12 de noviembre": a game by the day it was played. */
function gameOf(t: number, now: number): string {
  const day = today(new Date(t));
  const here = today(new Date(now));
  if (day === here) return L('tu partida de hoy', 'your game from today');
  // The day before on the calendar, whatever the clocks did that night. (Worked out here: the dates of the
  // daily challenge would bring a file of the first page with them.)
  const before = new Date(now);
  before.setDate(before.getDate() - 1);
  if (day === today(before)) return L('tu partida de ayer', 'your game from yesterday');
  const date = fmtDay(day, day.slice(0, 4) !== here.slice(0, 4));
  return L(`tu partida del ${date}`, `your game of ${date}`);
}

const tally = (run: Run): string => L(`${run.ok} a la primera, ${run.warn} con ayuda y ${run.bad} fallos`, `${run.ok} right first time, ${run.warn} with help and ${run.bad} missed`);

/**
 * In the results of a game: how it went against its ghost, or which ghost its map has now, and the way to a
 * game against it. `racing` says the game was started as one against the ghost.
 */
export function GhostBox({ end, racing, onRace, onPlain, now = Date.now() }: { end: GhostEnd; racing: boolean; onRace(seed: number): void; onPlain(): void; now?: number }) {
  const { how, mine, other, seed } = end;
  const game = gameOf(end.when, now);
  const duel = (how === 'won' || how === 'lost' || how === 'tie') && mine && other;
  /** What becomes of the ghost of the map: said only of what it is known to be now. */
  const say = duel
    ? end.now === 'mine'
      ? L('Esta partida pasa a ser tu fantasma aquí.', 'This game is now your ghost here.')
      : end.now === 'other'
        ? L(`Tu fantasma sigue siendo ${game}.`, `Your ghost is still ${game}.`)
        : ''
    : how === 'left' && other
      ? end.now === 'other'
        ? L(`Has dejado la partida antes del final, así que no cuenta: tu fantasma sigue siendo ${game}, con ${resultOf(other)}.`, `You left the game before the end, so it does not count: your ghost is still ${game}, with ${resultOf(other)}.`)
        : L('Has dejado la partida antes del final, así que no cuenta.', 'You left the game before the end, so it does not count.')
      : how === 'first' && mine
        ? L(`Esta partida queda como tu fantasma aquí: ${resultOf(mine)}.`, `This game is kept as your ghost here: ${resultOf(mine)}.`)
        : how === 'better' && mine && other
          ? L(`Has mejorado tu fantasma, que era ${resultOf(other)}: ahora lo es esta partida, con ${resultOf(mine)}.`, `You have bettered your ghost, which was ${resultOf(other)}: this game is it now, with ${resultOf(mine)}.`)
          : other && end.now === 'other'
            ? L(`Tu fantasma aquí es ${game}: ${resultOf(other)}.`, `Your ghost here is ${game}: ${resultOf(other)}.`)
            : '';
  return (
    <section className="duel ghost-box" data-how={how} aria-label={L('Tu fantasma', 'Your ghost')}>
      <p className="ghost-head">
        <GhostIcon size={15} aria-hidden="true" />
        {L('Tu fantasma', 'Your ghost')}
      </p>
      {/* Who won is said by the title of the results: here, the two games side by side. */}
      {duel && (
        <div className={cx('duel-vs', how)}>
          <dl>
            <div className={cx(how === 'won' && 'best')}>
              <dt>{L('Tú', 'You')}</dt>
              <dd>
                {percent(mine.score)} <small>{fmtTime(mine.ms)}</small>
              </dd>
            </div>
            <div className={cx(how === 'lost' && 'best')}>
              <dt>{L('Tu fantasma', 'Your ghost')}</dt>
              <dd>
                {percent(other.score)} <small>{fmtTime(other.ms)}</small>
              </dd>
            </div>
          </dl>
          <div className="ghost-lanes" role="img" aria-label={L(`Pregunta a pregunta. Tú: ${tally(mine)}. Tu fantasma: ${tally(other)}.`, `Question by question. You: ${tally(mine)}. Your ghost: ${tally(other)}.`)}>
            <Lane res={mine.res} done={mine.res.length} total={mine.res.length} />
            <Lane ghost res={other.res} done={other.res.length} total={other.res.length} />
          </div>
        </div>
      )}
      {say && <p className="ghost-say">{say}</p>}
      {racing ? (
        <div className="ghost-go">
          <button type="button" className="btn btn-sm" onClick={onPlain}>
            {L('Jugar sin fantasma', 'Play without the ghost')}
          </button>
        </div>
      ) : (
        seed != null && (
          <div className="ghost-go">
            <button type="button" className="btn" onClick={() => onRace(seed)}>
              <GhostIcon size={16} aria-hidden="true" />
              {L('Contra tu fantasma', 'Against your ghost')}
            </button>
          </div>
        )
      )}
      <p className="duel-how">
        {racing
          ? L('Gana quien saca más porcentaje y, con el mismo, quien tarda menos.', 'The higher percentage wins and, with the same one, the shorter time.')
          : L(
              'Contra tu fantasma juegas sus mismas preguntas, en el mismo orden, y lo ves avanzar a tu lado. Gana quien saca más porcentaje y, con el mismo, quien tarda menos.',
              'Against your ghost you play its same questions, in the same order, and see it move alongside you. The higher percentage wins and, with the same one, the shorter time.',
            )}
      </p>
    </section>
  );
}

/** "12 nov" */
const shortDay = (t: number): string => new Intl.DateTimeFormat(getLang() === 'en' ? 'en-GB' : 'es-ES', { day: 'numeric', month: 'short' }).format(new Date(t));

/**
 * On the setup: the ghost of the game that is chosen now, on the map that is chosen now, and the button that
 * starts a game against it. Nothing when that game has none.
 */
export function GhostOffer({ cfg, country, onPlay }: { cfg: Omit<GameConfig, 'nonce'>; country(id: string): Country | undefined; onPlay(seed: number): void }) {
  const kept = useGhosts();
  const key = ghostKey(cfg, country);
  const ghost = key ? kept.find(([k]) => k === key)?.[1] : null;
  if (!ghost) return null;
  const run = runOf(ghost);
  return (
    <div className="ghost-offer">
      <p title={L('Tu mejor partida de este juego en este mapa: se juegan sus mismas preguntas, y la ves avanzar a tu lado.', 'Your best game of this mode on this map: its same questions are played, and you see it move alongside you.')}>
        <GhostIcon size={15} aria-hidden="true" />
        <span>
          {L('Tu fantasma aquí', 'Your ghost here')}:{' '}
          <span className="ghost-fig">
            <b>{percent(run.score)}</b> {L('en', 'in')} {fmtTime(run.ms)}
          </span>{' '}
          <small>· {shortDay(ghost.t)}</small>
        </span>
      </p>
      <button type="button" className="btn btn-sm" onClick={() => onPlay(ghost.k)}>
        {L('Contra tu fantasma', 'Against your ghost')}
      </button>
    </div>
  );
}
