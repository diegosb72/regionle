import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { RELEASES, changelogMarkdown } from './changelog';

const ROOT = path.join(__dirname, '../..');
const parts = (version: string) => version.split('.').map(Number);
const newer = (a: string, b: string) => {
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
};

describe('what each version brought', () => {
  it('starts with the version the game says it is', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as { version: string };
    const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8')) as { version: string; packages: Record<string, { version: string }> };
    expect(RELEASES[0].version).toBe(pkg.version);
    expect(lock.version).toBe(pkg.version);
    expect(lock.packages[''].version).toBe(pkg.version);
  });

  it('goes from the newest version to the first, each with a real calendar day', () => {
    for (const [i, r] of RELEASES.entries()) {
      expect(r.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(`${r.date}T00:00:00Z`).toISOString().slice(0, 10)).toBe(r.date);
      // Versions are ordered; dates are their own records, not a sorting key. A corrected date must not
      // require changing the date recorded for an earlier version.
      if (i) expect(newer(RELEASES[i - 1].version, r.version), `${RELEASES[i - 1].version} > ${r.version}`).toBe(true);
    }
    expect(RELEASES[RELEASES.length - 1].version).toBe('1.0.0');
  });

  it('says the same things in both languages', () => {
    for (const r of RELEASES) {
      expect(r.es.length, r.version).toBeGreaterThan(0);
      expect(r.en.length, r.version).toBe(r.es.length);
      for (const line of [...r.es, ...r.en]) {
        expect(line.trim()).toBe(line);
        expect(line, line).toMatch(/[.!?]$/);
        expect(line.length, line).toBeLessThanOrEqual(160);
      }
    }
  });

  it('is what CHANGELOG.md says', async () => {
    // Written from the list when it is missing or with `npm test -- -u`; any other difference is a failure.
    await expect(changelogMarkdown()).toMatchFileSnapshot(path.join(ROOT, 'CHANGELOG.md'));
  });

  it('writes one heading for each version and one line for each thing', () => {
    const text = changelogMarkdown([
      { version: '2.0.0', date: '2027-03-01', es: ['Una cosa.', 'Otra.'], en: ['One thing.', 'Another.'] },
      { version: '1.0.0', date: '2026-11-16', es: ['La primera.'], en: ['The first.'] },
    ]);
    expect(text).toContain('\n## 2.0.0 — 1 de marzo de 2027\n\n- Una cosa.\n- Otra.\n\n## 1.0.0 — 16 de noviembre de 2026\n\n- La primera.\n');
    expect(text).not.toContain('One thing');
    expect(text.endsWith('- La primera.\n')).toBe(true);
  });
});
