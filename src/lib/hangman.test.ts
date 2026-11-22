/** «Ahorcado»: what each letter uncovers of a name, how a round stands after some letters, and how it is marked. */
import { describe, expect, it } from 'vitest';
import { HANG_MISSES, hangOrder, hangPool, hangRes, hangable, hiddenOf, keyLetter, letterOf, lettersOf, partsOf, spokenOf, standing, tryLetter, widestOf, wordsOf } from './hangman';

const shown = (name: string, tried: string[], lang: 'es' | 'en' = 'es'): string => {
  const { hits } = standing(name, tried, lang);
  return wordsOf(name, lang)
    .map((word) => word.map((c) => (!c.letter || hits.includes(c.letter) ? c.ch : '_')).join(''))
    .join(' ');
};

describe('the letters there are to try', () => {
  it('are the alphabet of the language: the Spanish one has the Ñ after the N', () => {
    expect(lettersOf('en').join('')).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    expect(lettersOf('es').join('')).toBe('ABCDEFGHIJKLMNÑOPQRSTUVWXYZ');
    expect(lettersOf('es')).toHaveLength(27);
  });

  it('uncover a character whatever its accent or its case', () => {
    for (const ch of ['a', 'A', 'á', 'Á', 'à', 'ä', 'â', 'ã', 'å']) expect(letterOf(ch, 'es')).toBe('A');
    expect(letterOf('ü', 'es')).toBe('U');
    expect(letterOf('ç', 'es')).toBe('C');
    expect(letterOf('ł', 'en')).toBe('L');
    expect(letterOf('ø', 'en')).toBe('O');
    expect(letterOf('İ', 'en')).toBe('I');
    expect(letterOf('z', 'en')).toBe('Z');
  });

  it('have the Ñ as a letter of its own in Spanish, and as an N in English', () => {
    expect(letterOf('ñ', 'es')).toBe('Ñ');
    expect(letterOf('Ñ', 'es')).toBe('Ñ');
    expect(letterOf('n', 'es')).toBe('N');
    expect(letterOf('ñ', 'en')).toBe('N');
    expect(letterOf('Ñ', 'en')).toBe('N');
  });

  it('uncover nothing that no single letter stands for: that is in sight from the start', () => {
    for (const ch of [' ', '-', "'", '’', '.', '(', '7', 'ß', 'æ', 'Œ', 'þ', '', 'я', '·']) expect(letterOf(ch, 'es')).toBe('');
  });

  it('are what a key of the keyboard tries, when it types one of them', () => {
    expect(keyLetter('a', 'es')).toBe('A');
    expect(keyLetter('Á', 'es')).toBe('A');
    expect(keyLetter('ñ', 'es')).toBe('Ñ');
    expect(keyLetter('ñ', 'en')).toBe('N');
    for (const key of ['Enter', 'Shift', ' ', '1', '?', '-', 'F1', 'ab', '', '.a', 'a.', 'a\u0301', 'Dead']) expect(keyLetter(key, 'es')).toBe('');
    // Whatever it types is a letter of the alphabet of the language, or nothing.
    for (const lang of ['es', 'en'] as const) for (const ch of 'aáñÑçzZüøł') expect(lettersOf(lang)).toContain(keyLetter(ch, lang));
  });
});

