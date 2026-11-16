/** What has been learnt so far, recent games, and backup of the saved data. */
import { Download, Trash2, Upload } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Flag } from '../components/ui';
import { eligible, type World } from '../lib/data';
import { MODE_NAME, SECTIONS } from '../lib/modes';
import { go } from '../lib/router';
import { isLearnt, useStore, type Skill } from '../lib/store';
import { fmtTime, nf } from '../lib/text';
import type { Country } from '../lib/types';
import { scoreOf } from '../games/quiz';

const SKILLS: { id: Skill; name: string; hint: string }[] = [
  { id: 'loc', name: 'Situadas en el mapa', hint: 'Señalar' },
  { id: 'name', name: 'Nombradas', hint: 'Identificar, Silueta, Nombrar todo' },
  { id: 'cap', name: 'Capitales', hint: 'Capitales' },
  { id: 'flag', name: 'Banderas', hint: 'Banderas' },
];

interface Row {
  country: Country;
  regions: { seen: number; learnt: number; weak: number };
  whole: { seen: number; learnt: number };
  last: number;
}

function when(t: number): string {
  const d = new Date(t);
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(t).setHours(0, 0, 0, 0)) / 864e5);
  const hour = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  if (days === 0) return `Hoy, ${hour}`;
  if (days === 1) return `Ayer, ${hour}`;
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export function Progress({ world }: { world: World }) {
  const stats = useStore((s) => s.stats);
  const sessions = useStore((s) => s.sessions);
  const best = useStore((s) => s.best);
  const favs = useStore((s) => s.favs);
  const setSel = useStore((s) => s.setSel);
  const resetProgress = useStore((s) => s.resetProgress);
  const importData = useStore((s) => s.importData);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const { skills, rows } = useMemo(() => {
    const skills: Record<Skill, { seen: number; learnt: number }> = { loc: { seen: 0, learnt: 0 }, name: { seen: 0, learnt: 0 }, cap: { seen: 0, learnt: 0 }, flag: { seen: 0, learnt: 0 } };
    const byCountry = new Map<string, Row>();
    /** Item id → [times seen, learnt in every skill seen, last time] */
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
      const cid = id.split(/[-~]/)[0];
      const country = world.byId.get(cid);
      if (!country) continue;
      let row = byCountry.get(cid);
      if (!row) byCountry.set(cid, (row = { country, regions: { seen: 0, learnt: 0, weak: 0 }, whole: { seen: 0, learnt: 0 }, last: 0 }));
      row.last = Math.max(row.last, it.last);
      if (id === cid) {
        row.whole.seen++;
        if (it.learnt) row.whole.learnt++;
      } else {
        row.regions.seen++;
        if (it.learnt) row.regions.learnt++;
        if (it.weak) row.regions.weak++;
      }
    }
    return { skills, rows: [...byCountry.values()] };
  }, [stats, world]);

  const regionRows = rows.filter((r) => r.regions.seen > 0).sort((a, b) => b.last - a.last);
  const countriesSeen = rows.filter((r) => r.whole.seen > 0);
  const countriesLearnt = countriesSeen.filter((r) => r.whole.learnt > 0).length;
  const worldTotal = world.index.countries.filter((c) => c.cl !== 'dep' && eligible('countries', c)).length;

  const totals = sessions.reduce((a, s) => ({ q: a.q + s.total, ok: a.ok + s.ok, warn: a.warn + s.warn, ms: a.ms + s.ms }), { q: 0, ok: 0, warn: 0, ms: 0 });
  const records = Object.entries(best);

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ app: 'regionle', version: 1, exported: new Date().toISOString(), stats, sessions, best, favs }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `regionle-progreso-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      setMessage(importData(JSON.parse(await f.text())) ? 'Progreso importado.' : 'Ese archivo no es una copia de Regionle.');
    } catch {
      setMessage('No se ha podido leer el archivo.');
    }
    if (file.current) file.current.value = '';
  };

  const practise = (c: Country) => {
    setSel('regions', [c.id]);
    go(SECTIONS.regions.path);
  };

  const empty = !sessions.length && !Object.keys(stats).length;

  return (
    <div className="progress">
      <header className="setup-head">
        <p className="kicker">Progreso</p>
        <h1>Lo que ya te sabes</h1>
        <p className="lead">Una pieza cuenta como aprendida cuando la aciertas a la primera dos veces seguidas. Todo se guarda solo en este navegador.</p>
      </header>

      {empty ? (
        <div className="empty-state">
          <p>Todavía no hay nada que enseñar. Juega una partida y vuelve.</p>
          <button type="button" className="btn btn-primary" onClick={() => go(SECTIONS.regions.path)}>
            Empezar
          </button>
        </div>
      ) : (
        <>
          <dl className="tiles">
            <div>
              <dt>Partidas</dt>
              <dd>{nf(sessions.length)}</dd>
            </div>
            <div>
              <dt>Preguntas</dt>
              <dd>{nf(totals.q)}</dd>
            </div>
            <div>
              <dt>Puntuación media</dt>
              <dd>{scoreOf(totals.ok, totals.warn, totals.q)} %</dd>
            </div>
            <div>
              <dt>Tiempo de juego</dt>
              <dd>{fmtTime(totals.ms)}</dd>
            </div>
          </dl>

          <section className="block">
            <h2>Aprendido</h2>
            <ul className="skills">
              {SKILLS.map((s) => {
                const v = skills[s.id];
                return (
                  <li key={s.id}>
                    <div className="skills-head">
                      <b>{s.name}</b>
                      <span>
                        {nf(v.learnt)} <small>de {nf(v.seen)} vistas</small>
                      </span>
                    </div>
                    <div className="bar" role="img" aria-label={`${v.learnt} aprendidas de ${v.seen} vistas`}>
                      <i style={{ width: `${v.seen ? (v.learnt / v.seen) * 100 : 0}%` }} />
                    </div>
                    <small>Se practica en: {s.hint}</small>
                  </li>
                );
              })}
            </ul>
            {countriesSeen.length > 0 && (
              <p className="tip-line">
                Países del mundo aprendidos en algún juego: <b>{countriesLearnt}</b> de {worldTotal}.
              </p>
            )}
          </section>

          {regionRows.length > 0 && (
            <section className="block">
              <h2>Regiones por país</h2>
              <ul className="crow-list">
                {regionRows.map((r) => {
                  const total = Math.max(r.regions.seen, 1);
                  return (
                    <li key={r.country.id} className="crow">
                      <Flag code={r.country.fl} size="md" />
                      <div className="crow-main">
                        <b>{r.country.n.es}</b>
                        <div className="bar" role="img" aria-label={`${r.regions.learnt} aprendidas de ${r.regions.seen} vistas`}>
                          <i style={{ width: `${(r.regions.learnt / total) * 100}%` }} />
                        </div>
                        <small>
                          {r.regions.learnt} aprendidas de {r.regions.seen} vistas
                          {r.regions.weak > 0 ? ` · ${r.regions.weak} se te resisten` : ''}
                        </small>
                      </div>
                      <button type="button" className="btn btn-sm" onClick={() => practise(r.country)}>
                        Practicar
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {records.length > 0 && (
            <section className="block">
              <h2>Récords</h2>
              <ul className="records">
                {records.map(([k, v]) => {
                  const [kind, ...rest] = k.split(':');
                  const what = rest.join(':');
                  if (kind === 'hilo')
                    return (
                      <li key={k}>
                        <b>Mayor o menor</b> · {what === 'area' ? 'superficie' : 'población'}
                        <span>racha de {v}</span>
                      </li>
                    );
                  const ids = what.replace(/^[rc]:/, '').split(',');
                  const names = ids.slice(0, 3).map((id) => world.byId.get(id.split('.')[0])?.n.es ?? id);
                  return (
                    <li key={k}>
                      <b>Nombrar todo</b> · {names.join(', ')}
                      {ids.length > 3 ? ` y ${ids.length - 3} más` : ''}
                      {what.startsWith('c:') ? ' (países)' : ''}
                      <span>{fmtTime(v)}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {sessions.length > 0 && (
            <section className="block">
              <h2>Últimas partidas</h2>
              <div className="table-wrap">
                <table className="sessions">
                  <thead>
                    <tr>
                      <th>Cuándo</th>
                      <th>Juego</th>
                      <th>Mapa</th>
                      <th className="num">A la primera</th>
                      <th className="num">Puntos</th>
                      <th className="num">Tiempo</th>
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
        <h2>Copia de seguridad</h2>
        <p className="tip-line">Llévate tu progreso y tus selecciones guardadas a otro navegador, o empieza de cero.</p>
        <div className="backup">
          <button type="button" className="btn" onClick={exportData} disabled={empty && !favs.length}>
            <Download size={16} aria-hidden="true" />
            Exportar
          </button>
          <button type="button" className="btn" onClick={() => file.current?.click()}>
            <Upload size={16} aria-hidden="true" />
            Importar
          </button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
          {confirming ? (
            <span className="confirm">
              ¿Borrar todo el progreso?
              <button
                type="button"
                className="btn btn-sm btn-danger"
                onClick={() => {
                  resetProgress();
                  setConfirming(false);
                  setMessage('Progreso borrado.');
                }}
              >
                Sí, borrar
              </button>
              <button type="button" className="btn btn-sm" onClick={() => setConfirming(false)}>
                No
              </button>
            </span>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={() => setConfirming(true)} disabled={empty}>
              <Trash2 size={16} aria-hidden="true" />
              Borrar progreso
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
