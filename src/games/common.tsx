/** Pieces shared by every game: screen frame, clock, verdict box and results. */
import { ArrowLeft, Check, CircleAlert, Flame, RotateCcw, Settings2, Timer, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ReviewNext } from '../components/ReviewCard';
import { SpeakButton } from '../components/Speak';
import { WikiCard } from '../components/WikiCard';
import { Flag, StudyLinks, capitalise } from '../components/ui';
import { levelOf } from '../lib/data';
import { L, capName, nm } from '../lib/i18n';
import { divisionsLink } from '../lib/links';
import { useStore, type GameConfig } from '../lib/store';
import { cx, fmtArea, fmtPop, fmtTime, nf } from '../lib/text';
import type { Deck, Item, Res } from '../lib/types';
import { scoreOf } from './quiz';

/**
 * Where an item comes from, as the review keeps it: enough to draw its map again another day.
 * "r|ES|g1" a region of Spain at that level · "c" a country · "t|ES|top" a city of Spain, and which
 * cities were on the map · "p" a river, a sea…
 */
export function originOf(item: Item, cfg: GameConfig): string {
  if (item.kind === 'country') return 'c';
  if (item.kind === 'feature') return 'p';
  if (item.kind === 'city') return `t|${item.country.id}|${cfg.opts.cityPick}`;
  return `r|${item.country.id}|${levelOf(item.country, cfg.levels).k}`;
}

/** Is the country of each item worth showing? Only when the map mixes several. */
export function showsCountry(deck: Deck | undefined): boolean {
  return !!deck && deck.countries.length > 1 && (deck.scope === 'regions' || deck.scope === 'cities');
}

export { nearest } from '../lib/geo';

export interface GameProps {
  deck: Deck;
  cfg: GameConfig;
  /** Back to the setup screen. */
  onExit(): void;
  /** Starts again, optionally with a changed configuration. */
  onAgain(patch?: Partial<GameConfig>): void;
}

/** Milliseconds elapsed while `running` is true. */
export function useElapsed(running: boolean): number {
  const [ms, setMs] = useState(0);
  const banked = useRef(0);
  useEffect(() => {
    if (!running) return;
    const started = Date.now();
    const timer = setInterval(() => setMs(banked.current + Date.now() - started), 500);
    return () => {
      clearInterval(timer);
      banked.current += Date.now() - started;
      setMs(banked.current);
    };
  }, [running]);
  return ms;
}

export function Hud({ ms, streak, progress }: { ms?: number; streak?: number; progress?: ReactNode }) {
  return (
    <>
      {progress != null && <span className="hud-chip hud-main">{progress}</span>}
      {streak != null && streak >= 2 && (
        <span className="hud-chip hud-streak" title={L('Racha de aciertos a la primera', 'Streak of first-time right answers')}>
          <Flame size={14} aria-hidden="true" />
          {streak}
        </span>
      )}
      {ms != null && (
        <span className="hud-chip" title={L('Tiempo', 'Time')}>
          <Timer size={14} aria-hidden="true" />
          {fmtTime(ms)}
        </span>
      )}
    </>
  );
}

export function GameShell({
  title,
  subtitle,
  hud,
  panel,
  stage,
  onExit,
  progress,
}: {
  title: string;
  subtitle: string;
  hud?: ReactNode;
  panel: ReactNode;
  stage?: ReactNode;
  onExit(): void;
  /** 0–1, drawn as a thin bar under the header. */
  progress?: number;
}) {
  return (
    <div className="play">
      <header className="play-top">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onExit}>
          <ArrowLeft size={16} aria-hidden="true" />
          <span>{L('Salir', 'Exit')}</span>
        </button>
        <h1 className="play-title">
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </h1>
        <div className="hud">{hud}</div>
        {progress != null && (
          <div className="play-bar" aria-hidden="true">
            <i style={{ width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }} />
          </div>
        )}
      </header>
      <div className={cx('play-body', !stage && 'solo')}>
        <section className="panel">{panel}</section>
        {stage && <section className="stage">{stage}</section>}
      </div>
    </div>
  );
}

