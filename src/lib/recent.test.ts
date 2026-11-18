import { beforeEach, describe, expect, it } from 'vitest';
import { RECENT_MAX, isRecent, recentConfig, recentKey, recentOf, withRecent, type Recent } from './recent';
import { DEFAULT_OPTS, useStore, type GameConfig, type SessionRec } from './store';

const game = (patch: Partial<GameConfig> = {}): GameConfig => ({ section: 'regions', mode: 'pin', countries: ['ES'], levels: { ES: 'f', FR: 'g1' }, opts: DEFAULT_OPTS, nonce: 1, ...patch });
const session = (patch: Partial<SessionRec> = {}): SessionRec => ({ t: 1000, section: 'regions', mode: 'pin', label: 'España', total: 52, ok: 40, warn: 2, bad: 10, ms: 90_000, ...patch });

describe('what is kept of a game to play it again', () => {
  it('is its map and its game, with the levels of its countries only', () => {
    expect(recentOf(game(), session())).toEqual({ t: 1000, section: 'regions', mode: 'pin', countries: ['ES'], levels: { ES: 'f' }, o: { format: 'normal' }, ok: 40, total: 52 });
  });

  it('keeps no levels where the map is not one of regions', () => {
    expect(recentOf(game({ section: 'countries', mode: 'flag', countries: ['ES', 'FR'] }), session({ section: 'countries', mode: 'flag' }))?.levels).toEqual({});
    expect(recentOf(game({ section: 'pops', mode: 'hilo', countries: ['ES', 'FR'] }), session({ section: 'pops', mode: 'hilo' }))?.levels).toEqual({});
  });

  it('keeps the options that make it that game, each only where it counts', () => {
    const cities = recentOf(game({ section: 'cities', mode: 'identify', opts: { ...DEFAULT_OPTS, cityPick: 'top', cityCount: 50, format: 'lives' } }), session({ section: 'cities', mode: 'identify' }));
    expect(cities?.o).toEqual({ cityPick: 'top', cityCount: 50, format: 'lives' });
    // How many cities says nothing when the capitals are what is played.
    const caps = recentOf(game({ section: 'cities', mode: 'blind', opts: { ...DEFAULT_OPTS, cityPick: 'caps', cityCount: 50 } }), session({ section: 'cities', mode: 'blind' }));
    expect(caps?.o).toEqual({ cityPick: 'caps' });
    const pops = recentOf(game({ section: 'pops', mode: 'hilo', countries: ['ES', 'FR'], opts: { ...DEFAULT_OPTS, metric: 'area' } }), session({ section: 'pops', mode: 'hilo' }));
    expect(pops?.o).toEqual({ metric: 'area' });
    const flags = recentOf(game({ section: 'countries', mode: 'pin', countries: ['ES', 'FR'], opts: { ...DEFAULT_OPTS, pinBy: 'flag', format: 'timed' } }), session({ section: 'countries' }));
    expect(flags?.o).toEqual({ pinBy: 'flag', format: 'timed' });
    // Nothing of how one likes to answer: that is today's taste when it is played again.
    expect(Object.keys(recentOf(game({ mode: 'nameall' }), session({ mode: 'nameall' }))!.o)).toEqual([]);
  });

  it('keeps which way five places are put in order, and the countdown of a map filled in against it', () => {
    const ns = recentOf(game({ mode: 'compass' }), session({ mode: 'compass' }));
    expect(ns?.o).toEqual({ axis: 'ns' });
    const we = recentOf(game({ mode: 'compass', opts: { ...DEFAULT_OPTS, axis: 'we' } }), session({ mode: 'compass' }));
    expect(we?.o).toEqual({ axis: 'we' });
    // North to south and west to east are two games on the same map.
    expect(recentKey(ns!)).not.toBe(recentKey(we!));
    const timed = recentOf(game({ mode: 'nameall', opts: { ...DEFAULT_OPTS, countdown: 300 } }), session({ mode: 'nameall' }));
    expect(timed?.o).toEqual({ countdown: 300 });
    expect(recentKey(timed!)).not.toBe(recentKey(recentOf(game({ mode: 'nameall' }), session({ mode: 'nameall' }))!));
    // The way round is of that game only.
    expect(recentOf(game({ mode: 'pin', opts: { ...DEFAULT_OPTS, axis: 'we', countdown: 300 } }), session())?.o).toEqual({ format: 'normal' });
  });

  it('keeps the figure of a game about countries, which true or false does not have', () => {
    const top = recentOf(game({ section: 'pops', mode: 'topten', countries: ['ES', 'FR'], opts: { ...DEFAULT_OPTS, metric: 'density' } }), session({ section: 'pops', mode: 'topten' }));
    expect(top?.o).toEqual({ metric: 'density' });
    const tf = recentOf(game({ section: 'pops', mode: 'truefalse', countries: ['ES', 'FR'], opts: { ...DEFAULT_OPTS, metric: 'density' } }), session({ section: 'pops', mode: 'truefalse' }));
    expect(tf?.o).toEqual({});
  });

  it('is nothing for a review, a challenge, a round of misses, a list or the editor of lists', () => {
    expect(recentOf(game({ review: true, only: ['ES-M'] }), session())).toBeNull();
    expect(recentOf(game({ challenge: { seed: 7 } }), session())).toBeNull();
    expect(recentOf(game({ only: ['ES-M', 'ES-B'] }), session())).toBeNull();
    expect(recentOf(game({ only: ['ES-M'], list: 'Examen' }), session())).toBeNull();
    expect(recentOf(game({ mode: 'edit', listId: 'x' }), session({ mode: 'edit' }))).toBeNull();
    expect(recentOf(game({ daily: '2026-11-17' }), session())).toBeNull();
    // A session that is not of the game in course says nothing about it.
    expect(recentOf(game(), session({ mode: 'identify' }))).toBeNull();
  });

  it('tells two games apart by game, map, level and what makes the game, not by the order of the countries', () => {
    const a = recentOf(game({ countries: ['ES', 'FR'] }), session())!;
    const b = recentOf(game({ countries: ['FR', 'ES'] }), session({ t: 2000 }))!;
    expect(recentKey(a)).toBe(recentKey(b));
    expect(recentKey(recentOf(game({ countries: ['ES', 'FR'], levels: { ES: 'g1', FR: 'g1' } }), session())!)).not.toBe(recentKey(a));
    expect(recentKey(recentOf(game({ countries: ['ES', 'FR'], mode: 'identify' }), session({ mode: 'identify' }))!)).not.toBe(recentKey(a));
    expect(recentKey(recentOf(game({ countries: ['ES', 'FR'], opts: { ...DEFAULT_OPTS, format: 'timed' } }), session())!)).not.toBe(recentKey(a));
  });

  it('puts the last one first, moves up one played again and keeps a handful', () => {
    const of = (id: string, t: number): Recent => recentOf(game({ countries: [id] }), session({ t }))!;
    let list: Recent[] = [];
    for (const [i, id] of ['ES', 'FR', 'IT', 'ES'].entries()) list = withRecent(list, of(id, i));
    expect(list.map((r) => [r.countries[0], r.t])).toEqual([['ES', 3], ['IT', 2], ['FR', 1]]);
    for (const [i, id] of ['PT', 'DE', 'GB', 'IE', 'NL'].entries()) list = withRecent(list, of(id, 10 + i));
    expect(list).toHaveLength(RECENT_MAX);
    expect(list.map((r) => r.countries[0])).toEqual(['NL', 'IE', 'GB', 'DE', 'PT', 'ES']);
  });

  it('starts again as the same game, with the rest as it is liked today', () => {
    const r = recentOf(game({ section: 'cities', mode: 'identify', opts: { ...DEFAULT_OPTS, cityPick: 'regcaps', format: 'timed', answer: 'choice' } }), session({ section: 'cities', mode: 'identify' }))!;
    const cfg = recentConfig(r, { ...DEFAULT_OPTS, answer: 'type', suggest: true, cityPick: 'top', format: 'normal' });
    expect(cfg).toMatchObject({ section: 'cities', mode: 'identify', countries: ['ES'], levels: {} });
    expect(cfg.opts).toMatchObject({ cityPick: 'regcaps', format: 'timed', answer: 'type', suggest: true });
    expect(cfg.only).toBeUndefined();
  });

  it('drops what storage holds that is not one of these', () => {
    expect(isRecent(recentOf(game(), session()))).toBe(true);
    expect(isRecent(null)).toBe(false);
    expect(isRecent({ t: 1, section: 'regions', mode: 'pin', countries: [], levels: {}, o: {}, ok: 0, total: 0 })).toBe(false);
    expect(isRecent({ t: 1, section: 'regions', mode: 'pin', countries: ['ES'], o: {}, ok: 0, total: 0 })).toBe(false);
    expect(isRecent({ t: 1, section: 'regions', mode: 'pin', countries: [3], levels: {}, o: {}, ok: 0, total: 0 })).toBe(false);
    // A section the game does not have: nothing could be said of it, nor started.
    expect(isRecent({ t: 1, section: 'oceans', mode: 'pin', countries: ['ES'], levels: {}, o: {}, ok: 0, total: 0 })).toBe(false);
    expect(isRecent({ t: 1, section: 'toString', mode: 'pin', countries: ['ES'], levels: {}, o: {}, ok: 0, total: 0 })).toBe(false);
  });
});

