import { describe, expect, it } from 'vitest';
import { canChallenge, decodeChallenge, encodeChallenge, seedOf } from './challenge';
import { DEFAULT_OPTS, type GameConfig } from './store';

const game = (patch: Partial<GameConfig> = {}): GameConfig => ({ section: 'regions', mode: 'pin', countries: ['ES'], levels: { ES: 'g1' }, opts: DEFAULT_OPTS, nonce: 123456, ...patch });

describe('challenge by link', () => {
  it('carries the game, the seed, the name and the result', () => {
    const code = encodeChallenge(game({ opts: { ...DEFAULT_OPTS, length: 10, answer: 'type' } }), { score: 84.6, ms: 61_234.4 }, '  Diego  ');
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeChallenge(code)).toEqual({
      section: 'regions',
      mode: 'pin',
      countries: ['ES'],
      levels: { ES: 'g1' },
      opts: { answer: 'type', length: 10, pinBy: 'name', cityPick: 'top', cityCount: 25, turned: false, flagLook: 'plain' },
      seed: 123456,
      from: 'Diego',
      score: 85,
      ms: 61_234,
    });
  });

  it('carries the hard looks, so that both play the same game', () => {
    const plain = encodeChallenge(game({ section: 'countries', mode: 'outline', countries: ['ES', 'FR'], levels: {} }));
    const turned = encodeChallenge(game({ section: 'countries', mode: 'outline', countries: ['ES', 'FR'], levels: {}, opts: { ...DEFAULT_OPTS, turned: true } }));
    const grey = encodeChallenge(game({ section: 'countries', mode: 'flag', countries: ['ES', 'FR'], levels: {}, opts: { ...DEFAULT_OPTS, flagLook: 'grey' } }));
    const both = encodeChallenge(game({ section: 'countries', mode: 'mix', countries: ['ES', 'FR'], levels: {}, opts: { ...DEFAULT_OPTS, turned: true, flagLook: 'blur' } }));
    expect(decodeChallenge(plain)!.opts).toMatchObject({ turned: false, flagLook: 'plain' });
    expect(decodeChallenge(turned)!.opts).toMatchObject({ turned: true, flagLook: 'plain' });
    expect(decodeChallenge(grey)!.opts).toMatchObject({ turned: false, flagLook: 'grey' });
    expect(decodeChallenge(both)!).toMatchObject({ mode: 'mix', opts: { turned: true, flagLook: 'blur' } });
    // A plain game costs the link nothing: it is as long as it was before the looks came.
    expect(JSON.parse(atob(plain.replace(/-/g, '+').replace(/_/g, '/'))).o).toHaveLength(5);
    // A link from before says nothing of them, and is played plain whatever the receiver likes; so is one that says nonsense.
    const old = btoa(JSON.stringify({ s: 'countries', m: 'flag', c: 'ESFR', k: 5, v: 2, o: ['type', 10, 'name', 'top', 25] }));
    expect(decodeChallenge(old)!.opts).toMatchObject({ turned: false, flagLook: 'plain' });
    const odd = btoa(JSON.stringify({ s: 'countries', m: 'flag', c: 'ESFR', k: 5, v: 2, o: ['type', 10, 'name', 'top', 25, 'yes', 'sepia'] }));
    expect(decodeChallenge(odd)!.opts).toMatchObject({ turned: false, flagLook: 'plain' });
    expect(decodeChallenge(btoa(JSON.stringify({ s: 'countries', m: 'flag', c: 'ESFR', k: 5, v: 2 })))!.opts).toEqual({ turned: false, flagLook: 'plain' });
  });

  it('is offered for the medley, and not for the games that are not marked the same for everyone', () => {
    expect(canChallenge(game({ mode: 'mix' }))).toBe(true);
    // By ear, the other may have no voice; with cards, each is their own judge.
    expect(canChallenge(game({ mode: 'listen' }))).toBe(false);
    expect(canChallenge(game({ mode: 'cards' }))).toBe(false);
    expect(decodeChallenge(btoa(JSON.stringify({ s: 'countries', m: 'cards', c: 'ESFR', k: 5, v: 2 })))).toBeNull();
  });

  it('works without a result or a name', () => {
    const back = decodeChallenge(encodeChallenge(game()))!;
    expect(back.from).toBeUndefined();
    expect(back.score).toBeUndefined();
    expect(back.ms).toBeUndefined();
  });

  it('keeps a long selection short', () => {
    const codes = Array.from({ length: 193 }, (_, i) => `${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26))}`);
    const code = encodeChallenge(game({ section: 'countries', countries: codes, levels: {} }), { score: 100, ms: 1000 }, 'Ana');
    expect(code.length).toBeLessThan(700);
    expect(decodeChallenge(code)!.countries).toEqual(codes);
  });

  it('keeps the tokens of a physical map, whatever their length', () => {
    for (const tokens of [['river', 'EU'], ['all'], ['EU'], ['sea', 'lake', 'AM', 'AS', 'all'], ['river', 'cape', 'in:ES'], ['plain', 'in:ES', 'all'], ['continent'], ['continent', 'peninsula', 'fall', 'all']]) {
      const back = decodeChallenge(encodeChallenge(game({ section: 'physical', countries: tokens, levels: {} })))!;
      expect(back.section).toBe('physical');
      expect(back.countries).toEqual(tokens);
    }
  });

  it('keeps names with accents and trims long ones', () => {
    expect(decodeChallenge(encodeChallenge(game(), undefined, 'Íñigo Ñandú ✓'))!.from).toBe('Íñigo Ñandú ✓');
    expect(decodeChallenge(encodeChallenge(game(), undefined, 'x'.repeat(80)))!.from).toHaveLength(24);
  });

  it('only sends the levels of the countries that are played', () => {
    const back = decodeChallenge(encodeChallenge(game({ levels: { ES: 'f', FR: 'g1', IT: 'f' } })))!;
    expect(back.levels).toEqual({ ES: 'f' });
  });

  it('uses the seed it was sent with, so that the questions come in the same order', () => {
    expect(seedOf(game({ nonce: 42 }))).toBe(42);
    expect(seedOf(game({ nonce: 42, challenge: { seed: 7 } }))).toBe(7);
    const sent = encodeChallenge(game({ nonce: 42, challenge: { seed: 7 } }));
    expect(decodeChallenge(sent)!.seed).toBe(7);
  });

  it('rejects links that are cut, made up or about something that cannot be compared', () => {
    const wire = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const good = { s: 'regions', m: 'pin', c: 'ES', k: 1 };
    expect(decodeChallenge(wire(good))).not.toBeNull();
    expect(decodeChallenge('')).toBeNull();
    expect(decodeChallenge('abc123')).toBeNull();
    expect(decodeChallenge(encodeChallenge(game()).slice(0, 20))).toBeNull();
    expect(decodeChallenge(wire(null))).toBeNull();
    expect(decodeChallenge(wire({ ...good, s: 'pops' }))).toBeNull();
    expect(decodeChallenge(wire({ ...good, m: 'travel' }))).toBeNull();
    expect(decodeChallenge(wire({ ...good, c: '' }))).toBeNull();
    expect(decodeChallenge(wire({ ...good, c: ['ES'] }))).toBeNull();
    expect(decodeChallenge(wire({ ...good, c: 'E<' }))).toBeNull();
    expect(decodeChallenge(wire({ ...good, c: 'ES'.repeat(700) }))).toBeNull();
    expect(decodeChallenge(wire({ ...good, k: 'x' }))).toBeNull();
  });

  it('plays a link from before the rules changed with the questions its sender had', () => {
    const wire = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
    // Links used to carry no version: capitals named after their place were still asked.
    const old = decodeChallenge(wire({ s: 'regions', m: 'capital', c: 'ES', k: 9 }))!;
    expect(old.legacy).toBe(true);
    // A link made now is played by the rules of now…
    const fresh = decodeChallenge(encodeChallenge(game({ mode: 'capital' })))!;
    expect(fresh.legacy).toBeUndefined();
    // …and an old challenge that is passed on stays as it was.
    const passedOn = decodeChallenge(encodeChallenge(game({ mode: 'capital', challenge: { seed: 9, legacy: true } })))!;
    expect(passedOn.legacy).toBe(true);
    expect(passedOn.seed).toBe(9);
  });

  it('ignores options and results that make no sense instead of trusting them', () => {
    const wire = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const back = decodeChallenge(wire({ s: 'cities', m: 'pin', c: 'ESFR', k: 3.9, o: ['shout', 'endless', 'smell', 'all', 9999], l: { ES: '<script>' }, f: '   ', r: [250, -5] }))!;
    expect(back.countries).toEqual(['ES', 'FR']);
    // Nothing of what it said is taken; the hard looks, which it did not ask for, are off.
    expect(back.opts).toEqual({ turned: false, flagLook: 'plain' });
    expect(back.levels).toEqual({});
    expect(back.seed).toBe(3);
    expect(back.from).toBeUndefined();
    expect(back.score).toBe(100);
    expect(back.ms).toBe(0);
  });

  it('is offered only for games that end with a score everyone can repeat', () => {
    expect(canChallenge(game())).toBe(true);
    expect(canChallenge(game({ mode: 'puzzle' }))).toBe(true);
    expect(canChallenge(game({ section: 'physical', countries: ['river'] }))).toBe(true);
    expect(canChallenge(game({ mode: 'explore' }))).toBe(false);
    expect(canChallenge(game({ mode: 'travel' }))).toBe(false);
    expect(canChallenge(game({ mode: 'nameall' }))).toBe(false);
    expect(canChallenge(game({ section: 'pops', mode: 'hilo' }))).toBe(false);
    expect(canChallenge(game({ only: ['ES-AN'] }))).toBe(false);
    expect(canChallenge(game({ opts: { ...DEFAULT_OPTS, length: 'endless' } }))).toBe(false);
  });
});
