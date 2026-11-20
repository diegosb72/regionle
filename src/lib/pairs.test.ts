import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { setLang } from './i18n';
import { LONG_WORD, PAIR_FACES, PAIRS_MIN, SAME_FLAG, canTurn, dealPairs, hidePair, newPairs, pairCount, pairTally, pairable, pairsDone, pairsKey, pickPairs, softened, startPairs, turnCard, unbroken, type PairCard, type PairGame } from './pairs';
import { PAIR_OFS, PAIR_SIZES, PAIR_SIZE_DEFAULT } from './rules';
import { fold, mulberry32 } from './text';
import type { Country, Index } from './types';

const index = JSON.parse(fs.readFileSync(path.join(__dirname, '../../public/data/index.json'), 'utf8')) as Index;
const byId = new Map(index.countries.map((c) => [c.id, c]));
const states = index.countries.filter((c) => c.cl === 'un');
const pickOf = (...ids: string[]): Country[] => ids.map((id) => byId.get(id)!);

beforeEach(() => setLang('es'));

/** A table laid out by hand: the cards of these countries in this order, `X` its first half and `x` the other. */
function table(order: string): PairGame {
  const ids: Record<string, string> = { a: 'ES', b: 'FR', c: 'PT', d: 'IT' };
  const cards: PairCard[] = [...order].map((ch) => ({ country: ids[ch.toLowerCase()], face: ch === ch.toUpperCase() ? 'flag' : 'name' }));
  return startPairs(cards);
}
const turns = (g: PairGame, ...cards: number[]): PairGame => cards.reduce((t, i) => turnCard(t, i), g);

