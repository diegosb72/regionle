/** What has been learnt so far, where on the map, what is due for review, recent games, and backup of the saved data. */
import { ArrowRight, CalendarClock, Download, Trash2, Upload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MapView, type Paint } from '../components/MapView';
import { Flag, Seg, Spinner, capitalise } from '../components/ui';
import { buildDeck, eligible, type World } from '../lib/data';
import { kindNoun, parsePhys } from '../lib/extra';
import { L, getLang, levelNoun, nm } from '../lib/i18n';
import { MODE_NAME, SECTIONS } from '../lib/modes';
import { dueCount, dueGroups, forecast, gradeOf, parseOrigin, reviewConfig, type Grade } from '../lib/review';
import { go } from '../lib/router';
import { isLearnt, useStore, type Skill, type Stat } from '../lib/store';
import { cx, fmtTime, nf } from '../lib/text';
import type { Country, Deck } from '../lib/types';
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

function ReviewBlock() {
  const stats = useStore((s) => s.stats);
  const where = useStore((s) => s.where);
  const opts = useStore((s) => s.opts);
  const start = useStore((s) => s.start);
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
  const setSel = useStore((s) => s.setSel);
  const resetProgress = useStore((s) => s.resetProgress);
  const importData = useStore((s) => s.importData);
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

  const totals = sessions.reduce((a, s) => ({ q: a.q + s.total, ok: a.ok + s.ok, warn: a.warn + s.warn, ms: a.ms + s.ms }), { q: 0, ok: 0, warn: 0, ms: 0 });
  const records = Object.entries(best);
  const dailyDone = Object.values(daily).filter((d) => d.t).length;

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ app: 'regionle', version: 2, exported: new Date().toISOString(), stats, where: whereMap, sessions, best, favs, daily }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `regionle-${L('progreso', 'progress')}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
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
          <b>{MODE_NAME.hilo}</b> · {what === 'area' ? L('superficie', 'area') : L('población', 'population')}
          <span>{L(`racha de ${v}`, `streak of ${v}`)}</span>
        </li>
      );
    }
    let label: string;
    if (what.startsWith('p:')) {
      const spec = parsePhys(what.slice(2).split(','));
      label = `${spec.kinds.map((x) => capitalise(kindNoun(x).many)).join(', ')} · ${spec.places.length ? spec.places.map((p) => (world.index.continents[p] ? nm(world.index.continents[p]) : p)).join(', ') : L('mundo', 'world')}`;
    } else {
      const ids = what.replace(/^[rct]:/, '').split('|')[0].split(',');
      const names = ids.slice(0, 3).map((id) => {
        const c = world.byId.get(id.split('.')[0]);
        return c ? nm(c.n) : id;
      });
      label = `${names.join(', ')}${ids.length > 3 ? L(` y ${ids.length - 3} más`, ` and ${ids.length - 3} more`) : ''}${what.startsWith('c:') ? ` (${L('países', 'countries')})` : what.startsWith('t:') ? ` (${L('ciudades', 'cities')})` : ''}`;
    }
    return (
      <li key={k}>
        <b>{MODE_NAME.nameall}</b> · {label}
        <span>{fmtTime(v)}</span>
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
              <dd>{nf(sessions.length)}</dd>
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

          {Object.keys(stats).length > 0 && <KnowledgeMap world={world} />}
          {Object.keys(stats).length > 0 && <ReviewBlock />}

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
                        <td>{MODE_NAME[s.mode]}</td>
                        <td>{s.note ? `${s.label} · ${s.note}` : s.label}</td>
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
        <p className="tip-line">{L('Llévate tu progreso y tus selecciones guardadas a otro navegador, o empieza de cero.', 'Take your progress and saved selections to another browser, or start from scratch.')}</p>
        <div className="backup">
          <button type="button" className="btn" onClick={exportData} disabled={empty && !favs.length}>
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
