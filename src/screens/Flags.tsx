/**
 * The gallery of flags: those of the countries, which the game has always had, and those that come from
 * Wikimedia Commons (lib/flags.ts) — of the divisions of the maps and of the capitals, of other times, of
 * organisations and of peoples, and the signals — each with who made its file and on what terms it is
 * given. A place to look at them all, and to say when one is not right; what is on a page of it can be
 * played with in the games of the section (screens/FlagGames.tsx), which is where each page sends.
 *
 * The flag of a country opens the sheet of that country (lib/profiles.ts: every country has one) over
 * the gallery instead of the flag by itself (screens/FlagProfile.tsx), under an address of its own.
 */
import { ExternalLink, MessageSquareWarning, Play, Search } from 'lucide-react';
import { Suspense, lazy, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Dialog } from '../components/Dialog';
import { Flag, Seg, Spinner, capitalise } from '../components/ui';
import {
  capitalFlags,
  cityCounts,
  cityFlags,
  commonsPage,
  countryFlags,
  flagFiles,
  flagsPageOf,
  flagsRest,
  goneFlags,
  levelOf,
  loadFlagCredits,
  loadFlags,
  namedFlags,
  pastFlags,
  regionCounts,
  regionFlags,
  searchFlags,
  signalFlags,
  yearsText,
  type CreditsFile,
  type FlagCard,
  type FlagsFile,
  type FlagsPage,
} from '../lib/flags';
import { flagSetText, setOfPage } from '../lib/flagSets';
import { L, getLang, nm } from '../lib/i18n';
import { hasProfile, profileIn, profileRest } from '../lib/profiles';
import { reportUrl } from '../lib/report';
import { closeOver, go, goOver } from '../lib/router';
import { FLAGS_PATH, FLAG_GAMES_PATH } from '../lib/routes';
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

const show = (page: FlagsPage): void => go(`${FLAGS_PATH}/${flagsRest(page)}`);

/** The sheet of a country (lib/profiles.ts): its code, its texts and its photographs are fetched when one is opened. */
const FlagProfile = lazy(() => import('./FlagProfile').then((m) => ({ default: m.FlagProfile })));

function Tile({ card, name, under, onOpen }: { card: FlagCard; name?: string; under?: string; onOpen(card: FlagCard): void }) {
  return (
    <li>
      <button type="button" className="fg-tile" onClick={() => onOpen(card)}>
        <span className="fg-box">
          <img style={shape(card.ratio)} src={card.small} alt="" loading="lazy" decoding="async" draggable={false} />
        </span>
        <span className="fg-name">{name ?? card.name}</span>
        {under && <small>{under}</small>}
      </button>
    </li>
  );
}

/** A grid of flags, each under its name or under what `name` says of it, with what `under` adds. */
function Grid({ cards, name, under, onOpen }: { cards: readonly FlagCard[]; name?: (card: FlagCard) => string; under?: (card: FlagCard) => string | undefined; onOpen(card: FlagCard): void }) {
  return (
    <ul className="fg-grid">
      {cards.map((card) => (
        <Tile key={card.key} card={card} name={name?.(card)} under={under?.(card)} onOpen={onOpen} />
      ))}
    </ul>
  );
}

/** The codes of signals, in the order they are shown in, with the name of each. */
const SIGNALS: [group: string, es: string, en: string][] = [
  ['sea', 'Código internacional de señales', 'International Code of Signals'],
  ['race', 'Carreras de motor', 'Motor racing'],
  ['other', 'Otras banderas sin país', 'Other flags of no country'],
];
const signalGroup = (group: string | undefined): string => {
  const found = SIGNALS.find(([id]) => id === group);
  return found ? L(found[1], found[2]) : '';
};
/** When a flag of other times flew, for where its years are its name. */
const when = (card: FlagCard): string => yearsText(card.years) || L('Fecha desconocida', 'Date unknown');

