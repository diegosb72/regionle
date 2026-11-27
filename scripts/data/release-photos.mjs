// Inventories the owner's photo archive from a GitHub release, without publishing any of its images.
// The local workspace cannot reach GitHub's release-asset CDN; the existing "Traer datos" workflow can.
// It stores a verified list and the archive's small text/JSON documentation in the data branch,
// never the 117 MB archive or its photographs.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const MANIFEST = new URL('./release-photos.json', import.meta.url);
const read = () => JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

// Read the ZIP without extracting paths onto the filesystem or executing anything in the archive.
// Reading every entry also checks its CRC; limit both the number and total uncompressed size.
const PYTHON = String.raw`
import hashlib, json, sys, zipfile
with zipfile.ZipFile(sys.argv[1]) as archive:
    infos = [i for i in archive.infolist() if not i.is_dir()]
    if len(infos) > 5000 or sum(i.file_size for i in infos) > 2 * 1024 ** 3:
        raise ValueError('Archive exceeds the inventory limits')
    files = []
    for info in infos:
        if info.flag_bits & 1:
            raise ValueError('Encrypted archive entry: ' + info.filename)
        if (info.external_attr >> 16) & 0o170000 not in (0, 0o100000):
            raise ValueError('Archive entry is not a regular file: ' + info.filename)
        digest = hashlib.sha256()
        with archive.open(info) as photo:
            while chunk := photo.read(1024 * 1024):
                digest.update(chunk)
        files.append({'path': info.filename, 'bytes': info.file_size, 'sha256': digest.hexdigest()})
    print(json.dumps(files, ensure_ascii=False))
`;

export function inventoryZip(archivePath) {
  return JSON.parse(execFileSync('python3', ['-c', PYTHON, archivePath], { encoding: 'utf8', maxBuffer: 10_000_000, timeout: 180_000 }));
}

// The owner also put instructions, a manifest and an application script at the ZIP root. Read these as
// untrusted text, never run the script. Do not extract other files or allow archive paths to choose a target.
const DOCUMENTS = String.raw`
import base64, json, sys, zipfile
wanted = ('LEEME.md', 'FICHAS.md', 'PENDIENTES.md', 'MANIFIESTO.json', 'aplicar.py')
with zipfile.ZipFile(sys.argv[1]) as archive:
    documents = {}
    for name in wanted:
        try:
            info = archive.getinfo(name)
        except KeyError:
            continue
        if info.is_dir() or info.file_size > 1500000:
            raise ValueError('Invalid document in photo archive: ' + name)
        raw = archive.read(info)
        raw.decode('utf-8-sig')
        documents[name] = base64.b64encode(raw).decode('ascii')
    print(json.dumps(documents))
`;

export function documentsZip(archivePath) {
  return JSON.parse(execFileSync('python3', ['-c', DOCUMENTS, archivePath], { encoding: 'utf8', maxBuffer: 5_000_000, timeout: 30_000 }));
}

// Read the complete, *untrusted* photo lists and bilingual captions before choosing anything to publish.
// A single small JSON blob is enough for inspection; the original profiles are never installed from the ZIP.
const PROFILES = String.raw`
import json, re, sys, zipfile
with zipfile.ZipFile(sys.argv[1]) as archive:
    profiles = {}
    names = [i for i in archive.infolist() if re.fullmatch(r'public/data/profiles/[A-Z]{2}\.json', i.filename)]
    if len(names) != 249 or len({i.filename for i in names}) != 249 or sum(i.file_size for i in names) > 6000000:
        raise ValueError('Photo archive does not contain exactly 249 distinct, small profiles')
    for info in names:
        code = info.filename.rsplit('/', 1)[-1][:-5]
        if info.is_dir() or info.file_size > 100000:
            raise ValueError('Invalid photo profile: ' + code)
        profile = json.loads(archive.read(info).decode('utf-8-sig'))
        if profile.get('id') != code or not isinstance(profile.get('photos'), list) or not 1 <= len(profile['photos']) <= 8:
            raise ValueError('Invalid photo list: ' + code)
        profiles[code] = profile['photos']
    print(json.dumps(profiles, ensure_ascii=False, separators=(',', ':')))
`;

export function profilesZip(archivePath) {
  return JSON.parse(execFileSync('python3', ['-c', PROFILES, archivePath], { encoding: 'utf8', maxBuffer: 8_000_000, timeout: 30_000 }));
}

async function partFromGitHub(url, part) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'regionle-release-inventory/1.0 (https://github.com/diegosb72/regionle)' }, signal: AbortSignal.timeout(120_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${part.file}`);
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.length !== part.size || sha256(bytes) !== part.sha256) throw new Error(`Wrong size or SHA-256: ${part.file}`);
      return bytes;
    } catch (err) {
      if (attempt === 2 || /Wrong size or SHA-256/.test(String(err))) throw err;
      await new Promise((done) => setTimeout(done, (attempt + 1) * 2_000));
    }
  }
}

export async function releasePhotoInventory(source, keep) {
  const manifest = read();
  const url = new URL(manifest.release);
  if (url.origin !== 'https://github.com' || !/^\/diegosb72\/regionle\/releases\/tag\/[^/]+$/.test(url.pathname)) throw new Error('Unexpected release URL');
  const parts = manifest.parts;
  if (!Array.isArray(parts) || !parts.length || parts.length > 20 || new Set(parts.map((p) => p.file)).size !== parts.length) throw new Error('Missing or duplicate archive parts');
  const base = manifest.release.replace('/releases/tag/', '/releases/download/');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'regionle-photo-inventory-'));
  const archive = path.join(temp, 'photos.zip');
  try {
    for (const [index, part] of parts.entries()) {
      if (!part.file?.endsWith(`.${String(index + 1).padStart(3, '0')}`) || !Number.isInteger(part.size) || part.size > 25_000_000 || !/^[a-f0-9]{64}$/.test(part.sha256)) throw new Error('Invalid archive part manifest');
      const bytes = await partFromGitHub(`${base}/${encodeURIComponent(part.file)}`, part);
      fs.appendFileSync(archive, bytes);
      console.log(`${part.file}: ${(bytes.length / 1e6).toFixed(1)} MB, SHA-256 correct`);
    }
    const files = inventoryZip(archive);
    if (!files.length) throw new Error('The photo archive is empty');
    const documents = documentsZip(archive);
    for (const [name, base64] of Object.entries(documents)) keep(`user-photos/${name}`, Buffer.from(base64, 'base64'));
    const profiles = profilesZip(archive);
    keep('user-photos/profiles.json', Buffer.from(JSON.stringify(profiles) + '\n'));
    const images = files.filter((f) => /\.(jpe?g|png|webp|tiff?)$/i.test(f.path)).length;
    const text = JSON.stringify({ source: source.from, licence: source.licence, what: source.what, release: manifest.release, parts, files }, null, 2) + '\n';
    return { text, note: `${files.length} files (${images} images), ${Object.keys(documents).length} documents and ${Object.keys(profiles).length} photo lists; no images saved`, detail: { files: files.length, images } };
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
