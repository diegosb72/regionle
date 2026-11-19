/**
 * The diploma of a game: a sheet of paper, lying, that says who completed which map, in which game, how it
 * went and when, with room for a signature. It is made to be printed, or saved as a PDF from the print box.
 * The name is typed when the diploma is made and is kept nowhere: it is not the name that travels in the
 * links of a challenge.
 */
import { Printer } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { Dialog } from '../components/Dialog';
import { QrPicture } from '../components/QrPicture';
import { BASE } from '../components/ui';
import { L, fmtDay } from '../lib/i18n';
import { qrOf } from '../lib/qr';
import { siteRoot } from '../lib/routes';
import { artOf, drawable, siteLabel } from '../lib/shareCard';
import { useStore, type GameConfig } from '../lib/store';
import { cx, today } from '../lib/text';
import type { Deck } from '../lib/types';
import { DIPLOMA_NAME_MAX, diplomaName, diplomaOf, tightness } from './diploma';
import './diploma.css';
import type { Tally } from './resultCard';

/** The paper it is laid out for, in millimetres: what a lying sheet leaves inside its margins, A4 or Letter. */
export const DIPLOMA_PAGE = { w: 250, h: 178, margin: 12 };

/** The name typed for the last diploma, while the game stays open: whoever prints three does not type it three times. */
let typed: string | null = null;

/** The edge of the seal: a circle with scallops. */
const SEAL = (() => {
  const lobes = 24;
  const at = (r: number, turn: number) => `${(50 + r * Math.cos(turn * 2 * Math.PI)).toFixed(2)} ${(50 + r * Math.sin(turn * 2 * Math.PI)).toFixed(2)}`;
  let d = `M${at(44, 0)}`;
  for (let i = 0; i < lobes; i++) d += `Q${at(53, (i + 0.5) / lobes)} ${at(44, (i + 1) / lobes)}`;
  return `${d}Z`;
})();

export function DiplomaDialog({ game, deck, count, ms, onClose }: { game: GameConfig; deck?: Deck; count: Tally; ms?: number; onClose(): void }) {
  const nick = useStore((s) => s.nick);
  const [name, setName] = useState(() => typed ?? nick);
  const clip = useId();
  const text = diplomaOf(game, deck?.title, count, ms, fmtDay(today(), true), siteLabel());
  const shown = diplomaName(name);
  // The map behind the words, when it is one of surfaces: dots or lines alone say little.
  const art = useMemo(() => (deck && drawable(deck) ? artOf(deck) : null), [deck]);
  const slack = art ? Math.max(art.box[2] - art.box[0], art.box[3] - art.box[1]) * 0.03 : 0;
  const only = deck?.countries.length === 1 ? deck.countries[0] : null;
  const qr = useMemo(() => {
    try {
      return qrOf(siteRoot());
    } catch {
      return null;
    }
  }, []);

  // The name the browser offers for the PDF.
  useEffect(() => {
    const before = document.title;
    document.title = `${text.heading} — ${text.where}`;
    return () => {
      document.title = before;
    };
  }, [text.heading, text.where]);

  return (
    <Dialog title={text.heading} className="dip-dialog" printing="dlg-print" onClose={onClose}>
      {/* The paper lies on its side while the diploma is open. */}
      <style>{`@page { size: landscape; margin: ${DIPLOMA_PAGE.margin}mm; }`}</style>
      <div className="dip-form dlg-screen">
        <label>
          <span>{L('Nombre en el diploma', 'Name on the diploma')}</span>
          <input
            type="text"
            value={name}
            maxLength={DIPLOMA_NAME_MAX}
            placeholder={L('Sin nombre queda una línea para escribirlo', 'With no name, a line is left to write it on')}
            autoComplete="name"
            onChange={(e) => {
              typed = e.target.value;
              setName(e.target.value);
            }}
          />
        </label>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          <Printer size={16} aria-hidden="true" />
          {L('Imprimir', 'Print')}
        </button>
        <p className="opt-hint">
          {L(
            'En el cuadro de impresión puedes guardarlo como PDF. Si sale de pie, elige allí la hoja en horizontal. El nombre solo se usa en esta hoja: no se guarda.',
            'In the print box you can save it as a PDF. If it comes out upright, choose the landscape sheet there. The name is only used on this sheet: it is not kept.',
          )}
        </p>
      </div>
      <div className="dip-fit">
        <article className="dip" aria-label={L('Vista del diploma', 'Preview of the diploma')}>
          <div className="dip-frame">
            <div className="dip-in">
              {art && (
                <svg className="dip-map" viewBox={`${art.box[0]} ${art.box[1]} ${art.box[2] - art.box[0]} ${art.box[3] - art.box[1]}`} aria-hidden="true">
                  {/*
                    Only what the first view of the map shows, and a little around it, since that view is
                    worked out from a few points of each piece: what lies far off would be loose marks on the sheet.
                  */}
                  <clipPath id={clip}>
                    <rect x={art.box[0] - slack} y={art.box[1] - slack} width={art.box[2] - art.box[0] + slack * 2} height={art.box[3] - art.box[1] + slack * 2} />
                  </clipPath>
                  <g clipPath={`url(#${clip})`}>
                    {art.paths.map((d, i) => (
                      <path key={i} d={d} />
                    ))}
                  </g>
                </svg>
              )}
              <header className="dip-top">
                <p className="dip-brand">
                  <b>Regionle ∞</b>
                  <span>{text.site}</span>
                </p>
                <h3 className="dip-title">{text.heading}</h3>
                {qr ? <QrPicture qr={qr} className="dip-qr" label={L(`Código QR que abre ${text.site}`, `QR code that opens ${text.site}`)} /> : <span />}
              </header>
              <p className="dip-lead">{text.lead}</p>
              <p className={cx('dip-name', !shown && 'blank', `tight-${tightness(shown, 26)}`)}>{shown || '\u00a0'}</p>
              <p className="dip-lead">{text.did}</p>
              <p className={cx('dip-where', `tight-${tightness(text.where, 40)}`)}>
                {only?.fl && <img src={`${BASE}flags/${only.fl}.svg`} alt="" />}
                <span>{text.where}</span>
              </p>
              <p className="dip-what">{text.what}</p>
              <p className="dip-result">{text.result.join(' · ')}</p>
              <footer className="dip-foot">
                <p className="dip-field">
                  <b>{text.day}</b>
                  <span>{text.dated}</span>
                </p>
                <svg className="dip-seal" viewBox="0 0 100 100" role="img" aria-label={text.score}>
                  <path d={SEAL} />
                  <circle cx="50" cy="50" r="36.5" />
                  <text x="50" y="51" textAnchor="middle" dominantBaseline="central" fontSize={text.score.length > 4 ? 19 : 23}>
                    {text.score}
                  </text>
                </svg>
                <p className="dip-field">
                  <b>{'\u00a0'}</b>
                  <span>{text.sign}</span>
                </p>
              </footer>
            </div>
          </div>
        </article>
      </div>
    </Dialog>
  );
}
