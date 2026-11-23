/**
 * The gallery of flags: those of the countries, which the game has always had, and those of the divisions of
 * the maps and of the capitals (lib/flags.ts), each with who made its file and on what terms it is given.
 * It is what there is of the section «Banderas» until its games are written: a place to look at them all,
 * and to say when one is not right.
 */
import { ExternalLink, MessageSquareWarning, Search } from 'lucide-react';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Dialog } from '../components/Dialog';
import { Seg, Spinner, capitalise } from '../components/ui';
import { capitalFlags, commonsPage, countryFlags, flagsPageOf, flagsRest, levelOf, loadFlagCredits, loadFlags, regionCounts, regionFlags, searchFlags, type CreditsFile, type FlagCard, type FlagsFile, type FlagsPage } from '../lib/flags';
import { L, getLang, nm } from '../lib/i18n';
import { reportUrl } from '../lib/report';
import { go } from '../lib/router';
import { FLAGS_PATH } from '../lib/routes';
import { cx, nf } from '../lib/text';
import type { Country } from '../lib/types';
import { VERSION } from '../lib/version';
import type { World } from '../lib/world';
import './flags.css';

/**
 * The shape of a flag, for the box it is shown in (four by three, like the flags of the countries): the
 * styles work out from it a width that fills the box across when the flag is wider than the box, and from
 * top to bottom when it is narrower.
 */
const shape = (ratio: number): CSSProperties => ({ '--r': String(ratio) }) as CSSProperties;

const show = (page: FlagsPage): void => go(flagsRest(page) ? `${FLAGS_PATH}/${flagsRest(page)}` : FLAGS_PATH);

function Tile({ card, under, onOpen }: { card: FlagCard; under?: string; onOpen(card: FlagCard): void }) {
  return (
    <li>
      <button type="button" className="fg-tile" onClick={() => onOpen(card)}>
        <span className="fg-box">
          <img style={shape(card.ratio)} src={card.small} alt="" loading="lazy" decoding="async" draggable={false} />
        </span>
        <span className="fg-name">{card.name}</span>
        {under && <small>{under}</small>}
      </button>
    </li>
  );
}

function Grid({ cards, under, onOpen }: { cards: readonly FlagCard[]; under?: (card: FlagCard) => string | undefined; onOpen(card: FlagCard): void }) {
  return (
    <ul className="fg-grid">
      {cards.map((card) => (
        <Tile key={card.key} card={card} under={under?.(card)} onOpen={onOpen} />
      ))}
    </ul>
  );
}

/** What a flag is of, under its name: «comunidad autónoma · España». */
function whatOf(card: FlagCard, country: Country | undefined): string {
  const where = country ? nm(country.n) : card.country;
  if (card.kind === 'country') return L('País o territorio', 'Country or territory');
  if (card.kind === 'capital') return `${L('Capital', 'Capital')} · ${where}`;
  const level = levelOf(country, card.level ?? 0);
  // The name of a level is kept in the singular only in Spanish.
  return `${level ? capitalise(getLang() === 'en' ? level.en : level.sg) : L('División', 'Division')} · ${where}`;
}

