// How Wikipedia begins to tell of a country or of its flag, made short enough to be read in a sheet
// (scripts/data/profiles.mjs): the opening of its page, as the workflow "Traer datos" brought it in plain
// text (scripts/data/outside.mjs, source `texts`), cut after as many whole sentences as fit.
//
// The words are Wikipedia's, under CC BY-SA 4.0, and are left as they are. What is taken away:
//
//   · what follows the sentences that are kept: the text is shortened, never rewritten;
//   · the marks that turning a page into plain text leaves behind: the place of a note («[1]»), a bracket
//     left empty by what was in it («Nauru ()»), a space before a comma, none after a full stop;
//   · the brackets that say how a name is written or said in another language («(en árabe: قطر, romanizado:
//     Qaṭar; AFI: [ˈqɑtˁɑr])»), which the sheet tells in its own place or does not tell, and which make the
//     first sentence of many pages hard to read.
//
// Whoever shows the text says it is Wikipedia's, shortened, and leads to the page.

/** A space with no width between two words: what is left where a note stood between them with no space of its own. */
const GLUED = /([\p{L}\p{N})»”])\u200b+(?=[\p{L}\p{N}(«“])/gu;
/** What is never part of a text to read: marks that say which way a script runs, and spaces with no width. */
const UNSEEN = /[\u200b-\u200f\u202a-\u202e\u2060\ufeff\u00ad]/g;
/** Spaces of other widths, which plain text has no use for. */
const SPACES = /[\u00a0\u2000-\u200a\u202f\u205f\u3000\t]/g;
/** The place of a note, or what an editor asks of the others: «[1]», «[a]», «[nota 2]», «[n. 3]», «[cita requerida]», «[citation needed]». */
const NOTE = /\s*\[(?:\d{1,3}|[a-z]|(?:nota|note|n\.?|N)\s?\d{1,3}|[^\]\d]{0,30}(?:requerida|needed|\?))\]/gi;

/**
 * A letter of a script that is not the Latin one, or a mark of how something is said (ˈ, ː). The turned comma
 * and the apostrophe of the names of Polynesia («Nuʻutele») are letters of theirs, written in Latin script.
 */
const OTHER_SCRIPT = /[^\P{L}\p{Script=Latin}\u02bb\u02bc]/u;
/** How something is said, between brackets or bars: «[ˈqɑtˁɑr]», «/buˈɾundi/». */
const SOUNDS = /\[[^\]]*\]|\/[^/\s][^/]*\//;
/** A word that tells how a name is said or written: in any sentence, whatever it is of. */
const SAID_SO = /\b(?:pronunciad[oa]|pronunciaci[oó]n|AFI|IPA|romanizad[oa]|romanized|romanised|transliterad[oa]|pronounced|pronunciation|listen)\b/i;
/**
 * A name in another language, as the first sentence of a page gives it: «en árabe: …», «en inglés, …»,
 * «en inglés Anguilla», «del náhuatl: …», «Spanish: …». What follows «en» is the name of a language, not
 * of a place or a manner («en el centro», «en disputa entre…»).
 */
