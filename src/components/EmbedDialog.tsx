/** The code that puts a map and a game inside another page, to be copied: with the height of its box to choose. */
import { Check, Copy, ExternalLink } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { EMBED_HEIGHTS, EMBED_HEIGHT_DEFAULT, embedCode, embedPath, embedSrc, type EmbedHeight, type EmbedSource } from '../lib/embed';
import { L, getLang } from '../lib/i18n';
import type { Opts } from '../lib/store';
import { Dialog } from './Dialog';
import { Seg } from './ui';
import './embed.css';

export function EmbedDialog({ source, opts, what, onClose }: { source: EmbedSource; opts: Opts; what: string; onClose(): void }) {
  const [height, setHeight] = useState<EmbedHeight>(EMBED_HEIGHT_DEFAULT);
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const src = useMemo(() => embedSrc(embedPath(source, opts), getLang()), [source, opts]);
  const code = useMemo(() => embedCode(src, `Regionle: ${what}`, height), [src, what, height]);
  // Another height is another code: what was said of the last one no longer holds.
  useEffect(() => setState('idle'), [code]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setState('copied');
    } catch {
      setState('failed');
    }
  };

  return (
    <Dialog title={L('Incrustar en otra web', 'Embed in another page')} className="embed-dialog" onClose={onClose}>
      <p className="embed-what">{what}</p>
      <p className="embed-how">
        {L(
          'Pega este código en tu web, en tu blog o en el aula virtual: el juego sale en un recuadro, sin menús, tal como lo tienes puesto aquí.',
          'Paste this code into your site, your blog or your virtual classroom: the game comes up in a box, without menus, just as you have it set here.',
        )}
      </p>
      <div className="opt">
        <span className="opt-label">{L('Alto del recuadro', 'Height of the box')}</span>
        <Seg<EmbedHeight> label={L('Alto del recuadro', 'Height of the box')} value={height} onChange={setHeight} options={EMBED_HEIGHTS.map((h) => ({ value: h, label: `${h} px` }))} />
      </div>
      <textarea className="duel-link embed-code" readOnly rows={5} value={code} aria-label={L('Código para incrustar', 'Code to embed')} onFocus={(e) => e.currentTarget.select()} />
      <div className="embed-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={copy}>
          {state === 'copied' ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
          {state === 'copied' ? L('Código copiado', 'Code copied') : L('Copiar código', 'Copy the code')}
        </button>
        <a className="btn btn-sm" href={src} target="_blank" rel="noopener">
          <ExternalLink size={15} aria-hidden="true" />
          {L('Ver cómo queda', 'See how it looks')}
        </a>
      </div>
      <p className="embed-note" role="status">
        {state === 'copied' && L('Copiado: pégalo donde tu web deja poner HTML.', 'Copied: paste it where your site takes HTML.')}
        {state === 'failed' && L('El navegador no ha dejado copiarlo: selecciona el código y cópialo a mano.', 'The browser would not copy it: select the code and copy it by hand.')}
      </p>
      <ul className="embed-notes">
        <li>{L('Nada empieza solo: quien llega ve una tarjeta con el botón «Empezar». Un mapa para explorar se ve desde el principio.', 'Nothing starts by itself: whoever comes sees a card with the “Start” button. A map to explore is on show from the start.')}</li>
        <li>{L('El recuadro ocupa el ancho del sitio donde lo pongas; en una columna estrecha se ve como en un móvil.', 'The box takes the width of where you put it; in a narrow column it looks as it does on a phone.')}</li>
        <li>{L('Ahí no se piden fichas de Wikipedia: desde tu página no se pide nada a otros sitios.', 'No Wikipedia cards are asked for there: nothing is requested from other sites through your page.')}</li>
      </ul>
    </Dialog>
  );
}
