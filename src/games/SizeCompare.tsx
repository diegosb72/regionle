/**
 * The size comparer of Explore: two pieces of the map one on top of the other, each seen from above its own
 * middle and both at the same scale, with their surfaces and how much larger one is than the other.
 */
import { useEffect, useMemo, useRef } from 'react';
import { areaKm2, overlaid } from '../lib/geo';
import { L } from '../lib/i18n';
import { bothNames, roughArea, scaleBar, sizeLine } from '../lib/sizes';
import { fmtArea } from '../lib/text';
import type { Item } from '../lib/types';
import './sizes.css';

/** The side of the drawing, in its own units. */
const SIZE = 240;
/** A piece smaller than this in the drawing is a speck beside the other: a ring says where it is. */
const SPECK = 9;

export function SizeCompare({ a, b, noun, fem, odd, onClear }: { a: Item | null; b: Item | null; noun: string; fem: boolean; odd: boolean; onClear(): void }) {
  const art = useMemo(() => (a && b ? overlaid(a.geo, b.geo, SIZE) : null), [a, b]);
  // The figure the game has for each, where it has one for both. A desert, a range or a peninsula has none,
  // because where it ends is anybody's guess: then both are measured on their outlines, and said as rough.
  const told = !!a && !!b && a.area > 0 && b.area > 0;
  const areas = useMemo<[number, number] | null>(() => {
    if (!a || !b) return null;
    return told ? [a.area, b.area] : [areaKm2(a.geo), areaKm2(b.geo)];
  }, [a, b, told]);
  const figure = (km2: number): string => (told ? fmtArea(km2) : roughArea(km2));
  const bar = art ? scaleBar(art.km, SIZE * 0.4) : null;
  const another = L(`${fem ? 'otra' : 'otro'} ${noun}`, `another ${noun}`);
  const noSurface = L(`Eso no tiene una superficie que comparar: elige ${another}.`, `That has no area to compare: choose ${another}.`);

  // The drawing comes out under the switch, which on a phone may be below what is on show: bring it up.
  const box = useRef<HTMLDivElement>(null);
  const pair = a && b ? `${a.id} ${b.id}` : '';
  useEffect(() => {
    if (pair) box.current?.scrollIntoView?.({ block: 'nearest' });
  }, [pair]);

  return (
    <div className="sizes" role="status" ref={box}>
      {a && b && art && areas ? (
        <>
          <svg className="sizes-art" viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={L(`${bothNames(a.name, b.name)}, a la misma escala`, `${bothNames(a.name, b.name)}, at the same scale`)}>
            {/* The smaller one on top, so that it is never hidden under the other. */}
            {areas[0] >= areas[1] ? (
              <>
                <path className="sizes-a" d={art.a} />
                <path className="sizes-b" d={art.b} />
              </>
            ) : (
              <>
                <path className="sizes-b" d={art.b} />
                <path className="sizes-a" d={art.a} />
              </>
            )}
            {art.spans[0] < SPECK && <circle className="sizes-ring sizes-a" cx={SIZE / 2} cy={SIZE / 2} r={SPECK} />}
            {art.spans[1] < SPECK && <circle className="sizes-ring sizes-b" cx={SIZE / 2} cy={SIZE / 2} r={SPECK} />}
            {bar && (
              <g className="sizes-bar" transform={`translate(8 ${SIZE - 8})`}>
                <path d={`M0 -4V0H${bar.length.toFixed(1)}V-4`} />
                <text x={bar.length / 2} y={-5}>
                  {bar.label}
                </text>
              </g>
            )}
          </svg>
          <ul className="sizes-list">
            <li className="sizes-ka">
              <i aria-hidden="true" />
              <b>{a.name}</b>
              <span>{figure(areas[0])}</span>
            </li>
            <li className="sizes-kb">
              <i aria-hidden="true" />
              <b>{b.name}</b>
              <span>{figure(areas[1])}</span>
            </li>
          </ul>
          <p className="sizes-line">{sizeLine({ name: a.name, area: areas[0] }, { name: b.name, area: areas[1] }, { rough: !told, label: a.kind === 'feature' || b.kind === 'feature' })}</p>
          {!told && <p className="sizes-ask sizes-rough">{L('Son cifras a ojo: lo que ocupa cada contorno en este mapa.', 'Rough figures: what each outline takes up on this map.')}</p>}
          <p className="sizes-ask">{odd ? noSurface : L(`Para comparar otra vez, elige ${another}.`, `To compare again, choose ${another}.`)}</p>
        </>
      ) : (
        <p className="sizes-ask">
          {odd
            ? noSurface
            : a
              ? L(`${a.name}. Ahora, ${another}.`, `${a.name}. Now, ${another}.`)
              : L(`Elige ${fem ? 'una' : 'un'} ${noun} en el mapa o en la lista.`, `Choose a ${noun} on the map or in the list.`)}
        </p>
      )}
      {a && (
        <button type="button" className="btn btn-sm btn-ghost" onClick={onClear}>
          {L('Borrar', 'Clear')}
        </button>
      )}
    </div>
  );
}
