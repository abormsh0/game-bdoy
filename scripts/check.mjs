import { readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scripts = ['dist/app.js', 'dist/simulation.js', 'dist/controls.js', 'dist/world.js', 'scripts/serve.mjs', 'scripts/prepare-vendor.mjs'];
for (const file of scripts) {
  const result = spawnSync(process.execPath, ['--check', resolve(root, file)], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(file + ': ' + result.stderr);
}
const html = await readFile(resolve(root, 'dist/index.html'), 'utf8');
for (const match of html.matchAll(/(?:src|href)="\.\/([^"]+)"/g)) await access(resolve(root, 'dist', match[1]));
JSON.parse(await readFile(resolve(root, 'dist/manifest.webmanifest'), 'utf8'));
await access(resolve(root, 'dist/vendor/three.module.js'));
await access(resolve(root, 'dist/vendor/three.core.js'));
console.log('JavaScript syntax, manifest, and local asset paths passed.');
