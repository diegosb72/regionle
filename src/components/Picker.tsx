/** Country picker: continents and subregions, search, filters, shortcuts and saved selections. */
import { BookmarkPlus, Check, Search, SlidersHorizontal, Star, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { eligible, fineCount, levelOf, type World } from '../lib/data';
import { L, getLang, nm } from '../lib/i18n';
import { useStore } from '../lib/store';
import { cx, key, nf } from '../lib/text';
import type { Country, Section } from '../lib/types';
import { Flag } from './ui';

const EU = 'AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE'.split(' ');
const SPANISH = 'ES MX GT HN SV NI CR PA CU DO PR CO VE EC PE BO CL AR UY PY GQ'.split(' ');
const G20 = 'AR AU BR CA CN DE FR GB ID IN IT JP KR MX RU SA TR US ZA'.split(' ');

type Coast = 'any' | 'landlocked' | 'coastal' | 'island';
interface Filters {
  un: boolean;
  more: boolean;
  dep: boolean;
  coast: Coast;
  pop: number;
  area: number;
  units: number;
}
const NO_FILTERS: Filters = { un: true, more: true, dep: false, coast: 'any', pop: 0, area: 0, units: 0 };

/** Bands of the filters. The labels are read when drawn, so that they follow the language. */
const POP_BANDS: [() => string, number, number][] = [
  [() => L('Cualquiera', 'Any'), 0, Infinity],
  [() => L('Más de 100 M', 'Over 100 M'), 1e8, Infinity],
  [() => '10 – 100 M', 1e7, 1e8],
  [() => '1 – 10 M', 1e6, 1e7],
  [() => L('Menos de 1 M', 'Under 1 M'), 0, 1e6],
];
const AREA_BANDS: [() => string, number, number][] = [
  [() => L('Cualquiera', 'Any'), 0, Infinity],
  [() => L('Más de 1 M km²', 'Over 1 M km²'), 1e6, Infinity],
  [() => L('100.000 – 1 M', '100,000 – 1 M'), 1e5, 1e6],
  [() => L('10.000 – 100.000', '10,000 – 100,000'), 1e4, 1e5],
  [() => L('Menos de 10.000', 'Under 10,000'), 0, 1e4],
];
const UNIT_BANDS: [() => string, number, number][] = [
  [() => L('Cualquiera', 'Any'), 0, Infinity],
  [() => L('Hasta 10', 'Up to 10'), 0, 11],
  [() => '11 – 30', 11, 31],
  [() => L('Más de 30', 'Over 30'), 31, Infinity],
];
const COASTS: [Coast, () => string][] = [
  ['any', () => L('Cualquiera', 'Any')],
  ['landlocked', () => L('Sin salida al mar', 'Landlocked')],
  ['coastal', () => L('Con costa', 'With a coast')],
  ['island', () => L('Sin fronteras terrestres', 'No land borders')],
];

type Sort = 'name' | 'pop' | 'area' | 'units';

function Chips<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange(v: T): void }) {
  return (
    <div className="frow">
      <span className="frow-label">{label}</span>
      <div className="frow-chips" role="radiogroup" aria-label={label}>
        {options.map(([v, text]) => (
          <button key={String(v)} type="button" role="radio" aria-checked={v === value} className={cx('chip', v === value && 'on')} onClick={() => onChange(v)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Picker({
  section,
  world,
  selected,
  onChange,
  allow,
  count,
}: {
  section: Section;
  world: World;
  selected: string[];
  onChange(ids: string[]): void;
  /** Leaves out countries that cannot be played here (no cities on the map, say). */
  allow?: (c: Country) => boolean;
  /** Small figure next to each country: how much there is to play in it. */
  count?: (c: Country) => number;
}) {
  const { index } = world;
  const levels = useStore((s) => s.levels);
  const favs = useStore((s) => s.favs);
  const addFav = useStore((s) => s.addFav);
  const removeFav = useStore((s) => s.removeFav);
  const [query, setQuery] = useState('');
  const setLevel = useStore((s) => s.setLevel);
  const [continent, setContinent] = useState(() => {
    const cts = new Set(selected.map((id) => world.byId.get(id)?.ct).filter(Boolean));
    return cts.size === 1 ? String([...cts][0]) : 'all';
  });
  const [f, setF] = useState<Filters>(NO_FILTERS);
  const [open, setOpen] = useState(false);
  const [sort, setSort] = useState<Sort>('name');
  const [naming, setNaming] = useState<string | null>(null);

  const pool = useMemo(() => index.countries.filter((c) => eligible(section, c) && (!allow || allow(c))), [index, section, allow]);
  const chosen = useMemo(() => new Set(selected), [selected]);
  const qk = key(query);

  const typeOk = (c: Country) => (c.cl === 'un' ? f.un : c.cl === 'dep' ? f.dep : f.more);
  const visible = useMemo(() => {
    const [, pLo, pHi] = POP_BANDS[f.pop];
    const [, aLo, aHi] = AREA_BANDS[f.area];
    const [, uLo, uHi] = UNIT_BANDS[f.units];
    return pool.filter((c) => {
      if (continent !== 'all' && c.ct !== continent) return false;
      // A search by name looks everywhere, and nothing that is chosen is ever hidden by the type filter.
      if (!qk && !typeOk(c) && !chosen.has(c.id)) return false;
      if (f.coast === 'landlocked' && !c.ll) return false;
      if (f.coast === 'coastal' && c.ll) return false;
      if (f.coast === 'island' && c.nb?.length) return false;
      if (f.pop && !((c.pop ?? 0) >= pLo && (c.pop ?? 0) < pHi)) return false;
      if (f.area && !(c.ar >= aLo && c.ar < aHi)) return false;
      if (f.units && !(fineCount(c) >= uLo && fineCount(c) < uHi)) return false;
      if (qk && ![c.n.es, c.n.en, c.cap?.es, ...(c.al ?? [])].some((s) => s && key(s).includes(qk))) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, continent, f, qk, chosen]);

  const sorter = useMemo(() => {
    const by: Record<Sort, (a: Country, b: Country) => number> = {
      name: (a, b) => nm(a.n).localeCompare(nm(b.n), getLang()),
      pop: (a, b) => (b.pop ?? 0) - (a.pop ?? 0),
      area: (a, b) => b.ar - a.ar,
      units: (a, b) => fineCount(b) - fineCount(a),
    };
    return by[sort];
  }, [sort]);

  const groups = useMemo(() => {
    const out: { id: string; name: string; continent: string; list: Country[] }[] = [];
    for (const sr of Object.keys(index.subregions)) {
      const list = visible.filter((c) => c.sr === sr).sort(sorter);
      if (list.length) out.push({ id: sr, name: nm(index.subregions[sr]), continent: list[0].ct, list });
    }
    return out;
  }, [index, visible, sorter]);

  const toggle = (id: string) => onChange(chosen.has(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const setMany = (ids: string[], on: boolean) => {
    const set = new Set(ids);
    onChange(on ? [...selected, ...ids.filter((id) => !chosen.has(id))] : selected.filter((id) => !set.has(id)));
  };
  const only = (ids: string[]) => {
    const ok = new Set(pool.map((c) => c.id));
    onChange(ids.filter((id) => ok.has(id)));
  };
  const top = (by: (c: Country) => number) =>
    [...pool]
      .filter((c) => c.cl === 'un')
      .sort((a, b) => by(b) - by(a))
      .slice(0, 10)
      .map((c) => c.id);

  const shortcuts: [string, () => string[]][] = [
    [L('Mundo', 'World'), () => pool.filter((c) => c.cl !== 'dep').map((c) => c.id)],
    [L('Unión Europea', 'European Union'), () => EU],
    [L('Hispanohablantes', 'Spanish-speaking'), () => SPANISH],
    ['G20', () => G20],
    [L('10 más poblados', '10 most populous'), () => top((c) => c.pop ?? 0)],
    [L('10 más extensos', '10 largest'), () => top((c) => c.ar)],
  ];

  const activeFilters = Number(!f.un) + Number(!f.more) + Number(f.dep) + Number(f.coast !== 'any') + Number(f.pop > 0) + Number(f.area > 0) + Number(f.units > 0);
  const allVisibleOn = visible.length > 0 && visible.every((c) => chosen.has(c.id));
  const mine = favs.filter((x) => x.section === section);

  return (
    <div className="picker">
      <div className="picker-bar">
        <label className="search">
          <Search size={16} aria-hidden="true" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={L('Buscar país o capital…', 'Search country or capital…')} aria-label={L('Buscar país', 'Search country')} />
        </label>
        <button type="button" className={cx('btn btn-sm', (open || activeFilters > 0) && 'on')} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <SlidersHorizontal size={15} aria-hidden="true" />
          {L('Filtros', 'Filters')}
          {activeFilters > 0 ? ` · ${activeFilters}` : ''}
        </button>
        <label className="select">
          <span>{L('Orden', 'Order')}</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="name">{L('Alfabético', 'Alphabetical')}</option>
            <option value="pop">{L('Población', 'Population')}</option>
            <option value="area">{L('Superficie', 'Area')}</option>
            {section === 'regions' && <option value="units">{L('N.º de divisiones', 'No. of divisions')}</option>}
          </select>
        </label>
      </div>

      {open && (
        <div className="filters">
          <div className="frow">
            <span className="frow-label">{L('Tipo', 'Kind')}</span>
            <div className="frow-chips">
              {(
                [
                  ['un', L('Estados de la ONU', 'UN member states')],
                  ['more', L('Observadores y reconocimiento parcial', 'Observers and partially recognised')],
                  ['dep', L('Territorios dependientes', 'Dependent territories')],
                ] as const
              ).map(([k, text]) => (
                <button key={k} type="button" aria-pressed={f[k]} className={cx('chip', f[k] && 'on')} onClick={() => setF({ ...f, [k]: !f[k] })}>
                  {f[k] && <Check size={13} aria-hidden="true" />}
                  {text}
                </button>
              ))}
            </div>
          </div>
          <Chips label={L('Litoral', 'Coast')} value={f.coast} options={COASTS.map(([v, text]) => [v, text()])} onChange={(coast) => setF({ ...f, coast })} />
          <Chips label={L('Población', 'Population')} value={f.pop} options={POP_BANDS.map((b, i) => [i, b[0]()])} onChange={(pop) => setF({ ...f, pop })} />
          <Chips label={L('Superficie', 'Area')} value={f.area} options={AREA_BANDS.map((b, i) => [i, b[0]()])} onChange={(area) => setF({ ...f, area })} />
          {section === 'regions' && <Chips label={L('Divisiones', 'Divisions')} value={f.units} options={UNIT_BANDS.map((b, i) => [i, b[0]()])} onChange={(units) => setF({ ...f, units })} />}
          {activeFilters > 0 && (
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setF(NO_FILTERS)}>
              <X size={14} aria-hidden="true" />
              {L('Quitar filtros', 'Clear filters')}
            </button>
          )}
        </div>
      )}

      <div className="picker-tabs" role="tablist" aria-label={L('Continente', 'Continent')}>
        {[['all', L('Todo', 'All')], ...Object.entries(index.continents).map(([id, n]) => [id, nm(n)])].map(([id, name]) => {
          const inTab = pool.filter((c) => id === 'all' || c.ct === id);
          const n = inTab.filter((c) => chosen.has(c.id)).length;
          if (!n && id !== continent && !inTab.some(typeOk)) return null;
          return (
            <button key={id} type="button" role="tab" aria-selected={continent === id} className={cx('tab', continent === id && 'on')} onClick={() => setContinent(id)}>
              {name}
              {n > 0 && <b>{n}</b>}
            </button>
          );
        })}
      </div>

      <div className="picker-quick">
        <span className="frow-label">{L('Atajos', 'Shortcuts')}</span>
        {shortcuts.map(([name, ids]) => (
          <button key={name} type="button" className="chip" onClick={() => only(ids())}>
            {name}
          </button>
        ))}
        {mine.map((fav) => (
          <span key={fav.name} className="chip chip-fav">
            <button
              type="button"
              onClick={() => {
                only(fav.ids);
                for (const [id, k] of Object.entries(fav.levels ?? {})) setLevel(id, k);
              }}
              title={L(`${fav.ids.length} países guardados`, `${fav.ids.length} countries saved`)}
            >
              <Star size={13} aria-hidden="true" />
              {fav.name}
            </button>
            <button type="button" onClick={() => removeFav(section, fav.name)} aria-label={L(`Borrar ${fav.name}`, `Delete ${fav.name}`)}>
              <X size={13} />
            </button>
          </span>
        ))}
        {naming == null ? (
          <button type="button" className="chip chip-add" disabled={!selected.length} onClick={() => setNaming('')} title={L('Guarda esta combinación de países para otro día', 'Save this set of countries for another day')}>
            <BookmarkPlus size={14} aria-hidden="true" />
            {L('Guardar selección', 'Save selection')}
          </button>
        ) : (
          <form
            className="chip chip-form"
            onSubmit={(e) => {
              e.preventDefault();
              const name = naming.trim();
              if (name) addFav({ name, section, ids: selected, levels });
              setNaming(null);
            }}
          >
            <input autoFocus value={naming} onChange={(e) => setNaming(e.target.value)} placeholder={L('Nombre…', 'Name…')} maxLength={28} aria-label={L('Nombre de la selección', 'Name of the selection')} onBlur={() => naming.trim() === '' && setNaming(null)} />
            <button type="submit" aria-label={L('Guardar', 'Save')}>
              <Check size={14} />
            </button>
          </form>
        )}
      </div>

      <div className="picker-actions">
        <span>
          {nf(visible.length)} {L('a la vista', 'in view')} · <b>{nf(selected.length)}</b> {L(selected.length === 1 ? 'elegido' : 'elegidos', 'chosen')}
        </span>
        <button type="button" className="btn btn-sm" disabled={!visible.length} onClick={() => setMany(visible.map((c) => c.id), !allVisibleOn)}>
          {allVisibleOn ? L('Quitar los visibles', 'Remove those in view') : L('Elegir los visibles', 'Choose those in view')}
        </button>
        <button type="button" className="btn btn-sm btn-ghost" disabled={!selected.length} onClick={() => onChange([])}>
          {L('Limpiar', 'Clear')}
        </button>
      </div>

      <div className="picker-groups">
        {groups.map((g) => {
          const on = g.list.filter((c) => chosen.has(c.id)).length;
          const full = on === g.list.length;
          return (
            <section key={g.id} className="pgroup">
              <header>
                <h3>
                  {g.name}
                  <small>
                    {on}/{g.list.length}
                  </small>
                </h3>
                <button type="button" className="btn btn-xs" onClick={() => setMany(g.list.map((c) => c.id), !full)}>
                  {full ? L('Ninguno', 'None') : L('Todos', 'All')}
                </button>
              </header>
              <ul>
                {g.list.map((c) => {
                  const isOn = chosen.has(c.id);
                  return (
                    <li key={c.id}>
                      <button type="button" className={cx('cchip', isOn && 'on')} aria-pressed={isOn} onClick={() => toggle(c.id)} title={c.cl === 'dep' ? `${nm(c.n)} · ${L('territorio dependiente', 'dependent territory')}` : nm(c.n)}>
                        <Flag code={c.fl} size="sm" />
                        <span>{nm(c.n)}</span>
                        {count ? <small>{count(c)}</small> : section === 'regions' ? <small>{levelOf(c, levels).n}</small> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
        {!groups.length && (
          <p className="empty">
            {qk
              ? L(`Nada coincide con «${query.trim()}».`, `Nothing matches “${query.trim()}”.`)
              : L(`Ningún país cumple esos filtros.${f.dep ? '' : ' Los territorios dependientes están ocultos: actívalos en Filtros.'}`, `No country meets those filters.${f.dep ? '' : ' Dependent territories are hidden: turn them on in Filters.'}`)}
          </p>
        )}
      </div>
    </div>
  );
}