/** One or two lines of facts about an item. */
export function ItemFacts({ item }: { item: Item }) {
  const c = item.country;
  if (item.kind === 'country') {
    return (
      <p className="facts">
        {c.cap && (
          <>
            {L('Capital', 'Capital')}: <b>{capName(c.cap)}</b>
            <br />
          </>
        )}
        {c.pop ? `${fmtPop(c.pop)} · ` : ''}
        {fmtArea(c.ar)}
        {c.sov && c.cl === 'dep' ? ` · ${L('territorio dependiente', 'dependent territory')}` : ''}
      </p>
    );
  }
  if (item.kind === 'city') {
    return (
      <p className="facts">
        {item.cap === 3 ? L('Capital de', 'Capital of') : item.cap === 2 ? L('Segunda capital de', 'Second capital of') : item.cap === 1 ? L('Capital regional ·', 'Regional capital ·') : L('Ciudad de', 'City in')}{' '}
        <Flag code={c.fl} size="sm" /> {nm(c.n)}
        {item.pop ? (
          <>
            <br />
            {fmtPop(item.pop)} {L('en su área urbana', 'in its urban area')}
          </>
        ) : null}
      </p>
    );
  }
  if (item.kind === 'feature') {
    return (
      <p className="facts">
        {capitalise(item.type)} · {nm(c.n)}
        {item.area > 0 && (
          <>
            <br />
            {fmtArea(item.area)}
          </>
        )}
        {item.elev != null && (
          <>
            <br />
            {L(`${nf(item.elev)} m de altitud`, `${nf(item.elev)} m high`)}
          </>
        )}
      </p>
    );
  }
  return (
    <p className="facts">
      {capitalise(item.type)}
      {item.parent ? ` · ${item.parent}` : ''} · <Flag code={c.fl} size="sm" /> {nm(c.n)}
      <br />
      {item.capital?.length ? (
        <>
          {L('Capital', 'Capital')}: <b>{item.capital[0]}</b> ·{' '}
        </>
      ) : null}
      {fmtArea(item.area)}
    </p>
  );
}

const VERDICT_ICON = { ok: Check, warn: CircleAlert, bad: X } as const;

/**
 * `wiki` adds what Wikipedia says about the item: worth it when the answer was missed and there is time to read.
 * `say` is the name the loudspeaker reads out, when it is not the name of the item (a capital).
 */
export function Verdict({ res, title, item, wiki, say, children }: { res: Res; title: ReactNode; item?: Item | null; wiki?: boolean; say?: string; children?: ReactNode }) {
  const Icon = VERDICT_ICON[res];
  const aloud = say ?? item?.name;
  return (
    <div className={cx('verdict', `verdict-${res}`)} role="status" aria-live="polite">
      <div className="verdict-head">
        <span className="verdict-icon">
          <Icon size={16} strokeWidth={3} aria-hidden="true" />
        </span>
        <span>{title}</span>
        {aloud && <SpeakButton key={aloud} text={aloud} />}
      </div>
      {item && <ItemFacts item={item} />}
      {item && wiki && res !== 'ok' && <WikiCard item={item} />}
      {item && <StudyLinks item={item} />}
      {children}
    </div>
  );
}

export function Donut({ ok, warn, bad, label, caption }: { ok: number; warn: number; bad: number; label: string; caption: string }) {
  const total = Math.max(1, ok + warn + bad);
  const R = 52;
  const C = 2 * Math.PI * R;
  let offset = 0;
  const arc = (n: number, cls: string) => {
    const len = (n / total) * C;
    const el = n > 0 ? <circle key={cls} className={cls} cx="64" cy="64" r={R} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} /> : null;
    offset += len;
    return el;
  };
  return (
    <div className="donut">
      <svg viewBox="0 0 128 128" aria-hidden="true">
        <circle className="donut-bg" cx="64" cy="64" r={R} />
        <g transform="rotate(-90 64 64)">
          {arc(ok, 'donut-ok')}
          {arc(warn, 'donut-warn')}
          {arc(bad, 'donut-bad')}
        </g>
      </svg>
      <div className="donut-text">
        <strong>{label}</strong>
        <span>{caption}</span>
      </div>
    </div>
  );
}

export interface ResultRow {
  item: Item;
  res: Res;
  note?: string;
}

const resLabel = (res: Res): string => (res === 'bad' ? L('Para repasar', 'To review') : res === 'warn' ? L('Con ayuda', 'With help') : L('A la primera', 'First time'));

