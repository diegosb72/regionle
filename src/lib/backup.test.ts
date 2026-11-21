import { afterEach, describe, expect, it } from 'vitest';
import { BACKUP_EVERY_ANSWERS, BACKUP_EVERY_MS, BACKUP_VERSION, PREF_KEYS, backupDue, backupName, backupOf, cleanPrefs, prefsOf, shareFile, sinceBackup, summaryOf } from './backup';
import { cleanGhosts, type Kept } from './ghost';
import { DEFAULT_OPTS, cleanBackupMark, mergeSaved, useStore, type Stat } from './store';

const DAY = 86_400_000;
const NOW = new Date(2026, 10, 19, 12, 0, 0).getTime();
const fresh = useStore.getState();
const state = () => useStore.getState();

afterEach(() => {
  useStore.setState(fresh, true);
});

/** A player with a few answers, a game and things of their own. */
function play(): void {
  const stats: Record<string, Stat> = { 'loc:ES-AN': [3, 3, 3, NOW - DAY], 'loc:ES-AR': [2, 1, 1, NOW - DAY], 'flag:FR': [4, 4, 4, NOW - 2 * DAY], 'cap:IT': [0, 0, 0, 0] };
  useStore.setState({
    stats,
    where: { 'ES-AN': 'r|ES|g1', 'ES-AR': 'r|ES|g1', FR: 'c', IT: 'c' },
    sessions: [{ t: NOW - DAY, section: 'regions', mode: 'pin', label: 'España', total: 10, ok: 8, warn: 1, bad: 1, ms: 60_000 }],
    tot: { g: 7, q: 420, ok: 300, warn: 20, ms: 900_000 },
    days: { '2026-11-17': [1, 10, 8, 60_000, 1], '2026-11-18': [1, 10, 8, 60_000, 2] },
    notes: { 'ES-AN': 'La del sur' },
    miles: true,
    palette: 'ocean',
    reviewPace: 'long',
    reviewSize: 50,
    theme: 'dark',
    nick: 'Ana',
    opts: { ...DEFAULT_OPTS, answer: 'choice', cityCount: 50 },
  });
}

describe('what a backup holds', () => {
  it('is the progress, what the player has made and the preferences', () => {
    play();
    const copy = backupOf(state(), NOW);
    expect(copy).toMatchObject({ app: 'regionle', version: BACKUP_VERSION, exported: new Date(NOW).toISOString() });
    expect(BACKUP_VERSION).toBe(4);
    expect(Object.keys(copy.stats)).toHaveLength(4);
    expect(copy.notes).toEqual({ 'ES-AN': 'La del sur' });
    expect(Object.keys(copy.prefs).sort()).toEqual([...PREF_KEYS].sort());
    expect(copy.prefs).toMatchObject({ miles: true, palette: 'ocean', reviewPace: 'long', reviewSize: 50, theme: 'dark', nick: 'Ana' });
    // Not the language (each browser has its own), nor what was last chosen in each section, nor the game in course.
    for (const key of ['lang', 'sel', 'levels', 'mode', 'game', 'welcomed', 'backup']) {
      expect(copy).not.toHaveProperty(key);
      expect(copy.prefs).not.toHaveProperty(key);
    }
    expect(backupName('progreso', Date.UTC(2026, 10, 19, 12))).toBe('regionle-progreso-2026-11-19.json');
  });

  it('carries the ghosts handed to it, which are kept apart from the rest: none when none are', () => {
    play();
    expect(backupOf(state(), NOW).ghosts).toEqual([]);
    const ghosts: Kept[] = [
      ['regions|pin|abc123', { k: 7, h: 99, t: NOW - DAY, q: [60, 61, 62], d: 70 }],
      ['countries|flag|z9', { k: 8, h: 5, t: NOW, q: [30], d: 10 }],
    ];
    const copy = JSON.parse(JSON.stringify(backupOf(state(), NOW, ghosts)));
    expect(copy.ghosts).toEqual(ghosts);
    // What comes back from the file is what went into it, and is still what the game takes for ghosts.
    expect(cleanGhosts(copy.ghosts)).toEqual(ghosts);
    // The rest of the copy is the same with them as without.
    expect({ ...copy, ghosts: [] }).toEqual(JSON.parse(JSON.stringify(backupOf(state(), NOW))));
    expect(BACKUP_VERSION).toBe(4);
  });

  it('is summed up in a few figures, the same for a file and for the game as it stands', () => {
    play();
    const sum = summaryOf(JSON.parse(JSON.stringify(backupOf(state(), NOW))));
    // An answer that was never asked does not count.
    expect(sum).toEqual({ exported: NOW, answers: 3, learnt: 2, games: 7, days: 2, lists: 0, notes: 1, prefs: true });
  });

  it('is summed up too when it comes from an earlier version, which says less', () => {
    const old = { stats: { 'loc:FR': [2, 2, 2, 5] }, sessions: [{ t: 1 }, { t: 2 }] };
    expect(summaryOf(old)).toEqual({ exported: null, answers: 1, learnt: 1, games: 2, days: 0, lists: 0, notes: 0, prefs: false });
    expect(summaryOf({ ...old, exported: 'not a date', tot: { g: -1 } })).toMatchObject({ exported: null, games: 2 });
  });

  it('is not anything else', () => {
    for (const x of [null, undefined, 3, 'copy', [], {}, { stats: {} }, { sessions: [] }, { stats: [], sessions: [] }, { stats: {}, sessions: {} }]) expect(summaryOf(x), JSON.stringify(x)).toBeNull();
  });
});

