// Patterns: type-ins written the way the quizzes of JetPunk write them, which take more than one spelling.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { Matcher } from './matcher';
import { MAX_PATTERN, looksLikePattern, patternOf, type Answerable, type ShortEdit } from './text';
import { SHIPPED, addForm, chipsOf, cleanTypeins, editOf, formKey, inForce, readTypeinFile, ruleOf, setTypeins, switchForm, tidyForm, typeinFile, type Typeins } from './typeins';

// A game that ships with a list of its own for three things: patterns, spellings, and no initials unasked.
vi.mock('./typeins.default.json', () => ({
  default: {
    app: 'regionle',
    kind: 'typeins',
    version: 1,
    auto: true,
    edits: {
      'GE-SU': { add: ['r:^S[OU]KHUM', 'AQWA'] },
      'US-NH': { add: ['NH'], rule: false },
      'AU-NSW': { rule: false },
    },
  },
}));

/** Something with these names, the first of them the one on show, and what the settings say of it. */
const named = (id: string, short: ShortEdit | undefined, ...names: string[]): Answerable => ({ id, answers: names, proper: names, short });
const adds = (...add: string[]): ShortEdit => ({ add });
const AUTO = { auto: true, edits: {} as Typeins };

afterEach(() => setTypeins({}));

describe('a pattern as it is written', () => {
  it('is a regular expression after "r:", or letters to be found after "c:"', () => {
    expect(patternOf('r:^S[OU]KHUM')).toBe('r:^S[OU]KHUM');
    // Spaces say nothing: what is typed is tried with its letters run together.
    expect(patternOf('  R: ^(LA)? PAMPA ')).toBe('r:^(LA)?PAMPA');
    expect(patternOf('c:Capital  City')).toBe('c:CAPITALCITY');
    expect(patternOf('C:São José')).toBe('c:SAOJOSE');
    // The loose writing of the lists it comes from is taken as their author's browser took it.
    expect(patternOf('r:^PEL+S(E|OU]+S|[AEI]+N)')).toBe('r:^PEL+S(E|OU]+S|[AEI]+N)');
    expect(patternOf('r:^GORE(N[IJ]||[IJ]N)A')).toBe('r:^GORE(N[IJ]||[IJ]N)A');
  });

  it('is nothing when it cannot be read, or is not one', () => {
    for (const bad of ['r:^A(', 'r:[A-', 'r:', 'c:', 'c: … ', `r:${'A'.repeat(MAX_PATTERN + 1)}`]) expect(patternOf(bad), bad).toBeNull();
    for (const plain of ['Mass', 'NH', 'R.I.', 'rc', 'x:abc', '']) {
      expect(patternOf(plain), plain).toBeNull();
      expect(looksLikePattern(plain), plain).toBe(false);
    }
    expect(looksLikePattern('r:^A(')).toBe(true);
    expect(looksLikePattern(' C : capital')).toBe(true);
  });
});