describe('a name, as it is laid out', () => {
  it('is its words, cell by cell, with the letter that uncovers each one', () => {
    expect(wordsOf('La Coruña', 'es')).toEqual([
      [
        { ch: 'L', letter: 'L' },
        { ch: 'a', letter: 'A' },
      ],
      [
        { ch: 'C', letter: 'C' },
        { ch: 'o', letter: 'O' },
        { ch: 'r', letter: 'R' },
        { ch: 'u', letter: 'U' },
        { ch: 'ñ', letter: 'Ñ' },
        { ch: 'a', letter: 'A' },
      ],
    ]);
    expect(wordsOf('La Coruña', 'en')[1][4]).toEqual({ ch: 'ñ', letter: 'N' });
  });

  it('keeps a hyphen, an apostrophe and a figure as cells that hide nothing', () => {
    const [first, second] = wordsOf('Castilla-La Mancha', 'es');
    expect(first.map((c) => c.ch).join('')).toBe('Castilla-La');
    expect(first[8]).toEqual({ ch: '-', letter: '' });
    expect(second).toHaveLength(6);
    expect(wordsOf("Côte d'Ivoire", 'en')[1][1]).toEqual({ ch: "'", letter: '' });
    expect(wordsOf('K2', 'es')).toEqual([
      [
        { ch: 'K', letter: 'K' },
        { ch: '2', letter: '' },
      ],
    ]);
  });

  it('parts its words at any run of spaces, and has no cell for them', () => {
    expect(wordsOf('  Santa   Cruz de\u00a0Tenerife ', 'es').map((w) => w.length)).toEqual([5, 4, 2, 8]);
    expect(wordsOf('', 'es')).toEqual([]);
    expect(wordsOf('   ', 'es')).toEqual([]);
  });

  it('takes a letter written as two characters for the one it is', () => {
    // «ñ» as an n and a tilde that is put on it: the same letter as the one written in one piece.
    expect(wordsOf('Espan\u0303a', 'es')).toEqual(wordsOf('España', 'es'));
    expect(wordsOf('Me\u0301xico', 'es')[0][1]).toEqual({ ch: 'é', letter: 'E' });
  });

  it('may go on in the next line after a hyphen, and nowhere else inside a word', () => {
    const text = (name: string): string[][] => wordsOf(name, 'es').map((word) => partsOf(word).map((part) => part.map((c) => c.ch).join('')));
    expect(text('Mecklemburgo-Pomerania Occidental')).toEqual([['Mecklemburgo-', 'Pomerania'], ['Occidental']]);
    expect(text('Castilla-La Mancha')).toEqual([['Castilla-', 'La'], ['Mancha']]);
    expect(text('Guinea-Bisáu')).toEqual([['Guinea-', 'Bisáu']]);
    expect(text('León')).toEqual([['León']]);
    // A hyphen at an end leaves no empty stretch behind, and two together are a stretch each.
    expect(text('-a-')).toEqual([['-', 'a-']]);
    expect(text('a--b')).toEqual([['a-', '-', 'b']]);
    expect(partsOf([])).toEqual([]);
  });

  it('is as wide as its longest stretch', () => {
    expect(widestOf(wordsOf('León', 'es'))).toBe(4);
    expect(widestOf(wordsOf('Santa Cruz de Tenerife', 'es'))).toBe(8);
    expect(widestOf(wordsOf('Mecklemburgo-Pomerania Occidental', 'es'))).toBe(13);
    expect(widestOf(wordsOf('Renania del Norte-Westfalia', 'es'))).toBe(9);
    expect(widestOf([])).toBe(1);
  });

  it('hides each of its letters once, in the order they come', () => {
    expect(hiddenOf('Guadalajara', 'es')).toEqual(['G', 'U', 'A', 'D', 'L', 'J', 'R']);
    expect(hiddenOf('Córdoba', 'es')).toEqual(['C', 'O', 'R', 'D', 'B', 'A']);
    expect(hiddenOf('Ñuble', 'es')).toEqual(['Ñ', 'U', 'B', 'L', 'E']);
    expect(hiddenOf('Ñuble', 'en')).toEqual(['N', 'U', 'B', 'L', 'E']);
    expect(hiddenOf('K2', 'es')).toEqual(['K']);
  });

  it('can be played when it hides some letter', () => {
    expect(hangable('Ur', 'es')).toBe(true);
    expect(hangable('K2', 'es')).toBe(true);
    for (const name of ['', '   ', '1984', '--', 'ß', 'Москва']) expect(hangable(name, 'es')).toBe(false);
  });
});

