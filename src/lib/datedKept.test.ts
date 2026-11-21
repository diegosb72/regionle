import { beforeEach, describe, expect, it } from 'vitest';
import { backupOf } from './backup';
import { WEEKS_KEPT, ZONES_KEPT, cleanWeekly, cleanZones, isWeek, isZone, withWeek, withZone, type DatedResult, type WeekRec, type ZoneRec } from './datedKept';
import { mergeSaved, useStore } from './store';

const result = (patch: Partial<DatedResult> = {}): DatedResult => ({ s: 86, ok: 41, n: 50, ms: 252_000, ...patch });
const week = (patch: Partial<WeekRec> = {}): WeekRec => ({ ...result(), t: 1_763_600_000_000, ...patch });
const zone = (patch: Partial<ZoneRec> = {}): ZoneRec => ({ d: '2026-11-20', s: 90, ok: 9, n: 10, ms: 60_000, run: 1, ...patch });
/** The Monday `k` weeks after that of 16 November 2026. */
const monday = (k: number): string => new Date(Date.UTC(2026, 10, 16) + k * 7 * 86_400_000).toISOString().slice(0, 10);

describe('what names a week and a zone', () => {
  it('takes for a week a Monday that exists, and nothing else', () => {
    expect(isWeek('2026-11-16')).toBe(true);
    expect(isWeek('2026-11-17')).toBe(false);
    expect(isWeek('2026-11-15')).toBe(false);
    expect(isWeek('2026-13-01')).toBe(false);
    expect(isWeek('2026-02-30')).toBe(false);
    expect(isWeek('16-11-2026')).toBe(false);
    expect(isWeek(20261116)).toBe(false);
    expect(isWeek(null)).toBe(false);
  });

  it('takes for a zone a continent or a country, each with its mark: AF is a continent and a country', () => {
    expect(isZone('p:AF')).toBe(true);
    expect(isZone('c:AF')).toBe(true);
    expect(isZone('c:X1')).toBe(true);
    expect(isZone('AF')).toBe(false);
    expect(isZone('c:es')).toBe(false);
    expect(isZone('p:EUR')).toBe(false);
    expect(isZone('x:ES')).toBe(false);
    expect(isZone(undefined)).toBe(false);
  });
});

describe('the results of the weeks', () => {
  it('keeps the first result of a week: playing it again changes nothing', () => {
    const one = withWeek({}, '2026-11-16', result(), 5);
    expect(one).toEqual({ '2026-11-16': week({ t: 5 }) });
    expect(withWeek(one, '2026-11-16', result({ s: 100 }), 9)).toBe(one);
    expect(withWeek(one, '2026-11-23', result({ s: 70 }), 9)).toEqual({ '2026-11-16': week({ t: 5 }), '2026-11-23': week({ s: 70, t: 9 }) });
  });

  it('takes no result for a day that is not a Monday, nor one that is not a result', () => {
    const none = {};
    expect(withWeek(none, '2026-11-17', result(), 1)).toBe(none);
    expect(withWeek(none, '2026-11-16', result({ s: 101 }), 1)).toBe(none);
    expect(withWeek(none, '2026-11-16', result({ n: 0 }), 1)).toBe(none);
    expect(withWeek(none, '2026-11-16', result({ ok: 51 }), 1)).toBe(none);
    expect(withWeek(none, '2026-11-16', result({ ms: Number.NaN }), 1)).toBe(none);
    expect(withWeek(none, '2026-11-16', result({ s: -1 }), 1)).toBe(none);
  });

  it('drops from what storage holds whatever is not a week with its result, and keeps the latest weeks', () => {
    expect(cleanWeekly(null)).toEqual({});
    expect(cleanWeekly('x')).toEqual({});
    expect(cleanWeekly([week()])).toEqual({});
    expect(cleanWeekly({ '2026-11-16': week(), '2026-11-17': week(), '2026-11-23': { s: 'x' }, nothing: week(), '2026-11-09': null, '2026-11-02': result(), '2026-11-30': week({ s: 55.4, ms: 1000.6 }) })).toEqual({
      '2026-11-16': week(),
      '2026-11-30': week({ s: 55, ms: 1001 }),
    });
    const many = Object.fromEntries(Array.from({ length: WEEKS_KEPT + 5 }, (_, k) => [monday(k), week({ s: k % 100 })]));
    const kept = Object.keys(cleanWeekly(many)).sort();
    expect(kept).toHaveLength(WEEKS_KEPT);
    expect(kept[0]).toBe(monday(5));
    expect(kept[kept.length - 1]).toBe(monday(WEEKS_KEPT + 4));
  });
});

