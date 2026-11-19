/** The daily challenge: the country of the day, its five tests, the result and the calendar. */
import { BarChart3, BookOpen, CalendarDays, Check, Copy, Flame, MapPin, Play, Share2, Shield, Star } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { MapView, type MapHandle } from '../components/MapView';
import { SharePicture } from '../components/SharePicture';
import { BASE, Flag, Seg, Spinner } from '../components/ui';
import { GameShell } from '../games/common';
import { TravelGame } from '../games/Travel';
import { buildDeck, isFeminine, levelOf, type World } from '../lib/data';
import { silhouette } from '../lib/geo';
import { L, capName, fmtDay, fmtWeekday, getLang, nm } from '../lib/i18n';
import { go, settle } from '../lib/router';
import { DAILY_PATH, linkTo } from '../lib/routes';
import { siteLabel } from '../lib/shareCard';
import { DEFAULT_OPTS, useStore } from '../lib/store';
import { cx, fmtArea, fmtPop, today } from '../lib/text';
import type { Country, Deck, Mode } from '../lib/types';
import {
  TESTS,
  addDays,
  countryOfDay,
  dailyPool,
  dayNumber,
  doneCount,
  jokersBefore,
  quickQuestions,
  regionTargets,
  routePoints,
  streakState,
  totalOf,
  whichTarget,
  worldPool,
  type DailyRec,
} from './spec';
import { JokerChip, inARow, jokerRule, testName, useCountdown } from './Card';
import { hardByDefault, hardTurn } from './hard';
import { PinFive, PointsChip, QuickFive, QuickTyped, RegionleTest, WhichTest, nextLabel, shellSubtitle, shellTitle, type Step } from './tests';
import { DailyStatsBlock, useHasStats } from './Stats';
import { Versus, VersusNote } from './Versus';
import { decodeResult, encodeResult } from './versus';
import './daily.css';

/** "España" → 🇪🇸: the flag as text, for sharing. */
function flagEmoji(id: string): string {
  return /^[A-Z]{2}$/.test(id) ? String.fromCodePoint(...[...id].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65)) : '';
}

/**
 * The result as text, to send. Its link carries the points (and the name, if one is given), so that whoever
 * opens it plays the same challenge and sees both results side by side.
 */
export function shareText(date: string, country: Country, rec: DailyRec, name = ''): string {
  const squares = rec.p.map((p) => ((p ?? 0) >= 16 ? '🟩' : (p ?? 0) >= 8 ? '🟨' : '🟥')).join('');
  const url = linkTo(`${DAILY_PATH}/${date}/${encodeResult(rec.p, name, rec.h === 1)}`);
  const what = rec.h ? L('Reto difícil del', 'Hard challenge of') : L('Reto del', 'Challenge of');
  return [`Regionle ∞ · ${what} ${fmtDay(date, true)}`, `${flagEmoji(country.id)} ${nm(country.n)} · ${totalOf(rec)}/100${rec.h ? ' ★' : ''}`, squares, url].join('\n');
}

/** The mark of a challenge played the hard way. */
export function HardChip() {
  return (
    <span className="d-hard" title={L('Las mismas pruebas, con menos ayudas', 'The same tests, with fewer aids')}>
      <Star size={14} aria-hidden="true" />
      {L('Difícil', 'Hard')}
    </span>
  );
}

/** What happened in a test, from the figure kept with its points. */
function figureText(test: number, k: number | null): string {
  if (k == null) return L('pendiente', 'not played');
  const n = (one: string, many: string) => `${k} ${k === 1 ? one : many}`;
  switch (test) {
    case 0:
    case 3:
      return k === 0 ? L('sin acertar', 'not solved') : k === 1 ? L('a la primera', 'first try') : L(`en ${n('intento', 'intentos')}`, `in ${n('try', 'tries')}`);
    case 1:
      return L(`${k} de 5 a la primera`, `${k} of 5 at the first try`);
    case 2:
      return k < 0 ? L('sin completar', 'not completed') : k === 0 ? L('ruta perfecta', 'perfect route') : L(`${n('paso o pista', 'pasos o pistas')} de más`, `${n('extra step or hint', 'extra steps or hints')}`);
    default:
      return L(`${k} de 5`, `${k} of 5`);
  }
}

