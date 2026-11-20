#!/usr/bin/env node
/**
 * Static staging step for GitHub Pages.
 *
 * There is no compile step. This script only copies the files that make up
 * the WebApp into dist/ so the Pages artifact does not contain tooling, docs,
 * tests or git metadata.
 */
import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');

const FILES = [
  'manifest.webmanifest',
  'sw.js',
  '.nojekyll',
  'LICENSE',
];

const DIRS = ['css', 'js', 'data', 'assets', 'partials'];

async function main() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  for (const entry of await readdir(ROOT)) {
    if (entry.endsWith('.html')) {
      await cp(join(ROOT, entry), join(DIST, entry));
    }
  }

  for (const file of FILES) {
    try {
      await stat(join(ROOT, file));
      await cp(join(ROOT, file), join(DIST, file));
    } catch {
      console.warn(`[build] optional file missing: ${file}`);
    }
  }

  for (const dir of DIRS) {
    await cp(join(ROOT, dir), join(DIST, dir), { recursive: true });
  }

  console.log(`[build] static site ready in ${DIST}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
