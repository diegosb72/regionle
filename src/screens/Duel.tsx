/** A game received by link: who sends it, what it is about and the result to beat. */
import { ArrowLeft, Play, Swords } from 'lucide-react';
import { useMemo } from 'react';
import { Flag } from '../components/ui';
import type { World } from '../lib/data';
import { decodeChallenge } from '../lib/challenge';
import { describeMap } from '../lib/describe';
import { L } from '../lib/i18n';
import { MODES, MODE_NAME, SECTIONS } from '../lib/modes';
import { go } from '../lib/router';
import { DEFAULT_OPTS, useStore } from '../lib/store';
import { fmtTime } from '../lib/text';
import type { Country } from '../lib/types';

export function Duel({ code, world }: { code: string; world: World }) {
  const opts = useStore((s) => s.opts);
  const start = useStore((s) => s.start);
  const challenge = useMemo(() => decodeChallenge(code), [code]);
  const countries = useMemo(() => (challenge && challenge.section !== 'physical' ? challenge.countries.map((id) => world.byId.get(id)).filter((c): c is Country => !!c) : []), [challenge, world]);
  const valid = !!challenge && (challenge.section === 'physical' || countries.length > 0) && MODES[challenge.section].some((m) => m.id === challenge.mode);

  if (!valid || !challenge) {
    return (
      <div className="duel-page">
        <p className="kicker">{L('Reto', 'Challenge')}</p>
        <h1>{L('Este enlace no funciona', 'This link does not work')}</h1>
        <p className="lead">{L('Puede que se haya cortado al copiarlo. Pide que te lo envíen otra vez o elige tú a qué jugar.', 'It may have been cut when it was copied. Ask for it again, or choose a game yourself.')}</p>
        <a className="btn btn-primary" href="#/">
          <ArrowLeft size={16} aria-hidden="true" />
          {L('Ir al inicio', 'Go to the home page')}
        </a>
      </div>
    );
  }

  const who = challenge.from || L('Alguien', 'Someone');
  const length = challenge.opts.length ?? 'all';
  const accept = () => {
    start({
      section: challenge.section,
      mode: challenge.mode,
      countries: challenge.section === 'physical' ? challenge.countries : countries.map((c) => c.id),
      levels: challenge.levels,
      // The sender's options decide the questions; the rest stays as the player has it.
      opts: { ...DEFAULT_OPTS, ...opts, ...challenge.opts },
      challenge: { seed: challenge.seed, from: challenge.from, score: challenge.score, ms: challenge.ms, ...(challenge.legacy ? { legacy: true } : {}) },
    });
    go('jugar');
  };

  return (
    <div className="duel-page">
      <p className="kicker">
        <Swords size={15} aria-hidden="true" /> {L('Reto', 'Challenge')}
      </p>
      <h1>{L(`${who} te reta`, `${who} challenges you`)}</h1>
      <div className="duel-what">
        {countries.length > 0 && (
          <span className="duel-flags" aria-hidden="true">
            {countries.slice(0, 8).map((c) => (
              <Flag key={c.id} code={c.fl} size="md" />
            ))}
          </span>
        )}
        <strong>{describeMap({ section: challenge.section, countries: challenge.countries, levels: challenge.levels, cityPick: challenge.opts.cityPick, cityCount: challenge.opts.cityCount }, world)}</strong>
        <span>
          {SECTIONS[challenge.section].name} · {MODE_NAME[challenge.mode]} · {length === 'all' ? L('todas las preguntas', 'every question') : L(`${length} preguntas`, `${length} questions`)}
          {challenge.opts.answer === 'type' ? ` · ${L('escribiendo', 'typing')}` : ''}
        </span>
      </div>
      {challenge.score != null ? (
        <p className="duel-target">
          {L('Resultado que hay que superar', 'Result to beat')}
          <b>
            {challenge.score} % <small>{L('en', 'in')} {fmtTime(challenge.ms ?? 0)}</small>
          </b>
        </p>
      ) : (
        <p className="lead">{L('Las mismas preguntas, en el mismo orden.', 'The same questions, in the same order.')}</p>
      )}
      <p className="duel-rules">
        {L(
          'Recibiréis las mismas preguntas en el mismo orden. Gana quien saque más puntos: un acierto a la primera vale entero; con pista o al segundo intento, la mitad. Si empatáis, gana el más rápido.',
          'You both get the same questions in the same order. The higher score wins: a first-time right answer counts in full; with a hint or on a later try, half. On a tie, the faster one wins.',
        )}
      </p>
      <div className="duel-actions">
        <button type="button" className="btn btn-primary btn-lg" onClick={accept} autoFocus>
          <Play size={18} aria-hidden="true" />
          {L('Aceptar el reto', 'Accept the challenge')}
        </button>
        <a className="btn btn-ghost" href="#/">
          {L('Ahora no', 'Not now')}
        </a>
      </div>
    </div>
  );
}