export function Results({
  title,
  deck,
  rows,
  counts,
  ms,
  stats,
  note,
  onAgain,
  onReview,
  onExit,
  againLabel = L('Otra vez', 'Again'),
  again = true,
  focus = true,
  children,
}: {
  title: string;
  deck?: Deck;
  rows: ResultRow[];
  /** Tallies to show when they do not come from the rows (games scored by rounds). */
  counts?: { ok: number; warn: number; bad: number };
  ms?: number;
  /** Extra figures shown next to the score. */
  stats?: { label: string; value: ReactNode }[];
  note?: ReactNode;
  onAgain(): void;
  onReview?(ids: string[]): void;
  onExit(): void;
  againLabel?: string;
  /** False when playing the same again makes no sense (nothing was left to ask). */
  again?: boolean;
  /**
   * False when the game ends while the player is typing: the Enter that often follows the last name
   * would land on the button and start another game before the result is seen.
   */
  focus?: boolean;
  children?: ReactNode;
}) {
  const count = counts ?? { ok: 0, warn: 0, bad: 0 };
  if (!counts) for (const r of rows) count[r.res]++;
  const total = count.ok + count.warn + count.bad;
  const weak = rows.filter((r) => r.res !== 'ok');
  const several = showsCountry(deck);
  const review = useStore((s) => !!s.game?.review);
  return (
    <div className="results">
      <p className="kicker">{L('Resultado', 'Result')}</p>
      <h2 className="results-title">{title}</h2>
      {note && <p className="results-note">{note}</p>}
      <div className="results-score">
        <Donut {...count} label={`${scoreOf(count.ok, count.warn, total)} %`} caption={`${nf(count.ok)} ${L('de', 'of')} ${nf(total)}`} />
        <dl className="results-stats">
          <div>
            <dt>{L('A la primera', 'First time')}</dt>
            <dd className="c-ok">{nf(count.ok)}</dd>
          </div>
          <div>
            <dt>{L('Con ayuda', 'With help')}</dt>
            <dd className="c-warn">{nf(count.warn)}</dd>
          </div>
          <div>
            <dt>{L('Fallos', 'Misses')}</dt>
            <dd className="c-bad">{nf(count.bad)}</dd>
          </div>
          {ms != null && (
            <div>
              <dt>{L('Tiempo', 'Time')}</dt>
              <dd>{fmtTime(ms)}</dd>
            </div>
          )}
          {stats?.map((s) => (
            <div key={s.label}>
              <dt>{s.label}</dt>
              <dd>{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      {review && <ReviewNext />}
      <div className="results-actions">
        {again && (
          <button type="button" className={review ? 'btn' : 'btn btn-primary'} onClick={onAgain} autoFocus={focus && !review}>
            <RotateCcw size={16} aria-hidden="true" />
            {againLabel}
          </button>
        )}
        {onReview && weak.length > 0 && weak.length < rows.length && (
          <button type="button" className="btn" onClick={() => onReview(weak.map((r) => r.item.id))}>
            {/* The repeat takes the misses and the answers that needed help: the button says which it is. */}
            {weak.length === count.bad || counts
              ? L(`Repasar ${nf(weak.length)} ${weak.length === 1 ? 'fallo' : 'fallos'}`, `Review ${nf(weak.length)} ${weak.length === 1 ? 'miss' : 'misses'}`)
              : weak.length === 1
                ? L('Repasar la que no salió a la primera', 'Review the one not right first time')
                : L(`Repasar las ${nf(weak.length)} que no salieron a la primera`, `Review the ${nf(weak.length)} not right first time`)}
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={onExit}>
          <Settings2 size={16} aria-hidden="true" />
          {review ? L('Volver al inicio', 'Back to home') : L('Cambiar de juego', 'Change game')}
        </button>
      </div>
      {children}
      {(['bad', 'warn', 'ok'] as const).map((res) => {
        const list = rows.filter((r) => r.res === res);
        if (!list.length) return null;
        return (
          <details key={res} className={cx('results-group', `g-${res}`)} open={res !== 'ok'}>
            <summary>
              <span className="dot" />
              {resLabel(res)} <small>{nf(list.length)}</small>
            </summary>
            <ul>
              {list.map(({ item, note: n }) => (
                <li key={item.id}>
                  <div className="row-name">
                    {(item.kind === 'country' || several) && <Flag code={item.country.fl} size="sm" />}
                    <b>{item.name}</b>
                    {n ? <small>{n}</small> : (item.kind === 'unit' || item.kind === 'city') && (item.parent || several) ? <small>{item.parent ?? nm(item.country.n)}</small> : null}
                  </div>
                  {res !== 'ok' && <StudyLinks item={item} />}
                </li>
              ))}
            </ul>
          </details>
        );
      })}
      {deck && deck.scope === 'regions' && deck.countries.length <= 3 && (
        <div className="links results-read">
          {deck.countries.map((c) => {
            const l = divisionsLink(c);
            return (
              <a key={c.id} className="pill-link" href={l.href} target="_blank" rel="noopener noreferrer" title={l.title}>
                {l.label}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

