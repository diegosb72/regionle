/**
 * The sheet of a country, over the gallery of flags: what the country is, the figures the game has of it
 * and where it is, what its flag means, the flags it flew before with what the country was at the time of
 * each, photographs of it — each with who took it and on what terms it is given — and the flags of its
 * regions and of its cities, to go and look at or to play with (lib/profiles.ts).
 *
 * Every country has one. The figures are what the game already knows of every country, so a sheet says
 * nothing of a figure that a game would say otherwise; what Wikidata and Wikipedia say of the country and of
 * its flag, and what has been written of it by hand and its photographs where there are any, come in a file
 * of the country. Whatever does not come, or a country does not have, is left out, and the sheet is shown
 * without it: the same sheet for all, each as full as what is known of it.
 *
 * Wherever a sheet names another country (a neighbour, the State a territory depends on) it leads to the
 * sheet of that one; going back returns to the one it was opened from, and closing closes them all.
 */
import { ExternalLink, Images, MessageSquareWarning, Play } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { Dialog } from '../components/Dialog';
import { Flag, Spinner, capitalise } from '../components/ui';
import { bookValue, bookYear, loadBook, type BookFile } from '../lib/book';
import { loadFacts } from '../lib/facts';
import { BOOK_FIGS, metricOf } from '../lib/figures';
import { capitalFlags, cityFlags, commonsPage, flagsRest, levelOf, loadFlags, regionFlags, yearsText, type FlagCard, type FlagsFile } from '../lib/flags';
import { flagSetText } from '../lib/flagSets';
import { L, capName, fmtDay, getLang, nm } from '../lib/i18n';
import { locator } from '../lib/profileMap';
import { bordersText, flownCards, hasProfile, loadProfile, neighboursOf, photoSet, photoSrc, profileRest, rankOf, regionsText, timeCards, townsText, type ProfileFile, type ProfilePhoto, type Said, type SaidIn } from '../lib/profiles';
import { reportUrl } from '../lib/report';
import { FLAGS_PATH, FLAG_GAMES_PATH } from '../lib/routes';
import { cx, fmtArea, fmtPop } from '../lib/text';
import type { Country, Geo } from '../lib/types';
import { VERSION } from '../lib/version';
import { loadWorldGeo, type World } from '../lib/world';
import './flagProfile.css';

type Facts = Awaited<ReturnType<typeof loadFacts>>;

const say = (text: Said): string => (getLang() === 'en' ? text.en : text.es);
/** What is said in the language on screen, where it is said in it. */
const sayIn = (text: SaidIn | undefined): string | undefined => (getLang() === 'en' ? text?.en : text?.es) || undefined;
/** The same, or failing that what is said in the other language: a page to read is better in another language than not at all. */
const sayAny = (text: SaidIn | undefined): string | undefined => sayIn(text) ?? text?.en ?? text?.es;
const paragraphs = (text: { es: string[]; en: string[] }): string[] => (getLang() === 'en' ? text.en : text.es);
/** A day of a sheet as it is read: «19 de noviembre de 1889», or the year alone where only the year is known. */
const dayText = (day: string): string => (/^\d{4}$/.test(day) ? day : fmtDay(day, true));

