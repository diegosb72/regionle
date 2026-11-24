/**
 * «Cómo se juega»: the rules of a game, in a panel over the page. Fetched when it is first asked for, with
 * the texts of every game (lib/help.ts).
 */
import { ArrowRight, Lightbulb, LifeBuoy, SlidersHorizontal, Target, type LucideIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { helpOf, type ModeHelp } from '../lib/help';
import { L } from '../lib/i18n';
import { MODES, MODE_NAME } from '../lib/modes';
import { useStore } from '../lib/store';
import { cx } from '../lib/text';
import type { Mode, Section } from '../lib/types';
import { Dialog } from './Dialog';
import './help.css';

/** A game that is not a mode of a section (those of «Banderas»): what it is and how it is played, as whoever shows it says. */
export interface OwnHelp {
  name: string;
  desc: string;
  icon?: LucideIcon;
  help: ModeHelp;
}

export interface HelpProps {
  /** A game of a section with a map: its rules are those of that mode in that section (lib/help.ts). */
  mode?: Mode;
  section?: Section;
  /** …or a game that is told as it is given. */
  own?: OwnHelp;
  /** Shown by itself, the first time the game is opened: it says so, and how not to be shown the next ones. */
  first?: boolean;
  /** Over a game in course, whose clock is stopped meanwhile. */
  playing?: boolean;
  /** «Reglas a medida» (lib/ruleset.ts): the rules of the game that are not the usual ones, in words. What follows tells the usual ones. */
  rules?: string;
  onClose(): void;
}

export function HelpDialog({ mode, section, own, first, playing, rules, onClose }: HelpProps) {
  const auto = useStore((s) => s.helpAuto);
  const setAuto = useStore((s) => s.setHelpAuto);
  const go = useRef<HTMLButtonElement>(null);
  const help = own ? own.help : mode && section ? helpOf(mode, section) : null;
  const def = own ?? (mode && section ? MODES[section].find((m) => m.id === mode) : undefined);

  // The panel leaves the keyboard on its first button, the one that closes it at the top: here it is left on
  // the one that goes on, so that Intro starts the game.
  useEffect(() => {
    go.current?.focus({ preventScroll: true });
  }, []);
  // Nothing to tell: the panel is not opened at all.
  useEffect(() => {
    if (!help) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!help) return null;

  const Icon = def?.icon;
  return (
    <Dialog title={L('Cómo se juega', 'How to play')} className={cx('help-dlg', playing && 'help-over')} onClose={onClose}>
      <div className="help">
        <h3 className="help-name">
          {Icon && (
            <span className="help-icon">
              <Icon size={18} aria-hidden="true" />
            </span>
          )}
          {own ? own.name : mode ? MODE_NAME[mode] : ''}
        </h3>
        {def && <p className="help-lead">{def.desc}</p>}
        {rules && (
          <p className="help-rules">
            <SlidersHorizontal size={15} aria-hidden="true" />
            <span>
              <b>{L(`Reglas a medida: ${rules}.`, `Custom rules: ${rules}.`)}</b> {L('Donde lo que sigue diga otra cosa, valen estas.', 'Where what follows says otherwise, these hold.')}
            </span>
          </p>
        )}
        <ol className="help-steps">
          {help.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
        <dl className="help-more">
          <div>
            <dt>
              <Target size={15} aria-hidden="true" />
              {L('Cómo cuenta', 'How it counts')}
            </dt>
            <dd>{help.score}</dd>
          </div>
          {help.aid && (
            <div>
              <dt>
                <LifeBuoy size={15} aria-hidden="true" />
                {L('Las ayudas', 'The help')}
              </dt>
              <dd>{help.aid}</dd>
            </div>
          )}
          {help.tip && (
            <div>
              <dt>
                <Lightbulb size={15} aria-hidden="true" />
                {L('Un consejo', 'A tip')}
              </dt>
              <dd>{help.tip}</dd>
            </div>
          )}
        </dl>
        {first && (
          <div className="help-first">
            <p>{L('Para volver a verlo, pulsa el signo de interrogación de la parte de arriba.', 'To see this again, press the question mark at the top.')}</p>
            <label className="help-auto">
              <input type="checkbox" checked={!auto} onChange={(e) => setAuto(!e.target.checked)} />
              <span>{L('No enseñármelo al estrenar un juego', 'Do not show me this when I first open a game')}</span>
            </label>
          </div>
        )}
        {/* Always in sight, however long the rules are: the way on. */}
        <footer className="help-foot">
          <button
            ref={go}
            type="button"
            className="btn btn-primary"
            onClick={(e) => {
              // Through the closing of the panel itself, which gives the keyboard back to where it was.
              const panel = e.currentTarget.closest('dialog');
              if (panel?.open && typeof panel.close === 'function') panel.close();
              else onClose();
            }}
          >
            {first ? L('Empezar', 'Start') : playing ? L('Seguir jugando', 'Back to the game') : L('Entendido', 'Got it')}
            {(first || playing) && <ArrowRight size={16} aria-hidden="true" />}
          </button>
          {playing && <p className="help-note">{L('El tiempo de la partida está parado mientras lees.', 'The clock of the game is stopped while you read.')}</p>}
        </footer>
      </div>
    </Dialog>
  );
}
