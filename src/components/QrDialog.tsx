/** An address of the game as a QR code, large enough to be read from the back of a classroom: shown, saved or printed. */
import { Check, ImageDown, Printer } from 'lucide-react';
import { useMemo, useState } from 'react';
import { L } from '../lib/i18n';
import { qrOf } from '../lib/qr';
import { Dialog } from './Dialog';
import { QrPicture, qrBlob } from './QrPicture';
import './qr.css';

export function QrDialog({ url, what, onClose }: { url: string; what: string; onClose(): void }) {
  const [state, setState] = useState<'idle' | 'saved' | 'failed'>('idle');
  /** Null when the address is too long for a code: it is said, and the address stays to be copied. */
  const qr = useMemo(() => {
    try {
      return qrOf(url);
    } catch {
      return null;
    }
  }, [url]);

  const save = async () => {
    if (!qr) return;
    try {
      const href = URL.createObjectURL(await qrBlob(qr));
      const a = document.createElement('a');
      a.href = href;
      a.download = 'regionle-qr.png';
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 30_000);
      setState('saved');
    } catch {
      setState('failed');
    }
  };

  return (
    <Dialog title={L('Código QR', 'QR code')} className="qr-dialog" printing="dlg-print" onClose={onClose}>
      {/* What goes to paper: the code alone in the middle of the sheet, with what it opens over it. */}
      <div className="qr-sheet">
        <p className="qr-brand" aria-hidden="true">
          Regionle ∞
        </p>
        <p className="qr-what">{what}</p>
        {qr ? (
          <QrPicture qr={qr} label={L(`Código QR que abre ${what}`, `QR code that opens ${what}`)} />
        ) : (
          <p className="qr-none" role="alert">
            {L('Esta dirección es demasiado larga para un código QR. Se puede copiar y enviar como enlace.', 'This address is too long for a QR code. It can be copied and sent as a link.')}
          </p>
        )}
        <p className="qr-how">{L('Apunta con la cámara de un móvil o de una tableta para abrirlo.', 'Point the camera of a phone or a tablet at it to open it.')}</p>
        <p className="qr-url">{url}</p>
      </div>
      {qr && (
        <div className="qr-actions dlg-screen">
          <button type="button" className="btn btn-sm" onClick={save}>
            {state === 'saved' ? <Check size={15} aria-hidden="true" /> : <ImageDown size={15} aria-hidden="true" />}
            {L('Guardar imagen', 'Save picture')}
          </button>
          <button type="button" className="btn btn-sm" onClick={() => window.print()}>
            <Printer size={15} aria-hidden="true" />
            {L('Imprimir', 'Print')}
          </button>
        </div>
      )}
      <p className="qr-note dlg-screen" role="status">
        {state === 'saved' && L('Imagen guardada en tus descargas.', 'Picture saved to your downloads.')}
        {state === 'failed' && L('No se ha podido crear la imagen.', 'The picture could not be made.')}
      </p>
    </Dialog>
  );
}