describe('a round', () => {
  it('starts with every letter covered, and what is no letter in sight', () => {
    expect(shown('Castilla-La Mancha', [])).toBe('________-__ ______');
    expect(standing('Castilla-La Mancha', [], 'es')).toEqual({ hits: [], misses: [], left: 16, solved: false, lost: false });
  });

  it('uncovers a letter wherever it is, with or without an accent', () => {
    expect(shown('Guadalajara', ['A'])).toBe('__a_a_a_a_a');
    expect(shown('Córdoba', ['O'])).toBe('_ó__o__');
    expect(shown('Málaga', ['A'])).toBe('_á_a_a');
    expect(standing('Guadalajara', ['A'], 'es')).toMatchObject({ hits: ['A'], misses: [], left: 6 });
  });

  it('keeps the N and the Ñ apart in Spanish, and together in English', () => {
    expect(shown('Peñón', ['N'], 'es')).toBe('____n');
    expect(shown('Peñón', ['Ñ'], 'es')).toBe('__ñ__');
    expect(shown('Peñón', ['N'], 'en')).toBe('__ñ_n');
    expect(tryLetter('Peñón', [], 'Ñ', 'en')).toBeNull();
  });

  it('counts a letter that is not in the name as a miss, and leaves the name as it was', () => {
    expect(standing('Lugo', ['E', 'L', 'A'], 'es')).toEqual({ hits: ['L'], misses: ['E', 'A'], left: 3, solved: false, lost: false });
    expect(shown('Lugo', ['E', 'L', 'A'])).toBe('L___');
  });

  it('is won with the last letter of the name, whatever was missed on the way', () => {
    const tried = ['E', 'A', 'I', 'L', 'U', 'G', 'O'];
    expect(standing('Lugo', tried.slice(0, 6), 'es')).toMatchObject({ solved: false, left: 1 });
    expect(standing('Lugo', tried, 'es')).toEqual({ hits: ['L', 'U', 'G', 'O'], misses: ['E', 'A', 'I'], left: 0, solved: true, lost: false });
  });

  it('is lost with the eighth letter that is not in the name, and not before', () => {
    const wrong = ['B', 'C', 'D', 'F', 'H', 'J', 'K', 'M'];
    expect(HANG_MISSES).toBe(8);
    expect(standing('Lugo', wrong.slice(0, 7), 'es')).toMatchObject({ misses: wrong.slice(0, 7), lost: false, solved: false });
    expect(standing('Lugo', wrong, 'es')).toEqual({ hits: [], misses: wrong, left: 4, solved: false, lost: true });
  });

  it('is over once it is won or lost: what is tried after that changes nothing', () => {
    const wrong = ['B', 'C', 'D', 'F', 'H', 'J', 'K', 'M'];
    expect(standing('Lugo', [...wrong, 'L', 'U', 'G', 'O'], 'es')).toMatchObject({ hits: [], lost: true, solved: false, left: 4 });
    expect(standing('Lugo', ['L', 'U', 'G', 'O', ...wrong], 'es')).toMatchObject({ misses: [], solved: true, lost: false });
    // With seven misses the last letter still wins it.
    expect(standing('Lugo', [...wrong.slice(0, 7), 'L', 'U', 'G', 'O'], 'es')).toMatchObject({ solved: true, lost: false, misses: wrong.slice(0, 7) });
  });

  it('looks once at a letter that is tried twice, and not at what is no letter', () => {
    expect(standing('Lugo', ['E', 'E', 'L', 'L', 'E'], 'es')).toMatchObject({ hits: ['L'], misses: ['E'] });
    expect(standing('Lugo', ['l', '1', '', 'LU', 'Ç', 'Ñ'], 'es')).toMatchObject({ hits: [], misses: ['Ñ'] });
    expect(standing('Lugo', ['Ñ'], 'en')).toMatchObject({ hits: [], misses: [] });
  });

  it('has nothing to guess in a name that hides nothing', () => {
    expect(standing('1984', [], 'es')).toEqual({ hits: [], misses: [], left: 0, solved: true, lost: false });
  });
});