describe('the preferences of a backup', () => {
  it('come back as they left', () => {
    play();
    const sent = JSON.parse(JSON.stringify(backupOf(state(), NOW)));
    useStore.setState(fresh, true);
    expect(cleanPrefs(sent.prefs, state())).toEqual(sent.prefs);
  });

  it('are taken one by one: what is not something a preference can be stays as it is here', () => {
    const here = prefsOf(state());
    const got = cleanPrefs({ theme: 'sepia', cb: 'yes', sound: true, miles: 1, palette: 'neon', reviewPace: 'slow', reviewSize: 31, dayGoal: 33, nick: 7, opts: 'none', lang: 'fr', sel: {} }, here)!;
    expect(got).toEqual({ ...here, sound: true });
    expect(got).not.toHaveProperty('lang');
    expect(got).not.toHaveProperty('sel');
    expect(cleanPrefs({ nick: 'x'.repeat(60) }, here)!.nick).toHaveLength(24);
  });

  it('check each option of a game against what that option can be', () => {
    const here = prefsOf(state());
    const opts = cleanPrefs({ opts: { answer: 'choice', length: 20, pinBy: 'smell', metric: 'density', cityCount: 33, countdown: 300, wiki: 'no', labels: false, format: 'exam', extra: 'x' } }, here)!.opts;
    expect(opts).toEqual({ ...DEFAULT_OPTS, answer: 'choice', length: 20, metric: 'density', countdown: 300, labels: false, format: 'exam' });
    expect(cleanPrefs({ opts: { countdown: -5 } }, here)!.opts.countdown).toBe(DEFAULT_OPTS.countdown);
    // What the pairs are made of and how many are dealt: only what the game knows how to deal.
    expect(cleanPrefs({ opts: { pairOf: 'capital', pairs: 12 } }, here)!.opts).toMatchObject({ pairOf: 'capital', pairs: 12 });
    expect(cleanPrefs({ opts: { pairOf: 'anthem', pairs: 7 } }, here)!.opts).toMatchObject({ pairOf: DEFAULT_OPTS.pairOf, pairs: DEFAULT_OPTS.pairs });
    expect(cleanPrefs({ opts: { countdown: 1e9 } }, here)!.opts.countdown).toBe(DEFAULT_OPTS.countdown);
    // The rule of the route game, when it is one.
    expect(cleanPrefs({ opts: { routeRule: 'via' } }, here)!.opts.routeRule).toBe('via');
    expect(cleanPrefs({ opts: { routeRule: 'swim' } }, here)!.opts.routeRule).toBe('none');
  });

  it('are none when the copy brings none', () => {
    expect(cleanPrefs(undefined, state())).toBeNull();
    expect(cleanPrefs('prefs', state())).toBeNull();
    expect(cleanPrefs([], state())).toBeNull();
  });
});

describe('reading a backup', () => {
  it('replaces the progress and, if asked to, the preferences', () => {
    play();
    const copy = JSON.parse(JSON.stringify(backupOf(state(), NOW - 10 * DAY)));
    useStore.setState(fresh, true);
    useStore.setState({ stats: { 'loc:PT': [1, 1, 1, 5] }, palette: 'slate' });

    expect(state().importData(copy, null, NOW)).toBe(true);
    expect(Object.keys(state().stats)).toHaveLength(4);
    expect(state().notes).toEqual({ 'ES-AN': 'La del sur' });
    // The preferences of this browser stay.
    expect(state()).toMatchObject({ palette: 'slate', miles: false, reviewPace: 'normal', theme: 'auto' });

    expect(state().importData(copy, cleanPrefs(copy.prefs, state()), NOW)).toBe(true);
    expect(state()).toMatchObject({ palette: 'ocean', miles: true, reviewPace: 'long', reviewSize: 50, theme: 'dark', nick: 'Ana' });
    expect(state().opts).toMatchObject({ answer: 'choice', cityCount: 50 });
  });

  it('notes that what is here is the file: the last copy is the one that was read', () => {
    play();
    const copy = JSON.parse(JSON.stringify(backupOf(state(), NOW - 10 * DAY)));
    useStore.setState(fresh, true);
    state().importData(copy, null, NOW);
    expect(state().backup).toEqual({ at: NOW - 10 * DAY, from: NOW, q: 420 });
    // A copy that does not say when it was made counts from now.
    state().importData({ stats: {}, sessions: [] }, null, NOW + 5);
    expect(state().backup).toEqual({ at: NOW + 5, from: NOW + 5, q: 0 });
  });

  it('turns away what is not a copy, and leaves everything as it was', () => {
    play();
    const before = state().stats;
    expect(state().importData({ hello: 1 }, { palette: 'slate' }, NOW)).toBe(false);
    expect(state().stats).toBe(before);
    expect(state().palette).toBe('ocean');
  });
});

