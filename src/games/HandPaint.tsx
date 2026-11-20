/**
 * Painting the map by hand, in Explore: a palette to pick a colour from, a line for what each colour in use
 * stands for, and the painting as a picture to save or to send. What paints is the click on the map or on
 * the list, which Explore hands over while this is out; the painting itself is kept in the store.
 */
import { Eraser } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { PictureButton } from '../components/SharePicture';
import { capitalise } from '../components/ui';
import { ERASER, HAND_COLOURS, HAND_LABEL_MAX, handColourName, handLegend, labelled, type HandMap } from '../lib/hand';
import { handCardBlob, type HandCardInfo } from '../lib/handCard';
import { L, fmtDay, getLang } from '../lib/i18n';
import { siteRoot } from '../lib/routes';
import { siteLabel } from '../lib/shareCard';
import { cx, nf, today } from '../lib/text';
import type { Deck } from '../lib/types';
import './hand.css';

export function HandPaint({
  deck,
  title,
  map,
  brush,
  said,
  onBrush,
  onChange,
}: {
  deck: Deck;
  /** What the map is called, as the head of the screen says it. */
  title: string;
  map: HandMap | undefined;
  brush: number;
  /** What the last touch did: "Badajoz: naranja." */
  said: string;
  onBrush(brush: number): void;
  /** The painting as it is now; null to take it away. */
  onChange(map: HandMap | null): void;
}) {
  const [asking, setAsking] = useState(false);
  // The colours come out under the switch, which on a phone may be below what is on show: bring them up.
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    box.current?.scrollIntoView?.({ block: 'nearest' });
  }, []);
  const rows = handLegend(map, (id) => deck.byId.has(id));
  const painted = rows.reduce((n, row) => n + row.count, 0);
  const day = today();
  const names = HAND_COLOURS.map((_, i) => capitalise(handColourName(i + 1)));
  const info: HandCardInfo = { kicker: L('Pintado a mano', 'Painted by hand'), title, rows, names, day: fmtDay(day, true), site: siteLabel() };
  const fills = map?.f ?? {};
  const stamp = `${deck.key}|${getLang()}|${title}|${day}|${JSON.stringify(rows)}|${JSON.stringify(fills)}`;
  const told = rows.map((row) => `${nf(row.count)} ${L('de', 'in')} ${handColourName(row.colour)}${row.label ? ` (${row.label})` : ''}`);

  return (
    <div className="hand" ref={box}>
      <div className="hand-palette" role="radiogroup" aria-label={L('Color con el que pintar', 'Colour to paint with')}>
        {HAND_COLOURS.map((_, i) => (
          <label key={i} className={cx('hand-swatch', `hand-c${i + 1}`, brush === i + 1 && 'on')} title={names[i]}>
            <input type="radio" name="hand-brush" checked={brush === i + 1} onChange={() => onBrush(i + 1)} />
            <span className="sr-only">{names[i]}</span>
          </label>
        ))}
        <label className={cx('hand-swatch', 'hand-eraser', brush === ERASER && 'on')} title={L('Goma', 'Eraser')}>
          <input type="radio" name="hand-brush" checked={brush === ERASER} onChange={() => onBrush(ERASER)} />
          <Eraser size={18} aria-hidden="true" />
          <span className="sr-only">{L('Goma', 'Eraser')}</span>
        </label>
      </div>
      <p className="hand-say" role="status">
        {said ||
          (brush === ERASER
            ? L('Toca una pieza pintada para quitarle el color.', 'Tap a painted piece to take its colour off.')
            : L(`Toca una pieza, en el mapa o en la lista, para pintarla de ${handColourName(brush)}.`, `Tap a piece, on the map or in the list, to paint it ${handColourName(brush)}.`))}
      </p>
      {rows.length > 0 && (
        <ul className="hand-legend">
          {rows.map((row) => (
            <li key={row.colour} className={`hand-c${row.colour}`}>
              <i aria-hidden="true" />
              <b>{nf(row.count)}</b>
              <input
                type="text"
                value={map?.l[row.colour] ?? ''}
                maxLength={HAND_LABEL_MAX}
                placeholder={L('Qué significa', 'What it stands for')}
                aria-label={L(`Qué significa el ${handColourName(row.colour)}`, `What ${handColourName(row.colour)} stands for`)}
                onChange={(e) => onChange(labelled(map, row.colour, e.target.value, Date.now()))}
              />
            </li>
          ))}
        </ul>
      )}
      {painted > 0 && (
        <div className="hand-acts">
          {asking ? (
            <>
              <p className="hand-ask">{L('¿Borrar todo lo pintado en este mapa?', 'Clear everything painted on this map?')}</p>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  setAsking(false);
                  onChange(null);
                }}
              >
                {L('Sí, borrar', 'Yes, clear it')}
              </button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setAsking(false)}>
                {L('No', 'No')}
              </button>
            </>
          ) : (
            <>
              <PictureButton
                key={stamp}
                small
                idle={600}
                make={() => handCardBlob(info, deck, fills)}
                stamp={stamp}
                file={`regionle-${L('mapa-pintado', 'painted-map')}-${day}.png`}
                text={[`Regionle ∞ · ${title}`, siteRoot()].join('\n')}
                alt={L(`Imagen del mapa pintado. ${title}: ${told.join(', ')}.`, `Picture of the painted map. ${title}: ${told.join(', ')}.`)}
              />
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setAsking(true)}>
                {L('Borrar todo', 'Clear all')}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
