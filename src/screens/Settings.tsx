/** The settings: every thing in the game by its id, and the short forms it answers to when its name is typed. */
import { ArrowDown, Check, Download, Plus, RotateCcw, Search, TriangleAlert, Upload, X } from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Seg, Spinner, Toggle } from '../components/ui';
import type { World } from '../lib/data';
import { L, nm } from '../lib/i18n';
import { spellingsOf, type Spellings } from '../lib/spellings';
import { useStore } from '../lib/store';
import { cx, key, looksLikePattern } from '../lib/text';
import { SCOPED, TAB_PATH, TYPEIN_TABS, chipViews, locateTypein, settingsLink, typeinGroups, typeinScopes, type ChipView, type TypeinGroup, type TypeinRow, type TypeinTab } from '../lib/typeinList';
import { MAX_PATTERN, SHIPPED_AUTO, addForm, formKey, readTypeinFile, resetForms, switchForm, typeinFile, type AddError, type TypeinSettings } from '../lib/typeins';
import type { Country } from '../lib/types';

const TAB_BY_PATH = Object.fromEntries(TYPEIN_TABS.map((t) => [TAB_PATH[t], t])) as Record<string, TypeinTab | undefined>;

function parsePath(path: string): { tab: TypeinTab | null; scope: string } {
  const [a = '', b = ''] = path.split('/');
  return { tab: TAB_BY_PATH[a] ?? null, scope: /^[A-Z]{2}$/.test(b) ? b : '' };
}

type Only = 'all' | 'short' | 'mine';

/** Rows drawn at first, and how many more each time they are asked for: a list can run to hundreds. */
const PAGE = 80;

/**
 * A pattern shows as the spellings it takes: all of them while they are this few, the first ones and a
 * way to the rest otherwise.
 */
const FEW = 8;
const FIRST = 6;

/** The spellings of a pattern in a word or two: the first one, and a sign that there are more. */
const firstOf = (spelt: Spellings): string => (spelt.forms.length > 1 || spelt.more ? `${spelt.forms[0]}…` : spelt.forms[0]);

/**
 * How the patterns of the rows that have been in sight were named, by id and pattern: a change made in
 * one list is called the same from another, where the names of the thing are not at hand.
 */
const namedBefore = new Map<string, string>();

/**
 * A short form as the list of changes names it: a pattern, by the first spelling it takes, which is how
 * its row shows it when the row is in sight (`chips`).
 */
function briefly(id: string, text: string, chips?: ChipView[]): string {
  if (!looksLikePattern(text)) return text;
  const k = formKey(text);
  const here = chips?.find((c) => c.key === k)?.spelt;
  if (here) return firstOf(here);
  const before = namedBefore.get(`${id}\n${k}`);
  if (before) return before;
  // Left to the pattern, it is its shortest spelling.
  const bare = spellingsOf(text);
  return bare ? firstOf(bare) : text;
}

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
  const text = chip.spelt ? firstOf(chip.spelt) : chip.text;
  if (!others.length) return L(`${text}: en este mapa puede ser más de un nombre, y no vale.`, `${text}: on this map it could be more than one name, and does not count.`);
  if (chip.taken) return L(`${text}: en un mapa donde también esté ${list} vale para las dos.`, `${text}: on a map that also holds ${list} it counts for both.`);
  return L(`${text}: no vale en un mapa donde también esté ${list}.`, `${text}: does not count on a map that also holds ${list}.`);
}

