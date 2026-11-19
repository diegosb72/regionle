/**
 * Fill the map: a blank map that fills in with what the player types from memory. Names are taken in
 * any order; the player can also tap a piece first to say "this one" and then has to name that piece.
 */
import { Flag as FlagIcon, Lightbulb, MousePointerClick, Timer, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnswerInput } from '../components/AnswerInput';
import { MapView, type MapHandle, type Paint } from '../components/MapView';
import { Flag } from '../components/ui';
import { L, nm } from '../lib/i18n';
import { MODE_NAME } from '../lib/modes';
import { useStore } from '../lib/store';
import { Matcher, shortNote } from '../lib/matcher';
import { cx, fmtTime, hintMax, letterHint, nf, pick } from '../lib/text';
import type { Res } from '../lib/types';
import { GameShell, Hud, Results, originOf, useElapsed, useFlashSignal, type GameProps, type ResultRow } from './common';

export function NameAllGame({ deck, cfg, onExit, onAgain }: GameProps) {
  const matcher = useMemo(() => new Matcher(deck.items), [deck]);
  /** What has to be filled in: the whole map, or the pieces of a custom list. */
  const pool = useMemo(() => (cfg.only ? deck.items.filter((it) => cfg.only!.includes(it.id)) : deck.items), [deck, cfg.only]);
  const inPool = useMemo(() => new Set(pool.map((it) => it.id)), [pool]);
  /**
   * Something to fill in can be typed by a short form: worth telling. They are the initials of the names of
   * several words where the rule gives them, and otherwise what each piece has in the settings: the list
   * the game ships with for it, and what the player has added.
   */
  const short = useMemo(() => {
    const kinds = matcher.shortKinds(inPool);
    const initials = L('por sus siglas si el nombre tiene varias palabras', 'by their initials when the name has several words');
    const other = L('por las abreviaturas y variantes que tienen en Configuración', 'by the short forms and variants they have in Settings');
    // A map may have both: provinces the list speaks of, next to others it does not.
    if (kinds.initials && kinds.other) return L(`, ${initials} y ${other}`, `, ${initials} and ${other}`);
    return kinds.initials ? L(`, y ${initials}`, `, and ${initials}`) : kinds.other ? L(`, y ${other}`, `, and ${other}`) : null;
  }, [matcher, inPool]);
  const [found, setFound] = useState<string[]>([]);
  /** Named with a letter of help, or after a wrong name for the piece that was marked. */
  const [helped, setHelped] = useState<string[]>([]);
  /** Given up one by one: their names are on the map, but they count as missed. */
  const [shown, setShown] = useState<string[]>([]);
  const [over, setOver] = useState(false);
  /** The piece the player has marked to fill in next, and how many letters of its name are shown. */
  const [target, setTarget] = useState<string | null>(null);
  const [letters, setLetters] = useState(0);
  const [slipped, setSlipped] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [shake, setShake] = useState(0);
  const [clear, setClear] = useState(0);
  const [flash, setFlash] = useState<{ id: string; kind: 'bad' | 'ok'; n: number } | null>(null);
  useFlashSignal(flash);
  const [record, setRecord] = useState<'new' | number | null>(null);
  const map = useRef<MapHandle>(null);
  const total = pool.length;
  const done = over || found.length + shown.length === total;
  const ms = useElapsed(!done);
  /** Against a countdown, for those who asked for one: what is not written when it runs out stays blank. */
  const limit = cfg.review ? 0 : Math.max(0, cfg.opts.countdown ?? 0) * 1000;
  const left = Math.max(0, limit - ms);
  const [timeUp, setTimeUp] = useState(false);
  useEffect(() => {
    if (limit && !done && ms >= limit) {
      setTimeUp(true);
      setOver(true);
    }
  }, [limit, done, ms]);
  const clock = limit ? (
    <span className={cx('hud-chip hud-clock', !done && left <= 10_000 && 'low')} title={L('Tiempo que queda', 'Time left')} role="timer">
      <Timer size={14} aria-hidden="true" />
      {fmtTime(done ? ms : left + 999)}
    </span>
  ) : null;
  const foundSet = useMemo(() => new Set(found), [found]);
  const shownSet = useMemo(() => new Set(shown), [shown]);
  const filled = (id: string) => foundSet.has(id) || shownSet.has(id);
  const store = useStore;
  const fem = deck.noun.fem;
  const title = MODE_NAME.nameall;
  const targetItem = target ? deck.byId.get(target) : undefined;
  // Handy when debugging from the browser console; removed from production builds.
  if (import.meta.env.DEV) (window as unknown as { __ask?: string }).__ask = done ? undefined : (target ?? undefined);

  const release = () => {
    setTarget(null);
    setLetters(0);
    setSlipped(false);
    // If the map went to find a piece picked for the player, it comes back to where they were.
    map.current?.restore();
  };

  const accept = (ids: string[]) => {
    const fresh = ids.filter((id) => inPool.has(id) && !filled(id));
    if (!fresh.length) return false;
    setFound((f) => [...f, ...fresh]);
    if (target && fresh.includes(target)) {
      if (letters > 0 || slipped) setHelped((h) => [...h, target]);
      release();
    }
    setFlash({ id: fresh[0], kind: 'ok', n: Date.now() });
    setNote(null);
    setPending(false);
    setClear((n) => n + 1);
    return true;
  };

  /**
   * Accepts a name as soon as it is complete, unless it is the beginning of another missing name, and an
   * abbreviation unless a name of the map could be starting with it. Not when a piece is marked: "what is
   * this one called?" is a question, and its answer is sent with Enter and judged, or typing names until
   * one sticks would cost nothing.
   */
  const onType = (text: string) => {
    if (done || target) return false;
    // What was said of the last thing sent is not about what is typed now: it would hide that Enter is awaited.
    if (note) setNote(null);
    const { ids, wait } = matcher.typed(text, new Set(pool.filter((it) => !filled(it.id)).map((it) => it.id)));
    setPending(wait);
    return !wait && ids.length > 0 && accept(ids);
  };

  const onSubmit = (text: string) => {
    if (done) return;
    if (target && targetItem) {
      // Letters of the name in sight would spell its abbreviation out: the name has to be written.
      const v = matcher.check(text, target, { whole: letters > 0 });
      if (v.res === 'yes') {
        accept([target]);
        return;
      }
      setShake((n) => n + 1);
      if (v.res === 'short' || v.res === 'vague') {
        // Not a wrong name: an abbreviation that does not count here, and why.
        setNote(shortNote(v.res, text));
        return;
      }
      setSlipped(true);
      setFlash({ id: target, kind: 'bad', n: Date.now() });
      setNote(v.res === 'other' ? L(`No es ${deck.byId.get(v.id)!.name}.`, `It is not ${deck.byId.get(v.id)!.name}.`) : L('No es correcto.', 'That is not right.'));
      return;
    }
    const ids = matcher.find(text);
    if (accept(ids)) return;
    setShake((n) => n + 1);
    const first = ids[0] ? deck.byId.get(ids[0])! : null;
    setNote(
      !first
        ? matcher.vague(text)
          ? // With several countries on the map, pointing at the piece says which one is meant.
            shortNote('vague', text) + (matcher.byCountry(text) ? L(' Si tocas antes la pieza en el mapa, vale la abreviatura de su país.', ' If you tap the piece on the map first, the short form of its country counts.') : '')
          : L('No coincide con nada de este mapa.', 'It matches nothing on this map.')
        : !inPool.has(first.id)
          ? cfg.list
            ? L(`${first.name} no está en tu lista.`, `${first.name} is not on your list.`)
            : L(`${first.name} no entra en este repaso: ya ${fem ? 'la' : 'lo'} tenías.`, `${first.name} is not part of this review: you already had it.`)
          : L(`${first.name}: ya ${fem ? 'la' : 'lo'} tienes.`, `${first.name}: you already have it.`),
    );
  };

  const mark = (id: string, move: boolean) => {
    setTarget(id);
    setLetters(0);
    setSlipped(false);
    setNote(null);
    setPending(false);
    setClear((n) => n + 1);
    if (move) map.current?.focus([id], { passing: true });
  };

  const onPick = (id: string) => {
    if (done) return;
    if (id === target) return release();
    const it = deck.byId.get(id);
    if (!it) return;
    if (!inPool.has(id)) return setNote(cfg.list ? L(`${fem ? 'Esa' : 'Ese'} no está en tu lista.`, 'That one is not on your list.') : L(`${fem ? 'Esa' : 'Ese'} no entra en este repaso.`, 'That one is not part of this review.'));
    if (filled(id)) return setNote(L(`${it.name}: ya ${fem ? 'la' : 'lo'} tienes.`, `${it.name}: you already have it.`));
    mark(id, false);
  };

  /** Marks a missing piece for the player. */
  const pickOne = () => {
    const missing = pool.filter((it) => !filled(it.id));
    if (missing.length) mark(pick(missing).id, true);
  };

  const reveal = () => {
    if (!target) return;
    setShown((s) => [...s, target]);
    setFlash({ id: target, kind: 'bad', n: Date.now() });
    setNote(L(`Era ${targetItem?.name}.`, `It was ${targetItem?.name}.`));
    release();
    setClear((n) => n + 1);
  };

  // Save the session once it ends.
  useEffect(() => {
    if (!done) return;
    map.current?.reset();
    // Giving up before writing a single name says nothing about what the player knows.
    if (!found.length && !shown.length) return;
    const st = store.getState();
    const helpedSet = new Set(helped);
    for (const it of pool) {
      // What the clock left blank was not reached, which is not the same as not knowing it: it stays as it was for the review.
      if (timeUp && !foundSet.has(it.id) && !shownSet.has(it.id)) continue;
      st.record('name', it.id, foundSet.has(it.id) ? (helpedSet.has(it.id) ? 'warn' : 'ok') : 'bad', originOf(it, cfg));
    }
    st.addSession({ t: Date.now(), section: cfg.section, mode: cfg.mode, label: cfg.list ? `${deck.title} · ${cfg.list}` : deck.title, total, ok: found.length - helped.length, warn: helped.length, bad: total - found.length, ms });
    if (found.length === total && !cfg.only) {
      const prev = st.best[`nameall:${deck.key}`];
      setRecord(st.setBest(`nameall:${deck.key}`, ms, true) ? 'new' : (prev ?? null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const paint = useMemo(() => {
    const p: Record<string, Paint> = {};
    const helpedSet = new Set(helped);
    if (cfg.only) for (const it of deck.items) if (!inPool.has(it.id)) p[it.id] = 'dim';
    for (const id of found) p[id] = helpedSet.has(id) ? 'warn' : 'ok';
    for (const id of shown) p[id] = 'bad';
    if (done) for (const it of pool) if (!foundSet.has(it.id)) p[it.id] = 'bad';
    if (target && !done) p[target] = 'target';
    return p;
  }, [found, helped, shown, done, target, deck, pool, inPool, foundSet, cfg.only]);

  const labels = useMemo(() => new Set([...found, ...shown]), [found, shown]);

  const perCountry = useMemo(() => {
    if ((deck.scope !== 'regions' && deck.scope !== 'cities') || deck.countries.length < 2) return [];
    return deck.countries
      .map((c) => {
        const items = pool.filter((it) => it.country.id === c.id);
        return { c, total: items.length, got: items.filter((it) => foundSet.has(it.id) || shownSet.has(it.id)).length, ids: items.map((it) => it.id) };
      })
      .filter((x) => x.total > 0)
      .sort((a, b) => b.total - b.got - (a.total - a.got));
  }, [deck, pool, foundSet, shownSet]);

  const stage = (
    <MapView
      ref={map}
      deck={deck}
      paint={paint}
      labels={done ? 'all' : labels}
      flash={flash}
      pickable={!done}
      onPick={onPick}
      tip={(id) => (done || filled(id) ? deck.byId.get(id)?.name : null)}
    />
  );

  if (done) {
    const helpedSet = new Set(helped);
    const rows: ResultRow[] = pool.map((item) => ({ item, res: (foundSet.has(item.id) ? (helpedSet.has(item.id) ? 'warn' : 'ok') : 'bad') as Res }));
    return (
      <GameShell
        title={title}
        subtitle={deck.title}
        onExit={onExit}
        hud={<Hud ms={ms} progress={`${found.length} / ${total}`} />}
        stage={stage}
        panel={
          <Results
            title={
              found.length === total
                ? L('¡Mapa completo!', 'Map complete!')
                : timeUp
                  ? L(`Se acabó el tiempo: ${nf(found.length)} de ${nf(total)}`, `Time is up: ${nf(found.length)} of ${nf(total)}`)
                  : L(`Te han faltado ${nf(total - found.length)}`, `You missed ${nf(total - found.length)}`)
            }
            note={record === 'new' ? L(`Nuevo récord: ${fmtTime(ms)}.`, `New record: ${fmtTime(ms)}.`) : typeof record === 'number' ? L(`Tu récord en este mapa: ${fmtTime(record)}.`, `Your record on this map: ${fmtTime(record)}.`) : undefined}
            deck={deck}
            rows={rows}
            ms={ms}
            focus={false}
            onAgain={() => onAgain({ only: cfg.only, list: cfg.list })}
            onReview={(ids) => onAgain({ only: ids, list: undefined })}
            onExit={onExit}
          />
        }
      />
    );
  }

  const last = found.slice(-8).reverse();
  return (
    <GameShell
      title={title}
      subtitle={deck.title}
      onExit={onExit}
      progress={limit ? ms / limit : (found.length + shown.length) / Math.max(1, total)}
      hud={
        limit ? (
          <>
            <span className="hud-chip hud-main">{`${found.length} / ${total}`}</span>
            {clock}
          </>
        ) : (
          <Hud ms={ms} progress={`${found.length} / ${total}`} />
        )
      }
      stage={stage}
      panel={
        <div className="q">
          <div className="q-prompt">
            <p className="kicker">{targetItem ? L(`${fem ? 'La' : 'El'} que has marcado`, 'The one you marked') : L('De memoria', 'From memory')}</p>
            <h2 className="q-ask">
              {targetItem
                ? L(`¿Cómo se llama ${fem ? 'esta' : 'este'} ${deck.noun.one}?`, `What is this ${deck.noun.one} called?`)
                : cfg.only
                  ? cfg.list
                    ? L(`Rellena ${fem ? 'las' : 'los'} ${nf(total)} de tu lista`, `Fill in the ${nf(total)} on your list`)
                    : L(`Rellena ${fem ? 'las' : 'los'} ${nf(total)} que te faltaron`, `Fill in the ${nf(total)} you missed`)
                  : L(`Rellena ${fem ? 'todas las' : 'todos los'} ${deck.noun.many}`, `Fill in all the ${deck.noun.many}`)}
            </h2>
          </div>
          <AnswerInput
            label={L(`Nombre de ${fem ? 'una' : 'un'} ${deck.noun.one}`, `Name of a ${deck.noun.one}`)}
            placeholder={targetItem ? L('Escribe su nombre…', 'Type its name…') : L('Escribe un nombre…', 'Type a name…')}
            onSubmit={onSubmit}
            onType={onType}
            shake={shake}
            clear={clear}
            pending={pending}
          />
          {targetItem && letters > 0 && <p className="q-letters">{letterHint(targetItem.name, letters)}</p>}
          <p className="q-note" role="status">
            {note ??
              (pending
                ? L('Pulsa Intro para confirmar, o sigue escribiendo.', 'Press Enter to confirm, or keep typing.')
                : targetItem
                  ? L(`Escribe el nombre ${fem ? 'de la' : 'del'} que has marcado y pulsa Intro. Tócal${fem ? 'a' : 'o'} otra vez para soltarl${fem ? 'a' : 'o'}.`, 'Type the name of the one you marked and press Enter. Tap it again to let it go.')
                  : L(
                      `Sin orden: se aceptan en cuanto ${fem ? 'las' : 'los'} escribes, con o sin tildes${short ?? ''}. Si prefieres elegir tú, toca en el mapa ${fem ? 'la' : 'el'} que quieras rellenar.`,
                      `In any order: they are accepted as soon as you type them, with or without accents${short ?? ''}. If you would rather choose, tap the one you want to fill in on the map.`,
                    ))}
          </p>
          {last.length > 0 && (
            <ul className="found">
              {last.map((id) => (
                <li key={id}>{deck.byId.get(id)!.name}</li>
              ))}
              {found.length > last.length && <li className="more">+{found.length - last.length}</li>}
            </ul>
          )}
          {perCountry.length > 0 && (
            <ul className="tally">
              {perCountry.map(({ c, total: t, got, ids }) => (
                <li key={c.id}>
                  <button type="button" className={got === t ? 'full' : undefined} onClick={() => map.current?.focus(ids, { force: true, fill: 0.85 })} title={L(`Ver ${nm(c.n)} en el mapa`, `Show ${nm(c.n)} on the map`)}>
                    <Flag code={c.fl} size="sm" />
                    <span>{nm(c.n)}</span>
                    <b>
                      {got}/{t}
                    </b>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="q-actions">
            {targetItem ? (
              <>
                <button type="button" className="btn btn-sm" onClick={() => setLetters((n) => Math.min(hintMax(targetItem.name), n + 1))} disabled={letters >= hintMax(targetItem.name)}>
                  <Lightbulb size={15} aria-hidden="true" />
                  {L('Una letra', 'A letter')}
                </button>
                <button type="button" className="btn btn-sm" onClick={reveal}>
                  {L('No lo sé', "I don't know")}
                </button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={release}>
                  <X size={15} aria-hidden="true" />
                  {L('Soltar', 'Let go')}
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-sm" onClick={pickOne} title={L(`Marca en el mapa ${fem ? 'una de las' : 'uno de los'} que faltan`, 'Marks one of the missing ones on the map')}>
                <MousePointerClick size={15} aria-hidden="true" />
                {L(`Elige ${fem ? 'una' : 'uno'} por mí`, 'Pick one for me')}
              </button>
            )}
            <button type="button" className="btn btn-sm btn-ghost q-end" onClick={() => setOver(true)}>
              <FlagIcon size={15} aria-hidden="true" />
              {L('Me rindo', 'I give up')}
            </button>
          </div>
        </div>
      }
    />
  );
}