describe('the reminder of a backup', () => {
  const never = { at: 0, from: 0, q: 0 };

  it('waits for enough answers', () => {
    expect(BACKUP_EVERY_ANSWERS).toBe(300);
    expect(backupDue(never, 299, NOW)).toBe(false);
    expect(backupDue(never, 300, NOW)).toBe(true);
    expect(sinceBackup({ at: 5, from: 5, q: 100 }, 420)).toBe(320);
    // Progress that was wiped, or a copy of less: never a negative count.
    expect(sinceBackup({ at: 5, from: 5, q: 500 }, 420)).toBe(0);
  });

  it('waits for enough time since the last copy as well', () => {
    expect(BACKUP_EVERY_MS).toBe(14 * DAY);
    const mark = { at: NOW - 13 * DAY, from: NOW - 13 * DAY, q: 0 };
    expect(backupDue(mark, 5000, NOW)).toBe(false);
    expect(backupDue(mark, 5000, NOW + DAY)).toBe(true);
    expect(backupDue(mark, 200, NOW + DAY)).toBe(false);
  });

  it('counts from the copy that was just made, and from the moment it was put off', () => {
    play();
    expect(backupDue(state().backup, state().tot.q!, NOW)).toBe(true);
    state().markBackup(NOW);
    expect(state().backup).toEqual({ at: NOW, from: NOW, q: 420 });
    expect(backupDue(state().backup, 420, NOW + 30 * DAY)).toBe(false);
    expect(backupDue(state().backup, 720, NOW + 30 * DAY)).toBe(true);
    // Put off: the count starts again, the date of the last copy stays.
    useStore.setState({ tot: { ...state().tot, q: 720 } });
    state().snoozeBackup(NOW + 30 * DAY);
    expect(state().backup).toEqual({ at: NOW, from: NOW + 30 * DAY, q: 720 });
    expect(backupDue(state().backup, 720, NOW + 31 * DAY)).toBe(false);
  });

  it('starts over when the progress is wiped', () => {
    play();
    state().markBackup(NOW);
    state().resetProgress();
    expect(state().backup).toEqual(never);
  });

  it('is kept with the game, and cleaned when read', () => {
    expect(mergeSaved({}, state()).backup).toEqual(never);
    expect(mergeSaved({ backup: { at: 10, from: 20, q: 30 } }, state()).backup).toEqual({ at: 10, from: 20, q: 30 });
    expect(cleanBackupMark({ at: -1, from: 'x', q: Infinity })).toEqual(never);
    expect(cleanBackupMark('yesterday')).toEqual(never);
    expect(cleanBackupMark(null)).toEqual(never);
  });
});

describe('a backup as a file to send', () => {
  const takes = (types: string[]) => ({ canShare: (d: { files: File[] }) => d.files.every((f) => types.includes(f.type)) });

  it('goes as JSON where the system takes it', () => {
    const f = shareFile('{"a":1}', 'regionle-progreso-2026-11-19.json', takes(['application/json', 'text/plain']))!;
    expect(f.name).toBe('regionle-progreso-2026-11-19.json');
    expect(f.type).toBe('application/json');
    expect(f.size).toBe(7);
  });

  it('goes as a text file where only those are shared', () => {
    const f = shareFile('{"a":1}', 'regionle-progreso-2026-11-19.json', takes(['text/plain']))!;
    expect(f.name).toBe('regionle-progreso-2026-11-19.txt');
    expect(f.type).toBe('text/plain');
  });

  it('is not offered where files are not shared, or where asking fails', () => {
    expect(shareFile('{}', 'x.json', takes([]))).toBeNull();
    expect(shareFile('{}', 'x.json', {})).toBeNull();
    expect(shareFile('{}', 'x.json', undefined)).toBeNull();
    expect(
      shareFile('{}', 'x.json', {
        canShare: () => {
          throw new TypeError('no');
        },
      }),
    ).toBeNull();
  });
});