/** A flag by itself, larger, with whose its file is. */
function Detail({ card, country, onClose }: { card: FlagCard; country: Country | undefined; onClose(): void }) {
  const [credits, setCredits] = useState<CreditsFile | null>(null);
  const [lost, setLost] = useState(false);
  useEffect(() => {
    if (!card.file) return;
    let alive = true;
    loadFlagCredits().then(
      (file) => alive && setCredits(file),
      () => alive && setLost(true),
    );
    return () => {
      alive = false;
    };
  }, [card.file]);
  const credit = card.file ? credits?.files[card.file] : undefined;
  const licence = credit ? credits?.licences[credit[2]] : undefined;
  const item = { id: card.id, name: card.name, kind: card.kind === 'country' ? ('country' as const) : card.kind === 'capital' ? ('city' as const) : ('unit' as const), type: L('bandera', 'flag'), country: country as Country };

  return (
    <Dialog title={card.name} className="fg-dlg" onClose={onClose}>
      <p className="fg-what">{whatOf(card, country)}</p>
      <div className="fg-big">
        <img style={shape(card.ratio)} src={card.src} alt={L(`Bandera de ${card.name}`, `Flag of ${card.name}`)} draggable={false} />
      </div>
      {card.file ? (
        <dl className="fg-credit">
          {credit ? (
            <>
              <div>
                <dt>{L('Archivo', 'File')}</dt>
                <dd>
                  <a href={commonsPage(credit[0])} target="_blank" rel="noopener noreferrer">
                    {credit[0]}
                    <ExternalLink size={13} aria-hidden="true" />
                  </a>
                </dd>
              </div>
              <div>
                <dt>{L('Autor', 'Author')}</dt>
                <dd>{credit[1] || L('No consta', 'Not stated')}</dd>
              </div>
              <div>
                <dt>{L('Licencia', 'Licence')}</dt>
                <dd>
                  {licence?.[1] ? (
                    <a href={licence[1]} target="_blank" rel="noopener noreferrer">
                      {licence[0]}
                    </a>
                  ) : (
                    (licence?.[0] ?? '')
                  )}
                </dd>
              </div>
            </>
          ) : (
            <div>
              <dt>{L('Archivo', 'File')}</dt>
              <dd>{lost ? L('No se ha podido leer de quién es.', 'Whose it is could not be read.') : L('Cargando…', 'Loading…')}</dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="fg-note">{L('De la colección flag-icons (licencia MIT), con la que viene el juego.', 'From the flag-icons collection (MIT licence), which the game comes with.')}</p>
      )}
      {card.file && (
        <p className="fg-note">
          {card.file.endsWith('.svg')
            ? L('Tomada de Wikimedia Commons. El dibujo se ha aligerado sin cambiar lo que se ve.', 'Taken from Wikimedia Commons. The drawing has been made lighter without changing what is seen.')
            : L('Tomada de Wikimedia Commons y convertida en imagen, a menor tamaño.', 'Taken from Wikimedia Commons and turned into a picture, at a smaller size.')}
        </p>
      )}
      <p className="fg-report">
        <a href={reportUrl({ item, flag: credit?.[0], version: VERSION })} target="_blank" rel="noopener noreferrer">
          <MessageSquareWarning size={15} aria-hidden="true" />
          {L('Avisar de un error en esta bandera', 'Report a mistake in this flag')}
        </a>
      </p>
    </Dialog>
  );
}

/** Whose every file is: the list that the licences of many of them ask for, read when it is opened. */
function Credits({ count }: { count: number }) {
  const [credits, setCredits] = useState<CreditsFile | null>(null);
  const [asked, setAsked] = useState(false);
  useEffect(() => {
    if (!asked) return;
    let alive = true;
    loadFlagCredits().then(
      (file) => alive && setCredits(file),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [asked]);
  const rows = useMemo(() => (credits ? Object.values(credits.files).sort((a, b) => a[0].localeCompare(b[0])) : []), [credits]);
  return (
    <details className="fg-all" onToggle={(e) => e.currentTarget.open && setAsked(true)}>
      <summary>{L(`Autores y licencias de los ${nf(count)} archivos de Wikimedia Commons`, `Authors and licences of the ${nf(count)} files from Wikimedia Commons`)}</summary>
      <p>
        {L(
          'Cada bandera de una región o de una capital es un archivo de Wikimedia Commons, de dominio público o con una licencia libre. Los dibujos se han aligerado y algunos se muestran como imagen, sin cambiar lo que se ve; quien los reutilice debe respetar la licencia de cada uno.',
          'Each flag of a region or of a capital is a file from Wikimedia Commons, in the public domain or under a free licence. The drawings have been made lighter and some are shown as pictures, without changing what is seen; whoever reuses them must keep to the licence of each.',
        )}
      </p>
      {credits ? (
        <ul>
          {rows.map(([title, author, licence]) => (
            <li key={title}>
              <a href={commonsPage(title)} target="_blank" rel="noopener noreferrer">
                {title}
              </a>
              {author ? ` · ${author}` : ''} · {credits.licences[licence]?.[0]}
            </li>
          ))}
        </ul>
      ) : (
        asked && <Spinner label={L('Cargando…', 'Loading…')} />
      )}
    </details>
  );
}

export function Flags({ world, rest }: { world: World; rest: string }) {
  const page = flagsPageOf(rest);
  const [file, setFile] = useState<FlagsFile | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState<FlagCard | null>(null);

  useEffect(() => {
    let alive = true;
    setFailed(null);
    loadFlags().then(
      (f) => alive && setFile(f),
      (err: unknown) => alive && setFailed(err instanceof Error ? err.message : String(err)),
    );
    return () => {
      alive = false;
    };
  }, [attempt]);

  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, getLang());
  const countries = useMemo(() => countryFlags(world.index).sort(byName), [world]);
  const capitals = useMemo(() => (file ? capitalFlags(file).sort(byName) : []), [file]);
  /** The countries that have flags of their divisions, by name, with how many. */
  const mapped = useMemo(() => {
    if (!file) return [];
    const counts = regionCounts(file);
    return [...counts]
      .map(([id, n]) => ({ id, name: world.byId.get(id) ? nm(world.byId.get(id)!.n) : id, n: n.reduce((a, b) => a + b, 0) }))
      .sort(byName);
  }, [file, world]);
  const total = useMemo(() => mapped.reduce((sum, c) => sum + c.n, 0), [mapped]);
  const files = useMemo(() => (file ? new Set([...Object.values(file.regions).flat(), ...file.capitals].map((row) => row[4])).size : 0), [file]);

  // The country whose divisions are shown: the one the address names or, with none, that of the language.
  const home = getLang() === 'en' ? 'US' : 'ES';
  const country = page.tab === 'regions' ? (mapped.some((c) => c.id === page.country) ? page.country! : mapped.some((c) => c.id === home) ? home : (mapped[0]?.id ?? '')) : '';
  const regions = useMemo(() => (file && country ? regionFlags(file, country) : []), [file, country]);
  /** With something typed, the divisions of every country are looked through. */
  const everywhere = useMemo(() => (file && page.tab === 'regions' && query.trim() ? searchFlags(Object.keys(file.regions).flatMap((id) => regionFlags(file, id)), query).sort(byName) : null), [file, page.tab, query]);

  /** The name of a tab and, where there is room for it, how many flags it has. */
  const tab = (name: string, n: number | null) => (
    <>
      {name}
      {n !== null && <small className="fg-n">{nf(n)}</small>}
    </>
  );
  const tabs = [
    { value: 'countries' as const, label: tab(L('Países', 'Countries'), countries.length) },
    { value: 'regions' as const, label: tab(L('Regiones', 'Regions'), file ? total : null) },
    { value: 'capitals' as const, label: tab(L('Capitales', 'Capitals'), file ? capitals.length : null) },
  ];
  const where = (card: FlagCard): string | undefined => (world.byId.get(card.country) ? nm(world.byId.get(card.country)!.n) : undefined);
  const nothing = <p className="fg-none">{L('Ninguna bandera se llama así.', 'No flag goes by that name.')}</p>;

  let body;
  if (page.tab === 'countries') {
    const found = searchFlags(countries, query);
    body = !found.length
      ? nothing
      : Object.entries(world.index.continents).map(([id, name]) => {
          const cards = found.filter((card) => world.byId.get(card.id)?.ct === id);
          return cards.length ? (
            <section key={id} className="fg-group">
              <h2>
                {nm(name)} <small>{nf(cards.length)}</small>
              </h2>
              <Grid cards={cards} onOpen={setShown} />
            </section>
          ) : null;
        });
  } else if (failed) {
    body = (
      <div className="empty-state" role="alert">
        <p>{L(`No se han podido cargar las banderas (${failed}).`, `The flags could not be loaded (${failed}).`)}</p>
        <button type="button" className="btn btn-primary" onClick={() => setAttempt((n) => n + 1)}>
          {L('Reintentar', 'Retry')}
        </button>
      </div>
    );
  } else if (!file) body = <Spinner label={L('Cargando las banderas…', 'Loading the flags…')} />;
  else if (page.tab === 'capitals') {
    const found = searchFlags(capitals, query);
    body = found.length ? <Grid cards={found} under={where} onOpen={setShown} /> : nothing;
  } else if (everywhere) body = everywhere.length ? <Grid cards={everywhere} under={where} onOpen={setShown} /> : nothing;
  else {
    const about = world.byId.get(country);
    body = [2, 1, 0].map((level) => {
      const cards = regions.filter((card) => card.level === level);
      const said = levelOf(about, level);
      if (!cards.length) return null;
      return (
        <section key={level} className="fg-group">
          <h2>
            {said ? capitalise(L(said.es, said.en)) : L('Divisiones', 'Divisions')}{' '}
            <small>{said && said.n > cards.length ? L(`${nf(cards.length)} de ${nf(said.n)}`, `${nf(cards.length)} of ${nf(said.n)}`) : nf(cards.length)}</small>
          </h2>
          <Grid cards={cards} onOpen={setShown} />
        </section>
      );
    });
  }

  return (
    <div className="fg">
      <header className="setup-head">
        <p className="kicker">{L('Banderas', 'Flags')}</p>
        <h1>{L('Banderas del mundo', 'Flags of the world')}</h1>
        <p className="lead">
          {L(
            'Las de los países y, desde ahora, las de sus regiones y sus capitales, para verlas todas. Toca una para verla grande y saber de quién es el dibujo. Los juegos de este apartado están en camino.',
            'Those of the countries and, from now on, those of their regions and their capitals, all to look at. Touch one to see it large and learn whose drawing it is. The games of this section are on the way.',
          )}
        </p>
      </header>
      <div className="fg-bar">
        <Seg label={L('Qué banderas', 'Which flags')} value={page.tab} options={tabs} onChange={(to) => show(to === 'regions' ? { tab: to, country: country || undefined } : { tab: to })} />
        <label className="search">
          <Search size={16} aria-hidden="true" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={L('Buscar una bandera…', 'Search for a flag…')} aria-label={L('Buscar una bandera por su nombre', 'Search for a flag by its name')} />
        </label>
      </div>
      {page.tab === 'regions' && file && !everywhere && (
        <div className="fg-pick">
          <label className="select">
            <span>{L('País', 'Country')}</span>
            <select value={country} onChange={(e) => show({ tab: 'regions', country: e.target.value })}>
              {mapped.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({nf(c.n)})
                </option>
              ))}
            </select>
          </label>
          <span className="fg-count">{L(`${nf(mapped.length)} países con banderas de sus regiones`, `${nf(mapped.length)} countries with flags of their regions`)}</span>
        </div>
      )}
      <div className={cx('fg-body', page.tab)}>{body}</div>
      {file && <Credits count={files} />}
      {shown && <Detail card={shown} country={world.byId.get(shown.country)} onClose={() => setShown(null)} />}
    </div>
  );
}
