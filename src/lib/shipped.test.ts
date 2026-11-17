// What the game ships with is a file like the one the settings export: one of those can take its place.

import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

/** The game as it would be with this file in the place of `typeins.default.json`. */
async function shippingWith(file: unknown) {
  vi.resetModules();
  vi.doMock('./typeins.default.json', () => ({ default: file }));
  const typeins = await import('./typeins');
  const data = await import('./data');
  const text = await import('./text');
  const i18n = await import('./i18n');
  i18n.setLang('es');
  data.setLoader(async (p) => JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/data', p), 'utf8')));
  const states = async () => new text.Matcher((await data.buildDeck({ scope: 'regions', countries: ['US'], levels: { US: 'f' } })).items);
  return { ...typeins, states, deck: () => data.buildDeck({ scope: 'regions', countries: ['US'], levels: { US: 'f' } }) };
}

afterEach(() => {
  vi.doUnmock('./typeins.default.json');
  vi.resetModules();
});

describe('a file exported from the settings as the one the game ships with', () => {
  it('makes its choices the way the game comes', async () => {
    // Exported by someone who added MA, switched NH off and RI back on.
    const g = await shippingWith({ app: 'regionle', kind: 'typeins', version: 1, auto: true, edits: { 'US-MA': { add: ['MA'] }, 'US-NH': { off: ['nh'] }, 'US-RI': { add: ['RI'] } } });
    expect(g.SHIPPED).toEqual({ 'US-MA': { add: ['MA'] }, 'US-NH': { off: ['nh'] }, 'US-RI': { add: ['RI'] } });
    expect(g.SHIPPED_AUTO).toBe(true);
    const m = await g.states();
    expect(m.lookup('ma')).toEqual(['US-MA']);
    expect(m.lookup('nh')).toEqual([]);
    expect(m.lookup('ri')).toEqual(['US-RI']);
    expect(m.lookup('nj')).toEqual(['US-NJ']);
    // The settings show them as part of the game, and the player has changed nothing.
    const byId = (await g.deck()).byId;
    const chips = (id: string, settings = g.getTypeins()) => g.chipsOf(byId.get(id)!, id, settings).map((c) => `${c.text}:${c.from}:${c.on ? 'on' : 'off'}`);
    expect(chips('US-MA')).toEqual(['MA:data:on']);
    expect(chips('US-NH')).toEqual(['NH:initials:off']);
    expect(chips('US-RI')).toEqual(['RI:initials:on']);
    expect(g.typeinFile().edits).toEqual(g.SHIPPED);
    expect(g.readTypeinFile(g.typeinFile())).toEqual({ edits: {}, auto: true });
    // Each one is still the player's to change.
    let edits = g.switchForm({}, 'US-MA', g.chipsOf(byId.get('US-MA')!, 'US-MA')[0], false);
    edits = g.switchForm(edits, 'US-NH', g.chipsOf(byId.get('US-NH')!, 'US-NH')[0], true);
    expect(edits).toEqual({ 'US-MA': { off: ['ma'] }, 'US-NH': { add: ['NH'] } });
    g.setTypeins({ edits });
    const mine = await g.states();
    expect(mine.lookup('ma')).toEqual([]);
    expect(mine.lookup('nh')).toEqual(['US-NH']);
    expect(chips('US-MA')).toEqual(['MA:data:off']);
  });

  it('ships without automatic initials when the file says so', async () => {
    const g = await shippingWith({ app: 'regionle', kind: 'typeins', version: 1, auto: false, edits: { 'US-NJ': { add: ['NJ'] } } });
    expect(g.SHIPPED_AUTO).toBe(false);
    // Nothing chosen: as the game ships.
    g.setTypeins({});
    expect(g.getTypeins().auto).toBe(false);
    const m = await g.states();
    expect(m.lookup('ny')).toEqual([]);
    expect(m.lookup('nj')).toEqual(['US-NJ']);
    expect(m.lookup('dc')).toEqual(['US-DC']);
    // The player can have them back.
    g.setTypeins({ auto: true });
    expect((await g.states()).lookup('ny')).toEqual(['US-NY']);
  });

  it('reads the choices alone, and ships with nothing when the file is empty or is not one', async () => {
    const bare = await shippingWith({ 'US-RI': { off: ['RI'] } });
    expect(bare.SHIPPED).toEqual({ 'US-RI': { off: ['ri'] } });
    expect(bare.SHIPPED_AUTO).toBe(true);
    for (const file of [{}, [], null, { app: 'regionle', kind: 'typeins', version: 1, auto: true, edits: {} }]) {
      const g = await shippingWith(file);
      expect(g.SHIPPED, JSON.stringify(file)).toEqual({});
      expect(g.SHIPPED_AUTO).toBe(true);
      // Without the line that ships today, RI is Rhode Island like any other initials.
      expect((await g.states()).lookup('ri')).toEqual(['US-RI']);
    }
  });
});