const verdictOf = (total: number): string =>
  total >= 90 ? L('¡Sobresaliente!', 'Outstanding!') : total >= 70 ? L('¡Muy bien!', 'Very good!') : total >= 50 ? L('Bien jugado', 'Well played') : total >= 25 ? L('Hay margen', 'Room to grow') : L('Mañana más', 'Better luck tomorrow');

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

export function Calendar({ world, current }: { world: World; current?: string }) {
  const daily = useStore((s) => s.daily);
  const pool = useMemo(() => dailyPool(world.index), [world]);
  const now = today();
  const [y, m, d] = now.split('-').map(Number);
  const monday = addDays(now, -((new Date(y, m - 1, d).getDay() + 6) % 7));
  const first = addDays(monday, -28);
  const days = Array.from({ length: 35 }, (_, i) => addDays(first, i));
  const names = getLang() === 'en' ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  return (
    <div className="d-cal" role="group" aria-label={L('Calendario de retos', 'Challenge calendar')}>
      {names.map((n, i) => (
        <span key={i} className="d-cal-head" aria-hidden="true">
          {n}
        </span>
      ))}
      {days.map((date) => {
        const open = dayNumber(date) >= 0 && date <= now;
        const rec = daily[date];
        const total = totalOf(rec);
        const done = !!rec?.t;
        const c = open ? countryOfDay(pool, dayNumber(date)) : null;
        // A day nobody played that a wildcard stood in for: the days in a row go through it.
        const joker = rec?.j === 1;
        const hard = rec?.h === 1 && doneCount(rec) > 0;
        const label = `${fmtDay(date)}${c ? ` · ${nm(c.n)}` : ''}${done ? ` · ${total}/100` : doneCount(rec) ? ` · ${L('a medias', 'in progress')}` : ''}${hard ? ` · ${L('en difícil', 'the hard way')}` : ''}${joker ? ` · ${L('cubierto por un comodín', 'held by a wildcard')}` : ''}`;
        return open ? (
          <a
            key={date}
            href={`#/reto/${date}`}
            className={cx('d-cal-day', date === now && 'is-today', date === current && 'on', done && (total >= 70 ? 'hi' : total >= 40 ? 'mid' : 'lo'), !done && doneCount(rec) > 0 && 'part', joker && 'joker', hard && 'is-hard')}
            title={label}
            aria-label={label}
          >
            <span>{Number(date.slice(8))}</span>
            {done ? <b>{total}</b> : joker ? <Shield size={17} aria-hidden="true" /> : <Flag code={c?.fl} size="sm" />}
            {hard && <Star className="d-cal-hard" size={10} aria-hidden="true" />}
          </a>
        ) : (
          <span key={date} className="d-cal-day off" aria-hidden="true">
            <span>{Number(date.slice(8))}</span>
          </span>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The challenge itself
// ---------------------------------------------------------------------------

export function Daily({ world, date, vs, soon }: { world: World; date: string; vs?: string; soon?: string }) {
  const rec = useStore((s) => s.daily[date]);
  const daily = useStore((s) => s.daily);
  const bestStreak = useStore((s) => s.best['daily:streak'] ?? 0);
  const setDaily = useStore((s) => s.setDaily);
  const addRival = useStore((s) => s.addRival);
  const nick = useStore((s) => s.nick);
  const setNick = useStore((s) => s.setNick);
  const start = useStore((s) => s.start);
  const opts = useStore((s) => s.opts);
  const now = today();
  const pool = useMemo(() => dailyPool(world.index), [world]);
  const country = useMemo(() => countryOfDay(pool, dayNumber(date)), [pool, date]);
  const level = levelOf(country);
  const fem = isFeminine(level.sg);
  const done = doneCount(rec);
  const next = rec ? rec.p.findIndex((x) => x == null) : 0;
  /** How the day is to be played while nothing is scored: as the challenge finished last was, until the player says. */
  const [wantHard, setWantHard] = useState(() => hardByDefault(useStore.getState().daily));
  /** A day is played one way: the first test that is scored settles it. */
  const hard = done > 0 ? rec?.h === 1 : wantHard;
  /** The test on screen. Its result is stored as soon as it is decided, so it stays here until the player moves on. */
  const [at, setAt] = useState(-1);
  const [view, setView] = useState<'intro' | 'study' | 'test' | 'summary'>(() => (done === TESTS ? 'summary' : 'intro'));
  const [regions, setRegions] = useState<Deck | null>(null);
  const [globe, setGlobe] = useState<Deck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [copied, setCopied] = useState(false);
  /** What there is to say about the link that was followed, when it could not be used as it came. */
  const [linkNote, setLinkNote] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const map = useRef<MapHandle>(null);
  const shareBox = useRef<HTMLTextAreaElement>(null);
  const left = useCountdown();
  const hasStats = useHasStats();
  const onExit = () => go('');

  // A link with somebody's result: it is kept to set beside one's own, and the address goes back to the day's.
  useEffect(() => {
    if (soon) {
      setLinkNote(
        L(
          `Te han enviado un resultado del reto del ${fmtDay(soon)}, que aquí todavía no ha empezado. Este es el de hoy: abre el enlace otra vez cuando llegue ese día.`,
          `You were sent a result of the challenge of ${fmtDay(soon)}, which has not started here yet. This is today's: open the link again when that day comes.`,
        ),
      );
      settle(DAILY_PATH);
      return;
    }
    if (!vs) return;
    const rival = decodeResult(vs);
    const st = useStore.getState();
    const own = st.daily[date];
    // One's own link, opened where it was made: there is nobody to compare with.
    const mine = !!rival && !!own?.t && own.p.join() === rival.p.join() && (rival.h ?? 0) === (own.h ?? 0) && (!rival.n || rival.n === st.nick.trim());
    if (!rival) setLinkNote(L('El enlace traía un resultado para comparar, pero ha llegado incompleto. Puedes jugar el reto igualmente.', 'The link came with a result to compare, but it arrived incomplete. You can play the challenge all the same.'));
    else if (!mine) addRival(date, rival);
    settle(`${DAILY_PATH}/${date}`);
  }, [vs, soon, date, addRival]);

  useEffect(() => {
    let alive = true;
    setError(null);
    buildDeck({ scope: 'regions', countries: [country.id] })
      .then((d) => alive && setRegions(d))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [country, attempt]);

  // The world map of the route test is fetched while the first tests are played.
  const wantGlobe = view === 'test' && !globe;
  useEffect(() => {
    if (!wantGlobe) return;
    let alive = true;
    buildDeck({ scope: 'countries', countries: worldPool(world.index).map((c) => c.id) })
      .then((d) => alive && setGlobe(d))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [wantGlobe, world, attempt]);

  const targets = useMemo(() => (regions ? regionTargets(date, regions.items.map((it) => it.id)) : null), [regions, date]);
  const shape = useMemo(() => (regions && targets ? silhouette(regions.byId.get(targets.mystery)!.geo, 400) : ''), [regions, targets]);
  const turnedShape = useMemo(() => (hard && regions && targets ? silhouette(regions.byId.get(targets.mystery)!.geo, 400, 0.08, hardTurn(date)) : undefined), [hard, regions, targets, date]);
  const which = useMemo(() => whichTarget(date, world.index, country.id), [date, world, country]);
  const quick = useMemo(() => quickQuestions(date, world.index, [country.id, which.id]), [date, world, country, which]);
  const guessable = useMemo(() => worldPool(world.index), [world]);
  // Handy when debugging from the browser console; removed from production builds.
  if (import.meta.env.DEV) (window as unknown as { __daily?: unknown }).__daily = { country: country.id, targets, which: which.id, quick, regions };

  const score = (test: number) => (points: number, figure: number) => setDaily(date, test, points, figure, hard);
  const advance = () => {
    if (at >= TESTS - 1) setView('summary');
    else setAt(at + 1);
  };
  const begin = () => {
    setAt(next);
    setView('test');
  };

  const learn = (mode: Mode) => {
    start({ section: 'regions', mode, countries: [country.id], levels: {}, opts });
    go('jugar');
  };

  const share = async () => {
    if (!rec) return;
    const text = shareText(date, country, rec, nick);
    try {
      if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ text });
        return;
      }
    } catch {
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      shareBox.current?.select();
      document.execCommand?.('copy');
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
  const shell = (panel: ReactNode, stage?: ReactNode, subtitle = cap(`${fmtWeekday(date)}, ${fmtDay(date, true)}`)) => (
    <GameShell title={shellTitle()} subtitle={subtitle} onExit={onExit} hud={done > 0 && done < TESTS ? <PointsChip points={totalOf(rec)} /> : undefined} panel={panel} stage={stage} />
  );

  if (error) {
    return shell(
      <div className="q">
        <div className="q-prompt">
          <p className="kicker">{L('Vaya', 'Oops')}</p>
          <h2 className="q-ask">{L('No se ha podido cargar el mapa', 'The map could not be loaded')}</h2>
        </div>
        <p className="q-note">{L(`${error}. Comprueba la conexión y vuelve a intentarlo.`, `${error}. Check your connection and try again.`)}</p>
        <div className="q-actions">
          <button type="button" className="btn btn-primary" onClick={() => setAttempt((n) => n + 1)}>
            {L('Reintentar', 'Retry')}
          </button>
        </div>
      </div>,
    );
  }

  const past = date !== now;
  const header = (
    <>
      <p className="kicker">
        {past ? L('Reto del', 'Challenge of') : L('Reto de hoy ·', "Today's challenge ·")} {fmtWeekday(date)}, {fmtDay(date, past)}
      </p>
      <h2 className="d-title">
        <Flag code={country.fl} size="lg" />
        <span>{nm(country.n)}</span>
      </h2>
    </>
  );

  // ------------------------------------------------------------------ summary
  if (view === 'summary' && rec) {
    const total = totalOf(rec);
    const run = streakState(daily, now);
    const streak = run.days;
    // The days just before this one that a wildcard stood in for, when this is the day that used them.
    const stoodIn = rec.late ? 0 : jokersBefore(daily, date);
    return shell(
      <div className="pop d-summary">
        <div className="d-head">{header}</div>
        <p className="d-total">
          <strong>{total}</strong>
          <span>/ 100</span>
        </p>
        <p className="d-verdict">{verdictOf(total)}</p>
        {rec.h === 1 && (
          <p className="d-hardline">
            <HardChip />
          </p>
        )}
        <ol className="d-rows">
          {rec.p.map((p, i) => (
            <li key={i}>
              <span className="d-row-name">{testName(i)}</span>
              <span className="d-row-what">{figureText(i, rec.k[i])}</span>
              <span className="d-row-bar" aria-hidden="true">
                <i style={{ width: `${((p ?? 0) / 20) * 100}%` }} className={(p ?? 0) >= 16 ? 'hi' : (p ?? 0) >= 8 ? 'mid' : 'lo'} />
              </span>
              <b>{p ?? 0}</b>
            </li>
          ))}
        </ol>
        {linkNote && (
          <p className="d-vs-note" role="status">
            {linkNote}
          </p>
        )}
        <Versus date={date} rec={rec} />
        <p className="d-streakline">
          <span className={cx('d-streak', streak > 0 && 'on')}>
            <Flame size={16} aria-hidden="true" />
            {inARow(streak)}
          </span>
          <span>{L(`Mejor racha: ${Math.max(bestStreak, run.longest)}`, `Best streak: ${Math.max(bestStreak, run.longest)}`)}</span>
          {run.jokers > 0 && <JokerChip n={run.jokers} />}
          {rec.late ? <span>{L('Jugado después de su día: no cuenta para la racha.', 'Played after its day: it does not count for the streak.')}</span> : !past ? <span>{L(`Nuevo reto en ${left}`, `Next challenge in ${left}`)}</span> : null}
        </p>
        {!rec.late && (stoodIn > 0 || !past) && (
          <p className="d-hint d-joker-note">
            {stoodIn > 0 && (
              <b>
                {stoodIn === 1
                  ? L(past ? 'Un comodín cubrió el día anterior y la racha siguió.' : 'Un comodín ha cubierto el día de ayer: tu racha sigue.', past ? 'A wildcard held the day before and the streak went on.' : 'A wildcard has held yesterday: your streak goes on.')
                  : L(`${stoodIn} comodines cubrieron los ${stoodIn} días anteriores: la racha sigue.`, `${stoodIn} wildcards held the ${stoodIn} days before: the streak goes on.`)}{' '}
              </b>
            )}
            {!past && (
              <>
                {jokerRule()}{' '}
                {run.toNext > 0
                  ? L(`Te ${run.toNext === 1 ? 'falta 1 día' : `faltan ${run.toNext} días`} para el siguiente.`, `${run.toNext === 1 ? '1 day' : `${run.toNext} days`} to go for the next one.`)
                  : L(`Ya tienes los ${run.jokers} que caben.`, `You already hold the ${run.jokers} that fit.`)}
              </>
            )}
          </p>
        )}
        <div className="d-share">
          <textarea ref={shareBox} readOnly rows={4} value={shareText(date, country, rec, nick)} aria-label={L('Texto para compartir', 'Text to share')} onFocus={(e) => e.currentTarget.select()} />
          <div className="d-share-btns">
            <button type="button" className="btn btn-primary" onClick={share}>
              {copied ? <Check size={16} aria-hidden="true" /> : 'share' in navigator ? <Share2 size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
              {copied ? L('Copiado', 'Copied') : L('Compartir resultado', 'Share the result')}
            </button>
            <SharePicture
              info={{
                kicker: `${rec.h ? L('Reto difícil del', 'Hard challenge of') : L('Reto del', 'Challenge of')} ${fmtDay(date, true)}`,
                country: nm(country.n),
                total,
                verdict: verdictOf(total),
                rows: rec.p.map((p, i) => ({ name: testName(i), points: p ?? 0 })),
                streak: !past && streak > 1 ? inARow(streak) : null,
                site: siteLabel(),
              }}
              flagUrl={country.fl ? `${BASE}flags/${country.fl}.svg` : undefined}
              deck={regions}
              file={`regionle-${date}.png`}
              text={shareText(date, country, rec, nick)}
            />
          </div>
          <div className="duel-send d-share-name">
            <label>
              <span>{L('Tu nombre', 'Your name')}</span>
              <input type="text" value={nick} maxLength={24} placeholder={L('Opcional', 'Optional')} onChange={(e) => setNick(e.target.value)} autoComplete="nickname" />
            </label>
          </div>
          <p className="duel-how">
            {L(
              'El enlace lleva tu resultado: quien lo abra juega este mismo reto y os comparáis prueba a prueba. Si te envían el suyo, aparece aquí.',
              'The link carries your result: whoever opens it plays this same challenge and you compare test by test. If they send you theirs, it shows here.',
            )}
          </p>
        </div>
        <div className="d-learn">
          <h3>{L(`Aprende ${fem ? 'las' : 'los'} ${level.es} de ${nm(country.n)}`, `Learn the ${level.en} of ${nm(country.n)}`)}</h3>
          <div className="q-actions center">
            <button type="button" className="btn" onClick={() => learn('explore')}>
              <BookOpen size={16} aria-hidden="true" />
              {L('Explorar el mapa', 'Explore the map')}
            </button>
            <button type="button" className="btn" onClick={() => learn('pin')}>
              <MapPin size={16} aria-hidden="true" />
              {L(`Señalar ${fem ? 'las' : 'los'} ${level.n}`, `Find all ${level.n}`)}
            </button>
          </div>
        </div>
        <div className="d-history">
          <h3>{L('Tus retos', 'Your challenges')}</h3>
          <p className="d-hint">{L('Toca un día para jugarlo o ver su resultado. Los días pasados no cuentan para la racha.', 'Tap a day to play it or see its result. Past days do not count for the streak.')}</p>
          <Calendar world={world} current={date} />
        </div>
        <div className="d-history d-wide">
          <h3>{L('Tus estadísticas', 'Your statistics')}</h3>
          <DailyStatsBlock current={date} />
        </div>
        <div className="q-actions center">
          <button type="button" className="btn btn-ghost" onClick={onExit}>
            {L('Volver al inicio', 'Back to the start')}
          </button>
        </div>
      </div>,
    );
  }

  if (!regions || !targets) {
    return (
      <div className="play play-loading">
        <Spinner label={L('Preparando el reto…', 'Preparing the challenge…')} />
      </div>
    );
  }

  // -------------------------------------------------------------------- tests
  if (view === 'test' && at >= 0) {
    const before = (rec?.p ?? []).slice(0, at).reduce<number>((sum, x) => sum + (x ?? 0), 0);
    const step: Step = { index: at, points: before, onExit: () => setView(doneCount(rec) === TESTS ? 'summary' : 'intro') };
    if (at === 0) return <RegionleTest key={0} deck={regions} target={targets.mystery} shape={shape} turned={turnedShape} hard={hard} step={step} onScore={score(0)} onDone={advance} />;
    if (at === 1) return <PinFive key={1} deck={regions} targets={targets.pins} hard={hard} step={step} onScore={score(1)} onDone={advance} />;
    if (at === 2) {
      if (!globe) {
        return (
          <div className="play play-loading">
            <Spinner label={L('Dibujando el mapamundi…', 'Drawing the world map…')} />
          </div>
        );
      }
      return (
        <TravelGame
          key={2}
          deck={globe}
          cfg={{ section: 'countries', mode: 'travel', countries: [], levels: {}, opts: { ...DEFAULT_OPTS, suggest: true }, daily: date, nonce: 0 }}
          onExit={step.onExit}
          onAgain={() => undefined}
          embed={{
            title: shellTitle(),
            subtitle: shellSubtitle(2),
            progress: 2 / TESTS,
            hud: <PointsChip points={step.points} />,
            nextLabel: nextLabel(2),
            onScore: (extra, lost) => score(2)(routePoints(extra, lost), lost ? -1 : extra),
            onDone: advance,
            noHints: hard,
            points: (extra, lost) => (
              <p className="d-points">
                +{routePoints(extra, lost)} {L('puntos', 'points')}
              </p>
            ),
          }}
        />
      );
    }
    if (at === 3) return <WhichTest key={3} target={which} countries={guessable} continent={nm(world.index.continents[which.ct])} hard={hard} step={step} onScore={score(3)} onDone={advance} />;
    if (hard) return <QuickTyped key={4} questions={quick} byId={world.byId} countries={guessable} step={step} onScore={score(4)} onDone={advance} />;
    return <QuickFive key={4} questions={quick} byId={world.byId} step={step} onScore={score(4)} onDone={advance} />;
  }

  // -------------------------------------------------------------------- study
  if (view === 'study') {
    const list = [...regions.items].sort((a, b) => a.name.localeCompare(b.name, getLang()));
    return shell(
      <div className="q d-study">
        <div className="q-prompt">{header}</div>
        <p className="q-sub">
          {L(
            `Estudia el mapa el tiempo que quieras: ${level.n} ${level.es}. Cuando empieces, los nombres se ocultan.`,
            `Study the map for as long as you like: ${level.n} ${level.en}. When you start, the names are hidden.`,
          )}
        </p>
        <div className="q-actions">
          <button type="button" className="btn btn-primary" onClick={begin}>
            <Play size={16} aria-hidden="true" />
            {done ? L('Seguir con las pruebas', 'Continue the tests') : L('Empezar las pruebas', 'Start the tests')}
          </button>
        </div>
        <ul className="d-names">
          {list.map((it) => (
            <li key={it.id}>
              <button
                type="button"
                className={cx(sel === it.id && 'on')}
                onClick={() => {
                  setSel(it.id);
                  map.current?.focus([it.id], { fill: 0.35 });
                }}
              >
                {it.name}
              </button>
            </li>
          ))}
        </ul>
      </div>,
      <MapView ref={map} deck={regions} labels="all" paint={sel ? { [sel]: 'sel' } : undefined} pickable onPick={setSel} pinned={sel ? new Set([sel]) : undefined} tip={(id) => regions.byId.get(id)?.name} />,
      L('Estudiar antes de empezar', 'Study before you start'),
    );
  }

  // -------------------------------------------------------------------- intro
  return shell(
    <div className="pop d-intro">
      <div className="d-head">{header}</div>
      <p className="d-facts">
        {level.n} {getLang() === 'en' ? level.en : level.es}
        {country.cap ? ` · ${L('capital', 'capital')}: ${capName(country.cap)}` : ''}
        {country.pop ? ` · ${fmtPop(country.pop)}` : ''} · {fmtArea(country.ar)}
      </p>
      <p className="d-lead">
        {L(
          'Cinco pruebas cortas, las mismas para todo el mundo. Las dos primeras van de las regiones de este país: si no las conoces, puedes estudiar su mapa antes de empezar.',
          'Five short tests, the same for everybody. The first two are about the regions of this country: if you do not know them, you can study its map before you start.',
        )}
      </p>
      {linkNote && (
        <p className="d-vs-note" role="status">
          {linkNote}
        </p>
      )}
      <VersusNote date={date} />
      <div className="d-mode">
        {done > 0 ? (
          hard && (
            <p className="d-hardline">
              <HardChip />
              <span>{L('Lo estás jugando en difícil.', 'You are playing it the hard way.')}</span>
            </p>
          )
        ) : (
          <>
            <Seg
              label={L('Cómo lo juegas', 'How you play it')}
              value={hard ? 'hard' : 'plain'}
              onChange={(v) => setWantHard(v === 'hard')}
              options={[
                { value: 'plain', label: L('Normal', 'Normal') },
                { value: 'hard', label: L('Difícil', 'Hard') },
              ]}
            />
            <p className="d-hint">
              {hard
                ? L('Las mismas cinco pruebas con menos ayudas. Los puntos se cuentan igual: cuesta más llegar.', 'The same five tests with fewer aids. The points are counted the same way: they are harder to get.')
                : L('¿Te sabe a poco? En difícil son las mismas pruebas con menos ayudas.', 'Too easy? The hard way is the same tests with fewer aids.')}
            </p>
          </>
        )}
      </div>
      <ol className={cx('d-list', hard && 'is-hard')}>
        {(hard
          ? [
              L(`Adivina ${fem ? 'una' : 'uno'} de sus ${level.es} por la silueta, girada y en cuatro intentos.`, `Guess one of its ${level.en} from its outline, turned and in four tries.`),
              L('Señala cinco en el mapa, con un solo intento cada una.', 'Find five of them on the map, with one try at each.'),
              L('Une dos países del mundo por el camino más corto, sin pistas.', 'Join two countries of the world by the shortest way, with no hints.'),
              L('Adivina un país por su población, sin saber el continente.', 'Guess a country from its population, without its continent.'),
              L('Cinco preguntas de banderas y capitales, escribiendo la respuesta.', 'Five questions about flags and capitals, typing the answer.'),
            ]
          : [
              L(`Adivina ${fem ? 'una' : 'uno'} de sus ${level.es} por la silueta, en seis intentos.`, `Guess one of its ${level.en} from its outline, in six tries.`),
              L('Señala cinco en el mapa.', 'Find five of them on the map.'),
              L('Une dos países del mundo por el camino más corto.', 'Join two countries of the world by the shortest way.'),
              L('Adivina un país por su población.', 'Guess a country from its population.'),
              L('Cinco preguntas rápidas de banderas y capitales.', 'Five quick questions about flags and capitals.'),
            ]
        ).map((text, i) => {
          const p = rec?.p[i];
          return (
            <li key={i} className={cx(p != null && 'done', i === next && done > 0 && 'next')}>
              <i>{p != null ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : i + 1}</i>
              <span>
                <b>{testName(i)}</b>
                {text}
              </span>
              {p != null && <em>{p} / 20</em>}
            </li>
          );
        })}
      </ol>
      {past && <p className="d-hint">{L('Es un reto de un día pasado: puedes jugarlo, pero no cuenta para la racha.', 'This is a past challenge: you can play it, but it does not count for the streak.')}</p>}
      <div className="q-actions center">
        <button type="button" className="btn btn-primary btn-lg" onClick={begin}>
          <Play size={18} aria-hidden="true" />
          {done ? L(`Seguir: prueba ${done + 1}`, `Continue: test ${done + 1}`) : L('Empezar', 'Start')}
        </button>
        {next >= 0 && next <= 1 && (
          <button type="button" className="btn btn-lg" onClick={() => setView('study')}>
            <BookOpen size={18} aria-hidden="true" />
            {L('Estudiar el mapa antes', 'Study the map first')}
          </button>
        )}
      </div>
      <details className="d-history">
        <summary>
          <CalendarDays size={16} aria-hidden="true" />
          {L('Calendario y retos anteriores', 'Calendar and past challenges')}
        </summary>
        <Calendar world={world} current={date} />
      </details>
      {hasStats && (
        <details className="d-history d-wide">
          <summary>
            <BarChart3 size={16} aria-hidden="true" />
            {L('Tus estadísticas', 'Your statistics')}
          </summary>
          <DailyStatsBlock current={date} />
        </details>
      )}
    </div>,
  );
}
