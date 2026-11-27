// Turn the *candidate* photos of the owner's split ZIP into a reviewed, pinned addition to the country
// sheets. This is a one-time review step, not part of `data:profiles`: the ZIP's JSON must never replace
// a sheet or its existing head. A Commons metadata match alone is not a rights review; the manual credit
// fixes/exclusions are in release-credits.json, and unusually wide images are not usable in our gallery.
//
// To reproduce from the verified data-branch blobs (see scripts/data/release-photos.json and the review
// notes): node scripts/data/review-release.mjs <profiles.json> <audit.json> <inventory.json>
// The files are downloaded to .cache, not copied into Git. The resulting release-gallery.json is checked
// in and the WebPs are brought separately by extract-release.mjs. A new audit requires a fresh review.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const here = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const RIGHTS = /^(CC0|CC BY(?:-SA)? \d(?:\.\d)?(?: (?:igo|nl|ch|de|ee|hu|pl|cz))?|Public domain)$/;
const POOR_CREDIT = /^(?:No machine-readable|This image or media|I would appreciate|This photo was|Photo taken by|The original uploader|Original(?: uploader)?\s*:)|https?:|www\.|\b(?:derivative work|This file was uploaded|please credit|\btalk\b)\b/i;
const safeUrl = (value, host) => {
  if (typeof value !== 'string' || !URL.canParse(value)) return false;
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password && (host === undefined || url.hostname === host);
};
const stop = (text) => { throw new Error(`Release review: ${text}`); };

export function reviewedGallery(plan, profiles, audit, inventory, current, decisions) {
  if (!plan?.countries || !audit?.files || !Array.isArray(inventory?.files) || !decisions?.credits || !decisions?.excluded) stop('missing a source or review decisions');
  const files = new Map(inventory.files.map((f) => [f.path, f]));
  if (files.size !== inventory.files.length) stop('repeated paths in the ZIP inventory');
  const originals = new Map(Object.entries(current));
  const approved = {};
  const excluded = [];
  const seen = new Set();
  for (const [id, rows] of Object.entries(plan.countries)) {
    const prior = originals.get(id)?.photos;
    if (!Array.isArray(prior) || !prior.length || !Array.isArray(rows)) stop(`${id}: not a current country with photos`);
    const titles = new Set(prior.map((photo) => photo.title));
    const hashes = new Set(prior.map((photo) => photo.file));
    const additions = [];
    for (const entry of rows) {
      const { title, file, sha256 } = entry;
      if (seen.has(title) || titles.has(title) || hashes.has(file)) stop(`${id}: duplicate or replaced photo ${title}`);
      seen.add(title);
      const photo = profiles[id]?.find((p) => p.title === title);
      const commons = audit.files[title];
      const indexed = files.get(`public/photos/${file}-640.webp`);
      if (!photo || !commons || commons.missing || !indexed) stop(`${id}: missing source for ${title}`);
      if (!/^[a-f0-9]{10}$/.test(file) || !/^[a-f0-9]{64}$/.test(sha256) || commons.sha1?.slice(0, 10) !== file || !/^[a-f0-9]{40}$/.test(commons.sha1) || indexed.sha256 !== sha256) stop(`${id}: mismatched archive/Commons checksum for ${title}`);
      if (commons.canonical !== title || !safeUrl(commons.page, 'commons.wikimedia.org') || !RIGHTS.test(commons.licence ?? '') || !['image/jpeg', 'image/png'].includes(commons.mime) || commons.restrictions) stop(`${id}: unapproved Commons metadata for ${title}`);
      if (photo.file !== file || photo.title !== title || photo.w < 640 || photo.h < 1 || !photo.sizes?.includes(640) || !photo.es?.trim() || !photo.en?.trim() || indexed.bytes < 2000 || indexed.bytes > 300_000) stop(`${id}: invalid picture or bilingual caption for ${title}`);
      if (decisions.excluded[title]) { excluded.push({ id, title, reason: decisions.excluded[title] }); continue; }
      // A 4:1 or wider panorama shrinks to <115 px high in our two-column masonry on desktop.
      if (photo.w / photo.h > 4) { excluded.push({ id, title, reason: 'Panorámica de más de 4:1: demasiado pequeña en la galería a dos columnas.' }); continue; }
      const override = decisions.credits[title];
      if (override && (Object.keys(override).some((key) => !['by', 'byUrl', 'licence', 'licenceUrl', 'note'].includes(key)) || !override.by?.trim())) stop(`${id}: invalid manual credit for ${title}`);
      // extmetadata may report the licence of the depicted *object* (PD), not the photograph (CC BY).
      // Correct only that case, with an explicit note from a review of the Commons file page.
      if (override?.licence && (commons.licence !== 'Public domain' || !override.note?.trim() || !override.licenceUrl)) stop(`${id}: an unverified manual licence correction for ${title}`);
      const licence = override?.licence ?? commons.licence;
      const licenceUrl = (override?.licenceUrl ?? commons.licenceUrl)?.replace(/^http:/, 'https:');
      if (!RIGHTS.test(licence) || (licence.startsWith('CC') && !safeUrl(licenceUrl, 'creativecommons.org'))) stop(`${id}: missing free-licence link for ${title}`);
      const by = override?.by ?? commons.artist;
      if (by && (typeof by !== 'string' || by.length > 60 || POOR_CREDIT.test(by))) stop(`${id}: verify the author manually for ${title}: ${by}`);
      if ((commons.attribution || /^CC BY/.test(licence)) && !by) stop(`${id}: no credited author for ${title}`);
      if (override?.byUrl && !safeUrl(override.byUrl)) stop(`${id}: invalid credit link for ${title}`);
      additions.push({ file, w: photo.w, h: photo.h, sizes: [640], title,
        ...(by ? { by } : {}), ...(override?.byUrl ? { byUrl: override.byUrl } : {}),
        licence, ...(licenceUrl ? { licenceUrl } : {}), es: photo.es, en: photo.en,
        ...(photo.focus ? { focus: photo.focus } : {}), sha256 });
      titles.add(title);
      hashes.add(file);
    }
    if (prior.length + additions.length > 8) stop(`${id}: more than eight photos, including existing ones`);
    if (additions.length) approved[id] = additions;
  }
  for (const title of [...Object.keys(decisions.credits), ...Object.keys(decisions.excluded)]) if (!seen.has(title)) stop(`decision for a photo outside the plan: ${title}`);
  return {
    _: 'Adiciones revisadas de la release imagenes: las fotografías actuales se conservan en primer lugar. Licencia y autor contrastados con Commons; archivo WebP fijado por SHA-256. No aplicar los JSON del ZIP. Exclusiones y correcciones: scripts/data/release-credits.json.',
    release: plan.release, countries: approved, excluded,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [profiles, audit, inventory] = process.argv.slice(2);
  if (!profiles || !audit || !inventory) stop('usage: review-release.mjs <profiles.json> <audit.json> <inventory.json>');
  const current = Object.fromEntries(fs.readdirSync(path.join(ROOT, 'public/data/profiles')).filter((f) => /^[A-Z]{2}\.json$/.test(f)).map((f) => [f.slice(0, 2), here(`public/data/profiles/${f}`)]));
  const result = reviewedGallery(here('scripts/data/release-photo-plan.json'), here(profiles), here(audit), here(inventory), current, here('scripts/data/release-credits.json'));
  fs.writeFileSync(path.join(ROOT, 'scripts/data/release-gallery.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(`${Object.values(result.countries).flat().length} reviewed additions for ${Object.keys(result.countries).length} countries; ${result.excluded.length} excluded`);
}