describe('the last day of each zone', () => {
  it('writes down the first time a day is finished, and starts counting the days in a row', () => {
    const one = withZone({}, 'p:EU', '2026-11-20', result({ s: 90, ok: 9, n: 10, ms: 60_000 }));
    expect(one).toEqual({ 'p:EU': zone() });
    // The same day again: nothing changes.
    expect(withZone(one, 'p:EU', '2026-11-20', result({ s: 100, ok: 10, n: 10 }))).toBe(one);
  });

  it('goes on with the days in a row when the last one was the day before, and starts again after a gap', () => {
    let zones = withZone({}, 'c:ES', '2026-11-20', result({ n: 50 }));
    zones = withZone(zones, 'c:ES', '2026-11-21', result({ s: 70 }));
    expect(zones['c:ES']).toMatchObject({ d: '2026-11-21', s: 70, run: 2 });
    zones = withZone(zones, 'c:ES', '2026-11-22', result());
    expect(zones['c:ES'].run).toBe(3);
    // A day missed: the run starts again.
    zones = withZone(zones, 'c:ES', '2026-11-24', result());
    expect(zones['c:ES']).toMatchObject({ d: '2026-11-24', run: 1 });
    // Across the end of a month.
    zones = withZone(withZone({}, 'c:ES', '2026-11-30', result()), 'c:ES', '2026-12-01', result());
    expect(zones['c:ES'].run).toBe(2);
  });

  it('keeps each zone apart: the same two letters name a continent and a country', () => {
    let zones = withZone({}, 'p:AF', '2026-11-20', result({ s: 50 }));
    zones = withZone(zones, 'c:AF', '2026-11-20', result({ s: 80 }));
    expect(zones['p:AF'].s).toBe(50);
    expect(zones['c:AF'].s).toBe(80);
  });

  it('takes nothing for a day before the last one kept, for what is not a zone or a day, nor for what is not a result', () => {
    const one = withZone({}, 'p:EU', '2026-11-20', result());
    expect(withZone(one, 'p:EU', '2026-11-19', result({ s: 100 }))).toBe(one);
    expect(withZone(one, 'EU', '2026-11-21', result())).toBe(one);
    expect(withZone(one, 'p:EU', '2026-11-31', result())).toBe(one);
    expect(withZone(one, 'p:EU', '2026-11-21', result({ s: 120 }))).toBe(one);
    expect(withZone(one, 'p:EU', '2026-11-21', result({ ok: 99, n: 10 }))).toBe(one);
  });

  it('drops from what storage holds whatever is not a zone with its last day, and keeps those played latest', () => {
    expect(cleanZones(null)).toEqual({});
    expect(cleanZones([zone()])).toEqual({});
    expect(
      cleanZones({ 'p:EU': zone(), ES: zone(), 'c:ES': zone({ d: '2026-02-30' }), 'c:FR': zone({ run: 0 }), 'c:IT': { d: '2026-11-20' }, 'c:PT': null, 'c:DE': zone({ s: 55.4, run: 3.2 }), 'c:JP': { ...zone(), extra: 1 } }),
    ).toEqual({ 'p:EU': zone(), 'c:DE': zone({ s: 55, run: 3 }), 'c:JP': zone() });
    // More zones than are kept: the ones played longest ago go, whatever order they came in.
    const day = (k: number) => new Date(Date.UTC(2026, 0, 1) + k * 86_400_000).toISOString().slice(0, 10);
    const ids = Array.from({ length: ZONES_KEPT + 6 }, (_, k) => `c:${String.fromCharCode(65 + Math.floor(k / 26))}${String.fromCharCode(65 + (k % 26))}`);
    const many = Object.fromEntries(ids.map((id, k) => [id, zone({ d: day(k) })]));
    const kept = cleanZones(many);
    expect(Object.keys(kept)).toHaveLength(ZONES_KEPT);
    expect(kept[ids[5]]).toBeUndefined();
    expect(kept[ids[6]]).toBeDefined();
    expect(Object.keys(cleanZones(Object.fromEntries(Object.entries(many).reverse()))).sort()).toEqual(Object.keys(kept).sort());
  });
});

