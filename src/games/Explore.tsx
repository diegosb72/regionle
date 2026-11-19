/** Explore: no questions, just the map with names, facts and links to study. */
import { NotebookPen, Search } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { PieceHistory } from '../components/History';
import { MapView, type MapHandle, type Paint } from '../components/MapView';
import { PieceNote } from '../components/Note';
import { SpeakButton } from '../components/Speak';
import { WikiCard } from '../components/WikiCard';
import { Flag, LinkPill, StudyLinks, Toggle, capitalise } from '../components/ui';
import { L, capName, getLang, nm } from '../lib/i18n';
import { divisionsLink } from '../lib/links';
import { MODE_NAME } from '../lib/modes';
import { useStore, isLearnt } from '../lib/store';
import { fmtArea, fmtPop, key, nf } from '../lib/text';
import type { Item } from '../lib/types';
import { GameShell, showsCountry, type GameProps } from './common';

export function ExploreGame({ deck, cfg, onExit, onAgain }: GameProps) {
  const [sel, setSel] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [names, setNames] = useState(true);
  const map = useRef<MapHandle>(null);
  const stats = useStore((s) => s.stats);
  const notes = useStore((s) => s.notes);
  const item = sel ? deck.byId.get(sel) : null;
  const nameOf = useCallback((id: string) => deck.byId.get(id)?.name, [deck]);
  const several = showsCountry(deck);
  const fem = deck.noun.fem;

  /** With a custom list, the map is about its pieces: the rest stays in the background. */
  const listed = useMemo(() => (cfg.list && cfg.only ? new Set(cfg.only) : null), [cfg.list, cfg.only]);
  const sorted = useMemo(() => deck.items.filter((it) => !listed || listed.has(it.id)).sort((a, b) => a.name.localeCompare(b.name, getLang())), [deck, listed]);
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
    if (listed) for (const it of deck.items) if (!listed.has(it.id)) p[it.id] = 'dim';
    if (item) {
      for (const id of item.nb) p[id] = 'near';
      for (const id of item.sl) p[id] = 'near';
      p[item.id] = 'sel';
    }
    return p;
  }, [item, listed, deck]);

  const pinned = useMemo(() => (sel ? new Set([sel]) : undefined), [sel]);
  const learnt = (it: Item) => isLearnt(stats[`loc:${it.id}`]) && isLearnt(stats[`name:${it.id}`]);
  /** The other name worth showing: the English one for a Spanish reader and the other way round. */
  const other = (it: Item): string | null => {
    const alt = getLang() === 'en' ? it.answers[0] : it.en;
    return alt && alt !== it.name ? alt : null;
  };

  return (
    <GameShell
      title={MODE_NAME.explore}
      subtitle={cfg.list ? `${deck.title} · ${cfg.list}` : deck.title}
      onExit={onExit}
      stage={<MapView ref={map} deck={deck} paint={paint} pickable onPick={(id) => choose(id, false)} labels={names ? (listed ?? 'all') : undefined} pinned={pinned} tip={(id) => deck.byId.get(id)?.name} />}
      panel={
        <div className="q explore">
          {item ? (
            <div className="card-item">
              <p className="kicker">
                {capitalise(item.type)}
                {item.parent ? ` · ${item.parent}` : ''}
              </p>
              <h2 className="q-name">
                {item.kind === 'country' && <Flag code={item.country.fl} size="md" />} {item.name} <SpeakButton key={item.id} text={item.name} />
              </h2>
              {(other(item) || (item.lo && item.lo !== item.en && item.lo !== item.name)) && (
                <p className="q-sub">
                  {other(item) ? `${L('En inglés', 'In Spanish')}: ${other(item)}` : ''}
                  {item.lo && item.lo !== item.en && item.lo !== item.name ? `${other(item) ? ' · ' : ''}${L('nombre local', 'local name')}: ${item.lo}` : ''}
                </p>
              )}
              <dl className="datalist">
                {(item.kind === 'unit' || item.kind === 'city') && (
                  <div>
                    <dt>{L('País', 'Country')}</dt>
                    <dd>
                      <Flag code={item.country.fl} size="sm" /> {nm(item.country.n)}
                    </dd>
                  </div>
                )}
                {/* Where it is: the country whose map this is, or its continent. A continent is in none, and an ocean washes several. */}
                {item.kind === 'feature' && item.cat !== 'continent' && item.cat !== 'ocean' && (
                  <div>
                    <dt>{item.country.id.startsWith('@in:') ? L('País', 'Country') : L('Continente', 'Continent')}</dt>
                    <dd>{nm(item.country.n)}</dd>
                  </div>
                )}
                {item.kind === 'country' && item.country.cap && (
                  <div>
                    <dt>{L('Capital', 'Capital')}</dt>
                    <dd>{capName(item.country.cap)}</dd>
                  </div>
                )}
                {item.kind === 'unit' && item.capital?.length ? (
                  <div>
                    <dt>{L('Capital', 'Capital')}</dt>
                    <dd>{item.capital[0]}</dd>
                  </div>
                ) : null}
                {item.kind === 'city' && (item.cap ?? 0) > 0 && (
                  <div>
                    <dt>{L('Es', 'It is')}</dt>
                    <dd>{item.cap === 3 ? L('la capital del país', 'the national capital') : item.cap === 2 ? L('la segunda capital del país', 'the second national capital') : L('capital de región', 'a regional capital')}</dd>
                  </div>
                )}
                {item.kind === 'country' && item.country.pop != null && (
                  <div>
                    <dt>{L('Población', 'Population')}</dt>
                    <dd>
                      {fmtPop(item.country.pop)}
                      {item.country.py ? ` (${item.country.py})` : ''}
                    </dd>
                  </div>
                )}
                {item.kind === 'city' && item.pop ? (
                  <div>
                    <dt>{L('Área urbana', 'Urban area')}</dt>
                    <dd>{fmtPop(item.pop)}</dd>
                  </div>
                ) : null}
                {item.area > 0 && (
                  <div>
                    <dt>{L('Superficie', 'Area')}</dt>
                    <dd>{fmtArea(item.area)}</dd>
                  </div>
                )}
                {item.elev != null && (
                  <div>
                    <dt>{L('Altitud', 'Height')}</dt>
                    <dd>{nf(item.elev)} m</dd>
                  </div>
                )}
              </dl>
              {(item.nb.length > 0 || item.sl.length > 0) && (
                <>
                  <p className="label">{L('Limita con', 'Borders')}</p>
                  <ul className="chips">
                    {[...item.nb, ...item.sl].map((id) => (
                      <li key={id}>
                        <button type="button" className="chip" onClick={() => choose(id)}>
                          {deck.byId.get(id)?.name}
                          {item.sl.includes(id) && <small> {L('por mar', 'by sea')}</small>}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <PieceNote key={`note:${item.id}`} id={item.id} open />
              <PieceHistory id={item.id} nameOf={nameOf} />
              {cfg.opts.wiki && <WikiCard key={item.id} item={item} />}
              <p className="label">{L('Para aprender más', 'To learn more')}</p>
              <StudyLinks item={item} report />
              {deck.scope === 'regions' && (
                <div className="links">
                  <LinkPill link={divisionsLink(item.country)} />
                </div>
              )}
            </div>
          ) : (
            <div className="q-prompt">
              <p className="kicker">{L('Sin preguntas', 'No questions')}</p>
              <h2 className="q-ask">{L(`Toca ${fem ? 'una' : 'un'} ${deck.noun.one} para ver su ficha`, `Tap a ${deck.noun.one} to see its card`)}</h2>
              <p className="q-sub">{L(`Datos y enlaces para estudiar. Cuando te suene el mapa, pasa a «${MODE_NAME.pin}».`, `Facts and links to study. Once the map looks familiar, move on to “${MODE_NAME.pin}”.`)}</p>
            </div>
          )}

          <Toggle checked={names} onChange={setNames}>
            {L('Nombres en el mapa', 'Names on the map')}
          </Toggle>

          <label className="search">
            <Search size={16} aria-hidden="true" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={L(`Buscar entre ${sorted.length} ${deck.noun.many}…`, `Search ${sorted.length} ${deck.noun.many}…`)} aria-label={L('Buscar', 'Search')} />
          </label>
          <ul className="index">
            {shown.slice(0, 400).map((it) => (
              <li key={it.id}>
                <button type="button" className={it.id === sel ? 'on' : undefined} onClick={() => choose(it.id)}>
                  {(it.kind === 'country' || several) && <Flag code={it.country.fl} size="sm" />}
                  {it.kind === 'feature' && <i className={`kdot kdot-${it.cat}`} aria-hidden="true" />}
                  <span>{it.name}</span>
                  {notes[it.id] && <NotebookPen className="noted" size={13} aria-label={L('Con apunte', 'With a note')} />}
                  {learnt(it) && <i className="learnt" title={L('Aprendido: lo sitúas y lo nombras', 'Learnt: you can place it and name it')} />}
                </button>
              </li>
            ))}
            {shown.length > 400 && <li className="more">{L(`…y ${shown.length - 400} más: afina la búsqueda.`, `…and ${shown.length - 400} more: narrow the search.`)}</li>}
            {!shown.length && <li className="more">{L('Nada coincide.', 'Nothing matches.')}</li>}
          </ul>

          <div className="q-actions">
            <button type="button" className="btn btn-primary" onClick={() => onAgain({ mode: 'pin', only: cfg.only, list: cfg.list })}>
              {L('Ponerme a prueba', 'Test myself')}
            </button>
          </div>
        </div>
      }
    />
  );
}
