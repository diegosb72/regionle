/**
 * The button that gives the code to put a map and a game inside another page (lib/embed.ts). The panel
 * with the code, and what works it out, is fetched the first time it is asked for.
 */
import { CodeXml } from 'lucide-react';
import { Suspense, lazy, useState } from 'react';
import type { EmbedSource } from '../lib/embed';
import { L } from '../lib/i18n';
import type { Opts } from '../lib/store';
import { cx } from '../lib/text';
import { ErrorBoundary } from './ErrorBoundary';

const EmbedDialog = lazy(() => import('./EmbedDialog').then((m) => ({ default: m.EmbedDialog })));

/** `what` says in a few words what the box will show: "España · provincias · Señalar". */
export function EmbedButton({ source, opts, what, small }: { source: EmbedSource; opts: Opts; what: string; small?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={cx('btn', small && 'btn-sm')} onClick={() => setOpen(true)} aria-haspopup="dialog">
        <CodeXml size={small ? 15 : 16} aria-hidden="true" />
        {L('Incrustar', 'Embed')}
      </button>
      {open && (
        // If its code does not come, the link is still there to be sent: only the box for another page is missing.
        <ErrorBoundary fallback={() => null}>
          <Suspense fallback={null}>
            <EmbedDialog source={source} opts={opts} what={what} onClose={() => setOpen(false)} />
          </Suspense>
        </ErrorBoundary>
      )}
    </>
  );
}