const IN_A_LANGUAGE = {
  es: /^(?:(?:en|del) (?!(?:el|la|los|las|un|una|unos|unas|algun[oa]s?|su|sus|parte|disputa|total|general|donde|adjetivo|este|esta|ese|esa|cuanto|caso|torno|medio|honor)\b)\p{Ll}+(?: [yo] \p{Ll}+| \p{Ll}+)?(?:[:,]|$| [\p{Lu}[/«"'‘“])|\p{Ll}+: )/u,
  en: /^\p{Lu}[\p{L}'’ -]{2,40}:(?: |$)/u,
};
/** A name spelt out by its sounds, as the English Wikipedia does: «jih-BRAWL-tər», «KAY-mən». */
const RESPELT = /(?:^|[\s,;])(?:[a-zəɪ]+-)*[A-Z]{2,}(?:-[a-zA-Zəɪ⁠]+)+|(?:^|[\s,;])(?:[a-zəɪ]+-)+[A-Z]{2,}(?=$|[\s,;])/u;

/** Where each bracket that is not inside another begins and ends: `[from, to)`, the two marks included. */
function brackets(text) {
  const found = [];
  let depth = 0;
  let from = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') {
      if (!depth) from = i;
      depth++;
    } else if (text[i] === ')' && depth) {
      depth--;
      if (!depth) found.push([from, i + 1]);
    }
  }
  return found;
}

/**
 * Whether what a bracket holds only tells how a name is written or said elsewhere. `first` is whether it is
 * in the first sentence, where a name in another language is such a thing, and so is the little that is
 * left of a bracket whose beginning was how the name sounds («Mann ( man)», «(, US: ; US: )»).
 */
function gloss(inside, lang, first) {
  const said = inside.replace(/^[\s;,:]+|[\s;,:]+$/g, '');
  if (!said) return true;
  if (OTHER_SCRIPT.test(said) || SOUNDS.test(said) || SAID_SO.test(said)) return true;
  if (!first) return false;
  if (IN_A_LANGUAGE[lang].test(said) || RESPELT.test(said)) return true;
  return /^[\s;,:]/.test(inside) && !/\d/.test(said) && said.length <= 40;
}

/**
 * A sentence with the brackets that are glosses taken out, and those that stay made tidy inside: of one
 * that tells several things between semicolons («EE. UU.; en inglés: United States»), those that are not.
 */
function unglossed(sentence, lang, first) {
  let out = '';
  let at = 0;
  for (const [from, to] of brackets(sentence)) {
    const inside = sentence.slice(from + 1, to - 1);
    out += sentence.slice(at, from);
    const parts = gloss(inside, lang, first) ? [] : inside.split(';').filter((part, i, all) => all.length === 1 || !gloss(part.trimStart(), lang, first));
    const kept = unglossed(parts.join(';'), lang, false).replace(/^[\s;,:]+|[\s;,:]+$/g, '');
    if (kept) out += `(${kept})`;
    // What was before a bracket that is gone is not left hanging from a space before a mark.
    else if (/^[,;:.!?—―–)]/.test(sentence.slice(to))) out = out.trimEnd();
    at = to;
  }
  return out + sentence.slice(at);
}

/** The spaces of a text put right: one between words, none before a mark that closes, one after a full stop that had none; and the raised figure of a unit, raised again. */
export function spaced(text) {
  return text
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/ +([,;:.!?])/g, '$1')
    .replace(/,(?:\s*,)+/g, ',')
    .replace(/([,;])(\p{L})/gu, '$1 $2')
    .replace(/([\p{Ll}\p{N}²³%)»”][.!?])(\p{Lu}\p{Ll})/gu, '$1 $2')
    .replace(/(\d)(\p{Ll}{5,})/gu, '$1 $2')
    // A figure that stood raised after a unit comes down as plain text: «km2» is «km²».
    .replace(/((?:\d[ \u00a0]?(?:m|cm|ft)|(?<![\p{L}\p{N}])(?:km|mi)))([23])(?![\p{L}\p{N}])/gu, (_, unit, n) => `${unit}${n === '2' ? '²' : '³'}`)
    .replace(/([^.])\.\.(?!\.)/g, '$1.')
    .trim();
}

