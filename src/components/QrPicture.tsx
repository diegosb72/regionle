/** A QR code drawn, and as a picture to save. Apart from its panel: a diploma carries one too. */
import { useMemo } from 'react';
import { QR_QUIET, qrPath, type Qr } from '../lib/qr';

/** The side of the picture that is saved, in pixels, at most: each module takes a whole number of them. */
const PICTURE = 1200;

/** The code as a PNG file: black on white, with its margin. */
export function qrBlob(qr: Qr, side: number = PICTURE): Promise<Blob> {
  const units = qr.size + QR_QUIET * 2;
  const scale = Math.max(1, Math.floor(side / units));
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = units * scale;
  const pen = canvas.getContext('2d');
  if (!pen) return Promise.reject(new Error('canvas'));
  pen.fillStyle = '#fff';
  pen.fillRect(0, 0, canvas.width, canvas.height);
  pen.fillStyle = '#000';
  for (let y = 0; y < qr.size; y++) for (let x = 0; x < qr.size; x++) if (qr.modules[y * qr.size + x]) pen.fillRect((x + QR_QUIET) * scale, (y + QR_QUIET) * scale, scale, scale);
  return new Promise<Blob>((done, fail) => canvas.toBlob((blob) => (blob ? done(blob) : fail(new Error('canvas'))), 'image/png'));
}

/** The code drawn: always black on white, whatever the theme, which is what a camera reads best. */
export function QrPicture({ qr, label, className = 'qr-code' }: { qr: Qr; label: string; className?: string }) {
  const units = qr.size + QR_QUIET * 2;
  const d = useMemo(() => qrPath(qr), [qr]);
  return (
    <svg className={className} viewBox={`0 0 ${units} ${units}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={units} height={units} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}
