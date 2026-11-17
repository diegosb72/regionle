/** The settings: every thing in the game by its id, and the short forms it answers to when its name is typed. */
import { ArrowDown, Check, Download, Plus, RotateCcw, Search, TriangleAlert, Upload, X } from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Seg, Spinner, Toggle } from '../components/ui';
import type { World } from '../lib/data';
import { L, nm } from '../lib/i18n';
import { useStore } from '../lib/store';
import { cx, key, looksLikePattern } from '../lib/text';
import { SCOPED, TAB_PATH, TYPEIN_TABS, chipViews, locateTypein, settingsLink, typeinGroups, typeinScopes, type ChipView, type TypeinGroup, type TypeinRow, type TypeinTab } from '../lib/typeinList';
import { MAX_PATTERN, SHIPPED_AUTO, addForm, readTypeinFile, resetForms, switchForm, typeinFile, type AddError, type TypeinSettings } from '../lib/typeins';
import type { Country } from '../lib/types';

const TAB_BY_PATH = Object.fromEntries(TYPEIN_TABS.map((t) => [TAB_PATH[t], t])) as Record<string, TypeinTab | undefined>;

function parsePath(path: string): { tab: TypeinTab | null; scope: string } {
  const [a = '', b = ''] = path.split('/');
  return { tab: TAB_BY_PATH[a] ?? null, scope: /^[A-Z]{2}$/.test(b) ? b : '' };
}

type Only = 'all' | 'short' | 'mine';

/** Rows drawn at first, and how many more each time they are asked for: a list can run to hundreds. */
const PAGE = 80;

const current = (): TypeinSettings => {
  const s = useStore.getState();
  return { auto: s.typeinAuto ?? SHIPPED_AUTO, edits: s.typeins };
};

function addErrorText(why: AddError): string {
  if (why === 'name') return L('Ya vale: es uno de sus nombres.', 'It counts already: it is one of its names.');
  if (why === 'have') return L('Esa ya la tiene.', 'It has that one already.');
  if (why === 'full') return L('Tiene demasiadas: quita alguna antes.', 'It has too many: remove one first.');
  if (why === 'pattern') return L('Ese patrón no se puede leer: revisa sus paréntesis y corchetes.', 'That pattern cannot be read: check its brackets.');
  return L('Escribe letras o números.', 'Type letters or digits.');
}

/** What a short form in force comes to on a map where it is not this thing's alone. */
function clashText(chip: ChipView): string {
  const others = chip.clash ?? [];
  const list = others.length > 3 ? `${others.slice(0, 3).join(', ')}…` : others.join(others.length === 2 ? L(' y ', ' and ') : ', ');
  if (!others.length) return L(`${chip.text}: en este mapa puede ser más de un nombre, y no vale.`, `${chip.text}: on this map it could be more than one name, and does not count.`);
  if (chip.taken) return L(`${chip.text}: en un mapa donde también esté ${list} vale para las dos.`, `${chip.text}: on a map that also holds ${list} it counts for both.`);
  return L(`${chip.text}: no vale en un mapa donde también esté ${list}.`, `${chip.text}: does not count on a map that also holds ${list}.`);
}

