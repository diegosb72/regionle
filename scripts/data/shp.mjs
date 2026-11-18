// Reads an ESRI shapefile and its table without any library: just enough for the layers of the
// Atlas Nacional de España that the physical map of Spain is built from (lines and areas in
// geographic coordinates, text in UTF-8).
//
//   readShapefile('dir/name')  →  [{ properties, geometry }]   as GeoJSON features
//
// Format: https://www.esri.com/content/dam/esrisites/sitecore-archive/Files/Pdfs/library/whitepapers/pdfs/shapefile.pdf

import fs from 'node:fs';

function readTable(file) {
  const buf = fs.readFileSync(file);
  const count = buf.readUInt32LE(4);
  const headerSize = buf.readUInt16LE(8);
  const recordSize = buf.readUInt16LE(10);
  const fields = [];
  for (let at = 32; buf[at] !== 0x0d; at += 32) {
    const nul = buf.indexOf(0, at);
    fields.push({ name: buf.toString('latin1', at, Math.min(nul, at + 11)), type: String.fromCharCode(buf[at + 11]), size: buf[at + 16] });
  }
  const rows = [];
  for (let i = 0; i < count; i++) {
    let at = headerSize + i * recordSize + 1;
    const row = {};
    for (const f of fields) {
      const text = buf.toString('utf8', at, at + f.size).replace(/\0+$/, '').trim();
      at += f.size;
      row[f.name] = text === '' ? null : f.type === 'N' || f.type === 'F' ? Number(text) : text;
    }
    rows.push(row);
  }
  return rows;
}

/** A ring runs clockwise when it is the outside of an area, and the other way round when it is a hole. */
const clockwise = (ring) => {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) sum += (ring[i + 1][0] - ring[i][0]) * (ring[i + 1][1] + ring[i][1]);
  return sum > 0;
};
const inRing = (p, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

function readShapes(file) {
  const buf = fs.readFileSync(file);
  if (buf.readInt32BE(0) !== 9994) throw new Error(`${file} is not a shapefile`);
  const shapes = [];
  for (let at = 100; at < buf.length; ) {
    const length = buf.readInt32BE(at + 4) * 2;
    const start = at + 8;
    const type = buf.readInt32LE(start);
    at = start + length;
    if (type === 0) {
      shapes.push(null);
      continue;
    }
    // Lines (3) and areas (5), with or without heights and measures: the points come first in all of them.
    if (![3, 5, 13, 15, 23, 25].includes(type)) throw new Error(`${file}: shapes of type ${type} are not read`);
    const numParts = buf.readInt32LE(start + 36);
    const numPoints = buf.readInt32LE(start + 40);
    const starts = [];
    for (let i = 0; i < numParts; i++) starts.push(buf.readInt32LE(start + 44 + 4 * i));
    const first = start + 44 + 4 * numParts;
    const parts = starts.map((from, i) => {
      const to = i + 1 < numParts ? starts[i + 1] : numPoints;
      const pts = [];
      for (let k = from; k < to; k++) pts.push([buf.readDoubleLE(first + 16 * k), buf.readDoubleLE(first + 16 * k + 8)]);
      return pts;
    });
    if (type % 10 === 3) {
      shapes.push(parts.length === 1 ? { type: 'LineString', coordinates: parts[0] } : { type: 'MultiLineString', coordinates: parts });
      continue;
    }
    const polys = parts.filter(clockwise).map((ring) => [ring]);
    for (const hole of parts.filter((ring) => !clockwise(ring))) {
      const home = polys.find((poly) => inRing(hole[0], poly[0])) ?? polys.find((poly) => hole.some((p) => inRing(p, poly[0])));
      if (home) home.push(hole);
      else polys.push([hole.slice().reverse()]);
    }
    shapes.push(polys.length === 1 ? { type: 'Polygon', coordinates: polys[0] } : { type: 'MultiPolygon', coordinates: polys });
  }
  return shapes;
}

export function readShapefile(base) {
  const shapes = readShapes(`${base}.shp`);
  const rows = readTable(`${base}.dbf`);
  if (shapes.length !== rows.length) throw new Error(`${base}: ${shapes.length} shapes and ${rows.length} rows`);
  return shapes.map((geometry, i) => ({ type: 'Feature', properties: rows[i], geometry })).filter((f) => f.geometry);
}