/** The spellings a pattern takes, in one piece: they count or not together, because they are one pattern. */
function Many({ chip, name, spelt, open, onOpen, onFlip }: { chip: ChipView; name: string; spelt: Spellings; open: boolean; onOpen: () => void; onFlip: () => void }) {
  const total = spelt.forms.length;
  const few = total <= FEW;
  const shown = few || open ? spelt.forms : spelt.forms.slice(0, FIRST);
  const left = total - shown.length;
  const own = chip.from === 'own';
  const several = total > 1 || spelt.more;
  const lost = !own && chip.on && !!chip.clash;
  const said = `${shown.slice(0, 3).join(', ')}${total > 3 || spelt.more ? '…' : ''}`;
  // With all of them in sight, it is said that there are more still: a loose pattern takes more than can be read.
  const tail = spelt.more && (few || open) ? L(' … y muchas más', ' … and many more') : '';
  const title = own
    ? `${several ? L('Añadidas por ti. Toca para quitarlas.', 'Added by you. Tap to remove them.') : L('Añadida por ti. Toca para quitarla.', 'Added by you. Tap to remove it.')} (${chip.text})`
    : chip.on
      ? several
        ? L('Valen. Toca para apagarlas todas.', 'They count. Tap to switch them all off.')
        : L('Vale. Toca para apagarla.', 'It counts. Tap to switch it off.')
      : several
        ? L('No valen. Toca para encenderlas todas.', 'They do not count. Tap to switch them all on.')
        : L('No vale. Toca para encenderla.', 'It does not count. Tap to switch it on.');
  return (
    <span className={cx('ti-chip ti-many', own ? 'ti-own' : chip.on ? 'on' : 'off', lost && 'clash', open && 'ti-open')} data-forms={total}>
      <button type="button" className="ti-many-main" aria-pressed={own ? undefined : chip.on} onClick={onFlip} title={title} aria-label={own ? L(`Quitar ${said} de ${name}`, `Remove ${said} from ${name}`) : L(`${said} por ${name}`, `${said} for ${name}`)}>
        {!own && chip.on && (lost ? <TriangleAlert size={13} aria-hidden="true" /> : <Check size={13} aria-hidden="true" />)}
        <span>
          {/* A line may end after a dot, never before one. */}
          {shown.join('\u00a0· ')}
          {tail}
        </span>
        {own && <X size={13} aria-hidden="true" />}
      </button>
      {!few && (
        <button type="button" className="ti-many-more" aria-expanded={open} onClick={onOpen} title={open ? L('Ver solo las primeras', 'Show the first ones only') : L('Ver todas las variantes', 'Show every variant')}>
          {open ? L('menos', 'less') : spelt.more ? L('+más', '+more') : `+${left}`}
        </button>
      )}
    </span>
  );
}

