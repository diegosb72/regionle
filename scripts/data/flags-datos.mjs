// The commit of the branch `datos` that the flags are made from, and the folder that holds a copy of it.
//
// The workflow "Traer datos" keeps in that branch what it brings from Wikidata and Wikimedia Commons, which
// the place where the game is written cannot reach. Pinning the commit makes what is built from it the same
// wherever and whenever it is built; a later request to the workflow leaves a later commit, and the pin is
// moved to it by hand.
//
// Used by flags.mjs (which makes the flags) and by flags-lists.mjs (which writes the lists of what flies a
// flag and is not in the maps).

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** The commit of the branch `datos` that the flags are built from. */
export const DATOS = { repo: 'diegosb72/regionle', commit: 'c7d83ceb6017b30f78d34fb96e1eb071a5100bc1' };

/** The folder that holds the branch at the pinned commit (downloaded once, and kept), or the one that is given instead. */
export async function branch(from) {
  if (from) return path.resolve(ROOT, from);
  const dir = path.join(ROOT, '.cache', `datos-${DATOS.commit.slice(0, 12)}`);
  if (fs.existsSync(path.join(dir, 'flags'))) return dir;
  const url = `https://codeload.github.com/${DATOS.repo}/tar.gz/${DATOS.commit}`;
  console.log(`↓ ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se ha podido bajar la rama datos: HTTP ${res.status}`);
  const packed = path.join(ROOT, '.cache', `datos-${DATOS.commit.slice(0, 12)}.tgz`);
  fs.mkdirSync(path.dirname(packed), { recursive: true });
  fs.writeFileSync(packed, Buffer.from(await res.arrayBuffer()));
  fs.mkdirSync(`${dir}.part`, { recursive: true });
  execFileSync('tar', ['-xzf', packed, '-C', `${dir}.part`, '--strip-components=1']);
  fs.renameSync(`${dir}.part`, dir);
  fs.rmSync(packed);
  return dir;
}
