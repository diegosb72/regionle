// What the name of a file of Wikimedia Commons tells of the flag it holds, where nothing else does: whether
// it is the flag that a country of today flies, and whether it names the thing it is said to be of.
//
// Used by flags.mjs and by flags-lists.mjs, which have to tell the same of the same files.

/** A text with nothing but its letters and its digits, in small letters and without their marks. */
export const plain = (text) =>
  String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** The names of flags of today that are written in a way of their own, or that tell the years or the shape of the same flag. */
const TODAY_BY_HAND = [
  'Flag of the Czech Republic.svg',
  "Flag of the People's Republic of China.svg",
  'Flag of the Republic of China.svg',
  'Flag of Portugal (official).svg',
  'Flag of Georgia official.svg',
  'Flag of Iran (official).svg',
  'Flag of Belgium (civil).svg',
  'Flag of Argentina (civil).svg',
  'Flag of the Taliban.svg',
  'Flag of Switzerland (Pantone).svg',
  'Flag of Bosnia and Herzegovina.svg',
  'Flag of Myanmar.svg',
  'Flag of Cape Verde.svg',
  'Flag of East Timor.svg',
  'Flag of Ivory Coast.svg',
  "Flag of Côte d'Ivoire.svg",
  'Flag of the Vatican City.svg',
  'Flag of Macedonia.svg',
  'Flag of Swaziland.svg',
  'Flag of Germany (3-2).svg',
  'Flag of Poland (1928–1980).svg',
  'Flag of Japan (1870–1999).svg',
  'Flag of the United Kingdom (1-2).svg',
  'Flag of the United Kingdom (3-5).svg',
  'Flag of Austria (1230–1934, 1945–2000).svg',
  'Flag of Scotland (1542–2003, sky blue).svg',
];

/**
 * The names that the flag of a country of today goes by in Commons, in small letters: «flag of france.svg»,
 * «flag of the netherlands.svg». The game takes those flags from elsewhere and does not know their names
 * there: these are the ones that the names of the countries give, and those that are written by hand.
 */
export function todayTitles(index) {
  const named = (index.countries ?? []).flatMap((c) => [c.n?.en ?? c.n?.es, ...(c.al ?? [])].filter(Boolean).flatMap((name) => [`Flag of ${name}.svg`, `Flag of the ${name}.svg`]));
  return new Set([...named, ...TODAY_BY_HAND].map((title) => title.toLowerCase()));
}

/** Words that many names share and that tell nothing of whose a flag is. */
const COMMON = new Set(['san', 'los', 'las', 'the', 'del', 'des', 'les', 'sur', 'est', 'new', 'flag', 'flags', 'bandera', 'bandeira', 'bandiera', 'drapeau', 'flagge', 'vlag', 'drapel', 'zastava', 'province', 'provincia', 'region', 'county', 'district', 'state', 'city', 'department', 'departamento', 'municipality', 'governorate', 'judetul', 'north', 'south', 'east', 'west', 'norte', 'oeste', 'saint', 'santa', 'santo', 'republic', 'republica', 'island', 'islands', 'islas', 'nueva', 'nuevo']);

/**
 * Whether the name of a file names what it is said to be the flag of: whether it has one of the words of
 * its names that say something (one of four letters or more, anywhere; one of three, as a word of its own:
 * «Flag of Bar, Montenegro»), or a word that begins as one of them does (five letters: «Argeșului» is Argeș).
 */
export function mentions(title, names) {
  const said = plain(String(title).replace(/\.[a-z]+$/i, ''));
  const words = said.split(' ');
  for (const name of names) {
    for (const word of plain(name).split(' ')) {
      if (word.length < 3 || COMMON.has(word)) continue;
      if (word.length === 3 ? words.includes(word) : said.includes(word)) return true;
      if (word.length >= 5 && words.some((w) => w.slice(0, 5) === word.slice(0, 5))) return true;
    }
  }
  return false;
}
