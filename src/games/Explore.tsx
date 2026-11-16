/** Explore: no questions, just the map with names, facts and links to study. */
import { Search } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { MapView, type MapHandle, type Paint } from '../components/MapView';
import { Flag, LinkPill, StudyLinks, Toggle, capitalise } from '../components/ui';
import { divisionsLink } from '../lib/links';
import { useStore, isLearnt } from '../lib/store';
import { fmtArea, fmtPop, key } from '../lib/text';
import type { Item } from '../lib/types';
import { GameShell, type GameProps } from './common';

export function ExploreGame({ deck, onExit, onAgain }: GameProps) {
  const [sel, setSel] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [names, setNames] = useState(true);
  const map = useRef<MapHandle>(null);
  const stats = useStore((s) => s.stats);
  const item = sel ? deck.byId.get(sel) : null;
  const several = deck.countries.length > 1 && deck.scope === 'regions';

  const sorted = useMemo(() => [...deck.items].sort((a, b) => a.name.localeCompare(b.name, 'es')), [deck]);
  const shown = useMemo(() => {
    const k = key(query);
    return k ? sorted.filter((it) => it.answers.some((a) => key(a).includes(k))) : sorted;
  }, [sorted, query]);

  const choose = (id: string, move = true) => {
    setSel(id);
    if (move) map.current?.focus([id], { fill: 0.4 });
  };

  const paint = useMemo(() => {
    const p: Record<string, Paint> = {};
    if (item) {
      for (const id of item.nb) p[id] = 'near';
      for (const id of item.sl) p[id] = 'near';
      p[item.id] = 'sel';
    }
    return p;
  }, [item]);

  const pinned = useMemo(() => (sel ? new Set([sel]) : undefined), [sel]);
  const learnt = (it: Item) => isLearnt(stats[`loc:${it.id}`]) && isLearnt(stats[`name:${it.id}`]);

  return (
    <GameShell
      title="Explorar"
      subtitle={deck.title}
      onExit={onExit}
      stage={<MapView ref={map} deck={deck} paint={paint} pickable onPick={(id) => choose(id, false)} labels={names ? 'all' : undefined} pinned={pinned} tip={(id) => deck.byId.get(id)?.name} />}
      panel={
        <div className="q explore">
          {item ? (
            <div className="card-item">
              <p className="kicker">
                {capitalise(item.type)}
                {item.parent ? ` · ${item.parent}` : ''}
              </p>
              <h2 className="q-name">
                {item.kind === 'country' && <Flag code={item.country.fl} size="md" />} {item.name}
              </h2>
              {item.en !== item.name && <p className="q-sub">En inglés: {item.en}{item.lo && item.lo !== item.en && item.lo !== item.name ? ` · nombre local: ${item.lo}` : ''}</p>}
              <dl className="datalist">
                {item.kind === 'unit' && (
                  <div>
                    <dt>País</dt>
                    <dd>
                      <Flag code={item.country.fl} size="sm" /> {item.country.n.es}
                    </dd>
                  </div>
                )}
                {item.kind === 'country' && item.country.cap && (
                  <div>
                    <dt>Capital</dt>
                    <dd>{item.country.cap.es}</dd>
                  </div>
                )}
                {item.kind === 'country' && item.country.pop != null && (
                  <div>
                    <dt>Población</dt>
                    <dd>
                      {fmtPop(item.country.pop)}
                      {item.country.py ? ` (${item.country.py})` : ''}
                    </dd>
                  </div>
                )}
                <div>
                  <dt>Superficie</dt>
                  <dd>{fmtArea(item.area)}</dd>
                </div>
              </dl>
              {(item.nb.length > 0 || item.sl.length > 0) && (
                <>
                  <p className="label">Limita con</p>
                  <ul className="chips">
                    {[...item.nb, ...item.sl].map((id) => (
                      <li key={id}>
                        <button type="button" className="chip" onClick={() => choose(id)}>
                          {deck.byId.get(id)?.name}
                          {item.sl.includes(id) && <small> por mar</small>}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <p className="label">Para aprender más</p>
              <StudyLinks item={item} />
              {deck.scope === 'regions' && (
                <div className="links">
                  <LinkPill link={divisionsLink(item.country)} />
                </div>
              )}
            </div>
          ) : (
            <div className="q-prompt">
              <p className="kicker">Sin preguntas</p>
              <h2 className="q-ask">Toca {deck.noun.fem ? 'una' : 'un'} {deck.noun.one} para ver su ficha</h2>
              <p className="q-sub">Vecinos, datos y enlaces para estudiar. Cuando te suene el mapa, pasa a «Señalar».</p>
            </div>
          )}

          <Toggle checked={names} onChange={setNames}>
            Nombres en el mapa
          </Toggle>

          <label className="search">
            <Search size={16} aria-hidden="true" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Buscar entre ${deck.items.length} ${deck.noun.many}…`} aria-label="Buscar" />
          </label>
          <ul className="index">
            {shown.slice(0, 400).map((it) => (
              <li key={it.id}>
                <button type="button" className={it.id === sel ? 'on' : undefined} onClick={() => choose(it.id)}>
                  {(it.kind === 'country' || several) && <Flag code={it.country.fl} size="sm" />}
                  <span>{it.name}</span>
                  {learnt(it) && <i className="learnt" title="Aprendida: la sitúas y la nombras" />}
                </button>
              </li>
            ))}
            {shown.length > 400 && <li className="more">…y {shown.length - 400} más: afina la búsqueda.</li>}
            {!shown.length && <li className="more">Nada coincide.</li>}
          </ul>

          <div className="q-actions">
            <button type="button" className="btn btn-primary" onClick={() => onAgain({ mode: 'pin' })}>
              Ponerme a prueba
            </button>
          </div>
        </div>
      }
    />
  );
}