const Row = memo(
  function Row({ row, chips, changed }: { row: TypeinRow; chips: ChipView[]; changed: boolean; sig: string }) {
    const [text, setText] = useState('');
    const [why, setWhy] = useState<AddError | null>(null);

    const flip = (chip: ChipView) => {
      const s = useStore.getState();
      s.setTypeins(switchForm(s.typeins, row.id, chip, !chip.on));
    };
    const add = (e: FormEvent) => {
      e.preventDefault();
      if (!text.trim()) return;
      const s = useStore.getState();
      const res = addForm(s.typeins, row.id, text, row.item, current());
      if ('error' in res) return setWhy(res.error);
      s.setTypeins(res.edits);
      setText('');
      setWhy(null);
    };
    const reset = () => {
      const s = useStore.getState();
      s.setTypeins(resetForms(s.typeins, [row.id]));
      setWhy(null);
    };
    const clashes = chips.filter((c) => c.on && c.clash);

    return (
      <li className={cx('ti-row', changed && 'ti-changed')} data-id={row.id}>
        <div className="ti-what">
          <span className="ti-name">{row.name}</span>
          <code className="ti-id">{row.id}</code>
          {row.note && <span className="ti-note">{row.note}</span>}
          {row.also.length > 0 && (
            <span className="ti-also">
              {L('También', 'Also')}: {row.also.join(' · ')}
            </span>
          )}
        </div>
        <div className="ti-side">
          <div className="ti-forms">
            {chips.map((chip) =>
              chip.from === 'own' ? (
                <button key={chip.key} type="button" className={cx('ti-chip ti-own', chip.pattern && 'ti-pat')} onClick={() => flip(chip)} title={L('Añadida por ti. Toca para quitarla.', 'Added by you. Tap to remove it.')} aria-label={L(`Quitar ${chip.text} de ${row.name}`, `Remove ${chip.text} from ${row.name}`)}>
                  <span>{chip.text}</span>
                  <X size={13} aria-hidden="true" />
                </button>
              ) : (
                <button
                  key={chip.key}
                  type="button"
                  className={cx('ti-chip', chip.on ? 'on' : 'off', chip.on && chip.clash && 'clash', chip.pattern && 'ti-pat')}
                  aria-pressed={chip.on}
                  onClick={() => flip(chip)}
                  title={chip.on ? L('Vale. Toca para apagarla.', 'It counts. Tap to switch it off.') : L('No vale. Toca para encenderla.', 'It does not count. Tap to switch it on.')}
                  aria-label={L(`${chip.text} por ${row.name}`, `${chip.text} for ${row.name}`)}
                >
                  {chip.on && (chip.clash ? <TriangleAlert size={13} aria-hidden="true" /> : <Check size={13} aria-hidden="true" />)}
                  <span>{chip.text}</span>
                </button>
              ),
            )}
            <form className="ti-add" onSubmit={add}>
              <input
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setWhy(null);
                }}
                placeholder={L('Añadir…', 'Add…')}
                maxLength={MAX_PATTERN + 2}
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="done"
                aria-label={L(`Añadir una abreviatura a ${row.name}`, `Add a short form to ${row.name}`)}
              />
              <button type="submit" disabled={!text.trim()} aria-label={L('Añadir', 'Add')}>
                <Plus size={14} aria-hidden="true" />
              </button>
            </form>
            {changed && (
              <button type="button" className="ti-reset" onClick={reset} title={L('Dejarla como viene', 'Put it back as it comes')} aria-label={L(`Restablecer ${row.name}`, `Reset ${row.name}`)}>
                <RotateCcw size={14} aria-hidden="true" />
              </button>
            )}
          </div>
          {why && (
            <p className="ti-msg ti-msg-bad" role="status">
              {addErrorText(why)}
            </p>
          )}
          {clashes.map((c) => (
            <p key={c.key} className="ti-msg">
              {clashText(c)}
            </p>
          ))}
        </div>
      </li>
    );
  },
  (a, b) => a.row === b.row && a.sig === b.sig && a.changed === b.changed,
);

const signature = (chips: ChipView[]): string => chips.map((c) => `${c.key}:${c.text}:${c.from}:${c.on ? 1 : 0}:${c.usual ? 1 : 0}:${c.clash ? `${c.taken ? 't' : 'f'}${c.clash.join(',')}` : ''}`).join('|');

