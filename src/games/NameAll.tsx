/** Name them all: type every item from memory while the map fills in. */
import { Flag as FlagIcon, Lightbulb } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnswerInput } from '../components/AnswerInput';
import { MapView, type MapHandle, type Paint } from '../components/MapView';
import { Flag } from '../components/ui';
import { L, nm } from '../lib/i18n';
import { MODE_NAME } from '../lib/modes';
import { useStore } from '../lib/store';
import { Matcher, fmtTime, nf, pick } from '../lib/text';
import type { Res } from '../lib/types';
import { GameShell, Hud, Results, originOf, useElapsed, type GameProps, type ResultRow } from './common';

export function NameAllGame({ deck, cfg, onExit, onAgain }: GameProps) {
  const matcher = useMemo(() => new Matcher(deck.items), [deck]);
  const [found, setFound] = useState<string[]>([]);
  const [helped, setHelped] = useState<string[]>([]);
  const [over, setOver] = useState(false);
  const [hintId, setHintId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [shake, setShake] = useState(0);
  const [clear, setClear] = useState(0);
  const [flash, setFlash] = useState<{ id: string; kind: 'bad' | 'ok'; n: number } | null>(null);
  const [record, setRecord] = useState<'new' | number | null>(null);
  const map = useRef<MapHandle>(null);
  const total = deck.items.length;
  const done = over || found.length === total;
  const ms = useElapsed(!done);
  const foundSet = useMemo(() => new Set(found), [found]);
  const store = useStore;
  const fem = deck.noun.fem;
  const title = MODE_NAME.nameall;

  const accept = (ids: string[]) => {
    const fresh = ids.filter((id) => !foundSet.has(id));
    if (!fresh.length) return false;
    setFound((f) => [...f, ...fresh]);
    if (hintId && fresh.includes(hintId)) {
      setHelped((h) => [...h, hintId]);
      setHintId(null);
    }
    setFlash({ id: fresh[0], kind: 'ok', n: Date.now() });
    setNote(null);
    setPending(false);
    setClear((n) => n + 1);
    return true;
  };

  /** Accepts a name as soon as it is complete, unless it is the beginning of another missing name. */
  const onType = (text: string) => {
    if (done) return false;
    const ids = matcher.lookup(text).filter((id) => !foundSet.has(id));
    if (!ids.length) {
      setPending(false);
      return false;
    }
    const others = new Set(deck.items.filter((it) => !foundSet.has(it.id) && !ids.includes(it.id)).map((it) => it.id));
    if (matcher.isPrefixOf(text, others)) {
      setPending(true);
      return false;
    }
    return accept(ids);
  };

  const onSubmit = (text: string) => {
    if (done) return;
    const ids = matcher.find(text);
    if (accept(ids)) return;
    setShake((n) => n + 1);
    setNote(ids.length ? L(`${deck.byId.get(ids[0])!.name}: ya ${fem ? 'la' : 'lo'} tienes.`, `${deck.byId.get(ids[0])!.name}: you already have it.`) : L('No coincide con nada de este mapa.', 'It matches nothing on this map.'));
  };

  const hint = () => {
    const missing = deck.items.filter((it) => !foundSet.has(it.id));
    if (!missing.length) return;
    const it = pick(missing);
    setHintId(it.id);
    map.current?.focus([it.id]);
  };

  // Save the session once it ends.
  useEffect(() => {
    if (!done) return;
    map.current?.reset();
    // Giving up before writing a single name says nothing about what the player knows.
    if (!found.length) return;
    const st = store.getState();
    const helpedSet = new Set(helped);
    for (const it of deck.items) st.record('name', it.id, foundSet.has(it.id) ? (helpedSet.has(it.id) ? 'warn' : 'ok') : 'bad', originOf(it, cfg));
    st.addSession({ t: Date.now(), section: cfg.section, mode: cfg.mode, label: deck.title, total, ok: found.length - helped.length, warn: helped.length, bad: total - found.length, ms });
    if (found.length === total) {
      const prev = st.best[`nameall:${deck.key}`];
      setRecord(st.setBest(`nameall:${deck.key}`, ms, true) ? 'new' : (prev ?? null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const paint = useMemo(() => {
    const p: Record<string, Paint> = {};
    const helpedSet = new Set(helped);
    for (const id of found) p[id] = helpedSet.has(id) ? 'warn' : 'ok';
    if (done) for (const it of deck.items) if (!foundSet.has(it.id)) p[it.id] = 'bad';
    if (hintId && !done) p[hintId] = 'target';
    return p;
  }, [found, helped, done, hintId, deck, foundSet]);

  const perCountry = useMemo(() => {
    if ((deck.scope !== 'regions' && deck.scope !== 'cities') || deck.countries.length < 2) return [];
    return deck.countries
      .map((c) => {
        const items = deck.items.filter((it) => it.country.id === c.id);
        return { c, total: items.length, got: items.filter((it) => foundSet.has(it.id)).length, ids: items.map((it) => it.id) };
      })
      .sort((a, b) => b.total - b.got - (a.total - a.got));
  }, [deck, foundSet]);

  const stage = (
    <MapView ref={map} deck={deck} paint={paint} labels={done ? 'all' : foundSet} flash={flash} tip={(id) => (done || foundSet.has(id) ? deck.byId.get(id)?.name : null)} />
  );

  if (done) {
    const helpedSet = new Set(helped);
    const rows: ResultRow[] = deck.items.map((item) => ({ item, res: (foundSet.has(item.id) ? (helpedSet.has(item.id) ? 'warn' : 'ok') : 'bad') as Res }));
    return (
      <GameShell
        title={title}
        subtitle={deck.title}
        onExit={onExit}
        hud={<Hud ms={ms} progress={`${found.length} / ${total}`} />}
        stage={stage}
        panel={
          <Results
            title={found.length === total ? L('¡Mapa completo!', 'Map complete!') : L(`Te han faltado ${nf(total - found.length)}`, `You missed ${nf(total - found.length)}`)}
            note={record === 'new' ? L(`Nuevo récord: ${fmtTime(ms)}.`, `New record: ${fmtTime(ms)}.`) : typeof record === 'number' ? L(`Tu récord en este mapa: ${fmtTime(record)}.`, `Your record on this map: ${fmtTime(record)}.`) : undefined}
            deck={deck}
            rows={rows}
            ms={ms}
            onAgain={() => onAgain()}
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
      progress={found.length / Math.max(1, total)}
      hud={<Hud ms={ms} progress={`${found.length} / ${total}`} />}
      stage={stage}
      panel={
        <div className="q">
          <div className="q-prompt">
            <p className="kicker">{L('De memoria', 'From memory')}</p>
            <h2 className="q-ask">{L(`Escribe ${fem ? 'todas las' : 'todos los'} ${deck.noun.many}`, `Type all the ${deck.noun.many}`)}</h2>
          </div>
          <AnswerInput label={L(`Nombre de ${fem ? 'una' : 'un'} ${deck.noun.one}`, `Name of a ${deck.noun.one}`)} placeholder={L('Escribe un nombre…', 'Type a name…')} onSubmit={onSubmit} onType={onType} shake={shake} clear={clear} pending={pending} />
          <p className="q-note" role="status">
            {note ??
              (pending
                ? L('Pulsa Intro para confirmar, o sigue escribiendo.', 'Press Enter to confirm, or keep typing.')
                : hintId
                  ? L(`¿Cómo se llama ${fem ? 'la' : 'el'} que parpadea?`, 'What is the blinking one called?')
                  : L(`Sin orden: se aceptan en cuanto ${fem ? 'las' : 'los'} escribes, con o sin tildes.`, 'In any order: they are accepted as soon as you type them, with or without accents.'))}
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
            <button type="button" className="btn btn-sm" onClick={hint}>
              <Lightbulb size={15} aria-hidden="true" />
              {L('Pista', 'Hint')}
            </button>
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