describe('patterns in a game', () => {
  const abkhazia = [
    named('su', adds('r:^S[OU]KHUM', 'AQWA'), 'Sujumi', 'Sukhumi'),
    named('ga', undefined, 'Gagra'),
    named('gl', adds('GAL'), 'Gali'),
    named('gu', adds('r:^G[UW]D[AO][UW]TH?A'), 'Gudauta'),
  ];
  const m = new Matcher(abkhazia);

  it('takes what the pattern takes whole, whatever its case, accents and spaces', () => {
    for (const text of ['sukhum', 'Sokhum', 'SÓKHUM', ' so khum ', 'aqwa', 'Sukhumi', 'sujumi']) expect(m.lookup(text), text).toEqual(['su']);
    for (const text of ['gudauta', 'Gwdowtha', 'gudouta']) expect(m.lookup(text), text).toEqual(['gu']);
    expect(m.lookup('gal')).toEqual(['gl']);
    for (const text of ['sukh', 'khum', 'gud', 'x']) expect(m.lookup(text), text).toEqual([]);
  });

  it('takes what only sets the pattern off when nothing else explains it, as JetPunk does', () => {
    // Not whole, and no name: nothing is named outright.
    expect(m.lookup('sokhumi')).toEqual([]);
    expect(m.lookup('sokhum city')).toEqual([]);
    expect(m.loose('sokhum city')).toEqual(['su']);
    // On Enter a slip of the finger is tried first, and then the pattern.
    expect(m.find('sokhumi')).toEqual(['su']);
    expect(m.find('sokhum city')).toEqual(['su']);
    expect(m.check('sokhum city', 'su')).toEqual({ res: 'yes' });
    expect(m.check('sokhum city', 'ga')).toEqual({ res: 'other', id: 'su' });
    expect(m.check('gwdowtha district', 'gu')).toEqual({ res: 'yes' });
    expect(m.check('tkvarcheli', 'su')).toEqual({ res: 'no' });
  });

  it('asks for the name in full while letters of it are in sight', () => {
    expect(m.lookup('sokhum', { whole: true })).toEqual([]);
    expect(m.check('sokhum', 'su', { whole: true })).toEqual({ res: 'short' });
    expect(m.check('aqwa', 'su', { whole: true })).toEqual({ res: 'short' });
    expect(m.check('sokhum city', 'su', { whole: true })).toEqual({ res: 'short' });
    expect(m.find('sokhum city', { whole: true })).toEqual([]);
    expect(m.check('sukhumi', 'su', { whole: true })).toEqual({ res: 'yes' });
    // A slip in the name written out is still a slip.
    expect(m.check('sukhumy', 'su', { whole: true })).toEqual({ res: 'yes' });
    expect(m.check('sokhum city', 'ga', { whole: true })).toEqual({ res: 'no' });
  });

  it('knows what a pattern takes from a name', () => {
    expect(m.abbreviates('sokhum')).toBe(true);
    expect(m.abbreviates('aqwa')).toBe(true);
    expect(m.abbreviates('sokhum city')).toBe(true);
    expect(m.abbreviates('sukhumi')).toBe(false);
    // Near enough to the name to be a slip in it.
    expect(m.abbreviates('sukhumy')).toBe(false);
    expect(m.abbreviates('gagra')).toBe(false);
    expect(m.shortKinds(new Set(['su']))).toEqual({ initials: false, other: true });
    expect(m.shortKinds(new Set(['gl']))).toEqual({ initials: false, other: true });
    expect(m.shortKinds(new Set(['ga']))).toEqual({ initials: false, other: false });
    expect(new Matcher([named('nh', undefined, 'New Hampshire')]).shortKinds(new Set(['nh']))).toEqual({ initials: true, other: false });
  });

  it('puts the name written out before any pattern', () => {
    // The pattern of the second takes "ribnica" whole, as its author meant; here that is the name of the first.
    const slovenia = new Matcher([named('a', adds('r:^RE?I[BF]NI(CA|TZ)'), 'Ribnica'), named('b', adds('r:^RE?I[BF]NI(CA|G)'), 'Ribnica na Pohorju'), named('c', undefined, 'Ptuj')]);
    expect(slovenia.lookup('ribnica')).toEqual(['a']);
    expect(slovenia.check('ribnica', 'b')).toEqual({ res: 'other', id: 'a' });
    expect(slovenia.lookup('ribnica na pohorju')).toEqual(['b']);
    expect(slovenia.check('ribnica na pohorju', 'a')).toEqual({ res: 'other', id: 'b' });
    // What neither is called goes to whoever has a pattern for it: both, where both do.
    expect(slovenia.lookup('reifnitz')).toEqual(['a']);
    expect(slovenia.lookup('reifnig')).toEqual(['b']);
    expect(slovenia.lookup('rifnica')).toEqual(['a', 'b']);
    expect(slovenia.check('rifnica', 'a')).toEqual({ res: 'yes' });
    expect(slovenia.check('rifnica', 'b')).toEqual({ res: 'yes' });
  });

  it('tries a slip of the finger before a pattern that is only set off', () => {
    const cameroon = new Matcher([named('s', adds('r:^SOUTH', 'SUD'), 'Sur', 'South'), named('sw', undefined, 'Suroeste', 'Southwest'), named('n', undefined, 'Norte', 'North')]);
    expect(cameroon.lookup('south')).toEqual(['s']);
    expect(cameroon.lookup('southwest')).toEqual(['sw']);
    expect(cameroon.find('southwst')).toEqual(['sw']);
    expect(cameroon.check('southwst', 's')).toEqual({ res: 'other', id: 'sw' });
    expect(cameroon.find('southern region')).toEqual(['s']);
  });

  it('finds letters anywhere, and expressions that are tied to no end', () => {
    const maps = new Matcher([
      named('act', adds('c:CAPITAL'), 'Territorio de la Capital Australiana', 'Australian Capital Territory'),
      named('xj', adds('r:^XINJ[AEI]+NG', 'r:U[IY]+GH?[EU]R'), 'Sinkiang', 'Xinjiang'),
      named('tt', adds('r:^TRE?INTAY?TRES', '33'), 'Treinta y Tres'),
      named('wa', adds('r:^(THE)?171', 'c:south'), 'Región militar 171'),
      named('co', adds('r:^SANANDRES|PROVIDENC[EI]A|SANTACATALINA'), 'San Andrés y Providencia'),
    ]);
    expect(maps.lookup('capital')).toEqual(['act']);
    expect(maps.find('the capital territory')).toEqual(['act']);
    expect(maps.lookup('uyghur')).toEqual(['xj']);
    expect(maps.lookup('Uigur')).toEqual(['xj']);
    expect(maps.find('xinjiang uygur')).toEqual(['xj']);
    expect(maps.lookup('33')).toEqual(['tt']);
    expect(maps.lookup('treinta tres')).toEqual(['tt']);
    expect(maps.lookup('171')).toEqual(['wa']);
    expect(maps.lookup('the 171')).toEqual(['wa']);
    expect(maps.lookup('South')).toEqual(['wa']);
    expect(maps.find('wa south')).toEqual(['wa']);
    for (const text of ['san andres', 'Providencia', 'Santa Catalina', 'providencea']) expect(maps.lookup(text), text).toEqual(['co']);
  });

  it('passes over a pattern that cannot be read', () => {
    const odd = new Matcher([named('a', adds('r:^A(', 'r:', 'c:', 'r:^AB'), 'Abcde')]);
    expect(odd.lookup('ab')).toEqual(['a']);
    expect(odd.lookup('a(')).toEqual([]);
  });

  it('offers what a pattern takes among the suggestions', () => {
    expect(m.suggest('sokhum')[0]).toBe('su');
    expect(m.suggest('gwdow')).toEqual([]);
    expect(m.suggest('gwdowta')[0]).toBe('gu');
  });
});