describe('pairs: what is dealt', () => {
  it('deals two cards for each country, one of each face, shuffled', () => {
    for (const of of PAIR_OFS) {
      const chosen = pickPairs(states, of, 8, mulberry32(3));
      expect(chosen).toHaveLength(8);
      const cards = dealPairs(chosen, of, mulberry32(4));
      expect(cards).toHaveLength(16);
      for (const c of chosen) expect(cards.filter((k) => k.country === c.id).map((k) => k.face).sort()).toEqual([...PAIR_FACES[of]].sort());
      // Not in the order of the countries, each next to its other half.
      expect(cards.map((k) => k.country)).not.toEqual(chosen.flatMap((c) => [c.id, c.id]));
    }
  });

  it('deals as many pairs as are asked for, or as there are', () => {
    for (const size of PAIR_SIZES) expect(pairCount(newPairs(states, 'flag', size, mulberry32(size)))).toBe(size);
    expect(PAIR_SIZES).toContain(PAIR_SIZE_DEFAULT);
    const few = newPairs(pickOf('ES', 'FR', 'PT', 'IT'), 'capital', 8, mulberry32(1));
    expect(pairCount(few)).toBe(4);
    expect(PAIRS_MIN).toBeGreaterThanOrEqual(2);
  });

  it('does not deal twice the same countries in the same places', () => {
    const one = newPairs(states, 'flag', 8, mulberry32(11));
    const two = newPairs(states, 'flag', 8, mulberry32(12));
    expect(one.cards).not.toEqual(two.cards);
  });

  it('leaves out what has no flag, or no capital, to show', () => {
    const noFlag = index.countries.filter((c) => !c.fl);
    const noCapital = index.countries.filter((c) => !c.cap);
    expect(noFlag.length + noCapital.length).toBeGreaterThan(0);
    for (const c of pairable(index.countries, 'flag')) expect(c.fl, c.id).toBeTruthy();
    for (const c of pairable(index.countries, 'capital')) expect(c.cap, c.id).toBeTruthy();
    expect(pairable(index.countries, 'flag')).toHaveLength(index.countries.length - noFlag.length);
    expect(pairable(index.countries, 'capital')).toHaveLength(index.countries.length - noCapital.length);
  });

  it('never deals two countries with the same flag, or two flags that cannot be told apart', () => {
    const shown = (c: Country) => SAME_FLAG[c.id] ?? c.id;
    for (let seed = 1; seed <= 300; seed++) {
      const chosen = pickPairs(index.countries, 'flag', 12, mulberry32(seed));
      expect(new Set(chosen.map(shown)).size, `seed ${seed}`).toBe(chosen.length);
    }
    // France and the territories that fly its flag: one card of that flag, whichever it is.
    expect(pickPairs(pickOf('FR', 'RE', 'GP', 'MF', 'YT'), 'flag', 6, mulberry32(1))).toHaveLength(1);
    expect(pickPairs(pickOf('TD', 'RO', 'ES'), 'flag', 6, mulberry32(2))).toHaveLength(2);
    expect(pickPairs(pickOf('ID', 'MC', 'ES', 'PL'), 'flag', 6, mulberry32(2))).toHaveLength(3);
    // Each of them is dealt when the other is not on the list.
    expect(pickPairs(pickOf('RO', 'ES', 'FR'), 'flag', 6, mulberry32(2)).map((c) => c.id).sort()).toEqual(['ES', 'FR', 'RO']);
    expect(pickPairs(pickOf('RE', 'ES', 'MC'), 'flag', 6, mulberry32(2)).map((c) => c.id).sort()).toEqual(['ES', 'MC', 'RE']);
  });

  it('knows which territories are drawn with the flag of their country', () => {
    // Every one on the list is in the data, and a territory on it names the country it belongs to.
    for (const [id, like] of Object.entries(SAME_FLAG)) {
      const c = byId.get(id)!;
      expect(c, id).toBeTruthy();
      expect(byId.get(like), like).toBeTruthy();
      expect(SAME_FLAG[like], `${like} stands for itself`).toBeUndefined();
      if (c.cl === 'dep') expect(c.sov, id).toBe(like);
    }
    // The pictures say the same: a flag drawn exactly like that of another country is on the list. (The ones
    // that are the same flag drawn another way, like the French ones, were found by looking at them.)
    const drawing = (code: string) => fs.readFileSync(path.join(__dirname, '../../node_modules/flag-icons/flags/4x3', `${code}.svg`), 'utf8').replace(/flag-icons-[a-z-]+/g, '');
    const firstWith = new Map<string, string>();
    let same = 0;
    for (const c of index.countries) {
      if (!c.fl) continue;
      const d = drawing(c.fl);
      const before = firstWith.get(d);
      if (!before) firstWith.set(d, c.id);
      else {
        same++;
        expect(SAME_FLAG[c.id] ?? c.id, `${c.id} is drawn like ${before}`).toBe(SAME_FLAG[before] ?? before);
      }
    }
    expect(same).toBeGreaterThan(5);
    expect(SAME_FLAG.HM).toBe('AU');
    expect(SAME_FLAG.SH).toBe('GB');
  });

  it('never deals two capitals of the same name', () => {
    const named = new Map<string, string[]>();
    for (const c of index.countries) if (c.cap) named.set(fold(c.cap.es), [...(named.get(fold(c.cap.es)) ?? []), c.id]);
    const same = [...named.values()].filter((ids) => ids.length > 1);
    for (let seed = 1; seed <= 300; seed++) {
      const chosen = pickPairs(index.countries, 'capital', 12, mulberry32(seed));
      expect(new Set(chosen.map((c) => fold(c.cap!.es))).size, `seed ${seed}`).toBe(chosen.length);
    }
    for (const ids of same) expect(pickPairs(pickOf(...ids), 'capital', 6, mulberry32(1)), ids.join()).toHaveLength(1);
  });

  it('keeps a record for each kind of pair and number of pairs', () => {
    expect(pairsKey('flag', 8)).toBe('pairs:flag:8');
    expect(pairsKey('capital', 12)).not.toBe(pairsKey('flag', 12));
  });
});

