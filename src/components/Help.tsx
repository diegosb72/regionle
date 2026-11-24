/**
 * The way into «Cómo se juega» from whatever shows it: the panel is fetched when it is asked for, with the
 * texts of every game, so that neither the first page nor a game carries them.
 */
import { CircleHelp } from 'lucide-react';
import { Suspense, lazy, useEffect, useState } from 'react';
import { L } from '../lib/i18n';
import type { Mode, Section } from '../lib/types';
import { ErrorBoundary } from './ErrorBoundary';
import type { HelpProps, OwnHelp } from './HelpDialog';

const HelpDialog = lazy(() => import('./HelpDialog').then((m) => ({ default: m.HelpDialog })));

/** If the panel does not come there is nothing to show: whoever opened it is told it has closed. */
function Gone({ onClose }: { onClose(): void }) {
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/** The panel, once it is here. */
export function HelpPanel(props: HelpProps) {
  return (
    <ErrorBoundary fallback={() => <Gone onClose={props.onClose} />}>
      <Suspense fallback={null}>
        <HelpDialog {...props} />
      </Suspense>
    </ErrorBoundary>
  );
}

/** What opens it where a game is chosen: a link at the end of what the game is, in the same line. */
export function HelpButton({ mode, section, rules, own }: { mode?: Mode; section?: Section; rules?: string; own?: OwnHelp }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="link help-open" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <CircleHelp size={14} aria-hidden="true" />
        {L('Cómo se juega', 'How to play')}
      </button>
      {open && <HelpPanel mode={mode} section={section} own={own} rules={rules} onClose={() => setOpen(false)} />}
    </>
  );
}