describe('patterns where answers are taken as they are typed', () => {
  const spain = new Matcher([
    named('cm', adds('r:^(CASTIL+[AE])?(Y|AND)?(LA)?MANCHA'), 'Castilla-La Mancha'),
    named('cl', adds('r:^(CAST(I|E|IE)L+[AE])?(AND|Y|E)?L+[IE]ON'), 'Castilla y León', 'Castile and León'),
    named('pv', adds('r:^(THE|EL)?(PAIS)?[BV]AS(QU|C)[EO]'), 'País Vasco', 'Basque Country'),
    named('md', undefined, 'Comunidad de Madrid', 'Madrid'),
  ]);
  const all = new Set(['cm', 'cl', 'pv', 'md']);

  it('takes at once what a pattern takes whole and nothing could be going on from', () => {
    expect(spain.typed('mancha', all)).toEqual({ ids: ['cm'], wait: false });
    expect(spain.typed('la mancha', all)).toEqual({ ids: ['cm'], wait: false });
    expect(spain.typed('leon', all)).toEqual({ ids: ['cl'], wait: false });
    expect(spain.typed('vasco', all)).toEqual({ ids: ['pv'], wait: false });
    // The name written out, as ever.
    expect(spain.typed('pais vasco', all)).toEqual({ ids: ['pv'], wait: false });
  });

  it('waits for Enter where a name goes on from what was typed', () => {
    // "Basque" on the way to "Basque Country": taken there, the rest would be left in the field.
    expect(spain.typed('basque', all)).toEqual({ ids: ['pv'], wait: true });
    expect(spain.typed('basque country', all)).toEqual({ ids: ['pv'], wait: false });
    const emirates = new Matcher([named('rk', adds('r:^RA[SK]'), 'Ras al-Jaima', 'Ras Al Khaimah'), named('du', adds('r:^DUB[AE][IY]'), 'Dubái', 'Dubai')]);
    const open = new Set(['rk', 'du']);
    expect(emirates.typed('ras', open)).toEqual({ ids: ['rk'], wait: true });
    expect(emirates.typed('rak', open)).toEqual({ ids: ['rk'], wait: false });
    expect(emirates.typed('ras al khaimah', open)).toEqual({ ids: ['rk'], wait: false });
  });

  it('waits where what was typed reads like the beginning of its name with a slip in it', () => {
    const abkhazia = new Matcher([named('su', adds('r:^S[OU]KHUM'), 'Sujumi', 'Sukhumi'), named('ga', undefined, 'Gagra')]);
    const open = new Set(['su', 'ga']);
    // "Sokhum" on the way to "Sokhumi": the pattern takes it there, and the "i" would be left behind.
    expect(abkhazia.typed('sokhum', open)).toEqual({ ids: ['su'], wait: true });
    expect(abkhazia.typed('sukhum', open)).toEqual({ ids: ['su'], wait: true });
    expect(abkhazia.typed('sukhumi', open)).toEqual({ ids: ['su'], wait: false });
    // Nothing is named by "sokhumi", but Enter takes it: the game says so.
    expect(abkhazia.typed('sokhumi', open)).toEqual({ ids: [], wait: true });
    expect(abkhazia.find('sokhumi')).toEqual(['su']);
    expect(abkhazia.typed('sokhumi', new Set(['ga']))).toEqual({ ids: [], wait: false });
    expect(abkhazia.typed('gagr', open)).toEqual({ ids: [], wait: false });
    // The slip is behind, not in the letter just typed: "balears" is not on its way to "Baleares".
    const spain = new Matcher([named('ib', adds('r:^B[AEI]+L+[AEI]+R[AEI]?[SC]', 'r:^[CK]AAFU'), 'Islas Baleares', 'Baleares', 'Kaafu Atoll')]);
    expect(spain.typed('balears', new Set(['ib']))).toEqual({ ids: ['ib'], wait: false });
    expect(spain.typed('balearic', new Set(['ib']))).toEqual({ ids: ['ib'], wait: false });
    expect(spain.typed('caafu', new Set(['ib']))).toEqual({ ids: ['ib'], wait: true });
  });
});

