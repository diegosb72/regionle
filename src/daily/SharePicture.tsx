/** The button that turns the result of a day into a picture, and shares it or saves it. */
import { Check, ImageDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { L } from '../lib/i18n';
import type { Deck } from '../lib/types';
import { CARD_SIZE, cardBlob, type CardInfo } from './shareCard';

/** Whether this device hands pictures over to other applications (phones and tablets do). */
function sharesFiles(): boolean {
  try {
    return typeof navigator.canShare === 'function' && window.matchMedia('(pointer: coarse)').matches && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] });
  } catch {
    return false;
  }
}

export function SharePicture({ info, flagUrl, deck, file, text }: { info: CardInfo; flagUrl?: string; deck: Deck | null; file: string; text: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'shared' | 'saved' | 'failed'>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const ready = useRef<Blob | null>(null);
  const [toApps] = useState(sharesFiles);
  const key = `${JSON.stringify(info)}|${flagUrl ?? ''}|${deck?.key ?? ''}`;

  // Drawn as soon as there is something to draw (and again when the map arrives): a browser only lets
  // a page share right after the tap, with no time to draw anything in between.
  useEffect(() => {
    let alive = true;
    ready.current = null;
    cardBlob(info, { flagUrl, deck })
      .then((blob) => {
        if (alive) ready.current = blob;
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` says all that the picture is made of
  }, [key]);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const send = async () => {
    if (state === 'busy') return;
    setState('busy');
    try {
      const blob = ready.current ?? (await cardBlob(info, { flagUrl, deck }));
      setPreview(URL.createObjectURL(blob));
      if (toApps) {
        try {
          await navigator.share({ files: [new File([blob], file, { type: 'image/png' })], text });
          setState('shared');
          return;
        } catch (e) {
          // Put away by the player: nothing else to do. Anything else: the picture is saved instead.
          if (e instanceof Error && e.name === 'AbortError') {
            setState('idle');
            return;
          }
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setState('saved');
    } catch {
      setState('failed');
    }
  };

  const done = state === 'shared' || state === 'saved';
  return (
    <>
      <button type="button" className="btn" onClick={send} disabled={state === 'busy'}>
        {done ? <Check size={16} aria-hidden="true" /> : <ImageDown size={16} aria-hidden="true" />}
        {toApps ? L('Compartir imagen', 'Share picture') : L('Guardar imagen', 'Save picture')}
      </button>
      <p className="d-share-note" role="status">
        {state === 'saved' && L('Imagen guardada en tus descargas.', 'Picture saved to your downloads.')}
        {state === 'failed' && L('No se ha podido crear la imagen. El texto de arriba sí se puede copiar.', 'The picture could not be made. The text above can still be copied.')}
      </p>
      {preview && (
        <p className="d-pic-wrap">
          <img className="d-pic" src={preview} width={CARD_SIZE} height={CARD_SIZE} alt={L(`Imagen del resultado. ${info.kicker}: ${info.country}, ${info.total} de 100.`, `Picture of the result. ${info.kicker}: ${info.country}, ${info.total} out of 100.`)} />
        </p>
      )}
    </>
  );
}
