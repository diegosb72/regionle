/**
 * The editor of custom lists: the map of the selection, on which the player marks the pieces that the
 * list is made of ("the twelve for Thursday's exam"). Not a game: nothing is asked and nothing is scored.
 */
import { Check, Save, Search, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { MapView, type MapHandle, type Paint } from '../components/MapView';
import { Flag } from '../components/ui';
import { L, getLang } from '../lib/i18n';
import { LIST_MAX, LIST_NAME_MAX, newListId } from '../lib/lists';
import { MODE_NAME } from '../lib/modes';
import { useStore, type CustomList } from '../lib/store';
import { cx, key, nf } from '../lib/text';
import { GameShell, showsCountry, type GameProps } from './common';

/** Rows of the list of pieces drawn at once: a map of thousands is narrowed down by searching. */
const ROWS = 300;

export function ListEditor({ deck, cfg, onExit }: GameProps) {
  const editing = useStore((s) => s.lists.find((l) => l.id === cfg.listId));
  const saveList = useStore((s) => s.saveList);
  const setListOn = useStore((s) => s.setListOn);
  const [ids, setIds] = useState<Set<string>>(() => new Set((editing?.ids ?? cfg.only ?? []).filter((id) => deck.byId.has(id))));
  const [name, setName] = useState(editing?.name ?? '');
  const [query, setQuery] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
  const [nudge, setNudge] = useState<string | null>(null);
  const map = useRef<MapHandle>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const several = showsCountry(deck);
  const fem = deck.noun.fem;

  const sorted = useMemo(() => [...deck.items].sort((a, b) => a.name.localeCompare(b.name, getLang())), [deck]);
  const shown = useMemo(() => {
    const k = key(query);
    return sorted.filter((it) => (!onlyMine || ids.has(it.id)) && (!k || it.answers.some((a) => key(a).includes(k))));
  }, [sorted, query, onlyMine, ids]);

  const toggle = (id: string) => {
    if (!ids.has(id) && ids.size >= LIST_MAX) return setNudge(L(`Una lista admite hasta ${LIST_MAX} piezas.`, `A list holds up to ${LIST_MAX} pieces.`));
    setNudge(null);
    setIds((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  };

  const paint = useMemo(() => {
    const p: Record<string, Paint> = {};
    for (const id of ids) p[id] = 'sel';
    return p;
  }, [ids]);

  const save = () => {
    const clean = name.replace(/\s+/g, ' ').trim().slice(0, LIST_NAME_MAX);
    if (!clean) {
      setNudge(L('Ponle un nombre a la lista para poder guardarla.', 'Give the list a name to save it.'));
      nameRef.current?.focus();
      return;
    }
    if (ids.size < 2) {
      setNudge(L(`Elige al menos dos ${deck.noun.many}.`, `Choose at least two ${deck.noun.many}.`));
      return;
    }
    const list: CustomList = {
      id: editing?.id ?? newListId(),
      name: clean,
      section: cfg.section,
      countries: cfg.countries,
      levels: Object.fromEntries(Object.entries(cfg.levels).filter(([id]) => cfg.countries.includes(id))),
      // In the order of the map, so that the same choice always gives the same list.
      ids: deck.items.filter((it) => ids.has(it.id)).map((it) => it.id),
    };
    if (cfg.section === 'cities') {
      list.cityPick = cfg.opts.cityPick;
      list.cityCount = cfg.opts.cityCount;
    }
    saveList(list);
    setListOn(cfg.section, list.id);
    onExit();
  };

  return (
    <GameShell
      title={MODE_NAME.edit}
      subtitle={deck.title}
      onExit={onExit}
      hud={
        <span className="hud-chip hud-main" title={L('Piezas en la lista', 'Pieces on the list')}>
          {nf(ids.size)}
        </span>
      }
      stage={<MapView ref={map} deck={deck} paint={paint} pickable onPick={toggle} labels={ids} tip={(id) => deck.byId.get(id)?.name} />}
      panel={
        <div className="q editor">
          <div className="q-prompt">
            <p className="kicker">{editing ? L('Editar lista', 'Edit list') : L('Lista nueva', 'New list')}</p>
            <h2 className="q-ask">{L(`Marca ${fem ? 'las' : 'los'} ${deck.noun.many} que quieres practicar`, `Mark the ${deck.noun.many} you want to practise`)}</h2>
            <p className="q-sub">{L(`Tócal${fem ? 'as' : 'os'} en el mapa o en la lista de abajo. Luego podrás jugar solo con ell${fem ? 'as' : 'os'} en cualquier modo y pasarle la lista a quien quieras con un enlace.`, 'Tap them on the map or in the list below. You can then play with just those in any mode and pass the list on to anyone with a link.')}</p>
          </div>

          <label className="field">
            <span>{L('Nombre de la lista', 'Name of the list')}</span>
            <input ref={nameRef} type="text" value={name} maxLength={LIST_NAME_MAX} onChange={(e) => setName(e.target.value)} placeholder={L('Examen del jueves', "Thursday's exam")} autoComplete="off" />
          </label>

          <div className="editor-bar">
            <label className="search">
              <Search size={16} aria-hidden="true" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={L(`Buscar entre ${nf(deck.items.length)} ${deck.noun.many}…`, `Search ${nf(deck.items.length)} ${deck.noun.many}…`)} aria-label={L('Buscar', 'Search')} />
            </label>
            <button type="button" className={cx('chip', onlyMine && 'on')} aria-pressed={onlyMine} onClick={() => setOnlyMine(!onlyMine)}>
              {L(`En la lista: ${nf(ids.size)}`, `On the list: ${nf(ids.size)}`)}
            </button>
          </div>

          <ul className="index editor-index">
            {shown.slice(0, ROWS).map((it) => {
              const on = ids.has(it.id);
              return (
                <li key={it.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    className={on ? 'on' : undefined}
                    onClick={() => {
                      toggle(it.id);
                      if (!on) map.current?.focus([it.id]);
                    }}
                  >
                    <i className={cx('tick', on && 'on')} aria-hidden="true">
                      {on && <Check size={12} strokeWidth={3.5} />}
                    </i>
                    {(it.kind === 'country' || several) && <Flag code={it.country.fl} size="sm" />}
                    {it.kind === 'feature' && <i className={`kdot kdot-${it.cat}`} aria-hidden="true" />}
                    <span>{it.name}</span>
                  </button>
                </li>
              );
            })}
            {shown.length > ROWS && <li className="more">{L(`…y ${nf(shown.length - ROWS)} más: afina la búsqueda.`, `…and ${nf(shown.length - ROWS)} more: narrow the search.`)}</li>}
            {!shown.length && <li className="more">{onlyMine && !query ? L('Todavía no has marcado nada.', 'Nothing marked yet.') : L('Nada coincide.', 'Nothing matches.')}</li>}
          </ul>

          {nudge && (
            <p className="q-note" role="status">
              {nudge}
            </p>
          )}

          <div className="q-actions">
            <button type="button" className="btn btn-primary" onClick={save}>
              <Save size={16} aria-hidden="true" />
              {L(`Guardar lista (${nf(ids.size)})`, `Save list (${nf(ids.size)})`)}
            </button>
            {ids.size > 0 && (
              <button type="button" className="btn btn-sm" onClick={() => setIds(new Set())}>
                <X size={15} aria-hidden="true" />
                {L('Vaciar', 'Clear')}
              </button>
            )}
            <button type="button" className="btn btn-sm btn-ghost q-end" onClick={onExit}>
              {L('Cancelar', 'Cancel')}
            </button>
          </div>
        </div>
      }
    />
  );
}