describe('the saved state keeps the weeks and the zones', () => {
  beforeEach(() => {
    useStore.setState({ weekly: {}, zones: {} });
  });

  it('writes down a week once, and says whether it did', () => {
    expect(useStore.getState().setWeekly('2026-11-16', result())).toBe(true);
    expect(useStore.getState().setWeekly('2026-11-16', result({ s: 100 }))).toBe(false);
    expect(useStore.getState().setWeekly('2026-11-18', result())).toBe(false);
    expect(useStore.getState().weekly['2026-11-16']).toMatchObject(result());
    expect(Object.keys(useStore.getState().weekly)).toEqual(['2026-11-16']);
  });

  it('writes down a day of a zone once, and says whether it did', () => {
    expect(useStore.getState().setZone('c:ES', '2026-11-20', result())).toBe(true);
    expect(useStore.getState().setZone('c:ES', '2026-11-20', result({ s: 100 }))).toBe(false);
    expect(useStore.getState().setZone('c:ES', '2026-11-21', result({ s: 100 }))).toBe(true);
    expect(useStore.getState().zones).toEqual({ 'c:ES': { d: '2026-11-21', ...result({ s: 100 }), run: 2 } });
  });

  it('reads them from what the browser kept, without what is not a week or a zone; a browser from before has none', () => {
    const state = useStore.getState();
    const read = mergeSaved({ weekly: { '2026-11-16': week(), '2026-11-17': week(), junk: 1 }, zones: { 'c:ES': zone({ run: 5 }), ES: zone(), 'p:EU': 'x' } }, state);
    expect(read.weekly).toEqual({ '2026-11-16': week() });
    expect(read.zones).toEqual({ 'c:ES': zone({ run: 5 }) });
    expect(mergeSaved({}, state).weekly).toEqual({});
    expect(mergeSaved({}, state).zones).toEqual({});
    expect(mergeSaved({ weekly: 'x', zones: [zone()] }, state)).toMatchObject({ weekly: {}, zones: {} });
  });

  it('sends them in the backup, and a browser that reads it has them as they were', () => {
    useStore.getState().setWeekly('2026-11-16', result());
    useStore.getState().setZone('c:ES', '2026-11-20', result({ s: 70 }));
    useStore.getState().setZone('c:ES', '2026-11-21', result({ s: 90 }));
    const copy = JSON.parse(JSON.stringify(backupOf(useStore.getState(), 1_763_700_000_000))) as Record<string, unknown>;
    expect(copy.weekly).toEqual(useStore.getState().weekly);
    expect(copy.zones).toEqual({ 'c:ES': { d: '2026-11-21', ...result({ s: 90 }), run: 2 } });
    useStore.setState({ weekly: {}, zones: {} });
    expect(useStore.getState().importData(copy)).toBe(true);
    expect(useStore.getState().weekly).toEqual(copy.weekly);
    expect(useStore.getState().zones).toEqual(copy.zones);
  });

  it('brings them back from a backup, keeps its own when the backup is from before, and forgets them with the progress', () => {
    useStore.getState().setWeekly('2026-11-16', result());
    useStore.getState().setZone('p:EU', '2026-11-20', result());
    // A copy from before these challenges says nothing about them.
    expect(useStore.getState().importData({ stats: {}, sessions: [] })).toBe(true);
    expect(Object.keys(useStore.getState().weekly)).toEqual(['2026-11-16']);
    expect(Object.keys(useStore.getState().zones)).toEqual(['p:EU']);
    // A copy that has them replaces what there is, without what is not a week or a zone.
    expect(useStore.getState().importData({ stats: {}, sessions: [], weekly: { '2026-11-09': week({ s: 70 }), '2026-11-10': week() }, zones: { 'c:FR': zone({ run: 4 }), FR: zone() } })).toBe(true);
    expect(useStore.getState().weekly).toEqual({ '2026-11-09': week({ s: 70 }) });
    expect(useStore.getState().zones).toEqual({ 'c:FR': zone({ run: 4 }) });
    useStore.getState().resetProgress();
    expect(useStore.getState().weekly).toEqual({});
    expect(useStore.getState().zones).toEqual({});
  });
});
