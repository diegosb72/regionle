/**
 * The button that sets a map and a game as homework (lib/task.ts). The panel with the link, and what works
 * it out, is fetched the first time it is asked for.
 */
import { ClipboardCheck } from 'lucide-react';
import { Suspense, lazy, useState } from 'react';
import type { EmbedSource } from '../lib/embed';
import { L } from '../lib/i18n';
import type { Opts } from '../lib/store';
import { cx } from '../lib/text';
import type { World } from '../lib/world';
import { ErrorBoundary } from './ErrorBoundary';

const TaskDialog = lazy(() => import('./TaskDialog').then((m) => ({ default: m.TaskDialog })));

export function TaskButton({ source, opts, world, small }: { source: EmbedSource; opts: Opts; world: World; small?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={cx('btn', small && 'btn-sm')} onClick={() => setOpen(true)} aria-haspopup="dialog">
        <ClipboardCheck size={small ? 15 : 16} aria-hidden="true" />
        {L('Poner de tarea', 'Set as homework')}
      </button>
      {open && (
        // If its code does not come, the link to the map is still there to be sent: only the receipt is missing.
        <ErrorBoundary fallback={() => null}>
          <Suspense fallback={null}>
            <TaskDialog source={source} opts={opts} world={world} onClose={() => setOpen(false)} />
          </Suspense>
        </ErrorBoundary>
      )}
    </>
  );
}
