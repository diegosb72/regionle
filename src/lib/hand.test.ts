import { beforeEach, describe, expect, it } from 'vitest';
import { backupOf } from './backup';
import { ERASER, HAND_COLOURS, HAND_COLOUR_COUNT, HAND_LABEL_MAX, HAND_MAPS_MAX, HAND_PIECES_MAX, blankHand, brushed, cleanHand, dropHand, handColour, handLegend, labelled, typedLabel, withHand, type Hand, type HandMap } from './hand';
import { setLang } from './i18n';
import { mergeSaved, useStore } from './store';

const NOW = 1_800_000_000_000;
const painted = (f: Record<string, number>, l: Record<string, string> = {}, t = NOW): HandMap => ({ f, l, t });

describe('the colours to paint with', () => {
  it('are six, all different, each with a name in both languages', () => {
    expect(HAND_COLOURS).toHaveLength(6);
    // As many as a painting is allowed to hold when it is read from storage.
    expect(HAND_COLOURS).toHaveLength(HAND_COLOUR_COUNT);
    expect(new Set(HAND_COLOURS.map((c) => c.hex)).size).toBe(6);
    expect(new Set(HAND_COLOURS.map((c) => c.es)).size).toBe(6);
    expect(new Set(HAND_COLOURS.map((c) => c.en)).size).toBe(6);
    for (const c of HAND_COLOURS) expect(c.hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('are known by their number, from one: nothing else is a colour', () => {
    expect(handColour(1)).toBe(HAND_COLOURS[0]);
    expect(handColour(6)).toBe(HAND_COLOURS[5]);
    for (const not of [0, 7, -1, 1.5, '1', null, undefined, NaN]) expect(handColour(not)).toBeNull();
  });
});

describe('a touch of the brush', () => {
  it('paints a piece, repaints it with another colour and takes the colour off at the second touch', () => {
    let map = brushed(undefined, 'ES', 1, NOW)!;
    expect(map).toEqual({ f: { ES: 1 }, l: {}, t: NOW });
    map = brushed(map, 'FR', 1, NOW + 1)!;
    map = brushed(map, 'ES', 3, NOW + 2)!;
    expect(map.f).toEqual({ ES: 3, FR: 1 });
    expect(map.t).toBe(NOW + 2);
    // The same colour again: the piece goes back to having none.
    map = brushed(map, 'ES', 3, NOW + 3)!;
    expect(map.f).toEqual({ FR: 1 });
    expect(map.t).toBe(NOW + 3);
  });

  it('erases with the eraser, whatever the colour, and changes nothing where there is nothing to erase', () => {
    const map = painted({ ES: 2, FR: 5 });
    expect(brushed(map, 'ES', ERASER, NOW + 1)).toEqual({ f: { FR: 5 }, l: {}, t: NOW + 1 });
    expect(brushed(map, 'IT', ERASER, NOW + 1)).toBe(map);
    // The painting that was given is never changed itself.
    expect(map).toEqual(painted({ ES: 2, FR: 5 }));
  });

  it('does nothing with what is not a colour, or with no piece', () => {
    const map = painted({ ES: 2 });
    for (const brush of [7, -1, 2.5, NaN]) expect(brushed(map, 'FR', brush, NOW + 1)).toBe(map);
    expect(brushed(map, '', 1, NOW + 1)).toBe(map);
  });

  it('keeps what the colours stand for', () => {
    const map = painted({ ES: 2 }, { 2: 'He estado' });
    expect(brushed(map, 'FR', 2, NOW + 1)!.l).toEqual({ 2: 'He estado' });
    // Even when the last piece of a colour loses it: the line is the player's writing.
    expect(brushed(map, 'ES', ERASER, NOW + 1)).toEqual({ f: {}, l: { 2: 'He estado' }, t: NOW + 1 });
  });

  it('says when there is no room for one more piece; a piece that is painted can still change', () => {
    const full = painted(Object.fromEntries(Array.from({ length: HAND_PIECES_MAX }, (_, i) => [`p${i}`, 1])));
    expect(brushed(full, 'one-more', 2, NOW + 1)).toBeNull();
    expect(brushed(full, 'p0', 2, NOW + 1)!.f.p0).toBe(2);
    expect(Object.keys(brushed(full, 'p0', ERASER, NOW + 1)!.f)).toHaveLength(HAND_PIECES_MAX - 1);
  });
});

describe('what a colour stands for', () => {
  it('is kept as it is typed: on one line, with nothing before it and no longer than a legend allows', () => {
    expect(typedLabel('  He  estado\n aquí')).toBe('He estado aquí');
    // A space at the end stays while typing: the next word is on its way.
    expect(typedLabel('He ')).toBe('He ');
    expect(typedLabel('x'.repeat(100))).toHaveLength(HAND_LABEL_MAX);
  });

  it('is set, changed and taken away', () => {
    let map = labelled(painted({ ES: 1 }), 1, 'He estado', NOW + 1);
    expect(map).toEqual({ f: { ES: 1 }, l: { 1: 'He estado' }, t: NOW + 1 });
    map = labelled(map, 4, 'Quiero ir', NOW + 2);
    expect(map.l).toEqual({ 1: 'He estado', 4: 'Quiero ir' });
    const same = labelled(map, 1, 'He estado', NOW + 3);
    expect(same).toBe(map);
    map = labelled(map, 1, '', NOW + 4);
    expect(map.l).toEqual({ 4: 'Quiero ir' });
    // Nothing but colours have a line.
    expect(labelled(map, 9, 'x', NOW + 5)).toBe(map);
    expect(labelled(undefined, 2, 'Sola', NOW)).toEqual({ f: {}, l: { 2: 'Sola' }, t: NOW });
  });
});

describe('the legend of a painting', () => {
  const map = painted({ ES: 5, FR: 1, PT: 5, IT: 1, DE: 1, 'ES-AN': 3 }, { 5: ' Verano ', 2: 'Sin usar' });

  it('lists the colours in use in the order of the palette, with how many pieces have each', () => {
    expect(handLegend(map, () => true)).toEqual([
      { colour: 1, label: '', count: 3 },
      { colour: 3, label: '', count: 1 },
      { colour: 5, label: 'Verano', count: 2 },
    ]);
  });

  it('counts only the pieces of the map it is asked about', () => {
    const world = new Set(['ES', 'FR', 'PT']);
    expect(handLegend(map, (id) => world.has(id))).toEqual([
      { colour: 1, label: '', count: 1 },
      { colour: 5, label: 'Verano', count: 2 },
    ]);
    expect(handLegend(map, () => false)).toEqual([]);
    expect(handLegend(undefined, () => true)).toEqual([]);
  });
});

describe('the paintings kept', () => {
  it('are kept by their map; a blank one is not kept', () => {
    let hand: Hand = {};
    hand = withHand(hand, 'c:ES,FR', painted({ ES: 1 }));
    hand = withHand(hand, 'r:ES', painted({ 'ES-AN': 2 }));
    expect(Object.keys(hand)).toEqual(['c:ES,FR', 'r:ES']);
    expect(withHand(hand, 'c:ES,FR', hand['c:ES,FR'])).toBe(hand);
    expect(withHand(hand, '', painted({ ES: 1 }))).toBe(hand);
    hand = withHand(hand, 'c:ES,FR', painted({}));
    expect(Object.keys(hand)).toEqual(['r:ES']);
    hand = withHand(hand, 'r:ES', null);
    expect(hand).toEqual({});
    expect(withHand(hand, 'r:ES', null)).toBe(hand);
    // A colour explained and not yet used is worth keeping.
    expect(blankHand(painted({}, { 1: 'He estado' }))).toBe(false);
    expect(blankHand(painted({}))).toBe(true);
    expect(blankHand(null)).toBe(true);
  });

  it('make room for a new one by letting go of those touched longest ago', () => {
    let hand: Hand = {};
    for (let i = 0; i < HAND_MAPS_MAX; i++) hand = withHand(hand, `m${i}`, painted({ ES: 1 }, {}, NOW + i));
    expect(Object.keys(hand)).toHaveLength(HAND_MAPS_MAX);
    // The oldest is touched again, and so it is the second oldest that goes.
    hand = withHand(hand, 'm0', painted({ ES: 2 }, {}, NOW + 100));
    hand = withHand(hand, 'new', painted({ FR: 1 }, {}, NOW + 101));
    expect(Object.keys(hand)).toHaveLength(HAND_MAPS_MAX);
    expect(hand.m0.f).toEqual({ ES: 2 });
    expect(hand.new).toBeDefined();
    expect(hand.m1).toBeUndefined();
    expect(hand.m2).toBeDefined();
  });

  it('lose the pieces that are no longer in the game, and the painting left with nothing', () => {
    const hand: Hand = { a: painted({ ES: 1, XX: 2 }, { 1: 'He estado' }), b: painted({ XX: 3 }), c: painted({ FR: 4 }) };
    const out = dropHand(hand, ['XX', 'YY']);
    expect(out).toEqual({ a: painted({ ES: 1 }, { 1: 'He estado' }), c: painted({ FR: 4 }) });
    expect(out.c).toBe(hand.c);
    expect(dropHand(hand, ['YY'])).toBe(hand);
    // The one that was given is not changed.
    expect(Object.keys(hand)).toEqual(['a', 'b', 'c']);
  });

  it('are cleaned when they are read: only pieces with a colour, lines of a legend and whole paintings stay', () => {
    const read = cleanHand({
      good: { f: { ES: 1, FR: 6 }, l: { 1: '  He   estado ', 6: 'x'.repeat(80) }, t: NOW },
      mixed: { f: { ES: 0, FR: 7, IT: '2', PT: 2.5, DE: 3, '': 1 }, l: { 3: 7, 9: 'no', 2: '   ' }, t: 'ayer' },
      empty: { f: {}, l: {}, t: NOW },
      noPieces: { l: { 1: 'x' }, t: NOW },
      aList: [1, 2],
      aNumber: 4,
    });
    expect(read).toEqual({
      good: { f: { ES: 1, FR: 6 }, l: { 1: 'He estado', 6: 'x'.repeat(HAND_LABEL_MAX) }, t: NOW },
      mixed: { f: { DE: 3 }, l: {}, t: 0 },
    });
    for (const not of [null, undefined, 3, 'x', [], [{ f: { ES: 1 } }]]) expect(cleanHand(not)).toEqual({});
  });

  it('are no more than are kept when they are read, the latest first', () => {
    const many = Object.fromEntries(Array.from({ length: HAND_MAPS_MAX + 5 }, (_, i) => [`m${i}`, painted({ ES: 1 }, {}, NOW + i)]));
    const read = cleanHand(many);
    expect(Object.keys(read)).toHaveLength(HAND_MAPS_MAX);
    expect(read.m0).toBeUndefined();
    expect(read.m4).toBeUndefined();
    expect(read.m5).toBeDefined();
    expect(read[`m${HAND_MAPS_MAX + 4}`]).toBeDefined();
    // And no more pieces in each than a painting holds.
    const huge = cleanHand({ big: { f: Object.fromEntries(Array.from({ length: HAND_PIECES_MAX + 50 }, (_, i) => [`p${i}`, 1])), l: {}, t: NOW } });
    expect(Object.keys(huge.big.f)).toHaveLength(HAND_PIECES_MAX);
  });
});

describe('the paintings of the player', () => {
  beforeEach(() => {
    setLang('es');
    useStore.setState({ hand: {}, notes: {}, stats: {}, where: {}, mix: {}, goals: [] });
  });

  it('are kept by their map, and a painting left blank is let go', () => {
    useStore.getState().setHand('c:ES,FR', painted({ ES: 1 }));
    expect(useStore.getState().hand).toEqual({ 'c:ES,FR': painted({ ES: 1 }) });
    useStore.getState().setHand('c:ES,FR', painted({}));
    expect(useStore.getState().hand).toEqual({});
    useStore.getState().setHand('c:ES,FR', painted({ ES: 1 }));
    useStore.getState().setHand('c:ES,FR', null);
    expect(useStore.getState().hand).toEqual({});
  });

  it('stay when the progress is cleared: they are the player’s own work, like the notes', () => {
    useStore.getState().setHand('c:ES,FR', painted({ ES: 1 }));
    useStore.getState().record('loc', 'ES', 'ok');
    useStore.getState().resetProgress();
    expect(useStore.getState().stats).toEqual({});
    expect(useStore.getState().hand).toEqual({ 'c:ES,FR': painted({ ES: 1 }) });
  });

  it('lose a piece that is dropped from the game', () => {
    useStore.getState().setHand('c:ES,FR', painted({ ES: 1, FR: 2 }));
    useStore.getState().drop(['FR']);
    expect(useStore.getState().hand).toEqual({ 'c:ES,FR': painted({ ES: 1 }) });
  });

  it('travel in the backup, and stay as they are when the backup is from before maps could be painted', () => {
    useStore.getState().setHand('c:ES,FR', painted({ ES: 1 }, { 1: 'He estado' }));
    const copy = backupOf(useStore.getState(), NOW);
    expect(copy.hand).toEqual({ 'c:ES,FR': painted({ ES: 1 }, { 1: 'He estado' }) });

    // An old copy says nothing of them: what is painted here stays.
    expect(useStore.getState().importData({ stats: {}, sessions: [] })).toBe(true);
    expect(useStore.getState().hand).toEqual({ 'c:ES,FR': painted({ ES: 1 }, { 1: 'He estado' }) });
    // A copy that has them brings its own, cleaned.
    expect(useStore.getState().importData({ stats: {}, sessions: [], hand: { 'r:ES': { f: { 'ES-AN': 4, 'ES-GA': 9 }, l: { 4: ' Sur ' }, t: NOW } } })).toBe(true);
    expect(useStore.getState().hand).toEqual({ 'r:ES': painted({ 'ES-AN': 4 }, { 4: 'Sur' }) });
    // And the copy made here, read back, leaves what there was.
    useStore.setState({ hand: {} });
    expect(useStore.getState().importData(JSON.parse(JSON.stringify(copy)))).toBe(true);
    expect(useStore.getState().hand).toEqual({ 'c:ES,FR': painted({ ES: 1 }, { 1: 'He estado' }) });
  });

  it('are cleaned when they are read from storage, and a player from before them starts with none', () => {
    const merged = mergeSaved({ hand: { 'c:ES': { f: { ES: 2, FR: 'azul' }, l: {}, t: NOW }, x: 3 } }, useStore.getState());
    expect(merged.hand).toEqual({ 'c:ES': painted({ ES: 2 }) });
    expect(mergeSaved({}, useStore.getState()).hand).toEqual({});
  });
});