const Row = memo(
  function Row({ row, chips, changed }: { row: TypeinRow; chips: ChipView[]; changed: boolean; sig: string }) {
    const [text, setText] = useState('');
    const [why, setWhy] = useState<AddError | null>(null);
    /** The pattern whose spellings are all in sight. */
    const [open, setOpen] = useState<string | null>(null);

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
            {chips.map((chip) => {
              if (chip.spelt) return <Many key={chip.key} chip={chip} name={row.name} spelt={chip.spelt} open={open === chip.key} onOpen={() => setOpen(open === chip.key ? null : chip.key)} onFlip={() => flip(chip)} />;
              // A pattern written with signs that cannot be spelt out stays as it was written.
              return chip.from === 'own' ? (
                <button key={chip.key} type="button" className={cx('ti-chip ti-own', chip.pattern && 'ti-raw')} onClick={() => flip(chip)} title={L('Añadida por ti. Toca para quitarla.', 'Added by you. Tap to remove it.')} aria-label={L(`Quitar ${chip.text} de ${row.name}`, `Remove ${chip.text} from ${row.name}`)}>
                  <span>{chip.text}</span>
                  <X size={13} aria-hidden="true" />
                </button>
              ) : (
                <button
                  key={chip.key}
                  type="button"
                  className={cx('ti-chip', chip.on ? 'on' : 'off', chip.on && chip.clash && 'clash', chip.pattern && 'ti-raw')}
                  aria-pressed={chip.on}
                  onClick={() => flip(chip)}
                  title={chip.on ? L('Vale. Toca para apagarla.', 'It counts. Tap to switch it off.') : L('No vale. Toca para encenderla.', 'It does not count. Tap to switch it on.')}
                  aria-label={L(`${chip.text} por ${row.name}`, `${chip.text} for ${row.name}`)}
                >
                  {chip.on && (chip.clash ? <TriangleAlert size={13} aria-hidden="true" /> : <Check size={13} aria-hidden="true" />)}
                  <span>{chip.text}</span>
                </button>
              );
            })}
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

/** What a row shows of its short forms. The spellings of a pattern change only by those that it loses to other things. */
const signature = (chips: ChipView[]): string => chips.map((c) => `${c.key}:${c.text}:${c.from}:${c.on ? 1 : 0}:${c.usual ? 1 : 0}:${c.clash ? `${c.taken ? 't' : 'f'}${c.clash.join(',')}` : ''}:${c.lost?.join(',') ?? ''}`).join('|');

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
  useEffect(() => {
    for (const view of views) for (const [id, chips] of view) for (const c of chips) if (c.spelt) namedBefore.set(`${id}\n${c.key}`, firstOf(c.spelt));
  }, [views]);

  const q = key(query);
  const rawQ = query.trim().toLowerCase();
  const matches = (row: TypeinRow, chips: ChipView[]): boolean => {
    if (only === 'short' && !chips.length) return false;
    if (only === 'mine' && !edits[row.id]) return false;
    if (!rawQ) return true;
    if (row.id.toLowerCase().includes(rawQ)) return true;
    if (!q) return false;
    if (key(row.name).includes(q) || (!!row.note && key(row.note).includes(q)) || row.also.some((a) => key(a).includes(q))) return true;
    // A pattern is found by the spellings it shows, as any other short form is by its own.
    const Q = q.toUpperCase();
    return chips.some((c) => (c.spelt ? c.spelt.forms.some((f) => f.startsWith(Q)) : c.key.startsWith(q)));
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
  /** The short forms of a row in sight: a pattern among the changes is named the way its row shows it. */
  const chipsFor = (id: string): ChipView[] | undefined => views.find((v) => v.has(id))?.get(id);
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
              <span className="ti-chip on ti-many" aria-hidden="true">
                <span className="ti-many-main">
                  <Check size={13} />
                  <span>GALICIA · GALIZA</span>
                </span>
              </span>
              {L('variantes que van juntas', 'variants that go together')}
            </span>
            <span className="ti-legend-how">
              {L(
                'Toca una para cambiarla; escribe y pulsa Intro para añadir. Las variantes que van juntas se encienden y se apagan a la vez, y +N las enseña todas. Van sin espacios ni tildes, que al escribir no cuentan, y basta con que lo escrito empiece por una de ellas. Para añadir varias de golpe vale un patrón como los de JetPunk (con r: o c: delante): se verá con las variantes que acepta.',
                'Tap one to change it; type and press Enter to add. Variants that go together are switched on and off as one, and +N shows them all. They are written without spaces or accents, which do not count when typing, and it is enough for what is typed to begin with one of them. To add several at once, a pattern like those of JetPunk will do (with r: or c: in front): it shows as the variants it takes.',
              )}
            </span>
          </p>
          {tab === 'regions' && (
            <p className="ti-fine ti-codes">
              {L(
                'El código gris de cada pieza es el suyo en la norma ISO 3166-2; los que llevan una x son del juego, para las piezas que la norma no recoge.',
                'The grey code of each piece is its own in ISO 3166-2; those with an x are the game’s, for pieces the standard does not list.',
              )}
              {(groups?.length ?? 0) > 1 &&
                ` ${L('Cada nivel tiene sus códigos, todos en vigor, así que una misma tierra puede salir dos veces', 'Each level has its codes, all of them in force, so the same land can show up twice')}${
                  scope === 'ES' ? L(': Asturias es ES-AS como comunidad autónoma y ES-O como provincia.', ': Asturias is ES-AS as an autonomous community and ES-O as a province.') : '.'
                }`}
            </p>
          )}

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
                        <b key={`+${a}`} className="ti-plus" title={looksLikePattern(a) ? a : undefined}>
                          +{briefly(id, a, chipsFor(id))}
                        </b>
                      ))}
                      {(edits[id].off ?? []).map((k) => (
                        <s key={`-${k}`} className="ti-minus">
                          {looksLikePattern(k) ? briefly(id, k, chipsFor(id)) : k.toUpperCase()}
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
