/** Setup: 1 countries, 2 mode, 3 options. */
import { ChevronDown, Infinity as InfinityIcon, Play } from 'lucide-react';
import { useMemo, useRef } from 'react';
import { Picker } from '../components/Picker';
import { Flag, Seg, Toggle, capitalise } from '../components/ui';
import { eligible, levelOf, type World } from '../lib/data';
import { MODES, SECTIONS } from '../lib/modes';
import { go } from '../lib/router';
import { useStore, type Length, type Opts } from '../lib/store';
import { cx, nf, plural } from '../lib/text';
import type { Mode, Section } from '../lib/types';

const LEVELS = ['Fácil', 'Medio', 'Difícil'];
const ANSWER_MODES: Mode[] = ['identify', 'outline', 'capital', 'flag'];
const LENGTH_MODES: Mode[] = ['pin', 'identify', 'outline', 'capital', 'flag', 'exact', 'which', 'rank'];

export function Setup({ section, world }: { section: Section; world: World }) {
  const selected = useStore((s) => s.sel[section]);
  const setSel = useStore((s) => s.setSel);
  const levels = useStore((s) => s.levels);
  const setLevel = useStore((s) => s.setLevel);
  const mode = useStore((s) => s.mode[section]);
  const setMode = useStore((s) => s.setMode);
  const opts = useStore((s) => s.opts);
  const setOpts = useStore((s) => s.setOpts);
  const start = useStore((s) => s.start);
  const modeRef = useRef<HTMLElement>(null);
  const meta = SECTIONS[section];
  const modes = MODES[section];
  const def = modes.find((m) => m.id === mode) ?? modes[0];

  const chosen = useMemo(
    () => selected.map((id) => world.byId.get(id)).filter((c) => c != null && eligible(section, c)).map((c) => c!),
    [selected, world, section],
  );
  const multi = chosen.filter((c) => c.lv.length > 1);
  const units = section === 'regions' ? chosen.reduce((n, c) => n + levelOf(c, levels).n, 0) : chosen.length;
  const shared = section === 'regions' && chosen.length > 0 && new Set(chosen.map((c) => levelOf(c, levels).es)).size === 1 ? levelOf(chosen[0], levels) : null;
  const noun = section === 'regions' ? (shared ? [shared.sg, shared.es] : ['región', 'regiones']) : ['país', 'países'];
  const need = section === 'regions' ? 1 : 2;
  const problem = chosen.length < need ? (need === 1 ? 'Elige al menos un país.' : 'Elige al menos dos países.') : def.id === 'travel' && units < 4 ? 'La ruta necesita un mapa con más piezas.' : null;

  const typed = ANSWER_MODES.includes(def.id) && opts.answer === 'type';
  const show = {
    answer: ANSWER_MODES.includes(def.id),
    length: LENGTH_MODES.includes(def.id),
    suggest: typed || def.id === 'travel',
    labels: def.id === 'pin' || def.id === 'identify',
    pinBy: def.id === 'pin' && section === 'countries',
    blind: def.id === 'travel',
    metric: section === 'pops',
  };
  const anyOption = Object.values(show).some(Boolean);

  const lengths: { value: Length; label: React.ReactNode; title?: string }[] =
    def.id === 'rank'
      ? [
          { value: 'all', label: '10 rondas' },
          { value: 20, label: '20' },
          { value: 50, label: '50' },
          { value: 'endless', label: <InfinityIcon size={16} aria-label="Sin fin" />, title: 'Sin fin' },
        ]
      : [
          { value: 'all', label: `Todo (${nf(units)})` },
          { value: 10, label: '10' },
          { value: 20, label: '20' },
          { value: 50, label: '50' },
          { value: 'endless', label: <InfinityIcon size={16} aria-label="Sin fin" />, title: 'Sin fin: lo fallado vuelve a salir' },
        ];

  const begin = () => {
    if (problem) return;
    const picked: Record<string, string> = {};
    for (const c of chosen) picked[c.id] = levelOf(c, levels).k;
    start({ section, mode: def.id, countries: chosen.map((c) => c.id), levels: picked, opts });
    go('jugar');
  };

  const set = (patch: Partial<Opts>) => setOpts(patch);

  return (
    <div className="setup">
      <header className="setup-head">
        <p className="kicker">{meta.name}</p>
        <h1>{meta.title}</h1>
        <p className="lead">{meta.blurb}</p>
      </header>

      <section className="step setup-main">
        <h2>
          <span className="step-n">01</span> Países
        </h2>
        <Picker section={section} world={world} selected={selected} onChange={(ids) => setSel(section, ids)} />
      </section>

      <aside className="setup-side">
      <div className="setup-scroll">
      <section className="step step-mode" ref={modeRef}>
        <h2>
          <span className="step-n">02</span> Modo
        </h2>
        <div className="modes">
          {modes.map((m) => {
            const Icon = m.icon;
            return (
              <button key={m.id} type="button" className={cx('mode', m.id === def.id && 'on')} aria-pressed={m.id === def.id} title={m.desc} onClick={() => setMode(section, m.id)}>
                <span className="mode-icon">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span className="mode-name">
                  {m.name}
                  <span className="mode-level" title={LEVELS[m.level - 1]} aria-label={LEVELS[m.level - 1]}>
                    {[1, 2, 3].map((n) => (
                      <i key={n} className={n <= m.level ? 'on' : undefined} />
                    ))}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="mode-about" aria-live="polite">
          <strong>{LEVELS[def.level - 1]}.</strong> {def.desc}
        </p>
      </section>

      <section className="step">
        <h2>
          <span className="step-n">03</span> Ajustes
        </h2>
        {!anyOption && !(section === 'regions' && multi.length > 0) && <p className="tip-line">«{def.name}» no necesita ajustes.</p>}
        <div className="options">
          {section === 'regions' && multi.length > 0 && (
            <details className="levels" open={multi.length <= 4}>
              <summary>
                <span className="opt-label">Nivel de detalle</span>
                {multi.length > 4 && <small>{multi.length} países con varios niveles</small>}
              </summary>
              <ul>
                {multi.map((c) => (
                  <li key={c.id}>
                    <span className="levels-name">
                      <Flag code={c.fl} size="sm" /> {c.n.es}
                    </span>
                    <Seg small label={`Nivel de ${c.n.es}`} value={levelOf(c, levels).k} onChange={(k) => setLevel(c.id, k)} options={c.lv.map((l) => ({ value: l.k, label: `${capitalise(l.es)} · ${l.n}` }))} />
                  </li>
                ))}
              </ul>
            </details>
          )}
          {show.metric && (
            <div className="opt">
              <span className="opt-label">Cifra</span>
              <Seg
                label="Cifra"
                value={opts.metric}
                onChange={(metric) => set({ metric })}
                options={[
                  { value: 'pop', label: 'Población' },
                  { value: 'area', label: 'Superficie' },
                ]}
              />
            </div>
          )}
          {show.pinBy && (
            <div className="opt">
              <span className="opt-label">Te mostramos</span>
              <Seg
                label="Qué se muestra"
                value={opts.pinBy}
                onChange={(pinBy) => set({ pinBy })}
                options={[
                  { value: 'name', label: 'El nombre' },
                  { value: 'capital', label: 'La capital' },
                  { value: 'flag', label: 'La bandera' },
                ]}
              />
            </div>
          )}
          {show.answer && (
            <div className="opt">
              <span className="opt-label">Respuesta</span>
              <Seg
                label="Forma de responder"
                value={opts.answer}
                onChange={(answer) => set({ answer })}
                options={[
                  { value: 'choice', label: 'Cuatro opciones', title: 'Más fácil: reconocer' },
                  { value: 'type', label: 'Escribir', title: 'Más difícil: recordar' },
                ]}
              />
            </div>
          )}
          {show.length && (
            <div className="opt">
              <span className="opt-label">Preguntas</span>
              <Seg label="Número de preguntas" value={opts.length} onChange={(length) => set({ length })} options={lengths} />
            </div>
          )}
          {show.suggest && (
            <Toggle checked={opts.suggest} onChange={(suggest) => set({ suggest })} hint="Más fácil: eliges de una lista mientras escribes.">
              Sugerencias al escribir
            </Toggle>
          )}
          {show.labels && (
            <Toggle checked={opts.labels} onChange={(v) => set({ labels: v })} hint="Lo que vas resolviendo queda rotulado en el mapa.">
              Dejar los nombres en el mapa
            </Toggle>
          )}
          {show.blind && (
            <Toggle checked={opts.blind} onChange={(blind) => set({ blind })} hint="Sin fronteras interiores hasta que aciertas: solo para valientes.">
              Mapa mudo
            </Toggle>
          )}
        </div>
      </section>

      </div>
      <div className="startbar">
        <button type="button" className="startbar-info" title="Ver modo y ajustes" onClick={() => modeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
          <strong>
            {chosen.length === 0 ? 'Nada elegido' : chosen.length === 1 ? chosen[0].n.es : plural(chosen.length, 'país', 'países')}
            {section === 'regions' && chosen.length > 0 ? ` · ${plural(units, noun[0], noun[1])}` : ''}
          </strong>
          <span>
            <b>{problem ?? `${def.name}${show.length && opts.length === 'endless' ? ' · sin fin' : ''}`}</b>
            <ChevronDown size={14} aria-hidden="true" />
          </span>
        </button>
        <div className="startbar-flags" aria-hidden="true">
          {chosen.slice(0, 7).map((c) => (
            <Flag key={c.id} code={c.fl} size="sm" />
          ))}
          {chosen.length > 7 && <small>+{chosen.length - 7}</small>}
        </div>
        <button type="button" className="btn btn-primary btn-lg" onClick={begin} disabled={!!problem}>
          <Play size={18} aria-hidden="true" />
          Empezar
        </button>
      </div>
      </aside>
    </div>
  );
}
