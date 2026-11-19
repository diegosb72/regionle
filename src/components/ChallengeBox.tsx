/** End of a game: how it went against whoever sent it, and the link to send it on. */
import { Check, Swords } from 'lucide-react';
import { useState } from 'react';
import { canChallenge, challengeUrl, encodeChallenge } from '../lib/challenge';
import { L } from '../lib/i18n';
import { useStore, type GameConfig } from '../lib/store';
import { cx, fmtTime } from '../lib/text';
import { QrButton } from './QrButton';

export function ChallengeBox({ cfg, score, ms, what }: { cfg: GameConfig; score: number; ms: number; what: string }) {
  const nick = useStore((s) => s.nick);
  const setNick = useStore((s) => s.setNick);
  const [state, setState] = useState<'idle' | 'copied' | 'shown'>('idle');
  if (!canChallenge(cfg)) return null;

  const rival = cfg.challenge?.score != null ? { name: cfg.challenge.from || L('Tu rival', 'Your rival'), score: cfg.challenge.score, ms: cfg.challenge.ms ?? 0 } : null;
  const won = rival ? score > rival.score || (score === rival.score && ms < rival.ms) : false;
  const tied = rival ? score === rival.score && Math.abs(ms - rival.ms) < 1000 : false;
  const url = challengeUrl(encodeChallenge(cfg, { score, ms }, nick));
  const text = L(
    `${nick.trim() || 'Alguien'} te reta en Regionle ∞: ${what}. Su resultado: ${score} % en ${fmtTime(ms)}. ¿Lo superas?`,
    `${nick.trim() || 'Someone'} challenges you on Regionle ∞: ${what}. Their result: ${score}% in ${fmtTime(ms)}. Can you beat it?`,
  );

  const send = async () => {
    try {
      if (navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
        await navigator.share({ text, url });
        return;
      }
    } catch {
      // The share sheet was closed: fall back to copying.
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setState('copied');
    } catch {
      setState('shown');
    }
  };

  return (
    <section className="duel" aria-label={L('Reto', 'Challenge')}>
      {rival && (
        <div className={cx('duel-vs', tied ? 'tie' : won ? 'won' : 'lost')}>
          <p className="duel-verdict">{tied ? L('¡Empate!', 'A tie!') : won ? L(`¡Has ganado a ${rival.name}!`, `You beat ${rival.name}!`) : L(`Gana ${rival.name}`, `${rival.name} wins`)}</p>
          <dl>
            <div className={cx(won && !tied && 'best')}>
              <dt>{L('Tú', 'You')}</dt>
              <dd>
                {score} % <small>{fmtTime(ms)}</small>
              </dd>
            </div>
            <div className={cx(!won && !tied && 'best')}>
              <dt>{rival.name}</dt>
              <dd>
                {rival.score} % <small>{fmtTime(rival.ms)}</small>
              </dd>
            </div>
          </dl>
        </div>
      )}
      <div className="duel-send">
        <label>
          <span>{L('Tu nombre', 'Your name')}</span>
          <input type="text" value={nick} maxLength={24} placeholder={L('Opcional', 'Optional')} onChange={(e) => setNick(e.target.value)} autoComplete="nickname" />
        </label>
        <button type="button" className="btn" onClick={send}>
          {state === 'copied' ? <Check size={16} aria-hidden="true" /> : <Swords size={16} aria-hidden="true" />}
          {state === 'copied' ? L('Enlace copiado', 'Link copied') : rival ? L('Devolver el reto', 'Send it back') : L('Retar a alguien', 'Challenge someone')}
        </button>
        <QrButton url={url} what={L(`Reto: ${what}`, `Challenge: ${what}`)} />
      </div>
      <p className="duel-how">{L('El enlace lleva estas mismas preguntas, en el mismo orden, y tu resultado.', 'The link carries these same questions, in the same order, and your result.')}</p>
      {state === 'shown' && <textarea className="duel-link" readOnly rows={3} value={url} onFocus={(e) => e.currentTarget.select()} />}
    </section>
  );
}