describe('pairs: names that are too long for a card', () => {
  const SHY = '\u00ad';
  it('gives the longest words a place to be cut, where a syllable begins', () => {
    expect(softened('República Centroafricana')).toBe(`República Centroafri${SHY}cana`);
    expect(softened('Sri Jayawardenepura Kotte')).toBe(`Sri Jayawarde${SHY}nepura Kotte`);
    expect(softened('Islas Vírgenes Estadounidenses')).toBe(`Islas Vírgenes Estadou${SHY}nidenses`);
    // Shorter words are written whole, in a smaller letter if need be.
    for (const name of ['Liechtenstein', 'Turkmenistán', 'Antananarivo', 'San Vicente y las Granadinas', 'Bosnia y Herzegovina', 'Guinea-Bisáu']) expect(softened(name)).toBe(name);
    // Twice the same is the same.
    expect(softened(softened('República Centroafricana'))).toBe(softened('República Centroafricana'));
  });

  it('leaves at least four letters on each side, and whole a word with nowhere to be cut', () => {
    const words = new Set<string>();
    for (const c of index.countries) for (const text of [c.n.es, c.n.en ?? '', c.cap?.es ?? '', c.cap?.en ?? '']) for (const w of text.split(/[\s-]+/)) if (w.length >= LONG_WORD) words.add(w);
    expect(words.size).toBeGreaterThan(2);
    for (const w of words) {
      const parts = softened(w).split(SHY);
      expect(parts.length, w).toBeLessThanOrEqual(2);
      for (const part of parts) expect(part.length, w).toBeGreaterThanOrEqual(4);
      expect(parts.join(''), w).toBe(w);
    }
    expect(softened('Strengthlessnesses')).toBe('Strengthlessnesses');
    expect(softened('Bcdfghjklmnpqrst')).toBe('Bcdfghjklmnpqrst');
  });

  it('says which pieces of a name are never cut', () => {
    expect(unbroken('San Vicente y las Granadinas')).toEqual(['San', 'Vicente', 'y', 'las', 'Granadinas']);
    // A hyphen stays at the end of the line it is written on, and a soft one shows as a hyphen there.
    expect(unbroken('Guinea-Bisáu')).toEqual(['Guinea-', 'Bisáu']);
    expect(unbroken(softened('República Centroafricana'))).toEqual(['República', 'Centroafri-', 'cana']);
    expect(unbroken('  Roma  ')).toEqual(['Roma']);
    expect(unbroken('')).toEqual([]);
  });
});

