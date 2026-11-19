/** Setup: 1 what to play with, 2 mode, 3 options. */
import { Check, ChevronDown, Infinity as InfinityIcon, ListChecks, ListPlus, Pencil, Play, Printer, Share2, Target, Timer, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { GoalBar } from '../components/GoalBar';
import { Picker } from '../components/Picker';
import { canSpeak } from '../components/Speak';
import { Flag, Seg, Toggle, capitalise } from '../components/ui';
import { eligible, levelOf, loadFile, type World } from '../lib/data';
import { countriesOf, describeMap } from '../lib/describe';
import { CITY_COUNTS, PHYS_KINDS, PHYS_PLACES, kindNoun, kindsIn, loadCities, loadPhysical, parsePhys, physCountries, physMatches, physTokens, pickOf, type PhysKind, type PhysSpec } from '../lib/extra';
import { L, getLang, levelNoun, nm } from '../lib/i18n';
import { encodeList, listConfig, listPlayable, listUrl } from '../lib/lists';
import { GROUP_NAME, MODES, MODE_GROUPS, SECTIONS, cardAskName, formatName } from '../lib/modes';
import { estimateOf, minutesOf, paceOf, percentOf, questionsOf } from '../lib/pace';
import { FIGURE_MODES, FORMAT_MODES, LENGTH_MODES, ROUND_MODES, TOP_MIN, asksByFlag, turnsOutlines } from '../lib/rules';
import { go } from '../lib/router';
import { useStore, type CardAsk, type CustomList, type Length, type Opts } from '../lib/store';
import { cx, nf, plural } from '../lib/text';
import { SAMPLES, settingsLink } from '../lib/typeinList';
import { SHIPPED_AUTO, inForce } from '../lib/typeins';
import type { Country, Mode, Section } from '../lib/types';

/** Seconds to fill a map in, for those who want a countdown; 0 is none. */
const COUNTDOWNS = [0, 120, 300, 600, 900];

const levelName = (n: number): string => [L('Fácil', 'Easy'), L('Medio', 'Medium'), L('Difícil', 'Hard')][n - 1];
const ANSWER_MODES: Mode[] = ['learn', 'identify', 'outline', 'capital', 'flag', 'parent', 'mix'];
/** Games that are one round of everything: they cannot go on for ever. */
const FINITE_MODES: Mode[] = ['neighbours', 'blind', 'hotcold', 'bearing', 'group', 'whoami', 'cards'];
/** Games where names are typed and a list of suggestions can help. */
const SUGGEST_MODES: Mode[] = ['travel', 'neighbours', 'chain', 'whoami', 'regionle', 'which', 'topten'];
/** Games that stop on a missed answer long enough to read about it. */
const WIKI_MODES: Mode[] = ['explore', 'pin', 'identify', 'outline', 'regionle', 'puzzle', 'neighbours', 'capital', 'flag', 'whoami', 'blind', 'hotcold', 'bearing', 'mix', 'listen'];

type Cities = Awaited<ReturnType<typeof loadCities>>;
type Physical = Awaited<ReturnType<typeof loadPhysical>>;
type Capitals = Record<string, Record<string, Record<string, string[]>>>;

/** The country whose physical map comes first among the countries: the one this game was made for. */
const PHYS_HOME = 'ES';

/** What a physical map is made of: kinds of feature, where (continents, or one country) and how many. */
function PhysPicker({ spec, file, world, onChange }: { spec: PhysSpec; file: Physical | null; world: World; onChange(spec: PhysSpec): void }) {
  const list = file ? file.f.filter((f) => physMatches(f, spec)) : [];
  /** Countries with enough to ask about for a map of their own, by name. */
  const lands = useMemo(() => {
    if (!file) return [];
    const count = physCountries(file.f);
    return [...count]
      .map(([id, n]) => ({ c: world.byId.get(id), n }))
      .filter((x): x is { c: Country; n: number } => !!x.c)
      .sort((a, b) => nm(a.c.n).localeCompare(nm(b.c.n), getLang()));
  }, [file, world]);
  const home = lands.find((x) => x.c.id === PHYS_HOME);
  const toggleKind = (k: PhysKind) => {
    const kinds = spec.kinds.includes(k) ? spec.kinds.filter((x) => x !== k) : [...spec.kinds, k];
    if (kinds.length) onChange({ ...spec, kinds: PHYS_KINDS.filter((x) => kinds.includes(x)) });
  };
  const togglePlace = (p: string) => {
    if (p === 'W') return onChange({ ...spec, places: [], country: undefined });
    onChange({ ...spec, country: undefined, places: spec.places.includes(p) ? spec.places.filter((x) => x !== p) : [...spec.places, p] });
  };
  const setCountry = (id: string) => onChange({ ...spec, places: [], country: id || undefined });
  return (
    <div className="phys">
      <div className="frow">
        <span className="frow-label">{L('Qué', 'What')}</span>
        <div className="frow-chips">
          {PHYS_KINDS.map((k) => {
            const on = spec.kinds.includes(k);
            // What the kind brings by itself: the oceans count with the continents and with the seas alike.
            const shown = file ? file.f.filter((f) => physMatches(f, { ...spec, kinds: [k] })).length : null;
            // A kind the place has none of is not offered: there are no deserts in Europe, and the continents
            // are only asked on the map of the whole world.
            if (file && !on && !file.f.some((f) => physMatches(f, { ...spec, kinds: [k], all: true }))) return null;
            return (
              <button key={k} type="button" aria-pressed={on} className={cx('chip', `chip-${k}`, on && 'on')} onClick={() => toggleKind(k)}>
                <i className={`kdot kdot-${k}`} aria-hidden="true" />
                {capitalise(kindNoun(k).many)}
                {shown != null && <small>{shown}</small>}
              </button>
            );
          })}
        </div>
      </div>
      <div className="frow">
        <span className="frow-label">{L('Dónde', 'Where')}</span>
        <div className="frow-chips">
          {PHYS_PLACES.map((p) => {
            const on = !spec.country && (p === 'W' ? !spec.places.length : spec.places.includes(p));
            return (
              <button key={p} type="button" aria-pressed={on} className={cx('chip', on && 'on')} onClick={() => togglePlace(p)}>
                {p === 'W' ? L('Todo el mundo', 'The whole world') : nm(world.index.continents[p])}
              </button>
            );
          })}
        </div>
      </div>
      {lands.length > 0 && (
        <div className="frow">
          <span className="frow-label">{L('O un país', 'Or a country')}</span>
          <div className="frow-chips">
            {home && (
              <button type="button" aria-pressed={spec.country === PHYS_HOME} className={cx('chip', spec.country === PHYS_HOME && 'on')} onClick={() => setCountry(spec.country === PHYS_HOME ? '' : PHYS_HOME)}>
                <Flag code={home.c.fl} size="sm" />
                {nm(home.c.n)}
                <small>{home.n}</small>
              </button>
            )}
            <label className="select phys-land">
              <span className="sr-only">{L('Otro país', 'Another country')}</span>
              <select value={spec.country && spec.country !== PHYS_HOME ? spec.country : ''} onChange={(e) => setCountry(e.target.value)}>
                <option value="">{L('Otro país…', 'Another country…')}</option>
                {lands
                  .filter((x) => x.c.id !== PHYS_HOME)
                  .map((x) => (
                    <option key={x.c.id} value={x.c.id}>
                      {nm(x.c.n)} · {x.n}
                    </option>
                  ))}
              </select>
            </label>
          </div>
        </div>
      )}
      <div className="frow">
        <span className="frow-label">{L('Cuántos', 'How many')}</span>
        <Seg
          small
          label={L('Cuántos', 'How many')}
          value={spec.all ? 'all' : 'basic'}
          onChange={(v) => onChange({ ...spec, all: v === 'all' })}
          options={[
            { value: 'basic', label: L('Los más conocidos', 'The best known') },
            { value: 'all', label: L('Todos', 'All of them') },
          ]}
        />
      </div>
      <div className="phys-list" aria-live="polite">
        {!file ? (
          <p className="tip-line">{L('Cargando…', 'Loading…')}</p>
        ) : list.length ? (
          PHYS_KINDS.filter((k) => spec.kinds.includes(k)).map((k) => {
            // Each feature under the choice that brings it: the oceans with the continents, or else with the seas.
            const own = list.filter((f) => pickOf(f, spec) === k);
            // The continents come before the oceans; the rest, by name.
            const last = (f: (typeof own)[number]) => Number(k === 'continent' && f.k === 'ocean');
            const names = [...own].sort((a, b) => last(a) - last(b) || nm(a.n).localeCompare(nm(b.n), getLang())).map((f) => nm(f.n));
            if (!names.length) return null;
            return (
              <section key={k}>
                <h3>
                  <i className={`kdot kdot-${k}`} aria-hidden="true" />
                  {capitalise(kindNoun(k).many)} <small>{names.length}</small>
                </h3>
                <p>{names.join(' · ')}</p>
              </section>
            );
          })
        ) : (
          <p className="empty">{L('No hay nada de eso ahí: prueba con «Todos» o con otro sitio.', 'There is nothing like that there: try “All of them” or another place.')}</p>
        )}
      </div>
    </div>
  );
}

/** The custom lists of a section, and the way to start a new one from the map that is chosen. */
function ListBar({ lists, canNew, onUse, onNew }: { lists: CustomList[]; canNew: boolean; onUse(id: string): void; onNew(): void }) {
  return (
    <div className="listbar">
      <span className="listbar-label">
        <ListChecks size={15} aria-hidden="true" /> {L('Listas a medida', 'Custom lists')}
      </span>
      {lists.map((l) => (
        <button key={l.id} type="button" className="chip" onClick={() => onUse(l.id)} title={L('Jugar solo con las piezas de esta lista', 'Play with just the pieces on this list')}>
          {l.name} <small>{l.ids.length}</small>
        </button>
      ))}
      <button type="button" className="chip chip-add" onClick={onNew} disabled={!canNew} title={L('Elige una a una las piezas del mapa que quieres practicar', 'Choose one by one the pieces of the map you want to practise')}>
        <ListPlus size={14} aria-hidden="true" /> {L('Nueva lista', 'New list')}
      </button>
      {!lists.length && <span className="listbar-hint">{L('solo las piezas que tú elijas: «las 12 del examen del jueves»', 'just the pieces you choose: “the 12 for Thursday’s exam”')}</span>}
    </div>
  );
}

/** The list in use: what it holds and what can be done with it. */
function ListCard({ list, others, world, onEdit, onLeave, onRemove, onUse }: { list: CustomList; others: CustomList[]; world: World; onEdit(): void; onLeave(): void; onRemove(): void; onUse(id: string): void }) {
  const [state, setState] = useState<'idle' | 'copied' | 'shown'>('idle');
  const [confirm, setConfirm] = useState(false);
  const url = useMemo(() => listUrl(encodeList(list)), [list]);
  const text = L(`Lista «${list.name}» de Regionle ∞ (${list.ids.length} piezas):`, `Regionle ∞ list “${list.name}” (${list.ids.length} pieces):`);
  const share = async () => {
    try {
      if (navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
        await navigator.share({ text, url });
        return;
      }
    } catch {
      // The share sheet was closed: fall back to copying.
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setState('copied');
    } catch {
      setState('shown');
    }
  };
  return (
    <div className="listcard">
      <p className="kicker">
        <ListChecks size={15} aria-hidden="true" /> {L('Lista a medida', 'Custom list')}
      </p>
      <h3>{list.name}</h3>
      <p className="listcard-what">
        <b>{L(`${nf(list.ids.length)} piezas`, `${nf(list.ids.length)} pieces`)}</b> · {describeMap(list, world)}
      </p>
      <p className="tip-line">{L('Los juegos preguntan solo por las piezas de la lista. El resto del mapa sigue a la vista, de contexto.', 'Games only ask about the pieces on the list. The rest of the map stays in view, as context.')}</p>
      <div className="listcard-actions">
        <button type="button" className="btn btn-sm" onClick={onEdit}>
          <Pencil size={15} aria-hidden="true" />
          {L('Editar', 'Edit')}
        </button>
        <button type="button" className="btn btn-sm" onClick={share}>
          {state === 'copied' ? <Check size={15} aria-hidden="true" /> : <Share2 size={15} aria-hidden="true" />}
          {state === 'copied' ? L('Enlace copiado', 'Link copied') : L('Compartir', 'Share')}
        </button>
        <button type="button" className="btn btn-sm" onClick={onLeave}>
          <X size={15} aria-hidden="true" />
          {L('Dejar de usarla', 'Stop using it')}
        </button>
        <button type="button" className={cx('btn btn-sm btn-ghost', confirm && 'danger')} onClick={() => (confirm ? onRemove() : setConfirm(true))} onBlur={() => setConfirm(false)}>
          <Trash2 size={15} aria-hidden="true" />
          {confirm ? L('¿Seguro? Borrar', 'Sure? Delete') : L('Borrar', 'Delete')}
        </button>
      </div>
      {state === 'shown' && <textarea className="duel-link" readOnly rows={3} value={url} aria-label={L('Enlace de la lista', 'Link to the list')} onFocus={(e) => e.currentTarget.select()} />}
      {others.length > 0 && (
        <div className="listbar">
          <span className="listbar-label">{L('Otras listas', 'Other lists')}</span>
          {others.map((l) => (
            <button key={l.id} type="button" className="chip" onClick={() => onUse(l.id)}>
              {l.name} <small>{l.ids.length}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Setup({ section, world }: { section: Section; world: World }) {
  const selected = useStore((s) => s.sel[section]);
  const typeinAuto = useStore((s) => s.typeinAuto) ?? SHIPPED_AUTO;
  const setSel = useStore((s) => s.setSel);
  const levels = useStore((s) => s.levels);
  const setLevel = useStore((s) => s.setLevel);
  const mode = useStore((s) => s.mode[section]);
  const setMode = useStore((s) => s.setMode);
  const opts = useStore((s) => s.opts);
  const setOpts = useStore((s) => s.setOpts);
  const start = useStore((s) => s.start);
  const lists = useStore((s) => s.lists);
  const listOnId = useStore((s) => s.listOn[section]);
  const sessions = useStore((s) => s.sessions);
  const setListOn = useStore((s) => s.setListOn);
  const removeList = useStore((s) => s.removeList);
  const modeRef = useRef<HTMLElement>(null);
  const meta = SECTIONS[section];
  const modes = MODES[section];
  /** Headings over the games, where there are enough of them to need telling apart. */
  const grouped = new Set(modes.map((m) => m.group)).size > 1;
  /** In the order they are read; among the figures of the countries, the number games come first: they are what the section is for. */
  const groups = (section === 'pops' ? [...MODE_GROUPS].reverse() : MODE_GROUPS).filter((g) => modes.some((m) => m.group === g));
  const def = modes.find((m) => m.id === mode) ?? modes[0];
  const [cities, setCities] = useState<Cities | null>(null);
  const [physical, setPhysical] = useState<Physical | null>(null);
  const [capitals, setCapitals] = useState<Capitals | null>(null);

  // Each section fetches only the file that says what there is to play.
  useEffect(() => {
    let alive = true;
    if (section === 'cities') loadCities().then((f) => alive && setCities(f), () => undefined);
    if (section === 'physical') loadPhysical().then((f) => alive && setPhysical(f), () => undefined);
    if (section === 'regions') loadFile<{ rc: Capitals }>('capitals.json').then((f) => alive && setCapitals(f.rc ?? {}), () => alive && setCapitals({}));
    return () => {
      alive = false;
    };
  }, [section]);

  const isPhys = section === 'physical';
  const spec = useMemo(() => parsePhys(isPhys ? selected : []), [isPhys, selected]);
  const hasCities = useMemo(() => (cities ? (c: Country) => (cities.c[c.id]?.length ?? 0) >= 2 : undefined), [cities]);
  const cityCountOf = useMemo(() => (cities ? (c: Country) => cities.c[c.id]?.length ?? 0 : undefined), [cities]);

  const chosen = useMemo(
    () =>
      isPhys
        ? []
        : selected
            .map((id) => world.byId.get(id))
            .filter((c) => c != null && eligible(section, c))
            .map((c) => c!),
    [selected, world, section, isPhys],
  );
  const mine = useMemo(() => lists.filter((l) => l.section === section), [lists, section]);
  /** The custom list in use: the game is played on its map and asks only about its pieces. */
  const active = mine.find((l) => l.id === listOnId) ?? null;
  const multi = active ? [] : chosen.filter((c) => c.lv.length > 1);

  /** Number of things the game will ask about. */
  const units = useMemo(() => {
    if (active) return active.ids.length;
    if (section === 'regions') return chosen.reduce((n, c) => n + levelOf(c, levels).n, 0);
    if (section === 'cities') {
      if (!cities) return 0;
      const all = chosen.flatMap((c) => cities.c[c.id] ?? []);
      if (opts.cityPick === 'caps') return all.filter((x) => x.k === 3).length;
      if (opts.cityPick === 'regcaps') return all.filter((x) => (x.k ?? 0) >= 1).length;
      return Math.min(opts.cityCount, all.length);
    }
    if (isPhys) return physical ? physical.f.filter((f) => physMatches(f, spec)).length : 0;
    return chosen.length;
  }, [active, section, chosen, levels, cities, physical, opts.cityPick, opts.cityCount, spec, isPhys]);

  /** The choices that bring something where they are asked: those name the map. One kept from another place does not. */
  const named = useMemo(() => {
    const found = isPhys && physical ? kindsIn(physical.f, spec) : [];
    return found.length ? found : spec.kinds;
  }, [isPhys, physical, spec]);
  const shared = section === 'regions' && chosen.length > 0 && new Set(chosen.map((c) => levelOf(c, levels).es)).size === 1 ? levelOf(chosen[0], levels) : null;
  const noun: [string, string] = active
    ? [L('pieza', 'piece'), L('piezas', 'pieces')]
    : section === 'regions'
      ? shared
        ? [levelNoun(shared).one, levelNoun(shared).many]
        : [L('región', 'region'), L('regiones', 'regions')]
      : section === 'cities'
        ? opts.cityPick === 'top'
          ? [L('ciudad', 'city'), L('ciudades', 'cities')]
          : [L('capital', 'capital'), L('capitales', 'capitals')]
        : isPhys
          ? named.length === 1
            ? [kindNoun(named[0]).one, kindNoun(named[0]).many]
            : [L('elemento', 'feature'), L('elementos', 'features')]
          : [L('país', 'country'), L('países', 'countries')];

  const capitalsReady = section !== 'regions' || def.id !== 'capital' || !capitals || chosen.some((c) => capitals[c.id]?.[levelOf(c, levels).k]);
  /** "Los diez primeros" takes a list long enough for its top to be a part of it. */
  const figMin = def.id === 'topten' ? TOP_MIN : 2;
  const need = section === 'pops' && def.id === 'topten' ? TOP_MIN : section === 'countries' || section === 'pops' ? 2 : 1;
  /** The number games need things that share a figure: among rivers and ranges there is none. */
  const noFigures = useMemo(() => {
    if (!isPhys || !physical || !FIGURE_MODES.includes(def.id)) return false;
    const list = physical.f.filter((f) => physMatches(f, spec));
    const high = list.filter((f) => (f.el ?? 0) > 0).length;
    const wide = list.filter((f) => f.el == null && (f.ar ?? 0) > 0).length;
    return high < figMin && wide < figMin;
  }, [isPhys, physical, def.id, spec, figMin]);
  /** "¿A qué pertenece?" asks for the group of each piece: it takes a country played at its finest level, with groups above it. */
  const noGroups = def.id === 'parent' && section === 'regions' && !chosen.some((c) => c.lv.length > 1 && levelOf(c, levels).k === 'f');
  /** Why a new list cannot be started from what is chosen now. */
  const noMap = isPhys ? !physical || units < 2 : chosen.length < 1 || (section === 'cities' && (!cities || units < 2));
  const unplayable = active
    ? listPlayable(def.id)
      ? null
      : L(`«${def.name}» no se juega con una lista: elige otro modo o deja la lista.`, `“${def.name}” is not played with a list: choose another mode or stop using the list.`)
    : isPhys
    ? physical && units < 2
      ? L('Elige algo con al menos dos elementos.', 'Choose something with at least two features.')
      : noFigures
        ? figMin > 2
          ? L(`Este juego pide al menos ${figMin} picos, o ${figMin} entre lagos, islas y mares.`, `This game takes at least ${figMin} peaks, or ${figMin} lakes, islands and seas.`)
          : L('Las cifras piden picos, lagos, islas o mares: al menos dos de lo mismo.', 'Figures take peaks, lakes, islands or seas: at least two of a kind.')
        : null
    : chosen.length < need
      ? need === 1
        ? L('Elige al menos un país.', 'Choose at least one country.')
        : need === 2
          ? L('Elige al menos dos países.', 'Choose at least two countries.')
          : L(`Elige al menos ${need} países.`, `Choose at least ${need} countries.`)
      : noGroups
        ? L('Pon un país con varios niveles en el más fino: provincias, departamentos.', 'Set a country with several levels to its finest one: provinces, departments.')
      : def.id === 'topten' && section !== 'pops' && units > 0 && units < TOP_MIN
        ? L(`Este juego pide un mapa con al menos ${TOP_MIN} piezas.`, `This game takes a map with at least ${TOP_MIN} pieces.`)
      : section === 'cities' && cities && units < 2
        ? opts.cityPick === 'caps'
          ? L('Para jugar con capitales de país elige al menos dos países.', 'To play with national capitals choose at least two countries.')
          : L('Ahí no hay ciudades suficientes: cambia la selección.', 'There are not enough cities there: change the selection.')
        : !capitalsReady
          ? L('No tenemos las capitales de esas regiones: prueba otro nivel u otro país.', 'We do not have the capitals of those regions: try another level or country.')
          : def.id === 'travel' && units < 4
            ? L('La ruta necesita un mapa con más piezas.', 'The route needs a map with more pieces.')
            : def.id === 'chain' && units < 3
              ? L('La cadena necesita un mapa con más piezas.', 'The chain needs a map with more pieces.')
              : null;
  /** "Oye y señala" is said by the voice of the browser: where there is none, there is no game. */
  const mute = def.id === 'listen' && !canSpeak();
  const problem = unplayable ?? (mute ? L('Este navegador no tiene voz para decir los nombres: juega a «Señalar».', 'This browser has no voice to say the names: play “Pin it”.') : null);

  const typed = ANSWER_MODES.includes(def.id) && opts.answer === 'type';
  /** Initials that are taken where they are promised, and the same in both languages. */
  const sample: keyof typeof SAMPLES = def.id === 'capital' ? (section === 'countries' ? 'countryCapitals' : 'regionCapitals') : section === 'countries' ? 'countries' : section === 'cities' ? 'cities' : 'regions';
  const sampleText = {
    regions: L('NY por Nueva York', 'NY for New York'),
    regionCapitals: L('SLC por Salt Lake City', 'SLC for Salt Lake City'),
    countries: L('NZ por Nueva Zelanda', 'NZ for New Zealand'),
    countryCapitals: L('BA por Buenos Aires', 'BA for Buenos Aires'),
    cities: L('NY por Nueva York', 'NY for New York'),
  }[sample];
  /** Initials are promised while the settings give them, and the example is given while it stands there. */
  const initials = section !== 'physical' && typeinAuto;
  const initialsSample = inForce(SAMPLES[sample].id, SAMPLES[sample].key) ? `: ${sampleText}` : '';
  /** Regions come with a list of their own for each piece instead of initials by rule. */
  const listed = sample === 'regions';
  /** The list of the settings that holds what this game asks to type. */
  const typeinsHref =
    section === 'physical'
      ? settingsLink('physical')
      : def.id === 'capital'
        ? settingsLink('capitals', section === 'regions' ? selected[0] : '')
        : section === 'regions' || section === 'cities'
          ? settingsLink(section, selected[0])
          : settingsLink('countries');
  /** Against the clock or with lives: the game has no fixed number of questions. */
  const paced = FORMAT_MODES.includes(def.id) && (opts.format === 'timed' || opts.format === 'lives');
  /** An exam: nothing is said until it is handed in. */
  const exam = FORMAT_MODES.includes(def.id) && opts.format === 'exam';
  // An exam has an end, like the games that cannot go on for ever.
  const finite = FINITE_MODES.includes(def.id) || exam;
  /** What a flashcard can ask here: a capital where the map has them, a flag where the pieces are countries. */
  const cardAsks: CardAsk[] = ['name', 'where', ...(section === 'countries' || (section === 'regions' && !!capitals && chosen.some((c) => capitals[c.id]?.[levelOf(c, levels).k])) ? (['capital'] as const) : []), ...(section === 'countries' ? (['flag'] as const) : [])];
  const cardAsk: CardAsk = cardAsks.includes(opts.cardAsk) ? opts.cardAsk : 'name';
  const show = {
    answer: ANSWER_MODES.includes(def.id),
    cardAsk: def.id === 'cards',
    // Outlines are drawn where pieces have a shape; flags are asked about where the pieces are countries.
    turned: turnsOutlines(section, def.id),
    flagLook: asksByFlag(section, def.id, { pinBy: opts.pinBy, cardAsk }),
    format: FORMAT_MODES.includes(def.id),
    // A list is asked whole, and a paced game ends when the clock or the lives say so.
    length: LENGTH_MODES.includes(def.id) && !paced && !active,
    suggest: (typed && def.id !== 'learn') || SUGGEST_MODES.includes(def.id),
    // An exam writes nothing on its map.
    labels: (def.id === 'pin' || def.id === 'identify' || def.id === 'puzzle' || def.id === 'blind' || def.id === 'hotcold' || def.id === 'mix' || def.id === 'listen') && !exam,
    pinBy: def.id === 'pin' && section === 'countries',
    blind: def.id === 'travel',
    metric: section === 'pops' && FIGURE_MODES.includes(def.id),
    axis: def.id === 'compass',
    bearingAsk: def.id === 'bearing',
    // A review and a list are filled in at their own pace.
    countdown: def.id === 'nameall',
    cities: section === 'cities' && !active,
    // Nor is there a moment for the card against the clock, or a miss to show it after in an exam.
    wiki: WIKI_MODES.includes(def.id) && !(paced && opts.format === 'timed') && !exam,
  };
  const anyOption = Object.values(show).some(Boolean);
  const endless = { value: 'endless' as Length, label: <InfinityIcon size={16} aria-label={L('Sin fin', 'Endless')} /> };

  const lengths: { value: Length; label: ReactNode; title?: string }[] =
    ROUND_MODES.includes(def.id)
      ? [{ value: 'all', label: L('10 rondas', '10 rounds') }, { value: 20, label: '20' }, { value: 50, label: '50' }, { ...endless, title: L('Sin fin', 'Endless') }]
      : def.id === 'truefalse'
        ? [{ value: 10, label: '10' }, { value: 20, label: '20' }, { value: 50, label: '50' }, { ...endless, title: L('Sin fin', 'Endless') }]
        : finite
        ? [{ value: 'all', label: L('Todo', 'All') }, { value: 10, label: '10' }, { value: 20, label: '20' }, { value: 50, label: '50' }]
        : [
            { value: 'all', label: L(`Todo (${nf(units)})`, `All (${nf(units)})`) },
            { value: 10, label: '10' },
            { value: 20, label: '20' },
            { value: 50, label: '50' },
            { ...endless, title: L('Sin fin: lo fallado vuelve a salir', 'Endless: what you miss comes back') },
          ];

  // How big the game is and how it goes for this player: the label of the mode is the same for everyone.
  const pace = useMemo(() => paceOf(sessions, section, def.id), [sessions, section, def.id]);
  const questions = problem ? null : questionsOf({ mode: def.id, units, length: finite && opts.length === 'endless' ? 'all' : opts.length, format: opts.format, list: !!active });
  const guess = problem ? null : estimateOf(def.id, questions, pace);
  // A countdown is the longest the map can take.
  const estimate = guess && def.id === 'nameall' && opts.countdown > 0 ? { ...guess, ms: Math.min(guess.ms, opts.countdown * 1000) } : guess;

  /** The map that is chosen now, as a game of the given mode. */
  const current = (mode: Mode) => {
    const picked: Record<string, string> = {};
    for (const c of chosen) picked[c.id] = levelOf(c, levels).k;
    return { section, mode, countries: isPhys ? physTokens(spec) : chosen.map((c) => c.id), levels: picked, opts };
  };
  const begin = () => {
    if (problem) return;
    start(active ? listConfig(active, def.id, opts) : current(def.id));
    go('jugar');
  };
  const newList = () => {
    if (noMap) return;
    start(current('edit'));
    go('jugar');
  };
  const editList = (list: CustomList) => {
    start({ ...listConfig(list, 'edit', opts), list: undefined, listId: list.id });
    go('jugar');
  };
  /** Countries whose flags stand for what is played. */
  const flags = active ? countriesOf(active, world) : chosen;

  const set = (patch: Partial<Opts>) => setOpts(patch);
  const summary = active
    ? active.name
    : isPhys
    ? `${named.map((k) => capitalise(kindNoun(k).many)).join(', ')} · ${spec.country && world.byId.get(spec.country) ? nm(world.byId.get(spec.country)!.n) : spec.places.length ? spec.places.map((p) => nm(world.index.continents[p])).join(', ') : L('mundo', 'world')}`
    : chosen.length === 0
      ? L('Nada elegido', 'Nothing chosen')
      : chosen.length === 1
        ? nm(chosen[0].n)
        : plural(chosen.length, L('país', 'country'), L('países', 'countries'));

  return (
    <div className="setup">
      <header className="setup-head">
        <p className="kicker">{meta.name}</p>
        <h1>{meta.title}</h1>
        <p className="lead">{meta.blurb}</p>
      </header>

      <section className="step setup-main">
        <h2>
          <span className="step-n">01</span> {active ? L('Lista', 'List') : isPhys ? L('Qué y dónde', 'What and where') : L('Países', 'Countries')}
        </h2>
        {active ? (
          <>
            <ListCard key={active.id} list={active} others={mine.filter((l) => l.id !== active.id)} world={world} onEdit={() => editList(active)} onLeave={() => setListOn(section, null)} onRemove={() => removeList(active.id)} onUse={(id) => setListOn(section, id)} />
            <GoalBar key={`goal:${active.id}`} section={section} mode={def.id} config={listConfig(active, 'pin', opts)} />
          </>
        ) : (
          <>
            {section !== 'pops' && <ListBar lists={mine} canNew={!noMap} onUse={(id) => setListOn(section, id)} onNew={newList} />}
            {section !== 'pops' && <GoalBar section={section} mode={def.id} config={noMap ? null : current('pin')} />}
            {isPhys ? (
              <PhysPicker spec={spec} file={physical} world={world} onChange={(next) => setSel(section, physTokens(next))} />
            ) : (
              <Picker section={section} world={world} selected={selected} onChange={(ids) => setSel(section, ids)} allow={section === 'cities' ? hasCities : undefined} count={section === 'cities' ? cityCountOf : undefined} />
            )}
          </>
        )}
      </section>

      <aside className="setup-side">
        <div className="setup-scroll">
          <section className="step step-mode" ref={modeRef}>
            <h2>
              <span className="step-n">02</span> {L('Modo', 'Mode')}
            </h2>
            {/* Gathered by what each game asks for: a section with a dozen games is read by its headings. */}
            {groups.map((g) => (
              <div key={g} className="mode-group" role="group" aria-label={GROUP_NAME[g]}>
                {grouped && <h3 className="mode-group-name">{GROUP_NAME[g]}</h3>}
                <div className="modes">
                  {modes
                    .filter((m) => m.group === g)
                    .map((m) => {
                      const Icon = m.icon;
                      return (
                        <button key={m.id} type="button" className={cx('mode', m.id === def.id && 'on')} aria-pressed={m.id === def.id} title={m.desc} onClick={() => setMode(section, m.id)}>
                          <span className="mode-icon">
                            <Icon size={18} aria-hidden="true" />
                          </span>
                          <span className="mode-name">
                            {m.name}
                            {/* What is not played is neither easy nor hard. */}
                            {m.level > 0 ? (
                              <span className="mode-level" title={levelName(m.level)} aria-label={levelName(m.level)}>
                                {[1, 2, 3].map((n) => (
                                  <i key={n} className={n <= m.level ? 'on' : undefined} />
                                ))}
                              </span>
                            ) : (
                              <span className="mode-level mode-paper">{L('en papel', 'on paper')}</span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
            <p className="mode-about" aria-live="polite">
              {def.level > 0 && <strong>{levelName(def.level)}. </strong>}
              {def.desc}
            </p>
            {(estimate || questions != null || pace.first != null) && (
              <ul className="mode-facts">
                {(estimate || questions != null) && (
                  <li
                    title={
                      !estimate
                        ? undefined
                        : estimate.own
                          ? L('Calculado con tus partidas de este modo.', 'Worked out from your games of this mode.')
                          : L('Una estimación general: en cuanto juegues una partida se ajusta a tu ritmo.', 'A general estimate: it follows your pace as soon as you play a game.')
                    }
                  >
                    <Timer size={14} aria-hidden="true" />
                    <span>
                      {estimate && L(minutesOf(estimate.ms) === 1 ? 'Alrededor de 1 min' : `Unos ${nf(minutesOf(estimate.ms))} min`, `About ${nf(minutesOf(estimate.ms))} min`)}
                      {estimate && questions != null && ' · '}
                      {questions != null && (def.id === 'nameall' ? plural(questions, noun[0], noun[1]) : plural(questions, L('pregunta', 'question'), L('preguntas', 'questions')))}
                      {estimate?.own && <small> {L('a tu ritmo', 'at your pace')}</small>}
                    </span>
                  </li>
                )}
                {pace.first != null && (
                  <li title={L('En tus últimas partidas de este modo en esta sección.', 'In your latest games of this mode in this section.')}>
                    <Target size={14} aria-hidden="true" />
                    <span>
                      {L(`Aciertas el ${percentOf(pace.first)} % a la primera`, `You get ${percentOf(pace.first)}% right first time`)}
                      <small> {L(`en ${plural(pace.games, 'partida', 'partidas')}`, `in ${plural(pace.games, 'game', 'games')}`)}</small>
                    </span>
                  </li>
                )}
              </ul>
            )}
          </section>

          <section className="step">
            <h2>
              <span className="step-n">03</span> {L('Ajustes', 'Settings')}
            </h2>
            {!anyOption && !(section === 'regions' && multi.length > 0) && <p className="tip-line">{L(`«${def.name}» no necesita ajustes.`, `“${def.name}” needs no settings.`)}</p>}
            {def.id === 'listen' && !mute && (
              <p className="tip-line">
                {L(
                  'Los nombres los dice la voz de tu dispositivo: no se descarga ni se envía nada. Si no se oye, sube el volumen; «Ver el nombre» lo escribe, y cuenta como ayuda.',
                  'The names are said by the voice of your device: nothing is downloaded or sent. If you hear nothing, turn the volume up; “Show the name” writes it, and counts as help.',
                )}
              </p>
            )}
            <div className="options">
              {section === 'regions' && multi.length > 0 && (
                <details className="levels" open={multi.length <= 4}>
                  <summary>
                    <span className="opt-label">{L('Nivel de detalle', 'Level of detail')}</span>
                    {multi.length > 4 && <small>{L(`${multi.length} países con varios niveles`, `${multi.length} countries with several levels`)}</small>}
                  </summary>
                  <ul>
                    {multi.map((c) => (
                      <li key={c.id}>
                        <span className="levels-name">
                          <Flag code={c.fl} size="sm" /> {nm(c.n)}
                        </span>
                        <Seg small label={L(`Nivel de ${nm(c.n)}`, `Level of ${nm(c.n)}`)} value={levelOf(c, levels).k} onChange={(k) => setLevel(c.id, k)} options={c.lv.map((l) => ({ value: l.k, label: `${capitalise(levelNoun(l).many)} · ${l.n}` }))} />
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {show.cities && (
                <>
                  <div className="opt">
                    <span className="opt-label">{L('Qué ciudades', 'Which cities')}</span>
                    <Seg
                      label={L('Qué ciudades', 'Which cities')}
                      value={opts.cityPick}
                      onChange={(cityPick) => set({ cityPick })}
                      options={[
                        { value: 'top', label: L('Las más pobladas', 'The largest') },
                        { value: 'caps', label: L('Capitales de país', 'National capitals'), title: L('Una por país: elige varios países o un continente', 'One per country: choose several countries or a continent') },
                        { value: 'regcaps', label: L('Capitales de región', 'Regional capitals') },
                      ]}
                    />
                  </div>
                  {opts.cityPick === 'top' && (
                    <div className="opt">
                      <span className="opt-label">{L('Cuántas', 'How many')}</span>
                      <Seg label={L('Cuántas ciudades', 'How many cities')} value={opts.cityCount} onChange={(cityCount) => set({ cityCount })} options={CITY_COUNTS.map((n) => ({ value: n as number, label: String(n) }))} />
                    </div>
                  )}
                </>
              )}
              {show.metric && (
                <div className="opt">
                  <span className="opt-label">{L('Cifra', 'Figure')}</span>
                  <Seg
                    label={L('Cifra', 'Figure')}
                    value={opts.metric}
                    onChange={(metric) => set({ metric })}
                    options={[
                      { value: 'pop', label: L('Población', 'Population') },
                      { value: 'area', label: L('Superficie', 'Area') },
                      { value: 'density', label: L('Densidad', 'Density'), title: L('Habitantes por km²', 'People per km²') },
                    ]}
                  />
                </div>
              )}
              {show.countdown && (
                <div className="opt">
                  <span className="opt-label">{L('Tiempo', 'Time')}</span>
                  <Seg
                    label={L('Tiempo para rellenar el mapa', 'Time to fill the map in')}
                    value={COUNTDOWNS.includes(opts.countdown) ? opts.countdown : 0}
                    onChange={(countdown) => set({ countdown })}
                    options={COUNTDOWNS.map((secs) => ({ value: secs, label: secs ? L(`${secs / 60} min`, `${secs / 60} min`) : L('Sin límite', 'No limit') }))}
                  />
                  {opts.countdown > 0 && <p className="opt-hint">{L('Cuenta atrás: lo que no esté escrito cuando llegue a cero se queda en blanco.', 'A countdown: what is not written when it reaches zero stays blank.')}</p>}
                </div>
              )}
              {show.axis && (
                <div className="opt">
                  <span className="opt-label">{L('Orden', 'Order')}</span>
                  <Seg
                    label={L('En qué orden', 'In which order')}
                    value={opts.axis}
                    onChange={(axis) => set({ axis })}
                    options={[
                      { value: 'ns', label: L('De norte a sur', 'North to south') },
                      { value: 'we', label: L('De oeste a este', 'West to east') },
                    ]}
                  />
                  <p className="opt-hint">
                    {section === 'cities'
                      ? L('Cuenta dónde está cada ciudad.', 'What counts is where each city is.')
                      : L('Cuenta el centro de cada pieza: las que quedan casi a la misma altura no salen juntas.', 'What counts is the centre of each piece: those lying almost level are not dealt together.')}
                  </p>
                </div>
              )}
              {show.pinBy && (
                <div className="opt">
                  <span className="opt-label">{L('Te mostramos', 'You are shown')}</span>
                  <Seg
                    label={L('Qué se muestra', 'What is shown')}
                    value={opts.pinBy}
                    onChange={(pinBy) => set({ pinBy })}
                    options={[
                      { value: 'name', label: L('El nombre', 'The name') },
                      { value: 'capital', label: L('La capital', 'The capital') },
                      { value: 'flag', label: L('La bandera', 'The flag') },
                    ]}
                  />
                </div>
              )}
              {show.bearingAsk && (
                <div className="opt">
                  <span className="opt-label">{L('Pregunta', 'Question')}</span>
                  <Seg
                    label={L('Qué se pregunta', 'What is asked')}
                    value={opts.bearingAsk ?? 'both'}
                    onChange={(bearingAsk) => set({ bearingAsk })}
                    options={[
                      { value: 'both', label: L('Las dos cosas', 'Both') },
                      { value: 'dir', label: L('Rumbo', 'Bearing') },
                      { value: 'dist', label: L('Distancia', 'Distance') },
                    ]}
                  />
                  <p className="opt-hint">
                    {(opts.bearingAsk ?? 'both') === 'dir'
                      ? L('Hacia dónde queda cada sitio desde otro: norte, noreste, este…', 'Which way each place is from another: north, north-east, east…')
                      : opts.bearingAsk === 'dist'
                        ? L('A cuántos kilómetros está cada sitio de otro, entre cuatro distancias.', 'How many kilometres each place is from another, out of four distances.')
                        : L('Una pregunta de rumbo y otra de distancia, por turnos.', 'A question about the bearing and one about the distance, in turn.')}
                  </p>
                </div>
              )}
              {show.cardAsk && (
                <div className="opt">
                  <span className="opt-label">{L('Pregunta', 'Question')}</span>
                  <Seg
                    label={L('Qué pregunta cada tarjeta', 'What each card asks')}
                    value={cardAsk}
                    onChange={(v) => set({ cardAsk: v })}
                    options={cardAsks.map((value) => ({
                      value,
                      label: cardAskName(value),
                    }))}
                  />
                  <p className="opt-hint">
                    {cardAsk === 'name'
                      ? L('Se ilumina en el mapa y piensas su nombre.', 'It lights up on the map and you think of its name.')
                      : cardAsk === 'where'
                        ? L('Lees el nombre y piensas dónde está; al darle la vuelta, el mapa te lo enseña.', 'You read the name and think where it is; turned over, the map shows you.')
                        : cardAsk === 'capital'
                          ? L('Lees el nombre y piensas su capital.', 'You read the name and think of its capital.')
                          : L('Ves la bandera y piensas de qué país es.', 'You see the flag and think which country it belongs to.')}{' '}
                    {L('Nadie te corrige: tú dices si lo sabías.', 'Nobody marks you: you say whether you knew it.')}
                  </p>
                </div>
              )}
              {show.flagLook && (
                <div className="opt">
                  <span className="opt-label">{L('Banderas', 'Flags')}</span>
                  <Seg
                    label={L('Cómo se ven las banderas', 'How the flags are shown')}
                    value={opts.flagLook ?? 'plain'}
                    onChange={(flagLook) => set({ flagLook })}
                    options={[
                      { value: 'plain', label: L('Tal cual', 'As they are') },
                      { value: 'grey', label: L('En gris', 'In grey'), title: L('Más difícil: sin sus colores', 'Harder: without their colours') },
                      { value: 'blur', label: L('Desenfocadas', 'Out of focus'), title: L('Más difícil: solo las manchas de color', 'Harder: only the patches of colour') },
                    ]}
                  />
                  {(opts.flagLook ?? 'plain') !== 'plain' && (
                    <p className="opt-hint">
                      {opts.flagLook === 'grey'
                        ? L('Sin colores, una bandera se reconoce por su dibujo. Al responder la ves como es.', 'Without colours, a flag is known by its design. Once you answer you see it as it is.')
                        : L('Desenfocada, una bandera se reconoce por sus colores y dónde van; si escribes la respuesta, se aclara un poco con cada intento. Al responder la ves como es.', 'Out of focus, a flag is known by its colours and where they go; if you type the answer, it clears a little with each try. Once you answer you see it as it is.')}
                    </p>
                  )}
                </div>
              )}
              {show.format && (
                <div className="opt">
                  <span className="opt-label">{L('Formato', 'Format')}</span>
                  <Seg
                    label={L('Formato de la partida', 'Format of the game')}
                    value={opts.format}
                    onChange={(format) => set({ format })}
                    options={[
                      { value: 'normal', label: L('Normal', 'Standard') },
                      { value: 'timed', label: L('Contrarreloj', 'Time attack'), title: L('Todas las que puedas en 60 segundos', 'As many as you can in 60 seconds') },
                      { value: 'lives', label: L('Supervivencia', 'Survival'), title: L('Hasta que falles tres veces', 'Until you miss three times') },
                      { value: 'exam', label: L('Examen', 'Exam'), title: L('Sin pistas ni corrección hasta el final', 'No hints and no marking until the end') },
                    ]}
                  />
                  {(paced || exam) && (
                    <p className="opt-hint">
                      {exam
                        ? L(
                            'Como un examen: un intento por pregunta, sin pistas y sin saber si aciertas hasta entregarlo. Al final, la nota sobre 10 y la corrección, con lo que respondiste en cada fallo.',
                            'Like an exam: one try per question, no hints and no telling whether you are right until you hand it in. At the end, a mark out of 10 and the marking, with what you answered where you were wrong.',
                          )
                        : opts.format === 'timed'
                        ? L('60 segundos, un intento por pregunta y sin pistas. Se guarda tu récord en cada mapa.', '60 seconds, one try per question and no hints. Your record on each map is kept.')
                        : L('Tres vidas: cada fallo quita una. Un intento por pregunta y sin pistas. Se guarda tu récord en cada mapa.', 'Three lives: each miss takes one. One try per question and no hints. Your record on each map is kept.')}
                    </p>
                  )}
                </div>
              )}
              {show.answer && (
                <div className="opt">
                  <span className="opt-label">{L('Respuesta', 'Answer')}</span>
                  <Seg
                    label={L('Forma de responder', 'How to answer')}
                    value={opts.answer}
                    onChange={(answer) => set({ answer })}
                    options={[
                      { value: 'choice', label: L('Cuatro opciones', 'Four options'), title: L('Más fácil: reconocer', 'Easier: recognise') },
                      { value: 'type', label: L('Escribir', 'Type it'), title: L('Más difícil: recordar', 'Harder: recall') },
                    ]}
                  />
                  {typed && (
                    <p className="opt-hint">
                      {listed
                        ? L(
                            `No importan tildes ni mayúsculas, y cada región vale también por sus abreviaturas y variantes${initialsSample}.`,
                            `Accents and capitals do not matter, and each region also answers to its short forms and variants${initialsSample}.`,
                          )
                        : initials
                          ? L(
                              `No importan tildes ni mayúsculas, y un nombre de varias palabras vale por sus siglas${initialsSample}.`,
                              `Accents and capitals do not matter, and a name of several words can be typed by its initials${initialsSample}.`,
                            )
                          : L('No importan tildes ni mayúsculas.', 'Accents and capitals do not matter.')}{' '}
                      <a href={typeinsHref}>{L('Elegir abreviaturas', 'Choose short forms')}</a>
                    </p>
                  )}
                </div>
              )}
              {show.length && (
                <div className="opt">
                  <span className="opt-label">{L('Preguntas', 'Questions')}</span>
                  <Seg
                    label={L('Número de preguntas', 'Number of questions')}
                    // "All" is twenty statements where they are made up as the game goes.
                    value={finite && opts.length === 'endless' ? 'all' : def.id === 'truefalse' && opts.length === 'all' ? 20 : opts.length}
                    onChange={(length) => set({ length })}
                    options={lengths}
                  />
                </div>
              )}
              {show.suggest && (
                <Toggle checked={opts.suggest} onChange={(suggest) => set({ suggest })} hint={L('Más fácil: eliges de una lista mientras escribes.', 'Easier: you pick from a list while typing.')}>
                  {L('Sugerencias al escribir', 'Suggestions while typing')}
                </Toggle>
              )}
              {show.turned && (
                <Toggle checked={!!opts.turned} onChange={(turned) => set({ turned })} hint={L('Más difícil: cada silueta sale girada, sin el norte arriba.', 'Harder: every outline comes turned, without north at the top.')}>
                  {L('Siluetas giradas', 'Turned outlines')}
                </Toggle>
              )}
              {show.labels && (
                <Toggle checked={opts.labels} onChange={(v) => set({ labels: v })} hint={L('Lo que vas resolviendo queda rotulado en el mapa.', 'What you solve stays labelled on the map.')}>
                  {L('Dejar los nombres en el mapa', 'Keep the names on the map')}
                </Toggle>
              )}
              {show.blind && (
                <Toggle checked={opts.blind} onChange={(blind) => set({ blind })} hint={L('Sin fronteras interiores hasta que aciertas: solo para valientes.', 'No inner borders until you get them right: for the brave only.')}>
                  {L('Mapa sin fronteras', 'Map without borders')}
                </Toggle>
              )}
              {show.wiki && (
                <Toggle
                  checked={opts.wiki}
                  onChange={(wiki) => set({ wiki })}
                  hint={
                    def.id === 'explore'
                      ? L('Dos líneas y una foto de Wikipedia de lo que toques. Necesita conexión.', 'Two lines and a picture from Wikipedia about whatever you tap. Needs a connection.')
                      : L('Al fallar, dos líneas y una foto de Wikipedia sobre la respuesta. Necesita conexión.', 'After a miss, two lines and a picture from Wikipedia about the answer. Needs a connection.')
                  }
                >
                  {def.id === 'explore' ? L('Ficha de Wikipedia', 'Wikipedia card') : L('Ficha de Wikipedia al fallar', 'Wikipedia card after a miss')}
                </Toggle>
              )}
            </div>
          </section>
        </div>
        <div className="startbar">
          <button type="button" className="startbar-info" title={L('Ver modo y ajustes', 'See mode and settings')} onClick={() => modeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
            <strong>
              {summary}
              {(active || (section !== 'countries' && section !== 'pops')) && units > 0 ? ` · ${plural(units, noun[0], noun[1])}` : ''}
            </strong>
            <span>
              <b className={problem ? 'problem' : undefined}>{problem ?? `${def.name}${paced || exam ? ` · ${formatName(opts.format).toLowerCase()}` : show.length && opts.length === 'endless' && !finite ? ` · ${L('sin fin', 'endless')}` : ''}`}</b>
              <ChevronDown size={14} aria-hidden="true" />
            </span>
          </button>
          <div className="startbar-flags" aria-hidden="true">
            {flags.slice(0, 7).map((c) => (
              <Flag key={c.id} code={c.fl} size="sm" />
            ))}
            {flags.length > 7 && <small>+{flags.length - 7}</small>}
          </div>
          <button type="button" className="btn btn-primary btn-lg" onClick={begin} disabled={!!problem}>
            {/* The sheet is not started: it is laid out to be looked at and sent to the printer. */}
            {def.id === 'print' ? <Printer size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
            {def.id === 'print' ? L('Ver la hoja', 'See the sheet') : L('Empezar', 'Start')}
          </button>
        </div>
      </aside>
    </div>
  );
}
