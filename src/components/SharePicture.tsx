/**
 * The button that turns something into a picture and shares it or saves it: a result, of a day or of a game,
 * or whatever the page that shows the button knows how to draw (the map of what is known).
 */
import { Check, ImageDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { L } from '../lib/i18n';
import { CARD_SIZE, cardBlob, type CardInfo } from '../lib/shareCard';
import type { Deck, Res } from '../lib/types';
import './sharePicture.css';

/** Whether this device hands pictures over to other applications (phones and tablets do). */
function sharesFiles(): boolean {
  try {
    return typeof navigator.canShare === 'function' && window.matchMedia('(pointer: coarse)').matches && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] });
  } catch {
    return false;
  }
}

/**
 * The button itself, for a picture of any kind. `make` draws it; `stamp` says all that it is made of, so that
 * it is drawn again when that changes; `alt` is what the picture says, for whoever does not see it. `failed`
 * is what to say when the picture cannot be made. With `idle`, the picture is drawn that many milliseconds
 * after the button is shown, not at once: for a page that has more urgent things to draw.
 */
export function PictureButton({
  make,
  stamp,
  file,
  text,
  alt,
  failed = L('No se ha podido crear la imagen.', 'The picture could not be made.'),
  small = false,
  idle = 0,
}: {
  make(): Promise<Blob>;
  stamp: string;
  file: string;
  text: string;
  alt: string;
  failed?: string;
  small?: boolean;
  idle?: number;
}) {
  const [state, setState] = useState<'idle' | 'busy' | 'shared' | 'saved' | 'failed'>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const ready = useRef<Blob | null>(null);
  const [toApps] = useState(sharesFiles);
  // The one of the last time the button was drawn: it is made anew each time, with what the page then knows.
  const making = useRef(make);
  making.current = make;

  // Drawn as soon as there is something to draw (and again when the map arrives): a browser only lets
  // a page share right after the tap, with no time to draw anything in between.
  useEffect(() => {
    let alive = true;
    ready.current = null;
    const draw = () => {
      making
        .current()
        .then((blob) => {
          if (alive) ready.current = blob;
        })
        .catch(() => {});
    };
    const wait = idle > 0 ? window.setTimeout(draw, idle) : 0;
    if (!wait) draw();
    return () => {
      alive = false;
      if (wait) clearTimeout(wait);
    };
  }, [stamp, idle]);

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
      const blob = ready.current ?? (await making.current());
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
      <button type="button" className={small ? 'btn btn-sm' : 'btn'} onClick={send} disabled={state === 'busy'}>
        {done ? <Check size={small ? 15 : 16} aria-hidden="true" /> : <ImageDown size={small ? 15 : 16} aria-hidden="true" />}
        {toApps ? L('Compartir imagen', 'Share picture') : L('Guardar imagen', 'Save picture')}
      </button>
      <p className="pic-note" role="status">
        {state === 'saved' && L('Imagen guardada en tus descargas.', 'Picture saved to your downloads.')}
        {state === 'failed' && failed}
      </p>
      {preview && (
        <p className="pic-wrap">
          <img className="pic" src={preview} width={CARD_SIZE} height={CARD_SIZE} alt={alt} />
        </p>
      )}
    </>
  );
}

/**
 * The picture of a result. `tones` paints each piece of the map by how its answer went (the picture of a
 * game); `failed` is what to say when the picture cannot be made, where there is no text to copy instead.
 */
export function SharePicture({
  info,
  flagUrl,
  deck,
  tones,
  file,
  text,
  failed = L('No se ha podido crear la imagen. El texto de arriba sí se puede copiar.', 'The picture could not be made. The text above can still be copied.'),
}: {
  info: CardInfo;
  flagUrl?: string;
  deck: Deck | null;
  tones?: Record<string, Res>;
  file: string;
  text: string;
  failed?: string;
}) {
  return (
    <PictureButton
      make={() => cardBlob(info, { flagUrl, deck, tones })}
      stamp={`${JSON.stringify(info)}|${flagUrl ?? ''}|${deck?.key ?? ''}|${tones ? JSON.stringify(tones) : ''}`}
      file={file}
      text={text}
      alt={
        info.unit === '%'
          ? L(`Imagen del resultado. ${info.kicker}: ${info.country}, ${info.total} %.`, `Picture of the result. ${info.kicker}: ${info.country}, ${info.total}%.`)
          : L(`Imagen del resultado. ${info.kicker}: ${info.country}, ${info.total} de 100.`, `Picture of the result. ${info.kicker}: ${info.country}, ${info.total} out of 100.`)
      }
      failed={failed}
    />
  );
}