describe('a letter that is tried', () => {
  it('says how many cells it uncovers, and is written down after the ones before', () => {
    expect(tryLetter('Guadalajara', [], 'A', 'es')).toEqual({ tried: ['A'], found: 5 });
    expect(tryLetter('Guadalajara', ['A'], 'G', 'es')).toEqual({ tried: ['A', 'G'], found: 1 });
    expect(tryLetter('Córdoba', ['A'], 'O', 'es')).toEqual({ tried: ['A', 'O'], found: 2 });
  });

  it('uncovers none when it is not in the name, and is written down all the same', () => {
    expect(tryLetter('Lugo', ['L'], 'E', 'es')).toEqual({ tried: ['L', 'E'], found: 0 });
  });

  it('cannot be tried twice, whether it was in the name or not', () => {
    expect(tryLetter('Lugo', ['L', 'E'], 'L', 'es')).toBeNull();
    expect(tryLetter('Lugo', ['L', 'E'], 'E', 'es')).toBeNull();
  });

  it('cannot be tried when it is no letter of the alphabet, or the round is over', () => {
    for (const letter of ['l', '1', '', 'LU', 'Ç', ' ']) expect(tryLetter('Lugo', [], letter, 'es')).toBeNull();
    expect(tryLetter('Lugo', ['L', 'U', 'G', 'O'], 'A', 'es')).toBeNull();
    expect(tryLetter('Lugo', ['B', 'C', 'D', 'F', 'H', 'J', 'K', 'M'], 'L', 'es')).toBeNull();
    expect(tryLetter('Lugo', ['B', 'C', 'D', 'F', 'H', 'J', 'K'], 'L', 'es')).toEqual({ tried: ['B', 'C', 'D', 'F', 'H', 'J', 'K', 'L'], found: 1 });
  });
});

describe('how a round is marked', () => {
  it('is right first time with the letters alone, with help when the map was asked, and to review when the name is not found', () => {
    expect(hangRes(true, false)).toBe('ok');
    expect(hangRes(true, true)).toBe('warn');
    expect(hangRes(false, false)).toBe('bad');
    expect(hangRes(false, true)).toBe('bad');
  });
});

describe('the name as it is heard', () => {
  it('is said letter by letter, with a word for each cell still covered', () => {
    expect(spokenOf('La Coruña', [], 'es', 'hueco')).toBe('hueco hueco, hueco hueco hueco hueco hueco hueco');
    expect(spokenOf('La Coruña', ['A', 'Ñ'], 'es', 'hueco')).toBe('hueco A, hueco hueco hueco hueco Ñ A');
    expect(spokenOf('Castilla-La Mancha', ['A'], 'en', 'blank')).toBe('blank A blank blank blank blank blank A - blank A, blank A blank blank blank A');
    expect(spokenOf('Córdoba', ['O', 'X'], 'es', 'hueco')).toBe('hueco Ó hueco hueco O hueco hueco');
  });
});

describe('the pieces of a game', () => {
  const items = [
    { id: 'a', name: 'Ávila' },
    { id: 'b', name: 'Burgos' },
    { id: 'n', name: '1984' },
    { id: 'c', name: 'Cádiz' },
  ];

  it('are those whose name hides something: of the whole map, or of a list', () => {
    expect(hangPool(items, undefined, 'es').map((it) => it.id)).toEqual(['a', 'b', 'c']);
    expect(hangPool(items, ['c', 'n', 'a', 'zz'], 'es').map((it) => it.id)).toEqual(['a', 'c']);
    expect(hangPool(items, [], 'es')).toEqual([]);
  });

  it('come by lot, the same for the same seed whatever the order they are given in', () => {
    const ids = Array.from({ length: 30 }, (_, i) => `p${String(i).padStart(2, '0')}`);
    const one = hangOrder(ids, 10, 7, false);
    expect(one).toHaveLength(10);
    expect(new Set(one).size).toBe(10);
    expect(hangOrder([...ids].reverse(), 10, 7, false)).toEqual(one);
    expect(hangOrder(ids, 10, 8, false)).not.toEqual(one);
    // Not the order they were given in: it is a draw.
    expect(hangOrder(ids, 'all', 7, false)).not.toEqual(ids);
    expect([...hangOrder(ids, 'all', 7, false)].sort()).toEqual(ids);
  });

  it('are as many as were asked for, and all of them in a game of a list or of the whole map', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    expect(hangOrder(ids, 3, 1, false)).toHaveLength(3);
    expect(hangOrder(ids, 10, 1, false)).toHaveLength(5);
    expect(hangOrder(ids, 3, 1, true)).toHaveLength(5);
    expect(hangOrder(ids, 'all', 1, false)).toHaveLength(5);
    expect(hangOrder(ids, 'endless', 1, false)).toHaveLength(5);
    expect(hangOrder([], 10, 1, false)).toEqual([]);
    // The first ones of the draw, not others: a shorter game is the start of a longer one.
    expect(hangOrder(ids, 3, 1, false)).toEqual(hangOrder(ids, 'all', 1, false).slice(0, 3));
  });
});
