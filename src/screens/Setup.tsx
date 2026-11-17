/** Setup: 1 what to play with, 2 mode, 3 options. */
import { Check, ChevronDown, Infinity as InfinityIcon, ListChecks, ListPlus, Pencil, Play, Share2, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Picker } from '../components/Picker';
import { Flag, Seg, Toggle, capitalise } from '../components/ui';
import { eligible, levelOf, loadFile, type World } from '../lib/data';
import { countriesOf, describeMap } from '../lib/describe';
import { CITY_COUNTS, PHYS_KINDS, PHYS_PLACES, kindNoun, loadCities, loadPhysical, parsePhys, physTokens, type PhysKind, type PhysSpec } from '../lib/extra';
import { L, getLang, levelNoun, nm } from '../lib/i18n';
import { encodeList, listConfig, listPlayable, listUrl } from '../lib/lists';
import { MODES, SECTIONS, formatName } from '../lib/modes';
import { go } from '../lib/router';
import { useStore, type CustomList, type Length, type Opts } from '../lib/store';
import { cx, nf, plural } from '../lib/text';
import { SAMPLES, settingsLink } from '../lib/typeinList';
import { SHIPPED_AUTO, inForce } from '../lib/typeins';
import type { Country, Mode, Section } from '../lib/types';

const levelName = (n: number): string => [L('Fácil', 'Easy'), L('Medio', 'Medium'), L('Difícil', 'Hard')][n - 1];
const ANSWER_MODES: Mode[] = ['learn', 'identify', 'outline', 'capital', 'flag'];
const LENGTH_MODES: Mode[] = ['pin', 'identify', 'outline', 'regionle', 'puzzle', 'neighbours', 'capital', 'flag', 'blind', 'exact', 'which', 'rank'];
/** Games that are one round of everything: they cannot go on for ever. */
const FINITE_MODES: Mode[] = ['neighbours', 'blind'];
/** Games that can also be played against the clock or until the lives run out. */
const FORMAT_MODES: Mode[] = ['pin', 'identify', 'outline', 'puzzle', 'capital', 'flag'];
/** Games where names are typed and a list of suggestions can help. */
const SUGGEST_MODES: Mode[] = ['travel', 'neighbours', 'regionle'];
/** Games that stop on a missed answer long enough to read about it. */
const WIKI_MODES: Mode[] = ['explore', 'pin', 'identify', 'outline', 'regionle', 'puzzle', 'neighbours', 'capital', 'flag', 'blind'];

type Cities = Awaited<ReturnType<typeof loadCities>>;
type Physical = Awaited<ReturnType<typeof loadPhysical>>;
type Capitals = Record<string, Record<string, Record<string, string[]>>>;

