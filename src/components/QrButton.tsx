/**
 * The button that shows an address of the game as a QR code: whoever points a phone at the screen, at the
 * board of a classroom or at a sheet of paper opens it. The code itself is worked out and drawn by another
 * file, fetched the first time a code is asked for.
 */
import { QrCode } from 'lucide-react';
import { Suspense, lazy, useState } from 'react';
import { L } from '../lib/i18n';
import { cx } from '../lib/text';
import { ErrorBoundary } from './ErrorBoundary';

const QrDialog = lazy(() => import('./QrDialog').then((m) => ({ default: m.QrDialog })));

/** `what` says in a few words what the address opens: "España · Señalar". */
export function QrButton({ url, what, small, label }: { url: string; what: string; small?: boolean; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={cx('btn', small && 'btn-sm')} onClick={() => setOpen(true)} aria-haspopup="dialog">
        <QrCode size={small ? 15 : 16} aria-hidden="true" />
        {label ?? L('Código QR', 'QR code')}
      </button>
      {open && (
        // If its code does not come, the link can still be copied: only the picture of it is missing.
        <ErrorBoundary fallback={() => null}>
          <Suspense fallback={null}>
            <QrDialog url={url} what={what} onClose={() => setOpen(false)} />
          </Suspense>
        </ErrorBoundary>
      )}
    </>
  );
}