describe('pairs: a turn', () => {
  it('puts together the two cards of a country, and counts the turn', () => {
    const g = turns(table('AaBb'), 0, 1);
    expect(g.found).toEqual(['ES']);
    expect(g.up).toEqual([]);
    expect(g.turns).toBe(1);
    expect(g.missed).toEqual([]);
    expect(pairsDone(g)).toBe(false);
    const end = turns(g, 3, 2);
    expect(end.found).toEqual(['ES', 'FR']);
    expect(end.turns).toBe(2);
    expect(pairsDone(end)).toBe(true);
    expect(pairTally(end)).toEqual({ ok: 2, bad: 0 });
  });

  it('is one card of each kind: with a flag up, another flag cannot be turned', () => {
    const one = turnCard(table('ABab'), 0);
    expect(canTurn(one, 1)).toBe(false);
    expect(turnCard(one, 1)).toBe(one);
    expect(canTurn(one, 2)).toBe(true);
    expect(canTurn(one, 3)).toBe(true);
    // Either kind can be the first.
    expect(canTurn(table('ABab'), 0)).toBe(true);
    expect(canTurn(table('ABab'), 3)).toBe(true);
    expect(canTurn(turnCard(table('ABab'), 3), 2)).toBe(false);
    expect(turns(table('ABab'), 3, 1).found).toEqual(['FR']);
  });

  it('leaves in sight the two that do not match, until the next card or until they are put back', () => {
    const g = turns(table('ABab'), 0, 3);
    expect(g.up).toEqual([0, 3]);
    expect(g.found).toEqual([]);
    expect(g.turns).toBe(1);
    expect(hidePair(g).up).toEqual([]);
    // The next card puts them back by itself, whichever its kind: it is the first of a new turn.
    expect(turnCard(g, 1).up).toEqual([1]);
    expect(turnCard(g, 2).up).toEqual([2]);
    // One of the two can be that card.
    expect(canTurn(g, 0)).toBe(true);
    expect(turnCard(g, 0).up).toEqual([0]);
    expect(turnCard(g, 0).turns).toBe(1);
  });

  it('does not turn a card that is up, or one whose pair is found', () => {
    const one = turnCard(table('AaBb'), 0);
    expect(canTurn(one, 0)).toBe(false);
    expect(turnCard(one, 0)).toBe(one);
    const found = turnCard(one, 1);
    expect(canTurn(found, 0)).toBe(false);
    expect(canTurn(found, 1)).toBe(false);
    expect(turnCard(found, 1)).toBe(found);
    expect(turnCard(found, 9)).toBe(found);
    expect(hidePair(one)).toBe(one);
  });

  it('does not count as a miss two cards that had never been seen', () => {
    // There is no other way to find out what they are.
    const g = turns(table('ABCabc'), 0, 4);
    expect(g.missed).toEqual([]);
    expect(turns(g, 2, 3).missed).toEqual([]);
    // (The flag of France would not do as the next first card: its name has just been seen.)
    expect(turns(g, 1, 5).missed).toEqual(['FR']);
  });

  it('counts as a miss not going for the other half when it had been seen', () => {
    // The flag of Spain and the name of France are seen; then the name of Spain is turned, and where its flag
    // is (card 0) is known: any other flag is a miss.
    const seen = turns(table('AbaBCc'), 0, 1);
    const wrong = turns(seen, 2, 3);
    expect(wrong.missed).toEqual(['ES']);
    // Going for it is a pair, and no miss.
    const right = turns(seen, 2, 0);
    expect(right.found).toEqual(['ES']);
    expect(right.missed).toEqual([]);
  });

  it('counts as a miss a second card that had been seen and did not match', () => {
    // The flag of Spain and the name of France are seen. The flag of Portugal is new and so is its name, but
    // the name of France is known not to be it.
    const g = turns(table('AbCacB'), 0, 1, 2, 1);
    expect(g.missed).toEqual(['PT']);
    // The miss is counted once for a country, however many times it is missed.
    expect(turns(g, 2, 3).missed).toEqual(['PT']);
  });

  it('tells the pairs found without a miss from the ones that took one', () => {
    let g = turns(table('AbCacB'), 0, 1, 2, 1);
    g = turns(g, 2, 4, 0, 3, 5, 1);
    expect(pairsDone(g)).toBe(true);
    expect(g.turns).toBe(5);
    expect(pairTally(g)).toEqual({ ok: 2, bad: 1 });
    // A game left half way counts what was found.
    expect(pairTally(turns(table('ABCabc'), 0, 3))).toEqual({ ok: 1, bad: 0 });
    expect(pairTally(table('ABCabc'))).toEqual({ ok: 0, bad: 0 });
  });

  it('can be played to the end from any deal by someone who forgets nothing, without a miss', () => {
    for (const of of PAIR_OFS) {
      for (let seed = 1; seed <= 40; seed++) {
        let g = newPairs(states, of, PAIR_SIZES[seed % PAIR_SIZES.length], mulberry32(seed));
        const n = pairCount(g);
        const other = (i: number) => g.cards.findIndex((c, k) => k !== i && c.country === g.cards[i].country);
        for (let guard = 0; guard < 200 && !pairsDone(g); guard++) {
          const down = g.cards.map((_, i) => i).filter((i) => !g.found.includes(g.cards[i].country));
          // A pair whose two cards are known is taken first.
          const known = down.find((i) => g.seen.includes(i) && g.seen.includes(other(i)));
          if (known != null) {
            g = turns(g, known, other(known));
            continue;
          }
          const fresh = down.filter((i) => !g.seen.includes(i));
          const first = fresh[0];
          g = turnCard(g, first);
          // Its other half, if it has been seen; if not, a new card of the other kind, which there always is: its other half is one.
          g = turnCard(g, g.seen.includes(other(first)) ? other(first) : fresh.find((i) => g.cards[i].face !== g.cards[first].face)!);
        }
        expect(pairsDone(g), `${of} ${seed}`).toBe(true);
        expect(g.missed, `${of} ${seed}`).toEqual([]);
        expect(pairTally(g)).toEqual({ ok: n, bad: 0 });
        // Never fewer turns than pairs, nor more than two for each.
        expect(g.turns).toBeGreaterThanOrEqual(n);
        expect(g.turns).toBeLessThanOrEqual(2 * n);
      }
    }
  });
});