/** What a physical map is made of: kinds of feature, continents and how many. */
function PhysPicker({ spec, file, world, onChange }: { spec: PhysSpec; file: Physical | null; world: World; onChange(spec: PhysSpec): void }) {
  const inPlace = (ct: string[]) => !spec.places.length || ct.some((c) => spec.places.includes(c));
  const list = file ? file.f.filter((f) => spec.kinds.includes(f.k) && (spec.all || f.r === 1) && inPlace(f.ct)) : [];
  const toggleKind = (k: PhysKind) => {
    const kinds = spec.kinds.includes(k) ? spec.kinds.filter((x) => x !== k) : [...spec.kinds, k];
    if (kinds.length) onChange({ ...spec, kinds: PHYS_KINDS.filter((x) => kinds.includes(x)) });
  };
  const togglePlace = (p: string) => {
    if (p === 'W') return onChange({ ...spec, places: [] });
    onChange({ ...spec, places: spec.places.includes(p) ? spec.places.filter((x) => x !== p) : [...spec.places, p] });
  };
  return (
    <div className="phys">
      <div className="frow">
        <span className="frow-label">{L('Qué', 'What')}</span>
        <div className="frow-chips">
          {PHYS_KINDS.map((k) => {
            const on = spec.kinds.includes(k);
            const n = file ? file.f.filter((f) => f.k === k && (spec.all || f.r === 1) && inPlace(f.ct)).length : null;
            return (
              <button key={k} type="button" aria-pressed={on} className={cx('chip', `chip-${k}`, on && 'on')} onClick={() => toggleKind(k)}>
                <i className={`kdot kdot-${k}`} aria-hidden="true" />
                {capitalise(kindNoun(k).many)}
                {n != null && <small>{n}</small>}
              </button>
            );
          })}
        </div>
      </div>
      <div className="frow">
        <span className="frow-label">{L('Dónde', 'Where')}</span>
        <div className="frow-chips">
          {PHYS_PLACES.map((p) => {
            const on = p === 'W' ? !spec.places.length : spec.places.includes(p);
            return (
              <button key={p} type="button" aria-pressed={on} className={cx('chip', on && 'on')} onClick={() => togglePlace(p)}>
                {p === 'W' ? L('Todo el mundo', 'The whole world') : nm(world.index.continents[p])}
              </button>
            );
          })}
        </div>
      </div>
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
            const names = list
              .filter((f) => f.k === k)
              .map((f) => nm(f.n))
              .sort((a, b) => a.localeCompare(b, getLang()));
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
          <p className="empty">{L('No hay nada de eso ahí: prueba con «Todos» o con otro continente.', 'There is nothing like that there: try “All of them” or another continent.')}</p>
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
  const setListOn = useStore((s) => s.setListOn);
  const removeList = useStore((s) => s.removeList);
  const modeRef = useRef<HTMLElement>(null);
  const meta = SECTIONS[section];
  const modes = MODES[section];
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
    if (isPhys) return physical ? physical.f.filter((f) => spec.kinds.includes(f.k) && (spec.all || f.r === 1) && (!spec.places.length || f.ct.some((c) => spec.places.includes(c)))).length : 0;
    return chosen.length;
  }, [active, section, chosen, levels, cities, physical, opts.cityPick, opts.cityCount, spec, isPhys]);

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
          ? spec.kinds.length === 1
            ? [kindNoun(spec.kinds[0]).one, kindNoun(spec.kinds[0]).many]
            : [L('elemento', 'feature'), L('elementos', 'features')]
          : [L('país', 'country'), L('países', 'countries')];

  const capitalsReady = section !== 'regions' || def.id !== 'capital' || !capitals || chosen.some((c) => capitals[c.id]?.[levelOf(c, levels).k]);
  const need = section === 'countries' || section === 'pops' ? 2 : 1;
  /** Why a new list cannot be started from what is chosen now. */
  const noMap = isPhys ? !physical || units < 2 : chosen.length < 1 || (section === 'cities' && (!cities || units < 2));
  const problem = active
    ? listPlayable(def.id)
      ? null
      : L(`«${def.name}» no se juega con una lista: elige otro modo o deja la lista.`, `“${def.name}” is not played with a list: choose another mode or stop using the list.`)
    : isPhys
    ? physical && units < 2
      ? L('Elige algo con al menos dos elementos.', 'Choose something with at least two features.')
      : null
    : chosen.length < need
      ? need === 1
        ? L('Elige al menos un país.', 'Choose at least one country.')
        : L('Elige al menos dos países.', 'Choose at least two countries.')
      : section === 'cities' && cities && units < 2
        ? opts.cityPick === 'caps'
          ? L('Para jugar con capitales de país elige al menos dos países.', 'To play with national capitals choose at least two countries.')
          : L('Ahí no hay ciudades suficientes: cambia la selección.', 'There are not enough cities there: change the selection.')
        : !capitalsReady
          ? L('No tenemos las capitales de esas regiones: prueba otro nivel u otro país.', 'We do not have the capitals of those regions: try another level or country.')
          : def.id === 'travel' && units < 4
            ? L('La ruta necesita un mapa con más piezas.', 'The route needs a map with more pieces.')
            : null;

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
  const paced = FORMAT_MODES.includes(def.id) && opts.format !== 'normal';
  const finite = FINITE_MODES.includes(def.id);
  const show = {
    answer: ANSWER_MODES.includes(def.id),
    format: FORMAT_MODES.includes(def.id),
    // A list is asked whole, and a paced game ends when the clock or the lives say so.
    length: LENGTH_MODES.includes(def.id) && !paced && !active,
    suggest: (typed && def.id !== 'learn') || SUGGEST_MODES.includes(def.id),
    labels: def.id === 'pin' || def.id === 'identify' || def.id === 'puzzle' || def.id === 'blind',
    pinBy: def.id === 'pin' && section === 'countries',
    blind: def.id === 'travel',
    metric: section === 'pops',
    cities: section === 'cities' && !active,
    wiki: WIKI_MODES.includes(def.id) && !(paced && opts.format === 'timed'),
  };
  const anyOption = Object.values(show).some(Boolean);
  const endless = { value: 'endless' as Length, label: <InfinityIcon size={16} aria-label={L('Sin fin', 'Endless')} /> };

  const lengths: { value: Length; label: ReactNode; title?: string }[] =
    def.id === 'rank'
      ? [{ value: 'all', label: L('10 rondas', '10 rounds') }, { value: 20, label: '20' }, { value: 50, label: '50' }, { ...endless, title: L('Sin fin', 'Endless') }]
      : finite
        ? [{ value: 'all', label: L('Todo', 'All') }, { value: 10, label: '10' }, { value: 20, label: '20' }, { value: 50, label: '50' }]
        : [
            { value: 'all', label: L(`Todo (${nf(units)})`, `All (${nf(units)})`) },
            { value: 10, label: '10' },
            { value: 20, label: '20' },
            { value: 50, label: '50' },
            { ...endless, title: L('Sin fin: lo fallado vuelve a salir', 'Endless: what you miss comes back') },
          ];

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
    ? `${spec.kinds.map((k) => capitalise(kindNoun(k).many)).join(', ')} · ${spec.places.length ? spec.places.map((p) => nm(world.index.continents[p])).join(', ') : L('mundo', 'world')}`
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
          <ListCard key={active.id} list={active} others={mine.filter((l) => l.id !== active.id)} world={world} onEdit={() => editList(active)} onLeave={() => setListOn(section, null)} onRemove={() => removeList(active.id)} onUse={(id) => setListOn(section, id)} />
        ) : (
          <>
            {section !== 'pops' && <ListBar lists={mine} canNew={!noMap} onUse={(id) => setListOn(section, id)} onNew={newList} />}
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
            <div className="modes">
              {modes.map((m) => {
                const Icon = m.icon;
                return (
                  <button key={m.id} type="button" className={cx('mode', m.id === def.id && 'on')} aria-pressed={m.id === def.id} title={m.desc} onClick={() => setMode(section, m.id)}>
                    <span className="mode-icon">
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <span className="mode-name">
                      {m.name}
                      <span className="mode-level" title={levelName(m.level)} aria-label={levelName(m.level)}>
                        {[1, 2, 3].map((n) => (
                          <i key={n} className={n <= m.level ? 'on' : undefined} />
                        ))}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mode-about" aria-live="polite">
              <strong>{levelName(def.level)}.</strong> {def.desc}
            </p>
          </section>

          <section className="step">
            <h2>
              <span className="step-n">03</span> {L('Ajustes', 'Settings')}
            </h2>
            {!anyOption && !(section === 'regions' && multi.length > 0) && <p className="tip-line">{L(`«${def.name}» no necesita ajustes.`, `“${def.name}” needs no settings.`)}</p>}
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
                    ]}
                  />
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
                    ]}
                  />
                  {paced && (
                    <p className="opt-hint">
                      {opts.format === 'timed'
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
                  <Seg label={L('Número de preguntas', 'Number of questions')} value={finite && opts.length === 'endless' ? 'all' : opts.length} onChange={(length) => set({ length })} options={lengths} />
                </div>
              )}
              {show.suggest && (
                <Toggle checked={opts.suggest} onChange={(suggest) => set({ suggest })} hint={L('Más fácil: eliges de una lista mientras escribes.', 'Easier: you pick from a list while typing.')}>
                  {L('Sugerencias al escribir', 'Suggestions while typing')}
                </Toggle>
              )}
              {show.labels && (
                <Toggle checked={opts.labels} onChange={(v) => set({ labels: v })} hint={L('Lo que vas resolviendo queda rotulado en el mapa.', 'What you solve stays labelled on the map.')}>
                  {L('Dejar los nombres en el mapa', 'Keep the names on the map')}
                </Toggle>
              )}
              {show.blind && (
                <Toggle checked={opts.blind} onChange={(blind) => set({ blind })} hint={L('Sin fronteras interiores hasta que aciertas: solo para valientes.', 'No inner borders until you get them right: for the brave only.')}>
                  {L('Mapa mudo', 'Blank map')}
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
              <b>{problem ?? `${def.name}${paced ? ` · ${formatName(opts.format).toLowerCase()}` : show.length && opts.length === 'endless' && !finite ? ` · ${L('sin fin', 'endless')}` : ''}`}</b>
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
            <Play size={18} aria-hidden="true" />
            {L('Empezar', 'Start')}
          </button>
        </div>
      </aside>
    </div>
  );
}
