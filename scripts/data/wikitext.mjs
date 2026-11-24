// Reads what a box of facts of a Wikipedia says (the template a page opens with: «Infobox country», «Ficha de
// bandera»), as far as the sheets of the countries need it (scripts/data/profiles-said.mjs): which of its
// fields says what, and what a field says once the marks it is written with are taken away.
//
// It is not a reader of everything a wiki can write. Whatever it does not understand it leaves in the text,
// marked as it was, and `tidy` tells whether a text came out clean: what did not is not shown to anybody.

/** Where the template, the link or the tag that opens at `from` ends: the place after its closing mark; -1 when it is never closed. */
function closing(text, from, open, close) {
  let depth = 0;
  for (let i = from; i < text.length; i++) {
    if (text.startsWith(open, i)) {
      depth++;
      i += open.length - 1;
    } else if (text.startsWith(close, i)) {
      depth--;
      i += close.length - 1;
      if (!depth) return i + 1;
    }
  }
  return -1;
}

/** The pieces of what is between the marks of a template or of a link, cut at the bars that are its own. */
function pieces(inside) {
  const out = [];
  let curly = 0;
  let square = 0;
  let last = 0;
  for (let i = 0; i < inside.length; i++) {
    const two = inside.slice(i, i + 2);
    if (two === '{{') (curly++, i++);
    else if (two === '}}') (curly--, i++);
    else if (two === '[[') (square++, i++);
    else if (two === ']]') ((square = Math.max(0, square - 1)), i++);
    else if (inside[i] === '|' && !curly && !square) {
      out.push(inside.slice(last, i));
      last = i + 1;
    }
  }
  out.push(inside.slice(last));
  return out;
}

/** What is said between tags that say nothing to a reader: a comment, a note with where something was read. */
function unnoted(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<ref\b[^>]*\/>/gi, '')
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref\s*>/gi, '')
    .replace(/<ref\b[^>]*>[\s\S]*$/i, '')
    .replace(/<(nowiki|templatestyles)\b[^>]*\/>/gi, '');
}