describe('letters that are the name of one thing and short for another', () => {
  // The city of Győr is a piece of the map, and the list has the county answer to "Gyor" as well.
  const hungary = new Matcher([named('gy', undefined, 'Győr'), named('gs', { add: ['GYOR', 'MOSON'], rule: false }, 'Győr-Moson-Sopron'), named('bp', undefined, 'Budapest')]);
  const open = new Set(['gy', 'gs', 'bp']);

  it('names both, as the list says', () => {
    expect(hungary.lookup('gyor')).toEqual(['gy', 'gs']);
    expect(new Matcher([named('gs', { add: ['GYOR'], rule: false }, 'Győr-Moson-Sopron'), named('gy', undefined, 'Győr')]).lookup('gyor')).toEqual(['gy', 'gs']);
    expect(hungary.check('Győr', 'gy')).toEqual({ res: 'yes' });
    expect(hungary.check('Győr', 'gs')).toEqual({ res: 'yes' });
    // A name is no abbreviation, but for the thing it is short for.
    expect(hungary.abbreviates('gyor')).toBe(false);
    expect(hungary.abbreviates('gyor', 'gy')).toBe(false);
    expect(hungary.abbreviates('gyor', 'gs')).toBe(true);
    expect(hungary.shortKinds(new Set(['gs']))).toEqual({ initials: false, other: true });
    expect(hungary.shortKinds(new Set(['gy', 'bp']))).toEqual({ initials: false, other: false });
    // It is something the county answers to besides its name, even with nothing else that is.
    const bare = new Matcher([named('gy', undefined, 'Győr'), named('gs', { add: ['GYOR'], rule: false }, 'Győr-Moson-Sopron')]);
    expect(bare.shortKinds(new Set(['gs']))).toEqual({ initials: false, other: true });
    expect(bare.shortKinds(new Set(['gy']))).toEqual({ initials: false, other: false });
  });

  it('puts what is called so before what only answers to it, for a game that takes one answer', () => {
    // The capital comes first on the map, and answers to the name of the province around it.
    const dominican = new Matcher([
      named('dn', { add: ['SANTODOMINGO'], rule: false }, 'Distrito Nacional'),
      named('sd', { add: ['DISTRITONACIONAL'], rule: false }, 'Santo Domingo'),
      named('sc', undefined, 'San Cristóbal'),
    ]);
    expect(dominican.lookup('santo domingo')).toEqual(['sd', 'dn']);
    expect(dominican.find('Santo Domingo')[0]).toBe('sd');
    expect(dominican.find('distrito nacional')).toEqual(['dn', 'sd']);
    // A slip of the finger away from it, the same.
    expect(dominican.find('santo domigo')).toEqual(['sd', 'dn']);
    expect(dominican.find('distrito nacionall')).toEqual(['dn', 'sd']);
    // Asked about one of them, the other's name is right: the list says so. Not with letters in sight.
    expect(dominican.check('santo domingo', 'dn')).toEqual({ res: 'yes' });
    expect(dominican.check('santo domingo', 'dn', { whole: true })).toEqual({ res: 'short' });
    expect(dominican.check('santo domigo', 'dn', { whole: true })).toEqual({ res: 'other', id: 'sd' });
    expect(dominican.check('santo domingo', 'sc')).toEqual({ res: 'other', id: 'sd' });
    // Filling the map, both are taken at once: nothing goes on from there.
    expect(dominican.typed('santo domingo', new Set(['dn', 'sd', 'sc']))).toEqual({ ids: ['sd', 'dn'], wait: false });
  });

  it('waits for Enter while the longer name may be on its way', () => {
    expect(hungary.typed('gyor', open)).toEqual({ ids: ['gy', 'gs'], wait: true });
    expect(hungary.typed('gyor-moson-sopron', open)).toEqual({ ids: ['gs'], wait: false });
    expect(hungary.typed('moson', open)).toEqual({ ids: ['gs'], wait: false });
    // With the county found the city is taken as it is typed, like any name.
    expect(hungary.typed('gyor', new Set(['gy', 'bp']))).toEqual({ ids: ['gy'], wait: false });
    // The same through a word such as "municipio de", which the game drops from what is typed.
    const slovenia = new Matcher([named('bs', adds('BISTRICA'), 'Bistrica ob Sotli', 'Municipio de Bistrica ob Sotli'), named('ib', undefined, 'Ilirska Bistrica')]);
    const both = new Set(['bs', 'ib']);
    expect(slovenia.typed('bistrica', both)).toEqual({ ids: ['bs'], wait: true });
    expect(slovenia.typed('municipio de bistrica', both)).toEqual({ ids: ['bs'], wait: true });
    expect(slovenia.typed('municipio de bistrica ob sotli', both)).toEqual({ ids: ['bs'], wait: false });
    expect(slovenia.lookup('municipio de bistrica', { whole: true })).toEqual([]);
    expect(slovenia.check('municipio de bistrica', 'bs', { whole: true })).toEqual({ res: 'short' });
  });

  it('is the name alone while letters of a name are in sight', () => {
    expect(hungary.lookup('gyor', { whole: true })).toEqual(['gy']);
    expect(hungary.check('gyor', 'gy', { whole: true })).toEqual({ res: 'yes' });
    // Right but for being short: said so, rather than taken for the city and held against the player.
    expect(hungary.check('gyor', 'gs', { whole: true })).toEqual({ res: 'short' });
    expect(hungary.check('gyor-moson-sopron', 'gs', { whole: true })).toEqual({ res: 'yes' });
    // A slip of the finger away from the name of the city is the city, and not the county by its short form.
    expect(hungary.find('gyorr', { whole: true })).toEqual(['gy']);
    expect(hungary.check('gyorr', 'gs', { whole: true })).toEqual({ res: 'other', id: 'gy' });
  });
});

