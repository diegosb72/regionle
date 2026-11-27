// Only the explicitly reviewed, SHA-256-pinned WebPs from release-gallery.json are extracted from the
// owner's split archive. No ZIP path is used as a destination; no existing photo is ever overwritten.
// GitHub Actions can fetch release assets where the local sandbox cannot. With --archive, tests can use a
// small local ZIP and exercise the exact same checks without networking.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withReleaseArchive } from './release-photos.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PYTHON = String.raw`
import hashlib, json, pathlib, re, sys, zipfile
archive, gallery_file, out = sys.argv[1:]
base = pathlib.Path(out)
with open(gallery_file, encoding='utf-8') as source:
    gallery = json.load(source)
selected = {}
for country, photos in gallery['countries'].items():
    if not re.fullmatch(r'[A-Z]{2}', country) or not isinstance(photos, list):
        raise ValueError('Invalid country in reviewed gallery')
    for photo in photos:
        file = photo['file']
        checksum = photo['sha256']
        if not re.fullmatch(r'[0-9a-f]{10}', file) or not re.fullmatch(r'[0-9a-f]{64}', checksum):
            raise ValueError('Invalid reviewed photo checksum')
        name = file + '-640.webp'
        if name in selected:
            raise ValueError('Repeated reviewed photo: ' + name)
        selected[name] = checksum
if not selected or len(selected) > 2000:
    raise ValueError('Implausible number of reviewed photos')
with zipfile.ZipFile(archive) as photos:
    infos = photos.infolist()
    if len(infos) > 5000 or sum(info.file_size for info in infos) > 2 * 1024**3:
        raise ValueError('Photo archive exceeds safety limits')
    names = {}
    for info in infos:
        if info.filename in names:
            raise ValueError('Repeated ZIP entry: ' + info.filename)
        names[info.filename] = info
    verified = {}
    for name, checksum in selected.items():
        # Only this exact path in the ZIP is read, and only the *basename* chosen above is written.
        info = names.get('public/photos/' + name)
        if not info or info.is_dir() or info.flag_bits & 1 or (info.external_attr >> 16) & 0o170000 not in (0, 0o100000):
            raise ValueError('Missing or invalid photo in ZIP: ' + name)
        if info.file_size < 2000 or info.file_size > 300000:
            raise ValueError('Invalid WebP size: ' + name)
        raw = photos.read(info)  # Checks the ZIP entry's CRC.
        if raw[:4] != b'RIFF' or raw[8:12] != b'WEBP' or hashlib.sha256(raw).hexdigest() != checksum:
            raise ValueError('Wrong WebP or SHA-256: ' + name)
        dest = base / name
        if dest.is_symlink() or (dest.exists() and (not dest.is_file() or hashlib.sha256(dest.read_bytes()).hexdigest() != checksum)):
            raise ValueError('Existing photo must not be replaced: ' + name)
        verified[name] = raw
base.mkdir(parents=True, exist_ok=True)
for name, raw in verified.items():
    dest = base / name
    if not dest.exists():
        with dest.open('xb') as target:
            target.write(raw)
print(f'{len(verified)} reviewed WebPs verified, {sum(len(b) for b in verified.values())} bytes; existing photos unchanged')
`;

export function extractReviewedZip(archive, gallery, out) {
  return execFileSync('python3', ['-c', PYTHON, archive, gallery, out], { encoding: 'utf8', timeout: 180_000, maxBuffer: 500_000 }).trim();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (key) => { const i = process.argv.indexOf(`--${key}`); return i < 0 ? undefined : process.argv[i + 1]; };
  const gallery = path.resolve(ROOT, arg('gallery') ?? 'scripts/data/release-gallery.json');
  const photos = path.resolve(ROOT, arg('photos') ?? 'public/photos');
  if (!fs.existsSync(gallery)) throw new Error('Reviewed release gallery is missing');
  const archive = arg('archive');
  if (archive) console.log(extractReviewedZip(path.resolve(archive), gallery, photos));
  else await withReleaseArchive(async (zip, manifest) => {
    if (JSON.parse(fs.readFileSync(gallery, 'utf8')).release !== manifest.release) throw new Error('Reviewed gallery does not match the release archive');
    console.log(extractReviewedZip(zip, gallery, photos));
  });
}
