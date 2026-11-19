/** The button of the results that opens the diploma of a game. The diploma itself is fetched when it is asked for. */
import { Award } from 'lucide-react';
import { Suspense, lazy, useState } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { L } from '../lib/i18n';
import { useStore } from '../lib/store';
import type { Deck } from '../lib/types';
import { earnsDiploma } from './diploma';
import type { Tally } from './resultCard';

const DiplomaDialog = lazy(() => import('./DiplomaDialog').then((m) => ({ default: m.DiplomaDialog })));

export function DiplomaButton({ deck, count, ms }: { deck?: Deck; count: Tally; ms?: number }) {
  const game = useStore((s) => s.game);
  const [open, setOpen] = useState(false);
  if (!game || !earnsDiploma(game, count)) return null;
  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <Award size={16} aria-hidden="true" />
        {L('Diploma', 'Diploma')}
      </button>
      {open && (
        // If its code does not come, the result is there all the same: only the diploma is missing.
        <ErrorBoundary fallback={() => null}>
          <Suspense fallback={null}>
            <DiplomaDialog game={game} deck={deck} count={count} ms={ms} onClose={() => setOpen(false)} />
          </Suspense>
        </ErrorBoundary>
      )}
    </>
  );
}
