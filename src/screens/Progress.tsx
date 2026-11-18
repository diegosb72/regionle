/** What has been learnt so far, where on the map, what is due for review, recent games, and backup of the saved data. */
import { ArrowRight, CalendarClock, Download, FileSpreadsheet, Trash2, Upload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BadgeBoard } from '../components/Badges';
import { MapView, type Paint } from '../components/MapView';
import { groupPlace } from '../components/ReviewCard';
import { Flag, Seg, Spinner, capitalise } from '../components/ui';
import { namesOf, type Named } from '../lib/answerNames';
import { toCsv } from '../lib/csv';
import { buildDeck, eligible, type World } from '../lib/data';
import { kindNoun, parsePhys } from '../lib/extra';
import { metricNoun, type MetricId } from '../lib/metricNames';
import { L, getLang, levelNoun, nm } from '../lib/i18n';
import { MODE_NAME, SECTIONS, formatName, modeNameIn } from '../lib/modes';
import { REVIEW_MAX, allGroups, dueCount, dueGroups, forecast, gradeOf, missGroups, missesOf, parseOrigin, reviewConfig, type Grade, type ReviewGroup } from '../lib/review';
import { reviewTable } from '../lib/reviewTable';
import { go } from '../lib/router';
import { isLearnt, useStore, type Skill, type Stat } from '../lib/store';
import { cx, fmtTime, nf } from '../lib/text';
import type { Country, Deck, Mode, Section } from '../lib/types';
import { scoreOf } from '../games/quiz';

const SKILL_IDS: Skill[] = ['loc', 'name', 'cap', 'flag', 'nb'];
const skillName = (id: Skill): string =>
  id === 'loc' ? L('Situar en el mapa', 'Placing on the map') : id === 'name' ? L('Nombrar', 'Naming') : id === 'cap' ? L('Capitales', 'Capitals') : id === 'flag' ? L('Banderas', 'Flags') : L('Vecinos', 'Neighbours');
const skillHint = (id: Skill): string =>
  id === 'loc'
    ? `${MODE_NAME.pin}, ${MODE_NAME.puzzle}`
    : id === 'name'
      ? `${MODE_NAME.identify}, ${MODE_NAME.outline}, ${MODE_NAME.nameall}`
      : id === 'cap'
        ? MODE_NAME.capital
        : id === 'flag'
          ? MODE_NAME.flag
          : MODE_NAME.neighbours;

interface Row {
  country: Country;
  regions: { seen: number; learnt: number; weak: number };
  whole: { seen: number; learnt: number };
  last: number;
}

function when(t: number): string {
  const locale = getLang() === 'en' ? 'en-GB' : 'es-ES';
  const d = new Date(t);
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(t).setHours(0, 0, 0, 0)) / 864e5);
  const hour = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  if (days === 0) return `${L('Hoy', 'Today')}, ${hour}`;
  if (days === 1) return `${L('Ayer', 'Yesterday')}, ${hour}`;
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

