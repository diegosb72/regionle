/** The daily challenge: the country of the day, its five tests, the result and the calendar. */
import { BookOpen, CalendarDays, Check, Copy, Flame, MapPin, Play, Share2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { MapView, type MapHandle } from '../components/MapView';
import { Flag, Spinner } from '../components/ui';
import { GameShell } from '../games/common';
import { TravelGame } from '../games/Travel';
import { buildDeck, isFeminine, levelOf, type World } from '../lib/data';
import { silhouette } from '../lib/geo';
import { L, capName, fmtDay, fmtWeekday, getLang, nm } from '../lib/i18n';
import { go } from '../lib/router';
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
  quickQuestions,
  regionTargets,
  routePoints,
  streakOf,
  totalOf,
  whichTarget,
  worldPool,
  type DailyRec,
} from './spec';
import { PinFive, PointsChip, QuickFive, RegionleTest, WhichTest, nextLabel, shellSubtitle, shellTitle, testName, type Step } from './tests';

/** "España" → 🇪🇸: the flag as text, for sharing. */
function flagEmoji(id: string): string {
  return /^[A-Z]{2}$/.test(id) ? String.fromCodePoint(...[...id].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65)) : '';
}

export function shareText(date: string, country: Country, rec: DailyRec): string {
  const squares = rec.p.map((p) => ((p ?? 0) >= 16 ? '🟩' : (p ?? 0) >= 8 ? '🟨' : '🟥')).join('');
  const url = `${window.location.origin}${window.location.pathname}#/reto/${date}`;
  return [`Regionle ∞ · ${L('Reto del', 'Challenge of')} ${fmtDay(date, true)}`, `${flagEmoji(country.id)} ${nm(country.n)} · ${totalOf(rec)}/100`, squares, url].join('\n');
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

function useCountdown(): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 20000);
    return () => clearInterval(t);
  }, []);
  const end = new Date(now);
  end.setHours(24, 0, 0, 0);
  const mins = Math.max(0, Math.round((end.getTime() - now) / 60000));
  return `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, '0')} min`;
}

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
        const label = `${fmtDay(date)}${c ? ` · ${nm(c.n)}` : ''}${done ? ` · ${total}/100` : doneCount(rec) ? ` · ${L('a medias', 'in progress')}` : ''}`;
        return open ? (
          <a
            key={date}
            href={`#/reto/${date}`}
            className={cx('d-cal-day', date === now && 'today', date === current && 'on', done && (total >= 70 ? 'hi' : total >= 40 ? 'mid' : 'lo'), !done && doneCount(rec) > 0 && 'part')}
            title={label}
            aria-label={label}
          >
            <span>{Number(date.slice(8))}</span>
            {done ? <b>{total}</b> : <Flag code={c?.fl} size="sm" />}
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
// The card on the home page
// ---------------------------------------------------------------------------

export function DailyCard({ world }: { world: World }) {
  const daily = useStore((s) => s.daily);
  const bestStreak = useStore((s) => s.best['daily:streak'] ?? 0);
  const date = today();
  const pool = useMemo(() => dailyPool(world.index), [world]);
  const country = countryOfDay(pool, dayNumber(date));
  const rec = daily[date];
  const done = doneCount(rec);
  const streak = streakOf(daily, date);
  const level = levelOf(country);
  const fem = isFeminine(level.sg);
  const left = useCountdown();
  return (
    <section className="d-card" aria-labelledby="d-card-title">
      <div className="d-card-main">
        <p className="kicker">
          {L('Reto del día', 'Daily challenge')} · {fmtWeekday(date)}, {fmtDay(date)}
        </p>
        <h2 id="d-card-title">
          <Flag code={country.fl} size="lg" />
          <span>
            {L('Hoy toca', 'Today:')} <em>{nm(country.n)}</em>
          </span>
        </h2>
        <p className="d-card-text">
          {L(
            `Cinco pruebas cortas, las mismas para todo el mundo: adivina ${fem ? 'una' : 'uno'} de sus ${level.n} ${level.es} por la silueta, señala ${fem ? 'otras' : 'otros'} cinco en el mapa, une dos países, acierta un país por su población y responde a cinco banderas y capitales.`,
            `Five short tests, the same for everybody: guess one of its ${level.n} ${level.en} from its outline, find five more on the map, join two countries, guess a country from its population and answer five flags and capitals.`,
          )}
        </p>
        <ol className="d-steps" aria-label={L('Pruebas de hoy', "Today's tests")}>
          {Array.from({ length: TESTS }, (_, i) => {
            const p = rec?.p[i];
            return (
              <li key={i} className={cx(p != null && 'done')}>
                <i>{p != null ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : i + 1}</i>
                {testName(i)}
                {p != null && <b>{p}</b>}
              </li>
            );
          })}
        </ol>
      </div>
      <div className="d-card-side">
        {rec?.t ? (
          <p className="d-card-score">
            <strong>{totalOf(rec)}</strong>
            <span>/ 100</span>
          </p>
        ) : null}
        <button type="button" className="btn btn-accent btn-lg" onClick={() => go('reto')}>
          {rec?.t ? <CalendarDays size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
          {rec?.t ? L('Ver mi resultado', 'See my result') : done ? L(`Seguir: prueba ${done + 1} de ${TESTS}`, `Continue: test ${done + 1} of ${TESTS}`) : L('Jugar el reto de hoy', "Play today's challenge")}
        </button>
        <p className="d-card-meta">
          <span className={cx('d-streak', streak > 0 && 'on')} title={L(`Tu mejor racha: ${bestStreak}`, `Your best streak: ${bestStreak}`)}>
            <Flame size={15} aria-hidden="true" />
            {streak === 0 ? L('Empieza hoy tu racha', 'Start your streak today') : streak === 1 ? L('1 día seguido', '1 day in a row') : L(`${streak} días seguidos`, `${streak} days in a row`)}
          </span>
          {rec?.t ? <span>{L(`Nuevo reto en ${left}`, `Next challenge in ${left}`)}</span> : null}
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// The challenge itself
// ---------------------------------------------------------------------------

export function Daily({ world, date }: { world: World; date: string }) {
  const rec = useStore((s) => s.daily[date]);
  const daily = useStore((s) => s.daily);
  const bestStreak = useStore((s) => s.best['daily:streak'] ?? 0);
  const setDaily = useStore((s) => s.setDaily);
  const start = useStore((s) => s.start);
  const opts = useStore((s) => s.opts);
  const now = today();
  const pool = useMemo(() => dailyPool(world.index), [world]);
  const country = useMemo(() => countryOfDay(pool, dayNumber(date)), [pool, date]);
  const level = levelOf(country);
  const fem = isFeminine(level.sg);
  const done = doneCount(rec);
  const next = rec ? rec.p.findIndex((x) => x == null) : 0;
  /** The test on screen. Its result is stored as soon as it is decided, so it stays here until the player moves on. */
  const [at, setAt] = useState(-1);
  const [view, setView] = useState<'intro' | 'study' | 'test' | 'summary'>(() => (done === TESTS ? 'summary' : 'intro'));
  const [regions, setRegions] = useState<Deck | null>(null);
  const [globe, setGlobe] = useState<Deck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [copied, setCopied] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const map = useRef<MapHandle>(null);
  const shareBox = useRef<HTMLTextAreaElement>(null);
  const left = useCountdown();
  const onExit = () => go('');

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
  const which = useMemo(() => whichTarget(date, world.index, country.id), [date, world, country]);
  const quick = useMemo(() => quickQuestions(date, world.index, [country.id, which.id]), [date, world, country, which]);
  const guessable = useMemo(() => worldPool(world.index), [world]);
  // Handy when debugging from the browser console; removed from production builds.
  if (import.meta.env.DEV) (window as unknown as { __daily?: unknown }).__daily = { country: country.id, targets, which: which.id, quick, regions };

  const score = (test: number) => (points: number, figure: number) => setDaily(date, test, points, figure);
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
    const text = shareText(date, country, rec);
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
    const streak = streakOf(daily, now);
    return shell(
      <div className="pop d-summary">
        <div className="d-head">{header}</div>
        <p className="d-total">
          <strong>{total}</strong>
          <span>/ 100</span>
        </p>
        <p className="d-verdict">{verdictOf(total)}</p>
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
        <p className="d-streakline">
          <span className={cx('d-streak', streak > 0 && 'on')}>
            <Flame size={16} aria-hidden="true" />
            {streak === 1 ? L('1 día seguido', '1 day in a row') : L(`${streak} días seguidos`, `${streak} days in a row`)}
          </span>
          <span>{L(`Mejor racha: ${bestStreak}`, `Best streak: ${bestStreak}`)}</span>
          {rec.late ? <span>{L('Jugado después de su día: no cuenta para la racha.', 'Played after its day: it does not count for the streak.')}</span> : !past ? <span>{L(`Nuevo reto en ${left}`, `Next challenge in ${left}`)}</span> : null}
        </p>
        <div className="d-share">
          <textarea ref={shareBox} readOnly rows={4} value={shareText(date, country, rec)} aria-label={L('Texto para compartir', 'Text to share')} onFocus={(e) => e.currentTarget.select()} />
          <button type="button" className="btn btn-primary" onClick={share}>
            {copied ? <Check size={16} aria-hidden="true" /> : 'share' in navigator ? <Share2 size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
            {copied ? L('Copiado', 'Copied') : L('Compartir resultado', 'Share the result')}
          </button>
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
    if (at === 0) return <RegionleTest key={0} deck={regions} target={targets.mystery} shape={shape} step={step} onScore={score(0)} onDone={advance} />;
    if (at === 1) return <PinFive key={1} deck={regions} targets={targets.pins} step={step} onScore={score(1)} onDone={advance} />;
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
            points: (extra, lost) => (
              <p className="d-points">
                +{routePoints(extra, lost)} {L('puntos', 'points')}
              </p>
            ),
          }}
        />
      );
    }
    if (at === 3) return <WhichTest key={3} target={which} countries={guessable} continent={nm(world.index.continents[which.ct])} step={step} onScore={score(3)} onDone={advance} />;
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
      <ol className="d-list">
        {[
          L(`Adivina ${fem ? 'una' : 'uno'} de sus ${level.es} por la silueta, en seis intentos.`, `Guess one of its ${level.en} from its outline, in six tries.`),
          L('Señala cinco en el mapa.', 'Find five of them on the map.'),
          L('Une dos países del mundo por el camino más corto.', 'Join two countries of the world by the shortest way.'),
          L('Adivina un país por su población.', 'Guess a country from its population.'),
          L('Cinco preguntas rápidas de banderas y capitales.', 'Five quick questions about flags and capitals.'),
        ].map((text, i) => {
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
    </div>,
  );
}
