import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, describe, expect, it } from 'vitest';
// @ts-expect-error data review script (plain JS)
import { reviewedGallery } from '../../scripts/data/review-release.mjs';
// @ts-expect-error extraction script (plain JS)
import { extractReviewedZip } from '../../scripts/data/extract-release.mjs';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'review-release-'));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

const title = 'New Commons.jpg';
const file = 'abcdef0123';
const sha256 = 'e'.repeat(64);
const license = 'CC BY-SA 4.0';
const mock = () => {
  const plan = { release: 'https://github.com/diegosb72/regionle/releases/tag/imagenes', countries: { AA: [{ title, file, sha256 }] } };
  const profiles = { AA: [{ file, w: 1280, h: 800, sizes: [640, 1280], title, es: 'Una vista', en: 'A view' }] };
  const audit = { files: { [title]: { canonical: title, sha1: `${file}${'0'.repeat(30)}`, mime: 'image/jpeg', licence: license,
    licenceUrl: 'http://creativecommons.org/licenses/by-sa/4.0', artist: 'A. Photographer', attribution: true,
    page: 'https://commons.wikimedia.org/wiki/File:New_Commons.jpg' } } };
  const inventory = { files: [{ path: `public/photos/${file}-640.webp`, sha256, bytes: 32_000 }] };
  const current = { AA: { photos: [{ title: 'Head.jpg', file: '1234567890' }] } };
  const decisions: { credits: Record<string, { by: string; byUrl?: string; licence?: string; licenceUrl?: string; note?: string }>; excluded: Record<string, string> } = { credits: {}, excluded: {} };
  return { plan, profiles, audit, inventory, current, decisions };
};

describe('reviewing the candidate ZIP photos', () => {
  it('pins Commons terms and the ZIP checksum after the existing head, normalising old HTTP license URLs', () => {
    const sources = mock();
    const gallery = reviewedGallery(...Object.values(sources));
    expect(gallery.countries.AA[0]).toEqual({ file, w: 1280, h: 800, sizes: [640], title, by: 'A. Photographer',
      licence: license, licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0', es: 'Una vista', en: 'A view', sha256 });
    expect(sources.current.AA.photos).toEqual([{ title: 'Head.jpg', file: '1234567890' }]);
  });

  it('excludes an unusable panorama and explicitly rejected provenance, without replacing a photo', () => {
    const one = mock();
    one.profiles.AA[0].h = 200;
    expect(reviewedGallery(...Object.values(one)).excluded).toMatchObject([{ title }]);
    one.profiles.AA[0].h = 800;
    one.decisions.excluded[title] = 'Unclear provenance';
    expect(reviewedGallery(...Object.values(one)).excluded).toEqual([{ id: 'AA', title, reason: 'Unclear provenance' }]);
    expect(reviewedGallery(...Object.values(one)).countries).toEqual({});
  });

  it('rejects wrong hashes, duplicate heads, missing credits, unsafe terms and incomplete captions', () => {
    const one = mock();
    one.inventory.files[0].sha256 = '0'.repeat(64);
    expect(() => reviewedGallery(...Object.values(one))).toThrow(/checksum/);
    one.inventory.files[0].sha256 = sha256;
    one.current.AA.photos[0].title = title;
    expect(() => reviewedGallery(...Object.values(one))).toThrow(/duplicate/);
    one.current.AA.photos[0].title = 'Head.jpg';
    one.audit.files[title].artist = '';
    expect(() => reviewedGallery(...Object.values(one))).toThrow(/no credited author/);
    one.audit.files[title].artist = 'A. Photographer';
    one.audit.files[title].licence = 'All rights reserved';
    expect(() => reviewedGallery(...Object.values(one))).toThrow(/unapproved Commons/);
    one.audit.files[title].licence = license;
    one.profiles.AA[0].en = '';
    expect(() => reviewedGallery(...Object.values(one))).toThrow(/bilingual caption/);
  });

  it('keeps an explicitly verified credit and a safe requested link', () => {
    const one = mock();
    one.audit.files[title].artist = 'This image or media was taken by someone else';
    expect(() => reviewedGallery(...Object.values(one))).toThrow(/verify the author/);
    one.decisions.credits[title] = { by: 'A. Photographer', byUrl: 'https://example.org/artist' };
    expect(reviewedGallery(...Object.values(one)).countries.AA[0].byUrl).toBe('https://example.org/artist');
    one.audit.files[title].licence = 'Public domain';
    one.decisions.credits[title] = { by: 'A. Photographer', licence: 'CC BY 2.0', licenceUrl: 'https://creativecommons.org/licenses/by/2.0', note: 'The object is PD but its photograph is CC BY' };
    expect(reviewedGallery(...Object.values(one)).countries.AA[0].licence).toBe('CC BY 2.0');
    delete one.decisions.credits[title].note;
    expect(() => reviewedGallery(...Object.values(one))).toThrow(/unverified manual licence/);
  });
});

describe('extracting only reviewed WebPs', () => {
  it('checks the ZIP WebP and checksum and never overwrites an existing photo', async () => {
    const raw = Buffer.alloc(640 * 400 * 3);
    let seed = 123;
    for (let i = 0; i < raw.length; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; raw[i] = seed >>> 24; }
    const image = await sharp(raw, { raw: { width: 640, height: 400, channels: 3 } }).webp().toBuffer();
    const bytes = path.join(TMP, 'fixture.webp');
    const archive = path.join(TMP, 'photos.zip');
    const gallery = path.join(TMP, 'gallery.json');
    const output = path.join(TMP, 'photos');
    fs.writeFileSync(bytes, image);
    execFileSync('python3', ['-c', 'import sys,zipfile\nwith zipfile.ZipFile(sys.argv[1], "w") as z: z.write(sys.argv[2], sys.argv[3])', archive, bytes, `public/photos/${file}-640.webp`]);
    const pinned = createHash('sha256').update(image).digest('hex');
    const entry = { file, sha256: pinned };
    fs.writeFileSync(gallery, JSON.stringify({ countries: { AA: [entry] } }));
    expect(extractReviewedZip(archive, gallery, output)).toContain('1 reviewed WebPs');
    expect(fs.readFileSync(path.join(output, `${file}-640.webp`))).toEqual(image);
    expect(extractReviewedZip(archive, gallery, output)).toContain('existing photos unchanged');
    fs.writeFileSync(path.join(output, `${file}-640.webp`), 'original image must survive');
    expect(() => extractReviewedZip(archive, gallery, output)).toThrow(/Existing photo must not be replaced/);
    expect(fs.readFileSync(path.join(output, `${file}-640.webp`), 'utf8')).toBe('original image must survive');
    fs.writeFileSync(gallery, JSON.stringify({ countries: { AA: [{ ...entry, sha256: '0'.repeat(64) }] } }));
    expect(() => extractReviewedZip(archive, gallery, path.join(TMP, 'other'))).toThrow(/Wrong WebP or SHA-256/);
  });
});