/** What comes before a full stop that does not end a sentence. */
const SHORT = {
  es: /(?:^|[\s(«"“])(?:a|d|c|ca|cf|p|pp|ej|etc|aprox|art|n|núm|pág|págs|s|ss|v|vs|vol|ed|lit|tr|trad|Sr|Sra|Sres|Dr|Dra|D|Dña|St|Sto|Sta|Gral|Tte|Cía|EE|UU|RR|HH|S|A|m|h|hab|km|kg|No|Mt|Ft|Jr|Av|Excmo|Ilmo|Mons|Prof)$/u,
  en: /(?:^|[\s(«"“])(?:c|ca|cf|e|g|i|p|pp|vs|v|vol|ed|est|approx|lit|No|Nos|Mr|Mrs|Ms|Dr|St|Ste|Mt|Ft|Jr|Sr|Gen|Gov|Col|Capt|Lt|Sgt|Rev|Hon|Prof|Pres|Inc|Ltd|Co|Corp|U|S|K|D|C|a|m|sq|mi|ft|km|kg|lb|oz|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)$/u,
};

/**
 * The sentences of a paragraph, each whole. One ends at a full stop, a question or an exclamation mark that
 * is followed by a space and by how another begins (a capital, a figure, an opening mark), unless what
 * comes before the stop is a short form («a. C.», «St.», an initial) or the stop is inside brackets or
 * quotation marks.
 */
export function sentencesOf(paragraph, lang) {
  const out = [];
  let from = 0;
  let round = 0;
  let quoted = 0;
  for (let i = 0; i < paragraph.length; i++) {
    const ch = paragraph[i];
    if (ch === '(') round++;
    else if (ch === ')') round = Math.max(0, round - 1);
    else if (ch === '«' || ch === '“') quoted++;
    else if (ch === '»' || ch === '”') quoted = Math.max(0, quoted - 1);
    if (round || quoted || !'.!?…'.includes(ch)) continue;
    // What closes with the sentence goes with it.
    let end = i + 1;
    while (end < paragraph.length && '»”"\')]'.includes(paragraph[end])) end++;
    if (end < paragraph.length && !/^\s+[\p{Lu}\p{N}«“"¿¡(]/u.test(paragraph.slice(end))) continue;
    const before = paragraph.slice(from, i);
    if (ch === '.' && (SHORT[lang].test(before) || /(?:^|[\s(.])\p{Lu}$/u.test(before))) continue;
    out.push(paragraph.slice(from, end).trim());
    from = end;
    i = end - 1;
  }
  const rest = paragraph.slice(from).trim();
  if (rest) out.push(rest);
  return out;
}

/** How many paragraphs are kept at most: a page of many short ones is not shown as a list of lines. */
const PARAGRAPHS = 3;
/** The shortest line that is taken for a sentence when it ends with no mark: a shorter one is the name of a thing in a list, or a heading. */
const A_SENTENCE = 60;

/**
 * The paragraphs of a text, each on its line. A line that is broken in the middle of a sentence (the next
 * one goes on in small letters, or a bracket was left open) is put together again; one that ends with no
 * mark at all, where a paragraph ends, is given its full stop when it is long enough to be a sentence.
 */
export function paragraphsOf(text) {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const out = [];
  for (const line of lines) {
    const before = out[out.length - 1];
    const open = before !== undefined && before.split('(').length > before.split(')').length;
    if (before !== undefined && !/[.!?…:][»”"')\]]*$/.test(before) && (open || /^[\p{Ll}(]/u.test(line))) out[out.length - 1] = `${before} ${line}`;
    else out.push(line);
  }
  return out.map((p) => (p.length >= A_SENTENCE && /[\p{L}\p{N})»”]$/u.test(p) ? `${p}.` : p));
}

/** Whether a sentence can be the last that is shown, or be shown at all: whole, closed, and not one that only leads to what is no longer there. */
function sound(sentence) {
  if (!/[.!?…][»”"')\]]*$/.test(sentence)) return false;
  const count = (mark) => sentence.split(mark).length - 1;
  if (count('(') !== count(')') || count('«') !== count('»') || count('“') !== count('”') || count('"') % 2) return false;
  // Something was here that plain text did not keep: a formula, a quotation, a list.
  if (/\(\s*\)|:\s*$|\b(?:siguiente|following):?[.]?$/i.test(sentence)) return false;
  return sentence.length >= 12;
}

/**
 * The opening of a page made short: its first sentences, whole and in their paragraphs, as many as fit in
 * `max` characters. The first is kept whatever its length up to `most`; a page whose first sentence is
 * longer than that, or is not a sentence, gives nothing. `keep` says how many sentences to keep instead,
 * for whoever has read the text and knows better where it should end.
 */
export function leadOf(text, { lang, max, most = Math.round(max * 1.6), keep } = {}) {
  if (typeof text !== 'string') return null;
  const paragraphs = paragraphsOf(text.replace(GLUED, '$1 ').replace(UNSEEN, '').replace(SPACES, ' ').replace(NOTE, ''));
  const out = [];
  let length = 0;
  let kept = 0;
  let first = true;
  for (const paragraph of paragraphs) {
    // Another paragraph is begun only while little has been said, and never a fourth.
    if (out.length && keep === undefined && (length > max / 2 || out.length >= PARAGRAPHS)) break;
    const mine = [];
    let stop = false;
    for (const raw of sentencesOf(paragraph, lang)) {
      const sentence = spaced(unglossed(raw, lang, first));
      if (!sound(sentence)) {
        stop = true;
        break;
      }
      const fits = keep !== undefined ? kept < keep : first ? sentence.length <= most : length + sentence.length + 1 <= max;
      if (!fits) {
        stop = true;
        break;
      }
      mine.push(sentence);
      length += sentence.length + 1;
      kept++;
      first = false;
    }
    if (mine.length) out.push(mine.join(' '));
    if (stop || (keep !== undefined && kept >= keep)) break;
  }
  return out.length ? out : null;
}
