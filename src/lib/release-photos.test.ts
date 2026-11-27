// The release archive is treated as untrusted input: only its fixed, small documents and photo lists are
// read for review. Neither the ZIP application script nor any file inside the archive is ever executed.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// @ts-expect-error a data-ingestion script without TypeScript declarations
import { documentsZip, inventoryZip, profilesZip } from '../../scripts/data/release-photos.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-photo-test-'));
const archive = path.join(dir, 'photos.zip');
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));
beforeAll(() => {
  execFileSync('python3', ['-c', String.raw`
import json, sys, zipfile
with zipfile.ZipFile(sys.argv[1], 'w', compression=zipfile.ZIP_DEFLATED) as archive:
    for n in range(249):
        code = chr(65 + n // 26) + chr(65 + n % 26)
        archive.writestr(f'public/data/profiles/{code}.json', json.dumps({'id': code, 'photos': [{'title': f'{code} in Commons.jpg', 'file': '0123456789', 'es': 'Un lugar', 'en': 'A place'}]}))
    archive.writestr('LEEME.md', 'Fotografías para examinar\n')
    archive.writestr('MANIFIESTO.json', '{"licencia":"sin verificar"}')
    archive.writestr('aplicar.py', 'raise Exception("Do not execute me")\n')
    archive.writestr('public/photos/0123456789-640.webp', b'not a real image')
`, archive]);
});

describe('the untrusted release archive', () => {
  it('inventories contents with sizes and SHA-256, without extracting or running them', () => {
    const entries = inventoryZip(archive);
    expect(entries).toHaveLength(253);
    expect(entries.find((f: { path: string }) => f.path === 'public/photos/0123456789-640.webp')).toMatchObject({
      bytes: 16,
      sha256: createHash('sha256').update('not a real image').digest('hex'),
    });
    expect(fs.readdirSync(dir)).toEqual(['photos.zip']);
  });

  it('reads only named, small documents and 249 photo lists, never installs whole profile JSON files', () => {
    const docs = documentsZip(archive);
    expect(Object.keys(docs).sort()).toEqual(['LEEME.md', 'MANIFIESTO.json', 'aplicar.py']);
    expect(Buffer.from(docs['LEEME.md'], 'base64').toString()).toBe('Fotografías para examinar\n');
    expect(docs['public/photos/0123456789-640.webp']).toBeUndefined();
    const profiles = profilesZip(archive);
    expect(Object.keys(profiles)).toHaveLength(249);
    expect(profiles.AA).toEqual([{ title: 'AA in Commons.jpg', file: '0123456789', es: 'Un lugar', en: 'A place' }]);
    expect(fs.readdirSync(dir)).toEqual(['photos.zip']);
  });
});
