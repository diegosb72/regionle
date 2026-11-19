import { afterEach, describe, expect, it } from 'vitest';
import { setLang } from '../lib/i18n';
import type { GameConfig, Opts } from '../lib/store';
import { DIPLOMA_FROM, DIPLOMA_NAME_MAX, diplomaName, diplomaOf, earnsDiploma, formatOf, tightness } from './diploma';

const game = (over: Partial<GameConfig> = {}, opts: Partial<Opts> = {}): GameConfig => ({ section: 'regions', mode: 'pin', countries: ['ES'], levels: { ES: 'g1' }, opts: { format: 'normal', ...opts } as Opts, nonce: 1, ...over });

afterEach(() => setLang('es'));

describe('whether a game earns a diploma', () => {
  it('asks for half of it right, counting an answer with help as half', () => {
    expect(DIPLOMA_FROM).toBe(50);
    expect(earnsDiploma(game(), { ok: 5, warn: 0, bad: 5 })).toBe(true);
    expect(earnsDiploma(game(), { ok: 4, warn: 0, bad: 6 })).toBe(false);
    expect(earnsDiploma(game(), { ok: 4, warn: 2, bad: 4 })).toBe(true);
    expect(earnsDiploma(game(), { ok: 0, warn: 10, bad: 0 })).toBe(true);
    expect(earnsDiploma(game(), { ok: 19, warn: 0, bad: 0 })).toBe(true);
  });

  it('gives none for a game with nothing asked, nor with no game at all', () => {
    expect(earnsDiploma(game(), { ok: 0, warn: 0, bad: 0 })).toBe(false);
    expect(earnsDiploma(null, { ok: 3, warn: 0, bad: 0 })).toBe(false);
    expect(earnsDiploma(undefined, { ok: 3, warn: 0, bad: 0 })).toBe(false);
  });

  it('gives none for a game that only asks what was missed or what is due', () => {
    const full = { ok: 3, warn: 0, bad: 0 };
    // Three misses asked again and found: the map was not gone through.
    expect(earnsDiploma(game({ only: ['ES-AN', 'ES-MD', 'ES-GA'] }), full)).toBe(false);
    expect(earnsDiploma(game({ review: true }), full)).toBe(false);
    // A list of one's own is a map of its own.
    expect(earnsDiploma(game({ only: ['ES-AN', 'ES-MD', 'ES-GA'], list: 'Mis tres' }), full)).toBe(true);
    // A game received by link is played whole.
    expect(earnsDiploma(game({ challenge: { seed: 7 } }), full)).toBe(true);
  });
});

describe('how a game was played', () => {
  it('is the format chosen, where the game has formats', () => {
    expect(formatOf(game({}, { format: 'timed' }))).toBe('timed');
    expect(formatOf(game({}, { format: 'exam' }))).toBe('exam');
    expect(formatOf(game({ mode: 'regionle' }, { format: 'timed' }))).toBe('normal');
    expect(formatOf(game({ challenge: { seed: 1 } }, { format: 'lives' }))).toBe('normal');
    expect(formatOf(game({ review: true }, { format: 'lives' }))).toBe('normal');
  });
});

describe('what a diploma says', () => {
  const day = '19 de noviembre de 2026';
  const site = 'diegosb72.github.io/regionle';

  it('names the map, the game, the answers and the day', () => {
    const d = diplomaOf(game(), 'España · comunidades autónomas', { ok: 17, warn: 2, bad: 0 }, 83_000, day, site);
    expect(d).toEqual({
      heading: 'Diploma',
      lead: 'Este diploma acredita que',
      did: 'ha completado',
      where: 'España · comunidades autónomas',
      what: 'Regiones · Señalar',
      score: '95 %',
      result: ['17 de 19 a la primera', '2 con ayuda', 'en 1:23'],
      day,
      dated: 'Fecha',
      sign: 'Firma',
      site,
    });
  });

  it('leaves out what there is nothing to say of', () => {
    const d = diplomaOf(game(), 'España · comunidades autónomas', { ok: 19, warn: 0, bad: 0 }, undefined, day, site);
    expect(d.result).toEqual(['19 de 19 a la primera']);
    expect(d.score).toBe('100 %');
  });

  it('says how the game was played when it was not the usual way', () => {
    expect(diplomaOf(game({}, { format: 'timed' }), 'España · provincias', { ok: 12, warn: 0, bad: 2 }, 60_000, day, site).what).toBe('Regiones · Señalar · Contrarreloj');
    expect(diplomaOf(game({}, { format: 'exam' }), 'España · provincias', { ok: 12, warn: 0, bad: 2 }, 60_000, day, site).what).toBe('Regiones · Señalar · Examen');
    expect(diplomaOf(game({}, { format: 'lives' }), 'España · provincias', { ok: 12, warn: 0, bad: 2 }, 60_000, day, site).what).toBe('Regiones · Señalar · Supervivencia');
  });

  it('names the game where there is no map to name', () => {
    const d = diplomaOf(game({ section: 'pops', mode: 'hilo', countries: [] }), undefined, { ok: 8, warn: 0, bad: 2 }, undefined, day, site);
    expect(d.where).toBe('Mayor o menor');
    expect(d.what).toBe('Cifras');
    expect(d.score).toBe('80 %');
  });

  it('is written in English too', () => {
    setLang('en');
    const d = diplomaOf(game(), 'Spain · autonomous communities', { ok: 17, warn: 2, bad: 0 }, 83_000, '19 November 2026', site);
    expect([d.lead, d.did, d.what, d.dated, d.sign]).toEqual(['This is to certify that', 'has completed', 'Regions · Pin it', 'Date', 'Signature']);
    expect(d.result).toEqual(['17 of 19 right first time', '2 with help', 'in 1:23']);
  });
});

describe('the name on a diploma', () => {
  it('is tidied, not changed', () => {
    expect(diplomaName('  Ana   García  López ')).toBe('Ana García López');
    expect(diplomaName('Íñigo Núñez-O’Brien')).toBe('Íñigo Núñez-O’Brien');
    expect(diplomaName('   ')).toBe('');
  });

  it('is no longer than it has room for', () => {
    const long = `${'María '.repeat(20)}`;
    expect(diplomaName(long).length).toBeLessThanOrEqual(DIPLOMA_NAME_MAX);
    expect(diplomaName(long).endsWith(' ')).toBe(false);
  });

  it('shrinks by how much longer it is than its line', () => {
    expect(tightness('Ana García', 26)).toBe(0);
    expect(tightness('María del Carmen Rodríguez Fernández', 26)).toBe(1);
    expect(tightness('María del Carmen Rodríguez-Fernández de la Vega y Ruiz', 26)).toBe(2);
    expect(tightness('', 26)).toBe(0);
  });
});
