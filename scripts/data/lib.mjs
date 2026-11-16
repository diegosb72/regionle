// Small pure helpers for the data build: text cleaning and planar geometry.

const FOLD = { ø: 'o', ł: 'l', đ: 'd', ð: 'd', ı: 'i', ə: 'a', þ: 'th', æ: 'ae', œ: 'oe', ħ: 'h', ŋ: 'n', ß: 'ss', ğ: 'g' };

/** Accent- and punctuation-insensitive form used for comparisons. */
export function norm(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[øłđðıəþæœħŋßğ]/g, (c) => FOLD[c])
    .replace(/['’ʻʼ`´]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function slug(s) {
  return norm(s).replace(/ /g, '-');
}

function lev(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

/** Loose "these two labels plausibly name the same place" test. */
export function similar(a, b) {
  a = norm(a);
  b = norm(b);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const ta = a.split(' ').filter((t) => t.length >= 4);
  const tb = b.split(' ').filter((t) => t.length >= 4);
  if (ta.some((t) => tb.some((u) => t.slice(0, 4) === u.slice(0, 4)))) return true;
  return lev(a, b) <= Math.floor(Math.max(a.length, b.length) * 0.34);
}

const cap = (s) => (s ? s[0].toLocaleUpperCase('es') + s.slice(1) : s);

const ES_GENERIC =
  'Municipalidad|Minicipalidad|Municipio metropolitano|Municipio|Parroquia|Voivodato|Zona|Estado|Ciudad|Ayuntamiento|Periferia|Krai|División|Provincia|Departamento|Región|Prefectura autónoma|Prefectura|Condado|Distrito autónomo|Distrito|Gobernación|Óblast|Cantón|Comuna|Raión|República autónoma|Emirato|Consejo';
const ES_PREFIX = new RegExp(`^(?:${ES_GENERIC})\\s+(?:de\\s+la\\s+|de\\s+los\\s+|de\\s+las\\s+|del\\s+|de\\s+|d')`, 'iu');

/** Tidy a Wikidata-style Spanish label into a short map label. */
export function cleanEs(raw) {
  let s = String(raw ?? '').trim();
  if (!s) return '';
  if (/^\p{Ll}/u.test(s)) {
    const m = s.match(/^(?:del|de la|de los|de las|de|los|las|el|la)\s+(\p{Lu}.*)$/u);
    s = m ? m[1] : cap(s);
  }
  const stripped = s.replace(ES_PREFIX, '');
  if (stripped && stripped !== s && stripped.length >= 2) s = cap(stripped);
  return s.replace(/\s+/g, ' ').trim();
}

const EN_SUFFIX = /\s+(?:Prefecture|Voivodeship|Province|Region|County|Oblast|Krai|District|Department|Governorate|Municipality|Canton|Parish|Zone|Quarter|State)$/i;
const EN_PREFIX = /^(?:Province|Department|State|Region|Canton|County|Republic|Emirate|Community|Free Hanseatic|Autonomous Republic|Autonomous Community) of (?:the )?/i;
const EN_BARE = /^(?:Federal|Capital|National|Special|Metropolitan|Autonomous|Free|New|North|South|East|West|Central|Northern|Southern|Eastern|Western|Upper|Lower|Greater)$/i;

/** Tidy an English label ("Aichi Prefecture" → "Aichi"). */
export function cleanEn(raw) {
  let s = String(raw ?? '').trim();
  if (!s) return '';
  const a = s.replace(EN_SUFFIX, '');
  if (a && a !== s && !EN_BARE.test(a)) s = a;
  const b = s.replace(EN_PREFIX, '');
  if (b && b !== s && !EN_BARE.test(b)) s = b;
  return s.replace(/\s+/g, ' ').trim();
}

/** Natural Earth's own name, minus bracketed qualifiers. Returns [name, extras]. */
export function cleanLocal(raw) {
  const s = String(raw ?? '').trim();
  const extras = [];
  const out = s
    .replace(/\s*[[(]([^\])]+)[\])]\s*/g, (_, inner) => {
      extras.push(inner.trim());
      return ' ';
    })
    .replace(/\s+/g, ' ')
    .trim();
  return [out || s, extras];
}

/** Signed planar area (positive = counter-clockwise with y up). */
export function shoelace(ring) {
  let a = 0;
  for (let i = 0, n = ring.length - 1; i < n; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return a / 2;
}

export function pointInRing(pt, ring) {
  let inside = false;
  const [x, y] = pt;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export const round = (v, d) => {
  const k = 10 ** d;
  return Math.round(v * k) / k;
};

export function uniq(arr) {
  return [...new Set(arr)];
}