/** Hands a file made here over to the browser's downloads. */
function download(text: string, name: string, type: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ------------------------------------------------------------ knowledge map

const GRADES: Grade[] = ['known', 'learning', 'due', 'new'];
const GRADE_PAINT: Record<Grade, Paint | undefined> = { known: 'ok', learning: 'warn', due: 'due', new: undefined };
const gradeName = (g: Grade, fem: boolean): string =>
  g === 'known'
    ? L(fem ? 'sabidas' : 'sabidos', 'known')
    : g === 'learning'
      ? L('aprendiendo', 'learning')
      : g === 'due'
        ? L('toca repasar', 'due for review')
        : L('sin ver', 'not seen');

/** The worst of the grades of the skills that have been practised: one weak side makes the piece weak. */
function gradeAcross(stats: Record<string, Stat>, id: string, skills: Skill[], now: number): Grade {
  let out: Grade = 'new';
  for (const skill of skills) {
    const g = gradeOf(stats[`${skill}:${id}`], now);
    if (g === 'new') continue;
    if (g === 'due' || out === 'due') out = 'due';
    else if (g === 'learning' || out === 'learning') out = 'learning';
    else out = 'known';
  }
  return out;
}

function KnowledgeMap({ world }: { world: World }) {
  const stats = useStore((s) => s.stats);
  const where = useStore((s) => s.where);
  const setSel = useStore((s) => s.setSel);
  const setLevel = useStore((s) => s.setLevel);
  const [scope, setScope] = useState('world');
  const [skill, setSkill] = useState<'all' | Skill>('all');
  const [deck, setDeck] = useState<Deck | null>(null);
  const [failed, setFailed] = useState(false);

  /** Countries whose regions have been practised, the most practised first, and the level each was played at. */
  const places = useMemo(() => {
    const per = new Map<string, { n: number; levels: Map<string, number> }>();
    for (const k of Object.keys(stats)) {
      const id = k.slice(k.indexOf(':') + 1);
      const o = parseOrigin(id, where[id]);
      if (!o || o.section !== 'regions' || !o.country) continue;
      let p = per.get(o.country);
      if (!p) per.set(o.country, (p = { n: 0, levels: new Map() }));
      p.n++;
      if (o.level) p.levels.set(o.level, (p.levels.get(o.level) ?? 0) + 1);
    }
    const out: { country: Country; n: number; level: string | undefined }[] = [];
    for (const [id, p] of per) {
      const country = world.byId.get(id);
      if (country?.lv.length) out.push({ country, n: p.n, level: [...p.levels.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] });
    }
    return out.sort((a, b) => b.n - a.n);
  }, [stats, where, world]);

  const place = places.find((p) => p.country.id === scope);
  const isWorld = !place;
  const level = place ? (place.country.lv.find((l) => l.k === place.level) ?? place.country.lv.find((l) => l.k === place.country.dl) ?? place.country.lv[0]) : null;

  useEffect(() => {
    let alive = true;
    setDeck(null);
    setFailed(false);
    const spec = place && level
      ? { scope: 'regions' as const, countries: [place.country.id], levels: { [place.country.id]: level.k } }
      : { scope: 'countries' as const, countries: world.index.countries.filter((c) => eligible('countries', c) && (c.cl !== 'dep' || SKILL_IDS.some((s) => stats[`${s}:${c.id}`]))).map((c) => c.id) };
    buildDeck(spec).then(
      (d) => alive && setDeck(d),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
    // The deck depends on what is shown, not on every answer stored.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place?.country.id, level?.k, world]);

  const skills = useMemo(() => (skill === 'all' || (skill === 'flag' && !isWorld) ? SKILL_IDS : [skill]), [skill, isWorld]);
  const { paint, grades, counts } = useMemo(() => {
    const now = Date.now();
    const paint: Record<string, Paint | undefined> = {};
    const grades = new Map<string, Grade>();
    const counts: Record<Grade, number> = { known: 0, learning: 0, due: 0, new: 0 };
    for (const it of deck?.items ?? []) {
      const g = gradeAcross(stats, it.id, skills, now);
      grades.set(it.id, g);
      counts[g]++;
      paint[it.id] = GRADE_PAINT[g];
    }
    return { paint, grades, counts };
  }, [deck, stats, skills]);

  const fem = isWorld ? false : (deck?.noun.fem ?? true);
  const total = deck?.items.length ?? 0;
  const practise = () => {
    if (place && level) {
      setSel('regions', [place.country.id]);
      setLevel(place.country.id, level.k);
      go(SECTIONS.regions.path);
    } else go(SECTIONS.countries.path);
  };

  return (
    <section className="block know">
      <h2>{L('Mapa de lo que sabes', 'Map of what you know')}</h2>
      <div className="know-bar">
        <div className="know-scopes" role="tablist" aria-label={L('Mapa', 'Map')}>
          <button type="button" role="tab" aria-selected={isWorld} className={cx('chip', isWorld && 'on')} onClick={() => setScope('world')}>
            {L('Países del mundo', 'Countries of the world')}
          </button>
          {places.map((p) => (
            <button key={p.country.id} type="button" role="tab" aria-selected={scope === p.country.id} className={cx('chip', scope === p.country.id && 'on')} onClick={() => setScope(p.country.id)}>
              <Flag code={p.country.fl} size="sm" />
              {nm(p.country.n)}
            </button>
          ))}
        </div>
        <Seg<'all' | Skill>
          small
          label={L('Qué se mira', 'What is looked at')}
          value={skill === 'flag' && !isWorld ? 'all' : skill}
          onChange={setSkill}
          options={[
            { value: 'all', label: L('Todo', 'All') },
            { value: 'loc', label: L('Situar', 'Placing') },
            { value: 'name', label: L('Nombrar', 'Naming') },
            { value: 'cap', label: L('Capitales', 'Capitals') },
            ...(isWorld ? [{ value: 'flag' as const, label: L('Banderas', 'Flags') }] : []),
          ]}
        />
      </div>
      <div className="know-map">
        {deck ? (
          <MapView
            key={deck.key}
            deck={deck}
            paint={paint}
            tip={(id) => {
              const it = deck.byId.get(id);
              return it ? `${it.name} · ${gradeName(grades.get(id) ?? 'new', false).replace(/s$/, '')}` : null;
            }}
          />
        ) : failed ? (
          <p className="empty">{L('No se ha podido cargar este mapa.', 'This map could not be loaded.')}</p>
        ) : (
          <Spinner label={L('Dibujando el mapa…', 'Drawing the map…')} />
        )}
      </div>
      <div className="know-foot">
        <ul className="know-legend">
          {GRADES.map((g) => (
            <li key={g} className={`g-${g}`}>
              <i aria-hidden="true" />
              <b>{nf(counts[g])}</b> {gradeName(g, fem)}
            </li>
          ))}
        </ul>
        <span className="know-what">
          {place && level ? `${nm(place.country.n)} · ${nf(total)} ${levelNoun(level).many}` : `${nf(total)} ${L('países', 'countries')}`}
        </span>
        <button type="button" className="btn btn-sm" onClick={practise}>
          {L('Practicar este mapa', 'Practise this map')}
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      </div>
      <p className="tip-line">
        {L(
          'Verde: acertado a la primera dos veces seguidas. Amarillo: visto, pero aún no. Naranja: lo sabías y ya toca repasarlo. Si miras «Todo», manda lo que peor llevas de cada pieza.',
          'Green: right first time twice in a row. Yellow: seen, but not there yet. Orange: you knew it and it is time to review it. With “All”, each piece shows the side you know worst.',
        )}
      </p>
    </section>
  );
}

// ------------------------------------------------------------------- review

function ReviewBlock({ world }: { world: World }) {
  const stats = useStore((s) => s.stats);
  const where = useStore((s) => s.where);
  const opts = useStore((s) => s.opts);
  const start = useStore((s) => s.start);
  /** What the making of the file is at, while it is being made. */
  const [making, setMaking] = useState<string | null>(null);

  /** Every answer with its name, its map and its dates, as a file for a spreadsheet or for Anki. */
  const exportCsv = async () => {
    const all = allGroups(stats, where);
    setMaking(L('Preparando el archivo…', 'Preparing the file…'));
    // The names are on the maps: each one is read, from the copy the browser keeps where there is one.
    const names = await namesOf(all, opts, (done, total) => setMaking(L(`Leyendo los mapas: ${done} de ${total}…`, `Reading the maps: ${done} of ${total}…`)));
    const table = reviewTable(
      all,
      stats,
      names,
      {
        header: [
          L('Nombre', 'Name'),
          L('Capital', 'Capital'),
          L('Mapa', 'Map'),
          L('Qué se pregunta', 'What is asked'),
          L('Estado', 'State'),
          L('Veces preguntada', 'Times asked'),
          L('Aciertos a la primera', 'Right first time'),
          L('Racha', 'Run'),
          L('Última vez', 'Last time'),
          L('Próximo repaso', 'Next review'),
          'Id',
        ],
        place: (g) => groupPlace(g, world).text,
        skill: skillName,
        grade: (g) => (g === 'known' ? L('sabida', 'known') : g === 'due' ? L('toca repasar', 'due for review') : L('aprendiendo', 'learning')),
      },
      Date.now(),
    );
    // Excel wants semicolons where the comma is the decimal mark, as in Spanish, and commas elsewhere.
    download(toCsv(table, getLang() === 'en' ? ',' : ';'), `regionle-${L('repaso', 'review')}-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
    setMaking(null);
  };
  const { groups, due, days } = useMemo(() => {
    const now = Date.now();
    const groups = dueGroups(stats, where, now);
    return { groups, due: dueCount(groups), days: forecast(stats, now, 7) };
  }, [stats, where]);
  const top = Math.max(1, ...days);
  const locale = getLang() === 'en' ? 'en-GB' : 'es-ES';
  const dayName = (i: number): string => (i === 0 ? L('hoy', 'today') : new Date(Date.now() + i * 864e5).toLocaleDateString(locale, { weekday: 'short' }).replace('.', ''));

  return (
    <section className="block">
      <h2>{L('Repaso espaciado', 'Spaced review')}</h2>
      <div className="fc">
        <div className="fc-now">
          <strong>{nf(due)}</strong>
          <span>{L(due === 1 ? 'respuesta por repasar ahora' : 'respuestas por repasar ahora', due === 1 ? 'answer to review now' : 'answers to review now')}</span>
          {due > 0 && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                start(reviewConfig(groups[0], opts));
                go('jugar');
              }}
            >
              <CalendarClock size={15} aria-hidden="true" />
              {L('Repasar', 'Review')}
            </button>
          )}
        </div>
        <ol className="fc-days" aria-label={L('Repasos previstos en los próximos siete días', 'Reviews due over the next seven days')}>
          {days.map((n, i) => (
            <li key={i} title={`${dayName(i)}: ${n}`}>
              <b>{n > 0 ? nf(n) : ''}</b>
              <i style={{ height: `${Math.round((n / top) * 100)}%` }} className={i === 0 ? 'today' : undefined} />
              <span>{dayName(i)}</span>
            </li>
          ))}
        </ol>
      </div>
      <p className="tip-line">
        {L(
          'Cada acierto a la primera aleja el siguiente repaso: 1 día, 3, 7, 16, 35 y 75. Un fallo lo trae de vuelta el mismo día.',
          'Each first-time right answer pushes the next review further away: 1 day, 3, 7, 16, 35 and 75. A miss brings it back the same day.',
        )}
      </p>
      <p className="fc-file">
        <button type="button" className="btn btn-sm" onClick={() => void exportCsv()} disabled={making != null}>
          <FileSpreadsheet size={15} aria-hidden="true" />
          {L('Descargar el repaso (CSV)', 'Download the review (CSV)')}
        </button>
        <span role="status">
          {making ??
            L(
              'Una fila por respuesta, con su nombre, su mapa, cuántas veces la has acertado y cuándo vuelve: para una hoja de cálculo o para Anki.',
              'A row for each answer, with its name, its map, how often you got it right and when it comes back: for a spreadsheet or for Anki.',
            )}
        </span>
      </p>
    </section>
  );
}

// -------------------------------------------------------------- most missed

/** Maps shown, and pieces named on each. */
const MISS_MAPS = 5;
const MISS_NAMES = 8;

function MissBlock({ world }: { world: World }) {
  const stats = useStore((s) => s.stats);
  const where = useStore((s) => s.where);
  const opts = useStore((s) => s.opts);
  const start = useStore((s) => s.start);
  const groups = useMemo(() => missGroups(stats, where), [stats, where]);
  const shown = useMemo(() => groups.slice(0, MISS_MAPS), [groups]);
  /** The names of the pieces, read from their maps; null while they are being read. */
  const [names, setNames] = useState<Map<string, Map<string, Named>> | null>(null);
  // What is listed, not how often each was missed: the maps are not read again after every answer.
  const listed = shown.map((g) => `${g.key}=${g.ids.slice(0, MISS_NAMES).join(',')}`).join('|');
  useEffect(() => {
    let alive = true;
    void namesOf(shown, opts).then((m) => alive && setNames(m));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listed]);

  if (!groups.length) return null;
  const total = groups.reduce((n, g) => n + g.ids.length, 0);
  const play = (g: ReviewGroup) => {
    start(reviewConfig(g, opts));
    go('jugar');
  };

  return (
    <section className="block miss">
      <h2>{L('Lo que más fallas', 'What you miss most')}</h2>
      <p className="tip-line">
        {L(
          `${total === 1 ? 'Una respuesta que has fallado' : `${nf(total)} respuestas que has fallado`} dos veces o más y aún no te sabes. ${total === 1 ? 'A su lado' : 'Junto a cada una'}, las veces que la has fallado de las que te la han preguntado. Dos aciertos seguidos a la primera la quitan de aquí.`,
          `${total === 1 ? 'One answer' : `${nf(total)} answers`} you have missed twice or more and do not know yet. Next to ${total === 1 ? 'it' : 'each'}, the times you missed it out of the times it was asked. Two first-time right answers in a row take it off the list.`,
        )}
      </p>
      <ul className="miss-list">
        {shown.map((g) => {
          const place = groupPlace(g, world);
          const known = names?.get(g.key);
          const n = Math.min(g.ids.length, REVIEW_MAX);
          return (
            <li key={g.key}>
              <div className="miss-head">
                {place.flag && <Flag code={place.flag} size="sm" />}
                <b>
                  {place.text} <small>· {MODE_NAME[g.mode]}</small>
                </b>
                <button type="button" className="btn btn-sm" onClick={() => play(g)}>
                  {L(n === 1 ? 'Practicarla' : `Practicar las ${n}`, n === 1 ? 'Practise it' : `Practise all ${n}`)}
                  <ArrowRight size={15} aria-hidden="true" />
                </button>
              </div>
              <ol className="miss-items">
                {g.ids.slice(0, MISS_NAMES).map((id) => {
                  const st = stats[`${g.skill}:${id}`];
                  const missed = missesOf(st);
                  return (
                    <li key={id}>
                      {/* The id stands for a name that could not be read: no connection and no copy of that map. */}
                      <span>{names ? (known?.get(id)?.name ?? id) : '…'}</span>
                      <small title={L(`Fallada ${missed} de las ${st[0]} veces`, `Missed ${missed} of ${st[0]} times`)}>{L(`${missed} de ${st[0]}`, `${missed} of ${st[0]}`)}</small>
                    </li>
                  );
                })}
                {g.ids.length > MISS_NAMES && <li className="miss-more">{L(`y ${g.ids.length - MISS_NAMES} más`, `and ${g.ids.length - MISS_NAMES} more`)}</li>}
              </ol>
            </li>
          );
        })}
      </ul>
      {groups.length > shown.length && (
        <p className="tip-line">
          {L(
            `Y ${groups.length - shown.length === 1 ? 'otro mapa' : `otros ${groups.length - shown.length} mapas`} con algo que se te resiste: ${groups.length - shown.length === 1 ? 'saldrá' : 'saldrán'} aquí cuando despejes estos.`,
            `And ${groups.length - shown.length} more ${groups.length - shown.length === 1 ? 'map' : 'maps'} with something that keeps slipping: ${groups.length - shown.length === 1 ? 'it' : 'they'} will show here once these are cleared.`,
          )}
        </p>
      )}
    </section>
  );
}

// --------------------------------------------------------------------- page

export function Progress({ world }: { world: World }) {
  const stats = useStore((s) => s.stats);
  const whereMap = useStore((s) => s.where);
  const sessions = useStore((s) => s.sessions);
  const best = useStore((s) => s.best);
  const favs = useStore((s) => s.favs);
  const daily = useStore((s) => s.daily);
  const tot = useStore((s) => s.tot);
  const lists = useStore((s) => s.lists);
  const badges = useStore((s) => s.badges);
  const setSel = useStore((s) => s.setSel);
  const resetProgress = useStore((s) => s.resetProgress);
  const importData = useStore((s) => s.importData);
  const hasTypeins = useStore((s) => Object.keys(s.typeins).length > 0 || s.typeinAuto !== null);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const { skills, rows } = useMemo(() => {
    const skills: Record<Skill, { seen: number; learnt: number }> = { loc: { seen: 0, learnt: 0 }, name: { seen: 0, learnt: 0 }, cap: { seen: 0, learnt: 0 }, flag: { seen: 0, learnt: 0 }, nb: { seen: 0, learnt: 0 } };
    const byCountry = new Map<string, Row>();
    const items = new Map<string, { learnt: boolean; weak: boolean; last: number }>();
    for (const [k, st] of Object.entries(stats)) {
      const at = k.indexOf(':');
      const skill = k.slice(0, at) as Skill;
      const id = k.slice(at + 1);
      if (!skills[skill]) continue;
      skills[skill].seen++;
      if (isLearnt(st)) skills[skill].learnt++;
      const prev = items.get(id);
      const learnt = isLearnt(st);
      const weak = st[0] >= 2 && st[1] / st[0] < 0.5 && !learnt;
      items.set(id, { learnt: (prev?.learnt ?? true) && learnt, weak: (prev?.weak ?? false) || weak, last: Math.max(prev?.last ?? 0, st[3]) });
    }
    for (const [id, it] of items) {
      const origin = parseOrigin(id, whereMap[id]);
      // Cities, rivers and seas have their own maps: they are not regions of a country.
      if (!origin || (origin.section !== 'regions' && origin.section !== 'countries')) continue;
      const cid = origin.section === 'countries' ? id : (origin.country ?? '');
      const country = world.byId.get(cid);
      if (!country) continue;
      let row = byCountry.get(cid);
      if (!row) byCountry.set(cid, (row = { country, regions: { seen: 0, learnt: 0, weak: 0 }, whole: { seen: 0, learnt: 0 }, last: 0 }));
      row.last = Math.max(row.last, it.last);
      if (origin.section === 'countries') {
        row.whole.seen++;
        if (it.learnt) row.whole.learnt++;
      } else {
        row.regions.seen++;
        if (it.learnt) row.regions.learnt++;
        if (it.weak) row.regions.weak++;
      }
    }
    return { skills, rows: [...byCountry.values()] };
  }, [stats, whereMap, world]);

  const regionRows = rows.filter((r) => r.regions.seen > 0).sort((a, b) => b.last - a.last);
  const countriesSeen = rows.filter((r) => r.whole.seen > 0);
  const countriesLearnt = countriesSeen.filter((r) => r.whole.learnt > 0).length;
  const worldTotal = world.index.countries.filter((c) => c.cl !== 'dep' && eligible('countries', c)).length;

  // Lifetime tallies; the list of sessions only keeps the latest ones.
  const totals = { g: tot.g ?? sessions.length, q: tot.q ?? 0, ok: tot.ok ?? 0, warn: tot.warn ?? 0, ms: tot.ms ?? 0 };
  // A record of nothing is not a record (older versions could store a zero).
  const records = Object.entries(best).filter(([, v]) => v > 0);
  const dailyDone = Object.values(daily).filter((d) => d.t).length;

  const exportData = () => {
    // The short forms chosen in the settings travel with the rest: they are read when the copy is made.
    const { typeins, typeinAuto, recent } = useStore.getState();
    const data = { app: 'regionle', version: 3, exported: new Date().toISOString(), stats, where: whereMap, sessions, recent, best, favs, daily, lists, badges, tot, typeins, typeinAuto };
    download(JSON.stringify(data, null, 1), `regionle-${L('progreso', 'progress')}-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      setMessage(importData(JSON.parse(await f.text())) ? L('Progreso importado.', 'Progress imported.') : L('Ese archivo no es una copia de Regionle.', 'That file is not a Regionle backup.'));
    } catch {
      setMessage(L('No se ha podido leer el archivo.', 'The file could not be read.'));
    }
    if (file.current) file.current.value = '';
  };

  const practise = (c: Country) => {
    setSel('regions', [c.id]);
    go(SECTIONS.regions.path);
  };

  /** A record in words: which game, on which map. */
  /** The figures "higher or lower" keeps a record of. */
  const HILO_METRICS: MetricId[] = ['pop', 'area', 'density', 'elev'];
  const recordLine = (k: string, v: number) => {
    const [kind, ...rest] = k.split(':');
    const what = rest.join(':');
    if (kind === 'daily') {
      return (
        <li key={k}>
          <b>{L('Reto diario', 'Daily challenge')}</b> · {L('mejor racha', 'best streak')}
          <span>{L(`${v} ${v === 1 ? 'día' : 'días'}`, `${v} ${v === 1 ? 'day' : 'days'}`)}</span>
        </li>
      );
    }
    if (kind === 'hilo') {
      return (
        <li key={k}>
          {/* "hilo:pop" for the countries; "hilo:pop:cities" for the rest, each in its section. */}
          <b>{MODE_NAME.hilo}</b> · {HILO_METRICS.includes(rest[0] as MetricId) ? metricNoun(rest[0] as MetricId) : rest[0]}
          {rest[1] && Object.hasOwn(SECTIONS, rest[1]) ? ` · ${SECTIONS[rest[1] as Section].name}` : ''}
          <span>{L(`racha de ${v}`, `streak of ${v}`)}</span>
        </li>
      );
    }
    // Every other record is about a map: "nameall:<map>", "regionle:<map>", "blind:<map>|<n>", "timed:<mode>:<map>".
    let mapKey = what;
    let mode: Mode | null = null;
    if (kind === 'timed' || kind === 'lives' || kind === 'exam') {
      mode = rest[0] as Mode;
      mapKey = rest.slice(1).join(':');
    }
    let label: string;
    if (mapKey.startsWith('p:')) {
      const spec = parsePhys(mapKey.slice(2).split(','));
      label = `${spec.kinds.map((x) => capitalise(kindNoun(x).many)).join(', ')} · ${spec.places.length ? spec.places.map((p) => (world.index.continents[p] ? nm(world.index.continents[p]) : p)).join(', ') : L('mundo', 'world')}`;
    } else {
      const ids = mapKey.replace(/^[rct]:/, '').split('|')[0].split(',');
      const names = ids.slice(0, 3).map((id) => {
        const c = world.byId.get(id.split('.')[0]);
        return c ? nm(c.n) : id;
      });
      label = `${names.join(', ')}${ids.length > 3 ? L(` y ${ids.length - 3} más`, ` and ${ids.length - 3} more`) : ''}${mapKey.startsWith('c:') ? ` (${L('países', 'countries')})` : mapKey.startsWith('t:') ? ` (${L('ciudades', 'cities')})` : ''}`;
    }
    const hits = (n: number) => L(`${n} ${n === 1 ? 'acierto' : 'aciertos'}`, `${n} right`);
    const [game, value] =
      kind === 'exam'
        ? // Kept in tenths: 85 is an 8,5.
          [`${MODE_NAME[mode!] ?? ''} · ${formatName('exam').toLowerCase()}`, L(`nota ${nf(v / 10, 1)}`, `mark ${nf(v / 10, 1)}`)]
        : kind === 'timed' || kind === 'lives'
        ? [`${MODE_NAME[mode!] ?? ''} · ${formatName(kind).toLowerCase()}`, hits(v)]
        : kind === 'regionle'
          ? [MODE_NAME.regionle, L(`racha de ${v}`, `streak of ${v}`)]
          : kind === 'blind'
            ? [MODE_NAME.blind, L(`${nf(v)} km de error medio`, `mean error of ${nf(v)} km`)]
            : [MODE_NAME.nameall, fmtTime(v)];
    return (
      <li key={k}>
        <b>{game}</b> · {label}
        <span>{value}</span>
      </li>
    );
  };

  const empty = !sessions.length && !Object.keys(stats).length;

  return (
    <div className="progress">
      <header className="setup-head">
        <p className="kicker">{L('Progreso', 'Progress')}</p>
        <h1>{L('Lo que ya te sabes', 'What you already know')}</h1>
        <p className="lead">
          {L(
            'Una pieza cuenta como aprendida cuando la aciertas a la primera dos veces seguidas. Todo se guarda solo en este navegador.',
            'A piece counts as learnt once you get it right first time twice in a row. Everything is kept in this browser only.',
          )}
        </p>
      </header>

      {empty ? (
        <div className="empty-state">
          <p>{L('Todavía no hay nada que enseñar. Juega una partida y vuelve.', 'Nothing to show yet. Play a game and come back.')}</p>
          <button type="button" className="btn btn-primary" onClick={() => go(SECTIONS.regions.path)}>
            {L('Empezar', 'Start')}
          </button>
        </div>
      ) : (
        <>
          <dl className="tiles">
            <div>
              <dt>{L('Partidas', 'Games')}</dt>
              <dd>{nf(totals.g)}</dd>
            </div>
            <div>
              <dt>{L('Preguntas', 'Questions')}</dt>
              <dd>{nf(totals.q)}</dd>
            </div>
            <div>
              <dt>{L('Puntuación media', 'Average score')}</dt>
              <dd>{scoreOf(totals.ok, totals.warn, totals.q)} %</dd>
            </div>
            <div>
              <dt>{L('Tiempo de juego', 'Time played')}</dt>
              <dd>{fmtTime(totals.ms)}</dd>
            </div>
          </dl>

          <BadgeBoard world={world} />
          {Object.keys(stats).length > 0 && <KnowledgeMap world={world} />}
          {Object.keys(stats).length > 0 && <ReviewBlock world={world} />}
          <MissBlock world={world} />

          <section className="block">
            <h2>{L('Aprendido', 'Learnt')}</h2>
            <ul className="skills">
              {SKILL_IDS.filter((id) => id !== 'nb' || skills.nb.seen > 0).map((id) => {
                const v = skills[id];
                return (
                  <li key={id}>
                    <div className="skills-head">
                      <b>{skillName(id)}</b>
                      <span>
                        {nf(v.learnt)} <small>{L(`de ${nf(v.seen)} vistas`, `of ${nf(v.seen)} seen`)}</small>
                      </span>
                    </div>
                    <div className="bar" role="img" aria-label={L(`${v.learnt} aprendidas de ${v.seen} vistas`, `${v.learnt} learnt of ${v.seen} seen`)}>
                      <i style={{ width: `${v.seen ? (v.learnt / v.seen) * 100 : 0}%` }} />
                    </div>
                    <small>
                      {L('Se practica en', 'Practised in')}: {skillHint(id)}
                    </small>
                  </li>
                );
              })}
            </ul>
            {countriesSeen.length > 0 && (
              <p className="tip-line">
                {L('Países del mundo aprendidos en algún juego', 'Countries of the world learnt in some game')}: <b>{countriesLearnt}</b> {L('de', 'of')} {worldTotal}.
              </p>
            )}
            {dailyDone > 0 && (
              <p className="tip-line">
                {L('Retos diarios completados', 'Daily challenges completed')}: <b>{dailyDone}</b>. <a href="#/reto">{L('Ir al reto de hoy', "Go to today's challenge")}</a>
              </p>
            )}
          </section>

          {regionRows.length > 0 && (
            <section className="block">
              <h2>{L('Regiones por país', 'Regions by country')}</h2>
              <ul className="crow-list">
                {regionRows.map((r) => {
                  const total = Math.max(r.regions.seen, 1);
                  const line = L(`${r.regions.learnt} aprendidas de ${r.regions.seen} vistas`, `${r.regions.learnt} learnt of ${r.regions.seen} seen`);
                  return (
                    <li key={r.country.id} className="crow">
                      <Flag code={r.country.fl} size="md" />
                      <div className="crow-main">
                        <b>{nm(r.country.n)}</b>
                        <div className="bar" role="img" aria-label={line}>
                          <i style={{ width: `${(r.regions.learnt / total) * 100}%` }} />
                        </div>
                        <small>
                          {line}
                          {r.regions.weak > 0 ? L(` · ${r.regions.weak} se te resisten`, ` · ${r.regions.weak} keep slipping`) : ''}
                        </small>
                      </div>
                      <button type="button" className="btn btn-sm" onClick={() => practise(r.country)}>
                        {L('Practicar', 'Practise')}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {records.length > 0 && (
            <section className="block">
              <h2>{L('Récords', 'Records')}</h2>
              <ul className="records">{records.map(([k, v]) => recordLine(k, v))}</ul>
            </section>
          )}

          {sessions.length > 0 && (
            <section className="block">
              <h2>{L('Últimas partidas', 'Latest games')}</h2>
              <div className="table-wrap">
                <table className="sessions">
                  <thead>
                    <tr>
                      <th>{L('Cuándo', 'When')}</th>
                      <th>{L('Juego', 'Game')}</th>
                      <th>{L('Mapa', 'Map')}</th>
                      <th className="num">{L('A la primera', 'First time')}</th>
                      <th className="num">{L('Puntos', 'Score')}</th>
                      <th className="num">{L('Tiempo', 'Time')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.slice(0, 30).map((s) => (
                      <tr key={s.t}>
                        <td>{when(s.t)}</td>
                        <td>{Object.hasOwn(SECTIONS, s.section) ? modeNameIn(s.section, s.mode) : MODE_NAME[s.mode]}</td>
                        <td>{s.note === 'timed' || s.note === 'lives' || s.note === 'exam' ? `${s.label} · ${formatName(s.note).toLowerCase()}` : s.note ? `${s.label} · ${s.note}` : s.label}</td>
                        <td className="num">
                          {s.ok} / {s.total}
                        </td>
                        <td className="num">{scoreOf(s.ok, s.warn, s.total)} %</td>
                        <td className="num">{fmtTime(s.ms)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      <section className="block">
        <h2>{L('Copia de seguridad', 'Backup')}</h2>
        <p className="tip-line">{L('Llévate tu progreso, tus selecciones guardadas, tus listas y tus abreviaturas a otro navegador, o empieza de cero.', 'Take your progress, your saved selections, your lists and your short forms to another browser, or start from scratch.')}</p>
        <div className="backup">
          <button type="button" className="btn" onClick={exportData} disabled={empty && !favs.length && !lists.length && !hasTypeins}>
            <Download size={16} aria-hidden="true" />
            {L('Exportar', 'Export')}
          </button>
          <button type="button" className="btn" onClick={() => file.current?.click()}>
            <Upload size={16} aria-hidden="true" />
            {L('Importar', 'Import')}
          </button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
          {confirming ? (
            <span className="confirm">
              {L('¿Borrar todo el progreso?', 'Delete all progress?')}
              <button
                type="button"
                className="btn btn-sm btn-danger"
                onClick={() => {
                  resetProgress();
                  setConfirming(false);
                  setMessage(L('Progreso borrado.', 'Progress deleted.'));
                }}
              >
                {L('Sí, borrar', 'Yes, delete')}
              </button>
              <button type="button" className="btn btn-sm" onClick={() => setConfirming(false)}>
                No
              </button>
            </span>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={() => setConfirming(true)} disabled={empty}>
              <Trash2 size={16} aria-hidden="true" />
              {L('Borrar progreso', 'Delete progress')}
            </button>
          )}
        </div>
        {message && (
          <p className="q-note" role="status">
            {message}
          </p>
        )}
      </section>
    </div>
  );
}