/** The name of a template as it is compared: `Start date and age` and `start_date and age` are the same. */
const named = (name) => name.replace(/_/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * The fields of a box: what each is called (in small letters) and what it says, as it is written. A field
 * that is given twice says what the last one says, as a wiki reads it.
 */
export function boxFields(box) {
  const fields = new Map();
  const text = unnoted(box);
  if (!text.startsWith('{{')) return { name: '', fields };
  const end = closing(text, 0, '{{', '}}');
  const [name, ...rest] = pieces(text.slice(2, end < 0 ? text.length : end - 2));
  for (const piece of rest) {
    const eq = piece.indexOf('=');
    if (eq < 0) continue;
    const key = named(piece.slice(0, eq));
    // A name of a field is a word or a few: anything else is a bar inside something that was not closed.
    if (!key || key.length > 40 || /[{}[\]<>]/.test(key)) continue;
    fields.set(key, piece.slice(eq + 1).trim());
  }
  return { name: named(name), fields };
}

/** The months as each language of the two writes them, by their first letters. */
const MONTHS = [
  ['jan', 'ene'],
  ['feb'],
  ['mar'],
  ['apr', 'abr'],
  ['may'],
  ['jun'],
  ['jul'],
  ['aug', 'ago'],
  ['sep', 'set'],
  ['oct'],
  ['nov'],
  ['dec', 'dic'],
];
/** The month a word names: 1 to 12, or none. */
export function monthOf(word) {
  const w = String(word).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/^\d{1,2}$/.test(w)) return Number(w) >= 1 && Number(w) <= 12 ? Number(w) : 0;
  if (w.length < 3) return 0;
  const at = MONTHS.findIndex((names) => names.some((name) => w.startsWith(name)));
  return at + 1;
}
const two = (n) => String(n).padStart(2, '0');
/** A day as a sheet writes it, from its three numbers; the year alone when the rest is not a day. */
const dayOf = (y, m, d) => (m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${two(m)}-${two(d)}` : m >= 1 && m <= 12 ? `${y}-${two(m)}` : String(y));

/** Templates that say nothing a reader of a sheet reads: where something was read, a mark, a picture, a sound. */
const SILENT =
  /^(refn|efn|sfn|sfnp|sfnm|harv|harvnb|harvnp|harvsp|r|rp|nota|notetag|#tag:ref|note|ref|cita\b.*|cite\b.*|citation\b.*|cn|citation needed|cita requerida|fact|dubious|clarify|update inline|better source needed|verify source|failed verification|when|as of|ipa\b.*|ipac-\w+|afi|respell|pronunciation|listen|escuchar|flagicon|flag icon|bandera|geodatos\b.*|flagdeco|icon|small ref|in lang|en|es|ref label|ref_label|note label|#invoke:.*|fiav|fiav\/\w+|color box|colorbox|legend inline|cuadro color|coord|efn-lr|efn-ua|efn-la|refend|refbegin|reflist|notelist|spaces|nbsp|clear|-|pad|increase|decrease|steady|sup|ill-wd|audio-ipa|esd|ie|ref de ficha|lower|noitalics|edad|age|años)$/;
/** Templates that say what their first piece says: a text that is not to be broken, made smaller or larger. */
const FIRST = /^(nowrap|nobr|nobold|nobreak|small|smaller|big|large|larger|resize|font|raise|nobots|noitalic|normal|center|centre|align|allow wrap|wbr|avoid wrap|pre|ubl\b|versalita|vn|sc|sc2|smallcaps|esd|abbr|abreviatura|tooltip|hover title|ill|interlanguage link|illm|link-interwiki|enlace roto|linktext|lt|keep together|em|strong|var|angbr|angle bracket|script\/.*|bo-textonly|nq|zhi|ruby|c|tachado|mayúscula|ucfirst:.*|lcfirst:.*|uc:.*|lc:.*)$/;
/** Templates that say a text in a language: its code first, then the text. */
const WORDS = /^(lang|langx|native name|nativename|native phrase|transl|transliteration|lang-rom|rtl-lang|ltr-lang|script|langr|lang-x2|native name list)$/;
/** Templates that say several things one under another. */
const LISTS = /^(unbulleted list|ubl|ublist|unbulleted|plainlist|plain list|flatlist|hlist|vunblist|bulleted list|blist|ubli|lista sin viñetas|lista plana|lista simple|collapsible list|lista desplegable|indented plainlist|startplainlist|endplainlist|unordered list|ordered list|br separated entries|csv|cslist|ubt)$/;

/** What a template says to a reader: its text, or nothing; null when it is not one this knows. */
function spoken(inside, langs) {
  const [head, ...args] = pieces(inside);
  const name = named(head);
  const given = args.filter((a) => !/^\s*[\w -]+\s*=/.test(a) || /^\s*\d+\s*=/.test(a)).map((a) => a.replace(/^\s*\d+\s*=/, ''));
  const key = (wanted) => args.map((a) => /^\s*([\w -]+?)\s*=([\s\S]*)$/.exec(a)).find((m) => m && named(m[1]) === wanted)?.[2];
  if (!name) return '';
  if (SILENT.test(name)) return '';
  if (/^lang-[a-z-]+$/.test(name) || /^idioma-[a-z-]+$/.test(name)) {
    langs?.push(name.slice(name.indexOf('-') + 1));
    return given[0] ?? '';
  }
  if (WORDS.test(name)) {
    if (given.length < 2) return given[0] ?? '';
    langs?.push(given[0].trim().toLowerCase());
    // A native name may come with what it is called in other letters: only the name is what is said.
    return given[1];
  }
  if (LISTS.test(name)) return given.map((g) => g.replace(/^\s*[*#]+\s*/gm, '')).join('\n');
  if (FIRST.test(name)) {
    // «resize|80%|text», «raise|0.2em|text», «font|size=…|text»: the text is the last thing said.
    if (/^(resize|raise|font|align|abbr|abreviatura|tooltip|hover title)$/.test(name)) return /^(abbr|abreviatura|tooltip|hover title)$/.test(name) ? (given[0] ?? '') : (given[given.length - 1] ?? key('text') ?? '');
    return given[0] ?? '';
  }
  // A day: «start date|1889|11|19», «start date and age|df=yes|1889|11|19», «fecha|19|11|1889», «dts|…».
  if (/^(start date|start date and age|start-date|birth date|date|dts|end date|fecha|fecha de inicio|fecha de lanzamiento|fecha y edad|tiempo desde|date and age)$/.test(name)) {
    const parts = given.map((g) => g.trim()).filter(Boolean);
    if (parts.length === 1) return parts[0];
    const year = parts.findIndex((p) => /^\d{3,4}$/.test(p));
    if (year < 0) return parts.join(' ');
    const rest = parts.filter((_, i) => i !== year);
    // Year first: month, day follow. Year last: day, month came before it.
    const [m, d] = year === 0 ? [monthOf(rest[0] ?? ''), Number(rest[1] ?? 0)] : [monthOf(rest[1] ?? ''), Number(rest[0] ?? 0)];
    return dayOf(Number(parts[year]), m, d);
  }
  if (/^(leyenda|legend|leyenda de color|color sample|swatch)$/.test(name)) return given[1] ?? '';
  if (/^(audio|pronunciación)$/.test(name)) return given[1] ?? '';
  if (/^(frac|fracción|sfrac)$/.test(name)) return given.length >= 2 ? given.slice(-2).join('/') : (given[0] ?? '');
  if (/^(ratio)$/.test(name)) return given.join(':');
  if (/^(nbsp|spaces|esp|snd|spnd|·|•|dot|bull|middot)$/.test(name)) return ' ';
  if (/^(salto|break|br|clear left)$/.test(name)) return '\n';
  if (/^(ndash|–|spaced ndash)$/.test(name)) return ' – ';
  if (/^(mdash|—)$/.test(name)) return ' — ';
  if (/^(sic|shy|zwj|zwnj)$/.test(name)) return '';
  if (/^(circa|c\.)$/.test(name)) return `c. ${given[0] ?? ''}`;
  return null;
}

/**
 * What a text of a wiki says once its marks are taken away: its links by what they show, its templates by
 * what they say, no notes, no tags. `langs`, when given, receives the code of every language a text was
 * said to be in. A break of line is kept as one.
 */
export function plain(wikitext, langs) {
  let text = unnoted(String(wikitext ?? ''));
  // Templates and links, the innermost first: each gives way to what it says.
  for (let guard = 0; guard < 400; guard++) {
    const at = text.lastIndexOf('{{');
    if (at < 0) break;
    const end = closing(text, at, '{{', '}}');
    if (end < 0) {
      // Never closed: marked so that nobody takes what follows for clean.
      text = `${text.slice(0, at)}\u0000${text.slice(at + 2)}`;
      continue;
    }
    const said = spoken(text.slice(at + 2, end - 2), langs);
    text = `${text.slice(0, at)}${said === null ? `\u0001${text.slice(at + 2, end - 2).replace(/\|/g, '\u0002')}\u0003` : said}${text.slice(end)}`;
  }
  text = text
    // A picture or a sound, with all it is told to look like.
    .replace(/\[\[\s*(?:file|image|archivo|imagen|media)\s*:[^[\]]*(?:\[\[[^[\]]*\]\][^[\]]*)*\]\]/gi, '')
    .replace(/\[\[(?:[^[\]|]*\|)?([^[\]|]*)\]\]/g, '$1')
    .replace(/\[(?:https?:)?\/\/[^\s\]]+\s*([^\]]*)\]/g, '$1')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/?(?:p|div|li|ul|ol)\b[^>]*>/gi, '\n')
    .replace(/<sup\b[^>]*>[\s\S]*?<\/sup\s*>/gi, '')
    .replace(/<\/?[a-z][^<>]*>/gi, '')
    .replace(/'{2,5}/g, '')
    .replace(/&nbsp;|&#160;|&thinsp;|&#8201;|&ensp;|&emsp;/gi, ' ')
    .replace(/&ndash;|&#8211;/gi, '–')
    .replace(/&mdash;|&#8212;/gi, '—')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    // The marks that join or part two letters are letters of the word in the scripts that use them.
    .replace(/&zwnj;/gi, '\u200c')
    .replace(/&zwj;/gi, '\u200d')
    .replace(/&shy;|&lrm;|&rlm;|[\u200b\u200e\u200f\u00ad\u2060\ufeff]/gi, '')
    .replace(/__[A-Z]+__/g, '');
  return text
    .split('\n')
    .map((line) => line.replace(/^[*#:;]+\s*/, '').replace(/[ \t\u00a0\u2009\u202f]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

/** Whether a text came out of `plain` with nothing left of how it was written: no mark of a template, a link, a tag or a field. */
export const tidy = (text) => !/[\u0000-\u0003{}[\]<>|]|=|&\w+;|https?:/.test(text);

/** Templates that say how something is called in a language: the code of the language, then the name. */
const CALLED = /^(lang|langx|native name|nativename|native phrase|lang-rom|rtl-lang|script)$/;

/**
 * What a text says something is called in each language, in the order it says it: [code, name]. It reads
 * the templates made for that — «native name|de|Republik Österreich», «lang|fr|…», and the list «name in
 * various languages» — wherever they are, also inside a list or a box.
 */
export function calledIn(wikitext) {
  const out = [];
  const walk = (text) => {
    for (let at = text.indexOf('{{'); at >= 0; at = text.indexOf('{{', at)) {
      const end = closing(text, at, '{{', '}}');
      if (end < 0) return;
      const [head, ...args] = pieces(text.slice(at + 2, end - 2));
      const name = named(head);
      const keyed = args.map((a) => /^\s*([\w -]+?)\s*=([\s\S]*)$/.exec(a));
      const given = args.filter((_, i) => !keyed[i] || /^\d+$/.test(keyed[i][1])).map((a) => a.replace(/^\s*\d+\s*=/, ''));
      if (CALLED.test(name) && given.length >= 2) out.push([given[0].trim().toLowerCase(), plain(given[1]).split('\n')[0] ?? '']);
      else if (/^lang-[a-z]{2,3}$/.test(name) && given.length) out.push([name.slice(5), plain(given[0]).split('\n')[0] ?? '']);
      else if (name === 'name in various languages') {
        for (const m of keyed) if (m && /^[a-z]{2,3}$/.test(m[1].trim())) out.push([m[1].trim(), plain(m[2]).split('\n')[0] ?? '']);
      } else for (const arg of args) walk(arg);
      at = end;
    }
  };
  walk(unnoted(String(wikitext ?? '')));
  return out.filter(([code, text]) => /^[a-z]{2,3}(-[a-z0-9-]+)?$/.test(code) && text);
}

/**
 * The days and the years a text names, each with where it names it, in the order it does: `1889-11-19`, or
 * `1889` where it gives the year alone. It reads them as English and Spanish write them («19 November 1889», «November 19, 1889»,
 * «19 de noviembre de 1889») and as `plain` leaves those a template gave.
 */
export function daysAt(text) {
  const found = [];
  const taken = [];
  const free = (at, len) => !taken.some(([a, b]) => at < b && at + len > a);
  const take = (re, read) => {
    for (const m of text.matchAll(re)) {
      if (!free(m.index, m[0].length)) continue;
      const day = read(m);
      if (!day) continue;
      found.push([m.index, day]);
      taken.push([m.index, m.index + m[0].length]);
    }
  };
  const year = (y) => Number(y) >= 1000 && Number(y) <= 2100;
  take(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (m) => (year(m[1]) ? `${m[1]}-${m[2]}-${m[3]}` : null));
  take(/\b(\d{1,2})(?:st|nd|rd|th|º|\.º|°)?\s+(?:de\s+)?(\p{L}{3,12})\.?,?\s+(?:de\s+|del\s+)?(\d{4})\b/gu, (m) => (monthOf(m[2]) && year(m[3]) && Number(m[1]) >= 1 && Number(m[1]) <= 31 ? dayOf(Number(m[3]), monthOf(m[2]), Number(m[1])) : null));
  take(/\b(\p{L}{3,12})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/gu, (m) => (monthOf(m[1]) && year(m[3]) && Number(m[2]) >= 1 && Number(m[2]) <= 31 ? dayOf(Number(m[3]), monthOf(m[1]), Number(m[2])) : null));
  take(/\b(\d{4})\b/g, (m) => (year(m[1]) ? m[1] : null));
  return found.sort((a, b) => a[0] - b[0]);
}

/** The days and the years a text names, in the order it names them (see `daysAt`, which tells where each is too). */
export const daysIn = (text) => daysAt(text).map(([, day]) => day);