describe('the saved state keeps the maps played lately', () => {
  beforeEach(() => {
    useStore.setState({ game: null, sessions: [], recent: [], tot: {}, opts: DEFAULT_OPTS, sel: { ...useStore.getState().sel, regions: ['ES'] }, levels: {}, mode: { ...useStore.getState().mode, regions: 'pin' } });
  });

  it('adds the game in course when it ends, and not a review', () => {
    const st = useStore.getState();
    st.start({ section: 'regions', mode: 'identify', countries: ['FR'], levels: { FR: 'f' }, opts: DEFAULT_OPTS });
    useStore.getState().addSession(session({ mode: 'identify', label: 'Francia', ok: 80, total: 96 }));
    expect(useStore.getState().recent).toMatchObject([{ section: 'regions', mode: 'identify', countries: ['FR'], levels: { FR: 'f' }, ok: 80, total: 96 }]);
    useStore.getState().start({ section: 'regions', mode: 'pin', countries: ['ES'], levels: {}, opts: DEFAULT_OPTS, only: ['ES-M'], review: true });
    useStore.getState().addSession(session());
    expect(useStore.getState().recent).toHaveLength(1);
    expect(useStore.getState().sessions).toHaveLength(2);
  });

  it('starts one again and leaves the menus of its section as they were for it', () => {
    const r = recentOf(game({ countries: ['FR', 'IT'], mode: 'capital', levels: { FR: 'f' }, opts: { ...DEFAULT_OPTS, format: 'lives' } }), session({ mode: 'capital' }))!;
    useStore.getState().resume(r);
    const s = useStore.getState();
    expect(s.game).toMatchObject({ section: 'regions', mode: 'capital', countries: ['FR', 'IT'], levels: { FR: 'f' } });
    expect(s.game?.opts.format).toBe('lives');
    expect(s.game?.nonce).toBeGreaterThan(0);
    expect(s.sel.regions).toEqual(['FR', 'IT']);
    expect(s.mode.regions).toBe('capital');
    expect(s.levels.FR).toBe('f');
    expect(s.opts.format).toBe('lives');
    // The other sections are left alone.
    expect(s.sel.countries.length).toBeGreaterThan(2);
  });

  it('puts away a list in use in that section, and no other', () => {
    useStore.setState({ listOn: { regions: 'a', cities: 'b' } });
    useStore.getState().resume(recentOf(game(), session())!);
    expect(useStore.getState().listOn).toEqual({ cities: 'b' });
  });

  it('brings them back from a backup, and keeps its own when the backup is from before', () => {
    const mine = recentOf(game(), session())!;
    const theirs = recentOf(game({ countries: ['FR'] }), session({ t: 5000 }))!;
    useStore.setState({ recent: [mine] });
    expect(useStore.getState().importData({ stats: {}, sessions: [] })).toBe(true);
    expect(useStore.getState().recent).toEqual([mine]);
    expect(useStore.getState().importData({ stats: {}, sessions: [], recent: [theirs, 'junk', { t: 1 }] })).toBe(true);
    expect(useStore.getState().recent).toEqual([theirs]);
  });

  it('forgets them with the rest of the progress', () => {
    useStore.getState().start({ section: 'regions', mode: 'pin', countries: ['ES'], levels: {}, opts: DEFAULT_OPTS });
    useStore.getState().addSession(session());
    expect(useStore.getState().recent).toHaveLength(1);
    useStore.getState().resetProgress();
    expect(useStore.getState().recent).toEqual([]);
  });
});