export function Settings({ world, path }: { world: World; path: string }) {
  const edits = useStore((s) => s.typeins);
  const auto = useStore((s) => s.typeinAuto) ?? SHIPPED_AUTO;
  const setTypeins = useStore((s) => s.setTypeins);
  const setTypeinAuto = useStore((s) => s.setTypeinAuto);
  const settings = useMemo<TypeinSettings>(() => ({ auto, edits }), [auto, edits]);

  const [tab, setTab] = useState<TypeinTab>(() => parsePath(path).tab ?? 'regions');
  /** The country each list was left on. */
  const [scopes, setScopes] = useState<Record<TypeinTab, string>>(() => {
    const first = parsePath(path);
    const sel = useStore.getState().sel;
    const at = (t: TypeinTab, usual: string) => (first.tab === t && first.scope ? first.scope : usual);
    return { countries: '', physical: '', regions: at('regions', sel.regions[0] ?? 'ES'), cities: at('cities', sel.cities[0] ?? 'ES'), capitals: at('capitals', '') };
  });
  const scope = SCOPED.includes(tab) ? scopes[tab] : '';
  const [scopeList, setScopeList] = useState<Country[]>([]);
  const [groups, setGroups] = useState<TypeinGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [only, setOnly] = useState<Only>('all');
  const [shown, setShown] = useState(PAGE);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const listTop = useRef<HTMLElement>(null);
  const yours = useRef<HTMLElement>(null);

  // A link followed while the screen is open lands on its list.
  const seen = useRef(path);
  useEffect(() => {
    if (seen.current === path) return;
    seen.current = path;
    const next = parsePath(path);
    if (!next.tab) return;
    const t = next.tab;
    setTab(t);
    if (SCOPED.includes(t) && (next.scope || t === 'capitals')) setScopes((s) => ({ ...s, [t]: next.scope }));
  }, [path]);

  // The address follows the list in sight, so that it can be reloaded or sent; the page does not move.
  useEffect(() => {
    const hash = settingsLink(tab, scope);
    if (window.location.hash !== hash) window.history.replaceState(null, '', hash);
  }, [tab, scope]);

  useEffect(() => {
    let alive = true;
    setGroups(null);
    setError(null);
    (async () => {
      const list = SCOPED.includes(tab) ? await typeinScopes(tab) : [];
      if (!alive) return;
      setScopeList(list);
      // A country that has no such list gives way to one that has: Spain if it can be, the first otherwise.
      if (SCOPED.includes(tab) && !list.some((c) => c.id === scope) && !(tab === 'capitals' && !scope)) {
        const usual = tab === 'capitals' ? '' : ((list.find((c) => c.id === 'ES') ?? list[0])?.id ?? '');
        if (usual !== scope) {
          setScopes((s) => ({ ...s, [tab]: usual }));
          return;
        }
      }
      const got = await typeinGroups(tab, scope);
      if (alive) setGroups(got);
    })().catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [tab, scope, attempt]);

  useEffect(() => {
    setShown(PAGE);
  }, [tab, scope, query, only]);

  const views = useMemo(() => (groups ?? []).map((g) => chipViews(g, settings)), [groups, settings]);

  const q = key(query);
  const rawQ = query.trim().toLowerCase();
  const matches = (row: TypeinRow, chips: ChipView[]): boolean => {
    if (only === 'short' && !chips.length) return false;
    if (only === 'mine' && !edits[row.id]) return false;
    if (!rawQ) return true;
    if (row.id.toLowerCase().includes(rawQ)) return true;
    if (!q) return false;
    return key(row.name).includes(q) || (!!row.note && key(row.note).includes(q)) || row.also.some((a) => key(a).includes(q)) || chips.some((c) => c.key.startsWith(q));
  };

  let left = shown;
  let hidden = 0;
  let total = 0;
  const drawn = (groups ?? []).map((g, i) => {
    const all = g.rows.filter((r) => matches(r, views[i].get(r.id) ?? []));
    const rows = all.slice(0, Math.max(0, left));
    left -= rows.length;
    hidden += all.length - rows.length;
    total += all.length;
    return { group: g, view: views[i], rows, count: all.length, withShort: g.rows.filter((r) => (views[i].get(r.id) ?? []).some((c) => c.on)).length };
  });

  const changedIds = Object.keys(edits).sort();
  const scopeCountry = scope ? world.byId.get(scope) : undefined;

  const pick = (t: TypeinTab) => {
    setTab(t);
    setQuery('');
  };

  /** Opens the list a thing is in, with the thing alone in sight. */
  const jump = (id: string) => {
    locateTypein(id)
      .then((at) => {
        if (!at) return setMessage(L(`${id} ya no está entre las piezas del juego.`, `${id} is no longer among the pieces of the game.`));
        setTab(at.tab);
        if (SCOPED.includes(at.tab)) setScopes((s) => ({ ...s, [at.tab]: at.scope }));
        setOnly('all');
        setQuery(id);
        listTop.current?.scrollIntoView({ block: 'start' });
      })
      .catch(() => undefined);
  };

  const exportFile = () => {
    const blob = new Blob([JSON.stringify(typeinFile(settings), null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `regionle-${L('abreviaturas', 'typeins')}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const got = readTypeinFile(JSON.parse(await f.text()));
      if (!got) setMessage(L('Ese archivo no trae abreviaturas de Regionle.', 'That file holds no Regionle short forms.'));
      else {
        setTypeins(got.edits);
        if (got.auto !== undefined) setTypeinAuto(got.auto === SHIPPED_AUTO ? null : got.auto);
        const n = Object.keys(got.edits).length;
        setMessage(L(`Importado: ${n} ${n === 1 ? 'pieza cambiada' : 'piezas cambiadas'}.`, `Imported: ${n} ${n === 1 ? 'piece' : 'pieces'} changed.`));
      }
    } catch {
      setMessage(L('No se ha podido leer el archivo.', 'The file could not be read.'));
    }
    if (file.current) file.current.value = '';
  };

  const tabName: Record<TypeinTab, string> = {
    countries: L('Países', 'Countries'),
    regions: L('Regiones', 'Regions'),
    cities: L('Ciudades', 'Cities'),
    capitals: L('Capitales', 'Capitals'),
    physical: L('Física', 'Physical'),
  };

  return (
    <div className="ti">
      <header className="setup-head">
        <p className="kicker">{L('Configuración', 'Settings')}</p>
        <h1>{L('Qué vale al escribir', 'What you can type')}</h1>
        <p className="lead">
          {L(
            'Todas las piezas del juego, cada una con su id y con las abreviaturas y variantes por las que responde además de por su nombre. Apaga las que no quieras y añade las tuyas: valen en todos los modos en los que se escribe.',
            'Every piece of the game, each with its id and the short forms and variants it answers to besides its name. Switch off the ones you do not want and add your own: they count wherever answers are typed.',
          )}
        </p>
      </header>

      <div className="ti-layout">
        <section className="ti-card ti-rule">
          <h2>{L('Siglas', 'Initials')}</h2>
          <Toggle
            checked={auto}
            onChange={(v) => setTypeinAuto(v === SHIPPED_AUTO ? null : v)}
            hint={L(
              'Un nombre de varias palabras vale por sus iniciales: NZ por Nueva Zelanda, BA por Buenos Aires. Las regiones que traen lista propia no las tienen: en ellas vale lo que se ve encendido. Apagado, de las siglas solo valen las que enciendas tú; EEUU, UK o CDMX no dependen de esto y se apagan una a una.',
              'A name of several words can be typed by its initials: NZ for New Zealand, BA for Buenos Aires. Regions that come with a list of their own have none: what shows switched on is what counts there. Switched off, only the initials you switch on yourself count; USA, UK or CDMX do not depend on this and are switched off one by one.',
            )}
          >
            {L('Siglas automáticas', 'Automatic initials')}
          </Toggle>
          {/* On a narrow screen the list comes next, and what was changed after it. */}
          <button type="button" className="ti-skip" onClick={() => yours.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
            {changedIds.length ? L(`Tus cambios (${changedIds.length}) y copia`, `Your changes (${changedIds.length}) and backup`) : L('Tus cambios y copia', 'Your changes and backup')}
            <ArrowDown size={14} aria-hidden="true" />
          </button>
        </section>

        <section className="ti-main" ref={listTop} aria-label={L('Piezas del juego', 'Pieces of the game')}>
          <div className="ti-bar">
            <Seg label={L('Qué piezas', 'Which pieces')} value={tab} onChange={pick} options={TYPEIN_TABS.map((t) => ({ value: t, label: tabName[t] }))} />
            <div className="ti-find">
              {SCOPED.includes(tab) && (
                <label className="select">
                  <span>{L('País', 'Country')}</span>
                  <select value={scope} onChange={(e) => setScopes((s) => ({ ...s, [tab]: e.target.value }))}>
                    {tab === 'capitals' && <option value="">{L('Todos: capitales de país', 'All: capitals of countries')}</option>}
                    {/* Until the list of countries is here, the one in force stands alone. */}
                    {scope && !scopeList.some((c) => c.id === scope) && <option value={scope}>{scopeCountry ? nm(scopeCountry.n) : scope}</option>}
                    {scopeList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {nm(c.n)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="search">
                <Search size={16} aria-hidden="true" />
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={L('Buscar nombre, id o abreviatura…', 'Search name, id or short form…')} aria-label={L('Buscar pieza', 'Search piece')} />
              </label>
            </div>
            <Seg<Only>
              small
              label={L('Cuáles se ven', 'Which ones show')}
              value={only}
              onChange={setOnly}
              options={[
                { value: 'all', label: L('Todas', 'All') },
                { value: 'short', label: L('Con abreviaturas', 'With short forms') },
                { value: 'mine', label: L('Cambiadas', 'Changed') },
              ]}
            />
          </div>
          <p className="ti-fine ti-legend">
            <span className="ti-key">
              <span className="ti-chip on" aria-hidden="true">
                <Check size={13} />
                <span>NH</span>
              </span>
              {L('vale', 'counts')}
            </span>
            <span className="ti-key">
              <span className="ti-chip off" aria-hidden="true">
                <span>RI</span>
              </span>
              {L('apagada', 'switched off')}
            </span>
            <span className="ti-key">
              <span className="ti-chip ti-own" aria-hidden="true">
                MA
                <X size={13} />
              </span>
              {L('añadida por ti', 'added by you')}
            </span>
            <span className="ti-key">
              <span className="ti-chip on ti-pat" aria-hidden="true">
                <Check size={13} />
                <span>r:^GALI[CZ]I?A</span>
              </span>
              {L('patrón', 'pattern')}
            </span>
            <span className="ti-legend-how">
              {L(
                'Toca una para cambiarla; escribe y pulsa Intro para añadir. Un patrón empieza por r: (una expresión regular) o por c: (letras que basta con que aparezcan) y se prueba sobre lo escrito sin espacios ni tildes, como en JetPunk.',
                'Tap one to change it; type and press Enter to add. A pattern begins with r: (a regular expression) or c: (letters that only have to appear) and is tried on what is typed without spaces or accents, as in JetPunk.',
              )}
            </span>
          </p>

          {error ? (
            <div className="empty-state">
              <p>{L(`No se ha podido cargar la lista (${error}).`, `The list could not be loaded (${error}).`)}</p>
              <button type="button" className="btn btn-primary" onClick={() => setAttempt((n) => n + 1)}>
                {L('Reintentar', 'Retry')}
              </button>
            </div>
          ) : !groups ? (
            <div className="ti-loading">
              <Spinner />
            </div>
          ) : !total ? (
            <p className="empty">
              {groups.every((g) => !g.rows.length)
                ? L('Aquí no hay nada que escribir.', 'There is nothing to type here.')
                : only === 'mine' && !rawQ
                  ? L('No has cambiado ninguna de esta lista.', 'You have changed none in this list.')
                  : L('Nada coincide con lo que buscas.', 'Nothing matches your search.')}
            </p>
          ) : (
            <>
              {drawn.map(({ group, view, rows, count, withShort }) =>
                count ? (
                  <section key={group.key} className="ti-group">
                    <h3>
                      {group.title}
                      <small>
                        {count === group.rows.length
                          ? L(`${group.rows.length} · ${withShort} con abreviaturas`, `${group.rows.length} · ${withShort} with short forms`)
                          : L(`${count} de ${group.rows.length}`, `${count} of ${group.rows.length}`)}
                      </small>
                    </h3>
                    {rows.length > 0 && (
                      <ul className="ti-list">
                        {rows.map((row) => {
                          const chips = view.get(row.id) ?? [];
                          return <Row key={row.id} row={row} chips={chips} sig={signature(chips)} changed={!!edits[row.id]} />;
                        })}
                      </ul>
                    )}
                  </section>
                ) : null,
              )}
              {hidden > 0 && (
                <div className="ti-more">
                  <button type="button" className="btn" onClick={() => setShown((n) => n + PAGE * 2)}>
                    {L(`Mostrar ${Math.min(hidden, PAGE * 2)} más`, `Show ${Math.min(hidden, PAGE * 2)} more`)}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setShown(Number.MAX_SAFE_INTEGER)}>
                    {L(`Mostrar las ${total}`, `Show all ${total}`)}
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        <aside className="ti-card ti-yours" ref={yours}>
          <h2>{L('Tus cambios', 'Your changes')}</h2>
          {changedIds.length ? (
            <>
              <p className="tip-line">
                {L(
                  `Has cambiado ${changedIds.length} ${changedIds.length === 1 ? 'pieza' : 'piezas'}. Toca un id para ir a ella.`,
                  `You have changed ${changedIds.length} ${changedIds.length === 1 ? 'piece' : 'pieces'}. Tap an id to go to it.`,
                )}
              </p>
              <ul className="ti-changes">
                {changedIds.map((id) => (
                  <li key={id}>
                    <button type="button" className="ti-jump" onClick={() => jump(id)} title={L('Ir a esta pieza', 'Go to this piece')}>
                      <code>{id}</code>
                    </button>
                    <span className="ti-diff">
                      {(edits[id].add ?? []).map((a) => (
                        <b key={`+${a}`} className="ti-plus">
                          +{a}
                        </b>
                      ))}
                      {(edits[id].off ?? []).map((k) => (
                        <s key={`-${k}`} className="ti-minus">
                          {looksLikePattern(k) ? k : k.toUpperCase()}
                        </s>
                      ))}
                    </span>
                    <button type="button" className="ti-reset" onClick={() => setTypeins(resetForms(edits, [id]))} aria-label={L(`Restablecer ${id}`, `Reset ${id}`)} title={L('Dejarla como viene', 'Put it back as it comes')}>
                      <RotateCcw size={14} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="tip-line">{L('Ninguno todavía: valen las abreviaturas con las que viene el juego.', 'None yet: the short forms the game comes with apply.')}</p>
          )}
          <div className="backup">
            <button type="button" className="btn btn-sm" onClick={exportFile}>
              <Download size={15} aria-hidden="true" />
              {L('Exportar', 'Export')}
            </button>
            <button type="button" className="btn btn-sm" onClick={() => file.current?.click()}>
              <Upload size={15} aria-hidden="true" />
              {L('Importar', 'Import')}
            </button>
            <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
            {confirming ? (
              <span className="confirm">
                {L('¿Deshacer todos tus cambios?', 'Undo all your changes?')}
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={() => {
                    setTypeins({});
                    setTypeinAuto(null);
                    setConfirming(false);
                    setMessage(L('Todo vuelve a estar como viene.', 'Everything is back as it comes.'));
                  }}
                >
                  {L('Sí, deshacer', 'Yes, undo')}
                </button>
                <button type="button" className="btn btn-sm" onClick={() => setConfirming(false)}>
                  No
                </button>
              </span>
            ) : (
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirming(true)} disabled={!changedIds.length && auto === SHIPPED_AUTO}>
                <RotateCcw size={15} aria-hidden="true" />
                {L('Restablecer todo', 'Reset everything')}
              </button>
            )}
          </div>
          {message && (
            <p className="q-note" role="status">
              {message}
            </p>
          )}
          <p className="ti-fine">{L('Se guarda solo en este navegador. El archivo exportado sirve para llevarlo a otro.', 'It is kept in this browser only. The exported file takes it to another.')}</p>
        </aside>
      </div>
    </div>
  );
}