describe('patterns in the settings', () => {
  const sukhumi = named('GE-SU', undefined, 'Sujumi', 'Sukhumi');
  const nh = named('US-NH', undefined, 'Nuevo Hampshire', 'New Hampshire');
  const nsw = named('AU-NSW', undefined, 'Nueva Gales del Sur', 'New South Wales');
  const ok = (r: ReturnType<typeof addForm>): Typeins => {
    if ('error' in r) throw new Error(r.error);
    return r.edits;
  };

  it('ships with them as they are written, and with the things that take no initials unasked', () => {
    expect(SHIPPED).toEqual({ 'GE-SU': { add: ['r:^S[OU]KHUM', 'AQWA'] }, 'US-NH': { add: ['NH'], rule: false }, 'AU-NSW': { rule: false } });
    expect(editOf('GE-SU', AUTO)).toEqual({ add: ['r:^S[OU]KHUM', 'AQWA'] });
    expect(editOf('US-NH', AUTO)).toEqual({ add: ['NH'], rule: false });
    expect(editOf('AU-NSW', AUTO)).toEqual({ rule: false });
    expect(ruleOf('AU-NSW', AUTO)).toBe(false);
    expect(ruleOf('GE-SU', AUTO)).toBe(true);
    expect(ruleOf('GE-SU', { auto: false, edits: {} })).toBe(false);
    expect(inForce('US-NH', 'nh', AUTO)).toBe(true);
    expect(inForce('AU-NSW', 'nsw', AUTO)).toBe(false);
    expect(inForce('NZ', 'nz', AUTO)).toBe(true);
    expect(inForce('NZ', 'nz', { auto: true, edits: { NZ: { off: ['nz'] } } })).toBe(false);
  });

  it('shows a pattern as one more short form, to be switched off and on', () => {
    expect(chipsOf(sukhumi, 'GE-SU', AUTO)).toEqual([
      { key: 'r:^S[OU]KHUM', text: 'r:^S[OU]KHUM', from: 'data', usual: true, on: true, pattern: true },
      { key: 'aqwa', text: 'AQWA', from: 'data', usual: true, on: true },
    ]);
    let edits = switchForm({}, 'GE-SU', chipsOf(sukhumi, 'GE-SU', AUTO)[0], false);
    expect(edits).toEqual({ 'GE-SU': { off: ['r:^S[OU]KHUM'] } });
    expect(editOf('GE-SU', { auto: true, edits })).toEqual({ add: ['AQWA'], off: ['r:^S[OU]KHUM'] });
    const without = new Matcher([{ ...sukhumi, short: editOf('GE-SU', { auto: true, edits }) }]);
    expect(without.lookup('sokhum')).toEqual([]);
    expect(without.lookup('aqwa')).toEqual(['GE-SU']);
    expect(chipsOf(sukhumi, 'GE-SU', { auto: true, edits })[0]).toMatchObject({ on: false, usual: true });
    edits = switchForm(edits, 'GE-SU', chipsOf(sukhumi, 'GE-SU', { auto: true, edits })[0], true);
    expect(edits).toEqual({});
  });

  it('adds one, and says so when it cannot be read', () => {
    let edits = ok(addForm({}, 'GE-SU', ' r: ^tskhum ', sukhumi, AUTO));
    expect(edits).toEqual({ 'GE-SU': { add: ['r:^tskhum'] } });
    edits = ok(addForm(edits, 'GE-SU', 'c:Sukhum Kale', sukhumi, AUTO));
    expect(edits).toEqual({ 'GE-SU': { add: ['r:^tskhum', 'c:SUKHUMKALE'] } });
    expect(chipsOf(sukhumi, 'GE-SU', { auto: true, edits }).map((c) => `${c.text}|${c.from}|${c.on}|${!!c.pattern}`)).toEqual(['r:^S[OU]KHUM|data|true|true', 'AQWA|data|true|false', 'r:^tskhum|own|true|true', 'c:SUKHUMKALE|own|true|true']);
    const mine = new Matcher([{ ...sukhumi, short: editOf('GE-SU', { auto: true, edits }) }]);
    for (const text of ['tskhum', 'Sukhum-Kale', 'sokhum', 'aqwa']) expect(mine.find(text), text).toEqual(['GE-SU']);
    expect(addForm(edits, 'GE-SU', 'r:^tskhum', sukhumi, AUTO)).toEqual({ error: 'have' });
    expect(addForm(edits, 'GE-SU', 'r:^S[OU]KHUM', sukhumi, AUTO)).toEqual({ error: 'have' });
    expect(addForm(edits, 'GE-SU', 'r:^(', sukhumi, AUTO)).toEqual({ error: 'pattern' });
    expect(addForm(edits, 'GE-SU', 'r:', sukhumi, AUTO)).toEqual({ error: 'empty' });
    expect(addForm(edits, 'GE-SU', 'c: ', sukhumi, AUTO)).toEqual({ error: 'empty' });
    // A pattern that takes the name is no name: it is added like any other.
    expect(ok(addForm({}, 'GE-SU', 'r:^sukhumi$', sukhumi, AUTO))).toEqual({ 'GE-SU': { add: ['r:^sukhumi$'] } });
    // One added by hand goes with a tap; one that ships and was switched off comes back by adding it.
    const own = chipsOf(sukhumi, 'GE-SU', { auto: true, edits }).find((c) => c.text === 'r:^tskhum')!;
    expect(switchForm(edits, 'GE-SU', own, false)).toEqual({ 'GE-SU': { add: ['c:SUKHUMKALE'] } });
    expect(ok(addForm({ 'GE-SU': { off: ['r:^S[OU]KHUM'] } }, 'GE-SU', 'r:^S[OU]KHUM', sukhumi, AUTO))).toEqual({});
  });

  it('tells one form from another by its letters, and one pattern from another by its text', () => {
    expect(formKey('R.I.')).toBe('ri');
    expect(formKey('r:^A[BC]')).toBe('r:^A[BC]');
    expect(formKey('r:^a[bc]')).toBe('r:^a[bc]');
    expect(formKey(' r : ^A [BC] ')).toBe('r:^A[BC]');
    expect(formKey('c:capital')).toBe('c:CAPITAL');
    expect(formKey('r:^(')).toBe('');
    expect(tidyForm('  bay   state ')).toBe('bay state');
    expect(tidyForm(' r: ^A B ')).toBe('r:^AB');
    expect(tidyForm('r:^(')).toBe('r:^(');
  });

  it('gives no initials to what ships with a list of its own, but for those the list keeps', () => {
    // "NH" is in the list: it counts, and shows as the initials it is.
    expect(chipsOf(nh, 'US-NH', AUTO)).toEqual([{ key: 'nh', text: 'NH', from: 'initials', usual: true, on: true }]);
    expect(new Matcher([{ ...nh, short: editOf('US-NH', AUTO) }]).lookup('nh')).toEqual(['US-NH']);
    let edits = switchForm({}, 'US-NH', chipsOf(nh, 'US-NH', AUTO)[0], false);
    expect(edits).toEqual({ 'US-NH': { off: ['nh'] } });
    expect(editOf('US-NH', { auto: true, edits })).toEqual({ off: ['nh'], rule: false });
    expect(new Matcher([{ ...nh, short: editOf('US-NH', { auto: true, edits }) }]).lookup('nh')).toEqual([]);
    // "NSW" is not: it shows switched off, and is the player's to switch on.
    const chips = chipsOf(nsw, 'AU-NSW', AUTO);
    expect(chips.map((c) => `${c.text}:${c.on}:${c.usual}`)).toEqual(['NGS:false:false', 'NGDS:false:false', 'NSW:false:false']);
    expect(new Matcher([{ ...nsw, short: editOf('AU-NSW', AUTO) }]).lookup('nsw')).toEqual([]);
    edits = switchForm({}, 'AU-NSW', chips.find((c) => c.text === 'NSW')!, true);
    expect(edits).toEqual({ 'AU-NSW': { add: ['NSW'] } });
    expect(editOf('AU-NSW', { auto: true, edits })).toEqual({ add: ['NSW'], rule: false });
    const mine = new Matcher([{ ...nsw, short: editOf('AU-NSW', { auto: true, edits }) }]);
    expect(mine.lookup('nsw')).toEqual(['AU-NSW']);
    expect(mine.lookup('ngs')).toEqual([]);
    expect(chipsOf(nsw, 'AU-NSW', { auto: true, edits }).find((c) => c.text === 'NSW')).toMatchObject({ on: true, usual: false, from: 'initials' });
    expect(switchForm(edits, 'AU-NSW', chipsOf(nsw, 'AU-NSW', { auto: true, edits }).find((c) => c.text === 'NSW')!, false)).toEqual({});
  });

  it('reads them from a file, and writes them to one', () => {
    expect(
      cleanTypeins({
        'X-1': { add: ['r:^A[BC]', 'r:^A[BC]', 'r:^(', 'c:capital city', 'Mass'], off: ['r:^OLD', 'r:^(', 'N.H.'], rule: false },
        'X-2': { rule: false },
        'X-3': { rule: true },
        'X-4': { add: ['r:'] },
      }),
    ).toEqual({ 'X-1': { add: ['r:^A[BC]', 'c:CAPITALCITY', 'Mass'], off: ['r:^OLD', 'nh'], rule: false }, 'X-2': { rule: false } });
    // The file of the settings holds what ships as well, and reads back as no choice at all.
    expect(typeinFile(AUTO).edits).toEqual(SHIPPED);
    expect(readTypeinFile(typeinFile(AUTO))).toEqual({ edits: {}, auto: true });
    const edits: Typeins = { 'GE-SU': { add: ['r:^tskhum'], off: ['aqwa'] }, 'AU-NSW': { add: ['NSW'] }, 'ES-M': { add: ['r:^MADRI[DZ]'] } };
    const file = typeinFile({ auto: true, edits });
    expect(file.edits).toEqual({
      'AU-NSW': { add: ['NSW'], rule: false },
      'ES-M': { add: ['r:^MADRI[DZ]'] },
      'GE-SU': { add: ['r:^S[OU]KHUM', 'r:^tskhum'], off: ['aqwa'] },
      'US-NH': { add: ['NH'], rule: false },
    });
    expect(readTypeinFile(JSON.parse(JSON.stringify(file)))).toEqual({ edits, auto: true });
    // A file from a game that shipped otherwise: what it says about initials is kept as a choice.
    expect(readTypeinFile({ app: 'regionle', kind: 'typeins', version: 1, auto: true, edits: { 'CA-BC': { rule: false, add: ['BC'] }, 'AU-NSW': { rule: false } } })).toEqual({ edits: { 'CA-BC': { add: ['BC'], rule: false } }, auto: true });
    expect(editOf('CA-BC', { auto: true, edits: { 'CA-BC': { add: ['BC'], rule: false } } })).toEqual({ add: ['BC'], rule: false });
    // And it stays when the player goes on changing that thing.
    const bc = named('CA-BC', undefined, 'Columbia Británica', 'British Columbia');
    const kept = { 'CA-BC': { add: ['BC'], rule: false } };
    expect(ok(addForm(kept, 'CA-BC', 'r:^BRITISHC[OU]L', bc, { auto: true, edits: kept }))).toEqual({ 'CA-BC': { add: ['BC', 'r:^BRITISHC[OU]L'], rule: false } });
  });
});
