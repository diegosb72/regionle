// Inventories the owner's photo archive from a GitHub release, without publishing any of its images.
// The local workspace cannot reach GitHub's release-asset CDN; the existing "Traer datos" workflow can.
// It stores only a small, verified list in the data branch, never the 117 MB archive or its photographs.
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

export async function releasePhotoInventory(source) {
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
    const images = files.filter((f) => /\.(jpe?g|png|webp|tiff?)$/i.test(f.path)).length;
    const text = JSON.stringify({ source: source.from, licence: source.licence, what: source.what, release: manifest.release, parts, files }, null, 2) + '\n';
    return { text, note: `${files.length} files (${images} images); only names, sizes and hashes saved, not the ZIP`, detail: { files: files.length, images } };
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