/** «5.º» · “5th”. */
function nth(n: number): string {
  if (getLang() !== 'en') return `${n}.º`;
  const two = n % 100;
  const end = two >= 11 && two <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${end}`;
}

/**
 * How Wikipedia begins to tell of something, and whose that text is, under it: Wikipedia's, shortened, on
 * the terms it is given on, with the page it comes from to read on. `more` is what the link to that page
 * says, and `of` what it is called for whoever hears it apart from the text: where it leads and what of.
 */
function Lead({ text, page, more, of }: { text: string[]; page: string | undefined; more: string; of: string }) {
  return (
    <>
      {text.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      <p className="fp-from">
        {L('De Wikipedia, abreviado', 'From Wikipedia, abridged')} ·{' '}
        <a href={L('https://creativecommons.org/licenses/by-sa/4.0/deed.es', 'https://creativecommons.org/licenses/by-sa/4.0/')} target="_blank" rel="noopener noreferrer license">
          CC BY-SA 4.0
        </a>
        {page && (
          <>
            {' · '}
            <a href={page} target="_blank" rel="noopener noreferrer" aria-label={of}>
              {more}
              <ExternalLink size={12} aria-hidden="true" />
            </a>
          </>
        )}
      </p>
    </>
  );
}

/** The terms a photograph is given on, as they are written here: its licence, with where it is written. */
function Licence({ photo }: { photo: ProfilePhoto }) {
  const name = photo.licence === 'Public domain' ? L('Dominio público', 'Public domain') : photo.licence;
  return photo.licenceUrl ? (
    <a href={photo.licenceUrl} target="_blank" rel="noopener noreferrer license">
      {name}
    </a>
  ) : (
    <>{name}</>
  );
}

/** Whose a photograph is: who made it, on what terms, and its page in Commons. */
function Credit({ photo }: { photo: ProfilePhoto }) {
  return (
    <small className="fp-credit">
      {photo.by ? `${photo.by} · ` : ''}
      <Licence photo={photo} /> ·{' '}
      <a href={commonsPage(photo.title)} target="_blank" rel="noopener noreferrer">
        Wikimedia Commons
        <ExternalLink size={11} aria-hidden="true" />
      </a>
    </small>
  );
}

/** A photograph with what is seen in it and whose it is, under it. `sizes` tells the browser how wide it will be shown. */
function Photo({ photo, sizes, lazy = true, className }: { photo: ProfilePhoto; sizes: string; lazy?: boolean; className?: string }) {
  const focus = photo.focus ? ({ objectPosition: `${photo.focus[0]}% ${photo.focus[1]}%` } as CSSProperties) : undefined;
  return (
    <figure className={className}>
      <img
        src={photoSrc(photo.file, photo.sizes[0])}
        srcSet={photoSet(photo)}
        sizes={sizes}
        width={photo.w}
        height={photo.h}
        // What is seen in it is said under it, once.
        alt=""
        style={focus}
        loading={lazy ? 'lazy' : undefined}
        decoding="async"
        draggable={false}
      />
      <figcaption>
        {say(photo)} <Credit photo={photo} />
      </figcaption>
    </figure>
  );
}

/** A flag of the gallery, in the shape it has. */
function FlagPicture({ card, alt, className, large }: { card: FlagCard; alt: string; className?: string; large?: boolean }) {
  return <img className={className} style={{ aspectRatio: String(card.ratio) }} src={large ? card.src : card.small} alt={alt} loading="lazy" decoding="async" draggable={false} />;
}

/** Where the country is: the half of the globe that has it in the middle. */
function Where({ geo, country, under }: { geo: ReadonlyMap<string, Geo>; country: Country; under: string }) {
  const size = 220;
  const drawn = useMemo(() => locator(geo, country.id, country.lp, size), [geo, country]);
  if (!drawn) return null;
  return (
    <figure className="fp-where">
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={L(`Dónde está ${nm(country.n)} en el mundo`, `Where ${nm(country.n)} is in the world`)}>
        <path className="fp-sea" d={drawn.globe} />
        <path className="fp-land" d={drawn.land} />
        <path className="fp-own" d={drawn.own} />
        {drawn.ring && <circle className="fp-ring" cx={drawn.ring[0]} cy={drawn.ring[1]} r={9} />}
      </svg>
      <figcaption>{under}</figcaption>
    </figure>
  );
}

/** A figure of the sheet: its name, what it is and what is said beside it. */
interface Row {
  name: string;
  value: ReactNode;
  note?: string;
}

function FactList({ rows, className }: { rows: Row[]; className?: string }) {
  return (
    <dl className={cx('fp-facts', className)}>
      {rows.map((row) => (
        <div key={row.name}>
          <dt>{row.name}</dt>
          <dd>
            {row.value}
            {row.note && <small> {row.note}</small>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function FlagProfile({ id, world, onOpen, onClose }: { id: string; world: World; onOpen(id: string): void; onClose(): void }) {
  const country = world.byId.get(id);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<ProfileFile | null>(null);
  const [failed, setFailed] = useState(false);
  const [flags, setFlags] = useState<FlagsFile | null>(null);
  const [facts, setFacts] = useState<Facts | null>(null);
  const [book, setBook] = useState<BookFile | null>(null);
  const [geo, setGeo] = useState<Map<string, Geo> | null>(null);
  const top = useRef<HTMLSpanElement>(null);
  const first = useRef(true);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    loadProfile(id).then(
      (file) => alive && setLoaded(file),
      () => alive && setFailed(true),
    );
    // What the sheet can be shown without: each comes when it comes, and what does not come is left out.
    const quiet = () => undefined;
    loadFlags().then((file) => alive && setFlags(file), quiet);
    loadFacts().then((said) => alive && setFacts(said), quiet);
    loadBook().then((file) => alive && setBook(file), quiet);
    loadWorldGeo().then((map) => alive && setGeo(map), quiet);
    return () => {
      alive = false;
    };
  }, [id, attempt]);

  // A sheet opened from another is read from its top, and whoever does not see it is told which one it is:
  // the keyboard goes to its name, since the link that led here is gone with the sheet it was in.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const panel = top.current?.closest('dialog');
    const box = top.current?.closest('.dlg-box');
    if (box) box.scrollTop = 0;
    const title = panel?.querySelector<HTMLElement>('.dlg-head h2');
    if (title) {
      title.tabIndex = -1;
      title.focus({ preventScroll: true });
    }
  }, [id]);

  /** The sheet of the country that is asked for: while it is on its way, that of the one before is not shown under its name. */
  const profile = loaded?.id === id ? loaded : null;
  const times = useMemo(() => (profile?.times?.length && flags ? timeCards(profile, flags, world.index) : null), [profile, flags, world]);
  const flown = useMemo(() => (flags ? flownCards(id, flags, world.index) : []), [flags, id, world]);
  const regions = useMemo(() => (flags ? regionFlags(flags, id).filter((card) => card.level === 0) : []), [flags, id]);
  const towns = useMemo(() => (flags ? [...capitalFlags(flags).filter((card) => card.country === id), ...cityFlags(flags, id)] : []), [flags, id]);

  if (!country) return null;
  const name = nm(country.n);
  const where = world.index.subregions?.[country.sr] ?? world.index.continents[country.ct];
  const rank = { pop: rankOf(world.index, id, (c) => c.pop), area: rankOf(world.index, id, (c) => c.ar) };
  const placed = (r: { place: number; among: number } | null) => (r ? L(`${nth(r.place)} del mundo`, `${nth(r.place)} in the world`) : '');
  const level = levelOf(country, 0);
  const levelName = level ? (getLang() === 'en' ? level.en : level.es) : L('regiones', 'regions');
  const flagSrc = `${import.meta.env.BASE_URL}flags/${country.fl}.svg`;

  /** A link to the sheet of another country: a plain click opens it over this one; any other does what links do. */
  const sheetOf = (other: string) => ({
    href: `#/${FLAGS_PATH}/${profileRest(other)}`,
    onClick: (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      onOpen(other);
    },
  });
  /** Another country, by its flag and its name: a link to its sheet when it has one. */
  const land = (other: string): ReactNode => {
    const one = world.byId.get(other);
    if (!one) return null;
    const shown = (
      <>
        <Flag code={one.fl} size="sm" />
        {nm(one.n)}
      </>
    );
    return hasProfile(one) ? <a {...sheetOf(other)}>{shown}</a> : <span>{shown}</span>;
  };

  /** The figures the game has of the country: each with its name, as it is written, and what is said beside it. */
  const rows: Row[] = [];
  const owner = country.sov ? world.byId.get(country.sov) : undefined;
  if (owner) rows.push({ name: L('Depende de', 'Depends on'), value: <span className="fp-owner">{land(owner.id)}</span> });
  if (country.cap) rows.push({ name: L('Capital', 'Capital'), value: capName(country.cap) });
  if (country.pop != null) rows.push({ name: L('Población', 'Population'), value: fmtPop(country.pop), note: [country.py ? String(country.py) : '', placed(rank.pop)].filter(Boolean).join(' · ') });
  if (country.ar > 0) rows.push({ name: L('Superficie', 'Area'), value: fmtArea(country.ar), note: placed(rank.area) });
  for (const [said, value] of facts?.card(id) ?? []) rows.push({ name: said, value });
  if (book) {
    for (const fig of BOOK_FIGS) {
      const value = bookValue(book, id, fig);
      if (!value) continue;
      const metric = metricOf(fig);
      const year = bookYear(book, id, fig);
      rows.push({ name: capitalise(metric.noun), value: fig === 'fert' ? metric.full(value) : metric.short(value), ...(year ? { note: String(year) } : {}) });
    }
  }
  if (profile?.motto) {
    const means = sayIn(profile.motto);
    rows.push({ name: L('Lema', 'Motto'), value: <span lang={profile.motto.lang}>{`«${profile.motto.text}»`}</span>, ...(means && means !== profile.motto.text ? { note: `(${means})` } : {}) });
  }
  const anthem = sayAny(profile?.anthem);
  if (anthem) rows.push({ name: L('Himno', 'Anthem'), value: anthem });

  /** The ones it borders that the game has, and how many of them are territories of another country. */
  const neighbours = neighboursOf(country, world.byId);
  const dependent = neighbours.filter((other) => world.byId.get(other)?.cl === 'dep').length;
  /** A link of the sheet to another page of the section leaves the gallery where it was: that page is read from its top. */
  const leave = () => window.scrollTo(0, 0);
  const item = { id, name, kind: 'country' as const, type: L('ficha del país', 'sheet of the country'), country };
  const head = profile?.photos?.[0];
  const official = sayIn(profile?.official);
  const flag = profile?.flag;
  /** What is known of the flag, each thing under its name. */
  const flagRows: Row[] = [];
  // A territory with no flag of its own flies that of its country: whose it is comes first, and leads to it.
  const flies = flag?.of ? world.byId.get(flag.of) : undefined;
  if (flies) flagRows.push({ name: L('Es la de', 'It is that of'), value: <span className="fp-owner">{land(flies.id)}</span> });
  if (flag?.adopted) flagRows.push({ name: L('Adoptada', 'Adopted'), value: dayText(flag.adopted) });
  if (flag?.changed) flagRows.push({ name: L('Como es hoy, desde', 'As it is today, since'), value: dayText(flag.changed) });
  if (flag?.ratio)
    flagRows.push({ name: L('Proporción', 'Proportions'), value: flag.ratio, note: L('de alto por ancho; aquí se dibuja en 3:4, como todas las de los países', 'height to width; here it is drawn in 3:4, like every flag of a country') });
  if (flag?.colours) flagRows.push({ name: L('Colores', 'Colours'), value: (getLang() === 'en' ? flag.colours.en : flag.colours.es).join(', ') });
  if (flag?.called) flagRows.push({ name: L('La llaman', 'It is called'), value: say(flag.called) });
  const by = sayAny(flag?.by);
  if (by) flagRows.push({ name: flag?.text ? L('La idearon', 'Devised by') : L('Diseño de', 'Designed by'), value: by });
  const read = sayAny(profile?.read);
  const readFlag = sayAny(profile?.readFlag);
  /**
   * What Wikipedia begins to tell of the country and of its flag, in the language on screen, where nobody
   * has written of them for the game: each with the page it is from, which is the one in that language.
   */
  const lang = getLang() === 'en' ? 'en' : 'es';
  const lead = profile?.about ? undefined : profile?.lead?.[lang];
  const flagLead = flag?.text ? undefined : flag?.lead?.[lang];
  /** Whether the sheet says anything that Wikidata and Wikipedia gave, and not somebody who wrote it for the game. */
  const given = !!profile && (!profile.about || !!profile.motto || !!profile.anthem || !!flag?.colours);

  return (
    <Dialog title={name} className="fp-dlg" onClose={onClose}>
      <span ref={top} hidden />
      {failed ? (
        <div className="empty-state" role="alert">
          <p>{L(`No se ha podido cargar la ficha de ${name}.`, `The sheet of ${name} could not be loaded.`)}</p>
          <button type="button" className="btn btn-primary" onClick={() => setAttempt((n) => n + 1)}>
            {L('Reintentar', 'Retry')}
          </button>
        </div>
      ) : !profile ? (
        <Spinner label={L('Cargando la ficha…', 'Loading the sheet…')} />
      ) : (
        <article className="fp">
          <header className="fp-head">
            {head ? (
              <Photo photo={head} sizes="(max-width: 1000px) 100vw, 960px" lazy={false} className="fp-hero" />
            ) : (
              // No photograph yet: a band of the colours of its flag, where the photograph will be. The drawing
              // is asked for without its proportions (`svgView`), so that it fills the band whole.
              <div className="fp-band" aria-hidden="true">
                <img src={`${flagSrc}#svgView(preserveAspectRatio(none))`} alt="" draggable={false} />
              </div>
            )}
            <div className="fp-id">
              <img className="fp-flag" src={flagSrc} alt={L(`Bandera de ${name}`, `Flag of ${name}`)} draggable={false} />
              <div>
                <p className="kicker">{nm(where)}</p>
                {official && <p className="fp-official">{official}</p>}
                {profile.local && profile.local !== official && (
                  <p className={official ? 'fp-local' : 'fp-official'} lang={profile.localLang}>
                    {profile.local}
                  </p>
                )}
                {!official && !profile.local && <p className="fp-official">{name}</p>}
              </div>
            </div>
          </header>

          {profile.about ? (
            <section className="fp-about">
              {paragraphs(profile.about).map((text) => (
                <p key={text}>{text}</p>
              ))}
            </section>
          ) : (
            lead && (
              <section className="fp-about fp-lead">
                <Lead
                  text={lead}
                  page={profile.read?.[lang]}
                  more={L('Seguir leyendo', 'Read on')}
                  of={L(`Seguir leyendo sobre ${name} en Wikipedia`, `Read on about ${name} on Wikipedia`)}
                />
              </section>
            )
          )}

          <section className="fp-sec fp-glance">
            <h3>{L('De un vistazo', 'At a glance')}</h3>
            <div className="fp-glance-in">
              <FactList rows={rows} />
              {geo && <Where geo={geo} country={country} under={nm(where)} />}
            </div>
            {neighbours.length > 0 && (
              <>
                <p className="label">{bordersText(neighbours.length - dependent, dependent)}</p>
                <ul className="fp-nb">
                  {neighbours.map((other) => (
                    <li key={other}>{land(other)}</li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className="fp-sec fp-flagsec">
            <h3>{L('La bandera', 'The flag')}</h3>
            <div className="fp-flag-in">
              <img className="fp-flag-big" src={flagSrc} alt="" draggable={false} />
              <div>
                {flag?.text && paragraphs(flag.text).map((text) => <p key={text}>{text}</p>)}
                {flagLead && (
                  <div className="fp-lead">
                    <Lead
                      text={flagLead}
                      page={profile.readFlag?.[lang]}
                      more={L('Seguir leyendo', 'Read on')}
                      of={L(`Seguir leyendo sobre la bandera de ${flies ? nm(flies.n) : name} en Wikipedia`, `Read on about the flag of ${flies ? nm(flies.n) : name} on Wikipedia`)}
                    />
                  </div>
                )}
                {flagRows.length > 0 && <FactList rows={flagRows} className="fp-flag-facts" />}
                {!flag?.text && !flagLead && readFlag && (
                  <p className="fp-more">
                    <a href={readFlag} target="_blank" rel="noopener noreferrer">
                      {L(`Leer sobre la bandera de ${flies ? nm(flies.n) : name} en Wikipedia`, `Read about the flag of ${flies ? nm(flies.n) : name} on Wikipedia`)}
                      <ExternalLink size={13} aria-hidden="true" />
                    </a>
                  </p>
                )}
              </div>
            </div>
            {flag?.parts && flag.parts.length > 0 && (
              <dl className="fp-parts">
                {flag.parts.map((part) => {
                  const [what, text] = getLang() === 'en' ? part.en : part.es;
                  return (
                    <div key={what}>
                      <dt>{what}</dt>
                      <dd>{text}</dd>
                    </div>
                  );
                })}
              </dl>
            )}
          </section>

          {profile.times && profile.times.length > 0 ? (
            <section className="fp-sec fp-times">
              <h3>{L('Sus banderas en el tiempo', 'Its flags through time')}</h3>
              <ol>
                {profile.times.map((time, i) => {
                  const card = times?.[i];
                  const when = time.when ? say(time.when) : time.now ? L(`Desde ${time.from}`, `Since ${time.from}`) : yearsText([time.from, time.to ?? 0]);
                  return (
                    <li key={`${time.from}-${time.to ?? ''}-${i}`} className={cx(time.now && 'fp-now', time.picture && 'fp-with-pic')}>
                      <div className="fp-time-flag">{card && <FlagPicture card={card} alt={L(`Bandera de ${name}: ${say(time.name)} (${when})`, `Flag of ${name}: ${say(time.name)} (${when})`)} />}</div>
                      <div className="fp-time-text">
                        <p className="fp-when">{when}</p>
                        <h4>{say(time.name)}</h4>
                        <p>{say(time.text)}</p>
                      </div>
                      {time.picture && <Photo photo={time.picture} sizes="(max-width: 760px) 70vw, 340px" className="fp-time-pic" />}
                    </li>
                  );
                })}
              </ol>
            </section>
          ) : (
            flown.length > 0 && (
              // Nothing written of its times: the flags the game has of them, each with its years, and the one of today.
              <section className="fp-sec fp-flown">
                <h3>{L('Sus banderas en el tiempo', 'Its flags through time')}</h3>
                <ol>
                  {flown.map((card) => {
                    const when = yearsText(card.years ?? [0, 0]);
                    return (
                      <li key={card.key}>
                        <FlagPicture card={card} alt={L(`Bandera de ${name} (${when})`, `Flag of ${name} (${when})`)} />
                        <p className="fp-when">{when}</p>
                      </li>
                    );
                  })}
                  <li className="fp-now">
                    <img src={flagSrc} alt={L(`Bandera de ${name}, hoy`, `Flag of ${name}, today`)} loading="lazy" decoding="async" draggable={false} />
                    <p className="fp-when">{L('Hoy', 'Today')}</p>
                  </li>
                </ol>
                <p className="fp-note">
                  {L(
                    'Son las banderas anteriores que recoge Wikidata, con los años en que ondeó cada una; puede faltar alguna.',
                    'These are the earlier flags that Wikidata records, with the years each was flown; some may be missing.',
                  )}
                </p>
              </section>
            )
          )}

          {profile.photos && profile.photos.length > 1 && (
            <section className="fp-sec fp-photos">
              <h3>{L(`${name} en imágenes`, `${name} in pictures`)}</h3>
              <div className="fp-masonry">
                {profile.photos.slice(1).map((photo) => (
                  <Photo key={photo.file} photo={photo} sizes="(max-width: 700px) 92vw, 460px" />
                ))}
              </div>
            </section>
          )}

          {(regions.length > 0 || towns.length > 0) && (
            <section className="fp-sec fp-own">
              <h3>{L(`Las banderas de ${name}`, `The flags of ${name}`)}</h3>
              {regions.length > 0 && (
                <>
                  <p className="label">{regionsText(regions.length, level)}</p>
                  <ul className="fp-strip">
                    {regions.map((card) => (
                      <li key={card.key} title={card.name}>
                        <FlagPicture card={card} alt={card.name} />
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <p className="fp-links">
                {regions.length > 0 && (
                  <a className="btn" href={`#/${FLAGS_PATH}/${flagsRest({ tab: 'regions', country: id })}`} onClick={leave}>
                    <Images size={15} aria-hidden="true" />
                    {L(`Ver las de sus ${levelName}`, `See those of its ${levelName}`)}
                  </a>
                )}
                {towns.length > 0 && (
                  <a className="btn" href={`#/${FLAGS_PATH}/${flagsRest({ tab: 'cities', country: id })}`} onClick={leave}>
                    <Images size={15} aria-hidden="true" />
                    {townsText(towns)}
                  </a>
                )}
                {regions.length >= 4 && (
                  <a className="btn btn-primary" href={`#/${FLAGS_PATH}/${FLAG_GAMES_PATH}/${flagSetText({ kind: 'regions', country: id })}`} onClick={leave}>
                    <Play size={15} aria-hidden="true" />
                    {L(`Jugar con las de sus ${levelName}`, `Play with those of its ${levelName}`)}
                  </a>
                )}
              </p>
            </section>
          )}

          <footer className="fp-foot">
            <p>
              {L(
                'Las cifras son las que usa todo el juego: Banco Mundial, GeoNames, Unicode CLDR y The World Factbook.',
                'The figures are those the whole game uses: World Bank, GeoNames, Unicode CLDR and The World Factbook.',
              )}
              {given &&
                ` ${L(
                  'El nombre oficial, el lema, el himno y los datos de la bandera son los que dan Wikidata y Wikipedia.',
                  'The official name, the motto, the anthem and the facts of the flag are those that Wikidata and Wikipedia give.',
                )}`}
              {` ${L('El dibujo de la bandera es de la colección flag-icons.', 'The drawing of the flag is from the flag-icons collection.')}`}
              {(lead || flagLead) &&
                ` ${L(
                  'El texto es el comienzo de los artículos de Wikipedia, abreviado, con licencia CC BY-SA 4.0.',
                  'The text is the opening of the articles of Wikipedia, abridged, under the CC BY-SA 4.0 licence.',
                )}`}
              {profile.about && ` ${L('El texto está escrito para el juego, con lo que cuentan Wikipedia y The World Factbook.', 'The text is written for the game, from what Wikipedia and The World Factbook tell.')}`}
              {head &&
                ` ${
                  (profile.photos?.length ?? 0) + (profile.times?.some((time) => time.picture) ? 1 : 0) > 1
                    ? L(
                        'Las fotografías son de Wikimedia Commons, reducidas de tamaño; bajo cada una van su autor y su licencia.',
                        'The photographs are from Wikimedia Commons, made smaller; under each are its author and its licence.',
                      )
                    : L('La fotografía es de Wikimedia Commons, reducida de tamaño; bajo ella van su autor y su licencia.', 'The photograph is from Wikimedia Commons, made smaller; under it are its author and its licence.')
                }`}
            </p>
            <p className="fp-foot-links">
              {read && (
                <a href={read} target="_blank" rel="noopener noreferrer">
                  {L(`Leer más sobre ${name} en Wikipedia`, `Read more about ${name} on Wikipedia`)}
                  <ExternalLink size={13} aria-hidden="true" />
                </a>
              )}
              <a href={reportUrl({ item, version: VERSION })} target="_blank" rel="noopener noreferrer">
                <MessageSquareWarning size={15} aria-hidden="true" />
                {L('Avisar de un error en esta ficha', 'Report a mistake in this sheet')}
              </a>
            </p>
          </footer>
        </article>
      )}
    </Dialog>
  );
}