/** What a flag is of, under its name: «comunidad autónoma · España». */
function whatOf(card: FlagCard, country: Country | undefined): string {
  const where = country ? nm(country.n) : card.country;
  const said = (...parts: string[]) => parts.filter(Boolean).join(' · ');
  if (card.kind === 'country') return L('País o territorio', 'Country or territory');
  if (card.kind === 'capital') return `${L('Capital', 'Capital')} · ${where}`;
  if (card.kind === 'city') return `${L('Ciudad', 'City')} · ${where}`;
  if (card.kind === 'past') return said(L('Bandera anterior', 'Earlier flag'), where, yearsText(card.years));
  if (card.kind === 'gone') return said(L('País o territorio que ya no existe', 'Country or territory that is no more'), yearsText(card.years));
  if (card.kind === 'organisation') return L('Organización', 'Organisation');
  if (card.kind === 'people') return L('Pueblo, o Estado sin reconocimiento general', 'People, or State without general recognition');
  if (card.kind === 'signal') return said(L('Señal', 'Signal'), signalGroup(card.group));
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
  const item = { id: card.id, name: card.name, kind: card.kind === 'country' ? ('country' as const) : card.kind === 'capital' || card.kind === 'city' ? ('city' as const) : ('unit' as const), type: L('bandera', 'flag'), country: country as Country };
  const years = card.kind === 'past' && yearsText(card.years) ? ` (${yearsText(card.years)})` : '';

  return (
    <Dialog title={card.name} className="fg-dlg" onClose={onClose}>
      <p className="fg-what">{whatOf(card, country)}</p>
      <div className="fg-big">
        <img style={shape(card.ratio)} src={card.src} alt={card.kind === 'signal' ? card.name : L(`Bandera de ${card.name}${years}`, `Flag of ${card.name}${years}`)} draggable={false} />
      </div>
      {card.means && (
        <p className="fg-means">
          {L('Izada sola, dice: ', 'Flown alone, it says: ')}
          <q>{card.means}</q>
        </p>
      )}
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
          'Cada bandera que no es la de un país de hoy es un archivo de Wikimedia Commons, de dominio público o con una licencia libre. Los dibujos se han aligerado y algunos se muestran como imagen, sin cambiar lo que se ve; quien los reutilice debe respetar la licencia de cada uno.',
          'Each flag that is not that of a country of today is a file from Wikimedia Commons, in the public domain or under a free licence. The drawings have been made lighter and some are shown as pictures, without changing what is seen; whoever reuses them must keep to the licence of each.',
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
  /** The country whose sheet is open over the gallery: the address says it, so that it can be sent and going back closes it. */
  const sheet = profileIn(rest, (id) => hasProfile(world.byId.get(id)));
  /** Where the gallery is, under any sheet. */
  const under = `${FLAGS_PATH}/${flagsRest({ tab: 'countries' })}`;
  /** The sheet of a country is opened, from the gallery or from another sheet: going back returns to where it was opened from. */
  const openSheet = (id: string) => goOver(`${FLAGS_PATH}/${profileRest(id)}`, sheet ? under : undefined);
  /** A flag is opened: the sheet of its country, when it is the flag of one; itself, larger, when it is any other. */
  const open = (card: FlagCard) => {
    if (card.kind !== 'country' || !hasProfile(world.byId.get(card.id))) return setShown(card);
    openSheet(card.id);
  };
  /** Closing a sheet leaves the gallery as it was, however many sheets were opened one from another. */
  const closeSheet = () => closeOver(under);

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
  /** The countries that have flags of their cities, by name, with how many. */
  const towned = useMemo(() => (file ? [...cityCounts(file)].map(([id, n]) => ({ id, name: world.byId.get(id) ? nm(world.byId.get(id)!.n) : id, n })).sort(byName) : []), [file, world]);
  const everyCity = useMemo(() => (file ? [...capitalFlags(file), ...cityFlags(file)] : []), [file]);
  const files = useMemo(() => (file ? flagFiles(file).size : 0), [file]);
  /** Other times: the countries that are no more, and the flags that those of today flew before, by country. */
  // What is no more, the last to end first: the alphabet would put one empire beside another of a thousand years before.
  const gone = useMemo(() => (file ? goneFlags(file).sort((a, b) => (b.years?.[1] ?? 0) - (a.years?.[1] ?? 0) || byName(a, b)) : []), [file]);
  const past = useMemo(() => (file ? pastFlags(file, world.index).sort((a, b) => byName(a, b)) : []), [file, world]);
  const organisations = useMemo(() => (file ? namedFlags(file, 'organisation').sort(byName) : []), [file]);
  const peoples = useMemo(() => (file ? namedFlags(file, 'people').sort(byName) : []), [file]);
  const signals = useMemo(() => (file ? signalFlags(file) : []), [file]);

  // The country whose divisions are shown: the one the address names or, with none, that of the language.
  const home = getLang() === 'en' ? 'US' : 'ES';
  const country = page.tab === 'regions' ? (mapped.some((c) => c.id === page.country) ? page.country! : mapped.some((c) => c.id === home) ? home : (mapped[0]?.id ?? '')) : '';
  const regions = useMemo(() => (file && country ? regionFlags(file, country) : []), [file, country]);
  // The cities: those of the country that the address names; with none, the capitals of them all.
  const town = page.tab === 'cities' && towned.some((c) => c.id === page.country) ? page.country! : '';
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
    { value: 'cities' as const, label: tab(L('Ciudades', 'Cities'), file ? everyCity.length : null) },
    { value: 'history' as const, label: tab(L('Históricas', 'Historical'), file ? gone.length + past.length : null) },
    { value: 'others' as const, label: tab(L('Otras', 'Others'), file ? organisations.length + peoples.length + signals.length : null) },
  ];
  /** A group of flags under its heading, with how many there are; nothing when there are none. */
  const group = (key: string, title: string, cards: readonly FlagCard[], inside: ReactNode) =>
    cards.length ? (
      <section key={key} className="fg-group">
        <h2>
          {title} <small>{nf(cards.length)}</small>
        </h2>
        {inside}
      </section>
    ) : null;
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
              <Grid cards={cards} onOpen={open} />
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
  else if (page.tab === 'cities') {
    if (query.trim() || !town) {
      // With something typed, the cities of every country are looked through; with nothing, and no country, the capitals.
      const found = query.trim() ? searchFlags(everyCity, query).sort(byName) : capitals;
      body = found.length ? <Grid cards={found} under={where} onOpen={setShown} /> : nothing;
    } else {
      const [head, others] = [capitals.filter((card) => card.country === town), cityFlags(file, town).sort(byName)];
      body = [
        group('capital', head.length > 1 ? L('Capitales', 'Capitals') : L('Capital', 'Capital'), head, <Grid cards={head} onOpen={setShown} />),
        group('cities', head.length ? L('Otras ciudades', 'Other cities') : L('Ciudades', 'Cities'), others, <Grid cards={others} onOpen={setShown} />),
      ];
    }
  } else if (page.tab === 'history') {
    const [were, flew] = [searchFlags(gone, query), searchFlags(past, query)];
    // The flags a country flew before, under the country: the sort keeps the oldest first within each.
    const lands = [...new Set(flew.map((card) => card.country))];
    body =
      !were.length && !flew.length
        ? nothing
        : [
            group('gone', L('Países y territorios que ya no existen', 'Countries and territories that are no more'), were, <Grid cards={were} under={(card) => yearsText(card.years) || undefined} onOpen={setShown} />),
            group(
              'past',
              L('Banderas anteriores de los países de hoy', 'Earlier flags of the countries of today'),
              flew,
              lands.map((id) => {
                const about = world.byId.get(id);
                const cards = flew.filter((card) => card.country === id);
                return (
                  <div key={id} className="fg-land">
                    <h3>
                      <Flag code={about?.fl} size="sm" />
                      {cards[0].name} <small>{nf(cards.length)}</small>
                    </h3>
                    <Grid cards={cards} name={when} onOpen={setShown} />
                  </div>
                );
              }),
            ),
          ];
  } else if (page.tab === 'others') {
    const found = { organisations: searchFlags(organisations, query), peoples: searchFlags(peoples, query), signals: searchFlags(signals, query) };
    body =
      !found.organisations.length && !found.peoples.length && !found.signals.length
        ? nothing
        : [
            group('organisations', L('Organizaciones', 'Organisations'), found.organisations, <Grid cards={found.organisations} onOpen={setShown} />),
            group('peoples', L('Pueblos y Estados sin reconocimiento general', 'Peoples and States without general recognition'), found.peoples, <Grid cards={found.peoples} onOpen={setShown} />),
            ...SIGNALS.map(([id, es, en]) => {
              const cards = found.signals.filter((card) => card.group === id);
              return group(`signals-${id}`, L(es, en), cards, <Grid cards={cards} onOpen={setShown} />);
            }),
          ];
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

  // What a game takes from this page: the countries, the regions or the cities of the country on show, the capitals…
  const playWith = flagSetText(setOfPage(page.tab === 'regions' ? { tab: 'regions', country: country || undefined } : page.tab === 'cities' ? { tab: 'cities', country: town || undefined } : page));

  return (
    <div className="fg">
      <header className="setup-head">
        <p className="kicker">{L('Banderas', 'Flags')}</p>
        <h1>{L('Galería de banderas', 'Gallery of flags')}</h1>
        <p className="lead">
          {L(
            'Las de los países, las de sus regiones y sus ciudades, las de otros tiempos, las de organizaciones y pueblos y las que son señales, para verlas todas. Toca una para verla grande y saber de quién es el dibujo.',
            'Those of the countries, of their regions and their cities, those of other times, those of organisations and peoples and those that are signals, all to look at. Touch one to see it large and learn whose drawing it is.',
          )}
        </p>
      </header>
      <div className="fg-bar">
        <Seg label={L('Qué banderas', 'Which flags')} value={page.tab} options={tabs} onChange={(to) => show(to === 'regions' ? { tab: to, country: country || undefined } : { tab: to })} />
        <label className="search">
          <Search size={16} aria-hidden="true" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={L('Buscar una bandera…', 'Search for a flag…')} aria-label={L('Buscar una bandera por su nombre', 'Search for a flag by its name')} />
        </label>
        {/* The games of the section, with what is on this page already chosen. */}
        <a className="btn btn-primary fg-play" href={`#/${FLAGS_PATH}/${FLAG_GAMES_PATH}/${playWith}`}>
          <Play size={16} aria-hidden="true" />
          {L('Jugar con estas', 'Play with these')}
        </a>
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
      {page.tab === 'cities' && file && !query.trim() && (
        <div className="fg-pick">
          <label className="select">
            <span>{L('País', 'Country')}</span>
            <select value={town} onChange={(e) => show(e.target.value ? { tab: 'cities', country: e.target.value } : { tab: 'cities' })}>
              <option value="">{L(`Las capitales de los países (${nf(capitals.length)})`, `The capitals of the countries (${nf(capitals.length)})`)}</option>
              {towned.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({nf(c.n)})
                </option>
              ))}
            </select>
          </label>
          <span className="fg-count">{L(`${nf(towned.length)} países con banderas de sus ciudades`, `${nf(towned.length)} countries with flags of their cities`)}</span>
        </div>
      )}
      <div className={cx('fg-body', page.tab)}>{body}</div>
      {file && <Credits count={files} />}
      {shown && <Detail card={shown} country={world.byId.get(shown.country)} onClose={() => setShown(null)} />}
      {sheet && (
        <Suspense fallback={null}>
          <FlagProfile id={sheet} world={world} onOpen={openSheet} onClose={closeSheet} />
        </Suspense>
      )}
    </div>
  );
}
